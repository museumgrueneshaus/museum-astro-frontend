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
