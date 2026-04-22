# ADR-001: Block Reason Protocol

**Status**: Proposed  
**Phase**: v0.25.0  
**Owner**: Agent A (feedback+onboarding worktree)

---

## Context

`hasBlockedDirectManipulationContext()` in `editor/src/feedback.js` returns a boolean.
When direct manipulation is blocked, the user sees a vague tooltip or no feedback at all.
The existing `getDirectManipulationTooltipMessage()` resolves some transform reasons but:
- Logic is scattered across `feedback.js` and `selection.js`
- 12 call sites all use the raw boolean — no structured reason
- UX output is inconsistent (sometimes tooltip, sometimes nothing, no action buttons)
- Users cannot distinguish zoom-blocked from lock-blocked from transform-blocked

This violates the product promise: _"Blocked actions must fail honestly with feedback, not silently"_ (SOURCE_OF_TRUTH.md).

---

## Decision

Replace the boolean blocker with a **reason enum** returned by a new function `getBlockReason()`:

```javascript
// BlockReason type (JSDoc enum, not TypeScript)
// "none"             — no block, manipulation is allowed
// "zoom"             — previewZoom !== 1 (coordinate precision broken)
// "locked"           — element has data-editor-locked="true"
// "container"        — entity kind is "container" or "slide-root"
// "own-transform"    — element itself uses CSS transform (non-identity)
// "parent-transform" — an ancestor uses CSS transform
// "slide-transform"  — the slide root uses CSS transform
// "hidden"           — element is visibility-toggled off in the layers panel
```

### Shell rendering

The shell renders the block reason as an **inline banner** positioned below the selection overlay frame:
- No modal, no tooltip — inline, dismissable
- Each reason has: a human-readable message (Russian locale) + optional one-click resolution button
- Banner is a `data-editor-ui="true"` element — stripped on export

```
zoom             → "Масштаб ≠ 100% — перемещение недоступно" [Сбросить]
locked           → "Элемент заблокирован 🔒" [Разблокировать]
container        → "Это контейнер — выберите дочерний элемент"
own-transform    → "Используется CSS transform — изменяйте через инспектор"
parent-transform → "Родительский элемент имеет transform"
slide-transform  → "Слайд использует transform"
hidden           → "Элемент скрыт" [Показать]
```

### Backward compatibility

`hasBlockedDirectManipulationContext()` becomes a thin wrapper:
```javascript
function hasBlockedDirectManipulationContext() {
  return getBlockReason() !== "none";
}
```

All 12 existing call sites keep working without modification.

### Files affected

| File | Change |
|------|--------|
| `editor/src/feedback.js` | Add `getBlockReason()`, update `hasBlockedDirectManipulationContext()` |
| `editor/src/selection.js` | Import `getBlockReason()`, remove scattered reason logic |
| `editor/styles/banner.css` | New file — inline banner styles |
| `editor/styles/tokens.css` | Add `banner` to `@layer` declaration |
| `editor/src/shell-overlays.js` | Render / clear banner element |

---

## Consequences

**Positive:**
- Single source of truth for block reasons
- UX surfaces clear, actionable feedback for every blocked state
- 12 call sites simplified (boolean check stays, no migration needed)
- Bridge protocol unchanged — reason lives in shell, not iframe
- Testable: each reason maps to a deterministic test fixture

**Negative:**
- New CSS layer must be added to `tokens.css` declaration first (invariant)
- `banner.css` must not use `@layer` without prior declaration
- Banner positioning requires care relative to selection overlay z-order

---

## Alternatives Considered

1. **Tooltip only** — rejected: disappears on mouse move, not discoverable by keyboard users, no action button
2. **Modal/dialog** — rejected: too heavy for a transient state, interrupts workflow
3. **Inspector section** — rejected: inspector may not be visible in basic mode; not contextual enough
4. **Keep boolean, add enum separately** — rejected: creates two sources of truth, more complex

---

## Applied In

- v0.25.0 — `editor/src/feedback.js`, `editor/styles/banner.css`
- Test: `tests/playwright/specs/honest-feedback.spec.js`
- v0.31.2 — `#lockBanner` unified into `#blockReasonBanner` via `renderBlockReasonBanner()` (WO-29); `getBlockReasonActionVisibleIn()` added; P1-02 geometry leak closed

## Links

- `docs/ROADMAP_NEXT.md` — Phase 1 detail
- `docs/ADR-002-stack-depth-indicator.md` — companion ADR in v0.25.0
- `editor/src/feedback.js` — current implementation location
- `editor/src/selection.js` — 12 call sites for `hasBlockedDirectManipulationContext()`
- `docs/SOURCE_OF_TRUTH.md` — product invariants driving this decision
