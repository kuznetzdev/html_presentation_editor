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
}
