// tests/playwright/specs/transform-resolve.spec.js
// [WO-26] Transform resolve banner: transform input + resolve action
// Gate: gate-b (Playwright functional spec)
// PAIN-MAP: P0-06 — dead-end on transform-family block reasons

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  clickPreview,
  closeCompactShellPanels,
  ensureShellPanelVisible,
  evaluateEditor,
  loadBasicDeck,
} = require("../helpers/editorApp");

test.describe("WO-26 — transform resolve banner and inspector input", () => {
  test.beforeEach(async ({ page }) => {
    await loadBasicDeck(page, {
      manualBaseUrl: BASIC_MANUAL_BASE_URL,
      mode: "edit",
    });
    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await ensureShellPanelVisible(page, "inspector");
  });

  // ── AC1: Banner shows "Открыть инспектор" for transform reason ──────────
  test("block banner shows 'Открыть инспектор' for own-transform reason @stage-f", async ({ page }) => {
    // Inject inline transform and set manipulationContext to simulate block
    await evaluateEditor(
      page,
      `(() => {
        const nodeId = state.selectedNodeId;
        if (!nodeId || !state.modelDoc) throw new Error("selection-missing");
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
        if (!(node instanceof HTMLElement)) throw new Error("node-missing");
        node.style.transform = "rotate(5deg)";
        state.manipulationContext = {
          directManipulationSafe: false,
          directManipulationReason: "own transform",
        };
        updateInspectorFromSelection();
      })()`,
    );

    await expect(page.locator("#blockReasonBanner")).toBeVisible();
    await expect(page.locator("#blockReasonActionBtn")).toBeVisible();
    await expect(page.locator("#blockReasonActionBtn")).toContainText("Открыть инспектор");
  });

  // ── AC2: Clicking action sets advanced mode and focuses transform input ──
  test("resolve-transform action switches to advanced and focuses #transformInput @stage-f", async ({ page }) => {
    // Start in basic mode
    await evaluateEditor(
      page,
      `(() => {
        const nodeId = state.selectedNodeId;
        if (!nodeId || !state.modelDoc) throw new Error("selection-missing");
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
        if (!(node instanceof HTMLElement)) throw new Error("node-missing");
        node.style.transform = "rotate(5deg)";
        state.manipulationContext = {
          directManipulationSafe: false,
          directManipulationReason: "собственный own transform",
        };
        state.complexityMode = "basic";
        applyComplexityModeUi();
        updateInspectorFromSelection();
      })()`,
    );

    await expect(page.locator("#blockReasonActionBtn")).toBeVisible();
    await page.locator("#blockReasonActionBtn").click();

    // Complexity must have switched to advanced
    await expect
      .poll(() =>
        evaluateEditor(page, "state.complexityMode"),
      )
      .toBe("advanced");

    // #transformInput must exist and become focused within 500ms
    await expect
      .poll(
        () => page.evaluate(() => document.activeElement?.id),
        { timeout: 500, intervals: [50] },
      )
      .toBe("transformInput");
  });

  // ── AC3: Write-through — typing a valid transform mutates the element ────
  test("typing rotate(10deg) in transform input mutates element inline style @stage-f", async ({ page }) => {
    // Set inline transform so inspector shows it
    await evaluateEditor(
      page,
      `(() => {
        const nodeId = state.selectedNodeId;
        if (!nodeId || !state.modelDoc) throw new Error("selection-missing");
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
        if (!(node instanceof HTMLElement)) throw new Error("node-missing");
        node.style.transform = "rotate(5deg)";
        state.manipulationContext = {
          directManipulationSafe: false,
          directManipulationReason: "own transform",
        };
        // Switch to advanced so the input is visible
        state.complexityMode = "advanced";
        applyComplexityModeUi();
        updateInspectorFromSelection();
      })()`,
    );

    const input = page.locator("#transformInput");
    await expect(input).toBeVisible();

    await input.fill("rotate(10deg)");
    await input.press("Tab"); // trigger blur/change

    // After applying, verify the modelDoc node has the new transform
    await expect
      .poll(() =>
        evaluateEditor(
          page,
          `(() => {
            const nodeId = state.selectedNodeId;
            if (!nodeId || !state.modelDoc) return null;
            const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
            return node instanceof HTMLElement ? node.style.transform : null;
          })()`,
        ),
        { timeout: 3000 },
      )
      .toBe("rotate(10deg)");
  });

  // ── AC4: Reset button clears style.transform ─────────────────────────────
  test("#resetTransformBtn clears inline transform @stage-f", async ({ page }) => {
    await evaluateEditor(
      page,
      `(() => {
        const nodeId = state.selectedNodeId;
        if (!nodeId || !state.modelDoc) throw new Error("selection-missing");
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
        if (!(node instanceof HTMLElement)) throw new Error("node-missing");
        node.style.transform = "rotate(5deg)";
        state.manipulationContext = {
          directManipulationSafe: false,
          directManipulationReason: "own transform",
        };
        state.complexityMode = "advanced";
        applyComplexityModeUi();
        updateInspectorFromSelection();
      })()`,
    );

    const resetBtn = page.locator("#resetTransformBtn");
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toBeEnabled();

    await resetBtn.click();

    await expect
      .poll(() =>
        evaluateEditor(
          page,
          `(() => {
            const nodeId = state.selectedNodeId;
            if (!nodeId || !state.modelDoc) return null;
            const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
            return node instanceof HTMLElement ? node.style.transform : null;
          })()`,
        ),
        { timeout: 3000 },
      )
      .toBe("");
  });

  // ── AC5: Invalid transform is rejected and shows toast ───────────────────
  test("invalid transform string is rejected and element is unchanged @stage-f", async ({ page }) => {
    await evaluateEditor(
      page,
      `(() => {
        const nodeId = state.selectedNodeId;
        if (!nodeId || !state.modelDoc) throw new Error("selection-missing");
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
        if (!(node instanceof HTMLElement)) throw new Error("node-missing");
        node.style.transform = "rotate(5deg)";
        state.manipulationContext = {
          directManipulationSafe: false,
          directManipulationReason: "own transform",
        };
        state.complexityMode = "advanced";
        applyComplexityModeUi();
        updateInspectorFromSelection();
      })()`,
    );

    const input = page.locator("#transformInput");
    await expect(input).toBeVisible();

    // Enter an invalid transform
    await input.fill("abc");
    await input.press("Tab");

    // Element must NOT have been mutated
    const transform = await evaluateEditor(
      page,
      `(() => {
        const nodeId = state.selectedNodeId;
        if (!nodeId || !state.modelDoc) return null;
        const node = state.modelDoc.querySelector('[data-editor-node-id="' + nodeId + '"]');
        return node instanceof HTMLElement ? node.style.transform : null;
      })()`,
    );
    // The original value should be preserved (either "rotate(5deg)" or the input reset to it)
    expect(transform).toBe("rotate(5deg)");

    // A toast should appear with the error message
    await expect(page.locator(".toast, [role='alert']").first()).toBeVisible({ timeout: 2000 });
  });
});
