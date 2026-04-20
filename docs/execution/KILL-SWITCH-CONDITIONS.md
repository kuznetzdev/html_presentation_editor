# Kill-Switch Conditions

> **Version**: 1.0
> **Created**: 2026-04-21
> **Review schedule**: update at every quarterly checkpoint (QR-YYYY-Q<n>.md)
> **Scope**: html-presentation-editor, v0.25.0 → v3.0 horizon

These conditions are **pre-committed** — agreed before any WO is merged.
They are not negotiable in the heat of the moment. Quarterly checkpoint is the
only place to revise them (and that revision must itself be documented).

---

## HARD STOP
*Immediate cessation. No re-plan. No re-entry.*

| # | Condition | Measurement |
|---|-----------|-------------|
| HS-01 | Health / family crisis requiring full attention for ≥ 2 months | Subjective — you know when |
| HS-02 | Competitor ships a file:// local HTML editor with our UX angle (WYSIWYG, zero install) | Observed in public changelog or Product Hunt |
| HS-03 | Financial buffer drops below 6 months of fixed costs | Bank statement / budget tracker |
| HS-04 | Major life change consuming all discretionary time (new full-time job, child, relocation) | Subjective — you know when |

On HS trigger: archive the repo with a clear `ARCHIVED.md`, no shame, no rush finish.

---

## SOFT STOP
*Pause work 1 month. Diagnose. Re-evaluate. Either resume with plan or escalate to HARD STOP.*

| # | Condition | Measurement |
|---|-----------|-------------|
| SS-01 | Burnout signals sustained ≥ 14 days: sleep < 6 h/night, persistent irritability, loss of curiosity about the project | Self-assessed nightly, confirmed over 14-day window |
| SS-02 | Track-1 velocity: < 1 WO merged/week for 4 consecutive weeks (not 2 — allow short slumps) | WEEKLY-YYYY-wNN.md cumulative row |
| SS-03 | 3+ failed customer interviews in a row ("nobody cares" signal) | INTERVIEWS log in docs/vision/INTERVIEWS-2026-Q3/ |
| SS-04 | Gate-A broken and unresolved for > 7 calendar days | `npm run test:gate-a` output + git log |
| SS-05 | v1.0 GA forecast drifts > 3 months from plan two consecutive quarters | TRACK-1 velocity calculator |

On SS trigger: stop WO execution, create `QR-YYYY-Qn-PAUSE.md`, spend 1 month on:
- Root cause analysis
- Scope reduction options
- Honest capacity re-assessment
Then either resume with adjusted plan or trigger HARD STOP.

---

## PIVOT
*Do not stop. Reconsider scope, audience, or angle. Continue executing while pivoting.*

| # | Condition | Measurement |
|---|-----------|-------------|
| P-01 | Interview evidence shows primary archetype is too narrow (< 5 people total who match) | 8+ interviews completed, archetype score < 3/10 for "technical creator" |
| P-02 | Competitive space contracts faster than we advance (2+ competitors matching our angle in 1 quarter) | COMPETITIVE-THREATS quarterly aggregate |
| P-03 | Browser platform change breaks file:// workflow fundamentally (Chrome deprecates feature we depend on) | MDN deprecation notices + caniuse tracking |
| P-04 | A single feature generates 10× more interest than all others combined (pivot to that feature as standalone) | Interview notes + GitHub issues if open-sourced |

On PIVOT trigger: do NOT stop execution. Create `ADR-NNN-pivot-rationale.md`. Adjust
TRACK-2 archetype model. Continue W-series execution unless PIVOT requires architectural
changes (those need their own ADR before implementation changes).

---

## PERSIST
*These are NOT stop conditions, even if they feel bad.*

| # | Condition | Why PERSIST |
|---|-----------|-------------|
| PE-01 | Revenue validation slow | Normal until ≥ 18 months post-v1.0 GA; do not optimize for revenue before users exist |
| PE-02 | Velocity 15 h/week instead of 20 h/week (−25%) | Within tolerance; adjust forecast, not strategy |
| PE-03 | One quarterly checkpoint has 1 RED item | Expected; 1 red = GO with adjustments, not STOP |
| PE-04 | Not all capabilities ship per planned minor version | Slip within minor is acceptable; slip across major version is SS-02 territory |
| PE-05 | Track-2 interview acquisition hard | < 3 interviews in 8 weeks = Track-2 auto-pause, NOT project pause |
| PE-06 | External criticism of the project's feasibility | Irrelevant until you have real usage data |
| PE-07 | AI agents produce output that requires significant rework | Expected; rework time is in the velocity estimate |

---

## Quarterly review update protocol

At every quarterly checkpoint (`QR-YYYY-Qn.md`):
1. Review all HARD STOP conditions — have any triggered?
2. Review SOFT STOP conditions — has any been active > 14 days?
3. Update thresholds if life circumstances have changed materially
4. Sign off ("reviewed and confirmed" with date)

Do NOT modify kill-switch conditions between quarterly checkpoints.
Ad-hoc modifications under stress are how projects fail to honour their own exits.

---

## Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-04-21 | Initial commit — pre-WO-01 |

## Links

- [COMMITMENT-CHECK-2026-04.md](COMMITMENT-CHECK-2026-04.md)
- [TRACK-1-QUARTERLY-PLAN.md](TRACK-1-QUARTERLY-PLAN.md)
- [docs/work-orders/RISK-REGISTER.md](../work-orders/RISK-REGISTER.md)
