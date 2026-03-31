# Remaining issues after 0.13.6

## Closed in this pass

- compact-shell backdrop hit-area now excludes the active drawer, so close gestures on narrow widths stop landing on panel content
- Stage E is now an active Playwright gate for drawer close, hidden-panel inertness, and compact-shell geometry on `390 / 640 / 820`
- the active Playwright baseline moved to `73 passed / 31 skipped` without reopening the already signed-off Stage A-D flows

## Still open

### 1. Internal zoning is still too coarse

Current reality:

- the architecture is stable
- preview lifecycle, manipulation, export/assets, and shell state still live in one large editor file and need responsibility-based cleanup in Stage F

### 2. System polish is intentionally postponed

Current reality:

- correctness gates are stronger than before
- light/dark parity, control consistency, and visual normalization still wait for the dedicated Stage G pass

### 3. Asset diagnostics still have non-gated residual ambiguity

Current reality:

- connected asset-directory truthfulness is now proven
- deeper remote/manual-base uncertainty is still not modeled as a dedicated release gate and can be tightened later without blocking the cleanup phase

## Immediate priorities after 0.13.6

1. responsibility-based cleanup inside the large editor file
2. visual/system polish only after cleanup keeps correctness gates green
3. optional follow-up tightening for remote/manual-base asset ambiguity
