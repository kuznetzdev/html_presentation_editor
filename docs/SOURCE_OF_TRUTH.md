# SOURCE OF TRUTH

## Project

HTML Presentation Editor

## Product definition

This is a local visual editor for existing HTML slide decks.

It is not:

- a generic page builder
- a CMS
- a low-code website tool

It exists to let a user open a real HTML presentation, edit it safely, and
export clean HTML again.

## Core product promise

The default user path is:

`Open -> select -> edit -> save`

The user should be able to do normal work without understanding HTML.

### Basic mode

Basic mode is for presentation editing, not code editing.

It should prioritize:

- obvious actions
- fast selection and editing
- minimal UI noise
- safe defaults
- no dead ends

### Advanced mode

Advanced mode may expose:

- HTML editing
- id/class/dataset controls
- diagnostics
- precise sizing and positioning
- structural controls

Advanced mode exists for power users. It must not leak complexity back into
the basic path.

## Non-negotiable invariants

- no dead ends
- predictable UX
- shell theme resolves before first paint and must not flash contradictory
  light/dark chrome
- preview equals runtime truth
- recoverability through undo, redo, and autosave
- shell UI stays outside presentation content
- export stays clean
- `iframe + bridge + modelDoc` remains the fixed architecture

## Architecture

### Parent shell

Owns:

- topbar
- slide rail
- inspector
- floating toolbar
- context menu
- insert palette
- history
- autosave and restore
- export
- compact shell
- diagnostics UI

### Iframe preview

Owns:

- truthful runtime DOM for the presentation
- execution of presentation scripts
- runtime selection and editing inside the deck

### Bridge

Owns:

- parent-to-iframe commands
- iframe-to-parent state sync
- runtime metadata
- selection payloads
- element and slide updates
- diagnostics and heartbeat

### modelDoc

Owns:

- canonical document state
- export source
- restore source
- history source
- editor-side structural logic

## UX rules

- The slide content is visually primary
- Shell chrome must stay quieter than the presentation canvas
- The rail is for navigation and simple structure actions
- Desktop may use drag-and-drop reorder in the rail
- Compact widths should prefer explicit menu actions over fragile drag paths
- Blocked actions must fail honestly with feedback, not silently
- One shell control should own one visible surface state; do not stack nested
  visual layers to fake active/inactive behavior
- Floating toolbar, context menu, and compact shell drawers remain mutually
  exclusive transient surfaces

## Current signed-off capabilities

- load deck into isolated iframe preview
- switch Preview and Edit without changing architecture
- runtime-confirmed slide activation
- slide create, duplicate, delete, undo, redo, autosave, and restore
- safe direct manipulation for the signed-off geometry envelope
- truthful blocking for unsafe manipulation contexts
- desktop rail drag-and-drop reorder
- unified slide action menu with compact-safe access
- clean export and asset parity validation

## Priority rule

If there is a conflict between:

- adding more power
- making the editor clearer, safer, and more reliable

the second one wins.
