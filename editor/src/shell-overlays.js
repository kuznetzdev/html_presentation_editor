// shell-overlays.js
// Layer: Shell Overlay UI
// Modal management, insert palette, topbar overflow, layer picker, context
// menu binding, and mode switching. All shell-owned overlay surfaces.
//
      function getFocusableElements(root) {
        return Array.from(
          root.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (el) =>
            !el.hasAttribute("hidden") &&
            el.getAttribute("aria-hidden") !== "true",
        );
      }

      function openModal(modal) {
        if (!modal) return;
        modal.dataset.returnFocusId =
          document.activeElement instanceof HTMLElement
            ? document.activeElement.id || ""
            : "";
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() => {
          const focusables = getFocusableElements(modal);
          const target = focusables[0] || modal;
          if (target && typeof target.focus === "function")
            target.focus({ preventScroll: true });
        });
      }

      function openOpenHtmlModal(options = {}) {
        const focusTarget = ["file", "paste", "assets", "base"].includes(
          String(options.focusTarget || ""),
        )
          ? String(options.focusTarget)
          : "file";
        clearOpenHtmlStatus();
        if (focusTarget === "assets") {
          setOpenHtmlStatus(
            "Подключите папку проекта или assets, чтобы загрузились относительные css/js/img/video.",
            "info",
          );
        } else if (focusTarget === "base") {
          setOpenHtmlStatus(
            "Укажите абсолютный Base URL, если HTML ссылается на соседние ресурсы по относительным путям.",
            "info",
          );
        }
        openModal(els.openHtmlModal);
        window.requestAnimationFrame(() => {
          const target =
            focusTarget === "paste"
              ? els.pasteHtmlTextarea
              : focusTarget === "assets"
                ? els.assetDirectoryInput
                : focusTarget === "base"
                  ? els.baseUrlInput
                  : els.fileInput;
          if (!(target instanceof HTMLElement)) return;
          if (typeof target.focus === "function") {
            target.focus({ preventScroll: true });
          }
          if (
            focusTarget === "paste" &&
            typeof target.select === "function"
          ) {
            target.select();
          }
        });
      }

      function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        if (modal === els.videoInsertModal) syncInteractionModeFromState();
        const returnFocusId = modal.dataset.returnFocusId || "";
        if (returnFocusId) {
          const returnFocusEl = document.getElementById(returnFocusId);
          if (returnFocusEl && typeof returnFocusEl.focus === "function") {
            window.requestAnimationFrame(() =>
              returnFocusEl.focus({ preventScroll: true }),
            );
          }
        }
      }

      function getPaletteActionButtons() {
        return Array.from(
          els.quickPalette?.querySelectorAll("button[data-palette-action]") ||
            [],
        );
      }

      function applyRovingTabindex(items, activeIndex) {
        items.forEach((item, index) => {
          item.tabIndex = index === activeIndex ? 0 : -1;
        });
      }

      function focusPaletteActionButton(index) {
        const buttons = getPaletteActionButtons();
        if (!buttons.length) return;
        const nextIndex = Math.max(0, Math.min(buttons.length - 1, index));
        applyRovingTabindex(buttons, nextIndex);
        buttons[nextIndex].focus({ preventScroll: true });
      }

      function focusContextMenuButton(index) {
        const items = getContextMenuButtons();
        if (!items.length) return;
        const nextIndex = Math.max(0, Math.min(items.length - 1, index));
        applyRovingTabindex(items, nextIndex);
        items[nextIndex].focus({ preventScroll: true });
      }

      function getTopbarOverflowButtons() {
        return Array.from(
          els.topbarOverflowMenu?.querySelectorAll(
            "button[data-topbar-overflow-action]",
          ) || [],
        ).filter((button) => {
          if (!(button instanceof HTMLElement) || button.hidden) return false;
          const style = getComputedStyle(button);
          return style.display !== "none" && style.visibility !== "hidden";
        });
      }

      function focusTopbarOverflowButton(index) {
        const items = getTopbarOverflowButtons();
        if (!items.length) return;
        const nextIndex = Math.max(0, Math.min(items.length - 1, index));
        applyRovingTabindex(items, nextIndex);
        items[nextIndex].focus({ preventScroll: true });
      }

      function isTopbarOverflowOpen() {
        return Boolean(els.topbarOverflowMenu?.classList.contains("is-open"));
      }

      function setTopbarOverflowOpen(open, options = {}) {
        if (!els.topbarOverflowMenu || !els.topbarOverflowBtn) return;
        const active = Boolean(open) && state.topbarCommandMode === "overflow";
        state.topbarOverflowOpen = active;
        els.topbarOverflowMenu.classList.toggle("is-open", active);
        els.topbarOverflowMenu.setAttribute(
          "aria-hidden",
          active ? "false" : "true",
        );
        setDisclosureButtonState(els.topbarOverflowBtn, active, "topbarOverflowMenu");
        const items = getTopbarOverflowButtons();
        applyRovingTabindex(items, active ? 0 : -1);
        if (active) {
          closeShellPanels({ keep: "topbar-overflow" });
          closeTransientShellUi({ keep: "topbar-overflow" });
          scheduleShellPopoverLayout();
          if (options.focusFirst !== false) {
            window.requestAnimationFrame(() => focusTopbarOverflowButton(0));
          }
          return;
        }
        if (options.restoreFocus) {
          window.requestAnimationFrame(() =>
            els.topbarOverflowBtn.focus({ preventScroll: true }),
          );
        }
      }

      function closeTopbarOverflow(options = {}) {
        setTopbarOverflowOpen(false, options);
      }

      function toggleTopbarOverflow() {
        setTopbarOverflowOpen(!isTopbarOverflowOpen());
      }

      function isInsertPaletteOpen() {
        return Boolean(els.quickPalette?.classList.contains("is-open"));
      }

      function setInsertPaletteOpen(open, options = {}) {
        if (!els.quickPalette || !els.toggleInsertPaletteBtn) return;
        const active = Boolean(open);
        els.quickPalette.classList.toggle("is-open", active);
        els.quickPalette.setAttribute("aria-hidden", active ? "false" : "true");
        els.toggleInsertPaletteBtn.classList.toggle("is-active", active);
        els.toggleInsertPaletteBtn.setAttribute(
          "aria-expanded",
          active ? "true" : "false",
        );
        els.toggleInsertPaletteBtn.textContent = active
          ? "✕ Закрыть вставку"
          : "➕ Добавить блок";
        els.toggleInsertPaletteBtn.title = active
          ? "Скрыть меню вставки"
          : "Открыть меню вставки";
        if (active) {
          closeShellPanels({ keep: "insert-palette" });
          closeTransientShellUi({ keep: "insert-palette" });
          setInteractionMode("insert");
          scheduleShellPopoverLayout();
        } else syncInteractionModeFromState();
        const buttons = getPaletteActionButtons();
        applyRovingTabindex(buttons, active ? 0 : -1);
        if (active && options.focusFirst !== false) {
          window.requestAnimationFrame(() => focusPaletteActionButton(0));
        }
        if (!active && options.restoreFocus) {
          window.requestAnimationFrame(() =>
            els.toggleInsertPaletteBtn.focus({ preventScroll: true }),
          );
        }
      }

      function closeInsertPalette(options = {}) {
        setInsertPaletteOpen(false, options);
      }

      function toggleInsertPalette() {
        setInsertPaletteOpen(!isInsertPaletteOpen());
      }

      function insertHeadingBlock(level = 1) {
        if (!state.modelDoc) return;
        const tag = level <= 1 ? "h1" : "h2";
        const text = level <= 1 ? "Новый заголовок" : "Подзаголовок";
        insertHtmlViaBridge(
          `<${tag} style="margin:0 0 12px;">${escapeHtml(text)}</${tag}>`,
          { focusText: true },
        );
        showToast(
          level <= 1
            ? "Заголовок добавлен на слайд."
            : "Подзаголовок добавлен на слайд.",
          "success",
          { title: "Палитра" },
        );
      }

      function bindPaletteActions() {
        if (!els.quickPalette) return;

        els.toggleInsertPaletteBtn?.addEventListener("click", () => {
          if (!state.modelDoc) return;
          if (!state.previewReady) {
            showToast(
              "Дождись полной загрузки превью, потом открывай меню вставки.",
              "warning",
              { title: "Превью ещё готовится" },
            );
            return;
          }
          if (state.mode !== "edit") setMode("edit");
          closeContextMenu();
          toggleInsertPalette();
        });

        els.toggleInsertPaletteBtn?.addEventListener("keydown", (event) => {
          if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
          event.preventDefault();
          if (!state.modelDoc || !state.previewReady) return;
          if (state.mode !== "edit") setMode("edit");
          closeContextMenu();
          setInsertPaletteOpen(true, { focusFirst: false });
          window.requestAnimationFrame(() =>
            focusPaletteActionButton(
              event.key === "ArrowUp"
                ? getPaletteActionButtons().length - 1
                : 0,
            ),
          );
        });

        els.quickPalette.addEventListener("click", (event) => {
          const action = event.target.closest("[data-palette-action]")?.dataset
            ?.paletteAction;
          if (!action) return;
          performPaletteAction(action);
        });

        els.quickPalette
          .querySelectorAll("[data-palette-action]")
          .forEach((button, index) => {
            button.tabIndex = -1;
            button.addEventListener("dragstart", (event) => {
              const action = button.dataset.paletteAction;
              event.dataTransfer.setData("text/x-pe-palette", action);
              event.dataTransfer.effectAllowed = "copy";
            });
          });

        els.quickPalette.addEventListener("keydown", (event) => {
          const buttons = getPaletteActionButtons();
          if (!buttons.length) return;
          const currentIndex = buttons.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeInsertPalette({ restoreFocus: true });
            return;
          }
          if (["ArrowRight", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            focusPaletteActionButton(
              (currentIndex + 1 + buttons.length) % buttons.length,
            );
            return;
          }
          if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            focusPaletteActionButton(
              (currentIndex - 1 + buttons.length) % buttons.length,
            );
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusPaletteActionButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusPaletteActionButton(buttons.length - 1);
          }
        });

        document.addEventListener("pointerdown", (event) => {
          if (!isInsertPaletteOpen()) return;
          if (
            event.target.closest("#quickPalette") ||
            event.target.closest("#toggleInsertPaletteBtn")
          )
            return;
          closeInsertPalette();
        });

        window.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isInsertPaletteOpen()) {
            event.preventDefault();
            closeInsertPalette({ restoreFocus: true });
          }
        });

        els.previewStage.addEventListener(
          "drop",
          (event) => {
            const action = event.dataTransfer?.getData("text/x-pe-palette");
            if (!action || state.mode !== "edit") return;
            event.preventDefault();
            performPaletteAction(action);
          },
          true,
        );
      }

      function getContextMenuButtons() {
        return Array.from(
          els.contextMenu?.querySelectorAll("button[data-menu-action]") || [],
        );
      }

      function isLayerPickerOpen() {
        return Boolean(
          els.layerPicker?.classList.contains("is-open") && state.layerPickerPayload,
        );
      }

      function getLayerPickerButtons() {
        return Array.from(
          els.layerPickerList?.querySelectorAll("button[data-layer-picker-node-id]") ||
            [],
        );
      }

      function syncLayerPickerActiveButton() {
        const items = getLayerPickerButtons();
        items.forEach((button, index) => {
          button.classList.toggle("is-active", index === state.layerPickerActiveIndex);
        });
      }

      function focusLayerPickerButton(index) {
        const items = getLayerPickerButtons();
        if (!items.length) return;
        const nextIndex = Math.max(0, Math.min(items.length - 1, index));
        state.layerPickerActiveIndex = nextIndex;
        syncLayerPickerActiveButton();
        items[nextIndex].focus({ preventScroll: true });
      }

      function setLayerPickerHighlight(nodeId) {
        const normalizedNodeId = nodeId || null;
        if (state.layerPickerHighlightNodeId === normalizedNodeId) return;
        state.layerPickerHighlightNodeId = normalizedNodeId;
        sendToBridge("highlight-node", { nodeId: normalizedNodeId });
      }

      function collectLayerPickerItemsFromOverlap() {
        const conflict = state.selectedOverlapWarning;
        const doc = getPreviewDocument();
        if (!conflict || !doc) return [];
        const rect = conflict.overlapRect || state.selectedRect;
        if (!rect) return [];
        const docView = doc.defaultView || window;
        const cx = Math.round((rect.left + rect.right) / 2);
        const cy = Math.round((rect.top + rect.bottom) / 2);
        const selectedNode = getSelectedModelNode();
        const uniqueItems = [];
        const seen = new Set();
        const collect = (node) => {
          if (!(node instanceof Element)) return;
          const nodeId = String(node.getAttribute("data-editor-node-id") || "").trim();
          if (!nodeId || seen.has(nodeId) || !isLayerManagedNode(node)) return;
          seen.add(nodeId);
          const entityKind = node.getAttribute("data-editor-entity-kind") || "element";
          const isLocked = node.getAttribute("data-editor-locked") === "true";
          const isHidden =
            isLayerSessionHidden(nodeId) ||
            node.hasAttribute("hidden") ||
            node.style.visibility === "hidden" ||
            node.style.display === "none";
          uniqueItems.push({
            nodeId,
            entityKind,
            label: getLayerLabel(node),
            isLocked,
            isHidden,
            isCurrent: nodeId === state.selectedNodeId,
          });
        };
        const canUseViewportPoint =
          cx >= 0 &&
          cy >= 0 &&
          cx <= Math.max(0, Math.round((docView.innerWidth || 0) - 1)) &&
          cy <= Math.max(0, Math.round((docView.innerHeight || 0) - 1));
        if (canUseViewportPoint) {
          (doc.elementsFromPoint(cx, cy) || []).forEach(collect);
        }
        if (uniqueItems.length < 2) {
          const relatedConflicts = Array.from(
            state.overlapConflictsBySlide[state.activeSlideId] || [],
          ).filter((entry) => {
            if (!entry) return false;
            if (
              entry.bottomNodeId === state.selectedNodeId ||
              entry.topNodeId === state.selectedNodeId
            ) {
              return true;
            }
            if (!entry.overlapRect) return false;
            return computeRectIntersection(rect, entry.overlapRect).area > 0;
          });
          relatedConflicts.forEach((entry) => {
            [entry.bottomNodeId, entry.topNodeId].forEach((nodeId) => {
              collect(findModelNode(nodeId));
            });
          });
        }
        if (selectedNode instanceof Element) collect(selectedNode);
        return uniqueItems.map((item, index, items) => ({
          ...item,
          hint: `${getEntityKindLabel(item.entityKind)} • ${formatLayerStackHint(index, items.length)}`,
          isTopMost: index === 0,
        }));
      }

      function buildSelectedOverlapLayerPickerPayload() {
        const items = collectLayerPickerItemsFromOverlap();
        if (items.length < 2 || !state.selectedOverlapWarning) return null;
        const rect = state.selectedOverlapWarning.overlapRect || state.selectedRect;
        const layerWord = getRussianPlural(items.length, "слой", "слоя", "слоёв");
        return {
          title: "Слои под курсором",
          subtitle: `В этой точке найдено ${items.length} ${layerWord}. Перекрытие около ${state.selectedOverlapWarning.coveredPercent}%.`,
          items,
          shellClientX: rect ? Math.round(rect.right + 12) : 0,
          shellClientY: rect ? Math.round((rect.top + rect.bottom) / 2) : 0,
          source: "selected-overlap",
        };
      }

      function selectNextOverlapLayer() {
        const items = collectLayerPickerItemsFromOverlap();
        if (items.length < 2) {
          showToast(
            "Под курсором не найден следующий authored-слой для переключения.",
            "info",
            { title: "Слои" },
          );
          return false;
        }
        const currentIndex = items.findIndex(
          (item) => item.nodeId === state.selectedNodeId,
        );
        const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
        const nextItem = items[nextIndex % items.length] || null;
        if (!nextItem?.nodeId) return false;
        sendToBridge("select-element", { nodeId: nextItem.nodeId });
        return true;
      }

      function renderLayerPicker(payload) {
        const items = Array.isArray(payload?.items) ? payload.items : [];
        if (!els.layerPickerList) return;
        els.layerPickerTitle.textContent = payload?.title || "Слои под курсором";
        els.layerPickerSubtitle.textContent =
          payload?.subtitle || "В этой точке найдено несколько слоёв. Выберите нужный.";
        els.layerPickerList.innerHTML = "";
        items.forEach((item, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.layerPickerNodeId = item.nodeId;
          if (item.isCurrent) button.classList.add("is-current-layer");
          const chips = [];
          if (item.isTopMost) {
            chips.push(buildLayerStatusChipHtml("Верхний", "is-top"));
          }
          if (item.isCurrent) {
            chips.push(buildLayerStatusChipHtml("Текущий", "is-current"));
          }
          if (item.isHidden) {
            chips.push(buildLayerStatusChipHtml("Скрыт", "is-hidden"));
          }
          if (item.isLocked) {
            chips.push(buildLayerStatusChipHtml("Заблокирован", "is-locked"));
          }
          button.innerHTML = `
            <span class="menu-icon">${escapeHtml(getEntityKindIcon(item.entityKind))}</span>
            <span class="layer-picker-row-copy">
              <span class="layer-picker-row-title">${escapeHtml(item.label)}</span>
              <span class="layer-picker-row-hint">${escapeHtml(item.hint || "")}</span>
              <span class="layer-picker-row-chips">${chips.join("")}</span>
            </span>
          `;
          button.addEventListener("pointerenter", () => {
            state.layerPickerActiveIndex = index;
            syncLayerPickerActiveButton();
            setLayerPickerHighlight(item.nodeId);
          });
          button.addEventListener("pointerleave", () => {
            if (state.layerPickerActiveIndex === index) {
              setLayerPickerHighlight(null);
            }
          });
          button.addEventListener("focus", () => {
            state.layerPickerActiveIndex = index;
            syncLayerPickerActiveButton();
            setLayerPickerHighlight(item.nodeId);
          });
          button.addEventListener("click", () => {
            sendToBridge("select-element", { nodeId: item.nodeId });
            closeLayerPicker();
          });
          els.layerPickerList.appendChild(button);
        });
        state.layerPickerActiveIndex = Math.max(
          0,
          items.findIndex((item) => item.isCurrent),
        );
        if (state.layerPickerActiveIndex < 0) state.layerPickerActiveIndex = 0;
        syncLayerPickerActiveButton();
      }

      function positionLayerPicker(clientX, clientY) {
        if (!els.layerPicker) return;
        const insets = getShellViewportInsets();
        if (prefersContextMenuSheetMode()) {
          const availableWidth =
            window.innerWidth - insets.left - insets.right;
          const sheetWidth = Math.min(360, Math.max(240, availableWidth));
          const centeredLeft =
            insets.left + Math.max(0, Math.round((availableWidth - sheetWidth) / 2));
          els.layerPicker.style.width = `${sheetWidth}px`;
          els.layerPicker.style.left = `${centeredLeft}px`;
          els.layerPicker.style.top = `${Math.round(
            Math.max(
              insets.top,
              window.innerHeight - insets.bottom - (els.layerPicker.offsetHeight || 280),
            ),
          )}px`;
          els.layerPicker.style.right = "auto";
          clampPopoverPosition(els.layerPicker, insets);
          return;
        }
        els.layerPicker.style.width = "";
        els.layerPicker.style.left = `${clientX || 0}px`;
        els.layerPicker.style.top = `${clientY || 0}px`;
        els.layerPicker.style.right = "auto";
        els.layerPicker.style.bottom = "auto";
        clampPopoverPosition(els.layerPicker, insets);
      }

      function reopenLayerPickerFromState() {
        if (!state.layerPickerPayload) return;
        renderLayerPicker(state.layerPickerPayload);
        els.layerPicker.classList.add("is-open");
        els.layerPicker.setAttribute("aria-hidden", "false");
        positionLayerPicker(
          Number(state.layerPickerPayload.shellClientX || 0),
          Number(state.layerPickerPayload.shellClientY || 0),
        );
      }

      function closeLayerPicker(options = {}) {
        if (!els.layerPicker) return;
        els.layerPicker.classList.remove("is-open");
        els.layerPicker.setAttribute("aria-hidden", "true");
        els.layerPicker.style.left = "0px";
        els.layerPicker.style.top = "0px";
        els.layerPicker.style.right = "auto";
        els.layerPicker.style.bottom = "auto";
        els.layerPicker.style.width = "";
        state.layerPickerActiveIndex = -1;
        state.layerPickerPayload = null;
        setLayerPickerHighlight(null);
        if (options.restoreFocus && els.overlapSelectLayerBtn && !els.overlapSelectLayerBtn.hidden) {
          window.requestAnimationFrame(() =>
            els.overlapSelectLayerBtn.focus({ preventScroll: true }),
          );
        }
      }

      function openLayerPicker(payload) {
        if (!payload?.items?.length) return false;
        closeShellPanels({ keep: "layer-picker" });
        closeTransientShellUi({ keep: "layer-picker" });
        hideFloatingToolbar();
        state.layerPickerPayload = payload;
        renderLayerPicker(payload);
        els.layerPicker.classList.add("is-open");
        els.layerPicker.setAttribute("aria-hidden", "false");
        positionLayerPicker(
          Number(payload.shellClientX || 0),
          Number(payload.shellClientY || 0),
        );
        window.requestAnimationFrame(() => focusLayerPickerButton(state.layerPickerActiveIndex || 0));
        return true;
      }

      // [v0.25.0] Layer picker available in all complexity modes (previously advanced-only)
      function openLayerPickerForSelectedOverlap() {
        const payload = buildSelectedOverlapLayerPickerPayload();
        if (!payload) {
          showToast("Под курсором должно быть хотя бы два authored-слоя, чтобы открыть выбор.", "info", {
            title: "Слои",
          });
          return false;
        }
        return openLayerPicker(payload);
      }

      function bindContextMenu() {
        els.contextMenu.addEventListener("click", (event) => {
          const action =
            event.target?.closest?.("[data-menu-action]")?.dataset?.menuAction;
          if (!action) return;
          handleContextMenuAction(action);
        });

        // mouseenter flash on context menu removed — avoids ghost glow on hover

        els.contextMenu.addEventListener("pointerover", (event) => {
          const _lBtn = event.target?.closest?.("[data-layer-node-id]");
          if (_lBtn?.dataset?.layerNodeId) {
            sendToBridge("highlight-node", { nodeId: _lBtn.dataset.layerNodeId });
          }
        }, true);

        els.contextMenu.addEventListener("pointerout", (event) => {
          if (event.target?.closest?.("[data-layer-node-id]")) {
            sendToBridge("highlight-node", { nodeId: null });
          }
        }, true);

        els.contextMenu.addEventListener("keydown", (event) => {
          const items = getContextMenuButtons();
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeContextMenu();
            return;
          }
          if (["ArrowDown", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            focusContextMenuButton(
              (currentIndex + 1 + items.length) % items.length,
            );
            return;
          }
          if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
            event.preventDefault();
            focusContextMenuButton(
              (currentIndex - 1 + items.length) % items.length,
            );
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusContextMenuButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusContextMenuButton(items.length - 1);
          }
        });
      }

      function bindLayerPicker() {
        document.addEventListener(
          "pointerdown",
          (event) => {
            if (!els.layerPicker?.classList.contains("is-open")) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (
              target.closest("#layerPicker") ||
              target.closest("#overlapSelectLayerBtn")
            ) {
              return;
            }
            closeLayerPicker();
          },
          true,
        );
        els.layerPicker?.addEventListener("keydown", (event) => {
          const items = getLayerPickerButtons();
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeLayerPicker({ restoreFocus: true });
            return;
          }
          if (["ArrowDown", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            focusLayerPickerButton((currentIndex + 1 + items.length) % items.length);
            return;
          }
          if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
            event.preventDefault();
            focusLayerPickerButton((currentIndex - 1 + items.length) % items.length);
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusLayerPickerButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusLayerPickerButton(items.length - 1);
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            const activeButton = items[currentIndex >= 0 ? currentIndex : 0];
            if (!activeButton) return;
            event.preventDefault();
            activeButton.click();
          }
        });
      }

      function openContextMenuFromBridge(payload) {
        if (state.mode !== "edit") return;
        closeShellPanels({ keep: "context-menu" });
        closeTransientShellUi({ keep: "context-menu" });
        hideFloatingToolbar();
        state.contextMenuNodeId = payload.nodeId || state.selectedNodeId;
        const frameRect = els.previewFrame.getBoundingClientRect();
        const x = frameRect.left + (payload.clientX || 0);
        const y = frameRect.top + (payload.clientY || 0);
        state.contextMenuPayload = {
          ...payload,
          origin: "bridge",
          nodeId: state.contextMenuNodeId,
          shellClientX: x,
          shellClientY: y,
        };
        renderContextMenu(state.contextMenuPayload);
        positionContextMenu(x, y);
        els.contextMenu.classList.add("is-open");
        els.contextMenu.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() => focusContextMenuButton(0));
      }

      function setMode(mode) {
        if (mode === "edit" && !state.editingSupported) {
          showToast(
            "Для этого документа доступен только режим preview. Внутри него нет стабильной структуры для безопасного редактирования.",
            "warning",
            {
              title: "Редактирование недоступно",
              ttl: 4200,
            },
          );
          return;
        }
        state.mode = mode;
        setInteractionMode(mode === "preview" ? "preview" : "select");
        closeContextMenu();
        closeLayerPicker();
        if (mode === "preview") {
          closeInsertPalette();
          clearSelectedElementState();
        }
        sendToBridge("set-mode", { mode });
        refreshUi();
        updateInspectorFromSelection();
      }
