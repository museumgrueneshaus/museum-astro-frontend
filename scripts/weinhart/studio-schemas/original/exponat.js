// schemas/exponat.js
import { QrCodeInput } from '../components/QrCodeInput.jsx'

export default {
  name: 'exponat',
  title: 'Exponat',
  type: 'document',

  // ── Tabs ──────────────────────────────────────────────────────────────────
  groups: [
    {
      name: 'grunddaten',
      title: 'Grunddaten',
      default: true
    },
    {
      name: 'english',
      title: '🇬🇧 English'
    },
    {
      name: 'medien',
      title: 'Medien'
    },
    {
      name: 'details',
      title: 'Details & Herkunft'
    },
    {
      name: 'verwaltung',
      title: 'Verwaltung'
    }
  ],

  fields: [

    // ── TAB: GRUNDDATEN ───────────────────────────────────────────────────
    {
      name: 'inventarnummer',
      title: 'Inventarnummer',
      type: 'string',
      group: 'grunddaten',
      validation: Rule => Rule.required().error('Inventarnummer ist erforderlich – bitte aus dem Bestandssystem übernehmen.'),
      description: 'Bestehende Inventarnummer aus Ihrem Bestandssystem (z.B. INV-2024-001, 2024.001.A). Erscheint auf QR-Code-Etiketten und in der Suche.'
    },
    {
      name: 'titel',
      title: 'Objektbezeichnung',
      type: 'string',
      group: 'grunddaten',
      validation: Rule => Rule.required().max(200).error('Objektbezeichnung ist erforderlich (max. 200 Zeichen).'),
      description: 'Objektbezeichnung wie sie auf dem Kiosk und der Besucherseite angezeigt wird.'
    },
    {
      name: 'untertitel',
      title: 'Untertitel',
      type: 'string',
      group: 'grunddaten',
      description: 'Optionaler Untertitel oder alternative Bezeichnung (z.B. Volkstümlicher Name, Serientitel)'
    },
    {
      name: 'kurzbeschreibung',
      title: 'Kurzbeschreibung (für Kiosk)',
      type: 'text',
      rows: 3,
      group: 'grunddaten',
      validation: Rule => Rule.required().max(500).error('Kurzbeschreibung ist erforderlich (max. 500 Zeichen).'),
      description: 'Wird direkt auf dem Kiosk-Bildschirm angezeigt. Bitte in einfacher Sprache ohne Fachbegriffe verfassen. Ideal: 2–3 Sätze (max. 500 Zeichen).'
    },
    {
      name: 'beschreibung',
      title: 'Ausführliche Beschreibung',
      type: 'array',
      group: 'grunddaten',
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
          options: { hotspot: true }
        }
      ],
      description: 'Vollständige Beschreibung mit Formatierungen, Zwischentiteln und eingebetteten Bildern – erscheint auf der Detailseite'
    },

    // ── TAB: ENGLISH ──────────────────────────────────────────────────────
    {
      name: 'titel_en',
      title: 'Title (English)',
      type: 'string',
      group: 'english',
      description: 'English translation of the object name – shown on the mobile guide when visitors switch to English.'
    },
    {
      name: 'untertitel_en',
      title: 'Subtitle (English)',
      type: 'string',
      group: 'english',
    },
    {
      name: 'kurzbeschreibung_en',
      title: 'Short Description (English)',
      type: 'text',
      rows: 3,
      group: 'english',
      validation: Rule => Rule.max(500),
      description: 'English short description for the kiosk display (max. 500 characters).'
    },
    {
      name: 'beschreibung_en',
      title: 'Description (English)',
      type: 'array',
      group: 'english',
      of: [
        {
          type: 'block',
          styles: [
            {title: 'Normal', value: 'normal'},
            {title: 'H2', value: 'h2'},
            {title: 'H3', value: 'h3'},
            {title: 'Quote', value: 'blockquote'}
          ],
          marks: {
            decorators: [
              {title: 'Bold', value: 'strong'},
              {title: 'Italic', value: 'em'},
            ],
            annotations: [
              {
                title: 'Link',
                name: 'link',
                type: 'object',
                fields: [{ title: 'URL', name: 'href', type: 'url' }]
              }
            ]
          }
        }
      ],
      description: 'Full English description with formatting – shown on the detail page when visitors switch language.'
    },

    // ── TAB: MEDIEN ────────────────────────────────────────────────────────
    {
      name: 'hauptbild',
      title: 'Hauptbild',
      type: 'image',
      group: 'medien',
      options: {
        hotspot: true,
        metadata: ['blurhash', 'lqip', 'palette']
      },
      description: 'Wird als Vorschaubild in Listen und als Hauptbild auf der Detailseite angezeigt. Empfehlung: mindestens 1200×900 Pixel.',
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
          description: 'Urheberrechtshinweis, z.B. "© Stadtarchiv" oder "Foto: Max Mustermann"'
        }
      ]
    },
    {
      name: 'bilder',
      title: 'Weitere Bilder',
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
          },
          {
            name: 'ansicht',
            type: 'string',
            title: 'Ansicht',
            options: {
              list: [
                {title: 'Vorderseite', value: 'vorderseite'},
                {title: 'Rückseite', value: 'rueckseite'},
                {title: 'Seitenansicht', value: 'seitenansicht'},
                {title: 'Detail', value: 'detail'},
                {title: 'Signatur', value: 'signatur'},
                {title: 'Zustand', value: 'zustand'}
              ]
            }
          }
        ]
      }],
      description: 'Zusätzliche Aufnahmen des Objekts (Rückseite, Details, Zustand etc.)'
    },
    {
      name: 'audio',
      title: 'Audioguide',
      type: 'array',
      group: 'medien',
      of: [{
        type: 'file',
        title: 'Audiodatei',
        options: { accept: 'audio/*' },
        fields: [
          {
            name: 'sprache',
            type: 'string',
            title: 'Sprache',
            options: {
              list: [
                {title: 'Deutsch', value: 'de'},
                {title: 'English', value: 'en'},
                {title: 'Français', value: 'fr'},
                {title: 'Italiano', value: 'it'}
              ]
            }
          },
          {
            name: 'dauer',
            type: 'string',
            title: 'Laufzeit',
            description: 'z.B. 2:30 – dient nur als Anzeigeinformation'
          }
        ]
      }],
      description: 'Audioguide-Dateien in verschiedenen Sprachen. Werden auf der Besucherseite als abspielbarer Audioguide angeboten.'
    },
    {
      name: 'video',
      title: 'Video',
      type: 'object',
      group: 'medien',
      fields: [
        {
          name: 'videodatei',
          title: 'Videodatei',
          type: 'file',
          options: { accept: 'video/*' },
          description: 'Unterstützte Formate: MP4, MOV, AVI'
        },
        {
          name: 'videotitel',
          type: 'string',
          title: 'Videotitel',
          description: 'Titel des Videos für die Anzeige'
        },
        {
          name: 'dauer',
          type: 'string',
          title: 'Laufzeit',
          description: 'z.B. 3:45 – dient nur als Anzeigeinformation'
        }
      ],
      description: 'Optionales Video zu diesem Objekt (z.B. Herstellungsprozess, Restaurierung, Interview)'
    },
    {
      name: 'dokumente',
      title: 'Dokumente',
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
            description: 'Anzeigename des Dokuments'
          },
          {
            name: 'typ',
            type: 'string',
            title: 'Dokumenttyp',
            options: {
              list: [
                {title: 'Inventarkarte', value: 'inventarkarte'},
                {title: 'Restaurierungsbericht', value: 'restaurierung'},
                {title: 'Expertise', value: 'expertise'},
                {title: 'Historisches Dokument', value: 'historisch'},
                {title: 'Sonstiges', value: 'sonstiges'}
              ]
            }
          }
        ]
      }],
      description: 'Zugehörige Dokumente wie Inventarkar, Restaurierungsberichte oder Expertisen'
    },

    // ── TAB: DETAILS & HERKUNFT ────────────────────────────────────────────
    {
      name: 'datierung',
      title: 'Datierung',
      type: 'object',
      group: 'details',
      fields: [
        {
          name: 'jahr_von',
          title: 'Jahr (von)',
          type: 'number',
          description: 'Frühestes Entstehungsjahr. Negative Zahlen für v. Chr. (z.B. -500 für 500 v. Chr.)'
        },
        {
          name: 'jahr_bis',
          title: 'Jahr (bis)',
          type: 'number',
          description: 'Spätestes Entstehungsjahr – leer lassen wenn "Jahr von" ausreicht'
        },
        {
          name: 'jahr_text',
          title: 'Datierung als Text',
          type: 'string',
          description: 'Freitext-Datierung, z.B. "um 1850", "1. Hälfte 19. Jh.", "Hochmittelalter"'
        },
        {
          name: 'epoche',
          title: 'Epoche',
          type: 'string',
          options: {
            list: [
              {title: 'Vorgeschichte', value: 'vorgeschichte'},
              {title: 'Antike', value: 'antike'},
              {title: 'Mittelalter', value: 'mittelalter'},
              {title: 'Frühe Neuzeit', value: 'fruehe_neuzeit'},
              {title: 'Neuzeit', value: 'neuzeit'},
              {title: 'Moderne', value: 'moderne'},
              {title: 'Zeitgenössisch', value: 'zeitgenoessisch'}
            ]
          }
        }
      ]
    },
    {
      name: 'herstellung',
      title: 'Herstellung & Provenienz',
      type: 'object',
      group: 'details',
      fields: [
        {
          name: 'kuenstler',
          title: 'Künstler / Hersteller',
          type: 'string',
          description: 'Name der ausführenden Person, Werkstatt oder Firma'
        },
        {
          name: 'entstehungsort',
          title: 'Entstehungsort',
          type: 'string',
          description: 'Ort oder Region der Herstellung, z.B. "Wien", "Tirol", "Süddeutschland"'
        },
        {
          name: 'material',
          title: 'Material',
          type: 'string',
          description: 'Verwendete Materialien, z.B. "Holz, Eisen, Leder" oder "Öl auf Leinwand"'
        },
        {
          name: 'technik',
          title: 'Technik',
          type: 'string',
          description: 'Herstellungstechnik, z.B. "Geschmiedet", "Handgewoben", "Druckgraphik"'
        },
        {
          name: 'signatur',
          title: 'Signatur / Stempel',
          type: 'string',
          description: 'Vorhandene Signaturen, Stempel, Marken oder Inschriften'
        }
      ]
    },
    {
      name: 'physisch',
      title: 'Maße & Zustand',
      type: 'object',
      group: 'details',
      fields: [
        {
          name: 'masse',
          title: 'Maße',
          type: 'string',
          description: 'Abmessungen des Objekts, z.B. "H: 30 cm, B: 20 cm, T: 10 cm"'
        },
        {
          name: 'gewicht',
          title: 'Gewicht',
          type: 'string',
          description: 'Gewicht des Objekts, z.B. "500 g" oder "2,3 kg"'
        },
        {
          name: 'zustand',
          title: 'Erhaltungszustand',
          type: 'string',
          options: {
            list: [
              {title: 'Sehr gut', value: 'sehr_gut'},
              {title: 'Gut', value: 'gut'},
              {title: 'Befriedigend', value: 'befriedigend'},
              {title: 'Restaurierungsbedürftig', value: 'restaurierungsbeduerftig'},
              {title: 'Fragment', value: 'fragment'}
            ]
          }
        },
        {
          name: 'zustand_bemerkung',
          title: 'Anmerkung zum Zustand',
          type: 'text',
          rows: 2,
          description: 'Detaillierte Beschreibung von Schäden, Fehlteilen oder Besonderheiten'
        }
      ]
    },

    // ── TAB: VERWALTUNG ────────────────────────────────────────────────────
    {
      name: 'qr_code_preview',
      title: 'QR-Code zum Ausdrucken',
      type: 'string',
      group: 'verwaltung',
      readOnly: true,
      description: 'QR-Code rechts-klicken → "Als Bild speichern" → Ausdrucken und am Exponat anbringen. Besucher scannen mit dem Handy und sehen die vollständige Detailseite.',
      components: { input: QrCodeInput }
    },
    {
      name: 'ist_highlight',
      title: '⭐ Highlight-Objekt',
      type: 'boolean',
      group: 'verwaltung',
      description: 'Highlight-Objekte werden in der Ausstellungsübersicht und im Explorer prominent hervorgehoben.'
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
              {title: 'In Bearbeitung – intern sichtbar', value: 'in_bearbeitung'},
              {title: '✅ Veröffentlicht – für Besucher sichtbar', value: 'veroeffentlicht'},
              {title: 'Archiviert – nicht mehr aktiv', value: 'archiviert'}
            ]
          },
          initialValue: 'entwurf'
        },
        {
          name: 'sichtbar_ab',
          title: 'Sichtbar ab',
          type: 'datetime',
          description: 'Optionale zeitgesteuerte Veröffentlichung – leer lassen für sofortige Sichtbarkeit'
        },
        {
          name: 'sichtbar_bis',
          title: 'Sichtbar bis',
          type: 'datetime',
          description: 'Optionale automatische Deaktivierung – leer lassen wenn kein Ablaufdatum gewünscht'
        }
      ]
    },
    {
      name: 'organisation',
      title: 'Organisation & Standort',
      type: 'object',
      group: 'verwaltung',
      fields: [
        {
          name: 'standort',
          title: 'Aktueller Standort',
          type: 'string',
          description: 'Aktueller physischer Standort im Museum (z.B. "Raum 2, Vitrine 3", "Depot A / Regal 5", "Dauerleihgabe an Stadtarchiv").'
        },
        {
          name: 'kategorie',
          title: 'Kategorie',
          type: 'reference',
          to: [{type: 'kategorie'}],
          description: 'Thematische Kategorie für Filterung und Sortierung im Explorer'
        },
        {
          name: 'sammlung',
          title: 'Sammlung',
          type: 'string',
          description: 'Zugehörige Sammlung, z.B. "Dauerausstellung", "Sondersammlung Meyer", "Archäologie"'
        },
        {
          name: 'leihgeber',
          title: 'Leihgeber',
          type: 'string',
          description: 'Name der Institution oder Person, von der das Objekt als Leihgabe stammt'
        },
        {
          name: 'erwerbung',
          title: 'Erwerbung',
          type: 'object',
          fields: [
            {
              name: 'art',
              title: 'Erwerbungsart',
              type: 'string',
              options: {
                list: [
                  {title: 'Schenkung', value: 'schenkung'},
                  {title: 'Kauf', value: 'kauf'},
                  {title: 'Leihgabe', value: 'leihgabe'},
                  {title: 'Fund', value: 'fund'},
                  {title: 'Nachlass', value: 'nachlass'}
                ]
              }
            },
            {
              name: 'datum',
              title: 'Erwerbungsdatum',
              type: 'date',
              description: 'Datum der Übernahme in den Museumsbestand'
            },
            {
              name: 'person',
              title: 'Von Person / Institution',
              type: 'string',
              description: 'Name der Person oder Organisation, von der das Objekt erworben wurde'
            }
          ]
        }
      ]
    },
    {
      name: 'tags',
      title: 'Schlagworte',
      type: 'array',
      group: 'verwaltung',
      of: [{type: 'string'}],
      options: { layout: 'tags' },
      description: 'Thematische Stichworte für die Suche und Filterung (z.B. "Keramik", "Römisch", "Tracht")'
    },
    {
      name: 'reihenfolge',
      title: 'Reihenfolge',
      type: 'number',
      group: 'verwaltung',
      description: 'Niedrigere Zahl = weiter oben in der Liste. Leer lassen für automatische Sortierung nach Inventarnummer.'
    },
    {
      name: 'qr_code',
      title: 'QR-Code ID',
      type: 'slug',
      group: 'verwaltung',
      options: {
        source: 'inventarnummer',
        slugify: input => 'EXP-' + input.replace(/[^a-zA-Z0-9]/g, '-')
      },
      description: 'Wird automatisch aus der Inventarnummer generiert. Dient als eindeutige Kennung für QR-Code-Etiketten.'
    },
    {
      name: 'hat_led_licht',
      title: 'Hat LED-Beleuchtung',
      type: 'boolean',
      group: 'verwaltung',
      initialValue: false,
      description: 'Aktivieren wenn das Exponat über das LED-Beleuchtungssystem verfügt. Zeigt die Positionseinstellungen.'
    },
    {
      name: 'led_position',
      title: 'LED Position im Raum',
      type: 'object',
      group: 'verwaltung',
      description: 'Definiert welche LEDs auf welchem Strip dieses Exponat beleuchten.',
      hidden: ({parent}) => !parent?.hat_led_licht,
      fields: [
        {
          name: 'strip_number',
          title: 'LED Strip Nummer',
          type: 'number',
          options: {
            list: [
              {title: 'Strip 1 (ESP32-1)', value: 1},
              {title: 'Strip 2 (ESP32-2)', value: 2},
              {title: 'Strip 3 (ESP32-3)', value: 3}
            ]
          },
          description: 'Welcher LED-Strip (1, 2 oder 3) beleuchtet dieses Objekt?',
          validation: Rule => Rule.required().min(1).max(3).error('Bitte Strip 1, 2 oder 3 auswählen.')
        },
        {
          name: 'led_start',
          title: 'LED Startposition',
          type: 'number',
          description: 'Nummer der ersten LED auf diesem Strip (0 = erste LED)',
          validation: Rule => Rule.min(0).error('Die Startposition muss 0 oder größer sein.')
        },
        {
          name: 'led_end',
          title: 'LED Endposition',
          type: 'number',
          description: 'Nummer der letzten LED auf diesem Strip (z.B. 9 für LEDs 0–9)',
          validation: Rule => Rule.min(0).error('Die Endposition muss 0 oder größer sein.')
        },
        {
          name: 'raum_position',
          title: 'Position im Raum',
          type: 'string',
          description: 'Beschreibung der Position im Ausstellungsraum, z.B. "Nordwand, Mitte" oder "Ostwand, oben"'
        }
      ]
    },
    {
      name: 'import_metadata',
      title: 'Import-Metadaten (IMDAS)',
      type: 'object',
      group: 'verwaltung',
      hidden: ({currentUser}) => !currentUser?.roles?.some(r => r.name === 'administrator'),
      fields: [
        {
          name: 'imdas_id',
          title: 'IMDAS ID',
          type: 'string',
          readOnly: true,
          description: 'Interne ID aus dem IMDAS-System (nicht bearbeiten)'
        },
        {
          name: 'import_date',
          title: 'Import-Datum',
          type: 'datetime',
          readOnly: true,
          description: 'Zeitpunkt des letzten Datenimports aus IMDAS'
        },
        {
          name: 'original_data',
          title: 'Ursprüngliche IMDAS-Rohdaten (JSON)',
          type: 'text',
          readOnly: true,
          description: 'Originalrohdaten aus dem IMDAS-Export – nur zur Referenz, nicht bearbeiten'
        }
      ]
    }

  ],

  // ── Preview ────────────────────────────────────────────────────────────────
  preview: {
    select: {
      title: 'titel',
      subtitle: 'inventarnummer',
      media: 'hauptbild',
      status: 'veroeffentlichung.status',
      highlight: 'ist_highlight'
    },
    prepare(selection) {
      const {title, subtitle, media, status, highlight} = selection;
      const statusLabel = {
        entwurf: '✏️',
        in_bearbeitung: '🔄',
        veroeffentlicht: '✅',
        archiviert: '📦'
      }[status] || '';
      return {
        title: `${highlight ? '⭐ ' : ''}${title || '(Ohne Titel)'}`,
        subtitle: `${subtitle || '–'}  ${statusLabel}`,
        media
      };
    }
  },

  // ── Orderings ──────────────────────────────────────────────────────────────
  orderings: [
    {
      title: 'Inventarnummer',
      name: 'inventarnummerAsc',
      by: [{field: 'inventarnummer', direction: 'asc'}]
    },
    {
      title: 'Titel A–Z',
      name: 'titelAsc',
      by: [{field: 'titel', direction: 'asc'}]
    },
    {
      title: 'Neueste zuerst',
      name: 'createdDesc',
      by: [{field: '_createdAt', direction: 'desc'}]
    },
    {
      title: 'Highlights zuerst',
      name: 'highlightDesc',
      by: [
        {field: 'ist_highlight', direction: 'desc'},
        {field: 'reihenfolge', direction: 'asc'}
      ]
    }
  ]
};
