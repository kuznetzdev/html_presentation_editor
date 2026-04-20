## Step 36 — v0.35.0 · Flake elimination — `waitForTimeout` → state-based waits; `waitForFunction(globalThis.eval)` → `expect.poll`; LN3 retry loop debugged; fire-once dialog → `page.on('dialog')`

**Window:** W8   **Agent-lane:** A (Test/Reliability)   **Effort:** L
**ADR:** —   **PAIN-MAP:** P1-16, P1-17, P1-19
**Depends on:** WO-12 (bridge v2 hello handshake — shell emits boot-ready marker, enables state-based waits), WO-13 (bridge v2 schema validation — ACKs provide deterministic event signals)   **Unblocks:** WO-38 (RC freeze — no flake sources in gate matrix)

### Context (3–5 lines)

Per AUDIT-E §"Flake-risk top 10" + PAIN-MAP P1-16/P1-17/P1-19: 23 `waitForTimeout` calls across 6 specs, 16 `waitForFunction(() => globalThis.eval(...))` calls across 2 specs (editor.regression + selection-engine-v2), a 5-attempt retry loop in `layer-navigation.spec.js:LN3` marked `test.slow()`, and 3 `page.once("dialog", …)` fire-once handlers at risk of handler-loss on duplicate events. This WO converts every sleep into a state-based wait (poll on DOM/state/bridge), rewrites `waitForFunction(eval)` usages as `expect.poll()` with Playwright selectors, replaces `page.once("dialog")` with stateful `page.on("dialog")` + unsubscribe, and debugs the LN3 container-mode race so the retry loop is removed. **Target: 0 `waitForTimeout` calls in specs; 0 `waitForFunction(eval)` calls; 0 explicit retry loops.**

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `tests/playwright/specs/selection-engine-v2.spec.js` | edit (11 `waitForTimeout` + 8 `waitForFunction` replaced) | +140 / −90 |
| `tests/playwright/specs/editor.regression.spec.js` | edit (8 `waitForFunction` + 2 `page.once("dialog")` replaced) | +120 / −70 |
| `tests/playwright/specs/layer-navigation.spec.js` | edit (remove retry loop; fix underlying race) | +80 / −60 |
| `tests/playwright/specs/shell.smoke.spec.js` | edit (3 `waitForTimeout` replaced) | +30 / −8 |
| `tests/playwright/specs/overlap-recovery.spec.js` | edit (1 `waitForTimeout` replaced) | +8 / −2 |
| `tests/playwright/specs/stage-o-layers-lock-group.spec.js` | edit (1 `waitForTimeout` replaced) | +8 / −2 |
| `tests/playwright/specs/reference-decks.deep.spec.js` | edit (1 `waitForTimeout` + 1 `page.once("dialog")` replaced) | +20 / −6 |
| `tests/playwright/helpers/waits.js` | new (shared state-based wait helpers) | +160 / −0 |
| `tests/playwright/helpers/dialog-handler.js` | new (stateful dialog subscription) | +60 / −0 |
| `editor/src/bridge.js` | edit (OPTIONAL: emit `container-mode-applied` marker for LN3 fix) | +12 / −0 |
| `docs/CHANGELOG.md` | edit (append) | +10 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `docs/audit/AUDIT-E-tests.md` §"Flake-risk top 10" | priority ordering + fix directions |
| `docs/audit/PAIN-MAP.md` P1-16/P1-17/P1-19 | severity + proposed fix |
| `editor/src/bridge.js` lines ~70–110 | runtime-log handler + bridge ACK channel |
| `editor/src/selection.js` — container-mode entry | root cause of LN3 race |
| `editor/src/state.js` | state shape — determines what selectors poll on |
| `tests/playwright/helpers/editorApp.js` | existing page-object — extend, don't duplicate |

### Sub-tasks (executable, each ≤ 2 h)

1. **Baseline measurement.** Run grep commands, record counts in scratchpad:
   - `grep -rn "waitForTimeout" tests/playwright/specs/ | wc -l` → expected 23
   - `grep -rn "waitForFunction.*globalThis.eval" tests/playwright/specs/ | wc -l` → expected 16 (AUDIT-E §"Flake-risk top 10" also claims 16)
   - `grep -rn 'page\.once\("dialog"' tests/playwright/specs/ | wc -l` → expected 3
   Record the exact numbers in commit body for before/after comparison. Expected state after: baseline measurements documented.
2. **Create shared helper `tests/playwright/helpers/waits.js`.** Exports:
   - `waitForState(page, predicate, { timeout = 5000, interval = 50 } = {})` — Playwright-native `expect.poll(() => page.evaluate(predicate)).toBeTruthy({ timeout, intervals: [interval] })`.
   - `waitForSelection(page, expectedNodeId)` — polls `state.selectedNodeId === expectedNodeId`.
   - `waitForSelectionKind(page, expectedKind)` — polls `state.selectedEntityKind === expectedKind`.
   - `waitForMode(page, mode)` — polls `state.mode === mode`.
   - `waitForNoActiveManipulation(page)` — polls `!state.activeManipulation`.
   - `waitForSlideActive(page, slideId)` — polls `state.activeSlideId === slideId`.
   - `waitForBridgeAck(page, messageType)` — subscribes to bridge event log, resolves on ACK receipt.
   - `waitForOverlapMapUpdated(page)` — polls a deterministic overlap-detection-complete flag.
   - `waitForContainerModeApplied(page, nodeId)` — polls a container-mode marker (see sub-task 6).
   - `waitForThemeApplied(page, theme)` — polls `html[data-theme]` attribute.
   Each helper returns a Playwright `Locator`-style awaitable, with clear timeout errors. Expected state after: helpers compile, tests can import.
3. **Create `tests/playwright/helpers/dialog-handler.js`.** Exports:
   - `acceptNextDialog(page)` — returns `{ unsubscribe }`; registers `page.on('dialog', handler)` that calls `dialog.accept()` and then unsubscribes (via `page.off`). Handler is robust to being called multiple times: first fire accepts, subsequent fires are ignored (logged).
   - `acceptAllDialogs(page)` — persistent `page.on('dialog', …)` with `unsubscribe()` to remove.
   - `expectNoUnhandledDialog(page)` — assertion helper: if any dialog fires within `timeout`, test fails.
   Expected state after: no test needs `page.once("dialog", …)` again.
4. **Rewrite `tests/playwright/specs/selection-engine-v2.spec.js`.** For each of the 11 `waitForTimeout` and 8 `waitForFunction(eval)` sites:
   - Identify the state transition the test awaits (e.g., "click triggered and selection payload received").
   - Replace with the appropriate helper from `waits.js` — `waitForSelection`, `waitForSelectionKind`, `waitForMode`, `waitForBridgeAck`.
   - For the `seenNodeIds.size >= 1` assertion in S2 (AUDIT-E §"Flake-risk top 10" #6): change threshold to `>= 2` with a `test.skip` guard for single-candidate fixtures if such exist in the reference corpus; otherwise keep `>= 2` unconditionally — AUDIT-E notes the weaker assertion masks broken cycling.
   Expected state after: 0 `waitForTimeout` and 0 `waitForFunction(eval)` in this file; all 21 tests pass on chromium-desktop.
5. **Rewrite `tests/playwright/specs/editor.regression.spec.js`.** For each of the 8 `waitForFunction(eval)` sites:
   - Replace with `expect.poll` + Playwright locator/state query via helper.
   - For the 2 `page.once("dialog", …)` sites at lines 213 and 1484: replace with `const handler = acceptNextDialog(page); ... handler.unsubscribe();` using the new helper. Ensure if the dialog is expected to fire and DOES NOT fire within 5s, the test fails explicitly (no silent skip).
   - For the "keyboard nudge unsafe-box" test (AUDIT-E §"Flake-risk top 10" #4): change assertion from text-match on `diagnosticsBox` to specific array-entry match (`state.diagnostics.find(d => d.code === 'nudge.unsafe-box')`).
   Expected state after: 0 `waitForFunction(eval)`, 0 `page.once("dialog", …)` in this file; all 44 tests pass.
6. **Debug LN3 container-mode race in `tests/playwright/specs/layer-navigation.spec.js`.** The retry loop (5 attempts with `test.slow()`) hides a real race. Root cause: container-mode application (`state.containerModeNodeId = X`) happens asynchronously via bridge ACK, but the test clicks without awaiting the ACK. Fix:
   - Edit `editor/src/bridge.js` OR `editor/src/selection.js` to emit a deterministic marker when container-mode is applied — e.g., `window.dispatchEvent(new CustomEvent('editor:container-mode-applied', { detail: { nodeId } }))` OR set `state.containerModeAppliedSeq = seq`.
   - Add `waitForContainerModeApplied(page, nodeId)` helper in `waits.js` (sub-task 2) that polls the marker.
   - Rewrite LN3 to: click → `await waitForContainerModeApplied(page, nodeId)` → assert container-mode UI → interact.
   - Remove the `for` loop + `test.slow()` + retry counter.
   Expected state after: LN3 has 0 retries, 0 `waitForTimeout`, runs in the normal timeout budget.
7. **Rewrite `tests/playwright/specs/shell.smoke.spec.js`.** Replace 3 `waitForTimeout` (theme swap 150/180/200 ms):
   - Use `waitForThemeApplied(page, 'dark'|'light')` — polls `document.documentElement.getAttribute('data-theme')`.
   - The 400 ms `waitForTimeout` around slide activation: use `waitForSlideActive(page, slideId)`.
   Expected state after: 0 `waitForTimeout` in this file; all 35 tests pass.
8. **Rewrite `tests/playwright/specs/overlap-recovery.spec.js`.** The 1 `waitForTimeout` is around `triggerAndWaitForOverlapDetection`: replace with `waitForOverlapMapUpdated(page)` from helpers. Expected state after: 0 `waitForTimeout` in this file; 7 tests pass.
9. **Rewrite `tests/playwright/specs/stage-o-layers-lock-group.spec.js`.** The 1 `waitForTimeout`: identify its purpose (likely DnD race), replace with a `waitForState` predicate on the specific state transition. Expected state after: 0 `waitForTimeout`; 9 tests pass.
10. **Rewrite `tests/playwright/specs/reference-decks.deep.spec.js`.** The 1 `waitForTimeout` + 1 `page.once("dialog")` at line 899: replace with `waitForState` + `acceptNextDialog`. Expected state after: 0 `waitForTimeout`, 0 `page.once("dialog")`; 4 tests pass.
11. **Final count verification.** Re-run the grep commands from sub-task 1:
    - `grep -rn "waitForTimeout" tests/playwright/specs/` → **must return 0 matches** (invariant)
    - `grep -rn "waitForFunction.*globalThis.eval" tests/playwright/specs/` → **must return 0 matches**
    - `grep -rn 'page\.once\("dialog"' tests/playwright/specs/` → **must return 0 matches**
    Expected state after: all three counts are zero.
12. **Gate matrix verification.** Run each gate 3 times consecutively to probe for residual flake:
    - `npm run test:gate-a` × 3 → 55/5/0 every time
    - `npm run test:gate-b` × 3 → full pass every time
    - `npm run test:gate-c` × 3 → FF/WebKit pass every time
    Record any spurious failures in commit body. Expected state after: 3 green runs per gate, demonstrating deterministic behavior.
13. **Update `docs/CHANGELOG.md` under `## Unreleased` → `### Changed`**: `Test suite flake elimination (P1-16/P1-17/P1-19): 23 waitForTimeout → 0; 16 waitForFunction(eval) → 0; LN3 retry loop removed via container-mode ACK marker; page.once("dialog") → stateful acceptNextDialog helper. New tests/playwright/helpers/waits.js + dialog-handler.js. (WO-36)`. Expected state after: CHANGELOG quantifies the before/after.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge AND after — invariant
- [ ] `file://` workflow still works
- [ ] NO new `@layer` added — test-only WO
- [ ] Russian UI-copy preserved (none added or removed in specs)
- [ ] **`grep -rn "waitForTimeout" tests/playwright/specs/` returns 0 lines**
- [ ] **`grep -rn "waitForFunction.*globalThis.eval" tests/playwright/specs/` returns 0 lines**
- [ ] **`grep -rn 'page\.once\("dialog"' tests/playwright/specs/` returns 0 lines**
- [ ] LN3 `test.slow()` marker removed; no retry loop present
- [ ] No test assertion weakened to mask non-determinism (e.g., `seenNodeIds.size >= 1` → `>= 2`)
- [ ] Gate-A, Gate-B, Gate-C each pass 3× consecutively on chromium-desktop

### Acceptance criteria (merge-gate, falsifiable)

- [ ] Total `waitForTimeout` count in `tests/playwright/specs/` drops from 23 to **0** (quantified in commit body)
- [ ] Total `waitForFunction(globalThis.eval(...))` count drops from 16 to **0**
- [ ] `page.once("dialog", ...)` count drops from 3 to **0**
- [ ] `tests/playwright/specs/layer-navigation.spec.js:LN3` has no retry loop, no `test.slow()`
- [ ] `tests/playwright/helpers/waits.js` exists with 10 helpers (count in commit body)
- [ ] `tests/playwright/helpers/dialog-handler.js` exists with 3 helpers
- [ ] `npm run test:gate-a` passes 3× consecutively (55/5/0 each time; record timestamps)
- [ ] `npm run test:gate-b` passes 3× consecutively
- [ ] `npm run test:gate-c` passes 3× consecutively
- [ ] Gate-A runtime does NOT regress past existing 5-minute budget (measure before/after)
- [ ] Reference decks regression clean — `v3-prepodovai-pitch` + `v3-selectios-pitch` load/edit/export unchanged
- [ ] Commit message in conventional-commits format: `test(reliability): eliminate flake — 23 waitForTimeout → 0, 16 waitForFunction(eval) → 0, LN3 fixed — v0.35.0 WO-36`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| selection-engine-v2 — all 21 tests, 0 sleeps | gate-a | `selection-engine-v2.spec.js` | pass w/ 11×wait + 8×wf | pass w/ 0 |
| editor.regression — all 44 tests, 0 wf-eval, 0 page.once | gate-b | `editor.regression.spec.js` | pass w/ 8×wf + 2×page.once | pass w/ 0 |
| layer-navigation LN3 container mode | gate-b | `layer-navigation.spec.js` | pass w/ retry 1/5 | pass w/ 0 retry |
| shell.smoke — theme swap deterministic | gate-a | `shell.smoke.spec.js` | pass w/ 3× waitForTimeout | pass w/ 0 |
| overlap-recovery — 7 tests | gate-b | `overlap-recovery.spec.js` | pass w/ 1× waitForTimeout | pass w/ 0 |
| stage-o — 9 tests | gate-b | `stage-o-layers-lock-group.spec.js` | pass w/ 1× waitForTimeout | pass w/ 0 |
| reference-decks deep — 4 tests, no dialog loss | gate-f | `reference-decks.deep.spec.js` | pass w/ page.once | pass w/ acceptNextDialog |
| gate-a 3× consecutive | gate-a | all four | pass 3× or flaky | pass 3× deterministic |

### Risk & mitigation

- **Risk:** Replacing a `waitForTimeout` with a state-based wait surfaces a genuine bug (the timeout was papering over a real race). Test now fails reliably instead of flaking.
- **Mitigation:** Triage each surfaced failure — if it's a genuine editor bug, fix it in a co-located hot-fix commit; if it's a test-side race, tune the predicate. Document each fix in commit body. Do NOT add a new `waitForTimeout` to restore green.
- **Risk:** LN3 container-mode marker emission in `bridge.js` is the wrong layer and causes side-effects.
- **Mitigation:** Use `window.dispatchEvent(new CustomEvent('editor:container-mode-applied'))` rather than adding a state field — zero impact on product runtime; test listener is pure observation. If `bridge.js` edit is contentious, move the emit to `selection.js` where container-mode is applied.
- **Risk:** `acceptNextDialog` helper's robustness-to-double-fire breaks a test that relies on the fire-once semantic.
- **Mitigation:** Audit existing dialog usages: each of 3 current call-sites expects exactly one confirm-accept (duplicate-slide, delete-slide, reference-decks edit). The new helper accepts the first and ignores the rest — behaviorally identical to `page.once`. Document in helper JSDoc.
- **Risk:** Stateful `page.on('dialog')` without unsubscribe leaks handler across tests.
- **Mitigation:** Helper returns `{ unsubscribe }`; tests call it in `test.afterEach` or at end of `test()`. Lint-like rule: every `acceptNextDialog(...)` or `acceptAllDialogs(...)` call must be followed by `.unsubscribe()` in the same function. Document in helper file header.
- **Risk:** 3× consecutive-pass requirement uncovers additional flake not covered by the original 23-count (e.g., network retry inside the app).
- **Mitigation:** If residual flake appears, scope is expanded within this WO budget; otherwise document and spawn a follow-up WO. AUDIT-E §"Systemic flake contributors" lists the known surfaces — cross-check.
- **Risk:** `waitForOverlapMapUpdated` helper depends on `runOverlapDetectionNow` — a manual-kick API. If the real-user race isn't triggered by the test, the helper gives false-green.
- **Mitigation:** Helper polls `state.overlapMap.lastComputedAtSeq`, not `runOverlapDetectionNow` return. If no such field exists, add one (10 LOC in `overlap.js` / `history.js`). Document the ADR-013-compatible path (WO-16+).
- **Rollback:** `git revert <sha>` on the WO-36 commit. Tests regain old sleeps/retries. Identify which spec failure caused the revert; fix root cause; re-attempt.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:test-automator
isolation: worktree
branch_prefix: claude/wo-36-flake-elimination
```

````markdown
You are implementing Step 36 (v0.35.0 flake elimination) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-36-flake-elimination   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read AUDIT-E §"Flake-risk top 10" + §"Systemic flake contributors" fully
  3. Read PAIN-MAP P1-16, P1-17, P1-19
  4. Read editor/src/bridge.js lines 70–120 (runtime-log + ACK channel)
  5. Read editor/src/selection.js container-mode entry
  6. Run `npm run test:gate-a` — must be 55/5/0 before any code change
  7. Run each spec 3× individually to record current flake: `playwright test tests/playwright/specs/layer-navigation.spec.js --project=chromium-desktop --repeat-each=3` — expect LN3 retry to hide the race

FILES YOU OWN (exclusive write):
  - tests/playwright/helpers/waits.js                          (new, 10 helpers)
  - tests/playwright/helpers/dialog-handler.js                 (new, 3 helpers)
  - tests/playwright/specs/selection-engine-v2.spec.js         (edit)
  - tests/playwright/specs/editor.regression.spec.js           (edit)
  - tests/playwright/specs/layer-navigation.spec.js            (edit — remove LN3 retry)
  - tests/playwright/specs/shell.smoke.spec.js                 (edit)
  - tests/playwright/specs/overlap-recovery.spec.js            (edit)
  - tests/playwright/specs/stage-o-layers-lock-group.spec.js   (edit)
  - tests/playwright/specs/reference-decks.deep.spec.js        (edit)
  - editor/src/bridge.js OR editor/src/selection.js            (OPTIONAL, for LN3 marker)
  - docs/CHANGELOG.md                                          (append)

FILES READ-ONLY (reference only):
  - docs/audit/AUDIT-E-tests.md
  - docs/audit/PAIN-MAP.md
  - editor/src/state.js
  - editor/src/history.js
  - editor/src/overlap.js (post-WO-23)

SUB-TASKS: (verbatim from WO sub-tasks 1–13)

INVARIANTS (NEVER violate):
  - No type="module"; no bundler
  - Gate-A 55/5/0 preserved AND 3× consecutive
  - 0 waitForTimeout in specs after merge (grep invariant)
  - 0 waitForFunction(globalThis.eval) in specs
  - 0 page.once("dialog") in specs
  - 0 retry loops in specs
  - No assertion weakened to mask flake
  - file:// workflow preserved

ACCEPTANCE: (verbatim from Acceptance criteria section)

ON COMPLETION:
  1. Run all 3 grep invariant counts — all zero
  2. Run gate-a × 3 consecutively — all 55/5/0
  3. Run gate-b × 3 — all pass
  4. Run gate-c × 3 — all pass
  5. git add tests/playwright/helpers/waits.js tests/playwright/helpers/dialog-handler.js
       tests/playwright/specs/*.spec.js
       editor/src/bridge.js (if edited)
       docs/CHANGELOG.md
  6. Conventional commit: "test(reliability): eliminate flake — 23 waitForTimeout → 0, 16 waitForFunction(eval) → 0, LN3 fixed — v0.35.0 WO-36"
  7. Report back: files changed, LOC delta, before/after grep counts, 3× gate results, any residual-flake findings
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Entire WO is test-side (+ optional small bridge edit); reverting restores old waits. Diagnose which spec broke; fix underlying race; re-attempt. NO fix-forward under pressure.

---
