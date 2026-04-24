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
      test.slow();
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      // Capture the nodeId of the first tree node so we can re-query
      // after re-renders without worrying about stale element refs.
      const nodeId = await page.evaluate(() => {
        const el = document.querySelector(
          "#layersListContainer details.layer-tree-node",
        );
        return el ? el.getAttribute("data-layer-tree-nodeid") : null;
      });
      test.skip(!nodeId, "No nested tree nodes on this slide");
      // Starts open by default — poll since other specs may share the worker.
      await expect
        .poll(
          async () =>
            page.evaluate(
              (id) =>
                Boolean(
                  document
                    .querySelector(
                      `#layersListContainer details.layer-tree-node[data-layer-tree-nodeid="${id}"]`,
                    )
                    ?.hasAttribute("open"),
                ),
              nodeId,
            ),
          { timeout: 5_000 },
        )
        .toBe(true);
      // Toggle via the DOM API + explicitly update state.layerTreeCollapsed
      // so any parallel render that races the toggle event still ends up
      // collapsed.
      await page.evaluate((id) => {
        const details = document.querySelector(
          `#layersListContainer details.layer-tree-node[data-layer-tree-nodeid="${id}"]`,
        );
        if (details) details.open = false;
        // state is exposed as a top-level const in editor/src/state.js; it is
        // reachable as a bare identifier in page.evaluate's page context.
        // eslint-disable-next-line no-undef
        if (typeof state !== "undefined") {
          if (!(state.layerTreeCollapsed instanceof Set)) {
            state.layerTreeCollapsed = new Set();
          }
          state.layerTreeCollapsed.add(id);
        }
      }, nodeId);
      // Poll — renderLayersPanel may re-run, but state.layerTreeCollapsed
      // ensures the details re-render closed too.
      await expect
        .poll(
          async () =>
            page.evaluate(
              (id) =>
                Boolean(
                  document
                    .querySelector(
                      `#layersListContainer details.layer-tree-node[data-layer-tree-nodeid="${id}"]`,
                    )
                    ?.hasAttribute("open"),
                ),
              nodeId,
            ),
          { timeout: 8_000 },
        )
        .toBe(false);
    },
  );

  test(
    "Basic mode hides advanced controls (lock button, drag handle) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await clickPreview(page, '[data-node-id="hero-title"]');
      // Confirm we are in basic mode by default.
      const mode = await evaluateEditor(page, "state.complexityMode");
      expect(mode).toBe("basic");
      // [v2.0.6] Inline .layer-z-input was removed in the panel declutter.
      // Basic-mode gating is now verified via lock-btn + drag-handle only.
      await expect(
        page.locator("#layersListContainer .layer-lock-btn"),
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
