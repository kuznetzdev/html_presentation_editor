// left-pane-splitter.js
// Layer: Shell Layout (v2 layout — Figma-style split-pane)
// Implements the vertical resizer between #slidesPanel (top) and #layersRegion (bottom)
// in the left column when feature flag `ui.layoutVersion === "v2"` is active.
//
// Dormant in v1.1.1: only defines the init function. Bind is triggered from
// shell-layout.js when layout version flips to v2 (Phase B3 / v1.1.3).
//
// ADR-032 — Figma-style split-pane layout
// =====================================================================
"use strict";
(function () {
  "use strict";

  // -------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------
  var SPLIT_STORAGE_KEY = "presentation-editor:left-split:v1";
  var SPLIT_MIN = 0.20;      // min 20% for slides pane
  var SPLIT_MAX = 0.80;      // max 80% for slides pane
  var SPLIT_DEFAULT = 0.55;  // matches --left-split in tokens.css
  var KEYBOARD_STEP = 0.02;  // 2% per arrow key press
  var KEYBOARD_BIG_STEP = 0.1; // 10% with Shift

  // -------------------------------------------------------------------
  // State (module-local; not in global state.js)
  // -------------------------------------------------------------------
  var splitterState = {
    bound: false,
    wrapperEl: null,
    resizerEl: null,
    currentRatio: SPLIT_DEFAULT,
    isDragging: false,
    dragStartY: 0,
    dragStartRatio: SPLIT_DEFAULT,
    dragWrapperHeight: 0,
  };

  // -------------------------------------------------------------------
  // Storage
  // -------------------------------------------------------------------
  function readStoredSplit() {
    try {
      if (typeof window.localStorage === "undefined") return SPLIT_DEFAULT;
      var raw = window.localStorage.getItem(SPLIT_STORAGE_KEY);
      if (raw == null) return SPLIT_DEFAULT;
      var n = parseFloat(raw);
      if (isNaN(n) || n < SPLIT_MIN || n > SPLIT_MAX) return SPLIT_DEFAULT;
      return n;
    } catch (error) {
      console.warn("[left-pane-splitter] storage read failed:", error);
      return SPLIT_DEFAULT;
    }
  }

  function persistSplit(ratio) {
    try {
      if (typeof window.localStorage === "undefined") return;
      window.localStorage.setItem(SPLIT_STORAGE_KEY, String(ratio));
    } catch (error) {
      console.warn("[left-pane-splitter] storage write failed:", error);
    }
  }

  // -------------------------------------------------------------------
  // Apply ratio to DOM (CSS var --left-split)
  // -------------------------------------------------------------------
  function applyRatio(ratio) {
    var clamped = Math.max(SPLIT_MIN, Math.min(SPLIT_MAX, ratio));
    splitterState.currentRatio = clamped;
    // [v2.0.3] Expose both the plain ratio AND the grid-ready `fr` values.
    // CSS cannot multiply `1fr` by a unitless number — previous
    // `calc(var(--left-split) * 1fr)` was invalid and grid fell back to
    // near-equal tracks, squeezing the slides panel. Set `--left-split-fr`
    // and `--left-remaining-fr` as direct fr units for grid-template-rows.
    var root = document.documentElement;
    root.style.setProperty("--left-split", String(clamped));
    root.style.setProperty("--left-split-fr", clamped + "fr");
    root.style.setProperty("--left-remaining-fr", (1 - clamped).toFixed(4) + "fr");
    if (splitterState.resizerEl) {
      splitterState.resizerEl.setAttribute("aria-valuenow", String(Math.round(clamped * 100)));
    }
    // Sync to store if available (ADR-013)
    if (window.store && typeof window.store.update === "function") {
      try { window.store.update("ui", { leftPaneSplit: clamped }); } catch (e) { /* optional */ }
    }
  }

  // -------------------------------------------------------------------
  // Drag handlers
  // -------------------------------------------------------------------
  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    if (!splitterState.wrapperEl) return;
    splitterState.isDragging = true;
    splitterState.dragStartY = event.clientY;
    splitterState.dragStartRatio = splitterState.currentRatio;
    splitterState.dragWrapperHeight = splitterState.wrapperEl.getBoundingClientRect().height;
    splitterState.resizerEl.classList.add("is-dragging");
    splitterState.resizerEl.setPointerCapture(event.pointerId);
    document.body.style.cursor = "ns-resize";
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!splitterState.isDragging) return;
    var deltaY = event.clientY - splitterState.dragStartY;
    if (splitterState.dragWrapperHeight <= 0) return;
    var deltaRatio = deltaY / splitterState.dragWrapperHeight;
    var nextRatio = splitterState.dragStartRatio + deltaRatio;
    applyRatio(nextRatio);
  }

  function onPointerUp(event) {
    if (!splitterState.isDragging) return;
    splitterState.isDragging = false;
    splitterState.resizerEl.classList.remove("is-dragging");
    if (splitterState.resizerEl.hasPointerCapture(event.pointerId)) {
      splitterState.resizerEl.releasePointerCapture(event.pointerId);
    }
    document.body.style.cursor = "";
    persistSplit(splitterState.currentRatio);
  }

  function onDoubleClick() {
    applyRatio(SPLIT_DEFAULT);
    persistSplit(SPLIT_DEFAULT);
  }

  // -------------------------------------------------------------------
  // Keyboard (role=separator)
  // -------------------------------------------------------------------
  function onKeyDown(event) {
    var step = event.shiftKey ? KEYBOARD_BIG_STEP : KEYBOARD_STEP;
    var next = splitterState.currentRatio;
    if (event.key === "ArrowUp") next -= step;
    else if (event.key === "ArrowDown") next += step;
    else if (event.key === "Home") next = SPLIT_MIN;
    else if (event.key === "End") next = SPLIT_MAX;
    else if (event.key === "Enter" || event.key === " ") {
      // double-click equivalent — reset
      applyRatio(SPLIT_DEFAULT);
      persistSplit(SPLIT_DEFAULT);
      event.preventDefault();
      return;
    } else return;
    applyRatio(next);
    persistSplit(next);
    event.preventDefault();
  }

  // -------------------------------------------------------------------
  // Public init — called from shell-layout when layoutVersion flips to v2.
  // Idempotent.
  // -------------------------------------------------------------------
  function initLeftPaneSplitter() {
    if (splitterState.bound) return;
    if (!window.featureFlags || window.featureFlags.layoutVersion !== "v2") {
      return; // feature flag off — no-op
    }
    var wrapperEl = document.querySelector(".left-pane-wrapper");
    var resizerEl = document.querySelector(".left-pane-resizer");
    if (!wrapperEl || !resizerEl) {
      console.warn("[left-pane-splitter] DOM not ready; skip init");
      return;
    }
    splitterState.wrapperEl = wrapperEl;
    splitterState.resizerEl = resizerEl;

    // Apply stored ratio before binding events
    var stored = readStoredSplit();
    applyRatio(stored);

    // Bind pointer events
    resizerEl.addEventListener("pointerdown", onPointerDown);
    resizerEl.addEventListener("pointermove", onPointerMove);
    resizerEl.addEventListener("pointerup", onPointerUp);
    resizerEl.addEventListener("pointercancel", onPointerUp);
    resizerEl.addEventListener("dblclick", onDoubleClick);
    resizerEl.addEventListener("keydown", onKeyDown);

    // A11y: role=separator
    resizerEl.setAttribute("role", "separator");
    resizerEl.setAttribute("aria-orientation", "horizontal");
    resizerEl.setAttribute("aria-valuemin", String(Math.round(SPLIT_MIN * 100)));
    resizerEl.setAttribute("aria-valuemax", String(Math.round(SPLIT_MAX * 100)));
    resizerEl.setAttribute("aria-valuenow", String(Math.round(stored * 100)));
    resizerEl.setAttribute("aria-label", "Разделитель: слайды (сверху) / слои (снизу). Arrow Up/Down изменить, Enter сбросить.");
    resizerEl.setAttribute("tabindex", "0");

    splitterState.bound = true;
  }

  // Expose for shell-layout.js to call on layoutVersion flip
  window.initLeftPaneSplitter = initLeftPaneSplitter;
})();
