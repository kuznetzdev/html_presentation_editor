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

test.describe("N5 вЂ” Magic Select", () => {
  test("advanced overlap banner opens layer picker and keyboard selection works @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    const initialNodeId = await selectFirstCoveredCard(page);
    await triggerAndWaitForOverlapDetection(page);

    await ensureShellPanelVisible(page, "inspector");
    await evaluateEditor(
      page,
      `typeof setComplexityMode === "function" && setComplexityMode("advanced")`,
    );

    const magicSelectBtn = page.locator("#overlapSelectLayerBtn");
    await expect(magicSelectBtn).toBeVisible({ timeout: 6000 });
    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `Boolean(typeof buildSelectedOverlapLayerPickerPayload === "function" && buildSelectedOverlapLayerPickerPayload())`,
          ),
        { timeout: 6000 },
      )
      .toBe(true);
    await expect(magicSelectBtn).toBeEnabled();

    await magicSelectBtn.click();

    const picker = page.locator("#layerPicker");
    await expect(picker).toBeVisible({ timeout: 6000 });
    await expect
      .poll(
        () => page.locator("#layerPickerList button").count(),
        { timeout: 6000 },
      )
      .toBeGreaterThanOrEqual(2);

    const nextButton = page.locator("#layerPickerList button").nth(1);
    const nextNodeId = await nextButton.getAttribute("data-layer-picker-node-id");
    expect(nextNodeId).toBeTruthy();
    await nextButton.focus();
    await page.keyboard.press("Enter");

    await expect
      .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), { timeout: 6000 })
      .toBe(nextNodeId);

    await magicSelectBtn.click();
    await expect(picker).toBeVisible({ timeout: 6000 });
    await picker.press("Escape");
    await expect(picker).toBeHidden({ timeout: 6000 });
  });
});

test.describe("N6 вЂ” Insert auto-promotion", () => {
  test("inserted element auto-promotes when it lands heavily covered @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    await triggerAndWaitForOverlapDetection(page);

    const inserted = await evaluateEditor(
      page,
      `(() => {
        const conflict = (state.overlapConflictsBySlide[state.activeSlideId] || [])
          .find((item) => item.coveredPercent >= 30);
        if (!conflict) return false;
        const left = Math.round(conflict.overlapRect.left + 8);
        const top = Math.round(conflict.overlapRect.top + 8);
        const html = '<div style="position:absolute;left:' + left + 'px;top:' + top + 'px;width:160px;height:96px;background:#ff6b6b;border:2px solid #1d1d1f;z-index:0;">auto-promote</div>';
        sendToBridge("insert-element", {
          slideId: state.activeSlideId,
          html,
          focusText: false,
        });
        return true;
      })()`,
    );
    expect(inserted).toBe(true);

    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `(() => {
              const node = Array.from(state.modelDoc?.querySelectorAll("[data-editor-node-id]") || [])
                .find((entry) => (entry.textContent || "").includes("auto-promote"));
              if (!(node instanceof Element)) return null;
              const parsed = Number.parseFloat(node.style.zIndex || "0");
              return JSON.stringify({
                nodeId: node.getAttribute("data-editor-node-id") || "",
                zIndex: Number.isFinite(parsed) ? parsed : -1,
              });
            })()`,
          ),
        { timeout: 8000 },
      )
      .not.toBeNull();

    const insertedNode = JSON.parse(
      await evaluateEditor(
        page,
        `(() => {
          const node = Array.from(state.modelDoc?.querySelectorAll("[data-editor-node-id]") || [])
            .find((entry) => (entry.textContent || "").includes("auto-promote"));
          if (!(node instanceof Element)) return "null";
          const parsed = Number.parseFloat(node.style.zIndex || "0");
          return JSON.stringify({
            nodeId: node.getAttribute("data-editor-node-id") || "",
            zIndex: Number.isFinite(parsed) ? parsed : -1,
          });
        })()`,
      ),
    );
    expect(insertedNode?.nodeId).toBeTruthy();

    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `(() => {
              const nodeId = ${JSON.stringify(insertedNode.nodeId)};
              const conflicts = state.overlapConflictsBySlide[state.activeSlideId] || [];
              const covered = conflicts
                .filter((entry) => entry.bottomNodeId === nodeId)
                .map((entry) => Number(entry.coveredPercent || 0));
              return covered.length ? Math.max(...covered) : 0;
            })()`,
          ),
        { timeout: 8000 },
      )
      .toBeLessThan(80);
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
