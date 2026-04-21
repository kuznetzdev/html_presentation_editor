# ADR-020: Telemetry & Feedback Loop — opt-in, local-only, zero network

**Status**: Accepted (scaffold — v0.28.2; call-sites per §Applied In in v0.29.x–v0.32.x)
**Phase**: v0.28.1 (existing skeleton in ROADMAP_NEXT) — v0.32.x full implementation
**Owner**: Architecture · Observability
**Depends on**: ADR-014 (error codes — feeds telemetry taxonomy)
**Date**: 2026-04-20

---

## Context

Current observability:
- `addDiagnostic()` in `history.js:34–52` — collects shell warnings into `state.diagnostics[]`, visible in advanced-mode diagnostics panel.
- `reportShellWarning()` wrapper — same channel.
- Iframe-side errors bubble via `bridge.js::bindRuntimeGuards`.
- No notion of "which actions succeeded vs failed". No per-session success rate. No event log.

AUDIT-A §Error handling: 6/10 — "try/catch in bridge.js:100–104 swallows failures". AUDIT-B reveals many silent-failure paths (journey 7 undo drop, journey 2 broken assets, journey 11 dead-end banners).

ROADMAP_NEXT v0.28.1 has a 5-line skeleton for telemetry already. This ADR fleshes it out.

The product invariant: **no network IO for telemetry**. The user opened the editor from `file://` specifically because they didn't want to send data anywhere.

---

## Decision

Build **local-only, opt-in telemetry** in `editor/src/telemetry.js`. Zero network. Zero dependencies.

### Opt-in mechanism

- Default: OFF. `localStorage['editor:telemetry:enabled']` === undefined → disabled.
- User enables via advanced-mode Diagnostics panel toggle: "Записывать действия в локальный журнал для себя".
- Enabling creates a fresh session UUID + starts event log.
- Disabling clears the log.

### Event shape

```javascript
/**
 * @typedef {Object} TelemetryEvent
 * @property {number} t          // Date.now() at emit
 * @property {string} session    // UUID (fresh per session)
 * @property {string} code       // stable ADR-014 code, e.g. "select.success", "paste.asset-missing", "export.pptx.ok"
 * @property {"ok"|"warn"|"error"} level
 * @property {{ entityKind?: string, duration?: number, size?: number }} data  // bounded
 */
```

Events are appended to `localStorage['editor:telemetry:log']` (JSON array). Size cap: 1 MB. LRU-evict oldest.

### Emit points

Instrument via `telemetry.emit({ code, level, data })`. Call sites:

- Every bridge ack (ADR-012) — success/error.
- Every slice update (ADR-013) — aggregated.
- Every shellBoundary.report (ADR-014) — error codes.
- Major flow events: `deck.opened`, `deck.saved`, `export.pptx.started`, `export.pptx.completed`, `undo`, `redo`, `slide.created`, `slide.deleted`.
- Performance markers: `bootstrap.t_to_first_select`, `selection.t_to_inspector`.

### Viewer

Advanced-mode Diagnostics panel shows:
- Session summary: `N events · M errors · X ms avg first-select · Y Mb autosave`.
- Event filter by code/level.
- Export log as JSON file (user-initiated, saves locally).
- Clear log button.

### NOT part of this ADR

- Any network call to any endpoint.
- Any automated upload.
- Any cross-session tracking.
- Any personally-identifying data.

If a future product direction wants cloud analytics, that is a separate ADR and a separate opt-in.

### Export stripping

Exported HTML never contains the telemetry log. `export.js` strips all `data-editor-*` attributes per existing asset-parity invariant — telemetry lives in `localStorage`, not DOM, so no stripping needed.

---

## Consequences

**Positive:**
- Users can debug their own sessions: "why was my save slow last Tuesday?".
- ADR-014 error codes become measurable — repeated errors indicate a real bug.
- AUDIT-B silent-failure paths become detectable (user sees "undo.dropped" events and knows what happened).
- Performance regressions (AUDIT-C bottlenecks) visible in real usage, not just in profiling.
- Zero privacy cost — stays on device.

**Negative:**
- localStorage footprint up to 1 MB when enabled. Acceptable (localStorage quota is 5–10 MB).
- Emit cost per event: ~0.1 ms. Budget `<=500 events/min` comfortably.
- Requires discipline around code naming — sprawl of ad-hoc event codes. Mitigated by ADR-014 code registry as the source of truth.
- "Export log as JSON" introduces a save path outside normal export — file-system-picker behavior differs between browsers.

---

## Alternatives Considered

1. **Sentry-style crash reporting.** Rejected — network IO; violates local-only.
2. **Google Analytics / Matomo.** Rejected — network IO.
3. **No telemetry.** Rejected — we're flying blind on real-user reliability.
4. **IndexedDB instead of localStorage.** Considered — more capacity but async. LocalStorage is enough for 1 MB cap.
5. **In-memory-only (no localStorage).** Rejected — user can't see their own history across sessions.

---

## Applied In

- v0.28.1 — scaffold module, opt-in toggle, basic events (per existing roadmap skeleton)
- v0.29.x — ADR-012 bridge acks emit telemetry events
- v0.30.x — ADR-014 error boundary emits events
- v0.32.x — full viewer in diagnostics panel, export-log path

## Links
- [ADR-014 Error Boundaries](ADR-014-error-boundaries.md) — code taxonomy source
- [ADR-012 Bridge Protocol v2](ADR-012-bridge-protocol-v2.md) — bridge events
- ROADMAP_NEXT §Phase 7 "Local Task Telemetry"
- AUDIT-A §Error handling 6/10
- AUDIT-B §Silent failure paths (journey 2, 7, 11)
