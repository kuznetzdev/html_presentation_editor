# Post-v2.0 Roadmap

> Living document — items move from "queued" → "in progress" → "shipped"
> as patches land. Reviewed at the start of each minor iteration.

**v2.0.0 GA shipped 2026-04-24.** This document tracks what is needed
between internal GA (current state) and a true public production GA.

---

## Status flavor

- v2.0.0 = **internal GA / public beta**.
- Production-ready for: internal pilots, demos on real decks,
  controlled customer trials.
- Not yet positioned for: open public release, marketing as
  "production grade", aggressive onboarding flows.

---

## P0 — Must close before public GA tag (v2.1.0 candidate)

### PPTX export composition integration

`ExportPptxV2` runs the pre-flight + classifier, but the actual archive
build still delegates to the legacy `exportPptx()` in `editor/src/export.js`.
The `#exportPptxBtn` is marked **Beta** via `attachExperimentalBadge` to
keep this honest in the UI.

Closes when: `export-pptx/index.js` builds the PptxGenJS slide objects
directly using the resolved positions, font fallbacks, gradients, and
SVG primitives from the helper modules. Legacy `exportPptx()` either
removed or kept as `legacyExportPptx()` for fallback.

Acceptance: 5-deck manual QA corpus (Reveal, Impress, custom-positioned,
image-heavy, transform-heavy) shows ≥ 85% fidelity vs preview, no
console errors, archive opens in PowerPoint 2019+.

### gate-a11y expansion

Current 27-test baseline is preserved but does not cover keyboard-only
full editing journeys. Foundation (focus-visible + aria-live +
inspector mode toggle relabel) is in place.

Closes when: gate-a11y has ≥ 50 tests covering:
- Tab into shell → first focusable
- Slide rail Arrow + Alt+Arrow reorder
- Preview Tab descent / Shift+Tab ascent
- Multi-select via keyboard only
- Inspector field navigation per entity kind
- All toolbar actions reachable

### Real-deck import corpus expansion

Current 10-fixture corpus is intentionally minimal (each HTML small
enough to drive detectors). Detector regression is locked, but the
corpus does not exercise real-world Reveal / Slidev / Canva / PowerPoint
exports.

Closes when: 5+ "complex" reference decks land under
`tests/fixtures/import-corpus/real/`:
- Real Reveal.js export (≥ 10 slides, transitions, themes)
- Custom absolute-positioned deck (no framework)
- Image-heavy deck (≥ 20 images)
- Transform-heavy deck (rotation, scale, 3d)
- External-asset deck (CDN fonts, remote images)

Each runs through `runImportPipelineV2`, gets a complexity score, and
exports cleanly through both HTML and PPTX paths.

---

## P1 — Quality of life before next minor

### Smart Import "full" mode

Default remains `"report"` (modal between Open and load — stable). A
`"full"` mode would have pipeline-v2 act as the primary loader with
normalization, slide-boundary rewriting, asset rehoming, and fallbacks.

Closes when:
- `import-pipeline-v2/normalize.js` injects `data-editor-*` consistently
- Slide inference results actually rewrite the DOM (h1-split,
  page-break, viewport — currently they only annotate)
- Existing 12-deck corpus continues to load editably (90% target)
- Default flag flips to `"full"` after 2 minor iterations of stable
  `"report"` mode

### Settings → Reset onboarding UI

Function `window.resetOnboardingV2()` is available via devtools but not
surfaced in any panel. Add a "Reset hints" button in inspector settings
section.

### Empty-state welcome card animation

CSS animation 2s loop showing "click → drag → edit". Currently the
empty state is static. Animation should respect
`@media (prefers-reduced-motion)`.

### Alt+drag clone

Direct manipulation should support Alt+drag = clone-while-dragging
(PowerPoint convention). Wires into existing selection.js drag
machinery via a new modifier branch.

### `feedback.js getBlockReasonAction()`

All 8 block reasons should return an actionable button (not just
explain). Toast-driven recovery already exists for most paths; this
unifies the contract.

---

## P2 — Polish + housekeeping

### Mass `data-ui-level="advanced"` migration

~15 attrs on `field-group compact` blocks need entity-kind-specific
decisions (image vs text vs container). Most remaining `data-ui-level`
markers correctly target HTML editing / raw IDs / diagnostics —
intentional advanced-only.

### Token migration completion

`--shadow-sm/md/lg` and `--motion-fast/medium` legacy primitives still
referenced in `preview.css` / `overlay.css` / `layout.css` (~30 hits).
Migration to v3 semantic tokens (`--shadow-panel/floating/modal/pressed`,
`--motion-micro/base/emphasis`) is low-risk-low-reward and queued
behind real product needs.

### Gate-B / Gate-C / Gate-D expansion

Current Gate-A: 242/8/0 across 24 spec files. Multi-browser (Gate-C),
mobile/tablet (Gate-D), wider smoke (Gate-B), and full matrix (Gate-F)
should be re-run and re-baselined for v2 layout — likely surfaces 5–15
visual / timing fixes.

### Long-session test extension

Current `long-session-sync.spec.js` runs 100 mutations. Real endurance
is 15–30 minutes simulated editing. Add a `gate-endurance` script that
runs nightly with realistic interaction patterns.

---

## P3 — Strategic / not blocking

- **Plugin system L2** (ADR-016) — entity-kind registry exists; full
  marketplace deferred.
- **Live CRDT collaboration** (ADR-017) — readiness only; not in scope.
- **Cloud sync** (ADR-028) — opt-in, planned for v3.x.
- **Mobile-first editing** (ADR-018) — tablet remains review-only
  honest-block.
- **Server-side rendering** — permanently rejected (zero-server
  invariant).

---

## Done since v2.0.0

(Empty — this document was created the same day as v2.0.0 GA.
Items move here as patches land.)

---

## Operating principle

> Ship release-integrity patches before feature work. The next tag
> after v2.0.0 was `v2.0.1` — a release-integrity patch that closed
> SoT/README drift the user verdict caught. Future patches follow the
> same pattern: docs in lockstep, then features.
