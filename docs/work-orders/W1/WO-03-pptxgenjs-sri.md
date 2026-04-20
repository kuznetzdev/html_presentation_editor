## Step 03 — v0.26.1 · Pin pptxgenjs + SRI hash (or vendor under `editor/vendor/`)

**Window:** W1   **Agent-lane:** C (Security · supply-chain)   **Effort:** S
**ADR:** —   **PAIN-MAP:** P0-03
**Depends on:** none (runs in parallel with WO-01, WO-02, WO-04, WO-05)   **Unblocks:** future ADR-015 "no-bundler + no unpinned CDN" invariant post

### Context (3–5 lines)

Per AUDIT-D-03 (Medium-High), PPTX export (`export.js:271–275`) loads `pptxgenjs` from `https://cdn.jsdelivr.net/npm/pptxgenjs/dist/pptxgen.bundled.js` with **no version pin and no Subresource Integrity (SRI) hash** — a supply-chain compromise substitutes arbitrary JS running in the editor's origin, which has same-origin access to `sessionStorage` and model state. Two remediation paths: (A) pin version + SRI + crossorigin; (B) vendor under `editor/vendor/` (preferred — eliminates the network fetch entirely, consistent with "zero dependencies runtime" invariant). This WO chooses (B) as default and keeps (A) wired behind a constant for operators who prefer CDN.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/export.js` | edit | +40 / −8 |
| `editor/vendor/pptxgenjs/pptxgen.bundled.min.js` | new (vendored) | ~700 KB binary — one file |
| `editor/vendor/pptxgenjs/README.md` | new | +40 / −0 |
| `editor/vendor/pptxgenjs/LICENSE` | new (copy upstream MIT) | +20 / −0 |
| `tests/playwright/export-sri.spec.js` | new | +70 / −0 |
| `docs/CHANGELOG.md` | edit | +3 / −0 |
| `.gitattributes` | edit if vendor blob triggers LFS/line-ending issues | +2 / −0 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/export.js:266–285` | current loader; replace load path |
| `editor/presentation-editor.html` | confirm no `<script src="...pptx...">` elsewhere |
| `docs/ADR-015-module-bundling-decision.md` | zero-build invariant context |
| `docs/audit/AUDIT-D-security.md` §AUDIT-D-03 | remediation details |
| `package.json` | confirm pptxgenjs is NOT a runtime dep (dev-only if present); version to vendor |

### Sub-tasks (executable, each ≤ 2 h)

1. Confirm upstream version: open `https://www.jsdelivr.com/package/npm/pptxgenjs` in a note, record the exact version (e.g., `3.12.0`) chosen. Compute SRI hash: `openssl dgst -sha384 -binary pptxgen.bundled.js | openssl base64 -A` — record `sha384-<hash>`. Expected state after: pinned version string + SRI recorded in the commit body.
2. Download the upstream minified bundle: `curl -o editor/vendor/pptxgenjs/pptxgen.bundled.min.js https://cdn.jsdelivr.net/npm/pptxgenjs@<VERSION>/dist/pptxgen.bundled.min.js` (NOT the non-min `pptxgen.bundled.js` — keep the bundle size tight). Create `editor/vendor/pptxgenjs/` directory first. Expected state after: vendor file present, ~700 KB, single file.
3. Write `editor/vendor/pptxgenjs/README.md` documenting: upstream URL, version pinned (`3.12.0`), SRI hash, upstream license file link, date of vendor, why vendored (AUDIT-D-03, P0-03), how to upgrade. Follow ADR-015 style if any similar vendored artifact exists. Expected state after: README meets the "every vendored JS must have README.md with version pin and upstream source" invariant.
4. Copy upstream `LICENSE` (MIT) into `editor/vendor/pptxgenjs/LICENSE`. Expected state after: license co-located with the binary per licensing hygiene.
5. In `editor/src/export.js` lines 271–284: replace the `const PPTX_CDN = "..."` + `pptxLoadScript(PPTX_CDN)` path with a local-first loader. New constants:
   ```
   const PPTX_VENDOR_PATH = "editor/vendor/pptxgenjs/pptxgen.bundled.min.js";
   const PPTX_CDN_URL = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundled.min.js";
   const PPTX_SRI = "sha384-<hash-from-step-1>";
   const PPTX_USE_VENDOR = true;
   ```
   New load path: `if (PPTX_USE_VENDOR) await pptxLoadScript(PPTX_VENDOR_PATH); else await pptxLoadScriptWithSRI(PPTX_CDN_URL, PPTX_SRI);`. Expected state after: default export path loads from vendor, no network access required.
6. Extend `pptxLoadScript` OR add sibling `pptxLoadScriptWithSRI(url, sri)` that builds `<script src integrity crossorigin="anonymous">` with the pinned SRI. Resolves on `load`, rejects on `error`. If the `useVendor` branch is taken the function name stays simple; the SRI variant is opt-in. Expected state after: CDN fallback still available but not default, preserves supply-chain guarantee when it runs.
7. Run `grep -n "pptxgen" editor/src/*.js` to confirm no other call site bypasses the new loader. Expected state after: the `PPTX_CDN` literal exists only inside `export.js`, only in the opt-in CDN branch.
8. Write `tests/playwright/export-sri.spec.js`: (a) PPTX export succeeds when `PPTX_USE_VENDOR = true`, without any network request (use Playwright `page.route('**/*', route => ...)` or `page.on('request')` to assert no `cdn.jsdelivr.net` request fired during export); (b) when toggled to CDN, the `<script>` tag added to the DOM has `integrity="sha384-..."` and `crossorigin="anonymous"` (inspect via `page.evaluate`). Expected state after: both branches test-covered.
9. Gate-A: `npm run test:gate-a` must be 55/5/0. Plus: run any existing export spec (`tests/playwright/export-pptx.spec.js` if present) — confirm still green. Expected state after: no regression in existing export gates.
10. If the 700 KB vendor blob triggers `.gitattributes` concerns (binary vs text, CRLF): add `editor/vendor/pptxgenjs/*.js binary` to `.gitattributes`. Expected state after: git stores the file consistently across platforms.
11. Update `docs/CHANGELOG.md` `## Unreleased` → `### Security`: `pptxgenjs vendored under editor/vendor/pptxgenjs/ with SRI metadata (AUDIT-D-03, P0-03). CDN branch retained as opt-in PPTX_USE_VENDOR=false with pinned integrity hash.` Expected state after: changelog entry present.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open a deck from file system, export PPTX)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer) — N/A
- [ ] Russian UI-copy strings preserved (not translated to English) — toast copy `"Загрузка PptxGenJS…"` stays Russian if retained; consider updating to `"Подготовка экспорта…"` since load is now local (optional, stays Russian)
- [ ] Vendored JS lives under `editor/vendor/pptxgenjs/` with `README.md` explaining version pin and upstream source
- [ ] No NEW external network calls added (and default path REMOVES the jsDelivr call)
- [ ] CDN branch retains SRI hash if operator toggles `PPTX_USE_VENDOR = false`

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `tests/playwright/export-sri.spec.js` case (a) passes: PPTX export completes with zero external HTTP requests during the export window
- [ ] Case (b) passes: toggling to CDN path, `<script>` tag carries `integrity="sha384-..."` and `crossorigin="anonymous"`
- [ ] `editor/vendor/pptxgenjs/pptxgen.bundled.min.js` size is ≈ 650–750 KB (sanity check — wrong file otherwise)
- [ ] `editor/vendor/pptxgenjs/README.md` documents version, upstream URL, SRI hash, upgrade procedure
- [ ] `editor/vendor/pptxgenjs/LICENSE` present, verbatim from upstream
- [ ] Gate-A remains 55/5/0 (`npm run test:gate-a`)
- [ ] Manual smoke: open deck under file://, Export PPTX menu → file saves, opens cleanly in PowerPoint/LibreOffice
- [ ] Commit message in conventional-commits format: `fix(security): vendor pptxgenjs with SRI + pin — v0.26.1 WO-03`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Export PPTX, no jsdelivr.net request | gate-a | `tests/playwright/export-sri.spec.js` | N/A | pass |
| CDN branch sets integrity + crossorigin | gate-a | `tests/playwright/export-sri.spec.js` | N/A | pass |
| Gate-A baseline 55/5/0 | gate-a | `tests/playwright/editor.regression.spec.js` | pass | pass |
| PPTX export e2e | gate-b | `tests/playwright/export-pptx.spec.js` (if present) | pass | pass |

### Risk & mitigation

- **Risk:** Vendored file is the wrong version or corrupt — PPTX export starts to produce malformed files silently.
- **Mitigation:** SRI hash is recorded in README and constants; a periodic script can verify the on-disk hash matches. Sub-task 8 covers a PPTX export smoke, sub-task 9 covers e2e.
- **Risk:** Future upgrades forget to re-record the hash, drifting the invariant.
- **Mitigation:** README lists "Upgrade procedure" explicitly (download → compute hash → update constant → update README). Acceptance criterion verifies README presence.
- **Risk:** 700 KB vendor blob inflates git clone time / LFS quota on hosted CI.
- **Mitigation:** Acceptable per AUDIT-D-03 note ("~700 KB, consistent with zero-deps-runtime"). No LFS required at this size. `.gitattributes` line prevents line-ending thrash.
- **Risk:** `editor/vendor/pptxgenjs/` is relative-path-resolved, and the editor runs both from `file://editor/presentation-editor.html` and `http://localhost:<port>/editor/presentation-editor.html` — the script path must resolve correctly in both.
- **Mitigation:** Use the same relative path resolution other classic scripts use; verify by the manual file:// smoke.
- **Rollback:** `git revert <sha>`. Vendor file blob is an isolated addition; constant toggle allows fast operator override back to CDN (with SRI) without reverting if needed.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:security-auditor
isolation: worktree
branch_prefix: claude/wo-03-pptxgenjs-sri
```

````markdown
You are implementing Step 03 (v0.26.1 vendor pptxgenjs with SRI) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-03-pptxgenjs-sri   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read docs/ADR-015-module-bundling-decision.md (zero-build invariant)
  3. Read AUDIT-D-security.md finding AUDIT-D-03 (full section)
  4. Read editor/src/export.js lines 260–290
  5. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/export.js  (replace CDN loader with vendor-first path)
  - editor/vendor/pptxgenjs/pptxgen.bundled.min.js  (new ~700 KB, download from pinned jsDelivr URL)
  - editor/vendor/pptxgenjs/README.md  (new, documents version + SRI + upgrade proc)
  - editor/vendor/pptxgenjs/LICENSE  (new, verbatim upstream MIT)
  - tests/playwright/export-sri.spec.js  (new)
  - .gitattributes  (add editor/vendor/pptxgenjs/*.js binary line if needed)
  - docs/CHANGELOG.md  (Unreleased entry)

FILES READ-ONLY (reference only):
  - editor/presentation-editor.html  (confirm no other pptx loader)
  - package.json

SUB-TASKS:
  1. Pin version (record e.g. 3.12.0), compute SRI sha384
  2. Download pinned pptxgen.bundled.min.js into editor/vendor/pptxgenjs/
  3. Author vendor/README.md (version, upstream URL, SRI, upgrade steps)
  4. Copy upstream LICENSE
  5. Refactor export.js: PPTX_VENDOR_PATH (default) + PPTX_CDN_URL + PPTX_SRI (opt-in)
  6. Extend or add pptxLoadScriptWithSRI(url, sri) with integrity+crossorigin attrs
  7. Confirm grep of pptxgen shows only the intended locations
  8. Write export-sri.spec.js (vendor path no-network; CDN path has integrity/crossorigin)
  9. Gate-A 55/5/0 and existing export spec (if any) still green
  10. Manual file:// smoke: export PPTX from prepodovai_pitch_v2.html and open in viewer
  11. CHANGELOG Unreleased entry

INVARIANTS (NEVER violate):
  - No type="module" on any <script>
  - No bundler dependency added
  - Gate-A 55/5/0 must hold
  - file:// workflow still works (vendor path resolves under file://)
  - Vendored JS has README.md + LICENSE with version pin and upstream source
  - NO new external network calls (default path removes jsDelivr fetch)
  - CDN branch retains SRI if operator toggles vendor=false

ACCEPTANCE:
  - export-sri.spec.js: vendor path no-network ok; CDN path has integrity+crossorigin
  - Vendor file size in 650–750 KB range
  - README documents version, SRI, upgrade
  - Manual PPTX export file opens cleanly
  - Gate-A remains 55/5/0
  - Conventional commit: fix(security): vendor pptxgenjs with SRI + pin — v0.26.1 WO-03

ON COMPLETION:
  1. Run the full acceptance matrix
  2. git add editor/src/export.js editor/vendor/pptxgenjs/ tests/playwright/export-sri.spec.js .gitattributes docs/CHANGELOG.md
  3. Conventional commit per above
  4. Report back: files changed (include vendor binary size), LOC delta, gate results, pinned version, SRI hash prefix (first 12 chars only for brevity)
````

### Rollback plan

If merge breaks main: `git revert <sha>` — vendor file is an isolated addition; constant `PPTX_USE_VENDOR` allows operator override without revert. If revert needed, it cleanly restores prior CDN call path.
