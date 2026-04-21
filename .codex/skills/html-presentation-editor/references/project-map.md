# HTML Presentation Editor Project Map

This reference exists to keep the skill grounded in the real repository instead of generic editor assumptions.

## Product Definition

- Main repo root: `C:\Users\Kuznetz\Desktop\proga\html_presentation_editor`
- Live editor runtime: `editor/presentation-editor.html`
- Package entrypoint: `package.json`

The product is a local visual editor for existing HTML slide decks.

## Strategic Product Goal

The strategic goal is to make the editor maximally convenient, interactive, and intuitively understandable for editing HTML presentations.

The intended core loop is:

- open
- select
- change
- save/export

The product should feel modern, stable, and obvious even to a weak user, not like a fragile developer tool.

## UI Doctrine

The preferred UI character is:

- simple
- minimalistic
- laconic
- modern
- calm

Practical consequences:

- the canvas and slide content stay visually primary
- shell chrome stays restrained
- common actions must be immediately discoverable
- advanced controls must exist without overwhelming the basic path
- visual polish must reduce friction, not add spectacle

It must preserve:

- no dead ends
- predictable UX
- truthful iframe preview
- parent shell outside content
- clean export with no editor artifacts
- deterministic slide and selection flows
- recoverability through undo/redo/autosave
- mandatory Basic / Advanced modes

It must also preserve synchronization quality:

- shell, iframe, bridge, and `modelDoc` converge to the same truth
- active slide state is deterministic
- selection state is deterministic
- export package and truthful preview stay aligned
- diagnostics report degraded paths honestly

## Source of Truth Ladder

When sources disagree, resolve them in this order:

1. `docs/SOURCE_OF_TRUTH.md`
2. `docs/PROJECT_SUMMARY.md`
3. `docs/ROADMAP_NEXT.md`
4. targeted existing tests
5. current implementation in `editor/presentation-editor.html`

This matters because the implementation is still a large single file and may contain temporary structure debt. Code reflects current behavior; docs define intended truth.

## Canonical Documents

Read these before deep code changes:

- `docs/SOURCE_OF_TRUTH.md`
- `docs/PROJECT_SUMMARY.md`
- `docs/ROADMAP_NEXT.md`
- `docs/README_REPO_STRUCTURE.md`

Optional, task-driven documents:

- `docs/REMAINING_ISSUES.md`
- `docs/CODEX_HANDOFF_PROMPTS.md`
- `docs/CHANGELOG.md`
- `docs/history/*`

## Runtime Architecture

Fixed architecture:

- parent shell
- iframe preview
- bridge
- `modelDoc`

Responsibility split:

- shell: commands, panels, history, autosave, export, diagnostics
- iframe: truthful runtime DOM and presentation scripts
- bridge: sync and command transport
- `modelDoc`: canonical document and export source

Synchronization rule:

- `modelDoc` is canonical for exportable document truth
- iframe is canonical for truthful runtime rendering
- bridge is the only sanctioned transport between shell and iframe
- shell may present state, but must not invent contradictory truth

Non-negotiable architectural prohibitions:

- do not break `parent shell + iframe + bridge + modelDoc`
- do not turn the product into a generic page builder
- do not pollute presentation DOM with shell ownership
- do not accept dirty export output
- do not solve structural debt with new override piles
- do not paper over shell theme bugs with delayed after-paint overrides
- do not stack multiple visual layers for one segmented-control state
- do not tolerate race-prone state transitions without proof

## Current Release Gates

Known signed-off areas from current docs:

- truthful iframe preview and bridge bootstrap
- deterministic slide activation flow
- clean export path
- autosave restore path
- compact drawer close/inertness proof
- supported direct manipulation envelope for safe positioned contexts

Known weak spots:

- transformed/zoom-heavy direct manipulation remains intentionally conservative
- asset fidelity is proven for connected-directory flow, not every remote/manual-base case
- single-file maintenance cost remains high

Current roadmap:

- `0.13.7`: internal zoning without architecture rewrite
- `0.14.0`: visual/system polish after correctness

Decision priority:

1. reliability and truthful behavior
2. intuitive editing flow
3. structural cleanup
4. visual polish

Within UI decisions:

1. clarity
2. simplicity
3. consistency
4. density only where justified

## Validation Map

Primary commands:

```powershell
npm test
npx playwright test tests/playwright/specs/editor.regression.spec.js --project=chromium
npx playwright test tests/playwright/specs/asset-parity.spec.js --project=chromium
npx playwright test tests/playwright/specs/shell.smoke.spec.js
npx playwright test tests/playwright/specs/visual.spec.js --project=chromium
npm run test:asset-parity
```

Helpers and fixtures:

- `tests/playwright/helpers/editorApp.js`
- `tests/fixtures/playwright/basic-deck.html`
- `tests/fixtures/export-asset-parity/asset-parity-case.html`
- `scripts/validate-export-asset-parity.js`

## Task-to-Test Routing

- shell layout / responsive regressions:
  - `tests/playwright/specs/shell.smoke.spec.js`
- slide creation/duplication/deletion, inspector flows, autosave, manipulation:
  - `tests/playwright/specs/editor.regression.spec.js`
- export cleanliness and asset parity:
  - `tests/playwright/specs/asset-parity.spec.js`
  - `scripts/validate-export-asset-parity.js`
- screenshot/baseline drift:
  - `tests/playwright/specs/visual.spec.js`

## Editing Heuristics

When touching `presentation-editor.html`:

- locate the responsible zone first
- keep refactors contiguous
- avoid duplicated state controllers
- add tests before behavior fixes
- do not weaken architecture invariants for short-term convenience
- for theme work, prefer `:root/html[data-theme]` prepaint ownership over
  component-local dark selectors
- for shell chrome, keep context menu, floating toolbar, and drawer routing
  mutually exclusive

## JS Module Inventory (editor/src/)

32 modules total (as of v0.29.5):

- `banners.js` — Banner registry: unified API for shell-level banners scaffold (v0.29.5 WO-23; PAIN-MAP P2-09; ~97 LOC)
- `boot.js` — Bootstrap: init sequence, complexity mode, selection mode, slide templates, binding functions (~1551 LOC; theme/zoom/shell-layout extracted WO-22)
- `bridge-commands.js` — Bridge command handlers (shell side)
- `bridge-schema.js` — Per-message schema validators
- `bridge-script.js` — Bridge script injected into iframe
- `bridge.js` — Bridge bootstrap and transport
- `constants.js` — Shared constants (entity kinds, keys, limits)
- `context-menu.js` — Context menu rendering and actions
- `dom.js` — DOM utilities and direct manipulation
- `export.js` — HTML/PPTX export
- `feedback.js` — Toast, diagnostics, telemetry UI binding (surface mutex moved to surface-manager.js WO-23; ~1237 LOC)
- `floating-toolbar.js` — Floating toolbar position/drag/collapse (v0.29.3)
- `history.js` — Undo/redo, patch-based snapshots
- `inspector-sync.js` — Inspector panel sync and rendering
- `layers-panel.js` — Advanced-mode layers panel: render + drag-drop + lock/visibility + grouping
- `main.js` — Entry point — calls init() (3 LOC; P1-08 closed v0.29.4)
- `primary-action.js` — Primary action button and history budget chip
- `selection.js` — Selection overlay, direct manipulation (drag/resize), selection state
- `shell-layout.js` — Responsive shell: compact-shell detection, panel open/close, roving focus (WO-22, ~206 LOC)
- `shell-overlays.js` — Shell overlay elements (breadcrumb, context-menu layer picker)
- `slide-rail.js` — Slide rail rendering and navigation
- `state.js` — Shared mutable state, store slices
- `store.js` — Observable store (window.store)
- `telemetry.js` — Opt-in local telemetry scaffold
- `theme.js` — Theme preference (light/dark/system), FOUC-safe applyResolvedTheme (WO-22, ~153 LOC)
- `toolbar.js` — Inspector-init helpers (initInspectorSections, addInspectorHelpBadges, slugify)
- `surface-manager.js` — Transient surface mutex: normalizeShellSurfaceKeep + closeTransientShellUi (v0.29.5 WO-23; PAIN-MAP P2-09; ~37 LOC)
- `zoom.js` — CSS-zoom preview scale, clamp 0.25–2.0, persist localStorage (WO-22, ~89 LOC)
