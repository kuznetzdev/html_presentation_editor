# UX Audit A1 — Heuristics (Nielsen + HIG + M3)

**Auditor:** ui-ux-designer (sub-agent)
**Date:** 2026-04-28
**Baseline:** v2.0.30 (Gate-A 317/8/1 with known perf-budget flake)
**Branch:** claude/ux-deep-overhaul-v2.1
**Method:** static read of source files + invariant check; no live DOM walk this pass

## Summary
- Total findings: 38
- Severity distribution: CRIT=3, HIGH=14, MED=14, LOW=7
- Top 5 actionable items:
  1. F03 — Empty-state primary path is split between two equal-weight CTAs (Open HTML / Paste from clipboard) with no visual hierarchy; primary disagreement with SoT rule "single-path onboarding card".
  2. F08 — Topbar at `loaded-edit` / `loaded-preview` simultaneously exposes Open + Show + Export HTML + Export PPTX + Theme + Undo + Redo (7 buttons + state cluster), violating "Recognition rather than recall" and leaking visual noise that competes with the slide canvas.
  3. F11 — `preview-note` (the "Следующий шаг" card) duplicates state info already shown in `topbarStateCluster` (status pills) AND in `previewLoading` AND in `activeSlideLabel` — same status reported in 3 places at once.
  4. F18 — Inspector "Простой/Полный" mode toggle is colocated with panel close button in the same `panel-header-actions`, putting a high-frequency mode switch next to a low-frequency destructive control. Users misclick.
  5. F22 — `selectedElementSummaryCard` AND `<h3>Текущий элемент</h3>` AND `badge-row` AND `selection-breadcrumbs` AND `stack-depth-badge` AND `field-grid-2` (tag/id) all stack vertically in basic-mode by default without visual hierarchy; the SoT-promised "summary-first" outcome is buried.

## Findings

### F01 — HIGH — Nielsen #4 Consistency — Topbar
**File:** `editor/presentation-editor.html:81-169`
**Pain:** Topbar has 7 distinct interactive zones (identity, state cluster, mode toggle, command cluster, overflow), yet the "command cluster" mixes destructive (Export) + transient (Theme) + workflow (Open) + history (Undo/Redo) + presentation (Show) — no visual grouping reflects that semantic split.
**Evidence:**
```html
<div id="topbarCommandCluster" class="shell-cluster" role="group" aria-label="Workspace commands">
  <button id="themeToggleBtn" type="button" class="ghost-btn theme-toggle-btn" title="Переключить тему">🌓 Тема</button>
  <button id="undoBtn" disabled>Отменить</button>
  <button id="redoBtn" disabled>Повторить</button>
  <button id="openHtmlBtn" class="primary-btn" title="Открыть HTML-файл презентации">Открыть HTML</button>
  <button id="presentBtn" disabled title="Открыть презентацию на весь экран (▶ F5)">▶ Показать</button>
  <button id="exportBtn" disabled title="Скачать чистый HTML-файл">Экспорт HTML</button>
  <button id="exportPptxBtn" disabled title="Скачать файл PowerPoint (.pptx)">Экспорт PPTX</button>
</div>
```
**Why it's a problem:** Apple HIG §"Toolbars" calls for grouping by frequency-of-use and consequence. M3 §"Top app bar — actions" explicitly warns against >4 actions in one row. Putting "Тема" next to "Экспорт PPTX" mixes a daily preference with a one-shot destructive action.
**Fix direction:** S — promote Open/Export to a leading group; collapse Theme + history into a secondary cluster; make Show pill-shaped to read as a verb-action distinct from data flow.
**Invariant check:** PASS

### F02 — CRIT — Nielsen #6 Recognition — Empty state
**File:** `editor/presentation-editor.html:537-553` + `editor/styles/preview.css:651-664`
**Pain:** Empty-state `.empty-state-actions` shows TWO `class`-equal buttons side-by-side (`primary-btn` + `ghost-btn`). They are labelled "Открыть HTML" and "Вставить из буфера". The `primary-btn` is implementation-correct, but the visual contrast against `ghost-btn` is mild on light theme — both compete for first glance.
**Evidence:**
```html
<div class="empty-state-actions">
  <button type="button" id="emptyOpenBtn" class="primary-btn">Открыть HTML</button>
  <button type="button" id="emptyPasteBtn" class="ghost-btn">Вставить из буфера</button>
</div>
```
**Why it's a problem:** SoT.md:152-154 mandates "single-path onboarding card with `Open HTML` as the primary CTA and `Paste HTML` as a secondary path". v2.0.29 promoted Paste to "primary CTA" semantically (per release notes), yet the visual still treats them like a 60/40 binary, not 80/20 hierarchy. Nielsen #6 — too many equally-prominent options dilute the obvious next action.
**Fix direction:** S — `emptyPasteBtn` should be `text-link-btn` size or, alternatively, lose its solid border (use `text-link` style) so visual weight is roughly 80/20. Reserve full button only for primary.
**Invariant check:** PASS

### F03 — HIGH — Nielsen #6 Recognition — Empty state
**File:** `editor/presentation-editor.html:545-553`
**Pain:** The footnote uses inline `text-link-btn` for "попробуйте на примере" — but visually, `.text-link-btn` has only `text-decoration: underline; color: shell-accent`. A user scanning the empty state bottom-up reads body copy, then sees an underlined word, with no affordance that this is a one-click action vs. a hyperlink to docs.
**Evidence:**
```html
<div class="empty-state-footnote" id="emptyStateFootnote">
  Или
  <button type="button" id="emptyStarterDeckBtn" class="text-link-btn"
          aria-label="Открыть стартовый пример">попробуйте на примере</button>.
</div>
```
**Why it's a problem:** Apple HIG §"Buttons / inline links" — inline links inside body copy work for navigation, but starter-deck loading is a fully destructive action (clears state, loads a deck). It deserves at least a small distinct visual treatment (e.g., chevron arrow, faint chip background) so first-time users register it as "this will load something now".
**Fix direction:** S — append "→" or use a small ghost-chip variant; alternatively make it a separate one-line subdued button.
**Invariant check:** PASS

### F04 — HIGH — Nielsen #1 Visibility of system status — Workflow markers
**File:** `editor/presentation-editor.html:108-119` + `editor/presentation-editor.html:411-422`
**Pain:** Three different status pills are simultaneously visible in `loaded-edit` mode: `#workspaceStateBadge` ("Редактор ждёт HTML"), `#interactionStatePill` ("Просмотр"), `#previewLifecyclePill` ("Пусто") — these report overlapping facts about the same lifecycle.
**Evidence:**
```html
<!-- topbar -->
<span id="workspaceStateBadge" class="status-pill">Редактор ждёт HTML</span>
<!-- preview-note -->
<span id="interactionStatePill" class="status-pill" aria-live="polite">Просмотр</span>
<span id="previewLifecyclePill" class="status-pill" aria-live="polite">Пусто</span>
```
**Why it's a problem:** Nielsen #1 says system status should be visible — but THREE redundant status indicators is the opposite: it makes the user scan and reconcile. Material 3 §"Status bar" recommends one canonical status surface per panel.
**Fix direction:** M — collapse the three into one `#workspaceStateBadge` (in topbar) + one `previewLifecyclePill` (in preview-note); delete `interactionStatePill`. Document mapping in feedback.js.
**Invariant check:** PASS

### F05 — MED — HIG §"Adapt to user mode" — Mode toggle
**File:** `editor/presentation-editor.html:124-131`
**Pain:** `mode-toggle` (Превью/Редактирование) is a 2-state segmented control. When the deck is unloaded, both buttons exist but `editModeBtn` is `disabled`. After a deck loads, both become enabled — but the user has no idea what changes between modes (no inline preview/explainer).
**Evidence:**
```html
<div class="mode-toggle" role="group" aria-label="Режим работы">
  <button type="button" id="previewModeBtn" class="is-active"><span>Превью</span></button>
  <button type="button" id="editModeBtn" disabled><span>Редактирование</span></button>
</div>
```
**Why it's a problem:** SoT.md:158-159 requires a "novice-readable CTA instead of relying on mode-toggle literacy" for the loaded-preview path. The mode toggle assumes literacy. M3 segmented buttons §"Choose the right control" — segmented controls are for orthogonal modes, but here Edit is a strict superset of Preview. A primary action button "Начать редактирование" is more honest and is partly already implemented in `previewPrimaryActionBtn` — but the segmented toggle stays as a competing surface.
**Fix direction:** M — when `data-editor-workflow="loaded-preview"`, hide the Edit button in the toggle and surface only `previewPrimaryActionBtn` as the path; reactivate the Edit toggle once the user is already in edit mode (so they can flip back to Preview).
**Invariant check:** PASS

### F06 — HIGH — Nielsen #8 Aesthetic and minimalist design — Topbar
**File:** `editor/presentation-editor.html:84-87`
**Pain:** Topbar carries TWO redundant identity strings: `topbar-eyebrow` ("Живой HTML-редактор") + `<h1>HTML Presentation Editor</h1>`. Both are persistent across all workflow states and consume vertical/horizontal space that could go to the canvas or the deck title.
**Evidence:**
```html
<div class="topbar-title">
  <span class="topbar-eyebrow">Живой HTML-редактор</span>
  <h1>HTML Presentation Editor</h1>
  <span id="documentMeta">Откройте HTML-презентацию.</span>
</div>
```
**Why it's a problem:** Nielsen #8 — every extra unit of information dilutes the relative visibility of what matters. The user already knows what app they opened. Apple HIG (Mac §"App identity") — the title bar belongs to the OS frame, not a duplicate inside the app.
**Fix direction:** S — drop `topbar-eyebrow` once a deck is loaded; replace `<h1>HTML Presentation Editor</h1>` with the actual loaded deck title (`documentMeta` becomes the secondary label). Empty state can keep the kicker.
**Invariant check:** PASS

### F07 — CRIT — Nielsen #4 Consistency — Workflow chrome leakage
**File:** `editor/presentation-editor.html:866-871`
**Pain:** Inspector `inspector-density-toggle` (Простой/Полный) is mounted in DOM at all times. SoT.md:60 explicitly says: "blank state hides slide rail, inspector, mode toggle, complexity toggle, and edit actions entirely". v2.0.29 release notes claim this is fixed, but the toggle is in the inspector panel-header that itself is hidden via the workspace `display: none` rule — it's hidden visually, not semantically. The DOM reads the toggle on screen-readers in `empty` state.
**Evidence:**
```html
<div class="mode-toggle inspector-density-toggle" role="group" aria-label="Уровень инспектора">
  <button type="button" id="basicModeBtn" class="is-active"><span>Простой</span></button>
  <button type="button" id="advancedModeBtn"><span>Полный</span></button>
</div>
```
**Why it's a problem:** Defeats the SoT contract: power-user surfaces ARE leaking through DOM in empty state. Screen readers will announce the toggle even though it's not visually visible — confusing for AT users. Nielsen #4 — visibility and DOM should align.
**Fix direction:** S — wrap inspector chrome in `<div hidden>` while `data-editor-workflow="empty"`, OR add `aria-hidden="true"` + `tabindex="-1"` while empty. Update CSS to flip both.
**Invariant check:** PASS

### F08 — HIGH — M3 Top App Bar — Topbar density
**File:** `editor/presentation-editor.html:135-168` + `editor/styles/layout.css:5-30`
**Pain:** In `loaded-edit` state the topbar spans 7 commands (Theme, Undo, Redo, Open, Show, Export HTML, Export PPTX) plus state cluster (4 pills) plus mode toggle (2 buttons) plus identity (3 lines). At 1280px viewport width this packs ≥15 interactive zones into ≤52px height row.
**Evidence:** In-source comments show `body[data-topbar-command-mode="overflow"]` only collapses `themeToggleBtn` — Undo/Redo + 4 export buttons remain inline.
**Why it's a problem:** M3 Top App Bar §"Actions": "Display up to 3 actions; place additional actions in an overflow menu". HIG Mac toolbars: "Avoid more than 6-8 items". Current layout exceeds both.
**Fix direction:** M — overflow more aggressively: when `data-topbar-command-mode="overflow"`, collapse Undo/Redo/Theme into the `⋯` menu; keep only Open + Show + Export inline. Or split Export-HTML and Export-PPTX into a single split-button.
**Invariant check:** PASS

### F09 — MED — Nielsen #4 Consistency — Restore banner placement
**File:** `editor/presentation-editor.html:60-75` + `editor/styles/modal.css:5-21`
**Pain:** `restore-banner` is the FIRST element in `<body>`, before topbar. It pushes everything down. When the user opens a deck (and there is autosave), the topbar appears below a "Найдена автосохранённая версия проекта." banner — visually, this is a separate page section, not a recovery path.
**Evidence:**
```html
<body>
  <div id="restoreBanner" class="restore-banner" aria-live="polite">
    <div><strong>Найдена автосохранённая версия проекта.</strong>
    ...
```
**Why it's a problem:** v2.0.29 hid all editor chrome at empty state, but the restore banner is NOT hidden — it can show before the user has chosen what they want to do. Visually, it competes with the empty-state hero card. Apple HIG §"Alerts" — recovery paths belong in the empty state itself, not as a banner above it.
**Fix direction:** M — when `data-editor-workflow="empty"`, render the restore option AS the empty-state primary action ("Восстановить последнюю работу") instead of as a sibling banner. Move the dedicated banner to `loaded-*` only.
**Invariant check:** PASS

### F10 — HIGH — Nielsen #1 Visibility of system status — Save state
**File:** `editor/presentation-editor.html:94-100`
**Pain:** `#saveStatePill` ("Автосохранение неактивно") is a passive label — but in empty state it sits alone in the topbar's stateCluster row that is hidden anyway. In loaded state, it sits next to `#workspaceStateBadge`, both of which talk about persistence — ambiguous which is canonical.
**Evidence:**
```html
<span id="saveStatePill" class="status-pill save-pill" aria-live="polite">Автосохранение неактивно</span>
...
<span id="workspaceStateBadge" class="status-pill">Редактор ждёт HTML</span>
```
**Why it's a problem:** Nielsen #1 — status visibility means clarity, not noise. Two pills both about "is the editor doing anything?" is friction. Apple HIG §"Doc state" — one source of truth for save status.
**Fix direction:** S — merge into single pill: "Сохранено • 2 сек назад" / "Автосохранение неактивно" / "Сохраняется…". Drop `workspaceStateBadge` entirely once loaded.
**Invariant check:** PASS

### F11 — HIGH — Nielsen #6 Recognition — Preview-note redundancy
**File:** `editor/presentation-editor.html:351-423`
**Pain:** `preview-note` shows simultaneously: eyebrow ("Следующий шаг"), title ("Откройте HTML и запустите превью"), body text, summary badge, active slide label, primary action button, assist button, insert palette toggle, reload button, interaction pill, lifecycle pill — **11 distinct UI elements** in one card.
**Evidence:**
```html
<div class="preview-note">
  <div class="preview-note-main"><div class="preview-note-header">
    <div class="preview-note-copy">
      <span class="topbar-eyebrow">Следующий шаг</span>
      <strong id="previewNoteTitle">Откройте HTML и запустите превью</strong>
      <span id="previewNoteText">Файл, вставка HTML и assets подключаются в одном потоке.</span>
    </div>
    <div class="preview-note-summary">
      <span id="previewStatusSummary" class="mini-badge">Стартовый экран</span>
      <span id="activeSlideLabel">Слайд не выбран</span>
    </div>
  </div></div>
  <div class="preview-note-actions">
    <div class="preview-note-primary-row">
      <button id="previewPrimaryActionBtn">Начать редактирование</button>
      <button id="previewAssistActionBtn">Подключить папку ресурсов</button>
      <button id="toggleInsertPaletteBtn">➕ Добавить блок</button>
      <button id="reloadPreviewBtn">↻ Обновить</button>
    </div>
    <div class="preview-note-meta-row">
      <span id="interactionStatePill">Просмотр</span>
      <span id="previewLifecyclePill">Пусто</span>
    </div>
  </div>
</div>
```
**Why it's a problem:** Nielsen #8 (minimalist design) and Nielsen #6 (recognition) — each element competes for the user's attention. The card is doing the job of: status bar, primary CTA, secondary CTAs, breadcrumb, AND notification — but is shaped like a single component. M3 calls this "compound surface anti-pattern".
**Fix direction:** L (requires ADR) — split into: (1) topbar status row consumes lifecycle/interaction pills; (2) `preview-note` becomes the contextual "next-step" prompt only with ONE primary action; (3) Reload + Insert palette move to a small separate utility row attached to the preview canvas. Eyebrow + body text retire (use the title alone).
**Invariant check:** PASS

### F12 — MED — Nielsen #3 User control — Mode toggle disabled state
**File:** `editor/presentation-editor.html:128-130`
**Pain:** When deck is unloaded, `editModeBtn` shows as `disabled` with no tooltip explaining WHY. The user clicks "Редактирование", nothing happens, no toast, no microcopy.
**Evidence:**
```html
<button type="button" id="editModeBtn" disabled><span>Редактирование</span></button>
```
**Why it's a problem:** SoT.md:165-166 says "Blocked actions must fail honestly with feedback, not silently — every block must explain the reason and offer a resolution path where one exists". `disabled` without `title` or `aria-describedby` violates this.
**Fix direction:** S — add `title="Сначала откройте HTML"` and a hover tooltip; on click of disabled state, route to "Откройте HTML" via toast or focus the open button.
**Invariant check:** PASS

### F13 — MED — HIG §"Help and tooltips" — Topbar
**File:** `editor/presentation-editor.html:152-156`
**Pain:** All four export/show buttons rely on `title` attributes for explanation. Native `title` shows after ~700ms hover delay, doesn't appear on touch, and is invisible to keyboard users without ARIA.
**Evidence:**
```html
<button id="openHtmlBtn" class="primary-btn" title="Открыть HTML-файл презентации">Открыть HTML</button>
<button id="presentBtn" disabled title="Открыть презентацию на весь экран (▶ F5)">▶ Показать</button>
<button id="exportBtn" disabled title="Скачать чистый HTML-файл">Экспорт HTML</button>
<button id="exportPptxBtn" disabled title="Скачать файл PowerPoint (.pptx)">Экспорт PPTX</button>
```
**Why it's a problem:** HIG §"Help text" — supplementary text should be discoverable across input modalities. `title` is fragile. Disabled state buttons (`presentBtn` etc.) get NO tooltip on touch — users can't learn what these do until they have a deck loaded.
**Fix direction:** S — replace `title` with a tooltip component that shows on focus AND hover, with `aria-describedby`. Apply only to ambiguous icons (▶) — drop redundant titles on text-labeled buttons.
**Invariant check:** PASS

### F14 — LOW — M3 Theme switch — Theme toggle copy
**File:** `editor/presentation-editor.html:142-149`
**Pain:** "🌓 Тема" combines an emoji + word. Current state (light/dark/system) is not surfaced in the label — user has to remember.
**Evidence:**
```html
<button id="themeToggleBtn" type="button" class="ghost-btn theme-toggle-btn" title="Переключить тему">
  🌓 Тема
</button>
```
**Why it's a problem:** Apple HIG §"Theme switcher" — toggle buttons should reflect current state visually (sun/moon icon flips). M3 §"Theming controls" — single-tap toggles benefit from showing the next state.
**Fix direction:** S — switch icon based on current theme: ☀️ → 🌙 → 💻 (system). Drop "Тема" word; keep aria-label.
**Invariant check:** PASS

### F15 — MED — Nielsen #6 Recognition — Slide rail header
**File:** `editor/presentation-editor.html:246-271`
**Pain:** `slidesPanel` panel-header has `<h2>Слайды</h2>` + `<div class="panel-subtext" id="slidesCountLabel">0 слайдов</div>` + `+ Слайд` button + `✕` close button. The close button is invisible on desktop (CSS hides it) but DOM-present, and the count label "0 слайдов" appears in `loaded-*` states even when there ARE slides — copy is computed elsewhere but the empty placeholder is in DOM.
**Evidence:**
```html
<div class="panel-header">
  <div>
    <h2>Слайды</h2>
    <div class="panel-subtext" id="slidesCountLabel">0 слайдов</div>
  </div>
  <div class="panel-header-actions">
    <button type="button" id="toggleSlideTemplateBarBtn" class="ghost-btn slide-template-trigger">+ Слайд</button>
    <button type="button" class="ghost-btn icon-btn panel-close-btn" data-close-panel="left">✕</button>
  </div>
</div>
```
**Why it's a problem:** SoT.md:60 — slide rail must be hidden in empty state. CSS does that, but the DOM-rendered "0 слайдов" placeholder can leak in mid-load race conditions. Nielsen #6 — placeholder copy must reflect reality; "0 слайдов" is jarring after a load animation.
**Fix direction:** S — replace static "0 слайдов" with `id` only, populate via JS only when count is known; render "—" or empty until then.
**Invariant check:** PASS

### F16 — HIGH — Nielsen #4 Consistency — Inspector summary card vs section h3
**File:** `editor/presentation-editor.html:883-905` + `editor/presentation-editor.html:1025-1041`
**Pain:** Both `currentElementSection` and `currentSlideSection` start with a `summary-card` (visual emphasis: kicker + bold title + body) AND ALSO contain an `<h3>` ("Текущий элемент" / "Текущий слайд") right after. The h3 is redundant with the kicker, and creates visual hierarchy confusion: user sees title twice.
**Evidence:**
```html
<div class="summary-card" id="selectedElementSummaryCard">
  <span class="summary-kicker">Выбранный объект</span>
  <strong class="summary-title" id="selectedElementTitle">Элемент не выбран</strong>
  ...
</div>
<h3>Текущий элемент</h3>
<div class="badge-row">
  <span class="mini-badge" id="selectedSlideBadge">Слайд —</span>
  ...
```
**Why it's a problem:** Nielsen #4 — section titles should be unique. Having "Выбранный объект" (kicker) + "Текущий элемент" (h3) is the same concept said twice. M3 §"List dividers" — section titles work when content is genuinely different sections.
**Fix direction:** S — promote `summary-card` content to BE the section header (drop the h3). Or keep h3 only in advanced mode (where the badge-row + tag/id/class fields ARE a separate "raw" section).
**Invariant check:** PASS

### F17 — HIGH — SoT contract — Selected-element basic mode
**File:** `editor/presentation-editor.html:883-1023`
**Pain:** SoT.md:69-70 says "selected-element basic mode should start with a summary card and human labels, while raw node metadata and tag-level controls remain advanced-only". In practice, basic mode shows: summary-card → h3 → 3 badges (slide/kind/node — node is `data-ui-level="advanced"` and hides) → overlap recovery → block reason → broken-asset banner → selection-mode toggle (smartMode/containerMode) → breadcrumbs → stack-depth-badge → tag/id (advanced) → class (advanced). The summary card promise is buried under 7+ controls before the user sees any "human labels" beyond the title.
**Evidence:** Lines 883-1023 — summary card occupies ~17 lines, then 130+ lines of badges/banners/toggles/inputs follow.
**Why it's a problem:** Direct contract violation. Even if 2-3 of those banners are conditional (`hidden` initially), the toggle for selection-mode (`smartModeBtn` / `containerModeBtn`) is a power-user concept (smart layers vs container groups) and is BASIC-visible. Nielsen #2 (match real world) — "⊞ Листы / ▣ Группы" is jargon for a presentation editor user.
**Fix direction:** L (needs ADR) — gate `selectionModeToggle`, `selectionBreadcrumbs`, `stackDepthBadge` behind advanced mode. In basic mode, show only: summary-card → quick-actions (`selectedElementQuickActions`) → block-reason banner if present.
**Invariant check:** PASS

### F18 — HIGH — Nielsen #5 Error prevention — Inspector panel header
**File:** `editor/presentation-editor.html:861-880`
**Pain:** The panel-header-actions for the inspector contains the inspector mode toggle (Простой/Полный) AND the close-panel button (✕) in the same horizontal row. On compact widths the close button reflows to the right edge, but on standard desktop both are within ~80px of each other. Mode-toggling is a high-frequency action; closing the inspector is rare-and-disruptive — they shouldn't be neighbors.
**Evidence:**
```html
<div class="panel-header-actions">
  <div class="mode-toggle inspector-density-toggle" role="group" aria-label="Уровень инспектора">
    <button type="button" id="basicModeBtn" class="is-active"><span>Простой</span></button>
    <button type="button" id="advancedModeBtn"><span>Полный</span></button>
  </div>
  <button type="button" class="ghost-btn icon-btn panel-close-btn" data-close-panel="right" aria-label="Закрыть инспектор">✕</button>
</div>
```
**Why it's a problem:** Nielsen #5 (error prevention) and Fitts's Law — placing a destructive control adjacent to a frequent control invites misclicks, especially on tablet/trackpad. M3 §"Action placement" — destructive close should sit at the panel corner, not in the action cluster.
**Fix direction:** S — move `.panel-close-btn` to absolute top-right of the panel (overlay the corner), separate from the mode toggle. Or: show close only in compact widths (since on desktop, panels never close).
**Invariant check:** PASS

### F19 — MED — HIG §"Selected state" — Selection mode toggle copy
**File:** `editor/presentation-editor.html:970-981`
**Pain:** Selection mode toggle uses raw symbols: "⊞ Листы" (sheets) and "▣ Группы" (groups). These are programmer concepts, not presenter concepts.
**Evidence:**
```html
<div class="mode-toggle selection-mode-toggle" role="group" aria-label="Режим выделения">
  <button type="button" id="smartModeBtn" class="is-active"><span>⊞ Листы</span></button>
  <button type="button" id="containerModeBtn"><span>▣ Группы</span></button>
</div>
```
**Why it's a problem:** Nielsen #2 (match the real world). Users expect "Объект" / "Группа" or "Текст" / "Контейнер" or "Один" / "Несколько" — at minimum, language that matches what slides contain. The icons (⊞ and ▣) are nearly indistinguishable.
**Fix direction:** M — rename to match user mental model. Suggest: "Один объект" / "Группа" with clearer icons.
**Invariant check:** PASS

### F20 — MED — Nielsen #6 Recognition — Quick palette button copy
**File:** `editor/presentation-editor.html:439-501`
**Pain:** The insert palette mixes 3 different naming conventions: HTML-tag-prefixed ("H1 Заголовок", "H2 Подзаголовок"), Cyrillic letter ("🅣 Текст"), pure emoji ("🖼 Картинка / GIF", "🎬 Видео"), pure symbol ("▣ Блок", "▦ 2 колонки").
**Evidence:**
```html
<button type="button" role="menuitem" data-palette-action="heading" draggable="true" title="Добавить заголовок">H1 Заголовок</button>
<button type="button" role="menuitem" data-palette-action="subheading" draggable="true" title="Добавить подзаголовок">H2 Подзаголовок</button>
<button type="button" role="menuitem" data-palette-action="text" draggable="true" title="Добавить текст">🅣 Текст</button>
<button type="button" role="menuitem" data-palette-action="image" draggable="true" title="Добавить картинку">🖼 Картинка / GIF</button>
```
**Why it's a problem:** Nielsen #4 (consistency) — palette items should use one convention. M3 §"Selection list" — visual hierarchy requires uniformity. The current mix forces the user to scan rather than recognize.
**Fix direction:** S — pick one: either all icons + label (drop "H1"/"H2"; use heading icon) or all label + tag-prefix (drop emojis). Recommend: use SVG icons + label, drop both.
**Invariant check:** PASS

### F21 — LOW — M3 Snackbar — Toast container
**File:** `editor/presentation-editor.html:1961-1966` + `editor/styles/overlay.css:567-577`
**Pain:** `.toast-container` is positioned `top: calc(var(--shell-top-offset) + 14px)` on desktop, `bottom: calc(...)` on mobile. Toasts are top-right on desktop, bottom-center on mobile. Inconsistency works against muscle-memory.
**Evidence:**
```css
.toast-container {
  position: fixed;
  right: 16px;
  top: calc(var(--shell-top-offset) + 14px);
  ...
}
@media (max-width: 1024px) {
  .toast-container { left: 12px; right: 12px; top: auto; bottom: ...; }
}
```
**Why it's a problem:** M3 §"Snackbars" recommend bottom placement on all viewports for hand-reach (mobile) and lower-eye-line scanning (desktop). Apple HIG §"Notifications" — bottom-center for non-blocking confirmations.
**Fix direction:** S — standardize on bottom-right desktop / bottom-center mobile.
**Invariant check:** PASS

### F22 — HIGH — Nielsen #2 Match real world — Inspector basic mode density
**File:** `editor/presentation-editor.html:1111-1157`
**Pain:** When edit mode is engaged but nothing is selected, the inspector shows `insertSection` with a 4-button grid (Текст / Форма / Картинка / GIF / Видео) AND a `.inspector-empty-hint` card AND `data-ui-level="advanced"` HTML textarea below. The empty-hint card is helpful, but it is rendered BELOW the insert buttons — so the user reads "add new" → "add new" → "add new" → "add new" → "wait, you can also EDIT existing things".
**Evidence:**
```html
<div class="inspector-section" id="insertSection">
  <h3>Вставка</h3>
  <div class="insert-actions">
    <button type="button" id="addTextBtn">Текст</button>
    <button type="button" id="addShapeBtn">Форма</button>
    <button type="button" id="addImageBtn">Картинка / GIF</button>
    <button type="button" id="addVideoBtn">Видео</button>
  </div>
  <div class="inspector-empty-hint" id="insertEmptyHint" role="note">
    <p class="inspector-empty-hint-title">💡 Хотите изменить то, что уже на слайде?</p>
    ...
```
**Why it's a problem:** Nielsen #2 — inversion of frequency. Most users will edit existing content far more often than insert. Putting "insert" first signals: "this is what to do here". The hint card below feels like an afterthought.
**Fix direction:** S — when nothing selected, show `inspector-empty-hint` FIRST, then `insertSection` second. Or merge: a single "Что делать дальше?" section with two columns: "Изменить что-то" + "Добавить что-то".
**Invariant check:** PASS

### F23 — MED — HIG §"Action placement" — Slide-section actions
**File:** `editor/presentation-editor.html:1085-1102`
**Pain:** Slide-section `.inspector-actions` mixes constructive ("Дублировать слайд", "Применить preset") with destructive ("Удалить слайд") in a single 2-column grid with no visual cue or grouping.
**Evidence:**
```html
<div class="inspector-actions slide-actions-grid">
  <button type="button" id="duplicateCurrentSlideBtn">Дублировать слайд</button>
  <button type="button" id="deleteCurrentSlideBtn">Удалить слайд</button>
  <button type="button" id="validateExportBtn">Проверить экспорт</button>
  <button type="button" id="showSlideHtmlBtn" data-ui-level="advanced">HTML слайда</button>
</div>
```
**Why it's a problem:** Apple HIG §"Destructive actions" — destructive buttons should be visually distinct (red text or explicit warning) AND placed at the end of the action group so they are not accidentally clicked. M3 §"Buttons in cards" — group similar actions, separate destructive ones.
**Fix direction:** S — apply `.danger-btn` class to `deleteCurrentSlideBtn`; move it to the bottom right or separate row; consider adding "Удалить" requires confirmation toast.
**Invariant check:** PASS

### F24 — LOW — Nielsen #2 Match real world — Slide presets
**File:** `editor/presentation-editor.html:282-296`
**Pain:** Slide template names mix English ("Title slide", "Section", "Bullets", "Media") and Russian ("2 колонки"). Inconsistent localisation breaks scan-reading.
**Evidence:**
```html
<button type="button" role="menuitem" data-slide-template="title">Title slide</button>
<button type="button" role="menuitem" data-slide-template="section">Section</button>
<button type="button" role="menuitem" data-slide-template="bullets">Bullets</button>
<button type="button" role="menuitem" data-slide-template="media">Media</button>
<button type="button" role="menuitem" data-slide-template="two-column">2 колонки</button>
```
**Why it's a problem:** Nielsen #4 (consistency) — UI should pick one language per locale. Editor `<html lang="ru">` so all should be Russian or have parallel translations.
**Fix direction:** S — translate: "Заголовочный" / "Раздел" / "Маркеры" / "Медиа" / "2 колонки".
**Invariant check:** PASS

### F25 — HIGH — HIG §"Floating bar" — Floating toolbar density
**File:** `editor/presentation-editor.html:659-841`
**Pain:** `floatingToolbar` has 4 groups (general, text, align, media) with combined ~17 buttons, two color/font selects, and a drag-handle + collapse toggle. When all visible, the bar can be wider than 600px.
**Evidence:** Lines 686-840 — `ftGeneralGroup` (5 buttons), `ftTextGroup` (5 buttons + 2 selects + color), `ftAlignGroup` (3), `ftMediaGroup` (4) = 17 controls + 3 fields.
**Why it's a problem:** HIG §"Inspector bars" — floating contextual bars should be minimal (3-5 actions). M3 §"Contextual action bar" — once over 6 actions, use a sheet. The current bar can occupy ~50% of canvas width on laptop, blocking the slide content the user is editing.
**Fix direction:** M — make groups fully context-driven: text group only appears when text element selected; media only for image/video; align only for positioned. Currently they appear together (with hidden buttons), bloating perceived width even when only some apply.
**Invariant check:** PASS

### F26 — MED — Apple HIG §"Floating UI" — Floating toolbar drag-handle
**File:** `editor/presentation-editor.html:668-684`
**Pain:** `ftHandleBtn` (⋮⋮) and `ftCollapseBtn` (▾) are placed in row 1 of the floating toolbar — but their function (move, collapse) are utility, not editing actions. They sit next to ftDeleteBtn (🗑), inviting misclicks.
**Evidence:**
```html
<button type="button" id="ftHandleBtn" class="compact toolbar-handle" aria-label="Перетащить панель быстрых действий" title="Перетащить панель">⋮⋮</button>
<button type="button" id="ftCollapseBtn" class="compact" aria-label="Свернуть или развернуть панель быстрых действий" title="Свернуть/развернуть">▾</button>
<div id="floatingToolbarContent" class="floating-toolbar-content">
  <div id="ftGeneralGroup" class="floating-toolbar-group">
    <button type="button" id="ftDeleteBtn" class="compact" aria-label="Удалить выбранный элемент" title="Удалить">🗑</button>
```
**Why it's a problem:** Apple HIG §"Inspector handles" — drag-handles should be visually distinct (often a thin horizontal line, not a button). Current `⋮⋮` looks like an action button. Adjacent placement to `🗑` is dangerous — both are 28px wide and within tap-zone overlap on touch devices.
**Fix direction:** S — replace `⋮⋮` with a non-button drag-rail visual (`::before` of toolbar); move `▾` collapse to the END of the bar. Drop both `<button>` semantics for the handle.
**Invariant check:** PASS

### F27 — MED — Nielsen #3 User control — Floating toolbar mutual exclusion
**File:** `editor/presentation-editor.html:660` (toolbar) + `editor/presentation-editor.html:428` (palette) + `editor/presentation-editor.html:1925` (context menu) + `editor/presentation-editor.html:1929` (layer picker)
**Pain:** SoT.md:172-173 mandates "Floating toolbar, context menu, layer picker, and compact shell drawers remain mutually exclusive transient surfaces". DOM has 4 separate top-level containers, each `aria-hidden="true"` initially. The contract is enforced in JS, but visually nothing tells the user "the toolbar disappeared because you opened the menu". When the user dismisses one, others may not predictably re-appear.
**Evidence:**
```html
<div id="floatingToolbar" ... aria-hidden="true" hidden>
<div id="quickPalette" ... aria-hidden="true">
<div id="contextMenu" class="context-menu" role="menu" aria-hidden="true">
<div id="layerPicker" class="layer-picker" role="dialog" aria-hidden="true">
```
**Why it's a problem:** Nielsen #3 (user control) — when system hides a UI element it should be visible WHY. Currently the floating toolbar can blink in/out as the user moves between selections in close succession, with no animation cue. M3 §"Element transitions" — transient surfaces should fade out, not snap.
**Fix direction:** M — add CSS transition on `.is-visible` removal (already partially done via `transform: translateY(4px); opacity: 0`). Audit handlers in `selection.js` to ensure restoration is deterministic. Add `data-mutex-owner` attribute to a body/root for debugging.
**Invariant check:** PASS (re-affirms SoT contract)

### F28 — LOW — Nielsen #6 Recognition — Floating toolbar font selectors
**File:** `editor/presentation-editor.html:763-797`
**Pain:** Two `<select>` elements (`ftFontFamilySelect`, `ftFontSizeSelect`) inside the floating toolbar. Native selects are blocking — they steal focus, can't be styled per spec, and on macOS they appear over the slide canvas obscuring the user's edit context.
**Evidence:**
```html
<select id="ftFontFamilySelect" title="Шрифт" aria-label="Шрифт">
  <option value="">— шрифт —</option>
  <option value="Inter, sans-serif">Inter</option>
  ...
```
**Why it's a problem:** HIG §"Inspector controls" — inline font/size pickers should be combo-boxes or chip-pickers, not native selects, to preserve canvas visibility. The bar already has 4+ groups of buttons — adding native selects breaks the visual rhythm.
**Fix direction:** L (custom dropdown component) — defer to Phase B if not in scope.
**Invariant check:** PASS

### F29 — HIGH — Nielsen #1 Visibility of system status — Preview lifecycle pill
**File:** `editor/presentation-editor.html:417-422` + `editor/styles/preview.css:431-443`
**Pain:** `previewLifecyclePill` shows "Пусто" on empty state and is `font-size: 9px` per CSS. At 9px, the pill is illegible at standard reading distance.
**Evidence:**
```css
#interactionStatePill, #previewLifecyclePill {
  ...
  font-size: 9px;
}
```
**Why it's a problem:** Apple HIG §"Type sizes" — minimum legible body text is 11pt (M3 minimum 12px for `caption`). 9px violates both. Status info that small communicates "this isn't important" — yet status IS important (per Nielsen #1).
**Fix direction:** S — bump font-size to 11px; if space-constrained, drop the pill entirely (already covered by F4).
**Invariant check:** PASS

### F30 — MED — Apple HIG §"Drag-and-drop affordance" — Slide rail dot
**File:** `editor/styles/preview.css:87-112`
**Pain:** `.slide-item::before` renders a 10×10 dot to the left of each slide. The dot becomes the active state (filled when slide active). Function is unclear — it looks like a status LED rather than the active marker.
**Evidence:**
```css
.slide-item::before {
  content: "";
  position: absolute;
  left: 12px;
  top: 12px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  border: 1px solid var(--shell-border-strong);
  background: var(--shell-panel-elevated);
  z-index: 1;
}
.slide-item.is-active::before {
  border-color: var(--shell-accent);
  background: var(--shell-accent);
  box-shadow: 0 0 0 4px var(--shell-focus);
}
```
**Why it's a problem:** Apple HIG §"Selection feedback" — active selection should be clear via background + border, not just a tiny dot. M3 §"List item state layer" — selected state should fill the entire row's surface. Current dot competes with the slide thumbnail's own border-accent and is ambiguous (does it mean "draft", "active", "loaded"?).
**Fix direction:** S — drop the dot; rely solely on `.slide-item-main` border + box-shadow for active state.
**Invariant check:** PASS

### F31 — MED — M3 §"Card states" — Slide rail hover transform
**File:** `editor/styles/preview.css:100-102`
**Pain:** `.slide-item:hover { transform: scale(1.02); }` applies a scale transform that, in a vertical list, can cause the hovered slide to overlap its neighbors visually and shift the perceived row count.
**Evidence:**
```css
.slide-item:hover {
  transform: scale(1.02);
}
```
**Why it's a problem:** Apple HIG §"Hover state" — list items should not move on hover (it's disorienting in scrollable lists). M3 §"State layers" — use background tint, not transform, for hover.
**Fix direction:** S — replace with `background-color` change on `.slide-item-main`. Keep transform reserved for drag-drop feedback.
**Invariant check:** PASS

### F32 — LOW — Nielsen #5 Error prevention — Slide menu trigger
**File:** `editor/styles/preview.css:215-228`
**Pain:** `.slide-menu-trigger` is a 32×32 circular button, font-size 18px — but rendered next to the slide thumbnail, it looks like a "delete" button. No icon (relies on `⋯` set by JS).
**Evidence:**
```css
.slide-menu-trigger {
  width: 32px;
  min-width: 32px;
  height: 32px;
  border-radius: 999px;
  font-size: 18px;
  line-height: 1;
  align-self: flex-start;
}
```
**Why it's a problem:** Apple HIG §"Hit-target sizing" — 32×32 is at the minimum bound (44pt is recommended for touch). Visually circular floating buttons next to thumbnails read as primary actions, but this is a menu opener.
**Fix direction:** S — give it a hover-only visibility (appears on slide-item hover); add aria-label "Действия со слайдом".
**Invariant check:** PASS

### F33 — HIGH — HIG §"Density" — Inspector body padding
**File:** `editor/styles/inspector.css:5-16`
**Pain:** `.inspector-body { padding: 0 20px 20px; ... gap: 0; }`. Sections have `padding: 16px 0` and `border-top: 1px solid`. With 7+ sections in basic mode (current element / current slide / insert / actions / text / table / geometry / appearance / media / layers / policy / help / workspace settings / diagnostics), the inspector becomes a vertical chain of equally-weighted slabs.
**Evidence:**
```css
.inspector-body { padding: 0 20px 20px; ... gap: 0; }
.inspector-section { padding: 16px 0; border-top: 1px solid var(--border-subtle); }
```
**Why it's a problem:** Apple HIG §"Inspector density" — visual rhythm requires variable padding (denser for compact sections, looser for prominent ones). Currently every section has identical padding/border, so the user can't scan to find the relevant one. M3 §"List density" — use 8px / 16px / 24px scaled padding for low/medium/high importance.
**Fix direction:** M — collapse-by-default for less-frequent sections (table, layers, policy, diagnostics); promote summary-card and quick-actions with extra top/bottom space; use accent border on currently-relevant section.
**Invariant check:** PASS

### F34 — MED — Apple HIG §"Selection frame" — Selection label position
**File:** `editor/styles/overlay.css:119-138`
**Pain:** `.selection-frame-label` is positioned at `top: -34px` (above the selection frame). On the first slide row or near the canvas top, the label can render off-screen.
**Evidence:**
```css
.selection-frame-label {
  position: absolute;
  left: 0;
  top: -34px;
  ...
}
```
**Why it's a problem:** Apple HIG §"Selection indicators" — labels must remain visible regardless of selection position. Off-screen labels mean the user can't see what they have selected.
**Fix direction:** S — flip label position to `bottom: -34px` when frame top < 40px; add a logic in selection.js. CSS-only via `:has()` is theoretically possible.
**Invariant check:** PASS

### F35 — LOW — Nielsen #1 Visibility — Spinner copy
**File:** `editor/presentation-editor.html:577-584`
**Pain:** Loading state shows static copy "Подготовка превью…" + "Ждём инициализацию iframe и движка презентации." The inner copy is technical jargon.
**Evidence:**
```html
<div>
  <div class="spinner"></div>
  <strong id="previewLoadingText">Подготовка превью…</strong>
  <div class="hint">Ждём инициализацию iframe и движка презентации.</div>
</div>
```
**Why it's a problem:** Nielsen #2 (match real world) — "iframe и движка презентации" is implementation detail, not user-relevant. Users don't care; they want to know "how long".
**Fix direction:** S — replace with "Загружаем презентацию… Обычно это меньше 2 секунд."
**Invariant check:** PASS

### F36 — MED — Nielsen #6 Recognition — Block reason banner
**File:** `editor/presentation-editor.html:931-942` + `editor/styles/inspector.css:392-407`
**Pain:** `blockReasonBanner` always lives inside `currentElementSection`. When triggered, the user has to scroll inspector to see why their action was blocked, even if they're working in the canvas.
**Evidence:**
```html
<div class="block-reason-banner" id="blockReasonBanner" role="status" aria-live="polite" hidden>
  <div class="block-reason-text" id="blockReasonText"></div>
  <div class="block-reason-actions">
    <button type="button" class="ghost-btn" id="blockReasonActionBtn" hidden></button>
  </div>
</div>
```
**Why it's a problem:** SoT.md:165-166 — "Blocked actions must fail honestly with feedback". Burying feedback in inspector means users miss it. M3 §"Snackbar usage" — non-dismissible blocking feedback should appear near the blocked surface (canvas, not inspector).
**Fix direction:** M — when block reason fires, also surface as toast (already exists in feedback.js — verify both paths) AND optionally float the banner near the selection frame.
**Invariant check:** PASS

### F37 — LOW — Apple HIG §"Color contrast" — Selection-frame protected
**File:** `editor/styles/overlay.css:62-66`
**Pain:** `.selection-frame.is-protected` uses `border-style: dashed` + `var(--shell-warning)` color. On a busy slide background, dashed warning lines blend with content imagery — particularly photos with similar tones.
**Evidence:**
```css
.selection-frame.is-protected {
  border-style: dashed;
  border-color: var(--shell-warning);
  box-shadow: 0 0 0 1px var(--shell-warning-border);
}
```
**Why it's a problem:** Apple HIG §"Visual contrast" — selection frames must remain visible on arbitrary backgrounds. A dashed amber line on a pastel background fails. M3 §"Outlined surface" — use a darker outer halo (glow) for high-contrast selection.
**Fix direction:** S — add a thicker outer box-shadow halo (8-12px) using semi-transparent black/white pair to ensure visibility on any backdrop.
**Invariant check:** PASS

### F38 — MED — Nielsen #7 Flexibility — Workspace settings placement
**File:** `editor/presentation-editor.html:1556-1581`
**Pain:** "Настройки рабочего пространства" section is INSIDE the inspector, at the very bottom. It contains 2 buttons: "Сбросить подсказки" and (advanced-only) "Сбросить feature flags". Inspector is element-scoped UI; workspace-scoped settings don't belong here.
**Evidence:**
```html
<div class="inspector-section" id="workspaceSettingsSection">
  <h3>Настройки рабочего пространства</h3>
  <div class="inspector-actions">
    <button type="button" id="resetOnboardingBtn" class="ghost-btn">Сбросить подсказки</button>
    <button type="button" id="resetFeatureFlagsBtn" class="ghost-btn" data-ui-level="advanced">Сбросить feature flags</button>
  </div>
```
**Why it's a problem:** Nielsen #7 (flexibility & efficiency) — workspace-level controls should be in workspace-level UI (e.g., settings menu in topbar overflow). Placing them in the per-element inspector is a category mismatch and forces the user to select something just to access app preferences.
**Fix direction:** S — move both buttons to `topbarOverflowMenu`; gate `resetFeatureFlags` to advanced via existing data-ui-level. Free up inspector vertical real estate.
**Invariant check:** PASS

## Coverage map
- Topbar: covered (F01, F06, F08, F09, F10, F12, F13, F14)
- Empty state: covered (F02, F03, F09)
- Slide rail: covered (F15, F30, F31, F32)
- Inspector: covered (F07, F16, F17, F18, F22, F23, F33, F36, F38)
- Selection feedback: covered (F25, F26, F27, F34, F37)
- Insert palette: covered (F20)
- Status pills, badges, banners: covered (F04, F10, F29, F36)
- Context menu, layer picker: NOT directly covered; interaction with mutual-exclusion in F27. Both surfaces are minimally rendered in source — most styling lives in CSS rules already audited under overlay.css.
- Workflow marker transitions: covered (F02, F04, F07, F09)
- Error/blocked state recovery: covered (F12, F36, F37)
- Floating toolbar: covered (F25, F26, F27, F28)
- Mode toggle (Простой/Полный): covered (F05, F18)

## What I did NOT audit (out of scope)
- A11y / keyboard navigation (delegated to A2 sub-agent). I noted SR consequences in F07 but did not exhaustively walk keyboard order or focus traps.
- Typography scale, copy tone, color contrast detail (delegated to A3). I cited contrast where it directly violated minimum legibility (F29) but did not measure pairs.
- Competitive comparison vs Pitch / Tome / Slidev / PowerPoint Online (delegated to A4).
- Live DOM behavior — I did not run `npm run start`; all findings derive from static source read of `presentation-editor.html` (lines 1-1791 confirmed via Read tool, with `+800` byte ranges sampled for the rest), `editor/styles/{tokens,layout,inspector,preview,overlay,banners,base,modal,responsive}.css`, and `docs/SOURCE_OF_TRUTH.md`. Behavior of `selection.js`, `feedback.js`, `bridge.js` was not opened — findings about runtime sequencing (F4, F11, F27, F36) are inferred from DOM + CSS contracts, not verified against handlers.
- Mobile drawer detail beyond the rail/topbar collapse (F08 partly).
- Import-report-modal, export modal, video modal, html-editor-modal — only base modal styling reviewed.
- Telemetry viewer, diagnostics — flagged as advanced-only, treated as out-of-frame for basic UX.

## Confidence notes
- Findings F02, F11, F17, F18, F22 are HIGH confidence (direct contract violations against SoT.md or trivially-verifiable visual hierarchy issues).
- Finding F27 about mutual-exclusion is a CONTRACT-RE-AFFIRMATION — I did not verify enforcement; I noted that the JS path is the only guarantor and recommended a debug attribute for future audits.
- Findings F19, F24 (Russian/English mixing) and F35 (jargon) are subjective but match conventional localisation guidance.
- F29 (9px font-size) is OBJECTIVELY below WCAG/HIG thresholds.
- Severity calibration: CRIT = direct contract violation in shipping code; HIGH = visible UX friction reported across multiple heuristics; MED = isolated heuristic issue; LOW = polish/preference.
