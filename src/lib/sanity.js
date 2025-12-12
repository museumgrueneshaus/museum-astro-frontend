import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

// Sanity Client
const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID || '832k5je1';
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production';

export const client = createClient({
  projectId,
  dataset,
  useCdn: false, // Disable CDN to avoid cache issues during development
  apiVersion: '2024-01-01',
});

// Image URL Builder
const builder = imageUrlBuilder(client);

export function urlFor(source) {
  return builder.image(source);
}

// Queries
export async function getExponate(options = {}) {
  const { 
    highlight = false, 
    categories = [], 
    limit = 50,
    category = null 
  } = options;

  let query = '*[_type == "exponat"';
  const params = {};

  if (highlight) {
    query += ' && ist_highlight == true';
  }

  if (category) {
    query += ' && kategorie._ref == $category';
    params.category = category;
  }

  if (categories && categories.length > 0) {
    query += ' && kategorie._ref in $categories';
    params.categories = categories;
  }

  query += '] | order(reihenfolge asc, _createdAt desc)';
  
  if (limit) {
    query += `[0...${limit}]`;
  }

  query += `{
    _id,
    inventarnummer,
    titel,
    untertitel,
    kurzbeschreibung,
    beschreibung,
    hauptbild{..., asset->{_id, metadata{lqip, dimensions}}},
    bilder[]{..., asset->{_id, metadata{lqip, dimensions}}},
    "kategorie": kategorie->{_id, titel, slug, icon, farbe},
    datierung,
    herstellung,
    physisch,
    organisation,
    tags,
    ist_highlight,
    reihenfolge,
    qr_code,
    hat_led_licht,
    led_position,
    audio,
    video,
    dokumente
  }`;

  return await client.fetch(query, params);
}

// New function for paginated loading
export async function getExponatePaginated(options = {}) {
  const { 
    highlight = false, 
    categories = [], 
    limit = 12,
    offset = 0,
    category = null 
  } = options;

  let query = '*[_type == "exponat"';
  const params = {};

  if (highlight) {
    query += ' && ist_highlight == true';
  }

  if (category) {
    query += ' && kategorie._ref == $category';
    params.category = category;
  }

  if (categories && categories.length > 0) {
    query += ' && kategorie._ref in $categories';
    params.categories = categories;
  }

  query += '] | order(reihenfolge asc, _createdAt desc)';
  query += `[${offset}...${offset + limit}]`;

  query += `{
    _id,
    inventarnummer,
    titel,
    untertitel,
    kurzbeschreibung,
    beschreibung,
    hauptbild{..., asset->{_id, metadata{lqip, dimensions}}},
    bilder[]{..., asset->{_id, metadata{lqip, dimensions}}},
    "kategorie": kategorie->{_id, titel, slug, icon, farbe},
    datierung,
    herstellung,
    physisch,
    organisation,
    tags,
    ist_highlight,
    reihenfolge,
    qr_code,
    hat_led_licht,
    led_position,
    audio,
    video,
    dokumente
  }`;

  return await client.fetch(query, params);
}

// Get total count of items
export async function getExponateCount(options = {}) {
  const { 
    highlight = false, 
    categories = [], 
    category = null 
  } = options;

  let query = 'count(*[_type == "exponat"';
  const params = {};

  if (highlight) {
    query += ' && ist_highlight == true';
  }

  if (category) {
    query += ' && kategorie._ref == $category';
    params.category = category;
  }

  if (categories && categories.length > 0) {
    query += ' && kategorie._ref in $categories';
    params.categories = categories;
  }

  query += '])';

  return await client.fetch(query, params);
}

export async function getExponat(id) {
  const query = `*[_type == "exponat" && _id == $id][0]{
    _id,
    inventarnummer,
    titel,
    untertitel,
    kurzbeschreibung,
    beschreibung,
    hauptbild{..., asset->{_id, metadata{lqip, dimensions}}},
    bilder[]{..., asset->{_id, metadata{lqip, dimensions}}},
    "kategorie": kategorie->{_id, titel, slug, icon, farbe},
    datierung,
    herstellung,
    physisch,
    organisation,
    tags,
    ist_highlight,
    reihenfolge,
    qr_code,
    hat_led_licht,
    led_position,
    audio,
    video,
    dokumente
  }`;

  return await client.fetch(query, { id });
}

export async function getExponatByQR(qrCode) {
  const query = `*[_type == "exponat" && qr_code.current == $qrCode][0]{
    _id,
    inventarnummer,
    titel,
    kurzbeschreibung,
    hauptbild
  }`;

  return await client.fetch(query, { qrCode });
}

export async function getExponateByIds(ids = []) {
  if (!ids || ids.length === 0) return [];
  const cleaned = ids.map((x) => (typeof x === 'string' ? x : x?._ref || x?._id)).filter(Boolean);
  if (cleaned.length === 0) return [];
  const projection = `{
    _id,
    inventarnummer,
    titel,
    untertitel,
    kurzbeschreibung,
    beschreibung,
    hauptbild{..., asset->{_id, metadata{lqip, dimensions}}},
    bilder[]{..., asset->{_id, metadata{lqip, dimensions}}},
    "kategorie": kategorie->{_id, titel, slug, icon, farbe},
    datierung,
    herstellung,
    physisch,
    organisation,
    tags,
    ist_highlight,
    reihenfolge,
    qr_code,
    audio,
    video,
    dokumente
  }`;
  const query = `*[_type == "exponat" && _id in $ids] | order(reihenfolge asc, _createdAt desc) ${projection}`;
  return await client.fetch(query, { ids: cleaned });
}

export async function getKategorien() {
  const query = `*[_type == "kategorie"] | order(reihenfolge asc, titel asc) {
    _id,
    titel,
    slug,
    beschreibung,
    icon,
    farbe,
    reihenfolge
  }`;

  return await client.fetch(query);
}

export async function getMuseumInfo() {
  const query = `*[_type == "museumInfo"][0] {
    name,
    untertitel,
    logo,
    willkommenstext,
    kontakt,
    oeffnungszeiten,
    eintrittspreise,
    social_media,
    sprachen
  }`;

  return await client.fetch(query);
}

// Ausstellungen
export async function getAusstellungen(options = {}) {
  const { featured = false, aktiv = true } = options;

  let filters = [];

  if (featured) {
    filters.push('ist_featured == true');
  }

  if (aktiv) {
    filters.push('veroeffentlichung.status in ["veroeffentlicht", "vorbereitung"]');
  }

  const filterString = filters.length > 0 ? ' && ' + filters.join(' && ') : '';

  const query = `*[_type == "ausstellung"${filterString}] | order(reihenfolge asc, _createdAt desc) {
    _id,
    titel,
    untertitel,
    slug,
    kurzbeschreibung,
    titelbild{..., asset->{_id, metadata{lqip, dimensions}}},
    "titelbildOrFallback": coalesce(titelbild, videos[0].thumbnail),
    zeitraum,
    ist_featured,
    reihenfolge,
    veroeffentlichung,
    "exponatCount": count(exponate)
  }`;

  return await client.fetch(query);
}

export async function getAusstellung(id) {
  const query = `*[_type == "ausstellung" && (_id == $id || slug.current == $id)][0]{
    _id,
    titel,
    untertitel,
    slug,
    kurzbeschreibung,
    beschreibung,
    titelbild{..., asset->{_id, metadata{lqip, dimensions}}},
    "titelbildOrFallback": coalesce(titelbild, videos[0].thumbnail),
    galerie[]{..., asset->{_id, metadata{lqip, dimensions}}},
    videos,
    dokumente,
    "exponate": exponate[]->{
      _id,
      inventarnummer,
      titel,
      untertitel,
      kurzbeschreibung,
      hauptbild{..., asset->{_id, metadata{lqip, dimensions}}},
      "kategorie": kategorie->{_id, titel, slug, icon, farbe},
      ist_highlight,
      reihenfolge
    },
    "highlight_exponate": highlight_exponate[]->{
      _id,
      inventarnummer,
      titel,
      untertitel,
      kurzbeschreibung,
      beschreibung,
      hauptbild{..., asset->{_id, metadata{lqip, dimensions}}},
      bilder[]{..., asset->{_id, metadata{lqip, dimensions}}},
      "kategorie": kategorie->{_id, titel, slug, icon, farbe},
      datierung,
      herstellung,
      physisch,
      tags,
      ist_highlight
    },
    "kategorien": kategorien[]->{_id, titel, slug, icon, farbe},
    zeitraum,
    organisation,
    veranstaltungen,
    tags,
    ist_featured,
    reihenfolge,
    veroeffentlichung
  }`;

  return await client.fetch(query, { id });
}

// Kiosk Config (now pulls from kioskDevice + ausstellung)
export async function getKioskConfig(identifier) {
  // identifier is usually the kioskId (e.g. RPI_01)
  const query = `*[_type == "kioskDevice" && (
    kioskId == $identifier ||
    hostname == $identifier ||
    _id == $identifier
  )][0]{
    _id,
    kioskId,
    hostname,
    location,
    "name": kioskId,
    "standort": location,
    "modus": ausstellung->kioskTemplate.template,
    "konfiguration": {
      "video_settings": {
        "playlist": ausstellung->videos[]{
          "typ": "video",
          "video": videodatei{
            asset->{
              _id,
              url,
              originalFilename,
              size,
              mimeType
            }
          },
          "titel": videotitel,
          "beschreibung": beschreibung,
          "dauer": dauer,
          "untertitel": untertitel{
            asset->{
              _id,
              url
            }
          },
          "bild": thumbnail{
            asset->{
              _id,
              url,
              metadata{lqip, dimensions}
            }
          }
        },
        "loop": ausstellung->kioskTemplate.videoSettings.loop,
        "shuffle": ausstellung->kioskTemplate.videoSettings.shuffle,
        "zeige_overlay": ausstellung->kioskTemplate.videoSettings.zeige_overlay,
        "overlay_position": ausstellung->kioskTemplate.videoSettings.overlay_position,
        "uebergang": ausstellung->kioskTemplate.videoSettings.uebergang,
        "zeige_untertitel": ausstellung->kioskTemplate.videoSettings.zeige_untertitel,
        "audio": {
          "lautstaerke": ausstellung->kioskTemplate.videoSettings.lautstaerke
        }
      },
      "slideshow_settings": ausstellung->kioskTemplate.slideshowSettings,
      "explorer_settings": ausstellung->kioskTemplate.explorerSettings,
      "reader_settings": ausstellung->kioskTemplate.readerSettings
    },
    "design": {
      "theme": "default"
    },
    "funktionen": {
      "zeige_qr_codes": true,
      "idle_timeout": 300
    }
  }`;

  return await client.fetch(query, { identifier });
}

// Alias for backward compatibility
export const getKioskConfigByIdentifier = getKioskConfig;

// Get file URL helper
export function fileUrl(ref) {
  if (!ref || !ref.asset) return null;
  const [_file, id, extension] = ref.asset._ref.split('-');
  return `https://cdn.sanity.io/files/${projectId}/${dataset}/${id}.${extension}`;
}

// Real-time subscription (for live updates)
export function subscribeToExponate(callback) {
  const query = '*[_type == "exponat"]';

  return client.listen(query).subscribe(update => {
    callback(update);
  });
}
