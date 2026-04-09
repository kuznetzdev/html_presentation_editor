# GitHub Release Body: v0.19.1

## Title

`v0.19.1`

## Tag

`v0.19.1`

## Suggested release subtitle

Patch release for semver runtime sync and hardened shell persistence/export behavior

## Release body

### Highlights

- restored semver runtime discipline around the active `0.19.1` editor artifact
- converted `editor/presentation-editor.html` into a compatibility-only shim
- removed targeted silent fallback behavior in shell-owned storage/export paths
- added regression coverage for interaction-heavy export-cleanliness scenarios
- kept the fixed architecture unchanged: `shell + iframe + bridge + modelDoc`

### What changed

#### Semver runtime sync

- the canonical editor runtime is now `editor/presentation-editor-v0.19.1.html`
- the legacy unversioned entrypoint `editor/presentation-editor.html` no longer acts as a second editable runtime source
- Playwright harness, asset-parity tooling, package metadata, and project docs now point to one canonical runtime artifact

#### Runtime zoning cleanup

- removed the late `v3 UX EXTENSIONS` override framing from the active runtime
- re-marked the touched zones into clearer ownership bands:
  - shell routing + responsive shell state
  - selection/direct-manip feedback
  - history + autosave + export
  - shell storage + preference persistence

#### Honest shell-owned persistence and cleanup

Targeted shell-owned failure paths now surface diagnostics or warnings instead of failing silently:

- theme preference load
- copied-style load/save
- selection-mode load/save
- preview-zoom load/save
- inspector section persistence
- autosave clear and restore-adjacent flows
- export validation URL cleanup
- preview URL cleanup
- asset-resolver object URL cleanup

Where a failure remains intentionally non-fatal for browser-compatibility reasons, the runtime now documents that behavior inline instead of swallowing exceptions without explanation.

#### Export cleanliness invariant

- export stripping now removes `data-editor-ui="true"` shell nodes before serialization
- export validation now performs an explicit residue pass after shell-heavy interaction flows
- diagnostics record leftover editor residue instead of silently proceeding
- export contract is unchanged: output remains presentation-only HTML

#### Regression coverage additions

Added or extended coverage for:

- hidden then restored element before export validation
- context menu open/close before export validation
- floating toolbar show/hide before export validation
- compact drawer open/close before export validation
- locked selection state before export validation
- forced localStorage failures for shell-owned persistence paths

### Validation

#### Targeted proof set

- `npx playwright test tests/playwright/specs/asset-parity.spec.js --project=chromium-desktop --grep "@stage-a|@stage-d"`
  - `3 passed`
- `npx playwright test tests/playwright/specs/honest-feedback.spec.js --project=chromium-desktop`
  - `7 passed / 1 skipped`
- `npx playwright test tests/playwright/specs/shell.smoke.spec.js --project=chromium-desktop --grep "@stage-f|@harness"`
  - `14 passed / 4 skipped`

#### Mandatory gates

- `npm run test:gate-a`
  - `48 passed / 5 skipped`
- `npm run test:gate-b`
  - chromium-desktop: `105 passed / 7 skipped`
  - chromium-shell-1100: `56 passed / 6 skipped`
- `npm run test:asset-parity`
  - `ok: true`
- `npm run test:gate-d`
  - `128 passed / 37 skipped`

### Upgrade and compatibility notes

- no bridge protocol changes
- no autosave schema change; payload remains `presentation-editor:autosave:v3`
- no export format change
- no novice-flow change; the workflow contract remains `empty -> loaded-preview -> loaded-edit`
- no architecture rewrite away from `shell + iframe + bridge + modelDoc`

### Residual limits

- the active runtime remains a large monolithic HTML file, so future zoning passes still matter
- direct manipulation remains intentionally conservative for transform-heavy or non-100% zoom contexts
- this batch only removes silent fallback behavior in the targeted shell-owned zones, not across every historical branch of the monolith

### Included commits

- `ed0b204` `build(editor): Restore semver runtime entrypoint`
- `0751d11` `test(editor): Cover export hygiene and storage diagnostics`
- `3d6f708` `docs(editor): Refresh runtime and verification status`
- `1c0d9ae` `docs(release): Add v0.19.0 p2 hardening report`
- `b18f111` `docs(github): Add release body for v0.19.0 p2 hardening`

### Links

- Release engineering report:
  - `docs/report-v0.19.1-release-hardening.md`
- Compare:
  - [v0.19.0...v0.19.1](https://github.com/kuznetzdev/html_presentation_editor/compare/v0.19.0...v0.19.1)
- Tag:
  - [v0.19.1](https://github.com/kuznetzdev/html_presentation_editor/releases/tag/v0.19.1)

## Short GitHub release summary

`v0.19.1` promotes the hardened `0.19.x` editor state under a normal semver patch tag, keeps the legacy unversioned editor entrypoint as a compatibility shim, preserves the targeted shell-storage/export honesty improvements, and ships the same export-cleanliness guarantees with synchronized package, docs, harness, and release metadata.
