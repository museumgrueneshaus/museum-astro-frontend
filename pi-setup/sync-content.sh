#!/bin/bash
# Fetches the complete kiosk configuration from Sanity and saves it locally.
#
# Runs every 5 minutes via cron. The frontend reads /kiosk-content.json
# instead of calling the Sanity API directly → zero Sanity bandwidth at runtime.
#
# If Sanity is unreachable the existing file is kept (offline resilience).

set -euo pipefail

KIOSK_CONFIG="/etc/museum-kiosk/kiosk-id.json"
CONTENT_FILE="/var/www/museum/kiosk-content.json"
CONTENT_TMP="/var/www/museum/kiosk-content.tmp.json"
SANITY_API="https://832k5je1.api.sanity.io/v2024-01-01/data/query/production"
LOG_PREFIX="[sync-content]"

log()   { echo "$LOG_PREFIX $*"; }
error() { echo "$LOG_PREFIX ERROR: $*" >&2; }

# ── Read kiosk ID ────────────────────────────────────────────────────────────
if [ ! -f "$KIOSK_CONFIG" ]; then
    error "Kiosk config not found at $KIOSK_CONFIG — run setup.sh first."
    exit 1
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
  "modus": ausstellung->kioskTemplate.template,
  "idle_timeout": 300000,

  "konfiguration": {
    "video_settings": {
      "playlist": ausstellung->videos[]{
        "typ": "video",
        "video": videodatei{ asset->{ _id, url, mimeType } },
        "titel": videotitel,
        "beschreibung": beschreibung,
        "dauer": dauer,
        "untertitel": untertitel{ asset->{ _id, url } },
        "bild": thumbnail{ asset->{ _id, url } }
      },
      "loop":           ausstellung->kioskTemplate.videoSettings.loop,
      "shuffle":        ausstellung->kioskTemplate.videoSettings.shuffle,
      "zeige_overlay":  ausstellung->kioskTemplate.videoSettings.zeige_overlay,
      "zeige_untertitel": ausstellung->kioskTemplate.videoSettings.zeige_untertitel,
      "uebergang":      ausstellung->kioskTemplate.videoSettings.uebergang,
      "audio": { "lautstaerke": ausstellung->kioskTemplate.videoSettings.lautstaerke }
    }
  },

  "exponate": ausstellung->exponate[]->{
    _id, titel, untertitel, inventarnummer, ist_highlight,
    "hauptbild": hauptbild{ "asset": asset->{ _id, url, "metadata": metadata{ lqip, dimensions } } },
    "kategorie": kategorie->{ _id, titel }
  },
  "kategorien": ausstellung->kategorien[]->{ _id, titel },
  "slideshowSettings": ausstellung->kioskTemplate.slideshowSettings,
  "explorerSettings":  ausstellung->kioskTemplate.explorerSettings,

  "pdf_url": ausstellung->kioskTemplate.readerSettings.pdf_url
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
    error "Sanity returned empty result for kiosk '$KIOSK_ID'"
    exit 0   # keep old file
}

# ── Add timestamp and write atomically ──────────────────────────────────────
echo "$RESULT" | jq --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '. + {lastSync: $ts}' > "$CONTENT_TMP"

mv "$CONTENT_TMP" "$CONTENT_FILE"
chown www-data:www-data "$CONTENT_FILE" 2>/dev/null || true

MODUS=$(echo "$RESULT" | python3 -c "import json,sys; print(json.loads(sys.stdin.read()).get('modus','?'))" 2>/dev/null || echo "?")
log "Done — modus: $MODUS, saved to $CONTENT_FILE"
