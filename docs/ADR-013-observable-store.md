# ADR-013: Observable Store — slice-typed state with subscribe-per-slice

**Status**: Accepted (phase 1 — 2026-04-21)
**Phase**: v0.28.x–v0.32.x (gradual migration)
**Owner**: Architecture · State layer
**Depends on**: ADR-011 (JSDoc types)
**Date**: 2026-04-20

---

## Context

From AUDIT-A:

- `state` object in `state.js:235–383` has **75+ fields** — a true god-object.
- Mutated from **15+ modules**. No schema. No validation. No setter. No change-notification.
- Consuming modules re-render by brute force via `refreshUi()` or targeted calls (`updateInspectorFromSelection`, `renderSelectionOverlay`, `renderSlidesList`) — see AUDIT-C bottleneck #2: **7 synchronous render passes per click**.
- AUDIT-A scorecard — State management: 4/10.

The classical pain:

- Adding a field means editing `state.js` + at minimum 5 other modules.
- `complexityMode === "advanced"` checks scattered 21× across 8 files (AUDIT-A PAIN-MAP P2-08).
- No module "owns" a slice of state; every module can mutate anything.

But: no bundler (ADR-015 invariant). Classic `<script src>` + shared globals. Redux/MobX/Zustand bring ES-module assumptions that break file://.

---

## Decision

Introduce a **hand-rolled observable store** with typed slices. Classical-script friendly. Zero deps.

### Shape

```javascript
/**
 * @typedef {Object} SelectionSlice
 * @property {string|null} activeNodeId
 * @property {string|null} activeSlideId
 * @property {number} overlapIndex
 * @property {Array<string>} candidates
 * ...
 */

window.store = createStore({
  selection: { activeNodeId: null, activeSlideId: null, overlapIndex: 0, candidates: [] },
  history:   { index: 0, limit: 20, snapshots: [], dirty: false },
  model:     { doc: null, slides: [], modelDirty: false },
  ui:        { complexityMode: "basic", previewZoom: 1, theme: "auto" },
  bridge:    { token: null, heartbeatAt: 0, pendingSeq: 0 },
});
```

### API

```javascript
store.get("selection");            // read slice (frozen in dev)
store.select("selection.activeNodeId"); // read path
store.update("selection", { activeNodeId: "n7" }); // patch slice
store.subscribe("selection", (next, prev) => {...}); // per-slice listener
store.subscribe("selection.activeNodeId", cb);       // path listener
store.batch(() => { store.update(...); store.update(...); }); // one notification
```

### Constraints

- All mutations go through `update()` — direct mutation frozen in dev via Object.freeze; in prod a Proxy set-trap logs.
- Mutation produces a shallow-cloned slice; subscribers are called **once per batch** via microtask.
- Listeners are weak refs (WeakSet-backed where possible) to prevent leaks.
- Migration is **gradual**: `window.state` remains as a view of store slices during transition (Proxy getter). Old modules keep working unchanged.

### Render coalescing (solves AUDIT-C bottleneck #2)

`applyElementSelection` currently triggers 7 render functions. With the store:

```javascript
store.batch(() => {
  store.update("selection", { ... });
  store.update("ui", { ... });
});
// → ONE microtask notification → render scheduler picks up changed slices → single RAF pass
```

### What lives where

| Slice | Owner | Reads from |
|---|---|---|
| selection | selection.js | inspector-sync, floating-toolbar, context-menu, slide-rail |
| history | history.js | primary-action (save button), export |
| model | import.js + bridge-commands | export, slide-rail, inspector-sync |
| ui | boot.js (theme/zoom/mode) | every module (read-only) |
| bridge | bridge.js | import.js (token init), history (heartbeat) |

Writes outside the owner → ESLint rule (new, lightweight).

---

## Consequences

**Positive:**
- State drift caught at write time (slice ownership).
- Render fan-out coalesces — first-select cost drops from 15–80 ms to estimated 5–15 ms.
- New features add slices, not fields to god-state.
- Unblocks ADR-011 (slice schemas as typedefs) and ADR-014 (error boundaries per slice).
- Makes unit tests possible: slice reducers are pure.

**Negative:**
- Migration surface: every `state.X = ...` assignment → `store.update("slice", {X: ...})`. ~200 call sites.
- Legacy `state` Proxy shim adds ~1 ms overhead at boot. Acceptable.
- Requires discipline to not mutate slice objects directly.
- Change-notification model interacts with `requestAnimationFrame` scheduling — subtle bugs during migration. Mitigated by comprehensive contract tests on store itself.

---

## Alternatives Considered

1. **Redux** — requires ES modules. ❌
2. **MobX** — runtime-compile decorators + ES modules. ❌
3. **Zustand / Valtio** — ES modules. ❌
4. **EventTarget + custom events** — viable, but no typed subscribe paths; heavier than a 300-LOC custom store.
5. **Keep `state` as-is; add render coalescing only** — fixes AUDIT-C #2 but does not fix AUDIT-A evolvability ceiling.

---

## Applied In

- v0.28.3 — `store.js` module scaffold + `ui` slice bootstrap (`defineSlice("ui", ...)`) ✓
- v0.28.4 — `boot.js` rewired: `applyResolvedTheme`, `setThemePreference`, `setComplexityMode`, `setPreviewZoom` sync writes to `store.update("ui", ...)` ✓
- v0.28.5 — selection slice migration: 16 fields migrated (`defineSlice("selection", ...)`), `applyElementSelection` batched via `store.batch`, `createDefaultSelectionPolicy` refactored to table-lookup (P2-07), Proxy shim extended with 16 selection mappings ✓
- v0.29.0 — `history` slice + patch-based snapshots: `defineSlice("history", ...)`, `captureHistorySnapshot` / `undo` / `redo` all use `store.batch` + `store.update`, FNV-1a 32-bit hash dedup, periodic baseline roll (every 10 deltas), HISTORY_LIMIT=20 with overflow toast, history budget chip UI, CommonJS exports for Node test runner, 12 unit cases ✓
- v0.29.1 — render coalescing wired (PAIN-MAP P0-12, P1-12): `scheduleSelectionRender` + `flushSelectionRender` in `state.js`; `applyElementSelection` / `applySelectionGeometry` / `clearSelectedElementState` in `bridge-commands.js` use scheduler; P1-12 `renderLayersPanel` guard in `inspector-sync.js`. Pre: 7 synchronous render passes per click. Post: 1 RAF per click. 11 unit cases (43/43 test:unit). Gate-A: 59/5/0 ✓
- v0.30.x — `model` slice; `window.state` shim shrinks further
- v0.31.x — `bridge` slice; `window.state` shim removed

## Links
- [ADR-011 Type System Strategy](ADR-011-type-system-strategy.md)
- [ADR-014 Error Boundaries](ADR-014-error-boundaries.md)
- AUDIT-A §state.js · §Scorecard state-management 4/10
- AUDIT-C bottleneck #2 (render fan-out) + quick-win #1 (RAF coalesce)
- PAIN-MAP P0-09, P0-11, P0-12
