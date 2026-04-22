# Release Notes — v1.0.0

> GA ceremony document. To be finalized when `package.json` is promoted from
> `0.37.0-rc.0` → `1.0.0` after the 14-day RC freeze window (target: 2026-05-06).

---

## What is v1.0.0?

**html-presentation-editor v1.0.0** is the first production-ready release.

It delivers on the core product promise: **Open → select → edit → save** for any
HTML presentation file opened via `file://` — without a server, without a build step,
without a framework.

### Who is it for?

Anyone who has an existing HTML slide deck and wants to visually edit it — adjust
text, resize elements, reorder slides, tweak styles — and export it back to clean HTML
or PPTX. No coding required for normal editing tasks.

---

## What's new since v0.25.0 (38 Work Orders, 8 development windows)

### Security (W1 + W2)

- **HTML sanitization** — `parseSingleRoot` filters blocked tags/attrs/URLs; 256 KB cap
  prevents oversized paste attacks (WO-01, P0-02)
- **Trust-Banner** — detects `<script>`, `on*`, `javascript:`, `<iframe>` in loaded decks;
  neutralize-scripts opt-in preserves deck appearance (WO-07, P0-01)
- **pptxgenjs vendored** — removed CDN dependency; SRI hash enforced (WO-03, P0-03)
- **Bridge origin assertion** — `postMessage` validates `event.origin` (WO-02)
- **Crypto bridge token** — handshake token prevents rogue iframe injection (WO-05)
- **Autosave size cap** — prevents localStorage quota DoS (WO-04)

### Accessibility (W2)

- **Keyboard navigation** — full roving tabindex on slide rail; `↑/↓` moves selection;
  `Enter`/`Space` activates; `Escape` deselects (WO-10, P0-05/08)
- **WCAG AA gate** — `axe-core` CI gate: 27 tests, 0 violations (WO-09/10/11, P0-14)
- **Contrast spec** — all interactive elements verified ≥ 4.5:1 contrast ratio (WO-11)

### Bridge Protocol v2 (W3)

- **Hello handshake** — version-negotiated startup; bridge rejects mismatched versions
  (WO-12, P0-10)
- **Schema validators** — 152 message schemas; every bridge message validated at both
  ends; gate-contract 152/0 (WO-13, P0-13)

### Architecture (W3–W4)

- **Observable store** — `ui`/`selection`/`history` slices replace the 75-field god-state;
  subscribe-per-slice pattern; Proxy shim preserves backward compat (WO-16/17, P0-09)
- **Patch-based history** — hash-dedup snapshots; 20 identical steps = baseline only
  (<1 MB vs 14 MB before); budget chip N/20 + toast-on-drop (WO-18, P0-07/11)
- **RAF-coalesce selection** — 7 synchronous render passes → 1 RAF-coalesced pass;
  first-select cost: ~3-5 ms (was 15-80 ms) (WO-19, P0-12)
- **Module splits** — selection.js, boot.js, feedback.js split into focused modules
  (WO-20/21/22/23)

### UX (W5–W6)

- **Broken-asset recovery** — banner enumerates missing assets; one-click "Connect
  folder" action; not just a silent load failure (WO-24, P0-04)
- **Starter-deck onboarding** — `Open / Starter / Paste` order; starter-deck fixture
  relocated to `editor/fixtures/` (WO-25, P0-15)
- **Transform resolve** — inspector transform field + Resolve action in banner;
  no more "transform — use inspector" dead-end (WO-26, P0-06)
- **Snap-to-siblings + smart guides** — precision alignment during drag/resize;
  1 bridge round-trip per drag (WO-28)
- **Banner unification** — centralized `renderBlockReasonBanner()`; `#lockBanner` removed;
  P1-01/P1-02 geometry leak fixed (WO-29)
- **Multi-select toast** — shift-click selection feedback in basic mode (WO-31)

### Visual quality + platform (W7)

- **Design tokens v2** — 32 semantic Layer 2 tokens; inspector.css fully migrated
  from primitives to semantic tokens (WO-30)
- **Visual regression gate** — 15 PNG baselines at 1440×900 in both themes; 0 pixel
  regressions (WO-32)
- **Entity-kind registry** — 13 entity kinds; bridge-commands + bridge-script use
  unified `entity-kinds.js` (WO-35)
- **Tablet honest-block** — drag/resize/rail blocked ≤820px with explanatory banners;
  tap-select and inline text editing preserved (WO-33)
- **Telemetry viewer** — 5 performance/diagnostic API; advanced-mode panel; TV9
  purity spec ensures no telemetry leaks into export (WO-34)

### Quality (W8)

- **Flake elimination** — 0 `waitForTimeout`, 0 `waitForFunction(eval)`, 0 `page.once`
  in all test specs; LN3 race condition fixed (WO-36)
- **Declarative shortcuts** — 29-entry `KEYBINDINGS` registry; shortcuts modal with
  full table; `isAdvancedMode()` accessor for conditional binding (WO-37)
- **TypeScript types** — `tsc --noEmit` clean; `globals.d.ts` complete; all bridge,
  selection, and helper functions declared (WO-38)

---

## Gate results (RC freeze, 2026-04-22)

| Gate | Result | Notes |
|------|--------|-------|
| gate-a (chromium regression) | **65/5/0** ✅ | 55 invariant + 10 added |
| gate-b (full regression, 2 projects) | **135/7/0** ✅ | chromium-desktop + shell-1100 |
| gate-c (firefox + webkit) | **28/148/0** ✅ | 1 WebKit timing fix |
| gate-d (mobile/tablet 3 viewports) | **139/60/0** ✅ | incl. tablet-honest |
| gate-e (asset-parity) | **3/0/0** ✅ | |
| gate-f (full matrix) | **1410/629/0** ✅ | 1.3h, 10 projects, 0 failures |
| gate-contract (152 bridge schemas) | **152/0** ✅ | |
| gate-visual (1440×900 snapshots) | **15/0/0** ✅ | |
| gate-a11y (WCAG AA) | **27/0** ✅ | 0 violations |
| gate-types (tsc --noEmit) | **CLEAN** ✅ | 0 errors |

---

## Performance

Measured against v3-prepodovai-pitch on chromium-desktop:

| Metric | Target | Achieved |
|--------|--------|---------|
| Cold start (first paint) | ≤ 250 ms | ~120 ms |
| Boot → first-select-possible | ≤ 600 ms | ~350 ms |
| First-select cost (20 elements) | ≤ 10 ms | ~3-5 ms |
| First-select cost (100 elements) | ≤ 20 ms | ~8-12 ms |
| History memory (20 steps) | ≤ 2 MB | < 1 MB |

---

## Security posture

**Zero HIGH or CRITICAL open findings.** 5 AUDIT-D findings resolved in W1/W2.

This editor is designed for single-user local use (`file://`). It is not a
server-side application. The security posture is appropriate for this threat model.

---

## Known limitations (deferred to v1.1+)

- ADR-002: Stack depth indicator visual polish (badge functional; picker popup deferred)
- ADR-016 L2: Plugin marketplace (entity-kind registry L1 shipped; L2 needs validation)
- Live CRDT collaboration (ADR-017): readiness infrastructure shipped; live collab v2.0
- God-cache migration P1-05: `requireEl` lazy accessor pattern
- Full boot.js split P1-07: 3/4 splits done; remaining deferred
- P1-10 slide rail keyed diff: performance optimization; functional without
- Full TypeScript JSDoc annotation: tsconfig clean; per-module rollout continues

---

## Upgrade path

v1.0.0 is a zero-install release. To use:
1. Clone the repository (or download the release archive)
2. Open `editor/presentation-editor.html` in your browser
3. Use the `Open HTML` button or paste HTML to load your deck

No build step. No package install. Works from `file://` or any static web server.

---

## GA ceremony checklist (to be completed 2026-05-06)

```
□ gate-f result recorded in RC_FREEZE_CHECKLIST.md §4
□ Reference deck smoke: prepodovai + selectios end-to-end (manual)
□ Any RC freeze bugs fixed + verified
□ package.json version: 0.37.0-rc.0 → 1.0.0
□ git commit -am "chore(release): v1.0.0 — Road complete"
□ git tag -a v1.0.0 -m "v1.0: file:// editor ready for production use"
□ git push origin main --tags
□ gh release create v1.0.0 --title "v1.0.0: Ready for production" --notes-file docs/RELEASE-v1.0.md
□ Obsidian: PROJ - Road to v1.0 → status: done
□ Obsidian: create PROJ - v1.x Maintenance
```
