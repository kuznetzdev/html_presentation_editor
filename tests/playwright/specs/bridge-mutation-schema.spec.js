"use strict";

// v1.5.3 — Bridge mutation schema strictness verification.
// Calls into the per-validator entries exposed on window.BRIDGE_SCHEMA
// to ensure malformed payloads are rejected and well-formed ones pass.

const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  isChromiumOnlyProject,
  gotoFreshEditor,
} = require("../helpers/editorApp");

async function load(page) {
  await gotoFreshEditor(page);
}

test.describe("Bridge mutation schema (v1.5.3)", () => {
  test(
    "BRIDGE_SCHEMA namespace is exposed @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const exists = await evaluateEditor(
        page,
        "Boolean(window.BRIDGE_SCHEMA && window.BRIDGE_SCHEMA.BRIDGE_MESSAGES)",
      );
      expect(exists).toBe(true);
    },
  );

  test(
    "validateMessage rejects unknown type @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const r = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateMessage({ type: 'totally-made-up', payload: {} })",
      );
      expect(r.ok).toBe(false);
    },
  );

  test(
    "validateDeleteElement rejects payload without nodeId @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const r = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateDeleteElement({})",
      );
      expect(r.ok).toBe(false);
    },
  );

  test(
    "validateDeleteElement accepts payload with nodeId @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const r = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateDeleteElement({ nodeId: 'node-1' })",
      );
      expect(r.ok).toBe(true);
    },
  );

  test(
    "validateDuplicateElement rejects payload without nodeId @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const r = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateDuplicateElement({})",
      );
      expect(r.ok).toBe(false);
    },
  );

  test(
    "validateApplyStyle rejects empty styleName @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const r = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateApplyStyle({ nodeId: 'x', styleName: '', value: '12px' })",
      );
      expect(r.ok).toBe(false);
    },
  );

  test(
    "validateApplyStyle accepts well-formed payload @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const r = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateApplyStyle({ nodeId: 'node-1', styleName: 'width', value: '120px' })",
      );
      expect(r.ok).toBe(true);
    },
  );

  test(
    "validateUpdateAttributes rejects payload without nodeId or attrs @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const r = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateUpdateAttributes({})",
      );
      expect(r.ok).toBe(false);
    },
  );

  test(
    "validateNudgeElement rejects payload without dx/dy @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const r = await evaluateEditor(
        page,
        "window.BRIDGE_SCHEMA.validateNudgeElement({ nodeId: 'x' })",
      );
      expect(r.ok).toBe(false);
    },
  );

  test(
    "BRIDGE_MESSAGES has at least 25 mutation types @stage-f",
    async ({ page }, testInfo) => {
      test.skip(!isChromiumOnlyProject(testInfo.project.name));
      await load(page);
      const count = await evaluateEditor(
        page,
        "Object.keys(window.BRIDGE_SCHEMA.BRIDGE_MESSAGES).length",
      );
      expect(count).toBeGreaterThanOrEqual(25);
    },
  );
});
