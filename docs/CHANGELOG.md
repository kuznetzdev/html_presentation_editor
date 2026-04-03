# CHANGELOG

## 0.18.3 - preview zoom quality and main canvas expansion - 2026-04-03
- **Layout optimization**: widened main preview/edit panel by reducing side panel minmax widths
  - Left panel: 260-280px → 240-260px (20px narrower at min/max)
  - Right panel: 272-296px → 256-280px (16px narrower at min/max)
  - Main canvas gains ~36-52px more width in desktop layouts
  - Normalized responsive breakpoints @1240px and @1280px to consistently prioritize canvas over side panels
  - Fixes inconsistency where intermediate widths expanded side panels instead of main editing region
- **Zoom quality improvements**: reduced visual blur on downscale by using cleaner scale factors
  - Removed fractional steps 0.33 (33%) and 0.67 (67%) that caused excessive blur due to resampling artifacts
  - New quality-first zoom steps: [0.25, 0.5, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0]
  - Prioritizes whole/half fractions for sharper text and vector rendering
  - No change to zoom range (25%-200%) or UI controls
- All gates passed: shell.smoke, zoom persist test, no regression in selection/overlay/export

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
