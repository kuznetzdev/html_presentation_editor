# ROADMAP NEXT

## Post-0.13.1 priorities

### 1. Preview lifecycle and slide-flow state machine

Goals:
- make slide activation deterministic under runtime lag
- reduce bridge/watchdog/desync edge cases
- separate shell intent from runtime-confirmed state more clearly

Substeps:
- isolate a stricter activation state machine around `activeSlideId`, `pendingActiveSlideId`, `runtimeActiveSlideId`
- harden `loadHtmlString()`, `applyRuntimeMetadata()`, `requestSlideActivation()`, `applySlideUpdateFromBridge()`, `applyDocumentSyncFromBridge()`
- tighten stale-seq and slide-lock handling so preview resends do not loop silently

### 2. Asset fidelity and export parity

Goals:
- close the largest preview/export mismatch paths
- make unresolved asset diagnostics actionable

Substeps:
- cover CSS `url()`, `@import`, `srcset`, `poster`, and inline-style rewrites as one asset pipeline
- unify preview audit and export audit expectations
- surface base-URL-dependent assets in visible shell copy, not only internal state
- validate clean export and validation preview against the same asset rules

### 3. Direct manipulation support envelope

Goals:
- move from safe blocking to true support for more layouts
- keep incorrect coordinates impossible

Substeps:
- model coordinate origins for nested positioned containers explicitly
- audit overlay-shell coordinates vs iframe coordinates under scroll and resize
- keep transformed / zoomed layouts blocked unless exact mapping is proven
- add stronger end-of-manipulation commit/cancel synchronization

### 4. Internal zoning without architecture rewrite

Goals:
- reduce blast radius inside the large editor file
- keep the fixed runtime architecture unchanged

Substeps:
- carve explicit zones for preview lifecycle, slide flow, direct manipulation, export/assets, and shell layout
- keep refactors contiguous and responsibility-based before extracting files
- preserve `parent shell + iframe + bridge + modelDoc`

### 5. Validation automation

Goals:
- reduce dependence on manual browser smoke checks for every shell/layout pass

Substeps:
- codify responsive shell QA for the signed-off width set
- codify light/dark and keyboard-basics smoke checks
- add a minimal repo-local command that fails on layout regressions before tagging

## Suggested version path

1. `0.13.2`
   focus: preview lifecycle and slide activation hardening
2. `0.13.3`
   focus: asset fidelity and export parity
3. `0.14.0`
   focus: direct-manipulation expansion plus internal zoning
