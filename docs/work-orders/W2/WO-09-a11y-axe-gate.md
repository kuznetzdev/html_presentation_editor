## Step 09 — v0.27.1 · test:gate-a11y via axe-playwright — shell empty/loaded-preview/loaded-edit

**Window:** W2   **Agent-lane:** B   **Effort:** M
**ADR:** ADR-006, ADR-011 (type-touch only, out of scope)   **PAIN-MAP:** P0-14
**Depends on:** none   **Unblocks:** WO-10, WO-11 (share `tests/a11y/` harness)

### Context (3–5 lines)

PAIN-MAP P0-14 and AUDIT-E §"Non-functional coverage gaps" both call out zero a11y coverage. ADR-006 specifies a new additive gate `test:gate-a11y` with three specs (shell scan, keyboard-nav, contrast). This WO scaffolds the harness and ships the first of the three — `shell-a11y.spec.js` — which runs axe-core against shell in three workflow states: `data-editor-workflow="empty"`, `loaded-preview`, `loaded-edit` (markers live in `editor/src/feedback.js::getEditorWorkflowState`, AUDIT-B §1). Keyboard nav (WO-10) and contrast (WO-11) extend the same harness in sibling WOs.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `tests/a11y/shell-a11y.spec.js` | new | +160 / −0 |
| `tests/a11y/helpers/axe-harness.js` | new | +80 / −0 |
| `tests/a11y/README.md` | new | +40 / −0 |
| `playwright.config.js` | edit | +8 / −0 |
| `package.json` | edit | +3 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/presentation-editor.html` | landmark IDs `#topbar`, `#slidesPanel`, `#slidesList`, `#mainPreviewPanel`, `#inspectorPanel`, `#previewFrame`, `#emptyState` |
| `editor/src/feedback.js` | source of `getEditorWorkflowState` workflow markers (`empty` / `loaded-preview` / `loaded-edit`) |
| `editor/src/primary-action.js` | drives the `empty → loaded-preview → loaded-edit` transitions the spec walks through |
| `tests/playwright/specs/shell.smoke.spec.js` | closest existing pattern for navigation + state setup |
| `tests/playwright/helpers/editorApp.js` | reuse for page open + restore-banner dismissal |
| `docs/ADR-006-accessibility-ci-gate.md` | normative spec for this WO |
| `tests/playwright/specs/visual.spec.js` | reference for short-spec Chromium-only gating |

### Sub-tasks (executable, each ≤ 2 h)

1. Inspect `editor/presentation-editor.html:72-190` to confirm topbar landmark IDs (`#topbar`, `#topbarOverflowMenu`). Reference: lines 72, 143. Expected state after: IDs confirmed, notes saved for spec selectors.
2. Inspect `editor/src/feedback.js::getEditorWorkflowState` (AUDIT-B §1 cites lines 171–174). Confirm the three workflow marker values. Expected state after: three string constants locked in (`empty`, `loaded-preview`, `loaded-edit`).
3. Install dev-dep `@axe-core/playwright` pinned to `^4.9.0`. Run `npm install --save-dev @axe-core/playwright@^4.9.0`. Expected state after: `package.json` has new devDependency; `package-lock.json` updated.
4. Add npm script `"test:gate-a11y": "playwright test tests/a11y/ --project=chromium-desktop"` to `package.json`. Expected state after: `npm run` lists `test:gate-a11y`.
5. Extend `playwright.config.js` `testDir` coverage: keep `testDir: tests/playwright`, but add `testMatch` glob OR a second project config — safer is to add a separate `testDir` override per-project is not supported; instead add `tests/a11y/**/*.spec.js` via CLI arg only (already present in script). Verify current config at `playwright.config.js:23` accepts the a11y path. Expected state after: invocation works, no config break.
6. Create `tests/a11y/helpers/axe-harness.js` exporting a function `runAxeScanShellOnly(page, { tags = ['wcag2a','wcag2aa'] })` that: injects `@axe-core/playwright`, excludes `#previewFrame` iframe from scan (deck content), runs `await new AxeBuilder({ page }).exclude('#previewFrame').withTags(tags).analyze()`, returns `{ violations, passes }`. Reference: ADR-006 §1. Expected state after: import `require('@axe-core/playwright').default` works under `"type": "commonjs"`.
7. Create `tests/a11y/shell-a11y.spec.js` with three tests: `empty workflow has zero WCAG AA violations`, `loaded-preview workflow has zero WCAG AA violations`, `loaded-edit workflow has zero WCAG AA violations`. Use `editorApp.js` helper to reach each state: (a) open editor → assert `body[data-editor-workflow="empty"]`; (b) click `#emptyStartDemoBtn` (starter deck) → wait for `[data-editor-workflow="loaded-preview"]`; (c) click `#previewPrimaryActionBtn` → wait for `[data-editor-workflow="loaded-edit"]`. After each state setup, call `runAxeScanShellOnly(page)`; assert `violations` array empty with descriptive message naming the offending rule IDs. Expected state after: 3 tests, all green locally when shell has zero violations; failing fast with readable diff when violations present.
8. Document shell-only scan scope and triage flow in `tests/a11y/README.md`. Include: (a) why `#previewFrame` is excluded, (b) how to regenerate baseline if a known false positive needs a rule disable via `.disableRules([...])`, (c) commands `npm run test:gate-a11y`. Expected state after: a new engineer can run the gate cold.
9. Run `npm run test:gate-a` — must still print `55 passed, 5 skipped, 0 failed`. Expected state after: Gate-A baseline unchanged, additive gate does not leak into it.
10. Run `npm run test:gate-a11y` — produce a triaged list of violations. If non-zero, file a follow-up WO (`tests/a11y/known-violations.md`) and mark each `test.fail()` with TODO-reference; ADR-006 §"Consequences" explicitly permits a triaged list for v0.27.1 bootstrap. Expected state after: gate either 0 violations OR marked `test.fail` with a written triage list that is merge-reviewable.
11. Update `docs/CHANGELOG.md` with unreleased entry `test(a11y): add test:gate-a11y with shell-a11y spec — ADR-006 partial`. Expected state after: changelog has the entry.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open a deck from file system)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer) — N/A, tests only
- [ ] Russian UI-copy strings preserved (not translated to English) — N/A, no shell string edits
- [ ] `test:gate-a11y` is ADDITIVE — not added to `test:gate-a` script (baseline 55/5/0 stays sacred)
- [ ] axe scan targets SHELL only (`#previewFrame` excluded) — deck content is user-authored and out of our a11y contract

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:gate-a11y` exits 0 (either zero violations OR all violations marked `test.fail` with triage doc)
- [ ] `npm run test:gate-a` prints `55 passed, 5 skipped, 0 failed` (unchanged baseline)
- [ ] `tests/a11y/shell-a11y.spec.js` contains exactly 3 `test()` calls — one per workflow state
- [ ] `tests/a11y/helpers/axe-harness.js` exports `runAxeScanShellOnly` and at least one of the three tests imports it
- [ ] `grep -R "#previewFrame" tests/a11y/` shows the iframe exclusion is applied (test-level guard visible)
- [ ] `package.json` has `@axe-core/playwright` in `devDependencies` and `test:gate-a11y` in `scripts`
- [ ] ADR-006 Status updated Proposed → Accepted (partial — shell-a11y shipped)
- [ ] Commit message: `test(a11y): add test:gate-a11y shell scan — ADR-006 partial — v0.27.1 step 09`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Shell WCAG AA — empty workflow | gate-a11y | `tests/a11y/shell-a11y.spec.js` | N/A | pass (or triaged fail) |
| Shell WCAG AA — loaded-preview workflow | gate-a11y | `tests/a11y/shell-a11y.spec.js` | N/A | pass (or triaged fail) |
| Shell WCAG AA — loaded-edit workflow | gate-a11y | `tests/a11y/shell-a11y.spec.js` | N/A | pass (or triaged fail) |
| Gate-A baseline unchanged | gate-a | existing specs | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** axe-core scanning the iframe surfaces violations inside user-authored deck HTML (e.g. reference decks with missing alt text), which are out of our contract. This would produce a gate that fails on user content and destroys its signal-to-noise ratio.
- **Mitigation:** `AxeBuilder#exclude('#previewFrame')` is applied in `runAxeScanShellOnly`. The spec asserts this by re-running against a corrupted deck fixture with known violations inside the iframe — scan must still return zero violations for the shell.
- **Rollback:** `git revert <sha>`; delete `tests/a11y/` directory; remove `@axe-core/playwright` from package.json; remove `test:gate-a11y` script. Zero cross-file coupling makes revert clean.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:accessibility-compliance-accessibility-audit
isolation: worktree
branch_prefix: claude/wo-09-a11y-axe-gate
```

````markdown
You are implementing Step 09 (v0.27.1 test:gate-a11y — shell scan) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-09-a11y-axe-gate   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants — no build step, no type="module", Gate-A 55/5/0 sacred
  2. Read ADR-006 (docs/ADR-006-accessibility-ci-gate.md) end-to-end — normative spec
  3. Read AUDIT-E lines 167–178 (Non-functional coverage gaps: Accessibility) and AUDIT-B journey 8
  4. Read tests/playwright/specs/shell.smoke.spec.js — mimic test setup style
  5. Read editor/src/feedback.js getEditorWorkflowState (lines ~171) — confirm 3 workflow marker strings
  6. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - tests/a11y/shell-a11y.spec.js (new)
  - tests/a11y/helpers/axe-harness.js (new)
  - tests/a11y/README.md (new)
  - playwright.config.js (edit — add a11y testMatch note, optional)
  - package.json (edit — add devDep + script)
  - docs/CHANGELOG.md (edit — unreleased entry)

FILES READ-ONLY (reference only):
  - editor/presentation-editor.html (landmark IDs)
  - editor/src/feedback.js (workflow markers)
  - editor/src/primary-action.js (mode transitions)
  - tests/playwright/helpers/editorApp.js (page-open helper reuse)
  - tests/playwright/specs/shell.smoke.spec.js
  - docs/ADR-006-accessibility-ci-gate.md

SUB-TASKS:
  1. Confirm topbar landmark IDs in the shell HTML (lines 72, 143 area).
  2. Confirm workflow marker strings in feedback.js::getEditorWorkflowState.
  3. Install `@axe-core/playwright@^4.9.0` dev-dep.
  4. Add `test:gate-a11y` npm script.
  5. Verify playwright.config.js testDir covers `tests/a11y/**` via CLI path arg.
  6. Create `tests/a11y/helpers/axe-harness.js` with `runAxeScanShellOnly(page, opts)` that excludes `#previewFrame` and runs wcag2a+wcag2aa.
  7. Create `tests/a11y/shell-a11y.spec.js` with 3 tests (one per workflow state). Each test: navigate → reach state → assert `[data-editor-workflow="<marker>"]` → axe-scan → assert zero violations (or test.fail with triage if known).
  8. Write `tests/a11y/README.md` documenting scope + triage flow.
  9. Verify Gate-A still 55/5/0.
  10. Run Gate-a11y; if violations present, file triage doc `tests/a11y/known-violations.md` and mark failing tests with `test.fail()` + TODO.
  11. Update docs/CHANGELOG.md with unreleased test(a11y): entry.

INVARIANTS (NEVER violate):
  - No `type="module"` added to any `<script>` tag
  - No bundler dependency added to package.json (no vite/webpack/esbuild)
  - Gate-A is 55/5/0 before AND after merge
  - `file://` workflow still works (manual smoke: open a deck from file system)
  - Russian UI-copy strings preserved — you edit zero shell strings in this WO
  - `test:gate-a11y` is ADDITIVE — NOT added to `test:gate-a`. Gate-A baseline stays 55/5/0.
  - axe scan targets SHELL only (`#previewFrame` excluded) — deck content is out of contract
  - Keyboard navigation must work at BOTH `file://` and `http://localhost` origins (same behavior) — not tested here but do not break it

ACCEPTANCE:
  - `npm run test:gate-a11y` exits 0 (zero violations OR triaged test.fail with written rationale)
  - `npm run test:gate-a` prints `55 passed, 5 skipped, 0 failed`
  - `tests/a11y/shell-a11y.spec.js` contains exactly 3 `test(` calls
  - `tests/a11y/helpers/axe-harness.js` exports `runAxeScanShellOnly`
  - `grep -R "#previewFrame" tests/a11y/` shows the iframe exclusion
  - `package.json` has `@axe-core/playwright` devDep and `test:gate-a11y` script
  - ADR-006 Status updated Proposed → Accepted (partial shipping — only shell-a11y part of 3)
  - Commit message: `test(a11y): add test:gate-a11y shell scan — ADR-006 partial — v0.27.1 step 09`

ON COMPLETION:
  1. Run the full acceptance matrix above
  2. git add tests/a11y/ playwright.config.js package.json package-lock.json docs/CHANGELOG.md docs/ADR-006-accessibility-ci-gate.md
  3. Conventional commit: `test(a11y): add test:gate-a11y shell scan — ADR-006 partial — v0.27.1 step 09`
  4. Report back: files changed, LOC delta, gate results (gate-a AND gate-a11y), violation triage count, blockers if any
````

### Rollback plan

If merge breaks main: `git revert <sha>`; re-plan; NO fix-forward under pressure. Delete `tests/a11y/` directory. Remove `@axe-core/playwright` from package.json and `test:gate-a11y` script. Gate-A and all existing gates are unaffected because harness lives in an isolated folder.

---
