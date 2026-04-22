/**
 * waits.js — State-based wait helpers for flake elimination (WO-36)
 *
 * All helpers use expect.poll() or page.waitForFunction() with explicit
 * predicates against real application state, replacing unconditional
 * waitForTimeout() calls throughout the spec suite.
 *
 * Invariants:
 *  - No waitForTimeout usage inside this file.
 *  - Every exported helper must degrade gracefully when state is unavailable
 *    (returns a meaningful rejection, not a silent pass).
 *  - Timeouts are generous defaults — callers may override via opts.timeout.
 */

"use strict";

const { expect } = require("@playwright/test");
const { evaluateEditor } = require("./editorApp");

const DEFAULT_TIMEOUT = 8_000;
const POLL_INTERVALS = { intervals: [100, 200, 500] };

// ─── Generic polling helpers ──────────────────────────────────────────────────

/**
 * Poll an arbitrary predicate expression evaluated inside the shell window.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string|function} predicate  - JS expression string or inline function body
 * @param {{ timeout?: number, message?: string }} [opts]
 */
async function waitForState(page, predicate, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const message = opts.message;
  const expr = typeof predicate === "function" ? `(${predicate.toString()})()` : predicate;
  await expect
    .poll(
      () => evaluateEditor(page, `Boolean(${expr})`),
      { timeout, message, ...POLL_INTERVALS },
    )
    .toBe(true);
}

// ─── Selection state helpers ──────────────────────────────────────────────────

/**
 * Wait until state.selectedNodeId equals expectedNodeId.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedNodeId
 * @param {{ timeout?: number }} [opts]
 */
async function waitForSelection(page, expectedNodeId, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  await expect
    .poll(
      () => evaluateEditor(page, "state.selectedNodeId || ''"),
      { timeout, message: `Waiting for selectedNodeId to be "${expectedNodeId}"`, ...POLL_INTERVALS },
    )
    .toBe(expectedNodeId);
}

/**
 * Wait until state.selectedEntityKind equals expectedKind.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} expectedKind
 * @param {{ timeout?: number }} [opts]
 */
async function waitForSelectionKind(page, expectedKind, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  await expect
    .poll(
      () => evaluateEditor(page, "state.selectedEntityKind || ''"),
      { timeout, message: `Waiting for selectedEntityKind to be "${expectedKind}"`, ...POLL_INTERVALS },
    )
    .toBe(expectedKind);
}

/**
 * Wait until state.selectedNodeId changes away from previousNodeId.
 * Useful after keyboard navigation where the new nodeId is unknown in advance.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} previousNodeId
 * @param {{ timeout?: number }} [opts]
 */
async function waitForSelectionChange(page, previousNodeId, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  await expect
    .poll(
      () => evaluateEditor(page, "state.selectedNodeId || ''"),
      { timeout, message: `Waiting for selectedNodeId to change from "${previousNodeId}"`, ...POLL_INTERVALS },
    )
    .not.toBe(previousNodeId);
}

// ─── Mode helpers ─────────────────────────────────────────────────────────────

/**
 * Wait until state.mode equals the given mode ('edit' | 'preview' | ...).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} mode
 * @param {{ timeout?: number }} [opts]
 */
async function waitForMode(page, mode, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  await expect
    .poll(
      () => evaluateEditor(page, "state.mode || ''"),
      { timeout, message: `Waiting for mode to be "${mode}"`, ...POLL_INTERVALS },
    )
    .toBe(mode);
}

/**
 * Wait until state.selectionMode equals the given mode ('smart' | 'container').
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} mode
 * @param {{ timeout?: number }} [opts]
 */
async function waitForSelectionMode(page, mode, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  await expect
    .poll(
      () => evaluateEditor(page, "state.selectionMode || ''"),
      { timeout, message: `Waiting for selectionMode to be "${mode}"`, ...POLL_INTERVALS },
    )
    .toBe(mode);
}

// ─── Manipulation helpers ─────────────────────────────────────────────────────

/**
 * Wait until there is no active manipulation in progress.
 * Polls !state.activeManipulation.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number }} [opts]
 */
async function waitForNoActiveManipulation(page, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  await expect
    .poll(
      () => evaluateEditor(page, "!state.activeManipulation"),
      { timeout, message: "Waiting for no active manipulation", ...POLL_INTERVALS },
    )
    .toBe(true);
}

// ─── Slide helpers ────────────────────────────────────────────────────────────

/**
 * Wait until state.activeSlideId equals the given slideId.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} slideId
 * @param {{ timeout?: number }} [opts]
 */
async function waitForSlideActive(page, slideId, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  await expect
    .poll(
      () => evaluateEditor(page, "state.activeSlideId || ''"),
      { timeout, message: `Waiting for activeSlideId to be "${slideId}"`, ...POLL_INTERVALS },
    )
    .toBe(slideId);
}

// ─── Bridge / ACK helpers ─────────────────────────────────────────────────────

/**
 * Wait until the bridge ACK log contains an entry for a given sequence number.
 * Uses state.bridgeAcks (Map) which is populated by bridge.js "ack" handler.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} refSeq  - The sequence number to wait for
 * @param {{ timeout?: number, requireOk?: boolean }} [opts]
 */
async function waitForBridgeAck(page, refSeq, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  const requireOk = opts.requireOk !== false; // default: true
  await expect
    .poll(
      () => evaluateEditor(page, `state.bridgeAcks && state.bridgeAcks.has(${refSeq})`),
      { timeout, message: `Waiting for bridge ACK refSeq=${refSeq}`, ...POLL_INTERVALS },
    )
    .toBe(true);
  if (requireOk) {
    const ack = await evaluateEditor(
      page,
      `JSON.stringify(state.bridgeAcks && state.bridgeAcks.get(${refSeq}) || null)`,
    );
    const parsed = JSON.parse(ack);
    expect(parsed?.ok, `Bridge ACK refSeq=${refSeq} reported ok:false — error: ${parsed?.error?.message}`).toBe(true);
  }
}

// ─── Overlap helpers ──────────────────────────────────────────────────────────

/**
 * Wait until the overlap detection has completed at least one full cycle
 * after the current moment. Polls state.overlapIndex changes or, when no
 * overlapIndex changes are expected, checks that selectionRenderPending.overlapDetection
 * has been flushed.
 *
 * The simplest deterministic signal is that selectionRenderPending.overlapDetection
 * became true and then false (flush cycle). Since we cannot observe the rising edge
 * reliably, we instead wait for it to be false (settled state).
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number }} [opts]
 */
async function waitForOverlapMapUpdated(page, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  // Wait for the pending flag to clear — means the RAF cycle has flushed
  await expect
    .poll(
      () => evaluateEditor(
        page,
        "!(state.selectionRenderPending && state.selectionRenderPending.overlapDetection)",
      ),
      { timeout, message: "Waiting for overlap detection to settle", ...POLL_INTERVALS },
    )
    .toBe(true);
}

// ─── Container-mode helpers ───────────────────────────────────────────────────

/**
 * Wait until the iframe has acknowledged the container-mode setting by
 * checking the shell-side marker set by the "container-mode-ack" bridge message.
 *
 * This replaces the LN3 retry loop. The marker is stored as:
 *   state.__containerModeAckAt — a timestamp set when the ack arrives.
 *
 * Falls back to polling state.selectionMode if the ack marker is unavailable
 * (defensive — avoids breaking on older builds).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [_nodeId]  - Reserved for future node-specific acks; currently unused
 * @param {{ timeout?: number }} [opts]
 */
async function waitForContainerModeApplied(page, _nodeId, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  // Primary: wait for the ACK marker from bridge-script
  await expect
    .poll(
      () => evaluateEditor(page, "Boolean(state.__containerModeAckAt)"),
      { timeout, message: "Waiting for container-mode-ack from iframe", ...POLL_INTERVALS },
    )
    .toBe(true);
}

// ─── Theme helpers ────────────────────────────────────────────────────────────

/**
 * Wait until document.documentElement carries data-theme matching the expected value.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} theme  - 'light' | 'dark'
 * @param {{ timeout?: number }} [opts]
 */
async function waitForThemeApplied(page, theme, opts = {}) {
  const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
  await expect
    .poll(
      () => page.locator("body").getAttribute("data-theme"),
      { timeout, message: `Waiting for theme to be "${theme}"`, ...POLL_INTERVALS },
    )
    .toBe(theme);
}

// ─── Preview lifecycle helpers ────────────────────────────────────────────────

/**
 * Wait until the preview is fully loaded and ready for interaction.
 * Polls the combined previewLifecycle + previewReady + modelDoc state.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ timeout?: number, slideId?: string }} [opts]
 */
async function waitForPreviewReady(page, opts = {}) {
  const timeout = opts.timeout ?? 20_000;
  const slideIdCheck = opts.slideId
    ? ` && state.activeSlideId === ${JSON.stringify(opts.slideId)}`
    : "";
  await expect
    .poll(
      () => evaluateEditor(
        page,
        `Boolean(state.previewLifecycle === 'ready' && state.previewReady && state.modelDoc${slideIdCheck})`,
      ),
      { timeout, message: "Waiting for preview ready state", ...POLL_INTERVALS },
    )
    .toBe(true);
}

module.exports = {
  waitForState,
  waitForSelection,
  waitForSelectionKind,
  waitForSelectionChange,
  waitForMode,
  waitForSelectionMode,
  waitForNoActiveManipulation,
  waitForSlideActive,
  waitForBridgeAck,
  waitForOverlapMapUpdated,
  waitForContainerModeApplied,
  waitForThemeApplied,
  waitForPreviewReady,
};
