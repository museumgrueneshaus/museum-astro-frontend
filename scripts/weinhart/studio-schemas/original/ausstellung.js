// schemas/ausstellung.js
export default {
  name: 'ausstellung',
  title: 'Ausstellung',
  type: 'document',

  // ── Tabs ──────────────────────────────────────────────────────────────────
  groups: [
    { name: 'inhalt',     title: 'Inhalt',                default: true },
    { name: 'medien',     title: 'Medien & Videos' },
    { name: 'kiosk',      title: 'Kiosk-Darstellung' },
    { name: 'exponate',   title: 'Exponate & Kategorien' },
    { name: 'verwaltung', title: 'Verwaltung' },
  ],

  fields: [

    // ── TAB: INHALT ────────────────────────────────────────────────────────
    {
      name: 'titel',
      title: 'Titel der Ausstellung',
      type: 'string',
      group: 'inhalt',
      validation: Rule => Rule.required().max(200).error('Bitte einen Titel eingeben (max. 200 Zeichen).'),
      description: 'Offizieller Name der Ausstellung – erscheint auf allen Kiosk-Bildschirmen'
    },
    {
      name: 'untertitel',
      title: 'Untertitel',
      type: 'string',
      group: 'inhalt',
      description: 'Optionaler Zusatz zum Titel, z.B. ein Zeitraum oder thematischer Schwerpunkt'
    },
    {
      name: 'slug',
      title: 'URL-Adresse (Slug)',
      type: 'slug',
      group: 'inhalt',
      options: {
        source: 'titel',
        maxLength: 96
      },
      validation: Rule => Rule.required().error('Bitte einen URL-Slug generieren (Schaltfläche "Generieren" klicken).'),
      description: 'Wird automatisch aus dem Titel erzeugt. Klicken Sie auf "Generieren".'
    },
    {
      name: 'kurzbeschreibung',
      title: 'Kurzbeschreibung',
      type: 'text',
      rows: 3,
      group: 'inhalt',
      validation: Rule => Rule.required().max(500).error('Kurzbeschreibung ist erforderlich (max. 500 Zeichen).'),
      description: 'Kurzer Einleitungstext für Besucher. Erscheint auf der Übersichtsseite. Max. 500 Zeichen, keine Fachbegriffe.'
    },
    {
      name: 'beschreibung',
      title: 'Ausführliche Beschreibung',
      type: 'array',
      group: 'inhalt',
      of: [
        {
          type: 'block',
          styles: [
            {title: 'Normal', value: 'normal'},
            {title: 'H2', value: 'h2'},
            {title: 'H3', value: 'h3'},
            {title: 'Zitat', value: 'blockquote'}
          ],
          marks: {
            decorators: [
              {title: 'Fett', value: 'strong'},
              {title: 'Kursiv', value: 'em'},
              {title: 'Unterstrichen', value: 'underline'}
            ],
            annotations: [
              {
                title: 'Link',
                name: 'link',
                type: 'object',
                fields: [
                  {
                    title: 'URL',
                    name: 'href',
                    type: 'url'
                  }
                ]
              }
            ]
          }
        },
        {
          type: 'image',
          options: {
            hotspot: true
          }
        }
      ],
      description: 'Vollständiger Beschreibungstext mit Formatierungen, Zwischentiteln und eingebetteten Bildern'
    },
    {
      name: 'titelbild',
      title: 'Titelbild',
      type: 'image',
      group: 'inhalt',
      description: 'Hauptbild der Ausstellung. Bei Video-Kiosks wird automatisch das erste Video-Vorschaubild verwendet, wenn kein Titelbild gesetzt ist.',
      options: {
        hotspot: true,
        metadata: ['blurhash', 'lqip', 'palette']
      },
      fields: [
        {
          name: 'alt',
          type: 'string',
          title: 'Alternativtext',
          description: 'Kurze Bildbeschreibung für Barrierefreiheit (wird von Screenreadern vorgelesen)'
        },
        {
          name: 'bildnachweis',
          type: 'string',
          title: 'Bildnachweis',
          description: 'Urheberrechtshinweis, z.B. "© Stadtarchiv Reutte" oder "Foto: Max Mustermann"'
        }
      ]
    },

    // ── TAB: MEDIEN ────────────────────────────────────────────────────────
    {
      name: 'galerie',
      title: 'Bildergalerie',
      type: 'array',
      group: 'medien',
      of: [{
        type: 'image',
        options: {
          hotspot: true,
          metadata: ['blurhash', 'lqip']
        },
        fields: [
          {
            name: 'alt',
            type: 'string',
            title: 'Alternativtext',
            description: 'Kurze Bildbeschreibung für Barrierefreiheit'
          },
          {
            name: 'caption',
            type: 'string',
            title: 'Bildunterschrift',
            description: 'Wird unter dem Bild angezeigt'
          }
        ]
      }],
      description: 'Zusätzliche Bilder zur Ausstellung. Werden in der Galerie-Ansicht und auf der Website angezeigt — und in der Kiosk-Slideshow, wenn dort „Bildergalerie" als Bildquelle gewählt ist.'
    },
    {
      name: 'videos',
      title: 'Videos',
      type: 'array',
      group: 'medien',
      of: [{
        type: 'object',
        fields: [
          {
            name: 'videodatei',
            title: 'Videodatei',
            type: 'file',
            options: {
              accept: 'video/*'
            },
            description: 'Unterstützte Formate: MP4, MOV, AVI'
          },
          {
            name: 'videotitel',
            type: 'string',
            title: 'Videotitel',
            description: 'Wird im Overlay und in der Videoliste angezeigt'
          },
          {
            name: 'beschreibung',
            type: 'text',
            title: 'Beschreibung',
            rows: 2,
            description: 'Kurzer Inhaltstext zum Video (optional)'
          },
          {
            name: 'dauer',
            type: 'string',
            title: 'Laufzeit',
            description: 'z.B. 5:30 – dient nur als Anzeigeinformation'
          },
          {
            name: 'thumbnail',
            type: 'image',
            title: 'Video-Vorschaubild',
            description: 'Wird als Standbild angezeigt bevor das Video startet'
          },
        ],
        preview: {
          select: {
            title: 'videotitel',
            subtitle: 'dauer',
            media: 'thumbnail'
          },
          prepare({title, subtitle, media}) {
            return {
              title: title || '(Kein Titel)',
              subtitle: subtitle ? `Laufzeit: ${subtitle}` : 'Laufzeit nicht angegeben',
              media
            }
          }
        }
      }],
      description: 'Videos werden auf den Kiosk-Geräten lokal gespeichert und abgespielt. Änderungen sind spätestens nach 5 Minuten auf allen Kiosks sichtbar.'
    },
    {
      name: 'dokumente',
      title: 'Dokumente & Downloads',
      type: 'array',
      group: 'medien',
      of: [{
        type: 'file',
        title: 'Dokument',
        fields: [
          {
            name: 'titel',
            type: 'string',
            title: 'Dokumenttitel',
            validation: Rule => Rule.required().error('Bitte einen Titel für das Dokument eingeben.'),
            description: 'Anzeigename des Dokuments'
          },
          {
            name: 'beschreibung',
            type: 'text',
            title: 'Beschreibung',
            rows: 2,
            description: 'Kurze Inhaltsbeschreibung (optional)'
          },
          {
            name: 'ordner',
            type: 'reference',
            title: 'Ordner / Kategorie',
            to: [{type: 'dokumentKategorie'}],
            description: 'In welchen Ordner gehört dieses Dokument?'
          },
          {
            name: 'typ',
            type: 'string',
            title: 'Dokumenttyp',
            options: {
              list: [
                {title: 'Pressemitteilung', value: 'pressemitteilung'},
                {title: 'Ausstellungskatalog', value: 'katalog'},
                {title: 'Chronik', value: 'chronik'},
                {title: 'Zeitungsartikel', value: 'artikel'},
                {title: 'Programmheft', value: 'programm'},
                {title: 'Historisches Dokument', value: 'historisch'},
                {title: 'Sonstiges', value: 'sonstiges'}
              ]
            }
          }
        ],
        preview: {
          select: {
            title: 'titel',
            subtitle: 'typ'
          },
          prepare({title, subtitle}) {
            const typLabel = {
              pressemitteilung: 'Pressemitteilung',
              katalog: 'Ausstellungskatalog',
              chronik: 'Chronik',
              artikel: 'Zeitungsartikel',
              programm: 'Programmheft',
              historisch: 'Historisches Dokument',
              sonstiges: 'Sonstiges'
            }[subtitle] || subtitle || '';
            return {
              title: title || '(Kein Titel)',
              subtitle: typLabel
            }
          }
        }
      }],
      description: 'PDFs, Pressemitteilungen, Kataloge und historische Dokumente zur Ausstellung'
    },

    // ── TAB: KIOSK ─────────────────────────────────────────────────────────
    {
      name: 'kioskTemplate',
      title: 'Kiosk-Darstellung',
      type: 'object',
      group: 'kiosk',
      description: 'Legt fest, wie diese Ausstellung auf den Kiosk-Bildschirmen dargestellt wird.',
      fields: [
        {
          name: 'template',
          title: 'Darstellungstyp',
          type: 'string',
          options: {
            list: [
              {title: 'Video-Loop (Endlosschleife)', value: 'video'},
              {title: 'Slideshow (Bilder-Galerie)', value: 'slideshow'},
              {title: 'Reader (Scrollbare Inhalte)', value: 'reader'},
              {title: 'Explorer (Interaktiver Katalog)', value: 'explorer'},
              {title: 'Website (Externe Webseite)', value: 'website'},
              {title: 'Signage (Eingangsbereich)', value: 'signage'},
              {title: 'Malspiel (Interaktives Ausmalbild)', value: 'malspiel'}
            ]
          },
          initialValue: 'video',
          validation: Rule => Rule.required().error('Bitte einen Darstellungstyp auswählen.'),
          description: 'Legt fest, wie diese Ausstellung auf den Kiosk-Bildschirmen dargestellt wird. Kann jederzeit geändert werden – wirkt sich beim nächsten Sync aus.'
        },

        // Video-Loop Settings
        {
          name: 'videoSettings',
          title: 'Video-Loop Einstellungen',
          type: 'object',
          hidden: ({parent}) => parent?.template !== 'video',
          fields: [
            {
              name: 'loop',
              title: 'Endlos-Schleife',
              type: 'boolean',
              initialValue: true,
              description: 'Videos nach dem Ende automatisch von vorne abspielen'
            },
            {
              name: 'shuffle',
              title: 'Zufällige Reihenfolge',
              type: 'boolean',
              initialValue: false,
              description: 'Videos in zufälliger Reihenfolge abspielen statt der festgelegten Reihenfolge'
            },
            {
              name: 'zeige_overlay',
              title: 'Info-Overlay anzeigen',
              type: 'boolean',
              initialValue: true,
              description: 'Titel und Kurzbeschreibung während der Videowiedergabe als Einblendung zeigen'
            },
            {
              name: 'overlay_position',
              title: 'Position des Info-Overlays',
              type: 'string',
              options: {
                list: [
                  {title: 'Unten links', value: 'bottom-left'},
                  {title: 'Unten rechts', value: 'bottom-right'},
                  {title: 'Oben links', value: 'top-left'},
                  {title: 'Oben rechts', value: 'top-right'}
                ]
              },
              initialValue: 'bottom-left',
              hidden: ({parent}) => !parent?.zeige_overlay,
              description: 'An welcher Stelle des Bildschirms soll das Info-Overlay erscheinen?'
            },
            {
              name: 'uebergang',
              title: 'Übergangseffekt zwischen Videos',
              type: 'string',
              options: {
                list: [
                  {title: 'Überblenden', value: 'fade'},
                  {title: 'Schwarz blenden', value: 'black'},
                  {title: 'Kein Effekt', value: 'none'}
                ]
              },
              initialValue: 'fade',
              description: 'Wie soll der Übergang zwischen zwei Videos aussehen?'
            },
            {
              name: 'lautstaerke',
              title: 'Lautstärke (0–100)',
              type: 'number',
              description: '0 = stumm, 100 = maximale Lautstärke. Empfehlung für Ausstellungsräume: 40–70.',
              initialValue: 70,
              validation: Rule => Rule.min(0).max(100).error('Lautstärke muss zwischen 0 und 100 liegen.')
            }
          ]
        },

        // Slideshow Settings
        {
          name: 'slideshowSettings',
          title: 'Slideshow Einstellungen',
          type: 'object',
          hidden: ({parent}) => parent?.template !== 'slideshow',
          fields: [
            {
              name: 'bildquelle',
              title: 'Bildquelle',
              type: 'string',
              options: {
                list: [
                  {title: 'Automatisch (Exponate, sonst Galerie)', value: 'auto'},
                  {title: 'Exponate (Hauptbilder)', value: 'exponate'},
                  {title: 'Bildergalerie (Tab Medien)', value: 'galerie'}
                ]
              },
              initialValue: 'auto',
              description: 'Welche Bilder zeigt die Slideshow? "Automatisch" nimmt die Exponate der Ausstellung, falls vorhanden, sonst die Bildergalerie.'
            },
            {
              name: 'interval',
              title: 'Anzeigedauer pro Bild (Sekunden)',
              type: 'number',
              initialValue: 8,
              validation: Rule => Rule.min(4).max(60).error('Bitte einen Wert zwischen 4 und 60 Sekunden eingeben.'),
              description: 'Wie viele Sekunden soll jedes Bild angezeigt werden? Empfehlung: 6–10 Sekunden.'
            },
            {
              name: 'uebergang',
              title: 'Übergangseffekt',
              type: 'string',
              options: {
                list: [
                  {title: 'Überblenden', value: 'fade'},
                  {title: 'Schieben', value: 'slide'}
                ]
              },
              initialValue: 'slide',
              description: 'Effekt beim Bildwechsel. "Schieben" folgt der Wischgeste der Besucher und wird empfohlen.'
            },
            {
              name: 'zeige_info',
              title: 'Bildtitel und Beschreibung anzeigen',
              type: 'boolean',
              initialValue: true,
              description: 'Blendet Titel und Bildunterschrift als Overlay ein'
            },
            {
              name: 'zeige_thumbnails',
              title: 'Miniaturansichten (Filmstreifen) anzeigen',
              type: 'boolean',
              initialValue: true,
              description: 'Antippbare Vorschaubilder am unteren Rand — Besucher sehen alle Bilder und können direkt springen'
            },
            {
              name: 'zeige_counter',
              title: 'Seitenzahl anzeigen (z.B. „3 / 12")',
              type: 'boolean',
              initialValue: true,
              description: 'Dauerhaft sichtbare Positionsanzeige, damit Besucher immer wissen, wo sie sind'
            }
          ]
        },

        // Explorer Settings
        {
          name: 'explorerSettings',
          title: 'Explorer Einstellungen',
          type: 'object',
          hidden: ({parent}) => parent?.template !== 'explorer',
          fields: [
            {
              name: 'nur_highlights',
              title: 'Nur Highlight-Objekte anzeigen',
              type: 'boolean',
              initialValue: false,
              description: 'Zeigt ausschließlich als Highlight markierte Exponate im Explorer an'
            },
            {
              name: 'sortierung',
              title: 'Sortierung der Exponate',
              type: 'string',
              options: {
                list: [
                  {title: 'Inventarnummer', value: 'inventarnummer'},
                  {title: 'Titel', value: 'titel'},
                  {title: 'Neueste zuerst', value: 'datum'},
                  {title: 'Zufällig', value: 'random'}
                ]
              },
              initialValue: 'inventarnummer',
              description: 'Standardsortierung der Exponate im Explorer-Raster'
            },
            {
              name: 'items_pro_seite',
              title: 'Objekte pro Seite',
              type: 'number',
              initialValue: 12,
              validation: Rule => Rule.min(1).max(50).error('Bitte einen Wert zwischen 1 und 50 eingeben.'),
              description: 'Anzahl der gleichzeitig angezeigten Exponate im Raster (1–50)'
            }
          ]
        },

        // Website Settings
        {
          name: 'websiteSettings',
          title: 'Website Einstellungen',
          type: 'object',
          hidden: ({parent}) => parent?.template !== 'website',
          fields: [
            {
              name: 'url',
              title: 'Website-URL',
              type: 'url',
              validation: Rule => Rule.uri({ scheme: ['http', 'https'] }),
              description: 'URL der Website die im Kiosk angezeigt wird (z.B. https://www.museum-reutte.at). Wird automatisch über den lokalen nginx-Proxy geladen.'
            }
          ]
        },

        // Malspiel Settings
        {
          name: 'malspielSettings',
          title: 'Malspiel Einstellungen',
          type: 'object',
          hidden: ({parent}) => parent?.template !== 'malspiel',
          fields: [
            {
              name: 'malspiel',
              title: 'Malspiel',
              type: 'reference',
              to: [{type: 'malspiel'}],
              validation: Rule => Rule.required().error('Bitte ein Malspiel auswählen.'),
              description: 'Das Malspiel das auf diesem Kiosk angezeigt wird'
            }
          ]
        },

        // Reader Settings
        {
          name: 'readerSettings',
          title: 'Reader Einstellungen',
          type: 'object',
          hidden: ({parent}) => parent?.template !== 'reader',
          fields: [
            {
              name: 'pdf_url',
              title: 'PDF-URL',
              type: 'url',
              description: 'URL zur PDF-Datei, die im Reader angezeigt wird (z.B. Ausstellungskatalog). Muss öffentlich zugänglich sein.'
            },
            {
              name: 'schriftgroesse',
              title: 'Schriftgröße',
              type: 'string',
              options: {
                list: [
                  {title: 'Klein', value: 'small'},
                  {title: 'Normal', value: 'normal'},
                  {title: 'Groß', value: 'large'},
                  {title: 'Sehr groß', value: 'xlarge'}
                ]
              },
              initialValue: 'normal',
              description: 'Schriftgröße für den Lesetext auf dem Kiosk-Bildschirm. Empfehlung: "Groß" für große Abstände zum Bildschirm.'
            },
            {
              name: 'zeige_inhaltsverzeichnis',
              title: 'Inhaltsverzeichnis anzeigen',
              type: 'boolean',
              initialValue: true,
              description: 'Zeigt am Beginn des Texts eine anklickbare Kapitelübersicht'
            }
          ]
        }
      ]
    },

    // ── TAB: EXPONATE ──────────────────────────────────────────────────────
    {
      name: 'exponate',
      title: 'Exponate',
      type: 'array',
      group: 'exponate',
      of: [{
        type: 'reference',
        to: [{type: 'exponat'}]
      }],
      description: 'Alle Objekte, die zu dieser Ausstellung gehören. Reihenfolge hier bestimmt die Anzeigereihenfolge im Explorer und in der Slideshow.'
    },
    {
      name: 'highlight_exponate',
      title: 'Highlight-Exponate',
      type: 'array',
      group: 'exponate',
      of: [{
        type: 'reference',
        to: [{type: 'exponat'}]
      }],
      description: 'Die wichtigsten Exponate dieser Ausstellung. Werden in der Übersicht und im Explorer besonders hervorgehoben.'
    },
    {
      name: 'kategorien',
      title: 'Zugehörige Kategorien',
      type: 'array',
      group: 'exponate',
      of: [{
        type: 'reference',
        to: [{type: 'kategorie'}]
      }],
      description: 'Kategorien, die in dieser Ausstellung vorkommen – erleichtert die Filterung im Explorer'
    },

    // ── TAB: VERWALTUNG ────────────────────────────────────────────────────
    {
      name: 'zeitraum',
      title: 'Zeitraum',
      type: 'object',
      group: 'verwaltung',
      fields: [
        {
          name: 'typ',
          title: 'Ausstellungstyp',
          type: 'string',
          options: {
            list: [
              {title: 'Dauerausstellung', value: 'dauer'},
              {title: 'Sonderausstellung', value: 'sonder'},
              {title: 'Temporäre Ausstellung', value: 'temporaer'},
              {title: 'Virtuelle Ausstellung', value: 'virtuell'}
            ]
          },
          initialValue: 'sonder'
        },
        {
          name: 'von',
          title: 'Startdatum',
          type: 'date',
          description: 'Erster Tag der Ausstellung'
        },
        {
          name: 'bis',
          title: 'Enddatum',
          type: 'date',
          description: 'Letzter Tag der Ausstellung – leer lassen bei Dauerausstellungen'
        },
        {
          name: 'zeitraum_text',
          title: 'Zeitraum als Text',
          type: 'string',
          description: 'Freitext-Darstellung des Zeitraums, z.B. "März – Oktober 2025" oder "Seit 1975"'
        }
      ]
    },
    {
      name: 'organisation',
      title: 'Organisation',
      type: 'object',
      group: 'verwaltung',
      fields: [
        {
          name: 'kurator',
          title: 'Kurator / Kuratorin',
          type: 'string',
          description: 'Verantwortliche Person für die Ausstellung'
        },
        {
          name: 'partner',
          title: 'Partner & Sponsoren',
          type: 'array',
          of: [{type: 'string'}],
          description: 'Namen von Partnerinstitutionen oder Förderern'
        },
        {
          name: 'ort',
          title: 'Ausstellungsort',
          type: 'string',
          description: 'Raum oder Gebäude, in dem die Ausstellung stattfindet'
        },
        {
          name: 'raumplan',
          title: 'Raumplan',
          type: 'image',
          description: 'Grundriss oder Wegweiser zur Ausstellung (optional)'
        }
      ]
    },
    {
      name: 'veranstaltungen',
      title: 'Begleitveranstaltungen',
      type: 'array',
      group: 'verwaltung',
      of: [{
        type: 'object',
        fields: [
          {
            name: 'titel',
            title: 'Titel',
            type: 'string',
            validation: Rule => Rule.required().error('Bitte einen Titel für die Veranstaltung eingeben.')
          },
          {
            name: 'datum',
            title: 'Datum und Uhrzeit',
            type: 'datetime'
          },
          {
            name: 'beschreibung',
            title: 'Beschreibung',
            type: 'text',
            rows: 3
          },
          {
            name: 'typ',
            title: 'Veranstaltungstyp',
            type: 'string',
            options: {
              list: [
                {title: 'Eröffnung', value: 'eroeffnung'},
                {title: 'Führung', value: 'fuehrung'},
                {title: 'Vortrag', value: 'vortrag'},
                {title: 'Workshop', value: 'workshop'},
                {title: 'Finissage', value: 'finissage'},
                {title: 'Sonstiges', value: 'sonstiges'}
              ]
            }
          }
        ],
        preview: {
          select: {
            title: 'titel',
            subtitle: 'datum',
            typ: 'typ'
          },
          prepare({title, datum, typ}) {
            return {
              title,
              subtitle: `${typ ? typ + ' – ' : ''}${datum ? new Date(datum).toLocaleDateString('de-DE') : 'Kein Datum'}`
            }
          }
        }
      }],
      description: 'Führungen, Vorträge, Workshops und andere Begleitprogramme zu dieser Ausstellung'
    },
    {
      name: 'tags',
      title: 'Schlagworte',
      type: 'array',
      group: 'verwaltung',
      of: [{type: 'string'}],
      options: {
        layout: 'tags'
      },
      description: 'Thematische Stichworte zur besseren Auffindbarkeit (z.B. "Mittelalter", "Handwerk", "Regional")'
    },
    {
      name: 'reihenfolge',
      title: 'Reihenfolge',
      type: 'number',
      group: 'verwaltung',
      description: 'Niedrigere Zahl = weiter oben in Listen. Leer lassen für automatische Sortierung.'
    },
    {
      name: 'ist_featured',
      title: 'Auf Startseite hervorheben',
      type: 'boolean',
      group: 'verwaltung',
      description: 'Wird als Featured-Ausstellung prominent auf der Startseite angezeigt',
      initialValue: false
    },
    {
      name: 'veroeffentlichung',
      title: 'Veröffentlichungsstatus',
      type: 'object',
      group: 'verwaltung',
      fields: [
        {
          name: 'status',
          title: 'Status',
          type: 'string',
          options: {
            list: [
              {title: 'Entwurf – noch nicht sichtbar', value: 'entwurf'},
              {title: 'In Vorbereitung – intern sichtbar', value: 'vorbereitung'},
              {title: '✅ Veröffentlicht – für Besucher sichtbar', value: 'veroeffentlicht'},
              {title: 'Beendet – Ausstellung abgeschlossen', value: 'beendet'},
              {title: 'Archiviert – nicht mehr aktiv', value: 'archiviert'}
            ]
          },
          initialValue: 'entwurf'
        },
        {
          name: 'veroeffentlicht_am',
          title: 'Veröffentlicht am',
          type: 'datetime',
          description: 'Datum und Uhrzeit der ersten Veröffentlichung (wird automatisch gesetzt)'
        }
      ]
    }
  ],

  // ── Preview ────────────────────────────────────────────────────────────────
  preview: {
    select: {
      title: 'titel',
      subtitle: 'untertitel',
      media: 'titelbild',
      firstVideoThumbnail: 'videos.0.thumbnail',
      status: 'veroeffentlichung.status',
      featured: 'ist_featured',
      typ: 'zeitraum.typ'
    },
    prepare({title, subtitle, media, firstVideoThumbnail, status, featured, typ}) {
      const statusLabel = {
        entwurf: '✏️',
        vorbereitung: '🔄',
        veroeffentlicht: '✅',
        beendet: '🏁',
        archiviert: '📦'
      }[status] || '';
      const typLabel = {
        dauer: 'Dauerausstellung',
        sonder: 'Sonderausstellung',
        temporaer: 'Temporär',
        virtuell: 'Virtuell'
      }[typ] || '';
      return {
        title: `${featured ? '⭐ ' : ''}${title || '(Ohne Titel)'}`,
        subtitle: `${typLabel ? '[' + typLabel + '] ' : ''}${subtitle || ''} ${statusLabel}`.trim(),
        media: media || firstVideoThumbnail
      };
    }
  },

  // ── Orderings ──────────────────────────────────────────────────────────────
  orderings: [
    {
      title: 'Reihenfolge',
      name: 'reihenfolgeAsc',
      by: [{field: 'reihenfolge', direction: 'asc'}]
    },
    {
      title: 'Neueste zuerst',
      name: 'createdDesc',
      by: [{field: '_createdAt', direction: 'desc'}]
    },
    {
      title: 'Alphabetisch',
      name: 'titelAsc',
      by: [{field: 'titel', direction: 'asc'}]
    },
    {
      title: 'Startdatum',
      name: 'startdatumDesc',
      by: [{field: 'zeitraum.von', direction: 'desc'}]
    }
  ]
};
