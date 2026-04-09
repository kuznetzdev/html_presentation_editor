const { test, expect } = require("@playwright/test");
const {
  BASIC_DECK_PATH,
  BASIC_MANUAL_BASE_URL,
  assertHiddenPanelsAreInert,
  assertNoHorizontalOverflow,
  assertShellGeometry,
  clickEditorControl,
  clickPreview,
  closeCompactShellPanels,
  ensureShellPanelVisible,
  evaluateEditor,
  gotoFreshEditor,
  loadBasicDeck,
  openExportValidationPopup,
  openHtmlFixture,
  previewLocator,
  readTopbarChromeState,
  readSelectionUiState,
  readWorkflowShellState,
  setMode,
  waitForSlideActivationState,
} = require("../helpers/editorApp");

async function ensureInspectorSurfaceForAssertions(page) {
  await ensureShellPanelVisible(page, "inspector");
}

async function readViewportWidth(page) {
  return page.evaluate(() => window.innerWidth);
}

test.describe("Editor shell smoke @harness", () => {
  test("root launchpad routes first-time user to the active editor runtime @harness", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "HTML Presentation Editor" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Editor" }),
    ).toHaveAttribute("href", "/editor/presentation-editor-v0.19.2.html");

    await page.getByRole("link", { name: "Open Editor" }).click();
    await expect(page.locator("#openHtmlBtn")).toBeVisible();
  });

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
    await clickEditorControl(page, "#themeToggleBtn");
    await clickEditorControl(page, "#themeToggleBtn");

    await setMode(page, "preview");
    await expect(previewLocator(page, "#hero-title")).toContainText(
      "Stable editing baseline",
    );

    await assertShellGeometry(page);
    await assertNoHorizontalOverflow(page);
  });

  test("theme switching updates elevated shell surfaces @stage-f", async ({
    page,
  }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    const captureTheme = async (theme) => {
      await page.evaluate((nextTheme) => {
        globalThis.eval(`setThemePreference(${JSON.stringify(nextTheme)}, false)`);
      }, theme);
      await page.waitForTimeout(150);

      return page.evaluate(() => {
        const read = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const style = window.getComputedStyle(element);
          return {
            backgroundColor: style.backgroundColor,
            boxShadow: style.boxShadow,
          };
        };

        return {
          cluster: read("#topbarStateCluster"),
          stage: read("#previewStage"),
        };
      });
    };

    const light = await captureTheme("light");
    const dark = await captureTheme("dark");

    expect(light.stage?.backgroundColor).not.toBe(dark.stage?.backgroundColor);
    expect(light.stage?.boxShadow).not.toBe(dark.stage?.boxShadow);
    expect(light.cluster).not.toBeNull();
    expect(dark.cluster).not.toBeNull();
  });

  test("theme switching preserves editing affordances and transient surface routing @stage-f", async ({
    page,
  }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    await clickPreview(page, "#hero-title");
    await clickEditorControl(page, "#editTextBtn", { panel: "inspector" });
    await expect(previewLocator(page, "#hero-title")).toHaveAttribute("contenteditable", "true");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("text-edit");

    for (const theme of ["dark", "light"]) {
      await page.evaluate((nextTheme) => {
        globalThis.eval(`setThemePreference(${JSON.stringify(nextTheme)}, false)`);
      }, theme);
      await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("text-edit");
      await expect(previewLocator(page, "#hero-title")).toHaveAttribute("contenteditable", "true");
    }

    await previewLocator(page, "#hero-title").press("Escape");
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");

    await closeCompactShellPanels(page);
    await page.locator("#selectionFrameHitArea").click({ button: "right" });
    await expect(page.locator("#contextMenu")).toBeVisible();

    let ui = await readSelectionUiState(page);
    expect(ui.contextMenuVisible).toBe(true);
    expect(ui.toolbarVisible).toBe(false);

    await page.mouse.click(12, 12);
    await expect(page.locator("#contextMenu")).toBeHidden();

    await expect
      .poll(async () => {
        ui = await readSelectionUiState(page);
        return ui.toolbarVisible;
      })
      .toBe(true);
  });

  test("dark theme keeps inspector density toggle semantic and functional @stage-f", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("presentation-editor:theme:v1", "dark");
    });
    await page.goto("/editor/presentation-editor-v0.19.2.html", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("#openHtmlBtn")).toBeVisible();

    const readToggleStyles = () =>
      page.evaluate(() => {
        const wrap = document.querySelector(".inspector-density-toggle");
        const basic = document.getElementById("basicModeBtn");
        const advanced = document.getElementById("advancedModeBtn");
        const read = (node) => {
          if (!(node instanceof HTMLElement)) return null;
          const style = window.getComputedStyle(node);
          return {
            backgroundColor: style.backgroundColor,
            color: style.color,
          };
        };
        return {
          theme: document.body.dataset.theme,
          complexityMode: document.body.dataset.complexityMode,
          wrap: read(wrap),
          basic: read(basic),
          advanced: read(advanced),
        };
      });

    const serializeStyle = (style) => JSON.stringify(style || null);

    let styles = await readToggleStyles();
    expect(styles.theme).toBe("dark");
    expect(styles.wrap).not.toBeNull();
    expect(styles.basic).not.toBeNull();
    expect(styles.advanced).not.toBeNull();

    await page.evaluate(() => {
      globalThis.eval('setThemePreference("light", false)');
    });

    styles = await readToggleStyles();
    expect(styles.theme).toBe("light");

    await page.evaluate(() => {
      globalThis.eval('setThemePreference("dark", false)');
    });

    styles = await readToggleStyles();
    expect(styles.theme).toBe("dark");

    await expect(page.locator("#basicModeBtn")).toBeHidden();
    await expect(page.locator("#advancedModeBtn")).toBeHidden();

    await openHtmlFixture(page, BASIC_DECK_PATH, {
      manualBaseUrl: BASIC_MANUAL_BASE_URL,
    });
    await ensureInspectorSurfaceForAssertions(page);
    const viewportWidth = await readViewportWidth(page);
    const densityToggleVisible = await page.locator("#basicModeBtn").isVisible();
    expect(await page.locator("#advancedModeBtn").isVisible()).toBe(
      densityToggleVisible,
    );
    if (viewportWidth < 400 || !densityToggleVisible) {
      await expect(page.locator("#basicModeBtn")).toBeHidden();
      await expect(page.locator("#advancedModeBtn")).toBeHidden();
      return;
    }
    await expect(page.locator("#basicModeBtn")).toBeVisible();
    await expect(page.locator("#advancedModeBtn")).toBeVisible();

    const shell = await readWorkflowShellState(page);
    expect(shell.metrics.basicModeBtn).not.toBeNull();
    expect(shell.metrics.advancedModeBtn).not.toBeNull();
    expect(shell.metrics.basicModeBtn.scrollWidth).toBeLessThanOrEqual(
      shell.metrics.basicModeBtn.clientWidth,
    );
    expect(shell.metrics.advancedModeBtn.scrollWidth).toBeLessThanOrEqual(
      shell.metrics.advancedModeBtn.clientWidth,
    );

    await page.click("#advancedModeBtn");
    await expect.poll(() => evaluateEditor(page, "state.complexityMode")).toBe("advanced");

    styles = await readToggleStyles();
    expect(styles.complexityMode).toBe("advanced");
    expect(serializeStyle(styles.advanced)).not.toBe(serializeStyle(styles.basic));

    await page.click("#basicModeBtn");
    await expect.poll(() => evaluateEditor(page, "state.complexityMode")).toBe("basic");
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
          clientWidth: element.clientWidth,
          display: style.display,
          height: rect.height,
          overflowY: style.overflowY,
          scrollHeight: element.scrollHeight,
          top: rect.top,
          width: rect.width,
        };
      };

      return {
        documentScrollHeight: document.documentElement.scrollHeight,
        inspectorBody: summarize(".inspector-body"),
        innerHeight: window.innerHeight,
        previewNoteActions: summarize(".preview-note-actions"),
        previewNoteMain: summarize(".preview-note-main"),
        previewStatusSummary: summarize("#previewStatusSummary"),
        previewNote: summarize(".preview-note"),
        previewStage: summarize("#previewStage"),
        slidesBody: summarize(".slides-panel-body"),
        slidesPanel: summarize("#slidesPanel"),
        topbar: summarize("#topbar"),
      };
    });

    expect(metrics.documentScrollHeight).toBeLessThanOrEqual(metrics.innerHeight + 2);
    expect(metrics.topbar?.height || 0).toBeLessThanOrEqual(72);
    expect(metrics.previewNote?.height || 0).toBeLessThanOrEqual(160);
    expect(metrics.previewNoteActions?.width || 0).toBeGreaterThan(
      (metrics.previewNote?.width || 0) * 0.75,
    );
    expect(metrics.previewNoteActions?.top || 0).toBeGreaterThan(
      (metrics.previewNoteMain?.top || 0) + 12,
    );
    expect(metrics.previewStatusSummary?.width || 0).toBeLessThan(
      (metrics.previewNote?.width || 0) * 0.7,
    );
    expect(metrics.previewStage?.height || 0).toBeGreaterThanOrEqual(460);
    expect(metrics.slidesPanel?.height || 0).toBeGreaterThan(320);
    expect(metrics.inspectorBody?.height || 0).toBeGreaterThan(320);
    expect(metrics.inspectorBody?.overflowY).toBe("auto");
    expect(metrics.slidesBody?.overflowY).toBe("auto");
    expect(metrics.inspectorBody?.scrollHeight || 0).toBeGreaterThanOrEqual(
      metrics.inspectorBody?.clientHeight || 0,
    );
  });

  test("preview note separates summary from action cluster when preview chrome is busy @stage-f", async (
    { page },
    testInfo,
  ) => {
    test.skip(
      !["chromium-desktop", "chromium-shell-1100"].includes(testInfo.project.name),
      "Desktop and intermediate shell only.",
    );

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    const metrics = await page.evaluate(() => {
      const summarize = (selector) => {
        const element =
          selector.startsWith("#")
            ? document.getElementById(selector.slice(1))
            : document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          display: style.display,
          height: rect.height,
          top: rect.top,
          width: rect.width,
        };
      };

      return {
        previewNote: summarize(".preview-note"),
        previewNoteActions: summarize(".preview-note-actions"),
        previewNoteMain: summarize(".preview-note-main"),
      };
    });

    expect(metrics.previewNote).not.toBeNull();
    expect(metrics.previewNoteMain).not.toBeNull();
    expect(metrics.previewNoteActions).not.toBeNull();
    expect(metrics.previewNoteActions.width || 0).toBeGreaterThan(
      (metrics.previewNote.width || 0) * 0.75,
    );
    expect(metrics.previewNoteActions.top || 0).toBeGreaterThan(
      (metrics.previewNoteMain.top || 0) + 12,
    );
  });

  test("preview note keeps editorial hierarchy and button weight contract across shell widths @stage-f", async (
    { page },
    testInfo,
  ) => {
    test.skip(
      ![
        "chromium-desktop",
        "chromium-shell-1100",
        "chromium-wide-1440",
      ].includes(testInfo.project.name),
      "Editorial shell matrix only.",
    );

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    const chrome = await page.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          backgroundImage: style.backgroundImage,
          boxShadow: style.boxShadow,
          clientHeight: element.clientHeight,
          clientWidth: element.clientWidth,
          height: rect.height,
          lineClamp: style.webkitLineClamp || "",
          scrollWidth: element.scrollWidth,
          text: (element.textContent || "").replace(/\s+/g, " ").trim(),
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
        activeSlideLabel: read("#activeSlideLabel"),
        lifecyclePill: read("#previewLifecyclePill"),
        note: read(".preview-note"),
        noteText: read("#previewNoteText"),
        primaryAction: read("#previewPrimaryActionBtn"),
        reloadAction: read("#reloadPreviewBtn"),
        insertAction: read("#toggleInsertPaletteBtn"),
        statePill: read("#interactionStatePill"),
        statusSummary: read("#previewStatusSummary"),
      };
    });

    expect(chrome.note?.visible).toBe(true);
    expect(chrome.statusSummary?.visible).toBe(true);
    expect(chrome.activeSlideLabel?.visible).toBe(true);
    expect(chrome.primaryAction?.visible).toBe(true);
    expect(chrome.reloadAction?.visible).toBe(true);
    expect(chrome.insertAction?.visible).toBe(true);
    expect(chrome.statePill?.visible).toBe(true);
    expect(chrome.lifecyclePill?.visible).toBe(true);

    expect(chrome.statusSummary?.text.length || 0).toBeLessThanOrEqual(32);
    expect(chrome.noteText?.text.length || 0).toBeLessThanOrEqual(36);
    expect(chrome.noteText?.lineClamp || "").toBe("1");
    expect(chrome.noteText?.clientHeight || 0).toBeLessThanOrEqual(18);
    expect(chrome.noteText?.scrollWidth || 0).toBeGreaterThan(0);
    expect(chrome.statusSummary?.width || 0).toBeLessThan(
      (chrome.note?.width || 0) * 0.72,
    );
    expect(chrome.activeSlideLabel?.clientHeight || 0).toBeLessThanOrEqual(34);

    expect(chrome.primaryAction?.backgroundImage).not.toBe("none");
    expect(chrome.primaryAction?.boxShadow).not.toBe("none");
    expect(chrome.reloadAction?.boxShadow).toBe("none");
    expect(chrome.insertAction?.boxShadow).toBe("none");
    expect(chrome.statePill?.boxShadow).toBe("none");
    expect(chrome.lifecyclePill?.boxShadow).toBe("none");
    expect(chrome.primaryAction?.height || 0).toBeGreaterThan(
      chrome.statePill?.height || 0,
    );
    expect(chrome.reloadAction?.text.length || 0).toBeLessThan(
      chrome.primaryAction?.text.length || 0,
    );

    await assertNoHorizontalOverflow(page);
    await assertShellGeometry(page);
  });

  test("preview shell editorial-summary snapshots stay stable in light and dark @stage-f", async (
    { page },
    testInfo,
  ) => {
    test.skip(
      testInfo.project.name !== "chromium-desktop",
      "Desktop snapshot baseline only.",
    );

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    await expect(page.locator(".preview-note")).toHaveScreenshot(
      "preview-note-editorial-summary-light.png",
      {
        animations: "disabled",
        caret: "hide",
      },
    );
    await expect(page.locator(".preview-shell")).toHaveScreenshot(
      "preview-shell-editorial-summary-light.png",
      {
        animations: "disabled",
        caret: "hide",
      },
    );

    await page.evaluate(() => {
      globalThis.eval('setThemePreference("dark", false)');
    });
    await page.waitForTimeout(180);

    await expect(page.locator(".preview-note")).toHaveScreenshot(
      "preview-note-editorial-summary-dark.png",
      {
        animations: "disabled",
        caret: "hide",
      },
    );
    await expect(page.locator(".preview-shell")).toHaveScreenshot(
      "preview-shell-editorial-summary-dark.png",
      {
        animations: "disabled",
        caret: "hide",
      },
    );
  });

  test("loaded topbar keeps undo redo inline and routes theme through overflow across shell widths @stage-f", async (
    { page },
    testInfo,
  ) => {
    test.skip(
      ![
        "chromium-desktop",
        "chromium-mobile-390",
        "chromium-mobile-640",
        "chromium-shell-1100",
      ].includes(testInfo.project.name),
      "Topbar contract matrix only.",
    );

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await clickPreview(page, "#hero-title");

    let chrome = await readTopbarChromeState(page);
    expect(chrome.commandMode).toBe("overflow");
    expect(chrome.openVisible).toBe(true);
    expect(chrome.exportVisible).toBe(true);
    expect(chrome.overflowTriggerVisible).toBe(true);
    expect(chrome.themeVisible).toBe(false);
    expect(chrome.undoVisible).toBe(true);
    expect(chrome.redoVisible).toBe(true);

    if (["chromium-desktop", "chromium-shell-1100"].includes(testInfo.project.name)) {
      const shell = await readWorkflowShellState(page);
      expect(shell.metrics.slidesPanel).not.toBeNull();
      expect(shell.metrics.inspectorPanel).not.toBeNull();
      expect(shell.metrics.slidesPanel.width).toBeGreaterThanOrEqual(240);
      expect(shell.metrics.inspectorPanel.width).toBeGreaterThanOrEqual(240);
    }

    await page.click("#topbarOverflowBtn");
    await expect(page.locator("#topbarOverflowMenu")).toBeVisible();
    await expect(page.locator("#topbarOverflowThemeBtn")).toBeVisible();

    chrome = await readTopbarChromeState(page);
    expect(chrome.overflowMenuVisible).toBe(true);
    expect(chrome.overflowTriggerExpanded).toBe("true");

    await page.click("#toggleInsertPaletteBtn");
    await expect(page.locator("#quickPalette")).toBeVisible();
    await expect(page.locator("#topbarOverflowMenu")).toBeHidden();

    await evaluateEditor(page, "openContextMenuForCurrentSelection(320, 220); 'ok';");
    await expect(page.locator("#contextMenu")).toBeVisible();
    await expect(page.locator("#quickPalette")).toBeHidden();
    await expect(page.locator("#topbarOverflowMenu")).toBeHidden();

    await page.click("#topbarOverflowBtn");
    await expect(page.locator("#topbarOverflowMenu")).toBeVisible();
    await expect(page.locator("#contextMenu")).toBeHidden();

    const initialCount = await evaluateEditor(page, "state.slides.length");
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

    await clickEditorControl(page, "#undoBtn");
    await waitForSlideActivationState(page, {
      activeIndex: initialActiveIndex,
      count: initialCount,
    });

    await clickEditorControl(page, "#redoBtn");
    await waitForSlideActivationState(page, {
      activeIndex: initialActiveIndex + 1,
      count: initialCount + 1,
    });

    await assertNoHorizontalOverflow(page);
    await assertShellGeometry(page);
  });

  test("slide rail status marker keeps clear of slide text @stage-f", async (
    { page },
    testInfo,
  ) => {
    test.skip(
      !["chromium-desktop", "chromium-shell-1100"].includes(testInfo.project.name),
      "Desktop and intermediate shell only.",
    );

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });
    await ensureShellPanelVisible(page, "slides");

    const metrics = await page.evaluate(() => {
      const readMarkerClearance = (selector) => {
        const item = document.querySelector(selector);
        if (!(item instanceof HTMLElement)) return null;
        const slideNumber = item.querySelector(".slide-number");
        if (!(slideNumber instanceof HTMLElement)) return null;
        const itemRect = item.getBoundingClientRect();
        const numberRect = slideNumber.getBoundingClientRect();
        const beforeStyle = window.getComputedStyle(item, "::before");
        const numberStyle = window.getComputedStyle(slideNumber);
        const markerLeft = Number.parseFloat(beforeStyle.left || "0");
        const markerWidth = Number.parseFloat(beforeStyle.width || "0");
        const paddingLeft = Number.parseFloat(numberStyle.paddingLeft || "0");
        const markerRight = itemRect.left + markerLeft + markerWidth;
        const textStart = numberRect.left + paddingLeft;
        return {
          clearance: textStart - markerRight,
          markerRight,
          textStart,
        };
      };

      return {
        active: readMarkerClearance("#slidesPanel .slide-item.is-active"),
        firstInactive: readMarkerClearance(
          '#slidesPanel .slide-item:not(.is-active)',
        ),
      };
    });

    expect(metrics.active).not.toBeNull();
    expect(metrics.firstInactive).not.toBeNull();
    expect(metrics.active.clearance).toBeGreaterThanOrEqual(6);
    expect(metrics.firstInactive.clearance).toBeGreaterThanOrEqual(6);
  });

  test("novice empty state hides editing chrome and keeps one obvious start path @stage-f", async ({
    page,
  }) => {
    await gotoFreshEditor(page);

    const shell = await readWorkflowShellState(page);

    expect(shell.workflow).toBe("empty");
    expect(shell.controls.open).toBe(true);
    expect(shell.controls.emptyOpen).toBe(true);
    expect(shell.controls.emptyPaste).toBe(true);
    expect(shell.controls.previewMode).toBe(false);
    expect(shell.controls.editMode).toBe(false);
    expect(shell.controls.basicMode).toBe(false);
    expect(shell.controls.advancedMode).toBe(false);
    expect(shell.controls.insert).toBe(false);
    expect(shell.controls.slideTemplate).toBe(false);
    expect(shell.controls.reload).toBe(false);
    expect(shell.controls.export).toBe(false);
    expect(shell.controls.overflow).toBe(false);
    expect(shell.panels.slides).toBe(false);
    expect(shell.panels.inspector).toBe(false);
    expect(shell.panels.emptyState).toBe(true);
    expect(shell.copy.emptyState).toContain("Открыть HTML");
    expect(
      shell.copy.emptyState.includes("Вставить HTML") ||
      shell.copy.emptyState.includes("Вставить из буфера"),
    ).toBe(true);

    const layout = await page.evaluate(() => {
      const summarize = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          bottom: rect.bottom,
          height: rect.height,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          visible:
            !element.hidden &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0,
          width: rect.width,
        };
      };

      const workspace = document.getElementById("workspace");
      const workspaceStyle = workspace ? window.getComputedStyle(workspace) : null;
      return {
        emptyState: summarize("#emptyState"),
        mainPreviewPanel: summarize("#mainPreviewPanel"),
        previewStage: summarize("#previewStage"),
        workspace: summarize("#workspace"),
        workspaceTracks: (workspaceStyle?.gridTemplateColumns || "")
          .split(/\s+/)
          .filter(Boolean),
      };
    });

    expect(layout.workspaceTracks).toHaveLength(1);
    expect(layout.workspace?.visible).toBe(true);
    expect(layout.mainPreviewPanel?.visible).toBe(true);
    expect(layout.previewStage?.visible).toBe(true);
    expect(layout.emptyState?.visible).toBe(true);
    expect(layout.mainPreviewPanel?.width || 0).toBeGreaterThan(
      (layout.workspace?.width || 0) * 0.78,
    );
    expect(layout.previewStage?.width || 0).toBeGreaterThan(
      (layout.mainPreviewPanel?.width || 0) - 40,
    );
    const minExpectedEmptyWidth = Math.min(
      360,
      Math.max(280, (layout.previewStage?.width || 0) - 32),
    );
    expect(layout.emptyState?.width || 0).toBeGreaterThan(minExpectedEmptyWidth);
    expect(
      Math.abs(
        ((layout.emptyState?.left || 0) + (layout.emptyState?.right || 0)) / 2 -
          ((layout.previewStage?.left || 0) + (layout.previewStage?.right || 0)) / 2,
      ),
    ).toBeLessThanOrEqual(8);

    await assertNoHorizontalOverflow(page);
    await assertShellGeometry(page);
  });

  test("novice preview path keeps advanced inspector surfaces concealed until opted in @stage-f", async ({
    page,
  }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });
    await ensureInspectorSurfaceForAssertions(page);
    const viewportWidth = await readViewportWidth(page);
    const compactShell = viewportWidth <= 1024;
    const narrowCompactShell = viewportWidth < 400;

    let shell = await readWorkflowShellState(page);

    expect(shell.workflow).toBe("loaded-preview");
    expect(shell.state.activeSlideId).not.toBe("");
    expect(shell.state.slideCount).toBeGreaterThan(0);
    expect(shell.controls.editMode).toBe(true);
    expect(shell.controls.editSuggested).toBe(true);
    expect(shell.controls.basicMode).toBe(shell.controls.advancedMode);
    expect(shell.controls.previewPrimaryAction).toBe(true);
    expect(shell.copy.previewPrimaryAction.toLowerCase()).toContain("редакт");
    expect(shell.panels.slides).toBe(!compactShell);
    expect(shell.panels.inspector).toBe(true);
    expect(shell.inspector.currentSlide).toBe(true);
    expect(shell.inspector.currentSlideSummary).toBe(true);
    expect(shell.inspector.currentSlideEditorControls).toBe(false);
    expect(shell.inspector.currentElement).toBe(false);
    expect(shell.inspector.insert).toBe(false);
    expect(shell.inspector.elementActions).toBe(false);
    expect(shell.inspector.text).toBe(false);
    expect(shell.inspector.geometry).toBe(false);
    expect(shell.inspector.diagnostics).toBe(false);
    expect(shell.inspector.showSlideHtml).toBe(false);
    expect(shell.inspector.showElementHtml).toBe(false);

    const densityToggleVisible = shell.controls.basicMode;
    if (!densityToggleVisible) {
      expect(compactShell).toBe(true);
    }

    if (narrowCompactShell || !densityToggleVisible) {
      await assertNoHorizontalOverflow(page);
      await assertShellGeometry(page);
      return;
    }

    await page.click("#advancedModeBtn");
    await expect.poll(() => evaluateEditor(page, "state.complexityMode")).toBe("advanced");

    shell = await readWorkflowShellState(page);
    expect(shell.inspector.showSlideHtml).toBe(true);

    await page.click("#basicModeBtn");
    await expect.poll(() => evaluateEditor(page, "state.complexityMode")).toBe("basic");

    shell = await readWorkflowShellState(page);
    expect(shell.inspector.showSlideHtml).toBe(false);
    expect(shell.inspector.geometry).toBe(false);

    await assertNoHorizontalOverflow(page);
    await assertShellGeometry(page);
  });

  test("novice edit path swaps slide summary for selection-first guidance after the first click @stage-f", async ({
    page,
  }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await ensureInspectorSurfaceForAssertions(page);

    let shell = await readWorkflowShellState(page);

    expect(shell.workflow).toBe("loaded-edit");
    expect(shell.inspector.currentSlide).toBe(true);
    expect(shell.inspector.currentElement).toBe(false);

    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureInspectorSurfaceForAssertions(page);

    shell = await readWorkflowShellState(page);
    expect(shell.workflow).toBe("loaded-edit");
    expect(shell.state.selectedNodeId).not.toBe("");
    expect(shell.inspector.currentSlide).toBe(false);
    expect(shell.inspector.currentElement).toBe(true);
    expect(shell.inspector.currentElementSummary).toBe(true);
    expect(shell.inspector.elementTag).toBe(false);
    expect(shell.inspector.text).toBe(true);
    expect(shell.inspector.diagnostics).toBe(false);
    expect(shell.copy.selectedElementTitle.length).toBeGreaterThan(3);
    expect(shell.copy.inspectorHelp.length).toBeGreaterThan(16);

    await assertNoHorizontalOverflow(page);
    await assertShellGeometry(page);
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

  test("preview zoom controls change scale and persist @stage-f", async ({
    page,
  }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });
    await setMode(page, "edit");

    // Verify zoom controls exist
    await expect(page.locator("#zoomOutBtn")).toBeVisible();
    await expect(page.locator("#zoomInBtn")).toBeVisible();
    await expect(page.locator("#zoomLevelLabel")).toHaveText("100%");
    await expect(page.locator("#zoomResetBtn")).toBeHidden();

    // Zoom in
    await clickEditorControl(page, "#zoomInBtn");
    await expect(page.locator("#zoomLevelLabel")).toHaveText("110%");
    await expect(page.locator("#zoomResetBtn")).toBeVisible();

    // Verify iframe has zoom property applied (v0.18.3)
    const zoom = await page.locator("#previewFrame").evaluate((el) => {
      return window.getComputedStyle(el).zoom;
    });
    expect(zoom).toBe("1.1");

    // Reset with button
    await clickEditorControl(page, "#zoomResetBtn");
    await expect(page.locator("#zoomLevelLabel")).toHaveText("100%");
    await expect(page.locator("#zoomResetBtn")).toBeHidden();

    // Keyboard shortcuts: Ctrl+= for zoom in
    await page.keyboard.press("Control+=");
    await expect(page.locator("#zoomLevelLabel")).toHaveText("110%");

    // Keyboard shortcuts: Ctrl+0 for reset
    await page.keyboard.press("Control+0");
    await expect(page.locator("#zoomLevelLabel")).toHaveText("100%");

    // Keyboard shortcuts: Ctrl+- for zoom out
    await page.keyboard.press("Control+-");
    await expect(page.locator("#zoomLevelLabel")).toHaveText("90%");

    // Verify persistence
    const storedZoom = await page.evaluate(() => {
      return localStorage.getItem("presentation-editor:preview-zoom:v1");
    });
    expect(parseFloat(storedZoom)).toBeCloseTo(0.9, 2);

    await assertNoHorizontalOverflow(page);
    await assertShellGeometry(page);
  });

  test("compact drawer routing does not leak shell residue into export validation @stage-e", async (
    { page },
    testInfo,
  ) => {
    test.skip(!/(390|640|820)/.test(testInfo.project.name), "Narrow viewport only.");

    await loadBasicDeck(page, {
      manualBaseUrl: BASIC_MANUAL_BASE_URL,
      mode: "edit",
    });

    await page.click("#mobileInsertBtn");
    await expect(page.locator("#quickPalette")).toBeVisible();
    await page.click("#mobileInspectorBtn");
    await expect(page.locator("#inspectorPanel")).toBeVisible();
    await page.click("#mobileSlidesBtn");
    await expect(page.locator("#slidesPanel")).toBeVisible();
    await closeCompactShellPanels(page);

    const popup = await openExportValidationPopup(page);
    await popup.close();

    const residue = await evaluateEditor(
      page,
      `(() => {
        const pack = buildExportValidationPackage();
        const doc = new DOMParser().parseFromString(pack.serialized, "text/html");
        const found = [];
        doc.querySelectorAll("[data-editor-ui='true']").forEach((node) => {
          found.push("ui:" + node.tagName.toLowerCase());
        });
        doc.querySelectorAll("*").forEach((node) => {
          Array.from(node.attributes || []).forEach((attribute) => {
            if (/^data-editor-/.test(attribute.name)) {
              found.push("attr:" + attribute.name);
            }
          });
        });
        return found.sort();
      })()`,
    );

    expect(residue).toEqual([]);
  });
});
