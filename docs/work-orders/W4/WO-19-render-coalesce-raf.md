## Step 19 — v0.30.2 · RAF-coalesced `scheduleSelectionRender()` queue

**Window:** W4   **Agent-lane:** γ (Perf)   **Effort:** M
**ADR:** ADR-013   **PAIN-MAP:** P0-12
**Depends on:** WO-17 (selection slice — coalescing reads store subscriptions, not direct writes)   **Unblocks:** ready for post-v1.0 InspectorViewModel extraction (AUDIT-A recommendation #13)

### Context (3–5 lines)

Per AUDIT-C bottleneck #2 + quick-win #1, `applyElementSelection` at `bridge-commands.js:349–422` triggers seven synchronous render passes per click: `updateInspectorFromSelection` → `syncSelectionShellSurface` → `positionFloatingToolbar` → `renderSelectionOverlay` → `renderSlidesList` → `refreshUi` → `scheduleOverlapDetection`. At least three of these (`positionFloatingToolbar` 3× rects, `renderSelectionOverlay` 1 rect, `renderSlidesList` full-rail innerHTML) each force synchronous layout. First-select cost 15–80 ms on medium decks. This WO introduces `scheduleSelectionRender()` — a RAF-coalesced queue where each render pass marks itself as dirty, and one `requestAnimationFrame` flush runs the sub-renders in deterministic order. The selection slice from WO-17 is the trigger (subscribe on change). Target: 7 passes → 1 RAF flush, **saves 8–15 ms per click on medium decks** per AUDIT-C estimate.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/state.js` | edit | +35 / −0 (scheduleSelectionRender + dirty-flag registry) |
| `editor/src/bridge-commands.js` | edit | +5 / −12 (applyElementSelection replaces 7 direct calls with 1 schedule call) |
| `editor/src/selection.js` | edit | +8 / −0 (applySelectionGeometry uses scheduleSelectionRender) |
| `editor/src/inspector-sync.js` | edit | +3 / −1 (renderLayersPanel early-return gate added for P1-12 side-benefit) |
| `tests/unit/schedule-selection-render.spec.js` | new | +140 / −0 |
| `tests/playwright/selection-perf.spec.js` | new | +180 / −0 (gate-B; measures layout count + click-cost) |
| `docs/CHANGELOG.md` | edit | +4 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/bridge-commands.js` lines 349–422 | `applyElementSelection` — the fan-out site |
| `editor/src/bridge-commands.js` lines 424–431 | `applySelectionGeometry` — similar fan-out on drag RAF |
| `editor/src/selection.js` lines 8–90 | `renderSelectionOverlay` — reads 10+ selection fields |
| `editor/src/selection.js` lines 1760–1836 | `positionFloatingToolbar` — 3× getBoundingClientRect reads |
| `editor/src/slide-rail.js` lines 4–6 | `renderSlidesList` — `innerHTML = ""` full rebuild (P1-10 — out of scope here) |
| `editor/src/inspector-sync.js` lines 805–945 | `updateInspectorFromSelection` — ~30 sub-renders |
| `editor/src/inspector-sync.js` line 903 | `renderLayersPanel` unconditional call (P1-12 gate applied as side benefit) |
| `docs/audit/AUDIT-C-performance.md` §Selection pipeline trace, §Quick-win #1 | perf budget |
| `docs/ADR-013-observable-store.md` §Render coalescing | design note |
| `docs/PAIN-MAP.md` §P0-12 | pain details |

### Sub-tasks (executable, each ≤ 2 h)

1. Read AUDIT-C §Selection pipeline trace + §Quick-win #1. Understand the 7-pass contract and which reads force layout. Measure the current baseline: Playwright script that clicks an element on a 20-element slide + captures `performance.getEntriesByType('measure')` via `PerformanceObserver` for forced-layout detection. Record baseline in commit body (target: "pre-WO-19: N forced layouts per click; post-WO-19: ≤ 1 forced layout per click").
2. In `state.js` (NOT store.js — this is a UI render scheduler, imperative) introduce `const SELECTION_RENDER_KEYS = Object.freeze({ inspector: 'inspector', shellSurface: 'shellSurface', floatingToolbar: 'floatingToolbar', overlay: 'overlay', slideRail: 'slideRail', refreshUi: 'refreshUi', overlapDetection: 'overlapDetection', focusKeyboard: 'focusKeyboard' })`. Add `state.selectionRenderPending = { ...keys mapped to false }` and `state.selectionRenderRafId = 0`. Expected state after: constants + state fields present; no behaviour change.
3. Implement `scheduleSelectionRender(keys = 'all', options = {})`: accepts array of keys OR the string `'all'`. Marks those keys dirty in `state.selectionRenderPending`. If `state.selectionRenderRafId === 0`, enqueues `requestAnimationFrame(flushSelectionRender)` and stores the id. **Do NOT** call anything synchronously. Expected state after: scheduler registered, flushes asynchronously.
4. Implement `flushSelectionRender()`: snapshot the pending flags, zero them (so a sub-render that triggers another schedule won't drop). Zero `selectionRenderRafId`. Then call sub-renders in this DETERMINISTIC order: (1) if inspector dirty → `updateInspectorFromSelection()`; (2) if shellSurface dirty → `syncSelectionShellSurface()`; (3) if floatingToolbar dirty → `positionFloatingToolbar()`; (4) if overlay dirty → `renderSelectionOverlay()`; (5) if slideRail dirty → `renderSlidesList()`; (6) if refreshUi dirty → `refreshUi()`; (7) if overlapDetection dirty → `scheduleOverlapDetection(...)` (note: this one remains async via its own 320 ms timer — we schedule the scheduler, not the work); (8) if focusKeyboard dirty AND `options.previousNodeId !== state.selectedNodeId` → `focusSelectionFrameForKeyboard()`. Expected state after: one RAF per frame produces the same 7-pass sequence currently done synchronously.
5. In `bridge-commands.js:349–422` replace the synchronous fan-out block (lines 412–420 in `applyElementSelection`) with:
```
scheduleSelectionRender('all', { previousNodeId });
```
Remove all 7 direct calls. Keep `state` mutations inside the same `store.batch(() => { ... })` wrapper from WO-17. Expected state after: `applyElementSelection` body shrinks by ~8 lines; output is deferred to next RAF.
6. In `bridge-commands.js:424–431` (`applySelectionGeometry`) replace the 3 synchronous calls (`positionFloatingToolbar` + `updateInspectorFromSelection` + `renderSelectionOverlay`) with `scheduleSelectionRender(['floatingToolbar', 'inspector', 'overlay'])`. Expected state after: drag/resize live-update coalesces to 1 RAF.
7. Audit every other caller of the 7 sub-renders across the codebase. Grep: `grep -n "updateInspectorFromSelection\|positionFloatingToolbar\|renderSelectionOverlay\|renderSlidesList\|syncSelectionShellSurface" editor/src/*.js`. For each site NOT inside `flushSelectionRender`, decide: (a) keep direct call if it's a one-shot non-cluster call (e.g. setInterval keep-alive), or (b) swap to `scheduleSelectionRender(['X'])`. Document decisions in commit body with site list. Expected state after: clusters (2+ calls together) all use scheduler; one-shots justified.
8. As a side-benefit closing P1-12: In `inspector-sync.js:903` wrap the `renderLayersPanel()` call in `if (state.complexityMode === 'advanced' && els.layersInspectorSection && !els.layersInspectorSection.hidden) { renderLayersPanel(); }`. Saves 5–15 ms per basic-mode click per AUDIT-C quick-win #9. Expected state after: basic-mode selection flow avoids the layer-panel render entirely.
9. Write `tests/unit/schedule-selection-render.spec.js` — 10 cases: (a) calling `scheduleSelectionRender('all')` twice in the same sync tick enqueues only 1 RAF; (b) flushing calls the 8 sub-renders in the documented order; (c) calling `scheduleSelectionRender(['inspector'])` flushes only `updateInspectorFromSelection` (others untouched); (d) a sub-render that calls `scheduleSelectionRender` during flush enqueues a new RAF (not the same one); (e) `flushSelectionRender` zeroes dirty flags before sub-renders execute; (f) `focusKeyboard` respects `previousNodeId !== state.selectedNodeId` guard; (g) sub-render that throws doesn't crash the flush — others still run; (h) `cancelAnimationFrame` cleans up if `applyElementSelection` fires twice before the first frame lands (second invocation wins); (i) integration: `applyElementSelection` called 3 times in a microtask produces 1 RAF with combined patches; (j) basic-mode `renderLayersPanel` NOT called when section is hidden. Use test stubs to replace the 8 sub-render functions — no DOM manipulation needed. Expected state after: 10/10 pass.
10. Write `tests/playwright/selection-perf.spec.js` — 3 cases on a fixture deck with 100 elements on one slide: (A) single click records exactly 1 forced layout post-WO-19 (baseline pre-WO-19 records N > 3) via `performance.measure` + `PerformanceObserver({type:'layout-shift'})`; (B) click cost p50 < 18 ms, p95 < 40 ms on CI runner (baseline envelope documented in AUDIT-C: current ~15–25 ms; target lower bound); (C) drag-nudge (10 nudges) stays below 1 RAF queue depth. Add fixture deck file `tests/fixtures/perf-100elem.html` (small, deterministic). Expected state after: perf tests green in gate-B; numbers recorded in CI log.
11. Run full gate matrix: `test:gate-a` 55/5/0, `test:gate-b` green including new `selection-perf`, `test:unit` cumulative 42/42 (32 from WO-16/17/18 + 10 new). Document pre/post perf numbers in commit body. Expected state after: all green, perf target met.
12. Update `docs/CHANGELOG.md` `## Unreleased` → `### Performance`: `RAF-coalesced selection render — 7 passes → 1 frame (PAIN-MAP P0-12, P1-12). Click cost target ~18 ms p50.` Update ADR-013 §Applied In: `v0.30.2 — render coalescing wired (AUDIT-C #1) ✓`. Expected state after: docs reflect.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added
- [ ] Gate-A 55/5/0 before merge
- [ ] `file://` workflow still works
- [ ] Russian UI-copy unchanged
- [ ] Sub-render order identical to pre-WO (documented in sub-task 4) — visual behaviour indistinguishable to user
- [ ] `scheduleSelectionRender` can be called N times per frame; flushes exactly once
- [ ] `selectionRenderPending` flags are zeroed BEFORE sub-renders execute (prevents double-flush race)
- [ ] A sub-render that throws does NOT skip subsequent sub-renders (try/catch around each, report via `reportShellWarning`)
- [ ] `requestAnimationFrame` ID is cancelled on teardown if app ever adds an unmount path (future-proof)
- [ ] `focusSelectionFrameForKeyboard` only fires when selection actually changed (preserves existing gate at bridge-commands.js:419-421)
- [ ] `renderLayersPanel` NOT called in basic-mode (P1-12 closure)
- [ ] No store.update inside flushSelectionRender (this WO is imperative scheduling, not state)
- [ ] Playwright perf spec records exact p50/p95 — no hidden floors

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `tests/unit/schedule-selection-render.spec.js` → 10/10 pass
- [ ] Total `test:unit` → 42/42 pass
- [ ] `test:gate-a` → 55/5/0 unchanged
- [ ] `test:gate-b` green including `selection-perf.spec.js`
- [ ] `selection-perf` case A: layout-shift count post-WO ≤ 1 per click (documented baseline: > 3)
- [ ] `selection-perf` case B: click cost p50 < 18 ms, p95 < 40 ms on chromium-desktop on fixture `perf-100elem.html`
- [ ] Layers panel inspector section is NOT rendered in basic mode (`state.complexityMode === 'basic'`) — verified via devtools MutationObserver on `els.layersListContainer`
- [ ] ADR-013 §Applied In entry updated
- [ ] Commit message: `perf(render): RAF-coalesce selection fan-out — v0.30.2 WO-19`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| scheduleSelectionRender dedups same-frame calls | unit | `tests/unit/schedule-selection-render.spec.js` | N/A | pass |
| flush runs 8 sub-renders in order | unit | `tests/unit/schedule-selection-render.spec.js` | N/A | pass |
| throwing sub-render doesn't block others | unit | `tests/unit/schedule-selection-render.spec.js` | N/A | pass |
| 100-elem click: ≤ 1 forced layout | gate-b | `tests/playwright/selection-perf.spec.js` | > 3 layouts | ≤ 1 layout |
| 100-elem click p50 < 18 ms | gate-b | `tests/playwright/selection-perf.spec.js` | ~25 ms | < 18 ms |
| basic mode skips renderLayersPanel | gate-b | `tests/playwright/selection-perf.spec.js` | called | not called |
| existing click cycle behaviour | gate-a | `tests/playwright/editor.regression.spec.js` | pass (55/5/0) | pass (55/5/0) |

### Risk & mitigation

- **Risk:** Deferring the fan-out by one RAF delays `positionFloatingToolbar` — user sees a 16 ms lag where the floating toolbar "jumps" to new position after click.
- **Mitigation:** 16 ms is below human perceptual threshold for click-response feedback; this is the trade documented in ADR-013 §Render coalescing. IF perceptible in manual QA: add an option `scheduleSelectionRender('all', { immediate: ['floatingToolbar'] })` that flushes just the toolbar synchronously. Do NOT add this prematurely — measure first.
- **Risk:** A synchronous test that sets selection and immediately reads DOM of the overlay breaks (DOM not yet updated because RAF hasn't fired).
- **Mitigation:** Gate-A specs use Playwright auto-waits. Any test that assumes synchronous render must be updated to `expect.poll`. Audit sub-task 7 is where we find these; add fixes in-scope of WO.
- **Risk:** `scheduleOverlapDetection` uses its own 320 ms timer — scheduling it through RAF scheduler actually adds one RAF of latency on top.
- **Mitigation:** Call `scheduleOverlapDetection(reason)` directly from flush — not double-scheduled. Only the selection-render portion RAF-coalesces; the overlap detection timer is separate.
- **Risk:** Sub-render throw is swallowed silently — bugs in inspector-sync become hard to find.
- **Mitigation:** Each try/catch uses `reportShellWarning('selection-render-failed-' + key, error)` which surfaces via diagnostics drawer. Tests assert the warning is emitted.
- **Risk:** Perf test flakes on shared CI runners (layout count is environment-sensitive).
- **Mitigation:** Record exact numbers in CI output; set thresholds ≤ 1 layouts (hard) and p50 < 18 ms (soft — allow 2× envelope on CI, assert only p50 < 36 ms on CI tier, keep < 18 ms as local expectation). Document threshold strategy in commit body.
- **Rollback:** `git revert <sha>`. `scheduleSelectionRender` is an additive helper; reverting restores the synchronous fan-out — behaviour identical, perf worse. Zero data migration. NO fix-forward under pressure.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:performance-engineer
isolation: worktree
branch_prefix: claude/wo-19-render-coalesce-raf
```

````markdown
You are implementing Step 19 (v0.30.2 RAF-coalesce selection render) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-19-render-coalesce-raf   (create from main, post WO-17 merge)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/audit/AUDIT-C-performance.md §Selection pipeline trace + §Quick-win #1
  3. Read docs/ADR-013-observable-store.md §Render coalescing
  4. Read editor/src/bridge-commands.js lines 349–431 (applyElementSelection + applySelectionGeometry)
  5. Read editor/src/selection.js lines 1760–1836 (positionFloatingToolbar — forced-layout source)
  6. Read editor/src/inspector-sync.js lines 895–945 (renderLayersPanel call site for P1-12)
  7. Capture BASELINE perf numbers pre-change — write to /tmp/baseline.md (forced-layout count + click-cost p50/p95 on 100-elem fixture)
  8. Run `npm run test:gate-a` — 55/5/0 must hold
  9. Run `npm run test:unit` — 32/32 must hold

FILES YOU OWN (exclusive write):
  - editor/src/state.js                               (edit — scheduleSelectionRender + flushSelectionRender + constants)
  - editor/src/bridge-commands.js                     (edit — applyElementSelection + applySelectionGeometry use scheduler)
  - editor/src/selection.js                           (edit — any synchronous 2+ sub-render clusters become scheduler calls)
  - editor/src/inspector-sync.js                      (edit — layers panel gate for P1-12 side benefit)
  - tests/unit/schedule-selection-render.spec.js      (new — 10 cases)
  - tests/playwright/selection-perf.spec.js           (new — 3 cases gate-B)
  - tests/fixtures/perf-100elem.html                  (new — deterministic 100-element deck)
  - playwright.config.js                              (edit ONLY if registering new spec)
  - docs/CHANGELOG.md
  - docs/ADR-013-observable-store.md                  (edit §Applied In)

FILES READ-ONLY (reference only):
  - editor/src/selection.js (reads)
  - editor/src/slide-rail.js (lines 4-6 — do NOT refactor; that is P1-10 scope)
  - docs/PAIN-MAP.md (P0-12, P1-12)

SUB-TASKS:
  1. Measure baseline (N forced layouts + click p50/p95)
  2. Add SELECTION_RENDER_KEYS + dirty-flag state
  3. scheduleSelectionRender() queue + flushSelectionRender() deterministic order
  4. Replace synchronous fan-out in applyElementSelection
  5. Replace synchronous trio in applySelectionGeometry
  6. Audit all other call-site clusters of the 7 sub-renders
  7. P1-12 side-benefit gate for renderLayersPanel
  8. 10 unit tests
  9. 3 gate-B perf tests + 100-elem fixture
  10. Run test:unit (42/42) + test:gate-a (55/5/0) + test:gate-b green
  11. Update CHANGELOG + ADR-013 §Applied In
  12. Document pre/post perf numbers in commit body

INVARIANTS (NEVER violate):
  - No type="module", no bundler
  - Gate-A 55/5/0 preserved
  - file:// still works
  - Russian UI copy unchanged
  - Sub-render order deterministic + documented
  - scheduleSelectionRender dedups N-calls-per-frame to 1 RAF
  - Dirty flags zeroed BEFORE sub-renders (prevents race)
  - Throwing sub-render does NOT block others (try/catch + reportShellWarning)
  - focusKeyboard gated on previousNodeId change (preserves existing behaviour)
  - P1-12: basic mode skips renderLayersPanel
  - Perf target: ≤ 1 forced layout per click; p50 < 18 ms on 100-elem fixture (local), ≤ 36 ms on CI

ACCEPTANCE:
  - 10/10 schedule-selection-render.spec.js
  - 42/42 test:unit total
  - 55/5/0 test:gate-a
  - test:gate-b green with perf spec
  - Perf: ≤ 1 forced layout per click on 100-elem fixture
  - p50 click cost < 18 ms local (< 36 ms CI tolerance)
  - basic mode does NOT render layers panel
  - ADR-013 §Applied In updated
  - Conventional commit: perf(render): RAF-coalesce selection fan-out — v0.30.2 WO-19

ON COMPLETION:
  1. Run acceptance matrix
  2. git add editor/src/state.js editor/src/bridge-commands.js editor/src/selection.js editor/src/inspector-sync.js tests/unit/schedule-selection-render.spec.js tests/playwright/selection-perf.spec.js tests/fixtures/perf-100elem.html docs/CHANGELOG.md docs/ADR-013-observable-store.md [playwright.config.js if edited]
  3. Conventional commit per above
  4. Report back: pre/post perf numbers, test results, files changed, LOC delta, any audit-site swaps documented
````

### Rollback plan

If merge breaks main: `git revert <sha>`. `scheduleSelectionRender` is a thin scheduler wrapper — revert restores 7-pass synchronous behaviour identically. Perf baseline degrades back to pre-WO numbers. No data migration. Re-plan splitting into WO-19a (scheduler helper only — no call-site migration), WO-19b (migrate applyElementSelection), WO-19c (migrate applySelectionGeometry + other clusters). NO fix-forward under pressure.
