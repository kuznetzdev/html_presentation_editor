/**
 * Overlap recovery e2e coverage (@stage-n).
 *
 * Covers:
 *  N1 overlap detection map appears for covered elements
 *  N2 overlap warning badge appears in the slide rail
 *  N3 hover does not create a ghost outline for hidden layers
 *  N4 move-to-top raises z-index and clears the recovery banner
 *  N5 basic and advanced magic-select flows
 *  N6 inserted elements auto-promote out of severe overlap
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

async function loadOverlapDeck(page) {
  await loadReferenceDeck(page, "v1-absolute-positioned", { mode: "edit" });
  await closeCompactShellPanels(page);

  const targetSlideId = await evaluateEditor(
    page,
    "state.slides[Math.min(1, state.slides.length - 1)]?.id || null",
  );
  if (!targetSlideId) throw new Error("Could not resolve target slide id");

  await evaluateEditor(
    page,
    `requestSlideActivation(${JSON.stringify(targetSlideId)}, { reason: "stage-n-overlap" })`,
  );
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

async function triggerAndWaitForOverlapDetection(page) {
  await evaluateEditor(page, 'runOverlapDetectionNow("test-trigger")');
  await expect
    .poll(
      () =>
        evaluateEditor(
          page,
          "Array.isArray(state.overlapConflictsBySlide[state.activeSlideId])",
        ),
      { timeout: 5000 },
    )
    .toBe(true);
}

async function selectFirstCoveredCard(page) {
  const nodeId = await evaluateEditor(
    page,
    `(() => {
      const slideId = state.activeSlideId;
      if (!slideId || !state.modelDoc) return null;
      const escapedSlideId = slideId.replace(/["\\\\]/g, "\\\\$&");
      const slideEl = state.modelDoc.querySelector('[data-editor-slide-id="' + escapedSlideId + '"]');
      if (!slideEl) return null;
      const nodes = Array.from(slideEl.querySelectorAll("[data-editor-node-id]"))
        .filter((el) => !el.hasAttribute("data-editor-slide-id"));
      return nodes[0]?.getAttribute("data-editor-node-id") || null;
    })()`,
  );
  if (!nodeId) {
    throw new Error("Could not resolve covered card nodeId from modelDoc");
  }

  await evaluateEditor(
    page,
    `sendToBridge("select-element", { nodeId: ${JSON.stringify(nodeId)} })`,
  );
  await expect
    .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), { timeout: 6000 })
    .toBe(nodeId);
  await triggerAndWaitForOverlapDetection(page);

  const preferredNodeId = await evaluateEditor(
    page,
    `(() => {
      const threshold = 30;
      const currentNodeId = state.selectedNodeId || "";
      const currentCovered = Number(state.selectedOverlapWarning?.coveredPercent || 0);
      if (currentNodeId && currentCovered > threshold) return currentNodeId;
      const conflicts = Array.isArray(state.overlapConflictsBySlide[state.activeSlideId])
        ? state.overlapConflictsBySlide[state.activeSlideId]
        : [];
      const preferredConflict = conflicts.find((conflict) =>
        Number(conflict?.coveredPercent || 0) > threshold && conflict?.bottomNodeId,
      );
      return preferredConflict?.bottomNodeId || currentNodeId || null;
    })()`,
  );
  if (preferredNodeId && preferredNodeId !== nodeId) {
    await evaluateEditor(
      page,
      `sendToBridge("select-element", { nodeId: ${JSON.stringify(preferredNodeId)} })`,
    );
    await expect
      .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), { timeout: 6000 })
      .toBe(preferredNodeId);
    await triggerAndWaitForOverlapDetection(page);
  }

  return preferredNodeId || nodeId;
}

async function readSelectedLayerPickerPayload(page) {
  const rawPayload = await evaluateEditor(
    page,
    `JSON.stringify(
      typeof buildSelectedOverlapLayerPickerPayload === "function"
        ? buildSelectedOverlapLayerPickerPayload()
        : null
    )`,
  );
  return rawPayload === "null" ? null : JSON.parse(rawPayload);
}

async function ensureOverlapMagicButtonVisible(page) {
  await ensureShellPanelVisible(page, "inspector");
  await expect
    .poll(
      () =>
        evaluateEditor(
          page,
          `Boolean(
            !document.getElementById("overlapRecoveryBanner")?.hidden &&
            !document.getElementById("overlapSelectLayerBtn")?.hidden
          )`,
        ),
      { timeout: 6000 },
    )
    .toBe(true);

  const button = page.locator("#overlapSelectLayerBtn");
  await button.evaluate((element) => {
    element.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: "instant",
    });
  });
  await expect(button).toBeVisible({ timeout: 6000 });
  return button;
}

test.describe("N1 overlap detection", () => {
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

    expect(snapshot.conflictCount).toBeGreaterThan(0);
    expect(snapshot.selectedCovered).toBeGreaterThan(30);
  });
});

test.describe("N5 magic select", () => {
  test("basic overlap banner cycles to the next layer without opening the picker @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    const initialNodeId = await selectFirstCoveredCard(page);
    await triggerAndWaitForOverlapDetection(page);

    const cycleButton = await ensureOverlapMagicButtonVisible(page);
    await expect(cycleButton).toContainText(/Следующий слой/i);

    const candidateIds = JSON.parse(
      await evaluateEditor(
        page,
        `JSON.stringify(collectLayerPickerItemsFromOverlap().map((item) => item.nodeId))`,
      ),
    );
    expect(candidateIds.length).toBeGreaterThanOrEqual(2);
    const initialIndex = candidateIds.indexOf(initialNodeId);
    expect(initialIndex).toBeGreaterThanOrEqual(0);
    const expectedNodeId = candidateIds[(initialIndex + 1) % candidateIds.length];

    await cycleButton.click();

    await expect
      .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), {
        timeout: 6000,
      })
      .toBe(expectedNodeId);
    await expect(page.locator("#layerPicker")).toBeHidden();
  });

  test("advanced overlap banner opens layer picker and keyboard selection works @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    await selectFirstCoveredCard(page);
    await triggerAndWaitForOverlapDetection(page);

    await evaluateEditor(
      page,
      `typeof setComplexityMode === "function" && setComplexityMode("advanced")`,
    );
    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `(document.getElementById("overlapSelectLayerBtn")?.textContent || "").trim()`,
          ),
        { timeout: 6000 },
      )
      .toMatch(/Выбрать слой/i);

    const magicSelectBtn = await ensureOverlapMagicButtonVisible(page);
    await expect
      .poll(() => readSelectedLayerPickerPayload(page), { timeout: 6000 })
      .not.toBeNull();

    const layerPickerPayload = await readSelectedLayerPickerPayload(page);
    expect(Array.isArray(layerPickerPayload?.items)).toBe(true);
    expect(layerPickerPayload.items.length).toBeGreaterThanOrEqual(2);
    await expect(magicSelectBtn).toBeEnabled();

    await magicSelectBtn.click();

    const picker = page.locator("#layerPicker");
    await expect(picker).toBeVisible({ timeout: 6000 });
    await expect
      .poll(
        async () => {
          const text = await page.locator("#layerPickerTitle").textContent();
          return String(text || "").trim().length;
        },
        { timeout: 6000 },
      )
      .toBeGreaterThan(0);
    await expect(page.locator("#layerPickerSubtitle")).toContainText(
      String(layerPickerPayload.items.length),
    );
    await expect
      .poll(
        () => page.locator("#layerPickerList button").count(),
        { timeout: 6000 },
      )
      .toBe(layerPickerPayload.items.length);
    await expect(page.locator("#layerPickerList button.is-current-layer")).toHaveCount(1);

    const nextButton = page.locator("#layerPickerList button").nth(1);
    const nextNodeId = await nextButton.getAttribute("data-layer-picker-node-id");
    expect(nextNodeId).toBeTruthy();
    await nextButton.hover();
    await expect
      .poll(() => evaluateEditor(page, "state.layerPickerHighlightNodeId || ''"), {
        timeout: 6000,
      })
      .toBe(nextNodeId);
    await nextButton.focus();
    await expect(nextButton).toHaveClass(/is-active/);
    await page.keyboard.press("Enter");

    await expect
      .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), {
        timeout: 6000,
      })
      .toBe(nextNodeId);

    const reopenedMagicSelectBtn = await ensureOverlapMagicButtonVisible(page);
    await reopenedMagicSelectBtn.click();
    await expect(picker).toBeVisible({ timeout: 6000 });
    await picker.press("Escape");
    await expect(picker).toBeHidden({ timeout: 6000 });

    const reopenedAfterEscapeBtn = await ensureOverlapMagicButtonVisible(page);
    await reopenedAfterEscapeBtn.click();
    await expect(picker).toBeVisible({ timeout: 6000 });
    await page.locator("#previewStage").click({ position: { x: 24, y: 24 } });
    await expect(picker).toBeHidden({ timeout: 6000 });
  });
});

test.describe("N6 insert auto-promotion", () => {
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

test.describe("N2 warning badge", () => {
  test("basic mode shows overlap warning badge in rail @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    await triggerAndWaitForOverlapDetection(page);

    await ensureShellPanelVisible(page, "slides");
    const warningTag = page.locator("#slidesList .slide-tag.is-overlap-warning").first();
    await expect(warningTag).toBeVisible({ timeout: 6000 });
    await expect(warningTag).toContainText(/перекрытие/i);
  });
});

test.describe("N3 no overlap ghost outline", () => {
  test("hovering overlap area does not highlight hidden element @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    await triggerAndWaitForOverlapDetection(page);

    const dispatched = await evaluateEditor(
      page,
      `(() => {
        const conflicts = state.overlapConflictsBySlide[state.activeSlideId] || [];
        const conflict = conflicts.find((entry) => entry.coveredPercent >= 30);
        if (!conflict) return false;
        const cx = Math.round((conflict.overlapRect.left + conflict.overlapRect.right) / 2);
        const cy = Math.round((conflict.overlapRect.top + conflict.overlapRect.bottom) / 2);
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

test.describe("N4 move to top", () => {
  test("move-to-top action raises z-index and clears recovery banner @stage-n", async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name));

    await loadOverlapDeck(page);
    await selectFirstCoveredCard(page);
    await triggerAndWaitForOverlapDetection(page);

    await ensureShellPanelVisible(page, "inspector");
    const banner = page.locator("#overlapRecoveryBanner");
    await expect(banner).toBeVisible({ timeout: 6000 });

    const moveBtn = page.locator("#overlapMoveTopBtn");
    await expect(moveBtn).toBeEnabled();

    const before = await evaluateEditor(
      page,
      `(() => {
        const z = state.selectedComputed?.zIndex || "";
        const parsed = Number.parseFloat(z);
        return Number.isFinite(parsed) ? parsed : 0;
      })()`,
    );

    await moveBtn.click();

    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `(() => {
              const z = state.selectedComputed?.zIndex || "";
              const parsed = Number.parseFloat(z);
              return Number.isFinite(parsed) ? parsed : 0;
            })()`,
          ),
        { timeout: 6000 },
      )
      .toBeGreaterThan(before);

    await expect(banner).toBeHidden({ timeout: 8000 });
  });
});
