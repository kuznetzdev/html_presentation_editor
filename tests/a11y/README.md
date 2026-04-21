# tests/a11y — Accessibility Gate

Automated WCAG 2.1 AA accessibility gate for the HTML Presentation Editor shell.
Uses `@axe-core/playwright` to run axe-core scans inside Playwright browser sessions.

## Scope

- **In contract:** The editor shell document (topbar, slide rail, inspector panel, modals, overlays).
- **Out of contract:** `#previewFrame` (the iframe that renders the HTML presentation deck). Deck content is excluded from every scan — it is user-supplied HTML with no a11y guarantees.

## Running the gate

```bash
# Recommended: start the static server first (or rely on Playwright webServer),
# then run the a11y gate
PLAYWRIGHT_TEST_SERVER_PORT=41735 npm run test:gate-a11y

# Or run directly via npx
PLAYWRIGHT_TEST_SERVER_PORT=41735 npx playwright test tests/a11y/ --project=chromium-desktop --config playwright.a11y.config.js
```

The a11y gate uses `playwright.a11y.config.js` (separate from `playwright.config.js`) with `reuseExistingServer: true` so it can run alongside Gate-A without port conflicts.

## Test structure

`shell-a11y.spec.js` contains exactly 3 tests — one per `data-editor-workflow` state:

| Test | Workflow state | How reached |
|------|---------------|-------------|
| empty | `data-editor-workflow="empty"` | Fresh editor load, no deck open |
| loaded-preview | `data-editor-workflow="loaded-preview"` | After deck load, before edit mode |
| loaded-edit | `data-editor-workflow="loaded-edit"` | After deck load + switch to edit mode |

Each test:
1. Navigates to the desired state
2. Asserts `data-editor-workflow` value
3. Calls `runAxeScanShellOnly(page)` from `helpers/axe-harness.js`
4. Expects `results.violations` to have length 0

## Triage flow

When a violation is found:
1. The test logs `[a11y] state=X — N violation(s)` to stdout with rule ID and description.
2. If the violation is a known false-positive or requires deferred fix, add it to `tests/a11y/known-violations.md`.
3. Wrap the test assertion with `test.fail()` and a `TODO:` comment referencing the work order.
4. File a work order to fix the violation before v1.0.

### Example triage entry (known-violations.md)

```md
## color-contrast (loaded-preview)

**Rule:** color-contrast
**Impact:** serious
**State:** loaded-preview
**Description:** Interactive element foreground/background contrast ratio below 4.5:1
**Element:** .status-pill.save-pill
**Status:** tracked in WO-NN — pending design token update
**Added:** 2026-04-21
```

## Adding new tests

1. Create a new spec file in `tests/a11y/` (e.g. `keyboard-nav.spec.js`).
2. Import helpers from `./helpers/axe-harness.js` or `../playwright/helpers/editorApp.js`.
3. The new spec is automatically picked up by `test:gate-a11y` (testDir is `tests/a11y/`).
4. Document the new spec in this README.

## Planned next steps

| WO | Scope |
|----|-------|
| WO-10 | Keyboard navigation: tab order, focus management, Escape/Enter/Space contracts |
| WO-11 | Contrast: design token light/dark contrast ratio assertions (automated) |
| ADR-007 | Visual regression gate companion |

## Helpers

### `helpers/axe-harness.js`

Exports `runAxeScanShellOnly(page, opts)`:
- Runs axe-core with `wcag2a` + `wcag2aa` rule tags.
- Excludes `#previewFrame` from the scan context.
- Returns the full `AxeResults` object (use `.violations` for assertion).
