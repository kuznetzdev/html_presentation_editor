## Step 17 — v0.28.1 · `selection` slice migration + `window.state` Proxy shim expansion

**Window:** W3   **Agent-lane:** γ (Store)   **Effort:** M
**ADR:** ADR-013, ADR-011, ADR-017   **PAIN-MAP:** P0-09, P2-07
**Depends on:** WO-16 (store.js scaffold + ui slice)   **Unblocks:** WO-19 (render coalesce needs slice boundaries); WO-18 (history slice consumes selection state)

### Context (3–5 lines)

Per AUDIT-A §Bridge-commands + §State management, `applyElementSelection` at `bridge-commands.js:349–422` mutates 15 selection fields with no boundary — `selectedNodeId`, `selectionPath`, `selectedTag`, `selectedFlags`, `selectedPolicy`, `selectedEntityKind`, `clickThroughState`, `selectionLeafNodeId`, `selectedRect`, `selectedComputed`, `selectedHtml`, `selectedAttrs`, `manipulationContext`, `runtimeActiveSlideId`, `liveSelectionRect`. This WO moves all selection-related state into a `selection` slice on the ADR-013 store, extends the `window.state` Proxy to route these 15 reads+writes through `store.update('selection', patch)`, and replaces the 6-branch `createDefaultSelectionPolicy` (P2-07) with a table lookup as a readability side-benefit. Gradual migration stays the rule — selection.js / inspector-sync.js / context-menu.js / slide-rail.js / bridge-commands.js keep reading `state.selectedNodeId` unchanged.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/state.js` | edit | +55 / −30 |
| `editor/src/store.js` | edit | +25 / −0 (add SelectionSlice typedef + defineSlice call) |
| `editor/src/bridge-commands.js` | edit | +25 / −18 (applyElementSelection wraps mutations in store.batch) |
| `tests/unit/selection-slice.spec.js` | new | +180 / −0 |
| `docs/CHANGELOG.md` | edit | +4 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/bridge-commands.js` lines 349–422 | `applyElementSelection` — the 15-field fan-out |
| `editor/src/bridge-commands.js` lines 262–301 | `deriveSelectedFlagsFromPayload` (P2-06 candidate — not touched here) |
| `editor/src/state.js` lines 8–126 | `createDefaultSelectionPolicy` — 6-branch if-chain (P2-07) |
| `editor/src/state.js` lines 262–311 | god-state selection fields (actual surface being migrated) |
| `editor/src/selection.js` lines 8–90 | `renderSelectionOverlay` — reads 10+ selection fields |
| `editor/src/inspector-sync.js` lines 839–944 | banner code — reads `state.selectedNodeId`/`selectedPolicy`/`selectedFlags` |
| `editor/src/context-menu.js` (top) | reads selection fields |
| `editor/src/slide-rail.js` (top) | reads `state.activeSlideId`/`selectedNodeId` |
| `docs/ADR-013-observable-store.md` §What-lives-where | selection slice ownership |
| `docs/ADR-017-collaborative-editing-readiness.md` | slice readiness checklist |

### Sub-tasks (executable, each ≤ 2 h)

1. Read WO-16 merge commit. Confirm `store.get('ui')` works and `window.state.theme` reads via Proxy. Expected state after: baseline understood.
2. In `store.js` add `@typedef SelectionSlice { activeNodeId: string|null, activeSlideId: string|null, selectionPath: Array<Object>, leafNodeId: string|null, tag: string|null, computed: Object|null, html: string, rect: Object|null, attrs: Object, entityKind: string, flags: Object, policy: Object, liveRect: Object|null, manipulationContext: Object|null, clickThroughState: Object|null, runtimeActiveSlideId: string|null, overlapIndex: number }`. Expected state after: typedef present; IDE autocomplete works when reading via `store.get('selection')`.
3. In `state.js` init block (same place where `ui` slice was defined in WO-16), add `window.store.defineSlice('selection', { activeNodeId: null, activeSlideId: null, selectionPath: [], leafNodeId: null, tag: null, computed: null, html: '', rect: null, attrs: {}, entityKind: 'none', flags: {canEditText:false, isImage:false, isVideo:false, isContainer:false, isSlideRoot:false, isProtected:false, isTextEditing:false}, policy: createDefaultSelectionPolicy(), liveRect: null, manipulationContext: null, clickThroughState: null, runtimeActiveSlideId: null, overlapIndex: 0 })`. Expected state after: selection slice registered before `state.js` sets up the Proxy shim.
4. Replace `createDefaultSelectionPolicy` 6-branch if-chain at `state.js:8-126` with a table lookup: `const SELECTION_POLICY_TABLE = { 'slide-root': {...}, 'critical-structure': {...}, 'structured-table': {...}, 'plain-text-block': {...}, 'svg-object': {...}, 'stateful-wrapper': {...} };`. `createDefaultSelectionPolicy(flags)` resolves the kind key from flags (first-match priority: isSlideRoot → isProtected → isTable → isCodeBlock → isSvg → isFragment → 'free'), merges the base free-policy with overrides. Keep identical output shape to pass the existing test suite. Expected state after: `createDefaultSelectionPolicy(flags)` returns byte-identical object for every flag combination tested by Gate-A. Closes P2-07.
5. Extend the `window.state` Proxy shim in `state.js` (from WO-16) to route these keys through the `selection` slice: `selectedNodeId` ↔ `selection.activeNodeId`, `selectionLeafNodeId` ↔ `selection.leafNodeId`, `selectionPath` ↔ `selection.selectionPath`, `selectedTag` ↔ `selection.tag`, `selectedComputed` ↔ `selection.computed`, `selectedHtml` ↔ `selection.html`, `selectedRect` ↔ `selection.rect`, `selectedAttrs` ↔ `selection.attrs`, `selectedEntityKind` ↔ `selection.entityKind`, `selectedFlags` ↔ `selection.flags`, `selectedPolicy` ↔ `selection.policy`, `liveSelectionRect` ↔ `selection.liveRect`, `manipulationContext` ↔ `selection.manipulationContext`, `clickThroughState` ↔ `selection.clickThroughState`, `runtimeActiveSlideId` ↔ `selection.runtimeActiveSlideId`, `activeSlideId` ↔ `selection.activeSlideId`. Expected state after: every module that reads/writes these keys keeps working unchanged via Proxy.
6. In `bridge-commands.js:349–422` wrap the entire `applyElementSelection` body after the payload normalization in `store.batch(() => { ... })`. Rewrite the 15 `state.X = Y` assignments as `store.update('selection', { ... })` calls consolidated into a single patch. Keep the call order to the side-effect functions (updateInspectorFromSelection / syncSelectionShellSurface / positionFloatingToolbar / renderSelectionOverlay / renderSlidesList / refreshUi / scheduleOverlapDetection) IDENTICAL — this WO ONLY changes storage; coalescing the fan-out is WO-19's job. Expected state after: `applyElementSelection` now produces one microtask notification for all selection subscribers, and side-effect calls still fire synchronously in the same order.
7. Write `tests/unit/selection-slice.spec.js` — 8 unit cases: (a) defineSlice('selection') works after ui slice; (b) `store.update('selection', {activeNodeId:'node-7'})` fires subscribers with next+prev; (c) `window.state.selectedNodeId = 'node-9'` propagates to `store.get('selection').activeNodeId`; (d) reading `state.selectedPolicy` returns live policy from store; (e) batch with two selection updates fires subscribers once; (f) `createDefaultSelectionPolicy({isSlideRoot:true})` returns `kind:'slide-root'` AND matches the pre-refactor object byte-for-byte (compare via JSON.stringify equality to a frozen golden fixture); (g) `createDefaultSelectionPolicy({isTable:true, isCodeBlock:true})` resolves to `isTable` per priority rule; (h) `Object.keys(state)` includes `selectedNodeId` (Proxy enumerability). Expected state after: `npm run test:unit` passes all new cases.
8. Run `npm run test:gate-a` — must be 55/5/0. Manual test: open deck, click elements, confirm selection overlay moves; confirm inspector reflects changes; confirm breadcrumbs update; confirm context-menu works; confirm layer picker works (all via Proxy-shimmed reads). Expected state after: zero behavioural regressions.
9. Update `docs/CHANGELOG.md` `## Unreleased` → `### Changed`: `Selection state moved to store.selection slice (ADR-013 phase 2; PAIN-MAP P0-09, P2-07).` Expected state after: changelog entry present.
10. Update ADR-013 §Applied In: add line `v0.28.1 — selection slice migration ✓`. Update ADR-017 §Applied In: add line `v0.28.1 — selection slice passes CRDT-readiness checklist ✓`. Expected state after: ADRs track progress.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open a deck from file system)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer) — N/A
- [ ] Russian UI-copy strings preserved — `createDefaultSelectionPolicy` reason strings stay Russian byte-for-byte
- [ ] `window.state` remains a working READ view of `selection` slice for all 16 migrated keys
- [ ] Store mutations for migrated fields go ONLY through `store.update('selection', patch)` — NO direct `state.selectedNodeId = ...` in newly touched code (Proxy shim redirects older consumers transparently)
- [ ] Store subscribers fire ONCE per microtask batch — `applyElementSelection` body wrapped in `store.batch`
- [ ] Side-effect call order in `applyElementSelection` is IDENTICAL to pre-WO (WO-19 owns coalescing; this WO owns storage)
- [ ] ADR-017 readiness checklist passes for `selection` slice: immutable patches, stable node IDs exist (data-editor-node-id), no DOM node refs stored (only IDs + plain objects)
- [ ] `createDefaultSelectionPolicy` output is byte-identical to pre-refactor (golden fixture in test)

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:unit` → all 20 cases (12 from WO-16 + 8 new) pass
- [ ] `npm run test:gate-a` → 55/5/0 unchanged
- [ ] Manual: click element A → click element B → `window.store.get('selection').activeNodeId` returns element B's nodeId
- [ ] Manual: observed via `store.subscribe('selection', ...)` — ONE notification per click (batched)
- [ ] Manual: layer picker opens and closes cleanly (reads `state.selectedNodeId` via Proxy)
- [ ] Context menu at selection origin works — reads via Proxy
- [ ] Slide rail active-card highlight updates on selection change
- [ ] `createDefaultSelectionPolicy({isSlideRoot:true})` produces identical object as v0.25.0 (byte-level compare)
- [ ] ADR-013 + ADR-017 §Applied In entries updated
- [ ] Commit message: `refactor(store): selection slice migration — v0.28.1 WO-17`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| selection slice defineSlice + subscribe | unit | `tests/unit/selection-slice.spec.js` | N/A | pass |
| window.state Proxy routes selectedNodeId → selection.activeNodeId | unit | `tests/unit/selection-slice.spec.js` | N/A | pass |
| applyElementSelection batched → 1 notification per subscriber | unit | `tests/unit/selection-slice.spec.js` | N/A | pass |
| createDefaultSelectionPolicy golden fixture equality | unit | `tests/unit/selection-slice.spec.js` | N/A | pass |
| end-to-end click cycle | gate-a | `tests/playwright/editor.regression.spec.js` | pass (55/5/0) | pass (55/5/0) |
| layer picker open/close on click cycle | gate-a | `tests/playwright/layer-navigation.spec.js` | pass | pass |
| inspector reflects selection changes | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** `selectedFlags` is an object; replacing `state.selectedFlags = nextFlags` with Proxy-routed `store.update('selection', {flags: nextFlags})` loses reference identity. Downstream code that caches `state.selectedFlags` by reference will stale.
- **Mitigation:** grep `state.selectedFlags` across codebase — audit every cache site. If none cache by reference (only by-value reads), Proxy is safe. Include findings in commit body. If any cache site found, it is an in-scope fix for THIS WO (do not defer).
- **Risk:** `createDefaultSelectionPolicy` table-refactor drifts output from the 6-branch version on an obscure flag combination.
- **Mitigation:** Write golden-fixture test case (g) that enumerates ALL 2^6 = 64 flag combinations and byte-compares old vs new via a temporary parallel code path during development (old function kept in a test-only helper file, deleted at end of WO). Only merge when table equals reference for all 64.
- **Risk:** `applyElementSelection` body has subtle ordering dependencies — e.g. `setInteractionMode` at line 407 reads `state.selectedFlags.isTextEditing` which was just set above. Moving to `store.batch()` preserves sync execution, BUT if any call inside batch reads via `store.get('selection')` before the patch has committed, values will be stale.
- **Mitigation:** `store.update()` commits synchronously (only subscribers are microtasked). Reads via Proxy or `store.get()` immediately after `store.update()` return the new value. Unit test (e) asserts this.
- **Risk:** `slice.policy` is an object with ~15 boolean fields — tiny shallow-merge bugs on `store.update('selection', {policy: nextPolicy})` could miss a field.
- **Mitigation:** Always replace the whole `policy` object via `normalizeSelectionPolicy(payload.protectionPolicy || {}, nextFlags)` — never merge partially. Keep existing `normalizeSelectionPolicy` helper as the single construction point.
- **Rollback:** `git revert <sha>`. WO-17 is reversible because the Proxy shim keeps both directions working. Revert restores direct-mutation god-state on the 16 selection fields; consumers keep working. NO fix-forward under pressure.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:javascript-developer
isolation: worktree
branch_prefix: claude/wo-17-selection-slice-migration
```

````markdown
You are implementing Step 17 (v0.28.1 selection slice migration) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-17-selection-slice-migration   (create from main, post WO-16 merge)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read docs/ADR-013-observable-store.md §What-lives-where (selection slice owners)
  3. Read docs/ADR-017-collaborative-editing-readiness.md §Decision (readiness checklist)
  4. Read editor/src/bridge-commands.js lines 349–422 (applyElementSelection — main surgery)
  5. Read editor/src/state.js lines 8–126 (createDefaultSelectionPolicy — 6-branch refactor)
  6. Read editor/src/state.js lines 262–311 (god-state selection fields)
  7. Read editor/src/store.js (full — understand how WO-16 shipped)
  8. Verify WO-16 was merged: `git log --oneline -5 main` shows the store.js scaffold commit
  9. Run `npm run test:gate-a` — must be 55/5/0 before any code change
  10. Run `npm run test:unit` — must be 12/12 pass before any code change

FILES YOU OWN (exclusive write):
  - editor/src/state.js                   (edit: selection slice init, Proxy shim extension, policy-table refactor)
  - editor/src/store.js                   (edit: add @typedef SelectionSlice; no API change)
  - editor/src/bridge-commands.js         (edit: applyElementSelection wrapped in store.batch)
  - tests/unit/selection-slice.spec.js    (new — 8 cases)
  - docs/CHANGELOG.md                     (edit)
  - docs/ADR-013-observable-store.md      (edit: §Applied In)
  - docs/ADR-017-collaborative-editing-readiness.md  (edit: §Applied In)

FILES READ-ONLY (reference only):
  - editor/src/selection.js
  - editor/src/inspector-sync.js
  - editor/src/context-menu.js
  - editor/src/slide-rail.js
  - docs/audit/AUDIT-A-architecture.md
  - docs/PAIN-MAP.md (P0-09, P2-07)

SUB-TASKS:
  1. Extend store with SelectionSlice typedef
  2. defineSlice('selection', {...}) in state.js init block
  3. Refactor createDefaultSelectionPolicy to table-lookup (P2-07 closure)
  4. Extend window.state Proxy shim for 16 selection keys
  5. Wrap applyElementSelection body in store.batch (15 assignments → one patch)
  6. Write 8 unit tests
  7. Run test:unit (expect 20/20) + test:gate-a (expect 55/5/0)
  8. Manual: click cycles, layer picker, context menu, inspector
  9. Update CHANGELOG + ADR-013/017 §Applied In

INVARIANTS (NEVER violate):
  - No type="module", no bundler, no ES modules
  - Gate-A 55/5/0 must hold before merge
  - file:// workflow still works
  - Russian reason strings in selection policies stay byte-identical
  - window.state reads for all 16 migrated keys still work via Proxy
  - Writes via state.X = Y still work (Proxy set trap routes through store.update)
  - createDefaultSelectionPolicy output is byte-identical via golden-fixture test on 64 flag combos
  - applyElementSelection side-effect order identical (coalescing is NOT this WO)
  - ADR-017 readiness checklist passes: immutable, stable IDs, patch-friendly
  - No DOM node references in the selection slice (IDs + plain objects only)

ACCEPTANCE:
  - tests/unit/selection-slice.spec.js → 8/8 pass
  - tests/unit/store.spec.js → 12/12 still pass
  - Gate-A remains 55/5/0
  - Manual click cycles work, layer picker / context menu / inspector unchanged
  - ADR-013 + ADR-017 §Applied In entries added
  - Conventional commit: refactor(store): selection slice migration — v0.28.1 WO-17

ON COMPLETION:
  1. Run acceptance matrix
  2. git add editor/src/state.js editor/src/store.js editor/src/bridge-commands.js tests/unit/selection-slice.spec.js docs/CHANGELOG.md docs/ADR-013-observable-store.md docs/ADR-017-collaborative-editing-readiness.md
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, unit+gate-a results, any selectedFlags-caching sites found during audit
````

### Rollback plan

If merge breaks main: `git revert <sha>`. WO-17 is additive-and-Proxy — revert restores direct-mutation baseline on the 16 selection fields and the pre-refactor `createDefaultSelectionPolicy` 6-branch function. Store remains wired for `ui` slice (WO-16 stays merged). Re-plan WO-17 with smaller per-field slice migration (e.g. ship activeNodeId + activeSlideId first, other 14 fields next WO). NO fix-forward under pressure.
