# ADR-006: Accessibility CI Gate

**Status**: Proposed  
**Phase**: v0.27.1  
**Owner**: Agent D (a11y+visual-regression worktree)

---

## Context

No automated accessibility checks exist in the test suite. Since v0.20.0 (CSS design system),
new surfaces (overlap banners, layer picker, block reason banners, action hints) have been added
without a11y verification. Known gaps:
- Keyboard focus order through topbar, rail, and inspector is untested
- WCAG AA contrast ratios for new banner surfaces are unverified
- Screen reader labels for custom controls (selection handles, floating toolbar) are unknown
- Drag-and-drop rail reorder has no keyboard alternative

The editor targets "all skill levels" — a11y is a correctness requirement, not polish.

---

## Decision

Add `@axe-core/playwright` to devDependencies. Create a new test gate `test:gate-a11y`
with three spec files:

### `tests/a11y/shell-a11y.spec.js`

axe-core scans on shell in each workflow state:
- `data-editor-workflow="empty"` — before deck load
- `data-editor-workflow="loaded-preview"` — after load, before edit
- `data-editor-workflow="loaded-edit"` — after first click into edit mode

Each scan: `await checkA11y(page, null, { runOnly: ["wcag2a", "wcag2aa"] })`.
Violations → test failure with detailed report.

### `tests/a11y/keyboard-nav.spec.js`

Tab-only navigation coverage:
- Tab from address bar → reaches first interactive topbar control
- Shift+Tab cycles back
- Enter/Space activates buttons and toggles
- Escape closes transient surfaces (context menu, layer picker, insert palette)
- Arrow keys navigate within breadcrumb trail

### `tests/a11y/contrast.spec.js`

Design token contrast assertions:
- Evaluate CSS custom properties in both light and dark themes
- Check `--shell-text` against `--shell-bg` (min ratio 4.5:1 for normal text, 3:1 for large)
- Check new banner foreground/background pairs

### Package changes

```json
// package.json (devDependencies)
"@axe-core/playwright": "^4.9.0"

// scripts
"test:gate-a11y": "playwright test tests/a11y/"
```

### Gate integration

`test:gate-a11y` runs independently — not blocking Gate-A baseline (55/5/0 stays unchanged).
Before any v0.27.1 merge, zero axe violations required.

---

## Consequences

**Positive:**
- Systematic coverage of all workflow states
- axe-core catches DOM-level issues (missing `aria-label`, role mismatches, focus traps)
- Contrast test is automated — no manual visual check needed
- Gate is additive — does not change Gate-A baseline

**Negative:**
- Some axe violations may be in presentation deck content (in iframe) — must configure axe to scan shell only
- `@axe-core/playwright` adds to devDependencies (no runtime impact)
- False positives possible for custom Web Component patterns — need `axe.configure({ rules: {...} })` for known exceptions
- Keyboard test is sensitive to focus management timing — may need `waitForFunction` guards

---

## Alternatives Considered

1. **Manual a11y audit** — rejected: not repeatable, not CI-able, misses regressions
2. **Lighthouse CI** — considered; axe-playwright preferred for Playwright integration and rule granularity
3. **eslint-plugin-jsx-a11y** — not applicable (no JSX in this project)
4. **pa11y** — considered; axe chosen for ecosystem consistency with Playwright

---

## Applied In

- v0.27.1 — `tests/a11y/` directory (3 new spec files)
- devDependency: `@axe-core/playwright`

## Links

- `docs/ROADMAP_NEXT.md` — Phase 5 detail
- `docs/ADR-007-visual-regression-ci-gate.md` — companion gate in v0.28.0
- `docs/ADR-001-block-reason-protocol.md` — banner surfaces to be tested
- `docs/ADR-003-layer-picker-popup.md` — picker keyboard nav to be tested
- `editor/styles/tokens.css` — design tokens for contrast assertions
