# Work Order Template (v1)

> Every work order file under `docs/work-orders/W<n>/WO-NN-<slug>.md` MUST follow this exact structure.
> Headings are mandatory; field order is mandatory. Cells must not be empty — use `—` for N/A.
> Language: English for code, paths, acceptance; Russian UI-copy stays Russian when quoted.

---

## Step N — v0.X.Y · <title>

**Window:** W\<n\>   **Agent-lane:** \<A | B | C | D | E\>   **Effort:** \<S | M | L | XL\>
**ADR:** \<refs or "—"\>   **PAIN-MAP:** \<P-nn list or "—"\>
**Depends on:** \<prev step#s or "none"\>   **Unblocks:** \<next step#s or "none"\>

### Context (3–5 lines)

Why this step exists. What pain it closes (cite PAIN-MAP item IDs). Which files it touches.
State the intent, not the implementation.

### Files owned (exclusive write)

| File | Op (new / edit / rename / delete) | LOC delta est |
|------|-----------------------------------|---------------|
| `editor/src/...` | edit | +40 / −5 |

### Files read-only (reference)

| File | Reason |
|------|--------|
| `editor/src/constants.js` | source of `BLOCKED_ATTR_NAMES` |

### Sub-tasks (executable, each ≤ 2 h)

1. \<Concrete action\>. Reference: `file:line`. Expected state after: \<one line\>.
2. ...
3. ... (6–15 sub-tasks total; 10 is typical)

### Invariant checks (copy-paste into runtime report)

- [ ] No `type="module"` added to any `<script>` tag
- [ ] No bundler dependency (Vite / Webpack / esbuild) added to package.json
- [ ] Gate-A is 55 / 5 / 0 before merge
- [ ] `file://` workflow still works (manual smoke: open a deck from file system)
- [ ] New `@layer` declared first in `editor/styles/tokens.css` (only if a new CSS layer)
- [ ] Russian UI-copy strings preserved (not translated to English)
- [ ] \<step-specific invariant(s)\>

### Acceptance criteria (merge-gate, falsifiable)

- [ ] \<Behavior 1\> is verified by \<exact command or spec\>
- [ ] \<test spec\> passing on \<gate-a | gate-b | gate-a11y | …\>
- [ ] No regressions in \<related areas\>
- [ ] ADR-\<NNN\> Status updated Proposed → Accepted (if this WO applies the ADR)
- [ ] Commit message in conventional-commits format

### Test matrix

| Scenario | Gate | Spec file | Status before | Status after |
|----------|------|-----------|---------------|---------------|
| \<scenario\> | gate-a | `tests/...spec.js` | N/A | pass |

### Risk & mitigation

- **Risk:** \<concrete scenario, not abstract\>
- **Mitigation:** \<concrete plan, step-by-step\>
- **Rollback:** \<exact git command or revert file list\>

### Ready-to-run agent prompt (self-contained)

```yaml
subagent_type: all-agents:<type>
isolation: worktree
branch_prefix: claude/wo-<NN>-<slug>
```

````markdown
You are implementing Step N (v0.N.x <title>) for html-presentation-editor.
Repo: C:\Users\Kuznetz\Desktop\proga\html_presentation_editor
Branch: claude/wo-<NN>-<slug>   (create from main)

PRE-FLIGHT:
  1. Read CLAUDE.md for project invariants
  2. Read ADR-<NNN>, ADR-<MMM>  (listed below)
  3. Run `npm run test:gate-a` — must be 55/5/0 before any code change

FILES YOU OWN (exclusive write):
  - path/a
  - path/b

FILES READ-ONLY (reference only):
  - path/x
  - path/y

SUB-TASKS:
  1. ...
  2. ...

INVARIANTS (NEVER violate):
  <verbatim from Invariant checks section>

ACCEPTANCE:
  <verbatim from Acceptance criteria section>

ON COMPLETION:
  1. Run the full acceptance matrix
  2. git add <specific files>
  3. Conventional commit: "<type>(<scope>): <subject> — v0.N.x step N"
  4. Report back: files changed, LOC delta, gate results, blockers if any
````

### Rollback plan

If merge breaks main: `git revert <sha>`; re-plan; NO fix-forward under pressure.

---

## Rules for authors of work orders

1. Each sub-task is executable in ≤ 2 h by one person.
2. Each WO is completable in ≤ 3 days (split into two WOs if bigger).
3. Every acceptance criterion is falsifiable: measurable, time-bounded, or behavior-tested.
4. Files owned / read-only lists are exhaustive — grep them later for conflict matrix.
5. The "Ready-to-run agent prompt" block must be copy-pasteable into a fresh Agent tool call
   and produce working code with NO access to this planning session.
6. Risk items must name concrete scenarios. "Performance might degrade" is not a risk;
   "First-selection latency may exceed 80 ms p95 on 100-element decks" is a risk.
