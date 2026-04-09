# Security Policy

## Supported releases

This repository is a local application, not a reusable library. Security fixes
are only guaranteed for the latest tagged release on `main`.

| Release line | Supported | Notes |
| --- | --- | --- |
| `0.19.2` | Yes | Current supported release line |
| `0.19.1` | Limited | Best-effort only until `0.19.2` is tagged and adopted |
| `< 0.19.1` | No | Historical tags are not maintained for security updates |

Operational rules:

- the active runtime is the current semver runtime file in `editor/`
- security fixes land on `main` first and are then cut into the next semver tag
- old runtime files under `docs/history/` are archival only and must not be
  treated as supported deployment targets

## Reporting a vulnerability

Do not open a public GitHub issue for an unpatched vulnerability.

Preferred path:

1. Use GitHub private vulnerability reporting from the repository Security tab
   if the button is available.
2. If private reporting is not available, email the maintainer directly at
   `nikita082003@mail.ru`.

Include:

- affected tag or commit SHA
- reproduction steps
- impact assessment
- whether the issue is local-only, container-only, or affects exported HTML
- any proof-of-concept or screenshots needed to reproduce safely

## Response expectations

- initial acknowledgement target: within 3 business days
- triage / severity assessment target: within 7 business days
- status updates: at least weekly until resolution or coordinated disclosure

## Disclosure process

- reports are validated on the latest supported release line
- fixes are prepared on `main`
- once verified, fixes are published in the next semver release tag and noted in
  `docs/CHANGELOG.md`
- public disclosure should wait until the fix tag is available, unless a
  different timeline is agreed with the reporter

## Scope notes

Please report issues in:

- local editor runtime behavior
- export sanitization or editor-artifact leakage
- autosave / restore persistence that can expose user content unexpectedly
- container packaging and GHCR distribution path
- workflow or release configuration that could publish unsafe artifacts

Out of scope unless they create a real security impact:

- missing hardening on unsupported historical tags
- local-only crashes without confidentiality, integrity, or code-execution impact
- cosmetic UI defects
