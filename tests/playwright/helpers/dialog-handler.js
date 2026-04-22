/**
 * dialog-handler.js — Stateful dialog subscription helpers (WO-36)
 *
 * Replaces page.once("dialog", ...) patterns which are fragile when:
 *   - A dialog fires before the once() handler is registered.
 *   - A second dialog fires after the once() handler has already consumed the first.
 *   - Test cleanup does not unsubscribe orphaned handlers.
 *
 * All exported helpers return an { unsubscribe } handle so callers can
 * explicitly clean up within a test's afterEach or finally block.
 *
 * Invariants:
 *  - No waitForTimeout usage inside this file.
 *  - Handlers are always unsubscribed after use.
 *  - Unhandled dialogs emit a visible failure, not a silent hang.
 */

"use strict";

const { expect } = require("@playwright/test");

// ─── acceptNextDialog ─────────────────────────────────────────────────────────

/**
 * Register a dialog handler that accepts the next dialog exactly once, then
 * unsubscribes. Returns an { unsubscribe } handle for early cleanup.
 *
 * Usage:
 *   const { unsubscribe } = acceptNextDialog(page);
 *   await page.click("#deleteSlideBtn");
 *   // dialog is accepted automatically
 *   unsubscribe(); // no-op if already consumed
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ message?: string }} [opts]
 * @returns {{ unsubscribe: () => void }}
 */
function acceptNextDialog(page, opts = {}) {
  let consumed = false;

  /** @param {import('@playwright/test').Dialog} dialog */
  function handler(dialog) {
    if (consumed) return;
    consumed = true;
    page.off("dialog", handler);
    dialog.accept().catch(() => {
      // Ignore — dialog may have already been dismissed by page navigation
    });
  }

  page.on("dialog", handler);

  return {
    unsubscribe() {
      if (!consumed) {
        page.off("dialog", handler);
        consumed = true;
      }
    },
  };
}

// ─── dismissNextDialog ────────────────────────────────────────────────────────

/**
 * Register a dialog handler that dismisses the next dialog exactly once.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ message?: string }} [opts]
 * @returns {{ unsubscribe: () => void }}
 */
function dismissNextDialog(page, opts = {}) {
  let consumed = false;

  /** @param {import('@playwright/test').Dialog} dialog */
  function handler(dialog) {
    if (consumed) return;
    consumed = true;
    page.off("dialog", handler);
    dialog.dismiss().catch(() => {});
  }

  page.on("dialog", handler);

  return {
    unsubscribe() {
      if (!consumed) {
        page.off("dialog", handler);
        consumed = true;
      }
    },
  };
}

// ─── acceptAllDialogs ─────────────────────────────────────────────────────────

/**
 * Register a persistent dialog handler that accepts every dialog until
 * explicitly unsubscribed. Useful when multiple sequential dialogs may fire.
 *
 * IMPORTANT: Always call unsubscribe() at the end of the test or in afterEach.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {{ unsubscribe: () => void, count: () => number }}
 */
function acceptAllDialogs(page) {
  let acceptedCount = 0;

  /** @param {import('@playwright/test').Dialog} dialog */
  function handler(dialog) {
    acceptedCount += 1;
    dialog.accept().catch(() => {});
  }

  page.on("dialog", handler);

  return {
    unsubscribe() {
      page.off("dialog", handler);
    },
    /** Returns the number of dialogs accepted so far. */
    count() {
      return acceptedCount;
    },
  };
}

// ─── expectNoUnhandledDialog ──────────────────────────────────────────────────

/**
 * Register a handler that FAILS the test if any dialog fires.
 * Useful for regression tests where no dialog should appear.
 *
 * Returns { unsubscribe } — call it at the end of the test regardless of
 * whether the test passes.
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ reason?: string }} [opts]
 * @returns {{ unsubscribe: () => void }}
 */
function expectNoUnhandledDialog(page, opts = {}) {
  const reason = opts.reason || "No dialog expected in this test";

  /** @param {import('@playwright/test').Dialog} dialog */
  function handler(dialog) {
    page.off("dialog", handler);
    // Dismiss before throwing so the page does not hang
    dialog.dismiss().catch(() => {});
    // Force an assertion failure with context
    expect(
      `Unexpected dialog appeared: "${dialog.message()}"`,
    ).toBe(reason);
  }

  page.on("dialog", handler);

  return {
    unsubscribe() {
      page.off("dialog", handler);
    },
  };
}

module.exports = {
  acceptNextDialog,
  dismissNextDialog,
  acceptAllDialogs,
  expectNoUnhandledDialog,
};
