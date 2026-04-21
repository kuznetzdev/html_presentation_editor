"use strict";

// axe-harness.js — Shared axe-core scan helper for shell-only accessibility tests.
//
// Exports runAxeScanShellOnly(page, opts) which runs axe against the editor shell
// document and explicitly excludes #previewFrame. The deck content inside the iframe
// is out of the shell a11y contract — ADR-006 scopes coverage to the shell only.
//
// Rule sets: wcag2a + wcag2aa (WCAG 2.1 Level AA)

const { AxeBuilder } = require("@axe-core/playwright");

/**
 * Run an axe-core accessibility scan on the editor shell only.
 * Excludes #previewFrame so deck content does not affect shell scan results.
 *
 * @param {import("@playwright/test").Page} page - Playwright page instance
 * @param {object} [opts] - Optional overrides
 * @param {string[]} [opts.runOnly] - axe rule sets to run (default: ["wcag2a", "wcag2aa"])
 * @returns {Promise<import("axe-core").AxeResults>} Full axe results object
 */
async function runAxeScanShellOnly(page, opts = {}) {
  const runOnly = opts.runOnly || ["wcag2a", "wcag2aa"];

  // Build the axe scan: scan full page, exclude #previewFrame (deck content is out of contract)
  const results = await new AxeBuilder({ page })
    .exclude("#previewFrame")
    .withTags(runOnly)
    .analyze();

  return results;
}

module.exports = { runAxeScanShellOnly };
