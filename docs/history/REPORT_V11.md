# Presentation Editor v11 — shell popover hardening + slide preset apply

## Context recovered
Этот проход продолжает приоритеты после v10: сначала укрепить shell/layout path на реальных узких ширинах, затем продвинуть slide model v2 так, чтобы у слайда были более first-class настройки и безопасные slide-level действия без деградации `iframe + bridge + modelDoc`.

## Goal of this pass
1. Убрать оставшиеся responsive dead ends вокруг insert/template popovers, drawers и mobile rail.
2. Сделать существующий слайд более first-class через безопасный preset-apply flow.
3. Продолжить структуризацию кода вокруг slide-model и shell-popover path, а не добавлять ещё один слой override-патчей.

## What was closed now

### 1. Narrow-width shell popovers are now hardened as sheet-mode, not fragile anchored popovers
Changed:
- introduced `--shell-popover-inset` as a shared shell metric;
- `quickPalette` and `slideTemplateBar` now get `overscroll-behavior: contain` and stable scroll gutter;
- shell now switches to `data-shell-popover-mode="sheet"` on narrow widths;
- `positionAnchoredPopover()` now has a narrow-width sheet fallback instead of trying to keep every popover as a tiny anchored bubble;
- opening insert/template/context UI now closes mobile drawers first.

What this fixes:
- on 390/640-style widths insert/template UI is less likely to collide with drawers, mobile rail and topbar;
- popovers now have one systematic mobile behavior instead of many micro-overrides;
- the preview canvas keeps priority because transient UI no longer stacks unpredictably on top of an open drawer state.

### 2. Slide model v2 now supports safe preset-apply for an existing slide
Added:
- `slidePresetSelect`
- `applySlidePresetBtn`
- `applyCurrentSlidePreset()`
- `slideHasMeaningfulContent()`
- `syncSlidePresetActionUi()`

Behavior:
- the current slide can now receive a safe preset replacement from inspector;
- the action replaces slide content but keeps slide-level root settings intact;
- if the slide already has meaningful content and the chosen preset differs, the user gets a destructive-action confirmation;
- Undo remains the recovery path.

What this fixes:
- slide presets are no longer only “create new slide” affordances;
- slide-level UX becomes more first-class without forcing users into raw HTML or delete/recreate flows.

### 3. Slide list metadata is stronger and more legible
Added:
- `titleOverride` and `paddingPreset` surfaced in runtime metadata;
- `getSlidePresetValue()`
- `getSlidePaddingLabel()`
- `buildSlideMetaTags()`

Changed:
- slide list cards can now show richer metadata tags, not only preset;
- current-slide badge in inspector now mirrors richer slide metadata.

What this fixes:
- slide list UX now exposes more of the slide model instead of hiding it behind inspector-only state.

### 4. Shell state is cleaner around transient UI competition
Changed:
- opening context menu, insert palette or slide template popover now explicitly closes shell drawers first;
- shell popover mode is derived from shell metrics instead of scattered ad hoc conditions.

What this fixes:
- fewer collisions between drawers and transient UI;
- less chance of returning to “old shell layer -> new override -> another override”.

## Structural impact
This pass intentionally grouped two subsystems more clearly:
- shell popover metrics / layout / collision handling
- slide model helpers / preset state / slide metadata surfacing

That keeps the file more predictable than adding yet another historical override band.
