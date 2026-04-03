# v0.18.1 release sync report

## Scope

- patch-release sync only
- no feature behavior change intended in this pass
- active runtime renamed to semver-tagged artifact
- source-of-truth docs, release docs, and local agent instructions synchronized

## Delivered changes

### Release surface sync

- active runtime renamed to `editor/presentation-editor-v0.18.1.html`
- previous runtime archived to `docs/history/presentation-editor-v0.18.0.html`
- `package.json` version aligned to `0.18.1`
- harness/tooling targets updated in Playwright config, helpers, smoke spec, and asset-parity script

### Documentation sync

- added missing release history for `0.17.0` and `0.18.0` to `docs/CHANGELOG.md`
- updated `PROJECT_SUMMARY`, `ROADMAP_NEXT`, `SOURCE_OF_TRUTH`, `REMAINING_ISSUES`, and `TESTING_STRATEGY`
- updated latest audit docs that are still used as active validation references
- added fresh `remaining-issues-after-0.18.1.md` and `validation-notes-0.18.1.md`

### Agent and skill sync

- updated local agents and project skills to reference the live runtime path
- removed stale line-number guidance from the GitHub skill in favor of symbol-first search guidance
- added explicit release-discipline rules for semver runtime naming and docs/history archiving

## Non-goals

- no architecture rewrite
- no new interaction features
- no replay of historical validation notes from `0.12.x` to `0.13.x`; those remain preserved as time-specific records

## Expected result

- release metadata, runtime filename, docs, and local Copilot instructions now point to one consistent repository truth

## Validation executed

- `npx playwright test tests/playwright/specs/shell.smoke.spec.js --project=chromium-desktop --reporter=line`
	Result: `13 passed / 3 skipped`
- `npm run test:asset-parity`
	Result: `ok: true`