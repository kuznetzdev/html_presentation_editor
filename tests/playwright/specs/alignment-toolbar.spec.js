"use strict";

// v1.3.2 / Phase D2 — alignment toolbar coverage.

const { test, expect } = require("@playwright/test");
const {
  clickPreview,
  closeCompactShellPanels,
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
} = require("../helpers/editorApp");

async function loadDeck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
  await clickPreview(page, '[data-node-id="hero-title"]');
}

test.describe("Alignment toolbar — Phase D2", () => {
  test(
    "Toolbar mounts hidden by default @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await expect(page.locator("#alignmentToolbar")).toBeAttached();
      await expect(page.locator("#alignmentToolbar")).toBeHidden();
    },
  );

  test(
    "Toolbar surfaces when ≥ 2 nodes selected @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "selectAllOnSlide(); refreshMultiSelectAnchor();");
      await expect(page.locator("#alignmentToolbar")).toBeVisible();
    },
  );

  test(
    "Toolbar hides again on clearMultiSelect @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "selectAllOnSlide(); refreshMultiSelectAnchor();");
      await expect(page.locator("#alignmentToolbar")).toBeVisible();
      await evaluateEditor(page, "clearMultiSelect();");
      await expect(page.locator("#alignmentToolbar")).toBeHidden();
    },
  );

  test(
    "All 8 align/distribute buttons are present @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "selectAllOnSlide(); refreshMultiSelectAnchor();");
      await expect(
        page.locator("#alignmentToolbar [data-align-action]"),
      ).toHaveCount(8);
    },
  );

  test(
    "Distribute buttons are disabled when only 2 nodes selected @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "(() => { const ids = Array.from(state.modelDoc.querySelectorAll('[data-editor-node-id]')).filter(el => el.closest('[data-editor-slide-id]') && el.getAttribute('data-editor-entity-kind') !== 'slide-root').slice(0, 2).map(el => el.getAttribute('data-editor-node-id')); state.multiSelectNodeIds = ids; refreshMultiSelectAnchor(); })()",
      );
      await expect(
        page.locator(
          '#alignmentToolbar [data-align-action="distribute:horizontal"]',
        ),
      ).toBeDisabled();
      await expect(
        page.locator(
          '#alignmentToolbar [data-align-action="distribute:vertical"]',
        ),
      ).toBeDisabled();
    },
  );

  test(
    "alignSelection('left') changes left coords for all unlocked nodes @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Pick two nodes and prep them with concrete inline left.
      await evaluateEditor(
        page,
        "(() => { const nodes = Array.from(state.modelDoc.querySelectorAll('[data-editor-node-id]')).filter(el => el.closest('[data-editor-slide-id]') && el.getAttribute('data-editor-entity-kind') !== 'slide-root').slice(0, 2); nodes[0].style.left='40px'; nodes[0].style.top='10px'; nodes[0].style.width='100px'; nodes[0].style.height='100px'; nodes[1].style.left='220px'; nodes[1].style.top='10px'; nodes[1].style.width='80px'; nodes[1].style.height='100px'; state.multiSelectNodeIds = nodes.map(n => n.getAttribute('data-editor-node-id')); refreshMultiSelectAnchor(); })()",
      );
      const result = await evaluateEditor(page, "alignSelection('left')");
      expect(result).toBe(true);
      const lefts = await evaluateEditor(
        page,
        "state.multiSelectNodeIds.map(id => state.modelDoc.querySelector('[data-editor-node-id=\"' + id + '\"]').style.left)",
      );
      // Both should now be at the leftmost original (40px).
      expect(lefts.every((l) => l === "40px")).toBe(true);
    },
  );

  test(
    "alignSelection returns false with < 2 nodes @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "state.multiSelectNodeIds = ['only-one']");
      const r = await evaluateEditor(page, "alignSelection('right')");
      expect(r).toBe(false);
    },
  );

  test(
    "distributeSelection('horizontal') equalizes spacing for ≥ 3 nodes @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "(() => { const nodes = Array.from(state.modelDoc.querySelectorAll('[data-editor-node-id]')).filter(el => el.closest('[data-editor-slide-id]') && el.getAttribute('data-editor-entity-kind') !== 'slide-root').slice(0, 3); nodes.forEach((n, i) => { n.style.left = (i === 0 ? 0 : (i === 1 ? 50 : 400)) + 'px'; n.style.top = '0px'; n.style.width = '50px'; n.style.height = '50px'; }); state.multiSelectNodeIds = nodes.map(n => n.getAttribute('data-editor-node-id')); refreshMultiSelectAnchor(); })()",
      );
      const ok = await evaluateEditor(page, "distributeSelection('horizontal')");
      expect(ok).toBe(true);
      // Middle node should now be centered between 0+50=50 and 400 → at 225.
      const middleLeft = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.multiSelectNodeIds[1] + '\"]').style.left",
      );
      // Allow slight rounding; expected: span (450 - 0) - totalWidth (150) = 300 / 2 gaps = 150
      // Position: 0 + 50 + 150 = 200
      expect(["175px", "200px", "225px"]).toContain(middleLeft);
    },
  );

  test(
    "Ctrl+Shift+L triggers align:left @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "(() => { const nodes = Array.from(state.modelDoc.querySelectorAll('[data-editor-node-id]')).filter(el => el.closest('[data-editor-slide-id]') && el.getAttribute('data-editor-entity-kind') !== 'slide-root').slice(0, 2); nodes[0].style.left='10px'; nodes[1].style.left='90px'; state.multiSelectNodeIds = nodes.map(n => n.getAttribute('data-editor-node-id')); refreshMultiSelectAnchor(); })()",
      );
      await page.locator("body").focus();
      await page.keyboard.press("Control+Shift+L");
      const lefts = await evaluateEditor(
        page,
        "state.multiSelectNodeIds.map(id => state.modelDoc.querySelector('[data-editor-node-id=\"' + id + '\"]').style.left)",
      );
      expect(lefts.every((l) => l === "10px")).toBe(true);
    },
  );

  test(
    "Locked nodes are skipped in alignment moves @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "(() => { const nodes = Array.from(state.modelDoc.querySelectorAll('[data-editor-node-id]')).filter(el => el.closest('[data-editor-slide-id]') && el.getAttribute('data-editor-entity-kind') !== 'slide-root').slice(0, 2); nodes[0].style.left='10px'; nodes[1].style.left='90px'; nodes[1].setAttribute('data-editor-locked','true'); state.multiSelectNodeIds = nodes.map(n => n.getAttribute('data-editor-node-id')); refreshMultiSelectAnchor(); })()",
      );
      await evaluateEditor(page, "alignSelection('left')");
      const second = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.multiSelectNodeIds[1] + '\"]').style.left",
      );
      expect(second).toBe("90px"); // unchanged because locked
    },
  );
});
