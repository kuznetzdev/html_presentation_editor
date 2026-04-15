const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  clickPreview,
  closeCompactShellPanels,
  ensureShellPanelVisible,
  evaluateEditor,
  loadBasicDeck,
} = require("../helpers/editorApp");

test.describe("Honest feedback and transient shell routing", () => {
  test.beforeEach(async ({ page }) => {
    await loadBasicDeck(page, {
      manualBaseUrl: BASIC_MANUAL_BASE_URL,
      mode: "edit",
    });
  });

  test("clean text selection keeps block banner hidden @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    await expect(page.locator("#blockReasonBanner")).toBeHidden();
  });

  test("zoom block shows action and reset clears banner @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    await evaluateEditor(page, "setPreviewZoom(1.25, true); updateInspectorFromSelection();");

    await expect(page.locator("#blockReasonBanner")).toBeVisible();
    await expect(page.locator("#blockReasonText")).toContainText("Масштаб");
    await expect(page.locator("#blockReasonActionBtn")).toBeVisible();

    await page.locator("#blockReasonActionBtn").click();

    await expect.poll(() => evaluateEditor(page, "state.previewZoom")).toBe(1);
    await expect(page.locator("#blockReasonBanner")).toBeHidden();
  });

  test("hidden selection shows restore action and action resolves state @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    await evaluateEditor(
      page,
      `(() => {
        const nodeId = state.selectedNodeId;
        if (!nodeId) throw new Error("selection-missing");
        if (typeof toggleLayerVisibility !== "function") {
          throw new Error("toggle-visibility-unavailable");
        }
        toggleLayerVisibility(nodeId);
      })()`,
    );

    await expect(page.locator("#blockReasonBanner")).toBeVisible();
    await expect(page.locator("#blockReasonText")).toContainText("скрыт");
    await expect(page.locator("#blockReasonActionBtn")).toContainText("Показать");

    await page.locator("#blockReasonActionBtn").click();

    await expect(page.locator("#blockReasonBanner")).toBeHidden();
    await expect
      .poll(() =>
        evaluateEditor(
          page,
          `(() => {
            const nodeId = state.selectedNodeId;
            const node = nodeId && state.modelDoc
              ? state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]')
              : null;
            return node instanceof Element ? node.hasAttribute("hidden") : null;
          })()`,
        ),
      )
      .toBe(false);
  });

  test("basic mode locked selection shows honest block banner @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    await evaluateEditor(
      page,
      `(() => {
        const nodeId = state.selectedNodeId;
        if (!nodeId || !state.modelDoc) throw new Error("selection-missing");
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
        if (!(node instanceof Element)) throw new Error("node-missing");
        node.setAttribute("data-editor-locked", "true");
        state.complexityMode = "basic";
        applyComplexityModeUi();
        updateInspectorFromSelection();
      })()`,
    );

    await expect(page.locator("#lockBanner")).toBeHidden();
    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `Boolean(
              !document.getElementById("blockReasonBanner")?.hidden &&
              !document.getElementById("blockReasonActionBtn")?.hidden
            )`,
          ),
        { timeout: 6000 },
      )
      .toBe(true);
    await expect(page.locator("#blockReasonText")).toContainText("заблокирован");
    await expect(page.locator("#blockReasonActionBtn")).toContainText("Разблокировать");
  });

  test("advanced mode keeps lock banner priority over generic block banner @stage-f", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "Desktop-focused advanced shell only.");

    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    await evaluateEditor(
      page,
      `(() => {
        const nodeId = state.selectedNodeId;
        if (!nodeId || !state.modelDoc) throw new Error("selection-missing");
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
        if (!(node instanceof Element)) throw new Error("node-missing");
        node.setAttribute("data-editor-locked", "true");
        state.complexityMode = "advanced";
        applyComplexityModeUi();
        updateInspectorFromSelection();
      })()`,
    );

    await expect(page.locator("#lockBanner")).toBeVisible();
    await expect(page.locator("#blockReasonBanner")).toBeHidden();
  });

  test("compact drawer opening closes insert palette and topbar overflow @stage-e", async ({ page }, testInfo) => {
    test.skip(!/390|640|820/.test(testInfo.project.name), "Compact shell only.");

    await page.locator("#mobileInsertBtn").click();
    await expect(page.locator("#quickPalette")).toBeVisible();

    await page.locator("#mobileInspectorBtn").click();
    await expect(page.locator("#quickPalette")).toBeHidden();
    await expect(page.locator("#inspectorPanel")).toBeVisible();

    await page.locator("#topbarOverflowBtn").click();
    await expect(page.locator("#topbarOverflowMenu")).toBeVisible();

    await page.locator("#mobileSlidesBtn").click();
    await expect(page.locator("#topbarOverflowMenu")).toBeHidden();
    await expect(page.locator("#slidesPanel")).toBeVisible();
  });

  test("stack depth badge reflects click-through progress only when needed @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    await expect(page.locator("#stackDepthBadge")).toBeHidden();

    await evaluateEditor(
      page,
      `(() => {
        state.clickThroughState = {
          x: 24,
          y: 24,
          timestamp: Date.now(),
          index: 1,
          candidates: [{ nodeId: "a" }, { nodeId: "b" }, { nodeId: "c" }],
        };
        renderSelectionBreadcrumbs(true);
      })()`,
    );

    await expect(page.locator("#stackDepthBadge")).toBeVisible();
    await expect(page.locator("#stackDepthBadge")).toHaveText("2 из 3");
    await expect(page.locator("#stackDepthBadge")).toHaveAttribute(
      "aria-label",
      "Слой 2 из 3 под курсором",
    );
  });

  test("save state pill names the draft honestly instead of pretending to export @stage-f", async ({
    page,
  }) => {
    await evaluateEditor(page, "saveProjectToLocalStorage()");

    await expect(page.locator("#saveStatePill")).toContainText(/локальный черновик/i);
    await expect(page.locator("#saveStatePill")).not.toContainText("Сохранено");
  });

  test("shell-owned storage failures surface diagnostics instead of silent fallback @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");

    const diagnostics = await evaluateEditor(
      page,
      `(() => {
        const proto = Object.getPrototypeOf(window.localStorage);
        const originalGet = proto.getItem;
        const originalSet = proto.setItem;
        const originalRemove = proto.removeItem;
        const readBlocked = new Set([
          "presentation-editor:theme:v1",
          "presentation-editor:copied-style:v1",
          "presentation-editor:selection-mode:v1",
          "presentation-editor:preview-zoom:v1",
          "presentation-editor:autosave:v3",
        ]);
        const writeBlocked = new Set([
          "presentation-editor:theme:v1",
          "presentation-editor:copied-style:v1",
          "presentation-editor:selection-mode:v1",
          "presentation-editor:preview-zoom:v1",
          "presentation-editor:autosave:v3",
        ]);

        proto.getItem = function(key) {
          if (readBlocked.has(String(key))) {
            throw new Error("forced-storage-read:" + key);
          }
          return originalGet.call(this, key);
        };

        proto.setItem = function(key, value) {
          if (writeBlocked.has(String(key))) {
            throw new Error("forced-storage-write:" + key);
          }
          return originalSet.call(this, key, value);
        };

        proto.removeItem = function(key) {
          if (writeBlocked.has(String(key))) {
            throw new Error("forced-storage-remove:" + key);
          }
          return originalRemove.call(this, key);
        };

        try {
          initTheme();
          initSelectionMode();
          initPreviewZoom();
          copySelectedStyle();
          setThemePreference("dark", true);
          setSelectionMode("container", true);
          setPreviewZoom(1.1, true);
          saveProjectToLocalStorage();
          tryRestoreDraftPrompt();
          clearAutosave();
          return state.diagnostics.join("\\n");
        } finally {
          proto.getItem = originalGet;
          proto.setItem = originalSet;
          proto.removeItem = originalRemove;
        }
      })()`,
    );

    expect(diagnostics).toContain("theme-preference-load-failed");
    expect(diagnostics).toContain("copied-style-load-failed");
    expect(diagnostics).toContain("selection-mode-load-failed");
    expect(diagnostics).toContain("preview-zoom-load-failed");
    expect(diagnostics).toContain("copied-style-save-failed");
    expect(diagnostics).toContain("theme-preference-save-failed");
    expect(diagnostics).toContain("selection-mode-save-failed");
    expect(diagnostics).toContain("preview-zoom-save-failed");
    expect(diagnostics).toContain("restore-draft-load-failed");
    expect(diagnostics).toContain("autosave-clear-failed");
    expect(diagnostics).toContain("autosave-failed:");
  });
});
