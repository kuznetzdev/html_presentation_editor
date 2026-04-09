# ROADMAP NEXT

## Post-0.18.4 priorities вЂ” user-research-driven replan

Previous roadmap prioritized smart layer resolution first. User research
(April 2026) showed the primary pain is **lack of honest system feedback**,
not missing intelligence. Users report:

- wrong layer selected and unclear how to reach the right one
- elements become unmovable with no explanation why
- editing path feels like guessing instead of a tool-guided workflow
- precise positioning (snap, nudge) is missing for fine work

Target audience: **all skill levels**, desktop, keyboard + mouse.
Primary scenarios: edit existing presentations, add slides matching style,
position small elements precisely, maintain auto-numbering.

The architecture (`parent shell + iframe + bridge + modelDoc`) stays fixed.

---

## Phase 1: Honest feedback вЂ” `v0.20.0`

> **Goal**: the user always knows WHY something happened and WHAT to do next.
> No guessing, no silent failures.

### ADR-001: Block reason protocol

**Status**: Proposed  
**Context**: `hasBlockedDirectManipulationContext()` returns a boolean.
Users see "Р§РµСЂРµР· РёРЅСЃРїРµРєС‚РѕСЂ" tooltip but never learn if the cause is zoom,
lock, container policy, or transform. The existing
`getDirectManipulationTooltipMessage()` resolves some transform reasons but
the logic is scattered and the UX output is inconsistent.

**Decision**: Replace the boolean blocker with a reason enum returned from a
new `getBlockReason()` function:

```
type BlockReason =
  | "none"
  | "zoom"            // previewZoom !== 1
  | "locked"          // element has editor lock
  | "container"       // entity kind is container/slide-root
  | "own-transform"   // element uses CSS transform
  | "parent-transform"// ancestor uses CSS transform
  | "slide-transform" // slide root uses CSS transform
  | "hidden"          // element is visibility-toggled off
```

Shell renders reason as:
- inline banner below selection overlay (not tooltip, not modal)
- banner includes one-click resolution action where applicable

**Consequences**: `hasBlockedDirectManipulationContext()` becomes a thin
wrapper over `getBlockReason() !== "none"`. All 12 call sites keep working.
Bridge protocol unchanged вЂ” reason lives in shell state, not in iframe.

### ADR-002: Stack depth indicator

**Status**: Proposed  
**Context**: `updateClickThroughState()` already collects all candidates under
cursor with scores. Users don't know candidates exist until they click
repeatedly.

**Decision**: Show a lightweight badge `1/N` in the breadcrumb bar when
`clickThroughState.candidates.length > 1`. No new bridge messages needed вЂ”
the candidate list is already shell-side state.

**Consequences**: Zero bridge changes. Breadcrumb render function reads
`STATE.clickThroughState.candidates.length` and appends a counter.

### Substeps

1. **Block reason enum** вЂ” extract `getBlockReason()` from existing
   `hasBlockedDirectManipulationContext()` + `getDirectManipulationTooltipMessage()`
2. **Block reason banner** вЂ” inline banner below selection overlay with
   human-readable message and action button:
   - `zoom` в†’ "РњР°СЃС€С‚Р°Р± в‰  100%" + РєРЅРѕРїРєР° В«РЎР±СЂРѕСЃРёС‚СЊВ»
   - `locked` в†’ "Р­Р»РµРјРµРЅС‚ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ рџ”’" + РєРЅРѕРїРєР° В«Р Р°Р·Р±Р»РѕРєРёСЂРѕРІР°С‚СЊВ»
   - `container` в†’ "Р­С‚Рѕ РєРѕРЅС‚РµР№РЅРµСЂ вЂ” РІС‹Р±РµСЂРёС‚Рµ РґРѕС‡РµСЂРЅРёР№ СЌР»РµРјРµРЅС‚" + visual hint
   - `own-transform` / `parent-transform` / `slide-transform` в†’ "РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ transform вЂ” РїРµСЂРµРјРµС‰РµРЅРёРµ С‡РµСЂРµР· РёРЅСЃРїРµРєС‚РѕСЂ"
   - `hidden` в†’ "Р­Р»РµРјРµРЅС‚ СЃРєСЂС‹С‚" + РєРЅРѕРїРєР° В«РџРѕРєР°Р·Р°С‚СЊВ»
3. **Stack depth badge** вЂ” `1/N` counter in breadcrumb bar when multiple
   candidates exist under cursor
4. **Action hint on first select** вЂ” when user selects an element in basic
   mode, inspector summary card shows 1-2 obvious available actions
   (edit text / replace image / resize / move) instead of empty state
5. **Playwright coverage** вЂ” new `honest-feedback.spec.js`:
   - block banner appears for each reason and disappears on resolution
   - stack badge shows correct count on overlap stacks
   - action hint displays correct actions per entity kind

### Test plan

| Scenario | Gate | Method |
|----------|------|--------|
| Block banner per reason | A | `honest-feedback.spec.js` |
| Banner action resolves block | B | same spec |
| Stack badge on 03-absolute-positioned.html | B | same spec |
| No banner on clean selection | A | regression in `shell.smoke` |
| Export cleanliness after banner interaction | B | `asset-parity.spec.js` |

---

## Phase 2: Visual layer picker вЂ” `v0.20.1`

> **Goal**: user can SEE all layers under cursor and PICK the one they need
> without blind click-cycling.

### ADR-003: Layer picker popup

**Status**: Proposed  
**Context**: Click-through cycling (`trySelectFromClickThroughState`) works but
is invisible вЂ” user must click repeatedly and guess when the right element is
highlighted. Context menu already has "Select layer" items but requires
right-click and DOM literacy.

**Decision**: When clicking on a point with 2+ candidates, show a compact
floating popup listing candidates with:
- entity kind icon + human label (not tag name)
- hover on row в†’ highlight-ghost in preview (reuse overlap ghost infrastructure)
- click on row в†’ select that element
- Escape / click-outside в†’ dismiss

Trigger: plain click on an already-selected point where `candidates.length > 1`.
First click still selects topmost (no behavior change). Second click on same
point opens picker instead of blind cycling.

**Consequences**: Replaces invisible click-through cycling with a visual list.
`updateClickThroughState` stays as the data source. New shell surface follows
existing transient-surface mutual exclusion (context menu, insert palette,
topbar overflow).

### Substeps

1. **Layer picker panel** вЂ” floating popup positioned near cursor,
   built from `STATE.clickThroughState.candidates[]`
2. **Candidate labels** вЂ” use entity kind + truncated text content or
   `data-node-id` as human label (not raw tag names)
3. **Hover preview** вЂ” reuse `clearOverlapGhostHighlight()` /
   ghost highlight infrastructure for hover-on-row feedback
4. **Keyboard navigation** вЂ” Arrow Up/Down to move between candidates,
   Enter to select, Escape to dismiss
5. **Mutual exclusion** вЂ” layer picker closes when context menu, insert
   palette, or topbar overflow opens (and vice versa)
6. **Playwright coverage** вЂ” new `layer-picker.spec.js`:
   - picker opens on second click at same point
   - correct candidate count matches stack depth badge
   - hover highlights correct element in preview
   - keyboard navigation works
   - picker closes on Escape / outside click
   - export stays clean

### Test plan

| Scenario | Gate | Method |
|----------|------|--------|
| Picker opens on 03-absolute-positioned.html | A | `layer-picker.spec.js` |
| Hover highlights correct candidate | B | same spec |
| Keyboard picks correct layer | B | same spec |
| Picker + context menu mutual exclusion | B | same spec |
| No picker on single-candidate points | A | regression guard |

---

## Phase 3: Precision editing вЂ” `v0.20.2`

> **Goal**: user can place and align elements precisely without pixel-guessing.

### ADR-004: Snap and nudge system

**Status**: Proposed  
**Context**: Direct manipulation (drag/resize) moves elements freely with no
alignment assistance. Users need to position small elements and align them
evenly. Currently the only precision path is typing numbers in inspector.

**Decision**: Add three precision subsystems:

1. **Arrow key nudge**: selected element moves 1px per arrow press,
   10px with Shift held. Works at zoom = 100% only (same gate as drag).
2. **Snap-to-siblings**: during drag, snap lines appear at edges and
   centers of sibling elements within the same slide. Threshold: 5px.
3. **Smart guides**: visual guide lines drawn on the preview overlay
   when the dragged element aligns with a sibling edge or center.

All coordinate math goes through existing `toStageRect()` / `toStageAxisValue()`.
Snap targets are computed from sibling bounding rects inside the active slide.
Guide lines are shell-owned overlay elements (`data-editor-ui="true"`),
stripped on export.

**Consequences**: Extends direct manipulation without changing the architecture.
Nudge is a shell keyboard handler. Snap and guides are shell overlay logic
reading iframe geometry through the bridge.

### Substeps

1. **Arrow key nudge** вЂ” register in unified keyboard handler:
   - Arrow keys when element selected + not text-editing в†’ move 1px
   - Shift + Arrow в†’ move 10px
   - Blocked when `getBlockReason() !== "none"` (reuses Phase 1)
   - Commits position through same `commit-direct-manipulation` bridge command
2. **Snap engine** вЂ” during drag, compute snap targets from sibling rects:
   - Snap axes: left, right, center-x, top, bottom, center-y
   - Snap threshold: 5px (configurable via constant)
   - Snap magnetism: position snaps to nearest target within threshold
3. **Smart guide lines** вЂ” shell overlay lines showing alignment:
   - Rendered as absolutely positioned divs in selection overlay container
   - Appear when snap engages, disappear on drag end
   - Styled: 1px dashed, theme-aware color (blue/cyan)
4. **Playwright coverage** вЂ” extend `editor.regression.spec.js`:
   - arrow nudge moves element by expected pixels
   - shift+arrow nudge moves by 10px
   - nudge blocked when locked / zoom в‰  100%
   - snap guide appears on alignment (visual or DOM check)

### Test plan

| Scenario | Gate | Method |
|----------|------|--------|
| Arrow nudge 1px movement | A | `editor.regression.spec.js` |
| Shift+Arrow nudge 10px | A | same spec |
| Nudge blocked by lock | B | same spec |
| Snap guide appears on sibling alignment | B | new `precision.spec.js` |
| Guide lines stripped from export | B | `asset-parity.spec.js` |

---

## Phase 4: Internal zoning вЂ” `v0.21.0`

> **Goal**: reduce blast radius inside the editor file without
> architecture rewrite.

### Substeps

1. Carve responsibility zones with clear section comments for:
   - preview lifecycle
   - slide flow and navigation
   - selection engine (resolve, score, path, click-through)
   - overlap recovery
   - direct manipulation + precision (nudge, snap, guides)
   - feedback layer (block reason, stack badge, layer picker)
   - export and assets
   - shell layout and responsive behavior
2. Keep refactors contiguous and responsibility-based before any file splits
3. Preserve `parent shell + iframe + bridge + modelDoc`
4. Avoid override-style cleanup that hides ownership problems

### Validation

- All existing Gate B tests must pass without changes
- No line-count growth beyond section headers and comments

---

## Phase 5: System polish вЂ” `v0.21.x`

> **Goal**: visual and interaction consistency after correctness.

### Substeps

1. Normalize controls, spacing, radius, and shadow language across
   surfaces added in v0.17вЂ“v0.19 (overlap banners, layers rows,
   block reason banners, layer picker, smart guides)
2. Audit topbar, rail, inspector, and new surfaces against the product
   rule "presentation tool first, HTML editor second"
3. Light/dark parity check on all new surfaces
4. Avoid shell drift, focus-order regressions, and overlay conflicts

---

## Version path summary

| Version | Focus | Key deliverable |
|---------|-------|-----------------|
| **v0.20.0** | Honest feedback | Block reason banners, stack badge, action hints |
| **v0.20.1** | Layer picker | Visual candidate list, hover preview, keyboard nav |
| **v0.20.2** | Precision editing | Arrow nudge, snap-to-siblings, smart guides |
| **v0.21.0** | Internal zoning | Responsibility zones, no architecture change |
| **v0.21.x** | System polish | Visual consistency, light/dark parity |

## Deferred (not in scope)

- Zoom UX polish (Low вЂ” desktop+mouse users unaffected)
- Per-deck zoom persistence (Very Low вЂ” global default is fine)
- Mobile/tablet touch conflicts (Low вЂ” desktop is primary target)
- Cross-browser zoom testing on Firefox/WebKit (nice-to-have after Phase 1)

## Architectural decisions index

| ADR | Title | Phase | Status |
|-----|-------|-------|--------|
| ADR-001 | Block reason protocol | v0.20.0 | Proposed |
| ADR-002 | Stack depth indicator | v0.20.0 | Proposed |
| ADR-003 | Layer picker popup | v0.20.1 | Proposed |
| ADR-004 | Snap and nudge system | v0.20.2 | Proposed |


