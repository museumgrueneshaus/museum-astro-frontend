#!/bin/bash
# Sync videos for this kiosk's Ausstellung from Sanity.
#
# Delta-Sync logic:
#   - Sanity CDN filenames include the asset hash (e.g. abc123def-video.mp4)
#     → a replaced video gets a new hash → new filename → downloaded automatically
#   - Files that already exist locally are skipped (no re-download)
#   - Files that are no longer in the Sanity playlist are deleted locally
#   - If Sanity returns an empty list (possible network error), nothing is deleted

set -euo pipefail

KIOSK_CONFIG="/etc/museum-kiosk/kiosk-id.json"
VIDEO_DIR="/var/www/museum/videos"
SANITY_API="https://832k5je1.api.sanity.io/v2024-01-01/data/query/production"
LOG_PREFIX="[sync-videos]"

log()   { echo "$LOG_PREFIX $*"; }
error() { echo "$LOG_PREFIX ERROR: $*" >&2; }

# ── Sanity config check ──────────────────────────────────────────────────────
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

if ! command -v jq &>/dev/null; then
    error "jq is required: apt-get install -y jq"
    exit 1
fi

log "Syncing videos for kiosk: $KIOSK_ID"

# ── Query Sanity ─────────────────────────────────────────────────────────────
GROQ='*[_type=="kioskDevice" && kioskId==$kioskId][0]{
  "videos": ausstellung->videos[]{
    "url": videodatei.asset->url,
    "id":  videodatei.asset->_id
  }
}'

SANITY_URL=$(python3 - <<PYEOF
import urllib.parse, json
query    = '''$GROQ'''
kiosk_id = json.dumps("$KIOSK_ID")
params   = urllib.parse.urlencode({"query": query, "\$kioskId": kiosk_id})
print("$SANITY_API?" + params)
PYEOF
)

RESPONSE=$(curl -sf --max-time 30 "$SANITY_URL") || {
    error "Sanity API not reachable — skipping sync, keeping existing videos."
    exit 0   # don't delete local files on network error
}

VIDEO_URLS=$(echo "$RESPONSE" | jq -r '.result.videos[]?.url // empty' 2>/dev/null || true)

mkdir -p "$VIDEO_DIR"

# ── Guard: empty playlist ────────────────────────────────────────────────────
# If Sanity returns no videos we stop here — could be misconfiguration or a
# transient error. We never delete all local videos based on an empty response.
if [ -z "$VIDEO_URLS" ]; then
    log "No videos returned from Sanity — keeping existing local files."
    exit 0
fi

# ── Build expected filename set ──────────────────────────────────────────────
declare -A EXPECTED   # associative array: filename → 1

while IFS= read -r URL; do
    [ -z "$URL" ] && continue
    # Strip query parameters (?foo=bar) from CDN URL
    FILENAME=$(basename "$URL" | cut -d'?' -f1)
    EXPECTED["$FILENAME"]=1
done <<< "$VIDEO_URLS"

# ── Download missing videos ──────────────────────────────────────────────────
SUCCESS=0
SKIPPED=0
FAILED=0

while IFS= read -r URL; do
    [ -z "$URL" ] && continue

    FILENAME=$(basename "$URL" | cut -d'?' -f1)
    DEST="$VIDEO_DIR/$FILENAME"

    if [ -f "$DEST" ]; then
        log "Already exists, skipping: $FILENAME"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    log "Downloading: $FILENAME"
    if wget -q --timeout=60 --tries=3 -O "$DEST" "$URL"; then
        log "Downloaded: $FILENAME"
        SUCCESS=$((SUCCESS + 1))
    else
        error "Failed to download: $FILENAME"
        rm -f "$DEST"   # remove partial file
        FAILED=$((FAILED + 1))
    fi
done <<< "$VIDEO_URLS"

# ── Delete videos no longer in Sanity playlist ───────────────────────────────
DELETED=0

for LOCAL_FILE in "$VIDEO_DIR"/*; do
    [ -f "$LOCAL_FILE" ] || continue
    LOCAL_NAME=$(basename "$LOCAL_FILE")

    if [ -z "${EXPECTED[$LOCAL_NAME]+x}" ]; then
        log "Removing outdated video: $LOCAL_NAME"
        rm -f "$LOCAL_FILE"
        DELETED=$((DELETED + 1))
    fi
done

# ── Summary ──────────────────────────────────────────────────────────────────
log "Done — Downloaded: $SUCCESS | Skipped: $SKIPPED | Failed: $FAILED | Deleted: $DELETED"

[ "$FAILED" -gt 0 ] && exit 1 || exit 0
