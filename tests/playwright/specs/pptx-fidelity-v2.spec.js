"use strict";

// v1.4.0 / Phase D5 / ADR-036 — PPTX Fidelity v2 helper coverage.

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

test.describe("PPTX Fidelity v2 — Phase D5", () => {
  test(
    "Default pptxV2 flag is true @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const flag = await evaluateEditor(page, "window.featureFlags.pptxV2");
      expect(flag).toBe(true);
    },
  );

  test(
    "ExportPptxV2 namespace exposes all helpers @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const keys = await evaluateEditor(
        page,
        "Object.keys(window.ExportPptxV2 || {}).sort()",
      );
      [
        "WEB_TO_PPTX",
        "buildPreflightReport",
        "describeBackgroundImage",
        "describeSvgPrimitive",
        "describeSvgRoot",
        "directionToDegrees",
        "parseLinearGradient",
        "preflight",
        "pxToEmu",
        "pxToInch",
        "resolveAllRects",
        "resolveFontFallback",
        "resolveSlideRelativeRect",
        "run",
      ].forEach((k) => {
        expect(keys).toContain(k);
      });
    },
  );

  test(
    "resolveFontFallback maps Inter → Segoe UI @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const got = await evaluateEditor(
        page,
        "window.ExportPptxV2.resolveFontFallback('Inter, sans-serif')",
      );
      expect(got).toBe("Segoe UI");
    },
  );

  test(
    "resolveFontFallback handles unknown family — passes through capitalized @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const got = await evaluateEditor(
        page,
        "window.ExportPptxV2.resolveFontFallback('SuperRare, serif')",
      );
      expect(got).toBe("Superrare");
    },
  );

  test(
    "pxToEmu converts using 914400/96 @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const emu = await evaluateEditor(page, "window.ExportPptxV2.pxToEmu(96)");
      expect(emu).toBe(914400);
    },
  );

  test(
    "parseLinearGradient parses 'to right' direction + stops @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const result = await evaluateEditor(
        page,
        "window.ExportPptxV2.parseLinearGradient('linear-gradient(to right, #fff 0%, #000 100%)')",
      );
      expect(result.kind).toBe("linear");
      expect(result.angle).toBe(90);
      expect(result.stops.length).toBe(2);
      expect(result.stops[0].color).toBe("#fff");
      expect(result.stops[0].position).toBe(0);
      expect(result.stops[1].position).toBe(1);
    },
  );

  test(
    "describeBackgroundImage flags radial → raster @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const result = await evaluateEditor(
        page,
        "window.ExportPptxV2.describeBackgroundImage('radial-gradient(circle, red, blue)')",
      );
      expect(result.kind).toBe("raster");
    },
  );

  test(
    "describeSvgRoot returns rasterize for SVG with paths @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const got = await evaluateEditor(
        page,
        "(() => { const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); const path = document.createElementNS('http://www.w3.org/2000/svg','path'); svg.appendChild(path); return window.ExportPptxV2.describeSvgRoot(svg).kind; })()",
      );
      expect(got).toBe("rasterize");
    },
  );

  test(
    "describeSvgPrimitive maps <rect> @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const got = await evaluateEditor(
        page,
        "(() => { const r = document.createElementNS('http://www.w3.org/2000/svg','rect'); r.setAttribute('x','5'); r.setAttribute('y','10'); r.setAttribute('width','100'); r.setAttribute('height','50'); return window.ExportPptxV2.describeSvgPrimitive(r); })()",
      );
      expect(got).toMatchObject({ kind: "rect", x: 5, y: 10, w: 100, h: 50 });
    },
  );

  test(
    "buildPreflightReport returns ok=true for loaded deck @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const report = await evaluateEditor(
        page,
        "window.ExportPptxV2.buildPreflightReport(state.modelDoc)",
      );
      expect(report.ok).toBe(true);
      expect(report.slideCount).toBeGreaterThan(0);
      expect(report.elementCount).toBeGreaterThan(0);
      expect(report.preserved).toBeDefined();
      expect(Array.isArray(report.warnings)).toBe(true);
    },
  );

  test(
    "ExportPptxV2.preflight() returns the same object as buildPreflightReport @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const a = await evaluateEditor(
        page,
        "window.ExportPptxV2.preflight().elementCount",
      );
      const b = await evaluateEditor(
        page,
        "window.ExportPptxV2.buildPreflightReport(state.modelDoc).elementCount",
      );
      expect(a).toBe(b);
    },
  );
});
