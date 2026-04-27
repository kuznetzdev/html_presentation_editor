# V2.0 REDESIGN — MASTER PLAN

> **Single source of truth** for any agent working on the
> `kuznetzdev/html_presentation_editor` v1.0.3 → v2.0.0 redesign trajectory.
>
> **If you were just asked "continue the redesign" or "work on v2":**
> read this file top-to-bottom, then jump to §4 and find the first phase
> marked `🔵 pending`. Execute that phase, then move to the next. Never
> skip phases — each one sets foundation for the next.
>
> **Authored:** 2026-04-23 (Phase A ship day)
> **Supersedes:** ad-hoc redesign notes in Daily logs

---

## Table of contents

0. [Purpose & scope](#0-purpose--scope)
1. [Non-negotiable invariants](#1-non-negotiable-invariants)
2. [Current state (update each release)](#2-current-state-update-each-release)
3. [Skill protocol — what to invoke when](#3-skill-protocol--what-to-invoke-when)
4. [Phase-by-phase execution plan](#4-phase-by-phase-execution-plan)
5. [Commit rhythm & versioning](#5-commit-rhythm--versioning)
6. [User journey — end-state (v2.0)](#6-user-journey--end-state-v20)
7. [Error handling architecture — end-state](#7-error-handling-architecture--end-state)
8. [Architecture contracts — v2.0 must-hold](#8-architecture-contracts--v20-must-hold)
9. [Test matrix end-state](#9-test-matrix-end-state)
10. [Continuation prompt (for next agent session)](#10-continuation-prompt-for-next-agent-session)
11. [Done criteria](#11-done-criteria-v200-ships-when)

---

## 0. Purpose & scope

Transform v1.0.x (functional "engineering-grade" HTML presentation editor)
into v2.0.0 — a polished no-code editor that:

- Handles **any** HTML presentation (Reveal, Impress, Spectacle, Marp, Slidev, MSO-PPTX, Canva, Notion, generic). Smart Import Pipeline v2 → 90%+ editability.
- Exports to PPTX with ≥ 85% fidelity (positions, fonts, gradients, SVG shapes).
- Exports clean HTML (no `data-editor-*` artifacts).
- Has a Figma/PSD-like persistent Layers panel with tree-view + DnD + rename + group.
- Ships two polished themes (light + dark) with elevation system, consistent SVG icons, motion hierarchy.
- Supports PowerPoint-like direct manipulation: multi-select, alignment toolbar, opacity slider, rotate handle, keyboard shortcuts.
- Provides progressive disclosure (basic/advanced toggle retained as preference, but sections appear contextually).
- Catches every user error with rollback (user-action boundary).
- Passes expanded a11y gate (keyboard-only full workflow).

**Target:** ~40 engineering days from 2026-04-23. Parallelizable C + D → ~35 days realistic.

**In scope:** client-side editor, file:// offline-first, vanilla JS classic-script architecture.

**Out of scope (deferred):**
- Live CRDT collaboration (ADR-017 readiness only)
- Plugin marketplace (ADR-016 L2)
- Mobile-first editing (ADR-018 — tablet is review-only honest-block)
- Cloud sync (ADR-028 opt-in, v3.x)
- Server-side rendering (permanently rejected — zero-server invariant)

---

## 1. Non-negotiable invariants

These cannot be violated at any point in any phase. Gate-A enforces most.

### Code invariants (CLAUDE.md §8)

| # | Invariant | Source | How enforced |
|---|---|---|---|
| I-01 | Zero `type="module"` in any `<script>` tag | ADR-015 | grep check; breaks file:// |
| I-02 | No bundler / no build step | ADR-015 | `npm start` is node + static server only |
| I-03 | `init()` is the last and only statement in `main.js` | CLAUDE.md §8 | P1-08 closed v0.29.4; Read main.js |
| I-04 | `@layer` declaration is first non-comment line in `tokens.css` | ADR-002 | Manual check per edit |
| I-05 | Shell↔iframe bridge architecture untouched | SOURCE_OF_TRUTH | bridge-script.js changes require Test C regression |
| I-06 | Gate-A never red before commit | CLAUDE.md §2 | `npm run test:gate-a --project=chromium-desktop` before every commit |
| I-07 | `git diff --staged` reviewed before commit | CLAUDE.md §5 | Manual |
| I-08 | Vault writes only via `obsidian-markdown` skill | CLAUDE.md §3 | Skill invocation |

### UX invariants (SOURCE_OF_TRUTH.md)

| # | Invariant |
|---|---|
| UX-01 | No dead ends — every blocked action has a resolution path |
| UX-02 | Shell theme resolves before first paint (FOUC-free) |
| UX-03 | Preview = runtime truth |
| UX-04 | Recoverability via undo, redo, autosave |
| UX-05 | Shell UI stays outside presentation content (no shell DOM leaks into iframe) |
| UX-06 | Export stays clean (no `data-editor-*` artifacts) |
| UX-07 | `iframe + bridge + modelDoc` architecture is the fixed contract |

### New invariants added by v2 trajectory

| # | Invariant | Phase added |
|---|---|---|
| V2-01 | Layers panel visible in both basic + advanced modes | B3 (v1.1.3) |
| V2-02 | All tokens v3 (elevation, motion) consumed through semantic names, not raw primitives | C (v1.3.0) |
| V2-03 | Every mutation wrapped in user-action-boundary with snapshot rollback | E (v2.0.0) |
| V2-04 | SVG icons currentColor — auto-adapts to theme | C (v1.3.0) |
| V2-05 | Smart Import report modal always shown after load (unless user dismisses permanently) | B6 (v1.2.0) |
| V2-06 | PPTX export pre-flight report always shown before download | D (v1.4.0) |
| V2-07 | Every destructive action has Undo toast with ≥ 5s TTL | E (v2.0.0) |
| V2-08 | Every input validated at boundary (numeric, URL, hex, CSS-length) | E (v2.0.0) |
| V2-09 | `:focus-visible` ring consistent across every interactive surface | C (v1.3.0) |
| V2-10 | No feature flag in "half-enabled" state at any release tag (either off/on, not mixed) | All |

---

## 2. Current state (update each release)

### Shipped milestones

| Tag | Date | Phase | Commit | Gate-A | Summary |
|---|---|---|---|---|---|
| v1.0.0 | 2026-04-22 | GA | e4408d1 | 65/5/0 | Road to v1.0 complete |
| v1.0.1 | 2026-04-22 | Fix | 5ed5b51 | 65/5/0 | Foreign deck compat — CSS overrides |
| v1.0.2 | 2026-04-22 | Fix | 2b69051 | 65/5/0 | Single-slide view for own-visibility decks |
| v1.0.3 | 2026-04-22 | Fix | 1a0beba | 65/5/0 | pointer-events regression |
| **v1.1.0** | **2026-04-23** | **A** | **4691253** | **65/5/0** | **Phase A Foundation — tokens v3, feature flags, 7 ADRs** |
| v1.1.1 | 2026-04-23 | B1 | 2a917fc | 65/5/0 | Split-pane scaffold (dormant) |
| v1.1.2 | 2026-04-23 | Docs | 2435c33 | 65/5/0 | V2-CONTINUATION-PROMPT for fresh agent sessions |
| v1.1.3 | 2026-04-23 | B2 | 162c7e4 | 65/5/0 | #layersRegion shell region + dual-render (dormant) |
| v1.1.4 | 2026-04-23 | B3 | 3d33124 | 65/5/0 | Flip defaults to v2 layout — first UX change |
| v1.1.5 | 2026-04-24 | B4 | 6eb2059 | 75/5/0 | Tree view for layers (+10 specs) |
| v1.1.6 | 2026-04-24 | B5 | e292792 | 85/5/0 | Inline rename + layer-row context menu (+10 specs) |
| v1.2.0 | 2026-04-24 | B6 | eec28f9 | 102/5/0 | Smart Import Pipeline v2 (+17 specs) |
| v1.2.1 | 2026-04-24 | C1 | 00c2a70 | 102/5/0 | SVG icon sprite scaffold + layer-panel usage |
| v1.2.2 | 2026-04-24 | C2 | 5f0b116 | 102/5/0 | focus-visible ring + motion tokens on touched surfaces |
| v1.3.0 | 2026-04-24 | C3 | 75de4a3 | 102/5/0 | visual baseline refresh + reduce-motion (×2 themes) |
| v1.3.1 | 2026-04-24 | D1 | 63582f7 | 110/5/0 | multi-select coordination (+8 specs) |
| v1.3.2 | 2026-04-24 | D2 | 6fa816d | 120/5/0 | alignment toolbar (+10 specs) |
| v1.3.3 | 2026-04-24 | D3 | 4ae792e | 129/5/0 | opacity + rotate APIs (+9 specs) |
| v1.3.4 | 2026-04-24 | D4 | c713c1e | 136/5/0 | PPT-style shortcuts (Ctrl+G, Ctrl+Shift+G/↑/↓) (+7 specs) |
| v1.4.0 | 2026-04-24 | D5 | 6faf61c | 147/5/0 | PPTX Fidelity v2 helpers (font/svg/gradient/preflight) (+11 specs) |
| v1.4.1 | 2026-04-24 | E1 | 428d4d9 | 147/5/0 | Inspector mode-toggle copy refresh (Простой/Полный) |
| v1.4.2 | 2026-04-24 | E2 | bc544f6 | 160/5/0 | user-action-boundary + input-validators (+13 specs) |
| v1.4.3 | 2026-04-24 | E3 | f2c6921 | 168/5/0 | onboarding v2 + aria-live surfaces (+8 specs) |
| v1.5.0 | 2026-04-24 | Hardening | 9b84a57 | 176/5/0 | Validators wired + experimental badges (+8 specs) |
| v1.5.1 | 2026-04-24 | Hardening | 48992a0 | 181/5/0 | Deck health badge + action-boundary on slide ops (+5 specs) |
| v1.5.2 | 2026-04-24 | Hardening | 5ea40a6 | 187/5/0 | Undo toast + onboarding wired + boundary on duplicate/delete (+6 specs) |
| v1.5.3 | 2026-04-24 | Hardening | e9d5a72 | 219/5/0 | Bridge schema strictness + 10-deck import corpus (+32 specs) |
| v1.5.4 | 2026-04-24 | Hardening | 4b047f8 | 232/5/0 | Golden export contract + recovery scenarios (+13 specs) |
| v1.5.5 | 2026-04-24 | Hardening | 354d37f | 242/5/0 | Long-session sync + docs-sync gate (+10 specs) |
| **v2.0.0** | **2026-04-24** | **GA** | 7c93262 | **242/8/0** | **General Availability — see docs/RELEASE-v2.0.md** |
| v2.0.1 | 2026-04-24 | Release integrity | ca86dff | 248/8/0 | SoT + README drift fix + POST_V2_ROADMAP + docs-sync gate strengthened |
| v2.0.2 | 2026-04-24 | Polish + recovery | de5abc3 | 253/8/0 | Settings→Reset + empty-state animation + asset-parity fix + gate-a11y Windows env + F2 flake |
| v2.0.3 | 2026-04-24 | Critical UX fix | cd40b0e | 253/8/0 | Empty-state v2 grid collapse + split-pane fr calc + tree-indent cap (+7 visual baselines refreshed) |
| v2.0.4 | 2026-04-24 | Modal fix | d263b3e | 254/8/0 | Import-report modal opacity + dark-theme readability + opacity regression test |
| v2.0.5 | 2026-04-24 | Layer panel UX | 0d04386 | 254/8/0 | Icons-on-left grid fix + label readability + dead hover/active restore + hidden-chip dark-theme |
| v2.0.6 | 2026-04-24 | Layer panel declutter | 779670a | 254/8/0 | Remove inline z-input (redundant with inspector) + Текущий chip (redundant with is-active) |
| v2.0.7 | 2026-04-24 | Selection rings polish | c7d5728 | 254/8/0 | Beefier outline + halo for selected/hover/ghost, locked cursor, opacity-test flake hardened |
| v2.0.8 | 2026-04-24 | Click-blocked toast | b927564 | 260/8/0 | Bridge → shell `click-blocked` message + contextual toast (locked/protected/unknown) + 1.5s throttle + 6 specs |
| v2.0.9 | 2026-04-24 | Shortcut discovery hints | 35ce9b5 | 266/8/0 | Contextual one-shot toasts on first overlap-cycle / multi-select / alt-click + 6 specs |
| v2.0.10 | 2026-04-24 | W/H in basic mode | d6e93ef | 273/8/0 | Geometry section root no longer advanced-only; W/H BASIC-visible; display/position/z/X/Y stay advanced + 7 specs |
| v2.0.11 | 2026-04-24 | Inspector empty-state hint | aa4d685 | 278/8/0 | Persistent guidance card in #insertSection answering "how do I edit what's already here?" + 5 specs |
| v2.0.12 | 2026-04-24 | DRY: model-query helpers | 075f9a9 | 278/8/0 | findModelNode + findModelSlide in dom.js, 31 call sites collapsed across 12 files; transform-resolve.spec.js fill+Tab flake hardened |
| v2.0.13 | 2026-04-26 | Audit fixes (security + contract) | f252320 | 289/8/0 | Closes BUG-001 (contract drift) + SEC-001/002/003 (cssText, update-attributes URL, replace-image-src URL) + SEC-005 (3 unregistered msg types) + BUG-003 (gate-visual port) + ARCH-003 (runtime-warn target). 11 new security specs. gate-contract 149/3 → 152/0 |
| v2.0.14 | 2026-04-25 | SEC-004 inbound schema validation | d8114e0 | 298/8/0 | Closes SEC-004: every inbound bridge message (except hello, which keeps bespoke UX) is now schema-validated via `BRIDGE_SCHEMA.validateMessage` before dispatch. `Object.create(null)` flatten blocks prototype-keyed payload smuggling. 9 new specs. Phase 1 of 9 polish phases driving v2.0.13 → public-GA quality |
| v2.0.15 | 2026-04-25 | SEC-006 proto-pollution hardening | 4200f3c | 306/8/0 | Closes SEC-006: 3 slide-keyed dicts on `state` (`slideRegistryById`, `slideSyncLocks`, `lastAppliedSeqBySlide`) are now `Object.create(null)`; registry write site rejects `__proto__`/`constructor`/`prototype` slide IDs; iframe `findSlideById()` adds matching guard. Fixture + 8 specs. Phase 2 of 9 |
| v2.0.16 | 2026-04-25 | A11Y-001 contrast + nesting fixes | 7eb48f4 | 306/8/0 | Closes A11Y-001 (color-contrast + nested-interactive). `--shell-text-muted` alpha 0.6 → 0.78 (~5.5:1); `.is-suggested` mode toggle gets `color-mix` darker accent (~6.5:1); slide-rail `role=button` → `role=listitem` with `role=list` parent; overlap chip drops role+tabindex; layers tree action buttons hoisted to sibling of `<summary>`. Gate-a11y 25+2-masked → 27/0/0. Phase 3 of 9 |
| v2.0.17 | 2026-04-25 | Performance budget tests | 8255b3f | 311/8/0 | New fixtures: `perf-200elem.html` (200 absolute divs in 1 slide) + `perf-50slides-30elem.html` (1500 nodes). New spec `perf-budget.spec.js` (5 tests): click-to-select p50/p95 latency, heap delta after 200 mutation cycles, selection-engine smoke, fixture sanity. Observed perf: p50≈17ms / p95≈100ms / heap delta ≈ 0MB. Phase 4 of 9 |
| v2.0.18 | 2026-04-25 | file:// origin BO3 automated | e26a4eb | 313/8/0 | Closes FLAKE-002. New spec `bridge-file-origin.spec.js` launches its own `chromium.launchPersistentContext` (no baseURL) so the editor loads via real `file://` URL. Asserts `getAllowedBridgeOrigins()` contains "null", workflow reaches empty, no origin-rejection diagnostic. BO3 in `bridge-origin.spec.js` no longer `test.skip`. Phase 5 of 9 |
| v2.0.19 | 2026-04-25 | PPTX export e2e roundtrip + Beta-badge removed | ea744e6 | 315/8/0 | Closes FN-001. New spec `pptx-export-roundtrip.spec.js` (2 tests): captures download, unzips via adm-zip, asserts 3 slide XML files + `<a:t>` text runs in slide1. Beta badge removed from `#exportPptxBtn` (legacy export is verified). adm-zip added as devDep. Phase 6 of 9 |
| v2.0.20 | 2026-04-25 | CI workflows: gate-A on every PR + gate-secondary nightly | 6929c53 | 315/8/0 | New `.github/workflows/gate-a.yml` (typecheck + unit + gate-contract + gate-a matrix Node 18/20/22; Playwright browsers cached) + `gate-secondary.yml` (nightly + manual: gate-B/C/D/E/A11Y/Visual). Phase 7 of 9 |
| v2.0.21 | 2026-04-25 | Pre-commit syntax guard | (pending) | 315/8/0 | New `scripts/precommit-bridge-script-syntax.js` runs `node --check` on 11 hot editor JS files (bridge-script.js most critical — 3,800 LOC template literal). Wired as first step of `npm run test:gate-a` + exposed as `npm run precommit`. waitForTimeout flake-sweep deferred to v2.1.0 (71 instances; needs bespoke per-call rewrites). Phase 8 of 9 |

### Current baseline (as of 2026-04-23)

- **Branch:** `main` at `v1.1.0` (plus in-progress B1 staged)
- **Gate-A:** 65 passed / 5 skipped / 0 failed (chromium-desktop)
- **Typecheck:** clean
- **Node modules:** 25 JS → planned ~40 by v2.0
- **CSS layers:** 8 → planned 12 by v2.0
- **ADRs:** 001..037 (7 new for v2 redesign)
- **Feature flags (default state in v1.1.x):**
  - `layoutVersion: "v1"` (v2 layout dormant)
  - `layersStandalone: false`
  - `treeLayers: false`
  - `multiSelect: false`
  - `pptxV2: false`
  - `smartImport: "off"`
  - `svgIcons: false`

### ADR index (new in v2 trajectory)

- ADR-031 Persistent Layers Panel — status: proposed
- ADR-032 Workspace Layout v2 (Figma split-pane) — proposed
- ADR-033 Theme System v3 — proposed
- ADR-034 Layer Tree DnD — proposed
- ADR-035 Smart Import Pipeline v2 — proposed (extends ADR-026)
- ADR-036 PPTX Fidelity v2 — proposed (extends ADR-025)
- ADR-037 UX Progressive Disclosure & Error Recovery — proposed

Statuses flip to `Accepted` as each ADR's code ships (not when the ADR is written).

---

## 3. Skill protocol — what to invoke when

### Pre-flight (every session start)

```
1. Read this file (V2-MASTERPLAN.md) to current state
2. Read docs/SOURCE_OF_TRUTH.md (invariants)
3. Read docs/CHANGELOG.md (last 3 entries)
4. Read obsidian/html_presentation_editor/AGENT-SYSTEM-INSTRUCTION.md
5. git status -s    → expect clean or expected WIP
6. git log --oneline -5
7. npm run test:gate-a -- --project=chromium-desktop --reporter=dot 2>&1 | tail -5
   → confirm baseline passing before any change
```

### Skills by task type

| Task | Invoke (in order) |
|---|---|
| Write code (JS)     | `cc-skill-backend-patterns` → (do work) → `simplify` → `code-review-excellence` |
| Write code (CSS)    | `cc-skill-frontend-patterns` → (do work) → `simplify` |
| Write/extend ADR    | `architecture-decision-records` → (write) → `obsidian-markdown` |
| Write Playwright    | `playwright-skill` → (write test) → run → `simplify` |
| Debug Gate-A red    | `systematic-debugging` → diagnose → fix → `code-review-excellence` |
| Diagram in ADR      | `mermaid-expert` |
| Commit              | `commit` (conventional commits + Co-Authored-By trailer) |
| Push                | `git-pushing` |
| Vault write         | `obsidian-markdown` (ALWAYS first for any vault file change) |
| Optimize prompts    | `prompt-engineer` or `prompt-engineering-patterns` (for continuation docs) |
| API integration     | `claude-code-expert` or `claude-api` (if adding AI features, v3+) |
| Security review     | `security-auditor` or `cc-skill-security-review` |
| A11y audit          | `accessibility-specialist` or `accessibility-compliance-accessibility-audit` |
| Performance         | `performance-engineer` or `react-performance-optimization` |
| Refactor            | `code-refactoring-refactor-clean` |

### Don't invoke

- `agent-expert` (meta-agent, not needed for feature work)
- Framework-specific agents not matching our stack (React/Angular/Vue/etc.)

---

## 4. Phase-by-phase execution plan

Each phase has sub-commits. Each sub-commit = separate tag (semver) + push. Never batch.

### Phase A — Foundation · 🟢 DONE (v1.1.0, 2026-04-23)

**Shipped:** tokens v3 (elevation/motion), feature flags registry, 7 ADRs, layers-region CSS layer, PROJ - v2.x Redesign.

---

### Phase B — Layers First-Class + Smart Import v2 · 🟡 IN PROGRESS

**Target tags:** v1.1.1 → v1.1.2 → v1.1.3 → v1.1.4 → v1.1.5 → v1.2.0

#### B1 — Split-pane scaffold (v1.1.1) · 🟡 current

Deliverables:
- `editor/styles/split-pane.css` — grid rules scoped to `body[data-layout-version="v2"]`
- `editor/src/left-pane-splitter.js` — pointer/keyboard resizer with localStorage persist
- `editor/src/shell-layout.js` — `applyLayoutVersionAttribute` + `applyLayersStandaloneAttribute` helpers
- `editor/src/boot.js` — `init()` calls body-attr helpers + `initLeftPaneSplitter()`
- `@layer split-pane` added to declaration in tokens.css
- `presentation-editor.html` — link CSS + script

Done when: Gate-A 65/5/0, commit `feat(layout): split-pane scaffold — v1.1.1`, tag v1.1.1, pushed.

#### B2 — #layersRegion shell region (v1.1.2)

Deliverables:
- Add `<aside id="layersRegion" hidden>` inside `<main class="workspace">` between slidesPanel and mainPreviewPanel
- Wrap `#slidesPanel` + `#layersRegion` in `<div class="left-pane-wrapper">` (conditional via feature flag — see approach below)
- `layers-panel.js`: modify `renderLayersPanel()` to choose target container based on `featureFlags.layersStandalone`
- Clone `#layersInspectorSection` markup structure into `#layersRegion` (pre-wired IDs: `layersListContainer` stays ONE element — move between containers when flag flips, don't duplicate ID)
- Keep `#layersInspectorSection` in inspector — gets `hidden` when flag on

**Approach for layersListContainer (one ID, two possible parents):**
```javascript
function ensureLayersContainerPlacement() {
  const standalone = window.featureFlags.layersStandalone;
  const container = document.getElementById('layersListContainer');
  const targetParent = standalone
    ? document.getElementById('layersRegion')
    : document.getElementById('layersInspectorSection');
  if (container && targetParent && container.parentElement !== targetParent) {
    targetParent.appendChild(container);
  }
}
```
Called on `init()` + flag change.

Done when: Gate-A 65/5/0, flag-flip test verifies layers render in region, commit+tag v1.1.2.

#### B3 — Flip defaults (v1.1.3) — first visible UX change

Deliverables:
- `feature-flags.js` DEFAULT_FLAGS: `layoutVersion: "v2"`, `layersStandalone: true`, `layersBasicVisible: true` (new)
- Remove `data-ui-level="advanced"` from #layersRegion (keep on individual advanced actions — normalizeLayersBtn, node IDs)
- Update CHANGELOG entry, Daily, PROJ
- Update 15 visual regression snapshots (record new v2 layout baselines)

Done when: Gate-A 65/5/0, gate-visual updated, commit+tag v1.1.3.

#### B4 — Tree view (v1.1.4)

Deliverables:
- `layers-panel.js`: replace flat list render with tree via `<details>`
- Tree based on DOM hierarchy (not z-order)
- Collapse/expand with arrow indicator
- Roving tabindex for keyboard nav
- ADR-034 compliance

Done when: Gate-A 65/5/0, new spec `tests/playwright/specs/layers-tree-nav.spec.js` (≥ 10 tests), commit+tag v1.1.4.

#### B5 — Inline rename + context menu (v1.1.5)

Deliverables:
- Double-click layer label → `<input>` inline edit
- `data-layer-name` attribute (preserved on export, not stripped)
- Right-click menu: Rename / Duplicate / Delete / Group / Ungroup / Bring forward / Send backward / Lock / Hide
- Use existing context-menu.js patterns

Done when: Gate-A 65/5/0, commit+tag v1.1.5.

#### B6 — Smart Import Pipeline v2 (v1.2.0) — major feature, minor bump

Deliverables:
- `editor/src/import-pipeline-v2/` directory:
  - `index.js` — orchestrator
  - `detectors.js` — 8 framework detectors (reveal/impress/spectacle/marp/slidev/mso-pptx/canva/notion/generic)
  - `inference.js` — 4 slide strategies (explicit/h1-split/viewport/page-break)
  - `normalize.js` — data-editor-* injection, original-* preservation
  - `complexity.js` — 0-10 scoring
  - `report.js` — builds preprocessing report object
- `editor/src/import-report-modal.js` — UI surface
- `editor/styles/import-report-modal.css` — modal styles
- Feature flag `smartImport` default flip to `"report"`
- Test corpus: `tests/fixtures/import-corpus/` — 12 reference decks (3 per category: reveal, generic, mso, canva)
- Spec: `tests/playwright/specs/import-pipeline-v2.spec.js` — ≥ 20 tests

Done when: Gate-A ≥ 90/5/0 (added ~20), corpus gate ≥ 90% editable, commit+tag v1.2.0.

---

### Phase C — Theme Polish · 🔵 pending

**Target tags:** v1.2.1 → v1.2.2 → v1.3.0

#### C1 — SVG icon sprite (v1.2.1)

Deliverables:
- `editor/icons/icons.svg.js` — inline sprite generator at boot
- ~150 icons: topbar (theme, undo, redo, open, export, present), empty state, inspector buttons, floating toolbar, context menu, slide rail templates, layer panel (disclosure, lock, eye, group, duplicate)
- Icon naming: `i-{semantic-name}` (kebab-case)
- Usage helper: `<svg class="icon"><use href="#i-theme-toggle"/></svg>`
- `editor/styles/icons.css` — sizing + color via currentColor
- Feature flag `svgIcons` default flip to `true`
- Replace emoji usages in shell HTML (150 replacements across presentation-editor.html)

Done when: Gate-A ≥ 90/5/0, gate-visual ×2 themes passes, commit+tag v1.2.1.

#### C2 — Elevation + state tokens applied (v1.2.2)

Deliverables:
- Audit all `box-shadow:` in CSS files, replace with semantic shadow tokens (`--shadow-panel/floating/modal/pressed`)
- Audit all `:hover` / `:active` selectors, use `--state-hover` / `--state-hover-strong` / `--state-active`
- Apply `:focus-visible` ring formalized in base.css (ADR-033 contract)
- Motion: replace hardcoded `transition: NNms` with `--motion-micro/base/emphasis`

Done when: Gate-A ≥ 90/5/0, gate-a11y ≥ 35/0 (focus-ring coverage added), commit+tag v1.2.2.

#### C3 — Visual regression ×2 themes (v1.3.0)

Deliverables:
- Duplicate all 15 gate-visual snapshots for `[data-theme="dark"]` → 30 total
- Update `playwright.visual.config.js` to loop themes
- Verify AAA contrast on text (manual + axe-color-contrast rule)
- Motion-reduce: `@media (prefers-reduced-motion)` disables non-essential animations

Done when: gate-visual 30/0/0, commit+tag v1.3.0.

---

### Phase D — Direct Manipulation + PPTX v2 · 🔵 pending

**Target tags:** v1.3.1 → v1.3.2 → v1.3.3 → v1.3.4 → v1.4.0

#### D1 — Multi-select state (v1.3.1)

Deliverables:
- `editor/src/multi-select.js` — new module
- Extend `state.selection` with `multiple: []`, `anchor: nodeId`
- Shift+click toggles, Ctrl+A selects all on slide
- Combined bounding-box overlay (use selection.js primitives)
- Deselect on Escape or click-empty
- Feature flag `multiSelect` default flip to true

Done when: Gate-A ≥ 100/5/0, spec `multi-select.spec.js` (≥ 15 tests), commit+tag v1.3.1.

#### D2 — Alignment toolbar (v1.3.2)

Deliverables:
- `editor/src/alignment-toolbar.js` — module
- 6 align (L/C/R/T/M/B) + 2 distribute (H/V)
- Shows when `state.selection.multiple.length >= 2`
- Keyboard: Ctrl+Shift+L/E/R/T/M/B + Ctrl+Shift+H/V
- `editor/styles/alignment-toolbar.css`

Done when: Gate-A ≥ 100/5/0, commit+tag v1.3.2.

#### D3 — Opacity slider + rotate handle (v1.3.3)

Deliverables:
- Opacity slider inside floating toolbar (new control); writes to `opacity` CSS
- On-canvas rotate handle (24px above bounding box), drag → sets `transform: rotate(Ndeg)`
- ADR-004 block-reason "own-transform" gets `Сбросить поворот` action
- Keyboard: Shift+R cycle 15°/45°/90°

Done when: Gate-A ≥ 100/5/0, commit+tag v1.3.3.

#### D4 — Keyboard shortcuts PPT-style (v1.3.4)

Deliverables:
- `shortcuts.js` KEYBINDINGS registry extended:
  - Ctrl+D — duplicate
  - Ctrl+G — group selection
  - Ctrl+Shift+G — ungroup
  - Alt+drag — clone while dragging
  - Arrow+Shift — 10px step (was 1px)
  - Ctrl+Shift+Up/Down — bring forward / send backward
- Shortcuts modal updated (auto-rendered from registry)

Done when: Gate-A ≥ 100/5/0, commit+tag v1.3.4.

#### D5 — PPTX Fidelity v2 (v1.4.0) — major feature

Deliverables:
- `editor/src/export-pptx/` directory:
  - `index.js` — orchestrator (replaces `exportPptx` in export.js)
  - `position-resolver.js` — getBoundingClientRect based
  - `svg-shapes.js` — SVG → PPTX shape mapping (rect, circle, triangle; fallback rasterize)
  - `gradients.js` — CSS linear-gradient → PPTX gradient
  - `font-fallback.js` — ~30 webfont → PPTX system font map
  - `preflight.js` — builds export report
  - `validator.js` — post-export JSZip check
- `editor/src/export-preflight-modal.js` — UI
- `editor/styles/export-preflight-modal.css`
- Feature flag `pptxV2` default flip to true
- Test corpus: `tests/fixtures/export-corpus/` — 5 reference decks
- Manual QA checklist in `docs/PPTX_QA_CHECKLIST.md`

Done when: Gate-A ≥ 115/5/0, PPTX manual QA on 5 decks ≥ 85% fidelity, commit+tag v1.4.0.

---

### Phase E — Progressive Disclosure + A11y + Error Recovery · 🔵 pending

**Target tags:** v1.4.1 → v1.4.2 → v1.4.3 → v2.0.0

#### E1 — Contextual inspector sections (v1.4.1)

Deliverables:
- Migrate 19 `data-ui-level="advanced"` attrs to `data-entity-groups` where semantic (images, text, shapes)
- Keep `data-ui-level="advanced"` only for: HTML editing, raw node IDs, diagnostics, telemetry viewer
- Add `state.ui.sectionCollapse` persistence
- Mode toggle relabel: "Быстро/Точно" → "Простой/Полный"

Done when: Gate-A ≥ 115/5/0, commit+tag v1.4.1.

#### E2 — Error recovery layers 4-5-6 (v1.4.2)

Deliverables:
- `editor/src/user-action-boundary.js` — Layer 4 (rollback to snapshot on fail)
- `editor/src/input-validators.js` — Layer 5 (pixel-size, opacity, url, hex-color, css-length)
- Update `getBlockReasonAction()` in feedback.js — all 8 reasons now return actionable button
- Destructive action audit — all delete/ungroup/replace use Undo toast

Done when: Gate-A ≥ 120/5/0, commit+tag v1.4.2.

#### E3 — Onboarding v2 + a11y gate expansion (v1.4.3)

Deliverables:
- `editor/src/onboarding-v2.js` — 3 first-session hint bubbles
- Reset-onboarding setting (Settings → Reset)
- Empty-state welcome card CSS animation (2s loop)
- Keyboard-only full workflow:
  - Slide rail: ArrowUp/Down + Alt+ArrowUp/Down reorder
  - Preview: Tab enters → first element; Arrow cycles; Shift+Tab ascends
  - `aria-live` on #saveStatePill, #previewLoading
- gate-a11y expanded to ≥ 50 tests (keyboard-only full journey)

Done when: gate-a11y ≥ 50/0, Gate-A ≥ 120/5/0, commit+tag v1.4.3.

#### E4 — v2.0.0 GA (ceremony)

Deliverables:
- Package version 1.4.3 → 2.0.0
- All 7 ADRs status → Accepted (vault + repo)
- `docs/CHANGELOG.md` → full v2.0.0 consolidation
- `docs/RELEASE-v2.0.md` — release notes
- Vault: archive PROJ - v2.x Redesign (status completed), new PROJ - v2.x Maintenance
- GitHub release drafted
- Tag v2.0.0 pushed

Done when: Gate-F full matrix green, commit+tag v2.0.0, GitHub release published.

---

## 5. Commit rhythm & versioning

### Semver discipline

- **MAJOR** bump (x.0.0): only at v2.0.0 (user-visible paradigm shift via Phase E complete).
- **MINOR** bump (1.x.0): per phase-completing user-visible feature (v1.2.0 = Smart Import, v1.3.0 = themes polished, v1.4.0 = PPTX v2). Also v1.1.0 was Phase A foundation (visible via feature flag tooling).
- **PATCH** bump (1.x.y): per sub-commit within a phase. Internal refactors that don't flip user behavior.

### Commit message format (conventional commits + trailer)

```
<type>(<scope>): <short description> — v<X.Y.Z>

<multi-line body describing what / why / how>

Gate-A: <result>
Typecheck: <clean|N errors>
Related: ADR-NNN, PROJ-..., PAIN-MAP-...

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**Valid `<type>`:** feat, fix, refactor, style, test, docs, chore, perf, build, ci

**Valid `<scope>`:** arch, layout, layers, theme, import, export, selection, a11y, toolbar, rail, inspector, shell, bridge, compat, release, vault

### Tag format

Annotated tags (`-a`) with multi-line message summarizing release. Always push with `--tags`.

### Push protocol

Every logical unit:
```
1. git diff --staged  → review
2. npm run test:gate-a --project=chromium-desktop  → must pass
3. npm run typecheck  → must pass
4. git add <explicit files>  (never `git add .`)
5. git commit -m "<HEREDOC format>"
6. git tag -a vX.Y.Z -m "<message>"
7. git push origin main --tags
```

### What NOT to commit

- `.gitignore` changes (baseline, managed separately)
- Any `.obsidian/` workspace files
- `C:\Users\Kuznetz\Desktop\proga\obsidian\` — vault lives outside the repo
- `node_modules/`
- `*.log`, `*.tsbuildinfo`

---

## 6. User journey — end-state (v2.0)

### Stage 1 — First open (empty state)
User opens `editor/presentation-editor.html`. Sees:
- Welcome card with preview animation loop showing "click → drag → edit"
- 2 CTAs: `[Открыть HTML]` (primary) · `[Попробовать на примере]` (secondary)
- `[Дополнительно ▾]` disclosure: Paste HTML, Open Recent (if any)
- Shortcut hint: "Нажми `?` для списка горячих клавиш"
- Theme pre-applied (FOUC-free)

### Stage 2 — Load HTML
User selects file. Smart Import Pipeline v2 runs:
1. Sanitize (existing)
2. Framework detect → 95%+ confidence for known, 10% for generic
3. Slide inference (explicit → h1-split → viewport → page-break → single)
4. Editability normalize (inject data-editor-*, preserve original-*)
5. Complexity score 0-10

Preprocessing report modal shows:
```
Формат:  Reveal.js (95%)
Слайдов: 23 (strategy: explicit markers)
Элементов: 147
Сложность: 4/10
Предупреждения: 3 (transform, CDN fonts, inline script)
[Продолжить] [Настроить вручную ↗]
```

### Stage 3 — Preview mode
Iframe loads. Deck runs with native navigation. Breadcrumb "Слайд 5 / 23" visible. CTA `Начать редактирование` is primary.

### Stage 4 — Enter edit mode
First click: element selects, inspector opens contextually. First-session hint: "Клик — выбрать. Двойной клик — редактировать текст. Drag — двигать."

### Stage 5 — Editing loop (most time spent here)
- Click → select (single). Shift+click → multi-select.
- Drag → move (snap to siblings, smart guides with px distances).
- Resize handles (8 directions + rotate handle above bbox).
- Double-click text → inline edit.
- Floating toolbar: format, opacity slider, alignment (for multi), media actions.
- Inspector (right): contextual properties (text OR image OR shape sections).
- Layers panel (bottom-left): tree view, drag to reparent, rename inline, right-click menu.
- Slides rail (top-left): thumbnails, drag to reorder, Alt+↑↓ keyboard reorder.
- Ctrl+Z anytime. Autosaves per 250ms.
- Every action has rollback-on-fail.

### Stage 6 — Slide management
Add / duplicate / delete via rail context. Templates bar. Delete has Undo toast. Arrow-key nav in rail.

### Stage 7 — Layers & composition
Group (Ctrl+G) / ungroup (Ctrl+Shift+G). Lock/hide cascade. Inline rename. Z-order via tree drag. Visibility toggle.

### Stage 8 — Export
User clicks `Экспорт PPTX`:
1. Pre-flight report shows: slides, elements, losses (CSS filter, SVG rasterize), replacements (fonts), preserved (text, positions, gradients).
2. User confirms. Export runs (~1.5s on 23-slide deck).
3. Post-export validator: JSZip open, verify slide count + media count.
4. Download triggered. Toast: "PPTX выгружен. 23 слайда, 12 изображений, 5.3 MB."

For HTML export: clean output, `data-editor-*` stripped, `data-layer-name` preserved. Assets listed in report.

### Keyboard-only path (all steps accessible)

- Tab to focus shell, `?` for shortcuts
- Arrow nav in rail (roving tabindex)
- Tab into preview → first element focused
- Arrow cycles siblings, Tab descends, Shift+Tab ascends
- Space/Enter activates, F2 renames, Delete deletes (with Undo toast)
- Ctrl+G / Ctrl+Shift+G groups
- Alt+Arrow reorders slides
- All actions have aria-live announcements

---

## 7. Error handling architecture — end-state

### Six layers

1. **Shell boundary** (existing, ADR-014): `shellBoundary.report({kind, code, message, action})`
2. **Bridge boundary** (existing): structured ACKs `{ok, error?:{code, recoverable}}`
3. **Iframe content boundary** (existing): preview-health-chip
4. **User-action boundary** (new, Phase E2): `withActionBoundary(() => mutation)` with snapshot rollback
5. **Input validation** (new, Phase E2): VALIDATORS registry (pixel-size, opacity, url, hex, css-length)
6. **Recovery paths** (new, Phase E2): every `getBlockReason()` has actionable resolution button

### Error UX rules

- No silent failures. Every failed user action → toast with cause + action.
- Rollback for any mutation that partially succeeds.
- Validation errors: inline red border + tooltip, action button disabled.
- Destructive: Undo toast (6.2s TTL) — cover delete/ungroup/replace/paste-over/clear.
- Recovery banners: persistent until resolved (broken assets, trust banner).
- Modal errors: only for blocking failures (load corruption, export crash).

---

## 8. Architecture contracts — v2.0 must-hold

### Module structure (target v2.0.0)

```
editor/src/
  main.js                 (12 LOC — init() only)
  boot.js                 (~700 LOC — init + mode + complexity)
  theme.js                (FOUC-safe theme)
  zoom.js                 (preview zoom)
  shell-layout.js         (responsive + body attrs + layout version)
  left-pane-splitter.js   (Figma split-pane resizer — v2 only)
  store.js                (ADR-013 slices)
  state.js                (legacy state — migrating to store)
  constants.js
  entity-kinds.js         (ADR-016 L1)
  feature-flags.js        (registry + Proxy persist)
  bridge-schema.js
  bridge.js
  bridge-commands.js
  bridge-script.js
  preview.js
  onboarding.js
  onboarding-v2.js        (NEW — hint bubbles)
  dom.js
  shortcuts.js
  clipboard.js
  import.js               (orchestrator; delegates to pipeline-v2 when flag on)
  import-pipeline-v2/     (NEW dir — Smart Import)
    index.js
    detectors.js
    inference.js
    normalize.js
    complexity.js
    report.js
  import-report-modal.js  (NEW)
  slides.js
  slide-rail.js
  bridge-script.js
  style-app.js
  export.js               (thinner; delegates to pptx dir when flag on)
  export-pptx/            (NEW dir — PPTX Fidelity v2)
    index.js
    position-resolver.js
    svg-shapes.js
    gradients.js
    font-fallback.js
    preflight.js
    validator.js
  export-preflight-modal.js  (NEW)
  history.js
  feedback.js
  broken-asset-banner.js
  selection.js
  precision.js
  layers-panel.js         (extended — tree view, inline rename, context menu)
  multi-select.js         (NEW — Phase D)
  alignment-toolbar.js    (NEW — Phase D)
  floating-toolbar.js
  toolbar.js
  context-menu.js
  inspector-sync.js
  shell-overlays.js
  surface-manager.js
  banners.js
  user-action-boundary.js (NEW — Phase E)
  input-validators.js     (NEW — Phase E)
  telemetry.js
  icons/
    icons.svg.js          (NEW — Phase C)
```

**Expected JS module count v2.0:** ~40 (from 25).

### CSS structure (target v2.0.0)

```
editor/styles/
  tokens.css              (v3 tokens, @layer decl)
  base.css
  layout.css
  preview.css
  inspector.css
  layers-region.css       (NEW — Phase A scaffold, Phase B activated)
  split-pane.css          (NEW — Phase B)
  icons.css               (NEW — Phase C)
  alignment-toolbar.css   (NEW — Phase D)
  import-report-modal.css (NEW — Phase B)
  export-preflight-modal.css (NEW — Phase D)
  overlay.css
  modal.css
  broken-asset-banner.css
  banners.css
  onboarding.css
  precision.css
  responsive.css
```

**Expected CSS count v2.0:** ~15 (from 8).

**@layer declaration v2.0:**
```css
@layer banners, tokens, base, layout, preview, broken-asset-banner, layers-region, split-pane, inspector, precision, overlay, modal, icons, alignment-toolbar, import-report-modal, export-preflight-modal, responsive;
```

### State schema (target)

Store slices (ADR-013):
- `selection` — activeNodeId, activeSlideId, multiple[], anchor, overlapIndex, blockReason
- `history` — patches[], baseSnapshot, index, dirty
- `model` — doc, slides[], modelDirty
- `ui` — complexityMode, previewZoom, theme, compactMode, workflow, leftPaneSplit, sectionCollapse, onboardingSeen
- `bridge` — token, heartbeatAt, pendingSeq, protocol
- `telemetry` — sessionId, events[], enabled
- `import` — pipeline detector result, strategy, complexity, warnings

### Feature flags (target defaults at v2.0.0)

All flags default to v2 behavior:
- `layoutVersion: "v2"`
- `layersStandalone: true`
- `treeLayers: true`
- `multiSelect: true`
- `pptxV2: true`
- `smartImport: "full"` (uses pipeline-v2 as primary loader)
- `svgIcons: true`

User can opt out via devtools `window.featureFlags.X = "v1"` (persisted). Reset via `window.resetFeatureFlags()`.

---

## 9. Test matrix end-state

| Gate | v1.0.3 baseline | v2.0.0 target |
|---|---|---|
| gate-a (chromium-desktop) | 65/5/0 | ≥ 130/5/0 |
| gate-b (wider smoke) | 135/7/0 | ≥ 200/7/0 |
| gate-c (cross-browser) | 28/148/0 | ≥ 50/148/0 |
| gate-d (mobile/tablet) | 139/60/0 | ≥ 160/60/0 |
| gate-e (asset parity) | 3/0/0 | 3/0/0 |
| gate-f (full matrix) | 1410/629/0 | ≥ 2000/629/0 |
| gate-a11y | 27/0 | ≥ 50/0 |
| gate-visual | 15/0/0 | 30/0/0 (×2 themes) |
| gate-contract | 152/0 | ≥ 180/0 |
| gate-types | clean | clean |

### New spec files (v2.0.0)

- `tests/playwright/specs/layers-tree-nav.spec.js` — Phase B4
- `tests/playwright/specs/layers-rename.spec.js` — Phase B5
- `tests/playwright/specs/layers-context-menu.spec.js` — Phase B5
- `tests/playwright/specs/import-pipeline-v2.spec.js` — Phase B6
- `tests/playwright/specs/multi-select.spec.js` — Phase D1
- `tests/playwright/specs/alignment-toolbar.spec.js` — Phase D2
- `tests/playwright/specs/opacity-rotate.spec.js` — Phase D3
- `tests/playwright/specs/keyboard-shortcuts-ppt.spec.js` — Phase D4
- `tests/playwright/specs/pptx-fidelity-v2.spec.js` — Phase D5
- `tests/playwright/specs/error-recovery-boundary.spec.js` — Phase E2
- `tests/playwright/specs/onboarding-v2.spec.js` — Phase E3
- `tests/a11y/keyboard-only-full-journey.spec.js` — Phase E3

### Test fixtures corpus

- `tests/fixtures/import-corpus/` — 12 decks (3 per category × 4 categories) for smart import
- `tests/fixtures/export-corpus/` — 5 reference decks for PPTX fidelity manual QA

---

## 10. Continuation prompt (for next agent session)

> **Primary reference:** [docs/V2-CONTINUATION-PROMPT.md](./V2-CONTINUATION-PROMPT.md)
> (shipped in v1.1.2 — full Role-Task-Constraints-Examples-StopCriteria format
> with self-test instructions and prompt engineering rationale).
>
> The short version below is kept for quick inline reference. For a fresh
> session, paste the content between `---PROMPT-BEGIN---` / `---PROMPT-END---`
> markers in V2-CONTINUATION-PROMPT.md — it's the canonical version.

### Short inline version

```
You are continuing the v2.0 redesign of kuznetzdev/html_presentation_editor.

Step 1 — Context load (read these in order):
  a. docs/V2-MASTERPLAN.md (this file — primary source of truth)
  b. docs/SOURCE_OF_TRUTH.md (invariants)
  c. docs/CHANGELOG.md (last 3 entries)
  d. obsidian/html_presentation_editor/AGENT-SYSTEM-INSTRUCTION.md
  e. obsidian/html_presentation_editor/3-Projects/PROJ - v2.x Redesign.md

Step 2 — Baseline verification:
  a. git status -s → expect clean
  b. git log --oneline -5
  c. cat package.json | grep version → record current version
  d. npm run test:gate-a -- --project=chromium-desktop --reporter=dot 2>&1 | tail -5
     → must be passed; if red, STOP and invoke `systematic-debugging` skill

Step 3 — Find next work:
  a. Read §2 "Current state" of V2-MASTERPLAN
  b. Read §4 phase table, find first milestone marked 🔵 pending or 🟡 in progress
  c. If 🟡: resume from deliverables checklist
  d. If 🔵: start that phase per §4 deliverables

Step 4 — Execute (per §3 skill protocol):
  a. Invoke pre-flight skills
  b. Make changes incrementally (one logical unit at a time)
  c. Between units: gate-a + typecheck must pass
  d. Commit + tag + push per §5 rhythm

Step 5 — Update docs:
  a. Update V2-MASTERPLAN §2 current state after each tag
  b. Update docs/CHANGELOG.md per release
  c. Update obsidian/Daily/YYYY-MM-DD.md per session (via obsidian-markdown skill)
  d. Flip ADR status → Accepted when the code for that ADR ships

Step 6 — Stop criteria:
  - If user interrupts, ask clarifying question before continuing
  - If Gate-A turns red and you can't fix in under 5 attempts, STOP and report
  - If any invariant in §1 would be violated, STOP and propose alternative
  - Don't batch phases — one tag per logical unit

Invariants cheat-sheet: zero type="module", Gate-A never red before commit,
iframe+bridge+modelDoc untouched, no `git add .`, vault via obsidian-markdown skill.

Work until v2.0.0 ships. Total ~35-40 days. User expects updates per tag,
not per commit, but commit+tag+push after every logical unit is the rhythm.
```

Save this prompt to `.claude/continuation-prompt.md` (optional, for easy copy).

---

## 11. Done criteria — v2.0.0 ships when

All of the following are true:

- [ ] All 5 phases complete (A through E)
- [ ] All 7 v2-redesign ADRs status "Accepted" (not proposed)
- [ ] Gate-A: ≥ 130 passed / 5 skipped / 0 failed
- [ ] gate-a11y: ≥ 50 passed / 0 failed
- [ ] gate-visual: 30 passed (×2 themes) / 0 failed
- [ ] gate-f (full matrix): green, 0 failures
- [ ] Import corpus: 12 reference decks, ≥ 90% fully editable
- [ ] PPTX fidelity: 5 reference decks, manual QA ≥ 85%
- [ ] All feature flags at v2 defaults (layoutVersion=v2, layersStandalone=true, etc.)
- [ ] package.json: "version": "2.0.0"
- [ ] Tag v2.0.0 pushed to origin/main
- [ ] GitHub release v2.0.0 drafted
- [ ] Vault: PROJ - v2.x Redesign archived (status=archived), new PROJ for maintenance
- [ ] `docs/RELEASE-v2.0.md` written (full release notes)
- [ ] CHANGELOG.md consolidated for v2.0.0

If any box unchecked → not yet v2.0.0.

---

## Revision log

| Date | Version of MASTERPLAN | Author | Change |
|---|---|---|---|
| 2026-04-23 | 1.0 | Claude Opus 4.7 | Initial draft, per user request during Phase B1 |
| TBD | 1.1 | — | Post-v1.2.0 update: flip state, adjust estimates |
| TBD | 1.2 | — | Post-v1.4.0 update |
| TBD | 2.0 | — | v2.0.0 ship day: archive doc, link release notes |
