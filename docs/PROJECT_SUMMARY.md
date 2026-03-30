# PROJECT SUMMARY

## Current version

`0.13.1`

## Product state

HTML Presentation Editor remains a shell-driven editor for existing HTML slide decks.
The fixed architecture is unchanged:

- parent shell for UI, history, autosave, export, diagnostics
- iframe preview for truthful runtime DOM
- bridge for parent-to-iframe commands and runtime sync
- `modelDoc` as the canonical exportable document model

## What is working now

- load full HTML deck from text into isolated iframe preview
- switch between Preview and Edit without rebuilding the whole architecture
- generic slide activation and runtime-confirmed active slide sync
- select elements inside iframe and inspect/edit them from the shell
- direct manipulation for simple cases, including verified drag of an `absolute` element
- shell layout now uses measured chrome offsets instead of circular height assumptions
- drawers, popovers, context menu, preview note, and compact floating toolbar behave predictably across the signed-off width set
- narrow-width shell overlays fall back to sheet mode instead of trying to preserve fragile anchored placement
- clean export path without bridge script, editor markers, or preview-only base markers
- autosave / undo / redo plumbing remains active

## Important constraints

- shell must stay outside the presentation content
- preview must stay truthful to the runtime deck
- export must stay clean and presentation-only
- no new override layers or bottom-of-file CSS patch piles
- no architecture rewrite away from `parent shell + iframe + bridge + modelDoc`

## Current weak spots

- direct manipulation is still intentionally conservative for transformed / zoomed / nested layouts
- asset fidelity is still partial for CSS `url()`, `srcset`, `poster`, and deeper relative-asset chains
- there is still no automated repo-local validation pipeline; release confidence remains browser-smoke based
- the editor still lives in one large HTML file and needs internal structural cleanup without changing the architecture

## Engineering audit snapshot

### Realistically closed in v12

- truthful iframe preview with working bridge bootstrap
- runtime-confirmed slide activation instead of shell-only optimistic switching
- clean export path separated from validation preview path
- empty-state `Open HTML` path no longer blocked by preview loading overlay
- simple `absolute` / `fixed` direct-manipulation coordinates now land in the correct origin

### Only partially mitigated

- direct manipulation in complex geometry is blocked safely, not truly solved
- asset audit distinguishes `unresolved` from `base-URL-dependent`, but coverage is still incomplete
- compact shell drawers / toolbar / context menu are now signed off for the target width set, but still rely on manual browser QA rather than automated checks
- slide lifecycle is more deterministic, but still depends on runtime metadata timing and bridge resend logic

### Still critical

- no strong automated validation pipeline around the standalone editor
- single-file maintenance cost is still high in the most stateful shell / preview / manipulation zones
