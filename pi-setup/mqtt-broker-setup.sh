#!/bin/bash
# Museum Kiosk – MQTT Broker Setup
# Für einen dedizierten Raspberry Pi als zentralen MQTT-Broker.
# Alle Kiosk-Pis und ESP32s verbinden sich zu diesem Pi.
#
# Verwendung: sudo bash mqtt-broker-setup.sh

set -e

LOG_PREFIX="[mqtt-broker]"
log()   { echo "$LOG_PREFIX $*"; }
error() { echo "$LOG_PREFIX ERROR: $*" >&2; }
die()   { error "$*"; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
    die "Bitte als root ausführen: sudo bash mqtt-broker-setup.sh"
fi

echo ""
echo "══════════════════════════════════════════"
echo " Museum Kiosk – MQTT Broker Setup"
echo "══════════════════════════════════════════"
echo ""

# ── Feste IP ──────────────────────────────────────────────────────────────────

echo "Welche feste IP soll dieser Pi im Museumsnetzwerk haben?"
echo "(z.B. 192.168.1.50 — muss mit dem Router/DHCP abgestimmt werden)"
echo "Leer lassen um die aktuelle IP zu behalten:"
read -r STATIC_IP

if [ -n "$STATIC_IP" ]; then
    # Detect primary interface
    IFACE=$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' | head -1)
    GATEWAY=$(ip route | awk '/^default/ {print $3}' | head -1)

    log "Setze feste IP $STATIC_IP auf $IFACE (Gateway: $GATEWAY)..."
    cat >> /etc/dhcpcd.conf <<EOF

# Museum MQTT Broker – feste IP
interface $IFACE
static ip_address=${STATIC_IP}/24
static routers=${GATEWAY}
static domain_name_servers=8.8.8.8 8.8.4.4
EOF
    log "IP-Konfiguration geschrieben. Wirksam nach Neustart."
else
    STATIC_IP=$(hostname -I | awk '{print $1}')
    log "Behalte aktuelle IP: $STATIC_IP"
fi

# ── Pakete ────────────────────────────────────────────────────────────────────

log "Installiere Mosquitto..."
apt-get update -qq
apt-get install -y mosquitto mosquitto-clients

# ── Mosquitto Konfiguration ───────────────────────────────────────────────────

log "Konfiguriere Mosquitto..."

# Disable the default listener in the main config (if present)
if grep -q "^listener" /etc/mosquitto/mosquitto.conf 2>/dev/null; then
    sed -i 's/^listener/#listener/' /etc/mosquitto/mosquitto.conf
fi

cat > /etc/mosquitto/conf.d/museum.conf <<'MQTTCONF'
# Museum Kiosk – Mosquitto Broker Konfiguration
# Geaendert: automatisch durch mqtt-broker-setup.sh

# ── TCP :1883 – für ESP32-Geräte ──────────────────────
listener 1883
allow_anonymous true

# ── WebSocket :9001 – für Kiosk-Browser ───────────────
listener 9001
protocol websockets
allow_anonymous true

# ── Persistenz (retained messages, z.B. LED-Zustände) ─
persistence true
persistence_location /var/lib/mosquitto/

# ── Logging ───────────────────────────────────────────
log_dest syslog
log_type error
log_type warning
log_type notice
MQTTCONF

# ── Service ───────────────────────────────────────────────────────────────────

log "Aktiviere und starte Mosquitto..."
systemctl enable mosquitto.service
systemctl restart mosquitto.service

# ── Verbindungstest ───────────────────────────────────────────────────────────

sleep 1
if mosquitto_pub -h 127.0.0.1 -p 1883 -t "museum/test" -m "setup-ok" 2>/dev/null; then
    log "Verbindungstest erfolgreich ✓"
else
    error "Verbindungstest fehlgeschlagen – bitte Logs prüfen: journalctl -u mosquitto"
fi

# ── Status ────────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════"
echo " MQTT Broker Setup abgeschlossen"
echo "══════════════════════════════════════════"
echo " IP-Adresse  : $STATIC_IP"
echo " TCP (ESP32) : $STATIC_IP:1883"
echo " WebSocket   : ws://$STATIC_IP:9001"
echo " Status      : $(systemctl is-active mosquitto.service)"
echo "══════════════════════════════════════════"
echo ""
echo "Nächste Schritte:"
echo "  1. Kiosk-Pis einrichten und diese IP ($STATIC_IP) angeben"
echo "  2. ESP32 Arduino-Config:"
echo "     const char* mqtt_server = \"$STATIC_IP\";"
echo "     const int   mqtt_port   = 1883;"
echo "  3. Topic-Schema: museum/led/{exponat_id}"
echo ""
