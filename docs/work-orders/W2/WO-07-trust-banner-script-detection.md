## Step 07 — v0.27.0 · Trust-Banner: detect `<script>`/`on*`/`javascript:`, one-click neutralize

**Window:** W2   **Agent-lane:** D (Security)   **Effort:** M
**ADR:** ADR-014   **PAIN-MAP:** P0-01 (final remediation — second half of AUDIT-D-01 closure)
**Depends on:** WO-06 (shellBoundary plumbing + SANDBOX_MODES flag must exist), WO-01 (parseSingleRoot sanitized — ensures neutralize-output-is-clean invariant)   **Unblocks:** PAIN-MAP P0-01 final close → release-gate for v1.0

### Context (3–5 lines)

Per AUDIT-D-01, importing arbitrary HTML into the preview iframe runs deck-side `<script>` tags + inline `on*` handlers in the shell's same-origin. The trust model is documented but the user-visible moment is a single sentence in the onboarding modal. This WO ships the **Trust-Banner**: on every `buildModelDocument` completion, scan the doc for `<script>`, `on*` attrs, `javascript:`/`vbscript:` URL prefixes, and remote `<iframe>` tags; surface a persistent `shellBoundary.report` banner (code `deck-scripts-detected`) with two actions — `"Нейтрализовать скрипты"` (strip detected items + sandbox the iframe to `scripts-only`) and `"Оставить как есть"` (dismiss + accept risk). The neutralize path is the single escape hatch specified by AUDIT-D-01's top recommendation. Deck-engine JS (Reveal, Shower) is preserved by default — we warn rather than strip unless the user opts in.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/import.js` | edit | +140 / −3 |
| `editor/src/constants.js` | edit | +12 / −0 |
| `editor/src/feedback.js` | edit | +20 / −0 (extend `shellBoundary` with two-action variant if needed) |
| `editor/src/state.js` | edit | +3 / −0 (add `state.trustDecision` slice) |
| `tests/playwright/trust-banner.spec.js` | new | +180 / −0 |
| `docs/CHANGELOG.md` | edit | +4 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/import.js` `buildModelDocument` (lines 531–535) | call site to wire detection scan |
| `editor/src/import.js:85–112` | preview load site; must interact with sandboxMode flag from WO-06 |
| WO-06 outputs (`shellBoundary`, `SANDBOX_MODES`, `state.sandboxMode`) | reuse, do not duplicate |
| `docs/ADR-014-error-boundaries.md` §Layer 1 + §"Trust Banner" | spec |
| `docs/audit/AUDIT-D-security.md` §AUDIT-D-01 Remediation | detection rules + neutralize list |
| `references_pres/html-presentation-examples_v3/*.html` | regression — ensure these don't false-positive |

### Sub-tasks (executable, each ≤ 2 h)

1. In `constants.js` add detection regexes + allow-lists:
   ```
   const TRUST_DETECTION_SELECTORS = Object.freeze({
     scripts: 'script',
     inlineHandlers: '[onclick],[onload],[onerror],[onmouseover],[onchange],[onsubmit],[onkeydown],[onkeyup],[onfocus],[onblur]',
     jsUrls: 'a[href^="javascript:"], a[href^="vbscript:"]',
     remoteIframes: 'iframe[src^="http://"], iframe[src^="https://"]',
     metaRefresh: 'meta[http-equiv="refresh"]',
     objectEmbed: 'object, embed',
   });
   const TRUST_BANNER_CODE = 'deck-scripts-detected';
   const TRUST_DECISION_KEYS = Object.freeze({ NEUTRALIZE: 'neutralize', ACCEPT: 'accept', PENDING: 'pending' });
   ```
   Expected state after: selectors + state-keys centralized.
2. Add `state.trustDecision = TRUST_DECISION_KEYS.PENDING` to `state.js` initial shape. Reset to `PENDING` on every fresh import. Expected state after: per-deck trust state exists, not per-session.
3. Implement `scanTrustSignals(doc)` helper in `import.js`: runs each selector in `TRUST_DETECTION_SELECTORS` against the parsed doc, returns `{ scriptCount, inlineHandlerCount, jsUrlCount, remoteIframeCount, metaRefreshCount, objectEmbedCount, totalFindings, samples: [{kind, snippet}] }`. `samples` caps at 5 per kind with `element.outerHTML.slice(0, 120)` truncated snippets. Expected state after: pure function, side-effect-free.
4. Wire into `buildModelDocument`: after the existing `runUnifiedImportPipeline(doc);` call, run `const signals = scanTrustSignals(doc); state.trustSignals = signals;` — do NOT mutate the doc here; detection is scan-only. Expected state after: signals captured for banner; doc still identical to pre-WO behavior (deck scripts still run if user accepts).
5. After `els.previewFrame.onload` (reuse the WO-06 wiring), if `state.trustDecision === PENDING` AND `signals.totalFindings > 0`: call `shellBoundary.report({ kind: 'warning', code: TRUST_BANNER_CODE, message: "Презентация содержит исполняемый код (${signals.totalFindings} элементов). Скрипты будут запущены.", actions: [{ label: "Нейтрализовать скрипты", onClick: neutralizeAndReload }, { label: "Оставить как есть", onClick: acceptTrustDecision }], dismissible: false })`. Russian UI copy literal per invariant. Expected state after: banner fires with two actions; non-dismissible (user must choose).
6. If `shellBoundary.report` from WO-06 only supports one `action` — extend it with optional `actions: Array<{label, onClick}>` that renders N buttons; keep backward compat for single `action`. Edit `feedback.js` accordingly. Expected state after: Layer-1 API supports multi-action, no existing callers break.
7. Implement `acceptTrustDecision()`: sets `state.trustDecision = ACCEPT`, clears banner via `shellBoundary.clear(TRUST_BANNER_CODE)`, emits `addDiagnostic('trust-accepted:' + JSON.stringify({...signals, samples: undefined}))` (omit samples from the log for size). Expected state after: banner gone; future imports of the SAME deck in this session won't re-fire (until fresh import resets state).
8. Implement `neutralizeAndReload()`: rebuild the model doc from the last-imported source, strip every element matched by `TRUST_DETECTION_SELECTORS.scripts`, and for every element matched by `inlineHandlers` remove ALL `on*` attributes, and for `jsUrls` rewrite `href=""`, and for `remoteIframes` remove the element, and for `metaRefresh` remove, and for `objectEmbed` remove. Re-run `runUnifiedImportPipeline(doc)` on the neutralized doc; set `state.sandboxMode = SANDBOX_MODES.SCRIPTS_ONLY`; rebuild preview blob via `buildPreviewPackage`; reload iframe (invoke the existing preview-rebuild path, same code path `import.js:88–98`). Set `state.trustDecision = NEUTRALIZE`. Emit `showToast("Скрипты нейтрализованы. Превью пересобрано в режиме sandbox.", "success", { title: "Режим доверия" })`. Expected state after: iframe reloads sandboxed, no scripts run, banner disappears.
9. Add persistence of the last-imported raw HTML source (`state.lastImportedRawHtml`) in the existing `loadHtmlDocument`/`buildModelDocument` entry so that `neutralizeAndReload` has source to rebuild from. Expected state after: reliable neutralize re-path without requiring re-paste.
10. Write `tests/playwright/trust-banner.spec.js`: (a) paste fixture with `<script>alert(1)</script>` — banner appears, total findings = 1; (b) click `"Нейтрализовать скрипты"` — iframe reloads, `<script>` absent in serialized project HTML, sandbox attr set, toast `"Скрипты нейтрализованы. Превью пересобрано в режиме sandbox."` appears; (c) paste fixture with only `<div onclick="x">`; banner reports inlineHandlerCount=1; (d) click `"Оставить как есть"` — banner disappears, scripts remain, next edit cycle doesn't re-fire banner; (e) reference deck `v3-prepodovai-pitch` — zero findings, NO banner; (f) reference deck `v3-selectios-pitch` — zero findings, NO banner; (g) paste fixture with `<meta http-equiv="refresh">` — detected, banner fires. Expected state after: 7 scenarios pass.
11. Gate-A: `npm run test:gate-a` must remain 55/5/0. Expected state after: invariant preserved.
12. Manual smoke: open `references_pres/html-presentation-examples_v2/06-reveal-compatible-markup.html` if present (Reveal.js fixture) — confirm banner FIRES (Reveal uses `<script>`) and offers neutralize; confirm ACCEPT path keeps Reveal working; the NEUTRALIZE path sandboxes the frame and Reveal no longer navigates (expected by design — user explicitly chose). Expected state after: neutralize path works end-to-end; trust decision is honest.
13. Update `docs/CHANGELOG.md` `## Unreleased` → `### Security`: `Trust-Banner detects <script>/on*/javascript:/remote-iframe/meta-refresh/object-embed and offers "Нейтрализовать скрипты" one-click neutralize + sandbox fallback (AUDIT-D-01, P0-01). Default behavior unchanged — scripts run unless user opts in.`. Expected state after: changelog entry present.
14. Explicit regression: add a Playwright assertion in the spec that NEUTRALIZE path does NOT strip `style` or `class` attributes — only `on*` — so safely-styled Russian UI content survives. Expected state after: defensive assertion in place.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (banner fires under file://; neutralize rebuilds preview via existing preview pipeline which works on file://)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A (reuses `@layer banners` from WO-06)
- [ ] Russian UI-copy strings preserved literally: `"Презентация содержит исполняемый код (N элементов). Скрипты будут запущены."`, `"Нейтрализовать скрипты"`, `"Оставить как есть"`, `"Скрипты нейтрализованы. Превью пересобрано в режиме sandbox."`, `"Режим доверия"`
- [ ] Deck-script-engine path (Reveal.js, Shower) NOT blanket-stripped — neutralize requires explicit user opt-in
- [ ] Default behavior unchanged — with `state.trustDecision = PENDING` + no user action, scripts still run (same as today)
- [ ] Reference decks `v3-prepodovai-pitch` + `v3-selectios-pitch` do NOT false-positive (no `<script>`, no `on*`)
- [ ] Neutralize path removes `<script>` + `on*` + `javascript:` + remote `<iframe>` + `<meta http-equiv>` + `<object>`/`<embed>`; preserves `style`, `class`, `id`, `data-*`
- [ ] Non-blocking: banner is `aria-live="polite"` (from WO-06 region); does not modal-trap the user
- [ ] No new external network calls introduced

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `tests/playwright/trust-banner.spec.js` all 7 scenarios pass
- [ ] Regression assertion: NEUTRALIZE preserves `style`/`class`/`id`/`data-*` (sub-task 14)
- [ ] Reference decks `v3-prepodovai-pitch` + `v3-selectios-pitch` do NOT trigger the banner (zero findings — verified by spec cases e + f)
- [ ] Manual smoke on a Reveal-compat deck: banner fires; ACCEPT keeps Reveal working; NEUTRALIZE sandboxes and disables scripts (as expected)
- [ ] `state.sandboxMode === SANDBOX_MODES.SCRIPTS_ONLY` after NEUTRALIZE (verified via `page.evaluate`)
- [ ] Gate-A remains 55/5/0 (`npm run test:gate-a`)
- [ ] Russian UI copy literal match (grep the strings verbatim in the committed code)
- [ ] Commit message in conventional-commits format: `feat(security): Trust-Banner + neutralize-scripts one-click — v0.27.0 WO-07`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| `<script>alert(1)</script>` → banner fires | gate-a | `tests/playwright/trust-banner.spec.js` | N/A | pass |
| Neutralize: iframe reloads without script | gate-a | `tests/playwright/trust-banner.spec.js` | N/A | pass |
| `onclick` handler → inlineHandlerCount=1 | gate-a | `tests/playwright/trust-banner.spec.js` | N/A | pass |
| "Оставить как есть" → banner dismissed, scripts run | gate-a | `tests/playwright/trust-banner.spec.js` | N/A | pass |
| v3-prepodovai-pitch — zero banner | gate-a | `tests/playwright/trust-banner.spec.js` | N/A | pass |
| v3-selectios-pitch — zero banner | gate-a | `tests/playwright/trust-banner.spec.js` | N/A | pass |
| `<meta http-equiv="refresh">` detected | gate-a | `tests/playwright/trust-banner.spec.js` | N/A | pass |
| NEUTRALIZE preserves style/class/id/data- | gate-a | `tests/playwright/trust-banner.spec.js` | N/A | pass |
| Gate-A baseline 55/5/0 | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** Neutralize path breaks Reveal.js decks that users legitimately opened — they choose NEUTRALIZE and suddenly navigation stops working.
- **Mitigation:** The banner copy makes the trade-off explicit (`"Скрипты будут запущены."` → user who opts to neutralize has acknowledged scripts die). Toast on neutralize says `"Превью пересобрано в режиме sandbox."` — distinct, honest, no dead-end: user can re-import without neutralize to restore behavior (state.trustDecision resets PENDING on fresh import — sub-task 2).
- **Risk:** False-positives on reference decks — e.g., a `style` attribute containing the substring `javascript:` anywhere (not a URL).
- **Mitigation:** Detection uses CSS selectors (`[onclick]`, `a[href^="javascript:"]`, …) not substring matches — `style` attributes are not scanned. Sub-tasks 10.e/10.f specifically gate against reference-deck false-positives.
- **Risk:** `scanTrustSignals` runs on every `buildModelDocument` — adds cost on deck load.
- **Mitigation:** `querySelectorAll` with fixed selectors is O(n) and cheap (<1 ms on 1 k-node trees). Document envelope in commit body.
- **Risk:** Rebuild path in `neutralizeAndReload` skips some stateful import hook — selection/history out-of-sync after reload.
- **Mitigation:** Reuse the same entry used by `loadHtmlDocument` (`buildModelDocument` → `buildPreviewPackage` → `previewFrame.src`); flags `options.resetHistory` + reuse all existing import pipeline. Expected state is identical to a fresh file open.
- **Rollback:** `git revert <sha>`. The banner default behavior (PENDING + warn) doesn't alter model — only adds a warning surface. Neutralize is opt-in. Revert is clean; no state migration.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:security-auditor
isolation: worktree
branch_prefix: claude/wo-07-trust-banner-script-detection
```

````markdown
You are implementing Step 07 (v0.27.0 Trust-Banner + neutralize-scripts) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-07-trust-banner-script-detection   (create from main)
BLOCKED BY: WO-06 must be merged first (shellBoundary API + SANDBOX_MODES + banners.css region)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-014 §Layer 1 + §"Trust Banner" section
  3. Read AUDIT-D-security.md §AUDIT-D-01 Remediation in full
  4. Read PAIN-MAP row P0-01 (requires ADR-014 dependency)
  5. Read WO-06 implementation result on main: editor/src/feedback.js shellBoundary API, editor/src/constants.js SANDBOX_MODES, editor/src/state.js sandboxMode slice
  6. Read editor/src/import.js lines 85–115 (preview load site) and lines 531–535 (buildModelDocument)
  7. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/import.js
  - editor/src/constants.js  (TRUST_DETECTION_SELECTORS, TRUST_BANNER_CODE, TRUST_DECISION_KEYS)
  - editor/src/feedback.js  (extend shellBoundary to support actions: [] array)
  - editor/src/state.js  (add trustDecision + trustSignals + lastImportedRawHtml slices)
  - tests/playwright/trust-banner.spec.js  (new)
  - docs/CHANGELOG.md  (Unreleased entry)

FILES READ-ONLY (reference only):
  - docs/ADR-014-error-boundaries.md
  - docs/audit/AUDIT-D-security.md
  - docs/audit/PAIN-MAP.md
  - references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html
  - references_pres/html-presentation-examples_v3/selectios_pitch_v2_final.html
  - references_pres/html-presentation-examples_v2/06-reveal-compatible-markup.html (if present)

SUB-TASKS:
  1. Add TRUST_DETECTION_SELECTORS, TRUST_BANNER_CODE, TRUST_DECISION_KEYS to constants.js
  2. Add state.trustDecision (init PENDING) + state.trustSignals + state.lastImportedRawHtml
  3. Implement scanTrustSignals(doc) — scan-only, returns counts + samples
  4. Wire into buildModelDocument tail — capture signals, do not mutate doc
  5. After previewFrame onload: if trustDecision===PENDING && signals.totalFindings>0 → shellBoundary.report with two actions
  6. Extend shellBoundary to accept actions: [] array (back-compat for single action)
  7. acceptTrustDecision(): set trustDecision=ACCEPT, clear banner, diagnostic log
  8. neutralizeAndReload(): strip scripts+on*+js-urls+remote-iframes+meta-refresh+object/embed; sandboxMode=SCRIPTS_ONLY; rebuild preview; toast
  9. Persist lastImportedRawHtml for neutralize source
  10. Write trust-banner.spec.js (7 scenarios incl. reference decks zero-fire)
  11. Gate-A 55/5/0
  12. Manual Reveal-compat smoke (accept path + neutralize path)
  13. CHANGELOG Unreleased entry
  14. Regression assertion: NEUTRALIZE preserves style/class/id/data-*

INVARIANTS (NEVER violate):
  - No type="module" on any <script>
  - No bundler added
  - Gate-A 55/5/0 must hold
  - file:// workflow intact (banner + neutralize work under file://)
  - Russian UI copy preserved literally (see WO list)
  - Deck-script engine NOT blanket-stripped by default — only on explicit user neutralize opt-in
  - Reference decks v3-prepodovai-pitch + v3-selectios-pitch do NOT false-positive
  - Banner non-blocking (aria-live=polite inherited from WO-06 region)
  - NEUTRALIZE preserves style/class/id/data-*
  - No new external network calls

ACCEPTANCE:
  - trust-banner.spec.js: 7/7 scenarios + regression assertion pass
  - Reference decks produce zero banners
  - Russian UI copy verbatim match
  - state.sandboxMode='scripts-only' after neutralize
  - Gate-A remains 55/5/0
  - Conventional commit: feat(security): Trust-Banner + neutralize-scripts one-click — v0.27.0 WO-07

ON COMPLETION:
  1. Run the full acceptance matrix
  2. git add editor/src/import.js editor/src/constants.js editor/src/feedback.js editor/src/state.js tests/playwright/trust-banner.spec.js docs/CHANGELOG.md
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, gate results, banner screenshot with Russian copy, confirmation that Reveal-compat manual smoke passed both paths
````

### Rollback plan

If merge breaks main: `git revert <sha>`. The default behavior with trustDecision=PENDING simply adds a visible warning — no model mutation, no script-strip. Users who took the neutralize path can re-import and ACCEPT to restore original behavior. Revert is clean.
