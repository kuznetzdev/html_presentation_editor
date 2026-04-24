# Release v2.0.0 — HTML Presentation Editor

**Date:** 2026-04-24
**Trajectory:** v1.0.3 → v2.0.0 over **26 incremental release points**
(v1.1.0 through v2.0.0 inclusive) across Phases A–E + 6 hardening
sprints. See the **Tag history** section below for the complete list.

---

## TL;DR

A polished no-code editor for any HTML presentation. Open → select →
edit → export. Layers panel, multi-select with alignment toolbar, smart
import classifier, PPTX fidelity v2 helpers, error recovery, onboarding
hints, focus-visible across the shell, dark-theme parity.

---

## Highlights

### Workspace + Layers (Phase B)

- Figma-style split-pane left column.
- Persistent **Layers panel** in the shell — visible in both basic and
  advanced modes (V2-01).
- **Tree view** following DOM hierarchy with collapsible
  `<details>` per branch; collapse state persists across renders
  (`state.layerTreeCollapsed`).
- **Inline rename** via dblclick on label or F2; user names persist via
  `data-layer-name` (clean-export safe).
- **Layer-row context menu** with Rename / Duplicate / Bring forward /
  Send backward / Lock / Hide / Delete.

### Smart Import Pipeline v2 (Phase B6 + v1.5.3)

- 8 framework detectors: reveal, impress, spectacle, marp, slidev,
  mso-pptx, canva, notion, plus a generic fallback.
- 4 slide-inference strategies: explicit / h1-split / viewport /
  page-break + single-slide fallback.
- 0–10 complexity score with per-issue warnings (inline scripts, CDN
  fonts, transforms, SVG/canvas, iframes, large DOM, deep nesting).
- **Pre-flight report modal** before every load — surfaces framework
  confidence, slide count, complexity bucket, warning list.
- **Deck health badge** in the topbar reflects the score after import;
  click reopens the report modal.
- 10-deck reference corpus locks detector + inference behavior.

### Theme polish (Phase C)

- **Tokens v3** — semantic shadows (`--shadow-panel/floating/modal/
  pressed`), motion (`--motion-micro/base/emphasis`), state (hover /
  hover-strong / active / focus-ring).
- **SVG icon sprite** — 35 icons inlined at boot using `currentColor`,
  auto-adapt to theme.
- **`:focus-visible` ring** formalized across every interactive surface
  (V2-09).
- **`prefers-reduced-motion`** coverage extended to all v2 redesign
  surfaces.
- **Dark-theme visual baseline refreshed** for v2 layout.

### Direct manipulation (Phase D)

- **Multi-select** via shift-click toggle / Ctrl+A select-all-on-slide
  / Escape clear; combined-bbox anchor tracked separately.
- **Alignment toolbar** — 6 align (left/center-h/right/top/middle/
  bottom) + 2 distribute (horizontal/vertical) actions, surfaces with
  ≥ 2 multi-selected. Distribute disabled below 3 nodes.
- **Opacity + rotate APIs** with Shift+R cycle (0 → 15 → 45 → 90 → 0).
- **PowerPoint-style shortcuts**: Ctrl+D duplicate, Ctrl+G group,
  Ctrl+Shift+G ungroup, Ctrl+Shift+↑/↓ bring/send.
- **Locked nodes** universally rejected from move/style/rotate
  mutations.

### PPTX Fidelity v2 helper layer (Phase D5)

- `ExportPptxV2` namespace with:
  - `resolveFontFallback` — ~35 webfont → PowerPoint-safe map.
  - `resolveAllRects` — `getBoundingClientRect`-based slide-relative
    coords + EMU/inch conversions.
  - `describeSvgRoot` — primitive describe vs raster fallback.
  - `parseLinearGradient` + `describeBackgroundImage`.
  - `buildPreflightReport` — element classification + losses report.
- Pre-flight runs before legacy export when `pptxV2` flag is on.
- Marked **Beta**: `attachExperimentalBadge` chips the export button
  until the legacy delegate is replaced (post-v2.0).

### Progressive disclosure + Recovery (Phase E + hardening)

- Inspector mode toggle relabeled "Простой / Полный" (was Быстро/Точно).
- **`withActionBoundary`** snapshots `state.modelDoc` and rolls back on
  throw or soft-fail. Wired on `insertSlideFromTemplate` /
  `duplicateSlideById` / `deleteSlideById`.
- **`InputValidators`** registry: `pixelSize / opacity / url /
  hexColor / cssLength`. Wired on `widthInput / heightInput /
  leftInput / topInput / marginInput / paddingInput / opacityInput /
  imageSrcInput`.
- **Unified `showUndoToast`** — 6.2s default TTL (≥ 5s floor),
  "Отменить" button. Slide delete + duplicate use it (V2-07).
- **Onboarding v2** — first-session hint bubbles via `showHintOnce`;
  `primeOnboardingV2` wired into Smart Import accept.
- **A11y** — `aria-live="polite"` + `aria-atomic="true"` on
  `#saveStatePill` and `#previewLoading`.

### Quality contracts (hardening sprints v1.5.0–v1.5.5)

- Wired validators in 6 inspector inputs.
- Action-boundary integration on slide-rail mutations.
- Bridge mutation schema strictness (10 contract tests).
- 10-deck import corpus regression suite (22 tests).
- Golden export checks (7 tests): no `data-editor-*`, no
  `contenteditable`, no helper styles / bridge tags, zero duplicate IDs,
  user `data-layer-name` preserved.
- Recovery scenarios (7 tests): bad input rejected, action-boundary
  rollback, undo restores deleted slide, autosave writes.
- Long-session sync (4 tests): 100 mutations stay coherent, history
  bounded, autosave persists, full undo unwind.
- Docs-sync gate (6 tests): version drift detection.

### Experimental badges (v1.5.0)

- `attachExperimentalBadge(target, label?, tooltip?)` — small "Beta"
  chip that visibly marks beta-stage features.
- Currently chips: `#exportPptxBtn` (PPTX delegate still legacy),
  `#openHtmlBtn` only when `smartImport === "full"` (default "report").

---

## Feature flags (defaults at v2.0.0)

```javascript
{
  layoutVersion:   "v2",     // Figma-style split-pane
  layersStandalone: true,    // Layers in shell region
  treeLayers:       true,    // Hierarchical tree view
  multiSelect:      true,    // shift-click + Ctrl+A
  pptxV2:           true,    // Pre-flight + helpers active
  smartImport:      "report", // Modal between Open and load
  svgIcons:         true,    // SVG sprite active
}
```

Override at runtime: `window.featureFlags.X = ...`. Reset:
`window.resetFeatureFlags()`.

---

## Test matrix

| Gate | v1.0.3 baseline | v2.0.0 |
|---|---|---|
| Gate-A (chromium-desktop) | 65/5/0 | 242/8/0 (across 24 spec files) |
| Gate-visual (×2 themes)   | 15/0/0 | 15/0/0 (refreshed for v2) |
| Typecheck                 | clean  | clean |

New specs added in this trajectory:
- `layers-tree-nav.spec.js`, `layers-rename-context.spec.js`
- `import-pipeline-v2.spec.js`, `import-corpus.spec.js`
- `multi-select.spec.js`, `alignment-toolbar.spec.js`
- `opacity-rotate.spec.js`, `keyboard-shortcuts-ppt.spec.js`
- `pptx-fidelity-v2.spec.js`
- `error-recovery-boundary.spec.js`, `onboarding-v2.spec.js`
- `inspector-validators-badges.spec.js`, `deck-health-boundary.spec.js`
- `undo-toast-onboarding.spec.js`, `bridge-mutation-schema.spec.js`
- `golden-export-clean.spec.js`, `recovery-scenarios.spec.js`
- `long-session-sync.spec.js`, `docs-sync.spec.js`

---

## Module structure (v2.0.0)

`editor/src/` — ~50 JavaScript modules. New since v1.0.x:
- `import-pipeline-v2/` (5 modules)
- `import-report-modal.js`
- `export-pptx/` (6 modules)
- `multi-select.js`, `alignment-toolbar.js`, `opacity-rotate.js`
- `user-action-boundary.js`, `input-validators.js`
- `onboarding-v2.js`, `experimental-badge.js`, `deck-health.js`
- `undo-toast.js`
- `left-pane-splitter.js`, `shell-layout.js` (extended)
- `icons/icons.svg.js`

`editor/styles/` — 16 CSS layers. New: `layers-region`, `split-pane`,
`import-report-modal`, `icons`, `alignment-toolbar`.

---

## What's NOT in v2.0.0 (deferred polish)

These are tracked as post-v2.0 polish iterations:

- **PPTX export composition integration** — `ExportPptxV2` runs the
  pre-flight, but the actual archive build still delegates to legacy
  `exportPptx()`. Marked Beta via experimental badge.
- **Smart Import "full" mode** — pipeline-v2 as primary loader.
  Currently "report" (modal between Open and load) is default.
- **Mass `data-ui-level="advanced"` migration** to entity-groups —
  ~15 attrs. Most remaining correctly target HTML editing / raw IDs /
  diagnostics (intentional advanced-only).
- **Settings → Reset onboarding** UI control. Function
  `resetOnboardingV2()` available via devtools.
- **Empty-state welcome card CSS animation**.
- **gate-a11y expansion to 50+ keyboard-only tests** — current 27
  baseline preserved; foundation (focus-visible + aria-live) shipped.
- **Alt+drag clone** during direct manipulation.
- **PPTX fidelity 5-deck manual QA corpus**.
- **`feedback.js getBlockReasonAction()`** — actionable buttons for
  every block reason. Toast-driven recovery already exists.

These do not block v2.0 GA: the API surface for each is stable, and
the integration patterns are documented in this file.

---

## Migration notes

### From v1.0.x

- localStorage flag persistence — users who saved flags before v1.1.4
  retain `layoutVersion: "v1"` + `layersStandalone: false`. They can
  reset via `window.resetFeatureFlags()` in devtools to opt into v2
  defaults.
- `data-layer-name` is a new optional attribute. Ignored by older
  versions; preserved by clean-export.
- All keyboard shortcuts are additive; no chord rebound.

### Browser support

Same as v1.0.x:
- Chrome 4+ (latest stable)
- Firefox 126+
- Safari 4+
- Edge 12+

---

## Tag history (v1.0.3 → v2.0.0)

```
v1.1.0  Phase A  — tokens v3, feature flags, 7 ADRs
v1.1.1  Phase B1 — split-pane scaffold (dormant)
v1.1.2  Docs    — V2-CONTINUATION-PROMPT
v1.1.3  Phase B2 — #layersRegion shell region + dual-render
v1.1.4  Phase B3 — flip defaults to v2 layout
v1.1.5  Phase B4 — tree view for layers
v1.1.6  Phase B5 — inline rename + layer-row context menu
v1.2.0  Phase B6 — Smart Import Pipeline v2
v1.2.1  Phase C1 — SVG icon sprite
v1.2.2  Phase C2 — focus-visible + motion tokens
v1.3.0  Phase C3 — visual baseline refresh + reduce-motion
v1.3.1  Phase D1 — multi-select coordination
v1.3.2  Phase D2 — alignment toolbar
v1.3.3  Phase D3 — opacity + rotate APIs
v1.3.4  Phase D4 — PPT-style keyboard shortcuts
v1.4.0  Phase D5 — PPTX Fidelity v2 helpers
v1.4.1  Phase E1 — inspector mode-toggle copy refresh
v1.4.2  Phase E2 — error-recovery layers 4 + 5
v1.4.3  Phase E3 — onboarding v2 + aria-live
v1.5.0  Hardening — validators wired + experimental badges
v1.5.1  Hardening — deck health badge + boundary on slide ops
v1.5.2  Hardening — undo toast + onboarding wiring
v1.5.3  Hardening — bridge schema strictness + import corpus
v1.5.4  Hardening — golden export + recovery scenarios
v1.5.5  Hardening — long-session sync + docs sync
v2.0.0  GA      — release ceremony
```

---

## Credits

Trajectory executed by Claude Opus 4.7 (1M context) in collaboration
with the project owner. All architectural decisions captured in
`docs/V2-MASTERPLAN.md` and 7 new ADRs (031–037). All commits include
`Co-Authored-By` trailer + a Conventional Commits message body.

---

*Generated 2026-04-24 as part of the v2.0.0 GA ceremony.*
