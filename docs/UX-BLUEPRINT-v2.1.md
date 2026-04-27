# UX Blueprint — v2.1 (2026-04-28)

**Owner:** UX Overhaul Lead Architect (autonomous session)
**Source:** [PAIN-MAP-UX-v2.1-2026-04-28.md](audit/PAIN-MAP-UX-v2.1-2026-04-28.md)
**ADR:** [ADR-031-ux-overhaul-v2.1.md](ADR-031-ux-overhaul-v2.1.md) (Proposed → Accepted at end of session)
**Branch:** claude/ux-deep-overhaul-v2.1
**Tag target:** v2.1.0-rc.1

This blueprint translates PAIN-MAP P0 + selected P1 items into atomic patches grouped by component. Each patch lists: scope, files allowed, acceptance criteria, and Gate-A check requirement.

## Phase C — Foundations (1 sub-agent, ~60 min)

### C.1 — Type scale + display token
- **Closes:** P-21, P-10 (partial)
- **Files:** `editor/styles/tokens.css`
- **Add tokens:**
  - `--text-3xl: 28px` (hero/landing — replaces hardcoded 32px in empty-state)
  - `--text-md-plus: 15px` (lead text, summary-title) — only if needed for replacements
  - Document `--text-2xs` (10px) explicitly as "decorative micro-label only"
- **Don't add yet:** `--space-3-5` (14px) — instead, eliminate 14px usages by snapping to 12 or 16 in Phase D
- **Acceptance:** tokens exist; no token name conflict; `git grep --count "var(--text-3xl)"` ≥ 1 after phase D

### C.2 — Motion semantic alignment
- **Closes:** foundation work for Phase E
- **Files:** `editor/styles/tokens.css`
- **Audit:** ensure `--motion-fast/medium` and `--motion-micro/base/emphasis` (already in tokens) are usable as the only sources of timing
- **Don't:** add new motion primitives; the existing 5 levels are sufficient

### C.3 — Light-theme contrast guard
- **Closes:** P-36 (partial — adds test, no CSS change yet)
- **Files:** none in C; queued as test addition for Phase F
- **Acceptance:** test plan documented; deferred to gate-a11y expansion (separate WO)

**Phase C self-check:**
- `npm run test:gate-a` zero deltas (tokens additions don't touch existing rules)
- `git diff` shows only `tokens.css`
- Skill: simplify pass

---

## Phase D — Component rework (3 serial sub-agents)

### D1 — Topbar + Empty state (~40 min)

#### D1.1 — Topbar identity dedup (P-08)
- **Files:** `editor/presentation-editor.html` (topbar block), `editor/styles/layout.css` (topbar identity rules)
- **Change:**
  - Drop `topbar-eyebrow` ("Живой HTML-редактор") at all workflow states
  - On `loaded-*`, h1 becomes the deck filename via `documentMeta` JS update
  - Empty state: keep h1 but tighten copy
- **Acceptance:** Visual hierarchy in topbar = 1 title row (h1 + meta) + 1 cluster row; no two-line stacked identity
- **Test impact:** verify `shell.smoke.spec.js` topbar-identity assertions still pass

#### D1.2 — Topbar action density (P-07)
- **Files:** `editor/presentation-editor.html` (topbarCommandCluster), `editor/src/shell-layout.js` (overflow logic), `editor/styles/layout.css`
- **Change:**
  - Inline-only when desktop+ width: `Open` + `Show` + `Export HTML` (3 buttons)
  - Move to overflow `⋯`: `Theme`, `Undo`, `Redo`, `Export PPTX` (4 buttons)
  - Single `⋯` button + dropdown (already exists; expand its contents)
- **Acceptance:** ≤3 inline command buttons; M3 conformance
- **Test impact:** check `shortcut-discovery-hints.spec.js`, `workspace-settings.spec.js` for topbar buttons assertions

#### D1.3 — Empty state CTA hierarchy (P-04)
- **Files:** `editor/presentation-editor.html` (empty-state-actions), `editor/styles/preview.css` (empty-state actions)
- **Change:**
  - `#emptyOpenBtn` stays full primary
  - `#emptyPasteBtn` → demoted to ghost-link size (drop solid border; smaller padding)
  - `#emptyStarterDeckBtn` already text-link — keep
- **Result:** 80/20 visual hierarchy
- **Acceptance:** `#emptyPasteBtn` has visibly less weight than `#emptyOpenBtn`
- **Test impact:** `onboarding.spec.js` "empty state renders 2 main CTAs" — assertion must still find both buttons

#### D1.4 — Type-scale escape: pills + lead (P-10, P-21)
- **Files:** `editor/styles/preview.css`
- **Change:**
  - `#interactionStatePill, #previewLifecyclePill` font-size 9px → `var(--text-xs)` (11px) — but note these get folded into status-pill consolidation in D1.5
  - `#previewNoteText`, `#previewStatusSummary`, `#activeSlideLabel` — round to nearest token
  - `.empty-state strong` 32px → `var(--text-3xl)` (28px)
- **Acceptance:** `git grep -E "font-size: (9px|10\\.5px|11\\.5px|12\\.5px|32px)" editor/styles/` returns 0 results

#### D1.5 — Status pill consolidation (P-05, P-06, P-20)
- **Files:** `editor/presentation-editor.html` (preview-note + topbar state cluster), `editor/src/primary-action.js` (state→label mapping), `editor/styles/preview.css`, `editor/styles/layout.css`
- **Change:**
  - Delete `#interactionStatePill` (DOM + JS refs)
  - Delete `#previewLifecyclePill` (DOM + JS refs)
  - Delete `#workspaceStateBadge` (DOM + JS refs)
  - **Single source of truth:** `#saveStatePill` (in topbar) absorbs save+lifecycle into one pill with crisp copy: `Сохранено · HH:MM` / `Не сохранено · HH:MM` / `Загрузка превью…` / `Не сохранено`
  - `#deckHealthBadge` stays (Smart Import, separate concern)
- **Acceptance:**
  - Tests asserting `interactionStatePill`, `previewLifecyclePill`, `workspaceStateBadge` either updated or removed
  - One status row in topbar = `#saveStatePill` + `#deckHealthBadge`
- **Test impact:** Likely affects `shell.smoke.spec.js`, `honest-feedback.spec.js`, `error-recovery-boundary.spec.js`. Patch tests in same commit.

#### D1.6 — Preview-note slim (P-05)
- **Files:** `editor/presentation-editor.html` (preview-note block)
- **Change:**
  - Drop the eyebrow "Следующий шаг"
  - Title (`#previewNoteTitle`) becomes the only top-of-card text
  - Drop body text `#previewNoteText` (shown only as title's subtext if needed)
  - Move `#previewStatusSummary`, `#activeSlideLabel` → into a single inline meta row OR drop (already in topbar after D1.5)
  - Action row stays but becomes 1 primary + (if relevant) 1 secondary; reload + insert palette move to a separate utility row attached to canvas
- **Acceptance:** preview-note has ≤4 visible elements (was 11)

#### D1.7 — Iframe title RU (P-17)
- **Files:** `editor/presentation-editor.html` line 558
- **Change:** `title="Preview"` → `title="Превью презентации"`
- **Acceptance:** grep `editor/presentation-editor.html` for `title="Preview"` returns 0

#### D1.8 — Skip-link (P-15)
- **Files:** `editor/presentation-editor.html` (first child of body), `editor/styles/base.css` (.skip-link rule)
- **Change:** add `<a id="skipToMain" class="skip-link" href="#workspace">Перейти к рабочей области</a>` + visually-hidden CSS that becomes visible on `:focus-visible`
- **Acceptance:** Tab from address bar lands on skip-link first; activating jumps focus to `#workspace`

**D1 commit pattern:** 3-4 commits (identity+density / empty-state / status-consolidation / iframe+skip-link). Each must Gate-A pass.

---

### D2 — Inspector + Slide rail (~40 min)

#### D2.1 — Basic-mode contract enforcement (P-03)
- **Files:** `editor/presentation-editor.html` (inspectorPanel block), `editor/src/shell-overlays.js` (or similar), `editor/styles/responsive.css` if needed
- **Change:**
  - When `body[data-editor-workflow="empty"]`, the entire inspectorPanel becomes `hidden` attribute true (not just CSS display:none)
  - JS: also set `inert` attribute (modern equivalent — supported in Chromium-based browsers; gracefully ignored in older Firefox)
- **Acceptance:** AT users get no announcement of mode-toggle in empty state; `axe-core` reports no aria-hidden inside non-aria-hidden focusable parent

#### D2.2 — Inspector basic-mode density (P-09, P-11, P-19)
- **Files:** `editor/presentation-editor.html` (currentElementSection), `editor/src/inspector-sync.js` (controls visibility), `editor/styles/inspector.css`
- **Change (P-09):** when nothing selected, render `inspector-empty-hint` BEFORE `insertSection` (re-arrange DOM order)
- **Change (P-11):** gate `selectionModeToggle`, `selectionBreadcrumbs`, `stackDepthBadge` to `data-ui-level="advanced"` — basic-mode shows: summary-card → quick-actions → block-reason banner → text-quick-edit + image-quick-edit + geometry-quick-edit (existing entity-kind compact sections)
- **Change (P-19):** add `inspector-section--prominent` modifier with bigger top/bottom padding (24px) and accent border-left for the currently-relevant section; collapse-by-default for less-frequent sections (table, layers, policy, diagnostics) via `aria-expanded="false"` initial state
- **Acceptance:** Tab through inspector in basic mode visits ≤6 controls before the user can act on selection (was 12+)

#### D2.3 — Inspector summary card (P-18)
- **Files:** `editor/presentation-editor.html` (currentElementSection h3), `editor/styles/inspector.css`
- **Change:** drop redundant `<h3>Текущий элемент</h3>`; promote summary-card to be the section's heading. Apply same to `currentSlideSection`
- **Acceptance:** no `h3` adjacent to summary-card; section heading conveyed by summary-kicker only

#### D2.4 — Inspector header layout (P-12)
- **Files:** `editor/styles/inspector.css` (panel-header-actions); maybe `editor/presentation-editor.html`
- **Change:** move `.panel-close-btn` to absolute top-right corner of `.shell-panel-right`; separate from mode-toggle by ≥40px (or hide on desktop where panel never closes)
- **Acceptance:** mode-toggle and close-button no longer adjacent

#### D2.5 — Slide-section danger isolation (P-25)
- **Files:** `editor/presentation-editor.html` (currentSlideSection actions grid), `editor/styles/inspector.css`
- **Change:** add `.danger-btn` modifier class (or use existing if any); apply to `#deleteCurrentSlideBtn`; visually red text + position last in grid
- **Acceptance:** "Удалить слайд" visibly distinct from constructive actions

#### D2.6 — Slide rail visual cleanup (P-31)
- **Files:** `editor/styles/preview.css` (`.slide-item` rules)
- **Change:**
  - Drop the `::before` LED dot
  - Replace `transform: scale(1.02)` hover with `background-color` change on `.slide-item-main`
  - Active state: solid background tint + 2px accent border-left
- **Acceptance:** slide rail no longer shifts row positions on hover

#### D2.7 — Inspector mode toggle aria-pressed (P-30)
- **Files:** `editor/presentation-editor.html` mode-toggle buttons (3 places: previewMode, basicMode/advancedMode, smartMode/containerMode)
- **Change:** add `aria-pressed="true"` to `.is-active` defaults and `aria-pressed="false"` to siblings in HTML
- **Acceptance:** progressive enhancement parity (works without JS for static announcement)

**D2 commit pattern:** 3 commits (basic-contract / density-rework / visual-cleanup). Each must Gate-A pass.

---

### D3 — Floating toolbar + Context menu + Modal a11y (~40 min)

#### D3.1 — Modal a11y semantics (P-01, P-37)
- **Files:** `editor/presentation-editor.html` 4 modals (#openHtmlModal, #htmlEditorModal, #videoInsertModal, #shortcutsModal)
- **Change:**
  - Each modal container: add `role="dialog" aria-modal="true" aria-labelledby="<modalId>Title"`
  - Each modal `<h3>` title: add matching `id`
  - Promote h3 to h2 (per F9), demote h4 to h3 inside modals
- **Acceptance:** axe-core "aria-required-attr" passes on all 4

#### D3.2 — Context menu role=menuitem (P-02)
- **Files:** `editor/src/context-menu.js`
- **Change:** in renderContextMenu loop, `button.setAttribute("role", "menuitem")`; add `aria-orientation="vertical"` on `#contextMenu`
- **Acceptance:** axe-core "aria-required-children" passes; NVDA reads "menu" with correct item count

#### D3.3 — Aria-orientation on transient menus (P-29)
- **Files:** `editor/presentation-editor.html` `#topbarOverflowMenu`, `#slideTemplateBar`, `#quickPalette`, `#contextMenu`
- **Change:** add `aria-orientation` attr (vertical for first 3, horizontal for `#quickPalette`)
- **Acceptance:** all 4 transient menus declare orientation explicitly

#### D3.4 — Floating toolbar content-aware filtering (P-13, P-23)
- **Files:** `editor/src/floating-toolbar.js`
- **Change:** when applying selection metadata (text/image/video/container/etc), filter visible groups:
  - text element → show ftGeneralGroup + ftTextGroup + ftAlignGroup; hide ftMediaGroup
  - image element → show ftGeneralGroup + ftMediaGroup; hide ftTextGroup + ftAlignGroup
  - other → ftGeneralGroup only
- **Acceptance:** selecting a paragraph reveals at most 8-10 buttons (was 17); width ≤400px

#### D3.5 — Floating toolbar drag-handle visual (P-32)
- **Files:** `editor/styles/overlay.css` (.floating-toolbar rules), `editor/presentation-editor.html` (handle markup)
- **Change:** convert `<button id="ftHandleBtn">⋮⋮</button>` to a non-interactive visual rail (CSS `::before` of toolbar with grab cursor); drag listener stays on toolbar root; collapse button moves to right edge (away from delete)
- **Acceptance:** delete-button (🗑) not adjacent to drag-handle visual

#### D3.6 — Beta badge contrast (P-14)
- **Files:** `editor/styles/base.css` `.experimental-badge` rule
- **Change:** font-size 10px → 11px; color rgb(138,95,0) → #6b4a00 OR change background to opaque #fff3d6
- **Acceptance:** contrast ≥ 4.5:1 measured

#### D3.7 — Toast severity (P-34)
- **Files:** `editor/src/feedback.js` showToast function
- **Change:** when `type === "error"`, set `toast.setAttribute("role", "alert")` on the individual toast div (parallel to existing aria-live polite container)
- **Acceptance:** error toasts are assertively announced

#### D3.8 — Esc cancellation (P-24)
- **Files:** `editor/src/shortcuts.js` (or wherever keymap lives), `editor/src/shell-overlays.js`
- **Change:** ensure Escape key handler:
  - If overlay open (palette/picker/menu) → close it, restore focus
  - Else if selection active → clear selection
  - Else no-op (don't fire on input/textarea focus)
- **Acceptance:** sequential Esc unwinds overlays in expected order

**D3 commit pattern:** 3 commits (a11y-structural / floating-toolbar-rework / esc-toast). Each must Gate-A pass.

---

## Phase E — Journey polish (~60 min)

### E.1 — Workflow marker transitions (motion)
- **Files:** `editor/styles/layout.css`, `editor/styles/preview.css`
- **Change:** When `data-editor-workflow` flips between empty/loaded-preview/loaded-edit, transition opacity (180ms) on the elements that appear/disappear (panel-header, preview-note, inspector-panel)
- **prefers-reduced-motion:** all transitions clamped to `transition: none` per `@media (prefers-reduced-motion: reduce)`
- **Acceptance:** no layout shift during transitions; animations honor reduced-motion

### E.2 — Selection feedback motion
- **Files:** `editor/styles/overlay.css`
- **Change:** ensure existing selection-frame fade-in uses `--motion-base` token; selection clearing fades out, not snap; `prefers-reduced-motion` → instant
- **Acceptance:** selecting on canvas feels intentional, not jittery

### E.3 — Toast position consistency (P-52)
- **Files:** `editor/styles/overlay.css`
- **Change:** desktop toast position to bottom-right (currently top-right); mobile already bottom-center
- **Acceptance:** consistent bottom positioning across viewports

### E.4 — Selection label off-screen guard (P-44)
- **Files:** `editor/src/selection.js` (renderSelectionOverlay)
- **Change:** if `frameRect.top < 40`, set label `transform: translateY(38px)` instead of `top: -34px`
- **Acceptance:** selection labels visible on first row of slide

**Phase E self-check:** Manual journey 3x on prepodovai/selectios decks; F12 Performance no layout thrashing.

---

## Phase F — Verification + delivery

- All gates green: `gate-a` (target same as baseline 317-318/8/0-1, no regressions), `gate-a11y` ≥ 27/0/0 (no a11y regressions; +28 tests is separate WO), `gate-contract` 152/0
- Manual flow: open → click empty CTA → select slide → click element → modify → undo/redo → export → reopen
- Vault entries: Daily/2026-04-28, ADR-031 Accepted, PROJ - UX Overhaul v2.1, CHANGELOG entry
- `package.json` version → 2.1.0-rc.1
- git tag v2.1.0-rc.1 on branch HEAD
- Branch pushed; NO merge to main without human review

## Out of blueprint (intentional defer)

- P-27 selection mode jargon ("⊞ Листы / ▣ Группы") — needs ADR for new naming
- P-33 block-reason canvas-near surface — needs floating-banner component
- P-35 selection-frame Tab burden — needs handle-grouping rework
- P-38 restore banner empty-state integration — significant DOM rewrite
- P-45 layers panel — separate L-effort feature, P2
- 28 new gate-a11y tests — A2 plan exists but writing is separate WO
- P2 items overall (16 items) — V2.1.x or v2.2

## Acceptance contract for v2.1.0-rc.1

A user opens the editor on file:// and:
1. Sees a clean landing — no editor chrome, single dominant CTA
2. After loading a deck, the topbar shows ≤3 actions; status is one pill
3. Selecting an element brings up only relevant tools (text-only OR image-only OR container)
4. Inspector basic mode shows summary card → quick actions → no power-user toggles
5. Pressing Esc reliably exits any overlay
6. Tab from address bar reaches the workspace in ≤2 stops (skip-link)
7. Screen-reader announces modals as dialogs; menu items as menuitems
8. No 9px text anywhere; no English iframe title in Russian UI
9. Save status conveyed by ONE pill with timestamps
10. Floating toolbar drag-handle is not next to delete

If 8/10 of these are true at end of session, v2.1.0-rc.1 ships. Below that, defer to v2.1.0-rc.2.
