# Testing Strategy

## Overview

The HTML Presentation Editor uses a multi-gate Playwright testing strategy to balance speed, coverage, and reliability. All gates must respect the fixed architecture (`parent shell + iframe preview + bridge + modelDoc`) and verify the signed-off product invariants.

## Test Gates

### Gate A: Fast PR Gate (6-12 minutes)

**Purpose**: Catch obvious regressions before code review.

**Projects**: `chromium-desktop` only

**Specs**:
- `shell.smoke.spec.js` — workflow contract (empty/loaded-preview/loaded-edit)
- `click-through.spec.js` — repeated click cycling, Escape reset, context menu layers
- `selection-engine-v2.spec.js` — core selection scenarios (subset)

**Command**:
```bash
npx playwright test tests/playwright/specs/shell.smoke.spec.js tests/playwright/specs/click-through.spec.js tests/playwright/specs/selection-engine-v2.spec.js --project=chromium-desktop
```

**Pass Criteria**: 0 failures, skipped tests allowed.

---

### Gate B: Release Candidate Gate (20-35 minutes)

**Purpose**: Stable release-core verification before release.

**Projects**: `chromium-desktop`, `chromium-shell-1100`

**Specs (chromium-desktop)**:
- `shell.smoke.spec.js`
- `click-through.spec.js`
- `selection-engine-v2.spec.js`
- `layer-navigation.spec.js`
- `editor.regression.spec.js`
- `asset-parity.spec.js`

**Specs (chromium-shell-1100)**:
- `shell.smoke.spec.js`
- `editor.regression.spec.js`
- `asset-parity.spec.js`

**Excluded from Gate B (moved to Gate F)**:
- `reference-decks.deep.spec.js`
- `visual.spec.js`

**Command**:
```bash
npx playwright test tests/playwright/specs/shell.smoke.spec.js tests/playwright/specs/click-through.spec.js tests/playwright/specs/selection-engine-v2.spec.js tests/playwright/specs/layer-navigation.spec.js tests/playwright/specs/editor.regression.spec.js tests/playwright/specs/asset-parity.spec.js --project=chromium-desktop
npx playwright test tests/playwright/specs/shell.smoke.spec.js tests/playwright/specs/editor.regression.spec.js tests/playwright/specs/asset-parity.spec.js --project=chromium-shell-1100
```

**Pass Criteria**: 0 failures across all specs. Skipped tests must be reviewed.

---

### Gate C: Cross-Browser Stability (25-45 minutes)

**Purpose**: Verify behavior parity across browser engines.

**Projects**: `firefox-desktop`, `webkit-desktop`

**Specs**:
- `shell.smoke.spec.js`
- `editor.regression.spec.js` (selection/context menu blocks)
- `click-through.spec.js`
- `selection-engine-v2.spec.js`

**Command**:
```bash
npx playwright test tests/playwright/specs/shell.smoke.spec.js tests/playwright/specs/editor.regression.spec.js tests/playwright/specs/click-through.spec.js tests/playwright/specs/selection-engine-v2.spec.js --project=firefox-desktop --project=webkit-desktop
```

**Pass Criteria**: 0 failures. Known engine-specific issues must be documented.

---

### Gate D: Responsive/Compact Gate (20-30 minutes)

**Purpose**: Prevent compact shell UX regressions.

**Projects**: `chromium-mobile-390`, `chromium-mobile-640`, `chromium-tablet-820`

**Specs**:
- `shell.smoke.spec.js`
- `editor.regression.spec.js` (drawer/toolbar/overflow blocks)

**Command**:
```bash
npx playwright test tests/playwright/specs/shell.smoke.spec.js tests/playwright/specs/editor.regression.spec.js --project=chromium-mobile-390 --project=chromium-mobile-640 --project=chromium-tablet-820
```

**Pass Criteria**: 0 failures on compact-shell scenarios.

---

### Gate E: Export Integrity Gate (5-10 minutes)

**Purpose**: Guarantee clean export and asset parity.

**Projects**: Any (typically `chromium-desktop`)

**Specs**:
- `asset-parity.spec.js`

**Script**:
```bash
npm run test:asset-parity
npx playwright test tests/playwright/specs/asset-parity.spec.js --project=chromium-desktop
```

**Pass Criteria**: Asset parity script exits 0, asset-parity spec passes, no editor attributes in export.

---

### Gate F: Nightly Full Confidence (45-90 minutes)

**Purpose**: Exhaustive multi-project coverage for trend analysis.

**Projects**: All projects in `playwright.config.js`

**Specs**: All specs, including heavy/deep suites:
- `reference-decks.deep.spec.js`
- `visual.spec.js`

**Command**:
```bash
npx playwright test
```

**Pass Criteria**: Track pass/fail/flaky trends. Flaky tests require 3 consecutive failures before quarantine.

---

## Test Stability Rules

### Auto-Retry Expectations
- All Playwright assertions must use auto-retry matchers (`expect(locator).toBeVisible()`, `expect.poll()`) instead of manual waits.
- No `page.waitForTimeout()` or `sleep()` patterns.
- Use `expect.poll()` for evaluating dynamic state from `evaluateEditor()`.

### Flaky Test Protocol
1. Test fails intermittently → mark as flaky candidate
2. Run 3 consecutive times in isolation
3. If all 3 fail → fixed failure, debug immediately
4. If mix of pass/fail → quarantine with `.skip()` and file issue
5. After fix → remove `.skip()`, verify 5 consecutive passes, return to gate

### Skipped Test Policy
- Skipped tests in Gate A: allowed (mark with reason)
- Skipped tests in Gate B: requires review before merge
- Quarantined tests: must have GitHub issue reference

---

## Coverage Map

### Architecture Layers
| Layer | Primary Specs | Coverage |
|-------|--------------|----------|
| Shell workflow | `shell.smoke` | empty/loaded-preview/loaded-edit contract |
| Shell UI | `editor.regression`, `visual` | panels, drawers, overflow, theme |
| Selection engine | `selection-engine-v2`, `layer-navigation` | candidate scoring, ancestor cycling |
| Click-through | `click-through` | repeated click, Escape reset, context menu |
| Bridge protocol | `editor.regression`, `reference-decks.deep` | postMessage sync, command dispatch |
| Export | `asset-parity` | clean HTML, no editor chrome |
| Reference decks | `reference-decks.deep` | real-world deck compatibility |

### Signed-Off Capabilities (must stay green)
- Workflow contract (empty → loaded-preview → loaded-edit)
- Click-through layer cycling (v0.16.0)
- Direct manipulation (safe envelope only)
- Slide structure (create/duplicate/delete/undo/redo)
- Desktop rail drag-and-drop
- Compact drawer hit-area correctness
- Shell theme prepaint (no flash)
- Transient surface mutual exclusion
- Export cleanliness

---

## Integration Points

### Before Merge
- Gate A (required)
- Gate B (required for release branches)
- Gate E (required)

### Before Release Tag
- Gate A + B + C + D + E (all required, sequential or parallel)

### Daily/Nightly
- Gate F (optional, for trend monitoring)

---

## Validation Artifacts

After each release cycle, update:
- `docs/CHANGELOG.md` — release-level changes
- `docs/validation-notes-{version}.md` — gate results, flaky tests, skipped scenarios
- `artifacts/playwright/results.json` — test run summary (generated automatically)
- `artifacts/playwright/html-report/` — visual test report (generated automatically)

---

## Open Questions (as of 2026-04-03)

1. **Version source of truth**: `package.json` shows `0.13.9`, but `CHANGELOG.md` references `0.16.0`. Need to sync before next release.
2. **Skipped test policy for release**: Should any skipped tests block a release, or only failures?
3. **Shell overlay context menu**: Should right-click on selected overlay show full candidate stack (like iframe-origin menu), or is current-selection-only acceptable?
4. **Cross-browser gate frequency**: Should Gate C run on every PR, or only before release?

---

## Metrics to Track

- Total test count per gate
- Pass/fail/skip breakdown
- Runtime per gate (for CI budget planning)
- Flaky test incidence rate
- Coverage delta per release (new scenarios added vs removed)
