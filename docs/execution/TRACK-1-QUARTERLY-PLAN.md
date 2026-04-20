# Track-1 Quarterly Execution Plan — v0.25.0 → v1.0.0

> **Created**: 2026-04-21 · **Baseline**: v0.25.0, Gate-A 55/5/0
> **Capacity**: 1 engineer × ~20 h/week (4 h/day × 5 days)
> **AI agents**: Claude sub-agents in git worktrees (parallel lanes)
> **Invariants**: zero-build (ADR-015), file:// first, reference decks green before every merge

---

## How to read this plan

- **WO = Work Order** from `docs/work-orders/INDEX.md`
- **Lane** = agent responsible (B/C/D from `AGENT-WORKLOAD.md`)
- **Gate** = which `npm run test:gate-*` must pass before merge
- **Effort** = S (<1 day) / M (1-3 days) / L (1-2 weeks) as per WO header
- **Version** follows `docs/EXECUTION_PLAN_v0.26-v1.0.md` version table
- Dates are targets, not commitments. Velocity tracker in weekly files overrides.

**Pre-condition**: COMMITMENT-CHECK-2026-04.md signed with score ≥ 3/5 before W1 launch.

---

## Q3 2026 — Foundation Security (Jul 1 – Sep 30)

### Target
All of W1 merged. W2 and W3 in progress. w3-complete tag by Sep 30.

### W1 — v0.26.x Security Quick Wins

Target start: **by 2026-05-05** (14-day launch window from 2026-04-21).
Target complete: **2026-07-10** (allows buffer for review rounds).

| Cal-week | WO | Version | Lane | Effort | Gate | Depends |
|---|---|---|---|---|---|---|
| W18 (Apr 28) | **WO-01** parseSingleRoot sanitize | v0.26.1 | B | S | gate-a | — |
| W19 (May 5) | **WO-03** pptxgenjs SRI ‖ **WO-05** crypto token | v0.26.2 ‖ v0.26.3 | C ‖ D | S ‖ S | gate-a | — |
| W20 (May 12) | **WO-02** bridge origin assert | v0.26.4 | D | S | gate-a | after WO-01 |
| W21 (May 19) | **WO-04** session-storage cap | v0.26.5 | D | S | gate-a | after WO-02 |
| W21 end | **w1-complete** tag | v0.26.5 | — | — | gate-a ✓ | all W1 merged |

Parallel track (optional, same window):
- v0.26.0 precision editing (ADR-004 first touch) can run in Agent A lane
  concurrently with WO-01. If it slips, fold into WO-28 at W6.

**Kill signal for W1**: if WO-01 is not merged by 2026-06-01, re-plan W1 timeline.
**Velocity check**: 5 WOs in ~4 weeks = 1.25 WO/week. Acceptable.

---

### W2 — v0.27.x Sandbox + Trust + A11y

Target: **2026-07-10 → 2026-08-21**

| Cal-week | WO | Version | Lane | Effort | Gate | Depends |
|---|---|---|---|---|---|---|
| W28 (Jul 6) | **WO-06** broken-asset + sandbox audit | v0.27.0 | D | M | gate-a | — |
| W29 (Jul 13) | **WO-07** trust-banner script detect | v0.27.1 | D | M | gate-a | after WO-06 |
| W29 | **WO-08** bridge contract scaffold | v0.27.2 | D | M | gate-a | after WO-01 |
| W30 (Jul 20) | **WO-09** a11y axe gate | v0.27.3 | B | M | gate-a11y (NEW) | — |
| W31 (Jul 27) | **WO-10** keyboard nav completeness | v0.27.4 | B | L | gate-a11y | after WO-09 |
| W32 (Aug 3) | **WO-11** contrast spec | v0.27.5 | B | S | gate-a11y | after WO-09 |
| W33 end | **w2-complete** tag | v0.27.5 | — | — | gate-a + gate-a11y ✓ | all W2 merged |

**Key milestone**: first `test:gate-a11y` (0 violations) introduced at v0.27.3.

---

### W3 — v0.28.x Bridge v2 + Types + Store scaffold

Target: **2026-08-24 → 2026-09-26** (w3-complete by Sep 26)

| Cal-week | WO | Version | Lane | Effort | Gate | Depends |
|---|---|---|---|---|---|---|
| W34 (Aug 24) | **WO-12** bridge v2 hello handshake | v0.28.0 | B | M | gate-a | after WO-01, WO-08 |
| W35 (Aug 31) | **WO-13** bridge v2 schema validation | v0.28.1 | B | L | gate-contract (NEW) | after WO-12 |
| W35 | **WO-14** types bootstrap (tsconfig + JSDoc) | v0.28.2 | B | M | gate-types (opt) | — |
| W36 (Sep 7) | **WO-15** telemetry scaffold | v0.28.3 | B | M | gate-a | — |
| W36 | **WO-16** store scaffold + ui slice | v0.28.4 | C | M | gate-a | — |
| W37 (Sep 14) | **WO-17** selection slice migration | v0.28.5 | C | M | gate-a | after WO-16 |
| W39 end (Sep 26) | **w3-complete** tag | v0.28.5 | — | — | gate-a + gate-contract ✓ | all W3 merged |

**Q3 checkpoint**: 2026-09-28 (last Monday of Q3). Run QR-2026-Q3.md.

---

## Q4 2026 — Refactor & UX (Oct 1 – Dec 31)

### Target
W4 merged. W5 and W6 in progress. Honest: December is low-velocity (holidays/burnout).
Do NOT plan w6-complete for Dec 31.

### W4 — v0.29-0.30.x Store Migration + Module Splits + History

Target: **2026-10-05 → 2026-11-13**

| Cal-week | WO | Version | Lane | Effort | Gate | Depends |
|---|---|---|---|---|---|---|
| W41 (Oct 5) | **WO-18** history patch-based | v0.29.0 | C | L | gate-a | after WO-13, WO-16, WO-17 |
| W42 (Oct 12) | **WO-19** RAF-coalesced render | v0.29.1 | C | M | gate-a | after WO-16 |
| W43 (Oct 19) | **WO-20** split selection → layers-panel | v0.30.0 | C | M | gate-a | — |
| W44 (Oct 26) | **WO-21** split selection → floating-toolbar | v0.30.1 | C | M | gate-a | after WO-20 |
| W45 (Nov 2) | **WO-22** boot.js split | v0.30.2 | C | L | gate-a | after WO-21 |
| W46 (Nov 9) | **WO-23** feedback.js split | v0.30.3 | C | M | gate-a | after WO-22 |
| W46 end | **w4-complete** tag | v0.30.3 | — | — | gate-a ✓ | all W4 merged |

---

### W5 — v0.27.2-equivalent UX Dead-Ends

Target: **2026-11-16 → 2026-12-05**

| Cal-week | WO | Version | Lane | Effort | Gate | Depends |
|---|---|---|---|---|---|---|
| W47 (Nov 16) | **WO-24** broken-asset recovery banner | v0.31.0 | D | M | gate-a | — |
| W47 | **WO-25** starter-deck CTA rehome | v0.31.1 | D | S | gate-a | — |
| W48 (Nov 23) | **WO-26** transform resolve banner | v0.31.2 | D | S | gate-a | — |
| W49 (Nov 30) | **WO-27** undo-chain chip + toast | v0.31.3 | D | S | gate-a | — |
| W49 end | **w5-complete** tag | v0.31.3 | — | — | gate-a ✓ | all W5 merged |

---

### W6 — v0.31.x Precision + Tokens + Banners

Target: **2026-12-07 → 2026-12-19** (tight — December buffer is real)

| Cal-week | WO | Version | Lane | Effort | Gate | Depends |
|---|---|---|---|---|---|---|
| W50 (Dec 7) | **WO-28** snap-to-siblings + smart guides | v0.32.0 | D | L | gate-a | after WO-22 |
| W50 | **WO-29** banner unification | v0.32.1 | D | M | gate-a | after WO-07, WO-24 |
| W51 (Dec 14) | **WO-30** design tokens v2 semantic layer | v0.32.2 | D | L | gate-a + gate-visual | — |
| W51 | **WO-31** shift-click multi-select resolve | v0.32.3 | D | S | gate-a | — |

> **December slack**: W6 may slip to first 2 weeks of January 2027. This is expected and
> does NOT trigger SS-02. The kill condition activates only after 4 consecutive weeks below
> 1 WO/week, adjusted for holiday period.

**Q4 checkpoint**: 2026-12-28. Run QR-2026-Q4.md.

---

## Q1 2027 — Polish & Release (Jan 1 – Mar 31)

### Target
All WOs 28-38 merged. v1.0.0 GA shipped by March 31.

### W6 completion (if slipped from Q4)

If WO-28..31 didn't close in Q4: first 2 weeks of January.
- w6-complete tag: 2027-01-10 at latest

### W7 — v0.33-0.34.x Visual Gate + Mobile + Telemetry + Plugin L1

Target: **2027-01-12 → 2027-02-06**

| Cal-week | WO | Version | Lane | Effort | Gate | Depends |
|---|---|---|---|---|---|---|
| W3 (Jan 12) | **WO-32** visual regression gate | v0.33.0 | A | M | gate-visual (NEW) | after WO-30 |
| W3 | **WO-33** tablet honest-block | v0.33.1 | B | M | gate-d (expanded) | — |
| W4 (Jan 19) | **WO-34** telemetry viewer + export log | v0.33.2 | C | M | gate-a | after WO-15 |
| W5 (Jan 26) | **WO-35** plugin L1 entity-kind registry | v0.33.3 | D | M | gate-a | — |
| W6 end (Feb 6) | **w7-complete** tag | v0.33.3 | — | — | gate-a + gate-visual ✓ | all W7 merged |

---

### W8 — v0.35-0.37.x Flake + Shortcuts + RC Freeze

Target: **2027-02-09 → 2027-03-07**

| Cal-week | WO | Version | Lane | Effort | Gate | Depends |
|---|---|---|---|---|---|---|
| W7 (Feb 9) | **WO-36** flake elimination | v0.35.0 | A | L | gate-a (0 waitForTimeout) | after WO-13 |
| W8 (Feb 16) | **WO-37** declarative shortcuts table | v0.36.0 | B | M | gate-a | — |
| W9 (Feb 23) | **WO-38** v1.0 RC freeze | v0.37.0-rc.1 | E | M | gate-f (full matrix) | all WO merged |
| W9 end | **v1.0.0-rc.1** tag | v0.37.0-rc.1 | — | — | ALL gates green | — |

### RC validation window (March 2027)

| Week | Activity |
|---|---|
| W10 (Mar 2) | RC validation: reference decks end-to-end, real user testing (2-3 people) |
| W11 (Mar 9) | Bug triage: P0 only. Non-P0 → deferred to v1.0.1 |
| W12 (Mar 16) | Final gate-f run + release prep (CHANGELOG, README, Product Hunt draft) |
| W13 (Mar 23) | **v1.0.0 GA** — tag + push + Product Hunt + HN post |
| Post-release | 48h monitoring — no new features, bugfix only |

**Q1 checkpoint**: 2027-03-29 (post-release). Run QR-2027-Q1.md.

---

## Q2 2027 — v1.x Stabilization + v2.0 Kickoff (Apr 1 – Jun 30)

| Week | Activity | Version |
|---|---|---|
| W14-17 (Apr) | v1.0.1 bugfix cycle (50+ user reports expected) | v1.0.1 |
| W18-21 (May) | v1.0.2 performance tier-2 (200+ slide decks) | v1.0.2 |
| W22-24 (Jun) | v2.0 planning: first 5 WOs for composition platform (blocks + templates) | — |

**v2.0 kickoff pre-conditions** (all must be true before v2.0 WO authoring):
1. v1.0.1 shipped with < 5 open P0 bugs
2. ≥ 10 customer interviews completed (Track-2)
3. USER-ARCHETYPES-v2.md written and validated
4. ADR-021..030 status updated from `proposed` to `accepted` or `rejected`

**Q2 checkpoint**: 2027-06-28. Run QR-2027-Q2.md.

---

## Velocity tracker

Update every Sunday (30 min):

```
docs/execution/WEEKLY-YYYY-wNN.md template:
---
week: YYYY-wNN
dates: YYYY-MM-DD to YYYY-MM-DD
target_wos: N
actual_wos_merged: M
blockers: <list or "none">
velocity_ratio: M/N
cumulative_wos: <sum since Q start>
cumulative_planned: <planned sum since Q start>
forecast_v1_ga: YYYY-MM-DD (at current velocity)
---
```

**Kill signal**: if `forecast_v1_ga` slips > 3 months from 2027-03-23 for two consecutive quarters → SS-02 applies.

---

## Q3 2027 – Q2 2028 — v2.x Composition Platform

See `docs/vision/TRACK-2-QUARTERLY-PLAN.md` §v2.x for pre-planning.
38 new WOs will be authored after v1.0 GA + 60 days real usage + ADR-021..030 evidence review.

---

## Invariants (enforced before every merge)

```
□ Gate-A: npm run test:gate-a → 55/5/0
□ Reference decks (prepodovai + selectios) render correctly
□ No type="module" added (ADR-015)
□ No bundler dependency added
□ git diff --staged reviewed by human engineer
□ CHANGELOG.md entry added for every version bump
```

---

## Links

- [docs/work-orders/INDEX.md](../work-orders/INDEX.md)
- [docs/work-orders/DEPENDENCY-GRAPH.md](../work-orders/DEPENDENCY-GRAPH.md)
- [docs/work-orders/GATE-TIMELINE.md](../work-orders/GATE-TIMELINE.md)
- [docs/work-orders/RISK-REGISTER.md](../work-orders/RISK-REGISTER.md)
- [docs/work-orders/AGENT-WORKLOAD.md](../work-orders/AGENT-WORKLOAD.md)
- [KILL-SWITCH-CONDITIONS.md](KILL-SWITCH-CONDITIONS.md)
- [COMMITMENT-CHECK-2026-04.md](COMMITMENT-CHECK-2026-04.md)
- [docs/EXECUTION_PLAN_v0.26-v1.0.md](../EXECUTION_PLAN_v0.26-v1.0.md)
