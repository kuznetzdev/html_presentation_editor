// telemetry-viewer.spec.js
// Acceptance tests for the telemetry viewer panel (ADR-020, WO-34).
//
// Test matrix (9 tests — part of Gate-B):
//   TV1 — default state: opt-in OFF, #telemetryViewer is hidden
//   TV2 — enable opt-in → viewer visible, summary shows events count
//   TV3 — emit 5 events → viewer lists 5 entries
//   TV4 — emit mixed-level events → filter "Ошибки" chip narrows list
//   TV5 — disable opt-in → viewer re-hides, log cleared
//   TV6 — export log → download triggered, valid JSON with events array
//   TV7 — clear log with confirm-accept → log empties
//   TV8 — clear log with confirm-decline → log preserved
//   TV9 — EXPORT-PURITY: emit events, export HTML, grep output for telemetry markers → absent
//
// All tests run on chromium-desktop (LocalStorage + dialog APIs are engine-agnostic;
// one browser suffices for this functional gate).

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");
const {
  clearTelemetryStorage,
  enableTelemetry,
  disableTelemetry,
  emitTestEvents,
  readViewerSummary,
  openAdvancedMode,
  waitForViewerVisible,
  getViewerEventCount,
  TELEMETRY_LOG_KEY,
} = require("../helpers/telemetry-fixtures");
const { waitForRafTicks, waitForLocalStorage } = require("../helpers/waits");

// ─── Shared setup ────────────────────────────────────────────────────────────

async function setupViewerTest(page) {
  await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });
  await clearTelemetryStorage(page);
  await openAdvancedMode(page);
}

// ─── TV1: default state — opt-in OFF, viewer hidden ──────────────────────────
test("TV1 — default state: opt-in OFF, #telemetryViewer is hidden", async ({
  page,
  browserName,
}, testInfo) => {
  test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only telemetry viewer test.");
  await setupViewerTest(page);

  const isHidden = await page.evaluate(() => {
    const el = document.getElementById("telemetryViewer");
    return !el || el.hidden;
  });
  expect(isHidden).toBe(true);
});

// ─── TV2: enable opt-in → viewer visible ─────────────────────────────────────
test("TV2 — enable opt-in: viewer becomes visible with valid summary", async ({
  page,
}, testInfo) => {
  test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only telemetry viewer test.");
  await setupViewerTest(page);

  await enableTelemetry(page);
  // renderTelemetryViewer is called from toggle wiring; give it one RAF tick
  await waitForRafTicks(page, 2);

  await waitForViewerVisible(page);

  const summary = await readViewerSummary(page);
  expect(typeof summary).toBe("string");
  expect(summary.length).toBeGreaterThan(0);
  // Should contain event count (at least the canary event from setEnabled)
  expect(summary).toMatch(/событи/);
});

// ─── TV3: emit 5 events → viewer lists 5 entries ─────────────────────────────
test("TV3 — emit 5 events: viewer lists 5 entries", async ({
  page,
}, testInfo) => {
  test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only telemetry viewer test.");
  await setupViewerTest(page);

  await enableTelemetry(page);
  await waitForRafTicks(page, 2);
  await waitForViewerVisible(page);

  await emitTestEvents(page, 5);
  // Wait for RAF render cycle triggered by subscriber, then poll on count
  await expect
    .poll(() => getViewerEventCount(page), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(5);

  const count = await getViewerEventCount(page);
  // 5 test events + 1 canary (telemetry.enabled) = at least 5; filter is "all"
  expect(count).toBeGreaterThanOrEqual(5);
});

// ─── TV4: filter chip narrows list ───────────────────────────────────────────
test("TV4 — filter chip: 'Ошибки' narrows list to error-level events only", async ({
  page,
}, testInfo) => {
  test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only telemetry viewer test.");
  await setupViewerTest(page);

  await enableTelemetry(page);
  await waitForRafTicks(page, 2);
  await waitForViewerVisible(page);

  // Emit 9 events: 3 ok, 3 warn, 3 error (emitTestEvents cycles through levels)
  await emitTestEvents(page, 9);
  await expect
    .poll(() => getViewerEventCount(page), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(3);

  const totalBefore = await getViewerEventCount(page);
  expect(totalBefore).toBeGreaterThanOrEqual(3);

  // Click the "Ошибки" filter chip
  const errorChip = page.locator('.telemetry-filter-chip[data-filter="error"]');
  await expect(errorChip).toBeVisible();
  await errorChip.click();
  await waitForRafTicks(page, 2);

  const countAfterFilter = await getViewerEventCount(page);
  // After filtering for errors: should have fewer items than total and all have level="error"
  expect(countAfterFilter).toBeLessThan(totalBefore);
  expect(countAfterFilter).toBeGreaterThanOrEqual(1);

  // Verify all visible entries have the error level class
  const allAreErrors = await page.evaluate(() => {
    const items = document.querySelectorAll(".telemetry-viewer__list .telemetry-event");
    if (!items.length) return false;
    return Array.from(items).every((li) => li.classList.contains("telemetry-event--error"));
  });
  expect(allAreErrors).toBe(true);
});

// ─── TV5: disable opt-in → viewer re-hides ───────────────────────────────────
test("TV5 — disable opt-in: viewer re-hides and log is cleared", async ({
  page,
}, testInfo) => {
  test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only telemetry viewer test.");
  await setupViewerTest(page);

  await enableTelemetry(page);
  await waitForRafTicks(page, 2);
  await waitForViewerVisible(page);

  await emitTestEvents(page, 3);
  await waitForRafTicks(page, 2);

  // Disable via setEnabled(false) — this matches the toggle wiring in bindTelemetryToggleUi
  await disableTelemetry(page);
  // renderTelemetryViewer is called from the toggle change handler — poll for hidden
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.getElementById("telemetryViewer");
          return !el || el.hidden;
        }),
      { timeout: 5_000 },
    )
    .toBe(true);

  // Log must be cleared after disable
  await waitForLocalStorage(page, TELEMETRY_LOG_KEY, (raw) => raw === null);
  const logRaw = await page.evaluate(
    (key) => localStorage.getItem(key),
    TELEMETRY_LOG_KEY,
  );
  expect(logRaw).toBeNull();
});

// ─── TV6: export log → valid JSON ────────────────────────────────────────────
test("TV6 — export log: exportLog() produces a valid JSON blob with events array", async ({
  page,
}, testInfo) => {
  test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only telemetry viewer test.");
  await setupViewerTest(page);

  await enableTelemetry(page);
  await emitTestEvents(page, 3);
  // Poll until exportLogJson reports the events flushed to log (subscriber RAF settled)
  await expect
    .poll(
      () => evaluateEditor(page, "(window.telemetry.exportLogJson() || []).length"),
      { timeout: 5_000 },
    )
    .toBeGreaterThanOrEqual(3);

  // Call exportLogJson() (the array form) and verify structure
  const log = await evaluateEditor(page, "window.telemetry.exportLogJson()");
  expect(Array.isArray(log)).toBe(true);
  expect(log.length).toBeGreaterThanOrEqual(3);

  // Verify each event has the required fields
  const firstEvent = log[0];
  expect(typeof firstEvent.t).toBe("number");
  expect(typeof firstEvent.session).toBe("string");
  expect(typeof firstEvent.code).toBe("string");
  expect(typeof firstEvent.level).toBe("string");

  // Verify getSummary() provides consistent count
  const summary = await evaluateEditor(page, "window.telemetry.getSummary()");
  expect(summary.count).toBeGreaterThanOrEqual(3);
  expect(typeof summary.errors).toBe("number");
});

// ─── TV7: clear log with confirm-accept ──────────────────────────────────────
test("TV7 — clear log: confirm-accept empties log", async ({
  page,
}, testInfo) => {
  test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only telemetry viewer test.");
  await setupViewerTest(page);

  await enableTelemetry(page);
  await emitTestEvents(page, 5);
  await expect
    .poll(() => getViewerEventCount(page), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(1);
  await waitForViewerVisible(page);

  const countBefore = await getViewerEventCount(page);
  expect(countBefore).toBeGreaterThanOrEqual(1);

  // Auto-accept the confirm dialog
  page.once("dialog", (dialog) => dialog.accept());

  const clearBtn = page.locator("#clearTelemetryBtn");
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();

  // Poll for log clearing — clearLog() writes one telemetry.cleared marker
  await expect
    .poll(
      () => evaluateEditor(page, "(window.telemetry.readLog() || []).length"),
      { timeout: 5_000 },
    )
    .toBeLessThanOrEqual(1);

  // After clearing, the log should be near-empty (telemetry.cleared marker may exist)
  const log = await evaluateEditor(page, "window.telemetry.readLog()");
  expect(Array.isArray(log)).toBe(true);
  // clearLog() writes a single telemetry.cleared marker, so count <= 1
  expect(log.length).toBeLessThanOrEqual(1);
});

// ─── TV8: clear log with confirm-decline ─────────────────────────────────────
test("TV8 — clear log: confirm-decline preserves log", async ({
  page,
}, testInfo) => {
  test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only telemetry viewer test.");
  await setupViewerTest(page);

  await enableTelemetry(page);
  await emitTestEvents(page, 5);
  await expect
    .poll(() => evaluateEditor(page, "(window.telemetry.readLog() || []).length"), { timeout: 5_000 })
    .toBeGreaterThanOrEqual(1);
  await waitForViewerVisible(page);

  const logBefore = await evaluateEditor(page, "window.telemetry.readLog()");
  const countBefore = logBefore.length;
  expect(countBefore).toBeGreaterThanOrEqual(1);

  // Dismiss (decline) the confirm dialog
  page.once("dialog", (dialog) => dialog.dismiss());

  const clearBtn = page.locator("#clearTelemetryBtn");
  await expect(clearBtn).toBeVisible();
  await clearBtn.click();

  // Allow dialog dismiss + RAF cycle to settle
  await waitForRafTicks(page, 2);

  const logAfter = await evaluateEditor(page, "window.telemetry.readLog()");
  // Log must be unchanged after dismiss
  expect(logAfter.length).toBe(countBefore);
});

// ─── TV9: EXPORT PURITY ───────────────────────────────────────────────────────
// Verifies that the HTML export path does NOT leak any telemetry data.
// Telemetry lives in localStorage only — the exported HTML must not contain
// session IDs, telemetry keys, or event codes.
test("TV9 — export purity: exported HTML does NOT contain telemetry markers", async ({
  page,
}, testInfo) => {
  test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only telemetry purity test.");
  await setupViewerTest(page);

  await enableTelemetry(page);
  // Emit events that would identify telemetry leakage in the export
  await evaluateEditor(page, `(() => {
    window.telemetry.emit({ level: "ok", code: "select.success", data: { entityKind: "text" } });
    window.telemetry.emit({ level: "ok", code: "deck.opened", data: {} });
    window.telemetry.emit({ level: "error", code: "bridge.error", data: {} });
  })()`);
  // Poll until at least 3 events landed in the in-memory log
  await expect
    .poll(
      () => evaluateEditor(page, "(window.telemetry.readLog() || []).length"),
      { timeout: 5_000 },
    )
    .toBeGreaterThanOrEqual(3);

  // Get the session ID so we can search for it specifically
  const sessionId = await evaluateEditor(page, "window.telemetry.getSession().sessionId");
  expect(typeof sessionId).toBe("string");
  expect(sessionId.length).toBeGreaterThan(0);

  // Export via buildExportValidationPackage (same path as user-facing HTML export)
  const exportedHtml = await evaluateEditor(page, `
    (() => {
      if (typeof buildExportValidationPackage === "function") {
        const pack = buildExportValidationPackage();
        return pack ? pack.serialized : "";
      }
      if (typeof buildCleanExportPackage === "function") {
        const pack = buildCleanExportPackage();
        return pack ? pack.serialized : "";
      }
      return "";
    })()
  `);

  expect(typeof exportedHtml).toBe("string");
  expect(exportedHtml.length).toBeGreaterThan(0);

  // The exported HTML must NOT contain any telemetry identifiers
  expect(exportedHtml).not.toContain("editor:telemetry");
  expect(exportedHtml).not.toContain("telemetry:enabled");
  expect(exportedHtml).not.toContain("select.success");
  expect(exportedHtml).not.toContain(sessionId);
  // Must not contain the telemetry log key
  expect(exportedHtml).not.toContain("editor:telemetry:log");
});
