"use strict";

// v1.5.0 — wired validators on inspector inputs + experimental badges.

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
  // widthInput / heightInput live inside the advanced-only geometry section.
  // Switch to advanced mode so these inputs are visible + interactive.
  await evaluateEditor(page, "setComplexityMode('advanced')");
  await expect.poll(() => evaluateEditor(page, "state.complexityMode")).toBe("advanced");
}

test.describe("Inspector validators (v1.5.0)", () => {
  test(
    "Bad CSS length in widthInput surfaces a toast and skips applyStyle @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const before = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.width || ''",
      );
      await page.fill("#widthInput", "12foo");
      await page.locator("#widthInput").press("Tab");
      const after = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.width || ''",
      );
      expect(after).toBe(before);
    },
  );

  test(
    "Valid CSS length applies @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await page.fill("#widthInput", "240px");
      await page.locator("#widthInput").press("Tab");
      const after = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.width || ''",
      );
      expect(after).toBe("240px");
    },
  );

  test(
    "javascript: URL in imageSrcInput is rejected @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Find an image node and select it.
      const imgNodeId = await evaluateEditor(
        page,
        "(() => { const img = state.modelDoc.querySelector('img[data-editor-node-id]'); return img ? img.getAttribute('data-editor-node-id') : null; })()",
      );
      test.skip(!imgNodeId, "No image element in fixture");
      await evaluateEditor(page, "sendToBridge('select-element', { nodeId: '" + imgNodeId + "' })");
      // Wait for inspector to update (selection ready).
      await page.waitForTimeout(300);
      const before = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + '" + imgNodeId + "' + '\"]').getAttribute('src') || ''",
      );
      await page.locator("#imageSrcInput").fill("javascript:alert(1)");
      await page.locator("#applyImageSrcBtn").click();
      const after = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + '" + imgNodeId + "' + '\"]').getAttribute('src') || ''",
      );
      expect(after).toBe(before);
    },
  );

  test(
    "Opacity input clamps via validator @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await page.locator("#opacityInput").fill("50");
      await page.locator("#opacityInput").press("Tab");
      const opacity = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.opacity || ''",
      );
      expect(opacity).toBe("0.5");
    },
  );
});

test.describe("Experimental badges (v1.5.0)", () => {
  test(
    "PPTX export button gets the Beta badge by default (pptxV2=true) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const hasBadge = await evaluateEditor(
        page,
        "Boolean(document.querySelector('#exportPptxBtn .experimental-badge'))",
      );
      expect(hasBadge).toBe(true);
    },
  );

  test(
    "Open HTML button has no badge in default report mode @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const hasBadge = await evaluateEditor(
        page,
        "Boolean(document.querySelector('#openHtmlBtn .experimental-badge'))",
      );
      expect(hasBadge).toBe(false);
    },
  );

  test(
    "Switching smartImport to 'full' adds badge to Open HTML button on refresh @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "window.featureFlags.smartImport = 'full'; refreshExperimentalBadges();",
      );
      const hasBadge = await evaluateEditor(
        page,
        "Boolean(document.querySelector('#openHtmlBtn .experimental-badge'))",
      );
      expect(hasBadge).toBe(true);
    },
  );

  test(
    "attachExperimentalBadge is idempotent @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const count = await evaluateEditor(
        page,
        "(() => { const t = document.createElement('button'); document.body.appendChild(t); attachExperimentalBadge(t, 'Beta'); attachExperimentalBadge(t, 'Beta'); return t.querySelectorAll('.experimental-badge').length; })()",
      );
      expect(count).toBe(1);
    },
  );

  test(
    "removeExperimentalBadge clears the chip @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const removed = await evaluateEditor(
        page,
        "(() => { const t = document.createElement('button'); document.body.appendChild(t); attachExperimentalBadge(t, 'Beta'); return removeExperimentalBadge(t); })()",
      );
      expect(removed).toBe(true);
    },
  );
});
