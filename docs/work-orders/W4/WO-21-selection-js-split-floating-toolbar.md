## Step 21 — v0.31.1 · Split `selection.js` → `floating-toolbar.js` (phase 2 of 2)

**Window:** W4   **Agent-lane:** γ (Module split)   **Effort:** M
**ADR:** —   **PAIN-MAP:** P1-06 (final closure)
**Depends on:** WO-20 (layers-panel split — MUST merge first; WO-21 branches from WO-20 merged HEAD, NOT main)   **Unblocks:** stylelint rule for floating-toolbar boundary (future); post-v1.0 `InspectorViewModel` extraction

### Context (3–5 lines)

Per AUDIT-A §selection.js tech-debt hot-spot + PAIN-MAP P1-06, this WO completes the selection.js reduction by extracting the floating-toolbar subsystem (`selection.js:1651–1848` — 197 LOC counted; PAIN-MAP says ~196) into a new `editor/src/floating-toolbar.js`. Post-WO-21 the selection.js target is **~1200 LOC** (1849 − 449 (WO-20) − 197 (this WO) − 3 comments = 1200). The 2-WO split rule: WO-20 and WO-21 **must not be combined** — this is the bisection discipline per Agent γ mission. Also absorbs `toolbar.js` (152 LOC of misnamed leftover per AUDIT-A §toolbar.js) helpers `updateFloatingToolbarContext` + `initInspectorSections` + `addInspectorHelpBadges` — review in-scope whether to pull them into `floating-toolbar.js` (toolbar-adjacent) or leave in toolbar.js for an outside-scope rename WO.

### Split map (function-name → destination-file)

Functions that MOVE from `selection.js` to `floating-toolbar.js` (based on grep at selection.js:1651–1848):

| Source line | Function | Destination |
|---|---|---|
| selection.js:1651 | `toggleFloatingToolbarCollapsed(force)` | floating-toolbar.js |
| selection.js:1663 | `persistToolbarSession()` | floating-toolbar.js |
| selection.js:1685 | `initFloatingToolbarState()` | floating-toolbar.js |
| selection.js:1744 | `clampToolbarPosition(x, y)` | floating-toolbar.js |
| selection.js:1760 | `positionFloatingToolbar()` | floating-toolbar.js |
| selection.js:1838 | `hideFloatingToolbar()` | floating-toolbar.js |

**Toolbar.js absorption decision:** `toolbar.js` (152 LOC, AUDIT-A rec #9) contains `updateFloatingToolbarContext()` + `initInspectorSections()` + `addInspectorHelpBadges()`. Of these, ONLY `updateFloatingToolbarContext` is logically toolbar-scoped. Decision for THIS WO:
- **Move** `updateFloatingToolbarContext()` from toolbar.js → floating-toolbar.js (it's called from `positionFloatingToolbar` line 1761 — keep them adjacent).
- **Leave** `initInspectorSections()` + `addInspectorHelpBadges()` in toolbar.js — they're inspector-side, not toolbar-side. A future WO can rename toolbar.js → inspector-init.js once this subsystem is out.
- Document this partial absorption in commit body.

**Helper dependencies that STAY elsewhere** (floating-toolbar.js calls via global scope):
- `els.floatingToolbar`, `els.ftHandleBtn`, `els.ftCollapseBtn`, `els.previewStage`, `els.previewFrame`, `state.toolbarPinned`, `state.toolbarPos`, `state.toolbarCollapsed` (all still in god-state / els cache — not in scope to migrate here).
- `sendToBridge`, `isContextMenuOpen`, `isCompactShell`, `getSelectionInteractionRect`, `getShellViewportInsets`, `reportShellWarning`, `getSelectionPrimarySurface` — still in other files via shared scope.
- `TOOLBAR_SESSION_KEY` from `constants.js` — available via global.

**Call-site unchanged:** `positionFloatingToolbar()` / `hideFloatingToolbar()` / `initFloatingToolbarState()` callers (`bridge-commands.js:414`, `selection.js` remnants for drag flows, `boot.js:18` in `init()`) continue to work via shared global scope.

**Selection.js LOC after this WO:** 1401 (post-WO-20) − 197 = **1204 LOC**. Target met.
**Toolbar.js LOC after this WO:** 152 − ~30 (updateFloatingToolbarContext move) = **~122 LOC**.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/floating-toolbar.js` | new | +225 / −0 (197 moved from selection + ~30 from toolbar + header) |
| `editor/src/selection.js` | edit | +3 / −197 (remove moved block, leave comment) |
| `editor/src/toolbar.js` | edit | +1 / −30 (remove `updateFloatingToolbarContext`, leave comment) |
| `editor/presentation-editor.html` | edit | +1 / −0 (one new `<script src>` line) |
| `docs/CHANGELOG.md` | edit | +3 / −0 |
| `.codex/skills/html-presentation-editor/references/project-map.md` | edit | +4 / −2 (count 26 → 27, describe floating-toolbar.js, trim toolbar.js description) |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/selection.js` lines 1651–1848 (post-WO-20) | source of moved code |
| `editor/src/toolbar.js` lines 1–152 | source of partial absorption |
| `editor/src/bridge-commands.js` lines 349–422 | caller of positionFloatingToolbar |
| `editor/src/boot.js` line 18 | `initFloatingToolbarState()` called from `init()` |
| `editor/presentation-editor.html` lines 1761–1785 | script load order — floating-toolbar.js goes AFTER selection.js, AFTER layers-panel.js |
| `docs/audit/AUDIT-A-architecture.md` §selection.js, §toolbar.js | split rationale |
| `docs/PAIN-MAP.md` §P1-06 | final closure scope |

### Sub-tasks (executable, each ≤ 2 h)

1. **Sequential-merge gate:** confirm WO-20 is merged into main. `git log main --oneline | head -5` must include WO-20 commit. Branch from the WO-20 merge HEAD, NOT from pre-WO-20 main. Expected state after: baseline includes WO-20 changes.
2. Pre-flight: `npm run test:gate-a` 55/5/0; `npm run test:unit` 42/42; `wc -l editor/src/selection.js` → 1401 ± 2. Expected state after: clean baseline for this WO's bisection.
3. Create `editor/src/floating-toolbar.js`:
```
// floating-toolbar.js
// Layer: Domain Logic (UI — Floating Toolbar)
// Floating toolbar: state persistence, positioning, collapse, drag.
// Extracted from selection.js (6 fns) + toolbar.js (1 fn) in v0.31.1 per PAIN-MAP P1-06.
```
Expected state after: empty module file exists.
4. Cut-paste the 6 functions from `selection.js:1651–1848` into `floating-toolbar.js`. Preserve indentation. No body edits. Expected state after: floating-toolbar.js has 197 LOC of moved code.
5. In `toolbar.js`, cut the `updateFloatingToolbarContext()` function (roughly 30 LOC) and paste into `floating-toolbar.js` BEFORE `positionFloatingToolbar()` (since the latter calls it — hoisting keeps it fine but keep adjacency). In `toolbar.js`, leave a comment:
```
      // updateFloatingToolbarContext moved to floating-toolbar.js (WO-21).
      // toolbar.js retains only inspector-init helpers; candidate rename to inspector-init.js in a future WO.
```
Expected state after: toolbar.js is ~122 LOC; floating-toolbar.js has ~227 LOC.
6. In `selection.js` delete the moved block (lines 1651–1848 post-WO-20). Leave:
```
      // Floating toolbar logic moved to floating-toolbar.js (WO-21).
```
Expected state after: selection.js is 1204 ± 2 LOC.
7. Add `<script src="src/floating-toolbar.js"></script>` in `editor/presentation-editor.html` AFTER `<script src="src/layers-panel.js"></script>` (from WO-20) and BEFORE `<script src="src/toolbar.js"></script>` (currently line 1779). New order: `selection → layers-panel → floating-toolbar → toolbar → context-menu → inspector-sync → shell-overlays → boot → primary-action → main`. Expected state after: HTML load order updated.
8. Runtime guard at top of `floating-toolbar.js`:
```
if (typeof getSelectionInteractionRect !== 'function') {
  throw new Error('floating-toolbar.js: required helper getSelectionInteractionRect not found — check script load order');
}
```
Expected state after: any accidental re-order fails loud at boot.
9. Audit call sites: `grep -n "updateFloatingToolbarContext\|positionFloatingToolbar\|hideFloatingToolbar\|initFloatingToolbarState\|toggleFloatingToolbarCollapsed\|clampToolbarPosition\|persistToolbarSession" editor/src/*.js editor/presentation-editor.html`. Expect hits in: `bridge-commands.js`, `selection.js` (remaining drag/finish paths), `boot.js` (init), `feedback.js` (closeTransientShellUi). For each, confirm the call is resolved via global scope after the move. Expected state after: every caller resolved.
10. Manual smoke tests: (a) open deck, select element — floating toolbar appears near selection; (b) drag the toolbar by its handle — moves + persists across refresh; (c) collapse button toggles layout; (d) compact shell (resize < 820 px) — toolbar falls back to bottom-sheet layout; (e) select different elements — toolbar repositions; (f) deselect (click background) — toolbar hides. Expected state after: all 6 interactions work identically to v0.31.0.
11. Run full gate matrix: `test:gate-a` 55/5/0; `test:gate-b` green; `test:unit` 42/42. Expected state after: all green.
12. Update `.codex/skills/html-presentation-editor/references/project-map.md`: module count 26 → 27. Add entry `floating-toolbar.js — Floating toolbar position/drag/collapse (v0.31.1)`. Update `toolbar.js` description to reflect trimmed scope. Expected state after: project-map reflects reality.
13. Update `docs/CHANGELOG.md` `## Unreleased` → `### Changed`: `Split selection.js → floating-toolbar.js (197 LOC extracted + 30 LOC absorbed from toolbar.js); PAIN-MAP P1-06 CLOSED; selection.js now 1204 LOC.` Expected state after: changelog accurate.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added
- [ ] Gate-A 55/5/0 before merge
- [ ] `file://` workflow still works
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A (no CSS)
- [ ] Russian UI-copy byte-identical (no copy in moved functions, but verify tooltip text `"Перетащить, чтобы..."`)
- [ ] Script load order: `selection.js` → `layers-panel.js` → `floating-toolbar.js` → `toolbar.js` (classic-script dependency direction; each file depends on earlier ones)
- [ ] Zero `import` or `require` statements
- [ ] Zero function-body edits — only moves
- [ ] Runtime guard at top of floating-toolbar.js fails loud on load-order mistake
- [ ] `window.state` Proxy still works for `state.toolbarPinned`/`toolbarPos`/`toolbarCollapsed`/`toolbarDragActive`/`toolbarDragOffset` (these stay in god-state this WO — slice migration is future scope)
- [ ] Call-sites of moved functions unchanged (bridge-commands.js / boot.js / selection.js drag paths / feedback.js)
- [ ] Sequential merge rule observed: WO-20 is merged BEFORE this WO-21 branches
- [ ] PAIN-MAP P1-06 marked CLOSED only after this WO merges (not prematurely by WO-20)

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `wc -l editor/src/selection.js` → 1204 ± 5 LOC
- [ ] `wc -l editor/src/floating-toolbar.js` → 225 ± 10 LOC
- [ ] `wc -l editor/src/toolbar.js` → 122 ± 5 LOC
- [ ] `npm run test:gate-a` → 55/5/0 unchanged
- [ ] `npm run test:gate-b` → green
- [ ] `npm run test:unit` → 42/42
- [ ] Manual floating-toolbar 6-step smoke test (sub-task 10) passes, zero console errors
- [ ] `grep -n "function positionFloatingToolbar" editor/src/selection.js` returns NO matches
- [ ] `grep -n "function positionFloatingToolbar" editor/src/floating-toolbar.js` returns exactly 1 match
- [ ] `grep -n "function updateFloatingToolbarContext" editor/src/toolbar.js` returns NO matches
- [ ] `grep -n "function updateFloatingToolbarContext" editor/src/floating-toolbar.js` returns exactly 1 match
- [ ] Project-map module count 27; CHANGELOG marks PAIN-MAP P1-06 CLOSED
- [ ] Commit message: `refactor(arch): split selection.js → floating-toolbar.js — v0.31.1 WO-21`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| select → toolbar appears | gate-a | `tests/playwright/editor.regression.spec.js` | pass (55/5/0) | pass (55/5/0) |
| drag toolbar by handle | manual | — | pass | pass |
| toolbar collapse toggle | manual | — | pass | pass |
| compact shell bottom-sheet layout | gate-d? (mobile) | existing mobile spec | pass | pass |
| deselect hides toolbar | manual | — | pass | pass |

### Risk & mitigation

- **Risk:** WO-20 and WO-21 get merged as a combined diff, defeating the bisection rule.
- **Mitigation:** Agent γ protocol: two separate feature branches, two separate commits, two separate PRs (if PR flow used). Integration Agent E gates this in Window 4 merge schedule. This WO's first pre-flight checks `git log main` for the WO-20 commit hash specifically.
- **Risk:** `updateFloatingToolbarContext` absorption from `toolbar.js` leaves `toolbar.js` in an awkward half-renamed state (contains only inspector-init helpers).
- **Mitigation:** Documented as intentional in sub-task 5 comment + commit body. Flag follow-up WO "rename toolbar.js → inspector-init.js" in CHANGELOG `### Notes`. Do NOT rename toolbar.js in this WO — renames are separate work.
- **Risk:** Drag handler in `selection.js:666-687` (pointerdown on floating toolbar for alt-click passthrough) references the toolbar — ensure no cross-file circular calls break.
- **Mitigation:** That handler is INSIDE `bindSelectionOverlayInteractions` which stays in selection.js. It only references `els.floatingToolbar` + `proxySelectionAtPreviewPoint` — both are in-scope via globals. Verified in audit (sub-task 9).
- **Risk:** `positionFloatingToolbar` references `els.previewStage.getBoundingClientRect()` — classic perf hot-path. Moving it to a new file adds no layout cost, but a rename mistake could introduce a typo.
- **Mitigation:** Pure cut/paste — no edits. If a typo slips in, the runtime guard at sub-task 8 catches load-order issues; manual smoke-test catches functional issues. Add sub-task: `diff <(sed -n '1651,1848p' selection.js@pre-wo) floating-toolbar.js` should show zero content drift (modulo header) — include in commit body as evidence.
- **Risk:** `initFloatingToolbarState()` called from `boot.js:18` still works — but if `floating-toolbar.js` loads AFTER `boot.js`, script-parse-time global isn't defined yet.
- **Mitigation:** Verify HTML load order: `boot.js` is at line 1783, `floating-toolbar.js` goes at new line ~1779. `initFloatingToolbarState` is called from within `init()` function body — `init()` runs from `main.js` (line 1785) which is AFTER all scripts parsed. So hoisting works. Runtime guard on floating-toolbar.js also asserts this.
- **Rollback:** `git revert <sha>`. Single-commit cut/paste + one file rename = fully reversible. WO-20 remains merged (selection.js stays at 1401 LOC after revert). NO fix-forward under pressure.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:legacy-modernizer
isolation: worktree
branch_prefix: claude/wo-21-selection-js-split-floating-toolbar
```

````markdown
You are implementing Step 21 (v0.31.1 split selection.js → floating-toolbar.js) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-21-selection-js-split-floating-toolbar   (create from main AFTER WO-20 is merged)

PRE-FLIGHT (HARD GATE):
  1. Read CLAUDE.md
  2. Verify WO-20 merged: `git log main --oneline | grep -i "WO-20"` must return a commit
  3. Read docs/audit/AUDIT-A-architecture.md §selection.js + §toolbar.js
  4. Read the WO-21 split map (selection.js:1651–1848 POST-WO-20 + toolbar.js:~30 LOC of updateFloatingToolbarContext)
  5. Verify baseline: `wc -l editor/src/selection.js` → 1401 ± 2; `npm run test:unit` 42/42; `npm run test:gate-a` 55/5/0

FILES YOU OWN (exclusive write):
  - editor/src/floating-toolbar.js      (new — ~225 LOC)
  - editor/src/selection.js             (edit — remove 197 LOC, leave 1 comment)
  - editor/src/toolbar.js               (edit — remove ~30 LOC, leave 1 comment)
  - editor/presentation-editor.html     (edit — add ONE <script src> line)
  - docs/CHANGELOG.md
  - .codex/skills/html-presentation-editor/references/project-map.md

FILES READ-ONLY (reference only):
  - docs/audit/AUDIT-A-architecture.md
  - docs/PAIN-MAP.md (§P1-06)
  - editor/src/bridge-commands.js (callers)
  - editor/src/boot.js (init caller)
  - editor/src/feedback.js (closeTransientShellUi caller)

SUB-TASKS:
  1. SEQUENTIAL GATE: confirm WO-20 is merged; branch from WO-20 merged HEAD
  2. Pre-flight gate-A + test:unit + LOC baseline
  3. Create floating-toolbar.js with header
  4. Cut/paste 6 functions from selection.js:1651–1848 → floating-toolbar.js (no edits)
  5. Cut/paste updateFloatingToolbarContext from toolbar.js → floating-toolbar.js (no edits)
  6. Remove moved blocks from selection.js + toolbar.js, leave 1-line comments
  7. Add <script src="src/floating-toolbar.js"> in HTML after layers-panel.js, before toolbar.js
  8. Runtime guard at top of floating-toolbar.js
  9. Audit all call-sites via grep
  10. Manual 6-step smoke test (select, drag, collapse, compact shell, reselect, deselect)
  11. Gate-A + Gate-B + test:unit green
  12. Update project-map.md (26 → 27) + CHANGELOG.md (PAIN-MAP P1-06 CLOSED)

INVARIANTS (NEVER violate):
  - No type="module", no bundler
  - Gate-A 55/5/0 preserved
  - file:// still works
  - Russian UI copy byte-identical
  - Script load order: selection.js → layers-panel.js → floating-toolbar.js → toolbar.js
  - Zero function-body edits — cut/paste only
  - Runtime guard throws on load-order mistake
  - window.state Proxy unchanged (toolbar fields stay in god-state this WO)
  - WO-20 merged BEFORE this WO branches (sequential rule)
  - PAIN-MAP P1-06 marked CLOSED only AFTER this WO merges

ACCEPTANCE:
  - selection.js LOC ~ 1204 (± 5)
  - floating-toolbar.js LOC ~ 225 (± 10)
  - toolbar.js LOC ~ 122 (± 5)
  - Gate-A 55/5/0; Gate-B green; test:unit 42/42
  - Manual 6-step smoke passes zero console errors
  - project-map.md count 27
  - PAIN-MAP P1-06 marked CLOSED in CHANGELOG
  - Conventional commit: refactor(arch): split selection.js → floating-toolbar.js — v0.31.1 WO-21

ON COMPLETION:
  1. Run acceptance matrix
  2. git add editor/src/floating-toolbar.js editor/src/selection.js editor/src/toolbar.js editor/presentation-editor.html docs/CHANGELOG.md .codex/skills/html-presentation-editor/references/project-map.md
  3. Conventional commit per above
  4. Report back: selection.js LOC before/after, floating-toolbar.js LOC, toolbar.js trim, Gate results, audit discoveries

IMPORTANT — This is the FINAL closure of PAIN-MAP P1-06. After this WO lands, selection.js sits at ~1200 LOC down from 1849.
````

### Rollback plan

If merge breaks main: `git revert <sha>` — single-commit reversion. WO-20 remains merged (selection.js stays at 1401 LOC). Re-plan WO-21 narrower (e.g. move only `positionFloatingToolbar` + `clampToolbarPosition` first, the rest in a WO-21b). NO fix-forward under pressure.
