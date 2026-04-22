      // ZONE: Slide Rail Rendering
      // Renders the left-panel slide thumbnails and handles rail interactions
      // =====================================================================
      function renderSlidesList() {
        els.slidesList.innerHTML = "";
        const slides = state.slides;
        const activeSlideIndex = getSlideIndexById(state.activeSlideId);
        const pendingSlideIndex = getSlideIndexById(state.pendingActiveSlideId);
        els.slidesCountLabel.textContent = `${slides.length} ${pluralizeSlides(slides.length)}`;
        els.activeSlideLabel.textContent =
          activeSlideIndex >= 0
            ? `Активный: слайд ${activeSlideIndex + 1} из ${slides.length}`
            : "Слайд не выбран";
        if (pendingSlideIndex >= 0) {
          els.activeSlideLabel.textContent =
            `Переход к слайду ${pendingSlideIndex + 1} из ${slides.length}`;
        } else {
          els.activeSlideLabel.textContent = getEditorialActiveSlideSummaryLabel();
        }
        if (!slides.length) {
          const empty = document.createElement("div");
          empty.className = "empty-state";
          empty.innerHTML =
            "<strong>Слайды пока не обнаружены</strong>Если HTML тяжёлый, дождись полной инициализации скриптов внутри iframe.";
          els.slidesList.appendChild(empty);
          return;
        }
        slides.forEach((slide, index) => {
          const isActiveSlide = slide.id === state.activeSlideId;
          const isPendingSlide = slide.id === state.pendingActiveSlideId;
          const item = document.createElement("div");
          item.className = `slide-item ${isActiveSlide ? "is-active" : ""}`;
          if (isPendingSlide) item.classList.add("is-pending");
          item.dataset.index = String(index);
          item.dataset.slideId = slide.id;
          item.setAttribute("role", "button");
          item.setAttribute("tabindex", isActiveSlide ? "0" : "-1");
          item.setAttribute(
            "aria-label",
            `Слайд ${index + 1}: ${slide.title || "без названия"}`,
          );
          if (isActiveSlide) item.setAttribute("aria-current", "true");
          item.setAttribute("aria-busy", isPendingSlide ? "true" : "false");
          const canDragSlideRail = canUseSlideRailDragDrop() && hasStaticSlide(slide.id);
          if (canDragSlideRail) item.setAttribute("draggable", "true");
          const main = document.createElement("div");
          main.className = "slide-item-main";
          const slideNode = state.modelDoc?.querySelector(
            `[data-editor-slide-id="${cssEscape(slide.id)}"]`,
          );
          const metaTags = buildSlideMetaTags(slide, slideNode);
          const hasSevereOverlap =
            state.complexityMode === "basic" &&
            Boolean(state.slideOverlapWarnings[slide.id]);
          if (hasSevereOverlap) metaTags.push("⚠ перекрытие");
          const stateTagClass =
            slide.state === "requested"
              ? "slide-tag slide-state-tag is-pending"
              : slide.state === "active"
                ? "slide-tag slide-state-tag is-active"
                : "slide-tag slide-state-tag";
          main.innerHTML = `
          <div class="slide-number">Слайд ${index + 1}</div>
          <div class="slide-title">${escapeHtml(slide.title || "Пустой слайд")}</div>
          ${
            metaTags.length || slide.stateLabel
              ? `<div class="slide-meta-row"><span class="${stateTagClass}">${escapeHtml(
                  slide.stateLabel || "ready",
                )}</span>${metaTags
                  .map((tag) =>
                    `<span class="slide-tag${tag.includes("⚠") ? " is-overlap-warning" : ""}"${
                      tag.includes("⚠") ? ' data-overlap-warning="true" role="button" tabindex="0"' : ""
                    }>${escapeHtml(tag)}</span>`,
                  )
                  .join("")}</div>`
              : ""
          }
        `;
          const overlapWarningTag = main.querySelector('[data-overlap-warning="true"]');
          if (overlapWarningTag) {
            const showOverlapHint = (event) => {
              event.preventDefault();
              event.stopPropagation();
              showToast(
                "Один из элементов перекрыт. Нажмите на него, чтобы выбрать.",
                "warning",
                { title: "Перекрытие слоёв", actionLabel: "Понял" },
              );
            };
            overlapWarningTag.addEventListener("click", showOverlapHint);
            overlapWarningTag.addEventListener("keydown", (event) => {
              if (event.key === "Enter" || event.key === " ") {
                showOverlapHint(event);
              }
            });
          }
          const actions = document.createElement("div");
          actions.className = "slide-actions";
          const menuBtn = document.createElement("button");
          menuBtn.type = "button";
          menuBtn.className = "icon-btn slide-menu-trigger";
          menuBtn.textContent = "⋯";
          menuBtn.setAttribute("aria-label", `Открыть действия для слайда ${index + 1}`);
          menuBtn.title = "Действия со слайдом";
          menuBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            const rect = menuBtn.getBoundingClientRect();
            openSlideRailContextMenu(
              slide.id,
              index,
              rect.left + rect.width / 2,
              rect.bottom + 6,
            );
          });
          actions.append(menuBtn);
          item.append(main, actions);
          item.addEventListener("click", () => {
            if (Date.now() < state.slideRailDrag.suppressClickUntil) return;
            requestSlideActivation(slide.id, { index });
          });
          item.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openSlideRailContextMenu(slide.id, index, event.clientX, event.clientY);
          });
          item.addEventListener("keydown", (event) => {
            if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
              event.preventDefault();
              const rect = item.getBoundingClientRect();
              openSlideRailContextMenu(
                slide.id,
                index,
                rect.left + Math.min(rect.width - 18, 42),
                rect.top + Math.min(rect.height - 12, 28),
              );
              return;
            }
            // Alt+ArrowDown / Alt+ArrowUp — reorder slide within rail
            if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
              event.preventDefault();
              event.stopPropagation();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              const toIndex = index + direction;
              if (toIndex >= 0 && toIndex < state.slides.length) {
                moveSlideToIndex(index, toIndex, { activateMovedSlide: false });
                showToast(
                  `Слайд перемещён: позиция ${index + 1} → ${toIndex + 1}`,
                  "info",
                  { title: "Перемещение слайда" },
                );
              }
              return;
            }
            // ArrowDown / ArrowUp — move focus to adjacent rail item (roving tabindex)
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              event.stopPropagation();
              const items = Array.from(
                els.slidesList.querySelectorAll(".slide-item"),
              );
              const currentPos = items.indexOf(item);
              const nextPos =
                event.key === "ArrowDown"
                  ? Math.min(items.length - 1, currentPos + 1)
                  : Math.max(0, currentPos - 1);
              if (nextPos !== currentPos) {
                // Update roving tabindex: remove from current, add to next
                item.setAttribute("tabindex", "-1");
                items[nextPos].setAttribute("tabindex", "0");
                items[nextPos].focus();
              }
              return;
            }
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            item.click();
          });
          if (canDragSlideRail) {
            item.addEventListener("dragstart", (event) => {
              // [WO-33 / ADR-018] Block rail drag-reorder on compact viewports (≤820px).
              if (window.isCompactViewport && window.isCompactViewport()) {
                event.preventDefault();
                if (window.reportCompactRailBlock) window.reportCompactRailBlock();
                return;
              }
              state.slideRailDrag.slideId = slide.id;
              state.slideRailDrag.hoverIndex = index;
              state.slideRailDrag.suppressClickUntil = 0;
              item.classList.add("is-dragging");
              event.dataTransfer?.setData("text/plain", slide.id);
              if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
            });
            item.addEventListener("dragover", (event) => {
              if (!state.slideRailDrag.slideId) return;
              event.preventDefault();
              if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
              setSlideRailDropTarget(index);
              maybeAutoScrollSlideRail(event.clientY);
            });
            item.addEventListener("drop", (event) => {
              if (!state.slideRailDrag.slideId) return;
              event.preventDefault();
              const fromIndex = getSlideIndexById(state.slideRailDrag.slideId);
              resetSlideRailDragState();
              moveSlideToIndex(fromIndex, index, { activateMovedSlide: false });
            });
            item.addEventListener("dragend", () => {
              resetSlideRailDragState();
            });
          }
          els.slidesList.appendChild(item);
        });
        scrollActiveSlideListItemIntoView();
      }

      function hasStaticSlide(slideId) {
        return Boolean(
          slideId &&
          state.modelDoc?.querySelector(
            `[data-editor-slide-id="${cssEscape(slideId)}"]`,
          ),
        );
      }

      function getSlidePresetLabel(preset) {
        switch (String(preset || "").trim()) {
          case "title":
            return "Title";
          case "section":
            return "Section";
          case "bullets":
            return "Bullets";
          case "media":
            return "Media";
          case "two-column":
            return "2 колонки";
          default:
            return "";
        }
      }

      function getSlideTitleOverride(slide) {
        return String(slide?.getAttribute("data-slide-title") || "").trim();
      }

      function getSlidePresetValue(slide) {
        return String(slide?.getAttribute("data-slide-preset") || "").trim();
      }

      function getSlidePaddingPreset(slide) {
        const stored = String(
          slide?.getAttribute("data-slide-padding-preset") || "",
        ).trim();
        if (stored) return stored;
        const padding = String(slide?.style?.padding || "").trim();
        if (padding === "0px") return "none";
        if (padding === "24px") return "compact";
        if (padding === "48px") return "default";
        if (padding === "72px") return "spacious";
        return "";
      }

      function getSlidePaddingLabel(preset) {
        switch (String(preset || "").trim()) {
          case "none":
            return "Отступ 0";
          case "compact":
            return "Отступ 24";
          case "default":
            return "Отступ 48";
          case "spacious":
            return "Отступ 72";
          default:
            return "";
        }
      }

      function buildSlideMetaTags(slideMeta = {}, slideNode = null) {
        const tags = [];
        const presetLabel = getSlidePresetLabel(
          slideMeta?.preset || getSlidePresetValue(slideNode),
        );
        if (presetLabel) tags.push(presetLabel);
        const paddingLabel = getSlidePaddingLabel(
          slideMeta?.paddingPreset || getSlidePaddingPreset(slideNode),
        );
        if (paddingLabel) tags.push(paddingLabel);
        return tags;
      }

      function moveSlide(index, direction) {
        moveSlideToIndex(index, index + direction);
      }

      function canSelectionAction(action) {
        if (!state.selectedNodeId) return false;
        const policy = state.selectedPolicy || createDefaultSelectionPolicy();
        switch (action) {
          case "move":
            return Boolean(policy.canMove);
          case "resize":
            return Boolean(policy.canResize);
          case "nudge":
            return Boolean(policy.canNudge);
          case "reorder":
            return Boolean(policy.canReorder);
          case "delete":
            return Boolean(policy.canDelete);
          case "duplicate":
            return Boolean(policy.canDuplicate);
          case "wrap":
            return Boolean(policy.canWrap);
          case "addChild":
            return Boolean(policy.canAddChild);
          case "editHtml":
            return Boolean(policy.canEditHtml);
          case "editSlideHtml":
            return Boolean(policy.canEditSlideHtml);
          case "editAttributes":
            return Boolean(policy.canEditAttributes);
          case "editStyles":
            return Boolean(policy.canEditStyles);
          case "replaceMedia":
            return Boolean(policy.canReplaceMedia);
          default:
            return !state.selectedFlags.isProtected;
        }
      }

      function getSelectionActionBlockMessage(action) {
        if (state.selectedFlags.isSlideRoot) {
          if (action === "addChild") {
            return "Корневой контейнер слайда защищён от разрушительных операций, но новые блоки можно добавлять внутрь слайда.";
          }
          if (action === "editStyles") {
            return "Для корневого контейнера слайда доступны только безопасные стилевые правки.";
          }
            return "Корневой контейнер слайда защищён от опасных structural-операций. Используй действия слайда или меняй только безопасные стили.";
        }
        if (action === "editAttributes") {
          return (
            state.selectedPolicy?.reason ||
            "Атрибуты этого элемента сейчас не редактируются. Меняй только безопасные свойства через inspector."
          );
        }
        if (action === "editHtml") {
          return (
            state.selectedPolicy?.reason ||
            "HTML для этого выбора сейчас заблокирован. Используй доступные действия элемента или inspector."
          );
        }
        return (
          state.selectedPolicy?.reason ||
          "Этот системный контейнер защищён от прямого редактирования и structural-операций."
        );
      }

      function guardSelectionAction(action, actionLabel, options = {}) {
        if (!state.selectedNodeId) return false;
        if (
          ["move", "resize", "nudge"].includes(action) &&
          hasBlockedDirectManipulationContext()
        ) {
          const blockedKind = action === "resize" ? "resize" : "drag";
          if (options.surface === "tooltip") {
            showSelectionFrameTooltip(
              options.message || getDirectManipulationTooltipMessage(blockedKind),
            );
          } else if (options.toast !== false) {
            showToast(
              options.message || getDirectManipulationBlockMessage(blockedKind),
              "warning",
              {
                title: actionLabel || "Операция ограничена",
                ttl: 4200,
              },
            );
          }
          return false;
        }
        if (canSelectionAction(action)) return true;
        if (options.toast !== false) {
          showToast(
            options.message || getSelectionActionBlockMessage(action),
            "warning",
            {
              title: actionLabel || "Операция ограничена",
              ttl: 4200,
            },
          );
        }
        return false;
      }

      function guardProtectedSelection(actionLabel, options = {}) {
        return guardSelectionAction(
          options.action || "structure",
          actionLabel,
          options,
        );
      }

      function markPreviewDesync(reason, options = {}) {
        if (!state.modelDoc) return;
        if (state.previewLifecycle === "bridge-degraded") return;
        if (state.previewLifecycle === "recovering") return;
        setPreviewLifecycleState("desync-suspected", { reason });
        if (options.toast !== false) {
          showToast(
            "Shell заметил риск рассинхрона между modelDoc и live DOM. Используй «↻ Восстановить», чтобы заново собрать превью из модели.",
            "warning",
            { title: "Sync под вопросом", ttl: 4600 },
          );
        }
      }

      function reloadPreviewShell(reason = "manual") {
        if (!state.modelDoc) return;
        closeContextMenu();
        closeInsertPalette();
        setPreviewLifecycleState("recovering", { reason });
        setPreviewLoading(
          true,
          reason === "manual"
            ? "Перезагрузка превью…"
            : "Восстановление превью…",
        );
        rebuildPreviewKeepingContext(state.activeSlideId);
        if (reason === "manual") {
          showToast(
            "Превью пересоздано. Если bridge зависал, соединение должно восстановиться после загрузки iframe.",
            "success",
            { title: "Превью" },
          );
        }
      }

      function rebuildPreviewKeepingContext(
        preferredSlideId = state.activeSlideId,
      ) {
        if (!state.modelDoc) return;
        cleanupPreviewUrl();
        state.previewReady = false;
        state.bridgeAlive = false;
        state.runtimeSlides = [];
        state.runtimeActiveSlideId = null;
        setPreviewLifecycleState("recovering", { reason: "rebuild-preview" });
        state.slideSyncLocks = {};
        clearRequestedSlideActivation();
        if (preferredSlideId) {
          stageSlideActivationRequest(preferredSlideId, {
            source: "rebuild-preview",
          });
        }
        if (!state.pendingPreviewSelection) {
          state.selectedNodeId = null;
          state.selectedTag = null;
          state.selectedComputed = null;
          state.selectedHtml = "";
          state.selectedRect = null;
        }
        syncSlideRegistry({ currentActiveId: preferredSlideId });
        state.bridgeToken = createBridgeToken();
        const previewPack = buildPreviewPackage();
        if (!previewPack) return;
        state.previewUrl = URL.createObjectURL(previewPack.blob);
        els.previewFrame.onload = () => {
          sendToBridge("set-mode", { mode: state.mode });
          // [LAYER-MODEL v2] sync selection mode after iframe load
          sendToBridge("set-selection-mode", { containerMode: state.selectionMode === "container" });
        };
        els.previewFrame.src = state.previewUrl;
        hideFloatingToolbar();
        refreshUi();
      }

      function startTextEditing() {
        if (canTextEditCurrentSelection()) {
          closeContextMenu();
          setInteractionMode("text-edit");
          const selectionPayload = buildSelectionBridgePayload(state.selectedNodeId, {
            focusText: true,
          });
          if (selectionPayload) {
            sendToBridge("select-element", selectionPayload);
          }
          return;
        }
        if (!state.selectedNodeId) return;
        showToast(
          state.selectedFlags.canEditText
            ? "Текст для этого элемента сейчас недоступен. Используй безопасные поля inspector."
            : "У выбранного элемента нет прямого текстового режима. Для него доступны только подходящие действия и свойства.",
          "warning",
          { title: "Текстовое редактирование недоступно", ttl: 3600 },
        );
      }

      function hasTableCellSelection() {
        return (
          state.mode === "edit" &&
          Boolean(state.selectedNodeId) &&
          getSelectedEntityKindForUi() === "table-cell"
        );
      }

      function navigateSelectedTableCell(direction = "next") {
        if (!hasTableCellSelection()) return;
        sendToBridge("navigate-table-cell", {
          nodeId: state.selectedNodeId,
          direction: direction === "previous" ? "shift-tab" : "tab",
        });
      }

      function applySelectedTableStructureOperation(operation) {
        if (!hasTableCellSelection()) return;
        if (!guardProtectedSelection("Таблица")) return;
        sendToBridge("table-structure-op", {
          nodeId: state.selectedNodeId,
          operation,
        });
        closeContextMenu();
      }

      // =====================================================================
