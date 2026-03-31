# Remaining issues after 0.13.3

## Closed in this pass

- structural slide mutations no longer depend on debounced snapshot timing for undo/redo correctness
- create, duplicate, delete, undo, redo, and autosave recovery are now proven through Playwright on desktop, shell, and compact Chromium widths
- compact-width Stage B regression scenarios now use the truthful shell route: slide creation from the left drawer, slide mutation from the inspector drawer, and preview interaction after drawers are explicitly closed
- history snapshots now track the intended active slide target during structural mutations, so restore paths stop landing on stale slide indices
- bridge-driven document reconciliation no longer appends hidden history entries, so redo stays available after runtime repair and restore paths
- autosave and history snapshots now preserve the requested editor mode, so recovery returns to `edit` instead of silently degrading to preview

## Still open

### 1. Direct manipulation still needs coordinate proof outside the safe envelope

Current reality:

- simple `absolute` / `fixed` support remains verified
- nested positioned containers, transforms, zoom-heavy documents, and broader drag/resize/nudge flows are still pending Stage C proof

### 2. Asset diagnostics are still not fully truthful

Current reality:

- manual-base parity is proven
- remote uncertainty and false-clean diagnostic states still need the dedicated Stage D pass
- connected asset-directory truthfulness remains disabled until that pass is signed off

### 3. Focus isolation and compact shell hardening still need dedicated sign-off

Current reality:

- harness smoke coverage exists
- Stage E drawer/focus assertions are still disabled pending the focused hardening pass

### 4. Internal zoning is still too coarse

Current reality:

- the architecture is stable
- preview lifecycle, manipulation, export/assets, and shell state still live in one large editor file and need responsibility-based cleanup in Stage F

### 5. System polish is intentionally postponed

Current reality:

- correctness gates are now stronger
- light/dark parity, control consistency, and visual normalization still wait for the dedicated Stage G pass

## Immediate priorities after 0.13.3

1. coordinate-correct direct manipulation for the provable support envelope
2. truthful asset diagnostics under manual-base and remote uncertainty
3. hidden-drawer focus isolation and compact shell hardening
4. responsibility-based cleanup inside the large editor file
5. visual/system polish only after those correctness gates stay green
