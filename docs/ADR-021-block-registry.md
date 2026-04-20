# ADR-021 — Block Registry L2

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: not yet implemented

---

## Context

v1.0 ships with a fixed set of entity kinds defined in `entity-kinds.js` (WO-35, ADR-016 L1).
v2.0 requires users to compose presentations from reusable, parameterized blocks.
A block is a self-contained HTML fragment with a typed parameter contract (e.g., title, body, image src).

The open question is the **authoring format** for block definitions:
- **JSON schema**: declarative, easy to validate, toolable, but verbose for complex blocks
- **Custom DSL**: more ergonomic for humans, requires a parser, harder to validate statically
- **HTML + data attributes**: zero new format, consistent with existing element model, but limited

The second open question is **parameterization model**:
- Static slots (fill a placeholder)
- Reactive binding (data source → slot, see ADR-026)
- Both (two-tier block model)

---

## Decision (hypothesis — not final until v1.0 GA + evidence review)

**Proposed**: JSON schema for block definitions, static slots only at L2.

Rationale:
- Consistent with existing JSDoc + TypeScript approach (ADR-011)
- Validates without a parser
- Toolable: block explorer, linter, registry viewer
- Static slots cover ≥ 80% of use cases for v2.0 archetypes (hypothesis — needs validation)

Reactive binding deferred to L3 (v2.1+, dependent on ADR-026 data binding decision).

---

## Open questions (to resolve with customer evidence)

1. Do power users want to *author* block definitions, or only *use* existing ones?
   → If only use: simpler template system (ADR-022) may be sufficient
2. What is the smallest useful block that real users need?
   → Answer from interviews: what building block did they wish they had?
3. Is JSON schema ergonomic enough for non-developers?
   → If archetypes skew technical (Technical Educator, Open-Source Hoarder): yes
   → If archetypes include less-technical users: DSL or GUI builder required

---

## Prerequisites

- ADR-016 (Plugin L1) accepted and shipped (WO-35)
- USER-ARCHETYPES-v2.md validated (≥ 1 archetype with ≥ 5 interviews)
- ADR-022 (Template marketplace) drafted in context

---

## Consequences

- If accepted: `editor/src/block-registry.js` introduced as new module; plugin L2 interface defined
- If rejected (DSL preferred): DSL parser needed; new ADR required
- If deferred (templates sufficient): ADR-022 absorbs the scope; ADR-021 archived

---

## Review trigger

Transition to `accepted` or `rejected` after:
- v1.0 GA + 60 days
- ≥ 3 user interviews specifically about block/template authoring

---

## Links

- [ADR-016-plugin-extension-architecture.md](ADR-016-plugin-extension-architecture.md)
- [ADR-022-template-marketplace.md](ADR-022-template-marketplace.md)
- [docs/vision/USER-ARCHETYPES-v1.md](vision/USER-ARCHETYPES-v1.md) (when created)
