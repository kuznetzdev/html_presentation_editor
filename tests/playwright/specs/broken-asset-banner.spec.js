// broken-asset-banner.spec.js
// Security / UX gate: shellBanner + broken-asset recovery + sandbox-mode flag
// (ADR-014 §Layer 1, AUDIT-D-01, AUDIT-D-07, PAIN-MAP P0-04, WO-06)
//
// 4 scenarios — all run on chromium-desktop only:
//   BA1 — Clean deck (prepodovai): no banner shown after load
//   BA2 — Deck with injected missing img src: banner appears with count
//   BA3 — Banner clear action: banner dismisses on pick-asset-folder trigger
//   BA4 — constants: SANDBOX_MODES has expected OFF/SCRIPTS_ONLY/FULL values

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
  loadReferenceDeck,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");

// ─── Helper: read text content of the #shellBanner region ──────────────────
async function getShellBannerText(page) {
  return page.evaluate(() => {
    const banner = document.getElementById("shellBanner");
    return banner ? banner.textContent.trim() : "";
  });
}

// ─── Helper: check if #shellBanner region is visible ───────────────────────
async function isShellBannerVisible(page) {
  return page.evaluate(() => {
    const banner = document.getElementById("shellBanner");
    if (!banner) return false;
    // Visible = not display:none and has at least one child item.
    return (
      banner.style.display !== "none" &&
      banner.children.length > 0
    );
  });
}

// ─── Helper: count .shell-banner-item elements ─────────────────────────────
async function getBannerItemCount(page) {
  return page.evaluate(() => {
    const banner = document.getElementById("shellBanner");
    if (!banner) return 0;
    return banner.querySelectorAll(".shell-banner-item").length;
  });
}

// ─── Helper: inject a broken-asset report directly via shellBoundary ───────
async function injectBrokenAssetReport(page, count) {
  return page.evaluate((n) => {
    if (typeof window.shellBoundary !== "object" || !window.shellBoundary) {
      return false;
    }
    var msg = "Некоторые ресурсы не найдены. " + n + " файл(ов).";
    window.shellBoundary.report(
      "broken-assets",
      msg,
      [{ label: "Подключить папку ресурсов", action: "pick-asset-folder" }],
    );
    return true;
  }, count);
}

// ─── Helper: clear a banner key directly via shellBoundary ─────────────────
async function clearBannerKey(page, key) {
  return page.evaluate((k) => {
    if (typeof window.shellBoundary !== "object" || !window.shellBoundary) {
      return false;
    }
    window.shellBoundary.clear(k);
    return true;
  }, key);
}

// ─── Helper: fire a shellBannerAction event to simulate action button ───────
async function dispatchBannerAction(page, key, action) {
  return page.evaluate(({ k, a }) => {
    window.dispatchEvent(
      new CustomEvent("shellBannerAction", {
        bubbles: false,
        detail: { key: k, action: a },
      }),
    );
    return true;
  }, { k: key, a: action });
}

test.describe("broken-asset-banner: shellBoundary + sandbox-mode @security", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !isChromiumOnlyProject(testInfo.project.name),
      "Chromium-only shell behaviour.",
    );
  });

  // ── Test BA1 ─────────────────────────────────────────────────────────────
  // The prepodovai reference deck contains self-contained assets (inline styles,
  // data-URIs, or CDN-hosted resources that resolve under the test server).
  // Loading it must NOT trigger the broken-asset banner. This validates that
  // the probe does not produce false positives on a clean deck.
  test("BA1 — clean reference deck (prepodovai) loads with zero shell banners", async ({ page }, testInfo) => {
    // Load the v3 prepodovai pitch deck — full reference deck.
    await loadReferenceDeck(page, "v3-prepodovai-pitch");

    // Wait briefly for the probe to run (onload + 200 ms defer + probe).
    await page.waitForTimeout(800);

    // The #shellBanner region must not be showing a broken-assets item.
    const itemCount = await getBannerItemCount(page);
    expect(itemCount).toBe(0);

    // The region itself must be hidden (display:none) when empty.
    const bannerVisible = await isShellBannerVisible(page);
    expect(bannerVisible).toBe(false);
  });

  // ── Test BA2 ─────────────────────────────────────────────────────────────
  // Inject a broken-asset report directly via shellBoundary.report to simulate
  // what the probe would do when missing assets are detected.
  // Verifies: banner appears, count is embedded in message, action button is present.
  test("BA2 — deck with missing img: banner appears with count and action button", async ({ page }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    // Wait for the automatic broken-asset probe (fires 200ms after onload +
    // async HEAD fetches) to complete before injecting the test banner.
    // This prevents the probe from clearing the test-injected banner.
    await page.waitForTimeout(1500);

    // Ensure shellBoundary is available.
    const hasBoundary = await evaluateEditor(
      page,
      "typeof window.shellBoundary === 'object' && typeof window.shellBoundary.report === 'function'",
    );
    expect(hasBoundary).toBe(true);

    // Inject a broken-asset report simulating 3 missing files.
    const reported = await injectBrokenAssetReport(page, 3);
    expect(reported).toBe(true);

    // The banner region must now be visible.
    await expect.poll(() => isShellBannerVisible(page), { timeout: 3000 }).toBe(true);

    // Exactly one banner item with key 'broken-assets'.
    const itemCount = await getBannerItemCount(page);
    expect(itemCount).toBe(1);

    // The message text must contain the count.
    const bannerText = await getShellBannerText(page);
    expect(bannerText).toContain("3");
    expect(bannerText).toContain("Некоторые ресурсы не найдены");

    // The action button text must be present.
    const actionLabel = await page.evaluate(() => {
      const btn = document.querySelector("#shellBanner .shell-banner-action-btn");
      return btn ? btn.textContent.trim() : "";
    });
    expect(actionLabel).toBe("Подключить папку ресурсов");
  });

  // ── Test BA3 ─────────────────────────────────────────────────────────────
  // The pick-asset-folder action (dispatched either from the button or from
  // another module) must clear the banner.
  // Also verifies the dismiss (x) button works directly.
  test("BA3 — banner dismisses on pick-asset-folder action and via dismiss button", async ({ page }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    // Wait for the automatic broken-asset probe to settle before injecting.
    await page.waitForTimeout(1500);

    // Inject a broken-asset report.
    await injectBrokenAssetReport(page, 2);

    // Banner must appear.
    await expect.poll(() => isShellBannerVisible(page), { timeout: 3000 }).toBe(true);

    // Dispatch the pick-asset-folder action — simulates clicking the action button.
    await dispatchBannerAction(page, "broken-assets", "pick-asset-folder");

    // Banner must be cleared.
    await expect.poll(() => isShellBannerVisible(page), { timeout: 3000 }).toBe(false);
    const itemCount = await getBannerItemCount(page);
    expect(itemCount).toBe(0);

    // Re-inject to test the dismiss button path.
    await injectBrokenAssetReport(page, 1);
    await expect.poll(() => isShellBannerVisible(page), { timeout: 3000 }).toBe(true);

    // Click the dismiss (x) button directly.
    await page.click("#shellBanner .shell-banner-dismiss");

    // Banner must be gone.
    await expect.poll(() => isShellBannerVisible(page), { timeout: 3000 }).toBe(false);
    const afterDismissCount = await getBannerItemCount(page);
    expect(afterDismissCount).toBe(0);
  });

  // ── Test BA4 ─────────────────────────────────────────────────────────────
  // Verify SANDBOX_MODES constant shape and DEFAULT_SANDBOX_MODE value.
  // This ensures the constants are exported correctly into the shell scope
  // and that the sandbox flag defaults to 'off' (deck-engine JS preserved).
  test("BA4 — SANDBOX_MODES constant has OFF/SCRIPTS_ONLY/FULL values and DEFAULT is 'off'", async ({ page }) => {
    // Navigate to the editor but don't need to load a deck.
    await page.goto("/editor/presentation-editor.html", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });

    // SANDBOX_MODES must be accessible in the shell scope.
    const sandboxModes = await evaluateEditor(
      page,
      "typeof SANDBOX_MODES !== 'undefined' ? JSON.stringify(SANDBOX_MODES) : null",
    );
    expect(sandboxModes).not.toBeNull();

    const modes = JSON.parse(sandboxModes);
    expect(modes.OFF).toBe("off");
    expect(modes.SCRIPTS_ONLY).toBe("scripts-only");
    expect(modes.FULL).toBe("full");

    // DEFAULT_SANDBOX_MODE must be 'off' to preserve deck-engine JS.
    const defaultMode = await evaluateEditor(
      page,
      "typeof DEFAULT_SANDBOX_MODE !== 'undefined' ? DEFAULT_SANDBOX_MODE : null",
    );
    expect(defaultMode).toBe("off");

    // state.sandboxMode must be initialized to DEFAULT_SANDBOX_MODE.
    const stateSandboxMode = await evaluateEditor(
      page,
      "typeof state !== 'undefined' ? (state.sandboxMode || null) : null",
    );
    expect(stateSandboxMode).toBe("off");
  });
});
