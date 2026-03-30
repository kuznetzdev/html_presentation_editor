# Validation notes 0.13.1

## Environment used

- local static server: `python -m http.server 4173`
- browser validation via Playwright against `http://127.0.0.1:4173/editor/presentation-editor-v12.html`
- restored autosaved two-slide deck from the in-app recovery banner before QA

## What was actually verified

### 1. Responsive shell sweep

Verified widths:
- `390`
- `640`
- `820`
- `1100`
- `1280`
- `1440`

Verified invariants:
- no horizontal overflow
- topbar stays inside viewport and matches measured shell offset
- left/right drawers stay inside viewport on compact shell
- insert palette stays inside viewport
- slide-template bar stays inside viewport
- context menu stays inside viewport
- floating toolbar stays inside viewport
- mobile rail stays inside viewport and matches measured rail offset
- no visible button drifts outside the viewport

### 2. Light / dark shell pass

Verified themes:
- `light`
- `dark`

Verified widths:
- `390`
- `1100`
- `1440`

Verified invariants:
- theme state switches correctly through `setThemePreference()`
- topbar remains stable in both themes
- insert palette remains inside viewport in both themes
- floating toolbar remains inside viewport in both themes

### 3. Keyboard basics

Verified:
- `Escape` closes insert palette
- `Escape` closes slide-template bar
- `Escape` closes context menu
- topbar tab order smoke test works from `openHtmlBtn -> exportBtn -> toggleSlideTemplateBarBtn`
- narrow-width tab smoke test lands on visible topbar actions instead of hidden shell controls

### 4. Browser console

Observed console state after the pass:
- no editor runtime errors
- one static-server-only error remained: missing `favicon.ico` (`404`)

## What was not verified

- file-upload flow from the local filesystem
- end-to-end browser download of exported HTML
- touch / trackpad interaction
- transformed / nested / zoom-heavy direct manipulation cases
- automated cross-browser matrix beyond the current Playwright pass

## Release note

This validation file is a release smoke log for `0.13.1`.
It signs off the shell-hardening scope only; it does not claim that asset parity or complex direct manipulation are fully solved.
