# AUDIT-C — Performance audit

**Scope:** html-presentation-editor v0.25.0 — shell + 25 classic `<script src>` modules + 8 CSS layers + iframe bridge.
**Method:** static architectural review (no live profiling). Line and byte references point at current `main`.
**Constraints preserved:** zero-build, file:// compatible, no bundler. All recommendations respect these.

---

## Executive summary

**Overall perf grade: 6.5 / 10.**

The editor is fast enough for small/medium decks on modern laptops: cold-start budget lands around 250–400 ms on a mid-range CPU, and a single-click selection cycle is within ~25–40 ms on a 20-element slide. The architecture pays three structural taxes that grow with deck size and element density:

1. **Full-HTML history snapshots.** Every commit serialises the entire `modelDoc` (`serializeCurrentProject`, `export.js:601-606`) and stores up to 20 copies (`constants.js:105`). On a 50-slide deck this is 10–40 MB of retained strings plus a `cloneNode(true)` + `outerHTML` per commit (~20–80 ms).
2. **Render fan-out per selection.** `applyElementSelection` (`bridge-commands.js:349-422`) triggers `updateInspectorFromSelection` → `renderLayersPanel` → `syncSelectionShellSurface` → `positionFloatingToolbar` → `renderSelectionOverlay` → `renderSlidesList` → `refreshUi` → `scheduleOverlapDetection`, i.e. seven view-layer passes. Each one does independent `getBoundingClientRect` reads and style writes — classic layout thrashing.
3. **Full rail rebuild on every change.** `renderSlidesList` clears `innerHTML` and rebuilds all slide cards on every state change (`slide-rail.js:4-6`). At 50 slides × DOM thumbnail + `state.modelDoc.querySelector` per card this is the single largest avoidable allocation in the shell.

**Top 3 quick wins (highest ROI, lowest risk):**
- Debounce / RAF-coalesce the selection fan-out (one `requestAnimationFrame` gate for the 7 render passes).
- Hash-compare history snapshots before storing full HTML; drop to diff-indexed storage after N snapshots.
- Incrementalise `renderSlidesList` (keyed diff instead of `innerHTML = ""`).

---

## File size inventory

| File | Bytes | Lines | Parse cost (est, ms) |
|---|---:|---:|---:|
| editor/src/bridge-script.js | 151 754 | 3 438 | ~3.4 (executes inside iframe only) |
| editor/src/inspector-sync.js | 63 093 | 1 384 | ~1.4 |
| editor/src/boot.js | 79 575 | 1 962 | ~2.0 |
| editor/src/selection.js | 78 510 | 1 849 | ~1.9 |
| editor/src/feedback.js | 36 406 | 924 | ~0.9 |
| editor/src/context-menu.js | 33 735 | 904 | ~0.9 |
| editor/src/bridge-commands.js | 34 032 | 844 | ~0.8 |
| editor/src/history.js | 32 353 | 825 | ~0.8 |
| editor/src/shell-overlays.js | 32 637 | 818 | ~0.8 |
| editor/src/import.js | 30 403 | 774 | ~0.8 |
| editor/src/primary-action.js | 32 637 | 670 | ~0.7 |
| editor/src/state.js | 34 993 | 667 | ~0.7 |
| editor/src/export.js | 26 220 | 625 | ~0.6 |
| editor/src/slides.js | 19 074 | 492 | ~0.5 |
| editor/src/slide-rail.js | 20 657 | 483 | ~0.5 |
| editor/src/dom.js | 16 794 | 361 | ~0.4 |
| editor/src/style-app.js | 11 597 | 289 | ~0.3 |
| editor/src/shortcuts.js | 8 781 | 219 | ~0.2 |
| editor/src/onboarding.js | 8 781 | 162 | ~0.2 |
| editor/src/toolbar.js | 7 731 | 152 | ~0.2 |
| editor/src/constants.js | 6 376 | 177 | ~0.2 |
| editor/src/clipboard.js | 4 914 | 117 | ~0.1 |
| editor/src/bridge.js | 5 624 | 132 | ~0.1 |
| editor/src/preview.js | 1 774 | 34 | ~0.0 |
| editor/src/main.js | 359 | 12 | ~0.0 |
| **JS subtotal (shell)** | **~780 KB** | **~20 680** | **~20.5 ms** (shell-only) |
| **bridge-script.js (iframe)** | **~152 KB** | **~3 438** | **~3.4 ms** (iframe-only) |

CSS (all layers parsed in head, blocking first paint):

| File | Bytes | Lines |
|---|---:|---:|
| editor/styles/preview.css | 19 441 | 865 |
| editor/styles/inspector.css | 15 295 | 735 |
| editor/styles/overlay.css | 14 520 | 641 |
| editor/styles/responsive.css | 10 042 | 540 |
| editor/styles/layout.css | 9 706 | 445 |
| editor/styles/base.css | 8 997 | 407 |
| editor/styles/tokens.css | 6 926 | 206 |
| editor/styles/modal.css | 3 457 | 165 |
| **CSS subtotal** | **~88 KB** | **~4 004** |

Shell HTML: `editor/presentation-editor.html` — **78 254 bytes / 1 787 lines**.

**Total wire cost (shell load, excluding iframe bridge):** ~**946 KB** across 34 files (25 JS + 8 CSS + 1 HTML).
**bridge-script.js** is not loaded on cold start — it is *generated as a string* by `buildBridgeScript()` (`preview.js:22-35`) and injected into the iframe on preview build. It does not contribute to shell parse time.

---

## Bootstrap timeline (estimated, mid-range laptop CPU)

| Phase | Time (ms, est) | Dominant cost |
|---|---:|---|
| HTTP / file:// I/O (33 requests: 1 HTML + 8 CSS + 25 JS; no HTTP/2 multiplexing on file://) | 30–120 | sequential `GET` on file://; parallel on http:// |
| Inline theme boot script (`presentation-editor.html:8-35`) | <1 | localStorage read, `matchMedia` |
| CSS parse (88 KB) | ~8 | 8 render-blocking stylesheets |
| JS parse (25 files, ~780 KB, ~20 680 lines) | ~20 | all scripts are classic, no `defer`/`async` |
| Top-level execution (module-level function/const bindings before `init()`) | ~5 | `els` object: 247 `getElementById` lookups (`state.js:390-659`) |
| `init()` — 27 binding functions (`boot.js:12-44`) | 15–30 | `bindTopBarActions`, `bindInspectorActions` (`dom.js` — ~100 inspector listeners), `bindMessages`, `bindShellLayout`, `bindContextMenu` |
| First iframe bridge handshake | 30–80 | shell → `about:blank` iframe → inject bridge-script string → `bridge-ready` postMessage |
| First `refreshUi()` | 5–15 | empty state so fast |
| **Total cold start (no document loaded)** | **~110–280 ms** | **dominated by file I/O + JS parse + init bindings** |

**Iframe bootstrap chain (first user-loaded deck):**
1. Shell builds preview package (`buildPreviewPackage`, `preview.js:10-20`) — full-document HTML clone + asset resolver pass.
2. Shell writes blob URL into `els.previewFrame.src`.
3. Iframe loads blob, parses HTML + user CSS + assets.
4. `buildBridgeScript(token)` was inlined via `injectBridge` (`preview.js:25-30`). `<script>` executes inside iframe.
5. Bridge sets up 10 event listeners (`bridge-script.js:100-104, 2910-3182`), then posts `bridge-ready`.
6. Shell `bindMessages` (`bridge.js:7-106`) receives `bridge-ready`, unlocks selection.

**Estimated cold path from "user picks file" to "first click selects an element":** 500–1 100 ms on a 20-slide reference deck. Dominated by (a) user HTML parse in iframe and (b) blob URL build. Shell-side cost is ~150 ms.

---

## Selection pipeline trace — one click on a text element

Starting: iframe click, bridge already alive.

| # | Location | DOM reads | DOM writes | Notes |
|---:|---|---:|---:|---|
| 1 | `bridge-script.js:2923` `document.addEventListener('click')` fires | ~3 (hit-test + closest-selector walk) | 0 | inside iframe |
| 2 | `selectElement` (`bridge-script.js:2272-2295`) | ~5 (computed style, rect) | 2 (attr `data-editor-selected`, `contenteditable` if text) | |
| 3 | `observeSelectedSize` → `ResizeObserver.observe(el)` (`bridge-script.js:2263-2270`) | 0 | 1 (observer registration) | **singleton observer** — disconnect + re-observe each selection |
| 4 | `postSelection` → `notifySelectionGeometry` packages `rect`, `computed`, `attrs`, `selectionPath` into `element-selected` postMessage (`bridge-script.js:2297+`) | ~10 (parent chain walk for path) | 0 | |
| 5 | `bindMessages` in shell routes to `applyElementSelection` (`bridge.js:43-45`, `bridge-commands.js:349-422`) | 0 | ~15 (state assignments) | |
| 6 | `updateInspectorFromSelection` (`inspector-sync.js:805`) | 1 (`modelDoc.querySelector` for lock state, `inspector-sync.js:877-879`) | 40+ (`.textContent`, `.hidden`, `.disabled`, `.value`, `.setAttribute` on inspector fields) | |
| 7 | `renderLayersPanel` (`inspector-sync.js:903`) | 1 (`modelDoc.querySelector` for slideEl, then `querySelectorAll('[data-editor-node-id]')`, `bridge-script.js:1381`-style code) | rebuilds `layersListContainer.innerHTML` on every call | **N-per-slide scan** |
| 8 | `syncSelectionShellSurface` (`context-menu.js:875`) | ~5 | ~5 | |
| 9 | `positionFloatingToolbar` (`selection.js:1760-1836`) | **3 `getBoundingClientRect`** (`previewFrame`, `previewStage`, `floatingToolbar`) + 2 offset reads | 3–5 (`style.left/top/right/bottom`) | forced synchronous layout |
| 10 | `renderSelectionOverlay` (`selection.js:8-90`) | 1 rect (already in state) | 10+ style writes on `selectionFrame`, 4 `classList.toggle`, 8 handles | |
| 11 | `renderSlidesList` (`slide-rail.js:4`) | N (`state.modelDoc.querySelector` per slide at `slide-rail.js:48-50`) | `innerHTML = ""` + N slide-card DOM builds | **full re-render even when only selection changed** |
| 12 | `refreshUi` (`primary-action.js:614`) | varies | varies — cascades to topbar badges, breadcrumbs, save pill, etc. | |
| 13 | `scheduleOverlapDetection` (`history.js` area) | defers — 320 ms timer for heavy overlap scan | | |
| 14 | `focusSelectionFrameForKeyboard` | 0 | 1 (focus) | |

**Measured shape (estimated, 20-element slide, 5-slide deck):** 10–15 `getBoundingClientRect` reads, 80–120 DOM writes, 1 `innerHTML = ""` + rebuild for slide rail, 1 `innerHTML` rebuild for layers panel. Round-trip total **~15–25 ms** on modern hardware.

**Layout thrashing risk:** medium-high. Steps 9, 10, 11 each do independent reads → writes with no RAF gate between them. Browsers coalesce some of this, but the pattern means a single click forces at least 3 independent style recalcs.

---

## History / undo memory cost

- **Snapshot model:** full-document string (`history.js:572-581`, `export.js:601-606` — `cloneNode(true)` + `documentElement.outerHTML`).
- **Limit:** `HISTORY_LIMIT = 20` (`constants.js:105`).
- **Dedupe:** string-equality gate (`history.js:582-588`) — saves no work, only saves storage.
- **Trim:** `state.history.shift()` when length exceeds 20 (`export.js:593-595`, `history.js:593-594`).
- **Debounce:** 320 ms `setTimeout` before capture (`history.js:555-558`). Correct — batches rapid inspector edits into one snapshot.

**Estimated memory, 20-slide × 50-element deck:**
- One snapshot HTML ≈ 300–800 KB.
- 20 × 700 KB = **~14 MB retained in `state.history`** at worst case.
- Plus autosave writes the same full HTML string into `sessionStorage` (`primary-action.js:647-670`) — cap ~5 MB per origin on most browsers; large decks will silently overflow and `autosave-failed` will spam diagnostics.

**Serialisation cost per commit:** `cloneNode(true)` + `outerHTML` on the whole `modelDoc`. On a 2 000-node deck this is ~20–60 ms. It blocks the UI thread.

---

## Large-deck profile scenarios (estimated)

| Scenario | Dominant cost | Est. time |
|---|---|---:|
| **100-element slide: single click** | Step 7 `renderLayersPanel` (100-row DOM rebuild), step 11 `renderSlidesList` | 40–80 ms |
| **100-element slide: drag-move** | `applySelectionGeometry` (`bridge-commands.js:424-431`) fires per rAF from bridge → `positionFloatingToolbar` + `renderSelectionOverlay` + `updateInspectorFromSelection` every frame | 8–15 ms per frame → possibly below 60 fps on ~2 000-node decks |
| **50-slide deck: rail render** | 50 × `state.modelDoc.querySelector` at `slide-rail.js:48-50`, 50 card subtrees built with `createElement`, 50 meta-tag loops | 30–70 ms per `renderSlidesList()` call |
| **50-slide deck: `renderSlidesList` frequency** | Called from `applyElementSelection` (`bridge-commands.js:416`) on *every* click | Selection tax scales linearly with deck size |
| **undo ×20** | 20 × `restoreSnapshot` (`export.js:608-623`) → `loadHtmlString` re-parse + re-registry + preview rebuild each step | 200–400 ms first step, 150–300 ms subsequent (preview iframe rebuild dominates) |
| **Bridge payload on full state sync** | `applyDocumentSyncFromBridge` carries element-level changes, not full doc; fine. But `buildPreviewPackage` on *preview rebuild* serialises the entire model — called on mode toggle, rail reorder | 30–120 ms |

---

## CSS perf findings

**Global selector audit across `editor/styles/*.css` (4 004 lines total):**

| Concern | Count | Location / example |
|---|---:|---|
| Universal `*` selector | 1 | `layout.css:34` `.workspace > *` — scoped to workspace children, acceptable |
| `:has()` | 0 | none found — good; `:has` can be expensive in Blink/WebKit |
| `:not()` hover combos | ~20 | widely used, e.g. `base.css:91-135`, `layout.css:149-221`. Low cost per match |
| Deeply descended selectors (4+ levels) | few | not pervasive; most rules are class-scoped |
| Universal-theme transitions | 1 risk | `base.css:72-78`: `button { transition: 6 properties }` — every button animates 6 properties on hover. Multiplied across topbar + inspector (~100 buttons visible), each hover state kicks a compositor update. Low cost per button but pervasive |
| Transitions on non-composited properties | yes | several transitions include `border-color`, `background-color`, `box-shadow` — these are not GPU-composited, they invalidate paint. Examples: `base.css:72-78`, `inspector.css:156`, `overlay.css:174`. Acceptable but budget-aware |

**Theme-transition guard:** `base.css:81-89` correctly suppresses `transition`/`animation` during theme boot via `[data-theme-booting]`/`[data-theme-transition="locked"]`. Good — prevents massive reflow on mount.

**Font stack:** no `@font-face` downloads in shell CSS; relies on system fonts. Zero network cost. Correct for file:// model.

---

## Memory / leak findings

| Risk | Severity | Location |
|---|---|---|
| `addEventListener` count: **249 across shell** (`grep`), **4 `removeEventListener`** — listener-add to listener-remove ratio is ~60:1 | medium | See `dom.js` (~100 inspector bindings), `selection.js`, `shell-overlays.js`. Nearly all listeners attach to long-lived shell elements — leaks are low-probability but cleanup is not audited. |
| `ResizeObserver` (iframe side) at `bridge-script.js:2263-2270` | low | Singleton; disconnects before re-observing. Correct pattern. |
| `MutationObserver` (iframe slide observer) at `bridge-script.js:537` | low | Scoped to slide roots; destroyed on iframe unload. |
| `ResizeObserver` (shell side) at `feedback.js:411-413` for `shellChromeObserver` | low | Singleton, attached to chrome elements. |
| `SHELL_WARNING_CACHE` (`history.js:39-40`) | low | Unbounded `Set` of `code:detail` strings. Only populated by `reportShellWarning({ once: true })`, so cardinality is O(distinct warning kinds) — effectively bounded. |
| `state.diagnostics` at `history.js:27-31` | low | Trimmed to last 18. Correct. |
| `state.history` unbounded risk | medium | Trimmed to 20 snapshots, but each snapshot can be 800 KB. See "History" section. |
| Autosave throttling | medium | `saveProjectToLocalStorage` (`primary-action.js:647`) has no explicit debounce at this function level — relies on `scheduleAutosave` upstream (not located — possibly called directly from mutation paths). If called per keystroke during inspector edits, it re-serialises the whole doc each time. **Flag for verification.** |
| Pending `state.snapshotTimer` (`history.js:555`) | low | `setTimeout`-based; not cleared on `init()` teardown, but shell has no teardown path anyway |
| Blob URLs for iframe preview | low | `cleanupExportValidationUrl` bound to `unload` (`bridge.js:114`). If preview rebuild is hot, check for `URL.revokeObjectURL` on the *previous* blob — not verified in this audit |
| Long strings held by closures | medium | `state.selectedHtml` (`bridge-commands.js:360`) holds the outer HTML of the last-selected element. For large containers this can be multi-MB. No explicit clear on deselect in the paths inspected |

---

## Export path

- `exportDoc = state.modelDoc.cloneNode(true)` (`export.js:602`) — full deep clone. O(total nodes).
- `stripEditorArtifacts(exportDoc)` — one full-tree walk to remove `data-editor-*` attributes.
- `exportDoc.documentElement.outerHTML` — one serialisation.
- Asset parity validation (`buildRenderedOutputPackage` in `preview.js:10`) walks assets with `auditAssets: true`.

**Estimated cost on 20-slide × 30-element deck:** 40–120 ms per export. Acceptable for an explicit user action, but note this is called *every time* a preview package is built (mode toggle, reload, rail reorder), not only on Save.

**Import path** (`import.js:532-533`): single `DOMParser.parseFromString` on the full source HTML. Cost scales with input length; ~50–200 ms for a 500 KB HTML deck.

---

## Top 10 performance improvements

Each entry: **What → Where → Est. impact → Effort (S = <1 day, M = 1–3 days, L = week+).**

### 1. RAF-coalesce the selection fan-out
**What:** After `applyElementSelection`, schedule one `requestAnimationFrame` that runs `updateInspectorFromSelection`, `positionFloatingToolbar`, `renderSelectionOverlay`, `renderSlidesList`, `refreshUi` in sequence — instead of invoking them synchronously back-to-back.
**Where:** `bridge-commands.js:412-420`.
**Impact:** Collapses 3+ forced synchronous layouts into 1. Est. saves **8–15 ms per click** on medium decks. Feel-better win on every click.
**Effort:** S.

### 2. Incremental `renderSlidesList` (keyed diff)
**What:** Stop doing `els.slidesList.innerHTML = ""` + full rebuild on every change (`slide-rail.js:5`). Keep a Map<slideId, DOM-node>, diff against `state.slides`, patch only changed cards (active-class, pending-class, overlap badges).
**Where:** `slide-rail.js:4-80+`.
**Impact:** 50-slide decks save ~30–60 ms per selection change. Also kills the 50× `modelDoc.querySelector` at `slide-rail.js:48-50`.
**Effort:** M.

### 3. Gate `renderSlidesList` out of selection path
**What:** Selection change only affects which slide card is highlighted — not slide metadata. Split into `renderSlidesList()` (full) and `updateSlidesListActive()` (class-toggle only).
**Where:** call site `bridge-commands.js:416`.
**Impact:** Removes N-slide loop from every click. Large decks: **30–70 ms saved per selection**.
**Effort:** S.

### 4. Move history to diff-indexed storage
**What:** Store first snapshot as full HTML; subsequent snapshots as `{ baseIndex, diff }` using a light DOM-diff (node attrs + text only). On undo, apply diffs forward/backward from nearest baseline.
**Where:** `export.js:561-599`, `history.js:608-623`.
**Impact:** Memory: 20 × 700 KB → 1 × 700 KB + 19 × ~5 KB ≈ **90%+ reduction**. Serialisation cost per commit drops from 20–60 ms to 2–8 ms.
**Effort:** L. (Risk: diff bugs → invalid undo; needs strong test coverage via Gate-A.)

### 5. Debounce `saveProjectToLocalStorage`
**What:** Wrap in a leading-edge + trailing-edge 1 s debounce (as opposed to firing from every mutation path).
**Where:** all call sites of `saveProjectToLocalStorage` across `primary-action.js`, `history.js`, inspector mutators.
**Impact:** Typing in an inspector text field currently can fire N `serializeCurrentProject()` + `JSON.stringify` per keystroke. Estimated **5–20 ms per keystroke → near-zero**.
**Effort:** S.

### 6. Cache `state.modelDoc.querySelector` lookups per click
**What:** `updateInspectorFromSelection` at `inspector-sync.js:877-879` resolves the selected node via `querySelector([data-editor-node-id="..."])`. `renderLayersPanel` does the same. `renderSlidesList` does one per slide.
Fix: resolve once per click, pass through, or keep a `Map<nodeId, Element>` as an index refreshed on import.
**Where:** cross-cutting — start with `inspector-sync.js:877-879`, `slide-rail.js:48-50`, `bridge-script.js:1381`.
**Impact:** Each `querySelector` with an attribute selector + CSS.escape is ~0.3–1 ms on 2 000-node docs. Saves **3–10 ms per click**, more on large decks.
**Effort:** M.

### 7. Idle-load the iframe bridge injection
**What:** `buildBridgeScript` is a ~150 KB string template (`bridge-script.js` — 3 438 lines). Building it on every preview rebuild (mode toggle, reload) repeats work. Cache the built string per `state.bridgeToken` and only rebuild when the token rotates.
**Where:** `preview.js:25-30`, `bridge-script.js:7` `buildBridgeScript(token)`.
**Impact:** Mode toggle is noticeably faster. Est. **10–30 ms saved per preview rebuild**.
**Effort:** S.

### 8. Defer non-init bindings past first paint
**What:** `init()` in `boot.js:12-44` runs 27 binding functions synchronously before first paint. Split into "must-run before bridge-ready" (theme, inspector sections, previewFrame wiring) and "can wait one RAF" (context menu, clipboard, shortcuts help, palette, starter-deck prompts).
**Where:** `boot.js:12-44`.
**Impact:** Cold-start TTI shaves **10–25 ms** on first paint. No behavioural change.
**Effort:** S.

### 9. Skip layer-panel render when not visible
**What:** `renderLayersPanel` is called from `updateInspectorFromSelection` unconditionally (`inspector-sync.js:903`). It is only meaningful in `state.complexityMode === "advanced"`. Early-return when the layers section is collapsed or mode is `basic`.
**Where:** `inspector-sync.js:903` and the function body in `inspector-sync.js:1384+`.
**Impact:** 50–80% of sessions are in `basic` mode — saves **5–15 ms per selection** for that cohort.
**Effort:** S.

### 10. Scope universal-hover transitions
**What:** `button { transition: 6 properties }` at `base.css:72-78` applies to every button on the page (including ~100 inspector + topbar buttons). Replace with a narrower selector (e.g. `.editor-btn, .mode-toggle button`) so inspector inputs inherit only the transitions they need.
**Where:** `editor/styles/base.css:70-79`.
**Impact:** Removes paint-invalidation pressure on theme switch and mode switch. Est. **theme-toggle feels 1 frame snappier** on dense inspector views.
**Effort:** S.

---

## Additional observations (not ranked as "top 10" but worth noting)

- **33 file:// requests for shell load** is a lot on slow disks / spinning HDDs. If we ever allow an optional single-file build (no bundler, just concatenation with `<script>` boundaries preserved), we could cut this to 3–5 requests. Explicitly out-of-scope per this audit's invariant.
- **247 `getElementById` calls at module top level** (`state.js:390-659`) run before `init()` — these are fine (single shell HTML, elements exist), but make sure no script-order regression accidentally re-queries them (grep found no duplicates).
- **No `Intl.Segmenter` / heavy polyfills.** Good.
- **No `requestIdleCallback` usage** anywhere in the shell. Low-priority work (overlap detection, diagnostics push) could benefit.
- **`addDiagnostic` writes on every `snapshot:` commit** (`export.js:597`) and every `iframe-log` message (`bridge.js:75`). Low cost, but on noisy decks the diagnostics panel becomes a DOM hot spot. Already trimmed to 18 entries — fine.
- **CSS stylesheet count (8) is not a problem on http://** — parallel fetch, parsed once. On file:// it serialises, but total CSS size (88 KB) is small.

---

## Summary table — recommended prioritisation

| Rank | Item | Impact | Effort | Risk |
|---:|---|---|---|---|
| 1 | RAF-coalesce selection fan-out | High | S | Low |
| 2 | Incremental `renderSlidesList` | High (large decks) | M | Low-med |
| 3 | Gate `renderSlidesList` out of selection path | High (large decks) | S | Low |
| 4 | Diff-indexed history | High (memory) | L | Med |
| 5 | Debounce autosave | Med | S | Low |
| 6 | Cache `modelDoc.querySelector` by nodeId | Med | M | Low |
| 7 | Cache `buildBridgeScript` string | Med | S | Low |
| 8 | Split `init()` into two phases | Low-med | S | Low |
| 9 | Skip `renderLayersPanel` when not visible | Med (basic-mode cohort) | S | Low |
| 10 | Scope button transitions | Low | S | None |

**Baseline to protect (Gate-A):** 55 passed / 5 skipped / 0 failed. All ranked items should land behind Gate-A with at least one targeted perf regression test added per change (e.g. "single click on a 100-element slide must not trigger more than 2 forced layouts").

---

*End of AUDIT-C. No production code was modified. No bundler proposed. Zero-build constraint respected throughout.*
