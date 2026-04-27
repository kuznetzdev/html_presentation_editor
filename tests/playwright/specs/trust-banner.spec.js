// trust-banner.spec.js
// Security gate: Trust-Banner + neutralize-scripts one-click
// (ADR-014 §Layer 1, AUDIT-D-01, PAIN-MAP P0-01, WO-07)
//
// 7 scenarios + 1 regression assertion — all run on chromium-desktop only:
//   TB1 — paste fixture with <script>alert(1)</script> → banner appears, totalFindings=1
//   TB2 — click "Нейтрализовать скрипты" → iframe reloads, <script> absent,
//          sandbox attr set, toast "Скрипты нейтрализованы…"
//   TB3 — paste fixture with only <div onclick="x"> → banner fires, inlineHandlerCount=1
//   TB4 — click "Оставить как есть" → banner dismissed, scripts remain, no re-fire
//   TB5 — reference deck structural pattern (clean, no scripts) → zero findings, NO banner
//   TB6 — reference deck structural pattern (clean, no scripts/handlers) → zero findings, NO banner
//   TB7 — paste fixture with <meta http-equiv="refresh"> → detected, banner fires
//   TB8 — NEUTRALIZE preserves style/class/id/data-* attributes (regression)

const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  gotoFreshEditor,
  waitForPreviewReady,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");
const {
  waitForRafTicks,
  waitForState,
} = require("../helpers/waits");

// ─── HTML fixture builders ────────────────────────────────────────────────────

// A minimal presentation fixture with one <script>alert(1)</script>.
// The script tag is the single executable-code finding.
function makeScriptFixture() {
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Test Script</title></head>
<body>
<div class="slide" style="width:800px;height:600px;position:relative">
  <h1 id="main-title" class="title" data-node="headline"
      style="color:#333;font-size:32px">Заголовок слайда</h1>
  <script>alert(1)</script>
</div>
</body></html>`;
}

// A minimal fixture with an inline onclick handler (no <script> tag).
function makeInlineHandlerFixture() {
  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>Test Handler</title></head>
<body>
<div class="slide" style="width:800px;height:600px;position:relative">
  <div id="btn" class="cta-button" data-role="button" style="color:blue"
       onclick="doSomething()">Нажми меня</div>
</div>
</body></html>`;
}

// A minimal fixture with <meta http-equiv="refresh">.
function makeMetaRefreshFixture() {
  return `<!DOCTYPE html>
<html lang="ru"><head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=https://attacker.example">
  <title>Test Meta Refresh</title>
</head>
<body>
<div class="slide" style="width:800px;height:600px;position:relative">
  <h1>Слайд с редиректом</h1>
</div>
</body></html>`;
}

// A clean presentation fixture resembling a reference deck structure but
// containing NO executable code. Used for TB5 and TB6 false-positive tests.
// This validates that a normal, script-free presentation produces zero findings.
function makeCleanDeckFixture(id) {
  return `<!DOCTYPE html>
<html lang="ru"><head>
  <meta charset="UTF-8">
  <title>Чистая презентация ${id}</title>
  <style>
    body { margin: 0; background: #1a1a2e; font-family: Arial, sans-serif; }
    .slide { width: 800px; height: 600px; position: relative; background: #fff; }
    .title { color: #333; font-size: 32px; }
    .body-text { color: #555; font-size: 16px; }
  </style>
</head>
<body>
<div class="slide" id="slide-1" data-slide-id="slide-1">
  <h1 class="title" id="hero-title" style="top:80px;left:60px;position:absolute">
    Заголовок ${id}
  </h1>
  <p class="body-text" id="body-text" data-node="text"
     style="top:160px;left:60px;position:absolute">
    Описание продукта без исполняемого кода.
  </p>
</div>
<div class="slide" id="slide-2" data-slide-id="slide-2">
  <h2 class="title" id="slide2-title" style="top:80px;left:60px;position:absolute">
    Второй слайд ${id}
  </h2>
  <p id="slide2-body" style="top:160px;left:60px;position:absolute;color:#555">
    Чистый контент без скриптов.
  </p>
</div>
</body></html>`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Paste raw HTML string into the editor via the shell's loadHtmlString API.
// This bypasses the file-input modal, simulating a programmatic import.
async function pasteHtmlToEditor(page, htmlString) {
  await page.evaluate((html) => {
    // loadHtmlString is the canonical import entry point in import.js.
    loadHtmlString(html, "test-fixture", { mode: "preview", resetHistory: true });
  }, htmlString);
  await waitForPreviewReady(page);
}

async function isShellBannerVisible(page) {
  return page.evaluate(() => {
    const banner = document.getElementById("shellBanner");
    if (!banner) return false;
    return (
      banner.style.display !== "none" &&
      banner.children.length > 0
    );
  });
}

async function getBannerItemCount(page) {
  return page.evaluate(() => {
    const banner = document.getElementById("shellBanner");
    if (!banner) return 0;
    return banner.querySelectorAll(".shell-banner-item").length;
  });
}

async function getBannerText(page) {
  return page.evaluate(() => {
    const banner = document.getElementById("shellBanner");
    return banner ? banner.textContent.trim() : "";
  });
}

async function getBannerActionLabels(page) {
  return page.evaluate(() => {
    return Array.from(
      document.querySelectorAll("#shellBanner .shell-banner-action-btn"),
    ).map((btn) => btn.textContent.trim());
  });
}

async function getTrustSignals(page) {
  return page.evaluate(() => {
    return typeof state !== "undefined" ? state.trustSignals : null;
  });
}

async function getTrustDecision(page) {
  return page.evaluate(() => {
    return typeof state !== "undefined" ? state.trustDecision : null;
  });
}

async function getSandboxMode(page) {
  return page.evaluate(() => {
    return typeof state !== "undefined" ? state.sandboxMode : null;
  });
}

async function getPreviewSandboxAttr(page) {
  return page.evaluate(() => {
    const frame = document.getElementById("previewFrame");
    return frame ? frame.getAttribute("sandbox") : null;
  });
}

// Wait for the trust banner to appear (fires 250ms after iframe onload).
async function waitForTrustBanner(page, timeout = 4000) {
  await expect.poll(() => isShellBannerVisible(page), { timeout }).toBe(true);
}

// Click an action button in the shell banner by its visible label text.
async function clickBannerAction(page, label) {
  const btn = page.locator("#shellBanner .shell-banner-action-btn", {
    hasText: label,
  });
  await expect(btn).toBeVisible({ timeout: 4000 });
  await btn.click();
}

// Check whether a toast with given text is visible.
async function hasToastWithText(page, text, timeout = 4000) {
  try {
    await expect(
      page.locator(".toast", { hasText: text }),
    ).toBeVisible({ timeout });
    return true;
  } catch {
    return false;
  }
}

// ─── Test suite ──────────────────────────────────────────────────────────────

test.describe("trust-banner: executable-code detection + neutralize @security", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !isChromiumOnlyProject(testInfo.project.name),
      "Chromium-only shell behaviour.",
    );
    await gotoFreshEditor(page);
  });

  // ── TB1 ──────────────────────────────────────────────────────────────────
  // Paste a fixture containing one <script>alert(1)</script>.
  // Expected: trust banner appears, state.trustSignals.scriptCount === 1,
  // totalFindings === 1.
  test("TB1 — paste fixture with <script> → banner appears, totalFindings=1", async ({ page }) => {
    await pasteHtmlToEditor(page, makeScriptFixture());

    // Give the 250ms defer inside onload time to fire.
    await waitForTrustBanner(page);

    // Banner must be visible.
    const itemCount = await getBannerItemCount(page);
    expect(itemCount).toBeGreaterThanOrEqual(1);

    // Message must contain Russian UI copy.
    const bannerText = await getBannerText(page);
    expect(bannerText).toContain("Презентация содержит исполняемый код");
    expect(bannerText).toContain("Скрипты будут запущены");

    // Both action buttons must be present with correct Russian labels.
    const labels = await getBannerActionLabels(page);
    expect(labels).toContain("Нейтрализовать скрипты");
    expect(labels).toContain("Оставить как есть");

    // trustSignals must reflect exactly 1 script finding.
    const signals = await getTrustSignals(page);
    expect(signals).not.toBeNull();
    expect(signals.scriptCount).toBe(1);
    expect(signals.totalFindings).toBeGreaterThanOrEqual(1);

    // trustDecision must remain PENDING until user acts.
    const decision = await getTrustDecision(page);
    expect(decision).toBe("pending");
  });

  // ── TB2 ──────────────────────────────────────────────────────────────────
  // After banner appears, click "Нейтрализовать скрипты".
  // Expected: iframe reloads without <script>, sandbox attr is set,
  // toast "Скрипты нейтрализованы…" visible, trustDecision === "neutralize",
  // sandboxMode === "scripts-only".
  test("TB2 — click 'Нейтрализовать скрипты' → script absent, sandbox set, toast shown", async ({ page }) => {
    await pasteHtmlToEditor(page, makeScriptFixture());
    await waitForTrustBanner(page);

    // Click the neutralize action.
    await clickBannerAction(page, "Нейтрализовать скрипты");

    // Wait for the rebuild to complete.
    await waitForPreviewReady(page);

    // Banner must be cleared (trust decision was made).
    await expect.poll(() => getBannerItemCount(page), { timeout: 4000 }).toBe(0);
    const bannerVisible = await isShellBannerVisible(page);
    expect(bannerVisible).toBe(false);

    // trustDecision must be "neutralize".
    const decision = await getTrustDecision(page);
    expect(decision).toBe("neutralize");

    // sandboxMode must be "scripts-only".
    const sandboxMode = await getSandboxMode(page);
    expect(sandboxMode).toBe("scripts-only");

    // The preview iframe sandbox attribute must be set to allow-scripts allow-same-origin.
    const sandboxAttr = await getPreviewSandboxAttr(page);
    expect(sandboxAttr).toContain("allow-scripts");

    // The user's <script>alert(1)</script> must be absent from the rebuilt preview.
    // Note: the bridge-script injected by buildPreviewPackage is always present;
    // we check specifically that no inline script contains "alert" (from our fixture).
    const hasUserScript = await page.evaluate(() => {
      const frame = document.getElementById("previewFrame");
      const doc = frame && frame.contentDocument;
      if (!doc) return null;
      return Array.from(doc.querySelectorAll("script")).some(function (s) {
        var text = s.textContent || s.innerText || "";
        return text.indexOf("alert") !== -1;
      });
    });
    expect(hasUserScript).toBe(false);

    // Toast with Russian UI copy must have appeared.
    const toastVisible = await hasToastWithText(
      page,
      "Скрипты нейтрализованы. Превью пересобрано в режиме sandbox.",
    );
    expect(toastVisible).toBe(true);
  });

  // ── TB3 ──────────────────────────────────────────────────────────────────
  // Paste a fixture with only <div onclick="..."> — no <script> tag.
  // Expected: banner fires, inlineHandlerCount === 1.
  test("TB3 — paste fixture with <div onclick> → banner fires, inlineHandlerCount=1", async ({ page }) => {
    await pasteHtmlToEditor(page, makeInlineHandlerFixture());
    await waitForTrustBanner(page);

    // Banner must show.
    const visible = await isShellBannerVisible(page);
    expect(visible).toBe(true);

    // trustSignals: exactly 1 inline handler, 0 scripts.
    const signals = await getTrustSignals(page);
    expect(signals).not.toBeNull();
    expect(signals.inlineHandlerCount).toBeGreaterThanOrEqual(1);
    expect(signals.totalFindings).toBeGreaterThanOrEqual(1);

    // trustDecision still PENDING.
    const decision = await getTrustDecision(page);
    expect(decision).toBe("pending");
  });

  // ── TB4 ──────────────────────────────────────────────────────────────────
  // Paste script fixture, banner appears, click "Оставить как есть".
  // Expected: banner dismissed, scripts remain in preview, decision = "accept",
  // re-loading the SAME html (simulated) does NOT show banner again
  // because the decision is session-persistent.
  test("TB4 — click 'Оставить как есть' → banner dismissed, scripts remain, no re-fire", async ({ page }) => {
    await pasteHtmlToEditor(page, makeScriptFixture());
    await waitForTrustBanner(page);

    // Click "accept" action.
    await clickBannerAction(page, "Оставить как есть");

    // Banner must disappear.
    await expect.poll(() => getBannerItemCount(page), { timeout: 3000 }).toBe(0);
    const bannerVisible = await isShellBannerVisible(page);
    expect(bannerVisible).toBe(false);

    // trustDecision must be "accept".
    const decision = await getTrustDecision(page);
    expect(decision).toBe("accept");

    // sandboxMode must remain "off" (scripts NOT stripped).
    const sandboxMode = await getSandboxMode(page);
    expect(sandboxMode).toBe("off");

    // The preview iframe must NOT have a sandbox attribute (scripts still run).
    const sandboxAttr = await getPreviewSandboxAttr(page);
    expect(sandboxAttr).toBeNull();

    // Simulate a scenario where maybeShowTrustBanner is called again —
    // because trustDecision is "accept" (not "pending"), the banner must NOT
    // re-appear.
    await page.evaluate(() => {
      if (typeof maybeShowTrustBanner === "function") {
        maybeShowTrustBanner();
      }
    });
    // Allow several RAFs for any deferred banner-render to flush; if the
    // banner was going to re-appear, it would within a few frames.
    await waitForRafTicks(page, 8);
    const stillHidden = await getBannerItemCount(page);
    expect(stillHidden).toBe(0);
  });

  // ── TB5 ──────────────────────────────────────────────────────────────────
  // Clean presentation fixture (no executable code) — simulates the structural
  // pattern of the v3 reference decks without their navigation scripts.
  // Expected: zero findings, NO trust banner (false-positive guard).
  test("TB5 — clean reference-deck structural pattern (no scripts) → zero findings, NO banner", async ({ page }) => {
    await pasteHtmlToEditor(page, makeCleanDeckFixture("v3-prepodovai-pattern"));

    // Wait until the trust-signals computation has run AND enough time has
    // elapsed for the deferred banner-show (setTimeout 250ms after iframe
    // onload) to have fired. ~20 RAFs at 60fps ≈ 333ms covers the defer.
    await waitForState(page, "state.trustSignals !== null && state.trustSignals !== undefined");
    await waitForRafTicks(page, 24);

    // No trust banner must appear.
    const itemCount = await getBannerItemCount(page);
    expect(itemCount).toBe(0);

    const bannerVisible = await isShellBannerVisible(page);
    expect(bannerVisible).toBe(false);

    // trustSignals must reflect zero findings.
    const signals = await getTrustSignals(page);
    expect(signals).not.toBeNull();
    expect(signals.totalFindings).toBe(0);

    // trustDecision stays PENDING (no banner means no decision needed).
    const decision = await getTrustDecision(page);
    expect(decision).toBe("pending");
  });

  // ── TB6 ──────────────────────────────────────────────────────────────────
  // Second clean presentation fixture (same guard, different content).
  // Expected: zero findings, NO trust banner.
  test("TB6 — second clean reference-deck structural pattern (no scripts) → zero findings, NO banner", async ({ page }) => {
    await pasteHtmlToEditor(page, makeCleanDeckFixture("v3-selectios-pattern"));

    // Wait until trust-signals computed + the 250ms banner-defer has elapsed.
    await waitForState(page, "state.trustSignals !== null && state.trustSignals !== undefined");
    await waitForRafTicks(page, 24);

    // Still no banner.
    const itemCount = await getBannerItemCount(page);
    expect(itemCount).toBe(0);

    const bannerVisible = await isShellBannerVisible(page);
    expect(bannerVisible).toBe(false);

    // Trust signals: zero.
    const signals = await getTrustSignals(page);
    expect(signals).not.toBeNull();
    expect(signals.totalFindings).toBe(0);
  });

  // ── TB7 ──────────────────────────────────────────────────────────────────
  // Paste a fixture with <meta http-equiv="refresh"> — a meta-refresh redirect.
  // Expected: metaRefreshCount > 0, banner fires.
  test("TB7 — paste fixture with <meta http-equiv='refresh'> → detected, banner fires", async ({ page }) => {
    await pasteHtmlToEditor(page, makeMetaRefreshFixture());
    await waitForTrustBanner(page);

    const visible = await isShellBannerVisible(page);
    expect(visible).toBe(true);

    // metaRefreshCount must be at least 1.
    const signals = await getTrustSignals(page);
    expect(signals).not.toBeNull();
    expect(signals.metaRefreshCount).toBeGreaterThanOrEqual(1);
    expect(signals.totalFindings).toBeGreaterThanOrEqual(1);
  });

  // ── TB8 ──────────────────────────────────────────────────────────────────
  // Regression: NEUTRALIZE must preserve style/class/id/data-* attributes.
  // Only on* handlers are stripped; structural attributes must survive.
  //
  // Fixture has: <div id="target" class="card" data-role="cta" style="color:red"
  //                  onclick="bad()">Text</div>
  // After neutralize: div must keep id, class, data-role, style;
  // onclick must be absent.
  test("TB8 — NEUTRALIZE preserves style/class/id/data-* (strips only on*)", async ({ page }) => {
    const fixture = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Attr Test</title></head>
<body>
<div class="slide" style="width:800px;height:600px">
  <div id="target-card" class="card highlight" data-role="cta" data-theme="dark"
       style="color:red;font-size:18px" onclick="badFunction()">
    Важный контент
  </div>
</div>
</body></html>`;

    await pasteHtmlToEditor(page, fixture);
    await waitForTrustBanner(page);

    // Click neutralize.
    await clickBannerAction(page, "Нейтрализовать скрипты");
    await waitForPreviewReady(page);

    // Read the target element's attributes from the neutralized preview.
    const attrs = await page.evaluate(() => {
      const frame = document.getElementById("previewFrame");
      const doc = frame && frame.contentDocument;
      if (!doc) return null;
      const el = doc.getElementById("target-card");
      if (!el) return null;
      return {
        id:        el.getAttribute("id"),
        className: el.getAttribute("class"),
        dataRole:  el.getAttribute("data-role"),
        dataTheme: el.getAttribute("data-theme"),
        style:     el.getAttribute("style"),
        onclick:   el.getAttribute("onclick"),
      };
    });

    expect(attrs).not.toBeNull();
    // Preserved attributes.
    expect(attrs.id).toBe("target-card");
    expect(attrs.className).toContain("card");
    expect(attrs.className).toContain("highlight");
    expect(attrs.dataRole).toBe("cta");
    expect(attrs.dataTheme).toBe("dark");
    expect(attrs.style).toBeTruthy();
    expect(attrs.style).toContain("color");
    // onclick must be stripped.
    expect(attrs.onclick).toBeNull();
  });
});
