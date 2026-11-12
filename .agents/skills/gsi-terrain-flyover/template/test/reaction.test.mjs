import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelEnvelope, mouthOpenAt, blinkAt, reactionAt } from '../page/lib.js';

test('levelEnvelope gives one loudness value per frame, 0 for silence and 1 for the loudest frame', () => {
  const rate = 1000, fps = 10; // 100 samples per frame
  const s = new Int16Array(300);
  for (let i = 100; i < 200; i++) s[i] = i % 2 ? 8000 : -8000; // loud middle frame
  for (let i = 200; i < 300; i++) s[i] = i % 2 ? 2000 : -2000; // quieter last frame
  const env = levelEnvelope(s, rate, fps);
  assert.equal(env.length, 3);
  assert.equal(env[0], 0);
  assert.equal(env[1], 1);
  assert.ok(env[2] > 0.2 && env[2] < 0.3);
});

test('levelEnvelope of an empty or silent clip is all zeros', () => {
  assert.deepEqual(levelEnvelope(new Int16Array(0), 1000, 10), []);
  assert.deepEqual(levelEnvelope(new Int16Array(200), 1000, 10), [0, 0]);
});

test('mouthOpenAt opens the mouth where the voice is loud, and keeps it shut outside the clip', () => {
  const env = [0, 0.8, 0.05, 0.6];
  assert.equal(mouthOpenAt(env, 0.05, 10), false);
  assert.equal(mouthOpenAt(env, 0.15, 10), true);
  assert.equal(mouthOpenAt(env, 0.25, 10), false);
  assert.equal(mouthOpenAt(env, 0.35, 10), true);
  assert.equal(mouthOpenAt(env, -0.1, 10), false);
  assert.equal(mouthOpenAt(env, 5, 10), false);
});

test('blinkAt is deterministic, closes the eyes briefly, and differs between characters', () => {
  const closed = (seed) => { let n = 0; for (let t = 0; t < 60; t += 1 / 30) if (blinkAt(t, seed)) n++; return n / 30; };
  const a = closed('zundamon'), b = closed('metan');
  // about one blink of ~0.13 s every ~4 s: 1.5 to 3 seconds closed per minute
  assert.ok(a > 1.2 && a < 3.2, `closed ${a}s`);
  assert.equal(blinkAt(12.34, 'zundamon'), blinkAt(12.34, 'zundamon'));
  let differ = 0; for (let t = 0; t < 60; t += 0.1) if (blinkAt(t, 'zundamon') !== blinkAt(t, 'metan')) differ++;
  assert.ok(differ > 0);
});

test('reactionAt finds the line being spoken and its time since the line started', () => {
  const segs = [{ t0: 0.3, t1: 2.0, speaker: 'a', face: 'smile' }, { t0: 2.0, t1: 4.0, speaker: 'b' }];
  assert.equal(reactionAt(segs, 0.1), null);
  const r = reactionAt(segs, 1.3);
  assert.equal(r.seg.speaker, 'a');
  assert.ok(Math.abs(r.since - 1.0) < 1e-9);
  assert.equal(reactionAt(segs, 2.0).seg.speaker, 'b');
  assert.equal(reactionAt(segs, 4.5), null);
});
