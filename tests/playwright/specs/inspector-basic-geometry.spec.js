"use strict";

// v2.0.10 — Inspector basic-mode essentials.
//
// Width + Height inputs are now visible in BASIC mode (were
// advanced-only). The full geometry section (display, position,
// z-index, X, Y, transform) remains advanced.
//
// Pre-v2.0.10 the entire #geometryInspectorSection had
// data-ui-level="advanced" so basic users could only resize via
// drag handles — typed pixel values required Полный.

const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
  closeCompactShellPanels,
  clickPreview,
} = require("../helpers/editorApp");

async function loadDeckAtBasic(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
  await clickPreview(page, '[data-node-id="hero-title"]');
  // Force basic mode (default).
  await evaluateEditor(page, "setComplexityMode('basic')");
  await expect.poll(() => evaluateEditor(page, "state.complexityMode")).toBe("basic");
}

test.describe("Inspector basic-mode geometry essentials (v2.0.10)", () => {
  test(
    "Width input is visible in basic mode @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeckAtBasic(page);
      await expect(page.locator("#widthInput")).toBeVisible();
    },
  );

  test(
    "Height input is visible in basic mode @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeckAtBasic(page);
      await expect(page.locator("#heightInput")).toBeVisible();
    },
  );

  test(
    "Display select stays advanced (hidden in basic) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeckAtBasic(page);
      // Display, position, z-index live in a row gated as advanced.
      await expect(page.locator("#displaySelect")).toBeHidden();
      await expect(page.locator("#positionSelect")).toBeHidden();
      await expect(page.locator("#zIndexInput")).toBeHidden();
    },
  );

  test(
    "Left / Top stay advanced (hidden in basic) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeckAtBasic(page);
      await expect(page.locator("#leftInput")).toBeHidden();
      await expect(page.locator("#topInput")).toBeHidden();
    },
  );

  test(
    "Geometry section title stays visible in basic mode @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeckAtBasic(page);
      await expect(page.locator("#geometryInspectorSection")).toBeVisible();
      // toolbar.js replaces the <h3> with a section-toggle <button> at
      // runtime so collapse toggling works. Match by visible text.
      await expect(
        page.locator("#geometryInspectorSection .section-toggle span").first(),
      ).toHaveText("Размер и позиция");
    },
  );

  test(
    "Switching to advanced reveals display + position + X/Y @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeckAtBasic(page);
      await evaluateEditor(page, "setComplexityMode('advanced')");
      await expect.poll(() => evaluateEditor(page, "state.complexityMode")).toBe("advanced");
      await expect(page.locator("#displaySelect")).toBeVisible();
      await expect(page.locator("#leftInput")).toBeVisible();
    },
  );

  test(
    "Width applied via input persists in modelDoc @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeckAtBasic(page);
      await page.evaluate(() => {
        const el = document.getElementById("widthInput");
        el.value = "300px";
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(150);
      const after = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').style.width || ''",
      );
      expect(after).toBe("300px");
    },
  );
});
