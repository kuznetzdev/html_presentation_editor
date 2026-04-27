#!/usr/bin/env node
"use strict";

/**
 * SPIKE — proves that we can extract the iframe-side content from
 * bridge-script.js into a placeholder-bearing standalone file, then
 * regenerate bridge-script.js byte-identically by substituting
 * placeholders back to ${...} expressions.
 *
 * Phase A2 / ADR-031, step 2.
 *
 * Run:   node scripts/_spike-sync-bridge-script.js
 * Exit:  0 if round-trip is byte-identical, 1 if not.
 *
 * NO files are written; this is a read-only proof.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "editor", "src", "bridge-script.js");

const original = fs.readFileSync(SRC, "utf8");

// ── 1. Anchor: locate the opening + closing of the template literal. ──
//
// Line 8 ends with `return \`(function(){` and line 3905 starts with
// `      })();\`;`. Use literal anchors instead of regex backreferences
// to avoid escape-sequence ambiguity inside this script itself.
// File uses CRLF line endings on Windows; preserve them in anchors.
const EOL = original.includes("\r\n") ? "\r\n" : "\n";
const OPEN_ANCHOR = "        return `";
const CLOSE_ANCHOR = "`;" + EOL + "      }" + EOL;
// the trailing `;` ends the return statement, then function close brace.

const openIdx = original.indexOf(OPEN_ANCHOR);
if (openIdx === -1) {
  console.error("[spike] open anchor not found");
  process.exit(1);
}
const ifaceStart = openIdx + OPEN_ANCHOR.length; // first char inside template literal

// Find the closing backtick at the END of the file (last occurrence —
// safer than last-line scan because comments may contain backticks).
const closeIdx = original.lastIndexOf(CLOSE_ANCHOR);
if (closeIdx === -1) {
  console.error("[spike] close anchor not found");
  process.exit(1);
}
const ifaceEnd = closeIdx; // position of closing backtick

const ifaceContent = original.slice(ifaceStart, ifaceEnd);
const wrapperHead = original.slice(0, ifaceStart);
const wrapperTail = original.slice(ifaceEnd);

console.log(
  `[spike] anchors located. iframe content: ${ifaceContent.length} chars (${
    ifaceContent.split("\n").length
  } lines).`
);

// ── 2. Substitute the 5 known interpolations to placeholders. ──
//
// Each interpolation in source is a literal string we can match exactly.
// We match the FULL ${...} expression and replace with a placeholder
// identifier. The reverse map gives us perfect round-trip.
const SUBSTITUTIONS = [
  // [originalExprWithDollar, placeholderToken]
  ["${JSON.stringify(token)}", "__BRIDGE_TOKEN_PLACEHOLDER__"],
  [
    "${JSON.stringify(STATIC_SLIDE_SELECTORS)}",
    "__ROOT_SELECTORS_PLACEHOLDER__",
  ],
  ["${JSON.stringify(262144)}", "__MAX_HTML_BYTES_PLACEHOLDER__"],
  ["${JSON.stringify(SHELL_BUILD)}", "__SHELL_BUILD_PLACEHOLDER__"],
];

// Apply each substitution — match every occurrence (replaceAll).
let withPlaceholders = ifaceContent;
const counts = {};
for (const [orig, placeholder] of SUBSTITUTIONS) {
  // Count occurrences first so we know how many were swapped.
  let count = 0;
  let pos = 0;
  while ((pos = withPlaceholders.indexOf(orig, pos)) !== -1) {
    count++;
    pos += orig.length;
  }
  counts[orig] = count;
  withPlaceholders = withPlaceholders.split(orig).join(placeholder);
}

console.log("[spike] substitutions applied:");
for (const [orig, n] of Object.entries(counts)) {
  console.log(`        ${n}x  ${orig.slice(0, 50)}${orig.length > 50 ? "…" : ""}`);
}

// Verify total: there should be NO REMAINING `${` in the placeholder version.
// (If there were any other `${...}` in the file we missed, this would catch.)
const remaining = withPlaceholders.match(/\$\{[^}]+\}/g) || [];
if (remaining.length > 0) {
  console.error(
    `[spike] FAIL — ${remaining.length} unexpected \${...} remain in placeholder content:`
  );
  for (const r of remaining.slice(0, 10)) console.error(`        ${r}`);
  process.exit(1);
}
console.log("[spike] no unexpected ${...} interpolations remain after placeholder swap.");

// ── 3. Reverse-substitute (placeholders → original ${...}). ──
let reconstructedIface = withPlaceholders;
for (const [orig, placeholder] of SUBSTITUTIONS) {
  reconstructedIface = reconstructedIface.split(placeholder).join(orig);
}

// ── 4. Reassemble full file and compare byte-by-byte. ──
const reconstructed = wrapperHead + reconstructedIface + wrapperTail;
if (reconstructed === original) {
  console.log("[spike] PASS — round-trip is byte-identical (" + reconstructed.length + " chars).");
  process.exit(0);
}

// Diff diagnostics
console.error("[spike] FAIL — round-trip differs.");
console.error(`        original: ${original.length} chars`);
console.error(`        reconstructed: ${reconstructed.length} chars`);
// Find first divergence
let i = 0;
while (i < Math.min(original.length, reconstructed.length) && original[i] === reconstructed[i]) {
  i++;
}
const ctx = 80;
console.error(
  `        first divergence at byte ${i}:\n` +
    `        original [${i - 5}..${i + ctx}]: ${JSON.stringify(original.slice(Math.max(0, i - 5), i + ctx))}\n` +
    `        recons   [${i - 5}..${i + ctx}]: ${JSON.stringify(reconstructed.slice(Math.max(0, i - 5), i + ctx))}`
);
process.exit(1);
