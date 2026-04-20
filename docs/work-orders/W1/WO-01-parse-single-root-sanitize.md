## Step 01 — v0.26.1 · `parseSingleRoot` tag+attr filter inside bridge HTML-replace path

**Window:** W1   **Agent-lane:** B (Security)   **Effort:** S
**ADR:** ADR-012   **PAIN-MAP:** P0-02
**Depends on:** none   **Unblocks:** WO-08 (contract scaffold validates sanitized shapes), full ADR-012 sanitize-directive switch at v0.29.1

### Context (3–5 lines)

Per AUDIT-D-02 (HIGH), `parseSingleRoot(html)` at `bridge-script.js:2332–2339` parses caller HTML with `DOMParser` and imports the single root with **no tag/attr allow-list**. The bridge commands `replace-node-html` (`bridge-script.js:3374–3387`), `replace-slide-html` (`bridge-script.js:3388–3401`) and `insertElement` consume this path. A single malicious paste persists `<script>`/`on*`/`javascript:` into the model and survives every subsequent export — poisoning downstream artifacts. Closes P0-02 structurally (same defense the `updateAttributes` path already applies) without breaking the file:// contract or deck-engine JS.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/bridge-script.js` | edit | +70 / −2 |
| `tests/playwright/bridge-sanitize.spec.js` | new | +110 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/bridge-script.js` lines 62–64 | existing `BLOCKED_ATTR_NAMES` / `VALID_ATTR_NAME` / `UNSAFE_ATTR_NAME` to reuse |
| `editor/src/bridge-script.js` lines 28–30 | `EXCLUDED` (script/style/meta/link/base) + `KNOWN_ENTITY_KINDS` — do not widen |
| `editor/src/bridge-script.js` lines 2756–2796 | prior-art attribute filter in `updateAttributes` (mirror its rules) |
| `editor/src/bridge-script.js` lines 3374–3401 | call sites of `parseSingleRoot` |
| `docs/ADR-012-bridge-protocol-v2.md` §7 | sanitization spec ("sanitize: true" directive) |
| `docs/audit/AUDIT-D-security.md` §AUDIT-D-02 | remediation details + tag allow-list |
| `references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html` | regression reference |
| `references_pres/html-presentation-examples_v3/selectios_pitch_v2_final.html` | regression reference |

### Sub-tasks (executable, each ≤ 2 h)

1. Read `bridge-script.js:2332–2339` — confirm `parseSingleRoot` returns `document.importNode(elements[0], true)` unsanitized. Expected state after: understand current semantics before refactor.
2. Introduce top-level constants above `parseSingleRoot` (near line 64, inside the template string): `ALLOWED_HTML_TAGS` = set of `{DIV,SPAN,P,H1-H6,UL,OL,LI,IMG,TABLE,TBODY,THEAD,TR,TD,TH,FIGURE,FIGCAPTION,EM,STRONG,A,CODE,PRE,BR,SVG,G,PATH,CIRCLE,RECT,LINE,POLYLINE,POLYGON,TEXT,TSPAN,DEFS,USE,SYMBOL,BLOCKQUOTE,SECTION,ARTICLE,ASIDE,HEADER,FOOTER,NAV,MAIN,B,I,U,S,SUB,SUP,SMALL,MARK,LABEL,VIDEO,SOURCE,TRACK,HR}`; `MAX_HTML_BYTES = 256 * 1024`; `UNSAFE_URL_PROTOCOLS` = `/^(javascript|data:text\/html|vbscript):/i`. Expected state after: constants defined, referenced nowhere yet.
3. Add new helper `sanitizeFragment(root)` — walks the fragment (pre-order, `TreeWalker` over `NodeFilter.SHOW_ELEMENT`). For each element: (a) if `tagName` not in `ALLOWED_HTML_TAGS` → `element.remove()`, push warning to local log; (b) iterate its attributes in reverse — remove if matches `BLOCKED_ATTR_NAMES` OR `UNSAFE_ATTR_NAME` (on*) OR name not matching `VALID_ATTR_NAME`; (c) if attr is `href|src|xlink:href|action|formaction|poster|background` — test value against `UNSAFE_URL_PROTOCOLS`, remove on match; (d) also strip `srcdoc` attribute wholesale. Returns `{ removedTags, removedAttrs }` for diagnostics. Expected state after: helper exists, no call sites yet.
4. Modify `parseSingleRoot(html)` — before `document.importNode`, enforce: `if (typeof html !== 'string' || html.length > MAX_HTML_BYTES) return null;`. Then after parse but before `importNode`, call `sanitizeFragment(elements[0])`. Keep the single-root invariant (return `null` on 0 or >1 children). Expected state after: sanitization applied in hot path for all three consumers without changing their call signatures.
5. Emit a bridge runtime-log when sanitize drops nodes: `if (removedTags + removedAttrs > 0) post('runtime-log', { message: 'sanitize: removed ' + removedTags + ' tags, ' + removedAttrs + ' attrs', source: 'parseSingleRoot' });`. Expected state after: non-blocking visibility into sanitizer action, consumed by existing `runtime-log` handler at `bridge.js:74–76`.
6. Confirm inline-style preservation: `style` attribute is NOT on `BLOCKED_ATTR_NAMES` and passes `VALID_ATTR_NAME` — it stays, matching existing `updateAttributes` behavior. Reference decks use inline styles extensively. Expected state after: quick grep `style=` in `references_pres/html-presentation-examples_v3/` confirms preservation path.
7. Write `tests/playwright/bridge-sanitize.spec.js` covering five scenarios: (a) `replace-node-html` with `<p onclick="x">hi</p>` — committed DOM has NO `onclick`; (b) `<script>alert(1)</script>` inside replacement — `<script>` absent post-commit; (c) `<a href="javascript:void(0)">` — href stripped; (d) payload > 256 KB — call is rejected (no DOM change, no throw); (e) payload is legitimate `<figure><figcaption>ok</figcaption></figure>` — commits normally. Use Playwright's message injection pattern (mirror `tests/playwright/editor.regression.spec.js` dialog handling). Expected state after: all 5 scenarios pass locally.
8. Run `npm run test:gate-a` from a clean `main` branch — must be 55/5/0 (pre-change baseline). Re-run after changes — must still be 55/5/0. Expected state after: Gate-A invariant preserved.
9. Regression load test: open `references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html` and `selectios_pitch_v2_final.html` through the editor; select any element, save, reload. Expected state after: both decks load clean; no sanitizer warnings beyond a documented baseline (expected zero; record actual in commit body).
10. Update `docs/CHANGELOG.md` section `## Unreleased` → add `### Security` bullet: `parseSingleRoot sanitizes tag/attr/url/size in replace-node-html and replace-slide-html (AUDIT-D-02, P0-02).` Expected state after: changelog carries the entry; version bump reserved for integration agent.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open a deck from file system)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer) — N/A here
- [ ] Russian UI-copy strings preserved (not translated to English) — N/A (no UI copy added)
- [ ] Reference decks `v3-prepodovai-pitch` + `v3-selectios-pitch` still load, select, and export clean
- [ ] Deck-script-engine path NOT blanket-stripped at import — sanitize only applies inside `parseSingleRoot` for bridge-originated replacement HTML; `buildModelDocument` remains unchanged
- [ ] `ALLOWED_HTML_TAGS` includes `svg,g,path,text` — reference deck SVG paths survive
- [ ] `style` attribute preserved (reference decks are inline-style heavy)
- [ ] No new external network calls introduced

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `tests/playwright/bridge-sanitize.spec.js` passes all 5 scenarios on chromium-desktop
- [ ] Gate-A remains 55/5/0 (`npm run test:gate-a`)
- [ ] Manually verified: pasting `<div onerror="alert(1)">x</div>` via `replace-node-html` results in committed DOM without `onerror`
- [ ] Manually verified: pasting `<p>ok</p>` preserves the `<p>` tag and its text
- [ ] Sanitizer rejects payload > 262144 bytes (via `parseSingleRoot` returning `null`)
- [ ] Reference deck regression: `v3-prepodovai-pitch` + `v3-selectios-pitch` load + select + `export→import` round-trip with zero new warnings in diagnostics drawer
- [ ] `runtime-log` message format is `'sanitize: removed N tags, M attrs'` (grep-able for telemetry)
- [ ] Commit message in conventional-commits format: `fix(security): sanitize parseSingleRoot tag/attr/url — v0.26.1 WO-01`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| `onclick` stripped on `replace-node-html` | gate-a | `tests/playwright/bridge-sanitize.spec.js` | N/A | pass |
| `<script>` stripped on `replace-slide-html` | gate-a | `tests/playwright/bridge-sanitize.spec.js` | N/A | pass |
| `javascript:` href stripped | gate-a | `tests/playwright/bridge-sanitize.spec.js` | N/A | pass |
| payload > 256 KB rejected (returns null) | gate-a | `tests/playwright/bridge-sanitize.spec.js` | N/A | pass |
| legitimate `<figure>` commits normally | gate-a | `tests/playwright/bridge-sanitize.spec.js` | N/A | pass |
| gate-a baseline 55/5/0 | gate-a | `tests/playwright/editor.regression.spec.js` | pass (55/5/0) | pass (55/5/0) |
| reference deck load `v3-prepodovai-pitch` | gate-b | `tests/playwright/reference-pres-parity.spec.js` | pass | pass |
| reference deck load `v3-selectios-pitch` | gate-b | `tests/playwright/reference-pres-parity.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** `ALLOWED_HTML_TAGS` is too narrow and strips a tag the reference decks use in a `replace-node-html` round-trip (e.g., `<details>`, `<summary>`, `<dialog>`).
- **Mitigation:** Grep reference deck HTML for `<tagname` occurrences before coding (`grep -oE '<[a-z][a-z0-9]*' references_pres/html-presentation-examples_v3/*.html | sort -u`); extend the list only if the tag is already in use. If a tag must be added post-merge, follow-up WO extends the constant — no shell change needed.
- **Risk:** Unexpected false-positive on inline SVG (e.g., `<use xlink:href="#foo"/>` stripped because `xlink:href` treated as URL).
- **Mitigation:** `UNSAFE_URL_PROTOCOLS` only matches `javascript:/vbscript:/data:text/html:` prefixes — relative `#foo` passes. Explicit test case in sub-task 7 adds `<use xlink:href="#id"/>` assertion.
- **Risk:** Sanitizer walks node tree during hot path — O(n) cost added per replace call.
- **Mitigation:** `parseSingleRoot` is already parsing + importing; the walk adds ≤0.5 ms on trees up to 1 k nodes (AUDIT-C perf envelope). Document expected budget in commit body.
- **Rollback:** `git revert <sha>` — single focused commit; tests co-located; zero infra impact.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:security-auditor
isolation: worktree
branch_prefix: claude/wo-01-parse-single-root-sanitize
```

````markdown
You are implementing Step 01 (v0.26.1 parseSingleRoot sanitize) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-01-parse-single-root-sanitize   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-012 (docs/ADR-012-bridge-protocol-v2.md) §7 sanitization spec
  3. Read AUDIT-D-security.md finding AUDIT-D-02 (full section)
  4. Read bridge-script.js lines 60–70 (existing BLOCKED_ATTR_NAMES etc.)
  5. Read bridge-script.js lines 2330–2345 (current parseSingleRoot)
  6. Read bridge-script.js lines 3370–3405 (call sites)
  7. Read bridge-script.js lines 2750–2800 (updateAttributes — prior art)
  8. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/bridge-script.js  (edit: introduce ALLOWED_HTML_TAGS, MAX_HTML_BYTES, UNSAFE_URL_PROTOCOLS, sanitizeFragment; modify parseSingleRoot)
  - tests/playwright/bridge-sanitize.spec.js  (new)
  - docs/CHANGELOG.md  (append Unreleased note)

FILES READ-ONLY (reference only):
  - editor/src/bridge.js
  - editor/src/bridge-commands.js
  - docs/ADR-012-bridge-protocol-v2.md
  - docs/audit/AUDIT-D-security.md
  - references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html
  - references_pres/html-presentation-examples_v3/selectios_pitch_v2_final.html

SUB-TASKS:
  1. Define ALLOWED_HTML_TAGS, MAX_HTML_BYTES=262144, UNSAFE_URL_PROTOCOLS regex
  2. Add sanitizeFragment(root) helper walking elements (TreeWalker)
  3. Modify parseSingleRoot: length-guard first, sanitize after parse, before importNode
  4. Emit post('runtime-log', ...) when sanitizer drops tags or attrs
  5. Write bridge-sanitize.spec.js with 5 cases (onclick, <script>, javascript:, oversize, legit)
  6. Run reference-deck regression on v3-prepodovai-pitch + v3-selectios-pitch
  7. Update docs/CHANGELOG.md under "## Unreleased" "### Security"

INVARIANTS (NEVER violate):
  - No type="module" on any <script>
  - No bundler / build step added
  - Gate-A 55/5/0 must hold before merge
  - file:// workflow still works
  - Russian UI copy preserved where present
  - Reference decks v3-prepodovai-pitch + v3-selectios-pitch still load + select + export
  - Deck-script-engine path (buildModelDocument) NOT blanket-stripped — sanitize ONLY in parseSingleRoot
  - ALLOWED_HTML_TAGS includes svg,g,path,text
  - Inline style attribute preserved
  - No new external network calls

ACCEPTANCE:
  - bridge-sanitize.spec.js: 5/5 pass on chromium-desktop
  - Gate-A remains 55/5/0
  - onclick/script/javascript: stripped in commit via replace-node-html
  - Legitimate <figure> passes through intact
  - Payload > 256 KB rejected
  - Reference deck regression zero new warnings
  - Conventional commit: fix(security): sanitize parseSingleRoot tag/attr/url — v0.26.1 WO-01

ON COMPLETION:
  1. Run the full acceptance matrix
  2. git add editor/src/bridge-script.js tests/playwright/bridge-sanitize.spec.js docs/CHANGELOG.md
  3. Conventional commit per above
  4. Report back: files changed, LOC delta, gate results, and whether any reference-deck tag was added to ALLOWED_HTML_TAGS during regression
````

### Rollback plan

If merge breaks main: `git revert <sha>`; the change is single-commit, additive, and local to one function — no state migration or downstream rewiring needed. Re-plan with narrower tag set and re-run regression; NO fix-forward under pressure.
