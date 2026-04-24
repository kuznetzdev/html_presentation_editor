"use strict";

// v1.5.2 — unified Undo toast on destructive actions + onboarding wire.

const { test, expect } = require("@playwright/test");
const {
  closeCompactShellPanels,
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
} = require("../helpers/editorApp");

const MULTISLIDE_HTML = `<!DOCTYPE html><html><body>
<section data-slide-id="a"><h1>Slide A</h1></section>
<section data-slide-id="b"><h1>Slide B</h1></section>
<section data-slide-id="c"><h1>Slide C</h1></section>
</body></html>`;

async function loadDeck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
}

test.describe("Unified Undo toast (v1.5.2)", () => {
  test(
    "showUndoToast helper is exposed on window @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const t = await evaluateEditor(page, "typeof showUndoToast");
      expect(t).toBe("function");
    },
  );

  test(
    "showUndoToast renders an Отменить button @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "showUndoToast({ message: 'Тест', title: 'Тест Undo' })",
      );
      const text = await page
        .locator(".toast .toast-action-btn")
        .first()
        .textContent({ timeout: 3_000 });
      expect((text || "").trim()).toBe("Отменить");
    },
  );

  test(
    "Undo button click invokes the undo function @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      await evaluateEditor(
        page,
        "window.__undoCalled = false; showUndoToast({ message: 'X', onUndo: () => { window.__undoCalled = true; } })",
      );
      await page.locator(".toast .toast-action-btn").first().click();
      const fired = await evaluateEditor(page, "window.__undoCalled");
      expect(fired).toBe(true);
    },
  );

  test(
    "TTL is at least 5200ms (V2-07 floor) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Inspect the actual TTL by stubbing setTimeout briefly.
      const ttl = await evaluateEditor(
        page,
        "(() => { const real = window.setTimeout; let captured = 0; window.setTimeout = (fn, ms) => { captured = ms; return real(fn, ms); }; showUndoToast({ message: 'x', ttl: 1000 }); window.setTimeout = real; return captured; })()",
      );
      expect(ttl).toBeGreaterThanOrEqual(5200);
    },
  );

  test(
    "Slide delete shows the unified Undo toast @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Try to delete current slide if more than one.
      const slidesCount = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-slide-id]').length",
      );
      test.skip(slidesCount < 2, "Single-slide fixture; cannot delete");
      await evaluateEditor(page, "deleteCurrentSlide()");
      // Undo button should be present in the toast.
      await expect(
        page.locator(".toast .toast-action-btn").first(),
      ).toHaveText("Отменить", { timeout: 4_000 });
    },
  );

  test(
    "Slide duplicate shows the unified Undo toast @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const slidesCount = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-slide-id]').length",
      );
      test.skip(slidesCount < 1, "No slides");
      await evaluateEditor(page, "duplicateCurrentSlide()");
      await expect(
        page.locator(".toast .toast-action-btn").first(),
      ).toHaveText("Отменить", { timeout: 4_000 });
    },
  );
});

test.describe("Onboarding primer (v1.5.2)", () => {
  test(
    "primeOnboardingV2 is invoked after Smart Import accept @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await page.goto("/editor/presentation-editor.html", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => window.localStorage.clear());
      await page.reload({ waitUntil: "domcontentloaded" });
      // Stub primeOnboardingV2 to record invocation.
      await page.evaluate(() => {
        window.__onboardingPrimed = 0;
        const real = window.primeOnboardingV2;
        window.primeOnboardingV2 = () => {
          window.__onboardingPrimed += 1;
          if (typeof real === "function") return real();
        };
      });
      await page.click("#openHtmlBtn");
      await page.fill(
        "#pasteHtmlTextarea",
        '<!DOCTYPE html><html><body><section><h1>x</h1></section></body></html>',
      );
      await page.click("#loadPastedHtmlBtn");
      // Modal will appear (if smartImport enabled) or skip
      const modalVisible = await page
        .locator("#importReportModal.is-open")
        .isVisible()
        .catch(() => false);
      if (modalVisible) {
        await page
          .locator("#importReportModal [data-import-report-continue]")
          .click();
      }
      const calls = await evaluateEditor(page, "window.__onboardingPrimed");
      expect(calls).toBeGreaterThan(0);
    },
  );
});
