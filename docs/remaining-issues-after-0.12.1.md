# Remaining issues after 0.12.1

## Still open

### 1. Full browser QA is not complete

Not signed off yet:
- `390 / 640 / 820 / 1100 / 1280 / 1440` widths
- light and dark theme sweep
- final overflow audit for shell chrome and floating UI

### 2. Direct manipulation is only partially solved

Verified:
- simple drag on an `absolute` element now keeps correct coordinates

Not solved:
- transformed nodes
- transformed ancestors
- nested positioned containers with harder coordinate chains
- zoom-heavy documents
- touch / trackpad behaviour

### 3. Asset coverage is still incomplete

Improved:
- unresolved assets and base-URL-dependent assets are now tracked separately

Still incomplete:
- CSS `url()` asset chains
- `srcset`
- `poster`
- deeper preview/export parity checks
- explicit browser sign-off for the manual base-URL UI path

### 4. Slide flow is still timing-sensitive

Current reality:
- slide activation still depends on bridge/runtime metadata arriving in time
- shell keeps a resend path inside `applyRuntimeMetadata()`
- stale-seq / sync-lock logic is present, but still concentrated in one fragile cluster

### 5. No automated lint/type pipeline exists for this standalone HTML editor

Current reality:
- verification is browser-first and smoke-test driven
- there is no repo-local ESLint / TypeScript / HTML validation pipeline to run after each pass

### 6. The main editor file is still too large

Current reality:
- the system works, but maintenance cost remains high
- internal extraction by responsibility is still needed, without changing the fixed runtime architecture

## Top 5 blockers for v13

1. preview lifecycle and slide activation are still distributed across shell state, bridge state, and runtime metadata
2. asset handling is not yet a full preview/export parity system
3. direct manipulation only truly supports the simplest geometry cases
4. compact shell behavior is improved but not fully signed off on target widths/themes
5. the single-file structure keeps high-risk code paths tightly coupled
