#!/bin/bash
# Fetches the complete kiosk configuration from Sanity and saves it locally.
#
# Runs every 5 minutes via cron. The frontend reads /kiosk-content.json
# instead of calling the Sanity API directly → zero Sanity bandwidth at runtime.
#
# If Sanity is unreachable the existing file is kept (offline resilience).

set -euo pipefail

KIOSK_CONFIG="/etc/museum-kiosk/kiosk-id.json"
TOKEN_FILE="/etc/museum-kiosk/sanity-token"
CONTENT_FILE="/var/www/museum/kiosk-content.json"
CONTENT_TMP="/var/www/museum/kiosk-content.tmp.json"
SANITY_API="https://832k5je1.api.sanity.io/v2024-01-01/data/query/production"
SANITY_MUTATE="https://832k5je1.api.sanity.io/v2024-01-01/data/mutate/production"
LOG_PREFIX="[sync-content]"

log()   { echo "$LOG_PREFIX $*"; }
error() { echo "$LOG_PREFIX ERROR: $*" >&2; }

# ── Self-Heal: unvollständig provisionierte Pis reparieren (idempotent) ─────
# rpi020 wurde ohne raspberry-Admin-User und ohne Cron aufgesetzt — Gerät war
# remote unerreichbar und hat sich nie aktualisiert. Läuft als root, no-op
# auf korrekt aufgesetzten Pis.
if [ "$(id -u)" = "0" ]; then
    # Admin-User für Tailscale-SSH (ACL erlaubt nur "raspberry")
    if ! id raspberry >/dev/null 2>&1; then
        useradd -m -s /bin/bash raspberry
        echo 'raspberry ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/010-raspberry
        chmod 440 /etc/sudoers.d/010-raspberry
        log "Self-Heal: Admin-User raspberry angelegt"
    fi
    # Cron-Jobs (nur wenn weder root-crontab noch cron.d sie kennt)
    if ! crontab -l 2>/dev/null | grep -q sync-content && [ ! -f /etc/cron.d/museum-kiosk ]; then
        cat > /etc/cron.d/museum-kiosk <<'CRON'
* * * * *    root /usr/local/bin/heartbeat.sh    >> /var/log/heartbeat.log 2>&1
*/5 * * * *  root /usr/local/bin/sync-content.sh >> /var/log/sync-content.log 2>&1
*/15 * * * * root /usr/local/bin/sync-build.sh   >> /var/log/sync-build.log 2>&1
0 2 * * *    root /usr/local/bin/sync-videos.sh  >> /var/log/sync-videos.log 2>&1
0 3 * * *    root /sbin/reboot
CRON
        chmod 644 /etc/cron.d/museum-kiosk
        log "Self-Heal: Cron-Jobs installiert (/etc/cron.d/museum-kiosk)"
    fi

    # Drucker (Kyocera "Kassa", IPP driverless) auf JEDEM Pi sicherstellen —
    # so kann das Malspiel nach einem Inhaltstausch auf jedem Gerät drucken.
    # Idempotent: nur wenn CUPS da ist und der Drucker noch fehlt.
    if command -v lpadmin >/dev/null 2>&1 && ! lpstat -p Kassa >/dev/null 2>&1; then
        if lpadmin -p Kassa -E -v ipp://192.168.2.200/ipp/print -m everywhere 2>/dev/null; then
            lpadmin -d Kassa 2>/dev/null || true        # als Standarddrucker setzen
            cupsenable Kassa 2>/dev/null || true
            cupsaccept Kassa 2>/dev/null || true
            log "Self-Heal: Drucker 'Kassa' (Kyocera 192.168.2.200) eingerichtet"
        else
            log "Self-Heal: Drucker 192.168.2.200 nicht erreichbar — Versuch beim nächsten Sync"
        fi
    fi
fi

# ── Read kiosk ID (or derive it from the hardware serial — golden image) ────
if [ ! -f "$KIOSK_CONFIG" ]; then
    SERIAL=$(awk '/^Serial/ {print $3}' /proc/cpuinfo 2>/dev/null || true)
    if [ -n "$SERIAL" ]; then
        SHORT=$(echo "${SERIAL: -4}" | tr '[:lower:]' '[:upper:]')
        mkdir -p "$(dirname "$KIOSK_CONFIG")"
        printf '{"kioskId": "PI-%s"}\n' "$SHORT" > "$KIOSK_CONFIG"
        log "No kiosk config — derived ID from hardware serial: PI-$SHORT"
    else
        error "Kiosk config not found at $KIOSK_CONFIG and no hardware serial available."
        exit 1
    fi
fi

KIOSK_ID=$(python3 -c "
import json, sys
cfg = json.load(open('$KIOSK_CONFIG'))
print(cfg.get('kioskId', ''))
" 2>/dev/null)

if [ -z "$KIOSK_ID" ]; then
    error "Could not read kioskId from $KIOSK_CONFIG"
    exit 1
fi

log "Fetching content for kiosk: $KIOSK_ID"

# ── GROQ: fetch everything in one request ───────────────────────────────────
# Covers all kiosk modes: video, slideshow, explorer, reader
GROQ='*[_type=="kioskDevice" && kioskId==$kioskId][0]{
  _id,
  "kioskId": kioskId,
  "location": location,
  "befehl": befehl,
  "modus": select(
    modus == "malspiel" => "malspiel",
    modus == "signage"  => "signage",
    modus == "website"  => "website",
    ausstellung->kioskTemplate.template
  ),
  "malspiel_id": select(
    modus == "malspiel" => malspiel._ref,
    ausstellung->kioskTemplate.malspielSettings.malspiel._ref
  ),
  "idle_timeout": 300000,

  "konfiguration": {
    "video_settings": {
      "playlist": ausstellung->videos[]{
        "typ": "video",
        "video": videodatei{ asset->{ _id, url, mimeType } },
        "titel": videotitel,
        "beschreibung": beschreibung,
        "dauer": dauer,
        "bild": thumbnail{ asset->{ _id, url } }
      },
      "loop":           ausstellung->kioskTemplate.videoSettings.loop,
      "shuffle":        ausstellung->kioskTemplate.videoSettings.shuffle,
      "zeige_overlay":  ausstellung->kioskTemplate.videoSettings.zeige_overlay,
      "uebergang":      ausstellung->kioskTemplate.videoSettings.uebergang,
      "audio": { "lautstaerke": ausstellung->kioskTemplate.videoSettings.lautstaerke }
    }
  },

  "exponate": coalesce(
    ausstellung->exponate[]->{
      _id, titel, untertitel, inventarnummer, ist_highlight,
      "hauptbild": hauptbild{ "asset": asset->{ _id, url, "metadata": metadata{ lqip, dimensions } } },
      "kategorie": kategorie->{ _id, titel }
    },
    ausstellung->galerie[]{
      "_id": _key,
      "titel": alt,
      "hauptbild": { "asset": asset->{ _id, url, "metadata": metadata{ lqip, dimensions } } }
    }
  ),
  "kategorien": ausstellung->kategorien[]->{ _id, titel },

  "slides": select(
    ausstellung->kioskTemplate.slideshowSettings.bildquelle == "galerie" => ausstellung->galerie[]{
      "_id": _key,
      "titel": coalesce(caption, alt),
      "hauptbild": { "asset": asset->{ _id, url, "metadata": metadata{ lqip, dimensions } } }
    },
    ausstellung->kioskTemplate.slideshowSettings.bildquelle == "exponate" => ausstellung->exponate[]->{
      _id, titel, untertitel, inventarnummer,
      "hauptbild": hauptbild{ "asset": asset->{ _id, url, "metadata": metadata{ lqip, dimensions } } }
    },
    coalesce(
      ausstellung->exponate[]->{
        _id, titel, untertitel, inventarnummer,
        "hauptbild": hauptbild{ "asset": asset->{ _id, url, "metadata": metadata{ lqip, dimensions } } }
      },
      ausstellung->galerie[]{
        "_id": _key,
        "titel": coalesce(caption, alt),
        "hauptbild": { "asset": asset->{ _id, url, "metadata": metadata{ lqip, dimensions } } }
      }
    )
  ),
  "slideshowSettings": ausstellung->kioskTemplate.slideshowSettings,
  "explorerSettings":  ausstellung->kioskTemplate.explorerSettings,

  "pdf_url":     ausstellung->kioskTemplate.readerSettings.pdf_url,
  "website_url": coalesce(websiteUrl, ausstellung->kioskTemplate.websiteSettings.url)
}'

SANITY_URL=$(python3 - <<PYEOF
import urllib.parse, json
query    = '''$GROQ'''
kiosk_id = json.dumps("$KIOSK_ID")
params   = urllib.parse.urlencode({"query": query, "\$kioskId": kiosk_id})
print("$SANITY_API?" + params)
PYEOF
)

# ── Fetch ────────────────────────────────────────────────────────────────────
RESPONSE=$(curl -sf --max-time 15 "$SANITY_URL") || {
    error "Sanity API not reachable — keeping existing content file."
    exit 0   # keep old file, don't fail
}

RESULT=$(echo "$RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
result = data.get('result')
if result is None:
    sys.exit(1)
print(json.dumps(result))
" 2>/dev/null) || {
    # ── Self-registration: no kioskDevice for this ID → create it in Sanity ──
    log "No kioskDevice found for '$KIOSK_ID' — registering device..."
    if [ -f "$TOKEN_FILE" ]; then
        TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE")
        DOC_ID="kioskDevice-$(echo -n "$KIOSK_ID" | tr -c 'A-Za-z0-9_-' '-')"
        REG_MUTATION=$(python3 - <<PYEOF
import json
doc = {
    "_id": "$DOC_ID",
    "_type": "kioskDevice",
    "kioskId": "$KIOSK_ID",
    "hostname": "$(hostname)",
    "neu": True,
    "notes": "Automatisch registriert am $(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
print(json.dumps({"mutations": [{"createIfNotExists": doc}]}))
PYEOF
)
        curl -sf --max-time 15 -X POST "$SANITY_MUTATE" \
            -H "Authorization: Bearer $TOKEN" \
            -H "Content-Type: application/json" \
            -d "$REG_MUTATION" > /dev/null \
            && log "Registered — assign content in Sanity Studio (🆕 $KIOSK_ID)." \
            || error "Device registration failed."
    else
        error "No write token at $TOKEN_FILE — cannot self-register."
    fi
    exit 0   # keep old file; content arrives once the device is assigned
}

# ── Modus vor dem Überschreiben merken (für Chromium-Neustart-Erkennung) ─────
OLD_MODUS=$(python3 -c "import json;print(json.load(open('$CONTENT_FILE')).get('modus') or '')" 2>/dev/null || echo "")

# ── Add timestamp and write atomically ──────────────────────────────────────
echo "$RESULT" | jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '. + {lastSync: $ts}' > "$CONTENT_TMP" || {
    error "jq failed — keeping existing content"
    exit 0
}

mv "$CONTENT_TMP" "$CONTENT_FILE"
chown www-data:www-data "$CONTENT_FILE" 2>/dev/null || true

# ── Chromium bei Modus-Wechsel neu starten ──────────────────────────────────
# Nötig beim Inhaltstausch (z.B. Slideshow ⇄ Malspiel): Chromium lädt dann die
# richtige Seite UND liest die CUPS-Druckerliste neu (sonst druckt das Malspiel
# auf einem frisch zugewiesenen Gerät nicht — war die Ursache bei PI-C3B6).
NEW_MODUS=$(echo "$RESULT" | python3 -c "import json,sys;print(json.loads(sys.stdin.read()).get('modus') or '')" 2>/dev/null || echo "")
if [ -n "$NEW_MODUS" ] && [ -n "$OLD_MODUS" ] && [ "$OLD_MODUS" != "$NEW_MODUS" ]; then
    log "Modus-Wechsel: '$OLD_MODUS' → '$NEW_MODUS' — starte Chromium sauber neu"
    KIOSK_USER="museumgh"
    KIOSK_UID=$(id -u "$KIOSK_USER" 2>/dev/null || echo "1000")
    # Sauberer Neustart: ein simples `systemctl restart` ließ einen verwaisten
    # Chromium-Prozess zurück, der die Profilsperre (SingletonLock) hielt → jeder
    # Neustart scheiterte → Absturzschleife. Daher hart beenden + Lock entfernen.
    XDG_RUNTIME_DIR="/run/user/$KIOSK_UID" sudo -u "$KIOSK_USER" \
        systemctl --user stop chromium-kiosk.service 2>/dev/null || true
    pkill -9 -u "$KIOSK_USER" chromium 2>/dev/null || true
    sleep 2
    sudo -u "$KIOSK_USER" rm -f "/home/$KIOSK_USER/.config/chromium/Singleton"* 2>/dev/null || true
    XDG_RUNTIME_DIR="/run/user/$KIOSK_UID" sudo -u "$KIOSK_USER" \
        systemctl --user start chromium-kiosk.service 2>/dev/null || true
fi

# ── Tailscale-Name aus Sanity ableiten (kioskId + location) ─────────────────
# Selbstpflegend: location in Sanity ändern → Tailscale-Name folgt beim Sync.
# Schema: pi-<serial>-<location>, z.B. "pi-00f0-raum-12-fensterseitig".
if command -v tailscale >/dev/null 2>&1; then
    LOCATION=$(echo "$RESULT" | python3 -c "import json,sys;print(json.loads(sys.stdin.read()).get('location') or '')" 2>/dev/null || echo "")
    TS_NAME=$(KID="$KIOSK_ID" LOC="$LOCATION" python3 - <<'PYEOF'
import os, re
def slug(s): return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', s.lower())).strip('-')
parts = [slug(os.environ.get('KID', ''))]
loc = os.environ.get('LOC', '').strip()
if loc: parts.append(slug(loc))
print('-'.join(p for p in parts if p)[:63])
PYEOF
)
    TS_STAMP="/etc/museum-kiosk/ts-hostname"
    if [ -n "$TS_NAME" ] && [ "$TS_NAME" != "$(cat "$TS_STAMP" 2>/dev/null)" ]; then
        if tailscale set --hostname="$TS_NAME" 2>/dev/null; then
            echo "$TS_NAME" > "$TS_STAMP"
            log "Tailscale-Name aus Sanity gesetzt: $TS_NAME"
        fi
    fi
fi

# ── Remote command from Sanity (befehl field) ───────────────────────────────
BEFEHL=$(echo "$RESULT" | python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('befehl') or '')" 2>/dev/null || echo "")
if [ -n "$BEFEHL" ] && [ -f "$TOKEN_FILE" ]; then
    TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE")
    RESET_MUTATION=$(python3 - <<PYEOF
import json
print(json.dumps({"mutations": [{"patch": {
    "query": "*[_type == 'kioskDevice' && kioskId == \$kioskId && !(_id in path('drafts.**'))]",
    "params": {"kioskId": "$KIOSK_ID"},
    "unset": ["befehl"]
}}]}))
PYEOF
)
    # Reset the field FIRST — otherwise a reboot command would loop forever
    if curl -sf --max-time 15 -X POST "$SANITY_MUTATE" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$RESET_MUTATION" > /dev/null; then

        KIOSK_USER="museumgh"
        KIOSK_UID=$(id -u "$KIOSK_USER" 2>/dev/null || echo "1000")
        case "$BEFEHL" in
            neustarten)
                log "Befehl: Neustart in 5 Sekunden..."
                (sleep 5 && /sbin/reboot) &
                ;;
            chromium-neustarten)
                log "Befehl: Chromium-Neustart..."
                XDG_RUNTIME_DIR="/run/user/$KIOSK_UID" sudo -u "$KIOSK_USER" \
                    systemctl --user restart chromium-kiosk.service || true
                ;;
            update-erzwingen)
                log "Befehl: Software-Update erzwingen..."
                rm -f /etc/museum-kiosk/current-version
                /usr/local/bin/sync-build.sh || true
                ;;
            *)
                error "Unbekannter Befehl: $BEFEHL"
                ;;
        esac
    else
        error "Befehl-Reset fehlgeschlagen — Befehl '$BEFEHL' wird NICHT ausgeführt (Schleifengefahr)."
    fi
fi

# ── Update nginx website-proxy if URL changed ────────────────────────────────
WEBSITE_URL=$(echo "$RESULT" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
print(data.get('website_url') or '')
" 2>/dev/null || echo "")

PROXY_CONF="/etc/museum-kiosk/website-proxy.conf"
SUBFILTER_CONF="/etc/museum-kiosk/website-subfilter.conf"
if [ -n "$WEBSITE_URL" ]; then
    # Extract just the domain for sub_filter (strip trailing slash and path)
    WEBSITE_DOMAIN=$(python3 -c "
from urllib.parse import urlparse
u = urlparse('$WEBSITE_URL')
print(u.scheme + '://' + u.netloc)
" 2>/dev/null || echo "$WEBSITE_URL")

    NEW_CONF="proxy_pass ${WEBSITE_URL}/;"
    NEW_SF="sub_filter '${WEBSITE_DOMAIN}' '/website-proxy';"

    OLD_CONF=$(cat "$PROXY_CONF" 2>/dev/null || echo "")
    if [ "$NEW_CONF" != "$OLD_CONF" ]; then
        echo "$NEW_CONF" > "$PROXY_CONF"
        echo "$NEW_SF"  > "$SUBFILTER_CONF"
        nginx -t -q 2>/dev/null && systemctl reload nginx.service && \
            log "nginx website-proxy aktualisiert: $WEBSITE_URL" || \
            log "nginx reload fehlgeschlagen — Konfiguration prüfen"
    fi
fi

MODUS=$(echo "$RESULT" | python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('modus','?'))" 2>/dev/null || echo "?")
log "Done — modus: $MODUS, saved to $CONTENT_FILE"

# WLAN wird NICHT mehr aus Sanity gesynct (Passwörter wären öffentlich lesbar).
# Fixe Netze: /etc/museum-kiosk/wlans.conf (Golden Image / scp) → setup.sh.

# ── Signage: fetch and cache museum-wide data if this is a signage kiosk ────
if [ "$MODUS" = "signage" ]; then
    log "Signage modus — fetching museum-wide data..."
    SIGNAGE_FILE="/var/www/museum/signage-content.json"
    SIGNAGE_TMP="/var/www/museum/signage-content.tmp.json"

    SIGNAGE_GROQ='{
      "museumInfo": *[_type=="museumInfo"][0]{ name, untertitel, oeffnungszeiten_text, logo },
      "signage": *[_type=="signageKonfiguration"][0]{
        "sonderausstellung": {
          "titel": sonderausstellung.titel,
          "zeitraum_text": sonderausstellung.zeitraum_text,
          "titelbild": sonderausstellung.titelbild{ asset->{ _id, url } }
        },
        "veranstaltungen": veranstaltungen[]{ titel, datum, typ },
        "weitere_ausstellungen": weitere_ausstellungen[]{ titel, zeitraum_text, "titelbild": titelbild{ asset->{ _id, url } } },
        "wechsel_aktiv": wechsel_aktiv,
        "wechsel_intervall": wechsel_intervall
      }
    }'

    SIGNAGE_URL=$(python3 - <<PYEOF
import urllib.parse
query = '''$SIGNAGE_GROQ'''
params = urllib.parse.urlencode({"query": query})
print("$SANITY_API?" + params)
PYEOF
)

    SIGNAGE_RESPONSE=$(curl -sf --max-time 15 "$SIGNAGE_URL") || {
        log "Sanity not reachable for signage data — keeping existing file."
        exit 0
    }

    echo "$SIGNAGE_RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
result = data.get('result')
if result is None:
    sys.exit(1)
print(json.dumps(result))
" 2>/dev/null | jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '. + {lastSync: $ts}' > "$SIGNAGE_TMP" && \
        mv "$SIGNAGE_TMP" "$SIGNAGE_FILE" && \
        chown www-data:www-data "$SIGNAGE_FILE" 2>/dev/null || true && \
        log "Signage content saved to $SIGNAGE_FILE"
fi
