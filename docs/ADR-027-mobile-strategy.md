# ADR-027 — Mobile Strategy

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: WO-33 ships "tablet honest-block" posture at v1.0 (review-only on touch)
**Extends**: ADR-018-mobile-touch-strategy.md

---

## Context

ADR-018 defines the v1.0 mobile posture: "review-only" on narrow/touch viewports.
WO-33 implements this as a clear banner with a non-blocking explanation.

Post-v1.0, the question is how far to extend mobile support:

| Tier | What it means | Effort | ADR-018 alignment |
|---|---|---|---|
| **Review-only** (current v1.0) | Read slides, navigate, no editing | Done (WO-33) | Yes |
| **Lite-edit** | Edit text content only; no drag/resize | High | Extension |
| **Full-parity** | Complete editing on touch | Very high | Separate product |

The target archetypes (Technical Educator, Developer) primarily work on desktop.
Mobile editing is a power-user scenario, not a primary workflow.

---

## Decision (hypothesis)

**Proposed**: Lite-edit tier for v2.x mobile, full-parity deferred to separate product (v3.x or never).

Rationale:
- Review-only is the correct default: editing complex HTML on a phone is ergonomically broken
- Lite-edit (text-only on tablet) covers real use: "I'm presenting on my iPad and need to fix a typo"
- Full-parity on touch requires a complete redesign of selection, drag handles, and inspector
- Separate product (native app) may be better than trying to retrofit the web editor

**Hard line**: do NOT add touch-specific code that degrades the desktop experience.
All mobile features must be gated by `isCompactViewport()` or `isTouchDevice()`.

---

## Open questions

1. Do any interviewees want to edit on mobile?
   → Interview question: "Have you ever needed to fix a slide from your phone?"
2. Is tablet with keyboard (iPad + Smart Keyboard) a supported target?
   → These users have pointer + keyboard; they behave like desktop
3. What is the most common mobile scenario?
   → Hypothesis: presenter uses phone as remote control + wants last-minute text fix

---

## Prerequisites

- WO-33 shipped (v1.0 tablet honest-block)
- Interview evidence on mobile usage patterns
- Decision on target archetype device profile

---

## Consequences

- If lite-edit accepted: touch-target audit + text-edit only mode on narrow viewport
- If full-parity accepted: major redesign; likely a separate codebase
- If review-only permanent: honest mobile banner stays; no mobile editing ever

---

## Review trigger

After v1.0 GA: check telemetry (opt-in) for viewport distribution of users.
If > 20% are on < 820px width: mobile editing becomes higher priority.

---

## Links

- [ADR-018-mobile-touch-strategy.md](ADR-018-mobile-touch-strategy.md)
- [docs/work-orders/W7/WO-33-tablet-mobile-honest-block.md](work-orders/W7/WO-33-tablet-mobile-honest-block.md)
