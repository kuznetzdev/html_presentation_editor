// export-pptx/svg-shapes.js
// Layer: PPTX Fidelity v2 (ADR-036)
// Maps inline <svg> primitives (rect, circle, ellipse, polygon triangle,
// line) to PptxGenJS shape descriptors. When the SVG is too complex to
// translate, callers fall back to rasterizing via Canvas — that decision
// is signaled by `kind: "rasterize"` here.
// =====================================================================
"use strict";
(function () {
  "use strict";

  function nf(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }

  function describePrimitive(shape) {
    if (!(shape instanceof Element)) return null;
    var tag = shape.tagName.toLowerCase();
    if (tag === "rect") {
      return {
        kind: "rect",
        x: nf(shape.getAttribute("x")),
        y: nf(shape.getAttribute("y")),
        w: nf(shape.getAttribute("width")),
        h: nf(shape.getAttribute("height")),
        fill: shape.getAttribute("fill") || "",
        stroke: shape.getAttribute("stroke") || "",
        rx: nf(shape.getAttribute("rx")),
      };
    }
    if (tag === "circle") {
      var cx = nf(shape.getAttribute("cx"));
      var cy = nf(shape.getAttribute("cy"));
      var r = nf(shape.getAttribute("r"));
      return {
        kind: "ellipse",
        x: cx - r,
        y: cy - r,
        w: r * 2,
        h: r * 2,
        fill: shape.getAttribute("fill") || "",
        stroke: shape.getAttribute("stroke") || "",
      };
    }
    if (tag === "ellipse") {
      return {
        kind: "ellipse",
        x: nf(shape.getAttribute("cx")) - nf(shape.getAttribute("rx")),
        y: nf(shape.getAttribute("cy")) - nf(shape.getAttribute("ry")),
        w: nf(shape.getAttribute("rx")) * 2,
        h: nf(shape.getAttribute("ry")) * 2,
        fill: shape.getAttribute("fill") || "",
        stroke: shape.getAttribute("stroke") || "",
      };
    }
    if (tag === "line") {
      return {
        kind: "line",
        x1: nf(shape.getAttribute("x1")),
        y1: nf(shape.getAttribute("y1")),
        x2: nf(shape.getAttribute("x2")),
        y2: nf(shape.getAttribute("y2")),
        stroke: shape.getAttribute("stroke") || "currentColor",
      };
    }
    if (tag === "polygon") {
      var pts = String(shape.getAttribute("points") || "")
        .trim()
        .split(/[\s,]+/)
        .map(function (p) { return Number(p); })
        .filter(function (n) { return Number.isFinite(n); });
      var pairs = [];
      for (var i = 0; i + 1 < pts.length; i += 2) pairs.push({ x: pts[i], y: pts[i + 1] });
      // Special-case 3-point polygon → triangle for native PPTX shape.
      if (pairs.length === 3) {
        return {
          kind: "triangle",
          points: pairs,
          fill: shape.getAttribute("fill") || "",
          stroke: shape.getAttribute("stroke") || "",
        };
      }
      return { kind: "polygon", points: pairs, fill: shape.getAttribute("fill") || "" };
    }
    return null;
  }

  // Walk an <svg> root and emit a list of native PPTX shape descriptors.
  // If anything is too complex (paths with curves, gradients, filters, masks,
  // clip-paths), we mark the whole svg as "rasterize" so the caller can
  // export it as a PNG instead.
  function describeSvgRoot(svgEl) {
    if (!(svgEl instanceof SVGSVGElement)) return { kind: "rasterize", reason: "not-svg" };
    if (svgEl.querySelector("path, mask, clipPath, filter, defs > linearGradient, defs > radialGradient")) {
      return { kind: "rasterize", reason: "complex" };
    }
    var primitives = [];
    var children = svgEl.children;
    for (var i = 0; i < children.length; i += 1) {
      var d = describePrimitive(children[i]);
      if (d) primitives.push(d);
    }
    if (!primitives.length) return { kind: "rasterize", reason: "no-primitives" };
    return { kind: "primitives", primitives: primitives };
  }

  window.ExportPptxV2 = window.ExportPptxV2 || {};
  window.ExportPptxV2.describeSvgRoot = describeSvgRoot;
  window.ExportPptxV2.describeSvgPrimitive = describePrimitive;
})();
