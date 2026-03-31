# v0.13.1 asset parity report

## Scope

Make export validation use the same asset/base-resolution contract as live preview, without leaking preview-only rewrites back into `modelDoc`.

## Code changes

### Shared rendered-output contract

Added a single rendered-output contract layer that normalizes:

- `renderMode`
- `baseHref`
- `applyAssetResolver`
- `keepEditorArtifacts`
- `includeBridge`
- `auditAssets`
- `previewOnly`
- `exportSafe`

Both live preview and export validation now build from this same contract instead of drifting through separate implicit rules.

### Honest asset audit

The asset audit now runs against the source model and classifies relative assets into:

- `resolved`
- `baseUrlDependent`
- `unresolved`

This fixes the previous blind spot where already-rewritten `blob:` URLs could hide what the original document really depended on.

### Export validation preview

Export validation now:

- uses the same asset-resolution rules as live preview
- captures the same audit categories
- reports the outcome in the validation flow
- keeps export output free of preview-only editor artifacts

## Validation notes

Validated with browser automation for:

- plain HTML without assets
- `manualBaseUrl`
- relative CSS/image/video references
- asset-directory resolution
- CSS `url(...)`
- `srcset`
- `poster`
- `<source src>`
- live preview vs validation preview asset snapshot parity

## Remaining issues

- no screenshot diff yet
- no integrated release command yet
- slide runtime timing still needs cleanup outside asset parity

## Tag note

The repository already contains `v0.13.1`. If a new annotated tag must point to a new commit for this exact pass, the existing tag has to be intentionally updated after commit selection.
