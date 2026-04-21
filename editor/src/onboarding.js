      // ZONE: Shell Onboarding
      // Novice empty-state UX, starter deck, first-time guidance surfaces
      // =====================================================================
      function ensureNoviceShellOnboardingUi() {
        if (els.topbarOverflowBtn) {
          els.topbarOverflowBtn.setAttribute("aria-label", "Дополнительные команды");
          els.topbarOverflowBtn.title = "Ещё действия";
        }
        if (els.topbarOverflowMenu) {
          els.topbarOverflowMenu.setAttribute(
            "aria-label",
            "Дополнительные команды",
          );
        }
        if (els.toggleSlideTemplateBarBtn) {
          els.toggleSlideTemplateBarBtn.textContent = "Новый слайд";
        }
        if (els.reloadPreviewBtn && !state.modelDoc) {
          els.reloadPreviewBtn.textContent = "↻ Обновить";
        }
        if (els.toggleInsertPaletteBtn && !isInsertPaletteOpen()) {
          els.toggleInsertPaletteBtn.textContent = "➕ Добавить блок";
        }
        if (els.emptyState) {
          if (els.emptyStateTitle) {
            els.emptyStateTitle.textContent = "Откройте HTML-презентацию";
          }
          if (els.emptyStateLead) {
            els.emptyStateLead.textContent =
              "Редактор открывает файл напрямую — без конвертации. После загрузки можно сразу переходить к правке.";
          }
          if (els.emptyStateFootnote) {
            els.emptyStateFootnote.textContent =
              "Если в презентации есть картинки, CSS или видео с относительными путями — подключите папку проекта.";
          }
          const emptyPasteBtn =
            document.getElementById("emptyPasteBtn");
          if (emptyPasteBtn instanceof HTMLButtonElement) {
            emptyPasteBtn.textContent = "Вставить из буфера";
          }
          els.emptyPasteBtn = emptyPasteBtn || els.emptyPasteBtn;
          if (els.emptyOpenBtn) {
            els.emptyOpenBtn.textContent = "Открыть HTML";
          }
          if (els.emptyStarterDeckBtn) {
            els.emptyStarterDeckBtn.textContent = "Попробовать на примере";
            els.emptyStarterDeckBtn.setAttribute("aria-label", "Открыть стартовый пример");
          }
        }
        bindEmptyStateDisclosure();
        if (els.openHtmlModal) {
          const warning = els.openHtmlModal.querySelector(".warning-box");
          if (warning) {
            warning.innerHTML =
              'Редактор открывает HTML как отдельный документ в <code>iframe</code> и сохраняет его скрипты. Используйте этот режим только для доверенных файлов.';
          }
          const uploadBoxes = Array.from(
            els.openHtmlModal.querySelectorAll(".upload-box"),
          );
          const fileBox = uploadBoxes[0];
          const pasteBox = uploadBoxes[1];
          const assetsBox = uploadBoxes[2];
          if (fileBox) {
            const heading = fileBox.querySelector("h4");
            const text = fileBox.querySelector("p");
            if (heading) heading.textContent = "Шаг 1. Выберите HTML-файл";
            if (text) {
              text.innerHTML =
                'Основной путь: выберите локальный <code>presentation.html</code> или другой HTML-файл презентации.';
            }
          }
          if (pasteBox) {
            const heading = pasteBox.querySelector("h4");
            const text = pasteBox.querySelector("p");
            if (heading) heading.textContent = "Или вставьте HTML";
            if (text) {
              text.textContent =
                "Используйте этот вариант, если HTML уже сгенерирован и лежит в буфере обмена.";
            }
          }
          if (assetsBox) {
            const text = assetsBox.querySelector("p");
            if (text) {
              text.innerHTML =
                "Если презентация ссылается на относительные <code>css/js/img/video</code>, выберите папку проекта или <code>assets</code>. В Chromium-based браузерах можно выбрать папку целиком: так превью точнее восстановит ресурсы.";
            }
          }
          if (els.loadPastedHtmlBtn) {
            els.loadPastedHtmlBtn.className = "ghost-btn";
          }
        }
      }

      function bindEmptyStateDisclosure() {
        const toggleBtn = document.getElementById("emptyMoreToggleBtn");
        const panel = document.getElementById("emptyMorePanel");
        const pasteBtn = document.getElementById("emptyPasteBtn");
        if (!(toggleBtn instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) {
          return;
        }
        toggleBtn.addEventListener("click", function handleDisclosureToggle() {
          const isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
          const nowExpanded = !isExpanded;
          if (nowExpanded) {
            panel.removeAttribute("hidden");
            toggleBtn.setAttribute("aria-expanded", "true");
            toggleBtn.textContent = "Дополнительно ▴";
            if (pasteBtn instanceof HTMLButtonElement) {
              pasteBtn.focus();
            }
          } else {
            panel.setAttribute("hidden", "");
            toggleBtn.setAttribute("aria-expanded", "false");
            toggleBtn.textContent = "Дополнительно ▾";
          }
        });
      }

      function ensureNoviceSummaryStructure() {
        const reorderSummaryCard = (section, cardId) => {
          if (!(section instanceof HTMLElement)) return;
          const heading = section.querySelector("h3");
          const card = document.getElementById(cardId);
          if (!(heading instanceof HTMLElement) || !(card instanceof HTMLElement)) return;
          if (heading.nextElementSibling !== card) {
            heading.insertAdjacentElement("afterend", card);
          }
        };

        reorderSummaryCard(els.currentElementSection, "selectedElementSummaryCard");
        reorderSummaryCard(els.currentSlideSection, "currentSlideSummaryCard");

        if (els.currentSlideSection && !els.currentSlideEditorControls) {
          const badgeRow = els.currentSlideSection.querySelector(".badge-row");
          if (badgeRow instanceof HTMLElement) {
            const wrapper = document.createElement("div");
            wrapper.id = "currentSlideEditorControls";
            let next = badgeRow.nextSibling;
            while (next) {
              const node = next;
              next = next.nextSibling;
              wrapper.appendChild(node);
            }
            els.currentSlideSection.appendChild(wrapper);
            els.currentSlideEditorControls = wrapper;
          }
        }

        els.previewPrimaryActionBtn =
          els.previewPrimaryActionBtn || document.getElementById("previewPrimaryActionBtn");
        els.selectedElementSummaryCard =
          els.selectedElementSummaryCard || document.getElementById("selectedElementSummaryCard");
        els.selectedElementTitle =
          els.selectedElementTitle || document.getElementById("selectedElementTitle");
        els.selectedElementSummary =
          els.selectedElementSummary || document.getElementById("selectedElementSummary");
        els.selectedElementQuickActions =
          els.selectedElementQuickActions || document.getElementById("selectedElementQuickActions");
        els.currentSlideSummaryCard =
          els.currentSlideSummaryCard || document.getElementById("currentSlideSummaryCard");
        els.currentSlideTitleDisplay =
          els.currentSlideTitleDisplay || document.getElementById("currentSlideTitleDisplay");
        els.currentSlideSummaryText =
          els.currentSlideSummaryText || document.getElementById("currentSlideSummaryText");
      }


      // init — точка старта shell-приложения. Здесь мы намеренно разделяем
      // bind/init-блоки по зонам ответственности: top bar, inspector, bridge,
      // UX-надстройки, autosave/restore.

      // ====================================================================
      // Верхняя панель: загрузка HTML, экспорт, история, тема, режимы.
      // ====================================================================

      // bindInspectorActions — связывает правую панель, floating toolbar и общие
      // действия над элементом. Почти все операции делегируются в bridge, чтобы
      // сначала изменялся живой DOM iframe, а затем модель синхронизировалась обратно.
      // =====================================================================
