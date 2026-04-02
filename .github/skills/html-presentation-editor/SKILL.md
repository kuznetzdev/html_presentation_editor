---
name: html-presentation-editor
description: "Work on the HTML Presentation Editor project. Use when implementing features, fixing bugs, refactoring, or adding tests in this codebase. Covers architecture, entity model, selection engine, bridge protocol, inspector, breadcrumbs, and Playwright testing patterns."
argument-hint: "Describe the feature or fix e.g. 'implement deep select', 'fix breadcrumb hover', 'add context menu layer picker'"
---

# HTML Presentation Editor — Project Skill

## When to Use
- Implementing new editor features (selection, inspection, navigation, formatting)
- Fixing bugs in canvas interaction, bridge communication, or inspector UI
- Adding or updating Playwright tests against the editor
- Understanding architecture before making changes

---

## Architecture Overview

**Single monolithic file**: `editor/presentation-editor-v12.html` (~18 000 lines)  
**Three-layer architecture (non-negotiable)**:

| Layer | What it owns |
|-------|-------------|
| **Parent shell** | Topbar, slide rail, inspector, context menu, floating toolbar, history, autosave, export, all state |
| **Iframe preview** | Truthful runtime DOM, presentation scripts, in-document selection & editing |
| **Bridge** | postMessage protocol: parent ↔ iframe commands and state sync |

`modelDoc` is the canonical document model in the parent — export, undo/redo, and restore all source from it.

### Bridge Token
Every preview load creates `state.bridgeToken`. All bridge messages must include and validate the token to prevent stale iframe pollution.

---

## Entity Model — 13 Canonical Kinds

```
"text" | "image" | "video" | "container" | "element" |
"slide-root" | "protected" | "table" | "table-cell" |
"code-block" | "svg" | "fragment" | "none"
```

### Marker Attribute System (three layers, never mix)

| Priority | Attribute | Owner |
|----------|-----------|-------|
| 1 (editor) | `data-editor-node-id`, `data-editor-entity-kind`, `data-editor-editable`, `data-editor-policy-kind` | Editor runtime, written by editor |
| 2 (author) | `data-node-id`, `data-node-type`, `data-slide-id` | Presentation author, READ ONLY |
| 3 (heuristic) | Tag/role inference via `resolveImportedEntityKind()` | Fallback when no markers |

**NEVER overwrite author `data-*` attributes.** Editor uses its own `data-editor-*` namespace.

### Entity Kind Resolution
Function: `resolveImportedEntityKind(el, slideRoot)` (line ~6485)  
Order: `slide-root → protected → table → table-cell → code-block → image → video → fragment → text → container → element → none`

---

## Selection System — Current State

### State Shape (line ~4943)
```js
state.selectedNodeId         // ID of selected entity
state.selectionLeafNodeId    // deepest (leaf) element in path
state.selectionPath[]        // [{nodeId, label, current, isLeaf, el}, ...] leaf-first
state.selectedRect           // BBox for selection overlay
state.selectedFlags          // {canEditText, isImage, isVideo, isContainer, isSlideRoot, isProtected, isTextEditing}
state.selectedEntityKind     // one of the 13 canonical kinds
```

### Selection Flow
1. Canvas click → `resolveSelectionFromTarget()` (line ~9848) collects candidates
2. Score candidates by visibility + DOM stack depth
3. Alt+click cycles through the ancestor chain
4. Shell sends `sendToBridge("select-element", payload)` to iframe
5. Iframe highlights & measures; sends back `"element-selected"` message
6. `applyElementSelection()` (line ~10576) normalizes payload → updates state
7. `renderSelectionBreadcrumbs()` (line ~15749) rebuilds crumb strip
8. Inspector sections toggle by entity kind via `data-entity-groups`

### Smart Select Priority (implement as scoring, higher = more preferred)
```
text (leaf)          → 100
table-cell           → 90
code-block           → 85
image                → 80
video                → 75
svg root             → 70
fragment             → 60
container            → 40
element              → 30
slide-root           → 10
none / protected     → 0
```

---

## Breadcrumbs — Current Implementation

- Rendered by `renderSelectionBreadcrumbs()` from `state.selectionPath[]`
- Each crumb is a `<button data-selection-path-node-id="...">` with label
- Click on crumb → build selection payload for that ancestor → bridge sends to iframe
- Labels currently show raw HTML tag names (improvement target: show entity kind label)
- Path format: `Slide N > tag > tag > tag` (improvement target: use semantic names)

---

## Context Menu — Current Implementation

- Right-click on canvas → `document.addEventListener('contextmenu')` (line ~9885)
- Bridge also sends `"context-menu"` message from iframe on right-click
- Both path → `openContextMenuFromBridge(payload)`
- Menu built dynamically from `selectedEntityKind` + `selectedFlags`
- Current items: duplicate, delete, edit text, replace media, copy/paste style, table ops
- **Missing**: "Select layer..." submenu showing all candidates under cursor

---

## Inspector Panel

- Sections controlled by `data-entity-groups` attributes — only relevant sections show
- Basic mode: summary card + breadcrumbs + common controls
- Advanced mode: raw attributes, diagnostics, geometry, developer info
- Complexity toggle stored in `state.complexityMode` and localStorage
- Table operations section appears only when `selectedEntityKind === "table" || "table-cell"`

---

## Bridge Protocol — Key Commands

### Parent → Iframe
```
"select-element"           { nodeId, highlightOnly? }
"apply-style"              { nodeId, property, value }
"apply-styles"             { nodeId, styles: {} }
"update-attributes"        { nodeId, attributes: {} }
"set-mode"                 { mode: "preview"|"edit" }
"delete-element"           { nodeId }
"duplicate-element"        { nodeId }
"move-element"             { nodeId, direction }
"insert-element"           { slideId, html, position }
"replace-node-html"        { nodeId, html }
"begin-direct-manipulation" / "update-direct-manipulation" / "commit-direct-manipulation"
```

### Iframe → Parent
```
"element-selected"         full selection payload (nodeId, entityKind, path, rect, flags)
"context-menu"             { x, y, nodeId } right-click from inside iframe
"slide-activated"          { slideId, index }
"heartbeat"                periodic connectivity check
```

Send via: `sendToBridge(command, payload)` (line ~10309)

---

## Implementation Workflow

When adding/changing any feature in this editor:

### Step 1 — Analysis
- Search for the relevant handler/function by name or line number (see map above)
- Understand which layer owns the logic: shell state, bridge protocol, or iframe runtime
- Check `state.selectedFlags` and `state.selectedEntityKind` to know what's currently available
- Check `SOURCE_OF_TRUTH.md` for signed-off invariants before touching any contract

### Step 2 — Design
- Selection changes → modify `resolveSelectionFromTarget()` + scoring, update state shape if needed
- UI changes (inspector, breadcrumbs, context menu) → shell side only
- In-document changes (highlight overlay, event capture) → iframe/bridge side
- Never couple selection logic with text-edit logic — they are separate concerns

### Step 3 — Implement
- For new entity kinds: add to the 13-kind enum AND to `resolveImportedEntityKind()`
- For new bridge commands: add enum entry + handler in iframe + dispatcher in parent
- For new inspector sections: control visibility with `data-entity-groups`
- For new keyboard shortcuts: register in the unified keyboard handler (search `keydown`)

### Step 4 — Contracts to Never Break
- Export output must be bit-for-bit identical for unchanged slides
- Author `data-*`, classes, CSS variables, fragment state, SVG structure → READ ONLY
- `iframe + bridge + modelDoc` triple-layer architecture → keep intact
- All new editor metadata goes in `data-editor-*` namespace
- Protected entities (`data-editor-policy-kind="protected"`) must refuse text editing
- No `innerHTML` mass-rewrite of slides outside history-tracked mutations

### Step 5 — Test
Use existing Playwright test infrastructure at `tests/playwright/`.

**Minimum test scenarios per selection feature:**
1. Click selects expected entity kind (not wrong parent/sibling)
2. Deep select (Alt+Click) reaches leaf entity
3. Shift+Enter / ancestor-walk reaches slide-root correctly
4. Breadcrumb click re-selects corresponding ancestor
5. Context "Select layer" shows correct candidates under cursor
6. Tab/Shift+Tab navigates table cells in order
7. Selection does not change on Export (regression guard)

**Reference presentations to test against** (`references_pres/html-presentation-examples_v1/`):
- `03-absolute-positioned.html` — overlap, nested
- `04-data-attributes-editorish.html` — author markers
- `07-svg-heavy.html` — SVG selection rules
- `08-table-and-report.html` — table-cell navigation
- `09-mixed-media.html` — image/video selection

---

## Common Pitfalls

| Pitfall | Fix |
|---------|-----|
| Selecting `<span>` inside text element instead of text entity | Score leaf text entity higher than sub-spans; stop walking DOM at text boundary |
| Alt+click cycling wraps to wrong element | Use `selectionPath[]` as the cycle stack, not raw DOM ancestors |
| Breadcrumbs show raw tag names | Build label from `entityKind` + `data-node-id` or `textContent` snippet |
| Context menu "Select layer" missing | Collect all hit-tested entities under cursor into candidate stack before showing menu |
| SVG internals becoming individually selectable | `svg` entity kind = stop at `<svg>` root; only go deeper on explicit Deep Select |
| Fragment loses `data-*` state after selection interaction | Never reassign innerHTML of fragment containers; only touch `data-editor-*` |
| Export includes editor overlays | All overlay elements must have `data-editor-ui="true"` so export serializer strips them |

---

## Key Line Number Map (v12)

| Symbol | Line |
|--------|------|
| Entity kind constants | ~4569 |
| State shape init | ~4943 |
| `resolveImportedEntityKind()` | ~6485 |
| `createBridgeToken()` | ~6937 |
| `sendToBridge()` | ~10309 |
| Canvas click handler | ~9848 |
| Context menu handler | ~9885 |
| `applyElementSelection()` | ~10576 |
| `renderSelectionBreadcrumbs()` | ~15749 |
| Inspector section CSS | ~3799 |
| Context menu CSS | ~2333 |

> Line numbers are approximate for v12; always grep/search before editing.
