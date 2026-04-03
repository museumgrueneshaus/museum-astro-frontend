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

# Prompt for kiosk ID
echo ""
echo "Enter the kiosk ID for this device (e.g. RPI_01):"
read -r KIOSK_ID

if [ -z "$KIOSK_ID" ]; then
    die "Kiosk ID cannot be empty."
fi

log "Kiosk ID: $KIOSK_ID"

# ── Packages ─────────────────────────────────────────────────────────────────

log "Installing packages..."
apt-get update -qq
apt-get install -y nginx chromium jq wget rsync unzip curl python3 unclutter labwc

# ── Kiosk identity ────────────────────────────────────────────────────────────

log "Writing kiosk identity..."
mkdir -p /etc/museum-kiosk
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

echo ""
echo "Enter the Sanity write token for this device (from sanity.io/manage → API → Tokens):"
echo "(Leave empty to skip — you can add it later: echo 'sk...' > /etc/museum-kiosk/sanity-token)"
read -r SANITY_TOKEN

if [ -n "$SANITY_TOKEN" ]; then
    echo "$SANITY_TOKEN" > /etc/museum-kiosk/sanity-token
    chmod 600 /etc/museum-kiosk/sanity-token
    log "Sanity token saved."
else
    log "Skipped — heartbeat will not work until token is set."
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

log "Installing chromium user service..."
mkdir -p "$USER_SYSTEMD_DIR"
cp "$SCRIPT_DIR/chromium-kiosk.service" "$USER_SYSTEMD_DIR/chromium-kiosk.service"
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
    systemctl --user enable chromium-kiosk.service || \
    log "Note: enable will take effect after first login/reboot"

# Remove old system-level kiosk service if present
if [ -f /etc/systemd/system/kiosk.service ]; then
    log "Removing legacy system kiosk.service..."
    systemctl disable kiosk.service 2>/dev/null || true
    systemctl stop kiosk.service 2>/dev/null || true
    rm -f /etc/systemd/system/kiosk.service
fi

systemctl daemon-reload
systemctl enable nginx.service

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

crontab "$CRON_TMP"
rm -f "$CRON_TMP"

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
echo " chromium    : (starts via labwc autostart on next reboot)"
echo " Videos      : $(ls /var/www/museum/videos/ 2>/dev/null | wc -l) file(s)"
echo " Token       : $(test -f /etc/museum-kiosk/sanity-token && echo 'gesetzt ✓' || echo 'FEHLT – Heartbeat inaktiv ⚠')"
echo "══════════════════════════════════════════"
echo ""
