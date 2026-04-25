// opacity-rotate.js
// Layer: Direct manipulation — opacity + rotate APIs (Phase D3)
// =====================================================================
// Lightweight model-mutation helpers + keyboard shortcut for rotate cycle.
// Visual surfaces (slider in floating toolbar, on-canvas rotate handle)
// are wired by floating-toolbar.js / shell-overlays.js when they need it.
//
// Public API:
//   setSelectedOpacity(value)     — value in [0..1]; writes inline `opacity`.
//   setSelectedRotation(deg)      — sets `transform: rotate(<deg>deg)`.
//   clearSelectedRotation()       — drops the rotate transform.
//   cycleSelectedRotation()       — Shift+R: 0 → 15 → 45 → 90 → 0.
//   bindRotateShortcut()          — wires Shift+R global keydown.
// =====================================================================
"use strict";
(function () {
  "use strict";

  function getSelectedNode() {
    return findModelNode(state.selectedNodeId);
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  function setSelectedOpacity(rawValue) {
    var node = getSelectedNode();
    if (!node) return false;
    if (node.getAttribute("data-editor-locked") === "true") return false;
    var value = clamp(parseFloat(rawValue), 0, 1);
    if (value >= 0.999) {
      node.style.removeProperty("opacity");
    } else {
      node.style.opacity = String(value);
    }
    if (typeof recordHistoryChange === "function") {
      recordHistoryChange("opacity:" + state.selectedNodeId);
    }
    sendToBridge("update-attributes", {
      nodeId: state.selectedNodeId,
      attrs: { style: node.style.cssText },
    });
    return true;
  }

  function applyRotation(node, deg) {
    if (deg === 0) {
      // Strip any rotate(...) from inline transform; keep other transforms.
      var current = String(node.style.transform || "");
      var stripped = current.replace(/rotate\([^)]*\)\s*/gi, "").trim();
      if (stripped) node.style.transform = stripped;
      else node.style.removeProperty("transform");
    } else {
      var existing = String(node.style.transform || "");
      var withoutRotate = existing.replace(/rotate\([^)]*\)\s*/gi, "").trim();
      var nextTransform =
        (withoutRotate ? withoutRotate + " " : "") + "rotate(" + deg + "deg)";
      node.style.transform = nextTransform;
    }
  }

  function setSelectedRotation(deg) {
    var node = getSelectedNode();
    if (!node) return false;
    if (node.getAttribute("data-editor-locked") === "true") return false;
    var d = Number(deg);
    if (!Number.isFinite(d)) return false;
    applyRotation(node, d);
    if (typeof recordHistoryChange === "function") {
      recordHistoryChange("rotate:" + state.selectedNodeId + ":" + d);
    }
    sendToBridge("update-attributes", {
      nodeId: state.selectedNodeId,
      attrs: { style: node.style.cssText },
    });
    return true;
  }

  function clearSelectedRotation() {
    return setSelectedRotation(0);
  }

  // Read the current rotation in degrees from inline transform, 0 if absent.
  function getCurrentRotation() {
    var node = getSelectedNode();
    if (!node) return 0;
    var match = String(node.style.transform || "").match(/rotate\(\s*(-?[\d.]+)deg\s*\)/i);
    if (!match) return 0;
    var deg = parseFloat(match[1]);
    return Number.isFinite(deg) ? deg : 0;
  }

  var ROTATE_CYCLE = [0, 15, 45, 90];

  function cycleSelectedRotation() {
    var current = getCurrentRotation();
    var idx = ROTATE_CYCLE.indexOf(current);
    var next = idx >= 0 ? ROTATE_CYCLE[(idx + 1) % ROTATE_CYCLE.length] : 15;
    return setSelectedRotation(next);
  }

  function bindRotateShortcut() {
    document.addEventListener("keydown", function (event) {
      if (state.mode !== "edit") return;
      if (!event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
      var key = String(event.key || "").toLowerCase();
      if (key !== "r") return;
      var target = event.target;
      var isFormControl =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable);
      if (isFormControl) return;
      if (!state.selectedNodeId) return;
      event.preventDefault();
      cycleSelectedRotation();
    });
  }

  window.setSelectedOpacity = setSelectedOpacity;
  window.setSelectedRotation = setSelectedRotation;
  window.clearSelectedRotation = clearSelectedRotation;
  window.cycleSelectedRotation = cycleSelectedRotation;
  window.bindRotateShortcut = bindRotateShortcut;
})();
