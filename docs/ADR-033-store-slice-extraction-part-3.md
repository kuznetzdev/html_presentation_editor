# ADR-033: Store-slice extraction — Part 3 (Phase A5, assetResolver)

**Status**: Accepted — implementing in v2.0.27 (Phase A5 of Perfection Sprint Track A)
**Phase**: v2.0.27
**Owner**: Architecture · State layer
**Depends on**: ADR-013 (Observable Store), ADR-032 (precedent — Phase A4 slices)
**Date**: 2026-04-27

---

## Context

Phase A4 (v2.0.26 = `e46c906`) shipped four slices using the proven WO-16/17/18
Proxy-shim pattern: `multiSelect`, `panels`, `toolbar`, `modal`. The Phase A4
agent's continuation note recommended `assetResolver` as the smallest-risk
next migration target:

> "Recommend: smallest-risk first → assetResolver. assetResolverMap is already
> Object.create(null)-protected (SEC-006); migration must preserve that
> prototype-poisoning guard."

Phase A5 adopts that recommendation. The eight fields scheduled for migration
were enumerated in `ADR-032` §"What still lives on the raw state literal":

| Field | Default | Origin |
|---|---|---|
| `assetResolverMap` | `null` | written in `boot.js:1353` to a `Map` instance |
| `assetResolverLabel` | `""` | written in `boot.js:1359` |
| `assetObjectUrls` | `[]` | written in `boot.js:1352` |
| `assetFileCount` | `0` | written in `boot.js:1354` |
| `resolvedPreviewAssets` | `[]` | written in `boot.js:1548` and `export.js:558` |
| `unresolvedPreviewAssets` | `[]` | written in `boot.js:1549` and `export.js:559` |
| `baseUrlDependentAssets` | `[]` | written in `boot.js:1551` and `export.js:562` |
| `previewAssetAuditCounts` | `{ resolved:0, unresolved:0, baseUrlDependent:0 }` | written in `boot.js:1552` and `export.js:563` |

### Consumer inventory (full, file:line)

Surveyed via `Grep` over `editor/src/`:

| File | Lines | Operation |
|---|---|---|
| `boot.js` | 1179, 1182–1185 | reset (`cleanupAssetResolver`) |
| `boot.js` | 1289–1298 | read (`resolveAssetObjectUrl` — populates preview blob URLs) |
| `boot.js` | 1352–1359 | write (`setAssetDirectoryFromFiles`) |
| `boot.js` | 1399, 1404–1419 | read for status banner (`updateAssetDirectoryStatus`) |
| `boot.js` | 1431 | read (preview-doc rewrite guard) |
| `boot.js` | 1548–1552 | write (preview audit capture) |
| `export.js` | 558–567 | reset (export-validation reset) |
| `slides.js` | 450 | read (`createRenderedOutputContract` — preview build only) |
| `style-app.js` | 196, 227 | read (`buildRenderedOutputDocument`, `buildExportValidationPackage`) |
| `preview.js` | 13 | read (`buildPreviewPackage`) |
| `primary-action.js` | 331–337, 458–469, 527, 568 | read (action-label assembly) |
| `history.js` | 587–593 | read (debug snapshot text) |
| `broken-asset-banner.js` | 65–66 | read via `window.stateProxy.unresolvedPreviewAssets` |

**Total**: 8 fields, 8 consumer files (excluding `state.js`), ~30 read sites,
~12 write sites. All are off the click-to-select hot path. Click-to-select
goes through `applyElementSelection` → `selection` slice (verified during ADR-032
diagnosis); none of the eight assetResolver fields are read or written from
that path.

### SEC-006 / prototype-poisoning correction

The Phase A5 brief states "assetResolverMap is already
`Object.create(null)`-protected (SEC-006)". This is **not accurate**. Direct
inspection of `state.js` lines 793–804 confirms:

```javascript
assetResolverMap: null,                // initial
// (later written in boot.js:1353 to a Map instance)
```

`assetResolverMap` is a JavaScript `Map`, not a `Object.create(null)`
dictionary. The actual SEC-006 guards (verified in
`tests/playwright/specs/bridge-proto-pollution.spec.js`) are on
`slideRegistryById`, `slideSyncLocks`, and `lastAppliedSeqBySlide` — all of
which are **out of scope** for Phase A5.

`Map` instances are inherently safe against prototype-pollution from
attacker-controlled string keys (the standard `Map` API does not consult
`Object.prototype`). No additional guard is required, and the slice migration
preserves the `Map` semantics: the slice's `assetResolverMap` field stores
either `null` or a `Map` instance, exactly as today.

**SEC-006 spec result expected**: Pass unchanged. The spec exercises slide
registry only and does not touch any assetResolver field.

## Decision

Adopt the same Proxy-shim pattern proven in WO-16/17/18 and Phase A4. Add one
new slice (`assetResolver`) carrying all eight legacy field names verbatim
(no key renames — these legacy names are widely referenced and unambiguous).

### Per-slice schema (Phase A5)

```javascript
window.store.defineSlice("assetResolver", {
  assetResolverMap: null,
  assetResolverLabel: "",
  assetObjectUrls: [],
  assetFileCount: 0,
  resolvedPreviewAssets: [],
  unresolvedPreviewAssets: [],
  baseUrlDependentAssets: [],
  previewAssetAuditCounts: {
    resolved: 0,
    unresolved: 0,
    baseUrlDependent: 0,
  },
});
```

**Field naming**: Phase A4 trimmed prefixes for clarity (`multiSelectNodeIds` →
`multiSelect.nodeIds`, `toolbarPinned` → `toolbar.pinned`). Phase A5 keeps the
legacy names (`assetResolver.assetResolverMap`, etc.) for two reasons:

1. The `assetResolver` prefix already names the namespace; trimming it would
   produce `assetResolver.map` which is ambiguous (asset map? URL map?
   registry?). The legacy names are precise.
2. `previewAssetAuditCounts` and `unresolvedPreviewAssets` carry "preview"
   as a load-bearing scoping qualifier — these fields are specifically about
   _preview_ asset resolution, distinct from any future export-only audit.
   Renaming them would lose that scoping.

The mapping is therefore an identity map (legacy key === slice key), but the
Proxy-shim machinery is preserved verbatim from Phase A4 for consistency.

### Proxy-shim extension

```javascript
var _ASSET_RESOLVER_STATE_TO_SLICE = {
  assetResolverMap:         "assetResolverMap",
  assetResolverLabel:       "assetResolverLabel",
  assetObjectUrls:          "assetObjectUrls",
  assetFileCount:           "assetFileCount",
  resolvedPreviewAssets:    "resolvedPreviewAssets",
  unresolvedPreviewAssets:  "unresolvedPreviewAssets",
  baseUrlDependentAssets:   "baseUrlDependentAssets",
  previewAssetAuditCounts:  "previewAssetAuditCounts",
};
var _ASSET_RESOLVER_STATE_KEYS = new Set(Object.keys(_ASSET_RESOLVER_STATE_TO_SLICE));
```

One `if` branch is added to the Proxy `get` trap and one to the `set` trap,
mirroring `_PANELS_*`, `_TOOLBAR_*`, `_MODAL_*` blocks added in Phase A4.

### Backward-compat shim outcome

Zero call-site edits. All ~30 reads and ~12 writes work unchanged via the
Proxy shim:

- `state.assetResolverMap` reads pass through Proxy → store slice (returns
  the same `Map|null` reference).
- `state.assetResolverMap = finalMap` writes pass through Proxy →
  `store.update("assetResolver", { assetResolverMap: finalMap })` AND mirror
  to the raw state literal (so any code that closes over `_stateRaw` still
  sees the update — same pattern as Phase A4).

Ref-equality is preserved: the slice stores the actual `Map` instance, so
`state.assetResolverMap.has(...)` (boot.js:1291) keeps working without copy.

### What stays on the raw `state` literal

Per Phase A4 precedent, each migrated field stays in the raw literal as a
default-valued mirror. This is for backward-compat with any code path that
directly closes over `_stateRaw` (currently none for assetResolver, but the
pattern is invariant). Full removal from the raw literal is a future Phase A6
candidate.

## Migration plan

1. ADR-033 commit alone (this document) — no code change.
2. **Single-step migration commit**: add slice registration, mapping table,
   one `get`-trap branch, one `set`-trap branch, plus unit-test file.
   (Phase A4 used per-slice commits because there were 4 slices; Phase A5 has
   one slice and the changes are atomic.)
3. After commit: `npm run typecheck` → `npm test` (unit) → single-spec
   perf-budget run → single-spec SEC-006 → **full gate-A**.
4. Doc-bump + tag `v2.0.27` + push.

After the commit: `npm run test:gate-a` must remain ≥318/8/0.

## Verification plan

- `node --check editor/src/state.js` clean.
- `npm run typecheck` clean (Proxy traps already carry `@ts-ignore` markers).
- `node --test tests/unit/` (≥73 cases: 69 baseline + 4 new).
- Single-spec perf-budget: `click-to-select` p50 < 80 ms, p95 < 400 ms.
- Single-spec SEC-006: pass unchanged.
- **Full gate-A: ≥318/8/0**. No subset shortcut (Phase A4 RETRY agent skipped
  the full gate and shipped 2 latent flakes — full-suite runs are mandatory).

## Rollback plan

If gate-A regresses, `git revert HEAD` removes the single Phase A5 commit and
restores byte-identical pre-A5 behaviour. The Proxy-shim extension is
purely additive; the guard is a single `if (_ASSET_RESOLVER_STATE_KEYS.has(...))`
that only matches the eight legacy field names.

## Consequences

### Positive

- 8 more fields gain reactive `subscribe()` capability for future consumers
  (e.g. `broken-asset-banner.js` could subscribe to
  `assetResolver.unresolvedPreviewAssets` instead of polling `stateProxy`
  reads — Phase A6 candidate).
- state.js god-object literal owns 8 fewer "effective" fields after A5 (raw
  literal mirrors remain for backward-compat).
- Pattern reinforced for Phase A6 (next slice candidates: slides, bridge,
  autosave, diagnostics).

### Negative

- One more `if (_<NAME>_STATE_KEYS.has(...))` branch in `get`/`set` Proxy
  traps. Branch chain length is now 7 (ui, selection, history, multiSelect,
  panels, toolbar, modal, assetResolver = 8 actually). At ~10–12 branches a
  flat Map switch may be warranted; not yet.
- Slice has 8 keys (largest so far); no key renames means no asymmetry to
  learn (an upside for Phase A5 specifically).

### Neutral

- Per-slice file extraction continues to be deferred (Phase B candidate).

## Links

- ADR-013 — Observable Store (parent decision).
- ADR-032 — Phase A4 (multiSelect, panels, toolbar, modal) — direct precedent.
- WO-16 / WO-17 / WO-18 — earliest store-slice migrations (ui, selection,
  history).
- `tests/playwright/specs/bridge-proto-pollution.spec.js` — SEC-006 spec.
  Verifies slide registry null prototype, **not** assetResolverMap.
- Phase A5 dispatch brief — "smallest-risk first → assetResolver"
  (Perfection Sprint Track A, 2026-04-27).
