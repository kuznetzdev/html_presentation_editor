"use strict";

/**
 * bridge-regex-whitespace.spec.js
 *
 * Phase A3' (v2.0.25) — regression test for the 3 latent regex bugs found
 * during Phase A2 (ADR-031) bridge-script extraction.
 *
 * BUG PROFILE (preserved verbatim through Phase A2 extraction):
 *   The original bridge-script.js source carried `replace(/\s+/g, ' ')` written
 *   inside a wrapping template literal. The single backslash was consumed by
 *   the template-literal escape rules, so the runtime regex was actually
 *   `/s+/g` (matches literal 's' chars, NOT whitespace). The bug existed at
 *   3 sites in the iframe-injected bridge code (selection-label normalization
 *   and layout-container kind heuristic). Phase A2 extracted the iframe code
 *   to editor/src/bridge-script-iframe.js but mandated "same behavior", so
 *   the bug was preserved with `// PRESERVED runtime semantics` markers.
 *
 * Phase A3' fixes the source to `/\\s+/g` (which the sync script doubles to
 * `/\\\\s+/g` in the wrapper template — collapsed back to `/\s+/g` at runtime).
 *
 * THIS TEST proves the runtime semantics are now correct:
 *
 *   1. Static-string assertion on the produced bridge runtime string:
 *        - Bug pattern  `/s+/g`  must occur 0 times.
 *        - Fixed pattern `/\s+/g` must occur ≥ 5 times (3 fixed sites + 2
 *          pre-existing correct sites that were never affected).
 *
 *   2. Functional assertion on the same regex pattern, exercising
 *      multi-whitespace collapse semantics:
 *        - Input  `"  Hello   World  "`
 *        - Bug-regex output (kept for reference): `"Hello   World"` — runs of
 *          's' collapsed, whitespace preserved.
 *        - Fix-regex output:                       `"Hello World"`     —
 *          whitespace collapsed, 's' chars preserved.
 *
 * The fail-then-pass evidence captured during development is documented in
 * the v2.0.25 changelog entry. On v2.0.24 the static assertion (1) FAILS
 * with `bugCount = 4`: the 3 buggy regex sites plus the comment block in
 * the wrapper that quotes the literal text "/s+/g" while explaining the
 * bug to future readers. Either path catches the regression.
 *
 * No Playwright browser navigation is needed — the assertions operate purely
 * on Node-side reads of editor/src/bridge-script.js. We use Playwright's
 * test runner so the case lives alongside other gate-A specs.
 */

const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const BRIDGE_WRAPPER_PATH = path.join(
  REPO_ROOT,
  "editor",
  "src",
  "bridge-script.js",
);

/**
 * Load editor/src/bridge-script.js inside a fresh vm context with the
 * dependencies the wrapper closes over (STATIC_SLIDE_SELECTORS, SHELL_BUILD)
 * stubbed, then call buildBridgeScript(token) to materialize the runtime
 * string that the editor injects into the preview iframe.
 */
function buildBridgeRuntimeString(token) {
  const code = fs.readFileSync(BRIDGE_WRAPPER_PATH, "utf8");
  const sandbox = {
    STATIC_SLIDE_SELECTORS: ["section.slide"],
    SHELL_BUILD: { version: "regression-test" },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  if (typeof sandbox.buildBridgeScript !== "function") {
    throw new Error(
      "buildBridgeScript was not defined after evaluating bridge-script.js",
    );
  }
  return sandbox.buildBridgeScript(token);
}

test.describe("bridge-script regex whitespace normalization (v2.0.25 — Phase A3')", () => {
  test(
    "iframe runtime contains no `/s+/g` (bug pattern) and has ≥5 `/\\s+/g` (fixed pattern) @stage-a",
    () => {
      const runtime = buildBridgeRuntimeString("regression-token");

      const BUG_PATTERN = "/s+/g";
      const FIXED_PATTERN = "/" + String.fromCharCode(92) + "s+/g"; // literal /\s+/g

      const bugCount = runtime.split(BUG_PATTERN).length - 1;
      const fixedCount = runtime.split(FIXED_PATTERN).length - 1;

      // The bug pattern must NOT appear in the produced runtime string.
      // On v2.0.24 this was 3 (the three preserved sites). After Phase A3'
      // it must be 0 — otherwise the Phase A2 extraction's `// PRESERVED
      // runtime semantics` comment markers were not actually fixed.
      expect(bugCount).toBe(0);

      // 3 fixed sites + 2 pre-existing correct sites that were never broken
      // (slide-title sanitizer and slug-id sanitizer). We tolerate growth
      // (≥5) but assert the lower bound so accidental site-loss is caught.
      expect(fixedCount).toBeGreaterThanOrEqual(5);
    },
  );

  test(
    "fix-regex collapses whitespace AND preserves 's' chars (the user-visible behavior)",
    () => {
      // The exact pattern the iframe runs at the three fix sites. We build
      // the RegExp from a string so the test source itself does not have
      // the same template-literal escape hazard as the bug we are guarding.
      const runtimeRegex = new RegExp(String.fromCharCode(92) + "s+", "g");

      // Use a sample that contains BOTH literal 's' chars and runs of
      // whitespace, so the differential between the bug and the fix is
      // sharp on every dimension.
      const sample = "  This  is   a   test  ";

      const normalized = sample.replace(runtimeRegex, " ").trim();
      // Fixed semantics: multi-whitespace collapses to single space; 's'
      // chars are preserved untouched.
      expect(normalized).toBe("This is a test");
      expect(normalized).toContain("s"); // 's' in 'This', 'is', 'test' must survive

      // Cross-check the BUG semantics for reference: this is what v2.0.24
      // produced — it would NOT have collapsed whitespace AND would have
      // stripped 's' chars. We exercise the bug regex here just to make
      // the differential explicit; we do NOT assert any user-visible code
      // path uses it.
      const buggy = sample.replace(/s+/g, " ").trim();
      expect(buggy).not.toBe(normalized);
      expect(buggy).not.toContain("s"); // every 's' was replaced with space
    },
  );

  test(
    "selection-breadcrumb-label normalization sample matches fixed semantics",
    () => {
      // Reproduces the call shape from getSelectionBreadcrumbLabel:
      //   const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      //   if (text) return text.slice(0, 32) + (text.length > 32 ? '…' : '');
      const runtimeRegex = new RegExp(String.fromCharCode(92) + "s+", "g");
      const textContent =
        "\n            This fixture exercises text editing,\n            selection, duplication, export\n          ";
      const text = String(textContent || "")
        .replace(runtimeRegex, " ")
        .trim();
      const label = text.slice(0, 32) + (text.length > 32 ? "…" : "");

      // With the FIX, the label starts with the readable phrase and contains
      // 's' chars. With the BUG, multi-line indentation would survive AND
      // 's' chars would be missing.
      expect(label.startsWith("This fixture")).toBe(true);
      expect(label).toContain("s"); // bug-mode would have stripped these
      expect(label.length).toBeLessThanOrEqual(33); // 32 + ellipsis cap
    },
  );
});
