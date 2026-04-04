/**
 * Overlap Recovery — e2e tests (@stage-n)
 *
 * Covers issue #1:
 *  N1 overlap detection map appears for covered elements
 *  N2 severe overlap warning badge appears in slide rail (basic mode)
 *  N3 overlap hover does not draw a ghost outline over hidden elements
 *  N4 move-to-top action raises z-index and hides recovery banner
 */

"use strict";

const { test, expect } = require("@playwright/test");
const {
  closeCompactShellPanels,
  ensureShellPanelVisible,
  evaluateEditor,
  isChromiumOnlyProject,
  loadReferenceDeck,
} = require("../helpers/editorApp");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load the absolute-positioned reference deck (slide 2 has 3 overlapping
 * .card elements) and activate slide 2.
 */
async function loadOverlapDeck(page) {
  await loadReferenceDeck(page, "v1-absolute-positioned", { mode: "edit" });
  await closeCompactShellPanels(page);

  // Activate slide 2 (index 1) — request slide activation and wait for it
  const targetSlideId = await evaluateEditor(
    page,
    "state.slides[Math.min(1, state.slides.length - 1)]?.id || null",
  );
  if (!targetSlideId) throw new Error("Could not resolve target slide id");

  await evaluateEditor(
    page,
    `requestSlideActivation(${JSON.stringify(targetSlideId)}, { reason: "stage-n-overlap" })`,
  );
  // Wait for the bridge roundtrip to confirm slide is active
  await expect
    .poll(
      () =>
        evaluateEditor(
          page,
          `state.runtimeActiveSlideId === ${JSON.stringify(targetSlideId)} || state.activeSlideId === ${JSON.stringify(targetSlideId)}`,
        ),
      { timeout: 8000 },
    )
    .toBe(true);
}

/**
 * Select the first non-slide-root element in the active slide's modelDoc
 * directly via the bridge (bypasses context menu, fully deterministic).
 */
async function selectFirstCoveredCard(page) {
  const nodeId = await evaluateEditor(
    page,
    `(() => {
      const slideId = state.activeSlideId;
      if (!slideId || !state.modelDoc) return null;
      const esc = slideId.replace(/["\\\\]/g, "\\\\$&");
      const slideEl = state.modelDoc.querySelector('[data-editor-slide-id="' + esc + '"]');
      if (!slideEl) return null;
      const nodes = Array.from(slideEl.querySelectorAll("[data-editor-node-id]"))
        .filter(el => !el.hasAttribute("data-editor-slide-id"));
      return nodes[0]?.getAttribute("data-editor-node-id") || null;
    })()`,
  );
  if (!nodeId) throw new Error("Could not resolve covered card nodeId from modelDoc");

  await evaluateEditor(
    page,
    `sendToBridge("select-element", { nodeId: ${JSON.stringify(nodeId)} })`,
  );
  await expect
    .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), { timeout: 6000 })
    .toBe(nodeId);
  return nodeId;
}

/**
 * Explicitly run overlap detection (bypasses the 200ms debounce) and wait
 * until the conflict array for the active slide is populated.
 */
async function triggerAndWaitForOverlapDetection(page) {
  await evaluateEditor(page, 'runOverlapDetectionNow("test-trigger")');
  // Wait until overlapConflictsBySlide[activeSlideId] is defined (may be [])
  await expect
    .poll(
      () =>
        evaluateEditor(
          page,
          `Array.isArray(state.overlapConflictsBySlide[state.activeSlideId])`,
        ),
      { timeout: 5000 },
    )
    .toBe(true);
}

// ---------------------------------------------------------------------------
// N1 — Basic overlap detection
// ---------------------------------------------------------------------------

test.describe("N1 — Overlap detection", () => {
  test("covered element generates overlap conflicts @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    await selectFirstCoveredCard(page);
    await triggerAndWaitForOverlapDetection(page);

    const snapshot = JSON.parse(
      await evaluateEditor(
        page,
        `JSON.stringify({
          conflictCount: (state.overlapConflictsBySlide[state.activeSlideId] || []).length,
          selectedCovered: Number(state.selectedOverlapWarning?.coveredPercent || 0)
        })`,
      ),
    );

    // The deck's slide 2 has 3 overlapping cards → at least 1 conflict expected
    expect(snapshot.conflictCount).toBeGreaterThan(0);
    // The first card is covered by card 2 (~41%) → > 30 threshold
    expect(snapshot.selectedCovered).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// N2 — Rail warning badge
// ---------------------------------------------------------------------------

test.describe("N2 — Warning badge", () => {
  test("basic mode shows overlap warning badge in rail @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    // Run detection explicitly so rail re-renders before the assertion
    await triggerAndWaitForOverlapDetection(page);

    // slideOverlapWarnings threshold is now > 30%, deck has ~41% → badge appears
    await ensureShellPanelVisible(page, "slides");
    const warningTag = page.locator("#slidesList .slide-tag.is-overlap-warning").first();
    await expect(warningTag).toBeVisible({ timeout: 6000 });
    await expect(warningTag).toContainText("перекрытие");
  });
});

// ---------------------------------------------------------------------------
// N3 — No ghost outline on overlap hover
// ---------------------------------------------------------------------------

test.describe("N3 — No overlap ghost outline", () => {
  test("hovering overlap area does not highlight hidden element @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    await triggerAndWaitForOverlapDetection(page);

    // Dispatch a mousemove event at the centre of the first conflict's overlapRect.
    // Overlap recovery must stay discoverable via banner/warning only, without
    // rendering a translucent ghost element in the canvas on plain hover.
    const dispatched = await evaluateEditor(
      page,
      `(() => {
        const conflicts = state.overlapConflictsBySlide[state.activeSlideId] || [];
        const c = conflicts.find(x => x.coveredPercent >= 30);
        if (!c) return false;
        const cx = Math.round((c.overlapRect.left + c.overlapRect.right) / 2);
        const cy = Math.round((c.overlapRect.top + c.overlapRect.bottom) / 2);
        const doc = document.getElementById("previewFrame")?.contentDocument;
        if (!doc) return false;
        doc.dispatchEvent(
          new MouseEvent("mousemove", {
            bubbles: true,
            cancelable: true,
            clientX: cx,
            clientY: cy,
          }),
        );
        return true;
      })()`,
    );

    expect(dispatched).toBe(true);

    await page.waitForTimeout(250);

    const ghostExists = await evaluateEditor(
      page,
      `(() => {
        const doc = document.getElementById("previewFrame")?.contentDocument;
        return !!doc?.querySelector('[data-editor-highlight="ghost"]');
      })()`,
    );
    expect(ghostExists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// N4 — Move to top
// ---------------------------------------------------------------------------

test.describe("N4 — Move to top", () => {
  test("move-to-top action raises z-index and clears recovery banner @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    await selectFirstCoveredCard(page);
    await triggerAndWaitForOverlapDetection(page);

    // Banner must be visible before the test makes sense
    await ensureShellPanelVisible(page, "inspector");
    const banner = page.locator("#overlapRecoveryBanner");
    await expect(banner).toBeVisible({ timeout: 6000 });

    const moveBtn = page.locator("#overlapMoveTopBtn");
    await expect(moveBtn).toBeEnabled();

    // z-index may be "auto" initially → normalise to 0
    const before = await evaluateEditor(
      page,
      `(() => { const z = state.selectedComputed?.zIndex || ""; const n = Number.parseFloat(z); return Number.isFinite(n) ? n : 0; })()`,
    );

    await moveBtn.click();

    // Bridge roundtrip: apply-style → element-updated → state.selectedComputed.zIndex updated
    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `(() => { const z = state.selectedComputed?.zIndex || ""; const n = Number.parseFloat(z); return Number.isFinite(n) ? n : 0; })()`,
          ),
        { timeout: 6000 },
      )
      .toBeGreaterThan(before);

    // After re-detection the banner should be hidden (element now on top, coveredPercent drops)
    await expect(banner).toBeHidden({ timeout: 8000 });
  });
});
