# RC FREEZE CHECKLIST — v0.37.0-rc.0 → v1.0.0

> Operational checklist for WO-38 RC freeze declaration.
> Generated: 2026-04-22 · Single source of truth for release-readiness state.
> For the declarative definition, see `docs/RELEASE_CRITERIA.md`.

---

## §1 — WO Completion

All 38 Work Orders (WO-01 through WO-38) verified merged to main:

| WO | Title | Commit | Tag | Status |
|----|-------|--------|-----|--------|
| WO-01 | parseSingleRoot sanitize | 74b963d | v0.26.1 | ✅ Done |
| WO-02 | Bridge origin assertion | (merged W1) | v0.26.4 | ✅ Done |
| WO-03 | pptxgenjs vendor SRI | (merged W1) | v0.26.2 | ✅ Done |
| WO-04 | Session storage cap | (merged W1) | v0.26.5 | ✅ Done |
| WO-05 | Crypto bridge token | (merged W1) | v0.26.3 | ✅ Done |
| WO-06 | Broken-asset sandbox audit | 37c9458 | v0.27.1 | ✅ Done |
| WO-07 | Trust-Banner neutralize | f9a239d | v0.27.3 | ✅ Done |
| WO-08 | Bridge schema scaffold | 8662313 | v0.27.0 | ✅ Done |
| WO-09 | gate-a11y axe gate | (merged W2) | v0.27.2 | ✅ Done |
| WO-10 | Keyboard nav completeness | a732d04 | v0.27.4 | ✅ Done |
| WO-11 | Contrast spec | 9551c35 | v0.27.5 | ✅ Done |
| WO-12 | Bridge v2 hello handshake | f76d94b | v0.28.0 | ✅ Done |
| WO-13 | Bridge schema validators | afb7d4f | v0.28.3 | ✅ Done |
| WO-14 | Types bootstrap | 7ed316b | v0.28.1 | ✅ Done |
| WO-15 | Telemetry scaffold | e86b03f | v0.28.2 | ✅ Done |
| WO-16 | Observable store + ui slice | 9e60d1b | v0.28.4 | ✅ Done |
| WO-17 | Selection slice migration | bd32ae0 | v0.28.5 | ✅ Done |
| WO-18 | History slice + patch-based | f3f85d8 | v0.29.0 | ✅ Done |
| WO-19 | RAF-coalesce selection render | (merged W4) | v0.29.1 | ✅ Done |
| WO-20 | selection.js → layers-panel.js | (merged W4) | v0.29.2 | ✅ Done |
| WO-21 | selection.js → floating-toolbar.js | (merged W4) | v0.29.3 | ✅ Done |
| WO-22 | boot.js → theme+zoom+shell-layout | (merged W4) | v0.29.4 | ✅ Done |
| WO-23 | feedback.js → surface-manager+banners | (merged W4) | v0.29.5 | ✅ Done |
| WO-24 | Broken-asset recovery banner | 68314f0 | v0.30.0 | ✅ Done |
| WO-25 | Starter-deck CTA rehome | 8cf563e | v0.30.1 | ✅ Done |
| WO-26 | Transform resolve banner | f9fe9fc | v0.30.2 | ✅ Done |
| WO-27 | Undo-budget chip | — | — | ✅ Superseded by WO-18 |
| WO-28 | Snap-to-siblings + guides | (merged W6) | v0.31.1 | ✅ Done |
| WO-29 | Banner unification | (merged W6) | v0.31.2 | ✅ Done |
| WO-30 | Tokens v2 semantic layer | 55ffbf2 | v0.32.1 | ✅ Done |
| WO-31 | Shift-click multi-select toast | (merged W6) | v0.31.0 | ✅ Done |
| WO-32 | gate-visual 1440×900 | 9c9f7db | v0.32.0 | ✅ Done |
| WO-33 | Tablet honest-block | f1f2613 | v0.32.3 | ✅ Done |
| WO-34 | Telemetry viewer | e58e5ed | v0.32.4 | ✅ Done |
| WO-35 | Entity-kind registry | c61381f | v0.32.2 | ✅ Done |
| WO-36 | Flake elimination | 637e0c1 | v0.33.0 | ✅ Done |
| WO-37 | Declarative shortcuts + isAdvancedMode | 0563752 | v0.33.1 | ✅ Done |
| WO-38 | RC freeze declaration | (this commit) | v0.37.0-rc.0 | ✅ Done |

**37/37 feature WOs complete. WO-27 superseded by WO-18.**

---

## §2 — P0 Audit

All 15 P0 items annotated in `docs/audit/PAIN-MAP.md` §"P0 Resolution log":

| # | Status | Resolved in |
|---|--------|------------|
| P0-01 | ✅ Resolved | WO-06/07/12, v0.27.3 |
| P0-02 | ✅ Resolved | WO-01, v0.26.1 |
| P0-03 | ✅ Resolved | WO-03, v0.26.2 |
| P0-04 | ✅ Resolved | WO-24, v0.30.0 |
| P0-05 | ✅ Resolved | WO-10/37, v0.27.4+v0.33.1 |
| P0-06 | ✅ Resolved | WO-26, v0.30.2 |
| P0-07 | ✅ Resolved | WO-18, v0.29.0 |
| P0-08 | ✅ Resolved | WO-10, v0.27.4 |
| P0-09 | ✅ Resolved | WO-16/17/18, v0.28.4–v0.29.0 |
| P0-10 | ✅ Resolved | WO-12/13, v0.28.0+v0.28.3 |
| P0-11 | ✅ Resolved | WO-18, v0.29.0 |
| P0-12 | ✅ Resolved | WO-19, v0.29.1 |
| P0-13 | ✅ Resolved | WO-13, v0.28.3 |
| P0-14 | ✅ Resolved | WO-09/10/11, v0.27.5 |
| P0-15 | ✅ Resolved | WO-25, v0.30.1 |

**15/15 P0 items resolved ✅**

---

## §3 — ADR Audit

`grep "Status.*Proposed" docs/ADR-0{01..20}*.md` → **0 matches ✅**

| Range | Status |
|-------|--------|
| ADR-001..005 | Accepted/Deferred ✅ |
| ADR-006..007 | Accepted ✅ |
| ADR-008..010 | Not created (skipped range) |
| ADR-011..015 | Accepted ✅ |
| ADR-016..020 | Accepted (L1/readiness) or Deferred (L2/live-collab) ✅ |

---

## §4 — Gate Matrix (WO-38 runs, 2026-04-22)

| Gate | Result | Timestamp | Command |
|------|--------|-----------|---------|
| gate-a | **65/5/0** ✅ | 2026-04-22 | `npm run test:gate-a` |
| gate-contract | **152/0** ✅ | 2026-04-22 | `npm run test:gate-contract` |
| gate-types | **0 errors** ✅ | 2026-04-22 | `npm run test:gate-types` |
| gate-visual | **15/0/0** ✅ | 2026-04-22 | `npm run test:gate-visual` |
| gate-a11y | **27/0** ✅ | 2026-04-22 | `npx playwright test tests/a11y/` |
| gate-b | **135/7/0** ✅ | 2026-04-22 | `npm run test:gate-b` |
| gate-c | **28/148/0** ✅ | 2026-04-22 | `npm run test:gate-c` |
| gate-d | **139/60/0** ✅ | 2026-04-22 | `npm run test:gate-d` |
| gate-e | **3/0/0** ✅ | 2026-04-22 | `npm run test:gate-e` |
| gate-f | **RUNNING** | 2026-04-22 | `npm run test:gate-f` |

> gate-b through gate-e all GREEN. gate-f (full matrix, ~90 min) still running — result to be recorded before GA ceremony.
> Note: gate-c required one test fix (shell.smoke.spec.js line 952): WebKit click→inspector transition needed explicit `#currentSlideSection` hidden wait.

---

## §5 — Reference Deck Parity

| Deck | Load | Select | Edit | Export | Re-import | Status |
|------|------|--------|------|--------|-----------|--------|
| v3-prepodovai-pitch | ✓ | ✓ | ✓ | ✓ | ✓ | ✅ Pass (manual, WO-01 through WO-37 regression) |
| v3-selectios-pitch | ✓ | ✓ | ✓ | ✓ | ✓ | ✅ Pass (manual, WO-01 through WO-37 regression) |

Both decks load, edit, export, and re-import clean throughout the entire development cycle (verified per-WO).

---

## §6 — Security Findings Resolved

| AUDIT-D # | Finding | Severity | WO | Status |
|-----------|---------|----------|----|--------|
| AUDIT-D-01 | No HTML sanitization | CRITICAL | WO-01, WO-07 | ✅ Resolved |
| AUDIT-D-02 | Bridge payload XSS | HIGH | WO-01 | ✅ Resolved |
| AUDIT-D-03 | pptxgenjs CDN unpinned | HIGH | WO-03 | ✅ Resolved |
| AUDIT-D-04 | postMessage wildcard `*` | MEDIUM | WO-05 | ✅ Resolved |
| AUDIT-D-05 | autosave quota DoS | LOW | WO-04 | ✅ Resolved |
| Other LOW/MED | Various | LOW | — | ✅ Documented-accepted |

**Zero HIGH/CRITICAL open ✅**

---

## §7 — Performance Metrics

Measured against v3-prepodovai-pitch on chromium-desktop, 2026-04-22:

| Metric | Target | Measured | Status |
|--------|--------|---------|--------|
| Cold start | ≤ 250 ms | ~120 ms | ✅ |
| Boot → first-select | ≤ 600 ms | ~350 ms | ✅ |
| First-select 20 el | ≤ 10 ms | ~3-5 ms | ✅ |
| First-select 100 el | ≤ 20 ms | ~8-12 ms | ✅ |
| History memory 20 steps | ≤ 2 MB | <1 MB | ✅ |

---

## §8 — Freeze Policy Declaration

**Freeze start:** 2026-04-22
**Freeze end / target GA:** 2026-05-06 (14 days)

**Allowed:**
- [x] Bug fixes for confirmed regressions
- [x] Documentation updates
- [x] Test flake fixes
- [x] Critical security patches

**Banned:**
- [ ] New features
- [ ] Refactoring
- [ ] New WOs
- [ ] ADR changes

---

## §9 — Obsidian Vault Sync

| File | Updated | Notes |
|------|---------|-------|
| `Daily/2026-04-22.md` | ✅ | WO-38 RC freeze work-log |
| `4-Changelog/CHANGELOG.md` | ✅ | v1.0.0-rc entry mirrored |
| `3-Projects/PROJ - Track-1 Execution v1.0.md` | ✅ | Status: W8 complete, RC freeze |
