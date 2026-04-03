# Validation notes 0.14.1 preview shell + reference audit

## Environment used

- repo-local Playwright harness via `npx playwright test`
- editor runtime served at `http://127.0.0.1:4173/editor/presentation-editor-v0.18.1.html`
- exhaustive reference fixtures loaded from `references_pres`
- primary reports and traces written under:
- `artifacts/playwright/html-report`
- `artifacts/playwright/results.json`
- `artifacts/playwright/test-results`

## Final status

- Preview shell visual pass accepted under the `Editorial Summary` direction.
- Reference registry covers all `22` target decks.
- Fresh exhaustive sweep across `chromium-desktop`, `chromium-shell-1100`, and `chromium-mobile-390` is green.
- `npm run test:asset-parity` is green.
- Final full `npx playwright test` is green: `370 passed / 278 skipped / 0 failed`.

## Microstage log

| step-id | target | intent | action attempted | result | evidence |
| --- | --- | --- | --- | --- | --- |
| `va-01` | `editor/presentation-editor-v0.18.1.html` | apply editorial-summary hierarchy without architecture drift | reworked `preview-note` / `preview-shell` copy density, hierarchy, and button emphasis | passed | runtime shell remained `parent shell + iframe + bridge + modelDoc` |
| `va-02` | reference deck path contract | replace broken root constants with explicit registry | added registry entries with `id`, `family`, `relativePath`, `fixturePath`, `manualBaseUrl`, `capabilities` | passed | [`tests/playwright/helpers/referenceDeckRegistry.js`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\tests\playwright\helpers\referenceDeckRegistry.js) |
| `va-03` | regression import path | stop using nonexistent root-level `references_pres` constants | migrated regression/spec helper loading to registry IDs | passed | previous `ENOENT` path regression removed |
| `va-04` | shell contract | assert summary/actions separation and button-weight hierarchy | updated shell smoke assertions and refreshed editorial-summary snapshots | passed | [`tests/playwright/specs/shell.smoke.spec.js`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\tests\playwright\specs\shell.smoke.spec.js) and snapshot files under `tests/playwright/specs/shell.smoke.spec.js-snapshots/` |
| `va-05` | exhaustive reference validation | run full deck matrix on target chromium projects | `npx playwright test tests/playwright/specs/reference-decks.deep.spec.js --project=chromium-desktop --project=chromium-shell-1100 --project=chromium-mobile-390` | passed | `66 passed (7.8m)` |
| `va-06` | asset parity | verify shell/reference work did not drift export/preview asset rules | `npm run test:asset-parity` | passed | `ok: true`; `asset-directory` case resolved `9/9` assets in both preview and validation |
| `va-07` | full repository suite | check for regressions after shell + registry work | `npx playwright test` | failed | `369 passed / 278 skipped / 1 failed`; failing path: `chromium-mobile-640 @stage-l`; trace at `artifacts/playwright/test-results/specs-editor.regression-Ed-c1932--reimport-roundtrip-stage-l-chromium-mobile-640/trace.zip` |
| `va-08` | `chromium-mobile-640 @stage-l` | distinguish flake from real race | `npx playwright test tests/playwright/specs/editor.regression.spec.js --project=chromium-mobile-640 --grep "table cell edits survive undo redo and export reimport roundtrip" --repeat-each=5` | failed | `2 failed / 3 passed`; failure retained at `...stage-l-chromium-mobile-640-repeat2/trace.zip` |
| `va-09` | table-cell history path | remove duplicate edited snapshot before undo | patched `applyElementUpdateFromBridge` to skip immediate snapshot for `table-cell` `editLifecycle=commit` and let `document-sync(text-edit-commit)` own the authoritative snapshot | passed | [`editor/presentation-editor-v0.18.1.html`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\editor\presentation-editor-v0.18.1.html) |
| `va-10` | `chromium-mobile-640 @stage-l` | prove race is gone | reran `--repeat-each=5` targeted stage-l repro | passed | `5 passed (15.2s)` |
| `va-11` | final repository suite | validate after runtime fix | reran `npx playwright test` | passed | `370 passed / 278 skipped / 0 failed (17.8m)` |
| `va-12` | audit deliverables | persist final evidence in repo-visible docs | authored report and validation notes | passed | this file + `docs/report-v0.14.1-preview-shell-reference-audit.md` |

## Deck coverage notes

- `22` decks are now loaded only through registry-backed IDs.
- `15` decks belong to `v1`.
- `7` decks belong to `v2`.
- Every deck ran the mandatory shell matrix.
- `chromium-desktop` and `chromium-shell-1100` ran the deep interaction matrix.
- `chromium-mobile-390` ran the compact-shell matrix.
- Explicit capability gaps were logged, not silently skipped:
- `v2-data-driven-rendered`: inline text edit `not-applicable`
- `v2-web-components-deck`: keyboard text edit `blocked`, runtime-truth roundtrip still covered

## Final command ledger

- `npx playwright test tests/playwright/specs/editor.regression.spec.js --project=chromium-desktop --grep "text edit, image replace, and block insertion stay functional"`
  Result: `1 passed`
- `npx playwright test tests/playwright/specs/reference-decks.deep.spec.js --project=chromium-desktop --project=chromium-shell-1100 --project=chromium-mobile-390`
  Result: `66 passed`
- `npm run test:asset-parity`
  Result: `ok: true`
- `npx playwright test tests/playwright/specs/editor.regression.spec.js --project=chromium-mobile-640 --grep "table cell edits survive undo redo and export reimport roundtrip" --repeat-each=5`
  Result after fix: `5 passed`
- `npx playwright test`
  Result: `370 passed`, `278 skipped`, `0 failed`

## Residual risks

- No open failing regression remained at the end of the pass.
- The deepest cost center is still `reference-decks.deep.spec.js`; it is correct but slow and dominates end-to-end runtime on desktop, shell-1100, and mobile-390.
- Existing skip matrix remains intentional and project-gated; skipped cases are not part of this audit’s chromium target contract.
