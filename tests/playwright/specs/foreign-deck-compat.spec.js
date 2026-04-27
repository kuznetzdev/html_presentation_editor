/**
 * foreign-deck-compat.spec.js
 *
 * Compatibility tests for foreign HTML presentations (not authored in our editor).
 * Verifies that the Import Normalizer CSS overrides and nav-key blocking work
 * correctly across three structural classes of deck:
 *
 *   1. viewport-flat  — .deck > .slide  (ops_control_room_stress)
 *   2. viewport-flat  — .deck > .slide  (mercury_casefile_stress)
 *   3. reveal-nested  — .reveal > .slides > section.h-slide + vertical .v-slide
 *                       + .fragment (reveal_like_nested_stress)
 *
 * What is tested per fixture:
 *   A. Slide detection  — editor assigns data-editor-slide-id to all top-level slides
 *   B. Slide visibility — in edit mode, decks with own class activation (.active/.present/etc.)
 *                         preserve single-slide view (1 slide visible, deck manages opacity);
 *                         decks without own activation get full opacity:1 override on all slides
 *   C. Pointer events   — in edit mode, pointer-events:auto on all slides (always)
 *   D. Node IDs         — editor assigns data-editor-node-id to content elements
 *   E. Fragment reveal  — .fragment elements visible (opacity:1) in edit mode
 *   F. Nav-key blocking — ArrowRight does NOT advance the active slide when editing
 *   G. Stack sub-slides — .v-slide elements inside .stack unfolded (display:block)
 *
 * @tag foreign-deck
 */

const path = require("path");
const { test, expect } = require("@playwright/test");
const {
  gotoFreshEditor,
  openHtmlFixture,
  setMode,
  evaluateEditor,
  previewLocator,
} = require("../helpers/editorApp");
const { waitForRafTicks } = require("../helpers/waits");

const FIXTURE_DIR = path.resolve(__dirname, "../../fixtures/playwright");

const FIXTURES = {
  opsControlRoom: path.join(FIXTURE_DIR, "ops_control_room_stress.html"),
  mercuryCasefile: path.join(FIXTURE_DIR, "mercury_casefile_stress.html"),
  revealNested: path.join(FIXTURE_DIR, "reveal_like_nested_stress.html"),
};

// ── helpers ──────────────────────────────────────────────────────────────────

/** Load a foreign fixture and switch to edit mode. */
async function loadForeignDeck(page, fixturePath) {
  await gotoFreshEditor(page);
  await openHtmlFixture(page, fixturePath);
  await setMode(page, "edit");
}

/**
 * Query the preview iframe for computed style of all elements matching selector.
 * Returns array of { opacity, pointerEvents } objects.
 */
async function getComputedStylesInPreview(page, selector) {
  return page.frameLocator("#previewFrame").locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const cs = window.getComputedStyle(el);
      return {
        opacity: cs.opacity,
        pointerEvents: cs.pointerEvents,
        display: cs.display,
        transform: cs.transform,
      };
    })
  );
}

/**
 * Returns count of elements matching selector in the preview iframe.
 */
async function countInPreview(page, selector) {
  return page.frameLocator("#previewFrame").locator(selector).count();
}

// ── Test suite: viewport flat deck — Ops Control Room ───────────────────────

test.describe("Foreign deck: Ops Control Room (viewport flat) @foreign-deck", () => {
  test.beforeEach(async ({ page }) => {
    await loadForeignDeck(page, FIXTURES.opsControlRoom);
  });

  test("A: editor detects all 4 slides and assigns slide IDs", async ({ page }) => {
    const slideCount = await countInPreview(page, "[data-editor-slide-id]");
    expect(slideCount).toBe(4);
  });

  test("B: deck preserves single-slide view — exactly 1 slide visible in edit mode", async ({ page }) => {
    // This deck uses .slide.active to manage visibility — the bridge detects this
    // and skips the opacity:1!important override so slides don't all overlap.
    const styles = await getComputedStylesInPreview(page, "[data-editor-slide-id]");
    expect(styles.length).toBe(4);
    const visible = styles.filter((s) => parseFloat(s.opacity) > 0.9);
    // Exactly 1 slide visible at a time (deck's own .active mechanism preserved)
    expect(visible.length).toBe(1);
  });

  test("C: active slide is interactive; non-active slides respect deck pointer-events", async ({ page }) => {
    const styles = await getComputedStylesInPreview(page, "[data-editor-slide-id]");
    expect(styles.length).toBeGreaterThan(0);
    // Deck CSS: .slide{pointer-events:none} .slide.active{pointer-events:all}
    // Editor must NOT force pointer-events:auto on invisible slides.
    const interactive = styles.filter((s) => s.pointerEvents !== 'none');
    expect(interactive.length).toBe(1);
  });

  test("D: content elements have data-editor-node-id", async ({ page }) => {
    const nodeCount = await countInPreview(page, "[data-editor-node-id]");
    expect(nodeCount).toBeGreaterThan(10);
  });

  test("F: ArrowRight keypress does NOT advance the active deck slide", async ({ page }) => {
    // Record which slide is active before pressing arrow
    const activeBefore = await page.frameLocator("#previewFrame")
      .locator(".slide.active")
      .count();
    expect(activeBefore).toBe(1);

    // Press ArrowRight — should be blocked by bridge, not handled by deck JS
    await page.frameLocator("#previewFrame").locator("body").focus();
    await page.keyboard.press("ArrowRight");
    // Allow several RAFs for any deferred slide-advance handler to fire; bridge
    // should have blocked the keypress so nothing should change.
    await waitForRafTicks(page, 8);

    // Still the same slide active (deck JS did not run)
    const activeAfter = await page.frameLocator("#previewFrame")
      .locator(".slide.active")
      .count();
    expect(activeAfter).toBe(1);

    // Verify it's slide index 0 (first slide, unchanged)
    const activeIndex = await page.frameLocator("#previewFrame")
      .locator(".slide")
      .evaluateAll((slides) => slides.findIndex((s) => s.classList.contains("active")));
    expect(activeIndex).toBe(0);
  });
});

// ── Test suite: viewport flat deck — Mercury Casefile ───────────────────────

test.describe("Foreign deck: Mercury Casefile (viewport flat) @foreign-deck", () => {
  test.beforeEach(async ({ page }) => {
    await loadForeignDeck(page, FIXTURES.mercuryCasefile);
  });

  test("A: editor detects all 4 slides", async ({ page }) => {
    const slideCount = await countInPreview(page, "[data-editor-slide-id]");
    expect(slideCount).toBe(4);
  });

  test("B: deck preserves single-slide view — exactly 1 slide visible in edit mode", async ({ page }) => {
    // This deck uses .slide.active — bridge detects own visibility mechanism and
    // skips opacity override to avoid all-slides-overlap.
    const styles = await getComputedStylesInPreview(page, "[data-editor-slide-id]");
    expect(styles.length).toBe(4);
    const visible = styles.filter((s) => parseFloat(s.opacity) > 0.9);
    expect(visible.length).toBe(1);
  });

  test("C: active slide is interactive; non-active slides respect deck pointer-events", async ({ page }) => {
    const styles = await getComputedStylesInPreview(page, "[data-editor-slide-id]");
    expect(styles.length).toBeGreaterThan(0);
    // Deck CSS: .slide{pointer-events:none} .slide.active{pointer-events:all}
    // Editor must NOT force pointer-events:auto on invisible slides.
    const interactive = styles.filter((s) => s.pointerEvents !== 'none');
    expect(interactive.length).toBe(1);
  });

  test("D: kanban tickets and data cells have node IDs", async ({ page }) => {
    const nodeCount = await countInPreview(page, "[data-editor-node-id]");
    expect(nodeCount).toBeGreaterThan(20);
  });

  test("D2: table cells have node IDs for editing", async ({ page }) => {
    const tdCount = await countInPreview(page, "td[data-editor-node-id], th[data-editor-node-id]");
    expect(tdCount).toBeGreaterThan(4);
  });
});

// ── Test suite: reveal-like nested deck ─────────────────────────────────────

test.describe("Foreign deck: Reveal-like nested (h-slide + v-slide + fragments) @foreign-deck", () => {
  test.beforeEach(async ({ page }) => {
    await loadForeignDeck(page, FIXTURES.revealNested);
  });

  test("A: editor detects 3 top-level horizontal slides", async ({ page }) => {
    // The reveal-like deck has 3 .h-slide sections at .reveal .slides > section level.
    // Import pipeline uses '.reveal .slides > section' selector → 3 slides.
    const slideCount = await countInPreview(page, "[data-editor-slide-id]");
    expect(slideCount).toBe(3);
  });

  test("B: deck preserves single-slide view — exactly 1 h-slide visible in edit mode", async ({ page }) => {
    // Uses section.active — bridge skips opacity override; deck manages visibility.
    const styles = await getComputedStylesInPreview(page, "[data-editor-slide-id]");
    expect(styles.length).toBe(3);
    const visible = styles.filter((s) => parseFloat(s.opacity) > 0.9);
    expect(visible.length).toBe(1);
  });

  test("C: active slide is interactive; non-active slides respect deck pointer-events", async ({ page }) => {
    const styles = await getComputedStylesInPreview(page, "[data-editor-slide-id]");
    expect(styles.length).toBeGreaterThan(0);
    // Deck CSS: .slide{pointer-events:none} .slide.active{pointer-events:all}
    // Editor must NOT force pointer-events:auto on invisible slides.
    const interactive = styles.filter((s) => s.pointerEvents !== 'none');
    expect(interactive.length).toBe(1);
  });

  test("E: .fragment elements are visible in edit mode (opacity:1)", async ({ page }) => {
    const fragmentStyles = await getComputedStylesInPreview(page, ".fragment");
    // Deck has multiple fragment elements across slides
    expect(fragmentStyles.length).toBeGreaterThan(0);
    for (const s of fragmentStyles) {
      expect(parseFloat(s.opacity)).toBeGreaterThan(0.9);
    }
  });

  test("G: .v-slide elements inside .stack are unfolded (display:block)", async ({ page }) => {
    // The vertical stack slide contains 3 .v-slide sections hidden by default
    // via CSS: section.stack > section { display: none }
    // In edit mode they must be display:block
    const vSlideStyles = await page.frameLocator("#previewFrame")
      .locator("section.stack > section.v-slide")
      .evaluateAll((els) =>
        els.map((el) => window.getComputedStyle(el).display)
      );
    expect(vSlideStyles.length).toBe(3);
    for (const display of vSlideStyles) {
      expect(display).toBe("block");
    }
  });

  test("F: ArrowRight keypress does NOT advance h-slide", async ({ page }) => {
    // Record hIndex before — should be 0 (first h-slide active)
    const activeBefore = await page.frameLocator("#previewFrame")
      .locator(".h-slide.active")
      .count();
    expect(activeBefore).toBe(1);

    await page.frameLocator("#previewFrame").locator("body").focus();
    await page.keyboard.press("ArrowRight");
    // Allow several RAFs for any deferred slide-advance handler to fire; bridge
    // should have blocked the keypress so nothing should change.
    await waitForRafTicks(page, 8);

    const activeAfter = await page.frameLocator("#previewFrame")
      .locator(".h-slide.active")
      .count();
    expect(activeAfter).toBe(1);

    const activeIndex = await page.frameLocator("#previewFrame")
      .locator(".h-slide")
      .evaluateAll((slides) => slides.findIndex((s) => s.classList.contains("active")));
    expect(activeIndex).toBe(0);
  });
});

// ── Regression guard: own-format deck unaffected ────────────────────────────

test.describe("Regression: own-format basic-deck unaffected by compat overrides @foreign-deck", () => {
  test("basic-deck loads in edit mode without regressions", async ({ page }) => {
    const basicDeckPath = path.join(FIXTURE_DIR, "basic-deck.html");
    await gotoFreshEditor(page);
    await openHtmlFixture(page, basicDeckPath);
    await setMode(page, "edit");

    // Own-format deck should still work: slides detected
    const slideCount = await countInPreview(page, "[data-editor-slide-id]");
    expect(slideCount).toBeGreaterThan(0);

    // And be visible
    const styles = await getComputedStylesInPreview(page, "[data-editor-slide-id]");
    for (const s of styles) {
      expect(parseFloat(s.opacity)).toBeGreaterThan(0.9);
    }
  });
});
