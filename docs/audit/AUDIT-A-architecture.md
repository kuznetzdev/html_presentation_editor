# AUDIT-A — Code Architecture · html-presentation-editor v0.25.0

Auditor: Audit-A (Code Architecture)
Baseline commit: 4dc20bd · Gate-A 55/5/0 · 25 JS modules · 8 CSS @layers · 1 HTML shell (1787 lines)
Scope: `editor/src/*.js`, `editor/styles/*.css`, `editor/presentation-editor.html`
Read-only: no production code changes.

## Executive summary

Overall architectural grade: **B (solid-but-aging)**. The repo has executed one of the hardest refactors in small-app land — splitting a ~24 000-line monolith into 25 classic `<script src>` files that still share a single global scope, without introducing a bundler — and the file-boundary seams (bridge layer, state layer, inspector-sync, bootstrap) are genuinely clean. However, the shared-global shape has produced a **god-state** (`state` in `state.js`, 75+ fields) and a **god-cache** (`els` in `state.js`, 190+ nodes), both concentrated in one file. The bridge protocol is well-isolated but **unversioned and untyped**, and the biggest modules (`bridge-script.js` 3 438 LOC, `boot.js` 1 962 LOC, `selection.js` 1 849 LOC, `inspector-sync.js` 1 384 LOC) still mix several concerns. `main.js` contains 12 lines of orphaned HTML-indented leftover code that should be scoped into `ensureNoviceSummaryStructure()` or `init()`. Refactor runway is real; the foundation is honest.

**Top 3 wins:** clean CSS @layer discipline; bridge isolated in its own self-contained `buildBridgeScript()` string; ZONE-marker comments keep navigation feasible.
**Top 3 risks:** god-state (`state` object) with no mutation protection; bridge protocol has no version negotiation; `els` cache makes module dependencies completely implicit (every file can reach into every DOM node).

---

## Scorecard

| Dimension | Score /10 | Evidence (file:line) |
|---|---:|---|
| Modular decomposition | 7 | 25 files, clear naming; but `boot.js` 1 962 LOC and `bridge-script.js` 3 438 LOC still bundle several concerns (bootstrap/theme/binding; selection/edit/sync/observers). |
| State management | 4 | Single `state` object `state.js:235-383` with 75+ fields, no setter/selector, no events, mutated from 15+ modules; `els` cache (`state.js:390-659`) leaks DOM access into every module. |
| Bridge protocol | 6 | Token-gated (`bridge.js:11`), seq-tracked for mutations (`bridge-commands.js:78-99`), stale-seq tolerance (`bridge-commands.js:59-67`); but no protocol version field, no payload schema, no handshake retry. |
| Error handling | 6 | `reportShellWarning()` (`history.js:34-52`) is consistent across the shell; `addDiagnostic()` captures iframe errors; but try/catch in bridge dispatch swallows specific command failures (`bridge.js:100-104`). |
| Module dependencies | 5 | All 25 files share global scope; implicit dependency graph; `main.js:5-12` violates "just call init()" contract with leaked DOM-setup code. |
| CSS @layer cascade | 9 | `tokens.css:2` declares canonical order `@layer tokens, base, layout, preview, inspector, overlay, modal, responsive;`; every file opens exactly that layer. Clean. |
| Dead code / duplication | 6 | `dom.js:314-328` has a commented-out forEach noop block; multiple near-identical `getFocusableElements` / `applyRovingTabindex` usages; 4+ places compute `state.historyIndex >= state.history.length - 1`. |
| Consistency of naming | 7 | ZONE comments consistent; but: mix of `bindX()`/`initX()`/`syncX()` prefixes; `STATE` inside bridge-script vs `state` in shell; `els.xBtn` vs `els.xInput` vs `els.xSection` — no schema. |
| Testability | 3 | No pure modules, no exports, no DI; every test has to spin Playwright to exercise because `state`/`els` are globals and every function mutates them; Gate-A has zero unit tests, only integration. |
| Evolvability | 5 | Adding a field = edit `state.js` + 5 other files; adding a bridge message = edit `bridge-script.js` + `bridge.js` + `bridge-commands.js`; feature flags live in `complexityMode === "advanced"` scattered checks (21 occurrences across 8 files). |

---

## Module-by-module findings

### `main.js` (12 LOC)
**Critical smell.** Contains orphaned 6-space-indented HTML-era leftover code before the `init()` call:
```
if (els.slideTemplateBar && els.slideTemplateBar.parentElement !== document.body) {
  document.body.appendChild(els.slideTemplateBar);
}
init();
```
(`main.js:5-12`). This DOM reparent belongs in `ensureNoviceSummaryStructure()` or in `bindSlideTemplateActions()`. Comment in `main.js:3` says "execute the two module-level bootstraps" but only one exists. The "entry point" is no longer only `init()` — it silently mutates layout first.

### `constants.js` (177 LOC)
**OK, with noise.** Clean keys/sets inventory. Still carries the legacy script-banner comment block (`constants.js:5-14`) that describes a 6-section monolith that no longer exists. Keep constants; delete the map comment. Constants like `SEQ_DRIFT_TOLERANCE` (bridge-commands.js:59) should live here, not in bridge-commands.js.

### `state.js` (667 LOC)
**God-state + god-cache.** Two problems in one file:
1. `state` (`state.js:235-383`) has 75+ fields crossing concerns: model, selection, history, toolbar, slide-rail-drag, zoom, theme, complexity, overlap, clickThroughState, bridge heartbeats, asset resolver, timers. No schema. No validation. Ten modules mutate it directly.
2. `els` (`state.js:390-659`) is an eager `document.getElementById(...)` cache of 190+ nodes, built at script-parse time. This means **module load order depends on DOM readiness** implicitly; any feature adding an `<input>` to the shell must add here, and any module anywhere can reach any node. There is no module `owns` their DOM nodes.

Also: `createDefaultSelectionPolicy()` (`state.js:8-126`) has 6 branches with near-identical policy objects — a ripe candidate for a policy-by-table lookup.

### `onboarding.js` (162 LOC)
**Suspicious coupling.** `ensureNoviceShellOnboardingUi()` (`onboarding.js:4-100`) reaches into `els.openHtmlModal.querySelectorAll('.warning-box, .upload-box')` and mutates inner HTML via `.innerHTML`. It trusts the shell HTML to have exactly 3 `.upload-box` elements in a specific order (`onboarding.js:68-70`). Fragile. Also `ensureNoviceSummaryStructure()` (lines 102-148) monkey-patches DOM order at boot — this is the kind of code that belongs as a one-shot mutation at HTML-author time, not runtime.

### `dom.js` (361 LOC)
**Name is misleading.** File is named `dom.js` but 95% of its content is `bindInspectorActions()` (lines 11-357) — one 346-LOC binder. The header comment ("Initializes the `els` object") is wrong; `els` is initialized in `state.js`. Rename to `inspector-bindings.js`.
Dead code: mouseenter-flash forEach block (`dom.js:314-328`) contains a no-op comment "// mouseenter flash removed — avoids ghost glow". The array and forEach should be deleted entirely.

### `bridge.js` (132 LOC)
**Thin but mixed.** `bindMessages()` is the parent-side dispatcher. It mixes message validation (`bridge.js:10-17`), state bookkeeping (`state.lastBridgeHeartbeatAt`), and concrete handler calls. The `switch` has 15 cases but hardcodes advanced-only check inline for `multi-select-add` (`bridge.js:91-97`) — inconsistent: all other mode-gating happens in handlers.
`bindRuntimeGuards()` catches all `error`/`unhandledrejection` globally — this can hide real bugs in other modules.

### `bridge-script.js` (3 438 LOC)
**Largest file, several concerns inlined.** `buildBridgeScript(token)` returns a template-literal IIFE that is evaluated inside the iframe. Inside, I count at least 8 sub-systems: engine detect, cssEscape/utils, entity-kind mapping, selection/hit-testing, text edit lifecycle, direct-manip, slide observer/runtime-metadata, message handler. Because it's one string, the sub-systems cannot be unit tested; they can only be read.
The string uses template-literal escapes with mixed single/double quotes and nested `\\$&` regex escapes (`bridge-script.js:63, 121`) — dense and error-prone. A decision to ship as a source file that gets read-at-runtime would remove this whole class of bugs.
The duplicated `KNOWN_ENTITY_KINDS` (`bridge-script.js:30`) and `CANONICAL_ENTITY_KINDS` (`bridge-commands.js:178-192`) carry the same list twice; drift risk.

### `bridge-commands.js` (844 LOC)
**Clear, but heavy state-juggling.** Functions are focused: `applyRuntimeMetadata`, `applyElementSelection`, `applyElementUpdateFromBridge`, `applySlideUpdateFromBridge`. Good seq-tracking (`bridge-commands.js:49-76`).
Concerns:
- `applyElementSelection` (`bridge-commands.js:349-422`) is 73 LOC and mutates 15 state fields + triggers `updateInspectorFromSelection`, `positionFloatingToolbar`, `renderSelectionOverlay`, `renderSlidesList`, `refreshUi`, `scheduleOverlapDetection` — big side-effect fan-out (see State management section).
- `deriveSelectedFlagsFromPayload` (`bridge-commands.js:262-301`) duplicates the flag-to-kind inference logic already in `getEntityKindFromFlags` (`bridge-commands.js:209-236`) — same information expressed two ways.

### `boot.js` (1 962 LOC)
**Too many unrelated bootstraps.** The file owns `init()` (`boot.js:12-44`) plus every single `init*()` and `bind*()` function in the app, plus theme management, complexity mode, selection mode, preview zoom, shell panel metrics, modals, topbar layout, and slide template binding. It's a 13-concerns-in-one-bag file. Reasonable split: `boot.js` keeps `init()` only; move theme → `theme.js`, zoom → `zoom.js`, modals-binding → `shell-overlays.js`, shell layout → `shell-layout.js`.

### `history.js` (825 LOC)
**Contains non-history code.** File starts with `undo()/redo()` (lines 4-16), `clearAutosave()`, `addDiagnostic()`, `reportShellWarning()` — but quickly drifts into overlap detection (`history.js:69-200+`), visual stack ordering, asset resolver bits. The "history" name is aspirational. Split: pure undo/redo snapshots stay; overlap/stack logic goes to `overlap.js`.

### `import.js` (774 LOC)
**OK, single responsibility.** `loadHtmlString()` (`import.js:12-130+`) is the central entry point; it does what the header promises. Minor: assumes `els.baseUrlInput.value` (`import.js:15`) is always present — reasonable given `els` eager-init, but crashes if HTML is ever refactored.

### `inspector-sync.js` (1 384 LOC)
**Split-persona.** `updateInspectorFromSelection()` is the contract; the rest is a grab-bag of visibility helpers, entity-kind → section mapping, getSelectedElementSummary copywriting, and overlap-banner rendering. The file does one thing architecturally (state → UI) but exposes ~80 helpers. Consider extracting a single `InspectorViewModel` that presents the state, with the DOM-writing as a separate pass.

### `selection.js` (1 849 LOC)
**Highest complexity hotspot.** Multiple concerns:
1. Selection overlay rendering (lines 8-108).
2. Direct manipulation state machine: startActiveManipulation → handleMove → queueBridgeUpdate → finish/cancel (lines 277-555).
3. Element clipboard (lines 791-826).
4. Media ops: rotate/flip/fit/reset (lines 828-940).
5. Wrap/transform/insert (lines 992-1077).
6. Layers panel rendering + drag-drop + lock/visibility (lines 1170-1613) — fully 444 LOC of "advanced layers" bolted onto "selection".
7. Floating toolbar positioning + dragging (lines 1651-1847).

That's 6 subsystems. At minimum, split out `layers-panel.js` (lines 1170-1613) and `floating-toolbar.js` (lines 1651-1847). Selection core shrinks to ~800 LOC.

Specific: `handleActiveManipulationMove` (`selection.js:436-455`) does 4 things in 19 lines (threshold check, rect compute, state mutation, bridge payload queue). The RAF-gated bridge update (lines 373-382) is correct but scattered — a named `BridgeBatcher` object would make intent obvious.

### `shell-overlays.js` (818 LOC)
**Reasonable but still mixed.** Modal focus-trap (lines 6-89), insert palette (lines 180+), topbar overflow (lines 120-178), layer picker (somewhere later), mode toggles. Each is a different UI pattern. Keep modal primitives, split palette + layer picker.

### `shortcuts.js` (219 LOC)
**Single responsibility, but braided.** One ~160-line `bindGlobalShortcuts` function (`shortcuts.js:6-169`). All keyboard shortcuts in a single if/else chain. Compare to a declarative keybinding table: `{ key: 'z', mod: true, action: undo }` — would cut the function to ~40 LOC and make the shortcut cheat sheet (Ctrl+?) self-generating instead of hand-maintained in HTML.

### `clipboard.js` (117 LOC)
**Clean.** Single responsibility: OS clipboard paste + file drag-drop. Good.

### `context-menu.js` (904 LOC)
**Big table, otherwise OK.** `buildContextMenuItems(payload)` (`context-menu.js:7-200+`) is one giant switch-by-entity-kind producing menu item arrays. The function structure is OK but the **mutual exclusion with other transient surfaces is implicit** — scattered across context-menu.js, shell-overlays.js, and feedback.js (see `closeTransientShellUi` in feedback.js:65-79). One surface-manager module would own this.

### `feedback.js` (924 LOC)
**Name too broad.** Toast system (lines 4-53) is fine. `closeTransientShellUi()` (lines 65-79) is the de-facto UI surface state machine — move to a surface-manager module. The rest (~800 LOC) is overlap detection rendering, block-reason banner, lock-banner — these belong in `inspector-sync.js` or a dedicated `banners.js`.

### `primary-action.js` (670 LOC)
**OK.** `syncPrimaryActionUi()` consolidates all button enable/disable logic — good single source. Minor: 3-4 places compute the same undo/redo enabledness (`primary-action.js:13-22`, `history.js:12`, `export.js:589/596`).

### `slides.js` (492 LOC), `slide-rail.js` (483 LOC)
**Split is correct.** `slides.js` = registry, `slide-rail.js` = rendering. Fine. Minor: `slide-rail.js:5` uses `els.slidesList.innerHTML = ""` then `.innerHTML = template` — string injection with manual escapeHtml. Could be a `<template>`-based renderer for less risk.

### `toolbar.js` (152 LOC)
**Trivially small; stub of a future module.** Only contains `updateFloatingToolbarContext()` + `initInspectorSections()` + `addInspectorHelpBadges()`. These are unrelated. Real "toolbar" code lives in `selection.js:1651-1847`. Rename or merge.

### `style-app.js` (289 LOC)
**OK.** `applyStyle`, `toggleStyleOnSelected`, `updateAttributes`, HTML editor modal bindings. Cohesive.

### `export.js` (625 LOC)
**Mixed.** `exportHtml()` + PPTX export + validation preview + a stray history-redo-truncation (`export.js:589`, `596`). The PPTX CDN-loader (`export.js:46-58`) should live in its own `pptx-loader.js` with a clearer API.

### `preview.js` (34 LOC)
**Good.** Only `buildPreviewPackage()` + `injectBridge()`. Correct thin orchestration.

---

## Bridge protocol analysis

### Shell → Iframe messages (22 types, via `sendToBridge`)

| Message type | Category | Idempotent? | Seq-gated? |
|---|---|---|---|
| `set-mode` | control | yes | no |
| `set-selection-mode` | control | yes | no |
| `navigate-to-slide` | control | yes | no |
| `select-element` | selection | yes | no |
| `select-best-child-of` | selection | yes | no |
| `proxy-select-at-point` | selection | ~ (has TTL opt) | no |
| `reset-click-through` | selection | yes | no |
| `highlight-node` | hover | yes | no |
| `flash-node` | feedback | yes | no |
| `apply-style` | mutation | no | YES |
| `apply-styles` | mutation | no | YES |
| `update-attributes` | mutation | no | YES |
| `replace-image-src` | mutation | no | YES |
| `reset-inline-styles` | mutation | no | YES |
| `delete-element` | mutation | no | YES |
| `duplicate-element` | mutation | no | YES |
| `move-element` | mutation | no | YES |
| `nudge-element` | mutation | no | YES |
| `insert-element` | mutation | no | YES |
| `replace-node-html` | mutation | no | YES |
| `replace-slide-html` | mutation | no | YES |
| `begin-direct-manipulation` | live-edit | no | no |
| `update-direct-manipulation` | live-edit | no | no |
| `commit-direct-manipulation` | live-edit | no | YES |
| `cancel-direct-manipulation` | live-edit | no | no |
| `table-structure-op` | mutation | no | no (!) |
| `navigate-table-cell` | control | yes | no |
| `toggle-visibility` | mutation | no | no (!) |
| `request-slide-sync` | control | yes | no |

### Iframe → Shell messages (14 types, via `post`)

| Message type | Direction | Payload schema |
|---|---|---|
| `bridge-ready` | iframe→shell | `{ engine }` |
| `bridge-heartbeat` | iframe→shell | `{}` |
| `runtime-metadata` | iframe→shell | `{ engine, slides, activeSlideId, editingSupported }` |
| `runtime-error` | iframe→shell | `{ message, source, line, column }` |
| `runtime-log` | iframe→shell | `{ message }` |
| `slide-activation` | iframe→shell | `{ requestId, requestedSlideId, activeSlideId, status }` |
| `element-selected` | iframe→shell | 25+ fields (nodeId, tag, html, rect, computed, attrs, flags, selectionPath, overlapCount, overlapIndex, ...) |
| `element-updated` | iframe→shell | same shape + editLifecycle |
| `selection-geometry` | iframe→shell | `{ nodeId, rect, computed }` |
| `slide-updated` | iframe→shell | `{ slideId, html, reason }` |
| `slide-removed` | iframe→shell | `{ slideId }` |
| `context-menu` | iframe→shell | `{ nodeId, clientX, clientY, ... }` |
| `shortcut` | iframe→shell | `{ action }` |
| `document-sync` | iframe→shell | `{ ... }` |
| `multi-select-add` | iframe→shell | `{ nodeId }` |

### Findings

**No version negotiation.** `bridge-ready` (`bridge-script.js:3424`) sends `{ engine }` only — no protocol version. If bridge-script and shell drift (e.g. someone edits bridge-script.js in an old worktree), there is no safe-reject path. **Risk: silent behavioral divergence on a stale preview URL.**

**No payload schema.** `element-selected` carries 25+ optional fields (see `deriveSelectedFlagsFromPayload` inference in `bridge-commands.js:262-301`). Missing fields fall through to `Boolean()` coercion. Adding a new flag means shell and bridge-script must both be updated in one commit; there is no compile-time enforcement.

**Idempotency inconsistency.** `toggle-visibility` and `table-structure-op` are mutations but are **not** in `BRIDGE_MUTATION_TYPES` (`constants.js:127-141`), so they skip the seq-tracking in `sendToBridge` (`bridge-commands.js:87-92`). This means a duplicate `toggle-visibility` message caused by a mid-flight re-render would apply twice without detection.

**Ordering assumption.** `applyElementUpdateFromBridge` uses `isStaleInboundSeq` (`bridge-commands.js:500-503`) with drift tolerance 2 to reject stale messages — good. But `begin-direct-manipulation` / `update-direct-manipulation` are not seq-gated; they rely on RAF batching in `selection.js:351-382`. If a `commit` arrives before a pending `update`, the preview can flash an older geometry.

**Token-gated security — good.** `bridge.js:11` rejects any message whose token doesn't match `state.bridgeToken`. Re-issued on every load via `createBridgeToken()`.

**Diagnostic coupling.** `bridge.js:65-72` sends every runtime error to the shell, which is the right move.

---

## State management analysis

### Where state lives

| Location | Role | Mutable from |
|---|---|---|
| `state` (global, in `state.js:235`) | Shell source of truth — model, selection, history, UI | 15 modules |
| `els` (global, in `state.js:390`) | DOM cache | every module |
| `STATE` (global, in `bridge-script.js:65`) | Iframe runtime state | only iframe |
| `document.body.dataset.editorWorkflow` | Shell chrome contract | 2 functions |
| `document.documentElement.dataset.theme` | FOUC-safe theme | `boot.js:76-83` + inline shell bootstrap (`presentation-editor.html:30`) |
| `localStorage` (7 keys) | Persistence | 6 modules |
| `sessionStorage` (TOOLBAR_SESSION_KEY) | Toolbar position | `selection.js:1663` |

**Problem: two-source-of-truth drift risk.** `state.theme` + `document.documentElement.dataset.theme` + `document.body.dataset.theme` must all stay synced (see `boot.js:76-84`). A bug that updates only one creates a dark-mode FOUC.

### State mutations — unprotected vs gated

**Gated:**
- `commitChange(reason, options)` (`bridge-commands.js:580`, many callers) — wraps history snapshot + dirty flag
- `sendToBridge()` — seq-tracks mutation messages
- `setPreviewLifecycleState()` (`state.js:217-222`)

**Unprotected direct writes:** the majority. Examples:
- `state.selectedNodeId = payload.nodeId` (`bridge-commands.js:352`)
- `state.selectedFlags = nextFlags` (`bridge-commands.js:368`)
- `state.clickThroughState = null` (`bridge-commands.js:385`)
- `state.multiSelectNodeIds.push(nodeId)` (`bridge.js:94`)
- `state.diagnostics = state.diagnostics.slice(-18)` (`history.js:30`)

No change notifications, no observers. Consumers (`updateInspectorFromSelection`, `renderSelectionOverlay`, `positionFloatingToolbar`, `refreshUi`) are called manually by the mutation site — error-prone.

### Side-effect chains (major ones)

`applyElementSelection` (`bridge-commands.js:349`) → mutates 15 state fields → triggers:
1. `clearOverlapGhostHighlight()`
2. `closeContextMenu()` (conditional)
3. `closeLayerPicker()` (conditional)
4. `syncSlideRegistry()`
5. `setInteractionMode()`
6. `updateInspectorFromSelection()` — itself calls ~30 sub-renders
7. `syncSelectionShellSurface()`
8. `positionFloatingToolbar()`
9. `renderSelectionOverlay()`
10. `renderSlidesList()`
11. `refreshUi()` — itself calls ~10 sub-renders
12. `scheduleOverlapDetection()`
13. `focusSelectionFrameForKeyboard()` (conditional)

One message → 13 potential renders. Debouncing/batching is ad-hoc (e.g. `scheduleOverlapDetection` uses timers, `queueActiveManipulationBridgeUpdate` uses RAF). A unified render pipeline ("dirty flags → single RAF flush") would halve the re-render count.

---

## Tech debt hot-spots (TOP 10)

| # | File | Lines | Complexity driver | Refactor proposal |
|---|---|---|---|---|
| 1 | `bridge-script.js` | 3 438 | 8 subsystems concatenated in one IIFE-string | Split the generated string into named sub-builders; consider shipping as a real module loaded via `fetch()` into a blob |
| 2 | `selection.js` | 1 849 | Selection + layers panel (444 LOC) + floating toolbar (196 LOC) glued together | Extract `layers-panel.js` + `floating-toolbar.js` (real ones — the existing `toolbar.js` is 152 LOC of leftover) |
| 3 | `boot.js` | 1 962 | Theme + complexity + zoom + layout + bindings + modals | Keep `init()` only; split theme/zoom/layout/modals |
| 4 | `state.js` `els` cache | 270 | 190+ eager DOM lookups in one object | Lazy getters or per-module DOM ownership |
| 5 | `state.js` `state` | 150 | 75+ fields, 6 unrelated sub-domains | Split: `ModelState`, `SelectionState`, `UiState`, `HistoryState`, `BridgeState` |
| 6 | `inspector-sync.js` | 1 384 | Section visibility + entity-kind mapping + summary copy + banner rendering | Extract `inspector-viewmodel.js` (pure) + `inspector-dom.js` (renders) |
| 7 | `feedback.js` | 924 | Toasts + overlap detection + banners + surface mutex | Split to `toasts.js` + `overlap.js` + `surface-manager.js` |
| 8 | `context-menu.js` | 904 | One 200-LOC `buildContextMenuItems` switch | Turn into a declarative table keyed by `entityKind` |
| 9 | `history.js` | 825 | Mixed with overlap detection and shell warnings | Move overlap to `overlap.js`; keep only undo/redo/commitChange |
| 10 | `shortcuts.js` | 219 | 160-LOC keydown if/else chain | Declarative keybinding table |

---

## Cyclic / leaky dependencies

Because every file shares global scope, there is no `import` graph to read. I reconstructed it from call sites.

**Leaky hubs (called from ≥10 other modules):**
- `sendToBridge()` defined in `bridge-commands.js:78`, called from 14 modules.
- `showToast()` defined in `feedback.js:4`, called from 14 modules (89 total call sites).
- `refreshUi()` (`boot.js`) — called from almost everywhere post-mutation.
- `state` / `els` — read/write from everywhere.

**Observed cycles:**
- `bridge-commands.js` `applyElementSelection` → `updateInspectorFromSelection` (`inspector-sync.js`) → `sendToBridge('highlight-node')` (via breadcrumbs hover) — which goes back through `bridge.js` dispatch → back into bridge-commands. Not a true cycle (it's async-postMessage), but it creates a feedback path.
- `selection.js:1188` calls `updateInspectorFromSelection` on lock toggle; `inspector-sync.js` reads `state.selectedPolicy` which was mutated by `selection.js`.
- `history.js` `restoreSnapshot` → `loadHtmlString` (`import.js`) → rebuilds preview → triggers `bridge-ready` → `applyRuntimeMetadata` (`bridge-commands.js`) → `syncSlideRegistry` (`slides.js`) → `renderSlidesList` (`slide-rail.js`).

**`window.X` bidirectional:**
- `window.matchMedia(...).addEventListener('change', ...)` for theme — `boot.js:140-156` guards against double-bind via `media.__presentationEditorThemeBound`.
- `window.Reveal / window.shower` read-only detection in `bridge-script.js:112-115` — fine.
- 19 total `window.X` references across 4 files — mostly `window.requestAnimationFrame`, `window.getSelection`, `window.matchMedia` — all safe.

---

## CSS @layer cascade — invariant check

`tokens.css:2` declares canonical layer order first, then immediately opens `@layer tokens { ... }`:
```
@layer tokens, base, layout, preview, inspector, overlay, modal, responsive;
@layer tokens { :root { ... } }
```

All 8 CSS files open exactly their named layer first:
- `tokens.css:4` → `@layer tokens`
- `base.css:1` → `@layer base`
- `layout.css:1` → `@layer layout`
- `preview.css:1` → `@layer preview`
- `inspector.css:1` → `@layer inspector`
- `overlay.css:1` → `@layer overlay`
- `modal.css:1` → `@layer modal`
- `responsive.css:1` → `@layer responsive`

**No violations.** Invariant held.

Shell HTML (`presentation-editor.html:36-43`) loads the CSS in `<head>` in this order:
tokens → base → layout → preview → inspector → overlay → modal → responsive.
The `@layer` declaration would enforce correct cascade even if link order drifted, but the link order matches the declared order too. Double-belted, clean.

---

## Dead code / duplication

| Finding | File:line | Nature |
|---|---|---|
| Empty mouseenter forEach block with only a comment | `dom.js:314-328` | 14 LOC of `[...].forEach((btn) => { /* removed */ });` — delete |
| Map comment describes zones of a deleted monolith | `constants.js:5-14` | Docs drift — obsolete |
| `zone-header` block-comment template repeats inside every file | every file's top | Cosmetic; could be auto-generated or dropped |
| `CANONICAL_ENTITY_KINDS` vs `KNOWN_ENTITY_KINDS` | `bridge-commands.js:178` vs `bridge-script.js:30` | Same list, two definitions, drift risk |
| `IMPORT_ENTITY_KINDS` vs `CANONICAL_ENTITY_KINDS` | `constants.js:49-63` vs `bridge-commands.js:178-192` | Same list, three definitions |
| Undo/redo enabledness check | `history.js:12`, `primary-action.js:15`, `export.js:589, 596` | 4 call sites compute `state.historyIndex >= state.history.length - 1` |
| `deriveSelectedFlagsFromPayload` duplicates `getEntityKindFromFlags` inverse | `bridge-commands.js:262-301` vs 209-236 | Same table, both directions |
| `main.js` orphan DOM reparent code | `main.js:5-12` | 6-space-indented leftover from HTML-era |
| `cssEscape` defined twice (shell + iframe) | bridge-script uses its own `cssEscape` (`bridge-script.js:119`), shell uses a helper (various) | Acceptable — different scopes, but confusing |
| Slide-rail `innerHTML` template inject | `slide-rail.js:62-78` | Manual `escapeHtml` interleaving — risky, also hard to maintain |

---

## Magic numbers / hardcoded strings (top 20 by impact)

| Value | Location | Concern |
|---|---|---|
| `SYNC_LOCK_WINDOW_MS = 900` | `constants.js:142` | Named, OK |
| `BRIDGE_WATCHDOG_INTERVAL_MS = 5000` | `constants.js:143` | Named, OK |
| `SEQ_DRIFT_TOLERANCE = 2` | `bridge-commands.js:59` | Should be in `constants.js` |
| `MAX_VISIBLE_TOASTS = 4` | `constants.js:116` | OK |
| `HISTORY_LIMIT = 20` | `constants.js:105` | OK |
| `maxMovement < 2` click-vs-drag threshold | `selection.js:465` | Unnamed — should be `CLICK_JITTER_THRESHOLD_PX` |
| `10` overlap min width | `history.js:131` | Hardcoded `overlap.width > 10 && overlap.height > 10` |
| `1280×720` default slide dimensions | `export.js` (PPTX) | Hardcoded default |
| `18` diagnostics buffer | `history.js:30` | `state.diagnostics.slice(-18)` — magic |
| `48` slide rail auto-scroll edge | `bridge-commands.js:772-781` | Magic |
| `20` slide rail step | `bridge-commands.js:774` | Magic |
| `180` suppress click after drag | `bridge-commands.js:767` | Magic |
| `1500ms` multi-select toast duration | `bridge.js:95` | Hardcoded |
| `2000ms` proxy TTL | `selection.js:465` (by policy) | Named in v0.24.0 changelog but check location |
| `6px` DIRECT_MANIP_THRESHOLD | `constants.js:148` | OK (named, changelog-documented) |
| `Инспектор…` (Russian UI strings) | scattered across all UI files | No centralized strings table |
| `"presentation-editor:..."` storage key prefix | 7 places | Named in constants, but substring repeated in tests/fixtures |
| `node-` prefix for node IDs | `bridge-script.js:241` | Cross-contract with shell parsing; should be a shared constant |
| `editor-group` class name | `selection.js:1620, 1640` | Hardcoded in two places |
| `SLIDE_ACTIVATION_MAX_ATTEMPTS = 8` | `constants.js:147` | OK |

---

## Recommendations (prioritized)

### P0 — Critical (address within 1–2 point releases)

1. **Fix `main.js` leakage.** WHAT: move the 6 lines of DOM reparent code out of `main.js` into `ensureNoviceSummaryStructure()` or `bindSlideTemplateActions()`; keep `main.js` to 3 lines (comment + `init();`). WHY: single-responsibility for the entry point; current state makes `main.js` structurally a regression. IMPACT: **S** EFFORT: **S**

2. **Add bridge protocol version field.** WHAT: include `protocolVersion: 1` in `bridge-ready` payload and in every shell→iframe message; shell rejects mismatched versions with a user-visible error. WHY: prevents silent stale-preview drift; needed before any future bridge-shape change. IMPACT: **L** EFFORT: **S**

3. **Register all mutation message types in `BRIDGE_MUTATION_TYPES`.** WHAT: add `toggle-visibility`, `table-structure-op` to the set (`constants.js:127`). WHY: these are mutations but currently bypass seq-tracking. IMPACT: **M** EFFORT: **S**

### P1 — High (next minor)

4. **Split `state.js` `state` into domain-scoped slices.** WHAT: `createModelState()`, `createSelectionState()`, `createUiState()`, `createHistoryState()`, `createBridgeState()` — each returning a plain object assembled into `state` for backwards compat. WHY: makes reasoning local; future sessions can refactor one slice. IMPACT: **L** EFFORT: **M**

5. **Split `selection.js` into three files.** WHAT: extract `editor/src/layers-panel.js` (lines 1170-1613) and replace the vestigial `toolbar.js` with `editor/src/floating-toolbar.js` (selection.js:1651-1847). WHY: selection.js is the single largest non-bridge file and mixes three subsystems. IMPACT: **L** EFFORT: **M**

6. **Deduplicate entity-kind lists.** WHAT: single `CANONICAL_ENTITY_KINDS` in `constants.js`; `bridge-script.js` reads it via string templating at build time (it's already a template literal); `bridge-commands.js` imports it. WHY: 3-place drift risk today. IMPACT: **M** EFFORT: **S**

7. **Introduce a `SurfaceManager`.** WHAT: one object owning `contextMenu`, `layerPicker`, `insertPalette`, `topbarOverflow`, `slideTemplateBar`, `floatingToolbar` mutual-exclusion. WHY: currently `closeTransientShellUi` (`feedback.js:65-79`) is the unofficial controller; logic is duplicated in each "open" function. IMPACT: **M** EFFORT: **M**

### P2 — Medium (next 2-3 minors)

8. **Declarative keybinding table.** WHAT: replace `shortcuts.js:6-169` if/else chain with `{ key, modifiers, when, action }[]`; cheat-sheet modal generates itself. WHY: fewer bugs, self-documenting. IMPACT: **M** EFFORT: **S**

9. **Rename and reorganize misnamed files.** WHAT: `dom.js` → `inspector-bindings.js`; absorb `toolbar.js` helpers into `inspector-sync.js`; split `feedback.js` → `toasts.js` + `overlap.js`. WHY: headers lie about contents; makes the project-map.md more useful. IMPACT: **S** EFFORT: **S**

10. **Delete `mouseenter` forEach noop.** WHAT: `dom.js:314-328`. WHY: dead code. IMPACT: **S** EFFORT: **S**

11. **Move `SEQ_DRIFT_TOLERANCE` to `constants.js`.** WHAT: constant currently hides in `bridge-commands.js:59`. WHY: discoverability. IMPACT: **S** EFFORT: **S**

12. **Name `CLICK_JITTER_THRESHOLD_PX`.** WHAT: the `< 2` magic number in `selection.js:465`. WHY: matches the discipline used for `DIRECT_MANIP_THRESHOLD_PX`. IMPACT: **S** EFFORT: **S**

### P3 — Long-term (roadmap conversation)

13. **Dirty-flag render pipeline.** WHAT: one `scheduleRender({ selection, slides, toolbar, ... })` that coalesces to a single RAF flush. WHY: eliminate 13-sub-render fan-out from `applyElementSelection`. IMPACT: **L** EFFORT: **L**

14. **Lazy `els` cache.** WHAT: `els` as a `Proxy` with lazy getters, so adding a shell element doesn't require a state.js edit. WHY: less friction for non-critical UI additions. IMPACT: **M** EFFORT: **M**

15. **Bridge-script as a real source file.** WHAT: move `buildBridgeScript()` to shipping `editor/src/bridge-runtime.js` (a regular file fetched as text and injected via blob). WHY: removes template-literal escaping, enables syntax highlighting/linting. IMPACT: **M** EFFORT: **M**

---

## Risks and invariants to protect in any refactor

- **`file://` compatibility** — no ES modules, no bundler, no dynamic import. Any split must add another `<script src>` in `presentation-editor.html:1761-1785` in dependency order.
- **Boot order is load-order.** `state.js` must run before anything that touches `state` or `els`; `main.js` must be last. Moving code between files risks shuffling script order.
- **`init()` as last line of `main.js`** — CLAUDE.md §8 invariant. Even the leaked DOM reparent code in `main.js:5-10` technically violates spirit of that invariant.
- **Clean export** — nothing in the refactor can leak `data-editor-*` attrs into export; `feedback.js:579+ applyElementUpdateFromBridge` and the attribute-stripping in `bridge-commands.js:513-523` are the load-bearing lines.
- **Gate-A 55/5/0** — anything that changes module load order must re-prove.

---

## Summary: what good looks like one refactor away

- `state` split into 5 named sub-states, mutation gated by one `dispatch(action, payload)` helper.
- Bridge protocol v1 handshake + versioned payloads + all mutations seq-tracked.
- `selection.js` under 1 000 LOC; layers panel + floating toolbar live in their own files.
- `boot.js` under 400 LOC; theme/zoom/layout/modals as siblings.
- One `SurfaceManager` owning transient UI mutual exclusion.
- Declarative keybindings.
- No magic numbers in code paths touched by release notes.

All reachable without introducing a bundler. The current module split is the right scaffolding; next step is honest bookkeeping inside the scaffolding.
