const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  clickPreview,
  closeCompactShellPanels,
  gotoFreshEditor,
  loadBasicDeck,
} = require("../helpers/editorApp");

const VISUAL_PROJECTS = new Set([
  "chromium-desktop",
  "chromium-mobile-390",
  "chromium-shell-1100",
  "chromium-wide-1440",
]);

test.describe("Visual shell regression @harness", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(!VISUAL_PROJECTS.has(testInfo.project.name), "Snapshot baseline is tracked only on canonical Chromium projects.");
  });

  test("empty shell baseline @harness", async ({ page }) => {
    await gotoFreshEditor(page);
    await expect(page).toHaveScreenshot("empty-shell.png", {
      mask: [page.locator("#previewLifecyclePill"), page.locator("#saveStatePill")],
    });
  });

  test("loaded shell baseline @harness", async ({ page }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });
    await expect(page).toHaveScreenshot("loaded-shell.png", {
      mask: [
        page.locator("#diagnosticsBox"),
        page.locator("#documentMeta"),
        page.locator("#previewLifecyclePill"),
        page.locator("#saveStatePill"),
      ],
    });
  });

  test("loaded shell dark theme baseline @harness", async ({ page }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });
    await page.evaluate(() => {
      globalThis.eval("setThemePreference('dark', false)");
    });
    await expect(page).toHaveScreenshot("loaded-shell-dark.png", {
      mask: [
        page.locator("#diagnosticsBox"),
        page.locator("#documentMeta"),
        page.locator("#previewLifecyclePill"),
        page.locator("#saveStatePill"),
      ],
    });
  });

  test("loaded shell context menu baseline @stage-f", async ({ page }, testInfo) => {
    test.skip(
      !new Set(["chromium-desktop", "chromium-shell-1100"]).has(testInfo.project.name),
      "Context-menu baseline is tracked on desktop-focused Chromium shells only.",
    );

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await clickPreview(page, "#hero-title");
    await closeCompactShellPanels(page);
    await page.locator("#selectionFrameHitArea").click({ button: "right" });
    await expect(page.locator("#contextMenu")).toBeVisible();

    await expect(page).toHaveScreenshot("loaded-shell-context-menu.png", {
      mask: [
        page.locator("#diagnosticsBox"),
        page.locator("#documentMeta"),
        page.locator("#previewLifecyclePill"),
        page.locator("#saveStatePill"),
      ],
    });
  });
});
