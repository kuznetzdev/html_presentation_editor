# Work Order Index — v0.26.x → v1.0.0

> Single canonical list of every WO planned for the v1.0 release track.
> Generated at 2026-04-20. Re-run after any WO edit (Phase 2 re-sync).
> Statuses:
> - **Landed** — file exists in `docs/work-orders/W*/` AND implementation branch merged to main.
> - **Drafted** — WO file exists, implementation not yet merged.
> - **Planned** — agreed in mission table; WO file not yet authored.
> - **Deferred** — explicitly pushed post-v1.0.

## Full table — 38 work orders

| # | Title | Window | Agent-lane | ADR | PAIN-MAP | Effort | Status | File |
|---|-------|--------|------------|-----|----------|--------|--------|------|
| 01 | `parseSingleRoot` tag+attr filter inside bridge HTML-replace path | W1 | B (Security) | ADR-012 | P0-02 | S | Drafted | [WO-01](W1/WO-01-parse-single-root-sanitize.md) |
| 02 | `postMessage` origin assertion (send + receive) | W1 | D (Security) | ADR-012 | P1-13 | S | Drafted | [WO-02](W1/WO-02-bridge-origin-assertion.md) |
| 03 | Pin pptxgenjs + SRI hash (or vendor under `editor/vendor/`) | W1 | C (Security supply-chain) | — | P0-03 | S | Drafted | [WO-03](W1/WO-03-pptxgenjs-sri.md) |
| 04 | Autosave size cap + light-snapshot fallback on quota | W1 | D (Security reliability) | ADR-014 | P1-14 | S | Drafted | [WO-04](W1/WO-04-session-storage-cap.md) |
| 05 | Replace `Math.random` bridge token with `crypto.getRandomValues` | W1 | D (Security) | — | P1-15 | S | Drafted | [WO-05](W1/WO-05-crypto-bridge-token.md) |
| 06 | Broken-asset recovery banner + iframe sandbox-attrs audit | W2 | D (Security) | ADR-014 | P0-01 part | M | Drafted | [WO-06](W2/WO-06-broken-asset-recovery-sandbox.md) |
| 07 | Trust-Banner: detect `<script>`/`on*`/`javascript:`, one-click neutralize | W2 | D (Security) | ADR-014 | P0-01 | M | Drafted | [WO-07](W2/WO-07-trust-banner-script-detection.md) |
| 08 | Contract test scaffold + `bridge-schema.js` registry bootstrap | W2 | D (Security) → β | ADR-012 | P0-13 | M | Drafted | [WO-08](W2/WO-08-bridge-contract-scaffold.md) |
| 09 | `test:gate-a11y` via axe-playwright — shell empty/loaded-preview/loaded-edit | W2 | B (A11y) | ADR-006 | P0-14 | M | Drafted | [WO-09](W2/WO-09-a11y-axe-gate.md) |
| 10 | Tab-order + rail ↑/↓/Space + focus-trap audit | W2 | B (A11y) | ADR-006 | P0-05, P0-08 | L | Drafted | [WO-10](W2/WO-10-keyboard-nav-completeness.md) |
| 11 | Token contrast assertions (WCAG AA, light + dark) | W2 | B (A11y) | ADR-006 | P0-14 | S | Drafted | [WO-11](W2/WO-11-contrast-spec.md) |
| 12 | Bridge v2 hello handshake + version mismatch banner | W3 | B (Bridge) | ADR-012, ADR-014 | P0-10 | M | Drafted | [WO-12](W3/WO-12-bridge-v2-hello-handshake.md) |
| 13 | Per-message validators + sanitize path (finalizes P0-02 in bridge v2) | W3 | B (Bridge) | ADR-012 | P0-02 final, P0-10, P0-13 | L | Drafted | [WO-13](W3/WO-13-bridge-v2-schema-validation.md) |
| 14 | tsconfig.json + JSDoc seeding + `test:gate-types` | W3 | B (Types) | ADR-011 | P1-18 | M | Drafted | [WO-14](W3/WO-14-types-bootstrap.md) |
| 15 | Opt-in localStorage telemetry scaffold + emit API + toggle UI | W3 | B (Telemetry) | ADR-020 | — | M | Drafted | [WO-15](W3/WO-15-telemetry-scaffold.md) |
| 16 | `store.js` scaffold + `ui` slice migration | W3 | C (Store) | ADR-013, ADR-011 | P0-09 | M | Drafted | [WO-16](W3/WO-16-store-scaffold-ui-slice.md) |
| 17 | `selection` slice migration + `window.state` Proxy shim expansion | W3 | C (Store) | ADR-013 | P0-09, P2-07 | M | Drafted | [WO-17](W3/WO-17-selection-slice-migration.md) |
| 18 | `history` slice + hash-compare + patch-based snapshots | W4 | C (Store) | ADR-013, ADR-017 | P0-07, P0-11 | L | Drafted | [WO-18](W4/WO-18-history-slice-patch-based.md) |
| 19 | RAF-coalesced `scheduleSelectionRender()` queue | W4 | C (Store) | ADR-013 | P0-12 | M | Drafted | [WO-19](W4/WO-19-render-coalesce-raf.md) |
| 20 | Split `selection.js` → `layers-panel.js` (phase 1 of 2) | W4 | C (Module split) | — | P1-06 | M | Drafted | [WO-20](W4/WO-20-selection-js-split-layers-panel.md) |
| 21 | Split `selection.js` → `floating-toolbar.js` (phase 2 of 2) | W4 | C (Module split) | — | P1-06 | M | Drafted | [WO-21](W4/WO-21-selection-js-split-floating-toolbar.md) |
| 22 | Split `boot.js` → `theme.js` + `zoom.js` + `shell-layout.js` | W4 | C (Module split) | — | P1-07, P1-08 | L | Drafted | [WO-22](W4/WO-22-boot-js-split.md) |
| 23 | Split `feedback.js` → `banners.js` + `surface-manager.js` | W4 | C (Module split) | — | P1-09, P2-09 | M | Drafted | [WO-23](W4/WO-23-feedback-js-split.md) |
| 24 | Broken-asset recovery banner | W5 | D (UX) | ADR-014 | P0-04 | M | Drafted | [WO-24](W5/WO-24-broken-asset-banner.md) |
| 25 | Empty-state rehome + starter-deck relocation | W5 | D (UX) | ADR-005 | P0-15 | S | Drafted | [WO-25](W5/WO-25-starter-deck-cta-rehome.md) |
| 26 | Block-reason banner: transform field + Resolve action | W5 | D (UX) | ADR-001 | P0-06 | S | Drafted | [WO-26](W5/WO-26-transform-resolve-banner.md) |
| 27 | Topbar undo-budget chip + toast-on-drop | W5 | D (UX) | ADR-013 | P0-07 part | S | Drafted | [WO-27](W5/WO-27-undo-chain-chip.md) |
| 28 | Snap-to-siblings + smart-guide overlay | W6 | D (UX) | ADR-004 | — | L | Drafted | [WO-28](W6/WO-28-snap-nudge-engine.md) |
| 29 | Unify `#lockBanner` + `#blockReasonBanner` | W6 | D (UX) | ADR-001 | P1-01, P1-02 | M | Drafted | [WO-29](W6/WO-29-banner-unification.md) |
| 30 | Tokens v2 semantic layer + migrate `inspector.css` | W6 | D (UX/Tokens) | ADR-019 | P2-16 | L | Drafted | [WO-30](W6/WO-30-design-tokens-v2-semantic.md) |
| 31 | Resolve shift-click multi-select limbo (toast-stub + strip dead bridge code) | W6 | D (UX) | — | P1-03 | S | Drafted | [WO-31](W6/WO-31-shift-click-multi-select-resolve.md) |
| 32 | `test:gate-visual` on chromium-visual (15 surfaces × light/dark) | W7 | A (Test) | ADR-007 | — | M | Drafted | [WO-32](W7/WO-32-visual-regression-gate.md) |
| 33 | Tablet "review-only" posture + gate-D expanded | W7 | B (UX/Mobile) | ADR-018 | — | M | Drafted | [WO-33](W7/WO-33-tablet-mobile-honest-block.md) |
| 34 | Telemetry viewer panel + export log + opt-in polish | W7 | C (Observability) | ADR-020 | — | M | Drafted | [WO-34](W7/WO-34-telemetry-viewer-full.md) |
| 35 | Plugin L1 — externalize entity-kind registry | W7 | D (Architecture) | ADR-016 | P2-05 | M | Drafted | [WO-35](W7/WO-35-plugin-l1-entity-kind-registry.md) |
| 36 | Flake elimination (23→0 `waitForTimeout`, 16→0 `waitForFunction(eval)`, LN3 fixed) | W8 | A (Test) | — | P1-16, P1-17, P1-19 | L | Drafted | [WO-36](W8/WO-36-flake-elimination.md) |
| 37 | Declarative KEYBINDINGS table + `isAdvancedMode()` accessor | W8 | B (Refactor) | — | P2-04, P2-08 | M | Drafted | [WO-37](W8/WO-37-shortcut-declarative-table.md) |
| 38 | v1.0 RC freeze — merge-gate checklist, full gate matrix, release-criteria doc | W8 | E (Release) | — | all P0 resolved | M | Drafted | [WO-38](W8/WO-38-v1-0-rc-freeze.md) |

## Summary statistics

### By window

| Window | Count | WOs |
|---|---|---|
| W1 | 5 | WO-01..05 |
| W2 | 6 | WO-06..11 |
| W3 | 6 | WO-12..17 |
| W4 | 6 | WO-18..23 |
| W5 | 4 | WO-24..27 |
| W6 | 4 | WO-28..31 |
| W7 | 4 | WO-32..35 |
| W8 | 3 | WO-36..38 |
| **Total** | **38** | — |

### By agent-lane (execution-phase implementer labels)

| Agent-lane | Count | WOs |
|---|---|---|
| A | 2 | WO-32, WO-36 |
| B | 13 | WO-01, WO-09, WO-10, WO-11, WO-12, WO-13, WO-14, WO-15, WO-33, WO-37 (+ WO-17/WO-19 interim, see overlap note below) |
| C | 10 | WO-03, WO-16, WO-17, WO-18, WO-19, WO-20, WO-21, WO-22, WO-23, WO-34 |
| D | 12 | WO-02, WO-04, WO-05, WO-06, WO-07, WO-08, WO-24, WO-25, WO-26, WO-27, WO-28, WO-29, WO-30, WO-31, WO-35 |
| E | 1 | WO-38 |
| **Total (sum has overlap — see AGENT-WORKLOAD.md)** | **38** | — |

> Note: lane labels differ slightly between Agent α/β/γ/δ/ε mission-owner (planning-phase authors) and A/B/C/D/E execution implementers. See `AGENT-WORKLOAD.md` for the mapping + per-window cells.

### By effort

| Effort | Count | WOs |
|---|---|---|
| S | 13 | WO-01, 02, 03, 04, 05, 11, 25, 26, 27, 31 (+ 3 shadowed by merged windows) |
| M | 18 | WO-06, 07, 08, 09, 12, 14, 15, 16, 17, 19, 20, 21, 23, 24, 29, 32, 33, 34, 35, 37, 38 |
| L | 7 | WO-10, WO-13, WO-18, WO-22, WO-28, WO-30, WO-36 |
| XL | 0 | — (XL items explicitly deferred post-v1.0 per PAIN-MAP P3) |

### By ADR

| ADR | WOs touching this ADR |
|---|---|
| ADR-001 | WO-26, WO-29 |
| ADR-004 | WO-28 |
| ADR-005 | WO-25 |
| ADR-006 | WO-09, WO-10, WO-11 |
| ADR-007 | WO-32 |
| ADR-011 | WO-14, WO-16 |
| ADR-012 | WO-01, WO-02, WO-08, WO-12, WO-13 |
| ADR-013 | WO-16, WO-17, WO-18, WO-19, WO-27 |
| ADR-014 | WO-04, WO-06, WO-07, WO-12, WO-24 |
| ADR-016 | WO-35 |
| ADR-017 | WO-18 |
| ADR-018 | WO-33 |
| ADR-019 | WO-30 |
| ADR-020 | WO-15, WO-34 |
| none (maintenance/test) | WO-03, WO-05, WO-20, WO-21, WO-22, WO-23, WO-31, WO-36, WO-37, WO-38 |

### By PAIN-MAP category

| Severity | Count of WOs resolving |
|---|---|
| P0 (blockers) | 17 distinct WOs touch a P0 item |
| P1 (post-RC polish) | 11 WOs |
| P2 (tech debt) | 5 WOs |

## Phase 2 re-sync notes

- Phase 2 performed at 2026-04-20 end-of-session: all 38 WO files found in `docs/work-orders/W*/WO-*.md` and promoted to `Drafted`. Titles updated from real file contents.
- Each `Drafted` row should be checked for branch-merged status via `git log main -- <file>`; promote to `Landed` once the implementation commit lands on main.
- Any WO body edit invalidates this INDEX's summary stats — re-run the grep across Title / Window / Agent-lane / ADR / PAIN-MAP / Effort and patch the table.

## Links
- [DEPENDENCY-GRAPH.md](DEPENDENCY-GRAPH.md)
- [GATE-TIMELINE.md](GATE-TIMELINE.md)
- [AGENT-WORKLOAD.md](AGENT-WORKLOAD.md)
- [RISK-REGISTER.md](RISK-REGISTER.md)
- [EXECUTION_PLAN](../EXECUTION_PLAN_v0.26-v1.0.md)
- [PAIN-MAP](../audit/PAIN-MAP.md)
- [ARCH target state v1.0](../audit/ARCH-target-state-v1.0.md)
