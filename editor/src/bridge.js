      // ZONE: Bridge Message Dispatch
      // Handles all postMessage events from the bridge iframe → shell
      // =====================================================================
      /* ======================================================================
       [SCRIPT 03] preview build + iframe bridge + sync
       ====================================================================== */
      function bindMessages() {
        window.addEventListener("message", (event) => {
          const data = event.data;
          if (!data || data.__presentationEditor !== true) return;
          if (data.token !== state.bridgeToken) return;
          if (
            els.previewFrame.contentWindow &&
            event.source !== els.previewFrame.contentWindow
          )
            return;

          state.lastBridgeHeartbeatAt = Date.now();

          const bridgeSeq = Number(data.seq || data.payload?.seq || 0);
          try {
            switch (data.type) {
              case "bridge-ready":
                state.bridgeAlive = true;
                state.previewReady = true;
                addDiagnostic(
                  `bridge-ready: ${JSON.stringify(data.payload || {})}`,
                );
                setPreviewLoading(false);
                dispatchPendingSlideActivation("bridge-ready");
                flushPendingPreviewSelection();
                showToast("Превью готово к работе.", "success", {
                  title: "Iframe инициализирован",
                });
                refreshUi();
                break;
              case "runtime-metadata":
                applyRuntimeMetadata(data.payload || {});
                break;
              case "slide-activation":
                applySlideActivationFromBridge(data.payload || {});
                break;
              case "element-selected":
                applyElementSelection(data.payload || {});
                break;
              case "element-updated":
                applyElementUpdateFromBridge(data.payload || {}, bridgeSeq);
                break;
              case "selection-geometry":
                applySelectionGeometry(data.payload || {});
                break;
              case "slide-updated":
                applySlideUpdateFromBridge(data.payload || {}, bridgeSeq);
                break;
              case "slide-removed":
                applySlideRemovedFromBridge(data.payload || {}, bridgeSeq);
                break;
              case "context-menu":
                openContextMenuFromBridge(data.payload || {});
                break;
              case "shortcut":
                handleBridgeShortcut(data.payload || {});
                break;
              case "runtime-error":
                addDiagnostic(
                  `iframe-error: ${data.payload?.message || "unknown"} @ ${data.payload?.source || ""}:${data.payload?.line || ""}`,
                );
                showToast(
                  data.payload?.message || "Ошибка внутри iframe.",
                  "error",
                  { title: "Ошибка превью" },
                );
                break;
              case "runtime-log":
                addDiagnostic(`iframe-log: ${data.payload?.message || ""}`);
                break;
              case "bridge-heartbeat":
                state.bridgeAlive = true;
                if (state.previewReady && state.previewLifecycle === "bridge-degraded") {
                  setPreviewLifecycleState("ready", {
                    reason: "bridge-heartbeat",
                  });
                }
                refreshUi();
                break;
              case "document-sync":
                applyDocumentSyncFromBridge(data.payload || {}, bridgeSeq);
                break;
              // [v0.18.0] Multi-select support
              case "multi-select-add":
                if (state.complexityMode === "advanced" && data.payload?.nodeId) {
                  const nodeId = data.payload.nodeId;
                  if (!state.multiSelectNodeIds.includes(nodeId)) {
                    state.multiSelectNodeIds.push(nodeId);
                    showToast(`Добавлено в выделение: ${nodeId}`, "info", { duration: 1500 });
                  }
                }
                break;
            }
          } catch (error) {
            addDiagnostic(
              `parent-message-error:${data.type || "unknown"}:${error.message}`,
            );
          }
        });
      }

      function bindUnloadWarning() {
        window.addEventListener("beforeunload", (event) => {
          if (!state.dirty) return;
          event.preventDefault();
          event.returnValue = "";
        });
        window.addEventListener("unload", cleanupExportValidationUrl);
      }

      function bindRuntimeGuards() {
        window.addEventListener("error", (event) => {
          addDiagnostic(
            `shell-error: ${event.message || "unknown"} @ ${event.filename || ""}:${event.lineno || ""}`,
          );
        });
        window.addEventListener("unhandledrejection", (event) => {
          const message =
            event.reason instanceof Error
              ? event.reason.message
              : String(event.reason || "Unhandled promise rejection");
          addDiagnostic(`shell-promise-error: ${message}`);
        });
      }

      // =====================================================================
