      // ZONE: History: Undo / Redo
      // undo(), redo(), recordHistoryChange, commitChange
      // =====================================================================
      function undo() {
        if (state.historyIndex <= 0) return;
        state.historyIndex -= 1;
        restoreSnapshot(state.history[state.historyIndex]);
        refreshUi();
      }

      function redo() {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex += 1;
        restoreSnapshot(state.history[state.historyIndex]);
        refreshUi();
      }

      function clearAutosave() {
        try {
          getAutosaveStorage().removeItem(STORAGE_KEY);
        } catch (error) {
          reportShellWarning("autosave-clear-failed", error, { once: true });
        }
      }

      function addDiagnostic(message) {
        state.diagnostics.push(
          `[${new Date().toLocaleTimeString()}] ${message}`,
        );
        state.diagnostics = state.diagnostics.slice(-18);
        updateDiagnostics();
      }

      function reportShellWarning(code, error, options = {}) {
        const detail = error instanceof Error
          ? error.message || error.name
          : String(error || "unknown-error");
        const cacheKey = `${code}:${detail}`;
        if (options.once && SHELL_WARNING_CACHE.has(cacheKey)) return;
        if (options.once) SHELL_WARNING_CACHE.add(cacheKey);
        console.warn(`[presentation-editor] ${code}: ${detail}`, error);
        if (options.diagnostic !== false) addDiagnostic(`${code}: ${detail}`);
        if (options.toast) {
          showToast(
            options.toastMessage || detail,
            options.toastType || "warning",
            {
              title: options.toastTitle || "Диагностика shell",
            },
          );
        }
      }

      function getPreviewDocument() {
        return els.previewFrame?.contentDocument || null;
      }

      function getPreviewActiveSlideElement(doc = getPreviewDocument()) {
        if (!doc) return null;
        return doc.body || doc.documentElement || null;
      }

      function getActiveOverlapKey() {
        return (
          state.activeSlideId || state.runtimeActiveSlideId || state.selectedNodeId || "__global__"
        );
      }

      function parseNumericZIndex(el) {
        if (!el || el.nodeType !== 1) return 0;
        const authoredZ = Number.parseFloat(String(el.style?.zIndex || "").trim());
        if (Number.isFinite(authoredZ)) return authoredZ;
        const view = el.ownerDocument?.defaultView || window;
        const z = String(view.getComputedStyle(el).zIndex || "").trim();
        const n = Number.parseFloat(z);
        return Number.isFinite(n) ? n : 0;
      }

      function compareVisualStackOrder(a, b) {
        const za = parseNumericZIndex(a);
        const zb = parseNumericZIndex(b);
        if (za !== zb) return za - zb;
        const pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      }

      function computeRectIntersection(a, b) {
        const left = Math.max(a.left, b.left);
        const top = Math.max(a.top, b.top);
        const right = Math.min(a.right, b.right);
        const bottom = Math.min(a.bottom, b.bottom);
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);
        return {
          left,
          top,
          right,
          bottom,
          width,
          height,
          area: width * height,
        };
      }

      function detectOverlapConflicts(slideEl) {
        if (!slideEl || typeof slideEl.querySelectorAll !== "function") return [];
        const nodes = Array.from(slideEl.querySelectorAll("[data-editor-node-id]"))
          .filter((el) => el != null && el.nodeType === 1)
          .filter((el) => !el.hasAttribute("data-editor-slide-id"))
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            const view = el.ownerDocument?.defaultView || window;
            const style = view.getComputedStyle(el);
            if (!(rect.width > 0 && rect.height > 0)) return false;
            if (style.display === "none" || style.visibility === "hidden") return false;
            return true;
          });
        const conflicts = [];
        for (let i = 0; i < nodes.length; i += 1) {
          for (let j = i + 1; j < nodes.length; j += 1) {
            const left = nodes[i];
            const right = nodes[j];
            const stackCmp = compareVisualStackOrder(left, right);
            const topEl = stackCmp >= 0 ? left : right;
            const bottomEl = stackCmp >= 0 ? right : left;
            const topRect = topEl.getBoundingClientRect();
            const bottomRect = bottomEl.getBoundingClientRect();
            const overlap = computeRectIntersection(topRect, bottomRect);
            if (!(overlap.width > 10 && overlap.height > 10)) continue;
            const bottomArea = Math.max(1, bottomRect.width * bottomRect.height);
            const coveredPercent = Math.min(
              100,
              Math.round((overlap.area / bottomArea) * 100),
            );
            const topNodeId =
              String(topEl.getAttribute("data-editor-node-id") || "").trim() || null;
            const bottomNodeId =
              String(bottomEl.getAttribute("data-editor-node-id") || "").trim() || null;
            if (!topNodeId || !bottomNodeId) continue;
            conflicts.push({
              topNodeId,
              bottomNodeId,
              overlapArea: Math.round(overlap.area),
              coveredPercent,
              overlapRect: {
                left: overlap.left,
                top: overlap.top,
                right: overlap.right,
                bottom: overlap.bottom,
              },
            });
          }
        }
        return conflicts.sort((a, b) => b.coveredPercent - a.coveredPercent);
      }

      function updateSelectedOverlapWarning(conflicts) {
        const selectedNodeId = state.selectedNodeId;
        if (!selectedNodeId) {
          state.selectedOverlapWarning = null;
          return;
        }
        const relevant = conflicts
          .filter((conflict) => conflict.bottomNodeId === selectedNodeId)
          .sort((a, b) => b.coveredPercent - a.coveredPercent);
        state.selectedOverlapWarning = relevant[0] || null;
      }

      function inferSelectionOverlapConflict(doc) {
        if (!doc || !state.selectedNodeId) return null;
        const selectedEl = doc.querySelector(
          `[data-editor-node-id="${cssEscape(state.selectedNodeId)}"]`,
        );
        if (!selectedEl || selectedEl.nodeType !== 1) return null;
        const rect = selectedEl.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) return null;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const stack = (doc.elementsFromPoint(cx, cy) || [])
          .filter((el) => el?.nodeType === 1 && el.hasAttribute("data-editor-node-id"));
        const unique = [];
        const seen = new Set();
        stack.forEach((el) => {
          const nodeId = String(el.getAttribute("data-editor-node-id") || "").trim();
          if (!nodeId || seen.has(nodeId)) return;
          seen.add(nodeId);
          unique.push({ el, nodeId });
        });
        const selectedIndex = unique.findIndex((item) => item.nodeId === state.selectedNodeId);
        if (!(selectedIndex > 0)) return null;
        const top = unique[0];
        const overlapRect = {
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        };
        return {
          topNodeId: top.nodeId,
          bottomNodeId: state.selectedNodeId,
          overlapArea: Math.round(rect.width * rect.height),
          coveredPercent: 80,
          overlapRect,
        };
      }

      function clearOverlapGhostHighlight() {
        if (state.overlapHoverNodeId) {
          sendToBridge("highlight-node", { nodeId: null });
          state.overlapHoverNodeId = null;
        }
      }

      function handleOverlapHoverMove(event) {
        if (state.complexityMode !== "basic") {
          clearOverlapGhostHighlight();
          return;
        }
        const conflicts = state.overlapConflictsBySlide[getActiveOverlapKey()] || [];
        const hiddenConflicts = conflicts.filter((conflict) => conflict.coveredPercent >= 30);
        if (!hiddenConflicts.length) {
          clearOverlapGhostHighlight();
          return;
        }
        const x = event.clientX;
        const y = event.clientY;
        const picked = hiddenConflicts.find((conflict) => {
          const rect = conflict.overlapRect;
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        });
        const nextNodeId = picked?.bottomNodeId || null;
        if (nextNodeId === state.overlapHoverNodeId) return;
        state.overlapHoverNodeId = nextNodeId;
        sendToBridge("highlight-node", { nodeId: nextNodeId });
      }

      function handleOverlapHoverLeave() {
        clearOverlapGhostHighlight();
      }

      function syncOverlapHoverBinding() {
        const doc = getPreviewDocument();
        if (state.overlapHoverBoundDoc && state.overlapHoverBoundDoc !== doc) {
          state.overlapHoverBoundDoc.removeEventListener("mousemove", handleOverlapHoverMove);
          state.overlapHoverBoundDoc.removeEventListener("mouseleave", handleOverlapHoverLeave);
          state.overlapHoverBoundDoc = null;
        }
        if (state.overlapHoverBoundDoc) {
          state.overlapHoverBoundDoc.removeEventListener("mousemove", handleOverlapHoverMove);
          state.overlapHoverBoundDoc.removeEventListener("mouseleave", handleOverlapHoverLeave);
          state.overlapHoverBoundDoc = null;
        }
        clearOverlapGhostHighlight();
      }

      function runOverlapDetectionNow(reason = "manual") {
        if (!state.previewReady) return;
        const doc = getPreviewDocument();
        const slideEl = getPreviewActiveSlideElement(doc);
        if (!slideEl) return;
        const conflicts = detectOverlapConflicts(slideEl);
        if (!conflicts.length) {
          const inferred = inferSelectionOverlapConflict(doc);
          if (inferred) conflicts.push(inferred);
        }
        const overlapKey = getActiveOverlapKey();
        state.overlapConflictsBySlide[overlapKey] = conflicts;
        if (state.activeSlideId) {
          state.overlapConflictsBySlide[state.activeSlideId] = conflicts;
        }
        state.slideOverlapWarnings[overlapKey] = conflicts.some(
          (conflict) => conflict.coveredPercent > 30,
        );
        if (state.activeSlideId) {
          state.slideOverlapWarnings[state.activeSlideId] = state.slideOverlapWarnings[overlapKey];
        }
        updateSelectedOverlapWarning(conflicts);
        if (!conflicts.length) clearOverlapGhostHighlight();
        if (reason) addDiagnostic(`overlap-detect:${reason}:${conflicts.length}`);
        renderSlidesList();
        updateInspectorFromSelection();
      }

      function scheduleOverlapDetection(reason = "debounced") {
        if (state.overlapDetectionTimer) {
          clearTimeout(state.overlapDetectionTimer);
          state.overlapDetectionTimer = 0;
        }
        state.overlapDetectionTimer = window.setTimeout(() => {
          state.overlapDetectionTimer = 0;
          runOverlapDetectionNow(reason);
        }, 200);
      }

      function getTopZIndexForActiveSlide() {
        const slideEl = getPreviewActiveSlideElement();
        if (!slideEl || typeof slideEl.querySelectorAll !== "function") return 0;
        const values = Array.from(slideEl.querySelectorAll("[data-editor-node-id]"))
          .map((el) => parseNumericZIndex(el))
          .filter((v) => Number.isFinite(v));
        return values.length ? Math.max(...values) : 0;
      }

      function updateDiagnostics() {
        pruneSlideSyncLocks();
        const lockCount = Object.keys(state.slideSyncLocks).length;
        const lines = [];
        lines.push(`engine=${state.engine}`);
        lines.push(`previewReady=${state.previewReady}`);
        lines.push(`bridgeAlive=${state.bridgeAlive}`);
        lines.push(`mode=${state.mode}`);
        lines.push(`interactionMode=${state.interactionMode}`);
        lines.push(`toolbarLayout=${document.body.dataset.toolbarLayout || "floating"}`);
        lines.push(`contextMenuLayout=${document.body.dataset.contextMenuLayout || "floating"}`);
        lines.push(`theme=${state.themePreference}->${state.theme}`);
        lines.push(`staticSelector=${state.staticSlideSelector || "n/a"}`);
        lines.push(`slides=${state.slides.length}`);
        lines.push(`activeSlideId=${state.activeSlideId || "n/a"}`);
        lines.push(`editingSupported=${state.editingSupported}`);
        lines.push(`history=${state.historyIndex + 1}/${state.history.length}`);
        lines.push(`unresolvedAssets=${state.unresolvedPreviewAssets?.length || 0}`);
        if ((state.unresolvedPreviewAssets?.length || 0) > 0) {
          lines.push(
            `unresolvedSample=${state.unresolvedPreviewAssets.slice(0, 3).join(", ")}`,
          );
        }
        lines.push(`baseUrlAssets=${state.baseUrlDependentAssets?.length || 0}`);
        lines.push(`syncSeq=${state.lastAppliedSeq}`);
        lines.push(`syncLocks=${lockCount}`);
        const overlapKey = getActiveOverlapKey();
        const activeConflicts =
          (state.overlapConflictsBySlide[overlapKey] || []).length;
        lines.push(`overlapConflicts=${activeConflicts}`);
        lines.push(
          `overlapSevere=${Boolean(state.slideOverlapWarnings[overlapKey])}`,
        );
        if (state.selectedNodeId) {
          lines.push(
            `directManipSafe=${state.manipulationContext?.directManipulationSafe !== false}`,
          );
          if (state.manipulationContext?.directManipulationSafe === false) {
            lines.push(
              `directManipReason=${state.manipulationContext?.directManipulationReason || "n/a"}`,
            );
          }
        }
        if (state.diagnostics.length) {
          lines.push("---");
          lines.push(...state.diagnostics);
        }
        els.diagnosticsBox.textContent = lines.join("\n");
      }

      function pluralizeSlides(count) {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11) return "слайд";
        if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14))
          return "слайда";
        return "слайдов";
      }

      function extractDoctype(html) {
        const match = html.match(/<!doctype[^>]*>/i);
        return match ? match[0] : "";
      }

      function rgbToHex(color) {
        if (!color) return "#000000";
        if (color.startsWith("#")) return normalizeHex(color);
        const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!match) return "#000000";
        const [, r, g, b] = match;
        return `#${[r, g, b].map((value) => Number(value).toString(16).padStart(2, "0")).join("")}`;
      }

      function normalizeHex(value) {
        if (!value) return "#000000";
        if (value.length === 4) {
          return (
            "#" +
            value
              .slice(1)
              .split("")
              .map((ch) => ch + ch)
              .join("")
          );
        }
        return value;
      }

      function safeSelectValue(select, value) {
        const match = Array.from(select.options).some(
          (option) => option.value === value,
        );
        return match ? value : "";
      }

      function sanitizeCssValue(value) {
        if (
          !value ||
          value === "auto" ||
          value === "normal" ||
          value === "none"
        )
          return "";
        return value;
      }

      function normalizeCssInput(value) {
        const trimmed = String(value || "").trim();
        if (!trimmed) return "";
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) return `${trimmed}px`;
        return trimmed;
      }

      function toCssSize(value) {
        return value ? `${value}px` : "";
      }

      function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === "function")
          return window.CSS.escape(String(value));
        return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
      }

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function shouldIgnoreGlobalShortcut(event) {
        return isEditableTypingTarget(event?.target);
      }

      function isEditableTypingTarget(target) {
        if (!(target instanceof Element)) return false;
        if (target instanceof HTMLElement && target.isContentEditable) return true;
        return Boolean(
          target.closest(
            'input, textarea, select, option, [contenteditable=""], [contenteditable="true"], [contenteditable]:not([contenteditable="false"])',
          ),
        );
      }

      function canTextEditCurrentSelection() {
        return Boolean(
          state.selectedNodeId &&
            state.selectedFlags.canEditText &&
            state.selectedPolicy?.canEditText,
        );
      }

      function isContextMenuOpen() {
        return Boolean(
          els.contextMenu?.classList.contains("is-open") && state.contextMenuPayload,
        );
      }

      function isActiveTextEditingContext(event) {
        if (state.mode !== "edit") return false;
        if (isEditableTypingTarget(event?.target)) return true;
        const active = document.activeElement;
        if (isEditableTypingTarget(active)) return true;
        if (
          active === els.previewFrame &&
          canTextEditCurrentSelection() &&
          (state.interactionMode === "text-edit" || state.selectedFlags.isTextEditing)
        ) {
          return true;
        }
        return Boolean(
          canTextEditCurrentSelection() &&
            (state.interactionMode === "text-edit" || state.selectedFlags.isTextEditing),
        );
      }

      async function fileToDataUrl(file) {
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () =>
            reject(reader.error || new Error("Не удалось прочитать файл."));
          reader.onload = () => resolve(String(reader.result || ""));
          reader.readAsDataURL(file);
        });
      }

      function insertCustomHtmlFromTextarea() {
        if (!state.modelDoc) return;
        const html = els.insertHtmlTextarea.value.trim();
        if (!html) {
          alert("В поле HTML ничего нет.");
          return;
        }
        try {
          const root = parseSingleRootElement(html);
          sendToBridge("insert-element", {
            slideId: state.activeSlideId || state.slides[0]?.id || "slide-1",
            anchorNodeId: state.selectedNodeId,
            position: state.selectedNodeId ? "after" : "append",
            html: root.outerHTML,
            focusText: false,
          });
          els.insertHtmlTextarea.value = "";
        } catch (error) {
          alert(error.message || "Нужен один корневой HTML‑элемент.");
        }
      }

      function toVideoEmbedUrl(url) {
        try {
          const parsed = new URL(url, window.location.href);
          const host = parsed.hostname.replace(/^www\./, "");
          if (host === "youtube.com" || host === "m.youtube.com") {
            const id = parsed.searchParams.get("v");
            return id
              ? `https://www.youtube.com/embed/${encodeURIComponent(id)}`
              : null;
          }
          if (host === "youtu.be") {
            const id = parsed.pathname.replace(/^\//, "");
            return id
              ? `https://www.youtube.com/embed/${encodeURIComponent(id)}`
              : null;
          }
          if (host === "vimeo.com") {
            const id = parsed.pathname.replace(/^\//, "");
            return id
              ? `https://player.vimeo.com/video/${encodeURIComponent(id)}`
              : null;
          }
        } catch (error) {
          reportShellWarning("video-embed-url-parse-failed", error, {
            once: true,
            diagnostic: false,
          });
        }
        return null;
      }

      function moveSelectedElement(direction) {
        if (!state.selectedNodeId) return;
        if (
          !guardSelectionAction(
            "reorder",
            direction < 0 ? "Сдвиг вверх" : "Сдвиг вниз",
          )
        )
          return;
        if (
          !guardProtectedSelection(direction < 0 ? "Сдвиг вверх" : "Сдвиг вниз")
        )
          return;
        sendToBridge("move-element", {
          nodeId: state.selectedNodeId,
          direction,
        });
      }

      function isLayerManagedNode(node) {
        return Boolean(
          node instanceof Element &&
            node.hasAttribute("data-editor-node-id") &&
            !node.hasAttribute("data-editor-slide-id") &&
            node.getAttribute("data-editor-policy-kind") !== "protected",
        );
      }

      function getActiveSlideModelElement() {
        if (!state.modelDoc || !state.activeSlideId) return null;
        return state.modelDoc.querySelector(
          `[data-editor-slide-id="${cssEscape(state.activeSlideId)}"]`,
        );
      }

      function getLayerScopeInfo() {
        const slideEl = getActiveSlideModelElement();
        if (!slideEl) return null;
        const selectedNode = getSelectedModelNode();
        let scopeRoot = slideEl;
        if (
          selectedNode instanceof Element &&
          selectedNode.parentElement &&
          selectedNode.closest(`[data-editor-slide-id="${cssEscape(state.activeSlideId)}"]`) ===
            slideEl
        ) {
          const siblingNodes = Array.from(selectedNode.parentElement.children).filter(
            (node) => isLayerManagedNode(node),
          );
          if (siblingNodes.includes(selectedNode)) {
            scopeRoot = selectedNode.parentElement;
          }
        }
        const nodes = Array.from(scopeRoot.children).filter((node) =>
          isLayerManagedNode(node),
        );
        return {
          slideEl,
          scopeRoot,
          nodes,
          selectedNode,
        };
      }

      function buildLayerVisualOrder(nodes) {
        return nodes.slice().sort(compareVisualStackOrder);
      }

      function applyLayerVisualOrder(orderedNodes, reason, options = {}) {
        if (!orderedNodes.length) return false;
        orderedNodes.forEach((node, index) => {
          const nodeId = String(node.getAttribute("data-editor-node-id") || "").trim();
          if (!nodeId) return;
          const nextZ = String((index + 1) * 10);
          node.style.zIndex = nextZ;
          sendToBridge("apply-style", {
            nodeId,
            property: "z-index",
            value: nextZ,
          });
        });
        recordHistoryChange(reason);
        if (state.selectedNodeId) {
          stagePreviewSelectionRestore(state.selectedNodeId, {
            slideId: state.activeSlideId,
            selectionLeafNodeId: state.selectionLeafNodeId,
            selectionPathNodeIds: Array.isArray(state.selectionPath)
              ? state.selectionPath.map((entry) => entry?.nodeId)
              : [],
          });
        }
        rebuildPreviewKeepingContext(state.activeSlideId);
        scheduleOverlapDetection(reason);
        renderLayersPanel();
        updateInspectorFromSelection();
        if (options.toastMessage) {
          showToast(options.toastMessage, options.toastType || "success", {
            title: options.toastTitle || "Слои",
          });
        }
        return true;
      }

      function normalizeLayersForCurrentScope() {
        if (state.complexityMode !== "advanced") return false;
        if (
          state.selectedNodeId &&
          !guardSelectionAction("reorder", "Упорядочить стек")
        ) {
          return false;
        }
        if (
          state.selectedNodeId &&
          !guardProtectedSelection("Упорядочить стек", { action: "reorder" })
        ) {
          return false;
        }
        const scope = getLayerScopeInfo();
        if (!scope || scope.nodes.length < 2) {
          showToast("Нормализовывать нечего: в текущем scope меньше двух слоёв.", "info", {
            title: "Слои",
          });
          return false;
        }
        return applyLayerVisualOrder(buildLayerVisualOrder(scope.nodes), "normalize-layers", {
          toastMessage: "Стек упорядочен без изменения видимого порядка.",
        });
      }

      function moveSelectedLayerByOrder(action) {
        if (!state.selectedNodeId) return false;
        if (!guardSelectionAction("reorder", "Порядок слоёв")) return false;
        if (!guardProtectedSelection("Порядок слоёв", { action: "reorder" })) {
          return false;
        }
        const scope = getLayerScopeInfo();
        if (!scope || scope.nodes.length < 2) {
          showToast("Для выбранного scope нет соседних слоёв.", "info", {
            title: "Слои",
          });
          return false;
        }
        const ordered = buildLayerVisualOrder(scope.nodes);
        const currentIndex = ordered.findIndex(
          (node) =>
            node.getAttribute("data-editor-node-id") === state.selectedNodeId,
        );
        if (currentIndex < 0) return false;
        let targetIndex = currentIndex;
        let blockedMessage = "Перемещение недоступно.";
        let successMessage = "Порядок слоёв обновлён.";
        if (action === "layer-forward") {
          targetIndex = Math.min(ordered.length - 1, currentIndex + 1);
          blockedMessage = "Элемент уже находится ближе всех к переднему плану.";
          successMessage = "Элемент поднят на один слой вперёд.";
        } else if (action === "layer-backward") {
          targetIndex = Math.max(0, currentIndex - 1);
          blockedMessage = "Элемент уже находится ближе всех к заднему плану.";
          successMessage = "Элемент опущен на один слой назад.";
        } else if (action === "layer-front") {
          targetIndex = ordered.length - 1;
          blockedMessage = "Элемент уже находится на переднем плане.";
          successMessage = "Элемент перемещён на передний план.";
        } else if (action === "layer-back") {
          targetIndex = 0;
          blockedMessage = "Элемент уже находится на заднем плане.";
          successMessage = "Элемент перемещён на задний план.";
        } else {
          return false;
        }
        if (targetIndex === currentIndex) {
          showToast(blockedMessage, "info", { title: "Слои" });
          return false;
        }
        const nextOrder = ordered.slice();
        const [movedNode] = nextOrder.splice(currentIndex, 1);
        nextOrder.splice(targetIndex, 0, movedNode);
        return applyLayerVisualOrder(
          nextOrder,
          `layer-order:${action}:${state.selectedNodeId}`,
          { toastMessage: successMessage },
        );
      }

      function extractImageFromClipboardEvent(event) {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(
          (item) => item.kind === "file" && item.type.startsWith("image/"),
        );
        return imageItem ? imageItem.getAsFile() : null;
      }

      /* ======================================================================
       shell routing + responsive shell state
       ====================================================================== */

      function setPreviewLoading(active, text = "Подготовка превью…") {
        state.loadingPreview = Boolean(active);
        if (els.previewLoadingText) els.previewLoadingText.textContent = text;
        if (els.previewLoading) {
          els.previewLoading.classList.toggle("is-visible", Boolean(active));
          els.previewLoading.setAttribute(
            "aria-hidden",
            active ? "false" : "true",
          );
        }
      }

      function setStatusMessage(element, message, type = "info", options = {}) {
        if (!(element instanceof HTMLElement)) return;
        const text = String(message || "").trim();
        const visible = Boolean(text) || options.keepVisible === true;
        element.hidden = !visible;
        element.className = `modal-status is-${type}`;
        element.textContent = text;
        if (visible) element.dataset.statusKind = type;
        else delete element.dataset.statusKind;
      }

      function clearOpenHtmlStatus() {
        setStatusMessage(els.openHtmlStatus, "", "info");
      }

      function setOpenHtmlStatus(message, type = "warning") {
        setStatusMessage(els.openHtmlStatus, message, type);
      }

      function resetHtmlEditorStatus() {
        setStatusMessage(
          els.htmlEditorStatus,
          statusDefaults.htmlEditor,
          "info",
          { keepVisible: true },
        );
      }

      function setHtmlEditorStatus(message, type = "info") {
        setStatusMessage(els.htmlEditorStatus, message, type, {
          keepVisible: true,
        });
      }

      function clearVideoInsertStatus() {
        setStatusMessage(els.videoInsertStatus, "", "info");
      }

      function setVideoInsertStatus(message, type = "warning") {
        setStatusMessage(els.videoInsertStatus, message, type);
      }

      async function copyTextWithShellFeedback(text, options = {}) {
        const value = String(text || "");
        if (!value) return false;
        try {
          await navigator.clipboard.writeText(value);
          if (options.successMessage) {
            showToast(options.successMessage, "success", {
              title: options.title || "Буфер обмена",
            });
          }
          return true;
        } catch (error) {
          reportShellWarning("clipboard-write-failed", error, {
            once: true,
            diagnostic: false,
          });
          showToast(
            options.failureMessage ||
              "Не удалось скопировать текст автоматически. Попробуйте ещё раз из контекстного меню.",
            "warning",
            {
              title: options.title || "Буфер обмена",
            },
          );
          return false;
        }
      }

      // =====================================================================
