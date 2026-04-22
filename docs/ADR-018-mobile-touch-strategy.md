# ADR-018: Mobile / Touch Strategy — tablet-viewable, not tablet-editable in v1.0

**Status**: Accepted
**Phase**: v0.27.x–v1.0 (policy decision; scoped investment)
**Owner**: Product + Architecture
**Date**: 2026-04-20

---

## Context

Current state:
- Shell runs in mobile/tablet viewports; Playwright gate-D covers `chromium-mobile-390`, `chromium-mobile-640`, `chromium-tablet-820`.
- `AUDIT-E` confirms coverage depth is narrow — only `shell.smoke` + `editor.regression` basics run on these viewports.
- Compact shell CSS (`responsive.css`, 540 lines) handles layout, but direct-manipulation, keyboard shortcuts, and power flows are desktop-first.
- SOURCE_OF_TRUTH §Priority rule: "adding more power vs. making the editor clearer, safer, reliable — second wins".
- ROADMAP_NEXT §Deferred: "Mobile/tablet touch conflicts (low — desktop is primary target)".

Pressure to expand:
- Tablets are a real secondary surface (reviewers, approvers, quick content tweaks).
- Drag-resize on touch is different from mouse.
- Keyboard shortcuts don't exist on touch.
- Compact shells have different inspector density needs.

The right question isn't "should we support tablets?" but "what tablet workflows are we willing to commit to?".

---

## Decision

**v1.0 tablet posture: "review-capable, light-edit-capable, not power-editable".**

Concretely:

### Supported on tablet (v1.0)

- Open an HTML deck and navigate slides (preview mode).
- Tap an element → see selected breadcrumb and inspector summary.
- Tap text → inline edit (contenteditable gestures).
- Tap image → replace src via file picker.
- Slide rail interaction: tap to switch slide.
- Save / export buttons accessible.
- Zoom presets (compact-specific ranges).

### NOT supported on tablet (v1.0, explicit)

- Direct manipulation (drag/resize). Block with honest feedback: "Перемещение и изменение размера — только на desktop". Reuse ADR-001 banner.
- Multi-select via Shift-click (no Shift).
- Rail drag-reorder. Compact widths already explicitly skip this per AUDIT-E gate-D notes.
- Layers panel (advanced mode).
- Complex keyboard shortcuts (no keyboard).

### v1.0 investment

- Audit current gate-D spec depth → **add 10 smoke tests** covering the supported tablet workflows above.
- Block directmanip + rail-reorder with honest banners on compact.
- Compact shell a11y: ensure ADR-006 a11y gate runs at 390 + 640 + 820 viewports too.
- Viewport meta + zoom behavior: no pinch-zoom trap.

### v1.1+ (explicit non-goals in v1.0)

- Touch-native direct manipulation (long-press → drag).
- Floating-toolbar redesign for thumb-zone.
- Tablet-first inspector layout (bottom sheet vs. right panel).

---

## Consequences

**Positive:**
- Scope is bounded. No "touch polish" sprawl in v1.0.
- Users on tablet are not silently broken — they get honest banners.
- Regression risk contained — direct-manip complexity stays desktop-only.
- a11y gate (ADR-006) naturally covers compact viewports.

**Negative:**
- Tablet users who expect full editing will be disappointed and told "use desktop".
- "Not supported" UX must be designed carefully — feels like a dead-end if done poorly.
- 10 new smoke tests = small cost; acceptable.

---

## Alternatives Considered

1. **Full touch-first editing in v1.0.** Rejected — scope explosion; would delay v1.0 by 2–4 months.
2. **No mobile support; desktop-only explicit.** Rejected — we already half-support mobile; ripping it out loses real users and breaks gate-D.
3. **Read-only mobile, edit only on desktop.** Rejected — text-tap-edit is easy and high value.
4. **Define "mobile" and "tablet" separately.** Deferred — one tier simplifies the policy; revisit for v1.1 if data suggests tablets need more.

---

**Accepted in**: v0.32.3 via WO-33

## Applied In

- v0.32.3 (WO-33) — tablet honest-block banners implemented; `isCompactViewport()` added to feedback.js; drag/resize guard in selection.js; rail-reorder guard in slide-rail.js; Gate-D +10 tests (tablet-honest.spec.js × 3 viewports)
- v0.27.x — tablet honest-block banners for direct-manip + rail-reorder
- v0.27.x — gate-D spec depth expanded (tap-select, tap-edit-text, tap-replace-image, rail-nav)
- v0.28.x — a11y gate runs at compact viewports (ADR-006 extension)
- v1.0 — policy ships

## Links
- [ADR-001 Block Reason Protocol](ADR-001-block-reason-protocol.md) — banner reuse
- [ADR-006 Accessibility CI Gate](ADR-006-accessibility-ci-gate.md) — extends to compact
- AUDIT-E §gate-D notes
- AUDIT-B journey 12 (rail) — keyboard-only failure generalizes to touch
- SOURCE_OF_TRUTH §Priority rule
- ROADMAP_NEXT §Deferred "Mobile/tablet touch conflicts"
