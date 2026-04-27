"use strict";

// v2.0.13 — Bridge mutation-path security regression suite (SEC-001/002/003).
//
// The audit (docs/AUDIT-REPORT-2026-04-26.md) found three exploitable bypasses
// in the bridge mutation paths:
//   - SEC-001: apply-style accepted styleName='cssText' (CSSOM mass-overwrite)
//   - SEC-002: update-attributes did not reject javascript:/vbscript:/etc on
//              URL-bearing attributes (href, src, action, formaction, srcdoc, ...)
//   - SEC-003: replace-image-src did not validate the src protocol
//
// This spec asserts the bridge boundary now rejects every documented unsafe
// payload AND that the schema layer rejects matching shapes (defence-in-depth:
// schema first so unauthenticated callers get clear validation errors;
// handler second so a future schema bypass cannot reach the live DOM).

const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
  closeCompactShellPanels,
  clickPreview,
} = require("../helpers/editorApp");
const {
  captureCommandSeq,
  waitForCommandSeqAdvance,
  waitForPreviewReady,
} = require("../helpers/waits");

async function loadDeck(page) {
  await loadReferenceDeck(page, "v1-selection-engine-v2", { mode: "edit" });
  await closeCompactShellPanels(page);
  await clickPreview(page, '[data-node-id="hero-title"]');
  await evaluateEditor(page, "setComplexityMode('advanced')");
  await expect.poll(() => evaluateEditor(page, "state.complexityMode")).toBe("advanced");
}

test.describe("Bridge mutation-path security (v2.0.13)", () => {
  // ── SEC-001 — apply-style cssText rejection ─────────────────────────────
  test(
    "SEC-001 — schema rejects apply-style { styleName: 'cssText' } @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const result = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateMessage({ type: 'apply-style', nodeId: state.selectedNodeId, styleName: 'cssText', value: 'background:red' })",
      );
      expect(result.ok).toBe(false);
      expect(result.errors.join(" ")).toMatch(/cssText|CSSOM shorthand/);
    },
  );

  test(
    "SEC-001 — schema rejects apply-styles map containing 'cssText' key @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const result = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateMessage({ type: 'apply-styles', nodeId: state.selectedNodeId, styles: { cssText: 'background:red', color: 'blue' } })",
      );
      expect(result.ok).toBe(false);
      expect(result.errors.join(" ")).toMatch(/cssText|CSSOM shorthand/);
    },
  );

  test(
    "SEC-001 — apply-style with cssText does NOT mutate inline-style (handler reject) @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const before = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').getAttribute('style') || ''",
      );
      // Force-send the message at the bridge boundary, bypassing schema
      // (sendToBridge calls validateMessage; we want to confirm the
      // handler ALSO rejects in case schema is ever bypassed).
      const priorSeq = await captureCommandSeq(page);
      await evaluateEditor(
        page,
        "sendToBridge('apply-style', { nodeId: state.selectedNodeId, styleName: 'cssText', value: 'pointer-events:none;background:red' })",
      );
      await waitForCommandSeqAdvance(page, priorSeq);
      const after = await evaluateEditor(
        page,
        "state.modelDoc.querySelector('[data-editor-node-id=\"' + state.selectedNodeId + '\"]').getAttribute('style') || ''",
      );
      expect(after).toBe(before);
    },
  );

  // ── SEC-002 — update-attributes URL validation ─────────────────────────
  test(
    "SEC-002 — update-attributes drops href: javascript: @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      // Use any available <a> inside the selected slide; if none, create one
      // synthetically inside modelDoc and sync via insert-element.
      const targetId = await evaluateEditor(
        page,
        "(() => { const el = state.modelDoc.querySelector('a[data-editor-node-id]'); return el ? el.getAttribute('data-editor-node-id') : state.selectedNodeId; })()",
      );
      const before = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(targetId)} + '"]'); return el ? (el.getAttribute('href') || '') : ''; })()`,
      );
      const priorSeq = await captureCommandSeq(page);
      await evaluateEditor(
        page,
        `sendToBridge('update-attributes', { nodeId: ${JSON.stringify(targetId)}, attrs: { href: 'javascript:alert(1)' } })`,
      );
      await waitForCommandSeqAdvance(page, priorSeq);
      const after = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(targetId)} + '"]'); return el ? (el.getAttribute('href') || '') : ''; })()`,
      );
      // href must NOT have been set to javascript:; either unchanged or empty
      expect(after).toBe(before);
    },
  );

  test(
    "SEC-002 — update-attributes drops formaction: vbscript: @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const targetId = await evaluateEditor(page, "state.selectedNodeId");
      const priorSeq = await captureCommandSeq(page);
      await evaluateEditor(
        page,
        `sendToBridge('update-attributes', { nodeId: ${JSON.stringify(targetId)}, attrs: { formaction: 'vbscript:msgbox(1)' } })`,
      );
      await waitForCommandSeqAdvance(page, priorSeq);
      const value = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(targetId)} + '"]'); return el ? (el.getAttribute('formaction') || '') : ''; })()`,
      );
      expect(value).toBe("");
    },
  );

  test(
    "SEC-002 — update-attributes drops srcdoc with inline script @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const targetId = await evaluateEditor(page, "state.selectedNodeId");
      // srcdoc with javascript: as content — full fragment is treated as URL
      // by URL_BEARING_ATTRS path; should drop.
      const priorSeq = await captureCommandSeq(page);
      await evaluateEditor(
        page,
        `sendToBridge('update-attributes', { nodeId: ${JSON.stringify(targetId)}, attrs: { srcdoc: 'javascript:alert(1)' } })`,
      );
      await waitForCommandSeqAdvance(page, priorSeq);
      const value = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(targetId)} + '"]'); return el ? (el.getAttribute('srcdoc') || '') : ''; })()`,
      );
      expect(value).toBe("");
    },
  );

  test(
    "SEC-002 — update-attributes still accepts safe https URL @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const targetId = await evaluateEditor(
        page,
        "(() => { const el = state.modelDoc.querySelector('a[data-editor-node-id]'); return el ? el.getAttribute('data-editor-node-id') : state.selectedNodeId; })()",
      );
      const priorSeq = await captureCommandSeq(page);
      await evaluateEditor(
        page,
        `sendToBridge('update-attributes', { nodeId: ${JSON.stringify(targetId)}, attrs: { href: 'https://example.com/path' } })`,
      );
      await waitForCommandSeqAdvance(page, priorSeq);
      const value = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(targetId)} + '"]'); return el ? (el.getAttribute('href') || '') : ''; })()`,
      );
      expect(value).toBe("https://example.com/path");
    },
  );

  // ── SEC-003 — replace-image-src URL protocol validation ─────────────────
  test(
    "SEC-003 — replace-image-src rejects javascript: protocol @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      // [v2.0.13] Inject an <img> into the active slide model so the test
      // doesn't depend on the fixture having one. Synthetic node carries
      // a fresh data-editor-node-id and bridge-script's findNodeById will
      // route to it.
      await loadDeck(page);
      const imgId = await evaluateEditor(
        page,
        "(() => { const slide = state.modelDoc.querySelector('[data-editor-slide-id=\"' + state.activeSlideId + '\"]'); if (!slide) return null; let img = slide.querySelector('img[data-editor-node-id]'); if (!img) { img = state.modelDoc.createElement('img'); img.setAttribute('src', 'https://example.test/placeholder.png'); img.setAttribute('alt', 'placeholder'); img.setAttribute('data-editor-node-id', 'security-test-img'); img.setAttribute('data-editor-entity-kind', 'image'); slide.appendChild(img); rebuildPreviewKeepingContext(state.activeSlideId); } return img.getAttribute('data-editor-node-id'); })()",
      );
      test.skip(!imgId, "Could not synthesize image node for SEC-003 test");
      await waitForPreviewReady(page);
      const before = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(imgId)} + '"]'); return el ? (el.getAttribute('src') || '') : ''; })()`,
      );
      const priorSeq = await captureCommandSeq(page);
      await evaluateEditor(
        page,
        `sendToBridge('replace-image-src', { nodeId: ${JSON.stringify(imgId)}, src: 'javascript:alert(1)' })`,
      );
      await waitForCommandSeqAdvance(page, priorSeq);
      const after = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(imgId)} + '"]'); return el ? (el.getAttribute('src') || '') : ''; })()`,
      );
      expect(after).toBe(before);
    },
  );

  test(
    "SEC-003 — replace-image-src rejects vbscript: protocol @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      // [v2.0.13] Inject an <img> into the active slide model so the test
      // doesn't depend on the fixture having one. Synthetic node carries
      // a fresh data-editor-node-id and bridge-script's findNodeById will
      // route to it.
      await loadDeck(page);
      const imgId = await evaluateEditor(
        page,
        "(() => { const slide = state.modelDoc.querySelector('[data-editor-slide-id=\"' + state.activeSlideId + '\"]'); if (!slide) return null; let img = slide.querySelector('img[data-editor-node-id]'); if (!img) { img = state.modelDoc.createElement('img'); img.setAttribute('src', 'https://example.test/placeholder.png'); img.setAttribute('alt', 'placeholder'); img.setAttribute('data-editor-node-id', 'security-test-img'); img.setAttribute('data-editor-entity-kind', 'image'); slide.appendChild(img); rebuildPreviewKeepingContext(state.activeSlideId); } return img.getAttribute('data-editor-node-id'); })()",
      );
      test.skip(!imgId, "Could not synthesize image node for SEC-003 test");
      await waitForPreviewReady(page);
      const before = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(imgId)} + '"]'); return el ? (el.getAttribute('src') || '') : ''; })()`,
      );
      const priorSeq = await captureCommandSeq(page);
      await evaluateEditor(
        page,
        `sendToBridge('replace-image-src', { nodeId: ${JSON.stringify(imgId)}, src: 'vbscript:msgbox(1)' })`,
      );
      await waitForCommandSeqAdvance(page, priorSeq);
      const after = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(imgId)} + '"]'); return el ? (el.getAttribute('src') || '') : ''; })()`,
      );
      expect(after).toBe(before);
    },
  );

  test(
    "SEC-003 — replace-image-src accepts data:image/png @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      // [v2.0.13] Inject an <img> into the active slide model so the test
      // doesn't depend on the fixture having one. Synthetic node carries
      // a fresh data-editor-node-id and bridge-script's findNodeById will
      // route to it.
      await loadDeck(page);
      const imgId = await evaluateEditor(
        page,
        "(() => { const slide = state.modelDoc.querySelector('[data-editor-slide-id=\"' + state.activeSlideId + '\"]'); if (!slide) return null; let img = slide.querySelector('img[data-editor-node-id]'); if (!img) { img = state.modelDoc.createElement('img'); img.setAttribute('src', 'https://example.test/placeholder.png'); img.setAttribute('alt', 'placeholder'); img.setAttribute('data-editor-node-id', 'security-test-img'); img.setAttribute('data-editor-entity-kind', 'image'); slide.appendChild(img); rebuildPreviewKeepingContext(state.activeSlideId); } return img.getAttribute('data-editor-node-id'); })()",
      );
      test.skip(!imgId, "Could not synthesize image node for SEC-003 test");
      await waitForPreviewReady(page);
      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
      const priorSeq = await captureCommandSeq(page);
      await evaluateEditor(
        page,
        `sendToBridge('replace-image-src', { nodeId: ${JSON.stringify(imgId)}, src: ${JSON.stringify(dataUri)} })`,
      );
      await waitForCommandSeqAdvance(page, priorSeq);
      const after = await evaluateEditor(
        page,
        `(() => { const el = state.modelDoc.querySelector('[data-editor-node-id="' + ${JSON.stringify(imgId)} + '"]'); return el ? (el.getAttribute('src') || '') : ''; })()`,
      );
      expect(after).toBe(dataUri);
    },
  );

  // ── SEC-005 — three previously-unregistered types now in schema ────────
  test(
    "SEC-005 — runtime-warn / container-mode-ack / sibling-rects-response are now registered @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await loadDeck(page);
      const knowsAll = await evaluateEditor(
        page,
        "(() => { const m = window.BRIDGE_SCHEMA.MESSAGES || window.BRIDGE_SCHEMA; const v = window.BRIDGE_SCHEMA.validateMessage; return [v({type:'runtime-warn'}).ok || v({type:'runtime-warn'}).errors.join(' ').indexOf('Unknown message type') === -1, v({type:'container-mode-ack'}).errors.join(' ').indexOf('Unknown message type') === -1, v({type:'sibling-rects-response'}).errors.join(' ').indexOf('Unknown message type') === -1]; })()",
      );
      expect(knowsAll).toEqual([true, true, true]);
    },
  );
});
