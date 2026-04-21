"use strict";
// playwright.a11y.config.js — Playwright configuration for the accessibility gate.
// Runs tests/a11y/ specs only. Sets reuseExistingServer:true so the a11y gate can run
// against a server started by npm run test:gate-a (or independently via PLAYWRIGHT_TEST_SERVER_PORT).
//
// Invariants:
//   - No type="module" on <script> tags
//   - No bundler dependency
//   - test:gate-a11y is ADDITIVE — does NOT replace Gate-A (tests/playwright)

const path = require("path");
const { defineConfig } = require("@playwright/test");
const {
  TEST_SERVER_HOST,
  TEST_SERVER_PORT,
  TEST_SERVER_ORIGIN,
  toTestServerUrl,
} = require("./scripts/test-server-config");

const ARTIFACTS_DIR = path.join("artifacts", "a11y");

module.exports = defineConfig({
  testDir: path.join(__dirname, "tests", "a11y"),
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  expect: {
    timeout: 15_000,
  },
  outputDir: path.join(ARTIFACTS_DIR, "test-results"),
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: path.join(ARTIFACTS_DIR, "html-report") }],
  ],
  use: {
    baseURL: TEST_SERVER_ORIGIN,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  webServer: {
    command: `node scripts/static-server.js . ${TEST_SERVER_PORT} ${TEST_SERVER_HOST}`,
    url: toTestServerUrl("/editor/presentation-editor.html"),
    // reuseExistingServer:true allows running alongside test:gate-a without port conflict.
    // In CI set PLAYWRIGHT_TEST_SERVER_PORT to an available port.
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1280, height: 900 },
      },
    },
  ],
});
