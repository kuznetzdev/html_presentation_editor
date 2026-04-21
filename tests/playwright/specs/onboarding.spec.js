// onboarding.spec.js
// Gate-B: WO-25 empty-state CTA rehome + starter-deck relocation
// Acceptance criteria from WO-25-starter-deck-cta-rehome.md

const { test, expect } = require("@playwright/test");
const {
  gotoFreshEditor,
} = require("../helpers/editorApp");

test.describe("Empty-state CTA rehome — WO-25 @onboarding", () => {
  test("empty state renders exactly 2 visible buttons + 1 disclosure toggle", async ({
    page,
  }) => {
    await gotoFreshEditor(page);

    // Primary button: Открыть HTML
    const openBtn = page.locator("#emptyOpenBtn");
    await expect(openBtn).toBeVisible();
    await expect(openBtn).toHaveText(/Открыть HTML/);

    // Secondary ghost button: Попробовать на примере
    const starterBtn = page.locator("#emptyStarterDeckBtn");
    await expect(starterBtn).toBeVisible();
    await expect(starterBtn).toHaveText(/Попробовать на примере/);

    // Accessibility: starter button should have aria-label for screen readers
    await expect(starterBtn).toHaveAttribute("aria-label", "Открыть стартовый пример");

    // Disclosure toggle: Дополнительно — visible but paste panel is hidden
    const toggleBtn = page.locator("#emptyMoreToggleBtn");
    await expect(toggleBtn).toBeVisible();
    await expect(toggleBtn).toHaveText(/Дополнительно/);
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // Paste button is hidden inside the disclosure panel
    const pasteBtn = page.locator("#emptyPasteBtn");
    const morePanel = page.locator("#emptyMorePanel");
    await expect(morePanel).toBeHidden();
    await expect(pasteBtn).toBeHidden();
  });

  test("disclosure toggle shows and hides the paste button panel", async ({
    page,
  }) => {
    await gotoFreshEditor(page);

    const toggleBtn = page.locator("#emptyMoreToggleBtn");
    const morePanel = page.locator("#emptyMorePanel");
    const pasteBtn = page.locator("#emptyPasteBtn");

    // Initially hidden
    await expect(morePanel).toBeHidden();
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

    // Click to expand
    await toggleBtn.click();
    await expect(morePanel).toBeVisible();
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
    await expect(toggleBtn).toHaveText(/Дополнительно ▴/);
    await expect(pasteBtn).toBeVisible();

    // Click again to collapse
    await toggleBtn.click();
    await expect(morePanel).toBeHidden();
    await expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    await expect(toggleBtn).toHaveText(/Дополнительно ▾/);
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

    expect(starterHref).toBe("/editor/fixtures/basic-deck.html");
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
