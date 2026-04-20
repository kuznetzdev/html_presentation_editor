## Step 16 — v0.28.0 · `store.js` scaffold (hand-rolled) + `ui` slice migration

**Window:** W3   **Agent-lane:** γ (Store)   **Effort:** M
**ADR:** ADR-013, ADR-011, ADR-017   **PAIN-MAP:** P0-09 (start)
**Depends on:** WO-14 (Agent β — tsconfig + first typedefs) — JSDoc patterns must be established first before first `@typedef` authored here   **Unblocks:** WO-17 (selection slice), WO-18 (history slice), WO-19 (render coalescing)

### Context (3–5 lines)

Per AUDIT-A §`state.js` + §Scorecard (state management 4/10), the `state` singleton at `state.js:235–383` has **75+ untyped fields** mutated from 15+ modules. Starts closure of PAIN-MAP P0-09 by introducing a hand-rolled observable store (ADR-013) on a classic `<script src>` — no bundler, no ES modules. This WO delivers (a) the `store.js` module, (b) the first slice migration (`ui`: `complexityMode` + `previewZoom` + `theme` + `themePreference`), and (c) the `window.state` Proxy shim that keeps every existing consumer working unchanged. ADR-017 readiness-checklist drives the slice shape: immutable updates, stable IDs, `{op,path,value}` patch-friendly.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/store.js` | new | +310 / −0 |
| `editor/src/state.js` | edit | +70 / −25 |
| `editor/src/boot.js` | edit | +15 / −8 |
| `editor/presentation-editor.html` | edit | +1 / −0 (one new `<script src>`) |
| `tests/unit/store.spec.js` | new | +250 / −0 |
| `docs/CHANGELOG.md` | edit | +6 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `docs/ADR-013-observable-store.md` | API shape (§Shape, §API, §Constraints) + render-coalescing section |
| `docs/ADR-011-type-system-strategy.md` | `@typedef` rules — no `import type`, classic `<script>` friendly |
| `docs/ADR-017-collaborative-editing-readiness.md` | §Decision readiness checklist (immutable updates, stable IDs) |
| `editor/src/state.js` lines 193–222 | existing `setPreviewLifecycleState` — prior-art write-through pattern |
| `editor/src/state.js` lines 235–383 | god-state definition — slice sources |
| `editor/src/boot.js` lines 111–191 | theme read path (`initTheme` / `setThemePreference`) — migrate to store |
| `editor/src/boot.js` lines 193–226 | complexity-mode read path (`initComplexityMode` / `setComplexityMode`) |
| `editor/src/boot.js` lines 260–308 | preview-zoom read path (`initPreviewZoom` / `setPreviewZoom` / `applyPreviewZoom`) |
| `editor/presentation-editor.html` lines 1761–1785 | script load order — `store.js` must load after `constants.js`, before `state.js` |
| `docs/PAIN-MAP.md` §P0-09 + §P2-07 | pain details |

### Sub-tasks (executable, each ≤ 2 h)

1. Read AUDIT-A §`state.js` + ADR-013 §API + ADR-017 §Decision. Confirm store must live in classic `<script>` with shared `window.store` global. Expected state after: architectural envelope understood; decision matrix recorded in WO commit body.
2. Create `editor/src/store.js` skeleton: IIFE, assigns `window.store`. Expose `createStore(initialSlices)` factory. Internal map `slices: { [sliceName]: frozenObject }`, `listeners: { [sliceName]: Set<fn> }`, `batchDepth = 0`, `pendingSlices = new Set()`. Expected state after: module file exists, loads, `typeof window.store === 'object'`.
3. Implement `store.get(sliceName)` — returns frozen reference. `store.select(path)` — string path like `"ui.theme"`, walks via `.split('.')`, returns undefined on miss. Expected state after: read-path works; no notifications yet.
4. Implement `store.update(sliceName, patch)` — validates sliceName exists, validates patch is plain object. Produces `nextSlice = Object.freeze({...prev, ...patch})` per ADR-013 §Constraints. Stores. Adds `sliceName` to `pendingSlices`. If `batchDepth === 0`, schedules a microtask via `queueMicrotask(flushListeners)`. If `batchDepth > 0`, defers. Expected state after: write path works; listeners fire once per microtask batch.
5. Implement `store.batch(fn)` — increments `batchDepth`, invokes `fn()`, decrements. When it returns to 0, schedules one microtask flush. Expected state after: `store.batch(() => { store.update(...); store.update(...); })` fires listeners exactly once.
6. Implement `store.subscribe(sliceName, fn)` — registers listener. Returns unsubscribe fn. Implement `store.subscribe(path, fn)` — if name contains `.`, split and register a wrapped listener that reads via `select(path)` + shallow-compares old vs new. Expected state after: both slice-level and path-level subscribe work.
7. Implement dev-only protection: if `typeof globalThis.__PRESENTATION_EDITOR_STORE_STRICT === 'undefined'` default to strict. When strict, `Object.freeze()` the slice at write time; in prod mode use a `Proxy` with `set` trap that logs `reportShellWarning('store-direct-mutation', ...)`. Expected state after: direct mutation is visibly traceable.
8. Author first `@typedef` blocks in `store.js` header per ADR-011: `@typedef UISlice { complexityMode: 'basic'|'advanced', previewZoom: number, theme: 'light'|'dark', themePreference: 'light'|'dark'|'system' }`. Expected state after: tsc --noEmit passes if run; JSDoc visible in IDE.
9. In `state.js` line ~235, **before** declaring `state = {...}`, initialize `window.store` with the `ui` slice: `window.store.defineSlice('ui', { complexityMode: 'basic', previewZoom: 1.0, theme: 'light', themePreference: 'system' })`. Expected state after: `ui` slice exists by script-parse time.
10. Insert `window.state` Proxy shim into `state.js` right after the `state` literal (or wrapping it) that intercepts reads for `complexityMode`/`previewZoom`/`theme`/`themePreference` and returns `store.select('ui.' + key)`, and intercepts writes to those four keys routing through `store.update('ui', {[key]: value})`. Other keys keep raw behavior (hand `through` to the plain object). Expected state after: `state.theme = 'dark'` writes through to store; `state.theme` read returns store value; all existing modules keep working.
11. In `editor/presentation-editor.html` add `<script src="src/store.js"></script>` line immediately after `<script src="src/constants.js"></script>` (line 1761) and before `<script src="src/state.js"></script>` (line 1762). Expected state after: script load order preserves the `window.store` being ready before `state.js` runs.
12. Write `tests/unit/store.spec.js` — pure-JS Node test harness (no Playwright) with 12 cases: (a) get returns frozen object; (b) update produces new identity; (c) subscribe fires with next+prev; (d) update outside batch fires one microtask; (e) update inside batch fires one microtask total; (f) path subscribe fires only on that key; (g) defineSlice + subscribe fires after define; (h) multiple sequential updates outside batch coalesce into a single notification (microtask queue); (i) attempting to write to a frozen slice throws in strict mode; (j) unsubscribe stops firing; (k) batch inside batch nests correctly; (l) `select('missing.path')` returns `undefined` without throwing. Add `"test:unit": "node --test tests/unit/"` script if not present (verify first — do NOT change unrelated scripts). Expected state after: `npm run test:unit` green — 12/12.
13. Run `npm run test:gate-a` — must be 55/5/0 (no regression). Manually exercise: open deck, toggle theme, toggle complexity mode, toggle zoom — observe via dev-console `store.get('ui')` returns the right live values. Expected state after: all three UI slice values flow through the store.
14. Update `docs/CHANGELOG.md` under `## Unreleased` → `### Added`: `store.js scaffold + ui slice migration (ADR-013 phase 1; PAIN-MAP P0-09 start).` Expected state after: changelog entry present.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open a deck from file system)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer) — N/A
- [ ] Russian UI-copy strings preserved (not translated to English)
- [ ] `window.state` remains a READ view of `ui`-slice fields throughout migration — every existing consumer (21 scattered `complexityMode === "advanced"` checks in 8 files, every `state.previewZoom`/`state.theme` read) keeps working with zero edits
- [ ] Store mutations for migrated fields go ONLY through `store.update('ui', patch)`. Dev mode freezes slices; prod mode Proxy-traps direct writes
- [ ] Store subscribers fire ONCE per microtask batch — never more (verified by unit test (h))
- [ ] `store.js` loads AFTER `constants.js` and BEFORE `state.js` in shell HTML (line order is load order)
- [ ] ADR-017 readiness checklist passed for `ui` slice: immutable updates, no cross-slice refs, values are primitives (no DOM nodes)
- [ ] `store.js` is pure (no `document.*`, no `els.*` refs) — it is a state primitive, not a render primitive
- [ ] No Redux / MobX / Zustand dep added (hand-rolled only — per ADR-013 §Alternatives)

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:unit` → 12/12 pass on `tests/unit/store.spec.js`
- [ ] `npm run test:gate-a` → 55/5/0 unchanged
- [ ] Manual: toggle `Ctrl+Shift+B` (basic/advanced), then read `window.store.get('ui').complexityMode` in devtools — value matches UI
- [ ] Manual: `state.theme = 'dark'` in devtools propagates: `window.store.get('ui').theme === 'dark'` AND `document.documentElement.dataset.theme === 'dark'`
- [ ] Manual: open two listeners via `store.subscribe('ui.theme', fn)` — toggling theme via UI fires each exactly once per toggle
- [ ] `store.batch(() => { store.update('ui', {theme:'dark'}); store.update('ui', {previewZoom:1.5}); })` produces exactly ONE listener invocation per distinct slice subscriber
- [ ] `store.update('ui', {complexityMode:'invalid'})` — does not throw, does update (validation is shape-level only at this WO; semantic validation comes later). This is deliberate — documented in commit body.
- [ ] ADR-013 Status updated from **Proposed → Accepted (phase 1)** in `docs/ADR-013-observable-store.md` frontmatter + §Applied In line "v0.28.x — store.js module scaffold ✓"
- [ ] Commit message in conventional-commits format: `feat(store): store.js scaffold + ui slice — v0.28.0 WO-16`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| store.update freezes slice (strict mode) | unit | `tests/unit/store.spec.js` | N/A | pass |
| store.batch coalesces to one microtask notify | unit | `tests/unit/store.spec.js` | N/A | pass |
| path-subscribe fires only when that path changes | unit | `tests/unit/store.spec.js` | N/A | pass |
| `window.state.theme = 'dark'` writes through store | unit | `tests/unit/store.spec.js` | N/A | pass |
| theme toggle end-to-end | gate-a | `tests/playwright/editor.regression.spec.js` | pass (55/5/0) | pass (55/5/0) |
| complexity mode toggle end-to-end | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |
| preview zoom end-to-end | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** `window.state` Proxy shim triggers `for..in` / `Object.keys(state)` misbehavior in consumers (Proxies can mask own-enumerable keys) — could make existing loops skip `ui` fields.
- **Mitigation:** Use a Proxy only on the 4 migrated keys via `has` + `get` + `set` traps that return `true` for those keys; keep the underlying `state` object as the ownKeys source so `Object.keys(state)` still enumerates them. Unit test case adds `Object.keys(state).includes('theme')` assertion.
- **Risk:** Microtask-coalescing changes ordering — render calls that currently fire synchronously after an assignment now fire one microtask later, potentially breaking a test that asserts immediate re-render.
- **Mitigation:** WO-19 owns the render coalesce; this WO only replaces storage, not call ordering. All current consumers call `refreshUi()` etc. manually after write, so behaviour is preserved. If any test fails, investigate — do NOT paper over with sync flush.
- **Risk:** Script-load order regression — if someone re-adds `store.js` in the wrong place, `state.js` crashes on `window.store.defineSlice`.
- **Mitigation:** Commit includes a runtime guard at `state.js` top: `if (typeof window.store?.defineSlice !== 'function') { throw new Error('store.js must load before state.js'); }`. This fails loud at boot rather than late.
- **Risk:** The `store.js` API doubles as the ADR-017 patch-readiness substrate; if designed wrong, WO-18 has to rewrite it.
- **Mitigation:** ADR-017 checklist passed in sub-task 8 + WO-18 reviewed concurrently by Agent γ (this agent) for API feedback before WO-18 branches.
- **Rollback:** `git revert <sha>` — WO is additive (Proxy shim leaves `state` direct access working, 4 keys gain dual-path). No migration of existing persisted data. Safe single-commit revert.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:javascript-developer
isolation: worktree
branch_prefix: claude/wo-16-store-scaffold-ui-slice
```

````markdown
You are implementing Step 16 (v0.28.0 store scaffold + ui slice) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-16-store-scaffold-ui-slice   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants (no bundler, classic <script src>, Gate-A 55/5/0)
  2. Read docs/ADR-013-observable-store.md (full — API + Constraints + Alternatives sections)
  3. Read docs/ADR-011-type-system-strategy.md §Decision (typedef rules)
  4. Read docs/ADR-017-collaborative-editing-readiness.md §Decision (readiness checklist)
  5. Read editor/src/state.js lines 193–222 (setPreviewLifecycleState — prior-art write pattern)
  6. Read editor/src/state.js lines 235–383 (god-state definition — slice sources)
  7. Read editor/src/boot.js lines 111–308 (theme/complexity/zoom init + set functions)
  8. Read editor/presentation-editor.html lines 1761–1785 (<script src> load order)
  9. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/store.js                   (new — ~310 LOC)
  - editor/src/state.js                   (edit — init store + Proxy shim)
  - editor/src/boot.js                    (edit — rewire theme/zoom/complexity writes via store.update)
  - editor/presentation-editor.html       (edit — add ONE <script src> line)
  - tests/unit/store.spec.js              (new — 12 cases)
  - docs/CHANGELOG.md                     (edit — Unreleased > Added)

FILES READ-ONLY (reference only):
  - docs/ADR-013-observable-store.md
  - docs/ADR-011-type-system-strategy.md
  - docs/ADR-017-collaborative-editing-readiness.md
  - docs/PAIN-MAP.md
  - docs/audit/AUDIT-A-architecture.md

SUB-TASKS:
  1. Create store.js with createStore factory, get/select/update/subscribe/batch API per ADR-013
  2. queueMicrotask-based notification; Object.freeze slices in dev; Proxy set-trap in prod
  3. Author @typedef UISlice + @typedef Store in JSDoc
  4. In state.js init: window.store.defineSlice('ui', {...}) BEFORE declaring state literal
  5. Add window.state Proxy shim for 4 migrated keys (complexityMode/previewZoom/theme/themePreference)
  6. Add guard: if window.store.defineSlice is not function, throw at top of state.js
  7. Rewire boot.js: initTheme/setThemePreference/setComplexityMode/setPreviewZoom to read + write via store
  8. Insert <script src="src/store.js"> between constants.js and state.js in shell HTML
  9. Write tests/unit/store.spec.js — 12 cases per sub-task 12 of WO
  10. Run test:unit (12/12) and test:gate-a (55/5/0)
  11. Update ADR-013 Status: Proposed → Accepted (phase 1) + Applied In line
  12. Update CHANGELOG.md Unreleased > Added

INVARIANTS (NEVER violate):
  - No type="module" on any <script>
  - No bundler dep added to package.json
  - Gate-A 55/5/0 must hold before merge
  - file:// workflow still works
  - window.state Proxy keeps reads working for all existing consumers unchanged
  - Store mutations on migrated fields go ONLY through store.update(sliceName, patch)
  - Listener fires exactly once per microtask batch
  - store.js has zero DOM references (no els.*, no document.*)
  - ADR-017 readiness checklist passed on ui slice
  - No Redux/MobX/Zustand or any runtime state-mgmt dep added
  - Russian UI copy preserved where present

ACCEPTANCE:
  - tests/unit/store.spec.js → 12/12
  - Gate-A remains 55/5/0
  - Manual: theme/complexity/zoom toggles propagate into store.get('ui')
  - store.batch coalesces multi-update to one notification
  - ADR-013 Status updated to Accepted (phase 1)
  - Conventional commit: feat(store): store.js scaffold + ui slice — v0.28.0 WO-16

ON COMPLETION:
  1. Run acceptance matrix in order
  2. git add editor/src/store.js editor/src/state.js editor/src/boot.js editor/presentation-editor.html tests/unit/store.spec.js docs/ADR-013-observable-store.md docs/CHANGELOG.md
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, test:unit result, Gate-A result, blockers if any
````

### Rollback plan

If merge breaks main: `git revert <sha>` — WO adds one new file + a Proxy shim. No persisted state migration. Revert restores god-state as the sole source; consumers keep working. Re-plan WO-16 narrower (e.g. start with a single-field Proxy on `theme` only), re-submit. NO fix-forward under pressure.
