"use strict";

// v1.1.6 / Phase B5 — Inline rename + layer-row context menu coverage.
// Also verifies data-layer-name survives export (not stripped as data-editor-*).

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
  await expect(page.locator("#layersRegion")).toBeVisible();
}

async function firstLayerRow(page) {
  return page
    .locator("#layersListContainer .layer-row[data-layer-node-id]")
    .first();
}

test.describe("Layers inline rename + context menu — Phase B5", () => {
  test(
    "Double-click on layer label replaces span with input @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      await row.locator(".layer-label").dblclick();
      await expect(row.locator(".layer-label-input")).toBeVisible();
    },
  );

  test(
    "Enter in rename input commits data-layer-name on the model node @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      const nodeId = await row.getAttribute("data-layer-node-id");
      await row.locator(".layer-label").dblclick();
      const input = row.locator(".layer-label-input");
      await input.fill("My custom layer");
      await input.press("Enter");
      await expect
        .poll(() =>
          evaluateEditor(
            page,
            `state.modelDoc.querySelector('[data-editor-node-id="${nodeId}"]').getAttribute('data-layer-name')`,
          ),
        )
        .toBe("My custom layer");
    },
  );

  test(
    "Escape in rename input cancels without writing @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      const nodeId = await row.getAttribute("data-layer-node-id");
      await row.locator(".layer-label").dblclick();
      const input = row.locator(".layer-label-input");
      await input.fill("Abandoned");
      await input.press("Escape");
      const attr = await evaluateEditor(
        page,
        `state.modelDoc.querySelector('[data-editor-node-id="${nodeId}"]').getAttribute('data-layer-name')`,
      );
      expect(attr).toBeFalsy();
    },
  );

  test(
    "Committed name appears as the label text on the next render @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      await row.locator(".layer-label").dblclick();
      await row.locator(".layer-label-input").fill("Hero region");
      await row.locator(".layer-label-input").press("Enter");
      // Same row still first — label now shows committed name.
      const newRow = await firstLayerRow(page);
      await expect(newRow.locator(".layer-label")).toHaveText("Hero region");
    },
  );

  test(
    "data-layer-name is preserved in exported HTML (not stripped) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      const nodeId = await row.getAttribute("data-layer-node-id");
      await row.locator(".layer-label").dblclick();
      await row.locator(".layer-label-input").fill("Exported Name");
      await row.locator(".layer-label-input").press("Enter");
      // Build clean export html and search for the attribute.
      const exportedHtml = await evaluateEditor(
        page,
        "(typeof buildCleanExportPackage === 'function' ? (buildCleanExportPackage()?.serialized || '') : '')",
      );
      expect(exportedHtml).toContain('data-layer-name="Exported Name"');
      // editor-specific attrs that should be stripped:
      expect(exportedHtml).not.toContain(`data-editor-node-id="${nodeId}"`);
    },
  );

  test(
    "Right-click on layer row opens context menu with layer-scope items @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      await row.click({ button: "right" });
      const menu = page.locator("#contextMenu.is-open");
      await expect(menu).toBeVisible();
      await expect(
        menu.locator('button[data-menu-action="layer-rename"]'),
      ).toBeVisible();
      await expect(
        menu.locator('button[data-menu-action="layer-delete"]'),
      ).toBeVisible();
      await expect(
        menu.locator('button[data-menu-action="layer-bring-forward"]'),
      ).toBeVisible();
    },
  );

  test(
    "Layer menu -> Rename starts inline editing @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      await row.click({ button: "right" });
      await page
        .locator('#contextMenu button[data-menu-action="layer-rename"]')
        .click();
      await expect(row.locator(".layer-label-input")).toBeVisible();
    },
  );

  test(
    "Layer menu -> Toggle visibility hides the layer (basic mode) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      const nodeId = await row.getAttribute("data-layer-node-id");
      await row.click({ button: "right" });
      await page
        .locator('#contextMenu button[data-menu-action="layer-toggle-visibility"]')
        .click();
      await expect
        .poll(() =>
          evaluateEditor(page, `Boolean(state.sessionVisibilityMap?.["${nodeId}"])`),
        )
        .toBe(true);
    },
  );

  test(
    "F2 on focused row opens inline rename @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      await row.focus();
      await page.keyboard.press("F2");
      await expect(row.locator(".layer-label-input")).toBeVisible();
    },
  );

  test(
    "Context menu closes when an action is dispatched @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const row = await firstLayerRow(page);
      await row.click({ button: "right" });
      await expect(page.locator("#contextMenu.is-open")).toBeVisible();
      await page
        .locator('#contextMenu button[data-menu-action="layer-rename"]')
        .click();
      await expect(page.locator("#contextMenu.is-open")).toHaveCount(0);
    },
  );
});
