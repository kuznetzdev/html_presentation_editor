// state.js
// Layer: Data & Constants
// SelectionPolicy factory, PreviewLifecycle helpers, and the app state singleton.

      // ZONE: Selection Policy
      // createDefaultSelectionPolicy, normalizeSelectionPolicy — entity edit-permission models
      // =====================================================================
      function createDefaultSelectionPolicy(flags = {}) {
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
        if (flags.isSlideRoot) {
          return {
            ...policy,
            kind: "slide-root",
            reason:
              "Корневой контейнер слайда редактируется только в безопасном режиме.",
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
          };
        }
        if (flags.isProtected) {
          return {
            ...policy,
            kind: "critical-structure",
            reason:
              "Системный контейнер deck защищён от прямого редактирования и structural-операций.",
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
          };
        }
        if (flags.isTable) {
          return {
            ...policy,
            kind: "structured-table",
            reason:
              "Таблица импортирована как структурированный DOM-блок: безопаснее редактировать ячейки, а не сырой HTML.",
            canEditText: false,
            canEditAttributes: false,
            canEditHtml: false,
            canDelete: false,
            canWrap: false,
            canAddChild: false,
            canReplaceMedia: false,
          };
        }
        if (flags.isCodeBlock) {
          return {
            ...policy,
            kind: "plain-text-block",
            reason:
              "Code block сохраняет пробелы и переносы строк. Избегайте raw HTML replacement.",
            canEditAttributes: false,
            canEditHtml: false,
            canAddChild: false,
            canReplaceMedia: false,
          };
        }
        if (flags.isSvg) {
          return {
            ...policy,
            kind: "svg-object",
            reason:
              "Inline SVG импортирован как object-level блок. Внутреннюю векторную структуру нужно сохранять.",
            canEditText: false,
            canEditAttributes: false,
            canEditHtml: false,
            canDelete: false,
            canWrap: false,
            canAddChild: false,
            canReplaceMedia: false,
          };
        }
        if (flags.isFragment) {
          return {
            ...policy,
            kind: "stateful-wrapper",
            reason:
              "Stateful wrapper сохраняет fragment/state classes и data-* атрибуты.",
            canEditAttributes: false,
            canEditHtml: false,
            canWrap: false,
            canAddChild: false,
            canReplaceMedia: false,
          };
        }
        return policy;
      }

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
      };

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
        // [v0.18.0] Lock banner
        lockBanner: document.getElementById("lockBanner"),
        lockBannerText: document.getElementById("lockBannerText"),
        unlockElementBtn: document.getElementById("unlockElementBtn"),
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
