      // ZONE: Slide Registry & Navigation
      // Slide index, activation requests, pending-selection restore
      // =====================================================================
      function syncSlideRegistry(options = {}) {
        const modelSlides = getStaticSlideModelNodes()
          .map((slide, index) => createModelSlideRegistryEntry(slide, index))
          .filter(Boolean);
        const runtimeSlides = Array.isArray(options.runtimeSlides)
          ? options.runtimeSlides
          : state.runtimeSlides;
        const runtimeById = new Map(
          runtimeSlides
            .map((slide, index) => normalizeRuntimeSlideEntry(slide, index))
            .filter(Boolean)
            .map((slide) => [slide.id, slide]),
        );
        const mergedSlides = modelSlides.length
          ? modelSlides.map((slide, index) => {
              const runtimeSlide = runtimeById.get(slide.id);
              return {
                ...slide,
                ...(runtimeSlide || {}),
                id: slide.id,
                background: slide.background || runtimeSlide?.background || "",
                index,
                source: runtimeSlide ? "model+runtime" : "model",
              };
            })
          : Array.from(runtimeById.values()).sort((a, b) => a.index - b.index);

        runtimeById.forEach((runtimeSlide) => {
          if (mergedSlides.some((slide) => slide.id === runtimeSlide.id)) return;
          mergedSlides.push({ ...runtimeSlide, source: "runtime" });
        });

        if (!mergedSlides.length) {
          state.slideRegistryById = {};
          state.slideRegistryOrder = [];
          state.slides = [];
          state.activeSlideId = null;
          clearRequestedSlideActivation();
          return [];
        }

        const requestedId = getRequestedSlideId();
        if (requestedId && !mergedSlides.some((slide) => slide.id === requestedId)) {
          clearRequestedSlideActivation();
        }
        const nextRequestedId = getRequestedSlideId();
        const nextRuntimeActiveId = mergedSlides.some(
          (slide) => slide.id === (options.runtimeActiveSlideId ?? state.runtimeActiveSlideId),
        )
          ? options.runtimeActiveSlideId ?? state.runtimeActiveSlideId
          : null;
        state.runtimeActiveSlideId = nextRuntimeActiveId;
        const nextActiveId = resolveSlideRegistryActiveId(mergedSlides, {
          requestedSlideId: nextRequestedId,
          runtimeActiveSlideId: nextRuntimeActiveId,
          currentActiveId: options.currentActiveId ?? state.activeSlideId,
        });

        state.slideRegistryById = {};
        state.slideRegistryOrder = mergedSlides.map((slide) => slide.id);
        state.activeSlideId = nextActiveId;
        state.pendingActiveSlideId = nextRequestedId;
        state.slides = mergedSlides.map((slide, index) => {
          const stateInfo = describeSlideRegistryState(slide.id, {
            requestedId: nextRequestedId,
            runtimeActiveId: nextRuntimeActiveId,
            activeId: nextActiveId,
          });
          const entry = {
            ...slide,
            index,
            state: stateInfo.key,
            stateLabel: stateInfo.label,
            isActive: slide.id === nextActiveId,
            isRequested: slide.id === nextRequestedId,
            isRuntimeActive: slide.id === nextRuntimeActiveId,
          };
          state.slideRegistryById[slide.id] = entry;
          return entry;
        });
        return state.slides;
      }

      function stageSlideActivationRequest(slideId, options = {}) {
        const normalizedSlideId = String(slideId || "").trim();
        if (!normalizedSlideId) return null;
        const slideIndex =
          typeof options.index === "number" && Number.isFinite(options.index)
            ? options.index
            : Math.max(0, getSlideIndexById(normalizedSlideId));
        state.requestedSlideActivationSeq += 1;
        state.requestedSlideActivation = {
          requestId: `slide-activation-${state.requestedSlideActivationSeq}`,
          slideId: normalizedSlideId,
          index: slideIndex,
          source: String(options.source || "shell"),
          requestedAt: Date.now(),
          lastSentAt: 0,
          attempts: 0,
          status: "pending",
        };
        clearSlideActivationRetryTimer();
        state.pendingActiveSlideId = normalizedSlideId;
        return state.requestedSlideActivation;
      }

      function schedulePendingSlideActivationRetry(
        reason = "slide-request-retry",
      ) {
        clearSlideActivationRetryTimer();
        const request = getRequestedSlideActivation();
        if (!request || !state.previewReady || !state.bridgeAlive) return false;
        if (request.attempts >= SLIDE_ACTIVATION_MAX_ATTEMPTS) return false;
        state.slideActivationRetryTimer = window.setTimeout(() => {
          state.slideActivationRetryTimer = null;
          const pending = getRequestedSlideActivation();
          if (!pending) return;
          if (
            state.runtimeActiveSlideId &&
            state.runtimeActiveSlideId === pending.slideId
          ) {
            clearRequestedSlideActivation();
            syncSlideRegistry({
              runtimeActiveSlideId: state.runtimeActiveSlideId,
            });
            renderSlidesList();
            refreshUi();
            return;
          }
          dispatchPendingSlideActivation(reason);
        }, SLIDE_ACTIVATION_RETRY_MS);
        return true;
      }

      function dispatchPendingSlideActivation(reason = "slide-request") {
        const request = getRequestedSlideActivation();
        if (!request || !state.previewReady || !state.bridgeAlive) return false;
        const slideIndex = getSlideIndexById(request.slideId);
        if (slideIndex >= 0) request.index = slideIndex;
        const sent = sendToBridge("navigate-to-slide", {
          slideId: request.slideId,
          index: request.index,
          requestId: request.requestId,
          reason,
          source: request.source,
        });
        if (sent) {
          request.lastSentAt = Date.now();
          request.attempts += 1;
          schedulePendingSlideActivationRetry(reason);
        }
        return sent;
      }

      function stagePreviewSelectionRestore(nodeId, options = {}) {
        const normalizedNodeId = String(nodeId || "").trim();
        if (!normalizedNodeId) {
          state.pendingPreviewSelection = null;
          return null;
        }
        state.pendingPreviewSelection = {
          nodeId: normalizedNodeId,
          slideId: String(options.slideId || state.activeSlideId || "").trim() || null,
          focusText: Boolean(options.focusText),
          selectionLeafNodeId:
            String(
              options.selectionLeafNodeId ||
                state.selectionLeafNodeId ||
                normalizedNodeId,
            ).trim() || null,
          selectionPathNodeIds: Array.isArray(options.selectionPathNodeIds)
            ? options.selectionPathNodeIds
                .map((value) => String(value || "").trim())
                .filter(Boolean)
            : Array.isArray(state.selectionPath)
              ? state.selectionPath
                  .map((entry) => String(entry?.nodeId || "").trim())
                  .filter(Boolean)
              : [],
          requestedAt: Date.now(),
        };
        return state.pendingPreviewSelection;
      }

      function buildSelectionBridgePayload(nodeId, options = {}) {
        const normalizedNodeId = String(nodeId || "").trim();
        if (!normalizedNodeId) return null;
        const payload = {
          nodeId: normalizedNodeId,
          focusText: Boolean(options.focusText),
        };
        const selectionNodeId = String(
          options.selectionNodeId || state.selectedNodeId || normalizedNodeId,
        ).trim();
        if (selectionNodeId) {
          payload.selectionNodeId = selectionNodeId;
        }
        const selectionLeafNodeId = String(
          options.selectionLeafNodeId ||
            state.selectionLeafNodeId ||
            normalizedNodeId,
        ).trim();
        if (selectionLeafNodeId) {
          payload.selectionLeafNodeId = selectionLeafNodeId;
        }
        const selectionPathNodeIds = Array.isArray(options.selectionPathNodeIds)
          ? options.selectionPathNodeIds
          : Array.isArray(state.selectionPath)
            ? state.selectionPath.map((entry) => entry?.nodeId)
            : [];
        const normalizedPathNodeIds = selectionPathNodeIds
          .map((value) => String(value || "").trim())
          .filter(Boolean);
        if (normalizedPathNodeIds.length) {
          payload.selectionPathNodeIds = normalizedPathNodeIds;
        }
        return payload;
      }

      function getManipulationTargetNodeId() {
        return String(
          state.manipulationContext?.interactionNodeId || state.selectedNodeId || "",
        ).trim();
      }

      function getSelectionInteractionRect() {
        return cloneRect(
          state.liveSelectionRect ||
            state.manipulationContext?.interactionRect ||
            state.selectedRect,
        );
      }

      function flushPendingPreviewSelection() {
        const pendingSelection = state.pendingPreviewSelection;
        if (!pendingSelection || !state.previewReady || !state.bridgeAlive) return false;
        if (
          pendingSelection.slideId &&
          state.activeSlideId &&
          pendingSelection.slideId !== state.activeSlideId
        ) {
          return false;
        }
        const selectionPayload = buildSelectionBridgePayload(
          pendingSelection.nodeId,
          {
            ...pendingSelection,
            selectionNodeId: pendingSelection.nodeId,
          },
        );
        if (!selectionPayload) return false;
        const sent = sendToBridge("select-element", selectionPayload);
        if (sent) state.pendingPreviewSelection = null;
        return sent;
      }

      function resolvePreferredSlideTarget(options = {}) {
        const preferSlideId = String(options.preferSlideId || "").trim();
        if (
          preferSlideId &&
          state.modelDoc?.querySelector(
            `[data-editor-slide-id="${cssEscape(preferSlideId)}"]`,
          )
        ) {
          return preferSlideId;
        }
        if (
          typeof options.preferSlideIndex === "number" &&
          Number.isFinite(options.preferSlideIndex)
        ) {
          const slide = getStaticSlideModelNodes()[options.preferSlideIndex];
          return slide?.getAttribute("data-editor-slide-id") || null;
        }
        return null;
      }

      // buildPreviewHtml
      // Превью формируется из modelDoc, а не из исходной строки напрямую, чтобы
      // сохранить editor-id и иметь управляемый bridge внутри iframe.

      function upsertBaseHref(doc, baseHref, options = {}) {
        const markPreviewBase = options.markPreviewBase !== false;
        let base = markPreviewBase
          ? doc.head.querySelector("base[data-editor-preview-base]")
          : doc.head.querySelector("base:not([data-editor-preview-base])") ||
            doc.head.querySelector("base[data-editor-preview-base]");
        if (!base) {
          base = doc.createElement("base");
          doc.head.prepend(base);
        }
        if (markPreviewBase) {
          base.setAttribute("data-editor-preview-base", "true");
        } else {
          base.removeAttribute("data-editor-preview-base");
        }
        base.setAttribute("href", baseHref);
      }

      function getManualBaseUrl(fallbackValue = "") {
        const fromState = String(state.manualBaseUrl || "").trim();
        if (fromState) return fromState;
        return String(fallbackValue || els.baseUrlInput?.value || "").trim();
      }

      function normalizeManualBaseUrl(nextValue = "", options = {}) {
        const normalized = String(nextValue || "").trim();
        if (!normalized) return "";
        try {
          const parsed = new URL(normalized);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            throw new Error(`unsupported-protocol:${parsed.protocol}`);
          }
          return parsed.toString();
        } catch (error) {
          if (options.reportInvalid) {
            reportShellWarning("manual-base-url-invalid", error, {
              once: true,
              diagnostic: false,
            });
            showToast(
              "Base URL должен быть абсолютным http(s)-адресом. Некорректное значение очищено.",
              "warning",
              { title: "Base URL" },
            );
          }
          return "";
        }
      }

      function setManualBaseUrl(nextValue = "", options = {}) {
        const normalized = normalizeManualBaseUrl(nextValue, options);
        state.manualBaseUrl = normalized;
        if (els.baseUrlInput && els.baseUrlInput.value !== normalized) {
          els.baseUrlInput.value = normalized;
        }
        return normalized;
      }

      function getAutosaveStorage() {
        return window.sessionStorage;
      }

      function getStarterDeckConfig(key = "basic") {
        const normalizedKey = String(key || "basic").trim().toLowerCase();
        return STARTER_DECKS[normalizedKey] || STARTER_DECKS.basic || null;
      }

      function clearStarterLaunchIntent() {
        try {
          const currentUrl = new URL(window.location.href);
          if (!currentUrl.searchParams.has("starter")) return;
          currentUrl.searchParams.delete("starter");
          window.history.replaceState({}, "", currentUrl.toString());
        } catch (error) {
          reportShellWarning("starter-launch-intent-clear-failed", error, {
            once: true,
          });
        }
      }

      async function loadStarterDeck(starterKey = "basic") {
        const starter = getStarterDeckConfig(starterKey);
        if (!starter) {
          showToast("Стартовый пример недоступен.", "warning", {
            title: "Стартовый пример",
          });
          return;
        }

        const manualBaseUrl = new URL(
          starter.manualBasePath,
          `${window.location.origin}/`,
        ).toString();

        try {
          setPreviewLoading(true, "Загрузка стартового примера…");
          const response = await fetch(starter.href, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (!response.ok) {
            throw new Error(`starter-fetch-${response.status}`);
          }
          const htmlText = await response.text();
          loadHtmlString(htmlText, starter.label, {
            resetHistory: true,
            dirty: false,
            manualBaseUrl,
          });
          closeModal(els.openHtmlModal);
          showToast(
            "Открыт стартовый пример. Превью готово, можно переходить к точечной правке.",
            "success",
            { title: "Стартовый пример" },
          );
        } catch (error) {
          console.error(error);
          setPreviewLoading(false);
          showToast(
            "Не удалось открыть стартовый пример. Проверьте локальный сервер и попробуйте ещё раз.",
            "warning",
            { title: "Стартовый пример" },
          );
        } finally {
          clearStarterLaunchIntent();
        }
      }

      function consumeStarterLaunchIntent() {
        try {
          const currentUrl = new URL(window.location.href);
          const starterKey = currentUrl.searchParams.get("starter");
          if (!starterKey) return false;
          void loadStarterDeck(starterKey);
          return true;
        } catch (error) {
          reportShellWarning("starter-launch-intent-read-failed", error, {
            once: true,
          });
          return false;
        }
      }

      function createRenderedOutputContract(options = {}) {
        const keepEditorArtifacts = options.keepEditorArtifacts !== false;
        const includeBridge = Boolean(options.includeBridge);
        const manualBaseUrl = String(
          options.manualBaseUrl ?? options.baseHref ?? getManualBaseUrl(),
        ).trim();
        return {
          renderMode: String(options.renderMode || "preview").trim() || "preview",
          applyAssetResolver: Boolean(
            options.applyAssetResolver && state.assetResolverMap,
          ),
          keepEditorArtifacts,
          includeBridge,
          auditAssets: Boolean(options.auditAssets),
          captureAuditToState: Boolean(options.captureAuditToState),
          manualBaseUrl,
          baseHref: manualBaseUrl,
          previewOnly: keepEditorArtifacts && includeBridge,
          exportSafe: !keepEditorArtifacts,
        };
      }

      function createEmptyPreviewAssetAudit() {
        return {
          resolved: [],
          unresolved: [],
          baseUrlDependent: [],
          counts: {
            resolved: 0,
            unresolved: 0,
            baseUrlDependent: 0,
          },
        };
      }

      function buildRenderedOutputPackage(options = {}) {
        const contract = createRenderedOutputContract(options);
        const outputDoc = buildRenderedOutputDocument(contract);
        if (!outputDoc) return null;
        const assetAudit = contract.auditAssets
          ? collectPreviewAssetAudit(state.modelDoc, { baseHref: contract.baseHref })
          : createEmptyPreviewAssetAudit();
        if (contract.captureAuditToState) {
          updatePreviewAssetAuditFromAudit(assetAudit);
        }
        const serialized = serializeDocumentWithDoctype(outputDoc);
        const blob = new Blob([serialized], {
          type: "text/html;charset=utf-8",
        });
        const slideCount = detectStaticSlides(outputDoc).items.length;
        return {
          document: outputDoc,
          serialized,
          blob,
          slideCount,
          usesAssetResolver: contract.applyAssetResolver,
          assetAudit,
          contract,
        };
      }

      // =====================================================================
