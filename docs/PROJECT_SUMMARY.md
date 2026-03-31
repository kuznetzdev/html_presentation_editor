# PROJECT SUMMARY

## Current version

`0.13.9`

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
- Advanced mode may expose HTML, structure, diagnostics, and precise controls
- The editor should feel like a reliable presentation tool first
- Reliability and clarity beat feature count when they conflict

## What is working now

- load a full HTML deck from text into isolated iframe preview
- switch between Preview and Edit without rebuilding the core architecture
- keep generic slide activation and runtime-confirmed active slide sync
- run the Playwright harness across Chromium, Firefox, WebKit, and signed-off
  narrow/wide Chromium widths
- select elements inside iframe and inspect/edit them from the shell
- use direct manipulation for the supported safe geometry envelope, including
  signed-off drag/resize paths and honest blocked-state feedback
- keep shell layout, drawers, popovers, context menu, preview note, and
  compact toolbar predictable across the signed-off width set
- create, duplicate, delete, undo, redo, autosave, and restore slides
  deterministically
- reorder slides from the rail on desktop with drag and drop
- use a unified slide action menu from the rail on desktop and compact widths
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
- stage-driven polish for shell consistency, visual cleanup, and internal code
  zoning still remains after correctness sign-off

## Verification snapshot

- `npm test` on `main`: `125 passed / 67 skipped`
- `npm run test:asset-parity`: green
