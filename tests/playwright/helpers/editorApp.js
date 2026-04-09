const fs = require("fs");
const path = require("path");
const { expect } = require("@playwright/test");
const {
  getReferenceDeckCase,
} = require("./referenceDeckRegistry");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..", "..");
const TARGET_URL = "/editor/presentation-editor-v0.19.3.html";
const PLAYWRIGHT_FIXTURE_ROOT = path.join(
  WORKSPACE_ROOT,
  "tests",
  "fixtures",
  "playwright",
);
const EXPORT_FIXTURE_ROOT = path.join(
  WORKSPACE_ROOT,
  "tests",
  "fixtures",
  "export-asset-parity",
);

const BASIC_DECK_PATH = path.join(PLAYWRIGHT_FIXTURE_ROOT, "basic-deck.html");
const ASSET_PARITY_CASE_PATH = path.join(
  EXPORT_FIXTURE_ROOT,
  "asset-parity-case.html",
);
const BASIC_MANUAL_BASE_URL =
  "http://127.0.0.1:4173/tests/fixtures/playwright/";
const ASSET_MANUAL_BASE_URL =
  "http://127.0.0.1:4173/tests/fixtures/export-asset-parity/";
const SHELL_PANEL_CONFIG = Object.freeze({
  inspector: {
    buttonSelector: "#mobileInspectorBtn",
    panelSelector: "#inspectorPanel",
  },
  slides: {
    buttonSelector: "#mobileSlidesBtn",
    panelSelector: "#slidesPanel",
  },
});
const TOPBAR_OVERFLOW_CONTROL_MAP = Object.freeze({
  "#themeToggleBtn": "#topbarOverflowThemeBtn",
});

async function evaluateEditor(page, expression) {
  return page.evaluate((source) => globalThis.eval(source), expression);
}

function inferMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const mimeByExtension = {
    ".css": "text/css",
    ".gif": "image/gif",
    ".html": "text/html",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".mp4": "video/mp4",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webm": "video/webm",
  };
  return mimeByExtension[extension] || "application/octet-stream";
}

function collectFixturePayloads(rootDir) {
  const payloads = [];

  const visit = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }

      const relativePath = path
        .relative(rootDir, absolutePath)
        .split(path.sep)
        .join("/");

      payloads.push({
        base64: fs.readFileSync(absolutePath).toString("base64"),
        name: entry.name,
        relativePath,
        type: inferMimeType(absolutePath),
      });
    }
  };

  visit(rootDir);
  return payloads;
}

async function waitForPreviewReady(page) {
  try {
    await page.waitForFunction(
      () =>
        globalThis.eval(`(() => {
          const frame = document.getElementById("previewFrame");
          const frameDoc = frame?.contentDocument || null;
          return Boolean(state.modelDoc) &&
            state.previewLifecycle === "ready" &&
            Boolean(state.previewReady) &&
            Boolean(frameDoc) &&
            frameDoc.readyState === "complete";
        })()`),
      undefined,
      { timeout: 20_000 },
    );
  } catch (error) {
    const debugState = await evaluateEditor(
      page,
      `JSON.stringify({
        bridgeAlive: state.bridgeAlive ?? null,
        hasModel: Boolean(state.modelDoc),
        previewLifecycle: state.previewLifecycle || "",
        previewLifecycleReason: state.previewLifecycleReason || "",
        previewReady: Boolean(state.previewReady),
        frameSrc: document.getElementById("previewFrame")?.getAttribute("src") || "",
        documentMeta: document.getElementById("documentMeta")?.textContent || "",
        saveState: document.getElementById("saveStatePill")?.textContent || ""
      })`,
    );
    throw new Error(
      `Preview did not reach ready state: ${debugState}`,
      { cause: error },
    );
  }
}

async function gotoFreshEditor(page) {
  await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload({
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await expect(page.locator("#openHtmlBtn")).toBeVisible();
  await expect(page.locator("#restoreBanner")).toBeHidden();
}

async function openHtmlFixture(page, fixturePath, options = {}) {
  const manualBaseUrl = options.manualBaseUrl || "";

  await page.click("#openHtmlBtn");
  await expect(page.locator("#loadFileBtn")).toBeVisible();
  await page.fill("#baseUrlInput", manualBaseUrl);
  await page.setInputFiles("#fileInput", fixturePath);
  await page.click("#loadFileBtn");
  await waitForPreviewReady(page);
  await expect(page.locator("#previewFrame")).toBeVisible();
}

async function connectAssetDirectory(page, rootDir = EXPORT_FIXTURE_ROOT) {
  const payloads = collectFixturePayloads(rootDir);
  await page.evaluate(async (items) => {
    const toBytes = (base64) =>
      Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const files = items.map((item) => {
      const file = new File([toBytes(item.base64)], item.name, {
        type: item.type || "application/octet-stream",
      });
      Object.defineProperty(file, "webkitRelativePath", {
        configurable: true,
        value: item.relativePath,
      });
      return file;
    });
    await window.setAssetDirectoryFromFiles(files);
  }, payloads);
  await waitForPreviewReady(page);
}

async function loadBasicDeck(page, options = {}) {
  await gotoFreshEditor(page);
  await openHtmlFixture(page, BASIC_DECK_PATH, {
    manualBaseUrl: options.manualBaseUrl || BASIC_MANUAL_BASE_URL,
  });

  if (options.connectAssets) {
    await connectAssetDirectory(page, EXPORT_FIXTURE_ROOT);
  }

  if (options.mode) {
    await setMode(page, options.mode);
  }

  await expect(previewLocator(page, "#hero-title")).toContainText(
    "Stable editing baseline",
  );
  return BASIC_DECK_PATH;
}

async function loadReferenceDeck(page, caseId, options = {}) {
  const deckCase = getReferenceDeckCase(caseId);
  const shouldResetEditor = options.resetEditor !== false;

  if (shouldResetEditor) {
    await gotoFreshEditor(page);
  }

  await openHtmlFixture(page, deckCase.fixturePath, {
    manualBaseUrl: options.manualBaseUrl || deckCase.manualBaseUrl,
  });

  if (options.mode) {
    await setMode(page, options.mode);
  }

  return deckCase;
}

async function setMode(page, mode) {
  const desktopTarget =
    mode === "edit" ? page.locator("#editModeBtn") : page.locator("#previewModeBtn");
  const mobileTarget =
    mode === "edit" ? page.locator("#mobileEditBtn") : page.locator("#mobilePreviewBtn");
  const target = (await desktopTarget.isVisible()) ? desktopTarget : mobileTarget;
  await expect(target).toBeEnabled();
  await target.click();
  await page.waitForFunction(
    (expectedMode) => globalThis.eval("state.mode") === expectedMode,
    mode,
  );
}

function previewLocator(page, selector) {
  return page.frameLocator("#previewFrame").locator(selector);
}

async function clickPreview(page, selector, options = {}) {
  const nextOptions = { ...options };
  if (Array.isArray(nextOptions.modifiers) && nextOptions.modifiers.length) {
    nextOptions.force ??= true;
  }
  const target = previewLocator(page, selector);
  try {
    await target.click(nextOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    const pointerIntercepted = /intercepts pointer events/i.test(message);
    if (!pointerIntercepted || nextOptions.force) {
      throw error;
    }
    await target.click({
      ...nextOptions,
      force: true,
    });
  }
}

function selectionFrameLocator(page) {
  return page.locator("#selectionFrame");
}

function selectionFrameHitAreaLocator(page) {
  return page.locator("#selectionFrameHitArea");
}

function selectionHandleLocator(page, handle) {
  return page.locator(`#selectionFrame .selection-handle[data-handle="${handle}"]`);
}

async function dragSelectionOverlay(page, dx, dy) {
  const target = selectionFrameHitAreaLocator(page);
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  if (!box) {
    throw new Error("Selection frame hit area is not measurable.");
  }
  const startX = Math.round(box.x + box.width / 2);
  const startY = Math.round(box.y + box.height / 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 12 });
  await page.mouse.up();
}

async function resizeSelectionOverlay(page, handle, dx, dy) {
  const target = selectionHandleLocator(page, handle);
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  if (!box) {
    throw new Error(`Selection handle ${handle} is not measurable.`);
  }
  const startX = Math.round(box.x + box.width / 2);
  const startY = Math.round(box.y + box.height / 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 12 });
  await page.mouse.up();
}

async function getPreviewRect(page, selector) {
  return previewLocator(page, selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      width: rect.width,
    };
  });
}

async function readDiagnostics(page) {
  return page.locator("#diagnosticsBox").innerText();
}

async function assertNoHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));

  expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(
    metrics.viewportWidth + 2,
  );
}

async function assertShellGeometry(page) {
  const metrics = await page.evaluate(() => {
    const summarize = (id) => {
      const element = document.getElementById(id);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return {
        id,
        left: rect.left,
        right: rect.right,
        visible:
          !element.hidden &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0,
        width: rect.width,
      };
    };

    return {
      viewportWidth: window.innerWidth,
      inspectorPanel: summarize("inspectorPanel"),
      mobileRail: summarize("mobileCommandRail"),
      previewFrame: summarize("previewFrame"),
      slidesPanel: summarize("slidesPanel"),
      topbar: summarize("topbar"),
    };
  });

  if (metrics.topbar?.visible) {
    expect(metrics.topbar.left).toBeGreaterThanOrEqual(-2);
    expect(metrics.topbar.right).toBeLessThanOrEqual(metrics.viewportWidth + 2);
  }

  if (metrics.previewFrame?.visible) {
    expect(metrics.previewFrame.left).toBeGreaterThanOrEqual(-2);
    expect(metrics.previewFrame.right).toBeLessThanOrEqual(metrics.viewportWidth + 2);
    expect(metrics.previewFrame.width).toBeGreaterThan(220);
  }

  for (const panel of [
    metrics.mobileRail,
    metrics.slidesPanel,
    metrics.inspectorPanel,
  ]) {
    if (!panel?.visible) continue;
    expect(panel.left).toBeGreaterThanOrEqual(-2);
    expect(panel.right).toBeLessThanOrEqual(metrics.viewportWidth + 2);
  }
}

async function assertHiddenPanelsAreInert(page) {
  const offenders = await page.evaluate(() => {
    const focusSelector = [
      "a[href]",
      "area[href]",
      "button",
      "details summary",
      "iframe",
      "input",
      "select",
      "textarea",
      "[tabindex]",
      "[contenteditable='true']",
    ].join(",");

    const panels = ["slidesPanel", "inspectorPanel"].map((id) =>
      document.getElementById(id),
    );

    const isHiddenPanel = (panel) => {
      if (!panel) return false;
      const rect = panel.getBoundingClientRect();
      const style = window.getComputedStyle(panel);
      if (panel.hidden) return true;
      if (panel.getAttribute("aria-hidden") === "true") return true;
      if (panel.hasAttribute("inert")) return true;
      if (style.display === "none" || style.visibility === "hidden") return true;
      if (rect.width < 4 || rect.height < 4) return true;
      if (rect.right <= 0 || rect.left >= window.innerWidth) return true;
      return false;
    };

    const isFocusableLeak = (element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.closest("[hidden],[inert]")) return false;
      if (element.getAttribute("aria-hidden") === "true") return false;
      if ("disabled" in element && element.disabled) return false;
      if (element.tabIndex < 0) return false;
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return true;
    };

    return panels
      .filter((panel) => panel && isHiddenPanel(panel))
      .flatMap((panel) =>
        Array.from(panel.querySelectorAll(focusSelector))
          .filter(isFocusableLeak)
          .map((element) => ({
            id: element.id || "",
            panelId: panel.id,
            tabIndex: element.tabIndex,
            tagName: element.tagName.toLowerCase(),
            text: (element.textContent || "").trim().slice(0, 80),
          })),
      );
  });

  expect(offenders).toEqual([]);
}

async function ensureShellPanelVisible(page, panel) {
  const config = SHELL_PANEL_CONFIG[panel];
  if (!config) return;

  const buttonLocator = page.locator(config.buttonSelector);
  if (!(await buttonLocator.isVisible())) {
    await expect(page.locator(config.panelSelector)).toBeVisible();
    return;
  }

  const openExpression =
    panel === "slides"
      ? "Boolean(state.leftPanelOpen)"
      : "Boolean(state.rightPanelOpen)";
  const panelIsOpen = await evaluateEditor(page, openExpression);
  if (!panelIsOpen) {
    await expect(buttonLocator).toBeEnabled();
    await buttonLocator.click();
    await page.waitForFunction((expression) => globalThis.eval(expression), openExpression);
  }

  await expect(page.locator(config.panelSelector)).toBeVisible();
}

async function ensureEditorControlVisible(page, selector, options = {}) {
  const control = page.locator(selector);
  if (await control.isVisible()) return control;

  if (options.panel) {
    await ensureShellPanelVisible(page, options.panel);
  }

  if (await control.isVisible()) return control;

  const overflowSelector = TOPBAR_OVERFLOW_CONTROL_MAP[selector];
  if (overflowSelector) {
    const overflowTrigger = page.locator("#topbarOverflowBtn");
    if (await overflowTrigger.isVisible()) {
      const overflowControl = page.locator(overflowSelector);
      if (!(await overflowControl.isVisible())) {
        await expect(overflowTrigger).toBeEnabled();
        await overflowTrigger.click();
      }
      await expect(overflowControl).toBeVisible();
      return overflowControl;
    }
  }

  await expect(control).toBeVisible();
  return control;
}

async function clickEditorControl(page, selector, options = {}) {
  const control = await ensureEditorControlVisible(page, selector, options);
  await expect(control).toBeEnabled();
  await control.click();
}

async function waitForSelectedEntityKind(page, expectedKind) {
  await page.waitForFunction(
    (kind) =>
      globalThis.eval(
        "typeof getSelectedEntityKindForUi === 'function' ? getSelectedEntityKindForUi() : 'none'",
      ) === kind,
    expectedKind,
  );
}

async function readSelectionUiState(page) {
  return page.evaluate(() => {
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        !element.hidden &&
        element.getAttribute("aria-hidden") !== "true" &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const readWidth = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 ? rect.width : null;
    };

    const visibleInspectorSections = Array.from(
      document.querySelectorAll(".inspector-section"),
    )
      .filter((section) => {
        if (!(section instanceof HTMLElement)) return false;
        const rect = section.getBoundingClientRect();
        const style = window.getComputedStyle(section);
        return (
          !section.hidden &&
          section.getAttribute("aria-hidden") !== "true" &&
          !section.classList.contains("is-entity-hidden") &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      })
      .map((section) => section.id);

    return {
      activeSlideId: String(globalThis.eval("state.activeSlideId || ''")),
      backdropVisible: isVisible("#panelBackdrop"),
      contextMenuLayout: document.body.dataset.contextMenuLayout || "",
      contextMenuVisible: isVisible("#contextMenu"),
      contextMenuWidth: readWidth("#contextMenu"),
      inspectorVisible: isVisible("#inspectorPanel"),
      interactionMode: String(globalThis.eval("state.interactionMode || ''")),
      kindBadge: document.getElementById("selectedKindBadge")?.textContent?.trim() || "",
      leftPanelOpen: globalThis.eval("Boolean(state.leftPanelOpen)"),
      rightPanelOpen: globalThis.eval("Boolean(state.rightPanelOpen)"),
      selectedEntityKind: globalThis.eval(
        "typeof getSelectedEntityKindForUi === 'function' ? getSelectedEntityKindForUi() : 'none'",
      ),
      selectedFlags: JSON.parse(globalThis.eval("JSON.stringify(state.selectedFlags || {})")),
      selectionLeafNodeId: String(globalThis.eval("state.selectionLeafNodeId || ''")),
      selectionPath: Array.from(
        document.querySelectorAll("#selectionBreadcrumbs [data-selection-path-node-id]"),
      ).map((button) => ({
        current:
          button.getAttribute("aria-current") === "true" ||
          button.getAttribute("aria-pressed") === "true",
        label: button.textContent?.trim() || "",
        nodeId: button.getAttribute("data-selection-path-node-id") || "",
      })),
      selectionPolicyText:
        document.getElementById("selectionPolicyText")?.textContent?.trim() || "",
      manipulationTargetNodeId: String(
        globalThis.eval("state.manipulationContext?.interactionNodeId || state.selectedNodeId || ''"),
      ),
      toolbarVisible: isVisible("#floatingToolbar"),
      visibleInspectorSections,
    };
  });
}

async function readTopbarChromeState(page) {
  return page.evaluate(() => {
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        !element.hidden &&
        element.getAttribute("aria-hidden") !== "true" &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const readRect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
      };
    };

    return {
      commandMode: document.body.dataset.topbarCommandMode || "",
      exportVisible: isVisible("#exportBtn"),
      openVisible: isVisible("#openHtmlBtn"),
      overflowMenuVisible: isVisible("#topbarOverflowMenu"),
      overflowTriggerVisible: isVisible("#topbarOverflowBtn"),
      overflowTriggerExpanded:
        document.getElementById("topbarOverflowBtn")?.getAttribute("aria-expanded") || "",
      themeVisible: isVisible("#themeToggleBtn"),
      topbarRect: readRect("#topbar"),
      undoVisible: isVisible("#undoBtn"),
      redoVisible: isVisible("#redoBtn"),
    };
  });
}

async function readWorkflowShellState(page) {
  return page.evaluate(() => {
    const isVisible = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        !element.hidden &&
        element.getAttribute("aria-hidden") !== "true" &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const readWidthMetrics = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        width: rect.width,
      };
    };

    const stateSnapshot = globalThis.eval(`JSON.stringify({
      activeSlideId: state.activeSlideId || "",
      complexityMode: state.complexityMode || "",
      mode: state.mode || "",
      previewReady: Boolean(state.previewReady),
      selectedNodeId: state.selectedNodeId || "",
      slideCount: Array.isArray(state.slides) ? state.slides.length : 0
    })`);

    return {
      workflow: document.body.dataset.editorWorkflow || "",
      state: JSON.parse(stateSnapshot),
      controls: {
        advancedMode: isVisible("#advancedModeBtn"),
        basicMode: isVisible("#basicModeBtn"),
        editMode: isVisible("#editModeBtn") || isVisible("#mobileEditBtn"),
        editSuggested:
          document.getElementById("editModeBtn")?.classList.contains("is-suggested") ||
          isVisible("#previewPrimaryActionBtn") ||
          false,
        emptyOpen: isVisible("#emptyOpenBtn"),
        emptyPaste: isVisible("#emptyPasteBtn"),
        export: isVisible("#exportBtn"),
        insert: isVisible("#toggleInsertPaletteBtn") || isVisible("#mobileInsertBtn"),
        open: isVisible("#openHtmlBtn"),
        overflow: isVisible("#topbarOverflowBtn"),
        previewPrimaryAction: isVisible("#previewPrimaryActionBtn"),
        previewMode: isVisible("#previewModeBtn") || isVisible("#mobilePreviewBtn"),
        reload: isVisible("#reloadPreviewBtn"),
        slideTemplate: isVisible("#toggleSlideTemplateBarBtn"),
      },
      panels: {
        emptyState: isVisible("#emptyState"),
        inspector: isVisible("#inspectorPanel"),
        slides: isVisible("#slidesPanel"),
      },
      metrics: {
        advancedModeBtn: readWidthMetrics("#advancedModeBtn"),
        basicModeBtn: readWidthMetrics("#basicModeBtn"),
        inspectorPanel: readWidthMetrics("#inspectorPanel"),
        slidesPanel: readWidthMetrics("#slidesPanel"),
      },
      inspector: {
        appearance: isVisible("#appearanceInspectorSection"),
        currentElement: isVisible("#currentElementSection"),
        currentElementSummary: isVisible("#selectedElementSummaryCard"),
        currentSlide: isVisible("#currentSlideSection"),
        currentSlideEditorControls: isVisible("#currentSlideEditorControls"),
        currentSlideSummary: isVisible("#currentSlideSummaryCard"),
        diagnostics: isVisible("#diagnosticsBox"),
        elementActions: isVisible("#elementActionsSection"),
        elementTag: isVisible("#elementTagInput"),
        geometry: isVisible("#geometryInspectorSection"),
        image: isVisible("#imageSection"),
        insert: isVisible("#insertSection"),
        selectionPolicy: isVisible("#selectionPolicySection"),
        showElementHtml: isVisible("#showElementHtmlBtn"),
        showSlideHtml: isVisible("#showSlideHtmlBtn"),
        text: isVisible("#textInspectorSection"),
      },
      copy: {
        emptyState: document.getElementById("emptyState")?.textContent?.trim() || "",
        inspectorHelp:
          document.getElementById("inspectorHelp")?.textContent?.trim() || "",
        previewPrimaryAction:
          document.getElementById("previewPrimaryActionBtn")?.textContent?.trim() || "",
        previewModeLabel:
          document.getElementById("previewModeLabel")?.textContent?.trim() || "",
        previewNote:
          document.getElementById("previewNoteText")?.textContent?.trim() || "",
        selectedElementTitle:
          document.getElementById("selectedElementTitle")?.textContent?.trim() || "",
      },
    };
  });
}

async function activateSlideByIndex(page, index) {
  const targetIndex = Number(index);
  if (!Number.isInteger(targetIndex) || targetIndex < 0) {
    throw new Error(`Invalid slide index: ${index}`);
  }

  await ensureShellPanelVisible(page, "slides");
  const slideCount = Number(await evaluateEditor(page, "state.slides.length"));
  const currentActiveIndex = Number(
    await evaluateEditor(
      page,
      "state.slides.findIndex((slide) => slide.id === state.activeSlideId)",
    ),
  );

  if (currentActiveIndex === targetIndex) {
    await waitForSlideActivationState(page, {
      activeIndex: targetIndex,
      count: slideCount,
    });
    return;
  }

  let lastError = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const slideItem = page.locator(`#slidesPanel .slide-item[data-index="${targetIndex}"]`);
    try {
      await expect(slideItem).toBeVisible();
      await slideItem.scrollIntoViewIfNeeded();
      await slideItem.click({ timeout: 2_000 });
    } catch (error) {
      lastError = error;
      try {
        await slideItem.focus();
        await page.keyboard.press("Enter");
      } catch (fallbackError) {
        lastError = fallbackError;
      }
    }

    try {
      await waitForSlideActivationState(page, {
        activeIndex: targetIndex,
        count: slideCount,
      });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(100);
    }
  }

  throw lastError || new Error(`Unable to activate slide index ${targetIndex}.`);
}

async function dragSlideRailItem(page, fromIndex, toIndex) {
  const slideItem = (index) => page.locator(`#slidesPanel .slide-item[data-index="${index}"]`);
  const ensureMeasuredItem = async (index, label) => {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const locator = slideItem(index);
      try {
        await expect(locator).toBeVisible();
        await locator.scrollIntoViewIfNeeded();
        await expect(locator).toBeVisible();
        const box = await locator.boundingBox();
        if (box) {
          return { box, locator };
        }
      } catch (error) {
        if (attempt === 5) {
          throw error;
        }
      }
      await page.waitForTimeout(100);
    }
    throw new Error(`Slide rail item ${label} is not measurable.`);
  };

  await ensureShellPanelVisible(page, "slides");
  const readOrder = () => evaluateEditor(page, "JSON.stringify(state.slideRegistryOrder)");
  const beforeOrder = await readOrder();
  const dragWithHtml5 = async () => {
    const { box: sourceBox, locator: source } = await ensureMeasuredItem(fromIndex, fromIndex);
    const { box: targetBox, locator: target } = await ensureMeasuredItem(toIndex, toIndex);
    await source.dragTo(target, {
      sourcePosition: {
        x: Math.round(sourceBox.width / 2),
        y: Math.round(sourceBox.height / 2),
      },
      targetPosition: {
        x: Math.round(targetBox.width / 2),
        y: Math.max(8, Math.round(targetBox.height - 12)),
      },
    });
  };

  const dragWithMouse = async () => {
    const { box: sourceBox } = await ensureMeasuredItem(fromIndex, fromIndex);
    const { box: targetBox } = await ensureMeasuredItem(toIndex, toIndex);
    const startX = Math.round(sourceBox.x + sourceBox.width / 2);
    const startY = Math.round(sourceBox.y + sourceBox.height / 2);
    const endX = Math.round(targetBox.x + targetBox.width / 2);
    const endY = Math.round(targetBox.y + Math.max(8, Math.round(targetBox.height - 12)));
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(80);
    await page.mouse.move(Math.round((startX + endX) / 2), Math.round((startY + endY) / 2), {
      steps: 10,
    });
    await page.waitForTimeout(80);
    await page.mouse.move(endX, endY, { steps: 16 });
    await page.waitForTimeout(60);
    await page.mouse.up();
  };

  for (const strategy of [dragWithHtml5, dragWithMouse, dragWithHtml5]) {
    try {
      await strategy();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/not attached|Target closed|Element is not attached/i.test(message)) {
        throw error;
      }
    }
    if ((await readOrder()) !== beforeOrder) {
      break;
    }
    await page.waitForTimeout(100);
  }

  await expect.poll(readOrder, { timeout: 2000 }).not.toBe(beforeOrder);
}

async function openSlideRailContextMenu(page, index, options = {}) {
  await ensureShellPanelVisible(page, "slides");
  const slideItem = page.locator(`#slidesPanel .slide-item[data-index="${index}"]`);
  await expect(slideItem).toBeVisible();
  if (options.viaKebab) {
    const trigger = slideItem.locator(".slide-menu-trigger");
    await expect(trigger).toBeVisible();
    await trigger.click();
  } else {
    await slideItem.click({ button: "right" });
  }
  await expect(page.locator("#contextMenu")).toBeVisible();
}

async function closeCompactShellPanels(page) {
  const compact = await page.evaluate(() => window.innerWidth <= 1024);
  if (!compact) return;

  const hasOpenPanel = await evaluateEditor(
    page,
    "Boolean(state.leftPanelOpen || state.rightPanelOpen)",
  );
  if (!hasOpenPanel) return;

  for (const panel of ["slides", "inspector"]) {
    const config = SHELL_PANEL_CONFIG[panel];
    const button = page.locator(config.buttonSelector);
    if (!(await button.isVisible())) continue;
    const openExpression =
      panel === "slides"
        ? "Boolean(state.leftPanelOpen)"
        : "Boolean(state.rightPanelOpen)";
    if (await evaluateEditor(page, openExpression)) {
      await button.click();
    }
  }

  const stillOpen = await evaluateEditor(
    page,
    "Boolean(state.leftPanelOpen || state.rightPanelOpen)",
  );
  if (stillOpen) {
    const backdrop = page.locator("#panelBackdrop");
    if (await backdrop.isVisible()) {
      await backdrop.click({ position: { x: 4, y: 4 }, force: true });
    }
  }

  await page.waitForFunction(
    () => !globalThis.eval("state.leftPanelOpen || state.rightPanelOpen"),
  );
}

async function waitForSlideActivationState(page, options) {
  const payload = {
    activeIndex:
      typeof options?.activeIndex === "number" ? options.activeIndex : null,
    count: Number(options?.count),
  };

  const snapshotExpression = `JSON.stringify({
    activeCount: state.slides.filter((slide) => slide.isActive).length,
    activeIndex: state.slides.findIndex((slide) => slide.isActive),
    activeSlideId: state.activeSlideId || null,
    count: state.slides.length,
    hasPendingRequest: Boolean(state.requestedSlideActivation),
    historyIndex: state.historyIndex,
    historyLength: state.history.length,
    previewLifecycle: state.previewLifecycle || "",
    previewReady: Boolean(state.previewReady),
    requestedSlideActivation: state.requestedSlideActivation || null,
    runtimeActiveSlideId: state.runtimeActiveSlideId || null,
    undoDisabled: document.getElementById("undoBtn")?.disabled ?? null,
    redoDisabled: document.getElementById("redoBtn")?.disabled ?? null
  })`;
  try {
    await page.waitForFunction(
      ({ expected, expression }) => {
        const snapshot = JSON.parse(globalThis.eval(expression));
        if (snapshot.count !== expected.count) return false;
        if (!snapshot.previewReady || snapshot.previewLifecycle !== "ready") {
          return false;
        }
        if (snapshot.hasPendingRequest) return false;
        if (snapshot.activeCount !== 1) return false;
        if (snapshot.activeSlideId !== snapshot.runtimeActiveSlideId) {
          return false;
        }
        if (
          typeof expected.activeIndex === "number" &&
          snapshot.activeIndex !== expected.activeIndex
        ) {
          return false;
        }
        return true;
      },
      { expected: payload, expression: snapshotExpression },
      { timeout: 20_000 },
    );
  } catch (error) {
    const snapshot = await evaluateEditor(page, snapshotExpression);
    throw new Error(
      `Slide activation wait failed: expected=${JSON.stringify(payload)} actual=${snapshot}`,
      { cause: error },
    );
  }
}

async function openExportValidationPopup(page) {
  const openFromCurrentState = async (trigger) => {
    const popupPromise = page
      .waitForEvent("popup", { timeout: 4_000 })
      .catch(() => null);
    await trigger();

    let popup = await popupPromise;
    if (!popup) {
      const fallbackUrl = await evaluateEditor(
        page,
        `state.lastExportValidationUrl || ""`,
      );
      if (!fallbackUrl) {
        throw new Error("Validation popup did not open and no fallback URL was stored.");
      }
      popup = await page.context().newPage();
      await popup.goto(fallbackUrl, { waitUntil: "domcontentloaded" });
    } else {
      await popup.waitForLoadState("domcontentloaded");
    }

    return popup;
  };

  const validateExportBtn = page.locator("#validateExportBtn");
  if (await validateExportBtn.isVisible()) {
    await expect(validateExportBtn).toBeEnabled();
    return openFromCurrentState(() => validateExportBtn.click());
  }

  const exportBtn = page.locator("#exportBtn");
  await expect(exportBtn).toBeVisible();
  await expect(exportBtn).toBeEnabled();
  await exportBtn.click();
  const toastActionBtn = page.locator(".toast-action-btn", {
    hasText: "Открыть проверку",
  });
  await expect(toastActionBtn).toBeVisible();
  return openFromCurrentState(() => toastActionBtn.click());
}

function isChromiumOnlyProject(projectName) {
  return String(projectName || "").startsWith("chromium");
}

async function openInsertPalette(page) {
  const desktopToggle = page.locator("#toggleInsertPaletteBtn");
  if (await desktopToggle.isVisible()) {
    await clickEditorControl(page, "#toggleInsertPaletteBtn");
    return;
  }

  const mobileToggle = page.locator("#mobileInsertBtn");
  await expect(mobileToggle).toBeVisible();
  await expect(mobileToggle).toBeEnabled();
  await mobileToggle.click();
}

module.exports = {
  ASSET_MANUAL_BASE_URL,
  ASSET_PARITY_CASE_PATH,
  BASIC_DECK_PATH,
  BASIC_MANUAL_BASE_URL,
  EXPORT_FIXTURE_ROOT,
  TARGET_URL,
  activateSlideByIndex,
  assertHiddenPanelsAreInert,
  assertNoHorizontalOverflow,
  assertShellGeometry,
  clickEditorControl,
  clickPreview,
  closeCompactShellPanels,
  collectFixturePayloads,
  connectAssetDirectory,
  dragSelectionOverlay,
  dragSlideRailItem,
  ensureEditorControlVisible,
  ensureShellPanelVisible,
  evaluateEditor,
  getPreviewRect,
  gotoFreshEditor,
  isChromiumOnlyProject,
  loadBasicDeck,
  loadReferenceDeck,
  openExportValidationPopup,
  openInsertPalette,
  openHtmlFixture,
  previewLocator,
  readSelectionUiState,
  readWorkflowShellState,
  readDiagnostics,
  resizeSelectionOverlay,
  selectionFrameLocator,
  selectionHandleLocator,
  setMode,
  openSlideRailContextMenu,
  waitForSlideActivationState,
  waitForSelectedEntityKind,
  waitForPreviewReady,
  readTopbarChromeState,
};
