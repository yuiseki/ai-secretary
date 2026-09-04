#!/usr/bin/env node
'use strict';

function usage() {
  console.log(`Usage: open_tv_channel_live_tile_fast.js [options]

Fast single-shot CDP workflow for VacuumTube TV channel streams pages that auto-redirect within a few seconds.

Required:
  --browse-url URL         TV channel streams browse URL (use #/browse?c=<channelId> when possible)
  --keyword TEXT           Tile keyword to match (e.g. いまの渋谷)

Optional:
  --cdp-port N             CDP port (default: 9993)
  --verify-regex REGEX     Post-open verification regex (default: keyword)
  --tv-home-url URL        TV home URL used to reset SPA state (default: https://www.youtube.com/tv?env_enableMediaStreams=true#/)
  --force-video-id ID      Skip browse phase; navigate directly to TV watch URL for this video ID
  --retries N              Retry rounds for the browse->select race (default: 4)
  --browse-window-ms N     Time budget per round to capture tiles before auto-redirect (default: 4500)
  --poll-ms N              Poll interval while waiting for tiles (default: 80)
  --verify-timeout-ms N    Time budget to verify watch page after open (default: 2500)
  --verbose                Include failure details for each round
  -h, --help               Show this help
`);
}

function parseArgs(argv) {
  const out = {
    cdpPort: 9993,
    browseUrl: '',
    keyword: '',
    verifyRegex: '',
    tvHomeUrl: 'https://www.youtube.com/tv?env_enableMediaStreams=true#/',
    forceVideoId: '',
    retries: 4,
    browseWindowMs: 4500,
    pollMs: 80,
    verifyTimeoutMs: 2500,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`Missing value for ${a}`);
      return argv[++i];
    };
    switch (a) {
      case '--cdp-port': out.cdpPort = Number(next()); break;
      case '--browse-url': out.browseUrl = next(); break;
      case '--keyword': out.keyword = next(); break;
      case '--verify-regex': out.verifyRegex = next(); break;
      case '--tv-home-url': out.tvHomeUrl = next(); break;
      case '--force-video-id': out.forceVideoId = next(); break;
      case '--retries': out.retries = Number(next()); break;
      case '--browse-window-ms': out.browseWindowMs = Number(next()); break;
      case '--poll-ms': out.pollMs = Number(next()); break;
      case '--verify-timeout-ms': out.verifyTimeoutMs = Number(next()); break;
      case '--verbose': out.verbose = true; break;
      case '-h':
      case '--help':
        usage();
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${a}`);
    }
  }

  if (!out.forceVideoId) {
    if (!out.browseUrl) throw new Error('--browse-url is required');
    if (!out.keyword) throw new Error('--keyword is required');
  }
  if (!out.verifyRegex) out.verifyRegex = out.keyword;
  if (!Number.isFinite(out.cdpPort) || out.cdpPort <= 0) throw new Error('--cdp-port must be a positive number');
  if (!out.forceVideoId) {
    if (!Number.isFinite(out.retries) || out.retries < 1) throw new Error('--retries must be >= 1');
    if (!Number.isFinite(out.browseWindowMs) || out.browseWindowMs < 200) throw new Error('--browse-window-ms must be >= 200');
    if (!Number.isFinite(out.pollMs) || out.pollMs < 20) throw new Error('--poll-ms must be >= 20');
    if (!Number.isFinite(out.verifyTimeoutMs) || out.verifyTimeoutMs < 200) throw new Error('--verify-timeout-ms must be >= 200');
    // Validate URL format early.
    new URL(out.browseUrl);
  }
  new URL(out.tvHomeUrl);
  out.verifyRegexObject = new RegExp(out.verifyRegex || '.', 'i');

  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connectPageTarget(cdpPort) {
  const base = `http://127.0.0.1:${cdpPort}`;
  const list = await fetch(`${base}/json/list`).then((r) => {
    if (!r.ok) throw new Error(`CDP json/list failed: ${r.status}`);
    return r.json();
  });
  const target = list.find((t) => t.type === 'page' && String(t.url).includes('youtube.com')) || list.find((t) => t.type === 'page');
  if (!target) throw new Error(`No page target on :${cdpPort}`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  let loadResolvers = [];

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Page.loadEventFired') {
      const rs = loadResolvers;
      loadResolvers = [];
      rs.forEach((r) => r());
    }
  });

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const waitLoad = (ms = 8000) => Promise.race([
    new Promise((resolve) => loadResolvers.push(resolve)),
    sleep(ms),
  ]);

  const evalv = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true });
    if (res.exceptionDetails) {
      throw new Error(`Runtime exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res?.result?.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');

  return { base, target, ws, send, waitLoad, evalv };
}

function buildFastScanExpr(keyword) {
  return `(() => {
    const nrm = (s) => String(s || '').normalize('NFKC').replace(/\\s+/g, '').toLowerCase();
    const want = nrm(${JSON.stringify(keyword)});
    const seenRoots = new Set();
    const tiles = [];
    const walk = (root) => {
      if (!root || seenRoots.has(root)) return;
      seenRoots.add(root);
      if (!root.querySelectorAll) return;
      root.querySelectorAll('ytlr-tile-renderer').forEach((el) => { if (!tiles.includes(el)) tiles.push(el); });
      root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) walk(el.shadowRoot); });
    };
    walk(document);

    const collectText = (node) => {
      try {
        if (typeof node.innerText === 'string' && node.innerText.trim()) return node.innerText.trim();
        if (typeof node.textContent === 'string' && node.textContent.trim()) return node.textContent.trim();
      } catch (_) {}
      return '';
    };

    const collectVideoIds = (tile) => {
      const found = new Set();
      const pushId = (v) => { if (typeof v === 'string' && /^[A-Za-z0-9_-]{11}$/.test(v)) found.add(v); };
      const roots = [];
      try {
        roots.push(tile, tile.data, tile.data_, tile.__data, tile.__dataHost, tile.polymerController);
        roots.push(tile.__dataHost && tile.__dataHost.data);
        roots.push(tile.__dataHost && tile.__dataHost.data_);
        roots.push(tile.polymerController && tile.polymerController.data);
        roots.push(tile.polymerController && tile.polymerController.data_);
      } catch (_) {}

      const seen = new Set();
      const stack = roots.filter(Boolean).map((o) => ({ o, d: 0 }));
      while (stack.length) {
        const { o, d } = stack.pop();
        if (!o || (typeof o !== 'object' && typeof o !== 'function')) continue;
        if (seen.has(o) || d > 5) continue;
        seen.add(o);
        let keys = [];
        try { keys = Object.keys(o); } catch (_) { continue; }
        for (const k of keys.slice(0, 120)) {
          let v;
          try { v = o[k]; } catch (_) { continue; }
          if (/videoid/i.test(k)) pushId(v);
          if (typeof v === 'string') {
            let m = v.match(/[?&]v=([A-Za-z0-9_-]{11})/);
            if (m) pushId(m[1]);
            m = v.match(/#\\/watch\\?v=([A-Za-z0-9_-]{11})/);
            if (m) pushId(m[1]);
            if ((/id|video/i.test(k)) && /^[A-Za-z0-9_-]{11}$/.test(v)) pushId(v);
          }
          if (v && (typeof v === 'object' || typeof v === 'function')) stack.push({ o: v, d: d + 1 });
        }
      }

      try {
        tile.querySelectorAll('*').forEach((el) => {
          for (const a of (el.getAttributeNames ? el.getAttributeNames() : [])) {
            const val = el.getAttribute(a);
            if (!val) continue;
            let m = String(val).match(/(?:[?&]v=|#\\/watch\\?v=)([A-Za-z0-9_-]{11})/);
            if (m) pushId(m[1]);
            if (/videoid/i.test(a) && /^[A-Za-z0-9_-]{11}$/.test(val)) pushId(val);
          }
        });
      } catch (_) {}

      return Array.from(found);
    };

    const visibleTiles = [];
    let match = null;
    for (let index = 0; index < tiles.length; index++) {
      const tile = tiles[index];
      const r = tile.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const item = {
        index,
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        cx: Math.round(r.x + r.width / 2), cy: Math.round(r.y + r.height / 2),
        text: collectText(tile).slice(0, 1200),
        videoIds: collectVideoIds(tile),
      };
      visibleTiles.push(item);
      if (!match && nrm(item.text).includes(want)) match = item;
    }

    const tags = ['ytlr-video-title-tray', 'ytlr-watch-metadata', 'ytlr-video-owner-renderer'];
    const watchParts = [];
    for (const tag of tags) {
      try {
        document.querySelectorAll(tag).forEach((el) => {
          const t = collectText(el);
          if (t) watchParts.push(t);
        });
      } catch (_) {}
    }

    return {
      href: location.href,
      origin: location.origin,
      pathname: location.pathname,
      hash: location.hash,
      title: document.title,
      tileCount: tiles.length,
      visibleTileCount: visibleTiles.length,
      match,
      sampleVisible: visibleTiles.slice(0, 12),
      bodyHead: (document.body?.innerText || '').slice(0, 600),
      watchText: watchParts.join(' | ').slice(0, 1000),
    };
  })()`;
}

function buildFocusMatchExpr(keyword) {
  return `(() => {
    const nrm = (s) => String(s || '').normalize('NFKC').replace(/\\s+/g, '').toLowerCase();
    const want = nrm(${JSON.stringify(keyword)});
    const seenRoots = new Set();
    const tiles = [];
    const walk = (root) => {
      if (!root || seenRoots.has(root)) return;
      seenRoots.add(root);
      if (!root.querySelectorAll) return;
      root.querySelectorAll('ytlr-tile-renderer').forEach((el) => { if (!tiles.includes(el)) tiles.push(el); });
      root.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) walk(el.shadowRoot); });
    };
    walk(document);

    const collectText = (node) => {
      try {
        if (typeof node.innerText === 'string' && node.innerText.trim()) return node.innerText.trim();
        if (typeof node.textContent === 'string' && node.textContent.trim()) return node.textContent.trim();
      } catch (_) {}
      return '';
    };

    const matches = [];
    for (const tile of tiles) {
      const r = tile.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      const text = collectText(tile);
      if (!nrm(text).includes(want)) continue;
      matches.push({ tile, r, text });
    }
    matches.sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x);
    const m = matches[0];
    if (!m) return { ok: false, reason: 'no-match' };
    m.tile.scrollIntoView?.({ block: 'center', inline: 'center' });
    const focusable = m.tile.querySelector?.('[tabindex],a,button,[role="button"]') || m.tile;
    try { focusable.focus?.(); } catch (_) {}
    const r = m.tile.getBoundingClientRect();
    return {
      ok: true,
      cx: Math.round(r.x + r.width / 2),
      cy: Math.round(r.y + r.height / 2),
      text: m.text.slice(0, 600),
    };
  })()`;
}

function buildWatchUrlFromBrowseUrl(browseUrl, videoId) {
  const u = new URL(browseUrl);
  return `${u.origin}${u.pathname}#/watch?v=${videoId}`;
}

function buildWatchUrlFromTvHomeUrl(tvHomeUrl, videoId) {
  const u = new URL(tvHomeUrl);
  return `${u.origin}${u.pathname}${u.search}#/watch?v=${videoId}`;
}

function buildWebWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function normalizeDirectVideoIds(videoIds) {
  if (!Array.isArray(videoIds)) return [];
  const seen = new Set();
  const out = [];
  for (const rawId of videoIds) {
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function pickDirectVideoId(match) {
  const ids = normalizeDirectVideoIds(match && match.videoIds);
  if (ids.length !== 1) return null;
  return ids[0];
}

function shouldAttemptScrollSearch(state) {
  if (!state) return false;
  if (!String(state.hash || '').startsWith('#/browse')) return false;
  if (!Number.isFinite(state.visibleTileCount) || state.visibleTileCount <= 0) return false;
  return !state.match;
}

function deriveWebChannelStreamsUrl(browseUrl) {
  const u = new URL(browseUrl);
  const channelIdMatch = String(u.hash || '').match(/(?:[?&]|^)c=([A-Za-z0-9_-]+)/);
  const channelId = channelIdMatch ? channelIdMatch[1] : '';
  if (!/^UC[A-Za-z0-9_-]+$/.test(channelId)) return null;
  return `${u.origin}/channel/${channelId}/streams`;
}

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findWebStreamsVideoId(html, keyword) {
  const source = String(html || '');
  const rawKeyword = String(keyword || '').trim();
  if (!source || !rawKeyword) return null;
  const titleRe = new RegExp(`"title":\\{"runs":\\[\\{"text":"([^"]*${escapeRegExp(rawKeyword)}[^"]*)"`, 'g');
  let titleMatch;
  while ((titleMatch = titleRe.exec(source)) !== null) {
    const windowStart = Math.max(0, titleMatch.index - 12000);
    const window = source.slice(windowStart, titleMatch.index);
    const idRe = /"videoRenderer":\{"videoId":"([A-Za-z0-9_-]{11})"/g;
    let idMatch;
    let lastId = null;
    while ((idMatch = idRe.exec(window)) !== null) {
      lastId = idMatch[1];
    }
    if (lastId) return lastId;
  }
  return null;
}

function buildScrollBrowseExpr() {
  return `(() => {
    const seen = new Set();
    const candidates = [];
    const push = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      try {
        const st = getComputedStyle(el);
        const oy = String(st.overflowY || '');
        if (!/(auto|scroll|overlay)/.test(oy)) return;
        if (!(el.scrollHeight > el.clientHeight + 20)) return;
        candidates.push(el);
      } catch (_) {}
    };
    const walk = (root) => {
      if (!root || seen.has(root)) return;
      seen.add(root);
      push(root.scrollingElement);
      if (!root.querySelectorAll) return;
      root.querySelectorAll('*').forEach((el) => {
        push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      });
    };
    push(document.scrollingElement);
    push(document.documentElement);
    push(document.body);
    walk(document);
    candidates.sort((a, b) => {
      const aSpan = (a.scrollHeight || 0) - (a.clientHeight || 0);
      const bSpan = (b.scrollHeight || 0) - (b.clientHeight || 0);
      return bSpan - aSpan;
    });
    const target = candidates[0] || document.scrollingElement || document.documentElement || document.body;
    if (!target) return { ok: false, reason: 'no-scroll-target' };
    const before = Number(target.scrollTop || 0);
    const viewH = Number(target.clientHeight || window.innerHeight || 0);
    const delta = Math.max(240, Math.round(viewH * 0.85));
    try { target.scrollTop = before + delta; } catch (_) {}
    let after = Number(target.scrollTop || 0);
    if (after === before) {
      try { target.scrollBy?.(0, delta); } catch (_) {}
      after = Number(target.scrollTop || 0);
    }
    if (after === before) {
      try { window.scrollBy(0, delta); } catch (_) {}
      after = Number(target.scrollTop || 0);
    }
    return {
      ok: after !== before,
      before,
      after,
      delta,
      tag: String(target.tagName || '').toLowerCase(),
      id: String(target.id || ''),
    };
  })()`;
}

function verifyWatchState(state, verifyRegexObject) {
  if (!state || !/watch\?v=/.test(String(state.href || ''))) return false;
  const combined = `${state.watchText || ''} ${state.bodyHead || ''}`;
  return verifyRegexObject.test(combined);
}

async function verifyLoop(cdp, fastExpr, verifyRegexObject, timeoutMs) {
  const start = Date.now();
  let last = null;
  while (Date.now() - start < timeoutMs) {
    last = await cdp.evalv(fastExpr);
    if (verifyWatchState(last, verifyRegexObject)) {
      return { ok: true, state: last };
    }
    await sleep(100);
  }
  if (!last) last = await cdp.evalv(fastExpr);
  return { ok: false, state: last };
}

async function tryOpenViaWebStreamsFallback(cdp, opts, fastExpr) {
  const webStreamsUrl = deriveWebChannelStreamsUrl(opts.browseUrl);
  if (!webStreamsUrl) {
    return { ok: false, reason: 'no-web-streams-url' };
  }
  const resp = await fetch(webStreamsUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!resp.ok) {
    return { ok: false, reason: `web-streams-fetch-${resp.status}`, webStreamsUrl };
  }
  const html = await resp.text();
  const videoId = findWebStreamsVideoId(html, opts.keyword);
  if (!videoId) {
    return { ok: false, reason: 'web-streams-no-match', webStreamsUrl };
  }
  const tvWatchUrl = buildWatchUrlFromTvHomeUrl(opts.tvHomeUrl, videoId);
  await cdp.send('Page.navigate', { url: tvWatchUrl });
  await cdp.waitLoad(4000);
  const tvVerified = await verifyLoop(cdp, fastExpr, opts.verifyRegexObject, opts.verifyTimeoutMs);
  if (tvVerified.ok) {
    return {
      ok: true,
      method: 'web-streams-fallback-tv-watch',
      webStreamsUrl,
      videoId,
      tvWatchUrl,
      final: tvVerified.state,
    };
  }
  const webWatchUrl = buildWebWatchUrl(videoId);
  await cdp.send('Page.navigate', { url: webWatchUrl });
  await cdp.waitLoad(4000);
  const webVerified = await verifyLoop(cdp, fastExpr, opts.verifyRegexObject, opts.verifyTimeoutMs);
  if (webVerified.ok) {
    return {
      ok: true,
      method: 'web-streams-fallback-web-watch',
      webStreamsUrl,
      videoId,
      tvWatchUrl,
      webWatchUrl,
      final: webVerified.state,
    };
  }
  return {
    ok: false,
    reason: 'web-streams-verify-failed',
    webStreamsUrl,
    videoId,
    tvWatchUrl,
    webWatchUrl,
    tvFinal: tvVerified.state,
    final: webVerified.state,
  };
}

async function navigateAndCaptureBrowse(cdp, opts, fastExpr, scrollExpr) {
  const { send, waitLoad, evalv } = cdp;
  await send('Page.navigate', { url: opts.tvHomeUrl });
  await waitLoad(6000);
  await sleep(200);
  await send('Page.navigate', { url: opts.browseUrl });
  await waitLoad(6000);

  const start = Date.now();
  let first = null;
  let scrolls = 0;
  let lastScrollAt = 0;
  while (Date.now() - start < opts.browseWindowMs) {
    const s = await evalv(fastExpr);
    if (!first) first = s;
    if (s.match && String(s.hash || '').startsWith('#/browse')) {
      return { ok: true, state: s, firstState: first, elapsedMs: Date.now() - start, scrolls };
    }
    if (shouldAttemptScrollSearch(s) && scrolls < 8) {
      const now = Date.now();
      if (now - lastScrollAt >= Math.max(180, opts.pollMs)) {
        await evalv(scrollExpr);
        scrolls += 1;
        lastScrollAt = now;
        await sleep(Math.max(120, opts.pollMs));
        continue;
      }
    }
    if ((s.visibleTileCount || 0) > 0 && String(s.hash || '').startsWith('#/browse')) {
      return { ok: true, state: s, firstState: first, elapsedMs: Date.now() - start, scrolls };
    }
    await sleep(opts.pollMs);
  }
  const last = await evalv(fastExpr);
  return { ok: false, state: last, firstState: first, elapsedMs: Date.now() - start, scrolls };
}

async function tryOpenTarget(cdp, opts, fastExpr, focusExpr, scrollExpr, round) {
  const browse = await navigateAndCaptureBrowse(cdp, opts, fastExpr, scrollExpr);
  if (!browse.ok) {
    return { ok: false, round, stage: 'browse-timeout', browse };
  }

  const state = browse.state;
  if (!state.match) {
    const webFallback = await tryOpenViaWebStreamsFallback(cdp, opts, fastExpr);
    if (webFallback.ok) {
      return {
        ok: true,
        round,
        ...webFallback,
        browse,
      };
    }
    return { ok: false, round, stage: 'no-match-tile', browse, webFallback };
  }

  // Multiple IDs can be discovered from nested Polymer data on TV pages.
  // Only trust direct navigation when the tile yields a single unambiguous ID.
  const directId = pickDirectVideoId(state.match);
  if (directId) {
    const targetWatch = buildWatchUrlFromBrowseUrl(opts.browseUrl, directId);
    await cdp.send('Page.navigate', { url: targetWatch });
    await cdp.waitLoad(4000);
    const verified = await verifyLoop(cdp, fastExpr, opts.verifyRegexObject, opts.verifyTimeoutMs);
    if (verified.ok) {
      return {
        ok: true,
        round,
        method: 'direct-id',
        videoId: directId,
        targetWatch,
        matchedTile: state.match,
        final: verified.state,
      };
    }
  }

  // Fallback: refetch browse state, focus matching tile, then try keyboard/mouse.
  const browse2 = await navigateAndCaptureBrowse(cdp, opts, fastExpr, scrollExpr);
  if (!browse2.ok || !browse2.state.match) {
    return { ok: false, round, stage: 'fallback-browse-failed', browse2 };
  }

  const focusRes = await cdp.evalv(focusExpr);
  if (focusRes && focusRes.ok) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await cdp.waitLoad(2500);
    const enterVerified = await verifyLoop(cdp, fastExpr, opts.verifyRegexObject, opts.verifyTimeoutMs);
    if (enterVerified.ok) {
      const m = String(enterVerified.state.href || '').match(/[?&]v=([A-Za-z0-9_-]{11})/);
      return {
        ok: true,
        round,
        method: 'focus+enter',
        videoId: m ? m[1] : null,
        matchedTile: browse2.state.match,
        focusRes,
        final: enterVerified.state,
      };
    }

    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: focusRes.cx, y: focusRes.cy, button: 'none' });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: focusRes.cx, y: focusRes.cy, button: 'left', clickCount: 1 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: focusRes.cx, y: focusRes.cy, button: 'left', clickCount: 1 });
    await cdp.waitLoad(2500);
    const mouseVerified = await verifyLoop(cdp, fastExpr, opts.verifyRegexObject, opts.verifyTimeoutMs);
    if (mouseVerified.ok) {
      const m = String(mouseVerified.state.href || '').match(/[?&]v=([A-Za-z0-9_-]{11})/);
      return {
        ok: true,
        round,
        method: 'cdp-mouse-center',
        videoId: m ? m[1] : null,
        matchedTile: browse2.state.match,
        focusRes,
        final: mouseVerified.state,
      };
    }
  }

  return {
    ok: false,
    round,
    stage: 'interaction-failed',
    browse,
    browse2,
    focusRes: focusRes || null,
    current: await cdp.evalv(fastExpr),
  };
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message || String(err));
    usage();
    process.exit(2);
  }

  const cdp = await connectPageTarget(opts.cdpPort);

  // --force-video-id: skip browse phase, navigate directly to TV watch URL.
  // Reset SPA state via TV home first (same pattern as navigateAndCaptureBrowse).
  if (opts.forceVideoId) {
    try {
      const tvWatchUrl = buildWatchUrlFromTvHomeUrl(opts.tvHomeUrl, opts.forceVideoId);
      await cdp.send('Page.navigate', { url: opts.tvHomeUrl });
      await cdp.waitLoad(5000);
      await sleep(200);
      await cdp.send('Page.navigate', { url: tvWatchUrl });
      await cdp.waitLoad(4000);
      console.log(JSON.stringify({
        ok: true,
        cdpPort: opts.cdpPort,
        method: 'force-video-id',
        videoId: opts.forceVideoId,
        tvWatchUrl,
        keyword: opts.keyword,
        pageTargetUrl: cdp.target.url,
      }, null, 2));
    } finally {
      try { cdp.ws.close(); } catch (_) {}
    }
    return;
  }

  const fastExpr = buildFastScanExpr(opts.keyword);
  const focusExpr = buildFocusMatchExpr(opts.keyword);
  const scrollExpr = buildScrollBrowseExpr();
  const failures = [];

  try {
    for (let round = 1; round <= opts.retries; round++) {
      const res = await tryOpenTarget(cdp, opts, fastExpr, focusExpr, scrollExpr, round);
      if (res.ok) {
        console.log(JSON.stringify({ ok: true, cdpPort: opts.cdpPort, browseUrl: opts.browseUrl, keyword: opts.keyword, verifyRegex: opts.verifyRegex, pageTargetUrl: cdp.target.url, ...res }, null, 2));
        return;
      }
      if (opts.verbose) failures.push(res);
      await sleep(200);
    }

    const final = await cdp.evalv(fastExpr);
    console.log(JSON.stringify({ ok: false, cdpPort: opts.cdpPort, browseUrl: opts.browseUrl, keyword: opts.keyword, verifyRegex: opts.verifyRegex, final, failures: opts.verbose ? failures : undefined }, null, 2));
    process.exit(1);
  } finally {
    try { cdp.ws.close(); } catch (_) {}
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
  });
}

module.exports = {
  buildWebWatchUrl,
  buildWatchUrlFromBrowseUrl,
  buildWatchUrlFromTvHomeUrl,
  deriveWebChannelStreamsUrl,
  findWebStreamsVideoId,
  parseArgs,
  pickDirectVideoId,
  shouldAttemptScrollSearch,
  verifyWatchState,
};
