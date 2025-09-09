import { createClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';

// Sanity Client
const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID || '832k5je1';
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production';

export const client = createClient({
  projectId,
  dataset,
  useCdn: true, // Use CDN for better performance
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
    hauptbild,
    bilder,
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
    hauptbild,
    bilder,
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

export async function getKioskConfig(mac = 'default') {
  const query = `*[_type == "kioskConfig" && (mac_adresse == $mac || name == "Default")] | order(mac_adresse desc) [0] {
    _id,
    name,
    standort,
    mac_adresse,
    modus,
    konfiguration,
    design,
    funktionen,
    aktiv
  }`;

  return await client.fetch(query, { mac });
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

// Real-time subscription (for live updates)
export function subscribeToExponate(callback) {
  const query = '*[_type == "exponat"]';
  
  return client.listen(query).subscribe(update => {
    callback(update);
  });
}
