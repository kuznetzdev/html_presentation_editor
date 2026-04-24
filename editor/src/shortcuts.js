      // ZONE: Global Shortcuts & Window Events
      // Keyboard shortcuts, resize, scroll, blur, pointer-down handling
      // =====================================================================
      // KEYBINDINGS — declarative table of all keyboard shortcuts.
      // Each entry is a frozen object describing a single binding.
      // dispatch() iterates the table for each keydown event.
      // window.KEYBINDINGS is exposed for the cheat-sheet modal and tests.
      //
      // Fields per binding:
      //   id       — stable string identifier for tests / logging
      //   chord    — human-readable key chord for the cheat-sheet (Russian-friendly)
      //   label    — Russian label for the cheat-sheet; null means do not render in cheat-sheet
      //   group    — cheat-sheet section header
      //   always   — if true, fires even inside input/textarea
      //   when     — predicate(event) called AFTER isActiveTextEditingContext filter
      //              (bindings without `always` are already past the filter)
      //   handler  — function(event) called when `when` returns truthy (or when absent)
      // =====================================================================
      "use strict";

      // --- helpers declared inline so they are available at KEYBINDINGS build time ---

      function _isMod(e) { return e.ctrlKey || e.metaKey; }
      function _isTextEntity() {
        const k = (typeof getSelectedEntityKindForUi === "function") ? getSelectedEntityKindForUi() : null;
        return k === "text" || k === "table-cell";
      }
      function _hasSelection() {
        return !!(state.selectedNodeId && state.mode === "edit");
      }
      function _canFormatText() {
        return (
          state.mode === "edit" &&
          state.selectedNodeId &&
          _isTextEntity() &&
          state.selectedPolicy?.canEditStyles &&
          state.selectedPolicy?.canEditText
        );
      }
      function _canCopy() {
        return state.mode === "edit" && !!state.selectedNodeId;
      }

      // =====================================================================
      // Binding handlers — each is a thin wrapper that calls the real function
      // =====================================================================
      function _handleEscape(e) {
        if (state.activeManipulation) {
          e.preventDefault();
          cancelActiveManipulation();
          return;
        }
        closeContextMenu();
        if (els.htmlEditorModal?.classList.contains("is-open"))
          closeModal(els.htmlEditorModal);
        if (els.videoInsertModal?.classList.contains("is-open"))
          closeModal(els.videoInsertModal);
        if (els.shortcutsModal?.classList.contains("is-open"))
          closeModal(els.shortcutsModal);
      }

      function _handleHelp(e) {
        e.preventDefault();
        openModal(els.shortcutsModal);
      }
      function _handleUndo(e) { e.preventDefault(); undo(); }
      function _handleRedo(e) { e.preventDefault(); redo(); }
      function _handleDuplicate(e) { e.preventDefault(); duplicateSelectedElement(); }
      function _handleBold(e) { e.preventDefault(); toggleStyleOnSelected("fontWeight", "700", "400", "bold"); }
      function _handleItalic(e) { e.preventDefault(); toggleStyleOnSelected("fontStyle", "italic", "normal", "italic"); }
      function _handleUnderline(e) { e.preventDefault(); toggleStyleOnSelected("textDecoration", "underline", "none", "underline"); }
      function _handleAlignLeft(e) { e.preventDefault(); applyStyle("textAlign", "left"); }
      function _handleAlignCenter(e) { e.preventDefault(); applyStyle("textAlign", "center"); }
      function _handleAlignRight(e) { e.preventDefault(); applyStyle("textAlign", "right"); }
      function _handleCopy(e) { e.preventDefault(); copySelectedElement(); }
      function _handleCut(e) { e.preventDefault(); cutSelectedElement(); }
      function _handlePaste(e) { e.preventDefault(); pasteSelectedElement(); }
      function _handleCopyStyle(e) { e.preventDefault(); copySelectedStyle(); }
      function _handlePasteStyle(e) { e.preventDefault(); pasteStyleToSelected(); }
      function _handleZoomIn(e) { e.preventDefault(); stepZoom(1); }
      function _handleZoomOut(e) { e.preventDefault(); stepZoom(-1); }
      function _handleZoomReset(e) { e.preventDefault(); setPreviewZoom(1.0, true); }
      function _handleFind(e) { e.preventDefault(); openElementFinder(); }
      function _handleDelete(e) { e.preventDefault(); deleteSelectedElement(); }
      // [v1.3.4 / Phase D4] Group / ungroup / z-order keyboard shortcuts.
      function _handleGroup(e) {
        if (typeof groupSelectedElements !== "function") return;
        if (!state.multiSelectNodeIds || state.multiSelectNodeIds.length < 2) return;
        e.preventDefault();
        groupSelectedElements();
      }
      function _handleUngroup(e) {
        if (typeof ungroupSelectedElement !== "function") return;
        if (!state.selectedNodeId) return;
        e.preventDefault();
        ungroupSelectedElement();
      }
      function _handleBringForward(e) {
        if (!state.selectedNodeId) return;
        if (typeof window.moveLayerInStack !== "function") return;
        e.preventDefault();
        window.moveLayerInStack(state.selectedNodeId, "forward");
      }
      function _handleSendBackward(e) {
        if (!state.selectedNodeId) return;
        if (typeof window.moveLayerInStack !== "function") return;
        e.preventDefault();
        window.moveLayerInStack(state.selectedNodeId, "backward");
      }

      function _handleNudge(e) {
        // If focus is inside the slide rail, let the rail own arrow keys.
        if (e.target && e.target.closest("#slidesPanel")) return;
        e.preventDefault();
        const step = e.shiftKey ? DIRECT_MANIP_NUDGE_FAST_PX : DIRECT_MANIP_NUDGE_PX;
        if (e.key === "ArrowUp")    performKeyboardNudge(0, -step);
        if (e.key === "ArrowDown")  performKeyboardNudge(0,  step);
        if (e.key === "ArrowLeft")  performKeyboardNudge(-step, 0);
        if (e.key === "ArrowRight") performKeyboardNudge( step, 0);
      }

      // =====================================================================
      // KEYBINDINGS — frozen declarative table
      // ~22 entries matching every branch in the original if/else chain.
      // =====================================================================
      const KEYBINDINGS = Object.freeze([
        // Escape — always fires (even in text inputs via `always` flag)
        Object.freeze({
          id: "escape",
          chord: "Escape",
          label: "Закрыть / Отмена",
          group: "Навигация и выделение",
          always: true,
          when: function(e) { return e.key === "Escape"; },
          handler: _handleEscape,
        }),
        // ? — shortcut cheat-sheet
        Object.freeze({
          id: "help",
          chord: "?",
          label: "Эта справка",
          group: "Вид и экспорт",
          when: function(e) { return !_isMod(e) && e.key === "?"; },
          handler: _handleHelp,
        }),
        // Ctrl+Z — undo
        Object.freeze({
          id: "undo",
          chord: "Ctrl+Z",
          label: "Отменить",
          group: "Вид и экспорт",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "z"; },
          handler: _handleUndo,
        }),
        // Ctrl+Y / Ctrl+Shift+Z — redo
        Object.freeze({
          id: "redo",
          chord: "Ctrl+Y",
          label: "Повторить",
          group: "Вид и экспорт",
          when: function(e) {
            return (
              (_isMod(e) && e.key.toLowerCase() === "y") ||
              (_isMod(e) && e.shiftKey && e.key.toLowerCase() === "z")
            );
          },
          handler: _handleRedo,
        }),
        // Ctrl+D — duplicate
        Object.freeze({
          id: "duplicate",
          chord: "Ctrl+D",
          label: "Дублировать",
          group: "Элементы",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "d"; },
          handler: _handleDuplicate,
        }),
        // Ctrl+B — bold (text only)
        Object.freeze({
          id: "bold",
          chord: "Ctrl+B",
          label: "Жирный",
          group: "Редактирование текста",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "b" && _canFormatText(); },
          handler: _handleBold,
        }),
        // Ctrl+I — italic (text only)
        Object.freeze({
          id: "italic",
          chord: "Ctrl+I",
          label: "Курсив",
          group: "Редактирование текста",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "i" && _canFormatText(); },
          handler: _handleItalic,
        }),
        // Ctrl+U — underline (text only)
        Object.freeze({
          id: "underline",
          chord: "Ctrl+U",
          label: "Подчёркнутый",
          group: "Редактирование текста",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "u" && _canFormatText(); },
          handler: _handleUnderline,
        }),
        // Ctrl+L — align left (text only)
        Object.freeze({
          id: "align-left",
          chord: "Ctrl+L",
          label: "По левому краю",
          group: "Редактирование текста",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "l" && _canFormatText(); },
          handler: _handleAlignLeft,
        }),
        // Ctrl+E — align center (text only)
        Object.freeze({
          id: "align-center",
          chord: "Ctrl+E",
          label: "По центру",
          group: "Редактирование текста",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "e" && _canFormatText(); },
          handler: _handleAlignCenter,
        }),
        // Ctrl+R — align right (text only)
        Object.freeze({
          id: "align-right",
          chord: "Ctrl+R",
          label: "По правому краю",
          group: "Редактирование текста",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "r" && _canFormatText(); },
          handler: _handleAlignRight,
        }),
        // Ctrl+C — copy element
        Object.freeze({
          id: "copy",
          chord: "Ctrl+C",
          label: "Копировать элемент",
          group: "Элементы",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "c" && _canCopy(); },
          handler: _handleCopy,
        }),
        // Ctrl+X — cut element
        Object.freeze({
          id: "cut",
          chord: "Ctrl+X",
          label: "Вырезать элемент",
          group: "Элементы",
          when: function(e) { return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "x" && _canCopy(); },
          handler: _handleCut,
        }),
        // Ctrl+V — paste element
        Object.freeze({
          id: "paste",
          chord: "Ctrl+V",
          label: "Вставить элемент",
          group: "Элементы",
          when: function(e) {
            return (
              _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "v" &&
              state.mode === "edit" && !!state.copiedElementHtml
            );
          },
          handler: _handlePaste,
        }),
        // Ctrl+Shift+C — copy style
        Object.freeze({
          id: "copy-style",
          chord: "Ctrl+Shift+C",
          label: "Копировать стиль",
          group: "Элементы",
          when: function(e) { return _isMod(e) && e.shiftKey && e.key.toLowerCase() === "c"; },
          handler: _handleCopyStyle,
        }),
        // Ctrl+Shift+V — paste style
        Object.freeze({
          id: "paste-style",
          chord: "Ctrl+Shift+V",
          label: "Вставить стиль",
          group: "Элементы",
          when: function(e) { return _isMod(e) && e.shiftKey && e.key.toLowerCase() === "v"; },
          handler: _handlePasteStyle,
        }),
        // Ctrl++ / Ctrl+= — zoom in
        Object.freeze({
          id: "zoom-in",
          chord: "Ctrl++",
          label: "Увеличить масштаб",
          group: "Вид и экспорт",
          when: function(e) { return _isMod(e) && (e.key === "=" || e.key === "+"); },
          handler: _handleZoomIn,
        }),
        // Ctrl+- / Ctrl+_ — zoom out
        Object.freeze({
          id: "zoom-out",
          chord: "Ctrl+–",
          label: "Уменьшить масштаб",
          group: "Вид и экспорт",
          when: function(e) { return _isMod(e) && (e.key === "-" || e.key === "_"); },
          handler: _handleZoomOut,
        }),
        // Ctrl+0 — reset zoom
        Object.freeze({
          id: "zoom-reset",
          chord: "Ctrl+0",
          label: "Масштаб 100%",
          group: "Вид и экспорт",
          when: function(e) { return _isMod(e) && e.key === "0"; },
          handler: _handleZoomReset,
        }),
        // Arrow keys — nudge (edit mode with selection)
        Object.freeze({
          id: "nudge",
          chord: "↑ ↓ ← →",
          label: "Сдвинуть элемент на 1 px",
          group: "Навигация и выделение",
          when: function(e) {
            return (
              state.mode === "edit" &&
              !!state.selectedNodeId &&
              ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
            );
          },
          handler: _handleNudge,
        }),
        // Shift+Arrow — fast nudge (cheat-sheet entry only; handled by nudge binding above)
        Object.freeze({
          id: "nudge-fast",
          chord: "Shift+стрелки",
          label: "Сдвинуть на 10 px",
          group: "Навигация и выделение",
          when: null, // handled by `nudge` binding — this entry is cheat-sheet-only
          handler: null,
        }),
        // Delete / Backspace — delete element
        Object.freeze({
          id: "delete",
          chord: "Delete",
          label: "Удалить элемент",
          group: "Элементы",
          when: function(e) {
            return (
              (e.key === "Delete" || e.key === "Backspace") &&
              state.mode === "edit" &&
              !!state.selectedNodeId
            );
          },
          handler: _handleDelete,
        }),
        // Ctrl+F — find element
        Object.freeze({
          id: "find",
          chord: "Ctrl+F",
          label: "Найти элемент",
          group: "Вид и экспорт",
          when: function(e) {
            return _isMod(e) && e.key.toLowerCase() === "f" && state.mode === "edit";
          },
          handler: _handleFind,
        }),
        // [v1.3.4 / Phase D4] Ctrl+G — group multi-selection
        Object.freeze({
          id: "group",
          chord: "Ctrl+G",
          label: "Сгруппировать выделение",
          group: "Элементы",
          when: function(e) {
            return _isMod(e) && !e.shiftKey && e.key.toLowerCase() === "g" && state.mode === "edit";
          },
          handler: _handleGroup,
        }),
        // Ctrl+Shift+G — ungroup
        Object.freeze({
          id: "ungroup",
          chord: "Ctrl+Shift+G",
          label: "Расформировать группу",
          group: "Элементы",
          when: function(e) {
            return _isMod(e) && e.shiftKey && e.key.toLowerCase() === "g" && state.mode === "edit";
          },
          handler: _handleUngroup,
        }),
        // Ctrl+Shift+ArrowUp — bring forward
        Object.freeze({
          id: "bring-forward",
          chord: "Ctrl+Shift+↑",
          label: "Перенести слой вперёд",
          group: "Элементы",
          when: function(e) {
            return _isMod(e) && e.shiftKey && e.key === "ArrowUp" && state.mode === "edit";
          },
          handler: _handleBringForward,
        }),
        // Ctrl+Shift+ArrowDown — send backward
        Object.freeze({
          id: "send-backward",
          chord: "Ctrl+Shift+↓",
          label: "Отправить слой назад",
          group: "Элементы",
          when: function(e) {
            return _isMod(e) && e.shiftKey && e.key === "ArrowDown" && state.mode === "edit";
          },
          handler: _handleSendBackward,
        }),
      ]);

      // Expose for tests and cheat-sheet auto-render.
      window.KEYBINDINGS = KEYBINDINGS;

      // =====================================================================
      // dispatch — replaces the original if/else keydown chain.
      // Iterates KEYBINDINGS and fires the first matching handler.
      // =====================================================================
      async function _dispatch(event) {
        // Alt key passthrough (not a binding, handled separately).
        if (event.key === "Alt") {
          setSelectionPointerPassthrough(true);
          return;
        }

        for (const binding of KEYBINDINGS) {
          // `always` bindings fire even inside input/textarea/select.
          if (!binding.always) {
            if (isActiveTextEditingContext && isActiveTextEditingContext(event)) return;
            if (shouldIgnoreGlobalShortcut && shouldIgnoreGlobalShortcut(event)) return;
          }

          if (!binding.when || !binding.handler) continue;

          if (binding.when(event)) {
            binding.handler(event);
            return;
          }
        }
      }

      // =====================================================================
      // bindGlobalShortcuts — единое место для shell-hotkeys.
      // Важно: если фокус находится в input/textarea/select, обычный ввод не
      // перехватываем (обрабатывается внутри dispatch через isActiveTextEditingContext).
      // =====================================================================
      function bindGlobalShortcuts() {
        window.addEventListener("keydown", async (event) => {
          await _dispatch(event);
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
