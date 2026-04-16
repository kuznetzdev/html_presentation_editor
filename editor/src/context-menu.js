      // ZONE: Context Menu
      // Dynamic right-click menu: buildContextMenuItems, renderContextMenu, handleContextMenuAction
      // =====================================================================
      // buildContextMenuItems
      // Меню строится динамически под текущий тип элемента: текст, картинка,
      // video/iframe, контейнер. Это уменьшает шум и делает меню «человечным».
      function buildContextMenuItems(payload) {
        if (payload?.menuScope === "slide-rail") {
          const slideIndex = Number(payload.slideIndex);
          const slideCount = Number(payload.slideCount || state.slides.length || 0);
          const items = [
            {
              section: "structure",
              action: "slide-duplicate",
              icon: "⧉",
              label: "Дублировать слайд",
              hint: "",
            },
          ];
          if (slideIndex > 0) {
            items.push({
              section: "structure",
              action: "slide-move-top",
              icon: "⇡",
              label: "Переместить в начало",
              hint: "",
            });
            items.push({
              section: "structure",
              action: "slide-move-up",
              icon: "↑",
              label: "Поднять выше",
              hint: "",
            });
          }
          if (slideIndex >= 0 && slideIndex < slideCount - 1) {
            items.push({
              section: "structure",
              action: "slide-move-down",
              icon: "↓",
              label: "Опустить ниже",
              hint: "",
            });
            items.push({
              section: "structure",
              action: "slide-move-bottom",
              icon: "⇣",
              label: "Переместить в конец",
              hint: "",
            });
          }
          items.push({
            section: "remove",
            action: "slide-delete",
            icon: "✕",
            label: "Удалить слайд",
            hint: "",
            danger: true,
          });
          return items;
        }
        const items = [];
        const entityKind = getEntityKindFromPayload({
          ...state.selectedFlags,
          ...payload,
        });
        const isText = entityKind === "text";
        const isCodeBlock = entityKind === "code-block";
        const isImage = entityKind === "image";
        const isContainer = entityKind === "container";
        const isSlideRoot = entityKind === "slide-root";
        const isProtected = entityKind === "protected";
        const isVideo = entityKind === "video";
        const isTableCell = entityKind === "table-cell";
        const isAdvanced = state.complexityMode === "advanced";
        const policy = normalizeSelectionPolicy(
          payload.protectionPolicy || state.selectedPolicy,
          {
            canEditText: isText || isTableCell || isCodeBlock,
            isImage,
            isVideo,
            isContainer,
            isSlideRoot,
            isProtected,
          },
        );

        if (isAdvanced && (policy.canEditHtml || policy.canEditSlideHtml)) {
          items.push({
            section: "format",
            action: isSlideRoot ? "edit-slide-html" : "edit-html",
            icon: "🧩",
            label: isSlideRoot ? "HTML слайда" : "Редактировать HTML",
            hint: "",
          });
        }
        if (isText) {
          items.push({
            section: "format",
            action: "edit-text",
            icon: "✏️",
            label: "Редактировать текст",
            hint: "Double click",
          });
          if (isAdvanced) {
            items.push({
              section: "format",
              action: "copy-text",
              icon: "📄",
              label: "Копировать текст",
              hint: "",
            });
            items.push({
              section: "format",
              action: "cut-text",
              icon: "✂️",
              label: "Вырезать текст",
              hint: "",
            });
            items.push({
              section: "format",
              action: "paste-as-text",
              icon: "📋",
              label: "Вставить как текст",
              hint: "",
            });
            items.push({
              section: "format",
              action: "to-h2",
              icon: "H2",
              label: "Преобразовать в H2",
              hint: "",
            });
            items.push({
              section: "format",
              action: "to-h3",
              icon: "H3",
              label: "Преобразовать в H3",
              hint: "",
            });
          }
        }
        if (isCodeBlock) {
          items.push({
            section: "format",
            action: "edit-text",
            icon: "</>",
            label: "Редактировать код",
            hint: "Enter",
          });
        }
        if (isTableCell) {
          items.push({
            section: "format",
            action: "edit-text",
            icon: "вњЏпёЏ",
            label: "Редактировать ячейку",
            hint: "Enter",
          });
          items.push({
            section: "structure",
            action: "insert-table-row-above",
            icon: "↥",
            label: "Вставить строку выше",
            hint: "",
          });
          items.push({
            section: "structure",
            action: "insert-table-row-below",
            icon: "↧",
            label: "Вставить строку ниже",
            hint: "",
          });
          items.push({
            section: "structure",
            action: "insert-table-column-left",
            icon: "↤",
            label: "Вставить колонку слева",
            hint: "",
          });
          items.push({
            section: "structure",
            action: "insert-table-column-right",
            icon: "↦",
            label: "Вставить колонку справа",
            hint: "",
          });
          items.push({
            section: "remove",
            action: "delete-table-row",
            icon: "⊟",
            label: "Удалить строку",
            hint: "",
            danger: true,
          });
          items.push({
            section: "remove",
            action: "delete-table-column",
            icon: "⊟",
            label: "Удалить колонку",
            hint: "",
            danger: true,
          });
        }
        if (isImage) {
          items.push({
            section: "media",
            action: "replace-image",
            icon: "🖼",
            label: "Заменить изображение",
            hint: "",
          });
          items.push({
            section: "media",
            action: "fit-image-width",
            icon: "↔",
            label: "Вписать по ширине",
            hint: "",
          });
          if (isAdvanced) {
            items.push({
              section: "media",
              action: "copy-image-url",
              icon: "🔗",
              label: "Копировать URL изображения",
              hint: "",
            });
            items.push({
              section: "media",
              action: "open-image",
              icon: "↗",
              label: "Открыть в новой вкладке",
              hint: "",
            });
            items.push({
              section: "media",
              action: "reset-image-size",
              icon: "↺",
              label: "Сбросить размеры",
              hint: "",
            });
          }
        }
        if (isVideo && isAdvanced) {
          items.push({
            section: "media",
            action: "edit-media-url",
            icon: "🎞",
            label: "Изменить URL видео",
            hint: "",
          });
          items.push({
            section: "media",
            action: "open-media-url",
            icon: "↗",
            label: "Открыть URL видео",
            hint: "",
          });
        }
        if (isContainer && policy.canAddChild && !isSlideRoot && isAdvanced) {
          items.push({
            section: "structure",
            action: "add-child-text",
            icon: "🅣",
            label: "Добавить дочерний текст",
            hint: "",
          });
          items.push({
            section: "structure",
            action: "add-child-image",
            icon: "🖼",
            label: "Добавить дочернюю картинку",
            hint: "",
          });
          items.push({
            section: "structure",
            action: "wrap-div",
            icon: "▣",
            label: "Обернуть в div",
            hint: "",
          });
        } else if (isSlideRoot && policy.canAddChild) {
          items.push({
            section: "structure",
            action: "add-child-text",
            icon: "🅣",
            label: "Добавить блок в слайд",
            hint: "",
          });
          items.push({
            section: "structure",
            action: "add-child-image",
            icon: "🖼",
            label: "Добавить картинку в слайд",
            hint: "",
          });
        }
        // Copy / Cut / Paste element
        items.push({
          section: "structure",
          action: "copy-element",
          icon: "📋",
          label: "Копировать",
          hint: "Ctrl+C",
        });
        if (policy.canDelete)
          items.push({
            section: "structure",
            action: "cut-element",
            icon: "✂",
            label: "Вырезать",
            hint: "Ctrl+X",
          });
        if (state.copiedElementHtml)
          items.push({
            section: "structure",
            action: "paste-element",
            icon: "📌",
            label: "Вставить",
            hint: "Ctrl+V",
          });
        if (policy.canDuplicate)
          items.push({
            section: "structure",
            action: "duplicate",
            icon: "⧉",
            label: "Дублировать",
            hint: "Ctrl+D",
          });
        if (isAdvanced) {
          items.push({
            section: "structure",
            action: "copy-style",
            icon: "🎨+",
            label: "Копировать стиль",
            hint: "Ctrl+Shift+C",
          });
          if (policy.canEditStyles) {
            items.push({
              section: "structure",
              action: "paste-style",
              icon: "🎨⇣",
              label: "Вставить стиль",
              hint: "Ctrl+Shift+V",
            });
            items.push({
              section: "structure",
              action: "reset-styles",
              icon: "🧼",
              label: "Сбросить стили",
              hint: "",
            });
          }
        }
        if (policy.canDelete)
          items.push({
            section: "remove",
            action: "delete",
            icon: "🗑",
            label: "Удалить",
            hint: "Delete",
            danger: true,
          });
        // [v0.18.0] Group/Ungroup (advanced mode)
        if (isAdvanced && state.multiSelectNodeIds.length >= 2) {
          items.push({
            section: "structure",
            action: "group-elements",
            icon: "▣+",
            label: "Сгруппировать",
            hint: "",
          });
        }
        if (isAdvanced && state.selectedNodeId && state.modelDoc) {
          const node = state.modelDoc.querySelector(`[data-editor-node-id="${cssEscape(state.selectedNodeId)}"]`);
          if (node?.classList.contains("editor-group")) {
            items.push({
              section: "structure",
              action: "ungroup-element",
              icon: "▣-",
              label: "Разгруппировать",
              hint: "",
            });
          }
        }
        const _cStack = Array.isArray(payload?.candidateStack)
          ? payload.candidateStack
          : [];
        if (_cStack.length > 1) {
          const _layerKindIcons = {
            text: "T", image: "⬛", video: "▶", container: "⬚",
            table: "⊞", "table-cell": "⊞", "code-block": "</>",
            svg: "⬡", fragment: "◈", "slide-root": "◻",
            protected: "🔒", element: "◇",
          };
          _cStack.forEach((candidate, idx) => {
            items.push({
              section: "layers",
              action: "select-layer-item:" + candidate.nodeId,
              icon: _layerKindIcons[candidate.entityKind] || "◇",
              label: (idx + 1) + ". " + (candidate.label || candidate.nodeId),
              hint: getEntityKindLabel(candidate.entityKind),
              nodeId: candidate.nodeId,
              isCurrent: candidate.nodeId === state.selectedNodeId,
            });
          });
        }
        return items;
      }

      function renderContextMenu(payload) {
        const items = buildContextMenuItems(payload);
        const sections = [
          ["layers", "Слои под курсором"],
          ["format", "Форматирование"],
          ["media", "Медиа"],
          ["structure", "Структура"],
          ["remove", "Удаление"],
        ];
        els.contextMenuInner.innerHTML = "";
        sections.forEach(([key, title]) => {
          const groupItems = items.filter((item) => item.section === key);
          if (!groupItems.length) return;
          const titleEl = document.createElement("div");
          titleEl.className = "context-menu-section-title";
          titleEl.textContent = title;
          els.contextMenuInner.appendChild(titleEl);
          groupItems.forEach((item) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.menuAction = item.action;
            if (item.nodeId) button.dataset.layerNodeId = item.nodeId;
            if (item.danger) button.classList.add("danger-item");
            if (item.isCurrent) button.classList.add("is-current-layer");
            button.title = item.hint
              ? `${item.label} (${item.hint})`
              : item.label;
            button.tabIndex = -1;
            button.innerHTML = `
            <span class="menu-icon">${item.icon}</span>
            <span class="menu-label">${escapeHtml(item.label)}</span>
            <span class="menu-hint">${escapeHtml(item.hint || "")}</span>
          `;
            els.contextMenuInner.appendChild(button);
          });
        });
      }

      function computeContextMenuPosition(clientX, clientY) {
        const menu = els.contextMenu;
        const insets = getShellViewportInsets();
        menu.style.left = "0px";
        menu.style.top = "0px";
        menu.style.right = "auto";
        menu.classList.add("is-open");
        const width = menu.offsetWidth || 240;
        const height = menu.offsetHeight || 260;
        let x = clientX;
        let y = clientY;
        if (clientX + width > window.innerWidth - insets.right) x = clientX - width;
        if (clientY + height > window.innerHeight - insets.bottom) y = clientY - height;
        x = Math.max(
          insets.left,
          Math.min(window.innerWidth - insets.right - width, x),
        );
        y = Math.max(
          insets.top,
          Math.min(window.innerHeight - insets.bottom - height, y),
        );
        return { x, y };
      }

      function positionContextMenu(clientX, clientY) {
        if (!els.contextMenu) return;
        els.contextMenu.style.right = "auto";
        els.contextMenu.style.bottom = "auto";
        const insets = getShellViewportInsets();
        if (prefersContextMenuSheetMode()) {
          const availableWidth = Math.max(
            0,
            Math.round(window.innerWidth - insets.left - insets.right),
          );
          const sheetWidth = Math.max(240, Math.min(360, availableWidth));
          const centeredLeft =
            insets.left + Math.max(0, Math.round((availableWidth - sheetWidth) / 2));
          els.contextMenu.style.width = `${sheetWidth}px`;
          els.contextMenu.style.left = `${centeredLeft}px`;
          els.contextMenu.style.top = `${Math.round(
            Math.max(
              insets.top,
              window.innerHeight - insets.bottom - (els.contextMenu.offsetHeight || 280),
            ),
          )}px`;
          els.contextMenu.style.right = "auto";
          clampPopoverPosition(els.contextMenu, insets);
          return;
        }
        els.contextMenu.style.width = "";
        const pos = computeContextMenuPosition(clientX, clientY);
        els.contextMenu.style.left = `${pos.x}px`;
        els.contextMenu.style.top = `${pos.y}px`;
        clampPopoverPosition(els.contextMenu, insets);
      }

      function reopenContextMenuFromState() {
        if (!state.contextMenuPayload) return;
        renderContextMenu(state.contextMenuPayload);
        const x = Number(state.contextMenuPayload.shellClientX || 0);
        const y = Number(state.contextMenuPayload.shellClientY || 0);
        positionContextMenu(x, y);
        els.contextMenu.classList.add("is-open");
        els.contextMenu.setAttribute("aria-hidden", "false");
      }

      function closeContextMenu() {
        els.contextMenu.classList.remove("is-open");
        els.contextMenu.setAttribute("aria-hidden", "true");
        els.contextMenu.style.left = "0px";
        els.contextMenu.style.top = "0px";
        els.contextMenu.style.right = "auto";
        els.contextMenu.style.bottom = "auto";
        els.contextMenu.style.width = "";
        state.contextMenuNodeId = null;
        state.contextMenuPayload = null;
        sendToBridge("highlight-node", { nodeId: null });
        if (state.mode === "edit" && state.selectedNodeId) {
          window.requestAnimationFrame(() => positionFloatingToolbar());
        }
      }

      async function handleContextMenuAction(action) {
        const slideRailPayload =
          state.contextMenuPayload?.menuScope === "slide-rail"
            ? state.contextMenuPayload
            : null;
        switch (action) {
          case "slide-duplicate":
            if (slideRailPayload?.slideId) duplicateSlideById(slideRailPayload.slideId);
            break;
          case "slide-move-top":
            if (slideRailPayload)
              moveSlideToIndex(Number(slideRailPayload.slideIndex), 0);
            break;
          case "slide-move-up":
            if (slideRailPayload)
              moveSlideToIndex(
                Number(slideRailPayload.slideIndex),
                Number(slideRailPayload.slideIndex) - 1,
              );
            break;
          case "slide-move-down":
            if (slideRailPayload)
              moveSlideToIndex(
                Number(slideRailPayload.slideIndex),
                Number(slideRailPayload.slideIndex) + 1,
              );
            break;
          case "slide-move-bottom":
            if (slideRailPayload)
              moveSlideToIndex(
                Number(slideRailPayload.slideIndex),
                Math.max(0, state.slides.length - 1),
              );
            break;
          case "slide-delete":
            if (
              slideRailPayload?.slideId &&
              window.confirm("Удалить этот слайд?")
            ) {
              deleteSlideById(slideRailPayload.slideId);
            }
            break;
          case "edit-html":
            openElementHtmlEditor();
            break;
          case "edit-slide-html":
            openSlideHtmlEditor();
            break;
          case "edit-text":
            startTextEditing();
            break;
          case "insert-table-row-above":
            applySelectedTableStructureOperation("insert-row-above");
            break;
          case "insert-table-row-below":
            applySelectedTableStructureOperation("insert-row-below");
            break;
          case "delete-table-row":
            applySelectedTableStructureOperation("delete-row");
            break;
          case "insert-table-column-left":
            applySelectedTableStructureOperation("insert-column-left");
            break;
          case "insert-table-column-right":
            applySelectedTableStructureOperation("insert-column-right");
            break;
          case "delete-table-column":
            applySelectedTableStructureOperation("delete-column");
            break;
          case "duplicate":
            duplicateSelectedElement();
            break;
          case "replace-image":
            requestImageInsert("replace");
            break;
          case "reset-styles":
            resetSelectedStyles();
            break;
          case "delete":
            deleteSelectedElement();
            break;
          case "copy-image-url":
            await copySelectedImageUrl();
            break;
          case "open-image":
            openSelectedImageInNewTab();
            break;
          case "reset-image-size":
            resetSelectedImageSize();
            break;
          case "fit-image-width":
            fitSelectedImageToWidth();
            break;
          case "edit-media-url":
            editSelectedMediaUrl();
            break;
          case "open-media-url":
            openSelectedMediaInNewTab();
            break;
          case "copy-text":
            await copySelectedText();
            break;
          case "cut-text":
            await cutSelectedText();
            break;
          case "paste-as-text":
            await pasteClipboardAsText();
            break;
          case "to-h2":
            transformSelectedTag("h2");
            break;
          case "to-h3":
            transformSelectedTag("h3");
            break;
          case "add-child-text":
            addChildTextToSelected();
            break;
          case "add-child-image":
            state.pendingImageInsertMode = "insert-child";
            els.insertImageInput.click();
            break;
          case "wrap-div":
            wrapSelectedInDiv();
            break;
          case "copy-element":
            copySelectedElement();
            break;
          case "cut-element":
            cutSelectedElement();
            break;
          case "paste-element":
            pasteSelectedElement();
            break;
          case "copy-style":
            copySelectedStyle();
            break;
          case "paste-style":
            pasteStyleToSelected();
            break;
          case "group-elements":
            groupSelectedElements();
            break;
          case "ungroup-element":
            ungroupSelectedElement();
            break;
          default:
            if (action.startsWith("select-layer-item:")) {
              const _layerNodeId = action.slice("select-layer-item:".length);
              if (_layerNodeId) sendToBridge("select-element", { nodeId: _layerNodeId });
            }
            break;
        }
        closeContextMenu();
      }

      // openElementFinder
      // Мини-поиск по активному слайду: tag / id / class / текст. Полезен для
      // сложных слайдов, где нужный элемент трудно поймать мышью.
      function openElementFinder() {
        const query = prompt("Поиск элемента по tag / id / class / тексту");
        if (!query || !state.modelDoc || !state.activeSlideId) return;
        const slide = state.modelDoc.querySelector(
          `[data-editor-slide-id="${cssEscape(state.activeSlideId)}"]`,
        );
        if (!slide) return;
        const q = query.trim().toLowerCase();
        const match = slide.querySelectorAll("[data-editor-node-id]");
        const target = Array.from(match).find((el) => {
          return (
            el.tagName.toLowerCase() === q ||
            (el.id || "").toLowerCase().includes(q) ||
            (el.className || "").toLowerCase().includes(q) ||
            (el.textContent || "").toLowerCase().includes(q)
          );
        });
        if (!target) {
          showToast("Совпадений не найдено.", "warning", { title: "Поиск" });
          return;
        }
        stagePreviewSelectionRestore(target.getAttribute("data-editor-node-id"), {
          slideId: state.activeSlideId,
        });
        requestSlideActivation(state.activeSlideId, {
          index: state.slides.findIndex(
            (slideMeta) => slideMeta.id === state.activeSlideId,
          ),
          closeTransientUi: false,
          reason: "find-element",
        });
        flushPendingPreviewSelection();
        showToast("Найден первый подходящий элемент.", "success", {
          title: "Поиск",
        });
      }

      function maybeSuggestFitForLargeImage(src) {
        try {
          const img = new Image();
          img.onload = () => {
            if (img.naturalWidth > 1800) {
              showToast(
                "Изображение большое. При необходимости используй «Вписать по ширине».",
                "warning",
                { title: "Совет" },
              );
            }
          };
          img.src = src;
        } catch (error) {
          // Advisory image preflight only; ignore environments that block image construction.
        }
      }

      // ====================================================================
      // Watchdog / resilience
      // Следим за heartbeat bridge и периодически запрашиваем sync активного слайда,
      // чтобы уменьшать риск рассинхрона между iframe и modelDoc.
      // ====================================================================
      function startBridgeWatchdog() {
        if (state.bridgeWatchdogTimer)
          window.clearInterval(state.bridgeWatchdogTimer);
        if (state.modelSyncTimer) window.clearInterval(state.modelSyncTimer);
        state.bridgeWatchdogTimer = window.setInterval(() => {
          if (!state.modelDoc || !state.previewReady) return;
          pruneSlideSyncLocks();
          sendToBridge("request-slide-sync", {
            slideId: state.activeSlideId,
            reason: "watchdog",
          });
          if (Date.now() - state.lastBridgeHeartbeatAt > BRIDGE_STALE_THRESHOLD_MS) {
            if (state.bridgeAlive) {
              state.bridgeAlive = false;
              setPreviewLifecycleState("bridge-degraded", {
                reason: "heartbeat-timeout",
              });
              setPreviewLoading(
                true,
                "Связь с превью потеряна. Можно пересоздать iframe через «↻ Восстановить».",
              );
              showToast(
                "Bridge внутри iframe перестал отвечать. Используй кнопку «↻ Превью», чтобы пересоздать превью без потери shell-состояния.",
                "warning",
                { title: "Связь потеряна", ttl: 5200 },
              );
              refreshUi();
            }
          }
        }, BRIDGE_WATCHDOG_INTERVAL_MS);
        state.modelSyncTimer = window.setInterval(() => {
          if (!state.modelDoc || !state.previewReady || state.mode !== "edit")
            return;
          sendToBridge("request-slide-sync", {
            slideId: state.activeSlideId,
            reason: "interval",
          });
        }, MODEL_SYNC_INTERVAL_MS);
      }

      function applyDocumentSyncFromBridge(payload, seq = 0) {
        const slideId = payload.slideId;
        const html = payload.html;
        const source = String(payload.source || "").trim();
        if (!slideId || !html || !state.modelDoc) return;
        if (shouldIgnoreLockedDocumentSync(slideId, seq)) {
          addDiagnostic(`document-sync-locked:${slideId}:${seq || 0}`);
          return;
        }
        if (isStaleInboundSeq(slideId, seq)) {
          const localSeq = Number(state.lastAppliedSeqBySlide[slideId] || 0);
          const drift = Math.abs(localSeq - seq);
          addDiagnostic(`document-sync-stale:${slideId}:${seq} (drift=${drift}, tolerance=${SEQ_DRIFT_TOLERANCE})`);
          markPreviewDesync(`document-sync-stale:${slideId}:${seq}`, { toast: false });
          return;
        }
        const currentSlide = state.modelDoc.querySelector(
          `[data-editor-slide-id="${cssEscape(slideId)}"]`,
        );
        if (!currentSlide) return;
        if (currentSlide.outerHTML === html) return;
        try {
          const replacement = parseSingleRootElement(html);
          preserveAuthoredMarkerContract(currentSlide, replacement);
          replacement.setAttribute("data-editor-slide-id", slideId);
          const imported = state.modelDoc.importNode(replacement, true);
          currentSlide.replaceWith(imported);
          assignEditorNodeIdsInModel(imported);
          if (!selectedNodeExistsInModel()) {
            clearSelectedElementState();
          }
          noteAppliedSeq(slideId, seq);
          commitChange(source || "bridge-sync", {
            snapshotMode: source === "text-edit-commit" ? "immediate" : "none",
          });
          syncSlideRegistry({
            runtimeActiveSlideId:
              String(payload.activeSlideId || "").trim() || state.runtimeActiveSlideId,
          });
          renderSlidesList();
          refreshUi();
        } catch (error) {
          addDiagnostic(`document-sync-error: ${error.message}`);
          markPreviewDesync(`document-sync-error:${error.message}`);
        }
      }


      function getSelectedEntityKindForUi() {
        if (!(state.selectedNodeId && state.mode === "edit")) return "none";
        return normalizeEntityKind(
          state.selectedEntityKind,
          getEntityKindFromFlags(state.selectedFlags),
        );
      }

      function getSelectionPrimarySurface(entityKind = getSelectedEntityKindForUi()) {
        if (!(state.selectedNodeId && state.mode === "edit")) return "none";
        const kind = normalizeEntityKind(
          entityKind,
          getEntityKindFromFlags(state.selectedFlags),
        );
        if (!isCompactShell()) return "inspector";
        if (
          kind === "video" ||
          kind === "slide-root" ||
          kind === "protected" ||
          kind === "table" ||
          kind === "svg" ||
          kind === "fragment"
        ) {
          return "inspector";
        }
        if (
          kind === "text" ||
          kind === "image" ||
          kind === "table-cell" ||
          kind === "code-block" ||
          kind === "container" ||
          kind === "element"
        ) {
          return "toolbar";
        }
        return "inspector";
      }

      function syncSelectionShellSurface(entityKind = getSelectedEntityKindForUi()) {
        if (!isCompactShell() || state.mode !== "edit" || !state.selectedNodeId)
          return;
        const primarySurface = getSelectionPrimarySurface(entityKind);
        state.leftPanelOpen = false;
        if (primarySurface === "inspector") {
          state.rightPanelOpen = true;
        } else if (!state.rightPanelUserOpen) {
          state.rightPanelOpen = false;
        }
        applyShellPanelState();
      }

      function setInspectorSectionVisibility(section, visible) {
        if (!section) return;
        section.hidden = !visible;
        section.classList.toggle("is-entity-hidden", !visible);
        section.setAttribute("aria-hidden", visible ? "false" : "true");
        syncShellPanelFocusableState(section, visible);
        setElementInertState(section, !visible);
      }

      function setBlockVisibility(element, visible) {
        if (!(element instanceof HTMLElement)) return;
        element.hidden = !visible;
        element.setAttribute("aria-hidden", visible ? "false" : "true");
        setElementInertState(element, !visible);
      }

      // =====================================================================
