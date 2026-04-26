"use strict";

// v2.0.14 — SEC-004 inbound schema validation.
// The shell's bindMessages handler is now wrapped with
// BRIDGE_SCHEMA.validateMessage on EVERY inbound message (except hello,
// which keeps its bespoke protocol-mismatch UX). Malformed payloads must
// be rejected with an `inbound-rejected:<type>:<reason>` diagnostic and
// never reach the per-case dispatcher.

const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  isChromiumOnlyProject,
  gotoFreshEditor,
  loadBasicDeck,
} = require("../helpers/editorApp");

async function loadDeck(page) {
  await gotoFreshEditor(page);
  await loadBasicDeck(page);
  // Wait for bridge handshake to finish so state.bridgeToken is set.
  await page.waitForFunction(
    () => Boolean(typeof state !== "undefined" && state && state.bridgeToken)
  );
}

/**
 * Inject a postMessage from inside the iframe so event.source matches the
 * preview frame's contentWindow (otherwise the shell rejects on source check
 * before ever invoking the validator).
 */
async function injectInbound(page, message) {
  return page.evaluate(async (msg) => {
    const token = (typeof state !== "undefined" && state && state.bridgeToken)
      ? state.bridgeToken
      : null;
    if (!token) throw new Error("no bridgeToken on shell");
    const frame = document.getElementById("previewFrame");
    if (!frame || !frame.contentWindow) throw new Error("no previewFrame");
    // Snapshot diagnostics length to compare after.
    const before = (typeof state !== "undefined" && Array.isArray(state.diagnostics))
      ? state.diagnostics.length
      : 0;
    // Build envelope inside iframe so source matches contentWindow.
    await frame.contentWindow.eval(
      "parent.postMessage(" + JSON.stringify({
        __presentationEditor: true,
        token: token,
        ...msg,
      }) + ", '*')"
    );
    // Yield to message loop.
    await new Promise((r) => setTimeout(r, 60));
    const after = (typeof state !== "undefined" && Array.isArray(state.diagnostics))
      ? state.diagnostics.slice(before)
      : [];
    return after;
  }, message);
}

test.describe("Bridge inbound schema validation (v2.0.14 / SEC-004)", () => {
  test("accepts valid bridge-heartbeat (schema-free)", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadDeck(page);
    const diags = await injectInbound(page, {
      type: "bridge-heartbeat",
      payload: {},
    });
    expect(
      diags.some((d) => /inbound-rejected:bridge-heartbeat/.test(d))
    ).toBe(false);
  });

  test("accepts valid ack with proper shape", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadDeck(page);
    const diags = await injectInbound(page, {
      type: "ack",
      payload: { refSeq: 12345, ok: true },
    });
    expect(
      diags.some((d) => /inbound-rejected:ack/.test(d))
    ).toBe(false);
  });

  test("rejects ack missing refSeq", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadDeck(page);
    const diags = await injectInbound(page, {
      type: "ack",
      payload: { ok: true },
    });
    expect(
      diags.some((d) => /inbound-rejected:ack/.test(d))
    ).toBe(true);
  });

  test("rejects ack with wrong type for ok field", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadDeck(page);
    const diags = await injectInbound(page, {
      type: "ack",
      payload: { refSeq: 7, ok: "yes-please" },
    });
    expect(
      diags.some((d) => /inbound-rejected:ack/.test(d))
    ).toBe(true);
  });

  test("rejects unknown message type", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadDeck(page);
    const diags = await injectInbound(page, {
      type: "totally-fabricated-type",
      payload: { whatever: 1 },
    });
    expect(
      diags.some((d) => /inbound-rejected:totally-fabricated-type/.test(d))
    ).toBe(true);
  });

  test("rejects missing type entirely", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadDeck(page);
    // Payload-only — no type. The shell's pre-validation drops it on
    // data.type lookup; our top-level validator additionally rejects via
    // 'message.type must be a non-empty string' when type is undefined.
    // Here we send empty-string type so the rejection diagnostic fires.
    const diags = await injectInbound(page, {
      type: "",
      payload: {},
    });
    // Empty-string type short-circuits to the schema rejection.
    expect(
      diags.some((d) => /inbound-rejected/.test(d))
    ).toBe(true);
  });

  test("schema-free types (slide-activation) pass through unchanged", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadDeck(page);
    const diags = await injectInbound(page, {
      type: "slide-activation",
      payload: { slideId: "deck-slide-1", index: 0 },
    });
    expect(
      diags.some((d) => /inbound-rejected:slide-activation/.test(d))
    ).toBe(false);
  });

  test("prototype-pollution payload key rejected for ack (refSeq invalid)", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadDeck(page);
    // __proto__ as a payload key: even if eval-deserialized, the
    // Object.create(null) flatten in bridge.js means inherited props
    // are not visible. The ack validator then sees no refSeq → reject.
    const diags = await injectInbound(page, {
      type: "ack",
      payload: { __proto__: { refSeq: 99, ok: true } },
    });
    expect(
      diags.some((d) => /inbound-rejected:ack/.test(d))
    ).toBe(true);
  });

  test("rejects context-menu? — schema-free, accepted (regression-guard)", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadDeck(page);
    // context-menu is in SCHEMA_FREE_TYPES — must NOT be rejected even with
    // a sparse payload. This locks down that we did not over-tighten.
    const diags = await injectInbound(page, {
      type: "context-menu",
      payload: {},
    });
    expect(
      diags.some((d) => /inbound-rejected:context-menu/.test(d))
    ).toBe(false);
  });
});
