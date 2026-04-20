## Step 25 — v0.27.0 · Empty-state rehome + starter-deck relocation

**Window:** W5   **Agent-lane:** D   **Effort:** S
**ADR:** ADR-005 (Onboarding Starter-Deck — extends)   **PAIN-MAP:** P0-15
**Depends on:** none   **Unblocks:** WO-24 (both touch empty-state UX, same release)

### Context (3–5 lines)

Empty-state card ships three visually co-equal CTAs (Open / Paste / Starter) with Starter last — the fastest evaluation path is buried. Starter-deck fixture lives at `/tests/fixtures/playwright/basic-deck.html` (`editor/src/constants.js:121`) which 404s in slim distributions that exclude the test tree. This WO re-orders CTAs to `Открыть HTML` (primary) → `Попробовать на примере` (secondary) → `Дополнительно ▾` disclosure for paste, and relocates the starter-deck fixture under `editor/fixtures/basic-deck.html`. Closes PAIN-MAP P0-15.

### Files owned (exclusive write)

| File | Op | LOC delta est |
|------|-----|---------------|
| `editor/fixtures/basic-deck.html` | new (copy from `tests/fixtures/playwright/basic-deck.html`) | +N / −0 |
| `editor/src/constants.js` | edit (`STARTER_DECKS.basic.href` + `manualBasePath`) | +2 / −2 |
| `editor/src/onboarding.js` | edit (button order, labels, disclosure markup) | +70 / −15 |
| `editor/styles/onboarding.css` | edit (disclosure styles) | +40 / −5 |
| `editor/presentation-editor.html` | edit (empty-state markup reorder + disclosure) | +20 / −10 |
| `tests/fixtures/playwright/basic-deck.html` | delete | +0 / −N |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/boot.js` | `loadStarterDeck("basic")` handler path |
| `editor/src/slides.js` | `loadStarterDeck` implementation; uses `STARTER_DECKS` map |
| `tests/playwright/specs/*.spec.js` | any reference to the old fixture path |
| `docs/audit/AUDIT-B-ux-journeys.md` | journey 1 detail (lines 47–75) |
| `docs/ADR-005-onboarding-starter-deck.md` | CTA ordering spec |

### Sub-tasks (executable, each ≤ 2 h)

1. Grep the repo for the exact string `/tests/fixtures/playwright/basic-deck.html` to enumerate every consumer. Playwright specs use raw path literals in `page.goto(...)` calls — DO NOT touch those; they test the old location. Only the `STARTER_DECKS.basic` constant is the user-facing binding. Expected state: a list of consumer files is printed to the commit notes.
2. Copy `tests/fixtures/playwright/basic-deck.html` byte-for-byte to `editor/fixtures/basic-deck.html` (create the `editor/fixtures/` directory). Verify by `diff` that the two files match. Keep the original in place — Playwright specs still use it.
3. Edit `editor/src/constants.js:119–125` — update the `STARTER_DECKS.basic` entry:
   ```javascript
   basic: Object.freeze({
     key: "basic",
     href: "editor/fixtures/basic-deck.html",
     label: "Попробовать на примере",
     manualBasePath: "editor/fixtures/",
   }),
   ```
   Label change is user-visible and matches AUDIT-B journey 1 recommendation.
4. Edit `editor/presentation-editor.html:455–470` — replace the three-button flex row with the rehomed layout. Exact markup:
```html
<div class="empty-state-actions">
  <button type="button" id="emptyOpenBtn" class="primary-btn">
    Открыть HTML
  </button>
  <button type="button" id="emptyStarterDeckBtn" class="ghost-btn">
    Попробовать на примере
  </button>
  <div class="empty-state-more" data-empty-state-more>
    <button
      type="button"
      id="emptyMoreToggleBtn"
      class="text-btn"
      aria-expanded="false"
      aria-controls="emptyMorePanel"
    >
      Дополнительно ▾
    </button>
    <div id="emptyMorePanel" class="empty-state-more-panel" hidden>
      <button type="button" id="emptyPasteBtn" class="ghost-btn">
        Вставить из буфера
      </button>
    </div>
  </div>
</div>
```
   Expected state: Open is the only primary button; Starter is ghost but second position; Paste lives behind disclosure.
5. Edit `editor/src/onboarding.js:24–58` — update `ensureNoviceShellOnboardingUi`:
   - Remove the dynamic-creation branch for `emptyPasteBtn` (now hard-coded in shell HTML).
   - Update `els.emptyStarterDeckBtn.textContent = "Попробовать на примере"` (line 55 today says `"Открыть стартовый пример"`).
   - Keep `els.emptyOpenBtn.textContent = "Открыть HTML"`.
   - Add `aria-label="Открыть стартовый пример"` to the starter button (preserves the old string as accessible name so screen readers keep context).
   - Reference: `editor/src/onboarding.js:54–56`.
6. Add `bindEmptyStateDisclosure()` in `editor/src/onboarding.js`. Wire `#emptyMoreToggleBtn` click:
   - toggles `hidden` on `#emptyMorePanel`
   - toggles `aria-expanded` on the button
   - toggles arrow glyph: `Дополнительно ▾` ↔ `Дополнительно ▴`
   - focuses `#emptyPasteBtn` when panel opens
   Call `bindEmptyStateDisclosure()` once during init — add the call at the end of `ensureNoviceShellOnboardingUi()`.
7. Edit `editor/styles/onboarding.css` — add the disclosure styles (use existing tokens `--space-2`, `--space-3`, `--text-sm`, `--shell-text-muted`, `--shell-field-bg`, `--radius-md`):
```css
.empty-state-more { margin-top: var(--space-3); }
.empty-state-more .text-btn {
  background: none; border: 0; color: var(--shell-text-muted);
  font-size: var(--text-sm); cursor: pointer; padding: var(--space-1) var(--space-2);
}
.empty-state-more .text-btn:hover { color: var(--shell-text); }
.empty-state-more-panel[hidden] { display: none; }
.empty-state-more-panel {
  margin-top: var(--space-2); padding: var(--space-3);
  background: var(--shell-field-bg); border-radius: var(--radius-md);
}
```
   Do NOT introduce new tokens.
8. Also optionally remove/demote the 3-step numbered list `.empty-state-steps` per AUDIT-B recommendation (lines 58–60 of audit). This is a UX improvement but kept as a safe toggle: wrap the list in a `hidden` attribute for this WO (preserve markup for reversibility) and let visual regression decide. Sub-task is safe-rollback-first.
9. If the starter-deck load fails (path 404), `loadStarterDeck("basic")` should show a toast `"Пример не найден — проверьте, что папка editor/fixtures присутствует в сборке."`. Confirm the existing error path in `editor/src/slides.js` renders this text; if it says something else, edit the toast line there (and only that line).
10. Delete `tests/fixtures/playwright/basic-deck.html` ONLY if step 1 found zero Playwright specs referencing it. Otherwise, leave the file in place — the relocation goal is satisfied by the `STARTER_DECKS.basic.href` change alone. Record the decision in the commit notes.
11. Manual smoke: open the editor from `file://`, confirm empty state shows two primary-visible buttons + `Дополнительно ▾`; click `Попробовать на примере`, verify the starter deck renders without 404; click `Дополнительно ▾`, verify Paste button appears and is focusable.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dependency added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow: starter deck loads from `editor/fixtures/basic-deck.html` without network
- [ ] No new `@layer` introduced (disclosure styles fit inside existing `onboarding.css`)
- [ ] Russian UI copy preserved — button labels `Открыть HTML`, `Попробовать на примере`, `Дополнительно ▾`, `Вставить из буфера`
- [ ] Accessible name for starter button still includes `стартовый пример` via `aria-label`
- [ ] Disclosure region has `aria-expanded` toggling on the control

### Acceptance criteria (merge-gate, falsifiable)

- [ ] Empty state renders exactly 2 visible buttons + 1 disclosure toggle (Open primary, Starter ghost, Дополнительно text-button), verified by spec `tests/playwright/specs/onboarding.spec.js` added or extended.
- [ ] Clicking `Попробовать на примере` loads `editor/fixtures/basic-deck.html` and renders ≥ 1 slide (assert `#slideRail [data-slide-id]` exists).
- [ ] Clicking `Дополнительно ▾` toggles `hidden` on `#emptyMorePanel` and `aria-expanded` on the button.
- [ ] `editor/fixtures/basic-deck.html` exists (git-tracked).
- [ ] `editor/src/constants.js` `STARTER_DECKS.basic.href` points at `editor/fixtures/basic-deck.html`.
- [ ] Gate-A still 55/5/0; onboarding spec in Gate-B passes.
- [ ] Conventional commit: `feat(ux): empty-state rehome + starter-deck relocation (P0-15) — v0.27.0 step 25`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Empty state renders 2 buttons + disclosure | gate-b | `tests/playwright/specs/onboarding.spec.js` | N/A | pass |
| Starter loads from editor/fixtures | gate-b | same spec | N/A | pass |
| Disclosure toggles hidden + aria-expanded | gate-b | same spec | N/A | pass |
| Gate-A regression | gate-a | `tests/playwright/specs/shell.smoke.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** `STARTER_DECKS.basic.href` path is resolved relative to the shell's own location when loaded from `file://`. A missing leading slash matters. The existing value `"/tests/fixtures/playwright/basic-deck.html"` has a leading slash; the new path `"editor/fixtures/basic-deck.html"` is relative. Test whether both file:// and http:// resolve.
- **Mitigation:** Test on file:// AND http:// before merge. If relative path fails on file://, use the computed resolution already present in `loadStarterDeck` (check `editor/src/slides.js:368`) — it handles manualBasePath.
- **Risk:** Playwright specs that hard-code `tests/fixtures/playwright/basic-deck.html` in their own `page.goto(...)` calls may break if step 10 deletes the file.
- **Mitigation:** Sub-task 1 enumerates consumers; step 10 is conditional — do not delete if consumers exist.
- **Risk:** Dark theme disclosure button lacks contrast.
- **Mitigation:** Style uses `--shell-text-muted` → `--shell-text` on hover; both themes include these tokens in `tokens.css:22, 21, 159, 158`.
- **Rollback:** `git revert <sha>`; leave `editor/fixtures/basic-deck.html` in place (harmless file).

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:ui-ux-designer
isolation: worktree
branch_prefix: claude/wo-25-starter-deck-rehome
```

````markdown
You are implementing Step 25 (v0.27.0 · empty-state rehome) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-25-starter-deck-rehome (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/ADR-005-onboarding-starter-deck.md
  3. Read docs/audit/AUDIT-B-ux-journeys.md journey 1 (lines 47–75)
  4. Read docs/work-orders/W5/WO-25-starter-deck-cta-rehome.md (this file)
  5. Run npm run test:gate-a — must be 55/5/0

FILES YOU OWN (exclusive write):
  - editor/fixtures/basic-deck.html (new, copy of existing fixture)
  - editor/src/constants.js (STARTER_DECKS entry only)
  - editor/src/onboarding.js (ensureNoviceShellOnboardingUi + new bindEmptyStateDisclosure)
  - editor/styles/onboarding.css (disclosure styles appended)
  - editor/presentation-editor.html (empty-state-actions markup only)
  - tests/playwright/specs/onboarding.spec.js (new or extend)

FILES READ-ONLY:
  - editor/src/boot.js, slides.js, state.js
  - docs/audit/PAIN-MAP.md (P0-15)

SUB-TASKS: follow 1–11 above verbatim.

INVARIANTS (NEVER violate):
  - No type="module"
  - No bundler
  - Russian UI copy: "Открыть HTML", "Попробовать на примере", "Дополнительно ▾", "Вставить из буфера"
  - aria-label of starter button retains "стартовый пример" for screen-reader continuity
  - No new @layer
  - Gate-A 55/5/0
  - Do NOT delete tests/fixtures/playwright/basic-deck.html unless step 1 confirms no Playwright consumer

ACCEPTANCE: verbatim from section above.

ON COMPLETION:
  1. Run npm run test:gate-a and npm run test:gate-b (onboarding spec)
  2. git add editor/fixtures/basic-deck.html editor/src/constants.js editor/src/onboarding.js editor/styles/onboarding.css editor/presentation-editor.html tests/playwright/specs/onboarding.spec.js
  3. Conventional commit: "feat(ux): empty-state rehome + starter-deck relocation (P0-15) — v0.27.0 step 25"
  4. Report: consumer list from step 1, whether old fixture was deleted, gate results
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Safe rollback: `editor/fixtures/basic-deck.html` can stay (harmless duplicate); re-point `STARTER_DECKS.basic.href` back to the old path.
