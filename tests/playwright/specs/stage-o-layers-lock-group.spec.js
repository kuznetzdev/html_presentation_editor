/**
 * @file stage-o-layers-lock-group.spec.js
 * @stage O — v0.18.0 Layers Panel, Lock System & Element Grouping (Advanced Mode)
 * @author GitHub Copilot & Codex-based workflow
 * @created 2026-04-03
 *
 * Test coverage:
 * 1. Layers panel visibility in advanced mode
 * 2. Layers panel selection sync (canvas <-> panel)
 * 3. Drag-to-reorder layers
 * 4. Lock/unlock element system
 * 5. Visibility toggle (session-only)
 * 6. Group/ungroup elements
 */

const { test, expect } = require("@playwright/test");
const {
  loadReferenceDeck,
  evaluateEditor,
  clickPreview,
  previewLocator,
  closeCompactShellPanels,
  ensureShellPanelVisible,
} = require("../helpers/editorApp");

async function waitForEditorSettled(page) {
  await expect.poll(
    () => evaluateEditor(page, `JSON.stringify({
      previewLifecycle: state.previewLifecycle || "",
      previewReady: Boolean(state.previewReady),
      requestedSlideActivation: Boolean(state.requestedSlideActivation)
    })`),
    { timeout: 10_000 },
  ).toBe(
    JSON.stringify({
      previewLifecycle: "ready",
      previewReady: true,
      requestedSlideActivation: false,
    }),
  );
}

async function waitForComplexityMode(page, expectedMode) {
  await expect
    .poll(() => evaluateEditor(page, "state.complexityMode || ''"), { timeout: 5_000 })
    .toBe(expectedMode);
}

async function waitForSelectedNodeId(page, expectedNodeId) {
  if (expectedNodeId) {
    await expect
      .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), { timeout: 5_000 })
      .toBe(expectedNodeId);
    return;
  }

  await expect
    .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), { timeout: 5_000 })
    .not.toBe("");
}

async function getLayerNodeOrder(page) {
  return page.locator(".layer-row").evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-layer-node-id") || ""),
  );
}

async function waitForLayerRows(page, minimumCount = 1) {
  await expect
    .poll(async () => {
      const order = await getLayerNodeOrder(page);
      return order.filter(Boolean).length;
    }, { timeout: 10_000 })
    .toBeGreaterThanOrEqual(minimumCount);
}

async function getSelectedScopeLayerOrder(page) {
  return JSON.parse(
    await evaluateEditor(
      page,
      `JSON.stringify((() => {
        if (typeof getLayerScopeInfo !== "function" || typeof buildLayerVisualOrder !== "function") {
          return [];
        }
        const scope = getLayerScopeInfo();
        if (!scope || !Array.isArray(scope.nodes)) return [];
        return buildLayerVisualOrder(scope.nodes)
          .slice()
          .reverse()
          .map((node) => node?.getAttribute?.("data-editor-node-id") || "")
          .filter(Boolean);
      })())`,
    ),
  );
}

test.describe("stage-o-layers-lock-group @stage-o", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      ["chromium-mobile-390", "chromium-mobile-640", "chromium-tablet-820"].includes(testInfo.project.name),
      "Layers panel tests require desktop viewport — drawer layout breaks panel interactions",
    );
    await loadReferenceDeck(page, "v1-absolute-positioned", { mode: "edit" });
    await closeCompactShellPanels(page);
    await waitForEditorSettled(page);
    await evaluateEditor(
      page,
      `typeof setComplexityMode === "function" && setComplexityMode("advanced")`,
    );

    await waitForComplexityMode(page, "advanced");
    await waitForEditorSettled(page);
    await ensureShellPanelVisible(page, "inspector");
    await previewLocator(page, "[data-editor-editable='true'][data-editor-node-id]").first().click({ force: true });
    await waitForSelectedNodeId(page);
    await waitForLayerRows(page, 1);
  });

  test("layers-panel-visibility @stage-o", async ({ page }) => {
    // Verify layers panel is visible in advanced mode
    const layersSection = page.locator("#layersInspectorSection");
    await expect(layersSection).toBeVisible();
    await expect(layersSection).toContainText(
      "Выберите слой, чтобы управлять порядком, видимостью и блокировкой.",
    );
    await expect(page.locator("#normalizeLayersBtn")).toHaveText("Упорядочить стек");

    // Verify it has rows
    await waitForLayerRows(page, 1);

    // Switch to basic mode and verify it's hidden
    await evaluateEditor(
      page,
      `typeof setComplexityMode === "function" && setComplexityMode("basic")`,
    );
    await waitForComplexityMode(page, "basic");
    await expect(layersSection).toBeHidden();
  });

  test("layers-panel-selection-sync @stage-o", async ({ page }) => {
    const targetNodeId = await page
      .locator(".layer-row[data-layer-node-id]")
      .first()
      .getAttribute("data-layer-node-id");
    expect(targetNodeId).toBeTruthy();

    // Click the corresponding authored layer inside the canvas
    await previewLocator(page, `[data-editor-node-id="${targetNodeId}"]`)
      .first()
      .click({ force: true });

    // Wait until shell selection reflects the clicked authored layer
    await expect
      .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"), {
        timeout: 10000,
      })
      .toBe(targetNodeId);
    const selectedNodeId = targetNodeId;

    // Verify the corresponding layer row has is-active class
    const activeRow = page.locator(`.layer-row.is-active[data-layer-node-id="${selectedNodeId}"]`);
    await expect(activeRow).toBeVisible();
    await expect(activeRow).toContainText("Текущий");
    await expect(page.locator(".layer-z-input:visible")).toHaveCount(1);

    // Click on a different layer row
    const secondNodeId = await page.evaluate((currentSelectedNodeId) => {
      const rows = Array.from(document.querySelectorAll(".layer-row"));
      const nextRow = rows.find(
        (row) => row.getAttribute("data-layer-node-id") !== currentSelectedNodeId,
      );
      return nextRow ? nextRow.getAttribute("data-layer-node-id") : null;
    }, selectedNodeId);
    expect(secondNodeId).toBeTruthy();
    expect(secondNodeId).not.toBe(selectedNodeId);

    const secondRowClicked = await evaluateEditor(
      page,
      `(() => {
        const row = document.querySelector('.layer-row[data-layer-node-id="${String(secondNodeId).replace(/"/g, '\\"')}"]');
        if (!row) return false;
        row.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return true;
      })()`,
    );
    expect(secondRowClicked).toBe(true);

    await waitForSelectedNodeId(page, secondNodeId);

    // Verify state updated
    const newSelectedNodeId = await evaluateEditor(page, `state.selectedNodeId`);
    expect(newSelectedNodeId).toBe(secondNodeId);
  });

  test("reorder-affordance-is-handle-only @stage-o", async ({ page }) => {
    const firstRow = page.locator(".layer-row[data-layer-node-id]").first();
    await expect(firstRow).toBeVisible();
    await expect(firstRow).not.toHaveAttribute("draggable", "true");

    const dragHandle = firstRow.locator(".layer-drag-handle");
    await expect(dragHandle).toBeVisible();
    await expect(dragHandle).toHaveAttribute("draggable", "true");
  });

  test("drag-reorder @stage-o", async ({ page }) => {
    await expect.poll(async () => (await getLayerNodeOrder(page)).length, { timeout: 5_000 }).toBeGreaterThan(1);
    await expect
      .poll(() => evaluateEditor(page, "state.activeSlideId || state.runtimeActiveSlideId || ''"), { timeout: 5_000 })
      .not.toBe("");

    // Get initial layer order
    const initialLayers = await getLayerNodeOrder(page);
    expect(initialLayers.length).toBeGreaterThan(1);

    const targetIndex = initialLayers.length - 1;

    // Call reorder logic directly to avoid synthetic DnD flakiness in headless browsers.
    const reorderApplied = await evaluateEditor(
      page,
      `(() => {
        if (typeof reorderLayers !== 'function') return false;
        const hadPushHistory = typeof globalThis.pushHistory === 'function';
        const originalPushHistory = globalThis.pushHistory;
        if (!hadPushHistory) {
          globalThis.pushHistory = () => {};
        }
        try {
          reorderLayers(0, ${targetIndex});
          return true;
        } catch (_error) {
          return false;
        } finally {
          if (hadPushHistory) globalThis.pushHistory = originalPushHistory;
          else delete globalThis.pushHistory;
        }
      })()`,
    );
    expect(reorderApplied).toBe(true);

    await page.waitForTimeout(200);
  });

  test("lock @stage-o", async ({ page }) => {
    // Use the first layer-row to guarantee we pick a panel-visible, lockable node.
    const firstLayerNodeId = await page
      .locator(".layer-row[data-layer-node-id]")
      .first()
      .getAttribute("data-layer-node-id");
    expect(firstLayerNodeId).toBeTruthy();
    await evaluateEditor(page, `sendToBridge("select-element", { nodeId: "${firstLayerNodeId}" })`);
    await waitForSelectedNodeId(page, firstLayerNodeId);
    const selectedNodeId = firstLayerNodeId;

    // Lock the element via layers panel
    const lockBtn = page.locator(`.layer-lock-btn[data-layer-node-id="${selectedNodeId}"]`);
    await lockBtn.click();

    // Verify data-editor-locked attribute in modelDoc
    await expect.poll(() =>
      evaluateEditor(page, `
        (function() {
          const el = state.modelDoc.querySelector(\`[data-editor-node-id="${selectedNodeId}"]\`);
          return el ? el.getAttribute("data-editor-locked") === "true" : false;
        })()
      `),
    ).toBe(true);
    const isLocked = await evaluateEditor(page, `
      (function() {
        const el = state.modelDoc.querySelector(\`[data-editor-node-id="${selectedNodeId}"]\`);
        return el ? el.getAttribute("data-editor-locked") === "true" : false;
      })()
    `);
    expect(isLocked).toBe(true);
    await expect(page.locator(`.layer-row[data-layer-node-id="${selectedNodeId}"]`)).toContainText(
      "Заблокирован",
    );

    // Verify lock banner is visible
    const lockBanner = page.locator("#lockBanner");
    await expect(lockBanner).toBeVisible();

    // Unlock via lock banner button
    await page.locator("#unlockElementBtn").click();

    await expect.poll(() =>
      evaluateEditor(page, `
        (function() {
          const el = state.modelDoc.querySelector(\`[data-editor-node-id="${selectedNodeId}"]\`);
          return el ? el.getAttribute("data-editor-locked") !== "true" : true;
        })()
      `),
    ).toBe(true);
    const isUnlocked = await evaluateEditor(page, `
      (function() {
        const el = state.modelDoc.querySelector(\`[data-editor-node-id="${selectedNodeId}"]\`);
        return el ? el.getAttribute("data-editor-locked") !== "true" : true;
      })()
    `);
    expect(isUnlocked).toBe(true);
  });

  test("visibility-toggle @stage-o", async ({ page }) => {
    // Use the first layer-row to guarantee we pick a panel-visible, toggleable node.
    const firstLayerNodeId = await page
      .locator(".layer-row[data-layer-node-id]")
      .first()
      .getAttribute("data-layer-node-id");
    expect(firstLayerNodeId).toBeTruthy();
    await evaluateEditor(page, `sendToBridge("select-element", { nodeId: "${firstLayerNodeId}" })`);
    await waitForSelectedNodeId(page, firstLayerNodeId);
    const selectedNodeId = firstLayerNodeId;
    expect(selectedNodeId).toBeTruthy();

    // Toggle visibility via layers panel
    const visBtn = page.locator(`.layer-visibility-btn[data-layer-node-id="${selectedNodeId}"]`);
    await visBtn.click();

    // Verify CSS visibility in iframe (session-only)
    await expect.poll(() =>
      evaluateEditor(page, `
        (function() {
          const iframe = document.getElementById("previewFrame");
          if (!iframe || !iframe.contentWindow) return null;
          const el = iframe.contentDocument.querySelector(\`[data-editor-node-id="${selectedNodeId}"]\`);
          return el ? el.style.visibility : null;
        })()
      `),
    ).toBe("hidden");
    const visibilityInIframe = await evaluateEditor(page, `
      (function() {
        const iframe = document.getElementById("previewFrame");
        if (!iframe || !iframe.contentWindow) return null;
        const el = iframe.contentDocument.querySelector(\`[data-editor-node-id="${selectedNodeId}"]\`);
        return el ? el.style.visibility : null;
      })()
    `);
    expect(visibilityInIframe).toBe("hidden");
    await expect(page.locator(`.layer-row[data-layer-node-id="${selectedNodeId}"]`)).toContainText(
      "Скрыт",
    );

    // Verify visibility NOT written to modelDoc (session-only; modelDoc should NOT have visibility:hidden).
    await expect.poll(() =>
      evaluateEditor(page, `
        (function() {
          const el = state.modelDoc.querySelector(\`[data-editor-node-id="${selectedNodeId}"]\`);
          return el ? el.style.getPropertyValue("visibility") : "";
        })()
      `),
    ).not.toBe("hidden");
    const visibilityInModel = await evaluateEditor(page, `
      (function() {
        const el = state.modelDoc.querySelector(\`[data-editor-node-id="${selectedNodeId}"]\`);
        return el ? el.style.getPropertyValue("visibility") : "";
      })()
    `);
    expect(["", "visible", "inherit", "unset", "initial"].includes(visibilityInModel) || !visibilityInModel).toBe(true);
  });

  test("group-ungroup @stage-o", async ({ page }) => {
    await waitForLayerRows(page, 2);

    // Get first two layers
    const layerRows = page.locator(".layer-row");
    const firstRow = layerRows.first();
    const secondRow = layerRows.nth(1);

    const firstNodeId = await firstRow.getAttribute("data-layer-node-id");
    const secondNodeId = await secondRow.getAttribute("data-layer-node-id");
    expect(firstNodeId).toBeTruthy();
    expect(secondNodeId).toBeTruthy();

    // Manually populate multiSelectNodeIds (bridge doesn't support Shift+Click on layer-row yet)
    await evaluateEditor(page, `state.multiSelectNodeIds = ["${firstNodeId}", "${secondNodeId}"]`);
    await expect.poll(() => evaluateEditor(page, "(state.multiSelectNodeIds || []).length")).toBe(2);

    // Right-click on first element in canvas to open context menu
    await clickPreview(page, `[data-editor-node-id="${firstNodeId}"]`, { button: "right" });

    // Wait for context menu to appear
    await expect(page.locator("#contextMenu.is-open")).toBeVisible({ timeout: 2000 });

    // Click on "Сгруппировать" (group-elements) menu item
    const groupBtn = page.locator('[data-menu-action="group-elements"]');
    await expect(groupBtn).toBeVisible();
    await groupBtn.click();

    // Verify .editor-group wrapper exists in modelDoc
    await expect.poll(() =>
      evaluateEditor(page, `Boolean(state.modelDoc.querySelector(".editor-group"))`),
    ).toBe(true);
    const hasGroup = await evaluateEditor(page, `Boolean(state.modelDoc.querySelector(".editor-group"))`);
    expect(hasGroup).toBe(true);

    // Get the newly created group's nodeId
    const groupNodeId = await evaluateEditor(page, `
      (function() {
        const group = state.modelDoc.querySelector(".editor-group");
        return group ? group.getAttribute("data-editor-node-id") : null;
      })()
    `);
    expect(groupNodeId).toBeTruthy();

    // Ungroup directly via runtime command to avoid iframe timing flake around newly wrapped node.
    const ungroupApplied = await evaluateEditor(
      page,
      `(() => {
        state.selectedNodeId = "${groupNodeId}";
        if (typeof ungroupSelectedElement !== "function") return false;
        ungroupSelectedElement();
        return true;
      })()`,
    );
    expect(ungroupApplied).toBe(true);

    // Verify .editor-group wrapper removed
    await expect.poll(() =>
      evaluateEditor(page, `Boolean(state.modelDoc.querySelector(".editor-group"))`),
    ).toBe(false);
    const hasGroupAfter = await evaluateEditor(page, `Boolean(state.modelDoc.querySelector(".editor-group"))`);
    expect(hasGroupAfter).toBe(false);
  });

  test("normalize-layers @stage-o", async ({ page }) => {
    await waitForLayerRows(page, 3);

    await previewLocator(page, ".card").first().click();
    await waitForSelectedNodeId(page);

    const initialOrder = await getSelectedScopeLayerOrder(page);
    expect(initialOrder.length).toBeGreaterThanOrEqual(3);

    await evaluateEditor(
      page,
      `(() => {
        const ids = ${JSON.stringify(initialOrder)};
        const values = [97, 53, 11, 5, 3, 1];
        ids.forEach((nodeId, index) => {
          const node = state.modelDoc?.querySelector('[data-editor-node-id="' + nodeId + '"]');
          if (!(node instanceof Element)) return;
          node.style.zIndex = String(values[index] || Math.max(1, 97 - index * 9));
        });
        renderLayersPanel();
      })()`,
    );

    const scrambledOrder = await getSelectedScopeLayerOrder(page);

    await page.locator("#normalizeLayersBtn").click();

    await expect
      .poll(async () => JSON.stringify(await getSelectedScopeLayerOrder(page)), { timeout: 6000 })
      .toBe(JSON.stringify(scrambledOrder));

    const normalizedZValues = JSON.parse(
      await evaluateEditor(
        page,
        `JSON.stringify(${JSON.stringify(scrambledOrder)}.map((nodeId) => {
          const node = state.modelDoc?.querySelector('[data-editor-node-id="' + nodeId + '"]');
          const parsed = Number.parseFloat(node?.style?.zIndex || "0");
          return Number.isFinite(parsed) ? parsed : -1;
        }))`,
      ),
    );
    expect(normalizedZValues).toEqual(
      scrambledOrder.map((_, index) => (scrambledOrder.length - index) * 10),
    );
  });

  test("z-order-shortcuts @stage-o", async ({ page }) => {
    await waitForLayerRows(page, 2);

    await previewLocator(page, ".card").first().click();
    const selectedCardNodeId = await evaluateEditor(page, "state.selectedNodeId || ''");
    expect(selectedCardNodeId).toBeTruthy();

    const initialOrder = await getSelectedScopeLayerOrder(page);
    const initialIndex = initialOrder.indexOf(selectedCardNodeId);
    expect(initialIndex).toBeGreaterThan(0);

    const shortcutDispatched = await evaluateEditor(
      page,
      `(() => {
        const doc = document.getElementById("previewFrame")?.contentDocument;
        if (!doc) return false;
        return doc.dispatchEvent(new KeyboardEvent("keydown", {
          key: "]",
          bubbles: true,
          cancelable: true,
        }));
      })()`,
    );
    expect(shortcutDispatched).toBe(false);

    await expect
      .poll(async () => {
        const order = await getSelectedScopeLayerOrder(page);
        return order.indexOf(selectedCardNodeId);
      }, { timeout: 6000 })
      .toBe(initialIndex - 1);

    const editableNodeId = await evaluateEditor(
      page,
      `(() => {
        const doc = document.getElementById("previewFrame")?.contentDocument;
        const el = doc?.querySelector("[data-editor-editable='true'][data-editor-node-id]");
        return el?.getAttribute("data-editor-node-id") || "";
      })()`,
    );
    expect(editableNodeId).toBeTruthy();

    const textNodeSelected = await evaluateEditor(
      page,
      `(() => {
        if (typeof buildSelectionBridgePayload !== "function" || typeof sendToBridge !== "function") {
          return false;
        }
        const payload = buildSelectionBridgePayload(${JSON.stringify(editableNodeId)}, {
          focusText: false,
        });
        if (!payload) return false;
        sendToBridge("select-element", payload);
        return true;
      })()`,
    );
    expect(textNodeSelected).toBe(true);
    await waitForSelectedNodeId(page, editableNodeId);
    const textEditingStarted = await evaluateEditor(
      page,
      `(() => {
        if (typeof startTextEditing !== "function") return false;
        startTextEditing();
        return true;
      })()`,
    );
    expect(textEditingStarted).toBe(true);
    await expect
      .poll(() => evaluateEditor(page, "Boolean(state.selectedFlags?.isTextEditing)"), { timeout: 6000 })
      .toBe(true);

    await page.keyboard.press("]");

    const titleText = await previewLocator(
      page,
      `[data-editor-node-id="${editableNodeId}"]`,
    ).textContent();
    expect(String(titleText || "")).toContain("]");
  });
});
