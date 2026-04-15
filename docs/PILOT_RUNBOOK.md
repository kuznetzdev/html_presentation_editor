# Pilot Runbook

## Audience

This runbook is for the operator preparing a small pilot with one or two users.

## Goal

Prove that a user can launch the editor, edit a deck, and export a portable HTML
file without engineer hand-holding.

## Environment

- Windows, macOS, or Linux
- Node.js 18+
- Chromium-based browser recommended for folder-based asset import

## Setup

```bash
npm install
npm run test:install-browsers
```

## Launch

```bash
npm start
```

Open:

- `http://127.0.0.1:4173/`

If the port is busy:

PowerShell:

```powershell
$env:EDITOR_PORT="4174"
npm start
```

## Operator path

1. Open `Open Starter Example`
2. Confirm the first slide renders without missing hero content
3. Enter edit mode
4. Change a headline or paragraph
5. Export HTML
6. Open the exported HTML separately
7. Confirm the exported deck works without editor chrome

## Second-user path

1. Open the editor from `/`
2. Load `references_pres/html-presentation-examples_v3/01_basic_minimal.html`
3. Duplicate a slide
4. Undo and redo once
5. Export HTML

## Automated validation

```bash
npm run test:pilot
```

## Exit criteria

- Starter route works
- Empty-state manual load works
- Export works
- No misleading save wording
- No blocker-level missing assets in the chosen pilot deck
