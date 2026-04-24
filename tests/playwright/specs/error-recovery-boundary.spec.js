"use strict";

// v1.4.2 / Phase E2 — error recovery boundary + input validators coverage.

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

test.describe("user-action-boundary — Phase E2 Layer 4", () => {
  test(
    "withActionBoundary runs fn and returns its result @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const result = await evaluateEditor(
        page,
        "withActionBoundary('test:ok', () => ({ ok: true, v: 42 }))",
      );
      expect(result.ok).toBe(true);
      expect(result.v).toBe(42);
    },
  );

  test(
    "withActionBoundary rolls back modelDoc when fn throws @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const pre = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-node-id]').length",
      );
      const result = await evaluateEditor(
        page,
        "withActionBoundary('test:throw', () => { const el = state.modelDoc.querySelector('[data-editor-node-id]'); el.parentElement.removeChild(el); throw new Error('boom'); })",
      );
      expect(result.ok).toBe(false);
      const post = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-node-id]').length",
      );
      expect(post).toBe(pre);
    },
  );

  test(
    "withActionBoundary rolls back when fn returns { ok: false } @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const pre = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-node-id]').length",
      );
      await evaluateEditor(
        page,
        "withActionBoundary('test:soft-fail', () => { const el = state.modelDoc.querySelector('[data-editor-node-id]'); el.parentElement.removeChild(el); return { ok: false, message: 'nope' }; })",
      );
      const post = await evaluateEditor(
        page,
        "state.modelDoc.querySelectorAll('[data-editor-node-id]').length",
      );
      expect(post).toBe(pre);
    },
  );
});

test.describe("InputValidators — Phase E2 Layer 5", () => {
  test(
    "pixelSize accepts '120' and '120px' @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const a = await evaluateEditor(page, "InputValidators.pixelSize('120')");
      const b = await evaluateEditor(page, "InputValidators.pixelSize('120px')");
      expect(a).toEqual({ ok: true, value: 120 });
      expect(b).toEqual({ ok: true, value: 120 });
    },
  );

  test(
    "pixelSize rejects empty and non-numeric @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const a = await evaluateEditor(page, "InputValidators.pixelSize('')");
      const b = await evaluateEditor(page, "InputValidators.pixelSize('abc')");
      expect(a.ok).toBe(false);
      expect(b.ok).toBe(false);
    },
  );

  test(
    "opacity accepts '0.5' and '50%' → 0.5 @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const a = await evaluateEditor(page, "InputValidators.opacity('0.5')");
      const b = await evaluateEditor(page, "InputValidators.opacity('50%')");
      expect(a).toEqual({ ok: true, value: 0.5 });
      expect(b).toEqual({ ok: true, value: 0.5 });
    },
  );

  test(
    "opacity rejects out-of-range @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const over = await evaluateEditor(page, "InputValidators.opacity('1.5')");
      const neg = await evaluateEditor(page, "InputValidators.opacity('-1')");
      expect(over.ok).toBe(false);
      expect(neg.ok).toBe(false);
    },
  );

  test(
    "url rejects javascript: scheme @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const r = await evaluateEditor(
        page,
        "InputValidators.url('javascript:alert(1)')",
      );
      expect(r.ok).toBe(false);
    },
  );

  test(
    "url accepts https, relative, data:image/ @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const a = await evaluateEditor(
        page,
        "InputValidators.url('https://example.com/x.png')",
      );
      const b = await evaluateEditor(
        page,
        "InputValidators.url('./images/x.png')",
      );
      const c = await evaluateEditor(
        page,
        "InputValidators.url('data:image/png;base64,AAAA')",
      );
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(c.ok).toBe(true);
    },
  );

  test(
    "hexColor expands 3-char and lowercases @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const short = await evaluateEditor(page, "InputValidators.hexColor('#ABC')");
      const long = await evaluateEditor(page, "InputValidators.hexColor('#AABBCC')");
      expect(short).toEqual({ ok: true, value: "#aabbcc" });
      expect(long).toEqual({ ok: true, value: "#aabbcc" });
    },
  );

  test(
    "hexColor rejects missing # and non-hex @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const a = await evaluateEditor(page, "InputValidators.hexColor('ABCDEF')");
      const b = await evaluateEditor(page, "InputValidators.hexColor('#xyz')");
      expect(a.ok).toBe(false);
      expect(b.ok).toBe(false);
    },
  );

  test(
    "cssLength accepts common units and shorthands @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const a = await evaluateEditor(page, "InputValidators.cssLength('12px')");
      const b = await evaluateEditor(page, "InputValidators.cssLength('1.5em')");
      const c = await evaluateEditor(page, "InputValidators.cssLength('8px 12px')");
      const d = await evaluateEditor(page, "InputValidators.cssLength('auto')");
      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(c.value).toBe("8px 12px");
      expect(d.value).toBe("auto");
    },
  );

  test(
    "cssLength rejects more than 4 tokens and bad units @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const a = await evaluateEditor(
        page,
        "InputValidators.cssLength('1px 2px 3px 4px 5px')",
      );
      const b = await evaluateEditor(
        page,
        "InputValidators.cssLength('12foo')",
      );
      expect(a.ok).toBe(false);
      expect(b.ok).toBe(false);
    },
  );
});
