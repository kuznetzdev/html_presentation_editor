# PROJECT SUMMARY

## Current version

See `package.json` for current release version.

Active runtime entrypoint:

- `editor/presentation-editor-v0.19.1.html`

Compatibility-only entrypoint:

- `editor/presentation-editor.html` -> redirect shim to the active semver runtime

## Product state

HTML Presentation Editor remains a shell-driven editor for existing HTML slide
decks.

The fixed architecture is unchanged:

- parent shell for UI, history, autosave, export, and diagnostics
- iframe preview for truthful runtime DOM
- bridge for parent-to-iframe commands and runtime sync
- `modelDoc` as the canonical exportable document model

## Product direction

- Basic mode must be usable without understanding HTML
- Blank state must act as onboarding, not as a disabled editing shell
- Loaded preview must expose one obvious path into editing
- Advanced mode may expose HTML, structure, diagnostics, and precise controls
- The editor should feel like a reliable presentation tool first
- Reliability and clarity beat feature count when they conflict

## What is working now

- load a full HTML deck from text into isolated iframe preview
- switch between Preview and Edit without rebuilding the core architecture
- keep generic slide activation and runtime-confirmed active slide sync
- gate shell chrome through `body[data-editor-workflow="empty|loaded-preview|loaded-edit"]`
- keep the blank state on a single-path onboarding card with `Open HTML` as the
  primary CTA and `Paste HTML` as the secondary path
- auto-activate the first slide after load so preview lands on a real editing
  context immediately
- keep the slide rail as the main navigation surface after load instead of
  showing an empty editor shell first
- make basic preview a compact slide-summary path and basic edit a
  selection-first path instead of exposing the full inspector by default
- keep preview on a summary-first novice path with a visible
  `Начать редактирование` CTA instead of making the mode toggle do all of the
  guidance work
- show selected-element and slide summary cards in the novice path while
  keeping raw tag/node detail out of basic mode
- hide advanced inspector, HTML, raw attribute, and diagnostics surfaces
  entirely in basic mode instead of merely disabling them
- run the Playwright harness across Chromium, Firefox, WebKit, and signed-off
  narrow/wide Chromium widths
- select elements inside iframe and inspect/edit them from the shell
- use direct manipulation for the supported safe geometry envelope, including
  signed-off drag/resize paths and honest blocked-state feedback
- keep shell layout, drawers, popovers, context menu, preview note, and
  compact toolbar predictable across the signed-off width set
- keep desktop/intermediate topbar commands fitted without horizontal overflow
  by routing secondary actions through a transient overflow trigger when
  shell-owned width metrics say the inline budget is exhausted
- resolve shell light/dark theme before first paint, so dark mode no longer
  flashes through contradictory light segmented controls
- zoom preview/edit panel content with quality-preserving CSS zoom property (Ctrl+=, Ctrl+−, Ctrl+0)
  that re-layouts at target resolution, maintaining text and vector crispness at all zoom levels
  while blocking direct manipulation at non-100% zoom
- create, duplicate, delete, undo, redo, autosave, and restore slides
  deterministically
- reorder slides from the rail on desktop with drag and drop
- use a unified slide action menu from the rail on desktop and compact widths
- detect severe overlap conflicts and recover covered elements with hover ghosting and move-to-top repair
- expose an advanced-mode layers panel with reorder, lock, visibility, group, and ungroup flows
- keep export clean without bridge script, editor markers, or preview-only
  chrome
- keep manual-base and connected asset-directory validation green

## Important constraints

- shell must stay outside the presentation content
- preview must stay truthful to the runtime deck
- export must stay clean and presentation-only
- no architecture rewrite away from `parent shell + iframe + bridge + modelDoc`
- no new dependency-heavy UI path for simple editing

## Current weak spots

- direct manipulation remains intentionally conservative for transform-heavy or
  zoom-heavy geometry outside the signed-off safe envelope
- the editor still lives in one large HTML file and needs structural cleanup
  without changing the runtime architecture
- compact widths are regression-covered for the novice path, but the main
  redesign target for this pass remains desktop and intermediate shell UX

## Verification snapshot

- targeted proof set: green
  - `asset-parity.spec.js --grep "@stage-a|@stage-d"`
  - `honest-feedback.spec.js`
  - `shell.smoke.spec.js --grep "@stage-f|@harness"`
- `npm run test:gate-a`: green at `48 passed / 5 skipped`
- `npm run test:gate-b`: green at `105 passed / 7 skipped` and `56 passed / 6 skipped`
- `npm run test:gate-d`: green at `128 passed / 37 skipped`
- `npm run test:asset-parity`: green

## Latest hardening batch

- semver runtime discipline restored around `editor/presentation-editor-v0.19.1.html`
- `editor/presentation-editor.html` reduced to a compatibility shim instead of a second editable runtime source
- shell-owned storage, export cleanup, and persistence paths no longer fail silently in the touched zones
- export validation now explicitly checks for editor-artifact residue after interaction-heavy shell flows
