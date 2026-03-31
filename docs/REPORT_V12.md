# Presentation Editor v12 — compact overlay hardening + direct manipulation safety

## Context recovered
Этот проход продолжает зафиксированный порядок работ: сначала укреплять shell/layout и реальные responsive-paths, затем закрывать direct-manipulation риски без разрушения базового контура `iframe + bridge + modelDoc` и чистого HTML export.

## Goal of this pass
1. Убрать remaining dead ends на узких ширинах вокруг floating toolbar и context menu.
2. Перевести direct manipulation из «может сломаться на сложном layout» в «безопасно работает там, где поддерживается, и честно блокируется там, где пока рискованно».
3. Продолжить системную структуризацию shell/overlay path, а не наращивать ещё один слой точечных override-патчей.

## What was closed now

### 1. Floating toolbar now has a compact dock mode instead of chaotic overlay behaviour
Changed:
- introduced `data-toolbar-layout="compact|floating"` derived from shell metrics;
- on narrow preview widths the floating toolbar now docks to the lower edge of `preview-stage` instead of trying to hover near tiny selections;
- compact toolbar content is now a single horizontal scroll strip instead of a tall wrapped blob;
- drag handle is hidden in compact mode, and pinned free-drag is disabled there;
- advanced-only toolbar actions (`copy/paste style`, `copy media URL`, `edit media URL`) are now hidden in Basic.

What this fixes:
- the 390/640 path is less likely to end up with a giant floating toolbar covering the slide;
- the toolbar is more predictable and simpler for weak users;
- Basic mode now really stays lighter instead of leaking too many advanced actions into the closest tool surface.

### 2. Context menu now has a proper compact-width sheet mode
Changed:
- introduced `data-context-menu-layout="sheet|floating"` from shell metrics;
- on narrow widths the context menu opens as a bottom sheet instead of a small floating popup fighting with viewport edges;
- added `positionContextMenu()` and `reopenContextMenuFromState()` so resize/reflow does not misplace the menu.

What this fixes:
- fewer edge collisions on narrow shells;
- context menu no longer depends on fragile tiny-popup geometry in the smallest layouts;
- reopen-on-resize keeps the menu in a stable place.

### 3. Direct manipulation is now safety-gated for transformed / zoomed contexts
Changed inside the iframe bridge:
- added transform/zoom analysis in `collectManipulationContext()`;
- surfaced `directManipulationSafe` and `directManipulationReason` back to parent shell;
- `collectComputed()` now includes `transform` / `translate` for better diagnostics.

Changed in parent shell:
- move / resize / nudge now refuse to start when bridge says the context is unsafe;
- inspector and overlay explain the reason instead of silently behaving badly;
- overlay uses a dedicated blocked visual state instead of pretending drag/resize are available.

What this fixes:
- transformed elements and zoomed contexts no longer go through a “looks enabled, behaves wrong” path;
- the editor now chooses stability over fake power in unsupported direct-manip cases.

### 4. Tiny-target overlay behaviour is calmer
Changed:
- very small selection frames now hide edge handles and keep only the corner-safe affordances;
- overlay label / handle logic is less collision-prone on tiny boxes.

What this fixes:
- less handle clutter on very small targets;
- fewer accidental edge-handle collisions.

## Structural impact
This pass made the overlay path more explicit:
- shell metrics now also drive overlay chrome modes;
- context menu positioning logic has one reusable entry point;
- direct manipulation safety is expressed as explicit runtime metadata, not guessed ad hoc in multiple places.

That keeps the file more predictable and closer to the desired layered structure:
- shell-layout
- overlay chrome
- selection/direct-manipulation
- slide model
- asset/export

## Honest status after v12
This is still not the final browser sign-off.

What v12 does:
- hardens the compact overlay path;
- removes a class of broken direct-manipulation behaviour by blocking unsupported contexts with clear feedback.

What v12 does not claim:
- full live-browser sign-off on every target width/theme;
- full direct-manip support for transformed / nested positioned layouts;
- complete asset/export compare diagnostics.
