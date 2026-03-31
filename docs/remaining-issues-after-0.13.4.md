# Remaining issues after 0.13.4

## Closed in this pass

- positioned direct manipulation now respects `left/right` and `top/bottom` anchor space for the signed-off keyboard-nudge envelope
- nested positioned contexts are now covered by Playwright instead of relying on the old single-origin assumption
- unsafe transformed manipulation paths stay blocked with truthful diagnostics instead of mutating the DOM with incorrect coordinates
- selection sync no longer tears down editing state on non-text blur or unrelated bridge element updates
- loaded-shell visual baselines were refreshed to match the expanded Stage C regression deck

## Still open

### 1. Asset diagnostics are still not fully truthful

Current reality:

- manual-base parity is proven
- remote uncertainty and false-clean diagnostic states still need the dedicated Stage D pass
- connected asset-directory truthfulness remains disabled until that pass is signed off

### 2. Focus isolation and compact shell hardening still need dedicated sign-off

Current reality:

- harness smoke coverage exists
- Stage E drawer/focus assertions are still disabled pending the focused hardening pass

### 3. Internal zoning is still too coarse

Current reality:

- the architecture is stable
- preview lifecycle, manipulation, export/assets, and shell state still live in one large editor file and need responsibility-based cleanup in Stage F

### 4. System polish is intentionally postponed

Current reality:

- correctness gates are now stronger
- light/dark parity, control consistency, and visual normalization still wait for the dedicated Stage G pass

## Immediate priorities after 0.13.4

1. truthful asset diagnostics under manual-base and remote uncertainty
2. hidden-drawer focus isolation and compact shell hardening
3. responsibility-based cleanup inside the large editor file
4. visual/system polish only after those correctness gates stay green
