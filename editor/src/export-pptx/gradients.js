// export-pptx/gradients.js
// Layer: PPTX Fidelity v2 (ADR-036)
// Parses CSS linear-gradient(...) values into a structured form that
// PptxGenJS or post-processing can consume. Currently emits color
// stops + angle. Radial / conic gradients return a "raster" hint so
// callers fall back to PNG export.
// =====================================================================
"use strict";
(function () {
  "use strict";

  // Normalize "to right" / "to bottom" / etc. into a degrees value
  // matching the CSS spec (0deg = upward).
  function directionToDegrees(direction) {
    var dir = String(direction || "").trim().toLowerCase();
    var TABLE = {
      "to top":          0,
      "to top right":   45,
      "to right":       90,
      "to bottom right": 135,
      "to bottom":     180,
      "to bottom left": 225,
      "to left":       270,
      "to top left":   315,
    };
    if (TABLE[dir] !== undefined) return TABLE[dir];
    var match = dir.match(/^(-?\d+(?:\.\d+)?)\s*deg$/);
    if (match) {
      var n = Number(match[1]);
      // Keep within [0, 360).
      var normalized = ((n % 360) + 360) % 360;
      return normalized;
    }
    return null;
  }

  // Parse a single color stop: "#hex", "rgb(...)", "rgba(...)" optionally
  // followed by " 25%". Returns { color, position } where position is in
  // [0..1] or null if absent.
  function parseColorStop(raw) {
    var trimmed = String(raw || "").trim();
    if (!trimmed) return null;
    var positionMatch = trimmed.match(/(.*?)\s+([\d.]+%|[\d.]+px)$/);
    var color = positionMatch ? positionMatch[1].trim() : trimmed;
    var position = null;
    if (positionMatch) {
      var pos = positionMatch[2];
      if (pos.endsWith("%")) position = Number(pos.slice(0, -1)) / 100;
      // px → ignored; treat as relative which we can't know without bbox
    }
    return { color: color, position: position };
  }

  // Parse `linear-gradient(<dir>, <stop1>, <stop2>, ...)`. Returns
  // { kind: "linear", angle, stops } or null on parse failure.
  function parseLinearGradient(value) {
    var v = String(value || "").trim();
    if (!/^linear-gradient\(/i.test(v)) return null;
    var inner = v
      .replace(/^linear-gradient\(/i, "")
      .replace(/\)\s*$/, "")
      .trim();
    // Naive split on commas — works for color stops without commas in their
    // own arguments. rgba(r,g,b,a) breaks this; protect with a token swap.
    var protectedStr = inner.replace(/(rgba?|hsla?)\(([^)]+)\)/gi, function (m) {
      return m.replace(/,/g, "\u0001");
    });
    var parts = protectedStr.split(",").map(function (p) {
      return p.replace(/\u0001/g, ",").trim();
    });
    if (!parts.length) return null;
    var angle = null;
    var head = parts[0];
    var deg = directionToDegrees(head);
    if (deg !== null) {
      angle = deg;
      parts = parts.slice(1);
    } else {
      angle = 180; // CSS default: top-to-bottom
    }
    var stops = parts.map(parseColorStop).filter(Boolean);
    if (!stops.length) return null;
    // Auto-distribute stops without a position evenly across [0..1].
    var withPos = stops.map(function (s, i) {
      if (s.position !== null) return s;
      return { color: s.color, position: i / Math.max(1, stops.length - 1) };
    });
    return { kind: "linear", angle: angle, stops: withPos };
  }

  function describeBackgroundImage(value) {
    var v = String(value || "").trim();
    if (!v || v === "none") return null;
    if (/^linear-gradient\(/i.test(v)) return parseLinearGradient(v);
    if (/^(radial|conic)-gradient\(/i.test(v)) {
      return { kind: "raster", reason: v.split("-")[0] + "-gradient" };
    }
    if (/^url\(/i.test(v)) return { kind: "image", url: v };
    return { kind: "unknown", raw: v };
  }

  window.ExportPptxV2 = window.ExportPptxV2 || {};
  window.ExportPptxV2.directionToDegrees = directionToDegrees;
  window.ExportPptxV2.parseLinearGradient = parseLinearGradient;
  window.ExportPptxV2.describeBackgroundImage = describeBackgroundImage;
})();
