# Presentation Editor v9 — shell hardening + structure cleanup

## Context recovered
Этот проход продолжает v8 как Stage A из handoff: сначала shell/layout hardening, потом slide-model v2 groundwork и asset edge-case cleanup.

## Goal of this pass
Убрать остаточную мешанину вокруг shell-chrome offsets, popover/menu positioning и slide-level state, не ломая `iframe + bridge + modelDoc`.

## What was closed now

### 1. Shell chrome offsets stopped depending on stale fixed tokens
Added:
- `bindShellChromeMetrics()`
- `syncShellChromeMetrics()`
- `scheduleShellChromeMetrics()`
- `syncShellViewportLock()`

What changed:
- real topbar height now re-syncs `--topbar-h`;
- real mobile rail height now re-syncs `--mobile-rail-h`;
- drawers, backdrop, toast offsets and mobile spacing no longer assume a constant 64px header.

### 2. Insert palette and slide template menu became anchored popovers
Added:
- `closeTransientShellUi()`
- `positionAnchoredPopover()`
- `syncShellPopoverLayout()`
- `scheduleShellPopoverLayout()`

What changed:
- quick insert palette is no longer a full-width block in normal preview flow;
- slide template bar is no longer a layout-pushing strip inside the slides panel;
- both menus now open as fixed, clamped popovers anchored to their triggers;
- shell now closes competing transient UI consistently.

### 3. Slide model v2 got a safer first-class step
Added:
- slide title override field in inspector;
- preset metadata surfaced in runtime slide metadata and slide list;
- helpers:
  - `getSlidePresetLabel()`
  - `getSlideTitleOverride()`
  - `getSlidePaddingPreset()`
  - `applyCurrentSlideTitleOverride()`

What changed:
- current slide now has explicit list title control;
- template-created slides mark `data-slide-preset`;
- slide list can show preset badges instead of being just raw extracted text.

### 4. Asset resolver edge cases were tightened
Fixed:
- broken regex in `extractRelativeUrlsFromCssText()` caused by control-character corruption;
- `normalizeAssetPath()` now strips query/hash suffixes before matching local files;
- unresolved asset status now shows short inline samples, not only a count.

### 5. Small but important responsive/accessibility polish
Changed:
- status pills now clamp instead of forcing overflow;
- body locks scrolling while compact drawers are open;
- mobile rail buttons now use stacked icon+label treatment;
- popovers respect viewport-safe clamping instead of relying on normal flow.

## Structural impact
This pass intentionally did not explode the file into ad-hoc overrides.
Instead it introduced clearer subsystems inside the existing single-file architecture:

- shell chrome metrics
- anchored shell popovers
- slide-level metadata helpers
- asset diagnostics formatting

That keeps the working path intact while making the next refactor easier.
