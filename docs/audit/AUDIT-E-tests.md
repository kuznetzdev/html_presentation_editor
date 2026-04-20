# AUDIT-E — Test Coverage Gaps

**Auditor:** Audit-E (Test Coverage Gaps)
**Version under audit:** v0.25.0
**Baseline:** Playwright-only, 11 specs, Gate-A 55/5/0 (chromium-desktop)
**Repo:** `C:\Users\Kuznetz\Desktop\proga\html_presentation_editor`
**Date:** 2026-04-20

---

## Executive summary

Overall test-health grade: **6.5 / 10**.

The baseline is a rich integration-E2E pyramid sitting on top of a feature-complete shell. Raw numbers are impressive — 271 `test(` calls across ~5.7k lines of specs covering ~12.6k lines of source. Depth on selection, click-through, overlap recovery, tables and export cleanliness is strong. However the pyramid is **inverted**: zero unit tests, zero contract tests for the bridge protocol, no mutation harness, and four source modules that own load-bearing behavior (bridge commands, import, clipboard, history) have no *direct* spec. Gate-A gives a 55-pass heartbeat but does not exercise reorder-by-drag, recovery, layers, or visual baselines — the repo depends on gate-B/F for that. Accessibility coverage is zero (ADR-006 planned). Visual regression is scaffold-only (ADR-007 planned). Flake risk is concentrated in 23 `waitForTimeout` calls and a few `waitForFunction(globalThis.eval(...))` patterns that bypass Playwright's auto-wait.

**Top 3 gaps**

1. **No bridge contract layer** — `bridge.js` (132 LoC) and `bridge-commands.js` (844 LoC) have no direct test; all coverage is observed transitively via DOM outcomes. Protocol drift cannot be caught before runtime.
2. **No accessibility gate** — keyboard-only journeys, ARIA, focus order, reduced-motion are spot-checked at best. ADR-006 is written but un-shipped.
3. **Reimport round-trip is thin** — two specs do it (tables, code-blocks). Full "export → reimport → edit → export twice" journey is not validated; silent marker duplication or CSS drift would not fail a gate.

---

## Gate inventory

| Gate  | Specs                                                                                                  | Projects                                                    | Purpose                                                      | Est. runtime |
| ----- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------ | ------------ |
| **A** | shell.smoke, click-through, selection-engine-v2, honest-feedback                                       | chromium-desktop                                            | Fast developer heartbeat. 55/5/0 is the pre-commit contract. | 3–5 min      |
| **B** | +editor.regression, asset-parity, layer-navigation, overlap-recovery, stage-o-layers-lock-group, visual | chromium-desktop, chromium-shell-1100                       | Pre-release full-feature sweep on desktop widths.            | 15–25 min    |
| **C** | shell.smoke, editor.regression, click-through, selection-engine-v2                                     | firefox-desktop, webkit-desktop                             | Cross-browser sanity. **Excludes** honest-feedback, overlap, layers. | 10–15 min    |
| **D** | shell.smoke, editor.regression                                                                         | chromium-mobile-390, chromium-mobile-640, chromium-tablet-820 | Compact/touch viewport coverage.                             | 10–15 min    |
| **E** | asset-parity (node script + spec)                                                                      | chromium-desktop                                            | Export/asset-resolver parity.                                | 3–5 min      |
| **F** | *all specs × all projects*                                                                             | all 8 projects                                              | Full matrix, release-blocking.                               | 60+ min      |

**Redundancy / overlap notes**
- `shell.smoke` + `editor.regression` run in A, B, C, D, F — ≥4x execution of the same 35 + 44 tests per release.
- `asset-parity` runs in B, E, F — 3× execution.
- Gate-C **does not run** honest-feedback, overlap-recovery, layers, or visual. Firefox/WebKit regressions in those areas land silently.
- Gate-D runs only two specs — compact selection/overlap behavior is untested on touch.
- Gate-F is the only gate that catches reference-decks.deep (4 tests but 1458 LoC of scenarios) on non-Chromium projects.

---

## Spec coverage register (11 specs)

### 1. `shell.smoke.spec.js` — 35 tests, 1153 LoC
**Covers:** launchpad routing, open-html modal, theme/dark-light chrome, workflow markers (`empty`/`loaded-preview`/`loaded-edit`), novice/advanced split, preview-note editorial contract, topbar overflow, zoom controls, compact drawers, starter-deck button.
**Gaps:** no keyboard-only entry journey (Tab/Enter/Escape across the whole topbar); no zoom persistence across page reload ***; no screen-reader semantics; no focus-trap checks for modal; no `prefers-contrast` or `forced-colors`.
**Flake risk:** 3× `waitForTimeout(150|180|200)` around theme swap, 1× `waitForTimeout(400)` around slide activation. Low-medium — animations are disabled in config but theme recomputation still uses setTimeout internally.

### 2. `click-through.spec.js` — 7 tests, 284 LoC
**Covers:** CT1–CT6 — cycle candidates at same point, reset on move, Escape resets, context-menu numbered layers, context-menu selection, export cleanliness.
**Gaps:** no assertion of badge text accuracy across 3+ cycles, no Shift+click behavior, no touch-event click-through, no interaction with `reducedMotion`.
**Flake risk:** Low. Uses `expect.poll` consistently. Only Chromium.

### 3. `selection-engine-v2.spec.js` — 21 tests, 778 LoC
**Covers:** S1–S10 — smart-select, Ctrl/Cmd deep-select, Alt+Click ascend, Shift+Enter parent, Enter drill-down, breadcrumb navigation, crumb-kind labels, context-menu layer picker, Tab/Shift+Tab in tables, export round-trip purity.
**Gaps:** no multi-select (Shift+Click) path; no rubber-band selection; entity kind "fragment" is touched once but `svg` nested selection depth is shallow.
**Flake risk:** **Medium**. Contains 11 `waitForTimeout(120|150|200|250|300|400)` calls around async kind/path updates. Tests use `page.waitForFunction(() => globalThis.eval(...))` which is slower than Playwright's own auto-wait. Occasional cycle non-determinism is masked by `seenNodeIds.size ≥ 1` assertion.

### 4. `honest-feedback.spec.js` — 10 tests, 291 LoC
**Covers:** block-reason banner (clean, zoom-blocked, hidden, locked basic, locked advanced), compact drawer mutual exclusion, stack-depth badge, honest save-pill naming, localStorage failure diagnostics (11 distinct keys).
**Gaps:** no quota-exceeded path for autosave (only read/write errors), no concurrent-tab conflict, no iframe-side diagnostic channel.
**Flake risk:** Low. Uses `expect.poll` with 6s timeouts. Storage diagnostic test is the longest single eval — monolithic.

### 5. `asset-parity.spec.js` — 4 tests, 269 LoC
**Covers:** manual base URL live/preview/validation parity, directory-backed relative resolution, residue-free export after interaction (hidden + locked banner), popup strip.
**Gaps:** no `srcset` with descriptors, no CSS-url() parity, no image-with-query-string, no data-URI passthrough, no large-deck (>100 assets) parity.
**Flake risk:** Low. Runs node-side validator separately. Chromium-only by choice.

### 6. `editor.regression.spec.js` — 44 tests, 1645 LoC (largest)
**Covers:** slide CRUD + undo/redo, text edit, image replace, palette insert (image/video/layout), author-marker contract, unified import slide IDs, code-block safe edit + round-trip, table cell navigation + edit + round-trip, autosave recovery (both by slide ID and index), export validation popup, keyboard nudge safety, direct-manip drag/resize, blocked manipulation feedback, desktop rail drag-reorder, slide context menu actions, compact shell routing.
**Gaps:** no paste-HTML-into-blank-editor path; no "delete all slides" recovery; no undo chain >20 steps; no multi-deck swap; no drag-reorder on compact shells (explicitly skipped).
**Flake risk:** **Medium-high**. 8 `waitForFunction(() => globalThis.eval(...))` patterns — bypasses auto-wait. Several `toMatchObject` with `expect.any(Number)` which is always true and adds no value. `page.once("dialog", dialog => dialog.accept())` is fire-once — if duplicate-slide dialog fires twice, second is lost.

### 7. `layer-navigation.spec.js` — 5 tests, 227 LoC
**Covers:** LN1–LN5 — Enter drill-down, Shift+Enter parent, container mode, breadcrumb hover ghost, export has no ghost.
**Gaps:** This is almost entirely **duplicate** coverage of selection-engine-v2 S3/S4/S5/S10. LN3 (container mode) uses a 5-attempt retry loop — a sign the behavior is non-deterministic.
**Flake risk:** **High for LN3** — explicit retry loop with `test.slow()` marker indicates known flakiness. 6 `waitForTimeout` calls.

### 8. `overlap-recovery.spec.js` — 7 tests, 492 LoC
**Covers:** N1–N6 — overlap detection map, slide-rail warning badge, no ghost for hidden layers, move-to-top raises z-index, layer-picker in basic+advanced modes, insert auto-promotion.
**Gaps:** no multi-element overlap with 4+ stacked, no overlap across slide boundaries, no rapid-fire overlap recomputation under batch edits, no z-index-normalize race.
**Flake risk:** Medium. `triggerAndWaitForOverlapDetection` is a known-good pattern but relies on manual `runOverlapDetectionNow` — real user interaction races are not caught.

### 9. `stage-o-layers-lock-group.spec.js` — 9 tests, 549 LoC
**Covers:** layers panel visibility, selection sync (both directions), reorder handle contract, drag-reorder, lock/unlock + banner, visibility toggle (session-only), group/ungroup + multi-select-from-state, normalize z-indices, `]` keyboard shortcut when text editing.
**Gaps:** drag-reorder calls `reorderLayers()` directly — real DnD is commented-out as "flakey in headless". No cross-slide group operations. No copy/paste of groups.
**Flake risk:** **High on real DnD** — explicitly bypassed. Compensated by direct-API call. Lock test has 2 `expect.poll` + 1 read-back pattern (double-check).

### 10. `reference-decks.deep.spec.js` — 4 tests, 1458 LoC
**Covers:** full-reference-deck sweep across all 11 registered reference decks — selects nodes, edits, serializes, asserts no regressions. Largest single file.
**Gaps:** only runs on 2 projects (desktop + 1100). Not in Gate-A, -B, -C, -D, or -E — **only Gate-F**. Means reference decks are not validated on every release.
**Flake risk:** Medium. Long-running, heavily orchestrated. `finalizeEditCommit` has fallback chain (preview-target → slide-switch → blur) — suggests historical instability.

### 11. `visual.spec.js` — 4 tests, 77 LoC
**Covers:** empty-shell, loaded-shell, loaded-shell-dark, loaded-shell-context-menu across 4 Chromium projects. 14 snapshot PNGs total.
**Gaps:** no per-component snapshots (inspector sections, toolbar, layer picker), no compact-mobile context menu baseline, no visible diff on selection overlay. Masks are hand-maintained.
**Flake risk:** Low — `animations: "disabled"`, `maxDiffPixelRatio: 0.02`. Windows-only baselines (all `-win32.png`). Linux CI would require regeneration.

---

## Source-module coverage matrix

| Module (LoC)                      | Direct spec                      | Indirect                      | Coverage level |
| --------------------------------- | -------------------------------- | ----------------------------- | -------------- |
| `boot.js` (1962)                  | —                                | shell.smoke (init paths)      | **partial**    |
| `bridge-commands.js` (844)        | —                                | every spec (side effects)     | **none-direct** |
| `bridge-script.js` (3438)         | —                                | editor.regression, selection  | **partial**    |
| `bridge.js` (132)                 | —                                | every spec                    | **none-direct** |
| `clipboard.js` (117)              | —                                | editor.regression (copy/paste in text edit — partial) | **none** |
| `constants.js` (177)              | —                                | trivial; no logic to test     | **n/a**        |
| `context-menu.js` (904)           | click-through, selection-engine  | editor.regression             | **good**       |
| `dom.js` (361)                    | —                                | every spec                    | **none-direct** |
| `export.js` (625)                 | asset-parity, editor.regression  | click-through, layer-nav, selection, stage-o | **good** |
| `feedback.js` (924)               | honest-feedback                  | asset-parity                  | **good**       |
| `history.js` (825)                | —                                | editor.regression (undo/redo) | **partial**    |
| `import.js` (774)                 | —                                | editor.regression (unified import tests) | **partial** |
| `inspector-sync.js` (1384)        | —                                | editor.regression, selection  | **partial**    |
| `main.js` (12)                    | —                                | trivial                       | **n/a**        |
| `onboarding.js` (162)             | shell.smoke (starter button)     | —                             | **thin**       |
| `preview.js` (34)                 | —                                | shell.smoke (zoom)            | **thin**       |
| `primary-action.js` (670)         | —                                | shell.smoke (primary CTA)     | **partial**    |
| `selection.js` (1849)             | selection-engine-v2, click-through, layer-navigation | editor.regression, overlap-recovery, stage-o | **excellent** |
| `shell-overlays.js` (818)         | —                                | shell.smoke, selection        | **partial**    |
| `shortcuts.js` (219)              | —                                | shell.smoke (Ctrl+= zoom)     | **thin**       |
| `slide-rail.js` (483)             | editor.regression (rail drag)    | shell.smoke                   | **good**       |
| `slides.js` (492)                 | —                                | editor.regression (CRUD)      | **partial**    |
| `state.js` (667)                  | —                                | every spec (state reads)      | **none-direct** |
| `style-app.js` (289)              | —                                | shell.smoke (theme)           | **thin**       |
| `toolbar.js` (152)                | —                                | editor.regression (text edit) | **partial**    |

**Zero-direct-coverage modules (10):** `boot`, `bridge`, `bridge-commands`, `bridge-script`, `clipboard`, `dom`, `history`, `import`, `inspector-sync`, `state`. Total LoC: **9,392** (74% of source).

`constants.js`, `main.js`, `preview.js` are trivial — excluded from concern.

**Observation:** the bridge protocol is the biggest architectural surface (3438 + 844 + 132 = 4414 LoC) and has no contract test. A schema change to `sendToBridge("select-element", …)` would be caught only when a UI-level assertion fails.

---

## Journey coverage gaps

From `docs/SOURCE_OF_TRUTH.md` + `docs/ROADMAP_NEXT.md`:

| # | Product journey                                       | Spec coverage                                        | Status    |
| - | ----------------------------------------------------- | ---------------------------------------------------- | --------- |
| 1 | Empty → starter deck → edit                           | shell.smoke (button click only, no follow-through)   | **thin**  |
| 2 | Paste HTML → fix → edit                               | —                                                    | **none**  |
| 3 | Text inline edit → commit → undo                      | editor.regression (basic + table cell + code-block)  | strong    |
| 4 | Image replace                                         | editor.regression                                    | ok        |
| 5 | Multi-select → align / group                          | stage-o (group only, via state hack)                 | **thin**  |
| 6 | Undo chain 20+                                        | —                                                    | **none**  |
| 7 | Keyboard-only workflow (no mouse)                     | selection-engine S4/S9 partial (Tab, Shift+Enter)    | **thin**  |
| 8 | Zoom + edit                                           | shell.smoke (zoom only), honest-feedback (zoom block) | partial   |
| 9 | Export → reimport round-trip                          | editor.regression (tables, code-blocks only)         | **thin**  |
| 10 | Recovery from blocked states                         | honest-feedback, asset-parity                        | ok        |
| 11 | Slide reorder via drag                               | editor.regression (desktop only, compact skipped)    | partial   |
| 12 | Slide reorder via keyboard                           | —                                                    | **none**  |

**Missing journey specs:** 2, 6, 12 entirely; 1, 5, 7, 9 are covered shallowly.

`docs/ROADMAP_NEXT.md` Phase 4 tracks (2) as `onboarding.spec.js` — not yet shipped.

---

## Non-functional coverage gaps

### Accessibility (WCAG / keyboard / ARIA)
- **Zero direct coverage.** No `axe-core` integration.
- No tests for: focus order, focus trap in modal, ESC dismissal universally, ARIA-live regions for diagnostics, color contrast in both themes, `role`/`aria-label` on custom buttons, skip-links.
- ADR-006 (`docs/ADR-006-accessibility-ci-gate.md`) specifies this as planned — not shipped.

### Visual regression
- 14 snapshots, 4 scenarios, desktop-only, Windows-only baselines.
- No: mobile context-menu, layer picker popup, inspector variants, floating toolbar, insert palette, empty-state dark theme, overlap badge.
- ADR-007 is planned but unshipped.

### Performance / load
- **None.** No startup-time budget, no deck-size stress test (current biggest reference deck has ~6 slides), no "what if 200 slides" scenario, no memory-leak check across 50 undo/redos, no FPS during drag-reorder.

### Cross-browser
- Gate-C covers Firefox/WebKit — but only 4 specs of 11.
- Honest-feedback (storage diagnostics), overlap-recovery, layers, asset-parity, visual — all **Chromium-only**.
- `isChromiumOnlyProject(testInfo.project.name)` skip guard appears 56 times; most feature specs opt out of FF/WK by design.

### Mobile / tablet / touch
- Gate-D has two specs, two breakpoints × 3 viewports = 6 combinations.
- No touch-specific selection semantics tested (tap vs long-press, hold-to-select, pinch-zoom interference with CSS zoom).
- `isTouch` paths are skipped in several selection tests (S2, Alt-cycle, drag/resize) — coverage hole for iPad users.

---

## Infrastructure gaps

- **No unit tests.** Every test is a Playwright E2E. 132-LoC `bridge.js` and 117-LoC `clipboard.js` are pure logic fit for unit testing — none exists.
- **No mutation testing** (Stryker). Impossible to prove whether high test count actually catches mutations.
- **No property-based testing** (fast-check). Selection engine scoring, layer normalization, z-index assignment, and overlap math are algorithmic — ideal PBT targets.
- **No contract tests for bridge.** The iframe↔shell message protocol (`select-element`, `insert-element`, `slide-activation-request`, diagnostics, etc.) is defined only by shared source. A consumer-driven contract (Pact or schema-validated fixtures) would catch drift.
- **No benchmark harness.** Reference-deck load time, serialize time, overlap recompute time — no numeric budget.
- **No test data factory.** Reference decks are hand-written HTML files in `references_pres/`. Creating a new fixture requires authoring full HTML.
- **No coverage reporting.** No Istanbul/c8 output on source modules to quantify the matrix above numerically.
- **No screen-reader simulation.** No NVDA/VoiceOver replay, no guided-tour validator.

---

## Flake-risk top 10

Ranked by probability-of-spurious-failure × difficulty-of-debugging:

| # | Location                                                               | Pattern                                                               | Risk    | Fix direction                                            |
| - | ---------------------------------------------------------------------- | --------------------------------------------------------------------- | ------- | -------------------------------------------------------- |
| 1 | `layer-navigation.spec.js:LN3 container mode`                          | 5-attempt retry loop + `test.slow()` — admits non-determinism         | High    | Remove retry, capture true race and fix                  |
| 2 | `selection-engine-v2.spec.js:S5 Enter drill-down`                      | `waitForTimeout(300)` then `expect(...).not.toBe(containerNodeId)` — unconditional sleep | High    | Poll on `state.selectedNodeId` change                   |
| 3 | `stage-o-layers-lock-group.spec.js:drag-reorder`                       | Real DnD bypassed — direct `reorderLayers()` call                     | High (known) | Land a DnD-in-headless compat shim                 |
| 4 | `editor.regression.spec.js:keyboard nudge unsafe-box`                  | Asserts `diagnosticsBox` text — depends on ordering of diagnostics[]  | Med-high | Assert specific diagnostic entry not text match         |
| 5 | `editor.regression.spec.js:rail drag reorder`                          | `dragSlideRailItem` uses synthetic drag events in headless            | Med-high | Same mitigation as #3                                   |
| 6 | `selection-engine-v2.spec.js:S2 repeated Ctrl+click`                   | `seenNodeIds.size >= 1` — test passes even if cycling is broken       | Medium (silent) | Assert `>= 2` with `test.skip` for single-candidate decks |
| 7 | `shell.smoke.spec.js:theme capture`                                    | `waitForTimeout(150)` after `setThemePreference`                      | Medium  | Await a theme-applied marker instead of sleep            |
| 8 | `overlap-recovery.spec.js:auto-promote`                                | Polling for inserted element by text match; relies on bridge insert timing | Medium | Return nodeId from bridge payload directly              |
| 9 | `honest-feedback.spec.js:storage diagnostics`                          | Monolithic 80-line eval; if one of 11 ops skips a diagnostic, the assert order fails | Medium | Split into 11 targeted specs                    |
| 10 | `editor.regression.spec.js:autosave recovery reload`                  | Polls `sessionStorage` then reloads — raceable in slow CI             | Medium  | Await bridge-emitted "autosave-saved" event              |

**Systemic flake contributors**
- 23 `waitForTimeout` occurrences — each is a cache/animation smell.
- `page.waitForFunction(() => globalThis.eval("…"))` is ~10× slower than `expect.poll(...)` and harder to diagnose. 16 occurrences.
- `page.once("dialog", …)` is fragile; a stray re-render that fires the dialog twice will hang.

---

## Priority gaps for v1.0 (ranked)

### P0 — blockers for v1.0 release confidence

1. **Onboarding journey spec** — Empty → Paste HTML → fix → edit → save. (Scope: 6–8 tests. Effort: **M**. Blocks: v0.26 onboarding epic.)
2. **Accessibility gate** — axe-core + keyboard-only traversal of every critical control. (Scope: new spec + CI gate. Effort: **L**. Blocks: public release.)
3. **Export → reimport round-trip journey** — 3 specs covering multi-slide, multi-asset, with-edits cycles. (Scope: 4–6 tests. Effort: **M**. Blocks: v1.0 "open → save" promise.)
4. **Bridge contract tests** — schema-validate every `sendToBridge` payload and iframe-emitted message. (Scope: new harness + 1 spec. Effort: **L**. Blocks: any bridge refactor.)

### P1 — should fix before v1.0

5. **Undo chain stress test** — 25-step undo/redo with state snapshot diff. (Scope: 1 spec. Effort: **S**. Blocks: history.js refactor.)
6. **Slide reorder via keyboard** — no current coverage. (Scope: 2 tests. Effort: **S**.)
7. **Multi-select UX** — Shift+Click, rubber-band, keyboard multi-select. (Scope: 1 spec. Effort: **M**.)
8. **Real-DnD headless shim** — land a helper so stage-o and rail drag use real events. (Scope: helper + 2 test migrations. Effort: **M**.)
9. **Visual baselines for layer-picker, mobile context menu, compact inspector.** (Effort: **S**.)
10. **Performance smoke** — boot-time, 50-slide serialize, overlap recompute under batch. (Effort: **M**.)

### P2 — nice-to-have

11. Mutation testing pilot on `selection.js` scoring logic. (**M**)
12. Property-based tests for z-index normalize and overlap math. (**S**)
13. Coverage report (c8 instrumenting source). (**S**)
14. WebKit/Firefox expansion to honest-feedback, overlap, layers. (**M**)
15. Storage quota-exceeded path. (**S**)

---

## Recommendations

### New specs to add

| Filename (proposed)                         | Purpose                                       | Priority |
| ------------------------------------------- | --------------------------------------------- | -------- |
| `onboarding.spec.js`                        | Empty → starter / paste journeys              | P0       |
| `accessibility.spec.js`                     | axe-core + keyboard traversal                 | P0       |
| `export-reimport.spec.js`                   | Multi-round round-trip preservation           | P0       |
| `bridge-contract.spec.js`                   | Schema validation of every bridge message     | P0       |
| `history-stress.spec.js`                    | 25+ undo chain, memory bound                  | P1       |
| `keyboard-only.spec.js`                     | Full editing journey without mouse            | P1       |
| `multi-select.spec.js`                      | Shift+Click, marquee, keyboard multi          | P1       |
| `perf-smoke.spec.js`                        | Boot, serialize, overlap budgets              | P1       |
| `touch-interactions.spec.js`                | iPad gestures, long-press, pinch/zoom         | P2       |

### Specs to split
- `honest-feedback.spec.js` — split the monolithic storage-diagnostic test into 11 targeted tests (one per localStorage key) for faster triage.
- `editor.regression.spec.js` (1645 LoC, 44 tests) — split into `slides-crud`, `text-editing`, `tables`, `media-insert`, `direct-manip`, `autosave`. Current file is the single largest maintenance burden.

### Specs to consolidate
- `layer-navigation.spec.js` is **functionally dominated** by selection-engine-v2. Fold LN1/LN2/LN4/LN5 into selection-engine-v2 and delete the file. Keep LN3 (container mode) as its own spec **only after** the retry loop is removed.

### Harness additions
- **Unit layer:** add `tests/unit/` with Vitest (or Node's built-in test runner — no bundler needed, matches "zero build step"). Target: `clipboard.js`, `bridge.js`, `state.js` selectors, `history.js` stack ops, `selection.js` pure scoring functions. Run under `npm run test:unit`; add to Gate-A.
- **Contract layer:** extract the bridge protocol into a JSON-schema definition. Validate against every emitted message in a dedicated spec. Insert as Gate-A (fast) and Gate-F (full).
- **Mutation pilot:** Stryker-JS on `selection.js` scoring — single-file scope keeps runtime bounded.
- **PBT pilot:** fast-check on z-index normalizer and overlap coverage-percent math.
- **Test data factory:** `tests/factories/reference-deck.js` that builds HTML fixtures programmatically (slides, elements, overlaps) — removes hand-editing cost for new scenarios.

### Gate rebalancing
- Move `overlap-recovery.spec.js` and `stage-o-layers-lock-group.spec.js` into Gate-C so FF/WK regressions surface. If infeasible in one pass, at minimum run `overlap-recovery.spec.js` on firefox-desktop.
- Expand Gate-D beyond `shell.smoke + editor.regression` to include `honest-feedback.spec.js` — compact drawer routing lives there.
- Add `reference-decks.deep.spec.js` to Gate-B. It currently only runs in Gate-F (full matrix), meaning every release-blocking run takes 60+ min.

### CI / developer workflow
- Pre-commit hook: Gate-A (already implied by CLAUDE.md §5) — verify it is wired.
- Pre-push hook: Gate-B.
- Publish Playwright HTML report per PR via GitHub Actions artifact.
- Snapshot baselines: add `npm run test:pw:update` docs + Linux baselines if CI diverges from Windows.

### Invariants to honor
- `file://` compatibility: all proposed specs continue to use `webServer` — no protocol split.
- Gate-A 55/5/0 stays sacred. New tests either enter Gate-A only after 3 consecutive green nightlies, or go into Gate-B.
- Zero-build: unit harness must run with bare Node or Vitest-via-Node, not a transpiled TS pipeline.

---

## Appendix — raw counts

- Source: 25 JS modules, 12,635 LoC (excluding `main.js`, `constants.js`, `preview.js` = trivial).
- Specs: 11 files, 7,223 LoC, 271 `test(` occurrences (many inside helpers/describes; true test count ≈ 252).
- Helpers: 2 files (`editorApp.js`, `referenceDeckRegistry.js`).
- Visual baselines: 14 PNG files (Windows only).
- Reference decks: 11 registered in `referenceDeckRegistry.js` (used across editor.regression + reference-decks.deep).
- Gates: 6 (A–F). Gate-A ≈ 55 tests; Gate-F ≈ 400+ (all × 8 projects).
- Flake patterns: 23 `waitForTimeout`, 16 `waitForFunction(globalThis.eval(…))`, 1 explicit retry loop (LN3), 2 synthetic-DnD direct-API bypasses.

*End of AUDIT-E.*
