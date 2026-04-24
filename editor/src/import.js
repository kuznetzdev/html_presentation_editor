      // ZONE: Document Loading & Import Pipeline
      // loadHtmlString → runUnifiedImportPipeline → model, identity resolution
      // =====================================================================
      // ====================================================================
      // loadHtmlString
      // 1) сбрасывает runtime-состояние,
      // 2) строит modelDoc,
      // 3) собирает preview HTML с bridge,
      // 4) грузит Blob URL в iframe.
      // Это центральная точка входа для загрузки презентации.
      // ====================================================================
      function loadHtmlString(htmlString, sourceLabel, options = {}) {
        // [v1.2.0 / ADR-035] Smart Import Pipeline v2 gate.
        // When featureFlags.smartImport is "report" or "full", run the
        // preprocessing pipeline and show the report modal before loading.
        // On confirm, re-invoke loadHtmlString with bypassReport=true. On
        // cancel, abort the load entirely.
        const smartImportMode = String(
          (window.featureFlags && window.featureFlags.smartImport) || "off",
        );
        if (
          smartImportMode !== "off" &&
          !options.bypassReport &&
          typeof window.runImportPipelineV2 === "function" &&
          typeof window.showImportReportModal === "function"
        ) {
          const report = window.runImportPipelineV2(htmlString);
          if (report && report.ok) {
            // [v1.5.1] Stash for later UI surfaces (health badge, etc.).
            state.importReport = report;
            window.refreshDeckHealthBadge?.();
            window.showImportReportModal(report, {
              onContinue() {
                loadHtmlString(htmlString, sourceLabel, {
                  ...options,
                  bypassReport: true,
                });
              },
              onCancel() {
                state.importReport = null;
                window.refreshDeckHealthBadge?.();
                setPreviewLoading(false);
              },
            });
            // Returning true tells callers (Open HTML modal, etc.) that the
            // load was accepted — they can close their own UI. The actual
            // modelDoc update happens only after the user confirms the report.
            return true;
          }
        }
        const requestedMode = normalizeEditorMode(options.mode, "preview");
        const manualBaseUrl = String(
          options.manualBaseUrl ?? els.baseUrlInput?.value ?? "",
        ).trim();
        clearPendingPersistenceTimers();
        cleanupPreviewUrl();
        cleanupExportValidationUrl();
        resetRuntimeState();
        closeContextMenu();
        closeSlideTemplateBar();
        hideFloatingToolbar();
        hideRestoreBanner();
        setPreviewLifecycleState("loading", { reason: "load-html" });
        setPreviewLoading(true, "Подготовка превью…");

        state.sourceLabel = sourceLabel;
        state.sourceHtml = htmlString;
        state.doctypeString = extractDoctype(htmlString) || "<!DOCTYPE html>";
        setManualBaseUrl(manualBaseUrl, {
          reportInvalid: Boolean(manualBaseUrl),
        });
        state.bridgeToken = createBridgeToken();
        state.mode = "preview";
        state.interactionMode = "preview";
        state.dirty = Boolean(options.dirty);

        try {
          state.modelDoc = buildModelDocument(htmlString);
          state.editingSupported = Boolean(
            state.modelDoc &&
            state.modelDoc.querySelector("[data-editor-node-id]"),
          );
          state.mode =
            requestedMode === "edit" && state.editingSupported ? "edit" : "preview";
          state.interactionMode = state.mode === "edit" ? "select" : "preview";
        } catch (error) {
          console.error(error);
          setPreviewLifecycleState("idle", { reason: "parse-error" });
          setPreviewLoading(false);
          refreshUi();
          const detail =
            error instanceof Error && error.message
              ? error.message
              : "Не удалось разобрать HTML.";
          const message = `Не удалось разобрать HTML: ${detail}`;
          if (typeof options.onError === "function") options.onError(message, error);
          else {
            showToast(message, "error", {
              title: "Открыть HTML",
            });
          }
          return false;
        }

        const preferredSlideId = resolvePreferredSlideTarget({
          preferSlideId: options.preferSlideId,
          preferSlideIndex: options.preferSlideIndex,
        });
        state.runtimeSlides = [];
        state.runtimeActiveSlideId = null;
        clearRequestedSlideActivation();
        if (preferredSlideId) {
          stageSlideActivationRequest(preferredSlideId, {
            source: "load-html",
          });
        }
        syncSlideRegistry({
          currentActiveId: preferredSlideId || getFirstModelSlideId(),
        });

        if (options.resetHistory) {
          state.history = [];
          state.historyIndex = -1;
        }

        const previewPack = buildPreviewPackage();
        if (!previewPack) {
          throw new Error("Не удалось собрать preview-документ.");
        }
        state.previewUrl = URL.createObjectURL(previewPack.blob);

        els.documentMeta.textContent = `${sourceLabel} • подготовка превью…`;
        els.emptyState.classList.add("hidden");
        els.previewFrame.classList.remove("hidden");
        // Sandbox-mode switch — AUDIT-D-01/07, ADR-014 §Layer 1, WO-06.
        // OFF (default) removes the sandbox attribute entirely so the deck's own
        // script engine (reveal.js, Shower, etc.) keeps running.
        // SCRIPTS_ONLY / FULL are reserved for WO-07 Trust-Banner toggle.
        switch (state.sandboxMode) {
          case SANDBOX_MODES.SCRIPTS_ONLY:
            els.previewFrame.setAttribute("sandbox", "allow-scripts allow-same-origin");
            break;
          case SANDBOX_MODES.FULL:
            els.previewFrame.setAttribute("sandbox", "allow-same-origin");
            break;
          case SANDBOX_MODES.OFF:
          default:
            // off = trust user's own deck script engine (ADR-014 §Layer 1, AUDIT-D-01/07)
            els.previewFrame.removeAttribute("sandbox");
            break;
        }
        els.previewFrame.src = state.previewUrl;

        els.previewFrame.onload = () => {
          sendToBridge("set-mode", { mode: state.mode });
          // [LAYER-MODEL v2] sync selection mode after iframe load
          sendToBridge("set-selection-mode", { containerMode: state.selectionMode === "container" });
          // [WO-06] probe for broken assets after iframe fully settles
          window.setTimeout(function() {
            if (typeof runBrokenAssetProbeAndReport === "function") {
              runBrokenAssetProbeAndReport();
            }
          }, 200);
          // [WO-07] Show trust banner if scan detected executable code and user
          // has not yet made a trust decision for this import session.
          // dismissible: false — user must choose an action (banner persists).
          // Non-blocking: no modal focus-trap; editing and navigation continue.
          // OWASP A03:2021 Injection — CWE-79, CWE-1021, AUDIT-D-01.
          window.setTimeout(function() {
            maybeShowTrustBanner();
          }, 250);
        };

        if (options.resetHistory) {
          captureHistorySnapshot("load", { force: true });
        }
        schedulePersistence();
        refreshUi();
        return true;
      }

      // buildModelDocument
      // Здесь создаётся отдельная DOM-модель документа для экспорта и синхронизации.
      // Каждому слайду и каждому редактируемому узлу присваиваются editor-id маркеры.
      function readNonEmptyAttribute(element, attributeNames = []) {
        if (!(element instanceof Element)) return "";
        for (const attributeName of attributeNames) {
          const value = String(element.getAttribute(attributeName) || "").trim();
          if (value) return value;
        }
        return "";
      }

      function parseBooleanLikeAttribute(value) {
        const normalized = String(value || "")
          .trim()
          .toLowerCase();
        if (!normalized) return null;
        if (["0", "false", "no", "readonly", "read-only"].includes(normalized)) {
          return false;
        }
        if (["1", "true", "yes", "editable"].includes(normalized)) {
          return true;
        }
        return true;
      }

      function copyAttributeIfMissing(source, target, attributeName) {
        if (!(source instanceof Element) || !(target instanceof Element)) return;
        const targetValue = String(target.getAttribute(attributeName) || "").trim();
        if (targetValue) return;
        const sourceValue = String(source.getAttribute(attributeName) || "").trim();
        if (sourceValue) target.setAttribute(attributeName, sourceValue);
      }

      function preserveAuthoredMarkerContract(source, target) {
        if (!(source instanceof Element) || !(target instanceof Element)) return;
        copyAttributeIfMissing(source, target, AUTHOR_SLIDE_ID_ATTRS[0]);
        copyAttributeIfMissing(source, target, AUTHOR_NODE_ID_ATTRS[0]);
        copyAttributeIfMissing(source, target, AUTHOR_NODE_KIND_ATTRS[0]);
        copyAttributeIfMissing(source, target, AUTHOR_EDITABLE_ATTRS[0]);
      }

      function stripAuthoredIdentityAttrs(root, options = {}) {
        if (!(root instanceof Element)) return;
        if (options.stripSlideId) {
          root.removeAttribute(AUTHOR_SLIDE_ID_ATTRS[0]);
        }
        [root, ...root.querySelectorAll(`[${AUTHOR_NODE_ID_ATTRS[0]}]`)].forEach(
          (node) => {
            if (node instanceof Element) {
              node.removeAttribute(AUTHOR_NODE_ID_ATTRS[0]);
            }
          },
        );
      }

      function normalizeImportedIdentity(value) {
        return String(value || "")
          .replace(/\s+/g, "-")
          .replace(/["']/g, "")
          .trim();
      }

      function claimUniqueImportedIdentity(rawValue, usedIds, prefix = "node") {
        const normalized = normalizeImportedIdentity(rawValue);
        if (!normalized) return "";
        let candidate = normalized;
        let suffix = 2;
        while (usedIds.has(candidate)) {
          candidate = `${normalized}-${prefix}-${suffix}`;
          suffix += 1;
        }
        usedIds.add(candidate);
        return candidate;
      }

      function collectUsedAuthoredSlideIdsInModel(exceptRoot = null) {
        const used = new Set();
        getStaticSlideModelNodes().forEach((slide) => {
          if (!(slide instanceof Element) || slide === exceptRoot) return;
          const authoredSlideId = readNonEmptyAttribute(slide, AUTHOR_SLIDE_ID_ATTRS);
          const normalized = normalizeImportedIdentity(authoredSlideId);
          if (normalized) used.add(normalized);
        });
        return used;
      }

      function claimUniqueAuthoredSlideIdInModel(rawValue, exceptRoot = null) {
        return claimUniqueImportedIdentity(
          rawValue,
          collectUsedAuthoredSlideIdsInModel(exceptRoot),
          "slide",
        );
      }

      function hashStableImportSeed(seed) {
        let hash = 2166136261;
        const text = String(seed || "");
        for (let index = 0; index < text.length; index += 1) {
          hash ^= text.charCodeAt(index);
          hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36);
      }

      function getElementImportPath(root, node) {
        if (!(root instanceof Element) || !(node instanceof Element)) return null;
        if (root === node) return "root";
        if (!root.contains(node)) return null;
        const segments = [];
        let current = node;
        while (current && current !== root) {
          const parent = current.parentElement;
          if (!parent) return null;
          segments.unshift(Array.from(parent.children).indexOf(current));
          current = parent;
        }
        return segments.join(".");
      }

      function isCriticalStructureElement(el) {
        return (
          el instanceof Element &&
          el.matches(
            ".reveal, .slides, .shower, .deck, .deck-container, .remark-slide-container",
          )
        );
      }

      function isImageElement(el) {
        return el instanceof Element && el.tagName === "IMG";
      }

      function isEmbeddedVideoFrame(el) {
        return (
          el instanceof Element &&
          el.tagName === "IFRAME" &&
          /(youtube|youtu\.be|vimeo)/i.test(el.getAttribute("src") || "")
        );
      }

      function isVideoElement(el) {
        return (
          el instanceof Element &&
          (el.tagName === "VIDEO" || isEmbeddedVideoFrame(el))
        );
      }

      function isTableCellElement(el) {
        return el instanceof Element && (el.tagName === "TD" || el.tagName === "TH");
      }

      function isCodeBlockElement(el) {
        return (
          el instanceof Element &&
          (el.tagName === "PRE" ||
            (el.tagName === "CODE" && el.parentElement?.tagName === "PRE"))
        );
      }

      function isSvgElement(el) {
        return (
          el instanceof Element &&
          (el.tagName === "SVG" ||
            el.localName === "svg" ||
            (typeof SVGElement !== "undefined" && el instanceof SVGElement))
        );
      }

      function isFragmentWrapperElement(el) {
        return (
          el instanceof Element &&
          (el.classList.contains("fragment") ||
            el.hasAttribute("data-fragment-index") ||
            el.hasAttribute("data-stateful") ||
            el.hasAttribute("data-state"))
        );
      }

      function canEditTextHeuristically(el) {
        if (!(el instanceof Element)) return false;
        if (isCriticalStructureElement(el) || isSvgElement(el)) return false;
        if (TEXT_TAGS.has(el.tagName)) return true;
        if (el.getAttribute("contenteditable") === "true") return true;
        if (!["DIV", "SECTION", "ARTICLE", "SPAN"].includes(el.tagName)) return false;
        const hasComplexChildren = Array.from(el.children).some(
          (child) =>
            !["SPAN", "B", "STRONG", "I", "EM", "U", "SMALL", "A", "BR"].includes(
              child.tagName,
            ),
        );
        const text = String(el.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        return Boolean(text) && !hasComplexChildren;
      }

      function isContainerHeuristically(el) {
        if (!(el instanceof Element)) return false;
        if (el.hasAttribute(EDITOR_SLIDE_ID_ATTR)) return false;
        if (
          isImageElement(el) ||
          isVideoElement(el) ||
          isTableCellElement(el) ||
          isCodeBlockElement(el) ||
          isSvgElement(el) ||
          canEditTextHeuristically(el)
        ) {
          return false;
        }
        return (
          el.children.length > 0 ||
          [
            "DIV",
            "SECTION",
            "ARTICLE",
            "MAIN",
            "HEADER",
            "FOOTER",
            "ASIDE",
            "NAV",
            "FIGURE",
            "UL",
            "OL",
            "TABLE",
            "THEAD",
            "TBODY",
            "TFOOT",
            "TR",
          ].includes(el.tagName)
        );
      }

      function mapAuthorKindToEntityKind(kindHint) {
        switch (String(kindHint || "").trim().toLowerCase()) {
          case "text":
            return "text";
          case "group":
          case "container":
            return "container";
          case "image":
          case "img":
            return "image";
          case "video":
          case "iframe":
            return "video";
          case "table":
            return "table";
          case "cell":
          case "table-cell":
            return "table-cell";
          case "code":
          case "code-block":
            return "code-block";
          case "svg":
            return "svg";
          case "fragment":
          case "stateful":
            return "fragment";
          case "shape":
          case "element":
            return "element";
          default:
            return "";
        }
      }

      function resolveImportedEntityKind(el, slideRoot) {
        if (!(el instanceof Element)) return "none";
        if (el === slideRoot) return "slide-root";
        const authorKind = mapAuthorKindToEntityKind(
          readNonEmptyAttribute(el, AUTHOR_NODE_KIND_ATTRS),
        );
        if (authorKind) return authorKind;
        const existingKind = String(el.getAttribute(EDITOR_ENTITY_KIND_ATTR) || "")
          .trim()
          .toLowerCase();
        if (IMPORT_ENTITY_KINDS.has(existingKind)) return existingKind;
        if (isCriticalStructureElement(el)) return "protected";
        if (isSvgElement(el)) return "svg";
        if (["TABLE", "THEAD", "TBODY", "TFOOT", "TR"].includes(el.tagName))
          return "table";
        if (isTableCellElement(el)) return "table-cell";
        if (isCodeBlockElement(el)) return "code-block";
        if (isImageElement(el)) return "image";
        if (isVideoElement(el)) return "video";
        if (isFragmentWrapperElement(el)) return "fragment";
        if (canEditTextHeuristically(el)) return "text";
        if (isContainerHeuristically(el)) return "container";
        return "element";
      }

      function resolveImportedEditability(el, entityKind) {
        const explicitEditable = parseBooleanLikeAttribute(
          readNonEmptyAttribute(el, AUTHOR_EDITABLE_ATTRS),
        );
        if (explicitEditable !== null) return explicitEditable;
        const existingEditable = parseBooleanLikeAttribute(
          el.getAttribute(EDITOR_EDITABLE_ATTR),
        );
        if (existingEditable !== null) return existingEditable;
        if (entityKind === "text") return true;
        if (entityKind === "table-cell") return true;
        if (entityKind === "code-block") return true;
        if (entityKind === "fragment") return canEditTextHeuristically(el);
        if (el.getAttribute("contenteditable") === "true") return true;
        return false;
      }

      function createImportPolicyHint(entityKind) {
        switch (entityKind) {
          case "slide-root":
            return {
              kind: "slide-root",
              reason:
                "Корневой контейнер слайда редактируется только в безопасном режиме.",
            };
          case "protected":
            return {
              kind: "critical-structure",
              reason:
                "Системный контейнер deck защищён от прямого редактирования и structural-операций.",
            };
          case "table":
            return {
              kind: "structured-table",
              reason:
                "Таблица импортирована как структурированный DOM-блок: безопаснее редактировать ячейки, а не сырой HTML.",
            };
          case "code-block":
            return {
              kind: "plain-text-block",
              reason:
                "Code block сохраняет пробелы и переносы строк. Избегайте raw HTML replacement.",
            };
          case "svg":
            return {
              kind: "svg-object",
              reason:
                "Inline SVG импортирован как object-level блок. Внутреннюю векторную структуру нужно сохранять.",
            };
          case "fragment":
            return {
              kind: "stateful-wrapper",
              reason:
                "Stateful wrapper сохраняет fragment/state classes и data-* атрибуты.",
            };
          default:
            return null;
        }
      }

      function resolveImportedPolicyHint(el, entityKind) {
        if (!(el instanceof Element)) return createImportPolicyHint(entityKind);
        const explicitKind = String(el.getAttribute(EDITOR_POLICY_KIND_ATTR) || "").trim();
        const explicitReason = String(el.getAttribute(EDITOR_POLICY_REASON_ATTR) || "").trim();
        if (explicitKind) {
          const fallback = createImportPolicyHint(entityKind);
          return {
            kind: explicitKind,
            reason: explicitReason || fallback?.reason || "",
          };
        }
        return createImportPolicyHint(entityKind);
      }

      function applyImportPolicyHint(el, policyHint) {
        if (!(el instanceof Element)) return;
        if (!policyHint) {
          el.removeAttribute(EDITOR_POLICY_KIND_ATTR);
          el.removeAttribute(EDITOR_POLICY_REASON_ATTR);
          return;
        }
        el.setAttribute(EDITOR_POLICY_KIND_ATTR, policyHint.kind);
        el.setAttribute(EDITOR_POLICY_REASON_ATTR, policyHint.reason);
      }

      function resolveImportedSlideIdentity(slide, slideIndex, usedSlideIds) {
        const authorSlideId = readNonEmptyAttribute(slide, AUTHOR_SLIDE_ID_ATTRS);
        if (authorSlideId) {
          return claimUniqueImportedIdentity(authorSlideId, usedSlideIds, "slide");
        }
        const existingSlideId = readNonEmptyAttribute(slide, [EDITOR_SLIDE_ID_ATTR]);
        if (existingSlideId) {
          return claimUniqueImportedIdentity(existingSlideId, usedSlideIds, "slide");
        }
        const heuristicSlideId = readNonEmptyAttribute(slide, ["id"]);
        if (heuristicSlideId) {
          return claimUniqueImportedIdentity(heuristicSlideId, usedSlideIds, "slide");
        }
        return claimUniqueImportedIdentity(
          `slide-${slideIndex + 1}`,
          usedSlideIds,
          "slide",
        );
      }

      function resolveImportedNodeIdentity(el, slideRoot, slideId, nodeIndex, usedNodeIds) {
        const authorNodeId = readNonEmptyAttribute(el, AUTHOR_NODE_ID_ATTRS);
        if (authorNodeId) {
          return claimUniqueImportedIdentity(authorNodeId, usedNodeIds, "node");
        }
        const existingNodeId = readNonEmptyAttribute(el, [EDITOR_NODE_ID_ATTR]);
        if (existingNodeId) {
          return claimUniqueImportedIdentity(existingNodeId, usedNodeIds, "node");
        }
        const heuristicNodeId = readNonEmptyAttribute(el, ["id"]);
        if (heuristicNodeId) {
          return claimUniqueImportedIdentity(heuristicNodeId, usedNodeIds, "node");
        }
        const pathWithinSlide = getElementImportPath(slideRoot, el) || `index-${nodeIndex}`;
        const generatedId = `node-${hashStableImportSeed(
          `${slideId}|${el.tagName}|${pathWithinSlide}`,
        )}`;
        return claimUniqueImportedIdentity(generatedId, usedNodeIds, "node");
      }

      // =====================================================================
      // scanTrustSignals — scan-only, no DOM mutation (WO-07, AUDIT-D-01)
      // Returns a signals object describing executable-code patterns found in doc.
      // The scan never strips; stripping is opt-in via neutralizeAndReload().
      //
      // Returns:
      //   { scriptCount, inlineHandlerCount, jsUrlCount, remoteIframeCount,
      //     metaRefreshCount, objectEmbedCount, totalFindings,
      //     samples: { scripts[], inlineHandlers[], jsUrls[], remoteIframes[],
      //                metaRefresh[], objectEmbed[] }  (max 5 per kind, 120 chars) }
      //
      // OWASP A03:2021 Injection — CWE-79, CWE-1021
      function scanTrustSignals(doc) {
        if (!doc) {
          return {
            scriptCount: 0, inlineHandlerCount: 0, jsUrlCount: 0,
            remoteIframeCount: 0, metaRefreshCount: 0, objectEmbedCount: 0,
            totalFindings: 0, samples: {},
          };
        }
        function collectSamples(els) {
          return Array.from(els).slice(0, 5).map(function (el) {
            return (el.outerHTML || '').slice(0, 120);
          });
        }
        var scripts       = doc.querySelectorAll(TRUST_DETECTION_SELECTORS.scripts);
        var handlers      = doc.querySelectorAll(TRUST_DETECTION_SELECTORS.inlineHandlers);
        var jsUrls        = doc.querySelectorAll(TRUST_DETECTION_SELECTORS.jsUrls);
        var remoteIframes = doc.querySelectorAll(TRUST_DETECTION_SELECTORS.remoteIframes);
        var metaRefresh   = doc.querySelectorAll(TRUST_DETECTION_SELECTORS.metaRefresh);
        var objectEmbed   = doc.querySelectorAll(TRUST_DETECTION_SELECTORS.objectEmbed);
        var scriptCount        = scripts.length;
        var inlineHandlerCount = handlers.length;
        var jsUrlCount         = jsUrls.length;
        var remoteIframeCount  = remoteIframes.length;
        var metaRefreshCount   = metaRefresh.length;
        var objectEmbedCount   = objectEmbed.length;
        var totalFindings = scriptCount + inlineHandlerCount + jsUrlCount +
                            remoteIframeCount + metaRefreshCount + objectEmbedCount;
        return {
          scriptCount: scriptCount,
          inlineHandlerCount: inlineHandlerCount,
          jsUrlCount: jsUrlCount,
          remoteIframeCount: remoteIframeCount,
          metaRefreshCount: metaRefreshCount,
          objectEmbedCount: objectEmbedCount,
          totalFindings: totalFindings,
          samples: {
            scripts:       collectSamples(scripts),
            inlineHandlers:collectSamples(handlers),
            jsUrls:        collectSamples(jsUrls),
            remoteIframes: collectSamples(remoteIframes),
            metaRefresh:   collectSamples(metaRefresh),
            objectEmbed:   collectSamples(objectEmbed),
          },
        };
      }

      function buildModelDocument(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, "text/html");
        runUnifiedImportPipeline(doc);
        // [WO-07] Persist raw source and scan for trust signals after import pipeline.
        // lastImportedRawHtml is needed by neutralizeAndReload() to re-parse
        // from the original (un-annotated) source. trustSignals drive the banner.
        state.lastImportedRawHtml = htmlString;
        state.trustSignals = scanTrustSignals(doc);
        return doc;
      }

      function detectStaticSlides(doc) {
        const markerSlides = Array.from(doc.querySelectorAll("[data-slide-id]"));
        if (markerSlides.length) {
          return { selector: "[data-slide-id]", items: markerSlides };
        }
        for (const selector of STATIC_SLIDE_SELECTORS) {
          const items = Array.from(doc.querySelectorAll(selector));
          if (items.length > 0) {
            return { selector, items };
          }
        }
        const semanticSlides = detectSemanticSlides(doc);
        if (semanticSlides.items.length) return semanticSlides;
        const heuristicSlides = detectHeuristicSlides(doc);
        if (heuristicSlides.items.length) return heuristicSlides;
        return { selector: null, items: [] };
      }

      function collectCandidateElements(slide) {
        const result = [];
        const all = [slide, ...slide.querySelectorAll("*")];
        for (const el of all) {
          if (!(el instanceof Element)) continue;
          if (EXCLUDED_TAGS.has(el.tagName)) continue;
          if (el.tagName === "BR") continue;
          if (el !== slide && el.closest("script,style,template,svg defs")) continue;
          const svgAncestor = el.closest("svg");
          if (svgAncestor && svgAncestor !== el) continue;
          const preAncestor = el.closest("pre");
          if (preAncestor && preAncestor !== el) continue;
          result.push(el);
        }
        return result;
      }

      function detectSemanticSlides(doc) {
        for (const selector of SEMANTIC_DECK_SELECTORS) {
          const containers = Array.from(doc.querySelectorAll(selector));
          for (const container of containers) {
            const items = Array.from(container.children).filter(
              (child) =>
                child instanceof Element &&
                SEMANTIC_SLIDE_TAGS.has(child.tagName) &&
                !EXCLUDED_TAGS.has(child.tagName),
            );
            if (items.length) {
              return {
                selector: `semantic:${selector}`,
                items,
              };
            }
          }
        }
        return { selector: null, items: [] };
      }

      function detectHeuristicSlides(doc) {
        const containers = [
          doc.body,
          ...Array.from(doc.querySelectorAll("main, article, div")),
        ];
        for (const container of containers) {
          if (!(container instanceof Element)) continue;
          const items = Array.from(container.children).filter(
            (child) =>
              child instanceof Element &&
              SEMANTIC_SLIDE_TAGS.has(child.tagName) &&
              !EXCLUDED_TAGS.has(child.tagName) &&
              !isCriticalStructureElement(child),
          );
          if (items.length >= 2) {
            return {
              selector: "heuristic:sibling-sections",
              items,
            };
          }
        }
        return { selector: null, items: [] };
      }

      function runUnifiedImportPipeline(doc) {
        const slides = detectStaticSlides(doc);
        state.staticSlideSelector = slides.selector;
        const usedSlideIds = new Set();
        const usedNodeIds = new Set();
        slides.items.forEach((slide, slideIndex) => {
          const slideId = resolveImportedSlideIdentity(slide, slideIndex, usedSlideIds);
          slide.setAttribute(EDITOR_SLIDE_ID_ATTR, slideId);
          slide.setAttribute(EDITOR_ENTITY_KIND_ATTR, "slide-root");
          slide.setAttribute(EDITOR_EDITABLE_ATTR, "false");
          applyImportPolicyHint(slide, resolveImportedPolicyHint(slide, "slide-root"));
          collectCandidateElements(slide).forEach((node, nodeIndex) => {
            const entityKind = resolveImportedEntityKind(node, slide);
            const editable = resolveImportedEditability(node, entityKind);
            const nodeId = resolveImportedNodeIdentity(
              node,
              slide,
              slideId,
              nodeIndex,
              usedNodeIds,
            );
            node.setAttribute(EDITOR_NODE_ID_ATTR, nodeId);
            node.setAttribute(EDITOR_ENTITY_KIND_ATTR, entityKind);
            node.setAttribute(EDITOR_EDITABLE_ATTR, editable ? "true" : "false");
            applyImportPolicyHint(node, resolveImportedPolicyHint(node, entityKind));
          });
        });
        return slides;
      }

      function getFirstModelSlideId() {
        const firstSlide = getStaticSlideModelNodes()[0];
        return firstSlide?.getAttribute("data-editor-slide-id") || null;
      }

      function getModelSlideTitle(slide) {
        if (!(slide instanceof Element)) return "Пустой слайд";
        const titleOverride = getSlideTitleOverride(slide);
        if (titleOverride) return titleOverride;
        const heading = slide.querySelector(
          "h1, h2, h3, .slide-title, [data-slide-title]",
        );
        if (heading?.textContent?.trim()) return heading.textContent.trim();
        const text = String(slide.textContent || "")
          .replace(/\s+/g, " ")
          .trim();
        return text ? text.slice(0, 60) + (text.length > 60 ? "…" : "") : "Пустой слайд";
      }

      function getModelSlideBackgroundValue(slide) {
        if (!(slide instanceof Element)) return "";
        return String(
          slide.getAttribute("data-slide-bg") || slide.style.backgroundColor || "",
        ).trim();
      }

      function createModelSlideRegistryEntry(slide, index) {
        if (!(slide instanceof Element)) return null;
        const slideId = String(slide.getAttribute("data-editor-slide-id") || "").trim();
        if (!slideId) return null;
        return {
          id: slideId,
          title: getModelSlideTitle(slide),
          titleOverride: getSlideTitleOverride(slide),
          preset: getSlidePresetValue(slide),
          background: getModelSlideBackgroundValue(slide),
          paddingPreset: getSlidePaddingPreset(slide),
          index,
          exportable: true,
          source: "model",
        };
      }

      function normalizeRuntimeSlideEntry(slide, index) {
        if (!slide || typeof slide !== "object") return null;
        const slideId = String(slide.id || "").trim();
        if (!slideId) return null;
        return {
          id: slideId,
          title: String(slide.title || "").trim() || "Пустой слайд",
          titleOverride: String(slide.titleOverride || "").trim(),
          preset: String(slide.preset || "").trim(),
          background: String(slide.background || "").trim(),
          paddingPreset: String(slide.paddingPreset || "").trim(),
          index:
            typeof slide.index === "number" && Number.isFinite(slide.index)
              ? slide.index
              : index,
          exportable: slide.exportable !== false,
          source: "runtime",
        };
      }

      function getRequestedSlideActivation() {
        return state.requestedSlideActivation || null;
      }

      function clearSlideActivationRetryTimer() {
        if (!state.slideActivationRetryTimer) return;
        window.clearTimeout(state.slideActivationRetryTimer);
        state.slideActivationRetryTimer = null;
      }

      function clearRequestedSlideActivation() {
        clearSlideActivationRetryTimer();
        state.requestedSlideActivation = null;
        state.pendingActiveSlideId = null;
      }

      function getRequestedSlideId() {
        return getRequestedSlideActivation()?.slideId || null;
      }

      function getSlideRegistryIds(slides = state.slides) {
        return slides.map((slide) => slide.id);
      }

      function createBridgeToken() {
        // Security: use crypto.getRandomValues for 192 bits of entropy (CWE-338, AUDIT-D-15).
        // This replaces the former Math.random approach (~52 bits) while preserving the
        // "pe-" prefix for back-compat log-grep and the Date.now() suffix for uniqueness.
        // Fallback branch handles sandboxed contexts where crypto.getRandomValues is absent.
        const ts = Date.now();
        try {
          const bytes = new Uint8Array(24); // 24 bytes = 192 bits = 48 hex chars
          crypto.getRandomValues(bytes);
          let hex = "";
          for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, "0");
          }
          return `pe-${hex}-${ts}`;
        } catch (_cryptoErr) {
          // Fallback: crypto.getRandomValues unavailable (sandboxed iframe, some CI envs).
          // Emit a diagnostic if the shell function is reachable; swallow any errors.
          try { addDiagnostic("bridge-token-fallback-nosubtle"); } catch (e) { /* noop */ }
          const fallbackBytes = new Uint8Array(24);
          for (let i = 0; i < fallbackBytes.length; i++) {
            fallbackBytes[i] = Math.floor(Math.random() * 256);
          }
          let fallbackHex = "";
          for (let i = 0; i < fallbackBytes.length; i++) {
            fallbackHex += fallbackBytes[i].toString(16).padStart(2, "0");
          }
          return `pe-${fallbackHex}-${ts}`;
        }
      }

      function resolveSlideRegistryActiveId(slides, options = {}) {
        const slideIds = new Set(getSlideRegistryIds(slides));
        const requestedId = slideIds.has(options.requestedSlideId)
          ? options.requestedSlideId
          : null;
        const runtimeActiveId = slideIds.has(options.runtimeActiveSlideId)
          ? options.runtimeActiveSlideId
          : null;
        const currentActiveId = slideIds.has(options.currentActiveId)
          ? options.currentActiveId
          : null;
        return requestedId || runtimeActiveId || currentActiveId || slides[0]?.id || null;
      }

      function describeSlideRegistryState(slideId, options = {}) {
        const isRequested =
          Boolean(options.requestedId) && slideId === options.requestedId;
        const isActive = Boolean(options.activeId) && slideId === options.activeId;
        const isRuntimeActive =
          Boolean(options.runtimeActiveId) && slideId === options.runtimeActiveId;
        if (isRequested && (!isRuntimeActive || !isActive)) {
          return { key: "requested", label: "requested" };
        }
        if (isActive && isRuntimeActive) {
          return { key: "active", label: "active" };
        }
        if (isRuntimeActive && !isActive) {
          return { key: "preview", label: "preview" };
        }
        if (isActive) {
          return { key: "active", label: "active" };
        }
        return { key: "ready", label: "ready" };
      }

      // =====================================================================
      // Trust-Banner + neutralize-scripts (WO-07, ADR-014 §Layer 1, AUDIT-D-01)
      //
      // maybeShowTrustBanner()  — called after iframe onload; shows banner if
      //   findings > 0 AND trustDecision is still PENDING.
      // acceptTrustDecision()   — "Оставить как есть"; persists ACCEPT so the
      //   banner never re-fires for this session-import.
      // neutralizeAndReload()   — "Нейтрализовать скрипты"; strips all detected
      //   patterns from a fresh re-parse of lastImportedRawHtml and rebuilds
      //   the preview in SCRIPTS_ONLY sandbox mode.
      //
      // Security invariants:
      //   - Scan-only by default (never strips without user consent).
      //   - NEUTRALIZE preserves style, class, id, data-* attributes.
      //   - Only strips: <script>, <object>, <embed>, on* attrs, javascript: hrefs,
      //     <meta http-equiv="refresh">, remote <iframe src="http(s)://">.
      //   - lastImportedRawHtml re-parsed fresh; annotated modelDoc not used.
      //   - No external network calls added.
      //
      // OWASP A03:2021 Injection — CWE-79, CWE-1021, AUDIT-D-01.
      // =====================================================================

      function maybeShowTrustBanner() {
        if (!window.shellBoundary) return;
        var signals = state.trustSignals;
        if (!signals || signals.totalFindings === 0) return;
        // If user already made a decision for this import, don't re-show.
        if (state.trustDecision !== TRUST_DECISION_KEYS.PENDING) return;
        var count = signals.totalFindings;
        // Russian UI copy — verbatim per spec.
        var message = 'Презентация содержит исполняемый код (' + count + ' элементов). Скрипты будут запущены.';
        window.shellBoundary.report(
          TRUST_BANNER_CODE,
          message,
          [
            { label: 'Нейтрализовать скрипты', action: 'trust-neutralize' },
            { label: 'Оставить как есть',       action: 'trust-accept'     },
          ]
        );
      }

      function acceptTrustDecision() {
        // User chose "Оставить как есть" — scripts remain, banner dismissed.
        // Persist decision so banner does not re-fire on subsequent reloads
        // within the same session import.
        state.trustDecision = TRUST_DECISION_KEYS.ACCEPT;
        if (window.shellBoundary) window.shellBoundary.clear(TRUST_BANNER_CODE);
        addDiagnostic('[trust] User accepted executable code in deck (scripts not neutralized).');
      }

      // neutralizeAndReload — strips executable patterns from a fresh re-parse
      // of lastImportedRawHtml and rebuilds preview in SCRIPTS_ONLY sandbox mode.
      //
      // Patterns stripped:
      //   <script>     — removed entirely (innerText content discarded)
      //   <object>     — removed entirely
      //   <embed>      — removed entirely
      //   <meta http-equiv="refresh"> — removed
      //   <iframe src="http://">, <iframe src="https://"> — src cleared, removed
      //   on* attributes — removed from every element
      //   <a href="javascript:"> / <a href="vbscript:"> — href cleared
      //
      // Preserved: style, class, id, data-* and all other non-executable attributes.
      function neutralizeAndReload() {
        var rawHtml = state.lastImportedRawHtml;
        if (typeof rawHtml !== 'string' || !rawHtml) {
          showToast('Исходный HTML недоступен для нейтрализации.', 'error', {
            title: 'Режим доверия',
          });
          return;
        }
        // Re-parse from raw source so we strip the original, not the annotated copy.
        var parser = new DOMParser();
        var doc = parser.parseFromString(rawHtml, 'text/html');
        // Remove <script>, <object>, <embed> entirely.
        doc.querySelectorAll('script, object, embed').forEach(function (el) {
          if (el.parentNode) el.parentNode.removeChild(el);
        });
        // Remove <meta http-equiv="refresh">.
        doc.querySelectorAll('meta[http-equiv]').forEach(function (el) {
          var equiv = (el.getAttribute('http-equiv') || '').toLowerCase().trim();
          if (equiv === 'refresh' && el.parentNode) el.parentNode.removeChild(el);
        });
        // Remove remote iframes (keep local iframes intact).
        doc.querySelectorAll('iframe[src]').forEach(function (el) {
          var src = (el.getAttribute('src') || '').trim();
          if (/^https?:\/\//i.test(src) && el.parentNode) {
            el.parentNode.removeChild(el);
          }
        });
        // Strip on* event handler attributes from every element.
        // Preserve style, class, id, data-* and all other safe attributes.
        var ON_ATTR_RE = /^on/i;
        doc.querySelectorAll('*').forEach(function (el) {
          // Collect attribute names first (live NamedNodeMap mutates on removal).
          var toRemove = [];
          for (var i = 0; i < el.attributes.length; i++) {
            var name = el.attributes[i].name;
            if (ON_ATTR_RE.test(name)) toRemove.push(name);
          }
          toRemove.forEach(function (name) { el.removeAttribute(name); });
          // Clear javascript: / vbscript: hrefs.
          if (el.tagName === 'A') {
            var href = (el.getAttribute('href') || '').trim().toLowerCase();
            if (href.startsWith('javascript:') || href.startsWith('vbscript:')) {
              el.removeAttribute('href');
            }
          }
        });
        // Serialize the sanitized document back to HTML.
        var sanitizedHtml = doc.documentElement.outerHTML;
        // Prefix with doctype so the preview renders correctly.
        var dt = state.doctypeString || '<!DOCTYPE html>';
        if (!sanitizedHtml.toLowerCase().startsWith('<!doctype')) {
          sanitizedHtml = dt + '\n' + sanitizedHtml;
        }
        // Switch sandbox mode to SCRIPTS_ONLY before reload so the iframe
        // attribute is applied by loadHtmlString's sandbox-mode switch block.
        state.sandboxMode = SANDBOX_MODES.SCRIPTS_ONLY;
        // Mark decision BEFORE loadHtmlString so resetRuntimeState does not
        // overwrite it (resetRuntimeState resets to PENDING then we restore below).
        // After loadHtmlString completes, forcibly set the decision to NEUTRALIZE.
        var sourceLabel = state.sourceLabel || 'Нейтрализованный документ';
        var loaded = loadHtmlString(sanitizedHtml, sourceLabel, {
          mode: state.mode,
          manualBaseUrl: state.manualBaseUrl,
          resetHistory: false,
          // [v1.2.0] Neutralized reload retains the original document's
          // classification — skip the report modal for a seamless flip.
          bypassReport: true,
        });
        if (loaded) {
          // loadHtmlString → resetRuntimeState resets trustDecision to PENDING.
          // Override it immediately to NEUTRALIZE so maybeShowTrustBanner() will
          // skip re-showing the banner for this (now-clean) document.
          state.trustDecision = TRUST_DECISION_KEYS.NEUTRALIZE;
          // Toast with Russian UI copy per spec.
          showToast(
            'Скрипты нейтрализованы. Превью пересобрано в режиме sandbox.',
            'success',
            { title: 'Режим доверия', ttl: 4000 }
          );
          addDiagnostic('[trust] Scripts neutralized; preview rebuilt in sandbox mode.');
        }
      }

      // Wire shellBannerAction events for trust-banner action buttons (WO-07).
      // This listener is idempotent — registered once at module-parse time.
      window.addEventListener('shellBannerAction', function (evt) {
        if (!evt || !evt.detail) return;
        var action = evt.detail.action;
        if (action === 'trust-neutralize') {
          neutralizeAndReload();
        } else if (action === 'trust-accept') {
          acceptTrustDecision();
        }
      });

      // =====================================================================
