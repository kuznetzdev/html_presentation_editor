## Step 23 — v0.31.3 · Split `feedback.js` → `banners.js` + `surface-manager.js`

**Window:** W4   **Agent-lane:** γ (Module split)   **Effort:** M
**ADR:** —   **PAIN-MAP:** P1-09, P2-09
**Depends on:** WO-21 (floating-toolbar split — `closeTransientShellUi` references `hideFloatingToolbar` which moves in WO-21)   **Unblocks:** WO-07 (Trust Banner — Agent α). Coordination with Agent α: if Agent α lands Trust Banner BEFORE this WO merges, WO-23 absorbs it into banners.js on arrival. If WO-23 lands first, Agent α targets `banners.js` for Trust Banner.

### Context (3–5 lines)

Per AUDIT-A §feedback.js + PAIN-MAP P1-09 and P2-09, `feedback.js` is **924 LOC** called "feedback" but actually contains five subsystems: toasts (50 LOC), shell metrics + popover layout (~340 LOC), surface-manager (`closeTransientShellUi` — 15 LOC that acts as the de-facto transient-UI mutex), tooltips + selection tooltips (~200 LOC), and block-reason + direct-manip helpers (~150 LOC). Audit-A found that banners (overlap/lock/block) actually live in `inspector-sync.js:839-944`, NOT in feedback.js — so this WO's scope is NOT the same as naïvely reading "banners" from PAIN-MAP. **DRIFT NOTE:** this WO carves `surface-manager.js` (the mutex owner) out of feedback.js, and creates `banners.js` as a new home for **future** banner code (Trust Banner from Agent α + the relocated banner-render code from inspector-sync.js — relocation of inspector-sync banners is NOT in scope for this WO; that is a post-v1.0 cleanup).

**Scope clarification:**
- **`surface-manager.js`** (NEW, ~50 LOC) — owns `closeTransientShellUi` + the keep-set normalisation. Addresses P2-09 (mutex scattered) directly.
- **`banners.js`** (NEW, ~50 LOC initial) — Trust Banner API surface: `registerBanner(id, renderFn)`, `showBanner(id, payload)`, `hideBanner(id)`, `getActiveBanners()`. Minimal scaffold. Serves as the landing zone for Agent α's Trust Banner (WO-07) and for a post-v1.0 migration of inspector-sync banner rendering. No banner code moves in THIS WO — only the scaffold is created.

### Split map (function-name → destination-file)

#### From `feedback.js` → `surface-manager.js`

| Source line | Function | Destination |
|---|---|---|
| feedback.js:55 | `normalizeShellSurfaceKeep(keepValue)` | surface-manager.js |
| feedback.js:65 | `closeTransientShellUi(options)` | surface-manager.js |

#### New in `banners.js` (no movement — pure scaffold)

New functions defined in `banners.js`:
- `const BANNER_REGISTRY = {}` (module-local map of id → render fn).
- `registerBanner(id, { render, priority })` — registers a render fn; records priority for stack order.
- `showBanner(id, payload)` — `BANNER_REGISTRY[id].render(payload)` + updates `store.update('ui', {activeBanners: ...})` tracking.
- `hideBanner(id)` — inverse.
- `getActiveBanners()` — reads `store.get('ui').activeBanners`.
- `@typedef BannerSpec { id: string, priority: number, render: (payload: any) => void }`

**Future (NOT this WO):**
- Overlap / lock / block-reason banner code from `inspector-sync.js:839-944` would migrate here. Not now.
- Trust Banner from Agent α's WO-07 lives here — Agent α's prompt references `banners.registerBanner('trust', ...)`.

**Everything else STAYS in `feedback.js`:** toasts (4–53), shell metrics (81–438), interaction mode (441–523), selection node access (525–542), visibility restore (544–625), cloneRect (627–643), block-reason helpers (646–704), selection tooltip (706–801), direct-manip block message (803–823). Feedback.js drops from 924 to ~910 LOC after removal of the 2 surface-manager functions.

**Feedback.js LOC after this WO:** 924 − ~25 (surface-manager functions + comments) = **~899 LOC**.

Feedback.js remains overloaded per AUDIT-A — full rename/split is out of scope for v1.0. CHANGELOG documents this.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/surface-manager.js` | new | +60 / −0 |
| `editor/src/banners.js` | new | +90 / −0 |
| `editor/src/feedback.js` | edit | +3 / −25 |
| `editor/src/store.js` | edit | +3 / −0 (add `activeBanners: []` to ui slice initial shape; or — preferred — define it as part of defineSlice in state.js) |
| `editor/src/state.js` | edit | +2 / −0 (extend ui slice initial with `activeBanners: []`) |
| `editor/presentation-editor.html` | edit | +2 / −0 (two new `<script src>` lines) |
| `tests/unit/banners.spec.js` | new | +140 / −0 |
| `tests/unit/surface-manager.spec.js` | new | +90 / −0 |
| `docs/CHANGELOG.md` | edit | +3 / −0 |
| `.codex/skills/html-presentation-editor/references/project-map.md` | edit | +5 / −1 (count 30 → 32) |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/feedback.js` lines 55–79 | source of surface-manager functions |
| `editor/src/feedback.js` (rest) | context — what stays |
| `editor/src/inspector-sync.js` lines 839–944 | existing banner code — future migration target (NOT this WO) |
| `editor/src/store.js` | banners.js writes to `ui.activeBanners` via `store.update` |
| `editor/presentation-editor.html` | script load order |
| `docs/audit/AUDIT-A-architecture.md` §feedback.js, §context-menu.js (mutex note) | rationale |
| `docs/PAIN-MAP.md` §P1-09, §P2-09 | scope |
| `docs/work-orders/W2/WO-07-trust-banner-*.md` if it exists (Agent α coordination) | Trust Banner integration point |

### Sub-tasks (executable, each ≤ 2 h)

1. Pre-flight: confirm WO-21 merged (closeTransientShellUi still references `hideFloatingToolbar` — which now lives in floating-toolbar.js, called via global scope). `npm run test:gate-a` 55/5/0; `npm run test:unit` 42/42; record baseline. Expected state after: clean baseline.
2. Check Agent α progress on WO-07 Trust Banner. Two paths:
   - **If WO-07 not yet merged:** proceed with this WO's scaffold. Agent α's WO-07 lands into `banners.js` when it ships — its prompt will be updated to target `banners.registerBanner('trust', ...)`.
   - **If WO-07 already merged:** this WO absorbs Trust Banner code into `banners.js` as part of the scaffold. Add `git log main --oneline | grep -i "trust banner"` detection in sub-task. Document path taken in commit body.
Expected state after: coordination resolved.
3. Create `editor/src/surface-manager.js`:
```
// surface-manager.js
// Layer: UI Chrome (Transient Surfaces)
// Mutex for transient UI surfaces: context-menu, layer-picker, insert-palette,
// slide-template-bar, topbar-overflow, floating-toolbar.
// Addresses PAIN-MAP P2-09 (mutex scattered across 3 files).
// Extracted from feedback.js in v0.31.3 per PAIN-MAP P1-09.
```
Expected state after: empty module file.
4. Cut/paste `normalizeShellSurfaceKeep` + `closeTransientShellUi` from `feedback.js:55-79` into `surface-manager.js`. Preserve indentation. No body edits (helpers like `closeContextMenu`, `closeLayerPicker`, `isInsertPaletteOpen`, `closeInsertPalette`, `isSlideTemplateBarOpen`, `closeSlideTemplateBar`, `isTopbarOverflowOpen`, `closeTopbarOverflow`, `hideFloatingToolbar` remain in their home modules; classic-script global scope resolves them at call time). Expected state after: surface-manager.js ~60 LOC.
5. In `feedback.js` delete the moved block. Leave:
```
      // Surface mutex moved to surface-manager.js (WO-23 — PAIN-MAP P1-09, P2-09).
      // closeTransientShellUi + normalizeShellSurfaceKeep remain callable via shared global.
```
Expected state after: feedback.js drops ~25 LOC.
6. Create `editor/src/banners.js` scaffold:
```
// banners.js
// Layer: UI Chrome (Banners)
// Banner registry: unified API for shell-level banners (Trust, Blocked-reason, Lock, Overlap-recovery).
// v0.31.3 (WO-23) ships the registry scaffold only. Existing banners in inspector-sync.js
// stay there for v1.0; post-v1.0 WO will migrate them here.
// Agent α's Trust Banner (WO-07) is the first consumer.

if (typeof window.store?.get !== 'function') {
  throw new Error('banners.js requires store.js loaded first');
}

const BANNER_REGISTRY = Object.create(null);

/**
 * @typedef BannerSpec
 * @property {string} id
 * @property {number} priority
 * @property {(payload: any) => void} render
 */

function registerBanner(id, spec) {
  if (!id || typeof id !== 'string') throw new Error('banners.registerBanner: id required');
  if (!spec || typeof spec.render !== 'function') throw new Error('banners.registerBanner: render required');
  const priority = Number.isFinite(spec.priority) ? spec.priority : 100;
  BANNER_REGISTRY[id] = { id, priority, render: spec.render };
}

function showBanner(id, payload) {
  const spec = BANNER_REGISTRY[id];
  if (!spec) {
    if (typeof reportShellWarning === 'function') {
      reportShellWarning('banners-unknown-id', { message: 'unknown banner id: ' + id }, { once: true });
    }
    return;
  }
  const activeBanners = window.store.get('ui').activeBanners || [];
  const next = activeBanners.filter((b) => b.id !== id).concat([{ id, payload, at: Date.now() }]);
  window.store.update('ui', { activeBanners: next });
  try {
    spec.render(payload);
  } catch (error) {
    if (typeof reportShellWarning === 'function') {
      reportShellWarning('banners-render-failed-' + id, error, { once: true });
    }
  }
}

function hideBanner(id) {
  const activeBanners = window.store.get('ui').activeBanners || [];
  const next = activeBanners.filter((b) => b.id !== id);
  window.store.update('ui', { activeBanners: next });
}

function getActiveBanners() {
  return window.store.get('ui').activeBanners || [];
}
```
Expected state after: banners.js ~90 LOC, exposes `registerBanner`/`showBanner`/`hideBanner`/`getActiveBanners` as globals.
7. In `state.js` (where the ui slice is defined in WO-16): extend `defineSlice('ui', {...})` to include `activeBanners: []`. Expected state after: ui slice has an initial `activeBanners` array.
8. Add `<script src>` lines in HTML. Order (post-WO-20/21/22):
```
1778	feedback.js
1779	selection.js
1780	layers-panel.js
1781	floating-toolbar.js
1782	toolbar.js
1783	surface-manager.js   (NEW — depends on feedback.js for helpers like isInsertPaletteOpen? NO — depends on shell-overlays.js. Insert AFTER shell-overlays.js)
1784	context-menu.js
...
```
**Correct placement:** `surface-manager.js` references `closeContextMenu` / `closeLayerPicker` / `closeSlideTemplateBar` / `closeTopbarOverflow` / `hideFloatingToolbar` / `closeInsertPalette` — all defined across shell-overlays.js / context-menu.js / floating-toolbar.js. Place `surface-manager.js` AFTER all 3. `banners.js` references `window.store` + `reportShellWarning` (history.js) — place AFTER state.js + history.js, can be as early as line ~1780.
Final order: `feedback → selection → layers-panel → floating-toolbar → toolbar → context-menu → inspector-sync → shell-overlays → surface-manager → banners → theme → zoom → shell-layout → boot → primary-action → main`.
Expected state after: HTML has 2 new script lines in correct dependency order.
9. Audit: `grep -n "closeTransientShellUi\|normalizeShellSurfaceKeep" editor/src/*.js`. Expect hits in selection.js, bridge-commands.js, boot.js (bindTopBarActions maybe), context-menu.js. Verify each still resolves via global scope after move. Expected state after: no call-site breaks.
10. Write `tests/unit/surface-manager.spec.js` — 5 cases: (a) `closeTransientShellUi({keep: 'context-menu'})` keeps context-menu open but closes others (stub every closer); (b) `normalizeShellSurfaceKeep(undefined)` returns empty Set; (c) `normalizeShellSurfaceKeep('x')` returns Set with one item; (d) `normalizeShellSurfaceKeep(['a','b',null])` returns Set with 2 items (null filtered); (e) `closeTransientShellUi()` (no keep) closes all 6 surfaces. Use `global.X = jest.fn()` style stubs for the 6 external closers. Expected state after: 5/5 pass.
11. Write `tests/unit/banners.spec.js` — 6 cases: (a) `registerBanner('trust', {render:fn})` stores the spec; (b) `showBanner('trust', {x:1})` calls render with payload AND pushes to `store.get('ui').activeBanners`; (c) `hideBanner('trust')` removes from active list; (d) `showBanner('unknown')` does NOT throw — reports via reportShellWarning stub; (e) `showBanner('a')` then `showBanner('a')` replaces existing entry (no duplicate); (f) `registerBanner('a', {})` throws (missing render). Expected state after: 6/6 pass.
12. Run full gate matrix: `test:gate-a` 55/5/0; `test:gate-b` green; `test:unit` 42 + 5 + 6 = **53/53**; manual smoke: open deck → open context menu → open layer picker (auto-closes context menu); open context menu → `store.update('ui', {...})` trigger (verify `closeTransientShellUi` still fires from existing call sites). Expected state after: all green + behaviour preserved.
13. Update `.codex/skills/html-presentation-editor/references/project-map.md`: module count 30 → 32. Add entries for `surface-manager.js` + `banners.js`. Update `feedback.js` description: `Toasts + shell metrics + interaction mode + tooltips + block-reason helpers (surface mutex moved to surface-manager.js; banner API moved to banners.js in v0.31.3).`. Expected state after: project-map reflects reality.
14. Update `docs/CHANGELOG.md` `## Unreleased` → `### Changed`: `Split feedback.js: surface-manager.js (closeTransientShellUi) + banners.js scaffold (Trust Banner host; PAIN-MAP P1-09, P2-09).` Note: if Trust Banner already integrated, add `### Added: banners.registerBanner('trust', ...) wired`. Expected state after: changelog accurate to state of Agent α's WO-07.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added
- [ ] Gate-A 55/5/0 before merge
- [ ] `file://` workflow still works
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A (no CSS)
- [ ] Russian UI-copy byte-identical (no copy moved in this WO)
- [ ] Script load order: surface-manager.js placed AFTER shell-overlays.js + context-menu.js + floating-toolbar.js (dependency direction); banners.js placed AFTER state.js + history.js (for store + reportShellWarning)
- [ ] Zero `import` or `require` statements
- [ ] Zero function-body edits — cut/paste only (banners.js scaffold is NEW code — but it is a ~50 LOC scaffold, reviewable at a glance)
- [ ] Runtime guards on banners.js fail loud on load-order mistake
- [ ] `window.store.ui.activeBanners` initial shape includes `[]` post-WO
- [ ] Agent α coordination: commit body documents whether Trust Banner path (a) or (b) was taken per sub-task 2
- [ ] Banner code in `inspector-sync.js` remains unchanged (this WO only provides the SCAFFOLD — existing banners migrate in a post-v1.0 WO)
- [ ] `closeTransientShellUi` still routes to the SAME 6 surface closers — behavioural parity required

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `wc -l editor/src/feedback.js` → 899 ± 10 LOC
- [ ] `wc -l editor/src/surface-manager.js` → 60 ± 5 LOC
- [ ] `wc -l editor/src/banners.js` → 90 ± 5 LOC
- [ ] `npm run test:gate-a` → 55/5/0 unchanged
- [ ] `npm run test:gate-b` → green
- [ ] `npm run test:unit` → 53/53 pass
- [ ] `grep -n "function closeTransientShellUi" editor/src/feedback.js` → 0 matches
- [ ] `grep -n "function closeTransientShellUi" editor/src/surface-manager.js` → 1 match
- [ ] `registerBanner('trust', ...)` callable from a Playwright eval after banners.js loads
- [ ] Manual smoke: context-menu-open + layer-picker-open scenarios still auto-close each other via surface-manager
- [ ] Project-map module count 32
- [ ] PAIN-MAP P1-09 marked PARTIALLY CLOSED (surface-manager done; banner migration deferred); P2-09 marked CLOSED
- [ ] Commit message: `refactor(arch): split feedback.js → surface-manager + banners scaffold — v0.31.3 WO-23`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| closeTransientShellUi mutex keeps specified surface | unit | `tests/unit/surface-manager.spec.js` | N/A | pass |
| banners.showBanner pushes to store.ui.activeBanners | unit | `tests/unit/banners.spec.js` | N/A | pass |
| banners.showBanner unknown id warns (no throw) | unit | `tests/unit/banners.spec.js` | N/A | pass |
| context-menu auto-close when layer picker opens | gate-a | `tests/playwright/editor.regression.spec.js` | pass (55/5/0) | pass (55/5/0) |
| insert palette auto-close on context-menu open | manual | — | pass | pass |

### Risk & mitigation

- **Risk:** Agent α's WO-07 Trust Banner ships either before or after this WO — coordination drift.
- **Mitigation:** Sub-task 2 explicitly detects state via `git log | grep trust banner`. Both paths have defined behaviour. Agent α is informed via `Unblocks` field in this WO header. If both WOs try to merge in the same window, Integration Agent E sequences them (Agent α's WO-07 first if it targets `feedback.js` initially; or after this WO if its prompt is updated to target `banners.js`).
- **Risk:** `closeTransientShellUi` at `feedback.js:65` is currently called from 4+ sites — a move plus a load-order mistake could cause `ReferenceError` mid-flow.
- **Mitigation:** Runtime guard at top of `surface-manager.js` verifies `closeContextMenu` exists (proxy for "shell-overlays.js loaded"). Audit sub-task 9 verifies call-site reachability. Manual smoke (sub-task 12) covers open-and-close-transient scenarios end-to-end.
- **Risk:** `banners.js` scaffold creates new PUBLIC API (registerBanner etc.) — if Agent α's WO-07 has a different assumed API shape, WO-23 landing first causes Agent α to refactor.
- **Mitigation:** API chosen matches common banner-registry patterns AND matches EXECUTION_PLAN Window 4 note "Trust Banner (P0-01 remediation)". Share the 4-function API surface with Agent α via `docs/work-orders/INTEGRATION-NOTES.md` (create if not exists, append). If API needs to change, it's reviewed before Agent α begins WO-07 coding. Additive changes to `banners.js` API are acceptable post-WO-23.
- **Risk:** Banners scaffold introduces `store.get('ui').activeBanners` as read API but no consumer yet — dead state field.
- **Mitigation:** Document in commit body: "activeBanners field is a forward-declaration for WO-07 (Trust) and post-v1.0 migration of inspector-sync banners. Not dead — empty until consumers register." Size cost: 1 array reference per session. Negligible.
- **Risk:** `feedback.js` retains 899 LOC and thus P1-09 is NOT fully closed — user-visible progress is ambiguous.
- **Mitigation:** CHANGELOG + commit body explicitly state "P1-09 partially closed — surface-manager separation complete; banner code migration from inspector-sync.js deferred to post-v1.0". P2-09 is fully closed (it was specifically about the mutex).
- **Rollback:** `git revert <sha>` — two new files gone, feedback.js restored, HTML lines removed. banners scaffold API gone; any consumer that registered a banner would fail. Since Agent α's WO-07 may depend on this scaffold, revert requires coordination with α. NO fix-forward under pressure.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:legacy-modernizer
isolation: worktree
branch_prefix: claude/wo-23-feedback-js-split
```

````markdown
You are implementing Step 23 (v0.31.3 split feedback.js → surface-manager + banners scaffold) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-23-feedback-js-split   (create from main, post WO-21 merge — coordinate timing with Agent α WO-07)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/audit/AUDIT-A-architecture.md §feedback.js
  3. Read docs/PAIN-MAP.md §P1-09 (surface mutex), §P2-09 (banners scattered)
  4. Check Agent α WO-07 status:
       `git log main --oneline | grep -iE "trust|banner|WO-07"`
       Document which path you take in commit body:
         - (a) α not merged yet → scaffold only
         - (b) α already merged → absorb Trust Banner into banners.js
  5. Verify baseline: `wc -l editor/src/feedback.js` → 924; test:gate-a 55/5/0; test:unit 42/42
  6. Read editor/src/feedback.js lines 55–79 (the TWO functions that move)
  7. Read editor/src/store.js (post-WO-16) to understand ui slice API

FILES YOU OWN (exclusive write):
  - editor/src/surface-manager.js         (new — ~60 LOC)
  - editor/src/banners.js                 (new — ~90 LOC scaffold)
  - editor/src/feedback.js                (edit — remove 25 LOC, leave comment)
  - editor/src/state.js                   (edit — add activeBanners:[] to ui slice init)
  - editor/src/store.js                   (edit ONLY IF typedef addition needed; prefer state.js edit)
  - editor/presentation-editor.html       (edit — add 2 new <script src> lines)
  - tests/unit/banners.spec.js            (new — 6 cases)
  - tests/unit/surface-manager.spec.js    (new — 5 cases)
  - docs/CHANGELOG.md
  - .codex/skills/html-presentation-editor/references/project-map.md
  - docs/work-orders/INTEGRATION-NOTES.md (create if absent — document banners API for Agent α)

FILES READ-ONLY (reference only):
  - docs/audit/AUDIT-A-architecture.md
  - docs/PAIN-MAP.md
  - editor/src/inspector-sync.js lines 839–944 (existing banners — do NOT migrate in this WO)
  - editor/src/context-menu.js (one of closeTransientShellUi call-sites)
  - editor/src/bridge-commands.js (one of call-sites)
  - editor/src/history.js (for reportShellWarning reference)

SUB-TASKS:
  1. Pre-flight gate-A + test:unit + Agent α coordination check
  2. Create surface-manager.js with header + cut/paste 2 functions from feedback.js
  3. Remove moved block from feedback.js; leave comment
  4. Create banners.js scaffold: BANNER_REGISTRY + registerBanner/showBanner/hideBanner/getActiveBanners + typedef
  5. Extend state.js ui slice init: activeBanners: []
  6. Add 2 <script src> lines in HTML: surface-manager AFTER shell-overlays; banners.js AFTER state.js + history.js
  7. Runtime guards on banners.js
  8. Audit call-sites via grep for closeTransientShellUi / normalizeShellSurfaceKeep
  9. Write 5 unit tests for surface-manager + 6 for banners
  10. Manual smoke: open context-menu + layer picker, verify mutex behaviour preserved
  11. Run test:gate-a (55/5/0) + test:gate-b (green) + test:unit (53/53)
  12. Create/append docs/work-orders/INTEGRATION-NOTES.md with banners API for Agent α
  13. Update project-map.md (30 → 32) + CHANGELOG (P2-09 CLOSED; P1-09 partial)

INVARIANTS (NEVER violate):
  - No type="module", no bundler
  - Gate-A 55/5/0 preserved
  - file:// still works
  - Russian UI copy byte-identical
  - Zero function-body edits in surface-manager cut/paste (pure move)
  - banners.js is a ~90 LOC scaffold — review every line for logic, no hidden copy
  - Runtime guards on banners.js
  - window.store.ui.activeBanners initial value is [] (empty array)
  - Agent α coordination: path (a) or (b) clearly documented in commit
  - inspector-sync.js banners stay put — migration is post-v1.0
  - Script load order: shell-overlays before surface-manager; state+history before banners

ACCEPTANCE:
  - feedback.js LOC ~ 899 (± 10)
  - surface-manager.js LOC ~ 60 (± 5)
  - banners.js LOC ~ 90 (± 5)
  - Gate-A 55/5/0; Gate-B green
  - test:unit 53/53 (42 prior + 11 new)
  - Manual context-menu/layer-picker mutex works
  - Agent α coordination documented in commit body
  - INTEGRATION-NOTES.md exists and describes banners.registerBanner API for Agent α
  - PAIN-MAP P2-09 CLOSED; P1-09 partial
  - Conventional commit: refactor(arch): split feedback.js → surface-manager + banners scaffold — v0.31.3 WO-23

ON COMPLETION:
  1. Run acceptance matrix
  2. git add editor/src/surface-manager.js editor/src/banners.js editor/src/feedback.js editor/src/state.js editor/presentation-editor.html tests/unit/banners.spec.js tests/unit/surface-manager.spec.js docs/CHANGELOG.md .codex/skills/html-presentation-editor/references/project-map.md docs/work-orders/INTEGRATION-NOTES.md
  3. Conventional commit per above
  4. Report back:
     - feedback.js LOC before/after
     - Which Agent α path (a or b) taken
     - test results
     - Banner API committed to INTEGRATION-NOTES for Agent α consumption
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Two new files gone + feedback.js restored. If Agent α's WO-07 has already landed and it registered into banners.js, revert could break Trust Banner. Coordinate with Agent α: if they're downstream, delay revert or roll forward with a narrower follow-up WO. NO fix-forward under pressure.
