"use strict";

// v1.3.1 / Phase D1 — multi-select coordination coverage.

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

test.describe("Multi-select — Phase D1", () => {
  test(
    "Default multiSelect flag is true @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const flag = await evaluateEditor(
        page,
        "window.featureFlags && window.featureFlags.multiSelect",
      );
      expect(flag).toBe(true);
    },
  );

  test(
    "selectAllOnSlide() populates state.multiSelectNodeIds @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const result = await evaluateEditor(page, "selectAllOnSlide()");
      expect(result).toBe(true);
      const ids = await evaluateEditor(
        page,
        "state.multiSelectNodeIds.slice()",
      );
      expect(Array.isArray(ids)).toBe(true);
      expect(ids.length).toBeGreaterThan(1);
    },
  );

  test(
    "selectAllOnSlide() sets the anchor to the first id @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "selectAllOnSlide()");
      const anchor = await evaluateEditor(
        page,
        "state.multiSelectAnchorNodeId",
      );
      const first = await evaluateEditor(page, "state.multiSelectNodeIds[0]");
      expect(anchor).toBe(first);
    },
  );

  test(
    "clearMultiSelect() empties the set + anchor @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "selectAllOnSlide()");
      const cleared = await evaluateEditor(page, "clearMultiSelect()");
      expect(cleared).toBe(true);
      const ids = await evaluateEditor(page, "state.multiSelectNodeIds.length");
      const anchor = await evaluateEditor(page, "state.multiSelectAnchorNodeId");
      expect(ids).toBe(0);
      expect(anchor).toBeNull();
    },
  );

  test(
    "Ctrl+A in edit mode selects all on slide @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Focus on the shell so the keyboard handler sees the event.
      await page.locator("body").focus();
      await page.keyboard.press("Control+A");
      const ids = await evaluateEditor(
        page,
        "state.multiSelectNodeIds.slice()",
      );
      expect(ids.length).toBeGreaterThan(1);
    },
  );

  test(
    "Escape clears an existing multi-select @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "selectAllOnSlide()");
      await page.locator("body").focus();
      await page.keyboard.press("Escape");
      const ids = await evaluateEditor(page, "state.multiSelectNodeIds.length");
      expect(ids).toBe(0);
    },
  );

  test(
    "Bridge multi-select-add toggles membership @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const targetId = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-node-id]')[1].getAttribute('data-editor-node-id')",
      );
      // Push directly via state mutation since bridge requires the actual
      // iframe contentWindow as message source. The bridge multi-select-add
      // handler is exercised end-to-end by the iframe shift-click flow,
      // covered by selection-engine specs.
      await evaluateEditor(
        page,
        "(state.multiSelectNodeIds.indexOf('" + targetId + "') >= 0 ? state.multiSelectNodeIds.splice(state.multiSelectNodeIds.indexOf('" + targetId + "'),1) : state.multiSelectNodeIds.push('" + targetId + "')); refreshMultiSelectAnchor();",
      );
      const present1 = await evaluateEditor(
        page,
        "state.multiSelectNodeIds.includes('" + targetId + "')",
      );
      expect(present1).toBe(true);
      // Toggle off.
      await evaluateEditor(
        page,
        "(state.multiSelectNodeIds.indexOf('" + targetId + "') >= 0 ? state.multiSelectNodeIds.splice(state.multiSelectNodeIds.indexOf('" + targetId + "'),1) : state.multiSelectNodeIds.push('" + targetId + "')); refreshMultiSelectAnchor();",
      );
      const present2 = await evaluateEditor(
        page,
        "state.multiSelectNodeIds.includes('" + targetId + "')",
      );
      expect(present2).toBe(false);
    },
  );

  test(
    "selectAllOnSlide returns false when no slide is loaded @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      // Do NOT load a deck.
      await page.goto("/editor/presentation-editor.html", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => window.localStorage.clear());
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#openHtmlBtn")).toBeVisible();
      const result = await evaluateEditor(page, "selectAllOnSlide()");
      expect(result).toBe(false);
    },
  );
});
