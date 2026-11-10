// Pure helpers shared by the browser page and the node tests. No DOM, no MapLibre.

// GSI elevation PNG tiles (dem_png, dem5a_png ...): x = R*2^16 + G*2^8 + B,
// h = x*0.01 m when x < 2^23, h = (x - 2^24)*0.01 m when x > 2^23, x = 2^23 is no data.
// No data (sea, outside Japan) becomes 0 m so the terrain has no spikes.
export function gsiToTerrarium(r, g, b) {
  const x = r * 65536 + g * 256 + b;
  if (x === 8388608) return 0;
  const h = x < 8388608 ? x * 0.01 : (x - 16777216) * 0.01;
  return Math.round(h * 100) / 100;
}

// Terrarium encoding used by MapLibre raster-dem (encoding: "terrarium").
export function terrariumRGB(h) {
  const v = h + 32768;
  const r = Math.floor(v / 256);
  const g = Math.floor(v) % 256;
  const b = Math.floor((v - Math.floor(v)) * 256);
  return [r, g, b];
}

export function ease(kind, t) {
  t = Math.min(1, Math.max(0, t));
  switch (kind) {
    case 'linear': return t;
    case 'in': return t * t * t;
    case 'out': return 1 - (1 - t) ** 3;
    case 'inOut':
    default: return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const unmercY = (y) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

// keys: [{t, center:[lng,lat], zoom, pitch, bearing}], t in 0..1 within the shot.
// Easing is applied to the whole shot, then keys are interpolated linearly.
export function cameraAt(keys, t, easing = 'inOut') {
  const e = ease(easing, t);
  if (keys.length === 1) return { ...keys[0] };
  let i = 0;
  while (i < keys.length - 2 && e > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  const u = b.t === a.t ? 1 : Math.min(1, Math.max(0, (e - a.t) / (b.t - a.t)));
  let db = (b.bearing ?? 0) - (a.bearing ?? 0);
  db = ((db + 540) % 360) - 180;
  return {
    center: [lerp(a.center[0], b.center[0], u), unmercY(lerp(mercY(a.center[1]), mercY(b.center[1]), u))],
    zoom: lerp(a.zoom, b.zoom, u),
    pitch: lerp(a.pitch ?? 0, b.pitch ?? 0, u),
    bearing: (a.bearing ?? 0) + db * u,
  };
}

// First `frac` of a polyline by planar length (fine for the short lines drawn on a map).
export function sliceLine(coords, frac) {
  if (frac <= 0) return [coords[0], coords[0]];
  if (frac >= 1) return coords;
  const seg = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
    seg.push(d);
    total += d;
  }
  let left = total * frac;
  const out = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    if (left >= seg[i - 1]) { out.push(coords[i]); left -= seg[i - 1]; continue; }
    const u = left / seg[i - 1];
    out.push([lerp(coords[i - 1][0], coords[i][0], u), lerp(coords[i - 1][1], coords[i][1], u)]);
    break;
  }
  return out;
}

export function locate(shots, sec) {
  let start = 0;
  for (let i = 0; i < shots.length; i++) {
    const d = shots[i].duration;
    if (sec < start + d || i === shots.length - 1) {
      const local = Math.min(d, Math.max(0, sec - start));
      return { index: i, t: local / d, sec: local };
    }
    start += d;
  }
  return { index: 0, t: 0, sec: 0 };
}

// window [t0, t1] in shot progress; fade is the ramp length in the same units.
export function fadeAlpha(win, t, fade = 0.08) {
  if (!win) return 1;
  const [t0, t1] = win;
  if (t < t0 || t > t1) return 0;
  const inA = fade > 0 ? Math.min(1, (t - t0) / fade) : 1;
  const outA = fade > 0 && t1 < 1 ? Math.min(1, (t1 - t) / fade) : 1;
  return Math.max(0, Math.min(inA, outA));
}

export function countValue(o, t) {
  if (typeof o.value !== 'number') return String(o.value);
  const d = o.decimals ?? 0;
  let v = o.value;
  if (o.countUp) {
    const [t0, t1] = o.countUp;
    const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const from = o.from ?? 0;
    v = from + (o.value - from) * (o.countEase === 'linear' ? u : ease('out', u));
  }
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: o.grouping ?? true });
}

// One subtitle = one spoken line. Keep it to two rows: split a long line at the punctuation
// closest to the middle (or at the middle when there is none). Existing line breaks are kept.
export function wrapSubtitle(text, max = 26) {
  if (text.includes('\n') || [...text].length <= max) return text;
  const chars = [...text];
  const mid = chars.length / 2;
  let best = -1;
  chars.forEach((c, i) => {
    if ('、。，,！？!?」）)'.includes(c) && i < chars.length - 1) {
      if (best < 0 || Math.abs(i + 1 - mid) < Math.abs(best - mid)) best = i + 1;
    }
  });
  if (best < 0 || Math.abs(best - mid) > chars.length * 0.3) best = Math.floor(mid);
  return chars.slice(0, best).join('') + '\n' + chars.slice(best).join('');
}

// Lay spoken lines (their audio seconds) out in a shot: padStart, line, pause, line, ..., padEnd.
// The shot is stretched when the lines need more time than `duration`. Subtitle windows are in
// shot progress (0..1); each subtitle stays until the next line starts, the last one to the end.
export function layoutLines(secs, { duration = 0, padStart = 0.3, pause = 0.25, padEnd = 0.4 } = {}) {
  if (!secs.length) return { duration, starts: [], windows: [] };
  const starts = [];
  let t = padStart;
  secs.forEach((s, i) => { starts.push(round6(t)); t += s + (i < secs.length - 1 ? pause : 0); });
  const need = round6(t + padEnd);
  const d = Math.max(duration, need);
  const windows = starts.map((s, i) => [s / d, i < starts.length - 1 ? starts[i + 1] / d : 1]);
  return { duration: d, starts, windows };
}
const round6 = (x) => Math.round(x * 1e6) / 1e6;

// Rough speech time for drafts without a voice engine (characters per second, punctuation ignored).
export function estimateSeconds(text, cps = 6.5) {
  const n = [...text.replace(/[\s、。，,．.！？!?「」『』（）()…・]/g, '')].length;
  return Math.round((n / cps) * 100) / 100;
}

// ---- motion graphics helpers (everything is a function of time, so frames are reproducible) ----

// Seconds since an overlay's window opened and until it closes. A window that runs to the end of the
// shot never "leaves" (the cut ends it), so exits are only animated for windows closing inside the shot.
export function phase(win, t, duration) {
  const [t0, t1] = win ?? [0, 1];
  const r9 = (x) => Math.round(x * 1e9) / 1e9;
  return { since: r9((t - t0) * duration), until: t1 >= 1 ? Infinity : r9((t1 - t) * duration), on: t >= t0 && t <= t1 };
}

export function easeOutBack(x) {
  const c1 = 1.70158, c3 = c1 + 1;
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

// How many characters of a typewriter reveal are visible after `since` seconds at `cps` chars/second.
export function typeCount(text, since, cps = 28) {
  return Math.max(0, Math.min([...text].length, Math.floor(since * cps + 1e-9)));
}

// A line chart's geometry: points ([YYYY-MM, value]) into a w x h box with padding [top, right, bottom, left].
// Returns pixel points, cumulative lengths along the line and the total length (for draw-on animation).
export function chartGeometry(points, { w, h, pad = [20, 20, 40, 60], ymin, ymax }) {
  const day = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, 1) / 86400000;
  const xs = points.map((p) => day(p[0])), ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const lo = ymin ?? Math.min(...ys), hi = ymax ?? Math.max(...ys);
  const [pt, pr, pb, pl] = pad;
  const pts = xs.map((x, i) => [pl + ((x - x0) / (x1 - x0 || 1)) * (w - pl - pr), pt + (1 - (ys[i] - lo) / (hi - lo || 1)) * (h - pt - pb)]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, length: cum[cum.length - 1], lo, hi, plot: { x: pl, y: pt, w: w - pl - pr, h: h - pt - pb } };
}
