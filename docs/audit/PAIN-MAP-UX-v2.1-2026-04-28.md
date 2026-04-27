# PAIN-MAP-UX-v2.1 (2026-04-28)

**Synthesizer:** UX Overhaul Lead Architect
**Inputs:** UX-AUDIT-A1 (heuristics, 38), A2 (a11y, 18 + 28-test plan), A3 (visual/copy, ~40), A4 (competitive, 16 patterns)
**Baseline:** v2.0.30, Gate-A 317-318/8/0-1 (perf-budget noise documented)
**Branch:** claude/ux-deep-overhaul-v2.1

## Cross-cutting themes (the 10 reasons it doesn't yet "feel premium")

| # | Theme | Audit refs | Severity |
|---|-------|------------|----------|
| T1 | Status surface redundancy (3 pills for one state) | A1-F4/F10/F11/F29, A2-F10, A3-#5/#13 | HIGH |
| T2 | Type-scale escape hatches (sub-pixel fonts) + spacing rhythm bypass | A3-typo/spacing, A1-F29 | HIGH |
| T3 | Basic-mode contract leakage (inspector controls leak to AT) | A1-F7/F17/F22, A2-F11 | CRIT |
| T4 | Empty state hierarchy still 60/40 (not 80/20) | A1-F2/F3, A3-#6/#7, A4-P1 | HIGH |
| T5 | Topbar density + duplicate identity (2 brand lines, 7 buttons) | A1-F1/F6/F8/F13, A2-F6, A3-#4 | HIGH |
| T6 | RU/EN copy mixing + tech jargon (shell/iframe/bridge/preset) | A1-F19/F20/F24/F35, A3-copy, A2-F5 | MED |
| T7 | A11Y structural gaps in modals + menus + skip-link | A2-F1/F2/F4/F6/F7 | CRIT |
| T8 | Selection-feedback overload (handles burden, label off-screen) | A1-F25/F26/F27/F34/F37, A2-F13/F14, A4-P3 | HIGH |
| T9 | Inspector flat hierarchy (equal-weight sections, buried summary) | A1-F16/F22/F23/F33, A3-label-voice | HIGH |
| T10 | Keyboard discoverability (no Esc/o; floating toolbar unreachable) | A4-P6/P7, A2-F7/F12 | MED |

## Pain map (deduplicated, prioritized)

| ID | Sev | Source | Theme | Area | Pain (1 line) | Fix-cost | Inv-check | Priority |
|----|-----|--------|-------|------|---------------|----------|-----------|----------|
| P-01 | CRIT | A2-F1 | T7 | Modals (4) | `<div class="modal">` lacks role=dialog/aria-modal/aria-labelledby; SR doesn't announce as dialog | S | PASS | **P0** |
| P-02 | CRIT | A2-F2 | T7 | Context menu | items have tabindex=-1 but no role=menuitem; ARIA menu pattern broken | S | PASS | **P0** |
| P-03 | CRIT | A1-F7 | T3 | Inspector | density-toggle in DOM at empty state — leaks to AT despite visual hide | S | PASS | **P0** |
| P-04 | CRIT | A1-F2 | T4 | Empty state | primary vs secondary CTA visual weight 60/40, SoT mandates 80/20 | S | PASS | **P0** |
| P-05 | CRIT | A1-F11 | T1 | Preview-note | 11 UI elements in one card (eyebrow, title, body, 2 badges, 4 buttons, 2 pills) | M | PASS | **P0** |
| P-06 | HIGH | A1-F4 | T1 | Status pills | 3 redundant lifecycle pills (workspaceStateBadge / interactionStatePill / previewLifecyclePill) | M | PASS | **P0** |
| P-07 | HIGH | A1-F8 | T5 | Topbar | 7 commands inline (Theme/Undo/Redo/Open/Show/Export/Export-PPTX) — exceeds M3 limit of 3-4 | M | PASS | **P0** |
| P-08 | HIGH | A1-F6 | T5 | Topbar | duplicate identity (eyebrow "Живой HTML-редактор" + h1 "HTML Presentation Editor" + meta) | S | PASS | **P0** |
| P-09 | HIGH | A1-F22 | T9 | Inspector empty | "insert" buttons rendered before "edit existing" hint — inverted frequency | S | PASS | **P0** |
| P-10 | HIGH | A1-F29 + A3 | T2 | Pills | `#interactionStatePill, #previewLifecyclePill { font-size: 9px }` — illegible | S | PASS | **P0** |
| P-11 | HIGH | A1-F17 | T3 | Inspector basic | summary-card buried under 7 chrome controls (smartMode, breadcrumbs, stack-depth) before the "human label" promise pays out | L (ADR) | PASS | **P0** |
| P-12 | HIGH | A1-F18 | T9 | Inspector header | mode-toggle adjacent to close-button (Fitts's Law misclick risk) | S | PASS | **P1** |
| P-13 | HIGH | A1-F25 | T8 | Floating toolbar | 17 buttons + 2 selects + color picker visible at once (~600px wide blocking canvas) | M | PASS | **P0** |
| P-14 | HIGH | A2-F3 | T2 | Beta badge | `.experimental-badge` 10px orange-on-orange ~4.0:1, fails AA | S | PASS | **P1** |
| P-15 | HIGH | A2-F6 | T7 | A11Y | no skip-link to main workspace; 12+ Tab stops to reach rail | S | PASS | **P1** |
| P-16 | HIGH | A2-F7 | T10 | Floating toolbar | not keyboard-discoverable (no shortcut to focus it) | M | PASS | **P1** |
| P-17 | HIGH | A2-F5 | T6 | Iframe title | `title="Preview"` English in `<html lang="ru">` | S | PASS | **P1** |
| P-18 | HIGH | A1-F16 | T9 | Inspector | summary-card AND `<h3>Текущий элемент</h3>` redundant (title twice) | S | PASS | **P1** |
| P-19 | HIGH | A1-F33 | T9 | Inspector body | 7+ sections all equal-weighted (16px padding + border-top) — no scan rhythm | M | PASS | **P1** |
| P-20 | HIGH | A1-F10 | T1 | Save status | `#saveStatePill` + `#workspaceStateBadge` both about persistence — 2 sources of truth | S | PASS | **P1** |
| P-21 | HIGH | A3-typo | T2 | Type scale | 7 escape-hatch font-sizes (9/10.5/11.5/12.5/15/17/32 px) in preview.css alone | S | PASS | **P0** (foundation) |
| P-22 | HIGH | A3-spacing | T2 | Spacing rhythm | `12px 14px` repeats across 8+ files; 4-pt grid bypassed in ~70% of declarations | M | PASS | **P1** |
| P-23 | HIGH | A4-P3 | T8 | Floating toolbar | content-aware filtering missing (text+image+align all rendered, partially hidden) | S | PASS | **P1** |
| P-24 | HIGH | A4-P6 | T10 | Shortcuts | no universal Esc-to-exit-overlay; no `o` overview shortcut | S | PASS | **P1** |
| P-25 | HIGH | A1-F23 | T9 | Slide actions | "Удалить слайд" not visually distinguished, sits next to "Дублировать" | S | PASS | **P1** |
| P-26 | MED | A1-F12 | T10 | Mode toggle | `editModeBtn[disabled]` no tooltip explaining why — silent block | S | PASS | **P1** |
| P-27 | MED | A1-F19 | T6 | Selection mode | "⊞ Листы / ▣ Группы" jargon symbols instead of presenter-language | M | PASS | **P2** |
| P-28 | MED | A1-F20 | T6 | Insert palette | mixed icon convention (HTML-tag + cyrillic + emoji + symbol) | S | PASS | **P1** |
| P-29 | MED | A2-F4 | T7 | Menus | `aria-orientation` missing on 3 role=menu containers | S | PASS | **P1** |
| P-30 | MED | A2-F11 | T3 | Mode toggles | initial `aria-pressed` not in HTML (JS-only) — fails progressive enhancement | S | PASS | **P1** |
| P-31 | MED | A1-F30/F31 | T9 | Slide rail | dot LED + scale(1.02) hover compete with active state — disorienting | S | PASS | **P1** |
| P-32 | MED | A1-F26 | T8 | Float toolbar | drag-handle (⋮⋮) and collapse (▾) styled as buttons next to delete (🗑) — misclick | S | PASS | **P1** |
| P-33 | MED | A1-F36 | T8 | Block-reason | banner buried in inspector — user editing canvas misses it | M | PASS | **P2** |
| P-34 | MED | A2-F10 | T7 | Toast role | error toasts use polite live region — should be role=alert | M | PASS | **P1** |
| P-35 | MED | A2-F13 | T7/T8 | Selection frame | 9 Tab-stops (frame + 8 handles) per selection — burden | M | PASS | **P2** |
| P-36 | MED | A2-F8 | T2 | Contrast | `--shell-text-muted` on `--shell-field-bg` borderline (~4.6:1) — extend test | S | PASS | **P1** |
| P-37 | MED | A2-F9 | T7 | Modal headings | h3 → h4 hierarchy skip in 4 modals | S | PASS | **P1** |
| P-38 | MED | A1-F9 | T1 | Restore banner | sits above topbar, competes visually with empty-state hero | M | PASS | **P2** |
| P-39 | MED | A1-F38 | T9 | Workspace settings | wrong location (in inspector, should be in topbar overflow) | S | PASS | **P1** |
| P-40 | MED | A1-F35 | T6 | Spinner copy | "iframe и движка презентации" jargon | S | PASS | **P1** |
| P-41 | MED | A3-#3 | T6 | Tooltips | "shell", "iframe", "bridge" leak in user-facing strings (5+ places) | S | PASS | **P1** |
| P-42 | MED | A3-#10/#11 | T6 | Inspector | "preset" written 4 different ways (preset/Preset/пресет/preset-замена); "Изображение / media" mixed alphabet | S | PASS | **P1** |
| P-43 | MED | A3-#13 | T6 | Lifecycle pills | passive vs imperative voice drift across pill messages | S | PASS | **P1** |
| P-44 | MED | A1-F34 | T8 | Selection label | `top: -34px` clips off-screen on first slide row | S | PASS | **P2** |
| P-45 | MED | A4-P9 | T9 | Layers panel | competitors ship layers/structure pane; we have stack-depth chip but no panel for nav | M | PASS | **P2** |
| P-46 | LOW | A1-F14 | T5 | Theme toggle | "🌓 Тема" doesn't reflect current state | S | PASS | **P1** |
| P-47 | LOW | A1-F15/F32 | T9 | Slide rail header | "0 слайдов" placeholder leaks; menu-trigger button looks like delete | S | PASS | **P2** |
| P-48 | LOW | A1-F37 | T8 | Selection frame protected | dashed amber blends with photo backgrounds — needs halo | S | PASS | **P2** |
| P-49 | LOW | A2-F15 | T7 | Focus ring | uses box-shadow (clipped by overflow:auto inspector); should use outline | S | PASS | **P2** |
| P-50 | LOW | A2-F16 | T7 | Starter btn | aria-label overrides visible text — voice control fails | S | PASS | **P1** |
| P-51 | LOW | A3-contrast | T2 | Footnote | `.empty-state-footnote` effective alpha ~0.62 → ~4.1:1 contrast (fails AA) | S | PASS | **P1** |
| P-52 | LOW | A1-F21 | T8 | Toast position | desktop top-right vs mobile bottom-center — inconsistent | S | PASS | **P2** |

## Priority bands

- **P0 (must close in v2.1.0-rc.1)** — 11 items: P-01 to P-11 + P-21 (foundation)
  - All CRIT severities + 4 HIGH structural items + the type-scale foundation
  - Closes the bulk of "doesn't feel like a paid product" gap
- **P1 (must close in v2.1.0)** — 25 items
  - All medium-severity items that compound user-perceived polish
  - All a11y gaps below the structural CRIT
  - Copy/voice consistency
- **P2 (queue for v2.1.x or v2.2)** — 16 items
  - Patterns from competitive teardown that aren't blockers
  - Nice-to-have refinements

## Invariant audit

All 52 items checked against §6 of the master prompt. **All PASS.** No item proposes:
- Bundler / build step
- `type="module"` script tags
- Architectural change to bridge/iframe/modelDoc
- runtime npm dependency
- Bridge-script.js change > 50 lines per patch (none touch bridge-script)

## Out-of-scope (explicit deferrals)

- Tome-style AI deck generation (A4 reject pile)
- Live cursors / multiplayer (ADR-017/028 reject)
- Cloud asset library (no-server invariant)
- Mobile-first editing (ADR-018 honest-block stays)
- AAA contrast (A2-F18 — AA-target stance documented)

## What's NOT addressed in this PAIN-MAP (out of scope this overhaul)

- PPTX export composition integration (P0 in POST_V2_ROADMAP — separate workstream)
- Smart Import "full" mode (P1 in POST_V2_ROADMAP)
- gate-a11y test expansion BEYOND the 28 new tests proposed by A2 (separate planning)
- Real-deck import corpus expansion
