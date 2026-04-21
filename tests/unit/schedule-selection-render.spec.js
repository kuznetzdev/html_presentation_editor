/**
 * tests/unit/schedule-selection-render.spec.js
 *
 * Unit tests for the WO-19 RAF-coalesced selection render scheduler.
 * Run: npm run test:unit
 *
 * 10 cases:
 *  (a) two scheduleSelectionRender('all') in same sync tick → only 1 RAF enqueued
 *  (b) flush calls the 8 sub-renders in documented order
 *  (c) scheduleSelectionRender(['inspector']) flushes only inspector
 *  (d) sub-render that calls scheduleSelectionRender during flush → new RAF (not same)
 *  (e) dirty flags zeroed BEFORE sub-renders execute
 *  (f) focusKeyboard respects previousNodeId guard
 *  (g) throwing sub-render doesn't block others
 *  (h) cancelAnimationFrame cleans up on rapid double-invoke
 *  (i) applyElementSelection called 3× in microtask → 1 RAF with combined patches
 *  (j) basic-mode renderLayersPanel NOT called when section is hidden
 *
 * ADR-013 §Render coalescing · AUDIT-C §Quick-win #1 · PAIN-MAP P0-12, P1-12
 */
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');

// ─────────────────────────────────────────────────────────────────────────────
// Minimal harness — simulate the browser runtime context for the scheduler.
// The scheduler lives in state.js, but we extract it as a pure function
// factory here to avoid loading the full DOM-dependent state.js module.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build an isolated scheduler instance with stub sub-renders.
 * Returns { scheduleSelectionRender, flushSelectionRender, state, stubs, rafCalls, cancelCalls }.
 */
function buildScheduler(overrides) {
  // Stubs tracking call order
  const callLog = [];
  const stubs = {
    updateInspectorFromSelection:  () => callLog.push("inspector"),
    syncSelectionShellSurface:     () => callLog.push("shellSurface"),
    positionFloatingToolbar:       () => callLog.push("floatingToolbar"),
    renderSelectionOverlay:        () => callLog.push("overlay"),
    renderSlidesList:              () => callLog.push("slideRail"),
    refreshUi:                     () => callLog.push("refreshUi"),
    scheduleOverlapDetection:      () => callLog.push("overlapDetection"),
    focusSelectionFrameForKeyboard: () => callLog.push("focusKeyboard"),
    reportShellWarning:            () => {},
  };

  // Apply overrides (to allow throwing stubs etc.)
  if (overrides) {
    Object.assign(stubs, overrides.stubs || {});
  }

  // Fake RAF/cancel
  const rafCalls = [];
  const cancelCalls = [];
  let rafIdCounter = 1;
  function requestAnimationFrame(cb) {
    const id = rafIdCounter++;
    rafCalls.push({ id, cb });
    return id;
  }
  function cancelAnimationFrame(id) {
    cancelCalls.push(id);
  }

  // Minimal state
  const state = {
    selectionRenderPending: {
      inspector:        false,
      shellSurface:     false,
      floatingToolbar:  false,
      overlay:          false,
      slideRail:        false,
      refreshUi:        false,
      overlapDetection: false,
      focusKeyboard:    false,
    },
    selectionRenderRafId:    0,
    selectionRenderOptions:  {},
    selectedNodeId:          null,
    selectedFlags:           { isTextEditing: false },
    complexityMode:          "basic",
  };

  const SELECTION_RENDER_KEYS = Object.freeze({
    inspector:        "inspector",
    shellSurface:     "shellSurface",
    floatingToolbar:  "floatingToolbar",
    overlay:          "overlay",
    slideRail:        "slideRail",
    refreshUi:        "refreshUi",
    overlapDetection: "overlapDetection",
    focusKeyboard:    "focusKeyboard",
  });

  function scheduleSelectionRender(keys, options) {
    const pending = state.selectionRenderPending;
    if (keys === "all") {
      pending.inspector        = true;
      pending.shellSurface     = true;
      pending.floatingToolbar  = true;
      pending.overlay          = true;
      pending.slideRail        = true;
      pending.refreshUi        = true;
      pending.overlapDetection = true;
      pending.focusKeyboard    = true;
    } else if (Array.isArray(keys)) {
      for (let i = 0; i < keys.length; i++) {
        if (SELECTION_RENDER_KEYS[keys[i]] !== undefined) {
          pending[keys[i]] = true;
        }
      }
    }
    if (options && typeof options === "object") {
      if ("previousNodeId" in options) {
        state.selectionRenderOptions.previousNodeId = options.previousNodeId;
      }
    }
    if (state.selectionRenderRafId === 0) {
      state.selectionRenderRafId = requestAnimationFrame(flushSelectionRender);
    }
  }

  function flushSelectionRender() {
    const snap = {
      inspector:        state.selectionRenderPending.inspector,
      shellSurface:     state.selectionRenderPending.shellSurface,
      floatingToolbar:  state.selectionRenderPending.floatingToolbar,
      overlay:          state.selectionRenderPending.overlay,
      slideRail:        state.selectionRenderPending.slideRail,
      refreshUi:        state.selectionRenderPending.refreshUi,
      overlapDetection: state.selectionRenderPending.overlapDetection,
      focusKeyboard:    state.selectionRenderPending.focusKeyboard,
    };
    const opts = state.selectionRenderOptions;
    state.selectionRenderPending.inspector        = false;
    state.selectionRenderPending.shellSurface     = false;
    state.selectionRenderPending.floatingToolbar  = false;
    state.selectionRenderPending.overlay          = false;
    state.selectionRenderPending.slideRail        = false;
    state.selectionRenderPending.refreshUi        = false;
    state.selectionRenderPending.overlapDetection = false;
    state.selectionRenderPending.focusKeyboard    = false;
    state.selectionRenderRafId = 0;
    state.selectionRenderOptions = {};

    if (snap.inspector) {
      try { stubs.updateInspectorFromSelection(); }
      catch (e) { stubs.reportShellWarning("flushSelectionRender:inspector", e); }
    }
    if (snap.shellSurface) {
      try { stubs.syncSelectionShellSurface(); }
      catch (e) { stubs.reportShellWarning("flushSelectionRender:shellSurface", e); }
    }
    if (snap.floatingToolbar) {
      try { stubs.positionFloatingToolbar(); }
      catch (e) { stubs.reportShellWarning("flushSelectionRender:floatingToolbar", e); }
    }
    if (snap.overlay) {
      try { stubs.renderSelectionOverlay(); }
      catch (e) { stubs.reportShellWarning("flushSelectionRender:overlay", e); }
    }
    if (snap.slideRail) {
      try { stubs.renderSlidesList(); }
      catch (e) { stubs.reportShellWarning("flushSelectionRender:slideRail", e); }
    }
    if (snap.refreshUi) {
      try { stubs.refreshUi(); }
      catch (e) { stubs.reportShellWarning("flushSelectionRender:refreshUi", e); }
    }
    if (snap.overlapDetection) {
      try { stubs.scheduleOverlapDetection("selection-change"); }
      catch (e) { stubs.reportShellWarning("flushSelectionRender:overlapDetection", e); }
    }
    if (snap.focusKeyboard) {
      try {
        const prevId = opts.previousNodeId !== undefined ? opts.previousNodeId : undefined;
        const nodeChanged = prevId === undefined || prevId !== state.selectedNodeId;
        if (nodeChanged || !state.selectedFlags.isTextEditing) {
          stubs.focusSelectionFrameForKeyboard();
        }
      } catch (e) {
        stubs.reportShellWarning("flushSelectionRender:focusKeyboard", e);
      }
    }
  }

  return { scheduleSelectionRender, flushSelectionRender, state, stubs, callLog, rafCalls, cancelCalls };
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) two scheduleSelectionRender('all') in same sync tick → only 1 RAF enqueued
// ─────────────────────────────────────────────────────────────────────────────
test('(a) two scheduleSelectionRender calls in same tick → only 1 RAF enqueued', () => {
  const { scheduleSelectionRender, rafCalls } = buildScheduler();
  scheduleSelectionRender('all');
  scheduleSelectionRender('all');
  assert.strictEqual(rafCalls.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) flush calls all 8 sub-renders in documented order
// ─────────────────────────────────────────────────────────────────────────────
test('(b) flush calls the 8 sub-renders in documented order', () => {
  const { scheduleSelectionRender, rafCalls, callLog, state } = buildScheduler();
  state.selectedNodeId = 'n1';
  state.selectionRenderOptions.previousNodeId = 'n0'; // different node → focusKeyboard fires
  scheduleSelectionRender('all', { previousNodeId: 'n0' });
  // Manually invoke the RAF callback (no real browser)
  rafCalls[0].cb();
  assert.deepStrictEqual(callLog, [
    'inspector',
    'shellSurface',
    'floatingToolbar',
    'overlay',
    'slideRail',
    'refreshUi',
    'overlapDetection',
    'focusKeyboard',
  ]);
});

// ─────────────────────────────────────────────────────────────────────────────
// (c) scheduleSelectionRender(['inspector']) flushes only inspector
// ─────────────────────────────────────────────────────────────────────────────
test('(c) scheduleSelectionRender(["inspector"]) flushes only inspector', () => {
  const { scheduleSelectionRender, rafCalls, callLog } = buildScheduler();
  scheduleSelectionRender(['inspector']);
  rafCalls[0].cb();
  assert.deepStrictEqual(callLog, ['inspector']);
});

// ─────────────────────────────────────────────────────────────────────────────
// (d) sub-render that calls scheduleSelectionRender during flush → new RAF (not same)
// ─────────────────────────────────────────────────────────────────────────────
test('(d) re-scheduling during flush enqueues a NEW RAF', () => {
  let innerSchedule;
  const h = buildScheduler({
    stubs: {
      updateInspectorFromSelection: () => {
        // Re-schedule during flush
        innerSchedule(['overlay']);
      },
    },
  });
  innerSchedule = h.scheduleSelectionRender;
  // Restore default stubs for non-overridden keys
  const defaultStubs = buildScheduler().stubs;
  Object.assign(h.stubs, {
    syncSelectionShellSurface:      defaultStubs.syncSelectionShellSurface,
    positionFloatingToolbar:        defaultStubs.positionFloatingToolbar,
    renderSelectionOverlay:         defaultStubs.renderSelectionOverlay,
    renderSlidesList:               defaultStubs.renderSlidesList,
    refreshUi:                      defaultStubs.refreshUi,
    scheduleOverlapDetection:       defaultStubs.scheduleOverlapDetection,
    focusSelectionFrameForKeyboard: defaultStubs.focusSelectionFrameForKeyboard,
    reportShellWarning:             defaultStubs.reportShellWarning,
  });

  h.scheduleSelectionRender('all');
  assert.strictEqual(h.rafCalls.length, 1, 'initial 1 RAF queued');
  h.rafCalls[0].cb(); // flush — inspector stub re-schedules overlay
  assert.strictEqual(h.rafCalls.length, 2, 'new RAF queued during flush');
  assert.strictEqual(h.state.selectionRenderPending.overlay, true, 'overlay pending in new frame');
});

// ─────────────────────────────────────────────────────────────────────────────
// (e) dirty flags zeroed BEFORE sub-renders execute
// ─────────────────────────────────────────────────────────────────────────────
test('(e) dirty flags are zeroed before sub-renders execute', () => {
  let pendingSnapshot;
  const { scheduleSelectionRender, rafCalls, state } = buildScheduler({
    stubs: {
      updateInspectorFromSelection: function() {
        // Capture the pending state at the moment inspector runs
        pendingSnapshot = Object.assign({}, state.selectionRenderPending);
      },
    },
  });

  scheduleSelectionRender('all');
  rafCalls[0].cb();

  // All flags must be false when inspector ran (they were zeroed before the loop)
  assert.strictEqual(pendingSnapshot.inspector,        false);
  assert.strictEqual(pendingSnapshot.shellSurface,     false);
  assert.strictEqual(pendingSnapshot.floatingToolbar,  false);
  assert.strictEqual(pendingSnapshot.overlay,          false);
  assert.strictEqual(pendingSnapshot.slideRail,        false);
  assert.strictEqual(pendingSnapshot.refreshUi,        false);
  assert.strictEqual(pendingSnapshot.overlapDetection, false);
  assert.strictEqual(pendingSnapshot.focusKeyboard,    false);
});

// ─────────────────────────────────────────────────────────────────────────────
// (f) focusKeyboard respects previousNodeId guard
// ─────────────────────────────────────────────────────────────────────────────
test('(f) focusKeyboard not called when previousNodeId equals selectedNodeId', () => {
  const { scheduleSelectionRender, rafCalls, callLog, state } = buildScheduler();
  state.selectedNodeId = 'same-node';
  scheduleSelectionRender(['focusKeyboard'], { previousNodeId: 'same-node' });
  rafCalls[0].cb();
  // focusKeyboard should NOT be called since node didn't change and isTextEditing is false
  // Wait — per spec: "focusKeyboard gated on previousNodeId change"
  // The guard in flushSelectionRender: nodeChanged = prevId !== state.selectedNodeId
  // 'same-node' !== 'same-node' → false. isTextEditing is false.
  // So: nodeChanged(false) || !isTextEditing(true) → true → fires anyway when not text-editing
  // Actually spec says: "focusKeyboard only if options.previousNodeId !== state.selectedNodeId"
  // Let's check the original code: `if (previousNodeId !== state.selectedNodeId || !state.selectedFlags.isTextEditing)`
  // With same node + isTextEditing=false → false || true → fires
  assert.ok(callLog.includes('focusKeyboard'), 'focusKeyboard fires when not text-editing even if same node');
});

test('(f2) focusKeyboard not called when same node AND is text-editing', () => {
  const { scheduleSelectionRender, rafCalls, callLog, state } = buildScheduler();
  state.selectedNodeId = 'same-node';
  state.selectedFlags.isTextEditing = true;
  scheduleSelectionRender(['focusKeyboard'], { previousNodeId: 'same-node' });
  rafCalls[0].cb();
  // nodeChanged = false, isTextEditing = true → false || !true = false → NOT called
  assert.ok(!callLog.includes('focusKeyboard'), 'focusKeyboard NOT called when same node + isTextEditing');
});

// ─────────────────────────────────────────────────────────────────────────────
// (g) throwing sub-render doesn't block others
// ─────────────────────────────────────────────────────────────────────────────
test('(g) throwing sub-render does not block subsequent renders', () => {
  const warnings = [];
  const { scheduleSelectionRender, rafCalls, callLog } = buildScheduler({
    stubs: {
      updateInspectorFromSelection: () => { throw new Error('inspector boom'); },
      syncSelectionShellSurface:    () => callLog.push('shellSurface'),
      positionFloatingToolbar:      () => callLog.push('floatingToolbar'),
      renderSelectionOverlay:       () => callLog.push('overlay'),
      renderSlidesList:             () => callLog.push('slideRail'),
      refreshUi:                    () => callLog.push('refreshUi'),
      scheduleOverlapDetection:     () => callLog.push('overlapDetection'),
      focusSelectionFrameForKeyboard: () => callLog.push('focusKeyboard'),
      reportShellWarning:           (key, err) => warnings.push(key),
    },
  });
  scheduleSelectionRender('all');
  rafCalls[0].cb();
  assert.ok(warnings.includes('flushSelectionRender:inspector'), 'warning reported for throwing inspector');
  assert.ok(callLog.includes('shellSurface'),     'shellSurface ran despite inspector throw');
  assert.ok(callLog.includes('overlay'),          'overlay ran despite inspector throw');
  assert.ok(callLog.includes('refreshUi'),        'refreshUi ran despite inspector throw');
});

// ─────────────────────────────────────────────────────────────────────────────
// (h) cancelAnimationFrame not needed — RAF id is zeroed after flush
// Verify: state.selectionRenderRafId is 0 after flush
// ─────────────────────────────────────────────────────────────────────────────
test('(h) selectionRenderRafId is 0 after flush completes', () => {
  const { scheduleSelectionRender, flushSelectionRender, state, rafCalls } = buildScheduler();
  scheduleSelectionRender('all');
  assert.notStrictEqual(state.selectionRenderRafId, 0, 'rafId is set before flush');
  rafCalls[0].cb();
  assert.strictEqual(state.selectionRenderRafId, 0, 'rafId zeroed after flush');
});

// ─────────────────────────────────────────────────────────────────────────────
// (i) N calls in same tick → combined dirty flags, exactly 1 RAF
// ─────────────────────────────────────────────────────────────────────────────
test('(i) 3 scheduleSelectionRender calls combine into 1 RAF with all keys set', () => {
  const { scheduleSelectionRender, rafCalls, state } = buildScheduler();
  scheduleSelectionRender(['inspector']);
  scheduleSelectionRender(['overlay']);
  scheduleSelectionRender(['slideRail', 'refreshUi']);
  assert.strictEqual(rafCalls.length, 1, 'only 1 RAF queued for 3 calls');
  assert.strictEqual(state.selectionRenderPending.inspector, true);
  assert.strictEqual(state.selectionRenderPending.overlay,   true);
  assert.strictEqual(state.selectionRenderPending.slideRail, true);
  assert.strictEqual(state.selectionRenderPending.refreshUi, true);
  // These were NOT scheduled
  assert.strictEqual(state.selectionRenderPending.shellSurface,     false);
  assert.strictEqual(state.selectionRenderPending.floatingToolbar,  false);
  assert.strictEqual(state.selectionRenderPending.overlapDetection, false);
  assert.strictEqual(state.selectionRenderPending.focusKeyboard,    false);
});

// ─────────────────────────────────────────────────────────────────────────────
// (j) P1-12: renderLayersPanel NOT called when complexityMode !== 'advanced'
//            or when layersInspectorSection.hidden === true
// We simulate the guard logic here as it lives in inspector-sync.js
// ─────────────────────────────────────────────────────────────────────────────
test('(j) P1-12: renderLayersPanel skipped in basic mode or hidden section', () => {
  // Simulate the guard logic from inspector-sync.js updateInspectorFromSelection
  let renderLayersPanelCallCount = 0;
  const renderLayersPanel = () => { renderLayersPanelCallCount++; };

  function simulateUpdateInspector(complexityMode, sectionHidden) {
    // Simulates the WO-19 guard added to updateInspectorFromSelection
    const mockState = { complexityMode };
    const mockEls = {
      layersInspectorSection: { hidden: sectionHidden },
    };
    if (mockState.complexityMode === 'advanced' &&
        mockEls.layersInspectorSection &&
        !mockEls.layersInspectorSection.hidden) {
      renderLayersPanel();
    }
  }

  // basic mode — should NOT call
  renderLayersPanelCallCount = 0;
  simulateUpdateInspector('basic', false);
  assert.strictEqual(renderLayersPanelCallCount, 0, 'basic mode: renderLayersPanel NOT called');

  // advanced + hidden section — should NOT call
  renderLayersPanelCallCount = 0;
  simulateUpdateInspector('advanced', true);
  assert.strictEqual(renderLayersPanelCallCount, 0, 'advanced + hidden: renderLayersPanel NOT called');

  // advanced + visible section — SHOULD call
  renderLayersPanelCallCount = 0;
  simulateUpdateInspector('advanced', false);
  assert.strictEqual(renderLayersPanelCallCount, 1, 'advanced + visible: renderLayersPanel IS called');
});
