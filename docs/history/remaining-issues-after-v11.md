# Remaining issues after v11

## Closed in v11
- insert/template popovers now have a deliberate narrow-width sheet-mode fallback instead of relying only on anchored positioning;
- transient shell UI now closes drawers before opening insert/template/context UI, reducing shell collisions on compact widths;
- slide model v2 now has a safe preset-apply flow for the current slide;
- slide list metadata is richer: preset + padding can now be surfaced more explicitly.

## High priority still open

### 1. Final live browser sweep is still required
Still needed:
- real browser QA on 390 / 640 / 820 / 1100 / 1280 / 1440+
- final sign-off for topbar, preview note, drawers, rail, context menu and floating toolbar
- explicit overflow audit in both themes

### 2. Slide model v2 is improved, but not complete yet
Still needed:
- richer slide-level settings beyond title / background / padding / preset;
- clearer preset preview before replacement;
- stronger deck-specific rules for applying presets on non-generic slide roots;
- optional thumbnail/mini-preview in slide list.

### 3. Asset / export hardening still needs the next pass
Still needed:
- preview/export compare workflow beyond simple export preview;
- stronger unresolved asset diagnostics in shell UI;
- deeper CSS asset edge cases (`image-set()`, longer import chains, nested CSS URLs).

### 4. Direct manipulation QA hardening is still open
Still needed:
- transformed nodes;
- nested positioned containers;
- zoom / scroll scenarios;
- touch / trackpad behaviour;
- very small targets;
- overlay collision cases.

### 5. File structure can still be made cleaner
Next useful cleanup:
- isolate shell popover helpers into one tighter contiguous block;
- isolate slide-model helpers from broader inspector/render helpers even more explicitly;
- continue shrinking `refreshUi()` into smaller sync units.

## Recommended next pass
1. full width/theme live QA sign-off
2. direct manipulation hardening on transformed/nested layouts
3. asset/export compare diagnostics
4. richer slide settings / optional slide thumbnails
