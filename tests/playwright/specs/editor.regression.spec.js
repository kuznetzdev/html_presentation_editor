const path = require("path");
const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  closeCompactShellPanels,
  EXPORT_FIXTURE_ROOT,
  clickEditorControl,
  clickPreview,
  evaluateEditor,
  getPreviewRect,
  isChromiumOnlyProject,
  loadBasicDeck,
  openExportValidationPopup,
  previewLocator,
  setMode,
  waitForSlideActivationState,
} = require("../helpers/editorApp");

const PATTERN_IMAGE_PATH = path.join(
  EXPORT_FIXTURE_ROOT,
  "assets",
  "images",
  "pattern.svg",
);

async function slideCount(page) {
  return evaluateEditor(page, "state.slides.length");
}

async function selectTextNode(page, selector) {
  await clickPreview(page, selector);
  await page.waitForFunction(
    () =>
      globalThis.eval(
        "Boolean(state.selectedNodeId) && Boolean(state.selectedFlags.canEditText)",
      ),
  );
}

async function selectImageNode(page, selector) {
  await clickPreview(page, selector);
  await page.waitForFunction(
    () =>
      globalThis.eval(
        "Boolean(state.selectedNodeId) && Boolean(state.selectedFlags.isImage)",
      ),
  );
}

async function selectContainerNode(page, selector) {
  await clickPreview(page, selector);
  await page.waitForFunction(
    () =>
      globalThis.eval(
        "Boolean(state.selectedNodeId) && Boolean(state.selectedFlags.isContainer)",
      ),
  );
}

test.describe("Editor regression coverage", () => {
  test("create duplicate delete and undo/redo keep slide activation deterministic @stage-b", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only stateful flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    const initialCount = await slideCount(page);
    const initialActiveIndex = await evaluateEditor(
      page,
      "state.slides.findIndex((slide) => slide.isActive)",
    );

    await clickEditorControl(page, "#toggleSlideTemplateBarBtn", { panel: "slides" });
    await clickEditorControl(page, '[data-slide-template="title"]', {
      panel: "slides",
    });
    await waitForSlideActivationState(page, {
      activeIndex: initialActiveIndex + 1,
      count: initialCount + 1,
    });

    await clickEditorControl(page, "#duplicateCurrentSlideBtn", {
      panel: "inspector",
    });
    await waitForSlideActivationState(page, {
      activeIndex: initialActiveIndex + 2,
      count: initialCount + 2,
    });

    page.once("dialog", (dialog) => dialog.accept());
    await clickEditorControl(page, "#deleteCurrentSlideBtn", {
      panel: "inspector",
    });
    await waitForSlideActivationState(page, {
      activeIndex: initialActiveIndex + 2,
      count: initialCount + 1,
    });

    await clickEditorControl(page, "#undoBtn");
    await waitForSlideActivationState(page, {
      activeIndex: initialActiveIndex + 2,
      count: initialCount + 2,
    });
    await expect.poll(() => evaluateEditor(page, "state.mode")).toBe("edit");

    await clickEditorControl(page, "#redoBtn");
    await waitForSlideActivationState(page, {
      activeIndex: initialActiveIndex + 2,
      count: initialCount + 1,
    });
    await expect.poll(() => evaluateEditor(page, "state.mode")).toBe("edit");
  });

  test("text edit, image replace, and block insertion stay functional @stage-c", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only editing flow.");
    test.skip(true, "Enable during stage C hardening.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    await selectTextNode(page, "#hero-title");
    await page.click("#editTextBtn");
    const title = previewLocator(page, "#hero-title");
    await expect(title).toHaveAttribute("contenteditable", "true");
    await title.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await title.fill("Edited hero title");
    await clickPreview(page, "#cta-box");
    await expect(previewLocator(page, "#hero-title")).toContainText("Edited hero title");

    await selectImageNode(page, "#hero-image");
    await page.fill("#imageSrcInput", "../export-asset-parity/assets/images/pattern.svg");
    await page.click("#applyImageSrcBtn");
    await expect(previewLocator(page, "#hero-image")).toHaveAttribute(/src/, /pattern\.svg/);

    await selectContainerNode(page, "#cta-box");
    await page.click("#toggleInsertPaletteBtn");
    await page.click('[data-palette-action="box"]');
    await expect(previewLocator(page, 'div[style*="min-width:160px"]')).toHaveCount(1);
  });

  test("insert image video and layout via palette @stage-c", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only insertion flow.");
    test.skip(true, "Enable during stage C hardening.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await selectContainerNode(page, "#cta-box");

    await page.click("#toggleInsertPaletteBtn");
    await page.click('[data-palette-action="image"]');
    await page.setInputFiles("#insertImageInput", PATTERN_IMAGE_PATH);
    await expect(previewLocator(page, 'img[alt="pattern.svg"]')).toHaveCount(1);

    await page.click("#toggleInsertPaletteBtn");
    await page.click('[data-palette-action="layout-two-col"]');
    await expect(previewLocator(page, "body")).toContainText("Текст левой колонки.");

    await page.click("#toggleInsertPaletteBtn");
    await page.click('[data-palette-action="video"]');
    await page.fill("#videoUrlInput", "../export-asset-parity/assets/video/clip.mp4");
    await page.click("#insertVideoUrlBtn");
    await expect(previewLocator(page, "video")).toHaveCount(2);
  });

  test("autosave recovery restores the last draft @stage-b", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only autosave flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await selectTextNode(page, "#hero-copy");
    await clickEditorControl(page, "#editTextBtn", { panel: "inspector" });
    const copy = previewLocator(page, "#hero-copy");
    await copy.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await copy.fill("Autosave recovery text");
    await closeCompactShellPanels(page);
    await clickPreview(page, "#cta-box");

    await page.waitForFunction(() =>
      String(window.localStorage.getItem("presentation-editor:autosave:v3") || "").includes(
        "Autosave recovery text",
      ),
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#restoreBanner")).toBeVisible();
    await page.click("#restoreDraftBtn");
    await expect(previewLocator(page, "#hero-copy")).toContainText(
      "Autosave recovery text",
    );
    await expect.poll(() => evaluateEditor(page, "state.mode")).toBe("edit");
  });

  test("export validation popup strips editor chrome @stage-a", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only export contract.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "preview" });
    const popup = await openExportValidationPopup(page);

    await expect(popup.locator("#selectionOverlay")).toHaveCount(0);
    await expect(popup.locator('[data-editor-selected="true"]')).toHaveCount(0);
    await expect(popup.locator("#__presentation_editor_bridge__")).toHaveCount(0);
    await popup.close();
  });

  test("keyboard nudge changes safe nodes and blocks unsafe contexts @stage-c", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only direct manipulation flow.");
    test.skip(true, "Enable during stage C hardening.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    await selectContainerNode(page, "#absolute-card");
    const before = await getPreviewRect(page, "#absolute-card");
    await page.keyboard.press("ArrowRight");
    const after = await getPreviewRect(page, "#absolute-card");
    expect(after.left).toBeGreaterThan(before.left);

    await selectContainerNode(page, "#unsafe-box");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#diagnosticsBox")).toContainText(/directManipSafe=false|directManipReason=/);
  });
});
