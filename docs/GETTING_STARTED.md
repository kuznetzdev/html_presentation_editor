# Getting Started

## Goal

Get the editor running locally in the shortest possible path, without having to
reverse-engineer the repo first.

## Fastest local launch

Prerequisite:

- Node.js 18 or newer

Command:

```bash
npm run start
```

Then open:

- `http://127.0.0.1:4173/`

The root URL is the human-friendly launchpad.

From there:

- `Open Editor` goes to the active runtime
- `Open Compatibility Entry` goes through the legacy shim

## Fastest launch with automatic browser open

```bash
npm run start:open
```

This starts the local static server and opens the launchpad in your default
browser.

## Direct runtime URL

If you already know what you are doing, open the runtime directly:

- `http://127.0.0.1:4173/editor/presentation-editor-v0.19.1.html`

## Run the test gate

For Playwright-based verification, install dependencies first:

```bash
npm install
npx playwright install
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
docker run --rm -p 4173:4173 ghcr.io/kuznetzdev/html_presentation_editor:v0.19.1
```

See `docs/GITHUB_PACKAGES.md` for the exact strategy and why GHCR is the right
package surface here.
