// state.js
// Layer: Data & Constants
// SelectionPolicy factory, PreviewLifecycle helpers, and the app state singleton.

      // ZONE: Selection Policy
      // createDefaultSelectionPolicy, normalizeSelectionPolicy — entity edit-permission models
      // =====================================================================

      /**
       * Flags describing the nature of a selected DOM node.
       * @typedef {Object} SelectionFlags
       * @property {boolean} [canEditText]
       * @property {boolean} [isImage]
       * @property {boolean} [isVideo]
       * @property {boolean} [isContainer]
       * @property {boolean} [isSlideRoot]
       * @property {boolean} [isProtected]
       * @property {boolean} [isTable]
       * @property {boolean} [isCodeBlock]
       * @property {boolean} [isSvg]
       * @property {boolean} [isFragment]
       * @property {boolean} [isTextEditing]
       */

      /**
       * Policy object controlling which edit operations are permitted on the selected element.
       * @typedef {Object} SelectionPolicy
       * @property {string} kind - Policy kind identifier (e.g. 'free', 'slide-root', 'critical-structure')
       * @property {string} reason - Human-readable reason displayed in the lock banner
       * @property {boolean} canEditText
       * @property {boolean} canEditStyles
       * @property {boolean} canEditAttributes
       * @property {boolean} canEditHtml
       * @property {boolean} canEditSlideHtml
       * @property {boolean} canMove
       * @property {boolean} canResize
       * @property {boolean} canNudge
       * @property {boolean} canReorder
       * @property {boolean} canDelete
       * @property {boolean} canDuplicate
       * @property {boolean} canWrap
       * @property {boolean} canAddChild
       * @property {boolean} canReplaceMedia
       */

      // =====================================================================
      // ZONE: Selection Policy Table (P2-07 — WO-17 refactor)
      // Table-lookup replaces 6-branch if-chain. Priority order is preserved:
      // isSlideRoot > isProtected > isTable > isCodeBlock > isSvg > isFragment.
      // Output shape is byte-identical to the previous if-chain for every flag combo.
      // =====================================================================

      /**
       * Priority-ordered policy table entry.
       * Each entry: { flag, kind, reason, overrides }
       * where overrides are applied on top of the base 'free' policy.
       */
      var SELECTION_POLICY_TABLE = [
        {
          flag: "isSlideRoot",
          kind: "slide-root",
          reason: "Корневой контейнер слайда редактируется только в безопасном режиме.",
          overrides: {
            canEditText: false,
            canEditAttributes: false,
            canEditHtml: false,
            canEditSlideHtml: true,
            canMove: false,
            canResize: false,
            canNudge: false,
            canReorder: false,
            canDelete: false,
            canDuplicate: false,
            canWrap: false,
            canAddChild: true,
            canReplaceMedia: false,
          },
        },
        {
          flag: "isProtected",
          kind: "critical-structure",
          reason: "Системный контейнер deck защищён от прямого редактирования и structural-операций.",
          overrides: {
            canEditText: false,
            canEditStyles: false,
            canEditAttributes: false,
            canEditHtml: false,
            canEditSlideHtml: false,
            canMove: false,
            canResize: false,
            canNudge: false,
            canReorder: false,
            canDelete: false,
            canDuplicate: false,
            canWrap: false,
            canAddChild: false,
            canReplaceMedia: false,
          },
        },
        {
          flag: "isTable",
          kind: "structured-table",
          reason: "Таблица импортирована как структурированный DOM-блок: безопаснее редактировать ячейки, а не сырой HTML.",
          overrides: {
            canEditText: false,
            canEditAttributes: false,
            canEditHtml: false,
            canDelete: false,
            canWrap: false,
            canAddChild: false,
            canReplaceMedia: false,
          },
        },
        {
          flag: "isCodeBlock",
          kind: "plain-text-block",
          reason: "Code block сохраняет пробелы и переносы строк. Избегайте raw HTML replacement.",
          overrides: {
            canEditAttributes: false,
            canEditHtml: false,
            canAddChild: false,
            canReplaceMedia: false,
          },
        },
        {
          flag: "isSvg",
          kind: "svg-object",
          reason: "Inline SVG импортирован как object-level блок. Внутреннюю векторную структуру нужно сохранять.",
          overrides: {
            canEditText: false,
            canEditAttributes: false,
            canEditHtml: false,
            canDelete: false,
            canWrap: false,
            canAddChild: false,
            canReplaceMedia: false,
          },
        },
        {
          flag: "isFragment",
          kind: "stateful-wrapper",
          reason: "Stateful wrapper сохраняет fragment/state classes и data-* атрибуты.",
          overrides: {
            canEditAttributes: false,
            canEditHtml: false,
            canWrap: false,
            canAddChild: false,
            canReplaceMedia: false,
          },
        },
      ];

      /**
       * @param {SelectionFlags} [flags]
       * @returns {SelectionPolicy}
       */
      function createDefaultSelectionPolicy(flags = {}) {
        // Base 'free' policy — built from flags that affect the default shape.
        const policy = {
          kind: "free",
          reason: "",
          canEditText: Boolean(flags.canEditText),
          canEditStyles: true,
          canEditAttributes: true,
          canEditHtml: true,
          canEditSlideHtml: false,
          canMove: true,
          canResize: true,
          canNudge: true,
          canReorder: true,
          canDelete: true,
          canDuplicate: true,
          canWrap: true,
          canAddChild: Boolean(flags.isContainer),
          canReplaceMedia: Boolean(flags.isImage || flags.isVideo),
        };

        // Priority-order table lookup: first matching flag wins.
        for (var i = 0; i < SELECTION_POLICY_TABLE.length; i++) {
          var entry = SELECTION_POLICY_TABLE[i];
          if (flags[entry.flag]) {
            return {
              ...policy,
              kind: entry.kind,
              reason: entry.reason,
              ...entry.overrides,
            };
          }
        }

        return policy;
      }

      /**
       * @param {Partial<SelectionPolicy>} [policy]
       * @param {SelectionFlags} [flags]
       * @returns {SelectionPolicy}
       */
      function normalizeSelectionPolicy(policy = {}, flags = {}) {
        const base = createDefaultSelectionPolicy(flags);
        return {
          ...base,
          ...(policy || {}),
          kind: String((policy && policy.kind) || base.kind || "free"),
          reason: String((policy && policy.reason) || base.reason || ""),
        };
      }

      // =====================================================================
      // ZONE: Preview Lifecycle
      // getPreviewLifecycleMeta, setPreviewLifecycleState — iframe preview state machine
      // =====================================================================
      function getPreviewLifecycleMeta(
        lifecycle = state?.previewLifecycle || "idle",
      ) {
        switch (lifecycle) {
          case "loading":
            return {
              label: "Загрузка",
              className: "status-pill is-accent",
              title: "Iframe загружается и bridge ещё инициализируется.",
              buttonLabel: "↻ Превью",
              buttonTitle: "Пересоздать iframe и bridge вручную",
              previewCopy:
                "Превью ещё загружается. Дождись готовности или пересоздай iframe через «↻ Превью».",
              editCopy:
                "Превью ещё не готово. Пока загрузка не закончится, выбор, вставка и direct manipulation ограничены.",
            };
          case "recovering":
            return {
              label: "Сборка",
              className: "status-pill is-accent",
              title: "Shell пересоздаёт iframe и заново поднимает bridge.",
              buttonLabel: "↻ Восстановить",
              buttonTitle: "Пересоздать iframe и bridge ещё раз",
              previewCopy:
                "Превью восстанавливается. Если состояние не вернулось, нажми «↻ Восстановить» ещё раз.",
              editCopy:
                "Bridge и iframe пересоздаются из modelDoc. После готовности можно продолжать редактирование без потери shell-состояния.",
            };
          case "bridge-degraded":
            return {
              label: "Без связи",
              className: "status-pill is-warning",
              title: "Heartbeat от iframe не приходит вовремя.",
              buttonLabel: "↻ Восстановить",
              buttonTitle: "Пересоздать iframe и восстановить bridge",
              previewCopy:
                "Связь с iframe потеряна. Используй «↻ Восстановить», чтобы пересоздать превью и вернуть правдивый холст.",
              editCopy:
                "Связь с iframe потеряна. Пока bridge не восстановлен, direct manipulation и точечные правки лучше не продолжать.",
            };
          case "desync-suspected":
            return {
              label: "Проверка",
              className: "status-pill is-warning",
              title: "Shell зафиксировал подозрение на рассинхрон между modelDoc и live DOM.",
              buttonLabel: "↻ Восстановить",
              buttonTitle: "Пересоздать iframe из modelDoc и восстановить синхронность",
              previewCopy:
                "Есть риск рассинхрона между modelDoc и живым DOM. Нажми «↻ Восстановить», чтобы заново собрать превью из канонической модели.",
              editCopy:
                "Shell подозревает рассинхрон между modelDoc и live DOM. «↻ Восстановить» пересоздаст iframe из актуальной модели.",
            };
          case "ready":
            return {
              label: "Готово",
              className: "status-pill is-ok",
              title: "Iframe и bridge синхронизированы и готовы к работе.",
              buttonLabel: "↻ Превью",
              buttonTitle: "Пересоздать iframe и заново подключить bridge",
              previewCopy: "",
              editCopy: "",
            };
          default:
            return {
              label: "Пусто",
              className: "status-pill",
              title: "HTML ещё не загружен.",
              buttonLabel: "↻ Превью",
              buttonTitle: "Кнопка станет активной после загрузки документа",
              previewCopy: "",
              editCopy: "",
            };
        }
      }

      /**
       * @param {string} nextLifecycle
       * @param {{ reason?: string }} [options]
       * @returns {void}
       */
      function setPreviewLifecycleState(nextLifecycle, options = {}) {
        if (!nextLifecycle) return;
        state.previewLifecycle = nextLifecycle;
        state.previewLifecycleReason = String(options.reason || "");
        state.previewLifecycleChangedAt = Date.now();
      }

      // =====================================================================
      // ZONE: Application State
      // Single source of truth for all shell state: model, UI, history, selection
      // =====================================================================
      // state — единый источник состояния shell-редактора. Внутри iframe живёт
      // только runtime-состояние bridge, а здесь — модель документа, UI и история.
      // ====================================================================
      // state — единый источник состояния shell-приложения.
      // Здесь хранится модель документа, активный слайд, выбранный элемент,
      // история, автосохранение, runtime-состояние превью и UI-панелей.
      // ====================================================================

      /**
       * Drag state for the slide rail reorder interaction.
       * @typedef {Object} SlideRailDrag
       * @property {string|null} slideId - ID of the slide being dragged
       * @property {number} hoverIndex - Current hover position index (-1 = none)
       * @property {number} suppressClickUntil - Timestamp until which click events are suppressed
       */

      /**
       * State of the layers panel drag-and-drop reorder.
       * @typedef {Object} LayersPanelDragState
       * @property {string|null} draggedNodeId
       * @property {number} draggedIndex
       * @property {number} dropTargetIndex
       */

      /**
       * Toast notification display state.
       * @typedef {Object} SelectionTooltip
       * @property {string} message
       * @property {number} visibleUntil
       * @property {number} hideTimer
       */

      /**
       * Snapped geometry rectangle for the selection overlay.
       * @typedef {Object} SelectionRect
       * @property {number} left
       * @property {number} top
       * @property {number} width
       * @property {number} height
       */

      /**
       * Active guides shown during drag / resize.
       * @typedef {Object} ActiveGuides
       * @property {number[]} vertical
       * @property {number[]} horizontal
       */

      /**
       * Per-asset audit counts populated by the preview asset resolver.
       * @typedef {Object} PreviewAssetAuditCounts
       * @property {number} resolved
       * @property {number} unresolved
       * @property {number} baseUrlDependent
       */

      /**
       * Toolbar drag offset.
       * @typedef {Object} ToolbarDragOffset
       * @property {number} x
       * @property {number} y
       */

      /**
       * Canonical application state for the shell editor.
       * All shell state is stored here; iframe runtime state lives only in bridge.
       *
       * @typedef {Object} State
       *
       * — Document model
       * @property {string} sourceLabel - File name / label of the loaded document
       * @property {string} sourceHtml - Original HTML source string as loaded
       * @property {string} doctypeString - DOCTYPE declaration (default '<!DOCTYPE html>')
       * @property {Document|null} modelDoc - Parsed DOM document model (canonical source of truth)
       * @property {string|null} previewUrl - Object URL for the current preview blob
       * @property {string} bridgeToken - Shared secret token for bridge postMessage authentication
       * @property {string} manualBaseUrl - User-overridden base URL for asset resolution
       * @property {boolean} dirty - Whether unsaved changes exist
       *
       * — Mode & workflow
       * @property {string} mode - UI mode: 'preview' | 'edit'
       * @property {string} editorWorkflow - Workflow state: 'empty' | 'loaded' | ...
       * @property {string} interactionMode - Active interaction: 'preview' | 'select' | 'text-edit' | 'drag' | 'resize' | 'insert'
       * @property {string} engine - Detected deck engine ('reveal' | 'shower' | 'unknown' | ...)
       *
       * — Preview lifecycle
       * @property {boolean} previewReady - Whether the iframe bridge is ready
       * @property {string} previewLifecycle - Lifecycle state: 'idle' | 'loading' | 'ready' | 'recovering' | 'bridge-degraded' | 'desync-suspected'
       * @property {string} previewLifecycleReason - Reason for the last lifecycle transition
       * @property {number} previewLifecycleChangedAt - Timestamp of the last lifecycle transition
       * @property {string|null} staticSlideSelector - CSS selector matched for slides in static mode
       *
       * — Slides registry
       * @property {any[]} slides - Slide descriptor array from modelDoc parse
       * @property {any[]} runtimeSlides - Live slide descriptors from bridge runtime-metadata
       * @property {Object.<string, any>} slideRegistryById - Slide descriptors keyed by slide ID
       * @property {string[]} slideRegistryOrder - Ordered array of slide IDs
       * @property {string|null} activeSlideId - Currently active slide ID in modelDoc
       * @property {string|null} pendingActiveSlideId - Slide ID waiting for iframe activation
       * @property {string|null} runtimeActiveSlideId - Active slide ID reported by iframe
       * @property {string|null} requestedSlideActivation - Slide ID of the pending activation request
       * @property {number} requestedSlideActivationSeq - Sequence number of the pending activation
       *
       * — Selection
       * @property {string|null} pendingPreviewSelection - Node ID queued for selection after bridge-ready
       * @property {string|null} selectedNodeId - Currently selected node ID
       * @property {string|null} selectionLeafNodeId - Leaf node of the current selection path
       * @property {string[]} selectionPath - DOM path from root to selected node
       * @property {string|null} selectedTag - HTML tag name of the selected element
       * @property {any} selectedComputed - Computed style object for the selected element
       * @property {string} selectedHtml - Outer HTML of the selected element
       * @property {SelectionRect|null} selectedRect - Bounding rect of the selected element in iframe coordinates
       * @property {Object.<string, string>} selectedAttrs - Attribute map of the selected element
       * @property {string} selectedEntityKind - Entity kind of the selected element (from IMPORT_ENTITY_KINDS)
       * @property {SelectionFlags} selectedFlags - Feature flags for the selected element
       * @property {SelectionPolicy} selectedPolicy - Edit-permission policy for the selected element
       * @property {any} manipulationContext - Active direct-manipulation context (drag/resize payload)
       * @property {boolean} rightPanelUserOpen - Whether the right panel was explicitly opened by the user
       * @property {SelectionRect|null} liveSelectionRect - Live rect updated during manipulation
       * @property {any} activeManipulation - Active manipulation descriptor
       * @property {boolean} pendingOverlayClickProxy - Whether a click-proxy is pending
       * @property {ActiveGuides} activeGuides - Active snap-guide lines
       *
       * — Overlap & warnings
       * @property {number} overlapDetectionTimer - Timer ID for periodic overlap detection
       * @property {Object.<string, any>} slideOverlapWarnings - Overlap warning descriptors keyed by slide ID
       * @property {Object.<string, any>} overlapConflictsBySlide - Conflict groups keyed by slide ID
       * @property {any} selectedOverlapWarning - Currently highlighted overlap warning
       * @property {string|null} overlapHoverNodeId - Node ID currently hovered in overlap panel
       * @property {Document|null} overlapHoverBoundDoc - Bound document for the hover node
       *
       * — Visibility & layers
       * @property {Object.<string, boolean>} sessionVisibilityMap - Visibility overrides keyed by node ID
       * @property {any} layerPickerPayload - Payload for the layer picker popup
       * @property {string|null} layerPickerHighlightNodeId - Node ID highlighted in layer picker
       * @property {number} layerPickerActiveIndex - Active index in the layer picker list
       * @property {string[]} multiSelectNodeIds - Node IDs in the current multi-selection
       * @property {LayersPanelDragState} layersPanelDragState - Drag state for the layers panel
       *
       * — UI panels & tooltips
       * @property {SelectionTooltip} selectionTooltip - Tooltip for the selection frame
       * @property {boolean} altSelectionPassthrough - Whether alt-click passes through to native selection
       * @property {string[]} diagnostics - Array of diagnostic log entries
       * @property {string|null} htmlEditorMode - Current HTML editor mode ('element' | 'slide' | null)
       * @property {string|null} htmlEditorTargetId - Node ID targeted by the HTML editor
       * @property {string|null} htmlEditorTargetType - Type of the HTML editor target
       *
       * — Bridge & sync
       * @property {number} lastRuntimeMetadataAt - Timestamp of last runtime-metadata message
       * @property {boolean} bridgeAlive - Whether a bridge heartbeat was received recently
       * @property {boolean} editingSupported - Whether the iframe reports editing is supported
       * @property {number} [bridgeProtocolVersion] - Negotiated bridge protocol version (set after hello)
       * @property {string} [bridgeBuild] - Bridge build label received in hello payload
       * @property {number} commandSeq - Monotonically increasing command sequence counter
       * @property {number} lastAppliedSeq - Sequence of the last applied mutation
       * @property {Object.<string, number>} lastAppliedSeqBySlide - Last applied seq keyed by slide ID
       * @property {Object.<string, boolean>} slideSyncLocks - Active sync-lock flags keyed by slide ID
       *
       * — History
       * @property {any[]} history - Undo/redo history stack
       * @property {number} historyIndex - Current position in the history stack (-1 = empty)
       * @property {boolean} historyMuted - Whether history recording is suspended
       *
       * — Autosave & timers
       * @property {number|null} saveTimer - setTimeout ID for the pending autosave
       * @property {number|null} snapshotTimer - setTimeout ID for the pending snapshot
       * @property {number} lastSavedAt - Timestamp of the last successful autosave
       *
       * — Insert & clipboard
       * @property {string|null} pendingReplaceTargetId - Node ID targeted for media replacement
       * @property {string} pendingImageInsertMode - Insert mode: 'insert' | 'replace'
       * @property {string} pendingInsertPosition - Insert position: 'before' | 'after' | 'inside'
       * @property {any} copiedStyle - Copied inline-style object for paste-style
       * @property {string|null} copiedElementHtml - Clipboard HTML for Ctrl+C / Ctrl+V
       *
       * — Context menu
       * @property {string|null} contextMenuNodeId - Node ID at which the context menu was opened
       * @property {any} contextMenuPayload - Payload from the bridge context-menu message
       *
       * — Slide rail
       * @property {SlideRailDrag} slideRailDrag - Drag state for slide rail reorder
       * @property {any} restorePayload - Draft restore payload from autosave
       *
       * — Theme & UI preferences
       * @property {string} theme - Active theme: 'light' | 'dark'
       * @property {string} themePreference - User preference: 'system' | 'light' | 'dark'
       * @property {string} complexityMode - UI complexity: 'basic' | 'advanced'
       * @property {string} selectionMode - Selection mode: 'smart' | 'container'
       * @property {number} previewZoom - Preview scale factor (1.0 = 100%)
       * @property {Object.<string, boolean>} inspectorSections - Open/closed state of inspector sections
       *
       * — Toolbar
       * @property {boolean} toolbarPinned - Whether the floating toolbar is pinned
       * @property {any} toolbarPos - Toolbar position {x, y} or null
       * @property {boolean} toolbarCollapsed - Whether the toolbar is collapsed
       * @property {ToolbarDragOffset} toolbarDragOffset - Offset during toolbar drag
       * @property {boolean} toolbarDragActive - Whether toolbar drag is in progress
       *
       * — Loading & bridge watchdog
       * @property {boolean} loadingPreview - Whether the preview iframe is loading
       * @property {number|ReturnType<typeof setInterval>|null} bridgeWatchdogTimer - Interval ID for bridge watchdog
       * @property {number|ReturnType<typeof setInterval>|null} modelSyncTimer - Interval ID for model sync
       * @property {number} lastBridgeHeartbeatAt - Timestamp of last bridge heartbeat
       *
       * — Toasts
       * @property {number} activeToastId - ID of the most recently shown toast
       *
       * — Asset resolver
       * @property {Map<string,string>|null} assetResolverMap - Resolved asset URL map
       * @property {string} assetResolverLabel - Label for the resolved asset directory
       * @property {string[]} assetObjectUrls - Object URLs created for resolved assets
       * @property {number} assetFileCount - Number of files in the resolved asset directory
       * @property {any[]} resolvedPreviewAssets - Assets successfully resolved for preview
       * @property {any[]} unresolvedPreviewAssets - Assets that could not be resolved
       * @property {any[]} baseUrlDependentAssets - Assets requiring a base URL
       * @property {PreviewAssetAuditCounts} previewAssetAuditCounts - Asset resolution counts
       *
       * — Export validation
       * @property {any} lastExportValidationAudit - Most recent export validation audit result
       * @property {string|null} lastExportValidationUrl - Object URL for the export validation page
       * @property {number|null} slideActivationRetryTimer - setTimeout ID for slide activation retry
       *
       * — Top-bar & shell chrome
       * @property {boolean} slideTemplateBarOpen - Whether the slide template bar is open
       * @property {boolean} topbarOverflowOpen - Whether the topbar overflow menu is open
       * @property {string} topbarCommandMode - Topbar command layout: 'inline' | 'overflow'
       * @property {number} shellMetricsRaf - requestAnimationFrame ID for shell metrics
       * @property {number} shellPopoverRaf - requestAnimationFrame ID for popover positioning
       * @property {MutationObserver|null} shellChromeObserver - Observer for shell chrome mutations
       * @property {boolean} leftPanelOpen - Whether the left (slides) panel is open on mobile
       * @property {boolean} rightPanelOpen - Whether the right (inspector) panel is open on mobile
       *
       * — Click-through & sandbox (WO-06, WO-07)
       * @property {any} clickThroughState - Stack depth / click-through state synced from bridge
       * @property {string} sandboxMode - Sandbox mode: 'off' | 'scripts-only' | 'full'
       * @property {string} trustDecision - Trust decision: 'pending' | 'neutralize' | 'accept'
       * @property {any} trustSignals - Result of scanTrustSignals(doc); null until first import
       * @property {string|null} lastImportedRawHtml - Verbatim HTML string passed to buildModelDocument
       */

      // =====================================================================
      // ZONE: Observable Store — ui slice registration (ADR-013 WO-16)
      // store.js MUST be loaded before state.js (see presentation-editor.html).
      // =====================================================================

      // Guard: store.js must be loaded and window.store.defineSlice must be callable
      if (typeof window.store === "undefined" || typeof window.store.defineSlice !== "function") {
        throw new Error(
          "store.js must be loaded before state.js. " +
          "Ensure <script src=\"src/store.js\"> appears before <script src=\"src/state.js\"> in the HTML shell."
        );
      }

      // Register the 'ui' slice BEFORE declaring the state literal.
      // Migrated fields: complexityMode, previewZoom, theme, themePreference.
      // All other state fields remain on the state object during this transitional phase.
      window.store.defineSlice("ui", {
        complexityMode: "basic",
        previewZoom: 1.0,
        theme: "light",
        themePreference: "system",
        activeBanners: [],
      });

      // Register the 'history' slice — WO-18 (ADR-013 phase 3).
      // Migrated fields: index, limit, baseline, patches, dirty, lastSavedAt.
      // Proxy shim: history/historyIndex/dirty/lastSavedAt keys forwarded to this slice.
      window.store.defineSlice("history", {
        index: -1,
        limit: 20,
        baseline: null,
        patches: [],
        dirty: false,
        lastSavedAt: 0,
      });

      // Register the 'selection' slice — WO-17 (ADR-013 phase 2).
      // Migrated fields: all 16 selection fields from window.state.
      // Dual-write: state raw fields + store slice kept in sync by applyElementSelection.
      window.store.defineSlice("selection", {
        activeNodeId: null,
        activeSlideId: null,
        selectionPath: [],
        leafNodeId: null,
        tag: null,
        computed: null,
        html: "",
        rect: null,
        attrs: {},
        entityKind: "none",
        flags: {
          canEditText: false,
          isImage: false,
          isVideo: false,
          isContainer: false,
          isSlideRoot: false,
          isProtected: false,
          isTextEditing: false,
        },
        policy: createDefaultSelectionPolicy(),
        liveRect: null,
        manipulationContext: null,
        clickThroughState: null,
        runtimeActiveSlideId: null,
        overlapIndex: 0,
      });

      /** @type {State} */
      const state = {
        sourceLabel: "",
        sourceHtml: "",
        doctypeString: "<!DOCTYPE html>",
        modelDoc: null,
        previewUrl: null,
        bridgeToken: "",
        manualBaseUrl: "",
        dirty: false,
        mode: "preview",
        editorWorkflow: "empty",
        interactionMode: "preview",
        engine: "unknown",
        previewReady: false,
        previewLifecycle: "idle",
        previewLifecycleReason: "",
        previewLifecycleChangedAt: 0,
        staticSlideSelector: null,
        slides: [],
        runtimeSlides: [],
        slideRegistryById: {},
        slideRegistryOrder: [],
        activeSlideId: null,
        pendingActiveSlideId: null,
        runtimeActiveSlideId: null,
        requestedSlideActivation: null,
        requestedSlideActivationSeq: 0,
        pendingPreviewSelection: null,
        selectedNodeId: null,
        selectionLeafNodeId: null,
        selectionPath: [],
        selectedTag: null,
        selectedComputed: null,
        selectedHtml: "",
        selectedRect: null,
        selectedAttrs: {},
        selectedEntityKind: "none",
        selectedFlags: {
          canEditText: false,
          isImage: false,
          isVideo: false,
          isContainer: false,
          isSlideRoot: false,
          isProtected: false,
          isTextEditing: false,
        },
        selectedPolicy: createDefaultSelectionPolicy(),
        manipulationContext: null,
        rightPanelUserOpen: false,
        liveSelectionRect: null,
        activeManipulation: null,
        pendingOverlayClickProxy: false,
        activeGuides: { vertical: [], horizontal: [] },
        overlapDetectionTimer: 0,
        slideOverlapWarnings: {},
        overlapConflictsBySlide: {},
        selectedOverlapWarning: null,
        overlapHoverNodeId: null,
        overlapHoverBoundDoc: null,
        sessionVisibilityMap: {},
        layerPickerPayload: null,
        layerPickerHighlightNodeId: null,
        layerPickerActiveIndex: -1,
        // [v0.18.0] Multi-select & grouping
        multiSelectNodeIds: [],
        // [v0.18.0] Layers panel drag state
        layersPanelDragState: {
          draggedNodeId: null,
          draggedIndex: -1,
          dropTargetIndex: -1,
        },
        selectionTooltip: {
          message: "",
          visibleUntil: 0,
          hideTimer: 0,
        },
        altSelectionPassthrough: false,
        diagnostics: [],
        htmlEditorMode: null,
        htmlEditorTargetId: null,
        htmlEditorTargetType: null,
        lastRuntimeMetadataAt: 0,
        bridgeAlive: false,
        editingSupported: false,
        history: [],
        historyIndex: -1,
        historyMuted: false,
        saveTimer: null,
        snapshotTimer: null,
        pendingReplaceTargetId: null,
        pendingImageInsertMode: "insert",
        pendingInsertPosition: "after",
        contextMenuNodeId: null,
        contextMenuPayload: null,
        slideRailDrag: {
          slideId: null,
          hoverIndex: -1,
          suppressClickUntil: 0,
        },
        restorePayload: null,
        copiedStyle: null,
        copiedElementHtml: null,   // internal element clipboard (Ctrl+C / Ctrl+V)
        theme: "light",
        themePreference: "system",
        complexityMode: "basic",
        selectionMode: "smart", // [LAYER-MODEL v2] 'smart' | 'container'
        previewZoom: 1.0, // [v0.18.3] preview scale factor
        inspectorSections: {},
        lastSavedAt: 0,
        commandSeq: 0,
        lastAppliedSeq: 0,
        lastAppliedSeqBySlide: {},
        slideSyncLocks: {},
        toolbarPinned: false,
        toolbarPos: null,
        toolbarCollapsed: false,
        toolbarDragOffset: { x: 0, y: 0 },
        toolbarDragActive: false,
        loadingPreview: false,
        bridgeWatchdogTimer: null,
        modelSyncTimer: null,
        lastBridgeHeartbeatAt: 0,
        activeToastId: 0,
        assetResolverMap: null,
        assetResolverLabel: "",
        assetObjectUrls: [],
        assetFileCount: 0,
        resolvedPreviewAssets: [],
        unresolvedPreviewAssets: [],
        baseUrlDependentAssets: [],
        previewAssetAuditCounts: {
          resolved: 0,
          unresolved: 0,
          baseUrlDependent: 0,
        },
        lastExportValidationAudit: null,
        lastExportValidationUrl: null,
        slideActivationRetryTimer: null,
        slideTemplateBarOpen: false,
        topbarOverflowOpen: false,
        topbarCommandMode: "inline",
        shellMetricsRaf: 0,
        shellPopoverRaf: 0,
        shellChromeObserver: null,
        leftPanelOpen: false,
        rightPanelOpen: false,
        // [v0.25.0] Synced from bridge via element-selected payload; drives stack depth badge
        clickThroughState: null,
        // [WO-06] sandbox mode — one of SANDBOX_MODES values; default OFF
        sandboxMode: DEFAULT_SANDBOX_MODE,
        // [WO-07] Trust-Banner slices (ADR-014 §Layer 1, AUDIT-D-01)
        // trustDecision — PENDING until user explicitly chooses an action.
        //   Reset to PENDING on every fresh import (loadHtmlString → resetRuntimeState).
        trustDecision: 'pending',
        // trustSignals — result of scanTrustSignals(doc) after buildModelDocument.
        //   Null until the first import of a document. Cleared on fresh import.
        trustSignals: null,
        // lastImportedRawHtml — verbatim htmlString passed to buildModelDocument.
        //   Preserved so neutralizeAndReload() can re-parse from the original source
        //   rather than from the (already-annotated) modelDoc serialization.
        lastImportedRawHtml: null,
        // [WO-13] bridgeAcks — Map<refSeq, AckPayload> of received structured acks.
        // Keyed by the originating command sequence number (ADR-012 §5).
        // Shell collects acks here; entries expire on next import/reload.
        /** @type {Map<number, {refSeq:number, ok:boolean, error?: {code:string, message:string}, stale?: boolean}>} */
        bridgeAcks: new Map(),
        // [WO-36] Timestamp (ms) of the last container-mode-ack received from the iframe.
        // Reset to 0 when a new set-selection-mode command is dispatched so tests can
        // re-arm the wait after each mode change.
        __containerModeAckAt: 0,
      };

      // =====================================================================
      // ZONE: window.state Proxy shim (ADR-013 WO-16)
      //
      // Keeps all existing consumers working unchanged while the 4 migrated
      // fields (complexityMode, previewZoom, theme, themePreference) are now
      // owned by the store 'ui' slice.
      //
      // READ:  state.theme → reads from store.get('ui').theme
      // WRITE: state.theme = 'dark' → writes via store.update('ui', { theme: 'dark' })
      //        (also updates the local state literal so any destructured refs still see it)
      //
      // Non-migrated keys pass through to the underlying state literal as before.
      // =====================================================================

      /** @type {Set<string>} */
      var _UI_SLICE_KEYS = new Set(["complexityMode", "previewZoom", "theme", "themePreference"]);

      // History fields mapped from legacy state key → store 'history' slice key.
      // READ:  state.historyIndex → store.get('history').index
      // WRITE: state.historyIndex = 5 → store.update('history', {index: 5})
      //         + also updates raw state for backward compat.
      // NOTE: captureHistorySnapshot in history.js performs batched store.update('history')
      //       for full patch commits — that is the canonical write path.
      /** @type {Object.<string, string>} */
      var _HISTORY_STATE_TO_SLICE = {
        historyIndex:  "index",
        dirty:         "dirty",
        lastSavedAt:   "lastSavedAt",
      };
      /** @type {Set<string>} */
      var _HISTORY_STATE_KEYS = new Set(Object.keys(_HISTORY_STATE_TO_SLICE));

      // Selection fields mapped from legacy state key → store 'selection' slice key.
      // READ:  state.selectedNodeId      → store.get('selection').activeNodeId
      // WRITE: state.selectedNodeId = x  → store.update('selection', {activeNodeId: x})
      //         + also updates raw state for backward compat (other modules read raw state).
      // NOTE: applyElementSelection in bridge-commands.js performs dual-write
      //       (raw state + store.update) for the full selection batch — that is the
      //       canonical write path. The Proxy setter here catches isolated single-field
      //       writes from other code paths.
      /** @type {Object.<string, string>} */
      var _SELECTION_STATE_TO_SLICE = {
        selectedNodeId:       "activeNodeId",
        activeSlideId:        "activeSlideId",
        selectionPath:        "selectionPath",
        selectionLeafNodeId:  "leafNodeId",
        selectedTag:          "tag",
        selectedComputed:     "computed",
        selectedHtml:         "html",
        selectedRect:         "rect",
        selectedAttrs:        "attrs",
        selectedEntityKind:   "entityKind",
        selectedFlags:        "flags",
        selectedPolicy:       "policy",
        liveSelectionRect:    "liveRect",
        manipulationContext:  "manipulationContext",
        clickThroughState:    "clickThroughState",
        runtimeActiveSlideId: "runtimeActiveSlideId",
      };
      /** @type {Set<string>} */
      var _SELECTION_STATE_KEYS = new Set(Object.keys(_SELECTION_STATE_TO_SLICE));

      // Install Proxy if the runtime supports it (ES6+). Falls back to direct
      // state access for very old environments (not expected for this project).
      if (typeof Proxy !== "undefined") {
        var _stateRaw = state;
        var _stateProxy = new Proxy(_stateRaw, {
          get: function (target, prop) {
            if (_UI_SLICE_KEYS.has(String(prop))) {
              return window.store.get("ui")[prop];
            }
            if (_SELECTION_STATE_KEYS.has(String(prop))) {
              var sliceKey = _SELECTION_STATE_TO_SLICE[String(prop)];
              return window.store.get("selection")[sliceKey];
            }
            if (_HISTORY_STATE_KEYS.has(String(prop))) {
              var hSliceKey = _HISTORY_STATE_TO_SLICE[String(prop)];
              return window.store.get("history")[hSliceKey];
            }
            return target[prop];
          },
          set: function (target, prop, value) {
            if (_UI_SLICE_KEYS.has(String(prop))) {
              // Write to store (triggers notification)
              window.store.update("ui", (function () {
                var patch = {};
                patch[prop] = value;
                return patch;
              }()));
              // Also mirror to the raw state so JSON serialisation / spread still works
              target[prop] = value;
              return true;
            }
            if (_SELECTION_STATE_KEYS.has(String(prop))) {
              // Write to selection store slice (triggers notification)
              var sliceKey = _SELECTION_STATE_TO_SLICE[String(prop)];
              window.store.update("selection", (function () {
                var patch = {};
                patch[sliceKey] = value;
                return patch;
              }()));
              // Mirror to raw state for backward compat
              target[prop] = value;
              return true;
            }
            if (_HISTORY_STATE_KEYS.has(String(prop))) {
              // Write to history store slice (triggers notification)
              var hSliceKey = _HISTORY_STATE_TO_SLICE[String(prop)];
              window.store.update("history", (function () {
                var patch = {};
                patch[hSliceKey] = value;
                return patch;
              }()));
              // Mirror to raw state for backward compat
              target[prop] = value;
              return true;
            }
            target[prop] = value;
            return true;
          },
        });
        // Replace the module-level `state` reference so all code in this IIFE
        // transparently uses the proxy. This assignment is in the same scope where
        // `const state` was declared — the var-scoped proxy shadows it for
        // all code that closes over the module-level name after this point.
        // NOTE: We cannot reassign a `const`, so instead we expose the proxy on
        // window so all other modules that access `state` via the shared global
        // continue to work. The local `const state` remains the raw backing store.
        window.stateProxy = _stateProxy;
      }

      // ====================================================================
      // els — кеш DOM-элементов оболочки редактора.
      // Мы собираем ссылки один раз, чтобы не делать document.getElementById
      // по всему коду и держать JS проще для поддержки.
      // ====================================================================
      const els = {
        topbar: document.getElementById("topbar"),
        openHtmlBtn: document.getElementById("openHtmlBtn"),
        showSlideHtmlBtn: document.getElementById("showSlideHtmlBtn"),
        presentBtn: document.getElementById("presentBtn"),
        exportBtn: document.getElementById("exportBtn"),
        exportPptxBtn: document.getElementById("exportPptxBtn"),
        undoBtn: document.getElementById("undoBtn"),
        redoBtn: document.getElementById("redoBtn"),
        previewModeBtn: document.getElementById("previewModeBtn"),
        editModeBtn: document.getElementById("editModeBtn"),
        slidesList: document.getElementById("slidesList"),
        slidesCountLabel: document.getElementById("slidesCountLabel"),
        toggleSlideTemplateBarBtn: document.getElementById(
          "toggleSlideTemplateBarBtn",
        ),
        slideTemplateBar: document.getElementById("slideTemplateBar"),
        slideTemplateButtons: Array.from(
          document.querySelectorAll("[data-slide-template]"),
        ),
        activeSlideLabel: document.getElementById("activeSlideLabel"),
        previewModeLabel: document.getElementById("previewModeLabel"),
        previewNoteTitle: document.getElementById("previewNoteTitle"),
        previewNoteText: document.getElementById("previewNoteText"),
        previewStatusSummary: document.getElementById("previewStatusSummary"),
        interactionStatePill: document.getElementById("interactionStatePill"),
        previewLifecyclePill: document.getElementById("previewLifecyclePill"),
        previewPrimaryActionBtn: document.getElementById("previewPrimaryActionBtn"),
        previewAssistActionBtn: document.getElementById("previewAssistActionBtn"),
        reloadPreviewBtn: document.getElementById("reloadPreviewBtn"),
        documentMeta: document.getElementById("documentMeta"),
        saveStatePill: document.getElementById("saveStatePill"),
        historyBudgetChip: document.getElementById("historyBudgetChip"),
        workspaceStateBadge: document.getElementById("workspaceStateBadge"),
        themeToggleBtn: document.getElementById("themeToggleBtn"),
        topbarStateCluster: document.getElementById("topbarStateCluster"),
        topbarCommandCluster: document.getElementById("topbarCommandCluster"),
        topbarIdentity: document.querySelector(".topbar-identity"),
        topbarCenter: document.querySelector(".topbar-center"),
        topbarInlineSecondaryActions: document.getElementById(
          "topbarInlineSecondaryActions",
        ),
        topbarPrimaryActions: document.getElementById("topbarPrimaryActions"),
        topbarOverflowBtn: document.getElementById("topbarOverflowBtn"),
        topbarOverflowMenu: document.getElementById("topbarOverflowMenu"),
        topbarOverflowThemeBtn: document.getElementById("topbarOverflowThemeBtn"),
        topbarOverflowUndoBtn: document.getElementById("topbarOverflowUndoBtn"),
        topbarOverflowRedoBtn: document.getElementById("topbarOverflowRedoBtn"),
        previewFrame: document.getElementById("previewFrame"),
        previewStage: document.getElementById("previewStage"),
        previewDropzone: document.getElementById("previewDropzone"),
        previewLoading: document.getElementById("previewLoading"),
        previewLoadingText: document.getElementById("previewLoadingText"),
        selectionOverlay: document.getElementById("selectionOverlay"),
        selectionGuides: document.getElementById("selectionGuides"),
        selectionFrame: document.getElementById("selectionFrame"),
        selectionFrameHitArea: document.getElementById("selectionFrameHitArea"),
        selectionFrameLabel: document.getElementById("selectionFrameLabel"),
        selectionFrameTooltip: document.getElementById("selectionFrameTooltip"),
        selectionHandles: Array.from(document.querySelectorAll(".selection-handle")),
        quickPalette: document.getElementById("quickPalette"),
        toggleInsertPaletteBtn: document.getElementById(
          "toggleInsertPaletteBtn",
        ),
        emptyState: document.getElementById("emptyState"),
        emptyStateTitle: document.getElementById("emptyStateTitle"),
        emptyStateLead: document.getElementById("emptyStateLead"),
        emptyStateFootnote: document.getElementById("emptyStateFootnote"),
        emptyOpenBtn: document.getElementById("emptyOpenBtn"),
        emptyStarterDeckBtn: document.getElementById("emptyStarterDeckBtn"),
        emptyPasteBtn: document.getElementById("emptyPasteBtn"),
        slidesPanel: document.getElementById("slidesPanel"),
        inspectorPanel: document.getElementById("inspectorPanel"),
        panelBackdrop: document.getElementById("panelBackdrop"),
        mobileCommandRail: document.getElementById("mobileCommandRail"),
        mobileSlidesBtn: document.getElementById("mobileSlidesBtn"),
        mobilePreviewBtn: document.getElementById("mobilePreviewBtn"),
        mobileEditBtn: document.getElementById("mobileEditBtn"),
        mobileInsertBtn: document.getElementById("mobileInsertBtn"),
        mobileInspectorBtn: document.getElementById("mobileInspectorBtn"),
        floatingToolbar: document.getElementById("floatingToolbar"),
        floatingToolbarContent: document.getElementById(
          "floatingToolbarContent",
        ),
        ftHandleBtn: document.getElementById("ftHandleBtn"),
        ftCollapseBtn: document.getElementById("ftCollapseBtn"),
        ftGeneralGroup: document.getElementById("ftGeneralGroup"),
        ftTextGroup: document.getElementById("ftTextGroup"),
        ftMediaGroup: document.getElementById("ftMediaGroup"),
        ftDeleteBtn: document.getElementById("ftDeleteBtn"),
        ftDuplicateBtn: document.getElementById("ftDuplicateBtn"),
        ftEditTextBtn: document.getElementById("ftEditTextBtn"),
        ftReplaceImageBtn: document.getElementById("ftReplaceImageBtn"),
        ftCopyStyleBtn: document.getElementById("ftCopyStyleBtn"),
        ftPasteStyleBtn: document.getElementById("ftPasteStyleBtn"),
        ftCopyImageUrlBtn: document.getElementById("ftCopyImageUrlBtn"),
        ftMediaUrlBtn: document.getElementById("ftMediaUrlBtn"),
        ftFitImageBtn: document.getElementById("ftFitImageBtn"),
        inspectorFontFamilySelect: document.getElementById("inspectorFontFamilySelect"),
        inspectorLineHeightSelect: document.getElementById("inspectorLineHeightSelect"),
        ftBoldBtn: document.getElementById("ftBoldBtn"),
        ftItalicBtn: document.getElementById("ftItalicBtn"),
        ftUnderlineBtn: document.getElementById("ftUnderlineBtn"),
        ftAlignGroup: document.getElementById("ftAlignGroup"),
        ftAlignLeftBtn: document.getElementById("ftAlignLeftBtn"),
        ftAlignCenterBtn: document.getElementById("ftAlignCenterBtn"),
        ftAlignRightBtn: document.getElementById("ftAlignRightBtn"),
        ftColorInput: document.getElementById("ftColorInput"),
        ftFontFamilySelect: document.getElementById("ftFontFamilySelect"),
        ftFontSizeSelect: document.getElementById("ftFontSizeSelect"),
        selectedNodeBadge: document.getElementById("selectedNodeBadge"),
        selectedSlideBadge: document.getElementById("selectedSlideBadge"),
        selectedKindBadge: document.getElementById("selectedKindBadge"),
        selectionBreadcrumbs: document.getElementById("selectionBreadcrumbs"),
        selectedElementSummaryCard: document.getElementById("selectedElementSummaryCard"),
        selectedElementTitle: document.getElementById("selectedElementTitle"),
        selectedElementSummary: document.getElementById("selectedElementSummary"),
        selectedElementQuickActions: document.getElementById("selectedElementQuickActions"),
        overlapRecoveryBanner: document.getElementById("overlapRecoveryBanner"),
        overlapRecoveryText: document.getElementById("overlapRecoveryText"),
        overlapSelectLayerBtn: document.getElementById("overlapSelectLayerBtn"),
        overlapMoveTopBtn: document.getElementById("overlapMoveTopBtn"),
        // [v0.19.0] Block reason banner
        blockReasonBanner: document.getElementById("blockReasonBanner"),
        blockReasonText: document.getElementById("blockReasonText"),
        // [WO-06] Shell-level banner region for non-blocking notifications
        shellBanner: document.getElementById("shellBanner"),
        blockReasonActionBtn: document.getElementById("blockReasonActionBtn"),
        // [v0.19.0] Stack depth badge
        stackDepthBadge: document.getElementById("stackDepthBadge"),
        // [v0.18.0] Layers panel
        layersInspectorSection: document.getElementById("layersInspectorSection"),
        layersListContainer: document.getElementById("layersListContainer"),
        normalizeLayersBtn: document.getElementById("normalizeLayersBtn"),
        currentSlideMetaBadge: document.getElementById("currentSlideMetaBadge"),
        currentSlideSummaryCard: document.getElementById("currentSlideSummaryCard"),
        currentSlideTitleDisplay: document.getElementById("currentSlideTitleDisplay"),
        currentSlideSummaryText: document.getElementById("currentSlideSummaryText"),
        currentSlideEditorControls: document.getElementById("currentSlideEditorControls"),
        slideTitleOverrideInput: document.getElementById("slideTitleOverrideInput"),
        slideBgColorInput: document.getElementById("slideBgColorInput"),
        slidePaddingPresetSelect: document.getElementById(
          "slidePaddingPresetSelect",
        ),
        slidePresetSelect: document.getElementById("slidePresetSelect"),
        applySlidePresetBtn: document.getElementById("applySlidePresetBtn"),
        duplicateCurrentSlideBtn: document.getElementById(
          "duplicateCurrentSlideBtn",
        ),
        deleteCurrentSlideBtn: document.getElementById("deleteCurrentSlideBtn"),
        validateExportBtn: document.getElementById("validateExportBtn"),
        selectionPolicySection: document.getElementById("selectionPolicySection"),
        selectionPolicyText: document.getElementById("selectionPolicyText"),
        currentElementSection: document.getElementById("currentElementSection"),
        currentSlideSection: document.getElementById("currentSlideSection"),
        insertSection: document.getElementById("insertSection"),
        elementActionsSection: document.getElementById("elementActionsSection"),
        textInspectorSection: document.getElementById("textInspectorSection"),
        tableInspectorSection: document.getElementById("tableInspectorSection"),
        geometryInspectorSection: document.getElementById("geometryInspectorSection"),
        appearanceInspectorSection: document.getElementById(
          "appearanceInspectorSection",
        ),
        basicModeBtn: document.getElementById("basicModeBtn"),
        advancedModeBtn: document.getElementById("advancedModeBtn"),
        // [LAYER-MODEL v2]
        smartModeBtn: document.getElementById("smartModeBtn"),
        containerModeBtn: document.getElementById("containerModeBtn"),
        // [v0.18.3] preview zoom
        zoomOutBtn: document.getElementById("zoomOutBtn"),
        zoomInBtn: document.getElementById("zoomInBtn"),
        zoomResetBtn: document.getElementById("zoomResetBtn"),
        zoomLevelLabel: document.getElementById("zoomLevelLabel"),
        elementTagInput: document.getElementById("elementTagInput"),
        elementIdInput: document.getElementById("elementIdInput"),
        elementClassInput: document.getElementById("elementClassInput"),
        boldBtn: document.getElementById("boldBtn"),
        italicBtn: document.getElementById("italicBtn"),
        underlineBtn: document.getElementById("underlineBtn"),
        editTextBtn: document.getElementById("editTextBtn"),
        fontSizeSelect: document.getElementById("fontSizeSelect"),
        textColorInput: document.getElementById("textColorInput"),
        showElementHtmlBtn: document.getElementById("showElementHtmlBtn"),
        copyElementBtn: document.getElementById("copyElementBtn"),
        pasteElementBtn: document.getElementById("pasteElementBtn"),
        duplicateElementBtn: document.getElementById("duplicateElementBtn"),
        deleteElementBtn: document.getElementById("deleteElementBtn"),
        moveElementUpBtn: document.getElementById("moveElementUpBtn"),
        moveElementDownBtn: document.getElementById("moveElementDownBtn"),
        resetStylesBtn: document.getElementById("resetStylesBtn"),
        addTextBtn: document.getElementById("addTextBtn"),
        addImageBtn: document.getElementById("addImageBtn"),
        addVideoBtn: document.getElementById("addVideoBtn"),
        insertHtmlTextarea: document.getElementById("insertHtmlTextarea"),
        insertHtmlBtn: document.getElementById("insertHtmlBtn"),
        displaySelect: document.getElementById("displaySelect"),
        positionSelect: document.getElementById("positionSelect"),
        zIndexInput: document.getElementById("zIndexInput"),
        widthInput: document.getElementById("widthInput"),
        heightInput: document.getElementById("heightInput"),
        leftInput: document.getElementById("leftInput"),
        topInput: document.getElementById("topInput"),
        bgColorInput: document.getElementById("bgColorInput"),
        borderColorInput: document.getElementById("borderColorInput"),
        borderStyleSelect: document.getElementById("borderStyleSelect"),
        borderWidthInput: document.getElementById("borderWidthInput"),
        marginInput: document.getElementById("marginInput"),
        paddingInput: document.getElementById("paddingInput"),
        opacityInput: document.getElementById("opacityInput"),
        borderRadiusInput: document.getElementById("borderRadiusInput"),
        addShapeBtn: document.getElementById("addShapeBtn"),
        imageSection: document.getElementById("imageSection"),
        imageSrcInput: document.getElementById("imageSrcInput"),
        applyImageSrcBtn: document.getElementById("applyImageSrcBtn"),
        imageAltInput: document.getElementById("imageAltInput"),
        replaceImageBtn: document.getElementById("replaceImageBtn"),
        fitImageBtn: document.getElementById("fitImageBtn"),
        copyImageUrlBtn: document.getElementById("copyImageUrlBtn"),
        openImageBtn: document.getElementById("openImageBtn"),
        resetImageSizeBtn: document.getElementById("resetImageSizeBtn"),
        rotateImageBtn: document.getElementById("rotateImageBtn"),
        flipImageBtn: document.getElementById("flipImageBtn"),
        insertTableRowAboveBtn: document.getElementById("insertTableRowAboveBtn"),
        insertTableRowBelowBtn: document.getElementById("insertTableRowBelowBtn"),
        deleteTableRowBtn: document.getElementById("deleteTableRowBtn"),
        insertTableColumnLeftBtn: document.getElementById("insertTableColumnLeftBtn"),
        insertTableColumnRightBtn: document.getElementById("insertTableColumnRightBtn"),
        deleteTableColumnBtn: document.getElementById("deleteTableColumnBtn"),
        copyStyleBtn: document.getElementById("copyStyleBtn"),
        pasteStyleBtn: document.getElementById("pasteStyleBtn"),
        inspectorHelp: document.getElementById("inspectorHelp"),
        diagnosticsBox: document.getElementById("diagnosticsBox"),
        alignButtons: Array.from(document.querySelectorAll("[data-align]")),
        openHtmlModal: document.getElementById("openHtmlModal"),
        shortcutsModal: document.getElementById("shortcutsModal"),
        htmlEditorModal: document.getElementById("htmlEditorModal"),
        fileInput: document.getElementById("fileInput"),
        pasteHtmlTextarea: document.getElementById("pasteHtmlTextarea"),
        baseUrlInput: document.getElementById("baseUrlInput"),
        assetDirectoryInput: document.getElementById("assetDirectoryInput"),
        assetDirectoryStatus: document.getElementById("assetDirectoryStatus"),
        loadFileBtn: document.getElementById("loadFileBtn"),
        loadPastedHtmlBtn: document.getElementById("loadPastedHtmlBtn"),
        openHtmlStatus: document.getElementById("openHtmlStatus"),
        htmlEditorModalTitle: document.getElementById("htmlEditorModalTitle"),
        htmlEditorTextarea: document.getElementById("htmlEditorTextarea"),
        htmlEditorHint: document.getElementById("htmlEditorHint"),
        htmlEditorStatus: document.getElementById("htmlEditorStatus"),
        saveHtmlEditorBtn: document.getElementById("saveHtmlEditorBtn"),
        videoInsertModal: document.getElementById("videoInsertModal"),
        videoFileInput: document.getElementById("videoFileInput"),
        loadVideoFileBtn: document.getElementById("loadVideoFileBtn"),
        videoUrlInput: document.getElementById("videoUrlInput"),
        insertVideoUrlBtn: document.getElementById("insertVideoUrlBtn"),
        videoInsertStatus: document.getElementById("videoInsertStatus"),
        contextMenu: document.getElementById("contextMenu"),
        contextMenuInner: document.getElementById("contextMenuInner"),
        layerPicker: document.getElementById("layerPicker"),
        layerPickerTitle: document.getElementById("layerPickerTitle"),
        layerPickerSubtitle: document.getElementById("layerPickerSubtitle"),
        layerPickerList: document.getElementById("layerPickerList"),
        replaceImageInput: document.getElementById("replaceImageInput"),
        insertImageInput: document.getElementById("insertImageInput"),
        restoreBanner: document.getElementById("restoreBanner"),
        restoreBannerText: document.getElementById("restoreBannerText"),
        restoreDraftBtn: document.getElementById("restoreDraftBtn"),
        discardDraftBtn: document.getElementById("discardDraftBtn"),
        toastContainer: document.getElementById("toastContainer"),
      };

      const statusDefaults = Object.freeze({
        htmlEditor:
          (els.htmlEditorStatus?.textContent || "").trim() ||
          "После сохранения изменится и модель, и живое превью.",
      });

      // =====================================================================
      // ZONE: RAF-coalesced selection render scheduler (WO-19, v0.29.1)
      //
      // Replaces the synchronous 7-function fan-out inside applyElementSelection
      // with a single requestAnimationFrame gate. Multiple calls within the same
      // JS task coalesce to exactly ONE RAF callback, eliminating repeated forced
      // layouts (AUDIT-C §Quick-win #1, PAIN-MAP P0-12).
      //
      // Usage:
      //   scheduleSelectionRender('all')                  — all 8 sub-renders
      //   scheduleSelectionRender(['inspector','overlay']) — subset
      //   scheduleSelectionRender('all', { previousNodeId: 'n5' })
      //
      // Sub-render order (deterministic):
      //   1 inspector · 2 shellSurface · 3 floatingToolbar · 4 overlay
      //   5 slideRail  · 6 refreshUi   · 7 overlapDetection · 8 focusKeyboard
      // =====================================================================

      /** Frozen key-set for the 8 selection sub-renders. */
      var SELECTION_RENDER_KEYS = Object.freeze({
        inspector:        "inspector",
        shellSurface:     "shellSurface",
        floatingToolbar:  "floatingToolbar",
        overlay:          "overlay",
        slideRail:        "slideRail",
        refreshUi:        "refreshUi",
        overlapDetection: "overlapDetection",
        focusKeyboard:    "focusKeyboard",
      });

      // Pending dirty flags — zeroed BEFORE sub-renders execute (prevents double-flush race).
      state.selectionRenderPending = {
        inspector:        false,
        shellSurface:     false,
        floatingToolbar:  false,
        overlay:          false,
        slideRail:        false,
        refreshUi:        false,
        overlapDetection: false,
        focusKeyboard:    false,
      };

      /** RAF id; 0 means no frame is queued. */
      state.selectionRenderRafId = 0;

      /**
       * Options stored for the next flush (focusKeyboard guard).
       * @type {{ previousNodeId?: string|null }}
       */
      state.selectionRenderOptions = {};

      /**
       * Schedule one or more selection sub-renders for the next animation frame.
       * Multiple calls in the same synchronous task produce exactly one RAF.
       *
       * @param {string[]|'all'} keys - Array of SELECTION_RENDER_KEYS values OR 'all'.
       * @param {{ previousNodeId?: string|null }} [options]
       */
      function scheduleSelectionRender(keys, options) {
        var pending = state.selectionRenderPending;
        if (keys === "all") {
          pending.inspector        = true;
          pending.shellSurface     = true;
          pending.floatingToolbar  = true;
          pending.overlay          = true;
          pending.slideRail        = true;
          pending.refreshUi        = true;
          pending.overlapDetection = true;
          pending.focusKeyboard    = true;
        } else if (Array.isArray(keys)) {
          for (var i = 0; i < keys.length; i++) {
            if (SELECTION_RENDER_KEYS[keys[i]] !== undefined) {
              pending[keys[i]] = true;
            }
          }
        }
        // Merge options (previousNodeId from most recent call wins)
        if (options && typeof options === "object") {
          if ("previousNodeId" in options) {
            state.selectionRenderOptions.previousNodeId = options.previousNodeId;
          }
        }
        if (state.selectionRenderRafId === 0) {
          state.selectionRenderRafId = requestAnimationFrame(flushSelectionRender);
        }
      }

      /**
       * RAF callback — snapshot dirty flags, zero them, run sub-renders.
       * Errors in individual sub-renders are caught so others still execute.
       */
      function flushSelectionRender() {
        // Snapshot + zero BEFORE executing sub-renders (prevents re-entrant double-flush)
        var snap = {
          inspector:        state.selectionRenderPending.inspector,
          shellSurface:     state.selectionRenderPending.shellSurface,
          floatingToolbar:  state.selectionRenderPending.floatingToolbar,
          overlay:          state.selectionRenderPending.overlay,
          slideRail:        state.selectionRenderPending.slideRail,
          refreshUi:        state.selectionRenderPending.refreshUi,
          overlapDetection: state.selectionRenderPending.overlapDetection,
          focusKeyboard:    state.selectionRenderPending.focusKeyboard,
        };
        var opts = state.selectionRenderOptions;
        // Zero before executing
        state.selectionRenderPending.inspector        = false;
        state.selectionRenderPending.shellSurface     = false;
        state.selectionRenderPending.floatingToolbar  = false;
        state.selectionRenderPending.overlay          = false;
        state.selectionRenderPending.slideRail        = false;
        state.selectionRenderPending.refreshUi        = false;
        state.selectionRenderPending.overlapDetection = false;
        state.selectionRenderPending.focusKeyboard    = false;
        state.selectionRenderRafId = 0;
        state.selectionRenderOptions = {};

        // 1. inspector
        if (snap.inspector) {
          try { updateInspectorFromSelection(); }
          catch (e) { if (typeof reportShellWarning === "function") reportShellWarning("flushSelectionRender:inspector", e); }
        }
        // 2. shellSurface
        if (snap.shellSurface) {
          try { syncSelectionShellSurface(); }
          catch (e) { if (typeof reportShellWarning === "function") reportShellWarning("flushSelectionRender:shellSurface", e); }
        }
        // 3. floatingToolbar
        if (snap.floatingToolbar) {
          try { positionFloatingToolbar(); }
          catch (e) { if (typeof reportShellWarning === "function") reportShellWarning("flushSelectionRender:floatingToolbar", e); }
        }
        // 4. overlay
        if (snap.overlay) {
          try { renderSelectionOverlay(); }
          catch (e) { if (typeof reportShellWarning === "function") reportShellWarning("flushSelectionRender:overlay", e); }
        }
        // 5. slideRail
        if (snap.slideRail) {
          try { renderSlidesList(); }
          catch (e) { if (typeof reportShellWarning === "function") reportShellWarning("flushSelectionRender:slideRail", e); }
        }
        // 6. refreshUi
        if (snap.refreshUi) {
          try { refreshUi(); }
          catch (e) { if (typeof reportShellWarning === "function") reportShellWarning("flushSelectionRender:refreshUi", e); }
        }
        // 7. overlapDetection (calls directly — not double-scheduled)
        if (snap.overlapDetection) {
          try { scheduleOverlapDetection("selection-change"); }
          catch (e) { if (typeof reportShellWarning === "function") reportShellWarning("flushSelectionRender:overlapDetection", e); }
        }
        // 8. focusKeyboard — only if node changed
        if (snap.focusKeyboard) {
          try {
            var prevId = opts.previousNodeId !== undefined ? opts.previousNodeId : undefined;
            var nodeChanged = prevId === undefined || prevId !== state.selectedNodeId;
            if (nodeChanged || !state.selectedFlags.isTextEditing) {
              focusSelectionFrameForKeyboard();
            }
          } catch (e) {
            if (typeof reportShellWarning === "function") reportShellWarning("flushSelectionRender:focusKeyboard", e);
          }
        }
      }

      // =====================================================================
