"use strict";

// v1.3.3 / Phase D3 — opacity + rotate API coverage.

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

test.describe("Opacity + rotate — Phase D3", () => {
  test(
    "setSelectedOpacity(0.5) writes inline opacity @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const ok = await evaluateEditor(page, "setSelectedOpacity(0.5)");
      expect(ok).toBe(true);
      const inline = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.opacity",
      );
      expect(inline).toBe("0.5");
    },
  );

  test(
    "setSelectedOpacity(1) removes the inline opacity @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "setSelectedOpacity(0.4)");
      await evaluateEditor(page, "setSelectedOpacity(1)");
      const inline = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.opacity",
      );
      expect(inline).toBe("");
    },
  );

  test(
    "Opacity input is clamped to [0..1] @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "setSelectedOpacity(2)");
      const inline1 = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.opacity",
      );
      // 2 → clamped to 1 → opacity removed.
      expect(inline1).toBe("");
      await evaluateEditor(page, "setSelectedOpacity(-0.3)");
      const inline2 = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.opacity",
      );
      expect(inline2).toBe("0");
    },
  );

  test(
    "setSelectedRotation(45) writes a transform @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "setSelectedRotation(45)");
      const transform = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.transform",
      );
      expect(transform).toContain("rotate(45deg)");
    },
  );

  test(
    "clearSelectedRotation strips the rotate but keeps other transforms @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Pre-set a translate manually; then add rotate; then clear rotate.
      await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.transform = 'translateX(10px)'",
      );
      await evaluateEditor(page, "setSelectedRotation(30)");
      await evaluateEditor(page, "clearSelectedRotation()");
      const transform = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.transform",
      );
      expect(transform).toContain("translateX(10px)");
      expect(transform).not.toContain("rotate(");
    },
  );

  test(
    "cycleSelectedRotation walks 0 → 15 → 45 → 90 → 0 @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const reads = [];
      for (let i = 0; i < 4; i += 1) {
        await evaluateEditor(page, "cycleSelectedRotation()");
        const transform = await evaluateEditor(
          page,
          "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.transform",
        );
        reads.push(transform);
      }
      expect(reads[0]).toContain("rotate(15deg)");
      expect(reads[1]).toContain("rotate(45deg)");
      expect(reads[2]).toContain("rotate(90deg)");
      expect(reads[3]).not.toContain("rotate(");
    },
  );

  test(
    "Shift+R cycles rotation when an element is selected @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await page.locator("body").focus();
      await page.keyboard.press("Shift+R");
      const transform = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.transform",
      );
      expect(transform).toContain("rotate(15deg)");
    },
  );

  test(
    "Locked nodes reject opacity + rotation changes @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').setAttribute('data-editor-locked','true')",
      );
      const okOpacity = await evaluateEditor(page, "setSelectedOpacity(0.3)");
      const okRotate = await evaluateEditor(page, "setSelectedRotation(20)");
      expect(okOpacity).toBe(false);
      expect(okRotate).toBe(false);
    },
  );

  test(
    "API returns false when no node is selected @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "state.selectedNodeId = ''");
      const a = await evaluateEditor(page, "setSelectedOpacity(0.5)");
      const b = await evaluateEditor(page, "setSelectedRotation(10)");
      expect(a).toBe(false);
      expect(b).toBe(false);
    },
  );
});
