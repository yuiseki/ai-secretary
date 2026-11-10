// Narration: synthesize each shot's lines with VOICEVOX, stretch shots to fit, add subtitles,
// and write one narration WAV for the whole timeline. Used by render.mjs before drawing.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { layoutLines, wrapSubtitle, estimateSeconds } from './page/lib.js';

// Speaker colors for subtitles when a voice does not set one (yellow, then light red, ...).
const COLORS = ['#ffe94a', '#ff8f8f', '#8fd3ff', '#b8f28f'];

export function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('not a WAV file');
  let off = 12, fmt, data;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = { channels: buf.readUInt16LE(off + 10), rate: buf.readUInt32LE(off + 12), bits: buf.readUInt16LE(off + 22) };
    if (id === 'data') data = buf.subarray(off + 8, off + 8 + size);
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('WAV without fmt or data');
  if (fmt.bits !== 16 || fmt.channels !== 1) throw new Error(`expected 16-bit mono, got ${fmt.bits}-bit ${fmt.channels}ch`);
  const samples = new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length));
  return { rate: fmt.rate, samples, seconds: samples.length / fmt.rate };
}

export function writeWav(file, samples, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + samples.length * 2, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(samples.length * 2, 40);
  fs.writeFileSync(file, Buffer.concat([h, Buffer.from(samples.buffer, samples.byteOffset, samples.length * 2)]));
}

async function synth(tts, voice, text, cacheDir) {
  const params = { speaker: voice.speaker, text, speed: voice.speed ?? tts.speed ?? 1.25, pitch: voice.pitch ?? 0,
    intonation: voice.intonation ?? 1, volume: voice.volume ?? 1 };
  const key = crypto.createHash('sha1').update(JSON.stringify(params)).digest('hex').slice(0, 16);
  const file = path.join(cacheDir, key + '.wav');
  if (!fs.existsSync(file)) {
    const base = tts.url ?? 'http://127.0.0.1:50021';
    const q = await fetch(`${base}/audio_query?speaker=${params.speaker}&text=${encodeURIComponent(text)}`, { method: 'POST' });
    if (!q.ok) throw new Error(`VOICEVOX audio_query failed (${q.status}). Is the engine running at ${base}?`);
    const query = await q.json();
    Object.assign(query, { speedScale: params.speed, pitchScale: params.pitch, intonationScale: params.intonation,
      volumeScale: params.volume, prePhonemeLength: 0.05, postPhonemeLength: 0.05 });
    const s = await fetch(`${base}/synthesis?speaker=${params.speaker}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(query) });
    if (!s.ok) throw new Error(`VOICEVOX synthesis failed (${s.status})`);
    fs.writeFileSync(file, Buffer.from(await s.arrayBuffer()));
  }
  return parseWav(fs.readFileSync(file));
}

// Mutates spec: stretches shot durations, appends subtitle overlays, adds voice credits.
// Returns { wav, credits } (wav is null when noVoice).
export async function prepareNarration(spec, outDir, { noVoice = false } = {}) {
  const voices = spec.voices ?? {};
  const tts = spec.tts ?? {};
  const names = Object.keys(voices);
  const hasLines = spec.shots.some((s) => s.lines?.length);
  if (!hasLines) return { wav: null, credits: [] };
  const cacheDir = path.join(outDir, 'voice-cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  let rate = 24000;
  const placed = []; // { at: seconds on the timeline, samples }
  let t0 = 0;
  const used = new Set();
  for (const shot of spec.shots) {
    const lines = shot.lines ?? [];
    const clips = [];
    for (const ln of lines) {
      const vname = ln.voice ?? names[0];
      const voice = voices[vname];
      if (!voice) throw new Error(`unknown voice "${vname}" (define it under "voices")`);
      used.add(vname);
      if (noVoice) clips.push({ seconds: estimateSeconds(ln.text, tts.draftCps ?? 6.5) });
      else { const w = await synth(tts, voice, ln.speech ?? ln.text, cacheDir); rate = w.rate; clips.push(w); }
    }
    const lay = layoutLines(clips.map((c) => c.seconds), { duration: shot.duration ?? 0, padStart: tts.padStart ?? 0.3, pause: tts.pause ?? 0.25, padEnd: tts.padEnd ?? 0.4 });
    shot.duration = lay.duration;
    shot.overlays = shot.overlays ?? [];
    lines.forEach((ln, i) => {
      const vname = ln.voice ?? names[0];
      if (spec.subtitles !== false && shot.subtitles !== false)
        shot.overlays.push({ type: 'subtitle', text: wrapSubtitle(ln.text, tts.wrap ?? 26), show: lay.windows[i], fade: 0,
          color: voices[vname].color ?? COLORS[names.indexOf(vname) % COLORS.length] });
      if (clips[i].samples) placed.push({ at: t0 + lay.starts[i], samples: clips[i].samples });
    });
    t0 += shot.duration;
  }
  const credits = [...used].map((v) => `音声：VOICEVOX:${voices[v].name ?? v}`);
  spec.credits = [...(spec.credits ?? []), ...credits];
  fs.writeFileSync(path.join(outDir, 'credits.txt'), credits.join('\n') + '\n');
  if (noVoice) return { wav: null, credits };
  const total = new Int16Array(Math.ceil(t0 * rate) + 1);
  for (const p of placed) {
    const start = Math.round(p.at * rate);
    for (let i = 0; i < p.samples.length && start + i < total.length; i++) {
      total[start + i] = Math.max(-32768, Math.min(32767, total[start + i] + p.samples[i]));
    }
  }
  const wav = path.join(outDir, 'narration.wav');
  writeWav(wav, total, rate);
  return { wav, credits };
}
