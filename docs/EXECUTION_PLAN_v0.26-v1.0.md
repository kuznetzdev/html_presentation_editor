# EXECUTION PLAN — v0.26.0 → v1.0.0

> Parallel execution map from current v0.25.0 baseline (Gate-A 55/5/0, main @ 4dc20bd) to v1.0.
> Baseline architecture: 25 classic `<script src>` JS modules + 8 CSS @layers + iframe bridge.
> Zero-build invariant preserved (ADR-015). file:// workflow preserved.
> Extends `docs/PARALLEL_EXECUTION_PLAN.md` (covers v0.25–v0.28) to v1.0.
> Generated: 2026-04-20.

---

## Release map — from v0.25 to v1.0

| Version | Focus | ADR(s) | PAIN-MAP items | Gate additions |
|---------|-------|--------|----------------|----------------|
| v0.25.0 | Layer picker all modes + badge sync | ADR-003 (done) | — | — |
| **v0.26.0** | Precision editing (existing roadmap) | ADR-004 | — | — |
| **v0.26.1** | Security quick wins | — | P0-02, P0-03, P1-13, P1-15 | — |
| **v0.27.0** | Onboarding + broken-asset recovery | ADR-005 + new | P0-04, P0-15, P1-01 | — |
| **v0.27.1** | A11y gate | ADR-006 | P0-05 (partial), P0-08 (rail kbd) | `test:gate-a11y` |
| **v0.27.2** | Undo-chain honesty + transform resolve | — | P0-06, P0-07 | — |
| **v0.28.0** | Visual regression gate | ADR-007 | — | `test:gate-visual` |
| **v0.28.1** | Telemetry scaffold + types bootstrap | ADR-011, ADR-020 (scaffold) | P1-18 | `test:gate-types` (optional) |
| **v0.29.0** | Error boundaries + bridge v2 (hello) | ADR-012 (handshake), ADR-014 | P0-01 (trust banner), P1-01 (banner unify) | — |
| **v0.29.1** | Bridge v2 — schema validation | ADR-012 (schemas) | P0-02 (final), P0-10, P0-13 | `test:gate-contract` |
| **v0.30.0** | Observable store (ui + selection slices) | ADR-013 | P0-09 (partial) | — |
| **v0.30.1** | History → patch-based | ADR-013 + ADR-017 | P0-07 (final), P0-11 | — |
| **v0.30.2** | Render coalescing | ADR-013 | P0-12 | — |
| **v0.31.0** | Selection.js / boot.js split | — | P1-06, P1-07, P1-08, P1-09 | — |
| **v0.31.1** | Design tokens v2 (semantic layer) | ADR-019 | — | — |
| **v0.32.0** | Entity-kind registry externalized | ADR-016 (L1) | P2-05 | — |
| **v0.32.1** | Tablet honest-block polish | ADR-018 | — | gate-D expanded |
| **v0.33.0** | Telemetry full (viewer, export log) | ADR-020 | — | — |
| **v0.34.0** | Contract tests · bridge complete | ADR-012 | P0-13 | — |
| **v0.35.0** | Flake elimination · test cleanup | — | P1-16, P1-17, P1-19 | Gate-A rebalance |
| **v0.36.0** | Plugin L1 polish · shortcut table | — | P2-04, P2-08, P2-09 | — |
| **v0.37.0** | v1.0 RC · release-candidate freeze | — | All P0 resolved | Full gate matrix |
| **v1.0.0** | Release | All ADR Accepted | — | — |

**Total timeline estimate:** 12 minor releases × ~2 weeks each = **24 weeks of work**. With 3 parallel agents per release window (using existing worktree pattern), real calendar time ≈ **14–18 weeks** = ~**4 months to v1.0**.

---

## Parallel execution windows

Each window = 2–4 weeks. Within a window, agents run in worktrees per `docs/PARALLEL_EXECUTION_PLAN.md` (already-shipped v0.25–v0.28 map).

### Window 1 — v0.26.0 + v0.26.1 (existing plan + security quick wins)

| Agent | Work | Files |
|---|---|---|
| Agent A | v0.26.0 precision editing (existing plan) | precision.js, precision.css, selection.js (additive), bridge-script.js (one case) |
| Agent B | P0-02 parseSingleRoot sanitization | bridge-script.js (attribute filter extension) |
| Agent C | P0-03 pptxgenjs vendored + SRI | export.js, editor/vendor/pptxgen.bundled.min.js (new), .gitignore |
| Agent D | P1-13 origin-assert, P1-15 crypto token | bridge-script.js, import.js, bridge.js |
| Agent E | Integration + Gate-A after each merge | tokens.css, @layer additions |

Conflict matrix: A owns selection+precision; B owns bridge-script payload sanitization; C owns export+vendor; D touches bridge at 2 small points (merge after B). All read-only otherwise. Zero-conflict achievable.

### Window 2 — v0.27.0 + v0.27.1

| Agent | Work | Files |
|---|---|---|
| Agent A | P0-04 broken-asset banner, P0-15 starter-deck relocation | onboarding.js, import.js, previewAssistActionBtn wiring, STARTER_DECKS constant |
| Agent B | ADR-006 a11y gate — shell-a11y, keyboard-nav, contrast | tests/a11y/*.spec.js, package.json (devDeps), playwright.config.js |
| Agent C | P1-01 banner unification | feedback.js, banner.css, inspector-sync.js |
| Agent D | P0-08 rail keyboard nav | slide-rail.js, shortcuts.js |
| Agent E | Integration + a11y baseline capture | ADR-014 shellBanner region |

### Window 3 — v0.27.2 + v0.28.0 + v0.28.1

| Agent | Work |
|---|---|
| Agent A | P0-06 transform resolve, P0-07 undo-chain chip + banner |
| Agent B | ADR-007 visual regression gate (extends existing skeleton) |
| Agent C | ADR-011 tsconfig + JSDoc on state.js, constants.js |
| Agent D | ADR-020 telemetry scaffold (opt-in toggle + event emit API) |
| Agent E | Integration |

### Window 4 — v0.29.x (Error boundaries + Bridge v2)

| Agent | Work |
|---|---|
| Agent A | ADR-014 shellBanner region + shellBoundary.report() API |
| Agent B | ADR-014 Trust Banner (P0-01 remediation) |
| Agent C | ADR-012 hello handshake + schema registry scaffold |
| Agent D | ADR-012 per-message validators + sanitize path |
| Agent E | Contract tests `tests/contract/bridge.contract.spec.js` |

### Window 5 — v0.30.x (Observable store)

| Agent | Work |
|---|---|
| Agent A | store.js scaffold + ui slice migration |
| Agent B | selection slice migration + Proxy shim |
| Agent C | history slice + patch-based snapshots (ADR-017) |
| Agent D | Render coalescing (solves AUDIT-C #2) |
| Agent E | Integration + unit tests on store |

### Window 6 — v0.31.x (Module split + tokens v2)

| Agent | Work |
|---|---|
| Agent A | selection.js split → layers-panel.js + floating-toolbar.js |
| Agent B | boot.js split → theme.js + zoom.js + shell-layout.js |
| Agent C | feedback.js split → banners.js + surface-manager.js |
| Agent D | tokens.css Layer-2 semantic tokens + migrate inspector.css |
| Agent E | Integration + stylelint rule for Layer 2 boundary |

### Window 7 — v0.32–v0.34 (Plugin L1, Tablet, Telemetry full, Contract tests)

Three smaller parallel tracks:

- Track 1: entity-kind registry externalized (ADR-016 L1)
- Track 2: tablet honest-block + gate-D expansion (ADR-018)
- Track 3: telemetry viewer + contract tests complete

### Window 8 — v0.35–v0.37 (Flake cleanup + plugin polish + RC)

- Track 1: test flake elimination (P1-16, P1-17, P1-19)
- Track 2: shortcut declarative table + feature-flag accessor (P2-04, P2-08)
- Track 3: RC freeze — bug triage only, no new features

---

## Gate evolution

| Gate | v0.25.0 | v1.0 |
|------|---------|------|
| `test:gate-a` | 4 specs, chromium-desktop | **unchanged** (55/5/0 invariant) |
| `test:gate-b` | full regression, 2 projects | +5 new specs; same projects |
| `test:gate-c` | firefox, webkit — 4 specs | + honest-feedback, overlap, layers (AUDIT-E gap) |
| `test:gate-d` | mobile/tablet — 2 specs | + 10 tablet specs (ADR-018) |
| `test:gate-e` | asset-parity | + re-import round-trip spec |
| `test:gate-f` | all | all + a11y + visual + contract + types |
| **`test:gate-a11y`** | — | **NEW** (v0.27.1 · ADR-006) |
| **`test:gate-visual`** | — | **NEW** (v0.28.0 · ADR-007) |
| **`test:gate-contract`** | — | **NEW** (v0.29.1 · ADR-012) |
| **`test:gate-types`** | — | **NEW optional** (v0.28.1 · ADR-011) |

Gate-A stays the **dev-heartbeat contract** throughout — no new specs land there. Regression depth goes into gate-B and new gates.

---

## Dependency map

```
ADR-011 (types) ─────► ADR-012 (bridge v2) ─────┐
                 └──► ADR-013 (observable store) ─┤
                                                    ├──► observability (ADR-020)
ADR-014 (error boundaries) ─────► P0-01 trust banner
                              └── banners unification (P1-01)

ADR-006 (a11y) ─────► P0-05, P0-08, P0-14

ADR-007 (visual) ─────► catches ADR-019 rebind regressions

ADR-016 (plugins L1) ─────► depends on registry = shell+bridge coordination
ADR-019 (tokens v2) ─────► used by ADR-014 banners

ADR-015 (no-bundler) ─────► precondition for all other ADRs
```

---

## Merge & gating discipline per window

```
For each window:
  1. Each agent works in a worktree branch isolation:worktree
  2. Agents read-only outside their owned files
  3. Agent E merges in order A → B → C → D with Gate-A after each merge
  4. Integration-specific wiring (tokens.css @layer, cross-module hookups) stays with Agent E
  5. New gates run after their dedicated agent's merge + Gate-A still 55/5/0
  6. Semver tag on every merge: v0.N.0, v0.N.1, ...
  7. CHANGELOG.md entry per tag
  8. Obsidian Daily/Changelog updated (HOW_TO_USE §9)
```

**Hard rule:** if a window's Gate-A breaks, we stop, revert to last green, re-plan. No "fix forward under pressure".

---

## Risk map

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ADR-013 migration breaks existing state consumers | Med | High | Proxy shim keeps `window.state` reads working through full migration |
| ADR-012 sanitization breaks reference decks (v3-prepodovai, v3-selectios) | Med | High | Deep spec on reference decks before sanitization switch; behind flag first |
| Agent C (precision) conflicts with window-5 observable store | Low | Med | Order constraint: Window 5 merges AFTER Window 1 |
| A11y gate discovers 50+ violations | Med | Med | Acceptable — they're existing bugs; ship triaged list in v0.27.1 |
| v0.30.1 patch-based history loses data in migration | Low | Critical | Full-HTML snapshot fallback retained until 2 minor versions of patch-based run clean |
| Contributor implements TypeScript emit "just for one file" | Low | High (invariant break) | ADR-015 enforced in PR review |
| Timeline slips (common for 4-month plans) | High | Med | Plan has 3 slack weeks built in across windows 7–8 |

---

## Release criteria for v1.0.0

Ship v1.0 when all of:

- [ ] All P0 PAIN-MAP items resolved or explicitly deferred with ADR rationale
- [ ] Gate-A: 55/5/0 on chromium-desktop
- [ ] Gate-B: green on chromium-desktop + chromium-shell-1100
- [ ] Gate-C: green on firefox-desktop + webkit-desktop
- [ ] Gate-D: green on 3 mobile/tablet viewports
- [ ] Gate-E: asset-parity green
- [ ] Gate-A11y: 0 WCAG AA violations (shell only)
- [ ] Gate-Visual: 0 pixel regressions in baseline (light + dark)
- [ ] Gate-Contract: bridge v2 schema 100% validated on test corpus
- [ ] Reference decks (v3-prepodovai-pitch, v3-selectios-pitch) load + edit + export clean
- [ ] No HIGH or CRITICAL security findings outstanding
- [ ] All 10 new ADRs (ADR-011–020) status: Accepted
- [ ] ROADMAP_NEXT.md reflects v1.0-as-shipped

---

## Links

- [PAIN-MAP](audit/PAIN-MAP.md)
- [PARALLEL_EXECUTION_PLAN](PARALLEL_EXECUTION_PLAN.md) — original v0.25–v0.28 map
- [ROADMAP_NEXT](ROADMAP_NEXT.md) — tactical detail per version
- [ARCH - Target State v1.0](audit/ARCH-target-state-v1.0.md)
- [ARCH - Current vs Target](audit/ARCH-current-vs-target.md)
- ADR-011 through ADR-020 in `docs/`
