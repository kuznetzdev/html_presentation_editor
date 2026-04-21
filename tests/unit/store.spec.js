/**
 * tests/unit/store.spec.js
 *
 * Unit tests for editor/src/store.js using Node built-in test runner.
 * Run: npm run test:unit
 *
 * 12 cases covering: get, update, subscribe, batch, path-subscribe,
 * coalescing, freeze, unsubscribe, nested batch, and safe select.
 *
 * ADR-013: Observable Store
 */
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const path     = require('node:path');

// Simulate browser dev environment so store._isDev = true (enables Object.freeze)
// Must be set before requiring store.js so the IIFE inside createStore sees it.
if (typeof global.window === 'undefined') {
  global.window = { location: { protocol: 'file:', hostname: 'localhost' } };
}

// Load store factory (CommonJS export added for Node compatibility)
const { createStore } = require(
  path.resolve(__dirname, '../../editor/src/store.js')
);

// Helper: flush all microtasks
function flushMicrotasks() {
  return new Promise(resolve => queueMicrotask(resolve));
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) get returns frozen object
// ─────────────────────────────────────────────────────────────────────────────
test('(a) get returns frozen object', () => {
  const store = createStore();
  store.defineSlice('ui', { theme: 'light', count: 0 });
  const slice = store.get('ui');
  assert.equal(Object.isFrozen(slice), true, 'slice should be frozen in dev mode');
  assert.equal(slice.theme, 'light');
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) update produces new identity (immutable update)
// ─────────────────────────────────────────────────────────────────────────────
test('(b) update produces new identity', async () => {
  const store = createStore();
  store.defineSlice('ui', { theme: 'light' });
  const before = store.get('ui');
  store.update('ui', { theme: 'dark' });
  const after = store.get('ui');
  await flushMicrotasks();
  assert.notEqual(before, after, 'update must produce a new object reference');
  assert.equal(after.theme, 'dark');
  assert.equal(before.theme, 'light', 'previous snapshot must be unchanged');
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) subscribe fires with (next, prev)
// ─────────────────────────────────────────────────────────────────────────────
test('(c) subscribe fires with next and prev', async () => {
  const store = createStore();
  store.defineSlice('ui', { theme: 'light' });
  const calls = [];
  store.subscribe('ui', (next, prev) => calls.push({ next, prev }));
  store.update('ui', { theme: 'dark' });
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].next.theme, 'dark');
  assert.equal(calls[0].prev.theme, 'light');
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) update outside batch fires exactly one microtask notification
// ─────────────────────────────────────────────────────────────────────────────
test('(d) update outside batch fires one microtask notification', async () => {
  const store = createStore();
  store.defineSlice('ui', { theme: 'light' });
  const calls = [];
  store.subscribe('ui', () => calls.push(1));
  store.update('ui', { theme: 'dark' });
  // Notification not yet fired (microtask pending)
  assert.equal(calls.length, 0, 'notification must not be synchronous');
  await flushMicrotasks();
  assert.equal(calls.length, 1, 'exactly one notification after microtask flush');
});

// ─────────────────────────────────────────────────────────────────────────────
// (e) update inside batch fires one microtask total
// ─────────────────────────────────────────────────────────────────────────────
test('(e) update inside batch fires one microtask total', async () => {
  const store = createStore();
  store.defineSlice('ui', { theme: 'light', zoom: 1.0 });
  const calls = [];
  store.subscribe('ui', () => calls.push(1));
  store.batch(() => {
    store.update('ui', { theme: 'dark' });
    store.update('ui', { zoom: 1.5 });
  });
  assert.equal(calls.length, 0, 'batch must not fire synchronously');
  await flushMicrotasks();
  assert.equal(calls.length, 1, 'batch must fire exactly one notification total');
  assert.equal(store.get('ui').theme, 'dark');
  assert.equal(store.get('ui').zoom, 1.5);
});

// ─────────────────────────────────────────────────────────────────────────────
// (f) path subscribe fires only when that specific key changes
// ─────────────────────────────────────────────────────────────────────────────
test('(f) path subscribe fires only when that path changes', async () => {
  const store = createStore();
  store.defineSlice('ui', { theme: 'light', zoom: 1.0 });
  const themeCalls = [];
  const zoomCalls  = [];
  store.subscribe('ui.theme', (next, prev) => themeCalls.push({ next, prev }));
  store.subscribe('ui.zoom',  (next, prev) => zoomCalls.push({ next, prev }));

  // Only change zoom
  store.update('ui', { zoom: 1.5 });
  await flushMicrotasks();
  assert.equal(themeCalls.length, 0, 'theme subscriber must NOT fire when only zoom changes');
  assert.equal(zoomCalls.length, 1,  'zoom subscriber must fire');
  assert.equal(zoomCalls[0].next, 1.5);
  assert.equal(zoomCalls[0].prev, 1.0);
});

// ─────────────────────────────────────────────────────────────────────────────
// (g) defineSlice + subscribe fires after subsequent update
// ─────────────────────────────────────────────────────────────────────────────
test('(g) defineSlice then subscribe fires after update', async () => {
  const store = createStore();
  store.defineSlice('prefs', { lang: 'ru' });
  const calls = [];
  store.subscribe('prefs', (next) => calls.push(next));
  store.update('prefs', { lang: 'en' });
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].lang, 'en');
});

// ─────────────────────────────────────────────────────────────────────────────
// (h) multiple sequential updates outside batch coalesce to one notification
// ─────────────────────────────────────────────────────────────────────────────
test('(h) multiple sequential updates coalesce to one notification', async () => {
  const store = createStore();
  store.defineSlice('ui', { a: 0, b: 0, c: 0 });
  const calls = [];
  store.subscribe('ui', () => calls.push(1));
  store.update('ui', { a: 1 });
  store.update('ui', { b: 2 });
  store.update('ui', { c: 3 });
  assert.equal(calls.length, 0);
  await flushMicrotasks();
  // All three updates were scheduled before microtask flushed — should coalesce
  assert.equal(calls.length, 1, 'sequential updates must coalesce into one notification');
  const final = store.get('ui');
  assert.equal(final.a, 1);
  assert.equal(final.b, 2);
  assert.equal(final.c, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// (i) attempting to mutate a frozen slice throws in dev (strict) mode
// ─────────────────────────────────────────────────────────────────────────────
test('(i) direct mutation of frozen slice throws in dev mode', () => {
  const store = createStore();
  store.defineSlice('ui', { theme: 'light' });
  const slice = store.get('ui');
  // In dev mode, Object.freeze is applied — direct mutation must throw
  assert.throws(
    () => { slice.theme = 'dark'; },
    /Cannot assign to read only property|Cannot set property/i,
    'direct mutation of a frozen slice must throw'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// (j) unsubscribe stops firing
// ─────────────────────────────────────────────────────────────────────────────
test('(j) unsubscribe stops firing', async () => {
  const store = createStore();
  store.defineSlice('ui', { theme: 'light' });
  const calls = [];
  const unsub = store.subscribe('ui', () => calls.push(1));

  store.update('ui', { theme: 'dark' });
  await flushMicrotasks();
  assert.equal(calls.length, 1, 'subscriber fires before unsubscribe');

  unsub();
  store.update('ui', { theme: 'light' });
  await flushMicrotasks();
  assert.equal(calls.length, 1, 'subscriber must NOT fire after unsubscribe');
});

// ─────────────────────────────────────────────────────────────────────────────
// (k) batch inside batch nests correctly (one flush on outermost exit)
// ─────────────────────────────────────────────────────────────────────────────
test('(k) batch inside batch nests correctly', async () => {
  const store = createStore();
  store.defineSlice('ui', { x: 0, y: 0, z: 0 });
  const calls = [];
  store.subscribe('ui', () => calls.push(store.get('ui').x));

  store.batch(() => {
    store.update('ui', { x: 1 });
    store.batch(() => {
      store.update('ui', { y: 2 });
      store.update('ui', { z: 3 });
    });
    // Still inside outer batch — no flush yet
    store.update('ui', { x: 4 });
  });

  assert.equal(calls.length, 0, 'no notification while outermost batch is open');
  await flushMicrotasks();
  assert.equal(calls.length, 1, 'exactly one notification when outermost batch closes');
  const final = store.get('ui');
  assert.equal(final.x, 4);
  assert.equal(final.y, 2);
  assert.equal(final.z, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// (l) select('missing.path') returns undefined without throwing
// ─────────────────────────────────────────────────────────────────────────────
test('(l) select missing path returns undefined without throwing', () => {
  const store = createStore();
  store.defineSlice('ui', { theme: 'light' });

  assert.equal(store.select('ui.nonExistent'), undefined, 'missing key returns undefined');
  assert.equal(store.select('noSlice.key'),    undefined, 'missing slice returns undefined');
  assert.equal(store.select(''),               undefined, 'empty path returns undefined');
  assert.equal(store.select('ui.deep.nested'), undefined, 'deep missing path returns undefined');
});
