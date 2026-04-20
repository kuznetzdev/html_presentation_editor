## Step 20 — v0.31.0 · Split `selection.js` → `layers-panel.js` (phase 1 of 2)

**Window:** W4   **Agent-lane:** γ (Module split)   **Effort:** M
**ADR:** —   **PAIN-MAP:** P1-06
**Depends on:** WO-17 (selection slice — layers panel reads selection via Proxy)   **Unblocks:** WO-21 (floating-toolbar split — must run sequentially after this WO to bisect any regression per EXECUTION_PLAN risk map)

### Context (3–5 lines)

Per AUDIT-A §selection.js + PAIN-MAP P1-06, `selection.js` is the highest-complexity non-bridge file at **1849 LOC** mixing six concerns. This WO extracts the layers-panel subsystem (`selection.js:1165–1613` — 449 LOC counted; PAIN-MAP says ~444, actual is 449) into a new `editor/src/layers-panel.js` file, keeping selection.js focused on overlay + direct-manip + element ops. **Phase 1 of 2: layers-panel first, floating-toolbar next in WO-21.** The 2-WO split is mandatory per Agent γ mission — NEVER merge both in one commit — so any regression can be bisected to the precise subsystem.

### Split map (function-name → destination-file)

Functions that MOVE from `selection.js` to `layers-panel.js` (based on grep at selection.js:1165–1613):

| Source line | Function | Destination |
|---|---|---|
| selection.js:1170 | `toggleLayerLock(nodeId)` | layers-panel.js |
| selection.js:1191 | `toggleLayerVisibility(nodeId)` | layers-panel.js |
| selection.js:1208 | `reorderLayers(fromIndex, toIndex)` | layers-panel.js |
| selection.js:1241 | `getEntityKindIcon(entityKind)` | layers-panel.js |
| selection.js:1259 | `getLayerLabel(el)` | layers-panel.js |
| selection.js:1273 | `getPreviewLayerNode(nodeId)` | layers-panel.js |
| selection.js:1280 | `isLayerSessionHidden(nodeId)` | layers-panel.js |
| selection.js:1302 | `setLayerSessionVisibility(nodeId, isHidden)` | layers-panel.js |
| selection.js:1311 | `clearSessionOnlyVisibilityFromModelNode(nodeId)` | layers-panel.js |
| selection.js:1323 | `stripSessionOnlyVisibilityFromReplacement(...)` | layers-panel.js |
| selection.js:1338 | `getRussianPlural(count, one, few, many)` | layers-panel.js (helper — only used by formatLayerStackHint) |
| selection.js:1347 | `formatLayerStackHint(index, total)` | layers-panel.js |
| selection.js:1354 | `buildLayerStatusChipHtml(label, className)` | layers-panel.js |
| selection.js:1362 | `buildLayerStatusChipsHtml(chips)` | layers-panel.js |
| selection.js:1368 | `renderLayersPanel()` | layers-panel.js |
| selection.js:1483 | `bindLayersPanelActions()` | layers-panel.js |
| selection.js:1615 | `groupSelectedElements()` | layers-panel.js |
| selection.js:1637 | `ungroupSelectedElement()` | layers-panel.js |

**Helper dependencies that STAY in selection.js** (layers-panel.js calls them via global scope — classic-script style):
- `cssEscape`, `escapeHtml`, `sendToBridge`, `recordHistoryChange`, `showToast`, `updateInspectorFromSelection`, `scheduleOverlapDetection`, `getEntityKindLabel`, `rebuildPreviewKeepingContext`, `getNextNodeSeqInModel`, `compareVisualStackOrder`, `getLayerScopeInfo`, `applyLayerVisualOrder`, `normalizeLayersForCurrentScope`, `stagePreviewSelectionRestore`, `getActiveSlideModelElement`, `isLayerManagedNode`, `buildLayerVisualOrder`, `getSelectedModelNode`, `reportShellWarning`.

**Call-site unchanged:** `renderLayersPanel()` is still called from `inspector-sync.js:903` (line will be `if (state.complexityMode === 'advanced' && ...) { renderLayersPanel(); }` post-WO-19). Works via shared global scope.

**Selection.js LOC after this WO:** 1849 − 449 = **1400 LOC**.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/layers-panel.js` | new | +475 / −0 (449 moved + ZONE header + module comment) |
| `editor/src/selection.js` | edit | +3 / −449 (remove moved block + leave single ZONE-boundary comment) |
| `editor/presentation-editor.html` | edit | +1 / −0 (one new `<script src>` line) |
| `docs/CHANGELOG.md` | edit | +3 / −0 |
| `.codex/skills/html-presentation-editor/references/project-map.md` | edit | +5 / −3 (update module inventory) |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/selection.js` lines 1165–1613 | source of moved code |
| `editor/src/inspector-sync.js` line 903 | call site of `renderLayersPanel` |
| `editor/src/boot.js` (no direct call) | no init-time binding — `bindLayersPanelActions` called from inside `renderLayersPanel` |
| `editor/presentation-editor.html` lines 1761–1785 | script load order (layers-panel.js goes AFTER selection.js to keep classic-script ordering sane) |
| `docs/audit/AUDIT-A-architecture.md` §selection.js | split rationale |
| `docs/PAIN-MAP.md` §P1-06 | scope of the split |

### Sub-tasks (executable, each ≤ 2 h)

1. Run pre-flight `npm run test:gate-a` — 55/5/0 must hold. `npm run test:unit` — 42/42 must hold (post WO-16/17/18/19). Record baseline hash: `git rev-parse HEAD`. Expected state after: clean baseline for bisection.
2. Create `editor/src/layers-panel.js` with a header:
```
// layers-panel.js
// Layer: Domain Logic (Advanced Mode)
// Layers panel rendering, drag-drop, lock/visibility, grouping (v0.18.0)
// Extracted from selection.js in v0.31.0 per PAIN-MAP P1-06.
```
Expected state after: empty module file exists.
3. Copy the 18 functions listed in Split Map above from `selection.js:1165–1613` into `layers-panel.js`, preserving 6-space indentation convention. Do NOT modify any function body. Expected state after: layers-panel.js has ~449 LOC of moved code; selection.js still has the originals.
4. In `selection.js` delete the moved block (lines 1165–1613 inclusive) and leave a single comment:
```
      // [v0.18.0] Lock, Visibility, Layers Panel, Grouping moved to layers-panel.js (WO-20)
```
Expected state after: selection.js is 1849 - 449 + 1 = 1401 LOC. `renderLayersPanel`/etc. are no longer defined here.
5. Add `<script src="src/layers-panel.js"></script>` in `editor/presentation-editor.html` on a new line AFTER `<script src="src/selection.js"></script>` (line 1778) and BEFORE `<script src="src/toolbar.js"></script>` (line 1779). Classic-script ordering: selection.js defines selection+helpers; layers-panel.js uses them. Expected state after: script load order is `selection → layers-panel → toolbar`.
6. Search for any function reference that was incidentally-shadowed: `grep -n "toggleLayerLock\|toggleLayerVisibility\|reorderLayers\|renderLayersPanel\|bindLayersPanelActions\|groupSelectedElements\|ungroupSelectedElement\|isLayerSessionHidden\|setLayerSessionVisibility\|clearSessionOnlyVisibilityFromModelNode\|stripSessionOnlyVisibilityFromReplacement\|getEntityKindIcon\|getLayerLabel\|getPreviewLayerNode\|formatLayerStackHint\|buildLayerStatusChipHtml\|buildLayerStatusChipsHtml\|getRussianPlural" editor/src/*.js editor/presentation-editor.html`. For each hit, confirm it works via shared global scope. No `import` statements exist (ADR-001 invariant). Expected state after: every call site resolved against the new module.
7. Manual smoke test sequence: (a) open deck, switch to advanced mode, confirm layers panel renders with all layers; (b) click a layer row — selection propagates via bridge; (c) lock a layer via lock button — toast appears, `data-editor-locked` set; (d) hide a layer via visibility button — toast, layer removed from preview; (e) drag a layer row — reorder completes; (f) z-index input on active layer — persists; (g) `normalizeLayersBtn` → layers normalized with success toast. Expected state after: all 7 interactions work identically to v0.30.2.
8. Run `npm run test:gate-a` — must be 55/5/0. Run `npm run test:gate-b` — must be green (includes perf spec + any layer-navigation.spec.js). Run `npm run test:unit` — 42/42. Expected state after: all gates unchanged.
9. Update `.codex/skills/html-presentation-editor/references/project-map.md` module-count: 25 → 26. Add `layers-panel.js` to the inventory with one-line description `Advanced-mode layers panel: render + drag-drop + lock/visibility + grouping`. Expected state after: skill project-map reflects reality.
10. Update `docs/CHANGELOG.md` `## Unreleased` → `### Changed`: `Split selection.js → layers-panel.js (449 LOC extracted; PAIN-MAP P1-06 phase 1/2).` Do NOT claim P1-06 closed — that requires WO-21. Expected state after: changelog accurate.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added to package.json
- [ ] Gate-A is 55/5/0 before merge
- [ ] `file://` workflow still works (smoke: open + advanced mode + layers interact)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if new CSS layer) — N/A (no CSS touched)
- [ ] Russian UI-copy byte-identical (toast messages in `toggleLayerLock`/`toggleLayerVisibility` etc. preserved exactly)
- [ ] Script load order: `selection.js` loads BEFORE `layers-panel.js` (classic-script dependency direction — layers-panel depends on selection helpers via global scope)
- [ ] Zero `import` or `require` statements introduced
- [ ] Zero function-body edits — only moves (cosmetic edits like whitespace are disallowed in this WO; simplify comes later via skill `code-refactoring-refactor-clean`)
- [ ] `window.state` Proxy shim (from WO-16/17) still routes all reads correctly after the split
- [ ] `renderLayersPanel` callable from inspector-sync.js:903 (shared global)
- [ ] Sequential-merge rule: WO-20 merges FIRST, WO-21 merges in a SEPARATE commit. Never combined.

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `wc -l editor/src/selection.js` → 1400 ± 2 LOC (target 1401 — drop 449 keep 1 comment)
- [ ] `wc -l editor/src/layers-panel.js` → 475 ± 5 LOC
- [ ] `npm run test:gate-a` → 55/5/0 unchanged
- [ ] `npm run test:gate-b` → green (no flake in layer-navigation.spec.js which was flaky pre-WO per P1-17 — unchanged)
- [ ] `npm run test:unit` → 42/42
- [ ] Manual layers-panel 7-step smoke test (sub-task 7) passes with no console errors
- [ ] `grep -n "function renderLayersPanel" editor/src/selection.js` returns NO matches
- [ ] `grep -n "function renderLayersPanel" editor/src/layers-panel.js` returns exactly 1 match
- [ ] Project map updated with module count 26
- [ ] Commit message: `refactor(arch): split selection.js → layers-panel.js — v0.31.0 WO-20`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| basic deck load, advanced mode toggle | gate-a | `tests/playwright/editor.regression.spec.js` | pass (55/5/0) | pass (55/5/0) |
| layers panel renders on advanced mode | gate-b | `tests/playwright/layer-navigation.spec.js` | pass | pass |
| layer row click propagates selection | gate-b | `tests/playwright/layer-navigation.spec.js` | pass | pass |
| lock/unlock toast + data-editor-locked attr | manual | — | pass | pass |
| visibility toggle + session-only mode | manual | — | pass | pass |
| drag reorder via drag handle | gate-b | `tests/playwright/layer-navigation.spec.js` | pass | pass |
| z-index input commits + history | manual | — | pass | pass |

### Risk & mitigation

- **Risk:** A helper function in the moved block has a hidden dependency on another helper ALSO in the moved block; after the move, ordering within `layers-panel.js` breaks (function hoisting is per-file; cross-file is by script-load order).
- **Mitigation:** All 18 moved functions are non-nested `function` declarations — hoisting within `layers-panel.js` handles within-file order. Helpers that remain in `selection.js` (listed in Split Map) are declared there — load-order `selection.js` → `layers-panel.js` keeps them available.
- **Risk:** A test that relied on `selection.js` being the only source of `renderLayersPanel` catches the file reshape and fails — e.g. a grep-based fixture expectation.
- **Mitigation:** Grep tests directory: `grep -rn "selection.js" tests/`. If any test hardcodes a line reference, update it in-scope. Do NOT move unrelated test cleanup.
- **Risk:** `groupSelectedElements`/`ungroupSelectedElement` also touch `state.multiSelectNodeIds` — if that field is migrated to the selection slice in WO-17, the functions now read through the Proxy shim — verify read path unchanged.
- **Mitigation:** Sub-task 7 manual smoke-tests grouping. If `state.multiSelectNodeIds` reads stale under Proxy, that is a WO-17 bug, not WO-20 — but flag it in commit body.
- **Risk:** Script load order regression — someone puts `layers-panel.js` BEFORE `selection.js` in HTML thinking alphabetical is safer.
- **Mitigation:** Runtime guard at top of `layers-panel.js`: `if (typeof renderSelectionOverlay !== 'function') { throw new Error('selection.js must load before layers-panel.js'); }`. Fails loud at boot.
- **Risk:** WO-21 is supposed to run SEQUENTIALLY after WO-20 — agent runs both in parallel by mistake.
- **Mitigation:** `Depends on: WO-20` and `Unblocks: WO-21 (sequential)` declared in both WO headers. Integration agent E (per EXECUTION_PLAN) enforces ordering in Window 4 merge schedule. Branch prefix of WO-21 (`claude/wo-21-...`) must be created from the merged HEAD of WO-20, not from `main`.
- **Rollback:** `git revert <sha>`. Single-commit move — revert puts the 449 LOC back into selection.js and removes the new `<script src>` line. Zero downstream state migration. NO fix-forward under pressure.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:legacy-modernizer
isolation: worktree
branch_prefix: claude/wo-20-selection-js-split-layers-panel
```

````markdown
You are implementing Step 20 (v0.31.0 split selection.js → layers-panel.js) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-20-selection-js-split-layers-panel   (create from main, post WO-17 + WO-19 merge)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/audit/AUDIT-A-architecture.md §selection.js (split rationale)
  3. Read docs/PAIN-MAP.md §P1-06
  4. Read the full WO-20 split map (lines 1165–1613 of selection.js)
  5. Verify post-WO-19 state: `wc -l editor/src/selection.js` should be 1849, `npm run test:unit` 42/42, `npm run test:gate-a` 55/5/0
  6. `git rev-parse HEAD` to record baseline

FILES YOU OWN (exclusive write):
  - editor/src/layers-panel.js        (new — ~475 LOC)
  - editor/src/selection.js           (edit — delete 449 LOC, leave 1-line comment)
  - editor/presentation-editor.html   (edit — add ONE <script src> line)
  - docs/CHANGELOG.md
  - .codex/skills/html-presentation-editor/references/project-map.md

FILES READ-ONLY (reference only):
  - docs/audit/AUDIT-A-architecture.md
  - docs/PAIN-MAP.md
  - editor/src/inspector-sync.js (line 903 caller)
  - editor/src/boot.js (no direct caller — verify)

SUB-TASKS:
  1. Pre-flight gate-A + test:unit + baseline SHA
  2. Create layers-panel.js with header comment block
  3. Cut-paste 18 functions from selection.js:1165–1613 → layers-panel.js WITHOUT any body edits
  4. Delete the moved block from selection.js; leave 1 comment marker
  5. Add <script src="src/layers-panel.js"> in HTML after selection.js, before toolbar.js
  6. Audit all call sites via grep
  7. 7-step manual smoke test: advanced mode, layers panel render, click, lock, hide, reorder, z-index
  8. Run test:gate-a + test:gate-b + test:unit
  9. Update project-map.md (count 25 → 26)
  10. Update CHANGELOG.md (Changed section, do NOT claim P1-06 closed — WO-21 is next)

INVARIANTS (NEVER violate):
  - No type="module", no bundler
  - Gate-A 55/5/0 preserved
  - file:// still works
  - Zero function-body edits — cut/paste only (simplify pass comes later)
  - Russian UI copy byte-identical
  - Script load order: selection.js BEFORE layers-panel.js
  - Runtime guard at top of layers-panel.js: if (typeof renderSelectionOverlay !== 'function') throw ...
  - Zero import or require introduced
  - window.state Proxy reads still work for layers-panel functions
  - Sequential-merge with WO-21 (NEVER combined)

ACCEPTANCE:
  - selection.js LOC ~ 1401 (± 2)
  - layers-panel.js LOC ~ 475 (± 5)
  - Gate-A 55/5/0, Gate-B green, test:unit 42/42
  - Manual 7-step smoke passes with no console errors
  - project-map.md count 26
  - Conventional commit: refactor(arch): split selection.js → layers-panel.js — v0.31.0 WO-20

ON COMPLETION:
  1. Run acceptance matrix
  2. git add editor/src/layers-panel.js editor/src/selection.js editor/presentation-editor.html docs/CHANGELOG.md .codex/skills/html-presentation-editor/references/project-map.md
  3. Conventional commit per above
  4. Report back: selection.js LOC before/after, layers-panel.js LOC, Gate-A/B/unit results, any audit discoveries

IMPORTANT — WO-21 is NEXT, sequential. Do NOT start WO-21 in this branch.
````

### Rollback plan

If merge breaks main: `git revert <sha>` — single-commit cut/paste is fully reversible. Re-plan WO-20 smaller (e.g. split only drag-drop handlers first, keep rendering in selection.js), re-submit. Bisection rule: because WO-20 is a pure move, any post-merge regression points to a global-scope ordering mistake — fix via the runtime guard. NO fix-forward under pressure.
