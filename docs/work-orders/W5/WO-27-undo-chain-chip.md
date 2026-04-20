## Step 27 — v0.27.2 · Topbar undo-budget chip + toast-on-drop

**Window:** W5   **Agent-lane:** D   **Effort:** S
**ADR:** ADR-013 (Observable Store — soft tie; scaffolds onto `window.state` now)   **PAIN-MAP:** P0-07 (part 1)
**Depends on:** none (re-wires to observable store later when WO-16/17/18 land)   **Unblocks:** —

### Context (3–5 lines)

Undo chain silently drops the oldest entry at `HISTORY_LIMIT = 20` (`editor/src/constants.js:105`, `editor/src/export.js:593`). Users lose work without warning (AUDIT-B journey 7, PAIN-MAP P0-07). This WO adds (1) a topbar chip reading `N/20` that reflects `state.history.length` against `HISTORY_LIMIT`, (2) a toast `Самая старая правка вытеснена — история ограничена 20 шагами` on first drop per session with action `Сжать историю` (deduplicates consecutive snapshots), and (3) a toast on Ctrl+Z at index 0 saying `Это самое раннее состояние`. All three surfaces read the `HISTORY_LIMIT` constant — never hardcode `20` in UI code.

### Files owned (exclusive write)

| File | Op | LOC delta est |
|------|-----|---------------|
| `editor/src/history-chip.js` | new | +140 / −0 |
| `editor/styles/history-chip.css` | new | +60 / −0 |
| `editor/styles/tokens.css` | edit (layer declaration) | +1 / −1 |
| `editor/presentation-editor.html` | edit (chip markup + script tag) | +10 / −0 |
| `editor/src/export.js` | edit (emit event on drop) | +10 / −0 |
| `editor/src/history.js` | edit (emit event on boundary Ctrl+Z + chip update) | +20 / −2 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/constants.js:105` | `HISTORY_LIMIT` source of truth |
| `editor/src/state.js` | `state.history`, `state.historyIndex` fields |
| `editor/src/feedback.js` | `showToast(message, { actionLabel, onAction, ttl })` API |
| `editor/src/primary-action.js:13–15` | undo/redo button disabled logic |
| `editor/presentation-editor.html:121–122` | `#undoBtn` / `#redoBtn` |
| `docs/ADR-013-observable-store.md` | future re-wiring target |

### Sub-tasks (executable, each ≤ 2 h)

1. Read `editor/src/constants.js:105` to confirm `HISTORY_LIMIT = 20`. The chip MUST import this value — do NOT hardcode `20` in chip code or toast copy. Copy the constant inline via `const limit = (typeof HISTORY_LIMIT === "number" ? HISTORY_LIMIT : 20);` with fallback for defensive classic-script load order.
2. Add the chip markup to `editor/presentation-editor.html` inside the topbar state cluster, next to `#saveStatePill`. Search the shell for `id="saveStatePill"` (around line 85) and append:
```html
<span
  id="historyBudgetChip"
  class="status-pill history-pill"
  role="status"
  aria-live="polite"
  title="Сколько шагов помнит редактор"
  hidden
>
  <span class="history-pill__count" id="historyBudgetChipCount">0</span>
  <span class="history-pill__limit">/<span id="historyBudgetChipLimit">20</span></span>
</span>
```
   Note: the `20` inside HTML is placeholder — it is immediately overwritten on first render from `HISTORY_LIMIT`. The JS writes `document.getElementById("historyBudgetChipLimit").textContent = String(HISTORY_LIMIT);` at init.
3. Create `editor/styles/history-chip.css` in a NEW `@layer history-chip`. Styles use existing tokens (`--shell-field-bg`, `--shell-border`, `--shell-text`, `--shell-text-muted`, `--shell-accent`, `--shell-warning-bg`, `--shell-warning`, `--radius-sm`, `--text-xs`, `--space-1`, `--space-2`):
```css
@layer history-chip {
  .history-pill {
    display: inline-flex; align-items: center; gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--shell-border);
    border-radius: var(--radius-sm);
    background: var(--shell-field-bg);
    color: var(--shell-text-muted);
    font-size: var(--text-xs);
    font-variant-numeric: tabular-nums;
  }
  .history-pill[data-state="near-limit"] {
    color: var(--shell-warning);
    background: var(--shell-warning-bg);
  }
  .history-pill[data-state="at-limit"] {
    color: var(--shell-warning);
    background: var(--shell-warning-bg);
    border-color: var(--shell-warning-border);
  }
  .history-pill__count { font-weight: 600; color: inherit; }
  .history-pill__limit { opacity: 0.7; }
}
```
4. Edit `editor/styles/tokens.css:2` — extend layer declaration: insert `history-chip` before `modal`. Expected state: `@layer tokens, base, layout, preview, broken-asset-banner, inspector, overlay, history-chip, modal, responsive;`.
   Note: if WO-24 landed first, merge `broken-asset-banner` + `history-chip` into the same cascade; otherwise write only `history-chip` without the broken-asset-banner entry.
5. Create `editor/src/history-chip.js` — classic-script module. Exports globals:
   - `window.updateHistoryChip()` — reads `state.history.length` and `state.historyIndex`; renders count = `state.history.length`, updates `data-state` attribute:
     - hidden if `state.history.length === 0`
     - default state if `length < HISTORY_LIMIT - 5`
     - `data-state="near-limit"` if `length >= HISTORY_LIMIT - 5 && length < HISTORY_LIMIT`
     - `data-state="at-limit"` if `length >= HISTORY_LIMIT`
   - `window.notifyHistoryDropped()` — call on drop. Uses `sessionStorage['editor:history-drop-toast-shown'] !== '1'` to show the toast only once per session:
     ```javascript
     showToast(
       `Самая старая правка вытеснена — история ограничена ${HISTORY_LIMIT} шагами`,
       {
         actionLabel: "Сжать историю",
         onAction: () => window.compactHistory?.(),
         ttl: 6500,
       }
     );
     sessionStorage.setItem("editor:history-drop-toast-shown", "1");
     ```
   - `window.notifyHistoryFloor()` — call on Ctrl+Z at `historyIndex === 0`. Shows a short toast `Это самое раннее состояние` with 3500ms TTL, no action button.
   - `window.compactHistory()` — de-duplicates consecutive identical `snapshot.html` strings in `state.history` (in-place), recomputes `state.historyIndex` to point to the same snapshot post-dedup, calls `updateHistoryChip()`, toast on completion `Сжато: удалено N повторов`.
   - `window.bindHistoryChip()` — bound once at init; calls `updateHistoryChip()` as initial render.
6. Edit `editor/src/export.js` around line 593 — immediately before `state.history.shift();`, insert:
   ```javascript
   const droppedAtLimit = true; // entering the drop branch
   ```
   and immediately after the `state.historyIndex = state.history.length - 1;` line insert:
   ```javascript
   window.notifyHistoryDropped?.();
   window.updateHistoryChip?.();
   ```
   Also add a `window.updateHistoryChip?.();` on every `captureHistorySnapshot` success path (i.e. after `state.history.push(snapshot);` a few lines earlier). The goal is the chip reflects current state after every commit.
7. Edit `editor/src/history.js:5–8` (undo function). Add floor detection:
   ```javascript
   function undo() {
     if (state.historyIndex <= 0) {
       window.notifyHistoryFloor?.();
       return;
     }
     state.historyIndex -= 1;
     restoreSnapshot(state.history[state.historyIndex]);
     window.updateHistoryChip?.();
   }
   ```
   Mirror pattern for `redo()` — no toast on the ceiling (less dangerous) but still call `updateHistoryChip()` after the index change.
8. Register the new script. Add `<script src="editor/src/history-chip.js"></script>` in `editor/presentation-editor.html` AFTER `feedback.js` and `constants.js` (so HISTORY_LIMIT is in scope) and BEFORE `history.js`. Order matters for classic-script globals.
9. Hook `bindHistoryChip()` from init. Add the call to the init sequence next to other chip/pill initializers (search for `updateSaveStatePill` as a proxy for location).
10. Verify `state.js` exposes `historyBudgetChip` and `historyBudgetChipCount` element refs. If not, use inline `document.getElementById` inside `updateHistoryChip` (same pattern as WO-26 fallback).
11. Manual smoke:
    - Load a deck. Chip shows `0/20` then `1/20` after first edit.
    - Edit 15 times. Chip reads `15/20`, `data-state="near-limit"` (warning color).
    - Edit 20 times total. Chip reads `20/20`, toast fires `Самая старая правка вытеснена`. Click `Сжать историю` — if there are dedup candidates the toast follows up with `Сжато: удалено N повторов`; otherwise silent.
    - Ctrl+Z 20 times. On the 21st press, toast `Это самое раннее состояние`.
    - Reload the tab — per-session `sessionStorage` flag clears, drop toast can fire again next session.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dependency added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] New `@layer history-chip` declared in `tokens.css`
- [ ] `HISTORY_LIMIT` is the ONLY source of the limit number — no `20` literal in history-chip.js except as fallback in the guard described in sub-task 1
- [ ] Chip text, toast text, all tooltips in Russian: `Сколько шагов помнит редактор`, `Самая старая правка вытеснена — история ограничена 20 шагами`, `Сжать историю`, `Сжато: удалено N повторов`, `Это самое раннее состояние`
- [ ] Chip is part of the topbar state cluster (next to `#saveStatePill`), not a separate surface

### Acceptance criteria (merge-gate, falsifiable)

- [ ] After 5 edits, `#historyBudgetChip` is visible with text `5/20`, verified by spec `tests/playwright/specs/history-chip.spec.js` (new).
- [ ] At 20 edits, `#historyBudgetChip[data-state="at-limit"]` is true and a toast with action `Сжать историю` has appeared.
- [ ] At historyIndex 0, pressing Ctrl+Z triggers a toast containing `Это самое раннее состояние`.
- [ ] `sessionStorage['editor:history-drop-toast-shown'] === '1'` after first drop; no second drop toast fires in the same session.
- [ ] Grep confirms zero `\b20\b` literals in `editor/src/history-chip.js` outside the fallback guard on line 1.
- [ ] Gate-A still 55/5/0.
- [ ] Conventional commit: `feat(ux): undo-budget chip + drop toast (P0-07 part 1) — v0.27.2 step 27`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Chip reflects N/HISTORY_LIMIT | gate-b | `tests/playwright/specs/history-chip.spec.js` (new) | N/A | pass |
| data-state transitions default → near-limit → at-limit | gate-b | same spec | N/A | pass |
| Drop toast fires once per session | gate-b | same spec | N/A | pass |
| Floor toast fires on Ctrl+Z at index 0 | gate-b | same spec | N/A | pass |
| compactHistory dedups consecutive identical snapshots | gate-b | same spec | N/A | pass |
| Gate-A regression | gate-a | `tests/playwright/specs/shell.smoke.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** Chip refresh gets out of sync with `state.history` because mutations live in multiple modules (export.js, history.js, import.js resets).
- **Mitigation:** Every mutation site calls `window.updateHistoryChip?.();` immediately after. Document this requirement in the top comment of `history-chip.js`. When observable store (WO-16/17/18 of Agent γ) lands, re-wire via `store.subscribe("history", updateHistoryChip)` and remove the explicit calls.
- **Risk:** `sessionStorage` guard prevents the toast from teaching the user more than once, but users who work across multiple decks in one session want to be reminded per new deck.
- **Mitigation:** Also clear the flag inside `import.js` when a new deck loads (reuse `state.historyIndex = -1;` site at line 85). Add one line `sessionStorage.removeItem("editor:history-drop-toast-shown");` right after.
- **Risk:** `compactHistory()` changes `state.historyIndex` semantics; Ctrl+Z may jump further than expected.
- **Mitigation:** Post-dedup, set `state.historyIndex` to point to the same snapshot hash as before compaction. If not findable, clamp to `state.history.length - 1`. Test spec asserts post-compact Ctrl+Z produces the expected state.
- **Rollback:** `git revert <sha>`. Chip is additive; two edits in export.js and history.js each are one-liners that revert cleanly.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:frontend-developer
isolation: worktree
branch_prefix: claude/wo-27-undo-chain-chip
```

````markdown
You are implementing Step 27 (v0.27.2 · undo-chain chip) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-27-undo-chain-chip (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/ADR-013-observable-store.md (scan section "Applied In" for the scheduled re-wire)
  3. Read docs/audit/AUDIT-B-ux-journeys.md journey 7 (lines 241–269)
  4. Read docs/work-orders/W5/WO-27-undo-chain-chip.md (this file)
  5. npm run test:gate-a — must be 55/5/0

FILES YOU OWN (exclusive write):
  - editor/src/history-chip.js (new)
  - editor/styles/history-chip.css (new)
  - editor/styles/tokens.css (layer declaration line only)
  - editor/presentation-editor.html (chip markup + script tag only)
  - editor/src/export.js (only the captureHistorySnapshot drop path + push-success path)
  - editor/src/history.js (only undo/redo functions)
  - editor/src/import.js (one line to reset sessionStorage flag)
  - tests/playwright/specs/history-chip.spec.js (new)

FILES READ-ONLY:
  - editor/src/constants.js, state.js, feedback.js, primary-action.js
  - docs/audit/PAIN-MAP.md (P0-07)

SUB-TASKS: verbatim 1–11 above.

INVARIANTS:
  - No type="module"; no bundler
  - HISTORY_LIMIT is the single source of the number. No literal 20 in JS except the fallback guard line in history-chip.js
  - Russian UI copy only (see Invariant checks above)
  - New @layer history-chip declared in tokens.css BEFORE css file created
  - Chip lives inside the topbar state cluster
  - Gate-A 55/5/0
  - Observable store readiness: keep updateHistoryChip and notifyHistoryDropped idempotent functions that WO-16/17/18 can subscribe-wire later

ACCEPTANCE: verbatim from section above.

ON COMPLETION:
  1. npm run test:gate-a and test:gate-b
  2. git add <list above>
  3. Conventional commit: "feat(ux): undo-budget chip + drop toast (P0-07 part 1) — v0.27.2 step 27"
  4. Report: chip rendering at 0/5/15/20 edits, drop toast fired, compact result

CROSS-BATCH HAND-OFF:
  Agent γ's WO-16/17/18 (observable store) will later migrate state.history into a slice.
  When that lands, replace explicit window.updateHistoryChip?.() calls with a single
  store.subscribe("history", updateHistoryChip) wired at init. Leave a comment "// TODO(WO-16/17): re-wire to store" at each explicit call site.
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Chip is additive; reverts cleanly.
