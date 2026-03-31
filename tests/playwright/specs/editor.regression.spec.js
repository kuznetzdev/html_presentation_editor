const path = require("path");
const { test, expect } = require("@playwright/test");
const {
  activateSlideByIndex,
  BASIC_MANUAL_BASE_URL,
  closeCompactShellPanels,
  dragSelectionOverlay,
  dragSlideRailItem,
  EXPORT_FIXTURE_ROOT,
  clickEditorControl,
  clickPreview,
  evaluateEditor,
  getPreviewRect,
  isChromiumOnlyProject,
  loadBasicDeck,
  openExportValidationPopup,
  openInsertPalette,
  openSlideRailContextMenu,
  previewLocator,
  readSelectionUiState,
  resizeSelectionOverlay,
  setMode,
  waitForSlideActivationState,
  waitForSelectedEntityKind,
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

async function selectTextNode(page, selector, options = {}) {
  await clickPreview(page, selector, options);
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

async function selectContainerNode(page, selector, options = {}) {
  const target = previewLocator(page, selector);
  const clickOptions = { ...options };
  if (!clickOptions.position) {
    const box = await target.boundingBox();
    if (box) {
      clickOptions.position = {
        x: Math.max(12, Math.round(box.width - 20)),
        y: Math.max(12, Math.round(box.height - 20)),
      };
    }
  }
  await target.click(clickOptions);
  await page.waitForFunction(
    () =>
      globalThis.eval(
        "Boolean(state.selectedNodeId) && Boolean(state.selectedFlags.isContainer)",
      ),
  );
}

async function selectVideoNode(page, selector, options = {}) {
  await clickPreview(page, selector, options);
  await page.waitForFunction(
    () =>
      globalThis.eval(
        "Boolean(state.selectedNodeId) && Boolean(state.selectedFlags.isVideo)",
      ),
  );
  await waitForSelectedEntityKind(page, "video");
}

async function selectSlideRoot(page, slideIndex) {
  await previewLocator(page, "section.slide")
    .nth(slideIndex)
    .click({ position: { x: 12, y: 12 } });
  await page.waitForFunction(
    () =>
      globalThis.eval(
        "Boolean(state.selectedNodeId) && Boolean(state.selectedFlags.isSlideRoot)",
      ),
  );
  await waitForSelectedEntityKind(page, "slide-root");
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

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    await selectTextNode(page, "#hero-title");
    await clickEditorControl(page, "#editTextBtn", { panel: "inspector" });
    const title = previewLocator(page, "#hero-title");
    await expect(title).toHaveAttribute("contenteditable", "true");
    await title.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await title.fill("Edited hero title");
    await closeCompactShellPanels(page);
    await clickPreview(page, "#cta-box");
    await expect(previewLocator(page, "#hero-title")).toContainText("Edited hero title");

    await selectImageNode(page, "#hero-image");
    await clickEditorControl(page, "#replaceImageBtn", { panel: "inspector" });
    await page.setInputFiles("#replaceImageInput", PATTERN_IMAGE_PATH);
    await expect(previewLocator(page, "#hero-image")).toHaveAttribute("alt", "pattern.svg");
    await expect(previewLocator(page, "#hero-image")).toHaveAttribute(
      "src",
      /^data:image\/svg\+xml;base64,/,
    );

    await closeCompactShellPanels(page);
    await selectContainerNode(page, "#palette-dropzone");
    await openInsertPalette(page);
    await page.click('[data-palette-action="box"]');
    await expect(previewLocator(page, 'div[style*="min-width:160px"]')).toHaveCount(1);
  });

  test("insert image video and layout via palette @stage-c", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only insertion flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await selectContainerNode(page, "#palette-dropzone");

    await openInsertPalette(page);
    await page.click('[data-palette-action="image"]');
    await page.setInputFiles("#insertImageInput", PATTERN_IMAGE_PATH);
    await expect(previewLocator(page, 'img[alt="pattern.svg"]')).toHaveCount(1);

    await openInsertPalette(page);
    await page.click('[data-palette-action="layout-two-col"]');
    await expect(previewLocator(page, "body")).toContainText("Текст левой колонки.");

    await openInsertPalette(page);
    await page.click('[data-palette-action="video"]');
    await page.fill("#videoUrlInput", "../export-asset-parity/assets/video/clip.mp4");
    await page.click("#insertVideoUrlBtn");
    await expect(previewLocator(page, "video")).toHaveCount(2);
  });

  test("native video selection resolves to canonical video entity kind @stage-c", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only selection flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await activateSlideByIndex(page, 2);
    await closeCompactShellPanels(page);

    await selectVideoNode(page, "#demo-video");

    const ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("video");
    expect(ui.kindBadge).toBe("kind: video");
    expect(ui.selectedFlags.isVideo).toBe(true);
    expect(ui.selectedFlags.isContainer).toBe(false);
    expect(ui.visibleInspectorSections).toEqual(
      expect.arrayContaining([
        "appearanceInspectorSection",
        "elementActionsSection",
        "imageSection",
      ]),
    );
    expect(ui.visibleInspectorSections).not.toContain("selectionPolicySection");
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

  test("autosave restore falls back to slide index when slide id is missing @stage-b", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only autosave flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await activateSlideByIndex(page, 2);
    const projectHtml = await evaluateEditor(page, "serializeCurrentProject()");
    await page.evaluate((html) => {
      window.localStorage.setItem(
        "presentation-editor:autosave:v3",
        JSON.stringify({
          version: 3,
          savedAt: Date.now(),
          sourceLabel: "Fallback payload",
          manualBaseUrl: "http://127.0.0.1:4173/tests/fixtures/playwright/",
          mode: "edit",
          activeSlideIndex: 2,
          html,
        }),
      );
    }, projectHtml);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#restoreBanner")).toBeVisible();
    await page.click("#restoreDraftBtn");
    await waitForSlideActivationState(page, {
      activeIndex: 2,
      count: 3,
    });
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

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await activateSlideByIndex(page, 1);
    await closeCompactShellPanels(page);

    await selectTextNode(page, "#absolute-card");
    const absoluteBefore = await getPreviewRect(page, "#absolute-card");
    await page.keyboard.press("ArrowRight");
    const absoluteAfter = await getPreviewRect(page, "#absolute-card");
    expect(absoluteAfter.left).toBeGreaterThan(absoluteBefore.left);

    await selectTextNode(page, "#nested-absolute-card");
    const nestedBefore = await getPreviewRect(page, "#nested-absolute-card");
    await page.keyboard.press("ArrowRight");
    const nestedAfter = await getPreviewRect(page, "#nested-absolute-card");
    expect(nestedAfter.left).toBeGreaterThan(nestedBefore.left);

    await selectTextNode(page, "#fixed-badge");
    const fixedBefore = await getPreviewRect(page, "#fixed-badge");
    await page.keyboard.press("ArrowRight");
    const fixedAfter = await getPreviewRect(page, "#fixed-badge");
    expect(fixedAfter.left).toBeGreaterThan(fixedBefore.left);

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await activateSlideByIndex(page, 1);
    await closeCompactShellPanels(page);

    await selectTextNode(page, "#unsafe-box", {
      position: { x: 176, y: 96 },
    });
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#diagnosticsBox")).toContainText(
      /directManipSafe=false|directManipReason=/,
    );
  });

  test("selection overlay drags and resizes safe elements directly @stage-c", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only direct manipulation flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await activateSlideByIndex(page, 1);
    await closeCompactShellPanels(page);

    await selectTextNode(page, "#absolute-card");
    const beforeDrag = await getPreviewRect(page, "#absolute-card");
    await dragSelectionOverlay(page, 48, 24);
    await expect
      .poll(() => getPreviewRect(page, "#absolute-card"))
      .toMatchObject({
        left: expect.any(Number),
        top: expect.any(Number),
      });
    const afterDrag = await getPreviewRect(page, "#absolute-card");
    expect(afterDrag.left).toBeGreaterThan(beforeDrag.left + 20);
    expect(afterDrag.top).toBeGreaterThan(beforeDrag.top + 10);

    const beforeResize = await getPreviewRect(page, "#absolute-card");
    await resizeSelectionOverlay(page, "se", 42, 28);
    const afterResize = await getPreviewRect(page, "#absolute-card");
    expect(afterResize.width).toBeGreaterThan(beforeResize.width + 20);
    expect(afterResize.height).toBeGreaterThan(beforeResize.height + 10);
  });

  test("blocked direct manipulation keeps safety gate and surfaces tooltip @stage-c", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only direct manipulation flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await activateSlideByIndex(page, 1);
    await closeCompactShellPanels(page);

    await selectTextNode(page, "#unsafe-box", {
      position: { x: 176, y: 96 },
    });
    const before = await getPreviewRect(page, "#unsafe-box");
    await dragSelectionOverlay(page, 32, 18);
    const after = await getPreviewRect(page, "#unsafe-box");
    expect(Math.abs(after.left - before.left)).toBeLessThan(2);
    expect(Math.abs(after.top - before.top)).toBeLessThan(2);
    await expect(page.locator("#selectionFrameTooltip")).toContainText(/Cannot move|overlay/i);
    await expect(page.locator("#diagnosticsBox")).toContainText(
      /directManipSafe=false|directManipReason=/,
    );
  });

  test("desktop rail drag reorder updates slide order @stage-d", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only stateful flow.");
    test.skip(/390|640|820/.test(testInfo.project.name), "Desktop-only rail drag flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    const beforeOrder = await evaluateEditor(page, "JSON.stringify(state.slideRegistryOrder)");
    await dragSlideRailItem(page, 0, 2);
    const afterOrder = await evaluateEditor(page, "JSON.stringify(state.slideRegistryOrder)");
    expect(afterOrder).not.toBe(beforeOrder);
    await waitForSlideActivationState(page, {
      activeIndex: 0,
      count: 3,
    });
  });

  test("slide context menu supports duplicate delete and move actions @stage-d", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only stateful flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    await openSlideRailContextMenu(page, 1, {
      viaKebab: /390|640|820/.test(testInfo.project.name),
    });
    await page.click('[data-menu-action="slide-duplicate"]');
    await waitForSlideActivationState(page, {
      activeIndex: 2,
      count: 4,
    });

    await openSlideRailContextMenu(page, 2, {
      viaKebab: /390|640|820/.test(testInfo.project.name),
    });
    await page.click('[data-menu-action="slide-move-top"]');
    await waitForSlideActivationState(page, {
      activeIndex: 0,
      count: 4,
    });

    await openSlideRailContextMenu(page, 0, {
      viaKebab: /390|640|820/.test(testInfo.project.name),
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.click('[data-menu-action="slide-delete"]');
    await waitForSlideActivationState(page, {
      activeIndex: 0,
      count: 3,
    });
  });

  test("compact shell closes slide drawer and routes primary surface by entity kind @stage-e", async (
    { page },
    testInfo,
  ) => {
    test.skip(!/(390|640|820)/.test(testInfo.project.name), "Compact shell only.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    await activateSlideByIndex(page, 2);
    await expect.poll(() => evaluateEditor(page, "Boolean(state.leftPanelOpen)")).toBe(false);
    await expect.poll(() => evaluateEditor(page, "Boolean(state.rightPanelOpen)")).toBe(false);
    await expect(page.locator("#panelBackdrop")).toBeHidden();

    await selectTextNode(page, "#media-heading");
    let ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("text");
    expect(ui.toolbarVisible).toBe(true);
    expect(ui.inspectorVisible).toBe(false);
    expect(ui.rightPanelOpen).toBe(false);

    await selectVideoNode(page, "#demo-video");
    ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("video");
    expect(ui.toolbarVisible).toBe(false);
    expect(ui.inspectorVisible).toBe(true);
    expect(ui.rightPanelOpen).toBe(true);
    expect(ui.backdropVisible).toBe(true);
    expect(ui.visibleInspectorSections).toEqual(
      expect.arrayContaining([
        "appearanceInspectorSection",
        "elementActionsSection",
        "imageSection",
      ]),
    );

    await closeCompactShellPanels(page);
    await selectSlideRoot(page, 2);
    ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("slide-root");
    expect(ui.inspectorVisible).toBe(true);
    expect(ui.rightPanelOpen).toBe(true);
    expect(ui.visibleInspectorSections).toContain("selectionPolicySection");
    expect(ui.visibleInspectorSections).not.toContain("imageSection");
  });
});
