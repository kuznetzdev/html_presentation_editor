## Step 31 — v0.31.0 · Resolve shift-click multi-select limbo (toast-stub + strip dead bridge code)

**Window:** W6   **Agent-lane:** D   **Effort:** S
**ADR:** —   **PAIN-MAP:** P1-03
**Depends on:** none   **Unblocks:** P3 "full multi-select + align/distribute" (future, out of v1.0 scope)

### Context (3–5 lines)

Shift+click dispatches `multi-select-add` from bridge (`editor/src/bridge-script.js:2927–2940`), which the shell handles by pushing to `state.multiSelectNodeIds` (`editor/src/bridge.js:90–94`). Two advanced-only consumers exist: `editor/src/context-menu.js:365` and a grouping routine at `editor/src/selection.js:1616–1632`. Basic-mode users get **zero feedback** — shift-click appears as a silent selection-replacement. This WO resolves the limbo the honest way: (1) a transient toast `Мульти-выбор — в разработке. Временно доступно в продвинутом режиме: Правка → Группировать.` on first shift-click per session in basic mode, and (2) delete the dead `multi-select-add` dispatch branch in bridge if the audit shows the group-op path is orphaned. Closes PAIN-MAP P1-03.

### Files owned (exclusive write)

| File | Op | LOC delta est |
|------|-----|---------------|
| `editor/src/bridge-script.js` | edit (annotate or strip the shift-click dispatch block at lines 2927–2940) | +10 / −15 |
| `editor/src/bridge.js` | edit (retain dispatch handler but gate by mode; add toast stub branch) | +30 / −4 |
| `editor/src/feedback.js` | edit (none — reuses existing `showToast`) | +0 / −0 |
| `tests/playwright/specs/multi-select-resolve.spec.js` | new | +60 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/selection.js:1616–1632` | grouping routine — the existing advanced consumer |
| `editor/src/context-menu.js:365` | advanced group-op menu item |
| `editor/src/state.js:299` | `multiSelectNodeIds: []` field |
| `editor/src/feedback.js` | `showToast` API |
| `docs/audit/AUDIT-B-ux-journeys.md` | journey 6 detail |
| `docs/audit/PAIN-MAP.md` | P1-03 |

### Sub-tasks (executable, each ≤ 2 h)

1. **Audit the advanced flow.** Manually test: enter advanced mode, shift-click two elements, open right-click menu → confirm "Группировать" or equivalent is present and clickable, and that clicking it actually groups via the selection.js:1616 path. Record findings:
   - Does the advanced grouping actually work end-to-end today?
   - Is there any other consumer of `state.multiSelectNodeIds`?
   Use `grep` to answer the second question.
   Expected outcome: one of TWO decisions — (A) advanced flow works → retain it and gate strictly on mode; or (B) advanced flow is broken → strip bridge code entirely AND delete `state.multiSelectNodeIds` field AND both advanced consumers. Record the decision with the grep+manual evidence.
2. If **decision A** (advanced works): proceed with sub-tasks 3–7 (toast stub in basic; guard in bridge). If **decision B** (advanced broken): proceed with sub-tasks 8–11 (full strip).
3. **(Decision A)** Edit `editor/src/bridge.js:90–94` (the `multi-select-add` case). Wrap the existing push logic with a mode gate:
```javascript
case "multi-select-add": {
  const nodeId = payload?.nodeId;
  if (!nodeId) break;
  if (state.complexityMode !== "advanced") {
    // Basic mode: show a toast once per session explaining the current state.
    if (!sessionStorage.getItem("editor:multi-select-toast-shown")) {
      showToast(
        "Мульти-выбор — в разработке. Временно доступно в продвинутом режиме: Правка → Группировать.",
        { ttl: 5500 }
      );
      sessionStorage.setItem("editor:multi-select-toast-shown", "1");
    }
    break; // do not mutate state.multiSelectNodeIds in basic mode
  }
  if (!state.multiSelectNodeIds.includes(nodeId)) {
    state.multiSelectNodeIds.push(nodeId);
  }
  break;
}
```
4. **(Decision A)** Edit `editor/src/bridge-script.js:2927–2940`. Add a comment block at the top of the block annotating the resolution:
```javascript
// [WO-31] Shift+click multi-select: dispatch retained for advanced-mode grouping.
// Basic mode receives a toast via shell-side handler (bridge.js ~90). Full multi-select UX
// (align/distribute, visible combined overlay) is P3 / post-v1.0.
```
   No behavioral edit.
5. **(Decision A)** Add a spec `tests/playwright/specs/multi-select-resolve.spec.js`:
   - Basic mode: shift-click two elements → toast containing `Мульти-выбор — в разработке` appears; `state.multiSelectNodeIds.length === 0`.
   - Second shift-click same session: no second toast (sessionStorage flag).
   - Advanced mode: shift-click two elements → right-click context menu shows grouping entry; click it → elements are grouped (DOM parent becomes a grouping container). Match the existing advanced behavior.
6. **(Decision A)** Manual smoke: basic shift-click shows toast once; advanced shift-click + group works as before.
7. **(Decision A)** End here. Skip sub-tasks 8–11.
8. **(Decision B)** Strip the dispatch at `bridge-script.js:2927–2940` entirely. Verify with grep there are NO remaining consumers of `multi-select-add` message type in the bridge protocol.
9. **(Decision B)** Delete the case in `bridge.js:90–94` entirely. Replace with a `[WO-31 removed]` comment block documenting the removal and citing AUDIT-B journey 6 + P1-03.
10. **(Decision B)** Delete `editor/src/state.js:299` `multiSelectNodeIds: []` field AND the consumers at `editor/src/selection.js:1616–1632` and `editor/src/context-menu.js:365`. Mark the removed surface in a commit note.
11. **(Decision B)** Add a shell-side click interceptor: when user shift-clicks inside the preview frame (detect via bridge or shell-side pointer), show the same toast as in Decision A:
```javascript
showToast(
  "Мульти-выбор — в разработке. Следите за v1.1 для групповых операций.",
  { ttl: 5500 }
);
```
   Toast fires once per session via sessionStorage flag. Spec covers basic and advanced equally — no mode variation since advanced no longer has the feature.
12. Update `docs/ROADMAP_NEXT.md` "Deferred (Out of Scope for v1.0)" section. Append:
```markdown
- Shift+click multi-select + align/distribute: basic-mode users see a honesty toast per WO-31; full UX shipped post-v1.0 (see AUDIT-B journey 6, P3)
```

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dependency added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] No new `@layer`
- [ ] All toast text Russian. Exact strings:
  - (A) `Мульти-выбор — в разработке. Временно доступно в продвинутом режиме: Правка → Группировать.`
  - (B) `Мульти-выбор — в разработке. Следите за v1.1 для групповых операций.`
- [ ] Toast fires at most once per session (sessionStorage flag `editor:multi-select-toast-shown`)
- [ ] No dead-code branches remain after decision: if A, dispatch retained with comment; if B, dispatch stripped and no orphan state field
- [ ] ROADMAP_NEXT.md updated with the deferral entry

### Acceptance criteria (merge-gate, falsifiable)

- [ ] Spec `tests/playwright/specs/multi-select-resolve.spec.js` step 1: basic mode shift-click two elements → toast contains `Мульти-выбор — в разработке`.
- [ ] Step 2: second shift-click in same session → no second toast (assert toast count in DOM).
- [ ] Step 3 (decision A only): advanced mode shift-click + group via context menu still produces grouped result.
- [ ] Step 4 (decision B only): advanced mode shift-click ALSO shows the toast (feature gone in both modes).
- [ ] Grep `multiSelectNodeIds` (decision B) — zero matches, OR (decision A) — same three existing matches only.
- [ ] Gate-A still 55/5/0.
- [ ] Conventional commit: `fix(ux): resolve shift-click multi-select limbo with honesty toast (P1-03) — v0.31.0 step 31`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Basic mode shift-click fires toast once | gate-b | `tests/playwright/specs/multi-select-resolve.spec.js` (new) | N/A | pass |
| Second shift-click same session — no toast | gate-b | same spec | N/A | pass |
| (Dec A) Advanced grouping works | gate-b | same spec | pass | pass |
| (Dec B) No orphan multiSelectNodeIds references | manual grep | n/a | n/a | pass |
| Gate-A regression | gate-a | `tests/playwright/specs/shell.smoke.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** Decision A is taken but the advanced grouping is partially broken in a way sub-task 1 did not catch; basic-mode toast sends users to a dead end in advanced.
- **Mitigation:** Sub-task 1 REQUIRES manual end-to-end verification in advanced mode. If any doubt, pick Decision B — it is the safer route (honest toast for all).
- **Risk:** Stripping `state.multiSelectNodeIds` breaks import/export paths that serialize state (autosave restore).
- **Mitigation:** Grep reveals if `multiSelectNodeIds` is serialized. If yes, Decision B migration needs a serialization migration step; in that case pick A.
- **Risk:** Toast text is subtly wrong Russian; passes grammar check but reads stilted.
- **Mitigation:** Copy is reviewed by UX author (Agent δ) pre-merge. Both variants are pre-approved in this WO.
- **Rollback:** `git revert <sha>`. Both decisions are additive in the toast sense; Decision B's field/consumer deletions revert cleanly.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:legacy-modernizer
isolation: worktree
branch_prefix: claude/wo-31-multi-select-resolve
```

````markdown
You are implementing Step 31 (v0.31.0 · shift-click multi-select resolve) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-31-multi-select-resolve (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/audit/AUDIT-B-ux-journeys.md journey 6
  3. Read docs/audit/PAIN-MAP.md P1-03
  4. Read docs/work-orders/W6/WO-31-shift-click-multi-select-resolve.md (this file)
  5. npm run test:gate-a — must be 55/5/0

FILES YOU OWN (exclusive write):
  - editor/src/bridge.js (only the multi-select-add case)
  - editor/src/bridge-script.js (only the shift-click dispatch block at ~2927-2940)
  - editor/src/state.js (only if Decision B — delete multiSelectNodeIds)
  - editor/src/selection.js (only if Decision B — delete grouping routine at 1616-1632)
  - editor/src/context-menu.js (only if Decision B — delete line 365 grouping entry)
  - docs/ROADMAP_NEXT.md (append deferral note)
  - tests/playwright/specs/multi-select-resolve.spec.js (new)

FILES READ-ONLY:
  - editor/src/feedback.js (reuse showToast only)
  - editor/src/primary-action.js, boot.js, inspector-sync.js

SUB-TASKS:
  1. AUDIT the advanced grouping flow end-to-end (manual + grep). Record decision A or B.
  2. If A: follow sub-tasks 3-7 above verbatim.
  3. If B: follow sub-tasks 8-11 above verbatim.
  4. Either way: sub-task 12 (ROADMAP update).

INVARIANTS:
  - No type="module"; no bundler
  - Russian toast text verbatim per the exact strings in "Invariant checks"
  - Toast fires at most once per session (sessionStorage)
  - No dead-code branches remain
  - Gate-A 55/5/0
  - Conventional commit message verbatim from Acceptance criteria

ACCEPTANCE: verbatim from section above.

ON COMPLETION:
  1. npm run test:gate-a and test:gate-b
  2. git add <decision-specific list>
  3. Conventional commit: "fix(ux): resolve shift-click multi-select limbo with honesty toast (P1-03) — v0.31.0 step 31"
  4. Report: decision A or B with evidence, consumer count, toast render count under test
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Decision A reverts to pre-WO silent behavior; Decision B reverts to pre-WO silent behavior with reinstated advanced grouping path. Either way, no user-visible regression beyond the honesty being removed.
