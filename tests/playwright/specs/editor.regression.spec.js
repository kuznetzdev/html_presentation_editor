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
  ensureShellPanelVisible,
  getPreviewRect,
  isChromiumOnlyProject,
  loadBasicDeck,
  loadReferenceDeck,
  openExportValidationPopup,
  openInsertPalette,
  openSlideRailContextMenu,
  previewLocator,
  readSelectionUiState,
  resizeSelectionOverlay,
  selectionFrameLocator,
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
const REFERENCE_DECK_IDS = Object.freeze({
  authorMarkerContract: "v1-author-marker-contract",
  codeBlocks: "v1-code-blocks-v1",
  dataAttributes: "v1-data-attributes-editorish",
  fragments: "v1-animated-fragments",
  layoutContainers: "v1-layout-containers-v1",
  mixedMedia: "v1-mixed-media",
  semanticCss: "v1-semantic-css",
  selectionEngineV2: "v1-selection-engine-v2",
  svgHeavy: "v1-svg-heavy",
  tableAndReport: "v1-table-and-report",
  tables: "v1-tables-v1",
});

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

async function selectTableCell(page, selector, options = {}) {
  await clickPreview(page, selector, options);
  await waitForSelectedEntityKind(page, "table-cell");
}

async function loadReferenceDeckForEdit(page, caseId, options = {}) {
  return loadReferenceDeck(page, caseId, {
    ...options,
    mode: "edit",
  });
}

async function selectPreviewNodeBySelector(page, selector) {
  const nodeId = await evaluateEditor(
    page,
    `(() => {
      const frame = document.getElementById("previewFrame");
      const doc = frame?.contentDocument || null;
      return doc?.querySelector(${JSON.stringify(selector)})?.getAttribute("data-editor-node-id") || "";
    })()`,
  );
  expect(nodeId).toBeTruthy();
  await evaluateEditor(
    page,
    `(() => {
      const targetNodeId = ${JSON.stringify(nodeId)};
      const payload =
        typeof buildSelectionBridgePayload === "function"
          ? buildSelectionBridgePayload(targetNodeId, {
              focusText: false,
              selectionNodeId: targetNodeId,
            })
          : null;
      if (!payload || typeof sendToBridge !== "function") return;
      sendToBridge("select-element", payload);
    })()`,
  );
  await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(nodeId);
}

async function selectSlideRoot(page, slideIndex) {
  const slideRootTarget = previewLocator(page, "section.slide").nth(slideIndex);
  const waitForSlideRootSelection = () =>
    page.waitForFunction(
      () =>
        globalThis.eval(
          "Boolean(state.selectedNodeId) && Boolean(state.selectedFlags.isSlideRoot)",
        ),
      undefined,
      { timeout: 2_000 },
    );

  await slideRootTarget.click({ position: { x: 12, y: 12 } });
  try {
    await waitForSlideRootSelection();
  } catch (error) {
    await page.keyboard.down("Alt");
    try {
      await slideRootTarget.click({
        force: true,
        position: { x: 12, y: 12 },
      });
    } finally {
      await page.keyboard.up("Alt");
    }
    await waitForSlideRootSelection();
  }
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
    expect(ui.kindBadge).toMatch(/^Тип:\s*(Видео|video)$/i);
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

  test("unified import prefers author slide and node markers @stage-g", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only import flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.dataAttributes);

    const slideIds = JSON.parse(
      await evaluateEditor(page, "JSON.stringify(state.slides.map((slide) => slide.id))"),
    );
    expect(slideIds).toEqual(["cover", "detail"]);

    await clickPreview(page, '[data-node-id="title-1"]');
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "title-1",
    );
    await waitForSelectedEntityKind(page, "text");

    let ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("text");
    expect(ui.selectedFlags.canEditText).toBe(true);

    await clickPreview(page, '[data-node-id="chip-1"]');
    ui = await readSelectionUiState(page);
    expect(ui.selectionLeafNodeId).not.toBe("");
    expect(ui.selectionPath.map((entry) => entry.nodeId)).toContain("chip-1");

    if (testInfo.project.use?.hasTouch) {
      await ensureShellPanelVisible(page, "inspector");
    }

    await page.click('#selectionBreadcrumbs [data-selection-path-node-id="chip-1"]');
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "chip-1",
    );
    await waitForSelectedEntityKind(page, "container");

    ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("container");
    expect(ui.selectedFlags.isContainer).toBe(true);
  });

  test("unified import detects semantic slide roots with stable slide identities @stage-g", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only import flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.semanticCss);

    const slideIds = JSON.parse(
      await evaluateEditor(page, "JSON.stringify(state.slides.map((slide) => slide.id))"),
    );
    expect(slideIds).toEqual(["slide-intro", "slide-kpis", "slide-summary"]);
  });

  test("unified import classifies reference deck entities without flattening structure @stage-g", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only import flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.tableAndReport);
    await clickPreview(page, "tbody tr:first-child td:nth-child(2)");
    await waitForSelectedEntityKind(page, "table-cell");
    let ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("table-cell");
    expect(ui.selectedFlags.canEditText).toBe(true);

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.mixedMedia);
    await clickPreview(page, "pre");
    await waitForSelectedEntityKind(page, "code-block");
    ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("code-block");
    expect(ui.selectedFlags.canEditText).toBe(true);

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.svgHeavy);
    await selectPreviewNodeBySelector(page, "svg");
    await waitForSelectedEntityKind(page, "svg");
    ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("svg");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.fragments);
    await selectPreviewNodeBySelector(page, ".step.fragment.visible");
    await waitForSelectedEntityKind(page, "fragment");
    ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("fragment");
  });

  test("author node markers survive element html replacement and export @stage-h", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only author marker flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.dataAttributes);

    const serialized = await evaluateEditor(
      page,
      `(() => {
        state.htmlEditorTargetId = "title-1";
        const replacement = parseSingleRootElement(
          '<div class="text" style="left:92px;top:140px;font-size:76px;font-weight:800;line-height:1;max-width:780px;">Marker-safe replacement</div>'
        );
        saveElementHtml(replacement);
        return serializeCurrentProject();
      })()`,
    );

    expect(serialized).toContain('data-node-id="title-1"');
    expect(serialized).toContain('data-node-type="text"');
    expect(serialized).toContain('data-editable="true"');
    expect(serialized).toContain("Marker-safe replacement");
  });

  test("author slide markers survive slide html replacement and export @stage-h", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only author marker flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.dataAttributes);

    const serialized = await evaluateEditor(
      page,
      `(() => {
        state.htmlEditorTargetId = "cover";
        const replacement = parseSingleRootElement(
          '<section class="slide active" data-slide-kind="hero"><div class="text" style="left:92px;top:140px;font-size:76px;font-weight:800;line-height:1;max-width:780px;">Slide marker-safe replacement</div></section>'
        );
        saveSlideHtml(replacement);
        return serializeCurrentProject();
      })()`,
    );

    expect(serialized).toContain('data-slide-id="cover"');
    expect(serialized).toContain("Slide marker-safe replacement");
  });

  test("duplicating authored slides keeps unique author ids across export roundtrip @stage-h", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only author marker flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.dataAttributes);

    const duplicateSummary = await evaluateEditor(
      page,
      `JSON.stringify((() => {
        duplicateSlideById("cover");
        const serialized = serializeCurrentProject();
        const markerIds = Array.from(
          serialized.matchAll(/data-slide-id="([^"]+)"/g),
          (match) => match[1],
        );
        loadHtmlString(serialized, "roundtrip-duplicate.html", {
          resetHistory: true,
          mode: "edit",
        });
        return {
          markerIds,
          nodeMarkerCounts: {
            chip1: (serialized.match(/data-node-id="chip-1"/g) || []).length,
            title1: (serialized.match(/data-node-id="title-1"/g) || []).length,
          },
          roundtripSlideCount: state.slides.length,
          uniqueMarkerIds: Array.from(new Set(markerIds)),
        };
      })())`,
    );
    const parsedSummary = JSON.parse(duplicateSummary);

    expect(parsedSummary.markerIds).toHaveLength(3);
    expect(parsedSummary.uniqueMarkerIds).toHaveLength(3);
    expect(parsedSummary.uniqueMarkerIds).toContain("cover");
    expect(parsedSummary.nodeMarkerCounts.title1).toBe(1);
    expect(parsedSummary.nodeMarkerCounts.chip1).toBe(1);
    expect(parsedSummary.roundtripSlideCount).toBe(3);
  });

  test("author editable=false overrides text heuristics and survives export @stage-h", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only author marker flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.authorMarkerContract);
    await clickPreview(page, '[data-node-id="locked-title"]');
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "locked-title",
    );
    await waitForSelectedEntityKind(page, "text");

    const ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("text");
    expect(ui.selectedFlags.canEditText).toBe(false);

    const serialized = await evaluateEditor(page, "serializeCurrentProject()");
    expect(serialized).toContain('data-node-id="locked-title"');
    expect(serialized).toContain('data-editable="false"');
  });

  test("selection engine v2 prefers useful leaves through overlap-heavy targets @stage-i", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only selection flow.");
    test.skip(Boolean(testInfo.project.use?.hasTouch), "Overlap-heavy pointer selection is desktop-pointer only.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.selectionEngineV2);

    await clickPreview(page, "#hero-overlay");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "hero-title",
    );
    await waitForSelectedEntityKind(page, "text");

    let ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("text");
    expect(ui.selectedFlags.canEditText).toBe(true);
    expect(ui.manipulationTargetNodeId).toBe("hero-card");

    await clickPreview(page, "#metric-overlay-a");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "metric-label-a",
    );
    await waitForSelectedEntityKind(page, "text");

    ui = await readSelectionUiState(page);
    expect(ui.selectedEntityKind).toBe("text");
    expect(ui.selectedFlags.canEditText).toBe(true);
    expect(ui.manipulationTargetNodeId).toBe("metric-card-a");
  });

  test("selection engine v2 cycles ancestors on Alt+Click and wraps back to leaf @stage-i", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only selection flow.");
    test.skip(Boolean(testInfo.project.use?.hasTouch), "Modifier cycling is desktop-pointer only.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.selectionEngineV2);

    await clickPreview(page, "#hero-overlay");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "hero-title",
    );

    await clickPreview(page, "#hero-overlay", { modifiers: ["Alt"] });
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "hero-card",
    );
    await waitForSelectedEntityKind(page, "container");

    await clickPreview(page, "#hero-overlay", { modifiers: ["Alt"] });
    await expect.poll(() => evaluateEditor(page, "state.selectedFlags.isSlideRoot")).toBe(
      true,
    );
    await waitForSelectedEntityKind(page, "slide-root");

    await clickPreview(page, "#hero-overlay", { modifiers: ["Alt"] });
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "hero-title",
    );
    await waitForSelectedEntityKind(page, "text");
  });

  test("selection engine v2 exposes breadcrumb path and allows parent or leaf jumps @stage-i", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only selection flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.selectionEngineV2);

    await clickPreview(page, "#hero-overlay");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "hero-title",
    );

    if (testInfo.project.use?.hasTouch) {
      await ensureShellPanelVisible(page, "inspector");
    }

    let ui = await readSelectionUiState(page);
    expect(ui.selectionLeafNodeId).toBe("hero-title");
    expect(ui.selectionPath.map((entry) => entry.nodeId)).toEqual([
      "hero-title",
      "hero-card",
      "selection-v2",
    ]);

    await page.click('#selectionBreadcrumbs [data-selection-path-node-id="hero-card"]');
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "hero-card",
    );
    await waitForSelectedEntityKind(page, "container");

    await page.click('#selectionBreadcrumbs [data-selection-path-node-id="hero-title"]');
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "hero-title",
    );
    await waitForSelectedEntityKind(page, "text");
  });

  test("selection engine v2 uses parent manipulation context for drag and resize @stage-i", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only direct manipulation flow.");
    test.skip(Boolean(testInfo.project.use?.hasTouch), "Direct manipulation drag/resize is desktop-pointer only.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.selectionEngineV2);
    await closeCompactShellPanels(page);

    await clickPreview(page, "#hero-overlay");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "hero-title",
    );
    await waitForSelectedEntityKind(page, "text");

    const beforeDrag = await getPreviewRect(page, "#hero-card");
    await dragSelectionOverlay(page, 46, 24);
    const afterDrag = await getPreviewRect(page, "#hero-card");
    expect(afterDrag.left).toBeGreaterThan(beforeDrag.left + 20);
    expect(afterDrag.top).toBeGreaterThan(beforeDrag.top + 10);

    const beforeResize = await getPreviewRect(page, "#hero-card");
    await resizeSelectionOverlay(page, "se", 44, 28);
    const afterResize = await getPreviewRect(page, "#hero-card");
    expect(afterResize.width).toBeGreaterThan(beforeResize.width + 20);
    expect(afterResize.height).toBeGreaterThan(beforeResize.height + 10);
  });

  test("layout containers keep selectable flow containers on their own leaf and scope snap to parent @stage-k", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only layout container flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.layoutContainers);

    await clickPreview(page, "#flow-dropzone");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "flow-dropzone",
    );
    await waitForSelectedEntityKind(page, "container");

    const ui = await readSelectionUiState(page);
    expect(ui.selectionLeafNodeId).toBe("flow-dropzone");
    expect(ui.manipulationTargetNodeId).toBe("flow-dropzone");
    expect(ui.selectionPath.slice(0, 2).map((entry) => entry.nodeId)).toEqual([
      "flow-dropzone",
      "grid-shell",
    ]);

    const manipulationContext = await evaluateEditor(page, "state.manipulationContext");
    expect(manipulationContext?.interactionContainerKind).toBe("flow");
    expect(manipulationContext?.parentContainerNodeId).toBe("grid-shell");
    expect(manipulationContext?.snapRootNodeId).toBe("grid-shell");
    expect(manipulationContext?.snapTargets?.map((target) => target.nodeId)).not.toContain(
      "outside-floating",
    );
  });

  test("layout containers keep nested manipulation scoped to the parent container context @stage-k", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only layout container flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.layoutContainers);

    await clickPreview(page, "#position-label");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "position-label",
    );
    await waitForSelectedEntityKind(page, "text");

    const ui = await readSelectionUiState(page);
    expect(ui.manipulationTargetNodeId).toBe("position-host");

    const manipulationContext = await evaluateEditor(page, "state.manipulationContext");
    expect(manipulationContext?.interactionNodeId).toBe("position-host");
    expect(manipulationContext?.interactionUsesAncestor).toBe(true);
    expect(manipulationContext?.interactionContainerKind).toBe("positioning-root");
    expect(manipulationContext?.parentContainerNodeId).toBe("grid-shell");
    expect(manipulationContext?.snapRootNodeId).toBe("grid-shell");
    expect(manipulationContext?.snapTargets?.map((target) => target.nodeId)).not.toContain(
      "outside-floating",
    );
  });

  test("protected layout containers stay reachable through breadcrumbs and block unsafe drag operations @stage-k", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only layout container flow.");
    test.skip(Boolean(testInfo.project.use?.hasTouch), "Protected drag contract is desktop-pointer only.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.layoutContainers);

    await clickPreview(page, "#protected-title");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "protected-title",
    );
    await waitForSelectedEntityKind(page, "text");

    if (testInfo.project.use?.hasTouch) {
      await ensureShellPanelVisible(page, "inspector");
    }

    await page.click('#selectionBreadcrumbs [data-selection-path-node-id="protected-shell"]');
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "protected-shell",
    );
    await waitForSelectedEntityKind(page, "container");
    await expect.poll(() => evaluateEditor(page, "state.selectedPolicy?.kind || ''")).toBe(
      "protected-container",
    );

    const policy = await evaluateEditor(page, "state.selectedPolicy");
    expect(policy?.kind).toBe("protected-container");
    expect(policy?.canMove).toBe(false);
    expect(policy?.canResize).toBe(false);
    expect(policy?.canDelete).toBe(false);
    expect(policy?.canDuplicate).toBe(false);

    const beforeRect = await getPreviewRect(page, "#protected-shell");
    await dragSelectionOverlay(page, 64, 24);
    const afterRect = await getPreviewRect(page, "#protected-shell");
    expect(afterRect.left).toBeCloseTo(beforeRect.left, 1);
    expect(afterRect.top).toBeCloseTo(beforeRect.top, 1);
  });

  test("tables map structural nodes to table kinds and keep keyboard cell navigation inside the slide @stage-l", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only table flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.tables);

    const detectedKinds = JSON.parse(
      await evaluateEditor(
        page,
        `JSON.stringify([
          "report-table",
          "report-head",
          "report-body",
          "report-head-row",
          "header-region",
          "cell-west-q1",
        ].map((nodeId) => {
          const node = state.modelDoc?.querySelector('[data-node-id="' + nodeId + '"]');
          return {
            nodeId,
            entityKind: node?.getAttribute("data-editor-entity-kind") || "",
            editable: node?.getAttribute("data-editor-editable") || "",
          };
        }))`,
      ),
    );

    expect(detectedKinds).toEqual([
      { nodeId: "report-table", entityKind: "table", editable: "false" },
      { nodeId: "report-head", entityKind: "table", editable: "false" },
      { nodeId: "report-body", entityKind: "table", editable: "false" },
      { nodeId: "report-head-row", entityKind: "table", editable: "false" },
      { nodeId: "header-region", entityKind: "table-cell", editable: "true" },
      { nodeId: "cell-west-q1", entityKind: "table-cell", editable: "true" },
    ]);

    await selectTableCell(page, '[data-node-id="cell-west-q1"]');
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "cell-west-q1",
    );
    const activeSlideIdBefore = await evaluateEditor(page, "state.activeSlideId || ''");

    await selectionFrameLocator(page).press("Tab");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "cell-west-q2",
    );
    await waitForSelectedEntityKind(page, "table-cell");
    await expect.poll(() => evaluateEditor(page, "state.activeSlideId || ''")).toBe(
      activeSlideIdBefore,
    );

    await selectionFrameLocator(page).press("Shift+Tab");
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(
      "cell-west-q1",
    );
    await waitForSelectedEntityKind(page, "table-cell");

    const originalCellHtml = await previewLocator(page, '[data-node-id="cell-west-q1"]').evaluate(
      (element) => element.innerHTML,
    );

    await selectionFrameLocator(page).press("Enter");
    const tableCell = previewLocator(page, '[data-node-id="cell-west-q1"]');
    await expect(tableCell).toHaveAttribute("contenteditable", "true");
    await tableCell.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await tableCell.type("Line one");
    await tableCell.press("Enter");
    await tableCell.type("Line two");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("text-edit");
    await expect(tableCell).toContainText("Line one");
    await expect(tableCell).toContainText("Line two");

    await tableCell.press("Escape");
    await expect(tableCell).not.toHaveAttribute("contenteditable", "true");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");
    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="cell-west-q1"]').evaluate(
          (element) => element.innerHTML,
        ),
      )
      .toBe(originalCellHtml);
  });

  test("table structural ops use native sections and preserve mixed header body classes @stage-l", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only table flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.tables);
    await selectTableCell(page, '[data-node-id="cell-west-q1"]');

    await clickEditorControl(page, "#insertTableRowBelowBtn", { panel: "inspector" });
    await expect.poll(() =>
      previewLocator(page, '[data-node-id="report-body"] tr').count(),
    ).toBe(4);
    await waitForSelectedEntityKind(page, "table-cell");

    const afterRowInsert = JSON.parse(
      await evaluateEditor(
        page,
        `JSON.stringify({
          selectedNodeId: state.selectedNodeId || "",
          selectedKind: typeof getSelectedEntityKindForUi === "function" ? getSelectedEntityKindForUi() : "none",
          bodyClass: state.modelDoc?.querySelector('[data-node-id="report-body"]')?.className || "",
          headClass: state.modelDoc?.querySelector('[data-node-id="report-head"]')?.className || "",
          insertedRowClass: state.modelDoc?.querySelector('[data-node-id="report-body"] tr:nth-child(2)')?.className || "",
          insertedRowCellCount: state.modelDoc?.querySelector('[data-node-id="report-body"] tr:nth-child(2)')?.cells.length || 0
        })`,
      ),
    );

    expect(afterRowInsert.selectedKind).toBe("table-cell");
    expect(afterRowInsert.selectedNodeId).not.toBe("cell-west-q1");
    expect(afterRowInsert.bodyClass).toBe("summary-body striped-body");
    expect(afterRowInsert.headClass).toBe("summary-head sticky-head");
    expect(afterRowInsert.insertedRowClass).toBe("summary-row is-highlighted");
    expect(afterRowInsert.insertedRowCellCount).toBe(4);

    await clickEditorControl(page, "#insertTableColumnRightBtn", { panel: "inspector" });
    await expect.poll(() =>
      previewLocator(page, '[data-node-id="report-head"] tr:first-child > *').count(),
    ).toBe(5);
    await expect.poll(() =>
      previewLocator(page, '[data-node-id="report-body"] tr:first-child > *').count(),
    ).toBe(5);

    const afterColumnInsert = JSON.parse(
      await evaluateEditor(
        page,
        `JSON.stringify({
          bodyClass: state.modelDoc?.querySelector('[data-node-id="report-body"]')?.className || "",
          headClass: state.modelDoc?.querySelector('[data-node-id="report-head"]')?.className || "",
          headerCellClass: state.modelDoc?.querySelector('[data-node-id="report-head"] tr:first-child > *:nth-child(2)')?.className || "",
          bodyCellClass: state.modelDoc?.querySelector('[data-node-id="report-body"] tr:nth-child(1) > *:nth-child(2)')?.className || ""
        })`,
      ),
    );

    expect(afterColumnInsert.bodyClass).toBe("summary-body striped-body");
    expect(afterColumnInsert.headClass).toBe("summary-head sticky-head");
    expect(afterColumnInsert.headerCellClass).toBe("metric-column-head");
    expect(afterColumnInsert.bodyCellClass).toBe("metric-cell");

    await clickEditorControl(page, "#deleteTableColumnBtn", { panel: "inspector" });
    await expect.poll(() =>
      previewLocator(page, '[data-node-id="report-head"] tr:first-child > *').count(),
    ).toBe(4);
    await clickEditorControl(page, "#deleteTableRowBtn", { panel: "inspector" });
    await expect.poll(() =>
      previewLocator(page, '[data-node-id="report-body"] tr').count(),
    ).toBe(3);
  });

  test("table cell edits survive undo redo and export reimport roundtrip @stage-l", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only table flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.tables);

    const originalCellHtml = await previewLocator(page, '[data-node-id="cell-east-q2"]').evaluate(
      (element) => element.innerHTML,
    );

    await selectTableCell(page, '[data-node-id="cell-east-q2"]');
    await selectionFrameLocator(page).press("Enter");
    const editedCell = previewLocator(page, '[data-node-id="cell-east-q2"]');
    await editedCell.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await editedCell.type("Blocked expansion");
    await editedCell.press("Enter");
    await editedCell.type("Needs renewed security review");
    await clickPreview(page, '[data-node-id="table-kicker"]');

    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="cell-east-q2"]').evaluate(
          (element) => element.innerHTML,
        ),
      )
      .toBe("Blocked expansion<br>Needs renewed security review");

    await clickEditorControl(page, "#undoBtn");
    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="cell-east-q2"]').evaluate(
          (element) => element.innerHTML,
        ),
      )
      .toBe(originalCellHtml);

    await clickEditorControl(page, "#redoBtn");
    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="cell-east-q2"]').evaluate(
          (element) => element.innerHTML,
        ),
      )
      .toBe("Blocked expansion<br>Needs renewed security review");

    const serialized = await evaluateEditor(page, "serializeCurrentProject()");
    expect(serialized).toContain('data-node-id="cell-east-q2"');
    expect(serialized).toContain("Blocked expansion<br>Needs renewed security review");
    expect(serialized).toContain('class="summary-head sticky-head"');
    expect(serialized).toContain('class="summary-body striped-body"');

    await evaluateEditor(
      page,
      `loadHtmlString(${JSON.stringify(serialized)}, "stage-l-roundtrip", {
        mode: "edit",
        preferSlideId: "table-stage-l",
        resetHistory: true
      })`,
    );
    await page.waitForFunction(
      () =>
        globalThis.eval(
          "state.previewLifecycle === 'ready' && Boolean(state.previewReady) && state.activeSlideId === 'table-stage-l'",
        ),
      undefined,
      { timeout: 20_000 },
    );

    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="cell-east-q2"]').evaluate(
          (element) => element.innerHTML,
        ),
      )
      .toBe("Blocked expansion<br>Needs renewed security review");
    await expect(previewLocator(page, '[data-node-id="report-head"]')).toHaveClass(
      /summary-head sticky-head/,
    );
    await expect(previewLocator(page, '[data-node-id="report-body"]')).toHaveClass(
      /summary-body striped-body/,
    );
  });

  test("code blocks expose only safe text editing and preserve whitespace through roundtrip @stage-m", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only code block flow.");

    await loadReferenceDeckForEdit(page, REFERENCE_DECK_IDS.codeBlocks);

    await clickPreview(page, '[data-node-id="code-block-root"]', {
      position: { x: 40, y: 26 },
    });
    await waitForSelectedEntityKind(page, "code-block");
    await expect(page.locator("#editTextBtn")).toBeEnabled();
    await expect(page.locator("#boldBtn")).toBeDisabled();
    await expect(page.locator("#italicBtn")).toBeDisabled();
    await expect(page.locator("#underlineBtn")).toBeDisabled();

    await page.locator("#selectionFrameHitArea").click({ button: "right" });
    await expect(page.locator('#contextMenu [data-menu-action="edit-text"]')).toBeVisible();
    await expect(page.locator('#contextMenu [data-menu-action="to-h2"]')).toHaveCount(0);
    await page.locator('#contextMenu [data-menu-action="edit-text"]').click();

    const originalText = await previewLocator(page, '[data-node-id="code-block-root"]').evaluate(
      (element) => element.textContent,
    );

    const codeBlock = previewLocator(page, '[data-node-id="code-block-root"]');
    await codeBlock.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await codeBlock.type("function auditDeck() {");
    await codeBlock.press("Enter");
    await codeBlock.type("  return 'ok';");
    await codeBlock.press("Enter");
    await codeBlock.type("}");
    await clickPreview(page, '[data-node-id="code-block-kicker"]');

    const expectedText = "function auditDeck() {\n  return 'ok';\n}";
    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="code-block-root"]').evaluate(
          (element) => element.textContent,
        ),
      )
      .toBe(expectedText);
    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="code-block-root"]').evaluate(
          (element) => element.innerHTML,
        ),
      )
      .toBe("function auditDeck() {\n  return 'ok';\n}");

    await clickEditorControl(page, "#undoBtn");
    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="code-block-root"]').evaluate(
          (element) => element.textContent,
        ),
      )
      .toBe(originalText);

    await clickEditorControl(page, "#redoBtn");
    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="code-block-root"]').evaluate(
          (element) => element.textContent,
        ),
      )
      .toBe(expectedText);

    const serialized = await evaluateEditor(page, "serializeCurrentProject()");
    expect(serialized).toContain('data-node-id="code-block-root"');
    expect(serialized).toContain('class="code-shell prism-like language-js"');
    expect(serialized).toContain("function auditDeck() {");
    expect(serialized).toContain("  return 'ok';");

    await evaluateEditor(
      page,
      `loadHtmlString(${JSON.stringify(serialized)}, "stage-m-roundtrip", {
        mode: "edit",
        preferSlideId: "code-stage-m",
        resetHistory: true
      })`,
    );
    await page.waitForFunction(
      () =>
        globalThis.eval(
          "state.previewLifecycle === 'ready' && Boolean(state.previewReady) && state.activeSlideId === 'code-stage-m'",
        ),
      undefined,
      { timeout: 20_000 },
    );

    await expect
      .poll(() =>
        previewLocator(page, '[data-node-id="code-block-root"]').evaluate(
          (element) => element.textContent,
        ),
      )
      .toBe(expectedText);
    await expect(previewLocator(page, '[data-node-id="code-block-root"]')).toHaveClass(
      /code-shell prism-like language-js/,
    );
  });

  test("inline text editing enters on Enter or double click and exits to selection mode on Escape @stage-j", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only inline text flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await selectTextNode(page, "#hero-title");

    await selectionFrameLocator(page).press("Enter");
    await expect(previewLocator(page, "#hero-title")).toHaveAttribute("contenteditable", "true");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("text-edit");
    await expect.poll(() => evaluateEditor(page, "Boolean(state.selectedFlags.isTextEditing)")).toBe(
      true,
    );

    await previewLocator(page, "#hero-title").press("Escape");
    await expect(previewLocator(page, "#hero-title")).not.toHaveAttribute("contenteditable", "true");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");
    await expect.poll(() => evaluateEditor(page, "Boolean(state.selectedFlags.isTextEditing)")).toBe(
      false,
    );

    await page.locator("#selectionFrameHitArea").dblclick();
    await expect(previewLocator(page, "#hero-title")).toHaveAttribute("contenteditable", "true");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("text-edit");

    await previewLocator(page, "#hero-title").press("Escape");
    await expect(previewLocator(page, "#hero-title")).not.toHaveAttribute("contenteditable", "true");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");
  });

  test("inline text commit is plain-text safe and undo redo operate on the edit lifecycle @stage-j", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only inline text flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    const originalTitle = await previewLocator(page, "#hero-title").innerText();

    await selectTextNode(page, "#hero-title");
    await selectionFrameLocator(page).press("Enter");
    const title = previewLocator(page, "#hero-title");
    await title.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await title.type("Alpha");
    await title.press("Enter");
    await title.type("Beta");
    await clickPreview(page, "#cta-box");

    await expect.poll(() =>
      previewLocator(page, "#hero-title").evaluate((element) => element.innerHTML),
    ).toBe("Alpha<br>Beta");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");

    await clickEditorControl(page, "#undoBtn");
    await expect(previewLocator(page, "#hero-title")).toContainText(originalTitle);

    await clickEditorControl(page, "#redoBtn");
    await expect.poll(() =>
      previewLocator(page, "#hero-title").evaluate((element) => element.innerHTML),
    ).toBe("Alpha<br>Beta");
  });

  test("inline text commit strips injected html and unsafe attributes from plain text entities @stage-j", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only inline text flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await selectTextNode(page, "#hero-title");
    await selectionFrameLocator(page).press("Enter");

    await previewLocator(page, "#hero-title").evaluate((element) => {
      element.innerHTML =
        'Alpha <span onclick="alert(1)" style="color:red" data-bad="1">Beta</span>' +
        '<img src="x" onerror="alert(2)" alt="Injected">' +
        '<div data-unsafe="1"><a href="javascript:alert(3)">Gamma</a></div>';
      element.dispatchEvent(new InputEvent("input", { bubbles: true, data: null, inputType: "insertFromPaste" }));
    });
    await clickPreview(page, "#cta-box");

    await expect
      .poll(() =>
        evaluateEditor(
          page,
          `(() => {
            const node = state.modelDoc?.querySelector('[data-editor-node-id="hero-title"]');
            return node ? node.outerHTML : "";
          })()`,
        ),
      )
      .not.toBe("");

    const selectedHtml = await evaluateEditor(
      page,
      `(() => {
        const node = state.modelDoc?.querySelector('[data-editor-node-id="hero-title"]');
        return node ? node.outerHTML : "";
      })()`,
    );

    expect(selectedHtml).toContain("Alpha Beta");
    expect(selectedHtml).toContain("Gamma");
    expect(selectedHtml).toContain("<br>");
    expect(selectedHtml).not.toContain("<span");
    expect(selectedHtml).not.toContain("<img");
    expect(selectedHtml).not.toContain("<a");
    expect(selectedHtml).not.toContain("onclick=");
    expect(selectedHtml).not.toContain("onerror=");
    expect(selectedHtml).not.toContain("javascript:");
    expect(selectedHtml).not.toContain("data-bad=");
    expect(selectedHtml).not.toContain("data-unsafe=");
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
      String(window.sessionStorage.getItem("presentation-editor:autosave:v3") || "").includes(
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
    await page.evaluate(({ html, manualBaseUrl }) => {
      window.sessionStorage.setItem(
        "presentation-editor:autosave:v3",
        JSON.stringify({
          version: 3,
          savedAt: Date.now(),
          sourceLabel: "Fallback payload",
          manualBaseUrl,
          mode: "edit",
          activeSlideIndex: 2,
          html,
        }),
      );
    }, { html: projectHtml, manualBaseUrl: BASIC_MANUAL_BASE_URL });

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
