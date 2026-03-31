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

  test("intermediate shell breakpoint exposes structured chrome groups @stage-f", async (
    { page },
    testInfo,
  ) => {
    test.skip(
      testInfo.project.name !== "chromium-shell-1100",
      "Intermediate shell breakpoint only.",
    );

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    await assertShellGeometry(page);
    await assertNoHorizontalOverflow(page);

    const chrome = await page.evaluate(() => {
      const describe = (id) => {
        const element = document.getElementById(id);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          id,
          text: (element.textContent || "").replace(/\s+/g, " ").trim(),
          visible:
            !element.hidden &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0,
        };
      };

      return {
        previewStatusSummary: describe("previewStatusSummary"),
        topbarCommandCluster: describe("topbarCommandCluster"),
        topbarStateCluster: describe("topbarStateCluster"),
        workspaceStateBadge: describe("workspaceStateBadge"),
      };
    });

    expect(chrome.topbarStateCluster?.visible).toBe(true);
    expect(chrome.topbarCommandCluster?.visible).toBe(true);
    expect(chrome.workspaceStateBadge?.visible).toBe(true);
    expect(chrome.workspaceStateBadge?.text.length || 0).toBeGreaterThan(4);
    expect(chrome.previewStatusSummary?.visible).toBe(true);
    expect(chrome.previewStatusSummary?.text.length || 0).toBeGreaterThan(8);
  });

  test("focused preview layout keeps chrome compact and page locked @stage-f", async (
    { page },
    testInfo,
  ) => {
    test.skip(
      testInfo.project.name !== "chromium-shell-1100",
      "Intermediate shell breakpoint only.",
    );

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    await assertShellGeometry(page);
    await assertNoHorizontalOverflow(page);

    const metrics = await page.evaluate(() => {
      const summarize = (selector) => {
        const element =
          selector.startsWith("#")
            ? document.getElementById(selector.slice(1))
            : document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          clientHeight: element.clientHeight,
          display: style.display,
          height: rect.height,
          overflowY: style.overflowY,
          scrollHeight: element.scrollHeight,
        };
      };

      return {
        documentScrollHeight: document.documentElement.scrollHeight,
        inspectorBody: summarize(".inspector-body"),
        innerHeight: window.innerHeight,
        previewNote: summarize(".preview-note"),
        previewStage: summarize("#previewStage"),
        slidesBody: summarize(".slides-panel-body"),
        slidesPanel: summarize("#slidesPanel"),
        topbar: summarize("#topbar"),
      };
    });

    expect(metrics.documentScrollHeight).toBeLessThanOrEqual(metrics.innerHeight + 2);
    expect(metrics.topbar?.height || 0).toBeLessThanOrEqual(72);
    expect(metrics.previewNote?.height || 0).toBeLessThanOrEqual(88);
    expect(metrics.previewStage?.height || 0).toBeGreaterThanOrEqual(460);
    expect(metrics.slidesPanel?.height || 0).toBeGreaterThan(320);
    expect(metrics.inspectorBody?.height || 0).toBeGreaterThan(320);
    expect(metrics.inspectorBody?.overflowY).toBe("auto");
    expect(metrics.slidesBody?.overflowY).toBe("auto");
    expect(metrics.inspectorBody?.scrollHeight || 0).toBeGreaterThan(
      metrics.inspectorBody?.clientHeight || 0,
    );
  });

  test("narrow drawers close cleanly and stay out of focus order @stage-e", async (
    { page },
    testInfo,
  ) => {
    test.skip(!/(390|640|820)/.test(testInfo.project.name), "Narrow viewport only.");

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
