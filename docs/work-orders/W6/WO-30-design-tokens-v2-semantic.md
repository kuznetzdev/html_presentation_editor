## Step 30 — v0.31.1 · Tokens v2 semantic layer + migrate `inspector.css`

**Window:** W6   **Agent-lane:** D   **Effort:** L
**ADR:** ADR-019 (Theming & Design Tokens v2)   **PAIN-MAP:** P2-16 (CSS `:has()` benchmarking — tangential; this WO covers token layer work)
**Depends on:** WO-32 (Agent ε visual-regression gate) — needed to catch rebind regressions   **Unblocks:** further component migrations (overlay.css, topbar.css, banner.css, preview.css, onboarding.css)

### Context (3–5 lines)

Current token namespace is flat (`--shell-*`, `--radius-*`, `--space-*`) and components inconsistently consume primitives vs. `12px`-style literals (PAIN-MAP P2-16 note + ADR-019 context). This WO adds a semantic layer to `editor/styles/tokens.css` (surface / text / border / intent / state) mapped onto the existing primitives, rebinds dark theme on Layer 2 only, and migrates the first component — `inspector.css` — to consume Layer 2 tokens exclusively. Visual-regression gate (Agent ε's WO-32) is the correctness backstop; a baseline screenshot must be taken BEFORE this WO lands.

### Files owned (exclusive write)

| File | Op | LOC delta est |
|------|-----|---------------|
| `editor/styles/tokens.css` | edit (add Layer 2 semantic tokens; add dark-mode rebind for Layer 2) | +120 / −0 |
| `editor/styles/inspector.css` | edit (migrate primitives to semantic) | +0 / +0 (refactor only; LOC roughly unchanged) |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `docs/ADR-019-theming-design-tokens-v2.md` | full spec — especially the "Layer 2 — Semantic" section |
| `editor/styles/tokens.css:10–205` | existing primitive inventory |
| `editor/styles/base.css`, `overlay.css`, `preview.css`, `modal.css`, `responsive.css`, `onboarding.css`, `topbar.css` | reference only — NOT migrated in this WO, but their current token consumption informs semantic-layer design |
| `tests/visual/__snapshots__/` | baseline from WO-32 |

### Sub-tasks (executable, each ≤ 2 h)

1. **Baseline capture (gate parity).** Confirm Agent ε's WO-32 (visual regression gate, `test:gate-visual`) is live on main. If not, STOP this WO — file a blocker note. If live, run `npm run test:gate-visual -- --update-snapshots` once to lock in the pre-WO baseline for inspector surfaces (light + dark themes, empty + loaded + selected workflow states). Commit the snapshots in a prep commit BEFORE touching tokens.
2. Open `editor/styles/tokens.css`. Read the full file to understand the primitive inventory. Catalog every `--*` custom property into one of five semantic groups: **surfaces**, **text**, **borders**, **intent** (info/warning/error/success), **state** (hover/active/focus). Produce the mapping as inline comments in the tokens file for readability.
3. Add Layer 2 semantic tokens inside the existing `:root` block (after the existing `--shell-*` primitives, before the `@layer` close). Minimum set per ADR-019:
```css
/* Tokens v2 — semantic layer (ADR-019). Dark-theme rebinds below. */
--surface-primary: var(--shell-panel);
--surface-elevated: var(--shell-panel-elevated);
--surface-soft: var(--shell-panel-soft);
--surface-canvas: var(--canvas-stage-bg);
--surface-accent-soft: var(--shell-accent-soft);
--surface-field: var(--shell-field-bg);

--text-primary: var(--shell-text);
--text-secondary: var(--shell-text-muted);
--text-disabled: rgba(60, 60, 67, 0.35);
--text-inverse: var(--on-accent);
--text-accent: var(--shell-accent);

--border-subtle: var(--shell-border);
--border-strong: var(--shell-border-strong);
--border-accent: var(--state-accent-border);

--intent-info-bg: var(--shell-accent-soft);
--intent-info-fg: var(--shell-accent);
--intent-info-border: var(--state-accent-border);
--intent-warning-bg: var(--shell-warning-bg);
--intent-warning-fg: var(--shell-warning);
--intent-warning-border: var(--shell-warning-border);
--intent-error-bg: var(--shell-danger-bg);
--intent-error-fg: var(--shell-danger);
--intent-error-border: var(--shell-danger-border);
--intent-success-bg: var(--shell-success-bg);
--intent-success-fg: var(--shell-success);
--intent-success-border: var(--shell-success-border);

--state-hover: var(--shell-hover, rgba(0, 0, 0, 0.04));
--state-active: rgba(0, 0, 0, 0.08);
--state-focus-ring: var(--shell-focus);
--state-selection-ring: var(--shell-selection-ring);
```
   Rule: Layer 2 tokens ONLY reference other tokens (`var(--...)`). Never literal colors in the semantic layer (exception: the `--state-hover` fallback pair, since no matching primitive exists yet — flag with a TODO for tokens-v3).
4. Add dark-theme rebind inside `:root[data-theme="dark"]` (after the existing dark primitives at `tokens.css:147–205`):
```css
/* Dark theme — rebinds Layer 2 only; Layer 1 primitives already re-themed above. */
--text-disabled: rgba(235, 235, 245, 0.35);
--state-hover: rgba(255, 255, 255, 0.06);
--state-active: rgba(255, 255, 255, 0.12);
/* Every other Layer 2 token inherits from primitives automatically via var() chain */
```
   Dark-specific overrides are minimal — most Layer 2 tokens inherit correctly through the already-rebound Layer 1.
5. **Migrate `editor/styles/inspector.css`** to consume Layer 2 only. Sub-step process per CSS rule:
   - Identify each primitive (`--shell-*`, `--radius-*`, etc) in use.
   - Map to Layer 2 equivalent (per sub-task 2 catalog).
   - Replace. Rules:
     - `--shell-panel` / `--shell-panel-elevated` → `--surface-primary` / `--surface-elevated`
     - `--shell-panel-soft` → `--surface-soft`
     - `--shell-field-bg` → `--surface-field`
     - `--shell-text` → `--text-primary`
     - `--shell-text-muted` → `--text-secondary`
     - `--shell-border` → `--border-subtle`
     - `--shell-border-strong` → `--border-strong`
     - `--shell-accent` → `--text-accent` (for text/icon colors) OR stays as `--shell-accent` (for accent backgrounds — discuss in TODO if ambiguous)
     - `--shell-accent-soft` → `--surface-accent-soft`
     - `--shell-focus` → `--state-focus-ring`
     - `--shell-success` / `--shell-warning` / `--shell-danger` → `--intent-success-fg` / `--intent-warning-fg` / `--intent-error-fg` (and matching `-bg`/`-border`)
   - **Do NOT** change `--space-*`, `--text-*`, `--leading-*`, `--radius-*`, `--motion-*`, `--shadow-*`, `--z-*` — those are primitives that will become Layer 2 in a future WO; keep them as-is for now.
6. **Hand-check** each rule in inspector.css. Open the file and confirm no `#hex` literals, no `rgba(...)` literals, no `px` values outside spacing/size contexts (font-size stays as tokens, border-radius stays as tokens). Anything that slipped is a bug; fix or flag.
7. Run `npm run test:gate-visual` — expect ZERO pixel diff. Layer 2 tokens are pure indirection at this point; visual output must be byte-identical. If any diff appears, the mapping is wrong — revert only the offending rule and retry.
8. Run `npm run test:gate-a` — must remain 55/5/0. Gate-A does not cover visuals but a CSS regression can cascade into unexpected hit-test failures.
9. Append ADR-019 status update. Edit `docs/ADR-019-theming-design-tokens-v2.md` `## Applied In` section:
```markdown
- v0.31.1 — Layer 2 semantic tokens added in tokens.css; inspector.css migrated (WO-30)
```
   Leave the other migration entries (overlay.css v0.32.0 etc.) as-is — those are future work.
10. Smoke test manually at both themes (light + dark), every inspector surface (empty / loaded / selected / selection with blocks).
11. Document the token catalog (from sub-task 2) as inline comments at the top of each semantic-layer block in tokens.css. Future WOs migrating other components can consult these comments without re-inventing the mapping.
12. Do NOT migrate any other CSS file in this WO. Overlay, topbar, etc. are explicitly out of scope — they ship in a later execution plan window (v0.32.x per ADR-019 applied-in list). One file per WO keeps the visual-regression diff focused.

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added
- [ ] No bundler dependency added
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works
- [ ] No new `@layer` (semantic tokens live inside existing `@layer tokens`)
- [ ] Visual-regression gate (WO-32) PASSES with ZERO pixel diff on inspector surfaces — this is the parity test that makes tokens v2 safe
- [ ] Layer 2 tokens reference only other tokens (Layer 1 primitives); NO literal hex/rgba in Layer 2 (except documented `--state-hover` fallback)
- [ ] Dark-theme rebinding is minimal — most Layer 2 tokens inherit through already-themed Layer 1
- [ ] `inspector.css` consumes ONLY Layer 2 semantic tokens for colors/surfaces/borders (primitives `--space-*`, `--radius-*`, etc. remain)
- [ ] ADR-019 `## Applied In` contains a v0.31.1 / WO-30 entry
- [ ] No Russian UI copy introduced — this WO has no user-visible text

### Acceptance criteria (merge-gate, falsifiable)

- [ ] Grep `editor/styles/inspector.css` for `#[0-9a-fA-F]{3,8}` — returns zero matches (no hex literals).
- [ ] Grep `editor/styles/inspector.css` for `rgba\(|rgb\(` — returns zero matches (no raw rgba literals).
- [ ] Grep `editor/styles/inspector.css` for `--shell-text\b`, `--shell-panel\b`, `--shell-border\b` — returns zero matches (migrated away from shell primitives for these four core semantics).
- [ ] `npm run test:gate-visual` passes with 0 diff on all inspector-surface snapshots (both themes).
- [ ] `npm run test:gate-a` passes 55/5/0.
- [ ] `editor/styles/tokens.css` contains `--surface-primary`, `--text-primary`, `--border-subtle`, `--intent-info-*`, `--intent-warning-*`, `--intent-error-*`, `--intent-success-*`, `--state-focus-ring` — verified by grep.
- [ ] Dark-theme rebind section contains `--text-disabled` and `--state-hover` overrides.
- [ ] ADR-019 applied-in list updated.
- [ ] Conventional commit: `refactor(css): tokens v2 semantic layer + migrate inspector.css (ADR-019) — v0.31.1 step 30`

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| Inspector surfaces pixel-identical light theme | gate-visual | `tests/visual/shell-visual.spec.js` (existing via WO-32) | pass | pass |
| Inspector surfaces pixel-identical dark theme | gate-visual | same spec | pass | pass |
| Shell smoke (no functional regression) | gate-a | `tests/playwright/specs/shell.smoke.spec.js` | pass | pass |
| Grep: no hex in inspector.css | manual | n/a | n/a | pass |
| Grep: no legacy shell-* color primitives in inspector.css | manual | n/a | n/a | pass |

### Risk & mitigation

- **Risk:** Semantic-layer mapping loses fidelity — `--shell-accent` collapsed into `--text-accent` in a context where it was actually used as a background fill.
- **Mitigation:** Sub-task 6 is a hand-check pass; any ambiguous use-site stays as `--shell-accent` (primitive) with a TODO comment. Do not force-migrate when the semantic intent is unclear; later WOs can refine.
- **Risk:** Dark-theme rebind leaves some Layer 2 tokens too light/dark because Layer 1 primitives use different rgba opacities between themes.
- **Mitigation:** Visual-regression gate catches this. If diff appears, add explicit dark overrides per offending token.
- **Risk:** WO-32 (visual gate) not yet merged — this WO has no safety net.
- **Mitigation:** Hard block — sub-task 1 checks WO-32 status first. If absent, this WO does NOT start.
- **Risk:** Other agents are also editing `tokens.css` in the same window (layer declarations from WO-24/27/28).
- **Mitigation:** Tokens.css is already a well-known merge hotspot; serialize merges via Agent ε per the window discipline. File-level conflict matrix assigns WO-30 to own tokens.css for this window's `:root` additions.
- **Rollback:** `git revert <sha>`. Tokens.css extensions are additive — they can sit without consumers. inspector.css migration is a single-file revert; visual parity returns to pre-WO state.

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:ui-ux-designer
isolation: worktree
branch_prefix: claude/wo-30-tokens-v2-semantic
```

````markdown
You are implementing Step 30 (v0.31.1 · tokens v2 semantic layer) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-30-tokens-v2-semantic (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md
  2. Read docs/ADR-019-theming-design-tokens-v2.md in full
  3. Read docs/work-orders/W6/WO-30-design-tokens-v2-semantic.md (this file)
  4. VERIFY Agent ε's WO-32 (visual regression gate) is merged. Check `npm run test:gate-visual -- --list` succeeds and baseline snapshots exist in tests/visual/__snapshots__/. If NOT, STOP and file a blocker — do NOT proceed.
  5. npm run test:gate-a — must be 55/5/0
  6. Re-capture visual baseline BEFORE touching tokens: npm run test:gate-visual -- --update-snapshots, commit as separate prep commit

FILES YOU OWN (exclusive write):
  - editor/styles/tokens.css (add Layer 2 + minimal dark rebind)
  - editor/styles/inspector.css (migrate primitives → semantic for colors/surfaces/borders)
  - docs/ADR-019-theming-design-tokens-v2.md (append applied-in entry)

FILES READ-ONLY:
  - editor/styles/*.css (reference only; do NOT migrate)
  - docs/audit/PAIN-MAP.md (P2-16 context)

SUB-TASKS: verbatim 1–12 above.

INVARIANTS:
  - No type="module"; no bundler
  - Visual regression gate-visual MUST pass with 0 pixel diff — this is the safety net
  - Gate-A 55/5/0
  - Layer 2 tokens reference Layer 1 only (no literal colors in Layer 2)
  - Only inspector.css migrated — overlay.css etc. are EXPLICITLY out of scope for this WO
  - No Russian UI copy introduced (tokens are not user-visible)
  - Keep spacing/typography/radius primitives unchanged (future WO territory)
  - ADR-019 applied-in updated

ACCEPTANCE: verbatim from section above.

ON COMPLETION:
  1. npm run test:gate-visual (0 diff) and test:gate-a (55/5/0)
  2. git add editor/styles/tokens.css editor/styles/inspector.css docs/ADR-019-theming-design-tokens-v2.md
  3. Conventional commit: "refactor(css): tokens v2 semantic layer + migrate inspector.css (ADR-019) — v0.31.1 step 30"
  4. Report: token catalog (attached to commit notes), migration map applied, any ambiguous use-sites flagged with TODO

CROSS-BATCH HAND-OFF:
  WO-32 (Agent ε) visual gate is a HARD prerequisite. Do not proceed without it.
  After this WO lands, other component migrations (overlay.css at v0.32.0, banner.css, topbar.css) can adopt the same pattern — each as its own WO.
  The semantic-layer catalog (inline comments in tokens.css after this WO) is the reference documentation future WOs will follow.
````

### Rollback plan

If merge breaks main: `git revert <sha>`. Tokens.css additions are side-effect-free; inspector.css reverts to primitive consumption; visual parity is restored.
