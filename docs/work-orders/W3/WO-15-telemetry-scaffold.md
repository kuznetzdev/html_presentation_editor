## Step 15 — v0.28.1 · Opt-in localStorage telemetry scaffold + emit API + toggle UI

**Window:** W3   **Agent-lane:** C   **Effort:** M
**ADR:** ADR-020   **PAIN-MAP:** — (ADR-020 is architecturally requested; no PAIN-MAP ID)
**Depends on:** none for scaffold; full integration with ADR-014 error codes happens in v0.30.x (out of scope).
**Unblocks:** v0.32.x full telemetry viewer; ADR-014 integration; ADR-012 bridge-ack emits.

### Context (3–5 lines)

ADR-020 specifies an opt-in, local-only, zero-network telemetry system. Default off; user enables via advanced-mode diagnostics panel toggle. This WO ships the scaffold: new module `editor/src/telemetry.js` with `emit({ code, level, data })` API, storage via `localStorage['editor:telemetry:log']` (1 MB cap, LRU evict), opt-in flag `localStorage['editor:telemetry:enabled']`, and a toggle UI in the existing advanced-mode diagnostics section. Emit call-sites are NOT wired in this WO (ADR-014 bridge-ack integration arrives in a later WO); this WO provides the foundation + one canary emit (`telemetry.enabled` on toggle) + test coverage that proves no network IO and no DOM leakage.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/telemetry.js` | new | +180 / −0 |
| `editor/src/constants.js` | edit (telemetry storage keys + cap constants) | +10 / −0 |
| `editor/presentation-editor.html` | edit (add `<script src="src/telemetry.js">` after constants.js; add toggle UI markup in advanced-mode diagnostics section) | +20 / −0 |
| `editor/styles/inspector.css` | edit (minimal style for toggle row; no new `@layer`) | +12 / −0 |
| `editor/src/feedback.js` | edit (advanced-mode section render adds the toggle wire; read-only elsewhere) | +15 / −0 |
| `tests/playwright/specs/telemetry.spec.js` | new (opt-in + no-network + export-strip tests) | +160 / −0 |
| `docs/CHANGELOG.md` | edit | +3 / −0 |
| `docs/ADR-020-telemetry-and-feedback.md` | edit Status line | +0 / −0 net |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/state.js` | `state.complexityMode` (advanced gate), `state.diagnostics` (compare/contrast — telemetry is separate) |
| `editor/src/history.js` | `addDiagnostic` / `reportShellWarning` — precedent API shape |
| `editor/src/export.js` | confirm telemetry is NOT exported — verify serialize path reads from `state`/DOM, not `localStorage` |
| `editor/presentation-editor.html` | advanced-mode diagnostics section to host toggle |
| `docs/ADR-020-telemetry-and-feedback.md` | normative — event shape, emit API, viewer scope |
| `docs/ADR-014-error-boundaries.md` | future consumer of telemetry codes (not wired here) |

### Sub-tasks (executable, each ≤ 2 h)

1. Add constants to `editor/src/constants.js`:
   - `const TELEMETRY_ENABLED_KEY = "editor:telemetry:enabled";`
   - `const TELEMETRY_LOG_KEY = "editor:telemetry:log";`
   - `const TELEMETRY_MAX_BYTES = 1048576;` (1 MB per ADR-020)
   - `const TELEMETRY_MAX_EVENTS = 5000;` (LRU safety net — even if bytes under 1 MB, never hold > 5k entries)
   Expected state after: 4 new consts, classic-script globals.
2. Create `editor/src/telemetry.js` exposing a single window-scoped object `window.telemetry`:
   ```javascript
   /**
    * @typedef {Object} TelemetryEvent
    * @property {number} t
    * @property {string} session
    * @property {"ok"|"warn"|"error"} level
    * @property {string} code
    * @property {Object} [data]
    */
   (function(){
     function isEnabled(){ try { return localStorage.getItem(TELEMETRY_ENABLED_KEY) === "1"; } catch(_){ return false; } }
     function setEnabled(on){ try { localStorage.setItem(TELEMETRY_ENABLED_KEY, on ? "1" : "0"); if (!on) clearLog(); else ensureSession(); } catch(_){ /* storage full or blocked — silent */ } }
     function ensureSession(){ /* assigns window._telemetrySession UUID once */ }
     function readLog(){ /* parse JSON array; on parse error → reset to [] */ }
     function writeLog(arr){ /* JSON.stringify; if > TELEMETRY_MAX_BYTES, evict oldest until fits */ }
     function clearLog(){ try { localStorage.removeItem(TELEMETRY_LOG_KEY); } catch(_){} }
     function emit(ev){ if (!isEnabled()) return; /* append with t=Date.now(), session, sanitized data */ }
     function exportLogJson(){ return readLog(); }  /* caller (viewer WO) decides how to offer download */
     window.telemetry = Object.freeze({ isEnabled, setEnabled, emit, readLog, clearLog, exportLogJson });
   })();
   ```
   UUID generator: use `crypto.randomUUID()` if available; fallback to `crypto.getRandomValues(new Uint8Array(16))` + hex formatter (aligned with PAIN-MAP P1-15 crypto-token work). Zero network calls anywhere. Expected state after: module loads, `window.telemetry.isEnabled() === false` default.
3. Wire `<script src="src/telemetry.js">` in `editor/presentation-editor.html` AFTER `constants.js` and BEFORE `feedback.js` (feedback.js may later emit events via `window.telemetry.emit`). Reference: existing `<script src="src/constants.js">` position. Expected state after: browser DevTools `window.telemetry` defined; no console errors.
4. Add toggle UI markup to the advanced-mode diagnostics section of `editor/presentation-editor.html`. Identify the section by opening the shell markup and locating the diagnostics panel (search for `id="diagnostics"` or similar — ADR-020 §Viewer references "Advanced-mode Diagnostics panel"). If the panel doesn't yet have a toggle area, insert:
   ```html
   <div class="diagnostics-telemetry-row" data-ui-level="advanced">
     <label class="diagnostics-telemetry-toggle">
       <input type="checkbox" id="telemetryToggle" />
       <span>Записывать действия в локальный журнал для себя</span>
     </label>
     <button type="button" id="telemetryExportBtn" class="ghost-btn" disabled>Экспорт журнала</button>
     <button type="button" id="telemetryClearBtn" class="ghost-btn" disabled>Очистить</button>
   </div>
   ```
   Russian UI copy verbatim per ADR-020 §Opt-in. Expected state after: markup present behind `data-ui-level="advanced"`.
5. Wire the toggle in `editor/src/feedback.js` (or wherever advanced-mode section rendering lives — confirm via grep: `grep -n "diagnostics" editor/src/feedback.js`; if wiring lives in a different module, edit that file and update "Files owned" at PR review). Event flow:
   - `#telemetryToggle` change → `window.telemetry.setEnabled(checked); enableButtons(checked)`.
   - `#telemetryExportBtn` click → `const log = window.telemetry.exportLogJson(); const blob = new Blob([JSON.stringify(log)], { type: "application/json" }); ...` (standard local-save pattern via `URL.createObjectURL` + `<a download>`). Verify NO fetch/XHR.
   - `#telemetryClearBtn` click → `window.telemetry.clearLog(); showToast("Журнал очищен", "info")`.
   Expected state after: toggle works round-trip.
6. Emit a single canary event on enable-toggle inside `telemetry.js::setEnabled`: when flipping from off→on, after `ensureSession()`, call the internal `emit({ level: "ok", code: "telemetry.enabled", data: {} })` — this proves the pipe works in tests. Do NOT add call-sites across other modules (out of scope per ADR-020 §Applied In — v0.28.1 is scaffold only). Expected state after: one event appears in localStorage on toggle.
7. Verify export/save path is telemetry-free. Read `editor/src/export.js` and confirm the HTML-serialize path does NOT touch `localStorage` keys starting with `editor:telemetry:`. ADR-020 §Export stripping: "telemetry lives in localStorage, not DOM, so no stripping needed". Add a defensive test (sub-task 9) to assert this invariant. Expected state after: confidence that exports never carry telemetry.
8. Create `tests/playwright/specs/telemetry.spec.js` with tests — ALL chromium-desktop, additive, NOT in Gate-A:
   - `default off: window.telemetry.isEnabled() === false and localStorage.getItem("editor:telemetry:log") === null`
   - `enable flow: click toggle → window.telemetry.isEnabled() === true → canary event persisted (readLog().length >= 1 with code "telemetry.enabled")`
   - `disable flow clears log: enable → emit → disable → readLog().length === 0`
   - `no network IO: page.on('request', req => networkCalls.push(req.url())) during enable/emit/export — only origin URLs; no external hosts`
   - `export stripping: after emit, run existing export path (exportHtml), assert the serialized HTML does not contain any localStorage key strings (grep for "editor:telemetry")`
   - `LRU cap: seed log with TELEMETRY_MAX_EVENTS + 100 events via page.evaluate → readLog().length <= TELEMETRY_MAX_EVENTS`
   Expected state after: 6 tests, all green.
9. Register spec in additive gates if needed. `test:gate-a` stays unchanged. For now, leave the spec discoverable via bare `npx playwright test tests/playwright/specs/telemetry.spec.js`. A future gate rebalance (PAIN-MAP P1-18) may move it; do NOT touch Gate-A. Expected state after: spec exists, runnable.
10. Run `npm run test:gate-a` — must be 55/5/0. Run the new spec directly — must be green. Expected state after: both gates reflect expected state.
11. Update `docs/CHANGELOG.md`: `feat(telemetry): opt-in local-only scaffold + toggle UI — ADR-020 scaffold`.
12. Update `docs/ADR-020-telemetry-and-feedback.md` Status line to `Accepted (scaffold — v0.28.1; call-sites per §Applied In land in v0.29.x–v0.32.x)`.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added (neither on `telemetry.js` script tag nor elsewhere)
- [ ] No bundler dep added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works — manual smoke: open editor via file://, check `window.telemetry` defined
- [ ] New `@layer` declared first in `editor/styles/tokens.css` — N/A unless the toggle CSS needs a new layer; use existing `inspector.css` layer
- [ ] Russian UI-copy preserved: `"Записывать действия в локальный журнал для себя"`, `"Экспорт журнала"`, `"Очистить"`, `"Журнал очищен"` — spec asserts Cyrillic presence
- [ ] Telemetry is 100% local; zero network calls — spec asserts via `page.on('request', ...)` monitoring
- [ ] Exports must strip telemetry entries — spec asserts exported HTML does not contain `"editor:telemetry"` key strings (they live in localStorage only, not DOM, so should never leak)
- [ ] Opt-in default OFF: `localStorage.getItem("editor:telemetry:enabled")` is null/"0" on first load
- [ ] Disable clears log (privacy invariant: user off = zero history)
- [ ] Size cap enforced: ≤ TELEMETRY_MAX_BYTES (1 MB) and ≤ TELEMETRY_MAX_EVENTS (5000)
- [ ] Crypto-secure session UUID (crypto.randomUUID or crypto.getRandomValues), not Math.random

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `npm run test:gate-a` prints `55 passed, 5 skipped, 0 failed`
- [ ] `npx playwright test tests/playwright/specs/telemetry.spec.js --project=chromium-desktop` — 6 tests, all green
- [ ] DevTools: `typeof window.telemetry.emit === "function"` on any page load
- [ ] DevTools: `window.telemetry.isEnabled()` returns `false` on fresh profile
- [ ] Spec assertion: enabling emits canary event `code: "telemetry.enabled"` with level `"ok"`
- [ ] Spec assertion: `page.on('request')` during telemetry ops sees only same-origin URLs
- [ ] Spec assertion: exported HTML does not contain substring `"editor:telemetry"`
- [ ] `grep -n "fetch\|XMLHttpRequest\|navigator\.sendBeacon" editor/src/telemetry.js` returns zero hits
- [ ] `grep -n "Math.random" editor/src/telemetry.js` returns zero hits
- [ ] ADR-020 Status reflects scaffold acceptance
- [ ] Commit: `feat(telemetry): opt-in local scaffold + toggle UI — v0.28.1 step 15`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Default off — zero storage | bare spec | `tests/playwright/specs/telemetry.spec.js` | N/A | pass |
| Enable toggles persist + emit canary | bare spec | same | N/A | pass |
| Disable clears log | bare spec | same | N/A | pass |
| Zero network IO | bare spec | same | N/A | pass |
| Exported HTML does not contain telemetry keys | bare spec | same | N/A | pass |
| LRU cap enforced | bare spec | same | N/A | pass |
| Gate-A baseline | gate-a | existing | 55/5/0 | 55/5/0 |

### Risk & mitigation

- **Risk:** Future call-sites forget the `isEnabled()` gate and emit when the user has opted out, violating the local-only opt-in promise.
- **Mitigation:** `emit()` is the sole public API and internally short-circuits on `!isEnabled()`. Module does not expose a `forceEmit` or bypass. A follow-up WO adding call-sites must use `window.telemetry.emit` and nothing else — enforce in PR review.
- **Risk:** localStorage quota exhaustion. `TELEMETRY_MAX_BYTES` is 1 MB of 5–10 MB quota, but older decks already use `sessionStorage` / `localStorage`; autosave has no size cap (PAIN-MAP P1-14, out of scope). Combined may exceed quota; emit path must fail silently.
- **Mitigation:** All `localStorage.setItem` calls in `telemetry.js` are wrapped in try/catch — catch `QuotaExceededError` and silently drop the oldest event (LRU). Expected state: on quota-exceeded, `emit` becomes no-op; `isEnabled` still reports true; viewer sees stale events but no crash.
- **Risk:** Session UUID generation via `crypto.randomUUID` is not available on older Safari (only 15.4+). On `file://` + old Safari, session becomes empty string → events lose attribution.
- **Mitigation:** Fallback to `crypto.getRandomValues(new Uint8Array(16))` + hex formatter. Test via `webkit-desktop` project (Gate-C) — flag as blocker if session-assignment fails.
- **Rollback:** `git revert <sha>`. Module deletion safe; toggle UI markup reverts via git; CSS reverts. Any events already in a user's localStorage remain until they manually clear — add `telemetry.clearLog()` DevTools hint to the PR description for edge cases.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:javascript-developer
isolation: worktree
branch_prefix: claude/wo-15-telemetry-scaffold
```

````markdown
You are implementing Step 15 (v0.28.1 Telemetry scaffold) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-15-telemetry-scaffold   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md — invariants
  2. Read ADR-020-telemetry-and-feedback.md end-to-end — event shape, emit API, viewer scope, stripping
  3. Read editor/src/history.js (addDiagnostic precedent) and editor/src/state.js (state.diagnostics)
  4. Read editor/presentation-editor.html — identify advanced-mode diagnostics section location
  5. Read editor/src/export.js — confirm serialize path doesn't read localStorage
  6. Run `npm run test:gate-a` — must be 55/5/0

FILES YOU OWN (exclusive write):
  - editor/src/telemetry.js (new)
  - editor/src/constants.js (edit — 4 new consts)
  - editor/presentation-editor.html (edit — <script src> tag + advanced-mode toggle UI)
  - editor/styles/inspector.css (edit — toggle row styling; NO new @layer)
  - editor/src/feedback.js (edit — wire toggle handlers ONLY if diagnostics section rendering lives here; otherwise relocate this edit to the correct module and update WO audit at PR review)
  - tests/playwright/specs/telemetry.spec.js (new — 6 tests)
  - docs/CHANGELOG.md
  - docs/ADR-020-telemetry-and-feedback.md (Status line)

FILES READ-ONLY (reference only):
  - editor/src/state.js (state.complexityMode, state.diagnostics)
  - editor/src/history.js
  - editor/src/export.js
  - docs/ADR-014-error-boundaries.md (future consumer — not wired here)

SUB-TASKS:
  1. Add 4 telemetry constants to constants.js (KEY, LOG_KEY, MAX_BYTES=1048576, MAX_EVENTS=5000).
  2. Create editor/src/telemetry.js — IIFE exposing frozen window.telemetry API (isEnabled, setEnabled, emit, readLog, clearLog, exportLogJson). All storage access wrapped in try/catch. Session UUID via crypto.randomUUID with getRandomValues fallback.
  3. Wire <script src="src/telemetry.js"> in presentation-editor.html AFTER constants.js, BEFORE feedback.js. NO type="module".
  4. Add advanced-mode toggle UI markup (checkbox + Export + Clear buttons) behind data-ui-level="advanced". Russian copy verbatim per ADR-020.
  5. Wire toggle change + button clicks in feedback.js (or correct module).
  6. Canary event: on enable, setEnabled internally emits { level:"ok", code:"telemetry.enabled" }.
  7. Verify export path telemetry-free (add defensive spec).
  8. Create tests/playwright/specs/telemetry.spec.js — 6 tests.
  9. Do NOT change Gate-A; spec runs via bare npx playwright test.
  10. Gate-A must be 55/5/0.
  11. Update docs/CHANGELOG.md.
  12. Update ADR-020 Status to Accepted (scaffold).

INVARIANTS (NEVER violate):
  - No `type="module"` on telemetry.js script tag
  - No bundler dep added
  - Gate-A 55/5/0 before AND after merge
  - `file://` still works — manual smoke: open file:// → window.telemetry defined
  - No new @layer — use existing inspector.css layer for toggle styling
  - Russian UI-copy preserved: "Записывать действия в локальный журнал для себя", "Экспорт журнала", "Очистить", "Журнал очищен"
  - Telemetry 100% local — zero network calls (spec asserts page.on('request') sees origin-only)
  - Exports strip telemetry entries — spec asserts exported HTML has no "editor:telemetry" substring
  - Opt-in default OFF — spec asserts on fresh profile
  - Disable clears log — spec asserts
  - Size cap enforced ≤ 1 MB AND ≤ 5000 events — spec asserts
  - Crypto-secure UUID — no Math.random (grep zero hits required)

ACCEPTANCE:
  - Gate-A: 55/5/0 unchanged
  - telemetry.spec.js: 6 tests green
  - typeof window.telemetry.emit === "function"
  - window.telemetry.isEnabled() === false on fresh load
  - Canary event fires on enable
  - Network spec sees zero external URLs
  - Export spec: HTML has no "editor:telemetry" substring
  - grep fetch/XMLHttpRequest/sendBeacon on telemetry.js = 0
  - grep Math.random on telemetry.js = 0
  - ADR-020 Status: Accepted (scaffold)
  - Commit: `feat(telemetry): opt-in local scaffold + toggle UI — v0.28.1 step 15`

ON COMPLETION:
  1. Run full acceptance matrix
  2. git add editor/src/telemetry.js editor/src/constants.js editor/presentation-editor.html editor/styles/inspector.css editor/src/feedback.js tests/playwright/specs/telemetry.spec.js docs/CHANGELOG.md docs/ADR-020-telemetry-and-feedback.md
  3. Conventional commit: `feat(telemetry): opt-in local scaffold + toggle UI — v0.28.1 step 15`
  4. Report: files changed, LOC delta, gate-a results, telemetry-spec results, any webkit-desktop session-UUID concerns
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Module deletion is safe. Toggle UI markup and CSS revert cleanly. Users who enabled telemetry have residual `editor:telemetry:log` in localStorage — benign; add DevTools hint `localStorage.removeItem('editor:telemetry:log'); localStorage.removeItem('editor:telemetry:enabled')` to the rollback PR description for privacy-conscious users.

---
