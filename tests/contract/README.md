# tests/contract — Bridge Contract Gate

## Overview

The contract gate validates the bridge protocol schema registry
(`editor/src/bridge-schema.js`) against a corpus of recorded message samples.
It does NOT open a browser — the IIFE is loaded in a Node.js vm sandbox, which
keeps the suite fast (< 1 s) and dependency-free.

## Gate

```
npx playwright test --project=gate-contract
```

Runs all specs matching `tests/contract/**/*.spec.js`.

## Structure

```
tests/contract/
  bridge.contract.spec.js        Main spec — loads schema + fixtures, asserts validation
  fixtures/
    bridge-log-samples.json      Corpus of 15 fixture entries (see format below)
  README.md                      This file
```

## Fixture format

Each entry in `bridge-log-samples.json` is a JSON object:

```json
{
  "id": "F-01-hello-happy",
  "description": "Human-readable purpose",
  "message": { ... },
  "expected": {
    "ok": true,
    "errors": []
  }
}
```

### Fields

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Stable identifier — prefix `F-NN-` |
| `description` | string | One-line purpose |
| `message` | any | The raw value passed to `validateMessage()` |
| `expected.ok` | boolean | Expected return value of `result.ok` |
| `expected.errors` | string[] | Substrings that must appear in at least one `result.errors` entry (empty for happy-path) |

### Dynamic fixtures

Two entries use `__html_generated: true` + `__html_byte_length: N` to test the
262144-byte size boundary without embedding large strings in JSON. The test
runner expands them to `"x".repeat(N)` before calling the validator.

## Adding new fixtures

1. Open `tests/contract/fixtures/bridge-log-samples.json`.
2. Append a new entry following the format above.
3. Use the next available `F-NN-` id prefix.
4. Run `npx playwright test --project=gate-contract` — the new fixture is
   picked up automatically (no code change required in the spec).

## Adding new message types to the schema

1. Add the type constant to `BRIDGE_MESSAGES` in `editor/src/bridge-schema.js`.
2. If the type has a constrained payload shape, implement a `validateXxx`
   function and register it in `VALIDATORS`. Otherwise add the type to
   `SCHEMA_FREE_TYPES`.
3. Add at least one happy-path and one negative fixture entry.
4. Run `npx playwright test --project=gate-contract` — confirm all pass.

## Handoff note for WO-13 (Agent beta)

Extend this suite with full bridge v2 schemas:

- All shell-to-iframe mutation types: `replace-slide-html`, `insert-element`,
  `apply-style`, `apply-styles`, `update-attributes`
- All iframe-to-shell sync types: `element-selected`, `element-updated`,
  `slide-updated`, `slide-removed`, `slide-activation`, `document-sync`
- Version mismatch / protocol negotiation flows (ADR-012 §1)
- Ack round-trip shape validation (ADR-012 §5)
- Idempotency key deduplication contract (ADR-012 §6)

Once per-type validators are added for those types, also add corresponding
`validateXxx` targeted unit tests in `bridge.contract.spec.js`.

## References

- ADR-012: `docs/ADR-012-bridge-protocol-v2.md` — schema registry design
- PAIN-MAP P0-13: `docs/audit/PAIN-MAP.md` — "No bridge contract layer"
- WO-08: This work order scaffolded the gate
- WO-13: Next work order to extend with full bridge v2 coverage
