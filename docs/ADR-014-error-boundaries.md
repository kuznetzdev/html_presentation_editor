# ADR-014: Error Boundaries — shell / bridge / iframe three-layer guard

**Status**: Accepted — Error boundaries (trust-banner + broken-asset banner) shipped across v0.27.1–v0.30.0 via WO-06, WO-07, WO-12, WO-24
**Phase**: v0.27.x (foundational — used by ADR-012 and P0-01 Trust Banner)
**Owner**: Architecture · Reliability
**Depends on**: ADR-012 (bridge acks)
**Date**: 2026-04-20

---

## Context

Current error handling:

- `feedback.js::reportShellWarning()` (`history.js:34–52`) — consistent toast path for shell warnings.
- `bindRuntimeGuards()` (`bridge.js`) — global `error` + `unhandledrejection` handlers that append to `state.diagnostics`. Catches everything, reveals nothing.
- `bridge.js:100–104` — bridge dispatch `try/catch` swallows all handler errors and emits a generic diagnostic.
- Iframe-side: any uncaught error inside the injected bridge script is lost unless the deck itself happens to bubble it up.

AUDIT-A scorecard — Error handling: 6/10. Gap: no **per-layer** taxonomy, no user-facing recovery surface, no replay for transient failures.

AUDIT-D-01's remediation (Trust Banner) requires a reusable error/warning banner infrastructure that is not yet formalized. AUDIT-B journey 11 (Recovery from blocked state) needs a consistent "fail honestly with resolution path" channel.

---

## Decision

Define three layered error boundaries, each with explicit contract and user-facing surface:

### Layer 1 — Shell boundary

**Surface:** `<div id="shellBanner" data-editor-ui="true">` in shell chrome (new).

**Contract:**
```javascript
shellBoundary.report({
  kind: "error" | "warning" | "info",
  code: string,                     // stable short code, ADR-020 telemetry-ready
  message: string,                  // Russian UI copy
  action?: { label: string, onClick: () => void },
  dismissible?: boolean,
});
```

Catches:
- Uncaught exceptions in shell JS (via global `window.onerror`).
- Rejected promises.
- State-slice write violations (from ADR-013 store).
- Any call site explicitly reporting.

### Layer 2 — Bridge boundary

**Surface:** Structured ACK on the bridge (per ADR-012 §5).

**Contract:** Every mutation message returns `{ ok: true }` or `{ ok: false, error: { code, message, recoverable: boolean } }`. Non-recoverable errors escalate to Layer 1 (`shellBoundary.report`). Recoverable (e.g., stale `seq`) silently drop.

Catches:
- Schema validation failures (AUDIT-D-02 remediation).
- Handler exceptions on either side.
- Timeout on expected response.

### Layer 3 — Iframe content boundary

**Surface:** Shell-side `previewHealthChip` (already exists as `#previewLifecyclePill`, now structured).

**Contract:** Deck-side `<script>` errors caught via:
- `window.onerror` inside bridge-script.
- `deck-runtime-error` bridge message → shell.

Shell displays non-blocking health chip: `⚠ Deck: 3 script errors`. User can click to see details modal. Does not block editing.

### Unifying surface: `shellBanner` (visual)

A single stacked-banner region (bottom of preview or top-of-shell, TBD). Multiple banners stack top-down. Each banner has:
- Kind icon (red / yellow / blue)
- Code (small, for debug)
- Message (Russian)
- Action button (optional)
- Dismiss X (optional)

Mutual exclusion: banners do NOT block transient surfaces (picker, context menu, insert palette). They coexist.

### Existing banners to migrate

- `#lockBanner` → `shellBoundary` kind=info
- `#blockReasonBanner` → `shellBoundary` kind=info  (+ unify with `#lockBanner` per PAIN-MAP P1-01)
- `#restoreBanner` → `shellBoundary` kind=info
- `#overlapBanner` → `shellBoundary` kind=warning

---

## Consequences

**Positive:**
- Trust Banner (P0-01) has a home. Asset-missing recovery banner (P0-04) has a home. Resolve-block action (P0-06) has a home.
- Error taxonomy becomes grep-able (codes are string constants in `constants.js`).
- Observability: structured codes feed ADR-020 telemetry.
- Migration path collapses 4 existing ad-hoc banners into one system — fewer dead-ends (PAIN-MAP P1-01).
- Unit-testable error paths.

**Negative:**
- One more surface-manager concern (coordinate with transient-surface manager — PAIN-MAP P2-09).
- Banner region steals a small slice of preview vertical space; mitigated by collapse-when-empty.
- Existing CSS for 4 migrated banners to rewrite — ~1 day CSS work.

---

## Alternatives Considered

1. **Toast-only.** Rejected — toasts disappear; banners persist until acted. Block reasons must persist.
2. **Modal per error.** Rejected — interrupts workflow; AUDIT-B §"no dead ends" invariant.
3. **Per-module error handlers.** Rejected — we have that today, and it's the status quo we're trying to fix.
4. **Sentry-style external capture.** Rejected — adds dependency, network IO; violates local-only promise.

---

## Applied In

- v0.27.x — `shellBanner` region + `shellBoundary.report()` API
- v0.27.x — Trust Banner (from P0-01 remediation) uses Layer 1
- v0.27.x — Asset-missing recovery banner (P0-04) uses Layer 1
- v0.28.x — ADR-012 bridge ACKs use Layer 2
- v0.29.x — 4 existing banners migrated to unified system

## Links
- [ADR-001 Block Reason Protocol](ADR-001-block-reason-protocol.md) — existing banner precedent
- [ADR-012 Bridge Protocol v2](ADR-012-bridge-protocol-v2.md) — Layer 2 ACK contract
- [ADR-020 Telemetry](ADR-020-telemetry-and-feedback.md) — consumes error codes
- AUDIT-A §Error handling 6/10
- AUDIT-B §"Recovery from blocked state"
- AUDIT-D-01 §Remediation "Trust Banner"
- PAIN-MAP P0-01, P0-04, P0-06, P1-01
