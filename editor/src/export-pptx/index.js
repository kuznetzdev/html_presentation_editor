// export-pptx/index.js
// Layer: PPTX Fidelity v2 (ADR-036)
// Lightweight orchestrator wrapper around the existing exportPptx flow.
// When featureFlags.pptxV2 is on, runs the pre-flight report first and
// surfaces it via toast + console; falls through to the legacy exporter.
// Full pre-flight modal UI deferred to a polish patch.
// =====================================================================
"use strict";
(function () {
  "use strict";

  function preflightOnly() {
    if (!window.ExportPptxV2 || typeof window.ExportPptxV2.buildPreflightReport !== "function") {
      return null;
    }
    return window.ExportPptxV2.buildPreflightReport(state.modelDoc);
  }

  function exportPptxV2() {
    var report = preflightOnly();
    if (report && report.ok) {
      // Surface via toast (lightweight) — full modal in follow-up.
      try {
        if (typeof showToast === "function") {
          var fontReplacements = Object.keys(report.replacements.fonts || {}).length;
          showToast(
            "PPTX preflight: слайдов " + report.slideCount +
              ", элементов " + report.elementCount +
              ", шрифтов заменено " + fontReplacements +
              ", SVG → растр " + report.preserved.svgRasterized,
            "info",
            { ttl: 4500, title: "PPTX Fidelity v2" },
          );
        }
      } catch (_) {}
    }
    // Delegate actual export to the existing implementation.
    if (typeof exportPptx === "function") {
      return exportPptx();
    }
    return null;
  }

  // Public surface
  window.ExportPptxV2 = window.ExportPptxV2 || {};
  window.ExportPptxV2.preflight = preflightOnly;
  window.ExportPptxV2.run = exportPptxV2;
})();
