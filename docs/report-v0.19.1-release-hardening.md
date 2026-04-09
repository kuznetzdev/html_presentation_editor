# v0.19.1 release hardening report

## Scope

- hardening batch only
- no external API or product-contract rewrite
- no autosave schema bump
- no export-format change
- no novice workflow change

This pass was limited to three repository-level goals:

1. restore semver runtime discipline around the active `0.19.1` artifact
2. remove shell-owned silent fallback behavior in targeted storage/export paths
3. reduce blast radius inside the monolithic runtime by re-zoning the touched logic

## Delivered changes

### 1. Semver runtime discipline

- canonical runtime now ships as `editor/presentation-editor-v0.19.1.html`
- `editor/presentation-editor.html` is now a compatibility-only redirect shim
- Playwright harness and export tooling now target the versioned runtime directly
- package metadata, changelog, project skills, and repository docs now point to one canonical runtime artifact

### 2. Internal zoning in the monolithic runtime

- removed the late `v3 UX EXTENSIONS` override framing from the active runtime
- re-labeled the touched areas into explicit ownership bands:
  - shell routing + responsive shell state
  - selection/direct-manip feedback
  - history + autosave + export
  - shell storage + preference persistence
- kept the fixed architecture unchanged:
  - parent shell
  - iframe preview
  - bridge
  - `modelDoc`

### 3. Honest shell-owned persistence and cleanup

Replaced targeted silent fallback behavior with explicit diagnostics or shell warnings in the touched zones:

- theme preference loading
- copied-style loading and saving
- selection-mode loading and saving
- preview-zoom loading and saving
- inspector-section persistence
- autosave clear and restore-adjacent branches
- export validation URL cleanup
- preview URL cleanup
- asset resolver object-URL cleanup

For browser-compatibility or best-effort paths that remain non-fatal, the runtime now documents the reason inline instead of swallowing exceptions without explanation.

### 4. Export cleanliness invariant

- export stripping now removes shell-only nodes marked with `data-editor-ui="true"`
- export validation now runs an explicit residue check after shell interactions
- diagnostics now record residue if editor-only chrome ever survives cleanup
- export contract remains unchanged: output stays presentation-only HTML

### 5. Regression coverage additions

Added or extended coverage for:

- hidden then restored element before export validation
- context menu open/close before export validation
- floating toolbar visibility churn before export validation
- compact drawer routing before export validation
- locked selection state before export validation
- forced localStorage failures for shell-owned persistence paths

## Non-goals

- no architecture rewrite away from `shell + iframe + bridge + modelDoc`
- no attempt to split the monolithic runtime file in this pass
- no expansion of direct-manipulation support outside the signed-off safe envelope
- no behavior changes to the novice path `empty -> loaded-preview -> loaded-edit`

## Expected result

After this batch:

- the repository has one canonical `0.19.1` runtime target
- the old unversioned entrypoint no longer acts as a second editable source
- shell-owned persistence and cleanup failures in the touched zones fail honestly
- export remains clean even after interaction-heavy shell flows
- documentation and harness references are synchronized with what actually ships on `main`

## Validation executed

### Targeted proof set

- `npx playwright test tests/playwright/specs/asset-parity.spec.js --project=chromium-desktop --grep "@stage-a|@stage-d"`
  - Result: `3 passed`
- `npx playwright test tests/playwright/specs/honest-feedback.spec.js --project=chromium-desktop`
  - Result: `7 passed / 1 skipped`
- `npx playwright test tests/playwright/specs/shell.smoke.spec.js --project=chromium-desktop --grep "@stage-f|@harness"`
  - Result: `14 passed / 4 skipped`

### Mandatory gates

- `npm run test:gate-a`
  - Result: `48 passed / 5 skipped`
- `npm run test:gate-b`
  - Result: `105 passed / 7 skipped`
  - Shell-1100 result: `56 passed / 6 skipped`
- `npm run test:asset-parity`
  - Result: `ok: true`

### Compact-width verification

- `npm run test:gate-d`
  - Result: `128 passed / 37 skipped`

## Residual limits

- the active runtime remains a large monolithic HTML file, so future zoning passes still matter
- direct manipulation remains intentionally conservative for transform-heavy or non-100% zoom contexts
- this batch only removed silent fallback behavior in the targeted shell-owned zones, not across every historical branch of the monolith

## Release-ready summary

`v0.19.1` restores semver runtime discipline, keeps the legacy unversioned editor entrypoint as a compatibility shim, preserves the targeted silent-fallback hardening from the p2 batch, and ships the same export-cleanliness guarantees under a normal patch-release tag. The architecture remains unchanged, autosave stays on schema v3, and the novice workflow contract remains intact. All targeted proofs plus gates A, B, asset parity, and D passed on the final batch.
