# PAIN-MAP — html-presentation-editor · Road to v1.0

> Synthesized from AUDIT-A (architecture), AUDIT-B (UX), AUDIT-C (performance), AUDIT-D (security), AUDIT-E (tests).
> Baseline: v0.25.0 · Gate-A 55/5/0 · main @ 4dc20bd · 2026-04-20

---

## Severity legend

- **P0** — blocks v1.0 usable-promise. Must ship before anyone calls this a release candidate.
- **P1** — ships after v1.0 RC but during pre-1.0 polish. Daily-UX or solid-quality bar.
- **P2** — tech debt. Addressable when touched naturally. Not scheduled independently.
- **P3** — ideas / may-be-later. Needs validation before planning.

Effort scale — **S** (<1 day · <100 LOC) · **M** (1–3 days · <500 LOC) · **L** (1–2 weeks) · **XL** (1+ month)

---

## P0 — Blocks v1.0

| # | Area | Problem | Evidence | Impact | Proposed fix | Effort | Depends | Risk |
|---|------|---------|----------|--------|--------------|--------|---------|------|
| P0-01 | Security | No HTML sanitization on paste/open; iframe explicitly un-sandboxed (`import.js:97`, `import.js:531–535`). Deck scripts read `parent.state.bridgeToken` same-origin. | AUDIT-D-01 | CRITICAL if exposed beyond single-user. Scripts read autosave, do SSRF. | Neutralize-scripts opt-in + Trust-Banner (detect `<script>/on*/javascript:/iframe`) + ADR-014 error boundary | M | ADR-014 | HIGH — product promise collision; must preserve file:// + deck-engine-JS |
| P0-02 | Security | `replace-node-html` / `replace-slide-html` / `insertElement` accept arbitrary HTML via `parseSingleRoot` — no tag/attr filter (bridge-script.js:2332, 3374–3401). Persistent XSS survives into export. | AUDIT-D-02 | HIGH. Single paste poisons every future export. | Apply `BLOCKED_ATTR_NAMES` + `UNSAFE_ATTR` filter inside `parseSingleRoot`. Length cap 256 KB. | S | ADR-012 | LOW — additive, kept behind same-origin trust |
| P0-03 | Security | `pptxgenjs` loaded from jsDelivr CDN unpinned, no SRI (`export.js:271–275`). | AUDIT-D-03 | Supply-chain bomb. | Pin exact version + `integrity` hash + `crossorigin="anonymous"`. Or vendor the dist. | S | — | LOW |
| P0-04 | UX | Paste raw HTML with broken assets: silently loads, no recovery banner enumerating missing `<img>/<link>/<video>`. User concludes editor is broken. | AUDIT-B journey 2 | Blocker — novice drop-off point. | Broken-asset banner lists N unresolved; one-click "Подключить папку ресурсов" persists after modal close. Reuse existing `previewAssistActionBtn`. | M | — | MED — CORS quirks on file:// |
| P0-05 | UX + a11y | Keyboard-only workflow blocked at 3+ surfaces: Tab doesn't enter preview iframe selection; rail arrow-nav missing; transient surfaces lack focus-trap audits. | AUDIT-B journey 8 + AUDIT-E §4 | Blocker for a11y gate + power-users. | Keyboard map ADR-006 scope expansion; declarative keybindings table (see ADR-011 / shortcuts.js redesign). | L | ADR-006 | MED |
| P0-06 | UX | Recovery from blocked state incomplete. Banner says "transform — use inspector" but transform field is absent from inspector. Dead-end feedback. | AUDIT-B cross-cutting #1 + journey 11 | Violates "no dead ends" invariant. | Add transform read/write to inspector advanced section + resolve-action button in banner that scrolls to the control. | S | — | LOW |
| P0-07 | UX | Undo chain ≥20: silently drops oldest step at HISTORY_LIMIT=20 (`constants.js:105`). No warning, no budget chip. | AUDIT-B journey 7 | User loses work silently. | Budget indicator in topbar `N/20`; toast-on-drop with "compact history" action. Long-term: link to ADR-013 (diff-indexed snapshots). | S | ADR-013 | LOW |
| P0-08 | UX | Slide rail keyboard nav missing: no `↑/↓` to move selection, no `Space` to reorder. Rail is drag-only. | AUDIT-B journey 12 + AUDIT-A shortcuts.js | Blocker for a11y gate + power users. | Roving tabindex + arrow handlers on rail; duplicate/delete shortcuts visible when rail focused. | S | ADR-006 | LOW |
| P0-09 | Arch | God-state: `state` object in `state.js:235–383` has 75+ fields, mutated from 15+ modules, no schema/selector/events. | AUDIT-A scorecard (4/10) + §state.js | Evolvability ceiling — every new feature widens the god-object. | Observable store ADR-013: typed slices (selection / history / model / ui / bridge) + subscribe-per-slice. Migration gradual. | L | ADR-013 + ADR-011 | MED — migration risk |
| P0-10 | Arch | Bridge protocol unversioned, unschemed, untyped. `replace-node-html` payloads are free-form strings. | AUDIT-A scorecard (6/10) + AUDIT-D-02 | Integrity — silent drift between bridge-script and shell; security vector. | ADR-012 Bridge protocol v2: version field, per-message JSDoc schema, validation at both ends. | L | ADR-012 | MED |
| P0-11 | Perf | Full-HTML history snapshots: `serializeCurrentProject` + `cloneNode(true)` + `outerHTML` per commit. 20 × ~700 KB ≈ 14 MB retained per session. | AUDIT-C bottleneck #1 + `history.js:608–623` | Memory pressure on 50-slide decks; 20–80 ms per undo save. | Hash-compare snapshots; diff-indexed storage after first full snapshot. | M | ADR-013 | MED |
| P0-12 | Perf | Selection fan-out = 7 synchronous render passes per click (`bridge-commands.js:349–422`). Layout thrashing. | AUDIT-C bottleneck #2 | 15–80 ms first-select cost, grows with deck size. | RAF-coalesce the fan-out behind a `scheduleSelectionRender()` queue. Single write-pass via `InspectorViewModel`. | M | — | LOW |
| P0-13 | Tests | No bridge contract layer — 0% direct coverage of `bridge.js` (132 LoC), `bridge-commands.js` (844 LoC). All coverage is transitive via DOM. | AUDIT-E top gap #1 | Protocol drift caught only at runtime. | `tests/contract/bridge.contract.spec.js` — replay recorded message logs; validate payload schemas (ADR-012). | M | ADR-012 | LOW |
| P0-14 | Tests | No accessibility gate. Keyboard-only, ARIA, focus order, reduced-motion — spot-checked at best. | AUDIT-E top #2 + AUDIT-B journey 8 | WCAG AA unknown. | Ship ADR-006 — `axe-core` + keyboard spec + contrast spec as `test:gate-a11y`. | M | ADR-006 | LOW |
| P0-15 | UX | Blank state CTA ambiguity: 3 equal-weight buttons; starter-deck last; `tests/fixtures/` path 404s in slim distributions. | AUDIT-B journey 1 | First-impression — novice drop. | Reorder (`Open / Starter / Paste`); move starter-deck fixture to `editor/fixtures/basic-deck.html`; paste demoted to `Дополнительно ▾`. | S | — | LOW |

**P0 count: 15.** Effort sum: ~4S + 6M + 2L + 3 cross-cutting = approximately **6–8 weeks** of sequential work, ~**4 weeks** with 3 parallel agents.

---

## P1 — Daily-UX polish (post-RC, pre-1.0)

| # | Area | Problem | Evidence | Fix | Effort |
|---|------|---------|----------|-----|--------|
| P1-01 | UX | Blocked-state channels duplicate (`#lockBanner` advanced-only + `#blockReasonBanner` mode-agnostic). Inconsistent gating. | AUDIT-B cross-cutting #2 | Merge into single banner controlled by `getBlockReason()`. | S |
| P1-02 | UX | Mode leak: geometry inspector auto-opens in basic mode when direct-manip blocked. | AUDIT-B cross-cutting #4 | Gate geometry visibility on `complexityMode === "advanced"` regardless of block path. | S |
| P1-03 | UX | Shift+click multi-select wired in bridge, silently ignored in shell. | AUDIT-B cross-cutting #3 | Either implement multi-select (see P3-multi-select) or toast "Будет в vNext" with link; remove from bridge. | S |
| P1-04 | UX | Stack-depth badge `2 из 3` ships v0.25.0 without picker popup (v0.25.1). Tease. | AUDIT-B journey 5 | Ship picker ADR-003 before v1.0 RC. Already on roadmap. | S |
| P1-05 | Arch | God-cache: `els` (190+ nodes) eagerly cached at script-parse time in `state.js:390–659`. Every module reaches every node. | AUDIT-A §state.js | Per-module ownership via `requireEl(id)` lazy accessor; gradual migration. | L |
| P1-06 | Arch | `selection.js` (1849 LOC) mixes selection / direct-manip / layers-panel / floating-toolbar. | AUDIT-A §selection.js | Split: `layers-panel.js` (444 LOC) + `floating-toolbar.js` (196 LOC) → selection.js ~800 LOC. | M |
| P1-07 | Arch | `boot.js` (1962 LOC) bundles init + theme + zoom + modals + shell-layout + slide-template-binding. | AUDIT-A §boot.js | Split: `theme.js` + `zoom.js` + `shell-layout.js`; boot.js retains `init()` only. | M |
| P1-08 | Arch | `main.js` contains orphaned DOM reparent code (`main.js:5–12`). Entry-point invariant violated. | AUDIT-A §main.js | Move to `ensureNoviceSummaryStructure()`. | S |
| P1-09 | Arch | `feedback.js` 924 LOC: toasts + surface-manager + overlap + block-banner + lock-banner in one file. | AUDIT-A §feedback.js | Extract `banners.js` + `surface-manager.js`. | M |
| P1-10 | Perf | Full rail rebuild on every state change (`slide-rail.js:4–6` `innerHTML = ""`). | AUDIT-C bottleneck #3 | Keyed diff; reuse slide cards. | M |
| P1-11 | Perf | Autosave not debounced at function (`primary-action.js:647–670`) — per-keystroke re-serialise. | AUDIT-C top 10 | Debounce 250–400 ms; dirty-slice tracking via observable store. | S |
| P1-12 | Perf | `renderLayersPanel` unconditionally called in basic mode (`inspector-sync.js:903`). | AUDIT-C top 10 | Gate by `complexityMode === "advanced"`. | S |
| P1-13 | Security | `postMessage` wildcard `'*'` targetOrigin (`bridge-script.js:93`). No origin check. | AUDIT-D-04 | Use `location.origin`; add `event.origin` equality on receive. | S |
| P1-14 | Security | `sessionStorage` autosave no size cap → quota DoS. | AUDIT-D-05 | Serialize size check; fall back to "light snapshot" mode on large decks. | S |
| P1-15 | Security | `Math.random` bridge token (`import.js:735–737`). | AUDIT-D-15 | `crypto.getRandomValues(new Uint8Array(24))`. | S |
| P1-16 | Tests | `editor.regression.spec.js` flake risk: 8× `waitForFunction(() => globalThis.eval(...))` bypasses auto-wait; fire-once dialog handler. | AUDIT-E §6 | Replace with `expect.poll` + Playwright selectors; use `page.on('dialog')`. | M |
| P1-17 | Tests | `layer-navigation.spec.js` LN3 has 5-attempt retry loop — known non-determinism. | AUDIT-E §7 | Debug the underlying container-mode race; remove retry. | S |
| P1-18 | Tests | Redundant test runs across gates (shell.smoke+editor.regression run in A/B/C/D/F). | AUDIT-E §1 | Gate-A becomes dev-heartbeat (no regression); Gate-B/F own regression. | S |
| P1-19 | Tests | 23× `waitForTimeout` across specs. | AUDIT-E §7 | Replace with state-based waits. | M |
| P1-20 | UX | Ctrl+Z silent from inside a contenteditable element — shell undo loses focus context. | AUDIT-B journey 3 | Intercept keydown at contenteditable scope; route to shell history. | S |

---

## P2 — Tech debt (opportunistic)

| # | Area | Problem | Fix | Effort |
|---|------|---------|-----|--------|
| P2-01 | Arch | `dom.js` is misnamed (contains `bindInspectorActions` only). | Rename `inspector-bindings.js`. | S |
| P2-02 | Arch | `history.js` also contains overlap detection (lines 69–200). | Extract `overlap.js`. | S |
| P2-03 | Arch | `constants.js:5–14` legacy map comment references removed monolith. | Delete comment. | S |
| P2-04 | Arch | Shortcuts: 160-line if/else chain (`shortcuts.js:6–169`). | Declarative keybindings table. Enables auto-cheatsheet. | M |
| P2-05 | Arch | Duplicated `KNOWN_ENTITY_KINDS` (`bridge-script.js:30`) + `CANONICAL_ENTITY_KINDS` (`bridge-commands.js:178–192`). | Single source in `constants.js` + shared to bridge via template param. | S |
| P2-06 | Arch | `deriveSelectedFlagsFromPayload` duplicates logic from `getEntityKindFromFlags`. | Consolidate. | S |
| P2-07 | Arch | `createDefaultSelectionPolicy` (`state.js:8–126`) 6 near-identical branches. | Policy-by-table lookup. | S |
| P2-08 | Arch | Scattered `complexityMode === "advanced"` check (21 occurrences in 8 files). | Single feature-flag accessor: `isAdvancedMode()`. | S |
| P2-09 | Arch | Mutual-exclusion of transient surfaces scattered across 3 files (`closeTransientShellUi`). | Dedicated `surface-manager.js` module. | M |
| P2-10 | Security | `COPIED_STYLE_KEY` parsed with `JSON.parse` no schema validation. | Schema validator or drop field-by-field. | S |
| P2-11 | Security | Drag-drop accepts arbitrary image files (data-URI bloat). | Size cap 5 MB + type allow-list. | S |
| P2-12 | Security | Restore-banner JSON parsed without shape validation. | Schema guard. | S |
| P2-13 | Security | `innerHTML` sinks in shell with manual `escapeHtml` (partial coverage). | `DOMBuilder` helper: `createElement` + `textContent` default path. | M |
| P2-14 | Tests | No mutation testing. | Evaluate Stryker or Mull; cost vs. benefit gate on 25 JS modules. | M |
| P2-15 | Tests | No property-based / fuzz testing for import pipeline. | fast-check on `buildModelDocument` invariants. | M |
| P2-16 | Perf | CSS `:has()` usage not yet measured. | Audit + benchmark on 50-slide deck. | S |
| P2-17 | Docs | 7 existing ADR skeletons under-specified re: consequences. | Backfill ADR consequences + applied-in cross-refs. | S |

---

## P3 — Ideas / may-be-later (needs validation)

- Multi-select + align/distribute (full feature) — AUDIT-B journey 6. Touches selection.js, toolbar, bridge. **XL**.
- Collaborative editing readiness (CRDT-friendly model) — ADR-017. Architectural, not feature. **XL**.
- Mobile / tablet-first editing — ADR-018. Likely separate product mode.
- Plugin/extension protocol — ADR-016. Needs 2 real plugin use cases before scoping.
- Telemetry opt-in local-only — ADR-020 / existing v0.28.1 skeleton.
- Theming system v2 (token-driven) — ADR-019.
- Visual regression depth (component-level snapshots, not just shell states) — extends ADR-007.
- Export → reimport round-trip end-to-end spec (multi-slide + multi-asset). — AUDIT-E gap.

---

## Cross-cutting dependencies

```
ADR-011 (types) ─┬──► ADR-012 (bridge v2) ──► P0-02, P0-10, P0-13
                 │
                 └──► ADR-013 (observable store) ──► P0-07, P0-09, P0-11, P1-05

ADR-006 (a11y gate) ──► P0-05, P0-08, P0-14

ADR-014 (error boundaries) ──► P0-01 (trust-banner reuses boundary)

P1-06 (selection split) ──► P1-07 (boot split) [ordering for merge safety]
```

---

## Prioritization rule

Ship P0 in this order:

1. **Security quick wins** P0-02, P0-03 → any release (< 1 week work)
2. **UX dead-ends** P0-04, P0-06, P0-07, P0-15 → v0.26.x (parallel S-M fixes)
3. **A11y gate** P0-14 + keyboard completeness P0-05, P0-08 → v0.27.x
4. **Observable store** P0-09 + **bridge v2** P0-10 + **history slim** P0-11 → v0.28.x–v0.30.x
5. **Selection render coalesce** P0-12 → v0.30.x (benefits from observable store)
6. **Trust banner + sanitization** P0-01 → v0.31.x (benefits from ADR-014)
7. **Bridge contract tests** P0-13 → alongside bridge v2

This sequence preserves the invariant **`Gate-A 55/5/0`** through every step and lets P1 polish flow as bandwidth allows.

---

## What "v1.0 ready" means

v1.0 ships when:

- All P0 items complete **or** explicitly deferred with documented rationale.
- Gate-A 55/5/0 + Gate-B green on Chromium + Firefox + WebKit.
- `test:gate-a11y` passes with zero WCAG AA violations on shell.
- `test:gate-visual` passes on shell (light + dark).
- `test:gate-contract` (new, ADR-012) passes on bridge protocol v2.
- Security posture acceptable per AUDIT-D revised assessment — HIGH findings remediated, MEDIUM findings triaged.
- `file://` still works (invariant).
- No bundler (invariant — see ADR-015).
- All 10 new ADRs (ADR-011–020) have Status: Accepted or Deprecated (not Proposed).

---

## Links
- [AUDIT-A — architecture](AUDIT-A-architecture.md)
- [AUDIT-B — UX journeys](AUDIT-B-ux-journeys.md)
- [AUDIT-C — performance](AUDIT-C-performance.md)
- [AUDIT-D — security](AUDIT-D-security.md)
- [AUDIT-E — tests](AUDIT-E-tests.md)
- [EXECUTION_PLAN_v0.26-v1.0](../EXECUTION_PLAN_v0.26-v1.0.md)
- [ROADMAP_NEXT](../ROADMAP_NEXT.md)
