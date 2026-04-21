# ADR-011: Type System Strategy — JSDoc over TypeScript, no compile step

**Status**: Accepted (partial — tsconfig + 3 files annotated in v0.28.1; module-by-module rollout continues)
**Phase**: v0.26.x (foundational — unblocks ADR-012, ADR-013)
**Owner**: Architecture
**Date**: 2026-04-20

---

## Context

Current code is plain ES5/ES6 JavaScript with zero type annotations. Audit findings:

- AUDIT-A scorecard — Testability 3/10, Evolvability 5/10. Reason: no schema anywhere.
- AUDIT-A — `state` object has 75+ untyped fields mutated from 15 modules.
- AUDIT-A — Bridge message payloads are free-form objects; drift between iframe side and shell side caught only at runtime.
- AUDIT-E — No unit tests partly because untyped modules have no contract to assert against.
- AUDIT-D-02 — Bridge command payloads accept arbitrary HTML precisely because there is no schema gate.

But: **no build step** is a load-bearing product invariant (SOURCE_OF_TRUTH, ROADMAP_NEXT). Adding TypeScript requires a compile step. That is a product regression.

Alternatives considered:

1. **TypeScript with tsc emit.** Requires `npm run build` before serving. Kills file:// workflow. ❌
2. **TypeScript JSDoc-mode (checkJs + JSDoc).** Authors write JS with JSDoc annotations, IDE + `tsc --noEmit` validates. No compile output, no build step.
3. **No types.** Status quo. Keeps the pain.
4. **Flow.** Dying ecosystem in 2026. ❌
5. **Runtime type assertion (zod, io-ts).** Extra dep + runtime cost. Partial solution (runtime only).

---

## Decision

Adopt **JSDoc-with-checkJs** as the type system:

1. Add `tsconfig.json` with:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "none",
       "checkJs": true,
       "allowJs": true,
       "strict": true,
       "noEmit": true,
       "lib": ["DOM", "ES2022"]
     },
     "include": ["editor/src/**/*.js"]
   }
   ```
2. Add dev-dep `typescript` (for `tsc --noEmit` only — never runs at runtime).
3. Add `"typecheck": "tsc --noEmit"` script. Not part of Gate-A. Optional gate `test:gate-types`.
4. Annotate **bridge messages, state shape, and public module APIs first** (ADR-012 + ADR-013). Internals can remain un-annotated.
5. Forbid `any` in ADR-012 message schemas. Permit `any` in transitional internals.
6. Use `@typedef` instead of `import type` — works with classic `<script src>` and shared globals.

### Out of scope

- Converting to `.ts` files. Files stay `.js`.
- Converting to ES modules. Classic `<script src>` stays per ADR-001.
- Runtime validation. Separate concern — see ADR-012 (bridge validation) and ADR-014 (error boundaries).

---

## Consequences

**Positive:**
- IDE gets autocomplete + error squiggles with zero runtime cost.
- Bridge message contracts become inspectable (`@typedef {{ type: 'replace-node-html', payload: {...} }}`).
- State shape becomes a single `@typedef` — schema drift surfaces as tsc errors.
- Unit-testing becomes possible: type contract = test contract.
- No build step. `tsc --noEmit` is CI-only.
- Reversible: delete `tsconfig.json` and the dev-dep to revert.

**Negative:**
- Author friction on dense `@typedef` blocks; mitigated by scoping to public APIs first.
- `tsc --noEmit` runs ~2–5 s on 20k LOC; acceptable as optional gate.
- JSDoc expressiveness has known gaps vs. TypeScript syntax (conditional types, mapped types). Acceptable for a UI app — not a library.
- Developers unfamiliar with JSDoc typedef syntax need a short onboarding note.

---

## Alternatives Considered

See Context §1–5. TypeScript-with-emit is the closest contender; rejected solely because of the no-build invariant. If that invariant is ever relaxed (see ADR-015), revisit this ADR.

---

## Applied In

- v0.26.x — tsconfig + dev-dep + first `@typedef` for `state.js` shape (unblocks ADR-013)
- v0.27.x — bridge message typedefs (unblocks ADR-012)
- v0.28.x — module-public API typedefs module-by-module

## Links
- [ADR-001 Classic Scripts](../obsidian-ref/ADR-001-classic-scripts.md) — no-build invariant origin
- [ADR-012 Bridge Protocol v2](ADR-012-bridge-protocol-v2.md)
- [ADR-013 Observable Store](ADR-013-observable-store.md)
- [ADR-015 Module Bundling Decision](ADR-015-module-bundling-decision.md)
- AUDIT-A §Scorecard "Testability 3/10"
- AUDIT-E §"No unit tests, no contract tests"
