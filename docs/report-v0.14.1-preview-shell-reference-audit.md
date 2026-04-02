# v0.14.1 preview shell + reference audit report

## Scope

- Visual direction: `Editorial Summary`
- Coverage mode: `Every Deck Deep`
- Runtime contract kept intact: existing `parent shell + iframe + bridge + modelDoc`
- Runtime shell surface changes stayed inside existing `preview-note` / `preview-shell`
- Validation target: full reference-deck sweep across `22` decks from `references_pres`

## Accepted visual hierarchy

- `preview-note` now behaves as a session header for loaded preview, not as a floating utility strip.
- Hierarchy is explicit: `status summary -> active slide context -> action cluster`.
- Copy density is reduced in loaded states: helper text is short, status-first, and does not compete with the canvas.
- Primary/secondary weight contract is normalized: one clear primary CTA, secondary shell controls in neutral/outline weight, pills stay informational.
- `preview-stage` remains the dominant surface in both light and dark themes.
- Light/dark parity stays on existing semantic tokens; no parallel theme-specific shell path was introduced.

## Delivered changes

### Runtime shell pass

- Updated [`editor/presentation-editor-v12.html`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\editor\presentation-editor-v12.html) to:
- tighten `preview-note` copy and line-length contract
- promote status summary and active slide context above shell actions
- keep `preview-shell` and `preview-stage` geometry stable across desktop and intermediate shell widths
- refresh editorial-summary snapshots for light and dark states

### Reference registry and loader

- Added [`tests/playwright/helpers/referenceDeckRegistry.js`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\tests\playwright\helpers\referenceDeckRegistry.js)
- Added [`loadReferenceDeck(page, caseId, options)`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\tests\playwright\helpers\editorApp.js)
- Replaced broken hardcoded `references_pres` constants in [`tests/playwright/specs/editor.regression.spec.js`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\tests\playwright\specs\editor.regression.spec.js)
- Added dedicated exhaustive suite [`tests/playwright/specs/reference-decks.deep.spec.js`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\tests\playwright\specs\reference-decks.deep.spec.js)

### Stability fixes discovered during audit

- Authored slide duplication now claims unique `data-slide-id` values during duplicate/template flows.
- SVG and fragment selection scoring now prefers honest object-level selection instead of collapsing to parents.
- Compact-shell/touch regression helpers were hardened for inspector, slide-root, and breadcrumb paths.
- Table-cell undo on `chromium-mobile-640` was fixed by removing duplicate immediate snapshots from `table-cell` `element-updated(commit)` and letting authoritative `document-sync(text-edit-commit)` own the history snapshot.

## Deck inventory and capability taxonomy

### Family summary

| family | deck count | manualBaseUrl |
| --- | ---: | --- |
| `v1` | 15 | `/references_pres/html-presentation-examples_v1/` |
| `v2` | 7 | `/references_pres/html-presentation-examples_v2/examples/` |

### Capability taxonomy

- Layout-heavy: `absolute`, `layout-containers`, `stress-layout`, `positioning`, `overlap`
- Text/runtime semantics: `authored-markers`, `data-attributes`, `semantic-css`, `sections`, `minimal`
- Interactive/stateful: `fragments`, `reveal`, `scroll-snap`, `data-driven`, `web-components`
- Rich content: `tables`, `table-ops`, `code-blocks`, `svg`, `mixed-media`, `relative-assets`
- Theme/runtime parity: `css-variables`, `dark-theme`, `theme`, `asset-parity`

### Per-deck result matrix

Legend:

- `deep` = full required matrix on `chromium-desktop` and `chromium-shell-1100`
- `compact` = load + shell-surface + compact-drawer + no-overflow matrix on `chromium-mobile-390`

| id | family | capabilities | desktop | shell-1100 | mobile-390 | notes |
| --- | --- | --- | --- | --- | --- | --- |
| `v1-minimal-inline` | `v1` | `inline-styles`, `minimal`, `text` | pass | pass | pass | baseline text deck |
| `v1-semantic-css` | `v1` | `sections`, `semantic-css`, `text` | pass | pass | pass | semantic section import path |
| `v1-absolute-positioned` | `v1` | `absolute`, `layers`, `positioning` | pass | pass | pass | drag/resize or blocked-state asserted |
| `v1-data-attributes-editorish` | `v1` | `authored-markers`, `data-attributes`, `text` | pass | pass | pass | author marker contract preserved |
| `v1-css-variables-theme` | `v1` | `css-variables`, `dark-theme`, `theme` | pass | pass | pass | theme parity exercised |
| `v1-animated-fragments` | `v1` | `animation`, `fragments`, `stateful` | pass | pass | pass | fragment/runtime-truth roundtrip |
| `v1-svg-heavy` | `v1` | `graphics`, `svg` | pass | pass | pass | svg selection honesty kept |
| `v1-table-and-report` | `v1` | `dense-content`, `lists`, `tables` | pass | pass | pass | table edit and structural ops |
| `v1-mixed-media` | `v1` | `code`, `media`, `mixed-media` | pass | pass | pass | code + media path |
| `v1-author-marker-contract` | `v1` | `authored-markers`, `marker-contract`, `text` | pass | pass | pass | author marker persistence |
| `v1-stress-nested-layout` | `v1` | `layout-containers`, `nested-dom`, `stress-layout` | pass | pass | pass | nested layout stress path |
| `v1-selection-engine-v2` | `v1` | `overlap`, `positioning`, `selection-engine` | pass | pass | pass | overlap/ancestor honesty retained |
| `v1-layout-containers-v1` | `v1` | `absolute`, `layout-containers`, `flow` | pass | pass | pass | safe direct-manip or blocked-state |
| `v1-tables-v1` | `v1` | `table-ops`, `tables` | pass | pass | pass | table-cell edit/undo/export roundtrip |
| `v1-code-blocks-v1` | `v1` | `code-blocks`, `whitespace` | pass | pass | pass | whitespace-safe code roundtrip |
| `v2-basic-static-inline` | `v2` | `inline-styles`, `text` | pass | pass | pass | baseline v2 load path |
| `v2-semantic-sections-classes` | `v2` | `sections`, `semantic-css`, `text` | pass | pass | pass | semantic v2 structure |
| `v2-scroll-snap-deck` | `v2` | `scroll-snap`, `stateful-layout` | pass | pass | pass | runtime-truth checked |
| `v2-data-driven-rendered` | `v2` | `data-driven`, `runtime-generated` | pass | pass | pass | inline text edit logged `not-applicable`; runtime roundtrip passed |
| `v2-web-components-deck` | `v2` | `custom-elements`, `web-components` | pass | pass | pass | keyboard text edit logged `blocked`; runtime-truth/custom-elements path passed |
| `v2-reveal-compatible-markup` | `v2` | `fragments`, `nested-sections`, `reveal` | pass | pass | pass | fragment/reveal roundtrip passed |
| `v2-relative-assets-multi-file` | `v2` | `asset-parity`, `multi-file`, `relative-assets` | pass | pass | pass | `manualBaseUrl` and resolved assets verified |

## Explicit not-applicable and blocked outcomes

- `v2-data-driven-rendered`: stable inline text commit/cancel is `not-applicable` because the deck is runtime-generated and does not expose a stable author-time text marker contract.
- `v2-web-components-deck`: keyboard-driven inline text edit is `blocked` because the custom-element runtime does not expose a stable preview marker/focus contract; runtime-truth roundtrip remains covered and green.
- Compact shell only logs `slide rail kebab menu` as `not-applicable` when the compact breakpoint hides the kebab trigger.
- Overflow shell surface logs `not-applicable` when the overflow trigger is hidden at the current breakpoint.

## Failed / flaky / blocked cases

- Final green run: no failing cases remained.
- Resolved during the pass:
- `chromium-mobile-640` `table cell edits survive undo redo and export reimport roundtrip @stage-l`
- root cause: duplicate immediate history snapshots during `table-cell` text-edit commit
- evidence before fix:
- `artifacts/playwright/test-results/specs-editor.regression-Ed-c1932--reimport-roundtrip-stage-l-chromium-mobile-640/trace.zip`
- `artifacts/playwright/test-results/specs-editor.regression-Ed-c1932--reimport-roundtrip-stage-l-chromium-mobile-640/error-context.md`
- `artifacts/playwright/test-results/specs-editor.regression-Ed-c1932--reimport-roundtrip-stage-l-chromium-mobile-640/test-failed-1.png`
- post-fix evidence:
- targeted `--repeat-each=5` passed cleanly
- final full suite passed cleanly

## Edit-attempt log

| step-id | target | intent | action attempted | result | evidence |
| --- | --- | --- | --- | --- | --- |
| `ps-01` | `preview-note` / `preview-shell` | shift shell toward editorial-summary hierarchy | updated loaded-preview copy, layout weight, and button emphasis in [`editor/presentation-editor-v12.html`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\editor\presentation-editor-v12.html) | accepted | runtime shell path only; no new shell branch |
| `ps-02` | reference deck loading | remove broken hardcoded `references_pres` paths | introduced registry + `loadReferenceDeck(page, caseId, options)` helper | accepted | [`tests/playwright/helpers/referenceDeckRegistry.js`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\tests\playwright\helpers\referenceDeckRegistry.js) |
| `ps-03` | shell visual contract | prove hierarchy and button-weight assertions | added shell hierarchy assertions and editorial-summary snapshots | accepted | [`tests/playwright/specs/shell.smoke.spec.js`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\tests\playwright\specs\shell.smoke.spec.js) |
| `ps-04` | full reference coverage | separate exhaustive sweep from shell smoke | added dedicated `reference-decks.deep.spec.js` suite | accepted | `66` reference runs across three target chromium projects |
| `ps-05` | authored slide duplication | preserve author ids across duplicate/export roundtrip | introduced unique authored slide id claiming in duplicate/template flow | accepted | regression `duplicating authored slides keeps unique author ids across export roundtrip @stage-h` |
| `ps-06` | svg / fragment selection | keep honest object-level selection | adjusted selection scoring to prefer `svg` and `fragment` leaves | accepted | stage-g/regression selection paths green |
| `ps-07` | compact touch shell | stabilize mobile inspector, slide-root, breadcrumb paths | hardened helper/test routes for touch-only flows | accepted | mobile regression paths green |
| `ps-08` | `chromium-mobile-640` stage-l | inspect residual full-suite failure | reran full suite and captured failing trace/screenshot for table-cell undo | failed | `artifacts/playwright/test-results/specs-editor.regression-Ed-c1932--reimport-roundtrip-stage-l-chromium-mobile-640/trace.zip` |
| `ps-09` | `chromium-mobile-640` stage-l | confirm whether failure is reproducible | ran targeted `--repeat-each=5` | failed reproducibly | `2/5` failures on pre-fix repeat run |
| `ps-10` | bridge history contract | remove duplicate commit snapshot on table-cell commit | patched `applyElementUpdateFromBridge` to skip immediate snapshot for `table-cell` commit and rely on slide-sync snapshot | accepted | [`editor/presentation-editor-v12.html`](C:\Users\Kuznetz\Desktop\proga\html_presentation_editor\editor\presentation-editor-v12.html) |
| `ps-11` | `chromium-mobile-640` stage-l | verify race is removed | reran targeted `--repeat-each=5` | accepted | `5 passed (15.2s)` |
| `ps-12` | full repo validation | close plan with current evidence | reran `reference-decks.deep`, `test:asset-parity`, and full `npx playwright test` | accepted | final results in command ledger below |

## Final command evidence

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
- Generated artifacts:
- `artifacts/playwright/html-report`
- `artifacts/playwright/results.json`
- failure-era traces retained under `artifacts/playwright/test-results/...stage-l-chromium-mobile-640*`
