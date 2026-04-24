      // ZONE: Bridge Message Dispatch
      // Handles all postMessage events from the bridge iframe → shell
      // =====================================================================
      /* ======================================================================
       [SCRIPT 03] preview build + iframe bridge + sync
       ====================================================================== */

      // Classic-script globals: functions and objects defined in other <script> tags.
      // Declared here so tsc --noEmit can type-check this file in isolation.
      /* global state, els, addDiagnostic, setPreviewLoading, dispatchPendingSlideActivation */
      /* global flushPendingPreviewSelection, showToast, refreshUi, applyRuntimeMetadata */
      /* global applySlideActivationFromBridge, applyElementSelection, applyElementUpdateFromBridge */
      /* global applySelectionGeometry, applySlideUpdateFromBridge, applySlideRemovedFromBridge */
      /* global openContextMenuFromBridge, handleBridgeShortcut, applyDocumentSyncFromBridge */
      /* global cleanupExportValidationUrl, getAllowedBridgeOrigins, setPreviewLifecycleState */
      /* global BRIDGE_PROTOCOL_VERSION */

      /**
       * Shape of the `data` property on postMessage events sent by the bridge iframe.
       * @typedef {Object} BridgeMessageEvent
       * @property {true} __presentationEditor - Marker that identifies bridge messages
       * @property {string} token - Shared secret matching state.bridgeToken
       * @property {string} type - Message type (e.g. 'bridge-ready', 'element-selected', ...)
       * @property {number} [seq] - Optional monotonic sequence number for ordered delivery
       * @property {any} [payload] - Message-type-specific payload (typed per ADR-012 / WO-13)
       */

      /**
       * Payload stub types — filled by ADR-012 / WO-13
       * @typedef {any} BridgeReadyPayload        // filled by ADR-012 / WO-13
       * @typedef {any} RuntimeMetadataPayload    // filled by ADR-012 / WO-13
       * @typedef {any} SlideActivationPayload    // filled by ADR-012 / WO-13
       * @typedef {any} ElementSelectedPayload    // filled by ADR-012 / WO-13
       * @typedef {any} ElementUpdatedPayload     // filled by ADR-012 / WO-13
       * @typedef {any} SelectionGeometryPayload  // filled by ADR-012 / WO-13
       * @typedef {any} SlideUpdatedPayload       // filled by ADR-012 / WO-13
       * @typedef {any} SlideRemovedPayload       // filled by ADR-012 / WO-13
       * @typedef {any} ContextMenuPayload        // filled by ADR-012 / WO-13
       * @typedef {any} ShortcutPayload           // filled by ADR-012 / WO-13
       * @typedef {any} RuntimeErrorPayload       // filled by ADR-012 / WO-13
       * @typedef {any} DocumentSyncPayload       // filled by ADR-012 / WO-13
       */

      function bindMessages() {
        /** @param {MessageEvent<BridgeMessageEvent>} event */
        window.addEventListener("message", (event) => {
          // AUDIT-D-04: Assert postMessage origin before processing any message.
          // Under file:// protocol event.origin is the string "null" — that is
          // the allowed value; under http(s):// we restrict to location.origin.
          const _allowedOrigins = getAllowedBridgeOrigins();
          if (!_allowedOrigins.includes(event.origin)) {
            addDiagnostic('bridge-origin-rejected:' + event.origin);
            return;
          }
          const data = event.data;
          if (!data || data.__presentationEditor !== true) return;
          if (data.token !== state.bridgeToken) return;
          const _previewFrame = /** @type {HTMLIFrameElement|null} */ (els.previewFrame);
          if (
            _previewFrame && _previewFrame.contentWindow &&
            event.source !== _previewFrame.contentWindow
          )
            return;

          state.lastBridgeHeartbeatAt = Date.now();

          const bridgeSeq = Number(data.seq || data.payload?.seq || 0);
          try {
            switch (data.type) {
              // ADR-012 §1 — Bridge v2 hello handshake (WO-12)
              // Emitted by bridge-script.js BEFORE bridge-ready.
              // Validates numeric protocol === 2; degrades to read-only on mismatch.
              case "hello": {
                const _helloPayload = data.payload || {};
                const _vResult = window.BRIDGE_SCHEMA
                  ? window.BRIDGE_SCHEMA.validateMessage({ type: 'hello', ..._helloPayload })
                  : { ok: false, errors: ['BRIDGE_SCHEMA not loaded'] };
                if (!_vResult.ok || _helloPayload.protocol !== BRIDGE_PROTOCOL_VERSION) {
                  // Protocol mismatch — degrade to read-only preview.
                  state.editingSupported = false;
                  const _receivedProto = _helloPayload.protocol !== undefined
                    ? _helloPayload.protocol
                    : '?';
                  addDiagnostic(
                    `bridge-hello-mismatch: expected protocol ${BRIDGE_PROTOCOL_VERSION}, got ${_receivedProto}; errors: ${_vResult.errors.join(', ')}`
                  );
                  showToast(
                    `Несовместимый bridge: shell ожидает протокол v${BRIDGE_PROTOCOL_VERSION}, iframe прислал v${_receivedProto}. Превью переведено в режим только для чтения.`,
                    'error',
                    { title: 'Bridge mismatch', ttl: 999999999 }
                  );
                } else {
                  // Valid hello — record negotiated version and build.
                  state.bridgeProtocolVersion = BRIDGE_PROTOCOL_VERSION;
                  state.bridgeBuild = _helloPayload.build || '';
                  addDiagnostic(
                    `bridge-hello-ok: protocol=${BRIDGE_PROTOCOL_VERSION} build=${state.bridgeBuild}`
                  );
                  if (state.complexityMode === 'advanced') {
                    showToast(
                      `Bridge v${BRIDGE_PROTOCOL_VERSION} подключён: сборка ${state.bridgeBuild}`,
                      'info',
                      { ttl: 3000 }
                    );
                  }
                }
                break;
              }
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
              // [v0.18.0] Multi-select support — [WO-31] basic mode now also
              // honors multi-select when featureFlags.multiSelect is on (D1).
              case "multi-select-add": {
                const nodeId = data.payload?.nodeId;
                if (!nodeId) break;
                const multiSelectEnabled = Boolean(
                  window.featureFlags && window.featureFlags.multiSelect,
                );
                if (!multiSelectEnabled && state.complexityMode !== "advanced") {
                  if (!sessionStorage.getItem("editor:multi-select-toast-shown")) {
                    showToast(
                      "Мульти-выбор — в разработке. Временно доступно в продвинутом режиме: Правка → Группировать.",
                      "info",
                      { ttl: 5500 }
                    );
                    sessionStorage.setItem("editor:multi-select-toast-shown", "1");
                  }
                  break;
                }
                // Toggle: shift-click on already-selected element removes it.
                const idx = state.multiSelectNodeIds.indexOf(nodeId);
                if (idx >= 0) {
                  state.multiSelectNodeIds.splice(idx, 1);
                } else {
                  state.multiSelectNodeIds.push(nodeId);
                }
                if (typeof window.refreshMultiSelectAnchor === "function") {
                  window.refreshMultiSelectAnchor();
                }
                break;
              }
              // [WO-13] ADR-012 §5 — structured ack from iframe after mutation
              case "ack": {
                const _ackPayload = data.payload || {};
                const _refSeq = Number(_ackPayload.refSeq || 0);
                if (_refSeq > 0) {
                  state.bridgeAcks.set(_refSeq, {
                    refSeq: _refSeq,
                    ok: Boolean(_ackPayload.ok),
                    error: _ackPayload.error || undefined,
                    stale: _ackPayload.stale || undefined,
                  });
                  if (!_ackPayload.ok && _ackPayload.error) {
                    addDiagnostic(`bridge-ack-error:seq=${_refSeq}:${_ackPayload.error.code || 'unknown'}:${_ackPayload.error.message || ''}`);
                  }
                }
                break;
              }
              // [WO-36] Container-mode ack — iframe confirms set-selection-mode was applied
              case "container-mode-ack": {
                state.__containerModeAckAt = Date.now();
                addDiagnostic(`container-mode-ack: containerMode=${data.payload?.containerMode}`);
                break;
              }
              // [WO-28] ADR-004 — sibling rects response from iframe snap query
              case "sibling-rects-response": {
                const _srPayload = data.payload || {};
                const _srRequestId = Number(_srPayload.requestId || 0);
                const _srRects = Array.isArray(_srPayload.rects) ? _srPayload.rects : [];
                if (_srRequestId > 0 && typeof window.precisionHandleSiblingRectsResponse === 'function') {
                  window.precisionHandleSiblingRectsResponse(_srRequestId, _srRects);
                }
                break;
              }
            }
          } catch (error) {
            addDiagnostic(
              `parent-message-error:${data.type || "unknown"}:${error instanceof Error ? error.message : String(error)}`,
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
