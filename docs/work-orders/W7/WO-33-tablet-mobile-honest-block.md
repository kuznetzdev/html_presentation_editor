## Step 33 — v0.32.1 · Tablet "review-only" posture + gate-D expanded (3 viewports × honest-block banner)

**Window:** W7   **Agent-lane:** B (UX/Mobile)   **Effort:** M
**ADR:** ADR-018   **PAIN-MAP:** —
**Depends on:** WO-29 (banner unification — honest-block reuses unified banner region), WO-09 (a11y gate foundation — compact viewports need axe runs too)   **Unblocks:** WO-38 (RC freeze gate matrix — gate-D expanded satisfies release criteria)

### Context (3–5 lines)

Per ADR-018, v1.0 tablet posture is **"review-capable, light-edit-capable, not power-editable"**: tap-select + tap-edit-text + tap-replace-image work, but direct manipulation (drag/resize), rail drag-reorder, layers panel, and multi-select are blocked with honest banners. AUDIT-E §"Mobile/tablet/touch" confirms gate-D runs only `shell.smoke` + `editor.regression` at 3 viewports (390 / 640 / 820) — compact drawer routing, block-banner text, and tap-edit journeys are uncovered. This WO ships: (1) direct-manip + rail-reorder honest-block wiring on compact; (2) 10 new tablet-smoke tests in `tests/playwright/specs/tablet-honest.spec.js`; (3) expanded `test:gate-d` to include the new spec on all 3 viewports; (4) ADR-018 Status → Accepted.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `tests/playwright/specs/tablet-honest.spec.js` | new | +380 / −0 |
| `tests/playwright/helpers/tablet-fixtures.js` | new | +140 / −0 |
| `editor/src/feedback.js` | edit (hook `isCompactViewport()` into directmanip-block) | +45 / −8 |
| `editor/src/selection.js` | edit (emit honest-block on drag-attempt at compact) | +25 / −3 |
| `editor/src/slide-rail.js` | edit (emit honest-block on drag-start at compact) | +18 / −2 |
| `editor/styles/banner.css` | edit (tablet-specific banner padding/font-size) | +22 / −0 |
| `package.json` | edit (`test:gate-d` argument list expanded) | +1 / −1 |
| `docs/CHANGELOG.md` | edit (append) | +8 / −0 |
| `docs/ADR-018-mobile-touch-strategy.md` | edit (Status → Accepted) | +2 / −2 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `docs/ADR-018-mobile-touch-strategy.md` §Supported / NOT supported | exact posture scope — do not widen |
| `docs/ADR-001-block-reason-protocol.md` | banner protocol — reuse, do not duplicate |
| `editor/src/constants.js` line 116 (`MAX_VISIBLE_TOASTS`) | banner queue budget |
| `editor/src/feedback.js` lines ~600–750 | `isCompactViewport()` helper + `#blockReasonBanner` region |
| `editor/styles/responsive.css` | compact shell breakpoints — do NOT edit, reference only |
| `tests/playwright/specs/editor.regression.spec.js` | reference for drag-reorder skip patterns on compact (AUDIT-E §Gate-D) |
| `tests/playwright/specs/honest-feedback.spec.js` | banner-verification pattern to mirror |
| `playwright.config.js` | existing `chromium-mobile-390`, `chromium-mobile-640`, `chromium-tablet-820` project definitions |
| `editor/fixtures/basic-deck.html` (post-WO-25) | reference deck |

### Sub-tasks (executable, each ≤ 2 h)

1. Read `editor/src/feedback.js` — locate `isCompactViewport()` (grep). Confirm it returns a boolean based on `window.matchMedia` at ≤ 820 CSS px. Record the exact helper name + signature. Expected state after: know exactly which predicate gates the new honest-block emits.
2. Read `editor/src/selection.js` — locate the direct-manip drag-start entry (the function that initiates resize/move gestures). Record file:line. Confirm it currently does NOT check viewport class before allowing drag. Expected state after: know the single call-site to guard.
3. Edit `editor/src/selection.js`: insert at drag-start entry: `if (isCompactViewport()) { emitBlockReason({ code: 'directmanip.compact', message: 'Перемещение и изменение размера — только на desktop', recoverable: true }); return; }`. Preserve Russian UI copy exactly. Expected state after: drag attempts on compact never start the gesture and always route through banner.
4. Read `editor/src/slide-rail.js` — locate rail drag-reorder entry (`pointerdown` + `draggable` initialization). Record file:line. Expected state after: know the rail-drag gate point.
5. Edit `editor/src/slide-rail.js`: guard rail drag-reorder with same `isCompactViewport()` check, emit `{ code: 'rail.compact', message: 'Перетаскивание слайдов — только на desktop', recoverable: true }`. Tap-to-switch-slide must still work (this is explicitly supported per ADR-018). Expected state after: drag on compact banned; tap remains functional.
6. Edit `editor/src/feedback.js` to add the two new block-reason code handlers in the banner router: `directmanip.compact` and `rail.compact`. Message strings match exactly those in the emitter calls (Russian). Expected state after: banners render with the correct Russian copy on compact.
7. Edit `editor/styles/banner.css` — add rule `@media (max-width: 820px) { #shellBanner { padding: var(--space-3) var(--space-4); font-size: var(--font-size-sm); } }` (reuse unified banner region from WO-29). Verify token names exist in `tokens.css` (grep before writing). Expected state after: banner on tablet fits thumb-zone, doesn't overlap content.
8. Create `tests/playwright/helpers/tablet-fixtures.js`. Exports: `asTabletPage(page)` (asserts viewport matches one of 390/640/820 — fails loudly otherwise), `tapSelect(page, selector)` (pointerdown+pointerup via `dispatchEvent` — synthetic tap), `attemptDrag(page, nodeId)` (simulate drag-start gesture to trigger block), `attemptRailReorder(page, fromIdx, toIdx)` (simulate rail drag-start), `readBannerText(page)` (returns `#shellBanner` textContent). Expected state after: helpers compile and are imported by spec.
9. Create `tests/playwright/specs/tablet-honest.spec.js` with 10 tests, grouped in 2 describes:

   **describe("tablet.supported")** — 5 tests covering tap workflows explicitly "Supported on tablet (v1.0)" per ADR-018:
   - TS1: open deck → slides render at compact widths (390/640/820 all see slide count ≥ 1).
   - TS2: tap on slide rail item → activeSlideId changes (covers "Slide rail interaction: tap to switch slide").
   - TS3: tap on text element → inspector summary shows selected breadcrumb (covers "Tap element → see selected breadcrumb").
   - TS4: tap on text → contenteditable engages (covers "Tap text → inline edit").
   - TS5: save button visible + clickable (covers "Save / export buttons accessible").

   **describe("tablet.blocked")** — 5 tests covering NOT-supported attempts:
   - TB1: attempt drag on selected text → `#shellBanner` shows `Перемещение и изменение размера — только на desktop`.
   - TB2: attempt resize handle drag → same banner.
   - TB3: attempt rail drag-reorder → `#shellBanner` shows `Перетаскивание слайдов — только на desktop`.
   - TB4: `Shift+click` multi-select attempt (synthetic) → banner or no-op with existing honest-feedback (confirm either is acceptable; follow WO-31 if multi-select arrives).
   - TB5: advanced-mode layers panel inaccessible at compact (either not rendered or explicit banner) — assert via `expect(page.locator('#layersPanel')).toBeHidden()` or banner.

   Each test uses `test.use({ viewport: { width: N, height: M } })` per viewport OR relies on the Playwright project matrix — choose the project-matrix path (cleaner, matches gate-D). Expected state after: 10 tests × 3 viewports = 30 test runs on gate-D expansion.
10. Edit `package.json` → expand `"test:gate-d"` to include new spec: `"test:gate-d": "playwright test tests/playwright/specs/shell.smoke.spec.js tests/playwright/specs/editor.regression.spec.js tests/playwright/specs/tablet-honest.spec.js --project=chromium-mobile-390 --project=chromium-mobile-640 --project=chromium-tablet-820"`. Expected state after: `npm run test:gate-d` runs 3 specs × 3 projects.
11. Run full gate matrix:
    - `npm run test:gate-a` → 55/5/0 (baseline invariant)
    - `npm run test:gate-d` → passes (new spec + existing specs on 3 viewports)
    - Count new gate-d tests: 10 tests × 3 viewports = 30 new runs; document actual count in commit body.
    Expected state after: gate-d expanded, gate-a untouched.
12. Update `docs/CHANGELOG.md` under `## Unreleased` → `### Added`: `Tablet honest-block posture per ADR-018 — directmanip/drag-reorder emit unified banners on compact viewports; gate-D expanded with tablet-honest.spec.js (10 tests × 3 viewports).` Expected state after: CHANGELOG reflects the policy + test addition.
13. Mark ADR-018 Status: Accepted. Edit line 3: `**Status**: Proposed` → `**Status**: Accepted`. Append `**Accepted in**: v0.32.1 via WO-33.` line. Expected state after: ADR status matches reality.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A (only reuse existing layer `overlay` or `banner`)
- [ ] Russian UI-copy strings preserved VERBATIM: `Перемещение и изменение размера — только на desktop`, `Перетаскивание слайдов — только на desktop`
- [ ] Tap-to-select, tap-to-edit-text, tap-to-switch-slide all STILL work on 390/640/820 (ADR-018 supported list)
- [ ] Drag, resize, rail-reorder all emit banner on 390/640/820 (ADR-018 NOT-supported list)
- [ ] Layers panel hidden on compact (either CSS display:none OR never rendered)
- [ ] gate-D covers 3 viewports EXACTLY (390 + 640 + 820); no new viewports added
- [ ] Banner uses the unified `#shellBanner` region from WO-29 — NO new banner DOM introduced
- [ ] `isCompactViewport()` helper reused — NOT duplicated
- [ ] Reference decks still load on compact widths (no unintended layout breaks from banner padding)

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:gate-d` passes on all 3 viewport projects with 3 specs loaded
- [ ] `tests/playwright/specs/tablet-honest.spec.js` has exactly 10 tests; all 10 pass on each of `chromium-mobile-390`, `chromium-mobile-640`, `chromium-tablet-820`
- [ ] `npm run test:gate-a` remains 55 / 5 / 0
- [ ] Manual verification (via Playwright UI or DevTools mobile emulation at 820×1180): drag-start on any element triggers banner with text `Перемещение и изменение размера — только на desktop`
- [ ] Manual verification at 820×1180: rail drag-start triggers banner `Перетаскивание слайдов — только на desktop`
- [ ] Manual verification at 390×800: tap on `<h1>` selects element + shows breadcrumb (tap-select works)
- [ ] Manual verification at 390×800: double-tap / long-tap on text engages contenteditable (tap-edit works)
- [ ] ADR-018 `Status: Accepted` + `Accepted in: v0.32.1 via WO-33` line present
- [ ] Commit message in conventional-commits format: `feat(mobile): tablet honest-block posture + gate-D +10 tests — v0.32.1 WO-33`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| tap-select at 390px | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| tap-select at 640px | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| tap-select at 820px | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| tap-edit-text at all 3 viewports | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| tap-replace-image (simulated file picker) | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| drag-attempt banner at all 3 viewports | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| resize-attempt banner | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| rail-reorder banner | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| shift+click multi-select banner/no-op | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| layers-panel hidden on compact | gate-d | `tests/playwright/specs/tablet-honest.spec.js` | N/A | pass |
| gate-a baseline unaffected | gate-a | all four gate-a specs | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** Banner padding in `banner.css` media query interferes with desktop layout when viewport crosses 820px threshold during a session (e.g., browser resize).
- **Mitigation:** Use `@media (max-width: 820px)` ONLY for banner styling — no JS layout branching beyond the existing `isCompactViewport()` predicate. Test with manual resize in Playwright (record viewport-change spec if flake appears).
- **Risk:** `tapSelect` helper uses synthetic `pointerdown`/`pointerup` events — real iOS Safari uses specific `TouchEvent` sequences that differ.
- **Mitigation:** Gate-D runs `chromium-mobile-*` projects, NOT WebKit-iOS. Document in CHANGELOG note: "Tablet-honest gate is Chromium-emulation; real-iOS validation is a manual pre-RC step (WO-38)."
- **Risk:** `Shift+click multi-select` TB4 is ambiguous: WO-31 lands multi-select for desktop; if TB4 expects a banner but multi-select actually silently no-ops on touch (no shift key), test passes spuriously.
- **Mitigation:** TB4 asserts EITHER banner text includes "multi-select" OR `state.selectedNodeIds.length === 1` (i.e., silent no-op). Document the alternative in the spec comment so intent is traceable. WO-31 cross-references this.
- **Risk:** Gate-D runtime increases meaningfully — currently 10–15 min, new spec adds 30 more test runs.
- **Mitigation:** Target new spec at 30 test runs total; keep per-test runtime under 5s (use `page.setDefaultTimeout(5000)`). Acceptable gate-D runtime budget: ≤ 25 min total.
- **Rollback:** `git revert <sha>`. Removes the new spec + helpers + banner CSS media query + `selection.js`/`slide-rail.js` guards. Existing gate-D tests continue passing.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:ui-ux-designer
isolation: worktree
branch_prefix: claude/wo-33-tablet-mobile-honest-block
```

````markdown
You are implementing Step 33 (v0.32.1 tablet honest-block) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-33-tablet-mobile-honest-block   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-018 (docs/ADR-018-mobile-touch-strategy.md) fully
  3. Read ADR-001 (banner protocol)
  4. Read editor/src/feedback.js — locate isCompactViewport() + #blockReasonBanner usage
  5. Read editor/src/selection.js drag-start entry
  6. Read editor/src/slide-rail.js drag-reorder entry
  7. Read tests/playwright/specs/honest-feedback.spec.js (banner-verify pattern)
  8. Read playwright.config.js compact-viewport projects
  9. Run `npm run test:gate-a` — must be 55/5/0 before any code change
  10. Run `npm run test:gate-d` — capture baseline pass count

FILES YOU OWN (exclusive write):
  - tests/playwright/specs/tablet-honest.spec.js             (new, 10 tests)
  - tests/playwright/helpers/tablet-fixtures.js              (new helper)
  - editor/src/feedback.js                                    (edit: handle new codes)
  - editor/src/selection.js                                   (edit: guard drag-start)
  - editor/src/slide-rail.js                                  (edit: guard rail-drag-start)
  - editor/styles/banner.css                                  (edit: compact padding)
  - package.json                                              (edit: gate-d scripts)
  - docs/CHANGELOG.md                                         (append)
  - docs/ADR-018-mobile-touch-strategy.md                     (Status: Accepted)

FILES READ-ONLY (reference only):
  - docs/ADR-001-block-reason-protocol.md
  - docs/ADR-006-accessibility-ci-gate.md
  - editor/styles/tokens.css (token names for banner.css)
  - editor/styles/responsive.css (compact breakpoint values)
  - editor/src/constants.js

SUB-TASKS: (verbatim from WO sub-tasks section 1–13)

INVARIANTS (NEVER violate):
  - No type="module"; no bundler
  - Gate-A 55/5/0 preserved
  - Russian UI copy VERBATIM (Перемещение и изменение размера — только на desktop etc.)
  - Tap-select, tap-edit-text, tap-switch-slide MUST still work on 390/640/820
  - Drag, resize, rail-reorder MUST emit banner on 390/640/820
  - NO new banner DOM — reuse unified #shellBanner from WO-29
  - gate-D covers 3 viewports EXACTLY (no new ones added)
  - file:// workflow preserved

ACCEPTANCE: (verbatim from Acceptance criteria section)

ON COMPLETION:
  1. Run `npm run test:gate-a` — 55/5/0
  2. Run `npm run test:gate-d` — new spec × 3 viewports passes
  3. Manual verification of Russian copy in banners (word-for-word)
  4. git add tests/playwright/specs/tablet-honest.spec.js tests/playwright/helpers/tablet-fixtures.js
       editor/src/feedback.js editor/src/selection.js editor/src/slide-rail.js
       editor/styles/banner.css package.json docs/CHANGELOG.md docs/ADR-018-mobile-touch-strategy.md
  5. Conventional commit: "feat(mobile): tablet honest-block posture + gate-D +10 tests — v0.32.1 WO-33"
  6. Report back: files changed, LOC delta, gate results, viewport-specific findings if any
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Removes the new spec + helpers + banner CSS media query + `selection.js`/`slide-rail.js` guards. Legacy gate-D continues passing. No ADR consequence rollback needed (ADR-018 stays Accepted even if implementation reverts; add `[WITHDRAWN v0.32.2]` note if a second revert is needed). NO fix-forward under pressure.

---
