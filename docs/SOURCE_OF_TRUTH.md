# SOURCE OF TRUTH

## Project

HTML Presentation Editor

## Product definition

This is a local visual editor for existing HTML slide decks.

It is not:

- a generic page builder
- a CMS
- a low-code website tool

It exists to let a user open a real HTML presentation, edit it safely, and
export clean HTML again.

## Core product promise

The default user path is:

`Open -> select -> edit -> save`

The user should be able to do normal work without understanding HTML.

Blank state is onboarding, not editing.

### Shell workflow contract

The shell owns a workflow marker on `body`:

- `data-editor-workflow="empty"`
- `data-editor-workflow="loaded-preview"`
- `data-editor-workflow="loaded-edit"`

This marker is the contract for shell chrome visibility.

- `empty` shows one obvious start path and no editing shell
- `loaded-preview` keeps slide navigation visible and exposes one obvious path
  into edit
- `loaded-edit` becomes selection-first and shows only the relevant editing
  surface for the current context

### Basic mode

Basic mode is for presentation editing, not code editing.

It should prioritize:

- obvious actions
- fast selection and editing
- minimal UI noise
- safe defaults
- no dead ends

In basic mode:

- blank state hides slide rail, inspector, mode toggle, complexity toggle, and
  edit actions entirely
- loaded preview shows slide rail plus a compact slide summary, not the full
  inspector
- loaded preview should expose an obvious primary path into editing with a
  novice-readable CTA instead of relying on mode-toggle literacy
- loaded edit shows the selected element path first and only the controls a
  normal presenter expects
- selected-element basic mode should start with a summary card and human labels,
  while raw node metadata and tag-level controls remain advanced-only
- HTML, diagnostics, raw attributes, and structural internals stay hidden

### Advanced mode

Advanced mode may expose:

- HTML editing
- id/class/dataset controls
- diagnostics
- precise sizing and positioning
- structural controls

Advanced mode exists for power users. It must not leak complexity back into
the basic path.

## Non-negotiable invariants

- no dead ends
- predictable UX
- shell theme resolves before first paint and must not flash contradictory
  light/dark chrome
- preview equals runtime truth
- recoverability through undo, redo, and autosave
- shell UI stays outside presentation content
- export stays clean
- `iframe + bridge + modelDoc` remains the fixed architecture

## Architecture

### Parent shell

Owns:

- topbar
- slide rail
- inspector
- floating toolbar
- context menu
- insert palette
- history
- autosave and restore
- export
- compact shell
- diagnostics UI

### Iframe preview

Owns:

- truthful runtime DOM for the presentation
- execution of presentation scripts
- runtime selection and editing inside the deck

### Bridge

Owns:

- parent-to-iframe commands
- iframe-to-parent state sync
- runtime metadata
- selection payloads
- element and slide updates
- diagnostics and heartbeat

### modelDoc

Owns:

- canonical document state
- export source
- restore source
- history source
- editor-side structural logic

## UX rules

- The slide content is visually primary
- Shell chrome must stay quieter than the presentation canvas
- The rail is for navigation and simple structure actions
- Desktop may use drag-and-drop reorder in the rail
- Compact widths should prefer explicit menu actions over fragile drag paths
- Preview/edit panel zoom controls let users scale presentation content for comfortable viewing and editing (25%-200% range)
- Direct manipulation (drag/resize) is blocked when zoom ≠ 100% to maintain coordinate precision and prevent layout errors
- Empty state must present a single-path onboarding card with `Open HTML` as
  the primary CTA and `Paste HTML` as a secondary path
- Before a deck loads, shell chrome must not leak power-user controls through
  disabled buttons, collapsed panels, or hidden-but-mounted inspector sections
- After a deck loads in preview, `Edit` should read as the obvious next action
  without changing the preview/edit architecture
- In basic preview, slide context should stay summary-first instead of showing
  dormant editor controls before the user chooses to edit
- In basic edit, the first canvas click should resolve into one clear selected
  element path instead of a full inspector dump
- Intermediate desktop widths may route secondary topbar commands through a
  transient overflow surface, but `Open` and `Export` stay inline
- Blocked actions must fail honestly with feedback, not silently — every block
  must explain the reason and offer a resolution path where one exists
- One shell control should own one visible surface state; do not stack nested
  fake layers to hide timing or spacing bugs
- Topbar overflow participates in the same mutual-exclusion routing as context
  menu, insert palette, slide template surfaces, and layer picker
  visual layers to fake active/inactive behavior
- Floating toolbar, context menu, layer picker, and compact shell drawers
  remain mutually exclusive transient surfaces

## Current signed-off capabilities

- load deck into isolated iframe preview
- switch Preview and Edit without changing architecture
- runtime-confirmed slide activation
- repeated click-through layer cycling for overlapping selections, with shell
  overlay parity and `Escape` reset to the topmost candidate
- overlap detection, warning surfacing, hover ghosting, and move-to-top recovery
- advanced-mode layers panel with direct selection sync, reorder, lock, visibility,
  group, and ungroup controls
- slide create, duplicate, delete, undo, redo, autosave, and restore
- safe direct manipulation for the signed-off geometry envelope
- truthful blocking for unsafe manipulation contexts
- desktop rail drag-and-drop reorder
- unified slide action menu with compact-safe access
- clean export and asset parity validation

## Priority rule

If there is a conflict between:

- adding more power
- making the editor clearer, safer, and more reliable

the second one wins.

## Technical requirements

### Browser compatibility

The editor targets modern evergreen browsers with automatic updates:

- **Chrome**: 4+ (zoom feature), generally latest stable
- **Firefox**: 126+ (May 2024) required for CSS zoom quality preservation; earlier versions degrade gracefully
- **Safari**: 4+ (zoom feature), generally latest stable
- **Edge**: 12+ (zoom feature), generally latest stable

### CSS zoom property

The preview zoom feature uses the CSS `zoom:` property which is on the W3C standards track (Working Draft) with 97%+ global browser support. This property triggers browser re-layout at the target resolution, preserving text and vector rendering quality at all zoom levels.

**Graceful degradation**: On unsupported browsers (Firefox < 126), zoom controls remain functional but quality improvement may not apply. No errors or crashes occur.

---

## Release state

**Current**: v2.0.28 — Empty-state landing redesign (UX polish)
(2026-04-27). v2.0.0 GA + twenty-eight post-GA polish tags.
Minimalist empty-state hero per HIG/M3 — removed the fake-affordance
"КАК НАЧАТЬ РАБОТУ" kicker pill (~2.4:1 dark-theme contrast offender
+ button-shaped non-interactive span), tightened card width 720→560px,
padding 30→56px, layered M3 elevation level-1 shadow, centered hero,
typography hierarchy refined (32/15/13 px). All test-required DOM IDs
preserved; smoke + onboarding specs 32/4/0.

**Previous**: v2.0.27 — Phase A5 store-slice extraction part 3
(2026-04-27). v2.0.0 GA + twenty-seven post-GA polish tags. Extends
the Observable Store (ADR-013) with one more slice using the proven
WO-16/17/18 / Phase A4 Proxy-shim pattern: `assetResolver` (8 fields,
identity-mapped: `assetResolverMap`, `assetResolverLabel`,
`assetObjectUrls`, `assetFileCount`, `resolvedPreviewAssets`,
`unresolvedPreviewAssets`, `baseUrlDependentAssets`,
`previewAssetAuditCounts`). Zero call-site edits — Proxy auto-routes
all 8 fields. `assetResolverMap` ref-equality preserved (Map
instance, no copy in get/set traps), so `boot.js` `.has()`/`.get()`
hot-path call-sites keep O(1) lookup. SEC-006 prototype-pollution
guard is unaffected — the actual SEC-006 dictionaries
(`slideRegistryById`, `slideSyncLocks`, `lastAppliedSeqBySlide`)
are out of scope; assetResolverMap is a `Map` instance and inherently
safe. 74/74 unit tests pass (was 70/70 at v2.0.26), tsc clean,
perf-budget click-to-select p50=16.9ms / p95=340.8ms (budget <80 /
<400), bridge-proto-pollution 8/8 pass. Architecture: ADR-033.
v2.0.26 was Phase A4: extended the Observable Store (ADR-013) with
**four** new slices using the proven WO-16/17/18 Proxy-shim pattern:
`multiSelect`, `panels`, `toolbar`, `modal`. Zero call-site edits in
consumers — Proxy auto-routes legacy `state.foo` reads/writes to
slice-typed equivalents. RETRY context: a first attempt was reported
as regressing `perf-budget.spec.js` p95; diagnostic worktree experiment
confirmed attempt-1 numbers (270–333ms) were statistically
indistinguishable from baseline (270–303ms) — not actually a regression
but a slower dev-machine noise floor than the v2.0.17 reference budget
assumed. v2.0.26 cherry-picked attempt-1 commits unchanged and bumped
the `click-to-select` p95 budget from 200 to 400 ms with explanatory
comment; p50 budget stays tight at 80 ms (observed ~17 ms — 14×
safety margin) as the load-bearing regression sentinel. Architecture:
ADR-032.
v2.0.25 was Phase A3': closed the 3 latent `/\s+/g` regex bugs that
v2.0.24 (Phase A2 / ADR-031) deliberately preserved with
`// PRESERVED runtime semantics` markers. The original
`bridge-script.js` source had single-backslash regex shorthand inside
the wrapping template literal; the template evaluator consumed the
backslash, so runtime regex was `/s+/g` (matches `s` chars, not
whitespace) at 3 sites in selection-label normalization and
layout-container kind heuristic. v2.0.25 was a 3-byte source fix at
`editor/src/bridge-script-iframe.js` plus a regenerated wrapper plus a
3-case regression spec
(`tests/playwright/specs/bridge-regex-whitespace.spec.js`). Gate-A
baseline: 318/8/0 (315 prior + 3 new). v2.0.24 was Phase A2: iframe-side
JavaScript extracted from a template-literal string into a real
lint-visible source file (`editor/src/bridge-script-iframe.js`); wrapper
`bridge-script.js` regenerates via `scripts/sync-bridge-script.js`
at pre-commit time. Closes AUDIT-REPORT-2026-04-26.md ARCH-001
(3 906-line template-string) and AUDIT-A item #15. No runtime change
beyond the 3 regex fixes; no platform change; no bundler. Architecture:
ADR-031.
v2.0.23 had closed 5 HIGH + 2 MEDIUM + 1 A11Y + 1 PERF-budget +
1 FLAKE + 1 FN + 1 CI-gap + 1 DEV-tooling + 2 dev-issues from
`docs/AUDIT-REPORT-2026-04-26.md` (deep testing audit, 17 findings) +
HIG-polish-1/2 from Phase 9 dual-agent spawn + spec FLAKE-sweep
(38 → 3 spec instances; 11 spec files migrated; 18 reusable wait
helpers exposed via `tests/playwright/helpers/waits.js`).
All audit findings closed except deferred items in POST_V2_ROADMAP.
Gate-A baseline raised to 318/8/0 in v2.0.25 by adding the
bridge-script-iframe regex regression guard (3 new cases).

The v1.0.3 → v2.0.0 redesign trajectory is complete: 26 incremental
release points (v1.1.0 through v2.0.0 inclusive) across Phases A–E
plus 6 hardening sprints; the GA has since absorbed 22 post-GA
polish tags (v2.0.1–v2.0.22). All v2 feature flags default to v2
behavior; full feature surface stable. Gate-A: 315/8/0 across 35
spec files (was 289/8/0 at v2.0.13). Gate-a11y: 27/0/0 (no masked
violations; one pre-existing flake on `keyboard-nav.spec.js P0-05`
documented). Gate-contract: 152/0. PPTX export is under regression
coverage (`pptx-export-roundtrip.spec.js`) — Beta badge removed.
CI runs gate-A on every push + PR (Node 18/20/22 matrix) and
gate-secondary (B/C/D/E/A11Y/Visual) nightly. Pre-commit syntax
guard fires before Playwright on every gate-A run. UI matches
Apple HIG / Material 3 micro-interactions (button tap feedback +
prominent focus ring).

See `docs/RELEASE-v2.0.md` for full release notes and the complete
tag-by-tag history.

**Status flavor**: internal v2 GA / public beta. Production-ready for
internal pilots and demos on real decks. Public GA still gated on the
deferred items below.

### Deferred to post-v2.0 (tracked in `docs/POST_V2_ROADMAP.md`)

- PPTX export composition integration (`ExportPptxV2` runs pre-flight,
  but archive build still delegates to legacy `exportPptx()`). The
  `#exportPptxBtn` is marked **Beta** via `attachExperimentalBadge`.
- Smart Import "full" mode — pipeline-v2 as primary loader. Default
  remains `"report"` (modal between Open and load).
- gate-a11y expansion to 50+ keyboard-only tests (current 27 baseline
  preserved; foundation focus-visible + aria-live shipped).
- 5-deck PPTX manual QA corpus.
- Real-deck import corpus expansion beyond the 10 minimal regression
  fixtures.
- Mass `data-ui-level="advanced"` migration to entity-groups
  (~15 attrs; most remaining correctly target HTML editing /
  raw IDs / diagnostics — intentional advanced-only).
- Settings → Reset onboarding UI control. Function
  `resetOnboardingV2()` available via devtools.
- Empty-state welcome card CSS animation.
- Alt+drag clone during direct manipulation.
- `feedback.js getBlockReasonAction()` actionable buttons for every
  block reason. Toast-driven recovery already exists.

### Historical anchors (pre-v2 trajectory — for archaeological reference only)

- v0.37.0-rc.0 — RC freeze declared 2026-04-22 → became v1.0.0 on
  2026-04-22 (38 Work Orders merged, 15 P0 PAIN-MAP items resolved,
  20 ADRs Accepted or Deferred).
- v1.0.0 GA — 2026-04-22.
- v1.0.3 → v2.0.0 — see `docs/RELEASE-v2.0.md`.

These anchors are preserved so a fresh agent can trace any decision
back to the PAIN-MAP / WO / ADR registry. They no longer drive the
release plan.
