"use strict";

// contrast-ratio.js — Pure JS WCAG 2.1 relative luminance and contrast ratio helper.
//
// Zero dependencies. No npm install required.
//
// Exports:
//   parseColor(cssColorString) → {r, g, b} with values 0–255
//   contrastRatio(fg, bg)      → Number (e.g. 21.0 for black-on-white)
//
// Supports:
//   #rgb       — 3-digit hex shorthand
//   #rrggbb    — 6-digit hex
//   rgb(r,g,b) — decimal rgb()
//   rgba(r,g,b,a) — rgba() — alpha channel is ignored (contrast is measured against bg)
//
// Formula: WCAG 2.1 §1.4.3 / §1.4.6
//   sRGB linearization:
//     c <= 0.04045  →  c / 12.92
//     c >  0.04045  →  ((c + 0.055) / 1.055) ^ 2.4
//   Relative luminance:
//     L = 0.2126 * R + 0.7152 * G + 0.0722 * B
//   Contrast ratio:
//     (L_lighter + 0.05) / (L_darker + 0.05)

/**
 * Parse a CSS color string into {r, g, b} (0–255 integers).
 * Supports: #rgb, #rrggbb, rgb(...), rgba(...)
 *
 * @param {string} cssColor
 * @returns {{ r: number, g: number, b: number }}
 * @throws {Error} if the color string cannot be parsed
 */
function parseColor(cssColor) {
  const s = String(cssColor || "").trim();

  // #rgb shorthand — expand to #rrggbb
  const hexShort = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  if (hexShort) {
    return {
      r: parseInt(hexShort[1] + hexShort[1], 16),
      g: parseInt(hexShort[2] + hexShort[2], 16),
      b: parseInt(hexShort[3] + hexShort[3], 16),
    };
  }

  // #rrggbb
  const hexFull = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(s);
  if (hexFull) {
    return {
      r: parseInt(hexFull[1], 16),
      g: parseInt(hexFull[2], 16),
      b: parseInt(hexFull[3], 16),
    };
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/.exec(s);
  if (rgbMatch) {
    return {
      r: Math.min(255, parseInt(rgbMatch[1], 10)),
      g: Math.min(255, parseInt(rgbMatch[2], 10)),
      b: Math.min(255, parseInt(rgbMatch[3], 10)),
    };
  }

  throw new Error(`parseColor: unsupported color format: "${cssColor}"`);
}

/**
 * Linearize a single sRGB channel value (0–255) to linear light.
 *
 * @param {number} channel8bit  integer 0–255
 * @returns {number}  linearized value 0–1
 */
function linearize(channel8bit) {
  const c = channel8bit / 255;
  if (c <= 0.04045) {
    return c / 12.92;
  }
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Relative luminance of an sRGB color (WCAG 2.1 formula).
 *
 * @param {{ r: number, g: number, b: number }} color
 * @returns {number}  luminance 0–1
 */
function relativeLuminance(color) {
  const R = linearize(color.r);
  const G = linearize(color.g);
  const B = linearize(color.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * WCAG 2.1 contrast ratio between two colors.
 * Order of fg/bg does not matter — the function always returns the ratio >= 1.
 *
 * @param {{ r: number, g: number, b: number }} colorA
 * @param {{ r: number, g: number, b: number }} colorB
 * @returns {number}  contrast ratio, e.g. 21.0 for black-on-white
 */
function contrastRatio(colorA, colorB) {
  const lumA = relativeLuminance(colorA);
  const lumB = relativeLuminance(colorB);
  const lighter = Math.max(lumA, lumB);
  const darker  = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

module.exports = { parseColor, contrastRatio };
