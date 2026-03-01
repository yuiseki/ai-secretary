'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { pickDirectVideoId } = require('./open_tv_channel_live_tile_fast.js');

test('pickDirectVideoId returns the sole valid candidate', () => {
  assert.equal(
    pickDirectVideoId({ videoIds: ['abc123DEF45'] }),
    'abc123DEF45',
  );
});

test('pickDirectVideoId rejects ambiguous matches with multiple candidates', () => {
  assert.equal(
    pickDirectVideoId({ videoIds: ['abc123DEF45', 'zzz999YYY88'] }),
    null,
  );
});

test('pickDirectVideoId ignores invalid ids before deciding', () => {
  assert.equal(
    pickDirectVideoId({ videoIds: ['not-an-id', 'abc123DEF45', 'bad'] }),
    'abc123DEF45',
  );
});
