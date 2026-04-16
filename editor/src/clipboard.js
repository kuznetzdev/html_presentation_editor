      // ZONE: Clipboard & Drag-Drop
      // Image paste from OS clipboard, file drag-drop onto preview stage
      // =====================================================================
      // ====================================================================
      // Clipboard + Drag&Drop
      // Обрабатываем вставку картинок из буфера и drop файлов в preview-stage.
      // ====================================================================
      function bindClipboardAndDnD() {
        window.addEventListener("paste", async (event) => {
          if (state.mode !== "edit" || !state.modelDoc) return;
          if (
            event.target instanceof HTMLElement &&
            event.target.closest(
              'textarea, input[type="text"], input[type="number"], select',
            )
          )
            return;
          // Internal element clipboard takes priority — keydown handler already handled it
          if (state.copiedElementHtml) return;
          const file = extractImageFromClipboardEvent(event);
          if (!file) return;
          event.preventDefault();
          const dataUrl = await fileToDataUrl(file);
          insertImageElement(dataUrl, file.name || "clipboard-image.png");
        });

        const activateDrop = (active) => {
          els.previewDropzone.classList.toggle(
            "is-active",
            active && state.mode === "edit",
          );
        };

        els.previewStage.addEventListener("dragenter", (event) => {
          if (state.mode !== "edit") return;
          event.preventDefault();
          activateDrop(true);
        });
        els.previewStage.addEventListener("dragover", (event) => {
          if (state.mode !== "edit") return;
          event.preventDefault();
          activateDrop(true);
        });
        els.previewStage.addEventListener("dragleave", (event) => {
          if (event.target === els.previewStage) activateDrop(false);
        });
        els.previewStage.addEventListener("drop", async (event) => {
          activateDrop(false);
          if (state.mode !== "edit") return;
          event.preventDefault();
          const file =
            Array.from(event.dataTransfer?.files || []).find((f) =>
              f.type.startsWith("image/"),
            ) || null;
          if (!file) return;
          const dataUrl = await fileToDataUrl(file);
          insertImageElement(dataUrl, file.name || "dropped-image.png");
        });
      }

      // bindContextMenu — контейнер меню всегда один, но его содержимое
      // пересобирается динамически в renderContextMenu() под тип элемента.

      function bindRestoreBanner() {
        els.restoreDraftBtn.addEventListener("click", () => {
          if (!state.restorePayload) return;
          const payload = state.restorePayload;
          state.restorePayload = null;
          hideRestoreBanner();
          setManualBaseUrl(payload.manualBaseUrl || "");
          loadHtmlString(
            payload.html,
            payload.sourceLabel || "Автовосстановление",
            {
              resetHistory: true,
              dirty: true,
              mode: normalizeEditorMode(payload.mode, "edit"),
              preferSlideIndex: payload.activeSlideIndex || 0,
              onError: (message) =>
                showToast(message, "error", { title: "Восстановление" }),
            },
          );
        });

        els.discardDraftBtn.addEventListener("click", () => {
          clearAutosave();
          state.restorePayload = null;
          hideRestoreBanner();
        });
      }

      function tryRestoreDraftPrompt() {
        try {
          const raw = getAutosaveStorage().getItem(STORAGE_KEY);
          if (!raw) return;
          const payload = JSON.parse(raw);
          if (!payload?.html) return;
          state.restorePayload = payload;
          els.restoreBannerText.textContent = `Источник: ${payload.sourceLabel || "без названия"} • сохранено ${new Date(payload.savedAt || Date.now()).toLocaleString()}`;
          els.restoreBanner.classList.add("is-visible");
        } catch (error) {
          reportShellWarning("restore-draft-load-failed", error, {
            once: true,
          });
        }
      }

      function hideRestoreBanner() {
        els.restoreBanner.classList.remove("is-visible");
      }

      function normalizeEditorMode(mode, fallback = "preview") {
        if (mode === "edit" || mode === "preview") return mode;
        return fallback === "edit" ? "edit" : "preview";
      }

      // =====================================================================
