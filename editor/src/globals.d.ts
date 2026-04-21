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
 * Typed stubs — full signatures added per ADR-012 / WO-13.
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

// ── Bridge schema validator (optional runtime object, ADR-012) ─────────────
interface BridgeSchemaValidator {
  validateMessage(msg: Record<string, unknown>): { ok: boolean; errors: string[] };
}
interface Window {
  BRIDGE_SCHEMA?: BridgeSchemaValidator;
}
