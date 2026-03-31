# Validation notes 0.13.5

## Environment used

- repo-local Playwright harness via `npx playwright test`
- auto-served editor runtime via `node scripts/static-server.js . 4173 127.0.0.1`
- browser target: `http://127.0.0.1:4173/editor/presentation-editor-v12.html`
- reports written under `artifacts/playwright/html-report` and `artifacts/playwright/results.json`
- traces/videos/screenshots retained under `artifacts/playwright/test-results` on failures

## What was verified in this pass

### 1. Connected asset-directory diagnostics are now an active gate

Covered in Playwright:

- `npx playwright test --grep "@stage-d"`
- the connected fixture asset directory is mounted through the real browser helper path
- diagnostics stay non-empty and keep reporting truthful asset state after connection instead of falling back to the previous all-zero summary
- the Stage D assertion now runs across the signed-off Chromium width set instead of remaining a placeholder

### 2. Full active suite stayed green after Stage D activation

Commands:

- `npx playwright test --grep "@stage-d"`
- `npx playwright test`

Observed results:

- stage D suite: `6 passed`, `2 skipped`
- full active suite: `70 passed`, `34 skipped`

## Scope intentionally left for later stages

- drawer focus isolation and compact shell hardening (`@stage-e`)
- responsibility-based cleanup inside the large editor file (`@stage-f`)
- visual/system polish after correctness gates stay locked (`@stage-g`)
- deeper remote/manual-base asset uncertainty beyond the connected-directory sign-off path
