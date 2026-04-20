# ADR-003: Layer Picker Popup

**Status**: Proposed  
**Phase**: v0.25.1  
**Owner**: Agent B (layer-picker worktree)

---

## Context

Click-through cycling (`trySelectFromClickThroughState` in `bridge-script.js`) works correctly
but is invisible. The user must click repeatedly and guess which element is selected.

The right-click context menu already has "Select layer" items but requires:
- Right-click (not discoverable in basic mode)
- Reading raw DOM labels (tag names, not entity kinds)
- No preview/ghost highlighting of the candidate before selecting

ADR-002 adds a `1/N` badge — but that's still a "blind" interface. ADR-003 makes it visual.

The stack depth badge (ADR-002) provides the entry point: when the user sees `2/3` they know
a picker exists. Second click on the same point opens it.

---

## Decision

**Second plain click on an already-selected element with `candidates.length > 1` opens a
compact floating picker panel** listing all candidates with entity-kind-aware labels.

### Trigger logic

```
Click 1 (any point)  → select topmost candidate (existing behavior, unchanged)
Click 2 (same point, already selected) → open layer picker popup
Click N on picker row → select that candidate; close popup
```

### Picker panel content

Each row shows:
- Entity kind icon (text / image / container / video / etc.)
- Human label: `data-node-id` truncated, or first 30 chars of text content, or tag name as fallback
- Subtle z-order indicator (1 = topmost)

### Hover preview

Row hover triggers `overlap-ghost-highlight` on that candidate element in the iframe
(reuses existing `sendBridgeMessage({ type: "show-overlap-ghost", nodeId })` infrastructure).

### Keyboard navigation

- Arrow Up / Down — move between rows
- Enter — select focused row
- Escape — dismiss, keep current selection

### Mutual exclusion

Layer picker participates in the existing transient-surface routing:
- Opening context menu → closes picker
- Opening insert palette → closes picker
- Opening topbar overflow → closes picker
- And vice versa

### Positioning

Picker positions near the click point, shifted to stay inside viewport.
Minimum 8px from viewport edges.

### Files affected

| File | Change |
|------|--------|
| `editor/src/layer-picker.js` | New module — picker DOM, keyboard nav, mutual exclusion |
| `editor/styles/layer-picker.css` | New CSS file — picker panel styles |
| `editor/styles/tokens.css` | Add `layer-picker` to @layer declaration (or reuse `overlay`) |
| `editor/src/shell-overlays.js` | Call `openLayerPicker()` on second click trigger |
| `editor/src/selection.js` | Detect "second click at same point" and route to layer picker |

---

## Consequences

**Positive:**
- Replaces invisible click-cycling with a visible, keyboard-navigable list
- Reuses existing candidate data and ghost infrastructure — no new bridge messages
- Progressive: first click still works as before; picker is opt-in
- Consistent with transient-surface routing pattern

**Negative:**
- New JS module must not use `type="module"` (architecture invariant)
- Second-click detection must be tolerant of small pointer jitter (≤ 6px, matching drag threshold)
- Mutual exclusion logic in `shell-overlays.js` must be updated for new surface ID
- Ghost highlight requires bridge postMessage on each row hover — potential performance concern on slow decks

---

## Alternatives Considered

1. **Replace click-cycling entirely** — rejected: cycling works in keyboard flows; don't break existing UX
2. **Always-visible layer panel sidebar** — rejected: takes permanent space, basic-mode hostile
3. **Right-click only** — rejected: already exists in context menu; need progressive disclosure on plain click
4. **Radial menu** — rejected: hard to align with entity kind labels; non-standard

---

## Applied In

- v0.25.1 — `editor/src/layer-picker.js`, `editor/styles/layer-picker.css`
- Test: `tests/playwright/specs/layer-picker.spec.js`

## Links

- `docs/ROADMAP_NEXT.md` — Phase 2 detail
- `docs/ADR-002-stack-depth-indicator.md` — prerequisite (badge shows entry point)
- `editor/src/shell-overlays.js` — transient surface mutual exclusion lives here
- `editor/src/bridge-script.js` — `trySelectFromClickThroughState`, ghost highlight
