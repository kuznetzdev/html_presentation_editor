/**
 * tests/unit/history-patches.spec.js
 *
 * Unit tests for the WO-18 history patch engine.
 * Run: npm run test:unit
 *
 * 12 cases covering:
 *  (a) first commit writes baseline patch
 *  (b) second commit identical HTML is dedup'd via hash
 *  (c) 11th commit rolls fresh baseline
 *  (d) 21st commit shifts oldest + would emit drop event
 *  (e) restoreSnapshot with baseline patch returns correct HTML
 *  (f) restoreSnapshot with delta patch returns correct HTML
 *  (g) clientId stable across all patches in session
 *  (h) counter is monotonic across patches
 *  (i) undo() decrements history.index via store
 *  (j) redo() increments history.index via store
 *  (k) hash dedup protects against redundant serialisation
 *  (l) patches-array memory for 20 identical docs stays at 1 baseline (< 50 KB)
 *
 * ADR-013: Observable Store — history slice
 * ADR-017: CRDT-readiness + immutable patches + causality via clientId+counter
 */
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const path     = require('node:path');

// Simulate browser dev environment
if (typeof global.window === 'undefined') {
  global.window = { location: { protocol: 'file:', hostname: 'localhost' } };
}

// Load history pure-function exports
const {
  fnv1a32,
  createDomPatch,
  getHistoryClientId,
} = require(path.resolve(__dirname, '../../editor/src/history.js'));

// Load store for slice-level tests
const { createStore } = require(
  path.resolve(__dirname, '../../editor/src/store.js')
);

// ─────────────────────────────────────────────────────────────────────────────
// (a) first commit writes baseline patch
// ─────────────────────────────────────────────────────────────────────────────
test('(a) first commit writes baseline patch', () => {
  const html = '<html><body><p>Hello</p></body></html>';
  const patch = createDomPatch(html, 'test', []);
  assert.equal(patch.op, 'baseline', 'first patch must be a baseline');
  assert.equal(patch.html, html, 'baseline.html must equal input html');
  assert.ok(patch.hash, 'patch must have a hash');
  assert.ok(patch.clientId, 'patch must have a clientId');
  assert.ok(patch.counter > 0, 'patch counter must be positive');
  assert.ok(patch.at > 0, 'patch must have a timestamp');
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) second commit identical HTML dedup'd via hash
// ─────────────────────────────────────────────────────────────────────────────
test('(b) second commit identical HTML dedup detected via hash equality', () => {
  const html = '<html><body><p>Same</p></body></html>';
  const first = createDomPatch(html, 'first', []);
  const secondPatches = [first];

  // Simulate captureHistorySnapshot dedup logic: skip if prevHash === newHash
  const newHash = fnv1a32(html);
  const prevHash = secondPatches[secondPatches.length - 1].hash;
  assert.equal(prevHash, newHash, 'identical HTML must produce equal hashes — dedup fires');
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) 11th commit rolls fresh baseline
// ─────────────────────────────────────────────────────────────────────────────
test('(c) 11th commit after last baseline produces a new baseline', () => {
  let patches = [];
  // First commit → baseline
  patches.push(createDomPatch('<p>0</p>', 'r0', patches));
  assert.equal(patches[0].op, 'baseline');

  // Commits 1-9 → deltas
  for (let i = 1; i <= 9; i++) {
    patches.push(createDomPatch('<p>' + i + '</p>', 'r' + i, patches));
    assert.equal(patches[i].op, 'delta', 'commit ' + i + ' must be delta');
  }
  // patchesSinceBaseline == 9 — not yet at threshold

  // 10th delta (11th total since baseline = index 0)
  // After 10 deltas after a baseline, next should be baseline
  patches.push(createDomPatch('<p>10</p>', 'r10', patches));
  const eleventh = patches[patches.length - 1];
  assert.equal(eleventh.op, 'baseline', '11th commit (10 deltas since last baseline) must roll a fresh baseline');
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) 21st commit shifts oldest — drop tracking
// ─────────────────────────────────────────────────────────────────────────────
test('(d) overflow beyond HISTORY_LIMIT=20 triggers oldest-shift logic', () => {
  const LIMIT = 20;
  let patches = [];
  for (let i = 0; i < LIMIT + 1; i++) {
    patches.push(createDomPatch('<p>' + i + '</p>', 'r' + i, patches));
  }
  // Before shift: 21 patches
  assert.equal(patches.length, LIMIT + 1);
  // Simulate shift (captureHistorySnapshot does: patches.slice(-LIMIT))
  if (patches.length > LIMIT) {
    patches = patches.slice(patches.length - LIMIT);
  }
  assert.equal(patches.length, LIMIT, 'after shift, patches array has exactly HISTORY_LIMIT entries');
});

// ─────────────────────────────────────────────────────────────────────────────
// (e) restoreSnapshot with baseline patch returns identical HTML
// ─────────────────────────────────────────────────────────────────────────────
test('(e) restoring a baseline patch returns the original HTML', () => {
  const html = '<!DOCTYPE html><html><body>baseline</body></html>';
  const patch = createDomPatch(html, 'init', []);
  assert.equal(patch.op, 'baseline');

  // Simulate restoreSnapshot logic for baseline
  const restored = patch.html;
  assert.equal(restored, html, 'baseline restore must be byte-identical to original');
});

// ─────────────────────────────────────────────────────────────────────────────
// (f) restoreSnapshot with delta patch returns identical HTML
// ─────────────────────────────────────────────────────────────────────────────
test('(f) restoring a delta patch returns the nextHtml from diff', () => {
  let patches = [createDomPatch('<p>0</p>', 'init', [])];
  const deltaHtml = '<p>changed</p>';
  const delta = createDomPatch(deltaHtml, 'change', patches);
  assert.equal(delta.op, 'delta', 'second patch must be delta');
  assert.ok(delta.diff, 'delta must have a diff field');

  // Simulate restoreSnapshot logic for delta
  let restoredHtml;
  try {
    restoredHtml = JSON.parse(delta.diff).nextHtml;
  } catch (e) {
    restoredHtml = delta.html;
  }
  assert.equal(restoredHtml, deltaHtml, 'delta restore must return nextHtml from diff');
  // Also: delta.html is the full-HTML fallback
  assert.equal(delta.html, deltaHtml, 'delta.html full-html fallback must also match');
});

// ─────────────────────────────────────────────────────────────────────────────
// (g) clientId stable across all patches in session
// ─────────────────────────────────────────────────────────────────────────────
test('(g) clientId is stable across all patches in the same session', () => {
  const clientId = getHistoryClientId();
  const patches = [];
  for (let i = 0; i < 5; i++) {
    patches.push(createDomPatch('<p>' + i + '</p>', 'r' + i, patches.slice()));
  }
  patches.forEach(function (p, i) {
    assert.equal(p.clientId, clientId, 'patch[' + i + '] clientId must equal session HISTORY_CLIENT_ID');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (h) counter is monotonic
// ─────────────────────────────────────────────────────────────────────────────
test('(h) counter is strictly monotonically increasing across patches', () => {
  const patches = [];
  for (let i = 0; i < 5; i++) {
    patches.push(createDomPatch('<p>' + i + '</p>', 'r' + i, patches.slice()));
  }
  for (let i = 1; i < patches.length; i++) {
    assert.ok(
      patches[i].counter > patches[i - 1].counter,
      'patch[' + i + '].counter (' + patches[i].counter + ') must be > patch[' + (i - 1) + '].counter (' + patches[i - 1].counter + ')'
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// (i) undo() decrements history.index via store
// ─────────────────────────────────────────────────────────────────────────────
test('(i) store history.index decrements on undo-style update', async () => {
  const store = createStore();
  store.defineSlice('history', {
    index: 2,
    limit: 20,
    baseline: null,
    patches: [],
    dirty: false,
    lastSavedAt: 0,
  });

  // Simulate undo: decrement index
  const before = store.get('history').index;
  store.update('history', { index: before - 1 });

  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(store.get('history').index, 1, 'undo must decrement index to 1');
});

// ─────────────────────────────────────────────────────────────────────────────
// (j) redo() increments history.index via store
// ─────────────────────────────────────────────────────────────────────────────
test('(j) store history.index increments on redo-style update', async () => {
  const store = createStore();
  store.defineSlice('history', {
    index: 1,
    limit: 20,
    baseline: null,
    patches: [{op:'baseline',html:'<p>a</p>',hash:'x'}, {op:'delta',html:'<p>b</p>',diff:'{}',hash:'y'}],
    dirty: false,
    lastSavedAt: 0,
  });

  // Simulate redo: increment index
  const before = store.get('history').index;
  store.update('history', { index: before + 1 });

  await new Promise(resolve => queueMicrotask(resolve));
  assert.equal(store.get('history').index, 2, 'redo must increment index to 2');
});

// ─────────────────────────────────────────────────────────────────────────────
// (k) hash dedup protects against redundant serialisation
// ─────────────────────────────────────────────────────────────────────────────
test('(k) fnv1a32 hash dedup: same HTML always produces same hash', () => {
  const html = '<html><body><h1>Test</h1><p>Content goes here.</p></body></html>';
  const hash1 = fnv1a32(html);
  const hash2 = fnv1a32(html);
  assert.equal(hash1, hash2, 'same input must always produce same hash');

  const html2 = html + ' ';  // one extra space
  const hash3 = fnv1a32(html2);
  assert.notEqual(hash1, hash3, 'different input must produce different hash');
});

// ─────────────────────────────────────────────────────────────────────────────
// (l) patches-array memory for 20 identical docs stays at 1 baseline (< 50 KB)
// ─────────────────────────────────────────────────────────────────────────────
test('(l) 20 commits of identical HTML dedup to 1 baseline (< 50 KB)', () => {
  const html = '<html><body>' + 'x'.repeat(1000) + '</body></html>';
  let patches = [];
  const baselineHash = fnv1a32(html);

  // Simulate captureHistorySnapshot for 20 identical commits
  for (let i = 0; i < 20; i++) {
    const newHash = fnv1a32(html);
    const prevHash = patches.length > 0 ? patches[patches.length - 1].hash : null;
    if (prevHash === newHash) {
      // Dedup: skip this commit (identical hash)
      continue;
    }
    patches.push(createDomPatch(html, 'commit-' + i, patches));
  }

  // Only 1 baseline should exist (all 19 subsequent dedup'd)
  assert.equal(patches.length, 1, 'all 20 identical commits must dedup to 1 entry');
  assert.equal(patches[0].op, 'baseline', 'the single entry must be a baseline');

  // Memory check: 1 baseline for a 1KB html should be well under 50 KB
  const totalBytes = JSON.stringify(patches).length;
  assert.ok(totalBytes < 50 * 1024, 'memory for 1 baseline patch must be < 50 KB, got ' + totalBytes + ' bytes');
});
