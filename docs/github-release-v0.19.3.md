# GitHub Release Body: v0.19.3

## Tag

`v0.19.3`

## Title

`v0.19.3`

## Summary

- promoted the active runtime to `editor/presentation-editor-v0.19.3.html`
- simplified the first-run repo entrypoint by removing the redundant `start:open` alias
- reduced launchpad noise by demoting the compatibility redirect from a primary CTA
- corrected the supported-release wording in `SECURITY.md`

## Details

- the canonical editor runtime is now `editor/presentation-editor-v0.19.3.html`
- the previous active runtime was archived to `docs/history/presentation-editor-v0.19.2.html`
- `editor/presentation-editor.html` remains a compatibility shim and now forwards to `v0.19.3`
- `npm start` remains the single human-first local entrypoint
- Playwright harness, asset-parity tooling, local skills, and docs were synchronized to the current semver runtime

## Verification

- `npx playwright test tests/playwright/specs/shell.smoke.spec.js --project=chromium-desktop --grep "root launchpad routes first-time user to the active editor runtime"`
- `npm run test:asset-parity`

## Compare

- [v0.19.2...v0.19.3](https://github.com/kuznetzdev/html_presentation_editor/compare/v0.19.2...v0.19.3)
