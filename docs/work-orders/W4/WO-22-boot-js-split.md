## Step 22 — v0.31.2 · Split `boot.js` → `theme.js` + `zoom.js` + `shell-layout.js`

**Window:** W4   **Agent-lane:** γ (Module split)   **Effort:** L
**ADR:** —   **PAIN-MAP:** P1-07, P1-08
**Depends on:** WO-16 (ui slice — theme.js/zoom.js read via store.get('ui')), WO-21 (prefer after the selection split so big refactors don't stack)   **Unblocks:** post-v1.0 `main.js` entry-point cleanup (P1-08 fully closes when orphan DOM reparent also moved)

### Context (3–5 lines)

Per AUDIT-A §boot.js + PAIN-MAP P1-07, `boot.js` is **1962 LOC** bundling 13 unrelated concerns: theme, complexity, selection-mode, zoom, bindings, modals, shell-layout, slide-template, asset-resolver, video-modal, and more. Target after this WO: **boot.js retains ~350 LOC — just `init()` plus the orphan DOM reparent that currently lives in `main.js:5-10` (closes P1-08)**. Three new modules are created: `theme.js` (~115 LOC), `zoom.js` (~75 LOC), `shell-layout.js` (~250 LOC). Modals/slide-template/asset-resolver stay in boot.js for now (separate WO-22b can address them post-v1.0). The split is **not** a rewrite — cut/paste with no body edits, same rules as WO-20/WO-21.

### Split map (function-name → destination-file)

From `boot.js` 1962 LOC, extract three files:

#### Destination 1 — `editor/src/theme.js` (~115 LOC)

| Source line | Function |
|---|---|
| boot.js:49 | `resolveSystemTheme()` |
| boot.js:56 | `getThemePreferenceLabel(preference)` |
| boot.js:67 | `queueThemeTransitionUnlock()` |
| boot.js:76 | `syncThemeDatasets(theme)` |
| boot.js:86 | `applyResolvedTheme(theme, options)` |
| boot.js:111 | `initTheme()` |
| boot.js:160 | `setThemePreference(preference, persist)` |
| boot.js:180 | `toggleTheme()` |

#### Destination 2 — `editor/src/zoom.js` (~75 LOC)

| Source line | Function |
|---|---|
| boot.js:260 | `initPreviewZoom()` |
| boot.js:276 | `setPreviewZoom(zoom, persist)` |
| boot.js:291 | `applyPreviewZoom()` |
| boot.js:310 | `updatePreviewZoomUi()` |
| boot.js:327 | `stepZoom(direction)` |

#### Destination 3 — `editor/src/shell-layout.js` (~250 LOC)

| Source line | Function |
|---|---|
| boot.js:343 | `setToggleButtonState(button, active)` (generic — used by shell + complexity; keep here) |
| boot.js:349 | `setDisclosureButtonState(button, expanded, controlsId)` |
| boot.js:637 | `bindShellLayout()` |
| boot.js:694 | `isCompactShell()` |
| boot.js:700 | `syncShellPanelFocusableState(panel, shouldShow)` |
| boot.js:726 | `setElementInertState(element, inert)` |
| boot.js:731 | `applyShellPanelState()` |
| boot.js:770 | `syncShellPanelVisibility(panel, shouldShow, options)` |
| boot.js:787 | `setShellPanelState(side, open)` |
| boot.js:807 | `toggleShellPanel(side)` |
| boot.js:814 | `closeShellPanels(options)` |

**Helpers that STAY in boot.js** (large subsystems not split in this WO — future scope):
- `initComplexityMode`/`setComplexityMode`/`applyComplexityModeUi` (lines 193–388) — coupled to mode-toggle UI, keep in boot
- `initSelectionMode`/`setSelectionMode`/`applySelectionModeUi` (lines 224–258) — keep
- `bindTopBarActions`/`bindModals`/`bindShellChromeMetrics`/`bindSlideTemplateActions` — keep
- All `getSlideTemplateButtons`/`isSlideTemplateBarOpen`/etc. (828+) — keep
- All asset-resolver helpers (`resolveAssetCandidatePath`/`applyAssetResolverToPreviewDoc`/etc. 1479+) — keep
- `openVideoInsertModal` (1842+) — keep

**P1-08 closure: `main.js` orphan reparent code:** Move the 6 lines of DOM reparent code from `main.js:5-10` INTO `boot.js` — absorbed into a new small `ensureSlideTemplateBarRoot()` helper called first thing in `init()`. `main.js` reduces to 4 lines (comment + `init()`).

**Boot.js LOC after this WO:** 1962 − 115 − 75 − 250 − 6 (main.js absorption adds back) + 20 (comments) = **~1536 LOC**.
**Main.js LOC after this WO:** 12 → 4 (only comment + `init()`).

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/theme.js` | new | +130 / −0 |
| `editor/src/zoom.js` | new | +85 / −0 |
| `editor/src/shell-layout.js` | new | +270 / −0 |
| `editor/src/boot.js` | edit | +25 / −440 (remove moved blocks; absorb main.js orphan; leave ZONE comments) |
| `editor/src/main.js` | edit | +0 / −8 (reduces to 4 LOC — header comment + `init()`) |
| `editor/presentation-editor.html` | edit | +3 / −0 (three new `<script src>` lines) |
| `docs/CHANGELOG.md` | edit | +4 / −0 |
| `.codex/skills/html-presentation-editor/references/project-map.md` | edit | +8 / −4 (count 27 → 30, new module descriptions, updated boot.js description) |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/boot.js` lines 49–191 (theme) | source of theme.js |
| `editor/src/boot.js` lines 260–341 (zoom) | source of zoom.js |
| `editor/src/boot.js` lines 637–826 (shell layout) | source of shell-layout.js |
| `editor/src/main.js` lines 5–10 | orphan reparent — absorbed into boot.js |
| `editor/presentation-editor.html` lines 1761–1785 | script load order |
| `docs/audit/AUDIT-A-architecture.md` §boot.js, §main.js | split rationale |
| `docs/PAIN-MAP.md` §P1-07, §P1-08 | scope |
| `editor/src/store.js` (post-WO-16) | theme/zoom use `store.update('ui', ...)` — WO-16 contract |

### Sub-tasks (executable, each ≤ 2 h)

1. Pre-flight: confirm WO-16/17/19/20/21 merged (theme/zoom already route through store, selection.js split done). `npm run test:gate-a` 55/5/0; `npm run test:unit` 42/42; record `git rev-parse HEAD`. Expected state after: clean baseline.
2. Create `editor/src/theme.js` with header:
```
// theme.js
// Layer: Application Bootstrap (Theme)
// Theme preference (light/dark/system), FOUC-safe applyResolvedTheme, matchMedia subscription.
// Reads + writes via window.store.ui slice (ADR-013).
// Extracted from boot.js in v0.31.2 per PAIN-MAP P1-07.
```
Expected state after: empty module file.
3. Cut/paste 8 theme functions from `boot.js:49-191` into `theme.js`. Preserve indentation. No body edits. Expected state after: theme.js ~130 LOC.
4. Repeat for `zoom.js`: create + cut/paste 5 zoom functions from `boot.js:260-341`. Header:
```
// zoom.js
// Layer: Application Bootstrap (Preview Zoom)
// CSS-zoom-based preview scale, clamp 0.25–2.0, persist in localStorage.
// Reads + writes via window.store.ui.previewZoom (ADR-013 phase 1).
// Extracted from boot.js in v0.31.2 per PAIN-MAP P1-07.
```
Expected state after: zoom.js ~85 LOC.
5. Repeat for `shell-layout.js`: create + cut/paste 11 functions from `boot.js:343-354` + `boot.js:637-826` into `shell-layout.js`. Header:
```
// shell-layout.js
// Layer: UI Chrome (Shell Layout)
// Responsive shell: compact-shell detection, panel open/close, roving focus.
// Extracted from boot.js in v0.31.2 per PAIN-MAP P1-07.
```
Expected state after: shell-layout.js ~270 LOC.
6. In `boot.js` delete the extracted blocks. Replace each with a single comment:
```
      // Theme functions moved to theme.js (WO-22).
```
(and similar for zoom + shell-layout). Expected state after: boot.js drops ~440 LOC.
7. Absorb `main.js:5-10` orphan code (P1-08 closure). Add a helper in boot.js:
```
      function ensureSlideTemplateBarRoot() {
        if (els.slideTemplateBar && els.slideTemplateBar.parentElement !== document.body) {
          document.body.appendChild(els.slideTemplateBar);
        }
      }
```
Call it as the first line of `init()` inside `boot.js:12`. In `main.js` delete lines 5–10, leaving:
```
// main.js — entry point
// All module scripts have been evaluated at this point.
      init();
```
Expected state after: main.js is 4 LOC; boot.js absorbs the reparent with named helper.
8. Add `<script src>` lines in `editor/presentation-editor.html`. New order:
```
1761	constants.js
1762	store.js      (from WO-16)
1763	state.js
1764	onboarding.js
1765	dom.js
1766	bridge.js
1767	shortcuts.js
1768	clipboard.js
1769	import.js
1770	slides.js
1771	bridge-script.js
1772	preview.js
1773	bridge-commands.js
1774	slide-rail.js
1775	style-app.js
1776	export.js
1777	history.js
1778	feedback.js
1779	selection.js
1780	layers-panel.js      (from WO-20)
1781	floating-toolbar.js  (from WO-21)
1782	toolbar.js
1783	context-menu.js
1784	inspector-sync.js
1785	shell-overlays.js
1786	theme.js             (NEW — from this WO)
1787	zoom.js              (NEW — from this WO)
1788	shell-layout.js      (NEW — from this WO)
1789	boot.js
1790	primary-action.js
1791	main.js
```
(Line numbers are illustrative — verify actual lines in the editor.)
Theme/zoom/shell-layout load AFTER all their upstream callers defined (state, els, store) but BEFORE boot.js (which calls `initTheme`, `initPreviewZoom`, `bindShellLayout` in `init()`). Expected state after: HTML has 3 new script lines in correct place.
9. Runtime guards at top of each new file:
- `theme.js`: `if (typeof window.store?.get !== 'function') throw new Error('theme.js requires store.js loaded first');`
- `zoom.js`: same guard (depends on store for previewZoom slice).
- `shell-layout.js`: `if (typeof state !== 'object' || !els) throw new Error('shell-layout.js requires state.js loaded first');`
Expected state after: boot-order mistakes fail loud.
10. Audit: `grep -n "initTheme\|toggleTheme\|setThemePreference\|initPreviewZoom\|setPreviewZoom\|stepZoom\|bindShellLayout\|isCompactShell\|setShellPanelState\|toggleShellPanel\|closeShellPanels\|applyShellPanelState" editor/src/*.js editor/presentation-editor.html`. Expect hits in `boot.js` (init() body), `bridge-commands.js` (maybe via refreshUi), `shortcuts.js` (Ctrl+Shift+T), `shell-overlays.js` (modal focus — uses setShellPanelState). Confirm every caller resolves via global scope. Expected state after: no call-site breaks.
11. Manual smoke tests: (a) theme toggle Ctrl+Shift+T — light ↔ dark works, persist across reload; (b) system-theme change via OS setting — editor follows (matchMedia subscription); (c) zoom buttons + + -/0 — CSS zoom applied, selection overlay moves; (d) compact shell (resize < 1024) — left/right panels collapse to overlays; (e) mobile rail buttons (slides/preview/edit/insert/inspector) route correctly; (f) open deck at < 640px — popovers become sheets. Expected state after: all 6 interactions work identically to v0.31.1.
12. Run `npm run test:gate-a` 55/5/0; `npm run test:gate-b` green; `npm run test:gate-d` (mobile) green; `npm run test:unit` 42/42. Expected state after: all gates unchanged.
13. Update `.codex/skills/html-presentation-editor/references/project-map.md`: module count 27 → 30. Add entries for `theme.js` / `zoom.js` / `shell-layout.js`. Update `boot.js` description: `Application bootstrap: init() + complexity/selection-mode/modals/slide-template-actions/asset-resolver/video-modal (remaining concerns after WO-22).` Update `main.js` description: `Entry point — calls init() after all module scripts parsed.`. Expected state after: project-map reflects reality.
14. Update `docs/CHANGELOG.md` `## Unreleased` → `### Changed`: `Split boot.js → theme.js + zoom.js + shell-layout.js (440 LOC extracted); boot.js now ~1500 LOC. main.js orphan DOM reparent absorbed into boot.js::ensureSlideTemplateBarRoot — PAIN-MAP P1-08 CLOSED. PAIN-MAP P1-07 partially closed (boot.js further split deferred to post-v1.0).` Expected state after: changelog accurate.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added
- [ ] Gate-A 55/5/0 before merge
- [ ] `file://` workflow still works
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A (no CSS)
- [ ] Russian UI-copy byte-identical — especially `getThemePreferenceLabel` return values `"☀ Светлая"`, `"🌙 Тёмная"`, `"🖥 Система"`; toasts `"Системная тема изменилась: ${...}."`; `"Тема редактора: ${...}."`
- [ ] Script load order: store.js → state.js → ... → theme.js → zoom.js → shell-layout.js → boot.js → primary-action.js → main.js
- [ ] Zero `import` or `require` statements
- [ ] Zero function-body edits — cut/paste only (plus the tiny `ensureSlideTemplateBarRoot` helper, which is new boilerplate around existing logic)
- [ ] Runtime guards at top of theme.js + zoom.js + shell-layout.js fail loud on load-order mistake
- [ ] `main.js` is exactly 4 LOC: header comment + `init()`
- [ ] CLAUDE.md §8 invariant ("init() as last line of main.js") restored — orphan code is GONE from main.js (closes P1-08)
- [ ] `init()` still the sole kickoff from main.js — no DOM mutation before init()
- [ ] `window.store.ui` slice unchanged — theme.js/zoom.js keep using `store.update('ui', patch)` pattern from WO-16
- [ ] `window.state` Proxy unchanged

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `wc -l editor/src/boot.js` → 1520 ± 20 LOC
- [ ] `wc -l editor/src/theme.js` → 130 ± 5
- [ ] `wc -l editor/src/zoom.js` → 85 ± 5
- [ ] `wc -l editor/src/shell-layout.js` → 270 ± 10
- [ ] `wc -l editor/src/main.js` → 4 exact (header + `init();`)
- [ ] `grep -n "function initTheme" editor/src/boot.js` → 0 matches
- [ ] `grep -n "function initTheme" editor/src/theme.js` → 1 match
- [ ] `grep -n "function setPreviewZoom" editor/src/boot.js` → 0 matches
- [ ] `grep -n "function bindShellLayout" editor/src/boot.js` → 0 matches
- [ ] `npm run test:gate-a` → 55/5/0 unchanged
- [ ] `npm run test:gate-b` → green
- [ ] `npm run test:gate-d` (mobile) → green (shell-layout affects mobile)
- [ ] `npm run test:unit` → 42/42
- [ ] Manual 6-step smoke (theme + zoom + responsive) passes zero console errors
- [ ] PAIN-MAP P1-08 marked CLOSED in CHANGELOG; P1-07 marked partially closed
- [ ] Project-map module count 30
- [ ] Commit message: `refactor(arch): split boot.js → theme + zoom + shell-layout; close main.js orphan — v0.31.2 WO-22`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| theme toggle end-to-end | gate-a | `tests/playwright/editor.regression.spec.js` | pass (55/5/0) | pass (55/5/0) |
| zoom ± buttons work | gate-b | existing spec | pass | pass |
| compact shell panel collapse | gate-d | mobile spec | pass | pass |
| deck load without console errors | gate-a | regression | pass | pass |
| ensureSlideTemplateBarRoot called once per init | manual | devtools observation | N/A | reparent happens at init, not later |
| main.js file content exactly "init();" | static | `wc -l editor/src/main.js` | 12 | 4 |

### Risk & mitigation

- **Risk:** `theme.js` / `zoom.js` / `shell-layout.js` have subtle cross-dependencies — e.g. `applyComplexityModeUi` in boot.js reads `state.complexityMode` AND writes DOM on `basic`/`advanced` — if complexity-mode is NOT in scope but theme.js indirectly depends on it, a cut can break state sync.
- **Mitigation:** Complexity-mode functions STAY in boot.js (listed as "STAY" in Split map). Theme.js only reads `state.theme`/`state.themePreference` + writes via `store.update('ui', {...})`. No cross-wire. Grep confirms: `grep -n "complexityMode\|applyComplexityModeUi" editor/src/theme.js` → 0 matches.
- **Risk:** `bindShellLayout` has a hidden dependency on `state.modelDoc` (sub-task in `mobileEditBtn` click — calls `openOpenHtmlModal()`). Moving it to shell-layout.js means `openOpenHtmlModal` (still in boot.js) is called across files via global scope — works but relies on ordering.
- **Mitigation:** Script load order has `shell-layout.js` BEFORE `boot.js`. Hoisting: `openOpenHtmlModal` is defined in boot.js — at call time (user click after init complete), the global is set. Classic-script invariant respected. Manual smoke test (sub-task 11e) covers this code path.
- **Risk:** `main.js` absorption of orphan code (P1-08) changes the CLAUDE.md §8 invariant (`init() as last line of main.js`) timing — if a future module adds a `<script>` with side effects AFTER main.js, order breaks.
- **Mitigation:** Add an inline comment above `init()` in `main.js`: `// CLAUDE.md §8: init() must remain the last statement — no DOM mutation before it (PAIN-MAP P1-08 closed v0.31.2).`. Future contributors see the invariant explicitly.
- **Risk:** `ensureSlideTemplateBarRoot` moves the DOM reparent from pre-init to first-line-of-init — on some timing-sensitive paths, `els.slideTemplateBar` lookup happens BEFORE the reparent.
- **Mitigation:** `els.slideTemplateBar = document.getElementById("slideTemplateBar")` in state.js runs at script-parse time, well before init. The reparent changes the `parentElement` chain but NOT the `el` reference. All el users remain valid.
- **Risk:** Three new `<script src>` lines in HTML — easy to mis-order during a merge conflict.
- **Mitigation:** Runtime guards in each new file fail loud at boot. HTML is editing-heavy but small; commit message includes explicit load order for future reviewers.
- **Risk:** Test that grep-checks `main.js` content breaks — some CI may scan main.js expecting specific content.
- **Mitigation:** Grep tests directory for `main.js` hardcoded references. Update in-scope if found.
- **Rollback:** `git revert <sha>`. Three cut/paste moves + one main.js absorption = fully reversible. NO fix-forward under pressure.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:legacy-modernizer
isolation: worktree
branch_prefix: claude/wo-22-boot-js-split
```

````markdown
You are implementing Step 22 (v0.31.2 split boot.js → theme/zoom/shell-layout + close P1-08) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-22-boot-js-split   (create from main, post WO-16/17/19/20/21 merge — NOT in parallel with WO-23)

PRE-FLIGHT:
  1. Read CLAUDE.md (pay special attention to §8 invariant about init() as last line of main.js)
  2. Read docs/audit/AUDIT-A-architecture.md §boot.js + §main.js
  3. Read docs/PAIN-MAP.md §P1-07, §P1-08
  4. Read this WO's Split map carefully — know exactly which functions move and which stay
  5. Verify baseline: `wc -l editor/src/boot.js` → 1962; `wc -l editor/src/main.js` → 12; test:gate-a 55/5/0; test:unit 42/42

FILES YOU OWN (exclusive write):
  - editor/src/theme.js              (new — ~130 LOC, 8 functions)
  - editor/src/zoom.js               (new — ~85 LOC, 5 functions)
  - editor/src/shell-layout.js       (new — ~270 LOC, 11 functions)
  - editor/src/boot.js               (edit — remove ~440 LOC, add ensureSlideTemplateBarRoot helper)
  - editor/src/main.js               (edit — reduces to 4 LOC: comment + init())
  - editor/presentation-editor.html  (edit — add 3 new <script src> lines)
  - docs/CHANGELOG.md
  - .codex/skills/html-presentation-editor/references/project-map.md

FILES READ-ONLY (reference only):
  - docs/audit/AUDIT-A-architecture.md
  - docs/PAIN-MAP.md
  - editor/src/bridge-commands.js (callers)
  - editor/src/shortcuts.js (Ctrl+Shift+T caller)
  - editor/src/shell-overlays.js (modal focus)
  - editor/src/store.js (WO-16 contract)

SUB-TASKS:
  1. Pre-flight gate-A + test:unit + LOC baseline
  2. Create theme.js with header + 8 cut/paste functions
  3. Create zoom.js with header + 5 cut/paste functions
  4. Create shell-layout.js with header + 11 cut/paste functions
  5. Remove moved blocks from boot.js; leave 3 ZONE comments
  6. P1-08 closure: add ensureSlideTemplateBarRoot() in boot.js; delete orphan from main.js
  7. Add 3 <script src> lines in HTML in correct order
  8. Runtime guards on each new file
  9. Audit all call-sites via grep
  10. Manual 6-step smoke test (theme, system theme, zoom, compact, mobile rail, popover sheet)
  11. Gate-A + Gate-B + Gate-D + test:unit green
  12. Update project-map.md (27 → 30) + CHANGELOG (P1-08 CLOSED; P1-07 partial)

INVARIANTS (NEVER violate):
  - No type="module", no bundler
  - Gate-A 55/5/0 preserved
  - file:// still works
  - Russian UI copy byte-identical (theme labels, toasts)
  - Script load order: constants → store → state → ... → theme → zoom → shell-layout → boot → primary-action → main
  - Runtime guards on each new file
  - main.js is EXACTLY 4 LOC post-WO (comment + init())
  - CLAUDE.md §8 invariant restored (init() = last line of main.js, no DOM mutation before it)
  - Zero function-body edits — cut/paste only (new ensureSlideTemplateBarRoot is a 3-line wrapper)
  - window.store.ui slice interface unchanged (theme/zoom keep using store.update)
  - Complexity-mode + selection-mode + modals + slide-template + asset-resolver STAY in boot.js

ACCEPTANCE:
  - boot.js LOC ~ 1520 (± 20)
  - theme.js / zoom.js / shell-layout.js LOC match split map (± 10%)
  - main.js LOC = 4 exact
  - Gate-A 55/5/0; Gate-B green; Gate-D mobile green; test:unit 42/42
  - Manual 6-step smoke passes zero console errors
  - PAIN-MAP P1-08 CLOSED; P1-07 partially closed (documented in CHANGELOG)
  - project-map.md module count = 30
  - Conventional commit: refactor(arch): split boot.js → theme + zoom + shell-layout; close main.js orphan — v0.31.2 WO-22

ON COMPLETION:
  1. Run acceptance matrix
  2. git add editor/src/theme.js editor/src/zoom.js editor/src/shell-layout.js editor/src/boot.js editor/src/main.js editor/presentation-editor.html docs/CHANGELOG.md .codex/skills/html-presentation-editor/references/project-map.md
  3. Conventional commit per above
  4. Report back: LOC before/after each file, gate results, any audit discoveries, P1-07 remaining scope for post-v1.0
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Large-WO revert — three new files gone, boot.js restored, main.js restored. Zero data migration. Re-plan as three separate smaller WOs: WO-22a (theme.js only), WO-22b (zoom.js only), WO-22c (shell-layout.js + main.js absorption). Each can be reverted independently. NO fix-forward under pressure.
