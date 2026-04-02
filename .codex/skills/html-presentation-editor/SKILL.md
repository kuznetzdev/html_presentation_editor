---
name: html-presentation-editor
description: Project-local skill for kuznetzdev/html_presentation_editor. Use before any work on the editor runtime, shell UI, theme system, transient surface routing, bridge/modelDoc synchronization, slide model, direct manipulation, export/assets, and Playwright regression coverage around `editor/presentation-editor-v12.html`.
risk: medium
source: project
version: "1.3"
---

# SKILL: html-presentation-editor

## Scope

Project-local operating rules for `kuznetzdev/html_presentation_editor`.

Primary runtime file:

- `editor/presentation-editor-v12.html`

Primary documents:

1. `docs/SOURCE_OF_TRUTH.md`
2. `docs/CHANGELOG.md`
3. `docs/PROJECT_SUMMARY.md`
4. `docs/ROADMAP_NEXT.md`
5. `README.md`
6. `.codex/skills/html-presentation-editor/references/project-map.md`

## Product identity

This product is a visual editor for existing HTML slide decks.

It is not:

- a generic page builder
- a CMS
- a low-code site builder

The product promise is:

`Open -> select -> edit -> save`

Blank state is onboarding, not editing.

## UX doctrine

The default user must not need to understand HTML.

### Basic mode

Basic mode should feel like a standard presentation tool:

- obvious controls
- low noise
- safe defaults
- simple slide operations
- clear recovery paths

Basic mode must also:

- hide advanced inspector, HTML, raw attribute, and diagnostics surfaces
  entirely
- keep blank state on a single-path onboarding flow
- keep loaded preview on a compact slide-summary path
- keep loaded edit selection-first with one relevant card instead of a full
  inspector dump

### Advanced mode

Advanced mode may expose deeper control:

- HTML editing
- id/class/dataset
- diagnostics
- precise geometry
- structural edits

Do not leak advanced complexity into the basic path.

### Shell workflow contract

Shell visibility is driven by:

- `body[data-editor-workflow="empty"]`
- `body[data-editor-workflow="loaded-preview"]`
- `body[data-editor-workflow="loaded-edit"]`

Interpretation:

- `empty`: onboarding only, no editing shell
- `loaded-preview`: slide rail visible, `Edit` is the obvious next action
- `loaded-edit`: selected-element workflow is primary

## Fixed architecture

Never rewrite away from:

- parent shell
- iframe preview
- bridge
- modelDoc

The shell owns UI and workflow.
The iframe owns truthful runtime DOM.
The bridge owns synchronization.
`modelDoc` owns canonical document state.

## Hard invariants

- shell stays outside presentation content
- preview stays truthful to runtime behavior
- export stays clean
- blocked actions fail honestly with feedback
- undo, redo, and autosave remain deterministic
- reliability beats feature count when they conflict

## Current signed-off behavior

- load deck into isolated iframe preview
- runtime-confirmed slide activation
- create, duplicate, delete, undo, redo, autosave, restore
- safe direct manipulation on the signed-off geometry envelope
- blocked direct manipulation with explicit tooltip/diagnostics feedback
- desktop slide-rail drag-and-drop reorder
- unified slide action menu with compact-safe kebab access
- asset parity validation path
- full Playwright regression suite on `main`

## Before making changes

Read the current truth in this order:

1. `docs/SOURCE_OF_TRUTH.md`
2. `docs/CHANGELOG.md`
3. `docs/PROJECT_SUMMARY.md`
4. `docs/ROADMAP_NEXT.md`
5. the relevant Playwright spec/helper for the area you will touch

For slide and shell work, inspect:

- `tests/playwright/specs/editor.regression.spec.js`
- `tests/playwright/helpers/editorApp.js`

## Editing rules

- Preserve existing bridge channels unless the task explicitly requires a new one
- Prefer existing slide primitives over introducing parallel state paths
- Use `moveSlideToIndex(fromIndex, toIndex)` for structural slide reorder
- Keep compact shell interactions simpler than desktop
- Prefer explicit menu actions on compact widths over drag-heavy behavior
- Do not solve a UX problem by adding more persistent chrome
- Do not add new dependencies for small interaction fixes
- Theme state belongs on the document root first; prefer root-scoped semantic
  tokens over delayed body-only theme boot or per-component dark override piles
- Segmented controls should have one honest visual surface per state; do not
  stack nested backgrounds just to mask theme timing bugs
- Floating toolbar, context menu, insert palette, slide template bar, topbar
  overflow, and compact drawers must be routed as mutually exclusive transient
  surfaces
- If desktop/intermediate topbar commands stop fitting, solve it with
  shell-owned width metrics and a transient overflow path for secondary
  actions; do not move the compact-shell breakpoint just to hide the problem
- If the task changes novice-path shell behavior, update the focused
  Playwright helper and `tests/playwright/specs/shell.smoke.spec.js` first so
  `data-editor-workflow` and shell-surface visibility stay explicitly covered

## Validation rules

For runtime changes, prefer targeted Playwright proof first, then broader suite
validation.

Useful commands:

```bash
npm test
npm run test:asset-parity
npx playwright test tests/playwright/specs/shell.smoke.spec.js --project=chromium-desktop --grep "@stage-f|@stage-e|@stage-d"
npx playwright test tests/playwright/specs/editor.regression.spec.js --project=chromium-desktop --grep "@stage-f|@stage-e|@stage-d"
```

For stage-specific work, use focused Playwright grep runs before the full suite.

## Success criteria

A correct change for this project makes the editor:

- easier for a non-HTML user
- safer under real deck conditions
- more truthful in preview/export behavior
- simpler in the basic path
- more explicit in the novice empty -> preview -> edit workflow
- still powerful in advanced mode without contaminating the default UX
