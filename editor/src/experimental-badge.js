// experimental-badge.js
// Layer: UX honesty — visual markers for experimental capabilities (v1.5.0)
// =====================================================================
// Adds an inline "Beta"/"Experimental" chip next to a UI element so the
// user knows a feature is sharp-edged. Used for: tree-mode layers (until
// flag-on by default and battle-tested), Smart Import full mode, PPTX
// fidelity v2, anywhere a flag is still risky.
//
// API:
//   attachExperimentalBadge(targetEl, label?, tooltip?)
//   removeExperimentalBadge(targetEl)
//   refreshExperimentalBadges()  — re-applies markers based on current flags
// =====================================================================
"use strict";
(function () {
  "use strict";

  function attachExperimentalBadge(target, label, tooltip) {
    if (!(target instanceof HTMLElement)) return null;
    if (target.querySelector(":scope > .experimental-badge")) return null;
    var span = document.createElement("span");
    span.className = "experimental-badge";
    span.textContent = String(label || "Beta");
    if (tooltip) span.title = String(tooltip);
    span.setAttribute("aria-label", "Экспериментальная функция: " + (tooltip || label || "Beta"));
    target.appendChild(span);
    return span;
  }

  function removeExperimentalBadge(target) {
    if (!(target instanceof HTMLElement)) return false;
    var existing = target.querySelector(":scope > .experimental-badge");
    if (!existing) return false;
    existing.remove();
    return true;
  }

  // Apply badges per current flag state on canonical surfaces.
  // Called once at boot and any time featureFlags change.
  function refreshExperimentalBadges() {
    if (!window.featureFlags) return;
    // [v2.0.19 / FN-001] PPTX export button — Beta badge removed. Legacy
    // export pipeline (PptxGenJS via export.js:exportPptx()) is verified
    // by `tests/playwright/specs/pptx-export-roundtrip.spec.js` to produce
    // a valid .pptx archive containing slide titles + correct slide count.
    // ExportPptxV2 helpers (preflight, position-resolver, gradients,
    // svg-shapes, font-fallback) ship as instrumentation but the writer
    // intentionally stays on the proven legacy path for v2.0.x. The badge
    // was misleading — the user-visible function works.
    var pptxBtn = document.getElementById("exportPptxBtn");
    if (pptxBtn) {
      removeExperimentalBadge(pptxBtn);
    }
    // Smart Import "full" mode is opt-in only — when "report", we don't
    // badge (stable). Badge when "full".
    var openBtn = document.getElementById("openHtmlBtn");
    if (openBtn) {
      if (window.featureFlags.smartImport === "full") {
        attachExperimentalBadge(
          openBtn,
          "Beta",
          "Smart Import full mode подменяет основной loader. Если deck не открывается — переключи на report в devtools.",
        );
      } else {
        removeExperimentalBadge(openBtn);
      }
    }
  }

  window.attachExperimentalBadge = attachExperimentalBadge;
  window.removeExperimentalBadge = removeExperimentalBadge;
  window.refreshExperimentalBadges = refreshExperimentalBadges;
})();
