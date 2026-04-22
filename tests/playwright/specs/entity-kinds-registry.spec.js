// entity-kinds-registry.spec.js
// Gate: ADR-016 Layer 1 — entity-kind registry externalization (WO-35)
//
// Verifies that entity-kinds.js correctly exposes window globals on the shell,
// that the bridge receives the injected kinds list, and that the registry is
// consistent between shell and iframe.
//
// Test matrix:
//   EKR1 — window.ENTITY_KINDS is a frozen array of 13 entries, each with id/label/inspectorSections
//   EKR2 — window.ENTITY_KINDS_CANONICAL contains 'text' and does NOT contain 'callout'
//   EKR3 — window.ENTITY_KINDS_KNOWN has exactly 12 entries (excludes 'none')
//   EKR4 — iframe window.__KNOWN_ENTITY_KINDS matches shell ENTITY_KINDS_KNOWN
//   EKR5 — CANONICAL_ENTITY_KINDS (bridge-commands) equals window.ENTITY_KINDS_CANONICAL
//
// All tests run on chromium-desktop only.

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");

test.describe("Entity-kind registry (ADR-016 Layer 1) @stage-ekr", () => {
  test.beforeEach(async ({ page, browserName }, testInfo) => {
    if (!isChromiumOnlyProject(testInfo.project.name)) {
      test.skip();
    }
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });
  });

  test("EKR1 — window.ENTITY_KINDS is a frozen array of 13 entries, each with id/label/inspectorSections", async ({ page }) => {
    const result = await evaluateEditor(page, `
      (function() {
        if (!window.ENTITY_KINDS) return { ok: false, reason: 'not defined' };
        if (!Array.isArray(window.ENTITY_KINDS)) return { ok: false, reason: 'not array' };
        if (window.ENTITY_KINDS.length !== 13) return { ok: false, reason: 'length=' + window.ENTITY_KINDS.length };
        for (var i = 0; i < window.ENTITY_KINDS.length; i++) {
          var k = window.ENTITY_KINDS[i];
          if (typeof k.id !== 'string' || !k.id) return { ok: false, reason: 'entry[' + i + '] missing id' };
          if (typeof k.label !== 'string' || !k.label) return { ok: false, reason: 'entry[' + i + '] missing label' };
          if (!Array.isArray(k.inspectorSections)) return { ok: false, reason: 'entry[' + i + '] inspectorSections not array' };
        }
        // Verify frozen
        var frozen = Object.isFrozen(window.ENTITY_KINDS);
        return { ok: true, frozen: frozen, length: window.ENTITY_KINDS.length };
      })()
    `);
    expect(result.ok).toBe(true);
    expect(result.length).toBe(13);
    expect(result.frozen).toBe(true);
  });

  test("EKR2 — window.ENTITY_KINDS_CANONICAL contains 'text' and does not contain 'callout'", async ({ page }) => {
    const result = await evaluateEditor(page, `
      (function() {
        if (!window.ENTITY_KINDS_CANONICAL) return { ok: false, reason: 'not defined' };
        var hasText = window.ENTITY_KINDS_CANONICAL.has('text');
        var hasCallout = window.ENTITY_KINDS_CANONICAL.has('callout');
        var hasNone = window.ENTITY_KINDS_CANONICAL.has('none');
        return { ok: true, hasText: hasText, hasCallout: hasCallout, hasNone: hasNone, size: window.ENTITY_KINDS_CANONICAL.size };
      })()
    `);
    expect(result.ok).toBe(true);
    expect(result.hasText).toBe(true);
    expect(result.hasCallout).toBe(false);
    expect(result.hasNone).toBe(true);
    expect(result.size).toBe(13);
  });

  test("EKR3 — window.ENTITY_KINDS_KNOWN has exactly 12 entries (excludes 'none')", async ({ page }) => {
    const result = await evaluateEditor(page, `
      (function() {
        if (!window.ENTITY_KINDS_KNOWN) return { ok: false, reason: 'not defined' };
        var hasNone = window.ENTITY_KINDS_KNOWN.has('none');
        var hasText = window.ENTITY_KINDS_KNOWN.has('text');
        return { ok: true, size: window.ENTITY_KINDS_KNOWN.size, hasNone: hasNone, hasText: hasText };
      })()
    `);
    expect(result.ok).toBe(true);
    expect(result.size).toBe(12);
    expect(result.hasNone).toBe(false);
    expect(result.hasText).toBe(true);
  });

  test("EKR4 — iframe window.__KNOWN_ENTITY_KINDS matches shell ENTITY_KINDS_KNOWN", async ({ page }) => {
    const result = await evaluateEditor(page, `
      (function() {
        var iframe = document.getElementById('previewFrame');
        if (!iframe || !iframe.contentWindow) return { ok: false, reason: 'no iframe' };
        var injected = iframe.contentWindow.__KNOWN_ENTITY_KINDS;
        if (!injected) return { ok: false, reason: '__KNOWN_ENTITY_KINDS not injected in iframe' };
        if (!window.ENTITY_KINDS_KNOWN) return { ok: false, reason: 'shell ENTITY_KINDS_KNOWN missing' };
        var shellArr = Array.from(window.ENTITY_KINDS_KNOWN).sort();
        var iframeArr = injected.slice().sort();
        var lengthMatch = shellArr.length === iframeArr.length;
        var match = lengthMatch && shellArr.every(function(v, i) { return v === iframeArr[i]; });
        return { ok: true, match: match, shellSize: shellArr.length, iframeSize: iframeArr.length };
      })()
    `);
    expect(result.ok).toBe(true);
    expect(result.match).toBe(true);
    expect(result.shellSize).toBe(12);
    expect(result.iframeSize).toBe(12);
  });

  test("EKR5 — CANONICAL_ENTITY_KINDS in bridge-commands equals window.ENTITY_KINDS_CANONICAL", async ({ page }) => {
    // CANONICAL_ENTITY_KINDS is a module-level const in bridge-commands.js,
    // assigned as window.ENTITY_KINDS_CANONICAL. Verify via readCanonicalEntityKind().
    const result = await evaluateEditor(page, `
      (function() {
        if (typeof readCanonicalEntityKind !== 'function') return { ok: false, reason: 'readCanonicalEntityKind not found' };
        if (!window.ENTITY_KINDS_CANONICAL) return { ok: false, reason: 'ENTITY_KINDS_CANONICAL not defined' };
        // Check each kind in ENTITY_KINDS is accepted by readCanonicalEntityKind
        var allAccepted = window.ENTITY_KINDS.every(function(k) {
          return readCanonicalEntityKind(k.id) === k.id;
        });
        // 'callout' is rejected
        var calloutRejected = readCanonicalEntityKind('callout') === '';
        return { ok: true, allAccepted: allAccepted, calloutRejected: calloutRejected };
      })()
    `);
    expect(result.ok).toBe(true);
    expect(result.allAccepted).toBe(true);
    expect(result.calloutRejected).toBe(true);
  });
});
