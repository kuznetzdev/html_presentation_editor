
const { test, expect } = require("@playwright/test");
const {
  BASIC_DECK_PATH,
  BASIC_MANUAL_BASE_URL,
  clickPreview,
  closeCompactShellPanels,
  ensureShellPanelVisible,
  evaluateEditor,
  loadBasicDeck,
  readWorkflowShellState,
  setMode,
} = require("../helpers/editorApp");

test.describe("Honest feedback — block reason banners and stack depth @v0.19.0", () => {

    // --- Inserted: transform/hidden/aria-live block reason tests ---
    test("block banner shows transform reason for transform-blocked element @stage-f", async ({ page }) => {
      await closeCompactShellPanels(page);
      // Activate Slide 2 (positioning) so the transform-root element is visible
      await evaluateEditor(page, `requestSlideActivation(state.slides[1]?.id, { reason: 'test' })`);
      // Select the transform-blocked element in the basic deck
      await clickPreview(page, "#unsafe-box");
      await ensureShellPanelVisible(page, "inspector");

      const banner = page.locator("#blockReasonBanner");
      await expect(banner).toBeVisible();
      const text = page.locator("#blockReasonText");
      await expect(text).toContainText("transform");
      // No action button for transform block
      const actionBtn = page.locator("#blockReasonActionBtn");
      await expect(actionBtn).toBeHidden();
    });

    test("block banner shows hidden reason for hidden element @stage-f", async ({ page }) => {
      await closeCompactShellPanels(page);
      // Simulate hiding an element and select it
      await clickPreview(page, "#hero-title");
      await ensureShellPanelVisible(page, "inspector");
      // Hide the element via modelDoc
      await evaluateEditor(page, `
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + state.selectedNodeId + '"]');
        if (node) node.setAttribute('hidden', '');
        updateInspectorFromSelection();
      `);
      const banner = page.locator("#blockReasonBanner");
      await expect(banner).toBeVisible();
      const text = page.locator("#blockReasonText");
      await expect(text).toContainText("скрыт");
      // Action button for hidden block
      const actionBtn = page.locator("#blockReasonActionBtn");
      await expect(actionBtn).toBeVisible();
      await expect(actionBtn).toContainText("Показать");
    });

    test("block banner disappears when hidden block is resolved @stage-f", async ({ page }) => {
      await closeCompactShellPanels(page);
      await clickPreview(page, "#hero-title");
      await ensureShellPanelVisible(page, "inspector");
      // Hide the element
      await evaluateEditor(page, `
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + state.selectedNodeId + '"]');
        if (node) node.setAttribute('hidden', '');
        updateInspectorFromSelection();
      `);
      const banner = page.locator("#blockReasonBanner");
      await expect(banner).toBeVisible();
      // Show the element again
      await evaluateEditor(page, `
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + state.selectedNodeId + '"]');
        if (node) node.removeAttribute('hidden');
        updateInspectorFromSelection();
      `);
      await expect(banner).toBeHidden();
    });

    test("block reason banner updates aria-live region for screen readers @stage-f", async ({ page }) => {
      await closeCompactShellPanels(page);
      await clickPreview(page, "#hero-title");
      await ensureShellPanelVisible(page, "inspector");

      // Set zoom to trigger block reason
      await evaluateEditor(page, `setPreviewZoom(1.25, true)`);
      await evaluateEditor(page, `updateInspectorFromSelection()`);

      const banner = page.locator("#blockReasonBanner");
      await expect(banner).toBeVisible();
      await expect(banner).toHaveAttribute("aria-live", "polite");
      // Change block reason to hidden
      await evaluateEditor(page, `
        setPreviewZoom(1.0, true);
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + state.selectedNodeId + '"]');
        if (node) node.setAttribute('hidden', '');
        updateInspectorFromSelection();
      `);
      // Wait for banner text to update
      const text = page.locator("#blockReasonText");
      await expect(text).toContainText("скрыт");
      // Banner should still have aria-live=polite
      await expect(banner).toHaveAttribute("aria-live", "polite");
    });
  test.beforeEach(async ({ page }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
  });

  test("no block banner on clean text selection @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    const banner = page.locator("#blockReasonBanner");
    await expect(banner).toBeHidden();
  });

  test("block banner shows zoom reason when zoom is not 100% @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    // Set zoom to 125%
    await evaluateEditor(page, `setPreviewZoom(1.25, true)`);
    // Re-trigger inspector update
    await evaluateEditor(page, `updateInspectorFromSelection()`);

    const banner = page.locator("#blockReasonBanner");
    await expect(banner).toBeVisible();

    const text = page.locator("#blockReasonText");
    await expect(text).toContainText("Масштаб");

    const actionBtn = page.locator("#blockReasonActionBtn");
    await expect(actionBtn).toBeVisible();
    await expect(actionBtn).toContainText("Сбросить");
  });

  test("block banner action resets zoom to 100% @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    await evaluateEditor(page, `setPreviewZoom(1.25, true)`);
    await evaluateEditor(page, `updateInspectorFromSelection()`);

    const actionBtn = page.locator("#blockReasonActionBtn");
    await expect(actionBtn).toBeVisible();
    await actionBtn.click();

    // Zoom should reset to 1
    const zoom = await evaluateEditor(page, `state.previewZoom`);
    expect(zoom).toBe(1);

    const banner = page.locator("#blockReasonBanner");
    await expect(banner).toBeHidden();
  });

  test("lock banner takes priority over block reason banner @stage-f", async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.includes("desktop"), "Advanced mode on desktop only.");

    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    // Switch to advanced mode and lock the selected element directly on modelDoc
    const nodeId = await evaluateEditor(page, `state.selectedNodeId`);
    await evaluateEditor(page, `
      state.complexityMode = "advanced";
      applyComplexityModeUi();
      const lockNode = state.modelDoc.querySelector('[data-editor-node-id="' + "${nodeId}" + '"]');
      if (lockNode) lockNode.setAttribute("data-editor-locked", "true");
      updateInspectorFromSelection();
    `);

    // Lock banner should be visible (advanced mode)
    const lockBanner = page.locator("#lockBanner");
    await expect(lockBanner).toBeVisible();

    // Block reason banner should NOT be visible (lock banner takes priority)
    const blockBanner = page.locator("#blockReasonBanner");
    await expect(blockBanner).toBeHidden();

    // Cleanup: unlock
    await evaluateEditor(page, `
      const unlockNode = state.modelDoc.querySelector('[data-editor-node-id="' + "${nodeId}" + '"]');
      if (unlockNode) unlockNode.removeAttribute("data-editor-locked");
    `);
  });

  test("summary card shows action-oriented copy per entity kind @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    const summary = page.locator("#selectedElementSummary");
    const summaryText = await summary.textContent();
    // Text element should mention double-click or edit action
    expect(summaryText).toMatch(/клик|печат|шрифт|цвет|размер|перемещ/i);
  });

  test("stack depth badge shows count when multiple candidates exist @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);

    // Click on an overlapping area — Slide 1 has overlap
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    // Get click-through candidate count
    const candidateCount = await evaluateEditor(page, `
      state.clickThroughState?.candidates?.length || 0
    `);

    const badge = page.locator("#stackDepthBadge");
    if (candidateCount > 1) {
      await expect(badge).toBeVisible();
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/\d+\/\d+/);
    } else {
      await expect(badge).toBeHidden();
    }
  });

  test("stack depth badge hidden when single candidate @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);

    // Click on a clearly non-overlapping element
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    // Force single candidate state
    await evaluateEditor(page, `
      state.clickThroughState = { x: 0, y: 0, timestamp: 0, index: -1, candidates: [] };
      renderSelectionBreadcrumbs(true);
    `);

    const badge = page.locator("#stackDepthBadge");
    await expect(badge).toBeHidden();
  });

  test("block banner disappears when block condition resolves @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");

    // Create zoom block
    await evaluateEditor(page, `setPreviewZoom(1.5, true)`);
    await evaluateEditor(page, `updateInspectorFromSelection()`);

    const banner = page.locator("#blockReasonBanner");
    await expect(banner).toBeVisible();

    // Resolve by resetting zoom
    await evaluateEditor(page, `setPreviewZoom(1.0, true)`);
    await evaluateEditor(page, `updateInspectorFromSelection()`);

    await expect(banner).toBeHidden();
  });

  test("export stays clean after block banner interactions @stage-f", async ({ page }) => {
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");

    // Trigger zoom block and banner
    await evaluateEditor(page, `setPreviewZoom(1.25, true)`);
    await evaluateEditor(page, `updateInspectorFromSelection()`);
    await evaluateEditor(page, `setPreviewZoom(1.0, true)`);

    // Export and check for editor artifacts
    const exportedHtml = await evaluateEditor(page, `
      (function() {
        const pack = buildCleanExportPackage();
        return pack ? pack.serialized : "";
      })()
    `);
    expect(exportedHtml).not.toContain("block-reason");
    expect(exportedHtml).not.toContain("stack-depth");
    expect(exportedHtml).not.toContain("data-editor-ui");
    expect(exportedHtml).not.toContain("data-block-action");
  });
});
