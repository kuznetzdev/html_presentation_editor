"use strict";

// v1.2.0 / Phase B6 / ADR-035 — Smart Import Pipeline v2 coverage.
// Verifies detectors, inference strategies, complexity scoring, orchestrator
// output, and the report modal gating the load path.

const { test, expect } = require("@playwright/test");
const {
  gotoFreshEditor,
  evaluateEditor,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");

async function runPipeline(page, htmlString) {
  return page.evaluate(
    (html) => window.runImportPipelineV2(html),
    htmlString,
  );
}

const REVEAL_SAMPLE = `<!DOCTYPE html><html><head><link rel="stylesheet" href="reveal.css"></head>
<body><div class="reveal"><div class="slides">
  <section data-markdown>Slide 1</section>
  <section data-background-color="black">Slide 2</section>
  <section>Slide 3</section>
</div></div></body></html>`;

const MARP_SAMPLE = `<!DOCTYPE html><html><head><meta name="marp" content="true"></head>
<body>
  <section data-marpit-slide><h1>Intro</h1></section>
  <section data-marpit-slide><h1>Next</h1></section>
</body></html>`;

const GENERIC_H1_SAMPLE = `<!DOCTYPE html><html><body>
  <h1>First slide</h1><p>Intro text.</p>
  <h1>Second slide</h1><p>More text.</p>
  <h1>Third slide</h1><p>End.</p>
</body></html>`;

const HEAVY_SAMPLE = `<!DOCTYPE html><html><head>
  <style>@import url('https://fonts.googleapis.com/css2?family=Inter');</style>
  <link rel="stylesheet" href="https://cdn.example.com/app.css">
  <script>console.log('inline-1');</script>
  <script>console.log('inline-2');</script>
  <script src="https://example.com/external.js"></script>
</head><body>
  <section class="slide"><h1>Slide 1</h1></section>
  <section class="slide" style="transform: rotate(5deg);"><h1>Slide 2</h1></section>
  <iframe src="https://example.com"></iframe>
  <svg></svg><svg></svg><svg></svg>
</body></html>`;

const SIMPLE_SAMPLE = `<!DOCTYPE html><html><body>
  <section class="slide"><p>hello</p></section>
</body></html>`;

test.describe("Smart Import Pipeline v2 — detectors", () => {
  test(
    "detects reveal.js from .reveal + .slides markers @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, REVEAL_SAMPLE);
      expect(report.ok).toBe(true);
      expect(report.detector.name).toBe("reveal");
      expect(report.detector.confidence).toBeGreaterThan(0.4);
    },
  );

  test(
    "detects Marp from data-marpit-slide markers @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, MARP_SAMPLE);
      expect(report.detector.name).toBe("marp");
    },
  );

  test(
    "falls back to generic for decks without framework fingerprints @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, SIMPLE_SAMPLE);
      expect(report.detector.name).toBe("generic");
    },
  );
});

test.describe("Smart Import Pipeline v2 — slide inference", () => {
  test(
    "explicit strategy for reveal deck @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, REVEAL_SAMPLE);
      expect(report.slides.strategy).toBe("explicit");
      expect(report.slides.count).toBe(3);
    },
  );

  test(
    "explicit strategy for marp deck with 2 slides @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, MARP_SAMPLE);
      expect(report.slides.strategy).toBe("explicit");
      expect(report.slides.count).toBe(2);
    },
  );

  test(
    "h1-split strategy for generic deck with multiple h1 @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, GENERIC_H1_SAMPLE);
      expect(report.slides.strategy).toBe("h1-split");
      expect(report.slides.count).toBe(3);
    },
  );

  test(
    "single-slide fallback for a minimal body @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(
        page,
        "<!DOCTYPE html><html><body><div>bare</div></body></html>",
      );
      expect(report.slides.strategy).toBe("single");
      expect(report.slides.count).toBe(1);
    },
  );
});

test.describe("Smart Import Pipeline v2 — complexity", () => {
  test(
    "low complexity for simple deck (score < 2) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, SIMPLE_SAMPLE);
      expect(report.complexity.score).toBeLessThan(2);
    },
  );

  test(
    "high complexity for heavy deck (score >= 4) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, HEAVY_SAMPLE);
      expect(report.complexity.score).toBeGreaterThanOrEqual(4);
      const kinds = report.complexity.warnings.map((w) => w.kind);
      expect(kinds).toContain("inline-script");
    },
  );

  test(
    "exposes metrics dictionary with node count and depth @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, HEAVY_SAMPLE);
      expect(report.complexity.metrics).toHaveProperty("nodeCount");
      expect(report.complexity.metrics.nodeCount).toBeGreaterThan(0);
      expect(report.complexity.metrics).toHaveProperty("maxDepth");
    },
  );
});

test.describe("Smart Import Pipeline v2 — orchestrator output", () => {
  test(
    "returns ok=false for empty/unparseable input @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, "");
      expect(report.ok).toBe(false);
    },
  );

  test(
    "reports elapsed time in ms @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, REVEAL_SAMPLE);
      expect(typeof report.elapsedMs).toBe("number");
      expect(report.elapsedMs).toBeGreaterThanOrEqual(0);
    },
  );

  test(
    "returns runner-up framework detectors @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const report = await runPipeline(page, REVEAL_SAMPLE);
      expect(Array.isArray(report.detector.runnerUps)).toBe(true);
      expect(report.detector.runnerUps.length).toBeGreaterThan(0);
    },
  );
});

test.describe("Smart Import Pipeline v2 — report modal gating", () => {
  test(
    "Default smartImport flag is 'report' @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      const flag = await evaluateEditor(
        page,
        "window.featureFlags && window.featureFlags.smartImport",
      );
      expect(flag).toBe("report");
    },
  );

  test(
    "Report modal appears when loading HTML via the Open flow @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      await page.click("#openHtmlBtn");
      await page.fill("#pasteHtmlTextarea", REVEAL_SAMPLE);
      await page.click("#loadPastedHtmlBtn");
      await expect(page.locator("#importReportModal.is-open")).toBeVisible();
      await expect(
        page.locator("#importReportModal .import-report-summary"),
      ).toBeVisible();
    },
  );

  test(
    "Clicking Continue loads the deck and closes the modal @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      await page.click("#openHtmlBtn");
      await page.fill("#pasteHtmlTextarea", REVEAL_SAMPLE);
      await page.click("#loadPastedHtmlBtn");
      await expect(page.locator("#importReportModal.is-open")).toBeVisible();
      await page
        .locator("#importReportModal [data-import-report-continue]")
        .click();
      await expect(page.locator("#importReportModal.is-open")).toHaveCount(0);
      await expect
        .poll(() => evaluateEditor(page, "state.modelDoc ? true : false"))
        .toBe(true);
    },
  );

  test(
    "Report modal dialog has opaque background (empty-state not bleeding through) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      await page.click("#openHtmlBtn");
      await page.fill("#pasteHtmlTextarea", REVEAL_SAMPLE);
      await page.click("#loadPastedHtmlBtn");
      await expect(page.locator("#importReportModal.is-open")).toBeVisible();
      // .modal-dialog must resolve to a non-transparent background.
      const bgColor = await page.evaluate(() => {
        const dlg = document.querySelector("#importReportModal .modal-dialog");
        return window.getComputedStyle(dlg).backgroundColor;
      });
      // Color should NOT be 'rgba(0, 0, 0, 0)' or 'transparent'.
      expect(bgColor).not.toBe("rgba(0, 0, 0, 0)");
      expect(bgColor).not.toBe("transparent");
    },
  );

  test(
    "Clicking Cancel aborts the load without updating state.modelDoc @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await gotoFreshEditor(page);
      await page.click("#openHtmlBtn");
      await page.fill("#pasteHtmlTextarea", REVEAL_SAMPLE);
      await page.click("#loadPastedHtmlBtn");
      await expect(page.locator("#importReportModal.is-open")).toBeVisible();
      await page
        .locator("#importReportModal [data-import-report-cancel]")
        .click();
      await expect(page.locator("#importReportModal.is-open")).toHaveCount(0);
      const hasModel = await evaluateEditor(
        page,
        "state.modelDoc ? true : false",
      );
      expect(hasModel).toBe(false);
    },
  );
});
