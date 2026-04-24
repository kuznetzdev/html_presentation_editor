/**
 * globals.d.ts — Ambient declarations for classic-script cross-file globals.
 * Classic-script project (ADR-015): functions are loaded via separate <script src>
 * tags and share a single global scope. This file makes tsc --noEmit aware of
 * those globals without requiring ES modules or a build step.
 *
 * NOTE: state, els, BRIDGE_PROTOCOL_VERSION are declared in the 3 compiled JS
 * files themselves and do NOT need repeating here — tsc sees them as the same
 * compilation unit. Only functions defined in OTHER (non-compiled) scripts are
 * declared below.
 *
 * Typed stubs — full signatures added per ADR-012 / WO-13; extended WO-38 RC.
 */

// ── UI helpers (defined in shell scripts outside the 3-file include) ────────
declare function addDiagnostic(message: string): void;
declare function showToast(message: string, type?: string, options?: Record<string, unknown>): void;
declare function refreshUi(): void;
declare function setPreviewLoading(loading: boolean): void;

// ── Bridge / preview helpers ───────────────────────────────────────────────
declare function dispatchPendingSlideActivation(reason: string): void;
declare function flushPendingPreviewSelection(): void;
declare function applyRuntimeMetadata(payload: unknown): void;
declare function applySlideActivationFromBridge(payload: unknown): void;
declare function applyElementSelection(payload: unknown): void;
declare function applyElementUpdateFromBridge(payload: unknown, seq: number): void;
declare function applySelectionGeometry(payload: unknown): void;
declare function applySlideUpdateFromBridge(payload: unknown, seq: number): void;
declare function applySlideRemovedFromBridge(payload: unknown, seq: number): void;
declare function openContextMenuFromBridge(payload: unknown): void;
declare function handleBridgeShortcut(payload: unknown): void;
declare function applyDocumentSyncFromBridge(payload: unknown, seq: number): void;
declare function cleanupExportValidationUrl(): void;

// ── Selection render helpers (defined in inspector-sync.js, floating-toolbar.js, etc.) ──
declare function updateInspectorFromSelection(nodeId?: string | null, options?: Record<string, unknown>): void;
declare function syncSelectionShellSurface(nodeId?: string | null): void;
declare function positionFloatingToolbar(rect?: unknown): void;
declare function renderSelectionOverlay(nodeId?: string | null, options?: Record<string, unknown>): void;
declare function renderSlidesList(): void;
declare function scheduleOverlapDetection(reason?: string): void;
declare function focusSelectionFrameForKeyboard(nodeId?: string | null): void;

// ── Feedback / warning helpers (defined in feedback.js) ──────────────────
declare function reportShellWarning(context: string, error?: unknown): void;

// ── Precision / sibling rects (defined in precision.js) ──────────────────
declare function precisionHandleSiblingRectsResponse(requestId: number, rects: unknown): void;

// ── Bridge schema validator (optional runtime object, ADR-012) ─────────────
interface BridgeSchemaValidator {
  validateMessage(msg: Record<string, unknown>): { ok: boolean; errors: string[] };
}

// ── Observable Store (defined in store.js, WO-16, ADR-013) ─────────────────
interface ObservableStore {
  defineSlice(sliceName: string, initialState: Record<string, unknown>): void;
  get(sliceName: string): Record<string, unknown>;
  select(path: string): Record<string, unknown>;
  update(sliceName: string, patchOrUpdater: Record<string, unknown> | ((s: Record<string, unknown>) => Record<string, unknown> | void)): void;
  subscribe(pathOrSlice: string, callback: (state: Record<string, unknown>) => void): () => void;
  batch(fn: () => void): void;
}

interface Window {
  BRIDGE_SCHEMA?: BridgeSchemaValidator;
  /** Observable store instance (ADR-013, WO-16). Named 'store' to match store.js exposition. */
  store: ObservableStore;
  /** Proxy shim for window.state that forwards migrated slice reads/writes (ADR-013, WO-16). */
  stateProxy: unknown;
  /** Private backing reference for the state Proxy (ADR-013, WO-16). */
  _stateProxy: unknown;
  /** Callback injected by precision.js to handle sibling-rects bridge response. */
  precisionHandleSiblingRectsResponse?: (payload: unknown) => void;
  /** [v1.1.1] Apply layoutVersion body attr (ADR-032). */
  applyLayoutVersionAttribute?: () => void;
  /** [v1.1.1] Apply layersStandalone body attr (ADR-031). */
  applyLayersStandaloneAttribute?: () => void;
  /** [v1.1.1] Initialize the left-pane resizer when v2 layout is active. */
  initLeftPaneSplitter?: () => void;
  /** [v1.1.3] Reparent the layers list container per layersStandalone flag. */
  ensureLayersContainerPlacement?: () => void;
  /** [v1.1.6] Open the layer-row context menu. */
  openLayerRowContextMenu?: (opts: { nodeId: string; clientX: number; clientY: number }) => void;
  /** [v1.1.6] Start inline rename on a layer label. */
  startInlineLayerRename?: (label: HTMLElement, nodeId: string) => void;
  /** [v1.1.6] Persist user-authored layer name. */
  renameLayerNode?: (nodeId: string, name: string) => void;
  /** [v1.1.6] Move a layer forward/backward in the slide z-order. */
  moveLayerInStack?: (nodeId: string, direction: "forward" | "backward") => void;
  /** [v1.2.0] Smart Import Pipeline v2 namespace + entry point. */
  ImportPipelineV2?: Record<string, unknown>;
  runImportPipelineV2?: (htmlString: string) => Record<string, unknown>;
  showImportReportModal?: (
    report: Record<string, unknown>,
    callbacks: { onContinue?: () => void; onCancel?: () => void },
  ) => unknown;
  /** [v1.2.1] SVG icon sprite helpers. */
  injectIconSprite?: () => void;
  iconMarkup?: (name: string, fallbackEmoji?: string) => string;
  /** [v1.3.1] Multi-select coordination (Phase D1). */
  refreshMultiSelectAnchor?: () => void;
  clearMultiSelect?: () => boolean;
  selectAllOnSlide?: () => boolean;
  bindMultiSelectShortcuts?: () => void;
  /** [v1.3.2] Alignment toolbar (Phase D2). */
  alignSelection?: (direction: string) => boolean;
  distributeSelection?: (axis: "horizontal" | "vertical") => boolean;
  refreshAlignmentToolbar?: () => void;
  bindAlignmentShortcuts?: () => void;
  ensureAlignmentToolbarRoot?: () => HTMLElement;
  /** [v1.3.3] Opacity + rotate APIs (Phase D3). */
  setSelectedOpacity?: (value: number) => boolean;
  setSelectedRotation?: (deg: number) => boolean;
  clearSelectedRotation?: () => boolean;
  cycleSelectedRotation?: () => boolean;
  bindRotateShortcut?: () => void;
  /** [v1.4.3] Onboarding v2 helpers (Phase E3). */
  resetOnboardingV2?: () => void;
  showHintOnce?: (key: string, message: string, options?: Record<string, unknown>) => boolean;
  hintAfterFirstLoad?: () => void;
  hintAfterFirstSelect?: () => void;
  hintAfterFirstEdit?: () => void;
  primeOnboardingV2?: () => void;
  /** [v1.4.2] User-action boundary + input validators (Phase E2). */
  withActionBoundary?: (reason: string, fn: () => unknown) => unknown;
  InputValidators?: {
    pixelSize: (raw: unknown, options?: { min?: number; max?: number }) => { ok: boolean; value?: number; message?: string };
    opacity: (raw: unknown) => { ok: boolean; value?: number; message?: string };
    url: (raw: unknown) => { ok: boolean; value?: string; message?: string };
    hexColor: (raw: unknown) => { ok: boolean; value?: string; message?: string };
    cssLength: (raw: unknown) => { ok: boolean; value?: string; message?: string };
  };
  __actionBoundarySnapshot?: () => string | null;
  __actionBoundaryRestore?: (snapshot: string) => boolean;
  /** [v1.4.0] PPTX Fidelity v2 helpers (Phase D5). */
  ExportPptxV2?: {
    resolveFontFallback?: (cssFamily: string) => string;
    pxToEmu?: (px: number) => number;
    emuToPx?: (emu: number) => number;
    pxToInch?: (px: number) => number;
    resolveSlideRelativeRect?: (slideRoot: Element, el: Element) => Record<string, number> | null;
    resolveAllRects?: (slideRoot: Element) => Record<string, Record<string, number>>;
    describeSvgRoot?: (svg: Element) => Record<string, unknown>;
    describeSvgPrimitive?: (shape: Element) => Record<string, unknown> | null;
    parseLinearGradient?: (value: string) => Record<string, unknown> | null;
    describeBackgroundImage?: (value: string) => Record<string, unknown> | null;
    directionToDegrees?: (direction: string) => number | null;
    buildPreflightReport?: (modelDoc: Document) => Record<string, unknown>;
    preflight?: () => Record<string, unknown> | null;
    run?: () => unknown;
    [key: string]: unknown;
  };
  /** [v1.1.0] Feature flag registry (ADR-031..037). */
  featureFlags?: {
    layoutVersion?: "v1" | "v2";
    layersStandalone?: boolean;
    treeLayers?: boolean;
    multiSelect?: boolean;
    pptxV2?: boolean;
    smartImport?: "off" | "report" | "full";
    svgIcons?: boolean;
    [key: string]: unknown;
  };
  resetFeatureFlags?: () => void;
}
