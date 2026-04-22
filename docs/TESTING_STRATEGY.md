# Testing Strategy

## Overview

The editor uses staged Playwright gates plus an asset-parity script. The fixed
architecture remains unchanged:

- `parent shell + iframe preview + bridge + modelDoc`

Every gate must preserve:

- truthful preview
- clean export
- stable shell workflow
- desktop-first usability with explicit compact-shell coverage

## Current npm scripts

### Gate A

Purpose: fast desktop regression gate for PR work.

Command:

```bash
npm run test:gate-a
```

Coverage:

- `shell.smoke.spec.js`
- `click-through.spec.js`
- `selection-engine-v2.spec.js`
- `honest-feedback.spec.js`

Project:

- `chromium-desktop`

### Gate B

Purpose: release-core desktop and intermediate-shell verification.

Command:

```bash
npm run test:gate-b
```

Coverage includes:

- `shell.smoke.spec.js`
- `click-through.spec.js`
- `selection-engine-v2.spec.js`
- `layer-navigation.spec.js`
- `overlap-recovery.spec.js`
- `stage-o-layers-lock-group.spec.js`
- `editor.regression.spec.js`
- `asset-parity.spec.js`
- `honest-feedback.spec.js`

Projects:

- `chromium-desktop`
- `chromium-shell-1100`

### Gate C

Purpose: cross-browser stability.

Command:

```bash
npm run test:gate-c
```

Projects:

- `firefox-desktop`
- `webkit-desktop`

### Gate D

Purpose: compact and responsive shell verification.

Command:

```bash
npm run test:gate-d
```

Projects:

- `chromium-mobile-390`
- `chromium-mobile-640`
- `chromium-tablet-820`

### Gate E

Purpose: export integrity and asset parity.

Commands:

```bash
npm run test:asset-parity
```

and inside `test:gate-b` / `test:gate-f`:

- `asset-parity.spec.js`

### Gate F

Purpose: full confidence sweep across all configured projects.

Command:

```bash
npm run test:gate-f
```

## Pilot acceptance

For a small human pilot, the canonical automated command is:

```bash
npm run test:pilot
```

That means:

1. `npm run test:gate-a`
2. `npm run test:asset-parity`

Use this together with the manual checklist in `docs/PILOT_CHECKLIST.md`.

## Manual acceptance slice

Before inviting pilot users, two people should independently complete:

1. Launch from `/`
2. Open `Open Starter Example`
3. Verify live preview
4. Make a text edit
5. Export HTML
6. Open the exported file separately
7. Confirm no confusion around save/export language

## Stability rules

- Prefer Playwright auto-retry assertions over sleeps
- Use `expect.poll()` for shell state observed via `evaluateEditor()`
- Do not change architecture to satisfy a single flaky test
- Quarantine only when the failure is understood and documented

## Signed-off capabilities that must stay green

- workflow contract: empty -> loaded-preview -> loaded-edit
- starter flow and empty-state launch path
- honest save/export feedback
- overlap recovery and advanced layer picker
- export cleanliness
- asset parity
- compact drawer routing
- theme and transient-shell stability

## Visual regression gate (gate-visual)

Added in v0.32.0 via WO-32. See `docs/ADR-007-visual-regression-ci-gate.md` for full spec.

**Visual baselines are Windows-Chromium-specific.** Regenerate with `npm run test:gate-visual:update`
when intentional CSS changes land (e.g. design token changes, new shell surfaces, layout shifts).
Do not regenerate on CI — only when a human reviewer has confirmed the visual change is intentional.

Command:

```bash
npm run test:gate-visual         # enforce baselines — must be 15/0/0
npm run test:gate-visual:update  # regenerate baselines after intentional CSS changes
```

Configuration:

- Playwright project: `chromium-visual`
- Viewport: 1440×900 (deviceScaleFactor: 1)
- Snapshot dir: `tests/visual/__snapshots__/chromium-visual/`
- Thresholds: `maxDiffPixelRatio: 0.01`, `threshold: 0.2`
- Animations disabled in every test via `page.addStyleTag`

15 surfaces captured:

| Slug | Surface |
|------|---------|
| empty-light | Empty shell, light |
| empty-dark | Empty shell, dark |
| loaded-preview-light | Deck loaded, preview mode, light |
| loaded-preview-dark | Deck loaded, preview mode, dark |
| loaded-edit-light | Deck loaded, edit mode, no selection, light |
| loaded-edit-dark | Deck loaded, edit mode, no selection, dark |
| selected-text-light | h1 selected in edit mode, light |
| selected-text-dark | h1 selected in edit mode, dark |
| block-banner-light | Block banner (zoom 125%), light |
| block-banner-dark | Block banner (zoom 125%), dark |
| floating-toolbar-light | Floating toolbar visible, light |
| floating-toolbar-dark | Floating toolbar visible, dark |
| layer-picker-light | Layer picker popup open, light |
| layer-picker-dark | Layer picker popup open, dark |
| action-hint-light | Inspector guidance hint, light only |

Gate-visual runs independently and does not block Gate-A.
