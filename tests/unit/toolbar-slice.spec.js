/**
 * tests/unit/toolbar-slice.spec.js
 *
 * Unit tests for the Phase A4 toolbar store slice (ADR-032).
 * Run: npm run test:unit
 *
 * 4 cases:
 *  (a) defineSlice('toolbar') initial defaults: pinned/collapsed/dragActive=false,
 *      pos=null, dragOffset={x:0,y:0}.
 *  (b) update fires subscribers; dragOffset patch is shallow-merged.
 *  (c) batch with two toolbar updates fires subscribers exactly once.
 *  (d) store.select('toolbar.dragOffset.x') returns 0 from initial slice.
 *
 * ADR-013: Observable Store
 * ADR-032: Store-slice extraction part 2
 */
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const path     = require('node:path');

if (typeof global.window === 'undefined') {
  global.window = { location: { protocol: 'file:', hostname: 'localhost' } };
}

const { createStore } = require(
  path.resolve(__dirname, '../../editor/src/store.js')
);

function flushMicrotasks() {
  return new Promise(resolve => queueMicrotask(resolve));
}

function makeInitialToolbarSlice() {
  return {
    pinned: false,
    pos: null,
    collapsed: false,
    dragOffset: { x: 0, y: 0 },
    dragActive: false,
  };
}

test('(a) defineSlice toolbar: initial defaults match spec', () => {
  const store = createStore();
  store.defineSlice('toolbar', makeInitialToolbarSlice());
  const slice = store.get('toolbar');
  assert.equal(slice.pinned, false);
  assert.equal(slice.pos, null);
  assert.equal(slice.collapsed, false);
  assert.deepEqual(slice.dragOffset, { x: 0, y: 0 });
  assert.equal(slice.dragActive, false);
});

test('(b) store.update toolbar fires subscribers; replacing dragOffset works', async () => {
  const store = createStore();
  store.defineSlice('toolbar', makeInitialToolbarSlice());
  const calls = [];
  store.subscribe('toolbar', (next, prev) => calls.push({ next, prev }));
  store.update('toolbar', { dragOffset: { x: 12, y: 34 }, dragActive: true });
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].next.dragOffset, { x: 12, y: 34 });
  assert.equal(calls[0].next.dragActive, true);
});

test('(c) batch with two toolbar updates fires subscribers exactly once', async () => {
  const store = createStore();
  store.defineSlice('toolbar', makeInitialToolbarSlice());
  const calls = [];
  store.subscribe('toolbar', () => calls.push(1));
  store.batch(() => {
    store.update('toolbar', { pinned: true });
    store.update('toolbar', { collapsed: true });
  });
  assert.equal(calls.length, 0);
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  const slice = store.get('toolbar');
  assert.equal(slice.pinned, true);
  assert.equal(slice.collapsed, true);
});

test('(d) store.select toolbar.dragOffset.x returns 0 from initial slice', () => {
  const store = createStore();
  store.defineSlice('toolbar', makeInitialToolbarSlice());
  const val = store.select('toolbar.dragOffset.x');
  assert.equal(val, 0);
});
