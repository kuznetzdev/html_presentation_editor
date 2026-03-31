# Remaining issues after 0.13.5

## Closed in this pass

- connected asset-directory diagnostics are now covered by an active Stage D Playwright gate across the signed-off Chromium width set
- the release line no longer treats Stage D as a disabled placeholder; full-suite verification now includes the connected-directory diagnostics scenario
- the active Playwright baseline moved to `70 passed / 34 skipped` without reopening the already signed-off Stage A-C flows

## Still open

### 1. Focus isolation and compact shell hardening still need dedicated sign-off

Current reality:

- harness smoke coverage exists
- Stage E drawer/focus assertions are still disabled pending the focused hardening pass

### 2. Internal zoning is still too coarse

Current reality:

- the architecture is stable
- preview lifecycle, manipulation, export/assets, and shell state still live in one large editor file and need responsibility-based cleanup in Stage F

### 3. System polish is intentionally postponed

Current reality:

- correctness gates are stronger than before
- light/dark parity, control consistency, and visual normalization still wait for the dedicated Stage G pass

### 4. Asset diagnostics still have non-gated residual ambiguity

Current reality:

- connected asset-directory truthfulness is now proven
- deeper remote/manual-base uncertainty is still not modeled as a dedicated release gate and can be tightened later without blocking the next shell-hardening step

## Immediate priorities after 0.13.5

1. hidden-drawer focus isolation and compact shell hardening
2. responsibility-based cleanup inside the large editor file
3. visual/system polish only after those correctness gates stay green
4. optional follow-up tightening for remote/manual-base asset ambiguity
