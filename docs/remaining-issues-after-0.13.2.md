# Remaining issues after 0.13.2

## Closed in this pass

- live preview and export-validation preview are now explicitly proven against the same manual-base scenario in Playwright
- rendered-output contracts no longer expose a false-empty manual-base state; both `manualBaseUrl` and `baseHref` now reflect the active shell input
- load, restore, autosave, and rendered-output packaging now read manual base URL through one shared path
- export-validation remains reachable on compact widths through the visible export flow, so stage A no longer depends on a desktop-only control

## Still open

### 1. Slide activation still needs deterministic proof

Current reality:

- `activeSlideId`, `pendingActiveSlideId`, and runtime-confirmed activation still live in a timing-sensitive cluster
- create, duplicate, delete, and rebuild flows are not yet enabled in Playwright as signed-off release gates

### 2. Direct manipulation is still conservative outside the simplest geometry

Verified:

- simple `absolute` / `fixed` paths stay inside the safe envelope

Not solved:

- nested positioned containers with deeper coordinate chains
- transformed ancestors
- zoom-heavy documents
- drag/resize/nudge proof beyond the currently safe cases

### 3. Asset diagnostics are not fully truthful yet

Current reality:

- parity is proven for manual-base preview/export rendering
- diagnostics still need stricter handling for remote uncertainty and false-clean states
- stage D coverage for connected asset-directory truthfulness is still disabled

### 4. Focus isolation and shell hardening still need dedicated sign-off

Current reality:

- harness smoke coverage exists
- stage E drawer/focus assertions are still disabled pending the dedicated hardening pass

### 5. The main editor file is still too large

Current reality:

- architecture remains correct and fixed
- maintenance cost is still high inside preview lifecycle, manipulation, export, and shell state zones

## Immediate priorities after 0.13.2

1. deterministic slide activation with runtime-confirmed create/duplicate/delete flows
2. coordinate-correct direct manipulation for the provable support envelope
3. truthful asset diagnostics under manual-base and remote uncertainty
4. hidden-drawer focus isolation and compact shell hardening
5. responsibility-based cleanup inside the large editor file
