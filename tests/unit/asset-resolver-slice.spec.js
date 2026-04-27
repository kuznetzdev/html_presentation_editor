/**
 * tests/unit/asset-resolver-slice.spec.js
 *
 * Unit tests for the Phase A5 assetResolver store slice (ADR-033).
 * Run: npm run test:unit
 *
 * 4 cases:
 *  (a) defineSlice('assetResolver') succeeds; initial shape matches spec
 *      including null assetResolverMap, empty arrays, and zeroed audit counts.
 *  (b) store.update('assetResolver', { assetResolverMap: <Map> }) preserves
 *      Map ref-equality (no copy); subscribers fire with next/prev.
 *  (c) Map-typed value via the slice does not become prototype-polluted —
 *      assigning a key like '__proto__' to the slice's Map mutates the Map's
 *      entries, NOT Object.prototype. (Sanity check that Map semantics hold;
 *      this is NOT the SEC-006 guard, which lives on slideRegistryById and
 *      is verified by tests/playwright/specs/bridge-proto-pollution.spec.js.)
 *  (d) Sample consumer pattern: write list+counts in a single store.batch()
 *      fires subscribers exactly once and the slice exposes the new values.
 *
 * ADR-013: Observable Store
 * ADR-033: Store-slice extraction part 3 (assetResolver)
 */
'use strict';

const { test }  = require('node:test');
const assert    = require('node:assert/strict');
const path      = require('node:path');

if (typeof global.window === 'undefined') {
  global.window = { location: { protocol: 'file:', hostname: 'localhost' } };
}

const { createStore } = require(
  path.resolve(__dirname, '../../editor/src/store.js')
);

function flushMicrotasks() {
  return new Promise(resolve => queueMicrotask(resolve));
}

function makeInitialAssetResolverSlice() {
  return {
    assetResolverMap: null,
    assetResolverLabel: '',
    assetObjectUrls: [],
    assetFileCount: 0,
    resolvedPreviewAssets: [],
    unresolvedPreviewAssets: [],
    baseUrlDependentAssets: [],
    previewAssetAuditCounts: {
      resolved: 0,
      unresolved: 0,
      baseUrlDependent: 0,
    },
  };
}

test('(a) defineSlice assetResolver: initial shape matches the migrated state literal', () => {
  const store = createStore();
  store.defineSlice('assetResolver', makeInitialAssetResolverSlice());
  const slice = store.get('assetResolver');
  assert.equal(slice.assetResolverMap, null,
    'assetResolverMap defaults to null (Map ref written later by setAssetDirectoryFromFiles)');
  assert.equal(slice.assetResolverLabel, '');
  assert.deepEqual(slice.assetObjectUrls, []);
  assert.equal(slice.assetFileCount, 0);
  assert.deepEqual(slice.resolvedPreviewAssets, []);
  assert.deepEqual(slice.unresolvedPreviewAssets, []);
  assert.deepEqual(slice.baseUrlDependentAssets, []);
  assert.deepEqual(slice.previewAssetAuditCounts, {
    resolved: 0,
    unresolved: 0,
    baseUrlDependent: 0,
  });
});

test('(b) store.update preserves Map ref-equality and notifies subscribers', async () => {
  const store = createStore();
  store.defineSlice('assetResolver', makeInitialAssetResolverSlice());
  const calls = [];
  store.subscribe('assetResolver', (next, prev) => calls.push({ next, prev }));

  // Build a real Map (matching boot.js:1353 setAssetDirectoryFromFiles).
  const m = new Map();
  m.set('images/hero.png', 'blob:fake-001');
  m.set('./images/hero.png', 'blob:fake-001');

  store.update('assetResolver', {
    assetResolverMap: m,
    assetResolverLabel: 'hero · 1 файл',
    assetFileCount: 1,
    assetObjectUrls: ['blob:fake-001'],
  });
  await flushMicrotasks();

  assert.equal(calls.length, 1, 'subscribe should fire exactly once for a single update');
  assert.strictEqual(calls[0].next.assetResolverMap, m,
    'Map ref must be preserved (no shallow copy) — boot.js .has()/.get() depend on this');
  assert.equal(calls[0].next.assetResolverMap.get('images/hero.png'), 'blob:fake-001');
  assert.equal(calls[0].next.assetResolverLabel, 'hero · 1 файл');
  assert.equal(calls[0].next.assetFileCount, 1);
  assert.deepEqual(calls[0].next.assetObjectUrls, ['blob:fake-001']);
  // prev should retain the initial null/empty defaults
  assert.equal(calls[0].prev.assetResolverMap, null);
  assert.equal(calls[0].prev.assetFileCount, 0);
});

test('(c) Map semantics: setting "__proto__" key does NOT pollute Object.prototype', () => {
  const store = createStore();
  store.defineSlice('assetResolver', makeInitialAssetResolverSlice());
  const m = new Map();
  // Pre-condition: nothing on Object.prototype.polluted
  assert.equal(({}).polluted, undefined, 'pre-check: Object.prototype clean');

  // Attacker-controlled key — for a plain object dictionary this would be
  // an issue. For Map it is just a string entry.
  m.set('__proto__', { polluted: 'yes' });
  store.update('assetResolver', { assetResolverMap: m });

  const got = store.get('assetResolver').assetResolverMap;
  assert.strictEqual(got, m, 'slice stores the Map ref unchanged');
  assert.equal(got.get('__proto__').polluted, 'yes', 'Map entry retrievable by key');
  // The crucial assertion: Object.prototype was NOT modified.
  assert.equal(({}).polluted, undefined,
    'Map.set("__proto__", x) does NOT mutate Object.prototype — Map semantics hold');
});

test('(d) batch update of audit counts + list fires subscribers exactly once', async () => {
  const store = createStore();
  store.defineSlice('assetResolver', makeInitialAssetResolverSlice());
  const calls = [];
  store.subscribe('assetResolver', () => calls.push(1));

  // Mirrors the audit-capture sequence in boot.js:1548-1552 — a coalesced
  // 4-field update that consumers (broken-asset-banner, primary-action) read
  // together. With store.batch() this should fan out as ONE notification.
  store.batch(() => {
    store.update('assetResolver', {
      resolvedPreviewAssets: ['images/a.png', 'images/b.png'],
    });
    store.update('assetResolver', {
      unresolvedPreviewAssets: ['missing/x.png'],
      baseUrlDependentAssets: ['../shared/c.png'],
    });
    store.update('assetResolver', {
      previewAssetAuditCounts: {
        resolved: 2,
        unresolved: 1,
        baseUrlDependent: 1,
      },
    });
  });
  assert.equal(calls.length, 0, 'batch must not fire synchronously');
  await flushMicrotasks();
  assert.equal(calls.length, 1, 'batch must fire exactly one notification');

  const slice = store.get('assetResolver');
  assert.deepEqual(slice.resolvedPreviewAssets, ['images/a.png', 'images/b.png']);
  assert.deepEqual(slice.unresolvedPreviewAssets, ['missing/x.png']);
  assert.deepEqual(slice.baseUrlDependentAssets, ['../shared/c.png']);
  assert.deepEqual(slice.previewAssetAuditCounts, {
    resolved: 2,
    unresolved: 1,
    baseUrlDependent: 1,
  });
});
