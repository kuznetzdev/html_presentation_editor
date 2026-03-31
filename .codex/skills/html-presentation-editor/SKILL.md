---
name: html-presentation-editor
description: Project-local skill for kuznetzdev/html_presentation_editor. Use before any work on the editor runtime, shell UI, bridge/modelDoc synchronization, slide model, direct manipulation, export/assets, and Playwright regression coverage around `editor/presentation-editor-v12.html`.
risk: medium
source: project
version: "1.1"
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

## Product identity

This product is a visual editor for existing HTML slide decks.

It is not:

- a generic page builder
- a CMS
- a low-code site builder

The product promise is:

`Open -> select -> edit -> save`

## UX doctrine

The default user must not need to understand HTML.

### Basic mode

Basic mode should feel like a standard presentation tool:

- obvious controls
- low noise
- safe defaults
- simple slide operations
- clear recovery paths

### Advanced mode

Advanced mode may expose deeper control:

- HTML editing
- id/class/dataset
- diagnostics
- precise geometry
- structural edits

Do not leak advanced complexity into the basic path.

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

## Validation rules

For runtime changes, prefer targeted Playwright proof first, then broader suite
validation.

Useful commands:

```bash
npm test
npm run test:asset-parity
```

For stage-specific work, use focused Playwright grep runs before the full suite.

## Success criteria

A correct change for this project makes the editor:

- easier for a non-HTML user
- safer under real deck conditions
- more truthful in preview/export behavior
- simpler in the basic path
- still powerful in advanced mode without contaminating the default UX
