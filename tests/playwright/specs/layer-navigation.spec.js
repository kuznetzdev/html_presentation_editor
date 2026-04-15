"use strict";

const { test, expect } = require("@playwright/test");
const {
  clickPreview,
  closeCompactShellPanels,
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
  selectionFrameLocator,
} = require("../helpers/editorApp");

async function waitForNodeId(page, nodeId, timeout = 6_000) {
  await expect
    .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), { timeout })
    .toBe(nodeId);
}

async function previewClick(page, selector, options = {}) {
  await clickPreview(page, selector, options);
}

async function readSelectionSnapshot(page) {
  return evaluateEditor(
    page,
    "(() => ({ kind: state.selectedEntityKind || '', nodeId: state.selectedNodeId || '' }))()",
  );
}

async function setSelectionModeAndWait(page, mode) {
  await evaluateEditor(page, `setSelectionMode('${mode}')`);
  await expect.poll(() => evaluateEditor(page, "state.selectionMode || ''")).toBe(mode);
}

async function loadV2Deck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
}

test.describe("LN1 - Enter drill-down on container", () => {
  test(
    "Enter on a container drills down to a child element @stage-a",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadV2Deck(page);

      await previewClick(page, '[data-node-id="hero-title"]');
      await waitForNodeId(page, "hero-title");

      await selectionFrameLocator(page).focus();

      for (let i = 0; i < 6; i += 1) {
        const kind = await evaluateEditor(page, "state.selectedEntityKind || ''");
        if (kind === "container" || kind === "element") break;
        await page.keyboard.press("Shift+Enter");
        await page.waitForTimeout(150);
      }

      const containerKind = await evaluateEditor(page, "state.selectedEntityKind || ''");
      test.skip(containerKind === "slide-root", "Could not reach a container in this deck");

      const containerNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");
      const canEditText = await evaluateEditor(page, "state.selectedFlags.canEditText");
      test.skip(Boolean(canEditText), "Container has canEditText and Enter would open text edit");

      await page.keyboard.press("Enter");
      await page.waitForTimeout(300);

      const afterNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");
      expect(afterNodeId).not.toBe(containerNodeId);

      const afterKind = await evaluateEditor(page, "state.selectedEntityKind || ''");
      expect(afterKind).not.toBe("slide-root");
    },
  );
});

test.describe("LN2 - Shift+Enter parent navigation", () => {
  test(
    "Shift+Enter moves selection from leaf to parent @stage-b",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadV2Deck(page);

      await previewClick(page, '[data-node-id="hero-title"]');
      await waitForNodeId(page, "hero-title");

      const leafKind = await evaluateEditor(page, "state.selectedEntityKind || ''");

      await selectionFrameLocator(page).focus();
      await page.keyboard.press("Shift+Enter");
      await page.waitForTimeout(300);

      const parentNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");
      expect(parentNodeId).not.toBe("hero-title");

      const parentKind = await evaluateEditor(page, "state.selectedEntityKind || ''");
      expect(parentKind).not.toBe(leafKind);
    },
  );
});

test.describe("LN3 - Container select mode toggle", () => {
  test(
    "container mode selects group instead of leaf text @stage-c",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      test.slow();

      await loadV2Deck(page);

      await setSelectionModeAndWait(page, "container");

      let kind = "";
      let nodeId = "";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await setSelectionModeAndWait(page, "container");
        await page.waitForTimeout(100);
        await previewClick(page, '[data-node-id="hero-title"]');
        await page.waitForTimeout(250);
        ({ kind, nodeId } = await readSelectionSnapshot(page));
        if (
          ["container", "element", "slide-root"].includes(kind) &&
          nodeId !== "hero-title"
        ) {
          break;
        }
      }

      expect(["container", "element", "slide-root"]).toContain(kind);
      expect(nodeId).not.toBe("hero-title");

      await setSelectionModeAndWait(page, "smart");
      expect(await evaluateEditor(page, "state.selectionMode || ''")).toBe("smart");
    },
  );
});

test.describe("LN4 - Breadcrumb hover ghost highlight", () => {
  test(
    "hovering a breadcrumb shows ghost highlight inside iframe @stage-d",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadV2Deck(page);

      await previewClick(page, '[data-node-id="hero-title"]');
      await waitForNodeId(page, "hero-title");

      const crumbs = page.locator("#selectionBreadcrumbs button[data-selection-path-node-id]");
      const count = await crumbs.count();
      test.skip(count < 2, "Not enough breadcrumbs to test hover");

      const ancestorCrumb = crumbs.nth(1);
      await ancestorCrumb.dispatchEvent("pointerenter");

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
          { timeout: 3_000 },
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
          { timeout: 3_000 },
        )
        .toBe(false);
    },
  );
});

test.describe("LN5 - Export has no ghost/selection artifacts", () => {
  test(
    "exported HTML contains no editor highlight or selection attributes @stage-e",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));

      await loadV2Deck(page);

      await previewClick(page, '[data-node-id="hero-title"]');
      await waitForNodeId(page, "hero-title");

      const crumbs = page.locator("#selectionBreadcrumbs button[data-selection-path-node-id]");
      if ((await crumbs.count()) > 1) {
        await crumbs.nth(1).dispatchEvent("pointerenter");
        await page.waitForTimeout(100);
        await crumbs.nth(1).dispatchEvent("pointerleave");
      }

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
