# ROADMAP NEXT — v0.25.0 → v1.0.0

> **Baseline**: v0.24.0 shipped (Gate-A: 55 passed / 5 skipped / 0 failed).
> Architecture: 25 JS modules + 8 CSS @layers. parent shell + iframe bridge + modelDoc stays fixed.
> User research driver: _lack of honest feedback, invisible layers, no precision, no onboarding path_.

---

## Shipped

| Version | Focus | Gate-A |
|---------|-------|--------|
| v0.23.0 | Layer separation (bridge-script / shell-overlays / boot) | 55/5/0 ✓ |
| v0.23.1 | JSDoc + reference decks + GitHub release | 55/5/0 ✓ |
| v0.24.0 | Click ergonomics (drag threshold, handles, clean-click, TTL) | 55/5/0 ✓ |

---

## Phase 1 — Honest Feedback · `v0.25.0`

> **Goal**: the user always knows WHY something happened and WHAT to do next.
> No guessing, no silent failures.

**Status**: Proposed

### ADR-001: Block Reason Protocol

**Context**: `hasBlockedDirectManipulationContext()` returns a boolean. Users see a generic tooltip
but never learn if the cause is zoom, lock, container policy, or CSS transform. Feedback is scattered
across `getDirectManipulationTooltipMessage()` and 12 call sites with no unified contract.

**Decision**: Replace boolean with a reason enum from a new `getBlockReason()` function:

```
BlockReason = "none" | "zoom" | "locked" | "container" |
              "own-transform" | "parent-transform" | "slide-transform" | "hidden"
```

Shell renders reason as an **inline banner** below the selection overlay (not tooltip, not modal).
Banner includes a one-click resolution action where applicable.

**ADR-ref**: `docs/ADR-001-block-reason-protocol.md`

### ADR-002: Stack Depth Indicator

**Context**: `updateClickThroughState()` already collects all candidates under cursor.
Users don't know overlapping candidates exist until they click-cycle blindly.

**Decision**: Show a lightweight badge `1/N` in the breadcrumb bar when
`clickThroughState.candidates.length > 1`. No bridge changes — data is already shell-side.

**ADR-ref**: `docs/ADR-002-stack-depth-indicator.md`

### Substeps

1. Extract `getBlockReason()` from existing `hasBlockedDirectManipulationContext()` + `getDirectManipulationTooltipMessage()`
2. Inline banner below selection overlay: reason → human text + resolution action
   - `zoom` → "Масштаб ≠ 100%" + кнопка «Сбросить»
   - `locked` → "Элемент заблокирован 🔒" + кнопка «Разблокировать»
   - `container` → "Это контейнер — выберите дочерний элемент" + visual hint
   - `own-transform` / `parent-transform` / `slide-transform` → "Используется transform — перемещение через инспектор"
   - `hidden` → "Элемент скрыт" + кнопка «Показать»
3. Stack depth badge `1/N` in breadcrumb bar
4. Action hint on first select: inspector summary card shows 1-2 obvious available actions
5. New CSS: `editor/styles/banner.css` (new @layer slot in tokens.css declaration)
6. Playwright: `honest-feedback.spec.js` covers all block reasons + badge + action hints

### Test Plan

| Scenario | Gate | Method |
|---|---|---|
| Block banner per reason | A | `honest-feedback.spec.js` |
| Banner action resolves block | A | same spec |
| Stack badge on overlap deck | A | same spec |
| No banner on clean selection | A | `shell.smoke` regression |
| Export clean after banner | A | `asset-parity.spec.js` |

---

## Phase 2 — Visual Layer Picker · `v0.25.1`

> **Goal**: user can SEE all layers under cursor and PICK the one they need
> without blind click-cycling.

**Status**: Proposed

### ADR-003: Layer Picker Popup

**Context**: Click-through cycling works but is invisible. Context menu has "Select layer"
but requires right-click and DOM literacy. No progressive disclosure path.

**Decision**: Second plain click on an already-selected point where `candidates.length > 1`
opens a compact floating popup listing candidates:
- entity kind icon + human label (not raw tag name)
- hover on row → highlight-ghost in preview (reuse overlap ghost infrastructure)
- click on row → select that element; Escape / click-outside → dismiss
First click still selects topmost (no behavior change).

New surface follows existing transient-surface mutual exclusion (context menu / insert palette / topbar overflow).

**ADR-ref**: `docs/ADR-003-layer-picker-popup.md`

### Substeps

1. Layer picker panel — floating popup near cursor, built from `STATE.clickThroughState.candidates[]`
2. Candidate labels — entity kind + truncated text content (not raw tag names)
3. Hover preview — reuse `clearOverlapGhostHighlight()` / ghost infrastructure
4. Keyboard navigation — Arrow Up/Down, Enter to select, Escape to dismiss
5. Mutual exclusion — closes when context menu / insert palette / topbar overflow opens
6. New files: `editor/src/layer-picker.js`, `editor/styles/layer-picker.css`
7. Playwright: `layer-picker.spec.js`

### Test Plan

| Scenario | Gate | Method |
|---|---|---|
| Picker opens on 2nd click (overlap deck) | A | `layer-picker.spec.js` |
| Hover highlights correct candidate | A | same spec |
| Keyboard picks correct layer | A | same spec |
| Mutual exclusion with context menu | A | same spec |
| No picker on single-candidate points | A | regression guard |

---

## Phase 3 — Precision Editing · `v0.26.0`

> **Goal**: user can place and align elements precisely without pixel-guessing.

**Status**: Proposed

### ADR-004: Snap and Nudge System

**Context**: Direct manipulation moves freely with no alignment assistance.
The only precision path is typing numbers in inspector. Arrow keys do nothing when element selected.

**Decision**: Three precision subsystems:

1. **Arrow key nudge**: 1px per arrow, 10px with Shift. Works at zoom = 100% only (same gate as drag).
2. **Snap-to-siblings**: during drag, snap lines appear at edges and centers of siblings. Threshold: 5px.
3. **Smart guides**: visual dashed guide lines on preview overlay when dragged element aligns with sibling.

All coordinate math goes through existing `toStageRect()` / `toStageAxisValue()`.
Guide lines are shell-owned overlay elements (`data-editor-ui="true"`), stripped on export.

**ADR-ref**: `docs/ADR-004-snap-nudge-system.md`

### Substeps

1. Arrow key nudge — register in unified keyboard handler; commits via existing `commit-direct-manipulation`
2. Snap engine — compute snap targets from sibling rects; snap axes: left/right/center-x/top/bottom/center-y
3. Smart guide lines — shell overlay divs; appear when snap engages, disappear on drag end
4. New files: `editor/src/precision.js`, `editor/styles/precision.css`
5. `bridge-script.js` edit: expose sibling bounding rects via new bridge message `get-sibling-rects`
6. Playwright: extend `editor.regression.spec.js` + new `precision.spec.js`

### Test Plan

| Scenario | Gate | Method |
|---|---|---|
| Arrow nudge 1px | A | `precision.spec.js` |
| Shift+Arrow 10px | A | same spec |
| Nudge blocked at zoom ≠ 100% | A | same spec |
| Nudge blocked when locked | A | same spec |
| Snap guide appears on sibling alignment | A | same spec |
| Guide lines absent from export | A | `asset-parity.spec.js` |

---

## Phase 4 — Onboarding-First · `v0.27.0`

> **Goal**: a first-time user opens the editor and immediately knows what to do.
> Blank state is onboarding, not a broken editing surface.

**Status**: Proposed

### ADR-005: Onboarding Starter-Deck

**Context**: Empty state shows "Open HTML" + "Paste HTML" but no preview of what the editor does.
Users with no existing presentation have no entry point. The bundled `basic-deck.html` exists but is
only accessible via the STARTER_DECKS constant — not surfaced in empty state.

**Decision**: Empty state card gets a third CTA: "Try starter example →" that loads `basic-deck.html`
directly into the editor (no file dialog). This surfaces the existing STARTER_DECKS["basic"] entry.
Action hints appear on first selection: a contextual tooltip-banner showing 1-2 most relevant actions
for the selected entity kind (edit text / replace image / resize).

**ADR-ref**: `docs/ADR-005-onboarding-starter-deck.md`

### Substeps

1. Add "Try starter example" button to empty-state card (uses existing `STARTER_DECKS.basic` constant)
2. Action hint banner: entity-kind-aware tooltip on first select per session (`sessionStorage` flag)
3. Update `editor/src/onboarding.js` (existing module)
4. Playwright: `onboarding.spec.js` — starter deck loads, first-select hint appears, hint dismisses

### Test Plan

| Scenario | Gate | Method |
|---|---|---|
| Starter deck button loads pilot deck | A | `onboarding.spec.js` |
| Action hint appears on first element select | A | same spec |
| Hint does not repeat after dismiss | A | same spec |
| Blank state hides all editing chrome | A | `shell.smoke` regression |

---

## Phase 5 — Accessibility CI Gate · `v0.27.1`

> **Goal**: shell passes axe-core, keyboard-only navigation, and WCAG AA contrast in CI.

**Status**: Proposed

### ADR-006: Accessibility CI Gate

**Context**: No automated a11y checks exist. Inspector, topbar, and rail have never been audited.
Keyboard focus order is untested. Light/dark contrast ratios may violate WCAG AA on new surfaces.

**Decision**: Add `axe-playwright` (Deque) to devDependencies. New gate `test:gate-a11y`:
- axe scan on shell in `empty`, `loaded-preview`, `loaded-edit` workflow states
- keyboard-only navigation test: Tab through topbar, rail, inspector, floating toolbar
- contrast ratio assertions for design tokens in both light and dark themes

All violations are surfaced as test failures. Gate runs as optional CI step (not blocking Gate-A baseline).

**ADR-ref**: `docs/ADR-006-accessibility-ci-gate.md`

### Substeps

1. `npm install --save-dev @axe-core/playwright`
2. `tests/a11y/shell-a11y.spec.js` — axe scans per workflow state
3. `tests/a11y/keyboard-nav.spec.js` — Tab/Shift+Tab + Enter/Space/Escape coverage
4. `tests/a11y/contrast.spec.js` — token contrast assertions
5. `package.json` script: `"test:gate-a11y": "playwright test tests/a11y/"`
6. Zero violations on axe scan before merge

### Test Plan

| Scenario | Gate | Method |
|---|---|---|
| axe: zero violations in empty state | a11y | `shell-a11y.spec.js` |
| axe: zero violations in loaded-edit | a11y | same spec |
| Tab navigation reaches all interactive controls | a11y | `keyboard-nav.spec.js` |
| Contrast passes WCAG AA (light + dark) | a11y | `contrast.spec.js` |

---

## Phase 6 — Visual Regression CI Gate · `v0.28.0`

> **Goal**: shell appearance is locked via pixel snapshots — no accidental regressions.

**Status**: Proposed

### ADR-007: Visual Regression CI Gate

**Context**: CSS changes (overlay.css, inspector.css) can silently change appearance.
Currently there are no visual regression tests. Snapshots would catch layout drift, color changes, and new surfaces appearing unexpectedly.

**Decision**: Use Playwright's built-in `toHaveScreenshot()`. New gate `test:gate-visual`:
- Snapshot surfaces: empty state / loaded-preview / loaded-edit / element selected / floating toolbar
- Both light and dark themes (2 × N screenshots)
- Tolerances calibrated for sub-pixel rendering differences (1% pixel diff threshold)
- Snapshots committed to repo under `tests/visual/__snapshots__/`
- Separate CI job; not blocking Gate-A

**ADR-ref**: `docs/ADR-007-visual-regression-ci-gate.md`

### Substeps

1. `tests/visual/shell-visual.spec.js` — snapshot suite with theme variants
2. Playwright project config: `chromium-visual` with fixed viewport 1440×900
3. `package.json` script: `"test:gate-visual": "playwright test tests/visual/ --update-snapshots=false"`
4. Initial snapshot generation: `npm run test:gate-visual -- --update-snapshots`
5. CI: run `test:gate-visual` on PR; fail on diff > 1%

### Test Plan

| Scenario | Gate | Method |
|---|---|---|
| Empty state stable (light + dark) | visual | `shell-visual.spec.js` |
| Loaded-edit stable (light + dark) | visual | same spec |
| Selection overlay stable | visual | same spec |
| Floating toolbar stable | visual | same spec |

---

## Phase 7 — Local Task Telemetry · `v0.28.1`

> **Goal**: understand which editing actions succeed vs. fail without sending data to a server.

**Status**: Proposed (scope minimal)

### Approach

- `editor/src/telemetry.js` (new, ~80 lines): wraps `localStorage` only, opt-in via `localStorage['editor:telemetry:enabled'] = 'true'`
- Records: action type, success/fail, entity kind, session ID (UUID, reset on page load)
- Diagnostic panel (advanced mode only) reads and displays the log
- Zero network calls; zero data sent anywhere
- Export strips telemetry log entries

---

## Architectural Decisions Index

| ADR | Title | Phase | Status | docs/ file |
|-----|-------|-------|--------|------------|
| ADR-001 | Block Reason Protocol | v0.25.0 | Proposed | `docs/ADR-001-block-reason-protocol.md` |
| ADR-002 | Stack Depth Indicator | v0.25.0 | Proposed | `docs/ADR-002-stack-depth-indicator.md` |
| ADR-003 | Layer Picker Popup | v0.25.1 | Proposed | `docs/ADR-003-layer-picker-popup.md` |
| ADR-004 | Snap and Nudge System | v0.26.0 | Proposed | `docs/ADR-004-snap-nudge-system.md` |
| ADR-005 | Onboarding Starter-Deck | v0.27.0 | Proposed | `docs/ADR-005-onboarding-starter-deck.md` |
| ADR-006 | Accessibility CI Gate | v0.27.1 | Proposed | `docs/ADR-006-accessibility-ci-gate.md` |
| ADR-007 | Visual Regression CI Gate | v0.28.0 | Proposed | `docs/ADR-007-visual-regression-ci-gate.md` |

---

## Version Path Summary

| Version | Focus | Key Deliverable | Status |
|---------|-------|-----------------|--------|
| **v0.24.0** | Click ergonomics | Drag threshold, handles, clean-click, TTL | **Shipped** |
| **v0.25.0** | Honest feedback | BlockReason enum, inline-banner, stack-depth badge | Proposed |
| **v0.25.1** | Visual layer picker | Popup, hover-ghost, keyboard-nav | Proposed |
| **v0.26.0** | Precision editing | Arrow-nudge, snap-to-siblings, smart guides | Proposed |
| **v0.27.0** | Onboarding-first | Starter-deck CTA, action-hints on first select | Proposed |
| **v0.27.1** | Accessibility gate | axe-core + keyboard + contrast in CI | Proposed |
| **v0.28.0** | Visual regression gate | Playwright snapshots light/dark | Proposed |
| **v0.28.1** | Local telemetry | opt-in localStorage task-success log | Proposed |

---

## Extended Roadmap — v0.29.0 → v1.0.0

> Detailed window-by-window plan: see [`EXECUTION_PLAN_v0.26-v1.0.md`](EXECUTION_PLAN_v0.26-v1.0.md).
> Driving findings: see [`audit/PAIN-MAP.md`](audit/PAIN-MAP.md) + 5 audit docs.
> 10 new ADRs (011–020): see `docs/ADR-011..ADR-020`.

| Version | Focus | Key ADRs | PAIN-MAP items |
|---------|-------|----------|----------------|
| v0.26.1 | Security quick wins | — | P0-02, P0-03, P1-13, P1-15 |
| v0.27.2 | Undo-chain honesty + transform resolve | — | P0-06, P0-07 |
| v0.28.1 | Telemetry scaffold + types bootstrap | ADR-011, ADR-020 | P1-18 |
| **v0.29.0** | Error boundaries + bridge v2 handshake | ADR-012, ADR-014 | P0-01 Trust Banner, P1-01 unify banners |
| v0.29.1 | Bridge v2 — schema validation + contract tests | ADR-012 | P0-02 final, P0-10, P0-13 |
| **v0.30.0** | Observable store (ui + selection slices) | ADR-013 | P0-09 partial |
| v0.30.1 | History → patch-based snapshots | ADR-013, ADR-017 | P0-07 final, P0-11 (memory) |
| v0.30.2 | Render coalescing (RAF batch) | ADR-013 | P0-12 |
| **v0.31.0** | Split selection.js, boot.js, feedback.js | — | P1-06, P1-07, P1-08, P1-09 |
| v0.31.1 | Design tokens v2 (semantic layer) | ADR-019 | — |
| **v0.32.0** | Entity-kind registry externalized | ADR-016 L1 | P2-05 |
| v0.32.1 | Tablet honest-block + gate-D depth | ADR-018 | — |
| v0.33.0 | Telemetry full (viewer + export log) | ADR-020 | — |
| v0.34.0 | Contract tests complete | ADR-012 | P0-13 final |
| v0.35.0 | Flake elimination + gate rebalance | — | P1-16, P1-17, P1-19 |
| v0.36.0 | Shortcut declarative table + polish | — | P2-04, P2-08, P2-09 |
| v0.37.0 | Release candidate — bug triage only | — | All P0 resolved |
| **v1.0.0** | Release | All 20 ADRs Accepted | Release criteria met |

**Total calendar:** ~14–18 weeks with 3 parallel agents per window. See EXECUTION_PLAN for agent ownership map per window.

**Release criteria for v1.0:** see EXECUTION_PLAN §"Release criteria for v1.0.0".

---

## Architectural Invariants (Never Violate)

- No `type="module"` in `<script>` — breaks `file://` protocol
- No bundler (Vite/Webpack) — no build step is a feature
- `init()` only as last line of `main.js`
- New `@layer` must be declared in `tokens.css` first
- Bridge changes require full understanding of both shell and iframe sides
- Gate-A must be 55/5/0 before any merge to main

## Deferred (Out of Scope for v1.0)

- Live collaboration / multi-user transport — readiness-only per ADR-017
- Full plugin API (Layer 2) — ADR-016 L1 only in v1.0, L2 post-1.0
- Touch-native direct manipulation on tablet — ADR-018 (review-only in v1.0)
- Cloud analytics / cloud sync (different product entirely)
- Per-deck zoom persistence (very low — global default is fine)
- Cross-browser zoom regression beyond gate-C coverage (nice-to-have)
