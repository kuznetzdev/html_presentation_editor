# ARCH — Target State v1.0

> What the html-presentation-editor codebase looks like when v1.0 ships.
> Generated: 2026-04-20 · Synthesized from AUDIT-A + ADR-011..020 + PAIN-MAP.

---

## System diagram (target)

```
                        ┌─────────────────────────────────────┐
                        │   editor/presentation-editor.html   │
                        │   (shell, classic <script src>)     │
                        └──────────────┬──────────────────────┘
                                       │ loads
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
         tokens.css              bridge-schema.js          store.js
         (Layer 1               (ADR-012 single           (ADR-013 slice store)
          + Layer 2 tokens,      source of truth for
          ADR-019)               bridge messages)
                                         │
              ┌──────────────────────────┼──────────────────────────┐
              │                          │                          │
              ▼                          ▼                          ▼
         bridge.js                  shell modules              observability
         (thin dispatcher,          - selection/edit          - shellBoundary (ADR-014)
          validates via              - layers-panel            - telemetry (ADR-020)
          bridge-schema.js)         - floating-toolbar
              │                      - inspector-sync
              │                      - banners
              │                      - surface-manager
              ▼
    ┌────────────────────┐
    │  iframe preview    │
    │  bridge-script.js  │────────── same schema registry; validated ACKs
    │  (injected string) │
    └────────────────────┘
```

---

## Module layout (target)

```
editor/src/
  ├─ main.js              (12 LOC — calls init() only — P1-08 fixed)
  ├─ boot.js              (~600 LOC — init() + mode/complexity only — P1-07 split)
  ├─ theme.js             (NEW — split from boot.js)
  ├─ zoom.js              (NEW — split from boot.js)
  ├─ shell-layout.js      (NEW — split from boot.js)
  ├─ store.js             (NEW — ADR-013 observable store, ~300 LOC)
  ├─ constants.js         (~200 LOC — consolidated constants)
  ├─ entity-kinds.js      (NEW — ADR-016 L1 registry)
  ├─ bridge-schema.js     (NEW — ADR-012 message registry)
  ├─ bridge.js            (~150 LOC — dispatch + validate via schema)
  ├─ bridge-commands.js   (~600 LOC — handlers, slimmer)
  ├─ bridge-script.js     (~3200 LOC — still largest; iframe runtime)
  ├─ selection.js         (~800 LOC — core selection only — P1-06 split)
  ├─ layers-panel.js      (NEW — split from selection.js)
  ├─ floating-toolbar.js  (NEW — split from selection.js)
  ├─ inspector-sync.js    (~1200 LOC — InspectorViewModel pattern)
  ├─ context-menu.js      (~900 LOC — unchanged)
  ├─ shell-overlays.js    (~500 LOC — modal primitives only)
  ├─ banners.js           (NEW — split from feedback.js — ADR-014)
  ├─ surface-manager.js   (NEW — transient surface mutex — P2-09)
  ├─ feedback.js          (~200 LOC — toasts only)
  ├─ history.js           (~500 LOC — patch-based snapshots — ADR-017)
  ├─ overlap.js           (NEW — split from history.js — P2-02)
  ├─ primary-action.js    (~600 LOC — unchanged)
  ├─ slides.js            (~500 LOC — unchanged)
  ├─ slide-rail.js        (~500 LOC — keyed diff — P1-10)
  ├─ import.js            (~800 LOC — + Trust Banner detection — P0-01)
  ├─ export.js            (~650 LOC — + vendored pptxgenjs — P0-03)
  ├─ clipboard.js         (~150 LOC — + type allow-list — P2-11)
  ├─ inspector-bindings.js (renamed from dom.js — P2-01)
  ├─ onboarding.js        (~180 LOC — + starter deck rehomed — P0-15)
  ├─ telemetry.js         (NEW — ADR-020 opt-in local log)
  ├─ shortcuts.js         (~80 LOC — declarative table — P2-04)
  ├─ precision.js         (NEW from v0.26 — nudge/snap/guides)
  ├─ layer-picker.js      (NEW from v0.25.1)
  ├─ toolbar.js           (~150 LOC — unchanged)
  ├─ preview.js           (~40 LOC — still thin bridge bootstrap)
  └─ style-app.js         (~290 LOC — unchanged)

editor/styles/
  ├─ tokens.css           (Layer 1 + Layer 2 semantic — ADR-019)
  ├─ base.css
  ├─ layout.css
  ├─ preview.css
  ├─ inspector.css
  ├─ overlay.css
  ├─ modal.css
  ├─ responsive.css
  ├─ banner.css           (NEW — ADR-014)
  ├─ layer-picker.css     (NEW)
  ├─ precision.css        (NEW)
  └─ @layer declaration order in tokens.css

editor/vendor/
  └─ pptxgen.bundled.min.js  (NEW — vendored per ADR-015)

editor/fixtures/
  └─ basic-deck.html      (relocated from tests/fixtures — P0-15)

editor/plugins/            (NEW directory, empty in v1.0 — ADR-016 L2 reserved)

tests/
  ├─ playwright/specs/    (existing 11 + onboarding + precision + layer-picker + undo-chain)
  ├─ a11y/                (ADR-006)
  ├─ visual/              (ADR-007)
  └─ contract/            (ADR-012)

docs/
  └─ ADR-001..ADR-020     (all Accepted)
```

**Net change:** 25 → ~36 JS modules (11 new, a few merged/split). 8 → 11 CSS files. **No file over 1200 LOC except bridge-script.js.**

---

## State model (target)

Single store (ADR-013) with typed slices:

| Slice | Fields | Owner |
|---|---|---|
| `selection` | activeNodeId, activeSlideId, overlapIndex, candidates, blockReason | selection.js |
| `history` | patches[], baseSnapshot, index, dirty | history.js |
| `model` | doc, slides[], modelDirty | import.js + bridge-commands.js |
| `ui` | complexityMode, previewZoom, theme, compactMode, workflow | boot.js / theme.js / zoom.js |
| `bridge` | token, heartbeatAt, pendingSeq, protocol | bridge.js |
| `telemetry` | sessionId, events[], enabled | telemetry.js |

Every slice update passes the CRDT-readiness checklist (ADR-017).

`window.state` Proxy shim is removed in v0.31.0; all reads/writes go through `store`.

---

## Bridge protocol (target)

**Version 2** (ADR-012):

- Handshake: iframe → shell `{type:"hello", protocol:2, build:"<sha>"}`. Mismatch → degrade.
- All messages validated against `bridge-schema.js`. Shell + iframe share the schema via build-time template interpolation.
- Every mutation message returns structured ACK `{type:"ack", refSeq, ok:true|false, error?:{code,message,recoverable}}`.
- `postMessage` uses `location.origin`, never `'*'`.
- `parseSingleRoot` applies tag allow-list + attribute filter + `javascript:`/`data:text/html` strip + 256 KB cap.

---

## Error handling (target)

Three layers (ADR-014):

1. **Shell boundary** — `shellBoundary.report({kind, code, message, action?})` writes to single `#shellBanner` region.
2. **Bridge boundary** — structured ACKs from every handler (above).
3. **Iframe content boundary** — deck `<script>` errors caught + surfaced non-blocking as `previewHealthChip`.

All error codes are stable string constants in `constants.js`, fed to ADR-020 telemetry.

---

## Performance targets (measured, not estimated)

| Metric | v0.25.0 (estimated) | v1.0 target |
|---|---|---|
| Cold start (shell only) | 250–400 ms | ≤ 250 ms |
| Boot → first-select-possible | 500–1100 ms (20-slide deck) | ≤ 600 ms |
| First-select cost (20-element slide) | 15–25 ms | ≤ 10 ms |
| First-select cost (100-element slide) | 40–80 ms | ≤ 20 ms |
| History memory (20 × 700 KB) | ~14 MB | ≤ 2 MB (patch-based) |
| Rail rebuild per state change | full `innerHTML=""` | keyed diff, ~3–5 ms |
| Autosave write frequency | per-keystroke | debounced 250 ms |

Measurement harness: new `tests/perf/` suite runs against reference decks with `performance.now()` markers.

---

## Test pyramid (target)

```
          ┌──────────────┐
          │  Manual QA   │    (release-candidate only)
          └──────────────┘
          ┌──────────────┐
          │ Visual gate  │    ~40 screenshots · light + dark
          └──────────────┘
          ┌──────────────┐
          │ A11y gate    │    axe + keyboard + contrast
          └──────────────┘
        ┌──────────────────┐
        │ Cross-browser    │    firefox + webkit core journeys
        └──────────────────┘
     ┌────────────────────────┐
     │ Integration (Gate A/B) │   current 11 specs + 5 new
     └────────────────────────┘
  ┌──────────────────────────────┐
  │  Contract (bridge schema)    │   ADR-012 per-message validators replayed
  └──────────────────────────────┘
┌──────────────────────────────────┐
│  Unit tests (store, validators) │   NEW layer — pure functions from store/bridge
└──────────────────────────────────┘
```

Coverage goals:
- Bridge messages: 100% schema-validated in contract tests
- Store slices: 100% unit coverage on pure reducers
- Product journeys: 12/12 have at least one Playwright spec
- a11y: 0 WCAG AA violations on shell
- Flakes: `waitForTimeout` eliminated from specs (AUDIT-E §7)

---

## Security posture (target)

Minimum:

- `parseSingleRoot` sanitized (P0-02 fixed)
- `pptxgenjs` vendored (P0-03 fixed)
- Origin asserted on postMessage (P1-13 fixed)
- Crypto bridge token (P1-15 fixed)
- Autosave size capped (P1-14 fixed)
- All `innerHTML` sinks use `DOMBuilder` helper (P2-13 fixed)

Documented accepted risks (with ADR rationale):

- Iframe un-sandboxed for deck-engine JS (AUDIT-D-01 mitigated by Trust Banner ADR-014)
- CSP not applicable on file:// (AUDIT-D-10 informational)

CVSS-High findings outstanding: **0**.

---

## Developer experience (target)

- `git clone && npm install && npm start` boots editor on default browser. No build step.
- `npm run typecheck` runs `tsc --noEmit`. Editor IDE gets autocomplete from JSDoc.
- `npm run test:gate-a` — 3–5 min. Pre-commit contract.
- `npm run test:gate-a11y` — 2–3 min on shell only.
- `npm run test:gate-visual -- --update-snapshots` for intentional UI changes.
- Adding a bridge message: edit `bridge-schema.js` only (schema pushes to both sides).
- Adding a slice: edit `store.js` (auto-registers typedef, subscribers work).
- ESLint rule: `no-direct-state-assign` forbids `state.X = ...` outside store internals.

---

## What v1.0 is NOT

Explicitly out of scope at v1.0:

- Live collaboration (ADR-017 readiness only — no transport)
- Full plugin API (ADR-016 Layer 2 deferred)
- Mobile-first editing (ADR-018 — review-only on tablet)
- Cloud sync / server mode
- Multi-tenant / multi-user
- Cloud analytics (only local telemetry per ADR-020)

---

## Links
- [AUDIT-A — architecture](AUDIT-A-architecture.md)
- [PAIN-MAP](PAIN-MAP.md)
- [EXECUTION_PLAN](../EXECUTION_PLAN_v0.26-v1.0.md)
- [ARCH — Current vs Target](ARCH-current-vs-target.md)
- [ROADMAP_NEXT](../ROADMAP_NEXT.md)
- ADR-011 through ADR-020
