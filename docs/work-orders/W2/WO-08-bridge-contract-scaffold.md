## Step 08 — v0.27.0 · Contract test scaffold + `bridge-schema.js` registry bootstrap

**Window:** W2   **Agent-lane:** D (Security) with coordination hand-off to Agent β (bridge v2 owner)   **Effort:** M
**ADR:** ADR-012   **PAIN-MAP:** P0-13 (start — scaffold only; full coverage lands alongside ADR-012 at v0.29.1)
**Depends on:** WO-02 (origin-assertion — ensures test corpus has realistic messages), WO-01 (sanitize path produces deterministic sanitized outputs used by contract test payloads)   **Unblocks:** Agent β's WO-12/13 (bridge protocol v2 — schema validators) and Agent γ's observable-store bridge slice (both need a validator target)

### Context (3–5 lines)

Per AUDIT-E top-gap #1 + PAIN-MAP P0-13, `bridge.js` + `bridge-commands.js` + `bridge-script.js` have zero direct contract coverage — all coverage is transitive through DOM-level Playwright specs. Per ADR-012 §2, the target is a `bridge-schema.js` registry central to shell and iframe, with per-message validators. This WO is the **scaffold** only (not the full schema per §2): bootstrap the `bridge-schema.js` file with message directory + `validateMessage(type, payload)` skeleton + 3 representative schemas (`hello`, `select`, `replace-node-html` — chosen because they span inbound/outbound + sanitize path); and a contract spec skeleton `tests/contract/bridge.contract.spec.js` that replays recorded bridge logs through the validator. Full message coverage is Agent β's WO-13 at v0.29.1. This WO UNBLOCKS that work by providing the validator seam.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/bridge-schema.js` | new | +160 / −0 |
| `editor/presentation-editor.html` | edit | +1 / −0 (register new classic `<script src>` before `bridge.js`) |
| `tests/contract/bridge.contract.spec.js` | new | +140 / −0 |
| `tests/contract/fixtures/bridge-log-samples.json` | new | +80 / −0 (10–15 recorded messages) |
| `tests/contract/README.md` | new | +40 / −0 |
| `playwright.config.js` | edit | +6 / −0 (new `gate-contract` project definition — disabled by default, hand-off to Agent β to wire into CI) |
| `docs/CHANGELOG.md` | edit | +3 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/bridge.js:7–105` | receive dispatcher — all known message types |
| `editor/src/bridge-script.js:89–94, 3374–3401` | send + receive — message types + payload shapes |
| `editor/src/bridge-commands.js:78–99` | shell-to-iframe send path |
| `docs/ADR-012-bridge-protocol-v2.md` §2 | schema registry contract |
| `docs/audit/AUDIT-E-tests.md` (referenced via PAIN-MAP P0-13) | test coverage gap |
| WO-01 output: sanitize rules | drives `replace-node-html` schema's `sanitize: true` flag test |
| WO-02 output: origin assertion | drives test that messages with mismatched origin are dropped before validation |

### Sub-tasks (executable, each ≤ 2 h)

1. Create `editor/src/bridge-schema.js` as a classic script (NO `type="module"` — invariant). Top-level structure:
   ```
   (function() {
     'use strict';
     const MESSAGE_DIRECTIONS = Object.freeze({ SHELL_TO_IFRAME: 's2i', IFRAME_TO_SHELL: 'i2s', BOTH: 'both' });
     const BRIDGE_MESSAGES = Object.freeze({
       'hello':             { direction: 'i2s', validator: validateHello, sanitize: false, maxBytes: 4096 },
       'select':            { direction: 'both', validator: validateSelect, sanitize: false, maxBytes: 16384 },
       'replace-node-html': { direction: 's2i', validator: validateReplaceNodeHtml, sanitize: true, maxBytes: 262144 },
     });
     function validateMessage(type, payload, opts) { ... }
     function validateHello(payload) { ... }
     function validateSelect(payload) { ... }
     function validateReplaceNodeHtml(payload) { ... }
     window.BRIDGE_SCHEMA = Object.freeze({ MESSAGE_DIRECTIONS, BRIDGE_MESSAGES, validateMessage });
   })();
   ```
   Each `validate*` returns `{ ok: true }` on success OR `{ ok: false, errors: [...] }`. Hand-written primitive guards only (no zod dependency per ADR-015). Expected state after: validator module exists; exports `window.BRIDGE_SCHEMA` at classic-script time.
2. `validateHello({ protocol, build, capabilities })` — assert `typeof protocol === 'number' && protocol >= 1`, `typeof build === 'string' && build.length >= 4`, `Array.isArray(capabilities)`, length ≤ 32. Expected state after: hello schema validates ADR-012 §1 handshake.
3. `validateSelect({ nodeId, slideId, selectionPath? })` — assert `typeof nodeId === 'string' && nodeId.length > 0 && nodeId.length <= 256`, `typeof slideId === 'string' && slideId.length > 0 && slideId.length <= 256`, if `selectionPath` present: `Array.isArray && length <= 32 && every(entry)→{nodeId:string}`. Expected state after: select schema blocks nodeId overflow.
4. `validateReplaceNodeHtml({ nodeId, html })` — assert `typeof nodeId === 'string' && nodeId.length > 0 && nodeId.length <= 256`, `typeof html === 'string' && html.length <= 262144`. Mirrors WO-01's `MAX_HTML_BYTES`. Expected state after: schema enforces same cap as the bridge runtime.
5. `validateMessage(type, payload, opts)` walks up the `BRIDGE_MESSAGES[type]` entry; if `type` not registered → `{ ok: false, errors: ['unknown-message-type:' + type] }`; if `payload` is not an object → `{ ok: false, errors: ['non-object-payload'] }`; if size byte-count > `maxBytes` when JSON-stringified → `{ ok: false, errors: ['payload-too-large:' + size] }`; then delegate to `spec.validator(payload)`. Expected state after: type-dispatching validator exists.
6. Register `bridge-schema.js` in `editor/presentation-editor.html` as a classic `<script src>` BEFORE `bridge.js` (order matters; consumers call `window.BRIDGE_SCHEMA.validateMessage(...)` at runtime). Expected state after: loads at correct point in boot sequence; no `type="module"` added.
7. Create `tests/contract/` directory + `tests/contract/fixtures/bridge-log-samples.json` containing 10–15 recorded messages: mix of happy-path (`hello/select/replace-node-html` with valid payloads), boundary (empty string, exact-at-cap HTML, 256-char nodeId) and negative (unknown message type, missing nodeId, html at 262145 bytes, non-object payload). Each entry: `{ type, payload, expected: { ok: boolean, errorsPattern?: string } }`. Expected state after: corpus exists and is deterministic (no randomness).
8. Write `tests/contract/bridge.contract.spec.js`: iterate the corpus, for each entry call `window.BRIDGE_SCHEMA.validateMessage(type, payload)` (bootstrap via `page.addScriptTag({ path: 'editor/src/bridge-schema.js' })` in a fresh page context) and assert `ok === expected.ok` and (if negative) the error code matches `expected.errorsPattern` via regex. Expected state after: scaffold spec executes standalone via `npx playwright test tests/contract/bridge.contract.spec.js`.
9. Write `tests/contract/README.md` explaining: (a) purpose (schema drift detection), (b) how to add a new message schema (update `bridge-schema.js` + extend corpus fixture), (c) relation to ADR-012 §2 + Agent β's WO-13 dependency, (d) when full-coverage target ships (v0.29.1). Expected state after: onboarding doc for Agent β.
10. Add `gate-contract` project to `playwright.config.js` — `{ name: 'gate-contract', testMatch: 'tests/contract/**/*.spec.js', use: { browserName: 'chromium' } }`. Do NOT add to the default `test:gate-a` script (would fail the 55/5/0 invariant). Include in `test:gate-f` if that aggregates all gates. Expected state after: contract gate runnable via `npx playwright test --project=gate-contract`; Gate-A remains unchanged.
11. Verify invariants explicitly: `grep -n 'type="module"' editor/presentation-editor.html` → zero hits. `grep -n "import " editor/src/bridge-schema.js` → zero hits (classic script idiom only). Expected state after: invariants machine-verified.
12. Run `npm run test:gate-a` — must remain 55/5/0 (this WO adds no specs to gate-a). Expected state after: Gate-A invariant holds.
13. Run `npx playwright test --project=gate-contract` — all corpus entries pass. Expected state after: contract gate green on ~15 scenarios.
14. Update `docs/CHANGELOG.md` `## Unreleased` → `### Testing`: `Bridge contract scaffold: bridge-schema.js registry + tests/contract/bridge.contract.spec.js covers hello/select/replace-node-html. Full coverage lands in v0.29.1 with ADR-012 Bridge Protocol v2 (P0-13).`. Expected state after: changelog entry present.
15. Hand-off note for Agent β in commit body: "WO-08 ships `window.BRIDGE_SCHEMA.validateMessage` + 3 schemas + corpus. Agent β's WO-13 extends: (a) add remaining ~27 message schemas, (b) wire `validateMessage` INTO bridge.js and bridge-script.js dispatchers, (c) add sanitize: true enforcement that runs WO-01's sanitizer before handler."

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (no new runtime dependency; bridge-schema.js is a classic script; default behavior unchanged as validator is not yet wired into dispatchers)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A
- [ ] Russian UI-copy strings preserved (not translated to English) — N/A (no UI copy in scaffold)
- [ ] `bridge-schema.js` is a classic `<script src>` — NO `import`/`export`/`type="module"`
- [ ] Validator is pure / side-effect-free — does NOT mutate `window.state` or DOM
- [ ] Gate-contract does not run inside Gate-A (invariant: Gate-A stays 55/5/0)
- [ ] Corpus entries include WO-01 sanitize boundary (html at 262144 bytes) and WO-02 origin boundary (stub test case — marked `TODO: wire when Agent β WO-13 lands`)
- [ ] No new external network calls introduced

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npx playwright test --project=gate-contract` passes all corpus entries (~15 scenarios)
- [ ] `window.BRIDGE_SCHEMA.validateMessage('unknown-type', {})` returns `{ ok: false, errors: ['unknown-message-type:unknown-type'] }`
- [ ] `window.BRIDGE_SCHEMA.validateMessage('replace-node-html', { nodeId: 'x', html: 'a'.repeat(262145) })` returns `{ ok: false, errors: ['payload-too-large:...'] }`
- [ ] `window.BRIDGE_SCHEMA.validateMessage('replace-node-html', { nodeId: 'x', html: 'a'.repeat(1024) })` returns `{ ok: true }`
- [ ] `editor/presentation-editor.html` includes `<script src="editor/src/bridge-schema.js"></script>` BEFORE bridge.js script tag
- [ ] Gate-A remains 55/5/0 (`npm run test:gate-a`)
- [ ] `tests/contract/README.md` documents how Agent β extends the registry
- [ ] Commit message in conventional-commits format: `feat(tests): bridge-schema + contract scaffold — v0.27.0 WO-08`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| validateMessage rejects unknown type | gate-contract | `tests/contract/bridge.contract.spec.js` | N/A | pass |
| validateHello happy path | gate-contract | `tests/contract/bridge.contract.spec.js` | N/A | pass |
| validateSelect happy + boundary | gate-contract | `tests/contract/bridge.contract.spec.js` | N/A | pass |
| validateReplaceNodeHtml: at cap ok | gate-contract | `tests/contract/bridge.contract.spec.js` | N/A | pass |
| validateReplaceNodeHtml: over cap fails | gate-contract | `tests/contract/bridge.contract.spec.js` | N/A | pass |
| Gate-A baseline 55/5/0 unchanged | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** The scaffold is mistakenly wired into `bridge.js` dispatcher prematurely — validators start rejecting real messages before the full schema set is populated, breaking the editor.
- **Mitigation:** This WO's scope is **explicitly scaffold only** — `validateMessage` is added to `window.BRIDGE_SCHEMA` and tested via spec, but the shell/iframe dispatchers do NOT call it yet. Sub-task 15 documents the hand-off to Agent β's WO-13 that wires it in. Gate-A remains 55/5/0 as proof.
- **Risk:** The corpus under-represents real protocol variance; later schema additions reveal payload shapes that shouldn't validate but do.
- **Mitigation:** `README.md` for contract tests documents "add a message-type entry + 3 fixture cases (happy, boundary, negative)" process. Agent β's WO-13 is the full coverage pass.
- **Risk:** Loading `bridge-schema.js` in the shell adds a script-parse cost before `bridge.js`.
- **Mitigation:** ~160 LOC; parse cost < 1 ms. Classic script, no network fetch under file://. Acceptable.
- **Risk:** `playwright.config.js` edit triggers a Gate-A project-list change that flakes the 55/5/0.
- **Mitigation:** Add `gate-contract` as an explicitly NAMED project separate from Gate-A's `chromium-desktop`. Do NOT touch `chromium-desktop` config. Sub-task 12 verifies.
- **Rollback:** `git revert <sha>`. Scaffold is additive, validator not wired anywhere yet. Revert cleanly removes the file + spec + config entry.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:security-auditor
isolation: worktree
branch_prefix: claude/wo-08-bridge-contract-scaffold
```

````markdown
You are implementing Step 08 (v0.27.0 bridge-schema.js registry + contract scaffold) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-08-bridge-contract-scaffold   (create from main)
BLOCKED BY: WO-01 (sanitize boundary defines maxBytes=262144) + WO-02 (origin test stub references)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants — especially NO type="module", NO bundler
  2. Read ADR-012 §2 (schema registry)
  3. Read PAIN-MAP row P0-13
  4. Read editor/src/bridge.js in full (receive dispatcher)
  5. Read editor/src/bridge-script.js lines 89–107 + 3370–3410 (send + receive)
  6. Read editor/src/bridge-commands.js lines 78–99 (shell→iframe send)
  7. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/bridge-schema.js  (new, classic script IIFE exporting window.BRIDGE_SCHEMA)
  - editor/presentation-editor.html  (register <script src="editor/src/bridge-schema.js"></script> BEFORE bridge.js)
  - tests/contract/bridge.contract.spec.js  (new)
  - tests/contract/fixtures/bridge-log-samples.json  (new, 10–15 corpus entries)
  - tests/contract/README.md  (new, Agent β onboarding)
  - playwright.config.js  (add gate-contract project — MUST NOT modify chromium-desktop project)
  - docs/CHANGELOG.md  (Unreleased entry)

FILES READ-ONLY (reference only):
  - editor/src/bridge.js
  - editor/src/bridge-script.js
  - editor/src/bridge-commands.js
  - docs/ADR-012-bridge-protocol-v2.md
  - docs/audit/PAIN-MAP.md

SUB-TASKS:
  1. Scaffold bridge-schema.js IIFE with MESSAGE_DIRECTIONS + BRIDGE_MESSAGES + validateMessage + 3 validators (hello, select, replace-node-html)
  2. validateHello: protocol, build, capabilities
  3. validateSelect: nodeId, slideId, optional selectionPath
  4. validateReplaceNodeHtml: nodeId, html (maxBytes 262144)
  5. validateMessage dispatcher: unknown-type, non-object, payload-too-large, then per-schema
  6. Register bridge-schema.js in presentation-editor.html BEFORE bridge.js
  7. Author fixtures/bridge-log-samples.json (10–15 entries: happy, boundary, negative)
  8. Write bridge.contract.spec.js: iterate fixtures, run validateMessage, assert ok/errors
  9. Write tests/contract/README.md explaining extension procedure for Agent β WO-13
  10. Add gate-contract project in playwright.config.js (chromium, testMatch tests/contract/**)
  11. Verify NO type="module", NO import statements in bridge-schema.js
  12. Gate-A remains 55/5/0
  13. Run `npx playwright test --project=gate-contract` — all fixtures pass
  14. CHANGELOG Unreleased entry
  15. Hand-off note in commit body for Agent β WO-13

INVARIANTS (NEVER violate):
  - No type="module" added
  - No bundler added
  - Gate-A 55/5/0 must hold
  - file:// workflow intact (scaffold is inert; validator not wired into dispatchers yet)
  - bridge-schema.js is a classic script IIFE exporting window.BRIDGE_SCHEMA
  - Validator is pure, no DOM or state mutation
  - Gate-contract runs in a NEW project, NOT in Gate-A
  - Corpus boundary entries align with WO-01 maxBytes
  - No new external network calls

ACCEPTANCE:
  - gate-contract: all ~15 fixture entries pass
  - window.BRIDGE_SCHEMA.validateMessage returns { ok, errors } shape
  - Unknown-type, over-cap, non-object cases all fail correctly
  - presentation-editor.html has bridge-schema.js BEFORE bridge.js
  - Gate-A remains 55/5/0
  - README onboards Agent β with extension procedure
  - Conventional commit: feat(tests): bridge-schema + contract scaffold — v0.27.0 WO-08

ON COMPLETION:
  1. Run the full acceptance matrix
  2. git add editor/src/bridge-schema.js editor/presentation-editor.html tests/contract/ playwright.config.js docs/CHANGELOG.md
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, gate-a results (unchanged), gate-contract results, hand-off note content for Agent β
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Scaffold is purely additive — no dispatcher wired, no runtime behavior change. Clean revert removes the file set without impact. `gate-contract` project can be removed from `playwright.config.js` too if revert is needed post-merge.
