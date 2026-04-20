# Risk register — v0.26.x → v1.0.0

> Aggregate of every "Risk & mitigation" item from all 38 WOs + top-level project risks from `EXECUTION_PLAN §Risk map`.
> Generated at 2026-04-20. Re-run after any WO edit.
>
> Status note: Phase 1 population — 18 WOs authored (WO-01..11, WO-32..38). Remaining 20 rows
> (WO-12..31) inherit the top-level EXECUTION_PLAN risks + ADR-mapped defaults. Re-scan and update
> once peer agents (β/γ/δ) land their WOs. Flagged below where applicable.

## Severity scale

- **Likelihood (L)**: Low / Medium / High — based on similar-change historical frequency.
- **Impact (I)**: Low / Medium / High — blast radius if it fires.
- **Combined**: `L × I` mapped to a 3×3 heatmap below.

## Register

| # | Risk | Source WO | L | I | Mitigation summary | Rollback plan |
|---|------|-----------|---|---|-------------------|---------------|
| R-01 | Sanitization strips a tag used in reference deck — `v3-prepodovai` or `v3-selectios` breaks on round-trip | WO-01 | M | H | Pre-grep reference deck tags; extend allow-list if needed; explicit spec test on reference deck | `git revert <sha>` (single focused commit) |
| R-02 | Inline SVG `<use xlink:href="#id">` false-positive on URL sanitizer | WO-01 | L | M | `UNSAFE_URL_PROTOCOLS` only matches `javascript:/vbscript:/data:text/html:`; relative `#foo` passes | `git revert <sha>` |
| R-03 | Sanitizer walk cost in hot path (per `replace-node-html` call) | WO-01 | L | L | Walk is O(n) with 0.5 ms overhead on 1 k-node trees; document envelope in commit body | `git revert <sha>` |
| R-04 | `file://` drops non-`"*"` targetOrigin postMessage — bridge dies entirely | WO-02 | M | H | Explicit branch: `protocol === 'file:'` keeps targetOrigin `"*"`; receive side asserts `origin === 'null'` | `git revert <sha>` |
| R-05 | `window.location.origin === "null"` branch disagrees between UAs | WO-02 | L | M | `getAllowedBridgeOrigins()` explicitly includes `"null"`; dedicated test case | `git revert <sha>` |
| R-06 | Third-party `postMessage` tests flagged as foreign-origin | WO-02 | L | L | Discriminant `__presentationEditor` still gates; origin check is an extra layer | `git revert <sha>` |
| R-07 | Vendored pptxgenjs is wrong version or corrupt — malformed PPTX exports | WO-03 | L | H | SRI hash in README + constants; periodic verifier; export smoke + e2e coverage | `git revert <sha>` + operator constant toggle |
| R-08 | Upgrades forget to update SRI hash, drifting invariant | WO-03 | M | M | README documents "Upgrade procedure" explicitly; acceptance criterion verifies README | `git revert <sha>` |
| R-09 | Vendor blob (~700 KB) inflates clone / LFS quota | WO-03 | L | L | Size acceptable per AUDIT-D-03; no LFS required; `.gitattributes` prevents line-ending thrash | N/A (size acceptable) |
| R-10 | Relative-path resolution differs between `file://` and `http://localhost:*` | WO-03 | L | M | Use same path resolution other classic scripts use; manual `file://` smoke | `git revert <sha>` |
| R-11 | Stripped data-URIs break autosave restore — broken `alt-text` on `<img>` | WO-04 | M | M | Russian banner copy on restore explains; structure preserved; user reopens source file | `git revert <sha>` |
| R-12 | Regex data-URI stripping matches non-image base64 (e.g., SVG text) | WO-04 | L | L | Regex anchors on `data:image/` + min 1024 chars; small SVG icons pass | `git revert <sha>` |
| R-13 | Hardcoded size thresholds — low-capacity browsers hit smaller limits | WO-04 | L | M | Thresholds in `constants.js`, grep-able; future WO wires to preference (ADR-020 telemetry can inform) | `git revert <sha>` |
| R-14 | Sandboxed context lacks `crypto.getRandomValues` — fallback branch fires | WO-05 | L | L | Fallback preserved (Math.random over Uint8Array); diagnostic grep-able | `git revert <sha>` |
| R-15 | `addDiagnostic` undefined at `createBridgeToken` call — bootstrap race | WO-05 | L | L | Wrapped in try/catch; no bootstrap order assumption | `git revert <sha>` |
| R-16 | Token length change (~15 → 56 chars) breaks in-test regex | WO-05 | L | L | Grep confirms no length-dependent paths; test regex aligned | `git revert <sha>` |
| R-17 | HEAD-probe broken assets adds latency + privacy side-effects | WO-06 | M | M | Probe only under `http://localhost:*`; `file://` disables probe; `Promise.allSettled` + 50-probe cap | `git revert <sha>` |
| R-18 | `#shellBanner` steals preview vertical space | WO-06 | L | M | `shell-banner--empty` collapses when empty; max-height + overflow-y | `git revert <sha>` |
| R-19 | WO-24 (Agent δ) asset-list modal duplicates banner copy | WO-06 | M | M | Explicit hand-off in commit body; banner action triggers existing `previewAssistActionBtn` | coordination merge-order; `git revert` if severe |
| R-20 | Broken-asset false-positive on CORS-opaque resources | WO-06 | M | L | Probe classifies `ok`/`missing`/`opaque`; banner counts `missing` only | `git revert <sha>` |
| R-21 | Neutralize path breaks legitimate Reveal.js decks (scripts die) | WO-07 | M | H | Russian banner copy makes trade-off explicit; toast confirms sandbox mode; user can re-import | `git revert <sha>` |
| R-22 | Trust-signal false-positive on `style` attribute substring | WO-07 | L | L | CSS selectors used, not substring — style attrs not scanned | `git revert <sha>` |
| R-23 | `scanTrustSignals` runs on every `buildModelDocument` — deck-load cost | WO-07 | L | L | `querySelectorAll` fixed-selectors O(n); < 1 ms on 1 k nodes | `git revert <sha>` |
| R-24 | Rebuild path in `neutralizeAndReload` skips stateful hook | WO-07 | L | H | Reuses `loadHtmlDocument` entry; flags `resetHistory` + full import pipeline | `git revert <sha>` |
| R-25 | Contract scaffold wired into bridge.js dispatcher prematurely | WO-08 | L | H | Scope is EXPLICITLY scaffold-only; validators not wired until WO-13 | `git revert <sha>` |
| R-26 | Corpus under-represents real variance — silent false-pass | WO-08 | M | M | README documents "add a message-type + 3 fixtures"; WO-13 is full coverage | evolve with WO-13 |
| R-27 | `bridge-schema.js` parse cost before `bridge.js` load | WO-08 | L | L | ~160 LOC; < 1 ms parse; classic script, no network | N/A (cost acceptable) |
| R-28 | `playwright.config.js` edit flakes gate-a | WO-08 | L | H | `gate-contract` explicitly separate project — do NOT touch `chromium-desktop` config | `git revert <sha>` |
| R-29 | axe scanning iframe surfaces violations inside user-authored deck HTML | WO-09 | H | H | `AxeBuilder#exclude('#previewFrame')` applied; spec asserts via corrupted-deck fixture | `git revert <sha>` (spec-only) |
| R-30 | Rail arrow-key handler collides with preview nudge (WO-28) | WO-10 | M | M | Gate handler on `event.target.closest('#slidesPanel')`; merge-order constraint: WO-10 before WO-28 | `git revert <sha>` |
| R-31 | WCAG contrast formula bug (sRGB linearization, rounding) | WO-11 | M | M | Sentinel pairs — black/white = 21, white/white = 1, #333/#fff ≈ 12.63 — fail loudly before token pairs | `git revert <sha>` (spec-only) |
| R-32 | Bridge v2 sanitization breaks reference decks on bridge rewrite | WO-13 (planned) | M | H | Deep spec on reference decks before sanitization switch; behind flag first | `git revert <sha>` |
| R-33 | Visual baselines are platform-sensitive (Win vs Linux render diff) | WO-32 | M | M | Pin CI to Windows Server 2022 per ADR-007; document in TESTING_STRATEGY | `git revert <sha>` |
| R-34 | Theme-switch helper captures in-transition frame | WO-32 | L | M | Helper awaits `html[data-theme="dark"]` marker before screenshot | `git revert <sha>` |
| R-35 | Legacy `visual.spec.js` removal breaks Gate-B if coverage gap | WO-32 | L | M | Diff legacy vs. new 15-surface matrix; expand scope +2 if context-menu missed | `git revert <sha>` |
| R-36 | Font rendering sub-pixel jitter inflates diff ratio | WO-32 | L | L | `threshold: 0.2` + `maxDiffPixelRatio: 0.01`; await `document.fonts.ready` in helpers | increase threshold minimally |
| R-37 | Banner media-query padding interferes with desktop layout at resize | WO-33 | L | L | `@media (max-width: 820px)` only for banner styling; no JS branching beyond `isCompactViewport()` | `git revert <sha>` |
| R-38 | Synthetic tap events differ from real iOS Safari `TouchEvent` sequences | WO-33 | M | M | Gate-D is Chromium-emulation only; real-iOS validation is manual pre-RC step (WO-38) | document limitation |
| R-39 | TB4 multi-select test ambiguous — silent no-op passes spuriously | WO-33 | L | L | Assert banner OR `selectedNodeIds.length === 1`; intent documented in spec comment | `git revert <sha>` |
| R-40 | Gate-D runtime exceeds budget (new 30-run spec) | WO-33 | L | L | Keep per-test runtime < 5s; total gate-D budget ≤ 25 min | remove failing spec, re-plan |
| R-41 | File System Access API Chromium-only — Firefox/Safari export silently fails | WO-34 | M | M | Feature-detect `showSaveFilePicker`; `<a download>` fallback; TV6 runs chromium-only | fallback path always shipped |
| R-42 | LocalStorage log >1 MB on long sessions — viewer janky | WO-34 | M | L | Viewer renders newest 200 events; filters apply to that window; 1 MB LRU-evict in scaffold | reduce window to 100 events |
| R-43 | `telemetry.subscribe` reentrancy during render | WO-34 | L | L | `requestAnimationFrame` batching + single-flight dirty flag | `git revert <sha>` |
| R-44 | Export-purity invariant breaks if telemetry moves to state slice | WO-34 | M | H | TV9 spec is runtime regression check; code comment on `export.js` serialization; follow-up WO if needed | `git revert <sha>` + add explicit strip |
| R-45 | Opt-in toggle wording disagrees across WO-15 / WO-34 | WO-34 | L | L | Single source: toggle lives in `presentation-editor.html`; viewer reads DOM | normalize via CHANGELOG note |
| R-46 | Bridge-script injection path fragile — load-order sensitive | WO-35 | M | M | Defensive fallback keeps literal canonical kinds; `runtime-log` warn on fallback use | `git revert <sha>` |
| R-47 | Entity kind `label` Russian strings collide with existing inspector labels | WO-35 | L | L | `inspectorSections` informational only in this WO; visual gate + EKR5 catch collisions | `git revert <sha>` |
| R-48 | `Object.freeze` shallow — nested `inspectorSections` arrays not frozen | WO-35 | L | L | Each array explicitly `Object.freeze()`-wrapped; acceptance verifies immutability | one-line fix |
| R-49 | Drift: new kind added to `IMPORT_ENTITY_KINDS` but not `entity-kinds.js` | WO-35 | L | M | Boot-time assertion + runtime-log warn on mismatch; defensive, not hard-fail | add assertion |
| R-50 | Replacing `waitForTimeout` surfaces genuine bug the timeout was papering over | WO-36 | M | M | Triage each surfaced failure — genuine bug gets co-located fix; do NOT restore sleep | fix root cause or `git revert` |
| R-51 | LN3 container-mode marker emission wrong layer, side-effects | WO-36 | L | M | Use `window.dispatchEvent` (observation-only); move to `selection.js` if `bridge.js` contentious | `git revert <sha>` |
| R-52 | `acceptNextDialog` robustness-to-double-fire breaks fire-once-reliant test | WO-36 | L | L | Audit existing dialog usages — all 3 are one-confirm accepts; behaviorally identical | `git revert <sha>` |
| R-53 | Stateful `page.on('dialog')` without unsubscribe leaks handler across tests | WO-36 | L | M | Helper returns `{ unsubscribe }`; tests call in afterEach; lint-like rule documented | review + fix leak |
| R-54 | 3× consecutive-pass uncovers residual flake not in original 23 count | WO-36 | M | M | Within WO budget to address; spawn follow-up WO only if out-of-scope | spawn follow-up WO |
| R-55 | `waitForOverlapMapUpdated` depends on manual-kick API — false-green | WO-36 | L | M | Poll deterministic `state.overlapMap.lastComputedAtSeq` not `runOverlapDetectionNow` | add missing field (10 LOC) |
| R-56 | Shortcut refactor changes handler timing — chord stops firing | WO-37 | M | H | `chordMatches` ports exact `isMod = ctrlKey||metaKey` semantic; manual press-test acceptance | `git revert <sha>` |
| R-57 | Auto-rendered cheat-sheet reorders vs. hand-maintained list | WO-37 | L | L | `KEYBINDINGS` order IS cheat-sheet order; curate to match | reorder table |
| R-58 | `feature-flags.js` script load race — `isAdvancedMode()` undefined | WO-37 | L | H | Load immediately after constants.js; no module calls at parse time | check script order, fix load order |
| R-59 | `Escape` + modal-close order relies on side-effects; dispatch first-match breaks | WO-37 | L | M | `handleEscape(ctx)` preserves exact order — activeManipulation → context menu → modals | SCT8 spec catches |
| R-60 | `Ctrl+B/I/U` conditional (text-entity + canEditStyles) regressed | WO-37 | L | M | `isTextEditContext(ctx)` reproduces predicate tree; image-entity negative test added | `git revert <sha>` |
| R-61 | Prior WO acceptance marked done but regressed by later merge | WO-38 | M | H | Full gate matrix catches integration regressions; HALT release, spawn remediation WO | `git revert <sha>` of RC-freeze commit |
| R-62 | ADR Accepted but later violated by scope creep | WO-38 | L | M | ADR audit grep-validates Status; cross-check applied-in WO still in main | mark `Deprecated` w/ rationale |
| R-63 | Perf targets measured against different deck (apples-to-oranges) | WO-38 | L | L | All 5 metrics against `v3-prepodovai-pitch`; document deck + method in checklist | re-measure consistently |
| R-64 | Obsidian vault update violates HOW-TO-USE protocol | WO-38 | L | L | Invoke `skill: obsidian-markdown` before edit; validate YAML; 3–7 Links | fix per protocol |
| R-65 | 2-week freeze violated by urgent "near-feature" fix | WO-38 | M | M | Freeze policy explicitly lists allowed vs. banned; ambiguous cases escalate | deny, wait for v1.1 |
| R-66 | `version: 0.37.0-rc.0` confuses semver tools | WO-38 | L | L | Document in CHANGELOG; fall back to `0.37.0` without `rc.0` if tools complain | strip RC marker |
| R-67 | Deferred item expected to ship — user surprise | WO-38 | M | M | `RELEASE_CRITERIA §"Known deferrals"` is SSoT; reference in release notes + README | communicate via CHANGELOG |
| **R-68** | **Top-level: ADR-015 invariant violation — contributor adds `type="module"` or bundler dep** | cross-cutting | L | H (invariant break) | CLAUDE.md + ADR-015 in PR review; every WO lists "no `type=module`" invariant check | halt PR, revert, educate |
| R-69 | Top-level: ADR-013 store migration breaks existing state consumers | WO-16/17/18 | M | H | Proxy shim keeps `window.state` reads working through full migration (per EXECUTION_PLAN risk map) | `git revert` to last-green |
| R-70 | Top-level: v0.30.1 patch-based history loses data in migration | WO-18 | L | Critical | Full-HTML snapshot fallback retained until 2 minors of patch-based run clean | fallback always active |
| R-71 | Top-level: A11y gate discovers 50+ violations | WO-09 | M | M | Acceptable — existing bugs; ship triaged list in v0.27.1 | ship with documented deferrals |
| R-72 | Top-level: Timeline slips (common for 4-month plans) | project-level | H | M | Plan has 3 slack weeks in W7–W8; RC freeze WO-38 can absorb; defer non-P0 items to v1.1+ | slip with controlled deferral |

## Likelihood × Impact heatmap

|  | **Impact: L** | **Impact: M** | **Impact: H** |
|---|---|---|---|
| **Likelihood: L** | R-03, R-06, R-09, R-12, R-14, R-15, R-16, R-22, R-23, R-27, R-36, R-39, R-40, R-42, R-43, R-45, R-47, R-48, R-52, R-57, R-66 | R-02, R-05, R-10, R-13, R-18, R-20, R-26, R-31, R-34, R-35, R-37, R-46, R-51, R-53, R-55, R-59, R-60, R-62, R-63, R-64 | R-07, R-24, R-25, R-28, R-44, R-58, **R-68**, R-70 |
| **Likelihood: M** | R-42 (dup), R-54 | R-08, R-11, R-17, R-19, R-30, R-33, R-38, R-41, R-50, R-54, R-65, R-67, R-69, R-71 | R-01, R-04, R-21, R-32, R-56, R-61 |
| **Likelihood: H** | — | — | R-29 |
| **Likelihood: H** | — | R-72 | — |

## Top 5 High × High (mandatory mitigation ownership)

These risks combine high likelihood with high impact — each has a dedicated owner.

### 1. R-29 — axe scanning user deck violations destroys a11y gate signal-to-noise (High × High)
- **Owner:** Agent B (W2) — WO-09
- **Mitigation:** `AxeBuilder#exclude('#previewFrame')` in `runAxeScanShellOnly`; corrupted-deck fixture proves exclusion.
- **Status:** Mitigated in WO-09 source.

### 2. R-01 — Sanitization strips reference-deck tag (Medium × High)
- **Owner:** Agent B (W1) — WO-01
- **Mitigation:** Pre-grep reference decks for tags BEFORE coding; extend `ALLOWED_HTML_TAGS` as needed; explicit regression test on both v3 reference decks.
- **Status:** Mitigated in WO-01 source; acceptance criterion includes reference-deck round-trip.

### 3. R-04 — `file://` drops non-`"*"` origin postMessage (Medium × High)
- **Owner:** Agent D (W1) — WO-02
- **Mitigation:** Explicit `file://` branch keeps `"*"`; receive-side still validates token + origin; manual file:// smoke test.
- **Status:** Mitigated in WO-02 source.

### 4. R-21 — Trust Banner neutralize breaks legitimate Reveal.js decks (Medium × High)
- **Owner:** Agent D (W2) — WO-07
- **Mitigation:** Russian banner copy explicitly warns "Скрипты будут запущены." → user who chooses Neutralize acknowledges script death. Re-import without neutralize restores.
- **Status:** Mitigated in WO-07 source; UX copy hand-off to Agent δ.

### 5. R-56 — Shortcut refactor breaks a chord (Medium × High)
- **Owner:** Agent B (W8) — WO-37
- **Mitigation:** `chordMatches` ports exact `isMod` semantic; 22-binding manual press-test acceptance criterion.
- **Status:** Mitigated in WO-37 source.

### Bonus — R-68 — ADR-015 invariant violation (zero-build / no `type="module"`) (Low × High)
- **Owner:** Cross-cutting — every WO + PR reviewer
- **Mitigation:** Every WO's "Invariant checks" section includes the explicit check; CLAUDE.md §8 is the user-level contract; ADR-015 is referenced in every WO body.
- **Status:** Covered by pre-existing repo convention, verified per-WO.

## Phase 2 re-sync

- Phase 2 performed at 2026-04-20 end-of-session: all 38 WO files confirmed present in `docs/work-orders/W*/WO-*.md`.
- Peer-authored WO risks (WO-12..WO-31 from agents β/γ/δ) landed at the same time as this register. Each should be re-scanned for additional risks to append as R-73..onward; the 72 risks currently enumerated cover the full span of authored Agent α + Agent ε WOs plus the top-level EXECUTION_PLAN project risks that apply cross-cuttingly.
- R-32 (WO-13 bridge v2 sanitization) is now backed by an authored WO file (`W3/WO-13-bridge-v2-schema-validation.md`); re-scan that file's Risk section and append any concrete risks beyond R-32.
- Top-level project risks (R-68..R-72) are static — they come from `EXECUTION_PLAN §"Risk map"` and do not change per WO.

## Links
- [INDEX.md](INDEX.md)
- [DEPENDENCY-GRAPH.md](DEPENDENCY-GRAPH.md)
- [GATE-TIMELINE.md](GATE-TIMELINE.md)
- [AGENT-WORKLOAD.md](AGENT-WORKLOAD.md)
- [EXECUTION_PLAN §Risk map](../EXECUTION_PLAN_v0.26-v1.0.md)
- [PAIN-MAP](../audit/PAIN-MAP.md)
