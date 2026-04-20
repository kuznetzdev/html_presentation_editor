# ADR-026 — Import Pipeline Fidelity

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: PPTX→HTML import is out-of-scope for v1.0; relevant for v2.0+

---

## Context

v1.0 exports HTML→PPTX. The reverse (PPTX→HTML) is a common user request.
Three fidelity targets are in tension:

| Target | What it means | Complexity | Use case |
|---|---|---|---|
| **Pixel-perfect** | Every visual element in exact position | Very high | Sales decks, brand decks |
| **Semantic** | Text, images, structure preserved; layout approximate | High | Academic, educational decks |
| **Lossy / MVP** | Text content only; layout manual re-apply | Low | "Get my content into HTML" |

PPTX is a complex format (XML + binary assets + embedding rules). Pixel-perfect reproduction
requires either a server-side renderer or a very large client-side parser.

Additionally, the existing HTML import pipeline (`import.js`) handles arbitrary HTML decks.
The question is whether PPTX→HTML import should:
- Join the existing `import.js` pipeline (same model document)
- Create a separate import path

---

## Decision (hypothesis)

**Proposed**: Semantic fidelity target for v2.0, lossy/MVP for v1.x (if added at all).

Rationale:
- Pixel-perfect requires server-side tools (LibreOffice, Aspose) → breaks zero-server
- Semantic covers ≥ 80% of actual use: get text + images + slide structure into HTML
- Lossy/MVP is buildable as v1.1 add-on with `pptxgenjs` reverse parsing

**Library evaluation needed**:
- `pptx2html` (npm): client-side, last updated 2021, unmaintained risk
- Custom parser over `jszip` + XML parsing: more work, more control
- Server-side (Pandoc, LibreOffice): breaks invariant

---

## Open questions

1. Do archetypes actually need PPTX→HTML import?
   → vs. "I have a PPTX, I want to edit it" (different need — may be satisfied by Google Slides export)
   → Interview question: "Do you ever start from a PPTX someone else made?"
2. Is round-trip fidelity (HTML→PPTX→HTML) a real workflow?
   → If yes: every PPTX export failure is a data loss event
3. What is the minimum viable import?
   → Hypothesis: text + images + slide boundaries (no animation, no charts)

---

## Prerequisites

- v1.0 GA + evidence that users need PPTX→HTML import
- Library evaluation: client-side pptx parser quality check
- ADR-025 PPTX export fidelity gap established (need to know the gap before defining round-trip)

---

## Consequences

- If semantic import accepted for v2.0: new `importer-pptx.js` module; separate from `import.js`
- If deferred: link from documentation to "use Google Slides → HTML" workaround

---

## Review trigger

After v1.0 GA: survey users specifically on PPTX import need.
"Do you have PPTX files you'd want to open in this editor?" is the key question.

---

## Links

- [ADR-025-export-diversity.md](ADR-025-export-diversity.md)
- [docs/work-orders/W1/WO-03-pptxgenjs-sri.md](work-orders/W1/WO-03-pptxgenjs-sri.md)
