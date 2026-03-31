# Validation notes 0.12.1

## Environment used

- local static server: `python -m http.server 4173`
- browser validation via Playwright against `http://127.0.0.1:4173/editor/presentation-editor-v12.html`

## What was actually verified

### 1. Empty-state recovery path

- page opened successfully
- autosave recovery prompt was handled
- `Open HTML` in the empty preview state was clickable after the overlay fix

### 2. Load and bridge startup

- loaded a two-slide HTML deck from the text modal
- iframe preview initialized successfully
- bridge reached ready state
- browser console had `0` runtime errors after the bridge serialization fix

### 3. Slide activation flow

- switched to Edit mode
- navigated from slide 1 to slide 2 and back
- shell active slide state matched runtime preview state

### 4. Element selection and direct manipulation

- selected an image on slide 2 from inside the iframe
- selected an absolutely positioned card on slide 1
- dragged the card through the shell overlay
- verified computed movement from `left: 120px; top: 180px` to `left: 200px; top: 230px`

### 5. Clean export smoke test

- called `buildCleanExportPackage()` in the running page
- verified exported HTML does not contain:
  - `__presentation_editor_bridge__`
  - `data-editor-node-id`
  - `data-editor-slide-id`
  - `data-editor-preview-base`
- verified moved absolute coordinates are preserved in exported HTML

### 6. Asset audit state check

- with `manualBaseUrl` injected during runtime evaluation:
  - `unresolvedPreviewAssets = 0`
  - `baseUrlDependentAssets = 1`

## What was not verified

- file-upload flow from the local filesystem
- full end-to-end browser download of exported HTML
- responsive sweep on all target widths
- light/dark visual sweep
- transformed / nested / zoom-heavy direct manipulation cases
- touch and trackpad interaction
- manual base-URL UI messaging path as a full browser flow

## Audit note

This validation file remains intentionally narrow.
It proves the specific smoke paths that were executed, but it is not a release sign-off for v13 scope.
The v13 plan assumes additional verification is mandatory before any `0.13.0` tag.
