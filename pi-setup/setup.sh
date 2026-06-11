#!/bin/bash
# One-shot installer for the Museum Kiosk system on Raspberry Pi.
# Run as root: sudo bash setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PREFIX="[setup]"

log()  { echo "$LOG_PREFIX $*"; }
error() { echo "$LOG_PREFIX ERROR: $*" >&2; }
die()   { error "$*"; exit 1; }

# Must run as root
if [ "$(id -u)" -ne 0 ]; then
    die "Please run as root: sudo bash setup.sh"
fi

# Warn if not running on a Raspberry Pi
if ! grep -qi "raspberry" /proc/device-tree/model 2>/dev/null; then
    echo ""
    echo "WARNING: This does not appear to be a Raspberry Pi."
    echo "         Continuing anyway — press Ctrl+C within 5 seconds to abort."
    echo ""
    sleep 5
fi

# ── Kiosk ID ─────────────────────────────────────────────────────────────────
# Priority: existing config (idempotent re-run) → interactive prompt →
# auto-derived from hardware serial (golden image / non-interactive path).
KIOSK_ID=""
if [ -f /etc/museum-kiosk/kiosk-id.json ]; then
    KIOSK_ID=$(python3 -c "import json; print(json.load(open('/etc/museum-kiosk/kiosk-id.json')).get('kioskId',''))" 2>/dev/null || true)
fi

if [ -z "$KIOSK_ID" ] && [ -t 0 ]; then
    echo ""
    echo "Enter the kiosk ID for this device (e.g. RPI_01)."
    echo "(Leer lassen = automatisch aus der Hardware-Seriennummer ableiten)"
    read -r KIOSK_ID
fi

if [ -z "$KIOSK_ID" ]; then
    SERIAL=$(awk '/^Serial/ {print $3}' /proc/cpuinfo 2>/dev/null || true)
    if [ -n "$SERIAL" ]; then
        KIOSK_ID="PI-$(echo "${SERIAL: -4}" | tr '[:lower:]' '[:upper:]')"
    else
        die "Keine Kiosk-ID angegeben und keine Hardware-Seriennummer gefunden."
    fi
fi

log "Kiosk ID: $KIOSK_ID"

# ── WiFi ─────────────────────────────────────────────────────────────────────
# Quelle der Wahrheit: /etc/museum-kiosk/wlans.conf (kommt aus dem Golden Image
# oder wird per scp eingespielt — NICHT im Repo, enthält Passwörter).
# Format pro Zeile:  SSID<TAB>PASSWORT<TAB>PRIORITÄT   (# = Kommentar)
# Fallback für Erstinstallation ohne Datei: TTY-Prompt bzw. Imager-WLAN/Ethernet.

add_wifi() {
    local SSID="$1" PASS="$2" PRIO="$3"
    if command -v nmcli &>/dev/null; then
        nmcli dev wifi connect "$SSID" password "$PASS" 2>/dev/null || \
            nmcli con add type wifi ifname wlan0 ssid "$SSID" wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$PASS" 2>/dev/null || \
            { error "WLAN '$SSID' konnte nicht hinzugefügt werden."; return 1; }
        nmcli con modify "$SSID" connection.autoconnect yes
        nmcli con modify "$SSID" connection.autoconnect-priority "$PRIO"
        log "WLAN '$SSID' gespeichert (Priorität $PRIO)."
    elif [ -f /etc/wpa_supplicant/wpa_supplicant.conf ]; then
        wpa_passphrase "$SSID" "$PASS" >> /etc/wpa_supplicant/wpa_supplicant.conf
        log "WLAN '$SSID' gespeichert (wpa_supplicant)."
    else
        error "Weder NetworkManager noch wpa_supplicant gefunden."
        return 1
    fi
}

# 1) Fixe Netze aus wlans.conf einspielen (idempotent — Image-Variante)
WLANS_CONF="/etc/museum-kiosk/wlans.conf"
if [ -f "$WLANS_CONF" ]; then
    while IFS=$'\t' read -r SSID PASS PRIO; do
        case "$SSID" in ''|'#'*) continue ;; esac
        PRIO="${PRIO:-10}"
        if command -v nmcli &>/dev/null && nmcli -t -f NAME con show 2>/dev/null | grep -qxF "$SSID"; then
            nmcli con modify "$SSID" wifi-sec.psk "$PASS" connection.autoconnect yes connection.autoconnect-priority "$PRIO" 2>/dev/null \
                && log "WLAN '$SSID' aktualisiert (Priorität $PRIO)." \
                || error "WLAN '$SSID' konnte nicht aktualisiert werden."
        else
            add_wifi "$SSID" "$PASS" "$PRIO"
        fi
    done < "$WLANS_CONF"
    chmod 600 "$WLANS_CONF"
fi

# 2) Prüfe ob bereits WLAN verbunden
WIFI_CONNECTED=false
if command -v nmcli &>/dev/null; then
    nmcli -t -f TYPE,STATE dev 2>/dev/null | grep -q "wifi:connected" && WIFI_CONNECTED=true
elif iwconfig wlan0 2>/dev/null | grep -q "ESSID:\""; then
    WIFI_CONNECTED=true
fi

if [ "$WIFI_CONNECTED" = true ] || [ -f "$WLANS_CONF" ]; then
    log "WLAN konfiguriert — interaktiver Bootstrap übersprungen."
elif [ ! -t 0 ]; then
    log "Non-interaktiv und kein WLAN — Ethernet oder Imager-WLAN wird vorausgesetzt."
else
    echo ""
    echo "WLAN wird für die Erstinstallation benötigt."
    echo "WLAN SSID:"
    read -r WIFI_SSID
    echo "WLAN Passwort:"
    read -rs WIFI_PASS
    echo ""
    if [ -n "$WIFI_SSID" ]; then
        add_wifi "$WIFI_SSID" "$WIFI_PASS" 50
        # dhcpcd neu starten falls wpa_supplicant benutzt
        if ! command -v nmcli &>/dev/null && [ -f /etc/wpa_supplicant/wpa_supplicant.conf ]; then
            if ! grep -q "interface wlan0" /etc/dhcpcd.conf 2>/dev/null; then
                echo -e "\ninterface wlan0\nenv ifwireless=1\nenv wpa_supplicant_driver=nl80211" >> /etc/dhcpcd.conf
            fi
            systemctl restart dhcpcd 2>/dev/null || true
            wpa_cli -i wlan0 reconfigure 2>/dev/null || true
        fi
    else
        error "SSID darf nicht leer sein — WLAN übersprungen."
    fi
fi
log "Hinweis: Fixe WLAN-Netze stehen in $WLANS_CONF (Image bzw. per scp)."

# ── Packages ─────────────────────────────────────────────────────────────────

log "Installing packages..."
apt-get update -qq
apt-get install -y nginx chromium jq wget rsync unzip curl python3 unclutter labwc wayvnc

# ── Tailscale (Fernwartung: SSH + Remote Desktop von überall) ────────────────
# Auth-Key liegt unter /etc/museum-kiosk/tailscale-authkey (Golden Image oder
# manuell). Ohne Key wird Tailscale installiert, aber nicht verbunden.

if ! command -v tailscale &>/dev/null; then
    log "Installing Tailscale..."
    curl -fsSL https://tailscale.com/install.sh | sh || error "Tailscale-Installation fehlgeschlagen (Fernwartung deaktiviert)"
fi

TS_KEYFILE="/etc/museum-kiosk/tailscale-authkey"
if command -v tailscale &>/dev/null; then
    systemctl enable --now tailscaled 2>/dev/null || true
    if ! tailscale status &>/dev/null; then
        if [ -f "$TS_KEYFILE" ]; then
            TS_HOSTNAME=$(echo "$KIOSK_ID" | tr '[:upper:]_' '[:lower:]-')
            log "Joining Tailscale network as '$TS_HOSTNAME'..."
            tailscale up --authkey "$(tr -d '[:space:]' < "$TS_KEYFILE")" \
                --hostname "$TS_HOSTNAME" --ssh 2>/dev/null \
                && log "Tailscale verbunden." \
                || error "Tailscale-Anmeldung fehlgeschlagen — Key prüfen."
        else
            log "Kein Tailscale-Key unter $TS_KEYFILE — Fernwartung später aktivierbar."
        fi
    else
        log "Tailscale bereits verbunden."
    fi
fi

# ── Kiosk identity ────────────────────────────────────────────────────────────

log "Writing kiosk identity..."
mkdir -p /etc/museum-kiosk

# Placeholder damit nginx nicht abbricht — wird von sync-content.sh überschrieben
if [ ! -f /etc/museum-kiosk/website-proxy.conf ]; then
    echo "proxy_pass http://127.0.0.1/;" > /etc/museum-kiosk/website-proxy.conf
fi
if [ ! -f /etc/museum-kiosk/website-subfilter.conf ]; then
    echo "# sub_filter placeholder" > /etc/museum-kiosk/website-subfilter.conf
fi
cat > /etc/museum-kiosk/kiosk-id.json <<EOF
{"kioskId": "$KIOSK_ID"}
EOF

# ── nginx ─────────────────────────────────────────────────────────────────────

log "Configuring nginx..."
cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/museum

# Remove default site if present, then enable museum site
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/museum /etc/nginx/sites-enabled/museum

nginx -t || die "nginx config test failed"

# ── Web root ──────────────────────────────────────────────────────────────────

log "Creating web root..."
mkdir -p /var/www/museum/videos
chown -R www-data:www-data /var/www/museum

# ── Sync scripts ──────────────────────────────────────────────────────────────

log "Installing sync scripts..."
cp "$SCRIPT_DIR/sync-build.sh"   /usr/local/bin/sync-build.sh
cp "$SCRIPT_DIR/sync-videos.sh"  /usr/local/bin/sync-videos.sh
cp "$SCRIPT_DIR/sync-content.sh" /usr/local/bin/sync-content.sh
cp "$SCRIPT_DIR/heartbeat.sh"    /usr/local/bin/heartbeat.sh
chmod +x /usr/local/bin/sync-build.sh /usr/local/bin/sync-videos.sh /usr/local/bin/sync-content.sh /usr/local/bin/heartbeat.sh

# ── Sanity write token ────────────────────────────────────────────────────────

if [ -f /etc/museum-kiosk/sanity-token ]; then
    log "Sanity token already present — keeping it."
elif [ -t 0 ]; then
    echo ""
    echo "Enter the Sanity write token for this device (from sanity.io/manage → API → Tokens):"
    echo "(Leave empty to skip — you can add it later: echo 'sk...' > /etc/museum-kiosk/sanity-token)"
    read -r SANITY_TOKEN
    if [ -n "$SANITY_TOKEN" ]; then
        echo "$SANITY_TOKEN" > /etc/museum-kiosk/sanity-token
        chmod 600 /etc/museum-kiosk/sanity-token
        log "Sanity token saved."
    else
        log "Skipped — heartbeat/self-registration inactive until token is set."
    fi
else
    log "Non-interaktiv, kein Token vorhanden — heartbeat/self-registration inaktiv bis Token gesetzt."
fi

# ── Kiosk: systemd user service + labwc autostart ────────────────────────────
#
# Chromium runs as a systemd USER service (not system), launched from labwc's
# autostart. This gives it the correct Wayland session context automatically.
#
# System services (nginx, sync) stay as system units.

KIOSK_USER="museumgh"

# Create kiosk user if it doesn't exist
if ! id "$KIOSK_USER" &>/dev/null; then
    log "Creating user $KIOSK_USER..."
    adduser --disabled-password --gecos "Museum Kiosk" "$KIOSK_USER"
    # Add to required groups for Wayland / audio
    usermod -aG video,audio,input,render "$KIOSK_USER"
fi

KIOSK_UID=$(id -u "$KIOSK_USER")
USER_SYSTEMD_DIR="/home/$KIOSK_USER/.config/systemd/user"
LABWC_DIR="/home/$KIOSK_USER/.config/labwc"

log "Installing user services (chromium, wayvnc)..."
mkdir -p "$USER_SYSTEMD_DIR"
cp "$SCRIPT_DIR/chromium-kiosk.service" "$USER_SYSTEMD_DIR/chromium-kiosk.service"
cp "$SCRIPT_DIR/wayvnc.service"         "$USER_SYSTEMD_DIR/wayvnc.service"
chown -R "$KIOSK_USER:$KIOSK_USER" "/home/$KIOSK_USER/.config/systemd"

log "Configuring labwc autostart..."
mkdir -p "$LABWC_DIR"
cp "$SCRIPT_DIR/labwc-autostart" "$LABWC_DIR/autostart"
chown -R "$KIOSK_USER:$KIOSK_USER" "$LABWC_DIR"

log "Enabling chromium user service (loginctl linger)..."
# linger allows user services to start without an interactive session
loginctl enable-linger "$KIOSK_USER"
# Enable the service in the user unit store
sudo -u "$KIOSK_USER" XDG_RUNTIME_DIR="/run/user/$KIOSK_UID" \
    systemctl --user enable chromium-kiosk.service wayvnc.service || \
    log "Note: enable will take effect after first login/reboot"

# Remove old system-level kiosk service if present
if [ -f /etc/systemd/system/kiosk.service ]; then
    log "Removing legacy system kiosk.service..."
    systemctl disable kiosk.service 2>/dev/null || true
    systemctl stop kiosk.service 2>/dev/null || true
    rm -f /etc/systemd/system/kiosk.service
fi

# ── museum-sync service (boot-time content sync) ────────────────────────────
log "Installing museum-sync service..."
cp "$SCRIPT_DIR/museum-sync.service" /etc/systemd/system/museum-sync.service

systemctl daemon-reload
systemctl enable nginx.service museum-sync.service

# ── Cron jobs ─────────────────────────────────────────────────────────────────

log "Setting up cron jobs..."
CRON_TMP=$(mktemp)
crontab -l 2>/dev/null > "$CRON_TMP" || true

add_cron() {
    local ENTRY="$1"
    if ! grep -qF "$ENTRY" "$CRON_TMP"; then
        echo "$ENTRY" >> "$CRON_TMP"
    fi
}

add_cron "* * * * * /usr/local/bin/heartbeat.sh    >> /var/log/heartbeat.log 2>&1"
add_cron "*/5  * * * * /usr/local/bin/sync-content.sh >> /var/log/sync-content.log 2>&1"
add_cron "*/15 * * * * /usr/local/bin/sync-build.sh  >> /var/log/sync-build.log 2>&1"
add_cron "0    2 * * * /usr/local/bin/sync-videos.sh >> /var/log/sync-videos.log 2>&1"
# Nacht-Reboot: Kiosk-Hygiene (Speicher + Chromium frisch, fängt Hänger ab)
add_cron "0    3 * * * /sbin/reboot"

crontab "$CRON_TMP"
rm -f "$CRON_TMP"

# ── Härtung: Watchdog, Logs ins RAM, kein Swap ───────────────────────────────

log "Enabling hardware watchdog..."
# Pi-Hardware-Watchdog: reboots automatically if the system freezes
if ! grep -q "^dtparam=watchdog=on" /boot/firmware/config.txt 2>/dev/null; then
    if [ -f /boot/firmware/config.txt ]; then
        echo "dtparam=watchdog=on" >> /boot/firmware/config.txt
    elif [ -f /boot/config.txt ]; then
        grep -q "^dtparam=watchdog=on" /boot/config.txt || echo "dtparam=watchdog=on" >> /boot/config.txt
    fi
fi
mkdir -p /etc/systemd/system.conf.d
cat > /etc/systemd/system.conf.d/10-museum-watchdog.conf <<'WATCHDOG'
[Manager]
RuntimeWatchdogSec=15
RebootWatchdogSec=120
WATCHDOG

log "Moving journald logs to RAM (SD-Karten-Schonung)..."
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/10-museum-volatile.conf <<'JOURNALD'
[Journal]
Storage=volatile
RuntimeMaxUse=32M
JOURNALD
systemctl restart systemd-journald 2>/dev/null || true

log "Disabling swap (SD-Karten-Schonung)..."
systemctl disable --now dphys-swapfile 2>/dev/null || true

# ── Log rotation ──────────────────────────────────────────────────────────────
log "Configuring log rotation..."
cat > /etc/logrotate.d/museum-kiosk <<'LOGROTATE'
/var/log/heartbeat.log
/var/log/sync-content.log
/var/log/sync-build.log
/var/log/sync-videos.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
LOGROTATE

# ── Initial sync ──────────────────────────────────────────────────────────────

log "Running initial build sync..."
/usr/local/bin/sync-build.sh || error "Initial build sync failed (will retry via cron)"

log "Running initial content sync..."
/usr/local/bin/sync-content.sh || error "Initial content sync failed (will retry via cron)"

log "Running initial video sync..."
/usr/local/bin/sync-videos.sh || error "Initial video sync failed (will retry via cron)"

# ── Start services ────────────────────────────────────────────────────────────

log "Starting system services..."
systemctl start nginx.service
# Chromium starts via labwc autostart after reboot — not started here

# ── Status report ─────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
echo " Museum Kiosk Setup Complete"
echo "══════════════════════════════════════════"
echo " Kiosk ID    : $KIOSK_ID"
echo " Version     : $(cat /etc/museum-kiosk/current-version 2>/dev/null || echo 'unknown')"
echo " nginx       : $(systemctl is-active nginx.service)"
echo " WLAN        : $(nmcli -t -f NAME con show --active 2>/dev/null | head -1 || echo 'nicht verbunden')"
echo " Tailscale   : $(tailscale ip -4 2>/dev/null | head -1 || echo 'nicht verbunden')"
echo " chromium    : (starts via labwc autostart on next reboot)"
echo " RemoteDesk  : wayvnc auf Tailscale-IP:5900 (nach Reboot)"
echo " Videos      : $(ls /var/www/museum/videos/ 2>/dev/null | wc -l) file(s)"
echo " Token       : $(test -f /etc/museum-kiosk/sanity-token && echo 'gesetzt ✓' || echo 'FEHLT – Heartbeat inaktiv ⚠')"
echo "══════════════════════════════════════════"
echo ""
