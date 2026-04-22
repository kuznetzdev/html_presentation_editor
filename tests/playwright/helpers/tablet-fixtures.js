// tablet-fixtures.js — Helper functions for tablet/mobile honest-block tests (WO-33, ADR-018)
// Provides viewport-aware helpers for opening the editor, synthetic pointer events, and
// gesture simulations used in tablet-honest.spec.js.

const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
} = require("./editorApp");

/**
 * openEditorOnViewport — load the editor at the given viewport dimensions.
 * The page viewport must already be set by the Playwright project config.
 * This just calls loadBasicDeck with standard options.
 */
async function openEditorOnViewport(page, _width, _height) {
  await loadBasicDeck(page, {
    manualBaseUrl: BASIC_MANUAL_BASE_URL,
    mode: "edit",
  });
}

/**
 * tapSelect — simulate a single tap on an element inside the preview iframe.
 * Uses pointer events on the preview frame so the bridge receives the hit.
 * Returns the selected nodeId (via state) or null if selection failed.
 */
async function tapSelect(page, selector) {
  const frame = page.frame({ name: "previewFrame" }) ||
    page.frames().find((f) => f.url().includes("blob:"));
  if (frame) {
    const el = frame.locator(selector).first();
    await el.tap();
  } else {
    // fallback: click via shell proxy
    const previewFrame = page.locator("#previewFrame");
    const frameBox = await previewFrame.boundingBox();
    if (!frameBox) return null;
    // tap the centre of the preview frame as a rough proxy
    await page.tap("#previewFrame", { position: { x: frameBox.width / 2, y: frameBox.height / 4 } });
  }
  // Wait briefly for the bridge selection round-trip
  await page.waitForTimeout(400);
  return evaluateEditor(page, "state.selectedNodeId || null");
}

/**
 * attemptDrag — try to start a drag gesture on the selection overlay.
 * On compact viewports this should be blocked and trigger a compact-manip banner.
 * On desktop it would start a real drag (not used in desktop tests here).
 */
async function attemptDrag(page, selector) {
  // First ensure something is selected via bridge
  await evaluateEditor(
    page,
    `(() => {
      const node = state.modelDoc && state.modelDoc.querySelector("${selector}");
      const nodeId = node && node.getAttribute("data-editor-node-id");
      if (nodeId) sendToBridge("select-element", { nodeId });
    })()`,
  );
  // Wait for selection to propagate
  await page.waitForTimeout(500);

  // Attempt to drag from the selection hit area
  const hitArea = page.locator("#selectionFrameHitArea");
  const box = await hitArea.boundingBox();
  if (!box) return false;

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 50, startY + 50, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  return true;
}

/**
 * attemptRailReorder — try to start a rail drag-reorder gesture on the first slide item.
 * On compact viewports this should be blocked with a compact-rail banner.
 */
async function attemptRailReorder(page) {
  // Ensure slides panel is visible on compact shell
  const slidesPanel = page.locator("#slidesPanel");
  if (!(await slidesPanel.isVisible())) {
    const slidesBtn = page.locator("#mobileSlidesBtn");
    if (await slidesBtn.isVisible()) {
      await slidesBtn.click();
      await page.waitForTimeout(300);
    }
  }

  const firstItem = page.locator(".slide-item").first();
  const box = await firstItem.boundingBox();
  if (!box) return false;

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + 80, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  return true;
}

module.exports = {
  openEditorOnViewport,
  tapSelect,
  attemptDrag,
  attemptRailReorder,
  BASIC_MANUAL_BASE_URL,
};
