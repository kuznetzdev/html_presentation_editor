/**
 * shell-visual.spec.js — Visual regression gate (WO-32 / ADR-007 v0.32.0)
 *
 * 15 surfaces captured at 1440×900 on Windows Chromium (chromium-visual project).
 * Baselines committed to: tests/visual/__snapshots__/chromium-visual/
 *
 * Run:   npm run test:gate-visual
 * Update: npm run test:gate-visual:update
 */

"use strict";

const { test, expect } = require("@playwright/test");
const {
  disableAnimations,
  loadBasicDeck,
  openActionHint,
  openFloatingToolbar,
  openLayerPicker,
  openShellForVisual,
  selectFirstH1,
  switchTheme,
  triggerBlockBanner,
} = require("./helpers/visual-fixtures");

const SNAPSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.01,
  threshold: 0.2,
};

// ────────────────────────────────────────────────────────────────────────────
// 1. Empty shell — light
// ────────────────────────────────────────────────────────────────────────────

test("empty-light — empty shell in light theme", async ({ page }) => {
  await openShellForVisual(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("empty-light.png", SNAPSHOT_OPTIONS);
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Empty shell — dark
// ────────────────────────────────────────────────────────────────────────────

test("empty-dark — empty shell in dark theme", async ({ page }) => {
  await openShellForVisual(page);
  await switchTheme(page, "dark");
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("empty-dark.png", SNAPSHOT_OPTIONS);
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Loaded preview — light
// ────────────────────────────────────────────────────────────────────────────

test("loaded-preview-light — deck loaded in preview mode, light theme", async ({ page }) => {
  await loadBasicDeck(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("loaded-preview-light.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Loaded preview — dark
// ────────────────────────────────────────────────────────────────────────────

test("loaded-preview-dark — deck loaded in preview mode, dark theme", async ({ page }) => {
  await loadBasicDeck(page);
  await switchTheme(page, "dark");
  // After reload, re-open the deck.
  await loadBasicDeck(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("loaded-preview-dark.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. Loaded edit — light (deck loaded, edit mode, no selection)
// ────────────────────────────────────────────────────────────────────────────

test("loaded-edit-light — deck loaded in edit mode, light theme, no selection", async ({ page }) => {
  await loadBasicDeck(page);

  // Switch to edit mode without selecting anything.
  const editBtn = page.locator("#editModeBtn");
  if (await editBtn.isVisible()) {
    await editBtn.click();
  } else {
    await page.locator("#mobileEditBtn").click();
  }
  await page.waitForFunction(
    () => globalThis.eval("state.mode") === "edit",
    { timeout: 8_000 },
  );

  await disableAnimations(page);
  await expect(page).toHaveScreenshot("loaded-edit-light.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Loaded edit — dark
// ────────────────────────────────────────────────────────────────────────────

test("loaded-edit-dark — deck loaded in edit mode, dark theme, no selection", async ({ page }) => {
  // Set dark theme before loading, so it's already applied after reload.
  await openShellForVisual(page);
  await switchTheme(page, "dark");
  await loadBasicDeck(page);

  const editBtn = page.locator("#editModeBtn");
  if (await editBtn.isVisible()) {
    await editBtn.click();
  } else {
    await page.locator("#mobileEditBtn").click();
  }
  await page.waitForFunction(
    () => globalThis.eval("state.mode") === "edit",
    { timeout: 8_000 },
  );

  await disableAnimations(page);
  await expect(page).toHaveScreenshot("loaded-edit-dark.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Selected text — light
// ────────────────────────────────────────────────────────────────────────────

test("selected-text-light — h1 selected in edit mode, light theme", async ({ page }) => {
  await loadBasicDeck(page);
  await selectFirstH1(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("selected-text-light.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 8. Selected text — dark
// ────────────────────────────────────────────────────────────────────────────

test("selected-text-dark — h1 selected in edit mode, dark theme", async ({ page }) => {
  await openShellForVisual(page);
  await switchTheme(page, "dark");
  await loadBasicDeck(page);
  await selectFirstH1(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("selected-text-dark.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 9. Block banner — light
// ────────────────────────────────────────────────────────────────────────────

test("block-banner-light — block banner shown (zoom 125%), light theme", async ({ page }) => {
  await loadBasicDeck(page);
  await selectFirstH1(page);
  await triggerBlockBanner(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("block-banner-light.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 10. Block banner — dark
// ────────────────────────────────────────────────────────────────────────────

test("block-banner-dark — block banner shown (zoom 125%), dark theme", async ({ page }) => {
  await openShellForVisual(page);
  await switchTheme(page, "dark");
  await loadBasicDeck(page);
  await selectFirstH1(page);
  await triggerBlockBanner(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("block-banner-dark.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 11. Floating toolbar — light
// ────────────────────────────────────────────────────────────────────────────

test("floating-toolbar-light — floating toolbar visible after text selection, light theme", async ({ page }) => {
  await loadBasicDeck(page);
  await selectFirstH1(page);
  await openFloatingToolbar(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("floating-toolbar-light.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 12. Floating toolbar — dark
// ────────────────────────────────────────────────────────────────────────────

test("floating-toolbar-dark — floating toolbar visible after text selection, dark theme", async ({ page }) => {
  await openShellForVisual(page);
  await switchTheme(page, "dark");
  await loadBasicDeck(page);
  await selectFirstH1(page);
  await openFloatingToolbar(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("floating-toolbar-dark.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 13. Layer picker — light
// ────────────────────────────────────────────────────────────────────────────

test("layer-picker-light — layer picker popup open, light theme", async ({ page }) => {
  await loadBasicDeck(page);
  await selectFirstH1(page);
  await openLayerPicker(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("layer-picker-light.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 14. Layer picker — dark
// ────────────────────────────────────────────────────────────────────────────

test("layer-picker-dark — layer picker popup open, dark theme", async ({ page }) => {
  await openShellForVisual(page);
  await switchTheme(page, "dark");
  await loadBasicDeck(page);
  await selectFirstH1(page);
  await openLayerPicker(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("layer-picker-dark.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 15. Action hint — light only
// ────────────────────────────────────────────────────────────────────────────

test("action-hint-light — inspector guidance hint visible after first selection, light theme", async ({ page }) => {
  await loadBasicDeck(page);
  await selectFirstH1(page);
  await openActionHint(page);
  await disableAnimations(page);
  await expect(page).toHaveScreenshot("action-hint-light.png", {
    ...SNAPSHOT_OPTIONS,
    mask: [
      page.locator("#previewLifecyclePill"),
      page.locator("#saveStatePill"),
      page.locator("#diagnosticsBox"),
      page.locator("#documentMeta"),
    ],
  });
});
