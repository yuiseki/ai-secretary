// Browser side: builds a MapLibre map with GSI photo + terrain, and draws one frame at a time.
// render.mjs calls window.FLY.init(spec) once, then window.FLY.frame(sec) for every frame.
import { gsiToTerrarium, terrariumRGB, cameraAt, sliceLine, locate, fadeAlpha, countValue } from './lib.js';

const maplibregl = window.maplibregl;
let map, spec, overlayEl, tintEl, terrainSpec, lastRasterSig = '';

const BASES = {
  // 地理院タイル 全国最新写真(シームレス)。世界の低ズームは衛星モザイクで埋まっている
  // the photo paints open sea black where there is no picture; gsiclear turns that black transparent
  seamlessphoto: { tiles: ['gsiclear://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg'], maxzoom: 18,
    credit: '空中写真：国土地理院(地理院タイル「全国最新写真(シームレス)」)を加工' },
  std: { tiles: ['https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'], maxzoom: 18,
    credit: '地図：国土地理院(地理院タイル「標準地図」)を加工' },
  pale: { tiles: ['https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png'], maxzoom: 18,
    credit: '地図：国土地理院(地理院タイル「淡色地図」)を加工' },
  relief: { tiles: ['https://cyberjapandata.gsi.go.jp/xyz/relief/{z}/{x}/{y}.png'], minzoom: 5, maxzoom: 15,
    credit: '地図：国土地理院(地理院タイル「色別標高図」)を加工' },
  // 過去の空中写真。範囲と年代は場所ごとに違う。minzoom より引いたカメラでは何も出ない
  gazo1: { tiles: ['gsiclear://cyberjapandata.gsi.go.jp/xyz/gazo1/{z}/{x}/{y}.jpg'], minzoom: 10, maxzoom: 17,
    credit: '1974〜78年の空中写真：国土画像情報(カラー空中写真) 国土交通省 を加工' },
  ort_old10: { tiles: ['https://cyberjapandata.gsi.go.jp/xyz/ort_old10/{z}/{x}/{y}.png'], minzoom: 15, maxzoom: 17,
    credit: '1961〜69年の空中写真：国土地理院 を加工' },
  ort_USA10: { tiles: ['https://cyberjapandata.gsi.go.jp/xyz/ort_USA10/{z}/{x}/{y}.png'], minzoom: 15, maxzoom: 17,
    credit: '1945〜50年の空中写真：米軍撮影(国土地理院)を加工' },
  ort_riku10: { tiles: ['https://cyberjapandata.gsi.go.jp/xyz/ort_riku10/{z}/{x}/{y}.png'], minzoom: 15, maxzoom: 17,
    credit: '1936〜42年の空中写真：陸軍撮影(国土地理院)を加工' },
};
const rasterSource = (b) => ({ type: 'raster', tiles: b.tiles, tileSize: 256, minzoom: b.minzoom ?? 0, maxzoom: b.maxzoom });
// NASA Blue Marble (NASA GIBS, Web Mercator, up to z8). Used for the zoomed-out world views under the
// GSI photo; the GSI photo fades in as the camera zooms in (spec.worldFade, camera zoom).
const WORLDS = {
  bluemarble: { tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
    maxzoom: 8, credit: '衛星画像：NASA Blue Marble (海底地形つき、NASA GIBS 経由)' },
  'bluemarble-plain': { tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
    maxzoom: 8, credit: '衛星画像：NASA Blue Marble Next Generation (NASA GIBS 経由)' },
};
const DEMS = {
  // 地理院 標高タイル(基盤地図情報 数値標高モデル)。z14 まで。海と国外は 0 m にする
  gsi: { tiles: ['gsidem://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png'], maxzoom: 14,
    credit: '標高：国土地理院(地理院タイル「標高タイル」)を加工' },
};

function registerGsiDem() {
  maplibregl.addProtocol('gsidem', async (params, abort) => {
    const url = params.url.replace('gsidem://', 'https://');
    const res = await fetch(url, { signal: abort.signal });
    const canvas = new OffscreenCanvas(256, 256);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const out = ctx.createImageData(256, 256);
    if (res.ok) {
      const bmp = await createImageBitmap(await res.blob());
      ctx.drawImage(bmp, 0, 0);
      const src = ctx.getImageData(0, 0, 256, 256).data;
      for (let i = 0; i < src.length; i += 4) {
        const [r, g, b] = terrariumRGB(gsiToTerrarium(src[i], src[i + 1], src[i + 2]));
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
      }
    } else {
      // 404 = outside the tiled area: flat 0 m
      for (let i = 0; i < out.data.length; i += 4) { out.data[i] = 128; out.data[i + 3] = 255; }
    }
    ctx.putImageData(out, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return { data: await blob.arrayBuffer() };
  });
}

// Old photo tiles in JPEG paint "no data" black (sea, gaps between flights). Make near-black transparent
// so the current photo shows through instead of black holes.
function registerClearBlack() {
  maplibregl.addProtocol('gsiclear', async (params, abort) => {
    const res = await fetch(params.url.replace('gsiclear://', 'https://'), { signal: abort.signal });
    if (!res.ok) {
      // 404 = no old photo here: an empty (transparent) tile, not an error
      const empty = new OffscreenCanvas(256, 256);
      empty.getContext('2d'); // convertToBlob needs a context, even for a blank tile
      return { data: await (await empty.convertToBlob({ type: 'image/png' })).arrayBuffer() };
    }
    const bmp = await createImageBitmap(await res.blob());
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
    const d = img.data;
    // "no data" is pure black in old photos and flat gray (52,52,52) in the low-zoom world mosaic
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      if ((r < 10 && g < 10 && b < 10) || (Math.abs(r - 52) <= 3 && Math.abs(g - 52) <= 3 && Math.abs(b - 52) <= 3)) d[i + 3] = 0;
    }
    ctx.putImageData(img, 0, 0);
    return { data: await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer() };
  });
}

const IMAGES = {};
const tile2lng = (x, z) => (x / 2 ** z) * 360 - 180;
const tile2lat = (y, z) => { const n = Math.PI - (2 * Math.PI * y) / 2 ** z; return (180 / Math.PI) * Math.atan(Math.sinh(n)); };
function registerImageTiles() {
  maplibregl.addProtocol('imgtile', async (params) => {
    const [, id, z, x, y] = params.url.match(/^imgtile:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/).map((v, i) => (i > 1 ? Number(v) : v));
    const im = IMAGES[id];
    im.bitmap ??= fetch(im.src).then((r) => { if (!r.ok) throw new Error(`image ${im.src}: HTTP ${r.status}`); return r.blob(); }).then(createImageBitmap);
    const bmp = await im.bitmap;
    const [w, s, e, n] = im.bbox;
    const tw = tile2lng(x, z), te = tile2lng(x + 1, z), tn = tile2lat(y, z), ts = tile2lat(y + 1, z);
    const canvas = new OffscreenCanvas(256, 256);
    const ctx = canvas.getContext('2d');
    // where the picture's corners fall in this tile's pixel space
    const px = (lng) => ((lng - tw) / (te - tw)) * 256;
    const py = (lat) => ((tn - lat) / (tn - ts)) * 256;
    if (!(e < tw || w > te || n < ts || s > tn)) ctx.drawImage(bmp, px(w), py(n), px(e) - px(w), py(s) - py(n));
    return { data: await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer() };
  });
}

function overlayLayers(shots) {
  // Every map-anchored overlay of every shot gets its own layer, hidden until its shot.
  // Base swaps (type "base") go under the hillshade; lines and polygons on top.
  const sources = {}, layers = [], baseLayers = [], credits = new Set();
  shots.forEach((s, si) => (s.overlays || []).forEach((o, oi) => {
    const id = `ov-${si}-${oi}`;
    if (o.type === 'base') {
      const b = BASES[o.layer];
      if (!b) throw new Error(`unknown base layer: ${o.layer}`);
      sources['b-' + o.layer] = rasterSource(b);
      credits.add(b.credit);
      baseLayers.push({ id, type: 'raster', source: 'b-' + o.layer, layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0, 'raster-fade-duration': 0, 'raster-saturation': o.saturation ?? 0 } });
    } else if (o.type === 'image') {
      // A georeferenced picture (own mosaic of old photos, a drawn plan ...), bbox [west, south, east, north].
      // MapLibre 5.24 does not draw "image" sources when terrain is on, so the picture is served as raster
      // tiles cut in the browser (imgtile protocol). North-up pictures only; latitude is mapped linearly.
      IMAGES[id] = { src: '/' + o.src.replace(/^\/+/, ''), bbox: o.bbox };
      sources[id] = { type: 'raster', tiles: [`imgtile://${id}/{z}/{x}/{y}`], tileSize: 256, maxzoom: o.maxzoom ?? 18 };
      baseLayers.push({ id, type: 'raster', source: id, layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 } });
      if (o.credit) credits.add(o.credit);
    } else if (o.type === 'line') {
      sources[id] = { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: o.coords } } };
      layers.push({ id: id + '-casing', type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
        paint: { 'line-color': '#ffffff', 'line-width': (o.width ?? 6) + 4, 'line-opacity': 0.9 } });
      layers.push({ id, type: 'line', source: id, layout: { 'line-cap': 'round', 'line-join': 'round', visibility: 'none' },
        paint: { 'line-color': o.color ?? '#4aa3ff', 'line-width': o.width ?? 6 } });
    } else if (o.type === 'polygon') {
      sources[id] = { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [o.coords] } } };
      layers.push({ id: id + '-fill', type: 'fill', source: id, layout: { visibility: 'none' },
        paint: { 'fill-color': o.fill ?? '#4aa3ff', 'fill-opacity': o.fillOpacity ?? 0.35 } });
      layers.push({ id, type: 'line', source: id, layout: { 'line-join': 'round', visibility: 'none' },
        paint: { 'line-color': o.outline ?? '#ffffff', 'line-width': o.width ?? 4 } });
    }
  }));
  return { sources, layers, baseLayers, credits: [...credits] };
}

function buildStyle() {
  const base = BASES[spec.base ?? 'seamlessphoto'];
  const dem = DEMS[spec.dem ?? 'gsi'];
  const world = spec.world === false ? null : WORLDS[spec.world ?? 'bluemarble'];
  const [wf0, wf1] = spec.worldFade ?? [5.5, 7];
  // GSI photo opacity by camera zoom: 0 below wf0 (world image only), 1 above wf1
  const gsiOpacity = world ? ['interpolate', ['linear'], ['zoom'], wf0, 0, wf1, 1] : 1;
  const ov = overlayLayers(spec.shots);
  return {
    version: 8,
    sources: {
      base: rasterSource(base),
      // the same photo capped at z12, drawn underneath: fills open sea where the detailed tiles have no picture
      baselo: { ...rasterSource(base), maxzoom: Math.min(12, base.maxzoom) },
      ...(world ? { world: rasterSource(world) } : {}),
      dem: { type: 'raster-dem', tiles: dem.tiles, tileSize: 256, maxzoom: dem.maxzoom, encoding: 'terrarium' },
      // a second source for the hillshade: MapLibre warns that sharing the terrain source lowers quality
      demshade: { type: 'raster-dem', tiles: dem.tiles, tileSize: 256, maxzoom: dem.maxzoom, encoding: 'terrarium' },
      ...ov.sources,
    },
    layers: [
      // shows through where no picture exists at any zoom (far open sea): a dark sea blue like the world mosaic
      { id: 'bg', type: 'background', paint: { 'background-color': spec.background ?? '#10243a' } },
      ...(world ? [{ id: 'world', type: 'raster', source: 'world', paint: { 'raster-fade-duration': 0 } }] : []),
      { id: 'baselo', type: 'raster', source: 'baselo', paint: { 'raster-saturation': spec.saturation ?? -0.1, 'raster-contrast': spec.contrast ?? 0.08, 'raster-fade-duration': 0, 'raster-opacity': gsiOpacity } },
      { id: 'base', type: 'raster', source: 'base', paint: { 'raster-saturation': spec.saturation ?? -0.1, 'raster-contrast': spec.contrast ?? 0.08, 'raster-fade-duration': 0, 'raster-opacity': gsiOpacity } },
      ...ov.baseLayers,
      ...(spec.hillshade === false ? [] : [{ id: 'shade', type: 'hillshade', source: 'demshade',
        paint: { 'hillshade-exaggeration': spec.hillshade ?? 0.25, 'hillshade-shadow-color': '#0a1020', 'hillshade-highlight-color': '#ffffff' } }]),
      ...ov.layers,
    ],
    terrain: { source: 'dem', exaggeration: spec.exaggeration ?? 1.3 },
    sky: spec.sky ?? { 'sky-color': '#6f9fd6', 'horizon-color': '#dce8f5', 'fog-color': '#c9d8e8',
      'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.85, 'atmosphere-blend': 0 },
    credits: [base.credit, ...(world ? [world.credit] : []), ...ov.credits, dem.credit],
  };
}

function settle(timeoutMs = 40000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    map.once('idle', () => { clearTimeout(timer); resolve('idle'); });
    map.triggerRepaint();
  });
}

function keysOf(shot) {
  if (shot.keys) return shot.keys;
  const from = shot.from ?? shot.to, to = shot.to ?? shot.from;
  return [{ t: 0, ...from }, { t: 1, ...to }];
}

function el(cls, html, style = {}) {
  const d = document.createElement('div');
  d.className = 'o ' + cls;
  d.innerHTML = html;
  Object.assign(d.style, style);
  overlayEl.appendChild(d);
  return d;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function drawOverlays(si, shot, t, pass) {
  if (pass === 'dom') overlayEl.textContent = '';
  // hide every map overlay, then show this shot's
  if (pass === 'map') spec.shots.forEach((s, i) => (s.overlays || []).forEach((o, oi) => {
    if (!['line', 'polygon', 'base', 'image'].includes(o.type)) return;
    const id = `ov-${i}-${oi}`;
    const ids = o.type === 'line' ? [id, id + '-casing'] : o.type === 'polygon' ? [id, id + '-fill'] : [id];
    ids.forEach((lid) => map.setLayoutProperty(lid, 'visibility', i === si ? 'visible' : 'none'));
  }));
  let tint = shot.tint ?? 0;
  (shot.overlays || []).forEach((o, oi) => {
    const a = fadeAlpha(o.show, t, o.fade ?? 0.06);
    const id = `ov-${si}-${oi}`;
    const isMap = ['line', 'polygon', 'base', 'image'].includes(o.type);
    if (isMap !== (pass === 'map')) { if (o.type === 'chapter' && pass === 'map') tint = Math.max(tint, 0.55 * a); return; }
    if (o.type === 'base' || o.type === 'image') {
      map.setPaintProperty(id, 'raster-opacity', a);
    } else if (o.type === 'line') {
      const frac = o.draw ? Math.min(1, Math.max(0, (t - o.draw[0]) / (o.draw[1] - o.draw[0]))) : 1;
      map.getSource(id).setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: sliceLine(o.coords, frac) } });
      map.setPaintProperty(id, 'line-opacity', a);
      map.setPaintProperty(id + '-casing', 'line-opacity', a * 0.9);
    } else if (o.type === 'polygon') {
      map.setPaintProperty(id, 'line-opacity', a);
      map.setPaintProperty(id + '-fill', 'fill-opacity', a * (o.fillOpacity ?? 0.35));
    } else if (o.type === 'label') {
      let pos;
      if (o.at) { const p = map.project(o.at); pos = { left: p.x / scale() + 'px', top: p.y / scale() + 'px' }; }
      else pos = { left: o.screen[0] + 'px', top: o.screen[1] + 'px' };
      const html = (o.dot ? '<span class="dot"></span>' : '') + esc(o.text);
      el('label' + (o.style === 'tag' ? ' tag' : ''), html, { ...pos, opacity: a });
    } else if (o.type === 'counter') {
      const [x, y] = o.screen ?? [60, 120];
      el('counter', (o.caption ? `<span class="cap">${esc(o.caption)}</span>` : '') +
        (o.prefix ? `<span class="pre">${esc(o.prefix)}</span>` : '') +
        `<span class="num">${esc(countValue(o, t))}</span>` + (o.unit ? `<span class="unit">${esc(o.unit)}</span>` : ''),
        { left: x + 'px', top: y + 'px', opacity: a });
    } else if (o.type === 'chapter') {
      tint = Math.max(tint, 0.55 * a);
      el('chapter', (o.kicker ? `<span class="kicker">${esc(o.kicker)}</span>` : '') + `<span class="title">${esc(o.text)}</span>`, { opacity: a });
    } else if (o.type === 'note') {
      el('note', esc(o.text), { opacity: a });
    } else if (o.type === 'quote') {
      // a news quote card: source and date on top, the quoted sentence below
      const [x, y] = o.screen ?? [70, 200];
      el('quote' + (o.marks === false ? ' plain' : ''), `<span class="src">${esc(o.source ?? '')}${o.date ? '　' + esc(o.date) : ''}</span>` +
        `<span class="q">${esc(o.text)}</span>`, { left: x + 'px', top: y + 'px', width: (o.width ?? 760) + 'px', opacity: a });
    } else if (o.type === 'panel') {
      // a figure (chart PNG, photo) on screen with a caption and its credit
      const [x, y] = o.screen ?? [1100, 160];
      el('panel', (o.caption ? `<span class="cap">${esc(o.caption)}</span>` : '') +
        `<img src="/${esc(o.src.replace(/^\/+/, ''))}">` + (o.credit ? `<span class="cr">${esc(o.credit)}</span>` : ''),
        { left: x + 'px', top: y + 'px', width: (o.width ?? 720) + 'px', opacity: a });
    } else if (o.type === 'subtitle') {
      el('subtitle', esc(o.text), { opacity: a, ...(o.color ? { color: o.color } : {}) });
    }
  });
  tintEl.style.opacity = tint;
  if (pass === 'dom') {
    const hasSub = (shot.overlays || []).some((o) => o.type === 'subtitle');
    document.getElementById('credit').style.bottom = hasSub ? '196px' : '16px';
  }
}

const scale = () => spec.width / 1920;

async function init(s) {
  spec = s;
  overlayEl = document.getElementById('overlay');
  tintEl = document.getElementById('tint');
  const stage = document.getElementById('stage');
  stage.style.transform = `scale(${scale()})`;
  // The map renders at output resolution; overlays are laid out on a 1920x1080 stage and scaled.
  const mapEl = document.getElementById('map');
  Object.assign(mapEl.style, { width: spec.width + 'px', height: spec.height + 'px', transform: `scale(${1 / scale()})`, transformOrigin: '0 0' });
  registerGsiDem();
  registerClearBlack();
  registerImageTiles();
  const style = buildStyle();
  document.getElementById('credit').textContent = [...style.credits, ...(spec.credits ?? [])].join('\n');
  delete style.credits;
  terrainSpec = style.terrain;
  const first = cameraAt(keysOf(spec.shots[0]), 0);
  map = new maplibregl.Map({
    container: 'map', style, center: first.center, zoom: first.zoom, pitch: first.pitch, bearing: first.bearing,
    maxPitch: 85, interactive: false, fadeDuration: 0, attributionControl: false,
    canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    pixelRatio: 1,
  });
  await new Promise((r) => map.once('load', r));
  return settle();
}

function rasterSignature(si, shot, t) {
  return si + ':' + (shot.overlays || []).map((o) => (o.type === 'image' || o.type === 'base') ? fadeAlpha(o.show, t, o.fade ?? 0.06).toFixed(3) : '').join(',');
}

async function frame(sec) {
  const { index, t } = locate(spec.shots, sec);
  const shot = spec.shots[index];
  const cam = cameraAt(keysOf(shot), t, shot.ease ?? 'inOut');
  map.jumpTo(cam);
  drawOverlays(index, shot, t, 'map');
  // Under terrain, MapLibre 5.24 keeps raster layers in a cached texture per terrain tile, and changing a
  // raster layer's visibility or opacity did not refresh it (freeRtt did not help either). Setting the
  // terrain again does. So re-set it whenever a raster overlay's opacity differs from the last frame.
  const sig = rasterSignature(index, shot, t);
  if (sig !== lastRasterSig) {
    lastRasterSig = sig;
    map.setTerrain(null);
    map.setTerrain(terrainSpec);
  }
  const r = await settle();
  // DOM overlays after the map settles: map.project needs the terrain tiles of this view
  drawOverlays(index, shot, t, 'dom');
  // panels: wait until their pictures are decoded, or the frame would catch an empty box
  await Promise.all([...overlayEl.querySelectorAll('img')].map((i) => i.decode().catch(() => console.error('panel image failed: ' + i.src))));
  return r;
}

function totalSeconds() { return spec.shots.reduce((a, s) => a + s.duration, 0); }

window.FLY = { init, frame, totalSeconds, get map() { return map; } };
window.FLY_READY = true;
