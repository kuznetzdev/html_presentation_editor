# Validation notes 0.13.6

## Environment used

- repo-local Playwright harness via `npx playwright test`
- auto-served editor runtime via `node scripts/static-server.js . 4173 127.0.0.1`
- browser target: `http://127.0.0.1:4173/editor/presentation-editor-v12.html`
- reports written under `artifacts/playwright/html-report` and `artifacts/playwright/results.json`
- traces/videos/screenshots retained under `artifacts/playwright/test-results` on failures

## What was verified in this pass

### 1. Compact-shell drawers now close through the real backdrop hit-area

Covered in Playwright:

- `npx playwright test --grep "@stage-e"`
- the Stage E shell smoke gate now runs on the signed-off narrow Chromium widths instead of remaining a placeholder
- opening the slides or inspector drawer and tapping the visible backdrop closes the drawer cleanly on `390 / 640 / 820`
- hidden drawers stay out of the focus order after close, and shell geometry stays within the existing harness limits

### 2. Full active suite stayed green after Stage E activation

Commands:

- `npx playwright test --grep "@stage-e"`
- `npx playwright test`

Observed results:

- stage E suite: `3 passed`, `5 skipped`
- full active suite: `73 passed`, `31 skipped`

## Scope intentionally left for later stages

- responsibility-based cleanup inside the large editor file (`@stage-f`)
- visual/system polish after correctness gates stay locked (`@stage-g`)
- deeper remote/manual-base asset uncertainty beyond the connected-directory sign-off path
