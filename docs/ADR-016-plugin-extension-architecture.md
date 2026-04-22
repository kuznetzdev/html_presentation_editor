# ADR-016: Plugin / Extension Architecture — opt-in custom elements via declarative manifest

**Status**: Layer 1 Accepted · Layer 2 Deferred
**Accepted in**: v0.32.2 via WO-35 (Layer 1 only).
**Phase**: v1.0 compatibility foundation; implementation v1.1+
**Owner**: Architecture · Extension surface
**Depends on**: ADR-011 (types), ADR-012 (bridge v2)
**Date**: 2026-04-20

---

## Context

Current editor treats every element in a deck uniformly: tag + attributes + CSS classes. Entity kinds (text, image, container, slide-root, ...) are hardcoded in `bridge-script.js::KNOWN_ENTITY_KINDS` and `bridge-commands.js::CANONICAL_ENTITY_KINDS`.

Real user decks increasingly use custom patterns:
- Callout boxes (tailwind-styled multi-element blocks)
- Chart renderers (canvas-driven)
- Animated slide wrappers (reveal.js fragments)
- Tailwind utility-first blocks the user wants to treat as one logical "card"

The current editor sees these as generic containers, missing the opportunity to offer kind-appropriate inspector controls, insert-palette entries, or context-menu actions.

Additionally: external extension demand is real but unproven. Shipping a plugin API is an irreversible commitment — once users author plugins, the API is forever. **We are not ready for that in v1.0.**

---

## Decision

**Split into two layers:**

### Layer 1 — Entity-kind registry (SHIPPED in v1.0 compatibility foundation)

Externalize `KNOWN_ENTITY_KINDS` from bridge-script.js into `editor/src/entity-kinds.js` as a **declarative table**:

```javascript
window.ENTITY_KINDS = [
  {
    id: "text",
    matches: (el) => el.matches("h1,h2,h3,h4,h5,h6,p,span,li,td,th,figcaption,blockquote"),
    label: "Текст",
    icon: "text",
    inspectorSections: ["typography", "color", "alignment"],
    contextMenu: ["edit-text", "copy", "delete"],
    dragResize: "free",
  },
  {
    id: "image",
    matches: (el) => el.matches("img, picture > img, svg"),
    label: "Изображение",
    ...
  },
  ...
];
```

Bridge-script consumes the registry at build time (template-string interpolation). Shell consumes it at import. Single source of truth.

Adding a new built-in kind = edit one file. Two consumers stay in sync. Fixes AUDIT-A §"duplicated KNOWN_ENTITY_KINDS" (PAIN-MAP P2-05).

### Layer 2 — External plugin protocol (DEFERRED, design only)

Reserve a namespaced extension point:

```javascript
// Plugins manifest in editor/plugins/<name>/manifest.js
window.registerPlugin({
  name: "callout-card",
  version: "1.0.0",
  apiVersion: 1,
  entityKinds: [ ...same shape as Layer 1... ],
  inspectorPanels: [...],  // optional
  contextMenuExtras: [...], // optional
});
```

- Plugin files are **loaded by the user** (not npm). Drag-drop a plugin folder; shell prompts "Trust this plugin?" with a warning.
- Plugins run same-origin (file://) — no sandboxing. **This is why we defer implementation**: security story (see AUDIT-D-01 analogue) is identical to untrusted HTML deck problem. Solving it properly requires the Trust Banner + sanitization infrastructure from P0-01 shipped first.
- Manifest is JSON-like (not arbitrary JS at load time). Actual plugin code executes only after user trust confirmation.

### What v1.0 ships

- Layer 1: entity-kind registry externalized.
- Layer 2: NOT IMPLEMENTED. Internal API shape designed + ADR written + no runtime support.

### What v1.1+ considers

- Layer 2 implementation — after the P0-01 Trust Banner, ADR-014 error boundaries, and ADR-012 bridge v2 are shipped.
- First two real plugins: authored in-tree to validate API shape before opening the gate.

---

## Consequences

**Positive:**
- Layer 1 kills the dupe (PAIN-MAP P2-05), improves evolvability, unlocks better custom-pattern support without commitment.
- Layer 2 design recorded now — when pressure builds, there's a thought-through answer, not a panic implementation.
- Plugins never ship before the security infrastructure is ready.

**Negative:**
- Temptation to implement Layer 2 before it's safe. Mitigated by the explicit "NOT IMPLEMENTED in v1.0" line.
- Layer 1 requires a coordinated edit across bridge-script and shell at migration; one-time cost.

---

## Alternatives Considered

1. **Full plugin API in v1.0.** Rejected — premature. No real plugin use cases in hand.
2. **No extensibility ever.** Rejected — entity-kind table externalization is a pure architectural win, independent of plugins.
3. **Web Components–based extensibility.** Interesting — custom-element lifecycle aligns with editor's "entity kind" concept. Noted for Layer 2 design iteration.
4. **npm-package plugins.** Rejected — requires package manager, contradicts zero-build invariant.

---

## Applied In

- v0.29.x — entity-kind registry externalized (Layer 1)
- v1.0 — plugin ADR stays Proposed; implementation deferred
- v1.1+ — Layer 2 reconsidered with security infra in place

## Links
- [ADR-012 Bridge Protocol v2](ADR-012-bridge-protocol-v2.md)
- [ADR-014 Error Boundaries](ADR-014-error-boundaries.md)
- AUDIT-A §"duplicated KNOWN_ENTITY_KINDS"
- AUDIT-D §"trust model" — plugins share the HTML-paste threat surface
- PAIN-MAP P2-05
- PAIN-MAP P3 §"Plugin/extension protocol"
