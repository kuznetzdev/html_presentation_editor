"use strict";

// v2.0.11 — Empty-state guidance card inside #insertSection.
//
// When the user has loaded a deck in edit mode but hasn't selected
// anything yet, the only inspector card visible is "Вставка" with
// four "add new" buttons. Without guidance, users wonder how to
// edit elements that are already on the slide. The new
// .inspector-empty-hint card answers that.

const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
  closeCompactShellPanels,
} = require("../helpers/editorApp");

test.describe("Inspector empty-state guidance hint (v2.0.11)", () => {
  test(
    "Empty hint card is in the DOM @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
      await closeCompactShellPanels(page);
      const present = await evaluateEditor(
        page,
        "Boolean(document.getElementById('insertEmptyHint'))",
      );
      expect(present).toBe(true);
    },
  );

  test(
    "Empty hint contains the title 'Хотите изменить' @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
      await closeCompactShellPanels(page);
      const titleText = await evaluateEditor(
        page,
        "document.querySelector('#insertEmptyHint .inspector-empty-hint-title').textContent.trim()",
      );
      expect(titleText).toContain("Хотите изменить");
    },
  );

  test(
    "Empty hint lists four guidance items @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
      await closeCompactShellPanels(page);
      const itemCount = await evaluateEditor(
        page,
        "document.querySelectorAll('#insertEmptyHint .inspector-empty-hint-list > li').length",
      );
      expect(itemCount).toBe(4);
    },
  );

  test(
    "Empty hint mentions the ? help shortcut @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
      await closeCompactShellPanels(page);
      const hasKbd = await evaluateEditor(
        page,
        "Array.from(document.querySelectorAll('#insertEmptyHint kbd')).some((k) => k.textContent.trim() === '?')",
      );
      expect(hasKbd).toBe(true);
    },
  );

  test(
    "Empty hint is hidden when an element is selected @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
      await closeCompactShellPanels(page);
      // Select via direct evaluation to skip click race.
      await evaluateEditor(
        page,
        "(() => { const el = state.modelDoc.querySelector('[data-node-id=\"hero-title\"]'); if (el) sendToBridge('select-element', { nodeId: el.getAttribute('data-editor-node-id') }); })()",
      );
      // Inspector workflow updates after selection: insertSection
      // becomes hidden, so the hint inside it is also hidden.
      await expect.poll(
        () =>
          page.evaluate(() =>
            Boolean(document.getElementById("insertSection")?.hidden),
          ),
        { timeout: 4000 },
      ).toBe(true);
    },
  );
});
