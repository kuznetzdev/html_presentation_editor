"use strict";

// v2.0.15 — SEC-006 prototype-pollution hardening.
// Slide-keyed dictionaries are Object.create(null) AND the registry write
// site explicitly skips reserved IDs (__proto__, constructor, prototype).
// findSlideById() inside the iframe also short-circuits on reserved IDs.
//
// Fixture: tests/fixtures/audit-2026-04-26/proto-pollution.html — three
// slides, two of which carry attacker-controlled reserved IDs.

const path = require("path");
const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  isChromiumOnlyProject,
  gotoFreshEditor,
  openHtmlFixture,
} = require("../helpers/editorApp");

const FIXTURE = path.resolve(
  __dirname,
  "..",
  "..",
  "fixtures",
  "audit-2026-04-26",
  "proto-pollution.html"
);

async function loadFixture(page) {
  await gotoFreshEditor(page);
  await openHtmlFixture(page, FIXTURE);
  // Wait for slides to be in the registry.
  await page.waitForFunction(
    () =>
      typeof state !== "undefined" &&
      state &&
      Array.isArray(state.slides) &&
      state.slides.length >= 1
  );
}

test.describe("Bridge proto-pollution hardening (v2.0.15 / SEC-006)", () => {
  test("slideRegistryById has null prototype", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadFixture(page);
    const proto = await evaluateEditor(
      page,
      "Object.getPrototypeOf(state.slideRegistryById)"
    );
    expect(proto).toBeNull();
  });

  test("slideSyncLocks has null prototype", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadFixture(page);
    const proto = await evaluateEditor(
      page,
      "Object.getPrototypeOf(state.slideSyncLocks)"
    );
    expect(proto).toBeNull();
  });

  test("lastAppliedSeqBySlide has null prototype", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadFixture(page);
    const proto = await evaluateEditor(
      page,
      "Object.getPrototypeOf(state.lastAppliedSeqBySlide)"
    );
    expect(proto).toBeNull();
  });

  test("real slide is registered in slideRegistryById", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadFixture(page);
    const real = await evaluateEditor(
      page,
      "Boolean(state.slideRegistryById['real-slide-1'])"
    );
    expect(real).toBe(true);
  });

  test("__proto__ slide ID is NOT registered", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadFixture(page);
    // Use Object.prototype.hasOwnProperty.call so a poisoned proto cannot
    // mask the answer. Result must be false because the registry-write
    // guard skipped the reserved ID.
    const present = await evaluateEditor(
      page,
      "Object.prototype.hasOwnProperty.call(state.slideRegistryById, '__proto__')"
    );
    expect(present).toBe(false);
  });

  test("constructor slide ID is NOT registered", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadFixture(page);
    const present = await evaluateEditor(
      page,
      "Object.prototype.hasOwnProperty.call(state.slideRegistryById, 'constructor')"
    );
    expect(present).toBe(false);
  });

  test("Object.prototype is NOT polluted", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadFixture(page);
    // After loading a fixture with malicious slide IDs, no pristine empty
    // object should reveal a foreign property.
    const polluted = await evaluateEditor(
      page,
      "(function(){ const o = {}; return ('isActive' in o) || ('stateLabel' in o) || ('isRequested' in o); })()"
    );
    expect(polluted).toBe(false);
  });

  test("real slide lookup works after attack-laden load", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));
    await loadFixture(page);
    // Even with reserved-ID slides in the deck, lookup of a real slide
    // by ID must still resolve correctly.
    const entry = await evaluateEditor(
      page,
      "(function(){ const e = state.slideRegistryById['real-slide-1']; return e && e.id; })()"
    );
    expect(entry).toBe("real-slide-1");
  });
});
