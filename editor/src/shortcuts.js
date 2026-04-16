      // ZONE: Global Shortcuts & Window Events
      // Keyboard shortcuts, resize, scroll, blur, pointer-down handling
      // =====================================================================
      // bindGlobalShortcuts — единое место для shell-hotkeys. Важно: если фокус
      // находится в input/textarea/select, обычный ввод не перехватываем.
      function bindGlobalShortcuts() {
        window.addEventListener("keydown", async (event) => {
          if (event.key === "Alt") {
            setSelectionPointerPassthrough(true);
          }
          if (event.key === "Escape") {
            if (state.activeManipulation) {
              event.preventDefault();
              cancelActiveManipulation();
              return;
            }
            closeContextMenu();
            if (els.htmlEditorModal.classList.contains("is-open"))
              closeModal(els.htmlEditorModal);
            if (els.videoInsertModal?.classList.contains("is-open"))
              closeModal(els.videoInsertModal);
            if (els.shortcutsModal?.classList.contains("is-open"))
              closeModal(els.shortcutsModal);
            return;
          }
          if (isActiveTextEditingContext(event)) return;
          if (shouldIgnoreGlobalShortcut(event)) return;
          const isMod = event.ctrlKey || event.metaKey;
          // "?" — keyboard shortcut cheat sheet (Shift+/ on most keyboards)
          if (!isMod && event.key === "?") {
            event.preventDefault();
            openModal(els.shortcutsModal);
            return;
          }
          if (isMod && event.key.toLowerCase() === "z" && !event.shiftKey) {
            event.preventDefault();
            undo();
            return;
          }
          if (
            (isMod && event.key.toLowerCase() === "y") ||
            (isMod && event.shiftKey && event.key.toLowerCase() === "z")
          ) {
            event.preventDefault();
            redo();
            return;
          }
          if (isMod && event.key.toLowerCase() === "d") {
            event.preventDefault();
            duplicateSelectedElement();
            return;
          }
          // Ctrl+B / Ctrl+I / Ctrl+U — format selected text element
          // (only when NOT in text-edit mode; browser handles those natively there)
          if (isMod && !event.shiftKey && state.mode === "edit" && state.selectedNodeId) {
            const k = event.key.toLowerCase();
            const entityKind = getSelectedEntityKindForUi();
            const isTextEntity = entityKind === "text" || entityKind === "table-cell";
            if (isTextEntity && state.selectedPolicy?.canEditStyles && state.selectedPolicy?.canEditText) {
              if (k === "b") {
                event.preventDefault();
                toggleStyleOnSelected("fontWeight", "700", "400", "bold");
                return;
              }
              if (k === "i") {
                event.preventDefault();
                toggleStyleOnSelected("fontStyle", "italic", "normal", "italic");
                return;
              }
              if (k === "u") {
                event.preventDefault();
                toggleStyleOnSelected("textDecoration", "underline", "none", "underline");
                return;
              }
              if (k === "l") {
                event.preventDefault();
                applyStyle("textAlign", "left");
                return;
              }
              if (k === "e") {
                event.preventDefault();
                applyStyle("textAlign", "center");
                return;
              }
              if (k === "r") {
                event.preventDefault();
                applyStyle("textAlign", "right");
                return;
              }
            }
          }
          // Ctrl+C — copy selected element to internal clipboard
          if (isMod && !event.shiftKey && event.key.toLowerCase() === "c" && state.mode === "edit" && state.selectedNodeId) {
            event.preventDefault();
            copySelectedElement();
            return;
          }
          // Ctrl+X — cut selected element (copy + delete)
          if (isMod && !event.shiftKey && event.key.toLowerCase() === "x" && state.mode === "edit" && state.selectedNodeId) {
            event.preventDefault();
            cutSelectedElement();
            return;
          }
          // Ctrl+V — paste element from internal clipboard (takes priority over image paste)
          if (isMod && !event.shiftKey && event.key.toLowerCase() === "v" && state.mode === "edit" && state.copiedElementHtml) {
            event.preventDefault();
            pasteSelectedElement();
            return;
          }
          if (isMod && event.shiftKey && event.key.toLowerCase() === "c") {
            event.preventDefault();
            copySelectedStyle();
            return;
          }
          if (isMod && event.shiftKey && event.key.toLowerCase() === "v") {
            event.preventDefault();
            pasteStyleToSelected();
            return;
          }
          if (isMod && (event.key === "=" || event.key === "+")) {
            event.preventDefault();
            stepZoom(1);
            return;
          }
          if (isMod && (event.key === "-" || event.key === "_")) {
            event.preventDefault();
            stepZoom(-1);
            return;
          }
          if (isMod && event.key === "0") {
            event.preventDefault();
            setPreviewZoom(1.0, true);
            return;
          }
          if (
            state.mode === "edit" &&
            state.selectedNodeId &&
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
              event.key,
            )
          ) {
            event.preventDefault();
            const step = event.shiftKey
              ? DIRECT_MANIP_NUDGE_FAST_PX
              : DIRECT_MANIP_NUDGE_PX;
            if (event.key === "ArrowUp") performKeyboardNudge(0, -step);
            if (event.key === "ArrowDown") performKeyboardNudge(0, step);
            if (event.key === "ArrowLeft") performKeyboardNudge(-step, 0);
            if (event.key === "ArrowRight") performKeyboardNudge(step, 0);
            return;
          }
          if (
            (event.key === "Delete" || event.key === "Backspace") &&
            state.mode === "edit" &&
            state.selectedNodeId
          ) {
            event.preventDefault();
            deleteSelectedElement();
            return;
          }
          if (
            isMod &&
            event.key.toLowerCase() === "f" &&
            state.mode === "edit"
          ) {
            event.preventDefault();
            openElementFinder();
          }
        });

        window.addEventListener("keyup", (event) => {
          if (event.key === "Alt") {
            setSelectionPointerPassthrough(false);
          }
        });

        document.addEventListener("pointerdown", (event) => {
          if (
            !event.target.closest("#contextMenu") &&
            !event.target.closest("#layerPicker")
          ) {
            closeContextMenu();
            closeLayerPicker();
          }
        });
        window.addEventListener("blur", () => {
          setSelectionPointerPassthrough(false);
          closeContextMenu();
          closeLayerPicker();
        });
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) return;
          setSelectionPointerPassthrough(false);
          closeContextMenu();
          closeLayerPicker();
        });

        window.addEventListener("resize", () => {
          applyShellPanelState();
          scheduleShellChromeMetrics();
          scheduleShellPopoverLayout();
          positionFloatingToolbar();
          renderSelectionOverlay();
          if (
            els.contextMenu.classList.contains("is-open") &&
            state.contextMenuPayload
          ) {
            reopenContextMenuFromState();
          }
          if (isLayerPickerOpen() && state.layerPickerPayload) {
            reopenLayerPickerFromState();
          }
        });
        window.addEventListener("scroll", positionFloatingToolbar, true);
        window.addEventListener("scroll", renderSelectionOverlay, true);
        window.addEventListener("scroll", scheduleShellPopoverLayout, true);
      }

      // =====================================================================
