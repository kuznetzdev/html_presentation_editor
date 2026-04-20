## Step 06 — v0.27.0 · Broken-asset recovery banner + iframe sandbox-attrs audit

**Window:** W2   **Agent-lane:** D (Security) + coordinating with Agent δ (UX banner-text)   **Effort:** M
**ADR:** ADR-014   **PAIN-MAP:** P0-01 (part 1 of 2 — structural plumbing + sandbox audit), P0-04 (overlap with Agent δ on banner-text copy)
**Depends on:** WO-01 (sanitization in bridge path — reduces banner false-positives), WO-02 (origin assertion — ensures banner's detection rules operate on trusted input)   **Unblocks:** WO-07 (Trust-Banner script detection reuses the banner plumbing and iframe sandbox flag surfaces added here)

### Context (3–5 lines)

Per AUDIT-D-01 + AUDIT-D-07 the preview iframe is explicitly un-sandboxed at `import.js:97` (`els.previewFrame.removeAttribute("sandbox")`) with NO inline comment tying this to the trust-model decision, and per PAIN-MAP P0-04 pasted decks with missing assets (`<img>`, `<link>`, `<video>` with unresolvable src) silently load with no recovery banner. This WO ships: (1) the `shellBoundary` banner plumbing per ADR-014 §Layer 1 — a single stacked region that future work hooks into; (2) a non-blocking broken-asset enumeration banner with a one-click `"Подключить папку ресурсов"` action (reuses existing `previewAssistActionBtn`); (3) a `SANDBOX_MODE` state flag (`off` default, `scripts-only`, `full`) + an inline-anchored comment at `import.js:97`. The sandbox flag is not wired to UI here — it's the plumbing WO-07 will flip. The banner copy is the user-facing interface co-owned with Agent δ (see "Cross-batch hand-off" below).

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/import.js` | edit | +60 / −3 |
| `editor/src/feedback.js` | edit | +85 / −0 |
| `editor/src/state.js` | edit | +5 / −0 |
| `editor/src/constants.js` | edit | +10 / −0 |
| `editor/presentation-editor.html` | edit | +6 / −0 (new `<div id="shellBanner">` region slot in shell chrome) |
| `editor/styles/banners.css` | new | +60 / −0 |
| `editor/styles/tokens.css` | edit | +1 / −0 (register new `@layer` first) |
| `tests/playwright/broken-asset-banner.spec.js` | new | +120 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/import.js:88–112` | preview load site; collect asset-probe results after `buildPreviewPackage` |
| `editor/src/import.js:97` | explicit `removeAttribute("sandbox")` — must be annotated |
| `editor/src/feedback.js` | `showToast`, `reportShellWarning`, surface-manager hooks |
| `docs/ADR-014-error-boundaries.md` | shellBoundary.report() contract Layer 1 |
| `docs/audit/AUDIT-D-security.md` §§ AUDIT-D-01, AUDIT-D-07 | remediation |
| `docs/audit/PAIN-MAP.md` row P0-04 | broken-asset banner requirement |
| `editor/src/state.js` | location to add `state.sandboxMode` slice |

### Sub-tasks (executable, each ≤ 2 h)

1. Add `SANDBOX_MODES = Object.freeze({ OFF: 'off', SCRIPTS_ONLY: 'scripts-only', FULL: 'full' })` to `editor/src/constants.js`, plus `DEFAULT_SANDBOX_MODE = SANDBOX_MODES.OFF`. Expected state after: shared enum for sandbox levels.
2. Add `state.sandboxMode = DEFAULT_SANDBOX_MODE` to `state.js` initial shape (alphabetical position among booleans/modes; do NOT mutate existing fields). Expected state after: state slice reserved; no behavior change yet.
3. In `editor/src/import.js:97`, replace the bare `removeAttribute("sandbox")` with a conditional block:
   ```
   // Sandbox policy (see ADR-014 §Layer 3; AUDIT-D-01/07).
   // Default OFF preserves deck-script engines (Reveal, Shower). WO-07 Trust-Banner flips to SCRIPTS_ONLY when scripts are detected and user opts in.
   switch (state.sandboxMode) {
     case SANDBOX_MODES.SCRIPTS_ONLY:
       els.previewFrame.setAttribute('sandbox', 'allow-same-origin allow-scripts');
       break;
     case SANDBOX_MODES.FULL:
       els.previewFrame.setAttribute('sandbox', 'allow-scripts');
       break;
     case SANDBOX_MODES.OFF:
     default:
       els.previewFrame.removeAttribute('sandbox');
   }
   ```
   Expected state after: flag-controlled sandbox decision + inline comment per AUDIT-D-07. Default unchanged → no behavioral change at this WO.
4. In `editor/presentation-editor.html` add `<div id="shellBanner" data-editor-ui="true" class="shell-banner shell-banner--empty" aria-live="polite" role="region" aria-label="Системные уведомления"></div>` in the shell chrome area (locate just after the topbar block; check existing `data-editor-ui="true"` elements for positional consistency). Expected state after: banner region exists in shell DOM.
5. In `editor/styles/tokens.css` register new `@layer banners` FIRST (prepend — declaration order matters per invariant §8 of CLAUDE.md). Expected state after: layer declared before consumers.
6. Create `editor/styles/banners.css` with `@layer banners { ... }` wrapping: `.shell-banner`, `.shell-banner--empty { display: none; }`, `.shell-banner__item` (stacked vertical list), `.shell-banner__icon` (kind=info/warning/error), `.shell-banner__message`, `.shell-banner__action-btn`, `.shell-banner__dismiss`. Mobile-safe (no fixed widths; uses token variables). Expected state after: CSS ready; no layout regression on Gate-A.
7. In `editor/src/feedback.js` add the `shellBoundary` API per ADR-014 §Layer 1:
   ```
   const shellBanners = new Map(); // code → { kind, message, action, dismissible, el }
   function shellBoundary_report({ kind, code, message, action, dismissible }) { ... }
   function shellBoundary_clear(code) { ... }
   window.shellBoundary = { report: shellBoundary_report, clear: shellBoundary_clear };
   ```
   Each report creates or updates a DOM node inside `#shellBanner`; `kind` drives icon + styling via data-kind attr. Action buttons wire `onClick` through `{once: false}`. Dismissible renders an `aria-label="Закрыть"` × button. Toggles `.shell-banner--empty` class when the Map is empty. Expected state after: reusable API for WO-07 and future WOs; unit-testable.
8. Implement `probeBrokenAssets(doc)` helper in `import.js`: walk `<img>`, `<video>`, `<source>`, `<link>` elements; for each with a `src`/`href`, attempt to resolve (use existing asset-resolver if `state.assetResolver*` is configured; otherwise perform a HEAD request when origin is `http://localhost:*`; skip under `file://` where CORS denies probing and surface inline the count from the load-error events instead). Return `{ missing: [{ tag, url, alt }], total }`. Expected state after: helper exists with file:// + localhost branches.
9. Wire `probeBrokenAssets` into the post-iframe-load hook (`els.previewFrame.onload`). If `missing.length > 0`, call `shellBoundary.report({ kind: 'warning', code: 'broken-assets', message: "Не удалось загрузить ${N} ресурс(ов) (изображения/ссылки).", action: { label: "Подключить папку ресурсов", onClick: () => state.previewAssistActionBtn?.click() }, dismissible: true })`. The action button click target is the existing `previewAssistActionBtn` wiring (do NOT duplicate its opener logic). Expected state after: banner fires on broken assets; Russian UI copy preserved literally.
10. On subsequent successful asset-directory pick (existing handler), call `shellBoundary.clear('broken-assets')` to remove the banner. Expected state after: banner persists until resolved or dismissed; no dead-end.
11. Write `tests/playwright/broken-asset-banner.spec.js`: (a) open a paste-HTML fixture with `<img src="missing/foo.png">` under localhost — confirm banner with code=`broken-assets`, count "1", Russian copy, action button present; (b) click action button — `previewAssistActionBtn` click handler fires (stub its side-effect); (c) dismiss the banner — `#shellBanner` returns to `--empty` state; (d) file:// branch smoke — banner appears with inferred missing count from iframe load-error events. Expected state after: 4 behavioral assertions pass on chromium-desktop.
12. Gate-A: `npm run test:gate-a` must remain 55/5/0. Visually inspect: banner region collapsed when empty (no vertical space stolen). Expected state after: no gate regression; shell layout unchanged when no banners active.
13. Manual smoke: open `references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html` — confirm NO banner (all assets resolve); open a fixture with known-missing `<img src="this-does-not-exist.png">` — confirm banner fires, copy is Russian literal. Expected state after: signal quality validated on a real deck.
14. Update `docs/CHANGELOG.md` `## Unreleased` → `### Security / UX`: `shellBoundary.report banner region (ADR-014 Layer 1). Broken-asset banner with "Подключить папку ресурсов" action (P0-04). Iframe SANDBOX_MODE flag + inline comment at import.js sandbox site (AUDIT-D-07).`. Expected state after: changelog entry present.
15. Note in commit body the hand-off to Agent δ's WO-24 (user-facing asset-list UI): "banner text + plumbing live in WO-06 (this commit); the detailed asset-list modal that opens from the action button is Agent δ's WO-24 scope."

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (broken-asset banner still fires via load-error fallback; asset probing degrades gracefully)
- [ ] New `@layer banners` declared first in `editor/styles/tokens.css` (new layer introduced — INVARIANT applies)
- [ ] Russian UI-copy strings preserved literally: `"Не удалось загрузить ${N} ресурс(ов) (изображения/ссылки)."`, `"Подключить папку ресурсов"`, `"Закрыть"`, `"Системные уведомления"`
- [ ] Reference decks `v3-prepodovai-pitch` + `v3-selectios-pitch` still load clean (no banner fires on them — all assets resolve)
- [ ] Deck-script-engine path untouched — `buildModelDocument` not modified
- [ ] Sandbox mode default is `off` (unchanged behavior); scripts engines Reveal/Shower keep working
- [ ] Broken-asset banner is non-blocking (`aria-live="polite"`), does not steal focus
- [ ] No new external network calls introduced — asset HEAD probe only fires under http://localhost:*, NEVER under file:// (where CORS denies it and fallback is used)

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `tests/playwright/broken-asset-banner.spec.js` all 4 cases pass
- [ ] `grep -n "import.js" editor/src/import.js:97` shows the inline comment block referencing ADR-014 / AUDIT-D-01/07
- [ ] `window.shellBoundary.report({ kind:'info', code:'test', message:'x', dismissible:true })` called from DevTools renders a banner; `window.shellBoundary.clear('test')` removes it
- [ ] `#shellBanner` region has `role="region"` and `aria-live="polite"`
- [ ] Gate-A remains 55/5/0 (`npm run test:gate-a`)
- [ ] Reference decks load clean with zero banners
- [ ] Manual smoke with deliberately-broken fixture: banner appears with Russian copy verbatim
- [ ] Sandbox flag enum exported from constants; state.sandboxMode initialized to `off`
- [ ] Commit message in conventional-commits format: `feat(security): shellBanner + broken-asset recovery + sandbox-mode flag — v0.27.0 WO-06`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Broken-asset banner fires on `<img src="missing">` | gate-a | `tests/playwright/broken-asset-banner.spec.js` | N/A | pass |
| Action button clicks preview-assist | gate-a | `tests/playwright/broken-asset-banner.spec.js` | N/A | pass |
| Dismissal returns banner region to empty state | gate-a | `tests/playwright/broken-asset-banner.spec.js` | N/A | pass |
| File:// fallback uses load-error events | gate-a | `tests/playwright/broken-asset-banner.spec.js` | N/A | pass |
| Reference deck v3-prepodovai-pitch — zero banners | gate-b | `tests/playwright/reference-pres-parity.spec.js` | pass | pass |
| Reference deck v3-selectios-pitch — zero banners | gate-b | `tests/playwright/reference-pres-parity.spec.js` | pass | pass |
| Gate-A baseline 55/5/0 | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** HEAD probing adds N extra network calls per deck open — slow + privacy-affecting.
- **Mitigation:** Probe only fires under `http://localhost:*` (LAN origin already trusted); under file:// the probe is disabled and fallback uses in-iframe load-error event counts. Parallelize with `Promise.allSettled` and cap at 50 probes max. Document the envelope in commit body.
- **Risk:** The banner region `#shellBanner` steals preview vertical space when populated.
- **Mitigation:** CSS `.shell-banner--empty { display: none; }` collapses it when empty; stacking is top-down with max-height + overflow-y:auto so it bounded at ~80 px. Manual visual check (sub-task 13).
- **Risk:** Agent δ's WO-24 asset-list modal may duplicate the banner copy or conflict with the action button wiring.
- **Mitigation:** Explicit hand-off in commit body + in this WO's sub-task 15. Banner action button merely triggers the existing `previewAssistActionBtn` — Agent δ owns that button's target modal.
- **Risk:** Broken-asset detection false-positives on CORS-opaque resources (cross-origin CDN images without CORS headers).
- **Mitigation:** Probe classifies status: `ok | missing | opaque`; banner counts only `missing`, not `opaque`. Document in spec comment.
- **Rollback:** `git revert <sha>`. The banner region + shellBoundary API are additive; sandbox mode default is `off` → behavior unchanged. Safe rollback without state migration.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:security-auditor
isolation: worktree
branch_prefix: claude/wo-06-broken-asset-recovery-sandbox
```

````markdown
You are implementing Step 06 (v0.27.0 broken-asset banner + iframe sandbox-mode flag) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-06-broken-asset-recovery-sandbox   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-014 (docs/ADR-014-error-boundaries.md) §Layer 1 in full
  3. Read AUDIT-D-security.md findings AUDIT-D-01 + AUDIT-D-07
  4. Read PAIN-MAP row P0-04
  5. Read editor/src/import.js lines 85–115 (preview load site) and line 97 (sandbox remove)
  6. Read editor/src/feedback.js in full (toast + reportShellWarning patterns)
  7. Read editor/presentation-editor.html around topbar area to locate shell-chrome slot
  8. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/import.js
  - editor/src/feedback.js
  - editor/src/state.js  (add sandboxMode slice only)
  - editor/src/constants.js  (SANDBOX_MODES enum + DEFAULT_SANDBOX_MODE)
  - editor/presentation-editor.html  (add #shellBanner region)
  - editor/styles/banners.css  (new @layer banners)
  - editor/styles/tokens.css  (register @layer banners FIRST)
  - tests/playwright/broken-asset-banner.spec.js  (new)
  - docs/CHANGELOG.md  (Unreleased entry)

FILES READ-ONLY (reference only):
  - docs/ADR-014-error-boundaries.md
  - docs/audit/AUDIT-D-security.md
  - docs/audit/PAIN-MAP.md
  - references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html
  - references_pres/html-presentation-examples_v3/selectios_pitch_v2_final.html

SUB-TASKS:
  1. Add SANDBOX_MODES enum + DEFAULT_SANDBOX_MODE to constants.js
  2. Add state.sandboxMode slice initialized to 'off'
  3. Replace bare removeAttribute("sandbox") in import.js:97 with switch on state.sandboxMode + inline ADR/AUDIT comment
  4. Add #shellBanner region to shell HTML (aria-live=polite, role=region, Russian aria-label)
  5. Register @layer banners FIRST in tokens.css
  6. Author editor/styles/banners.css with shell-banner visuals
  7. Add shellBoundary.report / .clear API to feedback.js (exposed on window)
  8. Implement probeBrokenAssets(doc) with http://localhost HEAD branch + file:// load-error fallback
  9. Wire probe into preview onload → fire banner with Russian copy + action button reusing previewAssistActionBtn
  10. Clear banner on successful asset-directory pick
  11. Write broken-asset-banner.spec.js (4 cases)
  12. Gate-A 55/5/0; visual check banner region collapsed when empty
  13. Manual smoke: v3-prepodovai-pitch clean; fixture-with-missing-img fires banner
  14. CHANGELOG Unreleased entry
  15. Hand-off note in commit body: banner text + plumbing in WO-06; Agent δ owns WO-24 asset-list modal target

INVARIANTS (NEVER violate):
  - No type="module" on any <script>
  - No bundler added
  - Gate-A 55/5/0 must hold
  - file:// works (fallback path doesn't require network probe)
  - NEW @layer banners declared first in tokens.css
  - Russian UI copy preserved literally (see WO list)
  - Reference decks v3-prepodovai-pitch + v3-selectios-pitch load clean with zero banners
  - Deck-script engines still work (default sandbox stays 'off')
  - Banner is non-blocking, never steals focus
  - No new external network calls added under file://; localhost probe capped at 50

ACCEPTANCE:
  - broken-asset-banner.spec.js: 4/4 pass
  - shellBoundary.report/clear testable from DevTools
  - Inline sandbox comment at import.js:97 references ADR-014 + AUDIT-D-01/07
  - Reference decks zero banners
  - Russian UI copy literal match
  - Gate-A remains 55/5/0
  - Conventional commit: feat(security): shellBanner + broken-asset recovery + sandbox-mode flag — v0.27.0 WO-06

ON COMPLETION:
  1. Run the full acceptance matrix
  2. git add editor/src/import.js editor/src/feedback.js editor/src/state.js editor/src/constants.js editor/presentation-editor.html editor/styles/banners.css editor/styles/tokens.css tests/playwright/broken-asset-banner.spec.js docs/CHANGELOG.md
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, gate results, banner visual screenshot, hand-off bullet for Agent δ WO-24
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Sandbox default stays `off` → behavior preserved. Banner region is additive, collapses to empty when no reports. Revert cleanly removes the region, API, and CSS without state migration.
