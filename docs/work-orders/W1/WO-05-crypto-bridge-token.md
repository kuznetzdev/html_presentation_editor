## Step 05 — v0.26.1 · Replace `Math.random` bridge token with `crypto.getRandomValues`

**Window:** W1   **Agent-lane:** D (Security)   **Effort:** S
**ADR:** —   **PAIN-MAP:** P1-15
**Depends on:** none (parallel with WO-01/02/03/04)   **Unblocks:** none directly — but aligns with ADR-012 §1 hello-handshake entropy expectations

### Context (3–5 lines)

Per AUDIT-D-15, `createBridgeToken()` at `import.js:735–737` returns `"pe-" + Math.random().toString(36).slice(2) + "-" + Date.now()` — ~52 bits of entropy. Sufficient against unrelated cross-iframe guessing but below the "crypto best-practice" bar; remediation is zero-cost since modern browsers (including file://) expose `crypto.getRandomValues`. This WO swaps the implementation, preserves the `"pe-..."` prefix shape for back-compat with any log grep patterns, and adds a tiny unit spec asserting the new format + absence of `Math.random` in the bridge path.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/import.js` | edit | +18 / −3 |
| `tests/playwright/bridge-token.spec.js` | new | +40 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/import.js:735–737` | current `createBridgeToken` implementation |
| `editor/src/bridge-commands.js:79–86` | token consumer (`state.bridgeToken`); format must stay opaque |
| `editor/src/bridge.js:11` | receive-side token equality check |
| `docs/ADR-012-bridge-protocol-v2.md` §1 | hello handshake uses this token (future) |
| `docs/audit/AUDIT-D-security.md` §AUDIT-D-15 | remediation |

### Sub-tasks (executable, each ≤ 2 h)

1. In `editor/src/import.js` replace `createBridgeToken()` body with:
   ```
   function createBridgeToken() {
     const bytes = new Uint8Array(24);
     if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
       crypto.getRandomValues(bytes);
     } else {
       // Fallback: pre-2017 browsers or sandboxed contexts without crypto global.
       // Keep non-crypto randomness for functional parity; diagnostic logged.
       for (let i = 0; i < bytes.length; i += 1) {
         bytes[i] = Math.floor(Math.random() * 256);
       }
       try { addDiagnostic('bridge-token-fallback-nosubtle'); } catch (e) {}
     }
     let hex = '';
     for (let i = 0; i < bytes.length; i += 1) {
       hex += bytes[i].toString(16).padStart(2, '0');
     }
     return 'pe-' + hex + '-' + Date.now();
   }
   ```
   Expected state after: token is 192 bits of entropy (24 bytes → 48 hex chars) plus a millisecond suffix; prefix `pe-` preserved; fallback path preserved behind a diagnostic.
2. Confirm no other call site generates a "bridge token" via `Math.random` — `grep -n "Math.random" editor/src/*.js` → review each hit, annotate the confirmed-unrelated ones in the commit message. Expected state after: bridge-token is the only Math.random call changed; unrelated Math.random stays.
3. Verify the consumer path doesn't depend on the old length:
   - `bridge.js:11` equality check — treats token as opaque string, fine.
   - `bridge-commands.js:83` — embeds as plain payload field, fine.
   - `bridge-script.js:14` — injected `TOKEN = ${JSON.stringify(token)}`, fine.
   No regex/length assumptions anywhere. Expected state after: consumer-path audit recorded in PR description.
4. Write `tests/playwright/bridge-token.spec.js`: (a) load editor page; via `page.evaluate(() => window.state?.bridgeToken)` confirm shape matches `/^pe-[0-9a-f]{48}-\d+$/`; (b) open a second editor tab, confirm the two tokens differ (near-zero collision probability after crypto fix — asserts against 192-bit entropy). Expected state after: automated shape + uniqueness coverage.
5. Gate-A: `npm run test:gate-a` must remain 55/5/0. Expected state after: invariant preserved.
6. Manual smoke: open `references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html` via file://, confirm selection + save + reload cycle still works end-to-end (token must round-trip through bridge). Expected state after: bridge flow unchanged in practice.
7. Update `docs/CHANGELOG.md` `## Unreleased` → `### Security`: `Bridge token upgraded from Math.random to crypto.getRandomValues (24 bytes / 192 bits) (AUDIT-D-15, P1-15).` Expected state after: changelog entry present.
8. (Optional hardening) — also upgrade `editor/src/bridge-commands.js` sequence generator `nextCommandSeq()` if it uses Math.random? GREP confirms it uses an integer counter, not random → no change. Expected state after: no orphan Math.random escalations in this WO.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (crypto.getRandomValues is available under file:// in all modern browsers)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A
- [ ] Russian UI-copy strings preserved — N/A (diagnostic string is ASCII-only)
- [ ] Token prefix `pe-` preserved — existing log-grep patterns keep working
- [ ] Fallback path retained for sandboxed contexts where crypto may be undefined (belt-and-braces)
- [ ] No new external network calls introduced

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `tests/playwright/bridge-token.spec.js` passes: token matches `/^pe-[0-9a-f]{48}-\d+$/`
- [ ] Two independent loads produce distinct tokens (entropy check — probability of collision < 2⁻¹⁹²)
- [ ] `grep -n "Math.random" editor/src/import.js` shows only the fallback branch comment, no primary-path usage
- [ ] Gate-A remains 55/5/0 (`npm run test:gate-a`)
- [ ] Manual smoke: file:// deck open + select + save + reload works
- [ ] Commit message in conventional-commits format: `fix(security): crypto.getRandomValues bridge token — v0.26.1 WO-05`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Token shape match `/^pe-[0-9a-f]{48}-\d+$/` | gate-a | `tests/playwright/bridge-token.spec.js` | N/A | pass |
| Two tabs → distinct tokens | gate-a | `tests/playwright/bridge-token.spec.js` | N/A | pass |
| Gate-A baseline 55/5/0 | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |
| File:// bridge handshake | manual | — | pass | pass |

### Risk & mitigation

- **Risk:** A sandboxed context (old WebView or locked-down browser) doesn't expose `crypto.getRandomValues` → fallback diagnostic fires but user experiences no functional change.
- **Mitigation:** Fallback branch preserved (Math.random over Uint8Array); diagnostic `bridge-token-fallback-nosubtle` grep-able. Acceptable per "defense-in-depth, not a blocker" framing of P1-15.
- **Risk:** `addDiagnostic` may not exist at the moment `createBridgeToken` is called (ordering in bootstrap). Wrap in try/catch.
- **Mitigation:** Already wrapped in sub-task 1 (`try { addDiagnostic(...) } catch (e) {}`). No bootstrap order assumption.
- **Risk:** Token length changes from ~15 chars to 56 chars; any in-test regex relying on exact length breaks.
- **Mitigation:** Sub-task 3 grep confirms no length-dependent code paths. Test regex in sub-task 4 aligned to the new shape.
- **Rollback:** `git revert <sha>` — trivial, single function body change.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:security-auditor
isolation: worktree
branch_prefix: claude/wo-05-crypto-bridge-token
```

````markdown
You are implementing Step 05 (v0.26.1 crypto.getRandomValues bridge token) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-05-crypto-bridge-token   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read AUDIT-D-security.md finding AUDIT-D-15
  3. Read editor/src/import.js lines 735–737
  4. Read editor/src/bridge.js line 11 (consumer equality check)
  5. Read editor/src/bridge-commands.js lines 78–93 (token embed path)
  6. Read editor/src/bridge-script.js line 14 (TOKEN injection)
  7. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/import.js
  - tests/playwright/bridge-token.spec.js (new)
  - docs/CHANGELOG.md (Unreleased entry)

FILES READ-ONLY (reference only):
  - editor/src/bridge.js
  - editor/src/bridge-commands.js
  - editor/src/bridge-script.js
  - docs/ADR-012-bridge-protocol-v2.md

SUB-TASKS:
  1. Replace createBridgeToken body with crypto.getRandomValues(24-byte Uint8Array) → hex + Date.now
  2. Preserve "pe-" prefix for log-grep back-compat
  3. Fallback branch for contexts without crypto (Math.random over Uint8Array + diagnostic)
  4. grep Math.random in editor/src/*.js, confirm only import.js fallback branch
  5. Confirm consumers treat token as opaque (no length/regex assumption)
  6. Write bridge-token.spec.js with shape + distinct-tabs checks
  7. Gate-A 55/5/0
  8. Manual file:// smoke (prepodovai_pitch_v2.html)
  9. CHANGELOG Unreleased entry

INVARIANTS (NEVER violate):
  - No type="module" on any <script>
  - No bundler added
  - Gate-A 55/5/0 must hold
  - file:// works (crypto.getRandomValues available)
  - Token prefix "pe-" preserved
  - Fallback preserved for sandboxed contexts
  - No new external network calls

ACCEPTANCE:
  - bridge-token.spec.js: shape regex + distinct-tabs pass
  - grep Math.random in import.js shows only fallback comment branch
  - Gate-A remains 55/5/0
  - Conventional commit: fix(security): crypto.getRandomValues bridge token — v0.26.1 WO-05

ON COMPLETION:
  1. Run the full acceptance matrix
  2. git add editor/src/import.js tests/playwright/bridge-token.spec.js docs/CHANGELOG.md
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, gate results, unrelated Math.random call sites noted in commit body
````

### Rollback plan

If merge breaks main: `git revert <sha>` — single function body change, trivial revert. No state migration.
