      // ZONE: Feedback & Notifications
      // Toast notifications, flash, diagnostics surface
      // =====================================================================
      function showToast(message, type = "info", options = {}) {
        if (!els.toastContainer) return;
        state.activeToastId += 1;
        const id = `toast-${state.activeToastId}`;
        const toast = document.createElement("div");
        toast.className = `toast is-${type}`;
        toast.dataset.toastId = id;
        const icon =
          type === "success"
            ? "✅"
            : type === "warning"
              ? "⚠️"
              : type === "error"
                ? "⛔"
                : "ℹ️";
        const actionHtml = options.actionLabel
          ? `<div class="toast-actions"><button type="button" class="ghost-btn toast-action-btn">${escapeHtml(options.actionLabel)}</button></div>`
          : "";
        toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div>
          <strong>${escapeHtml(options.title || "Действие выполнено")}</strong>
          <div>${escapeHtml(message)}</div>
          ${actionHtml}
        </div>
        <button type="button" class="toast-close" aria-label="Закрыть">×</button>
      `;
        const removeToast = () => {
          if (toast.isConnected) toast.remove();
        };
        toast
          .querySelector(".toast-close")
          .addEventListener("click", removeToast);
        const actionBtn = toast.querySelector(".toast-action-btn");
        if (actionBtn && typeof options.onAction === "function") {
          actionBtn.addEventListener("click", () => {
            try {
              options.onAction();
            } finally {
              if (options.closeOnAction !== false) removeToast();
            }
          });
        }
        els.toastContainer.appendChild(toast);
        while (els.toastContainer.children.length > MAX_VISIBLE_TOASTS) {
          els.toastContainer.firstElementChild?.remove();
        }
        const ttl = Number(options.ttl || (type === "error" ? 5200 : 2600));
        window.setTimeout(removeToast, ttl);
      }

      // Surface mutex moved to surface-manager.js (WO-23 — PAIN-MAP P1-09, P2-09).
      // closeTransientShellUi + normalizeShellSurfaceKeep remain callable via shared global.

      function readShellMetricVar(name, fallback = 0) {
        const value = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(name),
        );
        return Number.isFinite(value) ? value : fallback;
      }

      function getShellInlineSize() {
        return Math.max(
          0,
          Math.round(window.innerWidth || document.documentElement.clientWidth || 0),
        );
      }

      function getShellLayoutMetrics() {
        const shellWidth = getShellInlineSize();
        const previewWidth = getPreviewStageInlineSize();
        const compactShell = isCompactShell();
        return {
          shellWidth,
          previewWidth,
          compactShell,
          popoverSheet:
            shellWidth <= 820 ||
            (compactShell && previewWidth > 0 && previewWidth < 760),
          contextMenuSheet:
            shellWidth <= 640 ||
            (compactShell && previewWidth > 0 && previewWidth < 540),
          toolbarCompact:
            compactShell &&
            (shellWidth <= 820 || (previewWidth > 0 && previewWidth < 760)),
        };
      }

      function measureTopbarCommandClusterInlineWidth() {
        if (!els.topbarCommandCluster) return 0;
        const previousMode = document.body.dataset.topbarCommandMode || "inline";
        const shouldForceInlineMeasure = previousMode === "overflow";
        if (shouldForceInlineMeasure) {
          document.body.dataset.topbarCommandMode = "inline";
        }
        const buttons = Array.from(els.topbarCommandCluster.children).filter(
          (node) => node instanceof HTMLElement,
        );
        const clusterStyle = getComputedStyle(els.topbarCommandCluster);
        const gap = parseFloat(clusterStyle.columnGap || clusterStyle.gap || "0");
        const totalWidth = buttons.reduce((sum, button) => {
          return sum + Math.ceil(button.getBoundingClientRect().width || 0);
        }, 0);
        if (shouldForceInlineMeasure) {
          document.body.dataset.topbarCommandMode = previousMode;
        }
        if (!buttons.length) return 0;
        return totalWidth + Math.max(0, buttons.length - 1) * (Number.isFinite(gap) ? gap : 0);
      }

      function computeTopbarCommandMode() {
        if (
          !els.topbar ||
          !els.topbarIdentity ||
          !els.topbarCenter ||
          !els.topbarCommandCluster
        ) {
          return "inline";
        }
        const workflow = state.editorWorkflow || getEditorWorkflowState();
        return workflow === "empty" ? "inline" : "overflow";
      }

      function syncTopbarCommandMode() {
        const nextMode = computeTopbarCommandMode();
        state.topbarCommandMode = nextMode;
        document.body.dataset.topbarCommandMode = nextMode;
        if (nextMode !== "overflow" && isTopbarOverflowOpen()) {
          closeTopbarOverflow();
        }
      }

      function getShellViewportInsets() {
        const inset = readShellMetricVar("--shell-popover-inset", 12);
        return {
          top: readShellMetricVar("--shell-top-offset", 64) + inset,
          right: inset,
          bottom: (getShellLayoutMetrics().compactShell
            ? readShellMetricVar("--mobile-rail-offset", 0)
            : 0) + inset,
          left: inset,
        };
      }

      function getEditorWorkflowState() {
        if (!state.modelDoc) return "empty";
        return state.mode === "edit" ? "loaded-edit" : "loaded-preview";
      }

      function syncEditorWorkflowUi(
        hasPresentation = Boolean(state.modelDoc),
      ) {
        const workflow = getEditorWorkflowState();
        state.editorWorkflow = workflow;
        document.body.dataset.editorWorkflow = workflow;
        const suggestEdit =
          workflow === "loaded-preview" &&
          hasPresentation &&
          state.editingSupported;
        const showPreviewActions = workflow !== "empty";
        [els.reloadPreviewBtn, els.toggleInsertPaletteBtn].forEach((control) => {
          if (!(control instanceof HTMLElement)) return;
          control.hidden = !showPreviewActions;
          control.setAttribute(
            "aria-hidden",
            showPreviewActions ? "false" : "true",
          );
        });
        els.editModeBtn?.classList.toggle("is-suggested", suggestEdit);
        els.mobileEditBtn?.classList.toggle("is-suggested", suggestEdit);
      }

      function prefersShellPopoverSheetMode() {
        return getShellLayoutMetrics().popoverSheet;
      }

      function getPreviewStageInlineSize() {
        return Math.max(
          0,
          Math.round(els.previewStage?.getBoundingClientRect().width || 0),
        );
      }

      function prefersCompactFloatingToolbar() {
        return getShellLayoutMetrics().toolbarCompact;
      }

      function prefersContextMenuSheetMode() {
        return getShellLayoutMetrics().contextMenuSheet;
      }

      function syncOverlayChromeModes() {
        const layout = getShellLayoutMetrics();
        const compactToolbar = layout.toolbarCompact;
        document.body.dataset.toolbarLayout = compactToolbar
          ? "compact"
          : "floating";
        document.body.dataset.contextMenuLayout = layout.contextMenuSheet
          ? "sheet"
          : "floating";
        if (compactToolbar) {
          state.toolbarPinned = false;
          state.toolbarPos = null;
        }
      }

      function syncShellViewportLock() {
        const layout = getShellLayoutMetrics();
        const shouldLock =
          layout.compactShell && (state.leftPanelOpen || state.rightPanelOpen);
        document.body.dataset.shellLocked = shouldLock ? "true" : "false";
        document.body.dataset.shellPopoverMode = layout.popoverSheet
          ? "sheet"
          : "anchored";
        syncOverlayChromeModes();
      }

      function syncShellChromeMetrics() {
        const topbarHeight = Math.max(
          64,
          Math.ceil(els.topbar?.offsetHeight || 64),
        );
        const railVisible = Boolean(
          els.mobileCommandRail &&
            getComputedStyle(els.mobileCommandRail).display !== "none",
        );
        const railHeight = railVisible
          ? Math.ceil(els.mobileCommandRail.offsetHeight || 0)
          : 0;
        document.documentElement.style.setProperty(
          "--shell-top-offset",
          `${topbarHeight}px`,
        );
        document.documentElement.style.setProperty(
          "--mobile-rail-offset",
          `${railHeight}px`,
        );
        syncTopbarCommandMode();
        syncShellViewportLock();
        scheduleShellPopoverLayout();
      }

      function scheduleShellChromeMetrics() {
        if (state.shellMetricsRaf) return;
        state.shellMetricsRaf = requestAnimationFrame(() => {
          state.shellMetricsRaf = 0;
          syncShellChromeMetrics();
        });
      }

      function positionAnchoredPopover(popoverEl, triggerEl, options = {}) {
        if (!popoverEl || !triggerEl) return;
        const layout = getShellLayoutMetrics();
        const triggerRect = triggerEl.getBoundingClientRect();
        const gap = Number(options.gap || 8);
        const align = options.align === "start" ? "start" : "end";
        const insets = getShellViewportInsets();
        popoverEl.style.left = "0px";
        popoverEl.style.top = "0px";
        popoverEl.style.right = layout.popoverSheet
          ? `${Math.round(insets.right)}px`
          : "auto";
        popoverEl.style.visibility = "hidden";
        const width =
          popoverEl.offsetWidth || Number(options.fallbackWidth || 320);
        const height =
          popoverEl.offsetHeight || Number(options.fallbackHeight || 220);
        const positionAsSheet = () => {
          const sheetWidth = Math.max(
            0,
            Math.round(window.innerWidth - insets.left - insets.right),
          );
          popoverEl.style.width = `${sheetWidth}px`;
          const x = insets.left;
          const y = Math.max(
            insets.top,
            window.innerHeight - insets.bottom - height,
          );
          popoverEl.style.left = `${Math.round(x)}px`;
          popoverEl.style.right = `${Math.round(insets.right)}px`;
          popoverEl.style.top = `${Math.round(y)}px`;
          popoverEl.style.visibility = "";
          clampPopoverPosition(popoverEl, insets);
        };
        if (!triggerRect.width && !triggerRect.height) {
          if (layout.popoverSheet || layout.compactShell) {
            positionAsSheet();
            return;
          }
          popoverEl.style.left = "-9999px";
          popoverEl.style.top = "-9999px";
          return;
        }
        if (layout.popoverSheet) {
          positionAsSheet();
          return;
        }
        popoverEl.style.width = "";
        let x =
          align === "start" ? triggerRect.left : triggerRect.right - width;
        const fitsBelow =
          triggerRect.bottom + gap + height <= window.innerHeight - insets.bottom;
        const fitsAbove =
          triggerRect.top - gap - height >= insets.top;
        let y = fitsBelow
          ? triggerRect.bottom + gap
          : fitsAbove
            ? triggerRect.top - height - gap
            : Math.max(
                insets.top,
                Math.min(
                  triggerRect.bottom + gap,
                  window.innerHeight - insets.bottom - height,
                ),
              );
        x = Math.max(
          insets.left,
          Math.min(window.innerWidth - insets.right - width, x),
        );
        y = Math.max(
          insets.top,
          Math.min(window.innerHeight - insets.bottom - height, y),
        );
        popoverEl.style.left = `${Math.round(x)}px`;
        popoverEl.style.top = `${Math.round(y)}px`;
        popoverEl.style.visibility = "";
        clampPopoverPosition(popoverEl, insets);
      }

      function clampPopoverPosition(popoverEl, insets = getShellViewportInsets()) {
        if (!popoverEl) return;
        const rect = popoverEl.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const nextLeft = Math.max(
          insets.left,
          Math.min(window.innerWidth - insets.right - rect.width, rect.left),
        );
        const nextTop = Math.max(
          insets.top,
          Math.min(window.innerHeight - insets.bottom - rect.height, rect.top),
        );
        if (Math.abs(nextLeft - rect.left) > 0.5) {
          popoverEl.style.left = `${Math.round(nextLeft)}px`;
        }
        if (Math.abs(nextTop - rect.top) > 0.5) {
          popoverEl.style.top = `${Math.round(nextTop)}px`;
        }
      }

      function syncShellPopoverLayout() {
        if (isTopbarOverflowOpen()) {
          positionAnchoredPopover(els.topbarOverflowMenu, els.topbarOverflowBtn, {
            align: "end",
            fallbackWidth: 240,
            fallbackHeight: 160,
          });
        }
        if (isInsertPaletteOpen()) {
          positionAnchoredPopover(els.quickPalette, els.toggleInsertPaletteBtn, {
            align: "end",
            fallbackWidth: 420,
          });
        }
        if (isSlideTemplateBarOpen()) {
          positionAnchoredPopover(
            els.slideTemplateBar,
            els.toggleSlideTemplateBarBtn,
            {
              align: "end",
              fallbackWidth: 360,
            },
          );
        }
      }

      function scheduleShellPopoverLayout() {
        if (state.shellPopoverRaf) return;
        state.shellPopoverRaf = requestAnimationFrame(() => {
          state.shellPopoverRaf = 0;
          syncShellPopoverLayout();
        });
      }

      function bindShellChromeMetrics() {
        if (window.ResizeObserver) {
          state.shellChromeObserver?.disconnect?.();
          state.shellChromeObserver = new ResizeObserver(() => {
            scheduleShellChromeMetrics();
          });
          [els.topbar, els.mobileCommandRail].forEach((el) => {
            if (el) state.shellChromeObserver.observe(el);
          });
        }
        if (window.visualViewport && !state.shellViewportBound) {
          window.visualViewport.addEventListener(
            "resize",
            scheduleShellChromeMetrics,
          );
          window.visualViewport.addEventListener(
            "scroll",
            scheduleShellChromeMetrics,
          );
          state.shellViewportBound = true;
        }
        window.addEventListener("orientationchange", scheduleShellChromeMetrics);
        window.addEventListener("load", scheduleShellChromeMetrics, {
          once: true,
        });
        scheduleShellChromeMetrics();
      }

      /* ======================================================================
       [SCRIPT 05] floating toolbar + context menu + insert palette
       ====================================================================== */
      function getInteractionModeMeta(mode = state.interactionMode) {
        switch (mode) {
          case "select":
            return {
              label: "Выбор",
              className: "status-pill is-accent",
              title: "Можно выбирать элементы и менять свойства.",
            };
          case "text-edit":
            return {
              label: "Текст",
              className: "status-pill is-accent",
              title: "Редактируется текст выбранного элемента.",
            };
          case "insert":
            return {
              label: "Вставка",
              className: "status-pill is-warning",
              title: "Открыто меню вставки блоков.",
            };
          case "drag":
            return {
              label: "Перенос",
              className: "status-pill is-accent",
              title: "Элемент перемещается на холсте.",
            };
          case "resize":
            return {
              label: "Размер",
              className: "status-pill is-accent",
              title: "Размер выбранного элемента изменяется.",
            };
          default:
            return {
              label: "Просмотр",
              className: "status-pill",
              title: "Редактор не вмешивается в DOM презентации.",
            };
        }
      }

      function applyInteractionModeUi() {
        if (!els.interactionStatePill) return;
        const meta = getInteractionModeMeta();
        els.interactionStatePill.textContent = meta.label;
        els.interactionStatePill.className = meta.className;
        els.interactionStatePill.title = meta.title;
        document.body.dataset.interactionMode = state.interactionMode;
      }

      function setInteractionMode(mode) {
        const nextMode = INTERACTION_MODES.has(mode)
          ? mode
          : state.mode === "preview"
            ? "preview"
            : "select";
        state.interactionMode = nextMode;
        applyInteractionModeUi();
      }

      function syncInteractionModeFromState() {
        if (state.mode === "preview" || !state.modelDoc) {
          setInteractionMode("preview");
          return;
        }
        if (state.activeManipulation) {
          applyInteractionModeUi();
          return;
        }
        if (
          state.selectedFlags.isTextEditing &&
          state.selectedNodeId &&
          state.selectedFlags.canEditText
        ) {
          setInteractionMode("text-edit");
          return;
        }
        if (isInsertPaletteOpen()) {
          setInteractionMode("insert");
          return;
        }
        setInteractionMode("select");
      }

      function getSelectedModelNode() {
        if (!state.modelDoc || !state.selectedNodeId) return null;
        return state.modelDoc.querySelector(
          `[data-editor-node-id="${cssEscape(state.selectedNodeId)}"]`,
        );
      }
      /* ======================================================================
       selection/direct-manip feedback
       ====================================================================== */

      function getSelectedPreviewNode() {
        if (!state.selectedNodeId) return null;
        const doc = getPreviewDocument();
        if (!doc) return null;
        return doc.querySelector(
          `[data-editor-node-id="${cssEscape(state.selectedNodeId)}"]`,
        );
      }

      function clearInlineVisibilityProperties(node) {
        if (!(node instanceof HTMLElement)) return false;
        let changed = false;
        if (node.style.display === "none") {
          node.style.removeProperty("display");
          changed = true;
        }
        if (node.style.visibility === "hidden") {
          node.style.removeProperty("visibility");
          changed = true;
        }
        if (!node.getAttribute("style")) node.removeAttribute("style");
        return changed;
      }

      function restoreSelectedElementVisibility() {
        const nodeId = state.selectedNodeId;
        const modelNode = getSelectedModelNode();
        if (!nodeId || !(modelNode instanceof HTMLElement)) return false;

        const attrs = {};
        let changedAuthorState = false;

        if (modelNode.hasAttribute("hidden")) {
          modelNode.removeAttribute("hidden");
          attrs.hidden = null;
          changedAuthorState = true;
        }
        if (modelNode.getAttribute("aria-hidden") === "true") {
          modelNode.setAttribute("aria-hidden", "false");
          attrs["aria-hidden"] = "false";
          changedAuthorState = true;
        }
        if (clearInlineVisibilityProperties(modelNode)) {
          attrs.style = modelNode.getAttribute("style") || null;
          changedAuthorState = true;
        }

        if (changedAuthorState) {
          setLayerSessionVisibility(nodeId, false);
          sendToBridge("update-attributes", { nodeId, attrs });
          recordHistoryChange(`restore-visibility:${nodeId}`);
          refreshUi();
          showToast("Скрытый элемент снова показан.", "success", {
            title: "Видимость",
          });
          return true;
        }

        const previewNode = getSelectedPreviewNode();
        if (state.sessionVisibilityMap?.[nodeId]) {
          setLayerSessionVisibility(nodeId, false);
          if (
            previewNode instanceof HTMLElement &&
            getComputedStyle(previewNode).visibility === "hidden"
          ) {
            sendToBridge("toggle-visibility", { nodeId });
          }
          refreshUi();
          showToast("Сессионное скрытие снято.", "success", {
            title: "Видимость",
          });
          return true;
        }
        if (
          previewNode instanceof HTMLElement &&
          getComputedStyle(previewNode).visibility === "hidden"
        ) {
          setLayerSessionVisibility(nodeId, false);
          sendToBridge("toggle-visibility", { nodeId });
          refreshUi();
          showToast("Сессионное скрытие снято.", "success", {
            title: "Видимость",
          });
          return true;
        }

        showToast("Элемент уже видим.", "info", {
          title: "Видимость",
        });
        return false;
      }

      function cloneRect(rect) {
        if (!rect) return null;
        const left = Number(rect.left || 0);
        const top = Number(rect.top || 0);
        const width = Math.max(0, Number(rect.width || 0));
        const height = Math.max(0, Number(rect.height || 0));
        return {
          left,
          top,
          width,
          height,
          right: left + width,
          bottom: top + height,
          centerX: left + width / 2,
          centerY: top + height / 2,
        };
      }

      // [v0.19.0 ADR-001] Block reason protocol
      function getBlockReason() {
        if (state.previewZoom !== 1) return "zoom";
        if (state.selectedNodeId && isLayerSessionHidden(state.selectedNodeId)) {
          return "hidden";
        }
        const selectedNode = getSelectedModelNode();
        if (selectedNode instanceof HTMLElement) {
          if (selectedNode.getAttribute("data-editor-locked") === "true") {
            return "locked";
          }
          if (
            selectedNode.hasAttribute("hidden") ||
            selectedNode.getAttribute("aria-hidden") === "true" ||
            selectedNode.style.display === "none" ||
            selectedNode.style.visibility === "hidden"
          ) {
            return "hidden";
          }
        }
        if (!state.manipulationContext) return "none";
        if (state.manipulationContext.directManipulationSafe === false) {
          const reason = String(state.manipulationContext.directManipulationReason || "").toLowerCase();
          if (reason.includes("собствен") || reason.includes("own transform")) return "own-transform";
          if (reason.includes("внутри transformed") || reason.includes("transformed-контейнера") ||
              reason.includes("inside transformed") || reason.includes("parent uses transform")) return "parent-transform";
          if (reason.includes("корневой контейнер слайда") || reason.includes("slide uses transform")) return "slide-transform";
          if (reason.includes("zoom")) return "zoom";
          return "transform";
        }
        const entityKind = state.selectedEntityKind || "none";
        if (entityKind === "container" || entityKind === "slide-root") return "none";
        return "none";
      }

      function getBlockReasonLabel(reason) {
        switch (reason) {
          case "zoom": return "Масштаб ≠ 100% — перемещение на холсте отключено";
          case "locked": return "🔒 Элемент заблокирован";
          case "own-transform": return "Используется transform — перемещение через инспектор";
          case "parent-transform": return "Родитель использует transform — перемещение через инспектор";
          case "slide-transform": return "Слайд использует transform — перемещение через инспектор";
          case "transform": return "Используется transform — перемещение через инспектор";
          case "hidden": return "Элемент скрыт (невидим в этой сессии)";
          default: return "";
        }
      }

      function getBlockReasonAction(reason) {
        switch (reason) {
          case "zoom": return { label: "Сбросить масштаб", action: "reset-zoom" };
          case "locked": return { label: "Разблокировать", action: "unlock" };
          case "hidden": return { label: "Показать", action: "show" };
          case "own-transform":
          case "parent-transform":
          case "slide-transform":
          case "transform":
            return { label: "Открыть инспектор", action: "resolve-transform" };
          default: return null;
        }
      }

      function hasBlockedDirectManipulationContext() {
        return getBlockReason() !== "none";
      }

      function clearSelectionTooltipTimer() {
        if (!state.selectionTooltip?.hideTimer) return;
        clearTimeout(state.selectionTooltip.hideTimer);
        state.selectionTooltip.hideTimer = 0;
      }

      function normaliseSelectionTooltipMessage(message, maxLength = 60) {
        const normalized = String(message || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!normalized) return "";
        const firstSentence =
          normalized.split(/(?<=[.!?])\s+/)[0]?.trim() || normalized;
        if (firstSentence.length <= maxLength) return firstSentence;
        return `${firstSentence.slice(0, maxLength - 3).trimEnd()}...`;
      }

      function getDirectManipulationTooltipMessage(kind = "drag") {
        const reason = String(
          state.manipulationContext?.directManipulationReason || "",
        ).trim();
        const normalizedReason = reason.toLowerCase();
        const actionLabel = kind === "resize" ? "resize" : "move";
        if (
          normalizedReason.includes("собствен") ||
          normalizedReason.includes("own transform")
        ) {
          return `Cannot ${actionLabel}: element uses transform`;
        }
        if (
          normalizedReason.includes("внутри transformed") ||
          normalizedReason.includes("transformed-контейнера") ||
          normalizedReason.includes("inside transformed") ||
          normalizedReason.includes("parent uses transform")
        ) {
          return `Cannot ${actionLabel}: parent uses transform`;
        }
        if (
          normalizedReason.includes("корневой контейнер слайда") ||
          normalizedReason.includes("slide uses transform")
        ) {
          return `Cannot ${actionLabel}: slide uses transform`;
        }
        if (reason) {
          return normaliseSelectionTooltipMessage(reason);
        }
        return kind === "resize"
          ? "Cannot resize: use inspector controls"
          : "Cannot move: use inspector controls";
      }

      function hideSelectionFrameTooltip(options = {}) {
        clearSelectionTooltipTimer();
        if (options.clearMessage) {
          state.selectionTooltip.message = "";
        }
        state.selectionTooltip.visibleUntil = 0;
        if (!els.selectionFrameTooltip) return;
        els.selectionFrameTooltip.classList.remove("is-visible");
        els.selectionFrameTooltip.setAttribute("aria-hidden", "true");
        if (options.clearMessage) {
          els.selectionFrameTooltip.textContent = "";
        }
      }

      function showSelectionFrameTooltip(message, options = {}) {
        const nextMessage = normaliseSelectionTooltipMessage(message);
        if (!nextMessage) return;
        clearSelectionTooltipTimer();
        state.selectionTooltip.message = nextMessage;
        state.selectionTooltip.visibleUntil = Date.now() + 3000;
        state.selectionTooltip.hideTimer = window.setTimeout(() => {
          hideSelectionFrameTooltip({ clearMessage: true });
          renderSelectionOverlay();
        }, 3000);
        if (options.render !== false) {
          renderSelectionOverlay();
        }
      }

      function renderSelectionFrameTooltip(stageRect, visible) {
        if (!els.selectionFrameTooltip) return;
        const tooltipMessage = String(state.selectionTooltip?.message || "");
        const active =
          visible &&
          Boolean(tooltipMessage) &&
          Number(state.selectionTooltip?.visibleUntil || 0) > Date.now();
        if (!active || !stageRect) {
          els.selectionFrameTooltip.classList.remove("is-visible");
          els.selectionFrameTooltip.setAttribute("aria-hidden", "true");
          return;
        }
        els.selectionFrameTooltip.textContent = tooltipMessage;
        els.selectionFrameTooltip.classList.add("is-visible");
        els.selectionFrameTooltip.setAttribute("aria-hidden", "false");
      }

      function getDirectManipulationBlockMessage(kind = "drag") {
        return (
          String(state.manipulationContext?.directManipulationReason || "").trim() ||
          (kind === "resize"
            ? "Размер этого элемента нельзя менять прямо на холсте."
            : "Этот элемент нельзя свободно двигать прямо на холсте.")
        );
      }

      function canDirectManipulateSelection(kind = "drag") {
        const policy = state.selectedPolicy || createDefaultSelectionPolicy();
        const allowed = kind === "resize" ? policy.canResize : policy.canMove;
        return Boolean(
          state.mode === "edit" &&
            state.previewReady &&
            state.selectedNodeId &&
            getSelectionInteractionRect() &&
            allowed &&
            !hasBlockedDirectManipulationContext(),
        );
      }

      function getActiveSelectionRect() {
        return getSelectionInteractionRect();
      }

      function toStageRect(frameRect) {
        const rect = cloneRect(frameRect);
        if (!rect) return null;
        // CSS zoom property handles coordinate scaling natively (v0.18.3)
        // getBoundingClientRect() returns already-scaled values
        const iframeRect = els.previewFrame.getBoundingClientRect();
        const stageRect = els.previewStage.getBoundingClientRect();
        return cloneRect({
          left: iframeRect.left - stageRect.left + rect.left,
          top: iframeRect.top - stageRect.top + rect.top,
          width: rect.width,
          height: rect.height,
        });
      }

      function clipStageRectToPreviewViewport(frameRect) {
        const rect = cloneRect(frameRect);
        if (!rect) return null;
        const iframeRect = els.previewFrame.getBoundingClientRect();
        const stageRect = els.previewStage.getBoundingClientRect();
        const viewportLeft = iframeRect.left - stageRect.left;
        const viewportTop = iframeRect.top - stageRect.top;
        const viewportRight = viewportLeft + iframeRect.width;
        const viewportBottom = viewportTop + iframeRect.height;
        const nextLeft = Math.max(rect.left, viewportLeft);
        const nextTop = Math.max(rect.top, viewportTop);
        const nextRight = Math.min(rect.right, viewportRight);
        const nextBottom = Math.min(rect.bottom, viewportBottom);
        if (nextRight <= nextLeft || nextBottom <= nextTop) {
          return null;
        }
        return cloneRect({
          left: nextLeft,
          top: nextTop,
          width: nextRight - nextLeft,
          height: nextBottom - nextTop,
        });
      }

      function toStageAxisValue(axis, value) {
        // CSS zoom property handles coordinate scaling natively (v0.18.3)
        const iframeRect = els.previewFrame.getBoundingClientRect();
        const stageRect = els.previewStage.getBoundingClientRect();
        return axis === "x"
          ? iframeRect.left - stageRect.left + value
          : iframeRect.top - stageRect.top + value;
      }

      function clearSelectionGuides() {
        state.activeGuides = { vertical: [], horizontal: [] };
      }

      function renderSelectionGuides() {
        if (!els.selectionGuides) return;
        els.selectionGuides.innerHTML = "";
        const fragment = document.createDocumentFragment();
        state.activeGuides.vertical.forEach((value) => {
          if (!Number.isFinite(value)) return;
          const guide = document.createElement("div");
          guide.className = "selection-guide is-vertical";
          guide.style.left = `${toStageAxisValue("x", value)}px`;
          fragment.appendChild(guide);
        });
        state.activeGuides.horizontal.forEach((value) => {
          if (!Number.isFinite(value)) return;
          const guide = document.createElement("div");
          guide.className = "selection-guide is-horizontal";
          guide.style.top = `${toStageAxisValue("y", value)}px`;
          fragment.appendChild(guide);
        });
        els.selectionGuides.appendChild(fragment);
      }

      function shouldShowSelectionOverlay() {
        return Boolean(
          state.mode === "edit" &&
            state.previewReady &&
            state.selectedNodeId &&
            state.selectedRect &&
            !state.selectedFlags.isTextEditing,
        );
      }

      function getSelectionFrameLabel() {
        if (!state.selectedPolicy.canMove && !state.selectedPolicy.canResize)
          return state.selectedFlags.isSlideRoot ? "Слайд защищён" : "Только просмотр";
        if (hasBlockedDirectManipulationContext()) return "Через инспектор";
        if (state.activeManipulation?.kind === "resize") return "Размер";
        if (state.activeManipulation?.kind === "drag") return "Перемещение";
        const _kindLbl = getEntityKindLabel(state.selectedEntityKind);
        if (state.selectedFlags.canEditText)
          return _kindLbl ? `${_kindLbl} · Двойной клик → текст` : "Двойной клик → текст";
        return _kindLbl || "Переместить";
      }

      // =====================================================================
      // shellBoundary — Shell-level notification API (ADR-014 §Layer 1, WO-06)
      // Provides a non-blocking banner region (#shellBanner) for persistent
      // notifications (e.g. broken assets, sandbox warnings).
      //
      // API:
      //   window.shellBoundary.report(key, message, actions)
      //     key     — unique string key; calling report() again with same key replaces.
      //     message — plain text notification message (no HTML).
      //     actions — array of { label, action } objects for action buttons (optional).
      //   window.shellBoundary.clear(key)
      //     Removes the banner item for the given key. Hides region if empty.
      //
      // Actions are dispatched as CustomEvent("shellBannerAction", {detail:{action}}).
      // Dismiss button always available; calls clear(key).
      //
      // OWASP A05:2021 — Security Misconfiguration: surfacing broken-asset
      //   warnings enables users to make informed decisions before editing or
      //   exporting, reducing risk of incomplete/corrupted presentations.
      // =====================================================================
      window.shellBoundary = (function () {
        // keyed map of active banner items: key -> DOM element
        const _items = new Map();

        function _getRegion() {
          // Use els cache if available, otherwise fall back to getElementById.
          if (typeof els !== "undefined" && els.shellBanner) {
            return els.shellBanner;
          }
          return document.getElementById("shellBanner");
        }

        function _syncRegionVisibility() {
          const region = _getRegion();
          if (!region) return;
          if (_items.size === 0) {
            region.style.display = "none";
          } else {
            // Remove inline display:none so CSS flex layout takes over.
            region.style.display = "";
          }
        }

        function report(key, message, actions) {
          if (typeof key !== "string" || !key) return;
          if (typeof message !== "string") return;
          const region = _getRegion();
          if (!region) return;

          // Remove existing item for this key if present (replace pattern).
          if (_items.has(key)) {
            const old = _items.get(key);
            if (old.parentNode) old.parentNode.removeChild(old);
            _items.delete(key);
          }

          // Build banner item.
          const item = document.createElement("div");
          item.className = "shell-banner-item";
          item.dataset.bannerKey = key;

          // Message span — textContent only, no innerHTML (input validation).
          const msgEl = document.createElement("span");
          msgEl.className = "shell-banner-message";
          msgEl.textContent = message;
          item.appendChild(msgEl);

          // Action buttons.
          if (Array.isArray(actions) && actions.length > 0) {
            const actionsEl = document.createElement("span");
            actionsEl.className = "shell-banner-actions";
            actions.forEach(function (def) {
              if (!def || typeof def.label !== "string") return;
              const btn = document.createElement("button");
              btn.type = "button";
              btn.className = "shell-banner-action-btn";
              btn.textContent = def.label;
              btn.setAttribute("data-banner-action", def.action || "");
              btn.addEventListener("click", function () {
                window.dispatchEvent(
                  new CustomEvent("shellBannerAction", {
                    detail: { action: def.action, key: key },
                  })
                );
              });
              actionsEl.appendChild(btn);
            });
            item.appendChild(actionsEl);
          }

          // Dismiss button.
          const dismissBtn = document.createElement("button");
          dismissBtn.type = "button";
          dismissBtn.className = "shell-banner-dismiss";
          dismissBtn.setAttribute("aria-label", "Закрыть уведомление");
          dismissBtn.textContent = "×";
          dismissBtn.addEventListener("click", function () {
            clear(key);
          });
          item.appendChild(dismissBtn);

          region.appendChild(item);
          _items.set(key, item);
          _syncRegionVisibility();
        }

        function clear(key) {
          if (!_items.has(key)) return;
          const item = _items.get(key);
          if (item.parentNode) item.parentNode.removeChild(item);
          _items.delete(key);
          _syncRegionVisibility();
        }

        return { report: report, clear: clear };
      })();

      // =====================================================================
      // Broken-asset probe — WO-06, AUDIT-D-04
      // Collects asset URLs from the loaded presentation document and probes
      // them for 404/network errors. Surfaces a shell banner when broken
      // assets are found so the user can reconnect the asset folder.
      //
      // Two probe strategies:
      //   localhost/http(s): fetch HEAD requests (cross-origin safe for same-origin).
      //   file://: onerror inspection (fetch is blocked for file:// resources).
      //
      // OWASP A06:2021 — Vulnerable and Outdated Components: broken asset
      //   detection prevents silent failures during presentation editing/export.
      // =====================================================================
      var BROKEN_ASSET_PROBE_LIMIT = 50;

      function collectAssetUrls(doc) {
        if (!doc) return [];
        var urls = [];
        var seen = new Set();

        // Base URL for resolving relative paths — use deck's manualBaseUrl if set.
        var baseUrl = null;
        try {
          if (typeof state !== "undefined" && state.manualBaseUrl) {
            baseUrl = state.manualBaseUrl;
          } else if (typeof window !== "undefined" && window.location) {
            baseUrl = window.location.href;
          }
        } catch (_) { /* ignore */ }

        function add(rawUrl) {
          if (!rawUrl || typeof rawUrl !== "string") return;
          rawUrl = rawUrl.trim();
          // Skip data URIs, blob URLs, fragment-only refs, and empty strings.
          if (!rawUrl || rawUrl.startsWith("data:") || rawUrl.startsWith("blob:") || rawUrl.startsWith("#")) return;

          // Resolve relative URLs to absolute using the deck base path.
          var resolved = rawUrl;
          if (!/^https?:\/\//i.test(rawUrl) && !rawUrl.startsWith("//")) {
            if (baseUrl) {
              try {
                resolved = new URL(rawUrl, baseUrl).href;
              } catch (_) {
                // Can't resolve — skip this URL entirely to avoid false positives.
                return;
              }
            } else {
              // No base URL available to resolve against — skip to avoid false positives.
              return;
            }
          }

          if (seen.has(resolved)) return;
          seen.add(resolved);
          urls.push(resolved);
        }

        doc.querySelectorAll("img[src]").forEach(function (el) { add(el.getAttribute("src")); });
        doc.querySelectorAll("link[rel='stylesheet'][href], link[rel='icon'][href]").forEach(function (el) { add(el.getAttribute("href")); });
        doc.querySelectorAll("video[src]").forEach(function (el) { add(el.getAttribute("src")); });
        doc.querySelectorAll("source[src]").forEach(function (el) { add(el.getAttribute("src")); });

        return urls.slice(0, BROKEN_ASSET_PROBE_LIMIT);
      }

      function probeBrokenAssetsViaHead(urls, callback) {
        // HEAD probes via fetch — works for http(s) same-origin.
        if (!urls || urls.length === 0) { callback([]); return; }
        var broken = [];
        var pending = urls.length;

        urls.forEach(function (url) {
          fetch(url, { method: "HEAD", cache: "no-store" })
            .then(function (res) {
              if (res.status >= 400) broken.push(url);
            })
            .catch(function () {
              broken.push(url);
            })
            .finally(function () {
              pending -= 1;
              if (pending === 0) callback(broken);
            });
        });
      }

      function probeBrokenAssetsViaOnerror(frameWindow, urls, callback) {
        // For file:// we inspect already-loaded resources via naturalWidth/sheet.
        // No network requests — purely examines load state of existing DOM nodes.
        if (!frameWindow || !frameWindow.document) { callback([]); return; }
        var doc = frameWindow.document;
        var broken = [];

        urls.forEach(function (url) {
          // Images: naturalWidth === 0 means load failed (or unloaded).
          var imgs = doc.querySelectorAll("img[src]");
          imgs.forEach(function (img) {
            if (img.getAttribute("src") === url && img.naturalWidth === 0 && !img.complete) {
              broken.push(url);
            }
          });
          // Stylesheets: sheet === null means load failed.
          var links = doc.querySelectorAll("link[rel='stylesheet'][href]");
          links.forEach(function (link) {
            if (link.getAttribute("href") === url) {
              try {
                if (link.sheet === null) broken.push(url);
              } catch (_) {
                broken.push(url);
              }
            }
          });
        });

        // De-duplicate.
        var uniqueBroken = broken.filter(function (u, i, a) { return a.indexOf(u) === i; });
        callback(uniqueBroken);
      }

      function probeBrokenAssets(doc, frameWindow, callback) {
        var urls = collectAssetUrls(doc);
        if (urls.length === 0) { callback([]); return; }

        var protocol = (typeof window !== "undefined" && window.location) ? window.location.protocol : "file:";
        if (protocol === "file:") {
          probeBrokenAssetsViaOnerror(frameWindow, urls, callback);
        } else {
          probeBrokenAssetsViaHead(urls, callback);
        }
      }

      function runBrokenAssetProbeAndReport() {
        // Guard: needs a loaded model document and an accessible iframe.
        if (!state.modelDoc) return;
        var frame = (typeof els !== "undefined") ? els.previewFrame : document.getElementById("previewFrame");
        var frameWindow = null;
        try {
          frameWindow = frame && frame.contentWindow;
        } catch (_) {
          return;
        }

        probeBrokenAssets(state.modelDoc, frameWindow, function (brokenUrls) {
          if (!brokenUrls || brokenUrls.length === 0) {
            // No broken assets found — clear any stale banner from a previous probe.
            if (window.shellBoundary) window.shellBoundary.clear("broken-assets");
            return;
          }
          var count = brokenUrls.length;
          var plural = count === 1 ? "файл" : (count < 5 ? "файла" : "файлов");
          var msg = "Некоторые ресурсы не найдены. " + count + " " + plural + " недоступно.";
          if (window.shellBoundary) {
            window.shellBoundary.report("broken-assets", msg, [
              { label: "Подключить папку ресурсов", action: "pick-asset-folder" },
            ]);
          }
        });
      }

      // Handle shellBannerAction events (e.g. pick-asset-folder clears the banner).
      window.addEventListener("shellBannerAction", function (evt) {
        if (!evt || !evt.detail) return;
        if (evt.detail.action === "pick-asset-folder") {
          // Clear the broken-assets banner; the actual folder picker is wired
          // by the asset-folder module. WO-07 will integrate the full flow.
          if (window.shellBoundary) window.shellBoundary.clear("broken-assets");
        }
      });

      // =====================================================================
      // Telemetry toggle UI wiring (ADR-020, WO-15)
      // Binds #telemetryToggle / #telemetryExportBtn / #telemetryClearBtn.
      // Called from init() in boot.js after the DOM is ready.
      // =====================================================================
      function _updateTelemetryButtons(enabled) {
        const exportBtn = document.getElementById("telemetryExportBtn");
        const clearBtn = document.getElementById("telemetryClearBtn");
        const toggle = document.getElementById("telemetryToggle");
        if (toggle instanceof HTMLInputElement) toggle.checked = Boolean(enabled);
        if (exportBtn instanceof HTMLButtonElement) exportBtn.disabled = !enabled;
        if (clearBtn instanceof HTMLButtonElement) clearBtn.disabled = !enabled;
      }

      function bindTelemetryToggleUi() {
        const toggle = document.getElementById("telemetryToggle");
        const exportBtn = document.getElementById("telemetryExportBtn");
        const clearBtn = document.getElementById("telemetryClearBtn");

        if (!toggle || !exportBtn || !clearBtn) return;
        if (!window.telemetry) return;

        // Sync initial state from localStorage
        _updateTelemetryButtons(window.telemetry.isEnabled());

        toggle.addEventListener("change", function () {
          window.telemetry.setEnabled(this.checked);
          _updateTelemetryButtons(this.checked);
        });

        exportBtn.addEventListener("click", function () {
          const log = window.telemetry.exportLogJson();
          const json = JSON.stringify(log, null, 2);
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "telemetry-log.json";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        });

        clearBtn.addEventListener("click", function () {
          window.telemetry.clearLog();
          showToast("Журнал очищен", "info");
        });
      }

      // =====================================================================
