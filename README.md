# HTML Presentation Editor

Local shell-driven editor for existing HTML slide decks.

The product goal is simple:

`Open -> select -> edit -> save`

In basic mode the user should not need to understand HTML at all. The editor
must feel closer to a standard presentation tool than to DevTools. Advanced
mode is allowed to expose structure, HTML, and low-level controls for users who
need deeper deck surgery.

## Start here

Fastest local path:

```bash
# serve the repo locally on http://127.0.0.1:4173
npm run start

# optional: start the server and open the browser automatically
npm run start:open
```

Then open:

- `http://127.0.0.1:4173/` for the local launchpad
- `http://127.0.0.1:4173/editor/presentation-editor-v0.19.1.html` for the active runtime directly

Important:

- You do not need `npm install` just to launch the local editor
- You do need `npm install` for Playwright-based tests
- The repo root now acts as the default first-stop entrypoint for humans

## Current state

- Current version: see `package.json`
- Main runtime file: `editor/presentation-editor-v0.19.1.html`
- Compatibility entrypoint: `editor/presentation-editor.html` redirect shim only
- Architecture remains fixed: `parent shell + iframe preview + bridge + modelDoc`
- Targeted proof set: green
- Release-core gates `test:gate-a`, `test:gate-b`, `test:gate-d`: green
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
  (requires Firefox 126+ from May 2024, Chrome 4+, Safari 4+, Edge 12+)
- Resolve light and dark shell theme before first paint so segmented controls,
  menus, and inspector chrome do not flash contradictory surfaces
- Keep transient shell surfaces mutually exclusive instead of stacking floating
  toolbar, context menu, and compact drawers into competing layers
- Export clean HTML without editor-only chrome or bridge residue
- Keep semver runtime references synchronized across docs, harness, and package metadata

## Product rules

- The shell stays outside presentation content
- Preview stays truthful to the runtime deck
- Export stays clean
- Basic and Advanced modes both remain first-class
- Reliability beats feature count when those goals conflict

## Repository entry points

- `index.html`
  Human-friendly local launchpad for first-time users
- `editor/presentation-editor-v0.19.1.html`
  Current editor runtime
- `editor/presentation-editor.html`
  Compatibility shim that forwards to the active semver runtime
- `docs/GETTING_STARTED.md`
  Quick runbook for first local launch, tests, and Docker
- `docs/GITHUB_PACKAGES.md`
  Recommended GitHub Packages strategy for this repo
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
# Start the local editor
npm run start

# Start and open the browser automatically
npm run start:open

# Serve on all interfaces (useful for LAN / VM testing)
npm run start:host

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

# Build and run the local container entrypoint
npm run docker:build
npm run docker:run
```

## Local run modes

### Just open the editor

Use `npm run start` and go to `http://127.0.0.1:4173/`.

That launchpad gives you:

- the primary `Open Editor` path
- a direct link to the compatibility shim
- the current release/runtime identity
- the quickest docs for first use

### Run tests

```bash
npm install
npx playwright install
npm run test:gate-a
```

### Run via Docker

```bash
npm run docker:build
npm run docker:run
```

Then open `http://127.0.0.1:4173/`.

## GitHub Packages recommendation

The useful package surface for this repo is a GHCR container image, not an npm
package.

Why:

- this project is an application, not a reusable JavaScript library
- the editor is static and containerizes cleanly
- GHCR gives a predictable `docker run` entrypoint for reviewers and adopters

Prepared in-repo:

- `Dockerfile`
- `.dockerignore`
- `.github/workflows/publish-ghcr.yml`

See `docs/GITHUB_PACKAGES.md` for the exact recommendation and tradeoffs.

## Recent milestone tags

- `v0.17.0`
- `v0.18.0`
- `v0.18.1`
- `v0.18.2`
- `ux-regression-baseline-v1`
- `ux-direct-manipulation-v1`
- `ux-slide-structure-v1`
