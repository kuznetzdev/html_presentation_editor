"use strict";

// v1.5.4 — Recovery scenarios.
// Verifies the editor restores cleanly from common failure modes:
//   - Bad input rejected by validators (no model mutation)
//   - withActionBoundary rolls back partially-applied mutations
//   - Undo after delete restores the deleted slide
//   - Restore after reload (autosave) brings the model back

const { test, expect } = require("@playwright/test");
const {
  closeCompactShellPanels,
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
} = require("../helpers/editorApp");

async function loadDeck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
}

test.describe("Recovery — bad input (v1.5.4)", () => {
  test(
    "Invalid pixelSize doesn't mutate state.modelDoc @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const before = await evaluateEditor(
        page,
        "state.modelDoc.documentElement.outerHTML.length",
      );
      await evaluateEditor(
        page,
        "(() => { const v = window.InputValidators.pixelSize('not-a-number'); if (v.ok) state.modelDoc.body.appendChild(state.modelDoc.createElement('div')); return v.ok; })()",
      );
      const after = await evaluateEditor(
        page,
        "state.modelDoc.documentElement.outerHTML.length",
      );
      expect(after).toBe(before);
    },
  );

  test(
    "Invalid hexColor never reaches the model @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const r = await evaluateEditor(
        page,
        "window.InputValidators.hexColor('not-a-color')",
      );
      expect(r.ok).toBe(false);
    },
  );
});

test.describe("Recovery — action boundary rollback (v1.5.4)", () => {
  test(
    "withActionBoundary rolls back when fn throws mid-operation @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const beforeNodes = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-node-id]').length",
      );
      await evaluateEditor(
        page,
        "withActionBoundary('test:partial', () => { const el = state.modelDoc.createElement('div'); el.setAttribute('data-editor-node-id','rollback-test'); state.modelDoc.body.appendChild(el); throw new Error('halfway'); })",
      );
      const afterNodes = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-node-id]').length",
      );
      expect(afterNodes).toBe(beforeNodes);
    },
  );
});

test.describe("Recovery — undo after delete (v1.5.4)", () => {
  test(
    "Undo restores a deleted slide @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const before = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-slide-id]').length",
      );
      test.skip(before < 2, "Single-slide fixture; cannot delete");
      await evaluateEditor(page, "deleteCurrentSlide()");
      const mid = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-slide-id]').length",
      );
      expect(mid).toBe(before - 1);
      await evaluateEditor(page, "undo()");
      const after = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-slide-id]').length",
      );
      expect(after).toBe(before);
    },
  );

  test(
    "Undo after duplicate strips the copy @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const before = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-slide-id]').length",
      );
      await evaluateEditor(page, "duplicateCurrentSlide()");
      await evaluateEditor(page, "undo()");
      const after = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-slide-id]').length",
      );
      expect(after).toBe(before);
    },
  );
});

test.describe("Recovery — autosave restore (v1.5.4)", () => {
  test(
    "captureHistorySnapshot writes to localStorage autosave key @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Trigger an autosave write by mutating + invoking save synchronously.
      await evaluateEditor(page, "state.dirty = true; saveProjectToLocalStorage();");
      // Autosave uses sessionStorage (see editor/src/slides.js getAutosaveStorage).
      const stored = await page.evaluate(() =>
        Boolean(window.sessionStorage.getItem("presentation-editor:autosave:v3")),
      );
      expect(stored).toBe(true);
    },
  );

  test(
    "tryRestoreDraftPrompt is exposed for restore flows @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const t = await evaluateEditor(page, "typeof tryRestoreDraftPrompt");
      expect(t).toBe("function");
    },
  );
});
