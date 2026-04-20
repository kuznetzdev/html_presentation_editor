## Step 28 — v0.26.0 · Snap-to-siblings + smart-guide overlay (nudge already shipped)

**Window:** W6   **Agent-lane:** D   **Effort:** L
**ADR:** ADR-004 (Snap and Nudge System)   **PAIN-MAP:** —
**Depends on:** none (arrow-nudge already live at `editor/src/shortcuts.js:135–151`)   **Unblocks:** —

### Context (3–5 lines)

Arrow nudge is already wired (`editor/src/shortcuts.js:135–151` — `performKeyboardNudge`; constants `DIRECT_MANIP_NUDGE_PX = 1`, `DIRECT_MANIP_NUDGE_FAST_PX = 10` at `editor/src/constants.js:151–152`). What is missing per ADR-004: (1) snap-to-siblings during drag/resize at zoom=100%, (2) smart dashed guide lines rendered in the shell overlay when snap engages, (3) a `get-sibling-rects` bridge message so the shell can compute snap targets without iframe round-trips per pointermove. This WO ships all three. Nudge behavior is NOT re-implemented — only its action is registered alongside snap in a shared gate check.

### Files owned (exclusive write)

| File | Op | LOC delta est |
|------|-----|---------------|
| `editor/src/precision.js` | new | +280 / −0 |
| `editor/styles/precision.css` | new | +80 / −0 |
| `editor/styles/tokens.css` | edit (layer declaration) | +1 / −1 |
| `editor/presentation-editor.html` | edit (overlay container + script tag) | +10 / −0 |
| `editor/src/selection.js` | edit (call snap during `handleActiveManipulationMove`) | +35 / −2 |
| `editor/src/bridge-script.js` | edit (add `get-sibling-rects` handler) | +50 / −0 |
| `editor/src/bridge.js` | edit (dispatch `get-sibling-rects` response to callback) | +20 / −0 |
| `editor/src/shortcuts.js` | edit (nudge action registration pointer — documentation comment) | +5 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/constants.js:148–152` | `DIRECT_MANIP_THRESHOLD_PX`, `DIRECT_MANIP_SNAP_PX=8`, `DIRECT_MANIP_NUDGE_PX=1`, `DIRECT_MANIP_NUDGE_FAST_PX=10` |
| `editor/src/feedback.js:646` | `getBlockReason()` — must return `"none"` to gate snap |
| `editor/src/shortcuts.js:135–151` | existing `performKeyboardNudge` registration site |
| `editor/src/selection.js` | `handleActiveManipulationMove`, `handleActiveManipulationEnd` call-sites |
| `docs/ADR-004-snap-nudge-system.md` | full spec |

### Sub-tasks (executable, each ≤ 2 h)

1. Read `editor/src/selection.js` — locate `handleActiveManipulationMove`, `handleActiveManipulationEnd`, and the existing `applyAspectRatioToResize` section. Record the exact event payload shape (dragged element node-id, current pointer x/y in shell coords) at the top of `precision.js`.
2. Declare new `@layer precision` in `editor/styles/tokens.css:2`. Position: immediately BEFORE `overlay` (precision overlays sit under selection overlay but above inspector). Expected state: `@layer tokens, base, layout, preview, broken-asset-banner, inspector, precision, overlay, history-chip, modal, responsive;` (merge with WO-24/WO-27 if they landed).
3. Create `editor/styles/precision.css`. Guide-line styles only:
```css
@layer precision {
  .snap-guides { position: absolute; inset: 0; pointer-events: none; z-index: var(--z-stage-overlay); }
  .snap-guide { position: absolute; background: transparent; opacity: 0; transition: opacity var(--motion-fast) var(--motion-ease); }
  .snap-guide.is-active { opacity: 0.7; }
  .snap-guide--h {
    height: 0; border-top: 1px dashed var(--shell-accent);
    left: 0; right: 0;
  }
  .snap-guide--v {
    width: 0; border-left: 1px dashed var(--shell-accent);
    top: 0; bottom: 0;
  }
}
```
   No new tokens — reuse existing.
4. Add the guide overlay container to `editor/presentation-editor.html` inside the preview stage region (search for `#previewStage` or `.preview-stage`). Insert immediately before the closing tag:
```html
<div
  id="snapGuides"
  class="snap-guides"
  aria-hidden="true"
  data-editor-ui="true"
></div>
```
   `data-editor-ui="true"` ensures export-strip. Individual guide lines are dynamically appended inside this container and carry the same attribute.
5. Create `editor/src/precision.js`. Classic-script, exports on `window`:
   - `window.precisionRequestSiblingRects(slideId, nodeId, callback)` — dispatches `get-sibling-rects` bridge message with `{slideId, nodeId}` payload; response comes back via bridge.js handler (sub-task 7) and invokes the callback with `Array<{nodeId, rect: {left, top, width, height}}>`. Caches for the duration of a single drag (cache cleared on `precisionEndSnapSession`).
   - `window.precisionStartSnapSession(nodeId)` — called from `handleActiveManipulationMove` on the first move event of a drag. Fetches sibling rects, stores them. Exits early if `getBlockReason() !== "none"`.
   - `window.precisionApplySnap(draggedRect)` — given the dragged element's current rect, returns `{left, top, snappedAxesX: [...], snappedAxesY: [...]}`. Snap threshold from `DIRECT_MANIP_SNAP_PX = 8`. Snap axes per ADR-004: `left`, `right`, `center-x`, `top`, `bottom`, `center-y` (6 axes). Snap magnetism: the returned `{left, top}` is the snapped position, or unchanged if no axis within threshold.
   - `window.precisionRenderGuides(axesX, axesY, draggedRect)` — creates/updates `.snap-guide` elements inside `#snapGuides`. Reuses existing DOM nodes instead of innerHTML churn. Each guide carries `data-editor-ui="true"`.
   - `window.precisionEndSnapSession()` — clears sibling cache, removes all `.snap-guide.is-active` class, called from `handleActiveManipulationEnd`.
6. Edit `editor/src/selection.js` — inside `handleActiveManipulationMove`:
   - Before applying position, call `precisionStartSnapSession(nodeId)` if not yet started this drag.
   - After computing the tentative rect from pointer delta, call `const snapped = window.precisionApplySnap?.(tentativeRect) || tentativeRect;`.
   - Replace `tentativeRect` with `snapped` for the rest of the move pipeline (including `commit-direct-manipulation` dispatch).
   - Call `window.precisionRenderGuides?.(snapped.snappedAxesX, snapped.snappedAxesY, snapped);` to update visuals.
   In `handleActiveManipulationEnd` (and `cancelActiveManipulation`), call `window.precisionEndSnapSession?.();`.
   Respect existing gate: if `getBlockReason() !== "none"` OR `state.previewZoom !== 1`, skip snap (same gate as current drag block — per ADR-004 invariant).
7. Edit `editor/src/bridge.js` — add a dispatch case for `get-sibling-rects` response. When the bridge receives `{type: "sibling-rects-response", requestId, rects}`, invoke the callback registered in `precisionRequestSiblingRects`. Use an in-memory `Map<requestId, callback>` keyed by a monotonic counter.
8. Edit `editor/src/bridge-script.js` — add a handler for incoming `get-sibling-rects` message (inside the existing postMessage dispatch switch; locate by grepping for an existing handler like `"replace-node-html"`). Payload `{slideId, nodeId, requestId}`. Handler:
   - Find the deck-side element by `data-editor-node-id`.
   - Walk the parent element's direct children; for each sibling, capture `getBoundingClientRect()` as `{left, top, width, height}` in shell coords (use the same coord-mapping the shell uses for direct manip — check `toStageRect` reference in ADR-004).
   - POST back `{type: "sibling-rects-response", requestId, rects: [...]}` via `window.parent.postMessage(..., targetOrigin)` using existing secure pattern (do NOT use `"*"`).
   - Exclude hidden siblings (`display:none`, `visibility:hidden`).
9. Edit `editor/src/shortcuts.js` — add ONE documentation comment at line 135 (top of the arrow-key block):
```javascript
// [ADR-004] Nudge action. Snap engine (editor/src/precision.js) consumes sibling rects during drag;
// this nudge path bypasses snap — nudging is discrete commitment, snap is analog-correction during drag.
```
   No functional edit — just a documentation pointer for future work where WO-10 (Agent β) migrates shortcuts to a declarative table.
10. Smart-guide rendering detail: guides should extend across the full slide bounds, not just adjacent to the dragged element (matches PowerPoint/Figma convention). Compute guide coords from the preview stage rect, not from the dragged rect.
11. Manual smoke:
    - Drag an element toward a sibling's left edge. At ≤ 8 px, element snaps; vertical dashed guide appears.
    - Drag to align centers. Center-x snap fires; guide appears at x=center of both.
    - Zoom to 125%. Drag — no snap, no guide (gate on zoom=100% respected).
    - Lock the element. Drag — snap and guide inactive (no drag happens anyway).
    - Resize instead of drag. Confirm snap on right/bottom edges of the dragged element match sibling edges.
    - Export HTML — guides stripped (search export output for `snap-guide`; should be zero).

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dependency added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] New `@layer precision` declared FIRST in `tokens.css`
- [ ] Snap and guide rendering BOTH gate on `state.previewZoom === 1` AND `getBlockReason() === "none"` — identical to current drag gate
- [ ] Guide-line elements carry `data-editor-ui="true"` and are stripped on export (verify via `tests/playwright/specs/asset-parity.spec.js`)
- [ ] No hardcoded snap threshold — reads `DIRECT_MANIP_SNAP_PX` from constants
- [ ] Nudge behavior at `shortcuts.js:135–151` is UNCHANGED (only a comment added)
- [ ] Russian UI copy: no banner/toast text is added by this WO — but if an error toast is needed (e.g. bridge timeout), use `Не удалось посчитать направляющие — попробуйте ещё раз`

### Acceptance criteria (merge-gate, falsifiable)

- [ ] Spec `tests/playwright/specs/precision.spec.js` (new) step 1: drag element within 8 px of sibling's left edge → final committed `left` equals sibling's `left` (±0 px).
- [ ] Step 2: during drag, `#snapGuides .snap-guide--v.is-active` exists at the snap X coordinate.
- [ ] Step 3: on drag end, `#snapGuides .snap-guide.is-active` count equals 0.
- [ ] Step 4: at zoom 125%, drag within 8 px does NOT snap — final `left` differs from sibling.
- [ ] Step 5: exported HTML (from `asset-parity.spec.js`) contains zero `snap-guide` substrings.
- [ ] Arrow nudge regression (1px/10px) still passes — existing `editor.regression.spec.js` if it covers nudge.
- [ ] Gate-A still 55/5/0.
- [ ] Conventional commit: `feat(precision): snap-to-siblings + smart guide overlay (ADR-004) — v0.26.0 step 28`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Snap on drag within 8 px of sibling left edge | gate-b | `tests/playwright/specs/precision.spec.js` (new) | N/A | pass |
| Guide line appears on snap | gate-b | same spec | N/A | pass |
| Snap/guide absent at zoom ≠ 100% | gate-b | same spec | N/A | pass |
| Arrow nudge 1px / 10px still works | gate-a | `tests/playwright/specs/editor.regression.spec.js` | pass | pass |
| Export strips guide overlay | gate-e | `tests/playwright/specs/asset-parity.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** `get-sibling-rects` bridge call per `pointermove` event floods the bridge — 60+ calls/sec cause latency.
- **Mitigation:** Cache sibling rects at drag start (sub-task 5). Invalidate only on session end. 1 bridge call per drag.
- **Risk:** Sibling rects reported in iframe coords; shell expects shell coords. Off-by-scroll bug.
- **Mitigation:** Bridge handler (sub-task 8) converts to shell coords using the same `toStageRect` translation used by existing direct manip. Reference ADR-004 Consequences note.
- **Risk:** Snap engine engages during resize as well as drag — user resizes a box, it suddenly jumps to sibling edges.
- **Mitigation:** Treat resize snap target = edges of the dragged element being resized. Exclude center-x/center-y snap during resize (only left/right/top/bottom make sense). Handle via a `mode: "drag" | "resize"` argument to `precisionApplySnap`.
- **Risk:** Guide lines blink visibly as the user drags across many siblings (axes switch rapidly).
- **Mitigation:** Use CSS opacity transition (`var(--motion-fast)`) not display:none. Adds smoothness.
- **Rollback:** `git revert <sha>`. precision.js/precision.css are self-contained; selection.js and bridge.js edits are additive (new code paths guarded by `typeof window.precisionApplySnap === "function"`).

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:frontend-developer
isolation: worktree
branch_prefix: claude/wo-28-snap-nudge-engine
```

````markdown
You are implementing Step 28 (v0.26.0 · snap + smart-guide engine) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-28-snap-nudge-engine (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/ADR-004-snap-nudge-system.md
  3. Read docs/work-orders/W6/WO-28-snap-nudge-engine.md (this file)
  4. Read editor/src/selection.js handleActiveManipulationMove/End for payload shape
  5. Read editor/src/bridge-script.js / bridge.js to learn existing postMessage pattern
  6. npm run test:gate-a — must be 55/5/0

FILES YOU OWN (exclusive write):
  - editor/src/precision.js (new)
  - editor/styles/precision.css (new)
  - editor/styles/tokens.css (layer declaration line only)
  - editor/presentation-editor.html (snapGuides container + script tag only)
  - editor/src/selection.js (only handleActiveManipulationMove/End call-sites)
  - editor/src/bridge-script.js (only the new get-sibling-rects handler)
  - editor/src/bridge.js (only the new sibling-rects-response dispatch)
  - editor/src/shortcuts.js (only the one documentation comment at line 135)
  - tests/playwright/specs/precision.spec.js (new)

FILES READ-ONLY:
  - editor/src/constants.js, feedback.js, state.js
  - docs/audit/PAIN-MAP.md (for context)

SUB-TASKS: verbatim 1–11 above.

INVARIANTS:
  - No type="module"; no bundler
  - Snap + guide gate on state.previewZoom === 1 AND getBlockReason() === "none"
  - Threshold from DIRECT_MANIP_SNAP_PX constant, no literal 8
  - Guide elements data-editor-ui="true" and stripped on export
  - Classic-script globals on window
  - Nudge behavior at shortcuts.js:135-151 UNCHANGED (comment only)
  - Gate-A 55/5/0
  - All shell overlays under the existing z-index ladder (var(--z-stage-overlay))

ACCEPTANCE: verbatim from section above.

ON COMPLETION:
  1. npm run test:gate-a and test:gate-b
  2. git add <list above>
  3. Conventional commit: "feat(precision): snap-to-siblings + smart guide overlay (ADR-004) — v0.26.0 step 28"
  4. Report: bridge round-trip latency measurement, snap accuracy, guide visibility at various zoom levels

CROSS-BATCH HAND-OFF:
  Agent β's WO-10 is designing a declarative keyboard-handler table. When WO-10 lands,
  register the nudge action into the declarative table and remove the inline if-block at shortcuts.js:135-151.
  Your WO-28 only adds a comment — it does NOT migrate the nudge. Keep the comment accurate so WO-10 finds it.
````

### Rollback plan

If merge breaks main: `git revert <sha>`. precision.js/css revert cleanly; selection.js snap hook is guarded by `typeof window.precisionApplySnap === "function"` so post-revert it becomes no-op. Bridge handler is additive; revert leaves the bridge in pre-WO state.
