"use strict";

// v2.0.18 — FLAKE-002: file:// origin BO3 was previously informational-skip
// because the Playwright test server uses http://localhost and the helper
// `loadBasicDeck` etc. all operate against `baseURL`. This spec launches
// its OWN chromium persistent context WITHOUT a baseURL so the editor
// loads via the real `file://` protocol; under that protocol
// `event.origin === "null"` and `getAllowedBridgeOrigins()` returns
// `["null"]`. Verifies bridge-ready arrives, no origin-rejection logged.

const path = require("path");
const url = require("url");
const { test, expect, chromium } = require("@playwright/test");

const EDITOR_HTML = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "editor",
  "presentation-editor.html"
);
const FILE_URL = url.pathToFileURL(EDITOR_HTML).href;

test.describe("Bridge file:// origin (v2.0.18 / FLAKE-002)", () => {
  test.describe.configure({ timeout: 90_000 });

  test("editor loads via file:// and bridge accepts 'null' origin", async ({}, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("chromium"),
      "Chromium-only — Playwright file:// behaviour differs across engines."
    );
    // Launch a fresh persistent context with no baseURL — page.goto must
    // accept the absolute file:// URL without baseURL collision.
    const userDataDir = testInfo.outputPath("file-origin-profile");
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: ["--allow-file-access-from-files"],
    });
    try {
      const page = browserContext.pages()[0] || (await browserContext.newPage());
      await page.goto(FILE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForFunction(
        () => Boolean(typeof state !== "undefined" && state),
        null,
        { timeout: 15_000 }
      );

      // Verify origin guard reports the expected file:// allowed-list.
      const allowedOrigins = await page.evaluate(() =>
        typeof getAllowedBridgeOrigins === "function"
          ? getAllowedBridgeOrigins()
          : null
      );
      expect(allowedOrigins).not.toBeNull();
      expect(Array.isArray(allowedOrigins)).toBe(true);
      // Under file:// the only allowed value is the literal string "null".
      expect(allowedOrigins).toContain("null");

      // Confirm the editor reached its empty-state without a runtime error.
      const workflow = await page.evaluate(() => document.body.dataset.editorWorkflow);
      expect(workflow).toBe("empty");

      // Diagnostics should NOT contain bridge-origin-rejected for the
      // self-origin handshake.
      const diagText = await page.evaluate(() =>
        (typeof state !== "undefined" && Array.isArray(state.diagnostics))
          ? state.diagnostics.join("\n")
          : ""
      );
      expect(diagText).not.toMatch(/bridge-origin-rejected/);
    } finally {
      await browserContext.close();
    }
  });

  test("file:// editor exposes the same shell APIs as http://", async ({}, testInfo) => {
    test.skip(
      !testInfo.project.name.startsWith("chromium"),
      "Chromium-only."
    );
    const userDataDir = testInfo.outputPath("file-origin-profile-2");
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      args: ["--allow-file-access-from-files"],
    });
    try {
      const page = browserContext.pages()[0] || (await browserContext.newPage());
      await page.goto(FILE_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForFunction(
        () => Boolean(typeof state !== "undefined" && state && typeof window.BRIDGE_SCHEMA === "object"),
        null,
        { timeout: 15_000 }
      );

      // Sanity: BRIDGE_SCHEMA + state both available.
      const apis = await page.evaluate(() => ({
        hasBridgeSchema: typeof window.BRIDGE_SCHEMA === "object",
        hasState: typeof state === "object" && state !== null,
        hasOpenBtn: !!document.getElementById("openHtmlBtn"),
      }));
      expect(apis.hasBridgeSchema).toBe(true);
      expect(apis.hasState).toBe(true);
      expect(apis.hasOpenBtn).toBe(true);
    } finally {
      await browserContext.close();
    }
  });
});
