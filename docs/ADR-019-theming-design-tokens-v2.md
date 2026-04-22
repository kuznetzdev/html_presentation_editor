# ADR-019: Theming & Design Tokens v2 — contracted surfaces, contrast-verified

**Status**: Accepted — Semantic token layer (Layer 2) implemented in: v0.32.1 via WO-30; inspector.css migrated 58 primitive → semantic tokens
**Phase**: v0.28.x (leverages ADR-006 a11y gate + ADR-007 visual gate)
**Owner**: Architecture · CSS layer
**Date**: 2026-04-20

---

## Context

Current theming (AUDIT-A scorecard CSS @layer: 9/10 — clean):

- 27 new tokens in `tokens.css` (v0.22.1): spacing, typography, line-height.
- Colors: `--shell-bg`, `--shell-text`, `--shell-border`, `--shell-accent`, `--shell-hover`, etc.
- Light/dark theme via `data-theme="light|dark|auto"` on `<html>`.
- Theme resolves pre-paint via inline `<script>` in shell head (FOUC prevention — SOURCE_OF_TRUTH invariant).
- v0.21 design-system polish removed hardcoded colors and fixed dark-mode border bugs.

What still hurts (AUDIT-A §Consistency of naming + AUDIT-B cross-cutting + AUDIT-E gap):

- Token namespace is flat (`--shell-*`, `--radius-*`, `--space-*`) — no semantic layer above primitives.
- Token usage is inconsistent: some components call primitives (`--radius-md`), others hardcode `12px`, fixed in v0.21 for 2 components but not audited across all 8 CSS files.
- No programmatic contrast verification. ADR-006's `contrast.spec.js` plans to test a few pairs — one-off.
- No component-level theming hooks: e.g., banner colors use `--shell-accent` (primary) regardless of intent (info vs. warning vs. error). ADR-014 error boundaries will need 3 color pairs.
- Theme switching at runtime: flickers? Depends on inline script correctness.

---

## Decision

Introduce a **two-layer token system**: Primitive tokens (existing) + Semantic tokens (new).

### Layer 1 — Primitives (existing, keep)

```css
--primitive-gray-0 through --primitive-gray-900
--primitive-blue-100 through --primitive-blue-700
--primitive-red-100 through --primitive-red-700
--primitive-yellow-100 through --primitive-yellow-700
--primitive-green-100 through --primitive-green-700

--radius-sm, --radius-md, --radius-lg
--space-1 through --space-12
--text-xs through --text-2xl
```

### Layer 2 — Semantic (new, in same tokens.css)

```css
/* Surfaces */
--surface-primary: var(--primitive-gray-0);         /* light */
--surface-elevated: var(--primitive-gray-50);
--surface-canvas: var(--primitive-gray-100);        /* preview background */
--surface-accent-soft: var(--primitive-blue-100);

/* Text */
--text-primary: var(--primitive-gray-900);
--text-secondary: var(--primitive-gray-700);
--text-disabled: var(--primitive-gray-400);
--text-inverse: var(--primitive-gray-0);
--text-accent: var(--primitive-blue-600);

/* Borders */
--border-subtle: var(--primitive-gray-200);
--border-strong: var(--primitive-gray-400);

/* Intent (for banners, toasts — ADR-014) */
--intent-info-bg: var(--primitive-blue-100);
--intent-info-fg: var(--primitive-blue-700);
--intent-warning-bg: var(--primitive-yellow-100);
--intent-warning-fg: var(--primitive-yellow-700);
--intent-error-bg: var(--primitive-red-100);
--intent-error-fg: var(--primitive-red-700);
--intent-success-bg: var(--primitive-green-100);
--intent-success-fg: var(--primitive-green-700);

/* Interactive states */
--state-hover: oklch(from var(--surface-primary) calc(l - 0.04) c h);
--state-active: oklch(from var(--surface-primary) calc(l - 0.08) c h);
--state-focus-ring: var(--primitive-blue-400);
```

Dark-mode override rebinds **Layer 2 only**:

```css
[data-theme="dark"] {
  --surface-primary: var(--primitive-gray-900);
  --text-primary: var(--primitive-gray-100);
  ...
}
```

Components in `inspector.css`, `overlay.css`, etc. **consume only Layer 2**. Primitives are reserved for tokens.css.

### Contrast verification

Extend ADR-006 a11y gate:
- Generate a matrix of (text token) × (surface token) pairs.
- Assert contrast ratio ≥ 4.5 for normal text, ≥ 3.0 for large.
- Run in both light and dark themes.
- Fails CI on any regression.

### Migration

- Add Layer 2 tokens to `tokens.css` without changing primitives.
- Lint pass: forbid `--primitive-*` references outside `tokens.css` via stylelint rule.
- Migrate components module-by-module (8 files, ~1 day each).
- When migration complete, run contrast gate; fix any failures.

### FOUC invariant preserved

- Inline theme-resolve script in shell head remains unchanged.
- It sets `<html data-theme="...">` which triggers the Layer 2 rebind via CSS — no JS needed for token resolution.

---

## Consequences

**Positive:**
- Component code reads intent, not color: `color: var(--text-secondary)` vs. `color: var(--shell-text-muted)`.
- New themes (high-contrast, solarized, sepia) added by rebinding Layer 2 only.
- Contrast gate gives regression protection.
- Intent tokens unify ADR-014 banner styling (info/warning/error).
- Opens door to user-customizable accent color without rebuild.

**Negative:**
- Migration surface: ~30 component rules across 8 files. 1 dev-week.
- Two-layer system is harder to scan visually if you're used to primitives.
- `oklch(from ...)` state tokens require modern browsers (good coverage 2026, but verify on WebKit).

---

## Alternatives Considered

1. **Keep flat `--shell-*` system; fix inconsistencies point-by-point.** Rejected — treats symptoms.
2. **Adopt Tailwind tokens (utility-first).** Rejected — bundler-friendly; zero-build invariant.
3. **Style Dictionary / Theo generators.** Rejected — adds a build step.
4. **CSS Modules / component-scoped styles.** Rejected — requires bundler.

---

## Applied In

- v0.32.1 — Layer 2 semantic tokens in tokens.css; inspector.css migrated (WO-30)
- v0.28.x — Layer 2 tokens added; ADR-014 banners use intent tokens from day one
- v0.29.x — inspector.css, overlay.css migrated
- v0.30.x — all 8 CSS files migrated; contrast gate enabled in `test:gate-a11y`
- v0.31.x — stylelint rule enforces Layer 2 boundary

## Links
- [ADR-006 Accessibility CI Gate](ADR-006-accessibility-ci-gate.md) — contrast checks extend here
- [ADR-007 Visual Regression CI Gate](ADR-007-visual-regression-ci-gate.md) — visual regression catches Layer 2 rebind bugs
- [ADR-014 Error Boundaries](ADR-014-error-boundaries.md) — banner intent tokens
- editor/styles/tokens.css — current primitive layer
- AUDIT-A §Consistency of naming 7/10
- v0.21.0 and v0.22.1 changelogs — previous token polish rounds
