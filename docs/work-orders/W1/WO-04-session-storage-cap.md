## Step 04 — v0.26.1 · Autosave size cap + light-snapshot fallback on quota

**Window:** W1   **Agent-lane:** D (Security · reliability)   **Effort:** S
**ADR:** ADR-014   **PAIN-MAP:** P1-14
**Depends on:** none (parallel with WO-01/02/03/05)   **Unblocks:** observable-store ADR-013 dirty-slice tracking (W5)

### Context (3–5 lines)

Per AUDIT-D-05, `saveProjectToLocalStorage()` at `primary-action.js:647–669` serializes the full project HTML into `sessionStorage` under key `STORAGE_KEY` with **no size cap**. Browsers cap sessionStorage at 5–10 MB; a deck with a few 1080p base64 images approaches this. Current behavior: quota-exceeded exception lands in `addDiagnostic('autosave-failed:...')` silently — user never learns why restore is missing, data is lost on refresh. This WO adds an explicit size check with a "light snapshot" fallback (drop heavy base64 payloads, preserve HTML structure + a "hydrate from disk" pointer if asset resolver is configured) and surfaces the state via ADR-014's banner infrastructure when available (plus a toast fallback today).

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/primary-action.js` | edit | +90 / −8 |
| `editor/src/constants.js` | edit | +5 / −0 |
| `tests/playwright/autosave-cap.spec.js` | new | +100 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/primary-action.js:647–669` | current `saveProjectToLocalStorage` |
| `editor/src/primary-action.js` (`serializeCurrentProject`) | HTML serializer source |
| `editor/src/feedback.js` | `showToast` / `reportShellWarning` APIs |
| `docs/ADR-014-error-boundaries.md` | banner contract if `shellBoundary.report` shipped, else toast fallback |
| `docs/audit/AUDIT-D-security.md` §AUDIT-D-05 | remediation |

### Sub-tasks (executable, each ≤ 2 h)

1. In `editor/src/constants.js` add autosave caps: `AUTOSAVE_WARN_BYTES = 3 * 1024 * 1024; AUTOSAVE_FAIL_BYTES = 6 * 1024 * 1024; AUTOSAVE_LIGHT_TAG = 'light-v1';`. Expected state after: tunable thresholds in one place.
2. Modify `saveProjectToLocalStorage` to compute `const raw = JSON.stringify(payload);` FIRST (move out of `.setItem`), then branch:
   - `if (raw.length <= AUTOSAVE_WARN_BYTES)` — normal write.
   - `if (raw.length > AUTOSAVE_WARN_BYTES && raw.length <= AUTOSAVE_FAIL_BYTES)` — normal write + emit a non-fatal warning toast: `showToast("Автосохранение близко к лимиту хранилища.", "warning", { title: "Автосохранение", ttl: 5000 });` (Russian UI copy — do not translate).
   - `if (raw.length > AUTOSAVE_FAIL_BYTES)` — downgrade to **light snapshot**: strip `data:image/*` inline payloads from `payload.html` (replace them with a placeholder `<img data-autosave-stripped="1" alt="{original-alt}"/>`), re-serialize, tag `payload.autosaveTag = AUTOSAVE_LIGHT_TAG`, write that; emit toast: `showToast("Снимок сохранён без встроенных изображений (слишком большой размер).", "warning", { title: "Автосохранение · облегчённый режим", ttl: 6000 });` Expected state after: three-tier behavior with toast surfaces; no silent failure.
3. Wrap the `.setItem(...)` call in try/catch — on `QuotaExceededError` specifically: retry once with the light-snapshot path (step 2 branch 3); on second failure emit a hard-failure toast: `showToast("Не удалось сохранить снимок. Экспортируйте документ вручную.", "error", { title: "Автосохранение отключено", ttl: 8000 });` AND `addDiagnostic('autosave-quota-exceeded:' + raw.length);`. Expected state after: graceful-fallback chain; user's work is never lost silently.
4. Helper: add `function stripHeavyDataUris(htmlString) { return htmlString.replace(/ (src|href)="data:image\/[^"]{1024,}"/g, ' $1=""' + ' data-autosave-stripped="1"'); }` — strips any inline data-URI whose length exceeds 1024 chars (threshold tuned to preserve tiny inline SVG/PNG favicons and strip photo-sized payloads). Expected state after: helper exists, used only in light-snapshot branch.
5. Ensure restore path (load from autosave, `tryRestoreDraftPrompt` in `clipboard.js`) recognizes `payload.autosaveTag === AUTOSAVE_LIGHT_TAG` and surfaces a restore banner note: `"Восстановлен облегчённый снимок — изображения отсутствуют."` (This is additive; do NOT modify the restore pipeline's structural contract.) Expected state after: user sees on restore that it's a degraded snapshot, with existing banner surface (ADR-014 banner if present, else toast).
6. Defensive: if `state.modelDoc` is null or `serializeCurrentProject` returns empty — early return as today; no fallback needed.
7. Write `tests/playwright/autosave-cap.spec.js`: (a) stub `sessionStorage.setItem` to throw `QuotaExceededError` once, confirm light-snapshot retry fires and final write succeeds; (b) feed a project with a 4 MB data-URI base64, confirm warn-toast appears and write still completes; (c) feed a project with an 8 MB data-URI base64, confirm light-snapshot path fires, written payload has `autosaveTag === 'light-v1'`, and contains `data-autosave-stripped="1"` markers. Expected state after: three cases green.
8. Gate-A: `npm run test:gate-a` must remain 55/5/0. Expected state after: invariant preserved.
9. Manual smoke: open `references_pres/html-presentation-examples_v3/selectios_pitch_v2_final.html` (image-heavy), make a trivial edit, confirm autosave toast does not appear (deck should be below the 3 MB warn threshold). Expected state after: normal deck workflow unchanged.
10. Update `docs/CHANGELOG.md` `## Unreleased` → `### Security`: `Autosave size-capped with graceful light-snapshot fallback on quota exceeded (AUDIT-D-05, P1-14). Russian toast copy covers warn/fail/hard-fail tiers.`. Expected state after: changelog entry present.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A
- [ ] Russian UI-copy strings preserved: `"Автосохранение близко к лимиту хранилища."`, `"Снимок сохранён без встроенных изображений (слишком большой размер)."`, `"Не удалось сохранить снимок. Экспортируйте документ вручную."`, `"Восстановлен облегчённый снимок — изображения отсутствуют."`
- [ ] Size caps have graceful fallback — NEVER loses user's work silently; a toast fires at each tier
- [ ] Light-snapshot mode only strips inline data-URI payloads > 1024 chars; all HTML structure preserved
- [ ] No new external network calls introduced

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `tests/playwright/autosave-cap.spec.js` all 3 scenarios pass
- [ ] QuotaExceededError path retries with light snapshot and writes successfully (verified in spec case a)
- [ ] `sessionStorage.getItem(STORAGE_KEY)` after warn-tier write has normal `payload.html` (no stripping below 6 MB threshold)
- [ ] After 8 MB test payload, stored JSON has `autosaveTag === "light-v1"` and `html` contains at least one `data-autosave-stripped="1"` marker
- [ ] Toast copy matches Russian UI strings literally (grep-able)
- [ ] Gate-A remains 55/5/0
- [ ] Manual smoke: `selectios_pitch_v2_final.html` edits → save → reload → restore works, no toasts
- [ ] Commit message in conventional-commits format: `fix(security): autosave size cap + light-snapshot fallback — v0.26.1 WO-04`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| QuotaExceededError → retry → success | gate-a | `tests/playwright/autosave-cap.spec.js` | N/A | pass |
| 4 MB payload: warn toast, normal write | gate-a | `tests/playwright/autosave-cap.spec.js` | N/A | pass |
| 8 MB payload: light snapshot, tag set | gate-a | `tests/playwright/autosave-cap.spec.js` | N/A | pass |
| `selectios_pitch_v2_final.html` autosave normal | manual | — | pass | pass |
| Gate-A baseline | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** Stripped data-URIs break restore — on `tryRestoreDraftPrompt`, the `<img>` with `data-autosave-stripped="1"` shows broken alt-text.
- **Mitigation:** Banner copy on restore (`"Восстановлен облегчённый снимок — изображения отсутствуют."`) tells user to reopen the source file; the user's primary data (HTML structure, text, styles) is preserved. This is the least-bad failure mode; explicit and honest per "no dead ends" invariant.
- **Risk:** Regex-based data-URI stripping matches non-image base64 (rare but possible — SVG inlined as `data:image/svg+xml,...`).
- **Mitigation:** Regex anchors on `data:image/` and min length 1024 chars. SVG under 1024 chars (common for icons) passes through; larger SVG is acceptable to strip since it's likely photographic.
- **Risk:** Thresholds hardcoded — some users on lower-capacity browsers hit smaller limits.
- **Mitigation:** Thresholds in `constants.js`, grep-able. Future WO can wire them to a user preference if telemetry (ADR-020) shows false positives.
- **Rollback:** `git revert <sha>`; changes live in one function + one constants block + one new spec; atomic revert safe.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:security-auditor
isolation: worktree
branch_prefix: claude/wo-04-session-storage-cap
```

````markdown
You are implementing Step 04 (v0.26.1 autosave size cap + light-snapshot fallback) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-04-session-storage-cap   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-014 (docs/ADR-014-error-boundaries.md) — use toast fallback where shellBoundary.report() not yet shipped
  3. Read AUDIT-D-security.md finding AUDIT-D-05
  4. Read primary-action.js lines 630–670
  5. Read feedback.js (showToast, reportShellWarning signatures)
  6. Read clipboard.js tryRestoreDraftPrompt for restore-path recognition of light-snapshot
  7. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/primary-action.js
  - editor/src/constants.js  (add AUTOSAVE_WARN_BYTES, AUTOSAVE_FAIL_BYTES, AUTOSAVE_LIGHT_TAG)
  - tests/playwright/autosave-cap.spec.js  (new)
  - docs/CHANGELOG.md  (Unreleased entry)

FILES READ-ONLY (reference only):
  - editor/src/clipboard.js  (restore path must see autosaveTag)
  - editor/src/feedback.js
  - docs/ADR-014-error-boundaries.md
  - docs/audit/AUDIT-D-security.md

SUB-TASKS:
  1. Add cap constants to constants.js
  2. Serialize payload to raw string first; compute raw.length
  3. Warn-tier (> 3 MB): write + toast "Автосохранение близко к лимиту хранилища."
  4. Fail-tier (> 6 MB): light-snapshot strip of inline data-URI images > 1024 chars; tag payload; toast
  5. Wrap setItem in try/catch for QuotaExceededError → retry with light snapshot; on double-fail toast + diagnostic
  6. stripHeavyDataUris helper — regex on data:image/ with >1024 char lengths
  7. clipboard.js tryRestoreDraftPrompt: surface "Восстановлен облегчённый снимок — изображения отсутствуют." banner if autosaveTag === light-v1
  8. Write autosave-cap.spec.js (3 cases)
  9. Gate-A 55/5/0
  10. Manual smoke: selectios_pitch_v2_final.html normal workflow unaffected
  11. CHANGELOG Unreleased entry

INVARIANTS (NEVER violate):
  - No type="module" on any <script>
  - No bundler added
  - Gate-A 55/5/0 must hold
  - file:// workflow still works
  - Russian UI copy preserved literally (see list in this WO)
  - Graceful fallback — user's work NEVER silently lost; toast at every tier
  - Light-snapshot only strips inline data-URI > 1024 chars; preserves structure
  - No new external network calls

ACCEPTANCE:
  - autosave-cap.spec.js: 3/3 pass
  - QuotaExceededError retries with light snapshot and writes successfully
  - 4 MB normal write + warn toast
  - 8 MB light-snapshot write has autosaveTag = "light-v1" and stripped markers
  - Gate-A remains 55/5/0
  - Conventional commit: fix(security): autosave size cap + light-snapshot fallback — v0.26.1 WO-04

ON COMPLETION:
  1. Run the full acceptance matrix
  2. git add editor/src/primary-action.js editor/src/constants.js editor/src/clipboard.js tests/playwright/autosave-cap.spec.js docs/CHANGELOG.md
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, gate results, confirmation that reference-deck autosave still below the warn threshold
````

### Rollback plan

If merge breaks main: `git revert <sha>` — the WO is additive wrapping around the existing save; old path remains default when thresholds untriggered. Rollback safe and atomic.
