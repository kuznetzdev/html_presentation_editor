# ADR-012: Bridge Protocol v2 — schema registry + version negotiation

**Status**: Accepted (partial — hello handshake shipped; per-message validators pending WO-13)
**Phase**: v0.27.x–v0.30.x
**Owner**: Architecture · Bridge layer
**Depends on**: ADR-011 (JSDoc), ADR-014 (error boundaries)
**Date**: 2026-04-20

---

## Context

The current bridge (`bridge.js` + `bridge-commands.js` + `bridge-script.js`) works but:

- **Unversioned** (AUDIT-A scorecard 6/10). Shell and iframe-injected script are produced from the same repo but have no handshake verifying they match.
- **Untyped payloads.** `replace-node-html` / `replace-slide-html` / `insertElement` accept arbitrary HTML strings (AUDIT-D-02 — High). Filter applied to `updateAttributes` is missing here.
- **Duplication.** `KNOWN_ENTITY_KINDS` (bridge-script.js:30) and `CANONICAL_ENTITY_KINDS` (bridge-commands.js:178–192) carry the same list twice.
- **No idempotency contract.** `seq` tracking exists for mutations (`bridge-commands.js:49–76`) but there is no replay/dedupe guarantee per message type.
- **Wildcard targetOrigin** `'*'` (AUDIT-D-04) — no origin assertion on receive.
- **Silent failures.** `try/catch` in `bridge.js:100–104` swallows all errors, folding them into generic diagnostics.

Consequences: security findings, protocol drift on refactor, evolvability ceiling.

---

## Decision

Ship **Bridge Protocol v2** — a versioned, schema-validated, origin-asserted evolution. Principles:

### 1. Version handshake

First message from iframe → shell: `{ type: 'hello', protocol: 2, build: <commit-sha-short>, capabilities: [...] }`.
Shell verifies `protocol === 2 && build === state.shellBuild`; on mismatch → diagnostics + "bridge mismatch" banner + degrade to read-only preview.

### 2. Schema registry

Central module `editor/src/bridge-schema.js` exports:

```javascript
/**
 * @typedef {Object} ReplaceNodeHtmlPayload
 * @property {string} nodeId
 * @property {string} html  // will be sanitized by schema validator
 */

window.BRIDGE_MESSAGES = {
  "hello":             { direction: "iframe→shell", payloadSchema: "Hello" },
  "select":            { direction: "both",         payloadSchema: "Select" },
  "replace-node-html": { direction: "shell→iframe", payloadSchema: "ReplaceNodeHtml", sanitize: true, maxBytes: 262144 },
  // ... all messages catalogued in one place
};
```

Each schema has:
- JSDoc `@typedef` (ADR-011 — no runtime cost for type check)
- Runtime validator (lightweight hand-written — no zod dep; ~60 LOC total)
- Optional `sanitize: true` — applies HTML allow-list before forwarding
- Optional `maxBytes` — payload size cap

### 3. Dispatch contract

Both sides (`bindMessages` in shell, message handler in bridge-script) share identical logic via a generated constants file. Adding a message requires exactly one edit in `bridge-schema.js`.

### 4. Origin assertion

On send: `target.postMessage(msg, location.origin)` (never `'*'`).
On receive: `if (event.origin !== location.origin) return` (guard before token check).

### 5. Structured error responses

Every message can be answered with `{ type: 'ack', refSeq, ok: true }` or `{ type: 'ack', refSeq, ok: false, error: { code, message } }`. Shell collects error codes in diagnostics; recoverable errors trigger banner via ADR-014.

### 6. Idempotency keys

Mutation messages carry `seq` (already exists). v2 formalizes: receiver must dedupe by `(type, nodeId, seq)` tuple, drop stale, ACK with `{ stale: true }` on dup.

### 7. Sanitization inside `parseSingleRoot`

Fixes AUDIT-D-02 directly: tag allow-list (`div, span, p, h1-6, ul, ol, li, img, table, ...`), attribute filter (`BLOCKED_ATTR_NAMES ∪ /^on/i`), `javascript:/data:text/html` URL strip, size cap.

---

## Consequences

**Positive:**
- Security (AUDIT-D-02) remediated structurally, not point-fix.
- Schema drift caught by tsc at dev time + runtime validator at boot.
- Contract tests (AUDIT-E gap P0-13) become trivial: feed recorded logs through validator, assert shape.
- Observability: structured acks unlock real diagnostics instead of swallowed errors.
- Shell/iframe version mismatch surfaces as a banner instead of silent drift.

**Negative:**
- Migration touches every message type (~30). Sequence: v2 added alongside v1; iframe sends `hello{protocol:2}`; shell prefers v2 if matched; v1 fallback path remains for one minor version; then deleted.
- Validator adds ~3–5 KB + ~0.5 ms per message. Trivial at current traffic.
- `parseSingleRoot` sanitization may reject HTML the old system accepted — requires compatibility test with reference decks (v3-prepodovai-pitch, v3-selectios-pitch).

---

## Alternatives Considered

1. **Leave v1 in place; point-patch AUDIT-D-02.** Rejected — patches without structure; next feature adds the same hole.
2. **Use SharedWorker / MessageChannel instead of window.postMessage.** Rejected — more complex, same-origin file:// has MessageChannel quirks.
3. **Sandbox the iframe with `allow-scripts` only (no `allow-same-origin`).** Considered for v3. Breaks `window.parent.state` reach but also breaks deck engines that need `same-origin`. See AUDIT-D-01 remediation option.
4. **Full IDL + codegen.** Overkill for ~30 messages.

---

## Applied In

- v0.27.x — `bridge-schema.js` scaffold + `hello` handshake
- v0.28.x — all shell→iframe messages validated
- v0.29.x — all iframe→shell messages validated + sanitization inside `parseSingleRoot`
- v0.30.x — v1 code path removed; v2 is default

## Links
- [ADR-011 Type System Strategy](ADR-011-type-system-strategy.md)
- [ADR-014 Error Boundaries](ADR-014-error-boundaries.md)
- AUDIT-D-02, AUDIT-D-04 — security
- AUDIT-A §bridge-script.js / bridge-commands.js
- AUDIT-E §"No bridge contract layer"
- [Existing ADR-001 Block Reason Protocol](ADR-001-block-reason-protocol.md)
