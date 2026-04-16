      // ZONE: Inspector Wiring
      // Event listeners for all inspector fields — typography, geometry, appearance, media
      // =====================================================================
      /* ======================================================================
       [SCRIPT 04] selection + inspector + editing + media
       ====================================================================== */
      function bindInspectorActions() {
        els.boldBtn.addEventListener("click", () =>
          toggleStyleOnSelected("fontWeight", "700", "400", "bold"),
        );
        els.italicBtn.addEventListener("click", () =>
          toggleStyleOnSelected("fontStyle", "italic", "normal", "italic"),
        );
        els.underlineBtn.addEventListener("click", () =>
          toggleStyleOnSelected(
            "textDecoration",
            "underline",
            "none",
            "underline",
          ),
        );
        els.editTextBtn.addEventListener("click", () => startTextEditing());
        if (els.selectionBreadcrumbs) {
          els.selectionBreadcrumbs.addEventListener("click", (event) => {
            const trigger =
              event.target instanceof Element
                ? event.target.closest("[data-selection-path-node-id]")
                : null;
            if (!(trigger instanceof HTMLElement)) return;
            const targetNodeId = String(
              trigger.getAttribute("data-selection-node-id") ||
                trigger.getAttribute("data-selection-path-node-id") ||
                "",
            ).trim();
            const selectionPayload = buildSelectionBridgePayload(targetNodeId, {
              focusText: false,
              selectionNodeId: targetNodeId,
            });
            if (!selectionPayload) return;
            sendToBridge("select-element", selectionPayload);
          });
          els.selectionBreadcrumbs.addEventListener("pointerleave", () => {
            sendToBridge("highlight-node", { nodeId: null });
          });
          els.selectionBreadcrumbs.addEventListener("focusout", (event) => {
            if (els.selectionBreadcrumbs.contains(event.relatedTarget)) return;
            sendToBridge("highlight-node", { nodeId: null });
          });
        }

        // Для полей инспектора используем input/change в зависимости от частоты
        // обновления. Более "тяжёлые" операции (например, размеры) отправляем по change,
        // чтобы не засорять мост лишними сообщениями.
        els.fontSizeSelect.addEventListener("change", () =>
          applyStyle("fontSize", toCssSize(els.fontSizeSelect.value)),
        );
        els.inspectorFontFamilySelect?.addEventListener("change", () => {
          const v = els.inspectorFontFamilySelect.value;
          if (v) applyStyle("fontFamily", v);
        });
        els.inspectorLineHeightSelect?.addEventListener("change", () => {
          const v = els.inspectorLineHeightSelect.value;
          if (v) applyStyle("lineHeight", v);
        });
        els.textColorInput.addEventListener("input", () =>
          applyStyle("color", els.textColorInput.value),
        );
        els.displaySelect.addEventListener("change", () =>
          applyStyle("display", els.displaySelect.value),
        );
        els.positionSelect.addEventListener("change", () =>
          applyStyle("position", els.positionSelect.value),
        );
        els.zIndexInput.addEventListener("change", () =>
          applyStyle("zIndex", els.zIndexInput.value),
        );
        els.widthInput.addEventListener("change", () =>
          applyStyle("width", normalizeCssInput(els.widthInput.value)),
        );
        els.heightInput.addEventListener("change", () =>
          applyStyle("height", normalizeCssInput(els.heightInput.value)),
        );
        els.leftInput.addEventListener("change", () =>
          applyStyle("left", normalizeCssInput(els.leftInput.value)),
        );
        els.topInput.addEventListener("change", () =>
          applyStyle("top", normalizeCssInput(els.topInput.value)),
        );
        els.bgColorInput.addEventListener("input", () =>
          applyStyle("backgroundColor", els.bgColorInput.value),
        );
        els.borderColorInput.addEventListener("input", () =>
          applyStyle("borderColor", els.borderColorInput.value),
        );
        els.borderStyleSelect.addEventListener("change", () =>
          applyStyle("borderStyle", els.borderStyleSelect.value),
        );
        els.borderWidthInput.addEventListener("change", () =>
          applyStyle(
            "borderWidth",
            normalizeCssInput(els.borderWidthInput.value),
          ),
        );
        els.marginInput.addEventListener("change", () =>
          applyStyle("margin", els.marginInput.value.trim()),
        );
        els.paddingInput.addEventListener("change", () =>
          applyStyle("padding", els.paddingInput.value.trim()),
        );
        els.opacityInput.addEventListener("change", () => {
          const v = parseFloat(els.opacityInput.value);
          if (!isNaN(v)) applyStyle("opacity", String(Math.min(100, Math.max(0, v)) / 100));
        });
        els.borderRadiusInput.addEventListener("change", () =>
          applyStyle("borderRadius", normalizeCssInput(els.borderRadiusInput.value)),
        );
        els.addShapeBtn.addEventListener("click", insertDefaultShape);

        els.elementIdInput.addEventListener("change", () =>
          updateAttributes({ id: els.elementIdInput.value.trim() }),
        );
        els.elementClassInput.addEventListener("change", () =>
          updateAttributes({ class: els.elementClassInput.value.trim() }),
        );
        els.imageAltInput.addEventListener("change", () =>
          updateAttributes({ alt: els.imageAltInput.value }),
        );
        els.imageSrcInput.addEventListener("change", () =>
          updateAttributes({ src: els.imageSrcInput.value.trim() }),
        );
        els.applyImageSrcBtn.addEventListener("click", () =>
          updateAttributes({ src: els.imageSrcInput.value.trim() }),
        );

        els.alignButtons.forEach((button) => {
          button.addEventListener("click", () =>
            applyStyle("textAlign", button.dataset.align || "left"),
          );
        });

        // Inspector actions.
        els.showElementHtmlBtn.addEventListener("click", openElementHtmlEditor);
        els.saveHtmlEditorBtn.addEventListener("click", saveHtmlEditorChanges);
        els.copyElementBtn.addEventListener("click", copySelectedElement);
        els.pasteElementBtn.addEventListener("click", pasteSelectedElement);
        els.duplicateElementBtn.addEventListener(
          "click",
          duplicateSelectedElement,
        );
        els.deleteElementBtn.addEventListener("click", deleteSelectedElement);
        els.moveElementUpBtn.addEventListener("click", () =>
          moveSelectedElement(-1),
        );
        els.moveElementDownBtn.addEventListener("click", () =>
          moveSelectedElement(1),
        );
        els.overlapMoveTopBtn?.addEventListener("click", () => {
          moveSelectedLayerByOrder("layer-front");
        });
        els.overlapSelectLayerBtn?.addEventListener("click", () => {
          if (state.complexityMode === "advanced") {
            openLayerPickerForSelectedOverlap();
            return;
          }
          selectNextOverlapLayer();
        });
        els.normalizeLayersBtn?.addEventListener("click", () =>
          normalizeLayersForCurrentScope(),
        );
        // [v0.18.0] Unlock element button
        els.unlockElementBtn?.addEventListener("click", () => {
          const lockedNodeId =
            els.unlockElementBtn?.getAttribute("data-lock-node-id") ||
            state.selectedNodeId;
          if (!lockedNodeId) return;
          toggleLayerLock(lockedNodeId);
        });
        // [v0.19.0] Block reason action button
        els.blockReasonActionBtn?.addEventListener("click", () => {
          const action = els.blockReasonActionBtn?.dataset.blockAction;
          if (action === "reset-zoom") {
            setPreviewZoom(1.0, true);
          } else if (action === "unlock") {
            const nodeId = state.selectedNodeId;
            if (nodeId) toggleLayerLock(nodeId);
          } else if (action === "show") {
            restoreSelectedElementVisibility();
          }
        });
        els.selectedElementQuickActions?.addEventListener(
          "click",
          handleSelectedElementQuickAction,
        );
        els.resetStylesBtn.addEventListener("click", resetSelectedStyles);
        els.copyStyleBtn.addEventListener("click", copySelectedStyle);
        els.pasteStyleBtn.addEventListener("click", pasteStyleToSelected);
        els.addTextBtn.addEventListener("click", insertDefaultTextBlock);
        els.addImageBtn.addEventListener("click", () =>
          requestImageInsert("insert"),
        );
        els.addVideoBtn.addEventListener("click", insertVideoByPrompt);
        els.insertHtmlBtn.addEventListener(
          "click",
          insertCustomHtmlFromTextarea,
        );
        els.replaceImageBtn.addEventListener("click", () =>
          requestImageInsert("replace"),
        );
        els.fitImageBtn.addEventListener("click", fitSelectedImageToWidth);
        els.copyImageUrlBtn.addEventListener("click", copySelectedImageUrl);
        els.openImageBtn.addEventListener("click", openSelectedImageInNewTab);
        els.resetImageSizeBtn.addEventListener("click", resetSelectedImageSize);
        els.rotateImageBtn.addEventListener("click", () =>
          rotateSelectedImage(90),
        );
        els.flipImageBtn.addEventListener("click", flipSelectedImage);
        els.insertTableRowAboveBtn?.addEventListener("click", () =>
          applySelectedTableStructureOperation("insert-row-above"),
        );
        els.insertTableRowBelowBtn?.addEventListener("click", () =>
          applySelectedTableStructureOperation("insert-row-below"),
        );
        els.deleteTableRowBtn?.addEventListener("click", () =>
          applySelectedTableStructureOperation("delete-row"),
        );
        els.insertTableColumnLeftBtn?.addEventListener("click", () =>
          applySelectedTableStructureOperation("insert-column-left"),
        );
        els.insertTableColumnRightBtn?.addEventListener("click", () =>
          applySelectedTableStructureOperation("insert-column-right"),
        );
        els.deleteTableColumnBtn?.addEventListener("click", () =>
          applySelectedTableStructureOperation("delete-column"),
        );
        els.slideTitleOverrideInput?.addEventListener("change", () =>
          applyCurrentSlideTitleOverride(els.slideTitleOverrideInput.value),
        );
        els.slideBgColorInput?.addEventListener("change", () =>
          applyCurrentSlideBackground(els.slideBgColorInput.value),
        );
        els.slidePaddingPresetSelect?.addEventListener("change", () =>
          applyCurrentSlidePaddingPreset(els.slidePaddingPresetSelect.value),
        );
        els.slidePresetSelect?.addEventListener("change", () =>
          syncSlidePresetActionUi(
            canUseStaticSlideModel() &&
              state.mode === "edit" &&
              state.editingSupported,
            getCurrentSlideModelNode(),
          ),
        );
        els.applySlidePresetBtn?.addEventListener("click", () =>
          applyCurrentSlidePreset(els.slidePresetSelect?.value || ""),
        );
        els.duplicateCurrentSlideBtn?.addEventListener(
          "click",
          duplicateCurrentSlide,
        );
        els.deleteCurrentSlideBtn?.addEventListener("click", deleteCurrentSlide);
        els.validateExportBtn?.addEventListener(
          "click",
          openExportValidationPreview,
        );

        // Floating toolbar mirrors the most frequent actions near the element.
        els.ftDeleteBtn.addEventListener("click", deleteSelectedElement);
        els.ftDuplicateBtn.addEventListener("click", duplicateSelectedElement);
        els.ftEditTextBtn.addEventListener("click", startTextEditing);
        els.ftReplaceImageBtn.addEventListener("click", () =>
          requestImageInsert("replace"),
        );
        els.ftCopyStyleBtn.addEventListener("click", copySelectedStyle);
        els.ftPasteStyleBtn.addEventListener("click", pasteStyleToSelected);
        els.ftCopyImageUrlBtn.addEventListener("click", copySelectedImageUrl);
        els.ftMediaUrlBtn.addEventListener("click", editSelectedMediaUrl);
        els.ftFitImageBtn.addEventListener("click", fitSelectedImageToWidth);
        els.ftBoldBtn.addEventListener("click", () =>
          toggleStyleOnSelected("fontWeight", "700", "400", "bold"),
        );
        els.ftItalicBtn.addEventListener("click", () =>
          toggleStyleOnSelected("fontStyle", "italic", "normal", "italic"),
        );
        els.ftUnderlineBtn?.addEventListener("click", () =>
          toggleStyleOnSelected("textDecoration", "underline", "none", "underline"),
        );
        [els.ftAlignLeftBtn, els.ftAlignCenterBtn, els.ftAlignRightBtn].forEach((btn) => {
          btn?.addEventListener("click", () => {
            const align = btn.dataset.ftAlign || "left";
            applyStyle("textAlign", align);
            // Update active state immediately for responsiveness
            [els.ftAlignLeftBtn, els.ftAlignCenterBtn, els.ftAlignRightBtn].forEach(
              (b) => b?.classList.toggle("is-active", b === btn),
            );
          });
        });
        els.ftColorInput.addEventListener("input", () =>
          applyStyle("color", els.ftColorInput.value),
        );
        els.ftFontFamilySelect?.addEventListener("change", () => {
          const val = els.ftFontFamilySelect.value;
          if (val) applyStyle("fontFamily", val);
        });
        els.ftFontSizeSelect.addEventListener("change", () =>
          applyStyle("fontSize", toCssSize(els.ftFontSizeSelect.value)),
        );
        els.ftCollapseBtn.addEventListener(
          "click",
          toggleFloatingToolbarCollapsed,
        );

        // Быстрая подсветка активного элемента при наведении на действия помогает
        // пользователю визуально понять, какой DOM-узел сейчас будет изменён.
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
        ].forEach((btn) => {
          // mouseenter flash removed — avoids ghost glow when toolbar appears under cursor
        });

        els.replaceImageInput.addEventListener("change", async () => {
          const file = els.replaceImageInput.files?.[0];
          els.replaceImageInput.value = "";
          if (!file) return;
          const dataUrl = await fileToDataUrl(file);
          if (
            state.pendingImageInsertMode === "replace" &&
            state.selectedNodeId
          ) {
            sendToBridge("replace-image-src", {
              nodeId: state.selectedNodeId,
              src: dataUrl,
              alt: file.name,
            });
            showToast("Изображение заменено.", "success");
          } else {
            insertImageElement(dataUrl, file.name);
          }
        });

        els.insertImageInput.addEventListener("change", async () => {
          const file = els.insertImageInput.files?.[0];
          els.insertImageInput.value = "";
          if (!file) return;
          const dataUrl = await fileToDataUrl(file);
          insertImageElement(dataUrl, file.name);
        });
      }

      // bindMessages — родительское окно принимает сообщения только от текущего
      // bridgeToken. Это защищает от сообщений старых preview URL и случайных iframe.
      // =====================================================================
