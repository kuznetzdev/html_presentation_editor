# Validation notes 0.13.1

## Environment used

- local static server: `python -m http.server 4173`
- browser validation via `[$playwright-skill](C:\Users\Kuznetz\.codex\skills\playwright-skill\SKILL.md)` against `http://127.0.0.1:4173/editor/presentation-editor-v12.html`
- repo-local validator: [scripts/validate-export-asset-parity.js](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\scripts\validate-export-asset-parity.js)

## What was verified in this pass

### 1. Live preview and export-validation now share one asset/base contract

Verified through the same rendered-output pipeline:

- `baseHref`
- relative `src` / `href` / `poster`
- `srcset`
- inline `style` with `url(...)`
- `<style>` blocks with `url(...)`
- asset-directory object-URL rewrites
- preview-only vs export-safe output modes

### 2. Validation scenarios covered

Covered with browser automation:

- plain HTML without assets
- HTML + `manualBaseUrl`
- HTML + relative CSS / image / video references
- HTML + connected asset directory
- CSS `url(...)`
- `srcset`
- `poster`
- `<source src>`
- live preview vs validation preview asset snapshot comparison

### 3. Honest validation audit

The validation flow now surfaces three buckets from the same source document:

- `resolved`
- `base-url`
- `unresolved`

This prevents false confidence from looking only at a rewritten preview DOM after `blob:` rewrites.

## What remains outside this sign-off

- browser download of the final exported HTML file as a user-triggered download
- playback validity of placeholder video fixtures
- cross-browser matrix beyond the current Playwright pass
- deeper transformed-direct-manipulation geometry cases unrelated to asset parity

## Release note

This validation note signs off the `0.13.1` asset/base-resolution parity scope for:

- live preview
- export validation preview
- shared asset resolution audit
