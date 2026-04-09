# v0.19.2 onboarding, security, and release sync report

## Scope

- onboarding and release-packaging batch only
- no external API or bridge-contract rewrite
- no autosave schema bump
- no export-format change
- no architecture rewrite away from `shell + iframe + bridge + modelDoc`

This pass was limited to four repository-level goals:

1. restore semver runtime discipline around the active `0.19.2` artifact
2. make the repository itself an obvious first-run entrypoint for humans
3. define the useful GitHub Packages path as GHCR instead of npm-package theater
4. replace the placeholder security policy with a real disclosure and support policy

## Delivered changes

### 1. Semver runtime discipline

- canonical runtime now ships as `editor/presentation-editor-v0.19.2.html`
- `editor/presentation-editor.html` remains the compatibility-only redirect shim
- Playwright harness and export tooling now target the new versioned runtime directly
- package metadata, changelog, skills, and repository docs now point to one canonical runtime artifact
- the previous active runtime was archived to `docs/history/presentation-editor-v0.19.1.html`

### 2. Human-first repo entrypoint

- the repository root now serves a local launchpad from `index.html`
- `npm start` is now the default first-run command instead of a hidden internal server command
- the launchpad links to:
  - the active runtime
  - the compatibility entrypoint
  - the sample gallery under `references_pres/`
  - the shortest local docs path
- `docs/GETTING_STARTED.md` now acts as the shortest operator runbook instead of forcing users to infer startup from Playwright config or repo structure

### 3. GitHub Packages / GHCR path

- the useful package surface is now explicitly documented as GHCR, not npm
- Docker packaging and GHCR publishing are treated as the supported distribution path for this application shape
- the repository now documents the practical first-publish package-visibility step needed for public anonymous pulls from GHCR

### 4. Security policy replacement

- removed the stock template `SECURITY.md`
- defined supported release lines around the latest semver tag on `main`
- documented a non-public reporting path, acknowledgement targets, and disclosure expectations
- clarified that archived runtimes under `docs/history/` are not supported deployment targets

## Non-goals

- no architecture rewrite away from `shell + iframe + bridge + modelDoc`
- no runtime behavior change to the editing contract
- no autosave or export schema change
- no npm-package distribution surface

## Expected result

After this batch:

- the repository has one canonical `0.19.2` runtime target
- a first-time user can run the app from source without discovering hidden internal paths
- GitHub Packages strategy is explicit and useful instead of ambiguous
- `SECURITY.md` reflects the real support and disclosure model for the project
- documentation, launchpad, and harness references are synchronized with what actually ships on `main`

## Validation executed

### Focused proof

- `npx playwright test tests/playwright/specs/shell.smoke.spec.js --project=chromium-desktop --grep "root launchpad routes first-time user to the active editor runtime"`
  - Result: `1 passed`
- local `scripts/run-local-editor.js` smoke with `EDITOR_NO_OPEN=1`
  - Result: root launchpad `200`, sample gallery `200`

## Residual limits

- the active runtime still remains a large monolithic HTML file
- GHCR package usefulness still depends on the first package visibility change in GitHub UI after initial publish
- this batch improves discoverability and distribution posture, not editor feature depth

## Release-ready summary

`v0.19.2` restores semver runtime discipline for the current `main` state, adds a human-first repo launchpad and `npm start` entrypoint, documents GHCR as the supported GitHub Packages path for this application, and replaces the placeholder security policy with a real support and disclosure contract. The editor architecture and runtime behavior remain unchanged.
