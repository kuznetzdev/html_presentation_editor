// dom.js
// Layer: DOM Cache
// Initializes the `els` object with references to all shell DOM elements.
//
// Also hosts two model-query helpers used by every shell-side module
// that needs to look up a node or slide in `state.modelDoc`:
//   findModelNode(nodeId)  → HTMLElement | null
//   findModelSlide(slideId) → HTMLElement | null
// Both centralize the cssEscape + selector-string pattern that was
// previously hand-rolled at 30+ call sites across 14 files. Bridge-side
// (live preview iframe) keeps its own findNodeById / findSlideById
// inside the bridge-script template — those run in a different document
// (the iframe) and live in a string, so they cannot share this helper.

      // ZONE: Model query helpers
      // =====================================================================
      // [v2.0.12] Centralize state.modelDoc lookups by data-editor-* id.
      // Both helpers tolerate a missing modelDoc, return `null` for any
      // miss, and quietly fail on undefined ids — the call sites used
      // to repeat the same null guards inline. Now they don't.
      function findModelNode(nodeId) {
        if (!state.modelDoc || !nodeId) return null;
        return state.modelDoc.querySelector(
          '[data-editor-node-id="' + cssEscape(nodeId) + '"]',
        );
      }

      function findModelSlide(slideId) {
        if (!state.modelDoc || !slideId) return null;
        return state.modelDoc.querySelector(
          '[data-editor-slide-id="' + cssEscape(slideId) + '"]',
        );
      }

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
        // [v1.5.0] Validate inspector dimensions through InputValidators.cssLength
        // when available (Phase E2 module). Falls through to legacy normalizeCssInput
        // when validator missing or input is empty.
        function _applyCssLengthInput(field, inputEl) {
          var raw = inputEl.value || "";
          if (!raw.trim()) { applyStyle(field, ""); return; }
          var v = window.InputValidators && window.InputValidators.cssLength
            ? window.InputValidators.cssLength(raw)
            : { ok: true, value: normalizeCssInput(raw) };
          if (!v.ok) {
            if (typeof showToast === "function") {
              showToast(v.message || ("Некорректное значение " + field), "error", { ttl: 3500 });
            }
            return;
          }
          applyStyle(field, v.value);
        }
        els.widthInput.addEventListener("change", () => _applyCssLengthInput("width", els.widthInput));
        els.heightInput.addEventListener("change", () => _applyCssLengthInput("height", els.heightInput));
        els.leftInput.addEventListener("change", () => _applyCssLengthInput("left", els.leftInput));
        els.topInput.addEventListener("change", () => _applyCssLengthInput("top", els.topInput));
        // [WO-26] Transform input: validate + write-through via applyStyle
        {
          const transformEl = document.getElementById("transformInput");
          const resetBtn = document.getElementById("resetTransformBtn");
          const TRANSFORM_REGEX = /^([a-zA-Z]+\([^)]*\)\s*)*$/;
          if (transformEl) {
            transformEl.addEventListener("change", () => {
              const raw = transformEl.value.trim();
              if (raw === "" || TRANSFORM_REGEX.test(raw)) {
                applyStyle("transform", raw);
                if (resetBtn) resetBtn.disabled = !raw;
              } else {
                showToast("Некорректный transform — оставлено как есть", "error");
                const node = getSelectedModelNode ? getSelectedModelNode() : null;
                transformEl.value = (node instanceof HTMLElement) ? (node.style.transform || "") : "";
              }
            });
          }
          if (resetBtn) {
            resetBtn.addEventListener("click", () => {
              applyStyle("transform", "");
              if (transformEl) transformEl.value = "";
              resetBtn.disabled = true;
              showToast("Transform убран", "success");
            });
          }
        }
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
        els.marginInput.addEventListener("change", () => _applyCssLengthInput("margin", els.marginInput));
        els.paddingInput.addEventListener("change", () => _applyCssLengthInput("padding", els.paddingInput));
        // [v1.5.0] Opacity input validated via InputValidators.opacity (handles
        // % and decimal). Range clamp + format normalization in one call.
        els.opacityInput.addEventListener("change", () => {
          var raw = els.opacityInput.value;
          if (raw === "" || raw == null) { applyStyle("opacity", ""); return; }
          // Input is a number 0..100; convert to a value the validator accepts.
          var num = parseFloat(raw);
          var asPercent = Number.isFinite(num) ? String(num) + "%" : raw;
          var v = window.InputValidators && window.InputValidators.opacity
            ? window.InputValidators.opacity(asPercent)
            : { ok: Number.isFinite(num), value: Math.min(100, Math.max(0, num)) / 100 };
          if (!v.ok) {
            if (typeof showToast === "function") {
              showToast(v.message || "Прозрачность должна быть 0–100", "error", { ttl: 3500 });
            }
            return;
          }
          applyStyle("opacity", String(v.value));
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
        // [v1.5.0] Validate image src through InputValidators.url so
        // javascript: schemes and other unsafe inputs never reach the model.
        function _applyImageSrc() {
          var raw = (els.imageSrcInput.value || "").trim();
          if (!raw) { updateAttributes({ src: "" }); return; }
          var v = window.InputValidators && window.InputValidators.url
            ? window.InputValidators.url(raw)
            : { ok: true, value: raw };
          if (!v.ok) {
            if (typeof showToast === "function") {
              showToast(v.message || "Некорректный URL изображения", "error", { ttl: 3500 });
            }
            return;
          }
          updateAttributes({ src: v.value });
        }
        els.imageSrcInput.addEventListener("change", _applyImageSrc);
        els.applyImageSrcBtn.addEventListener("click", _applyImageSrc);

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
        // [v0.25.0] Layer picker is now available in all complexity modes
        els.overlapSelectLayerBtn?.addEventListener("click", () => {
          openLayerPickerForSelectedOverlap();
        });
        els.normalizeLayersBtn?.addEventListener("click", () =>
          normalizeLayersForCurrentScope(),
        );
        // [v0.19.0] Block reason action button
        // [WO-29] unlock action re-routed here: blockReasonActionBtn.dataset.blockAction === "unlock"
        els.blockReasonActionBtn?.addEventListener("click", () => {
          const action = els.blockReasonActionBtn?.dataset.blockAction;
          if (action === "reset-zoom") {
            setPreviewZoom(1.0, true);
          } else if (action === "unlock") {
            const nodeId = state.selectedNodeId;
            if (nodeId) toggleLayerLock(nodeId);
          } else if (action === "show") {
            restoreSelectedElementVisibility();
          } else if (action === "resolve-transform") {
            // [WO-26] Scroll to and focus #transformInput; switch to advanced if needed
            if (state.complexityMode !== "advanced") {
              setComplexityMode("advanced");
            }
            const transformEl = document.getElementById("transformInput");
            const transformRow = transformEl ? transformEl.closest(".inspector-row--transform") : null;
            if (transformEl) {
              transformEl.scrollIntoView({ block: "center", behavior: "smooth" });
              setTimeout(() => transformEl.focus(), 180);
            }
            if (transformRow) {
              transformRow.classList.add("is-resolving");
              setTimeout(() => transformRow.classList.remove("is-resolving"), 1200);
            }
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
