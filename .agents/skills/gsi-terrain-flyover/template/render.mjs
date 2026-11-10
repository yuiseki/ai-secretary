// Render a shot list (JSON) to PNG frames and an mp4.
//   node render.mjs shots/example.json [--out out/example] [--fps 30] [--size 1920x1080]
//                   [--stills 1.5]   only one frame every 1.5 s (preview, no mp4)
//                   [--from 3 --to 8]  render part of the timeline
//                   [--no-voice]     skip VOICEVOX; time the lines from their length (draft)
// Needs ffmpeg on PATH for the mp4. Frames are kept in <out>/frames.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { prepareNarration } from './voice.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const specPath = args.find((a) => a.endsWith('.json'));
if (!specPath) { console.error('usage: node render.mjs <shots.json> [--out dir] [--fps n] [--size WxH] [--stills sec] [--from s --to s]'); process.exit(2); }

const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const [w, h] = (opt('size', `${spec.width ?? 1920}x${spec.height ?? 1080}`)).split('x').map(Number);
spec.width = w; spec.height = h;
const fps = Number(opt('fps', spec.fps ?? 30));
const out = path.resolve(opt('out', path.join('out', path.basename(specPath, '.json'))));
const stills = opt('stills');
// frames from an earlier run would leak into the video or the stills sheet
fs.rmSync(path.join(out, 'frames'), { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'frames'), { recursive: true });

// Narration first: it decides how long each shot with "lines" lasts and adds the subtitles.
const narration = await prepareNarration(spec, out, { noVoice: args.includes('--no-voice') });
if (narration.credits.length) console.log('credits:', narration.credits.join(' / '), `(also in ${path.join(out, 'credits.txt')})`);

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.map': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

// An X11 DISPLAY inherited over SSH can freeze headless WebGL; drop it for the browser.
const env = { ...process.env }; delete env.DISPLAY; delete env.WAYLAND_DISPLAY;
// gl-egl reaches the NVIDIA GPU in headless mode; the default falls back to SwiftShader (CPU), which
// is far too slow for terrain. FLYOVER_GL=swiftshader forces the CPU path on machines without a GPU.
const GL = process.env.FLYOVER_GL === 'swiftshader'
  ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  : ['--use-gl=angle', '--use-angle=gl-egl', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ env, args: GL });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', (e) => console.error('[page]', e.message));
await page.goto(`http://127.0.0.1:${port}/page/index.html`);
await page.waitForFunction(() => window.FLY_READY === true);
console.log('webgl:', await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : String(!!g); }));
const first = await page.evaluate((s) => window.FLY.init(s), spec);
if (first === 'timeout') console.error('warning: first load did not settle (tiles still loading?)');

const total = await page.evaluate(() => window.FLY.totalSeconds());
const from = Number(opt('from', 0)), to = Math.min(total, Number(opt('to', total)));
const step = stills ? Number(stills) : 1 / fps;
const times = [];
for (let s = from; s < to - 1e-9; s += step) times.push(s);
let timeouts = 0;
const t0 = Date.now();
for (let i = 0; i < times.length; i++) {
  const r = await page.evaluate((s) => window.FLY.frame(s), times[i]);
  if (r === 'timeout') timeouts++;
  // JPEG, not PNG: PNG encoding of a 1920x1080 screenshot took 428 ms of one CPU core per frame
  // (the GPU drawing and tile wait took 37 ms); JPEG q95 takes about 55 ms.
  await page.screenshot({ path: path.join(out, 'frames', String(i).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 95 });
  if (i % 30 === 0) process.stdout.write(`\r${i + 1}/${times.length} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
process.stdout.write(`\r${times.length}/${times.length} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
await browser.close();
server.close();
if (timeouts) console.error(`warning: ${timeouts} frame(s) were captured before all tiles loaded`);

if (stills) {
  const sheet = path.join(out, 'stills.jpg');
  const cols = Math.min(4, times.length);
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(out, 'frames', '%05d.jpg'), '-vf', `scale=480:-1,tile=${cols}x${Math.ceil(times.length / cols)}`, '-frames:v', '1', sheet], { stdio: 'inherit' });
  console.log(`stills: ${sheet}`);
} else {
  const mp4 = path.join(out, path.basename(out) + '.mp4');
  const partial = from > 0 || to < total;
  const ff = ['-v', 'error', '-y', '-framerate', String(fps), '-i', path.join(out, 'frames', '%05d.jpg')];
  let audio = [];
  if (narration.wav && !partial) {
    // Voice (+ BGM, lowered and looped) mixed, then normalized to -14 LUFS (YouTube) in two passes:
    // one-pass loudnorm landed at -15.0 LUFS on a 16 s test clip.
    const inputs = ['-i', narration.wav];
    if (spec.bgm?.src) inputs.push('-stream_loop', '-1', '-i', path.resolve(spec.bgm.src));
    // v, b: input indices of the voice and the BGM in the ffmpeg command at hand
    const mixFilter = (v, b) => spec.bgm?.src
      ? `[${b}:a]volume=${spec.bgm.volume ?? 0.12}[b];[${v}:a][b]amix=inputs=2:duration=first:normalize=0`
      : `[${v}:a]anull`;
    const mix = mixFilter(0, 1);
    const target = 'I=-14:TP=-1.5:LRA=11';
    const m = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...inputs, '-filter_complex', `${mix},loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
    const j = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf('{'), m.stderr.lastIndexOf('}') + 1));
    const second = `loudnorm=${target}:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
    ff.push(...inputs);
    audio = ['-filter_complex', `${mixFilter(1, 2)},${second}[a]`, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];  // stereo: some players drop or one-side mono AAC
  } else if (narration.wav) {
    console.error('note: --from/--to renders the picture only (no audio)');
  }
  const r = spawnSync('ffmpeg', [...ff, ...audio, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18',
    // cap the peaks: uncapped CRF hit 46 Mbps and players stalled mid-video; level 4.1 + 2 s GOP play everywhere
    '-maxrate', '20M', '-bufsize', '40M', '-profile:v', 'high', '-level:v', '4.1', '-g', String(fps * 2), '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  if (r.status !== 0) { console.error('ffmpeg failed'); process.exit(1); }
  console.log(`video: ${mp4}`);
}
