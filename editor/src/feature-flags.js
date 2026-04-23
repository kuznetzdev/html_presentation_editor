// feature-flags.js
// Layer: Feature Flags & Predicates
// Centralizes complexityMode, device capability checks, and v2.0 redesign flags.
// Resolves PAIN-MAP P2-04 (21 inline complexityMode checks) and P2-08.
// ADR: WO-37 — single source of truth for mode predicates.
// [v1.1.0] Extended with window.featureFlags for v2 redesign (ADR-031..037).
// =====================================================================
"use strict";
(function () {
  "use strict";

  // -------------------------------------------------------------------
  // Mode / device predicates (v1.0.3 baseline, unchanged)
  // -------------------------------------------------------------------
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

  // -------------------------------------------------------------------
  // [v1.1.0] Feature flag registry — ADR-031..037 (v2.0 redesign)
  //
  // All flags default to v1 behavior in v1.1.0. Defaults flip per phase:
  //   v1.2.0 (Phase B) → layoutVersion="v2", layersStandalone=true,
  //                       treeLayers=true, smartImport="report"
  //   v1.3.0 (Phase C) → svgIcons=true
  //   v1.4.0 (Phase D) → multiSelect=true, pptxV2=true
  //   v2.0.0 (Phase E) → smartImport="full"
  //
  // Override at runtime:
  //   window.featureFlags.layoutVersion = "v2";
  //   (persists across reloads via localStorage "feature-flags" key)
  // -------------------------------------------------------------------
  var FEATURE_FLAGS_STORAGE_KEY = "presentation-editor:feature-flags:v1";

  var DEFAULT_FLAGS = {
    // ADR-032 — workspace layout version.
    // "v1" = current 3-column (slides | canvas | inspector).
    // "v2" = Figma-style split-pane (slides+layers left, canvas, inspector).
    // [v1.1.4] flipped: v1 → v2 as part of Phase B3.
    layoutVersion: "v2",

    // ADR-031 — persistent Layers Panel.
    // false = layers stays inside inspector (advanced-only).
    // true  = layers in separate #layersRegion shell region (visible in both modes).
    // [v1.1.4] flipped: false → true as part of Phase B3.
    layersStandalone: true,

    // ADR-034 — hierarchical tree view for layers panel.
    // false = flat z-order list (current).
    // true  = <details>-based tree with drag-drop reparent.
    treeLayers: false,

    // Phase D — true multi-select (shift-click, Ctrl+A).
    // false = single selection only (current behavior).
    // true  = state.selection.multiple[] + combined bounding box.
    multiSelect: false,

    // ADR-036 — PPTX export fidelity v2.
    // false = v1 inline-style position + basic export (current).
    // true  = getBoundingClientRect resolver + SVG shapes + gradients + font map.
    pptxV2: false,

    // ADR-035 — smart import pipeline v2.
    // "off"    = use existing import.js only.
    // "report" = run pipeline v2, show preprocessing report modal, load via v1.
    // "full"   = run pipeline v2 as primary loader.
    smartImport: "off",

    // ADR-033 — SVG icon sprite.
    // false = emoji/unicode icons (current).
    // true  = inline SVG <symbol> sprite (consistent across themes).
    svgIcons: false,
  };

  function loadFeatureFlagsFromStorage() {
    try {
      if (typeof window.localStorage === "undefined") return {};
      var raw = window.localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      console.warn("[feature-flags] localStorage read failed:", error);
      return {};
    }
  }

  function persistFeatureFlags(flags) {
    try {
      if (typeof window.localStorage === "undefined") return;
      window.localStorage.setItem(
        FEATURE_FLAGS_STORAGE_KEY,
        JSON.stringify(flags),
      );
    } catch (error) {
      console.warn("[feature-flags] localStorage write failed:", error);
    }
  }

  // Build effective flags: defaults <- localStorage overrides.
  // Only known flag keys are honored (prevents stale keys from persisting).
  function buildEffectiveFlags() {
    var stored = loadFeatureFlagsFromStorage();
    var effective = {};
    for (var key in DEFAULT_FLAGS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_FLAGS, key)) {
        effective[key] = Object.prototype.hasOwnProperty.call(stored, key)
          ? stored[key]
          : DEFAULT_FLAGS[key];
      }
    }
    return effective;
  }

  var effectiveFlags = buildEffectiveFlags();

  // Expose via a Proxy so writes persist automatically:
  //   window.featureFlags.layoutVersion = "v2"; // auto-saves to localStorage
  //
  // Plain object fallback when Proxy isn't available (legacy).
  var featureFlagsAPI;
  if (typeof Proxy === "function") {
    featureFlagsAPI = new Proxy(effectiveFlags, {
      set: function (target, key, value) {
        if (!Object.prototype.hasOwnProperty.call(DEFAULT_FLAGS, key)) {
          console.warn("[feature-flags] unknown flag:", key);
          return true; // noop
        }
        target[key] = value;
        persistFeatureFlags(target);
        return true;
      },
    });
  } else {
    featureFlagsAPI = effectiveFlags;
  }

  window.featureFlags = featureFlagsAPI;

  // Utility: reset all flags to defaults (e.g. for settings UI "reset" button)
  window.resetFeatureFlags = function resetFeatureFlags() {
    try {
      if (typeof window.localStorage !== "undefined") {
        window.localStorage.removeItem(FEATURE_FLAGS_STORAGE_KEY);
      }
    } catch (error) {
      console.warn("[feature-flags] reset failed:", error);
    }
    for (var key in DEFAULT_FLAGS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_FLAGS, key)) {
        effectiveFlags[key] = DEFAULT_FLAGS[key];
      }
    }
  };
})();
