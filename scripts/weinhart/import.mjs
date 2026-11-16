// Legt den Weinhart-Audioguide in Sanity an: Einführung + Exponate + Ausstellung.
// Ohne --schreiben läuft nur eine Probe (zeigt, was angelegt würde, lädt nichts hoch).
//   node --env-file=.env.local scripts/weinhart/import.mjs            → Probe
//   node --env-file=.env.local scripts/weinhart/import.mjs --schreiben → anlegen
// Wiederholbar: feste IDs (createOrReplace), Sanity erkennt gleiche Dateien am Hash.
// Audio: audio/<sprache>/NN.m4a, fehlende Sprachen werden übersprungen.
import { createClient } from '@sanity/client';
import { readFile, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const SCHREIBEN = process.argv.includes('--schreiben');
const token = process.env.SANITY_WRITE_TOKEN;
if (SCHREIBEN && !token) throw new Error('SANITY_WRITE_TOKEN setzen');

const client = createClient({
  projectId: '832k5je1', dataset: 'production', apiVersion: '2024-01-01', token, useCdn: false,
});
const d = JSON.parse(await readFile(join(DIR, 'daten.json'), 'utf8'));
const SPRACHEN = d.sprachen || ['de'];
const FREMD = SPRACHEN.filter(l => l !== 'de');

const exists = (p) => access(p).then(() => true, () => false);
// Zufallscodes der QR-Schilder (qr.py); ohne Datei bleibt die lesbare Kennung.
const codes = (await exists(join(DIR, 'codes.json'))) ? JSON.parse(await readFile(join(DIR, 'codes.json'), 'utf8')) : {};
const key = (s) => s.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'k';
const block = (text, k) => ({ _type: 'block', _key: k, style: 'normal', markDefs: [], children: [{ _type: 'span', _key: `${k}s`, text, marks: [] }] });
// Lesefassung für den Guide: Sprechtext ohne den gesprochenen Kopf („Station vier. Titel. Untertitel.“,
// steht im Guide schon als Überschrift) und mit den Schreibweisen, die nur für die Stimme ausgeschrieben wurden.
const SATZ = /(?<=[^\d][.?!])\s+/;
const saetze = (t) => (t ? t.trim().split(SATZ).length : 0);
const LESEN = {
  de: [['nach Christus', 'n. Chr.'], ['noch zwei Meilen', 'noch 2 Meilen'], ['Doktor Beneder', 'Dr. Beneder'],
    ['los“, so Goethe. So weit die Interpretation', 'los“ (Goethe) – so die Interpretation']],
  en: [['Doctor Beneder', 'Dr. Beneder']],
  nl: [['na Christus', 'n.Chr.'], ['Doctor Beneder', 'Dr. Beneder']],
  it: [['dopo Cristo', 'd.C.']],
  fr: [['après Jésus-Christ', 'apr. J.-C.'], ['de deux mille trois', 'de 2003'], ['Docteur Beneder', 'Dr Beneder'], ['docteur Beneder', 'Dr Beneder']],
};
function lesetext(text, titel, untertitel, l, mitKopf) {
  let t = text;
  if (mitKopf) t = t.trim().split(SATZ).slice(1 + saetze(titel) + saetze(untertitel)).join(' ');
  for (const [von, zu] of LESEN[l] || []) t = t.replace(von, zu);
  return t;
}
const dauer = (f) => {
  const s = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
};
async function upload(type, file) {
  if (!SCHREIBEN) return { _type: 'reference', _ref: `(probe) ${basename(file)}` };
  const a = await client.assets.upload(type, createReadStream(file), { filename: `weinhart-${basename(dirname(file))}-${basename(file)}` });
  return { _type: 'reference', _ref: a._id };
}

// Prüfen, ob der Slug schon von einem anderen Dokument belegt ist.
const fremd = await client.fetch(`*[_type=="ausstellung" && slug.current==$s && _id!="ausstellung-weinhart"][0]._id`, { s: d.ausstellung.slug });
if (fremd) throw new Error(`Slug „${d.ausstellung.slug}“ gehört schon zu ${fremd}`);

const A = d.ausstellung;
const eintraege = [
  { nr: '00', titel: 'Einführung', untertitel: A.titel, kurzbeschreibung: A.kurzbeschreibung, audio_text: A.intro_audio_text,
    i18n: Object.fromEntries(FREMD.map(l => [l, { titel: { en: 'Introduction', nl: 'Inleiding', it: 'Introduzione', fr: 'Introduction' }[l], untertitel: A.i18n[l].titel, kurzbeschreibung: A.i18n[l].kurzbeschreibung, audio_text: A.i18n[l].audio_text }])) },
  ...d.stationen,
];

// Einführung (00) hat keinen gesprochenen Kopf.
const lese = (s, l) => {
  const q = l === 'de' ? s : s.i18n[l];
  return lesetext(q.audio_text, q.titel, q.untertitel, l, s.nr !== '00');
};
const docs = [];
for (const s of eintraege) {
  const audio = [];
  for (const l of SPRACHEN) {
    const f = join(DIR, 'audio', l, `${s.nr}.m4a`);
    if (!(await exists(f))) { console.warn(`  fehlt: audio/${l}/${s.nr}.m4a`); continue; }
    audio.push({
      _type: 'file', _key: `audio${l}`, asset: await upload('file', f),
      sprache: l, dauer: dauer(f), transkript: lese(s, l),
    });
  }
  const en = s.i18n?.en || {};
  const guide = Object.fromEntries(FREMD.filter(l => s.i18n?.[l]).map(l => {
    const { audio_text, ...rest } = s.i18n[l];
    // Lesefassung auch ohne Tonspur, damit der Guide die Sprache schon zum Mitlesen anbietet.
    return [l, { ...rest, lesetext: lese(s, l) }];
  }));
  docs.push({
    _id: `exponat-weinhart-${s.nr}`,
    _type: 'exponat',
    titel: s.titel,
    untertitel: s.untertitel,
    kurzbeschreibung: s.kurzbeschreibung,
    beschreibung: [block(lese(s, 'de'), `b${s.nr}`)],
    titel_en: en.titel, untertitel_en: en.untertitel, kurzbeschreibung_en: en.kurzbeschreibung,
    beschreibung_en: en.audio_text ? [block(lese(s, 'en'), `e${s.nr}`)] : undefined,
    inventarnummer: `WH-${s.nr}`,
    slug: { _type: 'slug', current: `weinhart-${s.nr}` },
    qr_code: { _type: 'slug', current: codes[`weinhart-${s.nr}`] || `weinhart-${s.nr}` },
    tags: ['Weinhart'],
    datierung: s.jahr_text ? { jahr_text: s.jahr_text, ...(/^\d{4}$/.test(s.jahr_text) ? { jahr_von: +s.jahr_text, jahr_bis: +s.jahr_text } : {}) } : undefined,
    herstellung: s.material || s.ort ? { material: s.material || undefined, entstehungsort: s.ort || undefined } : undefined,
    physisch: s.masse ? { masse: s.masse } : undefined,
    organisation: s.ort ? { standort: s.ort } : undefined,
    hauptbild: s.bild ? { _type: 'image', asset: await upload('image', join(DIR, s.bild)), bildnachweis: s.bildnachweis } : undefined,
    audio,
    guide: Object.keys(guide).length ? guide : undefined,
    veroeffentlichung: { status: 'entwurf' },
  });
}

const ausstellung = {
  _id: 'ausstellung-weinhart',
  _type: 'ausstellung',
  titel: A.titel,
  untertitel: A.untertitel,
  slug: { _type: 'slug', current: A.slug },
  kurzbeschreibung: A.kurzbeschreibung,
  guide: Object.fromEntries(FREMD.map(l => { const { audio_text, ...r } = A.i18n[l]; return [l, r]; })),
  titelbild: docs[1].hauptbild ? { _type: 'image', asset: docs[1].hauptbild.asset } : undefined,
  exponate: docs.map(x => ({ _type: 'reference', _ref: x._id, _key: key(x._id) })),
  tags: ['Weinhart'],
  zeitraum: { typ: 'sonder' },
  veroeffentlichung: { status: 'entwurf' },
};

const strip = (o) => JSON.parse(JSON.stringify(o)); // entfernt undefined
if (!SCHREIBEN) {
  for (const x of docs) console.log(`${x._id}  ${x.titel}  Audio: ${x.audio.map(a => `${a.sprache} ${a.dauer}`).join(', ') || 'keins'}`);
  console.log(`${ausstellung._id}  ${ausstellung.titel}  ${ausstellung.exponate.length} Exponate`);
  console.log('\nProbe. Mit --schreiben anlegen.');
} else {
  const tx = client.transaction();
  [...docs, ausstellung].forEach(x => tx.createOrReplace(strip(x)));
  const r = await tx.commit();
  console.log(`angelegt: ${r.results.length} Dokumente`);
}
