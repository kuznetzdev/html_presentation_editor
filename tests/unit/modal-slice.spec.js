/**
 * tests/unit/modal-slice.spec.js
 *
 * Unit tests for the Phase A4 modal store slice (ADR-032).
 * Run: npm run test:unit
 *
 * 4 cases:
 *  (a) defineSlice('modal') succeeds with all-null + activeIndex:-1 defaults.
 *  (b) update fires subscribers; htmlEditor* group can be patched together.
 *  (c) batch with two modal updates fires subscribers exactly once.
 *  (d) store.select('modal.layerPickerActiveIndex') returns -1 from initial slice.
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

function makeInitialModalSlice() {
  return {
    htmlEditorMode: null,
    htmlEditorTargetId: null,
    htmlEditorTargetType: null,
    contextMenuNodeId: null,
    contextMenuPayload: null,
    layerPickerPayload: null,
    layerPickerHighlightNodeId: null,
    layerPickerActiveIndex: -1,
  };
}

test('(a) defineSlice modal: initial null defaults + layerPickerActiveIndex:-1', () => {
  const store = createStore();
  store.defineSlice('modal', makeInitialModalSlice());
  const slice = store.get('modal');
  assert.equal(slice.htmlEditorMode, null);
  assert.equal(slice.htmlEditorTargetId, null);
  assert.equal(slice.htmlEditorTargetType, null);
  assert.equal(slice.contextMenuNodeId, null);
  assert.equal(slice.contextMenuPayload, null);
  assert.equal(slice.layerPickerPayload, null);
  assert.equal(slice.layerPickerHighlightNodeId, null);
  assert.equal(slice.layerPickerActiveIndex, -1);
});

test('(b) store.update modal fires subscribers; htmlEditor group patch works', async () => {
  const store = createStore();
  store.defineSlice('modal', makeInitialModalSlice());
  const calls = [];
  store.subscribe('modal', (next, prev) => calls.push({ next, prev }));
  store.update('modal', {
    htmlEditorMode: 'element',
    htmlEditorTargetId: 'node-7',
    htmlEditorTargetType: 'node',
  });
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].next.htmlEditorMode, 'element');
  assert.equal(calls[0].next.htmlEditorTargetId, 'node-7');
  assert.equal(calls[0].next.htmlEditorTargetType, 'node');
  // Other fields preserved
  assert.equal(calls[0].next.contextMenuNodeId, null);
  assert.equal(calls[0].next.layerPickerActiveIndex, -1);
});

test('(c) batch with two modal updates fires subscribers exactly once', async () => {
  const store = createStore();
  store.defineSlice('modal', makeInitialModalSlice());
  const calls = [];
  store.subscribe('modal', () => calls.push(1));
  store.batch(() => {
    store.update('modal', { contextMenuNodeId: 'node-3' });
    store.update('modal', { contextMenuPayload: { x: 100, y: 200 } });
  });
  assert.equal(calls.length, 0);
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  const slice = store.get('modal');
  assert.equal(slice.contextMenuNodeId, 'node-3');
  assert.deepEqual(slice.contextMenuPayload, { x: 100, y: 200 });
});

test('(d) store.select modal.layerPickerActiveIndex returns -1 from initial slice', () => {
  const store = createStore();
  store.defineSlice('modal', makeInitialModalSlice());
  const val = store.select('modal.layerPickerActiveIndex');
  assert.equal(val, -1);
});
