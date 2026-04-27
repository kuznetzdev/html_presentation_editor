# Known axe-core Violations — Shell A11y Gate

Violations discovered by `npm run test:gate-a11y` that are tracked for remediation.
Tests referencing these violations are marked `test.fail()` with a TODO comment.

All items here must be resolved before v1.0 GA.

> **Status as of v2.0.16 (2026-04-25):** Both originally-tracked violations
> are RESOLVED. `test.fail()` markers removed from `shell-a11y.spec.js` for
> both `loaded-preview` and `loaded-edit` states. Sections kept below as a
> historical record; see Triage table at the bottom for current status.

---

## color-contrast (all workflow states) — RESOLVED v2.0.16

**Rule:** `color-contrast`
**Impact:** serious
**WCAG:** 1.4.3 (AA)
**States affected:** empty, loaded-preview, loaded-edit

**Description:**
Secondary text elements use foreground color `#8a8a8e` (iOS gray-2) on white `#ffffff` background.
Measured contrast ratio: 3.43:1. Required: 4.5:1 (normal text) / 3:1 (large text ≥ 18pt or 14pt bold).

**Affected elements:**
- `#previewModeLabel` (.panel-subtext) — 13px / normal weight — 3.43:1
- `#zoomLevelLabel` (.preview-zoom-label) — 11px / normal weight — 3.43:1
- Inspector labels: `.inspector-label`, `label[for="slideTitleOverrideInput"]`, etc.
- `#currentSlideMetaBadge` (.mini-badge) — 12px / normal weight on `#f2f2f7` — 3.28:1

**Root cause:**
Design token `--color-secondary` (`#8a8a8e`) does not meet WCAG AA contrast on light backgrounds
when used for small text. The token was set for iOS aesthetic fidelity without AA validation.

**Remediation:**
Darken `--color-secondary` to ≥ `#767676` (4.54:1 on white) in `editor/styles/tokens.css`.
Verify dark-theme equivalent. Referenced in WO-10 (keyboard + contrast audit).

**Added:** 2026-04-21

---

## nested-interactive (loaded-preview, loaded-edit) — RESOLVED v2.0.16

**Rule:** `nested-interactive`
**Impact:** serious
**WCAG:** 4.1.2 (A)
**States affected:** loaded-preview, loaded-edit

**Description:**
Slide rail items (`.slide-item`) use `role="button"` and `tabindex="0"` but contain focusable
descendant elements (thumbnail buttons, slide-number spans with click handlers, etc.).
Screen readers may not correctly announce nested interactive controls, and keyboard users
may encounter unexpected focus traps.

**Affected elements:**
- `div[data-index="0"]` (.slide-item.is-active) — has focusable descendants
- `div[data-index="1"]` (.slide-item) — has focusable descendants
- `div[data-index="2"]` (.slide-item) — has focusable descendants

**Root cause:**
Slide items are implemented as `role="button"` divs with nested interactive content
(thumbnail overlay buttons, context menu triggers). This pattern conflicts with ARIA spec —
buttons must not contain other buttons.

**Remediation:**
Restructure slide rail items:
- Outer container: `role="listitem"` (non-interactive)
- Primary activate action: `<button>` element
- Secondary actions (context menu trigger, rename): separate buttons outside the primary

Referenced in WO-10 (keyboard navigation audit).

**Added:** 2026-04-21

---

## Triage status

| Rule | Impact | States | Fix WO | Status |
|------|--------|--------|--------|--------|
| color-contrast | serious | all 3 | v2.0.16 / A11Y-001 | RESOLVED — `--shell-text-muted` alpha 0.6 → 0.78 (~5.5:1 on white) |
| nested-interactive | serious | loaded-preview, loaded-edit | v2.0.16 / A11Y-001 | RESOLVED — `.slide-item` role `button` → `listitem`; parent `#slidesList` role=`list`; overlap chip dropped role=`button` + tabindex |
