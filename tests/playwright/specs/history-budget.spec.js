/**
 * tests/playwright/specs/history-budget.spec.js
 *
 * Gate-B Playwright tests for WO-18 history budget chip + overflow toast.
 *
 * Test (A) — 15 unique snapshots: chip shows "15/20" with .is-warning class.
 * Test (B) — 21 unique snapshots: chip shows "20/20" with .is-danger class
 *             and the overflow toast with "Старейший шаг истории сброшен."
 *             is visible at least once during the run.
 *
 * Strategy: after loading a deck, we inject unique HTML mutations via
 * evaluateEditor to force distinct hashes, then call captureHistorySnapshot
 * directly.  The chip is updated synchronously by the store subscriber in
 * primary-action.js, so no extra wait is needed after the snapshots.
 */
"use strict";

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
} = require("../helpers/editorApp");

// ---------------------------------------------------------------------------
// Helper: inject N unique history snapshots.
// Each call appends a unique comment node to make the serialised HTML differ.
// ---------------------------------------------------------------------------
async function injectNSnapshots(page, n) {
  await page.evaluate(async (count) => {
    for (let i = 0; i < count; i++) {
      // Stamp a unique comment into the body so the serialiser sees distinct HTML
      const marker = window.document.createComment("__hist-snap-" + i + "-" + Date.now());
      state.modelDoc.body.appendChild(marker);
      // Remove it after capture so the next iteration creates a different hash
      captureHistorySnapshot("playwright-budget-test-" + i, { force: true });
      state.modelDoc.body.removeChild(marker);
      // Yield to the microtask queue between batches
      await new Promise((r) => queueMicrotask(r));
    }
  }, n);
}

// ---------------------------------------------------------------------------
// (A) 15 snapshots → chip visible, text "15/20", class is-warning
// ---------------------------------------------------------------------------
test("(A) history budget chip shows 15/20 with is-warning after 15 snapshots @gate-b", async ({
  page,
}) => {
  await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

  await injectNSnapshots(page, 15);

  // Wait for the store subscriber to propagate (microtask / rAF)
  await page.waitForFunction(() => {
    const chip = document.getElementById("historyBudgetChip");
    return chip && !chip.hidden;
  });

  const chip = page.locator("#historyBudgetChip");
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText("15/20");
  await expect(chip).toHaveClass(/is-warning/);
});

// ---------------------------------------------------------------------------
// (B) 21 snapshots → overflow toast fires, chip ends at "20/20" with is-danger
// ---------------------------------------------------------------------------
test("(B) overflow toast fires after 21 snapshots, chip shows 20/20 is-danger @gate-b", async ({
  page,
}) => {
  await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

  // Capture 20 snapshots first (no overflow yet)
  await injectNSnapshots(page, 20);

  // On the 21st snapshot, HISTORY_LIMIT (20) is exceeded → toast must appear
  // We watch the container BEFORE the 21st snapshot so we catch the element.
  const toastContainerLocator = page.locator("#toastContainer");

  // Trigger the overflow snapshot
  await injectNSnapshots(page, 1);

  // Toast with the exact Russian text must appear within 3 s
  await expect(
    toastContainerLocator.locator(
      "text=Старейший шаг истории сброшен. Сохрани проект, чтобы не потерять работу.",
    ),
  ).toBeVisible({ timeout: 3000 });

  // After overflow the oldest entry is dropped — patches.length stays at 20
  await page.waitForFunction(() => {
    const chip = document.getElementById("historyBudgetChip");
    return chip && chip.textContent === "20/20";
  });

  const chip = page.locator("#historyBudgetChip");
  await expect(chip).toBeVisible();
  await expect(chip).toHaveText("20/20");
  await expect(chip).toHaveClass(/is-danger/);
});
