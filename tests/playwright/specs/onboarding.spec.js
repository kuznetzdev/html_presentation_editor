// onboarding.spec.js
// Gate-B: WO-25 empty-state CTA rehome + starter-deck relocation
// Acceptance criteria from WO-25-starter-deck-cta-rehome.md

const { test, expect } = require("@playwright/test");
const {
  gotoFreshEditor,
} = require("../helpers/editorApp");

test.describe("Empty-state landing — WO-25 / v2.0.29 @onboarding", () => {
  // v2.0.29: empty-state simplified to 2 main CTAs + 1 tertiary text link.
  // Disclosure pattern (Дополнительно ▾ → paste) was removed in favor of paste
  // being directly visible — paste-from-clipboard is a primary user need, not
  // a "more options" feature.
  test("empty state renders 2 main CTAs (open + paste) directly visible + 1 starter text link", async ({
    page,
  }) => {
    await gotoFreshEditor(page);

    // Primary button: Открыть HTML
    const openBtn = page.locator("#emptyOpenBtn");
    await expect(openBtn).toBeVisible();
    await expect(openBtn).toHaveText(/Открыть HTML/);

    // Secondary ghost button: Вставить из буфера (now directly visible)
    const pasteBtn = page.locator("#emptyPasteBtn");
    await expect(pasteBtn).toBeVisible();
    await expect(pasteBtn).toHaveText(/Вставить из буфера/);

    // Tertiary text link inside footnote: попробуйте на примере
    const starterBtn = page.locator("#emptyStarterDeckBtn");
    await expect(starterBtn).toBeVisible();
    await expect(starterBtn).toHaveText(/попробуйте на примере/);

    // Accessibility: starter link still carries aria-label
    await expect(starterBtn).toHaveAttribute("aria-label", "Открыть стартовый пример");

    // Disclosure pattern removed in v2.0.29 — toggle + panel no longer in DOM
    await expect(page.locator("#emptyMoreToggleBtn")).toHaveCount(0);
    await expect(page.locator("#emptyMorePanel")).toHaveCount(0);
  });

  test("paste button is keyboard-reachable directly (no disclosure to expand)", async ({
    page,
  }) => {
    await gotoFreshEditor(page);

    const pasteBtn = page.locator("#emptyPasteBtn");
    await expect(pasteBtn).toBeVisible();

    // Reachable via Tab from open button
    await page.locator("#emptyOpenBtn").focus();
    await page.keyboard.press("Tab");
    await expect(pasteBtn).toBeFocused();
  });

  test("STARTER_DECKS.basic.href points to editor/fixtures/basic-deck.html", async ({
    page,
  }) => {
    await gotoFreshEditor(page);

    const starterHref = await page.evaluate(() => {
      return typeof STARTER_DECKS !== "undefined"
        ? STARTER_DECKS.basic.href
        : null;
    });

    // v2.0.30 — paths are now RELATIVE to the editor HTML (file:// support).
    expect(starterHref).toBe("fixtures/basic-deck.html");
  });

  test("Попробовать на примере loads starter deck and renders at least 1 slide", async ({
    page,
  }) => {
    await gotoFreshEditor(page);

    const starterBtn = page.locator("#emptyStarterDeckBtn");
    await expect(starterBtn).toBeVisible();
    await starterBtn.click();

    // Wait for preview to load
    await page.waitForFunction(
      () =>
        globalThis.eval(`(() => {
          return Boolean(state.modelDoc) && state.previewLifecycle === "ready";
        })()`),
      undefined,
      { timeout: 25_000 },
    );

    // Slide rail should contain at least 1 slide
    const slideRailSlide = page.locator("#slidesPanel [data-slide-id]");
    await expect(slideRailSlide.first()).toBeVisible({ timeout: 10_000 });
  });
});
