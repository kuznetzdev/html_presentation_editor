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

      function buildModelDocument(htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, "text/html");
        runUnifiedImportPipeline(doc);
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
