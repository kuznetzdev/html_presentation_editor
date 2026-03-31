# Remaining issues after v10

## Closed in v10
- creating a new slide no longer loses activation because shell now preserves requested slide activation through runtime metadata;
- duplicated and inserted slides no longer inherit stale numeric slide-order attributes by default;
- generic/custom decks now have a safer slide activation fallback when they already expose active/current/present-style markers;
- slide title override is now surfaced correctly from slide-root metadata into the slide list;
- slide navigation from the list now uses one first-class request path instead of scattered direct bridge calls.

## High priority still open

### 1. Real browser width/theme sweep is still required
Run a full live pass on:
- 390
- 640
- 820
- 1100
- 1280
- 1440+

Check:
- topbar growth/shrink
- drawers + backdrop
- mobile rail
- preview note wrapping
- insert/template popovers
- slide list under dense content
- floating toolbar/context menu against real slide content
- horizontal overflow in both themes

### 2. Slide model v2 is stronger, but not yet complete
Still needed:
- safe preset apply/replace flow for an existing slide;
- richer slide-level settings beyond title/background/padding;
- stronger slide list UX (thumbnail or better preview metadata);
- deck-specific fallback rules for more engines.

### 3. Asset/export hardening still has a next step
Still needed:
- preview/export compare flow beyond “open export preview”;
- deeper CSS edge cases (`image-set()`, longer import chains, nested URLs);
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
- isolate slide-model helpers from broader shell lifecycle helpers more explicitly;
- isolate navigation/reconciliation helpers from render helpers;
- isolate asset resolver/export diagnostics into one contiguous subsystem;
- continue shrinking `refreshUi()` into smaller sync groups.

## Recommended next pass
1. live browser QA across real widths/themes
2. direct-manipulation hardening on transformed/nested layouts
3. safe preset-apply flow for existing slides
4. asset/export compare diagnostics
