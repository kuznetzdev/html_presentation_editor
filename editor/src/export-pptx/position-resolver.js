// export-pptx/position-resolver.js
// Layer: PPTX Fidelity v2 (ADR-036)
// Resolves precise per-element bounding box for the PPTX exporter using
// the live preview iframe's getBoundingClientRect, normalized to slide
// coordinates (top-left of slide-root === 0,0). EMU conversion helpers
// included for direct PptxGenJS consumption.
// =====================================================================
"use strict";
(function () {
  "use strict";

  // PowerPoint's English Metric Unit (EMU) per inch.
  var EMU_PER_INCH = 914400;
  // 96px per CSS inch.
  var PX_PER_INCH = 96;

  function pxToEmu(px) {
    return Math.round((px / PX_PER_INCH) * EMU_PER_INCH);
  }

  function emuToPx(emu) {
    return Math.round((emu / EMU_PER_INCH) * PX_PER_INCH);
  }

  // Convert px → PptxGenJS "inches" coord (PptxGenJS accepts inches).
  function pxToInch(px) {
    return Number((px / PX_PER_INCH).toFixed(4));
  }

  // Resolve the CSS bounding rect of an element relative to its slide root.
  // Returns { left, top, width, height } in CSS pixels at zoom 1.0.
  function resolveSlideRelativeRect(slideRoot, el) {
    if (!slideRoot || !el || typeof el.getBoundingClientRect !== "function") {
      return null;
    }
    var slideRect = slideRoot.getBoundingClientRect();
    var elRect = el.getBoundingClientRect();
    return {
      left: elRect.left - slideRect.left,
      top: elRect.top - slideRect.top,
      width: elRect.width,
      height: elRect.height,
    };
  }

  // Resolve every editable child of slideRoot to slide-relative pixel rects,
  // keyed by data-editor-node-id.
  function resolveAllRects(slideRoot) {
    if (!slideRoot) return {};
    var out = {};
    var nodes = slideRoot.querySelectorAll("[data-editor-node-id]");
    for (var i = 0; i < nodes.length; i += 1) {
      var n = nodes[i];
      var id = n.getAttribute("data-editor-node-id");
      if (!id) continue;
      var rect = resolveSlideRelativeRect(slideRoot, n);
      if (rect) out[id] = rect;
    }
    return out;
  }

  window.ExportPptxV2 = window.ExportPptxV2 || {};
  window.ExportPptxV2.pxToEmu = pxToEmu;
  window.ExportPptxV2.emuToPx = emuToPx;
  window.ExportPptxV2.pxToInch = pxToInch;
  window.ExportPptxV2.resolveSlideRelativeRect = resolveSlideRelativeRect;
  window.ExportPptxV2.resolveAllRects = resolveAllRects;
  window.ExportPptxV2.EMU_PER_INCH = EMU_PER_INCH;
})();
