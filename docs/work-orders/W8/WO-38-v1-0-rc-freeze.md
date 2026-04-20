## Step 38 — v0.37.0 · v1.0 RC freeze — merge-gate checklist, full gate matrix, release-criteria doc, Obsidian / CHANGELOG wiring

**Window:** W8   **Agent-lane:** E (Integration/Release)   **Effort:** M
**ADR:** —   **PAIN-MAP:** all P0 resolved (implicit dependency on every prior WO)
**Depends on:** ALL prior WOs (WO-01 through WO-37) merged and green; specifically all 15 P0 items resolved or deferred per EXECUTION_PLAN §"Release criteria for v1.0.0"   **Unblocks:** v1.0.0 release (the next step after this WO is the version tag itself — not a WO)

### Context (3–5 lines)

Per EXECUTION_PLAN §v0.37.0: "v1.0 RC — release-candidate freeze. All P0 resolved. Full gate matrix." This WO is the last step before the v1.0.0 release tag. It declares feature freeze (NO new features merge into main for 2 weeks), executes the full gate matrix, produces a `RELEASE_CRITERIA.md` document, audits every one of the 15 P0 items + 10 new ADRs (011–020) for resolution status, updates Obsidian vault Daily/Changelog per HOW-TO-USE §9, and writes a final release-notes draft for v1.0.0. If any release criterion fails, this WO's outcome is "hold release" with a specific remediation WO list — NOT "ship anyway".

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `docs/RELEASE_CRITERIA.md` | new | +260 / −0 |
| `docs/RC_FREEZE_CHECKLIST.md` | new | +180 / −0 |
| `docs/CHANGELOG.md` | edit (consolidate Unreleased → v1.0.0-rc section, with full feature table from WO-01..WO-37) | +120 / −0 |
| `docs/ROADMAP_NEXT.md` | edit (reflect v1.0 shipped state + deferred items) | +40 / −10 |
| `docs/SOURCE_OF_TRUTH.md` | edit (bump version references; confirm architecture section matches ARCH-target-state-v1.0) | +20 / −10 |
| `docs/audit/PAIN-MAP.md` | edit (mark each P0 row with resolution — WO# and status) | +15 / −0 |
| All 20 ADRs (`docs/ADR-001-*.md` through `docs/ADR-020-*.md`) | edit (confirm Status: Accepted where applied; Deferred where deferred) | +2 / −2 per file |
| `package.json` | edit (version stays at v0.37.0-rc until release tag) | +1 / −1 |
| `obsidian/4-Changelog/CHANGELOG.md` (vault, via skill: obsidian-markdown) | edit | +100 / −0 |
| `obsidian/3-Projects/PROJ - Road to v1.0.md` (vault) | edit (status → ready-for-release) | +30 / −5 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `docs/EXECUTION_PLAN_v0.26-v1.0.md` §"Release criteria for v1.0.0" | canonical release checklist |
| `docs/audit/PAIN-MAP.md` (full) | 15 P0 items — each must be resolved or deferred with rationale |
| `docs/audit/ARCH-target-state-v1.0.md` | what "done" looks like |
| `docs/audit/ARCH-current-vs-target.md` | gap — must be closed or explicitly deferred |
| All 20 ADR files | Status field audit |
| `docs/work-orders/W1/`..`W8/` (all WOs) | each WO's acceptance criteria must be marked done |
| `docs/work-orders/GATE-TIMELINE.md` | matches actual gate evolution |
| `C:\Users\Kuznetz\Desktop\proga\obsidian\html_presentation_editor\HOW-TO-USE.md` | vault update protocol |

### Sub-tasks (executable, each ≤ 2 h)

1. **Verify all 37 prior WOs are merged.** For each WO-01 through WO-37: confirm commit exists on main (`git log --oneline main -- docs/work-orders/W*/WO-NN-*.md`), its acceptance criteria are marked done (grep `- [x]` in the WO body OR audit-trail in commit message). Produce `docs/RC_FREEZE_CHECKLIST.md` §"WO completion" table with columns: WO#, Title, Commit SHA, Status (Done/Deferred/Dropped), Gate impact. Expected state after: full table populated; any Not-Done is flagged.
2. **Audit all 15 P0 items.** For each P0-01 through P0-15 in PAIN-MAP, verify resolution. Edit `docs/audit/PAIN-MAP.md` adding a "Resolved in" column to the P0 table: WO# + version tag. For any deferred, add ADR rationale link. Expected state after: every P0 has explicit resolution or deferral reference.
3. **Audit all 20 ADRs (001–020).** For each ADR file in `docs/ADR-*.md`: confirm Status field is `Accepted` or `Deferred` — not `Proposed`. For each Accepted ADR, confirm `Accepted in: vX.Y.Z via WO-NN` line present. For Deferred ADRs, add rationale. Per EXECUTION_PLAN §Release criteria: **ALL 10 new ADRs (011–020) must be Accepted or Deferred, not Proposed**. Edit offenders in place. Expected state after: grep `Status.*Proposed` in `docs/ADR-*.md` returns 0 lines.
4. **Run the full gate matrix** — capture exact pass counts in `docs/RC_FREEZE_CHECKLIST.md` §"Gate matrix":
   - `npm run test:gate-a` → must be 55/5/0 on chromium-desktop (capture timestamp).
   - `npm run test:gate-b` → must be green on chromium-desktop + chromium-shell-1100.
   - `npm run test:gate-c` → must be green on firefox-desktop + webkit-desktop.
   - `npm run test:gate-d` → must be green on 3 tablet/mobile viewports (including WO-33 tablet-honest spec).
   - `npm run test:gate-e` → asset-parity must be green.
   - `npm run test:gate-visual` (from WO-32) → 15/0/0 on chromium-visual.
   - `npm run test:gate-a11y` (from WO-09) → 0 WCAG AA violations.
   - `npm run test:gate-contract` (from WO-13) → 100% of bridge messages validated.
   - `npm run test:gate-types` (from WO-14) → `tsc --noEmit` clean.
   - `npm run test:gate-f` → full matrix, release-blocking.
   Expected state after: each gate result recorded with pass/fail + runtime. If any fails: HALT release, spawn remediation WO, re-run on its completion.
5. **Reference-deck round-trip verification.** Open `references_pres/html-presentation-examples_v3/prepodovai_pitch_v2.html` and `selectios_pitch_v2_final.html` manually in the editor (file://). For each: select an element of each kind (text/image/container/slide-root), commit an edit, save, reload, verify persistence, export to PPTX, import back, diff. Document outcome in checklist §"Reference deck parity". Expected state after: both decks work clean — any deviation halts release.
6. **Security posture audit.** Confirm per EXECUTION_PLAN §Release criteria:
   - 0 HIGH or CRITICAL findings outstanding (grep `docs/audit/AUDIT-D-security.md` for unresolved items; cross-check every finding has a WO reference).
   - Document each resolved finding in checklist §"Security findings resolved" with AUDIT-D# → WO# mapping.
   Expected state after: zero open HIGH/CRITICAL; list of 13 Low/Med findings either fixed or documented-accepted.
7. **Performance targets verification.** Per ARCH-target-state-v1.0 §"Performance targets": measure each metric on chromium-desktop against a reference deck via the `tests/perf/` harness (if it exists from a prior WO) OR manually with `performance.now()`:
   - Cold start: ≤ 250 ms
   - Boot → first-select-possible: ≤ 600 ms
   - First-select cost (20 el): ≤ 10 ms
   - First-select cost (100 el): ≤ 20 ms
   - History memory (20 steps): ≤ 2 MB
   Document measured values. If any miss by > 20%, flag as blocker and spawn remediation WO. Expected state after: perf checklist populated; metrics within tolerance.
8. **Write `docs/RELEASE_CRITERIA.md`.** Structure:
   - §"Definition of v1.0" — verbatim from EXECUTION_PLAN §Release criteria for v1.0.0, updated with actuals from sub-tasks 4–7.
   - §"P0 resolution matrix" — 15 rows, each with status.
   - §"ADR status matrix" — 20 rows with Accepted/Deferred.
   - §"Gate matrix results" — gate × result × runtime.
   - §"Reference decks" — 2 decks × pass/fail.
   - §"Security posture" — 0 HIGH/CRITICAL confirmation.
   - §"Performance metrics" — 5 metrics × measured.
   - §"Known deferrals to v1.1+" — list of items explicitly not shipping in v1.0 (ADR-016 L2, ADR-017 full CRDT, etc.).
   - §"Freeze policy" — 2-week bug-triage-only period, no feature merges.
   Expected state after: complete document.
9. **Write `docs/RC_FREEZE_CHECKLIST.md`** — operational checklist (as opposed to release criteria which is declarative). Sections:
   - §"WO completion" (from sub-task 1)
   - §"P0 audit" (from sub-task 2)
   - §"ADR audit" (from sub-task 3)
   - §"Gate matrix" (from sub-task 4)
   - §"Reference deck parity" (from sub-task 5)
   - §"Security findings resolved" (from sub-task 6)
   - §"Performance metrics" (from sub-task 7)
   - §"Freeze policy declaration" — date freeze begins, date freeze ends (= target release date), list of allowed-during-freeze operations (bug fix, doc update, test flake fix) vs. banned (new feature, refactor).
   - §"Obsidian vault sync" — confirm Daily / Changelog / PROJ updated.
   Expected state after: checklist is the one source of truth for release-readiness state.
10. **Consolidate `docs/CHANGELOG.md`.** Transform the growing `## Unreleased` section into a single `## [1.0.0-rc] — <date>` section. Structure:
    - §Added (all new features from WO-01..37 grouped by area)
    - §Changed
    - §Fixed
    - §Security (P0-02, P0-03, P1-13, P1-14, P1-15, P0-01)
    - §Deprecated
    - §Removed
    - §Deferred to v1.1+
    Include version history of all intermediate tags (v0.26.0 through v0.37.0) as sub-list. Expected state after: single readable narrative of v1.0.
11. **Update `docs/ROADMAP_NEXT.md`.** Mark all delivered items. Move remaining items to "Post-v1.0" section. Add a §"Freeze period" note saying no new roadmap items merge until v1.0.0 ships. Expected state after: ROADMAP reflects reality.
12. **Update `docs/SOURCE_OF_TRUTH.md`.** Bump version references (`v0.25.0` → `v0.37.0-rc` → to-be-`v1.0.0`). Confirm Architecture section matches `docs/audit/ARCH-target-state-v1.0.md` §"System diagram (target)" — if any divergence, fix SOURCE_OF_TRUTH OR spawn a remediation WO. Expected state after: SOURCE_OF_TRUTH matches reality.
13. **Obsidian vault sync** (via skill: obsidian-markdown per HOW-TO-USE §9):
    - Daily note `obsidian/Daily/<today>.md` — add work-log entry: "v1.0 RC freeze checklist complete; gate matrix green × N; awaiting release tag."
    - `obsidian/4-Changelog/CHANGELOG.md` — mirror the v1.0.0-rc entry from `docs/CHANGELOG.md`.
    - `obsidian/3-Projects/PROJ - Road to v1.0.md` — status: `ready-for-release`; updated date; Links to RELEASE_CRITERIA.md + RC_FREEZE_CHECKLIST.md.
    Expected state after: vault mirrors repo reality; HOW-TO-USE protocol followed.
14. **`package.json` version**: set `version` to `0.37.0-rc.0` (RC marker). Keep at this until release tag lands. Expected state after: version reflects RC state, not yet 1.0.
15. **Final declaration commit.** Single consolidation commit at the end of this WO with message `chore(release): v1.0.0-rc — freeze declared — WO-38` containing RELEASE_CRITERIA.md, RC_FREEZE_CHECKLIST.md, CHANGELOG update, package.json version, PAIN-MAP+ADR status updates, ROADMAP + SOURCE_OF_TRUTH edits, Obsidian vault updates. Expected state after: main branch carries a single SHA identifying the freeze-declaration moment.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added — N/A (docs-only + version bump)
- [ ] No bundler dependency added
- [ ] Gate-A is 55 / 5 / 0 at this moment AND 3× consecutive post-freeze
- [ ] `file://` workflow still works
- [ ] NO new `@layer` added
- [ ] Russian UI-copy preserved in all ADR + doc edits
- [ ] Every ADR (001–020) has Status: `Accepted` or `Deferred` — **NO `Proposed` left**
- [ ] Every P0 (P0-01..P0-15) has resolution annotation in PAIN-MAP
- [ ] All 9 gates (a / b / c / d / e / visual / a11y / contract / types) have recorded pass results in `RC_FREEZE_CHECKLIST.md`
- [ ] Reference decks `v3-prepodovai-pitch` + `v3-selectios-pitch` load + edit + export + reimport round-trip clean
- [ ] Zero HIGH or CRITICAL open security findings
- [ ] `package.json` version is `0.37.0-rc.0` (NOT yet `1.0.0`)
- [ ] Obsidian vault Daily + Changelog + PROJ updated per HOW-TO-USE §9
- [ ] `docs/RELEASE_CRITERIA.md` and `docs/RC_FREEZE_CHECKLIST.md` exist and are complete
- [ ] Freeze policy declared with start-date + end-date
- [ ] NO new feature WOs added to `docs/work-orders/` during freeze period

### Acceptance criteria (merge-gate, falsifiable)

- [ ] `docs/RELEASE_CRITERIA.md` exists with 8 required sections populated
- [ ] `docs/RC_FREEZE_CHECKLIST.md` exists with 9 required sections populated
- [ ] `grep -l 'Status.*Proposed' docs/ADR-*.md` returns no ADR files (zero matches)
- [ ] `docs/audit/PAIN-MAP.md` P0 table has a "Resolved in" annotation on all 15 rows
- [ ] `docs/CHANGELOG.md` has a single `## [1.0.0-rc]` section with Added / Changed / Fixed / Security subsections
- [ ] `package.json` version is `0.37.0-rc.0`
- [ ] All 9 gate commands run and record pass results:
  - [ ] `test:gate-a` 55/5/0
  - [ ] `test:gate-b` pass
  - [ ] `test:gate-c` pass
  - [ ] `test:gate-d` pass (with tablet-honest from WO-33)
  - [ ] `test:gate-e` pass
  - [ ] `test:gate-visual` 15/0/0 (from WO-32)
  - [ ] `test:gate-a11y` 0 violations (from WO-09)
  - [ ] `test:gate-contract` 100% schemas (from WO-13)
  - [ ] `test:gate-types` clean (from WO-14)
- [ ] `test:gate-f` (full matrix) green — final release-blocking gate
- [ ] Reference decks regression pass — both `v3-prepodovai-pitch` + `v3-selectios-pitch`
- [ ] Zero HIGH or CRITICAL security findings outstanding
- [ ] Obsidian vault: Daily + Changelog + PROJ - Road to v1.0 updated (timestamp in `updated:` YAML frontmatter)
- [ ] Commit message in conventional-commits format: `chore(release): v1.0.0-rc — freeze declared — v0.37.0 WO-38`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| gate-a 55/5/0 × 3 consecutive | gate-a | all four | pass | pass |
| gate-b full regression | gate-b | all regression specs | pass | pass |
| gate-c cross-browser (FF + WebKit) | gate-c | 4 specs × 2 browsers | pass | pass |
| gate-d tablet 3 viewports + WO-33 spec | gate-d | shell.smoke + editor.regression + tablet-honest | pass | pass |
| gate-e asset-parity | gate-e | asset-parity | pass | pass |
| gate-visual 15 snapshots (WO-32) | gate-visual | shell-visual | pass (15/0/0) | pass (15/0/0) |
| gate-a11y 0 violations (WO-09) | gate-a11y | a11y specs | pass | pass |
| gate-contract bridge schemas (WO-13) | gate-contract | bridge.contract | pass | pass |
| gate-types tsc (WO-14) | gate-types | n/a (tsc) | pass | pass |
| gate-f full matrix release-blocking | gate-f | ALL | pass | pass |
| reference deck v3-prepodovai-pitch | manual | — | pass | pass |
| reference deck v3-selectios-pitch | manual | — | pass | pass |

### Risk & mitigation

- **Risk:** A prior WO's acceptance criterion was marked done but is actually regressed by a later merge (e.g., WO-17 store migration silently breaks selection.js from WO-20).
- **Mitigation:** Full gate matrix (sub-task 4) catches integration regressions. If discovered, HALT release, spawn targeted remediation WO, re-run gate matrix on its completion. Do NOT ship with known regression.
- **Risk:** An ADR marked Accepted in intermediate WO was later violated by scope creep.
- **Mitigation:** ADR audit (sub-task 3) grep-validates every Status. For each Accepted ADR, cross-check applied-in WO still exists in main (`git log --oneline`). If contradiction, revise ADR status to `Deprecated` with rationale.
- **Risk:** Performance targets measured against different deck — apples-to-oranges.
- **Mitigation:** Measure all 5 metrics against the SAME reference deck `v3-prepodovai-pitch` (~6 slides, mixed content). Document deck + measurement method in `RC_FREEZE_CHECKLIST.md`. Add measurement harness notes.
- **Risk:** Obsidian vault update violates HOW-TO-USE protocol (bad YAML, missing Links, wrong folder).
- **Mitigation:** Invoke `skill: obsidian-markdown` before editing any vault file. Validate YAML frontmatter has `type/status/updated`. Add 3–7 Links per updated note.
- **Risk:** 2-week freeze period is violated by an urgent bug requiring feature-adjacent fix.
- **Mitigation:** Freeze policy in `RELEASE_CRITERIA.md` §"Freeze policy" explicitly lists allowed operations (bug fix, doc, test flake) vs. banned (new feature, refactor). Ambiguous cases escalate to release owner; default is "deny, wait for v1.1".
- **Risk:** `version: 0.37.0-rc.0` string confuses semver consumers or npm.
- **Mitigation:** Document in CHANGELOG that `0.37.0-rc.0` is an internal RC marker; the release tag itself will be `v1.0.0` (no `rc` suffix). If external tools complain, use `0.37.0` without `rc.0` and document freeze state in CHANGELOG instead.
- **Risk:** A deferred item was expected to be shipped — user surprise on release.
- **Mitigation:** `RELEASE_CRITERIA.md §"Known deferrals"` is the single source of truth for what's NOT in v1.0. Reference it in release notes + README.
- **Rollback:** If v1.0 RC declaration is premature: `git revert <sha>` of the single freeze-declaration commit. Restores `## Unreleased` section + removes RELEASE_CRITERIA + RC_FREEZE_CHECKLIST. NO data or code regressed (docs-only commit). Then address root-cause WO and re-declare when ready.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:task-decomposition-expert
isolation: worktree
branch_prefix: claude/wo-38-v1-0-rc-freeze
```

````markdown
You are implementing Step 38 (v0.37.0 v1.0 RC freeze) for html-presentation-editor.
This is the CAPSTONE before the v1.0.0 release tag. It is orchestration + verification, not new code.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-38-v1-0-rc-freeze   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read docs/EXECUTION_PLAN_v0.26-v1.0.md §"Release criteria for v1.0.0" (verbatim)
  3. Read docs/audit/PAIN-MAP.md fully
  4. Read docs/audit/ARCH-target-state-v1.0.md fully
  5. Read docs/audit/ARCH-current-vs-target.md fully
  6. Read C:\Users\Kuznetz\Desktop\proga\obsidian\html_presentation_editor\HOW-TO-USE.md (vault protocol)
  7. Read all 20 ADR files (docs/ADR-001-*.md through docs/ADR-020-*.md) — audit Status field
  8. Read all prior WOs in docs/work-orders/W1/..W8/ — verify acceptance criteria
  9. Run `npm run test:gate-a` — must be 55/5/0 before any code change
  10. Verify main is clean and up-to-date (`git status`, `git log main -5`)

FILES YOU OWN (exclusive write):
  - docs/RELEASE_CRITERIA.md                                  (new)
  - docs/RC_FREEZE_CHECKLIST.md                               (new)
  - docs/CHANGELOG.md                                         (consolidate Unreleased → 1.0.0-rc)
  - docs/ROADMAP_NEXT.md                                      (edit: v1.0 shipped state)
  - docs/SOURCE_OF_TRUTH.md                                   (edit: version bump)
  - docs/audit/PAIN-MAP.md                                    (edit: Resolved in column)
  - docs/ADR-001-*.md through docs/ADR-020-*.md               (Status: Accepted/Deferred audit)
  - package.json                                              (version: 0.37.0-rc.0)
  - obsidian/Daily/<today>.md                                 (vault)
  - obsidian/4-Changelog/CHANGELOG.md                         (vault)
  - obsidian/3-Projects/PROJ - Road to v1.0.md                (vault)

FILES READ-ONLY (reference only):
  - docs/EXECUTION_PLAN_v0.26-v1.0.md
  - docs/audit/ARCH-target-state-v1.0.md
  - docs/audit/ARCH-current-vs-target.md
  - docs/audit/AUDIT-A..E-*.md
  - docs/work-orders/TEMPLATE.md
  - docs/work-orders/INDEX.md (post-WO-38 cross-cutting artifact)
  - docs/work-orders/GATE-TIMELINE.md
  - docs/work-orders/W*/WO-*.md (all)
  - HOW-TO-USE.md (vault)

SUB-TASKS: (verbatim from WO sub-tasks 1–15)

INVARIANTS (NEVER violate):
  - No type="module"; no bundler (docs-only WO — N/A but confirm)
  - Gate-A 55/5/0 preserved AND 3× consecutive
  - Every ADR Status: Accepted or Deferred (0 Proposed)
  - Every P0 has Resolved-in annotation
  - All 9 gates recorded pass
  - Reference decks regression-clean
  - 0 HIGH/CRITICAL security outstanding
  - Obsidian vault sync per HOW-TO-USE §9 (skill: obsidian-markdown first)
  - file:// workflow preserved

ACCEPTANCE: (verbatim from Acceptance criteria section)

ON COMPLETION:
  1. Run full gate matrix (sub-task 4) with recorded pass counts
  2. Manual reference-deck regression (sub-task 5)
  3. git add docs/RELEASE_CRITERIA.md docs/RC_FREEZE_CHECKLIST.md docs/CHANGELOG.md
       docs/ROADMAP_NEXT.md docs/SOURCE_OF_TRUTH.md docs/audit/PAIN-MAP.md
       docs/ADR-*.md package.json
       (vault files go through obsidian-markdown skill, not this repo)
  4. Conventional commit: "chore(release): v1.0.0-rc — freeze declared — v0.37.0 WO-38"
  5. DO NOT tag v1.0.0 yet — that's a separate step, after 2-week freeze window ends
  6. Report back: full gate matrix results, P0 resolution counts, ADR status counts,
     reference-deck regression outcome, security posture summary,
     Obsidian vault sync confirmation, any BLOCKERS that halt release
````

### Rollback plan

If the RC-freeze declaration is premature (e.g., a critical issue surfaces within the 2-week freeze window):
- `git revert <sha>` of the single RC-freeze commit — restores `## Unreleased` CHANGELOG; removes RELEASE_CRITERIA + RC_FREEZE_CHECKLIST; reverts version to `0.36.0` (previous).
- Spawn targeted remediation WOs for the critical issue.
- Re-run WO-38 from scratch once remediation lands.

If a gate fails mid-RC-freeze execution (before commit): HALT, do not commit anything, diagnose and fix the failing gate's root cause as a remediation WO, come back. NO fix-forward under pressure.

---
