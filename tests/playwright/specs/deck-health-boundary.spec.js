"use strict";

// v1.5.1 — deck health badge + action-boundary integration on slide mutations.

const { test, expect } = require("@playwright/test");
const {
  closeCompactShellPanels,
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
} = require("../helpers/editorApp");

const REVEAL_SAMPLE = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="reveal.css"></head>
<body><div class="reveal"><div class="slides">
<section data-markdown>Slide 1</section>
<section data-markdown>Slide 2</section>
<section>Slide 3</section>
</div></div></body></html>`;

async function loadDeck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
}

async function loadFreshAndOpenViaPaste(page) {
  await page.goto("/editor/presentation-editor.html", {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#openHtmlBtn")).toBeVisible();
}

test.describe("Deck health badge (v1.5.1)", () => {
  test(
    "Badge stays hidden when no deck loaded @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadFreshAndOpenViaPaste(page);
      await expect(page.locator("#deckHealthBadge")).toBeHidden();
    },
  );

  test(
    "Badge appears with framework + slide count after Smart Import @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadFreshAndOpenViaPaste(page);
      await page.click("#openHtmlBtn");
      await page.fill("#pasteHtmlTextarea", REVEAL_SAMPLE);
      await page.click("#loadPastedHtmlBtn");
      // Modal appears; accept it.
      await expect(page.locator("#importReportModal.is-open")).toBeVisible();
      await page
        .locator("#importReportModal [data-import-report-continue]")
        .click();
      await expect(page.locator("#deckHealthBadge")).toBeVisible();
      const text = await page.locator("#deckHealthBadge").textContent();
      expect(text || "").toMatch(/Reveal/);
      expect(text || "").toMatch(/3/);
      const severity = await page
        .locator("#deckHealthBadge")
        .getAttribute("data-severity");
      expect(["low", "medium", "high", "severe"]).toContain(severity);
    },
  );

  test(
    "Cancelling the import modal clears state.importReport @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadFreshAndOpenViaPaste(page);
      await page.click("#openHtmlBtn");
      await page.fill("#pasteHtmlTextarea", REVEAL_SAMPLE);
      await page.click("#loadPastedHtmlBtn");
      await expect(page.locator("#importReportModal.is-open")).toBeVisible();
      await page
        .locator("#importReportModal [data-import-report-cancel]")
        .click();
      const report = await evaluateEditor(page, "state.importReport");
      expect(report).toBeNull();
      await expect(page.locator("#deckHealthBadge")).toBeHidden();
    },
  );

  test(
    "Clicking the badge re-opens the report modal @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadFreshAndOpenViaPaste(page);
      await page.click("#openHtmlBtn");
      await page.fill("#pasteHtmlTextarea", REVEAL_SAMPLE);
      await page.click("#loadPastedHtmlBtn");
      await page
        .locator("#importReportModal [data-import-report-continue]")
        .click();
      await expect(page.locator("#deckHealthBadge")).toBeVisible();
      await page.locator("#deckHealthBadge").click();
      await expect(page.locator("#importReportModal.is-open")).toBeVisible();
    },
  );
});

test.describe("Action boundary on slide mutations (v1.5.1)", () => {
  test(
    "insertSlideFromTemplate goes through withActionBoundary @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const before = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-slide-id]').length",
      );
      // Patch withActionBoundary to record invocations and pass through.
      await evaluateEditor(
        page,
        "window.__boundaryCalls = []; const real = window.withActionBoundary; window.withActionBoundary = function(reason, fn) { window.__boundaryCalls.push(reason); return real(reason, fn); }; insertSlideFromTemplate('section');",
      );
      const calls = await evaluateEditor(page, "window.__boundaryCalls");
      expect(calls.some((c) => c.indexOf("slide-template:") === 0)).toBe(true);
      const after = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-slide-id]').length",
      );
      expect(after).toBe(before + 1);
    },
  );
});
