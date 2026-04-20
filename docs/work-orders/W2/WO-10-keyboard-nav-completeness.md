## Step 10 — v0.27.1 · Tab-order + rail ↑/↓/Space + focus-trap audit

**Window:** W2   **Agent-lane:** B   **Effort:** L
**ADR:** ADR-006   **PAIN-MAP:** P0-05, P0-08
**Depends on:** WO-09 (reuses `tests/a11y/helpers/axe-harness.js` and `tests/a11y/` harness)   **Unblocks:** none in this batch

### Context (3–5 lines)

PAIN-MAP P0-05 (keyboard-only workflow blocked at 3+ surfaces) and P0-08 (slide rail has no ↑/↓ or Space reorder) are the two keyboard a11y blockers for v1.0. AUDIT-B journey 8 lists the failures concretely; AUDIT-B journey 12 details the rail gap. This WO ships two deliverables: (1) `tests/a11y/keyboard-nav.spec.js` that asserts end-to-end tab-order across topbar → rail → preview → inspector; (2) rail `↑/↓` roving-tabindex + `Alt+↑/Alt+↓` reorder inside `editor/src/slide-rail.js`. Existing rail handler sits at `editor/src/slide-rail.js:126–141` (Enter/Space/ContextMenu already; arrows absent). Focus-trap audit for modals (`#openHtmlModal`, `#shortcutsModal`, `#videoInsertModal`) is added as a third test.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `tests/a11y/keyboard-nav.spec.js` | new | +240 / −0 |
| `editor/src/slide-rail.js` | edit | +70 / −5 |
| `editor/src/shortcuts.js` | edit | +14 / −0 |
| `editor/styles/panels.css` | edit | +8 / −0 |
| `docs/CHANGELOG.md` | edit | +3 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/presentation-editor.html` | lines 196–249 (rail container `#slidesPanel`/`#slidesList`), 72–184 (topbar tab-order), 762+ (inspector tab-order) |
| `editor/src/slide-rail.js` | lines 4–172 — renderSlidesList, existing keydown handler at 126–141 |
| `editor/src/shortcuts.js` | lines 6–169 — global shortcuts if/else chain (do not restructure — PAIN-MAP P2-04 is a separate WO) |
| `editor/src/slides.js` | `moveSlideToIndex` signature — used for Alt+↑ / Alt+↓ reorder |
| `editor/src/feedback.js` | workflow markers reused from WO-09 |
| `tests/a11y/helpers/axe-harness.js` | created by WO-09; optional reuse for focus-ring visibility assertion |
| `docs/ADR-006-accessibility-ci-gate.md` | normative spec |
| AUDIT-B journey 8 + 12 | gap description |

### Sub-tasks (executable, each ≤ 2 h)

1. Read existing rail keydown handler at `editor/src/slide-rail.js:126–141`. Confirm: Enter/Space activate, ContextMenu/Shift+F10 open menu; no ArrowUp/ArrowDown/Alt+Arrow; every item is `tabindex="0"` (line 37). Reference: `editor/src/slide-rail.js:37, 126–141`. Expected state after: baseline behavior confirmed.
2. In `renderSlidesList` (lines 4–172), replace the blanket `item.setAttribute("tabindex", "0")` with **roving tabindex**: only the active slide gets `tabindex="0"`, all others `tabindex="-1"`. Reference: `editor/src/slide-rail.js:36–37`. Expected state after: rail stops eating N Tab stops for N slides; single tab stop at active slide.
3. Extend the keydown handler at `editor/src/slide-rail.js:126–141`. Add two clauses: (a) `ArrowDown`/`ArrowUp` → move focus to next/previous slide item, update roving tabindex, call `.focus()`. (b) `Alt+ArrowDown`/`Alt+ArrowUp` → call `moveSlideToIndex(currentIndex, currentIndex ± 1, { activateMovedSlide: false })`. Preserve existing Enter/Space/ContextMenu/Shift+F10 semantics. Expected state after: arrow-nav + arrow-reorder works while menu + activate paths unchanged.
4. Update the rail `aria-label` template to announce reorderability when Alt-arrows fire: emit `aria-live="polite"` message via existing `feedback.js::showToast("success", ...)` using Russian copy `"Слайд перемещён: позиция N → M"`. Keep other localized copy. Expected state after: screen reader hears motion acknowledgement.
5. Add body-scoped CSS in `editor/styles/panels.css` for visible `:focus-visible` ring on `.slide-item[tabindex="0"]:focus-visible` using existing tokens (`--focus-ring-color` / `--focus-ring-width`; if tokens absent, add to `tokens.css` first — CHECK `editor/styles/tokens.css` contents BEFORE editing; if adding, declare `@layer` tokens first per invariant). Reference: AUDIT-B journey 8 — focus ring may be invisible on dark theme. Expected state after: focus ring verifiably visible in both light and dark themes.
6. In `editor/src/shortcuts.js` around lines 135–151 (arrow-key nudge block), add an early-return guard: if the keydown source is inside `#slidesPanel`, let the rail handler own arrow keys (do NOT perform element nudge). Coordination: Agent δ's WO-28 (snap+nudge) also touches nudge behavior — gating by source container avoids double-handling. Reference: `editor/src/shortcuts.js:135–151`. Expected state after: arrow nudge inside preview still works; arrow nav inside rail still works; no double-firing.
7. Create `tests/a11y/keyboard-nav.spec.js` with these tests — each must be labelled with PAIN-MAP ID in description:
   - `P0-05 · Tab from topbar reaches rail first stop → preview primary → inspector first control`
   - `P0-05 · Escape closes shortcuts modal, layer picker, context menu (focus returns to opener)`
   - `P0-08 · ArrowDown/ArrowUp cycle rail items with roving tabindex (only 1 slide has tabindex="0")`
   - `P0-08 · Alt+ArrowDown reorders active slide within rail (asserts via exposed state or rail DOM order)`
   - `P0-05 · Modal focus trap — Tab from last focusable cycles to first; Shift+Tab reverse (test on #openHtmlModal, #shortcutsModal)`
   - `P0-05 · "Следующий слайд" button (topbar) preserves Russian aria-label` (sanity test that Russian UI-copy is unchanged after refactor)
   Expected state after: 6 tests, all green; each uses Playwright `page.keyboard.press()` and `locator.evaluate()` — no mouse events.
8. Verify Gate-A via `npm run test:gate-a` — must be 55/5/0. Run `npm run test:gate-a11y` — 6 new tests must be green. Expected state after: both gates green.
9. Run manual smoke: open editor from `file://`, load starter deck, confirm Tab lands on rail active slide, ArrowDown cycles, Alt+ArrowUp reorders, focus ring is visible on dark theme. Expected state after: manual observation documented in commit message tail.
10. Update `docs/CHANGELOG.md` unreleased entry: `feat(a11y): rail keyboard nav (↑/↓, Alt+↑/↓) + focus-trap audit — P0-05 / P0-08`. Expected state after: changelog entry present.
11. Update `docs/ADR-006-accessibility-ci-gate.md` Status line to `Accepted (shell-a11y + keyboard-nav shipped; contrast pending WO-11)`. Expected state after: ADR reflects partial shipping.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open, Tab to rail, ArrowDown cycles)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer added for focus ring tokens)
- [ ] Russian UI-copy strings preserved: `"Следующий слайд"`, `"Слайд перемещён:"`, `"Действия со слайдом"` stay Russian
- [ ] `test:gate-a11y` stays ADDITIVE — new tests added to `tests/a11y/` only, Gate-A baseline 55/5/0 untouched
- [ ] Keyboard navigation works identically at both `file://` and `http://localhost` origins (manually verified + spec runs on webServer which is http)
- [ ] Arrow-key nudge inside preview still works (not broken by rail handler) — manual: select preview element, ArrowRight moves it
- [ ] Roving tabindex: exactly ONE slide item has `tabindex="0"` at any time; others have `tabindex="-1"`

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:gate-a` prints `55 passed, 5 skipped, 0 failed` (unchanged)
- [ ] `npm run test:gate-a11y` includes 6 new `keyboard-nav.spec.js` tests — all green
- [ ] `grep -c 'tabindex="0"'` within rail DOM at runtime = exactly 1 (verifiable via `page.evaluate` assertion inside spec)
- [ ] `moveSlideToIndex` is called at least once during Alt+ArrowDown spec (spy verified)
- [ ] Russian UI-copy test asserts `aria-label` contains Cyrillic characters — will fail if the string is translated to English
- [ ] Focus ring visible on `.slide-item:focus-visible` in computed styles — spec asserts `getComputedStyle(el).outlineWidth !== '0px' || getComputedStyle(el).boxShadow !== 'none'`
- [ ] Commit message: `feat(a11y): rail keyboard nav + focus-trap audit — v0.27.1 step 10`
- [ ] ADR-006 Status reflects partial shipping (keyboard-nav added)

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Topbar → rail → preview → inspector tab-order | gate-a11y | `tests/a11y/keyboard-nav.spec.js` | N/A | pass |
| Rail ArrowDown/ArrowUp roving tabindex | gate-a11y | `tests/a11y/keyboard-nav.spec.js` | N/A | pass |
| Rail Alt+ArrowUp/Down reorder | gate-a11y | `tests/a11y/keyboard-nav.spec.js` | N/A | pass |
| Modal focus-trap (Tab cycle) | gate-a11y | `tests/a11y/keyboard-nav.spec.js` | N/A | pass |
| Escape closes transient surfaces | gate-a11y | `tests/a11y/keyboard-nav.spec.js` | N/A | pass |
| Russian aria-label preserved | gate-a11y | `tests/a11y/keyboard-nav.spec.js` | N/A | pass |
| Gate-A baseline | gate-a | existing | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** Adding arrow-key handling to the rail breaks arrow-nudge in the preview (AUDIT-B journey 8 — both consume ArrowKeys). Agent δ's WO-28 (snap+nudge) also rewires nudge — overlapping ownership of the keyboard handler table could cause one side to accidentally stomp the other at merge time.
- **Mitigation:** Gate nudge handler on `event.target.closest('#slidesPanel') === null` in `shortcuts.js` (step 6). Coordinate with Agent δ: the ONE keyboard handler table lives per-surface — rail owns arrow inside `#slidesPanel`, preview nudge owns arrow outside `#slidesPanel`. Flag this as a merge-order constraint in the daily sync; WO-10 merges before WO-28 to lay the gate down first, then WO-28 layers its snap logic inside the preview-scope branch.
- **Rollback:** `git revert <sha>`. Rail reverts to pre-WO state (Tab-per-slide, no arrow nav); no cross-module coupling.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:accessibility-compliance-accessibility-audit
isolation: worktree
branch_prefix: claude/wo-10-keyboard-nav-completeness
```

````markdown
You are implementing Step 10 (v0.27.1 Keyboard nav completeness) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-10-keyboard-nav-completeness   (create from main, AFTER WO-09 is merged to main)

PRE-FLIGHT:
  1. Read CLAUDE.md — project invariants
  2. Read ADR-006 — scope includes keyboard-nav.spec.js (normative)
  3. Read AUDIT-B journey 8 (keyboard-only) and journey 12 (slide rail) end-to-end
  4. Read editor/src/slide-rail.js lines 4–172 — understand the current keydown handler at 126–141
  5. Read editor/src/shortcuts.js lines 135–151 — the current arrow-nudge block to gate
  6. Confirm WO-09 has landed on main (tests/a11y/helpers/axe-harness.js exists)
  7. Run `npm run test:gate-a` — must be 55/5/0
  8. Run `npm run test:gate-a11y` — must be green (from WO-09)

FILES YOU OWN (exclusive write):
  - tests/a11y/keyboard-nav.spec.js (new)
  - editor/src/slide-rail.js (edit — roving tabindex + arrow handlers)
  - editor/src/shortcuts.js (edit — gate arrow nudge on rail source)
  - editor/styles/panels.css (edit — focus-visible ring; OR tokens.css if new tokens required, declare @layer first)
  - docs/CHANGELOG.md (edit)
  - docs/ADR-006-accessibility-ci-gate.md (edit Status line only)

FILES READ-ONLY (reference only):
  - editor/presentation-editor.html
  - editor/src/slides.js (moveSlideToIndex signature)
  - editor/src/feedback.js
  - tests/playwright/helpers/editorApp.js
  - tests/a11y/helpers/axe-harness.js (WO-09 output)

SUB-TASKS:
  1. Read rail handler at editor/src/slide-rail.js:126–141.
  2. Replace blanket `tabindex="0"` with roving tabindex (active slide only).
  3. Add ArrowDown/ArrowUp focus move + Alt+ArrowUp/Down reorder (via moveSlideToIndex).
  4. Emit Russian toast "Слайд перемещён: позиция N → M" via showToast.
  5. Add :focus-visible ring CSS on .slide-item.
  6. In shortcuts.js, gate arrow-nudge on `event.target.closest('#slidesPanel') === null`.
  7. Create tests/a11y/keyboard-nav.spec.js with 6 tests (see WO body for exact list).
  8. Verify Gate-A still 55/5/0; Gate-a11y now has +6 green tests.
  9. Manual smoke: file:// open, Tab lands on rail, ArrowDown cycles, Alt+ArrowUp reorders.
  10. Update docs/CHANGELOG.md.
  11. Update ADR-006 Status line.

INVARIANTS (NEVER violate):
  - No `type="module"` added
  - No bundler dep added
  - Gate-A 55/5/0 before AND after merge
  - `file://` workflow must still work — manually verify ArrowDown cycles rail when opened via file://
  - New CSS layer (if any) declared in tokens.css first
  - Russian UI-copy preserved: "Следующий слайд", "Слайд перемещён:", "Действия со слайдом" — spec asserts Cyrillic presence
  - test:gate-a11y stays ADDITIVE (not added to test:gate-a)
  - Keyboard nav works identically on file:// and http://localhost
  - Arrow-nudge inside preview still works (not broken by rail handler)
  - Roving tabindex invariant: exactly 1 slide item has tabindex="0" at runtime

CROSS-BATCH COORDINATION:
  - Agent δ's WO-28 (snap+nudge) touches shortcuts.js nudge block. Your change gates nudge on container scope (`#slidesPanel`). WO-10 MUST merge before WO-28. If WO-28 is already in-flight, post a coordination message: "WO-10 lays the source-container gate; WO-28 layers snap logic inside the preview-scope branch only."

ACCEPTANCE:
  - Gate-A: 55/5/0 (unchanged)
  - Gate-a11y: 6 new tests green (3 from WO-09 + 6 from WO-10 = 9 total, or whatever WO-09 landed with + 6)
  - `page.evaluate` inside spec: count of `.slide-item[tabindex="0"]` === 1
  - moveSlideToIndex spy fires on Alt+ArrowDown test
  - Russian aria-label spec asserts /[а-яА-Я]/ matches
  - Focus-visible ring visible on dark theme (computed-style assertion)
  - Commit: `feat(a11y): rail keyboard nav + focus-trap audit — v0.27.1 step 10`
  - ADR-006 Status line updated

ON COMPLETION:
  1. Run full acceptance matrix
  2. git add tests/a11y/keyboard-nav.spec.js editor/src/slide-rail.js editor/src/shortcuts.js editor/styles/panels.css docs/CHANGELOG.md docs/ADR-006-accessibility-ci-gate.md
  3. Conventional commit: `feat(a11y): rail keyboard nav + focus-trap audit — v0.27.1 step 10`
  4. Report: files changed, LOC delta, gate-a + gate-a11y results, any cross-merge blockers
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Rail reverts to per-slide Tab-stops; arrow-nudge in preview keeps working because the shortcuts.js gate was additive. No cross-module coupling to unwind.

---
