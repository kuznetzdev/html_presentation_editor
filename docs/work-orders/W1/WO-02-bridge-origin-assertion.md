## Step 02 — v0.26.1 · `postMessage` origin assertion (send + receive)

**Window:** W1   **Agent-lane:** D (Security)   **Effort:** S
**ADR:** ADR-012   **PAIN-MAP:** P1-13
**Depends on:** none (runs in parallel with WO-01)   **Unblocks:** Agent β WO-12/13 (bridge v2 schema), Agent γ observable-store bridge slice

### Context (3–5 lines)

Per AUDIT-D-04, the bridge uses wildcard targetOrigin `'*'` on both sides: iframe-to-shell at `bridge-script.js:93` (`parent.postMessage(... , '*')`) and shell-to-iframe at `bridge-commands.js:93` (`els.previewFrame.contentWindow.postMessage(message, "*")`). On receive (`bridge.js:7–17`) the guard uses `event.source === els.previewFrame.contentWindow` + token, but **never checks `event.origin`**. This WO pins target origin to `window.location.origin` on send and rejects messages with mismatched `event.origin` on receive, except where origin is `"null"` (file://) which must remain accepted — covering both supported deployment modes.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/bridge-script.js` | edit | +12 / −1 |
| `editor/src/bridge-commands.js` | edit | +5 / −1 |
| `editor/src/bridge.js` | edit | +8 / −0 |
| `editor/src/constants.js` | edit | +4 / −0 |
| `tests/playwright/bridge-origin.spec.js` | new | +90 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/bridge-script.js:89–94` | iframe-side `post(type, payload)` helper — target call to edit |
| `editor/src/bridge-commands.js:78–99` | shell-side `sendToBridge(type, payload)` — target call to edit |
| `editor/src/bridge.js:7–17` | receive guard — add origin check before token check |
| `docs/ADR-012-bridge-protocol-v2.md` §4 | Origin assertion spec (direct dependency) |
| `docs/audit/AUDIT-D-security.md` §AUDIT-D-04 | remediation detail |

### Sub-tasks (executable, each ≤ 2 h)

1. In `editor/src/constants.js` add a helper constant/function (new lines near other bridge constants): `function getAllowedBridgeOrigins() { const o = window.location.origin; return o === 'null' || !o ? ['null'] : [o]; }` — returns the list of origins accepted by the bridge receive guard. `file://` always exposes `"null"` as `window.location.origin`; localhost exposes `http://localhost:<port>`. Expected state after: accessor available to both shell and bridge-script code paths at boot time.
2. In `editor/src/bridge-commands.js` around line 93 — replace `"*"` target with `computeExpectedBridgeOrigin()` where that function returns: for file:// (when `window.location.protocol === 'file:'`) use `"*"` (browsers require it for null-origin postMessage to work reliably across frames); otherwise use `window.location.origin`. Rationale: modern browsers treat null-origin frames specially and reject non-`"*"` targetOrigin in many cases. Document the split. Expected state after: shell→iframe send obeys origin when on localhost, falls back to `"*"` only under file:// where the origin is `"null"`.
3. In `editor/src/bridge-script.js:93` — wrap `parent.postMessage(...)` identically: use a template-literal-safe accessor that resolves at iframe boot to the same decision (compute `targetOrigin` once at iframe init by reading `window.location.protocol`). Expected state after: iframe→shell send symmetric to step 2.
4. In `editor/src/bridge.js:7–17` receive guard — insert, between the null-check at line 10 and the token check at line 11, an origin check: `const allowed = getAllowedBridgeOrigins(); if (!allowed.includes(event.origin)) return;`. Expected state after: foreign-origin messages dropped before token comparison.
5. In `bridge-script.js` — symmetric receive-handler for shell→iframe messages (the `window.addEventListener('message', ...)` inside the injected script string). Insert the same origin check; since we must serialize the allowed list into the script template, compute at `buildBridgeScript(token)` time and embed: e.g., `const ALLOWED_BRIDGE_ORIGINS = ${JSON.stringify(getAllowedBridgeOrigins())};` then `if (!ALLOWED_BRIDGE_ORIGINS.includes(event.origin)) return;`. Expected state after: iframe-side inbound guard mirrors shell-side.
6. Confirm both paths emit a diagnostic (`addDiagnostic('bridge-origin-rejected:' + event.origin)` in shell; `post('runtime-log', ...)` in iframe) so operators can see dropped messages in the diagnostics drawer. Keep non-blocking. Expected state after: foreign messages are visible, not silent.
7. Write `tests/playwright/bridge-origin.spec.js` with three scenarios: (a) normal editor flow under `http://localhost:<port>` — no rejections, selection + replace works; (b) simulated cross-origin message injected via `page.evaluate(() => window.postMessage({__presentationEditor: true, token: 'x'}, '*'))` — rejected (no effect on state); (c) under file:// manifest parity — editor still operates (this must exercise the file:// branch where origin is `"null"`). Use an existing file:// Playwright helper if present; else document a manual smoke-test step and skip the file:// spec (annotate `.skip` with reason). Expected state after: automated tests cover localhost path; file:// documented.
8. Run Gate-A: `npm run test:gate-a` must be 55/5/0. Expected state after: invariant preserved.
9. Manual smoke: open `references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html` via `file://` URL, perform select-element + save cycle, check DevTools Console for origin-rejection diagnostics (should be zero). Expected state after: file:// flow unaffected.
10. Update `docs/CHANGELOG.md` `## Unreleased` → `### Security`: `Bridge postMessage pins targetOrigin + rejects mismatched event.origin on receive (AUDIT-D-04, P1-13). file:// (origin="null") remains supported.`. Expected state after: changelog carries the entry.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open a deck from file system — tested under `references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html`)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer) — N/A
- [ ] Russian UI-copy strings preserved (not translated to English) — N/A (diagnostics are ASCII codes)
- [ ] Bridge origin check accepts both `file://` (`event.origin === 'null'`) AND `http://localhost:<port>`
- [ ] Shell-to-iframe send uses `'*'` only when `window.location.protocol === 'file:'` (origin == `"null"`); otherwise uses `window.location.origin`
- [ ] Iframe-to-shell send symmetric to shell-to-iframe
- [ ] Foreign-origin messages land in diagnostics as `bridge-origin-rejected:<origin>`
- [ ] No new external network calls introduced

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `tests/playwright/bridge-origin.spec.js` case (a) [happy-path localhost] passes
- [ ] Case (b) [injected foreign-origin] passes — editor ignores the message, emits diagnostic
- [ ] Case (c) [file://] manually verified on local Windows file-open; steps documented in spec comment
- [ ] Gate-A remains 55/5/0
- [ ] `grep -n "postMessage" editor/src/bridge-commands.js` shows no remaining literal `"*"` outside the file:// fallback branch
- [ ] `grep -n "postMessage" editor/src/bridge-script.js` similarly
- [ ] Receive handler in `bridge.js` drops messages where `event.origin` is not in `getAllowedBridgeOrigins()`
- [ ] Diagnostic `bridge-origin-rejected:<origin>` appears in the diagnostics drawer when a foreign message is injected
- [ ] Commit message in conventional-commits format: `fix(security): assert bridge postMessage origin — v0.26.1 WO-02`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| localhost editor happy path | gate-a | `tests/playwright/bridge-origin.spec.js` | N/A | pass |
| cross-origin message injection rejected | gate-a | `tests/playwright/bridge-origin.spec.js` | N/A | pass |
| file:// smoke | manual | — | N/A | pass |
| gate-a baseline 55/5/0 | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** Under file://, browsers treat postMessage with non-`"*"` targetOrigin as a no-op — the message is silently dropped, breaking the bridge entirely.
- **Mitigation:** Explicit branch: `window.location.protocol === 'file:'` → targetOrigin stays `"*"`. Receive side still rejects by `event.source` + `event.origin === 'null'` check. Tested by step 9 manual smoke.
- **Risk:** `window.location.origin` is `"null"` in some sandboxed frames, and `Array.includes("null")` would accept but UA may not emit a literal `"null"` string — misalignment between expected list and actual event.origin.
- **Mitigation:** `getAllowedBridgeOrigins()` explicitly returns `["null"]` in that branch; test case (c) exercises it.
- **Risk:** Third-party page-level `postMessage` tests in other gates accidentally flagged as foreign-origin and rejected.
- **Mitigation:** All editor postMessages carry the `__presentationEditor` discriminant; existing `!data || data.__presentationEditor !== true) return;` at `bridge.js:10` still runs — origin check is an additional guard, not a replacement.
- **Rollback:** `git revert <sha>`; three small edits + one new constants block; fully reversible.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:security-auditor
isolation: worktree
branch_prefix: claude/wo-02-bridge-origin-assertion
```

````markdown
You are implementing Step 02 (v0.26.1 bridge origin assertion) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-02-bridge-origin-assertion   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-012 §4 (Origin assertion spec)
  3. Read AUDIT-D-security.md finding AUDIT-D-04
  4. Read bridge-script.js lines 89–107
  5. Read bridge-commands.js lines 78–99
  6. Read bridge.js lines 7–20
  7. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/bridge-script.js
  - editor/src/bridge-commands.js
  - editor/src/bridge.js
  - editor/src/constants.js  (add getAllowedBridgeOrigins + origin compute helper)
  - tests/playwright/bridge-origin.spec.js (new)
  - docs/CHANGELOG.md (Unreleased entry)

FILES READ-ONLY (reference only):
  - docs/ADR-012-bridge-protocol-v2.md
  - docs/audit/AUDIT-D-security.md

SUB-TASKS:
  1. Add getAllowedBridgeOrigins() to constants.js
  2. Replace shell→iframe '*' with origin-aware target (file:// branch keeps '*')
  3. Replace iframe→shell '*' with origin-aware target (file:// branch keeps '*')
  4. Receive guard in bridge.js: reject if event.origin not in allowed list (before token check)
  5. Symmetric receive guard in bridge-script.js injected message handler
  6. Emit `bridge-origin-rejected:<origin>` diagnostic on reject (shell) / runtime-log (iframe)
  7. Write bridge-origin.spec.js with 3 cases (happy localhost, foreign-origin injected, file://)
  8. Regression: Gate-A 55/5/0
  9. Manual file:// smoke on prepodovai_pitch_v2.html
  10. CHANGELOG Unreleased entry

INVARIANTS (NEVER violate):
  - No type="module" on any <script>
  - No bundler / build step added
  - Gate-A 55/5/0 must hold before merge
  - file:// workflow must continue to work (event.origin === 'null' accepted)
  - http://localhost:<port> workflow must continue to work (event.origin equals location.origin accepted)
  - No new external network calls

ACCEPTANCE:
  - bridge-origin.spec.js: happy-path + foreign-injection cases pass
  - file:// smoke verified by hand, documented in spec comment
  - Gate-A remains 55/5/0
  - grep postMessage in bridge-script.js and bridge-commands.js — no bare '*' outside the file:// branch
  - Foreign-origin message shows up as diagnostic `bridge-origin-rejected:<origin>`
  - Conventional commit: fix(security): assert bridge postMessage origin — v0.26.1 WO-02

ON COMPLETION:
  1. Run the full acceptance matrix
  2. git add editor/src/bridge-script.js editor/src/bridge-commands.js editor/src/bridge.js editor/src/constants.js tests/playwright/bridge-origin.spec.js docs/CHANGELOG.md
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, gate results, confirmation that file:// smoke passed
````

### Rollback plan

If merge breaks main: `git revert <sha>`. The receive-side guard is purely additive; send-side changes retain `'*'` under file://; rollback is safe and atomic. Re-plan only after re-confirming the two-origin support matrix.
