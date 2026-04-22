// banner-unification.spec.js
// Gate-B spec for WO-29: unified #blockReasonBanner replaces #lockBanner.
// Acceptance criteria:
//   - In basic mode with locked element: only #blockReasonBanner visible, action reads "Разблокировать"
//   - Clicking action unlocks the element
//   - In basic mode with locked reason, geometry inspector section stays hidden (P1-02)
//   - #lockBanner must not exist in the DOM at all
const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  clickPreview,
  closeCompactShellPanels,
  ensureShellPanelVisible,
  evaluateEditor,
  loadBasicDeck,
} = require("../helpers/editorApp");

test.describe("WO-29 Banner unification — #lockBanner deleted, #blockReasonBanner unified", () => {
  test.beforeEach(async ({ page }) => {
    await loadBasicDeck(page, {
      manualBaseUrl: BASIC_MANUAL_BASE_URL,
      mode: "edit",
    });
  });

  test("#lockBanner element does not exist in the shell DOM @stage-f", async ({ page }) => {
    const lockBannerCount = await page.locator("#lockBanner").count();
    expect(lockBannerCount).toBe(0);
  });

  test("basic mode locked element: only #blockReasonBanner visible with Разблокировать action @stage-f", async ({ page }) => {
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

    // #lockBanner must not exist
    await expect(page.locator("#lockBanner")).toHaveCount(0);

    // #blockReasonBanner must be visible with correct content
    await expect(page.locator("#blockReasonBanner")).toBeVisible();
    await expect(page.locator("#blockReasonText")).toContainText("заблокирован");
    await expect(page.locator("#blockReasonActionBtn")).toBeVisible();
    await expect(page.locator("#blockReasonActionBtn")).toContainText("Разблокировать");
  });

  test("clicking Разблокировать action unlocks the element @stage-f", async ({ page }) => {
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

    await expect(page.locator("#blockReasonActionBtn")).toBeVisible();
    await page.locator("#blockReasonActionBtn").click();

    // Banner should hide after unlock
    await expect(page.locator("#blockReasonBanner")).toBeHidden();

    // Element should no longer be locked
    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `(() => {
              const nodeId = state.selectedNodeId;
              const node = nodeId && state.modelDoc
                ? state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]')
                : null;
              return node instanceof Element
                ? node.getAttribute("data-editor-locked")
                : null;
            })()`,
          ),
        { timeout: 6000 },
      )
      .not.toBe("true");
  });

  test("basic mode locked reason: geometry inspector section stays hidden (P1-02 closure) @stage-f", async ({ page }) => {
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

    // In basic mode with locked reason, geometry section must NOT be auto-unhidden
    const geometrySection = page.locator(".inspector-geometry");
    // It should remain hidden (not auto-unhidden by the P1-02-fixed condition)
    await expect(geometrySection).toBeHidden();
  });

  test("advanced mode locked element uses unified #blockReasonBanner @stage-f", async ({ page }, testInfo) => {
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

    await expect(page.locator("#blockReasonBanner")).toBeVisible();
    await expect(page.locator("#blockReasonActionBtn")).toContainText("Разблокировать");
  });
});
