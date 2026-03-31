# HTML Presentation Editor

Local shell-driven editor for existing HTML slide decks.

The product goal is simple:

`Open -> select -> edit -> save`

In basic mode the user should not need to understand HTML at all. The editor
must feel closer to a standard presentation tool than to DevTools. Advanced
mode is allowed to expose structure, HTML, and low-level controls for users who
need deeper deck surgery.

## Current state

- Current package version: `0.13.9`
- Main runtime file: `editor/presentation-editor-v12.html`
- Architecture remains fixed: `parent shell + iframe preview + bridge + modelDoc`
- Full Playwright suite on `main`: `125 passed / 67 skipped`
- Asset parity validation: green

## What is working

- Load an existing HTML deck into an isolated iframe preview
- Switch between Preview and Edit without changing the core architecture
- Keep runtime-confirmed active slide state in sync with the shell
- Edit text, replace images, insert blocks, insert media, and use slide-level actions
- Use direct manipulation on the supported safe geometry envelope
- Keep unsafe manipulation paths blocked with explicit UX feedback
- Duplicate, delete, undo, redo, autosave, and restore deterministically
- Reorder slides from the rail on desktop with drag and drop
- Open a unified slide action menu from the rail, with compact-safe kebab access
- Export clean HTML without editor-only chrome or bridge residue

## Product rules

- The shell stays outside presentation content
- Preview stays truthful to the runtime deck
- Export stays clean
- Basic and Advanced modes both remain first-class
- Reliability beats feature count when those goals conflict

## Repository entry points

- `editor/presentation-editor-v12.html`
  Current editor runtime
- `docs/SOURCE_OF_TRUTH.md`
  Product and architecture invariants
- `docs/PROJECT_SUMMARY.md`
  Current state snapshot
- `docs/CHANGELOG.md`
  Release-level engineering history
- `docs/ROADMAP_NEXT.md`
  Next priorities
- `.codex/skills/html-presentation-editor/SKILL.md`
  Project-local operating rules for Codex

## Development commands

```bash
npm test
npm run test:asset-parity
```

## Recent milestone tags

- `ux-regression-baseline-v1`
- `ux-direct-manipulation-v1`
- `ux-slide-structure-v1`
