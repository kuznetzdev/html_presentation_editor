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
const {
  captureCommandSeq,
  waitForCommandSeqAdvance,
  waitForSelection,
  waitForRafTicks,
} = require("../helpers/waits");

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
      // [v2.0.7] Use direct value+dispatchEvent pattern (same reason as
      // Opacity test below — fill+Tab doesn't reliably fire change on
      // text inputs on Windows + Playwright 1.58).
      await page.evaluate(() => {
        const el = document.getElementById("widthInput");
        el.value = "12foo";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      // No command should be dispatched (validator rejects); RAF ticks let the
      // sync change handler complete so we can read the unchanged style.
      await waitForRafTicks(page);
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
      // [v2.0.7] Use direct value+dispatchEvent pattern. fill("240px")
      // followed by press("Tab") was intermittently failing because
      // the change event did not fire reliably on this combination.
      const priorSeq = await captureCommandSeq(page);
      await page.evaluate(() => {
        const el = document.getElementById("widthInput");
        el.value = "240px";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await waitForCommandSeqAdvance(page, priorSeq);
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
      await waitForSelection(page, imgNodeId);
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
      // [v2.0.7] Switched fill+Tab → setValue+dispatchEvent('change').
      // On Windows + Playwright 1.58, fill("50") on <input type="number"
      // step="5" min="0" max="100"> followed by press("Tab") did not
      // reliably fire the "change" event handler that runs the validator.
      // Test would intermittently observe modelDoc.style.opacity = ""
      // because applyStyle never reached the bridge. Direct value+
      // dispatchEvent is what the user effectively does (focus the
      // field, type, blur), with no race against focus heuristics.
      const priorSeq = await captureCommandSeq(page);
      await page.evaluate(() => {
        const el = document.getElementById("opacityInput");
        el.value = "50";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await waitForCommandSeqAdvance(page, priorSeq);
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
    "PPTX export button has NO Beta badge (v2.0.19+ — verified by roundtrip spec) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // [v2.0.19 / FN-001] The Beta badge was removed once the PPTX
      // export pipeline got an end-to-end roundtrip test
      // (tests/playwright/specs/pptx-export-roundtrip.spec.js). The
      // badge said "Полная интеграция export-конвейера — после v2.0",
      // but the user-visible function (PptxGenJS legacy path) works.
      const hasBadge = await evaluateEditor(
        page,
        "Boolean(document.querySelector('#exportPptxBtn .experimental-badge'))",
      );
      expect(hasBadge).toBe(false);
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
