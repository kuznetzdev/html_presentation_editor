# Getting Started

## Goal

Get the editor running locally in the shortest possible path, without having to
reverse-engineer the repo first.

## Fastest local launch

Prerequisite:

- Node.js 18 or newer

Command:

```bash
npm start
```

Then open:

- `http://127.0.0.1:4173/`

The root URL is the human-friendly launchpad.

From there:

- `Open Editor` goes to the active runtime
- `Open Sample Gallery` gives you ready-made HTML decks from `references_pres/`
- the root launchpad itself is the stable human-facing URL to bookmark locally

## Headless local serving

```bash
npm run serve
```

This starts the local static server without opening the browser automatically.

## Direct runtime URL

If you already know what you are doing, open the runtime directly:

- `http://127.0.0.1:4173/editor/presentation-editor.html`

## Starter sample deck

If you want a zero-prep file to load into the editor first, use:

- `references_pres/html-presentation-examples_v3/01_basic_minimal.html`

Or browse the local sample gallery:

- `http://127.0.0.1:4173/references_pres/html-presentation-examples_v3/00_examples_index.html`

## Run the test gate

For Playwright-based verification, install dependencies first:

```bash
npm install
npm run test:install-browsers
npm run test:gate-a
```

Useful follow-ups:

- `npm run test:asset-parity`
- `npm run test:gate-b`
- `npm run test:gate-d`

## Run via Docker

Build the local image:

```bash
npm run docker:build
```

Run it:

```bash
npm run docker:run
```

Then open:

- `http://127.0.0.1:4173/`

## GitHub Packages / GHCR

This repo is prepared for GitHub Container Registry publishing.

Once a version tag is published through GitHub Actions, the intended pull path is:

```bash
docker run --rm -p 4173:4173 ghcr.io/kuznetzdev/html_presentation_editor:v0.19.3
```

Manual workflow dispatch is useful for refreshing `latest`; semver image tags come
from actual Git tags.

See `docs/GITHUB_PACKAGES.md` for the exact strategy and why GHCR is the right
package surface here.
