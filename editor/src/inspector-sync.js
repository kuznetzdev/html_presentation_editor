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
          els.overlapRecoveryText.textContent = showOverlapBanner
            ? state.complexityMode === "advanced"
              ? `Под курсором несколько слоёв. Перекрытие около ${overlapWarning.coveredPercent}%. Выберите нужный или поднимите текущий.`
              : `Под курсором несколько слоёв. Перекрытие около ${overlapWarning.coveredPercent}%. Поднимите текущий, чтобы он оказался сверху.`
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
          els.overlapSelectLayerBtn.textContent =
            state.complexityMode === "advanced"
              ? "Выбрать слой"
              : "Следующий слой";
          els.overlapSelectLayerBtn.setAttribute(
            "data-ui-level",
            state.complexityMode === "advanced" ? "advanced" : "basic",
          );
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
        renderLayersPanel();
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

      function getFocusableElements(root) {
        return Array.from(
          root.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (el) =>
            !el.hasAttribute("hidden") &&
            el.getAttribute("aria-hidden") !== "true",
        );
      }

      function openModal(modal) {
        if (!modal) return;
        modal.dataset.returnFocusId =
          document.activeElement instanceof HTMLElement
            ? document.activeElement.id || ""
            : "";
        modal.classList.add("is-open");
        modal.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() => {
          const focusables = getFocusableElements(modal);
          const target = focusables[0] || modal;
          if (target && typeof target.focus === "function")
            target.focus({ preventScroll: true });
        });
      }

      function openOpenHtmlModal(options = {}) {
        const focusTarget = ["file", "paste", "assets", "base"].includes(
          String(options.focusTarget || ""),
        )
          ? String(options.focusTarget)
          : "file";
        clearOpenHtmlStatus();
        if (focusTarget === "assets") {
          setOpenHtmlStatus(
            "Подключите папку проекта или assets, чтобы загрузились относительные css/js/img/video.",
            "info",
          );
        } else if (focusTarget === "base") {
          setOpenHtmlStatus(
            "Укажите абсолютный Base URL, если HTML ссылается на соседние ресурсы по относительным путям.",
            "info",
          );
        }
        openModal(els.openHtmlModal);
        window.requestAnimationFrame(() => {
          const target =
            focusTarget === "paste"
              ? els.pasteHtmlTextarea
              : focusTarget === "assets"
                ? els.assetDirectoryInput
                : focusTarget === "base"
                  ? els.baseUrlInput
                  : els.fileInput;
          if (!(target instanceof HTMLElement)) return;
          if (typeof target.focus === "function") {
            target.focus({ preventScroll: true });
          }
          if (
            focusTarget === "paste" &&
            typeof target.select === "function"
          ) {
            target.select();
          }
        });
      }

      function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove("is-open");
        modal.setAttribute("aria-hidden", "true");
        if (modal === els.videoInsertModal) syncInteractionModeFromState();
        const returnFocusId = modal.dataset.returnFocusId || "";
        if (returnFocusId) {
          const returnFocusEl = document.getElementById(returnFocusId);
          if (returnFocusEl && typeof returnFocusEl.focus === "function") {
            window.requestAnimationFrame(() =>
              returnFocusEl.focus({ preventScroll: true }),
            );
          }
        }
      }

      function getPaletteActionButtons() {
        return Array.from(
          els.quickPalette?.querySelectorAll("button[data-palette-action]") ||
            [],
        );
      }

      function applyRovingTabindex(items, activeIndex) {
        items.forEach((item, index) => {
          item.tabIndex = index === activeIndex ? 0 : -1;
        });
      }

      function focusPaletteActionButton(index) {
        const buttons = getPaletteActionButtons();
        if (!buttons.length) return;
        const nextIndex = Math.max(0, Math.min(buttons.length - 1, index));
        applyRovingTabindex(buttons, nextIndex);
        buttons[nextIndex].focus({ preventScroll: true });
      }

      function focusContextMenuButton(index) {
        const items = getContextMenuButtons();
        if (!items.length) return;
        const nextIndex = Math.max(0, Math.min(items.length - 1, index));
        applyRovingTabindex(items, nextIndex);
        items[nextIndex].focus({ preventScroll: true });
      }

      function getTopbarOverflowButtons() {
        return Array.from(
          els.topbarOverflowMenu?.querySelectorAll(
            "button[data-topbar-overflow-action]",
          ) || [],
        ).filter((button) => {
          if (!(button instanceof HTMLElement) || button.hidden) return false;
          const style = getComputedStyle(button);
          return style.display !== "none" && style.visibility !== "hidden";
        });
      }

      function focusTopbarOverflowButton(index) {
        const items = getTopbarOverflowButtons();
        if (!items.length) return;
        const nextIndex = Math.max(0, Math.min(items.length - 1, index));
        applyRovingTabindex(items, nextIndex);
        items[nextIndex].focus({ preventScroll: true });
      }

      function isTopbarOverflowOpen() {
        return Boolean(els.topbarOverflowMenu?.classList.contains("is-open"));
      }

      function setTopbarOverflowOpen(open, options = {}) {
        if (!els.topbarOverflowMenu || !els.topbarOverflowBtn) return;
        const active = Boolean(open) && state.topbarCommandMode === "overflow";
        state.topbarOverflowOpen = active;
        els.topbarOverflowMenu.classList.toggle("is-open", active);
        els.topbarOverflowMenu.setAttribute(
          "aria-hidden",
          active ? "false" : "true",
        );
        setDisclosureButtonState(els.topbarOverflowBtn, active, "topbarOverflowMenu");
        const items = getTopbarOverflowButtons();
        applyRovingTabindex(items, active ? 0 : -1);
        if (active) {
          closeShellPanels({ keep: "topbar-overflow" });
          closeTransientShellUi({ keep: "topbar-overflow" });
          scheduleShellPopoverLayout();
          if (options.focusFirst !== false) {
            window.requestAnimationFrame(() => focusTopbarOverflowButton(0));
          }
          return;
        }
        if (options.restoreFocus) {
          window.requestAnimationFrame(() =>
            els.topbarOverflowBtn.focus({ preventScroll: true }),
          );
        }
      }

      function closeTopbarOverflow(options = {}) {
        setTopbarOverflowOpen(false, options);
      }

      function toggleTopbarOverflow() {
        setTopbarOverflowOpen(!isTopbarOverflowOpen());
      }

      function isInsertPaletteOpen() {
        return Boolean(els.quickPalette?.classList.contains("is-open"));
      }

      function setInsertPaletteOpen(open, options = {}) {
        if (!els.quickPalette || !els.toggleInsertPaletteBtn) return;
        const active = Boolean(open);
        els.quickPalette.classList.toggle("is-open", active);
        els.quickPalette.setAttribute("aria-hidden", active ? "false" : "true");
        els.toggleInsertPaletteBtn.classList.toggle("is-active", active);
        els.toggleInsertPaletteBtn.setAttribute(
          "aria-expanded",
          active ? "true" : "false",
        );
        els.toggleInsertPaletteBtn.textContent = active
          ? "✕ Закрыть вставку"
          : "➕ Добавить блок";
        els.toggleInsertPaletteBtn.title = active
          ? "Скрыть меню вставки"
          : "Открыть меню вставки";
        if (active) {
          closeShellPanels({ keep: "insert-palette" });
          closeTransientShellUi({ keep: "insert-palette" });
          setInteractionMode("insert");
          scheduleShellPopoverLayout();
        } else syncInteractionModeFromState();
        const buttons = getPaletteActionButtons();
        applyRovingTabindex(buttons, active ? 0 : -1);
        if (active && options.focusFirst !== false) {
          window.requestAnimationFrame(() => focusPaletteActionButton(0));
        }
        if (!active && options.restoreFocus) {
          window.requestAnimationFrame(() =>
            els.toggleInsertPaletteBtn.focus({ preventScroll: true }),
          );
        }
      }

      function closeInsertPalette(options = {}) {
        setInsertPaletteOpen(false, options);
      }

      function toggleInsertPalette() {
        setInsertPaletteOpen(!isInsertPaletteOpen());
      }

      function insertHeadingBlock(level = 1) {
        if (!state.modelDoc) return;
        const tag = level <= 1 ? "h1" : "h2";
        const text = level <= 1 ? "Новый заголовок" : "Подзаголовок";
        insertHtmlViaBridge(
          `<${tag} style="margin:0 0 12px;">${escapeHtml(text)}</${tag}>`,
          { focusText: true },
        );
        showToast(
          level <= 1
            ? "Заголовок добавлен на слайд."
            : "Подзаголовок добавлен на слайд.",
          "success",
          { title: "Палитра" },
        );
      }

      function bindPaletteActions() {
        if (!els.quickPalette) return;

        els.toggleInsertPaletteBtn?.addEventListener("click", () => {
          if (!state.modelDoc) return;
          if (!state.previewReady) {
            showToast(
              "Дождись полной загрузки превью, потом открывай меню вставки.",
              "warning",
              { title: "Превью ещё готовится" },
            );
            return;
          }
          if (state.mode !== "edit") setMode("edit");
          closeContextMenu();
          toggleInsertPalette();
        });

        els.toggleInsertPaletteBtn?.addEventListener("keydown", (event) => {
          if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
          event.preventDefault();
          if (!state.modelDoc || !state.previewReady) return;
          if (state.mode !== "edit") setMode("edit");
          closeContextMenu();
          setInsertPaletteOpen(true, { focusFirst: false });
          window.requestAnimationFrame(() =>
            focusPaletteActionButton(
              event.key === "ArrowUp"
                ? getPaletteActionButtons().length - 1
                : 0,
            ),
          );
        });

        els.quickPalette.addEventListener("click", (event) => {
          const action = event.target.closest("[data-palette-action]")?.dataset
            ?.paletteAction;
          if (!action) return;
          performPaletteAction(action);
        });

        els.quickPalette
          .querySelectorAll("[data-palette-action]")
          .forEach((button, index) => {
            button.tabIndex = -1;
            button.addEventListener("dragstart", (event) => {
              const action = button.dataset.paletteAction;
              event.dataTransfer.setData("text/x-pe-palette", action);
              event.dataTransfer.effectAllowed = "copy";
            });
          });

        els.quickPalette.addEventListener("keydown", (event) => {
          const buttons = getPaletteActionButtons();
          if (!buttons.length) return;
          const currentIndex = buttons.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeInsertPalette({ restoreFocus: true });
            return;
          }
          if (["ArrowRight", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            focusPaletteActionButton(
              (currentIndex + 1 + buttons.length) % buttons.length,
            );
            return;
          }
          if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            focusPaletteActionButton(
              (currentIndex - 1 + buttons.length) % buttons.length,
            );
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusPaletteActionButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusPaletteActionButton(buttons.length - 1);
          }
        });

        document.addEventListener("pointerdown", (event) => {
          if (!isInsertPaletteOpen()) return;
          if (
            event.target.closest("#quickPalette") ||
            event.target.closest("#toggleInsertPaletteBtn")
          )
            return;
          closeInsertPalette();
        });

        window.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isInsertPaletteOpen()) {
            event.preventDefault();
            closeInsertPalette({ restoreFocus: true });
          }
        });

        els.previewStage.addEventListener(
          "drop",
          (event) => {
            const action = event.dataTransfer?.getData("text/x-pe-palette");
            if (!action || state.mode !== "edit") return;
            event.preventDefault();
            performPaletteAction(action);
          },
          true,
        );
      }

      function getContextMenuButtons() {
        return Array.from(
          els.contextMenu?.querySelectorAll("button[data-menu-action]") || [],
        );
      }

      function isLayerPickerOpen() {
        return Boolean(
          els.layerPicker?.classList.contains("is-open") && state.layerPickerPayload,
        );
      }

      function getLayerPickerButtons() {
        return Array.from(
          els.layerPickerList?.querySelectorAll("button[data-layer-picker-node-id]") ||
            [],
        );
      }

      function syncLayerPickerActiveButton() {
        const items = getLayerPickerButtons();
        items.forEach((button, index) => {
          button.classList.toggle("is-active", index === state.layerPickerActiveIndex);
        });
      }

      function focusLayerPickerButton(index) {
        const items = getLayerPickerButtons();
        if (!items.length) return;
        const nextIndex = Math.max(0, Math.min(items.length - 1, index));
        state.layerPickerActiveIndex = nextIndex;
        syncLayerPickerActiveButton();
        items[nextIndex].focus({ preventScroll: true });
      }

      function setLayerPickerHighlight(nodeId) {
        const normalizedNodeId = nodeId || null;
        if (state.layerPickerHighlightNodeId === normalizedNodeId) return;
        state.layerPickerHighlightNodeId = normalizedNodeId;
        sendToBridge("highlight-node", { nodeId: normalizedNodeId });
      }

      function collectLayerPickerItemsFromOverlap() {
        const conflict = state.selectedOverlapWarning;
        const doc = getPreviewDocument();
        if (!conflict || !doc) return [];
        const rect = conflict.overlapRect || state.selectedRect;
        if (!rect) return [];
        const docView = doc.defaultView || window;
        const cx = Math.round((rect.left + rect.right) / 2);
        const cy = Math.round((rect.top + rect.bottom) / 2);
        const selectedNode = getSelectedModelNode();
        const uniqueItems = [];
        const seen = new Set();
        const collect = (node) => {
          if (!(node instanceof Element)) return;
          const nodeId = String(node.getAttribute("data-editor-node-id") || "").trim();
          if (!nodeId || seen.has(nodeId) || !isLayerManagedNode(node)) return;
          seen.add(nodeId);
          const entityKind = node.getAttribute("data-editor-entity-kind") || "element";
          const isLocked = node.getAttribute("data-editor-locked") === "true";
          const isHidden =
            isLayerSessionHidden(nodeId) ||
            node.hasAttribute("hidden") ||
            node.style.visibility === "hidden" ||
            node.style.display === "none";
          uniqueItems.push({
            nodeId,
            entityKind,
            label: getLayerLabel(node),
            isLocked,
            isHidden,
            isCurrent: nodeId === state.selectedNodeId,
          });
        };
        const canUseViewportPoint =
          cx >= 0 &&
          cy >= 0 &&
          cx <= Math.max(0, Math.round((docView.innerWidth || 0) - 1)) &&
          cy <= Math.max(0, Math.round((docView.innerHeight || 0) - 1));
        if (canUseViewportPoint) {
          (doc.elementsFromPoint(cx, cy) || []).forEach(collect);
        }
        if (uniqueItems.length < 2) {
          const relatedConflicts = Array.from(
            state.overlapConflictsBySlide[state.activeSlideId] || [],
          ).filter((entry) => {
            if (!entry) return false;
            if (
              entry.bottomNodeId === state.selectedNodeId ||
              entry.topNodeId === state.selectedNodeId
            ) {
              return true;
            }
            if (!entry.overlapRect) return false;
            return computeRectIntersection(rect, entry.overlapRect).area > 0;
          });
          relatedConflicts.forEach((entry) => {
            [entry.bottomNodeId, entry.topNodeId].forEach((nodeId) => {
              if (!nodeId || !state.modelDoc) return;
              collect(
                state.modelDoc.querySelector(
                  `[data-editor-node-id="${cssEscape(nodeId)}"]`,
                ),
              );
            });
          });
        }
        if (selectedNode instanceof Element) collect(selectedNode);
        return uniqueItems.map((item, index, items) => ({
          ...item,
          hint: `${getEntityKindLabel(item.entityKind)} • ${formatLayerStackHint(index, items.length)}`,
          isTopMost: index === 0,
        }));
      }

      function buildSelectedOverlapLayerPickerPayload() {
        const items = collectLayerPickerItemsFromOverlap();
        if (items.length < 2 || !state.selectedOverlapWarning) return null;
        const rect = state.selectedOverlapWarning.overlapRect || state.selectedRect;
        const layerWord = getRussianPlural(items.length, "слой", "слоя", "слоёв");
        return {
          title: "Слои под курсором",
          subtitle: `В этой точке найдено ${items.length} ${layerWord}. Перекрытие около ${state.selectedOverlapWarning.coveredPercent}%.`,
          items,
          shellClientX: rect ? Math.round(rect.right + 12) : 0,
          shellClientY: rect ? Math.round((rect.top + rect.bottom) / 2) : 0,
          source: "selected-overlap",
        };
      }

      function selectNextOverlapLayer() {
        const items = collectLayerPickerItemsFromOverlap();
        if (items.length < 2) {
          showToast(
            "Под курсором не найден следующий authored-слой для переключения.",
            "info",
            { title: "Слои" },
          );
          return false;
        }
        const currentIndex = items.findIndex(
          (item) => item.nodeId === state.selectedNodeId,
        );
        const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 1;
        const nextItem = items[nextIndex % items.length] || null;
        if (!nextItem?.nodeId) return false;
        sendToBridge("select-element", { nodeId: nextItem.nodeId });
        return true;
      }

      function renderLayerPicker(payload) {
        const items = Array.isArray(payload?.items) ? payload.items : [];
        if (!els.layerPickerList) return;
        els.layerPickerTitle.textContent = payload?.title || "Слои под курсором";
        els.layerPickerSubtitle.textContent =
          payload?.subtitle || "В этой точке найдено несколько слоёв. Выберите нужный.";
        els.layerPickerList.innerHTML = "";
        items.forEach((item, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.layerPickerNodeId = item.nodeId;
          if (item.isCurrent) button.classList.add("is-current-layer");
          const chips = [];
          if (item.isTopMost) {
            chips.push(buildLayerStatusChipHtml("Верхний", "is-top"));
          }
          if (item.isCurrent) {
            chips.push(buildLayerStatusChipHtml("Текущий", "is-current"));
          }
          if (item.isHidden) {
            chips.push(buildLayerStatusChipHtml("Скрыт", "is-hidden"));
          }
          if (item.isLocked) {
            chips.push(buildLayerStatusChipHtml("Заблокирован", "is-locked"));
          }
          button.innerHTML = `
            <span class="menu-icon">${escapeHtml(getEntityKindIcon(item.entityKind))}</span>
            <span class="layer-picker-row-copy">
              <span class="layer-picker-row-title">${escapeHtml(item.label)}</span>
              <span class="layer-picker-row-hint">${escapeHtml(item.hint || "")}</span>
              <span class="layer-picker-row-chips">${chips.join("")}</span>
            </span>
          `;
          button.addEventListener("pointerenter", () => {
            state.layerPickerActiveIndex = index;
            syncLayerPickerActiveButton();
            setLayerPickerHighlight(item.nodeId);
          });
          button.addEventListener("pointerleave", () => {
            if (state.layerPickerActiveIndex === index) {
              setLayerPickerHighlight(null);
            }
          });
          button.addEventListener("focus", () => {
            state.layerPickerActiveIndex = index;
            syncLayerPickerActiveButton();
            setLayerPickerHighlight(item.nodeId);
          });
          button.addEventListener("click", () => {
            sendToBridge("select-element", { nodeId: item.nodeId });
            closeLayerPicker();
          });
          els.layerPickerList.appendChild(button);
        });
        state.layerPickerActiveIndex = Math.max(
          0,
          items.findIndex((item) => item.isCurrent),
        );
        if (state.layerPickerActiveIndex < 0) state.layerPickerActiveIndex = 0;
        syncLayerPickerActiveButton();
      }

      function positionLayerPicker(clientX, clientY) {
        if (!els.layerPicker) return;
        const insets = getShellViewportInsets();
        if (prefersContextMenuSheetMode()) {
          const availableWidth =
            window.innerWidth - insets.left - insets.right;
          const sheetWidth = Math.min(360, Math.max(240, availableWidth));
          const centeredLeft =
            insets.left + Math.max(0, Math.round((availableWidth - sheetWidth) / 2));
          els.layerPicker.style.width = `${sheetWidth}px`;
          els.layerPicker.style.left = `${centeredLeft}px`;
          els.layerPicker.style.top = `${Math.round(
            Math.max(
              insets.top,
              window.innerHeight - insets.bottom - (els.layerPicker.offsetHeight || 280),
            ),
          )}px`;
          els.layerPicker.style.right = "auto";
          clampPopoverPosition(els.layerPicker, insets);
          return;
        }
        els.layerPicker.style.width = "";
        els.layerPicker.style.left = `${clientX || 0}px`;
        els.layerPicker.style.top = `${clientY || 0}px`;
        els.layerPicker.style.right = "auto";
        els.layerPicker.style.bottom = "auto";
        clampPopoverPosition(els.layerPicker, insets);
      }

      function reopenLayerPickerFromState() {
        if (!state.layerPickerPayload) return;
        renderLayerPicker(state.layerPickerPayload);
        els.layerPicker.classList.add("is-open");
        els.layerPicker.setAttribute("aria-hidden", "false");
        positionLayerPicker(
          Number(state.layerPickerPayload.shellClientX || 0),
          Number(state.layerPickerPayload.shellClientY || 0),
        );
      }

      function closeLayerPicker(options = {}) {
        if (!els.layerPicker) return;
        els.layerPicker.classList.remove("is-open");
        els.layerPicker.setAttribute("aria-hidden", "true");
        els.layerPicker.style.left = "0px";
        els.layerPicker.style.top = "0px";
        els.layerPicker.style.right = "auto";
        els.layerPicker.style.bottom = "auto";
        els.layerPicker.style.width = "";
        state.layerPickerActiveIndex = -1;
        state.layerPickerPayload = null;
        setLayerPickerHighlight(null);
        if (options.restoreFocus && els.overlapSelectLayerBtn && !els.overlapSelectLayerBtn.hidden) {
          window.requestAnimationFrame(() =>
            els.overlapSelectLayerBtn.focus({ preventScroll: true }),
          );
        }
      }

      function openLayerPicker(payload) {
        if (!payload?.items?.length) return false;
        closeShellPanels({ keep: "layer-picker" });
        closeTransientShellUi({ keep: "layer-picker" });
        hideFloatingToolbar();
        state.layerPickerPayload = payload;
        renderLayerPicker(payload);
        els.layerPicker.classList.add("is-open");
        els.layerPicker.setAttribute("aria-hidden", "false");
        positionLayerPicker(
          Number(payload.shellClientX || 0),
          Number(payload.shellClientY || 0),
        );
        window.requestAnimationFrame(() => focusLayerPickerButton(state.layerPickerActiveIndex || 0));
        return true;
      }

      function openLayerPickerForSelectedOverlap() {
        if (state.complexityMode !== "advanced") return false;
        const payload = buildSelectedOverlapLayerPickerPayload();
        if (!payload) {
          showToast("Под курсором должно быть хотя бы два authored-слоя, чтобы открыть выбор.", "info", {
            title: "Слои",
          });
          return false;
        }
        return openLayerPicker(payload);
      }

      function bindContextMenu() {
        els.contextMenu.addEventListener("click", (event) => {
          const action =
            event.target?.closest?.("[data-menu-action]")?.dataset?.menuAction;
          if (!action) return;
          handleContextMenuAction(action);
        });

        // mouseenter flash on context menu removed — avoids ghost glow on hover

        els.contextMenu.addEventListener("pointerover", (event) => {
          const _lBtn = event.target?.closest?.("[data-layer-node-id]");
          if (_lBtn?.dataset?.layerNodeId) {
            sendToBridge("highlight-node", { nodeId: _lBtn.dataset.layerNodeId });
          }
        }, true);

        els.contextMenu.addEventListener("pointerout", (event) => {
          if (event.target?.closest?.("[data-layer-node-id]")) {
            sendToBridge("highlight-node", { nodeId: null });
          }
        }, true);

        els.contextMenu.addEventListener("keydown", (event) => {
          const items = getContextMenuButtons();
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeContextMenu();
            return;
          }
          if (["ArrowDown", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            focusContextMenuButton(
              (currentIndex + 1 + items.length) % items.length,
            );
            return;
          }
          if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
            event.preventDefault();
            focusContextMenuButton(
              (currentIndex - 1 + items.length) % items.length,
            );
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusContextMenuButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusContextMenuButton(items.length - 1);
          }
        });
      }

      function bindLayerPicker() {
        document.addEventListener(
          "pointerdown",
          (event) => {
            if (!els.layerPicker?.classList.contains("is-open")) return;
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (
              target.closest("#layerPicker") ||
              target.closest("#overlapSelectLayerBtn")
            ) {
              return;
            }
            closeLayerPicker();
          },
          true,
        );
        els.layerPicker?.addEventListener("keydown", (event) => {
          const items = getLayerPickerButtons();
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeLayerPicker({ restoreFocus: true });
            return;
          }
          if (["ArrowDown", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            focusLayerPickerButton((currentIndex + 1 + items.length) % items.length);
            return;
          }
          if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
            event.preventDefault();
            focusLayerPickerButton((currentIndex - 1 + items.length) % items.length);
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusLayerPickerButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusLayerPickerButton(items.length - 1);
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            const activeButton = items[currentIndex >= 0 ? currentIndex : 0];
            if (!activeButton) return;
            event.preventDefault();
            activeButton.click();
          }
        });
      }

      function openContextMenuFromBridge(payload) {
        if (state.mode !== "edit") return;
        closeShellPanels({ keep: "context-menu" });
        closeTransientShellUi({ keep: "context-menu" });
        hideFloatingToolbar();
        state.contextMenuNodeId = payload.nodeId || state.selectedNodeId;
        const frameRect = els.previewFrame.getBoundingClientRect();
        const x = frameRect.left + (payload.clientX || 0);
        const y = frameRect.top + (payload.clientY || 0);
        state.contextMenuPayload = {
          ...payload,
          origin: "bridge",
          nodeId: state.contextMenuNodeId,
          shellClientX: x,
          shellClientY: y,
        };
        renderContextMenu(state.contextMenuPayload);
        positionContextMenu(x, y);
        els.contextMenu.classList.add("is-open");
        els.contextMenu.setAttribute("aria-hidden", "false");
        window.requestAnimationFrame(() => focusContextMenuButton(0));
      }

      function setMode(mode) {
        if (mode === "edit" && !state.editingSupported) {
          showToast(
            "Для этого документа доступен только режим preview. Внутри него нет стабильной структуры для безопасного редактирования.",
            "warning",
            {
              title: "Редактирование недоступно",
              ttl: 4200,
            },
          );
          return;
        }
        state.mode = mode;
        setInteractionMode(mode === "preview" ? "preview" : "select");
        closeContextMenu();
        closeLayerPicker();
        if (mode === "preview") {
          closeInsertPalette();
          clearSelectedElementState();
        }
        sendToBridge("set-mode", { mode });
        refreshUi();
        updateInspectorFromSelection();
      }

      /* ======================================================================
       vNext overrides: system-theme default, responsive shell drawers,
       asset resolver for local folders, media modal for local/remote video,
       and stricter no-dead-end states.
       ====================================================================== */

      function init() {
        initTheme();
        initInspectorSections();
        initComplexityMode();
        initSelectionMode(); // [LAYER-MODEL v2]
        initPreviewZoom(); // [v0.18.3]
        initFloatingToolbarState();
        ensureNoviceShellOnboardingUi();
        ensureNoviceSummaryStructure();
        bindTopBarActions();
        bindInspectorActions();
        bindSelectionOverlayInteractions();
        bindModals();
        bindShellLayout();
        bindShellChromeMetrics();
        bindSlideTemplateActions();
        bindMessages();
        bindRuntimeGuards();
        bindUnloadWarning();
        bindGlobalShortcuts();
        bindClipboardAndDnD();
        bindContextMenu();
        bindLayerPicker();
        bindRestoreBanner();
        bindPaletteActions();
        addInspectorHelpBadges();
        if (!consumeStarterLaunchIntent()) {
          tryRestoreDraftPrompt();
        }
        startBridgeWatchdog();
        updateAssetDirectoryStatus();
        refreshUi();
      }

      /* ======================================================================
       [SCRIPT 02] boot + shell layout + theme
       ====================================================================== */
      function resolveSystemTheme() {
        return window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }

      function getThemePreferenceLabel(preference = state.themePreference) {
        switch (preference) {
          case "light":
            return "☀ Светлая";
          case "dark":
            return "🌙 Тёмная";
          default:
            return "🖥 Система";
        }
      }

      function queueThemeTransitionUnlock() {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            delete document.documentElement.dataset.themeTransition;
            delete document.documentElement.dataset.themeBooting;
          });
        });
      }

      function syncThemeDatasets(theme) {
        document.documentElement.dataset.theme = theme;
        document.documentElement.dataset.themePreference = state.themePreference;
        if (document.body) {
          document.body.dataset.theme = theme;
          document.body.dataset.themePreference = state.themePreference;
        }
        document.documentElement.style.colorScheme = theme;
      }

      function applyResolvedTheme(theme, options = {}) {
        const suppressTransitions = options.suppressTransitions !== false;
        if (suppressTransitions) {
          document.documentElement.dataset.themeTransition = "locked";
        }
        state.theme = theme === "dark" ? "dark" : "light";
        syncThemeDatasets(state.theme);
        if (els.themeToggleBtn) {
          const buttonLabel = getThemePreferenceLabel();
          const aria = `Тема редактора: ${buttonLabel}. Нажми, чтобы переключить режим темы.`;
          els.themeToggleBtn.textContent = buttonLabel;
          els.themeToggleBtn.setAttribute("aria-label", aria);
          els.themeToggleBtn.title = aria;
          if (els.topbarOverflowThemeBtn) {
            els.topbarOverflowThemeBtn.textContent = buttonLabel;
            els.topbarOverflowThemeBtn.setAttribute("aria-label", aria);
            els.topbarOverflowThemeBtn.title = aria;
          }
        }
        if (suppressTransitions) queueThemeTransitionUnlock();
      }
      /* ======================================================================
       shell storage + preference persistence
       ====================================================================== */

      function initTheme() {
        let savedPreference = "system";
        try {
          const raw = localStorage.getItem(THEME_STORAGE_KEY);
          if (THEME_PREFERENCES.includes(raw)) savedPreference = raw;
        } catch (error) {
          reportShellWarning("theme-preference-load-failed", error, {
            once: true,
          });
        }
        try {
          const rawStyle = localStorage.getItem(COPIED_STYLE_KEY);
          if (rawStyle) state.copiedStyle = JSON.parse(rawStyle);
        } catch (error) {
          reportShellWarning("copied-style-load-failed", error, {
            once: true,
          });
        }
        state.themePreference = savedPreference;
        applyResolvedTheme(
          state.themePreference === "system"
            ? resolveSystemTheme()
            : state.themePreference,
          { suppressTransitions: true },
        );

        const media = window.matchMedia
          ? window.matchMedia("(prefers-color-scheme: dark)")
          : null;
        if (media && !media.__presentationEditorThemeBound) {
          const onChange = (event) => {
            if (state.themePreference !== "system") return;
            applyResolvedTheme(event.matches ? "dark" : "light", {
              suppressTransitions: true,
            });
            showToast(
              `Системная тема изменилась: ${event.matches ? "тёмная" : "светлая"}.`,
              "success",
              { title: "Оформление", ttl: 1800 },
            );
          };
          if (typeof media.addEventListener === "function")
            media.addEventListener("change", onChange);
          else if (typeof media.addListener === "function")
            media.addListener(onChange);
          media.__presentationEditorThemeBound = true;
        }
      }

      function setThemePreference(preference, persist = true) {
        const nextPreference = THEME_PREFERENCES.includes(preference)
          ? preference
          : "system";
        state.themePreference = nextPreference;
        applyResolvedTheme(
          nextPreference === "system" ? resolveSystemTheme() : nextPreference,
          { suppressTransitions: true },
        );
        if (persist) {
          try {
            localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
          } catch (error) {
            reportShellWarning("theme-preference-save-failed", error, {
              once: true,
            });
          }
        }
      }

      function toggleTheme() {
        const currentIndex = Math.max(
          0,
          THEME_PREFERENCES.indexOf(state.themePreference),
        );
        const nextPreference =
          THEME_PREFERENCES[(currentIndex + 1) % THEME_PREFERENCES.length];
        setThemePreference(nextPreference, true);
        showToast(`Тема редактора: ${getThemePreferenceLabel(nextPreference)}.`, "success", {
          title: "Оформление",
        });
      }

      function initComplexityMode() {
        let mode = "basic";
        try {
          const raw = localStorage.getItem(UI_COMPLEXITY_STORAGE_KEY);
          if (raw === "advanced") mode = "advanced";
        } catch (error) {
          reportShellWarning("complexity-mode-load-failed", error, {
            once: true,
          });
        }
        setComplexityMode(mode, false);
      }

      function setComplexityMode(mode, persist = true) {
        state.complexityMode = mode === "advanced" ? "advanced" : "basic";
        if (persist) {
          try {
            localStorage.setItem(
              UI_COMPLEXITY_STORAGE_KEY,
              state.complexityMode,
            );
          } catch (error) {
            reportShellWarning("complexity-mode-save-failed", error, {
              once: true,
            });
          }
        }
        refreshUi();
      }

      // [LAYER-MODEL v2] selection mode toggle
      function initSelectionMode() {
        let mode = "smart";
        try {
          const raw = localStorage.getItem(SELECTION_MODE_STORAGE_KEY);
          if (raw === "container") mode = "container";
        } catch (error) {
          reportShellWarning("selection-mode-load-failed", error, {
            once: true,
          });
        }
        setSelectionMode(mode, false);
      }

      function setSelectionMode(mode, persist = true) {
        state.selectionMode = mode === "container" ? "container" : "smart";
        if (persist) {
          try {
            localStorage.setItem(SELECTION_MODE_STORAGE_KEY, state.selectionMode);
          } catch (error) {
            reportShellWarning("selection-mode-save-failed", error, {
              once: true,
            });
          }
        }
        // [LAYER-MODEL v2] sync container mode to iframe
        sendToBridge("set-selection-mode", { containerMode: state.selectionMode === "container" });
        applySelectionModeUi();
      }

      function applySelectionModeUi() {
        const isContainer = state.selectionMode === "container";
        setToggleButtonState(els.smartModeBtn, !isContainer);
        setToggleButtonState(els.containerModeBtn, isContainer);
      }

      // [v0.18.3] Preview zoom control
      function initPreviewZoom() {
        let zoom = 1.0;
        try {
          const raw = localStorage.getItem(PREVIEW_ZOOM_STORAGE_KEY);
          const parsed = parseFloat(raw);
          if (Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 2.0) {
            zoom = parsed;
          }
        } catch (error) {
          reportShellWarning("preview-zoom-load-failed", error, {
            once: true,
          });
        }
        setPreviewZoom(zoom, false);
      }

      function setPreviewZoom(zoom, persist = true) {
        const clamped = Math.max(0.25, Math.min(2.0, zoom));
        state.previewZoom = clamped;
        if (persist) {
          try {
            localStorage.setItem(PREVIEW_ZOOM_STORAGE_KEY, String(clamped));
          } catch (error) {
            reportShellWarning("preview-zoom-save-failed", error, {
              once: true,
            });
          }
        }
        applyPreviewZoom();
      }

      function applyPreviewZoom() {
        const zoom = state.previewZoom ?? 1.0;
        if (els.previewFrame) {
          // Use CSS zoom property for quality-preserving scale (v0.18.3)
          // CSS zoom triggers browser re-layout at target resolution (W3C Working Draft)
          // Unlike transform:scale() which is post-render, zoom preserves text/vector
          // crispness at all zoom levels while simplifying coordinate math
          // Requires: Firefox 126+ (May 2024), Chrome 4+, Safari 4+, Edge 12+
          if (zoom === 1.0) {
            els.previewFrame.style.zoom = "";
          } else {
            els.previewFrame.style.zoom = String(zoom);
          }
        }
        updatePreviewZoomUi();
        renderSelectionOverlay();
        positionFloatingToolbar();
      }

      function updatePreviewZoomUi() {
        const zoom = state.previewZoom ?? 1.0;
        const percent = Math.round(zoom * 100);
        if (els.zoomLevelLabel) {
          els.zoomLevelLabel.textContent = `${percent}%`;
        }
        if (els.zoomResetBtn) {
          els.zoomResetBtn.hidden = zoom === 1.0;
        }
        if (els.zoomOutBtn) {
          els.zoomOutBtn.disabled = zoom <= 0.25;
        }
        if (els.zoomInBtn) {
          els.zoomInBtn.disabled = zoom >= 2.0;
        }
      }

      function stepZoom(direction) {
        const current = state.previewZoom ?? 1.0;
        // Quality-first zoom steps: prefer whole/half fractions for sharper rendering
        // Avoid fractional scales like 0.33, 0.67 that cause excessive blur on downscale
        const steps = [0.25, 0.5, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];
        let targetIndex = steps.findIndex(s => Math.abs(s - current) < 0.01);
        if (targetIndex === -1) {
          targetIndex = steps.findIndex(s => s > current);
          if (targetIndex === -1) targetIndex = steps.length - 1;
          if (direction < 0 && targetIndex > 0) targetIndex--;
        } else {
          targetIndex = Math.max(0, Math.min(steps.length - 1, targetIndex + direction));
        }
        setPreviewZoom(steps[targetIndex], true);
      }

      function setToggleButtonState(button, active) {
        if (!button) return;
        button.classList.toggle("is-active", Boolean(active));
        button.setAttribute("aria-pressed", active ? "true" : "false");
      }

      function setDisclosureButtonState(button, expanded, controlsId = "") {
        if (!button) return;
        button.classList.toggle("is-active", Boolean(expanded));
        if (controlsId) button.setAttribute("aria-controls", controlsId);
        button.setAttribute("aria-expanded", expanded ? "true" : "false");
      }

      function shouldForceBasicAdvancedControl(node) {
        return false;
      }

      function applyComplexityModeUi() {
        const isAdvanced = state.complexityMode === "advanced";
        document.body.dataset.complexityMode = state.complexityMode;
        setToggleButtonState(els.basicModeBtn, !isAdvanced);
        setToggleButtonState(els.advancedModeBtn, isAdvanced);
        document
          .querySelectorAll('[data-ui-level="advanced"]')
          .forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            const forceVisible = shouldForceBasicAdvancedControl(node);
            const entityVisible = !node.classList.contains("is-entity-hidden");
            const visible = node.classList.contains("inspector-section")
              ? entityVisible && (isAdvanced || forceVisible)
              : isAdvanced || forceVisible;
            node.hidden = !visible;
            node.setAttribute("aria-hidden", visible ? "false" : "true");
            if (forceVisible) {
              node.setAttribute("data-force-basic-visible", "true");
            } else {
              node.removeAttribute("data-force-basic-visible");
            }
            syncShellPanelFocusableState(node, visible);
            try {
              node.inert = !visible;
            } catch (error) {
              // `inert` is optional; focusability is already synchronized via tabindex and aria state.
            }
          });
      }

      function bindTopBarActions() {
        els.openHtmlBtn?.addEventListener("click", () =>
          openOpenHtmlModal(),
        );
        els.emptyOpenBtn?.addEventListener("click", () =>
          openOpenHtmlModal(),
        );
        els.emptyPasteBtn?.addEventListener("click", () =>
          openOpenHtmlModal({ focusTarget: "paste" }),
        );
        els.emptyStarterDeckBtn?.addEventListener("click", () => {
          void loadStarterDeck("basic");
        });
        els.previewPrimaryActionBtn?.addEventListener("click", () => {
          const action = String(els.previewPrimaryActionBtn?.dataset.action || "");
          if (action === "open") {
            openOpenHtmlModal();
            return;
          }
          if (action === "edit" && state.modelDoc && state.editingSupported) {
            setMode("edit");
          }
        });
        els.previewAssistActionBtn?.addEventListener("click", () => {
          const action = String(els.previewAssistActionBtn?.dataset.action || "");
          if (action === "assets") {
            openOpenHtmlModal({ focusTarget: "assets" });
            return;
          }
          if (action === "base") {
            openOpenHtmlModal({ focusTarget: "base" });
          }
        });
        els.showSlideHtmlBtn?.addEventListener("click", openSlideHtmlEditor);
        els.reloadPreviewBtn?.addEventListener("click", () =>
          reloadPreviewShell("manual"),
        );
        els.basicModeBtn?.addEventListener("click", () =>
          setComplexityMode("basic"),
        );
        els.advancedModeBtn?.addEventListener("click", () =>
          setComplexityMode("advanced"),
        );
        // [LAYER-MODEL v2] selection mode toggle
        els.smartModeBtn?.addEventListener("click", () =>
          setSelectionMode("smart"),
        );
        els.containerModeBtn?.addEventListener("click", () =>
          setSelectionMode("container"),
        );
        // [v0.18.3] preview zoom
        els.zoomOutBtn?.addEventListener("click", () => stepZoom(-1));
        els.zoomInBtn?.addEventListener("click", () => stepZoom(1));
        els.zoomResetBtn?.addEventListener("click", () => setPreviewZoom(1.0, true));
        els.presentBtn?.addEventListener("click", presentDeck);
        els.exportBtn?.addEventListener("click", exportHtml);
        els.exportPptxBtn?.addEventListener("click", () => { void exportPptx(); });
        els.themeToggleBtn?.addEventListener("click", toggleTheme);
        els.undoBtn?.addEventListener("click", undo);
        els.redoBtn?.addEventListener("click", redo);
        els.topbarOverflowBtn?.addEventListener("click", toggleTopbarOverflow);
        els.topbarOverflowBtn?.addEventListener("keydown", (event) => {
          if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
          event.preventDefault();
          setTopbarOverflowOpen(true, { focusFirst: false });
          window.requestAnimationFrame(() =>
            focusTopbarOverflowButton(
              event.key === "ArrowUp" ? getTopbarOverflowButtons().length - 1 : 0,
            ),
          );
        });
        document.getElementById("topbarOverflowShortcutsBtn")?.addEventListener("click", () => {
          closeTopbarOverflow();
          openModal(els.shortcutsModal);
        });
        els.topbarOverflowThemeBtn?.addEventListener("click", () => {
          toggleTheme();
          closeTopbarOverflow();
        });
        els.topbarOverflowUndoBtn?.addEventListener("click", () => {
          undo();
          closeTopbarOverflow();
        });
        els.topbarOverflowRedoBtn?.addEventListener("click", () => {
          redo();
          closeTopbarOverflow();
        });
        els.topbarOverflowMenu?.addEventListener("keydown", (event) => {
          const items = getTopbarOverflowButtons();
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeTopbarOverflow({ restoreFocus: true });
            return;
          }
          if (["ArrowDown", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            focusTopbarOverflowButton((currentIndex + 1 + items.length) % items.length);
            return;
          }
          if (["ArrowUp", "ArrowLeft"].includes(event.key)) {
            event.preventDefault();
            focusTopbarOverflowButton((currentIndex - 1 + items.length) % items.length);
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusTopbarOverflowButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusTopbarOverflowButton(items.length - 1);
          }
        });
        document.addEventListener("pointerdown", (event) => {
          if (!isTopbarOverflowOpen()) return;
          if (
            event.target.closest("#topbarOverflowMenu") ||
            event.target.closest("#topbarOverflowBtn")
          ) {
            return;
          }
          closeTopbarOverflow();
        });
        window.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isTopbarOverflowOpen()) {
            event.preventDefault();
            closeTopbarOverflow({ restoreFocus: true });
          }
        });
        window.addEventListener("blur", closeTopbarOverflow);
        els.previewModeBtn?.addEventListener("click", () => setMode("preview"));
        els.editModeBtn?.addEventListener("click", () => setMode("edit"));

        els.assetDirectoryInput?.addEventListener("change", async () => {
          await setAssetDirectoryFromFiles(
            Array.from(els.assetDirectoryInput.files || []),
          );
        });

        els.loadFileBtn?.addEventListener("click", async () => {
          clearOpenHtmlStatus();
          const file = els.fileInput.files?.[0];
          if (!file) {
            setOpenHtmlStatus("Сначала выбери HTML-файл.", "warning");
            els.fileInput?.focus();
            return;
          }
          try {
            const htmlText = await file.text();
            const loaded = loadHtmlString(htmlText, file.name, {
              resetHistory: true,
              dirty: false,
              onError: (message) => setOpenHtmlStatus(message, "error"),
            });
            if (!loaded) return;
            closeModal(els.openHtmlModal);
          } catch (error) {
            console.error(error);
            reportShellWarning("open-html-file-read-failed", error, {
              once: true,
              diagnostic: false,
            });
            setOpenHtmlStatus("Не удалось прочитать HTML-файл.", "error");
          }
        });

        els.loadPastedHtmlBtn?.addEventListener("click", () => {
          clearOpenHtmlStatus();
          const htmlText = els.pasteHtmlTextarea.value.trim();
          if (!htmlText) {
            setOpenHtmlStatus("Вставь HTML-код в текстовое поле.", "warning");
            els.pasteHtmlTextarea?.focus();
            return;
          }
          const loaded = loadHtmlString(htmlText, "Вставленный HTML", {
            resetHistory: true,
            dirty: false,
            onError: (message) => setOpenHtmlStatus(message, "error"),
          });
          if (!loaded) return;
          closeModal(els.openHtmlModal);
        });

        els.loadVideoFileBtn?.addEventListener(
          "click",
          insertVideoFromSelectedFile,
        );
        els.insertVideoUrlBtn?.addEventListener(
          "click",
          insertVideoFromUrlInput,
        );
        els.videoUrlInput?.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            insertVideoFromUrlInput();
          }
        });
      }

      function bindModals() {
        document.querySelectorAll("[data-close-modal]").forEach((button) => {
          button.addEventListener("click", () => {
            const target = document.getElementById(button.dataset.closeModal);
            if (target) closeModal(target);
          });
        });

        [els.openHtmlModal, els.htmlEditorModal, els.videoInsertModal, els.shortcutsModal].forEach(
          (modal, index) => {
            if (!modal) return;
            modal.setAttribute("role", "dialog");
            modal.setAttribute("aria-modal", "true");
            if (!modal.hasAttribute("tabindex"))
              modal.setAttribute("tabindex", "-1");
            const heading = modal.querySelector(".modal-header h3");
            if (heading) {
              if (!heading.id) heading.id = `modalTitle-vnext-${index + 1}`;
              modal.setAttribute("aria-labelledby", heading.id);
            }
            modal.addEventListener("click", (event) => {
              if (event.target === modal) closeModal(modal);
            });
          },
        );

        document.addEventListener("keydown", (event) => {
          if (event.key !== "Tab") return;
          const modal = document.querySelector(".modal.is-open");
          if (!(modal instanceof HTMLElement)) return;
          const focusables = getFocusableElements(modal);
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          const active = document.activeElement;
          if (event.shiftKey && (active === first || active === modal)) {
            event.preventDefault();
            last.focus({ preventScroll: true });
          } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus({ preventScroll: true });
          }
        });
      }

      function bindShellLayout() {
        document.querySelectorAll("[data-close-panel]").forEach((button) => {
          button.addEventListener("click", () =>
            setShellPanelState(button.dataset.closePanel, false),
          );
        });
        els.panelBackdrop?.addEventListener("click", () => closeShellPanels());
        els.mobileSlidesBtn?.addEventListener("click", () =>
          toggleShellPanel("left"),
        );
        els.mobileInspectorBtn?.addEventListener("click", () =>
          toggleShellPanel("right"),
        );
        els.mobilePreviewBtn?.addEventListener("click", () => {
          closeShellPanels();
          setMode("preview");
        });
        els.mobileEditBtn?.addEventListener("click", () => {
          closeShellPanels();
          if (!state.modelDoc) {
            openOpenHtmlModal();
            return;
          }
          setMode("edit");
        });
        els.mobileInsertBtn?.addEventListener("click", () => {
          closeShellPanels();
          if (!state.modelDoc) {
            openOpenHtmlModal();
            return;
          }
          if (!state.previewReady) {
            showToast("Сначала дождись полной загрузки превью.", "warning", {
              title: "Превью ещё готовится",
            });
            return;
          }
          if (state.mode !== "edit") setMode("edit");
          toggleInsertPalette();
        });
        const mq = window.matchMedia
          ? window.matchMedia("(min-width: 1025px)")
          : null;
        const handleMqChange = () => {
          if (mq && mq.matches) closeShellPanels();
          else applyShellPanelState();
        };
        if (mq && !mq.__presentationEditorShellBound) {
          if (typeof mq.addEventListener === "function")
            mq.addEventListener("change", handleMqChange);
          else if (typeof mq.addListener === "function")
            mq.addListener(handleMqChange);
          mq.__presentationEditorShellBound = true;
        }
        applyShellPanelState();
      }

      function isCompactShell() {
        return window.matchMedia
          ? window.matchMedia("(max-width: 1024px)").matches
          : window.innerWidth <= 1024;
      }

      function syncShellPanelFocusableState(panel, shouldShow) {
        if (!panel) return;
        panel
          .querySelectorAll(
            'button, [href], input, select, textarea, [tabindex], [contenteditable="true"]',
          )
          .forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            if (shouldShow) {
              if (!el.hasAttribute("data-shell-tabindex-restore")) return;
              const prevTabIndex = el.getAttribute("data-shell-tabindex-restore");
              el.removeAttribute("data-shell-tabindex-restore");
              if (prevTabIndex === "") el.removeAttribute("tabindex");
              else el.setAttribute("tabindex", prevTabIndex);
              return;
            }
            if (!el.hasAttribute("data-shell-tabindex-restore")) {
              el.setAttribute(
                "data-shell-tabindex-restore",
                el.getAttribute("tabindex") ?? "",
              );
            }
            el.setAttribute("tabindex", "-1");
          });
      }

      function setElementInertState(element, inert) {
        if (!element || !("inert" in element)) return;
        element.inert = inert;
      }

      function applyShellPanelState() {
        const compact = isCompactShell();
        const workflow = state.editorWorkflow || getEditorWorkflowState();
        const shellPanelsEnabled = workflow !== "empty";
        const leftOpen = compact && state.leftPanelOpen;
        const rightOpen = compact && state.rightPanelOpen;
        document.body.dataset.leftPanelOpen = leftOpen ? "true" : "false";
        document.body.dataset.rightPanelOpen = rightOpen ? "true" : "false";
        syncShellViewportLock();
        if (els.panelBackdrop) {
          const showBackdrop = shellPanelsEnabled && (leftOpen || rightOpen);
          els.panelBackdrop.hidden = !showBackdrop;
          els.panelBackdrop.setAttribute(
            "aria-hidden",
            showBackdrop ? "false" : "true",
          );
        }
        syncShellPanelVisibility(
          els.slidesPanel,
          shellPanelsEnabled && (!compact || leftOpen),
          {
            returnFocusEl: els.mobileSlidesBtn,
          },
        );
        syncShellPanelVisibility(
          els.inspectorPanel,
          shellPanelsEnabled && (!compact || rightOpen),
          {
            returnFocusEl: els.mobileInspectorBtn,
          },
        );
        setDisclosureButtonState(els.mobileSlidesBtn, leftOpen, "slidesPanel");
        setDisclosureButtonState(
          els.mobileInspectorBtn,
          rightOpen,
          "inspectorPanel",
        );
      }

      function syncShellPanelVisibility(panel, shouldShow, options = {}) {
        if (!panel) return;
        if (
          !shouldShow &&
          panel.contains(document.activeElement) &&
          options.returnFocusEl instanceof HTMLElement
        ) {
          window.requestAnimationFrame(() =>
            options.returnFocusEl.focus({ preventScroll: true }),
          );
        }
        panel.hidden = !shouldShow;
        panel.setAttribute("aria-hidden", shouldShow ? "false" : "true");
        syncShellPanelFocusableState(panel, shouldShow);
        setElementInertState(panel, !shouldShow);
      }

      function setShellPanelState(side, open) {
        closeTransientShellUi();
        if (side === "left") state.leftPanelOpen = Boolean(open);
        if (side === "right") {
          state.rightPanelOpen = Boolean(open);
          state.rightPanelUserOpen = Boolean(open);
        }
        if (side === "left" && open) {
          state.rightPanelOpen = false;
          state.rightPanelUserOpen = false;
        }
        if (side === "right" && open) state.leftPanelOpen = false;
        if (!isCompactShell()) {
          state.leftPanelOpen = false;
          state.rightPanelOpen = false;
          state.rightPanelUserOpen = false;
        }
        applyShellPanelState();
      }

      function toggleShellPanel(side) {
        closeTransientShellUi();
        if (side === "left") setShellPanelState("left", !state.leftPanelOpen);
        if (side === "right")
          setShellPanelState("right", !state.rightPanelOpen);
      }

      function closeShellPanels(options = {}) {
        const keep = normalizeShellSurfaceKeep(options.keep);
        if (!keep.has("left-panel")) state.leftPanelOpen = false;
        if (!keep.has("right-panel")) {
          state.rightPanelOpen = false;
          state.rightPanelUserOpen = false;
        }
        applyShellPanelState();
        if (options.includeTransient !== false) {
          closeTransientShellUi({ keep: Array.from(keep) });
        }
      }


      function getSlideTemplateButtons() {
        return Array.from(
          els.slideTemplateBar?.querySelectorAll("button[data-slide-template]") ||
            [],
        );
      }

      function isSlideTemplateBarOpen() {
        return Boolean(els.slideTemplateBar?.classList.contains("is-open"));
      }

      function setSlideTemplateBarOpen(open, options = {}) {
        if (!els.slideTemplateBar || !els.toggleSlideTemplateBarBtn) return;
        const active = Boolean(open);
        state.slideTemplateBarOpen = active;
        els.slideTemplateBar.classList.toggle("is-open", active);
        els.slideTemplateBar.setAttribute("aria-hidden", active ? "false" : "true");
        els.toggleSlideTemplateBarBtn.setAttribute(
          "aria-expanded",
          active ? "true" : "false",
        );
        const items = getSlideTemplateButtons();
        applyRovingTabindex(items, active ? 0 : -1);
        if (active) {
          closeShellPanels({ keep: "slide-template" });
          closeTransientShellUi({ keep: "slide-template" });
          scheduleShellPopoverLayout();
          if (options.focusFirst !== false) {
            window.requestAnimationFrame(() => items[0]?.focus({ preventScroll: true }));
          }
        } else if (options.restoreFocus) {
          window.requestAnimationFrame(() =>
            els.toggleSlideTemplateBarBtn.focus({ preventScroll: true }),
          );
        }
      }

      function closeSlideTemplateBar(options = {}) {
        setSlideTemplateBarOpen(false, options);
      }

      function bindSlideTemplateActions() {
        els.toggleSlideTemplateBarBtn?.addEventListener("click", () => {
          if (!canUseStaticSlideModel()) {
            showToast(
              "Для этого deck нет безопасной статической структуры слайдов. Добавление шаблонов слайдов доступно только там, где modelDoc видит реальные slide-root узлы.",
              "warning",
              { title: "Шаблоны слайдов" },
            );
            return;
          }
          if (state.mode !== "edit") setMode("edit");
          setSlideTemplateBarOpen(!isSlideTemplateBarOpen());
        });

        getSlideTemplateButtons().forEach((button) => {
          button.addEventListener("click", () =>
            insertSlideFromTemplate(button.dataset.slideTemplate || "section"),
          );
        });

        els.slideTemplateBar?.addEventListener("keydown", (event) => {
          const items = getSlideTemplateButtons();
          if (!items.length) return;
          const currentIndex = items.indexOf(document.activeElement);
          if (event.key === "Escape") {
            event.preventDefault();
            closeSlideTemplateBar({ restoreFocus: true });
            return;
          }
          if (["ArrowRight", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            focusSlideTemplateButton((currentIndex + 1 + items.length) % items.length);
            return;
          }
          if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            focusSlideTemplateButton((currentIndex - 1 + items.length) % items.length);
            return;
          }
          if (event.key === "Home") {
            event.preventDefault();
            focusSlideTemplateButton(0);
            return;
          }
          if (event.key === "End") {
            event.preventDefault();
            focusSlideTemplateButton(items.length - 1);
          }
        });

        document.addEventListener("pointerdown", (event) => {
          if (!isSlideTemplateBarOpen()) return;
          if (
            event.target.closest("#slideTemplateBar") ||
            event.target.closest("#toggleSlideTemplateBarBtn")
          ) {
            return;
          }
          closeSlideTemplateBar();
        });

        window.addEventListener("keydown", (event) => {
          if (event.key === "Escape" && isSlideTemplateBarOpen()) {
            event.preventDefault();
            closeSlideTemplateBar({ restoreFocus: true });
          }
        });
      }

      function focusSlideTemplateButton(index) {
        const items = getSlideTemplateButtons();
        if (!items.length) return;
        const nextIndex = Math.max(0, Math.min(items.length - 1, index));
        applyRovingTabindex(items, nextIndex);
        items[nextIndex].focus({ preventScroll: true });
      }

      function canUseStaticSlideModel() {
        return Boolean(
          state.modelDoc?.querySelector("[data-editor-slide-id]") &&
            state.staticSlideSelector,
        );
      }

      function getCurrentSlideModelNode() {
        if (!state.modelDoc || !state.activeSlideId) return null;
        return state.modelDoc.querySelector(
          `[data-editor-slide-id="${cssEscape(state.activeSlideId)}"]`,
        );
      }

      function getSlideModelNodeById(slideId) {
        if (!state.modelDoc || !slideId) return null;
        return state.modelDoc.querySelector(
          `[data-editor-slide-id="${cssEscape(slideId)}"]`,
        );
      }

      function getStaticSlideModelNodes() {
        if (!state.modelDoc) return [];
        return Array.from(state.modelDoc.querySelectorAll("[data-editor-slide-id]"));
      }

      function getNextSlideId() {
        const values = getStaticSlideModelNodes().map((slide) => {
          const match = String(slide.getAttribute("data-editor-slide-id") || "").match(
            /slide-(\d+)/,
          );
          return match ? Number(match[1]) : 0;
        });
        return `slide-${Math.max(0, ...values) + 1}`;
      }

      function getNextNodeSeqInModel() {
        const values = Array.from(
          state.modelDoc?.querySelectorAll("[data-editor-node-id]") || [],
        ).map((node) => {
          const match = String(node.getAttribute("data-editor-node-id") || "").match(
            /node-(\d+)/,
          );
          return match ? Number(match[1]) : 0;
        });
        return Math.max(0, ...values) + 1;
      }

      function assignEditorNodeIdsInModel(root) {
        if (!(root instanceof Element) || !state.modelDoc) return;
        const slideRoot =
          (root.hasAttribute(EDITOR_SLIDE_ID_ATTR) ? root : null) ||
          root.closest(`[${EDITOR_SLIDE_ID_ATTR}]`) ||
          root;
        const slideIndex = Math.max(0, getStaticSlideModelNodes().indexOf(slideRoot));
        const usedSlideIds = new Set();
        getStaticSlideModelNodes().forEach((slide) => {
          if (slide === slideRoot || slideRoot.contains(slide)) return;
          const slideId = normalizeImportedIdentity(
            slide.getAttribute(EDITOR_SLIDE_ID_ATTR) || "",
          );
          if (slideId) usedSlideIds.add(slideId);
        });
        const usedNodeIds = new Set();
        Array.from(state.modelDoc.querySelectorAll(`[${EDITOR_NODE_ID_ATTR}]`)).forEach(
          (node) => {
            if (!(node instanceof Element)) return;
            if (node === slideRoot || slideRoot.contains(node)) return;
            const nodeId = normalizeImportedIdentity(
              node.getAttribute(EDITOR_NODE_ID_ATTR) || "",
            );
            if (nodeId) usedNodeIds.add(nodeId);
          },
        );
        const slideId = resolveImportedSlideIdentity(slideRoot, slideIndex, usedSlideIds);
        slideRoot.setAttribute(EDITOR_SLIDE_ID_ATTR, slideId);
        slideRoot.setAttribute(EDITOR_ENTITY_KIND_ATTR, "slide-root");
        slideRoot.setAttribute(EDITOR_EDITABLE_ATTR, "false");
        applyImportPolicyHint(slideRoot, resolveImportedPolicyHint(slideRoot, "slide-root"));
        collectCandidateElements(slideRoot).forEach((node, nodeIndex) => {
          const entityKind = resolveImportedEntityKind(node, slideRoot);
          const editable = resolveImportedEditability(node, entityKind);
          const nodeId = resolveImportedNodeIdentity(
            node,
            slideRoot,
            slideId,
            nodeIndex,
            usedNodeIds,
          );
          node.setAttribute(EDITOR_NODE_ID_ATTR, nodeId);
          node.setAttribute(EDITOR_ENTITY_KIND_ATTR, entityKind);
          node.setAttribute(EDITOR_EDITABLE_ATTR, editable ? "true" : "false");
          applyImportPolicyHint(node, resolveImportedPolicyHint(node, entityKind));
        });
      }

      function normalizeDomIdLocal(value) {
        return String(value || "").replace(/\s+/g, "-").trim();
      }

      function collectUsedDomIdsInModel(exceptRoot = null) {
        const used = new Set();
        state.modelDoc?.querySelectorAll("[id]").forEach((node) => {
          if (
            exceptRoot instanceof Element &&
            (node === exceptRoot || exceptRoot.contains(node))
          ) {
            return;
          }
          const id = normalizeDomIdLocal(node.getAttribute("id") || "");
          if (id) used.add(id);
        });
        return used;
      }

      function claimUniqueDomIdLocal(baseId, usedIds) {
        const normalized = normalizeDomIdLocal(baseId);
        if (!normalized) return "";
        let candidate = normalized;
        let index = 2;
        while (usedIds.has(candidate)) {
          candidate = `${normalized}-copy${index > 2 ? `-${index}` : ""}`;
          index += 1;
        }
        usedIds.add(candidate);
        return candidate;
      }

      function ensureUniqueDomIdsInModel(root, exceptRoot = null) {
        if (!(root instanceof Element)) return;
        const usedIds = collectUsedDomIdsInModel(exceptRoot);
        const nodes = [];
        if (root.id) nodes.push(root);
        root.querySelectorAll("[id]").forEach((node) => nodes.push(node));
        nodes.forEach((node) => {
          const uniqueId = claimUniqueDomIdLocal(node.id, usedIds);
          if (uniqueId) node.id = uniqueId;
          else node.removeAttribute("id");
        });
      }

      function stripRuntimeSlideState(slide) {
        if (!(slide instanceof Element)) return;
        [
          "active",
          "current",
          "present",
          "past",
          "future",
          "visible",
          "hidden",
          "next",
          "previous",
        ].forEach((className) => slide.classList.remove(className));
        ["aria-hidden", "aria-current", "hidden", "tabindex"].forEach((attr) =>
          slide.removeAttribute(attr),
        );
      }

      function copyStructuralSlideAttributes(source, target) {
        if (!(source instanceof Element) || !(target instanceof Element)) return;
        Array.from(source.attributes).forEach((attr) => {
          if (
            attr.name === "id" ||
            attr.name === "style" ||
            attr.name === "hidden" ||
            attr.name === "aria-hidden" ||
            attr.name === "aria-current" ||
            attr.name === "tabindex" ||
            /^data-editor-/.test(attr.name)
          ) {
            return;
          }
          target.setAttribute(attr.name, attr.value);
        });
        if (source.classList?.length) {
          const runtimeClasses = new Set([
            "active",
            "current",
            "present",
            "past",
            "future",
            "visible",
            "hidden",
            "next",
            "previous",
          ]);
          target.className = Array.from(source.classList)
            .filter((className) => !runtimeClasses.has(className))
            .join(" ");
        }
      }

      function getSlideTemplateInnerHtml(kind) {
        switch (kind) {
          case "title":
            return `<div style="display:flex; flex-direction:column; gap:16px; justify-content:center; min-height:100%;"><h1>Новый заголовок</h1><p>Подзаголовок или краткое описание.</p></div>`;
          case "section":
            return `<div style="display:flex; flex-direction:column; gap:16px;"><h2>Новый раздел</h2><p>Короткое описание раздела.</p></div>`;
          case "bullets":
            return `<div style="display:flex; flex-direction:column; gap:16px;"><h2>Ключевые пункты</h2><ul><li>Первый тезис</li><li>Второй тезис</li><li>Третий тезис</li></ul></div>`;
          case "media":
            return `<div style="display:grid; gap:18px; align-items:center;"><h2>Слайд с медиа</h2><div style="display:flex; align-items:center; justify-content:center; min-height:240px; border:1px dashed rgba(38,103,255,.35); border-radius:14px; background:rgba(38,103,255,.06);">Добавь изображение или видео</div><p>Подпись к медиа.</p></div>`;
          case "two-column":
            return `<div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; align-items:start;"><div><h2>Левая колонка</h2><p>Текст левой колонки.</p></div><div><h2>Правая колонка</h2><p>Текст правой колонки.</p></div></div>`;
          default:
            return `<div style="display:flex; flex-direction:column; gap:16px;"><h2>Новый слайд</h2><p>Заполни содержимое этого слайда.</p></div>`;
        }
      }

      function createSlideRootFromTemplate(kind) {
        if (!state.modelDoc) return null;
        const templateSource =
          getCurrentSlideModelNode() || getStaticSlideModelNodes()[0] || null;
        const slideTag = templateSource?.tagName || "SECTION";
        const slide = state.modelDoc.createElement(slideTag.toLowerCase());
        if (templateSource) copyStructuralSlideAttributes(templateSource, slide);
        stripRuntimeSlideState(slide);
        stripInheritedSlideRuntimeAttrs(slide);
        slide.removeAttribute("id");
        slide.removeAttribute("style");
        slide.removeAttribute(AUTHOR_SLIDE_ID_ATTRS[0]);
        slide.removeAttribute("data-slide-title");
        slide.removeAttribute("data-slide-padding-preset");
        slide.removeAttribute("data-slide-preset");
        const nextSlideId = getNextSlideId();
        slide.setAttribute("data-editor-slide-id", nextSlideId);
        if (state.staticSlideSelector === "[data-slide-id]") {
          const authoredSlideId = claimUniqueAuthoredSlideIdInModel(nextSlideId);
          if (authoredSlideId) {
            slide.setAttribute(AUTHOR_SLIDE_ID_ATTRS[0], authoredSlideId);
          }
        }
        slide.setAttribute("data-slide-preset", kind);
        slide.innerHTML = getSlideTemplateInnerHtml(kind);
        ensureUniqueDomIdsInModel(slide);
        assignEditorNodeIdsInModel(slide);
        return slide;
      }

      function slideHasMeaningfulContent(slide) {
        if (!(slide instanceof Element)) return false;
        const text = String(slide.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        if (text) return true;
        return Boolean(
          slide.querySelector(
            "img, video, iframe, svg, canvas, table, ul, ol, blockquote, pre, figure",
          ),
        );
      }

      function applyCurrentSlidePreset(kind) {
        const slide = getCurrentSlideModelNode();
        const nextPreset = String(kind || "").trim();
        if (!slide || !nextPreset) return;
        const currentPreset = getSlidePresetValue(slide);
        const shouldConfirm =
          slideHasMeaningfulContent(slide) && currentPreset !== nextPreset;
        if (
          shouldConfirm &&
          !window.confirm(
            `Preset ${getSlidePresetLabel(nextPreset) || nextPreset} заменит текущее содержимое слайда. Slide-level настройки сохранятся. Продолжить?`,
          )
        ) {
          return;
        }
        slide.innerHTML = getSlideTemplateInnerHtml(nextPreset);
        slide.setAttribute("data-slide-preset", nextPreset);
        ensureUniqueDomIdsInModel(slide, slide);
        assignEditorNodeIdsInModel(slide);
        clearSelectedElementState();
        replaceCurrentSlideInPreview("slide-preset-apply");
        showToast("Preset применён к текущему слайду. Undo вернёт прошлую версию.", "success", {
          title: "Слайды",
        });
      }

      function insertSlideFromTemplate(kind) {
        if (!canUseStaticSlideModel()) {
          showToast(
            "У этого deck нет безопасной статической структуры слайдов для вставки готовых slide templates.",
            "warning",
            { title: "Слайды" },
          );
          return;
        }
        const currentSlide = getCurrentSlideModelNode();
        const staticSlides = getStaticSlideModelNodes();
        const parent = currentSlide?.parentElement || staticSlides[0]?.parentElement;
        if (!parent) return;
        const slide = createSlideRootFromTemplate(kind);
        if (!slide) return;
        if (currentSlide) currentSlide.after(slide);
        else parent.appendChild(slide);
        syncStaticSlideOrderingMetadata();
        const slideId = slide.getAttribute("data-editor-slide-id");
        stageSlideActivationRequest(slideId, {
          source: "slide-template-model",
        });
        syncSlideRegistry({ currentActiveId: slideId });
        commitChange(`slide-template:${kind}`, { snapshotMode: "immediate" });
        rebuildPreviewKeepingContext(slideId);
        closeSlideTemplateBar();
        showToast("Новый слайд добавлен после текущего.", "success", {
          title: "Слайды",
        });
      }

      function getElementPathWithinRoot(root, node) {
        if (!(root instanceof Element) || !(node instanceof Element)) return null;
        if (root === node) return [];
        if (!root.contains(node)) return null;
        const path = [];
        let current = node;
        while (current && current !== root) {
          const parent = current.parentElement;
          if (!parent) return null;
          path.unshift(Array.from(parent.children).indexOf(current));
          current = parent;
        }
        return path;
      }

      function findElementByPath(root, path) {
        if (!(root instanceof Element) || !Array.isArray(path)) return null;
        let current = root;
        for (const index of path) {
          current = current.children[index] || null;
          if (!(current instanceof Element)) return null;
        }
        return current;
      }

      function cloneSlideForDuplicate(slideId = state.activeSlideId) {
        const currentSlide = getSlideModelNodeById(slideId);
        if (!currentSlide) return null;
        const authoredSlideId = readNonEmptyAttribute(
          currentSlide,
          AUTHOR_SLIDE_ID_ATTRS,
        );
        const selectedNode =
          slideId === state.activeSlideId &&
          state.selectedNodeId &&
          currentSlide.querySelector(
            `[data-editor-node-id="${cssEscape(state.selectedNodeId)}"]`,
          );
        const selectedPath = getElementPathWithinRoot(currentSlide, selectedNode);
        const clone = currentSlide.cloneNode(true);
        stripRuntimeSlideState(clone);
        stripInheritedSlideRuntimeAttrs(clone);
        stripAuthoredIdentityAttrs(clone, { stripSlideId: true });
        clone.removeAttribute("data-editor-slide-id");
        clone
          .querySelectorAll("[data-editor-node-id]")
          .forEach((node) => node.removeAttribute("data-editor-node-id"));
        const nextSlideId = getNextSlideId();
        clone.setAttribute("data-editor-slide-id", nextSlideId);
        if (authoredSlideId || state.staticSlideSelector === "[data-slide-id]") {
          const duplicateAuthorSlideId = claimUniqueAuthoredSlideIdInModel(
            authoredSlideId || nextSlideId,
          );
          if (duplicateAuthorSlideId) {
            clone.setAttribute(AUTHOR_SLIDE_ID_ATTRS[0], duplicateAuthorSlideId);
          }
        }
        const titleOverride = getSlideTitleOverride(clone);
        if (titleOverride) clone.setAttribute("data-slide-title", `${titleOverride} (копия)`);
        ensureUniqueDomIdsInModel(clone, currentSlide);
        assignEditorNodeIdsInModel(clone);
        const clonedSelectedNode = findElementByPath(clone, selectedPath);
        return {
          clone,
          clonedSelectedNodeId:
            clonedSelectedNode?.getAttribute("data-editor-node-id") || null,
        };
      }

      function cloneCurrentSlideForDuplicate() {
        return cloneSlideForDuplicate(state.activeSlideId);
      }

      function duplicateSlideById(slideId) {
        if (!canUseStaticSlideModel()) return;
        const currentSlide = getSlideModelNodeById(slideId);
        const duplicatePayload = cloneSlideForDuplicate(slideId);
        const clone = duplicatePayload?.clone || null;
        if (!currentSlide || !clone) return;
        currentSlide.after(clone);
        syncStaticSlideOrderingMetadata();
        const cloneId = clone.getAttribute("data-editor-slide-id");
        if (duplicatePayload?.clonedSelectedNodeId) {
          stagePreviewSelectionRestore(duplicatePayload.clonedSelectedNodeId, {
            slideId: cloneId,
          });
        }
        stageSlideActivationRequest(cloneId, {
          source: "slide-duplicate-model",
        });
        syncSlideRegistry({ currentActiveId: cloneId });
        commitChange("slide-duplicate", { snapshotMode: "immediate" });
        rebuildPreviewKeepingContext(cloneId);
        showToast("Текущий слайд продублирован.", "success", {
          title: "Слайды",
        });
      }

      function duplicateCurrentSlide() {
        duplicateSlideById(state.activeSlideId);
      }

      function deleteSlideById(slideId) {
        if (!canUseStaticSlideModel()) return;
        const slides = getStaticSlideModelNodes();
        const currentSlide = getSlideModelNodeById(slideId);
        if (!currentSlide) return;
        if (slides.length <= 1) {
          showToast("Нельзя удалить единственный слайд.", "warning", {
            title: "Слайды",
          });
          return;
        }
        const currentIndex = slides.findIndex(
          (slide) =>
            slide.getAttribute("data-editor-slide-id") === slideId,
        );
        const nextSlide =
          slides[currentIndex + 1] || slides[currentIndex - 1] || null;
        currentSlide.remove();
        syncStaticSlideOrderingMetadata();
        const nextSlideId =
          nextSlide?.getAttribute("data-editor-slide-id") || null;
        state.pendingPreviewSelection = null;
        clearSelectedElementState();
        stageSlideActivationRequest(nextSlideId, {
          source: "slide-delete-model",
        });
        syncSlideRegistry({ currentActiveId: nextSlideId });
        commitChange("slide-delete", { snapshotMode: "immediate" });
        rebuildPreviewKeepingContext(nextSlideId);
        showToast("Слайд удалён. При необходимости используй Undo.", "success", {
          title: "Слайды",
        });
      }

      function deleteCurrentSlide() {
        deleteSlideById(state.activeSlideId);
      }

      function replaceCurrentSlideInPreview(reason = "slide-style") {
        const slide = getCurrentSlideModelNode();
        if (!slide) return;
        const slideId = slide.getAttribute("data-editor-slide-id");
        commitChange(reason);
        syncSlideRegistry({ currentActiveId: slideId });
        renderSlidesList();
        refreshUi();
        const sent = sendToBridge("replace-slide-html", {
          slideId,
          html: slide.outerHTML,
        });
        if (!sent) rebuildPreviewKeepingContext(slideId);
      }

      function applyCurrentSlideTitleOverride(value) {
        const slide = getCurrentSlideModelNode();
        if (!slide) return;
        const title = String(value || "").trim();
        if (title) slide.setAttribute("data-slide-title", title);
        else slide.removeAttribute("data-slide-title");
        replaceCurrentSlideInPreview("slide-title");
      }

      function applyCurrentSlideBackground(value) {
        const slide = getCurrentSlideModelNode();
        if (!slide) return;
        slide.style.backgroundColor = value || "";
        replaceCurrentSlideInPreview("slide-background");
      }

      function getSlidePaddingPresetValue(preset) {
        switch (preset) {
          case "none":
            return "0px";
          case "compact":
            return "24px";
          case "default":
            return "48px";
          case "spacious":
            return "72px";
          default:
            return "";
        }
      }

      function applyCurrentSlidePaddingPreset(preset) {
        const slide = getCurrentSlideModelNode();
        if (!slide) return;
        const nextValue = getSlidePaddingPresetValue(preset);
        if (preset) slide.setAttribute("data-slide-padding-preset", preset);
        else slide.removeAttribute("data-slide-padding-preset");
        slide.style.padding = nextValue;
        replaceCurrentSlideInPreview("slide-padding");
      }


      function cleanupAssetResolver() {
        (state.assetObjectUrls || []).forEach((url) => {
          revokeEditorObjectUrl(url, "asset-resolver-url-revoke-failed");
        });
        state.assetObjectUrls = [];
        state.assetResolverMap = null;
        state.assetResolverLabel = "";
        state.assetFileCount = 0;
      }

      function normalizeAssetPath(path) {
        let normalized = String(path || "").trim();
        try {
          normalized = decodeURIComponent(normalized);
        } catch (error) {
          // Malformed percent-encoding should not block raw-path normalization.
        }
        normalized = normalized
          .replace(/[#?].*$/, "")
          .replace(/\\/g, "/")
          .replace(/^\.\//, "")
          .replace(/^\/+/, "")
          .trim();
        return normalized;
      }

      function isExternalLikeUrl(value) {
        const trimmed = String(value || "").trim();
        return (
          !trimmed ||
          /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:|javascript:|mailto:|tel:)/i.test(
            trimmed,
          ) ||
          trimmed.startsWith("/")
        );
      }

      function isCssAsset(filePath, file) {
        return (
          /\.css(?:$|[?#])/i.test(filePath) ||
          String(file?.type || "").includes("text/css")
        );
      }

      function addAssetResolverVariants(map, filePath, url) {
        const normalized = normalizeAssetPath(filePath);
        if (!normalized) return;
        const variants = new Set([normalized, "./" + normalized]);
        const parts = normalized.split("/");
        if (parts.length > 1) variants.add(parts.slice(1).join("/"));
        variants.forEach((variant) => map.set(variant, url));
      }

      function resolveAssetCandidatePath(rawPath, baseDir = "") {
        const value = normalizeAssetPath(rawPath);
        if (!value) return "";
        if (!baseDir) return value;
        try {
          const baseUrl = new URL(
            baseDir.endsWith("/") ? baseDir : baseDir + "/",
            "https://assets.invalid/",
          );
          const resolved = new URL(value, baseUrl);
          return normalizeAssetPath(resolved.pathname.replace(/^\//, ""));
        } catch (error) {
          return normalizeAssetPath(baseDir.replace(/\/?$/, "/") + value);
        }
      }

      function rewriteCssImportsInText(cssText, baseDir = "") {
        return String(cssText || "").replace(
          /@import\s+(url\()?\s*(['"]?)([^'"\)\s]+)\2\s*\)?/gi,
          (full, urlWrapper, quote, rawUrl) => {
            if (isExternalLikeUrl(rawUrl)) return full;
            const resolved = resolveAssetObjectUrl(rawUrl, baseDir);
            if (!resolved) return full;
            return full.replace(rawUrl, resolved);
          },
        );
      }

      function rewriteCssUrlsInText(cssText, baseDir = "") {
        let next = rewriteCssImportsInText(cssText, baseDir);
        next = next.replace(
          /url\((['"]?)([^'"\)]+)\1\)/gi,
          (full, quote, rawUrl) => {
            if (isExternalLikeUrl(rawUrl)) return full;
            const resolved = resolveAssetObjectUrl(rawUrl, baseDir);
            if (!resolved) return full;
            return `url(${quote || '"'}${resolved}${quote || '"'})`;
          },
        );
        return next;
      }

      function rewriteSrcsetValue(srcset, baseDir = "") {
        return String(srcset || "")
          .split(",")
          .map((part) => {
            const trimmed = part.trim();
            if (!trimmed) return trimmed;
            const pieces = trimmed.split(/\s+/);
            const rawUrl = pieces.shift();
            if (!rawUrl || isExternalLikeUrl(rawUrl)) return trimmed;
            const resolved = resolveAssetObjectUrl(rawUrl, baseDir);
            return resolved ? [resolved, ...pieces].join(" ") : trimmed;
          })
          .join(", ");
      }

      function resolveAssetObjectUrl(rawPath, baseDir = "") {
        if (!state.assetResolverMap) return null;
        const direct = normalizeAssetPath(rawPath);
        if (state.assetResolverMap.has(direct))
          return state.assetResolverMap.get(direct);
        const candidate = resolveAssetCandidatePath(rawPath, baseDir);
        if (state.assetResolverMap.has(candidate))
          return state.assetResolverMap.get(candidate);
        const withoutDot = candidate.replace(/^\.\//, "");
        if (state.assetResolverMap.has(withoutDot))
          return state.assetResolverMap.get(withoutDot);
        return null;
      }

      async function setAssetDirectoryFromFiles(files) {
        const list = Array.from(files || []);
        cleanupAssetResolver();
        if (!list.length) {
          updateAssetDirectoryStatus();
          if (state.modelDoc) rebuildPreviewKeepingContext(state.activeSlideId);
          return;
        }
        const fileByPath = new Map();
        list.forEach((file) => {
          const filePath = normalizeAssetPath(
            file.webkitRelativePath || file.name,
          );
          if (filePath) fileByPath.set(filePath, file);
        });
        const finalMap = new Map();
        const rawUrlMap = new Map();
        const objectUrls = [];
        for (const [filePath, file] of fileByPath.entries()) {
          if (isCssAsset(filePath, file)) continue;
          const objectUrl = URL.createObjectURL(file);
          rawUrlMap.set(filePath, objectUrl);
          objectUrls.push(objectUrl);
          addAssetResolverVariants(finalMap, filePath, objectUrl);
        }
        for (const [filePath, file] of fileByPath.entries()) {
          if (!isCssAsset(filePath, file)) continue;
          let cssText = await file.text();
          const baseDir = filePath.includes("/")
            ? filePath.slice(0, filePath.lastIndexOf("/") + 1)
            : "";
          cssText = rewriteCssImportsInText(cssText, baseDir).replace(
            /url\((['"]?)([^'"\)]+)\1\)/gi,
            (full, quote, rawUrl) => {
              if (isExternalLikeUrl(rawUrl)) return full;
              const candidate = resolveAssetCandidatePath(rawUrl, baseDir);
              const resolved =
                rawUrlMap.get(candidate) ||
                finalMap.get(candidate) ||
                resolveAssetObjectUrl(candidate, "");
              if (!resolved) return full;
              return `url(${quote || '"'}${resolved}${quote || '"'})`;
            },
          );
          const cssObjectUrl = URL.createObjectURL(
            new Blob([cssText], { type: "text/css;charset=utf-8" }),
          );
          objectUrls.push(cssObjectUrl);
          addAssetResolverVariants(finalMap, filePath, cssObjectUrl);
        }
        state.assetObjectUrls = objectUrls;
        state.assetResolverMap = finalMap;
        state.assetFileCount = list.length;
        const firstLabel =
          normalizeAssetPath(list[0].webkitRelativePath || list[0].name).split(
            "/",
          )[0] || "assets";
        state.assetResolverLabel = `${firstLabel} · ${list.length} файлов`;
        updateAssetDirectoryStatus();
        showToast(`Подключено ресурсов: ${list.length}.`, "success", {
          title: "Папка ресурсов",
        });
        if (state.modelDoc) rebuildPreviewKeepingContext(state.activeSlideId);
      }

      function formatAssetSampleInline(items, limit = 3) {
        const list = Array.from(items || []).slice(0, limit);
        if (!list.length) return "";
        return list.map((item) => escapeHtml(item)).join(", ");
      }

      function formatAssetAuditSummary(audit, options = {}) {
        const sourceAudit = audit || createEmptyPreviewAssetAudit();
        const includeZeroes = options.includeZeroes === true;
        const includeSamples = options.includeSamples === true;
        const categories = [
          ["resolved", "resolved"],
          ["baseUrlDependent", "base-url"],
          ["unresolved", "unresolved"],
        ];
        const parts = [];
        categories.forEach(([key, label]) => {
          const count = Number(
            sourceAudit?.counts?.[key] ?? sourceAudit?.[key]?.length ?? 0,
          );
          if (!includeZeroes && count <= 0) return;
          let part = `${label}: ${count}`;
          if (includeSamples) {
            const sample = formatAssetSampleInline(sourceAudit?.[key] || [], 2);
            if (sample) part += ` (${sample})`;
          }
          parts.push(part);
        });
        return parts.join(" • ");
      }

      function formatUnresolvedAssetsInline(limit = 3) {
        return formatAssetSampleInline(state.unresolvedPreviewAssets, limit);
      }

      function updateAssetDirectoryStatus() {
        if (!els.assetDirectoryStatus) return;
        const unresolvedCount = state.unresolvedPreviewAssets?.length || 0;
        const unresolvedPreview = formatUnresolvedAssetsInline();
        const baseUrlDependentCount = state.baseUrlDependentAssets?.length || 0;
        const baseUrlPreview = Array.from(state.baseUrlDependentAssets || [])
          .slice(0, 3)
          .map((item) => escapeHtml(item))
          .join(", ");
        if (!state.assetFileCount && !unresolvedCount && baseUrlDependentCount) {
          els.assetDirectoryStatus.innerHTML = `Папка ресурсов не выбрана. <span class="small-note">Часть относительных ссылок сейчас идёт через Base URL: ${baseUrlDependentCount}${baseUrlPreview ? ` — ${baseUrlPreview}` : ""}.</span>`;
          return;
        }
        if (state.assetFileCount && !unresolvedCount && baseUrlDependentCount) {
          els.assetDirectoryStatus.innerHTML = `<strong>${escapeHtml(state.assetResolverLabel || "Ресурсы подключены")}</strong><span class="small-note">Папка уже закрывает часть относительных путей, остальные пока идут через Base URL: ${baseUrlDependentCount}${baseUrlPreview ? ` — ${baseUrlPreview}` : ""}.</span>`;
          return;
        }
        if (!state.assetFileCount) {
          els.assetDirectoryStatus.innerHTML = unresolvedCount
            ? `Папка ресурсов не выбрана. <span class="small-note">Неразрешённых относительных ссылок: ${unresolvedCount}${unresolvedPreview ? ` — ${unresolvedPreview}` : ""}.</span>`
            : "Папка ресурсов не выбрана.";
          return;
        }
        els.assetDirectoryStatus.innerHTML = unresolvedCount
          ? `<strong>${escapeHtml(state.assetResolverLabel || "Ресурсы подключены")}</strong><span class="small-note">Preview использует найденные относительные файлы, но ещё осталось ссылок без резолва: ${unresolvedCount}${unresolvedPreview ? ` — ${unresolvedPreview}` : ""}.</span>`
          : `<strong>${escapeHtml(state.assetResolverLabel || "Ресурсы подключены")}</strong><span class="small-note">Preview использует найденные относительные файлы.</span>`;
      }

      function applyAssetResolverToPreviewDoc(doc) {
        if (!state.assetResolverMap || !doc) return;
        doc
          .querySelectorAll("[src], [href], [poster], [srcset], [style]")
          .forEach((el) => {
            ["src", "href", "poster"].forEach((attr) => {
              const value = el.getAttribute(attr);
              if (!value || isExternalLikeUrl(value)) return;
              const resolved = resolveAssetObjectUrl(value);
              if (resolved) el.setAttribute(attr, resolved);
            });
            if (el.hasAttribute("srcset")) {
              el.setAttribute(
                "srcset",
                rewriteSrcsetValue(el.getAttribute("srcset") || ""),
              );
            }
            if (el.hasAttribute("style")) {
              el.setAttribute(
                "style",
                rewriteCssUrlsInText(el.getAttribute("style") || ""),
              );
            }
          });
        doc.querySelectorAll("style").forEach((styleTag) => {
          styleTag.textContent = rewriteCssUrlsInText(
            styleTag.textContent || "",
          );
        });
      }

      function extractRelativeUrlsFromCssText(cssText) {
        const urls = [];
        String(cssText || "")
          .replace(/url\((['"]?)([^'"\)]+)\1\)/gi, (full, quote, rawUrl) => {
            if (!isExternalLikeUrl(rawUrl)) urls.push(rawUrl);
            return full;
          })
          .replace(
            /@import\s+(?:url\()?\s*(['"]?)([^'"\)\s]+)\1\s*\)?/gi,
            (full, quote, rawUrl) => {
              if (!isExternalLikeUrl(rawUrl)) urls.push(rawUrl);
              return full;
            },
          );
        return urls;
      }

      function extractRelativeUrlsFromSrcsetValue(srcset) {
        return String(srcset || "")
          .split(",")
          .map((entry) => entry.trim().split(/\s+/)[0])
          .filter((value) => value && !isExternalLikeUrl(value));
      }

      function collectUnresolvedPreviewAssets(doc, options = {}) {
        return collectPreviewAssetAudit(doc, options).unresolved;
      }

      function collectPreviewAssetAudit(doc, options = {}) {
        if (!doc) {
          return createEmptyPreviewAssetAudit();
        }
        const manualBaseUrl = String(
          options.baseHref ?? state.manualBaseUrl ?? "",
        ).trim();
        const resolved = new Set();
        const unresolved = new Set();
        const baseUrlDependent = new Set();
        const pushRelative = (value) => {
          const normalized = normalizeAssetPath(value);
          if (!normalized) return;
          if (resolveAssetObjectUrl(normalized)) {
            resolved.add(normalized);
            return;
          }
          if (manualBaseUrl) {
            baseUrlDependent.add(normalized);
            return;
          }
          unresolved.add(normalized);
        };
        doc.querySelectorAll("[src], [href], [poster]").forEach((el) => {
          ["src", "href", "poster"].forEach((attr) => {
            const value = el.getAttribute(attr);
            if (!value || isExternalLikeUrl(value)) return;
            pushRelative(value);
          });
        });
        doc.querySelectorAll("[srcset]").forEach((el) => {
          extractRelativeUrlsFromSrcsetValue(el.getAttribute("srcset") || "").forEach(
            pushRelative,
          );
        });
        doc.querySelectorAll("[style]").forEach((el) => {
          extractRelativeUrlsFromCssText(el.getAttribute("style") || "").forEach(
            pushRelative,
          );
        });
        doc.querySelectorAll("style").forEach((styleTag) => {
          extractRelativeUrlsFromCssText(styleTag.textContent || "").forEach(
            pushRelative,
          );
        });
        return {
          resolved: Array.from(resolved).slice(0, 24),
          unresolved: Array.from(unresolved).slice(0, 24),
          baseUrlDependent: Array.from(baseUrlDependent).slice(0, 24),
          counts: {
            resolved: resolved.size,
            unresolved: unresolved.size,
            baseUrlDependent: baseUrlDependent.size,
          },
        };
      }

      function updatePreviewAssetAuditFromAudit(audit) {
        const safeAudit = audit || createEmptyPreviewAssetAudit();
        state.resolvedPreviewAssets = safeAudit.resolved;
        state.unresolvedPreviewAssets = safeAudit.unresolved;
        state.baseUrlDependentAssets = safeAudit.baseUrlDependent;
        state.previewAssetAuditCounts = {
          resolved: Number(safeAudit?.counts?.resolved || 0),
          unresolved: Number(safeAudit?.counts?.unresolved || 0),
          baseUrlDependent: Number(safeAudit?.counts?.baseUrlDependent || 0),
        };
      }

      function updatePreviewAssetAudit(doc, options = {}) {
        const audit = collectPreviewAssetAudit(doc, options);
        updatePreviewAssetAuditFromAudit(audit);
      }

      function buildPreviewHtml() {
        return buildPreviewPackage()?.serialized || "";
      }

      function openVideoInsertModal() {
        if (!state.modelDoc) {
          openOpenHtmlModal();
          return;
        }
        if (state.mode !== "edit") setMode("edit");
        closeInsertPalette();
        setInteractionMode("insert");
        els.videoFileInput.value = "";
        els.videoUrlInput.value = "";
        clearVideoInsertStatus();
        openModal(els.videoInsertModal);
      }

      function buildVideoHtmlFromSource(rawSource) {
        const source = String(rawSource || "").trim();
        if (!source) return "";
        const embed = toVideoEmbedUrl(source);
        if (embed) {
          return `<iframe src="${escapeHtml(embed)}" title="Embedded video" style="width:640px; max-width:100%; height:360px; border:0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
        }
        const directFileLike =
          /\.(mp4|webm|ogg|ogv|mov)(?:[?#].*)?$/i.test(source) ||
          /^(?:\.\.?\/|[a-z0-9_\-./]+\.(mp4|webm|ogg|ogv|mov))(?:[?#].*)?$/i.test(
            source,
          );
        if (directFileLike) {
          return `<video controls playsinline preload="metadata" style="display:block; width:640px; max-width:100%; height:auto;" src="${escapeHtml(source)}"></video>`;
        }
        return "";
      }

      async function insertVideoFromSelectedFile() {
        clearVideoInsertStatus();
        const file = els.videoFileInput.files?.[0];
        if (!file) {
          setVideoInsertStatus("Сначала выбери видеофайл.", "warning");
          els.videoFileInput?.focus();
          return;
        }
        const MAX_INLINE_VIDEO_BYTES = 12 * 1024 * 1024;
        if (file.size > MAX_INLINE_VIDEO_BYTES) {
          showToast(
            "Локальное видео больше 12 МБ. Для переносимого HTML лучше использовать ссылку на mp4/webm или относительный путь из папки проекта.",
            "warning",
            { title: "Видео слишком большое", ttl: 4200 },
          );
          return;
        }
        try {
          const dataUrl = await fileToDataUrl(file);
          const html = `<video controls playsinline preload="metadata" style="display:block; width:640px; max-width:100%; height:auto;" src="${escapeHtml(dataUrl)}"></video>`;
          insertHtmlViaBridge(html, { focusText: false });
          clearVideoInsertStatus();
          closeModal(els.videoInsertModal);
          showToast("Локальное видео вставлено на слайд.", "success", {
            title: "Медиа",
          });
        } catch (error) {
          reportShellWarning("video-file-read-failed", error, {
            once: true,
            diagnostic: false,
          });
          setVideoInsertStatus("Не удалось прочитать видеофайл.", "error");
        }
      }

      function insertVideoFromUrlInput() {
        clearVideoInsertStatus();
        const html = buildVideoHtmlFromSource(els.videoUrlInput.value.trim());
        if (!html) {
          setVideoInsertStatus(
            "Поддерживаются YouTube, Vimeo и прямые ссылки на MP4/WebM/Ogg/MOV.",
            "warning",
          );
          els.videoUrlInput?.focus();
          return;
        }
        insertHtmlViaBridge(html, { focusText: false });
        clearVideoInsertStatus();
        closeModal(els.videoInsertModal);
        showToast("Видео добавлено на слайд.", "success", { title: "Медиа" });
      }

      function insertVideoByPrompt() {
        openVideoInsertModal();
      }

      function performPaletteAction(action) {
        if (!state.modelDoc) return;
        if (state.mode !== "edit") setMode("edit");
        let handled = true;
        switch (action) {
          case "heading":
            insertHeadingBlock(1);
            break;
          case "subheading":
            insertHeadingBlock(2);
            break;
          case "text":
            insertDefaultTextBlock();
            break;
          case "image":
            requestImageInsert("insert");
            break;
          case "video":
            openVideoInsertModal();
            break;
          case "box":
            insertSimpleBox();
            break;
          case "layout-two-col":
            insertLayoutPreset("two-col");
            break;
          default:
            handled = false;
        }
        if (handled && action !== "video") closeInsertPalette();
      }

      // =====================================================================
