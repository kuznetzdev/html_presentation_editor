// precision.js
// Layer: Snap Engine + Guide Overlay
// ADR-004: snap-to-siblings during drag/resize at zoom=100%.
// Classic-script — no type="module". All exports are globals on window.
//
// Payload shape recorded from selection.js handleActiveManipulationMove:
//   session.kind           — "drag" | "resize"
//   session.handle         — resize handle string e.g. "se"
//   session.startClientX/Y — pointer origin in shell client coords
//   session.startRect      — {left, top, width, height, right, bottom, centerX, centerY}
//   session.snapTargets    — array from state.manipulationContext.snapTargets
//     each: {nodeId, left, top, width, height, right, bottom, centerX, centerY}
//   next.rect              — computed rect after snap (from computeManipulationPayload)
//   next.guides            — {vertical: number[], horizontal: number[]}
//
// Globals required (classic-script, declared in other <script> tags):
/* global state, els, getBlockReason, DIRECT_MANIP_SNAP_PX */

(function () {
  'use strict';

  // ── Internal state ────────────────────────────────────────────────────────

  /** @type {Map<number, function(Array)>} requestId → callback */
  var _pendingCallbacks = new Map();

  /** Monotonic counter for requestIds */
  var _requestIdSeq = 0;

  /** nodeId of the element being dragged this session */
  var _sessionNodeId = null;

  /** Whether we've already fetched sibling rects this session */
  var _sessionStarted = false;

  /** Pool of guide DOM nodes keyed by axis */
  var _guidePool = { v: [], h: [] };

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Returns true when snap and guides may engage.
   * Gate: zoom must be 1.0 AND getBlockReason() must return "none".
   * @returns {boolean}
   */
  function _canSnap() {
    if (!state || state.previewZoom !== 1) return false;
    if (typeof getBlockReason !== 'function') return false;
    return getBlockReason() === 'none';
  }

  /**
   * Get or create the #snapGuides container.
   * @returns {HTMLElement|null}
   */
  function _getContainer() {
    return document.getElementById('snapGuides');
  }

  // ── Guide DOM management ──────────────────────────────────────────────────

  /**
   * Ensure the pool has at least `count` guide elements of the given orientation.
   * @param {'v'|'h'} orientation
   * @param {number} count
   */
  function _ensureGuidePool(orientation, count) {
    var pool = _guidePool[orientation];
    var container = _getContainer();
    while (pool.length < count) {
      var el = document.createElement('div');
      el.setAttribute('data-editor-ui', 'true');
      el.className = orientation === 'v'
        ? 'snap-guide snap-guide--v'
        : 'snap-guide snap-guide--h';
      if (container) container.appendChild(el);
      pool.push(el);
    }
  }

  /**
   * Deactivate all guide elements (remove .is-active).
   */
  function _deactivateAllGuides() {
    _guidePool.v.forEach(function (el) { el.classList.remove('is-active'); });
    _guidePool.h.forEach(function (el) { el.classList.remove('is-active'); });
  }

  // ── Bridge round-trip ─────────────────────────────────────────────────────

  /**
   * Request sibling rects from the iframe via a direct postMessage.
   * Uses a monotonic requestId; callback is stored until response arrives.
   * This bypasses sendToBridge schema validation intentionally — get-sibling-rects
   * is a read-only query message not requiring mutation tracking.
   *
   * @param {string} slideId
   * @param {string} nodeId
   * @param {function(Array)} callback
   */
  window.precisionRequestSiblingRects = function (slideId, nodeId, callback) {
    if (!state || !state.bridgeToken) return;
    var previewFrame = els && els.previewFrame;
    if (!previewFrame || !previewFrame.contentWindow) return;

    var requestId = ++_requestIdSeq;
    _pendingCallbacks.set(requestId, callback);

    // Target: mirror the iframeTarget pattern from sendToBridge (bridge-commands.js)
    var iframeTarget = (window.location.protocol === 'file:') ? '*' : window.location.origin;

    previewFrame.contentWindow.postMessage({
      __presentationEditorParent: true,
      token: state.bridgeToken,
      type: 'get-sibling-rects',
      payload: { slideId: slideId, nodeId: nodeId, requestId: requestId },
    }, iframeTarget);
  };

  // ── Session lifecycle ─────────────────────────────────────────────────────

  /**
   * Called on the first move event of a drag. Fetches sibling rects once per drag.
   * Exits early when zoom !== 1 or getBlockReason() !== "none".
   *
   * @param {string} nodeId
   */
  window.precisionStartSnapSession = function (nodeId) {
    if (_sessionStarted) return;
    if (!_canSnap()) return;
    _sessionStarted = true;
    _sessionNodeId = nodeId;
    // Fetch sibling rects for the active slide. They'll be stored in
    // state.manipulationContext.snapTargets via the existing bridge flow;
    // the get-sibling-rects round-trip is a belt-and-suspenders refresh
    // for the guide rendering (precision.js manages its own visual layer).
    var slideId = state && state.activeSlideId;
    if (slideId && nodeId) {
      window.precisionRequestSiblingRects(slideId, nodeId, function (_rects) {
        // Sibling rects delivered — no further action needed here;
        // precisionApplySnap and precisionRenderGuides use state.manipulationContext.snapTargets.
      });
    }
  };

  /**
   * Compute snapped position and which axes fired.
   * Uses state.manipulationContext.snapTargets (populated by bridge selectElement flow).
   * Returns the snapped {left, top, snappedAxesX, snappedAxesY} or the input rect
   * unchanged when snap is inactive.
   *
   * @param {{ left:number, top:number, width:number, height:number }} draggedRect
   * @param {'drag'|'resize'} [mode]
   * @returns {{ left:number, top:number, width:number, height:number, snappedAxesX:number[], snappedAxesY:number[] }}
   */
  window.precisionApplySnap = function (draggedRect, mode) {
    var result = {
      left: draggedRect.left,
      top: draggedRect.top,
      width: draggedRect.width,
      height: draggedRect.height,
      snappedAxesX: [],
      snappedAxesY: [],
    };

    if (!_canSnap()) return result;
    if (!draggedRect) return result;

    var targets = (state && state.manipulationContext && Array.isArray(state.manipulationContext.snapTargets))
      ? state.manipulationContext.snapTargets
      : [];

    if (!targets.length) return result;

    var left = draggedRect.left;
    var top = draggedRect.top;
    var right = left + draggedRect.width;
    var bottom = top + draggedRect.height;
    var centerX = left + draggedRect.width / 2;
    var centerY = top + draggedRect.height / 2;

    // Collect dragged element's snap points
    var xPoints = mode === 'resize'
      ? [left, right]
      : [left, centerX, right];
    var yPoints = mode === 'resize'
      ? [top, bottom]
      : [top, centerY, bottom];

    // Collect target snap values (all sibling axes)
    var xTargets = [];
    var yTargets = [];
    var xSeen = new Set();
    var ySeen = new Set();
    targets.forEach(function (t) {
      var tLeft = Number(t.left);
      var tRight = Number(t.right !== undefined ? t.right : t.left + t.width);
      var tCenterX = Number(t.centerX !== undefined ? t.centerX : t.left + t.width / 2);
      var tTop = Number(t.top);
      var tBottom = Number(t.bottom !== undefined ? t.bottom : t.top + t.height);
      var tCenterY = Number(t.centerY !== undefined ? t.centerY : t.top + t.height / 2);
      [tLeft, tCenterX, tRight].forEach(function (v) {
        if (Number.isFinite(v) && !xSeen.has(v)) { xSeen.add(v); xTargets.push(v); }
      });
      [tTop, tCenterY, tBottom].forEach(function (v) {
        if (Number.isFinite(v) && !ySeen.has(v)) { ySeen.add(v); yTargets.push(v); }
      });
    });

    var threshold = DIRECT_MANIP_SNAP_PX; // Never use literal 8 — ADR-004 invariant

    // Find best X snap
    var bestXDelta = null;
    var bestXTarget = null;
    xPoints.forEach(function (point) {
      xTargets.forEach(function (target) {
        var delta = target - point;
        if (Math.abs(delta) <= threshold) {
          if (bestXDelta === null || Math.abs(delta) < Math.abs(bestXDelta)) {
            bestXDelta = delta;
            bestXTarget = target;
          }
        }
      });
    });

    // Find best Y snap
    var bestYDelta = null;
    var bestYTarget = null;
    yPoints.forEach(function (point) {
      yTargets.forEach(function (target) {
        var delta = target - point;
        if (Math.abs(delta) <= threshold) {
          if (bestYDelta === null || Math.abs(delta) < Math.abs(bestYDelta)) {
            bestYDelta = delta;
            bestYTarget = target;
          }
        }
      });
    });

    if (bestXDelta !== null) {
      result.left = left + bestXDelta;
      result.snappedAxesX = [bestXTarget];
    }
    if (bestYDelta !== null) {
      result.top = top + bestYDelta;
      result.snappedAxesY = [bestYTarget];
    }

    return result;
  };

  /**
   * Create/update .snap-guide elements inside #snapGuides.
   * Reuses DOM nodes from pool to avoid innerHTML churn.
   * Guides extend across full stageRect bounds.
   *
   * @param {number[]} axesX  — X coordinates for vertical guide lines
   * @param {number[]} axesY  — Y coordinates for horizontal guide lines
   * @param {{ left:number, top:number, width:number, height:number }} draggedRect
   * @param {DOMRect} [stageRect]  — preview stage bounding rect (for full-span guides)
   */
  window.precisionRenderGuides = function (axesX, axesY, draggedRect, stageRect) {
    var container = _getContainer();
    if (!container) return;
    if (!_canSnap()) {
      _deactivateAllGuides();
      return;
    }

    var safeAxesX = Array.isArray(axesX) ? axesX.filter(function (v) { return Number.isFinite(v); }) : [];
    var safeAxesY = Array.isArray(axesY) ? axesY.filter(function (v) { return Number.isFinite(v); }) : [];

    // Compute stage-relative offset for coordinate mapping
    // Guides are positioned in the snap-guides container (position:absolute inside preview-stage)
    // The axis values from state.manipulationContext.snapTargets are in iframe coords.
    // Convert using the same iframe→stage offset that feedback.js uses.
    var iframeEl = els && els.previewFrame;
    var stageEl = els && els.previewStage;
    var offsetX = 0;
    var offsetY = 0;
    if (iframeEl && stageEl) {
      var iframeR = iframeEl.getBoundingClientRect();
      var stageR = stageEl.getBoundingClientRect();
      offsetX = iframeR.left - stageR.left;
      offsetY = iframeR.top - stageR.top;
    }

    // Ensure pool has enough nodes
    _ensureGuidePool('v', safeAxesX.length);
    _ensureGuidePool('h', safeAxesY.length);

    // Deactivate all first, then activate only the active ones
    _deactivateAllGuides();

    safeAxesX.forEach(function (value, idx) {
      var el = _guidePool.v[idx];
      if (!el) return;
      el.style.left = (offsetX + value) + 'px';
      el.classList.add('is-active');
    });

    safeAxesY.forEach(function (value, idx) {
      var el = _guidePool.h[idx];
      if (!el) return;
      el.style.top = (offsetY + value) + 'px';
      el.classList.add('is-active');
    });
  };

  /**
   * Clear sibling rect cache, deactivate all guide lines.
   * Called on drag end and drag cancel.
   */
  window.precisionEndSnapSession = function () {
    _sessionStarted = false;
    _sessionNodeId = null;
    _deactivateAllGuides();
  };

  // ── Bridge response handler (called from bridge.js dispatch) ──────────────

  /**
   * Resolve a pending callback for a sibling-rects-response.
   * Called by bridge.js when type === "sibling-rects-response".
   *
   * @param {number} requestId
   * @param {Array} rects
   */
  window.precisionHandleSiblingRectsResponse = function (requestId, rects) {
    var cb = _pendingCallbacks.get(requestId);
    if (cb) {
      _pendingCallbacks.delete(requestId);
      try { cb(rects); } catch (_e) {}
    }
  };

  // ── Public constant (readable from evaluateEditor in tests) ──────────────

  /**
   * The snap threshold in pixels. Mirrors DIRECT_MANIP_SNAP_PX from constants.js.
   * Exposed so Playwright tests can assert the value without hardcoding 8.
   * @type {number}
   */
  window.precisionSnapThreshold = DIRECT_MANIP_SNAP_PX;

}());
