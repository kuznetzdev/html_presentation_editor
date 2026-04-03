# HTML Presentation Editor

Local shell-driven editor for existing HTML slide decks.

The product goal is simple:

`Open -> select -> edit -> save`

In basic mode the user should not need to understand HTML at all. The editor
must feel closer to a standard presentation tool than to DevTools. Advanced
mode is allowed to expose structure, HTML, and low-level controls for users who
need deeper deck surgery.

## Current state

- Current package version: `0.18.3`
- Main runtime file: `editor/presentation-editor-v0.18.3.html`
- Architecture remains fixed: `parent shell + iframe preview + bridge + modelDoc`
- Focused Stage D-F Playwright shell proof: green
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
- Detect severe overlap conflicts and recover covered elements with a move-to-top action
- Use the advanced-mode layers panel to inspect stack order, lock elements, toggle visibility, and group related nodes
- Zoom preview/edit panel content with quality-preserving CSS zoom property (Ctrl+=, Ctrl+−, Ctrl+0)
  while blocking direct manipulation at non-100% zoom; CSS zoom maintains text/vector
  crispness at all scale levels without coordinate multiplication overhead
- Resolve light and dark shell theme before first paint so segmented controls,
  menus, and inspector chrome do not flash contradictory surfaces
- Keep transient shell surfaces mutually exclusive instead of stacking floating
  toolbar, context menu, and compact drawers into competing layers
- Export clean HTML without editor-only chrome or bridge residue

## Product rules

- The shell stays outside presentation content
- Preview stays truthful to the runtime deck
- Export stays clean
- Basic and Advanced modes both remain first-class
- Reliability beats feature count when those goals conflict

## Repository entry points

- `editor/presentation-editor-v0.18.3.html`
  Current editor runtime
- `docs/SOURCE_OF_TRUTH.md`
  Product and architecture invariants
- `docs/PROJECT_SUMMARY.md`
  Current state snapshot
- `docs/CHANGELOG.md`
  Release-level engineering history
- `docs/ROADMAP_NEXT.md`
  Next priorities
- `docs/TESTING_STRATEGY.md`
  Multi-gate Playwright test plan
- `.github/skills/html-presentation-editor/SKILL.md`
  Project-local operating rules for Copilot

## Development commands

```bash
# Full test suite (all projects)
npm test

# Fast PR gate (chromium-desktop only)
npm run test:gate-a

# Release-core gate (desktop + intermediate)
npm run test:gate-b

# Export integrity check
npm run test:asset-parity

# Cross-browser stability
npm run test:gate-c

# Compact/responsive verification
npm run test:gate-d

# Nightly full confidence gate (all specs, all projects)
npm run test:gate-f
```

## Recent milestone tags

- `v0.17.0`
- `v0.18.0`
- `v0.18.1`
- `v0.18.2`
- `ux-regression-baseline-v1`
- `ux-direct-manipulation-v1`
- `ux-slide-structure-v1`
