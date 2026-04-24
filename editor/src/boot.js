// boot.js
// Layer: Application Bootstrap
// Contains init() — the app entry point called by main.js — plus complexity,
// selection mode, slide template, and binding functions that run once at startup.
// Theme functions: theme.js | Zoom functions: zoom.js | Shell layout: shell-layout.js
//
      /* ======================================================================
       vNext overrides: system-theme default, responsive shell drawers,
       asset resolver for local folders, media modal for local/remote video,
       and stricter no-dead-end states.
       ====================================================================== */

      // P1-08: Absorbs the orphan DOM reparent that was in main.js (WO-22).
      function ensureSlideTemplateBarRoot() {
        if (
          els.slideTemplateBar &&
          els.slideTemplateBar.parentElement !== document.body
        ) {
          document.body.appendChild(els.slideTemplateBar);
        }
      }

      function init() {
        ensureSlideTemplateBarRoot(); // P1-08: DOM reparent absorbed from main.js (WO-22)
        // [v1.1.1 / ADR-032] Apply layout version + layers-standalone body attrs
        // BEFORE first paint so split-pane.css / layers-region.css rules scope
        // correctly on initial render. No-op when feature flags are off (default).
        window.applyLayoutVersionAttribute?.();
        window.applyLayersStandaloneAttribute?.();
        // [v1.1.3 / ADR-031] Place #layersListContainer into its correct host
        // (#layersInspectorSection or #layersRegion) per flag — before first
        // paint, so renderLayersPanel can populate the right parent on load.
        window.ensureLayersContainerPlacement?.();
        // [v1.2.1 / ADR-033] Inline the SVG icon sprite so <use href="#i-*"/>
        // resolves anywhere in the shell. No-op when featureFlags.svgIcons
        // is false (default off in this tag — flipped later in Phase C).
        window.injectIconSprite?.();
        initTheme();
        initInspectorSections();
        initComplexityMode();
        initSelectionMode(); // [LAYER-MODEL v2]
        initPreviewZoom(); // [v0.18.3]
        initFloatingToolbarState();
        ensureNoviceShellOnboardingUi();
        ensureNoviceSummaryStructure();
        bindTopBarActions();
        bindInspectorActions();
        bindSelectionOverlayInteractions();
        bindModals();
        renderShortcutsModalFromKeybindings(); // WO-37: auto-render from KEYBINDINGS table
        bindShellLayout();
        // [v1.1.1 / ADR-032] Init split-pane resizer if layoutVersion==="v2".
        // No-op otherwise. Called after bindShellLayout so shell DOM is wired.
        window.initLeftPaneSplitter?.();
        bindShellChromeMetrics();
        bindSlideTemplateActions();
        bindMessages();
        bindRuntimeGuards();
        bindUnloadWarning();
        bindGlobalShortcuts();
        // [v1.3.1 / Phase D1] Multi-select keyboard shortcuts (Ctrl+A, Escape).
        window.bindMultiSelectShortcuts?.();
        // [v1.3.2 / Phase D2] Alignment toolbar shortcuts + initial mount.
        window.ensureAlignmentToolbarRoot?.();
        window.bindAlignmentShortcuts?.();
        // [v1.3.3 / Phase D3] Shift+R rotate cycle.
        window.bindRotateShortcut?.();
        // [v1.5.0] Experimental badges based on current flag state.
        window.refreshExperimentalBadges?.();
        bindClipboardAndDnD();
        bindContextMenu();
        bindLayerPicker();
        bindRestoreBanner();
        window.bindBrokenAssetBanner?.(); // WO-24: wire broken-asset recovery banner
        bindPaletteActions();
        addInspectorHelpBadges();
        if (!consumeStarterLaunchIntent()) {
          tryRestoreDraftPrompt();
        }
        startBridgeWatchdog();
        updateAssetDirectoryStatus();
        bindTelemetryToggleUi();
        refreshUi();
      }

      /* ======================================================================
       [SCRIPT 02] boot + shell layout + theme
       ====================================================================== */
      // Theme functions moved to theme.js (WO-22).

      function initComplexityMode() {
        let mode = "basic";
        try {
          const raw = localStorage.getItem(UI_COMPLEXITY_STORAGE_KEY);
          if (raw === "advanced") mode = "advanced";
        } catch (error) {
          reportShellWarning("complexity-mode-load-failed", error, {
            once: true,
          });
        }
        setComplexityMode(mode, false);
      }

      function setComplexityMode(mode, persist = true) {
        state.complexityMode = mode === "advanced" ? "advanced" : "basic";
        // [WO-16] Sync complexity mode into the observable store ui slice.
        if (window.store) window.store.update("ui", { complexityMode: state.complexityMode });
        if (persist) {
          try {
            localStorage.setItem(
              UI_COMPLEXITY_STORAGE_KEY,
              state.complexityMode,
            );
          } catch (error) {
            reportShellWarning("complexity-mode-save-failed", error, {
              once: true,
            });
          }
        }
        refreshUi();
      }

      // [LAYER-MODEL v2] selection mode toggle
      function initSelectionMode() {
        let mode = "smart";
        try {
          const raw = localStorage.getItem(SELECTION_MODE_STORAGE_KEY);
          if (raw === "container") mode = "container";
        } catch (error) {
          reportShellWarning("selection-mode-load-failed", error, {
            once: true,
          });
        }
        setSelectionMode(mode, false);
      }

      function setSelectionMode(mode, persist = true) {
        state.selectionMode = mode === "container" ? "container" : "smart";
        if (persist) {
          try {
            localStorage.setItem(SELECTION_MODE_STORAGE_KEY, state.selectionMode);
          } catch (error) {
            reportShellWarning("selection-mode-save-failed", error, {
              once: true,
            });
          }
        }
        // [WO-36] Reset ack marker before sending so waitForContainerModeApplied() can re-arm
        state.__containerModeAckAt = 0;
        // [LAYER-MODEL v2] sync container mode to iframe
        sendToBridge("set-selection-mode", { containerMode: state.selectionMode === "container" });
        applySelectionModeUi();
      }

      function applySelectionModeUi() {
        const isContainer = state.selectionMode === "container";
        setToggleButtonState(els.smartModeBtn, !isContainer);
        setToggleButtonState(els.containerModeBtn, isContainer);
      }

      // Zoom functions moved to zoom.js (WO-22).

      function shouldForceBasicAdvancedControl(node) {
        return false;
      }

      function applyComplexityModeUi() {
        const isAdvanced = isAdvancedMode();
        document.body.dataset.complexityMode = state.complexityMode;
        setToggleButtonState(els.basicModeBtn, !isAdvanced);
        setToggleButtonState(els.advancedModeBtn, isAdvanced);
        document
          .querySelectorAll('[data-ui-level="advanced"]')
          .forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            const forceVisible = shouldForceBasicAdvancedControl(node);
            const entityVisible = !node.classList.contains("is-entity-hidden");
            const visible = node.classList.contains("inspector-section")
              ? entityVisible && (isAdvanced || forceVisible)
              : isAdvanced || forceVisible;
            node.hidden = !visible;
            node.setAttribute("aria-hidden", visible ? "false" : "true");
            if (forceVisible) {
              node.setAttribute("data-force-basic-visible", "true");
            } else {
              node.removeAttribute("data-force-basic-visible");
            }
            syncShellPanelFocusableState(node, visible);
            try {
              node.inert = !visible;
            } catch (error) {
              // `inert` is optional; focusability is already synchronized via tabindex and aria state.
            }
          });
      }

      function bindTopBarActions() {
        els.openHtmlBtn?.addEventListener("click", () =>
          openOpenHtmlModal(),
        );
        els.emptyOpenBtn?.addEventListener("click", () =>
          openOpenHtmlModal(),
        );
        els.emptyPasteBtn?.addEventListener("click", () =>
          openOpenHtmlModal({ focusTarget: "paste" }),
        );
        els.emptyStarterDeckBtn?.addEventListener("click", () => {
          void loadStarterDeck("basic");
        });
        els.previewPrimaryActionBtn?.addEventListener("click", () => {
          const action = String(els.previewPrimaryActionBtn?.dataset.action || "");
          if (action === "open") {
            openOpenHtmlModal();
            return;
          }
          if (action === "edit" && state.modelDoc && state.editingSupported) {
            setMode("edit");
          }
        });
        els.previewAssistActionBtn?.addEventListener("click", () => {
          const action = String(els.previewAssistActionBtn?.dataset.action || "");
          if (action === "assets") {
            openOpenHtmlModal({ focusTarget: "assets" });
            return;
          }
          if (action === "base") {
            openOpenHtmlModal({ focusTarget: "base" });
          }
        });
        els.showSlideHtmlBtn?.addEventListener("click", openSlideHtmlEditor);
        els.reloadPreviewBtn?.addEventListener("click", () =>
          reloadPreviewShell("manual"),
        );
        els.basicModeBtn?.addEventListener("click", () =>
          setComplexityMode("basic"),
        );
        els.advancedModeBtn?.addEventListener("click", () =>
          setComplexityMode("advanced"),
        );
        // [LAYER-MODEL v2] selection mode toggle
        els.smartModeBtn?.addEventListener("click", () =>
          setSelectionMode("smart"),
        );
        els.containerModeBtn?.addEventListener("click", () =>
          setSelectionMode("container"),
        );
        // [v0.18.3] preview zoom
        els.zoomOutBtn?.addEventListener("click", () => stepZoom(-1));
        els.zoomInBtn?.addEventListener("click", () => stepZoom(1));
        els.zoomResetBtn?.addEventListener("click", () => setPreviewZoom(1.0, true));
        els.presentBtn?.addEventListener("click", presentDeck);
        els.exportBtn?.addEventListener("click", exportHtml);
        els.exportPptxBtn?.addEventListener("click", () => { void exportPptx(); });
        els.themeToggleBtn?.addEventListener("click", toggleTheme);
        els.undoBtn?.addEventListener("click", undo);
        els.redoBtn?.addEventListener("click", redo);
        els.topbarOverflowBtn?.addEventListener("click", toggleTopbarOverflow);
        els.topbarOverflowBtn?.addEventListener("keydown", (event) => {
          if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
          event.preventDefault();
          setTopbarOverflowOpen(true, { focusFirst: false });
          window.requestAnimationFrame(() =>
            focusTopbarOverflowButton(
              event.key === "ArrowUp" ? getTopbarOverflowButtons().length - 1 : 0,
            ),
          );
        });
        document.getElementById("topbarOverflowShortcutsBtn")?.addEventListener("click", () => {
          closeTopbarOverflow();
          openModal(els.shortcutsModal);
        });
        els.topbarOverflowThemeBtn?.addEventListener("click", () => {
          toggleTheme();
          closeTopbarOverflow();
        });
        els.topbarOverflowUndoBtn?.addEventListener("click", () => {
          undo();
          closeTopbarOverflow();
        });
        els.topbarOverflowRedoBtn?.addEventListener("click", () => {
          redo();
          closeTopbarOverflow();
        });
        els.topbarOverflowMenu?.addEventListener("keydown", (event) => {
          const items = getTopbarOverflowButtons();
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeTopbarOverflow({ restoreFocus: true });
            return;
          }
          if (["ArrowDown", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            focusTopbarOverflowButton((currentIndex + 1 + items.length) % items.length);
            return;
          }
          if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
            event.preventDefault();
            focusTopbarOverflowButton((currentIndex - 1 + items.length) % items.length);
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusTopbarOverflowButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusTopbarOverflowButton(items.length - 1);
          }
        });
        document.addEventListener("pointerdown", (event) => {
          if (!isTopbarOverflowOpen()) return;
          if (
            event.target.closest("#topbarOverflowMenu") ||
            event.target.closest("#topbarOverflowBtn")
          ) {
            return;
          }
          closeTopbarOverflow();
        });
        window.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isTopbarOverflowOpen()) {
            event.preventDefault();
            closeTopbarOverflow({ restoreFocus: true });
          }
        });
        window.addEventListener("blur", closeTopbarOverflow);
        els.previewModeBtn?.addEventListener("click", () => setMode("preview"));
        els.editModeBtn?.addEventListener("click", () => setMode("edit"));

        els.assetDirectoryInput?.addEventListener("change", async () => {
          await setAssetDirectoryFromFiles(
            Array.from(els.assetDirectoryInput.files || []),
          );
        });

        els.loadFileBtn?.addEventListener("click", async () => {
          clearOpenHtmlStatus();
          const file = els.fileInput.files?.[0];
          if (!file) {
            setOpenHtmlStatus("Сначала выбери HTML-файл.", "warning");
            els.fileInput?.focus();
            return;
          }
          try {
            const htmlText = await file.text();
            const loaded = loadHtmlString(htmlText, file.name, {
              resetHistory: true,
              dirty: false,
              onError: (message) => setOpenHtmlStatus(message, "error"),
            });
            if (!loaded) return;
            closeModal(els.openHtmlModal);
          } catch (error) {
            console.error(error);
            reportShellWarning("open-html-file-read-failed", error, {
              once: true,
              diagnostic: false,
            });
            setOpenHtmlStatus("Не удалось прочитать HTML-файл.", "error");
          }
        });

        els.loadPastedHtmlBtn?.addEventListener("click", () => {
          clearOpenHtmlStatus();
          const htmlText = els.pasteHtmlTextarea.value.trim();
          if (!htmlText) {
            setOpenHtmlStatus("Вставь HTML-код в текстовое поле.", "warning");
            els.pasteHtmlTextarea?.focus();
            return;
          }
          const loaded = loadHtmlString(htmlText, "Вставленный HTML", {
            resetHistory: true,
            dirty: false,
            onError: (message) => setOpenHtmlStatus(message, "error"),
          });
          if (!loaded) return;
          closeModal(els.openHtmlModal);
        });

        els.loadVideoFileBtn?.addEventListener(
          "click",
          insertVideoFromSelectedFile,
        );
        els.insertVideoUrlBtn?.addEventListener(
          "click",
          insertVideoFromUrlInput,
        );
        els.videoUrlInput?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            insertVideoFromUrlInput();
          }
        });
      }

      function bindModals() {
        document.querySelectorAll("[data-close-modal]").forEach((button) => {
          button.addEventListener("click", () => {
            const target = document.getElementById(button.dataset.closeModal);
            if (target) closeModal(target);
          });
        });

        [els.openHtmlModal, els.htmlEditorModal, els.videoInsertModal, els.shortcutsModal].forEach(
          (modal, index) => {
            if (!modal) return;
            modal.setAttribute("role", "dialog");
            modal.setAttribute("aria-modal", "true");
            if (!modal.hasAttribute("tabindex"))
              modal.setAttribute("tabindex", "-1");
            const heading = modal.querySelector(".modal-header h3");
            if (heading) {
              if (!heading.id) heading.id = `modalTitle-vnext-${index + 1}`;
              modal.setAttribute("aria-labelledby", heading.id);
            }
            modal.addEventListener("click", (event) => {
              if (event.target === modal) closeModal(modal);
            });
          },
        );

        document.addEventListener("keydown", (event) => {
          if (event.key !== "Tab") return;
          const modal = document.querySelector(".modal.is-open");
          if (!(modal instanceof HTMLElement)) return;
          const focusables = getFocusableElements(modal);
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = document.activeElement;
          if (event.shiftKey && (active === first || active === modal)) {
            event.preventDefault();
            last.focus({ preventScroll: true });
          } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus({ preventScroll: true });
          }
        });
      }

      // WO-37: Auto-render shortcuts cheat-sheet modal body from KEYBINDINGS table.
      // Groups are built from binding.group; column split is at the midpoint of groups.
      function renderShortcutsModalFromKeybindings() {
        const body = document.querySelector("#shortcutsModal .shortcuts-modal-body");
        if (!body || typeof window.KEYBINDINGS === "undefined") return;

        // Collect groups preserving order of first appearance.
        const groupOrder = [];
        const groups = {};
        for (const b of window.KEYBINDINGS) {
          if (!b.label || !b.group) continue;
          if (!groups[b.group]) {
            groups[b.group] = [];
            groupOrder.push(b.group);
          }
          groups[b.group].push(b);
        }

        function buildGroupHtml(groupName) {
          const rows = groups[groupName]
            .map((b) => `<tr><td><kbd>${b.chord}</kbd></td><td>${b.label}</td></tr>`)
            .join("");
          return `<h4>${groupName}</h4><table class="shortcuts-table">${rows}</table>`;
        }

        // Split groups into two columns: first half left, second half right.
        const mid = Math.ceil(groupOrder.length / 2);
        const leftGroups = groupOrder.slice(0, mid);
        const rightGroups = groupOrder.slice(mid);

        body.innerHTML =
          `<div class="shortcuts-col">${leftGroups.map(buildGroupHtml).join("")}</div>` +
          `<div class="shortcuts-col">${rightGroups.map(buildGroupHtml).join("")}</div>`;
      }

      // Shell layout functions moved to shell-layout.js (WO-22).

      function getSlideTemplateButtons() {
        return Array.from(
          els.slideTemplateBar?.querySelectorAll("button[data-slide-template]") ||
            [],
        );
      }

      function isSlideTemplateBarOpen() {
        return Boolean(els.slideTemplateBar?.classList.contains("is-open"));
      }

      function setSlideTemplateBarOpen(open, options = {}) {
        if (!els.slideTemplateBar || !els.toggleSlideTemplateBarBtn) return;
        const active = Boolean(open);
        state.slideTemplateBarOpen = active;
        els.slideTemplateBar.classList.toggle("is-open", active);
        els.slideTemplateBar.setAttribute("aria-hidden", active ? "false" : "true");
        els.toggleSlideTemplateBarBtn.setAttribute(
          "aria-expanded",
          active ? "true" : "false",
        );
        const items = getSlideTemplateButtons();
        applyRovingTabindex(items, active ? 0 : -1);
        if (active) {
          closeShellPanels({ keep: "slide-template" });
          closeTransientShellUi({ keep: "slide-template" });
          scheduleShellPopoverLayout();
          if (options.focusFirst !== false) {
            window.requestAnimationFrame(() => items[0]?.focus({ preventScroll: true }));
          }
        } else if (options.restoreFocus) {
          window.requestAnimationFrame(() =>
            els.toggleSlideTemplateBarBtn.focus({ preventScroll: true }),
          );
        }
      }

      function closeSlideTemplateBar(options = {}) {
        setSlideTemplateBarOpen(false, options);
      }

      function bindSlideTemplateActions() {
        els.toggleSlideTemplateBarBtn?.addEventListener("click", () => {
          if (!canUseStaticSlideModel()) {
            showToast(
              "Для этого deck нет безопасной статической структуры слайдов. Добавление шаблонов слайдов доступно только там, где modelDoc видит реальные slide-root узлы.",
              "warning",
              { title: "Шаблоны слайдов" },
            );
            return;
          }
          if (state.mode !== "edit") setMode("edit");
          setSlideTemplateBarOpen(!isSlideTemplateBarOpen());
        });

        getSlideTemplateButtons().forEach((button) => {
          button.addEventListener("click", () =>
            insertSlideFromTemplate(button.dataset.slideTemplate || "section"),
          );
        });

        els.slideTemplateBar?.addEventListener("keydown", (event) => {
          const items = getSlideTemplateButtons();
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeSlideTemplateBar({ restoreFocus: true });
            return;
          }
          if (["ArrowRight", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            focusSlideTemplateButton((currentIndex + 1 + items.length) % items.length);
            return;
          }
          if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            focusSlideTemplateButton((currentIndex - 1 + items.length) % items.length);
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusSlideTemplateButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusSlideTemplateButton(items.length - 1);
          }
        });

        document.addEventListener("pointerdown", (event) => {
          if (!isSlideTemplateBarOpen()) return;
          if (
            event.target.closest("#slideTemplateBar") ||
            event.target.closest("#toggleSlideTemplateBarBtn")
          ) {
            return;
          }
          closeSlideTemplateBar();
        });

        window.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isSlideTemplateBarOpen()) {
            event.preventDefault();
            closeSlideTemplateBar({ restoreFocus: true });
          }
        });
      }

      function focusSlideTemplateButton(index) {
        const items = getSlideTemplateButtons();
        if (!items.length) return;
        const nextIndex = Math.max(0, Math.min(items.length - 1, index));
        applyRovingTabindex(items, nextIndex);
        items[nextIndex].focus({ preventScroll: true });
      }

      function canUseStaticSlideModel() {
        return Boolean(
          state.modelDoc?.querySelector("[data-editor-slide-id]") &&
            state.staticSlideSelector,
        );
      }

      function getCurrentSlideModelNode() {
        if (!state.modelDoc || !state.activeSlideId) return null;
        return state.modelDoc.querySelector(
          `[data-editor-slide-id="${cssEscape(state.activeSlideId)}"]`,
        );
      }

      function getSlideModelNodeById(slideId) {
        if (!state.modelDoc || !slideId) return null;
        return state.modelDoc.querySelector(
          `[data-editor-slide-id="${cssEscape(slideId)}"]`,
        );
      }

      function getStaticSlideModelNodes() {
        if (!state.modelDoc) return [];
        return Array.from(state.modelDoc.querySelectorAll("[data-editor-slide-id]"));
      }

      function getNextSlideId() {
        const values = getStaticSlideModelNodes().map((slide) => {
          const match = String(slide.getAttribute("data-editor-slide-id") || "").match(
            /slide-(\d+)/,
          );
          return match ? Number(match[1]) : 0;
        });
        return `slide-${Math.max(0, ...values) + 1}`;
      }

      function getNextNodeSeqInModel() {
        const values = Array.from(
          state.modelDoc?.querySelectorAll("[data-editor-node-id]") || [],
        ).map((node) => {
          const match = String(node.getAttribute("data-editor-node-id") || "").match(
            /node-(\d+)/,
          );
          return match ? Number(match[1]) : 0;
        });
        return Math.max(0, ...values) + 1;
      }

      function assignEditorNodeIdsInModel(root) {
        if (!(root instanceof Element) || !state.modelDoc) return;
        const slideRoot =
          (root.hasAttribute(EDITOR_SLIDE_ID_ATTR) ? root : null) ||
          root.closest(`[${EDITOR_SLIDE_ID_ATTR}]`) ||
          root;
        const slideIndex = Math.max(0, getStaticSlideModelNodes().indexOf(slideRoot));
        const usedSlideIds = new Set();
        getStaticSlideModelNodes().forEach((slide) => {
          if (slide === slideRoot || slideRoot.contains(slide)) return;
          const slideId = normalizeImportedIdentity(
            slide.getAttribute(EDITOR_SLIDE_ID_ATTR) || "",
          );
          if (slideId) usedSlideIds.add(slideId);
        });
        const usedNodeIds = new Set();
        Array.from(state.modelDoc.querySelectorAll(`[${EDITOR_NODE_ID_ATTR}]`)).forEach(
          (node) => {
            if (!(node instanceof Element)) return;
            if (node === slideRoot || slideRoot.contains(node)) return;
            const nodeId = normalizeImportedIdentity(
              node.getAttribute(EDITOR_NODE_ID_ATTR) || "",
            );
            if (nodeId) usedNodeIds.add(nodeId);
          },
        );
        const slideId = resolveImportedSlideIdentity(slideRoot, slideIndex, usedSlideIds);
        slideRoot.setAttribute(EDITOR_SLIDE_ID_ATTR, slideId);
        slideRoot.setAttribute(EDITOR_ENTITY_KIND_ATTR, "slide-root");
        slideRoot.setAttribute(EDITOR_EDITABLE_ATTR, "false");
        applyImportPolicyHint(slideRoot, resolveImportedPolicyHint(slideRoot, "slide-root"));
        collectCandidateElements(slideRoot).forEach((node, nodeIndex) => {
          const entityKind = resolveImportedEntityKind(node, slideRoot);
          const editable = resolveImportedEditability(node, entityKind);
          const nodeId = resolveImportedNodeIdentity(
            node,
            slideRoot,
            slideId,
            nodeIndex,
            usedNodeIds,
          );
          node.setAttribute(EDITOR_NODE_ID_ATTR, nodeId);
          node.setAttribute(EDITOR_ENTITY_KIND_ATTR, entityKind);
          node.setAttribute(EDITOR_EDITABLE_ATTR, editable ? "true" : "false");
          applyImportPolicyHint(node, resolveImportedPolicyHint(node, entityKind));
        });
      }

      function normalizeDomIdLocal(value) {
        return String(value || "").replace(/\s+/g, "-").trim();
      }

      function collectUsedDomIdsInModel(exceptRoot = null) {
        const used = new Set();
        state.modelDoc?.querySelectorAll("[id]").forEach((node) => {
          if (
            exceptRoot instanceof Element &&
            (node === exceptRoot || exceptRoot.contains(node))
          ) {
            return;
          }
          const id = normalizeDomIdLocal(node.getAttribute("id") || "");
          if (id) used.add(id);
        });
        return used;
      }

      function claimUniqueDomIdLocal(baseId, usedIds) {
        const normalized = normalizeDomIdLocal(baseId);
        if (!normalized) return "";
        let candidate = normalized;
        let index = 2;
        while (usedIds.has(candidate)) {
          candidate = `${normalized}-copy${index > 2 ? `-${index}` : ""}`;
          index += 1;
        }
        usedIds.add(candidate);
        return candidate;
      }

      function ensureUniqueDomIdsInModel(root, exceptRoot = null) {
        if (!(root instanceof Element)) return;
        const usedIds = collectUsedDomIdsInModel(exceptRoot);
        const nodes = [];
        if (root.id) nodes.push(root);
        root.querySelectorAll("[id]").forEach((node) => nodes.push(node));
        nodes.forEach((node) => {
          const uniqueId = claimUniqueDomIdLocal(node.id, usedIds);
          if (uniqueId) node.id = uniqueId;
          else node.removeAttribute("id");
        });
      }

      function stripRuntimeSlideState(slide) {
        if (!(slide instanceof Element)) return;
        [
          "active",
          "current",
          "present",
          "past",
          "future",
          "visible",
          "hidden",
          "next",
          "previous",
        ].forEach((className) => slide.classList.remove(className));
        ["aria-hidden", "aria-current", "hidden", "tabindex"].forEach((attr) =>
          slide.removeAttribute(attr),
        );
      }

      function copyStructuralSlideAttributes(source, target) {
        if (!(source instanceof Element) || !(target instanceof Element)) return;
        Array.from(source.attributes).forEach((attr) => {
          if (
            attr.name === "id" ||
            attr.name === "style" ||
            attr.name === "hidden" ||
            attr.name === "aria-hidden" ||
            attr.name === "aria-current" ||
            attr.name === "tabindex" ||
            /^data-editor-/.test(attr.name)
          ) {
            return;
          }
          target.setAttribute(attr.name, attr.value);
        });
        if (source.classList?.length) {
          const runtimeClasses = new Set([
            "active",
            "current",
            "present",
            "past",
            "future",
            "visible",
            "hidden",
            "next",
            "previous",
          ]);
          target.className = Array.from(source.classList)
            .filter((className) => !runtimeClasses.has(className))
            .join(" ");
        }
      }

      function getSlideTemplateInnerHtml(kind) {
        switch (kind) {
          case "title":
            return `<div style="display:flex; flex-direction:column; gap:16px; justify-content:center; min-height:100%;"><h1>Новый заголовок</h1><p>Подзаголовок или краткое описание.</p></div>`;
          case "section":
            return `<div style="display:flex; flex-direction:column; gap:16px;"><h2>Новый раздел</h2><p>Короткое описание раздела.</p></div>`;
          case "bullets":
            return `<div style="display:flex; flex-direction:column; gap:16px;"><h2>Ключевые пункты</h2><ul><li>Первый тезис</li><li>Второй тезис</li><li>Третий тезис</li></ul></div>`;
          case "media":
            return `<div style="display:grid; gap:18px; align-items:center;"><h2>Слайд с медиа</h2><div style="display:flex; align-items:center; justify-content:center; min-height:240px; border:1px dashed rgba(38,103,255,.35); border-radius:14px; background:rgba(38,103,255,.06);">Добавь изображение или видео</div><p>Подпись к медиа.</p></div>`;
          case "two-column":
            return `<div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start;"><div><h2>Левая колонка</h2><p>Текст левой колонки.</p></div><div><h2>Правая колонка</h2><p>Текст правой колонки.</p></div></div>`;
          default:
            return `<div style="display:flex; flex-direction:column; gap:16px;"><h2>Новый слайд</h2><p>Заполни содержимое этого слайда.</p></div>`;
        }
      }

      function createSlideRootFromTemplate(kind) {
        if (!state.modelDoc) return null;
        const templateSource =
          getCurrentSlideModelNode() || getStaticSlideModelNodes()[0] || null;
        const slideTag = templateSource?.tagName || "SECTION";
        const slide = state.modelDoc.createElement(slideTag.toLowerCase());
        if (templateSource) copyStructuralSlideAttributes(templateSource, slide);
        stripRuntimeSlideState(slide);
        stripInheritedSlideRuntimeAttrs(slide);
        slide.removeAttribute("id");
        slide.removeAttribute("style");
        slide.removeAttribute(AUTHOR_SLIDE_ID_ATTRS[0]);
        slide.removeAttribute("data-slide-title");
        slide.removeAttribute("data-slide-padding-preset");
        slide.removeAttribute("data-slide-preset");
        const nextSlideId = getNextSlideId();
        slide.setAttribute("data-editor-slide-id", nextSlideId);
        if (state.staticSlideSelector === "[data-slide-id]") {
          const authoredSlideId = claimUniqueAuthoredSlideIdInModel(nextSlideId);
          if (authoredSlideId) {
            slide.setAttribute(AUTHOR_SLIDE_ID_ATTRS[0], authoredSlideId);
          }
        }
        slide.setAttribute("data-slide-preset", kind);
        slide.innerHTML = getSlideTemplateInnerHtml(kind);
        ensureUniqueDomIdsInModel(slide);
        assignEditorNodeIdsInModel(slide);
        return slide;
      }

      function slideHasMeaningfulContent(slide) {
        if (!(slide instanceof Element)) return false;
        const text = String(slide.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (text) return true;
        return Boolean(
          slide.querySelector(
            "img, video, iframe, svg, canvas, table, ul, ol, blockquote, pre, figure",
          ),
        );
      }

      function applyCurrentSlidePreset(kind) {
        const slide = getCurrentSlideModelNode();
        const nextPreset = String(kind || "").trim();
        if (!slide || !nextPreset) return;
        const currentPreset = getSlidePresetValue(slide);
        const shouldConfirm =
          slideHasMeaningfulContent(slide) && currentPreset !== nextPreset;
        if (
          shouldConfirm &&
          !window.confirm(
            `Preset ${getSlidePresetLabel(nextPreset) || nextPreset} заменит текущее содержимое слайда. Slide-level настройки сохранятся. Продолжить?`,
          )
        ) {
          return;
        }
        slide.innerHTML = getSlideTemplateInnerHtml(nextPreset);
        slide.setAttribute("data-slide-preset", nextPreset);
        ensureUniqueDomIdsInModel(slide, slide);
        assignEditorNodeIdsInModel(slide);
        clearSelectedElementState();
        replaceCurrentSlideInPreview("slide-preset-apply");
        showToast("Preset применён к текущему слайду. Undo вернёт прошлую версию.", "success", {
          title: "Слайды",
        });
      }

      function insertSlideFromTemplate(kind) {
        if (!canUseStaticSlideModel()) {
          showToast(
            "У этого deck нет безопасной статической структуры слайдов для вставки готовых slide templates.",
            "warning",
            { title: "Слайды" },
          );
          return;
        }
        // [v1.5.1] Wrap mutation in user-action-boundary so a partial failure
        // restores the modelDoc instead of leaving a half-inserted slide.
        if (typeof window.withActionBoundary === "function") {
          return window.withActionBoundary("slide-template:" + kind, function () {
            return _insertSlideFromTemplateImpl(kind);
          });
        }
        return _insertSlideFromTemplateImpl(kind);
      }

      function _insertSlideFromTemplateImpl(kind) {
        const currentSlide = getCurrentSlideModelNode();
        const staticSlides = getStaticSlideModelNodes();
        const parent = currentSlide?.parentElement || staticSlides[0]?.parentElement;
        if (!parent) return;
        const slide = createSlideRootFromTemplate(kind);
        if (!slide) return;
        if (currentSlide) currentSlide.after(slide);
        else parent.appendChild(slide);
        syncStaticSlideOrderingMetadata();
        const slideId = slide.getAttribute("data-editor-slide-id");
        stageSlideActivationRequest(slideId, {
          source: "slide-template-model",
        });
        syncSlideRegistry({ currentActiveId: slideId });
        commitChange(`slide-template:${kind}`, { snapshotMode: "immediate" });
        rebuildPreviewKeepingContext(slideId);
        closeSlideTemplateBar();
        showToast("Новый слайд добавлен после текущего.", "success", {
          title: "Слайды",
        });
      }

      function getElementPathWithinRoot(root, node) {
        if (!(root instanceof Element) || !(node instanceof Element)) return null;
        if (root === node) return [];
        if (!root.contains(node)) return null;
        const path = [];
        let current = node;
        while (current && current !== root) {
          const parent = current.parentElement;
          if (!parent) return null;
          path.unshift(Array.from(parent.children).indexOf(current));
          current = parent;
        }
        return path;
      }

      function findElementByPath(root, path) {
        if (!(root instanceof Element) || !Array.isArray(path)) return null;
        let current = root;
        for (const index of path) {
          current = current.children[index] || null;
          if (!(current instanceof Element)) return null;
        }
        return current;
      }

      function cloneSlideForDuplicate(slideId = state.activeSlideId) {
        const currentSlide = getSlideModelNodeById(slideId);
        if (!currentSlide) return null;
        const authoredSlideId = readNonEmptyAttribute(
          currentSlide,
          AUTHOR_SLIDE_ID_ATTRS,
        );
        const selectedNode =
          slideId === state.activeSlideId &&
          state.selectedNodeId &&
          currentSlide.querySelector(
            `[data-editor-node-id="${cssEscape(state.selectedNodeId)}"]`,
          );
        const selectedPath = getElementPathWithinRoot(currentSlide, selectedNode);
        const clone = currentSlide.cloneNode(true);
        stripRuntimeSlideState(clone);
        stripInheritedSlideRuntimeAttrs(clone);
        stripAuthoredIdentityAttrs(clone, { stripSlideId: true });
        clone.removeAttribute("data-editor-slide-id");
        clone
          .querySelectorAll("[data-editor-node-id]")
          .forEach((node) => node.removeAttribute("data-editor-node-id"));
        const nextSlideId = getNextSlideId();
        clone.setAttribute("data-editor-slide-id", nextSlideId);
        if (authoredSlideId || state.staticSlideSelector === "[data-slide-id]") {
          const duplicateAuthorSlideId = claimUniqueAuthoredSlideIdInModel(
            authoredSlideId || nextSlideId,
          );
          if (duplicateAuthorSlideId) {
            clone.setAttribute(AUTHOR_SLIDE_ID_ATTRS[0], duplicateAuthorSlideId);
          }
        }
        const titleOverride = getSlideTitleOverride(clone);
        if (titleOverride) clone.setAttribute("data-slide-title", `${titleOverride} (копия)`);
        ensureUniqueDomIdsInModel(clone, currentSlide);
        assignEditorNodeIdsInModel(clone);
        const clonedSelectedNode = findElementByPath(clone, selectedPath);
        return {
          clone,
          clonedSelectedNodeId:
            clonedSelectedNode?.getAttribute("data-editor-node-id") || null,
        };
      }

      function cloneCurrentSlideForDuplicate() {
        return cloneSlideForDuplicate(state.activeSlideId);
      }

      function duplicateSlideById(slideId) {
        if (!canUseStaticSlideModel()) return;
        const currentSlide = getSlideModelNodeById(slideId);
        const duplicatePayload = cloneSlideForDuplicate(slideId);
        const clone = duplicatePayload?.clone || null;
        if (!currentSlide || !clone) return;
        currentSlide.after(clone);
        syncStaticSlideOrderingMetadata();
        const cloneId = clone.getAttribute("data-editor-slide-id");
        if (duplicatePayload?.clonedSelectedNodeId) {
          stagePreviewSelectionRestore(duplicatePayload.clonedSelectedNodeId, {
            slideId: cloneId,
          });
        }
        stageSlideActivationRequest(cloneId, {
          source: "slide-duplicate-model",
        });
        syncSlideRegistry({ currentActiveId: cloneId });
        commitChange("slide-duplicate", { snapshotMode: "immediate" });
        rebuildPreviewKeepingContext(cloneId);
        showToast("Текущий слайд продублирован.", "success", {
          title: "Слайды",
        });
      }

      function duplicateCurrentSlide() {
        duplicateSlideById(state.activeSlideId);
      }

      function deleteSlideById(slideId) {
        if (!canUseStaticSlideModel()) return;
        const slides = getStaticSlideModelNodes();
        const currentSlide = getSlideModelNodeById(slideId);
        if (!currentSlide) return;
        if (slides.length <= 1) {
          showToast("Нельзя удалить единственный слайд.", "warning", {
            title: "Слайды",
          });
          return;
        }
        const currentIndex = slides.findIndex(
          (slide) =>
            slide.getAttribute("data-editor-slide-id") === slideId,
        );
        const nextSlide =
          slides[currentIndex + 1] || slides[currentIndex - 1] || null;
        currentSlide.remove();
        syncStaticSlideOrderingMetadata();
        const nextSlideId =
          nextSlide?.getAttribute("data-editor-slide-id") || null;
        state.pendingPreviewSelection = null;
        clearSelectedElementState();
        stageSlideActivationRequest(nextSlideId, {
          source: "slide-delete-model",
        });
        syncSlideRegistry({ currentActiveId: nextSlideId });
        commitChange("slide-delete", { snapshotMode: "immediate" });
        rebuildPreviewKeepingContext(nextSlideId);
        showToast("Слайд удалён. При необходимости используй Undo.", "success", {
          title: "Слайды",
        });
      }

      function deleteCurrentSlide() {
        deleteSlideById(state.activeSlideId);
      }

      function replaceCurrentSlideInPreview(reason = "slide-style") {
        const slide = getCurrentSlideModelNode();
        if (!slide) return;
        const slideId = slide.getAttribute("data-editor-slide-id");
        commitChange(reason);
        syncSlideRegistry({ currentActiveId: slideId });
        renderSlidesList();
        refreshUi();
        const sent = sendToBridge("replace-slide-html", {
          slideId,
          html: slide.outerHTML,
        });
        if (!sent) rebuildPreviewKeepingContext(slideId);
      }

      function applyCurrentSlideTitleOverride(value) {
        const slide = getCurrentSlideModelNode();
        if (!slide) return;
        const title = String(value || "").trim();
        if (title) slide.setAttribute("data-slide-title", title);
        else slide.removeAttribute("data-slide-title");
        replaceCurrentSlideInPreview("slide-title");
      }

      function applyCurrentSlideBackground(value) {
        const slide = getCurrentSlideModelNode();
        if (!slide) return;
        slide.style.backgroundColor = value || "";
        replaceCurrentSlideInPreview("slide-background");
      }

      function getSlidePaddingPresetValue(preset) {
        switch (preset) {
          case "none":
            return "0px";
          case "compact":
            return "24px";
          case "default":
            return "48px";
          case "spacious":
            return "72px";
          default:
            return "";
        }
      }

      function applyCurrentSlidePaddingPreset(preset) {
        const slide = getCurrentSlideModelNode();
        if (!slide) return;
        const nextValue = getSlidePaddingPresetValue(preset);
        if (preset) slide.setAttribute("data-slide-padding-preset", preset);
        else slide.removeAttribute("data-slide-padding-preset");
        slide.style.padding = nextValue;
        replaceCurrentSlideInPreview("slide-padding");
      }


      function cleanupAssetResolver() {
        (state.assetObjectUrls || []).forEach((url) => {
          revokeEditorObjectUrl(url, "asset-resolver-url-revoke-failed");
        });
        state.assetObjectUrls = [];
        state.assetResolverMap = null;
        state.assetResolverLabel = "";
        state.assetFileCount = 0;
      }

      function normalizeAssetPath(path) {
        let normalized = String(path || "").trim();
        try {
          normalized = decodeURIComponent(normalized);
        } catch (error) {
          // Malformed percent-encoding should not block raw-path normalization.
        }
        normalized = normalized
          .replace(/[#?].*$/, "")
          .replace(/\\/g, "/")
          .replace(/^\.\//, "")
          .replace(/^\/+/, "")
          .trim();
        return normalized;
      }

      function isExternalLikeUrl(value) {
        const trimmed = String(value || "").trim();
        return (
          !trimmed ||
          /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:|javascript:|mailto:|tel:)/i.test(
            trimmed,
          ) ||
          trimmed.startsWith("/")
        );
      }

      function isCssAsset(filePath, file) {
        return (
          /\.css(?:$|[?#])/i.test(filePath) ||
          String(file?.type || "").includes("text/css")
        );
      }

      function addAssetResolverVariants(map, filePath, url) {
        const normalized = normalizeAssetPath(filePath);
        if (!normalized) return;
        const variants = new Set([normalized, "./" + normalized]);
        const parts = normalized.split("/");
        if (parts.length > 1) variants.add(parts.slice(1).join("/"));
        variants.forEach((variant) => map.set(variant, url));
      }

      function resolveAssetCandidatePath(rawPath, baseDir = "") {
        const value = normalizeAssetPath(rawPath);
        if (!value) return "";
        if (!baseDir) return value;
        try {
          const baseUrl = new URL(
            baseDir.endsWith("/") ? baseDir : baseDir + "/",
            "https://assets.invalid/",
          );
          const resolved = new URL(value, baseUrl);
          return normalizeAssetPath(resolved.pathname.replace(/^\//, ""));
        } catch (error) {
          return normalizeAssetPath(baseDir.replace(/\/?$/, "/") + value);
        }
      }

      function rewriteCssImportsInText(cssText, baseDir = "") {
        return String(cssText || "").replace(
          /@import\s+(url\()?\s*(['"]?)([^'"\)\s]+)\2\s*\)?/gi,
          (full, urlWrapper, quote, rawUrl) => {
            if (isExternalLikeUrl(rawUrl)) return full;
            const resolved = resolveAssetObjectUrl(rawUrl, baseDir);
            if (!resolved) return full;
            return full.replace(rawUrl, resolved);
          },
        );
      }

      function rewriteCssUrlsInText(cssText, baseDir = "") {
        let next = rewriteCssImportsInText(cssText, baseDir);
        next = next.replace(
          /url\((['"]?)([^'"\)]+)\1\)/gi,
          (full, quote, rawUrl) => {
            if (isExternalLikeUrl(rawUrl)) return full;
            const resolved = resolveAssetObjectUrl(rawUrl, baseDir);
            if (!resolved) return full;
            return `url(${quote || '"'}${resolved}${quote || '"'})`;
          },
        );
        return next;
      }

      function rewriteSrcsetValue(srcset, baseDir = "") {
        return String(srcset || "")
          .split(",")
          .map((part) => {
            const trimmed = part.trim();
            if (!trimmed) return trimmed;
            const pieces = trimmed.split(/\s+/);
            const rawUrl = pieces.shift();
            if (!rawUrl || isExternalLikeUrl(rawUrl)) return trimmed;
            const resolved = resolveAssetObjectUrl(rawUrl, baseDir);
            return resolved ? [resolved, ...pieces].join(" ") : trimmed;
          })
          .join(", ");
      }

      function resolveAssetObjectUrl(rawPath, baseDir = "") {
        if (!state.assetResolverMap) return null;
        const direct = normalizeAssetPath(rawPath);
        if (state.assetResolverMap.has(direct))
          return state.assetResolverMap.get(direct);
        const candidate = resolveAssetCandidatePath(rawPath, baseDir);
        if (state.assetResolverMap.has(candidate))
          return state.assetResolverMap.get(candidate);
        const withoutDot = candidate.replace(/^\.\//, "");
        if (state.assetResolverMap.has(withoutDot))
          return state.assetResolverMap.get(withoutDot);
        return null;
      }

      async function setAssetDirectoryFromFiles(files) {
        const list = Array.from(files || []);
        cleanupAssetResolver();
        if (!list.length) {
          updateAssetDirectoryStatus();
          if (state.modelDoc) rebuildPreviewKeepingContext(state.activeSlideId);
          return;
        }
        const fileByPath = new Map();
        list.forEach((file) => {
          const filePath = normalizeAssetPath(
            file.webkitRelativePath || file.name,
          );
          if (filePath) fileByPath.set(filePath, file);
        });
        const finalMap = new Map();
        const rawUrlMap = new Map();
        const objectUrls = [];
        for (const [filePath, file] of fileByPath.entries()) {
          if (isCssAsset(filePath, file)) continue;
          const objectUrl = URL.createObjectURL(file);
          rawUrlMap.set(filePath, objectUrl);
          objectUrls.push(objectUrl);
          addAssetResolverVariants(finalMap, filePath, objectUrl);
        }
        for (const [filePath, file] of fileByPath.entries()) {
          if (!isCssAsset(filePath, file)) continue;
          let cssText = await file.text();
          const baseDir = filePath.includes("/")
            ? filePath.slice(0, filePath.lastIndexOf("/") + 1)
            : "";
          cssText = rewriteCssImportsInText(cssText, baseDir).replace(
            /url\((['"]?)([^'"\)]+)\1\)/gi,
            (full, quote, rawUrl) => {
              if (isExternalLikeUrl(rawUrl)) return full;
              const candidate = resolveAssetCandidatePath(rawUrl, baseDir);
              const resolved =
                rawUrlMap.get(candidate) ||
                finalMap.get(candidate) ||
                resolveAssetObjectUrl(candidate, "");
              if (!resolved) return full;
              return `url(${quote || '"'}${resolved}${quote || '"'})`;
            },
          );
          const cssObjectUrl = URL.createObjectURL(
            new Blob([cssText], { type: "text/css;charset=utf-8" }),
          );
          objectUrls.push(cssObjectUrl);
          addAssetResolverVariants(finalMap, filePath, cssObjectUrl);
        }
        state.assetObjectUrls = objectUrls;
        state.assetResolverMap = finalMap;
        state.assetFileCount = list.length;
        const firstLabel =
          normalizeAssetPath(list[0].webkitRelativePath || list[0].name).split(
            "/",
          )[0] || "assets";
        state.assetResolverLabel = `${firstLabel} · ${list.length} файлов`;
        updateAssetDirectoryStatus();
        showToast(`Подключено ресурсов: ${list.length}.`, "success", {
          title: "Папка ресурсов",
        });
        if (state.modelDoc) rebuildPreviewKeepingContext(state.activeSlideId);
      }

      function formatAssetSampleInline(items, limit = 3) {
        const list = Array.from(items || []).slice(0, limit);
        if (!list.length) return "";
        return list.map((item) => escapeHtml(item)).join(", ");
      }

      function formatAssetAuditSummary(audit, options = {}) {
        const sourceAudit = audit || createEmptyPreviewAssetAudit();
        const includeZeroes = options.includeZeroes === true;
        const includeSamples = options.includeSamples === true;
        const categories = [
          ["resolved", "resolved"],
          ["baseUrlDependent", "base-url"],
          ["unresolved", "unresolved"],
        ];
        const parts = [];
        categories.forEach(([key, label]) => {
          const count = Number(
            sourceAudit?.counts?.[key] ?? sourceAudit?.[key]?.length ?? 0,
          );
          if (!includeZeroes && count <= 0) return;
          let part = `${label}: ${count}`;
          if (includeSamples) {
            const sample = formatAssetSampleInline(sourceAudit?.[key] || [], 2);
            if (sample) part += ` (${sample})`;
          }
          parts.push(part);
        });
        return parts.join(" • ");
      }

      function formatUnresolvedAssetsInline(limit = 3) {
        return formatAssetSampleInline(state.unresolvedPreviewAssets, limit);
      }

      function updateAssetDirectoryStatus() {
        if (!els.assetDirectoryStatus) return;
        const unresolvedCount = state.unresolvedPreviewAssets?.length || 0;
        const unresolvedPreview = formatUnresolvedAssetsInline();
        const baseUrlDependentCount = state.baseUrlDependentAssets?.length || 0;
        const baseUrlPreview = Array.from(state.baseUrlDependentAssets || [])
          .slice(0, 3)
          .map((item) => escapeHtml(item))
          .join(", ");
        if (!state.assetFileCount && !unresolvedCount && baseUrlDependentCount) {
          els.assetDirectoryStatus.innerHTML = `Папка ресурсов не выбрана. <span class="small-note">Часть относительных ссылок сейчас идёт через Base URL: ${baseUrlDependentCount}${baseUrlPreview ? ` — ${baseUrlPreview}` : ""}.</span>`;
          return;
        }
        if (state.assetFileCount && !unresolvedCount && baseUrlDependentCount) {
          els.assetDirectoryStatus.innerHTML = `<strong>${escapeHtml(state.assetResolverLabel || "Ресурсы подключены")}</strong><span class="small-note">Папка уже закрывает часть относительных путей, остальные пока идут через Base URL: ${baseUrlDependentCount}${baseUrlPreview ? ` — ${baseUrlPreview}` : ""}.</span>`;
          return;
        }
        if (!state.assetFileCount) {
          els.assetDirectoryStatus.innerHTML = unresolvedCount
            ? `Папка ресурсов не выбрана. <span class="small-note">Неразрешённых относительных ссылок: ${unresolvedCount}${unresolvedPreview ? ` — ${unresolvedPreview}` : ""}.</span>`
            : "Папка ресурсов не выбрана.";
          return;
        }
        els.assetDirectoryStatus.innerHTML = unresolvedCount
          ? `<strong>${escapeHtml(state.assetResolverLabel || "Ресурсы подключены")}</strong><span class="small-note">Preview использует найденные относительные файлы, но ещё осталось ссылок без резолва: ${unresolvedCount}${unresolvedPreview ? ` — ${unresolvedPreview}` : ""}.</span>`
          : `<strong>${escapeHtml(state.assetResolverLabel || "Ресурсы подключены")}</strong><span class="small-note">Preview использует найденные относительные файлы.</span>`;
      }

      function applyAssetResolverToPreviewDoc(doc) {
        if (!state.assetResolverMap || !doc) return;
        doc
          .querySelectorAll("[src], [href], [poster], [srcset], [style]")
          .forEach((el) => {
            ["src", "href", "poster"].forEach((attr) => {
              const value = el.getAttribute(attr);
              if (!value || isExternalLikeUrl(value)) return;
              const resolved = resolveAssetObjectUrl(value);
              if (resolved) el.setAttribute(attr, resolved);
            });
            if (el.hasAttribute("srcset")) {
              el.setAttribute(
                "srcset",
                rewriteSrcsetValue(el.getAttribute("srcset") || ""),
              );
            }
            if (el.hasAttribute("style")) {
              el.setAttribute(
                "style",
                rewriteCssUrlsInText(el.getAttribute("style") || ""),
              );
            }
          });
        doc.querySelectorAll("style").forEach((styleTag) => {
          styleTag.textContent = rewriteCssUrlsInText(
            styleTag.textContent || "",
          );
        });
      }

      function extractRelativeUrlsFromCssText(cssText) {
        const urls = [];
        String(cssText || "")
          .replace(/url\((['"]?)([^'"\)]+)\1\)/gi, (full, quote, rawUrl) => {
            if (!isExternalLikeUrl(rawUrl)) urls.push(rawUrl);
            return full;
          })
          .replace(
            /@import\s+(?:url\()?\s*(['"]?)([^'"\)\s]+)\1\s*\)?/gi,
            (full, quote, rawUrl) => {
              if (!isExternalLikeUrl(rawUrl)) urls.push(rawUrl);
              return full;
            },
          );
        return urls;
      }

      function extractRelativeUrlsFromSrcsetValue(srcset) {
        return String(srcset || "")
          .split(",")
          .map((entry) => entry.trim().split(/\s+/)[0])
          .filter((value) => value && !isExternalLikeUrl(value));
      }

      function collectUnresolvedPreviewAssets(doc, options = {}) {
        return collectPreviewAssetAudit(doc, options).unresolved;
      }

      function collectPreviewAssetAudit(doc, options = {}) {
        if (!doc) {
          return createEmptyPreviewAssetAudit();
        }
        const manualBaseUrl = String(
          options.baseHref ?? state.manualBaseUrl ?? "",
        ).trim();
        const resolved = new Set();
        const unresolved = new Set();
        const baseUrlDependent = new Set();
        const pushRelative = (value) => {
          const normalized = normalizeAssetPath(value);
          if (!normalized) return;
          if (resolveAssetObjectUrl(normalized)) {
            resolved.add(normalized);
            return;
          }
          if (manualBaseUrl) {
            baseUrlDependent.add(normalized);
            return;
          }
          unresolved.add(normalized);
        };
        doc.querySelectorAll("[src], [href], [poster]").forEach((el) => {
          ["src", "href", "poster"].forEach((attr) => {
            const value = el.getAttribute(attr);
            if (!value || isExternalLikeUrl(value)) return;
            pushRelative(value);
          });
        });
        doc.querySelectorAll("[srcset]").forEach((el) => {
          extractRelativeUrlsFromSrcsetValue(el.getAttribute("srcset") || "").forEach(
            pushRelative,
          );
        });
        doc.querySelectorAll("[style]").forEach((el) => {
          extractRelativeUrlsFromCssText(el.getAttribute("style") || "").forEach(
            pushRelative,
          );
        });
        doc.querySelectorAll("style").forEach((styleTag) => {
          extractRelativeUrlsFromCssText(styleTag.textContent || "").forEach(
            pushRelative,
          );
        });
        return {
          resolved: Array.from(resolved).slice(0, 24),
          unresolved: Array.from(unresolved).slice(0, 24),
          baseUrlDependent: Array.from(baseUrlDependent).slice(0, 24),
          counts: {
            resolved: resolved.size,
            unresolved: unresolved.size,
            baseUrlDependent: baseUrlDependent.size,
          },
        };
      }

      function updatePreviewAssetAuditFromAudit(audit) {
        const safeAudit = audit || createEmptyPreviewAssetAudit();
        state.resolvedPreviewAssets = safeAudit.resolved;
        state.unresolvedPreviewAssets = safeAudit.unresolved;
        window.updateBrokenAssetBanner?.(); // WO-24: render broken-asset banner on state update
        state.baseUrlDependentAssets = safeAudit.baseUrlDependent;
        state.previewAssetAuditCounts = {
          resolved: Number(safeAudit?.counts?.resolved || 0),
          unresolved: Number(safeAudit?.counts?.unresolved || 0),
          baseUrlDependent: Number(safeAudit?.counts?.baseUrlDependent || 0),
        };
      }

      function updatePreviewAssetAudit(doc, options = {}) {
        const audit = collectPreviewAssetAudit(doc, options);
        updatePreviewAssetAuditFromAudit(audit);
      }

      function buildPreviewHtml() {
        return buildPreviewPackage()?.serialized || "";
      }

      function openVideoInsertModal() {
        if (!state.modelDoc) {
          openOpenHtmlModal();
          return;
        }
        if (state.mode !== "edit") setMode("edit");
        closeInsertPalette();
        setInteractionMode("insert");
        els.videoFileInput.value = "";
        els.videoUrlInput.value = "";
        clearVideoInsertStatus();
        openModal(els.videoInsertModal);
      }

      function buildVideoHtmlFromSource(rawSource) {
        const source = String(rawSource || "").trim();
        if (!source) return "";
        const embed = toVideoEmbedUrl(source);
        if (embed) {
          return `<iframe src="${escapeHtml(embed)}" title="Embedded video" style="width:640px; max-width:100%; height:360px; border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
        }
        const directFileLike =
          /\.(mp4|webm|ogg|ogv|mov)(?:[?#].*)?$/i.test(source) ||
          /^(?:\.\.?\/|[a-z0-9_\-./]+\.(mp4|webm|ogg|ogv|mov))(?:[?#].*)?$/i.test(
            source,
          );
        if (directFileLike) {
          return `<video controls playsinline preload="metadata" style="display:block; width:640px; max-width:100%; height:auto;" src="${escapeHtml(source)}"></video>`;
        }
        return "";
      }

      async function insertVideoFromSelectedFile() {
        clearVideoInsertStatus();
        const file = els.videoFileInput.files?.[0];
        if (!file) {
          setVideoInsertStatus("Сначала выбери видеофайл.", "warning");
          els.videoFileInput?.focus();
          return;
        }
        const MAX_INLINE_VIDEO_BYTES = 12 * 1024 * 1024;
        if (file.size > MAX_INLINE_VIDEO_BYTES) {
          showToast(
            "Локальное видео больше 12 МБ. Для переносимого HTML лучше использовать ссылку на mp4/webm или относительный путь из папки проекта.",
            "warning",
            { title: "Видео слишком большое", ttl: 4200 },
          );
          return;
        }
        try {
          const dataUrl = await fileToDataUrl(file);
          const html = `<video controls playsinline preload="metadata" style="display:block; width:640px; max-width:100%; height:auto;" src="${escapeHtml(dataUrl)}"></video>`;
          insertHtmlViaBridge(html, { focusText: false });
          clearVideoInsertStatus();
          closeModal(els.videoInsertModal);
          showToast("Локальное видео вставлено на слайд.", "success", {
            title: "Медиа",
          });
        } catch (error) {
          reportShellWarning("video-file-read-failed", error, {
            once: true,
            diagnostic: false,
          });
          setVideoInsertStatus("Не удалось прочитать видеофайл.", "error");
        }
      }

      function insertVideoFromUrlInput() {
        clearVideoInsertStatus();
        const html = buildVideoHtmlFromSource(els.videoUrlInput.value.trim());
        if (!html) {
          setVideoInsertStatus(
            "Поддерживаются YouTube, Vimeo и прямые ссылки на MP4/WebM/Ogg/MOV.",
            "warning",
          );
          els.videoUrlInput?.focus();
          return;
        }
        insertHtmlViaBridge(html, { focusText: false });
        clearVideoInsertStatus();
        closeModal(els.videoInsertModal);
        showToast("Видео добавлено на слайд.", "success", { title: "Медиа" });
      }

      function insertVideoByPrompt() {
        openVideoInsertModal();
      }

      function performPaletteAction(action) {
        if (!state.modelDoc) return;
        if (state.mode !== "edit") setMode("edit");
        let handled = true;
        switch (action) {
          case "heading":
            insertHeadingBlock(1);
            break;
          case "subheading":
            insertHeadingBlock(2);
            break;
          case "text":
            insertDefaultTextBlock();
            break;
          case "image":
            requestImageInsert("insert");
            break;
          case "video":
            openVideoInsertModal();
            break;
          case "box":
            insertSimpleBox();
            break;
          case "layout-two-col":
            insertLayoutPreset("two-col");
            break;
          default:
            handled = false;
        }
        if (handled && action !== "video") closeInsertPalette();
      }

      // =====================================================================
