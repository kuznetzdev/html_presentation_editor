# Remaining issues after v9

## Closed in v9
- shell offsets no longer rely on stale fixed topbar/mobile-rail heights;
- quick insert palette and slide template menu no longer push layout in normal flow;
- slide model got first-class title override + preset metadata groundwork;
- asset unresolved reporting now correctly parses CSS `url()` / `@import` again;
- local asset matching now survives query/hash suffixes.

## High priority still open

### 1. Real browser QA sweep is still needed
Run an actual engine pass on:
- 390
- 640
- 820
- 1100
- 1280
- 1440+

Check:
- topbar growth/shrink
- drawers + backdrop
- mobile rail height
- preview note wrapping
- insert/template popovers
- floating toolbar/context menu against real slide content
- horizontal overflow in both themes

### 2. Slide model v2 is only partially advanced
Still needed:
- safe preset apply/replace flow for existing slides;
- clearer slide-level settings beyond title/background/padding;
- richer slide list UX (thumbnail or stronger metadata surface);
- deck-specific fallback rules for slide presets.

### 3. Asset/export hardening still has a next step
Still needed:
- preview/export compare flow beyond just opening export preview;
- deeper CSS edge cases (`image-set()`, longer import chains);
- stronger unresolved asset diagnostics UI;
- explicit export warnings when unresolved assets remain.

### 4. Direct manipulation QA hardening is still open
Still needed:
- transformed elements;
- nested positioned containers;
- zoom / scroll scenarios;
- touch / trackpad behaviour;
- very small targets;
- overlay collision cases.

### 5. File structure can still be made cleaner
Next useful cleanup:
- isolate shell layout controller responsibilities more explicitly;
- isolate slide-model helpers from preview lifecycle helpers;
- isolate asset resolver/export diagnostics into one contiguous subsystem;
- continue reducing cross-calls from `refreshUi()` into smaller sync groups.

## Recommended next pass
1. Real browser width/theme sweep
2. direct-manipulation hardening on transformed/nested layouts
3. slide model v2 safe preset-apply UX
4. asset/export compare diagnostics
