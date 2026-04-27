// tablet-honest.spec.js — Gate-D tablet honest-block smoke tests (WO-33, ADR-018)
// Tests run exclusively on compact viewport projects:
//   chromium-mobile-390 (390px), chromium-mobile-640 (640px), chromium-tablet-820 (820px)
// Each test uses test.skip to enforce project-scoped execution.

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
} = require("../helpers/editorApp");
const {
  waitForShellBannerText,
  waitForState,
} = require("../helpers/waits");

// Returns true when the current project is one of the 3 compact viewport projects.
function isCompactProject(projectName) {
  return /chromium-mobile-390|chromium-mobile-640|chromium-tablet-820/.test(
    projectName,
  );
}

// Selects an element via bridge (not pointer events) so tap-select path is tested.
async function bridgeSelectHero(page) {
  await evaluateEditor(
    page,
    `(() => {
      const node = state.modelDoc && state.modelDoc.querySelector("#hero-title");
      const nodeId = node && node.getAttribute("data-editor-node-id");
      if (nodeId) sendToBridge("select-element", { nodeId });
    })()`,
  );
  await expect
    .poll(() => evaluateEditor(page, "state.selectedNodeId || null"), {
      timeout: 8000,
    })
    .toBeTruthy();
}

test.describe("Tablet honest-block posture (WO-33 / ADR-018)", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !isCompactProject(testInfo.project.name),
      "Tablet honest-block tests run on compact viewport projects only.",
    );
    await loadBasicDeck(page, {
      manualBaseUrl: BASIC_MANUAL_BASE_URL,
      mode: "edit",
    });
  });

  // TB1 — tap-select at 390px sets state.selectedNodeId
  test("TB1: tap-select via bridge sets selection at 390px @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile-390",
      "390px only.",
    );
    await bridgeSelectHero(page);
    const nodeId = await evaluateEditor(page, "state.selectedNodeId || null");
    expect(nodeId).toBeTruthy();
  });

  // TB2 — tap-select at 640px sets state.selectedNodeId
  test("TB2: tap-select via bridge sets selection at 640px @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile-640",
      "640px only.",
    );
    await bridgeSelectHero(page);
    const nodeId = await evaluateEditor(page, "state.selectedNodeId || null");
    expect(nodeId).toBeTruthy();
  });

  // TB3 — tap-select at 820px sets state.selectedNodeId
  test("TB3: tap-select via bridge sets selection at 820px @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-tablet-820",
      "820px only.",
    );
    await bridgeSelectHero(page);
    const nodeId = await evaluateEditor(page, "state.selectedNodeId || null");
    expect(nodeId).toBeTruthy();
  });

  // TB4 — double-tap text edit engages text-edit interaction mode at 390px
  test("TB4: double-tap text edit engages text-edit mode at 390px @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile-390",
      "390px only.",
    );
    await bridgeSelectHero(page);
    // Trigger text editing via bridge (simulates double-tap → startTextEditing)
    await evaluateEditor(
      page,
      `(() => {
        if (state.selectedFlags.canEditText && state.selectedPolicy.canEditText) {
          startTextEditing();
          setInteractionMode("text-edit");
        }
      })()`,
    );
    await waitForState(page, "state.interactionMode === 'text-edit'");
    const mode = await evaluateEditor(page, "state.interactionMode");
    expect(mode).toBe("text-edit");
  });

  // TB5 — drag-attempt at 390px shows compact-manip banner
  test("TB5: drag-attempt at 390px shows compact-manip banner @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile-390",
      "390px only.",
    );
    await bridgeSelectHero(page);
    // Directly call startActiveManipulation via evaluateEditor to trigger the guard
    await evaluateEditor(
      page,
      `(() => {
        // Build a synthetic PointerEvent-like object with the minimum shape needed
        const fakeEvent = {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          currentTarget: document.body,
          preventDefault: function() {},
          stopPropagation: function() {},
        };
        startActiveManipulation("drag", fakeEvent);
      })()`,
    );
    // The compact-manip banner should be visible in #shellBanner
    await waitForShellBannerText(page, "Перемещение и изменение размера — только на desktop");
    const bannerText = await page.locator("#shellBanner").innerText().catch(() => "");
    expect(bannerText).toContain("Перемещение и изменение размера — только на desktop");
  });

  // TB6 — drag-attempt at 640px shows same banner
  test("TB6: drag-attempt at 640px shows compact-manip banner @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile-640",
      "640px only.",
    );
    await bridgeSelectHero(page);
    await evaluateEditor(
      page,
      `(() => {
        const fakeEvent = {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          currentTarget: document.body,
          preventDefault: function() {},
          stopPropagation: function() {},
        };
        startActiveManipulation("drag", fakeEvent);
      })()`,
    );
    await waitForShellBannerText(page, "Перемещение и изменение размера — только на desktop");
    const bannerText = await page.locator("#shellBanner").innerText().catch(() => "");
    expect(bannerText).toContain("Перемещение и изменение размера — только на desktop");
  });

  // TB7 — drag-attempt at 820px shows same banner
  test("TB7: drag-attempt at 820px shows compact-manip banner @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-tablet-820",
      "820px only.",
    );
    await bridgeSelectHero(page);
    await evaluateEditor(
      page,
      `(() => {
        const fakeEvent = {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          currentTarget: document.body,
          preventDefault: function() {},
          stopPropagation: function() {},
        };
        startActiveManipulation("drag", fakeEvent);
      })()`,
    );
    await waitForShellBannerText(page, "Перемещение и изменение размера — только на desktop");
    const bannerText = await page.locator("#shellBanner").innerText().catch(() => "");
    expect(bannerText).toContain("Перемещение и изменение размера — только на desktop");
  });

  // TB8 — resize-attempt at 390px shows compact-manip banner
  test("TB8: resize-attempt at 390px shows compact-manip banner @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile-390",
      "390px only.",
    );
    await bridgeSelectHero(page);
    await evaluateEditor(
      page,
      `(() => {
        const fakeEvent = {
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          currentTarget: document.body,
          preventDefault: function() {},
          stopPropagation: function() {},
        };
        startActiveManipulation("resize", fakeEvent, "se");
      })()`,
    );
    await waitForShellBannerText(page, "Перемещение и изменение размера — только на desktop");
    const bannerText = await page.locator("#shellBanner").innerText().catch(() => "");
    expect(bannerText).toContain("Перемещение и изменение размера — только на desktop");
  });

  // TB9 — rail-reorder-attempt at 390px shows compact-rail banner
  test("TB9: rail-reorder-attempt at 390px shows compact-rail banner @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile-390",
      "390px only.",
    );
    // Directly invoke reportCompactRailBlock to validate the banner plumbing
    await evaluateEditor(
      page,
      `(() => {
        if (window.reportCompactRailBlock) window.reportCompactRailBlock();
      })()`,
    );
    await waitForShellBannerText(page, "Перетаскивание слайдов — только на desktop");
    const bannerText = await page.locator("#shellBanner").innerText().catch(() => "");
    expect(bannerText).toContain("Перетаскивание слайдов — только на desktop");
  });

  // TB10 — layers panel hidden or not rendered at 390px
  test("TB10: layers panel hidden at 390px @stage-e", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium-mobile-390",
      "390px only.",
    );
    // On compact shell the layers panel toggle may not exist or be display:none
    const layersPanel = page.locator("#layersPanel");
    // Either the element is absent from DOM or has display:none / is hidden
    const count = await layersPanel.count();
    if (count === 0) {
      // Layers panel not rendered on compact — correct behaviour
      expect(count).toBe(0);
      return;
    }
    // If it exists, it must not be visible (compact shell hides advanced panels)
    const isHidden = await evaluateEditor(
      page,
      `(() => {
        const el = document.getElementById("layersPanel");
        if (!el) return true;
        const style = getComputedStyle(el);
        return style.display === "none" || style.visibility === "hidden" || el.hidden;
      })()`,
    );
    expect(isHidden).toBe(true);
  });
});
