'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildDirectionalSearchKeySequence,
  buildWebWatchUrl,
  buildWatchUrlFromTvHomeUrl,
  deriveWebChannelStreamsUrl,
  findWebStreamsVideoId,
  pickDirectVideoId,
  shouldAttemptScrollSearch,
  tryFindMatchViaDirectionalKeys,
  verifyWatchState,
} = require('./open_tv_channel_live_tile_fast.js');

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

test('shouldAttemptScrollSearch returns true for browse pages with tiles but no match', () => {
  assert.equal(
    shouldAttemptScrollSearch({
      hash: '#/browse?c=abc',
      visibleTileCount: 8,
      match: null,
    }),
    true,
  );
});

test('shouldAttemptScrollSearch returns false when a match is already present', () => {
  assert.equal(
    shouldAttemptScrollSearch({
      hash: '#/browse?c=abc',
      visibleTileCount: 8,
      match: { text: '浅草・雷門前の様子' },
    }),
    false,
  );
});

test('shouldAttemptScrollSearch returns false outside browse pages', () => {
  assert.equal(
    shouldAttemptScrollSearch({
      hash: '#/watch?v=abc123DEF45',
      visibleTileCount: 8,
      match: null,
    }),
    false,
  );
});

test('buildDirectionalSearchKeySequence builds a serpentine browse sweep', () => {
  assert.deepEqual(
    buildDirectionalSearchKeySequence({ columns: 2, rows: 3, resetLeft: 1, resetUp: 1 }),
    [
      'ArrowLeft',
      'ArrowUp',
      'ArrowRight', 'ArrowRight',
      'ArrowDown',
      'ArrowLeft', 'ArrowLeft',
      'ArrowDown',
      'ArrowRight', 'ArrowRight',
    ],
  );
});

test('deriveWebChannelStreamsUrl uses the browse channel id', () => {
  assert.equal(
    deriveWebChannelStreamsUrl('https://www.youtube.com/tv/@tbsnewsdig/streams#/browse?c=UC6AG81pAkf6Lbi_1VC5NmPA'),
    'https://www.youtube.com/channel/UC6AG81pAkf6Lbi_1VC5NmPA/streams',
  );
});

test('buildWatchUrlFromTvHomeUrl keeps the tv root path', () => {
  assert.equal(
    buildWatchUrlFromTvHomeUrl('https://www.youtube.com/tv?env_enableMediaStreams=true#/', 'abc123DEF45'),
    'https://www.youtube.com/tv?env_enableMediaStreams=true#/watch?v=abc123DEF45',
  );
});

test('buildWebWatchUrl uses the standard web watch path', () => {
  assert.equal(
    buildWebWatchUrl('abc123DEF45'),
    'https://www.youtube.com/watch?v=abc123DEF45',
  );
});

test('verifyWatchState accepts a standard web watch page when the title matches', () => {
  assert.equal(
    verifyWatchState(
      {
        href: 'https://www.youtube.com/watch?v=abc123DEF45',
        watchText: '',
        bodyHead: '【LIVE】新宿駅前のライブカメラ 現在の様子は？ Shinjuku, Tokyo JAPAN | TBS NEWS DIG',
      },
      /新宿駅前|Shinjuku/i,
    ),
    true,
  );
});

test('findWebStreamsVideoId extracts the matching renderer video id', () => {
  const html = [
    '"videoRenderer":{"videoId":"AAAAAAAAAAA","title":{"runs":[{"text":"【LIVE】昼のニュース"}]}}',
    '"videoRenderer":{"videoId":"BBBBBBBBBBB","title":{"runs":[{"text":"【LIVE】浅草・雷門前の様子 Asakusa, Tokyo JAPAN 【ライブカメラ】"}]}}',
  ].join('');
  assert.equal(findWebStreamsVideoId(html, '浅草・雷門前の様子'), 'BBBBBBBBBBB');
});

test('tryFindMatchViaDirectionalKeys stops after the first matched browse state', async () => {
  const sentKeys = [];
  const states = [
    { hash: '#/browse?c=abc', visibleTileCount: 8, match: null },
    { hash: '#/browse?c=abc', visibleTileCount: 8, match: { text: '浅草・雷門前の様子' } },
  ];
  const cdp = {
    send: async (method, params) => {
      if (method === 'Input.dispatchKeyEvent' && params && params.type === 'keyDown') {
        sentKeys.push(params.key);
      }
    },
    evalv: async () => states.shift(),
  };

  const out = await tryFindMatchViaDirectionalKeys(
    cdp,
    '(() => ({}))()',
    ['ArrowDown', 'ArrowRight'],
    { settleMs: 0 },
  );

  assert.equal(out.ok, true);
  assert.equal(out.state.match.text, '浅草・雷門前の様子');
  assert.deepEqual(sentKeys, ['ArrowDown', 'ArrowRight']);
  assert.equal(out.steps.length, 2);
});
