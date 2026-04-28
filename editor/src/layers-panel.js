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
        if (state.complexityMode !== "advanced") return;
        const node = findModelNode(nodeId);
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

      // [v1.1.6 / ADR-034] Set user-authored layer name (data-layer-name).
      // Empty string clears the attr → getLayerLabel falls back to the auto
      // derivation (tag + author id / class / text preview).
      function renameLayerNode(nodeId, rawName) {
        const node = findModelNode(nodeId);
        if (!node) return;
        const nextName = String(rawName || "").trim();
        const prev = node.getAttribute("data-layer-name") || "";
        if (nextName === prev) return;
        if (nextName) {
          node.setAttribute("data-layer-name", nextName);
        } else {
          node.removeAttribute("data-layer-name");
        }
        recordHistoryChange(`rename-layer:${nodeId}`);
        sendToBridge("update-attributes", {
          nodeId,
          attrs: nextName ? { "data-layer-name": nextName } : { "data-layer-name": null },
        });
        renderLayersPanel();
        updateInspectorFromSelection();
      }
      window.renameLayerNode = renameLayerNode;

      // [v1.1.6] Swap `.layer-label` span for an <input>, commit on Enter/blur,
      // cancel on Escape. Sets state.layerRenameActive so renderLayersPanel
      // can skip re-renders that would detach the input mid-edit.
      function startInlineLayerRename(labelEl, nodeId) {
        if (!(labelEl instanceof HTMLElement) || !nodeId) return;
        if (labelEl.querySelector(".layer-label-input")) return; // already editing
        const currentText = labelEl.textContent || "";
        state.layerRenameActive = nodeId;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "layer-label-input";
        input.value = currentText;
        input.setAttribute("aria-label", "Новое имя слоя");
        input.maxLength = 60;
        let committed = false;
        const finish = (shouldCommit) => {
          if (committed) return;
          committed = true;
          state.layerRenameActive = null;
          if (shouldCommit) {
            renameLayerNode(nodeId, input.value);
          } else {
            labelEl.textContent = currentText;
          }
        };
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finish(true);
          } else if (event.key === "Escape") {
            event.preventDefault();
            finish(false);
          }
        });
        input.addEventListener("blur", () => finish(true));
        labelEl.textContent = "";
        labelEl.appendChild(input);
        input.focus();
        input.select();
      }
      window.startInlineLayerRename = startInlineLayerRename;

      // [v1.1.6] Open the layer-row context menu at given coordinates. Selects
      // the row first so the main inspector + floating toolbar follow.
      function openLayerRowContextMenu({ nodeId, clientX, clientY }) {
        if (!nodeId || !els.contextMenu) return;
        closeShellPanels?.({ keep: "context-menu" });
        closeTransientShellUi?.({ keep: "context-menu" });
        sendToBridge("select-element", { nodeId });
        const payload = {
          menuScope: "layer-row",
          nodeId,
          slideId: state.activeSlideId,
          origin: "layers-panel",
          shellClientX: clientX,
          shellClientY: clientY,
        };
        state.contextMenuNodeId = nodeId;
        state.contextMenuPayload = payload;
        renderContextMenu(payload);
        positionContextMenu(clientX, clientY);
        els.contextMenu.classList.add("is-open");
        els.contextMenu.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() =>
          getContextMenuButtons?.()[0]?.focus({ preventScroll: true }),
        );
      }
      window.openLayerRowContextMenu = openLayerRowContextMenu;

      // [v1.1.6] Reorder a layer within its current slide's z-order list.
      // direction = "forward" (render on top — moves later in DOM; in our
      // z-sorted render it moves up in the list) or "backward".
      function moveLayerInStack(nodeId, direction) {
        if (!nodeId || !state.modelDoc) return;
        const rows = Array.from(
          els.layersListContainer?.querySelectorAll(".layer-row[data-layer-node-id]") || [],
        );
        const fromIndex = rows.findIndex(
          (row) => row.getAttribute("data-layer-node-id") === nodeId,
        );
        if (fromIndex < 0) return;
        const toIndex = direction === "forward" ? fromIndex - 1 : fromIndex + 1;
        if (toIndex < 0 || toIndex >= rows.length) return;
        reorderLayers(fromIndex, toIndex);
      }
      window.moveLayerInStack = moveLayerInStack;

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
        if (!state.modelDoc) return;
        // [v1.3.4] Gate by mode OR multiSelect flag (Phase D4 keyboard parity).
        var multiSelectFlag = Boolean(window.featureFlags && window.featureFlags.multiSelect);
        if (state.complexityMode !== "advanced" && !multiSelectFlag) return;
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
          .map((nodeId) => findModelNode(nodeId))
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
        // [v1.1.6] User-authored data-layer-name takes precedence over any
        // auto-generated label. Preserved on export by the regular
        // clean-export path (data-editor-* is stripped, but data-layer-name
        // is a user-facing attribute — see exportStripList override in B5 code).
        const userName = (el.getAttribute("data-layer-name") || "").trim();
        if (userName) return userName;
        const entityKind = el.getAttribute("data-editor-entity-kind") || "element";
        const tagName = el.tagName.toLowerCase();
        // Text + headings lead with the actual content — the user sees what
        // the layer says rather than decoding `div.card-dark`.
        const rawText = (el.textContent || "").replace(/\s+/g, " ").trim();
        const textPreview = rawText.slice(0, 40);
        if (entityKind === "text" && textPreview) return `"${textPreview}"`;
        if (/^h[1-6]$/i.test(tagName) && textPreview) return `${tagName.toUpperCase()} "${textPreview}"`;
        // [v2.1.0-rc.4 / ADR-031, expert-feedback P1] Human label FIRST.
        // Was: returned tagName.className ("div.card-dark") as primary, with
        // entity-kind buried in the meta line. Per expert review, novice
        // users don't decode HTML class names — they see "Карточка". The
        // technical tagName.className now lives in .layer-meta (stackHint).
        if (typeof getEntityKindLabel === "function") {
          const kindLabel = getEntityKindLabel(entityKind);
          if (kindLabel && kindLabel !== entityKind && kindLabel !== "—") {
            return kindLabel;
          }
        }
        // Final fallbacks: technical naming when no entity-kind labelled.
        const authorId = el.getAttribute("data-node-id") || "";
        if (authorId) return `${tagName} · #${authorId}`;
        if (el.id) return `${tagName}#${el.id}`;
        const className = (el.className || "")
          .toString()
          .split(/\s+/)
          .filter((c) => c && !c.startsWith("editor-"))[0];
        if (className) return `${tagName}.${className}`;
        return `${tagName} · ${nodeId.slice(0, 6)}`;
      }

      // [v2.1.0-rc.4 / ADR-031, expert-feedback P1] Build the secondary
      // (meta) line: technical detail (tagName.className) + stack position.
      // Renders below the human label in .layer-meta.
      function getLayerTechHint(el) {
        const tagName = el.tagName.toLowerCase();
        const className = (el.className || "")
          .toString()
          .split(/\s+/)
          .filter((c) => c && !c.startsWith("editor-"))[0];
        if (className) return `${tagName}.${className}`;
        if (el.id) return `${tagName}#${el.id}`;
        return tagName;
      }

      // [v2.1.0-rc.5 / ADR-031, expert-feedback P1] Type glyph rendered
      // before the layer label. Lets the user scan a long layer tree and
      // identify text/image/video/container at a glance without reading
      // the label text. Glyphs chosen to match the editor's existing
      // entity-kind iconography (insert palette uses similar marks).
      function getLayerTypeGlyph(entityKind, tagName) {
        if (entityKind === "text") return "T";
        if (entityKind === "image") return "🖼";
        if (entityKind === "video") return "🎬";
        if (entityKind === "table") return "▦";
        if (entityKind === "table-cell") return "▦";
        if (entityKind === "code-block") return "{ }";
        if (entityKind === "svg") return "✦";
        if (entityKind === "fragment") return "✱";
        if (entityKind === "slide-root") return "▢";
        if (entityKind === "protected") return "🔒";
        if (entityKind === "container") return "▣";
        if (/^h[1-6]$/i.test(tagName)) return "H";
        return "▢";
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
        const modelNode = findModelNode(nodeId);
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
        // [v1.1.6] Skip re-render while inline rename input is active; the
        // input lives inside an element that would be destroyed by innerHTML.
        if (state.layerRenameActive) return;
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
        const slideEl = findModelSlide(state.activeSlideId);
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
        const label = escapeHtml(getLayerLabel(layer));
        const isActive = nodeId === state.selectedNodeId;
        // [v2.1.0-rc.4 / ADR-031, expert-feedback P1] Meta line shows
        // tagName.className (technical detail) + stack position. Was just
        // entity-kind label (now promoted to the primary .layer-label) +
        // position. Pattern: "div.card-dark · слой 2 из 19".
        const techHint = getLayerTechHint(layer);
        const stackHint = `${techHint} · ${formatLayerStackHint(
          index,
          sortedLayers.length,
        )}`;
        // [v2.1.0-rc.5 / ADR-031, expert-feedback P1] Type glyph for at-a-
        // glance scanning of long layer trees.
        const typeGlyph = getLayerTypeGlyph(entityKind, layer.tagName);
        // [v2.0.6] Row chips carry STATE, not selection.
        // - "Текущий" removed: the .is-active row highlight + aria-current
        //   already communicate "this is the selected layer" both visually
        //   and to assistive tech. A dedicated chip was pure noise.
        // - "Скрыт" / "Заблокирован" kept: those are state the eye/lock
        //   icons toggle, and the chip reinforces WHY that state exists
        //   when the user scans a long list.
        const chips = [];
        if (isHidden) chips.push({ label: "Скрыт", className: "is-hidden" });
        if (isLocked && showAdvancedControls) {
          chips.push({ label: "Заблокирован", className: "is-locked" });
        }
        // [v2.0.6] Inline "z: auto" text input removed.
        // It was redundant with three existing paths to the same capability:
        //   1. Inspector → Layout → z-index (precise edit, every element)
        //   2. Ctrl+Shift+↑/↓ (bring-to-front / send-to-back shortcuts)
        //   3. "Упорядочить стек" button in inspector (normalize whole slide)
        // The field also displayed "auto" for 99% of elements (elements
        // without explicit z-index), which read as meaningless clutter.
        // Drag-and-drop reorder via the leading grip handle remains
        // unchanged; that is the visual-first path to reorder a layer.
        // [v1.2.1] Prefer SVG icons when enabled; fall back to emoji otherwise.
        const iconOf = typeof window.iconMarkup === "function" ? window.iconMarkup : null;
        const gripIcon = iconOf ? iconOf("grip-vertical", "⋮⋮") : "⋮⋮";
        const lockIcon = iconOf
          ? iconOf(isLocked ? "lock" : "unlock", isLocked ? "🔒" : "🔓")
          : isLocked ? "🔒" : "🔓";
        const eyeIcon = iconOf ? iconOf(isHidden ? "eye-off" : "eye", "👁") : "👁";
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
              ${gripIcon}
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
              ${lockIcon}
            </button>
          `
          : "";
        const tag = renderAsSummary ? "summary" : "div";
        const depthStyle = depth > 0 ? ` style="--layer-depth:${depth};"` : "";
        // [v2.0.16 / A11Y-001] When the row is rendered as <summary>, the
        // visibility/lock buttons MUST live outside the summary element to
        // avoid the nested-interactive WCAG violation (<summary> is
        // implicitly interactive). renderLayerTreeNodes appends a sibling
        // .layer-row-actions-detached node after the <summary>; CSS uses
        // grid to keep it visually inline with the summary content.
        const actionsHtml = `
              <div class="layer-row-actions${renderAsSummary ? " is-detached" : ""}">
                <button
                  type="button"
                  class="layer-action-btn layer-visibility-btn ${isHidden ? "is-hidden" : ""}"
                  data-layer-node-id="${escapeHtml(nodeId)}"
                  aria-label="${isHidden ? "Показать слой" : "Скрыть слой"}"
                  title="${isHidden ? "Показать слой" : "Скрыть слой"}"
                >
                  ${eyeIcon}
                </button>
                ${lockButtonHtml}
              </div>
        `;
        const trailingHtml = renderAsSummary
          ? `
            <div class="layer-trailing">
              <div class="layer-status-list">${buildLayerStatusChipsHtml(chips)}</div>
            </div>`
          : `
            <div class="layer-trailing">
              <div class="layer-status-list">${buildLayerStatusChipsHtml(chips)}</div>
              ${actionsHtml}
            </div>`;
        const rowHtml = `
          <${tag}
            class="layer-row ${isActive ? "is-active" : ""}"
            data-layer-node-id="${escapeHtml(nodeId)}"
            data-layer-index="${index}"
            data-layer-depth="${depth}"
            tabindex="0"
            aria-current="${isActive ? "true" : "false"}"${depthStyle}
          >
            ${dragHandleHtml}
            <span class="layer-type-glyph" aria-hidden="true">${escapeHtml(typeGlyph)}</span>
            <div class="layer-main">
              <span class="layer-label">${label}</span>
              <span class="layer-meta">${escapeHtml(stackHint)}</span>
            </div>
            ${trailingHtml}
          </${tag}>
        `;
        // For summary-mode parents, the actions <div> is appended after the
        // <summary> by renderLayerTreeNodes via a HTML-string concatenation.
        // The renderer slices the row + actions on the
        // -LAYER-ACTIONS- sentinel below.
        if (renderAsSummary) {
          return { rowHtml: rowHtml, actionsHtml: actionsHtml };
        }
        return rowHtml;
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
      // [v1.1.6] Open/closed state is preserved across renders via
      // state.layerTreeCollapsed — a Set of nodeIds the user explicitly closed.
      function renderLayerTreeNodes(nodes, depth, ctx) {
        return nodes
          .map((entry) => {
            if (!entry.children.length) {
              return buildLayerRowHtml(entry.el, entry.index, ctx, { depth });
            }
            const summaryParts = buildLayerRowHtml(entry.el, entry.index, ctx, {
              depth,
              renderAsSummary: true,
            });
            const childrenHtml = renderLayerTreeNodes(entry.children, depth + 1, ctx);
            const collapsed = Boolean(
              state.layerTreeCollapsed &&
                entry.nodeId &&
                state.layerTreeCollapsed.has(entry.nodeId),
            );
            // [v2.0.16 / A11Y-001] Actions HTML is now placed as a SIBLING
            // of <summary> inside <details>. Because it's not nested under
            // the implicitly-interactive <summary>, axe no longer flags
            // nested-interactive. CSS positions .layer-row-actions.is-detached
            // absolutely over the summary's right edge to keep the visual.
            return `
              <details class="layer-tree-node" ${collapsed ? "" : "open"} data-layer-tree-depth="${depth}" data-layer-tree-nodeid="${escapeHtml(entry.nodeId)}">
                ${summaryParts.rowHtml}
                ${summaryParts.actionsHtml}
                <div class="layer-tree-children">${childrenHtml}</div>
              </details>
            `;
          })
          .join("");
      }

      // [v1.1.6] Delegated listeners on the container — survive innerHTML
      // wipes from re-renders. Bound once per container lifetime.
      function bindDelegatedLayerListeners() {
        if (!els.layersListContainer) return;
        if (els.layersListContainer.dataset.delegatedBound === "true") return;
        els.layersListContainer.dataset.delegatedBound = "true";
        // Track explicit user collapse across re-renders.
        if (!(state.layerTreeCollapsed instanceof Set)) {
          state.layerTreeCollapsed = new Set();
        }
        // `<details>` fires a native "toggle" event when open changes. Capture
        // the resulting state so the next render preserves it.
        els.layersListContainer.addEventListener("toggle", (event) => {
          const details = event.target;
          if (!(details instanceof HTMLDetailsElement)) return;
          const nodeId = details.getAttribute("data-layer-tree-nodeid");
          if (!nodeId) return;
          if (details.open) state.layerTreeCollapsed.delete(nodeId);
          else state.layerTreeCollapsed.add(nodeId);
        }, true);
        els.layersListContainer.addEventListener("dblclick", (event) => {
          const label = event.target.closest(".layer-label");
          if (!label) return;
          const row = label.closest(".layer-row[data-layer-node-id]");
          if (!row || !els.layersListContainer.contains(row)) return;
          event.preventDefault();
          event.stopPropagation();
          const nodeId = row.getAttribute("data-layer-node-id");
          if (nodeId) startInlineLayerRename(label, nodeId);
        });
        els.layersListContainer.addEventListener("contextmenu", (event) => {
          const row = event.target.closest(".layer-row[data-layer-node-id]");
          if (!row) return;
          event.preventDefault();
          event.stopPropagation();
          const nodeId = row.getAttribute("data-layer-node-id");
          if (!nodeId) return;
          if (typeof window.openLayerRowContextMenu === "function") {
            window.openLayerRowContextMenu({
              nodeId,
              clientX: event.clientX,
              clientY: event.clientY,
            });
          }
        });
        // Delegated keydown for F2 (works even when row re-rendered after focus).
        els.layersListContainer.addEventListener("keydown", (event) => {
          if (event.key !== "F2") return;
          const row = event.target.closest(".layer-row[data-layer-node-id]");
          if (!row) return;
          event.preventDefault();
          const label = row.querySelector(".layer-label");
          const nodeId = row.getAttribute("data-layer-node-id");
          if (label && nodeId) startInlineLayerRename(label, nodeId);
        });
      }

      function bindLayersPanelActions() {
        if (!els.layersListContainer) return;
        bindDelegatedLayerListeners();
        const rows = Array.from(
          els.layersListContainer.querySelectorAll(".layer-row[data-layer-node-id]"),
        );
        const focusRowByIndex = (index) => {
          if (!rows.length) return;
          const nextIndex = Math.max(0, Math.min(rows.length - 1, index));
          rows[nextIndex].focus({ preventScroll: true });
        };
        rows.forEach((row) => {
          const rowIsSummary = row.tagName === "SUMMARY";
          row.addEventListener("click", (e) => {
            if (
              e.target.closest(".layer-action-btn") ||
              e.target.closest(".layer-drag-handle") ||
              e.target.closest(".layer-label-input")
            ) {
              return;
            }
            // [v1.1.6] When the row is a <summary> (tree-mode parent node),
            // clicking on label/body should NOT toggle <details> — that would
            // block the dblclick-rename gesture and expand/collapse on every
            // select. Preserve toggle via the disclosure arrow area only.
            if (rowIsSummary && e.target.closest(".layer-label, .layer-main, .layer-trailing")) {
              e.preventDefault();
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
        // [v2.0.6] Inline z-input removed; no per-row z-index handler remains.
        // z-index editing routes exclusively through:
        //   - #zIndexInput in the inspector "Расположение" section
        //   - Ctrl+Shift+Arrow shortcuts (bring/send)
        //   - Drag-and-drop reorder via .layer-drag-handle
      }

      function groupSelectedElements() {
        if (!state.multiSelectNodeIds.length || !state.modelDoc || !state.activeSlideId) return;
        // [v1.3.4] Gate by mode OR multiSelect flag (Phase D4 keyboard parity).
        var multiSelectFlag = Boolean(window.featureFlags && window.featureFlags.multiSelect);
        if (state.complexityMode !== "advanced" && !multiSelectFlag) return;
        const slideEl = findModelSlide(state.activeSlideId);
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
        if (!state.selectedNodeId || !state.modelDoc) return;
        // [v1.3.4] Gate by mode OR multiSelect flag (Phase D4 keyboard parity).
        var multiSelectFlag = Boolean(window.featureFlags && window.featureFlags.multiSelect);
        if (state.complexityMode !== "advanced" && !multiSelectFlag) return;
        const groupNode = findModelNode(state.selectedNodeId);
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
