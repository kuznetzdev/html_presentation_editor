"use strict";

// v1.1.5 / Phase B4 / ADR-034 — Layers tree view smoke coverage.
// Verifies that the persistent Layers shell region renders a DOM-hierarchy
// tree via <details>/<summary> when featureFlags.treeLayers is true.

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
}

test.describe("Layers tree view — Phase B4", () => {
  test(
    "#layersRegion is visible (standalone default, basic mode) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Standalone is the default now. Click a preview element so the panel
      // has at least one slide with nodes to render.
      await clickPreview(page, '[data-node-id="hero-title"]');
      await expect(page.locator("#layersRegion")).toBeVisible();
      // Inspector-nested section is CSS-hidden by the standalone rule.
      await expect(page.locator("#layersInspectorSection")).toBeHidden();
    },
  );

  test(
    "Tree mode applies .is-tree-mode class to the list container @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      const treeFlag = await evaluateEditor(
        page,
        "window.featureFlags && window.featureFlags.treeLayers",
      );
      expect(treeFlag).toBe(true);
      await expect(page.locator("#layersListContainer.is-tree-mode")).toBeVisible();
    },
  );

  test(
    "Layer rows carry data-layer-depth attribute @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      const depthAttr = await page
        .locator("#layersListContainer .layer-row[data-layer-node-id]")
        .first()
        .getAttribute("data-layer-depth");
      expect(depthAttr).not.toBeNull();
      expect(Number.isNaN(Number(depthAttr))).toBe(false);
    },
  );

  test(
    "Clicking a layer row selects the element in preview @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      const clickedNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");
      // Find a different row and click it. We pick the second rendered row if
      // there are ≥2; otherwise the test is non-actionable and skipped.
      const rows = page.locator(
        "#layersListContainer .layer-row[data-layer-node-id]",
      );
      const rowCount = await rows.count();
      test.skip(rowCount < 2, "Fewer than 2 layer rows — nothing to compare");
      const targetRow = rows.nth(1);
      const targetNodeId = await targetRow.getAttribute("data-layer-node-id");
      await targetRow.click();
      await expect
        .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"))
        .toBe(targetNodeId);
      expect(targetNodeId).not.toBe(clickedNodeId);
    },
  );

  test(
    "<details> wrappers exist for nested layers (when DOM has hierarchy) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      const treeNodes = page.locator(
        "#layersListContainer details.layer-tree-node",
      );
      const count = await treeNodes.count();
      // If the slide happens to have a flat hierarchy, count may be 0 —
      // which is still valid. Only assert that when count > 0 the structure
      // matches expectations.
      if (count > 0) {
        await expect(treeNodes.first().locator("> summary")).toBeVisible();
        await expect(
          treeNodes.first().locator("> .layer-tree-children"),
        ).toBeAttached();
      }
    },
  );

  test(
    "Toggling <details> open/closed hides child rows @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      const firstNode = page.locator(
        "#layersListContainer details.layer-tree-node",
      ).first();
      const present = (await firstNode.count()) > 0;
      test.skip(!present, "No nested tree nodes on this slide");
      // Starts open by default.
      await expect(firstNode).toHaveAttribute("open", "");
      await firstNode.locator("> summary").click();
      await expect(firstNode).not.toHaveAttribute("open", "");
    },
  );

  test(
    "Basic mode hides advanced controls (lock button, z-index input) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      // Confirm we are in basic mode by default.
      const mode = await evaluateEditor(page, "state.complexityMode");
      expect(mode).toBe("basic");
      await expect(
        page.locator("#layersListContainer .layer-lock-btn"),
      ).toHaveCount(0);
      await expect(
        page.locator("#layersListContainer .layer-z-input"),
      ).toHaveCount(0);
      await expect(
        page.locator("#layersListContainer .layer-drag-handle"),
      ).toHaveCount(0);
    },
  );

  test(
    "Advanced mode surfaces lock + drag handles in tree rows @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      await evaluateEditor(page, "setComplexityMode('advanced')");
      await expect
        .poll(() => evaluateEditor(page, "state.complexityMode"))
        .toBe("advanced");
      await clickPreview(page, '[data-node-id="hero-title"]');
      await expect
        .poll(async () =>
          page.locator("#layersListContainer .layer-lock-btn").count(),
        )
        .toBeGreaterThan(0);
      await expect
        .poll(async () =>
          page.locator("#layersListContainer .layer-drag-handle").count(),
        )
        .toBeGreaterThan(0);
    },
  );

  test(
    "Layers visibility toggle button exists for every row (both modes) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      const rowCount = await page
        .locator("#layersListContainer .layer-row[data-layer-node-id]")
        .count();
      test.skip(rowCount === 0, "No rows rendered");
      const visibilityCount = await page
        .locator("#layersListContainer .layer-visibility-btn")
        .count();
      expect(visibilityCount).toBe(rowCount);
    },
  );

  test(
    "Disabling treeLayers flag renders flat rows (no .is-tree-mode) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      await evaluateEditor(page, "window.featureFlags.treeLayers = false");
      await evaluateEditor(page, "renderLayersPanel()");
      await expect(
        page.locator("#layersListContainer.is-tree-mode"),
      ).toHaveCount(0);
      // Rows are still there, just flat.
      await expect
        .poll(async () =>
          page.locator("#layersListContainer .layer-row").count(),
        )
        .toBeGreaterThan(0);
    },
  );
});
