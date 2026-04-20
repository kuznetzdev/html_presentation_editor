# Commitment Check — April 2026

> **Date**: 2026-04-21
> **Evaluator**: sole engineer (1 person)
> **Horizon**: ~24 months (v1.0 → v3.0)
> **Capacity assumed**: ~20 h/week (4 h/day × 5 days)

---

## Purpose

This document gates the start of Track-1 execution.
**Do not launch WO-01 until all five questions are answered honestly below.**

A GO decision here is a pre-commitment, not a guarantee. It means you accept
the kill-switch conditions in `KILL-SWITCH-CONDITIONS.md` as legitimate exits —
including D (abandon) — without treating them as failures.

---

## Five Questions

### Q1 — Capacity

> **~20 hours/week × 24 months without serious distraction — is this realistic?**

Answer: ___________

Guidance: "Serious distraction" = another full-time job, health crisis, family
emergency. Planned part-time consulting (< 8 h/week) is NOT disqualifying —
adjust velocity targets instead (see KILL-SWITCH-CONDITIONS.md §PERSIST).

---

### Q2 — Feature Drought Tolerance

> **3–6 months of security/refactor work (W1–W3) with zero visible new features — can I sustain motivation?**

Answer: ___________

Guidance: W1–W3 produce no user-visible features. Every merged WO is a
risk-reduction or architecture improvement. If "ship something the user sees"
is your primary motivator, you will abandon this window. The honest answer
here shapes whether to run W1–W3 serially or cut scope.

---

### Q3 — Customer Access

> **5–10 customer interviews in Q3 2026 — do I have access to potential users?**

Answer: ___________

Candidate pools: Reveal.js GitHub/Discord, YouTube dev streamers, Reddit
r/webdev + r/presentations, IndieHackers, academic Twitter.

Minimum viable access: **3 people** willing to do a 30-minute Zoom.
If access < 3 people, Track-2 interview protocol auto-pauses (see
TRACK-2-QUARTERLY-PLAN.md §Stop-conditions).

---

### Q4 — Financial Buffer

> **Financial buffer for 24 months without monetization — does it exist?**

Answer: ___________

Guidance: This is not a question about project profitability. It is a question
about whether financial pressure will force you to abandon the project at month
8 when you are closest to a release but furthest from revenue.

Minimum viable: 12 months of covered fixed costs. Below 12 months = GO with
condition (financial runway becomes R-73 in RISK-REGISTER.md).

---

### Q5 — D as Valid Outcome

> **I accept "abandon the project" as a valid, non-shameful outcome of any quarterly review.**

Answer: ___________

Guidance: This is not about pessimism. Projects that do not have a pre-committed
exit path accumulate sunk-cost decision-making. The quarterly checkpoints in
TRACK-1-QUARTERLY-PLAN.md include explicit D conditions. Signing off here means
you will honour them.

---

## Scoring

| Score | Decision | Action |
|---|---|---|
| 5 × YES | **GO** | Launch WO-01 agent within 14 days |
| 3–4 × YES | **GO with conditions** | Document failing items as R-73+ in RISK-REGISTER.md, then proceed |
| ≤ 2 × YES | **STOP** | Return to this document after 2 weeks of honest reflection |

## Result

**Date evaluated**: ___________
**Score**: ___ / 5
**Decision**: ___________

Conditions recorded (if GO with conditions):
- Condition 1: ___________
- Condition 2: ___________

Reviewer signature (your name or handle): ___________

---

## Links

- [KILL-SWITCH-CONDITIONS.md](KILL-SWITCH-CONDITIONS.md)
- [TRACK-1-QUARTERLY-PLAN.md](TRACK-1-QUARTERLY-PLAN.md)
- [TRACK-2-QUARTERLY-PLAN.md](../vision/TRACK-2-QUARTERLY-PLAN.md)
- [docs/work-orders/RISK-REGISTER.md](../work-orders/RISK-REGISTER.md)
