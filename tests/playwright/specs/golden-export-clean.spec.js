"use strict";

// v1.5.4 — Golden export contract checks.
// Asserts that buildCleanExportPackage().serialized strips every
// editor artifact: data-editor-*, contenteditable, spellcheck,
// helper styles tag, bridge script tag, base[data-editor-preview-base].
// Also verifies no duplicate ids land in the final HTML.

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

async function getCleanExport(page) {
  return evaluateEditor(
    page,
    "(typeof buildCleanExportPackage === 'function' ? (buildCleanExportPackage()?.serialized || '') : '')",
  );
}

test.describe("Golden export — clean HTML contract (v1.5.4)", () => {
  test(
    "Exported HTML contains no data-editor-* attributes @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const html = await getCleanExport(page);
      expect(html.length).toBeGreaterThan(0);
      expect(html).not.toMatch(/data-editor-[a-z-]+="/);
    },
  );

  test(
    "Exported HTML strips contenteditable @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const html = await getCleanExport(page);
      expect(html).not.toMatch(/contenteditable=/i);
    },
  );

  test(
    "Exported HTML strips spellcheck attr @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const html = await getCleanExport(page);
      expect(html).not.toMatch(/spellcheck=/i);
    },
  );

  test(
    "Exported HTML omits the bridge script + helper styles @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const html = await getCleanExport(page);
      expect(html).not.toMatch(/__presentation_editor_bridge__/);
      expect(html).not.toMatch(/__presentation_editor_helper_styles__/);
    },
  );

  test(
    "Exported HTML omits base[data-editor-preview-base] @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const html = await getCleanExport(page);
      expect(html).not.toMatch(/data-editor-preview-base/);
    },
  );

  test(
    "Exported HTML has no duplicate IDs @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const html = await getCleanExport(page);
      // Parse via DOM and check uniqueness of all id values.
      const dupCount = await page.evaluate((src) => {
        const doc = new DOMParser().parseFromString(src, "text/html");
        const seen = new Set();
        let dup = 0;
        doc.querySelectorAll("[id]").forEach((el) => {
          const id = el.getAttribute("id") || "";
          if (!id) return;
          if (seen.has(id)) dup += 1;
          else seen.add(id);
        });
        return dup;
      }, html);
      expect(dupCount).toBe(0);
    },
  );

  test(
    "Exported HTML preserves data-layer-name (user-authored) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Set a data-layer-name on a node, then export.
      await evaluateEditor(
        page,
        "(() => { const el = state.modelDoc.querySelector('[data-editor-node-id]'); el.setAttribute('data-layer-name', 'Golden Test'); })()",
      );
      const html = await getCleanExport(page);
      expect(html).toContain('data-layer-name="Golden Test"');
    },
  );
});
