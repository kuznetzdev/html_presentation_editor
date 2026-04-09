# v0.19.3 entrypoint and release sync report

## Goal

Keep `main`, the active semver runtime, and the first-run local entrypoint in one coherent state.

## Changes

1. promoted the active runtime artifact to `editor/presentation-editor-v0.19.3.html`
2. archived `editor/presentation-editor-v0.19.2.html` under `docs/history/`
3. removed the redundant `start:open` alias from `package.json`
4. simplified the root launchpad by keeping one primary editor CTA and moving the compatibility redirect out of the main action cluster
5. corrected the limited-support wording in `SECURITY.md`
6. synchronized launchpad, shim, Playwright, asset-parity tooling, docs, and local skills to the new semver target

## Verification

- focused launchpad smoke proof for the active runtime route
- export asset parity validation

## Result

`v0.19.3` keeps the onboarding path simpler for first-time users, preserves the compatibility redirect for legacy links without giving it equal visual weight, and restores semver release discipline for the newest `main` state.
