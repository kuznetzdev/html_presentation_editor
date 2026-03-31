# CHANGELOG

## 0.13.4 - direct manipulation coordinate correctness proved - 2026-03-31
- widened the proven direct-manipulation envelope to nested positioned contexts by tracking `left/right` and `top/bottom` anchors explicitly instead of assuming one inset space
- preserved truthful blocking for unsafe transformed contexts, so keyboard nudge falls back to diagnostics instead of writing incorrect coordinates
- hardened selection sync around blur and bridge-driven element updates so non-text selection paths stop tearing down editing state unexpectedly
- promoted Stage C Playwright coverage for text edit, image replace, block/image/video/layout insertion, and safe-vs-unsafe keyboard nudge flows
- refreshed loaded-shell visual baselines to match the expanded Stage C fixture deck while keeping the full suite green

## 0.13.3 - deterministic slide activation proved - 2026-03-31
- promoted Stage B Playwright coverage from placeholder to release gate for create, duplicate, delete, undo/redo, and autosave-recovery flows across the signed-off Chromium width set
- added shell-aware browser helpers so compact-width regression scenarios use the real slide-list and inspector drawers instead of hidden desktop controls
- removed the timing hole where structural slide mutations relied on debounced history capture, making undo/redo deterministic under immediate create/duplicate/delete sequences
- captured structural slide history against the intended active slide target, not the stale runtime-confirmed slide, so restored drafts and undo states land on the correct slide index
- persisted editor mode through history snapshots and autosave payloads so undo, redo, and draft recovery return to the truthful `edit` state instead of silently dropping back to preview
- stopped runtime `bridge-sync` reconciliation from creating background history entries, which removed the redo-invalidating race after slide rebuilds and restores
- hardened cold-start Playwright navigation for the signed-off mobile width set so the Stage B gate does not fail on harness-only `page.goto` timeouts
- kept the full active Playwright suite green after enabling Stage B coverage

## 0.13.2 - export preview parity proved - 2026-03-31
- added Playwright proof for manual-base parity between live preview and export-validation preview on the signed-off Chromium width set
- aligned manual base URL handling behind one shell path so load, restore, autosave, and rendered-output contracts stop drifting semantically
- exposed `manualBaseUrl` directly in the rendered-output contract while preserving `baseHref` for the DOM-level output package
- verified export-validation chrome stripping through a truthful UX route on compact widths by using the visible export action when the desktop-only validate button is hidden
- kept the full active Playwright suite green after the stage A changes
- preserved the fixed `parent shell + iframe + bridge + modelDoc` architecture without widening the asset-rewrite scope yet

## 0.13.1 - shell hardening - 2026-03-31
- removed the feedback loop between design-time chrome sizes and measured runtime offsets; shell now uses `--topbar-min-h` for styling and `--shell-top-offset` / `--mobile-rail-offset` for live geometry
- hardened topbar, secondary row, preview note, panel internals, and button sizing against frozen width assumptions via predictable grid/min-width rules
- normalized shell layout metrics into one model for popovers, context menu, compact toolbar, drawer lock state, and viewport insets
- moved slide-template popover out of the drawer subtree so it no longer disappears with a hidden ancestor in compact shell mode
- upgraded narrow-width popovers and context menu to deterministic sheet fallback on `390 / 640 / 820` instead of relying on fragile anchored placement
- converted compact floating toolbar to viewport-anchored positioning using the same shell inset metrics as other overlays
- removed hidden-but-focusable toolbar state; offscreen toolbar controls no longer stay in the keyboard path when no active selection exists
- verified responsive shell behavior on `390 / 640 / 820 / 1100 / 1280 / 1440`, plus light/dark and keyboard-basics smoke checks

## 0.12.1 - audit / v13 planning - 2026-03-31
- reconstructed current v12 state from code + docs
- classified closed vs partially mitigated vs still-critical issues
- defined top-5 blockers for v13
- prepared execution plan, file boundaries, and future commit/tag sequence

## 0.12.1 - 2026-03-31
- fixed bridge script serialization in iframe preview; regex-based helpers no longer break at runtime
- fixed empty preview state so the loading overlay does not block `Open HTML`
- changed slide activation flow to wait for runtime confirmation instead of optimistic shell-only activation
- split clean export from validation preview export; clean export no longer leaks bridge or editor markers
- fixed direct manipulation coordinate origin for `absolute` and `fixed` elements
- added separate tracking for unresolved assets vs base-URL-dependent assets
- synced compact shell panel visibility with `hidden` / `aria-hidden` / `inert`

## 0.12.0
- compact and safer floating toolbar path on narrow widths
- context menu sheet-mode fallback on narrow widths
- safer direct manipulation gating for complex geometry
- tiny-target overlay adjustments
- shell cleanup around preview/edit flows
