const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  assertHiddenPanelsAreInert,
  assertNoHorizontalOverflow,
  assertShellGeometry,
  gotoFreshEditor,
  loadBasicDeck,
  previewLocator,
  setMode,
} = require("../helpers/editorApp");

test.describe("Editor shell smoke @harness", () => {
  test("open html modal keeps shell stable @harness", async ({ page }) => {
    await gotoFreshEditor(page);

    await page.click("#openHtmlBtn");
    await expect(page.locator("#fileInput")).toBeAttached();
    await expect(page.locator("#assetDirectoryInput")).toBeAttached();
    await expect(page.locator("#baseUrlInput")).toBeVisible();
    await expect(page.locator("#loadFileBtn")).toBeVisible();

    await assertShellGeometry(page);
    await assertNoHorizontalOverflow(page);
  });

  test("loaded deck toggles preview edit and theme without shell drift @harness", async ({
    page,
  }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    await assertShellGeometry(page);
    await assertNoHorizontalOverflow(page);

    await setMode(page, "edit");

    const themeToggle = page.locator("#themeToggleBtn");
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await themeToggle.click();
    }

    await setMode(page, "preview");
    await expect(previewLocator(page, "#hero-title")).toContainText(
      "Stable editing baseline",
    );

    await assertShellGeometry(page);
    await assertNoHorizontalOverflow(page);
  });

  test("narrow drawers close cleanly and stay out of focus order @stage-e", async (
    { page },
    testInfo,
  ) => {
    test.skip(!/(390|640|820)/.test(testInfo.project.name), "Narrow viewport only.");
    test.skip(true, "Enable during stage E hardening.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    await page.click("#mobileSlidesBtn");
    await expect(page.locator("#panelBackdrop")).toBeVisible();
    await page.click("#panelBackdrop");
    await expect(page.locator("#panelBackdrop")).toBeHidden();

    await page.click("#mobileInspectorBtn");
    await expect(page.locator("#panelBackdrop")).toBeVisible();
    await page.click("#panelBackdrop");
    await expect(page.locator("#panelBackdrop")).toBeHidden();

    await assertHiddenPanelsAreInert(page);
    await assertNoHorizontalOverflow(page);
    await assertShellGeometry(page);
  });
});
