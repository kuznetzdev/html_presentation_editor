# Validation Notes v0.19.4: Auditability Baseline

Date: 2026-04-14

## Scope

This note exists to separate executable evidence from product narrative. It records code references, runnable gates, and observed local results for the current `v0.19.4` working tree.

## Executed Gates

- `npx playwright test tests/playwright/specs/reference-decks.deep.spec.js --project=chromium-desktop --project=chromium-shell-1100`
  - Result: `44 passed`
- `npx playwright test tests/playwright/specs/shell.smoke.spec.js --project=chromium-desktop --project=chromium-shell-1100`
  - Result: `31 passed, 7 skipped`
- `npx playwright test tests/playwright/specs/visual.spec.js --project=chromium-desktop --project=chromium-shell-1100`
  - Result: `8 passed`
- `npm run test:gate-b`
  - Result: `110 passed, 7 skipped`
  - Result: `57 passed, 6 skipped`

## Corrected Status Snapshot

| Epic | Status | Basis |
| --- | --- | --- |
| A. Honest feedback / selection clarity | Implemented, needs stronger release docs | Code + tests exist |
| B. Sync hardening / recovery | Partial but real | Code + tests exist; no soak test evidence in this note |
| C. Visual layer picker | Implemented | Code + tests exist |
| D. Precision editing | Partial | Keyboard nudge/guides exist; broader snap contract still needs sharper proof |
| E. Truthful preview + asset contract | Implemented foundation | Code + tests exist |
| F. Media model hardening | Partial | Image/video flows exist; contract still broad |
| G. Internal zoning | Partial, maintainability risk remains | Internal zones exist, but file is still too large |
| H. System polish / shell maturity | Implemented foundation | Shell/runtime tests exist |

## Direct Evidence

### A. Honest feedback / selection clarity

- UI surfaces exist in `editor/presentation-editor.html`:
  - `#blockReasonBanner` at line 4253
  - `#blockReasonActionBtn` at line 4260
  - `#stackDepthBadge` at line 4285
  - `getBlockReason()` at line 14453
  - `getBlockReasonLabel()` at line 14484
- Playwright coverage exists in `tests/playwright/specs/honest-feedback.spec.js` (starts at line 19).

### B. Sync hardening / recovery

- Preview lifecycle primitives exist:
  - `getPreviewLifecycleMeta()` at line 5319
  - `setPreviewLifecycleState()` at line 5394
  - `markPreviewDesync()` at line 12411
  - `rebuildPreviewKeepingContext()` at line 12446
  - `startBridgeWatchdog()` at line 19231
- Recovery/autosave/export tests exist in `tests/playwright/specs/editor.regression.spec.js`:
  - autosave recovery around line 1236
  - export validation around line 1296

### C. Visual layer picker

- Picker surface exists:
  - `#layerPicker` at line 4980
  - `renderLayerPicker()` at line 18922
  - `openLayerPicker()` at line 19024
  - `bindLayerPicker()` at line 19111
- Coverage exists in:
  - `tests/playwright/specs/click-through.spec.js`
  - `tests/playwright/specs/selection-engine-v2.spec.js`

### D. Precision editing

- Precision primitives exist:
  - `#selectionGuides` at line 3938
  - `renderSelectionGuides()` at line 14685
  - `performKeyboardNudge()` at line 15261
- Current note does **not** claim full completion of the broader smart-snapping contract.

### E. Truthful preview + asset contract

- Asset contract primitives exist:
  - `assetResolverMap` state at line 5529
  - `applyAssetResolverToPreviewDoc()` at line 20864
  - `collectPreviewAssetAudit()` at line 20923
  - `openExportValidationPreview()` at line 12781
- Coverage exists in `tests/playwright/specs/asset-parity.spec.js` (starts at line 131).
- Standalone validator exists in `scripts/validate-export-asset-parity.js`.

### F. Media model hardening

- Media flows exist:
  - `replaceImageSrc()` at line 10584
  - `fitSelectedImageToWidth()` at line 15490
  - `rotateSelectedImage()` at line 15566
  - `flipSelectedImage()` at line 15585
  - `insertVideoFromSelectedFile()` at line 21032
  - `insertVideoFromUrlInput()` at line 21060
- Coverage exists in `tests/playwright/specs/editor.regression.spec.js` around lines 288 and 310.

### G. Internal zoning

- Internal zones are present:
  - `[STYLE 01]`..`[STYLE 08]` start around lines 54, 226, 594, 1004, 1733, 2316, 2925, 3034
  - `[SCRIPT 01]`..`[SCRIPT 06]` declared at lines 5028-5033
- This is evidence of zoning, not evidence of sufficient decomposition. Maintainability risk remains valid.

### H. System polish / shell maturity

- Shell/runtime coverage exists in:
  - `tests/playwright/specs/shell.smoke.spec.js`
  - `tests/playwright/specs/visual.spec.js`
- The shell contract now also uses a dedicated isolated local test origin:
  - `scripts/test-server-config.js`
  - `playwright.config.js`

## Known Limits Of This Evidence Note

- This note proves existence and local execution, not long-duration reliability.
- It does not replace CI history, release artifacts, or a full trace bundle.
- Areas still needing stronger proof: long-session sync soak, broader snap/alignment behavior, and a slimmer runtime surface than the current monolithic editor file.
