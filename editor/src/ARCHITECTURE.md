# editor/src — Module Architecture

> **v0.23.0** — 25 focused JS modules, loaded as classic `<script src>` tags.
> Classic scripts (not ES modules) preserve `file://` compatibility in Chrome.
> All modules share one global scope; `state` and `els` are the two key singletons.

---

## Layer Model

```
Layer 7 – Bootstrap      shortcuts.js · boot.js · main.js
Layer 6 – View / Shell   onboarding · slide-rail · feedback · toolbar
                         context-menu · inspector-sync · shell-overlays
                         primary-action
Layer 5 – Rendering      preview.js · style-app.js · export.js
Layer 4 – Bridge         bridge.js · bridge-script.js · bridge-commands.js
Layer 3 – Domain         clipboard · import · slides · history · selection
Layer 2 – DOM Cache      dom.js
Layer 1 – Data           constants.js · state.js
```

A module may read from layers ≤ its own, never from layers above it.

---

## Load Order & Module Reference

Modules load top-to-bottom exactly as listed in `presentation-editor.html`.

| # | File | Lines | Layer | Responsibility |
|---|------|------:|-------|----------------|
| 1 | `constants.js` | 177 | 1 – Data | Storage keys, tag sets, selector strings, frozen config maps. No logic. |
| 2 | `state.js` | 665 | 1 – Data | `SelectionPolicy` factory, `PreviewLifecycle` helper, `state` singleton. All mutable app state lives here. |
| 3 | `onboarding.js` | 162 | 6 – View | Empty-shell onboarding banner: show/hide logic, first-launch detection. |
| 4 | `dom.js` | 364 | 2 – DOM Cache | Builds `els` — one `document.getElementById` call per shell element. `cacheEls()` must run before any listener is registered. |
| 5 | `bridge.js` | 132 | 4 – Bridge | Low-level postMessage helpers: `sendToBridge()`, `receiveBridgeMessage()`. Only thin I/O — no state mutations. |
| 6 | `shortcuts.js` | 219 | 7 – Bootstrap | `bindShortcuts()` — keyboard handler registered once at startup. |
| 7 | `clipboard.js` | 117 | 3 – Domain | Element clipboard: `copySelectedElement()`, `cutSelectedElement()`, `pasteSelectedElement()`. Uses `state.copiedElementHtml`. |
| 8 | `import.js` | 774 | 3 – Domain | HTML import pipeline: file-reader, paste-HTML, base-URL injection, `loadHtmlString()`, `serializeCurrentProject()`. |
| 9 | `slides.js` | 492 | 3 – Domain | Slide registry: `buildSlideInventory()`, CRUD helpers (add/remove/duplicate slide), `activateSlide()`. |
| 10 | `bridge-script.js` | 3 424 | 4 – Bridge | **Self-contained iframe mini-app.** `buildBridgeScript(token)` returns the JS string injected into the preview iframe. Never mix shell logic here. |
| 11 | `preview.js` | 34 | 5 – Rendering | Preview orchestration core: `buildPreviewPackage()`, `injectBridge()`. Tiny on purpose — implementation lives in layers 4 & 3. |
| 12 | `bridge-commands.js` | 832 | 4 – Bridge | Handles `postMessage` commands from the iframe: `applySelectionFromBridge()`, element-update handlers, slide-activation dispatch. |
| 13 | `slide-rail.js` | 483 | 6 – View | Left-panel slide thumbnails: render loop, reorder drag, thumbnail context-menu trigger. |
| 14 | `style-app.js` | 289 | 5 – Rendering | Applies CSS property changes (color, font, opacity, border-radius …) to the selected element via bridge commands. |
| 15 | `export.js` | 625 | 5 – Rendering | HTML export (`exportCleanHtml()`), PPTX export via PptxGenJS CDN, Presentation-mode blob window. |
| 16 | `history.js` | 825 | 3 – Domain | Undo/redo stack: `pushHistory()`, `undoHistory()`, `redoHistory()`. Snapshot-based; keyed on `state.modelDoc` serialization. |
| 17 | `feedback.js` | 924 | 6 – View | Toast notifications, diagnostics box, save-state pill, lifecycle pill. All ephemeral UI feedback. |
| 18 | `selection.js` | 1 842 | 3 – Domain | Selection overlay and direct manipulation engine: overlay rendering, drag, resize, rotation, hit-testing, `SelectionPolicy`. |
| 19 | `toolbar.js` | 152 | 6 – View | Floating rich-text toolbar: show/hide, bold/italic/underline/align button wiring. |
| 20 | `context-menu.js` | 904 | 6 – View | Right-click context menu: build menu items, position, show/hide, action dispatch. |
| 21 | `inspector-sync.js` | 1 390 | 6 – View | Right-panel inspector: `updateInspectorFromSelection()` — reads `state` and syncs all inspector inputs. No mutations. |
| 22 | `shell-overlays.js` | 818 | 6 – View | Modal management, insert palette, topbar-overflow menu, layer picker, `setMode()`. All shell-owned overlay surfaces. |
| 23 | `boot.js` | 1 962 | 7 – Bootstrap | `init()` entry point called by `main.js`. Wires all `bind*()` functions, applies stored theme, sets initial mode. |
| 24 | `primary-action.js` | 670 | 6 – View | Primary action bar sync: `syncPrimaryActionUi()` — keeps topbar CTAs consistent with `state.mode` and selection. |
| 25 | `main.js` | 12 | 7 – Bootstrap | **Entry point.** Called last. Appends the slide-template bar then calls `init()`. |

---

## Key Singletons (global scope)

| Name | Defined in | Purpose |
|------|-----------|---------|
| `state` | `state.js` | Single mutable app state object |
| `els` | `dom.js` | Cache of all shell DOM element references |

---

## CSS Architecture

```
editor/styles/           (8 @layer files, loaded via <link> before scripts)
├── tokens.css           @layer tokens   — design tokens (spacing, color, type scale)
├── base.css             @layer base     — reset, button primitives, font-smoothing
├── layout.css           @layer layout   — topbar, left/right panels, main grid
├── preview.css          @layer preview  — stage, preview shell, slide rail
├── inspector.css        @layer inspector — right panel forms, focus rings
├── overlay.css          @layer overlay  — floating toolbar, context menu, toasts
├── modal.css            @layer modal    — modals, compact drawers
└── responsive.css       @layer responsive — breakpoint overrides
```

---

## Iframe Bridge Pattern

```
Shell (parent window)                  Preview iframe
──────────────────────                 ─────────────────────
bridge-script.js ──buildBridgeScript──▶  injected mini-app
bridge.js ────────────postMessage──────▶  command handlers
bridge-commands.js ◀───postMessage─────  select / update / etc.
```

The iframe never accesses shell globals. All communication is via `postMessage` with a shared secret token generated per-load.

---

## Adding a New Module

1. Create `editor/src/<name>.js` with a `// Layer: …` header comment
2. Add `<script src="src/<name>.js"></script>` in `presentation-editor.html` **after** all layers it depends on
3. Export no `module.exports` — use plain functions in global scope
4. Test with `npm run test:gate-a` (must stay 55 passed / 5 skipped / 0 failed)
