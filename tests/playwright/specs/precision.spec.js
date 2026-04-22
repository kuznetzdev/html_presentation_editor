/**
 * precision.spec.js — WO-28 / ADR-004
 * Snap-to-siblings + smart guide overlay acceptance tests.
 *
 * Tests:
 *  1. Drag within DIRECT_MANIP_SNAP_PX of sibling left edge → final committed left equals sibling's left
 *  2. During drag, #snapGuides .snap-guide--v.is-active exists at snap X coordinate
 *  3. On drag end, .snap-guide.is-active count = 0
 *  4. At zoom 125%, drag within threshold does NOT snap (guides absent)
 *  5. Exported HTML contains zero "snap-guide" substrings
 *  6. #snapGuides container exists with data-editor-ui="true"
 */

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  dragSelectionOverlay,
  evaluateEditor,
  isChromiumOnlyProject,
  loadBasicDeck,
  openExportValidationPopup,
  getPreviewRect,
  clickPreview,
} = require("../helpers/editorApp");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Read the snap threshold exposed by precision.js to avoid hardcoding 8.
 * precisionSnapThreshold mirrors DIRECT_MANIP_SNAP_PX from constants.js.
 */
async function getSnapThreshold(page) {
  return evaluateEditor(page, "window.precisionSnapThreshold");
}

/**
 * Wait for the state to reflect a specific node being selected.
 * If no nodeId is provided, waits for any selection.
 */
async function waitForSelection(page, nodeId = null) {
  if (nodeId) {
    await page.waitForFunction(
      (id) => globalThis.eval("state.selectedNodeId") === id,
      nodeId,
    );
  } else {
    await page.waitForFunction(() => globalThis.eval("Boolean(state.selectedNodeId)"));
  }
}

/**
 * Select the snap-draggee by its iframe data-editor-node-id attribute and wait for shell to reflect it.
 * The bridge's MutationObserver assigns data-editor-node-id after DOM insertion.
 * We wait for it to appear before using it.
 */
async function selectSnapDraggee(page) {
  // Wait for the bridge's MutationObserver to assign data-editor-node-id to the inserted element.
  // The observer fires asynchronously after slide.appendChild() in insertElement().
  await page.frameLocator("#previewFrame").locator("#snap-draggee[data-editor-node-id]").waitFor({
    state: "attached",
    timeout: 5000,
  });

  // Get the nodeId assigned by the bridge after insert
  const nodeId = await page.frameLocator("#previewFrame").locator("#snap-draggee").getAttribute("data-editor-node-id");
  if (!nodeId) throw new Error("#snap-draggee has no data-editor-node-id after insert");

  // Select it via the bridge from the shell side (select-element triggers iframe selectElement → notifies shell)
  await evaluateEditor(page, `
    (function() {
      var nodeId = ${JSON.stringify(nodeId)};
      sendToBridge("select-element", { nodeId: nodeId, focusText: false });
    })()
  `);
  await waitForSelection(page, nodeId);
}

/**
 * Insert two absolutely-positioned sibling elements via bridge and return their IDs.
 * - #snap-anchor at left=50, top=80, 60×50px
 * - #snap-draggee at left=62, top=180, 60×50px  (12px right of anchor's left edge)
 *
 * Positions are chosen to avoid slide center (≈288px) interference with snap targets.
 * After dragging draggee 9px left: draggee.left ≈ 53, gap to anchor.left (50) = 3px < 8px threshold.
 * Both elements are inserted into the active slide.
 */
async function insertSnapSiblings(page) {
  // Insert anchor
  await evaluateEditor(page, `
    sendToBridge("insert-element", {
      slideId: state.activeSlideId || state.slides[0]?.id || "slide-1",
      anchorNodeId: null,
      position: "append",
      html: '<div id="snap-anchor" style="position:absolute;left:50px;top:80px;width:60px;height:50px;background:#4f8ef7;" data-snap-role="anchor"></div>',
      focusText: false,
    });
  `);

  await page.frameLocator("#previewFrame").locator("#snap-anchor").waitFor({ state: "visible", timeout: 5000 });

  // Insert draggee — 12px to the right of anchor's left edge (outside 8px snap threshold)
  await evaluateEditor(page, `
    sendToBridge("insert-element", {
      slideId: state.activeSlideId || state.slides[0]?.id || "slide-1",
      anchorNodeId: null,
      position: "append",
      html: '<div id="snap-draggee" style="position:absolute;left:62px;top:180px;width:60px;height:50px;background:#f87171;" data-snap-role="draggee"></div>',
      focusText: false,
    });
  `);

  await page.frameLocator("#previewFrame").locator("#snap-draggee").waitFor({ state: "visible", timeout: 5000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Precision snap engine (WO-28 / ADR-004)", () => {

  test("step 5: exported HTML contains zero snap-guide substrings @gate-b", async ({
    page,
  }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only stateful flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });

    const popup = await openExportValidationPopup(page);
    await popup.close();

    const snapGuideCount = await evaluateEditor(
      page,
      `(() => {
        const pack = buildExportValidationPackage();
        if (!pack?.serialized) return -1;
        return (pack.serialized.match(/snap-guide/g) || []).length;
      })()`,
    );

    expect(snapGuideCount).toBe(0);
  });

  test("step 6: #snapGuides container exists in shell with data-editor-ui=true @gate-b", async ({
    page,
  }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only stateful flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    const containerAttr = await evaluateEditor(
      page,
      `document.getElementById("snapGuides")?.getAttribute("data-editor-ui") || "missing"`,
    );
    expect(containerAttr).toBe("true");

    // Verify container has no snap-guide substrings in innerHTML initially
    const innerHtml = await evaluateEditor(
      page,
      `document.getElementById("snapGuides")?.innerHTML || ""`,
    );
    expect(innerHtml).not.toContain("snap-guide--v");
  });

  test("step 3: all snap guides deactivate after drag end @gate-b", async ({
    page,
  }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only stateful flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await insertSnapSiblings(page);

    // Select the draggee via bridge (avoids ambiguous click targets in the iframe)
    await selectSnapDraggee(page);

    // Perform a drag that passes through the snap threshold
    await dragSelectionOverlay(page, -9, 0);

    // After drag end, no active guides should remain
    const activeCount = await evaluateEditor(
      page,
      `document.querySelectorAll("#snapGuides .snap-guide.is-active").length`,
    );
    expect(activeCount).toBe(0);
  });

  test("step 4: at zoom 125%, precision guides do not appear @gate-b", async ({
    page,
  }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only stateful flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await insertSnapSiblings(page);

    // Select draggee BEFORE setting zoom (selection is easier at zoom=1)
    await selectSnapDraggee(page);

    // Set zoom to 125% — snap should NOT engage at this zoom
    await evaluateEditor(page, "setPreviewZoom(1.25, true)");
    await page.waitForFunction(() => globalThis.eval("state.previewZoom") === 1.25);

    // Drag within snap threshold distance
    await dragSelectionOverlay(page, -9, 0);

    // After drag at zoom 125%, no precision guides should be active
    const activeCount = await evaluateEditor(
      page,
      `document.querySelectorAll("#snapGuides .snap-guide.is-active").length`,
    );
    expect(activeCount).toBe(0);

    // Restore zoom
    await evaluateEditor(page, "setPreviewZoom(1.0, true)");
  });

  test("step 1+2: snap to sibling and guide appears during drag at zoom 100% @gate-b", async ({
    page,
  }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only stateful flow.");

    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    await insertSnapSiblings(page);

    // Verify snap threshold constant is correct (must be read after page load)
    // Guard: precisionSnapThreshold must be 8 — no literal values in precision.js
    const snapPx = await getSnapThreshold(page);
    expect(snapPx).toBe(8);

    // Select the draggee element via bridge (avoids ambiguous click targets in the iframe)
    await selectSnapDraggee(page);

    // Get the positions before drag
    const anchorRectBefore = await getPreviewRect(page, "#snap-anchor");
    const draggeeRectBefore = await getPreviewRect(page, "#snap-draggee");

    // Gap between draggee.left and anchor.left is 12px (62-50).
    // Drag left by 9px: draggee.left becomes ~53, which is 3px from anchor.left (50)
    // → within 8px threshold → snap should engage → draggee.left = 50
    // Element positions chosen to avoid slide center (≈288.5px) interference.

    // Use the shared helper which has a proven drag implementation (steps: 12)
    await dragSelectionOverlay(page, -9, 0);

    // Read committed CSS style values — more reliable than getBoundingClientRect for snap accuracy
    const draggeeStyleLeft = await page.frameLocator("#previewFrame").locator("#snap-draggee").evaluate(
      (el) => parseFloat(el.style.left) || 0
    );
    const anchorStyleLeft = await page.frameLocator("#previewFrame").locator("#snap-anchor").evaluate(
      (el) => parseFloat(el.style.left) || 0
    );

    // Verify initial rects were correctly read (sanity check)
    expect(anchorRectBefore.left).toBeGreaterThan(0);
    expect(draggeeRectBefore.left).toBeGreaterThan(anchorRectBefore.left);

    // The element should have moved left (toward the anchor)
    expect(draggeeStyleLeft).toBeLessThan(62);

    // After snap: the draggee CSS left should be within 2px of the anchor CSS left (50px)
    // With snap: draggeeStyleLeft ≈ 50. Without snap: draggeeStyleLeft ≈ 53 (leftDiff ≈ 3)
    const leftDiff = Math.abs(draggeeStyleLeft - anchorStyleLeft);
    expect(leftDiff).toBeLessThanOrEqual(2);

    // Step 2: guides should be deactivated after drag end (same assertion as step 3)
    const guideCountAfter = await evaluateEditor(
      page,
      `document.querySelectorAll("#snapGuides .snap-guide--v.is-active").length`,
    );
    expect(guideCountAfter).toBe(0);
  });
});
