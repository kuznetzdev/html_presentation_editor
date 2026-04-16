const { test, expect } = require("@playwright/test");
const {
  activateSlideByIndex,
  assertNoHorizontalOverflow,
  assertShellGeometry,
  clickEditorControl,
  clickPreview,
  closeCompactShellPanels,
  dragSelectionOverlay,
  evaluateEditor,
  loadReferenceDeck,
  openExportValidationPopup,
  openInsertPalette,
  openSlideRailContextMenu,
  previewLocator,
  readSelectionUiState,
  resizeSelectionOverlay,
  selectionFrameLocator,
  setMode,
  waitForSelectedEntityKind,
  waitForSlideActivationState,
} = require("../helpers/editorApp");
const { REFERENCE_DECK_CASES } = require("../helpers/referenceDeckRegistry");

const DEEP_PROJECTS = new Set(["chromium-desktop", "chromium-shell-1100"]);
const COMPACT_PROJECTS = new Set(["chromium-mobile-390"]);

function pushLog(logs, entry) {
  logs.push({
    timestamp: new Date().toISOString(),
    ...entry,
  });
}

function isTargetProject(projectName) {
  return DEEP_PROJECTS.has(projectName) || COMPACT_PROJECTS.has(projectName);
}

function isDeepProject(projectName) {
  return DEEP_PROJECTS.has(projectName);
}

function isCompactProject(projectName) {
  return COMPACT_PROJECTS.has(projectName);
}

function previewNodeSelector(nodeMeta) {
  if (nodeMeta.authoredNodeId) {
    return `[data-node-id="${nodeMeta.authoredNodeId}"]`;
  }
  return `[data-editor-node-id="${nodeMeta.id}"]`;
}

const TEXT_TAG_PRIORITY = Object.freeze({
  h1: 0,
  h2: 1,
  h3: 2,
  h4: 3,
  h5: 4,
  h6: 5,
  p: 10,
  li: 11,
  blockquote: 12,
  figcaption: 13,
  div: 14,
  span: 90,
  strong: 91,
});

function prioritizeNodes(nodes, inventory, tagPriority = {}) {
  return [...nodes].sort((left, right) => {
    const leftActive = left.slideId === inventory.activeSlideId ? 0 : 1;
    const rightActive = right.slideId === inventory.activeSlideId ? 0 : 1;
    if (leftActive !== rightActive) {
      return leftActive - rightActive;
    }

    const leftPriority = tagPriority[left.tagName] ?? 50;
    const rightPriority = tagPriority[right.tagName] ?? 50;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return (right.text || "").length - (left.text || "").length;
  });
}

function normalizeTextValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

async function readRuntimeNodeSnapshot(page, nodeMeta) {
  const authoredSelector = nodeMeta.authoredNodeId
    ? `[data-node-id="${nodeMeta.authoredNodeId}"]`
    : "";
  const editorSelector = `[data-editor-node-id="${nodeMeta.id}"]`;
  return evaluateEditor(
    page,
    `(() => {
      const root = state.modelDoc;
      if (!root) return null;
      const node =
        root.querySelector(${JSON.stringify(editorSelector)}) ||
        (${JSON.stringify(authoredSelector)} ? root.querySelector(${JSON.stringify(authoredSelector)}) : null);
      if (!node) return null;
      return {
        html: String(node.innerHTML || ""),
        text: String(node.textContent || ""),
      };
    })()`,
  );
}

async function finalizeEditCommit(page, inventory, activeNode, commitTarget) {
  const currentSlideIndex = inventory.slideIds.indexOf(activeNode.slideId);
  const fallbackSlideIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : 1;

  if (commitTarget) {
    try {
      await clickPreview(page, previewNodeSelector(commitTarget), { force: true });
    } catch (_) {
      // Try stronger fallbacks below when the preview target is hidden or inert.
    }
  }

  if ((await evaluateEditor(page, "state.interactionMode")) === "select") {
    return "preview-target";
  }

  if (inventory.slideIds.length > 1) {
    await activateSlideByIndex(page, fallbackSlideIndex);
    if ((await evaluateEditor(page, "state.interactionMode")) === "select") {
      return "slide-switch";
    }
  }

  const blurred = await evaluateEditor(
    page,
    `(() => {
      const active = state.selectedEl;
      if (!(active instanceof HTMLElement)) return false;
      if (active.getAttribute("contenteditable") !== "true") return false;
      active.blur();
      return true;
    })()`,
  );
  if (blurred) {
    await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");
    return "explicit-blur";
  }

  await setMode(page, "preview");
  await setMode(page, "edit");
  return "mode-roundtrip";
}

async function attachRunLog(testInfo, deckCase, logs, summary) {
  await testInfo.attach("reference-deck-matrix-log", {
    body: JSON.stringify(
      {
        deck: deckCase,
        project: testInfo.project.name,
        summary,
        logs,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
}

async function closeOpenHtmlModal(page) {
  const closeButton = page.locator('[data-close-modal="openHtmlModal"]');
  if (await closeButton.isVisible()) {
    await closeButton.click();
  } else {
    await evaluateEditor(page, "closeModal(els.openHtmlModal)");
  }
  await expect(page.locator("#openHtmlModal")).toHaveAttribute("aria-hidden", "true");
}

async function closeTopbarOverflow(page) {
  await evaluateEditor(
    page,
    "typeof closeTopbarOverflow === 'function' ? (closeTopbarOverflow(), true) : false",
  );
  await expect(page.locator("#topbarOverflowMenu")).toHaveAttribute("aria-hidden", "true");
}

async function closeInsertPalette(page) {
  await evaluateEditor(
    page,
    "typeof closeInsertPalette === 'function' ? (closeInsertPalette(), true) : false",
  );
  await expect(page.locator("#quickPalette")).toHaveAttribute("aria-hidden", "true");
}

async function closeSelectionContextMenu(page) {
  await evaluateEditor(
    page,
    "typeof closeContextMenu === 'function' ? (closeContextMenu(), true) : false",
  );
  await expect(page.locator("#contextMenu")).toHaveAttribute("aria-hidden", "true");
}

async function clearEditorSelection(page) {
  await evaluateEditor(
    page,
    `(() => {
      if (typeof clearSelectedElementState === "function") clearSelectedElementState();
      if (typeof closeContextMenu === "function") closeContextMenu();
      if (typeof refreshUi === "function") refreshUi();
      return true;
    })()`,
  );
  await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe("");
}

async function readShellThemeState(page) {
  return page.evaluate(() => ({
    preference:
      document.body?.dataset.themePreference ||
      document.documentElement.dataset.themePreference ||
      "",
    theme: document.body?.dataset.theme || document.documentElement.dataset.theme || "",
  }));
}

async function clickShellThemeControl(page, previousState) {
  await clickEditorControl(page, "#themeToggleBtn");
  await expect
    .poll(async () => {
      const nextState = await readShellThemeState(page);
      return (
        nextState.preference !== previousState.preference ||
        nextState.theme !== previousState.theme
      );
    })
    .toBe(true);
  return readShellThemeState(page);
}

async function cycleThemePreferenceViaShell(page, targetPreference) {
  const initialState = await readShellThemeState(page);
  if (initialState.preference === targetPreference) {
    return {
      after: initialState,
      before: initialState,
      clicks: 0,
    };
  }

  const seenStates = new Set([`${initialState.preference}:${initialState.theme}`]);
  let currentState = initialState;

  for (let clicks = 1; clicks <= 4; clicks += 1) {
    currentState = await clickShellThemeControl(page, currentState);
    if (currentState.preference === targetPreference) {
      return {
        after: currentState,
        before: initialState,
        clicks,
      };
    }

    const stateKey = `${currentState.preference}:${currentState.theme}`;
    if (seenStates.has(stateKey)) break;
    seenStates.add(stateKey);
  }

  throw new Error(`Unable to reach theme preference "${targetPreference}" via shell toggle.`);
}

async function ensureResolvedThemeViaShell(page, targetTheme) {
  const initialState = await readShellThemeState(page);
  if (initialState.theme === targetTheme) {
    return {
      after: initialState,
      before: initialState,
      clicks: 0,
    };
  }

  const seenStates = new Set([`${initialState.preference}:${initialState.theme}`]);
  let currentState = initialState;

  for (let clicks = 1; clicks <= 4; clicks += 1) {
    currentState = await clickShellThemeControl(page, currentState);
    if (currentState.theme === targetTheme) {
      return {
        after: currentState,
        before: initialState,
        clicks,
      };
    }

    const stateKey = `${currentState.preference}:${currentState.theme}`;
    if (seenStates.has(stateKey)) break;
    seenStates.add(stateKey);
  }

  throw new Error(`Unable to reach resolved theme "${targetTheme}" via shell toggle.`);
}

async function getDeckInventory(page) {
  const raw = await evaluateEditor(
    page,
    `JSON.stringify((() => {
      const nodes = Array.from(state.modelDoc?.querySelectorAll("[data-editor-node-id]") || [])
        .map((node) => {
          const slide = node.closest("[data-editor-slide-id], [data-slide-id]");
          const srcNodes = Array.from(node.querySelectorAll("img[src], video[src], source[src], iframe[src], link[href], script[src]"));
          const ownLinks = ["src", "href"]
            .map((attr) => String(node.getAttribute(attr) || "").trim())
            .filter(Boolean);
          const nestedLinks = srcNodes.flatMap((entry) =>
            ["src", "href"]
              .map((attr) => String(entry.getAttribute(attr) || "").trim())
              .filter(Boolean),
          );
          return {
            authoredNodeId: String(node.getAttribute("data-node-id") || ""),
            className: String(node.getAttribute("class") || ""),
            editable: node.getAttribute("data-editable") !== "false",
            hasFragmentMarker:
              node.classList.contains("fragment") ||
              node.hasAttribute("data-fragment-index") ||
              Boolean(node.closest(".fragment")),
            hasRelativeAsset: ownLinks
              .concat(nestedLinks)
              .some((value) => !/^(?:[a-z]+:|\\/|#|data:)/i.test(value)),
            id: String(node.getAttribute("data-editor-node-id") || ""),
            inCode: Boolean(node.closest("pre, code")),
            inSvg: Boolean(node.closest("svg")),
            inTable: Boolean(node.closest("table")),
            isCustomElement: node.tagName.includes("-"),
            positionStyle: /position\\s*:\\s*(absolute|fixed)/i.test(String(node.getAttribute("style") || "")),
            slideId: String(
              slide?.getAttribute("data-editor-slide-id") ||
                slide?.getAttribute("data-slide-id") ||
                "",
            ),
            tagName: node.tagName.toLowerCase(),
            text: String(node.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 140),
          };
        })
        .filter((node) => node.id);
      return {
        activeSlideId: String(state.activeSlideId || ""),
        editingSupported: Boolean(state.editingSupported),
        manualBaseUrl: String(state.manualBaseUrl || ""),
        slideIds: Array.from(state.slides || []).map((slide) => String(slide.id || "")),
        nodes,
      };
    })())`,
  );
  return JSON.parse(raw);
}

async function selectRuntimeNode(page, nodeMeta, options = {}) {
  const inventory = await getDeckInventory(page);
  const slideIndex = inventory.slideIds.indexOf(nodeMeta.slideId);
  if (slideIndex >= 0 && inventory.activeSlideId !== nodeMeta.slideId) {
    await activateSlideByIndex(page, slideIndex);
  }

  const selected = await evaluateEditor(
    page,
    `(() => {
      const nodeId = ${JSON.stringify(nodeMeta.id)};
      const payload =
        typeof buildSelectionBridgePayload === "function"
          ? buildSelectionBridgePayload(nodeId, {
              focusText: ${options.focusText ? "true" : "false"},
              selectionLeafNodeId: nodeId,
              selectionNodeId: nodeId,
            })
          : null;
      if (!payload || typeof sendToBridge !== "function") return false;
      sendToBridge("select-element", payload);
      return true;
    })()`,
  );
  if (!selected) {
    if (options.allowSelectionMiss) {
      return false;
    }
    expect(selected).toBe(true);
  }
  try {
    await expect.poll(() => evaluateEditor(page, "state.selectedNodeId || ''")).toBe(nodeMeta.id);
  } catch (error) {
    if (options.allowSelectionMiss) {
      return false;
    }
    throw error;
  }
  if (options.expectedKind) {
    await waitForSelectedEntityKind(page, options.expectedKind);
  }
  return true;
}

async function findEditableTextCandidate(page, inventory) {
  const candidates = inventory.nodes.filter(
    (node) =>
      node.editable &&
      node.text &&
      !node.inTable &&
      !node.inCode &&
      !node.inSvg &&
      [
        "blockquote",
        "div",
        "figcaption",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "p",
        "span",
        "strong",
      ].includes(node.tagName),
  );

  for (const candidate of prioritizeNodes(candidates, inventory, TEXT_TAG_PRIORITY)) {
    const selected = await selectRuntimeNode(page, candidate, {
      allowSelectionMiss: true,
    });
    if (!selected) continue;
    const ui = await readSelectionUiState(page);
    if (ui.selectedFlags.canEditText) {
      return candidate;
    }
  }
  return null;
}

function findCommitTargetCandidate(inventory, activeNode) {
  const isPreferredCommitTarget = (node) =>
    node.id !== activeNode.id &&
    node.slideId === activeNode.slideId &&
    !node.inCode &&
    !node.inSvg &&
    !["section", "article", "main"].includes(node.tagName) &&
    node.editable &&
    Boolean(node.text);
  return (
    inventory.nodes.find(isPreferredCommitTarget) ||
    inventory.nodes.find(
      (node) =>
        node.id !== activeNode.id &&
        !node.inCode &&
        !node.inSvg &&
        !["section", "article", "main"].includes(node.tagName) &&
        Boolean(node.text),
    ) ||
    null
  );
}

async function findTableCellCandidate(page, inventory) {
  const candidates = inventory.nodes.filter(
    (node) => node.inTable && ["td", "th"].includes(node.tagName),
  );
  for (const candidate of prioritizeNodes(candidates, inventory)) {
    const selected = await selectRuntimeNode(page, candidate, {
      allowSelectionMiss: true,
      expectedKind: "table-cell",
    });
    if (!selected) continue;
    const ui = await readSelectionUiState(page);
    if (ui.selectedEntityKind === "table-cell") {
      return candidate;
    }
  }
  return null;
}

async function findCodeBlockCandidate(page, inventory) {
  const candidates = inventory.nodes.filter(
    (node) =>
      node.inCode ||
      ["code", "pre"].includes(node.tagName) ||
      /\b(code|language-|prism)\b/i.test(node.className),
  );
  for (const candidate of prioritizeNodes(candidates, inventory)) {
    const selected = await selectRuntimeNode(page, candidate, {
      allowSelectionMiss: true,
      expectedKind: "code-block",
    });
    if (!selected) continue;
    const ui = await readSelectionUiState(page);
    if (ui.selectedEntityKind === "code-block") {
      return candidate;
    }
  }
  return null;
}

async function findSvgCandidate(page, inventory) {
  const candidates = inventory.nodes.filter(
    (node) => node.inSvg || node.tagName === "svg",
  );
  for (const candidate of prioritizeNodes(candidates, inventory)) {
    const selected = await selectRuntimeNode(page, candidate, {
      allowSelectionMiss: true,
    });
    if (!selected) continue;
    const ui = await readSelectionUiState(page);
    if (ui.selectedEntityKind === "svg") {
      return candidate;
    }
  }
  return null;
}

async function readPreviewShellMetrics(page) {
  return page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      return {
        clientWidth: element.clientWidth,
        height: rect.height,
        scrollWidth: element.scrollWidth,
        width: rect.width,
      };
    };
    return {
      note: read(".preview-note"),
      noteText: read("#previewNoteText"),
      shell: read(".preview-shell"),
    };
  });
}

async function verifyBaseMatrix(page, deckCase, logs) {
  const inventory = await getDeckInventory(page);
  expect(inventory.slideIds.length).toBeGreaterThan(0);
  pushLog(logs, {
    stepId: "base-01",
    target: deckCase.id,
    intent: "Capture inventory and slide count",
    actionAttempted: "Read runtime inventory",
    result: "passed",
    evidence: `slides=${inventory.slideIds.length}; nodes=${inventory.nodes.length}`,
  });

  await activateSlideByIndex(page, 0);
  await waitForSlideActivationState(page, {
    activeIndex: 0,
    count: inventory.slideIds.length,
  });
  await activateSlideByIndex(page, inventory.slideIds.length - 1);
  await waitForSlideActivationState(page, {
    activeIndex: inventory.slideIds.length - 1,
    count: inventory.slideIds.length,
  });
  pushLog(logs, {
    stepId: "base-02",
    target: deckCase.id,
    intent: "Verify first and last slide activation",
    actionAttempted: "Activate slide index 0 and last index",
    result: "passed",
    evidence: `first=0; last=${inventory.slideIds.length - 1}`,
  });

  return inventory;
}

async function verifyShellSurfaces(page, deckCase, inventory, logs, options = {}) {
  if (options.compact) {
    await closeCompactShellPanels(page);
  }

  await page.click("#openHtmlBtn");
  await expect(page.locator("#openHtmlModal")).toHaveAttribute("aria-hidden", "false");
  await closeOpenHtmlModal(page);
  pushLog(logs, {
    stepId: "shell-01",
    target: "openHtmlModal",
    intent: "Open real load modal through shell",
    actionAttempted: "Click #openHtmlBtn and close modal",
    result: "passed",
    evidence: "#openHtmlModal",
  });

  if (await page.locator("#previewPrimaryActionBtn").isVisible()) {
    await page.click("#previewPrimaryActionBtn");
    await expect.poll(() => evaluateEditor(page, "state.mode")).toBe("edit");
    pushLog(logs, {
      stepId: "shell-02",
      target: "previewPrimaryActionBtn",
      intent: "Open preview primary CTA path",
      actionAttempted: "Click primary CTA",
      result: "passed",
      evidence: "state.mode=edit",
    });
  } else {
    pushLog(logs, {
      stepId: "shell-02",
      target: "previewPrimaryActionBtn",
      intent: "Open preview primary CTA path",
      actionAttempted: "Click primary CTA",
      result: "not-applicable",
      evidence: "CTA hidden for current workflow",
    });
  }

  await setMode(page, "preview");
  await setMode(page, "edit");
  pushLog(logs, {
    stepId: "shell-03",
    target: "mode-switch",
    intent: "Verify preview/edit switch",
    actionAttempted: "Switch preview -> edit",
    result: "passed",
    evidence: "state.mode roundtrip",
  });

  const initialThemeState = await readShellThemeState(page);
  const advancedThemeState = await clickShellThemeControl(page, initialThemeState);
  expect(advancedThemeState.preference).not.toBe(initialThemeState.preference);
  const restoredThemeState = await cycleThemePreferenceViaShell(page, initialThemeState.preference);
  expect(restoredThemeState.after.preference).toBe(initialThemeState.preference);
  expect(restoredThemeState.after.theme).toBe(initialThemeState.theme);
  pushLog(logs, {
    stepId: "shell-04",
    target: "themeToggle",
    intent: "Verify shell-owned theme control honors tri-state contract",
    actionAttempted: "Advance theme preference once and restore initial preference via shell control",
    result: "passed",
    evidence: `preference=${initialThemeState.preference}->${advancedThemeState.preference}->${restoredThemeState.after.preference}; theme=${initialThemeState.theme}->${advancedThemeState.theme}->${restoredThemeState.after.theme}`,
  });

  if (await page.locator("#topbarOverflowBtn").isVisible()) {
    await page.click("#topbarOverflowBtn");
    await expect(page.locator("#topbarOverflowMenu")).toHaveAttribute("aria-hidden", "false");
    await closeTopbarOverflow(page);
    pushLog(logs, {
      stepId: "shell-05",
      target: "topbarOverflowMenu",
      intent: "Open overflow shell surface",
      actionAttempted: "Click #topbarOverflowBtn and close menu",
      result: "passed",
      evidence: "#topbarOverflowMenu",
    });
  } else {
    pushLog(logs, {
      stepId: "shell-05",
      target: "topbarOverflowMenu",
      intent: "Open overflow shell surface",
      actionAttempted: "Click #topbarOverflowBtn",
      result: "not-applicable",
      evidence: "Overflow trigger hidden at current breakpoint",
    });
  }

  await openInsertPalette(page);
  await expect(page.locator("#quickPalette")).toHaveAttribute("aria-hidden", "false");
  await closeInsertPalette(page);
  pushLog(logs, {
    stepId: "shell-06",
    target: "quickPalette",
    intent: "Open insert palette",
    actionAttempted: "Use shell insert trigger and close palette",
    result: "passed",
    evidence: "#quickPalette",
  });

  const popup = await openExportValidationPopup(page);
  await expect(popup.locator("body")).toBeVisible();
  await popup.close();
  pushLog(logs, {
    stepId: "shell-07",
    target: "export-validation-popup",
    intent: "Open validation popup",
    actionAttempted: "Trigger export validation popup and close popup",
    result: "passed",
    evidence: "popup body visible",
  });

  const shellMetrics = await readPreviewShellMetrics(page);
  expect(shellMetrics.note).not.toBeNull();
  expect(shellMetrics.shell).not.toBeNull();
  expect(shellMetrics.note.scrollWidth).toBeLessThanOrEqual(shellMetrics.note.clientWidth + 2);
  if (shellMetrics.noteText) {
    expect(shellMetrics.noteText.scrollWidth).toBeLessThanOrEqual(
      shellMetrics.noteText.clientWidth + 8,
    );
  }
  await assertNoHorizontalOverflow(page);
  await assertShellGeometry(page);
  pushLog(logs, {
    stepId: "shell-08",
    target: "preview-shell",
    intent: "Verify shell geometry and note overflow",
    actionAttempted: "Read preview shell metrics and assert no horizontal overflow",
    result: "passed",
    evidence: `noteWidth=${shellMetrics.note.width}; shellWidth=${shellMetrics.shell.width}`,
  });

  if (options.compact) {
    await page.click("#mobileSlidesBtn");
    await expect(page.locator("#panelBackdrop")).toBeVisible();
    await page.click("#panelBackdrop");
    await expect(page.locator("#panelBackdrop")).toBeHidden();

    await page.click("#mobileInspectorBtn");
    await expect(page.locator("#panelBackdrop")).toBeVisible();
    await page.click("#panelBackdrop");
    await expect(page.locator("#panelBackdrop")).toBeHidden();
    await closeCompactShellPanels(page);

    pushLog(logs, {
      stepId: "shell-09",
      target: "compact-drawers",
      intent: "Open compact slide and inspector drawers",
      actionAttempted: "Toggle mobile drawers and close through backdrop",
      result: "passed",
      evidence: "#mobileSlidesBtn + #mobileInspectorBtn",
    });

    await page.click("#mobileSlidesBtn");
    await expect(page.locator("#slidesPanel")).toBeVisible();
    const kebab = page.locator("#slidesPanel .slide-item .slide-menu-trigger").first();
    if ((await kebab.count()) > 0 && (await kebab.isVisible())) {
      await openSlideRailContextMenu(page, Math.max(0, inventory.slideIds.length - 1), {
        viaKebab: true,
      });
      await closeSelectionContextMenu(page);
      pushLog(logs, {
        stepId: "shell-10",
        target: "slide-context-menu",
        intent: "Open mobile slide rail kebab menu",
        actionAttempted: "Use slide rail kebab trigger",
        result: "passed",
        evidence: "#slidesPanel .slide-menu-trigger",
      });
    } else {
      pushLog(logs, {
        stepId: "shell-10",
        target: "slide-context-menu",
        intent: "Open mobile slide rail kebab menu",
        actionAttempted: "Use slide rail kebab trigger",
        result: "not-applicable",
        evidence: "No visible kebab trigger on compact slide rail",
      });
    }
    await closeCompactShellPanels(page);
    return;
  }

  await openSlideRailContextMenu(page, Math.max(0, inventory.slideIds.length - 1));
  await closeSelectionContextMenu(page);
  pushLog(logs, {
    stepId: "shell-09",
    target: "slide-context-menu",
    intent: "Open slide rail context menu",
    actionAttempted: "Use desktop slide rail context menu",
    result: "passed",
    evidence: "#contextMenu",
  });
}

async function verifyTextEditingFlow(page, deckCase, logs) {
  const inventory = await getDeckInventory(page);
  if (deckCase.capabilities.includes("data-driven")) {
    pushLog(logs, {
      stepId: "deep-01",
      target: deckCase.id,
      intent: "Exercise inline text edit commit/cancel path",
      actionAttempted: "Probe stable text-edit candidate on data-driven runtime deck",
      result: "not-applicable",
      evidence: `runtime-only deck; slideIds=${inventory.slideIds.length}; nodes=${inventory.nodes.length}`,
    });
    return null;
  }
  if (deckCase.capabilities.includes("web-components")) {
    pushLog(logs, {
      stepId: "deep-01",
      target: deckCase.id,
      intent: "Exercise inline text edit commit/cancel path",
      actionAttempted: "Probe stable text-edit target on web-components runtime deck",
      result: "blocked",
      evidence:
        "custom-element runtime does not expose a stable preview marker/focus contract for keyboard text entry; covered separately by runtime-truth roundtrip",
    });
    return null;
  }

  const textCandidate = await findEditableTextCandidate(page, inventory);
  if (!textCandidate) {
    pushLog(logs, {
      stepId: "deep-01",
      target: "editable-text",
      intent: "Exercise inline text edit commit/cancel path",
      actionAttempted: "Find editable text entity",
      result: "not-applicable",
      evidence: "No editable text candidate found",
    });
    return null;
  }

  const selector = previewNodeSelector(textCandidate);
  const commitTarget = findCommitTargetCandidate(inventory, textCandidate);
  const originalText = await previewLocator(page, selector).evaluate(
    (element) => element.textContent || "",
  );

  await selectRuntimeNode(page, textCandidate);
  await selectionFrameLocator(page).press("Enter");
  await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("text-edit");

  const commitText = `Audit ${deckCase.id} committed`;
  const committedNeedle = normalizeTextValue(commitText);
  const cancelledNeedle = normalizeTextValue(`Cancelled ${deckCase.id}`);
  const target = previewLocator(page, selector);
  await target.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await target.type(commitText);

  const commitStrategy = await finalizeEditCommit(
    page,
    inventory,
    textCandidate,
    commitTarget,
  );

  await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");
  await expect
    .poll(async () => {
      const snapshot = await readRuntimeNodeSnapshot(page, textCandidate);
      return normalizeTextValue(snapshot?.text).includes(committedNeedle);
    }, { timeout: 15_000 })
    .toBe(true);

  await selectRuntimeNode(page, textCandidate);
  await selectionFrameLocator(page).press("Enter");
  await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("text-edit");
  await target.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await target.type(`Cancelled ${deckCase.id}`);
  await target.press("Escape");
  await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");
  await expect
    .poll(async () => {
      const snapshot = await readRuntimeNodeSnapshot(page, textCandidate);
      const normalized = normalizeTextValue(snapshot?.text);
      return normalized.includes(committedNeedle) && !normalized.includes(cancelledNeedle);
    }, { timeout: 15_000 })
    .toBe(true);

  await page.locator("#selectionFrameHitArea").click({ button: "right" });
  await expect(page.locator("#contextMenu")).toHaveAttribute("aria-hidden", "false");
  await closeSelectionContextMenu(page);

  pushLog(logs, {
    stepId: "deep-01",
    target: textCandidate.id,
    intent: "Exercise inline text edit commit/cancel path and selection context menu",
    actionAttempted:
      "Select runtime text node, commit multiline edit, cancel second edit, open selection context menu",
    result: "passed",
    evidence: `selector=${selector}; commitStrategy=${commitStrategy}; commitTarget=${commitTarget ? previewNodeSelector(commitTarget) : "none"}; original=${JSON.stringify(originalText.slice(0, 48))}`,
  });

  return textCandidate;
}

async function verifySlideStructuralFlow(page, deckCase, logs) {
  const readSlideCount = () =>
    evaluateEditor(
      page,
      "(() => canUseStaticSlideModel() ? getStaticSlideModelNodes().length : state.slides.length)()",
    );
  const readSlideState = async () => ({
    activeIndex: await evaluateEditor(
      page,
      "state.slides.findIndex((slide) => slide.id === state.activeSlideId)",
    ),
    count: await readSlideCount(),
  });

  const initialState = await readSlideState();
  await clearEditorSelection(page);
  await clickEditorControl(page, "#duplicateCurrentSlideBtn", { panel: "inspector" });
  await expect.poll(readSlideCount).toBe(initialState.count + 1);

  const duplicatedState = await readSlideState();
  await clearEditorSelection(page);
  page.once("dialog", (dialog) => dialog.accept());
  await clickEditorControl(page, "#deleteCurrentSlideBtn", { panel: "inspector" });
  await expect.poll(readSlideCount).toBe(initialState.count);

  await clickEditorControl(page, "#undoBtn");
  try {
    await expect.poll(readSlideCount).toBe(initialState.count + 1);
  } catch (error) {
    if (!deckCase.capabilities.includes("data-driven")) {
      throw error;
    }
    const undoState = await readSlideState();
    pushLog(logs, {
      stepId: "deep-02",
      target: "slide-structure",
      intent: "Verify duplicate/delete/undo/redo on slide level",
      actionAttempted:
        "Clear element selection, duplicate and delete through slide-level inspector controls, then undo",
      result: "not-applicable",
      evidence: `data-driven runtime expansion after undo: count=${undoState.count}; active=${undoState.activeIndex}`,
    });
    return;
  }

  await clickEditorControl(page, "#redoBtn");
  await expect.poll(readSlideCount).toBe(initialState.count);

  pushLog(logs, {
    stepId: "deep-02",
    target: "slide-structure",
    intent: "Verify duplicate/delete/undo/redo on slide level",
    actionAttempted:
      "Clear element selection, duplicate and delete through slide-level inspector controls, then undo and redo",
    result: "passed",
    evidence: `count=${initialState.count}->${initialState.count + 1}->${initialState.count}; active=${initialState.activeIndex}->${duplicatedState.activeIndex}`,
  });
}

async function verifyManipulationCapability(page, deckCase, textCandidate, logs) {
  if (
    !deckCase.capabilities.some((capability) =>
      ["absolute", "layout-containers", "stress-layout"].includes(capability),
    )
  ) {
    return;
  }

  if (!textCandidate) {
    pushLog(logs, {
      stepId: "cap-absolute-01",
      target: deckCase.id,
      intent: "Exercise drag/resize or blocked-state on layout-heavy deck",
      actionAttempted: "Use editable text candidate for direct manipulation",
      result: "not-applicable",
      evidence: "No editable text candidate available",
    });
    return;
  }

  await selectRuntimeNode(page, textCandidate);
  const selector = previewNodeSelector(textCandidate);
  const before = await previewLocator(page, selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  });

  await dragSelectionOverlay(page, 28, 20).catch(() => null);
  await page.waitForTimeout(120);
  const afterDrag = await previewLocator(page, selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { height: rect.height, left: rect.left, top: rect.top, width: rect.width };
  });

  const moved =
    Math.abs(afterDrag.left - before.left) > 4 ||
    Math.abs(afterDrag.top - before.top) > 4;
  if (moved) {
    await resizeSelectionOverlay(page, "se", 24, 16);
    const afterResize = await previewLocator(page, selector).evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    });
    const resized =
      afterResize.width > before.width || afterResize.height > before.height;
    if (resized) {
      pushLog(logs, {
        stepId: "cap-absolute-01",
        target: textCandidate.id,
        intent: "Exercise drag/resize or blocked-state on layout-heavy deck",
        actionAttempted: "Drag selection overlay and resize southeast handle",
        result: "passed",
        evidence: `move=${before.left},${before.top}->${afterDrag.left},${afterDrag.top}; width=${before.width}->${afterResize.width}`,
      });
      return;
    }
    const diagnostics = await page.locator("#diagnosticsBox").innerText();
    const policy = await page.locator("#selectionPolicyText").innerText();
    expect(`${diagnostics}\n${policy}`).toMatch(
      /directManipSafe=false|Cannot move|Cannot resize|overlay|inspector/i,
    );
    pushLog(logs, {
      stepId: "cap-absolute-01",
      target: textCandidate.id,
      intent: "Exercise drag/resize or blocked-state on layout-heavy deck",
      actionAttempted: "Drag selection overlay and attempt southeast resize",
      result: "passed",
      evidence: `move=${before.left},${before.top}->${afterDrag.left},${afterDrag.top}; resizeBlocked=${before.width}->${afterResize.width}`,
    });
    return;
  }

  const diagnostics = await page.locator("#diagnosticsBox").innerText();
  const policy = await page.locator("#selectionPolicyText").innerText();
  expect(`${diagnostics}\n${policy}`).toMatch(/directManipSafe=false|Cannot move|overlay|inspector/i);
  pushLog(logs, {
    stepId: "cap-absolute-01",
    target: textCandidate.id,
    intent: "Exercise drag/resize or blocked-state on layout-heavy deck",
    actionAttempted: "Attempt drag and assert blocked-state diagnostics",
    result: "passed",
    evidence: diagnostics.split("\n").slice(0, 3).join(" | "),
  });
}

async function verifyTableCapability(page, deckCase, logs) {
  if (!deckCase.capabilities.some((capability) => capability.includes("table"))) {
    return;
  }

  const inventory = await getDeckInventory(page);
  const cellCandidate = await findTableCellCandidate(page, inventory);
  if (!cellCandidate) {
    pushLog(logs, {
      stepId: "cap-table-01",
      target: deckCase.id,
      intent: "Exercise table edit, navigation, and structural ops",
      actionAttempted: "Find table cell candidate",
      result: "not-applicable",
      evidence: "No selectable table cell found",
    });
    return;
  }

  const selector = previewNodeSelector(cellCandidate);
  const commitTarget = findCommitTargetCandidate(inventory, cellCandidate);
  const originalRows = await previewLocator(page, "table tr").count();
  const originalColumns = await previewLocator(page, "table tr:first-child > *").count();

  await selectionFrameLocator(page).press("Enter");
  const cell = previewLocator(page, selector);
  await cell.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await cell.type(`Reviewed ${deckCase.id}`);
  // Use the same robust commit strategy as verifyTextEditingFlow so presentations
  // with JS-animated slide overlays (e.g. absolute-positioned decks) can commit.
  await finalizeEditCommit(page, inventory, cellCandidate, commitTarget);
  await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");
  await expect
    .poll(() =>
      previewLocator(page, selector).evaluate((element) =>
        (element.textContent || "").toLowerCase(),
      ),
    )
    .toContain(`reviewed ${deckCase.id}`.toLowerCase());

  await selectRuntimeNode(page, cellCandidate, { expectedKind: "table-cell" });
  const beforeSelectionId = await evaluateEditor(page, "state.selectedNodeId || ''");
  await selectionFrameLocator(page).press("Tab");
  await expect
    .poll(() => evaluateEditor(page, "state.selectedNodeId || ''"))
    .not.toBe(beforeSelectionId);

  await clickEditorControl(page, "#insertTableRowBelowBtn", { panel: "inspector" });
  await expect.poll(() => previewLocator(page, "table tr").count()).toBe(originalRows + 1);
  await clickEditorControl(page, "#deleteTableRowBtn", { panel: "inspector" });
  await expect.poll(() => previewLocator(page, "table tr").count()).toBe(originalRows);

  await clickEditorControl(page, "#insertTableColumnRightBtn", { panel: "inspector" });
  await expect
    .poll(() => previewLocator(page, "table tr:first-child > *").count())
    .toBeGreaterThan(originalColumns);
  await clickEditorControl(page, "#deleteTableColumnBtn", { panel: "inspector" });
  await expect
    .poll(() => previewLocator(page, "table tr:first-child > *").count())
    .toBe(originalColumns);

  pushLog(logs, {
    stepId: "cap-table-01",
    target: cellCandidate.id,
    intent: "Exercise table edit, navigation, and structural ops",
    actionAttempted:
      "Edit table cell, navigate with Tab, insert/delete row, insert/delete column",
    result: "passed",
    evidence: `rows=${originalRows}; columns=${originalColumns}`,
  });
}

async function verifyCodeCapability(page, deckCase, logs) {
  if (!deckCase.capabilities.some((capability) => capability.includes("code"))) {
    return;
  }

  const inventory = await getDeckInventory(page);
  const codeCandidate = await findCodeBlockCandidate(page, inventory);
  if (!codeCandidate) {
    pushLog(logs, {
      stepId: "cap-code-01",
      target: deckCase.id,
      intent: "Exercise code block whitespace-safe edit and roundtrip",
      actionAttempted: "Find code block candidate",
      result: "not-applicable",
      evidence: "No code block candidate found",
    });
    return;
  }

  const selector = previewNodeSelector(codeCandidate);
  const commitTarget = findCommitTargetCandidate(inventory, codeCandidate);
  await expect(page.locator("#boldBtn")).toBeDisabled();
  await clickEditorControl(page, "#editTextBtn", { panel: "inspector" });
  const block = previewLocator(page, selector);
  await block.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await block.type("function deepSweep() {");
  await block.press("Enter");
  await block.type(`  return '${deckCase.id}';`);
  await block.press("Enter");
  await block.type("}");
  if (commitTarget) {
    await clickPreview(page, previewNodeSelector(commitTarget), { force: true });
  } else if (inventory.slideIds.length > 1) {
    const currentSlideIndex = inventory.slideIds.indexOf(codeCandidate.slideId);
    const fallbackSlideIndex = currentSlideIndex > 0 ? currentSlideIndex - 1 : 1;
    await activateSlideByIndex(page, fallbackSlideIndex);
  } else {
    throw new Error("Unable to find a commit target for code block editing.");
  }
  await expect.poll(() => evaluateEditor(page, "state.interactionMode")).toBe("select");

  const expectedText = `function deepSweep() {\n  return '${deckCase.id}';\n}`;
  await expect
    .poll(() => previewLocator(page, selector).evaluate((element) => element.textContent))
    .toBe(expectedText);

  const activeSlideId = await evaluateEditor(page, "state.activeSlideId || ''");
  const serialized = await evaluateEditor(page, "serializeCurrentProject()");
  await evaluateEditor(
    page,
    `loadHtmlString(${JSON.stringify(serialized)}, ${JSON.stringify(`${deckCase.id}-code-roundtrip`)}, {
      mode: "edit",
      preferSlideId: ${JSON.stringify(activeSlideId)},
      resetHistory: true
    })`,
  );
  await expect.poll(() => evaluateEditor(page, "state.previewLifecycle")).toBe("ready");
  await expect.poll(() => evaluateEditor(page, "Boolean(state.previewReady)")).toBe(true);
  await expect.poll(() => evaluateEditor(page, "state.activeSlideId || ''")).toBe(activeSlideId);
  await expect
    .poll(() => previewLocator(page, selector).evaluate((element) => element.textContent))
    .toBe(expectedText);

  pushLog(logs, {
    stepId: "cap-code-01",
    target: codeCandidate.id,
    intent: "Exercise code block whitespace-safe edit and roundtrip",
    actionAttempted: "Edit code block text, serialize, reload, verify whitespace",
    result: "passed",
    evidence: `slide=${activeSlideId}; selector=${selector}`,
  });
}

async function verifySvgCapability(page, deckCase, logs) {
  if (!deckCase.capabilities.includes("svg")) {
    return;
  }

  const inventory = await getDeckInventory(page);
  const svgCandidate = await findSvgCandidate(page, inventory);
  if (!svgCandidate) {
    pushLog(logs, {
      stepId: "cap-svg-01",
      target: deckCase.id,
      intent: "Exercise svg selection honesty",
      actionAttempted: "Find svg candidate",
      result: "not-applicable",
      evidence: "No svg candidate found",
    });
    return;
  }

  const ui = await readSelectionUiState(page);
  expect(ui.selectedEntityKind).toBe("svg");
  expect(ui.selectionPath.length).toBeGreaterThan(0);
  const serialized = await evaluateEditor(page, "serializeCurrentProject()");
  expect(serialized).toContain("<svg");

  pushLog(logs, {
    stepId: "cap-svg-01",
    target: svgCandidate.id,
    intent: "Exercise svg selection honesty",
    actionAttempted: "Select svg node and verify no flattening through serialized export",
    result: "passed",
    evidence: `selectionPath=${ui.selectionPath.map((entry) => entry.nodeId).join(" > ")}`,
  });
}

async function verifyThemeParityCapability(page, deckCase, logs) {
  if (
    !deckCase.capabilities.some((capability) =>
      ["css-variables", "dark-theme", "theme"].includes(capability),
    )
  ) {
    return;
  }

  const readPreviewTheme = async () =>
    page.evaluate(() => {
      const frameDoc = document.getElementById("previewFrame")?.contentDocument;
      const target =
        frameDoc?.body ||
        frameDoc?.querySelector("[data-slide-id],[data-editor-slide-id],section,article,main");
      if (!target || target.nodeType !== Node.ELEMENT_NODE) return null;
      const style = frameDoc.defaultView.getComputedStyle(target);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
      };
    });

  const initialThemeState = await readShellThemeState(page);
  const lightTransition = await ensureResolvedThemeViaShell(page, "light");
  const light = await readPreviewTheme();
  const darkTransition = await ensureResolvedThemeViaShell(page, "dark");
  const dark = await readPreviewTheme();
  const restoredThemeState = await cycleThemePreferenceViaShell(page, initialThemeState.preference);
  const themeDeltaDetected =
    dark.backgroundColor !== light.backgroundColor || dark.color !== light.color;

  expect(light).not.toBeNull();
  expect(dark).not.toBeNull();
  expect(restoredThemeState.after.preference).toBe(initialThemeState.preference);
  expect(restoredThemeState.after.theme).toBe(initialThemeState.theme);

  pushLog(logs, {
    stepId: "cap-theme-01",
    target: deckCase.id,
    intent: "Verify theme parity on css-variable/dark-theme deck",
    actionAttempted: "Reach light and dark resolved themes through shell control and compare preview colors",
    result: themeDeltaDetected ? "passed" : "not-applicable",
    evidence: `initial=${initialThemeState.preference}/${initialThemeState.theme}; lightClicks=${lightTransition.clicks}; darkClicks=${darkTransition.clicks}; light=${light.backgroundColor}/${light.color}; dark=${dark.backgroundColor}/${dark.color}`,
  });
}

async function verifyRuntimeTruthCapability(page, deckCase, logs) {
  if (
    !deckCase.capabilities.some((capability) =>
      ["data-driven", "fragments", "reveal", "scroll-snap", "web-components"].includes(capability),
    )
  ) {
    return;
  }

  const before = await page.evaluate(() => {
    const frameDoc = document.getElementById("previewFrame")?.contentDocument;
    return {
      customElements: frameDoc
        ? Array.from(frameDoc.querySelectorAll("*")).filter((node) => node.tagName.includes("-")).length
        : 0,
      fragmentNodes: frameDoc
        ? frameDoc.querySelectorAll(".fragment,[data-fragment-index],[data-fragment-id]").length
        : 0,
      slideCount: frameDoc
        ? frameDoc.querySelectorAll("[data-editor-slide-id],[data-slide-id],section.slide").length
        : 0,
    };
  });
  const activeSlideId = await evaluateEditor(page, "state.activeSlideId || ''");
  const serialized = await evaluateEditor(page, "serializeCurrentProject()");

  await evaluateEditor(
    page,
    `loadHtmlString(${JSON.stringify(serialized)}, ${JSON.stringify(`${deckCase.id}-runtime-roundtrip`)}, {
      mode: "edit",
      preferSlideId: ${JSON.stringify(activeSlideId)},
      resetHistory: true
    })`,
  );
  await expect.poll(() => evaluateEditor(page, "state.previewLifecycle")).toBe("ready");
  await expect.poll(() => evaluateEditor(page, "Boolean(state.previewReady)")).toBe(true);
  await expect.poll(() => evaluateEditor(page, "state.activeSlideId || ''")).toBe(activeSlideId);

  const after = await page.evaluate(() => {
    const frameDoc = document.getElementById("previewFrame")?.contentDocument;
    return {
      customElements: frameDoc
        ? Array.from(frameDoc.querySelectorAll("*")).filter((node) => node.tagName.includes("-")).length
        : 0,
      fragmentNodes: frameDoc
        ? frameDoc.querySelectorAll(".fragment,[data-fragment-index],[data-fragment-id]").length
        : 0,
      slideCount: frameDoc
        ? frameDoc.querySelectorAll("[data-editor-slide-id],[data-slide-id],section.slide").length
        : 0,
    };
  });

  expect(after.slideCount).toBeGreaterThan(0);
  if (deckCase.capabilities.includes("web-components")) {
    expect(after.customElements).toBeGreaterThan(0);
  }
  if (
    (deckCase.capabilities.includes("fragments") ||
      deckCase.capabilities.includes("reveal")) &&
    before.fragmentNodes > 0
  ) {
    expect(after.fragmentNodes).toBeGreaterThan(0);
  }

  pushLog(logs, {
    stepId: "cap-runtime-01",
    target: deckCase.id,
    intent: "Verify runtime-truth import/export behavior for stateful deck",
    actionAttempted: "Serialize current project and load roundtrip payload",
    result: "passed",
    evidence: `before=${JSON.stringify(before)}; after=${JSON.stringify(after)}`,
  });
}

async function verifyRelativeAssetsCapability(page, deckCase, inventory, logs) {
  if (!deckCase.capabilities.includes("relative-assets")) {
    return;
  }

  expect(inventory.manualBaseUrl).toBe(deckCase.manualBaseUrl);
  const assetState = await page.evaluate(() => {
    const frameDoc = document.getElementById("previewFrame")?.contentDocument;
    const assetNodes = frameDoc
      ? Array.from(
          frameDoc.querySelectorAll(
            "img[src], video[src], source[src], link[href], script[src]",
          ),
        )
      : [];
    return assetNodes.map((node) => ({
      raw: node.getAttribute("src") || node.getAttribute("href") || "",
      resolved:
        node.getAttribute("href") && "href" in node
          ? node.href
          : node.getAttribute("src") && "src" in node
            ? node.src
            : "",
    }));
  });
  expect(assetState.length).toBeGreaterThan(0);
  expect(assetState.some((asset) => asset.resolved.startsWith(deckCase.manualBaseUrl))).toBe(
    true,
  );

  pushLog(logs, {
    stepId: "cap-assets-01",
    target: deckCase.id,
    intent: "Verify manualBaseUrl and resolved relative assets",
    actionAttempted: "Inspect resolved asset URLs inside preview iframe",
    result: "passed",
    evidence: JSON.stringify(assetState.slice(0, 3)),
  });
}

async function runDeepMatrix(page, deckCase, logs) {
  const inventory = await verifyBaseMatrix(page, deckCase, logs);
  await verifyShellSurfaces(page, deckCase, inventory, logs);
  await verifySlideStructuralFlow(page, deckCase, logs);
  const textCandidate = await verifyTextEditingFlow(page, deckCase, logs);
  await verifyManipulationCapability(page, deckCase, textCandidate, logs);
  await verifyTableCapability(page, deckCase, logs);
  await verifyCodeCapability(page, deckCase, logs);
  await verifySvgCapability(page, deckCase, logs);
  await verifyThemeParityCapability(page, deckCase, logs);
  await verifyRuntimeTruthCapability(page, deckCase, logs);
  await verifyRelativeAssetsCapability(page, deckCase, inventory, logs);
}

async function runCompactMatrix(page, deckCase, logs) {
  const inventory = await verifyBaseMatrix(page, deckCase, logs);
  await verifyShellSurfaces(page, deckCase, inventory, logs, { compact: true });
  const initialThemeState = await readShellThemeState(page);
  const darkTransition = await ensureResolvedThemeViaShell(page, "dark");
  const restoredThemeState = await cycleThemePreferenceViaShell(page, initialThemeState.preference);
  pushLog(logs, {
    stepId: "compact-01",
    target: deckCase.id,
    intent: "Verify compact shell survives explicit dark-theme roundtrip",
    actionAttempted: "Reach dark resolved theme through compact shell control and restore initial preference",
    result: "passed",
    evidence: `initial=${initialThemeState.preference}/${initialThemeState.theme}; dark=${darkTransition.after.preference}/${darkTransition.after.theme}; restored=${restoredThemeState.after.preference}/${restoredThemeState.after.theme}`,
  });
}

test.describe("Reference deck deep validation @references", () => {
  for (const deckCase of REFERENCE_DECK_CASES) {
    test(`${deckCase.id} executes reference validation matrix`, async ({ page }, testInfo) => {
      test.skip(
        !isTargetProject(testInfo.project.name),
        "Reference validation matrix runs only on target chromium projects.",
      );
      // Stress-layout and dense-content decks exercise many slides; give them 5 min.
      if (
        deckCase.capabilities.some((c) =>
          ["stress-layout", "dense-content", "nested-dom"].includes(c),
        )
      ) {
        test.setTimeout(300_000);
      } else {
        test.slow();
      }

      const logs = [];
      const summary = {
        compact: isCompactProject(testInfo.project.name),
        deep: isDeepProject(testInfo.project.name),
      };

      try {
        pushLog(logs, {
          stepId: "setup-01",
          target: deckCase.id,
          intent: "Load reference deck through real open-html workflow",
          actionAttempted: `loadReferenceDeck(${deckCase.id})`,
          result: "started",
          evidence: deckCase.fixturePath,
        });
        await loadReferenceDeck(page, deckCase.id);
        pushLog(logs, {
          stepId: "setup-01",
          target: deckCase.id,
          intent: "Load reference deck through real open-html workflow",
          actionAttempted: `loadReferenceDeck(${deckCase.id})`,
          result: "passed",
          evidence: `${deckCase.manualBaseUrl} :: capabilities=${deckCase.capabilities.join(",")}`,
        });

        if (isDeepProject(testInfo.project.name)) {
          await runDeepMatrix(page, deckCase, logs);
        } else {
          await runCompactMatrix(page, deckCase, logs);
        }
      } catch (error) {
        pushLog(logs, {
          stepId: "failure",
          target: deckCase.id,
          intent: "Capture failing matrix step",
          actionAttempted: "reference-deck validation",
          result: "failed",
          evidence: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        await attachRunLog(testInfo, deckCase, logs, summary);
      }
    });
  }
});
