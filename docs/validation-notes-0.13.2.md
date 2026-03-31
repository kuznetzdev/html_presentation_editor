# Validation notes 0.13.2

## Environment used

- repo-local Playwright harness via `npx playwright test`
- auto-served editor runtime via `node scripts/static-server.js . 4173 127.0.0.1`
- browser target: `http://127.0.0.1:4173/editor/presentation-editor-v12.html`
- reports written under `artifacts/playwright/html-report` and `artifacts/playwright/results.json`
- traces/videos/screenshots retained under `artifacts/playwright/test-results` on failures

## What was verified in this pass

### 1. Manual-base parity between live preview and export-validation preview

Covered in Playwright:

- load HTML fixture with relative assets and explicit `manualBaseUrl`
- compare live iframe references against preview package and export-validation package
- assert the rendered-output contract carries the active manual base URL
- assert export-validation output keeps editor chrome stripped

### 2. Compact-width export-validation UX path

Covered in Playwright:

- desktop path through `#validateExportBtn`
- compact path through `#exportBtn` followed by the visible toast action `Открыть проверку`
- widths exercised in Chromium: `390`, `640`, `820`, `1100`, `1280`, `1440`

### 3. Full active suite stayed green after stage A

Commands:

- `npx playwright test --grep "@stage-a"`
- `npx playwright test`

Observed results:

- stage A suite: `12 passed`, `4 skipped`
- full active suite: `34 passed`, `70 skipped`

## Scope intentionally left for later stages

- deterministic slide activation (`@stage-b`)
- direct manipulation support envelope (`@stage-c`)
- truthful connected-asset diagnostics (`@stage-d`)
- drawer focus isolation and compact shell hardening (`@stage-e`)
- structure cleanup (`@stage-f`)
- visual/system polish (`@stage-g`)
