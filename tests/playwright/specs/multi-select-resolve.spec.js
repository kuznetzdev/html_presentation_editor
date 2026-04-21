// tests/playwright/specs/multi-select-resolve.spec.js
// [WO-31] Shift-click multi-select limbo resolve — P1-03 honesty toast
// Gate: gate-b (Playwright functional spec)
// PAIN-MAP: P1-03 — basic-mode shift-click was silent

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  clickPreview,
  closeCompactShellPanels,
  evaluateEditor,
  loadBasicDeck,
} = require("../helpers/editorApp");

test.describe("WO-31 — shift-click multi-select honesty toast (P1-03)", () => {
  test.beforeEach(async ({ page }) => {
    await loadBasicDeck(page, {
      manualBaseUrl: BASIC_MANUAL_BASE_URL,
      mode: "edit",
    });
    await closeCompactShellPanels(page);
    // Ensure basic mode and clear sessionStorage flag before each test
    await evaluateEditor(
      page,
      `(() => {
        state.complexityMode = "basic";
        applyComplexityModeUi();
        sessionStorage.removeItem("editor:multi-select-toast-shown");
      })()`,
    );
  });

  // ── AC1: Basic mode shift-click shows honesty toast (first time) ──────────
  test("basic mode: shift-click shows honesty toast on first shift-click @stage-f", async ({ page }) => {
    // First click selects the first element
    await clickPreview(page, "#hero-title");

    // Shift+click on a second element — triggers multi-select-add in basic mode
    await clickPreview(page, "#hero-kicker", { modifiers: ["Shift"] });

    const toast = page.locator(".toast").filter({
      hasText: "Мульти-выбор — в разработке",
    });
    await expect(toast).toBeVisible({ timeout: 3000 });
  });

  // ── AC2: Basic mode second shift-click does NOT show second toast ─────────
  test("basic mode: second shift-click in same session shows no second toast @stage-f", async ({ page }) => {
    await clickPreview(page, "#hero-title");

    // First shift-click — toast appears
    await clickPreview(page, "#hero-kicker", { modifiers: ["Shift"] });
    const toast = page.locator(".toast").filter({
      hasText: "Мульти-выбор — в разработке",
    });
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Wait for first toast to dismiss
    await expect(toast).toBeHidden({ timeout: 8000 });

    // Second shift-click — no new toast
    await clickPreview(page, "#cta-box", { modifiers: ["Shift"] });

    // Count toasts with that text — must remain 0
    await expect(
      page.locator(".toast").filter({ hasText: "Мульти-выбор — в разработке" }),
    ).toHaveCount(0, { timeout: 2000 });
  });

  // ── AC3: Basic mode shift-click does NOT push to multiSelectNodeIds ───────
  test("basic mode: shift-click does NOT mutate multiSelectNodeIds @stage-f", async ({ page }) => {
    await clickPreview(page, "#hero-title");
    await clickPreview(page, "#hero-kicker", { modifiers: ["Shift"] });

    const ids = await evaluateEditor(page, "state.multiSelectNodeIds");
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toHaveLength(0);
  });

  // ── AC4: Advanced mode shift-click does NOT show toast ────────────────────
  test("advanced mode: shift-click does NOT show toast @stage-f", async ({ page }) => {
    // Switch to advanced mode
    await evaluateEditor(
      page,
      `(() => {
        state.complexityMode = "advanced";
        applyComplexityModeUi();
        sessionStorage.removeItem("editor:multi-select-toast-shown");
      })()`,
    );

    await clickPreview(page, "#hero-title");
    await clickPreview(page, "#hero-kicker", { modifiers: ["Shift"] });

    // No "Мульти-выбор" toast should appear
    await expect(
      page.locator(".toast").filter({ hasText: "Мульти-выбор — в разработке" }),
    ).toHaveCount(0, { timeout: 2000 });
  });

  // ── AC5: Advanced mode shift-click pushes to multiSelectNodeIds ───────────
  test("advanced mode: shift-click accumulates nodeIds in multiSelectNodeIds @stage-f", async ({ page }) => {
    await evaluateEditor(
      page,
      `(() => {
        state.complexityMode = "advanced";
        applyComplexityModeUi();
        state.multiSelectNodeIds = [];
      })()`,
    );

    await clickPreview(page, "#hero-title");
    await clickPreview(page, "#hero-kicker", { modifiers: ["Shift"] });

    const ids = await evaluateEditor(page, "state.multiSelectNodeIds");
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBeGreaterThanOrEqual(1);
  });

  // ── AC6: sessionStorage flag is cleared on new deck load ─────────────────
  test("sessionStorage toast flag is cleared by resetRuntimeState on new deck load @stage-f", async ({ page }) => {
    // Simulate flag already set
    await evaluateEditor(
      page,
      `sessionStorage.setItem("editor:multi-select-toast-shown", "1")`,
    );

    // Reload the deck (triggers resetRuntimeState → clears the flag)
    await evaluateEditor(
      page,
      `(() => {
        // resetRuntimeState is called inside loadHtmlString — simulate it directly
        resetRuntimeState();
      })()`,
    );

    const flagValue = await evaluateEditor(
      page,
      `sessionStorage.getItem("editor:multi-select-toast-shown")`,
    );
    expect(flagValue).toBeNull();
  });
});
