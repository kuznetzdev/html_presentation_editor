const path = require("path");
const os = require("os");
const { defineConfig } = require("@playwright/test");
const {
  TEST_SERVER_HOST,
  TEST_SERVER_PORT,
  TEST_SERVER_ORIGIN,
  toTestServerUrl,
} = require("./scripts/test-server-config");

const ARTIFACTS_DIR = path.join("artifacts", "playwright");
const DEFAULT_WINDOWS_WORKERS = Math.max(
  1,
  Math.min(2, Math.ceil(os.cpus().length / 2)),
);
const PLAYWRIGHT_WORKERS = process.env.PLAYWRIGHT_WORKERS
  ? Number(process.env.PLAYWRIGHT_WORKERS)
  : process.platform === "win32"
    ? DEFAULT_WINDOWS_WORKERS
    : undefined;

module.exports = defineConfig({
  testDir: path.join(__dirname, "tests", "playwright"),
  timeout: 45_000,
  fullyParallel: false,
  workers: PLAYWRIGHT_WORKERS,
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
    baseURL: TEST_SERVER_ORIGIN,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  webServer: {
    command: `node scripts/static-server.js . ${TEST_SERVER_PORT} ${TEST_SERVER_HOST}`,
    url: toTestServerUrl("/editor/presentation-editor.html"),
    reuseExistingServer: false,
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
