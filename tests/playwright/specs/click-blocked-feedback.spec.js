"use strict";

// v2.0.8 — Click-blocked feedback toast.
//
// When the user clicks on the preview iframe and the click resolves to
// nothing (target is locked or protected), bridge-script posts a
// 'click-blocked' message to the shell, which renders a contextual toast
// explaining WHY the click did nothing. Previously the click silently
// fell through to the parent walk and the editor felt broken.

const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
  closeCompactShellPanels,
  clickPreview,
} = require("../helpers/editorApp");

async function loadDeck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
  await clickPreview(page, '[data-node-id="hero-title"]');
  // Switch to advanced so the lock buttons are reachable.
  await evaluateEditor(page, "setComplexityMode('advanced')");
  await expect.poll(() => evaluateEditor(page, "state.complexityMode")).toBe("advanced");
}

test.describe("Click-blocked feedback (v2.0.8)", () => {
  test(
    "applyClickBlockedFromBridge is exposed on window @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const exposed = await evaluateEditor(
        page,
        "typeof window.applyClickBlockedFromBridge === 'function'",
      );
      expect(exposed).toBe(true);
    },
  );

  test(
    "Locked reason renders 'Слой заблокирован' toast with explanation @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Invoke the receiver directly with a synthetic payload — exercises
      // the same code path the bridge uses without needing a locked node
      // in the fixture.
      await evaluateEditor(
        page,
        "applyClickBlockedFromBridge({ reason: 'locked', nodeId: 'node-fake' })",
      );
      await expect(
        page.locator(".toast", { hasText: "Снимите блок" }),
      ).toBeVisible({ timeout: 3000 });
    },
  );

  test(
    "Protected reason renders 'Защищённый блок' toast @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "applyClickBlockedFromBridge({ reason: 'protected', nodeId: 'node-fake' })",
      );
      await expect(
        page.locator(".toast", { hasText: "Защищённый блок" }),
      ).toBeVisible({ timeout: 3000 });
    },
  );

  test(
    "Unknown reason falls back to neutral 'Клик не выбрал элемент' toast @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "applyClickBlockedFromBridge({ reason: 'mystery', nodeId: 'node-fake' })",
      );
      await expect(
        page.locator(".toast", { hasText: "Цель клика не доступна" }),
      ).toBeVisible({ timeout: 3000 });
    },
  );

  test(
    "Empty reason is a no-op (no toast spawned) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const before = await page.locator(".toast").count();
      await evaluateEditor(
        page,
        "applyClickBlockedFromBridge({ reason: '', nodeId: '' })",
      );
      // Settle briefly to confirm no toast appeared.
      await page.waitForTimeout(300);
      const after = await page.locator(".toast").count();
      expect(after).toBe(before);
    },
  );

  test(
    "Identical (reason, nodeId) is throttled within 1500ms @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // First call shows a toast.
      await evaluateEditor(
        page,
        "applyClickBlockedFromBridge({ reason: 'locked', nodeId: 'node-x' })",
      );
      await expect(
        page.locator(".toast", { hasText: "Снимите блок" }),
      ).toBeVisible({ timeout: 3000 });
      const firstCount = await page.locator(".toast", { hasText: "Снимите блок" }).count();
      // Immediate second call with the same payload — should be swallowed.
      await evaluateEditor(
        page,
        "applyClickBlockedFromBridge({ reason: 'locked', nodeId: 'node-x' })",
      );
      await page.waitForTimeout(200);
      const secondCount = await page.locator(".toast", { hasText: "Снимите блок" }).count();
      // Throttled: same payload within 1.5s should NOT spawn a second toast.
      expect(secondCount).toBe(firstCount);
    },
  );
});
