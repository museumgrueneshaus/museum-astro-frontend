#!/bin/bash
# Downloads the latest frontend build from GitHub Releases and deploys it to nginx.
# Skips the update if the installed version already matches the latest release.

set -e

GITHUB_API="https://api.github.com/repos/museumgrueneshaus/museum-astro-frontend/releases/latest"
DEPLOY_DIR="/var/www/museum"
VERSION_FILE="/etc/museum-kiosk/current-version"
TMP_DIR=$(mktemp -d)
LOG_PREFIX="[sync-build]"

log()  { echo "$LOG_PREFIX $*"; }
error() { echo "$LOG_PREFIX ERROR: $*" >&2; }

cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# Fetch latest release metadata
log "Checking GitHub for latest release..."
HTTP_CODE=$(curl -s -o "$TMP_DIR/release.json" -w "%{http_code}" --max-time 30 "$GITHUB_API") || HTTP_CODE="000"

if [ "$HTTP_CODE" = "000" ]; then
    # Network unreachable
    if [ -f "$VERSION_FILE" ] || [ -f "$DEPLOY_DIR/index.html" ]; then
        log "GitHub not reachable — using existing build ($(cat "$VERSION_FILE" 2>/dev/null || echo 'unknown'))"
        exit 0
    fi
    error "GitHub not reachable and no existing build found"
    exit 1
elif [ "$HTTP_CODE" = "404" ]; then
    # Repo or releases not found yet
    log "No GitHub releases found yet — skipping build sync"
    exit 0
elif [ "$HTTP_CODE" != "200" ]; then
    log "GitHub API returned HTTP $HTTP_CODE — skipping build sync"
    exit 0
fi

RELEASE_JSON=$(cat "$TMP_DIR/release.json")

LATEST_TAG=$(echo "$RELEASE_JSON" | jq -r '.tag_name')
ASSET_URL=$(echo "$RELEASE_JSON" | jq -r '.assets[] | select(.name | endswith(".zip")) | .browser_download_url' | head -1)

if [ -z "$LATEST_TAG" ] || [ "$LATEST_TAG" = "null" ]; then
    error "Could not determine latest release tag"
    exit 1
fi

if [ -z "$ASSET_URL" ] || [ "$ASSET_URL" = "null" ]; then
    error "No .zip asset found in release $LATEST_TAG"
    exit 1
fi

# Compare with installed version
CURRENT_VERSION=""
if [ -f "$VERSION_FILE" ]; then
    CURRENT_VERSION=$(cat "$VERSION_FILE")
fi

if [ "$CURRENT_VERSION" = "$LATEST_TAG" ]; then
    log "Already on latest version: $LATEST_TAG. Nothing to do."
    exit 0
fi

log "New version available: $LATEST_TAG (current: ${CURRENT_VERSION:-none})"

# Download the release zip
ZIP_PATH="$TMP_DIR/build.zip"
log "Downloading build artifact..."
wget -q --timeout=120 --tries=3 -O "$ZIP_PATH" "$ASSET_URL" || {
    error "Failed to download build artifact from $ASSET_URL"
    exit 1
}

# Deploy: extract into a staging directory, then swap
STAGE_DIR="$TMP_DIR/stage"
mkdir -p "$STAGE_DIR"
unzip -q "$ZIP_PATH" -d "$STAGE_DIR" || {
    error "Failed to extract build zip"
    exit 1
}

# Preserve the videos directory across deployments
mkdir -p "$DEPLOY_DIR/videos"

log "Deploying to $DEPLOY_DIR..."
# Copy everything except the videos directory
rsync -a --delete --exclude='/videos/' "$STAGE_DIR/" "$DEPLOY_DIR/" || {
    error "rsync deploy failed"
    exit 1
}

# Record the new version
echo "$LATEST_TAG" > "$VERSION_FILE"
log "Deployed version: $LATEST_TAG"

# Restart Chromium so it picks up the new build (user service under museumgh)
KIOSK_USER="museumgh"
KIOSK_UID=$(id -u "$KIOSK_USER" 2>/dev/null || echo "1000")
if XDG_RUNTIME_DIR="/run/user/$KIOSK_UID" sudo -u "$KIOSK_USER" systemctl --user is-active --quiet chromium-kiosk.service 2>/dev/null; then
    log "Restarting chromium-kiosk service..."
    XDG_RUNTIME_DIR="/run/user/$KIOSK_UID" sudo -u "$KIOSK_USER" systemctl --user restart chromium-kiosk.service
fi

log "Update complete."
