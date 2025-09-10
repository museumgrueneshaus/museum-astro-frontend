# Museum Kiosk - Astro Frontend

## 🚀 Quick Start

### 1. Installation

```bash
npm install
```

### 2. Entwicklung

```bash
npm run dev
# Öffnet auf http://localhost:4321
```

### 3. Build

```bash
npm run build
```

## 📦 Deployment zu Netlify

### Option 1: Via GitHub (Empfohlen)

1. **Repository zu GitHub pushen:**
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/museum-astro-frontend.git
git push -u origin main
```

2. **Netlify mit GitHub verbinden:**
- Gehe zu [app.netlify.com](https://app.netlify.com)
- "Add new site" → "Import an existing project"
- Wähle GitHub
- Wähle dein Repository
- Build settings sind bereits in `netlify.toml` konfiguriert
- Deploy!

### Option 2: Netlify CLI

```bash
# Netlify CLI installieren
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

### Option 3: Drag & Drop

1. Build erstellen: `npm run build`
2. Gehe zu [app.netlify.com/drop](https://app.netlify.com/drop)
3. Ziehe den `dist` Ordner ins Browserfenster
4. Fertig!

## 🔧 Konfiguration

### Sanity Verbindung

Konfiguriere die ID/Dataset per Umgebungsvariablen (bereits in Code verdrahtet):

- In `museum-astro-frontend/.env` oder Netlify Env Vars:
  - `PUBLIC_SANITY_PROJECT_ID`
  - `PUBLIC_SANITY_DATASET`

Fallback (wenn Variablen fehlen): `832k5je1` / `production`.

### Auto-Deploy bei Sanity Publish (Build Hook)

Wenn Inhalte veröffentlicht werden sollen automatisch Builds starten:
1. Netlify Build Hook erstellen (Site Settings → Build & deploy → Build hooks)
2. In Sanity einen Webhook anlegen (manage.sanity.io → API → Webhooks):
   - URL: deine Netlify Build Hook URL (z. B. `https://api.netlify.com/build_hooks/68c029e04a4a99209a1825e8`)
   - Methode: POST, Include payload: aus
   - Trigger: Create, Update, Delete
   - Filter:
     ```groq
     _type in ["exponat","kategorie","kioskConfig","museumInfo"] && !(_id in path("drafts.**"))
     ```

### Kiosk Modi

Das System unterstützt verschiedene Modi:
- **Explorer**: Katalog-Ansicht (Standard)
- **Slideshow**: Automatische Präsentation
- **Scanner**: QR-Code Scanner

Modi werden über Sanity konfiguriert (Kiosk Config).

### MAC-Adresse für Kiosk

Der Kiosk lädt seine Konfiguration basierend auf der MAC-Adresse:

```
https://deine-app.netlify.app?mac=AA:BB:CC:DD:EE:FF
```

## 🎨 Anpassungen

### Farben ändern

In `src/layouts/Layout.astro`:
```css
:root {
  --primary: #667eea;  /* Hauptfarbe */
  --secondary: #764ba2; /* Sekundärfarbe */
}
```

### Logo hinzufügen

1. Logo in `public/` Ordner legen
2. In Sanity unter "Museum Info" hochladen

## 📱 PWA Features

Die App ist als Progressive Web App konfiguriert:
- Offline-Support (Service Worker)
- Installierbar auf Homescreen
- Vollbild-Modus

### Separate Mobile-Seite

Zusätzlich zur Startseite (`/`) gibt es eine mobile-optimierte Seite unter `/mobile/`:
- Fokus auf Explorer + QR-Scanner
- Vereinfachte Navigation mit Bottom-Bar

Aufruf: `https://deine-app.netlify.app/mobile/`

Optional kann per Link/QR-Code direkt auf die Mobile-Seite verwiesen werden.

## 🧭 Seiten & Architektur (aktuell)

- Showcase (Desktop): `/` – minimalistische Startseite mit Vorschau der Modi + Explorer.
- Mobile: `/mobile` – mobil-optimiert, mit Explorer + QR-Scanner (nur hier).
- Modus-Seiten (Desktop):
  - Explorer: `/explorer`
  - Slideshow: `/slideshow`
  - Reader (PDF): `/reader`
- Exponat-Detail: `/exponat/[id]`

### Pro‑Kiosk (Pi) Routen (SSR)

- Übersicht: `/kiosk/[id]` – Vorschau für exakt diese Kiosk‑Konfiguration
- Explorer: `/kiosk/[id]/explorer`
- Slideshow: `/kiosk/[id]/slideshow`
- Reader (PDF): `/kiosk/[id]/reader`

`[id]` kann MAC‑Adresse (z. B. `AA:BB:CC:DD:EE:FF`), der `name` oder die Sanity‑`_id` der `kioskConfig` sein.
Diese dynamischen Routen funktionieren dank SSR (Netlify Adapter) ohne Vorab‑Generierung.

Hinweis: QR‑Scan ist absichtlich nur auf `/mobile` verfügbar (Kamera‑Zugriff auf Desktop ausgeschaltet).

## 🧩 Sanity → Konfigurations‑Mapping (pro Kiosk)

Dokumenttyp: `kioskConfig`

- `modus`: Startmodus (z. B. `explorer`, `slideshow`)
- `konfiguration.explorer_settings`
  - `nur_highlights` (boolean): nur Highlights anzeigen
  - `kategorien` (array ref): Kategorie‑Filter
  - `items_pro_seite` (number): Grid‑Größe pro Seite
- `konfiguration.slideshow_settings`
  - `exponate` (array ref oder ids): explizite Reihenfolge/Inhalte für Slideshow
    - Falls leer: Fallback auf Highlights (`getExponate({ highlight: true })`)
    - Die App dereferenziert Einträge (stellt vollständige Felder inkl. Bild sicher)
- `konfiguration.reader_settings`
  - `pdf_url` (string): PDF‑Quelle für `/reader` und `/kiosk/[id]/reader`
  - URL‑Parameter optional: `?file=URL&page=1&spread=1`
- `design.theme`: `default`, `dark`, `high-contrast`
- `funktionen`
  - `zeige_qr_codes` (Desktop nur Anzeige auf Karten)
  - `zeige_uhr` (Status Uhr oben rechts)

## 📖 Reader (PDF) – Nutzung

- Standard: konfigurieren via `reader_settings.pdf_url` in der `kioskConfig`.
- Alternativ per URL: `/reader?file=/docs/katalog.pdf&page=1&spread=1`
- Spread (Doppelseite) wird ab ~900px Breite aktiv, sofern `spread=1`.
- Vollbild via Button möglich; Seite wechselt mit ←/→.

## 🧪 Design & UX – Leitlinien

- Minimalistisch, ausstellungstauglich: Weißraum, typografische Hierarchie, Underline‑States.
- Touch‑Ziele ≥ 48px, klare Fokusringe, keine Hover‑Abhängigkeit.
- Explorer: 2‑zeilige Titel, 3‑zeilige Kurztexte, kleine Meta (Inv‑Nr, Kategorie) in Small‑Caps.
- Slideshow: wenig Text (Titel, Inv‑Nr), 8–12s Takt, Fade; Pause bei Interaktion.
- QR‑Scan: nur mobil; klarer Permission‑Flow, Fallback‑Hinweise.

## 🏗️ Technik – Architektur & Hosting

- Astro + Netlify Adapter (SSR): dynamische Routen (`/kiosk/[id]`, `/exponat/[id]`) werden zur Laufzeit aufgelöst.
- PWA: App‑Shell wird gecacht (offline.html), Bilder per `stale‑while‑revalidate`, Sanity API network‑first mit Fallback.
- Sanity Client: CDN aktiv, LQIP genutzt; Responsive Images via URL‑Builder.

### Deployment

- Netlify Git‑Deploy: `netlify.toml` vorhanden
- Optional GitHub Actions Workflow: `.github/workflows/netlify-deploy.yml`
  - Secrets benötigt: `NETLIFY_AUTH_TOKEN`, `NETLIFY_SITE_ID`

### Troubleshooting: Änderungen erscheinen nicht

- Service Worker Cache: Der Kiosk ist als PWA konfiguriert. Hard‑Reload (Cmd/Ctrl+Shift+R) oder in einem privaten Fenster öffnen. Alternativ im Browser unter "Application → Service Workers" die Registrierung aufheben und neu laden. Ich habe die SW‑Version auf `v1.1.0` erhöht, so dass neue Deploys zuverlässig übernommen werden.
- Netlify Deploys: Prüfe in Netlify unter "Deploys" die letzte Build‑Zeit und Logs. Ist die Seite mit dem richtigen GitHub‑Repo/Branch verknüpft?
- GitHub Actions: Wenn das Workflow‑Deploy genutzt wird, stelle sicher, dass die Secrets hinterlegt sind und der Workflow auf `main` auslöst.

## 🔌 Beispiele

- Kiosk‑Übersicht: `/kiosk/AA:BB:CC:DD:EE:FF`
- Kiosk‑Explorer: `/kiosk/Filiale‑Sued/explorer`
- Kiosk‑Slideshow (Explizit aus Sanity): `/kiosk/Filiale‑Sued/slideshow`
- Reader mit PDF aus Config: `/kiosk/Filiale‑Sued/reader`
- Mobile Scan: `/mobile`

## 🧰 Sanity – Getting Started

1) Projekt & CORS
- Lege ein Sanity‑Projekt an, notiere `projectId` und `dataset` (z. B. `production`).
- Erlaube die Netlify‑Domain in Sanity CORS (Lesen, kein Token nötig):
  - https://DEINE-SITE.netlify.app
  - http://localhost:4321 (für lokale Entwicklung)

2) Schemas (Minimalumfang)
- `exponat`: Felder wie `titel`, `kurzbeschreibung`, `hauptbild` (image), `bilder[]` (image[]), `inventarnummer`, `kategorie` (ref), `ist_highlight`, `qr_code` (slug/text), `audio`, `video`, `dokumente`.
- `kategorie`: `titel`, `slug`, optional `farbe` (hex), `icon` (text/emoji), `reihenfolge`.
- `kioskConfig`: `name`, `mac_adresse`, `standort`, `modus`, `konfiguration` (object)
  - `explorer_settings`: `nur_highlights` (bool), `kategorien` (ref[]), `items_pro_seite` (number)
  - `slideshow_settings`: `exponate` (ref[] zu `exponat`)
  - `reader_settings`: `pdf_url` (string)
  - `design`: `theme` (string)
  - `funktionen`: `zeige_qr_codes` (bool), `zeige_uhr` (bool)
- `museumInfo`: `name`, `untertitel`, `logo`, `willkommenstext`, `kontakt`, `oeffnungszeiten`, `sprachen`.

3) .env
```
PUBLIC_SANITY_PROJECT_ID=your_project_id
PUBLIC_SANITY_DATASET=production
```

4) Optional: Netlify Build Hook
- Richte einen Build Hook ein und verknüpfe ihn in Sanity Webhooks (Create/Update/Delete für `exponat`, `kategorie`, `kioskConfig`, `museumInfo`).

## 🖥️ Betrieb der Kioske (Empfehlungen)

- Browser Kiosk‑Modus: Autostart im Vollbild, Adressleiste/OS Gesten deaktivieren.
- Energie & Updates: OS‑Updates außerhalb der Öffnungszeiten; Bildschirmdimmung/Schonung.
- Netzwerk: stabile LAN/WLAN; Uhren‑/Zeitserver korrekt; Caching erlaubt.
- Reset bei Inaktivität: Die App besitzt "Return to Start" – nach 5 Minuten ohne Eingabe navigiert sie zurück zur Startseite des jeweiligen Bereichs:
  - Desktop‑Modusseiten (`/explorer`, `/slideshow`, `/reader`) → `/`
  - Pro‑Kiosk Seiten (`/kiosk/[id]/…`) → `/kiosk/[id]`
  - Deaktiviert auf `/mobile` (bewusst) und optional auf der Showcase‑Startseite.
- Fernwartung: Inhalte via Sanity; Code via Git/Netlify; optional Monitoring (Ping/Uptime).


## 🧭 Seitenübersicht (Routen)

- `/` Showcase (Desktop): Vorschau der Modi + Explorer-Start.
- `/mobile` Mobile-Ansicht: Explorer + QR-Scanner, mobil optimiert.
- `/explorer` Explorer-Modus: Filter, Suche, Kachel-Übersicht.
- `/slideshow` Slideshow-Modus: automatische Präsentation.
- QR-Scanner (mobil): in `/mobile` integriert (kein Desktop-Scan).
- `/reader` PDF-Reader: PDF im Kiosk lesen, mit Seiten-/Doppelseiten-Steuerung (`?file=URL`).
- `/exponat/[id]` Detailseite eines Exponats.

### Pro-Kiosk (Pi) Routen

Für jede Kiosk-Config/Mac/Name gibt es dedizierte Seiten:
- `/kiosk/[id]` Übersicht für diese Konfiguration (Preview der Modi)
- `/kiosk/[id]/explorer` Explorer-Ansicht gemäß dieser Konfiguration
- `/kiosk/[id]/slideshow` Slideshow gemäß dieser Konfiguration
- `/kiosk/[id]/reader` PDF-Reader gemäß dieser Konfiguration

Hinweis: `[id]` kann MAC-Adresse, Name oder die Sanity-`_id` der `kioskConfig` sein. Die Seiten lesen `explorer_settings`, `slideshow_settings.exponate` und `reader_settings.pdf_url` direkt aus Sanity.

## 🔐 Umgebungsvariablen

Beispiel (`.env.example` vorhanden):
```env
PUBLIC_SANITY_PROJECT_ID=your_project_id
PUBLIC_SANITY_DATASET=production
```

## 📊 Analytics (Optional)

Für Besucherstatistiken, füge in `src/layouts/Layout.astro` hinzu:

```html
<!-- Plausible Analytics -->
<script defer data-domain="deine-domain.de" src="https://plausible.io/js/script.js"></script>
```

## 🐛 Debugging

### Sanity Verbindung testen

Öffne Browser Console und:
```javascript
// Sollte Daten zurückgeben
fetch('https://832k5je1.api.sanity.io/v1/data/query/production?query=*[_type=="exponat"][0..2]')
  .then(r => r.json())
  .then(console.log)
```

### Cache löschen

```bash
rm -rf .astro dist node_modules/.cache
npm run build
```

## 📝 Checkliste vor Go-Live

- [ ] Sanity CORS konfiguriert für Netlify Domain
- [ ] Alle Bilder optimiert
- [ ] Service Worker aktiviert
- [ ] Touch-Icons erstellt
- [ ] Meta-Tags angepasst
- [ ] 404 Seite erstellt
- [ ] Impressum/Datenschutz verlinkt

## 🆘 Support

- **Astro Docs**: https://docs.astro.build
- **Netlify Docs**: https://docs.netlify.com
- **Sanity Docs**: https://www.sanity.io/docs

## 🚀 Performance

Erwartete Lighthouse Scores:
- Performance: 95-100
- Accessibility: 95-100
- Best Practices: 100
- SEO: 100

Die App ist optimiert für:
- Schnelle Ladezeiten (< 2s)
- Touch-Geräte
- Große Bildschirme (4K)
- Offline-Nutzung
