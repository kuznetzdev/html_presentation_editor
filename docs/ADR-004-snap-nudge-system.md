# ADR-004: Snap and Nudge System

**Status**: Accepted — Snap-to-siblings + smart guides implemented in: v0.31.1 via WO-28  
**Phase**: v0.26.0  
**Owner**: Agent C (precision-editing worktree)

---

## Context

Direct manipulation (drag/resize) moves elements freely with no alignment assistance.
Users placing small elements — logo, footnote, decorative line — must visually estimate position.
The only precision path today is typing numbers directly in the inspector's X/Y/W/H fields.

Pain points identified from user research:
- Arrow keys do nothing when an element is selected (users expect nudge)
- Elements cannot snap to sibling edges or centers during drag
- No visual feedback during alignment — users must release and compare

Prerequisite: ADR-001 (BlockReason enum) is in place so nudge can reuse `getBlockReason()` for
blocking at zoom ≠ 100%.

---

## Decision

Three precision subsystems added without changing the bridge architecture:

### 1. Arrow Key Nudge

Registered in the unified keyboard handler (currently in `boot.js`):
- `ArrowLeft/Right/Up/Down` when `state.selectedNodeId !== null` and not in text-edit mode
- Movement: 1px per press; 10px with Shift held
- Blocked when `getBlockReason() !== "none"` (reuses ADR-001 infrastructure)
- Commits position through existing `commit-direct-manipulation` bridge command
  (same path as mouse drag release — no new bridge messages)
- Constant: `DIRECT_MANIP_NUDGE_PX = 1` (already exists), `DIRECT_MANIP_NUDGE_FAST_PX = 10` (already exists)

### 2. Snap-to-Siblings Engine

During drag (`handleActiveManipulationMove`):
- Compute snap targets from sibling element bounding rects
- Snap axes: `left`, `right`, `center-x`, `top`, `bottom`, `center-y` (6 axes)
- Snap threshold: `DIRECT_MANIP_SNAP_PX = 8` (already exists in constants.js)
- Position magnetism: dragged element position snaps to nearest axis value within threshold
- Sibling rects fetched via bridge message `get-sibling-rects` (new, lightweight, read-only)

### 3. Smart Guide Lines

Visual dashed lines on the shell overlay indicating active snap:
- Rendered as `<div class="snap-guide snap-guide--h|v">` inside selection overlay container
- Appear when a snap axis activates, disappear on drag end
- Style: 1px dashed, `var(--shell-accent)` color, 40% opacity
- Tagged `data-editor-ui="true"` — stripped by export sanitizer

### Files affected

| File | Change |
|------|--------|
| `editor/src/precision.js` | New module — snap engine + guide DOM management |
| `editor/styles/precision.css` | New file — snap guide styles |
| `editor/src/selection.js` | Integrate snap into `handleActiveManipulationMove` |
| `editor/src/bridge-script.js` | Add `get-sibling-rects` handler (read-only, returns array of {nodeId, rect}) |
| `editor/src/constants.js` | No changes needed — constants already exist |
| `editor/styles/tokens.css` | Add `precision` to @layer declaration if separate layer needed |

---

## Consequences

**Positive:**
- Arrow nudge uses existing bridge command — zero new protocol risk
- Snap targets computed from sibling rects already available via bridge
- Guide lines are shell-only — no iframe DOM pollution
- All three subsystems share the same `getBlockReason()` gate
- Constants `DIRECT_MANIP_NUDGE_PX`, `DIRECT_MANIP_SNAP_PX` already defined

**Negative:**
- `get-sibling-rects` is a new bridge message — must follow postMessage security protocol
- Snap engine runs every `pointermove` event during drag — must be lightweight (no layout thrash)
- `precision.js` must not use `type="module"` — shares global scope via `window`
- Snap active at zoom ≠ 100% would produce incorrect coordinate mapping — must be gated

---

## Alternatives Considered

1. **Snap to grid** — considered but rejected as MVP; grid implies a coordinate system not present in the deck's DOM
2. **Snap to artboard edges** — deferred; slide root boundary snap is useful but lower priority
3. **Magnetic snap with preview ghost** — too complex for v0.26.0; snap without ghost is sufficient
4. **Full alignment panel (distribute, align buttons)** — deferred to v0.29+; inspector real estate concern

---

## Applied In

- v0.26.0 — `editor/src/precision.js`, `editor/styles/precision.css`
- Test: `tests/playwright/specs/precision.spec.js`

## Links

- `docs/ROADMAP_NEXT.md` — Phase 3 detail
- `docs/ADR-001-block-reason-protocol.md` — prerequisite (BlockReason gate for nudge)
- `editor/src/constants.js` — `DIRECT_MANIP_NUDGE_PX`, `DIRECT_MANIP_SNAP_PX` already defined
- `editor/src/selection.js` — `handleActiveManipulationMove`, `handleActiveManipulationEnd`
- `editor/src/bridge-script.js` — postMessage handler location for `get-sibling-rects`
