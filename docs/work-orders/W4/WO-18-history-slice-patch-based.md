## Step 18 — v0.30.1 · `history` slice + hash-compare + patch-based snapshots

**Window:** W4   **Agent-lane:** γ (Store)   **Effort:** L
**ADR:** ADR-013, ADR-017   **PAIN-MAP:** P0-07 (final — removes silent-drop), P0-11 (14 MB → <2 MB undo memory)
**Depends on:** WO-16 (store scaffold), WO-17 (selection slice — restoreSnapshot rehydrates selection)   **Unblocks:** ADR-017 patch-op wire format finalisation; collaborative replay

### Context (3–5 lines)

Per AUDIT-C bottleneck #1, history currently stores 20 × full-HTML snapshots (`captureHistorySnapshot` at `export.js:561-599`, `serializeCurrentProject` at `export.js:601-606`, `restoreSnapshot` at `export.js:608-623`). On a 50-slide deck this retains ~14 MB AND serialises the whole `modelDoc` (cloneNode+outerHTML) per commit — 20–80 ms UI-thread blocking. Also P0-07: HISTORY_LIMIT=20 silently drops the oldest snapshot with zero user feedback. This WO creates a `history` slice on the store, implements hash-compare deduplication, and introduces patch-based delta snapshots (first commit full, subsequent commits diff-to-baseline) to reduce memory 90%+ and serialise time 80%+. A full-HTML fallback path is retained for 2 minor versions per EXECUTION_PLAN risk map. Also ships the topbar `N/20` budget chip and toast-on-drop (P0-07 closure).

**DRIFT NOTE:** PAIN-MAP P0-11 attributes snapshot cost to `history.js:608-623` — the real locations are `export.js:561-623`. `history.js` owns `undo()/redo()` only (lines 4-16). Both files are in scope for this WO.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/history.js` | edit | +180 / −25 (move snapshot fns here from export.js; add patch engine) |
| `editor/src/export.js` | edit | +10 / −95 (remove moved snapshot fns; keep public API shims) |
| `editor/src/state.js` | edit | +25 / −8 (defineSlice('history') + Proxy shim extension) |
| `editor/src/primary-action.js` | edit | +30 / −5 (undo/redo budget chip UI) |
| `editor/styles/layout.css` | edit | +20 / −0 (`.history-budget-chip` styles) |
| `tests/unit/history-patches.spec.js` | new | +280 / −0 |
| `tests/playwright/history-budget.spec.js` | new | +120 / −0 |
| `docs/CHANGELOG.md` | edit | +6 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/history.js` lines 4–52 | `undo()` / `redo()` / `addDiagnostic()` / `reportShellWarning()` — entry points |
| `editor/src/export.js` lines 514–533 | `commitChange` / `recordHistoryChange` — public API callers keep calling |
| `editor/src/export.js` lines 535–559 | `schedulePersistence` — 320 ms debounce logic to preserve |
| `editor/src/export.js` lines 561–599 | `captureHistorySnapshot` — source of the full-HTML model |
| `editor/src/export.js` lines 601–606 | `serializeCurrentProject` — `cloneNode(true) + outerHTML` |
| `editor/src/export.js` lines 608–623 | `restoreSnapshot` — unwind path |
| `editor/src/constants.js` line 105 | `HISTORY_LIMIT = 20` |
| `docs/ADR-013-observable-store.md` §history | slice shape guidance |
| `docs/ADR-017-collaborative-editing-readiness.md` §Patch-based history | causality metadata shape |
| `docs/audit/AUDIT-C-performance.md` §History / undo memory cost | budget (14 MB → <2 MB target) |
| `docs/PAIN-MAP.md` §P0-07, §P0-11 | pain details |

### Sub-tasks (executable, each ≤ 2 h)

1. Verify drift: `grep -n "function serializeCurrentProject\|function captureHistorySnapshot\|function restoreSnapshot" editor/src/*.js` — confirm `export.js` owns these. Document in commit body: "PAIN-MAP P0-11 cited history.js:608-623; real location export.js:561-623. Corrected in WO-18."
2. In `store.js` add `@typedef HistorySlice { index: number, limit: number, baseline: { html: string, capturedAt: number } | null, patches: Array<HistoryPatch>, dirty: boolean, lastSavedAt: number }`. Add `@typedef HistoryPatch { op: 'baseline'|'delta', reason: string, at: number, clientId: string, counter: number, baselineIndex: number, diff: string|null, summary: { changedNodes: number, removedNodes: number, addedNodes: number } }`. Expected state after: types visible via IDE.
3. In `state.js` define slice: `window.store.defineSlice('history', { index: -1, limit: 20, baseline: null, patches: [], dirty: false, lastSavedAt: 0 })`. Extend Proxy shim: `history` (state.history maps to `store.get('history').patches`, writes to a generated shape), `historyIndex` (→ `store.get('history').index`), `dirty` (→ `store.get('history').dirty`), `lastSavedAt` (→ `store.get('history').lastSavedAt`). Expected state after: legacy reads/writes keep working.
4. **Move** `captureHistorySnapshot`, `serializeCurrentProject`, `restoreSnapshot` from `export.js:561-623` to `history.js`. In `export.js` replace the moved bodies with 3-line forwarding shims (`function captureHistorySnapshot(reason, options) { return historyCaptureSnapshot(reason, options); }`) so call sites in `commitChange`/`schedulePersistence` keep working. Expected state after: module ownership matches file name.
5. Author `createDomPatch(prevDoc, nextDoc)` in `history.js` — produces `{ diff: string, summary: {...} }`. First implementation: serialise `nextDoc` to HTML via `serializeCurrentProject`, compute SHA-1 (via `crypto.subtle.digest` — works on file://) of prev+next, store `prev.length - next.length` as size-delta summary, store `diff = JSON.stringify({ baselineHash: prevHash, nextHash, nextHtml })` where `nextHtml` is included ONLY if it compresses below 10% of full HTML size; else fall back to storing full HTML in the patch with `op:'baseline'` and reset baseline. V1 is a **hash-compare + periodic-baseline** engine, NOT a DOM-tree diff. Sub-WO after v1.0 may upgrade to tree-diff. Expected state after: patch-generation path exists; no tree-diff algorithm yet.
6. Rewrite `captureHistorySnapshot(reason, options)` inside `history.js`: compute `nextHtml = serializeCurrentProject()`. Compute `nextHash = sha1(nextHtml)`. If `state.history.length === 0` or `state.history.at(-1).op === 'delta' && patches-since-baseline >= 10`, write a `baseline` patch (`{op:'baseline', reason, at, clientId, counter, html: nextHtml}`). Else write a `delta` patch via `createDomPatch(...)`. Dedupe via hash equality with the previous patch. Trim via `HISTORY_LIMIT`. **On drop** (shift), emit `store.update('ui', {historyDropToastPending: {at:Date.now(), reason}})` and `showToast("Старейший шаг истории сброшен. Сохрани проект, чтобы не потерять работу.", "warning", {title: "История", actionLabel: "Сжать историю", onAction: compactHistoryDialog})`. Expected state after: hash-dedup + baseline-every-10-patches + toast-on-drop all working.
7. Rewrite `restoreSnapshot(patch)` in `history.js`: if `patch.op === 'baseline'`, use `patch.html` directly; if `patch.op === 'delta'`, walk backwards from `patch.baselineIndex` collecting baseline html then re-apply deltas (since v1 stores full HTML in every patch, this is trivial: `patch.diff.nextHtml || baselinePatch.html`). Call `loadHtmlString(html, ...)` identically to today. Expected state after: undo/redo still works byte-identical on single-step, multi-step, and past-baseline cases.
8. Generate `clientId`: `const HISTORY_CLIENT_ID = (crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b=>b.toString(16).padStart(2,'0')).join('') : String(Math.random()).slice(2))` — once at script-parse time in `history.js`. Every patch tags `clientId: HISTORY_CLIENT_ID, counter: ++state.history.counter`. Satisfies ADR-017 causality checklist. Expected state after: every stored patch has 2 ID fields ready for future multi-user replay.
9. In `primary-action.js` add `renderHistoryBudgetChip()` — reads `store.get('history').patches.length` and `limit`, renders `<span class="history-budget-chip">N/20</span>` in the topbar next to the save-pill (reuse existing `els.saveStatePill` neighbourhood). Colour thresholds: 0–14 neutral, 15–18 warning-yellow, 19–20 danger-red (via CSS class toggles). Hide when length < 5 (low-noise). Subscribe to `history` slice changes via `store.subscribe('history', renderHistoryBudgetChip)`. Expected state after: chip visible + updates on every undo/commit; closes P0-07 UX gap.
10. In `editor/styles/layout.css` add `@layer layout { .history-budget-chip { ... } .history-budget-chip.is-warning { background: var(--warning-bg); color: var(--warning-fg); } .history-budget-chip.is-danger { background: var(--danger-bg); color: var(--danger-fg); } }`. Reuse existing tokens — do NOT introduce new design tokens in this WO (that is ADR-019 territory). Expected state after: chip visually matches existing topbar style.
11. Write `tests/unit/history-patches.spec.js` — 12 cases: (a) first commit writes baseline; (b) second commit with identical HTML dedup'd via hash; (c) 11th commit rolls a fresh baseline; (d) 21st commit shifts oldest + emits ui.historyDropToastPending; (e) `restoreSnapshot(baselinePatch)` returns identical HTML; (f) `restoreSnapshot(deltaPatch)` returns identical HTML to when it was captured; (g) `clientId` is stable across all patches in one session; (h) `counter` is monotonic; (i) `undo()` decrements history.index via store; (j) `redo()` increments; (k) hash dedup protects against redundant serialisation of the same modelDoc; (l) patches-array memory for 20 × 700 KB identical docs stays at 700 KB (baseline only). Expected state after: 12/12 pass.
12. Write `tests/playwright/history-budget.spec.js` — 2 cases: (A) make 15 edits, assert `.history-budget-chip` shows `15/20` with `.is-warning` class; (B) make 21 edits, assert toast appears with title `"История"` AND contains Russian copy `"Старейший шаг истории сброшен."`. Register the new spec in `playwright.config.js` under gate-B (NOT gate-A — gate-A stays dev-heartbeat per EXECUTION_PLAN). Expected state after: gate-B coverage added.
13. Run `npm run test:gate-a` (55/5/0 invariant), `npm run test:unit` (32/32 cumulative), and `npm run test:gate-b` (must be green). Memory sanity test: open a 20-slide reference deck (`references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html`), make 20 identical-content edits (e.g. toggle same element class on/off), dev-console: `JSON.stringify(store.get('history').patches).length` — must be < 2 MB (was ~14 MB). Expected state after: all 3 gates green + memory target hit.
14. Update ADR-013 §Applied In: `v0.30.1 — history slice + patch-based snapshots ✓`. Update ADR-017 §Applied In: `v0.30.1 — history migrated to patch format ✓`. Update `docs/CHANGELOG.md` `## Unreleased` → `### Changed`: `History slice with patch-based snapshots + budget chip (ADR-013/017; PAIN-MAP P0-07, P0-11). Memory ~14 MB → <2 MB.` Expected state after: docs reflect the change.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open a deck from file system)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer) — reusing `@layer layout` only
- [ ] Russian UI-copy strings preserved (toast copy byte-identical)
- [ ] `window.state` Proxy READ view for `history` / `historyIndex` / `dirty` / `lastSavedAt` keeps all existing consumers working
- [ ] Store mutations go ONLY through `store.update('history', patch)` inside the history module — no direct `state.history.push(...)` remains after this WO
- [ ] Store subscribers fire ONCE per microtask batch — `captureHistorySnapshot` uses `store.batch`
- [ ] **Full-HTML snapshot fallback retained** — every v1 patch stores `html` (full serialisation) in its `diff` payload. True DOM-tree diffing is NOT in scope. Fallback holds for 2 minor versions per EXECUTION_PLAN §Risk map before v0.32.x may upgrade
- [ ] `restoreSnapshot(anyPatch)` is byte-idempotent — serialise → dedupe ensures no in-place mutation in the roundtrip
- [ ] Memory envelope: 20 × 700 KB identical doc edits land at <1 MB retained (baseline-only storage)
- [ ] Memory envelope: 20 × 700 KB diverging doc edits land at < 4 MB (vs 14 MB today)
- [ ] ADR-017 readiness checklist passes: immutable patches, causality (clientId+counter), position-independent ops future-safe
- [ ] Toast text on drop is exact: `"Старейший шаг истории сброшен. Сохрани проект, чтобы не потерять работу."` (Russian byte-preserved)
- [ ] Budget-chip element has `role="status"` + `aria-live="polite"` + localised aria-label in Russian

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:unit` → 32/32 (12 from WO-16 + 8 from WO-17 + 12 new)
- [ ] `npm run test:gate-a` → 55/5/0 unchanged
- [ ] `npm run test:gate-b` passes with new `history-budget.spec.js`
- [ ] Memory: 20 × identical-content commits → `JSON.stringify(store.get('history').patches).length` < 1 MB (empirical test in commit body)
- [ ] Memory: 20 × diverging commits on 20-slide reference deck → retained patches < 4 MB
- [ ] Undo path byte-identical to v0.25.0 on the manual flow `open → edit 5 elements → undo 5× → redo 5×`
- [ ] Budget chip visible, colour-changes at thresholds 15, 19
- [ ] Toast-on-drop at commit 21 contains exact Russian copy per invariants
- [ ] ADR-013 + ADR-017 §Applied In entries added
- [ ] Commit message: `perf(history): patch-based snapshots + budget chip — v0.30.1 WO-18`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| patch-engine creates baseline first | unit | `tests/unit/history-patches.spec.js` | N/A | pass |
| hash dedup on identical commits | unit | `tests/unit/history-patches.spec.js` | N/A | pass |
| baseline rolls every 10 deltas | unit | `tests/unit/history-patches.spec.js` | N/A | pass |
| budget chip 15/20 is-warning | gate-b | `tests/playwright/history-budget.spec.js` | N/A | pass |
| toast on commit 21 drop | gate-b | `tests/playwright/history-budget.spec.js` | N/A | pass |
| existing undo/redo cycle byte-identical | gate-a | `tests/playwright/editor.regression.spec.js` | pass (55/5/0) | pass (55/5/0) |
| 20 × identical edits memory <1 MB | manual | commit body metric | 14 MB | <1 MB |

### Risk & mitigation

- **Risk:** Hash-compare via `crypto.subtle.digest` is async (returns Promise). If `captureHistorySnapshot` becomes async, every caller must be audited.
- **Mitigation:** Use sync hash fallback — 32-bit FNV-1a in JS (~15 LOC) for dedup, which is cryptographically weak but fine for dedup purposes (collision probability on 20 items is ~2^-27). Move to SHA-1 async only in a later WO if needed. Document in commit body.
- **Risk:** `restoreSnapshot` reverting across a baseline boundary replays delta patches — if a delta payload is malformed, user loses work.
- **Mitigation:** V1 stores full `html` inside every patch (baseline AND delta), so walking back is a direct read, not a replay. This is the "full-HTML snapshot fallback" invariant. True delta replay is future scope.
- **Risk:** Budget chip subscribes via `store.subscribe('history', ...)` — fires on every commit. On a spam-click scenario could thrash the topbar layout.
- **Mitigation:** `store.update('history', ...)` already batches via microtask (per WO-16). Chip re-render is single DOM write of 3 characters + 1 classList.toggle. Cost is ~0.05 ms per commit. Measure and record in commit body.
- **Risk:** `HISTORY_CLIENT_ID` generation uses `crypto.getRandomValues` — on some ancient `file://` engines (pre-2018 Safari) this is undefined.
- **Mitigation:** `Math.random()` fallback in same expression. Note in ADR-017 §Applied In that ID uniqueness is best-effort local (no multi-user claim yet).
- **Risk:** Memory measurement via `JSON.stringify(store.get('history').patches).length` is not the same as heap retained size (missing V8 object headers, slot alignment).
- **Mitigation:** Use `performance.memory.usedJSHeapSize` if available (Chromium) for the acceptance check; document both numbers in commit body. Fall back to stringify-size as a weak-but-consistent proxy.
- **Rollback:** `git revert <sha>` — WO-18 replaces the storage layer but preserves every public function name (`captureHistorySnapshot`/`restoreSnapshot`/`commitChange`/`recordHistoryChange`). Revert restores full-HTML god-array. `store.history` slice stays defined but unused. NO fix-forward under pressure.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:javascript-developer
isolation: worktree
branch_prefix: claude/wo-18-history-slice-patch-based
```

````markdown
You are implementing Step 18 (v0.30.1 history slice + patch-based snapshots) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-18-history-slice-patch-based   (create from main, post WO-16 + WO-17 merge)

PRE-FLIGHT:
  1. Read CLAUDE.md (project invariants)
  2. Read docs/ADR-013-observable-store.md §history slice ownership
  3. Read docs/ADR-017-collaborative-editing-readiness.md §Patch-based history section
  4. Read docs/audit/AUDIT-C-performance.md §History / undo memory cost
  5. Read editor/src/history.js lines 4–52 (undo/redo/diagnostic/warning entry points)
  6. Read editor/src/export.js lines 514–623 (commitChange/schedulePersistence/captureHistorySnapshot/serializeCurrentProject/restoreSnapshot — the surgery target)
  7. Read editor/src/state.js post-WO-17 (confirm Proxy shim patterns + selection+ui slices working)
  8. Read editor/src/constants.js line 105 (HISTORY_LIMIT)
  9. Run `npm run test:gate-a` — 55/5/0 must hold before code change
  10. Run `npm run test:unit` — 20/20 must hold before code change

FILES YOU OWN (exclusive write):
  - editor/src/history.js                     (edit — absorbs snapshot fns; adds patch engine)
  - editor/src/export.js                      (edit — replaces moved fns with 3-line forwarding shims)
  - editor/src/state.js                       (edit — defineSlice('history') + Proxy shim ext)
  - editor/src/primary-action.js              (edit — budget chip render + subscribe)
  - editor/styles/layout.css                  (edit — .history-budget-chip class)
  - tests/unit/history-patches.spec.js        (new — 12 cases)
  - tests/playwright/history-budget.spec.js   (new — 2 cases, gate-B)
  - playwright.config.js                      (edit ONLY IF new spec needs registering — check first)
  - docs/CHANGELOG.md
  - docs/ADR-013-observable-store.md          (edit §Applied In)
  - docs/ADR-017-collaborative-editing-readiness.md  (edit §Applied In)

FILES READ-ONLY (reference only):
  - docs/PAIN-MAP.md (P0-07, P0-11)
  - docs/audit/AUDIT-C-performance.md (bottleneck #1)
  - docs/EXECUTION_PLAN_v0.26-v1.0.md (§Risk map — 2-minor-version fallback)

SUB-TASKS:
  1. Verify + document the PAIN-MAP drift (P0-11 cites history.js:608-623; real is export.js:561-623)
  2. @typedef HistorySlice + HistoryPatch in store.js
  3. defineSlice('history', ...) in state.js + extend Proxy shim for 4 keys
  4. Move captureHistorySnapshot/serializeCurrentProject/restoreSnapshot from export.js to history.js + leave 3-line shims in export.js
  5. Implement createDomPatch + hash-compare (FNV-1a sync fallback) + periodic baseline (every 10 deltas)
  6. Rewrite captureHistorySnapshot to use store.update('history', {patches: [...]}) + toast-on-drop
  7. Rewrite restoreSnapshot to use patch.html (full-HTML fallback invariant)
  8. Generate HISTORY_CLIENT_ID + monotonic counter (ADR-017 causality)
  9. renderHistoryBudgetChip + store.subscribe('history') wiring
  10. CSS .history-budget-chip with warning/danger thresholds
  11. Write 12 unit tests + 2 gate-B tests
  12. Run test:unit (expect 32/32) + test:gate-a (expect 55/5/0) + test:gate-b
  13. Memory measurement on 20-slide reference deck × 20 edits
  14. Update ADR-013 + ADR-017 §Applied In + CHANGELOG

INVARIANTS (NEVER violate):
  - No type="module", no bundler
  - Gate-A 55/5/0 preserved
  - file:// still works
  - Russian UI copy byte-preserved (toast text exact)
  - window.state Proxy READ for history/historyIndex/dirty/lastSavedAt keeps consumers working
  - store.update only (no direct state.history.push)
  - Full-HTML snapshot fallback retained for 2 minor versions (every patch stores html, no true-diff replay yet)
  - store subscribers fire ONCE per microtask batch (captureHistorySnapshot uses store.batch)
  - ADR-017 readiness: immutable, causality via clientId+counter, no DOM refs stored in patches
  - Memory on 20 × identical-content commits < 1 MB retained (baseline-only via hash dedup)
  - Memory on 20 × diverging commits < 4 MB retained (was ~14 MB)
  - Budget chip has role=status + aria-live=polite + Russian aria-label

ACCEPTANCE:
  - tests/unit 32/32
  - test:gate-a 55/5/0
  - test:gate-b green including new spec
  - Memory targets hit (document exact numbers in commit body)
  - Undo/redo cycle byte-identical to v0.25.0
  - Budget chip + toast-on-drop visible per spec
  - ADR-013 + ADR-017 Applied In updated
  - Conventional commit: perf(history): patch-based snapshots + budget chip — v0.30.1 WO-18

ON COMPLETION:
  1. Run acceptance matrix
  2. git add editor/src/history.js editor/src/export.js editor/src/state.js editor/src/primary-action.js editor/styles/layout.css tests/unit/history-patches.spec.js tests/playwright/history-budget.spec.js docs/CHANGELOG.md docs/ADR-013-observable-store.md docs/ADR-017-collaborative-editing-readiness.md [playwright.config.js if edited]
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, memory numbers (stringify-size AND performance.memory if available), 32/32 unit, Gate-A + Gate-B results
````

### Rollback plan

If merge breaks main: `git revert <sha>` — WO is large but single-commit. Revert restores full-HTML god-array history. Re-plan splitting into WO-18a (move functions from export.js to history.js — no behavioural change), WO-18b (add store slice + Proxy shim), WO-18c (patch engine + memory target), WO-18d (budget chip + toast). Each chunk rollback-safe. NO fix-forward under pressure.
