// Browser side: builds a MapLibre map with GSI photo + terrain, and draws one frame at a time.
// render.mjs calls window.FLY.init(spec) once, then window.FLY.frame(sec) for every frame.
import { gsiToTerrarium, terrariumRGB, cameraAt, sliceLine, locate, fadeAlpha, countValue, phase, easeOutBack, ease, typeCount, chartGeometry, mouthOpenAt, blinkAt, reactionAt } from './lib.js';

const maplibregl = window.maplibregl;
let map, spec, overlayEl, tintEl, terrainSpec, lastRasterSig = '', nowSec = 0;

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
    ...(spec.osmLabels ? { glyphs: 'https://tile.yuiseki.net/fonts/{fontstack}/{range}.pbf' } : {}),
    sources: {
      base: rasterSource(base),
      // the same photo capped at z12, drawn underneath: fills open sea where the detailed tiles have no picture
      baselo: { ...rasterSource(base), maxzoom: Math.min(12, base.maxzoom) },
      ...(world ? { world: rasterSource(world) } : {}),
      dem: { type: 'raster-dem', tiles: dem.tiles, tileSize: 256, maxzoom: dem.maxzoom, encoding: 'terrarium' },
      // a second source for the hillshade: MapLibre warns that sharing the terrain source lowers quality
      demshade: { type: 'raster-dem', tiles: dem.tiles, tileSize: 256, maxzoom: dem.maxzoom, encoding: 'terrarium' },
      ...(spec.osmLabels ? { osm: { type: 'vector', url: 'https://tile.yuiseki.net/data/v3.json' } } : {}),
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
      ...(spec.osmLabels ? osmLabelLayers() : []),
      ...ov.layers,
    ],
    terrain: { source: 'dem', exaggeration: spec.exaggeration ?? 1.3 },
    sky: spec.sky ?? { 'sky-color': '#6f9fd6', 'horizon-color': '#dce8f5', 'fog-color': '#c9d8e8',
      'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.85, 'atmosphere-blend': 0 },
    credits: [base.credit, ...(world ? [world.credit] : []), ...ov.credits, dem.credit,
      ...(spec.osmLabels ? ['地名：© OpenStreetMap contributors / OpenMapTiles（現代の地名）'] : [])],
  };
}

// Labels are current OSM data even when the background is a historic photograph.
function osmLabelLayers() {
  const text = ['coalesce', ['get', 'name:ja'], ['get', 'name'], ['get', 'name_en']];
  const paint = { 'text-color': '#ffffff', 'text-halo-color': '#192438', 'text-halo-width': 2,
    'text-halo-blur': 0.5 };
  const layout = { 'text-field': text, 'text-font': ['Noto Sans Regular'], 'text-max-width': 9 };
  return [
    { id: 'osm-place', type: 'symbol', source: 'osm', 'source-layer': 'place', minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'island']]],
      layout: { ...layout, 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 16, 15, 22] }, paint },
    { id: 'osm-water', type: 'symbol', source: 'osm', 'source-layer': 'waterway', minzoom: 12,
      layout: { ...layout, 'symbol-placement': 'line', 'text-size': 18 }, paint },
    { id: 'osm-station', type: 'symbol', source: 'osm', 'source-layer': 'poi', minzoom: 13,
      filter: ['==', ['get', 'class'], 'rail'],
      layout: { ...layout, 'text-size': 18 }, paint },
  ];
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
    } else {
      drawMotion(o, phase(o.show, t, shot.duration), t, a, (v) => { tint = Math.max(tint, v); });
    }
  });
  tintEl.style.opacity = tint;
  if (pass === 'dom') {
    const hasSub = (shot.overlays || []).some((o) => o.type === 'subtitle');
    const credit = document.getElementById('credit');
    credit.style.bottom = hasSub ? '196px' : '16px';
    // the reaction wipe sits in the bottom right corner; move the credits to the left out of its way
    const left = !!spec.reaction && (spec.reaction.side ?? 'right') === 'right';
    Object.assign(credit.style, left ? { left: '24px', right: 'auto', textAlign: 'left' } : { left: 'auto', right: '24px', textAlign: 'right' });
  }
}

// ---- motion graphics for the DOM overlays ----
// Every value below is computed from the time since the overlay appeared (ph.since, seconds) and the time
// until it leaves (ph.until), so a frame always looks the same however it is reached.
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const outCubic = (x) => ease('out', x);

function drawMotion(o, ph, t, a, setTint) {
  if (!ph.on) { if (o.type === 'chapter') setTint(0); return; }
  const inn = (dur, delay = 0) => clamp01((ph.since - delay) / dur);
  const out = clamp01(ph.until / 0.3);          // 1 while shown, 0 at the moment it leaves
  const leave = 1 - out;                         // 0..1 during the exit
  const pos = (o) => {
    if (o.at) { const p = map.project(o.at); return { left: p.x / scale() + 'px', top: p.y / scale() + 'px' }; }
    return { left: (o.screen?.[0] ?? 70) + 'px', top: (o.screen?.[1] ?? 160) + 'px' };
  };
  if (o.type === 'label') {
    if (o.style === 'tag') {
      const k = 0.5 + 0.5 * easeOutBack(inn(0.45));
      el('label tag', esc(o.text), { ...pos(o), opacity: inn(0.15) * out, transform: `translate(-50%, -50%) scale(${k})` });
    } else {
      const ring = (ph.since % 1.6) / 1.6;
      const reveal = 100 * (1 - outCubic(inn(0.5, 0.15)));
      el('label', (o.dot ? `<span class="dot"><span class="ring" style="transform:scale(${1 + ring * 2.2});opacity:${(1 - ring) * 0.8}"></span></span>` : '') +
        `<span class="txt" style="clip-path:inset(-20% ${reveal}% -20% 0)">${esc(o.text)}</span>`,
        { ...pos(o), opacity: inn(0.15) * out });
    }
  } else if (o.type === 'counter') {
    const [x, y] = o.screen ?? [70, 160];
    const up = (1 - outCubic(inn(0.45))) * 40;
    el('counter', (o.caption ? `<span class="cap" style="opacity:${inn(0.3, 0.1)}">${esc(o.caption)}</span>` : '') +
      (o.prefix ? `<span class="pre">${esc(o.prefix)}</span>` : '') +
      `<span class="num">${esc(countValue(o, t))}</span>` + (o.unit ? `<span class="unit">${esc(o.unit)}</span>` : '') +
      `<span class="rule" style="width:${outCubic(inn(0.5, 0.2)) * 100}%"></span>`,
      { left: x + 'px', top: y + 'px', opacity: inn(0.2) * out, transform: `translateY(${up - leave * 20}px)` });
  } else if (o.type === 'chapter') {
    setTint(0.55 * inn(0.4) * out);
    const reveal = 100 * (1 - outCubic(inn(0.6, 0.2)));
    el('chapter',
      (o.kicker ? `<span class="kicker" style="letter-spacing:${0.6 - 0.45 * outCubic(inn(0.6))}em;opacity:${inn(0.3)}">${esc(o.kicker)}</span>` : '') +
      `<span class="title" style="clip-path:inset(-20% ${reveal}% -20% 0)">${esc(o.text)}</span>` +
      `<span class="rule" style="width:${outCubic(inn(0.7, 0.1)) * 640}px"></span>`,
      { opacity: out, transform: `translateY(${-leave * 24}px)` });
  } else if (o.type === 'note') {
    el('note', esc(o.text), { opacity: inn(0.3) * out });
  } else if (o.type === 'quote') {
    const [x, y] = o.screen ?? [70, 160];
    const n = typeCount(o.text, Math.max(0, ph.since - 0.35), o.cps ?? 30);
    const chars = [...o.text];
    el('quote' + (o.marks === false ? ' plain' : ''),
      `<span class="bar" style="transform:scaleY(${outCubic(inn(0.35))})"></span>` +
      `<span class="src" style="opacity:${inn(0.3, 0.15)}">${esc(o.source ?? '')}${o.date ? '　' + esc(o.date) : ''}</span>` +
      `<span class="q"><span>${esc(chars.slice(0, n).join(''))}</span><span class="rest">${esc(chars.slice(n).join(''))}</span></span>`,
      { left: x + 'px', top: y + 'px', width: (o.width ?? 760) + 'px', opacity: inn(0.25) * out,
        transform: `translateX(${-(1 - outCubic(inn(0.45))) * 80 - leave * 60}px)` });
  } else if (o.type === 'photo_marker') {
    // Screen-space connector is recomputed after every camera movement.
    const [x, y] = o.screen ?? [80, 80];
    const w = o.width ?? 750, h = o.height ?? 590;
    const target = map.project(o.at), tx = target.x / scale(), ty = target.y / scale();
    const camera = o.cameraAt ? map.project(o.cameraAt) : null;
    const cx = camera ? camera.x / scale() : 0, cy = camera ? camera.y / scale() : 0;
    const [cameraDx, cameraDy] = o.cameraLabelOffset ?? [-20, -16];
    const bridge = o.bridgeAt ? map.project(o.bridgeAt) : null;
    const bx = bridge ? bridge.x / scale() : 0, by = bridge ? bridge.y / scale() : 0;
    const sx = x + w, sy = y + h * 0.58;
    const mx = sx + (tx - sx) * 0.42;
    const marker = `<circle cx="${tx}" cy="${ty}" r="15" fill="#ffbf45" stroke="#172338" stroke-width="5"/>` +
      `<text x="${tx + 24}" y="${ty + 8}" class="marker-label">${esc(o.targetLabel ?? '')}</text>`;
    const shotMarker = camera ? `<circle cx="${cx}" cy="${cy}" r="9" fill="#67e1dc" stroke="#172338" stroke-width="4"/>` +
      `<text x="${cx + cameraDx}" y="${cy + cameraDy}" text-anchor="${o.cameraLabelAnchor === 'start' ? 'start' : 'end'}" class="marker-label small">${esc(o.cameraLabel ?? '')}</text>` : '';
    const bridgeMarker = bridge ? `<circle cx="${bx}" cy="${by}" r="8" fill="#f6a8ff" stroke="#172338" stroke-width="4"/>` +
      `<text x="${bx + 18}" y="${by - 55}" class="marker-label small">${esc(o.bridgeLabel ?? '')}</text>` : '';
    el('photo-connector', `<svg viewBox="0 0 1920 1080"><path d="M ${sx} ${sy} L ${mx} ${sy} L ${tx} ${ty}" class="connector"/>${marker}${shotMarker}${bridgeMarker}</svg>`,
      { left: '0px', top: '0px', opacity: inn(0.25) * out });
    el('photo-marker-card', `<div class="photo-caption">${esc(o.caption ?? '')}</div>` +
      `<img src="/${esc(o.src.replace(/^\/+/, ''))}"><div class="photo-credit">${esc(o.credit ?? '')}</div>`,
      { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', opacity: inn(0.25) * out });
  } else if (o.type === 'panel') {
    const [x, y] = o.screen ?? [1090, 150];
    const wipe = 100 * (1 - outCubic(inn(0.55)));
    const [start, end] = o.show ?? [0, 1];
    const p = clamp01((t - start) / Math.max(0.001, end - start));
    const zoom = o.motion === 'still' ? 1 : o.motion === 'out' ? 1.10 - 0.08 * p : o.motion === 'in' ? 1.02 + 0.08 * p :
      1.06 - 0.06 * outCubic(inn(1.2)) + 0.03 * clamp01(ph.since / 12);
    const shiftY = o.motion === 'up' ? 12 - 24 * p : o.motion === 'down' ? -12 + 24 * p : 0;
    el('panel', (o.caption ? `<span class="cap" style="opacity:${inn(0.3, 0.25)}">${esc(o.caption)}</span>` : '') +
      `<span class="frame"><img src="/${esc(o.src.replace(/^\/+/, ''))}" style="transform:translateY(${shiftY}px) scale(${zoom})"></span>` +
      (o.credit ? `<span class="cr" style="opacity:${inn(0.3, 0.4)}">${esc(o.credit)}</span>` : ''),
      { left: x + 'px', top: y + 'px', width: (o.width ?? 720) + 'px', opacity: out, clipPath: `inset(0 ${wipe}% 0 0)` });
  } else if (o.type === 'chart') {
    drawChart(o, ph, inn, out);
  } else if (o.type === 'sticker') {
    // an illustration that pops in, then floats gently
    const k = easeOutBack(inn(0.5));
    const bob = Math.sin(ph.since * 2.2) * 6, tilt = Math.sin(ph.since * 1.4) * 2.5 + (1 - k) * -12;
    el('sticker', `<img src="/${esc(o.src.replace(/^\/+/, ''))}">` + (o.credit ? `<span class="cr">${esc(o.credit)}</span>` : ''),
      { left: (o.screen?.[0] ?? 1400) + 'px', top: (o.screen?.[1] ?? 500) + 'px', width: (o.width ?? 320) + 'px',
        opacity: inn(0.15) * out, transform: `translateY(${bob}px) rotate(${tilt}deg) scale(${0.3 + 0.7 * k})` });
  } else if (o.type === 'reaction') {
    drawReaction(o, ph.since);
  } else if (o.type === 'subtitle') {
    el('subtitle', esc(o.text), { opacity: a, ...(o.color ? { color: o.color } : {}),
      transform: `translateY(${(1 - outCubic(inn(0.18))) * 14}px)` });
  }
}

// A line chart drawn in SVG: the card wipes in, the grid fades in, then the line draws itself and
// the points and value labels pop as the line reaches them.
function drawChart(o, ph, inn, out) {
  const W = o.width ?? 780, H = o.height ?? 430;
  const g = chartGeometry(o.points, { w: W, h: H, pad: [36, 34, 48, 78], ymin: o.ymin, ymax: o.ymax });
  const p = ease('inOut', clamp01((ph.since - 0.5) / (o.drawSec ?? 2.4)));
  const drawn = p * g.length;
  const fmt = (v) => `${(+v).toLocaleString('en-US', { maximumFractionDigits: o.decimals ?? 0 })}${o.unit ?? ''}`;
  const ticks = o.yticks ?? [];
  const yOf = (v) => g.plot.y + (1 - (v - g.lo) / (g.hi - g.lo)) * g.plot.h;
  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><g style="opacity:${inn(0.4, 0.2)}">`;
  for (const v of ticks) svg += `<line x1="${g.plot.x}" x2="${g.plot.x + g.plot.w}" y1="${yOf(v)}" y2="${yOf(v)}" class="grid"/><text x="${g.plot.x - 12}" y="${yOf(v) + 7}" class="ytick">${esc(fmt(v))}</text>`;
  for (const [lab, idx] of o.xlabels ?? []) svg += `<text x="${g.pts[idx][0]}" y="${H - 12}" class="xtick">${esc(lab)}</text>`;
  svg += `</g><path d="M${g.pts.map((q) => q.map((v) => v.toFixed(1)).join(',')).join('L')}" class="line" style="stroke-dasharray:${g.length};stroke-dashoffset:${g.length - drawn}"/>`;
  g.pts.forEach((q, i) => {
    // pop as the line passes the point; once the line is complete, the last points finish popping by time
    const reach = p >= 1 ? ph.since - 0.5 - (o.drawSec ?? 2.4) + 0.34 : (drawn - g.cum[i]) / 300 * 3;
    if (drawn < g.cum[i] - 1e-6) return;
    const v = clamp01(reach * 3), k = 0.4 + 0.6 * easeOutBack(v);
    const since = v / 3;
    svg += `<circle cx="${q[0]}" cy="${q[1]}" r="${7 * k}" class="pt"/>`;
    if ((o.labels ?? []).includes(i)) svg += `<text x="${q[0]}" y="${q[1] - 18}" class="val" style="opacity:${clamp01(since * 3)}">${esc(fmt(o.points[i][1]))}</text>`;
  });
  if (p >= 1) { const last = g.pts[g.pts.length - 1], r = (ph.since % 1.4) / 1.4; svg += `<circle cx="${last[0]}" cy="${last[1]}" r="${8 + r * 22}" class="pulse" style="opacity:${(1 - r) * 0.7}"/>`; }
  svg += '</svg>';
  const [x, y] = o.screen ?? [1090, 150];
  el('chart', (o.caption ? `<span class="cap" style="opacity:${inn(0.3, 0.2)}">${esc(o.caption)}</span>` : '') + svg +
    (o.credit ? `<span class="cr" style="opacity:${inn(0.3, 0.4)}">${esc(o.credit)}</span>` : ''),
    { left: x + 'px', top: y + 'px', width: W + 'px', opacity: out, clipPath: `inset(0 ${100 * (1 - outCubic(inn(0.55)))}% 0 0)` });
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
  nowSec = sec;
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

// Reaction wipe: the two narrators' portraits stand on the subtitle band. The speaker is bright and
// slightly larger, opens the mouth where the voice is loud and hops a little when a line starts; the
// listener is dimmed and shows the line's "react" face. Both blink on their own rhythm.
function drawReaction(o, since) {
  const cfg = spec.reaction, chars = cfg.characters ?? {};
  const r = reactionAt(o.segs, since);
  const order = cfg.order ?? Object.keys(chars);
  const h = cfg.height ?? 300, fps = spec.fps ?? 30;
  let html = '';
  for (const key of order) {
    const c = chars[key]; if (!c) continue;
    const speaking = r && r.seg.speaker === key;
    const face = speaking ? r.seg.face : (r ? r.seg.react : 'normal');
    const mouth = speaking && mouthOpenAt(r.seg.env, r.since, fps) ? 'o' : 'c';
    const eyes = blinkAt(nowSec, c.seed ?? key) ? 'c' : 'o';
    const hop = speaking ? Math.sin(Math.PI * clamp01(r.since / 0.28)) * 12 : 0;
    const k = speaking || !r ? 1 : 0.9;
    html += `<img src="/${esc(c.sprites.replace(/^\/+|\/+$/g, ''))}/${face}_${eyes}_${mouth}.png" style="height:${h}px;` +
      `transform:translateY(${-hop}px) scale(${k});filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5))${speaking || !r ? '' : ' brightness(0.72) saturate(0.8)'}">`;
  }
  const side = cfg.side ?? 'right';
  el('reaction', html, { [side]: (cfg.margin ?? 16) + 'px', bottom: (cfg.bottom ?? 150) + 'px' });
}
