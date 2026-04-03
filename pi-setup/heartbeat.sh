#!/bin/bash
# Sends a heartbeat to Sanity every minute.
# Updates the kioskDevice document: online=true, lastSeen, IP, uptime, chromiumRunning.
#
# Requires:
#   /etc/museum-kiosk/kiosk-id.json   — written by setup.sh
#   /etc/museum-kiosk/sanity-token    — write token from Sanity (one line, no spaces)
#
# Add to cron (done by setup.sh):
#   * * * * * /usr/local/bin/heartbeat.sh >> /var/log/heartbeat.log 2>&1

set -euo pipefail

KIOSK_CONFIG="/etc/museum-kiosk/kiosk-id.json"
TOKEN_FILE="/etc/museum-kiosk/sanity-token"
SANITY_PROJECT="832k5je1"
SANITY_DATASET="production"
SANITY_API="https://${SANITY_PROJECT}.api.sanity.io/v2024-01-01/data/mutate/${SANITY_DATASET}"
LOG_PREFIX="[heartbeat]"

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

# ── Read write token ──────────────────────────────────────────────────────────
if [ ! -f "$TOKEN_FILE" ]; then
    error "Sanity write token not found at $TOKEN_FILE"
    error "Create it: echo 'sk...' > $TOKEN_FILE && chmod 600 $TOKEN_FILE"
    exit 1
fi

TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE")

if [ -z "$TOKEN" ]; then
    error "Token file $TOKEN_FILE is empty"
    exit 1
fi

# ── Collect system info ───────────────────────────────────────────────────────
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Primary non-loopback IP
IP_ADDRESS=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")

# Uptime in seconds
UPTIME_SECONDS=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo 0)

# Is Chromium running? (Python-compatible booleans)
if pgrep -x "chromium-browser" > /dev/null 2>&1 || pgrep -x "chromium" > /dev/null 2>&1; then
    CHROMIUM_RUNNING="True"
else
    CHROMIUM_RUNNING="False"
fi

log "Kiosk: $KIOSK_ID | IP: $IP_ADDRESS | Uptime: ${UPTIME_SECONDS}s | Chromium: $CHROMIUM_RUNNING"

# ── Build Sanity mutation ─────────────────────────────────────────────────────
MUTATION=$(python3 - <<PYEOF
import json

mutation = {
    "mutations": [{
        "patch": {
            "query": "*[_type == 'kioskDevice' && kioskId == \$kioskId][0]",
            "params": {"kioskId": "$KIOSK_ID"},
            "set": {
                "status.online":          True,
                "status.lastSeen":        "$NOW",
                "status.ipAddress":       "$IP_ADDRESS",
                "status.uptimeSeconds":   $UPTIME_SECONDS,
                "status.chromiumRunning": $CHROMIUM_RUNNING
            }
        }
    }]
}
print(json.dumps(mutation))
PYEOF
)

# ── Send to Sanity ────────────────────────────────────────────────────────────
RESPONSE=$(curl -sf \
    --max-time 10 \
    -X POST "$SANITY_API" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$MUTATION") || {
    error "Failed to reach Sanity API — will retry next minute."
    exit 0  # don't fail cron job
}

# Check for Sanity error in response
if echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if not d.get('error') else 1)" 2>/dev/null; then
    log "OK"
else
    error "Sanity returned error: $RESPONSE"
fi
