## Step 32 — v0.28.0 · `test:gate-visual` Playwright `toHaveScreenshot()` shell surfaces × light/dark

**Window:** W7   **Agent-lane:** A (Test/Visual)   **Effort:** M
**ADR:** ADR-007   **PAIN-MAP:** —
**Depends on:** WO-29 (banner unification — visual baseline stabilizes after banners unify), WO-30 (tokens v2 — visuals would drift if captured before)   **Unblocks:** WO-38 (RC freeze gate matrix)

### Context (3–5 lines)

Per ADR-007, CSS changes to `overlay.css`, `inspector.css`, `banner.css`, `layer-picker.css` can silently alter shell appearance. `tests/playwright/specs/visual.spec.js` exists (4 tests / 77 LoC / 14 snapshots — AUDIT-E §11) but is bundled into Gate-B and covers only 4 scenarios. This WO promotes visual regression to a dedicated gate `test:gate-visual` with a dedicated `chromium-visual` Playwright project at viewport 1440×900, captures the 15-surface matrix from ADR-007 (empty/loaded/selected/block-banner/floating-toolbar/layer-picker/action-hint in light + dark), and wires it into the merge-gate from v0.28.0 onward. Other viewports remain out of scope for v1.0 (see task-specific invariants).

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `tests/visual/shell-visual.spec.js` | new | +320 / −0 |
| `tests/visual/__snapshots__/chromium-visual/` | new (directory) | 15 PNG baselines |
| `tests/visual/helpers/visual-fixtures.js` | new | +180 / −0 |
| `playwright.config.js` | edit (add `chromium-visual` project) | +18 / −0 |
| `package.json` | edit (scripts) | +3 / −0 |
| `docs/CHANGELOG.md` | edit (append) | +8 / −0 |
| `docs/ADR-007-visual-regression-ci-gate.md` | edit (Status → Accepted) | +2 / −2 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `docs/ADR-007-visual-regression-ci-gate.md` §Decision | 15-surface matrix + diff thresholds (`maxDiffPixelRatio: 0.01`, `threshold: 0.2`) |
| `tests/playwright/specs/visual.spec.js` | existing 4 scenarios — migrate patterns + retire file after gate-visual lands |
| `tests/playwright/specs/visual.spec.js-snapshots/` | existing 14 PNGs — do NOT reuse; new project → new baselines |
| `playwright.config.js` | add project beside existing `chromium-desktop`, `chromium-shell-1100`, etc. |
| `tests/playwright/specs/honest-feedback.spec.js` | reference for triggering `block-reason` banner at zoom ≠ 100% |
| `tests/playwright/specs/click-through.spec.js` | reference for triggering layer picker via context menu |
| `editor/styles/tokens.css` | light/dark theme switch — trigger via `html[data-theme]` |
| `tests/playwright/helpers/editorApp.js` | shared `EditorApp` page-object — reuse for boot/load |
| `editor/fixtures/basic-deck.html` (post-WO-25) | reference deck for "loaded" states |

### Sub-tasks (executable, each ≤ 2 h)

1. Read `playwright.config.js` fully. Understand project config shape for existing projects (`chromium-desktop`, `chromium-shell-1100`, `chromium-mobile-390`, `chromium-mobile-640`, `chromium-tablet-820`, `firefox-desktop`, `webkit-desktop`). Expected state after: you know exactly where to insert the new project.
2. Add `chromium-visual` project in `playwright.config.js` per ADR-007 §"Playwright project config": `{ name: "chromium-visual", use: { browserName: "chromium", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" } }`. Expected state after: `npx playwright test --list --project=chromium-visual` lists the new project even before specs exist.
3. Create `tests/visual/` directory. Create `tests/visual/helpers/visual-fixtures.js` — exports: `openShellForVisual(page)` (idempotent boot + wait for `#shellReady` marker), `loadBasicDeck(page)` (calls `EditorApp.loadFixture`), `switchTheme(page, 'dark'|'light')` (sets `localStorage['presentation-editor:theme:v1']` + reloads OR clicks theme toggle — choose the deterministic path), `selectFirstH1(page)` (select `h1` text entity), `triggerBlockBanner(page)` (set zoom ≠ 100% via `ctrl+=`), `openLayerPicker(page)` (simulate overlap + click badge), `openFloatingToolbar(page)` (select text + hover toolbar region), `openActionHint(page)` (first-select hint on freshly-loaded deck). Expected state after: helper library compiles, is imported by spec file.
4. Create `tests/visual/shell-visual.spec.js` with 15 `test()` blocks, one per cell in this matrix. Each test: calls fixture helper → disables animations (`await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;}' })`) → `await expect(page).toHaveScreenshot('<slug>-<theme>.png', { maxDiffPixelRatio: 0.01, threshold: 0.2 })`.

   | Surface | Theme | Snapshot slug |
   |---|---|---|
   | Empty state | light | `empty-light.png` |
   | Empty state | dark | `empty-dark.png` |
   | Loaded preview | light | `loaded-preview-light.png` |
   | Loaded preview | dark | `loaded-preview-dark.png` |
   | Loaded edit no-select | light | `loaded-edit-light.png` |
   | Loaded edit no-select | dark | `loaded-edit-dark.png` |
   | Text element selected | light | `selected-text-light.png` |
   | Text element selected | dark | `selected-text-dark.png` |
   | Block banner (zoom ≠ 100%) | light | `block-banner-light.png` |
   | Block banner (zoom ≠ 100%) | dark | `block-banner-dark.png` |
   | Floating toolbar | light | `floating-toolbar-light.png` |
   | Floating toolbar | dark | `floating-toolbar-dark.png` |
   | Layer picker popup | light | `layer-picker-light.png` |
   | Layer picker popup | dark | `layer-picker-dark.png` |
   | Action hint banner | light only | `action-hint-light.png` |

   Expected state after: spec file parses, all 15 tests discoverable via `playwright test --list`.
5. Generate baselines: `npm run test:gate-visual:update` (defined in next step). Review each PNG in `tests/visual/__snapshots__/chromium-visual/`: confirm the expected surface is visible, no partial renders, no timing artifacts. Expected state after: 15 PNG files committed; none is a stale/black/white frame.
6. Add `package.json` scripts. Append to `"scripts"`: `"test:gate-visual": "playwright test tests/visual/ --project=chromium-visual"` and `"test:gate-visual:update": "playwright test tests/visual/ --project=chromium-visual --update-snapshots"`. Expected state after: both scripts runnable; first is the enforcement command.
7. Wire Gate-A invariant check: run `npm run test:gate-a` — must remain 55/5/0 (the new gate is independent). Then run `npm run test:gate-visual` — must be 15/0/0. Expected state after: two disjoint gates green, no shared fixture contention.
8. Decommission old `tests/playwright/specs/visual.spec.js`: DELETE the file and its snapshots directory `visual.spec.js-snapshots/`. Update `npm run test:gate-b` in `package.json` to remove `tests/playwright/specs/visual.spec.js` from the argument list. Rationale: the new gate subsumes it on the exact viewport ADR-007 mandates. Expected state after: no dead spec paths; Gate-B still green without the retired file (run `npm run test:gate-b` fully to verify, document result in commit body).
9. Update `docs/CHANGELOG.md` under `## Unreleased` → `### Added` bullet: `test:gate-visual — Playwright toHaveScreenshot() baseline on 1440×900 (chromium-visual project), 15 surfaces × light/dark per ADR-007 (WO-32).` and `### Removed` bullet: `legacy tests/playwright/specs/visual.spec.js (superseded by tests/visual/shell-visual.spec.js).` Expected state after: CHANGELOG has both entries; integration agent later assigns version.
10. Mark ADR-007 Status: Accepted. Edit `docs/ADR-007-visual-regression-ci-gate.md` line 3: `**Status**: Proposed` → `**Status**: Accepted`. Add `**Accepted in**: v0.28.0 via WO-32.` line below. Expected state after: ADR status matches reality.
11. Document baseline invariant: the first 15 PNGs land on Windows-native Chromium. Add `docs/TESTING_STRATEGY.md` note (or create if absent): "Visual baselines are Windows-Chromium-specific. Regenerate with `test:gate-visual:update` when intentional CSS changes land; commit PNG diff review separately from logic changes." Expected state after: future contributors know the friction.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge (unaffected by new gate)
- [ ] `file://` workflow still works (manual smoke: open a deck from file system)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer) — N/A
- [ ] Russian UI-copy strings preserved (not translated to English) — N/A (no UI copy)
- [ ] `chromium-visual` project captured at 1440×900 only; mobile/tablet viewports OUT of scope for v1.0
- [ ] Baselines committed as `*.png` in `tests/visual/__snapshots__/chromium-visual/` — 15 files exactly
- [ ] `maxDiffPixelRatio: 0.01` + `threshold: 0.2` matches ADR-007 §"Diff thresholds"
- [ ] No external CI services (Percy / Chromatic) introduced
- [ ] Animations disabled via `addStyleTag` in every test — determinism primary concern

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:gate-visual` runs 15 tests, 15 pass, 0 fail on chromium-visual project
- [ ] `npm run test:gate-a` remains 55 / 5 / 0 (`chromium-desktop`)
- [ ] `npm run test:gate-b` remains green after legacy `visual.spec.js` removal
- [ ] `playwright.config.js` has exactly one new project entry `chromium-visual` with the ADR-007 viewport (`width: 1440, height: 900`)
- [ ] `tests/visual/__snapshots__/chromium-visual/` contains exactly 15 PNG files matching the surface matrix in sub-task 4
- [ ] Intentional CSS mutation test: change `--accent-primary` in `tokens.css` by 1 hex digit → `test:gate-visual` fails (proves baselines are enforcing); revert → passes again (document this manual verification in commit body)
- [ ] ADR-007 `Status: Accepted` with `Accepted in: v0.28.0 via WO-32` line present
- [ ] Commit message in conventional-commits format: `test(visual): gate-visual on 1440x900 — 15 surfaces light/dark — v0.28.0 WO-32`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| empty-light baseline | gate-visual | `tests/visual/shell-visual.spec.js` | N/A | pass |
| empty-dark baseline | gate-visual | `tests/visual/shell-visual.spec.js` | N/A | pass |
| loaded-preview-light baseline | gate-visual | `tests/visual/shell-visual.spec.js` | N/A | pass |
| loaded-edit-light/dark baselines | gate-visual | `tests/visual/shell-visual.spec.js` | N/A | pass |
| selected-text-light/dark baselines | gate-visual | `tests/visual/shell-visual.spec.js` | N/A | pass |
| block-banner-light/dark baselines | gate-visual | `tests/visual/shell-visual.spec.js` | N/A | pass |
| floating-toolbar-light/dark baselines | gate-visual | `tests/visual/shell-visual.spec.js` | N/A | pass |
| layer-picker-light/dark baselines | gate-visual | `tests/visual/shell-visual.spec.js` | N/A | pass |
| action-hint-light baseline | gate-visual | `tests/visual/shell-visual.spec.js` | N/A | pass |
| gate-a unaffected by new gate | gate-a | all four gate-a specs | 55/5/0 | 55/5/0 |
| gate-b rebalanced (visual.spec.js removed) | gate-b | `tests/playwright/specs/*.spec.js` | pass (11 specs) | pass (10 specs) |

### Risk & mitigation

- **Risk:** Baseline PNGs are platform-sensitive — rendering differs between Windows-Chromium (author env) and Linux-Chromium (possible CI env). AUDIT-E §11 notes all current baselines are `-win32.png`.
- **Mitigation:** Pin CI (when enabled) to Windows Server 2022 per ADR-007 §Consequences. Document in `docs/TESTING_STRATEGY.md` that regenerating baselines on a different OS is a deliberate action (sub-task 11). If Linux CI is needed, a follow-up WO adds a `chromium-visual-linux` project with its own `*-linux.png` suffix — out of scope here.
- **Risk:** Theme-switch helper non-determinism — `switchTheme` via `localStorage` reload could race with shell bootstrap and capture an in-transition frame.
- **Mitigation:** Helper awaits a stable theme-applied marker (`await page.waitForSelector('html[data-theme="dark"]')` or equivalent) before screenshot. If marker absent, add one in a pre-requisite WO-30 (tokens v2) — do NOT add here.
- **Risk:** Legacy `visual.spec.js` removal breaks Gate-B if its 4 scenarios covered something not captured by the new matrix.
- **Mitigation:** Diff scenarios: legacy covers `empty-shell`, `loaded-shell`, `loaded-shell-dark`, `loaded-shell-context-menu`. First three map to new `empty-*`, `loaded-preview-*`, `loaded-edit-*` cells. `context-menu` is NOT in the ADR-007 matrix — add as an additional surface if sub-task 4 gap analysis flags it; mini-scope expansion acceptable, capped at +2 snapshots.
- **Risk:** Font rendering sub-pixel jitter inflates diff ratio past 1%.
- **Mitigation:** `threshold: 0.2` + `maxDiffPixelRatio: 0.01` from ADR-007 is already tuned. If false-positive flake appears in first 10 runs, tighten font loading via `document.fonts.ready` await in every helper BEFORE screenshot.
- **Rollback:** `git revert <sha>`. Removes `tests/visual/` tree, removes scripts, restores legacy `visual.spec.js` + snapshots (via revert). No runtime impact on editor.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:test-automator
isolation: worktree
branch_prefix: claude/wo-32-visual-regression-gate
```

````markdown
You are implementing Step 32 (v0.28.0 gate-visual) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-32-visual-regression-gate   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-007 fully (docs/ADR-007-visual-regression-ci-gate.md)
  3. Read existing tests/playwright/specs/visual.spec.js (legacy — will be retired)
  4. Read playwright.config.js fully (know all projects before inserting chromium-visual)
  5. Read tests/playwright/helpers/editorApp.js (EditorApp page-object)
  6. Run `npm run test:gate-a` — must be 55/5/0 before any code change
  7. Run `npm run test:gate-b` once — capture baseline pass/fail counts for later comparison

FILES YOU OWN (exclusive write):
  - tests/visual/shell-visual.spec.js                        (new)
  - tests/visual/helpers/visual-fixtures.js                  (new)
  - tests/visual/__snapshots__/chromium-visual/*.png         (15 baselines)
  - playwright.config.js                                      (add chromium-visual project)
  - package.json                                              (add gate-visual scripts)
  - docs/CHANGELOG.md                                         (append Unreleased)
  - docs/ADR-007-visual-regression-ci-gate.md                 (Status: Accepted)
  - docs/TESTING_STRATEGY.md                                  (note platform sensitivity)
  - DELETE: tests/playwright/specs/visual.spec.js
  - DELETE: tests/playwright/specs/visual.spec.js-snapshots/

FILES READ-ONLY (reference only):
  - docs/audit/AUDIT-E-tests.md §11 (legacy spec analysis)
  - editor/styles/tokens.css (theme trigger)
  - editor/fixtures/basic-deck.html (post-WO-25 reference deck)
  - tests/playwright/specs/honest-feedback.spec.js (block-banner trigger)

SUB-TASKS: (verbatim from WO sub-tasks section)

INVARIANTS (NEVER violate):
  - No type="module"; no bundler
  - Gate-A 55/5/0 preserved
  - chromium-visual viewport 1440x900 EXACTLY
  - 15 baselines EXACTLY (not 14, not 16)
  - maxDiffPixelRatio 0.01, threshold 0.2
  - No Percy/Chromatic/external services
  - file:// workflow preserved

ACCEPTANCE: (verbatim from Acceptance criteria section)

ON COMPLETION:
  1. Run `npm run test:gate-visual` — 15/0/0
  2. Run `npm run test:gate-a` — 55/5/0
  3. Run `npm run test:gate-b` — same pass count as pre-change (minus retired file's 4)
  4. Manual verification: edit tokens.css --accent-primary by 1 hex digit → test:gate-visual fails → revert → passes
  5. git add tests/visual/ playwright.config.js package.json docs/CHANGELOG.md docs/ADR-007-visual-regression-ci-gate.md docs/TESTING_STRATEGY.md
  6. git rm tests/playwright/specs/visual.spec.js tests/playwright/specs/visual.spec.js-snapshots/
  7. Conventional commit: "test(visual): gate-visual on 1440x900 — 15 surfaces light/dark — v0.28.0 WO-32"
  8. Report back: files changed, LOC delta, gate results, baseline regeneration notes if any
````

### Rollback plan

If merge breaks main: `git revert <sha>`. `tests/visual/` tree disappears, `chromium-visual` project removed, legacy `visual.spec.js` restored. Re-plan snapshot strategy before re-attempt. NO fix-forward under pressure.

---
