# CHANGELOG

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


