// feature-flags.js
// Layer: Feature Flags & Predicates
// Centralizes complexityMode and device capability checks.
// Resolves PAIN-MAP P2-04 (21 inline complexityMode checks) and P2-08.
// ADR: WO-37 — single source of truth for mode predicates.
// =====================================================================
"use strict";
(function () {
  "use strict";
  function isAdvancedMode() {
    return typeof state !== "undefined" && state.complexityMode === "advanced";
  }
  function isBasicMode() {
    return !isAdvancedMode();
  }
  function isTouchDevice() {
    return (
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
    );
  }
  window.isAdvancedMode = isAdvancedMode;
  window.isBasicMode = isBasicMode;
  window.isTouchDevice = isTouchDevice;
})();
