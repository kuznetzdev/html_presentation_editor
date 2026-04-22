      // ZONE: History: Undo / Redo + Patch Engine
      // undo(), redo(), captureHistorySnapshot, serializeCurrentProject, restoreSnapshot
      // createDomPatch, fnv1a32, HISTORY_CLIENT_ID
      // =====================================================================
      // WO-18: patch-based snapshots + budget chip (ADR-013 §history slice)
      // =====================================================================

      // =====================================================================
      // HISTORY_CLIENT_ID — stable per-session random ID.
      // Generated once at parse time. Every patch gets this clientId for
      // ADR-017 collaborative-editing readiness (causal ordering).
      // Uses crypto.getRandomValues when available, falls back to Math.random.
      // =====================================================================
      var HISTORY_CLIENT_ID = (function () {
        try {
          if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
            var buf = new Uint8Array(8);
            crypto.getRandomValues(buf);
            return Array.from(buf, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
          }
        } catch (e) { /* fallback */ }
        return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      })();

      // Monotonically increasing per-session patch counter.
      var _historyPatchCounter = 0;

      // =====================================================================
      // fnv1a32(str) — FNV-1a 32-bit hash of a UTF-16 string.
      // Synchronous, no crypto.subtle required. Returns a lowercase hex string.
      // Used for deduplication: identical HTML → identical hash → skip commit.
      // =====================================================================
      function fnv1a32(str) {
        var hash = 0x811c9dc5;
        for (var i = 0; i < str.length; i++) {
          hash ^= str.charCodeAt(i);
          // FNV prime 0x01000193 — multiply in two steps to stay within 32-bit
          hash = (hash * 0x01000193) >>> 0;
        }
        return hash.toString(16).padStart(8, "0");
      }

      // =====================================================================
      // createDomPatch(html, reason, baselineIndex) — produce a HistoryPatch.
      //
      // Patch strategy (ADR-013 WO-18):
      //   - First commit ever → baseline
      //   - Every 11th commit after last baseline → fresh baseline
      //   - All others → delta (stores full html in diff for full-HTML fallback)
      //
      // Full-HTML fallback is preserved: every patch stores the complete HTML
      // so restoreSnapshot never needs true-diff replay (ADR-017 requirement).
      // =====================================================================
      function createDomPatch(html, reason, currentPatches) {
        var at = Date.now();
        var hash = fnv1a32(html);
        var counter = ++_historyPatchCounter;

        // Find how many patches since last baseline (for periodic baseline schedule)
        var patchesSinceBaseline = 0;
        for (var i = currentPatches.length - 1; i >= 0; i--) {
          if (currentPatches[i].op === "baseline") break;
          patchesSinceBaseline++;
        }

        // Roll a fresh baseline on the 10th delta since last baseline.
        // patchesSinceBaseline counts deltas already in currentPatches before
        // this call; when it reaches 9, the incoming commit IS the 10th delta,
        // so we write a baseline instead.  (Period: 10 deltas between baselines.)
        var isBaseline = currentPatches.length === 0 || patchesSinceBaseline >= 9;

        if (isBaseline) {
          return {
            op: "baseline",
            html: html,
            reason: reason,
            at: at,
            clientId: HISTORY_CLIENT_ID,
            counter: counter,
            hash: hash,
          };
        }

        // Delta: find index of current baseline
        var baselineIndex = -1;
        for (var j = currentPatches.length - 1; j >= 0; j--) {
          if (currentPatches[j].op === "baseline") {
            baselineIndex = j;
            break;
          }
        }

        return {
          op: "delta",
          html: html,
          diff: JSON.stringify({ nextHtml: html }),
          reason: reason,
          at: at,
          clientId: HISTORY_CLIENT_ID,
          counter: counter,
          baselineIndex: baselineIndex,
          hash: hash,
        };
      }

      // =====================================================================
      // ZONE: Snapshot functions (moved from export.js — WO-18)
      // serializeCurrentProject, captureHistorySnapshot, restoreSnapshot
      // =====================================================================

      function serializeCurrentProject() {
        var exportDoc = state.modelDoc.cloneNode(true);
        stripEditorArtifacts(exportDoc);
        return state.doctypeString + "\n" + exportDoc.documentElement.outerHTML;
      }

      function captureHistorySnapshot(reason, options) {
        options = options || {};
        if (!state.modelDoc) return;

        var html = serializeCurrentProject();
        var hash = fnv1a32(html);

        // Read current patch list from store (immutable — get fresh copy)
        var histSlice = window.store.get("history");
        var currentIndex = histSlice.index;
        var currentPatches = histSlice.patches;

        // Trim forward-redo branch if we're not at the tip
        if (currentIndex < currentPatches.length - 1) {
          currentPatches = currentPatches.slice(0, currentIndex + 1);
        }

        // Dedup: same hash as current tip → skip (unless force)
        var prevHash = currentPatches.length > 0 && currentIndex >= 0
          ? currentPatches[currentIndex].hash
          : null;
        if (prevHash === hash && !options.force) {
          refreshUi();
          return;
        }

        // Build new patch
        var patch = createDomPatch(html, reason, currentPatches);

        // Augment with session metadata required for restore (sourceLabel, manualBaseUrl,
        // mode, activeSlideIndex).  createDomPatch intentionally omits state — it is a
        // pure function used in unit tests without browser globals.
        var slideIds = state.slides.map(function (s) { return s.id; });
        var requestedSlideId = (typeof getRequestedSlideId === "function")
          ? getRequestedSlideId() : null;
        var snapshotActiveSlideId = slideIds.includes(requestedSlideId)
          ? requestedSlideId
          : slideIds.includes(state.activeSlideId)
            ? state.activeSlideId
            : slideIds.includes(state.runtimeActiveSlideId)
              ? state.runtimeActiveSlideId
              : (state.slides[0] ? state.slides[0].id : null);
        patch.sourceLabel = state.sourceLabel || null;
        patch.manualBaseUrl = state.manualBaseUrl || "";
        patch.mode = (typeof normalizeEditorMode === "function")
          ? normalizeEditorMode(state.mode) : state.mode;
        patch.activeSlideIndex = Math.max(
          0,
          state.slides.findIndex(function (s) { return s.id === snapshotActiveSlideId; })
        );

        var nextPatches = currentPatches.concat([patch]);
        var dropped = false;

        // Enforce HISTORY_LIMIT: shift oldest when overflow
        if (nextPatches.length > HISTORY_LIMIT) {
          nextPatches = nextPatches.slice(nextPatches.length - HISTORY_LIMIT);
          dropped = true;
        }

        var nextIndex = nextPatches.length - 1;

        // Emit store update (single batch → one subscriber notification)
        window.store.batch(function () {
          window.store.update("history", {
            patches: nextPatches,
            index: nextIndex,
            baseline: patch.op === "baseline" ? patch : histSlice.baseline,
          });
        });

        // Mirror to raw state for backward compat (history[] / historyIndex).
        // state here is the global-scope const from state.js (raw object — not the proxy).
        // Legacy consumers (primary-action.js syncPrimaryActionUi) read state.history.length
        // and state.historyIndex directly, so we keep these in sync.
        state.history = nextPatches;
        state.historyIndex = nextIndex;

        if (dropped) {
          showToast(
            "Старейший шаг истории сброшен. Сохрани проект, чтобы не потерять работу.",
            "warning",
            { title: "История" }
          );
        }

        addDiagnostic("snapshot:" + reason);
        refreshUi();
      }

      function restoreSnapshot(snapshot) {
        if (!snapshot) return;

        // Support both legacy plain-object snapshots and new HistoryPatch format
        var html;
        if (snapshot.op === "baseline") {
          html = snapshot.html;
        } else if (snapshot.op === "delta") {
          // Full-HTML fallback: extract nextHtml from diff (ADR-017 requirement)
          try {
            html = JSON.parse(snapshot.diff).nextHtml;
          } catch (e) {
            html = snapshot.html;
          }
        } else {
          // Legacy snapshot shape from pre-WO-18 autosave
          html = snapshot.html;
        }

        if (!html) return;

        state.historyMuted = true;
        setManualBaseUrl(snapshot.manualBaseUrl || "");
        loadHtmlString(
          html,
          snapshot.sourceLabel || state.sourceLabel || "Восстановленная версия",
          {
            resetHistory: false,
            dirty: true,
            mode: normalizeEditorMode(snapshot.mode || state.mode, state.mode),
            preferSlideIndex: snapshot.activeSlideIndex || 0,
          }
        );
        state.historyMuted = false;
      }

      // =====================================================================
      // ZONE: Undo / Redo — use store-backed index
      // =====================================================================
      function undo() {
        var histSlice = window.store.get("history");
        var idx = histSlice.index;
        if (idx <= 0) return;
        var nextIdx = idx - 1;
        window.store.update("history", { index: nextIdx });
        state.historyIndex = nextIdx;
        restoreSnapshot(histSlice.patches[nextIdx]);
        refreshUi();
      }

      function redo() {
        var histSlice = window.store.get("history");
        var idx = histSlice.index;
        var patches = histSlice.patches;
        if (idx >= patches.length - 1) return;
        var nextIdx = idx + 1;
        window.store.update("history", { index: nextIdx });
        state.historyIndex = nextIdx;
        restoreSnapshot(patches[nextIdx]);
        refreshUi();
      }

      // =====================================================================
      // ZONE: Diagnostics + utility functions (unchanged from original)
      // =====================================================================
      function clearAutosave() {
        try {
          getAutosaveStorage().removeItem(STORAGE_KEY);
        } catch (error) {
          reportShellWarning("autosave-clear-failed", error, { once: true });
        }
      }

      function addDiagnostic(message) {
        state.diagnostics.push(
          "[" + new Date().toLocaleTimeString() + "] " + message
        );
        state.diagnostics = state.diagnostics.slice(-18);
        updateDiagnostics();
      }

      function reportShellWarning(code, error, options) {
        options = options || {};
        var detail = error instanceof Error
          ? error.message || error.name
          : String(error || "unknown-error");
        var cacheKey = code + ":" + detail;
        if (options.once && SHELL_WARNING_CACHE.has(cacheKey)) return;
        if (options.once) SHELL_WARNING_CACHE.add(cacheKey);
        console.warn("[presentation-editor] " + code + ": " + detail, error);
        if (options.diagnostic !== false) addDiagnostic(code + ": " + detail);
        if (options.toast) {
          showToast(
            options.toastMessage || detail,
            options.toastType || "warning",
            {
              title: options.toastTitle || "Диагностика shell",
            }
          );
        }
      }

      function getPreviewDocument() {
        return els.previewFrame && els.previewFrame.contentDocument || null;
      }

      function getPreviewActiveSlideElement(doc) {
        doc = doc || getPreviewDocument();
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
        var authoredZ = Number.parseFloat(String(el.style && el.style.zIndex || "").trim());
        if (Number.isFinite(authoredZ)) return authoredZ;
        var view = el.ownerDocument && el.ownerDocument.defaultView || window;
        var z = String(view.getComputedStyle(el).zIndex || "").trim();
        var n = Number.parseFloat(z);
        return Number.isFinite(n) ? n : 0;
      }

      function compareVisualStackOrder(a, b) {
        var za = parseNumericZIndex(a);
        var zb = parseNumericZIndex(b);
        if (za !== zb) return za - zb;
        var pos = a.compareDocumentPosition(b);
        if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
        if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
        return 0;
      }

      function computeRectIntersection(a, b) {
        var left = Math.max(a.left, b.left);
        var top = Math.max(a.top, b.top);
        var right = Math.min(a.right, b.right);
        var bottom = Math.min(a.bottom, b.bottom);
        var width = Math.max(0, right - left);
        var height = Math.max(0, bottom - top);
        return {
          left: left,
          top: top,
          right: right,
          bottom: bottom,
          width: width,
          height: height,
          area: width * height,
        };
      }

      function detectOverlapConflicts(slideEl) {
        if (!slideEl || typeof slideEl.querySelectorAll !== "function") return [];
        var nodes = Array.from(slideEl.querySelectorAll("[data-editor-node-id]"))
          .filter(function (el) { return el != null && el.nodeType === 1; })
          .filter(function (el) { return !el.hasAttribute("data-editor-slide-id"); })
          .filter(function (el) {
            var rect = el.getBoundingClientRect();
            var view = el.ownerDocument && el.ownerDocument.defaultView || window;
            var style = view.getComputedStyle(el);
            if (!(rect.width > 0 && rect.height > 0)) return false;
            if (style.display === "none" || style.visibility === "hidden") return false;
            return true;
          });
        var conflicts = [];
        for (var i = 0; i < nodes.length; i++) {
          for (var j = i + 1; j < nodes.length; j++) {
            var left = nodes[i];
            var right = nodes[j];
            var stackCmp = compareVisualStackOrder(left, right);
            var topEl = stackCmp >= 0 ? left : right;
            var bottomEl = stackCmp >= 0 ? right : left;
            var topRect = topEl.getBoundingClientRect();
            var bottomRect = bottomEl.getBoundingClientRect();
            var overlap = computeRectIntersection(topRect, bottomRect);
            if (!(overlap.width > 10 && overlap.height > 10)) continue;
            var bottomArea = Math.max(1, bottomRect.width * bottomRect.height);
            var coveredPercent = Math.min(
              100,
              Math.round((overlap.area / bottomArea) * 100)
            );
            var topNodeId =
              String(topEl.getAttribute("data-editor-node-id") || "").trim() || null;
            var bottomNodeId =
              String(bottomEl.getAttribute("data-editor-node-id") || "").trim() || null;
            if (!topNodeId || !bottomNodeId) continue;
            conflicts.push({
              topNodeId: topNodeId,
              bottomNodeId: bottomNodeId,
              overlapArea: Math.round(overlap.area),
              coveredPercent: coveredPercent,
              overlapRect: {
                left: overlap.left,
                top: overlap.top,
                right: overlap.right,
                bottom: overlap.bottom,
              },
            });
          }
        }
        return conflicts.sort(function (a, b) { return b.coveredPercent - a.coveredPercent; });
      }

      function updateSelectedOverlapWarning(conflicts) {
        var selectedNodeId = state.selectedNodeId;
        if (!selectedNodeId) {
          state.selectedOverlapWarning = null;
          return;
        }
        var relevant = conflicts
          .filter(function (conflict) { return conflict.bottomNodeId === selectedNodeId; })
          .sort(function (a, b) { return b.coveredPercent - a.coveredPercent; });
        state.selectedOverlapWarning = relevant[0] || null;
      }

      function inferSelectionOverlapConflict(doc) {
        if (!doc || !state.selectedNodeId) return null;
        var selectedEl = doc.querySelector(
          "[data-editor-node-id=\"" + cssEscape(state.selectedNodeId) + "\"]"
        );
        if (!selectedEl || selectedEl.nodeType !== 1) return null;
        var rect = selectedEl.getBoundingClientRect();
        if (!(rect.width > 0 && rect.height > 0)) return null;
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var stack = (doc.elementsFromPoint(cx, cy) || [])
          .filter(function (el) { return el && el.nodeType === 1 && el.hasAttribute("data-editor-node-id"); });
        var unique = [];
        var seen = new Set();
        stack.forEach(function (el) {
          var nodeId = String(el.getAttribute("data-editor-node-id") || "").trim();
          if (!nodeId || seen.has(nodeId)) return;
          seen.add(nodeId);
          unique.push({ el: el, nodeId: nodeId });
        });
        var selectedIndex = unique.findIndex(function (item) { return item.nodeId === state.selectedNodeId; });
        if (!(selectedIndex > 0)) return null;
        var top = unique[0];
        var overlapRect = {
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
          overlapRect: overlapRect,
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
        var conflicts = state.overlapConflictsBySlide[getActiveOverlapKey()] || [];
        var hiddenConflicts = conflicts.filter(function (conflict) { return conflict.coveredPercent >= 30; });
        if (!hiddenConflicts.length) {
          clearOverlapGhostHighlight();
          return;
        }
        var x = event.clientX;
        var y = event.clientY;
        var picked = hiddenConflicts.find(function (conflict) {
          var rect = conflict.overlapRect;
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        });
        var nextNodeId = picked && picked.bottomNodeId || null;
        if (nextNodeId === state.overlapHoverNodeId) return;
        state.overlapHoverNodeId = nextNodeId;
        sendToBridge("highlight-node", { nodeId: nextNodeId });
      }

      function handleOverlapHoverLeave() {
        clearOverlapGhostHighlight();
      }

      function syncOverlapHoverBinding() {
        var doc = getPreviewDocument();
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

      function runOverlapDetectionNow(reason) {
        reason = reason || "manual";
        if (!state.previewReady) return;
        var doc = getPreviewDocument();
        var slideEl = getPreviewActiveSlideElement(doc);
        if (!slideEl) return;
        var conflicts = detectOverlapConflicts(slideEl);
        if (!conflicts.length) {
          var inferred = inferSelectionOverlapConflict(doc);
          if (inferred) conflicts.push(inferred);
        }
        var overlapKey = getActiveOverlapKey();
        state.overlapConflictsBySlide[overlapKey] = conflicts;
        if (state.activeSlideId) {
          state.overlapConflictsBySlide[state.activeSlideId] = conflicts;
        }
        state.slideOverlapWarnings[overlapKey] = conflicts.some(
          function (conflict) { return conflict.coveredPercent > 30; }
        );
        if (state.activeSlideId) {
          state.slideOverlapWarnings[state.activeSlideId] = state.slideOverlapWarnings[overlapKey];
        }
        updateSelectedOverlapWarning(conflicts);
        if (!conflicts.length) clearOverlapGhostHighlight();
        if (reason) addDiagnostic("overlap-detect:" + reason + ":" + conflicts.length);
        renderSlidesList();
        updateInspectorFromSelection();
      }

      function scheduleOverlapDetection(reason) {
        reason = reason || "debounced";
        if (state.overlapDetectionTimer) {
          clearTimeout(state.overlapDetectionTimer);
          state.overlapDetectionTimer = 0;
        }
        state.overlapDetectionTimer = window.setTimeout(function () {
          state.overlapDetectionTimer = 0;
          runOverlapDetectionNow(reason);
        }, 200);
      }

      function getTopZIndexForActiveSlide() {
        var slideEl = getPreviewActiveSlideElement();
        if (!slideEl || typeof slideEl.querySelectorAll !== "function") return 0;
        var values = Array.from(slideEl.querySelectorAll("[data-editor-node-id]"))
          .map(function (el) { return parseNumericZIndex(el); })
          .filter(function (v) { return Number.isFinite(v); });
        return values.length ? Math.max.apply(Math, values) : 0;
      }

      function updateDiagnostics() {
        pruneSlideSyncLocks();
        var lockCount = Object.keys(state.slideSyncLocks).length;
        var lines = [];
        lines.push("engine=" + state.engine);
        lines.push("previewReady=" + state.previewReady);
        lines.push("bridgeAlive=" + state.bridgeAlive);
        lines.push("mode=" + state.mode);
        lines.push("interactionMode=" + state.interactionMode);
        lines.push("toolbarLayout=" + (document.body.dataset.toolbarLayout || "floating"));
        lines.push("contextMenuLayout=" + (document.body.dataset.contextMenuLayout || "floating"));
        lines.push("theme=" + state.themePreference + "->" + state.theme);
        lines.push("staticSelector=" + (state.staticSlideSelector || "n/a"));
        lines.push("slides=" + state.slides.length);
        lines.push("activeSlideId=" + (state.activeSlideId || "n/a"));
        lines.push("editingSupported=" + state.editingSupported);
        var histSlice = window.store.get("history");
        lines.push("history=" + (histSlice.index + 1) + "/" + histSlice.patches.length);
        lines.push("unresolvedAssets=" + (state.unresolvedPreviewAssets && state.unresolvedPreviewAssets.length || 0));
        if ((state.unresolvedPreviewAssets && state.unresolvedPreviewAssets.length || 0) > 0) {
          lines.push(
            "unresolvedSample=" + state.unresolvedPreviewAssets.slice(0, 3).join(", ")
          );
        }
        lines.push("baseUrlAssets=" + (state.baseUrlDependentAssets && state.baseUrlDependentAssets.length || 0));
        lines.push("syncSeq=" + state.lastAppliedSeq);
        lines.push("syncLocks=" + lockCount);
        var overlapKey = getActiveOverlapKey();
        var activeConflicts =
          (state.overlapConflictsBySlide[overlapKey] || []).length;
        lines.push("overlapConflicts=" + activeConflicts);
        lines.push(
          "overlapSevere=" + Boolean(state.slideOverlapWarnings[overlapKey])
        );
        if (state.selectedNodeId) {
          lines.push(
            "directManipSafe=" + (state.manipulationContext && state.manipulationContext.directManipulationSafe !== false)
          );
          if (state.manipulationContext && state.manipulationContext.directManipulationSafe === false) {
            lines.push(
              "directManipReason=" + (state.manipulationContext.directManipulationReason || "n/a")
            );
          }
        }
        if (state.diagnostics.length) {
          lines.push("---");
          lines.push.apply(lines, state.diagnostics);
        }
        els.diagnosticsBox.textContent = lines.join("\n");
        // WO-34: Sync telemetry viewer visibility alongside diagnostics update.
        if (typeof renderTelemetryViewer === "function") {
          renderTelemetryViewer();
        }
      }

      function pluralizeSlides(count) {
        var mod10 = count % 10;
        var mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11) return "слайд";
        if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14))
          return "слайда";
        return "слайдов";
      }

      function extractDoctype(html) {
        var match = html.match(/<!doctype[^>]*>/i);
        return match ? match[0] : "";
      }

      function rgbToHex(color) {
        if (!color) return "#000000";
        if (color.startsWith("#")) return normalizeHex(color);
        var match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!match) return "#000000";
        var r = match[1], g = match[2], b = match[3];
        return "#" + [r, g, b].map(function (value) { return Number(value).toString(16).padStart(2, "0"); }).join("");
      }

      function normalizeHex(value) {
        if (!value) return "#000000";
        if (value.length === 4) {
          return (
            "#" +
            value
              .slice(1)
              .split("")
              .map(function (ch) { return ch + ch; })
              .join("")
          );
        }
        return value;
      }

      function safeSelectValue(select, value) {
        var match = Array.from(select.options).some(
          function (option) { return option.value === value; }
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
        var trimmed = String(value || "").trim();
        if (!trimmed) return "";
        if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed + "px";
        return trimmed;
      }

      function toCssSize(value) {
        return value ? value + "px" : "";
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
        return isEditableTypingTarget(event && event.target);
      }

      function isEditableTypingTarget(target) {
        if (!(target instanceof Element)) return false;
        if (target instanceof HTMLElement && target.isContentEditable) return true;
        return Boolean(
          target.closest(
            'input, textarea, select, option, [contenteditable=""], [contenteditable="true"], [contenteditable]:not([contenteditable="false"])'
          )
        );
      }

      function canTextEditCurrentSelection() {
        return Boolean(
          state.selectedNodeId &&
            state.selectedFlags.canEditText &&
            state.selectedPolicy && state.selectedPolicy.canEditText
        );
      }

      function isContextMenuOpen() {
        return Boolean(
          els.contextMenu && els.contextMenu.classList.contains("is-open") && state.contextMenuPayload
        );
      }

      function isActiveTextEditingContext(event) {
        if (state.mode !== "edit") return false;
        if (isEditableTypingTarget(event && event.target)) return true;
        var active = document.activeElement;
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
            (state.interactionMode === "text-edit" || state.selectedFlags.isTextEditing)
        );
      }

      async function fileToDataUrl(file) {
        return await new Promise(function (resolve, reject) {
          var reader = new FileReader();
          reader.onerror = function () {
            reject(reader.error || new Error("Не удалось прочитать файл."));
          };
          reader.onload = function () { resolve(String(reader.result || "")); };
          reader.readAsDataURL(file);
        });
      }

      function insertCustomHtmlFromTextarea() {
        if (!state.modelDoc) return;
        var html = els.insertHtmlTextarea.value.trim();
        if (!html) {
          alert("В поле HTML ничего нет.");
          return;
        }
        try {
          var root = parseSingleRootElement(html);
          sendToBridge("insert-element", {
            slideId: state.activeSlideId || (state.slides[0] && state.slides[0].id) || "slide-1",
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
          var parsed = new URL(url, window.location.href);
          var host = parsed.hostname.replace(/^www\./, "");
          if (host === "youtube.com" || host === "m.youtube.com") {
            var id = parsed.searchParams.get("v");
            return id
              ? "https://www.youtube.com/embed/" + encodeURIComponent(id)
              : null;
          }
          if (host === "youtu.be") {
            var pathId = parsed.pathname.replace(/^\//, "");
            return pathId
              ? "https://www.youtube.com/embed/" + encodeURIComponent(pathId)
              : null;
          }
          if (host === "vimeo.com") {
            var vimeoId = parsed.pathname.replace(/^\//, "");
            return vimeoId
              ? "https://player.vimeo.com/video/" + encodeURIComponent(vimeoId)
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
            direction < 0 ? "Сдвиг вверх" : "Сдвиг вниз"
          )
        )
          return;
        if (
          !guardProtectedSelection(direction < 0 ? "Сдвиг вверх" : "Сдвиг вниз")
        )
          return;
        sendToBridge("move-element", {
          nodeId: state.selectedNodeId,
          direction: direction,
        });
      }

      function isLayerManagedNode(node) {
        return Boolean(
          node instanceof Element &&
            node.hasAttribute("data-editor-node-id") &&
            !node.hasAttribute("data-editor-slide-id") &&
            node.getAttribute("data-editor-policy-kind") !== "protected"
        );
      }

      function getActiveSlideModelElement() {
        if (!state.modelDoc || !state.activeSlideId) return null;
        return state.modelDoc.querySelector(
          "[data-editor-slide-id=\"" + cssEscape(state.activeSlideId) + "\"]"
        );
      }

      function getLayerScopeInfo() {
        var slideEl = getActiveSlideModelElement();
        if (!slideEl) return null;
        var selectedNode = getSelectedModelNode();
        var scopeRoot = slideEl;
        if (
          selectedNode instanceof Element &&
          selectedNode.parentElement &&
          selectedNode.closest("[data-editor-slide-id=\"" + cssEscape(state.activeSlideId) + "\"]") ===
            slideEl
        ) {
          var siblingNodes = Array.from(selectedNode.parentElement.children).filter(
            function (node) { return isLayerManagedNode(node); }
          );
          if (siblingNodes.includes(selectedNode)) {
            scopeRoot = selectedNode.parentElement;
          }
        }
        var nodes = Array.from(scopeRoot.children).filter(function (node) {
          return isLayerManagedNode(node);
        });
        return {
          slideEl: slideEl,
          scopeRoot: scopeRoot,
          nodes: nodes,
          selectedNode: selectedNode,
        };
      }

      function buildLayerVisualOrder(nodes) {
        return nodes.slice().sort(compareVisualStackOrder);
      }

      function applyLayerVisualOrder(orderedNodes, reason, options) {
        options = options || {};
        if (!orderedNodes.length) return false;
        orderedNodes.forEach(function (node, index) {
          var nodeId = String(node.getAttribute("data-editor-node-id") || "").trim();
          if (!nodeId) return;
          var nextZ = String((index + 1) * 10);
          node.style.zIndex = nextZ;
          sendToBridge("apply-style", {
            nodeId: nodeId,
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
              ? state.selectionPath.map(function (entry) { return entry && entry.nodeId; })
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
        var scope = getLayerScopeInfo();
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
        var scope = getLayerScopeInfo();
        if (!scope || scope.nodes.length < 2) {
          showToast("Для выбранного scope нет соседних слоёв.", "info", {
            title: "Слои",
          });
          return false;
        }
        var ordered = buildLayerVisualOrder(scope.nodes);
        var currentIndex = ordered.findIndex(
          function (node) {
            return node.getAttribute("data-editor-node-id") === state.selectedNodeId;
          }
        );
        if (currentIndex < 0) return false;
        var targetIndex = currentIndex;
        var blockedMessage = "Перемещение недоступно.";
        var successMessage = "Порядок слоёв обновлён.";
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
        var nextOrder = ordered.slice();
        var moved = nextOrder.splice(currentIndex, 1);
        nextOrder.splice(targetIndex, 0, moved[0]);
        return applyLayerVisualOrder(
          nextOrder,
          "layer-order:" + action + ":" + state.selectedNodeId,
          { toastMessage: successMessage }
        );
      }

      function extractImageFromClipboardEvent(event) {
        var items = Array.from(event.clipboardData && event.clipboardData.items || []);
        var imageItem = items.find(
          function (item) { return item.kind === "file" && item.type.startsWith("image/"); }
        );
        return imageItem ? imageItem.getAsFile() : null;
      }

      /* ======================================================================
       shell routing + responsive shell state
       ====================================================================== */

      function setPreviewLoading(active, text) {
        text = text || "Подготовка превью…";
        state.loadingPreview = Boolean(active);
        if (els.previewLoadingText) els.previewLoadingText.textContent = text;
        if (els.previewLoading) {
          els.previewLoading.classList.toggle("is-visible", Boolean(active));
          els.previewLoading.setAttribute(
            "aria-hidden",
            active ? "false" : "true"
          );
        }
      }

      function setStatusMessage(element, message, type, options) {
        type = type || "info";
        options = options || {};
        if (!(element instanceof HTMLElement)) return;
        var text = String(message || "").trim();
        var visible = Boolean(text) || options.keepVisible === true;
        element.hidden = !visible;
        element.className = "modal-status is-" + type;
        element.textContent = text;
        if (visible) element.dataset.statusKind = type;
        else delete element.dataset.statusKind;
      }

      function clearOpenHtmlStatus() {
        setStatusMessage(els.openHtmlStatus, "", "info");
      }

      function setOpenHtmlStatus(message, type) {
        type = type || "warning";
        setStatusMessage(els.openHtmlStatus, message, type);
      }

      function resetHtmlEditorStatus() {
        setStatusMessage(
          els.htmlEditorStatus,
          statusDefaults.htmlEditor,
          "info",
          { keepVisible: true }
        );
      }

      function setHtmlEditorStatus(message, type) {
        type = type || "info";
        setStatusMessage(els.htmlEditorStatus, message, type, {
          keepVisible: true,
        });
      }

      function clearVideoInsertStatus() {
        setStatusMessage(els.videoInsertStatus, "", "info");
      }

      function setVideoInsertStatus(message, type) {
        type = type || "warning";
        setStatusMessage(els.videoInsertStatus, message, type);
      }

      async function copyTextWithShellFeedback(text, options) {
        options = options || {};
        var value = String(text || "");
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
            }
          );
          return false;
        }
      }

      // =====================================================================

// CommonJS export for Node test runner — no-op in browser contexts.
// Allows `const { fnv1a32, createDomPatch, ... } = require('./history.js')` in tests.
// Only the pure patch-engine functions are exported; browser-DOM code is excluded.
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    fnv1a32: fnv1a32,
    createDomPatch: createDomPatch,
    getHistoryClientId: function () { return HISTORY_CLIENT_ID; },
  };
}
