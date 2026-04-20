# Quarterly Review — QR-YYYY-Q<n>

> Template. Copy to `QR-YYYY-Qn.md` at the last Monday of each quarter.
> Complete before starting next quarter's execution.

---

## Review metadata
```
quarter: Q<n> YYYY
review_date: YYYY-MM-DD
reviewer: sole engineer
time_spent_on_review: <N hours>
```

---

## Track-1 health

| Check | Status | Evidence |
|---|---|---|
| All planned windows closed (or accounted for)? | 🟢/🟡/🔴 | <link to weekly trackers> |
| Slip ≤ 2 weeks (not 2 months)? | 🟢/🟡/🔴 | <forecast date> |
| Gate-A green last 4 consecutive merges? | 🟢/🟡/🔴 | `git log --oneline -4` |
| Reference decks (prepodovai + selectios) green? | 🟢/🟡/🔴 | last test run output |
| AUDIT-A re-run: tech-debt not growing? | 🟢/🟡/🔴 | spot-check or full re-run |

Track-1 health: 🟢 GO / 🟡 GO with adjustments / 🔴 PAUSE

---

## Track-2 health

| Check | Status | Evidence |
|---|---|---|
| Weekly competitor digests filed (target: 13/quarter)? | 🟢/🟡/🔴 | count in COMPETITORS-WEEKLY/ |
| Interviews target met (5–10)? | 🟢/🟡/🔴 | count in INTERVIEWS/ |
| Archetype evidence accumulated? | 🟢/🟡/🔴 | USER-ARCHETYPES-vN.md exists |
| Competitive threat level stable or decreasing? | 🟢/🟡/🔴 | COMPETITIVE-THREATS quarterly |
| Track-2 hours ≤ 4/week average? | 🟢/🟡/🔴 | weekly tracker totals |

Track-2 health: 🟢 GO / 🟡 GO with adjustments / 🔴 PAUSE

---

## Cross-track check

| Check | Status | Notes |
|---|---|---|
| Track-1 slip not invalidating Track-2 relevance? | 🟢/🟡/🔴 | |
| Gamma/Pitch/Tome did NOT ship our core angle this quarter? | 🟢/🟡/🔴 | |
| No burnout signals (sleep, mood, energy)? | 🟢/🟡/🔴 | |
| Family / health / finance buffer still adequate? | 🟢/🟡/🔴 | |
| Kill-switch conditions reviewed and none triggered? | 🟢/🟡/🔴 | see KILL-SWITCH-CONDITIONS.md |

---

## Decision

Count red items: ___

| Red count | Decision | Action |
|---|---|---|
| 0–1 | 🟢 GO | Continue per plan |
| 2 | 🟡 GO with adjustments | Re-plan next quarter (document changes below) |
| 3 | 🟠 PAUSE 1 week | Root-cause + re-plan; return to this doc |
| 4+ | 🔴 STOP | Return to COMMITMENT-CHECK-YYYY-MM.md |

**This quarter's decision**: ___________

---

## Next quarter plan adjustments (if any)

<none | changes to TRACK-1-QUARTERLY-PLAN.md>

---

## Kill-switch conditions review

```
HARD STOP conditions reviewed: YES / NO
SOFT STOP conditions reviewed: YES / NO
Any triggered: YES / NO
  if YES: which: ___________
Updated KILL-SWITCH-CONDITIONS.md version: ___
```

---

## Micro-wins this quarter (non-optional)

List 3–5 things that shipped or unblocked, no matter how small:
1. ___________
2. ___________
3. ___________

---

## One sentence for the future self reading this in 6 months

<write something honest here>

---

## Links

- [TRACK-1-QUARTERLY-PLAN.md](TRACK-1-QUARTERLY-PLAN.md)
- [KILL-SWITCH-CONDITIONS.md](KILL-SWITCH-CONDITIONS.md)
- [docs/vision/TRACK-2-QUARTERLY-PLAN.md](../vision/TRACK-2-QUARTERLY-PLAN.md)
