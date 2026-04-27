# ADR-031 — UX Overhaul v2.1 (post-GA polish to public GA candidate)

**Status:** Proposed → Accepted (at end of v2.1.0-rc.1 verification)
**Date:** 2026-04-28
**Branch:** claude/ux-deep-overhaul-v2.1
**Authors:** UX Overhaul Lead Architect (autonomous session, supervised by repo owner)
**Supersedes:** none
**Related:** ADR-013 (Observable Store), ADR-014 (banner/toast layer), ADR-019 (semantic token Layer 2), ADR-031 (iframe-bridge extraction), ADR-032 (store-slice phases), ADR-033 (assetResolver slice)

## Status

> [!warning] Proposed (will flip to Accepted after Gate-F green)

## Context

`v2.0.0` shipped 2026-04-24 as **internal GA / public beta**. Thirty post-GA polish tags (v2.0.1 → v2.0.30) closed audit findings, FLAKE-sweeps, A11Y boosts, store-slice extractions, and two recent UX bugfixes. The codebase is stable: Gate-A 317-318/8/0-1 (with documented perf-budget noise tolerance), Gate-A11Y 27/0/0, Gate-Contract 152/0.

A four-axis UX audit (heuristics + a11y + visual + competitive) on 2026-04-28 surfaced **52 deduplicated pain points** ([PAIN-MAP-UX-v2.1-2026-04-28.md](audit/PAIN-MAP-UX-v2.1-2026-04-28.md)) clustered into **10 cross-cutting themes**:

1. Status surface redundancy
2. Type-scale escape hatches + spacing rhythm bypass
3. Basic-mode contract leakage (inspector controls leaking into AT)
4. Empty state hierarchy still 60/40 (not 80/20)
5. Topbar density + duplicate identity
6. RU/EN copy mixing + tech jargon
7. A11Y structural gaps (modals + menus + skip-link)
8. Selection-feedback overload
9. Inspector flat hierarchy
10. Keyboard discoverability

These are not bugs — the editor is functionally complete. They are the difference between "functionally GA" and "feels like a paid tool". The same architectural invariants that brought us here must continue to hold.

## Decision

Execute a **time-boxed, atomic-patch UX overhaul** in 5 phases (C foundations / D1 topbar+empty / D2 inspector+rail / D3 transient surfaces / E journey polish), targeting tag **v2.1.0-rc.1** at end of session. The blueprint is [UX-BLUEPRINT-v2.1.md](UX-BLUEPRINT-v2.1.md).

### What we change

- **Tokens (Phase C):** add `--text-3xl: 28px` for hero/landing displays. Document `--text-2xs (10px)` as decorative-only. No new spacing primitives — instead eliminate off-grid 14px usage in Phase D.
- **Topbar (D1):**
  - Drop dual identity (eyebrow + h1) — h1 absorbs deck filename when loaded
  - Reduce inline commands from 7 → 3 (Open / Show / Export HTML); rest into `⋯` overflow
  - **Status pill consolidation:** delete `#interactionStatePill`, `#previewLifecyclePill`, `#workspaceStateBadge`. Single source of truth = `#saveStatePill` with crisp copy: `Сохранено · HH:MM` / `Не сохранено · HH:MM` / `Загрузка превью…`
- **Empty state (D1):**
  - Visual weight 80/20 (Open primary solid; Paste demoted to ghost-link)
  - Iframe title English → Russian (`title="Превью презентации"`)
  - Skip-link added as first body child
- **Preview-note (D1):** trim from 11 elements to ≤4. Drop eyebrow + body text + duplicate pills (now in topbar)
- **Inspector (D2):**
  - **Basic-mode contract enforcement:** `inspectorPanel` becomes `hidden` + `inert` when `data-editor-workflow="empty"` (not just CSS-hidden) — closes AT leakage
  - Rearrange basic mode to: empty-hint FIRST → insertSection second
  - Gate `selectionModeToggle`, `selectionBreadcrumbs`, `stackDepthBadge` to advanced
  - Drop redundant `<h3>Текущий элемент</h3>` (summary-card already provides title)
  - Move close-button to absolute corner; separate from mode-toggle
  - `#deleteCurrentSlideBtn` → danger-btn class + position last
  - Section rhythm: prominent vs collapsed-by-default; accent-border-left on relevant section
  - All mode-toggle buttons: declare `aria-pressed` in HTML (progressive enhancement)
- **Slide rail (D2):** drop LED dot; replace scale-hover with background tint
- **Floating toolbar (D3):**
  - **Content-aware filtering:** text-only OR image-only OR container (not all 17 buttons at once)
  - Drag-handle becomes non-interactive visual (CSS rail) — not a button
  - Collapse button moves to right edge (away from delete)
- **Modals (D3):** all 4 get `role=dialog aria-modal aria-labelledby` + heading-level normalization
- **Context menu (D3):** items get `role=menuitem`; container gets `aria-orientation`
- **Beta badge (D3):** font 10→11; color darkened to ≥4.5:1
- **Toasts (D3):** `role=alert` for errors (assertive); rest stays polite
- **Shortcuts (D3):** Esc unwinds overlays (palette/picker/menu/selection in order)
- **Motion (E):** workflow marker transitions get 180ms opacity fades; prefers-reduced-motion honored; selection feedback uses `--motion-base` token
- **Toast position (E):** desktop top-right → bottom-right (consistent with mobile)

### What we explicitly do NOT change

- iframe + bridge + modelDoc architecture (per all SoT invariants)
- No bundler / build step / `type="module"`
- No new runtime dependencies
- bridge-script.js untouched (3 906-line template literal stays out of scope)
- PPTX export pipeline (separate POST_V2_ROADMAP P0)
- Smart Import "full" mode (separate POST_V2_ROADMAP P1)
- Mobile editing capabilities (still honest-block per ADR-018)
- gate-a11y test expansion beyond protecting current 27 (the +28 tests proposed by A2 audit ship as separate WO)
- AAA contrast (deliberate AA stance per A2-F18)
- Tome-style AI deck generation, live cursors, cloud sync (per ADR-017/028)

### What we defer to v2.1.0 (post-rc.1) or v2.1.x

- P-27 selection mode jargon rename (needs separate naming ADR)
- P-33 block-reason canvas-near surface (needs floating-banner component)
- P-35 selection-frame Tab-stop reduction (needs handle-grouping rework)
- P-38 restore banner empty-state integration (significant DOM rewrite)
- P-45 layers panel (M-effort feature, P2)
- 28 new gate-a11y tests (separate WO using A2's plan)
- P2 PAIN-MAP items overall (~16 items)

## Consequences

### Positive

- Closes the visible "feels unfinished" gap between v2.0.30 and a public-GA candidate
- Honors all 10 themes from cross-cutting audit synthesis
- All changes inside §6 invariants — zero architectural risk
- Atomic patches with Gate-A green at every commit boundary — safe rollback any time
- Builds on existing semantic token system (Layer 2) — no parallel design system
- Foundation for the next minor: type-scale `--text-3xl` becomes the standard hero step; status-pill consolidation simplifies all future state additions
- Makes the editor screen-reader-coherent (closes 2 CRIT a11y findings: modal dialogs, context-menu items)
- Sets up content-aware floating toolbar pattern (P3 from competitive teardown — Pitch's bubble-bar direction validated)

### Negative

- Test churn: D1.5 (status-pill consolidation) requires updating `shell.smoke.spec.js`, `honest-feedback.spec.js`, `error-recovery-boundary.spec.js`. Risk: mis-updates cascade into Gate-A red. Mitigation: each test update is part of the same atomic commit as the source change; Gate-A run after every commit
- The empty-state visual weight change (D1.3) may surprise users coming from v2.0.29
- Removing the eyebrow ("Живой HTML-редактор") may feel like loss of brand voice. Acceptable: brand is in the install/repo-readme tier, not in every shell-frame
- Floating toolbar content filtering (D3.4) may regress for users who expected to see all options always
- 3-7 patches in D1+D2+D3 modify the same `presentation-editor.html` shell — must run serially. Cannot parallelize sub-agents within a phase

### Neutral

- No bundle-size impact (still no bundle)
- No file:// regression (zero changes to load path)
- Bridge stays untouched (zero risk of cross-frame protocol breakage)
- POST_V2_ROADMAP P0/P1 items (PPTX, Smart Import, gate-a11y test count) progress separately

## Applied in

- [Phase C foundation patches](#) — tokens.css
- [Phase D1 patches](#) — topbar, empty state, status consolidation
- [Phase D2 patches](#) — inspector, rail
- [Phase D3 patches](#) — modals, context menu, floating toolbar
- [Phase E patches](#) — motion, journey transitions

## Verification at acceptance

For this ADR to flip to **Accepted**, ALL of:

1. `npm run test:gate-a` returns **no NEW failures** vs baseline (perf-budget noise flake acceptable per CHANGELOG v2.0.26 RETRY precedent)
2. `npm run test:gate-a11y` returns ≥ 27/0/0 (no regressions)
3. `npm run test:gate-contract` returns 152/0
4. `npm run typecheck` clean
5. Manual journey 5x on 3 decks (prepodovai, selectios, basic): open → click empty CTA → select slide → click element → modify in inspector → undo/redo → export
6. F12 console: no errors during manual journey
7. Vault: Daily/2026-04-28 + this ADR Accepted + PROJ updated + CHANGELOG entry
8. `package.json version` = 2.1.0-rc.1; tag set on branch HEAD; pushed
9. Branch NOT merged to main (human review required)

## Rollback strategy

Each phase produces atomic commits. If any single commit fails Gate-A on a fresh run:
- `git revert <SHA>` immediately
- Document in TodoWrite which patch reverted + reason
- Continue with next patch
- Tag still requires final Gate-A green

If half the phases fail to ship:
- Re-tag as v2.0.31 instead of v2.1.0-rc.1
- The successful patches still ship as polish
- Failed phases queued in PAIN-MAP for next session

## Notes for future agents

- The PAIN-MAP is the source of truth for what's open. Update item status as patches land.
- The 28 new gate-a11y tests A2 proposed are NOT in scope this overhaul. They are tracked as a separate workstream toward POST_V2_ROADMAP P0 "gate-a11y expansion".
- The competitive teardown's P9 (layers panel) is a strategic differentiator — queue for v2.2 or v3.

## Links

- [PAIN-MAP-UX-v2.1-2026-04-28.md](audit/PAIN-MAP-UX-v2.1-2026-04-28.md)
- [UX-BLUEPRINT-v2.1.md](UX-BLUEPRINT-v2.1.md)
- [UX-AUDIT-A1-heuristics-2026-04-28.md](audit/UX-AUDIT-A1-heuristics-2026-04-28.md)
- [UX-AUDIT-A2-a11y-2026-04-28.md](audit/UX-AUDIT-A2-a11y-2026-04-28.md)
- [UX-AUDIT-A3-visual-2026-04-28.md](audit/UX-AUDIT-A3-visual-2026-04-28.md)
- [UX-AUDIT-A4-competitive-2026-04-28.md](audit/UX-AUDIT-A4-competitive-2026-04-28.md)
- [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md)
- [POST_V2_ROADMAP.md](POST_V2_ROADMAP.md)
