// layers-panel.js
// Layer: Domain Logic (Advanced Mode)
// Layers panel rendering, drag-drop, lock/visibility, grouping (v0.18.0)
// Extracted from selection.js in v0.29.2 per PAIN-MAP P1-06.

      if (typeof renderSelectionOverlay !== 'function') {
        throw new Error('selection.js must load before layers-panel.js');
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

      // [v1.1.3 / ADR-031] Dual-render placement for the layers list.
      //
      // When featureFlags.layersStandalone is true, move #layersListContainer
      // out of #layersInspectorSection and into the shell-level #layersRegion.
      // When false (default), restore it to its original inspector home.
      //
      // The list is a single DOM node — we move it rather than duplicate so
      // that existing references (els.layersListContainer, event bindings,
      // render targets) stay valid. Host visibility is managed by renderLayersPanel.
      function ensureLayersContainerPlacement() {
        var container = els.layersListContainer;
        if (!container) return;
        var standalone = Boolean(
          typeof window !== "undefined" &&
            window.featureFlags &&
            window.featureFlags.layersStandalone,
        );
        var region = els.layersRegion;
        var regionBody = region?.querySelector(".layers-region-body") || region;
        var inspectorHost = els.layersInspectorSection;
        var target = standalone ? regionBody : inspectorHost;
        if (!target) return;
        if (container.parentElement !== target) {
          target.appendChild(container);
        }
      }
      window.ensureLayersContainerPlacement = ensureLayersContainerPlacement;

      // [v1.1.3] Resolve the current host (region or inspector section) for
      // visibility toggles inside renderLayersPanel(). The flag decides where
      // the list lives; renderLayersPanel hides/shows that host, not the
      // other one.
      function getActiveLayersHost() {
        var standalone = Boolean(
          typeof window !== "undefined" &&
            window.featureFlags &&
            window.featureFlags.layersStandalone,
        );
        if (standalone && els.layersRegion) return els.layersRegion;
        return els.layersInspectorSection || null;
      }

      // [v1.1.3] Hide the host that does NOT own the list right now, so stale
      // `hidden` state on the alternate host can't leak (e.g. after a runtime
      // flag flip). The owning host's visibility is set by the caller.
      function syncInactiveLayersHost() {
        var standalone = Boolean(
          typeof window !== "undefined" &&
            window.featureFlags &&
            window.featureFlags.layersStandalone,
        );
        if (standalone && els.layersInspectorSection) {
          els.layersInspectorSection.hidden = true;
        } else if (!standalone && els.layersRegion) {
          els.layersRegion.hidden = true;
        }
      }

      function renderLayersPanel() {
        ensureLayersContainerPlacement();
        syncInactiveLayersHost();
        var activeHost = getActiveLayersHost();
        if (!els.layersListContainer || !activeHost) return;
        var standalone = Boolean(
          window.featureFlags && window.featureFlags.layersStandalone,
        );
        // [V2-01] Layers panel visible in basic mode only when standalone host
        // is active (shell region). Inspector-nested section stays advanced-only.
        if (!standalone && state.complexityMode !== "advanced") {
          activeHost.hidden = true;
          if (els.normalizeLayersBtn) els.normalizeLayersBtn.disabled = true;
          return;
        }
        if (!state.activeSlideId || !state.modelDoc) {
          activeHost.hidden = true;
          if (els.normalizeLayersBtn) els.normalizeLayersBtn.disabled = true;
          return;
        }
        const slideEl = state.modelDoc.querySelector(`[data-editor-slide-id="${cssEscape(state.activeSlideId)}"]`);
        if (!slideEl) {
          activeHost.hidden = true;
          if (els.normalizeLayersBtn) els.normalizeLayersBtn.disabled = true;
          return;
        }
        const allLayers = Array.from(slideEl.querySelectorAll("[data-editor-node-id]")).filter(el => {
          return el.closest("[data-editor-slide-id]") === slideEl &&
                 el.getAttribute("data-editor-entity-kind") !== "slide-root" &&
                 el.getAttribute("data-editor-policy-kind") !== "protected";
        });
        if (!allLayers.length) {
          activeHost.hidden = true;
          if (els.normalizeLayersBtn) els.normalizeLayersBtn.disabled = true;
          return;
        }
        activeHost.hidden = false;
        const sortedLayers = allLayers.sort((a, b) => compareVisualStackOrder(b, a));
        const currentScope = getLayerScopeInfo();
        if (els.normalizeLayersBtn) {
          els.normalizeLayersBtn.disabled = !currentScope || currentScope.nodes.length < 2;
        }
        // [v1.1.4 / V2-01] In basic mode the layers list still renders (for
        // selection + visibility), but advanced-only row controls (z-index,
        // lock) stay hidden to keep the basic surface quiet.
        const showAdvancedControls = state.complexityMode === "advanced";
        // [v1.1.5 / ADR-034] Tree view: when featureFlags.treeLayers is true,
        // render a <details>-based hierarchy following DOM parent chains. Each
        // sibling group is sorted by z-order to keep the stacking intuition.
        const treeMode = Boolean(window.featureFlags && window.featureFlags.treeLayers);
        const renderContext = { showAdvancedControls, sortedLayers };
        let html;
        if (treeMode) {
          const tree = buildLayerTree(sortedLayers, slideEl);
          html = renderLayerTreeNodes(tree, 0, renderContext);
          els.layersListContainer.classList.add("is-tree-mode");
        } else {
          html = sortedLayers
            .map((layer, index) => buildLayerRowHtml(layer, index, renderContext))
            .join("");
          els.layersListContainer.classList.remove("is-tree-mode");
        }
        els.layersListContainer.innerHTML = html;
        bindLayersPanelActions();
      }

      // [v1.1.5] Single-row HTML shared by both flat and tree rendering paths.
      // The optional `depth` param is used only for tree mode to add a class
      // for indentation styling. `ctx.sortedLayers` is the full z-sorted list,
      // used to compute the stack-position hint.
      function buildLayerRowHtml(layer, index, ctx, options) {
        const depth = options && typeof options.depth === "number" ? options.depth : 0;
        const renderAsSummary = Boolean(options && options.renderAsSummary);
        const { showAdvancedControls, sortedLayers } = ctx;
        const nodeId = layer.getAttribute("data-editor-node-id") || "";
        const entityKind = layer.getAttribute("data-editor-entity-kind") || "element";
        const isLocked = layer.getAttribute("data-editor-locked") === "true";
        const isHidden = isLayerSessionHidden(nodeId);
        const zIndex = layer.style.zIndex || "auto";
        const label = escapeHtml(getLayerLabel(layer));
        const isActive = nodeId === state.selectedNodeId;
        const stackHint = `${getEntityKindLabel(entityKind)} · ${formatLayerStackHint(
          index,
          sortedLayers.length,
        )}`;
        const chips = [];
        if (isActive) chips.push({ label: "Текущий", className: "is-current" });
        if (isHidden) chips.push({ label: "Скрыт", className: "is-hidden" });
        if (isLocked && showAdvancedControls) {
          chips.push({ label: "Заблокирован", className: "is-locked" });
        }
        const zControl = isActive && showAdvancedControls
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
        const dragHandleHtml = showAdvancedControls
          ? `
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
          `
          : "";
        const lockButtonHtml = showAdvancedControls
          ? `
            <button
              type="button"
              class="layer-action-btn layer-lock-btn ${isLocked ? "is-locked" : ""}"
              data-layer-node-id="${escapeHtml(nodeId)}"
              aria-label="${isLocked ? "Разблокировать слой" : "Заблокировать слой"}"
              title="${isLocked ? "Разблокировать слой" : "Заблокировать слой"}"
            >
              ${isLocked ? "🔒" : "🔓"}
            </button>
          `
          : "";
        const tag = renderAsSummary ? "summary" : "div";
        const depthStyle = depth > 0 ? ` style="--layer-depth:${depth};"` : "";
        return `
          <${tag}
            class="layer-row ${isActive ? "is-active" : ""}"
            data-layer-node-id="${escapeHtml(nodeId)}"
            data-layer-index="${index}"
            data-layer-depth="${depth}"
            tabindex="0"
            aria-current="${isActive ? "true" : "false"}"${depthStyle}
          >
            ${dragHandleHtml}
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
                ${lockButtonHtml}
              </div>
            </div>
          </${tag}>
        `;
      }

      // [v1.1.5 / ADR-034] Build a parent-child tree from the flat sorted list
      // by walking each element's DOM parent chain until we hit another
      // element present in the same set. Elements with no such ancestor are
      // tree roots. Sibling order follows the z-sorted input order.
      function buildLayerTree(sortedLayers, slideEl) {
        const entries = sortedLayers.map((el, index) => ({
          el,
          nodeId: el.getAttribute("data-editor-node-id") || "",
          index,
          children: [],
        }));
        const byNodeId = new Map(entries.map((e) => [e.nodeId, e]));
        const roots = [];
        for (const entry of entries) {
          let parent = entry.el.parentElement;
          let parentEntry = null;
          while (parent && parent !== slideEl) {
            const parentId = parent.getAttribute("data-editor-node-id");
            if (parentId && byNodeId.has(parentId)) {
              parentEntry = byNodeId.get(parentId);
              break;
            }
            parent = parent.parentElement;
          }
          if (parentEntry) parentEntry.children.push(entry);
          else roots.push(entry);
        }
        return roots;
      }

      // [v1.1.5 / ADR-034] Recursive render of the tree. Nodes with children
      // render as <details><summary>row</summary>...children...</details>; leaf
      // nodes render as plain row div so focus and click bindings stay uniform.
      function renderLayerTreeNodes(nodes, depth, ctx) {
        return nodes
          .map((entry) => {
            if (!entry.children.length) {
              return buildLayerRowHtml(entry.el, entry.index, ctx, { depth });
            }
            const summaryHtml = buildLayerRowHtml(entry.el, entry.index, ctx, {
              depth,
              renderAsSummary: true,
            });
            const childrenHtml = renderLayerTreeNodes(entry.children, depth + 1, ctx);
            return `
              <details class="layer-tree-node" open data-layer-tree-depth="${depth}">
                ${summaryHtml}
                <div class="layer-tree-children">${childrenHtml}</div>
              </details>
            `;
          })
          .join("");
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
