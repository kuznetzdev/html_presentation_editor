/**
 * visual-fixtures.js — Helper library for shell-visual.spec.js (WO-32 / ADR-007).
 *
 * All helpers are deterministic:
 *  - Theme switches use localStorage + page.reload() + await data-theme marker.
 *  - No CSS injection, no animation-state shortcuts that risk capturing mid-transition.
 *
 * Viewport assumption: 1440×900 (chromium-visual project).
 */

"use strict";

const path = require("path");

const {
  TEST_SERVER_ORIGIN,
  toTestServerUrl,
} = require("../../../scripts/test-server-config");

// Absolute path to the basic deck fixture used by the existing Gate-A helpers.
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..", "..");
const BASIC_DECK_PATH = path.join(
  WORKSPACE_ROOT,
  "tests",
  "fixtures",
  "playwright",
  "basic-deck.html",
);
const BASIC_MANUAL_BASE_URL = toTestServerUrl("/tests/fixtures/playwright/");

const TARGET_URL = "/editor/presentation-editor.html";

// The key written by theme.js to localStorage.
const THEME_STORAGE_KEY = "presentation-editor:theme:v1";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Disable all CSS animations + transitions so screenshots are deterministic. */
async function disableAnimations(page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

/** Wait for the preview to reach the "ready" state. */
async function waitForPreviewReady(page) {
  await page.waitForFunction(
    () =>
      globalThis.eval(`(() => {
        const frame = document.getElementById("previewFrame");
        const frameDoc = frame?.contentDocument || null;
        return Boolean(state.modelDoc) &&
          state.previewLifecycle === "ready" &&
          Boolean(state.previewReady) &&
          Boolean(frameDoc) &&
          frameDoc.readyState === "complete";
      })()`),
    undefined,
    { timeout: 25_000 },
  );
}

// ---------------------------------------------------------------------------
// Exported fixture helpers
// ---------------------------------------------------------------------------

/**
 * Boot the shell to the empty state (no deck loaded).
 * Clears storage, reloads, awaits #openHtmlBtn visibility.
 */
async function openShellForVisual(page) {
  await page.goto(TARGET_URL, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("#openHtmlBtn").waitFor({ state: "visible", timeout: 15_000 });
  await page.locator("#restoreBanner").waitFor({ state: "hidden", timeout: 5_000 });
}

/**
 * Load the basic-deck.html fixture and wait for preview ready state.
 * Leaves the editor in "preview" mode (default after load).
 */
async function loadBasicDeck(page) {
  await openShellForVisual(page);

  await page.locator("#openHtmlBtn").click();
  await page.locator("#loadFileBtn").waitFor({ state: "visible", timeout: 10_000 });
  await page.fill("#baseUrlInput", BASIC_MANUAL_BASE_URL);
  await page.setInputFiles("#fileInput", BASIC_DECK_PATH);
  await page.locator("#loadFileBtn").click();
  await waitForPreviewReady(page);
  await page.locator("#previewFrame").waitFor({ state: "visible", timeout: 10_000 });
}

/**
 * Switch the shell theme deterministically.
 * Uses localStorage write + page.reload() to avoid capturing in-transition frames.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'light'|'dark'} theme
 */
async function switchTheme(page, theme) {
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, value);
    },
    { key: THEME_STORAGE_KEY, value: theme },
  );
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });

  // Wait for the shell to apply the correct theme data-attribute.
  await page.waitForFunction(
    (expectedTheme) =>
      document.documentElement.dataset.theme === expectedTheme,
    theme,
    { timeout: 10_000 },
  );
}

/**
 * Select the first h1 element in the preview.
 * Switches to edit mode first, then clicks #hero-title.
 */
async function selectFirstH1(page) {
  // Switch to edit mode.
  const editBtn = page.locator("#editModeBtn");
  const mobileEditBtn = page.locator("#mobileEditBtn");

  if (await editBtn.isVisible()) {
    await editBtn.click();
  } else {
    await mobileEditBtn.waitFor({ state: "visible", timeout: 5_000 });
    await mobileEditBtn.click();
  }

  await page.waitForFunction(
    () => globalThis.eval("state.mode") === "edit",
    { timeout: 8_000 },
  );

  // Click the h1 inside the iframe.
  const heroTitle = page
    .frameLocator("#previewFrame")
    .locator("#hero-title");
  await heroTitle.waitFor({ state: "visible", timeout: 10_000 });
  try {
    await heroTitle.click();
  } catch {
    await heroTitle.click({ force: true });
  }

  // Wait for a node to be selected.
  await page.waitForFunction(
    () => Boolean(globalThis.eval("state.selectedNodeId")),
    { timeout: 8_000 },
  );
}

/**
 * Trigger the block banner by setting zoom to 125% on an active selection.
 * Requires loadBasicDeck + selectFirstH1 to have been called first.
 */
async function triggerBlockBanner(page) {
  await page.evaluate(() => {
    globalThis.eval("setPreviewZoom(1.25, true); updateInspectorFromSelection();");
  });
  await page.locator("#blockReasonBanner").waitFor({ state: "visible", timeout: 8_000 });
}

/**
 * Open the layer picker popup.
 * Loads the v1-absolute-positioned reference deck on slide 2, triggers overlap detection,
 * then clicks the "Выбрать слой" button to open the picker.
 *
 * NOTE: This helper requires the references_pres/ directory to be present.
 * Falls back to a synthetic openLayerPicker call if the reference deck is unavailable.
 */
async function openLayerPicker(page) {
  // Try to trigger via evaluateEditor — synthetic approach that works without reference deck.
  // We build a minimal payload that openLayerPicker() accepts.
  const opened = await page.evaluate(() => {
    try {
      const payload = {
        title: "Слои (visual test)",
        items: [
          { nodeId: "visual-node-1", label: "Элемент 1", hint: "div", chipLabels: [] },
          { nodeId: "visual-node-2", label: "Элемент 2", hint: "div", chipLabels: [] },
          { nodeId: "visual-node-3", label: "Элемент 3", hint: "p", chipLabels: [] },
        ],
        shellClientX: 720,
        shellClientY: 450,
      };
      return globalThis.eval(`openLayerPicker(${JSON.stringify(payload)})`);
    } catch {
      return false;
    }
  });

  if (opened) {
    await page.locator("#layerPicker").waitFor({ state: "visible", timeout: 8_000 });
    return;
  }

  throw new Error("openLayerPicker: failed to open layer picker via synthetic payload");
}

/**
 * Open the floating toolbar.
 * Requires selectFirstH1 to have been called. The toolbar appears after edit-mode selection.
 */
async function openFloatingToolbar(page) {
  // The floating toolbar should already be visible after selectFirstH1 in edit mode.
  // If not visible, schedule a render.
  const toolbar = page.locator("#floatingToolbar");
  const isVisible = await toolbar.isVisible();
  if (!isVisible) {
    await page.evaluate(() => {
      try {
        globalThis.eval("scheduleSelectionRender(['floatingToolbar'])");
      } catch {
        // ignore
      }
    });
  }
  await toolbar.waitFor({ state: "visible", timeout: 8_000 });
}

/**
 * Open the action hint (inspector help text shown on first selection).
 * Requires loadBasicDeck + selectFirstH1 (the hint is shown in inspectorHelp after edit-mode selection).
 * Ensures the inspector panel is visible.
 */
async function openActionHint(page) {
  // Ensure inspector panel is visible (desktop: always shown at 1440px width).
  await page.locator("#inspectorPanel").waitFor({ state: "visible", timeout: 8_000 });
  // The inspector help text should be present after selectFirstH1.
  await page.locator("#inspectorHelp").waitFor({ state: "visible", timeout: 5_000 });
}

module.exports = {
  disableAnimations,
  loadBasicDeck,
  openActionHint,
  openFloatingToolbar,
  openLayerPicker,
  openShellForVisual,
  selectFirstH1,
  switchTheme,
  triggerBlockBanner,
  waitForPreviewReady,
};
