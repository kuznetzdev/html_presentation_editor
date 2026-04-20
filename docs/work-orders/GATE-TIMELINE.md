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
| **v0.26.1** (security quick wins) | 55/5/0 invariant | +sanitize-smoke (WO-01) | unchanged | unchanged | unchanged | includes sanitize | — | — | — | — |
| **v0.27.0** (onboarding + broken-asset) | 55/5/0 invariant | +trust-banner spec (WO-07) | unchanged | unchanged | unchanged | unchanged | — | — | — | — |
| **v0.27.1** (a11y gate) | 55/5/0 invariant | +a11y integration smoke | +focus-order Firefox | includes new tab/rail kbd | unchanged | includes all above | **NEW 0 violations** (WO-09, WO-10, WO-11) | — | — | — |
| **v0.27.2** (undo-chain, transform) | 55/5/0 invariant | +undo-chain ≥20 spec | unchanged | unchanged | unchanged | includes all above | 0 violations invariant | — | — | — |
| **v0.28.0** (visual regression) | 55/5/0 invariant | visual.spec.js retired, subsumed by gate-visual | unchanged | unchanged | unchanged | includes all above | 0 violations | **NEW** 15/0/0 chromium-visual 1440×900 (WO-32) | — | — |
| **v0.28.1** (telemetry scaffold + types) | 55/5/0 invariant | +telemetry scaffold spec | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | — | **NEW optional** `tsc --noEmit` (WO-14) |
| **v0.29.0** (error boundaries + bridge v2 hello) | 55/5/0 invariant | +error-boundary spec | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | — | optional |
| **v0.29.1** (bridge v2 schema validation) | 55/5/0 invariant | unchanged | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | **NEW 100% schemas** (WO-13) | optional |
| **v0.30.0** (observable store — ui + selection) | 55/5/0 invariant | +store slice specs | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 100% schemas | optional |
| **v0.30.1** (history patch-based) | 55/5/0 invariant | +history-stress spec | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 100% schemas | optional |
| **v0.30.2** (render coalescing) | 55/5/0 invariant | unchanged | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 100% schemas | optional |
| **v0.31.0** (selection/boot split) | 55/5/0 invariant | unchanged | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 100% schemas | optional |
| **v0.31.1** (tokens v2 semantic) | 55/5/0 invariant | unchanged | unchanged | unchanged | unchanged | includes all above | 0 violations (re-verified) | 15/0/0 (baselines regenerated under new tokens) | 100% schemas | optional |
| **v0.32.0** (entity-kind registry) | 55/5/0 invariant | +entity-kinds-registry (WO-35) | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 100% schemas | optional |
| **v0.32.1** (tablet honest-block) | 55/5/0 invariant | unchanged | unchanged | **+tablet-honest spec 3 viewports** (WO-33) | unchanged | includes all above | 0 violations (incl. compact viewports) | 15/0/0 | 100% schemas | optional |
| **v0.33.0** (telemetry viewer full) | 55/5/0 invariant | +telemetry-viewer + TV9 export-purity (WO-34) | unchanged | unchanged | unchanged | includes all above | 0 violations | 15/0/0 | 100% schemas | optional |
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
| `test:gate-contract` | **v0.29.1** | WO-13 (planned) — schema validators per message |
| `test:gate-types` | **v0.28.1** (optional) → v0.37.0 (required) | WO-14 (planned) — `tsc --noEmit` baseline |

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
