      // floating-toolbar.js
      // Layer: Domain Logic (UI — Floating Toolbar)
      // Floating toolbar: state persistence, positioning, collapse, drag.
      // Extracted from selection.js (6 fns) + toolbar.js (1 fn) in v0.29.3 per PAIN-MAP P1-06.

      if (typeof getSelectionInteractionRect !== 'function') {
        throw new Error('floating-toolbar.js: required helper getSelectionInteractionRect not found — check script load order');
      }

      // =====================================================================
      // ZONE: Floating Toolbar
      // Context-sensitive floating toolbar: show/hide, position, disable/enable controls
      // =====================================================================
      function hasOpenCompactShellDrawer() {
        if (typeof isCompactShell !== "function" || !isCompactShell()) {
          return false;
        }
        return Boolean(state.leftPanelOpen || state.rightPanelOpen);
      }

      function shouldSuppressFloatingToolbarForShellSurface() {
        return (
          isContextMenuOpen() ||
          (typeof isInsertPaletteOpen === "function" && isInsertPaletteOpen()) ||
          (typeof isLayerPickerOpen === "function" && isLayerPickerOpen()) ||
          (typeof isSlideTemplateBarOpen === "function" && isSlideTemplateBarOpen()) ||
          (typeof isTopbarOverflowOpen === "function" && isTopbarOverflowOpen()) ||
          hasOpenCompactShellDrawer()
        );
      }

      function setFloatingToolbarControlState(control, visible, disabled) {
        if (!control) return;
        control.hidden = !visible;
        control.disabled = disabled;
      }

      function setFloatingToolbarGroupState(group, visible) {
        if (!group) return;
        group.hidden = !visible;
        group.setAttribute("aria-hidden", visible ? "false" : "true");
      }

      function getFloatingToolbarActionVisibility(entityKind, policy) {
        const isAdvanced = isAdvancedMode();
        const isText = entityKind === "text";
        const isTableCell = entityKind === "table-cell";
        const isCodeBlock = entityKind === "code-block";
        const isImage = entityKind === "image";
        const isVideo = entityKind === "video";
        const isStructural =
          entityKind === "container" ||
          entityKind === "element" ||
          entityKind === "slide-root";
        const canEditRichTextStyles =
          policy.canEditStyles &&
          policy.canEditText &&
          (isText || isTableCell);
        const canStartPlainTextEditing =
          state.selectedFlags.canEditText &&
          policy.canEditText &&
          (isText || isTableCell || isCodeBlock);
        const showReplaceImage = isImage && policy.canReplaceMedia;
        const showFitImage = isImage && policy.canEditStyles;
        const showCopyMediaUrl = isAdvanced && (isImage || isVideo);
        const showMediaUrl = isAdvanced && isVideo;
        const showCopyStyle =
          isAdvanced && policy.canEditStyles && (isText || isImage || isStructural);
        const showPasteStyle = showCopyStyle && Boolean(state.copiedStyle?.styles);

        return {
          canEditRichTextStyles,
          canStartPlainTextEditing,
          showGeneralGroup:
            policy.canDelete ||
            policy.canDuplicate ||
            showCopyStyle ||
            showPasteStyle,
          showDelete: policy.canDelete,
          showDuplicate: policy.canDuplicate && !isTableCell,
          showCopyStyle,
          showPasteStyle,
          showTextGroup: canStartPlainTextEditing || canEditRichTextStyles,
          showRichTextControls: canEditRichTextStyles,
          showAlignGroup: canEditRichTextStyles,
          showMediaGroup:
            showReplaceImage || showFitImage || showCopyMediaUrl || showMediaUrl,
          showReplaceImage,
          showFitImage,
          showCopyMediaUrl,
          showMediaUrl,
        };
      }

      function updateFloatingToolbarContext() {
        const hasSelection = Boolean(
          state.selectedNodeId && state.mode === "edit",
        );
        const policy = state.selectedPolicy || createDefaultSelectionPolicy();
        const compactLayout = document.body.dataset.toolbarLayout === "compact";
        const entityKind = hasSelection ? getSelectedEntityKindForUi() : "none";
        const visibility = getFloatingToolbarActionVisibility(entityKind, policy);
        const noSelection = !hasSelection;
        const noRichText = noSelection || !visibility.canEditRichTextStyles;
        const noPlainText = noSelection || !visibility.canStartPlainTextEditing;

        setFloatingToolbarControlState(
          els.ftHandleBtn,
          hasSelection && !compactLayout,
          compactLayout || noSelection,
        );
        setFloatingToolbarGroupState(
          els.ftGeneralGroup,
          hasSelection && visibility.showGeneralGroup,
        );
        setFloatingToolbarGroupState(
          els.ftTextGroup,
          hasSelection && visibility.showTextGroup,
        );
        setFloatingToolbarGroupState(
          els.ftAlignGroup,
          hasSelection && visibility.showAlignGroup,
        );
        setFloatingToolbarGroupState(
          els.ftMediaGroup,
          hasSelection && visibility.showMediaGroup,
        );

        setFloatingToolbarControlState(
          els.ftDeleteBtn,
          hasSelection && visibility.showDelete,
          noSelection || !policy.canDelete,
        );
        setFloatingToolbarControlState(
          els.ftDuplicateBtn,
          hasSelection && visibility.showDuplicate,
          noSelection || !policy.canDuplicate,
        );
        setFloatingToolbarControlState(
          els.ftCopyStyleBtn,
          hasSelection && visibility.showCopyStyle,
          noSelection || !policy.canEditStyles,
        );
        setFloatingToolbarControlState(
          els.ftPasteStyleBtn,
          hasSelection && visibility.showPasteStyle,
          noSelection || !policy.canEditStyles,
        );
        setFloatingToolbarControlState(
          els.ftEditTextBtn,
          hasSelection && visibility.canStartPlainTextEditing,
          noPlainText,
        );
        [els.ftBoldBtn, els.ftItalicBtn, els.ftUnderlineBtn].forEach((button) =>
          setFloatingToolbarControlState(
            button,
            hasSelection && visibility.showRichTextControls,
            noRichText,
          ),
        );
        [els.ftColorInput, els.ftFontFamilySelect, els.ftFontSizeSelect].forEach(
          (control) =>
            setFloatingToolbarControlState(
              control,
              hasSelection && visibility.showRichTextControls,
              noRichText,
            ),
        );
        [els.ftAlignLeftBtn, els.ftAlignCenterBtn, els.ftAlignRightBtn].forEach(
          (button) =>
            setFloatingToolbarControlState(
              button,
              hasSelection && visibility.showAlignGroup,
              noRichText,
            ),
        );
        setFloatingToolbarControlState(
          els.ftReplaceImageBtn,
          hasSelection && visibility.showReplaceImage,
          noSelection || !policy.canReplaceMedia,
        );
        setFloatingToolbarControlState(
          els.ftCopyImageUrlBtn,
          hasSelection && visibility.showCopyMediaUrl,
          noSelection,
        );
        setFloatingToolbarControlState(
          els.ftMediaUrlBtn,
          hasSelection && visibility.showMediaUrl,
          noSelection,
        );
        setFloatingToolbarControlState(
          els.ftFitImageBtn,
          hasSelection && visibility.showFitImage,
          noSelection || !policy.canEditStyles,
        );
      }

      function toggleFloatingToolbarCollapsed(force) {
        state.toolbarCollapsed =
          typeof force === "boolean" ? force : !state.toolbarCollapsed;
        els.floatingToolbar.dataset.collapsed = state.toolbarCollapsed
          ? "true"
          : "false";
        if (els.ftCollapseBtn)
          els.ftCollapseBtn.textContent = state.toolbarCollapsed ? "▸" : "▾";
        persistToolbarSession();
        positionFloatingToolbar();
      }

      function persistToolbarSession() {
        try {
          sessionStorage.setItem(
            TOOLBAR_SESSION_KEY,
            JSON.stringify({
              toolbarPinned: state.toolbarPinned,
              toolbarPos: state.toolbarPos,
              toolbarCollapsed: state.toolbarCollapsed,
            }),
          );
        } catch (error) {
          reportShellWarning("toolbar-session-save-failed", error, {
            once: true,
          });
        }
      }

      // ====================================================================
      // Floating toolbar
      // Плавающая панель умеет автопозиционироваться, перетаскиваться и запоминать
      // положение в sessionStorage, чтобы не перекрывать рабочую область.
      // ====================================================================
      function initFloatingToolbarState() {
        try {
          const raw = sessionStorage.getItem(TOOLBAR_SESSION_KEY);
          if (raw) {
            const payload = JSON.parse(raw);
            state.toolbarPinned = Boolean(payload.toolbarPinned);
            state.toolbarPos = payload.toolbarPos || null;
            state.toolbarCollapsed = Boolean(payload.toolbarCollapsed);
          }
        } catch (error) {
          reportShellWarning("toolbar-session-restore-failed", error, {
            once: true,
          });
        }
        toggleFloatingToolbarCollapsed(state.toolbarCollapsed);

        const onPointerMove = (event) => {
          if (!state.toolbarDragActive) return;
          const hostRect = els.previewStage.getBoundingClientRect();
          const nextX =
            event.clientX - hostRect.left - state.toolbarDragOffset.x;
          const nextY =
            event.clientY - hostRect.top - state.toolbarDragOffset.y;
          state.toolbarPos = clampToolbarPosition(nextX, nextY);
          els.floatingToolbar.style.left = `${state.toolbarPos.x}px`;
          els.floatingToolbar.style.top = `${state.toolbarPos.y}px`;
          els.floatingToolbar.classList.add("is-visible", "is-dragging");
        };

        const stopDragging = () => {
          if (!state.toolbarDragActive) return;
          state.toolbarDragActive = false;
          els.floatingToolbar.classList.remove("is-dragging");
          persistToolbarSession();
        };

        els.ftHandleBtn?.addEventListener("pointerdown", (event) => {
          if (!state.selectedNodeId) return;
          if (document.body.dataset.toolbarLayout === "compact") return;
          const rect = els.floatingToolbar.getBoundingClientRect();
          state.toolbarPinned = true;
          state.toolbarDragActive = true;
          state.toolbarDragOffset = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };
          try {
            els.ftHandleBtn.setPointerCapture(event.pointerId);
          } catch (error) {
            reportShellWarning("toolbar-pointer-capture-failed", error, {
              once: true,
              diagnostic: false,
            });
          }
        });
        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", stopDragging);
      }

      function clampToolbarPosition(x, y) {
        const hostRect = els.previewStage.getBoundingClientRect();
        const toolbarWidth = els.floatingToolbar.offsetWidth || 320;
        const toolbarHeight = els.floatingToolbar.offsetHeight || 46;
        return {
          x: Math.min(
            Math.max(8, x),
            Math.max(8, hostRect.width - toolbarWidth - 8),
          ),
          y: Math.min(
            Math.max(8, y),
            Math.max(8, hostRect.height - toolbarHeight - 8),
          ),
        };
      }

      function positionFloatingToolbar() {
        updateFloatingToolbarContext();
        const activeRect = getSelectionInteractionRect();
        if (
          state.mode !== "edit" ||
          !state.selectedNodeId ||
          !activeRect ||
          state.selectedFlags.isTextEditing ||
          shouldSuppressFloatingToolbarForShellSurface() ||
          Boolean(state.activeManipulation)
        ) {
          hideFloatingToolbar();
          return;
        }
        if (isCompactShell() && getSelectionPrimarySurface() !== "toolbar") {
          hideFloatingToolbar();
          return;
        }
        const iframeRect = els.previewFrame.getBoundingClientRect();
        const hostRect = els.previewStage.getBoundingClientRect();
        if (!iframeRect.width || !iframeRect.height) {
          hideFloatingToolbar();
          return;
        }
        const toolbar = els.floatingToolbar;
        toolbar.hidden = false;
        toolbar.setAttribute("aria-hidden", "false");
        toolbar.classList.add("is-visible");
        toolbar.classList.toggle(
          "is-pointer-transparent",
          Boolean(state.altSelectionPassthrough),
        );
        toolbar.style.right = "auto";
        toolbar.style.bottom = "auto";

        if (document.body.dataset.toolbarLayout === "compact") {
          const insets = getShellViewportInsets();
          const toolbarHeight = toolbar.offsetHeight || 52;
          const y = Math.max(
            insets.top,
            window.innerHeight - insets.bottom - toolbarHeight,
          );
          toolbar.style.left = `${Math.round(insets.left)}px`;
          toolbar.style.right = `${Math.round(insets.right)}px`;
          toolbar.style.top = `${Math.round(y)}px`;
          return;
        }

        if (state.toolbarPinned && state.toolbarPos) {
          const pos = clampToolbarPosition(
            state.toolbarPos.x,
            state.toolbarPos.y,
          );
          toolbar.style.left = `${pos.x}px`;
          toolbar.style.top = `${pos.y}px`;
          return;
        }

        // CSS zoom property handles coordinate scaling natively (v0.18.3)
        const left = iframeRect.left - hostRect.left + activeRect.left;
        const top = iframeRect.top - hostRect.top + activeRect.top;
        const toolbarHeight = toolbar.offsetHeight || 44;
        const toolbarWidth = toolbar.offsetWidth || 320;
        let x = left;
        let y = top - toolbarHeight - 8;
        const placeRight =
          activeRect.width < 140 &&
          left + activeRect.width + toolbarWidth + 12 < hostRect.width;
        if (placeRight) {
          x = left + activeRect.width + 8;
          y = top;
        }
        if (y < 8) y = top + activeRect.height + 8;
        const pos = clampToolbarPosition(x, y);
        toolbar.style.left = `${pos.x}px`;
        toolbar.style.top = `${pos.y}px`;
      }

      function hideFloatingToolbar() {
        els.floatingToolbar.classList.remove("is-visible");
        els.floatingToolbar.classList.remove("is-pointer-transparent");
        els.floatingToolbar.hidden = true;
        els.floatingToolbar.setAttribute("aria-hidden", "true");
        els.floatingToolbar.style.left = "-9999px";
        els.floatingToolbar.style.top = "-9999px";
        els.floatingToolbar.style.right = "auto";
        els.floatingToolbar.style.bottom = "auto";
      }

      // =====================================================================
