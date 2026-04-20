## Step 13 — v0.29.1 · Per-message validators + sanitize path (finalizes P0-02 inside bridge v2)

**Window:** W3   **Agent-lane:** C   **Effort:** L
**ADR:** ADR-012   **PAIN-MAP:** P0-02 (final), P0-10, P0-13 (final)
**Depends on:**
  - WO-01 (Agent α — `parseSingleRoot` sanitization: allow-list + `BLOCKED_ATTR_NAMES ∪ /^on/i`); this WO builds the bridge-layer schema on top of it.
  - WO-08 (Agent α — contract test scaffold; this WO adds 10+ new tests into that scaffold).
  - WO-12 (this batch — handshake + `bridge-schema.js` skeleton).
**Unblocks:** ADR-012 Accepted; P0-13 (bridge contract tests) closes.

### Context (3–5 lines)

ADR-012 §2 + §5 + §7 requires a schema registry with per-message validators, structured acks, and sanitization inside `parseSingleRoot`. WO-12 scaffolded `editor/src/bridge-schema.js` with the Hello validator only. This WO fills in the registry for all ~30 bridge message types, adds a central validator-gate in both `bindMessages` (shell) and the message handler in `bridge-script.js` (iframe), and applies the `sanitize: true` flag for `replace-node-html` / `replace-slide-html` / `insertElement`. It also ships `tests/contract/bridge.contract.spec.js` replaying recorded message logs against the schema — closing PAIN-MAP P0-13 (AUDIT-E top gap #1, "No bridge contract layer"). The sanitization here composes with WO-01 to finalize P0-02 (no XSS via bridge payload).

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/bridge-schema.js` | edit (fill out registry for all message types) | +240 / −0 |
| `editor/src/bridge.js` | edit (gate dispatch on validator) | +35 / −5 |
| `editor/src/bridge-script.js` | edit (gate receive + add `sanitize` wrapper around `parseSingleRoot`) | +70 / −5 |
| `editor/src/constants.js` | edit (export `BRIDGE_MAX_PAYLOAD_BYTES = 262144` and allow-list constants if missing) | +12 / −0 |
| `tests/contract/bridge.contract.spec.js` | new (per-message replay tests; ≥ 15 test cases) | +320 / −0 |
| `tests/contract/fixtures/bridge-message-log.json` | new (recorded valid + invalid payloads) | +180 / −0 |
| `package.json` | edit (add `test:gate-contract` script) | +1 / −0 |
| `docs/CHANGELOG.md` | edit | +3 / −0 |
| `docs/ADR-012-bridge-protocol-v2.md` | edit Status line | +0 / −0 net |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/bridge-script.js` | lines 30 (`KNOWN_ENTITY_KINDS`), 2332–2339 (`parseSingleRoot`), 3374–3401 (`replace-node-html` / `replace-slide-html` cases) |
| `editor/src/bridge-commands.js` | lines 178–192 (`CANONICAL_ENTITY_KINDS`) — second source of truth to dedupe via registry |
| `editor/src/bridge.js` | full (receive-side dispatch lines 22–99) |
| `editor/src/constants.js` | lines 127–141 (`BRIDGE_MUTATION_TYPES` — initial canonical list) |
| `editor/src/feedback.js` | `reportShellWarning` / `addDiagnostic` for rejection path |
| WO-01 output (Agent α) | `parseSingleRoot` sanitize implementation — DO NOT reimplement, import/wire it |
| WO-12 output (this batch) | `editor/src/bridge-schema.js` skeleton, `window.BRIDGE_SCHEMA` shape |
| `docs/ADR-012-bridge-protocol-v2.md` | normative — §2 schema registry, §5 acks, §6 idempotency, §7 sanitization |
| `tests/contract/bridge-handshake.contract.spec.js` | WO-12 output — reuse Playwright harness style |

### Sub-tasks (executable, each ≤ 2 h)

1. Enumerate bridge message types from source-of-truth `editor/src/constants.js:127–141` (`BRIDGE_MUTATION_TYPES`) + `editor/src/bridge.js:22-99` (receive cases). Compile a canonical list of ~25–30 message types split into: shell→iframe (mutations + mode + select), iframe→shell (bridge-ready, element-selected, slide-activation, runtime-metadata, runtime-error, etc.). Reference: `editor/src/bridge.js:22-99`, `editor/src/constants.js:127-141`. Expected state after: canonical enumeration committed as comment at top of `bridge-schema.js`.
2. For each message type, author a JSDoc `@typedef` and a `payloadValidator` per the ADR-012 §2 shape: `{ direction, payloadValidator, sanitize?: boolean, maxBytes?: number }`. Validators are hand-written, ~3–8 lines each, no dep. For shell→iframe mutations carrying HTML strings (`replace-node-html`, `replace-slide-html`, `insert-element`): set `sanitize: true` and `maxBytes: 262144`. Reference: ADR-012 §2. Expected state after: `bridge-schema.js` has ~30 validator entries totaling ~240 LOC.
3. Consolidate entity-kind duplication per PAIN-MAP P2-05. `KNOWN_ENTITY_KINDS` (bridge-script.js:30) and `CANONICAL_ENTITY_KINDS` (bridge-commands.js:178–192) are the same list twice. Define `const CANONICAL_ENTITY_KINDS_ARR = [...]` in `constants.js` (classic-script global) and reference it from both. Do NOT expand scope into splitting `bridge-commands.js`; just wire the shared const. Reference: `editor/src/bridge-script.js:30`, `editor/src/bridge-commands.js:178-192`. Expected state after: one const, two usage sites.
4. Edit `editor/src/bridge.js`. Wrap the dispatch at line 22 with a pre-validation step: look up `window.BRIDGE_SCHEMA[data.type]`; if not found → `addDiagnostic("bridge-unknown-type:" + data.type)` and drop; if found → run `payloadValidator(data.payload)`; on `ok: false` → `addDiagnostic("bridge-validator-reject:" + data.type + ":" + code)` and drop (do NOT throw). The existing `try/catch` at lines 100–104 wraps handler body; this pre-validation sits outside. Preserve all existing semantics for valid payloads. Reference: `editor/src/bridge.js:22-104`. Expected state after: shell-side validator gate live; invalid payloads silently dropped with diagnostic trail.
5. Edit `editor/src/bridge-script.js` message handler (search the receive path — it's around the main `window.addEventListener('message', ...)` block of the injected iframe script). Apply the same pattern: validator gate before dispatch; on sanitize=true AND HTML-carrying messages, pipe `payload.html` through `parseSingleRoot` (which — per WO-01 — now sanitizes: allow-list tags, filter `BLOCKED_ATTR_NAMES ∪ /^on/i`, strip `javascript:` / `data:text/html` URLs, enforce `maxBytes`). Reference: `editor/src/bridge-script.js:3374-3401` (the target dispatch cases). Expected state after: iframe-side validator gate live; `parseSingleRoot` enforces the schema-declared caps.
6. Implement structured ack per ADR-012 §5 — SCOPED to mutations only in this WO. After every mutation handler completes, emit `post('ack', { refSeq: data.seq, ok: true })`; on validator reject or sanitize fail, emit `post('ack', { refSeq: data.seq, ok: false, error: { code, message } })`. Shell side: add a generic `case "ack"` handler that collects acks keyed by `refSeq` into `state.bridgeAcks` (new Map/object — minimize scope: just a Map; reads happen only in tests for now). Full ADR-014 integration (error codes → `shellBoundary.report`) is OUT of scope; ack collection is the foothold. Expected state after: mutation paths emit acks; shell collects them; contract tests can observe.
7. Create `tests/contract/fixtures/bridge-message-log.json`. Contents: ~30 recorded message payloads, half valid and half deliberately invalid (wrong types, missing fields, oversized HTML, `<script>` injection, `onclick` attribute). Each entry: `{ type, payload, direction, expected: { ok, code? } }`. Derive valid payloads by running the app once and logging real messages (or hand-craft from JSDoc typedefs). Expected state after: fixture covers at minimum: `replace-node-html` (valid + `<script>` inject invalid + oversized invalid), `apply-style`, `update-attributes`, `delete-element`, `insert-element`, `select-element`, `element-selected`, `slide-activation`, `runtime-metadata`, `ack` success, `ack` error.
8. Create `tests/contract/bridge.contract.spec.js`. Structure:
   - `describe("Bridge v2 schema — shell→iframe validators")` — per valid payload, assert `BRIDGE_SCHEMA[type].payloadValidator(payload)` returns `{ ok: true }`.
   - `describe("Bridge v2 schema — iframe→shell validators")` — same.
   - `describe("Bridge v2 schema — invalid payloads reject")` — per invalid payload, assert `{ ok: false, code: expected.code }`.
   - `describe("Bridge v2 sanitize — parseSingleRoot")` — feed `<div onclick="alert(1)">hi</div>` and `<script>alert(1)</script>` and `<a href="javascript:void(0)">`; assert output has no `onclick`, no `<script>`, no `javascript:` URL.
   - `describe("Bridge v2 sanitize — maxBytes")` — feed 300 KB HTML; assert validator rejects with `code: "replace-node-html.oversize"`.
   - `describe("Bridge v2 ack — mutation round-trip")` — dispatch a mutation via `sendToBridge`; wait for ack; assert `state.bridgeAcks.get(seq).ok === true`.
   Minimum 15 test cases. Expected state after: spec exists, all tests green.
9. Add npm script `"test:gate-contract": "playwright test tests/contract/ --project=chromium-desktop"` to `package.json`. Expected state after: `npm run test:gate-contract` runs handshake (from WO-12) + this WO's spec. ADDITIVE — NOT part of Gate-A.
10. Reference-deck compat check (ADR-012 §Consequences warns sanitization may reject HTML that the old system accepted on reference decks `v3-prepodovai-pitch`, `v3-selectios-pitch`). Open each reference deck via the existing test harness (`tests/playwright/specs/reference-decks.deep.spec.js` — DO NOT edit; only run against it). Run `npx playwright test tests/playwright/specs/reference-decks.deep.spec.js --project=chromium-desktop`. If any reference-deck test regresses, narrow the allow-list (do not expand scope; file a blocker comment in the WO completion report). Expected state after: reference decks load + edit + export still clean.
11. Run `npm run test:gate-a` — must be 55/5/0. Run `npm run test:gate-contract` — all new tests green. Run `npm run test:gate-b` — full regression; sanitize changes must not break editor.regression. Expected state after: all gates green.
12. Update `docs/CHANGELOG.md`: `feat(bridge): v2 per-message validators + parseSingleRoot sanitization — ADR-012 Accepted — P0-02 final, P0-10, P0-13 final`.
13. Update `docs/ADR-012-bridge-protocol-v2.md` Status to `Accepted`. Remove the "(partial)" suffix from WO-12.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dep added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A
- [ ] Russian UI-copy preserved — N/A for this WO (no shell strings edited)
- [ ] `test:gate-contract` is ADDITIVE — not in Gate-A. Baseline 55/5/0 unchanged.
- [ ] Schema registry lives in ONE file — `editor/src/bridge-schema.js` (ADR-012 §2)
- [ ] `parseSingleRoot` sanitization from WO-01 is REUSED — this WO does NOT reimplement it
- [ ] Reference decks (`v3-prepodovai-pitch`, `v3-selectios-pitch`) load + edit + export without sanitization regressions
- [ ] Structured acks emitted on mutations — visible in contract spec assertions

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:gate-a` prints `55 passed, 5 skipped, 0 failed`
- [ ] `npm run test:gate-contract` exits 0 — ≥ 15 tests green (including handshake tests from WO-12)
- [ ] `npm run test:gate-b` — full regression unchanged (no new failures introduced by sanitize)
- [ ] `window.BRIDGE_SCHEMA` has ≥ 25 entries (run `Object.keys(window.BRIDGE_SCHEMA).length` in DevTools)
- [ ] Contract spec assertion: feeding `<div onclick="x">` to sanitize returns HTML where `/onclick/i` does not match
- [ ] Contract spec assertion: feeding 300 KB HTML rejects with `code: "replace-node-html.oversize"`
- [ ] `grep "KNOWN_ENTITY_KINDS" editor/src/bridge-script.js` returns ≤ 1 hit (declaration-site only, post-consolidation)
- [ ] ADR-012 Status: `Accepted` (no "partial")
- [ ] Commit message: `feat(bridge): v2 schema validation + sanitize — v0.29.1 step 13`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| All shell→iframe messages validate | gate-contract | `tests/contract/bridge.contract.spec.js` | N/A | pass |
| All iframe→shell messages validate | gate-contract | same | N/A | pass |
| Invalid payloads rejected with stable code | gate-contract | same | N/A | pass |
| `onclick`/`<script>`/`javascript:` stripped by parseSingleRoot | gate-contract | same | N/A | pass |
| Oversize payload rejected | gate-contract | same | N/A | pass |
| Mutation ack round-trip | gate-contract | same | N/A | pass |
| Reference decks (deep spec) | gate-f | `reference-decks.deep.spec.js` | pass | pass (unchanged) |
| Gate-A baseline | gate-a | existing | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** Sanitization in `parseSingleRoot` rejects HTML that reference decks (`v3-prepodovai-pitch`, `v3-selectios-pitch`) depend on (e.g. a decorative `<svg>` with an authored `data-*` attribute that overlaps `BLOCKED_ATTR_NAMES`). Regression on a deck breaks the product promise.
- **Mitigation:** ADR-012 §Consequences explicitly flags this. Sub-task 10 runs the reference-deck deep spec before merge. If regression: (a) narrow the allow-list (keep sanitize but permit the specific tag/attr), (b) if unreachable, land the validator behind a feature flag `state.bridgeSanitizeEnabled` defaulting to `true` but overridable in a follow-up. File the blocker in the WO completion report — do NOT silently relax.
- **Risk:** Acks add latency (~0.5 ms per mutation per ADR-012 estimate). Heavy edit sessions (rapid nudges) may perceptibly lag.
- **Mitigation:** Acks are fire-and-forget (no await on emitter side); latency is purely observational. The `state.bridgeAcks` Map is bounded at 1000 entries with LRU eviction. If latency surfaces in perf tests (AUDIT-C scope), file a follow-up; this WO does not gate on perf.
- **Rollback:** `git revert <sha>`. `bridge-schema.js` reverts to WO-12 skeleton (Hello only). `bridge.js` + `bridge-script.js` validator gates stripped — pre-validation returns to "accept everything". `parseSingleRoot` still calls WO-01's sanitize (which is its own revert path). Contract spec deletion safe.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:backend-architect
isolation: worktree
branch_prefix: claude/wo-13-bridge-v2-schema-validation
```

````markdown
You are implementing Step 13 (v0.29.1 Bridge v2 schema validation + sanitize) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-13-bridge-v2-schema-validation   (create from main, AFTER WO-01, WO-08, WO-12 all merged)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read ADR-012 end-to-end — §2 schema registry, §5 acks, §6 idempotency, §7 sanitization
  3. Read editor/src/bridge.js fully
  4. Read editor/src/bridge-script.js lines 28–107 (STATE + post) and 2332–2339 (parseSingleRoot) and 3374–3401 (replace-node-html, replace-slide-html dispatch)
  5. Read editor/src/bridge-commands.js 178–192 (CANONICAL_ENTITY_KINDS)
  6. Read editor/src/constants.js 127–141 (BRIDGE_MUTATION_TYPES)
  7. Confirm WO-01 (Agent α) merged — parseSingleRoot sanitizes (allow-list + BLOCKED_ATTR_NAMES ∪ /^on/i). Verify via grep: `grep -n "BLOCKED_ATTR_NAMES" editor/src/bridge-script.js` must show it used inside parseSingleRoot.
  8. Confirm WO-08 (Agent α) merged — tests/contract/ scaffold exists. If not, STOP and coordinate.
  9. Confirm WO-12 (this batch) merged — editor/src/bridge-schema.js exists with Hello validator.
  10. Run `npm run test:gate-a` — must be 55/5/0
  11. Run `npm run test:gate-contract` — handshake tests from WO-12 must be green

FILES YOU OWN (exclusive write):
  - editor/src/bridge-schema.js (edit — fill registry for ~30 messages)
  - editor/src/bridge.js (edit — wrap dispatch in validator gate + add case "ack")
  - editor/src/bridge-script.js (edit — validator gate on receive + sanitize wrapper in replace-node-html / replace-slide-html / insert-element; emit acks)
  - editor/src/constants.js (edit — BRIDGE_MAX_PAYLOAD_BYTES, shared CANONICAL_ENTITY_KINDS_ARR)
  - tests/contract/bridge.contract.spec.js (new — ≥ 15 tests)
  - tests/contract/fixtures/bridge-message-log.json (new)
  - package.json (edit — add test:gate-contract script)
  - docs/CHANGELOG.md
  - docs/ADR-012-bridge-protocol-v2.md (Status line)

FILES READ-ONLY (reference only):
  - editor/src/feedback.js (reportShellWarning, addDiagnostic)
  - editor/src/bridge-commands.js
  - editor/src/state.js
  - docs/ADR-012-bridge-protocol-v2.md
  - tests/contract/bridge-handshake.contract.spec.js (WO-12 pattern)
  - tests/playwright/specs/reference-decks.deep.spec.js (run against, do not edit)

SUB-TASKS:
  1. Enumerate bridge message types (constants.js:127-141, bridge.js:22-99) — write canonical list as comment atop bridge-schema.js.
  2. Author @typedef + payloadValidator per message (~30 entries). Mutations with HTML: sanitize:true, maxBytes:262144.
  3. Consolidate entity-kind duplication (PAIN-MAP P2-05) — single CANONICAL_ENTITY_KINDS_ARR in constants.js; reference from both bridge-script.js:30 and bridge-commands.js:178-192.
  4. Wrap bridge.js dispatch in validator pre-check — diagnostic-drop on reject.
  5. Wrap bridge-script.js receive in validator pre-check — pipe HTML payloads through WO-01's parseSingleRoot (reuse, do NOT reimplement).
  6. Emit structured acks on mutations — shell collects in state.bridgeAcks Map.
  7. Create tests/contract/fixtures/bridge-message-log.json — ~30 valid + invalid payloads.
  8. Create tests/contract/bridge.contract.spec.js — ≥ 15 tests across: validator accept, validator reject, sanitize strip, maxBytes reject, ack round-trip.
  9. Add npm script test:gate-contract to package.json — ADDITIVE, not in Gate-A.
  10. Run reference-decks.deep.spec.js — verify no regressions from sanitization.
  11. Gate-A 55/5/0 verified. Gate-contract green. Gate-B unchanged.
  12. docs/CHANGELOG.md unreleased entry.
  13. ADR-012 Status → Accepted (drop "partial").

INVARIANTS (NEVER violate):
  - No `type="module"` added
  - No bundler dep added
  - Gate-A 55/5/0 before AND after merge
  - `file://` still works
  - No new @layer added (N/A — no CSS)
  - Russian UI-copy preserved (N/A — no shell strings edited)
  - test:gate-contract ADDITIVE — not in Gate-A
  - Schema registry lives in ONE file: editor/src/bridge-schema.js
  - Reuse WO-01's parseSingleRoot sanitization — do NOT reimplement
  - Reference decks (v3-prepodovai-pitch, v3-selectios-pitch) must load + edit + export clean
  - Structured acks on mutations — verifiable in contract spec

CROSS-BATCH DEPENDENCIES:
  - WO-01 (Agent α): parseSingleRoot sanitize must be in main. Verify grep before start.
  - WO-08 (Agent α): tests/contract/ directory scaffold must exist.
  - WO-12 (this batch): bridge-schema.js skeleton must exist.
  If any missing: STOP, file blocker, do NOT proceed.

ACCEPTANCE:
  - Gate-A: 55/5/0
  - Gate-contract: ≥ 15 tests green (includes WO-12's handshake tests)
  - Gate-B: unchanged (no new failures from sanitize)
  - Object.keys(window.BRIDGE_SCHEMA).length >= 25 (DevTools / spec-asserted)
  - Sanitize spec: onclick/script/javascript: stripped from output
  - Oversize spec: 300 KB HTML rejected with code "replace-node-html.oversize"
  - grep KNOWN_ENTITY_KINDS editor/src/bridge-script.js ≤ 1 hit (only at declaration)
  - ADR-012 Status: Accepted (no partial)
  - Commit: `feat(bridge): v2 schema validation + sanitize — v0.29.1 step 13`

ON COMPLETION:
  1. Run full acceptance matrix
  2. git add editor/src/bridge-schema.js editor/src/bridge.js editor/src/bridge-script.js editor/src/constants.js tests/contract/bridge.contract.spec.js tests/contract/fixtures/bridge-message-log.json package.json docs/CHANGELOG.md docs/ADR-012-bridge-protocol-v2.md
  3. Conventional commit: `feat(bridge): v2 schema validation + sanitize — v0.29.1 step 13`
  4. Report: files changed, LOC delta, gate-a/gate-contract/gate-b results, reference-deck regression status, any sanitization-allow-list narrowings needed
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Schema registry reverts to WO-12 skeleton (Hello only). Bridge dispatch gates stripped (pre-validation → accept-all). `parseSingleRoot` still calls WO-01's sanitize — that's a separate revert path owned by Agent α. Contract spec deletion safe; `test:gate-contract` script harmless if kept.

---
