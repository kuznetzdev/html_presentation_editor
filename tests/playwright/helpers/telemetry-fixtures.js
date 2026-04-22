// telemetry-fixtures.js — Helper functions for telemetry viewer tests (ADR-020, WO-34)
// Provides helpers for controlling opt-in state, emitting test events,
// reading viewer DOM, and switching complexity modes.

const { evaluateEditor, loadBasicDeck, BASIC_MANUAL_BASE_URL } = require("./editorApp");

// Constants (mirror from constants.js — must stay in sync)
const TELEMETRY_ENABLED_KEY = "editor:telemetry:enabled";
const TELEMETRY_LOG_KEY = "editor:telemetry:log";

/**
 * clearTelemetryStorage — wipes both telemetry localStorage keys.
 * Call before each test to ensure a clean state.
 */
async function clearTelemetryStorage(page) {
  await evaluateEditor(page, `
    (() => {
      try { localStorage.removeItem(${JSON.stringify(TELEMETRY_ENABLED_KEY)}); } catch (_) {}
      try { localStorage.removeItem(${JSON.stringify(TELEMETRY_LOG_KEY)}); } catch (_) {}
    })()
  `);
}

/**
 * enableTelemetry — flips opt-in toggle ON via window.telemetry.setEnabled(true).
 */
async function enableTelemetry(page) {
  await evaluateEditor(page, "(() => { window.telemetry.setEnabled(true); })()");
}

/**
 * disableTelemetry — flips opt-in toggle OFF via window.telemetry.setEnabled(false).
 */
async function disableTelemetry(page) {
  await evaluateEditor(page, "(() => { window.telemetry.setEnabled(false); })()");
}

/**
 * emitTestEvents — calls window.telemetry.emit N times with test codes.
 * Uses a mix of levels: ok, warn, error to support filter tests.
 * @param {import('@playwright/test').Page} page
 * @param {number} count — total number of events to emit
 */
async function emitTestEvents(page, count) {
  await evaluateEditor(page, `
    (() => {
      const levels = ["ok", "warn", "error"];
      const codes = ["test.event.a", "test.event.b", "test.event.c"];
      for (let i = 0; i < ${count}; i++) {
        window.telemetry.emit({
          level: levels[i % levels.length],
          code: codes[i % codes.length],
          data: { index: i },
        });
      }
    })()
  `);
}

/**
 * readViewerSummary — parses the text content of .telemetry-viewer__summary.
 * Returns the raw string, or "" if the element is absent or hidden.
 */
async function readViewerSummary(page) {
  return page.evaluate(() => {
    const el = document.querySelector(".telemetry-viewer__summary");
    if (!el) return "";
    const viewer = document.getElementById("telemetryViewer");
    if (viewer && viewer.hidden) return "";
    return el.textContent || "";
  });
}

/**
 * openAdvancedMode — switches the editor UI to "advanced" complexity mode.
 * Clicks #advancedModeBtn which toggles the mode and re-renders diagnostics.
 */
async function openAdvancedMode(page) {
  // Check current mode first to avoid toggling incorrectly
  const currentMode = await evaluateEditor(page, "state.complexityMode || 'basic'");
  if (currentMode === "advanced") return;
  const btn = page.locator("#advancedModeBtn");
  if (await btn.isVisible()) {
    await btn.click();
    // Wait for state to propagate
    await page.waitForFunction(
      () => globalThis.eval("state.complexityMode") === "advanced",
      undefined,
      { timeout: 5000 }
    );
  }
}

/**
 * openBasicMode — switches back to basic complexity mode.
 */
async function openBasicMode(page) {
  const currentMode = await evaluateEditor(page, "state.complexityMode || 'basic'");
  if (currentMode !== "advanced") return;
  const btn = page.locator("#advancedModeBtn");
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForFunction(
      () => globalThis.eval("state.complexityMode") !== "advanced",
      undefined,
      { timeout: 5000 }
    );
  }
}

/**
 * waitForViewerVisible — waits until #telemetryViewer is not hidden.
 */
async function waitForViewerVisible(page) {
  await page.waitForFunction(
    () => {
      const el = document.getElementById("telemetryViewer");
      return el && !el.hidden;
    },
    undefined,
    { timeout: 5000 }
  );
}

/**
 * getViewerEventCount — counts the number of .telemetry-event items visible in the viewer.
 */
async function getViewerEventCount(page) {
  return page.evaluate(() => {
    const list = document.querySelector(".telemetry-viewer__list");
    if (!list) return 0;
    return list.querySelectorAll(".telemetry-event").length;
  });
}

module.exports = {
  clearTelemetryStorage,
  enableTelemetry,
  disableTelemetry,
  emitTestEvents,
  readViewerSummary,
  openAdvancedMode,
  openBasicMode,
  waitForViewerVisible,
  getViewerEventCount,
  BASIC_MANUAL_BASE_URL,
  TELEMETRY_ENABLED_KEY,
  TELEMETRY_LOG_KEY,
};
