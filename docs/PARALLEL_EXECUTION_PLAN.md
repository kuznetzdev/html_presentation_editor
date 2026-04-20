# PARALLEL EXECUTION PLAN — v0.25.0 → v0.28.0

> Architecture for running v0.25–v0.28 as 4 parallel sub-agent worktrees
> with safe merge order and conflict-free file surfaces.
>
> RULE: No agent touches a file owned by another agent. Integration agent merges in order.
> RULE: Gate-A (55/5/0) required after each merge before proceeding.

---

## Sub-Agent Map

```
┌─────────────────────────────────────────────────────────┐
│                    PARALLEL PHASE                       │
│  Agent A           Agent B          Agent C   Agent D   │
│  (Feedback +       (Layer Picker)   (Precision)(A11y +  │
│   Onboarding)                       Editing)   VR gate) │
│   v0.25.0 +         v0.25.1         v0.26.0   v0.27.1+ │
│   v0.27.0                                     v0.28.0  │
└────────────────┬──────────────────────────────┬─────────┘
                 │          serial               │
                 ▼                               ▼
         ┌───────────────────────────────────────────┐
         │          Agent E — Integration            │
         │   Merge A → B → C → D; Gate-A each time  │
         └───────────────────────────────────────────┘
```

---

## Agent Definitions

### Agent A — Feedback + Onboarding

```
subagent_type: all-agents:frontend-developer
isolation: worktree
versions: v0.25.0 + v0.27.0
```

**Files owned (exclusive)**:

| File | Operation |
|------|-----------|
| `editor/src/feedback.js` | Add `getBlockReason()` enum function |
| `editor/styles/banner.css` | NEW — inline banner styles |
| `editor/src/onboarding.js` | Add starter-deck CTA + action hints |
| `tests/playwright/specs/honest-feedback.spec.js` | Extend — block banner + badge + hints |
| `tests/playwright/specs/onboarding.spec.js` | NEW — starter deck + first-select hint |

**Shared files (read-only, no edit)**:
- `editor/src/constants.js` (read STARTER_DECKS, DIRECT_MANIP_THRESHOLD_PX)
- `editor/src/selection.js` (read `hasBlockedDirectManipulationContext` call sites only)

**Does NOT touch**:
- `editor/src/bridge-script.js`
- `editor/src/inspector-sync.js` (badge is Agent A but via feedback.js call)
- Any precision/snap files
- Any a11y/visual test files

**Conflict risk**: LOW
The only shared file is `inspector-sync.js` for the stack depth badge render.
To avoid conflict: Agent A adds a helper `getStackDepthBadgeText(state)` in `feedback.js`;
Agent E's integration step wires it into `inspector-sync.js` after Agent A merges.

---

### Agent B — Layer Picker

```
subagent_type: all-agents:ui-ux-designer
isolation: worktree
version: v0.25.1
```

**Files owned (exclusive)**:

| File | Operation |
|------|-----------|
| `editor/src/layer-picker.js` | NEW — picker DOM, keyboard nav |
| `editor/styles/layer-picker.css` | NEW — picker panel styles |
| `tests/playwright/specs/layer-picker.spec.js` | NEW — full picker spec |

**Shared files (read-only)**:
- `editor/src/shell-overlays.js` — reference only; Agent E wires mutual exclusion after B merges
- `editor/src/bridge-script.js` — reference only for ghost highlight message names
- `editor/styles/tokens.css` — read @layer declaration order

**Does NOT touch**:
- `editor/src/selection.js` (trigger logic wired by Agent E)
- Any feedback/onboarding files

**Conflict risk**: VERY LOW
Agent B only creates new files. The wiring into `shell-overlays.js` and `selection.js` is done
by Agent E in the integration step.

---

### Agent C — Precision Editing

```
subagent_type: all-agents:javascript-developer
isolation: worktree
version: v0.26.0
```

**Files owned (exclusive)**:

| File | Operation |
|------|-----------|
| `editor/src/precision.js` | NEW — snap engine + guide DOM |
| `editor/styles/precision.css` | NEW — snap guide styles |
| `tests/playwright/specs/precision.spec.js` | NEW — nudge + snap spec |

**Shared files (careful edit)**:
- `editor/src/bridge-script.js` — add `get-sibling-rects` handler ONLY at end of message switch
- `editor/src/selection.js` — integrate snap into `handleActiveManipulationMove` (bottom of function)

**Conflict matrix — bridge-script.js**:
Agent C adds ONE new `case 'get-sibling-rects':` block to the bridge message switch.
This is append-only at a specific location. Merge must be done after Agent A (which doesn't touch bridge) and
Agent B (which also doesn't touch bridge). No conflict expected.

**Conflict matrix — selection.js**:
Agent C edits `handleActiveManipulationMove` to call `applySnapToPosition()` from `precision.js`.
Agent A reads but does NOT edit `selection.js`. No conflict expected if merge order is A → B → C.

**Does NOT touch**:
- `editor/styles/banner.css` (Agent A)
- `editor/src/layer-picker.js` (Agent B)
- Any a11y/visual test files

**Conflict risk**: LOW (controlled by merge order A → B → C)

---

### Agent D — Accessibility + Visual Regression

```
subagent_type: all-agents:accessibility-specialist
isolation: worktree
versions: v0.27.1 + v0.28.0
```

**Files owned (exclusive)**:

| File | Operation |
|------|-----------|
| `tests/a11y/shell-a11y.spec.js` | NEW |
| `tests/a11y/keyboard-nav.spec.js` | NEW |
| `tests/a11y/contrast.spec.js` | NEW |
| `tests/visual/shell-visual.spec.js` | NEW |
| `tests/visual/__snapshots__/` | NEW — initial snapshot generation |

**Shared files (careful edit)**:
- `package.json` — add `@axe-core/playwright` devDependency + 3 new scripts
- `playwright.config.js` — add `chromium-visual` project config

**Conflict matrix — package.json**:
Only Agent D touches `package.json`. Merge D last (after A → B → C → D).
No conflict expected.

**Does NOT touch**:
- Any `editor/src/` files
- Any `editor/styles/` files

**Conflict risk**: VERY LOW (only new test files + package.json edits)

---

### Agent E — Integration

```
subagent_type: all-agents:architect-review
sequential (after A, B, C, D complete)
```

**Integration tasks (in order)**:

1. **Merge A** — feedback + onboarding
   - Wire `getStackDepthBadgeText()` into `inspector-sync.js` breadcrumb render
   - Add `banner` layer to `tokens.css` `@layer` declaration
   - Run Gate-A → must be 55/5/0

2. **Merge B** — layer picker
   - Wire `openLayerPicker()` into `shell-overlays.js` mutual exclusion
   - Wire "second click at same point" detection into `selection.js`
   - Add `layer-picker` to `tokens.css` `@layer` declaration (or alias overlay layer)
   - Run Gate-A → must be 55/5/0

3. **Merge C** — precision editing
   - Add `precision` to `tokens.css` `@layer` declaration if separate layer
   - Verify `bridge-script.js` `get-sibling-rects` handler is syntactically clean
   - Run Gate-A → must be 55/5/0

4. **Merge D** — a11y + visual regression
   - Initial snapshot generation: `npm run test:gate-visual:update`
   - Commit generated snapshots
   - Run Gate-A → must be 55/5/0; run `test:gate-a11y` → zero violations

5. **Tag and push** — semver tags per merge (v0.25.0, v0.25.1, v0.26.0, v0.27.1, v0.28.0)

---

## Conflict Surface Analysis

### Full file ownership map

| File | Agent A | Agent B | Agent C | Agent D | Agent E |
|------|:-------:|:-------:|:-------:|:-------:|:-------:|
| `editor/src/feedback.js` | ✏️ OWNS | — | — | — | — |
| `editor/src/onboarding.js` | ✏️ OWNS | — | — | — | — |
| `editor/styles/banner.css` | ✏️ NEW | — | — | — | — |
| `editor/src/layer-picker.js` | — | ✏️ NEW | — | — | — |
| `editor/styles/layer-picker.css` | — | ✏️ NEW | — | — | — |
| `editor/src/precision.js` | — | — | ✏️ NEW | — | — |
| `editor/styles/precision.css` | — | — | ✏️ NEW | — | — |
| `editor/src/bridge-script.js` | 📖 read | 📖 read | ✏️ append | — | — |
| `editor/src/selection.js` | 📖 read | 📖 read | ✏️ edit | — | 🔧 wire |
| `editor/src/inspector-sync.js` | 📖 read | — | — | — | 🔧 wire |
| `editor/src/shell-overlays.js` | — | 📖 read | — | — | 🔧 wire |
| `editor/styles/tokens.css` | 📖 read | 📖 read | 📖 read | — | ✏️ @layer |
| `package.json` | — | — | — | ✏️ deps | — |
| `playwright.config.js` | — | — | — | ✏️ project | — |
| `tests/a11y/*.spec.js` | — | — | — | ✏️ NEW | — |
| `tests/visual/*.spec.js` | — | — | — | ✏️ NEW | — |

**Legend:** ✏️ = write/create  📖 = read-only  🔧 = integration wiring  — = not touched

### Zero-conflict verification

- No two parallel agents write the same file
- All "shared edits" (`bridge-script.js`, `selection.js`) are assigned to ONE agent (C) with append-only strategy
- Integration wiring (`inspector-sync.js`, `shell-overlays.js`, `tokens.css`) is Agent E's responsibility AFTER merges
- `package.json` is Agent D only (last merge)

---

## Merge Order + Gate

```
Start: main @ v0.24.0, Gate-A: 55/5/0

1. Merge Agent A  → tag v0.25.0  → Gate-A: 55/5/0 ✓
2. Merge Agent B  → tag v0.25.1  → Gate-A: 55/5/0 ✓
3. Merge Agent C  → tag v0.26.0  → Gate-A: 55/5/0 ✓
   (+ v0.27.0 if Agent A included onboarding — may be one PR or two)
4. Merge Agent D  → tag v0.27.1  → Gate-A: 55/5/0 ✓ + Gate-A11y: 0 violations
                 → tag v0.28.0  → Gate-A: 55/5/0 ✓ + Gate-Visual: 0 diffs
5. Ship v0.28.0
```

---

## Ready Agent Prompts

### Agent A Prompt

```
subagent_type: all-agents:frontend-developer
isolation: worktree

You are implementing v0.25.0 Honest Feedback + v0.27.0 Onboarding for the
html-presentation-editor project.

Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: main (baseline v0.24.0, Gate-A 55/5/0)
Architecture: 25 classic <script src> JS modules, NO type="module", NO bundler.
All files share window scope. Gate-A must stay 55/5/0.

YOUR TASK (DO NOT write code for other agents' files):

1. Read: editor/src/feedback.js — find hasBlockedDirectManipulationContext() and
   getDirectManipulationTooltipMessage(). Understand all 12 call sites.

2. Add getBlockReason() to feedback.js returning one of:
   "none"|"zoom"|"locked"|"container"|"own-transform"|"parent-transform"|"slide-transform"|"hidden"
   Make hasBlockedDirectManipulationContext() a thin wrapper: getBlockReason() !== "none"

3. Create editor/styles/banner.css — inline banner below selection overlay.
   DO NOT add @layer declaration here — Agent E handles tokens.css @layer wiring.
   Style: .block-reason-banner { position: absolute; ... }
   Include resolution button styles.

4. Add getStackDepthBadgeText(candidates) helper to feedback.js:
   Returns "1/N" string when candidates.length > 1, empty string otherwise.
   DO NOT wire it into inspector-sync.js — Agent E does that.

5. Edit editor/src/onboarding.js — add "Try starter example" button to empty state card.
   Uses STARTER_DECKS.basic.href (already defined in constants.js).
   Add first-select action hint logic (sessionStorage flag 'editor:first-select-hint-shown').
   Hint uses banner.css classes.

6. Write/extend tests:
   - tests/playwright/specs/honest-feedback.spec.js (extend existing)
   - tests/playwright/specs/onboarding.spec.js (new)

7. Run Gate-A: npm run test:gate-a → must be 55/5/0 before committing.

ADR references:
- docs/ADR-001-block-reason-protocol.md
- docs/ADR-002-stack-depth-indicator.md
- docs/ADR-005-onboarding-starter-deck.md

ARCHITECTURE INVARIANTS (non-negotiable):
  ✗ No type="module"
  ✗ No bundler
  ✗ Do NOT touch tokens.css @layer (Agent E handles)
  ✗ Do NOT touch bridge-script.js
  ✗ Do NOT touch selection.js
  ✗ Do NOT touch inspector-sync.js
```

---

### Agent B Prompt

```
subagent_type: all-agents:ui-ux-designer
isolation: worktree

You are implementing v0.25.1 Visual Layer Picker for the html-presentation-editor.

Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: main (baseline v0.24.0, Gate-A 55/5/0)
Architecture: 25 classic <script src> JS modules, NO type="module", NO bundler.

YOUR TASK (create new files ONLY — do not edit existing files):

1. Read: editor/src/shell-overlays.js — understand transient surface mutual exclusion pattern.
   Read: editor/src/bridge-script.js — find show-overlap-ghost and hide-overlap-ghost message types.
   Read: docs/ADR-003-layer-picker-popup.md — full spec.

2. Create editor/src/layer-picker.js (no type="module"):
   - openLayerPicker(candidates, anchorX, anchorY) — builds picker DOM
   - closeLayerPicker() — removes picker DOM
   - Layer picker panel: floating div, candidates[] rows with entity kind icon + label
   - Keyboard: ArrowUp/Down, Enter, Escape
   - Hover on row: call shell → bridge ghost highlight (reference only, Agent E wires)
   - Expose openLayerPicker / closeLayerPicker on window for Agent E wiring
   - Zero bridge calls from this file — Agent E wires the bridge connection

3. Create editor/styles/layer-picker.css:
   - .layer-picker-popup { position: fixed; z-index: ...; }
   - .layer-picker-row { display: flex; align-items: center; gap: 8px; }
   - .layer-picker-row:hover, .layer-picker-row:focus { background: var(--shell-hover); }
   - DO NOT add @layer declaration — Agent E handles tokens.css wiring

4. Create tests/playwright/specs/layer-picker.spec.js
   (Agent E will wire the trigger; write tests that can be enabled once wired)

5. Run Gate-A: npm run test:gate-a → must be 55/5/0.
   (New tests will be skipped until Agent E wires the trigger — that's expected)

ADR reference: docs/ADR-003-layer-picker-popup.md

ARCHITECTURE INVARIANTS:
  ✗ No type="module"
  ✗ Do NOT touch shell-overlays.js (Agent E wires)
  ✗ Do NOT touch selection.js (Agent E wires trigger)
  ✗ Do NOT touch tokens.css (Agent E wires @layer)
```

---

### Agent C Prompt

```
subagent_type: all-agents:javascript-developer
isolation: worktree

You are implementing v0.26.0 Precision Editing (nudge + snap + guides) for html-presentation-editor.

Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: main (baseline v0.24.0, Gate-A 55/5/0)
Architecture: 25 classic <script src> JS modules, NO type="module".
IMPORTANT: Read BOTH sides of the bridge before touching bridge-script.js.

YOUR TASK:

1. Read: editor/src/selection.js — handleActiveManipulationMove(), handleActiveManipulationEnd(),
   toStageRect(), toStageAxisValue(), DIRECT_MANIP_SNAP_PX, DIRECT_MANIP_NUDGE_PX,
   DIRECT_MANIP_NUDGE_FAST_PX (all defined in constants.js).
   Read: editor/src/bridge-script.js — understand message switch structure.
   Read: editor/src/constants.js — all DIRECT_MANIP_* constants.
   Read: docs/ADR-004-snap-nudge-system.md — full spec.

2. Create editor/src/precision.js:
   - computeSnapTargets(draggedRect, siblingRects) → {x: value|null, y: value|null}
   - applySnapToPosition(rawX, rawY, siblingRects) → {x, y, activeGuides}
   - renderSnapGuides(activeGuides) — creates/updates guide DOM elements
   - clearSnapGuides() — removes guide DOM elements
   - Expose on window for selection.js integration (Agent E wires, but precision.js must be ready)

3. Create editor/styles/precision.css:
   - .snap-guide { position: absolute; pointer-events: none; data-editor-ui: "true"; }
   - .snap-guide--h { height: 1px; width: 100%; border-top: 1px dashed var(--shell-accent); opacity: 0.4; }
   - .snap-guide--v { width: 1px; height: 100%; border-left: 1px dashed var(--shell-accent); opacity: 0.4; }

4. Edit editor/src/bridge-script.js — ADD ONLY:
   Add one new case at the END of the existing message switch statement:
     case 'get-sibling-rects': {
       // return bounding rects of all sibling elements in the active slide
       // excluding the currently selected node
       ...
       break;
     }
   DO NOT modify any other code in bridge-script.js.

5. Edit editor/src/selection.js — ADD ONLY in handleActiveManipulationMove():
   After dist calculation, before bridge nudge, call applySnapToPosition() if precision.js loaded.
   Use a guard: if (typeof applySnapToPosition === 'function') { ... }
   This keeps selection.js functional even without precision.js.

6. Create tests/playwright/specs/precision.spec.js

7. Run Gate-A: npm run test:gate-a → must be 55/5/0.

ADR reference: docs/ADR-004-snap-nudge-system.md

ARCHITECTURE INVARIANTS:
  ✗ No type="module"
  ✗ bridge-script.js: append-only, understand BOTH sides before editing
  ✗ selection.js: additive changes only, use typeof guard
  ✗ Do NOT touch tokens.css (Agent E handles)
  ✗ Do NOT touch feedback.js, onboarding.js, layer-picker.js
```

---

### Agent D Prompt

```
subagent_type: all-agents:accessibility-specialist
isolation: worktree

You are implementing v0.27.1 Accessibility Gate + v0.28.0 Visual Regression Gate
for html-presentation-editor.

Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: main (baseline v0.24.0, Gate-A 55/5/0)
NOTE: Run against main@v0.24.0 baseline. A11y/visual tests check the SHELL only,
not the presentation iframe content.

YOUR TASK:

1. Install devDependency:
   npm install --save-dev @axe-core/playwright
   (Only package.json devDependencies change — not runtime deps)

2. Create tests/a11y/shell-a11y.spec.js:
   - axe scan in 'empty' workflow state
   - axe scan in 'loaded-preview' state (load tests/fixtures/playwright/basic-deck.html)
   - axe scan in 'loaded-edit' state
   - Configure axe to scan shell ONLY: { include: ['body'], exclude: ['iframe'] }
   - Use { runOnly: ['wcag2a', 'wcag2aa'] }

3. Create tests/a11y/keyboard-nav.spec.js:
   - Tab from first focusable element through topbar
   - Shift+Tab cycles back
   - Escape closes transient surfaces (test with basic-deck.html loaded)

4. Create tests/a11y/contrast.spec.js:
   - Evaluate --shell-text / --shell-bg ratio (light theme)
   - Evaluate same tokens in dark theme
   - Assert ratio >= 4.5 for normal text, >= 3.0 for large text

5. Create tests/visual/shell-visual.spec.js:
   - Use page.toHaveScreenshot() with { maxDiffPixelRatio: 0.01 }
   - Capture: empty state (light + dark), loaded-preview (light + dark),
     loaded-edit element-selected (light + dark)

6. Edit playwright.config.js:
   Add project: { name: 'chromium-visual', use: { viewport: {width:1440,height:900}, colorScheme:'light' } }

7. Add to package.json scripts:
   "test:gate-a11y": "playwright test tests/a11y/",
   "test:gate-visual": "playwright test tests/visual/ --project=chromium-visual",
   "test:gate-visual:update": "playwright test tests/visual/ --project=chromium-visual --update-snapshots"

8. Generate initial snapshots: npm run test:gate-visual:update
   Commit the __snapshots__ directory.

9. Run Gate-A: npm run test:gate-a → must be 55/5/0 (a11y tests are separate gate, not Gate-A).

ADR references:
- docs/ADR-006-accessibility-ci-gate.md
- docs/ADR-007-visual-regression-ci-gate.md

ARCHITECTURE INVARIANTS:
  ✗ Do NOT touch any editor/src/ files
  ✗ Do NOT touch any editor/styles/ files
  ✗ package.json: devDependencies only, no runtime dependencies
```

---

## Pre-Flight for Each Agent

Before any agent starts implementing, it MUST:

```bash
# 1. Verify baseline
cd <repo>
git checkout main
npm run test:gate-a
# Expected: 55 passed / 5 skipped / 0 failed

# 2. Read source of truth
cat docs/SOURCE_OF_TRUTH.md
cat docs/ROADMAP_NEXT.md
cat docs/ADR-00X-<relevant>.md

# 3. Check architecture invariants
grep -n "type=\"module\"" editor/src/*.js  # Must return nothing
grep -n "@layer" editor/styles/tokens.css  # Must have declaration
```

## Launching All Agents (Claude Code)

```javascript
// Send as single message with all 4 tool calls in parallel:

Agent({ subagent_type: "all-agents:frontend-developer",   isolation: "worktree", prompt: "<Agent A Prompt>" })
Agent({ subagent_type: "all-agents:ui-ux-designer",       isolation: "worktree", prompt: "<Agent B Prompt>" })
Agent({ subagent_type: "all-agents:javascript-developer", isolation: "worktree", prompt: "<Agent C Prompt>" })
Agent({ subagent_type: "all-agents:accessibility-specialist", isolation: "worktree", prompt: "<Agent D Prompt>" })

// Wait for all 4 to complete, then:
Agent({ subagent_type: "all-agents:architect-review", prompt: "<Agent E integration prompt>" })
```

---

*Generated: 2026-04-20. Update when agent assignments change or files are added.*
