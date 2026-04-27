# ADR-031: bridge-script iframe content extraction — develop-time copy strategy

**Status**: Accepted — implementing in v2.0.24 (Phase A2 of Perfection Sprint Track A)
**Phase**: v2.0.24
**Owner**: Architecture
**Date**: 2026-04-27

---

## Context

`editor/src/bridge-script.js` is a 3 906-line file. Lines 1-6 are header comments;
line 7 opens `function buildBridgeScript(token) { return ` `` ` `` ` and line 3905
closes that template literal with `` `; }``. **Lines 8-3904 are a single
template-literal string** evaluated only inside the iframe at runtime. The
function returns the JS text that the shell injects into the preview iframe via
`bridgeScript.textContent = buildBridgeScript(state.bridgeToken)`
(`editor/src/preview.js:33`).

This embedding has well-documented harms:

1. **No tooling visibility.** `tsc --noEmit` (ADR-011) and any future linter
   cannot inspect the body of the template. A typo, dead identifier, or
   syntax error in lines 8-3904 surfaces only at runtime, in the iframe
   console — far from CI. The pre-commit syntax guard
   (`scripts/precommit-bridge-script-syntax.js`, v2.0.21) runs `node --check`
   on the wrapper file, which catches *parse-level* failures of the template
   literal but cannot validate the template *content* — the content is just
   characters in a string.

2. **Backtick / `${...}` hazard.** Any backtick or `${...}` written inside a
   comment in lines 8-3904 prematurely terminates the wrapping template,
   silently corrupting `buildBridgeScript`. v2.0.21 was triggered by
   exactly this bug ("Backtick в comment" — Daily/2026-04-22). The
   pre-commit syntax guard now catches the resulting invalid JS, but the
   underlying authoring trap remains.

3. **Refactoring is hostile.** Grep / global rename misses references inside
   the string body. AUDIT-A item #15 explicitly recommends fixing this:
   *"Bridge-script as a real source file. Move buildBridgeScript() to
   shipping editor/src/bridge-runtime.js (a regular file fetched as text
   and injected via blob)."*

The string content has **5 build-time interpolation points** that splice
shell-side state into the generated iframe script:

| Line | Interpolation | Source |
|------|---------------|--------|
| 14 | `${JSON.stringify(token)}` | function arg — bridge auth token |
| 15 | `${JSON.stringify(STATIC_SLIDE_SELECTORS)}` | `editor/src/constants.js:19` |
| 3766 | `${JSON.stringify(262144)}` | inline 256 KB cap |
| 3798 | `${JSON.stringify(262144)}` | inline 256 KB cap (2nd usage) |
| 3883 | `${JSON.stringify(SHELL_BUILD)}` | `editor/src/constants.js:152` |

These cannot be skipped: the iframe runtime needs each value as a literal
JS expression at injection time. Any extraction strategy must either keep
template-literal interpolation OR replace it with deterministic placeholder
substitution.

## Architectural invariants in scope

These cannot be relaxed for this refactor:

- ✗ no `type="module"` (CLAUDE.md §8 — breaks `file://` protocol).
- ✗ no bundler / runtime build step (ADR-015).
- ✓ shell HTML must work via direct `file://` double-click (SOURCE_OF_TRUTH
  §Non-negotiable invariants; tested by `bridge-file-origin.spec.js`).
- ✓ pre-commit / develop-time tooling that produces source artifacts is
  permitted (ADR-015 §"Allowed" table — "Generated asset manifests" line).

## Candidate strategies

### Strategy A — runtime fetch + placeholder substitution (REJECTED)

Move iframe content into `editor/src/bridge-script-iframe.js` as plain JS
referencing placeholder tokens (`__TOKEN__`, `__ROOT_SELECTORS__`,
`__MAX_HTML_BYTES__`, `__SHELL_BUILD__`). At iframe-build time:
`fetch('src/bridge-script-iframe.js')` → text → string-replace placeholders
→ inject as `bridgeScript.textContent`.

**Why rejected**: under `file://` Chromium blocks `fetch()` against `file:`
URLs without `--allow-file-access-from-files`. End users opening the
editor by double-clicking the HTML do not pass that flag. The editor's
core promise breaks. This is a HARD-STOP per the Phase A2 brief
("Refactor requires platform changes — return").

### Strategy B — `<script src=…>` inside iframe (REJECTED)

Inject `<script src="…/bridge-script-iframe.js">` into the iframe's
srcdoc. Browsers grant same-origin access for sibling files under a
`file://` directory, so the script tag would load. But:

- The token must reach the iframe BEFORE bridge code runs (it's referenced
  in the very first lines of the IIFE). Two options:
  1. Pre-script that sets `window.__BRIDGE_TOKEN = ...` (works on `http://`,
     unclear race semantics on `file://` between two `<script>` tags in srcdoc).
  2. Post-load handshake — postMessage TOKEN to iframe before it does
     anything authenticated. Requires rewriting how the iframe IIFE consumes
     `TOKEN` (currently a top-level `const`).
- The iframe is built via `srcdoc`, not via a real URL. The `src` attribute
  inside srcdoc resolves relative to the parent document's base URL, but
  this behaviour is browser-specific and brittle on `file://`.
- Bigger surface area than Phase A2 should attempt. Touches the bootstrap
  contract.

Tagged: future work. Reconsider for Phase A4-A5 alongside protocol-3.

### Strategy C — develop-time copy (CHOSEN)

Treat the extraction as a **source-management refactor**, not a runtime
change.

- Create `editor/src/bridge-script-iframe.js` — a standalone JS file
  containing the IIFE body. Where the existing template uses `${…}`, use
  placeholder identifiers (e.g. `__BRIDGE_TOKEN_PLACEHOLDER__`) so the
  file is real lint-clean / `node --check`-clean JS.
- Create `scripts/sync-bridge-script.js` — pre-commit script that reads
  `bridge-script-iframe.js`, swaps placeholders for the original `${…}`
  template-literal expressions, and writes the result into the body of
  `bridge-script.js`'s template literal between sentinel comments
  (`// __BEGIN_IFRAME_CONTENT__` … `// __END_IFRAME_CONTENT__`).
- Wire the sync script in `package.json scripts.precommit` BEFORE the
  syntax guard runs.
- The pre-commit syntax guard already in place (v2.0.21) catches any
  drift where someone edited `bridge-script.js` directly without
  re-syncing — the sentinel-bracketed region won't match and `node --check`
  will fail (or, if syntactically valid, the next `npm run test:gate-a`
  will catch behaviour drift).
- `bridge-script.js` keeps its identical runtime shape: still a template
  literal, still 5 interpolation points, still injected by `preview.js`.
  **Zero runtime change.**

Why this fits ADR-015: ADR-015 explicitly authorises "generated asset
manifests" as compile-time-only artifacts that produce no runtime impact.
A synced file is the same shape of artifact: a deterministic projection of
a source file into another file, run pre-commit, leaves `npm start` and
`file://` workflows untouched.

### Strategy D — build-time concatenation via a real bundler (BANNED)

Vite / esbuild step. Banned by ADR-015 and CLAUDE.md §8.

## Decision

**Adopt Strategy C — develop-time copy.**

Concrete shape:

1. `editor/src/bridge-script-iframe.js` — SoT for the iframe-side code.
   - First line: comment block describing placeholders + sync script reference.
   - Wraps body in IIFE the same way the current template does (`(function(){` … `})()`).
   - Replaces 5 `${expr}` interpolations with named placeholders:
     - `${JSON.stringify(token)}` → `__BRIDGE_TOKEN_PLACEHOLDER__`
     - `${JSON.stringify(STATIC_SLIDE_SELECTORS)}` → `__ROOT_SELECTORS_PLACEHOLDER__`
     - `${JSON.stringify(262144)}` → `__MAX_HTML_BYTES_PLACEHOLDER__` (×2)
     - `${JSON.stringify(SHELL_BUILD)}` → `__SHELL_BUILD_PLACEHOLDER__`
   - Each placeholder gets a benign default value (e.g. `null`, `[]`,
     `262144`, `"unknown"`) so the file passes `node --check` and runs as
     valid JS even outside the inject pipeline. This means tooling sees a
     real, complete script.

2. `scripts/sync-bridge-script.js`:
   - Reads `bridge-script-iframe.js` (lint-clean source).
   - Performs literal placeholder substitution back to the
     original `${expr}` form.
   - Writes the result into `bridge-script.js` between sentinel comments.
   - Idempotent.
   - Exits non-zero if the sentinel region cannot be located in
     `bridge-script.js` (catches accidental wrapper-file edits that break
     the contract).

3. `package.json scripts.precommit` chain:
   ```
   node scripts/sync-bridge-script.js
   node scripts/precommit-bridge-script-syntax.js
   ```
   Sync first (so the wrapper is regenerated from source), syntax check
   second (so any sync bug or drift is caught immediately).

4. `gate-a` test script: leave the syntax-guard call as-is; sync runs
   pre-commit, not at test time. Add a guard in the sync script that warns
   if `bridge-script.js` has been hand-edited in the protected region
   (diff-detect after sync; if dirty pre-sync, warn).

5. README / SOURCE_OF_TRUTH update: state that `bridge-script.js` is a
   generated artifact and `bridge-script-iframe.js` is the source of truth
   for the iframe code.

## Migration steps (with safety checkpoints)

Each checkpoint is a separate commit. Gate-A runs after each.

| # | Step | Commit | Rollback |
|---|------|--------|----------|
| 1 | Write ADR-031 | `docs(adr): ADR-031 — extract bridge-script iframe content` | `git revert HEAD` |
| 2 | Spike: tiny prototype proving sync script can re-create current `bridge-script.js` byte-for-byte from a placeholder file | `chore(spike): bridge-script extraction — sync prototype` | `git revert HEAD` |
| 3 | Real `bridge-script-iframe.js` + production sync script + wire `bridge-script.js` between sentinels | `refactor(bridge): extract iframe content to bridge-script-iframe.js` | `git revert HEAD` |
| 4 | Update `package.json scripts.precommit` chain | `chore(ci): chain sync script in precommit` | `git revert HEAD` |
| 5 | Doc-bump: CHANGELOG, SOURCE_OF_TRUTH, README, package.json version → v2.0.24 | `docs: v2.0.24 — bridge-script iframe extraction (ADR-031)` | `git revert HEAD` |
| 6 | Tag `v2.0.24` and push | (no commit) | `git tag -d v2.0.24 && git push --delete origin v2.0.24` |

## Verification plan

After each commit checkpoint:

- `node scripts/precommit-bridge-script-syntax.js` — must pass.
- `node --check editor/src/bridge-script.js` — must pass.
- `node --check editor/src/bridge-script-iframe.js` — must pass (new
  file is real JS).
- `npm run typecheck` — must pass.

After step 3 specifically:

- The synced `bridge-script.js` text MUST be byte-identical (or
  whitespace-identical with documented diffs) to the pre-extraction
  baseline. The spike (step 2) proves this is possible.

After step 5 + before tag:

- Full `npm run test:gate-a` — must be 315/8/0.
- Manual editor smoke flow under Playwright: open editor, load a
  reference deck, select an element, perform a resize, undo, save.

After tag:

- `git log origin/main -1` shows the tagged commit.
- `git tag -l v2.0.24` shows the tag locally and on origin.

## Rollback plan

Single-revert per checkpoint commit. If step 3 (the real extraction) ships
breakage, `git revert HEAD` restores `bridge-script.js` and removes the new
files in one step. Tag `v2.0.24` is only created after the final step + a
green gate-A run, so a bad tag is reversible by `git tag -d v2.0.24 && git
push --delete origin v2.0.24` followed by `git revert` of step 6's tagged
commit.

## Out of scope (future ADRs)

- Refactoring the **internal logic** of `bridge-script-iframe.js` (e.g.
  splitting into smaller modules, reducing the 8 sub-systems AUDIT-A §68
  identified). This ADR ONLY moves bytes; subsequent ADRs may re-organise
  the now-visible code.
- Switching to runtime fetch (Strategy A) once a static-server distribution
  is the supported workflow. That's a Track-2 product decision, not Phase A2.
- Strategy B (script-tag in iframe). Tagged for re-evaluation alongside
  bridge protocol v3.

## Consequences

**Positive**:
- Iframe code becomes lint-visible, `tsc`-visible, grep-friendly.
- Backtick-in-comment hazard moves from ALL 3 906 lines to the 6-line
  wrapper only (the sentinels make the danger region tiny).
- AUDIT-A item #15 is closed.
- Future refactors (sub-system extraction, dead-code removal, etc.) are
  unblocked.

**Negative**:
- One more pre-commit step. Cost: < 50 ms.
- Two files to keep in sync via the script. Mitigated by sentinel-based
  detection: `bridge-script.js` cannot be edited in the protected region
  without breaking the sync detector.
- Initial extraction must be byte-exact — a spike proves this before
  the real change.

## Links

- AUDIT-A §15 (`docs/audit/AUDIT-A-architecture.md`) — original recommendation.
- AUDIT-REPORT-2026-04-26.md §ARCH-001 — re-confirmed as XL debt.
- ADR-011 — type system: tsc-noEmit will be able to see the new file.
- ADR-012 — bridge protocol v2: this refactor preserves the protocol.
- ADR-015 — module bundling: this is the "generated asset" allowed pattern.
- v2.0.21 CHANGELOG entry — pre-commit syntax guard origin.
- editor/src/bridge-script.js — source of the extraction.
- editor/src/preview.js:33 — the call-site that consumes `buildBridgeScript`.
- scripts/precommit-bridge-script-syntax.js — existing guard infrastructure.
