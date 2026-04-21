/**
 * tests/unit/selection-slice.spec.js
 *
 * Unit tests for the WO-17 selection slice migration.
 * Run: npm run test:unit
 *
 * 8 cases:
 *  (a) defineSlice('selection') succeeds; initial activeNodeId is null
 *  (b) store.update('selection', ...) fires subscribers with next+prev
 *  (c) store.batch with two selection updates fires subscribers exactly once
 *  (d) createDefaultSelectionPolicy({isSlideRoot:true}) returns kind:'slide-root'
 *  (e) createDefaultSelectionPolicy({isTable:true, isCodeBlock:true}) resolves to isTable per priority
 *  (f) createDefaultSelectionPolicy output matches golden object for isSlideRoot:true
 *  (g) createDefaultSelectionPolicy() with no flags returns kind:'free' with canEditStyles:true
 *  (h) store.select('selection.entityKind') returns 'none' from initial slice
 *
 * ADR-013: Observable Store — selection slice
 * ADR-017: CRDT-readiness checklist
 */
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const path     = require('node:path');

// Simulate browser dev environment so store._isDev = true (enables Object.freeze)
if (typeof global.window === 'undefined') {
  global.window = { location: { protocol: 'file:', hostname: 'localhost' } };
}

// Load store factory
const { createStore } = require(
  path.resolve(__dirname, '../../editor/src/store.js')
);

// Helper: flush all microtasks
function flushMicrotasks() {
  return new Promise(resolve => queueMicrotask(resolve));
}

// ─────────────────────────────────────────────────────────────────────────────
// Local copy of createDefaultSelectionPolicy + SELECTION_POLICY_TABLE
// Copied from editor/src/state.js for isolated policy tests (d,e,f,g).
// This avoids loading state.js (which requires full browser DOM environment).
// IMPORTANT: Keep in sync with state.js — must be byte-identical logic.
// ─────────────────────────────────────────────────────────────────────────────

var SELECTION_POLICY_TABLE = [
  {
    flag: "isSlideRoot",
    kind: "slide-root",
    reason: "Корневой контейнер слайда редактируется только в безопасном режиме.",
    overrides: {
      canEditText: false,
      canEditAttributes: false,
      canEditHtml: false,
      canEditSlideHtml: true,
      canMove: false,
      canResize: false,
      canNudge: false,
      canReorder: false,
      canDelete: false,
      canDuplicate: false,
      canWrap: false,
      canAddChild: true,
      canReplaceMedia: false,
    },
  },
  {
    flag: "isProtected",
    kind: "critical-structure",
    reason: "Системный контейнер deck защищён от прямого редактирования и structural-операций.",
    overrides: {
      canEditText: false,
      canEditStyles: false,
      canEditAttributes: false,
      canEditHtml: false,
      canEditSlideHtml: false,
      canMove: false,
      canResize: false,
      canNudge: false,
      canReorder: false,
      canDelete: false,
      canDuplicate: false,
      canWrap: false,
      canAddChild: false,
      canReplaceMedia: false,
    },
  },
  {
    flag: "isTable",
    kind: "structured-table",
    reason: "Таблица импортирована как структурированный DOM-блок: безопаснее редактировать ячейки, а не сырой HTML.",
    overrides: {
      canEditText: false,
      canEditAttributes: false,
      canEditHtml: false,
      canDelete: false,
      canWrap: false,
      canAddChild: false,
      canReplaceMedia: false,
    },
  },
  {
    flag: "isCodeBlock",
    kind: "plain-text-block",
    reason: "Code block сохраняет пробелы и переносы строк. Избегайте raw HTML replacement.",
    overrides: {
      canEditAttributes: false,
      canEditHtml: false,
      canAddChild: false,
      canReplaceMedia: false,
    },
  },
  {
    flag: "isSvg",
    kind: "svg-object",
    reason: "Inline SVG импортирован как object-level блок. Внутреннюю векторную структуру нужно сохранять.",
    overrides: {
      canEditText: false,
      canEditAttributes: false,
      canEditHtml: false,
      canDelete: false,
      canWrap: false,
      canAddChild: false,
      canReplaceMedia: false,
    },
  },
  {
    flag: "isFragment",
    kind: "stateful-wrapper",
    reason: "Stateful wrapper сохраняет fragment/state classes и data-* атрибуты.",
    overrides: {
      canEditAttributes: false,
      canEditHtml: false,
      canWrap: false,
      canAddChild: false,
      canReplaceMedia: false,
    },
  },
];

function createDefaultSelectionPolicy(flags) {
  flags = flags || {};
  var policy = {
    kind: "free",
    reason: "",
    canEditText: Boolean(flags.canEditText),
    canEditStyles: true,
    canEditAttributes: true,
    canEditHtml: true,
    canEditSlideHtml: false,
    canMove: true,
    canResize: true,
    canNudge: true,
    canReorder: true,
    canDelete: true,
    canDuplicate: true,
    canWrap: true,
    canAddChild: Boolean(flags.isContainer),
    canReplaceMedia: Boolean(flags.isImage || flags.isVideo),
  };

  for (var i = 0; i < SELECTION_POLICY_TABLE.length; i++) {
    var entry = SELECTION_POLICY_TABLE[i];
    if (flags[entry.flag]) {
      return Object.assign({}, policy, { kind: entry.kind, reason: entry.reason }, entry.overrides);
    }
  }

  return policy;
}

// ─────────────────────────────────────────────────────────────────────────────
// Initial selection slice shape used by store tests
// ─────────────────────────────────────────────────────────────────────────────
function makeInitialSelectionSlice() {
  return {
    activeNodeId: null,
    activeSlideId: null,
    selectionPath: [],
    leafNodeId: null,
    tag: null,
    computed: null,
    html: '',
    rect: null,
    attrs: {},
    entityKind: 'none',
    flags: {
      canEditText: false,
      isImage: false,
      isVideo: false,
      isContainer: false,
      isSlideRoot: false,
      isProtected: false,
      isTextEditing: false,
    },
    policy: createDefaultSelectionPolicy(),
    liveRect: null,
    manipulationContext: null,
    clickThroughState: null,
    runtimeActiveSlideId: null,
    overlapIndex: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) defineSlice('selection') succeeds and initial activeNodeId is null
// ─────────────────────────────────────────────────────────────────────────────
test('(a) defineSlice selection: initial activeNodeId is null', () => {
  const store = createStore();
  store.defineSlice('selection', makeInitialSelectionSlice());
  const slice = store.get('selection');
  assert.equal(slice.activeNodeId, null, 'activeNodeId should be null at init');
  assert.equal(slice.entityKind, 'none', 'entityKind should be none at init');
  assert.equal(slice.overlapIndex, 0, 'overlapIndex should be 0 at init');
  assert.equal(slice.html, '', 'html should be empty string at init');
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) store.update('selection', ...) fires subscribers with next+prev
// ─────────────────────────────────────────────────────────────────────────────
test('(b) store.update selection fires subscribers with next and prev', async () => {
  const store = createStore();
  store.defineSlice('selection', makeInitialSelectionSlice());
  const calls = [];
  store.subscribe('selection', (next, prev) => calls.push({ next, prev }));
  store.update('selection', { activeNodeId: 'node-7' });
  await flushMicrotasks();
  assert.equal(calls.length, 1, 'subscriber should fire exactly once');
  assert.equal(calls[0].next.activeNodeId, 'node-7', 'next.activeNodeId should be node-7');
  assert.equal(calls[0].prev.activeNodeId, null, 'prev.activeNodeId should be null');
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) store.batch with two selection updates fires subscribers exactly once
// ─────────────────────────────────────────────────────────────────────────────
test('(c) batch with two selection updates fires subscribers exactly once', async () => {
  const store = createStore();
  store.defineSlice('selection', makeInitialSelectionSlice());
  const calls = [];
  store.subscribe('selection', () => calls.push(1));
  store.batch(() => {
    store.update('selection', { activeNodeId: 'node-7' });
    store.update('selection', { entityKind: 'text' });
  });
  assert.equal(calls.length, 0, 'batch must not fire synchronously');
  await flushMicrotasks();
  assert.equal(calls.length, 1, 'batch must fire exactly one notification');
  const slice = store.get('selection');
  assert.equal(slice.activeNodeId, 'node-7');
  assert.equal(slice.entityKind, 'text');
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) createDefaultSelectionPolicy({isSlideRoot:true}) returns kind:'slide-root'
// ─────────────────────────────────────────────────────────────────────────────
test('(d) createDefaultSelectionPolicy isSlideRoot returns kind slide-root', () => {
  const policy = createDefaultSelectionPolicy({ isSlideRoot: true });
  assert.equal(policy.kind, 'slide-root');
  assert.equal(policy.canEditText, false);
  assert.equal(policy.canEditSlideHtml, true);
  assert.equal(policy.canMove, false);
  assert.equal(policy.canDelete, false);
  assert.equal(policy.canAddChild, true);
  assert.equal(policy.canReplaceMedia, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// (e) createDefaultSelectionPolicy({isTable:true, isCodeBlock:true})
//     resolves to isTable per priority (isTable comes before isCodeBlock in table)
// ─────────────────────────────────────────────────────────────────────────────
test('(e) priority: isTable wins over isCodeBlock', () => {
  const policy = createDefaultSelectionPolicy({ isTable: true, isCodeBlock: true });
  assert.equal(policy.kind, 'structured-table', 'isTable has higher priority than isCodeBlock');
  assert.equal(
    policy.reason,
    'Таблица импортирована как структурированный DOM-блок: безопаснее редактировать ячейки, а не сырой HTML.',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// (f) createDefaultSelectionPolicy output matches golden object for isSlideRoot:true
// ─────────────────────────────────────────────────────────────────────────────
test('(f) golden object: isSlideRoot policy matches expected shape', () => {
  const policy = createDefaultSelectionPolicy({ isSlideRoot: true });
  const expected = {
    kind: 'slide-root',
    reason: 'Корневой контейнер слайда редактируется только в безопасном режиме.',
    canEditText: false,
    canEditStyles: true,
    canEditAttributes: false,
    canEditHtml: false,
    canEditSlideHtml: true,
    canMove: false,
    canResize: false,
    canNudge: false,
    canReorder: false,
    canDelete: false,
    canDuplicate: false,
    canWrap: false,
    canAddChild: true,
    canReplaceMedia: false,
  };
  assert.equal(
    JSON.stringify(policy),
    JSON.stringify(expected),
    'isSlideRoot policy must match golden object byte-for-byte',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// (g) createDefaultSelectionPolicy() with no flags returns kind:'free'
// ─────────────────────────────────────────────────────────────────────────────
test('(g) no flags returns kind free with canEditStyles true', () => {
  const policy = createDefaultSelectionPolicy();
  assert.equal(policy.kind, 'free');
  assert.equal(policy.reason, '');
  assert.equal(policy.canEditStyles, true);
  assert.equal(policy.canEditText, false, 'canEditText false when flag not set');
  assert.equal(policy.canAddChild, false, 'canAddChild false when isContainer not set');
  assert.equal(policy.canReplaceMedia, false, 'canReplaceMedia false when isImage/isVideo not set');
  assert.equal(policy.canMove, true);
  assert.equal(policy.canDelete, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// (h) store.select('selection.entityKind') returns 'none' from initial slice
// ─────────────────────────────────────────────────────────────────────────────
test('(h) store.select selection.entityKind returns none from initial slice', () => {
  const store = createStore();
  store.defineSlice('selection', makeInitialSelectionSlice());
  const val = store.select('selection.entityKind');
  assert.equal(val, 'none', 'initial entityKind should be none');
});
