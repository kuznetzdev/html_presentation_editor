# Remaining issues after 0.18.1

## Closed in this pass

- active runtime filename now follows the release semver tag and the previous runtime is archived under `docs/history/`
- `CHANGELOG`, `PROJECT_SUMMARY`, `ROADMAP_NEXT`, `SOURCE_OF_TRUTH`, and `TESTING_STRATEGY` now reflect the shipped `0.17.0` and `0.18.0` work
- local Copilot agents and project skills now point to the live runtime, current validation docs, and release-sync discipline

## Still open

### 1. Smart layer resolution is not implemented yet

Current reality:

- overlap recovery and advanced-mode layers are signed off
- dense stacks still need a stronger candidate-picking path beyond repeated click-through and current layer-panel selection
- issue `#3` remains the next feature milestone

### 2. Internal zoning is still too coarse

Current reality:

- the architecture is stable
- preview lifecycle, selection, overlap, layers, export/assets, and shell state still live in one large editor file
- cleanup should stay responsibility-based and avoid architecture rewrite

### 3. System polish remains intentionally secondary to correctness

Current reality:

- the current shell is stable enough for release
- overlap banners, layers rows, and older shell surfaces still need consistency polish later
- light/dark parity should improve only without reopening signed-off behavior

## Immediate priorities after 0.18.1

1. smart layer resolution / magic select for complex overlap cases
2. responsibility-based cleanup inside the large editor file without changing architecture
3. shell and advanced-mode consistency polish after the next correctness pass stays green