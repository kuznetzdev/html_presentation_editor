## Step 12 — v0.29.0 · Bridge v2 hello handshake + version mismatch banner

**Window:** W3   **Agent-lane:** C   **Effort:** M
**ADR:** ADR-012, ADR-014   **PAIN-MAP:** P0-10 (start)
**Depends on:** WO-02 (Agent α — origin assertion + crypto token; P1-13, P1-15). Handshake needs targeted-origin postMessage to be safe.
**Unblocks:** WO-13 (per-message validators consume the handshake-confirmed protocol version)

### Context (3–5 lines)

ADR-012 §1 introduces a versioned bridge handshake: iframe sends `{ type: "hello", protocol: 2, build, capabilities }` as its first message; shell verifies `protocol === 2 && build === state.shellBuild`; on mismatch the shell shows a Russian banner and degrades to read-only preview. Current bridge is unversioned (AUDIT-D-04, PAIN-MAP P0-10). The handshake is the first step of the full ADR-012 rollout — WO-13 fills in per-message validators. Shell receive-side lives in `editor/src/bridge.js::bindMessages` (lines 7–106). Iframe post-side lives in `editor/src/bridge-script.js::post` (line 93) and bridge-ready dispatch. ADR-014 supplies the error-boundary surface the mismatch banner renders on.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/bridge.js` | edit (add `hello` case + version check) | +55 / −0 |
| `editor/src/bridge-script.js` | edit (emit `hello` first; add protocol constant) | +25 / −0 |
| `editor/src/bridge-schema.js` | new (schema registry skeleton + `Hello` typedef) | +90 / −0 |
| `editor/src/constants.js` | edit (add `BRIDGE_PROTOCOL_VERSION = 2`, `SHELL_BUILD`) | +6 / −0 |
| `editor/presentation-editor.html` | edit (add `<script src="src/bridge-schema.js">` before `bridge.js`) | +1 / −0 |
| `docs/CHANGELOG.md` | edit | +3 / −0 |
| `docs/ADR-012-bridge-protocol-v2.md` | edit Status line | +0 / −0 net |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/bridge.js` | lines 1–130 — full context for `bindMessages` |
| `editor/src/bridge-script.js` | lines 28–107 — STATE block, `post` function at line 93, runtime-error emit |
| `editor/src/state.js` | `state.bridgeToken`, `state.previewReady`, `state.editingSupported` — fields touched by mismatch degrade path |
| `editor/src/feedback.js` | `showToast`, reportShellWarning — used for mismatch banner; and (once ADR-014 ships) `shellBoundary.report` |
| `editor/src/primary-action.js` | degrade-to-read-only path: how to flip `state.editingSupported = false` and refresh UI |
| `docs/ADR-012-bridge-protocol-v2.md` | normative — §1 handshake, §4 origin assertion |
| `docs/ADR-014-error-boundaries.md` | mismatch banner surface (Layer 1 `shellBoundary`) |
| `tests/playwright/specs/shell.smoke.spec.js` | reference test pattern for bridge-ready |

### Sub-tasks (executable, each ≤ 2 h)

1. Read `editor/src/bridge.js` lines 1–130 end-to-end. Confirm the switch at lines 22–99 handles `bridge-ready` as the first event (line 23). Reference: `editor/src/bridge.js:22-99`. Expected state after: understand existing dispatch and where to insert `case "hello"`.
2. Read `editor/src/bridge-script.js` lines 28–107. Note `post(type, payload, options)` at line 89 and the `__presentationEditor` envelope with `token`. Reference: `editor/src/bridge-script.js:89-94`. Expected state after: understand how to emit `hello` from iframe as first message.
3. Add constants to `editor/src/constants.js`. Insert below line 176 (end of current block): `const BRIDGE_PROTOCOL_VERSION = 2;` and `const SHELL_BUILD = "v0.29.0"`; pass `SHELL_BUILD` into state at init. Expected state after: constants are classic-script globals (no `export`).
4. Create `editor/src/bridge-schema.js` with the skeleton schema registry per ADR-012 §2:
   ```javascript
   // classic-script module; exports on window for bridge.js + bridge-script.js access
   /**
    * @typedef {Object} HelloPayload
    * @property {number} protocol
    * @property {string} build
    * @property {string[]} capabilities
    */
   window.BRIDGE_SCHEMA = Object.freeze({
     hello: {
       direction: "iframe→shell",
       payloadValidator: function(p) {
         if (!p || typeof p !== "object") return { ok: false, code: "hello.shape" };
         if (p.protocol !== 2) return { ok: false, code: "hello.protocol-mismatch" };
         if (typeof p.build !== "string" || !p.build) return { ok: false, code: "hello.build-missing" };
         if (!Array.isArray(p.capabilities)) return { ok: false, code: "hello.capabilities-shape" };
         return { ok: true };
       },
     },
     // WO-13 fills in the remaining message validators.
   });
   ```
   Expected state after: registry file exists with the Hello validator; re-emits on `window.BRIDGE_SCHEMA`.
5. Wire `<script src="src/bridge-schema.js">` in `editor/presentation-editor.html` BEFORE `bridge.js`. Verify script-load order — if `bridge-schema.js` is loaded after `bridge.js`, the `window.BRIDGE_SCHEMA` reference at import time will be undefined. No `type="module"` (invariant). Expected state after: browser DevTools console shows `window.BRIDGE_SCHEMA` defined on load.
6. Edit `editor/src/bridge.js`. In `bindMessages`, add a new `case "hello"` at the top of the switch (so it fires BEFORE `bridge-ready` on the protocol-aware iframe). Body:
   - Validate payload via `window.BRIDGE_SCHEMA.hello.payloadValidator(data.payload)`.
   - If validator `ok: false` with code `hello.protocol-mismatch`: set `state.editingSupported = false`; show banner via `showToast("Несовместимый bridge: shell ожидает протокол v2, iframe прислал vN. Превью переведено в режим только для чтения.", "error", { title: "Bridge mismatch", ttl: 0 })`. Once ADR-014 lands (out of scope of this WO), migrate to `shellBoundary.report({ kind: "error", code: "bridge.protocol-mismatch", ... })`; for now the toast is the source of truth.
   - If validator `ok: false` with other codes: `addDiagnostic("bridge-hello-invalid:" + code)` and keep v1 compat path alive.
   - If `ok: true`: set `state.bridgeProtocolVersion = 2`, `state.bridgeBuild = payload.build`; emit info toast `"Bridge v2 подключён: сборка ${build}"` in advanced mode only (check `state.complexityMode === "advanced"`).
   - Do NOT remove or reorder the existing `bridge-ready` case; `hello` can arrive before OR after `bridge-ready` depending on iframe boot order — validator accepts both.
   Reference: `editor/src/bridge.js:22-99`. Expected state after: `hello` dispatch added, mismatch banner appears on forced-mismatch test.
7. Edit `editor/src/bridge-script.js`. Add at iframe-init (just above the `bridge-ready` emit, which is around the DOMContentLoaded handler): call `post('hello', { protocol: 2, build: TOKEN_SHELL_BUILD, capabilities: ['replace-node-html','replace-slide-html','insert-element','apply-style','apply-styles','update-attributes','replace-image-src','reset-inline-styles','delete-element','duplicate-element','move-element','nudge-element','commit-direct-manipulation'] })`. The `TOKEN_SHELL_BUILD` string is injected by the shell when building the iframe bridge — trace existing token injection in `editor/src/import.js` (search for `bridgeToken` substitution) and add parallel `SHELL_BUILD` substitution. Expected state after: iframe emits `hello` as first message; shell receives and validates.
8. Implement the read-only degrade path. Touch `editor/src/primary-action.js` only in a read-only way — confirm it observes `state.editingSupported`. If the flag alone isn't enough to degrade (e.g. topbar edit button stays enabled), file a follow-up note in PAIN-MAP but do NOT expand the scope of this WO. Expected state after: when `editingSupported=false` from the mismatch path, the `Начать редактирование` button is disabled and shows block reason.
9. Add a Playwright contract test `tests/contract/bridge-handshake.contract.spec.js` (new directory — no npm script edit yet; WO-13 adds the `test:gate-contract` script). Tests:
   - `hello with protocol:2 + matching build → shell sets bridgeProtocolVersion=2`
   - `hello with protocol:1 → shell shows "Bridge mismatch" banner + disables editing`
   - `no hello received within 3s → shell falls back to v1 compat path (keeps working)`
   To force the mismatch: `page.evaluate` inside the preview iframe's window — post a synthetic message with `protocol: 1`. Expected state after: 3 tests, green; Gate-A unchanged.
10. Run `npm run test:gate-a` — must be 55/5/0. Run the new contract spec directly via `npx playwright test tests/contract/ --project=chromium-desktop`. Expected state after: Gate-A baseline, new contract test green.
11. Update `docs/CHANGELOG.md` unreleased: `feat(bridge): v2 hello handshake + mismatch banner — ADR-012 partial — P0-10 start`. Expected state after: changelog entry present.
12. Update `docs/ADR-012-bridge-protocol-v2.md` Status: `Accepted (partial — hello handshake shipped in v0.29.0; per-message validators pending WO-13)`. Expected state after: ADR reflects partial shipping.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag (including `bridge-schema.js`)
- [ ] No bundler dep added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual: open deck from file system, observe iframe init)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A (no CSS in this WO)
- [ ] Russian UI-copy for mismatch banner: `"Несовместимый bridge: shell ожидает протокол v2, iframe прислал vN. Превью переведено в режим только для чтения."` — stays Russian, not translated
- [ ] Bridge v2 hello handshake DEGRADES GRACEFULLY to read-only preview on `protocol !== 2` — NEVER crashes the shell
- [ ] Schema registry lives in ONE file (`editor/src/bridge-schema.js`) per ADR-012 §2 — not split across shell and iframe
- [ ] Script-load order in `presentation-editor.html`: `bridge-schema.js` BEFORE `bridge.js`
- [ ] `state.editingSupported = false` on mismatch; editing button disabled

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:gate-a` prints `55 passed, 5 skipped, 0 failed`
- [ ] `window.BRIDGE_SCHEMA.hello.payloadValidator({ protocol: 2, build: 'x', capabilities: [] })` returns `{ ok: true }` in DevTools after page load
- [ ] Synthetic `{ type: "hello", protocol: 1, ... }` message triggers a Russian banner whose text contains the substring `"v2"` — test spec asserts presence via `page.locator('...').textContent()`
- [ ] When mismatch fires, `state.editingSupported === false` (evaluated via `page.evaluate(() => window.state.editingSupported)`)
- [ ] Iframe emits `hello` as its first `window.postMessage` to parent — verified by `page.on('console', ...)` or a `page.waitForEvent('message')` wrapper — test spec asserts first `__presentationEditor:true` message has `type === "hello"`
- [ ] Commit: `feat(bridge): v2 hello handshake + mismatch banner — v0.29.0 step 12`
- [ ] ADR-012 Status line updated

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Hello v2 match — shell accepts | gate-contract (new) | `tests/contract/bridge-handshake.contract.spec.js` | N/A | pass |
| Hello v1 mismatch — shell shows banner | gate-contract | same | N/A | pass |
| No hello in 3s — shell v1 compat | gate-contract | same | N/A | pass |
| Gate-A baseline | gate-a | existing | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** `hello` message arrives out-of-order relative to `bridge-ready` (depends on iframe boot path), shell state mutates in inconsistent order, UI flickers between "Bridge mismatch" banner and "Превью готово" toast.
- **Mitigation:** Validator accepts `hello` arriving BEFORE or AFTER `bridge-ready`. Set `state.bridgeProtocolVersion` idempotently. Guard the "Bridge v2 подключён" info toast with `if (state.bridgeProtocolVersion !== 2) { ... set it and emit toast once }`. Add a spec test for out-of-order: iframe emits `bridge-ready` then `hello` with protocol=2 — shell accepts and does NOT show mismatch banner.
- **Risk:** Removing or breaking the v1 compat path. AUDIT-D-04 says current wildcard `'*'` targetOrigin is a risk; WO-02 (Agent α) is tightening origin on send. But during v1 compat window (v0.29.x), iframes without `hello` must still work read-only-ish.
- **Mitigation:** Do NOT delete any v1 code paths in this WO. Add `hello` as an additive branch. Graceful degrade = missing `hello` after 3s → diagnostic `"bridge-v1-compat-mode"` + keep editing enabled (because v1 clients don't emit hello). Banner only on explicit mismatch (protocol: 1/3/etc.), not on missing.
- **Rollback:** `git revert <sha>`. `bridge-schema.js` becomes dead; removing the `<script src>` and reverting `bridge.js` + `bridge-script.js` restores v1 behavior. Zero persistent state changes.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:backend-architect
isolation: worktree
branch_prefix: claude/wo-12-bridge-v2-hello-handshake
```

````markdown
You are implementing Step 12 (v0.29.0 Bridge v2 hello handshake) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-12-bridge-v2-hello-handshake   (create from main, AFTER WO-02 from Agent α is merged)

PRE-FLIGHT:
  1. Read CLAUDE.md — project invariants
  2. Read ADR-012-bridge-protocol-v2.md end-to-end — §1 handshake, §2 schema registry, §4 origin assertion
  3. Read ADR-014-error-boundaries.md — Layer 1 shellBoundary surface (future target for mismatch banner)
  4. Read editor/src/bridge.js lines 1–130 full
  5. Read editor/src/bridge-script.js lines 28–107 (STATE block, post function, error hooks)
  6. Confirm Agent α's WO-02 merged (origin assertion on postMessage targetOrigin, crypto token)
  7. Run `npm run test:gate-a` — must be 55/5/0

FILES YOU OWN (exclusive write):
  - editor/src/bridge.js (edit — add case "hello" + version check + mismatch banner)
  - editor/src/bridge-script.js (edit — emit hello as first post)
  - editor/src/bridge-schema.js (new — schema registry skeleton with Hello validator)
  - editor/src/constants.js (edit — BRIDGE_PROTOCOL_VERSION, SHELL_BUILD)
  - editor/presentation-editor.html (edit — add <script src="src/bridge-schema.js"> BEFORE bridge.js)
  - tests/contract/bridge-handshake.contract.spec.js (new — 3 tests)
  - docs/CHANGELOG.md
  - docs/ADR-012-bridge-protocol-v2.md (Status line)

FILES READ-ONLY (reference only):
  - editor/src/state.js (state.bridgeToken, state.editingSupported, state.complexityMode)
  - editor/src/feedback.js (showToast, reportShellWarning)
  - editor/src/primary-action.js (observes editingSupported)
  - editor/src/import.js (TOKEN substitution — parallel SHELL_BUILD substitution)

SUB-TASKS:
  1. Read bridge.js + bridge-script.js fully.
  2. Add BRIDGE_PROTOCOL_VERSION=2 and SHELL_BUILD to constants.js.
  3. Create bridge-schema.js with window.BRIDGE_SCHEMA.hello validator (see WO body).
  4. Add <script src="src/bridge-schema.js"> to shell HTML BEFORE bridge.js script tag.
  5. Add case "hello" to bindMessages switch in bridge.js — validate, set state.bridgeProtocolVersion, handle mismatch with Russian banner.
  6. In bridge-script.js, emit hello as first post() call (with SHELL_BUILD substituted by import.js).
  7. Verify primary-action.js degrades editing when state.editingSupported=false.
  8. Create tests/contract/bridge-handshake.contract.spec.js — 3 tests (match, mismatch, no-hello).
  9. Run Gate-A — must be 55/5/0.
  10. Run contract spec directly via npx playwright test tests/contract/.
  11. Update docs/CHANGELOG.md.
  12. Update ADR-012 Status line.

INVARIANTS (NEVER violate):
  - No `type="module"` added (including bridge-schema.js)
  - No bundler dep added
  - Gate-A 55/5/0 before AND after merge
  - `file://` must still work (manual smoke: open from file system, iframe init)
  - New CSS layer declared in tokens.css first (N/A)
  - Russian UI-copy preserved — mismatch banner text in Russian, not English
  - Bridge v2 hello DEGRADES GRACEFULLY to read-only preview on protocol!==2 — NEVER crashes
  - Schema registry lives in ONE file: editor/src/bridge-schema.js (ADR-012 §2)
  - Script-load order: bridge-schema.js BEFORE bridge.js in presentation-editor.html
  - Do NOT delete v1 compat paths in this WO

CROSS-BATCH DEPENDENCIES:
  - WO-02 (Agent α) must be merged first — provides location.origin assertion. Verify by grep: bridge-script.js post() uses location.origin, not '*'. If not, STOP and coordinate.
  - WO-13 builds on this WO's bridge-schema.js — do NOT land WO-13's validators in this WO.

ACCEPTANCE:
  - Gate-A: 55/5/0 unchanged
  - window.BRIDGE_SCHEMA.hello.payloadValidator({protocol:2,build:'x',capabilities:[]}) === {ok:true}
  - Synthetic hello with protocol:1 → Russian banner containing "v2" substring (spec-asserted)
  - state.editingSupported === false on mismatch (page.evaluate-asserted)
  - First iframe→parent message has type==="hello" (spec-asserted)
  - Commit: `feat(bridge): v2 hello handshake + mismatch banner — v0.29.0 step 12`
  - ADR-012 Status line updated

ON COMPLETION:
  1. Run full acceptance matrix
  2. git add editor/src/bridge.js editor/src/bridge-script.js editor/src/bridge-schema.js editor/src/constants.js editor/presentation-editor.html tests/contract/bridge-handshake.contract.spec.js docs/CHANGELOG.md docs/ADR-012-bridge-protocol-v2.md
  3. Conventional commit: `feat(bridge): v2 hello handshake + mismatch banner — v0.29.0 step 12`
  4. Report: files changed, LOC delta, gate results, contract-spec results, any cross-merge blockers
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Shell reverts to v1 bridge; no state persists (v2 version info is runtime-only). `bridge-schema.js` becomes dead code, safe to delete in a follow-up.

---
