      // ZONE: Primary Action Sync
      // syncPrimaryActionUi — enables/disables topbar buttons and insert palette
      // =====================================================================
      function syncPrimaryActionUi(
        hasPresentation,
        hasSelection,
        canInsertNow,
      ) {
        const workflow = state.editorWorkflow || getEditorWorkflowState();
        if (els.presentBtn)    els.presentBtn.disabled    = !hasPresentation;
        els.exportBtn.disabled = !hasPresentation;
        if (els.exportPptxBtn) els.exportPptxBtn.disabled = !hasPresentation;
        els.undoBtn.disabled = state.historyIndex <= 0;
        els.redoBtn.disabled =
          state.historyIndex >= state.history.length - 1 ||
          state.history.length === 0;
        if (els.topbarOverflowUndoBtn) {
          els.topbarOverflowUndoBtn.disabled = els.undoBtn.disabled;
        }
        if (els.topbarOverflowRedoBtn) {
          els.topbarOverflowRedoBtn.disabled = els.redoBtn.disabled;
        }
        els.showSlideHtmlBtn.disabled =
          !hasPresentation ||
          !state.activeSlideId ||
          !hasStaticSlide(state.activeSlideId);
        els.showElementHtmlBtn.disabled =
          !hasSelection || !state.selectedPolicy.canEditHtml || state.selectedFlags.isSlideRoot;
        els.editModeBtn.disabled = !hasPresentation || !state.editingSupported;
        setToggleButtonState(els.previewModeBtn, state.mode === "preview");
        setToggleButtonState(els.editModeBtn, state.mode === "edit");

        if (els.saveStatePill) {
          const text = !hasPresentation
            ? "Локальный черновик не создан"
            : state.dirty
              ? state.lastSavedAt
                ? `Есть правки • локальный черновик: ${new Date(state.lastSavedAt).toLocaleTimeString()}`
                : "Есть несохранённые правки"
              : state.lastSavedAt
                ? `Локальный черновик: ${new Date(state.lastSavedAt).toLocaleTimeString()}`
                : "Изменений нет";
          els.saveStatePill.textContent = text;
          els.saveStatePill.className =
            `status-pill save-pill ${state.dirty ? "is-saving" : "is-saved"}`.trim();
        }

        if (els.toggleInsertPaletteBtn) {
          const canShowInsertAction = hasPresentation && state.mode === "edit";
          els.toggleInsertPaletteBtn.hidden = !canShowInsertAction;
          els.toggleInsertPaletteBtn.disabled = !canInsertNow;
          if (!hasPresentation) {
            els.toggleInsertPaletteBtn.title =
              "Сначала открой HTML-презентацию.";
          } else if (state.mode !== "edit") {
            els.toggleInsertPaletteBtn.title =
              "Сначала перейдите к редактированию, затем добавляйте блоки.";
          } else if (!state.previewReady) {
            els.toggleInsertPaletteBtn.title =
              "Дождись полной загрузки превью.";
          } else {
            els.toggleInsertPaletteBtn.title = isInsertPaletteOpen()
              ? "Скрыть меню вставки"
              : "Открыть меню вставки";
          }
        }
        if (els.previewPrimaryActionBtn) {
          if (hasPresentation && workflow === "loaded-preview") {
            els.previewPrimaryActionBtn.hidden = false;
            els.previewPrimaryActionBtn.disabled = !state.editingSupported;
            els.previewPrimaryActionBtn.dataset.action = "edit";
            els.previewPrimaryActionBtn.textContent = "Начать редактирование";
            els.previewPrimaryActionBtn.title =
              "Перейти из просмотра к правке текущего слайда.";
          } else {
            els.previewPrimaryActionBtn.hidden = true;
            els.previewPrimaryActionBtn.disabled = true;
            els.previewPrimaryActionBtn.dataset.action = "";
          }
        }
        if (els.reloadPreviewBtn) {
          els.reloadPreviewBtn.hidden = !hasPresentation;
        }

        [
          els.addTextBtn,
          els.addShapeBtn,
          els.addImageBtn,
          els.addVideoBtn,
          els.insertHtmlBtn,
        ].forEach((control) => {
          if (control) control.disabled = !canInsertNow;
        });
      }

      function getActiveSlideSummaryLabel() {
        const activeSlideIndex = getSlideIndexById(state.activeSlideId);
        if (activeSlideIndex < 0 || !state.slides.length) {
          return "No active slide";
        }
        const activeSlide = state.slides[activeSlideIndex] || {};
        const title = String(activeSlide.title || "").trim();
        return title
          ? `Slide ${activeSlideIndex + 1}/${state.slides.length} - ${title}`
          : `Slide ${activeSlideIndex + 1}/${state.slides.length}`;
      }

      function getWorkspaceStateMeta(hasPresentation, hasSelection) {
        if (!hasPresentation) {
          return {
            className: "status-pill",
            label: "Ждёт HTML",
            title: "Загрузите HTML-презентацию, чтобы активировать shell редактора.",
          };
        }

        switch (state.previewLifecycle) {
          case "loading":
            return {
              className: "status-pill is-accent",
              label: "Превью стартует",
              title: "iframe ещё поднимается и подключает bridge.",
            };
          case "recovering":
            return {
              className: "status-pill is-accent",
              label: "Идёт восстановление",
              title: "Shell пересоздаёт iframe и восстанавливает bridge.",
            };
          case "bridge-degraded":
            return {
              className: "status-pill is-warning",
              label: "Потеряна связь",
              title: "Heartbeat bridge пропал, shell ждёт пересборку превью.",
            };
          case "desync-suspected":
            return {
              className: "status-pill is-warning",
              label: "Нужна синхронизация",
              title: "Shell подозревает расхождение между моделью и live DOM.",
            };
          default:
            if (state.mode === "edit") {
              return hasSelection
                ? {
                    className: "status-pill is-accent",
                    label: "Элемент выбран",
                    title: "Внутри preview iframe выбран живой DOM-узел.",
                  }
                : {
                    className: "status-pill is-accent",
                    label: "Можно править",
                    title: "Превью готово к вставке и редактированию.",
                  };
            }
            return {
              className: "status-pill is-ok",
              label: "Готово",
              title: "iframe и bridge синхронизированы и готовы к работе.",
            };
        }
      }

      function getPreviewStatusSummary(hasPresentation, hasSelection) {
        if (!hasPresentation) {
          return "Откройте HTML.";
        }

        switch (state.previewLifecycle) {
          case "loading":
            return "Превью запускается.";
          case "recovering":
            return "Восстанавливаем превью.";
          case "bridge-degraded":
            return "Связь потеряна.";
          case "desync-suspected":
            return "Нужна пересборка.";
          default:
            if (state.mode === "edit") {
              if (!hasSelection) {
                return "Выберите элемент.";
              }
              if (isCompactShell()) {
                return getSelectionPrimarySurface() === "toolbar"
                  ? "Действия готовы."
                  : "Свойства готовы.";
              }
              return "Свойства готовы.";
            }
            return "Проверьте текущий слайд.";
        }
      }

      function getComplexityModeDisplayLabel(mode = state.complexityMode) {
        return mode === "advanced" ? "режим «Точно»" : "режим «Быстро»";
      }

      function getSelectionGuidanceCopy(hasSelection) {
        if (!hasSelection) {
          return "Сначала выберите элемент на слайде. Для текста можно сделать двойной клик и сразу печатать.";
        }
        const entityKind = getSelectedEntityKindForUi();
        const primarySurface = getSelectionPrimarySurface(entityKind);
        if (entityKind === "protected") {
          return "Выбран защищённый контейнер. Здесь можно менять только безопасные параметры, а остальная структура защищена.";
        }
        if (entityKind === "slide-root") {
          return "Выбран весь слайд. Справа доступны настройки слайда и безопасные действия без изменения каркаса.";
        }
        if (hasBlockedDirectManipulationContext()) {
          return isAdvancedMode()
            ? `Этот элемент нельзя свободно двигать мышью в текущем контексте. Используйте ${getComplexityModeDisplayLabel()} и точные поля справа для размера и позиции.`
            : `Этот элемент нельзя свободно двигать мышью в ${getComplexityModeDisplayLabel()}. Если нужна точная позиция, переключитесь в режим «Точно».`;
        }
        if (isCompactShell()) {
          if (primarySurface === "toolbar") {
            return "Быстрые действия доступны снизу, а точные свойства остаются справа.";
          }
          if (entityKind === "video") {
            return "Выбрано видео. Справа доступны источник, подписи и базовые media-настройки.";
          }
          return "Свойства выбранного элемента открыты автоматически.";
        }
        return "Справа открыты свойства выбранного элемента. Изменения применяются сразу в живом превью.";
      }

      function getEntityKindLabel(entityKind) {
        if (entityKind === "table") return "Таблица";
        if (entityKind === "table-cell") return "Ячейка таблицы";
        if (entityKind === "code-block") return "Блок кода";
        if (entityKind === "svg") return "SVG";
        if (entityKind === "fragment") return "Фрагмент";
        switch (entityKind) {
          case "text":
            return "Текст";
          case "image":
            return "Изображение";
          case "video":
            return "Видео";
          case "slide-root":
            return "Слайд";
          case "protected":
            return "Защищённый блок";
          case "container":
            return "Контейнер";
          case "element":
            return "Элемент";
          default:
            return "—";
        }
      }

      function getSelectedElementTitle(entityKind) {
        if (entityKind === "table") return "Таблица на слайде";
        if (entityKind === "table-cell") return "Ячейка таблицы";
        if (entityKind === "code-block") return "Блок кода";
        if (entityKind === "svg") return "SVG-графика";
        if (entityKind === "fragment") return "Фрагмент с состоянием";
        if (!state.selectedNodeId || entityKind === "none") return "Элемент не выбран";
        if (entityKind === "text") return "Текстовый блок";
        if (entityKind === "image") return "Изображение на слайде";
        if (entityKind === "video") return "Видео или iframe";
        return getEntityKindLabel(entityKind);
      }

      function getSelectedElementSummary(entityKind) {
        if (entityKind === "table") {
          return "Таблица импортирована как структурированный DOM-блок. Безопаснее редактировать отдельные ячейки, а не весь HTML контейнера.";
        }
        if (entityKind === "table-cell") {
          return "Ячейку можно править как текстовый блок, не ломая структуру всей таблицы.";
        }
        if (entityKind === "code-block") {
          return "Блок кода сохраняет пробелы и переносы строк. Текст можно редактировать напрямую без structural replacement.";
        }
        if (entityKind === "svg") {
          return "SVG выбран как единый объект. Сохраняйте внутреннюю векторную структуру и правьте только безопасные свойства контейнера.";
        }
        if (entityKind === "fragment") {
          return "Fragment/state wrapper хранит reveal-state и data-* маркеры. Правки текста допустимы только если они не ломают stateful-обёртку.";
        }
        if (!state.selectedNodeId || entityKind === "none") {
          return "Сначала выберите объект на слайде. Для текста можно сделать двойной клик и сразу печатать.";
        }
        // [v0.19.0] Show block reason as primary feedback when manipulation is blocked
        const blockReason = getBlockReason();
        if (blockReason !== "none" && entityKind !== "slide-root" && entityKind !== "protected") {
          const reasonLabel = getBlockReasonLabel(blockReason);
          if (reasonLabel) return reasonLabel + ". Используйте поля инспектора для точного позиционирования.";
        }
        if (entityKind === "text") {
          return "Дважды кликните, чтобы начать печатать. Можно менять шрифт, цвет, размер и перемещать блок.";
        }
        if (entityKind === "image") {
          return "Можно заменить файл, поправить alt и перемещать/масштабировать мышкой на холсте.";
        }
        if (entityKind === "video") {
          return `Проверьте источник и размер блока. Точные HTML-правки доступны в ${getComplexityModeDisplayLabel("advanced")}.`;
        }
        if (entityKind === "slide-root") {
          return "Выбран весь слайд. Справа доступны безопасные настройки слайда и действия без изменения каркаса.";
        }
        if (entityKind === "protected") {
          return "Это системный контейнер. Доступны только безопасные правки, а опасные structural-операции скрыты.";
        }
        if (entityKind === "container" || entityKind === "element") {
          return "Можно перемещать и масштабировать мышкой. Кликните внутрь, чтобы выбрать дочерний элемент.";
        }
        return "Доступны частые действия, базовые стили и безопасные правки содержимого без ручного редактирования HTML.";
      }

      function syncWorkspaceStateUi(hasPresentation, hasSelection) {
        if (!els.workspaceStateBadge) return;
        const meta = getWorkspaceStateMeta(hasPresentation, hasSelection);
        els.workspaceStateBadge.textContent = meta.label;
        els.workspaceStateBadge.className = meta.className;
        els.workspaceStateBadge.title = meta.title;
      }

      function syncDocumentMetaUi(hasPresentation) {
        if (!hasPresentation) {
          // [v2.1.0-pre / ADR-031, A3-#1] No trailing period — this is a label,
          // not a sentence; matches HTML default + onboarding.js copy.
          els.documentMeta.textContent =
            "Откройте HTML-презентацию";
          return;
        }
        const lifecycleMeta = getPreviewLifecycleMeta(state.previewLifecycle);
        const parts = [state.sourceLabel || "Документ"];
        if (state.engine && state.engine !== "unknown")
          parts.push(`движок: ${state.engine}`);
        if (state.previewLifecycle !== "ready") parts.push(lifecycleMeta.label.toLowerCase());
        if (state.assetFileCount) parts.push(`assets: ${state.assetFileCount}`);
        if ((state.previewAssetAuditCounts?.resolved || 0) > 0)
          parts.push(`resolved: ${state.previewAssetAuditCounts.resolved}`);
        if ((state.previewAssetAuditCounts?.baseUrlDependent || 0) > 0)
          parts.push(`base-url: ${state.previewAssetAuditCounts.baseUrlDependent}`);
        if ((state.previewAssetAuditCounts?.unresolved || 0) > 0)
          parts.push(`unresolved: ${state.previewAssetAuditCounts.unresolved}`);
        els.documentMeta.textContent = parts.join(" • ");
      }

      function syncPreviewLifecycleUi(hasPresentation) {
        const meta = getPreviewLifecycleMeta(
          hasPresentation ? state.previewLifecycle : "idle",
        );
        if (els.previewLifecyclePill) {
          els.previewLifecyclePill.textContent = meta.label;
          els.previewLifecyclePill.className = meta.className;
          els.previewLifecyclePill.title = meta.title;
        }
        if (els.reloadPreviewBtn) {
          els.reloadPreviewBtn.disabled = !hasPresentation;
          const recovering =
            hasPresentation &&
            ["recovering", "bridge-degraded", "desync-suspected"].includes(
              state.previewLifecycle,
            );
          els.reloadPreviewBtn.textContent = recovering
            ? "Восстановить превью"
            : "Обновить превью";
          els.reloadPreviewBtn.title = recovering
            ? "Пересоздать iframe и восстановить связь с превью"
            : "Пересоздать iframe и обновить живое превью";
        }
      }

      function syncMobileRailUi(hasPresentation) {
        if (els.mobileSlidesBtn)
          els.mobileSlidesBtn.disabled = !hasPresentation;
        if (els.mobileInspectorBtn)
          els.mobileInspectorBtn.disabled = !hasPresentation;
        if (els.mobileInsertBtn) {
          els.mobileInsertBtn.disabled =
            !hasPresentation || !state.previewReady || state.mode !== "edit";
          setToggleButtonState(
            els.mobileInsertBtn,
            Boolean(isInsertPaletteOpen()),
          );
        }
        setToggleButtonState(els.mobilePreviewBtn, state.mode === "preview");
        if (els.mobileEditBtn) {
          els.mobileEditBtn.disabled =
            !hasPresentation || !state.editingSupported;
          setToggleButtonState(els.mobileEditBtn, state.mode === "edit");
        }
      }

      function getEditorialActiveSlideSummaryLabel() {
        const activeSlideIndex = getSlideIndexById(state.activeSlideId);
        if (activeSlideIndex < 0 || !state.slides.length) {
          return "Слайд не выбран";
        }
        const activeSlide = state.slides[activeSlideIndex] || {};
        const title = String(activeSlide.title || "")
          .trim()
          .replace(/\s+/g, " ");
        return title
          ? `Слайд ${activeSlideIndex + 1} из ${state.slides.length}: ${title}`
          : `Слайд ${activeSlideIndex + 1} из ${state.slides.length}`;
      }

      function getEditorialPreviewStatusSummary(hasPresentation, hasSelection) {
        if (!hasPresentation) {
          return "Стартовый экран";
        }

        switch (state.previewLifecycle) {
          case "loading":
            return "Превью запускается";
          case "recovering":
            return "Идёт восстановление";
          case "bridge-degraded":
            return "Потеряна связь";
          case "desync-suspected":
            return "Нужна синхронизация";
          default:
            if (state.mode === "edit") {
              if (!hasSelection) {
                return "Ждёт выбор";
              }
              if (isCompactShell()) {
                return getSelectionPrimarySurface() === "toolbar"
                  ? "Действия готовы"
                  : "Элемент выбран";
              }
              return "Элемент выбран";
            }
            return "Готово к проверке";
        }
      }

      function getPreviewNoteTitle(hasPresentation, hasSelection) {
        if (!hasPresentation) {
          return "Откройте HTML и запустите превью";
        }
        switch (state.previewLifecycle) {
          case "loading":
            return "Поднимаем живое превью";
          case "recovering":
            return "Восстанавливаем shell";
          case "bridge-degraded":
            return "Связь с превью потеряна";
          case "desync-suspected":
            return "Нужно пересобрать превью";
          default:
            if (state.mode === "preview") {
              return "Проверьте текущий слайд";
            }
            return hasSelection
              ? "Редактируйте выбранный элемент"
              : "Выберите элемент для правки";
        }
      }

      function syncEditorialPreviewCopyUi(hasPresentation, hasSelection) {
        const lifecycleMeta = getPreviewLifecycleMeta(
          hasPresentation ? state.previewLifecycle : "idle",
        );
        const resolvedAssetCount = state.previewAssetAuditCounts?.resolved || 0;
        const unresolvedAssetCount =
          state.previewAssetAuditCounts?.unresolved || 0;
        const baseUrlDependentCount =
          state.previewAssetAuditCounts?.baseUrlDependent || 0;
        const manualBaseUrl = getManualBaseUrl();

        const setPreviewAssistAction = (config = null) => {
          // P0-04 (WO-24): when unresolved assets are present, always keep the
          // "Подключить папку ресурсов" action visible, even after modal close.
          // This overrides any null/cleared config so the button persists.
          if ((!config?.action || !config?.label) && (state.unresolvedPreviewAssets?.length || 0) > 0) {
            config = { action: "assets", label: "Подключить папку ресурсов" };
          }
          if (!els.previewAssistActionBtn) return;
          if (!config?.action || !config?.label) {
            els.previewAssistActionBtn.hidden = true;
            els.previewAssistActionBtn.dataset.action = "";
            els.previewAssistActionBtn.textContent = "";
            return;
          }
          els.previewAssistActionBtn.hidden = false;
          els.previewAssistActionBtn.dataset.action = config.action;
          els.previewAssistActionBtn.textContent = config.label;
        };

        if (els.previewNoteTitle) {
          els.previewNoteTitle.textContent = getPreviewNoteTitle(
            hasPresentation,
            hasSelection,
          );
        }

        if (!hasPresentation) {
          setPreviewAssistAction(null);
          els.previewModeLabel.textContent =
            "Загрузите HTML для предпросмотра.";
          els.previewNoteText.textContent =
            "Файл откроется в iframe без упрощений.";
          els.inspectorHelp.textContent =
            "Сначала загрузите HTML, затем переходите к проверке и правке.";
          return;
        }

        if (state.mode === "preview") {
          els.previewModeLabel.textContent =
            "Сначала проверьте текущий слайд в живом превью.";
          if (state.previewLifecycle !== "ready") {
            setPreviewAssistAction(null);
            els.previewNoteText.textContent = lifecycleMeta.previewCopy;
          } else if (unresolvedAssetCount > 0) {
            setPreviewAssistAction({
              action: "assets",
              label: "Подключить папку ресурсов",
            });
            els.previewNoteText.textContent =
              `Подключите папку проекта: не хватает ресурсов (${unresolvedAssetCount}).`;
          } else if (baseUrlDependentCount > 0) {
            setPreviewAssistAction(
              manualBaseUrl
                ? null
                : {
                    action: "base",
                    label: "Указать Base URL",
                  },
            );
            els.previewNoteText.textContent = manualBaseUrl
              ? `Base URL нужен для ${baseUrlDependentCount} ресурсов.`
              : "Для export укажите Base URL.";
          } else if (state.assetFileCount) {
            setPreviewAssistAction(null);
            els.previewNoteText.textContent =
              `Папка ресурсов подключена: подтверждено ссылок — ${resolvedAssetCount}.`;
          } else {
            setPreviewAssistAction(null);
            els.previewNoteText.textContent =
              "Проверьте слайд и начните правку.";
          }
          els.inspectorHelp.textContent =
            "Если всё выглядит верно, нажмите «Начать редактирование».";
          return;
        }

        els.previewModeLabel.textContent =
          "Режим правки: выбирайте элемент и меняйте его без перезагрузки.";
        if (state.previewLifecycle !== "ready") {
          setPreviewAssistAction(null);
          els.previewNoteText.textContent = lifecycleMeta.editCopy;
        } else if (unresolvedAssetCount > 0) {
          setPreviewAssistAction({
            action: "assets",
            label: "Подключить папку ресурсов",
          });
          els.previewNoteText.textContent =
            `Подключите папку проекта: не хватает ресурсов (${unresolvedAssetCount}).`;
        } else if (baseUrlDependentCount > 0) {
          setPreviewAssistAction(
            manualBaseUrl
              ? {
                  action: "assets",
                  label: "Подключить папку ресурсов",
                }
              : {
                  action: "base",
                  label: "Указать Base URL",
                },
          );
          els.previewNoteText.textContent = manualBaseUrl
            ? "Для export нужна папка проекта."
            : "Для export укажите Base URL.";
        } else if (state.assetFileCount) {
          setPreviewAssistAction(null);
          els.previewNoteText.textContent =
            `Папка ресурсов подключена: подтверждено ссылок — ${resolvedAssetCount}.`;
        } else if (hasSelection) {
          setPreviewAssistAction(null);
          els.previewNoteText.textContent =
            "Правки применяются сразу в превью.";
        } else {
          setPreviewAssistAction(null);
          els.previewNoteText.textContent = "Выберите элемент на слайде.";
        }
        els.inspectorHelp.textContent = getSelectionGuidanceCopy(hasSelection);
      }

      function syncPreviewStatusSummaryUi(hasPresentation, hasSelection) {
        if (!els.previewStatusSummary) return;
        els.previewStatusSummary.textContent = getEditorialPreviewStatusSummary(
          hasPresentation,
          hasSelection,
        );
        els.previewStatusSummary.title = getEditorialActiveSlideSummaryLabel();
      }

      function syncShellChromeUi(hasPresentation, hasSelection, canInsertNow) {
        syncPrimaryActionUi(hasPresentation, hasSelection, canInsertNow);
        syncDocumentMetaUi(hasPresentation);
        syncPreviewLifecycleUi(hasPresentation);
        if (els.reloadPreviewBtn && hasPresentation) {
          const recovering = [
            "recovering",
            "bridge-degraded",
            "desync-suspected",
          ].includes(state.previewLifecycle);
          els.reloadPreviewBtn.textContent = recovering
            ? "Восстановить"
            : "Обновить";
        }
        syncWorkspaceStateUi(hasPresentation, hasSelection);
        syncMobileRailUi(hasPresentation);
        syncEditorialPreviewCopyUi(hasPresentation, hasSelection);
        syncPreviewStatusSummaryUi(hasPresentation, hasSelection);
      }

      function syncEmptyPreviewUi(hasPresentation) {
        if (hasPresentation) return;
        setPreviewLoading(false);
        els.previewFrame.classList.add("hidden");
        els.emptyState.classList.remove("hidden");
        closeShellPanels();
      }

      function refreshUi() {
        applyComplexityModeUi();
        updateInspectorFromSelection();
        const hasPresentation = Boolean(state.modelDoc);
        const hasSelection = Boolean(
          state.selectedNodeId && state.mode === "edit",
        );
        const canInsertNow = Boolean(hasPresentation && state.previewReady);
        syncEditorWorkflowUi(hasPresentation);

        syncShellChromeUi(hasPresentation, hasSelection, canInsertNow);
        syncInspectorWorkflowSections(hasPresentation, hasSelection);
        syncInspectorEntitySections(hasSelection);
        syncSlideSectionUi(hasPresentation);
        updateAssetDirectoryStatus();

        if (!hasPresentation || state.mode !== "edit") closeInsertPalette();
        if (!hasPresentation || !canUseStaticSlideModel()) closeSlideTemplateBar();
        syncEmptyPreviewUi(hasPresentation);
        syncInteractionModeFromState();
        syncEditorialPreviewCopyUi(hasPresentation, hasSelection);

        updateDiagnostics();
        applyShellPanelState();
        scheduleShellChromeMetrics();
        scheduleShellPopoverLayout();
        positionFloatingToolbar();
        renderSelectionOverlay();
      }

      /* ======================================================================
       [SCRIPT 06] history + autosave + export + diagnostics
       ====================================================================== */

      // stripHeavyDataUris(str) — replaces inline data:image/... URIs whose
      // encoded length exceeds 1024 characters with the sentinel string
      // '[data-uri-stripped]'.  All HTML structure, text, and non-image
      // attributes are preserved intact.  Used by the light-snapshot fallback
      // so that structural autosave survives even when base64 images would push
      // the payload beyond the sessionStorage quota.
      // (AUDIT-D-05, WO-04)
      function stripHeavyDataUris(str) {
        // Matches data:image/... URIs inside attribute values (quoted) or plain
        // text.  The regex is intentionally conservative: it captures only the
        // image/* subtype to avoid stripping SVG/font data URIs that are part
        // of the deck structure.
        return str.replace(
          /data:image\/[^;,\s"']{0,64};base64,[A-Za-z0-9+/=]{1024,}/g,
          '[data-uri-stripped]',
        );
      }

      // isStorageQuotaError(err) — returns true only for DOMException quota
      // errors.  Non-quota errors (e.g., "Access is denied" in private mode,
      // test-injected forced throws) are NOT quota errors and must bubble to
      // the outer catch so addDiagnostic('autosave-failed:') fires normally.
      // (AUDIT-D-05, WO-04)
      function isStorageQuotaError(err) {
        if (!(err instanceof DOMException)) return false;
        // Standard name: 'QuotaExceededError' (Chrome, Firefox, Safari).
        // Legacy code: 22 (QUOTA_EXCEEDED_ERR in older specs).
        return err.name === 'QuotaExceededError' || err.code === 22;
      }

      function saveProjectToLocalStorage() {
        if (!state.modelDoc) return;
        try {
          const payload = {
            version: 3,
            savedAt: Date.now(),
            sourceLabel: state.sourceLabel,
            manualBaseUrl: getManualBaseUrl(),
            mode: normalizeEditorMode(state.mode),
            activeSlideIndex: Math.max(
              0,
              state.slides.findIndex(
                (slide) => slide.id === state.activeSlideId,
              ),
            ),
            html: serializeCurrentProject(),
          };

          // --- Size-tier logic (AUDIT-D-05, WO-04) -------------------------
          // Serialize the payload once to measure its size before writing to
          // sessionStorage.  This avoids double-serialization on the happy
          // path: we reuse the string for the actual setItem call.
          const raw = JSON.stringify(payload);

          if (raw.length > AUTOSAVE_FAIL_BYTES) {
            // Fail-tier: strip heavy inline data-URIs, tag as light snapshot.
            const lightPayload = Object.assign({}, payload, {
              html: stripHeavyDataUris(payload.html),
              autosaveTag: AUTOSAVE_LIGHT_TAG,
            });
            const lightRaw = JSON.stringify(lightPayload);
            try {
              getAutosaveStorage().setItem(STORAGE_KEY, lightRaw);
              state.lastSavedAt = payload.savedAt;
              showToast(
                'Автосохранение: изображения временно пропущены из-за размера.',
                'warning',
                { title: 'Автосохранение' },
              );
              refreshUi();
            } catch (innerErr) {
              if (!isStorageQuotaError(innerErr)) throw innerErr;
              // Double-fail: even the stripped payload exceeds quota.
              addDiagnostic('autosave-quota-exceeded');
              showToast(
                'Автосохранение недоступно — хранилище переполнено.',
                'error',
                { title: 'Автосохранение' },
              );
            }
            return;
          }

          if (raw.length > AUTOSAVE_WARN_BYTES) {
            // Warn-tier: write normally but surface a heads-up toast.
            try {
              getAutosaveStorage().setItem(STORAGE_KEY, raw);
              state.lastSavedAt = payload.savedAt;
              showToast(
                'Автосохранение близко к лимиту хранилища.',
                'warning',
                { title: 'Автосохранение' },
              );
              refreshUi();
            } catch (innerErr) {
              if (!isStorageQuotaError(innerErr)) throw innerErr;
              // Quota hit despite raw.length being in the warn zone (browser
              // quota varies); fall back to light snapshot.
              const lightPayload = Object.assign({}, payload, {
                html: stripHeavyDataUris(payload.html),
                autosaveTag: AUTOSAVE_LIGHT_TAG,
              });
              try {
                getAutosaveStorage().setItem(STORAGE_KEY, JSON.stringify(lightPayload));
                state.lastSavedAt = payload.savedAt;
                showToast(
                  'Автосохранение: изображения временно пропущены из-за размера.',
                  'warning',
                  { title: 'Автосохранение' },
                );
                refreshUi();
              } catch (doubleErr) {
                if (!isStorageQuotaError(doubleErr)) throw doubleErr;
                addDiagnostic('autosave-quota-exceeded');
                showToast(
                  'Автосохранение недоступно — хранилище переполнено.',
                  'error',
                  { title: 'Автосохранение' },
                );
              }
            }
            return;
          }

          // Normal-tier: no size concerns.
          try {
            getAutosaveStorage().setItem(STORAGE_KEY, raw);
            state.lastSavedAt = payload.savedAt;
            refreshUi();
          } catch (innerErr) {
            if (!isStorageQuotaError(innerErr)) throw innerErr;
            // Unexpected quota hit (very small deck but storage already full).
            // Retry with light snapshot before giving up.
            const lightPayload = Object.assign({}, payload, {
              html: stripHeavyDataUris(payload.html),
              autosaveTag: AUTOSAVE_LIGHT_TAG,
            });
            try {
              getAutosaveStorage().setItem(STORAGE_KEY, JSON.stringify(lightPayload));
              state.lastSavedAt = payload.savedAt;
              showToast(
                'Автосохранение: изображения временно пропущены из-за размера.',
                'warning',
                { title: 'Автосохранение' },
              );
              refreshUi();
            } catch (doubleErr) {
              if (!isStorageQuotaError(doubleErr)) throw doubleErr;
              addDiagnostic('autosave-quota-exceeded');
              showToast(
                'Автосохранение недоступно — хранилище переполнено.',
                'error',
                { title: 'Автосохранение' },
              );
            }
          }
          // ------------------------------------------------------------------
        } catch (error) {
          addDiagnostic(`autosave-failed: ${error.message}`);
        }
      }

      // =====================================================================
      // ZONE: History Budget Chip (WO-18)
      // Renders <span class="history-budget-chip" ...>N/20</span> in the topbar.
      // Visible when patches >= 5; color thresholds: 15-18 = is-warning, 19-20 = is-danger.
      // Subscribes to store 'history' slice so it re-renders on every patch commit.
      // =====================================================================
      function renderHistoryBudgetChip() {
        var chip = els.historyBudgetChip;
        if (!chip) return;
        var histSlice = window.store.get("history");
        var count = histSlice.patches.length;
        var limit = histSlice.limit || HISTORY_LIMIT;

        // Hide when < 5 steps (not worth showing the counter)
        if (count < 5) {
          chip.hidden = true;
          chip.removeAttribute("aria-label");
          return;
        }

        chip.hidden = false;
        chip.textContent = count + "/" + limit;
        chip.setAttribute("aria-label", count + "/" + limit + " шагов истории");

        // Color thresholds
        chip.classList.remove("is-warning", "is-danger");
        if (count >= 19) {
          chip.classList.add("is-danger");
        } else if (count >= 15) {
          chip.classList.add("is-warning");
        }
      }

      // Subscribe to history slice so the chip re-renders on any patch commit.
      // Subscription is set up once at parse time (classic-script: this runs synchronously
      // after store.js + state.js have already run and defined the 'history' slice).
      if (window.store) {
        window.store.subscribe("history", function () {
          renderHistoryBudgetChip();
        });
      }
