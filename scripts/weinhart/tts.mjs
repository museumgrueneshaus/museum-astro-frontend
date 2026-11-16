// Erzeugt die Audiodateien 00–05 aus daten.json mit einer Neural-TTS.
// Anbieter per env: TTS=elevenlabs (Standard) oder TTS=openai.
//   ELEVENLABS_VOICE=<voice_id> node --env-file=.env.local scripts/weinhart/tts.mjs   (Key steht in .env.local)
//   Stimme bisher: George JBFqnCBsd6RMkjVDRZzb, Modell eleven_v4_turbo. Free-Tier nur mp3_44100_128 (ELEVENLABS_FORMAT).
//   TTS=openai OPENAI_API_KEY=… node scripts/weinhart/tts.mjs
//   TTS=say node scripts/weinhart/tts.mjs   (macOS-Stimmen, nur als Probe)
// Optional: NUR=01,04 nur einzelne Stationen, SPRACHEN=de,en nur einzelne Sprachen.
// Ergebnis: audio/<sprache>/NN.m4a (mono, AAC 128k, -16 LUFS).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT = join(DIR, 'audio');
const RAW = join(DIR, 'audio', 'roh');
const TTS = process.env.TTS || 'elevenlabs';
const NUR = process.env.NUR?.split(',').map(s => s.trim().padStart(2, '0'));
const ANWEISUNG = {
  de: 'Deutsch, ruhige Museumsführung. Sachlich und warm, langsames Tempo, kurze Pausen nach Sätzen. Kein Verkaufston.',
  en: 'British-neutral English, calm museum guide. Factual and warm, unhurried, short pauses between sentences. Pronounce German names in German.',
  nl: 'Nederlands, rustige museumgids. Zakelijk en warm, rustig tempo, korte pauzes tussen zinnen. Duitse namen Duits uitspreken.',
  it: 'Italiano, guida museale calma. Sobria e calda, ritmo lento, brevi pause tra le frasi. Pronunciare i nomi tedeschi in tedesco.',
};

const daten = JSON.parse(await readFile(join(DIR, 'daten.json'), 'utf8'));
const SPRACHEN = process.env.SPRACHEN?.split(',') || daten.sprachen || ['de'];
const textOf = (o, l, deKey) => l === 'de' ? o[deKey] : o.i18n?.[l]?.audio_text;
const tracks = SPRACHEN.flatMap(l => [
  { l, nr: '00', text: textOf(daten.ausstellung, l, 'intro_audio_text') },
  ...daten.stationen.map(s => ({ l, nr: s.nr, text: textOf(s, l, 'audio_text') })),
]).filter(t => t.text && (!NUR || NUR.includes(t.nr)));

async function elevenlabs(text, l) {
  const key = process.env.ELEVENLABS_API_KEY;
  const voice = process.env.ELEVENLABS_VOICE;
  if (!key || !voice) throw new Error('ELEVENLABS_API_KEY und ELEVENLABS_VOICE setzen');
  const model = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${process.env.ELEVENLABS_FORMAT || 'mp3_44100_128'}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: model,
      // multilingual_v2 erkennt die Sprache selbst und lehnt language_code ab.
      ...(model === 'eleven_multilingual_v2' ? {} : { language_code: l }),
      voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.1, use_speaker_boost: true, speed: 0.95 },
    }),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

async function openai(text, l) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY setzen');
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: process.env.OPENAI_VOICE || 'sage',
      input: text,
      response_format: 'mp3',
      instructions: ANWEISUNG[l],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

// Probe ohne Schlüssel: Systemstimmen des Mac. Stimme je Sprache per SAY_DE, SAY_EN … änderbar.
const SAY = { de: 'Anna', en: 'Daniel', nl: 'Xander', it: 'Alice' };
function say(text, l) {
  const f = join(tmpdir(), `weinhart-say-${process.pid}.aiff`);
  execFileSync('say', ['-v', process.env[`SAY_${l.toUpperCase()}`] || SAY[l], '-r', '165', '-o', f, text]);
  return readFile(f);
}

const ENGINE = { elevenlabs, openai, say }[TTS];
if (!ENGINE) throw new Error(`Unbekannter Anbieter TTS=${TTS}`);

for (const t of tracks) {
  await mkdir(join(RAW, t.l), { recursive: true });
  await mkdir(join(OUT, t.l), { recursive: true });
  const raw = join(RAW, t.l, `${t.nr}.${TTS === 'say' ? 'aiff' : 'mp3'}`);
  const out = join(OUT, t.l, `${t.nr}.m4a`);
  process.stdout.write(`${t.l}/${t.nr} … `);
  await writeFile(raw, await ENGINE(t.text, t.l));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw,
    '-af', 'adelay=400|400,loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.8',
    '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out]);
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString());
  console.log(`${Math.floor(dur / 60)}:${String(Math.round(dur % 60)).padStart(2, '0')}`);
}
