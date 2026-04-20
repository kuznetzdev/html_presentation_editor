## Step 14 — v0.28.1 · tsconfig.json + JSDoc on state.js, constants.js, bridge.js + test:gate-types

**Window:** W3   **Agent-lane:** C   **Effort:** M
**ADR:** ADR-011   **PAIN-MAP:** P1-18 (gate-types is additive; gate rebalance noted)
**Depends on:** none (this is the foundational types-bootstrap)   **Unblocks:** ADR-012 (bridge typedefs lean on this), ADR-013 (observable store types)

### Context (3–5 lines)

ADR-011 chose JSDoc + `tsc --noEmit` over TypeScript emit to preserve the zero-build invariant (ADR-015). This WO bootstraps the type system: adds `tsconfig.json` (noEmit strict), adds `typescript` dev-dep (compile-time only), adds `npm run test:gate-types` script, and annotates three highest-priority public APIs — `editor/src/state.js` (god-state, `state` object at lines 235–383), `editor/src/constants.js` (shared constants, classic-script globals), and `editor/src/bridge.js` (bridge receive, lines 7–130 small file). All `.js`; zero `.ts`. Internals stay un-annotated per ADR §Decision §4. WO-14 explicitly avoids collision with Agent γ's module splits of `selection.js` and `boot.js` — those are out of scope; they're annotated in later WOs.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `tsconfig.json` | new | +28 / −0 |
| `editor/src/state.js` | edit (JSDoc typedefs + `@type {State}` on state object) | +110 / −0 |
| `editor/src/constants.js` | edit (JSDoc typedefs on exported const shapes) | +60 / −0 |
| `editor/src/bridge.js` | edit (JSDoc on `bindMessages` + message-event typedef) | +40 / −0 |
| `package.json` | edit (add `typescript` devDep + `typecheck` script + `test:gate-types` alias) | +4 / −0 |
| `.gitignore` | edit (ensure `*.tsbuildinfo` excluded — defensive though noEmit) | +1 / −0 |
| `docs/CHANGELOG.md` | edit | +3 / −0 |
| `docs/ADR-011-type-system-strategy.md` | edit Status line | +0 / −0 net |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/state.js` | full — state object at lines 235–383 plus supporting lib calls above |
| `editor/src/constants.js` | full — 177 LOC, all shared constants |
| `editor/src/bridge.js` | lines 1–130 — bindMessages and runtime guards |
| `editor/src/bridge-script.js` | read for context — DO NOT annotate in this WO (bridge-script is injected-string; typed later) |
| `docs/ADR-011-type-system-strategy.md` | normative — §Decision 1–6 |
| `docs/ADR-015-module-bundling-decision.md` | invariant — no build step; tsc runs noEmit only |
| `editor/presentation-editor.html` | script-load order — no HTML changes in this WO |

### Sub-tasks (executable, each ≤ 2 h)

1. Create `tsconfig.json` with exact ADR-011 §Decision §1 shape:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "none",
       "checkJs": true,
       "allowJs": true,
       "strict": true,
       "noEmit": true,
       "lib": ["DOM", "ES2022"],
       "skipLibCheck": true
     },
     "include": ["editor/src/state.js", "editor/src/constants.js", "editor/src/bridge.js"]
   }
   ```
   Scope `include` NARROWLY to the three files owned by this WO. Expanding to `editor/src/**/*.js` would pull in `selection.js` / `boot.js` (Agent γ splits in-flight) — collision risk. Reference: ADR-011 §Decision §1. Expected state after: `tsconfig.json` exists, includes exactly 3 files.
2. Install dev-dep `typescript@^5.4.0` (latest stable at 2026-04-20; verify with `npm view typescript version` before install). Run `npm install --save-dev typescript@^5.4.0`. Expected state after: `package.json` has `typescript` devDep; `package-lock.json` updated.
3. Add npm scripts to `package.json`:
   - `"typecheck": "tsc --noEmit"` — plain compile-less type check.
   - `"test:gate-types": "tsc --noEmit"` — alias so it fits gate naming. ADDITIVE; NOT in Gate-A.
   Expected state after: `npm run typecheck` and `npm run test:gate-types` both invoke the same command.
4. Add `.gitignore` line `*.tsbuildinfo` (defensive — even with noEmit, some configs can emit this). Expected state after: build artifacts never enter git.
5. Annotate `editor/src/constants.js`. For each exported const that has shape beyond primitive (e.g. `STARTER_DECKS` — Object.freeze of nested objects at lines 118–125), add `@typedef` + `/** @type {...} */`. For Sets (e.g. `BRIDGE_MUTATION_TYPES` at line 127, `IMPORT_ENTITY_KINDS` at 49–63), annotate as `/** @type {Set<string>} */`. Keep primitive consts (`HISTORY_LIMIT`, `MAX_VISIBLE_TOASTS`) as inferred. Reference: `editor/src/constants.js` lines 49–63, 118–125, 127–141, 161–175. Expected state after: `tsc --noEmit` emits 0 errors for constants.js; `grep "@typedef" editor/src/constants.js` returns ≥ 3 hits.
6. Annotate `editor/src/state.js`. Author `/** @typedef {Object} State */` covering the 75+ fields from the `state = { ... }` block at lines 235–383. Group into sub-typedefs for readability: `SelectionFlags` (lines 272–280), `SelectionPolicy` (referenced from `createDefaultSelectionPolicy`), `SlideRailDrag` (329–333), `AssetResolver` fields, `History` fields, `UI` fields. Attach `/** @type {State} */` to the `const state = { ... }` assignment at line 235. Reference: `editor/src/state.js:235-383`. Expected state after: `tsc --noEmit` reports 0 errors; `state.js` has a single canonical State typedef that ADR-013 (future observable store) will slice.
7. Annotate `editor/src/bridge.js`. Author:
   - `@typedef {Object} BridgeMessageEvent` — models `event.data` shape (`__presentationEditor`, `token`, `type`, `seq`, `payload`).
   - `/** @param {MessageEvent<BridgeMessageEvent>} event */` on the `window.addEventListener('message', ...)` callback at line 8.
   - `@typedef` stubs for the 15 case types reached in the switch (`bridge-ready`, `element-selected`, etc.) pointing to `any` for now with a comment `// filled by ADR-012 / WO-13`. This establishes the contract seam without duplicating work.
   Reference: `editor/src/bridge.js:7-106`. Expected state after: tsc clean on bridge.js; seams documented for WO-13 to fill in concrete types.
8. Run `npm run test:gate-types` (= `tsc --noEmit`). Fix any strict-mode errors. If a genuine strict-mode error surfaces (e.g. `state.modelDoc` is `Document | null` and gets `.querySelector` without guard), add the guard inline — do NOT widen the type to `any`. Budget: if fixes exceed 2 h, narrow `include` in tsconfig.json to only the offending file and file the others as follow-up WOs. ADR-011 §Decision §5 explicitly permits `any` in transitional internals but forbids it in public contracts. Expected state after: `tsc --noEmit` exit 0.
9. Run `npm run test:gate-a` — must be 55/5/0 (pure static check; should not affect runtime). Expected state after: baseline unchanged.
10. Add a CI-hint comment at the top of `tsconfig.json`: `// Classic-script project (ADR-015). checkJs + noEmit. DO NOT add emit / module flags.` Expected state after: future contributors cannot miss the invariant.
11. Update `docs/CHANGELOG.md` unreleased: `chore(types): bootstrap tsconfig + JSDoc on state/constants/bridge — ADR-011 partial`.
12. Update `docs/ADR-011-type-system-strategy.md` Status line to `Accepted (partial — tsconfig + 3 files annotated in v0.28.1; module-by-module rollout continues per Applied In)`.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dep added — **`typescript` is dev-only, `tsc --noEmit`; no emit, no bundle**
- [ ] Gate-A is 55 / 5 / 0 before merge (and after — type-check is static, no runtime impact)
- [ ] `file://` workflow still works
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A
- [ ] Russian UI-copy preserved — N/A (typedefs are English JSDoc; no shell string edits)
- [ ] `test:gate-types` is ADDITIVE — not in Gate-A. Baseline 55/5/0 unchanged.
- [ ] Types bootstrap uses JSDoc only — no `.ts` source files introduced
- [ ] `tsconfig.json` uses `noEmit: true` — literal presence verified by `grep '"noEmit": true' tsconfig.json`
- [ ] `include` scoped to `state.js`, `constants.js`, `bridge.js` only — does NOT overlap with files Agent γ is splitting (`selection.js`, `boot.js`)
- [ ] `any` usage: zero in annotated public contracts; permitted only in transitional internals per ADR-011 §5

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:gate-a` prints `55 passed, 5 skipped, 0 failed`
- [ ] `npm run test:gate-types` exits 0 (`tsc --noEmit` clean on the 3 files)
- [ ] `tsconfig.json` contains `"noEmit": true` and `"checkJs": true`
- [ ] `tsconfig.json` `include` array has exactly 3 entries: `state.js`, `constants.js`, `bridge.js`
- [ ] `grep "@typedef" editor/src/state.js | wc -l` ≥ 5 (State plus sub-types)
- [ ] `grep "@type {State}" editor/src/state.js` ≥ 1 hit
- [ ] `grep "@typedef" editor/src/bridge.js` ≥ 1 hit (BridgeMessageEvent)
- [ ] `grep -R "\.ts[\"']" editor/src/` returns zero hits (no TS source files)
- [ ] `package.json` has `typescript` in `devDependencies` and `test:gate-types` in `scripts`
- [ ] ADR-011 Status line reflects partial shipping (3 files annotated)
- [ ] Commit: `chore(types): bootstrap tsconfig + JSDoc on state/constants/bridge — v0.28.1 step 14`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| tsc --noEmit on state.js | gate-types | — (tsc itself) | N/A | 0 errors |
| tsc --noEmit on constants.js | gate-types | — | N/A | 0 errors |
| tsc --noEmit on bridge.js | gate-types | — | N/A | 0 errors |
| Runtime behavior unchanged | gate-a | existing | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** Strict-mode type-checking surfaces latent bugs in `state.js` (e.g. `state.modelDoc` is `Document | null`, but some call sites assume non-null). Adding guards may regress behavior if a fallback path was silently relying on the null case.
- **Mitigation:** For each strict-mode error, EXAMINE the call site before changing behavior. Prefer adding a typed-narrowing guard `if (!state.modelDoc) return;` matching existing fail-silent conventions (visible in many `editor/src/*.js` early-returns). If unsure, mark the site `/** @type {any} */` transitional and file a follow-up WO — do NOT silently change runtime logic.
- **Risk:** Agent γ is splitting `selection.js` and `boot.js` in Window 6 (v0.31.x per EXECUTION_PLAN). If this WO annotates cross-module APIs, Agent γ's rename will need touchups.
- **Mitigation:** `include` scoped to ONLY `state.js`, `constants.js`, `bridge.js`. Do NOT annotate `selection.js` or `boot.js` in this WO. File the remaining modules as a follow-up WO dependent on Agent γ's splits (WO-31 or similar). Explicitly list this hand-off in the completion report.
- **Rollback:** `git revert <sha>`. Delete `tsconfig.json` and remove `typescript` devDep per ADR-011 §Consequences ("Reversible: delete tsconfig.json and the dev-dep to revert"). JSDoc annotations are harmless comments; they can stay or be reverted individually.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:typescript-expert
isolation: worktree
branch_prefix: claude/wo-14-types-bootstrap
```

````markdown
You are implementing Step 14 (v0.28.1 Types bootstrap — JSDoc over TypeScript, no compile step) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-14-types-bootstrap   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md — zero-build invariant is load-bearing
  2. Read ADR-011 end-to-end — §Decision 1–6, §Out of scope
  3. Read ADR-015 — no bundler, no build step — tsc must be noEmit only
  4. Read editor/src/state.js full — state object is 235–383
  5. Read editor/src/constants.js full
  6. Read editor/src/bridge.js full (small file, 1–130)
  7. Run `npm run test:gate-a` — must be 55/5/0

FILES YOU OWN (exclusive write):
  - tsconfig.json (new)
  - editor/src/state.js (edit — JSDoc @typedef State + sub-types + @type {State} on state)
  - editor/src/constants.js (edit — @typedef for Set/Frozen shapes; primitives stay inferred)
  - editor/src/bridge.js (edit — BridgeMessageEvent typedef + @param on bindMessages callback)
  - package.json (edit — typescript devDep; typecheck + test:gate-types scripts)
  - .gitignore (edit — *.tsbuildinfo)
  - docs/CHANGELOG.md
  - docs/ADR-011-type-system-strategy.md (Status line)

FILES READ-ONLY (reference only):
  - editor/src/bridge-script.js (reference only — not annotated in this WO)
  - docs/ADR-011-type-system-strategy.md (normative)
  - docs/ADR-015-module-bundling-decision.md (invariant)
  - editor/presentation-editor.html (no edit; script-load order unchanged)

SUB-TASKS:
  1. Create tsconfig.json with ADR-011 §Decision §1 exact options. `include` scoped to 3 files ONLY.
  2. npm install --save-dev typescript@^5.4.0.
  3. Add package.json scripts: typecheck, test:gate-types (both run `tsc --noEmit`).
  4. Add .gitignore entry *.tsbuildinfo.
  5. Annotate constants.js — @typedef on Set/Frozen shapes; keep primitives inferred.
  6. Annotate state.js — @typedef State (+ SelectionFlags, SelectionPolicy, SlideRailDrag sub-types) and @type {State} on the state const.
  7. Annotate bridge.js — @typedef BridgeMessageEvent; @param MessageEvent<BridgeMessageEvent> on bindMessages callback.
  8. Run `npm run test:gate-types` — fix strict errors with inline guards, NOT by widening types; budget 2 h.
  9. Verify Gate-A 55/5/0.
  10. Add invariant comment at top of tsconfig.json.
  11. Update docs/CHANGELOG.md.
  12. Update ADR-011 Status line to "Accepted (partial ...)".

INVARIANTS (NEVER violate):
  - No `type="module"` added
  - No bundler dep (vite/webpack/esbuild) — typescript is dev-only noEmit
  - Gate-A 55/5/0 before AND after merge
  - `file://` still works (static type check has no runtime effect; sanity-check by opening editor from file system)
  - No new @layer (N/A)
  - Russian UI-copy preserved — typedefs are English JSDoc; no shell strings edited
  - test:gate-types ADDITIVE — NOT in Gate-A
  - JSDoc only — NO .ts files created; zero emit
  - tsconfig.json "include" scoped to state.js + constants.js + bridge.js only — do NOT overlap with selection.js / boot.js (Agent γ is splitting those)
  - `any` forbidden in public contracts; permitted in transitional internals per ADR-011 §5

CROSS-BATCH COORDINATION:
  - Agent γ is splitting selection.js + boot.js (Window 6 / v0.31.x). This WO must NOT touch those files.
  - WO-13 (this batch) will extend bridge.js types with concrete message-type typedefs — leaves them as `any` with TODO comments pointing to WO-13.

ACCEPTANCE:
  - Gate-A: 55/5/0 unchanged
  - `npm run test:gate-types` exits 0
  - tsconfig.json has "noEmit": true + "checkJs": true
  - tsconfig.json include has exactly 3 entries
  - grep @typedef editor/src/state.js | wc -l ≥ 5
  - grep @type {State} editor/src/state.js ≥ 1 hit
  - grep @typedef editor/src/bridge.js ≥ 1 hit
  - grep -R "\.ts[\"']" editor/src/ → 0 hits
  - ADR-011 Status partial-accepted
  - Commit: `chore(types): bootstrap tsconfig + JSDoc on state/constants/bridge — v0.28.1 step 14`

ON COMPLETION:
  1. Run full acceptance matrix
  2. git add tsconfig.json editor/src/state.js editor/src/constants.js editor/src/bridge.js package.json package-lock.json .gitignore docs/CHANGELOG.md docs/ADR-011-type-system-strategy.md
  3. Conventional commit: `chore(types): bootstrap tsconfig + JSDoc on state/constants/bridge — v0.28.1 step 14`
  4. Report: files changed, LOC delta, gate-a + gate-types results, any strict-mode surprises, follow-up WO scope for remaining modules (selection, boot, inspector-sync, bridge-commands, bridge-script, feedback, history, import, slide-rail, shortcuts, slides, style-app, toolbar, preview, primary-action, shell-overlays, dom, clipboard, context-menu, onboarding, export, main)
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Delete `tsconfig.json`, remove `typescript` devDep. JSDoc comments are harmless — can stay or revert individually. No runtime impact; `tsc --noEmit` is a static analysis step and does not modify output.

---
