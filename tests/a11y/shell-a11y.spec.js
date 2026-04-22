"use strict";

// shell-a11y.spec.js — axe-core WCAG 2.1 AA accessibility gate for the editor shell.
//
// Scope: shell document only. #previewFrame is excluded from every scan.
// Deck content (HTML presentation) is outside the a11y contract for this gate.
//
// Three workflow states tested (data-editor-workflow attribute values):
//   "empty"          — editor loaded, no deck open
//   "loaded-preview" — deck loaded in preview mode
//   "loaded-edit"    — deck loaded in edit mode
//
// Current status: test.fail() is active for all three states due to known violations.
// See tests/a11y/known-violations.md for full triage details.
//
// Known violations (to be fixed by WO-10):
//   - color-contrast: #8a8a8e on #ffffff = 3.43:1 (need 4.5:1) — all states
//   - nested-interactive: slide-item role=button contains focusable descendants — loaded-* states
//
// ADR-006: docs/ADR-006-accessibility-ci-gate.md

const { test, expect } = require("@playwright/test");
const {
  BASIC_DECK_PATH,
  BASIC_MANUAL_BASE_URL,
  gotoFreshEditor,
  openHtmlFixture,
  setMode,
} = require("../playwright/helpers/editorApp");
const { runAxeScanShellOnly } = require("./helpers/axe-harness");

// ---------------------------------------------------------------------------
// Helper: wait for the data-editor-workflow attribute to reach a given value.
// ---------------------------------------------------------------------------
async function waitForWorkflowState(page, expectedState) {
  await page.waitForFunction(
    (state) => document.body.dataset.editorWorkflow === state,
    expectedState,
    { timeout: 15_000 },
  );
}

// ---------------------------------------------------------------------------
// State 1: "empty" — editor just loaded, no deck open
// ---------------------------------------------------------------------------
test("shell passes WCAG 2.1 AA axe scan in workflow state: empty", async ({ page }) => {
  // NOTE: color-contrast violation (#previewModeLabel, #zoomLevelLabel) does not affect
  // the empty state — those elements are hidden until a deck is loaded.
  // test.fail() marker removed at v0.31.2 (WO-25 fixed empty-state UX, confirmed 0 violations).

  await gotoFreshEditor(page);
  await waitForWorkflowState(page, "empty");

  const workflow = await page.evaluate(() => document.body.dataset.editorWorkflow);
  expect(workflow).toBe("empty");

  const results = await runAxeScanShellOnly(page);

  if (results.violations.length > 0) {
    console.log(
      `[a11y] state=empty — ${results.violations.length} violation(s):\n` +
        results.violations
          .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
          .join("\n"),
    );
  }

  expect(
    results.violations,
    `axe found ${results.violations.length} violation(s) in state=empty. ` +
      "See tests/a11y/known-violations.md for triage.",
  ).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// State 2: "loaded-preview" — deck loaded in preview mode
// ---------------------------------------------------------------------------
test("shell passes WCAG 2.1 AA axe scan in workflow state: loaded-preview", async ({ page }) => {
  // TODO(WO-10): two known violations:
  //   1. color-contrast — #8a8a8e on #ffffff = 3.43:1 (needs 4.5:1). Fix: darken --color-secondary.
  //   2. nested-interactive — slide-item role=button contains focusable descendants.
  //      Fix: restructure slide rail so outer container is role=listitem, inner is <button>.
  // See: tests/a11y/known-violations.md
  test.fail(
    true,
    "Known violations: color-contrast + nested-interactive (slide rail). Fix tracked in WO-10.",
  );

  await gotoFreshEditor(page);
  await openHtmlFixture(page, BASIC_DECK_PATH, {
    manualBaseUrl: BASIC_MANUAL_BASE_URL,
  });
  await waitForWorkflowState(page, "loaded-preview");

  const workflow = await page.evaluate(() => document.body.dataset.editorWorkflow);
  expect(workflow).toBe("loaded-preview");

  const results = await runAxeScanShellOnly(page);

  if (results.violations.length > 0) {
    console.log(
      `[a11y] state=loaded-preview — ${results.violations.length} violation(s):\n` +
        results.violations
          .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
          .join("\n"),
    );
  }

  expect(
    results.violations,
    `axe found ${results.violations.length} violation(s) in state=loaded-preview. ` +
      "See tests/a11y/known-violations.md for triage.",
  ).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// State 3: "loaded-edit" — deck loaded and in edit mode
// ---------------------------------------------------------------------------
test("shell passes WCAG 2.1 AA axe scan in workflow state: loaded-edit", async ({ page }) => {
  // TODO(WO-10): two known violations:
  //   1. color-contrast — #8a8a8e on #ffffff = 3.43:1 (needs 4.5:1). Fix: darken --color-secondary.
  //   2. nested-interactive — slide-item role=button contains focusable descendants.
  //      Fix: restructure slide rail so outer container is role=listitem, inner is <button>.
  // See: tests/a11y/known-violations.md
  test.fail(
    true,
    "Known violations: color-contrast + nested-interactive (slide rail). Fix tracked in WO-10.",
  );

  await gotoFreshEditor(page);
  await openHtmlFixture(page, BASIC_DECK_PATH, {
    manualBaseUrl: BASIC_MANUAL_BASE_URL,
  });
  await setMode(page, "edit");
  await waitForWorkflowState(page, "loaded-edit");

  const workflow = await page.evaluate(() => document.body.dataset.editorWorkflow);
  expect(workflow).toBe("loaded-edit");

  const results = await runAxeScanShellOnly(page);

  if (results.violations.length > 0) {
    console.log(
      `[a11y] state=loaded-edit — ${results.violations.length} violation(s):\n` +
        results.violations
          .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
          .join("\n"),
    );
  }

  expect(
    results.violations,
    `axe found ${results.violations.length} violation(s) in state=loaded-edit. ` +
      "See tests/a11y/known-violations.md for triage.",
  ).toHaveLength(0);
});
