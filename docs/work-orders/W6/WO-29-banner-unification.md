## Step 29 — v0.27.0–v0.31.0 · Unify `#lockBanner` + `#blockReasonBanner`

**Window:** W6   **Agent-lane:** D   **Effort:** M
**ADR:** ADR-001 (BlockReason protocol — extends)   **PAIN-MAP:** P1-01, P1-02
**Depends on:** WO-26 (transform resolve action expands `getBlockReasonAction` switch), optionally WO-23 (feedback.js → banners.js split)   **Unblocks:** WO-24 migration into unified surface

### Context (3–5 lines)

Two banner channels render the same semantic in inconsistent mode-gated ways: `#lockBanner` is advanced-only (shell lines ~842–848, inspector-sync.js:885–887), `#blockReasonBanner` is mode-agnostic (shell line ~860, inspector-sync.js:905–944). Both fire for `locked` reason — `#blockReasonBanner` shows Unlock action in basic mode, `#lockBanner` in advanced mode. This produces basic/advanced leakage (P1-02) and dead-ends (P1-01). This WO routes every block state through a single `getBlockReason()`/`getBlockReasonAction()` dispatch: `#lockBanner` is deleted; `#blockReasonBanner` becomes the only block-reason surface; mode gating is centralized so basic-mode users see the right actions without seeing the advanced geometry inspector.

### Files owned (exclusive write)

| File | Op | LOC delta est |
|------|-----|---------------|
| `editor/presentation-editor.html` | edit (delete `#lockBanner` markup block) | +0 / −22 |
| `editor/src/inspector-sync.js` | edit (delete `#lockBanner` branch, centralize dispatch) | +30 / −40 |
| `editor/src/feedback.js` | edit (single `renderBlockReasonBanner()` entry point consolidating logic) | +80 / −10 |
| `editor/src/state.js` | edit (delete `els.lockBanner`, `els.lockBannerText` refs) | +0 / −2 |
| `editor/src/dom.js` OR `editor/src/inspector-bindings.js` | edit (delete `unlockElementBtn` binding; move unlock action into unified dispatch) | +10 / −10 |
| `editor/styles/inspector.css` OR `editor/styles/banner.css` | edit (delete `#lockBanner` rules; move any orphan styles) | +0 / −20 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/feedback.js:646–704` | `getBlockReason`, `getBlockReasonLabel`, `getBlockReasonAction` |
| `editor/src/inspector-sync.js:885–944` | both banner dispatch sites |
| `docs/ADR-001-block-reason-protocol.md` | reason enum |
| `docs/audit/AUDIT-B-ux-journeys.md` | journey 5 + cross-cutting §"Advanced-only banners" |
| `docs/audit/PAIN-MAP.md` | P1-01, P1-02 |

### Sub-tasks (executable, each ≤ 2 h)

1. Inventory every reference to `lockBanner` / `LockBanner` / `unlockElementBtn` across the repo. Use Grep on `editor/` and record file+line for each. Expected result: a short list covering shell markup, `state.js` els, `inspector-sync.js`, maybe `feedback.js`, maybe a binding module, one CSS file.
2. Inventory every reference to `blockReasonBanner` / `BlockReasonBanner`. Expected: shell markup, `state.js` els (lines ~516–518), `inspector-sync.js` (line 914+), `feedback.js`, `primary-action.js:286`.
3. Extend `getBlockReasonAction` in `feedback.js` to cover EVERY reason with either an action or a null and document the gating rules for basic vs advanced mode. Add a second function `getBlockReasonActionVisibleIn(reason, mode)` returning `true` if the action should show in the given mode:
```javascript
function getBlockReasonActionVisibleIn(reason, mode) {
  if (mode === "advanced") return true; // advanced always sees actions
  switch (reason) {
    case "zoom": return true;
    case "locked": return true;  // basic users need to unlock too (single mode source of truth)
    case "hidden": return true;
    case "own-transform":
    case "parent-transform":
    case "slide-transform":
    case "transform":
      return true; // WO-26 provides "Открыть инспектор" which auto-switches mode
    default: return false;
  }
}
```
   This centralizes the basic/advanced discipline that previously leaked across two banners.
4. Create a new central function `renderBlockReasonBanner(opts)` in `feedback.js` that:
   - Reads `hasSelection`, selection policy, and `getBlockReason()`.
   - Computes `effectiveReason` using the same guard logic currently duplicated at `inspector-sync.js:905–944` (container kind suppression etc).
   - Determines `show = reason !== "none"` AND (the existing visibility guards for entity-kind = container/slide-root).
   - Sets `els.blockReasonBanner.hidden = !show;` etc (one pass).
   - Writes `els.blockReasonText.textContent = getBlockReasonLabel(effectiveReason);`.
   - Wires the action button: reads `getBlockReasonAction(effectiveReason)` AND `getBlockReasonActionVisibleIn(effectiveReason, state.complexityMode)`. Shows the button iff both are truthy. Writes the label and sets `dataset.action`.
   - Returns `{show, reason: effectiveReason, actionVisible}` for consumers that need to coordinate (e.g. `renderSelectionBreadcrumbs(hasSelection && !show)` at inspector-sync.js:944 still uses the return).
5. Edit `editor/src/inspector-sync.js:885–944` — replace the split-branch code with a single call `const banner = renderBlockReasonBanner();` then:
   - Delete the `#lockBanner` block entirely (lines 885–904 approximately).
   - Keep only the consumer `renderSelectionBreadcrumbs(hasSelection && !banner.show);`.
6. Delete `#lockBanner` markup from `editor/presentation-editor.html`. Search for `id="lockBanner"` (line ~842) and delete the entire wrapper + its child `#lockBannerText` and `#unlockElementBtn` (the button will re-home into the unified banner via the action button; no new button markup needed). Reference: AUDIT-B notes `#lockBanner` advanced-only at line 846.
7. Edit `editor/src/state.js` — remove `lockBanner: document.getElementById("lockBanner"),` and `lockBannerText: document.getElementById("lockBannerText"),` entries (lines 512–513).
8. Find where `#unlockElementBtn` click is bound (likely `editor/src/dom.js` per AUDIT-B citing "dom.js:172"). Preserve the unlock behavior but re-route: the unified banner's action button fires its handler via `els.blockReasonActionBtn.dataset.action === "unlock"`. The existing action dispatch in `inspector-sync.js` line 923+ already routes `getBlockReasonAction`'s `.action` string — verify `"unlock"` is handled; if not, extend that switch to call the existing unlock code path.
9. Update basic/advanced gating for the geometry inspector section. Currently `inspector-sync.js:77–81` auto-unhides geometry in basic mode when `hasBlockedDirectManipulationContext()` — this is the P1-02 "mode leak". Add an extra condition: auto-unhide ONLY if the block reason is transform-family (where the user genuinely needs geometry). For `locked`/`hidden`/`zoom` reasons, do NOT auto-unhide geometry. New gate:
```javascript
const transformFamily = ["own-transform", "parent-transform", "slide-transform", "transform"];
const shouldUnhideGeometry =
  hasBlockedDirectManipulationContext() &&
  transformFamily.includes(getBlockReason());
```
   This closes PAIN-MAP P1-02.
10. Delete orphan CSS for `#lockBanner` in `editor/styles/inspector.css` or wherever grep points. Keep `#blockReasonBanner` styles intact.
11. Update ADR-001 applied-in section. Append a line `- v0.29.0 — #lockBanner unified into #blockReasonBanner via renderBlockReasonBanner() (WO-29)`. Edit only `docs/ADR-001-block-reason-protocol.md` lines 104–108. This is NOT a code change but a documentation invariant.
12. Manual smoke:
    - Select a locked element in basic mode. Single banner shows `🔒 Элемент заблокирован` with `Разблокировать` action. Click → unlocks. No advanced geometry section appears.
    - Select a transformed element in basic mode. Banner shows `Используется transform…` with `Открыть инспектор` action (from WO-26). Click → auto-switches advanced + focuses transform input. Geometry section appears AS A RESULT of mode switch, not as a leak.
    - Select a hidden element. Banner shows `Элемент скрыт…` with `Показать`. Click → restores.
    - Zoom 110%. Banner shows `Масштаб ≠ 100%…` with `Сбросить масштаб`. Click → zoom = 100%.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dependency added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] No new `@layer` (only deletions in CSS)
- [ ] Russian UI copy: labels returned from `getBlockReasonLabel` unchanged; action labels per WO-26 + current: `Разблокировать`, `Показать`, `Сбросить масштаб`, `Открыть инспектор`
- [ ] `#lockBanner` element REMOVED from shell markup (verify via grep in commit)
- [ ] `els.lockBanner` and `els.lockBannerText` refs REMOVED from `state.js`
- [ ] Basic-mode geometry inspector does NOT auto-unhide for `locked`/`hidden`/`zoom` reasons (P1-02 closure)
- [ ] ADR-001 applied-in list updated

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `grep -r "lockBanner" editor/` returns zero matches after the WO lands (except perhaps a migration note comment).
- [ ] Spec `tests/playwright/specs/banner-unification.spec.js` (new): in basic mode with a locked element selected, exactly ONE banner is visible — `#blockReasonBanner` — and `#blockReasonActionBtn` reads `Разблокировать`.
- [ ] Clicking the action button in basic mode unlocks the element (same observable behavior as before the unification).
- [ ] In basic mode with a `locked` reason, geometry inspector section remains `hidden` (P1-02 closure) — asserted via `.inspector-geometry[hidden]`.
- [ ] In basic mode with a `transform` reason, geometry section unhides as the user progresses through the resolve flow (via WO-26 auto-mode-switch).
- [ ] Gate-A still 55/5/0.
- [ ] ADR-001 `## Applied In` contains a v0.29.0 / WO-29 entry.
- [ ] Conventional commit: `refactor(ux): unify lockBanner + blockReasonBanner via single dispatch (P1-01, P1-02) — v0.29.0 step 29`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Single banner visible on locked selection (basic) | gate-b | `tests/playwright/specs/banner-unification.spec.js` (new) | N/A | pass |
| Unlock action works from unified banner | gate-b | same spec | N/A | pass |
| Geometry section stays hidden on locked/hidden/zoom in basic | gate-b | same spec | N/A | pass |
| Transform reason triggers auto-mode-switch + geometry unhide | gate-b | same spec (cross-WO-26 sanity) | N/A | pass |
| Banner regression across zoom/locked/hidden/transform in advanced | gate-a | `tests/playwright/specs/honest-feedback.spec.js` | pass | pass |
| Shell smoke | gate-a | `tests/playwright/specs/shell.smoke.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** `honest-feedback.spec.js` (gate-a spec) asserts on `#lockBanner` visibility — test breaks after unification.
- **Mitigation:** Update the spec in the same WO. The spec assertions should be re-pointed to `#blockReasonBanner` (already partially covered). This is part of the WO, not a separate fix.
- **Risk:** Existing `unlockElementBtn` has sibling event handlers (analytics? telemetry?). Deleting it loses those hooks.
- **Mitigation:** Sub-task 1 inventory enumerates every reference. If any non-trivial handler exists, migrate its body into the unified action dispatch.
- **Risk:** Cross-batch conflict with Agent γ's WO-23 (feedback.js → banners.js split). If WO-23 lands first, `getBlockReason*` helpers move to `banners.js`.
- **Mitigation:** Re-target this WO at `banners.js` if WO-23 shipped. Check `git log` at WO-29 start; decision is single-line change in the sub-tasks (replace filepath `feedback.js` → `banners.js` everywhere this WO references `feedback.js:646–704`).
- **Risk:** Users with basic-mode browser autosave restore showing a legacy `#lockBanner` in their DOM snapshot — the restore path re-injects old markup.
- **Mitigation:** Restore path re-runs shell markup generation; since the new shell has no `#lockBanner`, the restored session uses the unified banner. Confirm by manually restoring an autosave taken pre-WO-29 into a post-WO-29 build.
- **Rollback:** `git revert <sha>`. The deletions are the risky part; revert restores lockBanner fully.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:ui-ux-designer
isolation: worktree
branch_prefix: claude/wo-29-banner-unification
```

````markdown
You are implementing Step 29 (v0.29.0 · banner unification) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-29-banner-unification (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/ADR-001-block-reason-protocol.md
  3. Read docs/audit/AUDIT-B-ux-journeys.md journey 5 + cross-cutting §"Advanced-only banners"
  4. Read docs/audit/PAIN-MAP.md P1-01, P1-02
  5. Read docs/work-orders/W6/WO-29-banner-unification.md (this file)
  6. Check git log — if WO-23 (feedback.js → banners.js split) landed, retarget edits to banners.js
  7. npm run test:gate-a — must be 55/5/0

FILES YOU OWN (exclusive write):
  - editor/presentation-editor.html (delete #lockBanner markup block)
  - editor/src/inspector-sync.js (collapse banner dispatch)
  - editor/src/feedback.js OR editor/src/banners.js (add renderBlockReasonBanner + getBlockReasonActionVisibleIn)
  - editor/src/state.js (delete 2 els entries)
  - editor/src/dom.js OR editor/src/inspector-bindings.js (delete #unlockElementBtn binding)
  - editor/styles/inspector.css OR banner.css (delete orphan #lockBanner rules)
  - docs/ADR-001-block-reason-protocol.md (append applied-in entry)
  - tests/playwright/specs/banner-unification.spec.js (new)
  - tests/playwright/specs/honest-feedback.spec.js (update assertions)

FILES READ-ONLY:
  - editor/src/selection.js, primary-action.js, boot.js
  - docs/audit/AUDIT-B-ux-journeys.md

SUB-TASKS: verbatim 1–12 above.

INVARIANTS:
  - No type="module"; no bundler
  - Gate-A 55/5/0 — honest-feedback spec MUST be updated in the same commit to reflect unification, not broken
  - No new @layer (only deletions)
  - Russian UI copy unchanged for existing labels; any new copy Russian only
  - ADR-001 updated with applied-in entry
  - All existing block reasons still produce the correct banner + action after unification

ACCEPTANCE: verbatim from section above.

ON COMPLETION:
  1. npm run test:gate-a (must be 55/5/0 with updated honest-feedback spec) and test:gate-b (new banner-unification spec)
  2. git add <all files above>
  3. Conventional commit: "refactor(ux): unify lockBanner + blockReasonBanner via single dispatch (P1-01, P1-02) — v0.29.0 step 29"
  4. Report: inventory from sub-task 1, WO-23 status (was banners.js split already done?), test delta

CROSS-BATCH HAND-OFF:
  Agent γ's WO-23 splits feedback.js into banners.js + surface-manager.js.
  If WO-23 landed first: your getBlockReason* helpers live in banners.js. Re-target edits accordingly.
  If WO-23 lands after: the banner-dispatch code block you write in feedback.js will cleanly migrate to banners.js when γ runs.
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Restoration brings both banners back; Gate-A passes with the pre-unification honest-feedback spec. Autosave data is untouched.
