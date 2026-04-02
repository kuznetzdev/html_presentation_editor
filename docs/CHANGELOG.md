# CHANGELOG

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
