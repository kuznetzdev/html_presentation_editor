# PROJECT SUMMARY

## Current version

`0.13.5`

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
- Playwright harness for Chromium, Firefox, WebKit, and signed-off narrow/wide Chromium widths
- select elements inside iframe and inspect/edit them from the shell
- direct manipulation for simple cases, including verified drag of an `absolute` element
- shell layout now uses measured chrome offsets instead of circular height assumptions
- drawers, popovers, context menu, preview note, and compact floating toolbar behave predictably across the signed-off width set
- narrow-width shell overlays fall back to sheet mode instead of trying to preserve fragile anchored placement
- clean export path without bridge script, editor markers, or preview-only base markers
- manual-base parity between live preview and export-validation preview is now explicitly proven in browser QA
- export-validation preview remains reachable on compact widths through the visible export flow
- create / duplicate / delete / undo / redo slide flow is now proven through runtime-confirmed Playwright coverage
- autosave recovery is now proven on desktop and compact widths through the real shell workflow
- edit-mode persistence is now proven across undo / redo / autosave restore instead of depending on shell defaults after preview rebuilds
- direct manipulation is now proven for the supported keyboard-nudge envelope across `absolute`, `fixed`, and nested positioned contexts
- unsafe transformed manipulation paths stay honestly blocked and surfaced through diagnostics instead of producing incorrect coordinates
- connected asset-directory diagnostics are now proven through active Stage D browser coverage across the signed-off Chromium width set

## Important constraints

- shell must stay outside the presentation content
- preview must stay truthful to the runtime deck
- export must stay clean and presentation-only
- no new override layers or bottom-of-file CSS patch piles
- no architecture rewrite away from `parent shell + iframe + bridge + modelDoc`

## Current weak spots

- direct manipulation is still intentionally conservative for transformed / zoomed layouts outside the signed-off positioned envelope
- asset fidelity is still partial for deeper remote/manual-base uncertainty outside the connected-directory sign-off path
- the Playwright harness is now present with stages A-D enabled; dedicated shell hardening, cleanup, and final polish still need staged activation
- the editor still lives in one large HTML file and needs internal structural cleanup without changing the architecture

## Engineering audit snapshot

### Realistically closed in v12

- truthful iframe preview with working bridge bootstrap
- runtime-confirmed slide activation instead of shell-only optimistic switching
- clean export path separated from validation preview path
- empty-state `Open HTML` path no longer blocked by preview loading overlay
- simple `absolute` / `fixed` direct-manipulation coordinates now land in the correct origin

### Only partially mitigated

- direct manipulation in transform-heavy or zoom-heavy geometry is blocked safely, not truly solved
- asset audit distinguishes `unresolved` from `base-URL-dependent`, and connected-directory truthfulness is now proven, but deeper remote/manual-base uncertainty still lacks a dedicated release gate
- compact shell drawers / toolbar / context menu are now under repo-local Playwright smoke coverage, but stage-specific shell hardening is still not fully enabled
- slide lifecycle is now deterministic for create / duplicate / delete / undo / redo, and bridge-driven document reconciliation no longer poisons redo history; deeper bridge resend and runtime repair paths still need proof

### Still critical

- no strong automated validation pipeline around the standalone editor
- single-file maintenance cost is still high in the most stateful shell / preview / manipulation zones
