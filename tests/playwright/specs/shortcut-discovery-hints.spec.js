"use strict";

// v2.0.9 — Contextual shortcut discovery hints.
//
// Three power-user shortcuts that the existing first-session primer
// doesn't cover: Ctrl+G/Ctrl+Shift+G after first multi-select,
// Ctrl+click vs Alt+click after first overlap cycle, and the
// Alt+click ↔ Shift+Enter parity. Each fires AT MOST once per user
// (localStorage-tracked) and only when the corresponding action has
// just succeeded.

const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
  closeCompactShellPanels,
  clickPreview,
} = require("../helpers/editorApp");

async function loadDeck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
  await clickPreview(page, '[data-node-id="hero-title"]');
  // Reset onboarding so each test starts with a clean slate.
  await evaluateEditor(page, "resetOnboardingV2 && resetOnboardingV2()");
}

test.describe("Shortcut discovery hints (v2.0.9)", () => {
  test(
    "All three hint helpers are exposed on window @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const exposed = await evaluateEditor(
        page,
        "({ overlap: typeof window.hintAfterFirstOverlapCycle === 'function', multi: typeof window.hintAfterFirstMultiSelect === 'function', alt: typeof window.hintAfterFirstAltClick === 'function' })",
      );
      expect(exposed).toEqual({ overlap: true, multi: true, alt: true });
    },
  );

  test(
    "hintAfterFirstOverlapCycle shows Ctrl+click / Alt+click toast @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "hintAfterFirstOverlapCycle()");
      await expect(
        page.locator(".toast", { hasText: "Ctrl+клик" }),
      ).toBeVisible({ timeout: 3000 });
    },
  );

  test(
    "hintAfterFirstMultiSelect shows Ctrl+G / Ctrl+Shift+G toast @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "hintAfterFirstMultiSelect()");
      await expect(
        page.locator(".toast", { hasText: "Ctrl+G" }),
      ).toBeVisible({ timeout: 3000 });
    },
  );

  test(
    "hintAfterFirstAltClick shows Alt+click ↔ Shift+Enter parity toast @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "hintAfterFirstAltClick()");
      await expect(
        page.locator(".toast", { hasText: "Alt+клик" }),
      ).toBeVisible({ timeout: 3000 });
    },
  );

  test(
    "Each hint fires at most once per user (idempotent on second call) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // First call fires the toast and returns true.
      const first = await evaluateEditor(page, "hintAfterFirstAltClick()");
      expect(first).toBe(true);
      // Second call returns false without spawning another toast.
      const second = await evaluateEditor(page, "hintAfterFirstAltClick()");
      expect(second).toBe(false);
    },
  );

  test(
    "resetOnboardingV2 re-arms all hints @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Fire and confirm idempotent.
      const armed = await evaluateEditor(page, "hintAfterFirstMultiSelect()");
      expect(armed).toBe(true);
      const refired = await evaluateEditor(page, "hintAfterFirstMultiSelect()");
      expect(refired).toBe(false);
      // Reset and verify it fires again.
      await evaluateEditor(page, "resetOnboardingV2()");
      const reArmed = await evaluateEditor(page, "hintAfterFirstMultiSelect()");
      expect(reArmed).toBe(true);
    },
  );
});
