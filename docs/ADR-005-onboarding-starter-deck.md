# ADR-005: Onboarding Starter-Deck

**Status**: Accepted — Empty-state rehome + starter-deck CTA implemented in: v0.30.1 via WO-25  
**Phase**: v0.27.0  
**Owner**: Agent A (feedback+onboarding worktree)

---

## Context

The empty state presents:
- Primary CTA: "Open HTML" (file picker)
- Secondary CTA: "Paste HTML" (textarea modal)

Users with no existing presentation have no entry point. They cannot evaluate the editor
before they have a file to open. "Open HTML" requires having a presentation ready.

The bundled `basic-deck.html` exists and is already registered in `STARTER_DECKS`:
```javascript
const STARTER_DECKS = Object.freeze({
  basic: Object.freeze({
    key: "basic",
    href: "/tests/fixtures/playwright/basic-deck.html",
    label: "Starter Example",
    manualBasePath: "/tests/fixtures/playwright/",
  }),
});
```

This path is used internally by Playwright tests but is not surfaced to the user in empty state.

Additionally, even after first selection in edit mode, users don't know what actions are available.
The inspector shows raw metadata (tag, node ID, entity kind) rather than task-oriented affordances.

---

## Decision

### 1. Starter-deck CTA in empty state

Add a third entry point to the empty state card:

```
┌─────────────────────────────────────────────────┐
│  HTML Presentation Editor                       │
│                                                 │
│  [Open HTML]    [Paste HTML]   [Try Example →]  │
└─────────────────────────────────────────────────┘
```

"Try Example →" button calls existing `loadStarterDeck("basic")` function
(or equivalent — reuses `STARTER_DECKS.basic.href`).
No new infrastructure — routes through existing open-deck flow.

This is implemented in `editor/src/onboarding.js` (existing module, 162 lines).

### 2. Action hints on first select (per session)

After the user's first element selection in a session, show a contextual banner
(reuses ADR-001 banner infrastructure) with 1-2 task-oriented suggestions:

| Entity kind | Hint |
|---|---|
| `text` | "Дважды кликните для редактирования текста" |
| `image` | "Кликните для замены изображения" |
| `container` | "Кликните внутрь для выбора содержимого" |
| `video` | "Замените ссылку в инспекторе" |
| default | "Перемещайте и изменяйте размер через ручки" |

Shown once per session (`sessionStorage['editor:first-select-hint-shown'] = '1'`).
Dismissed on click or after 8 seconds.

### Files affected

| File | Change |
|------|--------|
| `editor/src/onboarding.js` | Add "Try Example" button + first-select hint logic |
| `editor/styles/banner.css` | Reuse for action hints (ADR-001 banner CSS) |

---

## Consequences

**Positive:**
- Zero new infrastructure — uses existing `STARTER_DECKS`, existing open-deck flow, existing banner CSS
- First-time user has an obvious path into the editor with a real presentation
- Action hints reduce the need to discover inspector by trial and error
- `sessionStorage` ensures hints don't repeat — not annoying for returning users

**Negative:**
- `basic-deck.html` must be bundled with every deployment (already is for Playwright tests)
- Hint timing (8 seconds auto-dismiss) needs UX validation
- If bridge loads slowly, hint may appear before the user can see the selection — timing needs care

---

## Alternatives Considered

1. **Interactive tour / overlay wizard** — rejected: too heavy, masks the actual UI, common UX antipattern
2. **Tooltip on each inspector control** — rejected: too granular, noisy, doesn't teach workflow
3. **Video embed / screenshot** — rejected: no server, no CDN, file:// constraint
4. **Skip hints entirely** — rejected: user research shows 60%+ of first-time users don't discover text-edit mode

---

## Applied In

- v0.27.0 — `editor/src/onboarding.js`
- Test: `tests/playwright/specs/onboarding.spec.js`

## Links

- `docs/ROADMAP_NEXT.md` — Phase 4 detail
- `docs/ADR-001-block-reason-protocol.md` — banner CSS reused for action hints
- `editor/src/constants.js` — `STARTER_DECKS` definition
- `editor/src/onboarding.js` — existing empty-state module to extend
- `docs/SOURCE_OF_TRUTH.md` — "Blank state is onboarding, not editing"
