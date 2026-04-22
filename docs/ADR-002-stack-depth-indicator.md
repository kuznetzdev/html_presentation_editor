# ADR-002: Stack Depth Indicator

**Status**: Deferred to v1.1+ — Stack depth indicator visual polish not shipped in v1.0 scope; baseline badge functional as of v0.25.0  
**Phase**: v0.25.0  
**Owner**: Agent A (feedback+onboarding worktree)

---

## Context

`updateClickThroughState()` already collects all candidates under the cursor with scores.
This data is entirely shell-side (`state.clickThroughState.candidates[]`), already computed on every selection.

The problem: users don't know overlapping candidates exist until they accidentally click-cycle
or stumble on the right-click context menu "Select Layer" items. There is no progressive
disclosure — the first visible signal is a confusing behaviour (selected element jumps) rather
than a clear affordance ("there are 3 elements here, you can pick one").

This violates "no guessing" principle. Click-through exists precisely for this case — it just
needs a visible entry point.

---

## Decision

Add a lightweight **badge** `1/N` to the breadcrumb bar whenever
`state.clickThroughState.candidates.length > 1`.

```
 [ slide-root > card > h2 ] [2/3]  ← badge
```

### Implementation detail

- The badge is a `<span class="crumb-depth-badge">` appended to the breadcrumb container
- It shows `{current_index + 1}/{total}` (1-based, cycles with click-through)
- Updates in `updateBreadcrumbs()` / `renderBreadcrumbs()` — wherever breadcrumb DOM is refreshed
- Disappears when candidates.length ≤ 1 or when selection is cleared

### Zero bridge changes

The candidate list is already in `state.clickThroughState` (shell-side). No new postMessages.
No bridge protocol changes. This is purely a shell-side display addition.

### Files affected

| File | Change |
|------|--------|
| `editor/src/inspector-sync.js` | Update `updateBreadcrumbs()` to append badge when candidates > 1 |
| `editor/styles/inspector.css` | Style for `.crumb-depth-badge` |

---

## Consequences

**Positive:**
- Zero bridge changes — safest possible change
- Progressive disclosure: user sees "2/3" before clicking
- Connects visually to click-through cycling (badge updates as user cycles)
- Works in both basic and advanced modes
- Already covered by honest-feedback.spec.js as part of v0.25.0 test plan

**Negative:**
- Breadcrumb bar may get visually crowded on deep hierarchies
- Badge must be styled to feel lightweight (pill / muted color), not alarming

---

## Alternatives Considered

1. **Tooltip on selection overlay** — rejected: tooltip disappears on hover, not persistent enough
2. **Overlay element count label** — rejected: clutters the canvas, distracts from content
3. **New dedicated panel section** — rejected: too heavy for secondary information
4. **Badge in topbar** — rejected: too far from the selection; disconnected from context

---

## Applied In

- v0.25.0 — `editor/src/inspector-sync.js`
- Test: `tests/playwright/specs/honest-feedback.spec.js` — `stack depth badge reflects click-through progress only when needed`

## Links

- `docs/ROADMAP_NEXT.md` — Phase 1 detail
- `docs/ADR-001-block-reason-protocol.md` — companion ADR in v0.25.0
- `docs/ADR-003-layer-picker-popup.md` — visual upgrade of click-through in v0.25.1
- `editor/src/inspector-sync.js` — breadcrumb rendering
- `tests/playwright/specs/honest-feedback.spec.js` — existing test file to extend
