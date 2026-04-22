# Gate timeline — v0.25.0 → v1.0.0

> Per-version matrix of how each gate evolves from baseline to release.
> Pass/fail / count cells cite the WO that introduces or expands the gate.
> Generated at 2026-04-20. Re-run when gate scripts change in `package.json`.

## Legend

- `—` : gate does not exist yet
- `55/5/0` : Playwright pass/skip/fail baseline invariant
- `+X` : X new specs added (delta, not absolute)
- `green` : all specs pass on the listed project set
- `0 violations` : zero-violation absolute requirement
- `full` : full matrix × all projects

## Gate matrix per version

| Version | Gate-A | Gate-B | Gate-C | Gate-D | Gate-E | Gate-F | Gate-a11y | Gate-visual | Gate-contract | Gate-types |
|---------|--------|--------|--------|--------|--------|--------|-----------|-------------|---------------|------------|
| **v0.25.0** (baseline) | 55/5/0 | existing (11 specs, 2 projects) | existing (4 specs × 2 browsers) | existing (2 specs × 3 viewports) | existing (asset-parity) | existing (all × all) | — | — | — | — |
| **v0.26.0** (precision editing) | 55/5/0 invariant | unchanged | unchanged | unchanged | unchanged | unchanged | — | — | — | — |
| **v0.26.1** (WO-01 parseSingleRoot sanitize) | 55/5/0 ✅ live since v0.26.1 | +bridge-sanitize 5 specs (WO-01) | unchanged | unchanged | unchanged | unchanged | — | — | — | — |
| **v0.26.2** (WO-03 pptxgenjs vendor SRI) | 55/5/0 ✅ | +export-sri 2 specs (WO-03) | unchanged | unchanged | unchanged | unchanged | — | — | — | — |
| **v0.26.3** (WO-05 crypto bridge token) | 55/5/0 ✅ | +bridge-token 2 specs (WO-05) | unchanged | unchanged | unchanged | unchanged | — | — | — | — |
| **v0.26.4** (WO-02 bridge origin assertion) | 55/5/0 ✅ | +bridge-origin 2 specs (WO-02) | unchanged | unchanged | unchanged | unchanged | — | — | — | — |
| **v0.26.5** (WO-04 autosave size cap) | 55/5/0 ✅ | +autosave-cap 3 specs (WO-04) — W1 Security CLOSED | unchanged | unchanged | unchanged | unchanged | — | — | — | — |
| **v0.27.0** (WO-08 bridge contract scaffold) | 59/5/0 ✅ live since v0.27.0 | +bridge-schema contract 34 specs — gate-contract new | unchanged | unchanged | unchanged | unchanged | — | — | **NEW gate-contract 34/0/0** (WO-08) | — |
| **v0.27.1** (WO-06 broken-asset banner) | 59/5/0 ✅ | +broken-asset-banner 4 specs added to gate-a (baseline now 59/5/0) | unchanged | unchanged | unchanged | unchanged | — | — | 34/0/0 | — |
| **v0.27.2** (W2 batch 1 bump) | 59/5/0 invariant | unchanged | unchanged | unchanged | unchanged | unchanged | — | — | 34/0/0 | — |
| **v0.27.3** (WO-07 trust-banner + neutralize-scripts) | 59/5/0 ✅ | +trust-banner 8 scenarios (not in gate-a; gate-b candidate) | unchanged | unchanged | unchanged | unchanged | — | — | 34/0/0 | — |
| **v0.27.4** (WO-10 keyboard nav + focus-trap) | 59/5/0 ✅ | +keyboard-nav 6 specs gate-a11y | unchanged | unchanged | unchanged | unchanged | 0 violations + 6 keyboard-nav (WO-10) | — | 34/0/0 | — |
| **v0.27.5** (WO-11 contrast ratio — W2 CLOSED) | 59/5/0 ✅ | +contrast 14 assertions gate-a11y | unchanged | unchanged | unchanged | unchanged | **27 passed gate-a11y total** (WO-09/10/11) ✅ live since v0.27.5 | — | 34/0/0 | — |
| **v0.28.0** (visual regression) | 55/5/0 invariant | visual.spec.js retired, subsumed by gate-visual | unchanged | unchanged | unchanged | includes all above | 0 violations | **NEW** 15/0/0 chromium-visual 1440×900 (WO-32) | — | — |
| **v0.28.1** (telemetry scaffold + types) | 55/5/0 invariant | +telemetry scaffold spec | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | — | **NEW optional** `tsc --noEmit` (WO-14) |
| **v0.29.0** (error boundaries + bridge v2 hello) | 55/5/0 invariant | +error-boundary spec | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | — | optional |
| **v0.29.1** (bridge v2 schema validation) | 55/5/0 invariant | unchanged | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | **NEW 100% schemas** (WO-13) | optional |
| **v0.30.0** (WO-24 broken-asset recovery banner — W5) | **65/5/0** ✅ live since v0.30.0 (baseline +6 from broken-asset-banner.spec.js) | +broken-asset-banner 6 specs (WO-24) — P0-04 CLOSED | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 152/0 | optional |
| **v0.30.1** (WO-25 empty-state rehome + starter-deck — W5) | 65/5/0 ✅ | +onboarding 4 specs (WO-25) — P0-15 CLOSED | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 152/0 | optional |
| **v0.30.2** (WO-26 transform resolve + inspector field — W5 CLOSED) | 65/5/0 ✅ | +transform-resolve 5 specs (WO-26) — P0-06 CLOSED | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 152/0 | optional |
| **v0.31.0** (WO-31 shift-click multi-select toast stub — W6) | 65/5/0 ✅ | +multi-select-resolve 6 specs (WO-31) — P1-03 CLOSED | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 152/0 | optional |
| **v0.31.1** (WO-28 snap-to-siblings + smart guides — W6) | 65/5/0 ✅ | +precision 5 specs (WO-28) — ADR-004 | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 152/0 | optional |
| **v0.31.2** (WO-29 banner unification — W6 CLOSED) | 65/5/0 ✅ | +banner-unification 5 specs (WO-29) — P1-01 + P1-02 CLOSED; gate-a11y stale .fail() removed (27/0) | unchanged | unchanged | unchanged | includes all above | **27/0 clean** ✅ | 15/0/0 | 152/0 | optional |
| **v0.32.0** (WO-32 gate-visual 1440×900 — W7) | **65/5/0** ✅ live since v0.32.0 | unchanged | unchanged | unchanged | unchanged | includes all above | 0 violations | **NEW gate-visual 15/0/0** (WO-32) ✅ live since v0.32.0 | 152/0 | optional |
| **v0.32.1** (WO-30 tokens v2 semantic layer — W7) | 65/5/0 ✅ | unchanged | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 — 0 px diff ✅ | 152/0 | optional |
| **v0.32.2** (WO-35 entity-kind registry — W7) | 65/5/0 ✅ | +entity-kinds-registry 5 specs (WO-35) | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 152/0 | optional |
| **v0.32.3** (WO-33 tablet honest-block — W7) | 65/5/0 ✅ | unchanged | unchanged | **+tablet-honest 10 specs × 3 viewports** (WO-33) ADR-018 | unchanged | includes all above | 0 violations (incl. compact viewports) | 15/0/0 | 152/0 | optional |
| **v0.32.4** (WO-34 telemetry viewer — W7 CLOSED) | 65/5/0 ✅ | +telemetry-viewer 9 specs incl. TV9 purity (WO-34) — ADR-020 | unchanged | unchanged | unchanged | includes all above | **27/0 clean** ✅ | 15/0/0 | 152/0 | optional |
| **v0.34.0** (contract tests complete) | 55/5/0 invariant | unchanged | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 100% schemas (finalized) | optional |
| **v0.35.0** (flake elimination) | 55/5/0 invariant + **0 `waitForTimeout` / `waitForFunction(eval)` / explicit retries** (WO-36) | green 3× consecutive | green 3× consecutive | green 3× consecutive | green | includes all above | 0 violations | 15/0/0 | 100% schemas | optional |
| **v0.36.0** (shortcuts table + accessor) | 55/5/0 invariant | +shortcuts-table spec (WO-37) | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 100% schemas | optional |
| **v0.37.0** (v1.0 RC freeze) | **55/5/0** + 3× consecutive (WO-38) | full regression green 2 projects | green 2 browsers | green 3 viewports + tablet-honest | green asset-parity | **full matrix release-blocking** (WO-38) | **0 violations, release-enforced** | **15/0/0 enforced** | **100% schemas enforced** | **required (tsc clean)** |
| **v1.0.0** (release) | 55/5/0 | green × 2 | green × 2 | green × 3 | green | full | 0 violations | 0 px regression | 100% | green |

## Gate-introduction citations

| Gate | Introduced at | WO that ships it |
|---|---|---|
| `test:gate-a` | pre-v0.25.0 baseline | — (historical) |
| `test:gate-b` | pre-v0.25.0 baseline | — (historical) |
| `test:gate-c` | pre-v0.25.0 baseline | — (historical) |
| `test:gate-d` | pre-v0.25.0 baseline | — (expanded by WO-33 in v0.32.1) |
| `test:gate-e` | pre-v0.25.0 baseline | — (historical) |
| `test:gate-f` | pre-v0.25.0 baseline | — (historical, gated by WO-38) |
| `test:gate-a11y` | **v0.27.1** | [WO-09](W2/WO-09-a11y-axe-gate.md), [WO-10](W2/WO-10-keyboard-nav-completeness.md), [WO-11](W2/WO-11-contrast-spec.md) |
| `test:gate-visual` | **v0.28.0** | [WO-32](W7/WO-32-visual-regression-gate.md) |
| `test:gate-contract` | **v0.28.3** ✅ live | WO-13 — schema validators per message (152/0) |
| `test:gate-types` | **v0.28.1** ✅ live (optional) → v0.37.0 (required) | WO-14 — `tsc --noEmit` baseline (globals.d.ts drift noted v0.29.5, deferred) |
| `test:unit` | **v0.28.4** ✅ live | WO-16 — store.js unit tests; expanded to 54/54 by W4 (Node --test) |

## Gate rebalancing notes

- **v0.28.0**: `tests/playwright/specs/visual.spec.js` is RETIRED; its 4 scenarios are subsumed by `tests/visual/shell-visual.spec.js` on `chromium-visual` project per ADR-007 (WO-32, sub-task 8).
- **v0.32.1**: `test:gate-d` arg list expands to include `tablet-honest.spec.js` (WO-33, sub-task 10). 3 viewports × 10 tests = 30 new runs.
- **v0.33.0**: `telemetry-viewer.spec.js` enters gate-B, NOT gate-A (AUDIT-E §"Gate rebalancing" policy: new specs enter gate-A only after 3 nightly-green).
- **v0.35.0**: Gate-A's 55/5/0 is preserved, but the **invariant of 0 `waitForTimeout` in specs** becomes a grep-enforced rule (WO-36). Violating it breaks the merge even if tests pass.
- **v0.37.0** (RC): Full gate matrix runs as release-blocker (`test:gate-f`). All 9 specific gates must be simultaneously green.

## Runtime budgets

| Gate | v0.25.0 budget | v1.0 budget |
|---|---|---|
| gate-a | 3–5 min | unchanged (invariant) |
| gate-b | 15–25 min | up to 30 min (new specs added) |
| gate-c | 10–15 min | 15–20 min (expanded) |
| gate-d | 10–15 min | up to 25 min (tablet-honest +30 runs) |
| gate-e | 3–5 min | unchanged |
| gate-f | 60+ min | 90+ min (all added) |
| gate-a11y | — | 2–3 min |
| gate-visual | — | 5–8 min (15 snapshots × ~30s) |
| gate-contract | — | 3–5 min |
| gate-types | — | < 1 min (tsc --noEmit) |

## Links
- [INDEX.md](INDEX.md)
- [DEPENDENCY-GRAPH.md](DEPENDENCY-GRAPH.md)
- [AGENT-WORKLOAD.md](AGENT-WORKLOAD.md)
- [RISK-REGISTER.md](RISK-REGISTER.md)
- [EXECUTION_PLAN §Gate evolution](../EXECUTION_PLAN_v0.26-v1.0.md)
- [AUDIT-E §Gate inventory](../audit/AUDIT-E-tests.md)
