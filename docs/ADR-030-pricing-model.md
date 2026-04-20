# ADR-030 — Pricing Model

**Status**: proposed
**Date**: 2026-04-21
**Deciders**: sole engineer
**Supersedes**: —
**Applied-in**: not implemented; relevant from v1.0 GA onward (even if decision is "free forever")

---

## Context

The project has no monetization plan. This is acceptable through v1.0 GA.
Post-v1.0, the developer bears ongoing costs (time, potential infra) with zero revenue.

Four models are common for developer tools:

| Model | Revenue | Alignment | Complexity | Risk |
|---|---|---|---|---|
| **Free forever** | $0 direct | Perfect — no friction | Zero | Burnout / opportunity cost |
| **Freemium** | $5–20/user/month (power features) | Good if power features are clear | Medium | "Core features should be free" wars |
| **Open-core** | $0 open source + $$ hosted / enterprise | Good | High | Community fork if core too limited |
| **Sponsor / donation** | Variable, typically < $500/month at indie scale | Good | Low | Unreliable |

Financial Reality Check (see COMMITMENT-CHECK-2026-04.md) establishes the horizon.
This ADR answers: what is the monetization gate that converts usage into sustainability?

---

## Decision (hypothesis)

**Proposed**: Free forever for the core local editor. Optional paid tier for cloud features (if built, ADR-028).

Rationale:
- Local file:// editor with no server has zero hosting cost: $0 to serve
- "Free forever" is a competitive advantage against Gamma ($24/mo), Pitch ($8/mo), Tome ($20/mo)
- Any monetization must come from optional cloud/collaboration features (ADR-028, ADR-023)
- Sponsorship / GitHub Sponsors as a complementary track — low effort, honest ask

**Explicit position**: do NOT add a paywall to local editing features.
The file:// local editor is and will remain free, always.

**If cloud tier is built (v2.3+)**:
- Cloud relay / hosting = paid: $5–10/month or credits model
- This is the natural monetization event; users who want to publish pay for that capability

**Financial break-even calculation** (to fill in at Commitment Check):
- If cloud tier: N paying users × $8/month = break-even at N = (monthly_costs / $8)
- Sponsorship: $200–500/month is realistic at 500 active users with active sponsor ask

---

## Open questions

1. Are any archetypes willing to pay for the local editor itself?
   → Hypothesis: NO. "Free and local" is the pitch. Paywalling it contradicts it.
2. What cloud features would archetypes pay for?
   → Interview question: "If there were a hosted version with one-click sharing, what would you pay per month?"
3. Is there an enterprise tier? (teams, SSO, audit logs)
   → Not before v3.x; enterprise features require support bandwidth the solo developer doesn't have

---

## Prerequisites

- v1.0 GA with > 100 active users
- ADR-028 decision (whether cloud tier is built at all)
- Sponsor account set up on GitHub Sponsors or Open Collective

---

## Consequences

- If free-forever accepted: GitHub Sponsors as the only revenue; no code changes needed
- If freemium accepted: feature flag system needed to gate paid features
- If open-core accepted: enterprise fork codebase + support structure

---

## Review trigger

After v1.0 GA + 3 months: assess GitHub Stars, active user count, sponsor interest.
If > 500 users and 0 sponsors → take a more active monetization step.
If < 100 users → monetization is not the problem; distribution is.

---

## Links

- [COMMITMENT-CHECK-2026-04.md](../execution/COMMITMENT-CHECK-2026-04.md)
- [ADR-028-cloud-sync-opt-in.md](ADR-028-cloud-sync-opt-in.md)
- [docs/vision/TRACK-2-QUARTERLY-PLAN.md](../vision/TRACK-2-QUARTERLY-PLAN.md)
- [KILL-SWITCH-CONDITIONS.md](../execution/KILL-SWITCH-CONDITIONS.md) (§HS-03 financial buffer)
