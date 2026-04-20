# Agent workload — Agents A/B/C/D/E × Windows W1..W8

> Execution-phase implementer allocation per window.
> Derived from each WO's `Agent-lane:` line.
> Generated at 2026-04-20. Re-run after any WO edit.

## Note on labels

Two different A-E enumerations exist in this project:

- **Planning-phase authors**: Agents α, β, γ, δ, ε (Greek letters) — produced PAIN-MAP, ADRs, WO files.
- **Execution-phase implementers**: Agents A, B, C, D, E (Latin letters) — implement each WO per the `Agent-lane:` field in its header.

This file uses the **execution-phase** labels. Mapping from EXECUTION_PLAN §"Parallel execution windows" per window:

| Window | A | B | C | D | E |
|---|---|---|---|---|---|
| W1 | v0.26.0 precision | P0-02 sanitize | P0-03 SRI | P1-13/15 | integration |
| W2 | P0-04 + P0-15 | ADR-006 a11y | P1-01 banner | P0-08 rail | integration |
| W3 | P0-06 + P0-07 | ADR-007 visual | ADR-011 types | ADR-020 telemetry | integration |
| W4 | ADR-014 shellBanner | ADR-014 Trust-Banner | ADR-012 hello | ADR-012 validators | contract tests |
| W5 | store.js + ui slice | selection slice + shim | history slice patches | render coalesce | integration + unit |
| W6 | selection split | boot split | feedback split | tokens Layer-2 | integration |
| W7 | entity-kinds (L1) | tablet honest-block | telemetry full + contract | — | integration |
| W8 | flake cleanup | shortcuts + feature-flag | RC freeze | — | — |

The per-WO `Agent-lane:` in each WO body is the authoritative owner.

## Allocation matrix (WOs per cell)

| Window | Agent A | Agent B | Agent C | Agent D | Agent E | Row total |
|---|---|---|---|---|---|---|
| W1 | — | WO-01 | WO-03 | WO-02, WO-04, WO-05 | — | 5 |
| W2 | — | WO-09, WO-10, WO-11 | — | WO-06, WO-07, WO-08 | — | 6 |
| W3 | — | WO-12, WO-13, WO-14, WO-15 | WO-16, WO-17 | — | — | 6 |
| W4 | — | — | WO-18, WO-19, WO-20, WO-21, WO-22, WO-23 | — | — | 6 |
| W5 | — | — | — | WO-24, WO-25, WO-26, WO-27 | — | 4 |
| W6 | — | — | — | WO-28, WO-29, WO-30, WO-31 | — | 4 |
| W7 | WO-32 | WO-33 | WO-34 | WO-35 | — | 4 |
| W8 | WO-36 | WO-37 | — | — | WO-38 | 3 |
| **Column total** | **2** | **11** | **10** | **14** | **1** | **38** |

## Workload highlights

- **Agent D** carries 14 WOs — the heaviest — concentrated in W1 security + W5/W6 UX + one in W7. This is by design: security quick wins (W1) and UX dead-ends (W5/W6) require a single owner for consistency.
- **Agent B** carries 11 WOs: W1 sanitize + full W2 a11y + full W3 bridge/types/telemetry + W7 mobile + W8 shortcuts. This lane spans cross-cutting concerns — bridge v2, types, a11y all share protocol-ish thinking.
- **Agent C** carries 10 WOs: dominated by W4 (all 6 module splits + store scaffold + history patch-based). W4 is the architectural refactor window — single-owner is necessary to avoid merge thrash across related files (selection, boot, feedback, history).
- **Agent A** carries 2 WOs: W7 visual gate + W8 flake cleanup. Both are test-infrastructure work that benefits from a test-specialist.
- **Agent E** carries 1 WO: W8 RC freeze. Integration + release coordination is single-owner by necessity.

## Rebalance flags

### Rule applied

A lane is flagged as "needs rebalance" if it carries **> 12 WOs sequentially** without a natural break-window.

### Analysis

- **Agent D — 14 WOs**: W1 (3) → W2 (3) → W5 (4) → W6 (4) → W7 (1). That is **14 WOs across 5 windows** (W1, W2, W5, W6, W7). W2→W5 spans W3+W4 where D has zero WOs — natural 2-window break. **NOT flagged.**
- **Agent B — 11 WOs**: W1 (1) → W2 (3) → W3 (4) → W7 (1) → W8 (1). That is **11 WOs across 5 windows** (W1, W2, W3, W7, W8). W3→W7 spans W4+W5+W6 — natural 3-window break. **NOT flagged.**
- **Agent C — 10 WOs**: W1 (1) → W3 (2) → W4 (6) → W7 (1). That is **10 WOs across 4 windows** (W1, W3, W4, W7). W4 has 6 WOs in a single window — this IS a red flag for within-window overload even though total is under 12.

### Recommendation for Agent C in W4

W4 = 6 WOs in a single window (WO-18 + WO-19 + WO-20 + WO-21 + WO-22 + WO-23). WO-18 is **L** (history patch-based, ADR-013+017 — 1–2 weeks). WO-22 is **L** (boot.js split — 1–2 weeks). The rest are **M**. Sum ≈ 6–10 week-equivalents into one 2–4 week window.

**Rebalance options:**

1. **Split W4 across two windows** (make W4a v0.30.x + W4b v0.31.x). Preserves single-owner benefits, extends calendar. Already partially reflected in EXECUTION_PLAN §"Release map" (v0.30.0 / v0.30.1 / v0.30.2 / v0.31.0).
2. **Peel WO-22 and WO-23 into Agent B window W6**. Agent B has headroom in W5/W6 (0 WOs). Downside: boot.js split touches shared init contract with selection.js/feedback.js — cross-agent coordination risk.
3. **Keep structure; accept that W4 is a 4-week window** (vs. 2 weeks for W1–W3). EXECUTION_PLAN implicitly does this.

**Chosen**: option 3 (keep). Rationale: `EXECUTION_PLAN §"Parallel execution windows"` already treats W4–W6 as longer windows ("Each window = 2–4 weeks"). Agent C's ownership of the split chain is load-bearing for correctness. We accept 4 weeks calendar for W4.

## Dependency coupling per agent

- **Agent B → D cross-window hand-off**: WO-08 (Agent D, W2) → WO-12/13 (Agent B, W3). Clean hand-off; schema-registry ownership transfers.
- **Agent C intra-window coupling**: W4 WOs share `state.js` as read-only reference — coordination risk if schema drifts during a sub-WO. Mitigation: WO-17 (selection slice) is the first migration; WO-18+ waits until WO-17 merged + green.
- **Agent D intra-window parallelism**: W5 WOs (WO-24..27) are mostly independent surfaces. Can land in any order. W6 WOs (WO-28..31) have mild coupling via banner.css + tokens.css.

## Runtime estimates

| Agent | Total effort (S + M + L count) | Approx week-equivalents |
|---|---|---|
| A | 1M + 1L = 2 WOs | ~4 weeks |
| B | 2S + 7M + 2L = 11 WOs | ~14 weeks |
| C | 4M + 2L + 4M (W4 splits) = 10 WOs | ~16 weeks |
| D | 4S + 4M + 2L + 4S = 14 WOs | ~14 weeks |
| E | 1M = 1 WO | ~1 week |

These are sequential per-agent totals. With parallel windows from `EXECUTION_PLAN`, calendar time to v1.0 is ~14–18 weeks.

## Re-sync instructions

1. Grep every `docs/work-orders/W*/WO-*.md` for `**Agent-lane:**` — capture lane letter.
2. Map to window from filename (W1..W8).
3. Re-populate matrix.
4. Re-check > 12 WOs rule per lane; flag if triggered.
5. Recompute runtime estimates from `**Effort:**` field.

## Links
- [INDEX.md](INDEX.md)
- [DEPENDENCY-GRAPH.md](DEPENDENCY-GRAPH.md)
- [GATE-TIMELINE.md](GATE-TIMELINE.md)
- [RISK-REGISTER.md](RISK-REGISTER.md)
- [EXECUTION_PLAN §Parallel execution windows](../EXECUTION_PLAN_v0.26-v1.0.md)
