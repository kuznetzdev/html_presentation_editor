"use strict";

// contrast.spec.js — WCAG 2.1 AA design-token contrast assertions.
//
// Validates that each foreground/background token pair meets the minimum
// contrast ratio of 4.5:1 (WCAG 2.1 §1.4.3, Level AA, normal text).
//
// Both light and dark themes are asserted independently.
//
// Strategy:
//   1. Navigate to the editor shell.
//   2. Use page.evaluate to read computed CSS custom property values.
//   3. Parse the color strings with the pure-JS contrast-ratio helper.
//   4. Assert ratio >= 4.5.
//
// Any pair that currently fails WCAG AA must be marked test.fail() and
// triaged in tests/a11y/known-violations.md (WO-11 section).
//
// ADR-006: docs/ADR-006-accessibility-ci-gate.md
// PAIN-MAP: P0-14

const { test, expect } = require("@playwright/test");
const { gotoFreshEditor } = require("../playwright/helpers/editorApp");
const { parseColor, contrastRatio } = require("./helpers/contrast-ratio");

// ---------------------------------------------------------------------------
// Sentinel tests — verify the WCAG formula implementation before any token pair.
// ---------------------------------------------------------------------------

test.describe("Contrast ratio helper — sentinel checks", () => {
  test("black on white equals exactly 21.0", () => {
    const black = { r: 0, g: 0, b: 0 };
    const white = { r: 255, g: 255, b: 255 };
    const ratio = contrastRatio(black, white);
    // WCAG 2.1 defines maximum contrast as 21:1
    expect(ratio).toBeCloseTo(21.0, 1);
  });

  test("white on white equals exactly 1.0", () => {
    const white = { r: 255, g: 255, b: 255 };
    const ratio = contrastRatio(white, white);
    expect(ratio).toBeCloseTo(1.0, 5);
  });

  test("parseColor('#333') on white approximates 12.63 (within 0.05)", () => {
    const fg = parseColor("#333");
    const bg = parseColor("#fff");
    const ratio = contrastRatio(fg, bg);
    // Expected per WCAG formula: ~12.63
    expect(Math.abs(ratio - 12.63)).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read a CSS custom property's computed value from :root in the page.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} tokenName  e.g. "--shell-text"
 * @returns {Promise<string>}  e.g. "#1d1d1f"
 */
async function getToken(page, tokenName) {
  return page.evaluate((name) => {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }, tokenName);
}

/**
 * Read two tokens and return the computed contrast ratio.
 *
 * @param {import("@playwright/test").Page} page
 * @param {string} fgToken  foreground token name
 * @param {string} bgToken  background token name
 * @returns {Promise<{ ratio: number, fg: string, bg: string }>}
 */
async function measureTokenContrast(page, fgToken, bgToken) {
  const fgStr = await getToken(page, fgToken);
  const bgStr = await getToken(page, bgToken);
  const fg = parseColor(fgStr);
  const bg = parseColor(bgStr);
  const ratio = contrastRatio(fg, bg);
  return { ratio, fg: fgStr, bg: bgStr };
}

// ---------------------------------------------------------------------------
// Light theme
// Five required surface categories per ADR-006 §3:
//   (a) --shell-text on --shell-bg          (body text on shell background)
//   (b) banner text on banner panel         (success / warning / danger)
//   (c) --on-accent on --shell-accent       (topbar accent button text)
//   (d) --shell-text on --shell-panel       (inspector label on panel)
//   (e) --shell-text on --shell-panel-soft  (rail title on soft panel)
// ---------------------------------------------------------------------------

test.describe("Design-token contrast — light theme", () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await gotoFreshEditor(page);

    // Clear any stored theme preference, then force light (no-persist so it
    // does not affect other tests in the run).
    await page.evaluate(() => {
      try { window.localStorage.clear(); } catch (e) { /* ignore */ }
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      globalThis.eval('setThemePreference("light", false)');
    });

    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    if (theme !== "light") {
      throw new Error(
        `[contrast.spec] Light theme setup failed: got theme="${theme}"`,
      );
    }
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // (a) Body text on shell background
  test("light: --shell-text on --shell-bg >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-text", "--shell-bg");
    console.log(`[contrast] light | --shell-text on --shell-bg | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (c) Accent button label on accent background
  test("light: --on-accent on --shell-accent >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--on-accent", "--shell-accent");
    console.log(`[contrast] light | --on-accent on --shell-accent | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (b) Success banner text on panel
  test("light: --shell-success on --shell-panel >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-success", "--shell-panel");
    console.log(`[contrast] light | --shell-success on --shell-panel | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (b) Warning banner text on panel
  test("light: --shell-warning on --shell-panel >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-warning", "--shell-panel");
    console.log(`[contrast] light | --shell-warning on --shell-panel | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (b) Danger banner text on panel
  test("light: --shell-danger on --shell-panel >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-danger", "--shell-panel");
    console.log(`[contrast] light | --shell-danger on --shell-panel | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (d) Inspector label on elevated panel
  test("light: --shell-text on --shell-panel >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-text", "--shell-panel");
    console.log(`[contrast] light | --shell-text on --shell-panel | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (e) Rail title on soft panel background
  test("light: --shell-text on --shell-panel-soft >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-text", "--shell-panel-soft");
    console.log(`[contrast] light | --shell-text on --shell-panel-soft | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });
});

// ---------------------------------------------------------------------------
// Dark theme
// Same five surface categories, different token values.
// The dark-theme marker assertion runs first.
// ---------------------------------------------------------------------------

test.describe("Design-token contrast — dark theme", () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await gotoFreshEditor(page);

    // Force dark preference (no-persist)
    await page.evaluate(() => {
      globalThis.eval('setThemePreference("dark", false)');
    });

    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    if (theme !== "dark") {
      throw new Error(
        `[contrast.spec] Dark theme setup failed: got theme="${theme}"`,
      );
    }
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // Dark theme marker assertion — required before token-pair iteration
  test("dark theme marker: document.documentElement.dataset.theme === 'dark'", async () => {
    const theme = await page.evaluate(
      () => document.documentElement.dataset.theme,
    );
    expect(theme).toBe("dark");
  });

  // (a) Body text on shell background
  test("dark: --shell-text on --shell-bg >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-text", "--shell-bg");
    console.log(`[contrast] dark  | --shell-text on --shell-bg | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (c) Accent button label on accent background
  test("dark: --on-accent on --shell-accent >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--on-accent", "--shell-accent");
    console.log(`[contrast] dark  | --on-accent on --shell-accent | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (b) Success banner text on panel
  test("dark: --shell-success on --shell-panel >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-success", "--shell-panel");
    console.log(`[contrast] dark  | --shell-success on --shell-panel | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (b) Warning banner text on panel
  test("dark: --shell-warning on --shell-panel >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-warning", "--shell-panel");
    console.log(`[contrast] dark  | --shell-warning on --shell-panel | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (b) Danger banner text on panel
  test("dark: --shell-danger on --shell-panel >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-danger", "--shell-panel");
    console.log(`[contrast] dark  | --shell-danger on --shell-panel | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (d) Inspector label on elevated panel
  test("dark: --shell-text on --shell-panel >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-text", "--shell-panel");
    console.log(`[contrast] dark  | --shell-text on --shell-panel | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });

  // (e) Rail title on soft panel background
  test("dark: --shell-text on --shell-panel-soft >= 4.5:1", async () => {
    const { ratio, fg, bg } = await measureTokenContrast(page, "--shell-text", "--shell-panel-soft");
    console.log(`[contrast] dark  | --shell-text on --shell-panel-soft | fg=${fg} bg=${bg} ratio=${ratio.toFixed(2)}:1`);
    expect(ratio, `WCAG AA requires >= 4.5:1. Got ${ratio.toFixed(2)}:1 (fg=${fg}, bg=${bg})`).toBeGreaterThanOrEqual(4.5);
  });
});
