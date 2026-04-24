// export-pptx/font-fallback.js
// Layer: PPTX Fidelity v2 (ADR-036)
// Maps ~30 popular web fonts to their best-match Windows / macOS system
// font available in PowerPoint. Called by the pptx exporter when walking
// text nodes so the exported deck looks close to the browser preview.
// =====================================================================
"use strict";
(function () {
  "use strict";

  // Each key normalized lowercase. PowerPoint-safe targets fall back to
  // cross-platform installed fonts.
  var WEB_TO_PPTX = {
    // Sans-serif families
    "inter": "Segoe UI",
    "roboto": "Segoe UI",
    "open sans": "Segoe UI",
    "lato": "Calibri",
    "montserrat": "Segoe UI Semibold",
    "source sans pro": "Segoe UI",
    "source sans 3": "Segoe UI",
    "nunito": "Segoe UI",
    "nunito sans": "Segoe UI",
    "poppins": "Segoe UI",
    "work sans": "Segoe UI",
    "ibm plex sans": "Segoe UI",
    "fira sans": "Calibri",
    "pt sans": "Calibri",
    "ubuntu": "Calibri",
    "quicksand": "Segoe UI",
    "raleway": "Segoe UI Light",
    "oswald": "Arial Narrow",
    "barlow": "Segoe UI",
    "dm sans": "Segoe UI",
    "manrope": "Segoe UI",
    // Serif
    "merriweather": "Georgia",
    "playfair display": "Georgia",
    "lora": "Georgia",
    "pt serif": "Georgia",
    "cormorant garamond": "Georgia",
    "ibm plex serif": "Georgia",
    // Monospace
    "fira code": "Consolas",
    "source code pro": "Consolas",
    "jetbrains mono": "Consolas",
    "ibm plex mono": "Consolas",
    "roboto mono": "Consolas",
    // Default system stacks
    "-apple-system": "Segoe UI",
    "blinkmacsystemfont": "Segoe UI",
    "system-ui": "Segoe UI",
    "ui-sans-serif": "Segoe UI",
    "ui-serif": "Georgia",
    "ui-monospace": "Consolas",
  };

  function normalizeFamily(raw) {
    return String(raw || "")
      .trim()
      .replace(/^["']+|["']+$/g, "")
      .toLowerCase();
  }

  // Accepts a full CSS font-family value, picks the first non-generic
  // face, maps it. Falls back to the first name if unknown. For stacks
  // with only generic families (serif, sans-serif, monospace), returns
  // a neutral system font.
  function resolveFontFallback(cssFamilyValue) {
    var parts = String(cssFamilyValue || "")
      .split(",")
      .map(normalizeFamily)
      .filter(Boolean);
    if (!parts.length) return "Segoe UI";
    for (var i = 0; i < parts.length; i += 1) {
      var name = parts[i];
      if (WEB_TO_PPTX[name]) return WEB_TO_PPTX[name];
      if (
        name === "serif" || name === "sans-serif" ||
        name === "monospace" || name === "system-ui"
      ) {
        continue;
      }
      // First concrete family — return as-is; PowerPoint will use whatever
      // installed font matches or fall back itself.
      return parts[i].replace(/\b\w/g, function (c) { return c.toUpperCase(); });
    }
    // Only generics; pick a safe default from the last generic.
    var last = parts[parts.length - 1];
    if (last === "serif") return "Georgia";
    if (last === "monospace") return "Consolas";
    return "Segoe UI";
  }

  window.ExportPptxV2 = window.ExportPptxV2 || {};
  window.ExportPptxV2.resolveFontFallback = resolveFontFallback;
  window.ExportPptxV2.WEB_TO_PPTX = WEB_TO_PPTX;
})();
