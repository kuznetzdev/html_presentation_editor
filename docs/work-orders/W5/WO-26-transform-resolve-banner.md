## Step 26 — v0.27.2 · Block-reason banner: transform field + Resolve action

**Window:** W5   **Agent-lane:** D   **Effort:** S
**ADR:** ADR-001 (Block Reason Protocol — extends)   **PAIN-MAP:** P0-06
**Depends on:** none   **Unblocks:** WO-29 (unified banner needs a known set of actions)

### Context (3–5 lines)

The block-reason banner tells users "Используется transform — перемещение через инспектор" (`editor/src/feedback.js:684–687`) but the inspector has no `transform` field — verified by grep returning zero results for any `transformInput` or `transformField`. The "use inspector" instruction is a dead end for ~60% of real-world blocks (PAIN-MAP P0-06, AUDIT-B journey 11). This WO adds (1) a read/write `transform` input inside the inspector geometry-advanced section, (2) a `Resolve` action button on the block banner that scrolls to and focuses that field, and (3) a `Убрать transform` one-click reset inside the inspector row.

### Files owned (exclusive write)

| File | Op | LOC delta est |
|------|-----|---------------|
| `editor/presentation-editor.html` | edit (new `transform` input in geometry section) | +35 / −0 |
| `editor/src/inspector-sync.js` | edit (populate + write-through for transform; advanced-only gating) | +80 / −4 |
| `editor/src/feedback.js` | edit (extend `getBlockReasonAction` to return `resolve-transform` for transform-family reasons) | +25 / −1 |
| `editor/src/inspector-bindings.js` OR `editor/src/dom.js` | edit (wire `resolve-transform` action → scroll + focus transform input) | +30 / −0 |
| `editor/styles/inspector.css` | edit (tiny polish for new row) | +15 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/feedback.js:693–700` | `getBlockReasonAction` switch |
| `editor/src/inspector-sync.js:905–944` | block banner rendering |
| `editor/src/primary-action.js:286–288` | getBlockReason/getBlockReasonLabel consumers (no edit) |
| `docs/ADR-001-block-reason-protocol.md` | reason enum + applies-in list |
| `docs/audit/AUDIT-B-ux-journeys.md` | journeys 5 and 11 |

### Sub-tasks (executable, each ≤ 2 h)

1. Locate the geometry-advanced section in `editor/presentation-editor.html` (AUDIT-B §11 cites lines ~1193–1247 for display/position/width/height/left/top fields). Read the block and identify the last geometry row. Expected state: confirm the row structure used for existing fields (label + input + helper text) so the new transform row matches pattern.
2. Add the transform input row to `editor/presentation-editor.html` inside the geometry-advanced section, after the existing geometry rows. Markup:
```html
<div class="inspector-row inspector-row--transform" data-ui-level="advanced">
  <label for="transformInput" class="inspector-label">
    Transform
  </label>
  <div class="inspector-row-controls">
    <input
      type="text"
      id="transformInput"
      class="inspector-input inspector-input--mono"
      placeholder="rotate(5deg) scale(1.1)"
      spellcheck="false"
      autocomplete="off"
    />
    <button type="button" id="resetTransformBtn" class="ghost-btn" title="Убрать transform">
      Убрать
    </button>
  </div>
  <p class="inspector-hint" id="transformHint">
    CSS transform элемента. Пустая строка — без трансформации.
  </p>
</div>
```
   Respect `data-ui-level="advanced"` so basic mode hides the row by default.
3. Edit `editor/src/inspector-sync.js` — populate the transform input whenever selection changes. Add in the same write-pass as other geometry fields (search for `"transform"` or the existing geometry-field write loop). New logic:
   ```javascript
   if (els.transformInput) {
     const node = getSelectedModelNode();
     const inlineTransform = node instanceof HTMLElement
       ? (node.style.transform || "")
       : "";
     if (document.activeElement !== els.transformInput) {
       els.transformInput.value = inlineTransform;
     }
     els.transformInput.disabled = !state.selectedPolicy?.canEditStyles;
     if (els.resetTransformBtn) {
       els.resetTransformBtn.disabled = els.transformInput.disabled || !inlineTransform;
     }
   }
   ```
   Do not overwrite the input while the user is actively typing (the `document.activeElement` guard).
4. Wire write-through. In `editor/src/inspector-bindings.js` (or `editor/src/dom.js` if that is the binding module — check `grep bindInspectorActions`): add a `change` handler on `#transformInput`:
   - Trim value; if the trimmed value matches a relaxed transform-function regex `/^([a-zA-Z]+\([^)]*\)\s*)*$/` — accept.
   - Dispatch through the existing `applyStyle("transform", value)` path (same path used for other style mutations).
   - If value is empty, dispatch `applyStyle("transform", "")`.
   - If regex fails, do NOT mutate; show a toast `"Некорректный transform — оставлено как есть"` (Russian, short).
   Reference: find the existing `applyStyle` handler site for font-size or another style to match pattern.
5. Wire `#resetTransformBtn` click → `applyStyle("transform", ""); els.transformInput.value = "";` with a toast `"Transform убран"`.
6. Edit `editor/src/feedback.js:693` — extend `getBlockReasonAction`:
```javascript
function getBlockReasonAction(reason) {
  switch (reason) {
    case "zoom": return { label: "Сбросить масштаб", action: "reset-zoom" };
    case "locked": return { label: "Разблокировать", action: "unlock" };
    case "hidden": return { label: "Показать", action: "show" };
    case "own-transform":
    case "parent-transform":
    case "slide-transform":
    case "transform":
      return { label: "Открыть инспектор", action: "resolve-transform" };
    default: return null;
  }
}
```
   The "Открыть инспектор" label is load-bearing Russian copy — do not vary.
7. In `editor/src/inspector-sync.js` lines 923+ (where the banner action button is wired), add a case for `resolve-transform`. When that action is clicked:
   - `state.complexityMode = "advanced"` if currently basic (call existing `setComplexityMode("advanced")`; this matches the "switch-advanced" pattern from inspector-sync.js:742).
   - Scroll the inspector to the geometry section: `els.transformInput?.scrollIntoView({ block: "center", behavior: "smooth" });`
   - Focus after a 180ms settle timer (matches motion-medium): `setTimeout(() => els.transformInput?.focus(), 180);`
   - Add a transient highlight pulse by toggling a `.is-resolving` class on the `inspector-row--transform` element for 1200ms (CSS in sub-task 8).
8. Edit `editor/styles/inspector.css`:
```css
.inspector-row--transform .inspector-input--mono {
  font-family: ui-monospace, "SF Mono", Consolas, monospace;
  font-size: var(--text-sm);
}
.inspector-row--transform .inspector-row-controls {
  display: flex; gap: var(--space-2);
}
.inspector-row--transform.is-resolving {
  outline: 2px solid var(--shell-accent);
  outline-offset: 2px;
  transition: outline-color var(--motion-medium) var(--motion-ease);
}
```
   No new tokens. No new @layer — inspector.css already sits inside `@layer inspector`.
9. Register the `transformInput` and `resetTransformBtn` element refs. Add to `editor/src/state.js` at the end of the `els` initializer block (non-exclusive-write? — wait, state.js is read-only). If state.js adopting a new ref requires write, coordinate with Agent-lane who owns state.js in this window. Fallback: call `document.getElementById("transformInput")` inline where needed — acceptable for this one-off, and a future refactor can lift it to `els`. Record in commit notes which path was taken.
10. Manual smoke:
    - Open a deck with a rotated element (e.g. add `style="transform: rotate(5deg)"` to any `<div>` in the starter deck).
    - Select the element.
    - Verify block banner shows `Используется transform — перемещение через инспектор` with action button `Открыть инспектор`.
    - Click the action button; verify: basic→advanced switch happens if needed, inspector scrolls to transform row, input is focused, `.is-resolving` pulse fires.
    - Type a valid new transform (`rotate(10deg)`); commit via Enter or blur; verify element updates.
    - Click `Убрать`; verify transform is removed and banner clears.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dependency added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] No new `@layer` added
- [ ] All UI copy Russian: `Transform`, `Убрать`, `CSS transform элемента. Пустая строка — без трансформации.`, `Некорректный transform — оставлено как есть`, `Transform убран`, `Открыть инспектор`
- [ ] No dead end on transform-family block reasons (the core of P0-06)
- [ ] Transform input is advanced-mode only (`data-ui-level="advanced"`); auto-opens when resolve-transform fires from basic mode

### Acceptance criteria (merge-gate, falsifiable)

- [ ] With a selected element carrying inline `transform: rotate(5deg)`, the block banner's action button label reads `Открыть инспектор`, verified by spec `tests/playwright/specs/transform-resolve.spec.js` (new).
- [ ] Clicking the action button sets `data-ui-complexity="advanced"` (or equivalent state), scrolls to `#transformInput`, and focuses it within 500ms.
- [ ] Typing `rotate(10deg)` + blur mutates the element's inline `transform` to `rotate(10deg)` — asserted via Playwright evaluating the iframe DOM.
- [ ] Clicking `#resetTransformBtn` clears `style.transform` and hides the block banner (because `getBlockReason()` now returns `"none"` for this element).
- [ ] Invalid transform string (e.g. `abc`) does NOT mutate the element and shows the toast.
- [ ] Gate-A still 55/5/0.
- [ ] Conventional commit: `feat(ux): transform resolve action + inspector transform input (P0-06) — v0.27.2 step 26`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Banner shows "Открыть инспектор" for transform reason | gate-b | `tests/playwright/specs/transform-resolve.spec.js` (new) | N/A | pass |
| Action button focuses #transformInput | gate-b | same spec | N/A | pass |
| Write-through updates element.style.transform | gate-b | same spec | N/A | pass |
| Invalid value rejected with toast | gate-b | same spec | N/A | pass |
| Reset clears transform + banner | gate-b | same spec | N/A | pass |
| Shell smoke | gate-a | `tests/playwright/specs/shell.smoke.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** Regex `/^([a-zA-Z]+\([^)]*\)\s*)*$/` accepts some invalid syntax (e.g. `foo()`). CSS engines ignore invalid transforms silently — leaving the user with no feedback.
- **Mitigation:** Defer deep validation; the regex is a first-pass guard. After apply, read back `getComputedStyle(node).transform`; if `none` and the input was non-empty, show the toast.
- **Risk:** `state.js` is read-only per cross-batch discipline — adding an `els.transformInput` ref may conflict.
- **Mitigation:** Sub-task 9 fallback uses inline `document.getElementById`; document the choice in commit notes; WO-29 banner-unification can lift the ref in a later pass.
- **Risk:** Transform-family reasons differ from just "transform"; missing one case lets a dead end remain.
- **Mitigation:** Sub-task 6 covers all four cases explicitly.
- **Rollback:** `git revert <sha>`; banner falls back to the old no-action behavior for transform-family; no state corruption risk since no schema change.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:ui-ux-designer
isolation: worktree
branch_prefix: claude/wo-26-transform-resolve
```

````markdown
You are implementing Step 26 (v0.27.2 · transform resolve banner) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-26-transform-resolve (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/ADR-001-block-reason-protocol.md
  3. Read docs/audit/AUDIT-B-ux-journeys.md journeys 5 and 11
  4. Read docs/work-orders/W5/WO-26-transform-resolve-banner.md (this file)
  5. npm run test:gate-a — must be 55/5/0

FILES YOU OWN (exclusive write):
  - editor/presentation-editor.html (only the new transform row)
  - editor/src/inspector-sync.js (populate + banner-action wiring for resolve-transform)
  - editor/src/feedback.js (only extend getBlockReasonAction)
  - editor/src/inspector-bindings.js or editor/src/dom.js (whichever hosts bindInspectorActions)
  - editor/styles/inspector.css (only .inspector-row--transform and .is-resolving rules)
  - tests/playwright/specs/transform-resolve.spec.js (new)

FILES READ-ONLY:
  - editor/src/state.js, primary-action.js, selection.js, constants.js
  - docs/audit/PAIN-MAP.md (P0-06)

SUB-TASKS: verbatim 1–10 above.

INVARIANTS:
  - No type="module"; no bundler
  - Russian UI copy only: "Transform", "Убрать", "Открыть инспектор", "Некорректный transform — оставлено как есть", "Transform убран"
  - data-ui-level="advanced" on the new row
  - resolve-transform must SWITCH basic→advanced when needed (this is the no-dead-end fix)
  - getBlockReasonAction returns the new action for ALL four transform-family reasons
  - Gate-A 55/5/0

ACCEPTANCE: verbatim from section above.

ON COMPLETION:
  1. npm run test:gate-a and npm run test:gate-b
  2. git add editor/presentation-editor.html editor/src/inspector-sync.js editor/src/feedback.js editor/src/inspector-bindings.js editor/styles/inspector.css tests/playwright/specs/transform-resolve.spec.js
  3. Conventional commit: "feat(ux): transform resolve action + inspector transform input (P0-06) — v0.27.2 step 26"
  4. Report: which binding module hosts bindInspectorActions, whether state.js els was extended or inline getElementById was used
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Transform row is advanced-only; basic users see no change on revert.
