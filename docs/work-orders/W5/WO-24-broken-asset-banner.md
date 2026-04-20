## Step 24 — v0.27.0 · Broken-asset recovery banner

**Window:** W5   **Agent-lane:** D   **Effort:** M
**ADR:** ADR-014 (Error boundaries — Layer 1 shell surface)   **PAIN-MAP:** P0-04
**Depends on:** none (consumes `state.unresolvedPreviewAssets` which already ships)   **Unblocks:** WO-29 (banner unification will migrate this into the unified surface)

### Context (3–5 lines)

When a user pastes or opens HTML whose relative assets (`<img>`, `<link>`, `<video>`, `<source>`) fail to resolve, the editor currently loads silently with broken visuals and no recovery surface. `state.unresolvedPreviewAssets` is already populated (`editor/src/boot.js:1824`, `editor/src/state.js:363`) but the user sees only the stale modal copy. This WO adds a persistent shell-side banner that enumerates missing assets and keeps the `previewAssistActionBtn` action "Подключить папку ресурсов" reachable after modal close. Closes PAIN-MAP P0-04 (silent-fail onboarding blocker).

### Files owned (exclusive write)

| File | Op | LOC delta est |
|------|-----|---------------|
| `editor/src/broken-asset-banner.js` | new | +180 / −0 |
| `editor/styles/broken-asset-banner.css` | new | +90 / −0 |
| `editor/styles/tokens.css` | edit (layer decl only) | +1 / −1 |
| `editor/presentation-editor.html` | edit (banner region + script tag) | +30 / −0 |
| `editor/src/primary-action.js` | edit (wire `previewAssistActionBtn` config persistence) | +20 / −4 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/boot.js` | `state.unresolvedPreviewAssets` is populated here (line 1824); audit trace |
| `editor/src/state.js` | `previewAssistActionBtn` element ref (line 418); `unresolvedPreviewAssets` field (line 363) |
| `editor/src/export.js` | line 492 resets `unresolvedPreviewAssets`; must not regress |
| `editor/src/history.js` | lines 322–326 already log unresolvedAssets; diagnostic parity |
| `editor/src/feedback.js` | banner/toast API (`showToast`) for reuse |
| `editor/src/onboarding.js` | assetsBox copy reference (lines 70, 89–95) |
| `editor/presentation-editor.html` | topbar + preview-note layout context |
| `docs/ADR-014-error-boundaries.md` | kind="warning" Layer-1 contract |
| `docs/audit/AUDIT-B-ux-journeys.md` | Journey 2 detail (lines 78–104) |

### Sub-tasks (executable, each ≤ 2 h)

1. Read `editor/src/boot.js:1670–1830` to confirm the shape of each entry in `state.unresolvedPreviewAssets` (URL string vs `{url, kind}`). Record the exact shape in a comment at the top of `broken-asset-banner.js`. Expected state: `// UnresolvedAssetEntry = <shape literal copied from audit>`.
2. Create `editor/styles/broken-asset-banner.css` in a NEW `@layer broken-asset-banner` — declare it in `tokens.css` FIRST (sub-task 3 below). Styles use existing tokens: `--shell-warning-bg`, `--shell-warning-border`, `--shell-warning`, `--shell-text`, `--radius-md`, `--space-3`, `--space-4`, `--text-sm`, `--shadow-sm`. Do NOT introduce new color literals.
3. Edit `editor/styles/tokens.css` line 2 — extend the layer cascade `@layer tokens, base, layout, preview, inspector, overlay, modal, responsive;` to include `broken-asset-banner` **before** `overlay` (semantic grouping with other inline banners). Confirm it is declared exactly once. Reference: `editor/styles/tokens.css:2`. Expected state: layer list reads `@layer tokens, base, layout, preview, broken-asset-banner, inspector, overlay, modal, responsive;`.
4. Add the banner region to `editor/presentation-editor.html` immediately after `#blockReasonBanner` (search for `id="blockReasonBanner"` around line 860). Markup — insert verbatim (Russian UI copy is load-bearing):
```html
<div
  id="brokenAssetBanner"
  class="broken-asset-banner"
  role="status"
  aria-live="polite"
  aria-hidden="true"
  data-editor-ui="true"
  hidden
>
  <div class="broken-asset-banner__body">
    <div class="broken-asset-banner__title" id="brokenAssetBannerTitle">
      Не загружено 0 файлов
    </div>
    <ul class="broken-asset-banner__list" id="brokenAssetBannerList" aria-label="Список не найденных файлов"></ul>
    <div class="broken-asset-banner__footnote" id="brokenAssetBannerFootnote">
      Подключите папку проекта, чтобы редактор восстановил относительные ссылки.
    </div>
  </div>
  <div class="broken-asset-banner__actions">
    <button type="button" class="ghost-btn" id="brokenAssetBannerActionBtn">
      Подключить папку ресурсов
    </button>
    <button type="button" class="icon-btn" id="brokenAssetBannerDismissBtn" aria-label="Скрыть предупреждение">×</button>
  </div>
</div>
```
   Expected state: banner hidden by default, becomes visible when `state.unresolvedPreviewAssets.length > 0`.
5. Create `editor/src/broken-asset-banner.js` — classic-script module (no ESM). Export four globals on `window`:
   - `window.updateBrokenAssetBanner()` — idempotent render pass; hides when `state.unresolvedPreviewAssets?.length` is 0, otherwise shows, renders count + up to 5 sample entries + "… и ещё N" fallback.
   - `window.dismissBrokenAssetBanner()` — sets `state.brokenAssetBannerDismissed = true` for this session; banner stays hidden until next `loadHtmlString`.
   - `window.resetBrokenAssetBannerDismissal()` — clears the dismissed flag; call from the code path that resets `state.unresolvedPreviewAssets` in `export.js:492`.
   - `window.bindBrokenAssetBanner()` — wires dismiss button + action button click → invoke the existing `previewAssistActionBtn` action (look up the action config via `els.previewAssistActionBtn?.dataset.action` OR by calling the same handler used at `boot.js:413–414`).
6. Wire `bindBrokenAssetBanner()` from `init()` via a new line inside the shell overlays bootstrap block — add a call immediately AFTER the existing `ensureNoviceShellOnboardingUi()` invocation in `main.js` if present, or otherwise in `boot.js` next to `bindPrimaryAction()`. Reference: grep `bindPrimaryAction` to find the init site. Expected state: `typeof window.bindBrokenAssetBanner === "function" && window.bindBrokenAssetBanner()` runs exactly once during init.
7. Hook `updateBrokenAssetBanner()` into the existing state-write site at `boot.js:1824` (`state.unresolvedPreviewAssets = safeAudit.unresolved;`). Add a single line immediately after that assignment: `window.updateBrokenAssetBanner?.();`. No refactor of surrounding logic.
8. Hook `resetBrokenAssetBannerDismissal()` into `export.js:492` (`state.unresolvedPreviewAssets = [];`). Add a single line immediately after that assignment: `window.resetBrokenAssetBannerDismissal?.(); window.updateBrokenAssetBanner?.();`.
9. Edit `editor/src/primary-action.js:466–475` — in `updatePreviewAssistAction`, ensure that when `state.unresolvedPreviewAssets.length > 0` the config.action/label is set to `{action: "connect-assets", label: "Подключить папку ресурсов"}` regardless of `state.editingSupported`. Core of P0-04: action PERSISTS after the modal closes. Expected state: test covers "paste broken HTML → close modal → `previewAssistActionBtn` stays visible and clickable".
10. Add the new `<script src="editor/src/broken-asset-banner.js"></script>` tag in `editor/presentation-editor.html` in the classic-script load sequence. Placement: AFTER `feedback.js` and BEFORE `boot.js`. Do NOT add `type="module"`. Reference: existing `<script src="editor/src/feedback.js"></script>` line.
11. Smoke-check: open a deck with an `<img src="missing.png">`, confirm banner shows `Не загружено 1 файл`, list shows the path, "Подключить папку ресурсов" button is clickable and opens the assets flow. Confirm dismissing hides the banner for the session but re-appears after next open.
12. Confirm that the banner is stripped on export — search `editor/src/export.js:389,420` strips `data-editor-ui="true"`; the banner carries that attribute (sub-task 4).

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: paste HTML with relative asset path, confirm banner renders)
- [ ] New `@layer broken-asset-banner` declared first in `editor/styles/tokens.css`
- [ ] All banner/button/toast text in Russian (banner title, "Подключить папку ресурсов", "Скрыть предупреждение")
- [ ] Banner carries `data-editor-ui="true"` — stripped on export (verify via `asset-parity.spec.js`)
- [ ] Banner action button PERSISTS after modal close (core P0-04 requirement)
- [ ] Pluralization "1 файл / 2 файла / 5 файлов" is correct Russian

### Acceptance criteria (merge-gate, falsifiable)

- [ ] With a pasted HTML containing 3 unresolved `<img>` references, `#brokenAssetBanner` renders `Не загружено 3 файла`, followed by a 3-entry `<ul>`, verified by a new Playwright spec `tests/playwright/specs/broken-asset-banner.spec.js` step 1.
- [ ] Clicking `#brokenAssetBannerActionBtn` opens the assets selection flow (same bridge as `previewAssistActionBtn`) — spec step 2.
- [ ] Clicking `#brokenAssetBannerDismissBtn` hides the banner until the next `loadHtmlString` call — spec step 3.
- [ ] After a clean deck (zero unresolved assets), the banner has `hidden` attribute and `aria-hidden="true"` — spec step 4.
- [ ] Export HTML does NOT contain `id="brokenAssetBanner"` — verified by a string assertion in the same spec.
- [ ] Gate-A still 55/5/0; new spec runs under Gate-B (not Gate-A).
- [ ] No regressions in `tests/playwright/specs/shell.smoke.spec.js` and `tests/playwright/specs/asset-parity.spec.js`.
- [ ] Conventional commit: `feat(ux): broken-asset recovery banner (P0-04) — v0.27.0 step 24`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Broken-asset banner appears for pasted HTML with 3 missing imgs | gate-b | `tests/playwright/specs/broken-asset-banner.spec.js` (new) | N/A | pass |
| Action button opens assets flow | gate-b | same spec | N/A | pass |
| Dismiss hides banner for session | gate-b | same spec | N/A | pass |
| Export strips banner element | gate-b | `tests/playwright/specs/asset-parity.spec.js` (extend) | pass | pass |
| Shell smoke unaffected | gate-a | `tests/playwright/specs/shell.smoke.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** `state.unresolvedPreviewAssets` shape differs between asset kinds (`img` vs `link` vs `video`). Rendering assumes a uniform string. A non-string entry crashes the banner.
- **Mitigation:** Sub-task 1 audits the real shape before coding. Render uses `String(entry.url || entry)` guard.
- **Risk:** Banner obscures `#blockReasonBanner` when both are active (blocked element + broken assets).
- **Mitigation:** Stack vertically with `.broken-asset-banner { margin-top: var(--space-2); }`; both share the same parent — test combination in spec step 5.
- **Risk:** User's session is filled with broken decks and banner becomes spammy.
- **Mitigation:** Dismiss button + list cap at 5 entries + "… и ещё N".
- **Rollback:** `git revert <sha>`; `editor/src/broken-asset-banner.js` and `editor/styles/broken-asset-banner.css` are new and self-contained; only 1 line in `tokens.css` layer decl needs reverting, 1 line each at `boot.js:1824`, `export.js:492`, 1 script tag and 1 markup block in shell.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:ui-ux-designer
isolation: worktree
branch_prefix: claude/wo-24-broken-asset-banner
```

````markdown
You are implementing Step 24 (v0.27.0 · broken-asset recovery banner) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-24-broken-asset-banner (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read docs/ADR-014-error-boundaries.md + docs/audit/AUDIT-B-ux-journeys.md (journey 2)
  3. Read docs/work-orders/W5/WO-24-broken-asset-banner.md (this file)
  4. Read editor/src/boot.js:1670-1830 to audit the exact shape of state.unresolvedPreviewAssets entries
  5. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/broken-asset-banner.js (new)
  - editor/styles/broken-asset-banner.css (new)
  - editor/styles/tokens.css (layer declaration line only)
  - editor/presentation-editor.html (banner markup + script tag only)
  - editor/src/primary-action.js (only in updatePreviewAssistAction — persistence of "connect-assets" action)
  - tests/playwright/specs/broken-asset-banner.spec.js (new)

FILES READ-ONLY (reference):
  - editor/src/boot.js, state.js, export.js, history.js, feedback.js, onboarding.js
  - docs/audit/PAIN-MAP.md (P0-04)

SUB-TASKS:
  Follow sub-tasks 1–12 above verbatim.

INVARIANTS (NEVER violate):
  - No type="module"; no bundler; classic-script globals only
  - All visible banner/button/aria-label text in Russian
  - @layer broken-asset-banner declared in tokens.css BEFORE the stylesheet file is created
  - Banner element MUST carry data-editor-ui="true"
  - Action button PERSISTS after modal close — this is the core of P0-04
  - Gate-A 55/5/0 before merge
  - HISTORY_LIMIT not hardcoded anywhere; not relevant here but verify no `20` literal slips in
  - Do NOT touch bridge-script.js, selection.js, or state.js field definitions — read-only

ACCEPTANCE:
  Match acceptance-criteria block verbatim. All 7 boxes green.

ON COMPLETION:
  1. Run `npm run test:gate-a` (must stay 55/5/0) and `npm run test:gate-b` (new spec must pass)
  2. git add editor/src/broken-asset-banner.js editor/styles/broken-asset-banner.css editor/styles/tokens.css editor/presentation-editor.html editor/src/primary-action.js tests/playwright/specs/broken-asset-banner.spec.js
  3. Conventional commit: "feat(ux): broken-asset recovery banner (P0-04) — v0.27.0 step 24"
  4. Report back: files changed, LOC delta, gate results, any shape surprises in state.unresolvedPreviewAssets

CROSS-BATCH HAND-OFF:
  Agent α's WO-06 (iframe sandbox + asset-recovery infra) owns the iframe-side collection of unresolved assets.
  If α's WO-06 lands first and introduces a cleaner shape (e.g. {path, kind, element}), refactor your render loop to consume it — but do NOT alter α's contract.
  WO-29 (banner unification) will later migrate this banner into the unified shellBanner region — keep your markup simple and dismissal/reset APIs idempotent so WO-29 can re-home cleanly.
````

### Rollback plan

If merge breaks main: `git revert <sha>`; re-plan; NO fix-forward under pressure. The banner module is additive and self-contained — revert scope is the 6-file diff listed above.
