## Step 11 — v0.27.1 · Token contrast assertions (WCAG AA, light + dark)

**Window:** W2   **Agent-lane:** B   **Effort:** S
**ADR:** ADR-006   **PAIN-MAP:** P0-14
**Depends on:** WO-09 (harness + npm script already present)   **Unblocks:** none

### Context (3–5 lines)

ADR-006 §3 calls for a contrast spec that asserts WCAG AA ratios (4.5:1 normal text, 3:1 large text) for design-token text/background pairs in both light and dark themes. Without this, PAIN-MAP P0-14 stays open (no a11y gate completeness). This WO adds `tests/a11y/contrast.spec.js` under the harness built by WO-09. Tokens live in `editor/styles/tokens.css`; themes are swapped via the existing `ThemeToggle` path (`editor/src/boot.js` → `setThemePreference`). The spec evaluates computed CSS custom properties in a running page for each theme and computes WCAG-formula contrast ratios in JS (no new runtime dependency).

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `tests/a11y/contrast.spec.js` | new | +180 / −0 |
| `tests/a11y/helpers/contrast-ratio.js` | new | +45 / −0 |
| `docs/CHANGELOG.md` | edit | +2 / −0 |
| `docs/ADR-006-accessibility-ci-gate.md` | edit (Status line) | +0 / −0 net |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/styles/tokens.css` | source of CSS custom properties (`--shell-bg`, `--shell-text`, banner foregrounds, etc.) |
| `editor/styles/banner.css` / `panels.css` / `inspector.css` | banner foreground/background pairings |
| `editor/presentation-editor.html` | location of theme-swap button `#themeToggleBtn` used to flip theme for the spec |
| `editor/src/boot.js` | `setThemePreference` function reference — spec uses the public UI button, but this documents the theme-change side effect |
| `tests/a11y/helpers/axe-harness.js` | created by WO-09, reused for page-open boilerplate |
| `tests/playwright/specs/shell.smoke.spec.js` | theme-swap pattern (lines that toggle theme + wait for marker) |
| `docs/ADR-006-accessibility-ci-gate.md` | normative spec |

### Sub-tasks (executable, each ≤ 2 h)

1. Inspect `editor/styles/tokens.css` and enumerate the foreground/background pairs to assert. Baseline required pairs per ADR-006 §3: (a) `--shell-text` on `--shell-bg`, (b) banner text on banner background (check `#blockReasonBanner` + `#restoreBanner` + future `shellBanner` from ADR-014), (c) topbar button text on topbar background, (d) inspector label on inspector background, (e) rail title on rail background. Enumerate min 5 pairs, max 10 for this WO. Reference: `editor/styles/tokens.css` full. Expected state after: an array of `{ label, fgVar, bgVar, minRatio }` entries ready for the spec.
2. Create `tests/a11y/helpers/contrast-ratio.js` exporting two pure functions: (a) `parseColor(cssColorString)` — accepts `#rgb` / `#rrggbb` / `rgb(r,g,b)` / `rgba(r,g,b,a)` and returns `{ r, g, b }` 0–255 (assume opaque-over-background is computed by caller — this WO uses solid tokens only). (b) `contrastRatio(fg, bg)` — implements WCAG 2.1 formula: relative luminance `L = 0.2126*R + 0.7152*G + 0.0722*B` (after sRGB linearization) → ratio `(lighter+0.05) / (darker+0.05)`. Return number. Expected state after: pure JS helper with zero deps; unit-testable.
3. Create `tests/a11y/contrast.spec.js`. Structure:
   - `describe("Design-token contrast — light theme")` — beforeAll: navigate, ensure theme = light.
   - For each pair in enumerated list: `test(...)` — `const bg = await page.evaluate(v => getComputedStyle(document.documentElement).getPropertyValue(v).trim(), '--shell-bg'); const fg = ...; const ratio = contrastRatio(parseColor(fg), parseColor(bg)); expect(ratio).toBeGreaterThanOrEqual(4.5);`.
   - `describe("Design-token contrast — dark theme")` — beforeAll: click `#themeToggleBtn` until dark is active; assert `body[data-theme="dark"]` or equivalent marker.
   - Same loop.
   Reference: WCAG AA §1.4.3 — 4.5:1 for normal text, 3:1 for text ≥ 18pt or 14pt bold. For banner badges that render at small size, minRatio is 4.5. Expected state after: 2×5 = 10 assertions (or 2×N for N pairs), each ≤ 2 KB spec body.
4. Verify dark-mode theme class marker selector. Inspect `editor/src/boot.js` `setThemePreference` + look at `<body>` attr that changes (most likely `document.documentElement.dataset.theme` or `body.dataset.theme`). Reference: `editor/src/boot.js` (theme function). Expected state after: spec awaits the correct marker.
5. Add npm note — NO new script added. `test:gate-a11y` (from WO-09) already runs `tests/a11y/**`. Confirm by running `npm run test:gate-a11y` after the spec lands; it should include the contrast tests automatically. Expected state after: gate runs with contrast tests without script edits.
6. Handle known exemptions. If any pair currently fails (ADR-006 explicitly permits a triaged list for v0.27.1), mark the test `test.fail()` with a Cyrillic comment explaining which design token pair needs re-tokenization, and file a follow-up entry in `tests/a11y/known-violations.md` (created by WO-09). Do NOT silently pass failing ratios. Expected state after: any failing pair is visibly triaged, not hidden.
7. Run `npm run test:gate-a` — confirm 55/5/0. Run `npm run test:gate-a11y` — verify contrast tests run (green or triaged-fail). Expected state after: both gates reflect the additive tests.
8. Update `docs/CHANGELOG.md` unreleased: `test(a11y): contrast ratio assertions — ADR-006 complete — P0-14`. Expected state after: changelog entry present.
9. Update `docs/ADR-006-accessibility-ci-gate.md` Status line to `Accepted — shell-a11y + keyboard-nav + contrast shipped (v0.27.1)`. Expected state after: ADR fully reflects shipped state.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dep added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A (no CSS changes in this WO)
- [ ] Russian UI-copy strings preserved — N/A (test-only; do not touch shell strings)
- [ ] `test:gate-a11y` stays ADDITIVE — not added to `test:gate-a`. Baseline 55/5/0 unchanged.
- [ ] Contrast helper is pure JS with zero runtime deps (no npm install)
- [ ] Both light AND dark theme pairs asserted — a fail in either theme fails the gate
- [ ] Failing ratios are visibly marked `test.fail()` with triage note, NOT silently skipped

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:gate-a` prints `55 passed, 5 skipped, 0 failed`
- [ ] `tests/a11y/contrast.spec.js` contains at least 5 token pairs × 2 themes = 10 `test()` calls (or a parametrized `.each(table)(...)`)
- [ ] `tests/a11y/helpers/contrast-ratio.js` exports `parseColor` and `contrastRatio` — spec imports both
- [ ] `grep -R 'toBeGreaterThanOrEqual(4.5)' tests/a11y/contrast.spec.js` returns ≥ 5 hits (one per pair)
- [ ] Dark-theme block asserts `document.documentElement.dataset.theme === 'dark'` (or equivalent marker) before running pairs
- [ ] Commit message: `test(a11y): contrast ratio spec — v0.27.1 step 11`
- [ ] ADR-006 Status → Accepted (all three sub-specs shipped)

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Shell text on shell bg — light theme | gate-a11y | `tests/a11y/contrast.spec.js` | N/A | pass (or triaged) |
| Shell text on shell bg — dark theme | gate-a11y | `tests/a11y/contrast.spec.js` | N/A | pass (or triaged) |
| Banner fg on banner bg — both themes | gate-a11y | `tests/a11y/contrast.spec.js` | N/A | pass (or triaged) |
| Topbar button text on topbar bg — both themes | gate-a11y | `tests/a11y/contrast.spec.js` | N/A | pass (or triaged) |
| Gate-A baseline | gate-a | existing | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** WCAG contrast formula implementation has subtle bugs (sRGB linearization thresholds, rounding). Spec may pass incorrectly or fail on borderline pairs.
- **Mitigation:** Cross-check the helper against known fixed outputs — e.g. `contrastRatio({r:0,g:0,b:0}, {r:255,g:255,b:255})` must equal exactly 21.0. Include 3 sentinel pairs as sanity tests at the top of the spec (black/white = 21, white/white = 1, #333/#fff ≈ 12.63). If any sentinel drifts, the formula is wrong — fail loudly before running token pairs.
- **Rollback:** `git revert <sha>`. Spec file deletion has zero side effects. Gate-A and existing a11y specs unaffected.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:accessibility-compliance-accessibility-audit
isolation: worktree
branch_prefix: claude/wo-11-contrast-spec
```

````markdown
You are implementing Step 11 (v0.27.1 Contrast spec) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-11-contrast-spec   (create from main, AFTER WO-09 is merged; WO-10 may be parallel)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read ADR-006 §3 contrast spec
  3. Read editor/styles/tokens.css — enumerate 5–10 foreground/background pairs to assert
  4. Read editor/src/boot.js for theme-swap API reference
  5. Confirm WO-09 merged (tests/a11y/helpers/axe-harness.js exists; tests/a11y/README.md exists)
  6. Run `npm run test:gate-a` — must be 55/5/0
  7. Run `npm run test:gate-a11y` — must be green

FILES YOU OWN (exclusive write):
  - tests/a11y/contrast.spec.js (new)
  - tests/a11y/helpers/contrast-ratio.js (new)
  - docs/CHANGELOG.md
  - docs/ADR-006-accessibility-ci-gate.md (Status line only)

FILES READ-ONLY (reference only):
  - editor/styles/tokens.css
  - editor/styles/banner.css, panels.css, inspector.css
  - editor/presentation-editor.html (#themeToggleBtn)
  - editor/src/boot.js
  - tests/a11y/helpers/axe-harness.js (WO-09)
  - tests/playwright/specs/shell.smoke.spec.js (theme-swap reference)

SUB-TASKS:
  1. Enumerate 5–10 token pairs from editor/styles/tokens.css.
  2. Create tests/a11y/helpers/contrast-ratio.js with parseColor + contrastRatio (pure JS, zero deps, WCAG 2.1 formula).
  3. Create tests/a11y/contrast.spec.js — 2 describe blocks (light, dark), N × 2 assertions.
  4. Confirm theme-marker selector used by the spec matches boot.js behavior.
  5. Verify gate-a11y includes the new spec (no script edit needed; WO-09 already made the gate scan tests/a11y/**).
  6. Mark any failing pairs with test.fail() + triage note — do NOT silently skip.
  7. Gate-A 55/5/0 confirmed; Gate-a11y runs new contrast tests.
  8. Update docs/CHANGELOG.md.
  9. Update ADR-006 Status line to Accepted.

INVARIANTS (NEVER violate):
  - No `type="module"` added
  - No bundler dep added
  - Gate-A 55/5/0 unchanged
  - `file://` still works
  - Russian UI-copy preserved (N/A — tests only)
  - test:gate-a11y stays ADDITIVE
  - Contrast helper pure JS, zero deps
  - Both light AND dark themes asserted
  - Any failing ratio → test.fail() with triage, NOT silent skip

SENTINEL CHECKS (include in spec, at top):
  - contrastRatio(black, white) === 21.0
  - contrastRatio(white, white) === 1.0
  - contrastRatio(#333, #fff) ≈ 12.63 (within 0.05 tolerance)
  If any sentinel drifts, the formula is wrong — fail the spec loudly before running token pairs.

ACCEPTANCE:
  - Gate-A: 55/5/0
  - tests/a11y/contrast.spec.js has ≥ 5 pairs × 2 themes = 10 test() calls
  - helpers/contrast-ratio.js exports parseColor + contrastRatio
  - grep `toBeGreaterThanOrEqual(4.5)` returns ≥ 5 hits
  - Dark-theme block asserts dataset.theme === 'dark' before iterating
  - Commit: `test(a11y): contrast ratio spec — v0.27.1 step 11`
  - ADR-006 Status → Accepted

ON COMPLETION:
  1. Run full acceptance matrix
  2. git add tests/a11y/contrast.spec.js tests/a11y/helpers/contrast-ratio.js docs/CHANGELOG.md docs/ADR-006-accessibility-ci-gate.md
  3. Conventional commit: `test(a11y): contrast ratio spec — v0.27.1 step 11`
  4. Report: files changed, LOC delta, gate results, triage list if any
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Spec file deletion has zero side effects because no shell code or production style was edited.

---
