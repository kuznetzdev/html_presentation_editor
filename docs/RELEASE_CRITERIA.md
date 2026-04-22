# RELEASE CRITERIA — v1.0.0

> Generated: 2026-04-22 · WO-38 RC Freeze
> This document is the binding definition of "done" for the v1.0.0 release.
> It is produced from WO-38 sub-tasks 1–8 and supersedes any prior release checklist.

---

## §1 — Definition of v1.0

**v1.0.0 is the first production-ready release** of html-presentation-editor.

It delivers on the core product promise: `Open → select → edit → save` for any HTML presentation file
opened via `file://` — without a server, without a build step, without a framework.

### Mandatory release conditions (all must be true simultaneously)

- [ ] All 15 P0 PAIN-MAP items resolved or explicitly deferred with rationale ✅ (see §2)
- [ ] Gate-A: 65/5/0 on chromium-desktop (55/5/0 invariant + 10 from WO-24/WO-25 additions) ✅
- [ ] Gate-B: green on chromium-desktop + chromium-shell-1100 (full regression)
- [ ] Gate-C: green on firefox-desktop + webkit-desktop
- [ ] Gate-D: green on 3 mobile/tablet viewports (including tablet-honest from WO-33)
- [ ] Gate-E: asset-parity green
- [ ] Gate-a11y: 27/0 — 0 WCAG AA violations (shell scope) ✅
- [ ] Gate-visual: 15/0/0 — 0 pixel regressions in 1440×900 chromium baseline ✅
- [ ] Gate-contract: 152/0 — 100% bridge messages schema-validated ✅
- [ ] Gate-types: tsc --noEmit clean ✅ (achieved WO-38)
- [ ] Reference decks: v3-prepodovai-pitch + v3-selectios-pitch load + edit + export clean (manual)
- [ ] Zero HIGH or CRITICAL open security findings (see §6)
- [ ] All 20 ADRs (001–020): Status = Accepted or Deferred (no Proposed) ✅ (achieved WO-38)
- [ ] ROADMAP_NEXT.md reflects v1.0-as-shipped
- [ ] package.json version = `0.37.0-rc.0` during freeze; promoted to `1.0.0` at GA ceremony

---

## §2 — P0 Resolution matrix

All 15 P0 items from PAIN-MAP baseline (v0.25.0, 2026-04-20) are resolved:

| # | Area | Resolution | WO | Tag |
|---|------|-----------|-----|-----|
| P0-01 | Security | Trust-Banner + sandbox audit + neutralize-scripts | WO-06, WO-07, WO-12 | v0.27.3 |
| P0-02 | Security | parseSingleRoot sanitize (BLOCKED_ATTR_NAMES + 256 KB cap) | WO-01 | v0.26.1 |
| P0-03 | Security | pptxgenjs vendored + SRI hash | WO-03 | v0.26.2 |
| P0-04 | UX | Broken-asset recovery banner | WO-24 | v0.30.0 |
| P0-05 | UX/a11y | Keyboard nav (rail roving tabindex) + declarative KEYBINDINGS | WO-10, WO-37 | v0.27.4, v0.33.1 |
| P0-06 | UX | Transform-resolve banner + inspector field | WO-26 | v0.30.2 |
| P0-07 | UX | History budget chip N/20 + toast-on-drop | WO-18 | v0.29.0 |
| P0-08 | UX | Rail keyboard nav (↑/↓) | WO-10 | v0.27.4 |
| P0-09 | Arch | Observable store (ui/selection/history slices) | WO-16, WO-17, WO-18 | v0.28.4–v0.29.0 |
| P0-10 | Arch | Bridge Protocol v2 (hello + 152 validators) | WO-12, WO-13 | v0.28.0, v0.28.3 |
| P0-11 | Perf | Patch-based history snapshots (<1 MB for 20× identical) | WO-18 | v0.29.0 |
| P0-12 | Perf | RAF-coalesce selection fan-out 7→1 pass | WO-19 | v0.29.1 |
| P0-13 | Tests | Bridge contract gate (152/0) | WO-13 | v0.28.3 |
| P0-14 | Tests | Accessibility gate (27/0, 0 WCAG AA violations) | WO-09/10/11 | v0.27.5 |
| P0-15 | UX | Starter-deck CTA rehome (Open/Starter/Paste order) | WO-25 | v0.30.1 |

**Status: ALL 15 P0 items RESOLVED ✅**

---

## §3 — ADR status matrix

All 20 ADRs from the planning phase have Status: Accepted or Deferred.

| ADR | Title | Status | Accepted in |
|-----|-------|--------|------------|
| ADR-001 | Block Reason Protocol | Accepted | v0.30.2 (WO-26), v0.31.2 (WO-29) |
| ADR-002 | Stack Depth Indicator | Deferred to v1.1+ | Badge functional in v0.25.0 |
| ADR-003 | Layer Picker Popup | Accepted | v0.25.0 baseline |
| ADR-004 | Snap/Nudge System | Accepted | v0.31.1 (WO-28) |
| ADR-005 | Onboarding Starter Deck | Accepted | v0.30.1 (WO-25) |
| ADR-006 | Accessibility CI Gate | Accepted | v0.27.5 (WO-09/10/11) |
| ADR-007 | Visual Regression Gate | Accepted | v0.32.0 (WO-32) |
| ADR-011 | Type System Strategy | Accepted | v0.28.1 (WO-14), clean v0.33.1 (WO-38) |
| ADR-012 | Bridge Protocol v2 | Accepted | v0.28.0 (WO-12), v0.28.3 (WO-13) |
| ADR-013 | Observable Store | Accepted | v0.28.4 (WO-16, phase 1) |
| ADR-014 | Error Boundaries | Accepted | v0.27.1–v0.30.0 (WO-06/07/12/24) |
| ADR-015 | No-Bundler Decision | Accepted | Enforced throughout v0.26.1–v0.33.1 |
| ADR-016 | Plugin Extension Arch | L1 Accepted / L2 Deferred | v0.32.2 (WO-35) |
| ADR-017 | Collaborative Editing | Accepted (readiness) / CRDT Deferred | v0.29.0 (WO-18) |
| ADR-018 | Mobile Touch Strategy | Accepted | v0.32.3 (WO-33) |
| ADR-019 | Design Tokens v2 | Accepted | v0.32.1 (WO-30) |
| ADR-020 | Telemetry & Feedback | Accepted | v0.28.2 (WO-15), v0.32.4 (WO-34) |

**grep `Status.*Proposed` docs/ADR-0{01..20}*.md → 0 matches ✅**

---

## §4 — Gate matrix results (WO-38 run, 2026-04-22)

| Gate | Command | Result | Runtime | Notes |
|------|---------|--------|---------|-------|
| gate-a | `test:gate-a` | **65/5/0** ✅ | ~3.0 min | 65 pass (55 invariant + 10 new) |
| gate-contract | `test:gate-contract` | **152/0** ✅ | ~12 sec | 152 schemas; handshake 31 + bridge 121 |
| gate-types | `test:gate-types` | **CLEAN** ✅ | ~5 sec | tsc --noEmit, 0 errors, WO-38 fixed globals.d.ts |
| gate-visual | `test:gate-visual` | **15/0/0** ✅ | ~53 sec | 15 chromium-visual snapshots, 0 diffs |
| gate-a11y | `test:gate-a11y` | **27/0** ✅ | ~21 sec | 0 WCAG AA violations; 2 known issues documented |
| gate-b | `test:gate-b` | **135/7/0** ✅ | 5.5 min | chromium-desktop + chromium-shell-1100 |
| gate-c | `test:gate-c` | **28/148/0** ✅ | 2.4 min | firefox-desktop + webkit-desktop; 1 flake fix (WebKit inspector wait) |
| gate-d | `test:gate-d` | **139/60/0** ✅ | 8.0 min | chromium-mobile-390 + chromium-mobile-640 + chromium-tablet-820 |
| gate-e | `test:gate-e` | **3/0/0** ✅ | 11 sec | asset-parity + diagnostics |
| gate-f | `test:gate-f` | **RUNNING** | ~60-90 min | release-blocking full matrix; result in RC_FREEZE_CHECKLIST.md |

> gate-b through gate-e all GREEN (2026-04-22). gate-f running — to be recorded before GA ceremony.

---

## §5 — Reference decks

Two reference presentations used for regression throughout development:

| Deck | Path | Status |
|------|------|--------|
| v3-prepodovai-pitch | `references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html` | To verify manually |
| v3-selectios-pitch | `references_pres/html-presentation-examples_v3/selectios_pitch_v2_final.html` | To verify manually |

Round-trip validation: open → select element → edit text/style → save → reload → export PPTX → re-import HTML.

---

## §6 — Security posture

Security audit baseline: AUDIT-D (2026-04-20). Findings mapped to WOs:

| Finding | Severity | WO | Resolution |
|---------|----------|----|-----------|
| AUDIT-D-01 HTML sanitization | CRITICAL (single-user context) | WO-01, WO-07 | Resolved — parseSingleRoot filter + trust-banner |
| AUDIT-D-02 bridge payload XSS | HIGH | WO-01 | Resolved — BLOCKED_ATTR_NAMES + UNSAFE_ATTR |
| AUDIT-D-03 pptxgenjs CDN unpinned | HIGH | WO-03 | Resolved — vendored + SRI hash |
| AUDIT-D-04 postMessage wildcard `*` | MEDIUM | WO-05 | Resolved — targetOrigin + event.origin check |
| AUDIT-D-05 autosave quota DoS | LOW | WO-04 | Resolved — size cap + light-snapshot fallback |
| Remaining LOW/MED findings | LOW | — | Documented-accepted; no exploit vector in single-user local context |

**Zero HIGH or CRITICAL open findings ✅**

Note: This editor is designed for single-user local use (`file://`). It is not a server-side application. The security posture is appropriate for this threat model.

---

## §7 — Performance metrics

Measured against v3-prepodovai-pitch (~6 slides, mixed content) on chromium-desktop.

| Metric | Target | Measured |
|--------|--------|---------|
| Cold start (first paint) | ≤ 250 ms | ~120 ms (typical, shell paint) |
| Boot → first-select-possible | ≤ 600 ms | ~350 ms (bridge-ready signal) |
| First-select cost (20 el) | ≤ 10 ms | ~3-5 ms (RAF-coalesced, WO-19) |
| First-select cost (100 el) | ≤ 20 ms | ~8-12 ms (RAF-coalesced, WO-19) |
| History memory (20 steps) | ≤ 2 MB | < 1 MB (hash-dedup patches, WO-18) |

All metrics within target ✅. Measured via `performance.now()` instrumentation in telemetry.js.

---

## §8 — Known deferrals to v1.1+

Items explicitly NOT shipping in v1.0:

| Item | Rationale |
|------|-----------|
| ADR-002 stack-depth indicator visual polish | Badge functional; picker popup deferred |
| ADR-016 Layer 2 (plugin marketplace) | L1 (entity-kind registry) shipped; L2 needs customer validation |
| Live CRDT collaboration (ADR-017) | Readiness infrastructure shipped; live collab deferred to v2.0 |
| God-cache migration P1-05 | `requireEl` lazy accessor pattern; deferred until P1 polish window |
| Full boot.js split (P1-07) | 3/4 splits done (theme/zoom/shell-layout); remaining deferred |
| P1-10 slide rail keyed diff | Performance optimization; functional without it |
| P1-11 autosave debounce | Low impact for single-user; deferred |
| Full TypeScript JSDoc annotation (ADR-011) | tsconfig clean (gate-types); per-module rollout continues post-v1.0 |

---

## §9 — Freeze policy

**RC freeze declared: 2026-04-22**
**Target GA: 2026-05-06** (14-day freeze window)

### Allowed during freeze
- Bug fixes for confirmed regressions
- Documentation updates
- Test flake fixes
- Security patches (if any Critical discovered)

### Banned during freeze
- New features
- Refactoring
- New WOs
- ADR changes (except status promotion)

Ambiguous cases: default = deny. Wait for v1.1.
