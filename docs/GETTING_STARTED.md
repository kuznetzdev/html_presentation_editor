# Getting Started

## Goal

Launch the editor locally, open a working sample, and verify the main product path
 without reading the whole repository first.

## Prerequisites

- Node.js 18 or newer

## Fastest local launch

```bash
npm start
```

Windows shortcut:

```bat
start-editor.cmd
```

Open:

- `http://127.0.0.1:4173/`

The root launchpad is the canonical human entrypoint.

## First pilot path

From the root launchpad:

1. Open `Open Starter Example`
2. Verify that the preview loads immediately
3. Switch to edit mode
4. Change headline or paragraph text
5. Use `Export`
6. Open the exported HTML separately

This is the shortest happy path for pilot verification.

## Manual deck fallback

If you want to load a hand-picked deck instead of the starter route:

- open `references_pres/html-presentation-examples_v3/01_basic_minimal.html`
- or browse the local gallery at
  `http://127.0.0.1:4173/references_pres/html-presentation-examples_v3/00_examples_index.html`

## Headless local serving

```bash
npm run serve
```

This starts the local static server without auto-opening the browser.

## Busy port recovery

If port `4173` is already occupied, start the editor on another port.

PowerShell:

```powershell
$env:EDITOR_PORT="4174"
npm start
```

Bash:

```bash
EDITOR_PORT=4174 npm start
```

## Pilot validation commands

Install dependencies once before Playwright runs:

```bash
npm install
npm run test:install-browsers
```

Fast pilot verification:

```bash
npm run test:pilot
```

Useful follow-ups:

- `npm run test:gate-b`
- `npm run test:gate-d`
- `npm run test:gate-f`

## Docker

```bash
npm run docker:build
npm run docker:run
```

Then open:

- `http://127.0.0.1:4173/`

## Related docs

- `docs/PILOT_RUNBOOK.md`
- `docs/PILOT_CHECKLIST.md`
- `docs/KNOWN_LIMITATIONS.md`
