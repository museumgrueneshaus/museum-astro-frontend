# Museum Kiosk Pi Setup

## Übersicht

Einziges Setup-System für alle Raspberry Pi Kiosk-Geräte im Museum Grünes Haus.

**Zwei Wege zum Setup:**

1. **Setup-Tool (empfohlen):** Doppelklick auf `🚀 Pi Setup starten.command` im `raspberry-pi/` Ordner — startet ein TUI das den Pi per SSH einrichtet.
2. **Manuell:** `sudo bash setup.sh` direkt auf dem Pi.

## Prerequisites

- Raspberry Pi mit Raspberry Pi OS Bookworm (oder Bullseye)
- Internetverbindung (WLAN oder Ethernet)
- SSH-Zugang oder Tastatur/Monitor

## Was wird installiert

| Komponente | Ort |
|---|---|
| nginx Config | `/etc/nginx/sites-available/museum` |
| Chromium Kiosk (User-Service) | `~/.config/systemd/user/chromium-kiosk.service` |
| labwc Autostart | `~/.config/labwc/autostart` |
| Kiosk-Identität | `/etc/museum-kiosk/kiosk-id.json` |
| Sanity Token | `/etc/museum-kiosk/sanity-token` |
| Frontend-Dateien | `/var/www/museum/` |
| Videos | `/var/www/museum/videos/` |
| Cached Content | `/var/www/museum/kiosk-content.json` |

## Sync-Skripte & Cron

| Intervall | Skript | Funktion |
|---|---|---|
| Jede Minute | `heartbeat.sh` | Sendet Status an Sanity |
| Alle 5 Min | `sync-content.sh` | Holt Kiosk-Konfiguration + WLAN-Netze von Sanity |
| Alle 15 Min | `sync-build.sh` | Prüft GitHub Releases auf neues Frontend-Build |
| Täglich 2 Uhr | `sync-videos.sh` | Synchronisiert Videos von Sanity |

## WLAN-Management

- **Bootstrap:** `setup.sh` fragt beim ersten Mal nach WLAN-Zugangsdaten.
- **Laufend:** `sync-content.sh` synchronisiert WLAN-Netze aus Sanity (`kioskDevice → wlanNetworks`).
- WLAN-Netze können zentral im Sanity Studio verwaltet werden.

## Manuelle Operationen

```bash
# Content-Sync erzwingen
sudo /usr/local/bin/sync-content.sh

# Build-Update erzwingen
sudo /usr/local/bin/sync-build.sh

# Video-Sync erzwingen
sudo /usr/local/bin/sync-videos.sh

# Chromium-Status prüfen (User-Service)
systemctl --user status chromium-kiosk.service

# Chromium neustarten
systemctl --user restart chromium-kiosk.service
```

## Kiosk-Identität

Jeder Pi hat eine eindeutige `kioskId` (z.B. `RPI_01`), gespeichert in `/etc/museum-kiosk/kiosk-id.json`. Die ID muss einem `kioskDevice`-Dokument in Sanity entsprechen.

## Dateien in diesem Ordner

| Datei | Zweck |
|---|---|
| `setup.sh` | Haupt-Setup-Skript (manuell auf dem Pi) |
| `sync-build.sh` | Frontend-Build von GitHub Releases holen |
| `sync-content.sh` | Kiosk-Config + Signage + WLAN von Sanity |
| `sync-videos.sh` | Videos von Sanity herunterladen |
| `heartbeat.sh` | Status-Heartbeat an Sanity senden |
| `nginx.conf` | nginx-Konfiguration für den Kiosk |
| `chromium-kiosk.service` | systemd User-Service für Chromium |
| `labwc-autostart` | labwc Wayland Compositor Autostart |
| `museum-sync.service` | systemd Service für initialen Sync beim Boot |
| `mqtt-broker-setup.sh` | Setup für einen dedizierten MQTT-Broker-Pi |
