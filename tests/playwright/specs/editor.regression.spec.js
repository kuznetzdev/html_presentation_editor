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

async function forceLightTheme(page) {
  await evaluateEditor(page, "setThemePreference('light', false)");
  await expect.poll(() => page.locator("body").getAttribute("data-theme")).toBe("light");
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
    const activeSlideIdBefore = await evaluateEditor(page, "state.activeSlideId");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("text-edit");
    await title.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await title.type("Edited hero");
    await title.press("Space");
    await title.type("title");
    await title.press("End");
    await title.press("Enter");
    await title.type("focus stays here");
    await title.press("ArrowLeft");
    await title.press("Backspace");
    await title.type("e");
    await expect(previewLocator(page, "#hero-title")).toContainText("Edited hero title");
    await expect(previewLocator(page, "#hero-title")).toContainText("focus stays he");
    await expect.poll(() => evaluateEditor(page, "state.activeSlideId")).toBe(activeSlideIdBefore);
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("text-edit");
    await expect(title).toHaveAttribute("contenteditable", "true");
    await closeCompactShellPanels(page);
    await clickPreview(page, "#cta-box");
    await expect(previewLocator(page, "#hero-title")).toContainText("Edited hero title");
    await expect(previewLocator(page, "#hero-title")).toContainText("focus stays he");

    await selectImageNode(page, "#hero-image");
    await expect(page.locator("#editTextBtn")).toBeDisabled();
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
    await expect(page.locator("#selectionPolicyText")).toContainText(/инспектор/i);
    await expect(page.locator("#leftInput")).toBeEnabled();
    await expect(page.locator("#topInput")).toBeEnabled();
  });

  test("selection editability stays honest and context menu stays compact @stage-c @stage-d @stage-e", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only shell flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    await selectImageNode(page, "#hero-image");
    let ui = await readSelectionUiState(page);
    expect(ui.selectedFlags.canEditText).toBe(false);
    await expect(page.locator("#editTextBtn")).toBeDisabled();

    await selectTextNode(page, "#hero-title");
    await closeCompactShellPanels(page);
    await page.locator("#selectionFrameHitArea").click({ button: "right" });
    await expect(page.locator("#contextMenu")).toBeVisible();

    ui = await readSelectionUiState(page);
    expect(ui.contextMenuVisible).toBe(true);
    expect(ui.toolbarVisible).toBe(false);
    expect(ui.contextMenuWidth).not.toBeNull();
    expect(ui.contextMenuWidth).toBeLessThanOrEqual(360);
    expect(ui.contextMenuLayout === "sheet" || ui.contextMenuLayout === "floating").toBe(true);

    await page.mouse.click(12, 12);
    await expect(page.locator("#contextMenu")).toBeHidden();

    ui = await readSelectionUiState(page);
    expect(ui.contextMenuVisible).toBe(false);
    expect(ui.toolbarVisible).toBe(true);
  });

  test("desktop rail drag reorder updates slide order @stage-d", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only stateful flow.");
    test.skip(/390|640|820|1100/.test(testInfo.project.name), "Desktop-only rail drag flow.");

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

  test("desktop shell applies ios-gamma visual contract without changing actions @stage-d", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only shell flow.");
    test.skip(/390|640|820/.test(testInfo.project.name), "Desktop-only shell contract.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await forceLightTheme(page);

    const expectColorClose = (value, expected, alphaFloor = 0.95, tolerance = 5) => {
      expect(typeof value).toBe("string");
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
      expect(channels.length).toBeGreaterThanOrEqual(3);
      expected.forEach((channel, index) => {
        expect(Math.abs((channels[index] ?? NaN) - channel)).toBeLessThanOrEqual(tolerance);
      });
      if (channels.length >= 4) {
        expect(channels[3]).toBeGreaterThanOrEqual(alphaFloor);
      }
    };

    const shellState = await page.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const style = window.getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
          color: style.color,
          fontSize: style.fontSize,
          minHeight: style.minHeight,
          position: style.position,
        };
      };

      return {
        topbar: read("#topbar"),
        activeModeButton: read("#editModeBtn.is-active"),
        stateCluster: read("#topbarStateCluster"),
        activeSlide: read("#slidesPanel .slide-item.is-active .slide-item-main"),
      };
    });

    expect(shellState.topbar?.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(shellState.topbar?.minHeight).toBe("52px");
    expectColorClose(shellState.activeModeButton?.color, [0, 113, 227], 0.95, 12);
    expectColorClose(shellState.activeModeButton?.backgroundColor, [255, 255, 255], 0.88);
    expect(shellState.stateCluster?.borderRadius).toBe("12px");
    expectColorClose(shellState.activeSlide?.borderColor, [0, 113, 227], 0.9);
    expectColorClose(shellState.activeSlide?.backgroundColor, [255, 255, 255], 0.95);

    await openSlideRailContextMenu(page, 1);
    const contextMenu = await page.evaluate(() => {
      const menu = document.getElementById("contextMenu");
      const item = menu?.querySelector("button");
      if (!(menu instanceof HTMLElement) || !(item instanceof HTMLElement)) return null;
      const menuStyle = window.getComputedStyle(menu);
      const itemStyle = window.getComputedStyle(item);
      return {
        menuBackground: menuStyle.backgroundColor,
        menuRadius: menuStyle.borderRadius,
        itemMinHeight: itemStyle.minHeight,
      };
    });

    expect(contextMenu?.menuBackground).toBe("rgb(255, 255, 255)");
    expect(contextMenu?.menuRadius).toBe("12px");
    expect(contextMenu?.itemMinHeight).toBe("32px");
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

  test("compact toolbar stays docked and reduced motion disables shell transitions @stage-e", async (
    { page },
    testInfo,
  ) => {
    test.skip(!/(390|640|820)/.test(testInfo.project.name), "Compact shell only.");

    await page.emulateMedia({ reducedMotion: "reduce" });
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await forceLightTheme(page);
    await activateSlideByIndex(page, 2);
    await closeCompactShellPanels(page);
    await selectTextNode(page, "#media-heading");

    const compactState = await page.evaluate(() => {
      const toolbar = document.getElementById("floatingToolbar");
      const menu = document.getElementById("contextMenu");
      if (!(toolbar instanceof HTMLElement) || !(menu instanceof HTMLElement)) return null;
      const toolbarStyle = window.getComputedStyle(toolbar);
      const menuStyle = window.getComputedStyle(menu);
      return {
        toolbarPosition: toolbarStyle.position,
        toolbarLeft: toolbarStyle.left,
        toolbarRight: toolbarStyle.right,
        toolbarTransition: toolbarStyle.transitionDuration,
        menuTransition: menuStyle.transitionDuration,
      };
    });

    expect(compactState?.toolbarPosition).toBe("fixed");
    expect(compactState?.toolbarLeft).toBe("8px");
    expect(compactState?.toolbarRight).toBe("8px");
    expect(compactState?.toolbarTransition).toBe("0s");
    expect(compactState?.menuTransition).toBe("0s");
  });
});
