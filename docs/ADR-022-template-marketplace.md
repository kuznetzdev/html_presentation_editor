# ADR-022 — Template Marketplace

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: not yet implemented

---

## Context

v1.0 ships one starter deck as a demo (`editor/fixtures/basic-deck.html`, WO-25).
v2.0 needs a mechanism for users to start from curated templates and share their own.

Three distribution models are in tension:

| Model | Pros | Cons |
|---|---|---|
| **Local-only** | Zero infra, fits file:// ethos, zero cost | No discoverability, no sharing |
| **Hosted** | Discoverability, community sharing | Requires backend, ops cost, auth, moderation |
| **Hybrid** (local-first + optional hosted fetch) | Best of both | Complexity; two code paths |

The `file://` invariant and zero-server ethos (ADR-015) create a tension:
a hosted marketplace requires network access, which the product explicitly does not require.

---

## Decision (hypothesis)

**Proposed**: local-only for v2.0 with a structured template registry file.

- Templates ship as curated HTML files in `editor/templates/`
- Registry: `editor/templates/registry.json` — name, preview image path, category, file path
- User can add templates by dropping files into the templates folder (manual install)
- No hosted component in v2.0

Optional hosted tier deferred to v2.3+ (see ADR-028 cloud sync opt-in). If the hosted tier
is built, it is strictly additive and opt-in — local-only mode always works.

---

## Open questions

1. Is manual installation (drop file into folder) acceptable to target archetypes?
   → Technical Educator: probably yes
   → Less technical user: probably no → UI installer needed
2. How many templates is "enough" at launch?
   → Hypothesis: 5-10 curated templates covering common deck types
3. Should templates be parameterized (blocks, ADR-021) or flat HTML?
   → ADR-021 acceptance determines this

---

## Prerequisites

- WO-25 starter-deck shipped (v1.0 includes basic template)
- ADR-021 decision (block parameterization vs. flat templates)
- Financial Reality Check: hosted tier requires infrastructure cost

---

## Consequences

- If accepted (local-only): `editor/templates/` directory added; registry loader in `boot.js`
- If hybrid accepted: requires network-access permission model and progressive fetch
- If rejected: v1.0 starter-deck stays as-is; template system deferred to v3.x

---

## Review trigger

After v1.0 GA: observe how users actually share decks (GitHub gists? Email? Slack DM?).
Distribution behaviour reveals what marketplace model they actually want.

---

## Links

- [ADR-005-onboarding-starter-deck.md](ADR-005-onboarding-starter-deck.md)
- [ADR-021-block-registry.md](ADR-021-block-registry.md)
- [ADR-028-cloud-sync-opt-in.md](ADR-028-cloud-sync-opt-in.md)
