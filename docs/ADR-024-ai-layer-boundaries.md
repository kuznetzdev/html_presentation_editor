# ADR-024 — AI Layer Boundaries

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: not yet implemented

---

## Context

v2.2 hypothesis: AI assistance (outline generation, text rewrite, image suggestion).
The core question is WHERE the AI runs and WHO pays for it.

Three options:

| Option | Privacy | Cost to user | Cost to developer | Latency | Complexity |
|---|---|---|---|---|---|
| **Local LLM (wasm / Transformers.js)** | Best — data stays on device | Zero | Zero | High (large model load) | Medium |
| **Cloud API (developer-hosted)** | Data leaves device | Zero for user | Per-token (ongoing) | Low | Low |
| **User BYOK (bring-your-own-key)** | Data sent to user's own API | User pays | Zero | Low | Medium |

The `file://` ethos and zero-server invariant create a strong preference for local or BYOK.
A developer-hosted cloud API creates an ongoing operational cost and a privacy liability.

---

## Decision (hypothesis)

**Proposed**: User BYOK for v2.2, local wasm LLM as optional enhancement.

Rationale:
- BYOK is consistent with "user owns everything" philosophy
- Zero ongoing cost for developer
- Users who care about privacy can use local model
- Users who want convenience use their existing OpenAI/Anthropic key
- No dependency on developer-operated server

Local model (wasm): optional progressive enhancement. Requires Transformers.js or similar.
Gate: local model must not degrade load time by > 2s on M1/equivalent.

**Hard line**: developer-operated cloud API that bills per-user is NOT acceptable for v2.x
without a corresponding pricing model (ADR-030). Do not build what you can't afford to operate.

---

## Open questions

1. Do our archetypes have existing API keys?
   → Technical Educator: likely (uses AI tools already)
   → Open-Source Hoarder: likely prefers local model
   → Less technical user: no key, no idea what an API key is → BYOK blocks them
2. Which AI tasks actually need LLM vs. simpler heuristics?
   → Outline from title: regex pattern might be sufficient
   → Rewrite selected text: definitely needs LLM
   → Image suggestion: CLIP embedding match is sufficient (no LLM)
3. What is the minimal useful AI feature?
   → Hypothesis: "Rewrite this paragraph in a more concise style" with user's own key

---

## Prerequisites

- v1.0 GA + 60 days real usage
- ADR-030 (pricing model) at least proposed — AI features may require monetization gate
- USER-ARCHETYPES-v2.md showing AI interest from ≥ 3 interviews

---

## Consequences

- If BYOK accepted: API key input UI + validation + encrypted local storage
- If local-only accepted: Transformers.js integration; bundle size concern
- If deferred: AI features removed from v2.2 scope; v2.2 becomes data-only milestone

---

## Review trigger

After v1.0 GA: interview archetypes specifically about AI. Do they want it?
Which tasks? Would they share API key with a tool they trust?

---

## Links

- [ADR-015-module-bundling-decision.md](ADR-015-module-bundling-decision.md) (zero-build constraint applies to AI too)
- [ADR-030-pricing-model.md](ADR-030-pricing-model.md)
- [docs/vision/TRACK-2-QUARTERLY-PLAN.md](vision/TRACK-2-QUARTERLY-PLAN.md)
