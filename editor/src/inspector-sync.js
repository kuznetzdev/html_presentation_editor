// inspector-sync.js  (view layer)
// Layer: Inspector View
// Reads shell state and updates the right-panel inspector UI.
// Modal/overlay logic → shell-overlays.js
// Bootstrap/theme/bind → boot.js
//
      // ZONE: Inspector Sync
      // Primary + legacy paths that read state.selectedComputed → populate all inspector fields
      // =====================================================================
      function syncInspectorEntitySections(hasSelection) {
        const kind = getSelectedEntityKindForUi();
        const selectionPolicyVisible =
          hasSelection &&
          Boolean(
            state.selectedPolicy &&
              (state.selectedPolicy.kind !== "free" || state.selectedPolicy.reason),
          );
        const visibleKindsBySection = new Map([
          [
            els.elementActionsSection,
            new Set([
              "text",
              "image",
              "video",
              "container",
              "element",
              "slide-root",
              "table",
              "table-cell",
              "code-block",
              "svg",
              "fragment",
            ]),
          ],
          [els.textInspectorSection, new Set(["text", "table-cell", "code-block"])],
          [
            els.geometryInspectorSection,
            new Set([
              "text",
              "image",
              "video",
              "container",
              "element",
              "table",
              "table-cell",
              "code-block",
              "svg",
              "fragment",
            ]),
          ],
          [els.tableInspectorSection, new Set(["table", "table-cell"])],
          [
            els.appearanceInspectorSection,
            new Set([
              "text",
              "image",
              "video",
              "container",
              "element",
              "table",
              "table-cell",
              "code-block",
              "svg",
              "fragment",
            ]),
          ],
          [els.imageSection, new Set(["image", "video"])],
          [els.selectionPolicySection, new Set()],
        ]);
        visibleKindsBySection.forEach((visibleKinds, section) => {
          if (!section) return;
          let visible =
            section === els.selectionPolicySection
              ? selectionPolicyVisible
              : hasSelection && visibleKinds.has(kind);
          if (section === els.geometryInspectorSection) {
            visible =
              visible &&
              (state.complexityMode === "advanced" ||
                hasBlockedDirectManipulationContext());
          }
          setInspectorSectionVisibility(section, visible);
        });
      }

      function syncInspectorWorkflowSections(hasPresentation, hasSelection) {
        const workflow = state.editorWorkflow || getEditorWorkflowState();
        const showSlideSummary =
          hasPresentation &&
          (workflow === "loaded-preview" ||
            (workflow === "loaded-edit" && !hasSelection));
        const showSelectionCard =
          hasPresentation && workflow === "loaded-edit" && hasSelection;
        const showInsertCard =
          hasPresentation &&
          workflow === "loaded-edit" &&
          !hasSelection &&
          state.previewReady;

        setInspectorSectionVisibility(els.currentSlideSection, showSlideSummary);
        setInspectorSectionVisibility(
          els.currentElementSection,
          showSelectionCard,
        );
        setInspectorSectionVisibility(els.insertSection, showInsertCard);
        setBlockVisibility(
          els.currentSlideEditorControls,
          showSlideSummary &&
            !(
              workflow === "loaded-preview" &&
              state.complexityMode === "basic"
            ),
        );
      }

      function syncSlidePresetActionUi(canEditSlides, currentSlide) {
        if (!els.slidePresetSelect) return;
        const selectedPreset = String(els.slidePresetSelect.value || "").trim();
        if (els.applySlidePresetBtn) {
          const presetLabel = getSlidePresetLabel(selectedPreset);
          els.applySlidePresetBtn.disabled =
            !canEditSlides || !currentSlide || !selectedPreset;
          els.applySlidePresetBtn.textContent = presetLabel
            ? `Применить ${presetLabel}`
            : "Применить preset";
          els.applySlidePresetBtn.title = selectedPreset
            ? "Заменить содержимое текущего слайда выбранным preset. Undo вернёт прошлую версию."
            : "Сначала выбери preset для текущего слайда.";
        }
      }

      function syncSlideSectionUi(hasPresentation) {
        const workflow = state.editorWorkflow || getEditorWorkflowState();
        const canUseSlides = canUseStaticSlideModel();
        const canEditSlides =
          canUseSlides && state.mode === "edit" && state.editingSupported;
        const currentSlide = getCurrentSlideModelNode();
        const slideIndex = state.slides.findIndex(
          (slide) => slide.id === state.activeSlideId,
        );
        const currentSlideMeta =
          slideIndex >= 0
            ? state.slides.find((slide) => slide.id === state.activeSlideId) || null
            : null;
        const badgeTags = buildSlideMetaTags(currentSlideMeta, currentSlide);
        if (els.currentSlideMetaBadge) {
          els.currentSlideMetaBadge.textContent =
            slideIndex >= 0
              ? `слайд ${slideIndex + 1} / ${state.slides.length}${badgeTags.length ? ` • ${badgeTags.join(" • ")}` : ""}`
              : "слайд: —";
        }
        if (els.currentSlideTitleDisplay) {
          const fallbackTitle =
            slideIndex >= 0 ? `Слайд ${slideIndex + 1}` : "Слайд не выбран";
          const explicitTitle = String(
            getSlideTitleOverride(currentSlide) ||
              currentSlideMeta?.title ||
              currentSlide?.getAttribute?.("data-slide-title") ||
              "",
          ).trim();
          els.currentSlideTitleDisplay.textContent = explicitTitle || fallbackTitle;
        }
        if (els.currentSlideSummaryText) {
          if (!hasPresentation || slideIndex < 0) {
            els.currentSlideSummaryText.textContent =
              "Откройте презентацию и выберите слайд, чтобы увидеть его контекст и дальнейшие действия.";
          } else if (workflow === "loaded-preview" && state.complexityMode === "basic") {
            els.currentSlideSummaryText.textContent =
              "Слайд открыт в безопасном режиме просмотра. Проверьте содержимое и нажмите «Начать редактирование», когда будете готовы к правкам.";
          } else if (state.mode === "edit") {
            els.currentSlideSummaryText.textContent =
              "Здесь можно менять имя слайда, фон, отступы и безопасные пресеты без ручного редактирования HTML.";
            } else {
              els.currentSlideSummaryText.textContent =
                "Слайд уже распознан. При необходимости можно перейти в режим «Точно» для полного инспектора и HTML.";
            }
          }
        if (els.slideTitleOverrideInput) {
          els.slideTitleOverrideInput.value = getSlideTitleOverride(currentSlide);
          els.slideTitleOverrideInput.disabled = !canEditSlides || !currentSlide;
        }
        if (els.slideBgColorInput) {
          const rawColor =
            currentSlide?.style?.backgroundColor ||
            currentSlide?.getAttribute("data-slide-bg") ||
            "#ffffff";
          els.slideBgColorInput.value = rgbToHex(rawColor || "#ffffff");
          els.slideBgColorInput.disabled = !canEditSlides || !currentSlide;
        }
        if (els.slidePaddingPresetSelect) {
          els.slidePaddingPresetSelect.value = getSlidePaddingPreset(currentSlide);
          els.slidePaddingPresetSelect.disabled = !canEditSlides || !currentSlide;
        }
        if (els.slidePresetSelect) {
          els.slidePresetSelect.value =
            currentSlideMeta?.preset || getSlidePresetValue(currentSlide);
          els.slidePresetSelect.disabled = !canEditSlides || !currentSlide;
        }
        syncSlidePresetActionUi(canEditSlides, currentSlide);
        if (els.duplicateCurrentSlideBtn) {
          els.duplicateCurrentSlideBtn.disabled = !canEditSlides || !currentSlide;
        }
        if (els.deleteCurrentSlideBtn) {
          els.deleteCurrentSlideBtn.disabled =
            !canEditSlides || !currentSlide || getStaticSlideModelNodes().length <= 1;
        }
        if (els.validateExportBtn) {
          els.validateExportBtn.disabled = !hasPresentation;
        }
        if (els.toggleSlideTemplateBarBtn) {
          els.toggleSlideTemplateBarBtn.disabled = !canEditSlides;
          els.toggleSlideTemplateBarBtn.title = canEditSlides
            ? "Создать новый слайд из шаблона"
            : canUseSlides
              ? "Переключись в режим редактирования, чтобы работать со слайдами."
              : "Для этого deck нет безопасной статической структуры слайдов.";
        }
      }


      function updateInspectorFromSelectionLegacy() {
        const hasSelection = Boolean(
          state.selectedNodeId && state.mode === "edit",
        );
        els.elementTagInput.value = hasSelection
          ? state.selectedTag || "—"
          : "—";
        els.selectedNodeBadge.textContent = `node: ${hasSelection ? state.selectedNodeId : "—"}`;
        els.selectedSlideBadge.textContent = `slide: ${hasSelection ? state.activeSlideId || "—" : "—"}`;
        const kind = !hasSelection
          ? "—"
          : state.selectedFlags.isSlideRoot
            ? "slide"
            : state.selectedFlags.isImage
              ? "image"
              : state.selectedFlags.isVideo
                ? "video"
                : state.selectedFlags.canEditText
                  ? "text"
                  : state.selectedFlags.isContainer
                    ? "container"
                    : "element";
        els.selectedKindBadge.textContent = `kind: ${kind}`;
        syncInspectorEntitySections(hasSelection);
        if (els.selectionPolicyText && !hasSelection) {
          els.selectionPolicyText.textContent =
            "Выбери элемент, чтобы увидеть ограничения редактирования.";
        }
        // pasteElementBtn is always available when the internal clipboard has content
        if (els.pasteElementBtn) {
          els.pasteElementBtn.disabled = !state.copiedElementHtml || !state.modelDoc || state.mode !== "edit";
        }
        const controls = [
          els.boldBtn,
          els.italicBtn,
          els.underlineBtn,
          els.fontSizeSelect,
          els.textColorInput,
          els.showElementHtmlBtn,
          els.copyElementBtn,
          els.duplicateElementBtn,
          els.deleteElementBtn,
          els.moveElementUpBtn,
          els.moveElementDownBtn,
          els.resetStylesBtn,
          els.copyStyleBtn,
          els.pasteStyleBtn,
          els.elementIdInput,
          els.elementClassInput,
          els.displaySelect,
          els.positionSelect,
          els.zIndexInput,
          els.widthInput,
          els.heightInput,
          els.leftInput,
          els.topInput,
          els.bgColorInput,
          els.borderColorInput,
          els.borderStyleSelect,
          els.borderWidthInput,
          els.marginInput,
          els.paddingInput,
          els.opacityInput,
          els.borderRadiusInput,
          els.editTextBtn,
          els.insertTableRowAboveBtn,
          els.insertTableRowBelowBtn,
          els.deleteTableRowBtn,
          els.insertTableColumnLeftBtn,
          els.insertTableColumnRightBtn,
          els.deleteTableColumnBtn,
          els.imageSrcInput,
          els.applyImageSrcBtn,
          els.imageAltInput,
          els.replaceImageBtn,
          els.fitImageBtn,
          els.copyImageUrlBtn,
          els.openImageBtn,
          els.resetImageSizeBtn,
          els.rotateImageBtn,
          els.flipImageBtn,
          ...els.alignButtons,
        ];
        controls.forEach((control) => {
          if (control) control.disabled = !hasSelection;
        });

        [
          els.ftDeleteBtn,
          els.ftDuplicateBtn,
          els.ftEditTextBtn,
          els.ftReplaceImageBtn,
          els.ftCopyStyleBtn,
          els.ftPasteStyleBtn,
          els.ftCopyImageUrlBtn,
          els.ftMediaUrlBtn,
          els.ftFitImageBtn,
          els.ftBoldBtn,
          els.ftItalicBtn,
          els.ftColorInput,
          els.ftFontSizeSelect,
        ].forEach((control) => {
          if (control) control.disabled = !hasSelection;
        });

        if (els.currentSlideMetaBadge) {
          const slideIndex = state.slides.findIndex(
            (slide) => slide.id === state.activeSlideId,
          );
          els.currentSlideMetaBadge.textContent =
            slideIndex >= 0
              ? `слайд ${slideIndex + 1} / ${state.slides.length}`
              : "слайд: —";
        }
        if (!hasSelection || !state.selectedComputed) {
          els.elementIdInput.value = "";
          els.elementClassInput.value = "";
          els.fontSizeSelect.value = "";
          els.ftFontSizeSelect.value = "";
          if (els.inspectorFontFamilySelect) els.inspectorFontFamilySelect.value = "";
          if (els.inspectorLineHeightSelect) els.inspectorLineHeightSelect.value = "";
          els.textColorInput.value = "#000000";
          els.ftColorInput.value = "#000000";
          els.bgColorInput.value = "#ffffff";
          els.borderColorInput.value = "#000000";
          els.borderStyleSelect.value = "";
          els.displaySelect.value = "";
          els.positionSelect.value = "";
          els.zIndexInput.value = "";
          els.widthInput.value = "";
          els.heightInput.value = "";
          els.leftInput.value = "";
          els.topInput.value = "";
          // [WO-26] Clear transform input on deselect
          { const tEl = document.getElementById("transformInput"); if (tEl) tEl.value = ""; }
          { const rBtn = document.getElementById("resetTransformBtn"); if (rBtn) rBtn.disabled = true; }
          els.marginInput.value = "";
          els.paddingInput.value = "";
          if (els.opacityInput) els.opacityInput.value = "";
          if (els.borderRadiusInput) els.borderRadiusInput.value = "";
          els.imageSrcInput.value = "";
          els.imageAltInput.value = "";
          els.imageSection.style.display = "none";
          if (els.showSlideHtmlBtn)
            els.showSlideHtmlBtn.disabled =
              !state.activeSlideId || !hasStaticSlide(state.activeSlideId);
          if (els.reloadPreviewBtn)
            els.reloadPreviewBtn.disabled = !state.modelDoc;
          const imageAltField = els.imageAltInput?.closest(".field-group");
          if (imageAltField) imageAltField.style.display = "";
          [
            els.replaceImageBtn,
            els.fitImageBtn,
            els.copyImageUrlBtn,
            els.resetImageSizeBtn,
            els.rotateImageBtn,
            els.flipImageBtn,
          ].forEach((btn) => {
            if (btn) btn.style.display = "";
          });
          els.alignButtons.forEach((button) =>
            button.classList.remove("is-active"),
          );
          [
            els.boldBtn,
            els.italicBtn,
            els.underlineBtn,
            els.ftBoldBtn,
            els.ftItalicBtn,
            els.ftUnderlineBtn,
            els.ftAlignLeftBtn,
            els.ftAlignCenterBtn,
            els.ftAlignRightBtn,
          ].forEach((button) => button?.classList.remove("is-active"));
          if (els.ftFontFamilySelect) els.ftFontFamilySelect.value = "";
          if (els.selectionPolicyText) {
            els.selectionPolicyText.textContent =
              "Выбери элемент, чтобы увидеть ограничения редактирования.";
          }
          updateFloatingToolbarContext();
          return;
        }
        const selectionPolicy =
          state.selectedPolicy || createDefaultSelectionPolicy(state.selectedFlags);
        const entityKind = getSelectedEntityKindForUi();
        const canEditRichTextStyles =
          entityKind === "text" || entityKind === "table-cell";
        const canStartPlainTextEditing =
          canEditRichTextStyles || entityKind === "code-block";
        if (els.selectionPolicyText) {
          els.selectionPolicyText.textContent = state.selectedFlags.isSlideRoot
            ? "Выбран корневой контейнер слайда. Для него доступны безопасные стилевые правки и вставка новых блоков внутрь, но destructive structural-операции, resize и удаление заблокированы."
            : state.selectedFlags.isProtected
              ? "Это защищённый системный контейнер deck-framework. Его можно просматривать и в отдельных случаях безопасно стилизовать, но опасные structural-операции и прямые перемещения отключены."
              : hasBlockedDirectManipulationContext()
                ? getDirectManipulationBlockMessage()
                : "Для выбранного элемента ограничений нет.";
        }
        const structuralLocked = !selectionPolicy.canDelete || !selectionPolicy.canDuplicate;
        const styleLocked = !selectionPolicy.canEditStyles;
        const attributeLocked = !selectionPolicy.canEditAttributes;
        const geometryLocked =
          !selectionPolicy.canMove && !selectionPolicy.canResize && !selectionPolicy.canReorder;
        els.elementIdInput.value = state.selectedAttrs.id || "";
        els.elementClassInput.value = state.selectedAttrs.class || "";
        els.elementIdInput.disabled = !hasSelection || attributeLocked;
        els.elementClassInput.disabled = !hasSelection || attributeLocked;
        els.showElementHtmlBtn.disabled =
          !hasSelection || !selectionPolicy.canEditHtml || state.selectedFlags.isSlideRoot;
        els.showSlideHtmlBtn.disabled =
          !state.activeSlideId || !hasStaticSlide(state.activeSlideId);
        els.duplicateElementBtn.disabled = !hasSelection || !selectionPolicy.canDuplicate;
        els.deleteElementBtn.disabled = !hasSelection || !selectionPolicy.canDelete;
        els.moveElementUpBtn.disabled = !hasSelection || !selectionPolicy.canReorder;
        els.moveElementDownBtn.disabled = !hasSelection || !selectionPolicy.canReorder;
        els.resetStylesBtn.disabled = !hasSelection || !selectionPolicy.canEditStyles;
        els.pasteStyleBtn.disabled = !hasSelection || !selectionPolicy.canEditStyles;
        const fontSize = parseInt(state.selectedComputed.fontSize, 10);
        const supportedSizes = ["10","12","14","16","18","20","24","28","32","36","40","48","56","64","72","96"];
        const normalizedSize = supportedSizes.includes(String(fontSize)) ? String(fontSize) : "";
        els.fontSizeSelect.value = normalizedSize;
        els.ftFontSizeSelect.value = normalizedSize;
        // Sync inspector font-family
        if (els.inspectorFontFamilySelect) {
          const rawFam = (state.selectedComputed.fontFamily || "").trim();
          let famMatched = "";
          Array.from(els.inspectorFontFamilySelect.options).forEach((opt) => {
            if (opt.value && rawFam.replace(/['"]/g,"").startsWith(opt.value.split(",")[0].replace(/['"]/g,"").trim())) famMatched = opt.value;
          });
          els.inspectorFontFamilySelect.value = famMatched;
        }
        // Sync inspector line-height
        if (els.inspectorLineHeightSelect) {
          const rawLH = (state.selectedComputed.lineHeight || "").trim();
          const lhNum = parseFloat(rawLH);
          const lhOptions = ["1","1.2","1.3","1.4","1.5","1.6","1.8","2"];
          const lhMatched = lhOptions.find((v) => Math.abs(parseFloat(v) - lhNum) < 0.05) || "";
          els.inspectorLineHeightSelect.value = lhMatched;
        }
        els.textColorInput.value = rgbToHex(
          state.selectedComputed.color || "#000000",
        );
        els.ftColorInput.value = rgbToHex(
          state.selectedComputed.color || "#000000",
        );
        els.bgColorInput.value = rgbToHex(
          state.selectedComputed.backgroundColor || "#ffffff",
        );
        els.borderColorInput.value = rgbToHex(
          state.selectedComputed.borderColor || "#000000",
        );
        els.borderStyleSelect.value = safeSelectValue(
          els.borderStyleSelect,
          state.selectedComputed.borderStyle,
        );
        els.displaySelect.value = safeSelectValue(
          els.displaySelect,
          state.selectedComputed.display,
        );
        els.positionSelect.value = safeSelectValue(
          els.positionSelect,
          state.selectedComputed.position,
        );
        els.zIndexInput.value = sanitizeCssValue(state.selectedComputed.zIndex);
        els.widthInput.value = sanitizeCssValue(state.selectedComputed.width);
        els.heightInput.value = sanitizeCssValue(state.selectedComputed.height);
        els.leftInput.value = sanitizeCssValue(state.selectedComputed.left);
        els.topInput.value = sanitizeCssValue(state.selectedComputed.top);
        // [WO-26] Populate transform input (inline style, not computed — avoid matrix expansion)
        {
          const transformEl = document.getElementById("transformInput");
          const resetBtn = document.getElementById("resetTransformBtn");
          const node = getSelectedModelNode();
          const inlineTransform = node instanceof HTMLElement ? (node.style.transform || "") : "";
          if (transformEl && document.activeElement !== transformEl) {
            transformEl.value = inlineTransform;
          }
          if (transformEl) {
            transformEl.disabled = !state.selectedPolicy?.canEditStyles;
          }
          if (resetBtn) {
            resetBtn.disabled = !state.selectedPolicy?.canEditStyles || !inlineTransform;
          }
        }
        els.marginInput.value = sanitizeCssValue(state.selectedComputed.margin);
        els.paddingInput.value = sanitizeCssValue(
          state.selectedComputed.padding,
        );
        els.borderWidthInput.value = sanitizeCssValue(
          state.selectedComputed.borderWidth,
        );
        if (els.opacityInput) {
          const opRaw = state.selectedComputed.opacity;
          els.opacityInput.value = (!opRaw || opRaw === "1")
            ? "" : String(Math.round(parseFloat(opRaw) * 100));
        }
        if (els.borderRadiusInput) {
          els.borderRadiusInput.value = sanitizeCssValue(state.selectedComputed.borderRadius);
        }
        const alignment = state.selectedComputed.textAlign || "left";
        els.alignButtons.forEach((button) =>
          button.classList.toggle(
            "is-active",
            button.dataset.align === alignment,
          ),
        );
        const boldActive = ["700", "800", "900", "bold"].includes(
          state.selectedComputed.fontWeight,
        );
        const italicActive = state.selectedComputed.fontStyle === "italic";
        const underlineActive = (state.selectedComputed.textDecorationLine || "").includes("underline");
        els.boldBtn.classList.toggle("is-active", boldActive);
        els.ftBoldBtn.classList.toggle("is-active", boldActive);
        els.italicBtn.classList.toggle("is-active", italicActive);
        els.ftItalicBtn.classList.toggle("is-active", italicActive);
        els.underlineBtn.classList.toggle("is-active", underlineActive);
        els.ftUnderlineBtn?.classList.toggle("is-active", underlineActive);
        const ftAlignment = state.selectedComputed.textAlign || "left";
        els.ftAlignLeftBtn?.classList.toggle("is-active",   ftAlignment === "left");
        els.ftAlignCenterBtn?.classList.toggle("is-active", ftAlignment === "center");
        els.ftAlignRightBtn?.classList.toggle("is-active",  ftAlignment === "right");
        if (els.ftFontFamilySelect) {
          const rawFamily = (state.selectedComputed.fontFamily || "").trim();
          let matched = "";
          Array.from(els.ftFontFamilySelect.options).forEach((opt) => {
            if (opt.value && rawFamily.replace(/['"]/g,"").startsWith(opt.value.split(",")[0].replace(/['"]/g,"").trim())) matched = opt.value;
          });
          els.ftFontFamilySelect.value = matched;
        }
        [
          els.boldBtn,
          els.italicBtn,
          els.underlineBtn,
          els.ftUnderlineBtn,
          els.ftAlignLeftBtn,
          els.ftAlignCenterBtn,
          els.ftAlignRightBtn,
          els.ftFontFamilySelect,
          els.inspectorFontFamilySelect,
          els.inspectorLineHeightSelect,
          els.fontSizeSelect,
          els.textColorInput,
          ...els.alignButtons,
        ].forEach((control) => {
          if (!control) return;
          control.disabled =
            !hasSelection ||
            !selectionPolicy.canEditStyles ||
            !selectionPolicy.canEditText ||
            !canEditRichTextStyles;
        });
        [
          els.displaySelect,
          els.positionSelect,
          els.zIndexInput,
          els.widthInput,
          els.heightInput,
          els.leftInput,
          els.topInput,
        ].forEach((control) => {
          if (!control) return;
          control.disabled = !hasSelection || styleLocked || geometryLocked;
        });
        [
          els.bgColorInput,
          els.borderColorInput,
          els.borderStyleSelect,
          els.borderWidthInput,
          els.marginInput,
          els.paddingInput,
          els.opacityInput,
          els.borderRadiusInput,
        ].forEach((control) => {
          if (!control) return;
          control.disabled = !hasSelection || styleLocked;
        });
        els.editTextBtn.disabled =
          !hasSelection || !selectionPolicy.canEditText || !canStartPlainTextEditing;
        els.imageSection.style.display =
          state.selectedFlags.isImage || state.selectedFlags.isVideo
            ? ""
            : "none";
        if (state.selectedFlags.isImage || state.selectedFlags.isVideo) {
          els.imageSrcInput.value = state.selectedAttrs.src || "";
          els.imageAltInput.value = state.selectedFlags.isImage
            ? state.selectedAttrs.alt || ""
            : "";
        }
        els.imageSrcInput.disabled =
          !hasSelection || !selectionPolicy.canEditAttributes || !selectionPolicy.canReplaceMedia;
        els.applyImageSrcBtn.disabled = els.imageSrcInput.disabled;
        els.imageAltInput.disabled =
          !hasSelection || !selectionPolicy.canEditAttributes || !state.selectedFlags.isImage;
        els.imageAltInput.closest(".field-group").style.display = state
          .selectedFlags.isImage
          ? ""
          : "none";
        [
          els.replaceImageBtn,
          els.fitImageBtn,
          els.copyImageUrlBtn,
          els.resetImageSizeBtn,
          els.rotateImageBtn,
          els.flipImageBtn,
        ].forEach((btn) => {
          if (btn)
            btn.style.display = state.selectedFlags.isImage ? "" : "none";
        });
        if (els.replaceImageBtn)
          els.replaceImageBtn.disabled =
            !hasSelection || !selectionPolicy.canReplaceMedia || !state.selectedFlags.isImage;
        if (els.fitImageBtn)
          els.fitImageBtn.disabled =
            !hasSelection || !selectionPolicy.canEditStyles || !state.selectedFlags.isImage;
        if (els.resetImageSizeBtn)
          els.resetImageSizeBtn.disabled =
            !hasSelection || !selectionPolicy.canEditStyles || !state.selectedFlags.isImage;
        if (els.rotateImageBtn)
          els.rotateImageBtn.disabled =
            !hasSelection || !selectionPolicy.canEditStyles || !state.selectedFlags.isImage;
        if (els.flipImageBtn)
          els.flipImageBtn.disabled =
            !hasSelection || !selectionPolicy.canEditStyles || !state.selectedFlags.isImage;
        updateFloatingToolbarContext();
        if (structuralLocked || styleLocked || attributeLocked || hasBlockedDirectManipulationContext()) {
          els.inspectorHelp.textContent = state.selectedFlags.isSlideRoot
            ? "Выбран корневой контейнер слайда. Для него доступны безопасные стилевые правки и добавление новых блоков внутрь слайда, но перемещение, resize и destructive structural-операции заблокированы."
            : state.selectedFlags.isProtected
              ? "Выбран защищённый системный контейнер. Он доступен только в режиме чтения: destructive actions, direct manipulation и HTML replace отключены."
              : hasBlockedDirectManipulationContext()
                ? `${getDirectManipulationBlockMessage()} Поля позиции и размера в инспекторе остаются доступными.`
                : "Выбран защищённый системный контейнер. Он доступен только в режиме чтения: destructive actions, direct manipulation и HTML replace отключены.";
        }
      }

      function renderSelectionBreadcrumbs(hasSelection) {
        if (!els.selectionBreadcrumbs) return;
        const visible =
          Boolean(hasSelection) &&
          Array.isArray(state.selectionPath) &&
          state.selectionPath.length > 0;
        els.selectionBreadcrumbs.hidden = !visible;
        els.selectionBreadcrumbs.setAttribute(
          "aria-hidden",
          visible ? "false" : "true",
        );
        els.selectionBreadcrumbs.innerHTML = "";
        if (!visible) return;
        const fragment = document.createDocumentFragment();
        state.selectionPath.forEach((entry, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `selection-breadcrumb${entry.current ? " is-current" : ""}${entry.isLeaf ? " is-leaf" : ""}`;
          button.dataset.selectionPathNodeId = entry.nodeId;
          button.dataset.selectionNodeId = entry.selectionNodeId || entry.nodeId;
          if (entry.entityKind) button.dataset.entityKind = entry.entityKind;
          const _crumbKind = entry.entityKind ? getEntityKindLabel(entry.entityKind) : "";
          if (_crumbKind) {
            const _kindEl = document.createElement("span");
            _kindEl.className = "crumb-kind";
            _kindEl.textContent = _crumbKind;
            button.appendChild(_kindEl);
          }
          const _labelEl = document.createElement("span");
          _labelEl.textContent = entry.label || entry.nodeId;
          button.appendChild(_labelEl);
          if (entry.current) {
            button.setAttribute("aria-current", "true");
            button.setAttribute("aria-pressed", "true");
          }
          const _bnodeId = entry.selectionNodeId || entry.nodeId;
          button.addEventListener("pointerenter", () => {
            if (_bnodeId) sendToBridge("highlight-node", { nodeId: _bnodeId });
          });
          button.addEventListener("pointerleave", () => {
            sendToBridge("highlight-node", { nodeId: null });
          });
          fragment.appendChild(button);
          if (index < state.selectionPath.length - 1) {
            const separator = document.createElement("span");
            separator.className = "selection-breadcrumb-separator";
            separator.setAttribute("aria-hidden", "true");
            separator.textContent = "›";
            fragment.appendChild(separator);
          }
        });
        els.selectionBreadcrumbs.appendChild(fragment);
        // [v0.19.0 ADR-002] Stack depth badge
        if (els.stackDepthBadge) {
          const cts = state.clickThroughState;
          const overlapItems = Array.isArray(state.layerPickerPayload?.items)
            ? state.layerPickerPayload.items
            : [];
          const fallbackCandidateCount = overlapItems.length;
          const fallbackActiveIndex =
            overlapItems.findIndex((item) => item?.nodeId === state.selectedNodeId);
          const candidateCount = cts?.candidates?.length || fallbackCandidateCount || 0;
          const currentIndex = candidateCount > 1
            ? ((cts?.candidates?.length || 0) > 1
              ? (cts.index + 1)
              : ((fallbackActiveIndex >= 0 ? fallbackActiveIndex : 0) + 1))
            : 0;
          const showBadge = visible && candidateCount > 1;
          els.stackDepthBadge.hidden = !showBadge;
          els.stackDepthBadge.setAttribute("aria-hidden", showBadge ? "false" : "true");
          els.stackDepthBadge.setAttribute(
            "aria-label",
            showBadge
              ? `Слой ${currentIndex} из ${candidateCount} под курсором`
              : "Слой под курсором",
          );
          els.stackDepthBadge.textContent = showBadge
            ? `${currentIndex} из ${candidateCount}`
            : "";
        }
      }

      function getSelectedElementQuickActionDefs({
        directManipulationBlocked = false,
        entityKind = "none",
        hasSelection = false,
      } = {}) {
        if (!hasSelection || !state.selectedNodeId || entityKind === "none") return [];
        const actions = [];
        const addAction = (action, label, options = {}) => {
          if (actions.some((item) => item.action === action)) return;
          actions.push({
            action,
            label,
            primary: Boolean(options.primary),
          });
        };

        if (entityKind === "text" || entityKind === "table-cell" || entityKind === "code-block") {
          addAction("edit-text", "Печатать", { primary: true });
        } else if (entityKind === "image") {
          addAction("replace-image", "Заменить", { primary: true });
          addAction("fit-image", "Вписать");
        } else if (entityKind === "video") {
          addAction("edit-media-url", "URL", { primary: true });
        } else if (directManipulationBlocked && state.complexityMode === "basic") {
          addAction("switch-advanced", "Точно", { primary: true });
        }

        if (entityKind !== "slide-root" && entityKind !== "protected") {
          addAction("duplicate", "Дублировать");
        }

        if (
          directManipulationBlocked &&
          state.complexityMode === "basic" &&
          actions.length < 4
        ) {
          addAction("switch-advanced", "Точно");
        }

        return actions.slice(0, 4);
      }

      function renderSelectedElementQuickActions(options = {}) {
        const container = els.selectedElementQuickActions;
        if (!(container instanceof HTMLElement)) return;
        const actions = getSelectedElementQuickActionDefs(options);
        container.replaceChildren();
        container.hidden = actions.length === 0;
        container.setAttribute("aria-hidden", actions.length ? "false" : "true");
        actions.forEach((item) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `ghost-btn${item.primary ? " is-primary" : ""}`;
          button.dataset.summaryAction = item.action;
          button.textContent = item.label;
          button.setAttribute("aria-label", item.label);
          container.appendChild(button);
        });
      }

      function handleSelectedElementQuickAction(event) {
        const target = event.target instanceof Element
          ? event.target.closest("[data-summary-action]")
          : null;
        if (!(target instanceof HTMLButtonElement)) return;
        event.preventDefault();
        event.stopPropagation();
        const action = target.dataset.summaryAction || "";
        if (action === "edit-text") {
          startTextEditing();
        } else if (action === "replace-image") {
          requestImageInsert("replace");
        } else if (action === "fit-image") {
          fitSelectedImageToWidth();
        } else if (action === "edit-media-url") {
          editSelectedMediaUrl();
        } else if (action === "duplicate") {
          duplicateSelectedElement();
        } else if (action === "switch-advanced") {
          setComplexityMode("advanced");
          showToast("Включён режим точных правок.", "success", {
            title: "Инспектор",
          });
        }
      }

      function updateInspectorFromSelection() {
        const hasSelection = Boolean(
          state.selectedNodeId && state.mode === "edit",
        );
        const entityKind = hasSelection ? getSelectedEntityKindForUi() : "none";
        const selectionPolicy = hasSelection
          ? state.selectedPolicy || createDefaultSelectionPolicy(state.selectedFlags)
          : createDefaultSelectionPolicy();
        const isTextSelection = entityKind === "text";
        const isTableCellSelection = entityKind === "table-cell";
        const isCodeBlockSelection = entityKind === "code-block";
        const isInlineTextSelection = isTextSelection || isTableCellSelection;
        const canStartPlainTextEditing =
          isInlineTextSelection || isCodeBlockSelection;
        const isImageSelection = entityKind === "image";
        const isVideoSelection = entityKind === "video";
        const isMediaSelection = isImageSelection || isVideoSelection;
        const directManipulationBlocked =
          hasSelection &&
          entityKind !== "slide-root" &&
          entityKind !== "protected" &&
          hasBlockedDirectManipulationContext();

        els.elementTagInput.value = hasSelection
          ? state.selectedTag || "—"
          : "—";
        els.selectedNodeBadge.textContent = `node: ${hasSelection ? state.selectedNodeId : "—"}`;
        const selectedSlideIndex = hasSelection
          ? state.slides.findIndex((slide) => slide.id === state.activeSlideId)
          : -1;
        els.selectedSlideBadge.textContent =
          selectedSlideIndex >= 0 ? `Слайд ${selectedSlideIndex + 1}` : "Слайд —";
        els.selectedKindBadge.textContent = `Тип: ${hasSelection ? getEntityKindLabel(entityKind) : "—"}`;
        const overlapWarning = hasSelection ? state.selectedOverlapWarning : null;
        const showOverlapBanner = Boolean(
          hasSelection &&
            overlapWarning &&
            overlapWarning.coveredPercent > 30,
        );
        const overlapLayerItems = showOverlapBanner
          ? collectLayerPickerItemsFromOverlap()
          : [];
        const canResolveOverlap = overlapLayerItems.length > 1;
        if (els.overlapRecoveryBanner) {
          els.overlapRecoveryBanner.hidden = !showOverlapBanner;
          els.overlapRecoveryBanner.setAttribute(
            "aria-hidden",
            showOverlapBanner ? "false" : "true",
          );
        }
        if (els.overlapRecoveryText) {
          // [v0.25.0] Unified message — picker available in all modes
          els.overlapRecoveryText.textContent = showOverlapBanner
            ? `Под курсором несколько слоёв. Перекрытие около ${overlapWarning.coveredPercent}%. Выберите нужный или поднимите текущий.`
            : "Под курсором несколько слоёв. Выберите нужный или поднимите текущий.";
        }
        if (els.overlapMoveTopBtn) {
          els.overlapMoveTopBtn.disabled = !showOverlapBanner;
        }
        if (els.overlapSelectLayerBtn) {
          els.overlapSelectLayerBtn.hidden = !showOverlapBanner;
          els.overlapSelectLayerBtn.disabled = !canResolveOverlap;
          els.overlapSelectLayerBtn.setAttribute(
            "aria-hidden",
            showOverlapBanner ? "false" : "true",
          );
          setElementInertState(els.overlapSelectLayerBtn, !showOverlapBanner);
          // [v0.25.0] Picker in all modes — always show "Выбрать слой"
          els.overlapSelectLayerBtn.textContent = "Выбрать слой";
          els.overlapSelectLayerBtn.setAttribute("data-ui-level", "advanced");
        }
        // [v0.18.0] Lock banner (advanced mode only)
        const isLocked = hasSelection && state.modelDoc
          ? Boolean(state.modelDoc.querySelector(`[data-editor-node-id="${cssEscape(state.selectedNodeId)}"]`)?.getAttribute("data-editor-locked") === "true")
          : false;
        const showLockBanner = Boolean(
          hasSelection &&
            state.complexityMode === "advanced" &&
            isLocked,
        );
        if (els.lockBanner) {
          els.lockBanner.hidden = !showLockBanner;
          els.lockBanner.setAttribute(
            "aria-hidden",
            showLockBanner ? "false" : "true",
          );
        }
        if (els.unlockElementBtn) {
          if (showLockBanner && state.selectedNodeId) {
            els.unlockElementBtn.setAttribute(
              "data-lock-node-id",
              state.selectedNodeId,
            );
          } else {
            els.unlockElementBtn.removeAttribute("data-lock-node-id");
          }
        }
        // [v0.18.0] Render layers panel (advanced mode only)
        // [WO-19/P1-12] Skip renderLayersPanel in basic mode or when section is hidden
        // to avoid unnecessary DOM work on every selection change.
        if (state.complexityMode === "advanced" && els.layersInspectorSection && !els.layersInspectorSection.hidden) {
          renderLayersPanel();
        }
        // [v0.19.0] Block reason banner
        const blockReason = hasSelection ? getBlockReason() : "none";
        const effectiveBlockReason = isLocked ? "locked" : blockReason;
        const showBlockBanner = Boolean(
          hasSelection &&
            effectiveBlockReason !== "none" &&
            !showLockBanner &&
            entityKind !== "slide-root" &&
            entityKind !== "protected",
        );
        if (els.blockReasonBanner) {
          els.blockReasonBanner.hidden = !showBlockBanner;
          els.blockReasonBanner.setAttribute("aria-hidden", showBlockBanner ? "false" : "true");
        }
        if (els.blockReasonText) {
          els.blockReasonText.textContent = showBlockBanner
            ? getBlockReasonLabel(effectiveBlockReason) : "";
        }
        if (els.blockReasonActionBtn) {
          const actionDef = showBlockBanner ? getBlockReasonAction(effectiveBlockReason) : null;
          if (actionDef) {
            els.blockReasonActionBtn.hidden = false;
            els.blockReasonActionBtn.textContent = actionDef.label;
            els.blockReasonActionBtn.dataset.blockAction = actionDef.action;
          } else {
            els.blockReasonActionBtn.hidden = true;
            els.blockReasonActionBtn.removeAttribute("data-block-action");
          }
        }
        if (els.selectedElementTitle) {
          els.selectedElementTitle.textContent = getSelectedElementTitle(entityKind);
        }
        if (els.selectedElementSummary) {
          els.selectedElementSummary.textContent = getSelectedElementSummary(entityKind);
        }
        renderSelectedElementQuickActions({
          directManipulationBlocked,
          entityKind,
          hasSelection,
        });
        renderSelectionBreadcrumbs(hasSelection && !showBlockBanner);
        syncInspectorEntitySections(hasSelection);
        if (els.selectionPolicyText && !hasSelection) {
          els.selectionPolicyText.textContent =
            "Выберите элемент, чтобы увидеть ограничения редактирования.";
        }
        // pasteElementBtn: enabled as long as internal clipboard has content and editor is loaded
        if (els.pasteElementBtn) {
          els.pasteElementBtn.disabled = !state.copiedElementHtml || !state.modelDoc || state.mode !== "edit";
        }
        const controls = [
          els.boldBtn,
          els.italicBtn,
          els.underlineBtn,
          els.fontSizeSelect,
          els.textColorInput,
          els.showElementHtmlBtn,
          els.copyElementBtn,
          els.duplicateElementBtn,
          els.deleteElementBtn,
          els.moveElementUpBtn,
          els.moveElementDownBtn,
          els.resetStylesBtn,
          els.copyStyleBtn,
          els.pasteStyleBtn,
          els.elementIdInput,
          els.elementClassInput,
          els.displaySelect,
          els.positionSelect,
          els.zIndexInput,
          els.widthInput,
          els.heightInput,
          els.leftInput,
          els.topInput,
          els.bgColorInput,
          els.borderColorInput,
          els.borderStyleSelect,
          els.borderWidthInput,
          els.marginInput,
          els.paddingInput,
          els.opacityInput,
          els.borderRadiusInput,
          els.editTextBtn,
          els.imageSrcInput,
          els.applyImageSrcBtn,
          els.imageAltInput,
          els.replaceImageBtn,
          els.fitImageBtn,
          els.copyImageUrlBtn,
          els.openImageBtn,
          els.resetImageSizeBtn,
          els.rotateImageBtn,
          els.flipImageBtn,
          ...els.alignButtons,
        ];
        controls.forEach((control) => {
          if (control) control.disabled = !hasSelection;
        });

        [
          els.ftDeleteBtn,
          els.ftDuplicateBtn,
          els.ftEditTextBtn,
          els.ftReplaceImageBtn,
          els.ftCopyStyleBtn,
          els.ftPasteStyleBtn,
          els.ftCopyImageUrlBtn,
          els.ftMediaUrlBtn,
          els.ftFitImageBtn,
          els.ftBoldBtn,
          els.ftItalicBtn,
          els.ftColorInput,
          els.ftFontSizeSelect,
        ].forEach((control) => {
          if (control) control.disabled = !hasSelection;
        });

        if (els.currentSlideMetaBadge) {
          const slideIndex = state.slides.findIndex(
            (slide) => slide.id === state.activeSlideId,
          );
          els.currentSlideMetaBadge.textContent =
            slideIndex >= 0
              ? `слайд ${slideIndex + 1} / ${state.slides.length}`
              : "слайд: —";
        }

        if (!hasSelection || !state.selectedComputed) {
          els.elementIdInput.value = "";
          els.elementClassInput.value = "";
          els.fontSizeSelect.value = "";
          els.ftFontSizeSelect.value = "";
          if (els.inspectorFontFamilySelect) els.inspectorFontFamilySelect.value = "";
          if (els.inspectorLineHeightSelect) els.inspectorLineHeightSelect.value = "";
          els.textColorInput.value = "#000000";
          els.ftColorInput.value = "#000000";
          els.bgColorInput.value = "#ffffff";
          els.borderColorInput.value = "#000000";
          els.borderStyleSelect.value = "";
          els.displaySelect.value = "";
          els.positionSelect.value = "";
          els.zIndexInput.value = "";
          els.widthInput.value = "";
          els.heightInput.value = "";
          els.leftInput.value = "";
          els.topInput.value = "";
          // [WO-26] Clear transform input on deselect
          { const tEl = document.getElementById("transformInput"); if (tEl) tEl.value = ""; }
          { const rBtn = document.getElementById("resetTransformBtn"); if (rBtn) rBtn.disabled = true; }
          els.marginInput.value = "";
          els.paddingInput.value = "";
          if (els.opacityInput) els.opacityInput.value = "";
          if (els.borderRadiusInput) els.borderRadiusInput.value = "";
          els.imageSrcInput.value = "";
          els.imageAltInput.value = "";
          if (els.showSlideHtmlBtn) {
            els.showSlideHtmlBtn.disabled =
              !state.activeSlideId || !hasStaticSlide(state.activeSlideId);
          }
          if (els.reloadPreviewBtn) {
            els.reloadPreviewBtn.disabled = !state.modelDoc;
          }
          const imageAltField = els.imageAltInput?.closest(".field-group");
          if (imageAltField instanceof HTMLElement) {
            imageAltField.style.display = "";
            imageAltField.hidden = false;
            imageAltField.setAttribute("aria-hidden", "false");
          }
          [
            els.replaceImageBtn,
            els.fitImageBtn,
            els.copyImageUrlBtn,
            els.openImageBtn,
            els.resetImageSizeBtn,
            els.rotateImageBtn,
            els.flipImageBtn,
          ].forEach((btn) => {
            if (btn) btn.style.display = "";
          });
          els.alignButtons.forEach((button) =>
            button.classList.remove("is-active"),
          );
          [
            els.boldBtn,
            els.italicBtn,
            els.underlineBtn,
            els.ftBoldBtn,
            els.ftItalicBtn,
            els.ftUnderlineBtn,
            els.ftAlignLeftBtn,
            els.ftAlignCenterBtn,
            els.ftAlignRightBtn,
          ].forEach((button) => button?.classList.remove("is-active"));
          if (els.ftFontFamilySelect) els.ftFontFamilySelect.value = "";
          if (els.selectionPolicyText) {
            els.selectionPolicyText.textContent =
              "Выберите элемент, чтобы увидеть ограничения редактирования.";
          }
          if (els.inspectorHelp && state.mode === "edit") {
            els.inspectorHelp.textContent = getSelectionGuidanceCopy(false);
          }
          updateFloatingToolbarContext();
          return;
        }

        if (els.selectionPolicyText) {
          if (entityKind === "slide-root") {
            els.selectionPolicyText.textContent =
              selectionPolicy.reason ||
              "Выбран корневой контейнер слайда. Доступны только безопасные действия уровня слайда.";
          } else if (entityKind === "protected") {
            els.selectionPolicyText.textContent =
              selectionPolicy.reason ||
              "Выбран защищённый контейнер. Он доступен только в режиме чтения.";
          } else if (directManipulationBlocked) {
            els.selectionPolicyText.textContent = `${getDirectManipulationBlockMessage()} Поля размера и позиции остаются доступными в инспекторе.`;
          } else if (selectionPolicy.reason) {
            els.selectionPolicyText.textContent = selectionPolicy.reason;
          } else if (entityKind === "container" && selectionPolicy.canAddChild) {
            els.selectionPolicyText.textContent =
              "Выбран контейнер. Можно менять его оформление и добавлять внутрь новые блоки через Insert.";
          } else {
            els.selectionPolicyText.textContent =
              "Для выбранного элемента ограничений нет.";
          }
        }

        const styleLocked = !selectionPolicy.canEditStyles;
        const attributeLocked = !selectionPolicy.canEditAttributes;
        const geometryLocked =
          !selectionPolicy.canMove &&
          !selectionPolicy.canResize &&
          !selectionPolicy.canReorder;
        els.elementIdInput.value = state.selectedAttrs.id || "";
        els.elementClassInput.value = state.selectedAttrs.class || "";
        els.elementIdInput.disabled = !hasSelection || attributeLocked;
        els.elementClassInput.disabled = !hasSelection || attributeLocked;
        els.showElementHtmlBtn.disabled =
          !hasSelection ||
          !selectionPolicy.canEditHtml ||
          entityKind === "slide-root" ||
          entityKind === "protected";
        els.showSlideHtmlBtn.disabled =
          !state.activeSlideId || !hasStaticSlide(state.activeSlideId);
        els.duplicateElementBtn.disabled = !hasSelection || !selectionPolicy.canDuplicate;
        els.deleteElementBtn.disabled = !hasSelection || !selectionPolicy.canDelete;
        els.moveElementUpBtn.disabled = !hasSelection || !selectionPolicy.canReorder;
        els.moveElementDownBtn.disabled = !hasSelection || !selectionPolicy.canReorder;
        els.resetStylesBtn.disabled = !hasSelection || !selectionPolicy.canEditStyles;
        els.pasteStyleBtn.disabled = !hasSelection || !selectionPolicy.canEditStyles;

        const fontSize = parseInt(state.selectedComputed.fontSize, 10);
        const supportedSizes = ["10","12","14","16","18","20","24","28","32","36","40","48","56","64","72","96"];
        const normalizedSize = supportedSizes.includes(String(fontSize)) ? String(fontSize) : "";
        els.fontSizeSelect.value = normalizedSize;
        els.ftFontSizeSelect.value = normalizedSize;
        // Sync inspector font-family
        if (els.inspectorFontFamilySelect) {
          const rawFam = (state.selectedComputed.fontFamily || "").trim();
          let famMatched = "";
          Array.from(els.inspectorFontFamilySelect.options).forEach((opt) => {
            if (opt.value && rawFam.replace(/['"]/g,"").startsWith(opt.value.split(",")[0].replace(/['"]/g,"").trim())) famMatched = opt.value;
          });
          els.inspectorFontFamilySelect.value = famMatched;
        }
        // Sync inspector line-height
        if (els.inspectorLineHeightSelect) {
          const rawLH = (state.selectedComputed.lineHeight || "").trim();
          const lhNum = parseFloat(rawLH);
          const lhOptions = ["1","1.2","1.3","1.4","1.5","1.6","1.8","2"];
          const lhMatched = lhOptions.find((v) => Math.abs(parseFloat(v) - lhNum) < 0.05) || "";
          els.inspectorLineHeightSelect.value = lhMatched;
        }
        els.textColorInput.value = rgbToHex(
          state.selectedComputed.color || "#000000",
        );
        els.ftColorInput.value = rgbToHex(
          state.selectedComputed.color || "#000000",
        );
        els.bgColorInput.value = rgbToHex(
          state.selectedComputed.backgroundColor || "#ffffff",
        );
        els.borderColorInput.value = rgbToHex(
          state.selectedComputed.borderColor || "#000000",
        );
        els.borderStyleSelect.value = safeSelectValue(
          els.borderStyleSelect,
          state.selectedComputed.borderStyle,
        );
        els.displaySelect.value = safeSelectValue(
          els.displaySelect,
          state.selectedComputed.display,
        );
        els.positionSelect.value = safeSelectValue(
          els.positionSelect,
          state.selectedComputed.position,
        );
        els.zIndexInput.value = sanitizeCssValue(state.selectedComputed.zIndex);
        els.widthInput.value = sanitizeCssValue(state.selectedComputed.width);
        els.heightInput.value = sanitizeCssValue(state.selectedComputed.height);
        els.leftInput.value = sanitizeCssValue(state.selectedComputed.left);
        els.topInput.value = sanitizeCssValue(state.selectedComputed.top);
        // [WO-26] Populate transform input (inline style, not computed — avoid matrix expansion)
        {
          const transformEl = document.getElementById("transformInput");
          const resetBtn = document.getElementById("resetTransformBtn");
          const node = getSelectedModelNode();
          const inlineTransform = node instanceof HTMLElement ? (node.style.transform || "") : "";
          if (transformEl && document.activeElement !== transformEl) {
            transformEl.value = inlineTransform;
          }
          if (transformEl) {
            transformEl.disabled = !state.selectedPolicy?.canEditStyles;
          }
          if (resetBtn) {
            resetBtn.disabled = !state.selectedPolicy?.canEditStyles || !inlineTransform;
          }
        }
        els.marginInput.value = sanitizeCssValue(state.selectedComputed.margin);
        els.paddingInput.value = sanitizeCssValue(
          state.selectedComputed.padding,
        );
        els.borderWidthInput.value = sanitizeCssValue(
          state.selectedComputed.borderWidth,
        );
        if (els.opacityInput) {
          const opRaw2 = state.selectedComputed.opacity;
          els.opacityInput.value = (!opRaw2 || opRaw2 === "1")
            ? "" : String(Math.round(parseFloat(opRaw2) * 100));
        }
        if (els.borderRadiusInput) {
          els.borderRadiusInput.value = sanitizeCssValue(state.selectedComputed.borderRadius);
        }

        const alignment = state.selectedComputed.textAlign || "left";
        els.alignButtons.forEach((button) =>
          button.classList.toggle(
            "is-active",
            button.dataset.align === alignment,
          ),
        );
        const boldActive = ["700", "800", "900", "bold"].includes(
          state.selectedComputed.fontWeight,
        );
        const italicActive = state.selectedComputed.fontStyle === "italic";
        const underlineActive = (state.selectedComputed.textDecorationLine || "").includes("underline");
        els.boldBtn.classList.toggle("is-active", boldActive);
        els.ftBoldBtn.classList.toggle("is-active", boldActive);
        els.italicBtn.classList.toggle("is-active", italicActive);
        els.ftItalicBtn.classList.toggle("is-active", italicActive);
        els.underlineBtn.classList.toggle("is-active", underlineActive);
        els.ftUnderlineBtn?.classList.toggle("is-active", underlineActive);
        const ftAlignment2 = state.selectedComputed.textAlign || "left";
        els.ftAlignLeftBtn?.classList.toggle("is-active",   ftAlignment2 === "left");
        els.ftAlignCenterBtn?.classList.toggle("is-active", ftAlignment2 === "center");
        els.ftAlignRightBtn?.classList.toggle("is-active",  ftAlignment2 === "right");

        [
          els.boldBtn,
          els.italicBtn,
          els.underlineBtn,
          els.ftUnderlineBtn,
          els.ftAlignLeftBtn,
          els.ftAlignCenterBtn,
          els.ftAlignRightBtn,
          els.ftFontFamilySelect,
          els.fontSizeSelect,
          els.textColorInput,
          ...els.alignButtons,
        ].forEach((control) => {
          if (!control) return;
          control.disabled =
            !hasSelection ||
            !selectionPolicy.canEditStyles ||
            !selectionPolicy.canEditText ||
            !isInlineTextSelection;
        });

        [
          els.displaySelect,
          els.positionSelect,
          els.zIndexInput,
          els.widthInput,
          els.heightInput,
          els.leftInput,
          els.topInput,
        ].forEach((control) => {
          if (!control) return;
          control.disabled = !hasSelection || styleLocked || geometryLocked;
        });

        [
          els.bgColorInput,
          els.borderColorInput,
          els.borderStyleSelect,
          els.borderWidthInput,
          els.marginInput,
          els.paddingInput,
          els.opacityInput,
          els.borderRadiusInput,
        ].forEach((control) => {
          if (!control) return;
          control.disabled = !hasSelection || styleLocked;
        });

        els.editTextBtn.disabled =
          !hasSelection || !selectionPolicy.canEditText || !canStartPlainTextEditing;
        [
          els.insertTableRowAboveBtn,
          els.insertTableRowBelowBtn,
          els.deleteTableRowBtn,
          els.insertTableColumnLeftBtn,
          els.insertTableColumnRightBtn,
          els.deleteTableColumnBtn,
        ].forEach((control) => {
          if (!control) return;
          control.disabled = !hasSelection || !isTableCellSelection;
        });
        if (isMediaSelection) {
          els.imageSrcInput.value = state.selectedAttrs.src || "";
          els.imageAltInput.value = isImageSelection
            ? state.selectedAttrs.alt || ""
            : "";
        } else {
          els.imageSrcInput.value = "";
          els.imageAltInput.value = "";
        }
        els.imageSrcInput.disabled =
          !hasSelection ||
          !selectionPolicy.canEditAttributes ||
          !selectionPolicy.canReplaceMedia ||
          !isMediaSelection;
        els.applyImageSrcBtn.disabled = els.imageSrcInput.disabled;
        els.imageAltInput.disabled =
          !hasSelection || !selectionPolicy.canEditAttributes || !isImageSelection;
        const imageAltField = els.imageAltInput?.closest(".field-group");
        if (imageAltField instanceof HTMLElement) {
          const showAltField = isImageSelection;
          imageAltField.style.display = showAltField ? "" : "none";
          imageAltField.hidden = !showAltField;
          imageAltField.setAttribute("aria-hidden", showAltField ? "false" : "true");
          syncShellPanelFocusableState(imageAltField, showAltField);
          setElementInertState(imageAltField, !showAltField);
        }
        [
          els.replaceImageBtn,
          els.fitImageBtn,
          els.resetImageSizeBtn,
          els.rotateImageBtn,
          els.flipImageBtn,
        ].forEach((btn) => {
          if (!btn) return;
          btn.style.display = isImageSelection ? "" : "none";
          btn.hidden = !isImageSelection;
          btn.setAttribute("aria-hidden", isImageSelection ? "false" : "true");
        });
        [els.copyImageUrlBtn, els.openImageBtn].forEach((btn) => {
          if (!btn) return;
          btn.style.display = isMediaSelection ? "" : "none";
          btn.hidden = !isMediaSelection;
          btn.setAttribute("aria-hidden", isMediaSelection ? "false" : "true");
        });
        if (els.replaceImageBtn) {
          els.replaceImageBtn.disabled =
            !hasSelection || !selectionPolicy.canReplaceMedia || !isImageSelection;
        }
        if (els.fitImageBtn) {
          els.fitImageBtn.disabled =
            !hasSelection || !selectionPolicy.canEditStyles || !isImageSelection;
        }
        if (els.copyImageUrlBtn) {
          els.copyImageUrlBtn.disabled = !hasSelection || !isMediaSelection;
        }
        if (els.openImageBtn) {
          els.openImageBtn.disabled =
            !hasSelection ||
            !isMediaSelection ||
            !String(state.selectedAttrs.src || "").trim();
        }
        if (els.resetImageSizeBtn) {
          els.resetImageSizeBtn.disabled =
            !hasSelection || !selectionPolicy.canEditStyles || !isImageSelection;
        }
        if (els.rotateImageBtn) {
          els.rotateImageBtn.disabled =
            !hasSelection || !selectionPolicy.canEditStyles || !isImageSelection;
        }
        if (els.flipImageBtn) {
          els.flipImageBtn.disabled =
            !hasSelection || !selectionPolicy.canEditStyles || !isImageSelection;
        }
        updateFloatingToolbarContext();
        if (els.inspectorHelp && state.mode === "edit") {
          els.inspectorHelp.textContent = getSelectionGuidanceCopy(hasSelection);
        }
      }

      // refreshUi
      // Перерисовывает оболочку редактора: статусы, кнопки, подсказки, toolbar,
      // видимость палитры и диагностические элементы.
