import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gsiToTerrarium, ease, cameraAt, sliceLine, locate, fadeAlpha, countValue } from '../page/lib.js';

test('GSI DEM: positive, negative and NA pixels', () => {
  // 3776.12 m -> x = 377612
  const x = 377612;
  assert.equal(gsiToTerrarium(x >> 16, (x >> 8) & 255, x & 255), 3776.12);
  // -1.5 m -> x = 2^24 - 150
  const n = 2 ** 24 - 150;
  assert.equal(gsiToTerrarium(n >> 16, (n >> 8) & 255, n & 255), -1.5);
  // NA (128,0,0) -> 0 (sea and no data)
  assert.equal(gsiToTerrarium(128, 0, 0), 0);
});

test('ease keeps ends and is monotonic', () => {
  for (const k of ['linear', 'inOut', 'in', 'out']) {
    assert.equal(ease(k, 0), 0);
    assert.equal(ease(k, 1), 1);
    assert.ok(ease(k, 0.6) >= ease(k, 0.4));
  }
});

test('cameraAt interpolates keys and takes the short way round for bearing', () => {
  const keys = [
    { t: 0, center: [138, 35], zoom: 10, pitch: 0, bearing: 350 },
    { t: 1, center: [139, 36], zoom: 12, pitch: 60, bearing: 10 },
  ];
  const mid = cameraAt(keys, 0.5, 'linear');
  assert.equal(mid.zoom, 11);
  assert.equal(mid.pitch, 30);
  assert.ok(Math.abs(((mid.bearing % 360) + 360) % 360) < 1e-9 || Math.abs(mid.bearing - 360) < 1e-9);
  assert.ok(Math.abs(mid.center[0] - 138.5) < 1e-9);
  assert.deepEqual(cameraAt(keys, 1, 'linear').center, [139, 36]);
});

test('sliceLine returns the first fraction of the line by length', () => {
  const line = [[0, 0], [1, 0], [1, 1]];
  assert.deepEqual(sliceLine(line, 0), [[0, 0], [0, 0]]);
  assert.deepEqual(sliceLine(line, 1), line);
  const half = sliceLine(line, 0.5);
  assert.deepEqual(half[half.length - 1], [1, 0]);
  const q = sliceLine(line, 0.25);
  assert.ok(Math.abs(q[q.length - 1][0] - 0.5) < 1e-9);
});

test('locate maps a global time to a shot and local progress', () => {
  const shots = [{ duration: 2 }, { duration: 3 }];
  assert.deepEqual(locate(shots, 0), { index: 0, t: 0, sec: 0 });
  assert.deepEqual(locate(shots, 1), { index: 0, t: 0.5, sec: 1 });
  assert.deepEqual(locate(shots, 2.5), { index: 1, t: 0.5 / 3, sec: 0.5 });
  assert.equal(locate(shots, 99).index, 1);
});

test('fadeAlpha fades in and out over the window', () => {
  assert.equal(fadeAlpha([0.2, 0.8], 0.1, 0.1), 0);
  assert.equal(fadeAlpha([0.2, 0.8], 0.5, 0.1), 1);
  assert.ok(Math.abs(fadeAlpha([0.2, 0.8], 0.25, 0.1) - 0.5) < 1e-9);
  assert.equal(fadeAlpha(undefined, 0.5, 0.1), 1);
});

test('countValue counts up and keeps the given decimals', () => {
  assert.equal(countValue({ value: 2500, countUp: [0, 0.5], countEase: 'linear' }, 0.25), '1,250');
  assert.ok(Number(countValue({ value: 2500, countUp: [0, 0.5] }, 0.25).replace(',', '')) > 1250); // eases out by default
  assert.equal(countValue({ value: 2500, countUp: [0.2, 0.5] }, 0.1), '0');
  assert.equal(countValue({ value: 2500, countUp: [0, 0.5] }, 0.9), '2,500');
  assert.equal(countValue({ value: 2.8, decimals: 1 }, 0.1), '2.8');
  assert.equal(countValue({ value: '40〜50' }, 0.1), '40〜50');
  // years: no grouping, count from a start value
  assert.equal(countValue({ value: 1969, from: 1950, grouping: false, countUp: [0, 1], countEase: 'linear' }, 0.5), '1960');
  assert.equal(countValue({ value: 1969, grouping: false }, 0), '1969');
});

import { wrapSubtitle, layoutLines, estimateSeconds } from '../page/lib.js';

test('wrapSubtitle keeps short lines and splits long ones at punctuation near the middle', () => {
  assert.equal(wrapSubtitle('短い字幕', 26), '短い字幕');
  assert.equal(wrapSubtitle('改行は\nそのまま', 4), '改行は\nそのまま');
  const t = 'ここから流れ出す土砂は、平均して毎年ダンプ約3万台分になるんだ。';
  const w = wrapSubtitle(t, 20);
  assert.equal(w.replace('\n', ''), t);
  assert.equal(w.split('\n').length, 2);
  assert.ok(w.split('\n')[0].endsWith('、'));
  // no punctuation: split in the middle
  const n = 'あいうえおかきくけこさしすせそたちつてと';
  assert.equal(wrapSubtitle(n, 12).split('\n')[0].length, 10);
});

test('layoutLines puts lines one after another and stretches the shot to fit', () => {
  const r = layoutLines([1.0, 2.0], { duration: 2, padStart: 0.5, pause: 0.25, padEnd: 0.5 });
  // 0.5 + 1.0 + 0.25 + 2.0 + 0.5 = 4.25
  assert.equal(r.duration, 4.25);
  assert.deepEqual(r.starts, [0.5, 1.75]);
  // subtitle windows in shot progress; each stays until the next line starts (or the end)
  assert.ok(Math.abs(r.windows[0][0] - 0.5 / 4.25) < 1e-9);
  assert.ok(Math.abs(r.windows[0][1] - 1.75 / 4.25) < 1e-9);
  assert.equal(r.windows[1][1], 1);
  // a longer requested duration is kept
  assert.equal(layoutLines([1.0], { duration: 6, padStart: 0.5, pause: 0.25, padEnd: 0.5 }).duration, 6);
  // no lines: duration unchanged
  assert.equal(layoutLines([], { duration: 3 }).duration, 3);
});

test('estimateSeconds approximates speech time from characters', () => {
  assert.equal(estimateSeconds('あいうえお、かきくけこ。', 5), 2);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseWav, writeWav } from '../voice.mjs';

test('writeWav and parseWav round-trip 16-bit mono PCM', () => {
  const f = path.join(os.tmpdir(), `flyover-${process.pid}.wav`);
  const s = new Int16Array([0, 1000, -1000, 32767, -32768]);
  writeWav(f, s, 24000);
  const w = parseWav(fs.readFileSync(f));
  fs.rmSync(f);
  assert.equal(w.rate, 24000);
  assert.deepEqual([...w.samples], [...s]);
  assert.ok(Math.abs(w.seconds - 5 / 24000) < 1e-12);
});

import { phase, easeOutBack, typeCount, chartGeometry } from '../page/lib.js';

test('phase gives seconds since the overlay appeared and until it leaves', () => {
  assert.deepEqual(phase([0.2, 0.8], 0.5, 10), { since: 3, until: 3, on: true });
  assert.equal(phase([0.2, 0.8], 0.1, 10).on, false);
  // no window: shown for the whole shot, never leaves
  assert.deepEqual(phase(undefined, 0.5, 4), { since: 2, until: Infinity, on: true });
  // a window ending at 1 does not count down to an exit (the cut ends it)
  assert.equal(phase([0.2, 1], 0.9, 10).until, Infinity);
});

test('easeOutBack overshoots then settles at 1', () => {
  assert.equal(easeOutBack(0), 0);
  assert.ok(Math.abs(easeOutBack(1) - 1) < 1e-12);
  assert.ok(Math.max(...[0.5, 0.6, 0.7, 0.8].map(easeOutBack)) > 1);
});

test('typeCount reveals characters at a steady rate', () => {
  assert.equal(typeCount('あいうえお', 0, 10), 0);
  assert.equal(typeCount('あいうえお', 0.25, 10), 2);
  assert.equal(typeCount('あいうえお', 9, 10), 5);
});

test('chartGeometry maps points into the plot box and measures the path', () => {
  const g = chartGeometry([['2021-01', 100], ['2021-07', 200], ['2022-01', 150]], { w: 200, h: 100, pad: [10, 10, 10, 10], ymin: 100, ymax: 200 });
  assert.deepEqual(g.pts[0], [10, 90]);
  assert.deepEqual(g.pts[1].map(Math.round), [Math.round(10 + 180 * (181 / 365)), 10]);
  assert.ok(Math.abs(g.pts[2][0] - 190) < 1e-9);
  assert.ok(g.length > 180);
  assert.ok(Math.abs(g.cum[2] - g.length) < 1e-9);
});
