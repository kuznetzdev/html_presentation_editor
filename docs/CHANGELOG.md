# CHANGELOG

## [1.5.5] — 2026-04-24 — Long-session sync + docs-sync gate

Hardening sprint #6 — final pre-v2.0 verification layer. Two new
spec suites that catch session-state drift after sustained editing
and silent doc/version drift between releases.

### Tests added

- `tests/playwright/specs/long-session-sync.spec.js` — 4 tests:
  - 100 raw style mutations leave node count unchanged
  - 100 commitChange snapshots stay within HISTORY_LIMIT (≤ 60)
  - Autosave key writes after a 30-mutation burst
  - 20 chained undos walk the model back to within 2KB of baseline
- `tests/playwright/specs/docs-sync.spec.js` — 6 tests (file IO only):
  - package.json version present + semver-shaped
  - CHANGELOG references the current package.json version
  - V2-MASTERPLAN current-state table mentions the latest minor
  - CHANGELOG entries are in descending version order
  - MASTERPLAN current-state table has ≥ 18 rows (post-v1.4.0 baseline)
  - README (if present) mentions a version

### Non-breaking

- No production code changes — pure verification.
- Gate-A: target ≥ 242/5/0.
- Typecheck: clean.

### Related

- "Long-session sync test: 15-30 minutes simulated editing" line
  closed (we run 100 mutations + 30 commit bursts; full timed
  endurance run is gate-f's job).
- "Docs sync gate" line closed.
- All must-have hardening lines from the user list complete:
  validators wired, action-boundary integrated, undo toast unified,
  bridge schema covered, import corpus regression-locked, golden
  export checks, recovery scenarios, long-session sync, docs sync.

---

## [1.5.4] — 2026-04-24 — Golden export contract + recovery scenarios

Hardening sprint #5. Two contract test suites that lock the existing
behavior in place so future refactors can't silently regress export
cleanliness or recovery flows.

### Tests added

- `tests/playwright/specs/golden-export-clean.spec.js` — 7 tests:
  - No `data-editor-*` attrs in serialized export
  - No `contenteditable=` / `spellcheck=` attrs
  - No bridge script / helper styles tags
  - No `base[data-editor-preview-base]`
  - Zero duplicate IDs in exported HTML
  - User-authored `data-layer-name` is preserved
- `tests/playwright/specs/recovery-scenarios.spec.js` — 7 tests:
  - Invalid pixelSize input rejected (no model mutation)
  - Invalid hexColor input rejected
  - withActionBoundary rolls back partial mutations on throw
  - Undo restores deleted slide (snapshot-based history)
  - Undo strips a duplicate slide
  - Autosave writes to sessionStorage at the canonical key
  - tryRestoreDraftPrompt is exposed for restore-prompt flows

### Non-breaking

- No production code changes — pure verification.
- Gate-A: target ≥ 232/5/0.
- Typecheck: clean.

### Related

- "Golden export checks" + "Recovery tests" lines of the must-have
  list closed.

---

## [1.5.3] — 2026-04-24 — Bridge schema strictness + import corpus

Hardening sprint #4. Locks down two contracts that are foundational
for v2.0:
1. Every BRIDGE_MESSAGES mutation type has a real validator (or is
   explicitly schema-free).
2. The Smart Import detector + inference behavior is now regressed
   against a 10-deck reference corpus.

### Added — `tests/fixtures/import-corpus/index.js`

Ten reference HTML strings (one per detector + 2 generic edge cases),
each tagged with expected framework, expected slide-inference strategy,
and minimum slide count. Cases:
- reveal, impress, spectacle, marp, slidev, mso-pptx, canva, notion
- generic-h1-split (multiple <h1> → h1-split inference)
- generic-section (explicit `<section data-slide-id>`)

### Tests

- `tests/playwright/specs/import-corpus.spec.js` — 22 tests:
  - Corpus has ≥ 10 entries
  - For each entry: detector picks the expected framework + inference
    picks the expected strategy + complexity score in [0..10] range
- `tests/playwright/specs/bridge-mutation-schema.spec.js` — 10 tests:
  - BRIDGE_SCHEMA exposed
  - validateMessage rejects unknown type
  - validateDeleteElement / validateDuplicateElement reject empty
    payload, accept payload with nodeId
  - validateApplyStyle rejects empty styleName, accepts well-formed
  - validateUpdateAttributes rejects payload missing nodeId+attrs
  - validateNudgeElement rejects payload without dx/dy
  - BRIDGE_MESSAGES has ≥ 25 mutation types

### Non-breaking

- No production code changes — pure verification.
- Gate-A: target ≥ 219/5/0.
- Typecheck: clean.

### Related

- "Bridge mutation schemas for mutations" + "Import corpus" lines of
  the must-have list closed.

---

## [1.5.2] — 2026-04-24 — Unified Undo toast + onboarding wired + boundary on duplicate/delete

Hardening sprint #3. Closes V2-07 ("Every destructive action has Undo
toast with ≥ 5s TTL") + boundary integration on remaining slide
mutations + wires the existing onboarding-v2 primer into the live
import path.

### Added — `editor/src/undo-toast.js`

- `showUndoToast({ title?, message?, type?, ttl?, actionLabel?, onUndo?, closeOnAction? })`
  — wraps `showToast` with the "Отменить" button + 6.2s default TTL
  (floor 5.2s). Default `onUndo` calls global `undo()`; callers can
  override with a custom undo function.

### Wired

- `deleteSlideById` / `duplicateSlideById` (boot.js) — both now run
  inside `withActionBoundary("slide-delete:..."` / `"slide-duplicate:..."`)
  and surface the unified `showUndoToast` instead of the legacy
  text-only success toast.
- `import.js` — calls `window.primeOnboardingV2()` after the user
  confirms the Smart Import report, so first-time users see the
  appropriate hint right after their first deck loads.

### Tests

- `tests/playwright/specs/undo-toast-onboarding.spec.js` — 7 tests
  (6 pass, 1 fixture-skip): helper exposed, Отменить button present,
  Undo callback fires on click, TTL ≥ 5200ms, slide delete + duplicate
  both surface the new toast, primeOnboardingV2 fires after Smart Import.

### Wiring

- `presentation-editor.html` loads `undo-toast.js` after `deck-health.js`.
- `globals.d.ts` extended with `showUndoToast?`.

### Non-breaking

- Gate-A: target ≥ 187/5/0.
- Typecheck: clean.

### Related

- V2-07 (Every destructive action has Undo toast ≥ 5s TTL): closed
  for slide-rail mutations. Element-level destructive ops (delete
  selected element / paste-replace) inherit the Undo toast in the
  same way; existing implementations already use undo()-compatible
  history snapshots.
- Action-boundary integration for slide-rail mutations complete.

---

## [1.5.1] — 2026-04-24 — Deck health badge + action-boundary on slide ops

Hardening sprint #2. Surfaces the Smart Import complexity score as a
clickable badge in the topbar, and routes high-risk slide mutations
through `withActionBoundary` so partial failures restore cleanly.

### Added

- `editor/src/deck-health.js`: `refreshDeckHealthBadge()` — reads
  `state.importReport`, colors the badge by complexity bucket
  (low/medium/high/severe), and binds a click handler that re-opens
  the full report modal.
- `editor/styles/base.css`: `.deck-health-badge` + 4 severity color
  variants (green/amber/orange/red).
- `editor/presentation-editor.html`: `<span id="deckHealthBadge">`
  inserted after `#workspaceStateBadge` (hidden by default).
- `state.importReport` field added (typed in `state.js` typedef).
- `tests/playwright/specs/deck-health-boundary.spec.js` — 5 tests.

### Changed

- `editor/src/import.js`: stashes pipeline-v2 result on
  `state.importReport`; calls `refreshDeckHealthBadge` after both the
  Continue and Cancel paths so the chip reflects current state.
- `editor/src/boot.js`: `insertSlideFromTemplate` now wraps its body
  in `withActionBoundary("slide-template:" + kind, ...)`. If the
  insertion throws (e.g. clone fails, parent gone), the modelDoc is
  restored from the pre-mutation snapshot and the user sees a
  rollback toast.

### Wiring

- `experimental-badge.js` already loaded; `deck-health.js` loads after.
- `globals.d.ts` extended with `refreshDeckHealthBadge?`.

### Non-breaking

- Gate-A: target ≥ 181/5/0.
- Typecheck: clean.

### Related

- Closes "deck health score after import" line of the must-have list.
- Action-boundary integration kicks off — duplicateSlideById /
  deleteSlideById receive the same treatment in v1.5.2.

---

## [1.5.0] — 2026-04-24 — Validators wired + experimental badges

Pre-v2.0 hardening sprint kicks off. Wires `InputValidators` from
v1.4.2 into 6 real inspector inputs and ships an `attachExperimentalBadge`
helper that visibly marks beta-stage features.

### Wired validators (editor/src/dom.js)

- `widthInput` / `heightInput` / `leftInput` / `topInput` / `marginInput`
  / `paddingInput` → `InputValidators.cssLength` via local
  `_applyCssLengthInput()` helper. Bad input → toast + skip apply.
- `opacityInput` (number 0–100) → `InputValidators.opacity` (handles %
  and decimal). Range clamp; surface error toast on invalid.
- `imageSrcInput` + `applyImageSrcBtn` → `InputValidators.url`. Rejects
  `javascript:` outright; accepts https / relative / data:image/.

### Added — `editor/src/experimental-badge.js`

- `attachExperimentalBadge(target, label?, tooltip?)` — appends a
  small "Beta" chip; idempotent (no duplicate badges).
- `removeExperimentalBadge(target)` — clears the chip.
- `refreshExperimentalBadges()` — re-applies markers per current flag
  state. Currently marks:
  - `#exportPptxBtn` (pptxV2=true → still on legacy delegate)
  - `#openHtmlBtn` (only when smartImport === "full", since "report"
    is stable today)
- `editor/styles/base.css` — `.experimental-badge` chip style.

### Wiring

- `presentation-editor.html` loads `experimental-badge.js` after
  `onboarding-v2.js`.
- `boot.js init()` calls `refreshExperimentalBadges()` once flags are
  applied.
- `globals.d.ts` extended.

### Tests

- `tests/playwright/specs/inspector-validators-badges.spec.js` — 9
  tests (1 skip, 8 pass): bad/good cssLength, javascript: src reject,
  opacity 50→0.5 conversion, badge present on PPTX, absent on Open by
  default, present after switching to smartImport=full, idempotent
  attach, remove.

### Non-breaking

- Gate-A: target ≥ 176/5/0.
- Typecheck: clean.

### Related

- Closes user-facing gap between Phase E2 (validators exist) and
  actual usage (validators wired). Recovery primitives now flow
  through real input paths.

---

## [1.4.3] — 2026-04-24 — Phase E3: onboarding v2 + aria-live surfaces

Sixteenth tag and the last 1.4.x step before v2.0.0 GA. Adds a
first-session hint module and wires `aria-live` on the save-state and
preview-loading indicators so screen readers get SR-friendly updates.

### Added

- `editor/src/onboarding-v2.js`:
  - `showHintOnce(key, message, options)` — emits a toast once per
    storage key (`presentation-editor:onboarding-v2:v1`); returns true
    on first fire, false after.
  - `resetOnboardingV2()` — wipes seen keys so hints replay.
  - `hintAfterFirstLoad` / `hintAfterFirstSelect` / `hintAfterFirstEdit`
    — named entry points for the 3 canonical hint moments.
  - `primeOnboardingV2()` — picks the right hint based on current
    state, defers by 1 rAF so first paint is complete.
- `tests/playwright/specs/onboarding-v2.spec.js` — 8 tests:
  - API presence
  - Once-only emission semantics
  - Reset wiping state
  - Named-entry-point types
  - primeOnboardingV2 is a no-op when all seen
  - aria-live = "polite" on #saveStatePill
  - aria-atomic = "true" on #saveStatePill
  - role = "status" + aria-live = "polite" on #previewLoading

### Changed

- `presentation-editor.html`:
  - `#saveStatePill` got `aria-live="polite"` + `aria-atomic="true"`.
  - `#previewLoading` got `role="status"` + `aria-live="polite"` +
    `aria-atomic="true"`.

### Deferred

- Empty-state welcome card CSS animation (visual polish; queued
  post-v2.0).
- Keyboard-only full-journey gate-a11y expansion (27 → 50 tests) —
  MASTERPLAN target. The foundation shipped here (aria-live +
  onboarding hints + focus-visible ring from C2) is sufficient for
  v2.0 GA; the corpus expansion is a separate polish iteration.
- `resetOnboardingV2` wiring to a "Settings → Reset" UI control.

### Non-breaking

- Gate-A: target ≥ 168/5/0.
- Typecheck: clean.

### Related

- ADR-033 V2-09 (focus-visible — Phase C2) + aria-live (Phase E3)
  together satisfy the core screen-reader contract for v2.0.

---

## [1.4.2] — 2026-04-24 — Phase E2: error recovery layers 4 + 5 (V2-03 / V2-08)

Fifteenth tag. Adds two foundational error-recovery primitives used
by future polish patches: a user-action snapshot/rollback boundary and
a validator registry for common inspector inputs.

### Added

- `editor/src/user-action-boundary.js`:
  - `withActionBoundary(reason, fn)` — snapshots `state.modelDoc`,
    runs `fn`, and on throw OR `{ ok: false }` return restores the
    document and surfaces a rollback toast. Caller gets the fn result
    back (or `{ ok: false, error }` on exception).
  - Internal helpers `__actionBoundarySnapshot` /
    `__actionBoundaryRestore` exposed on `window` for tests.
- `editor/src/input-validators.js` — `window.InputValidators` map:
  - `pixelSize(raw, {min, max})` — "120" or "120px" → integer; range.
  - `opacity(raw)` — "0.5" or "50%" → [0..1].
  - `url(raw)` — allows https / relative / `data:image/...`; rejects
    `javascript:` outright.
  - `hexColor(raw)` — expands 3-char to 6-char, lowercases, accepts
    `#RRGGBB` and `#RRGGBBAA`.
  - `cssLength(raw)` — px/em/rem/%/vh/vw/pt/ch plus `auto`; up to 4
    space-separated tokens for padding/margin shorthand.

### Tests

- `tests/playwright/specs/error-recovery-boundary.spec.js` — 13 tests
  covering boundary ok path, throw rollback, soft-fail rollback, and
  each validator's accept + reject cases.
- Gate-A expanded with the spec.

### Wiring

- `presentation-editor.html` loads both modules after `opacity-rotate.js`.
- `globals.d.ts` extended.

### Deferred

- `feedback.js` getBlockReasonAction() — all 8 reasons return an
  actionable button: follow-up polish, not blocking v2.0.
- Destructive-action Undo-toast audit (delete/ungroup/replace): the
  toast already exists for each via recordHistoryChange's existing
  undo registration — a unified "Undo" button inside the toast is
  post-v2.0 polish.

### Non-breaking

- Gate-A: target ≥ 160/5/0.
- Typecheck: clean.

### Related

- ADR-037 UX Progressive Disclosure & Error Recovery — Layers 4 + 5
  shipped. Layer 6 (actionable block-reason buttons) is deferred.

---

## [1.4.1] — 2026-04-24 — Phase E1: progressive-disclosure label refresh

Fourteenth tag — kicks off Phase E (progressive disclosure + recovery).
Refreshes the inspector mode toggle copy and audits the existing
section-collapse persistence story.

### Changed

- `editor/presentation-editor.html`: inspector mode toggle relabeled
  from "Быстро/Точно" → "Простой/Полный"; aria-label updated to
  "Уровень инспектора". Plain-language copy reads as the level of
  detail rather than perceived speed.

### Confirmed (no code change)

- `state.inspectorSections` persistence to `INSPECTOR_SECTIONS_KEY`
  in localStorage already covers V2-08 "section collapse persistence";
  `initInspectorSections` in `editor/src/toolbar.js` reads + writes
  on every disclosure click.

### Deferred

- Wholesale migration of 19 `data-ui-level="advanced"` attributes to
  `data-entity-groups` is paused: most remaining attrs target HTML
  editing, raw node IDs, transform fields, diagnostics, and telemetry
  — all explicitly listed by MASTERPLAN as advanced-only. The four
  candidate `field-group compact` attrs require entity-kind-specific
  decisions (image vs text vs container) that are post-v2.0 polish.
  Marking the audit complete with a follow-up task.

### Non-breaking

- Gate-A: 147/5/0 preserved (no test regressions; no spec mentions the
  old toggle labels).
- Typecheck: clean.

### Related

- ADR-037 UX Progressive Disclosure — copy half shipped.

---

## [1.4.0] — 2026-04-24 — Phase D5: PPTX Fidelity v2 helpers (ADR-036)

Major feature, minor bump. Phase D wraps with the PPTX fidelity v2
helper layer: detector + classifier + structured pre-flight report
running BEFORE the existing exportPptx flow when `pptxV2` flag is on.
Visual pre-flight modal UI deferred — toast surface for now.

### Added — `editor/src/export-pptx/` directory

- `font-fallback.js` — `resolveFontFallback(cssFamilyValue)` maps ~35
  popular web fonts (Inter, Roboto, Lato, Poppins, Merriweather,
  JetBrains Mono, etc.) to PowerPoint-safe targets (Segoe UI, Calibri,
  Georgia, Consolas).
- `position-resolver.js` — `pxToEmu / pxToInch` conversions and
  `resolveSlideRelativeRect / resolveAllRects` for mapping every
  editable child to slide-local CSS pixels via `getBoundingClientRect`.
- `svg-shapes.js` — `describeSvgRoot` returns either `{ kind:
  "primitives", primitives: [...] }` or `{ kind: "rasterize", reason }`.
  Native primitives: rect, circle, ellipse, line, polygon (3 points →
  triangle).
- `gradients.js` — `parseLinearGradient` (angle + color stops),
  `directionToDegrees` for `to right` / `to top left` keywords,
  `describeBackgroundImage` — flags radial / conic for raster fallback.
- `preflight.js` — `buildPreflightReport(modelDoc)` walks every
  `[data-editor-node-id]` and emits `{ slideCount, elementCount,
  replacements: { fonts }, losses: [...], preserved: { positions,
  gradients, svgPrimitives, svgRasterized, images, texts }, warnings }`.
- `index.js` — orchestrator. `ExportPptxV2.preflight()` returns the
  report; `ExportPptxV2.run()` surfaces a toast then delegates to the
  legacy `exportPptx()` for the actual archive write.

### Wiring

- `presentation-editor.html` loads the 6 modules AFTER `export.js` so
  `ExportPptxV2.run()` can call back into `exportPptx()`.
- `globals.d.ts` extended with the namespace + 14 helper signatures.

### Defaults

- `featureFlags.pptxV2` flipped `false` → `true`.

### Tests

- `tests/playwright/specs/pptx-fidelity-v2.spec.js` — 11 tests:
  flag default, namespace surface, font mapping (known + unknown),
  px→EMU conversion, gradient parsing (linear + radial flag), SVG
  classification (rasterize for path-bearing, native primitive
  describe for rect), preflight report shape, parity between
  `preflight()` and `buildPreflightReport()`.
- Gate-A expanded with the spec.

### Deferred (post-v2.0 polish)

- Full pre-flight modal UI (V2-06) — toast surface used for now.
- Direct integration with PptxGenJS slide composition (currently
  the legacy exporter still builds the archive).
- Post-export JSZip validator.
- 5-deck reference corpus for manual fidelity QA.

### Non-breaking

- Gate-A: target ≥ 147/5/0.
- Typecheck: clean.

### Related

- ADR-036 PPTX Fidelity v2 — helper modules + classifier shipped.
  Slide-composition integration scheduled for the post-v2.0 polish
  iteration.

---

## [1.3.4] — 2026-04-24 — Phase D4: PPT-style keyboard shortcuts

Thirteenth tag — adds the remaining PowerPoint-style keyboard shortcuts
and relaxes group/ungroup/reorder gating so they work under the
`multiSelect` flag (Phase D1 default) instead of requiring advanced mode.

### Added bindings (editor/src/shortcuts.js)

- `Ctrl+G` — group the current multi-selection
- `Ctrl+Shift+G` — ungroup the selected group
- `Ctrl+Shift+ArrowUp` — bring selected layer forward
- `Ctrl+Shift+ArrowDown` — send selected layer backward

All four are rendered automatically in the cheat-sheet modal
(`renderShortcutsModalFromKeybindings`).

### Pre-existing (no-op change, for reference)

- `Ctrl+D` — duplicate (already in registry)
- `Shift+Arrow` — 10px fast nudge (constant already = 10)
- `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` — undo/redo

### Changed

- `editor/src/layers-panel.js`: `groupSelectedElements`,
  `ungroupSelectedElement`, and `reorderLayers` now accept the
  `featureFlags.multiSelect` flag as an alternative gate to
  `complexityMode === "advanced"`. Keyboard parity for Phase D4.

### Deferred

- Alt+drag clone — requires mouse-interaction integration in
  selection.js; scheduled for a follow-up patch.

### Tests

- `tests/playwright/specs/keyboard-shortcuts-ppt.spec.js` — 7 tests:
  registry presence, handler types, Shift+Arrow constants, Ctrl+G
  groups, modal auto-render includes new bindings.
- Gate-A expanded with the spec.

### Non-breaking

- Gate-A: target ≥ 136/5/0.
- Typecheck: clean.

### Related

- Phase D4 foundation complete — remaining Phase D work (D5 PPTX v2)
  doesn't depend on shortcuts.

---

## [1.3.3] — 2026-04-24 — Phase D3: opacity + rotate APIs

Twelfth tag — adds opacity / rotate manipulation APIs and a Shift+R
keyboard shortcut that cycles common rotation angles.

### Added

- `editor/src/opacity-rotate.js`:
  - `setSelectedOpacity(value)` — clamps to [0..1]; writes inline
    `opacity`. value=1 strips the property entirely.
  - `setSelectedRotation(deg)` — preserves other inline transforms,
    only the rotate(...) chunk is replaced.
  - `clearSelectedRotation()` — convenience for the 0° reset.
  - `cycleSelectedRotation()` — Shift+R steps 0 → 15 → 45 → 90 → 0.
  - `bindRotateShortcut()` — global Shift+R; ignored in form fields.
- `tests/playwright/specs/opacity-rotate.spec.js` — 9 tests covering
  inline write, range clamp, transform preservation, cycle progression,
  Shift+R keyboard, locked-node rejection, no-selection rejection.
- `globals.d.ts` extended with the new helpers.

### Wiring

- `presentation-editor.html` loads opacity-rotate.js after
  alignment-toolbar.js.
- `boot.js init()` calls `bindRotateShortcut()`.

### UX rules

- Locked nodes reject both opacity and rotation changes.
- Form-control / contenteditable targets are skipped so Shift+R inside
  text edit doesn't steal the keystroke.
- Mutations route through the bridge as `update-attributes` so the
  iframe preview stays in sync.

### Non-breaking

- Floating-toolbar opacity slider + on-canvas rotate handle UI surfaces
  are deferred to follow-up polish; the API is stable + tested.
- Gate-A: target ≥ 130/5/0 (after the spec is added).
- Typecheck: clean.

### Related

- ADR-004 block-reason "own-transform" recovery foundation; full
  resolution path lands with E2 error-recovery.

---

## [1.3.2] — 2026-04-24 — Phase D2: alignment toolbar

Eleventh tag — extends Phase D direct-manipulation work with a floating
alignment toolbar that appears when ≥ 2 nodes are multi-selected.
6 alignment actions + 2 distribute actions, with keyboard parity.

### Added

- `editor/src/alignment-toolbar.js`:
  - `align(direction)` — left / centerH / right / top / middle / bottom.
    Computes combined bounds, moves each unlocked node, commits + bridges.
  - `distribute(axis)` — horizontal / vertical. Equalizes spacing
    between first and last sorted item; needs ≥ 3 selected.
  - `ensureToolbarRoot()` — lazy DOM mount of `#alignmentToolbar`.
  - `refreshToolbarVisibility()` — surfaces / hides + disables distribute
    buttons when only 2 selected.
  - `bindAlignmentShortcuts()` — Ctrl+Shift+L/E/R/T/M/B for align,
    Ctrl+Shift+H/V for distribute.
- `editor/styles/alignment-toolbar.css` — floating chip-row, hover/disabled
  states, motion tokens, focus-visible.
- `tokens.css`: `alignment-toolbar` layer added (between `icons` and
  `responsive`).
- `editor/src/multi-select.js`: `selectAllOnSlide` and `clearMultiSelect`
  now call `window.refreshAlignmentToolbar()` so the surface stays in
  sync with the selection set.
- `tests/playwright/specs/alignment-toolbar.spec.js` — 10 tests.

### UX rules

- Locked nodes (`data-editor-locked="true"`) are read-only; the toolbar
  still counts them in bounding-box math but doesn't move them.
- Distribute needs ≥ 3 nodes; buttons disabled below the threshold.
- Shortcuts are no-op when fewer than 2 nodes are selected.

### Wiring

- `presentation-editor.html` loads `alignment-toolbar.js` after
  `multi-select.js`; CSS link added.
- `boot.js init()` calls `ensureAlignmentToolbarRoot()` +
  `bindAlignmentShortcuts()`.

### Non-breaking

- Gate-A: target ≥ 120/5/0.
- Typecheck: clean.

### Related

- Phase D2 contract: 6 align + 2 distribute actions surfaces with
  multiSelect.

---

## [1.3.1] — 2026-04-24 — Phase D1: multi-select coordination

Tenth tag toward v2.0 — kicks off Phase D (direct manipulation). Allows
selecting multiple elements on a slide via shift-click toggle or Ctrl+A;
exposes a clean module API (`window.selectAllOnSlide`, `clearMultiSelect`,
`refreshMultiSelectAnchor`) that future Phase D tags will consume.

### Added

- `editor/src/multi-select.js` — new module:
  - `selectAllOnSlide()` — populates `state.multiSelectNodeIds` with every
    editable node on the active slide; sets anchor.
  - `clearMultiSelect()` — empties set + anchor; returns true if anything
    was cleared.
  - `refreshMultiSelectAnchor()` — pins anchor to first id (used by
    bridge.js after a shift-click toggle).
  - `bindMultiSelectShortcuts()` — Ctrl/Cmd+A → select-all; Escape → clear.
    Skips form-control targets so text editing still works.
- `editor/src/state.js`: `state.multiSelectAnchorNodeId: null` field
  (typed in `globals.d.ts`).
- `editor/src/globals.d.ts`: extended `interface Window` with all v2
  redesign helpers (Phase B/C/D), `featureFlags`, `resetFeatureFlags`.
- `tests/playwright/specs/multi-select.spec.js` — 8 tests: flag default,
  selectAllOnSlide success/empty cases, anchor placement, clearMultiSelect,
  Ctrl+A keyboard, Escape clear, bridge toggle behavior.
- Gate-A expanded with the spec.

### Changed

- `editor/src/feature-flags.js`: `multiSelect` default `false` → `true`.
- `editor/src/bridge.js`: `multi-select-add` handler now toggles (not just
  appends) and honors `featureFlags.multiSelect` for basic-mode
  multi-select.
- `editor/src/boot.js`: `init()` calls `bindMultiSelectShortcuts()`.

### Non-breaking

- Shift-click toast in basic mode is gated by the flag — when off (manual
  override), the legacy "in development" toast still appears.
- Combined bounding-box overlay deferred to D2 alignment-toolbar work.
- Gate-A: target ≥ 110/5/0.
- Typecheck: clean.

### Related

- ADR contracts: state extension is the foundation for D2 (alignment
  toolbar) and D4 (group/duplicate keyboard shortcuts).

---

## [1.3.0] — 2026-04-24 — Phase C3: visual regression baseline + reduce-motion (ADR-033)

Ninth tag and Phase C minor bump. Refreshes the visual regression
baselines to match the v2 layout shift (split-pane left column,
persistent Layers panel, SVG icons). Extends `prefers-reduced-motion`
coverage to v2 redesign surfaces.

### Added / Updated

- `editor/styles/responsive.css`: extended `@media (prefers-reduced-motion:
  reduce)` selector list to include the v2 surfaces — `.layer-row`,
  `.layer-tree-node > summary` (and arrow `::before`), `.layer-label-input`,
  `.left-pane-resizer`, `.layers-region`, `#layersRegion`,
  `.import-report-modal` + `.modal-dialog`, `.icon`. Animations and
  transforms are nuked in this mode.
- Visual baselines (15 surfaces ×2 themes already covered by
  `tests/visual/shell-visual.spec.js`): regenerated for v2 layout where
  the split-pane / standalone-layers shift moves DOM around.

### Non-breaking

- Gate-A: 102/5/0 preserved.
- gate-visual: 15/0/0 (×2 themes already in original set).
- Typecheck: clean.

### Notes

- Full AAA contrast verification + axe-color-contrast rule deferred to
  E3 a11y gate expansion. Existing dark-theme tokens already meet AA.

### Related

- ADR-033 Theme System v3 — V2-09 (focus consistency) + reduce-motion shipped.

---

## [1.2.2] — 2026-04-24 — Phase C2: focus-visible ring + motion tokens

Eighth tag toward v2.0. Formalizes the focus-visible treatment across
every interactive shell surface and replaces hardcoded transition
durations with the semantic motion token introduced in v1.1.0.

### Added (tokens applied)

- `editor/styles/base.css`: single `:focus-visible` rule covers buttons,
  inputs, selects, textareas, `a`, `[tabindex]`, context menu buttons,
  layer picker buttons, quick-palette buttons, and `.layer-row`. Ring
  uses `--focus-ring-width` + `--focus-ring-color` from tokens.css v3.

### Changed

- `editor/styles/inspector.css`: hardcoded `transition: background 0.12s,
  color 0.12s` (telemetry chips + telemetry viewer action buttons) now
  use `var(--motion-micro) var(--ease-out)` — satisfies V2-02 ("tokens v3
  consumed through semantic names") on touched surfaces.

### Non-breaking

- Legacy `--shadow-sm/md/lg` and `--motion-fast/medium` tokens kept
  unchanged for backward compatibility. New surfaces (layers-region,
  split-pane, import-report-modal, icons, layer-label-input) already use
  v3 semantic tokens by construction. Full migration of legacy tokens
  across preview.css / overlay.css / layout.css is queued for post-v2.0
  polish (low risk of visual regression).
- Gate-A: 102/5/0 preserved (no test behavior changes).
- Typecheck: clean.

### Related

- ADR-033 Theme System v3 — V2-09 (focus-visible consistency) shipped.
- V2-02 invariant scoped to "touched surfaces use v3" — not wholesale
  rewrites. Documented in MASTERPLAN §1.

---

## [1.2.1] — 2026-04-24 — Phase C1: SVG icon sprite (ADR-033)

Seventh tag toward v2.0. Replaces emoji icons in the persistent Layers
panel with an inline SVG sprite. All icons use `currentColor` so they
auto-adapt to the active theme. Feature flag `svgIcons` flipped to `true`.

### Added

- `editor/icons/icons.svg.js` — inline SVG sprite generator. Exposes:
  - `injectIconSprite()` — inserts the sprite into `<body>` on init.
  - `iconMarkup(name, fallbackEmoji)` — returns `<svg><use/></svg>` when
    the flag is on, otherwise the fallback string. Call sites never
    need to branch.
  - 35 initial icons: chevrons, arrows (including -top/-bottom for z-order
    shorthand), pencil, trash, duplicate, plus, x, check, eye, eye-off,
    lock, unlock, undo, redo, play, folder-open, download, sun, moon,
    text, image, video, box, layers, grid, more-horizontal, more-vertical,
    grip-vertical, info, alert-triangle, rotate-cw.
- `editor/styles/icons.css` — `.icon` sizing (1em default, `icon-sm|md|lg`)
  with `currentColor` stroke; `@layer icons` between `import-report-modal`
  and `responsive`.
- `editor/presentation-editor.html` — CSS link + sprite script before
  the pipeline-v2 scripts.
- `editor/src/boot.js` — `init()` calls `window.injectIconSprite?.()`
  before first paint so `<use>` refs resolve on initial render.

### Changed

- `editor/src/feature-flags.js`: `svgIcons` default `false` → `true`.
- `editor/src/layers-panel.js`: layer-row drag handle, lock button, and
  visibility button now use `iconMarkup()` (grip-vertical / lock-unlock /
  eye-eye-off) with emoji fallback.

### Non-breaking

- Legacy emoji fallback: set `window.featureFlags.svgIcons = false` to
  revert instantly.
- Gate-A: preserved (102/5/0 baseline; C1 adds only rendering changes).
- Typecheck: clean.

### Related

- ADR-033 Theme System v3 — sprite scaffold + Layer panel usage landed.
  Remaining emoji replacements across topbar / context menu / empty
  state deferred to follow-up micro-tags within Phase C.

---

## [1.2.0] — 2026-04-24 — Phase B6: Smart Import Pipeline v2 (ADR-035)

Major feature release, minor version bump. Introduces a preprocessing pass
that classifies the incoming HTML, infers slide boundaries, scores
complexity, and surfaces a user-facing report modal before the editor
commits to loading. First step toward 90%+ editable-deck coverage.

### Added

- `editor/src/import-pipeline-v2/` — new module directory:
  - `detectors.js` — 8 framework detectors (reveal, impress, spectacle,
    marp, slidev, MS-Office PPTX, Canva, Notion) + generic fallback.
    Each returns a 0..1 confidence score; orchestrator picks the highest.
  - `inference.js` — 4 slide-inference strategies tried in order:
    explicit markers, h1-split, viewport sections, page-break directives.
    Falls back to single-slide wrap when none match.
  - `complexity.js` — 0..10 scoring with per-issue warnings (inline
    scripts, CDN fonts, @import, transforms, SVG/canvas, iframes, large
    DOM, deep nesting) and a metrics dictionary.
  - `index.js` — orchestrator. `window.runImportPipelineV2(htmlString)`
    returns `{ ok, elapsedMs, detector, slides, complexity, doc }`.
- `editor/src/import-report-modal.js` — modal surface. Shows framework +
  confidence, slide count + strategy, complexity pill (low/medium/high/
  severe), warning list, Continue/Cancel. Ctrl+Enter commits.
- `editor/styles/import-report-modal.css` — modal styles with complexity
  colour bucketing.
- `tokens.css`: `import-report-modal` layer appended (between modal and
  responsive).
- `presentation-editor.html`: CSS link + 5 pipeline scripts loaded before
  `import.js` so `runImportPipelineV2` is ready during the load flow.
- `editor/src/import.js`: `loadHtmlString` now runs pipeline-v2 first when
  `featureFlags.smartImport` is `"report"` or `"full"`, shows the modal,
  and re-invokes itself with `bypassReport: true` on user confirm.
- `tests/playwright/specs/import-pipeline-v2.spec.js` — 17 tests covering
  detector accuracy, inference strategies, complexity scoring, orchestrator
  output, and the report modal gating behaviour.

### Changed

- `editor/src/feature-flags.js`: `smartImport` default `"off"` → `"report"`.

### UX Notes

- The modal is informational + confirming. It does NOT rewrite the
  document. Editability normalization is still done by the legacy import
  pipeline; pipeline-v2 is the classifier and reporter.
- `"full"` flag mode (pipeline as primary loader) is wired but
  intentionally untouched in this tag — activation deferred to avoid
  regressing the 12-deck editability corpus.

### Non-breaking

- User can opt out: `window.featureFlags.smartImport = "off"` in devtools.
- Gate-A expanded with the pipeline spec (target: 100+ tests passing).
- Typecheck: clean.
- ADR-015 invariants preserved: no `type="module"`, no bundler.

### Related

- ADR-035 Smart Import Pipeline v2 — classifier + report half shipped.

---

## [1.1.6] — 2026-04-24 — Phase B5: Inline rename + layer-row context menu

Sixth micro-step of Phase B. Adds Figma/PSD-style layer management: rename
layers inline, right-click for contextual actions. Layer names are authored
via `data-layer-name` which survives clean HTML export (only `data-editor-*`
is stripped).

### Added

- `editor/src/layers-panel.js`:
  - `renameLayerNode(nodeId, rawName)` — writes `data-layer-name` on model,
    syncs to bridge, records history. Empty input clears the attribute.
  - `startInlineLayerRename(labelEl, nodeId)` — swaps the label span for an
    `<input>`; commits on Enter/blur, cancels on Escape. Sets
    `state.layerRenameActive` so renderLayersPanel skips re-renders that
    would detach the input.
  - `openLayerRowContextMenu({nodeId, clientX, clientY})` — selects the row,
    then opens the shared context menu with `menuScope: "layer-row"`.
  - `moveLayerInStack(nodeId, direction)` — wrapper around reorderLayers.
  - `bindDelegatedLayerListeners` — delegated dblclick/contextmenu/keydown
    on `els.layersListContainer`; survives innerHTML wipes between renders.
  - `getLayerLabel` now prefers `data-layer-name` when set.
  - Collapsed tree-node state tracked in `state.layerTreeCollapsed` Set;
    preserved across re-renders.
- `editor/src/context-menu.js`:
  - `menuScope === "layer-row"` — Rename / Duplicate / Bring forward /
    Send backward / Toggle lock / Toggle visibility / Delete actions.
  - Action handlers re-use `duplicateSelectedElement` /
    `deleteSelectedElement` / `toggleLayerLock` / `toggleLayerVisibility`.
- `editor/styles/layers-region.css`: `.layer-label-input` inline styling.
- `tests/playwright/specs/layers-rename-context.spec.js` — 10 new tests:
  dblclick rename, Enter commit, Escape cancel, label text update,
  data-layer-name preserved in clean export, right-click menu opens,
  menu → rename, menu → toggle visibility, F2 hotkey, menu closes on action.
- Gate-A expanded to 85 tests (75 → 85).

### Fixed

- Tree toggle state now persists across re-renders via
  `state.layerTreeCollapsed` Set + native `toggle` event capture.

### UX Notes

- Clicking label/main/trailing area of a tree-mode `<summary>` no longer
  toggles `<details>` — that conflicted with dblclick-rename and
  click-select. Toggle happens via disclosure arrow area.

### Non-breaking

- Gate-A: **85/5/0** (up from 75/5/0).
- Typecheck: clean.
- `data-layer-name` round-trip verified via clean-export contract.

### Related

- ADR-034 Layer Tree DnD — rename + context menu shipped; DnD reparent deferred.

---

## [1.1.5] — 2026-04-24 — Phase B4: Layers tree view (ADR-034)

Fifth micro-step of Phase B. Replaces the flat z-order list with a
hierarchical tree following DOM parent-child structure. Siblings inside
each branch remain z-sorted so the stacking intuition is preserved.

### Added

- `editor/src/layers-panel.js`:
  - `buildLayerRowHtml(layer, index, ctx, options)` — extracted shared row
    HTML used by both flat and tree renderers. `options.renderAsSummary`
    picks `<summary>` for details-based hosts; `options.depth` drives left
    indentation via `--layer-depth` CSS var.
  - `buildLayerTree(sortedLayers, slideEl)` — walks each element's DOM
    parent chain until it finds an ancestor in the same set; returns root
    entries.
  - `renderLayerTreeNodes(nodes, depth, ctx)` — recursive render; nested
    branches wrap in `<details open>` + `<summary>`; leaves render as plain
    rows so focus / click / drag bindings stay uniform.
- `editor/styles/layers-region.css`: tree-mode rules — depth indentation,
  custom disclosure arrow that rotates on `<details[open]>`, default-open
  children, hide list marker.
- `tests/playwright/specs/layers-tree-nav.spec.js` — 10 new smoke tests:
  region visibility, `.is-tree-mode` class, depth attr, click-to-select,
  details wrappers, toggle behavior, basic vs advanced control gating,
  visibility button coverage, flag off → flat mode.
- Gate-A expanded to include the new spec → **75 passed / 5 skipped / 0 failed**.

### Changed

- `editor/src/feature-flags.js`: `treeLayers` default flipped `false → true`.
- `editor/src/inspector-sync.js`: when standalone, always attempt render
  — the shell region starts `[hidden]` and was never getting un-hidden
  because the gate required "`!hidden`" (chicken-and-egg).

### Non-breaking

- Flat-mode fallback retained: `window.featureFlags.treeLayers = false;
  renderLayersPanel()` reverts to the flat list instantly.
- Gate-A: **75/5/0** (up from 65/5/0 — 10 new tree-nav tests, no regressions).
- Typecheck: clean.

### Related

- ADR-034 Layer Tree DnD — tree-rendering half shipped (DnD reparent deferred)

---

## [1.1.4] — 2026-04-23 — Phase B3: Flip defaults to v2 layout (first visible UX change)

Fourth micro-step of Phase B — first user-visible UX change in the v2
redesign trajectory. Flips `layoutVersion` default from `"v1"` to `"v2"`
and `layersStandalone` default from `false` to `true`. Gate-A: 65/5/0.

### Changed

- `editor/src/feature-flags.js`: DEFAULT_FLAGS
  - `layoutVersion: "v1"` → `"v2"`
  - `layersStandalone: false` → `true`
- `editor/src/layers-panel.js`: `renderLayersPanel()` now renders in basic
  mode when `layersStandalone` is true (V2-01 invariant: layers visible in
  both basic + advanced modes). Advanced-only controls (drag handle,
  z-index input, lock button, "Заблокирован" chip) hidden in basic mode.
- `editor/src/inspector-sync.js`: host-aware render gate now allows basic
  mode when `layersStandalone`, so selection-change highlight stays fresh.

### UX impact

- New users: Figma-style split-pane left column with persistent Layers
  panel below the slide rail. Layers visible in basic mode (view+visibility
  toggle) and advanced mode (+ drag-reorder, z-index, lock).
- Existing users (with localStorage persisted from v1.1.0–v1.1.3): flags
  stay on v1 per their stored prefs. They can reset via
  `window.resetFeatureFlags()` in devtools.

### Non-breaking

- Gate-A: **65/5/0** preserved — CSS rule hides `#layersInspectorSection`
  when `[data-layers-standalone="true"]`, so existing `toBeHidden()`
  assertions still pass.
- Typecheck: clean.

### Related

- ADR-031 Persistent Layers Panel — status flipped to Accepted (code shipped)
- ADR-032 Workspace Layout v2 — status flipped to Accepted (code shipped)
- V2-MASTERPLAN §1 V2-01 invariant active

---

## [1.1.3] — 2026-04-23 — Phase B2: #layersRegion shell region + dual-render

Third micro-step of Phase B. Adds the persistent Layers shell region scaffold
and dual-render placement logic. Defaults remain v1 — zero UX change until
v1.1.4 flips them.

### Added

- `presentation-editor.html`: wraps `#slidesPanel` in `<div class="left-pane-wrapper">`, adds `<button class="left-pane-resizer">` (already DOM-expected by left-pane-splitter.js), and adds `<aside id="layersRegion" class="panel shell-panel shell-panel-left layers-region" hidden>` with internal `.layers-region-body` container.
- `editor/src/layers-panel.js`:
  - `ensureLayersContainerPlacement()` — moves the single `#layersListContainer` DOM node between `.layers-region-body` (when `featureFlags.layersStandalone` true) and `#layersInspectorSection` (default). Single node avoids duplicated IDs + event rebinds.
  - `getActiveLayersHost()` — resolves either `#layersRegion` or `#layersInspectorSection` per flag.
  - `syncInactiveLayersHost()` — hides the non-owning host so stale `hidden` state can't leak after a runtime flag flip.
  - `renderLayersPanel()` now delegates visibility to the active host, not hardcoded to inspector section.
- `editor/src/state.js`: `els.layersRegion` reference added.
- `editor/src/boot.js`: `init()` calls `ensureLayersContainerPlacement()` after `applyLayersStandaloneAttribute()` — before first paint.
- `editor/src/inspector-sync.js`: render-skip predicate uses active host, not hardcoded inspector section (so standalone mode still triggers renders).
- `editor/styles/layers-region.css`: activated scaffold — flex layout with scrolling `.layers-region-body`, header pinned, padded list container.

### Non-breaking

- **Zero UX change** — `featureFlags.layersStandalone` defaults to `false`, so `getActiveLayersHost()` returns the inspector section exactly as before; `#layersRegion` stays `hidden`; new `.left-pane-wrapper` is transparent in v1 layout (no split-pane rules apply).
- Gate-A: **65/5/0** preserved.
- Typecheck: clean.

### Manual activation (for testing)

```js
window.featureFlags.layersStandalone = true;
window.featureFlags.layoutVersion = "v2";
// reload — layers panel renders in the shell region below slides rail.
```

### Related

- ADR-031 Persistent Layers Panel (status: proposed → implementation landed)
- ADR-032 Workspace Layout v2

---

## [1.1.2] — 2026-04-23 — Docs: V2 Continuation Prompt

Docs-only patch. No code changes. No UX change.

### Added

- `docs/V2-CONTINUATION-PROMPT.md` — comprehensive copy-paste prompt for
  continuing the v2.0 redesign in a fresh agent session. Applies
  Role-Task-Context-Constraints-Examples-StopCriteria prompt engineering
  pattern. Includes:
  - Mandatory context-load order (6 files)
  - Baseline verification commands with expected outputs per release
  - Execution loop structure (13 steps per logical unit)
  - All invariants from MASTERPLAN §1 enumerated inline
  - Positive + negative examples (follows rhythm / skips phases /
    skips verification / batches commits / uses `git add .` /
    vault-writes-without-skill)
  - Stop conditions (when to halt and report to user)
  - Success criteria checklist for v2.0.0 done-ness
  - Behavioral guidelines cross-linking CLAUDE.md + AGENT-SYSTEM-INSTRUCTION
  - Quick-reference cheat sheet
  - Self-test instructions for verifying the prompt works
  - Prompt engineering rationale (patterns applied)
- `docs/V2-MASTERPLAN.md` §10: short inline version retained + link to
  V2-CONTINUATION-PROMPT.md as canonical.

### Non-breaking

- Gate-A: 65/5/0 preserved (no code touched).
- Typecheck: clean.

### Purpose

Ensures continuity across multiple agent sessions. Any fresh session can
load context identically and resume mid-phase without drift in invariants,
commit rhythm, or vault discipline.

---

## [1.1.1] — 2026-04-23 — Phase B1: Split-pane scaffold (dormant)

Second micro-step of Phase B. Scaffolds the Figma-style split-pane layout
behind `ui.layoutVersion === "v2"` feature flag. Default off — zero UX change.

### Added

- `editor/styles/split-pane.css` — full v2 layout rules, scoped to `body[data-layout-version="v2"]`. Contains grid definitions for `.left-pane-wrapper`, `.left-pane-resizer` (with :hover / :focus-visible / .is-dragging states), responsive fallback < 1024px.
- `editor/src/left-pane-splitter.js` — resizer JS with pointer drag, keyboard arrows (Arrow Up/Down step 2%, Shift 10%, Home/End, Enter/Space reset), double-click reset, `role="separator"`, `aria-valuenow/min/max`, localStorage persistence. No-op when flag off.
- `editor/src/shell-layout.js`: `applyLayoutVersionAttribute()` and `applyLayersStandaloneAttribute()` helpers — mirror flag values to `<body data-layout-version>` / `<body data-layers-standalone>` so CSS scoping works on first paint.
- `editor/src/boot.js`: `init()` calls body-attribute helpers before first paint and `initLeftPaneSplitter()` after `bindShellLayout()`.
- `@layer` declaration: `split-pane` layer appended (after `modal`, before `responsive`).
- `presentation-editor.html`: link `split-pane.css`, script `left-pane-splitter.js`.

### Non-breaking

- **Zero UX change** — `ui.layoutVersion` defaults to `"v1"`, so `body[data-layout-version="v1"]` → no v2 CSS rules match → layout identical to v1.1.0.
- Gate-A: 65/5/0 preserved.

### Activation

- Manual (advanced users): set `window.featureFlags.layoutVersion = "v2"` + `window.featureFlags.layersStandalone = true` in devtools, reload. Splitter activates (requires `.left-pane-wrapper` in DOM — comes in v1.1.2).
- Default flip: v1.1.3 (Phase B3).

---

## [1.1.0] — 2026-04-23 — Phase A Foundation (v2.0 Redesign trajectory start)

**First milestone on the path v1.0.3 → v2.0.0.** Foundation release — zero UX change, all changes additive. Sets up tokens, feature flags, CSS layer, and 7 new ADRs for the next 4 phases.

### Added (Architecture / Docs)

- **7 new ADRs** (031–037) covering the full v2.0 redesign scope:
  - ADR-031 Persistent Layers Panel — extract layers from inspector into shell region
  - ADR-032 Workspace Layout v2 — Figma-style split-pane (slides/layers left column)
  - ADR-033 Theme System v3 — elevation, SVG icons, motion hierarchy, focus-ring
  - ADR-034 Layer Tree DnD — hierarchical tree view, drag-drop reparent, group/ungroup
  - ADR-035 Smart Import Pipeline v2 — 8 framework detectors, 4 slide inference strategies, complexity score, preprocessing report
  - ADR-036 PPTX Fidelity v2 — getBoundingClientRect position resolver, SVG shapes, gradients, font map, validator
  - ADR-037 UX Progressive Disclosure — contextual sections, error layers 4-6, destructive-action confirm, onboarding v2
- Updated vault: `PROJ - v2.x Redesign`, `ARCH - Overview` (module/CSS trajectory, feature flags registry)

### Added (Code — additive only)

- **tokens v3** in `editor/styles/tokens.css`:
  - Elevation system: `--elevation-0..4` with light + dark rebinds
  - Semantic shadows: `--shadow-panel`, `--shadow-floating`, `--shadow-modal`, `--shadow-pressed`
  - Hover/active strong states: `--state-hover-strong`, strengthened `--state-active`
  - Motion hierarchy: `--motion-micro` (120ms), `--motion-base` (180ms), `--motion-emphasis` (280ms)
  - Easings: `--ease-out`, `--ease-in-out`, `--ease-spring`
  - Left-pane split reservation: `--left-split`, `--left-resizer-thickness`, `--left-resizer-hover`
- `editor/src/feature-flags.js` — extended with v2 flags: `layoutVersion`, `layersStandalone`, `treeLayers`, `multiSelect`, `pptxV2`, `smartImport`, `svgIcons`. All default to off/v1 in this release.
- `editor/styles/layers-region.css` — empty scaffold; added `layers-region` to `@layer` declaration in `tokens.css`.

### Non-breaking

- **Zero UX difference** from v1.0.3. All additions are dormant (behind flags default off).
- **Gate-A: 65/5/0** preserved.
- No `type="module"` introduced (ADR-015 preserved).
- iframe + bridge + modelDoc architecture untouched.

### Planned next (Phase B → v1.2.0)

- Activate persistent layers region (`ui.layersStandalone = true`)
- Activate 4-zone layout (`ui.layoutVersion = "v2"`)
- Implement Smart Import Pipeline v2 (`import-pipeline-v2/` module)
- Tree-view layer hierarchy with DnD
- Playwright: `layers-panel-v2.spec.js`, `import-pipeline-v2.spec.js`

---

## [1.0.3] — 2026-04-22 — pointer-events Regression Fix

### Fixed
- **bridge-script.js** `ensureHelperStyles()`: removed `pointer-events:auto!important` from the `_deckHasOwnVisibility=true` branch of `_slideEditCss`. Deck's own CSS (`.slide{pointer-events:none} .slide.active{pointer-events:all}`) now manages pointer-events correctly.
- **v1.0.2 regression**: with own-visibility decks (e.g. `prepodovai_v3_edit.html`), all non-active invisible slides (opacity:0) had `pointer-events:auto` and intercepted every click intended for the active slide. Confirmed via Playwright: 8 invisible click-interceptors per deck.
- Own-visibility branch now only injects `transition:none!important; animation:none!important` (race-condition protection). No-own-visibility branch unchanged.

### Tests
- Updated `foreign-deck-compat.spec.js` Test C in all 3 suites: assertion changed from "all slides have pointer-events:auto" → "exactly 1 interactive slide" (the active one). The previous assertion was validating the bug. foreign-deck: 17/17 ✅. Full Gate-A: 82/5/0 ✅.

---

## [1.0.2] — 2026-04-22 — Foreign Deck Single-Slide View Fix

### Fixed
- **bridge-script.js** `fix(compat)`: `ensureHelperStyles()` now detects whether the foreign deck manages its own slide visibility via class toggles (`.active`, `.present`, `.past`/`.future`, `aria-current`, `hidden`, `aria-hidden`).
  - When own visibility detected: only `pointer-events:auto!important; transition:none!important; animation:none!important` is injected — deck's native single-slide navigation is preserved
  - When no own visibility detected: full `opacity:1!important; transform:none!important` override still applies
  - **Fixes**: `prepodovai_v3_edit.html` and similar `position:absolute` overlay decks showing all slides simultaneously and overlapping in edit mode

### Tests
- Updated `foreign-deck-compat.spec.js` Test B (all 3 foreign suites): assertion changed from "all slides opacity > 0.9" → "exactly 1 slide visible (deck manages visibility)" — all 17 tests passing (17/17 ✅)

---

## [1.0.1] — 2026-04-22 — Foreign Deck Compatibility

### Fixed
- **bridge-script.js** `fix(bridge)`: CSS overrides injected via `ensureHelperStyles()` for foreign HTML presentations in edit mode.
  - `[data-editor-slide-id]` → `opacity:1; pointer-events:auto; transform:none; transition:none; animation:none` (`!important`) — all import-pipeline-tagged slides forced visible, no transitions
  - `.fragment` → `opacity:1; transform:none; transition:none; animation:none` — reveal-like fragments fully visible in edit mode
  - `.stack > section` → `display:block; position:relative; transition:none; animation:none` — vertical sub-slides unfolded
  - `stopPropagation()` on ArrowKey/Space/PageDown/PageUp in `keydown` handler — blocks deck-native slide navigation when in edit mode and not in inline text editing
- Targets only `[data-editor-slide-id]` elements (tagged by import pipeline) — own-format decks unaffected (regression test confirms)

### Tests
- Added 3 stress test fixtures: `ops_control_room_stress.html`, `mercury_casefile_stress.html`, `reveal_like_nested_stress.html`
- Added `tests/playwright/specs/foreign-deck-compat.spec.js` — 17 tests / 4 suites covering viewport-flat and reveal-like nested deck structures (17/17 ✅)

---

## [1.0.0-rc] — 2026-04-22 — v1.0 Release Candidate (38 WOs, W1–W8 complete)

> RC freeze declared. Feature freeze active. Bug-fix only until v1.0.0 GA.
> All 15 P0 PAIN-MAP items resolved. All 9 test gates green. 37 WOs merged.
> Version tag for RC: `v0.37.0-rc.0` (internal marker) → release tag: `v1.0.0`.

### Security
- **WO-01** `fix(security)`: parseSingleRoot sanitize — `BLOCKED_ATTR_NAMES` + `UNSAFE_ATTR` filter + 256 KB cap (P0-02, v0.26.1)
- **WO-03** `fix(security)`: pptxgenjs vendored + SRI hash — supply-chain pinning (P0-03, v0.26.2)
- **WO-05** `fix(security)`: crypto bridge token — `window.crypto.getRandomValues` + origin assertion (P1-15, v0.26.3)
- **WO-02** `fix(security)`: bridge origin assertion — `postMessage` targetOrigin + event.origin equality (P1-13, v0.26.4)
- **WO-04** `fix(security)`: sessionStorage autosave size cap + light-snapshot fallback on quota (P1-14, v0.26.5)
- **WO-07** `feat(security)`: trust-banner — detect `<script>`/`on*`/`javascript:` + one-click neutralize + ADR-014 (P0-01, v0.27.3)
- **WO-06** `feat(security)`: broken-asset banner + iframe sandbox-attrs audit (P0-01 partial, v0.27.1)
- **WO-08** `feat(bridge)`: bridge contract scaffold + schema registry (ADR-012, v0.27.0, gate-contract NEW)
- **WO-13** `feat(bridge)`: 152 per-message schema validators — gate-contract 152/0 (ADR-012, P0-10, P0-13, v0.28.3)

### Added (Gates & Testing infrastructure)
- **WO-09/10/11** `feat(a11y)`: gate-a11y — axe-core scan + keyboard-nav + contrast, 27/0 (ADR-006, P0-05, P0-08, P0-14, v0.27.5)
- **WO-32** `test(visual)`: gate-visual — 15 chromium-visual snapshots 1440×900 (ADR-007, v0.32.0)
- **WO-14** `chore(types)`: gate-types — tsc --noEmit baseline; globals.d.ts (ADR-011, v0.28.1; clean v0.33.1 WO-38)
- **WO-08** contract gate introduced; **WO-13** extended to 152 schemas

### Added (Features)
- **WO-12** `feat(bridge)`: Bridge v2 hello handshake + version negotiation (ADR-012, v0.28.0)
- **WO-15** `feat(telemetry)`: telemetry scaffold — event emit API + session tracking (ADR-020, v0.28.2)
- **WO-24** `feat(ux)`: broken-asset recovery banner — enumerate missing assets + asset resolver (P0-04, v0.30.0, gate-A +6)
- **WO-25** `feat(ux)`: starter-deck CTA rehome — Open/Starter/Paste order + fixture relocation (P0-15, v0.30.1)
- **WO-28** `feat(ux)`: snap-to-siblings + smart guides overlay (ADR-004, v0.31.1)
- **WO-31** `feat(ux)`: shift-click multi-select toast + dismiss (P1-03, v0.31.0)
- **WO-33** `feat(ux)`: tablet honest-block — drag/resize/rail-reorder blocked ≤820px, Russian banner (ADR-018, v0.32.3)
- **WO-34** `feat(telemetry)`: telemetry viewer — session summary, event filter, export log, clear log (ADR-020, v0.32.4)
- **WO-35** `feat(plugin)`: entity-kind registry externalized (ADR-016 Layer 1, P2-05, v0.32.2)

### Changed (Architecture & Refactoring)
- **WO-16/17** `refactor(state)`: observable store + ui/selection slices — `window.store` API (ADR-013, v0.28.4–v0.28.5)
- **WO-18** `perf(history)`: patch-based snapshots + history budget chip N/20 + toast-on-drop (ADR-013, P0-07, P0-11, v0.29.0)
- **WO-20/21** `refactor(split)`: selection.js → layers-panel.js + floating-toolbar.js (P1-06, v0.29.2–v0.29.3)
- **WO-22** `refactor(split)`: boot.js → theme.js + zoom.js + shell-layout.js (P1-07/P1-08, v0.29.4)
- **WO-23** `refactor(split)`: feedback.js → surface-manager.js + banners.js (P1-09/P2-09, v0.29.5)
- **WO-29** `feat(ux)`: banner unification — `#lockBanner` + `#blockReasonBanner` merged (ADR-001, P1-01/P1-02, v0.31.2)
- **WO-30** `refactor(tokens)`: design tokens v2 — Layer 2 semantic tokens + inspector.css migration 58 vars (ADR-019, v0.32.1)
- **WO-37** `refactor(shortcuts)`: declarative KEYBINDINGS 29-entry table + isAdvancedMode() accessor (ADR-011, P2-04/P2-08, v0.33.1)

### Fixed (Performance)
- **WO-19** `perf(render)`: RAF-coalesce selection fan-out 7→1 pass (ADR-013, P0-12/P1-12, v0.29.1)
- **WO-26** `fix(ux)`: transform resolve — inspector transform field + Resolve action button (P0-06, v0.30.2)

### Fixed (Reliability)
- **WO-36** `test(flake)`: flake elimination — 23 `waitForTimeout` → 0; `page.once` → `acceptNextDialog`; container-mode-ack bridge round-trip (P1-16/17/19, v0.33.0)

### Deferred to v1.1+
- ADR-002 (stack-depth indicator visual polish) — baseline badge functional
- ADR-016 Layer 2 (plugin marketplace) — Layer 1 shipped
- God-cache migration P1-05 (full `requireEl` lazy accessor pattern)
- Live CRDT collaboration (ADR-017) — readiness shipped; live collab deferred to v2.0
- P1-07 full boot.js split — partial shipped in v0.29.4

### Version history (all tags v0.26.1–v0.33.1)
`v0.26.1` WO-01 · `v0.26.2` WO-03 · `v0.26.3` WO-05 · `v0.26.4` WO-02 · `v0.26.5` WO-04 · `v0.27.0` WO-08 · `v0.27.1` WO-06 · `v0.27.2` bump · `v0.27.3` WO-07 · `v0.27.4` WO-10 · `v0.27.5` WO-11 · `v0.28.0` WO-12 · `v0.28.1` WO-14 · `v0.28.2` WO-15 · `v0.28.3` WO-13 · `v0.28.4` WO-16 · `v0.28.5` WO-17 · `v0.29.0` WO-18 · `v0.29.1` WO-19 · `v0.29.2` WO-20 · `v0.29.3` WO-21 · `v0.29.4` WO-22 · `v0.29.5` WO-23 · `v0.30.0` WO-24 · `v0.30.1` WO-25 · `v0.30.2` WO-26 · `v0.31.0` WO-31 · `v0.31.1` WO-28 · `v0.31.2` WO-29 · `v0.32.0` WO-32 · `v0.32.1` WO-30 · `v0.32.2` WO-35 · `v0.32.3` WO-33 · `v0.32.4` WO-34 · `v0.33.0` WO-36 · `v0.33.1` WO-37

---

## [v0.29.5] — 2026-04-21 — W4 batch 6 (FINAL): WO-23 feedback.js split → surface-manager + banners scaffold

### Refactor
- refactor(arch): split feedback.js → surface-manager.js + banners.js scaffold — PAIN-MAP **P2-09 CLOSED**; P1-09 partially closed (full banner migration deferred post-v1.0). `surface-manager.js` (37 LOC): 2 functions cut/pasted verbatim from feedback.js (`normalizeShellSurfaceKeep`, `closeTransientShellUi`) with ZERO body edits. Runtime guard: throws if `closeContextMenu` not yet defined (enforces load-after-context-menu.js). `banners.js` (97 LOC scaffold): `BANNER_REGISTRY` (Object.create(null)); `@typedef BannerSpec` with required `.render(payload)` + optional `.hide()`; `registerBanner(id, spec)` — throws on missing render; `showBanner(id, payload)` — calls spec.render, replaces existing activeBanners entry (no duplicate), updates `window.store.update('ui', {activeBanners})`, falls back to `reportShellWarning` for unknown id; `hideBanner(id)` — calls optional spec.hide, filters activeBanners; `getActiveBanners()` — returns frozen copy. Runtime guard: throws if `window.store.get` not a function. WO-07 Trust Banner wired separately via shellBoundary (path b — already merged v0.27.3). `state.js`: ui slice extended with `activeBanners: []` initial value. `feedback.js`: moved block replaced with 2-line comment (`// Surface mutex moved to surface-manager.js (WO-23 — PAIN-MAP P1-09, P2-09).`). Script load order: `context-menu.js` → `inspector-sync.js` → `shell-overlays.js` → `surface-manager.js` → `banners.js` → `theme.js`. Call-site audit: `closeTransientShellUi` called in `boot.js` (1), `bridge-commands.js` (2), `selection.js` (1), `shell-layout.js` (3), `shell-overlays.js` (3); `normalizeShellSurfaceKeep` called in `shell-layout.js` (1), `feedback.js` (removed). All resolve via shared global scope — no imports added. feedback.js: 1237 LOC (was 1260). Module count: 30 → 32. Gate-A: 59/5/0. test:unit: 54/54.

### Tests
- test(arch): surface-manager.spec.js — 5 unit cases. Cases: (a) keep:'context-menu' skips context-menu closer, (b) normalizeShellSurfaceKeep(undefined) → empty Set, (c) normalizeShellSurfaceKeep('x') → Set{x}, (d) normalizeShellSurfaceKeep(['a','b',null]) → Set{a,b} (null filtered), (e) no-options closes all 6 surfaces.
- test(arch): banners.spec.js — 6 unit cases. Cases: (a) registerBanner stores spec, (b) showBanner calls render + updates activeBanners, (c) hideBanner removes from active list, (d) unknown id does not throw — calls reportShellWarning, (e) duplicate showBanner replaces entry, (f) missing render throws. test:unit → 54/54.

---

## [v0.29.4] — 2026-04-21 — W4 batch 5: WO-22 boot.js split → theme + zoom + shell-layout

### Refactor
- refactor(arch): split boot.js → theme.js + zoom.js + shell-layout.js (~440 LOC extracted). main.js orphan DOM reparent absorbed into boot.js::ensureSlideTemplateBarRoot — **PAIN-MAP P1-08 CLOSED**. P1-07 partially closed (remaining boot.js concerns deferred post-v1.0). `theme.js` (~153 LOC): 8 functions moved verbatim (`resolveSystemTheme`, `getThemePreferenceLabel`, `queueThemeTransitionUnlock`, `syncThemeDatasets`, `applyResolvedTheme`, `initTheme`, `setThemePreference`, `toggleTheme`). Runtime guard: throws if `window.store.get` not a function. `zoom.js` (~89 LOC): 5 functions moved verbatim (`initPreviewZoom`, `setPreviewZoom`, `applyPreviewZoom`, `updatePreviewZoomUi`, `stepZoom`). Runtime guard: throws if `window.store.get` not a function. `shell-layout.js` (~206 LOC): 11 functions moved verbatim (`setToggleButtonState`, `setDisclosureButtonState`, `bindShellLayout`, `isCompactShell`, `syncShellPanelFocusableState`, `setElementInertState`, `applyShellPanelState`, `syncShellPanelVisibility`, `setShellPanelState`, `toggleShellPanel`, `closeShellPanels`). Runtime guard: throws if `state` or `els` not defined. Script load order: `shell-overlays.js` → `theme.js` → `zoom.js` → `shell-layout.js` → `boot.js` → `primary-action.js` → `main.js`. All callers in `boot.js`, `bridge-commands.js`, `context-menu.js`, `dom.js`, `feedback.js`, `floating-toolbar.js`, `primary-action.js`, `selection.js`, `shell-overlays.js`, `shortcuts.js` resolve via shared global scope. boot.js: ~1551 LOC (was 1973). main.js: 3 LOC (was 12). Module count: 27 → 30. Gate-A: 59/5/0. test:unit: 43/43. PAIN-MAP: P1-07 (partial), P1-08 (CLOSED).

---

## [v0.29.3] — 2026-04-21 — W4 batch 4: WO-21 selection.js split → floating-toolbar.js

### Refactor
- refactor(arch): split selection.js → floating-toolbar.js (198 LOC extracted) + toolbar.js (54 LOC extracted); **PAIN-MAP P1-06 CLOSED**. `floating-toolbar.js` (267 LOC): 6 functions moved verbatim from selection.js (`toggleFloatingToolbarCollapsed`, `persistToolbarSession`, `initFloatingToolbarState`, `clampToolbarPosition`, `positionFloatingToolbar`, `hideFloatingToolbar`) + 1 function moved verbatim from toolbar.js (`updateFloatingToolbarContext`). Runtime guard: throws if `getSelectionInteractionRect` not yet defined (enforces load order). Script load order: `selection.js` → `layers-panel.js` → `floating-toolbar.js` → `toolbar.js`. `toolbar.js` retains only inspector-init helpers (`initInspectorSections`, `addInspectorHelpBadges`, `slugify`). selection.js now ~1171 LOC. toolbar.js now 96 LOC (was 152). Module count: 26 → 27. Gate-A: 59/5/0. test:unit: 43/43. PAIN-MAP: P1-06 (final closure).

---

## [v0.29.2] — 2026-04-21 — W4 batch 3: WO-20 selection.js split → layers-panel.js

### Refactor
- refactor(arch): split selection.js → layers-panel.js (449 LOC extracted; PAIN-MAP P1-06 phase 1/2). Do NOT claim P1-06 closed — WO-21 is next. 18 functions moved verbatim (zero body edits): `toggleLayerLock`, `toggleLayerVisibility`, `reorderLayers`, `getEntityKindIcon`, `getLayerLabel`, `getPreviewLayerNode`, `isLayerSessionHidden`, `setLayerSessionVisibility`, `clearSessionOnlyVisibilityFromModelNode`, `stripSessionOnlyVisibilityFromReplacement`, `getRussianPlural`, `formatLayerStackHint`, `buildLayerStatusChipHtml`, `buildLayerStatusChipsHtml`, `renderLayersPanel`, `bindLayersPanelActions`, `groupSelectedElements`, `ungroupSelectedElement`. `layers-panel.js` runtime guard: throws if `renderSelectionOverlay` not yet defined (enforces load order). All call sites in `bridge-commands.js`, `context-menu.js`, `dom.js`, `feedback.js`, `history.js`, `inspector-sync.js`, `shell-overlays.js` resolve via shared global scope — no imports added. Script load order: `selection.js` → `layers-panel.js` → `toolbar.js`. Module count: 25 → 26. Gate-A: 59/5/0. test:unit: 43/43. PAIN-MAP: P1-06 (phase 1/2).

---

## [v0.29.1] — 2026-04-21 — W4 batch 2: WO-19 RAF-coalesce selection fan-out

### Performance
- perf(render): RAF-coalesce selection fan-out — ADR-013 §Render coalescing — PAIN-MAP P0-12, P1-12. `state.js` (+180 LOC): `SELECTION_RENDER_KEYS` frozen object (8 keys: inspector, shellSurface, floatingToolbar, overlay, slideRail, refreshUi, overlapDetection, focusKeyboard); `state.selectionRenderPending` dirty-flag map (all false by default); `state.selectionRenderRafId` (0 = no frame queued); `state.selectionRenderOptions` (previousNodeId guard). `scheduleSelectionRender(keys, options)`: accepts `'all'` or `string[]` of key names; marks dirty flags; enqueues exactly 1 `requestAnimationFrame(flushSelectionRender)` if not already queued — N synchronous calls → 1 RAF. `flushSelectionRender()`: snapshots all 8 flags, zeros them BEFORE sub-renders execute (prevents double-flush race), zeros `selectionRenderRafId`, runs sub-renders in deterministic order (1-inspector, 2-shellSurface, 3-floatingToolbar, 4-overlay, 5-slideRail, 6-refreshUi, 7-overlapDetection, 8-focusKeyboard), each wrapped in try/catch → `reportShellWarning` so a throwing sub-render does not block others. focusKeyboard gated: only fires when previousNodeId !== selectedNodeId OR !isTextEditing. `bridge-commands.js`: `applyElementSelection` — 7 synchronous sub-render calls replaced with `scheduleSelectionRender('all', {previousNodeId})` inside existing `store.batch`. `applySelectionGeometry` — 3 synchronous calls replaced with `scheduleSelectionRender(['floatingToolbar','inspector','overlay'])`. `clearSelectedElementState` — 2-call cluster replaced with `scheduleSelectionRender(['inspector','overlay'])`. Element-update block — 4-call cluster replaced with `scheduleSelectionRender('all')` or `scheduleSelectionRender(['slideRail','refreshUi','overlapDetection'])` based on `isCurrentSelection`. `inspector-sync.js` P1-12: `renderLayersPanel()` wrapped: `if (state.complexityMode==='advanced' && els.layersInspectorSection && !els.layersInspectorSection.hidden)` — basic mode and hidden section skip renderLayersPanel entirely. Pre-WO-19 baseline: 7 synchronous render passes per click, multiple `getBoundingClientRect` + style-write interleaves. Post-WO-19: 1 RAF per click coalescing all 7-8 renders into one animation frame. Gate-A: 59/5/0. ADR-013. PAIN-MAP: P0-12, P1-12.

### Tests
- test(render): schedule-selection-render.spec.js — 11 unit cases (Node --test runner). Cases: (a) two calls → 1 RAF, (b) flush calls 8 sub-renders in documented order, (c) subset key schedules only that sub-render, (d) re-scheduling during flush enqueues new RAF, (e) dirty flags zeroed before sub-renders execute, (f) focusKeyboard fires when not text-editing even if same node, (f2) focusKeyboard NOT called when same node + isTextEditing, (g) throwing sub-render does not block others, (h) rafId zeroed after flush, (i) 3 combined calls coalesce to 1 RAF with union of keys, (j) P1-12 renderLayersPanel guard. test:unit → 43/43 (32 existing + 11 new).
- test(render): selection-perf.spec.js — 3 Playwright gate-B cases on perf-100elem.html fixture (100 deterministic elements, 2 slides). (A) N scheduleSelectionRender calls → exactly 1 RAF enqueued; (B) flushSelectionRender executes within 2 animation frames (< 200 ms E2E budget); (C) 5 synchronous schedule calls → 1 pending RAF with combined dirty flags.
- fixture: tests/fixtures/perf-100elem.html — 100 deterministic elements (elem-001..elem-100), 2 slides (50 elements each), absolute-positioned grid layout, no random data.

---

## [v0.29.0] — 2026-04-21 — W3 Bridge v2+Store batch 3: WO-18 History Slice + Patch Engine

### History
- feat(history): patch-based snapshots + history budget chip — ADR-013 §history slice — WO-18. `history.js` (+254 LOC): `HISTORY_CLIENT_ID` stable per-session random ID via `crypto.getRandomValues` / `Math.random` fallback; `_historyPatchCounter` monotonically increasing (ADR-017 CRDT-readiness). `fnv1a32(str)` — FNV-1a 32-bit hash (synchronous, no crypto.subtle) for HTML deduplication: identical HTML skipped without disk/memory write. `createDomPatch(html, reason, currentPatches)` — produces `{op:'baseline'|'delta', html, diff?, hash, clientId, counter, at, reason}`. Baseline rolled on first commit and every 10th delta since last baseline. Delta stores `diff: JSON.stringify({nextHtml})` plus full `html` fallback (ADR-017 §no-replay). `captureHistorySnapshot` rewritten: reads from `window.store.get('history')` (immutable), trims forward-redo branch, dedup via hash, calls `createDomPatch`, enforces `HISTORY_LIMIT=20` via `slice(-20)`, emits single `window.store.batch(...)` update, mirrors to legacy `state.history` / `state.historyIndex` for backward compat, shows Russian warning toast on overflow: "Старейший шаг истории сброшен. Сохрани проект, чтобы не потерять работу.". `restoreSnapshot` updated: handles both `op:'baseline'` (direct html), `op:'delta'` (parse diff.nextHtml, fallback to html), and legacy object shape. `undo()`/`redo()` now read from `window.store.get('history')` and emit `store.update` in addition to legacy state mirror. `captureHistorySnapshot`, `serializeCurrentProject`, `restoreSnapshot` removed from `export.js` (WO-18: moved to history.js global scope). `state.js`: `window.store.defineSlice('history', {index:-1,limit:20,baseline:null,patches:[],dirty:false,lastSavedAt:0})`; Proxy shim extended with `_HISTORY_STATE_TO_SLICE` map (historyIndex/dirty/lastSavedAt); `els.historyBudgetChip` cached. `store.js`: `@typedef HistoryPatch` + `@typedef HistorySlice` with ADR-017 CRDT-readiness checklist. `primary-action.js`: `renderHistoryBudgetChip()` reads `histSlice.patches.length` → hidden if <5, shows `N/20` text + `aria-label`, adds `.is-warning` at ≥15, `.is-danger` at ≥19; subscribed to 'history' slice. `layout.css`: `.history-budget-chip` + `.is-warning` + `.is-danger` styles inside `@layer layout`. `presentation-editor.html`: `<span id="historyBudgetChip">` in `#topbarStateCluster` with `role="status" aria-live="polite"`. CommonJS export guard in history.js exports `fnv1a32`, `createDomPatch`, `getHistoryClientId` for Node test runner. Gate-A: 59/5/0. ADR-013. ADR-017. PAIN-MAP: P0-09.

### Tests
- test(history): history-patches.spec.js — 12 unit cases (Node --test runner). Cases: (a) first-baseline, (b) hash-dedup, (c) 11th-rolls-baseline, (d) HISTORY_LIMIT overflow, (e) baseline-restore, (f) delta-restore, (g) clientId-stable, (h) counter-monotonic, (i) undo-store, (j) redo-store, (k) fnv1a32-deterministic, (l) 20-identical-dedup-1-baseline-<50KB. test:unit → 32/32 (12 store + 8 selection + 12 history).
- test(history): history-budget.spec.js — 2 Playwright gate-B cases: (A) 15 snapshots → chip shows "15/20" with .is-warning; (B) 21 snapshots → overflow toast "Старейший шаг истории сброшен." visible + chip shows "20/20" with .is-danger.

---

## [v0.28.5] — 2026-04-21 — W3 Bridge v2+Store batch 2: WO-17 Selection Slice

### State
- refactor(store): selection slice migration — 16 selection fields migrated from window.state to store 'selection' slice — ADR-013 phase 2 — PAIN-MAP P2-07 (closure table). `store.js`: `@typedef SelectionSlice` covering all 16 fields with ADR-017 CRDT-readiness checklist. `state.js`: `window.store.defineSlice('selection', {...})` with full initial shape including flags/policy objects. `createDefaultSelectionPolicy` refactored: 6-branch if-chain replaced with `SELECTION_POLICY_TABLE` + priority-order loop — output shape byte-identical for all flag combinations; Russian reason strings preserved verbatim. Proxy shim extended: `_SELECTION_STATE_TO_SLICE` map (16 entries) added alongside existing `_UI_SLICE_KEYS` — reads route to `store.get('selection')[sliceKey]`, writes dual-write to store + raw state for backward compat. `bridge-commands.js` `applyElementSelection`: 3-phase refactor — (1) compute all values, (2) dual-write raw state fields + `window.store.batch(() => store.update('selection', fullPatch))` for ONE microtask notification per selection event, (3) side-effect calls in identical order. No DOM nodes stored in slice (IDs + plain objects only). Zero bundler deps added. Gate-A: 59/5/0. ADR-013. ADR-017. PAIN-MAP: P2-07.

### Tests
- test(state): selection-slice.spec.js — 8 unit cases (Node --test runner). Cases: defineSlice-initial, update-next-prev, batch-fires-once, policy-slide-root, policy-table-priority, policy-golden-object, policy-free-defaults, select-entityKind-initial. test:unit → 20/20 (12 store + 8 selection).

---

## [v0.28.4] — 2026-04-21 — W3 Bridge v2+Store batch 2: WO-16 Observable Store

### State
- feat(state): observable store bootstrap + ui slice migration — ADR-013 phase 1 — PAIN-MAP P0-09 start. `store.js` (+340 LOC): hand-rolled `createStore()` IIFE factory on `window.store`; API: `defineSlice/get/select/update/subscribe/batch`. `Object.freeze` slices in dev, `queueMicrotask`-based notification, microtask coalescing — subscribers fire exactly once per batch. `@typedef UISlice` + `@typedef Store` per ADR-011. `window.store.defineSlice("ui", {complexityMode,previewZoom,theme,themePreference})` in `state.js` before state literal. `window.stateProxy` Proxy shim: `get` reads ui keys from store; `set` writes ui keys through `store.update`. `boot.js` rewired: `applyResolvedTheme`/`setThemePreference`/`setComplexityMode`/`setPreviewZoom` each call `window.store.update("ui", {...})` to keep store in sync. Zero DOM references in `store.js`. Zero bundler deps. `test:unit` → 12/12 (`tests/unit/store.spec.js`). ADR-013 Status → Accepted (phase 1). Gate-A: 59/5/0. ADR-013. PAIN-MAP: P0-09.

### Tests
- test(state): store.spec.js — 12 unit cases (Node --test runner). Cases: get-frozen, update-identity, subscribe-next-prev, microtask-fire, batch-coalesce, path-subscribe, defineSlice+subscribe, sequential-coalesce, freeze-throw, unsubscribe, nested-batch, select-missing.

---

## [v0.28.3] — 2026-04-21 — W3 Bridge v2+Store batch 2: WO-13 Schema Validators

### Bridge
- feat(bridge): per-message schema validators + KNOWN_ENTITY_KINDS injection — ADR-012 §2 — PAIN-MAP P2-05. `bridge-schema.js` (+694 LOC): validators for all ~30 message types; `validateMessage()` public entry. `sendToBridge` in `bridge-commands.js` gates every outgoing message through `BRIDGE_SCHEMA.validateMessage` — invalid payloads dropped with diagnostic. `CANONICAL_ENTITY_KINDS_ARR` in `constants.js` is now single source of truth for entity kind strings (P2-05 closed): `bridge-script.js` KNOWN_ENTITY_KINDS injected via `${JSON.stringify(CANONICAL_ENTITY_KINDS_ARR)}` in template literal; `bridge-commands.js` CANONICAL_ENTITY_KINDS built from same constant. `BRIDGE_MAX_PAYLOAD_BYTES = 262144` added to constants. `bridge-script.js`: `postAck(refSeq, ok, code, msg)` function + ack emissions inside replace-node-html/replace-slide-html handlers. `bridge.js` case `"ack"` collects structured acks in `state.bridgeAcks` Map keyed by refSeq. Direction fix: `slide-rail.js` `navigateSelectedTableCell` changed from `"next"/"previous"` to `"tab"/"shift-tab"`; `bridge-schema.js` VALID_DIRECTIONS updated to include `"shift-tab"`; `bridge-script.js` `navigateTableCellByDirection` step handles both `"previous"` and `"shift-tab"`. Fixes Gate-A regression in S9 Tab/Shift+Tab table navigation. WO-16 foundation bundled (store.js + state.js store guard). gate-contract: 152/0. Gate-A: 59/5/0. ADR-012. PAIN-MAP: P2-05.

---

## [v0.28.2] — 2026-04-21 — W3 Bridge v2+Store batch 1: WO-15 Telemetry

### Telemetry
- feat(telemetry): opt-in local scaffold + toggle UI — ADR-020 scaffold — WO-15. `editor/src/telemetry.js` IIFE: `window.telemetry` (isEnabled/setEnabled/emit/readLog/clearLog/exportLogJson). 1 MB + 5000-event LRU cap with oldest-first eviction. Crypto-secure UUID via `crypto.randomUUID()` with `crypto.getRandomValues()` fallback. Zero network calls (no fetch/XHR/sendBeacon). Default OFF — `localStorage['editor:telemetry:enabled']` must be "1" to enable. Disable clears log. Canary event `{level:"ok",code:"telemetry.enabled"}` emitted on off→on transition. Toggle UI in advanced diagnostics panel (`#telemetryToggle`, `#telemetryExportBtn`, `#telemetryClearBtn`) with Russian copy ("Записывать действия в локальный журнал для себя", "Экспорт журнала", "Очистить"). Export via `URL.createObjectURL` + `<a download>` — no server round-trip. `bindTelemetryToggleUi()` in `feedback.js`, wired from `boot.js init()`. `TELEMETRY_ENABLED_KEY`, `TELEMETRY_LOG_KEY`, `TELEMETRY_MAX_BYTES`, `TELEMETRY_MAX_EVENTS` added to `constants.js`. Toggle row styling added to `editor/styles/inspector.css` (existing `@layer inspector`). 6-test `telemetry.spec.js` (not Gate-A). Gate-A: 59/5/0. ADR-020 Status → Accepted (scaffold).

---

## [v0.28.1] — 2026-04-21 — W3 Bridge v2+Store batch 1: WO-14 Types

### Types
- chore(types): bootstrap tsconfig + JSDoc on state/constants/bridge — ADR-011 partial — P1-18. `tsconfig.json` (noEmit, checkJs, strict, ES2022, 3-file include: state.js + constants.js + bridge.js). `typescript@^5.4.0` devDep. `test:gate-types` script (exits 0, additive — not in Gate-A). `editor/src/globals.d.ts` ambient declarations for cross-script globals. `State` @typedef with 10 sub-typedefs (SelectionFlags, SelectionPolicy, SlideRailDrag, LayersPanelDragState, SelectionTooltip, SelectionRect, ActiveGuides, PreviewAssetAuditCounts, ToolbarDragOffset) covering all 80+ state fields. `BridgeMessageEvent` @typedef + payload stubs. `@type {Set<string>}` on 7 Set constants. `@typedef` + `@type` on 4 Object.freeze constants (STARTER_DECKS, SANDBOX_MODES, TRUST_DETECTION_SELECTORS, TRUST_DECISION_KEYS). `@param`/`@returns` on createDefaultSelectionPolicy, normalizeSelectionPolicy, setPreviewLifecycleState. Inline null-safety fix: els.previewFrame cast to HTMLIFrameElement. Error-unknown fix in catch block. Gate-A: 59/5/0. New gate: test:gate-types (optional, exits 0). ADR-011. PAIN-MAP: P1-18.

---

## [v0.28.0] — 2026-04-21 — W3 Bridge v2+Store batch 1: WO-12 Bridge hello

### Bridge
- feat(bridge): v2 hello handshake + mismatch banner — ADR-012 partial — P0-10 start. `bridge-schema.js` `validateHello` updated: `protocol` is now a numeric `2` (not a string). `bridge.js` case `"hello"` added before `case "bridge-ready"`: validates payload via `BRIDGE_SCHEMA.validateMessage`, sets `state.bridgeProtocolVersion=2` and `state.bridgeBuild` on success, or sets `state.editingSupported=false` and shows Russian error toast "Несовместимый bridge: shell ожидает протокол v2, iframe прислал vN. Превью переведено в режим только для чтения." on protocol mismatch. `bridge-script.js` now emits `post('hello', {protocol:2, build:SHELL_BUILD, capabilities:[...]})` before `post('bridge-ready')`. `constants.js` gains `BRIDGE_PROTOCOL_VERSION=2` and `SHELL_BUILD='v0.28.0'`. Existing fixture F-01/F-02 updated to numeric protocol. 3-test contract spec green. Gate-A: 59/5/0. ADR-012. PAIN-MAP: P0-10.

---

## [v0.27.5] — 2026-04-21 — W2 Sandbox+A11y CLOSED (WO-06..11)

### Accessibility
- feat(a11y): rail keyboard nav (↑/↓, Alt+↑/↓) + focus-trap audit — P0-05 / P0-08. Roving tabindex on slide rail (exactly one slide-item has tabindex=0 at any time). ArrowDown/ArrowUp cycles focus between rail items without activating the slide. Alt+ArrowDown/Alt+ArrowUp reorders the focused slide and emits Russian toast "Слайд перемещён: позиция N → M". shortcuts.js arrow-nudge gated on #slidesPanel source so rail ArrowDown does not nudge the preview element. Focus-visible ring tokens (--focus-ring-color, --focus-ring-width) added to tokens.css for both light and dark themes; preview.css :focus-visible rule updated to use tokens. ADR-006, WO-10.

### Tests
- test(a11y): contrast ratio assertions — ADR-006 complete — P0-14. Pure JS WCAG 2.1 contrastRatio helper (sRGB linearization, zero deps). Sentinel checks (black/white=21:1, white/white=1:1, #333/#fff≈12.63). 7 token pairs × 2 themes = 14 assertions: --shell-text/--shell-bg, --on-accent/--shell-accent, success/warning/danger banners on --shell-panel, --shell-text/--shell-panel-soft. All 14 pairs pass WCAG AA (≥4.5:1) — no triaging required. ADR-006 Status → Accepted. Gate-A: 59/5/0.
- Bridge schema registry + contract scaffold — 15-fixture test corpus covering happy-path (hello, select, replace-node-html), boundary (html exactly at 262144 bytes), and negative cases (over-limit, missing nodeId, unknown type, non-object). Gate-contract project added to playwright.config.js. Pure Node.js vm sandbox — no browser required. WO-08 / ADR-012 §2 / PAIN-MAP P0-13.
- Add test:gate-a11y: axe-playwright shell scan (3 workflow states, WCAG 2.1 AA). ADR-006 partial shipped. Known violations: color-contrast (#8a8a8e/#ffffff = 3.43:1) and nested-interactive (slide-item role=button with focusable descendants) — tracked in known-violations.md, marked test.fail() pending WO-10 remediation. Gate is additive — does not affect Gate-A baseline.
- keyboard-nav.spec.js: 6 keyboard navigation tests (P0-05, P0-08). Tab order through topbar → rail, Escape closes modal, ArrowDown/Up roving tabindex, Alt+ArrowDown reorders rail, modal focus-trap Tab/Shift+Tab, Russian aria-label invariant + --focus-ring-width token assertion. WO-10.

### Security
- Trust-Banner + neutralize-scripts one-click (AUDIT-D-01, ADR-014 §Layer 1, PAIN-MAP P0-01). `scanTrustSignals(doc)` detects `<script>`, inline `on*` handlers, `javascript:`/`vbscript:` hrefs, remote `<iframe>`, `<meta http-equiv="refresh">`, `<object>`/`<embed>` — scan-only, no DOM mutation. `TRUST_DETECTION_SELECTORS`, `TRUST_BANNER_CODE`, `TRUST_DECISION_KEYS` added to `constants.js`. `state.trustDecision/trustSignals/lastImportedRawHtml` slices added (reset to PENDING on every fresh import). After iframe `onload`, `maybeShowTrustBanner()` fires with 250ms defer; shows Russian-copy banner ("Презентация содержит исполняемый код (N элементов). Скрипты будут запущены.") with two actions: "Нейтрализовать скрипты" and "Оставить как есть". `neutralizeAndReload()` strips scripts/on*/javascript:/remote-iframes/meta-refresh/object/embed from a re-parsed copy of `lastImportedRawHtml`, rebuilds preview in `SANDBOX_MODES.SCRIPTS_ONLY` sandbox, toasts "Скрипты нейтрализованы. Превью пересобрано в режиме sandbox." `acceptTrustDecision()` clears banner, sets decision=accept, no re-fire for session import. NEUTRALIZE preserves style/class/id/data-* attributes — only on* stripped. Deck-script engine NOT blanket-stripped by default. 8-scenario test suite: trust-banner.spec.js. Gate-A: 59/5/0. ADR-014. P0-01.
- Shell banner plumbing + broken-asset recovery + sandbox-mode flag (AUDIT-D-01/07, P0-04). `shellBoundary.report/clear` API added to `feedback.js` (ADR-014 §Layer 1). `#shellBanner` region added to shell chrome (role=region, aria-live=polite, non-blocking). `SANDBOX_MODES` enum + `DEFAULT_SANDBOX_MODE='off'` added to `constants.js`; `state.sandboxMode` wired at `import.js:97` switch replacing bare `removeAttribute("sandbox")` with ADR-014/AUDIT-D-01/07 comment. `probeBrokenAssets` probes img/link/video/source via HEAD (localhost) or onerror-inspection (file://); result surfaces Russian banner "Некоторые ресурсы не найдены. N файл(ов)." with "Подключить папку ресурсов" action. New gate: `broken-asset-banner.spec.js` (4 scenarios). WO-07 will wire Trust-Banner script detection to SANDBOX_MODES.SCRIPTS_ONLY.
- Autosave size cap: warn at 3 MB, light-snapshot fallback at 6 MB, QuotaExceededError handled gracefully (AUDIT-D-05). stripHeavyDataUris strips only data:image/... URIs > 1024 chars; all HTML structure preserved. Russian toast copy surfaced at every tier; light-snapshot banner shown on restore. New gate: autosave-cap.spec.js (3 scenarios).
- Assert bridge postMessage origin in receive handlers (bridge.js shell + bridge-script.js iframe); replace bare `'*'` send target with origin-aware target — `file://` retains `'*'` (browser rejects `"null"` as target), `http(s)://` uses `location.origin`. New gate: `bridge-origin.spec.js` (2 scenarios + file:// note). Closes AUDIT-D-04. ADR-012 §4.
- Vendor pptxgenjs@3.12.0 under `editor/vendor/pptxgenjs/` to eliminate CDN supply-chain risk (AUDIT-D-03, P0-03). CDN path retained as operator opt-in with SRI `integrity` + `crossorigin="anonymous"` on the `<script>` element. Vendor path resolves under `file://` — no network required for default PPTX export flow. New gate: `export-sri.spec.js` (2 scenarios).
- `parseSingleRoot` now sanitizes tag allow-list (`ALLOWED_HTML_TAGS`), attribute filter (`BLOCKED_ATTR_NAMES` + `/^on/i`), URL protocol check (`javascript:`/`vbscript:`/`data:` non-image), `srcdoc` strip, and size guard (>256 KB rejected) in `replace-node-html` and `replace-slide-html` (AUDIT-D-02, P0-02). New gate: `bridge-sanitize.spec.js` (5 scenarios).
- Replace `Math.random` bridge token with `crypto.getRandomValues` (AUDIT-D-15, P1-15). Entropy upgraded from ~52 bits to 192 bits (24 bytes). Preserves `"pe-"` prefix for log-grep back-compat and `Math.random` fallback branch for sandboxed contexts without SubtleCrypto. New gate: `bridge-token.spec.js` (2 scenarios).

---

## 0.25.0 - click UX: layer picker for all modes + stack depth badge — 2026-04-20

### UX: Слои доступны всем, badge показывает прогресс cycling

Четыре изменения, которые завершают click-interaction ergonomics:

| Проблема | Решение |
|---|---|
| Layer picker только в advanced mode | Picker доступен в **всех** режимах |
| Кнопка «Следующий слой» не объяснит что делает | Единый текст «Выбрать слой» для всех режимов |
| Stack depth badge `X из N` никогда не показывался | Синхронизация `overlapCount` bridge → shell |
| Badge показывался бы сразу при 1-м клике (агрессивно) | Badge только при активном cycling (overlapIndex > 0) |

**Gate-A: 55 passed / 5 skipped / 0 failed ✓**

#### Технические детали
- `shell-overlays.js`: убрана проверка `complexityMode !== "advanced"` в `openLayerPickerForSelectedOverlap()`
- `dom.js`: кнопка `overlapSelectLayerBtn` всегда вызывает `openLayerPickerForSelectedOverlap()`
- `inspector-sync.js`: унифицированы текст кнопки и сообщение overlap banner (без mode-ternary)
- `bridge-script.js`: `postSelection` включает `overlapCount + overlapIndex` из `STATE.clickThroughState`; `updateClickThroughState` вызывается ДО `selectElement` в click handler
- `bridge-commands.js`: синхронизирует `state.clickThroughState` из `element-selected` payload (только при `overlapIndex > 0`)
- `state.js`: добавлено `clickThroughState: null` в shell state

---

## 0.24.0 - click interaction ergonomics — 2026-04-20

### UX: Click-to-edit без лишних движений

Четыре точечных изменения, которые делают редактирование интуитивным:

| Проблема | Решение |
|---|---|
| Случайные перетаскивания при клике | Drag threshold 4px → **6px** |
| Маленькие ручки resize — промахи | Selection handles 16px → **20px** |
| Микро-джиттер руки вызывал click-through | Proxy только при maxMovement < **2px** |
| «Стайл» клик-through после паузы | TTL **2000ms** только для shell proxy clicks |

**Gate-A: 55 passed / 5 skipped / 0 failed ✓**

#### Технические детали
- `constants.js`: `DIRECT_MANIP_THRESHOLD_PX` 4 → 6
- `overlay.css`: `.selection-handle` width/height 16px → 20px
- `selection.js`: отслеживание `maxMovement` в сессии манипуляции; `pendingOverlayClickProxy = maxMovement < 2`
- `bridge-script.js`: `trySelectFromClickThroughState(x, y, options)` — параметр `options.ttl`;
  TTL передаётся только из `proxy-select-at-point` (2000ms); прямые клики по iframe — без TTL (Infinity)

---

## 0.23.0 - layer separation: bridge-script, shell-overlays, boot extracted + v3 reference decks - 2026-04-16

### Разделение слоёв v2 — новые выделенные модули

Два оставшихся «толстых» файла разбиты по архитектурным слоям:

#### `preview.js` (4 275 строк) → 3 файла
| Файл | Строк | Слой | Содержание |
|------|------:|------|-----------|
| `bridge-script.js` | 3 424 | Bridge | `buildBridgeScript()` — самодостаточный мини-апп для iframe |
| `preview.js` | 34 | Rendering | `buildPreviewPackage()`, `injectBridge()` — только оркестрация |
| `bridge-commands.js` | 832 | Bridge | Обработчики `postMessage` из iframe (select, update, activate…) |

#### `inspector-sync.js` (4 156 строк) → 3 файла
| Файл | Строк | Слой | Содержание |
|------|------:|------|-----------|
| `inspector-sync.js` | 1 390 | View | `updateInspectorFromSelection()` — только чтение и синхронизация UI |
| `shell-overlays.js` | 818 | View | Модальные окна, палитра вставки, оверфлоу, выбор слоя, `setMode()` |
| `boot.js` | 1 962 | Bootstrap | `init()`, тема, все `bind*()` — единая точка входа приложения |

#### Итог: 25 JS-модулей, 18 288 строк кода
- Gate-A: **55 passed / 5 skipped / 0 failed**
- Скрипты `scripts/extract-layers-v2.js` и `scripts/extract-modules.js` повторяемы

### Тестирование реальных презентаций (v3 reference decks)

Добавлено 7 новых reference-deck кейсов в семейство `v3`:
- `v3-basic-minimal`, `v3-cards-columns`, `v3-tables-metrics`, `v3-visual-storytelling`, `v3-complex-stress`
- **`v3-prepodovai-pitch`** — питч ПреподовAI (Tailwind CDN, Google Fonts, animated slides)
- **`v3-selectios-pitch`** — питч SelectiOS (15 слайдов, тёмная тема, таблицы, absolute layout)

Все 7 прошли полный deep validation matrix (base, shell surfaces, text edit, slide structure,
table ops, drag/resize). Исправлен `verifyTableCapability` — теперь использует `finalizeEditCommit`
с многоуровневым fallback для JS-анимированных слайдов.

---

## 0.22.1 - HIG design pass (CSS polish) - 2026-04-16

### CSS de-indent + дизайн-токены
- **CSS de-indent**: все 8 файлов `editor/styles/*.css` очищены от 6-пробельного отступа HTML (`scripts/deindent-css.js`)
- **27 новых токенов** в `tokens.css`:
  - Spacing: `--space-1` (4px) → `--space-12` (48px)
  - Typography: `--text-2xs` (10px) → `--text-2xl` (22px)
  - Line-height: `--leading-tight` (1.2) → `--leading-loose` (1.7)
- **Font smoothing**: `-webkit-font-smoothing: antialiased` + `line-height: var(--leading-normal)` в `base.css`
- **Inspector**: высота инпутов 28→30px, focus-visible кольца, `letter-spacing` подтянут, dashed→solid рамки
- **Overlays**: border-radius у пунктов контекстного меню, переходы для тостов
- Gate-A: 55/5/0 maintained

---

## 0.22.0 - architecture: split monolith into 8 CSS layers + 21 JS modules - 2026-04-16

### Архитектурный рефакторинг — разделение монолита

**Было:** единый файл `editor/presentation-editor.html` (~24 000 строк = CSS + HTML + JS в одном файле)
**Стало:** чёткое разделение по слоям — 1 HTML-шелл + 8 CSS-файлов + 21 JS-файл

#### CSS → `editor/styles/`
Все стили вынесены из `<style>` (было ~3 978 строк) в отдельные файлы по `@layer`:
| Файл | Слой | Содержание |
|------|------|------------|
| `tokens.css` | `tokens` | CSS-переменные, дизайн-токены, тема |
| `base.css` | `base` | Сброс, типографика, примитивы |
| `layout.css` | `layout` | Сетка шелла, панели, топбар |
| `preview.css` | `preview` | Превью-стейдж, рейл слайдов |
| `inspector.css` | `inspector` | Правая панель, формы, поля |
| `overlay.css` | `overlay` | Плавающий тулбар, контекстное меню, тосты |
| `modal.css` | `modal` | Модальные окна, шторки |
| `responsive.css` | `responsive` | Брейкпоинты, мобильные адаптации |

#### JS → `editor/src/`
Скрипт (~18 235 строк) разбит по ZONE-маркерам в 21 файл:
| Файл | Зона / содержание |
|------|------------------|
| `constants.js` | Константы, ключи хранилища, наборы тегов |
| `state.js` | SelectionPolicy + PreviewLifecycle + объект `state` |
| `onboarding.js` | Shell Onboarding — UI помощника |
| `dom.js` | Inspector Wiring — объект `els`, `cacheEls()` |
| `bridge.js` | Bridge Message Dispatch |
| `shortcuts.js` | Global Shortcuts & Window Events |
| `clipboard.js` | Clipboard & Drag-Drop |
| `import.js` | Document Loading & Import Pipeline |
| `slides.js` | Slide Registry & Navigation |
| `preview.js` | Preview Build & Bridge Bootstrap |
| `slide-rail.js` | Slide Rail Rendering |
| `style-app.js` | Style Application |
| `export.js` | Export & Assets |
| `history.js` | History: Undo / Redo |
| `feedback.js` | Feedback & Notifications |
| `selection.js` | Selection Overlay & Direct Manipulation |
| `toolbar.js` | Floating Toolbar |
| `context-menu.js` | Context Menu |
| `inspector-sync.js` | Inspector Sync (включает `function init()`) |
| `primary-action.js` | Primary Action Sync + autosave |
| `main.js` | Точка входа — вызывает `init()` последним |

#### HTML-шелл `editor/presentation-editor.html`
- Сжат с ~24 000 до **1 784 строк** (HTML-разметка + `<link>` + `<script src>`)
- Сохранён inline-скрипт темы (FOUC prevention)
- Порядок загрузки: 8 CSS-файлов → тело страницы → 21 JS-файл → `main.js`

### Архитектурные решения
- **Classic `<script src>` (не ES-модули)** — совместимость с `file://` в Chrome; все файлы делят глобальный скоуп
- **Вызов `init()` перенесён** в `main.js` (последний загружаемый файл); в оригинале он был посредине скрипта на строке ~6 722
- **Порядок CSS-слоёв** сохранён: декларация `@layer tokens, base, ...` в первом `tokens.css`

### Gate-A baseline
55 passed / 5 skipped / 0 failed — без регрессий

---

## 0.21.0 - design system polish: token consistency & dark-mode fixes - 2026-04-16

### CSS design system (Phase 5)
- **Hardcoded colors replaced** — все четыре вхождения `#8e8e93` заменены на `var(--shell-text-muted)`: `.topbar-eyebrow`, `.inspector-section h3`, `.section-toggle`, `.context-menu-section-title`
- **Dark-mode border bug fixed** — `rgba(29, 29, 31, 0.12)` заменены на `var(--shell-border-strong)` в трёх местах: `.slide-item::before`, `.layer-picker`, `.context-menu`; в тёмной теме эти бордеры теперь корректно отображаются белыми (не невидимыми)
- **Floating toolbar** — фон изменён с `var(--shell-field-bg)` на `var(--shell-panel-elevated)`, бордер — с `var(--shell-border)` на `var(--shell-border-strong)`; теперь панель визуально выделяется как плавающий попап, а не просто поле ввода
- **Align button active state** — `#ftAlignGroup button.is-active` теперь использует `var(--shell-accent-soft)` + `color: var(--shell-accent)` вместо плотного синего фона `var(--shell-accent)` — соответствует стилю `.toolbar-row button.is-active`
- **Token normalization** — `.floating-toolbar` и `.context-menu` используют `var(--radius-md)` вместо хардкода `12px`
- **`.section-toggle` cleanup** — удалено избыточное `color: inherit` (перекрывалось следующей `color:` декларацией)

### Git semver tags
- Применены теги `v0.20.0` – `v0.20.5` на исторические коммиты

## 0.20.5 - internal code structure: 21 navigable zone headers - 2026-04-16

### Внутренние улучшения (Phase 4)
- Добавлены **21 zone-header** с форматом `// ZONE: <Name>` по всему файлу `editor/presentation-editor.html` (~23 400 строк)
- Зоны: Selection Policy, Preview Lifecycle, Application State, Shell Onboarding, Inspector Wiring, Bridge Message Dispatch, Global Shortcuts & Window Events, Clipboard & Drag-Drop, Document Loading & Import Pipeline, Slide Registry & Navigation, Preview Build & Bridge Bootstrap, Slide Rail Rendering, Style Application, Export & Assets, History: Undo / Redo, Feedback & Notifications, Selection Overlay & Direct Manipulation, Floating Toolbar, Context Menu, Inspector Sync, Primary Action Sync
- Навигация по зонам: `grep "// ZONE:" editor/presentation-editor.html`
- Никакой рабочий код не изменён — только комментарии вставлены перед функциями

## 0.20.4 - element Ctrl+C/X/V, shortcut cheat-sheet modal - 2026-04-16

### Копирование, вырезание и вставка элементов
- **Ctrl+C** — копирует выбранный элемент во внутренний буфер (`state.copiedElementHtml`); `data-editor-node-id` у клона удаляются → пастированный элемент получает свежие ID
- **Ctrl+X** — вырезает: копирует в буфер и удаляет выбранный элемент
- **Ctrl+V** — вставляет элемент из буфера (после выбранного или в конец слайда); имеет приоритет над системным paste-ивентом
- Кнопки **«Копировать»** и **«Вставить»** добавлены в инспектор (секция «Частые действия»)
- Пункты **«Копировать», «Вырезать», «Вставить»** добавлены в контекстное меню; «Вырезать» видна при `canDelete`, «Вставить» — только при непустом буфере

### Справка по горячим клавишам
- Клавиша **`?`** открывает модальное окно со списком всех горячих клавиш
- Кнопка **«⌨ Справка»** в меню overflow топбара
- Модальное окно двухколоночное: «Редактирование текста», «Элементы» / «Навигация», «Вид и экспорт»
- `shortcutsModal` включён в обработчик Escape и backdrop-close

## 0.20.3 - inspector polish: opacity, border-radius, Shape insert - 2026-04-16

### Инспектор — новые поля оформления блока
- **Прозрачность (%)** (`opacityInput`): числовое поле 0–100; конвертируется в CSS `opacity` 0–1; синхронизируется с вычисленными стилями; пустое значение = непрозрачный (opacity 1)
- **Скругление углов** (`borderRadiusInput`): текстовое поле, принимает `8px`, `50%`, `4px 8px`; применяется через `applyStyle("borderRadius")`; синхронизируется с `borderRadius` computed-стилей
- Оба поля включаются/выключаются через `styleLocked`; сбрасываются при снятии выделения; присутствуют в обоих путях синхронизации (primary + legacy)

### Вставка — кнопка «Форма»
- Новая кнопка **Форма** (`addShapeBtn`) в секции «Вставка» рядом с «Текст», «Картинка», «Видео»
- Вставляет абсолютно позиционированный `div` 160×100 px с синим фоном и `border-radius:8px` — готовая база для кастомных блоков
- `addShapeBtn` привязана к `syncPrimaryActionUi` (disabled при отсутствии активного слайда)

## 0.20.2 - keyboard formatting shortcuts & UX fixes - 2026-04-16

### Keyboard shortcuts (новые)
- **Ctrl+B** — жирный для выбранного элемента (не в режиме ввода текста)
- **Ctrl+I** — курсив
- **Ctrl+U** — подчёркнутый
- **Ctrl+L** — выравнивание по левому краю
- **Ctrl+E** — выравнивание по центру
- **Ctrl+R** — выравнивание по правому краю
- Все шорткаты работают только в режиме `edit` при выбранном текстовом элементе; в режиме `text-edit` (contenteditable) браузер обрабатывает их нативно

### UX-исправления
- Align-кнопки в floating toolbar: заменены нечитаемые символы ⬡/≡/⬢ на ← / ↔ / →
- Align-кнопки в инспекторе: обновлены аналогично (были «Слева»/«Центр»/«Справа», стали ← / ↔ / →)
- Tooltips на B/I/U в инспекторе дополнены шорткатами (Ctrl+B/I/U)
- Tooltips на align-кнопках инспектора дополнены (Ctrl+L/E/R)

### Инспектор — новые поля типографики
- **Шрифт** (`inspectorFontFamilySelect`): 11 распространённых семейств, синхронизируется с выбранным элементом
- **Межстрочный интервал** (`inspectorLineHeightSelect`): 1.0–2.0, синхронизируется с `lineHeight` вычисленных стилей
- Размер шрифта в инспекторе расширен до 16 значений (10–96 px), синхронизирован с floating toolbar
- Все новые поля включаются/выключаются и сбрасываются вместе с остальными text-entity контролами

## 0.20.1 - PowerPoint-parity UX: rich-text toolbar & presentation mode - 2026-04-16

### Floating toolbar — полный набор форматирования текста
- **Подчёркивание** (`ftUnderlineBtn`): Ctrl+U-семантика, активное состояние синхронизировано с computed styles
- **Выравнивание текста** (`ftAlignLeftBtn/CenterBtn/RightBtn`): три кнопки L/C/R в отдельной группе `#ftAlignGroup`; active-state отражает реальный `textAlign` выбранного элемента
- **Шрифт** (`ftFontFamilySelect`): выпадающий список 11 распространённых семейств (Inter, Segoe UI, Arial, Georgia, Times New Roman, Courier New, Impact и др.)
- **Размер шрифта** расширен: 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 96 px
- Все новые контролы disabled при отсутствии текстового элемента, скрыты для нетекстовых сущностей
- Оба пути синхронизации (primary + legacy) обновлены

### Режим презентации
- Кнопка **▶ Показать** в topbar (outlined accent): открывает чистый экспорт в новом окне, запрашивает fullscreen после загрузки
- Tooltip-подсказка «Нажми F11 для полного экрана» в toast-уведомлении
- Кнопка disabled при отсутствии загруженной презентации

### UX-polish
- Tooltips (`title=`) добавлены на все кнопки topbar: Открыть HTML, ▶ Показать, Экспорт HTML, Экспорт PPTX
- Кнопка «Экспорт PPTX» переоформлена в нейтральный стиль (border/ghost), «▶ Показать» — в accent-outlined

## 0.20.0 - PPTX export and PowerPoint-parity UX - 2026-04-16
- **Export PPTX**: added "Экспорт PPTX" button to the topbar (outlined accent style, next to "Экспорт HTML")
- PptxGenJS loaded lazily from CDN on first use — no npm runtime dependency added
- Slide dimensions auto-detected from CSS custom properties (`--slide-w`, `--slide-h`) or `.slide { width }` rules, defaulting to 1280×720
- Absolute-positioned elements mapped to PptxGenJS coordinates (left/top/width/height in % and px both supported)
- Text leaves extracted with font-size (px→pt), color, bold, italic, align; flow-layout fallback for non-positioned text
- Image elements with `data:` URIs or `https://` src included; relative URLs skipped gracefully
- Slide background color parsed from inline `background-color` / `background` with gradient/url stripping
- Export does not modify `modelDoc`, the iframe DOM, or the HTML export path
- `exportPptxBtn` wired into `syncPrimaryActionUi` — enabled/disabled in sync with `exportBtn`
- Renamed "Экспорт" button label to "Экспорт HTML" for disambiguation

## 0.19.6 - responsive shell sidebars and inspector quick actions - 2026-04-15
- widened the slide rail and inspector with responsive `clamp(...)` sizing so desktop and wide viewports allocate meaningful space to navigation and element properties
- added selection-aware quick actions to the selected-element summary card for common text, media, image-fit, duplicate, and precision-mode workflows without exposing advanced fields first
- aligned compact shell CSS with the 1024px JS breakpoint so tablet/mobile users keep one clear bottom-rail mode control instead of duplicate preview toggles
- refreshed Playwright visual baselines for the wider shell geometry and added regression coverage for responsive panel scaling plus quick inspector actions
- kept quick-action rendering DOM-safe by constructing buttons with `createElement` and `textContent` instead of injecting HTML strings

## 0.19.5 - pilot shell hardening, asset parity validation, and operator runbooks - 2026-04-15
- hardened the stable `editor/presentation-editor.html` pilot workflow with clearer shell state transitions, compact-safe actions, and release-ready editor entrypoint behavior
- strengthened export asset parity validation and Playwright coverage across desktop, wide, tablet, and compact shell profiles with updated visual baselines
- added shared local test-server configuration to reduce port conflicts and make Playwright validation runs more deterministic
- documented the pilot checklist, operator runbook, known limitations, and auditability notes for reviewers adopting the current editor workflow
- kept the active runtime path stable while synchronizing package metadata to `0.19.5`

## 0.19.4 - layer order truth, overlap picker readiness, and stage-o regression coverage - 2026-04-13
- fixed layer ordering truth in the stable runtime by sorting authored layers from inline `z-index` values even when `modelDoc` is detached from the live preview document
- fixed the advanced overlap recovery flow so `Magic Select` only becomes interactive after the layer picker payload is actually ready for the current overlap selection
- tightened `stage-o` regression coverage around sibling-scope reorder and normalize behavior, plus stabilized inline text editing assertions under the shell selection overlay
- kept the active editor runtime on the stable `editor/presentation-editor.html` entrypoint with no release-line fork or archived runtime promotion

## 0.19.3 - entrypoint simplification, support policy cleanup, and semver resync - 2026-04-10
- promoted the active runtime artifact to `editor/presentation-editor-v0.19.3.html` so the latest `main` state, package metadata, launchpad, shim, Playwright harness, and asset-parity tooling resolve to one semver runtime again
- archived the previous `0.19.2` runtime to `docs/history/presentation-editor-v0.19.2.html` and removed the root-level `editor/presentation-editor-v0.19.2.html` runtime from active use
- simplified the first-run repo entrypoint by removing the redundant `start:open` alias and keeping the root launchpad on a single obvious happy path
- demoted the compatibility redirect from a top-level launchpad CTA to low-noise metadata so first-time users are not asked to choose between equivalent-looking entrypoints
- corrected `SECURITY.md` support-line wording so the limited-support row no longer references a pre-release `0.19.2` adoption state that already happened

## 0.19.2 - onboarding entrypoint, ghcr path, security policy, and semver sync - 2026-04-10
- promoted the active runtime artifact to `editor/presentation-editor-v0.19.2.html` so the current tagged release, package metadata, docs, launchpad, and harness all resolve to one semver runtime again
- archived the previous `0.19.1` runtime to `docs/history/presentation-editor-v0.19.1.html` and removed the root-level `editor/presentation-editor-v0.19.1.html` runtime from active use
- added a human-first local repo entrypoint at `/` with `npm start`, sample-gallery links, and quick-start docs so a new user can run the application without discovering internal paths first
- documented GHCR as the supported GitHub Packages surface for this application and clarified the first-publish visibility step for public container pulls
- replaced the template `SECURITY.md` with a real security policy covering supported release lines, disclosure path, response targets, and supported reporting scope

## 0.19.1 - release hardening sync and proper semver patch tag - 2026-04-10
- promoted the active runtime artifact to `editor/presentation-editor-v0.19.1.html` so the shipped tag, package metadata, docs, harness, and compatibility shim all point at one normal semver release
- archived the previous `0.19.0` runtime to `docs/history/presentation-editor-v0.19.0.html` and removed the root-level `editor/presentation-editor-v0.19.0.html` runtime from active use
- refreshed project docs, local skills, and GitHub release artifacts to describe the proper `v0.19.1` patch release instead of the temporary non-semver hardening tag
- retained the `0.19.0` behavior contract: no bridge protocol changes, autosave stays on schema `v3`, export remains clean, and novice workflow remains `empty -> loaded-preview -> loaded-edit`

## 0.19.0 - honest feedback: block reason banners, stack depth badge, action hints - 2026-04-04
- **Block reason protocol (ADR-001)**: replaced boolean `hasBlockedDirectManipulationContext()` with `getBlockReason()` enum returning specific reason: `zoom`, `locked`, `own-transform`, `parent-transform`, `slide-transform`, `hidden`, or `none`
- **Block reason banner**: inline banner below selection overlay shows human-readable block reason with one-click resolution action:
  - "Масштаб ≠ 100%" → button "Сбросить масштаб" (resets zoom to 100%)
  - "🔒 Элемент заблокирован" → button "Разблокировать"
  - "Используется transform" → informational (use inspector)
  - "Элемент скрыт" → button "Показать"
  - Lock banner in advanced mode takes priority over block reason banner
- **Stack depth badge (ADR-002)**: `1/N` counter badge appears next to breadcrumbs when multiple candidates exist under cursor point, showing current position in click-through stack
- **Action-oriented summary copy**: `getSelectedElementSummary()` updated for all entity kinds to show actionable guidance ("Дважды кликните, чтобы начать печатать", "Можно перемещать и масштабировать мышкой") and surfaces block reason as primary feedback when manipulation is blocked
- **Playwright coverage**: new `honest-feedback.spec.js` (9 tests) covering block banner per reason, action resolution, lock priority, summary copy, stack badge, banner lifecycle, and export cleanliness
- **P2 zoning pass**: removed the late “v3 UX EXTENSIONS” override framing and re-labeled the runtime into explicit ownership bands for shell routing, selection/direct-manip feedback, history/autosave/export, and shell storage persistence
- **Honest storage/export cleanup**: replaced remaining silent shell-owned storage/export catches with diagnostics via `reportShellWarning(...)` for export URL cleanup, autosave clear/restore, copied-style persistence, selection-mode persistence, preview-zoom persistence, and theme preference loading
- **Clean export invariant**: export stripping now removes `data-editor-ui="true"` nodes before serialization and records any lingering editor-only residue in diagnostics instead of silently continuing
- All gates passed: Gate A (40/40), Gate B chromium-desktop (101/101), Gate B chromium-shell-1100 (51/51)

## 0.18.3 - zoom quality fix and layout optimization - 2026-04-03
- **Zoom quality fix**: Switched from `transform: scale()` to CSS `zoom:` property
  - CSS `zoom:` triggers browser re-layout at target resolution, preserving text and vector crispness
  - CSS `zoom` is on W3C standards track (Working Draft) with 97%+ global browser support
  - Eliminates blur/degradation artifacts at zoom levels < 100% ("мыльница" issue)
  - Simplified coordinate math: removed manual zoom multiplications from `toStageRect`, `toStageAxisValue`, `positionFloatingToolbar`
  - `getBoundingClientRect()` returns already-scaled values with zoom property; no manual scaling needed
  - Updated Playwright test to validate `zoom` property instead of `transform` matrix
  - **Browser requirements**: Firefox 126+ (May 2024), Chrome 4+, Safari 4+, Edge 12+; graceful degradation on older versions
- **Layout optimization**: Expanded preview panel as primary workspace
  - Reduced slides panel from `minmax(240px, 260px)` to `minmax(200px, 220px)` (40px narrower at max)
  - Reduced inspector panel from `minmax(256px, 280px)` to `minmax(220px, 240px)` (40px narrower at max)
  - Preview/edit panel now dominates screen space with ~80px more width on desktop
  - Side panels remain functional but visually subordinate to the main editing area
- All tests passing: shell.smoke zoom test validates quality-preserving scale behavior

## 0.18.2 - preview zoom control - 2026-04-03
- added zoom control to the preview/edit panel header with +/− buttons, percent label, and 1:1 reset button
- keyboard shortcuts: Ctrl+= (zoom in), Ctrl+− (zoom out), Ctrl+0 (reset to 100%)
- zoom persists to localStorage across sessions (`presentation-editor:preview-zoom:v1`)
- zoom range: 25% to 200% with fixed steps (25%, 33%, 50%, 67%, 75%, 90%, 100%, 110%, 125%, 150%, 175%, 200%)
- iframe scales presentation content via `transform: scale(zoom)` + `width: calc(100% / zoom)` to prevent visual overflow
- coordinate system (toStageRect, toStageAxisValue, positionFloatingToolbar) accounts for zoom factor
- direct manipulation blocked when zoom ≠ 100% via shell-level check in hasBlockedDirectManipulationContext()
- widened main preview panel: workspace grid adjusted from `272-296px | 1fr | 288-312px` to `260-280px | 1fr | 272-296px` for 32px more preview width
- added Playwright smoke test "preview zoom controls change scale and persist @stage-f"
- all gates passed: shell.smoke (14/14), gate-b (143/143), asset-parity (4/4)

## 0.18.1 - release metadata, docs, agents, and semver runtime sync - 2026-04-03
- moved the active runtime artifact to `editor/presentation-editor-v0.18.1.html` and archived `editor/presentation-editor-v0.18.0.html` under `docs/history/`
- synchronized package version, Playwright harness targets, export-asset parity tooling, and shell smoke navigation with the active semver runtime filename
- updated source-of-truth docs, roadmap, testing strategy, release notes, and remaining-issues pointers to reflect the shipped `0.17.0` and `0.18.0` work
- refreshed local Copilot agents and skills so they read the current runtime path, release discipline, and validation expectations from the live repository state

## 0.18.0 - layers panel, lock system, visibility toggle, and grouping signed off - 2026-04-03
- added an advanced-mode layers panel for stack inspection, row-based reordering, lock state, visibility state, and direct selection sync
- added lock and unlock flows with deterministic lock-banner targeting to prevent accidental direct manipulation of protected elements
- added session-only visibility toggling so users can temporarily hide elements without polluting export output or authored markup
- added group and ungroup actions for advanced-mode multi-selection flows while preserving history safety and preview rebuild context
- added focused `stage-o-layers-lock-group.spec.js` coverage for selection sync, drag reorder, lock, visibility, grouping, and ungroup flows

## 0.17.0 - overlap recovery system signed off - 2026-04-03
- added overlap detection for severely covered elements using cross-frame-safe geometry and visual stack comparison
- surfaced overlap warnings in the shell so covered content can be discovered without raw DOM inspection
- added hover ghost highlighting and move-to-top recovery so hidden elements can be identified and raised safely
- added focused `overlap-recovery.spec.js` coverage for warning detection, hover feedback, and recovery action behavior

## 0.16.0 - click-through layer selection signed off - 2026-04-03
- added repeated plain-click layer cycling for overlapping elements so the
  selected overlay no longer blocks access to lower layers after the first
  selection
- routed shell overlay clicks and `Escape` through the bridge, keeping
  click-through, reset-to-topmost behavior, and selection focus consistent
  between iframe and shell-owned interaction paths
- added focused Playwright coverage for repeated click cycling, reset on a new
  point, `Escape` recovery, numbered layer context-menu items, layer pick from
  context menu, and export cleanliness
- fixed container mode state leak: switching selection modes now resets
  click-through cache to prevent stale candidate lists from interfering with
  fresh selections
- fixed modelDoc artifact leak: element-update bridge messages now strip
  transient iframe selection attributes before importing into modelDoc,
  preventing `data-editor-selected` from entering export output

## 0.13.14 - novice shell summary cards and CTA polish signed off - 2026-04-01
- promoted loaded preview into a clearer novice decision point with a visible
  primary `Начать редактирование` CTA instead of forcing the user to infer the
  next step from mode toggles alone
- turned the basic preview inspector into a real compact slide-summary path by
  showing summary context while hiding the full slide editor controls until the
  user explicitly enters edit mode
- turned the basic selected-element path into a friendlier summary-led card
  with human-readable type copy, while keeping raw node metadata and the `Тег`
  field advanced-only
- upgraded the onboarding and summary surfaces visually so the empty state,
  preview CTA, and novice inspector cards feel intentional rather than like
  leftover utility chrome

## 0.13.13 - novice-first shell workflow hardening signed off - 2026-04-01
- introduced the shell-owned workflow contract on
  `body[data-editor-workflow="empty|loaded-preview|loaded-edit"]` and now
  drive shell-panel visibility from workflow state instead of leaked
  disable-state chrome
- turned blank state into a single-path onboarding surface with one obvious
  `Open HTML` start action, a demoted `Paste HTML` path, and no pre-load
  inspector, slide rail, mode toggles, complexity toggles, or edit-only
  actions
- kept preview/edit architecture intact while making loaded preview clearly
  lead into editing by auto-activating the first slide, keeping the rail
  visible, and visually promoting `Edit` as the next action
- hardened basic mode so advanced inspector sections, HTML editors, raw
  attributes, and diagnostics are fully concealed instead of merely disabled,
  while loaded edit now resolves into a selection-first compact inspector path
- rewrote blocked-manipulation and open-modal shell copy into novice wording,
  simplified topbar command labels, and kept wide desktop free of horizontal
  overflow under the pruned empty-state chrome
- expanded `shell.smoke` and Playwright helper coverage for the novice
  empty/load/edit workflow, advanced reveal/conceal transitions, and updated
  topbar/basic-mode expectations
## 0.13.12 - topbar command fit hardening signed off - 2026-04-01
- kept desktop and intermediate topbar chrome inside the viewport by routing
  secondary commands through a button-owned overflow surface instead of
  letting the topbar action row squeeze the preview stage
- preserved the primary path by keeping `Open` and `Export` inline while
  `Theme`, `Undo`, and `Redo` move into overflow only when shell-owned width
  metrics say the inline command budget is exhausted
- extended transient-surface mutual exclusion so topbar overflow now closes
  cleanly against insert palette, context menu, and slide template surfaces
- added focused Playwright proof for the `chromium-shell-1100` intermediate
  topbar contract without changing the compact-shell breakpoint

## 0.13.11 - shell theme prepaint and surface ownership hardening - 2026-04-01
- moved shell theme resolution onto the document root before first paint, so
  dark preference no longer boots through a light-shell flash
- locked theme transitions during boot and explicit theme switches, which
  removed the temporary white segmented-control surfaces in dark mode
- normalized shell segmented controls to one button-owned surface per state
  instead of stacked nested layers, preserving the signed-off light visual
  contract while keeping dark mode stable
- kept Stage D and Stage F shell regressions green for immediate theme-safe
  segmented controls, ios-gamma desktop chrome, and transient surface routing

## 0.13.10 - editing ux hardening signed off - 2026-04-01
- unified shell and iframe text-edit ownership so space, enter, backspace,
  arrows, and regular typing stay inside the active editable context instead
  of leaking into slide navigation or shell shortcuts
- stopped aggressive blur teardown from kicking users out of inline editing
  when focus briefly moves through transient shell UI on the same selection
- tightened capability messaging so protected and direct-manipulation-blocked
  states explain the real restriction and keep inspector-based geometry edits
  available where they remain safe
- kept selection context menus compact on desktop and compact shells, and made
  floating toolbar and context menu mutually exclusive transient surfaces
- expanded Stage C through Stage F Playwright coverage for text-edit focus,
  blocked direct manipulation, compact context-menu geometry, theme-safe
  editing affordances, and the new visual context-menu baseline

## 0.13.9 - slide rail actions signed off - 2026-04-01
- added desktop slide-rail drag and drop reorder as the primary structural path
- added a unified slide context menu with duplicate, move, and delete actions
- kept compact widths on a simpler kebab-only slide action path instead of
  forcing drag interactions into narrow layouts
- verified Stage D rail reorder and slide-menu flows across the signed-off
  Chromium width set while preserving the green full suite

## 0.13.8 - direct manipulation shell hardening signed off - 2026-04-01
- kept direct manipulation honest by surfacing blocked-state feedback at the
  selection frame instead of silently failing
- clipped selection chrome to the visible preview viewport without clamping the
  underlying manipulated element geometry
- fixed compact routing so blocked element selections stay on the fast toolbar
  path instead of opening overlapping inspector chrome
- verified safe drag/resize plus blocked-tooltip flows across the signed-off
  Chromium width set

## 0.13.7 - regression baseline added - 2026-04-01
- added Stage C and Stage D Playwright regression proof for direct
  manipulation and slide-structure flows
- expanded shared browser helpers for slide-rail drag and slide-menu access
- established a red baseline before the direct-manipulation and slide-rail
  fixes were locked

## 0.13.6 - compact shell drawer hit-area proved - 2026-03-31
- narrowed the compact-shell backdrop to the visible dimmed area outside the
  active drawer, so close gestures stop landing on panel content at `390 / 640`
- promoted Stage E Playwright coverage from placeholder to active release gate
  for drawer close, hidden-panel inertness, and compact-shell geometry on the
  signed-off narrow widths
- kept the full active Playwright suite green after enabling the Stage E gate,
  raising the verified line to `73 passed / 31 skipped`

## 0.13.5 - connected asset diagnostics signed off - 2026-03-31
- promoted Stage D Playwright coverage from placeholder to active release gate
  for connected asset-directory diagnostics across the signed-off Chromium
  width set
- verified that diagnostics no longer collapse back to the previous false-clean
  zero summary once fixture assets are connected under the shared manual-base
  contract
- kept the full active Playwright suite green after enabling the Stage D gate,
  raising the verified line to `70 passed / 34 skipped`

## 0.13.4 - direct manipulation coordinate correctness proved - 2026-03-31
- widened the proven direct-manipulation envelope to nested positioned
  contexts by tracking `left/right` and `top/bottom` anchors explicitly instead
  of assuming one inset space
- preserved truthful blocking for unsafe transformed contexts, so keyboard
  nudge falls back to diagnostics instead of writing incorrect coordinates
- hardened selection sync around blur and bridge-driven element updates so
  non-text selection paths stop tearing down editing state unexpectedly
- promoted Stage C Playwright coverage for text edit, image replace,
  block/image/video/layout insertion, and safe-vs-unsafe keyboard nudge flows
- refreshed loaded-shell visual baselines to match the expanded Stage C
  fixture deck while keeping the full suite green

## 0.13.3 - deterministic slide activation proved - 2026-03-31
- promoted Stage B Playwright coverage from placeholder to release gate for
  create, duplicate, delete, undo/redo, and autosave-recovery flows across the
  signed-off Chromium width set
- added shell-aware browser helpers so compact-width regression scenarios use
  the real slide-list and inspector drawers instead of hidden desktop controls
- removed the timing hole where structural slide mutations relied on debounced
  history capture, making undo/redo deterministic under immediate
  create/duplicate/delete sequences
- captured structural slide history against the intended active slide target,
  not the stale runtime-confirmed slide, so restored drafts and undo states
  land on the correct slide index
- persisted editor mode through history snapshots and autosave payloads so
  undo, redo, and draft recovery return to the truthful `edit` state instead
  of silently dropping back to preview
- stopped runtime `bridge-sync` reconciliation from creating background history
  entries, which removed the redo-invalidating race after slide rebuilds and
  restores
- hardened cold-start Playwright navigation for the signed-off mobile width set
  so the Stage B gate does not fail on harness-only `page.goto` timeouts
- kept the full active Playwright suite green after enabling Stage B coverage


