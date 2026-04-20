## Step 37 — v0.36.0 · Declarative keybindings table in `shortcuts.js` + `isAdvancedMode()` feature-flag accessor

**Window:** W8   **Agent-lane:** B (Architecture/Refactor)   **Effort:** M
**ADR:** —   **PAIN-MAP:** P2-04, P2-08
**Depends on:** WO-10 (keyboard nav completeness — table includes new rail arrow bindings from P0-08), WO-22 (boot.js split — `isAdvancedMode()` can live in `shell-layout.js` if boot is split first; otherwise in `boot.js`)   **Unblocks:** WO-38 (RC freeze — P2-04 and P2-08 resolved before release gate)

### Context (3–5 lines)

Per PAIN-MAP P2-04: `editor/src/shortcuts.js` lines 6–169 is a 160-line if/else chain binding keys to behavior. It handles `Ctrl+Z/Y`, `Ctrl+D`, `Ctrl+B/I/U/L/E/R`, `Ctrl+C/X/V`, `Ctrl+Shift+C/V`, `Ctrl+=/-/0`, Arrow nudges, `Delete`, `Ctrl+F`, `?`, `Escape`. Adding a keybinding means modifying the chain. Per PAIN-MAP P2-08: `complexityMode === "advanced"` is checked inline 21 times across 8 files — no single accessor. This WO refactors `shortcuts.js` into a **declarative keybindings table** driven by a `dispatch()` function, and introduces `isAdvancedMode()` accessor used wherever `complexityMode === "advanced"` appears. The table also enables auto-generation of the `?` cheat-sheet modal from data, retiring hand-maintained copy.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/shortcuts.js` | edit (full rewrite: if/else → declarative table + dispatch) | +180 / −163 |
| `editor/src/feature-flags.js` | new (`isAdvancedMode`, `isBasicMode`, other flag accessors) | +70 / −0 |
| `editor/src/selection.js` | edit (replace `complexityMode === "advanced"` occurrences with `isAdvancedMode()`) | +8 / −8 |
| `editor/src/inspector-sync.js` | edit (same replacement) | +8 / −8 |
| `editor/src/feedback.js` | edit (same replacement) | +6 / −6 |
| `editor/src/boot.js` | edit (same replacement where applicable) | +6 / −6 |
| `editor/src/primary-action.js` | edit (same replacement where applicable) | +4 / −4 |
| `editor/src/slide-rail.js` | edit (same replacement where applicable) | +4 / −4 |
| `editor/src/context-menu.js` | edit (same replacement where applicable) | +4 / −4 |
| `editor/src/import.js` | edit (same replacement where applicable) | +4 / −4 |
| `editor/presentation-editor.html` | edit (add `<script src="editor/src/feature-flags.js">` BEFORE `shortcuts.js`) | +1 / −0 |
| `editor/src/shell-overlays.js` OR `feedback.js` | edit (shortcuts cheat-sheet auto-rendered from table) | +40 / −30 |
| `tests/playwright/specs/shortcuts-table.spec.js` | new | +180 / −0 |
| `docs/CHANGELOG.md` | edit (append) | +10 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `docs/audit/PAIN-MAP.md` P2-04 + P2-08 | problem statement |
| `docs/audit/AUDIT-A-architecture.md` §"shortcuts.js" | scope — 160 LOC if/else |
| `editor/src/shortcuts.js` lines 1–217 | current implementation — refactor target |
| `editor/src/constants.js` | `DIRECT_MANIP_NUDGE_PX`, `DIRECT_MANIP_NUDGE_FAST_PX` |
| `editor/presentation-editor.html` — shortcuts modal region | cheat-sheet DOM anchor |

### Sub-tasks (executable, each ≤ 2 h)

1. **Read shortcuts.js fully (lines 1–217).** Enumerate every keybinding in a scratchpad: key chord + modifiers + condition + action. Expected table (minimum):
   | Chord | Condition | Action | Advanced-only? |
   |---|---|---|---|
   | `Escape` | always | close menus/modals, cancel manip | no |
   | `?` (Shift+/) | not-mod | open shortcuts modal | no |
   | `Ctrl+Z` | not-shift | undo | no |
   | `Ctrl+Y` or `Ctrl+Shift+Z` | — | redo | no |
   | `Ctrl+D` | — | duplicate selected | no |
   | `Ctrl+B` | text-entity + canEditStyles | toggle bold | no |
   | `Ctrl+I` | text-entity + canEditStyles | toggle italic | no |
   | `Ctrl+U` | text-entity + canEditStyles | toggle underline | no |
   | `Ctrl+L` | text-entity + canEditStyles | align left | no |
   | `Ctrl+E` | text-entity + canEditStyles | align center | no |
   | `Ctrl+R` | text-entity + canEditStyles | align right | no |
   | `Ctrl+C` | selection + edit mode | copy element | no |
   | `Ctrl+X` | selection + edit mode | cut element | no |
   | `Ctrl+V` | copiedElementHtml | paste element | no |
   | `Ctrl+Shift+C` | — | copy style | no |
   | `Ctrl+Shift+V` | — | paste style | no |
   | `Ctrl+=` / `Ctrl++` | — | zoom in | no |
   | `Ctrl+-` / `Ctrl+_` | — | zoom out | no |
   | `Ctrl+0` | — | zoom reset | no |
   | Arrow keys | selection + edit | nudge (Shift = fast) | no |
   | `Delete`/`Backspace` | selection + edit | delete element | no |
   | `Ctrl+F` | edit mode | open element finder | no |
   Expected state after: complete enumeration captured.
2. **Create `editor/src/feature-flags.js`.** Classic IIFE:
   ```javascript
   // feature-flags.js
   // Layer: UI feature-flag accessors (PAIN-MAP P2-08).
   // Use these instead of direct state.complexityMode reads.
   (function () {
     function isAdvancedMode() { return window.state && state.complexityMode === "advanced"; }
     function isBasicMode() { return !isAdvancedMode(); }
     function isTouchDevice() { return typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0); }
     window.isAdvancedMode = isAdvancedMode;
     window.isBasicMode = isBasicMode;
     window.isTouchDevice = isTouchDevice;
   })();
   ```
   Expected state after: three accessors exposed on window; no state pollution.
3. **Add script tag to `presentation-editor.html`.** Insert `<script src="editor/src/feature-flags.js"></script>` AFTER `constants.js` and BEFORE `shortcuts.js`. Expected state after: load order preserves predicates visibility.
4. **Refactor `shortcuts.js` to declarative table.** Structure:
   ```javascript
   const KEYBINDINGS = [
     { id: "escape", chord: "Escape", handler: handleEscape, always: true },
     { id: "help", chord: "?", handler: openShortcutsModal, when: (ctx) => !ctx.isMod },
     { id: "undo", chord: "Ctrl+Z", handler: undo, when: (ctx) => !ctx.event.shiftKey },
     { id: "redo-y", chord: "Ctrl+Y", handler: redo },
     { id: "redo-zs", chord: "Ctrl+Shift+Z", handler: redo },
     { id: "duplicate", chord: "Ctrl+D", handler: duplicateSelectedElement },
     { id: "bold", chord: "Ctrl+B", handler: () => toggleStyleOnSelected("fontWeight","700","400","bold"), when: isTextEditContext },
     // ... all 22 rows
   ];
   function dispatch(event) {
     const ctx = buildDispatchContext(event);
     for (const binding of KEYBINDINGS) {
       if (!chordMatches(binding.chord, event)) continue;
       if (binding.always) { /* always-fire handlers still run inside text edit */ }
       if (!binding.always && isActiveTextEditingContext(event)) return;
       if (!binding.always && shouldIgnoreGlobalShortcut(event)) return;
       if (binding.when && !binding.when(ctx)) continue;
       event.preventDefault();
       binding.handler(ctx);
       return;
     }
   }
   window.addEventListener("keydown", dispatch);
   ```
   Preserve the original behavior semantics — `Escape` still handles `state.activeManipulation`, modals closed in same order; `Alt` pointerPassthrough and keyup/blur/visibilitychange logic preserved. Expected state after: file is ~180 LOC (net +17 due to documentation); same runtime behavior.
5. **Export `KEYBINDINGS` to the window** as `window.KEYBINDINGS` (read-only — `Object.freeze([...])` the rows). The cheat-sheet modal consumes it for auto-generation. Each binding gets a `label` field (Russian-localized), e.g., `label: "Отменить"` for undo. Expected state after: table is the single source of truth for shortcuts.
6. **Auto-render shortcuts cheat-sheet** from the `KEYBINDINGS` table. Find the existing shortcuts modal render in `shell-overlays.js` or `feedback.js`. Replace the hand-maintained list with a loop over `KEYBINDINGS.filter(b => b.label)` producing `<tr>` rows `{chord, label}`. Preserve existing modal chrome. Expected state after: adding a new keybinding to the table automatically appears in `?` modal.
7. **Replace every `state.complexityMode === "advanced"` with `isAdvancedMode()`.** Grep first: `grep -rn 'complexityMode === "advanced"' editor/src/` should yield ~21 occurrences (PAIN-MAP P2-08). File-by-file replacement. Expected state after: single accessor consumed; grep returns ≤ 1 result (the definition in feature-flags.js).
8. **Replace every `state.complexityMode === "basic"` (if any) with `isBasicMode()`** — supplement. Expected state after: predicate symmetry.
9. **Create `tests/playwright/specs/shortcuts-table.spec.js` with 10 tests**:
   - SCT1: pressing `Ctrl+Z` in edit mode triggers undo (state-based verification via `state.historyIndex` change).
   - SCT2: pressing `Ctrl+Shift+Z` triggers redo.
   - SCT3: pressing `?` (Shift+/) opens shortcuts modal; modal is visible.
   - SCT4: shortcuts modal lists ≥ 20 entries auto-generated from `KEYBINDINGS` (query `#shortcutsModal` rows, count ≥ KEYBINDINGS with label).
   - SCT5: pressing `Ctrl+B` on selected text toggles `fontWeight`; pressing again reverses.
   - SCT6: pressing `Ctrl+F` in edit mode opens element finder.
   - SCT7: pressing `Delete` on selected element deletes it.
   - SCT8: pressing `Escape` during active manipulation cancels it.
   - SCT9: Arrow keys nudge selected by `DIRECT_MANIP_NUDGE_PX`; Shift+Arrow by `DIRECT_MANIP_NUDGE_FAST_PX`.
   - SCT10: `window.isAdvancedMode()` and `window.isBasicMode()` are booleans, mutually exclusive; toggling `state.complexityMode` flips them.
   Expected state after: 10 tests pass.
10. **Gate integration.** Prepend `tests/playwright/specs/shortcuts-table.spec.js` to `test:gate-b` chromium-desktop arg list in `package.json`. Do NOT add to Gate-A. Expected state after: Gate-B covers shortcuts; Gate-A unchanged.
11. **Run gate matrix** — `test:gate-a` 55/5/0, `test:gate-b` full pass. Manual verification: open editor, press every bindings in §1 table — each fires the same behavior as pre-refactor. Expected state after: no regression.
12. **Update `docs/CHANGELOG.md` under `## Unreleased` → `### Refactored`**: `shortcuts.js 160-line if/else chain replaced with declarative KEYBINDINGS table (P2-04). Shortcuts cheat-sheet (?) auto-renders from the table. New editor/src/feature-flags.js exposes isAdvancedMode() / isBasicMode() / isTouchDevice() — 21 inline "state.complexityMode === 'advanced'" checks consolidated (P2-08). (WO-37)`. Expected state after: CHANGELOG reflects refactor.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge AND after
- [ ] `file://` workflow still works
- [ ] NO new `@layer` added — behavior refactor only
- [ ] Russian UI-copy in KEYBINDINGS `label` fields (cheat-sheet text) preserved
- [ ] All 22 pre-existing shortcuts still work (press-test each in manual verification)
- [ ] `grep -rn 'complexityMode === "advanced"' editor/src/` returns ≤ 1 result (only in feature-flags.js source)
- [ ] `grep -rn 'complexityMode === "basic"' editor/src/` returns ≤ 1 result (or 0 if not defined symmetrically)
- [ ] `KEYBINDINGS` is frozen (`Object.freeze`) — mutation attempt fails
- [ ] `feature-flags.js` loaded BEFORE `shortcuts.js` in HTML
- [ ] Cheat-sheet modal displays table-generated entries, not hand-coded list

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `editor/src/shortcuts.js` is a declarative KEYBINDINGS table + dispatcher (no standalone `if (isMod && event.key === ...)` chains)
- [ ] `KEYBINDINGS` contains ≥ 22 rows with `{id, chord, handler}` at minimum, and `label` on every row that appears in cheat-sheet
- [ ] `editor/src/feature-flags.js` exists and exposes `isAdvancedMode`, `isBasicMode`, `isTouchDevice` as window globals
- [ ] `tests/playwright/specs/shortcuts-table.spec.js` 10 tests all pass on chromium-desktop
- [ ] `npm run test:gate-a` remains 55/5/0
- [ ] `npm run test:gate-b` passes with added spec
- [ ] Grep invariant: `grep -rn 'complexityMode === "advanced"' editor/src/` returns ≤ 1 line
- [ ] Manual verification: press every key in the 22-row table — behavior matches pre-refactor
- [ ] Cheat-sheet modal (`?`) lists all labeled bindings from the table (not fewer; extras acceptable)
- [ ] Commit message in conventional-commits format: `refactor(shortcuts): declarative KEYBINDINGS + isAdvancedMode() accessor (P2-04, P2-08) — v0.36.0 WO-37`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| SCT1 Ctrl+Z triggers undo | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| SCT2 Ctrl+Shift+Z triggers redo | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| SCT3 ? opens shortcuts modal | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| SCT4 cheat-sheet auto-generates | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| SCT5 Ctrl+B toggles bold | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| SCT6 Ctrl+F opens finder | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| SCT7 Delete removes element | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| SCT8 Escape cancels manip | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| SCT9 Arrow nudge / Shift+Arrow fast nudge | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| SCT10 isAdvancedMode()/isBasicMode() booleans | gate-b | `tests/playwright/specs/shortcuts-table.spec.js` | N/A | pass |
| gate-a baseline | gate-a | all four | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** Shortcut refactor changes handler timing or modifier detection — a key chord that used to fire might not.
- **Mitigation:** `chordMatches(chord, event)` helper handles `Ctrl+` / `Meta+` / `Shift+` / `Alt+` prefixes consistently. Port the exact `isMod = event.ctrlKey || event.metaKey` semantic. Manual verification (acceptance #8) catches any regression before merge.
- **Risk:** Auto-rendered cheat-sheet reorders entries vs. hand-maintained list, breaking muscle memory.
- **Mitigation:** `KEYBINDINGS` table order IS the cheat-sheet order. Curate table order to match existing modal order. Expected state after cheat-sheet render documented in SCT4.
- **Risk:** `feature-flags.js` script load race — if it's loaded AFTER a module that calls `isAdvancedMode()` at parse time, the call is undefined.
- **Mitigation:** `feature-flags.js` loads immediately after `constants.js`, before any consumer script. No module calls `isAdvancedMode()` at parse time — all calls are inside event handlers or render functions. Manual grep pre-merge.
- **Risk:** `Escape` + modal-close order relies on specific side-effects; table dispatch uses the first-match rule which might close context menu before canceling manipulation.
- **Mitigation:** `handleEscape(ctx)` preserves the exact order from original: (1) if `state.activeManipulation` cancel + return, (2) close context menu, (3) close modals in exact pre-existing order. Spec SCT8 asserts the manip-cancel branch.
- **Risk:** `Ctrl+B/I/U/L/E/R` require `isTextEntity && canEditStyles && canEditText` — regressing that conditional breaks format shortcuts inside text edit.
- **Mitigation:** `isTextEditContext(ctx)` helper reproduces the exact predicate tree. SCT5 tests the ON branch; additionally add a test that Ctrl+B on image entity does NOT toggle a style.
- **Rollback:** `git revert <sha>`. Shortcut chain is restored. feature-flags.js file removed; 21 inline checks revert. Cheat-sheet regains hand-coded list. No data migration.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:legacy-modernizer
isolation: worktree
branch_prefix: claude/wo-37-shortcut-declarative-table
```

````markdown
You are implementing Step 37 (v0.36.0 declarative shortcuts + isAdvancedMode) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-37-shortcut-declarative-table   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read PAIN-MAP P2-04 (shortcuts) + P2-08 (feature flag)
  3. Read editor/src/shortcuts.js in full (217 LoC)
  4. Read editor/src/constants.js (nudge constants)
  5. Grep 'complexityMode === "advanced"' in editor/src/ — confirm ~21 occurrences across 8 files
  6. Read editor/presentation-editor.html — locate <script> load order
  7. Read existing shortcuts modal render site (grep 'shortcutsModal' in feedback.js or shell-overlays.js)
  8. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/shortcuts.js                                   (rewrite: declarative table)
  - editor/src/feature-flags.js                               (new, IIFE)
  - editor/src/selection.js                                    (replace predicate)
  - editor/src/inspector-sync.js                               (replace predicate)
  - editor/src/feedback.js                                     (replace predicate)
  - editor/src/boot.js                                         (replace predicate)
  - editor/src/primary-action.js                               (replace predicate)
  - editor/src/slide-rail.js                                   (replace predicate)
  - editor/src/context-menu.js                                 (replace predicate)
  - editor/src/import.js                                       (replace predicate)
  - editor/src/shell-overlays.js OR feedback.js                (cheat-sheet auto-render)
  - editor/presentation-editor.html                            (add <script> tag)
  - tests/playwright/specs/shortcuts-table.spec.js             (new, 10 tests)
  - package.json                                               (gate-b spec list)
  - docs/CHANGELOG.md                                          (append)

FILES READ-ONLY (reference only):
  - docs/audit/PAIN-MAP.md
  - docs/audit/AUDIT-A-architecture.md

SUB-TASKS: (verbatim from WO sub-tasks 1–12)

INVARIANTS (NEVER violate):
  - No type="module"; feature-flags.js is classic IIFE
  - No bundler
  - Gate-A 55/5/0 preserved
  - Russian cheat-sheet labels preserved
  - All 22 original shortcuts behave identically
  - grep 'complexityMode === "advanced"' returns ≤ 1 result after merge
  - KEYBINDINGS is Object.frozen
  - file-order: constants.js → feature-flags.js → shortcuts.js

ACCEPTANCE: (verbatim from Acceptance criteria section)

ON COMPLETION:
  1. Run full acceptance matrix — gate-a 55/5/0, gate-b +10 pass
  2. Manual press-test all 22 bindings
  3. Check cheat-sheet modal auto-generation
  4. grep 'complexityMode === "advanced"' editor/src/ | wc -l  → ≤ 1
  5. git add editor/src/shortcuts.js editor/src/feature-flags.js editor/src/selection.js
       editor/src/inspector-sync.js editor/src/feedback.js editor/src/boot.js
       editor/src/primary-action.js editor/src/slide-rail.js editor/src/context-menu.js
       editor/src/import.js editor/src/shell-overlays.js editor/presentation-editor.html
       tests/playwright/specs/shortcuts-table.spec.js package.json docs/CHANGELOG.md
  6. Conventional commit: "refactor(shortcuts): declarative KEYBINDINGS + isAdvancedMode() accessor (P2-04, P2-08) — v0.36.0 WO-37"
  7. Report back: files changed, LOC delta, gate results, predicate-consolidation count
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Shortcuts file + feature-flags + 8 predicate edits revert cleanly. Cheat-sheet modal reverts to hand-coded list. No data loss. NO fix-forward under pressure.

---
