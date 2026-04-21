// telemetry.spec.js
// Acceptance tests for opt-in local telemetry scaffold (ADR-020, WO-15).
//
// Test matrix (6 tests — NOT in Gate-A; run directly via npx playwright test):
//   TM1 — default off: isEnabled()===false and log key absent on fresh load
//   TM2 — enable flow: toggle → isEnabled()===true → canary in readLog()
//   TM3 — disable flow clears log: enable → emit → disable → readLog().length===0
//   TM4 — no network IO: page.on('request') during enable/emit/export — only same-origin
//   TM5 — export stripping: exported HTML has no 'editor:telemetry' substring
//   TM6 — LRU cap: seed TELEMETRY_MAX_EVENTS+100 events → length<=TELEMETRY_MAX_EVENTS
//
// All tests run on chromium-desktop (behaviour is engine-agnostic; one browser suffices).

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");

// ─── Constants (mirror from constants.js — must stay in sync) ────────────────
const TELEMETRY_ENABLED_KEY = "editor:telemetry:enabled";
const TELEMETRY_LOG_KEY = "editor:telemetry:log";
const TELEMETRY_MAX_EVENTS = 5000;

// ─── Helper: clear telemetry state between tests ─────────────────────────────
async function clearTelemetryStorage(page) {
  await evaluateEditor(page, `
    (() => {
      try { localStorage.removeItem(${JSON.stringify(TELEMETRY_ENABLED_KEY)}); } catch (_) {}
      try { localStorage.removeItem(${JSON.stringify(TELEMETRY_LOG_KEY)}); } catch (_) {}
    })()
  `);
}

// ─── Helper: read log via window.telemetry ───────────────────────────────────
async function readLog(page) {
  return evaluateEditor(page, `
    (() => {
      if (typeof window.telemetry !== "undefined") {
        return window.telemetry.readLog();
      }
      // fallback: parse raw localStorage
      try {
        var raw = localStorage.getItem(${JSON.stringify(TELEMETRY_LOG_KEY)});
        return raw ? JSON.parse(raw) : [];
      } catch (_) {
        return [];
      }
    })()
  `);
}

// ─── TM1: default off ─────────────────────────────────────────────────────────
test("TM1 — default off: isEnabled()===false and localStorage log key absent on fresh load", async ({
  page,
}) => {
  if (!isChromiumOnlyProject(page)) return;
  await loadBasicDeck(page, BASIC_MANUAL_BASE_URL);
  await clearTelemetryStorage(page);

  const enabled = await evaluateEditor(
    page,
    `(() => {
      if (typeof window.telemetry !== "undefined") return window.telemetry.isEnabled();
      return false;
    })()`
  );
  expect(enabled).toBe(false);

  // Log key should be absent (null) on fresh load with no prior state
  const logRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    TELEMETRY_LOG_KEY,
  );
  expect(logRaw).toBeNull();
});

// ─── TM2: enable flow ────────────────────────────────────────────────────────
test("TM2 — enable flow: setEnabled(true) → isEnabled()===true → canary event in readLog()", async ({
  page,
}) => {
  if (!isChromiumOnlyProject(page)) return;
  await loadBasicDeck(page, BASIC_MANUAL_BASE_URL);
  await clearTelemetryStorage(page);

  await evaluateEditor(page, `(() => { window.telemetry.setEnabled(true); })()`);

  const enabled = await evaluateEditor(
    page,
    `(() => window.telemetry.isEnabled())()`
  );
  expect(enabled).toBe(true);

  const log = await readLog(page);
  expect(Array.isArray(log)).toBe(true);
  expect(log.length).toBeGreaterThanOrEqual(1);

  const canary = log.find((e) => e.code === "telemetry.enabled");
  expect(canary).toBeDefined();
  expect(canary.level).toBe("ok");
});

// ─── TM3: disable flow clears log ───────────────────────────────────────────
test("TM3 — disable flow clears log: enable → emit → disable → readLog().length===0", async ({
  page,
}) => {
  if (!isChromiumOnlyProject(page)) return;
  await loadBasicDeck(page, BASIC_MANUAL_BASE_URL);
  await clearTelemetryStorage(page);

  await evaluateEditor(page, `(() => {
    window.telemetry.setEnabled(true);
    window.telemetry.emit({ level: "ok", code: "test.event", data: {} });
  })()`);

  const logBefore = await readLog(page);
  expect(logBefore.length).toBeGreaterThanOrEqual(1);

  await evaluateEditor(page, `(() => { window.telemetry.setEnabled(false); })()`);

  const logAfter = await readLog(page);
  expect(logAfter.length).toBe(0);

  const enabled = await evaluateEditor(
    page,
    `(() => window.telemetry.isEnabled())()`
  );
  expect(enabled).toBe(false);
});

// ─── TM4: no network IO ──────────────────────────────────────────────────────
test("TM4 — no network IO: enable/emit/exportLogJson produce zero external-host requests", async ({
  page,
}) => {
  if (!isChromiumOnlyProject(page)) return;

  const externalRequests = [];
  const testServerHost = "127.0.0.1";

  page.on("request", (req) => {
    const url = req.url();
    // Allow: same-origin (127.0.0.1), about:, data:, blob:, chrome-extension:
    if (
      url.startsWith("about:") ||
      url.startsWith("data:") ||
      url.startsWith("blob:") ||
      url.startsWith("chrome-extension:") ||
      url.includes(testServerHost)
    ) {
      return;
    }
    externalRequests.push(url);
  });

  await loadBasicDeck(page, BASIC_MANUAL_BASE_URL);
  await clearTelemetryStorage(page);

  await evaluateEditor(page, `(() => {
    window.telemetry.setEnabled(true);
    window.telemetry.emit({ level: "ok", code: "tm4.test", data: { x: 1 } });
    window.telemetry.exportLogJson();
    window.telemetry.setEnabled(false);
  })()`);

  // Allow any pending microtasks to settle
  await page.waitForTimeout(200);

  expect(externalRequests).toHaveLength(0);
});

// ─── TM5: export stripping ────────────────────────────────────────────────────
test("TM5 — export stripping: exported HTML does NOT contain 'editor:telemetry' substring", async ({
  page,
}) => {
  if (!isChromiumOnlyProject(page)) return;
  await loadBasicDeck(page, BASIC_MANUAL_BASE_URL);
  await clearTelemetryStorage(page);

  // Enable telemetry and emit some events
  await evaluateEditor(page, `(() => {
    window.telemetry.setEnabled(true);
    window.telemetry.emit({ level: "ok", code: "tm5.test", data: {} });
  })()`);

  // Export via buildExportValidationPackage (same path as user export)
  const exportedHtml = await evaluateEditor(
    page,
    `(() => {
      if (typeof buildExportValidationPackage === "function") {
        const pack = buildExportValidationPackage();
        return pack ? pack.serialized : "";
      }
      if (typeof buildPreviewPackage === "function") {
        const pack = buildPreviewPackage();
        return pack ? pack.serialized : "";
      }
      return "";
    })()`
  );

  expect(typeof exportedHtml).toBe("string");
  expect(exportedHtml.length).toBeGreaterThan(0);
  expect(exportedHtml).not.toContain("editor:telemetry");
});

// ─── TM6: LRU cap ─────────────────────────────────────────────────────────────
test("TM6 — LRU cap: seed TELEMETRY_MAX_EVENTS+100 events → readLog().length<=TELEMETRY_MAX_EVENTS", async ({
  page,
}) => {
  if (!isChromiumOnlyProject(page)) return;
  await loadBasicDeck(page, BASIC_MANUAL_BASE_URL);
  await clearTelemetryStorage(page);

  // Seed directly via localStorage to bypass the per-emit LRU check (testing writeLog)
  await evaluateEditor(
    page,
    `(() => {
      const MAX = ${TELEMETRY_MAX_EVENTS};
      const COUNT = MAX + 100;
      const events = [];
      for (let i = 0; i < COUNT; i++) {
        events.push({ t: Date.now() + i, session: "test", level: "ok", code: "lru.test", data: { i: i } });
      }
      // Use window.telemetry.setEnabled then writeLog via emit to exercise the cap
      // Instead, set raw and let readLog parse it, then call writeLog via the module
      window.telemetry.setEnabled(true);
      // Clear canary and reseed via direct localStorage write to bypass emit gating
      try {
        localStorage.setItem(
          ${JSON.stringify(TELEMETRY_LOG_KEY)},
          JSON.stringify(events)
        );
      } catch (_) {}
      // Now call writeLog indirectly by emitting one more event (this triggers writeLog
      // with the existing oversized log + new event):
      window.telemetry.emit({ level: "ok", code: "lru.trigger", data: {} });
    })()`
  );

  const log = await readLog(page);
  expect(Array.isArray(log)).toBe(true);
  expect(log.length).toBeLessThanOrEqual(TELEMETRY_MAX_EVENTS);
});
