# ARCH — Current vs Target (gap analysis)

> Side-by-side of v0.25.0 reality and v1.0 target. Drives PAIN-MAP prioritization + execution plan.
> Generated: 2026-04-20.

---

## Summary

| Dimension | Current (v0.25.0) | Target (v1.0) | Gap size |
|---|---|---|---|
| Module count | 25 JS + 8 CSS | ~36 JS + 11 CSS | Medium |
| Largest file | bridge-script.js 3438 LOC | bridge-script.js ~3200 LOC (slight) | Small |
| 2nd largest | boot.js 1962 LOC | boot.js ~600 LOC | **Large** (split) |
| 3rd largest | selection.js 1849 LOC | selection.js ~800 LOC | **Large** (split) |
| Type coverage | 0% | 80%+ via JSDoc | **Large** |
| State management | god-object (75+ fields) | observable store / 6 slices | **Large** |
| Bridge protocol | v1 unversioned | v2 versioned + validated | **Large** |
| Error handling | ad-hoc + 4 banners | unified 3-layer boundary | Medium |
| Test count | 271 | ~330 | Medium |
| Gate count | 6 (A/B/C/D/E/F) | 10 (+a11y/visual/contract/types) | Medium |
| Bridge contract tests | 0 | 100% of messages | **Large** |
| a11y gate | none | WCAG AA enforced | **Large** |
| Visual regression | scaffold only | 40 snapshots × light/dark | Medium |
| Perf targets | documented vaguely | measured + enforced | Medium |
| History memory | 14 MB/session (20 snapshots) | ≤ 2 MB (patch-based) | **Large** |
| First-select cost | 15–80 ms | ≤ 10 ms (RAF-coalesced) | **Large** |
| Security HIGH outstanding | 2 | 0 | **Large** |
| CVSS-High findings | 3 | 0 | **Large** |

Gaps labelled **Large** drive the window-by-window plan in `EXECUTION_PLAN_v0.26-v1.0.md`.

---

## Module-by-module delta

### Files that stay ~same size and purpose

| File | LOC now | LOC target | Change |
|---|---|---|---|
| main.js | 12 | 6 | Remove orphan DOM reparent (P1-08) |
| constants.js | 177 | 200 | Absorb `SEQ_DRIFT_TOLERANCE`, entity-kind list (ADR-016 L1), error codes (ADR-014), telemetry codes (ADR-020) |
| context-menu.js | 904 | ~900 | Minor — uses surface-manager |
| import.js | 774 | ~800 | + Trust Banner detection (P0-01) |
| export.js | 625 | ~650 | + vendored pptxgenjs path (P0-03) |
| slides.js | 492 | ~500 | + store integration |
| primary-action.js | 670 | ~600 | + debounce (P1-11) |
| toolbar.js | 152 | ~150 | — |
| preview.js | 34 | ~40 | + bridge-schema interpolation |
| style-app.js | 289 | ~290 | — |
| clipboard.js | 117 | ~150 | + type/size allow-list (P2-11) |
| bridge-script.js | 3438 | ~3200 | Thin slim via schema interpolation; still largest |

### Files that split

| Origin | Split into |
|---|---|
| `boot.js` (1962) | `boot.js` (~600) + `theme.js` + `zoom.js` + `shell-layout.js` |
| `selection.js` (1849) | `selection.js` (~800) + `layers-panel.js` + `floating-toolbar.js` |
| `feedback.js` (924) | `feedback.js` (~200 toasts) + `banners.js` + `surface-manager.js` |
| `history.js` (825) | `history.js` (~500 patches) + `overlap.js` |
| `dom.js` (361) | renamed → `inspector-bindings.js` |

### Files that are new

| New file | Purpose | ADR |
|---|---|---|
| `store.js` | Observable store with typed slices | ADR-013 |
| `bridge-schema.js` | Single source of truth for bridge messages | ADR-012 |
| `entity-kinds.js` | Declarative entity-kind registry | ADR-016 |
| `banners.js` | Unified banner infrastructure | ADR-014 |
| `surface-manager.js` | Transient-surface mutual exclusion | (P2-09) |
| `telemetry.js` | Opt-in local event log | ADR-020 |
| `theme.js` | (split from boot.js) | — |
| `zoom.js` | (split from boot.js) | — |
| `shell-layout.js` | (split from boot.js) | — |
| `layers-panel.js` | (split from selection.js) | — |
| `floating-toolbar.js` | (split from selection.js) | — |
| `overlap.js` | (split from history.js) | — |
| `precision.js` | Nudge/snap/guides | ADR-004 |
| `layer-picker.js` | Overlap popup | ADR-003 |

### Files that stay single-purpose but evolve internally

| File | Evolution |
|---|---|
| `shortcuts.js` | 160-line if/else → declarative keybindings table (~80 LOC, auto-generates cheat-sheet) (P2-04) |
| `inspector-sync.js` | Adopts InspectorViewModel pattern; 7-pass render becomes 1 RAF batch |
| `bridge.js` | Adds `hello` handshake + schema validation before dispatch |
| `bridge-commands.js` | Reads payloads via validated schemas; ACKs structured errors |
| `slide-rail.js` | `innerHTML=""` → keyed diff; arrow-key nav added (P0-08, P1-10) |
| `onboarding.js` | Starter-deck relocated; broken-asset recovery banner (P0-04, P0-15) |

---

## State shape delta

### Current (`state.js:235–383`)

One big object, 75+ fields across concerns:

```
state = {
  // model
  modelDoc, activeSlideId, slideOrder, ...
  // selection
  selectedNodeId, selectedFlags, selectionPolicy, clickThroughState, ...
  // history
  history, historyIndex, historyLimit, ...
  // ui
  complexityMode, previewZoom, theme, compactMode, workflow, ...
  // bridge
  bridgeToken, lastBridgeHeartbeatAt, pendingSelectionSeq, ...
  // transient
  slideRailDragContext, activeManipulation, pendingOverlayClickProxy, ...
  // ... ~50 more
}
```

Access: direct read/write from any module.

### Target (`store.js`, ADR-013)

```
store = {
  selection: SelectionSlice,     // owner: selection.js
  history:   HistorySlice,       // owner: history.js
  model:     ModelSlice,         // owner: import.js + bridge-commands.js
  ui:        UiSlice,            // owner: boot/theme/zoom
  bridge:    BridgeSlice,        // owner: bridge.js
  telemetry: TelemetrySlice,     // owner: telemetry.js
}
```

Access: `store.get/select/update/subscribe/batch`. Direct mutation forbidden (ADR-013 §"direct mutation frozen in dev").

### Migration approach

1. Create `store.js` with slices.
2. `window.state` becomes a **Proxy** that reads/writes against `store` slices (gradual).
3. Module-by-module: replace `state.X = Y` calls with `store.update("slice", {X: Y})`.
4. After all direct assigns migrated: remove Proxy shim; direct reads become `store.get()` in consumers.

No big-bang migration. Two versions of state coexist through the transition.

---

## Bridge protocol delta

| Aspect | v1 (now) | v2 (target) |
|---|---|---|
| Version negotiation | none | `hello` handshake |
| Payload validation | partial (attrs only in `updateAttributes`) | full schema, all messages |
| Origin check on postMessage | token only | token + `event.origin` |
| Sanitization | `updateAttributes` only | `parseSingleRoot` + `updateAttributes` + `replace-*` |
| Structured errors | free-form diagnostic | `{ok:false, error:{code,message,recoverable}}` |
| Idempotency | seq-tracked, no dedupe contract | explicit dedupe per `(type,nodeId,seq)` |
| Contract testing | 0 | 100% of 30 messages |

---

## Error handling delta

| Now | Target |
|---|---|
| `addDiagnostic()` — grab-bag | Layer 1 shell boundary with typed report |
| `reportShellWarning()` toast | Same, but coexists with banner |
| Bridge swallow at `bridge.js:100–104` | Structured ACK error propagated |
| 4 separate banners (`#lockBanner`, `#blockReasonBanner`, `#restoreBanner`, `#overlapBanner`) | 1 `#shellBanner` region with stacked intent-colored entries |
| No taxonomy | `constants.js` error code registry |

---

## Performance delta

| Metric | Now | Target | Delta |
|---|---|---|---|
| Cold start | 250–400 ms | ≤ 250 ms | -30% |
| First-select (20 el) | 15–25 ms | ≤ 10 ms | -50% |
| First-select (100 el) | 40–80 ms | ≤ 20 ms | -75% |
| Undo memory (20 steps) | 14 MB | ≤ 2 MB | -86% |
| Rail rebuild | full innerHTML | keyed diff | qualitative |

Drivers of improvement:

1. Store batch + RAF coalesce (ADR-013) fixes AUDIT-C #2 (selection fan-out)
2. Patch-based history (ADR-017) fixes AUDIT-C #1 (snapshot memory)
3. Keyed diff rail (PAIN-MAP P1-10) fixes AUDIT-C #3
4. `renderLayersPanel` gated on advanced-mode (PAIN-MAP P1-12)
5. Autosave debounce (PAIN-MAP P1-11)

---

## Test coverage delta

| Layer | Now | Target |
|---|---|---|
| Unit | 0 tests | ~100 tests (store + validators) |
| Contract (bridge) | 0 tests | ~30 tests (one per message) |
| Integration (Playwright) | 271 tests | ~330 tests |
| a11y | 0 tests | ~30 tests (axe + keyboard + contrast) |
| Visual | 0 baseline | ~40 snapshots × 2 themes |
| Performance | 0 harness | ~10 perf markers |

---

## Documentation delta

| Now | Target |
|---|---|
| 7 ADR skeletons (001–007) | 20 ADRs (001–020), all Accepted status |
| SOURCE_OF_TRUTH.md | Unchanged |
| ROADMAP_NEXT.md covers v0.25–v0.28.1 | Extended to v1.0.0 |
| PROJECT_SUMMARY.md | Updated for v1.0 capabilities |
| No audit docs | 5 AUDITs + PAIN-MAP + 2 ARCH docs in `docs/audit/` |
| No execution plan past v0.28 | EXECUTION_PLAN_v0.26-v1.0.md |
| Obsidian vault: 4 ADRs active | 20 ADRs synced + PROJ - Road to v1.0 + ARCH Target/Gap |

---

## What **stays the same**

Load-bearing invariants preserved through v1.0:

- Zero build step (ADR-015 affirmed)
- file:// workflow (works off double-click)
- Classic `<script src>` architecture (ADR-001)
- Shared global scope (ADR-003)
- Parent shell + iframe bridge + modelDoc (SOURCE_OF_TRUTH architecture section)
- Gate-A 55/5/0 baseline
- No network IO for editor core (per SOURCE_OF_TRUTH)
- Russian UI copy
- @layer cascade with `tokens.css` first (ADR-002)

---

## Links
- [ARCH - Target State v1.0](ARCH-target-state-v1.0.md)
- [PAIN-MAP](PAIN-MAP.md)
- [AUDIT-A architecture](AUDIT-A-architecture.md)
- [EXECUTION_PLAN](../EXECUTION_PLAN_v0.26-v1.0.md)
