      // ZONE: Style Application
      // applyStyle, toggleStyleOnSelected — send apply-style to bridge
      // =====================================================================
      function applyStyle(styleName, value) {
        if (!state.selectedNodeId || !state.selectedPolicy.canEditStyles) return;
        sendToBridge("apply-style", {
          nodeId: state.selectedNodeId,
          styleName,
          value,
        });
      }

      function updateAttributes(attrs) {
        if (!state.selectedNodeId) return;
        if (!state.selectedPolicy.canEditAttributes) {
          showToast(
            getSelectionActionBlockMessage("editAttributes"),
            "warning",
            { title: "Атрибуты защищены", ttl: 4200 },
          );
          return;
        }
        sendToBridge("update-attributes", {
          nodeId: state.selectedNodeId,
          attrs,
        });
      }

      function toggleStyleOnSelected(
        styleName,
        activeValue,
        inactiveValue,
        computedMatch,
      ) {
        if (
          !state.selectedNodeId ||
          !state.selectedComputed ||
          !state.selectedPolicy.canEditStyles
        )
          return;
        let isActive = false;
        switch (styleName) {
          case "fontWeight":
            isActive = ["700", "800", "900", "bold"].includes(
              state.selectedComputed.fontWeight,
            );
            break;
          case "fontStyle":
            isActive = state.selectedComputed.fontStyle === computedMatch;
            break;
          case "textDecoration":
            isActive = (
              state.selectedComputed.textDecorationLine || ""
            ).includes(computedMatch);
            break;
        }
        sendToBridge("apply-style", {
          nodeId: state.selectedNodeId,
          styleName,
          value: isActive ? inactiveValue : activeValue,
        });
      }

      function openElementHtmlEditor() {
        if (!state.selectedNodeId || !state.selectedHtml) {
          alert("Сначала выбери элемент в режиме редактирования.");
          return;
        }
        if (state.selectedFlags.isSlideRoot) {
          openSlideHtmlEditor();
          return;
        }
        if (!guardProtectedSelection("HTML элемента", { action: "editHtml" }))
          return;
        state.htmlEditorMode = "element";
        state.htmlEditorTargetId = state.selectedNodeId;
        state.htmlEditorTargetType = "node";
        els.htmlEditorModalTitle.textContent = "HTML выбранного элемента";
        els.htmlEditorHint.textContent =
          "Нужен один корневой HTML‑элемент. После сохранения он заменит выбранный блок.";
        els.htmlEditorTextarea.value = state.selectedHtml;
        resetHtmlEditorStatus();
        openModal(els.htmlEditorModal);
      }

      function openSlideHtmlEditor() {
        if (!state.activeSlideId) {
          alert("Сначала загрузи презентацию и выбери слайд.");
          return;
        }
        const slide = state.modelDoc?.querySelector(
          `[data-editor-slide-id="${cssEscape(state.activeSlideId)}"]`,
        );
        if (!slide) {
          alert("Для текущего слайда нет безопасной модели редактирования.");
          return;
        }
        state.htmlEditorMode = "slide";
        state.htmlEditorTargetId = state.activeSlideId;
        state.htmlEditorTargetType = "slide";
        els.htmlEditorModalTitle.textContent = "HTML текущего слайда";
        els.htmlEditorHint.textContent =
          "Нужен один корневой HTML‑элемент. После сохранения превью полностью перезагрузится.";
        els.htmlEditorTextarea.value = slide.outerHTML;
        resetHtmlEditorStatus();
        openModal(els.htmlEditorModal);
      }

      function saveHtmlEditorChanges() {
        const html = els.htmlEditorTextarea.value.trim();
        if (!html) {
          setHtmlEditorStatus("HTML не должен быть пустым.", "error");
          return;
        }
        try {
          const replacement = parseSingleRootElement(html);
          if (state.htmlEditorMode === "element") saveElementHtml(replacement);
          else if (state.htmlEditorMode === "slide") saveSlideHtml(replacement);
          resetHtmlEditorStatus();
          closeModal(els.htmlEditorModal);
        } catch (error) {
          console.error(error);
          setHtmlEditorStatus(
            (error instanceof Error && error.message) ||
              "Не удалось применить HTML.",
            "error",
          );
        }
      }

      function saveElementHtml(replacement) {
        const nodeId = state.htmlEditorTargetId;
        if (!nodeId || !state.modelDoc)
          throw new Error("Нет активного элемента для замены.");
        const current = state.modelDoc.querySelector(
          `[data-editor-node-id="${cssEscape(nodeId)}"]`,
        );
        if (!current)
          throw new Error("Исходный элемент не найден в модели документа.");
        preserveAuthoredMarkerContract(current, replacement);
        replacement.setAttribute("data-editor-node-id", nodeId);
        const imported = state.modelDoc.importNode(replacement, true);
        current.replaceWith(imported);
        assignEditorNodeIdsInModel(
          imported.closest(`[${EDITOR_SLIDE_ID_ATTR}]`) || imported,
        );
        commitChange("element-html");
        sendToBridge("replace-node-html", {
          nodeId,
          html: imported.outerHTML,
        });
      }

      function saveSlideHtml(replacement) {
        const slideId = state.htmlEditorTargetId;
        if (!slideId || !state.modelDoc)
          throw new Error("Нет активного слайда для замены.");
        const current = state.modelDoc.querySelector(
          `[data-editor-slide-id="${cssEscape(slideId)}"]`,
        );
        if (!current) throw new Error("Слайд не найден в модели документа.");
        preserveAuthoredMarkerContract(current, replacement);
        replacement.setAttribute("data-editor-slide-id", slideId);
        const imported = state.modelDoc.importNode(replacement, true);
        current.replaceWith(imported);
        assignEditorNodeIdsInModel(imported);
        commitChange("slide-html");
        rebuildPreviewKeepingContext(slideId);
      }

      function revokeEditorObjectUrl(url, warningCode) {
        if (!url) return;
        try {
          URL.revokeObjectURL(url);
        } catch (error) {
          reportShellWarning(warningCode, error, { once: true });
        }
      }

      /* ======================================================================
       history + autosave + export
       ====================================================================== */

      function cleanupExportValidationUrl() {
        if (!state.lastExportValidationUrl) return;
        revokeEditorObjectUrl(
          state.lastExportValidationUrl,
          "export-validation-url-revoke-failed",
        );
        state.lastExportValidationUrl = null;
      }

      function serializeDocumentWithDoctype(doc) {
        if (!doc) return "";
        return `${state.doctypeString}
${doc.documentElement.outerHTML}`;
      }

      function buildRenderedOutputDocument(contract = {}) {
        if (!state.modelDoc) return null;
        const outputDoc = state.modelDoc.cloneNode(true);
        if (contract.applyAssetResolver && state.assetResolverMap) {
          applyAssetResolverToPreviewDoc(outputDoc);
        }
        if (!contract.keepEditorArtifacts) {
          stripEditorArtifacts(outputDoc);
          enforceCleanExportInvariant(outputDoc, contract);
        }
        if (contract.includeBridge) {
          injectBridge(outputDoc);
        }
        if (contract.baseHref) {
          upsertBaseHref(outputDoc, contract.baseHref, {
            markPreviewBase: Boolean(
              contract.keepEditorArtifacts && contract.includeBridge,
            ),
          });
        }
        return outputDoc;
      }

      function buildCleanExportPackage() {
        return buildRenderedOutputPackage({
          renderMode: "export",
          keepEditorArtifacts: false,
          manualBaseUrl: getManualBaseUrl(),
        });
      }

      function buildExportValidationPackage() {
        const pack = buildRenderedOutputPackage({
          renderMode: "export-validation",
          applyAssetResolver: Boolean(state.assetResolverMap),
          keepEditorArtifacts: false,
          auditAssets: true,
          manualBaseUrl: getManualBaseUrl(),
        });
        if (!pack) return null;
        cleanupExportValidationUrl();
        const previewUrl = URL.createObjectURL(pack.blob);
        state.lastExportValidationUrl = previewUrl;
        state.lastExportValidationAudit = pack.assetAudit;
        return {
          document: pack.document,
          serialized: pack.serialized,
          blob: pack.blob,
          previewUrl,
          slideCount: pack.slideCount,
          usesAssetResolver: pack.usesAssetResolver,
          assetAudit: pack.assetAudit,
          contract: pack.contract,
        };
      }

      function buildExportPackage() {
        return buildExportValidationPackage();
      }

      function openExportValidationPreview() {
        const pack = buildExportPackage();
        if (!pack) return;
        const popup = window.open(pack.previewUrl, "_blank", "noopener,noreferrer");
        const auditSummary = formatAssetAuditSummary(pack.assetAudit, {
          includeSamples: true,
          includeZeroes: true,
        });
        if (!popup) {
          showToast("Браузер заблокировал новую вкладку. Скопируй проверочный preview вручную или разреши pop-up.", "warning", {
            title: "Проверка экспорта",
            actionLabel: "Скопировать ссылку",
            onAction: () => {
              void copyTextWithShellFeedback(pack.previewUrl, {
                title: "Проверка экспорта",
                successMessage: "Ссылка на проверочный preview скопирована.",
                failureMessage:
                  "Не удалось скопировать ссылку автоматически. Разрешите pop-up или повторите действие.",
              });
            },
          });
          if (auditSummary) addDiagnostic(`export-validation-audit: ${auditSummary}`);
          return;
        }
        addDiagnostic(`export-validation-audit: ${auditSummary}`);
        showToast(`Открылся export-safe validation preview. ${auditSummary}`, (pack.assetAudit?.counts?.unresolved || 0) > 0 ? "warning" : "success", {
          title: "Проверка экспорта",
        });
      }

      // =====================================================================
