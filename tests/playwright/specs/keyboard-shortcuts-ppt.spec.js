"use strict";

// v1.3.4 / Phase D4 — PPT-style keyboard shortcuts coverage.

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

test.describe("PPT-style shortcuts — Phase D4", () => {
  test(
    "Ctrl+G is registered with handler @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const has = await evaluateEditor(
        page,
        "window.KEYBINDINGS.some(b => b.id === 'group' && typeof b.handler === 'function')",
      );
      expect(has).toBe(true);
    },
  );

  test(
    "Ctrl+Shift+G is registered for ungroup @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const has = await evaluateEditor(
        page,
        "window.KEYBINDINGS.some(b => b.id === 'ungroup' && typeof b.handler === 'function')",
      );
      expect(has).toBe(true);
    },
  );

  test(
    "Ctrl+Shift+ArrowUp registered for bring-forward @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const has = await evaluateEditor(
        page,
        "window.KEYBINDINGS.some(b => b.id === 'bring-forward')",
      );
      expect(has).toBe(true);
    },
  );

  test(
    "Ctrl+Shift+ArrowDown registered for send-backward @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const has = await evaluateEditor(
        page,
        "window.KEYBINDINGS.some(b => b.id === 'send-backward')",
      );
      expect(has).toBe(true);
    },
  );

  test(
    "Shift+Arrow nudge uses 10px step @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const fastStep = await evaluateEditor(
        page,
        "DIRECT_MANIP_NUDGE_FAST_PX",
      );
      expect(fastStep).toBe(10);
      const slowStep = await evaluateEditor(page, "DIRECT_MANIP_NUDGE_PX");
      expect(slowStep).toBe(1);
    },
  );

  test(
    "Ctrl+G triggers groupSelectedElements when 2+ selected @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Set up multi-select with 2 nodes inside the same parent.
      const setupOk = await evaluateEditor(
        page,
        "(() => { const slide = state.modelDoc.querySelector('[data-editor-slide-id]'); const candidates = Array.from(slide.querySelectorAll('[data-editor-node-id]')).filter(el => el.parentElement && el.parentElement.querySelectorAll('[data-editor-node-id]').length >= 2); if (candidates.length < 2) return false; const parent = candidates[0].parentElement; const sibs = Array.from(parent.querySelectorAll(':scope > [data-editor-node-id]')).slice(0, 2); state.multiSelectNodeIds = sibs.map(s => s.getAttribute('data-editor-node-id')); state.activeSlideId = slide.getAttribute('data-editor-slide-id'); return true; })()",
      );
      test.skip(!setupOk, "No 2 sibling editor nodes available in fixture");
      const before = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('.editor-group').length",
      );
      await page.locator("body").focus();
      await page.keyboard.press("Control+G");
      const after = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('.editor-group').length",
      );
      expect(after).toBe(before + 1);
    },
  );

  test(
    "Shortcuts modal includes the new bindings @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Trigger the shortcuts modal render.
      await evaluateEditor(page, "renderShortcutsModalFromKeybindings()");
      const html = await evaluateEditor(
        page,
        "document.querySelector('#shortcutsModal .shortcuts-modal-body').innerHTML",
      );
      expect(html).toContain("Ctrl+G");
      expect(html).toContain("Ctrl+Shift+G");
      expect(html).toContain("Ctrl+Shift+");
    },
  );
});
