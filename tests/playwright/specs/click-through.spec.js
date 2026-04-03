/**
 * Click-Through Layer Selection — e2e tests (v0.16.0)
 *
 * Covers:
 *  CT1 Repeated plain click at same point cycles through overlapping candidates.
 *  CT2 Click at a different point resets the cycling index.
 *  CT3 Escape resets click-through to the topmost candidate.
 *  CT4 Context menu shows numbered layer list with ≥2 candidates.
 *  CT5 Selecting a layer from context menu changes selection.
 *  CT6 Export remains clean (no click-through state leaks).
 *
 * Reference deck: v1-absolute-positioned (slide 2 — three overlapping .card elements).
 */

"use strict";

const { test, expect } = require("@playwright/test");
const {
  closeCompactShellPanels,
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
  openExportValidationPopup,
  previewLocator,
} = require("../helpers/editorApp");

// ─── helpers ──────────────────────────────────────────────────────────────────

async function waitForNodeId(page, nodeId, timeout = 6_000) {
  await expect
    .poll(
      () => evaluateEditor(page, "state.selectedNodeId || ''"),
      { timeout },
    )
    .toBe(nodeId);
}

async function waitForAnySelection(page, timeout = 6_000) {
  await expect
    .poll(
      () => evaluateEditor(page, "state.selectedNodeId || ''"),
      { timeout },
    )
    .toBeTruthy();
}

async function waitForSelectionChange(page, prev, timeout = 6_000) {
  await expect
    .poll(
      () => evaluateEditor(page, "state.selectedNodeId || ''"),
      { timeout },
    )
    .not.toBe(prev);
}

async function loadOverlapDeck(page) {
  await loadReferenceDeck(page, "v1-absolute-positioned", { mode: "edit" });
  await closeCompactShellPanels(page);
  await evaluateEditor(
    page,
    "requestSlideActivation(state.slides[Math.min(1, state.slides.length - 1)]?.id, { reason: 'test' })",
  );
  await expect
    .poll(() => evaluateEditor(page, "state.activeSlideId || ''"))
    .toBeTruthy();
}

/** Click the middle overlapping card inside the iframe (Slide 2, card index 4 — "Элемент 2"). */
function overlapCard(page) {
  return previewLocator(page, ".slide:nth-child(2) .card:nth-child(2)");
}

/** Click the first card on Slide 2 in a non-overlapping zone (top-left corner). */
function isolatedCard(page) {
  return previewLocator(page, ".slide:nth-child(2) .card:nth-child(1)");
}

// ─── CT1: Repeated click cycles through candidates ────────────────────────────

test.describe("CT1 — Repeated click cycles through overlapping candidates", () => {
  test(
    "clicking same card twice selects a different candidate @stage-m",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadOverlapDeck(page);

      // First click on the middle overlapping card
      await overlapCard(page).click({ force: true });
      await waitForAnySelection(page);
      const firstNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");
      expect(firstNodeId).toBeTruthy();

      // Second click at the same card — click-through should cycle
      await overlapCard(page).click({ force: true });
      await waitForSelectionChange(page, firstNodeId);
      const secondNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");
      expect(secondNodeId).toBeTruthy();
      expect(secondNodeId).not.toBe(firstNodeId);
    },
  );
});

// ─── CT2: Click at different point resets cycling ─────────────────────────────

test.describe("CT2 — Different point resets cycle", () => {
  test(
    "clicking elsewhere then back starts from topmost again @stage-m",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadOverlapDeck(page);

      // First click
      await overlapCard(page).click({ force: true });
      await waitForAnySelection(page);
      const firstNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");

      // Second click — cycle
      await overlapCard(page).click({ force: true });
      await waitForSelectionChange(page, firstNodeId);

      // Click somewhere else entirely — card 1 on slide 2, non-overlapping corner
      await isolatedCard(page).click({
        force: true,
        position: { x: 10, y: 10 },
      });
      await waitForAnySelection(page);

      // Click back at the overlap card — should start from topmost again
      await overlapCard(page).click({ force: true });
      await waitForAnySelection(page);
      const resetNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");
      expect(resetNodeId).toBe(firstNodeId);
    },
  );
});

// ─── CT3: Escape resets to topmost candidate ──────────────────────────────────

test.describe("CT3 — Escape resets click-through to topmost", () => {
  test(
    "Escape after cycling returns to the first candidate @stage-m",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadOverlapDeck(page);

      // First click
      await overlapCard(page).click({ force: true });
      await waitForAnySelection(page);
      const firstNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");

      // Second click — cycle
      await overlapCard(page).click({ force: true });
      await waitForSelectionChange(page, firstNodeId);

      // Escape from the shell overlay resets to topmost
      await page.keyboard.press("Escape");
      await waitForNodeId(page, firstNodeId);
    },
  );
});

// ─── CT4: Context menu shows numbered layer list ──────────────────────────────

test.describe("CT4 — Context menu layer list", () => {
  test(
    "right-click at overlap shows numbered layer items @stage-m",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadOverlapDeck(page);

      const card = overlapCard(page);
      await expect(card).toBeVisible({ timeout: 4000 });
      await card.click({ button: "right", force: true });
      await expect(page.locator("#contextMenu")).toHaveClass(/is-open/);

      const layerItems = page.locator("#contextMenu [data-layer-node-id]");
      const count = await layerItems.count();
      expect(count).toBeGreaterThanOrEqual(2);

      const firstLabel = await layerItems.first().locator(".menu-label").textContent();
      expect(firstLabel).toMatch(/^1\.\s/);
      const secondLabel = await layerItems.nth(1).locator(".menu-label").textContent();
      expect(secondLabel).toMatch(/^2\.\s/);
    },
  );
});

// ─── CT5: Select layer from context menu ──────────────────────────────────────

test.describe("CT5 — Context menu layer selection changes node", () => {
  test(
    "clicking a lower layer item selects that exact node @stage-m",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadOverlapDeck(page);

      const card = overlapCard(page);
      await expect(card).toBeVisible({ timeout: 4000 });
      await card.click({ button: "right", force: true });
      await expect(page.locator("#contextMenu")).toHaveClass(/is-open/);

      const layerItems = page.locator("#contextMenu [data-layer-node-id]");
      await expect(layerItems).toHaveCount(4);

      const targetItem = layerItems.nth(1);
      const targetNodeId = await targetItem.getAttribute("data-layer-node-id");
      expect(targetNodeId).toBeTruthy();

      await targetItem.click();
      await expect(page.locator("#contextMenu")).not.toHaveClass(/is-open/);
      await waitForNodeId(page, targetNodeId);
    },
  );
});

// ─── CT6: Export cleanliness ──────────────────────────────────────────────────

test.describe("CT6 — Export does not leak click-through state", () => {
  test(
    "exported HTML contains no editor data attributes @stage-m",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadOverlapDeck(page);

      // Exercise click-through
      await overlapCard(page).click({ force: true });
      await waitForAnySelection(page);
      await overlapCard(page).click({ force: true });

      await openExportValidationPopup(page);
      const html = await evaluateEditor(
        page,
        "(function () { var t = document.querySelector('#exportArea'); return t ? t.value || t.textContent : ''; })()",
      );
      expect(html).not.toContain("data-editor-highlight");
      expect(html).not.toContain("data-editor-selected");
      expect(html).not.toContain("data-editor-hover");
      expect(html).not.toContain("data-editor-node-id");
    },
  );
});
