# ADR-028 — Cloud Sync Opt-In

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: not yet implemented; earliest v2.3

---

## Context

v1.0 is entirely local. No network required for any workflow.
v2.3 hypothesis: "Publishing (static site, embed, share link)" requires some form of hosting.

Options for cloud/sync capability:

| Option | File:// compatible | Cost | Complexity | User data control |
|---|---|---|---|---|
| **Service Worker (PWA)** | No (requires served origin) | Zero hosting | Medium | Full (stays on device) |
| **Backend-as-a-Service (Supabase, PocketBase)** | Opt-in only | Low/free tier | Medium | Partial (provider storage) |
| **Self-hosted backend** | Opt-in only | User-pays infra | Low for user | Full |
| **Static site export + user-chosen host** | Yes (export only) | Zero | Low | Full |
| **P2P (WebRTC/webtorrent)** | Opt-in only | Zero hosting | High | Full |

The zero-server invariant (ADR-015) means: cloud sync is ALWAYS opt-in.
file:// must always work without cloud features. Cloud features are progressive enhancement.

---

## Decision (hypothesis)

**Proposed**: static site export (v2.3) as first cloud-adjacent feature. No hosted backend in v2.x.

Rationale:
- Static site export: user gets a self-contained folder they can upload anywhere
- Consistent with zero-server philosophy
- Aligns with "open-source hoarder" archetype (they self-host everything)
- Optional hosted relay (for share links) deferred to v3.x if there is proven demand

If sharing links are needed: integrate with existing services (Netlify Drop, GitHub Pages)
rather than building proprietary hosting.

---

## Open questions

1. Do users actually want to publish their presentations to the web?
   → Interview question: "What happens to a finished deck? Do you ever share it online?"
2. Is self-hosting acceptable as the publish path?
   → Open-Source Hoarders: yes. Others: may want a one-click option
3. Does PWA capability add value even without cloud sync?
   → PWA = offline cache (already works via file://), install-to-homescreen. Low value for desktop users.

---

## Prerequisites

- v1.0 GA + 60 days usage
- ADR-025 (export diversity) accepted — static site export depends on export pipeline
- Financial Reality Check: any hosting costs

---

## Consequences

- If static site export accepted for v2.3: export pipeline generates `dist/` folder
- If hosted backend accepted: architectural change; privacy policy required
- If P2P accepted: WebRTC dependency; significant complexity

---

## Review trigger

After v1.0 GA: observe how users currently share decks (email attachment? GitHub? Nothing?).
The sharing behaviour reveals whether built-in publishing is actually needed.

---

## Links

- [ADR-015-module-bundling-decision.md](ADR-015-module-bundling-decision.md)
- [ADR-023-collaboration-model.md](ADR-023-collaboration-model.md)
- [ADR-025-export-diversity.md](ADR-025-export-diversity.md)
