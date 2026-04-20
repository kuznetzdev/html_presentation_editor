## Step 34 — v0.33.0 · Telemetry viewer panel (advanced mode) + export log + opt-in UI polish

**Window:** W7   **Agent-lane:** C (Observability/JS)   **Effort:** M
**ADR:** ADR-020   **PAIN-MAP:** —
**Depends on:** WO-15 (telemetry scaffold — emit API + opt-in toggle + event shape), WO-08 (bridge contract scaffold — ACKs feed telemetry), WO-22 (boot.js split — diagnostics panel lives in `shell-layout.js`)   **Unblocks:** WO-38 (RC freeze — "documented accepted risks" includes telemetry posture)

### Context (3–5 lines)

Per ADR-020, telemetry is opt-in, local-only, zero network. WO-15 ships the scaffold (v0.28.1): `editor/src/telemetry.js` with emit API + localStorage log + opt-in toggle. This WO (v0.33.0) adds the **viewer** that actually makes the log useful: advanced-mode Diagnostics-panel subsection showing session summary, event filter, and **export log as JSON** (user-initiated save). It also polishes the opt-in UX: explicit Russian copy with the local-only promise, clear semantics, session-reset on disable. Critically, **the exported HTML deck must NOT contain any telemetry data** — `export.js` strips nothing new because telemetry lives in `localStorage`, not DOM, but this WO adds a regression test to lock that invariant.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/telemetry.js` | edit (add viewer APIs + export helpers) | +180 / −10 |
| `editor/src/feedback.js` | edit (wire viewer into diagnostics panel) | +60 / −0 |
| `editor/styles/inspector.css` | edit (viewer subsection styling) | +40 / −0 |
| `editor/presentation-editor.html` | edit (add `<section>` slot for viewer inside diagnostics panel) | +25 / −0 |
| `tests/playwright/specs/telemetry-viewer.spec.js` | new | +260 / −0 |
| `tests/playwright/helpers/telemetry-fixtures.js` | new | +90 / −0 |
| `docs/CHANGELOG.md` | edit (append) | +10 / −0 |
| `docs/ADR-020-telemetry-and-feedback.md` | edit (Status → Accepted) | +2 / −2 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `docs/ADR-020-telemetry-and-feedback.md` §Decision + §Viewer | exact viewer requirements + event shape |
| `docs/ADR-014-error-boundaries.md` | error code registry — telemetry code source of truth |
| `editor/src/telemetry.js` (post-WO-15) | emit API + event shape (don't redesign, only consume) |
| `editor/src/export.js` lines ~270–280 | `pptxgenjs` path + existing `data-editor-*` stripping |
| `editor/src/feedback.js` — diagnostics panel region | where viewer attaches |
| `editor/src/constants.js` | telemetry-related storage keys (confirm names post-WO-15) |
| `tests/playwright/specs/honest-feedback.spec.js` | diagnostic-panel test pattern to mirror |

### Sub-tasks (executable, each ≤ 2 h)

1. Read `editor/src/telemetry.js` (post-WO-15) fully. Confirm: (a) `telemetry.emit({code, level, data})` exists; (b) events persist to `localStorage['editor:telemetry:log']` (JSON array, 1 MB LRU cap); (c) session UUID is fresh per session. Record exact API names. Expected state after: know the read/write surface — no redesign.
2. Add to `editor/src/telemetry.js`: `telemetry.getSession()` → `{ sessionId, startedAt, enabled }`; `telemetry.getEvents({ code, level, sinceT, limit })` → filtered array; `telemetry.getSummary()` → `{ count, errors, avgFirstSelectMs, autosaveBytes }`; `telemetry.exportLog()` → triggers user-initiated save (File System Access API OR `<a download>` fallback) writing a `.json` file; `telemetry.clearLog()` → empties log, logs a `telemetry.cleared` event. Expected state after: five new APIs, all pure-local.
3. Add to `editor/src/telemetry.js`: `telemetry.subscribe(callback)` for real-time viewer updates — calls `callback(event)` on every `emit`. Unsubscribe returned. Expected state after: viewer can live-update without polling.
4. Edit `editor/presentation-editor.html` — inside the existing Diagnostics panel region, add a `<section id="telemetryViewer" class="telemetry-viewer" hidden>` slot with children placeholders for: opt-in toggle (reuse WO-15 toggle, visually adjacent), summary strip, filter chips, event list, export button, clear button. Russian UI copy VERBATIM:
   - Section header: `Локальный журнал действий`
   - Opt-in subtitle: `Сохраняется только в вашем браузере. В сеть не отправляется.`
   - Filter chip codes: `Все` / `Ошибки` / `Предупреждения` / `Успешные`
   - Export button: `Сохранить журнал в файл`
   - Clear button: `Очистить журнал`
   Expected state after: DOM carries the region, `hidden` attribute gates visibility.
5. Edit `editor/src/feedback.js` — add `renderTelemetryViewer()`. Called from existing `renderDiagnosticsPanel()` when `complexityMode === "advanced"` AND `telemetry.getSession().enabled === true`. Responsibilities: (a) populate summary strip from `telemetry.getSummary()`; (b) render up to 200 most-recent events in a virtualized list (simple — just take `events.slice(-200)` and render); (c) wire filter chips to call `telemetry.getEvents({code, level})` and re-render; (d) wire export button to `telemetry.exportLog()`; (e) wire clear button to `telemetry.clearLog()` with confirm dialog `Очистить локальный журнал? Отменить нельзя.`; (f) subscribe to `telemetry` for real-time updates. Toggle-off clears the DOM and removes subscription. Expected state after: viewer renders + updates + interacts correctly when opt-in is ON.
6. Edit `editor/styles/inspector.css` — add `.telemetry-viewer` rules: `@layer inspector { .telemetry-viewer { ... } }`. Table-like layout: summary strip on top, filter chips row, event list (monospace font, color-coded by level: `ok`/`warn`/`error`), action buttons at bottom. Use semantic tokens from WO-30 if available; otherwise reuse existing `--inspector-*` tokens. NO new `@layer` declaration — reuse `inspector`. Expected state after: viewer looks consistent with rest of diagnostics panel.
7. Create `tests/playwright/helpers/telemetry-fixtures.js`. Exports: `enableTelemetry(page)` (flips opt-in via toggle — use existing WO-15 selector), `disableTelemetry(page)`, `emitTestEvents(page, count)` (uses `page.evaluate` to call `window.telemetry.emit` N times with varied codes), `readViewerSummary(page)` (parses DOM summary strip into `{count,errors,...}`), `exportLogViaViewer(page)` (clicks export button, returns `Blob`/bytes via Playwright download event). Expected state after: helpers compile; are imported by spec.
8. Create `tests/playwright/specs/telemetry-viewer.spec.js` with 9 tests:
   - TV1: default state — opt-in OFF, viewer section is `hidden`, no log write occurs.
   - TV2: enable opt-in → viewer becomes visible, summary shows `0 событий`.
   - TV3: emit 5 events → viewer lists 5 entries, summary `5 событий`.
   - TV4: emit mixed-level events → filter `Ошибки` chip narrows list correctly.
   - TV5: disable opt-in → viewer re-hides, log cleared (verify `localStorage['editor:telemetry:log']` is empty).
   - TV6: export log → Playwright captures download event, file is JSON, contains all emitted events in emit order.
   - TV7: clear log with confirm-accept → log empties but viewer stays visible.
   - TV8: clear log with confirm-decline → log preserved.
   - TV9: **Export-purity regression** — emit events, enable opt-in, then export PPTX via existing export flow → resulting PPTX file contains NO telemetry strings (grep for `sessionId`, `editor:telemetry`, any emitted codes like `select.success` in export output). This proves the export.js path is correctly isolated from localStorage.
   Expected state after: 9 tests pass locally on chromium-desktop.
9. Wire viewer spec into Gate-B (regression). Edit `package.json` → `"test:gate-b"` argument list: prepend `tests/playwright/specs/telemetry-viewer.spec.js` to the chromium-desktop section. Do NOT add to Gate-A (AUDIT-E rule: new specs enter Gate-A only after 3 nightly-green). Expected state after: Gate-B runs 12 specs; Gate-A stays at 4 specs.
10. Run full gate check:
    - `npm run test:gate-a` → 55/5/0 (invariant)
    - `npm run test:gate-b` → pass with +9 new tests
    - Manual: enable opt-in, perform 3 edits (select, type, delete), confirm viewer shows entries with correct codes; export log; open JSON in text editor; confirm shape matches ADR-020 `TelemetryEvent` typedef.
    Expected state after: all gates green.
11. Update `docs/CHANGELOG.md` under `## Unreleased` → `### Added`: `Telemetry viewer in advanced-mode Diagnostics — session summary, event filter, export log as JSON, clear log (ADR-020). 100% local, zero network. Opt-in off by default. Export-purity spec locks the invariant that PPTX/HTML exports contain no telemetry data. (WO-34)`. Expected state after: CHANGELOG reflects shipped UX + invariant spec.
12. Mark ADR-020 Status: Accepted. Edit line 3: `**Status**: Proposed` → `**Status**: Accepted`. Append: `**Accepted in**: v0.33.0 via WO-34 (viewer + export polish); scaffold shipped v0.28.1 via WO-15.`. Expected state after: ADR status matches reality.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] NO `@layer` declaration added — viewer CSS reuses existing `inspector` layer
- [ ] Russian UI-copy strings preserved VERBATIM (see sub-task 4 list)
- [ ] ZERO network calls introduced — grep the new code for `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `navigator.connection` → must be empty
- [ ] Telemetry log stays in `localStorage` — never leaks into DOM attributes or exported HTML
- [ ] Export purity: TV9 spec passes — PPTX export contains no `sessionId` or emit codes
- [ ] Opt-in default OFF persists (no auto-enable on first run or version upgrade)
- [ ] LocalStorage 1 MB cap from ADR-020 respected (LRU-evict honored in emit; viewer just reads)
- [ ] File System Access API usage is optional with `<a download>` fallback for Firefox/Safari
- [ ] No personally-identifying data collected (event `data` field is bounded to `entityKind | duration | size` per ADR-020)

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `tests/playwright/specs/telemetry-viewer.spec.js` has exactly 9 tests, all 9 pass on chromium-desktop
- [ ] `npm run test:gate-a` remains 55 / 5 / 0
- [ ] `npm run test:gate-b` passes with telemetry-viewer added (record new pass count in commit body)
- [ ] Manual verification: open devtools Network tab, enable opt-in, emit events for 60 s, export log. ZERO network requests from editor origin during that window.
- [ ] Manual verification: emitted JSON file (downloaded via viewer export) matches this shape sample:
  ```json
  { "session": "<uuid>", "exportedAt": 1742500000000, "events": [ {"t":..., "session":..., "code":"select.success", "level":"ok", "data":{}} ] }
  ```
- [ ] TV9 spec (export-purity) — search PPTX output for `session`, `telemetry`, `select.success`, `export.pptx.started` → all absent
- [ ] ADR-020 `Status: Accepted` + `Accepted in: v0.33.0 via WO-34` line present
- [ ] Commit message in conventional-commits format: `feat(telemetry): viewer panel + export log + opt-in polish — v0.33.0 WO-34`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| TV1 default OFF, viewer hidden | gate-b | `tests/playwright/specs/telemetry-viewer.spec.js` | N/A | pass |
| TV2 enable opt-in, viewer visible | gate-b | `tests/playwright/specs/telemetry-viewer.spec.js` | N/A | pass |
| TV3 emit 5 events, list shows 5 | gate-b | `tests/playwright/specs/telemetry-viewer.spec.js` | N/A | pass |
| TV4 filter chip narrows list | gate-b | `tests/playwright/specs/telemetry-viewer.spec.js` | N/A | pass |
| TV5 disable, log cleared | gate-b | `tests/playwright/specs/telemetry-viewer.spec.js` | N/A | pass |
| TV6 export log as JSON | gate-b | `tests/playwright/specs/telemetry-viewer.spec.js` | N/A | pass |
| TV7 clear with confirm-accept | gate-b | `tests/playwright/specs/telemetry-viewer.spec.js` | N/A | pass |
| TV8 clear with confirm-decline | gate-b | `tests/playwright/specs/telemetry-viewer.spec.js` | N/A | pass |
| TV9 export-purity regression (PPTX contains no telemetry) | gate-b | `tests/playwright/specs/telemetry-viewer.spec.js` | N/A | pass |
| gate-a baseline unaffected | gate-a | all four gate-a specs | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** File System Access API (`showSaveFilePicker`) is Chromium-only — Firefox/Safari lack it. Export-log action on Firefox would silently fail.
- **Mitigation:** Feature-detect `if ('showSaveFilePicker' in window)`; fall back to `<a download>` with `URL.createObjectURL`. TV6 test runs on chromium-desktop only (matches existing gate-B pattern). Document fallback path in code comment + ADR follow-up.
- **Risk:** localStorage log grows past 1 MB on long sessions — LRU-evict is in scaffold but viewer rendering 200 events × complex filter could become janky.
- **Mitigation:** Viewer renders the newest 200 events ALWAYS; filters apply to that window, not the full log. Document limit in sub-task 5.
- **Risk:** `telemetry.subscribe` callback invoked during render causes reentrancy — viewer re-renders while rendering.
- **Mitigation:** Subscribe handler uses `requestAnimationFrame` to batch. Single-flight guard in `renderTelemetryViewer` — reentry sets a dirty flag, rRAF re-renders once.
- **Risk:** **Export-purity invariant breaks** — a future edit to `export.js` could accidentally include telemetry. TV9 guards against it; but if `window.state.telemetry` becomes a model-tracked slice (ADR-013 target), export.js might need explicit strip.
- **Mitigation:** Document in code comment on `export.js` serialization: `// Telemetry lives in localStorage, not state — do NOT include.` TV9 spec is the runtime regression check. If WO-22 or later refactor moves telemetry into state slice, a follow-up WO adds an explicit strip hook.
- **Risk:** Opt-in toggle wording disagrees across scaffold (WO-15) and viewer (WO-34).
- **Mitigation:** Single source: the toggle label + subtitle live in `editor/presentation-editor.html` only; viewer reads the DOM, never re-adds the toggle. If WO-15 used different text, WO-34 normalizes during sub-task 4 — explicit note in CHANGELOG.
- **Rollback:** `git revert <sha>`. Removes viewer section, removes viewer APIs from `telemetry.js`, reverts CSS/HTML/spec additions. Scaffold from WO-15 survives unchanged.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:javascript-developer
isolation: worktree
branch_prefix: claude/wo-34-telemetry-viewer-full
```

````markdown
You are implementing Step 34 (v0.33.0 telemetry viewer) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-34-telemetry-viewer-full   (create from main, AFTER WO-15 merged)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-020 (docs/ADR-020-telemetry-and-feedback.md) fully
  3. Read ADR-014 (error code registry — source for emit codes)
  4. Read editor/src/telemetry.js fully (post-WO-15) — know the existing emit API
  5. Read editor/src/feedback.js — diagnostics panel render chain
  6. Read editor/src/export.js lines 260–300 (PPTX export path — for purity reasoning)
  7. Read editor/presentation-editor.html diagnostics panel section
  8. Read tests/playwright/specs/honest-feedback.spec.js (diagnostics pattern)
  9. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - editor/src/telemetry.js                                  (edit: +180 LOC viewer APIs)
  - editor/src/feedback.js                                    (edit: renderTelemetryViewer)
  - editor/styles/inspector.css                               (edit: .telemetry-viewer rules)
  - editor/presentation-editor.html                           (edit: <section id="telemetryViewer">)
  - tests/playwright/specs/telemetry-viewer.spec.js           (new, 9 tests incl. TV9 purity)
  - tests/playwright/helpers/telemetry-fixtures.js            (new)
  - package.json                                              (edit: gate-b spec list)
  - docs/CHANGELOG.md                                         (append)
  - docs/ADR-020-telemetry-and-feedback.md                    (Status: Accepted)

FILES READ-ONLY (reference only):
  - docs/ADR-014-error-boundaries.md
  - editor/src/export.js
  - editor/src/constants.js
  - editor/styles/tokens.css (token reuse)

SUB-TASKS: (verbatim from WO sub-tasks section 1–12)

INVARIANTS (NEVER violate):
  - No type="module"; no bundler
  - Gate-A 55/5/0 preserved
  - ZERO network calls — grep the new code for fetch, XHR, WebSocket, sendBeacon — must be empty
  - Russian UI copy VERBATIM (see sub-task 4 list)
  - Telemetry in localStorage ONLY — never DOM, never export
  - Opt-in default OFF — no auto-enable
  - 1 MB LRU cap respected
  - NO new @layer — reuse inspector
  - TV9 export-purity spec is non-negotiable

ACCEPTANCE: (verbatim from Acceptance criteria section)

ON COMPLETION:
  1. Run full acceptance matrix — gate-a 55/5/0, gate-b +9 pass
  2. Manual: devtools Network tab, opt-in, emit events 60s → zero requests from editor origin
  3. Manual: export log → JSON file with session + events matches shape
  4. git add editor/src/telemetry.js editor/src/feedback.js editor/styles/inspector.css
       editor/presentation-editor.html tests/playwright/specs/telemetry-viewer.spec.js
       tests/playwright/helpers/telemetry-fixtures.js package.json docs/CHANGELOG.md
       docs/ADR-020-telemetry-and-feedback.md
  5. Conventional commit: "feat(telemetry): viewer panel + export log + opt-in polish — v0.33.0 WO-34"
  6. Report back: files changed, LOC delta, gate results, network-activity verification
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Viewer section is additive; reverting removes it cleanly. WO-15 scaffold is untouched. Re-plan viewer UX before re-attempt. NO fix-forward under pressure.

---
