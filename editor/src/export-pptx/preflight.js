// export-pptx/preflight.js
// Layer: PPTX Fidelity v2 (ADR-036 + V2-06)
// Walks the modelDoc and produces a structured pre-flight report:
//   { ok, slideCount, elementCount, replacements: { fonts: {orig:->new} },
//     losses: [...], preserved: { positions, gradients, svgPrimitives },
//     warnings: [...] }
// =====================================================================
"use strict";
(function () {
  "use strict";

  function buildPreflightReport(modelDoc) {
    if (!modelDoc) return { ok: false, reason: "no-model" };
    var slides = Array.from(modelDoc.querySelectorAll("[data-editor-slide-id]"));
    var elements = Array.from(modelDoc.querySelectorAll("[data-editor-node-id]"));
    var fontsMap = {};
    var losses = [];
    var preserved = {
      positions: 0,
      gradients: 0,
      svgPrimitives: 0,
      svgRasterized: 0,
      images: 0,
      texts: 0,
    };

    var resolveFont =
      window.ExportPptxV2 && window.ExportPptxV2.resolveFontFallback;
    var describeBackgroundImage =
      window.ExportPptxV2 && window.ExportPptxV2.describeBackgroundImage;
    var describeSvgRoot =
      window.ExportPptxV2 && window.ExportPptxV2.describeSvgRoot;

    elements.forEach(function (el) {
      var inlineStyle = el.getAttribute("style") || "";
      // Position preserved if inline left/top present (or we'll compute via
      // getBoundingClientRect at export time).
      if (/(^|;)\s*(left|top)\s*:/i.test(inlineStyle)) {
        preserved.positions += 1;
      }
      if (resolveFont) {
        var fontFamily = "";
        var match = inlineStyle.match(/font-family\s*:\s*([^;]+)/i);
        if (match) fontFamily = match[1].trim();
        if (fontFamily) {
          var resolved = resolveFont(fontFamily);
          if (resolved && resolved.toLowerCase() !== fontFamily.toLowerCase()) {
            fontsMap[fontFamily] = resolved;
          }
        }
      }
      if (describeBackgroundImage) {
        var bgMatch = inlineStyle.match(/background(?:-image)?\s*:\s*([^;]+)/i);
        if (bgMatch) {
          var d = describeBackgroundImage(bgMatch[1]);
          if (d && d.kind === "linear") preserved.gradients += 1;
          else if (d && d.kind === "raster") {
            losses.push({
              kind: "gradient-raster",
              detail: "Radial/conic gradient → rasterized to PNG",
              nodeId: el.getAttribute("data-editor-node-id") || "",
            });
          }
        }
      }
      // Image accounting
      if (el.tagName.toLowerCase() === "img") preserved.images += 1;
      // Text accounting
      if (
        el.getAttribute("data-editor-entity-kind") === "text" ||
        (el.children.length === 0 && (el.textContent || "").trim().length > 0)
      ) {
        preserved.texts += 1;
      }
      // SVG breakdown
      var svg = el.tagName.toLowerCase() === "svg" ? el : el.querySelector("svg");
      if (svg && describeSvgRoot) {
        var d2 = describeSvgRoot(svg);
        if (d2 && d2.kind === "primitives") preserved.svgPrimitives += 1;
        else if (d2 && d2.kind === "rasterize") {
          preserved.svgRasterized += 1;
          losses.push({
            kind: "svg-rasterize",
            detail: "SVG too complex (" + d2.reason + ") → rasterized",
            nodeId: el.getAttribute("data-editor-node-id") || "",
          });
        }
      }
    });

    var warnings = [];
    if (preserved.svgRasterized > 0) {
      warnings.push({
        kind: "svg-rasterize",
        message: "SVG, преобразованных в растр: " + preserved.svgRasterized,
      });
    }
    if (Object.keys(fontsMap).length) {
      warnings.push({
        kind: "font-fallback",
        message: "Шрифтов заменено на системные: " + Object.keys(fontsMap).length,
      });
    }
    if (losses.length === 0) warnings.push({ kind: "ok", message: "Потерь не обнаружено." });

    return {
      ok: true,
      slideCount: slides.length,
      elementCount: elements.length,
      replacements: { fonts: fontsMap },
      losses: losses,
      preserved: preserved,
      warnings: warnings,
    };
  }

  window.ExportPptxV2 = window.ExportPptxV2 || {};
  window.ExportPptxV2.buildPreflightReport = buildPreflightReport;
})();
