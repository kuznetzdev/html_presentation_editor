"use strict";

// v1.4.3 / Phase E3 — onboarding v2 + a11y surface coverage.

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

test.describe("Onboarding v2 — Phase E3", () => {
  test(
    "window.showHintOnce is exposed @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const fn = await evaluateEditor(page, "typeof showHintOnce");
      expect(fn).toBe("function");
    },
  );

  test(
    "showHintOnce returns true the first time, false the second @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const first = await evaluateEditor(
        page,
        "showHintOnce('test-key-x', 'Hi')",
      );
      const second = await evaluateEditor(
        page,
        "showHintOnce('test-key-x', 'Hi again')",
      );
      expect(first).toBe(true);
      expect(second).toBe(false);
    },
  );

  test(
    "resetOnboardingV2 clears the seen flags @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(page, "showHintOnce('test-key-reset', 'x')");
      await evaluateEditor(page, "resetOnboardingV2()");
      const after = await evaluateEditor(
        page,
        "showHintOnce('test-key-reset', 'y')",
      );
      expect(after).toBe(true);
    },
  );

  test(
    "Three entry-point helpers exist: hintAfterFirstLoad/Select/Edit @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const types = await evaluateEditor(
        page,
        "[typeof hintAfterFirstLoad, typeof hintAfterFirstSelect, typeof hintAfterFirstEdit]",
      );
      expect(types).toEqual(["function", "function", "function"]);
    },
  );

  test(
    "primeOnboardingV2 is a no-op when localStorage has all keys set @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "window.localStorage.setItem('presentation-editor:onboarding-v2:v1', JSON.stringify({ 'first-load-select': true, 'first-select-dblclick': true, 'first-edit-shortcuts': true }))",
      );
      // primeOnboardingV2 defers via rAF; we just assert it doesn't throw.
      await evaluateEditor(page, "primeOnboardingV2()");
      // And confirm no new key was added.
      const keys = await evaluateEditor(
        page,
        "Object.keys(JSON.parse(window.localStorage.getItem('presentation-editor:onboarding-v2:v1')))",
      );
      expect(keys.sort()).toEqual(
        ["first-edit-shortcuts", "first-load-select", "first-select-dblclick"],
      );
    },
  );
});

test.describe("A11y aria-live surfaces — Phase E3", () => {
  test(
    "#saveStatePill has aria-live='polite' @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const aria = await page
        .locator("#saveStatePill")
        .getAttribute("aria-live");
      expect(aria).toBe("polite");
    },
  );

  test(
    "#saveStatePill has aria-atomic='true' @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const aria = await page
        .locator("#saveStatePill")
        .getAttribute("aria-atomic");
      expect(aria).toBe("true");
    },
  );

  test(
    "#previewLoading has role=status + aria-live='polite' @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const role = await page.locator("#previewLoading").getAttribute("role");
      const aria = await page
        .locator("#previewLoading")
        .getAttribute("aria-live");
      expect(role).toBe("status");
      expect(aria).toBe("polite");
    },
  );
});
