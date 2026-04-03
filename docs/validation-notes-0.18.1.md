# Validation notes 0.18.1

## Environment used

- repo-local Playwright harness via `npx playwright test`
- auto-served editor runtime via `node scripts/static-server.js . 4173 127.0.0.1`
- browser target: `http://127.0.0.1:4173/editor/presentation-editor-v0.18.1.html`
- reports written under `artifacts/playwright/html-report` and `artifacts/playwright/results.json`
- traces/videos/screenshots retained under `artifacts/playwright/test-results` on failures

## What was verified in this pass

### 1. Runtime path rename stays compatible with the active shell harness

Covered in Playwright:

- `npx playwright test tests/playwright/specs/shell.smoke.spec.js --project=chromium-desktop --reporter=line`
- the shell harness still boots against the semver-tagged runtime file
- empty-state, preview, and shell workflow smoke assertions still pass after the runtime rename
- observed result: `13 passed / 3 skipped`

### 2. Export/preview asset tooling still resolves the active runtime path

Covered by script:

- `npm run test:asset-parity`
- the export-asset parity script now targets `presentation-editor-v0.18.1.html` and stays green
- observed result: `ok: true`

## Scope intentionally left for later stages

- full Gate B/C/D reruns were not repeated for this docs-and-release-sync patch because runtime behavior did not change
- smart layer resolution / magic select remains future work after the shipped overlap and layers systems
- responsibility-based cleanup inside the large editor file remains deferred