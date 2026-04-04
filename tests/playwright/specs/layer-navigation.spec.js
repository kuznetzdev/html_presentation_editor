/**
 * Layer Navigation — e2e tests (v0.14.0)
 *
 * Covers:
 *  LN1 Enter drill-down: container → Enter → child is selected.
 *  LN2 Shift+Enter parent nav: leaf → Shift+Enter → parent selected.
 *  LN3 Container select mode: toggle → click → selects container, not leaf.
 *  LN4 Breadcrumb hover → ghost highlight visible inside iframe.
 *  LN5 Export clean: no ghost/selection artifacts in modelDoc output.
 */

"use strict";

const { test, expect } = require("@playwright/test");
const {
  clickPreview,
  closeCompactShellPanels,
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
  previewLocator,
  readSelectionUiState,
  selectionFrameLocator,
} = require("../helpers/editorApp");

// ─── helpers ──────────────────────────────────────────────────────────────────

async function waitForNodeId(page, nodeId, timeout = 6_000) {
  await expect
    .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), { timeout })
    .toBe(nodeId);
}

async function previewClick(page, selector, opts = {}) {
  await clickPreview(page, selector, opts);
}

async function loadV2Deck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
}

// ─── LN1: Enter drill-down ────────────────────────────────────────────────────

test.describe("LN1 — Enter drill-down on container", () => {
  test(
    "Enter on a container drills down to a child element @stage-a",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadV2Deck(page);

      // Click hero-title (text leaf), then navigate up to a container
      await previewClick(page, '[data-node-id="hero-title"]');
      await waitForNodeId(page, "hero-title");

      await selectionFrameLocator(page).focus();

      // Walk up with Shift+Enter until we reach a container/element
      for (let i = 0; i < 6; i++) {
        const kind = await evaluateEditor(
          page,
          "state.selectedEntityKind || ''",
        );
        if (kind === "container" || kind === "element") break;
        await page.keyboard.press("Shift+Enter");
        await page.waitForTimeout(150);
      }

      const containerKind = await evaluateEditor(
        page,
        "state.selectedEntityKind || ''",
      );
      test.skip(
        containerKind === "slide-root",
        "Could not reach a container in this deck",
      );

      const containerNodeId = await evaluateEditor(
        page,
        "state.selectedNodeId || ''",
      );

      // Press Enter — should drill down
      const canEditText = await evaluateEditor(
        page,
        "state.selectedFlags.canEditText",
      );
      test.skip(
        Boolean(canEditText),
        "Container has canEditText — Enter would open text-edit",
      );

      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);

      const afterNodeId = await evaluateEditor(
        page,
        "state.selectedNodeId || ''",
      );
      expect(afterNodeId).not.toBe(containerNodeId);

      const afterKind = await evaluateEditor(
        page,
        "state.selectedEntityKind || ''",
      );
      expect(afterKind).not.toBe("slide-root");
    },
  );
});

// ─── LN2: Shift+Enter parent nav ─────────────────────────────────────────────

test.describe("LN2 — Shift+Enter parent navigation", () => {
  test(
    "Shift+Enter moves selection from leaf to parent @stage-b",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadV2Deck(page);

      await previewClick(page, '[data-node-id="hero-title"]');
      await waitForNodeId(page, "hero-title");

      const leafKind = await evaluateEditor(
        page,
        "state.selectedEntityKind || ''",
      );

      await selectionFrameLocator(page).focus();
      await page.keyboard.press("Shift+Enter");
      await page.waitForTimeout(300);

      const parentNodeId = await evaluateEditor(
        page,
        "state.selectedNodeId || ''",
      );
      expect(parentNodeId).not.toBe("hero-title");

      const parentKind = await evaluateEditor(
        page,
        "state.selectedEntityKind || ''",
      );
      // Parent should be a different kind (likely container or element)
      expect(parentKind).not.toBe(leafKind);
    },
  );
});

// ─── LN3: Container select mode ──────────────────────────────────────────────

test.describe("LN3 — Container select mode toggle", () => {
  test(
    "container mode selects group instead of leaf text @stage-c",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadV2Deck(page);

      // Activate container mode via evaluateEditor (toggle is in inspector panel
      // which may be collapsed on compact viewports)
      await evaluateEditor(page, "setSelectionMode('container')");
      await page.waitForTimeout(100);

      // Verify state changed
      const mode = await evaluateEditor(
        page,
        "state.selectionMode || ''",
      );
      expect(mode).toBe("container");

      // Click in the hero area — should select a container, not hero-title
      await previewClick(page, '[data-node-id="hero-title"]');
      await page.waitForTimeout(400);

      const kind = await evaluateEditor(
        page,
        "state.selectedEntityKind || ''",
      );
      expect(["container", "element", "slide-root"]).toContain(kind);

      const nodeId = await evaluateEditor(
        page,
        "state.selectedNodeId || ''",
      );
      // Should NOT be hero-title (which is text)
      expect(nodeId).not.toBe("hero-title");

      // Switch back to smart mode
      await evaluateEditor(page, "setSelectionMode('smart')");
      await page.waitForTimeout(100);

      const smartMode = await evaluateEditor(
        page,
        "state.selectionMode || ''",
      );
      expect(smartMode).toBe("smart");

      // Click same area — should now select the text leaf
      await previewClick(page, '[data-node-id="hero-title"]');
      await waitForNodeId(page, "hero-title");

      const smartKind = await evaluateEditor(
        page,
        "state.selectedEntityKind || ''",
      );
      expect(smartKind).toBe("text");
    },
  );
});

// ─── LN4: Breadcrumb hover → ghost highlight ─────────────────────────────────

test.describe("LN4 — Breadcrumb hover ghost highlight", () => {
  test(
    "hovering a breadcrumb shows ghost highlight inside iframe @stage-d",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadV2Deck(page);

      await previewClick(page, '[data-node-id="hero-title"]');
      await waitForNodeId(page, "hero-title");

      // Find breadcrumb buttons (non-leaf ones = ancestors)
      const crumbs = page.locator(
        "#selectionBreadcrumbs button[data-selection-path-node-id]",
      );
      const count = await crumbs.count();
      test.skip(count < 2, "Not enough breadcrumbs to test hover");

      // Trigger the hover contract directly on the second crumb (an ancestor,
      // not the leaf). This keeps the assertion stable even when nearby
      // inspector affordances overlap the same screen area.
      const ancestorCrumb = crumbs.nth(1);
      await ancestorCrumb.dispatchEvent("pointerenter");

      // Verify ghost highlight appeared inside iframe
      await expect
        .poll(
          () =>
            evaluateEditor(
              page,
              `(() => {
                const frame = document.getElementById("previewFrame");
                const doc = frame?.contentDocument || null;
                return !!doc?.querySelector('[data-editor-highlight="ghost"]');
              })()`,
            ),
          { timeout: 3000 },
        )
        .toBe(true);

      await ancestorCrumb.dispatchEvent("pointerleave");

      await expect
        .poll(
          () =>
            evaluateEditor(
              page,
              `(() => {
                const frame = document.getElementById("previewFrame");
                const doc = frame?.contentDocument || null;
                return !!doc?.querySelector('[data-editor-highlight="ghost"]');
              })()`,
            ),
          { timeout: 3000 },
        )
        .toBe(false);
    },
  );
});

// ─── LN5: Export clean ────────────────────────────────────────────────────────

test.describe("LN5 — Export has no ghost/selection artifacts", () => {
  test(
    "exported HTML contains no editor highlight or selection attributes @stage-e",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadV2Deck(page);

      // Select something so selection state is active
      await previewClick(page, '[data-node-id="hero-title"]');
      await waitForNodeId(page, "hero-title");

      // Trigger breadcrumb pointerenter to also produce ghost highlight.
      // dispatchEvent is used instead of .hover() so this works regardless of
      // whether the inspector panel is rendered as a drawer (compact viewports).
      const crumbs = page.locator(
        "#selectionBreadcrumbs button[data-selection-path-node-id]",
      );
      if ((await crumbs.count()) > 1) {
        await crumbs.nth(1).dispatchEvent("pointerenter");
        await page.waitForTimeout(100);
        await crumbs.nth(1).dispatchEvent("pointerleave");
      }

      // Read export from modelDoc
      const exportedHtml = await evaluateEditor(
        page,
        `(() => {
          const doc = state.modelDoc;
          return doc ? doc.documentElement.outerHTML : "";
        })()`,
      );

      expect(exportedHtml).toBeTruthy();
      expect(exportedHtml).not.toContain("data-editor-selected");
      expect(exportedHtml).not.toContain("data-editor-hover");
      expect(exportedHtml).not.toContain("data-editor-highlight");
      expect(exportedHtml).not.toContain("data-editor-flash");
    },
  );
});
