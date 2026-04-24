"use strict";

// v1.5.3 — Import corpus regression: 10 reference HTML decks fed through
// pipeline-v2 detector + slide inference. Catches detector regressions,
// strategy drift, and complexity-score outliers in one place.

const { test, expect } = require("@playwright/test");
const { CORPUS } = require("../../fixtures/import-corpus/index.js");
const {
  evaluateEditor,
  isChromiumOnlyProject,
  gotoFreshEditor,
} = require("../helpers/editorApp");

async function preparePipelinePage(page) {
  await gotoFreshEditor(page);
}

async function runPipeline(page, htmlString) {
  return page.evaluate(
    (html) => window.runImportPipelineV2(html),
    htmlString,
  );
}

test.describe("Import corpus regression — v1.5.3", () => {
  test(
    "Corpus has at least 10 entries @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await preparePipelinePage(page);
      expect(CORPUS.length).toBeGreaterThanOrEqual(10);
    },
  );

  for (const entry of CORPUS) {
    test(
      "[" + entry.id + "] detector picks " + entry.expectedFramework + " @stage-f",
      async ({ page }, testInfo) => {
        test.skip(!isChromiumOnlyProject(testInfo.project.name));
        await preparePipelinePage(page);
        const report = await runPipeline(page, entry.html);
        expect(report.ok).toBe(true);
        expect(report.detector.name).toBe(entry.expectedFramework);
      },
    );

    test(
      "[" + entry.id + "] inference strategy = " + entry.expectedStrategy + " @stage-f",
      async ({ page }, testInfo) => {
        test.skip(!isChromiumOnlyProject(testInfo.project.name));
        await preparePipelinePage(page);
        const report = await runPipeline(page, entry.html);
        expect(report.slides.strategy).toBe(entry.expectedStrategy);
        expect(report.slides.count).toBeGreaterThanOrEqual(entry.minSlides);
      },
    );
  }

  test(
    "Corpus complexity scores fall within 0..10 @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await preparePipelinePage(page);
      for (const entry of CORPUS) {
        const report = await runPipeline(page, entry.html);
        expect(report.complexity.score).toBeGreaterThanOrEqual(0);
        expect(report.complexity.score).toBeLessThanOrEqual(10);
      }
    },
  );
});
