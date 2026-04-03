# Museum Kiosk Pi Setup

## Prerequisites

- Raspberry Pi with Raspberry Pi OS (Bullseye or later)
- Internet connection
- SSH access or keyboard/monitor

## Quick Start

```bash
sudo bash setup.sh
```

Follow the prompts. The script installs nginx and Chromium, configures the kiosk service, and does an initial sync of the frontend build and videos.

## What Gets Installed

| Component | Location |
|---|---|
| nginx config | `/etc/nginx/sites-available/museum` |
| Chromium kiosk service | `/etc/systemd/system/kiosk.service` |
| Kiosk identity | `/etc/museum-kiosk/kiosk-id.json` |
| Frontend files | `/var/www/museum/` |
| Video files | `/var/www/museum/videos/` |

## Cron Jobs (added to root crontab)

- Every 15 min: `sync-build.sh` — checks GitHub Releases for a newer frontend build
- Every night at 2am: `sync-videos.sh` — syncs videos from Sanity for this kiosk's Ausstellung

## Manual Operations

```bash
# Force a build update
sudo bash /usr/local/bin/sync-build.sh

# Force a video sync
sudo bash /usr/local/bin/sync-videos.sh

# Check kiosk service status
systemctl status kiosk.service

# Restart Chromium
sudo systemctl restart kiosk.service
```

## Kiosk Identity

Each Pi must have a unique `kioskId` (e.g. `RPI_01`). This is set during `setup.sh` and stored in `/etc/museum-kiosk/kiosk-id.json`. The ID must match a `kioskDevice` document in Sanity.
