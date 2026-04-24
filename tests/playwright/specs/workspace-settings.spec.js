"use strict";

// v2.0.2 — Workspace settings (Reset onboarding + Reset feature flags).

const { test, expect } = require("@playwright/test");
const {
  closeCompactShellPanels,
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
} = require("../helpers/editorApp");

async function loadDeck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
}

test.describe("Workspace settings (v2.0.2)", () => {
  test(
    "Settings section is attached to the DOM @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await expect(page.locator("#workspaceSettingsSection")).toBeAttached();
    },
  );

  test(
    "Reset onboarding button is present and clickable @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const btn = page.locator("#resetOnboardingBtn");
      await expect(btn).toBeVisible();
      await expect(btn).toBeEnabled();
    },
  );

  test(
    "Reset onboarding button clears seen-flags + shows toast @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Pre-seed one onboarding key.
      await evaluateEditor(
        page,
        "window.localStorage.setItem('presentation-editor:onboarding-v2:v1', JSON.stringify({ 'first-load-select': true }))",
      );
      await page.locator("#resetOnboardingBtn").click();
      const storageAfter = await page.evaluate(() =>
        window.localStorage.getItem("presentation-editor:onboarding-v2:v1"),
      );
      expect(storageAfter).toBeNull();
      // Success toast surfaces.
      await expect(page.locator(".toast").first()).toBeVisible();
    },
  );

  test(
    "Reset feature flags button is advanced-only @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // In basic mode (default), the advanced button is hidden.
      const mode = await evaluateEditor(page, "state.complexityMode");
      expect(mode).toBe("basic");
      await expect(page.locator("#resetFeatureFlagsBtn")).toBeHidden();
      // Switch to advanced → becomes visible.
      await evaluateEditor(page, "setComplexityMode('advanced')");
      await expect(page.locator("#resetFeatureFlagsBtn")).toBeVisible();
    },
  );

  test(
    "Settings section is hidden on empty state @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await page.goto("/editor/presentation-editor.html", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => window.localStorage.clear());
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#openHtmlBtn")).toBeVisible();
      // Inspector panel (which contains settings) is not visible on empty state.
      await expect(
        page.locator("#workspaceSettingsSection"),
      ).toBeAttached(); // attached but hidden via inspector
      const visible = await page
        .locator("#workspaceSettingsSection")
        .isVisible();
      expect(visible).toBe(false);
    },
  );
});
