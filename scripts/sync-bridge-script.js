#!/usr/bin/env node
"use strict";

/**
 * sync-bridge-script.js
 *
 * Phase A2 / ADR-031 — keep editor/src/bridge-script.js in sync with the
 * lint-clean source-of-truth file editor/src/bridge-script-iframe.js.
 *
 *  bridge-script-iframe.js  (real JS, lint-visible, tsc-visible — SOURCE)
 *      │
 *      │  1. read iframe-source content
 *      │  2. strip __BEGIN_PLACEHOLDER_DEFAULTS__…__END_PLACEHOLDER_DEFAULTS__
 *      │  3. replace placeholder identifiers with original ${...} expressions
 *      │
 *      ▼
 *  bridge-script.js         (template literal — INJECTED INTO IFRAME)
 *
 * The wrapper file holds line-1..N header comments, the
 *   `function buildBridgeScript(token) { return ` `` ` ``
 * preamble, then BETWEEN the sentinel comments
 *   // __BEGIN_IFRAME_CONTENT__   ← managed by sync-bridge-script.js
 *   ...                            ← do NOT hand-edit
 *   // __END_IFRAME_CONTENT__
 * the regenerated content, then the closing `` `; }``.
 *
 * Determinism: byte-stable when run twice; idempotent.
 *
 * Pre-commit invocation: node scripts/sync-bridge-script.js
 * Returns 0 on success, non-zero on:
 *   - missing source file
 *   - sentinels not found in wrapper
 *   - unrecognized placeholder remains in iframe-source
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SRC_IFACE = path.join(ROOT, "editor", "src", "bridge-script-iframe.js");
const DST_WRAPPER = path.join(ROOT, "editor", "src", "bridge-script.js");

// ── Placeholder reverse-substitution map ───────────────────────────────
// Each placeholder identifier in bridge-script-iframe.js maps back to the
// original template-literal interpolation expression in bridge-script.js.
const PLACEHOLDERS = [
  // [placeholder, ${expr}]
  ["__BRIDGE_TOKEN_PLACEHOLDER__", "${JSON.stringify(token)}"],
  ["__ROOT_SELECTORS_PLACEHOLDER__", "${JSON.stringify(STATIC_SLIDE_SELECTORS)}"],
  ["__MAX_HTML_BYTES_PLACEHOLDER__", "${JSON.stringify(262144)}"],
  ["__SHELL_BUILD_PLACEHOLDER__", "${JSON.stringify(SHELL_BUILD)}"],
];

const DEFAULTS_BEGIN = "// __BEGIN_PLACEHOLDER_DEFAULTS__";
const DEFAULTS_END = "// __END_PLACEHOLDER_DEFAULTS__";
const IFRAME_BEGIN = "// __BEGIN_IFRAME_CONTENT__";
const IFRAME_END = "// __END_IFRAME_CONTENT__";

function fail(msg) {
  process.stderr.write(`[sync-bridge-script] FAIL: ${msg}\n`);
  process.exit(1);
}

// ── 1. Read iframe-source ──────────────────────────────────────────────
let ifaceText;
try {
  ifaceText = fs.readFileSync(SRC_IFACE, "utf8");
} catch (e) {
  fail(`cannot read ${SRC_IFACE}: ${e.message}`);
}
const EOL = ifaceText.includes("\r\n") ? "\r\n" : "\n";

// ── 2. Strip the placeholder-defaults block ────────────────────────────
const dStart = ifaceText.indexOf(DEFAULTS_BEGIN);
const dEnd = ifaceText.indexOf(DEFAULTS_END);
if (dStart === -1 || dEnd === -1 || dEnd <= dStart) {
  fail(
    `placeholder-defaults sentinels not found in ${SRC_IFACE}.\n` +
      `  Expected ${DEFAULTS_BEGIN} and ${DEFAULTS_END} bracketing the defaults block.`
  );
}
// We strip from the start of DEFAULTS_BEGIN line to the end-of-line of
// DEFAULTS_END (and the line break). The resulting text drops the entire
// placeholder-defaults block.
const dEndLineEnd = ifaceText.indexOf(EOL, dEnd) + EOL.length;
let stripped = ifaceText.slice(0, dStart) + ifaceText.slice(dEndLineEnd);

// ALSO strip every line of the iframe-source that comes BEFORE the
// `(function(){` IIFE opener — those are the file's header comments,
// which belong in bridge-script.js's own line 1-6 header (NOT in the
// generated body).
//
// To stay deterministic we look for the literal IIFE opener `(function(){`
// at the start of a line. Anything before that line is dropped.
const iifeStart = stripped.indexOf(EOL + "(function(){");
if (iifeStart === -1) {
  fail("could not locate IIFE opener `\\n(function(){` in iframe-source after stripping defaults.");
}
// Keep from iifeStart + EOL onward (skip the leading newline).
stripped = stripped.slice(iifeStart + EOL.length);

// Optionally strip a trailing newline so the wrapper's closing backtick
// follows immediately after `})();` (matching the existing layout where
// the closing backtick lives on the same line as `})();`).
stripped = stripped.replace(/[\r\n]+$/, "");

// ── 3a. Re-escape backslashes for template-literal context ────────────
//
// The standalone iframe-source has each backslash as ONE character; when
// we splice this content back inside the wrapper's template literal, we
// must DOUBLE every backslash so the template-literal escape rules
// produce the same runtime string. This is the inverse of the
// `\\` → `\` un-escape performed by the extract step.
//
// The order matters: we re-escape BEFORE placeholder substitution, so
// the substituted `${...}` expressions are NOT touched (they contain no
// backslashes to begin with).
const BS = String.fromCharCode(92);
let body = stripped.split(BS).join(BS + BS);

// ── 3b. Reverse-substitute placeholders → ${...} ───────────────────────
const seenCounts = {};
for (const [ph, expr] of PLACEHOLDERS) {
  let count = 0, pos = 0;
  while ((pos = body.indexOf(ph, pos)) !== -1) {
    count++;
    pos += ph.length;
  }
  seenCounts[ph] = count;
  body = body.split(ph).join(expr);
}

// Catch-all: ANY surviving placeholder identifier matching __X__ is a bug.
const orphan = body.match(/__[A-Z_]+_PLACEHOLDER__/g);
if (orphan && orphan.length > 0) {
  fail(`unsubstituted placeholder identifiers remain: ${[...new Set(orphan)].join(", ")}`);
}

// ── 4. Splice into wrapper between sentinels ───────────────────────────
let wrapperText;
try {
  wrapperText = fs.readFileSync(DST_WRAPPER, "utf8");
} catch (e) {
  fail(`cannot read ${DST_WRAPPER}: ${e.message}`);
}
const wEOL = wrapperText.includes("\r\n") ? "\r\n" : "\n";

const wStart = wrapperText.indexOf(IFRAME_BEGIN);
const wEnd = wrapperText.indexOf(IFRAME_END);
if (wStart === -1 || wEnd === -1 || wEnd <= wStart) {
  fail(
    `iframe-content sentinels not found in ${DST_WRAPPER}.\n` +
      `  Expected ${IFRAME_BEGIN} and ${IFRAME_END} bracketing the iframe content.`
  );
}
// Replace from end of IFRAME_BEGIN line to start of IFRAME_END line.
const wStartLineEnd = wrapperText.indexOf(wEOL, wStart) + wEOL.length;
const wEndLineStart = wrapperText.lastIndexOf(wEOL, wEnd) + wEOL.length;

const newWrapperText =
  wrapperText.slice(0, wStartLineEnd) +
  body +
  wEOL +
  wrapperText.slice(wEndLineStart);

// ── 5. Write only if changed ───────────────────────────────────────────
if (newWrapperText === wrapperText) {
  process.stdout.write("[sync-bridge-script] no-op (already in sync).\n");
  process.exit(0);
}
fs.writeFileSync(DST_WRAPPER, newWrapperText, "utf8");
process.stdout.write(
  `[sync-bridge-script] regenerated ${path.relative(ROOT, DST_WRAPPER)} ` +
    `(${newWrapperText.length} bytes).\n` +
    `  placeholder substitutions: ${PLACEHOLDERS.map(
      ([ph]) => `${seenCounts[ph]}× ${ph}`
    ).join(", ")}\n`
);
