## Step 35 — v0.32.0 · Plugin L1 — externalize `KNOWN_ENTITY_KINDS` / `CANONICAL_ENTITY_KINDS` to shared `constants.js` / `entity-kinds.js`

**Window:** W7   **Agent-lane:** D (Architecture)   **Effort:** M
**ADR:** ADR-016   **PAIN-MAP:** P2-05
**Depends on:** WO-13 (bridge v2 schema validation — schemas reference canonical kinds), WO-14 (types bootstrap — JSDoc `@typedef EntityKind` benefits from single source)   **Unblocks:** WO-38 (RC freeze — ADR-016 Status: Accepted required)

### Context (3–5 lines)

Per PAIN-MAP P2-05 + ADR-016 Layer 1: `KNOWN_ENTITY_KINDS` is hard-coded in `editor/src/bridge-script.js:30` as `new Set(['text','image','video','container','element','slide-root','protected','table','table-cell','code-block','svg','fragment'])` and `CANONICAL_ENTITY_KINDS` is hard-coded in `editor/src/bridge-commands.js:178–192` as the same 12 kinds + `'none'`. Two sources, one truth. A future kind addition (e.g., `'callout'`, `'chart'`) requires 2 edits and silent drift is possible. This WO externalizes the registry into a declarative table `editor/src/entity-kinds.js` per ADR-016 §Layer 1 and injects the canonical set into bridge-script via the existing template-string interpolation path used by `editor/src/preview.js` / iframe-bootstrap. **Layer 2 (external plugin protocol) is explicitly NOT implemented — deferred per ADR-016.**

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/entity-kinds.js` | new | +110 / −0 |
| `editor/src/bridge-script.js` | edit (replace hard-coded `KNOWN_ENTITY_KINDS` with template-interpolated constant) | +6 / −1 |
| `editor/src/bridge-commands.js` | edit (replace hard-coded `CANONICAL_ENTITY_KINDS` with import from registry) | +4 / −16 |
| `editor/src/constants.js` | edit (re-export `ENTITY_KINDS_CANONICAL` alongside existing `IMPORT_ENTITY_KINDS`) | +6 / −0 |
| `editor/src/preview.js` OR `editor/src/boot.js` | edit (inject kinds into bridge-script template at iframe-bootstrap time) | +8 / −0 |
| `editor/presentation-editor.html` | edit (add `<script src="editor/src/entity-kinds.js"></script>` BEFORE constants.js) | +1 / −0 |
| `tests/playwright/specs/entity-kinds-registry.spec.js` | new | +140 / −0 |
| `docs/CHANGELOG.md` | edit (append) | +8 / −0 |
| `docs/ADR-016-plugin-extension-architecture.md` | edit (Status → Accepted for Layer 1; Layer 2 remains Deferred) | +4 / −2 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `docs/ADR-016-plugin-extension-architecture.md` §"Layer 1" | exact registry shape (rows: id / matches / label / icon / inspectorSections / contextMenu / dragResize) |
| `editor/src/bridge-script.js` lines 28–30 | current `KNOWN_ENTITY_KINDS` + `EXCLUDED` definition |
| `editor/src/bridge-script.js` line 210 | consumer `KNOWN_ENTITY_KINDS.has(kind)` |
| `editor/src/bridge-commands.js` lines 178–198 | current `CANONICAL_ENTITY_KINDS` + `readCanonicalEntityKind()` |
| `editor/src/constants.js` lines 49–63 | existing `IMPORT_ENTITY_KINDS` — matches same 12 kinds + extras — ground truth |
| `editor/src/preview.js` | iframe-bootstrap path where bridge-script template is injected |
| `editor/src/boot.js` | init order — `entity-kinds.js` must load before `bridge-commands.js` consumes it |
| `docs/audit/PAIN-MAP.md` line 78 (P2-05) | problem statement |
| `docs/audit/AUDIT-A-architecture.md` §"duplicated KNOWN_ENTITY_KINDS" | motivation |

### Sub-tasks (executable, each ≤ 2 h)

1. Read all three definition sites: `bridge-script.js:30`, `bridge-commands.js:178–192`, `constants.js:49–63`. Confirm the canonical set matches ADR-016 intent: the 12 "real" entity kinds that appear in the UI + `'none'`. Record any drift in a scratchpad — there should be zero. Expected state after: single authoritative list of 13 kinds: `text, image, video, container, element, slide-root, protected, table, table-cell, code-block, svg, fragment, none`.
2. Create `editor/src/entity-kinds.js`. Shape (classic `<script src>`, no module):
   ```javascript
   // entity-kinds.js
   // Layer: Data Registry (ADR-016 Layer 1)
   // Single source of truth for all editor entity kinds.
   // Consumed by: constants.js, bridge-script.js (via template interpolation),
   //             bridge-commands.js, selection.js, inspector-sync.js.

   (function () {
     const ENTITY_KINDS = Object.freeze([
       Object.freeze({ id: "text",        label: "Текст",         inspectorSections: ["typography","color","alignment"] }),
       Object.freeze({ id: "image",       label: "Изображение",   inspectorSections: ["geometry","src"] }),
       Object.freeze({ id: "video",       label: "Видео",         inspectorSections: ["geometry","src"] }),
       Object.freeze({ id: "container",   label: "Контейнер",     inspectorSections: ["geometry","background"] }),
       Object.freeze({ id: "element",     label: "Элемент",       inspectorSections: ["geometry"] }),
       Object.freeze({ id: "slide-root",  label: "Слайд",         inspectorSections: ["background"] }),
       Object.freeze({ id: "protected",   label: "Защищённый",    inspectorSections: [] }),
       Object.freeze({ id: "table",       label: "Таблица",       inspectorSections: ["geometry"] }),
       Object.freeze({ id: "table-cell",  label: "Ячейка",        inspectorSections: ["typography","color"] }),
       Object.freeze({ id: "code-block",  label: "Код",           inspectorSections: [] }),
       Object.freeze({ id: "svg",         label: "SVG",           inspectorSections: ["geometry"] }),
       Object.freeze({ id: "fragment",    label: "Фрагмент",      inspectorSections: [] }),
       Object.freeze({ id: "none",        label: "—",             inspectorSections: [] })
     ]);

     const ENTITY_KINDS_CANONICAL = Object.freeze(new Set(ENTITY_KINDS.map(k => k.id)));
     // 'none' is canonical but NOT a real runtime kind seen in bridge payloads;
     // KNOWN_ENTITY_KINDS (bridge-side) uses the 12 non-'none' entries:
     const ENTITY_KINDS_KNOWN = Object.freeze(new Set(ENTITY_KINDS.filter(k => k.id !== "none").map(k => k.id)));

     window.ENTITY_KINDS = ENTITY_KINDS;
     window.ENTITY_KINDS_CANONICAL = ENTITY_KINDS_CANONICAL;
     window.ENTITY_KINDS_KNOWN = ENTITY_KINDS_KNOWN;
   })();
   ```
   Inspector-section fields are informational — not load-bearing in this WO. They establish the structure for future work (Layer 2, ADR-016 §"Applied In"). Expected state after: file exists, window globals exposed.
3. Edit `editor/presentation-editor.html` — add `<script src="editor/src/entity-kinds.js"></script>` BEFORE `<script src="editor/src/constants.js"></script>`. Grep for existing script order; insert between CSS/metadata block and constants. Expected state after: load order deterministic: entity-kinds → constants → rest.
4. Edit `editor/src/constants.js` — after existing `IMPORT_ENTITY_KINDS` block (line ~64), add:
   ```javascript
   // ENTITY_KINDS_CANONICAL — alias for external consumers (bridge-commands, inspector).
   // Source: window.ENTITY_KINDS (from entity-kinds.js). See ADR-016.
   ```
   Do NOT re-declare — document the alias only. Consumers reference `ENTITY_KINDS_CANONICAL` via window global (classic-script, shared global scope). Expected state after: no duplication; comment explains the reference chain.
5. Edit `editor/src/bridge-commands.js:178–192` — delete the hard-coded `CANONICAL_ENTITY_KINDS` declaration. Replace line 178 with a single line: `const CANONICAL_ENTITY_KINDS = window.ENTITY_KINDS_CANONICAL;`. Keep `readCanonicalEntityKind` unchanged — only the source changes. Expected state after: file loses 14 LOC of enum, gains 1 LOC of reference; bridge-commands.js behavior identical.
6. Locate the iframe bridge-script template injection path. Read `editor/src/preview.js` and/or the section of `boot.js` that composes the iframe srcdoc. The bridge-script.js file is loaded by iframe; `KNOWN_ENTITY_KINDS` is defined in the bridge-script template string. Strategy: inject the canonical set as a template placeholder. Concretely:
   - If bridge-script.js is injected as `srcdoc` with `.replace()` template expansion, add a placeholder line near the top of `bridge-script.js` like `const KNOWN_ENTITY_KINDS = new Set(/* BRIDGE_TEMPLATE_ENTITY_KINDS */ ['text','image','video','container','element','slide-root','protected','table','table-cell','code-block','svg','fragment']);`.
   - In the injection site, replace the comment marker with a JSON-serialized array from `Array.from(window.ENTITY_KINDS_KNOWN).map(k => "'"+k+"'").join(',')`.
   - If injection is via `<script src>` (not srcdoc), pass the kinds via a pre-script `<script>window.__KNOWN_ENTITY_KINDS = [...];</script>` and have bridge-script use `const KNOWN_ENTITY_KINDS = new Set(window.__KNOWN_ENTITY_KINDS || [...fallback...])`.
   Inspect the actual injection path and pick the ergonomic one. Record choice in commit body. Expected state after: bridge-script.js line 30 is no longer a literal hard-coded Set — it receives the list from the shell via the injection contract. The fallback (hard-coded default) STAYS as a defensive default in case injection ever fails — log a `runtime-log` warn on fallback use.
7. Add a `runtime-log` emit in bridge-script.js if the fallback is used: `if (!window.__KNOWN_ENTITY_KINDS) { post('runtime-log', { message: 'entity-kinds: using fallback (shell injection missing)', source: 'bridge-script.init', level: 'warn' }); }`. Expected state after: silent drift becomes visible in telemetry/diagnostics.
8. Create `tests/playwright/specs/entity-kinds-registry.spec.js` with 5 tests:
   - EKR1: shell globals exposed — `window.ENTITY_KINDS` is an array of 13 entries, each frozen, with `id` in canonical set.
   - EKR2: `window.ENTITY_KINDS_CANONICAL.has('text')` true; `.has('callout')` false.
   - EKR3: `window.ENTITY_KINDS_KNOWN.size === 12` (excludes `'none'`).
   - EKR4: iframe-side `KNOWN_ENTITY_KINDS` equals shell-side `ENTITY_KINDS_KNOWN` — evaluate inside iframe via `page.frame({url: /preview/}).evaluate(() => Array.from(KNOWN_ENTITY_KINDS))` and compare to shell.
   - EKR5: end-to-end regression — open reference deck `v3-prepodovai-pitch`, select each element kind (text/image/container), confirm inspector labels match the new `label:` Russian strings (`Текст`, `Изображение`, `Контейнер`).
   Expected state after: 5 tests pass locally.
9. Run full gate matrix:
   - `npm run test:gate-a` → 55/5/0 (invariant)
   - `npm run test:gate-b` → pass (regression, entity-kinds-registry.spec.js added to Gate-B)
   - Edit `package.json` `"test:gate-b"` argument list: prepend `tests/playwright/specs/entity-kinds-registry.spec.js` to chromium-desktop section.
   Expected state after: Gate-B covers registry; Gate-A unchanged.
10. Regression against reference decks: manually open `v3-prepodovai-pitch` and `v3-selectios-pitch`, perform select → edit → export on at least 3 elements of different kinds. Diff the exported HTML against a pre-change baseline — should be byte-identical modulo any known editor-attribute noise. Expected state after: no behavior regression.
11. Update `docs/CHANGELOG.md` under `## Unreleased` → `### Refactored`: `Entity-kind registry externalized into editor/src/entity-kinds.js (ADR-016 Layer 1, P2-05). Shell + iframe bridge now share a single source of truth for 12 kinds. Layer 2 (external plugin protocol) remains deferred post-1.0. (WO-35)`. Expected state after: CHANGELOG reflects refactor.
12. Mark ADR-016 Status. Edit line 3: `**Status**: Proposed (deferred design — implementation post-v1.0)` → `**Status**: Layer 1 Accepted · Layer 2 Deferred`. Append: `**Accepted in**: v0.32.0 via WO-35 (Layer 1 only).` Expected state after: ADR status reflects split-accept.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag (new `entity-kinds.js` uses classic IIFE)
- [ ] No bundler dependency added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open any reference deck from file system)
- [ ] NO new `@layer` added to `tokens.css` — data-only WO, no CSS
- [ ] Russian UI-copy in registry labels (`Текст`, `Изображение`, `Видео`, `Контейнер`, `Элемент`, `Слайд`, `Защищённый`, `Таблица`, `Ячейка`, `Код`, `SVG`, `Фрагмент`) preserved VERBATIM
- [ ] **Layer 2 NOT implemented** — NO plugin-loading code, NO `registerPlugin` API, NO `editor/plugins/` directory populated
- [ ] Script load order in `presentation-editor.html`: `entity-kinds.js` BEFORE `constants.js` BEFORE `bridge-commands.js`
- [ ] Bridge-script fallback path present (defensive default if injection missing)
- [ ] Single source of 12 kinds — `grep "'text','image','video','container'"` returns ≤ 1 meaningful match (the fallback); canonical list lives only in `entity-kinds.js`
- [ ] Reference decks `v3-prepodovai-pitch` + `v3-selectios-pitch` load + select + export with no behavior change

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `editor/src/entity-kinds.js` exists with exactly 13 entries, all frozen
- [ ] `window.ENTITY_KINDS_KNOWN.size === 12` (no `'none'`)
- [ ] `window.ENTITY_KINDS_CANONICAL.size === 13` (with `'none'`)
- [ ] `bridge-commands.js` `CANONICAL_ENTITY_KINDS` is NOT a hard-coded literal — it references `window.ENTITY_KINDS_CANONICAL`
- [ ] `bridge-script.js` `KNOWN_ENTITY_KINDS` receives the list via template-injection or global window (not literal, but keeps a defensive fallback with explicit warning emit)
- [ ] `tests/playwright/specs/entity-kinds-registry.spec.js` has 5 tests; all 5 pass
- [ ] `npm run test:gate-a` remains 55 / 5 / 0
- [ ] `npm run test:gate-b` passes with entity-kinds-registry spec added
- [ ] Reference deck regression — `v3-prepodovai-pitch` + `v3-selectios-pitch` — select + export round-trip unchanged
- [ ] `grep -rn "'text','image','video','container','element','slide-root','protected','table','table-cell','code-block','svg','fragment'" editor/src/` returns only `entity-kinds.js` and the `bridge-script.js` fallback comment
- [ ] ADR-016 `Status: Layer 1 Accepted · Layer 2 Deferred` + `Accepted in: v0.32.0 via WO-35` present
- [ ] Commit message in conventional-commits format: `refactor(entities): externalize entity-kind registry (ADR-016 L1, P2-05) — v0.32.0 WO-35`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| EKR1 shell globals shape | gate-b | `tests/playwright/specs/entity-kinds-registry.spec.js` | N/A | pass |
| EKR2 CANONICAL.has('text') true | gate-b | `tests/playwright/specs/entity-kinds-registry.spec.js` | N/A | pass |
| EKR3 KNOWN size = 12 | gate-b | `tests/playwright/specs/entity-kinds-registry.spec.js` | N/A | pass |
| EKR4 iframe KNOWN = shell KNOWN | gate-b | `tests/playwright/specs/entity-kinds-registry.spec.js` | N/A | pass |
| EKR5 reference deck labels Russian | gate-b | `tests/playwright/specs/entity-kinds-registry.spec.js` | N/A | pass |
| gate-a baseline unaffected | gate-a | all four gate-a specs | 55/5/0 | 55/5/0 |
| reference deck round-trip | manual (gate-e asset-parity nearby) | `tests/playwright/specs/asset-parity.spec.js` | pass | pass |

### Risk & mitigation

- **Risk:** Bridge-script injection path is fragile — the template-interpolation approach is load-order sensitive. If `__KNOWN_ENTITY_KINDS` is undefined at bridge-script init, silent fallback engages but behavior could diverge if new kinds are added and shell is updated but bridge injection mechanism fails.
- **Mitigation:** Defensive fallback keeps the 12 canonical ids literal in bridge-script.js; `runtime-log` warn on fallback use makes the drift observable. Add an EKR6 test (optional extension) that deliberately severs injection and asserts fallback works.
- **Risk:** Entity kind `label` Russian strings collide with existing UI labels in inspector — double-translation.
- **Mitigation:** `inspectorSections` field is informational only in this WO (not consumed by runtime yet). Existing inspector code is NOT refactored to read `label` from registry here — that's a future WO. Current risk is labels never being read; but if accidentally wired later, collisions are caught by visual gate (WO-32) + EKR5 regression.
- **Risk:** `Object.freeze` on nested arrays is shallow — `inspectorSections: [...]` inside each kind is not deep-frozen.
- **Mitigation:** Each `inspectorSections` array is explicitly `Object.freeze()`-wrapped in the definition (one-line change if sub-task 2 misses it); acceptance criteria verify immutability by mutation attempt.
- **Risk:** Someone adds a new kind to `constants.js:IMPORT_ENTITY_KINDS` but forgets `entity-kinds.js`. Import accepts `'newkind'`; bridge rejects it as unknown.
- **Mitigation:** Add a boot-time assertion `console.assert(IMPORT_ENTITY_KINDS.size >= ENTITY_KINDS_KNOWN.size && [...ENTITY_KINDS_KNOWN].every(k => IMPORT_ENTITY_KINDS.has(k)))`. Emit `runtime-log` warn on mismatch so drift is observable. Don't hard-fail — defensive.
- **Rollback:** `git revert <sha>`. `bridge-commands.js` + `bridge-script.js` + presentation-editor.html revert cleanly. `entity-kinds.js` file removal is clean. No data migration risk.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:architect-review
isolation: worktree
branch_prefix: claude/wo-35-plugin-l1-entity-kind-registry
```

````markdown
You are implementing Step 35 (v0.32.0 entity-kind registry, ADR-016 Layer 1) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-35-plugin-l1-entity-kind-registry   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-016 (docs/ADR-016-plugin-extension-architecture.md) fully — Layer 1 only
  3. Read AUDIT-A §"duplicated KNOWN_ENTITY_KINDS"
  4. Read PAIN-MAP P2-05
  5. Read editor/src/bridge-script.js lines 1–50, 200–220 (KNOWN_ENTITY_KINDS definition + usage)
  6. Read editor/src/bridge-commands.js lines 170–210 (CANONICAL_ENTITY_KINDS)
  7. Read editor/src/constants.js lines 49–63 (IMPORT_ENTITY_KINDS for comparison)
  8. Read editor/src/preview.js fully (iframe injection path)
  9. Read editor/src/boot.js — init order where bridge-script is set up
  10. Read editor/presentation-editor.html — <script> load order
  11. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/entity-kinds.js                                 (new, IIFE classic script)
  - editor/src/bridge-script.js                                (edit: template injection)
  - editor/src/bridge-commands.js                              (edit: reference registry)
  - editor/src/constants.js                                    (edit: documentation comment)
  - editor/src/preview.js OR editor/src/boot.js                (edit: injection site — pick one)
  - editor/presentation-editor.html                            (edit: <script> tag added)
  - tests/playwright/specs/entity-kinds-registry.spec.js       (new, 5 tests)
  - package.json                                               (edit: gate-b spec list)
  - docs/CHANGELOG.md                                          (append)
  - docs/ADR-016-plugin-extension-architecture.md              (Status split)

FILES READ-ONLY (reference only):
  - docs/audit/PAIN-MAP.md (P2-05)
  - docs/audit/AUDIT-A-architecture.md
  - references_pres/html-presentation-examples_v3/*.html

SUB-TASKS: (verbatim from WO sub-tasks section 1–12)

INVARIANTS (NEVER violate):
  - No type="module"; new entity-kinds.js is classic IIFE
  - No bundler
  - Gate-A 55/5/0 preserved
  - LAYER 2 NOT IMPLEMENTED — zero plugin-loading code, zero registerPlugin API
  - Russian labels VERBATIM: Текст, Изображение, Видео, Контейнер, Элемент, Слайд,
    Защищённый, Таблица, Ячейка, Код, SVG, Фрагмент
  - Script load order: entity-kinds.js → constants.js → bridge-commands.js
  - Bridge-script fallback stays as defensive default
  - Reference decks regression-clean

ACCEPTANCE: (verbatim from Acceptance criteria section)

ON COMPLETION:
  1. Run full acceptance matrix — gate-a 55/5/0, gate-b +5 pass
  2. Manual: open reference decks; inspector labels show Russian kind names; export round-trip clean
  3. grep for duplicated literal — only entity-kinds.js + fallback comment in bridge-script.js
  4. git add editor/src/entity-kinds.js editor/src/bridge-script.js editor/src/bridge-commands.js
       editor/src/constants.js editor/src/preview.js editor/presentation-editor.html
       tests/playwright/specs/entity-kinds-registry.spec.js package.json
       docs/CHANGELOG.md docs/ADR-016-plugin-extension-architecture.md
  5. Conventional commit: "refactor(entities): externalize entity-kind registry (ADR-016 L1, P2-05) — v0.32.0 WO-35"
  6. Report back: files changed, LOC delta, gate results, injection-path choice, reference-deck regression notes
````

### Rollback plan

If merge breaks main: `git revert <sha>`. bridge-script.js/bridge-commands.js restore hard-coded kinds literally. `entity-kinds.js` file removed cleanly. No data migration. Re-plan injection strategy before re-attempt. NO fix-forward under pressure.

---
