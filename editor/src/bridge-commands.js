// bridge-commands.js
// Layer: Bridge ↔ Shell State Integration
// Processes postMessage commands from the iframe bridge: applies selection,
// element updates, slide activation, and other bridge payloads to shell state.
//
      function isMutatingBridgeCommand(type) {
        return BRIDGE_MUTATION_TYPES.has(type);
      }

      function nextCommandSeq() {
        state.commandSeq += 1;
        return state.commandSeq;
      }

      function resolveBridgeCommandSlideId(type, payload = {}) {
        if (payload.slideId) return payload.slideId;
        if (payload.nodeId) return state.activeSlideId || null;
        if (type === "replace-slide-html") return state.activeSlideId || null;
        return state.activeSlideId || null;
      }

      function pruneSlideSyncLocks() {
        const now = Date.now();
        Object.keys(state.slideSyncLocks).forEach((slideId) => {
          const lock = state.slideSyncLocks[slideId];
          if (!lock || lock.expiresAt <= now) delete state.slideSyncLocks[slideId];
        });
      }

      function lockSlideSync(slideId, seq, reason) {
        if (!slideId || !seq) return;
        state.slideSyncLocks[slideId] = {
          seq,
          reason,
          at: Date.now(),
          expiresAt: Date.now() + SYNC_LOCK_WINDOW_MS,
        };
      }

      function clearSlideSyncLock(slideId, seq = 0) {
        if (!slideId) return;
        const lock = state.slideSyncLocks[slideId];
        if (!lock) return;
        if (!seq || seq >= lock.seq || Date.now() >= lock.expiresAt) {
          delete state.slideSyncLocks[slideId];
        }
      }

      function noteAppliedSeq(slideId, seq) {
        const normalizedSeq = Number(seq || 0);
        if (!slideId || !normalizedSeq) return;
        const prev = Number(state.lastAppliedSeqBySlide[slideId] || 0);
        if (normalizedSeq > prev) state.lastAppliedSeqBySlide[slideId] = normalizedSeq;
        if (normalizedSeq > state.lastAppliedSeq) state.lastAppliedSeq = normalizedSeq;
        clearSlideSyncLock(slideId, normalizedSeq);
      }

      // [v0.18.4] Seq drift tolerance to reduce false positive desync warnings
      const SEQ_DRIFT_TOLERANCE = 2;

      function isStaleInboundSeq(slideId, seq) {
        const normalizedSeq = Number(seq || 0);
        const lastApplied = Number(state.lastAppliedSeqBySlide[slideId] || 0);
        if (!slideId || !normalizedSeq) return false;
        const drift = Math.abs(normalizedSeq - lastApplied);
        return drift > SEQ_DRIFT_TOLERANCE && normalizedSeq < lastApplied;
      }

      function shouldIgnoreLockedDocumentSync(slideId, seq) {
        pruneSlideSyncLocks();
        const lock = state.slideSyncLocks[slideId];
        if (!lock) return false;
        const normalizedSeq = Number(seq || 0);
        if (!normalizedSeq) return Date.now() < lock.expiresAt;
        return normalizedSeq < lock.seq;
      }

      function sendToBridge(type, payload = {}) {
        if (!state.bridgeToken || !els.previewFrame.contentWindow) return false;
        // [WO-13] ADR-012 §2 — Pre-send schema validation gate.
        // Validate the flat message envelope (type + payload fields) before
        // dispatching. On reject: drop + diagnostic, do NOT send.
        if (window.BRIDGE_SCHEMA) {
          const _flat = Object.assign({ type }, payload);
          const _vResult = window.BRIDGE_SCHEMA.validateMessage(_flat);
          if (!_vResult.ok) {
            addDiagnostic(`bridge-send-rejected:${type}:${_vResult.errors.join('; ')}`);
            return false;
          }
        }
        try {
          const message = {
            __presentationEditorParent: true,
            token: state.bridgeToken,
            type,
            payload,
          };
          if (isMutatingBridgeCommand(type)) {
            const seq = nextCommandSeq();
            message.seq = seq;
            const slideId = resolveBridgeCommandSlideId(type, payload);
            if (slideId) lockSlideSync(slideId, seq, type);
          }
          // AUDIT-D-04: Target the iframe's origin precisely when possible.
          // Under file:// the iframe origin is also "null" so we must keep '*'
          // (postMessage rejects "null" as a target — only the string '*' works).
          // Under http(s):// the iframe is same-origin so we target location.origin.
          const _iframeTarget = (window.location.protocol === 'file:') ? '*' : window.location.origin;
          els.previewFrame.contentWindow.postMessage(message, _iframeTarget);
          return true;
        } catch (error) {
          addDiagnostic(`bridge-send-error:${type}:${error.message}`);
          return false;
        }
      }

      // applyRuntimeMetadata
      // Принимает снимок текущего состояния превью: движок, список слайдов,
      // активный слайд. Это связывает runtime iframe и модель shell-а.
      function applyRuntimeMetadata(payload) {
        state.previewReady = true;
        state.bridgeAlive = true;
        setPreviewLifecycleState("ready", { reason: "runtime-metadata" });
        state.engine = payload.engine || "unknown";
        state.runtimeSlides = Array.isArray(payload.slides) ? payload.slides : [];
        state.runtimeActiveSlideId = String(payload.activeSlideId || "").trim() || null;
        const requestedSlideId = getRequestedSlideId();
        syncSlideRegistry({
          runtimeSlides: state.runtimeSlides,
          runtimeActiveSlideId: state.runtimeActiveSlideId,
        });
        if (
          requestedSlideId &&
          state.runtimeActiveSlideId &&
          requestedSlideId === state.runtimeActiveSlideId &&
          (state.requestedSlideActivation?.attempts || 0) > 0
        ) {
          clearRequestedSlideActivation();
          syncSlideRegistry({
            runtimeSlides: state.runtimeSlides,
            runtimeActiveSlideId: state.runtimeActiveSlideId,
          });
        }
        state.editingSupported = Boolean(
          payload.editingSupported &&
          state.modelDoc?.querySelector("[data-editor-node-id]"),
        );
        state.lastRuntimeMetadataAt = Date.now();
        els.documentMeta.textContent = `${state.sourceLabel} • движок: ${state.engine}`;
        renderSlidesList();
        dispatchPendingSlideActivation("runtime-metadata");
        schedulePendingSlideActivationRetry("runtime-metadata-retry");
        syncOverlapHoverBinding();
        scheduleOverlapDetection("slide-activation");
        flushPendingPreviewSelection();
        refreshUi();
      }

      function applySlideActivationFromBridge(payload) {
        const requestId = String(payload.requestId || "").trim();
        const requestedSlideId = String(payload.requestedSlideId || "").trim();
        const activeSlideId = String(payload.activeSlideId || "").trim() || null;
        const activationRequest = getRequestedSlideActivation();
        state.runtimeActiveSlideId = activeSlideId;
        if (
          activationRequest &&
          requestId &&
          activationRequest.requestId === requestId &&
          activeSlideId === activationRequest.slideId
        ) {
          clearRequestedSlideActivation();
        } else if (
          activationRequest &&
          requestedSlideId &&
          requestedSlideId === activationRequest.slideId &&
          payload.status === "missing-target"
        ) {
          clearRequestedSlideActivation();
        }
        syncSlideRegistry({ runtimeActiveSlideId: state.runtimeActiveSlideId });
        if (getRequestedSlideActivation()) {
          schedulePendingSlideActivationRetry("slide-activation");
        }
        renderSlidesList();
        syncOverlapHoverBinding();
        scheduleOverlapDetection("slide-activation");
        flushPendingPreviewSelection();
        refreshUi();
      }

      // applyElementSelection
      // Обновляет данные о выбранном элементе: тег, html, computed styles,
      // флаги типа (text/image/video/container) и атрибуты.
      // PAIN-MAP P2-05: single source of truth via entity-kinds.js (ADR-016 Layer 1).
      const CANONICAL_ENTITY_KINDS = window.ENTITY_KINDS_CANONICAL;

      function readCanonicalEntityKind(kind) {
        const normalized = String(kind || "")
          .trim()
          .toLowerCase();
        return CANONICAL_ENTITY_KINDS.has(normalized) ? normalized : "";
      }

      function normalizeEntityKind(kind, fallback = "none") {
        return (
          readCanonicalEntityKind(kind) ||
          readCanonicalEntityKind(fallback) ||
          "none"
        );
      }

      function getEntityKindFromFlags(flags = {}) {
        if (!flags || typeof flags !== "object") return "none";
        if (flags.isSlideRoot) return "slide-root";
        if (flags.isProtected) return "protected";
        if (flags.isTable) return "table";
        if (flags.isTableCell) return "table-cell";
        if (flags.isCodeBlock) return "code-block";
        if (flags.isSvg) return "svg";
        if (flags.isFragment) return "fragment";
        if (flags.isImage) return "image";
        if (flags.isVideo) return "video";
        if (flags.isContainer) return "container";
        if (flags.canEditText) return "text";
        const hasAnyKnownFlag = Boolean(
          flags.canEditText ||
            flags.isImage ||
            flags.isVideo ||
            flags.isContainer ||
            flags.isSlideRoot ||
            flags.isProtected ||
            flags.isTable ||
            flags.isTableCell ||
            flags.isCodeBlock ||
            flags.isSvg ||
            flags.isFragment,
        );
        return hasAnyKnownFlag ? "element" : "none";
      }

      function getEntityKindFromPayload(payload = {}) {
        return normalizeEntityKind(
          payload.entityKind,
          getEntityKindFromFlags(payload),
        );
      }

      function getDefaultSelectedFlags() {
        return {
          canEditText: false,
          isImage: false,
          isVideo: false,
          isContainer: false,
          isSlideRoot: false,
          isProtected: false,
          isTable: false,
          isTableCell: false,
          isCodeBlock: false,
          isSvg: false,
          isFragment: false,
          isTextEditing: false,
        };
      }

      function deriveSelectedFlagsFromPayload(payload = {}) {
        const canonicalKind = readCanonicalEntityKind(payload.entityKind);
        if (canonicalKind) {
          const explicitCanEditText =
            typeof payload.canEditText === "boolean" ? payload.canEditText : null;
          return {
            canEditText:
              explicitCanEditText !== null
                ? explicitCanEditText
                : canonicalKind === "text" ||
                    canonicalKind === "table-cell" ||
                    canonicalKind === "code-block",
            isImage: canonicalKind === "image",
            isVideo: canonicalKind === "video",
            isContainer: canonicalKind === "container",
            isSlideRoot: canonicalKind === "slide-root",
            isProtected: canonicalKind === "protected",
            isTable: canonicalKind === "table",
            isTableCell: canonicalKind === "table-cell",
            isCodeBlock: canonicalKind === "code-block",
            isSvg: canonicalKind === "svg",
            isFragment: canonicalKind === "fragment",
            isTextEditing: Boolean(payload.isTextEditing),
          };
        }
        return {
          canEditText: Boolean(payload.canEditText),
          isImage: Boolean(payload.isImage),
          isVideo: Boolean(payload.isVideo),
          isContainer: Boolean(payload.isContainer),
          isSlideRoot: Boolean(payload.isSlideRoot),
          isProtected: Boolean(payload.isProtected),
          isTable: Boolean(payload.isTable),
          isTableCell: Boolean(payload.isTableCell),
          isCodeBlock: Boolean(payload.isCodeBlock),
          isSvg: Boolean(payload.isSvg),
          isFragment: Boolean(payload.isFragment),
          isTextEditing: Boolean(payload.isTextEditing),
        };
      }

      function normaliseSelectionPathEntry(entry = {}, fallbackNodeId = "") {
        const nodeId = String(entry.nodeId || "").trim() || fallbackNodeId;
        const selectionNodeId = String(
          entry.selectionNodeId || entry.runtimeNodeId || nodeId,
        ).trim() || nodeId;
        return {
          current:
            Boolean(entry.isCurrent) ||
            entry.ariaCurrent === "true" ||
            entry["aria-current"] === "true",
          entityKind: readCanonicalEntityKind(entry.entityKind) || "none",
          isLeaf: Boolean(entry.isLeaf),
          label: String(entry.label || nodeId || "Node").trim() || "Node",
          nodeId,
          selectionNodeId,
        };
      }

      function normaliseSelectionPath(payload = {}) {
        const rawPath = Array.isArray(payload.selectionPath)
          ? payload.selectionPath
          : [];
        const fallbackNodeId = String(payload.nodeId || "").trim();
        const nextPath = rawPath
          .map((entry) => normaliseSelectionPathEntry(entry, fallbackNodeId))
          .filter((entry) => entry.nodeId);
        if (!nextPath.length && fallbackNodeId) {
          nextPath.push(
            normaliseSelectionPathEntry(
              {
                nodeId: fallbackNodeId,
                selectionNodeId: fallbackNodeId,
                isCurrent: true,
                label: fallbackNodeId,
              },
              fallbackNodeId,
            ),
          );
        }
        const selectedNodeId = String(payload.nodeId || "").trim();
        nextPath.forEach((entry) => {
          entry.current = entry.selectionNodeId === selectedNodeId;
        });
        return nextPath;
      }

      function applyElementSelection(payload) {
        const previousNodeId = state.selectedNodeId;
        const nextSelectionPath = normaliseSelectionPath(payload);

        // --- Phase 1: compute all derived values ---
        const nextNodeId      = payload.nodeId || null;
        const nextLeafNodeId  = String(
          payload.selectionLeafNodeId || nextSelectionPath[0]?.nodeId || "",
        ).trim() || null;
        const nextTag         = payload.tag || null;
        const nextComputed    = payload.computed || null;
        const nextHtml        = payload.html || "";
        const nextRect        = payload.rect || null;
        const nextAttrs       = payload.attrs || {};
        const nextManipCtx    = payload.manipulationContext || null;
        const nextEntityKind  = getEntityKindFromPayload(payload);
        clearOverlapGhostHighlight();
        const nextFlags       = deriveSelectedFlagsFromPayload(payload);
        const nextPolicy      = normalizeSelectionPolicy(
          payload.protectionPolicy || {},
          nextFlags,
        );
        const nextRuntimeSlideId = payload.slideId || state.runtimeActiveSlideId;

        // [v0.25.0] Sync click-through overlap count for the stack depth badge.
        // Badge shows only when actively cycling (overlapIndex > 0) so a first
        // click on a multi-candidate element keeps the badge hidden.
        const nextOverlapIndex = typeof payload.overlapIndex === 'number' ? payload.overlapIndex : 0;
        const nextClickThrough = (typeof payload.overlapCount === 'number' && nextOverlapIndex > 0)
          ? { candidates: { length: payload.overlapCount }, index: nextOverlapIndex }
          : null;

        // [v2.0.9] First time the user actually cycles through overlapping
        // candidates → fire a contextual shortcut hint so they discover
        // Ctrl+click (deep) and Alt+click (parent) without reading docs.
        if (
          nextOverlapIndex > 0 &&
          typeof window !== 'undefined' &&
          typeof window.hintAfterFirstOverlapCycle === 'function'
        ) {
          window.hintAfterFirstOverlapCycle();
        }

        // --- Phase 2: dual-write — raw state fields (backward compat) + store slice ---
        // Raw state writes keep all existing modules that read `state.selectedNodeId` etc.
        // working without modification. The store.update call notifies store subscribers.
        state.selectedNodeId      = nextNodeId;
        state.selectionLeafNodeId = nextLeafNodeId;
        state.selectionPath       = nextSelectionPath;
        state.selectedTag         = nextTag;
        state.selectedComputed    = nextComputed;
        state.selectedHtml        = nextHtml;
        state.selectedRect        = nextRect;
        state.liveSelectionRect   = null;
        state.selectedAttrs       = nextAttrs;
        state.manipulationContext = nextManipCtx;
        state.selectedEntityKind  = nextEntityKind;
        state.selectedFlags       = nextFlags;
        state.selectedPolicy      = nextPolicy;
        state.runtimeActiveSlideId = nextRuntimeSlideId;
        state.clickThroughState   = nextClickThrough;

        // Sync store 'selection' slice in a single batch → ONE microtask notification.
        if (typeof window !== "undefined" && window.store) {
          window.store.batch(function () {
            window.store.update("selection", {
              activeNodeId:         nextNodeId,
              activeSlideId:        payload.slideId || null,
              selectionPath:        nextSelectionPath,
              leafNodeId:           nextLeafNodeId,
              tag:                  nextTag,
              computed:             nextComputed,
              html:                 nextHtml,
              rect:                 nextRect,
              attrs:                nextAttrs,
              entityKind:           nextEntityKind,
              flags:                nextFlags,
              policy:               nextPolicy,
              liveRect:             null,
              manipulationContext:  nextManipCtx,
              clickThroughState:    nextClickThrough,
              runtimeActiveSlideId: nextRuntimeSlideId,
              overlapIndex:         nextOverlapIndex,
            });
          });
        }

        // --- Phase 3: side effects — IDENTICAL order to pre-WO-17 ---
        if (
          state.contextMenuNodeId &&
          (state.contextMenuNodeId !== state.selectedNodeId ||
            Boolean(payload.isTextEditing))
        ) {
          closeContextMenu();
        }
        if (
          isLayerPickerOpen() &&
          Boolean(payload.isTextEditing || !state.layerPickerPayload?.items?.some(
            (item) => item.nodeId === state.selectedNodeId,
          ))
        ) {
          closeLayerPicker();
        }
        syncSlideRegistry({
          currentActiveId: payload.slideId || state.activeSlideId,
          runtimeActiveSlideId: state.runtimeActiveSlideId,
        });
        if (state.mode === "edit" && !state.activeManipulation) {
          if (state.selectedFlags.isTextEditing && state.selectedFlags.canEditText) {
            setInteractionMode("text-edit");
          } else if (!isInsertPaletteOpen()) {
            setInteractionMode("select");
          }
        }
        // [WO-19] RAF-coalesce all 7 sub-renders into one animation frame.
        // Multiple applyElementSelection calls in the same microtask produce 1 RAF.
        scheduleSelectionRender("all", { previousNodeId: previousNodeId });
      }

      function applySelectionGeometry(payload) {
        if (!payload || payload.nodeId !== state.selectedNodeId) return;
        state.selectedRect = payload.rect || state.selectedRect;
        state.selectedComputed = payload.computed || state.selectedComputed;
        // [WO-19] RAF-coalesce the 3 geometry sub-renders.
        scheduleSelectionRender(["floatingToolbar", "inspector", "overlay"]);
      }

      function clearSelectedElementState() {
        state.selectedNodeId = null;
        state.selectionLeafNodeId = null;
        state.selectionPath = [];
        state.selectedTag = null;
        state.selectedComputed = null;
        state.selectedHtml = "";
        state.selectedRect = null;
        state.liveSelectionRect = null;
        state.selectedAttrs = {};
        state.selectedEntityKind = "none";
        state.manipulationContext = null;
        state.activeManipulation = null;
        state.activeGuides = { vertical: [], horizontal: [] };
        state.selectedFlags = getDefaultSelectedFlags();
        state.selectedPolicy = createDefaultSelectionPolicy();
        if (state.mode === "preview") setInteractionMode("preview");
        else setInteractionMode("select");
        hideFloatingToolbar();
        // [WO-19] RAF-coalesce the 2 clear-selection sub-renders.
        scheduleSelectionRender(["inspector", "overlay"]);
      }

      function focusSelectionFrameForKeyboard() {
        if (!els.selectionFrame || state.mode !== "edit" || !state.selectedNodeId)
          return;
        if (isActiveTextEditingContext() || state.activeManipulation) return;
        const active = document.activeElement;
        if (
          active instanceof Element &&
          (active.closest("#inspectorPanel") ||
            active.closest("#slidesPanel") ||
            active.closest("#contextMenu") ||
            active.closest(".modal.is-open"))
        ) {
          return;
        }
        window.requestAnimationFrame(() => {
          if (
            !els.selectionFrame ||
            state.mode !== "edit" ||
            !state.selectedNodeId ||
            isActiveTextEditingContext() ||
            state.activeManipulation
          ) {
            return;
          }
          els.selectionFrame.focus({ preventScroll: true });
        });
      }

      function selectedNodeExistsInModel() {
        return Boolean(findModelNode(state.selectedNodeId));
      }

      function applyElementUpdateFromBridge(payload, seq = 0) {
        const nodeId = payload.nodeId;
        const slideId = payload.slideId || state.activeSlideId || null;
        const editLifecycle = String(payload.editLifecycle || "").trim();
        const entityKind = getEntityKindFromPayload(payload);
        if (!nodeId || !state.modelDoc) return;
        const isCurrentSelection = nodeId === state.selectedNodeId;
        if (isStaleInboundSeq(slideId, seq)) {
          addDiagnostic(`element-update-stale:${slideId || "n/a"}:${seq}`);
          return;
        }
        const node = findModelNode(nodeId);
        if (!node) return;
        try {
          const replacement = parseSingleRootElement(payload.html || "");
          if (!replacement.getAttribute("data-editor-node-id")) {
            replacement.setAttribute("data-editor-node-id", nodeId);
          }
          // Strip transient iframe attributes before importing into modelDoc
          replacement.querySelectorAll("*").forEach((_el) => {
            _el.removeAttribute("data-editor-selected");
            _el.removeAttribute("data-editor-hover");
            _el.removeAttribute("data-editor-highlight");
            _el.removeAttribute("data-editor-flash");
          });
          replacement.removeAttribute("data-editor-selected");
          replacement.removeAttribute("data-editor-hover");
          replacement.removeAttribute("data-editor-highlight");
          replacement.removeAttribute("data-editor-flash");
          stripSessionOnlyVisibilityFromReplacement(nodeId, node, replacement);
          node.replaceWith(state.modelDoc.importNode(replacement, true));
        } catch (error) {
          addDiagnostic(`element-update-error: ${error.message}`);
          markPreviewDesync(`element-update-error:${error.message}`);
        }
        if (isCurrentSelection) {
          state.selectionLeafNodeId =
            String(
              payload.selectionLeafNodeId ||
                state.selectionLeafNodeId ||
                state.selectionPath[0]?.nodeId ||
                "",
            ).trim() || null;
          state.selectionPath = normaliseSelectionPath({
            ...payload,
            nodeId: state.selectedNodeId,
          });
          state.selectedComputed = payload.computed || state.selectedComputed;
          state.selectedHtml = payload.html || state.selectedHtml;
          state.selectedRect = payload.rect || state.selectedRect;
          state.liveSelectionRect = null;
          state.selectedAttrs = payload.attrs || state.selectedAttrs;
          state.selectedTag = payload.tag || state.selectedTag;
          state.selectedEntityKind = entityKind;
          state.manipulationContext = payload.manipulationContext || state.manipulationContext;
          state.activeGuides = { vertical: [], horizontal: [] };
          const nextFlags = deriveSelectedFlagsFromPayload(payload);
          state.selectedFlags = nextFlags;
          state.selectedPolicy = normalizeSelectionPolicy(
            payload.protectionPolicy || {},
            nextFlags,
          );
          if (state.mode === "edit" && !state.activeManipulation) {
            if (state.selectedFlags.isTextEditing && state.selectedFlags.canEditText) {
              setInteractionMode("text-edit");
            } else if (!isInsertPaletteOpen()) {
              setInteractionMode("select");
            }
          }
        }
        noteAppliedSeq(slideId, seq);
        const snapshotMode =
          editLifecycle === "live"
            ? "none"
            : editLifecycle === "commit" && entityKind === "table-cell"
              ? "none"
            : editLifecycle === "commit"
              ? "immediate"
              : "debounced";
        const reason =
          editLifecycle === "live"
            ? "text-edit-live"
            : editLifecycle === "commit"
              ? "text-edit-commit"
              : "element-updated";
        commitChange(reason, { snapshotMode });
        // [WO-19] RAF-coalesce element-update sub-renders.
        if (isCurrentSelection) {
          scheduleSelectionRender("all");
        } else {
          scheduleSelectionRender(["slideRail", "refreshUi", "overlapDetection"]);
        }
      }

      function applySlideUpdateFromBridge(payload, seq = 0) {
        const slideId = payload.slideId;
        const html = payload.html;
        const reason = payload.reason || "slide-updated";
        if (!slideId || !html || !state.modelDoc) return;
        if (isStaleInboundSeq(slideId, seq)) {
          const localSeq = Number(state.lastAppliedSeqBySlide[slideId] || 0);
          const drift = Math.abs(localSeq - seq);
          addDiagnostic(`slide-update-stale:${slideId}:${seq} (drift=${drift}, tolerance=${SEQ_DRIFT_TOLERANCE})`);
          markPreviewDesync(`slide-update-stale:${slideId}:${seq}`, { toast: false });
          return;
        }
        const currentSlide = findModelSlide(slideId);
        if (!currentSlide) return;
        try {
          const replacement = parseSingleRootElement(html);
          replacement.setAttribute("data-editor-slide-id", slideId);
          currentSlide.replaceWith(
            state.modelDoc.importNode(replacement, true),
          );
          if (!selectedNodeExistsInModel()) {
            clearSelectedElementState();
          }
          state.liveSelectionRect = null;
          state.activeGuides = { vertical: [], horizontal: [] };
          noteAppliedSeq(slideId, seq);
          commitChange(reason);
          syncSlideRegistry();
          renderSlidesList();
          refreshUi();
        } catch (error) {
          addDiagnostic(`slide-update-error: ${error.message}`);
          markPreviewDesync(`slide-update-error:${error.message}`);
        }
      }

      function applySlideRemovedFromBridge(payload, seq = 0) {
        const slideId = payload.slideId;
        if (!slideId || !state.modelDoc) return;
        if (isStaleInboundSeq(slideId, seq)) {
          addDiagnostic(`slide-remove-stale:${slideId}:${seq}`);
          return;
        }
        const slide = findModelSlide(slideId);
        if (!slide) return;
        slide.remove();
        if (state.activeSlideId === slideId) state.activeSlideId = null;
        clearSlideSyncLock(slideId, seq);
        noteAppliedSeq(slideId, seq);
        clearSelectedElementState();
        commitChange("slide-removed");
        syncSlideRegistry();
        renderSlidesList();
        refreshUi();
      }

      function handleBridgeShortcut(payload) {
        const action = payload.action;
        if (!action) return;
        switch (action) {
          case "undo":
            undo();
            break;
          case "redo":
            redo();
            break;
          case "duplicate":
            duplicateSelectedElement();
            break;
          case "delete":
            deleteSelectedElement();
            break;
          case "layer-forward":
          case "layer-backward":
          case "layer-front":
          case "layer-back":
            moveSelectedLayerByOrder(action);
            break;
        }
      }

      function getSlideIndexById(slideId) {
        return state.slideRegistryOrder.indexOf(slideId);
      }

      function scrollActiveSlideListItemIntoView() {
        const activeItem =
          els.slidesList?.querySelector(".slide-item.is-pending") ||
          els.slidesList?.querySelector(".slide-item.is-active");
        if (!activeItem || typeof activeItem.scrollIntoView !== "function") return;
        window.requestAnimationFrame(() => {
          activeItem.scrollIntoView({ block: "nearest", inline: "nearest" });
        });
      }

      function requestSlideActivation(slideId, options = {}) {
        if (!slideId) return;
        const activationRequest = stageSlideActivationRequest(slideId, options);
        if (!activationRequest) return;
        if (options.closeTransientUi !== false) {
          closeTransientShellUi({ keep: options.keepUi || "" });
        }
        if (isCompactShell() && options.closePanels !== false) {
          closeShellPanels();
        }
        syncSlideRegistry({ currentActiveId: slideId });
        dispatchPendingSlideActivation(options.reason || "request-slide-activation");
        renderSlidesList();
        refreshUi();
        scrollActiveSlideListItemIntoView();
      }

      function readNumericSlideAttributeValue(slide, attrName) {
        const rawValue = String(slide?.getAttribute(attrName) || "").trim();
        if (!/^[-+]?\d+$/.test(rawValue)) return null;
        return Number(rawValue);
      }

      function detectStaticSlideOrderBase(slides, attrName) {
        const numericValues = slides
          .map((slide) => readNumericSlideAttributeValue(slide, attrName))
          .filter((value) => Number.isFinite(value));
        if (numericValues.length < Math.max(2, slides.length - 1)) return null;
        return numericValues.some((value) => value === 0) ? 0 : 1;
      }

      function stripInheritedSlideRuntimeAttrs(slide) {
        if (!(slide instanceof Element)) return;
        TRANSIENT_SLIDE_RUNTIME_ATTRS.forEach((attrName) =>
          slide.removeAttribute(attrName),
        );
      }

      function syncStaticSlideOrderingMetadata() {
        const slides = getStaticSlideModelNodes();
        if (!slides.length) return;
        STATIC_SLIDE_ORDER_ATTRS.forEach((attrName) => {
          const base = detectStaticSlideOrderBase(slides, attrName);
          if (base === null) return;
          slides.forEach((slide, index) => {
            slide.setAttribute(attrName, String(index + base));
          });
        });
      }

      function canUseSlideRailDragDrop() {
        return canUseStaticSlideModel() && !isCompactShell();
      }

      function clearSlideRailDropTarget() {
        els.slidesList
          ?.querySelectorAll(".slide-item.is-drop-target, .slide-item.is-dragging")
          .forEach((node) => node.classList.remove("is-drop-target", "is-dragging"));
      }

      function setSlideRailDropTarget(index) {
        const nextIndex = Number.isFinite(index) ? Number(index) : -1;
        if (state.slideRailDrag.hoverIndex === nextIndex) return;
        els.slidesList
          ?.querySelector(`.slide-item.is-drop-target[data-index="${state.slideRailDrag.hoverIndex}"]`)
          ?.classList.remove("is-drop-target");
        state.slideRailDrag.hoverIndex = nextIndex;
        if (nextIndex < 0) return;
        els.slidesList
          ?.querySelector(`.slide-item[data-index="${nextIndex}"]`)
          ?.classList.add("is-drop-target");
      }

      function resetSlideRailDragState() {
        state.slideRailDrag.slideId = null;
        state.slideRailDrag.hoverIndex = -1;
        state.slideRailDrag.suppressClickUntil = Date.now() + 180;
        clearSlideRailDropTarget();
      }

      function maybeAutoScrollSlideRail(clientY) {
        if (!els.slidesList) return;
        const rect = els.slidesList.getBoundingClientRect();
        const edge = 48;
        const step = 20;
        if (clientY < rect.top + edge) {
          els.slidesList.scrollTop -= step;
        } else if (clientY > rect.bottom - edge) {
          els.slidesList.scrollTop += step;
        }
      }

      function openSlideRailContextMenu(slideId, slideIndex, clientX, clientY) {
        if (state.mode !== "edit") return;
        closeShellPanels({ keep: "context-menu" });
        closeTransientShellUi({ keep: "context-menu" });
        state.contextMenuNodeId = null;
        state.contextMenuPayload = {
          menuScope: "slide-rail",
          slideId,
          slideIndex,
          slideCount: state.slides.length,
          origin: "shell",
          shellClientX: clientX,
          shellClientY: clientY,
        };
        renderContextMenu(state.contextMenuPayload);
        positionContextMenu(clientX, clientY);
        els.contextMenu.classList.add("is-open");
        els.contextMenu.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() => focusContextMenuButton(0));
      }

      function moveSlideToIndex(fromIndex, toIndex, options = {}) {
        if (!canUseStaticSlideModel()) return;
        const slides = state.slides;
        if (!slides.length) return;
        const normalizedFromIndex = Math.max(0, Math.min(slides.length - 1, fromIndex));
        const normalizedToIndex = Math.max(0, Math.min(slides.length - 1, toIndex));
        if (normalizedFromIndex === normalizedToIndex) return;
        const current = slides[normalizedFromIndex];
        const target = slides[normalizedToIndex];
        const currentEl = getSlideModelNodeById(current?.id);
        const targetEl = getSlideModelNodeById(target?.id);
        if (!current || !target || !currentEl || !targetEl) return;
        const reorderedSlides = slides.slice();
        const [movedSlide] = reorderedSlides.splice(normalizedFromIndex, 1);
        reorderedSlides.splice(normalizedToIndex, 0, movedSlide);
        if (normalizedToIndex < normalizedFromIndex) targetEl.before(currentEl);
        else targetEl.after(currentEl);
        syncStaticSlideOrderingMetadata();
        const activateMovedSlide = options.activateMovedSlide !== false;
        let nextActiveId = current.id;
        if (!activateMovedSlide) {
          nextActiveId = state.activeSlideId;
          if (nextActiveId === current.id) {
            const fallbackIndex = Math.min(
              normalizedFromIndex,
              Math.max(0, reorderedSlides.length - 1),
            );
            nextActiveId = reorderedSlides[fallbackIndex]?.id || reorderedSlides[0]?.id || null;
          }
        }
        const nextActiveIndex = Math.max(0, reorderedSlides.findIndex((slide) => slide.id === nextActiveId));
        stageSlideActivationRequest(nextActiveId, {
          source: "slide-move-model",
          index: nextActiveIndex,
        });
        commitChange("slide-move");
        syncSlideRegistry({ currentActiveId: nextActiveId });
        rebuildPreviewKeepingContext(nextActiveId);
      }

      // =====================================================================
