      // ZONE: Selection Overlay & Direct Manipulation
      // Selection frame, resize handles, keyboard nudge, drag-to-move
      // =====================================================================
      function renderSelectionOverlay() {
        if (!els.selectionOverlay || !els.selectionFrame) return;
        const visible = shouldShowSelectionOverlay();
        const pointerTransparent = Boolean(state.altSelectionPassthrough);
        els.selectionOverlay.setAttribute("aria-hidden", visible ? "false" : "true");
        els.selectionFrame.classList.toggle("is-visible", visible);
        els.selectionFrame.classList.toggle(
          "is-pointer-transparent",
          pointerTransparent,
        );
        els.selectionFrame.setAttribute("aria-hidden", visible ? "false" : "true");
        if (!visible) {
          els.selectionFrame.style.left = "-9999px";
          els.selectionFrame.style.top = "-9999px";
          els.selectionFrame.tabIndex = -1;
          renderSelectionFrameTooltip(null, false);
          clearSelectionGuides();
          renderSelectionGuides();
          return;
        }
        const stageRect = clipStageRectToPreviewViewport(
          toStageRect(getActiveSelectionRect()),
        );
        if (!stageRect) return;
        const isProtected = Boolean(
          !state.selectedPolicy.canMove && !state.selectedPolicy.canResize,
        );
        const directManipBlocked = hasBlockedDirectManipulationContext();
        const isCompact = stageRect.width < 112 || stageRect.height < 64;
        const isTiny = stageRect.width < 56 || stageRect.height < 56;
        const overlayLocked = Boolean(isProtected || directManipBlocked);
        els.selectionFrame.style.left = `${stageRect.left}px`;
        els.selectionFrame.style.top = `${stageRect.top}px`;
        els.selectionFrame.style.width = `${Math.max(0, stageRect.width)}px`;
        els.selectionFrame.style.height = `${Math.max(0, stageRect.height)}px`;
        els.selectionFrame.classList.toggle("is-protected", isProtected);
        els.selectionFrame.classList.toggle(
          "is-direct-manip-blocked",
          directManipBlocked,
        );
        els.selectionFrame.classList.toggle("is-compact", isCompact);
        els.selectionFrame.classList.toggle("is-tiny", isTiny);
        els.selectionFrame.classList.toggle(
          "is-engaged",
          Boolean(state.activeManipulation),
        );
        els.selectionFrame.tabIndex = visible ? 0 : -1;
        els.selectionFrame.setAttribute(
          "aria-label",
          overlayLocked
            ? directManipBlocked
              ? getDirectManipulationBlockMessage()
              : "Выбран защищённый элемент. Перемещение и изменение размера недоступны."
            : "Выбранный элемент. Перемещай мышью, изменяй размер ручками или стрелками.",
        );
        if (els.selectionFrameLabel)
          els.selectionFrameLabel.textContent = getSelectionFrameLabel();
        if (els.selectionFrameHitArea) {
          els.selectionFrameHitArea.style.pointerEvents = pointerTransparent
            ? "none"
            : "auto";
          els.selectionFrameHitArea.style.cursor = overlayLocked
            ? "not-allowed"
            : directManipBlocked
            ? "not-allowed"
            : state.activeManipulation?.kind === "drag"
              ? "grabbing"
              : "grab";
          els.selectionFrameHitArea.title = overlayLocked
            ? directManipBlocked
              ? getDirectManipulationBlockMessage()
              : "Этот элемент защищён от перемещения и resize"
            : state.selectedFlags.canEditText
              ? "Перетащить элемент или дважды кликнуть для редактирования текста"
              : "Перетащить выбранный элемент";
        }
        els.selectionHandles.forEach((handle) => {
          handle.disabled = !state.selectedPolicy.canResize || directManipBlocked;
          handle.style.pointerEvents = pointerTransparent ? "none" : "";
        });
        renderSelectionFrameTooltip(stageRect, visible);
        renderSelectionGuides();
      }

      function syncSelectionPointerPassthrough() {
        const enabled = Boolean(state.altSelectionPassthrough);
        if (els.selectionFrame) {
          els.selectionFrame.classList.toggle("is-pointer-transparent", enabled);
        }
        if (els.floatingToolbar) {
          els.floatingToolbar.classList.toggle("is-pointer-transparent", enabled);
        }
      }

      function setSelectionPointerPassthrough(enabled) {
        const nextEnabled = Boolean(enabled);
        if (state.altSelectionPassthrough === nextEnabled) return;
        state.altSelectionPassthrough = nextEnabled;
        syncSelectionPointerPassthrough();
        renderSelectionOverlay();
      }

      function proxySelectionAtPreviewPoint(clientX, clientY, options = {}) {
        if (!state.previewReady || !state.bridgeAlive || !els.previewFrame) {
          return false;
        }
        const frameRect = els.previewFrame.getBoundingClientRect();
        const localX = Number(clientX) - frameRect.left;
        const localY = Number(clientY) - frameRect.top;
        if (
          !Number.isFinite(localX) ||
          !Number.isFinite(localY) ||
          localX < 0 ||
          localY < 0 ||
          localX > frameRect.width ||
          localY > frameRect.height
        ) {
          return false;
        }
        // [LAYER-MODEL v2] forward containerMode flag
        return sendToBridge("proxy-select-at-point", {
          clientX: localX,
          clientY: localY,
          cycleAncestors: Boolean(options.cycleAncestors),
          containerMode: state.selectionMode === "container",
        });
      }

      function openContextMenuForCurrentSelection(clientX, clientY) {
        if (!state.selectedNodeId) return;
        closeShellPanels({ keep: "context-menu" });
        closeTransientShellUi({ keep: "context-menu" });
        hideFloatingToolbar();
        const payload = {
          nodeId: state.selectedNodeId,
          slideId: state.activeSlideId,
          isImage: state.selectedFlags.isImage,
          isVideo: state.selectedFlags.isVideo,
          canEditText: state.selectedFlags.canEditText,
          isContainer: state.selectedFlags.isContainer,
          isSlideRoot: state.selectedFlags.isSlideRoot,
          isProtected: state.selectedFlags.isProtected,
          origin: "shell",
          shellClientX: clientX,
          shellClientY: clientY,
        };
        state.contextMenuNodeId = state.selectedNodeId;
        state.contextMenuPayload = payload;
        renderContextMenu(payload);
        positionContextMenu(clientX, clientY);
        els.contextMenu.classList.add("is-open");
        els.contextMenu.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() => getContextMenuButtons()[0]?.focus({ preventScroll: true }));
      }

      function collectSnapAxisValues(session, axis) {
        const values = [];
        const seen = new Set();
        const pushValue = (value) => {
          const number = Number(value);
          if (!Number.isFinite(number)) return;
          const key = String(Math.round(number * 10) / 10);
          if (seen.has(key)) return;
          seen.add(key);
          values.push(number);
        };
        const addRectValues = (rect) => {
          if (!rect) return;
          if (axis === "x") {
            pushValue(rect.left);
            pushValue(rect.centerX);
            pushValue(rect.right);
          } else {
            pushValue(rect.top);
            pushValue(rect.centerY);
            pushValue(rect.bottom);
          }
        };
        addRectValues(cloneRect(session.snapRect || session.slideRect));
        (session.snapTargets || []).forEach((target) => addRectValues(cloneRect(target)));
        return values;
      }

      function resolveAxisSnap(pointValues, targetValues) {
        let best = null;
        pointValues.forEach((point) => {
          targetValues.forEach((target) => {
            const delta = target - point;
            if (Math.abs(delta) > DIRECT_MANIP_SNAP_PX) return;
            if (!best || Math.abs(delta) < Math.abs(best.delta)) {
              best = { delta, target };
            }
          });
        });
        return best;
      }

      function applySnapToRect(session, rect, handle = null) {
        let nextRect = cloneRect(rect);
        const guides = { vertical: [], horizontal: [] };
        if (!nextRect) return { rect: nextRect, guides };
        const xPoints = [];
        const yPoints = [];
        if (session.kind === "drag") {
          xPoints.push(nextRect.left, nextRect.centerX, nextRect.right);
          yPoints.push(nextRect.top, nextRect.centerY, nextRect.bottom);
        } else {
          if ((handle || "").includes("w")) xPoints.push(nextRect.left);
          if ((handle || "").includes("e")) xPoints.push(nextRect.right);
          if ((handle || "").includes("n")) yPoints.push(nextRect.top);
          if ((handle || "").includes("s")) yPoints.push(nextRect.bottom);
        }
        const xSnap = resolveAxisSnap(
          xPoints,
          collectSnapAxisValues(session, "x"),
        );
        if (xSnap) {
          nextRect = cloneRect({
            left: nextRect.left + xSnap.delta,
            top: nextRect.top,
            width: nextRect.width,
            height: nextRect.height,
          });
          guides.vertical.push(xSnap.target);
        }
        const ySnap = resolveAxisSnap(
          yPoints,
          collectSnapAxisValues(session, "y"),
        );
        if (ySnap) {
          nextRect = cloneRect({
            left: nextRect.left,
            top: nextRect.top + ySnap.delta,
            width: nextRect.width,
            height: nextRect.height,
          });
          guides.horizontal.push(ySnap.target);
        }
        return { rect: nextRect, guides };
      }

      function applyAspectRatioToResize(session, rect, handle, rawDx, rawDy) {
        const ratio = Math.max(0.1, Number(session.aspectRatio || 1));
        const anchorRight = session.startRect.right;
        const anchorBottom = session.startRect.bottom;
        const anchorLeft = session.startRect.left;
        const anchorTop = session.startRect.top;
        let width = rect.width;
        let height = rect.height;
        const useWidth =
          Math.abs(rawDx) >= Math.abs(rawDy) || handle === "e" || handle === "w";
        if (useWidth) {
          height = Math.max(DIRECT_MANIP_MIN_SIZE_PX, width / ratio);
        } else {
          width = Math.max(DIRECT_MANIP_MIN_SIZE_PX, height * ratio);
        }
        let left = rect.left;
        let top = rect.top;
        if (handle.includes("w")) left = anchorRight - width;
        else if (!handle.includes("e"))
          left = session.startRect.centerX - width / 2;
        else left = anchorLeft;
        if (handle.includes("n")) top = anchorBottom - height;
        else if (!handle.includes("s"))
          top = session.startRect.centerY - height / 2;
        else top = anchorTop;
        return cloneRect({ left, top, width, height });
      }

      function computeManipulationPayload(session, event) {
        const rawDx = event.clientX - session.startClientX;
        const rawDy = event.clientY - session.startClientY;
        if (session.kind === "drag") {
          const baseRect = cloneRect({
            left: session.startRect.left + rawDx,
            top: session.startRect.top + rawDy,
            width: session.startRect.width,
            height: session.startRect.height,
          });
          const snapped = applySnapToRect(session, baseRect);
          const nextRect = snapped.rect;
          return {
            rect: nextRect,
            guides: snapped.guides,
            bridgePayload: {
              nodeId: session.bridgeTargetNodeId,
              selectionNodeId: session.selectionNodeId,
              selectionLeafNodeId: session.selectionLeafNodeId,
              selectionPathNodeIds: session.selectionPathNodeIds,
              kind: "drag",
              dx: nextRect.left - session.startRect.left,
              dy: nextRect.top - session.startRect.top,
            },
          };
        }

        let left = session.startRect.left;
        let top = session.startRect.top;
        let width = session.startRect.width;
        let height = session.startRect.height;
        const handle = session.handle || "se";
        if (handle.includes("e")) width = session.startRect.width + rawDx;
        if (handle.includes("s")) height = session.startRect.height + rawDy;
        if (handle.includes("w")) {
          width = session.startRect.width - rawDx;
          left = session.startRect.right - width;
        }
        if (handle.includes("n")) {
          height = session.startRect.height - rawDy;
          top = session.startRect.bottom - height;
        }
        width = Math.max(DIRECT_MANIP_MIN_SIZE_PX, width);
        height = Math.max(DIRECT_MANIP_MIN_SIZE_PX, height);
        let nextRect = cloneRect({ left, top, width, height });
        const preserveAspect = state.selectedFlags.isImage && !event.shiftKey;
        if (preserveAspect) {
          nextRect = applyAspectRatioToResize(
            session,
            nextRect,
            handle,
            rawDx,
            rawDy,
          );
        }
        const snapped = applySnapToRect(session, nextRect, handle);
        nextRect = snapped.rect;
        return {
          rect: nextRect,
          guides: snapped.guides,
          bridgePayload: {
            nodeId: session.bridgeTargetNodeId,
            selectionNodeId: session.selectionNodeId,
            selectionLeafNodeId: session.selectionLeafNodeId,
            selectionPathNodeIds: session.selectionPathNodeIds,
            kind: "resize",
            dx: nextRect.left - session.startRect.left,
            dy: nextRect.top - session.startRect.top,
            width: nextRect.width,
            height: nextRect.height,
          },
        };
      }

      function flushActiveManipulationBridgeUpdate() {
        const session = state.activeManipulation;
        if (!session) return;
        if (session.bridgeRafId) {
          cancelAnimationFrame(session.bridgeRafId);
          session.bridgeRafId = 0;
        }
        if (!session.pendingBridgePayload) return;
        if (!session.bridgeBegun) {
          sendToBridge("begin-direct-manipulation", {
            nodeId: session.bridgeTargetNodeId,
            selectionNodeId: session.selectionNodeId,
            selectionLeafNodeId: session.selectionLeafNodeId,
            selectionPathNodeIds: session.selectionPathNodeIds,
            kind: session.kind,
          });
          session.bridgeBegun = true;
        }
        sendToBridge("update-direct-manipulation", session.pendingBridgePayload);
        session.pendingBridgePayload = null;
      }

      function queueActiveManipulationBridgeUpdate(payload) {
        const session = state.activeManipulation;
        if (!session) return;
        session.pendingBridgePayload = payload;
        if (session.bridgeRafId) return;
        session.bridgeRafId = requestAnimationFrame(() => {
          session.bridgeRafId = 0;
          flushActiveManipulationBridgeUpdate();
        });
      }

      function finishActiveManipulation(options = {}) {
        const session = state.activeManipulation;
        if (!session) return;
        const cancel = Boolean(options.cancel);
        const keepPreviewRect = Boolean(session.started && !cancel && session.liveRect);
        if (session.sourceEl?.releasePointerCapture) {
          try {
            session.sourceEl.releasePointerCapture(session.pointerId);
          } catch (error) {
            // Pointer capture may already be gone when the browser aborts the gesture.
          }
        }
        if (session.started && !cancel) {
          flushActiveManipulationBridgeUpdate();
          if (session.bridgeBegun) {
            sendToBridge("commit-direct-manipulation", {
              nodeId: session.bridgeTargetNodeId,
              selectionNodeId: session.selectionNodeId,
              selectionLeafNodeId: session.selectionLeafNodeId,
              selectionPathNodeIds: session.selectionPathNodeIds,
              kind: session.kind,
            });
          }
          state.liveSelectionRect = keepPreviewRect ? cloneRect(session.liveRect) : null;
        } else if (session.bridgeBegun && cancel) {
          sendToBridge("cancel-direct-manipulation", {
            nodeId: session.bridgeTargetNodeId,
            selectionNodeId: session.selectionNodeId,
            selectionLeafNodeId: session.selectionLeafNodeId,
            selectionPathNodeIds: session.selectionPathNodeIds,
          });
          state.liveSelectionRect = null;
        }
        state.activeManipulation = null;
        if (cancel || session.started) {
          state.pendingOverlayClickProxy = false;
        }
        clearSelectionGuides();
        if (!cancel) {
          hideSelectionFrameTooltip({ clearMessage: true });
        }
        setInteractionMode("select");
        renderSelectionOverlay();
        if (!cancel && session.started) {
          scheduleOverlapDetection("direct-manip-commit");
        }
      }

      function cancelActiveManipulation() {
        finishActiveManipulation({ cancel: true });
      }

      function handleActiveManipulationMove(event) {
        const session = state.activeManipulation;
        if (!session || event.pointerId !== session.pointerId) return;
        event.preventDefault();
        const deltaX = event.clientX - session.startClientX;
        const deltaY = event.clientY - session.startClientY;
        if (!session.started) {
          if (Math.hypot(deltaX, deltaY) < DIRECT_MANIP_THRESHOLD_PX) return;
          session.started = true;
          setInteractionMode(session.kind === "resize" ? "resize" : "drag");
        }
        const next = computeManipulationPayload(session, event);
        session.liveRect = cloneRect(next.rect);
        state.liveSelectionRect = cloneRect(next.rect);
        state.activeGuides = next.guides;
        renderSelectionOverlay();
        queueActiveManipulationBridgeUpdate(next.bridgePayload);
      }

      function handleActiveManipulationEnd(event) {
        const session = state.activeManipulation;
        if (!session) return;
        if (event.pointerId !== session.pointerId) return;
        event.preventDefault();
        state.pendingOverlayClickProxy = !session.started;
        finishActiveManipulation();
      }

      function startActiveManipulation(kind, event, handle = null) {
        state.pendingOverlayClickProxy = false;
        const action = kind === "resize" ? "resize" : "move";
        if (
          !guardSelectionAction(
            action,
            kind === "resize" ? "Изменение размера" : "Перемещение",
            {
              surface: "tooltip",
              toast: false,
            },
          )
        ) {
          event.preventDefault();
          event.stopPropagation();
          if (els.selectionFrame) {
            els.selectionFrame.focus({ preventScroll: true });
          }
          return;
        }
        if (!canDirectManipulateSelection(kind === "resize" ? "resize" : "drag")) {
          event.preventDefault();
          event.stopPropagation();
          guardSelectionAction(
            action,
            kind === "resize" ? "Изменение размера" : "Перемещение",
          );
          if (els.selectionFrame) {
            els.selectionFrame.focus({ preventScroll: true });
          }
          return;
        }
        const startRect = getSelectionInteractionRect();
        if (!startRect) return;
        closeContextMenu();
        closeInsertPalette();
        hideSelectionFrameTooltip({ clearMessage: true });
        const sourceEl = event.currentTarget;
        const bridgeTargetNodeId = getManipulationTargetNodeId();
        if (!bridgeTargetNodeId) return;
        const selectionPathNodeIds = Array.isArray(state.selectionPath)
          ? state.selectionPath
              .map((entry) => String(entry?.nodeId || "").trim())
              .filter(Boolean)
          : [];
        state.activeManipulation = {
          kind,
          handle,
          pointerId: event.pointerId,
          sourceEl,
          started: false,
          bridgeBegun: false,
          bridgeRafId: 0,
          pendingBridgePayload: null,
          bridgeTargetNodeId,
          selectionNodeId: state.selectedNodeId,
          selectionLeafNodeId:
            String(state.selectionLeafNodeId || state.selectedNodeId || "").trim() ||
            bridgeTargetNodeId,
          selectionPathNodeIds,
          startClientX: event.clientX,
          startClientY: event.clientY,
          startRect,
          liveRect: cloneRect(startRect),
          slideRect: cloneRect(state.manipulationContext?.slideRect),
          snapRect: cloneRect(state.manipulationContext?.snapRect || state.manipulationContext?.slideRect),
          snapTargets: Array.isArray(state.manipulationContext?.snapTargets)
            ? state.manipulationContext.snapTargets.map((target) => cloneRect(target))
            : [],
          aspectRatio: Number(state.manipulationContext?.aspectRatio || (startRect.width / Math.max(1, startRect.height))),
        };
        state.liveSelectionRect = cloneRect(startRect);
        clearSelectionGuides();
        renderSelectionOverlay();
        event.preventDefault();
        event.stopPropagation();
        if (sourceEl?.setPointerCapture) {
          try {
            sourceEl.setPointerCapture(event.pointerId);
          } catch (error) {
            // Best-effort pointer capture; some engines reject it for detached or passive targets.
          }
        }
      }

      function performKeyboardNudge(dx, dy) {
        if (!guardSelectionAction("nudge", "Сдвиг")) return;
        if (!canDirectManipulateSelection("drag")) return;
        const bridgeTargetNodeId = getManipulationTargetNodeId();
        if (!bridgeTargetNodeId) return;
        const payload = buildSelectionBridgePayload(bridgeTargetNodeId, {
          focusText: false,
        });
        if (!payload) return;
        payload.dx = dx;
        payload.dy = dy;
        sendToBridge("nudge-element", payload);
      }

      function bindSelectionOverlayInteractions() {
        if (!els.selectionFrame || !els.selectionFrameHitArea) return;
        els.selectionFrameHitArea.addEventListener("pointerdown", (event) => {
          if (event.altKey) {
            state.pendingOverlayClickProxy = false;
            event.preventDefault();
            event.stopPropagation();
            proxySelectionAtPreviewPoint(event.clientX, event.clientY, {
              cycleAncestors: true,
            });
            return;
          }
          startActiveManipulation("drag", event);
          els.selectionFrame.focus({ preventScroll: true });
        });
        els.selectionFrameHitArea.addEventListener("dblclick", (event) => {
          if (!state.selectedFlags.canEditText || !state.selectedPolicy.canEditText)
            return;
          event.preventDefault();
          startTextEditing();
          setInteractionMode("text-edit");
          renderSelectionOverlay();
        });
        els.selectionFrameHitArea.addEventListener("click", (event) => {
          if (event.altKey || event.ctrlKey || event.metaKey) {
            state.pendingOverlayClickProxy = false;
            return;
          }
          if (!state.pendingOverlayClickProxy) return;
          state.pendingOverlayClickProxy = false;
          if (!proxySelectionAtPreviewPoint(event.clientX, event.clientY)) return;
          event.preventDefault();
          event.stopPropagation();
          els.selectionFrame.focus({ preventScroll: true });
        });
        els.selectionFrameHitArea.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          openContextMenuForCurrentSelection(event.clientX, event.clientY);
        });
        els.selectionFrame.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && !state.selectedFlags.isTextEditing) {
            event.preventDefault();
            sendToBridge("reset-click-through", {});
            return;
          }
          if (
            event.key === "Tab" &&
            !state.selectedFlags.isTextEditing &&
            hasTableCellSelection()
          ) {
            event.preventDefault();
            navigateSelectedTableCell(event.shiftKey ? "previous" : "next");
            return;
          }
          if (event.key === "Enter" && event.shiftKey && !state.selectedFlags.isTextEditing) {
            event.preventDefault();
            const _shPath = state.selectionPath || [];
            const _shCurIdx = _shPath.findIndex(
              (e) => (e.selectionNodeId || e.nodeId) === state.selectedNodeId,
            );
            const _shParent =
              _shCurIdx !== -1 && _shCurIdx < _shPath.length - 1
                ? _shPath[_shCurIdx + 1]
                : null;
            if (_shParent) {
              sendToBridge("select-element", {
                nodeId: _shParent.selectionNodeId || _shParent.nodeId,
              });
            }
            return;
          }
          if (event.key === "Enter" && !event.shiftKey && !state.selectedFlags.isTextEditing) {
            if (!state.selectedFlags.canEditText) {
              event.preventDefault();
              sendToBridge("select-best-child-of", { nodeId: state.selectedNodeId });
              return;
            }
            if (state.selectedFlags.canEditText && state.selectedPolicy.canEditText) {
              event.preventDefault();
              startTextEditing();
              setInteractionMode("text-edit");
              renderSelectionOverlay();
            }
            return;
          }
        });
        els.selectionHandles.forEach((handle) => {
          handle.addEventListener("pointerdown", (event) => {
            startActiveManipulation(
              "resize",
              event,
              handle.dataset.handle || "se",
            );
            els.selectionFrame.focus({ preventScroll: true });
          });
        });
        els.floatingToolbar?.addEventListener(
          "pointerdown",
          (event) => {
            if (!event.altKey) return;
            event.preventDefault();
            event.stopPropagation();
            proxySelectionAtPreviewPoint(event.clientX, event.clientY, {
              cycleAncestors: true,
            });
          },
          true,
        );
        window.addEventListener("pointermove", handleActiveManipulationMove, {
          passive: false,
        });
        window.addEventListener("pointerup", handleActiveManipulationEnd, {
          passive: false,
        });
        window.addEventListener("pointercancel", () => {
          if (state.activeManipulation) cancelActiveManipulation();
        });
      }

      function copyAttributes(source, target, options = {}) {
        const omit = new Set(options.omit || []);
        Array.from(source.attributes || []).forEach((attr) => {
          if (omit.has(attr.name)) return;
          if (/^data-editor-/.test(attr.name)) return;
          if (attr.name === "contenteditable" || attr.name === "spellcheck")
            return;
          target.setAttribute(attr.name, attr.value);
        });
      }

      function replaceSelectedNodeHtml(html, toastMessage = "") {
        if (!state.selectedNodeId) return;
        if (!guardSelectionAction("editHtml", "Редактирование HTML", { toast: false }))
          return;
        sendToBridge("replace-node-html", {
          nodeId: state.selectedNodeId,
          html,
        });
        if (toastMessage)
          showToast(toastMessage, "success", { title: "Изменение применено" });
        closeContextMenu();
      }

      function copySelectedStyle() {
        if (!state.selectedNodeId || !state.selectedComputed) return;
        const styles = {};
        [
          "color",
          "backgroundColor",
          "fontSize",
          "fontWeight",
          "fontStyle",
          "textDecoration",
          "textAlign",
          "display",
          "position",
          "left",
          "top",
          "width",
          "height",
          "maxWidth",
          "margin",
          "padding",
          "borderColor",
          "borderWidth",
          "borderStyle",
          "borderRadius",
          "objectFit",
          "transform",
          "zIndex",
        ].forEach((key) => {
          const value = state.selectedComputed?.[key];
          if (
            value &&
            value !== "none" &&
            value !== "normal" &&
            value !== "auto" &&
            value !== "0px"
          ) {
            styles[key] = value;
          }
        });
        state.copiedStyle = {
          styles,
          copiedAt: Date.now(),
          sourceTag: state.selectedTag,
        };
        try {
          localStorage.setItem(
            COPIED_STYLE_KEY,
            JSON.stringify(state.copiedStyle),
          );
        } catch (error) {
          reportShellWarning("copied-style-save-failed", error, { once: true });
        }
        showToast("Стиль элемента скопирован в буфер редактора.", "success", {
          title: "Копировать стиль",
        });
        closeContextMenu();
      }

      function pasteStyleToSelected() {
        if (!state.selectedNodeId || !state.copiedStyle?.styles) return;
        if (!guardSelectionAction("editStyles", "Вставить стиль")) return;
        sendToBridge("apply-styles", {
          nodeId: state.selectedNodeId,
          styles: state.copiedStyle.styles,
        });
        flashSelectedElement();
        showToast("Стиль применён к выбранному элементу.", "success", {
          title: "Вставить стиль",
        });
        closeContextMenu();
      }

      // ====================================================================
      // Element clipboard — internal Ctrl+C / Ctrl+V (not OS clipboard)
      // Copies the selected element's HTML into state.copiedElementHtml,
      // strips data-editor-node-id so the bridge's assignIdsDeep gives
      // the pasted clone entirely fresh IDs (no ID collision).
      // ====================================================================
      function copySelectedElement() {
        if (!state.modelDoc || !state.selectedNodeId) return;
        const el = state.modelDoc.querySelector(
          `[data-editor-node-id="${cssEscape(state.selectedNodeId)}"]`,
        );
        if (!el) return;
        const clone = el.cloneNode(true);
        // Strip all editor-node IDs so the pasted clone gets fresh ones
        clone.removeAttribute("data-editor-node-id");
        clone.querySelectorAll("[data-editor-node-id]").forEach((node) => {
          node.removeAttribute("data-editor-node-id");
        });
        state.copiedElementHtml = clone.outerHTML;
        showToast("Элемент скопирован — Ctrl+V для вставки.", "success", {
          title: "Копировать",
        });
        closeContextMenu();
      }

      function pasteSelectedElement() {
        if (!state.copiedElementHtml) return;
        if (!state.modelDoc) return;
        insertHtmlViaBridge(state.copiedElementHtml, { focusText: false });
        showToast("Элемент вставлен.", "success", { title: "Вставить" });
      }

      function cutSelectedElement() {
        if (!state.modelDoc || !state.selectedNodeId) return;
        if (!guardSelectionAction("delete", "Вырезать")) return;
        if (!guardProtectedSelection("Вырезать")) return;
        copySelectedElement();   // copies to buffer — shows toast
        sendToBridge("delete-element", { nodeId: state.selectedNodeId });
        showToast("Элемент вырезан — Ctrl+V для вставки.", "success", { title: "Вырезать" });
        closeContextMenu();
        hideFloatingToolbar();
      }

      function fitSelectedImageToWidth() {
        if (!state.selectedFlags.isImage || !state.selectedNodeId) return;
        if (!guardSelectionAction("editStyles", "Медиа")) return;
        sendToBridge("apply-styles", {
          nodeId: state.selectedNodeId,
          styles: {
            display: "block",
            width: "100%",
            maxWidth: "100%",
            height: "auto",
          },
        });
        flashSelectedElement();
        showToast("Изображение вписано по ширине.", "success", {
          title: "Медиа",
        });
        closeContextMenu();
      }

      function resetSelectedImageSize() {
        if (!state.selectedFlags.isImage || !state.selectedNodeId) return;
        if (!guardSelectionAction("editStyles", "Медиа")) return;
        sendToBridge("apply-styles", {
          nodeId: state.selectedNodeId,
          styles: { width: "", height: "", maxWidth: "", objectFit: "" },
        });
        showToast("Inline-размеры изображения сброшены.", "success", {
          title: "Медиа",
        });
        closeContextMenu();
      }

      async function copySelectedImageUrl() {
        if (!state.selectedFlags.isImage && !state.selectedFlags.isVideo)
          return;
        const src = state.selectedAttrs.src || "";
        if (!src) return;
        await copyTextWithShellFeedback(src, {
          title: "Медиа",
          successMessage: "URL изображения скопирован в буфер обмена.",
          failureMessage:
            "Не удалось скопировать URL автоматически. Попробуйте ещё раз из контекстного меню.",
        });
        closeContextMenu();
      }

      function openSelectedImageInNewTab() {
        if (!state.selectedFlags.isImage) return;
        const src = state.selectedAttrs.src || "";
        if (!src) return;
        window.open(src, "_blank", "noopener,noreferrer");
        closeContextMenu();
      }

      // openSelectedMediaInNewTab / editSelectedMediaUrl — универсальные helpers для
      // iframe/video media. Для изображений остаётся отдельная функция выше.
      function openSelectedMediaInNewTab() {
        const src = state.selectedAttrs.src || "";
        if (!src) return;
        window.open(src, "_blank", "noopener,noreferrer");
        closeContextMenu();
      }

      function editSelectedMediaUrl() {
        if (!state.selectedNodeId || !state.selectedFlags.isVideo) return;
        if (!guardSelectionAction("editAttributes", "Видео")) return;
        const current = state.selectedAttrs.src || "";
        const next = prompt("Новый URL для видео / iframe", current);
        if (next === null) return;
        updateAttributes({ src: next.trim() });
        showToast("URL видео обновлён.", "success", { title: "Видео" });
        closeContextMenu();
      }

      function rotateSelectedImage(deltaDegrees = 90) {
        if (!state.selectedFlags.isImage || !state.selectedNodeId) return;
        if (!guardSelectionAction("editStyles", "Медиа")) return;
        const node = getSelectedModelNode();
        const current = node?.style?.transform || "";
        const match = current.match(/rotate\((-?\d+)deg\)/i);
        const angle = (match ? Number(match[1]) : 0) + deltaDegrees;
        const withoutRotate = current.replace(/rotate\([^)]*\)/gi, "").trim();
        const transform = `${withoutRotate} rotate(${angle}deg)`.trim();
        sendToBridge("apply-style", {
          nodeId: state.selectedNodeId,
          styleName: "transform",
          value: transform,
        });
        showToast("Изображение повернуто на 90°.", "success", {
          title: "Медиа",
        });
      }

      function flipSelectedImage() {
        if (!state.selectedFlags.isImage || !state.selectedNodeId) return;
        if (!guardSelectionAction("editStyles", "Медиа")) return;
        const node = getSelectedModelNode();
        const current = node?.style?.transform || "";
        const hasFlip = /scaleX\(-1\)/.test(current);
        const transform = hasFlip
          ? current.replace(/scaleX\(-1\)/g, "").trim()
          : `${current} scaleX(-1)`.trim();
        sendToBridge("apply-style", {
          nodeId: state.selectedNodeId,
          styleName: "transform",
          value: transform,
        });
        showToast(
          hasFlip ? "Отражение убрано." : "Отражение применено.",
          "success",
          { title: "Медиа" },
        );
      }

      async function copySelectedText() {
        const node = getSelectedModelNode();
        const text = node?.textContent?.trim() || "";
        if (!text) return;
        await copyTextWithShellFeedback(text, {
          title: "Текст",
          successMessage: "Текст скопирован в буфер обмена.",
          failureMessage:
            "Не удалось скопировать текст автоматически. Попробуйте ещё раз из контекстного меню.",
        });
        closeContextMenu();
      }

      async function cutSelectedText() {
        const node = getSelectedModelNode();
        const text = node?.textContent || "";
        if (!node || !state.selectedFlags.canEditText) return;
        try {
          await navigator.clipboard.writeText(text);
        } catch (error) {
          // Continue with the cut even when clipboard permissions are denied.
        }
        const replacement = node.ownerDocument.createElement(node.tagName);
        copyAttributes(node, replacement);
        replacement.textContent = "";
        replaceSelectedNodeHtml(replacement.outerHTML, "Текст вырезан.");
      }

      async function pasteClipboardAsText() {
        if (!state.selectedFlags.canEditText) return;
        let text = "";
        try {
          text = await navigator.clipboard.readText();
        } catch (error) {
          showToast("Браузер не дал доступ к буферу обмена.", "warning", {
            title: "Вставка текста",
          });
          return;
        }
        const node = getSelectedModelNode();
        if (!node) return;
        const replacement = node.ownerDocument.createElement(node.tagName);
        copyAttributes(node, replacement);
        replacement.textContent = text;
        replaceSelectedNodeHtml(
          replacement.outerHTML,
          "Текст вставлен без стилей.",
        );
      }

      function transformSelectedTag(tagName) {
        const node = getSelectedModelNode();
        if (!node) return;
        const replacement = node.ownerDocument.createElement(
          tagName.toUpperCase(),
        );
        copyAttributes(node, replacement);
        replacement.innerHTML = node.innerHTML;
        replaceSelectedNodeHtml(
          replacement.outerHTML,
          `Элемент преобразован в ${tagName.toUpperCase()}.`,
        );
      }

      function wrapSelectedInDiv() {
        const node = getSelectedModelNode();
        if (!node) return;
        if (!guardSelectionAction("wrap", "Обёртка div")) return;
        if (!guardProtectedSelection("Обёртка div")) return;
        const className =
          prompt("Класс новой обёртки", "editor-wrap") || "editor-wrap";
        const wrapper = node.ownerDocument.createElement("div");
        if (className.trim()) wrapper.className = className.trim();
        wrapper.appendChild(node.cloneNode(true));
        replaceSelectedNodeHtml(
          wrapper.outerHTML,
          "Элемент обёрнут в новый контейнер.",
        );
      }

      function insertHtmlViaBridge(html, options = {}) {
        if (!state.modelDoc) return;
        sendToBridge("insert-element", {
          slideId: state.activeSlideId || state.slides[0]?.id || "slide-1",
          anchorNodeId:
            options.anchorNodeId !== undefined
              ? options.anchorNodeId
              : state.selectedNodeId,
          position:
            options.position || (state.selectedNodeId ? "after" : "append"),
          html,
          focusText: Boolean(options.focusText),
        });
      }

      function addChildTextToSelected() {
        if (!state.selectedNodeId) return;
        if (!guardSelectionAction("addChild", "Добавление блока")) return;
        insertHtmlViaBridge(
          '<div style="min-width:120px; min-height:24px; padding:8px 12px;">Новый дочерний текст</div>',
          {
            anchorNodeId: state.selectedNodeId,
            position: "inside",
            focusText: true,
          },
        );
        showToast("Внутрь контейнера добавлен текстовый блок.", "success", {
          title: "Структура",
        });
      }

      function insertSimpleBox() {
        insertHtmlViaBridge(
          '<div style="min-width:160px; min-height:80px; padding:16px; border:1px dashed rgba(38,103,255,.35); border-radius:12px; background:rgba(38,103,255,.06);"></div>',
          { focusText: false },
        );
        showToast("Новый блок добавлен на слайд.", "success", {
          title: "Палитра",
        });
      }

      function insertLayoutPreset(kind = "two-col") {
        let html = "";
        if (kind === "two-col") {
          html =
            '<div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start; width:100%;"><div style="padding:12px;"><h2>Заголовок</h2><p>Текст левой колонки.</p></div><div style="padding:12px;"><p>Текст правой колонки.</p></div></div>';
        } else if (kind === "title-subtitle") {
          html =
            '<div style="display:flex; flex-direction:column; gap:12px;"><h1>Заголовок</h1><p>Подзаголовок</p></div>';
        }
        if (!html) return;
        insertHtmlViaBridge(html, { focusText: false });
        showToast("Готовая раскладка вставлена.", "success", {
          title: "Палитра",
        });
      }

      function requestImageInsert(mode) {
        state.pendingImageInsertMode = mode;
        if (mode === "replace") {
          if (!state.selectedFlags.isImage) {
            alert("Для замены нужно выбрать элемент <img>.");
            return;
          }
          if (!guardSelectionAction("replaceMedia", "Замена изображения"))
            return;
          els.replaceImageInput.click();
        } else {
          els.insertImageInput.click();
        }
      }

      function insertImageElement(src, alt = "image") {
        if (!state.modelDoc) return;
        const html = `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="display:block; max-width:100%; width:320px; height:auto;">`;
        const mode = state.pendingImageInsertMode;
        const position =
          mode === "insert-child"
            ? "inside"
            : state.selectedNodeId
              ? "after"
              : "append";
        const anchorNodeId =
          mode === "insert-child" ? state.selectedNodeId : state.selectedNodeId;
        insertHtmlViaBridge(html, { position, anchorNodeId, focusText: false });
        showToast("Изображение вставлено на слайд.", "success", {
          title: "Медиа",
        });
        state.pendingImageInsertMode = "insert";
        maybeSuggestFitForLargeImage(src);
      }

      function insertDefaultTextBlock() {
        if (!state.modelDoc) return;
        insertHtmlViaBridge(
          '<div style="min-width:120px; min-height:24px; padding:8px 12px;">Новый текст</div>',
          { focusText: true },
        );
        showToast("Текстовый блок добавлен.", "success", { title: "Палитра" });
      }

      function insertDefaultShape() {
        if (!state.modelDoc) return;
        insertHtmlViaBridge(
          '<div style="position:absolute;left:40px;top:40px;width:160px;height:100px;background:#4f8ef7;border-radius:8px;"></div>',
          { focusText: false },
        );
        showToast("Форма добавлена.", "success", { title: "Палитра" });
      }

      function duplicateSelectedElement() {
        if (!state.selectedNodeId) return;
        if (!guardSelectionAction("duplicate", "Дублирование")) return;
        if (!guardProtectedSelection("Дублирование")) return;
        sendToBridge("duplicate-element", { nodeId: state.selectedNodeId });
        showToast("Элемент продублирован.", "success", { title: "Структура" });
        closeContextMenu();
      }

      function deleteSelectedElement() {
        if (!state.selectedNodeId) return;
        if (!guardSelectionAction("delete", "Удаление")) return;
        if (!guardProtectedSelection("Удаление")) return;
        sendToBridge("delete-element", { nodeId: state.selectedNodeId });
        showToast("Элемент удалён.", "success", { title: "Структура" });
        closeContextMenu();
        hideFloatingToolbar();
      }

      function resetSelectedStyles() {
        if (!state.selectedNodeId) return;
        if (!guardSelectionAction("editStyles", "Сброс стилей")) return;
        sendToBridge("reset-inline-styles", { nodeId: state.selectedNodeId });
        flashSelectedElement();
        showToast("Inline-стили элемента сброшены.", "success", {
          title: "Стили",
        });
        closeContextMenu();
      }

      function flashSelectedElement() {
        if (!state.selectedNodeId) return;
        sendToBridge("flash-node", { nodeId: state.selectedNodeId });
      }

      // ====================================================================
      // [v0.18.0] Lock, Visibility, Layers Panel, Grouping (Advanced Mode)
      // ====================================================================
      function toggleLayerLock(nodeId) {
        if (!nodeId || !state.modelDoc || state.complexityMode !== "advanced") return;
        const node = state.modelDoc.querySelector(`[data-editor-node-id="${cssEscape(nodeId)}"]`);
        if (!node) return;
        const isLocked = node.getAttribute("data-editor-locked") === "true";
        if (isLocked) {
          node.removeAttribute("data-editor-locked");
          showToast("Элемент разблокирован.", "success", { title: "Слои" });
        } else {
          node.setAttribute("data-editor-locked", "true");
          showToast("Элемент заблокирован.", "success", { title: "Слои" });
        }
        recordHistoryChange(`toggle-lock:${nodeId}`);
        sendToBridge("update-attributes", {
          nodeId,
          attrs: isLocked ? { "data-editor-locked": null } : { "data-editor-locked": "true" },
        });
        renderLayersPanel();
        updateInspectorFromSelection();
      }

      function toggleLayerVisibility(nodeId) {
        if (!nodeId) return;
        const nextHidden = !isLayerSessionHidden(nodeId);
        setLayerSessionVisibility(nodeId, nextHidden);
        clearSessionOnlyVisibilityFromModelNode(nodeId);
        sendToBridge("toggle-visibility", { nodeId });
        showToast(
          nextHidden ? "Слой скрыт только в текущей сессии." : "Слой снова показан.",
          "info",
          { title: "Слои", duration: 1500 },
        );
        window.requestAnimationFrame(() => {
          renderLayersPanel();
          updateInspectorFromSelection();
        });
      }

      function reorderLayers(fromIndex, toIndex) {
        if (!state.modelDoc || state.complexityMode !== "advanced") return;
        const layerNodeIds = Array.from(
          els.layersListContainer?.querySelectorAll(".layer-row[data-layer-node-id]") || [],
        )
          .map((row) => row.getAttribute("data-layer-node-id"))
          .filter(Boolean);
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= layerNodeIds.length ||
          toIndex >= layerNodeIds.length
        ) {
          return;
        }

        const reorderedIds = layerNodeIds.slice();
        const [moved] = reorderedIds.splice(fromIndex, 1);
        reorderedIds.splice(toIndex, 0, moved);
        const orderedNodes = reorderedIds
          .map((nodeId) =>
            state.modelDoc.querySelector(
              `[data-editor-node-id="${cssEscape(nodeId)}"]`,
            ),
          )
          .filter((node) => node instanceof Element);
        applyLayerVisualOrder(
          orderedNodes.slice().reverse(),
          `reorder-layers:${fromIndex}->${toIndex}`,
          { toastMessage: "Порядок слоёв изменён." },
        );
      }

      function getEntityKindIcon(entityKind) {
        const icons = {
          text: "🅣",
          image: "🖼",
          video: "🎞",
          container: "▣",
          table: "⊞",
          "table-cell": "⋯",
          "code-block": "⌨",
          svg: "⬡",
          fragment: "⚡",
          element: "▢",
          "slide-root": "⊞",
          protected: "🔒",
        };
        return icons[entityKind] || "▢";
      }

      function getLayerLabel(el) {
        const nodeId = el.getAttribute("data-editor-node-id") || "?";
        const entityKind = el.getAttribute("data-editor-entity-kind") || "element";
        const authorId = el.getAttribute("data-node-id") || "";
        const tagName = el.tagName.toLowerCase();
        if (authorId) return `${tagName} #${authorId}`;
        const textPreview = (el.textContent || "").trim().slice(0, 30);
        if (textPreview && entityKind === "text") return `"${textPreview}"`;
        if (el.id) return `${tagName}#${el.id}`;
        const className = (el.className || "").toString().split(/\s+/).filter(c => c && !c.startsWith("editor-"))[0];
        if (className) return `${tagName}.${className}`;
        return `${tagName} [${nodeId.slice(0, 6)}]`;
      }

      function getPreviewLayerNode(nodeId) {
        if (!nodeId) return null;
        const doc = getPreviewDocument();
        if (!doc) return null;
        return doc.querySelector(`[data-editor-node-id="${cssEscape(nodeId)}"]`);
      }

      function isLayerSessionHidden(nodeId) {
        if (!nodeId) return false;
        const previewNode = getPreviewLayerNode(nodeId);
        if (previewNode instanceof HTMLElement) {
          const style = (previewNode.ownerDocument?.defaultView || window).getComputedStyle(
            previewNode,
          );
          const isHidden = (
            previewNode.hidden ||
            style.display === "none" ||
            style.visibility === "hidden"
          );
          if (isHidden && state.sessionVisibilityMap?.[nodeId]) {
            clearSessionOnlyVisibilityFromModelNode(nodeId);
          }
          return isHidden;
        }
        const isHidden = Boolean(state.sessionVisibilityMap?.[nodeId]);
        if (isHidden) clearSessionOnlyVisibilityFromModelNode(nodeId);
        return isHidden;
      }

      function setLayerSessionVisibility(nodeId, isHidden) {
        if (!nodeId) return;
        if (!state.sessionVisibilityMap || typeof state.sessionVisibilityMap !== "object") {
          state.sessionVisibilityMap = {};
        }
        if (isHidden) state.sessionVisibilityMap[nodeId] = true;
        else delete state.sessionVisibilityMap[nodeId];
      }

      function clearSessionOnlyVisibilityFromModelNode(nodeId) {
        if (!nodeId || !state.modelDoc) return;
        const modelNode = state.modelDoc.querySelector(
          `[data-editor-node-id="${cssEscape(nodeId)}"]`,
        );
        if (!(modelNode instanceof HTMLElement)) return;
        if (modelNode.style.visibility === "hidden") {
          modelNode.style.removeProperty("visibility");
        }
        if (!modelNode.getAttribute("style")) modelNode.removeAttribute("style");
      }

      function stripSessionOnlyVisibilityFromReplacement(nodeId, currentNode, replacement) {
        if (!nodeId || !state.sessionVisibilityMap?.[nodeId]) return;
        if (!(replacement instanceof HTMLElement)) return;
        const authorVisibility =
          currentNode instanceof HTMLElement
            ? currentNode.style.getPropertyValue("visibility")
            : "";
        if (authorVisibility) {
          replacement.style.setProperty("visibility", authorVisibility);
        } else {
          replacement.style.removeProperty("visibility");
        }
        if (!replacement.getAttribute("style")) replacement.removeAttribute("style");
      }

      function getRussianPlural(count, one, few, many) {
        const abs = Math.abs(Number(count) || 0);
        const mod10 = abs % 10;
        const mod100 = abs % 100;
        if (mod10 === 1 && mod100 !== 11) return one;
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
        return many;
      }

      function formatLayerStackHint(index, total) {
        if (total <= 1) return "единственный слой";
        if (index === 0) return "верхний в стеке";
        if (index === total - 1) return "нижний в стеке";
        return `слой ${index + 1} из ${total}`;
      }

      function buildLayerStatusChipHtml(label, className = "") {
        const normalizedClassName = String(className || "").trim();
        const classAttr = normalizedClassName
          ? `layer-status-chip ${normalizedClassName}`
          : "layer-status-chip";
        return `<span class="${classAttr}">${escapeHtml(label)}</span>`;
      }

      function buildLayerStatusChipsHtml(chips) {
        return chips
          .map((chip) => buildLayerStatusChipHtml(chip.label, chip.className || ""))
          .join("");
      }

      function renderLayersPanel() {
        if (!els.layersListContainer || !els.layersInspectorSection) return;
        if (state.complexityMode !== "advanced" || !state.activeSlideId || !state.modelDoc) {
          els.layersInspectorSection.hidden = true;
          if (els.normalizeLayersBtn) els.normalizeLayersBtn.disabled = true;
          return;
        }
        const slideEl = state.modelDoc.querySelector(`[data-editor-slide-id="${cssEscape(state.activeSlideId)}"]`);
        if (!slideEl) {
          els.layersInspectorSection.hidden = true;
          if (els.normalizeLayersBtn) els.normalizeLayersBtn.disabled = true;
          return;
        }
        const allLayers = Array.from(slideEl.querySelectorAll("[data-editor-node-id]")).filter(el => {
          return el.closest("[data-editor-slide-id]") === slideEl && 
                 el.getAttribute("data-editor-entity-kind") !== "slide-root" &&
                 el.getAttribute("data-editor-policy-kind") !== "protected";
        });
        if (!allLayers.length) {
          els.layersInspectorSection.hidden = true;
          if (els.normalizeLayersBtn) els.normalizeLayersBtn.disabled = true;
          return;
        }
        els.layersInspectorSection.hidden = false;
        const sortedLayers = allLayers.sort((a, b) => compareVisualStackOrder(b, a));
        const currentScope = getLayerScopeInfo();
        if (els.normalizeLayersBtn) {
          els.normalizeLayersBtn.disabled = !currentScope || currentScope.nodes.length < 2;
        }
        const html = sortedLayers
          .map((layer, index) => {
            const nodeId = layer.getAttribute("data-editor-node-id") || "";
            const entityKind = layer.getAttribute("data-editor-entity-kind") || "element";
            const isLocked = layer.getAttribute("data-editor-locked") === "true";
            const isHidden = isLayerSessionHidden(nodeId);
            const zIndex = layer.style.zIndex || "auto";
            const label = escapeHtml(getLayerLabel(layer));
            const icon = getEntityKindIcon(entityKind);
            const isActive = nodeId === state.selectedNodeId;
            const stackHint = `${getEntityKindLabel(entityKind)} · ${formatLayerStackHint(
              index,
              sortedLayers.length,
            )}`;
            const chips = [];
            if (isActive) chips.push({ label: "Текущий", className: "is-current" });
            if (isHidden) chips.push({ label: "Скрыт", className: "is-hidden" });
            if (isLocked) chips.push({ label: "Заблокирован", className: "is-locked" });
            const zControl = isActive
              ? `
                <label class="layer-z-field" title="z-index текущего слоя">
                  <span>z</span>
                  <input
                    type="text"
                    class="layer-z-input"
                    value="${escapeHtml(zIndex)}"
                    data-layer-node-id="${escapeHtml(nodeId)}"
                  />
                </label>
              `
              : "";
            return `
              <div
                class="layer-row ${isActive ? "is-active" : ""}"
                data-layer-node-id="${escapeHtml(nodeId)}"
                data-layer-index="${index}"
                tabindex="0"
                aria-current="${isActive ? "true" : "false"}"
              >
                <button
                  type="button"
                  class="layer-drag-handle"
                  draggable="true"
                  data-layer-node-id="${escapeHtml(nodeId)}"
                  data-layer-index="${index}"
                  aria-label="Изменить порядок слоя ${label}"
                  title="Перетащить, чтобы изменить порядок"
                >
                  ⋮⋮
                </button>
                <div class="layer-main">
                  <span class="layer-label">${label}</span>
                  <span class="layer-meta">${escapeHtml(stackHint)}</span>
                </div>
                <div class="layer-trailing">
                  <div class="layer-status-list">${buildLayerStatusChipsHtml(chips)}</div>
                  <div class="layer-row-actions">
                    ${zControl}
                    <button
                      type="button"
                      class="layer-action-btn layer-visibility-btn ${isHidden ? "is-hidden" : ""}"
                      data-layer-node-id="${escapeHtml(nodeId)}"
                      aria-label="${isHidden ? "Показать слой" : "Скрыть слой"}"
                      title="${isHidden ? "Показать слой" : "Скрыть слой"}"
                    >
                      👁
                    </button>
                    <button
                      type="button"
                      class="layer-action-btn layer-lock-btn ${isLocked ? "is-locked" : ""}"
                      data-layer-node-id="${escapeHtml(nodeId)}"
                      aria-label="${isLocked ? "Разблокировать слой" : "Заблокировать слой"}"
                      title="${isLocked ? "Разблокировать слой" : "Заблокировать слой"}"
                    >
                      ${isLocked ? "🔒" : "🔓"}
                    </button>
                  </div>
                </div>
              </div>
            `;
          })
          .join("");
        els.layersListContainer.innerHTML = html;
        bindLayersPanelActions();
      }

      function bindLayersPanelActions() {
        if (!els.layersListContainer) return;
        const rows = Array.from(
          els.layersListContainer.querySelectorAll(".layer-row[data-layer-node-id]"),
        );
        const focusRowByIndex = (index) => {
          if (!rows.length) return;
          const nextIndex = Math.max(0, Math.min(rows.length - 1, index));
          rows[nextIndex].focus({ preventScroll: true });
        };
        rows.forEach((row) => {
          row.addEventListener("click", (e) => {
            if (
              e.target.closest(".layer-action-btn") ||
              e.target.closest(".layer-z-input") ||
              e.target.closest(".layer-drag-handle")
            ) {
              return;
            }
            const nodeId = row.getAttribute("data-layer-node-id");
            if (nodeId) {
              sendToBridge("select-element", { nodeId });
            }
          });
          row.addEventListener("keydown", (event) => {
            const currentIndex = rows.indexOf(row);
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusRowByIndex((currentIndex + 1 + rows.length) % rows.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              focusRowByIndex((currentIndex - 1 + rows.length) % rows.length);
              return;
            }
            if (event.key === "Home") {
              event.preventDefault();
              focusRowByIndex(0);
              return;
            }
            if (event.key === "End") {
              event.preventDefault();
              focusRowByIndex(rows.length - 1);
              return;
            }
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              const nodeId = row.getAttribute("data-layer-node-id");
              if (nodeId) sendToBridge("select-element", { nodeId });
            }
          });
          row.addEventListener("dragover", (e) => {
            e.preventDefault();
            const index = parseInt(row.getAttribute("data-layer-index") || "-1", 10);
            if (index >= 0 && index !== state.layersPanelDragState.draggedIndex) {
              rows.forEach((item) => item.classList.remove("is-drop-target"));
              row.classList.add("is-drop-target");
              state.layersPanelDragState.dropTargetIndex = index;
            }
          });
          row.addEventListener("drop", (e) => {
            e.preventDefault();
            const fromIndex = state.layersPanelDragState.draggedIndex;
            const rowIndex = parseInt(row.getAttribute("data-layer-index") || "-1", 10);
            const toIndex =
              state.layersPanelDragState.dropTargetIndex >= 0
                ? state.layersPanelDragState.dropTargetIndex
                : rowIndex;
            if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
              reorderLayers(fromIndex, toIndex);
            }
          });
        });

        els.layersListContainer.querySelectorAll(".layer-drag-handle").forEach((handle) => {
          handle.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
          });
          handle.addEventListener("dragstart", (event) => {
            event.stopPropagation();
            const nodeId = handle.getAttribute("data-layer-node-id");
            const index = parseInt(handle.getAttribute("data-layer-index") || "-1", 10);
            const row = handle.closest(".layer-row");
            state.layersPanelDragState.draggedNodeId = nodeId;
            state.layersPanelDragState.draggedIndex = index;
            if (row) row.classList.add("is-dragging");
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", nodeId || "layer-row");
            }
          });
          handle.addEventListener("dragend", () => {
            const row = handle.closest(".layer-row");
            if (row) row.classList.remove("is-dragging");
            rows.forEach((item) => item.classList.remove("is-drop-target"));
            state.layersPanelDragState = { draggedNodeId: null, draggedIndex: -1, dropTargetIndex: -1 };
          });
        });

        els.layersListContainer.querySelectorAll(".layer-lock-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const nodeId = btn.getAttribute("data-layer-node-id");
            if (nodeId) toggleLayerLock(nodeId);
          });
        });
        els.layersListContainer.querySelectorAll(".layer-visibility-btn").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const nodeId = btn.getAttribute("data-layer-node-id");
            if (nodeId) toggleLayerVisibility(nodeId);
          });
        });
        els.layersListContainer.querySelectorAll(".layer-z-input").forEach((input) => {
          input.addEventListener("change", (e) => {
            e.stopPropagation();
            const nodeId = input.getAttribute("data-layer-node-id");
            const newZ = input.value.trim();
            if (nodeId && newZ) {
              sendToBridge("apply-style", { nodeId, property: "z-index", value: newZ });
              recordHistoryChange(`set-z-index:${nodeId}:${newZ}`);
              scheduleOverlapDetection();
              renderLayersPanel();
              updateInspectorFromSelection();
            }
          });
          input.addEventListener("click", (e) => e.stopPropagation());
        });
      }

      function groupSelectedElements() {
        if (!state.multiSelectNodeIds.length || state.complexityMode !== "advanced" || !state.modelDoc || !state.activeSlideId) return;
        const slideEl = state.modelDoc.querySelector(`[data-editor-slide-id="${cssEscape(state.activeSlideId)}"]`);
        if (!slideEl) return;
        const groupWrapper = state.modelDoc.createElement("div");
        groupWrapper.className = "editor-group";
        groupWrapper.setAttribute("data-editor-node-id", `node-${getNextNodeSeqInModel()}`);
        groupWrapper.setAttribute("data-editor-entity-kind", "container");
        const firstNodeId = state.multiSelectNodeIds[0];
        const firstNode = slideEl.querySelector(`[data-editor-node-id="${cssEscape(firstNodeId)}"]`);
        if (!firstNode) return;
        firstNode.parentElement.insertBefore(groupWrapper, firstNode);
        state.multiSelectNodeIds.forEach(nodeId => {
          const node = slideEl.querySelector(`[data-editor-node-id="${cssEscape(nodeId)}"]`);
          if (node) groupWrapper.appendChild(node);
        });
        recordHistoryChange(`group:${state.multiSelectNodeIds.join(",")}`);
        state.multiSelectNodeIds = [];
        rebuildPreviewKeepingContext(state.activeSlideId);
        showToast("Элементы сгруппированы.", "success", { title: "Слои" });
      }

      function ungroupSelectedElement() {
        if (!state.selectedNodeId || state.complexityMode !== "advanced" || !state.modelDoc) return;
        const groupNode = state.modelDoc.querySelector(`[data-editor-node-id="${cssEscape(state.selectedNodeId)}"]`);
        if (!groupNode || !groupNode.classList.contains("editor-group")) return;
        const parent = groupNode.parentElement;
        if (!parent) return;
        const children = Array.from(groupNode.children);
        children.forEach(child => parent.insertBefore(child, groupNode));
        groupNode.remove();
        recordHistoryChange(`ungroup:${state.selectedNodeId}`);
        rebuildPreviewKeepingContext(state.activeSlideId);
        showToast("Группа расформирована.", "success", { title: "Слои" });
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
          isContextMenuOpen() ||
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
