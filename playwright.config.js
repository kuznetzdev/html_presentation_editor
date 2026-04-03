const path = require("path");
const { defineConfig } = require("@playwright/test");

const ARTIFACTS_DIR = path.join("artifacts", "playwright");

module.exports = defineConfig({
  testDir: path.join(__dirname, "tests", "playwright"),
  timeout: 45_000,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      scale: "css",
      maxDiffPixelRatio: 0.02,
    },
  },
  outputDir: path.join(ARTIFACTS_DIR, "test-results"),
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: path.join(ARTIFACTS_DIR, "html-report") }],
    ["json", { outputFile: path.join(ARTIFACTS_DIR, "results.json") }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  webServer: {
    command: "node scripts/static-server.js . 4173 127.0.0.1",
    url: "http://127.0.0.1:4173/editor/presentation-editor-v0.18.1.html",
    reuseExistingServer: !process.env.CI,
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
    {
      name: "firefox-desktop",
      use: {
        browserName: "firefox",
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "webkit-desktop",
      use: {
        browserName: "webkit",
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "chromium-mobile-390",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "chromium-mobile-640",
      use: {
        browserName: "chromium",
        viewport: { width: 640, height: 960 },
        hasTouch: true,
      },
    },
    {
      name: "chromium-tablet-820",
      use: {
        browserName: "chromium",
        viewport: { width: 820, height: 1180 },
        hasTouch: true,
      },
    },
    {
      name: "chromium-shell-1100",
      use: {
        browserName: "chromium",
        viewport: { width: 1100, height: 900 },
      },
    },
    {
      name: "chromium-wide-1440",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 960 },
      },
    },
  ],
});
