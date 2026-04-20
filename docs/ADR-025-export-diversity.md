# ADR-025 — Export Diversity

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: WO-38 closes PPTX export at v1.0; PDF/video/embed are post-v1.0

---

## Context

v1.0 ships HTML → PPTX export (via pptxgenjs, WO-03 pins + SRI).
Users ask for: PDF, video (MP4/GIF), static site, embeddable iframe.

Each export format has different complexity and fidelity trade-offs:

| Format | Library / approach | Fidelity | File size | Complexity |
|---|---|---|---|---|
| **PPTX** (existing) | pptxgenjs | Medium (layout approximate) | Small | Already shipped |
| **PDF** | `window.print()` + CSS print media | High (browser renders) | Variable | Low (no new dep) |
| **PDF** | Headless Chromium (Puppeteer) | Highest | Large | High (server or local install) |
| **Video / GIF** | MediaRecorder + slide advance | Low–Medium | Large | Medium (browser API) |
| **Static site** | Copy HTML + assets to folder | Exact | Variable | Low |
| **Embed** | `<iframe src="...">` with share link | Exact | — | Requires hosting |

The zero-server invariant means headless Chromium and embed/share are non-trivial.
`window.print()` PDF works on `file://` with no extra dependencies.

---

## Decision (hypothesis)

**Proposed per format**:

| Format | Decision | Version target |
|---|---|---|
| PPTX | Keep (existing) | v1.0 |
| PDF via `window.print()` | Accept — zero dep, `file://` compatible | v1.1 |
| Video/GIF via MediaRecorder | Tentative — browser API, no server | v2.1 |
| Static site export | Accept — copy HTML + assets | v2.3 |
| Embed / share link | Deferred — requires hosting (ADR-028) | v3.x |
| PDF via headless Chromium | Rejected — breaks zero-server invariant | never |

---

## Open questions

1. What export format do users actually need most?
   → Interview archetypes specifically: "After you finish editing, what do you do with the deck?"
   → Expected: PDF for sharing > PPTX for collaboration > video for social
2. Is PPTX fidelity acceptable to users who receive the PPTX?
   → Layout approximation may block use in formal contexts (conferences, academic)
3. Does `window.print()` PDF produce acceptable output for Reveal.js decks?
   → Reveal.js has a `?print-pdf` URL parameter — integrate with that

---

## Prerequisites

- v1.0 GA + user feedback on PPTX export quality
- Interview evidence on which export formats are actually used

---

## Consequences

- If PDF via print accepted for v1.1: trivial implementation; test on reference decks
- If video accepted for v2.1: need capture loop + slide advance automation spec
- If embed accepted: becomes ADR-028 dependency chain

---

## Review trigger

After v1.0 GA: collect export usage patterns from telemetry (opt-in, ADR-020).
Which export do users trigger most? What complaints does PPTX export generate?

---

## Links

- [ADR-020-telemetry-and-feedback.md](ADR-020-telemetry-and-feedback.md)
- [ADR-026-import-pipeline.md](ADR-026-import-pipeline.md)
- [ADR-028-cloud-sync-opt-in.md](ADR-028-cloud-sync-opt-in.md)
