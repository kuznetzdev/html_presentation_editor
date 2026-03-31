# Validation notes 0.13.4

## Environment used

- repo-local Playwright harness via `npx playwright test`
- auto-served editor runtime via `node scripts/static-server.js . 4173 127.0.0.1`
- browser target: `http://127.0.0.1:4173/editor/presentation-editor-v12.html`
- reports written under `artifacts/playwright/html-report` and `artifacts/playwright/results.json`
- traces/videos/screenshots retained under `artifacts/playwright/test-results` on failures

## What was verified in this pass

### 1. Direct-manipulation coordinate envelope

Covered in Playwright:

- text edit remains functional before manipulation checks
- image replace works through the inspector upload path
- block, image, video, and layout insertion work through the real insert palette on desktop and compact widths
- keyboard nudge moves a safe `absolute` node
- keyboard nudge moves a safe `fixed` node
- keyboard nudge moves a safe nested `absolute` node inside a positioned parent
- keyboard nudge keeps unsafe transformed nodes blocked and exposes the diagnostic reason instead of mutating coordinates

### 2. Visual baseline stayed aligned with the expanded fixture deck

Covered in Playwright:

- `npx playwright test tests/playwright/specs/visual.spec.js`
- loaded-shell baselines were refreshed only for Chromium desktop and wide projects because the Stage C fixture intentionally added positioned regression content

### 3. Full active suite stayed green after Stage C

Commands:

- `npx playwright test --grep "@stage-c"`
- `npx playwright test tests/playwright/specs/visual.spec.js`
- `npx playwright test`

Observed results:

- stage C suite: `18 passed`, `6 skipped`
- visual suite: `6 passed`, `10 skipped`
- full active suite: `64 passed`, `40 skipped`

## Scope intentionally left for later stages

- truthful connected-asset diagnostics (`@stage-d`)
- drawer focus isolation and compact shell hardening (`@stage-e`)
- structure cleanup (`@stage-f`)
- visual/system polish beyond fixture-driven baseline refresh (`@stage-g`)
