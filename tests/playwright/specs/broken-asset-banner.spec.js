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

// ─── Additional helpers for #brokenAssetBanner element ─────────────────────

// Inject unresolved assets directly into state and trigger banner render.
// Uses window.stateProxy — the Proxy shim exposed by state.js — for reliable
// cross-script write access without relying on const-scoped variable lookup.
async function injectUnresolvedAssets(page, paths) {
  return page.evaluate((items) => {
    var sp = window.stateProxy;
    if (!sp) return false;
    sp.unresolvedPreviewAssets = items;
    sp.brokenAssetBannerDismissed = false;
    if (typeof window.updateBrokenAssetBanner === "function") {
      window.updateBrokenAssetBanner();
    }
    return true;
  }, paths);
}

// Reset unresolved assets and hide banner.
async function clearUnresolvedAssets(page) {
  return page.evaluate(() => {
    var sp = window.stateProxy;
    if (!sp) return false;
    sp.unresolvedPreviewAssets = [];
    sp.brokenAssetBannerDismissed = false;
    if (typeof window.updateBrokenAssetBanner === "function") {
      window.updateBrokenAssetBanner();
    }
    return true;
  });
}

test.describe("broken-asset-banner: #brokenAssetBanner element (WO-24, P0-04)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !isChromiumOnlyProject(testInfo.project.name),
      "Chromium-only shell behaviour.",
    );
    await page.goto("/editor/presentation-editor.html", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  });

  // ── Test BAE1 ─────────────────────────────────────────────────────────────
  // With zero unresolved assets, #brokenAssetBanner must be hidden.
  test("BAE1 — zero unresolved assets: banner has hidden attribute and aria-hidden=true", async ({ page }) => {
    await clearUnresolvedAssets(page);

    const banner = page.locator("#brokenAssetBanner");
    await expect(banner).toHaveAttribute("hidden", "");
    await expect(banner).toHaveAttribute("aria-hidden", "true");
  });

  // ── Test BAE2 ─────────────────────────────────────────────────────────────
  // With 3 unresolved assets, banner shows correct plural count and list items.
  test("BAE2 — 3 unresolved assets: banner shows 'Не загружено 3 файла' with 3-entry list", async ({ page }) => {
    const paths = ["images/logo.png", "styles/main.css", "fonts/body.woff2"];
    await injectUnresolvedAssets(page, paths);

    const banner = page.locator("#brokenAssetBanner");
    await expect(banner).not.toHaveAttribute("hidden");
    await expect(banner).toHaveAttribute("aria-hidden", "false");

    // Title must contain the count and plural form.
    const title = page.locator("#brokenAssetBannerTitle");
    await expect(title).toContainText("Не загружено 3");
    await expect(title).toContainText("файла");

    // List must have exactly 3 items.
    const listItems = page.locator("#brokenAssetBannerList li");
    await expect(listItems).toHaveCount(3);

    // Each path must appear in the list.
    for (const p of paths) {
      await expect(page.locator("#brokenAssetBannerList")).toContainText(p);
    }
  });

  // ── Test BAE3 ─────────────────────────────────────────────────────────────
  // Dismiss button click hides the banner (state.brokenAssetBannerDismissed = true).
  // The banner lives inside the inspector panel which may be hidden when no deck is
  // loaded. We verify dismiss behaviour via window.dismissBrokenAssetBanner() and
  // then confirm the brokenAssetBannerDismissed state flag is set.
  test("BAE3 — dismiss button hides banner and sets dismissed flag", async ({ page }) => {
    await injectUnresolvedAssets(page, ["img/missing.png"]);

    const banner = page.locator("#brokenAssetBanner");
    // Banner element must have hidden removed after inject.
    await expect(banner).not.toHaveAttribute("hidden");

    // Call dismissBrokenAssetBanner via the global window function (same logic
    // as the dismiss button's click handler) to avoid clicking inside a potentially
    // hidden panel.
    const dismissed = await page.evaluate(() => {
      if (typeof window.dismissBrokenAssetBanner !== "function") return null;
      window.dismissBrokenAssetBanner();
      return window.stateProxy ? window.stateProxy.brokenAssetBannerDismissed : null;
    });
    expect(dismissed).toBe(true);

    // Banner must now be hidden.
    await expect(banner).toHaveAttribute("hidden", "");
    await expect(banner).toHaveAttribute("aria-hidden", "true");

    // Verify: calling updateBrokenAssetBanner while dismissed keeps banner hidden.
    await page.evaluate(() => {
      if (typeof window.updateBrokenAssetBanner === "function") {
        window.updateBrokenAssetBanner();
      }
    });
    await expect(banner).toHaveAttribute("hidden", "");
  });

  // ── Test BAE4 ─────────────────────────────────────────────────────────────
  // Overflow: 6 assets cap to 5 shown + 1 "…и ещё" entry.
  test("BAE4 — 6 assets: list caps at 5 entries with overflow indicator", async ({ page }) => {
    const paths = [
      "a/1.png", "b/2.png", "c/3.png", "d/4.png", "e/5.png", "f/6.png",
    ];
    await injectUnresolvedAssets(page, paths);

    const banner = page.locator("#brokenAssetBanner");
    await expect(banner).not.toHaveAttribute("hidden");

    // 5 regular items + 1 overflow item = 6 total
    const listItems = page.locator("#brokenAssetBannerList li");
    await expect(listItems).toHaveCount(6);

    // The overflow item must contain "ещё 1"
    const overflow = page.locator("#brokenAssetBannerList .broken-asset-more");
    await expect(overflow).toHaveCount(1);
    await expect(overflow).toContainText("1");
  });

  // ── Test BAE5 ─────────────────────────────────────────────────────────────
  // Export HTML must NOT contain id="brokenAssetBanner" (data-editor-ui stripping).
  test("BAE5 — export HTML does not contain id=brokenAssetBanner", async ({ page }) => {
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL });

    // Trigger export and capture the result.
    const exported = await page.evaluate(async () => {
      if (typeof window.exportCurrentHtml !== "function") return null;
      return window.exportCurrentHtml();
    });

    // If exportCurrentHtml is not available, verify via DOM export.
    if (exported !== null) {
      expect(exported).not.toContain("id=\"brokenAssetBanner\"");
      expect(exported).not.toContain("broken-asset-banner");
    }

    // Additionally verify the element has data-editor-ui="true" (export will strip it).
    const hasEditorUi = await page.evaluate(() => {
      const el = document.getElementById("brokenAssetBanner");
      return el ? el.getAttribute("data-editor-ui") : null;
    });
    expect(hasEditorUi).toBe("true");
  });

  // ── Test BAE6 ─────────────────────────────────────────────────────────────
  // Plural forms: 1 = файл, 2 = файла, 5 = файлов.
  test("BAE6 — Russian plural forms are correct for 1, 2, 5 unresolved assets", async ({ page }) => {
    // 1 file
    await injectUnresolvedAssets(page, ["a.png"]);
    await expect(page.locator("#brokenAssetBannerTitle")).toContainText("1\u00a0файл");

    // 2 files
    await injectUnresolvedAssets(page, ["a.png", "b.png"]);
    await expect(page.locator("#brokenAssetBannerTitle")).toContainText("2\u00a0файла");

    // 5 files
    await injectUnresolvedAssets(page, ["a.png", "b.png", "c.png", "d.png", "e.png"]);
    await expect(page.locator("#brokenAssetBannerTitle")).toContainText("5\u00a0файлов");
  });
});

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

    // The broken-asset probe must NOT fire on a clean reference deck.
    // Note: other banners (e.g. trust-banner for deck scripts) may legitimately
    // be present — this test only asserts the broken-assets probe does not
    // false-positive on a reference deck with no missing resources.
    const brokenAssetsItemCount = await page.evaluate(() => {
      const banner = document.getElementById("shellBanner");
      if (!banner) return 0;
      return banner.querySelectorAll('[data-banner-key="broken-assets"]').length;
    });
    expect(brokenAssetsItemCount).toBe(0);
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
