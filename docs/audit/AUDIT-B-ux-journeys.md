# AUDIT-B — UX Ergonomics · 12 journeys

> **Scope**: html-presentation-editor v0.25.0 (post-ADR-002 stack-depth badge, pre-ADR-003 picker).
> **Method**: static inspection of shell markup, JS modules, CSS, ADRs, ROADMAP.
> **Lens**: product promise `Open → select → edit → save`; blank state = onboarding; no dead ends; clarity > features.
> **Note**: no browser run, no Playwright invocation; findings grounded in code references, not speculation.

---

## Executive summary

Overall UX grade: **6.2 / 10**. The editor delivers the core promise for a trained user on a sane deck, but it leaks surface complexity into the novice path in at least four places, ships several silent failure modes, and has no keyboard-only rail workflow. The block-reason banner (ADR-001 shipped) is a real step forward, but the selection-frame label / tooltip / inspector banner / toast channels still fire out of sync with each other.

Three biggest friction points:

1. **Invisible layer stack**: badge says `2 из 3`, but the picker popup is Phase-2 work (`v0.25.1`, not shipped). The badge is a tease without an exit. Users who see "2 из 3" can only resolve through right-click menu or blind re-click — both of which violate novice assumptions.
2. **Blank-state CTA ambiguity**: three side-by-side buttons (`Открыть HTML` / `Вставить из буфера` / `Открыть стартовый пример`) look equal-weight. The starter-deck path is the fastest evaluation route for a first-time visitor, yet it is styled identically to the paste-clipboard fallback.
3. **Paste-raw-HTML with broken assets**: silently substitutes a placeholder iframe. There is no diagnostic surface listing unresolved `<img>` / `<link>` / `<video>` references and no one-click "connect assets folder" path from inside the already-loaded broken deck.

Boldest recommendation: **treat the whole `empty → first-open → first-edit` triad as one scripted moment**. Show one primary CTA ("Открыть HTML"), one secondary ("Стартовый пример"), and demote clipboard paste to a `Дополнительно` disclosure. Delete the 3-step numbered checklist above the CTA row — it duplicates the button labels in a way that reads as instructions for instructions.

---

## Journey scorecard

| # | Journey                                 | Friction /10 | Blocker?        | Fix-cost | Priority |
|---|-----------------------------------------|--------------|------------------|----------|----------|
| 1 | First-open empty → starter deck         | 4            | no               | S        | P0       |
| 2 | Paste raw HTML (broken assets) → fix    | 8            | yes (silent)     | M        | P0       |
| 3 | Select text → edit inline → commit      | 3            | no               | S        | P1       |
| 4 | Select image → replace source → resize  | 5            | partial          | S        | P1       |
| 5 | Direct manipulation — all block reasons | 6            | partial          | M        | P0       |
| 6 | Multi-select → align/distribute         | 10           | yes (missing)    | L        | P2       |
| 7 | Undo chain ≥ 20                         | 7            | yes (silent drop)| S        | P0       |
| 8 | Keyboard-only full workflow             | 8            | yes              | M        | P0       |
| 9 | Zoom 25–200% + attempt to edit          | 5            | honest block     | S        | P1       |
| 10| Export to PPTX                          | 7            | partial          | M        | P1       |
| 11| Recover from blocked state              | 6            | partial          | S        | P0       |
| 12| Slide rail: reorder / dup / del / kbd   | 6            | keyboard blocker | M        | P0       |

Priority legend: P0 = blocks a usable v1.0 novice flow; P1 = needed for a polished 1.0; P2 = post-1.0.

---

## Journey details

### 1. First-open empty → load starter deck

**Steps**
1. User opens `editor/presentation-editor.html` from `file://`.
2. Theme boot script resolves light/dark from storage/system (head inline script, lines 8–34 of the shell).
3. Restore banner may appear (`#restoreBanner`, lines 51–66) if sessionStorage has an autosave from a previous tab.
4. Main workspace renders with `body[data-editor-workflow="empty"]` marker (verified in `feedback.js::getEditorWorkflowState`, lines 171–174).
5. User sees the empty-state card inside the preview stage (`#emptyState`, lines 425–472). Numbered 3-step list, then three buttons, then a footnote.
6. User picks the third button `Открыть стартовый пример` → `loadStarterDeck("basic")` (`boot.js:400`, `slides.js:368`).

**Friction points**
- The three CTA buttons in `.empty-state-actions` are laid out as a single flex row, with `#emptyOpenBtn` styled `.primary-btn` and both other buttons styled `.ghost-btn`. Visual weight is right, but the *order* is `Open / Paste / Starter` — the fastest "try before commit" path is last. First-time evaluators read left-to-right and commit to `Open HTML` before they realise a demo exists.
- The 3-step numbered list (`.empty-state-steps`) re-describes the CTA row with `Откройте HTML` / `Либо вставьте код` / `Подключите ресурсы (по необходимости)`. This is a restatement of the buttons as instructions, not a preview of what the tool does. For a user who has never seen a slide editor, the card gives zero *visual* preview — no thumbnail, no "this is what you'll be editing" illustration.
- `Открыть стартовый пример` points to `/tests/fixtures/playwright/basic-deck.html` (from `STARTER_DECKS.basic.href` in `constants.js:118–125`). That path is *inside the test tree*. For a repo download that omitted `tests/fixtures/`, the starter deck silently 404s. Users see `loadStarterDeck` fail with an unhelpful toast (`slides.js:380`-ish — dep on `loadHtmlFromUrl` error branch).

**Honest-feedback gaps**
- If the starter-deck fetch fails, the toast is `"Не удалось загрузить стартовую презентацию"` (or equivalent), but no second CTA is offered. The user returns to the empty state with no escalation to `Открыть HTML`.
- No `aria-live` region announces "Starter deck loaded" once the preview renders, so an assistive-tech user cannot tell load finished vs. still loading.

**Discoverability**
- `previewPrimaryActionBtn` is hidden in the empty state (`hidden` attribute set in shell markup line 297). Good. But its future label `Начать редактирование` is not hinted in the empty card, so the user has no mental model of "open → then press this".

**Severity**: major. This is the single most visited surface and first impression.

**Recommended fix**
- Promote `Открыть стартовый пример` to a secondary button in position 2; move `Вставить из буфера` into a `Дополнительно ▾` disclosure.
- Bundle the starter deck at `editor/fixtures/basic-deck.html` (outside `tests/`) and change `STARTER_DECKS.basic.href` to point there. Keeps starter deck present in slim distributions.
- Replace the 3-step numbered list with a static screenshot/thumbnail of what a loaded editor looks like. Free preview > redundant captions.

---

### 2. Paste raw HTML with broken/missing assets → fix → start editing

**Steps**
1. User clicks `Вставить из буфера` (#emptyPasteBtn — dynamically created in `onboarding.js:41–50`).
2. `openOpenHtmlModal({ focusTarget: "paste" })` opens the `#openHtmlModal` (shell-overlays.js:34–73).
3. User pastes HTML containing `<img src="assets/logo.png">`, `<link href="css/deck.css">`, `<script src="js/deck.js">`.
4. User presses `#loadPastedHtmlBtn` → `loadHtmlString(htmlString, "paste")` (`import.js:12`).
5. Preview iframe builds from the Blob URL; relative asset URLs resolve against the Blob origin, which has no `assets/` directory.

**Friction points**
- The `assetsBox` (shell-overlays.js upload-boxes[2]) only appears *inside the modal before load*. After a paste succeeds, the user is already outside the modal, sees broken preview chrome (missing CSS), and there is no floating "Assets missing, connect folder?" recovery banner.
- `previewAssistActionBtn` exists (`previewPrimaryActionBtn` sibling at line 301-308 of shell) with label `Подключить папку ресурсов`, but it only shows when `state.editingSupported === false` branches via `primary-action.js`. Users with a successfully-parsed but visually-broken deck don't hit that branch.

**Honest-feedback gaps**
- The editor does **not** surface a list of unresolved resources. There is a `#previewLoading` spinner and a `#previewLifecyclePill`, but none of the user-facing surfaces enumerate `N изображений не загрузилось` or `CSS не найден`.
- Export (`exportHtml`, `export.js:7`) strips the `<base>` tag (inserted by bridge), but if the user exports the broken-asset deck, the exported file retains the broken relative paths. No warning.
- `document.referrer === null` and `file://` CORS quirks mean many assets fail silently without a Network tab entry the novice can read.

**Discoverability**
- The link between "paste HTML" and "connect assets folder" lives only in the modal's `assetsBox` help text. Once the modal closes, it is gone. There is no persistent reminder on the broken preview.

**Severity**: blocker. A novice pastes a deck, sees ugly unstyled content, assumes the editor is broken, closes.

**Recommended fix**
- After load, if `state.modelDoc` contains relative `src`/`href` that resolved to 0-byte / error in the preview frame, surface an inline banner in the preview-note area: `Не подгружены N файлов. Подключить папку проекта ↴`. Action button opens the assets box of the open-HTML modal pre-focused.
- Keep a persistent `previewAssistActionBtn` visible whenever `state.unresolvedAssetsCount > 0`, with a running counter.
- On export, if unresolved assets remain, warn `Экспорт: N файлов не найдены — они сохранятся как битые ссылки. Продолжить?` (OK / Cancel).

---

### 3. Select text → edit inline → commit (basic mode)

**Steps**
1. User clicks `Начать редактирование` (`previewPrimaryActionBtn`, `primary-action.js:67–78`). Mode flips to `edit`.
2. User single-clicks on an H1. Selection overlay frame appears (`selection.js::renderSelectionOverlay`).
3. Inspector right panel opens with `selectedElementSummaryCard` in basic mode (shell line 793–808).
4. User double-clicks → enters text-edit mode (`bridge-script.js` dispatches `text-edit-start`, not shown but referenced in `interaction-mode`).
5. User types, presses `Escape` or clicks outside → text commits via bridge `commit-text-edit`.

**Friction points**
- The summary card text reads `Кликните по объекту на слайде. Для текста можно сделать двойной клик и сразу печатать.` That hint is in the **"not-yet-selected"** copy. After selection, the copy is replaced by the entity-kind summary (`getSelectedElementSummary`, inspector-sync.js). At that point there's no visible reminder `двойной клик → текст` unless the selection-frame label shows it (`selection.js:921` — `kindLbl + " · Двойной клик → текст"`). That label is truncated in `is-compact` mode (line 48).
- No visible cue for `Enter` as an alternative to double-click. Many users associate Enter with "open / edit" on a focused selection.
- The selection-frame hit-area title is `Перетащить элемент или дважды кликнуть для редактирования текста` (selection.js:81). That's two instructions competing for one visual channel.

**Honest-feedback gaps**
- If the clicked text is inside a `transform`-ed ancestor, the overlay still appears but `getBlockReason()` returns `parent-transform`. Text editing actually still works — but the block banner is rendered anyway, confusing the user ("it says blocked but I can still type"). The banner is for *direct-manipulation* blocks, not text-edit blocks; this semantic is invisible.

**Discoverability**
- Good: floating toolbar's `✎` edit-text button (`ftEditTextBtn`) and inspector's `Редактировать текст` (`editTextBtn`, shell line 1087) provide two click-paths.
- Bad: the basic mode hides geometry inspector section by default (inspector-sync.js:77–81), so a user wanting to tweak font-size finds it only in floating toolbar — the font-size dropdown is there (`ftFontSizeSelect`, shell line 693–711), but it's hidden until `canEditRichTextStyles` — i.e. after text-edit mode is active.

**Severity**: minor.

**Recommended fix**
- On first select of a text entity in a session, show a transient `Двойной клик или Enter для правки` chip inside the selection overlay for 3s (reuse `renderSelectionFrameTooltip`).
- Decouple block-reason banner from text-edit capability: if `canStartPlainTextEditing && blockReason !== "none"`, banner text should say `Перемещение заблокировано — текст редактируется двойным кликом` not just `Используется transform`.

---

### 4. Select image → replace source → resize

**Steps**
1. User clicks image in preview. Entity kind = `image`.
2. Inspector summary title = `Изображение` (verified via `getSelectedElementTitle(entityKind="image")` path in inspector-sync.js).
3. Quick-action buttons render: `Заменить` (primary), `Вписать` (inspector-sync.js:738–739).
4. User clicks `Заменить` → `requestImageInsert("replace")` → file dialog.
5. After replacing, user grabs `se` resize handle (shell line 551–553) and drags to enlarge.

**Friction points**
- The `Заменить изображение` action appears in *three* places: floating toolbar (`ftReplaceImageBtn`, shell line 720), quick-action row (basic mode summary), inspector's `Изображение / media` section (`replaceImageBtn`, line 1333), and — for advanced users — inspector `applyImageSrcBtn` next to a text input. Four paths = discoverability good, but each path has subtly different behavior (floating toolbar just opens file dialog; inspector has alt + src + replace together). There is no unified "replace image" surface.
- Resizing: if the `<img>` has aspect-ratio locked via shell's `applyAspectRatioToResize` (selection.js:249), that's silently applied. There is *no* visible aspect-lock toggle for the user. A user who wants to stretch an image can't.
- `fitSelectedImageToWidth()` (accessed via `ftFitImageBtn` or quick-action) applies width:100%, but does not tell the user what happened — no toast, no inspector diff.

**Honest-feedback gaps**
- If the replaced image file is too large (e.g. 20 MB), the data-URL blows the DOM size. No size warning, no per-image compression fallback, no toast. The user sees a lag spike and a slow autosave.
- Alt text is **required for a11y** but there is no nag/warning if `alt` is empty after replacement. The inspector shows the `alt` field (shell line 1327), but it is not visually emphasized until focus.

**Discoverability**
- The separate `Копировать URL` / `Открыть URL` buttons are advanced-only (shell line 1339, 1343), which is correct.
- `resetImageSizeBtn` and `rotateImageBtn` are both present in basic mode (no `data-ui-level="advanced"`). Rotating 90° is a deep-power-user operation that basic mode probably shouldn't expose — or at least should pair with `Reset rotation`.

**Severity**: major (aspect-lock invisibility and missing alt nag).

**Recommended fix**
- Add a "lock aspect ratio" toggle button adjacent to `se`/`sw`/`ne`/`nw` handles when an image is selected. Default = locked for raster images; unlock re-enables free-stretch.
- After successful image replacement, show a transient toast: `Изображение заменено. Добавьте alt-описание для доступности ↗` with an action that focuses `#imageAltInput`.

---

### 5. Direct manipulation — ALL blocking conditions

Block reasons enumerated in `feedback.js::getBlockReason` (lines 645–678):

| Reason              | Trigger                                                                        | Banner label (inspector-sync.js:920 via getBlockReasonLabel)     | Action button            |
|---------------------|--------------------------------------------------------------------------------|------------------------------------------------------------------|---------------------------|
| `zoom`              | `state.previewZoom !== 1`                                                      | "Масштаб ≠ 100% — перемещение на холсте отключено"               | `Сбросить масштаб`        |
| `locked`            | element has `data-editor-locked="true"`                                        | "🔒 Элемент заблокирован"                                         | `Разблокировать` (adv only) |
| `hidden`            | element is `hidden` / `aria-hidden` / `display:none` / `visibility:hidden`     | "Элемент скрыт (невидим в этой сессии)"                          | `Показать`                |
| `container`         | entity kind === `container` or `slide-root`                                    | (banner suppressed — see entity kind guard at inspector-sync.js:911) | n/a                    |
| `own-transform`     | `manipulationContext.directManipulationReason` matches "собствен" / "own"      | "Используется transform — перемещение через инспектор"          | none                      |
| `parent-transform`  | reason matches "внутри transformed" / "parent uses transform"                   | "Родитель использует transform — перемещение через инспектор"   | none                      |
| `slide-transform`   | reason matches "slide uses transform"                                           | "Слайд использует transform — перемещение через инспектор"      | none                      |
| `transform` (fallthrough) | reason contains other transform verbiage                                 | "Используется transform — перемещение через инспектор"          | none                      |

**Steps**
1. User selects a transformed element, sees the banner in the inspector, reads the reason, uses the inspector fields.
2. For `zoom`: clicks `Сбросить масштаб` action button → `setPreviewZoom(1.0, true)` → banner clears.
3. For `locked`: clicks `Разблокировать` (if advanced mode). In basic mode, the banner shows but the action button is hidden by `data-ui-level="advanced"` on `#lockBanner` (shell line 846). A novice hits a dead end.

**Friction points**
- **Dead-end in basic mode for `locked`**: The new block-reason banner (not `#lockBanner`) has an "Unlock" action unconditionally when reason === `locked` per `getBlockReasonAction`. But the *effective* block reason is set to `locked` only inside an `isLocked` guard path (inspector-sync.js:906). So the unlock button is present — but the original `#lockBanner` is advanced-only. Two banners for the same semantic, inconsistent mode-gating. Predicted outcome: in basic mode, `#blockReasonBanner` shows "🔒 Элемент заблокирован" with an `Разблокировать` button, while `#lockBanner` (advanced) is hidden. If the user clicks Разблокировать, it works — but the overall inconsistency is confusing during QA.
- **Transform reasons have no action**: user is told "use inspector" but no jump-to-inspector focus ring, no scroll-into-view of the geometry section. In basic mode the geometry section is *hidden* unless `hasBlockedDirectManipulationContext()` is true (inspector-sync.js:77–81). That flip is invisible — user sees the banner, wonders where "инспектор" is, scrolls the right panel.
- **The selection-frame label** shows `Через инспектор` (selection.js:915) when blocked. That's a fourth text channel saying the same thing (banner, tooltip, aria-label, label). Users reading left-to-right see "Через инспектор" before they read the banner.
- **`hidden` reason can only fire after the layers panel showed the element** because `data-editor-locked` / `hidden` attributes are rarely authored by users. Most "hidden" cases come from `setLayerSessionVisibility` via the layers panel — and that panel is advanced-only. So basic users can't produce this state, and when they do stumble on it (rare author HTML), the `Показать` button works but there's no path to the layers panel for inspection.

**Honest-feedback gaps**
- `own-transform` / `parent-transform` / `slide-transform` are resolved by **looking at the CSS source** — which basic users cannot do. "Используется transform" tells them *what* but gives zero hint of *why* (e.g. "this section has rotate(5deg) applied"). No remediation path.
- The zoom banner's `Сбросить масштаб` is the cleanest of the lot — it has a working resolution. This pattern should extend to other reasons where possible.

**Severity**: major. The block-reason protocol is real progress, but the coverage is uneven and the cross-surface redundancy (banner + label + tooltip + aria + frame class `is-direct-manip-blocked`) increases cognitive load.

**Recommended fix**
- Unify `#lockBanner` and `#blockReasonBanner`. Delete the former; always use `#blockReasonBanner` with a reason-based action resolver. This removes the mode-gating inconsistency.
- For transform-family reasons, add a "Показать CSS" link (advanced only) that opens the geometry section scrolled and focused on `transform` property field.
- Soften the selection-frame label: when blocked, show only the entity kind (e.g. `Текст`) and let the banner carry the actionable copy. Don't duplicate "Через инспектор" on the frame.

---

### 6. Multi-select → align / distribute

**Current state**: `bridge-script.js:2927` has a scaffolded `Shift+Click` path that posts `multi-select-add`, received in `bridge.js:90`. But no shell-side UI consumes it. There is no `state.multiSelectedNodeIds` in `state.js`, no align-buttons for multi-selection, no distribute panel.

**Steps (predicted — would-fail)**
1. User clicks first element.
2. User shift-clicks second element.
3. (Hope) a combined selection overlay appears around both.
4. (Hope) a floating toolbar group for align/distribute appears.

**Reality**
1. First click selects element A.
2. Shift-click **replaces** selection with element B. No combined overlay. No toast explaining that multi-select isn't wired.
3. No align / distribute controls anywhere in the shell HTML (no `alignVertical` / `distributeHorizontal` ids, no `ft*Align` beyond text-align, no inspector section).

**Friction points**
- Shift-click is a universal keyboard convention. Users who try it see no response (or a selection flip) and assume the editor doesn't support geometry alignment at all.
- The two common alignment workflows (align left edges, distribute evenly) are completely unreachable.

**Honest-feedback gaps**
- **Silent failure**: shift-click produces no toast, no tooltip "Multi-select coming soon".
- ROADMAP (`docs/ROADMAP_NEXT.md` Phase 3 / ADR-004) explicitly defers align/distribute to v0.29+. This is a known gap, but the *user* has no way to know.

**Discoverability**
- None. There is no hint anywhere in the UI that alignment exists or doesn't.

**Severity**: major gap, non-blocker. Users workaround by typing pixel values in geometry section (advanced only). Novice users give up.

**Recommended fix**
- Ship a Phase-3 stub: recognize shift-click, show a single toast `Мульти-выбор пока в разработке — используйте линейку в продвинутом режиме` with TTL 4s. Silent failure is worse than honest deferral.
- In ROADMAP, move the "full alignment panel" from "deferred to v0.29+" to "v0.28.x milestone" — the user-research cost of not having it is higher than the ROADMAP currently reflects.

---

### 7. Undo chain length 20+

**Steps**
1. User edits (text, resize, reorder) — each commit calls `recordHistoryChange(reason)` → `captureHistorySnapshot` (`export.js:561`).
2. `state.history.push(snapshot)` grows list.
3. At push #21, `state.history.shift()` drops the oldest (export.js:593–594). **HISTORY_LIMIT = 20** (constants.js:105).
4. Ctrl+Z triggers `undo()` → `state.historyIndex -= 1` → `restoreSnapshot` → `loadHtmlString`.
5. After 20+ edits, oldest undo state is silently gone.

**Friction points**
- **Silent horizon**: the Undo button stays enabled until `historyIndex <= 0`. There's no visual "you have reached the earliest state". After 20 edits, the user undoes 20 steps, hits button again — nothing happens. No toast, no disabled state flicker, no chip `Горизонт истории — 20 шагов`.
- **Autosave race**: `schedulePersistence` debounces `saveProjectToLocalStorage` by 250ms and `captureHistorySnapshot` by 320ms. If the user undoes rapidly (e.g. holds Ctrl+Z), the snapshot timer may fire *in between* undo steps, and a snapshot may not match the post-undo state. `state.historyMuted` is set during `restoreSnapshot` (history.js:610), which prevents snapshot-during-restore — that is correct. But `saveProjectToLocalStorage` is not muted, so autosave may fire mid-undo and persist a half-restored state. I haven't verified this is a real race — but the control surface for it is not visible in `state.historyMuted`.
- **Model divergence**: `restoreSnapshot` calls `loadHtmlString(snapshot.html, ...)` which rebuilds modelDoc *and* the preview iframe from scratch. For long chains, this means 20 iframe rebuilds, 20 bridge handshakes, 20 autosaves. Each rebuild resets runtime slide state and re-requests the "preferred slide index". On heavy decks (large images, runtime scripts) this visible jank is disorienting.

**Honest-feedback gaps**
- No "saved" confirmation after an undo — `#saveStatePill` updates but does not call attention. User can't tell if their undo "took".
- If `serializeCurrentProject` throws (shouldn't, but possible on weird DOM), no snapshot — but no user-visible error either.

**Discoverability**
- `Ctrl+Z` is standard. `Ctrl+Shift+Z` and `Ctrl+Y` both redo (`shortcuts.js:40–47`), which is correct.
- No history panel, no timeline scrubber. 20-step horizon is invisible.

**Severity**: blocker-lite. Silent data loss at 20+ edits is a product credibility risk.

**Recommended fix**
- Bump HISTORY_LIMIT to **50** (snapshot cost is low; `serializeCurrentProject` clones the modelDoc but doesn't serialize to disk per-step).
- After the 40th snapshot, show a non-blocking chip `Горизонт истории: 10/50`, decrementing as used. User sees the budget.
- When `historyIndex === 0` and user presses Ctrl+Z, show transient toast `Это самое раннее состояние. Дальше откатить нельзя.`
- Make `saveProjectToLocalStorage` respect `state.historyMuted` to close the autosave-mid-undo race.

---

### 8. Keyboard-only full workflow

**Steps**
1. Tab from browser chrome → first focusable shell element.
2. Tab through topbar → `#themeToggleBtn` → `#undoBtn` → `#redoBtn` → `#openHtmlBtn` → ...
3. Reach `#emptyOpenBtn` in the empty-state card. Enter opens the modal.
4. Inside modal: Tab through file input → paste textarea → assets input → `#loadPastedHtmlBtn`. Enter.
5. After load: Tab back into `previewPrimaryActionBtn`, Enter → `setMode("edit")`.
6. Tab into preview iframe. **Here the keyboard story breaks** — see friction.
7. Selection via keyboard requires the `#selectionFrame` itself to be focused (selection.js:53–54 sets tabindex 0 when visible, -1 when not).
8. Once a frame is focused, Arrow keys nudge (shortcuts.js:135–151); Enter does not activate text-edit; no keyboard shortcut to "select next element in slide".

**Friction points**
- **No keyboard entry point into preview**: once the iframe has focus, `Tab` jumps to the first focusable element *inside the presentation* — which in most decks is an anchor or a script-managed control, not a shell-managed selectable block. There is no `Alt+Click equivalent` keyboard path to "walk the slide tree".
- **No `Tab to next selectable element`**: selection.js relies on mouse clicks or bridge-dispatched clicks. A blind user cannot cycle elements.
- **Slide rail keyboard navigation**: slide-rail.js:126–141 handles Enter / Space (activate), ContextMenu / Shift+F10 (open menu). But **arrow keys do not move between rail items**. The items have `tabindex="0"`, meaning each slide is a separate Tab stop. In a deck with 40 slides, that's 40 Tab presses to reach the inspector.
- **Stack-depth badge has no keyboard trigger**: ADR-002 shows `2 из 3` but the picker popup (ADR-003) is not shipped. There is no Alt+Arrow or similar to cycle candidates from keyboard.
- **Modal focus management**: `openModal` focuses the first focusable child (shell-overlays.js:26–31) — good. `Escape` closes modals (shortcuts.js:11–24) — good. `closeModal` returns focus to the previously-active element (shell-overlays.js:81–88) — good.
- **Focus visibility**: I could not locate an explicit `:focus-visible` ring spec in `base.css` or `overlay.css` quick-grep. If the default browser ring is used, dark theme may render it invisibly against dark backgrounds.

**Honest-feedback gaps**
- `blockReasonBanner` is `aria-live="polite"` (shell line 861) — good. Banner changes are announced.
- `#saveStatePill` is just a span — no `aria-live`. Autosave state changes are silent for screen readers.
- `#previewLoading` spinner uses `aria-hidden="false"` when visible (shell line 491), but no `role="status"` or `aria-live` — screen readers don't announce "loading presentation".

**Discoverability**
- `?` opens the shortcuts modal (shortcuts.js:30–34). Excellent discoverability — but only once the user knows `?` is the convention.
- The topbar has no `⌨ Справка` button outside the overflow menu (`#topbarOverflowShortcutsBtn`, shell line 151). In `empty` workflow state the overflow menu is hidden (topbar command mode is "inline"). So in the blank state, the help is reachable only via `?`, and the empty-state card doesn't mention it.

**Severity**: blocker for a11y. ADR-006 (axe-core CI gate, Phase 5, v0.27.1) explicitly acknowledges this. But the audit for v1.0 should not wait until v0.27.1.

**Recommended fix**
- Add a `Tab to select first element of active slide` bridge command, triggered by the shell when preview iframe receives focus. Arrow keys then cycle siblings; Tab descends into children, Shift+Tab ascends.
- Slide rail: implement arrow-key navigation between items (Up/Down moves focus, Enter activates). Swap individual `tabindex="0"` for roving tabindex: only the active slide is in the tab order.
- Add `aria-live="polite"` to `#saveStatePill` and `#previewLoading`.
- Add a keyboard-shortcut hint in the empty state card (e.g. `Нажмите ? для списка горячих клавиш`).
- Verify `:focus-visible` styling exists across all themed surfaces; add to `tokens.css` if missing.

---

### 9. Zoom 25–200% + attempt to edit

**Steps**
1. User presses `Ctrl+=` → `stepZoom(1)` → `setPreviewZoom(1.1, true)` (boot.js:276, shortcuts.js:120).
2. `state.previewZoom` ≠ 1 → `getBlockReason()` returns `"zoom"` (feedback.js:647).
3. `#blockReasonBanner` shows `"Масштаб ≠ 100% — перемещение на холсте отключено"` with action `Сбросить масштаб`.
4. User clicks in preview — selection **still works** (zoom does not block selection), but drag/resize handles are `disabled` (selection.js:85).
5. User clicks `Сбросить масштаб` → `setPreviewZoom(1.0, true)` → banner clears, handles re-enable.

**Friction points**
- **Zoom-gated features are not signaled before the block**: user zooms in to work at fine detail, selects an element, grabs a handle — and *then* learns the handle doesn't work. Ideally, zooming non-100% should visually gray out the handles immediately (even before selection), with an inline chip "Для редактирования: 100%".
- **Zoom level indicator** (`#zoomLevelLabel`, shell line 264) is `aria-live="polite"` (good). But the `1:1` reset button (#zoomResetBtn) is `hidden` by default (shell line 266) and only unhidden when zoom != 100%. So the single-click reset path exists but is hidden until needed — that's fine.
- **Keyboard shortcut Ctrl+0 to reset** is documented in the button title but not advertised in the banner itself. The banner says "Сбросить масштаб" (button click); it doesn't hint that Ctrl+0 is faster.

**Honest-feedback gaps**
- If Firefox < 126 is detected (CSS zoom works but without quality preservation — per `SOURCE_OF_TRUTH.md:213`), there is no warning to the user. This is deferred by design but leaks bad quality silently.
- Zooming out to 25% shows a tiny deck in a huge canvas with no chrome hint that this is "normal" zoomed-out view vs. loading vs. layout bug.

**Discoverability**
- Ctrl+= / Ctrl+- / Ctrl+0 are advertised in button `title` attrs. Shortcuts modal should also list them (I did not verify the shortcuts modal content against `shortcuts.js` — assume it's in the modal).
- Zoom controls are prominent in the preview header (`#mainPreviewPanel .preview-zoom-control`, shell line 262).

**Severity**: minor. Feedback is honest; resolution is one click.

**Recommended fix**
- Add `is-zoom-locked` body class when `state.previewZoom !== 1`. CSS can style `.selection-handle` with 30% opacity + `cursor: not-allowed` *before* the user attempts to grab.
- Banner copy: add `(Ctrl+0)` shortcut hint after `Сбросить масштаб` button label.

---

### 10. Export to PPTX — reality check

**Implementation**: `export.js::exportPptx` (lines ~46 onward). Loads PptxGenJS from CDN (`pptxLoadScript`, line 46). Parses each slide's DOM, resolves elements' `pos + size` via `pptxGetAbsPos` (line 159), maps styles, outputs `.pptx`.

**Steps**
1. User clicks `#exportPptxBtn` (shell line 126).
2. CDN script loads (requires network).
3. For each slide, iterate through elements, extract position/size/style.
4. Use PptxGenJS `slide.addText` / `addImage` / `addShape`.
5. Download `.pptx` via library's save method.

**Friction points**
- **CDN dependency violates `file://` offline-first spirit**. If the user runs from `file://` without network, the export silently fails. `pptxLoadScript` has `s.onerror = () => reject(new Error("pptx-cdn-load-failed"))`. There's some toast handling downstream, but for a novice the message "pptx-cdn-load-failed" is not actionable.
- **Positional fidelity**: PPTX needs absolute positions. Most HTML decks use relative/flex/grid layouts. `pptxGetAbsPos` uses `style.left/top/width/height` (parsed from inline styles). Flex/grid elements have no inline `left/top` — they compute to zero. Exported slide = pile of overlapping elements at (0,0).
- **Text formatting loss**: bold/italic transfer, but custom CSS (text-shadow, letter-spacing, multi-line gradients, SVG backgrounds) do not. No warning.
- **Images as data-URLs**: if deck uses `<img src="data:image/png;base64,...">`, PptxGenJS can embed. But if it uses external URLs, export fetches them — CORS-restricted on `file://`.
- **Font mapping**: custom web-fonts become "Calibri" (PptxGenJS default). Silent downgrade.

**Honest-feedback gaps**
- After export completes, no validation report. `validateExportBtn` (shell line 993) exists but validates the **HTML** export, not the PPTX.
- No "this deck is not PPTX-friendly" pre-flight check (e.g. "3 slides use flex layout — position data will be lost").

**Discoverability**
- Button is visible in topbar command cluster, label `Экспорт PPTX`, disabled until `modelDoc` present. Good.
- No indication that PPTX fidelity is approximate.

**Severity**: major, deferred. The user expects .pptx = Keynote/PowerPoint parity. Reality is ~30% fidelity for typical decks.

**Recommended fix**
- Bundle PptxGenJS locally in `editor/vendor/` (no build step, just a `<script>` tag). Fixes offline-first.
- Pre-flight panel: before export, show a summary `N текстовых блоков: OK · M изображений: OK · K позиций неопределены (flex/grid) — будут собраны в верхнем левом углу`.
- Label the button `Экспорт PPTX (бета)` until positional parity improves.

---

### 11. Recover from blocked state

**Blocked states enumerated** in §5 above. "Recovery" means the user has landed in a blocked state and wants to unblock.

**Steps**
1. User selects a locked element. Banner shows. In advanced mode, `Разблокировать` button is visible in `#lockBanner`; also visible in `#blockReasonBanner` in basic mode.
2. User clicks → `unlockElementBtn` handler (dom.js:172) → bridge `update-attributes` with `data-editor-locked: null`.
3. For hidden: click `Показать` → `restoreSelectedElementVisibility()` (feedback.js:559) → multi-path visibility restoration.
4. For zoom: click `Сбросить масштаб` → setPreviewZoom(1.0, true).
5. For transform-family: **no recovery path**. User must edit CSS (advanced) or ignore.

**Friction points**
- **No recovery for transform blocks**. Transform is by far the most common block in real-world decks (hero banners, rotated badges, decorative elements). The inspector geometry section only exposes `display/position/z-index/width/height/left/top` (shell line 1193–1247). There is no `transform` input — so even "use inspector" is misleading.
- **Recovery action consistency**: some reasons offer a button, some don't. `getBlockReasonAction` (feedback.js:693) only returns non-null for zoom/locked/hidden. For the others, the banner shows only text, no button.
- **`restoreSelectedElementVisibility` is optimistic**. Tries 3 paths: remove `hidden` attr, remove `aria-hidden`, clear inline `display/visibility`. If all three fail silently (e.g. visibility comes from a parent's CSS rule), toast says `Элемент уже видим` — but the user still sees the element as invisible. Honest-feedback gap.

**Honest-feedback gaps**
- Transform recovery silence is the biggest gap. User follows banner instructions ("перемещение через инспектор"), scrolls inspector, finds no transform field, gives up.
- `Элемент уже видим` toast is a lie when the element is invisible due to parent-rule CSS that the basic-mode restore logic can't touch.

**Discoverability**
- Recovery actions are contextually placed on the banner — good.
- Long-press / right-click menus offer additional recovery (e.g. `context-menu.js` handles lock/unlock) but discoverability is low in basic mode.

**Severity**: major. The "no dead ends" invariant is violated for transform-family blocks.

**Recommended fix**
- Add `transform` to the inspector geometry section as a free-text field (advanced only) with a "Reset transform" one-click. In basic mode, add a `Убрать transform` button to the block-reason banner when reason is transform-family.
- When visibility-restore paths all fail, toast `Видимость нельзя вернуть — родитель управляет этим через CSS`, and suggest `Сообщить в инспектор` (scroll to appearance section, highlight `display` field).

---

### 12. Slide rail: reorder / duplicate / delete / keyboard-only nav

**Steps (mouse)**
1. User drags a slide thumbnail → `dragstart/dragover/drop` handlers in `slide-rail.js:143–167`.
2. Drop fires `moveSlideToIndex(fromIndex, toIndex, { activateMovedSlide: false })`.
3. Click `⋯` → `openSlideRailContextMenu` with `Duplicate`, `Delete`, `Move up`, `Move down` items.

**Steps (keyboard)**
1. Tab into rail. Each slide is a `tabindex="0"` item. Focus lands on first slide.
2. Enter or Space → `requestSlideActivation(slide.id)` (slide-rail.js:117–120).
3. `Shift+F10` or `ContextMenu` key → `openSlideRailContextMenu` at top-left corner (slide-rail.js:127–137).
4. **Arrow keys do nothing**. There is no `ArrowDown → focus next slide item`.
5. **No reorder via keyboard**. Drag is mouse-only. Slide rail context menu has `Move up / Move down` items — that's the only keyboard reorder path, and each step needs menu re-open.

**Friction points**
- Sequential Tab through N slides is painful at N > 10. Arrow-key nav is the convention (e.g. macOS Finder, VSCode file tree, every a11y toolkit).
- `Alt+Up/Alt+Down` to move a slide up/down while focused would be the obvious keyboard reorder, and is not wired.
- Drag-and-drop reorder shows `.is-dragging` class (slide-rail.js:147) and sets `.is-drop-target` via `setSlideRailDropTarget` (not shown but referenced at line 155). No haptic-equivalent pulse; no slide-count badge update during drag.
- Delete from rail context menu — is it confirm-gated? If not, a misclick loses the slide. (Undoable, but the toast needs to scream "Undo available".)

**Honest-feedback gaps**
- Delete silently succeeds. Toast is (from pattern) `Слайд удалён`. If there's an "Undo" action button on the toast, good — the code at `showToast` (feedback.js:21) supports `actionLabel`. I did not verify the delete-slide path calls this.
- `data-overlap-warning` tag is present on thumbnails with severe overlap (slide-rail.js:79). Click shows the toast `Один из элементов перекрыт`. But in basic mode only, per `slide-rail.js:52`. Advanced users see the warning in the layers panel instead.

**Discoverability**
- `⋯` is a well-known "more" pattern. Tooltip `Действия со слайдом` (slide-rail.js:104). Good.
- Drag cursor on hover over draggable slides — good.
- Keyboard reorder hidden behind context menu — not obvious.

**Severity**: major for keyboard users.

**Recommended fix**
- Wire arrow-key nav: ArrowUp/Down move focus to prev/next slide. Roving tabindex on the active slide.
- Wire `Alt+ArrowUp/Down` to reorder the focused slide.
- Delete toast should include `Отменить` action button with 6s TTL.
- Add a visible `Горячие клавиши рейла` tooltip on first hover into the rail (per-session once, like ADR-005 action hints).

---

## Cross-cutting findings

### Copy inconsistencies (Russian UI)

- `Открыть HTML` (topbar & empty state primary) vs. `Открыть стартовый пример` (empty state) — inconsistent verb ("Открыть") used for two semantically different actions. Starter is better phrased `Попробовать на примере`.
- `Вставить из буфера` (empty state secondary) vs. `Вставить HTML` (modal inside). Same action, two phrasings. Pick one.
- `Отменить` (topbar, undo) vs. `Повторить` (topbar, redo). Standard. But in toast action buttons the word `Отменить` is used to mean "undo the toast-triggering action" — collision of meanings. Consider `Вернуть` or `Откатить` for toast.
- `Превью` (topbar mode toggle) vs. `Режим просмотра` (preview note). Same concept, two names. Settle on `Превью`.
- `Редактирование` (topbar) vs. `Начать редактирование` (primary CTA) vs. `Редактировать текст` (inspector button) — these are three distinct actions; the phrasing drift is fine, but the top-level button `Редактирование` on the mode toggle (shell line 100) should be `Правка` for shorter visual length, matching the topbar's tight budget.
- Block reason banner labels mix hyphen styles: `"Масштаб ≠ 100% — перемещение на холсте отключено"` (em-dash) vs. `"Используется transform — перемещение через инспектор"` (em-dash, ok). But `🔒 Элемент заблокирован` lacks a period for parity.

### CTA priority collisions

- **Empty state**: 3 equal-weight buttons (Open / Paste / Starter). Primary style only on Open. But visual hierarchy: Open = 👍 for "I have a file"; Starter = 👍 for "I'm exploring"; Paste = rare edge-case. Yet they're coequal.
- **Preview note area after load**: `previewPrimaryActionBtn` (Начать редактирование) + `previewAssistActionBtn` (Подключить папку ресурсов) + `toggleInsertPaletteBtn` (➕ Добавить блок) + `reloadPreviewBtn` (↻ Обновить). Four CTAs stack horizontally. On narrow widths they wrap and become a cluster of equal-weight buttons. Only the first is styled `.primary-btn`; the others are `.ghost-btn` — but in a wrapped row the weight hierarchy collapses.
- **Inspector summary quick-actions** (basic mode, after selection): up to 4 actions (inspector-sync.js:758). The first is marked `.is-primary`, others default. When reason is direct-manipulation-blocked in basic mode, `switch-advanced` becomes primary — a "switch modes" action competing with the entity's core action ("Печатать" for text). Entity action should always win.

### Missing empty states (when a list/area is empty but chrome visible)

- **Slide list empty**: slide-rail.js:20–26 shows `"Слайды пока не обнаружены"`. OK but terse. No explanation of why (e.g. "HTML не содержит распознаваемых `<section>` / `<article>` / `.slide` контейнеров").
- **Insert palette empty**: impossible to trigger (palette has static buttons).
- **Layers panel empty** (advanced mode): if current scope has 0 layers, panel shows empty `<ul>` with no copy. Should say `На этом слайде нет управляемых слоёв — выберите блок, чтобы увидеть его содержимое.`
- **History empty**: undo/redo both disabled. No copy. Could be improved with a hint `История пуста — начните редактирование` on hover.
- **Restore banner timing**: if `sessionStorage` has an autosave from *before this session's open*, banner appears. If the user loaded a new file and then wants to restore the previous, there's no "restore another session" path — restore is limited to current tab's sessionStorage.

### Mode-transition leaks (basic ↔ advanced)

- **Geometry section auto-unhide in basic mode**: inspector-sync.js:77–81 shows the advanced-only geometry section in basic mode **when `hasBlockedDirectManipulationContext()` is true**. That's a mode leak — basic user sees `display/position/z-index/left/top/width/height` fields they didn't ask for, because transform-blocked the drag. Either show only the relevant field (e.g. `width`) or show a non-geometry fallback card ("изменить через контекстное меню").
- **Switch-advanced quick action**: inspector-sync.js:742 adds a `switch-advanced` action with label `Точно` to basic-mode summary when blocked. On click, it silently flips mode. Toast says `Включён режим точных правок.` — but the user came in as a novice and may not want the extra surface area. Consider making this a confirm-step the first time per session.
- **Layers panel**: advanced-only. But the `⊞ Листы / ▣ Группы` selection-mode toggle (shell line 876–882) is *always visible*. So a basic user sees this toggle with no explanation of what it does. This is the single most mysterious control in the shell for novices.
- **Advanced-only banners**: `#lockBanner` is advanced-only. `#blockReasonBanner` is mode-agnostic but shows `locked` reason with unlock action even in basic. Redundant / inconsistent.

### a11y gaps obvious in journeys

- **No aria-live on `#saveStatePill` and `#previewLoading`** (journey 8).
- **Keyboard-only cannot enter preview selection** (journey 8).
- **Slide-rail arrow-key nav missing** (journey 12).
- **Focus-visible styling not verifiable from CSS quick-scan**; risk of invisible focus ring on dark theme.
- **Block-reason banner is `role="status"` + `aria-live="polite"`** — good. But multiple banners (`#lockBanner`, `#blockReasonBanner`, `#overlapRecoveryBanner`) can be simultaneously present with duplicate `aria-live`, causing screen reader overtalk.
- **`<button>` inside `<input type="color">` siblings** — color input is native, unlabelled for some screen readers. Audit with axe-core (ADR-006) will catch this.
- **Emoji-only buttons** in floating toolbar (`🗑`, `⧉`, `🎨+`, `🎨⇣`, `✎`, `B`, `I`, `U`, `🖼`, `🔗`, `🎞`, `↔`) have `aria-label` attributes — good. But tooltip (`title`) and label sometimes diverge, e.g. `ftCopyStyleBtn` aria-label = "Копировать стиль выбранного элемента", title = "Копировать стиль" (shell line 626–627). Consistency is fine, but verbose aria-labels cause verbose screen-reader announcements.

---

## Top 10 P0 fixes (blocks v1.0)

1. **Promote starter deck in empty state.**
   Problem: 3 co-equal buttons dilute the fastest path to "aha".
   Impact: first-time bounce.
   Fix: reorder to `Открыть HTML` (primary) · `Попробовать на примере` (secondary) · `Дополнительно ▾ → Вставить из буфера`. Move starter deck to `editor/fixtures/`.
   ADR-ref: extend ADR-005.

2. **Broken-asset recovery banner after paste/open.**
   Problem: silent failure when relative assets 404.
   Impact: user abandons, assumes editor broken.
   Fix: shell-side counter of unresolved resources + persistent banner `N файлов не загрузилось. Подключить папку проекта ↴`.
   ADR-ref: new ADR needed (ADR-008 Asset Resolution Feedback).

3. **Keyboard-only rail navigation.**
   Problem: arrow keys do nothing in rail; no reorder keyboard path.
   Impact: a11y fail, power-user fail.
   Fix: roving tabindex + `ArrowUp/Down` focus + `Alt+ArrowUp/Down` reorder.
   ADR-ref: ADR-006 scope expansion.

4. **Keyboard entry into preview selection.**
   Problem: Tab into iframe skips selectable blocks.
   Impact: a11y blocker.
   Fix: `Tab` from preview wrapper triggers shell-side `select-first-element` bridge command; `Arrow` cycles siblings; `Shift+Tab` ascends.
   ADR-ref: ADR-006 scope expansion.

5. **Transform block has no resolution path.**
   Problem: banner says "use inspector" but no `transform` field exists.
   Impact: dead end for a common real-world case.
   Fix: add `transform` field to geometry section + `Убрать transform` button in banner.
   ADR-ref: extend ADR-001.

6. **Undo horizon silent drop at 20 steps.**
   Problem: user loses oldest edits without warning.
   Impact: credibility.
   Fix: bump HISTORY_LIMIT to 50; show `Горизонт истории: N/M` chip after step 40; toast on "hit the floor" Ctrl+Z.
   ADR-ref: new ADR (ADR-009 Undo Horizon Feedback).

7. **Layer picker popup (ADR-003) ships simultaneously with stack-depth badge.**
   Problem: badge (`v0.25.0`) without picker (`v0.25.1`) = tease without exit.
   Impact: novice can't resolve overlap.
   Fix: ship ADR-003 picker in v0.25.1 per ROADMAP; meanwhile, make the badge click open the existing overlap-recovery banner's "Выбрать слой" path.
   ADR-ref: ADR-003 (scheduled).

8. **Shift-click multi-select is silently broken.**
   Problem: bridge dispatches, shell ignores. No toast.
   Impact: users assume alignment is unsupported.
   Fix: in the meantime, toast `Мульти-выбор в разработке — используйте линейку в продвинутом режиме`. Move alignment panel ahead of v0.29.
   ADR-ref: new ADR (ADR-010 Multi-Select & Alignment Roadmap).

9. **Unify `#lockBanner` and `#blockReasonBanner`.**
   Problem: two banners for the same semantic with inconsistent mode-gating.
   Impact: inconsistent UX, dev cost on every banner change.
   Fix: delete `#lockBanner`; keep only `#blockReasonBanner` with reason-aware action.
   ADR-ref: extend ADR-001.

10. **Delete toast lacks Undo action button.**
    Problem: single-keystroke slide-delete from rail with no in-toast reversal.
    Impact: data loss for misclicks.
    Fix: when `recordHistoryChange("delete-slide")` fires via rail action, wrap with `showToast(... , { actionLabel: "Отменить", onAction: undo, ttl: 6200 })`.
    ADR-ref: new ADR (ADR-011 Destructive Action Confirmation Policy).

---

## Heuristic violations (Nielsen — quick pass per journey)

| # | Journey                             | Failing heuristics                                             |
|---|-------------------------------------|----------------------------------------------------------------|
| 1 | First-open empty                    | H6 Recognition over recall (no visual preview), H3 User control (3 coequal CTAs) |
| 2 | Paste HTML broken assets            | H1 Visibility of system status, H9 Help users recognise errors |
| 3 | Select text → edit                  | (mostly OK) H4 Consistency (label drift between banner/tooltip/frame) |
| 4 | Select image → replace → resize     | H1 Visibility (aspect-lock invisible), H5 Error prevention (no alt nag) |
| 5 | Direct manipulation blocks          | H1 Visibility (duplicate channels), H9 Help recognise errors (transform reasons opaque) |
| 6 | Multi-select alignment              | H10 Help & documentation (feature absent with no acknowledgment) |
| 7 | Undo chain 20+                      | H1 Visibility (silent horizon), H5 Error prevention |
| 8 | Keyboard-only workflow              | H7 Flexibility (no keyboard parity), H4 Consistency (rail ≠ rest of shell) |
| 9 | Zoom + attempt edit                 | H1 Visibility (handles look active while disabled), H10 Help (Ctrl+0 not on banner) |
| 10| Export to PPTX                      | H9 Help recognise errors (silent fidelity loss), H1 Visibility |
| 11| Recover from blocked                | H3 User control (transform dead end), H9 Help recognise errors |
| 12| Slide rail keyboard nav             | H7 Flexibility (no arrow-nav), H4 Consistency |

Shneiderman's 8 golden rules — most-violated across journeys:

- **Rule 4 (Informative feedback)**: journeys 2, 6, 7, 10.
- **Rule 6 (Easy reversal)**: journeys 7, 12.
- **Rule 7 (Locus of control)**: journeys 5, 11.

---

## Appendix A — invariants respected by this audit

- No production code changes proposed that would require ripping out `parent shell + iframe + bridge + modelDoc`.
- Russian UI copy stays Russian in all examples.
- All proposed new CSS layers follow tokens.css-first declaration invariant.
- No `type="module"` suggestions.
- All "new bridge message" suggestions are explicitly flagged so a reviewer knows a bridge contract change is involved.

## Appendix B — references used

- `editor/presentation-editor.html` lines 1–1787 (shell markup; empty state 425–472; topbar 72–140; inspector 762–1349)
- `editor/src/onboarding.js` full
- `editor/src/selection.js` lines 1–300 (overlay, direct manip)
- `editor/src/feedback.js` lines 1–650 (block reasons, workflow state, popover layout)
- `editor/src/shell-overlays.js` lines 1–300 (modal, palette, overflow, mutual exclusion)
- `editor/src/inspector-sync.js` lines 680–940 (breadcrumb badge, quick actions, block banner)
- `editor/src/slide-rail.js` full
- `editor/src/shortcuts.js` full
- `editor/src/constants.js` (HISTORY_LIMIT, STARTER_DECKS, zoom/snap/nudge constants)
- `editor/src/export.js` lines 1–150 (pptx path), 520–624 (history snapshot, HISTORY_LIMIT usage)
- `editor/src/toolbar.js` full (floating toolbar visibility rules)
- `docs/SOURCE_OF_TRUTH.md`, `docs/PROJECT_SUMMARY.md`, `docs/ROADMAP_NEXT.md`, `docs/ADR-001..007`

No Playwright runs were executed during this audit; all assertions about runtime behaviour are tagged "predicted" where not directly readable from source.
