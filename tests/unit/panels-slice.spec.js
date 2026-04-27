/**
 * tests/unit/panels-slice.spec.js
 *
 * Unit tests for the Phase A4 panels store slice (ADR-032).
 * Run: npm run test:unit
 *
 * 4 cases:
 *  (a) defineSlice('panels') succeeds with all-false defaults + empty inspectorSections.
 *  (b) store.update fires subscribers with next/prev.
 *  (c) batch with two panels updates fires subscribers exactly once.
 *  (d) store.select('panels.inspectorSections') returns empty plain object.
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

function makeInitialPanelsSlice() {
  return {
    leftOpen: false,
    rightOpen: false,
    rightUserOpen: false,
    inspectorSections: {},
  };
}

test('(a) defineSlice panels: all-false defaults + empty inspectorSections', () => {
  const store = createStore();
  store.defineSlice('panels', makeInitialPanelsSlice());
  const slice = store.get('panels');
  assert.equal(slice.leftOpen, false);
  assert.equal(slice.rightOpen, false);
  assert.equal(slice.rightUserOpen, false);
  assert.deepEqual(slice.inspectorSections, {});
});

test('(b) store.update panels fires subscribers with next and prev', async () => {
  const store = createStore();
  store.defineSlice('panels', makeInitialPanelsSlice());
  const calls = [];
  store.subscribe('panels', (next, prev) => calls.push({ next, prev }));
  store.update('panels', { leftOpen: true, rightUserOpen: true });
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].next.leftOpen, true);
  assert.equal(calls[0].next.rightUserOpen, true);
  assert.equal(calls[0].prev.leftOpen, false);
});

test('(c) batch with two panels updates fires subscribers exactly once', async () => {
  const store = createStore();
  store.defineSlice('panels', makeInitialPanelsSlice());
  const calls = [];
  store.subscribe('panels', () => calls.push(1));
  store.batch(() => {
    store.update('panels', { leftOpen: true });
    store.update('panels', { rightOpen: true });
  });
  assert.equal(calls.length, 0, 'batch must not fire synchronously');
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  const slice = store.get('panels');
  assert.equal(slice.leftOpen, true);
  assert.equal(slice.rightOpen, true);
});

test('(d) store.select panels.inspectorSections returns empty plain object', () => {
  const store = createStore();
  store.defineSlice('panels', makeInitialPanelsSlice());
  const val = store.select('panels.inspectorSections');
  assert.deepEqual(val, {});
});
