# GitHub Release Body: v0.19.2

## Title

`v0.19.2`

## Tag

`v0.19.2`

## Suggested release subtitle

Patch release for onboarding entrypoint, GHCR path, security policy, and semver sync

## Release body

### Highlights

- promoted the active release to a normal semver runtime at `0.19.2`
- added a human-first repo launchpad and `npm start` entrypoint
- documented GHCR as the useful GitHub Packages surface for this application
- replaced the stock `SECURITY.md` template with a real security policy
- kept the fixed architecture unchanged: `shell + iframe + bridge + modelDoc`

### What changed

#### Semver runtime sync

- the canonical editor runtime is now `editor/presentation-editor-v0.19.2.html`
- `editor/presentation-editor.html` stays compatibility-only and forwards to the current semver runtime
- Playwright harness, package metadata, launchpad links, and project docs now point to one canonical runtime artifact
- the previous active runtime was archived to `docs/history/presentation-editor-v0.19.1.html`

#### Human-first entrypoint

- the repository root now serves a launchpad from `index.html`
- `npm start` is now the default first-run local command
- the launchpad links to the active runtime, compatibility entrypoint, sample gallery, and quick-start docs
- `docs/GETTING_STARTED.md` now acts as the shortest local operator runbook

#### GitHub Packages / GHCR

- GHCR is now documented as the only useful GitHub Packages surface for this repo shape
- npm package publication is explicitly treated as an anti-goal for this application
- the repository documents the first-publish visibility step required to make GHCR useful for anonymous pulls

#### Security policy

- `SECURITY.md` now defines supported release lines, a non-public reporting path, response expectations, and disclosure timing
- archived runtime snapshots under `docs/history/` are explicitly marked unsupported

### Validation

#### Focused proof

- `npx playwright test tests/playwright/specs/shell.smoke.spec.js --project=chromium-desktop --grep "root launchpad routes first-time user to the active editor runtime"`
  - `1 passed`
- local `scripts/run-local-editor.js` smoke with `EDITOR_NO_OPEN=1`
  - launchpad returned `200`
  - sample gallery returned `200`

### Upgrade and compatibility notes

- no bridge protocol changes
- no autosave schema change; payload remains `presentation-editor:autosave:v3`
- no export format change
- no novice-flow change; the workflow contract remains `empty -> loaded-preview -> loaded-edit`
- no architecture rewrite away from `shell + iframe + bridge + modelDoc`

### Residual limits

- the active runtime remains a large monolithic HTML file, so future structural cleanup still matters
- GHCR still needs the package visibility set to `Public` after the first publish in GitHub UI
- this batch improves discoverability, release sync, and disclosure posture rather than editor feature depth

### Included commits

- onboarding launchpad and GHCR entrypoint batch on `main`
- local entrypoint polish batch on `main`
- security policy replacement batch on `main`
- semver release-sync batch for `v0.19.2`

### Links

- Release engineering report:
  - `docs/report-v0.19.2-onboarding-security-release.md`
- Compare:
  - [v0.19.1...v0.19.2](https://github.com/kuznetzdev/html_presentation_editor/compare/v0.19.1...v0.19.2)
- Tag:
  - [v0.19.2](https://github.com/kuznetzdev/html_presentation_editor/releases/tag/v0.19.2)

## Short GitHub release summary

`v0.19.2` promotes the current onboarding and distribution improvements under a normal semver patch tag, keeps the legacy unversioned editor entrypoint as a compatibility shim, adds a human-first launchpad and `npm start` path, documents GHCR as the supported GitHub Packages surface, and replaces the placeholder security policy with a real disclosure contract.
