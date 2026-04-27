/**
 * tests/unit/multi-select-slice.spec.js
 *
 * Unit tests for the Phase A4 multiSelect store slice (ADR-032).
 * Run: npm run test:unit
 *
 * 4 cases:
 *  (a) defineSlice('multiSelect') succeeds; initial nodeIds = []; anchorNodeId = null
 *  (b) store.update('multiSelect', { nodeIds: [...] }) fires subscribers
 *  (c) store.batch with two multiSelect updates fires subscribers exactly once
 *  (d) store.select('multiSelect.anchorNodeId') returns null from initial slice
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

function makeInitialMultiSelectSlice() {
  return {
    nodeIds: [],
    anchorNodeId: null,
  };
}

test('(a) defineSlice multiSelect: initial nodeIds is empty array; anchorNodeId is null', () => {
  const store = createStore();
  store.defineSlice('multiSelect', makeInitialMultiSelectSlice());
  const slice = store.get('multiSelect');
  assert.deepEqual(slice.nodeIds, [], 'nodeIds should be empty array at init');
  assert.equal(slice.anchorNodeId, null, 'anchorNodeId should be null at init');
});

test('(b) store.update multiSelect fires subscribers with next and prev', async () => {
  const store = createStore();
  store.defineSlice('multiSelect', makeInitialMultiSelectSlice());
  const calls = [];
  store.subscribe('multiSelect', (next, prev) => calls.push({ next, prev }));
  store.update('multiSelect', { nodeIds: ['n1', 'n2', 'n3'], anchorNodeId: 'n1' });
  await flushMicrotasks();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].next.nodeIds, ['n1', 'n2', 'n3']);
  assert.equal(calls[0].next.anchorNodeId, 'n1');
  assert.deepEqual(calls[0].prev.nodeIds, []);
  assert.equal(calls[0].prev.anchorNodeId, null);
});

test('(c) batch with two multiSelect updates fires subscribers exactly once', async () => {
  const store = createStore();
  store.defineSlice('multiSelect', makeInitialMultiSelectSlice());
  const calls = [];
  store.subscribe('multiSelect', () => calls.push(1));
  store.batch(() => {
    store.update('multiSelect', { nodeIds: ['n1'] });
    store.update('multiSelect', { anchorNodeId: 'n1' });
  });
  assert.equal(calls.length, 0, 'batch must not fire synchronously');
  await flushMicrotasks();
  assert.equal(calls.length, 1, 'batch must fire exactly one notification');
  const slice = store.get('multiSelect');
  assert.deepEqual(slice.nodeIds, ['n1']);
  assert.equal(slice.anchorNodeId, 'n1');
});

test('(d) store.select multiSelect.anchorNodeId returns null from initial slice', () => {
  const store = createStore();
  store.defineSlice('multiSelect', makeInitialMultiSelectSlice());
  const val = store.select('multiSelect.anchorNodeId');
  assert.equal(val, null);
  const ids = store.select('multiSelect.nodeIds');
  assert.deepEqual(ids, []);
});
