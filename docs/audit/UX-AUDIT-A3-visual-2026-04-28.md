# Visual / Typography / Copy Audit A3

**Auditor:** frontend-developer (visual lens)
**Date:** 2026-04-28
**Baseline:** v2.0.30
**Method:** static read + grep across `editor/styles/`, `editor/src/`, `editor/presentation-editor.html`. No runtime probing — other agents may be working.

---

## Summary

- **Type scale findings:** 4 (irrational ratio, 6 off-scale literals, missing display step, 2 bordering values worth retiring)
- **Spacing rhythm findings:** 18 hardcoded violations across 8 CSS files; topbar + panel-header + inspector-section drive the bulk
- **Copy findings:** 14 actionable RU fixes; voice drift (4 patterns); jargon leakage (5 places); 3 punctuation inconsistencies
- **Color/contrast spot-check:** 5 remaining gaps (mostly secondary on accent-soft and `.empty-state-footnote`)

### Top 5 visual gaps blocking premium feel

1. **Type scale leaks at the high end.** Empty-state hero (32 px), summary-title (17 px), `#summary-title` derivatives (15 px), `#previewNoteText` (11.5 px), `#previewStatusSummary` (10.5 px), `#activeSlideLabel` (12.5 px), `#interactionStatePill` (9 px) all sit *outside* `--text-2xs..--text-2xl`. Seven escape hatches in one file (`preview.css`) tells the story. The token system covers small/medium UI but the hero/display step is undefined and the chrome got compensated with sub-pixel values (10.5 / 11.5 / 12.5) that are theatrically precise but token-bypassing.
2. **Half-pixel font-sizes (10.5, 11.5, 12.5 px) on macros that already render slightly off the grid.** These will antialias differently across DPRs. Replace with whole-number tokens — preview-note polish should not depend on subpixel typography.
3. **Topbar/panel-header padding is hand-rolled.** `.topbar` uses `10px 16px` (10 ≠ scale step), `.panel-header` `12px 16px` (OK on x but 12 → `--space-3`). One row of headers ≠ the 4 pt rhythm of the rest of the shell.
4. **Inspector labels mix three voices.** Section H3 uses uppercase tracking (Apple HIG-style: "ТЕКУЩИЙ ЭЛЕМЕНТ"), `field-group label` uses sentence case ("Ширина"), `.summary-kicker` uses uppercase but in a third color. Three eyebrow/label dialects in one panel.
5. **Pill micro-typography is legibility-hostile.** `#interactionStatePill` and `#previewLifecyclePill` at `9 px` (preview.css:442) are below WCAG comfort thresholds and below Apple HIG's smallest "footnote" recommendation (10 pt → ~13 px CSS).

---

## Type scale audit

### Current scale (tokens.css:180-187)

| Token | Value | Modular ratio vs prev |
|---|---|---|
| `--text-2xs` | 10 px | — |
| `--text-xs`  | 11 px | 1.10 |
| `--text-sm`  | 12 px | 1.09 |
| `--text-base`| 13 px | 1.08 |
| `--text-md`  | 14 px | 1.08 |
| `--text-lg`  | 16 px | 1.14 |
| `--text-xl`  | 18 px | 1.13 |
| `--text-2xl` | 22 px | 1.22 |

**Ratio analysis.** The first five steps are quasi-linear (≈1.08–1.10), then jump to ≈1.14 and finish with a 1.22 leap. This is *not* a coherent modular scale — it's "1 px increments at the bottom, double increments at the top." Material 3's ratio is 1.125 (major second); Apple HIG's ratio is closer to 1.118. Either would simplify and produce: 10 → 11.25 → 12.6 → 14.2 → 16 → 18 → 20.25. The current scale's bottom-end resolution is finer than human perception (1 px ≈ 0.5 perceived JND at this size) — three values do the work of one.

**Hardcoded `font-size` violations** (selected, off-scale only — full grep below):

| File:line | Selector | Value | Should be |
|---|---|---|---|
| `preview.css:319` | `#previewNoteText` | `11.5px` | `var(--text-xs)` (11) or new `--text-12` |
| `preview.css:347` | `#previewStatusSummary` | `10.5px` | `var(--text-2xs)` (10) |
| `preview.css:355` | `#activeSlideLabel` | `12.5px` | `var(--text-sm)` (12) |
| `preview.css:442` | `#interactionStatePill, #previewLifecyclePill` | `9px` | reject — should be `var(--text-2xs)` (10) min |
| `preview.css:589` | `.empty-state strong` | `32px` | new `--text-3xl` |
| `preview.css:598` | `.empty-state-lead` | `15px` | new `--text-md-plus` (15) or use `--text-md` (14) |
| `preview.css:630` | `.empty-state-step strong` | `15px` | same as above |
| `preview.css:728` | `.summary-title` | `17px` | new `--text-md-plus` (15-17) |
| `responsive.css:381` | `.empty-state strong` (wide) | `25px` | should clamp via `--text-2xl` (22) → `--text-3xl` (28) |
| `responsive.css:365` | `.empty-state-lead` (wide) | `17px` | same |
| `inspector.css:518, 538` | `.layer-drag-handle, .layer-kind-icon` | `16px` | OK semantically but should be `var(--text-lg)` |
| `inspector.css:641` | `.layer-action-btn` | `15px` | off-scale (15) — round to 14 or 16 |
| `import-report-modal.css:39, 53, 105, 129` | various | `15-16px` | same off-scale 15s |

**Other quirks worth flagging:**
- `--text-2xs (10 px)` is used in only ~6 places (`.experimental-badge`, `.preview-note .topbar-eyebrow`, `.crumb-kind`, `.stack-depth-badge`, `.layer-status-chip`-derived) — most of those are decorative chips. If kept, document as "decorative micro-label only." Otherwise, retire and consolidate with `--text-xs`.
- `--text-md (14 px)` is used three times in core CSS — `.alignment-toolbar`, `.upload-box h4`, `.mobile-command-rail::before`. Effectively dead weight between `--text-base (13)` and `--text-lg (16)` for body copy. Consider keeping for headings only.
- The `.empty-state-step-index` chip uses `13px` font (preview.css:647) — fine with `--text-base` but worth tokenizing since it is paired with `28×28` chip dimensions (off-grid; should be 32 px to align with `--space-8`).

### Recommendations (Phase C)

1. **Add `--text-3xl: 28px` (or 32 px)** for hero/landing displays. v2.0.28 hardcoded 32 px in `.empty-state strong` to escape the scale; this should become a real step.
2. **Add `--text-md-plus: 15px`** OR collapse the 14/15/16/17 cluster into a tighter set. The current preview-card / summary-title / empty-state-lead / step-strong all hover in 15-17 land with no token — pick one.
3. **Drop `--text-2xs (10px)`** OR rename to `--text-decorative` to signal "chip/badge only, never body."
4. **Eliminate sub-pixel sizes** — `9, 10.5, 11.5, 12.5` all need to round to the nearest token. The visual difference is invisible at 100 % zoom and *worse* at 125 %/150 % display scaling.
5. **Standardize advanced-mode metadata labels.** `.crumb-kind`, `.layer-meta`, `.layer-status-chip`, `.telemetry-event__time` all use `11px` correctly via `--text-xs`. Document this as the "metadata register" so future work doesn't drift to 10 px.

---

## Spacing audit

### Hardcoded violations (off-grid or grid-step bypassed)

| File:line | Property | Value | Should be |
|---|---|---|---|
| `layout.css:10` | `padding` (`.topbar`) | `10px 16px` | `var(--space-3) var(--space-4)` (12/16) |
| `layout.css:14` | `gap` | `10px 14px` | `var(--space-3) var(--space-4)` |
| `layout.css:119` | `padding` (`#topbarStateCluster`) | `4px 8px` | `var(--space-1) var(--space-2)` ✓ already on grid — needs token only |
| `layout.css:307` | `padding` (`.panel-header`) | `12px 16px` | `var(--space-3) var(--space-4)` |
| `layout.css:430` | `padding` (`.mobile-command-rail button`) | `8px 6px` | `var(--space-2) var(--space-1)` (6 not on 4 pt grid) |
| `inspector.css:23` | `padding` (`.inspector-section`) | `16px 0` | `var(--space-4) 0` |
| `inspector.css:150` | `padding` (form fields) | `5px 10px` | `var(--space-1) var(--space-3)` (5 + 10 both off-grid; 4+12 fits scale) |
| `inspector.css:188` | `padding` (`input[type="color"]`) | `4px` | `var(--space-1)` ✓ |
| `inspector.css:299` | `padding` (`.inspector-empty-hint`) | `12px 14px` | `var(--space-3) var(--space-4)` (14 off-grid) |
| `inspector.css:332` | `padding` (`kbd`) | `1px 6px` | not 4 pt; shrink to `0 var(--space-1)` or accept |
| `inspector.css:419` | `padding` (`.stack-depth-badge`) | `1px 6px` | same |
| `inspector.css:843` | `padding` (`.telemetry-viewer`) | `12px 0 4px` | `var(--space-3) 0 var(--space-1)` |
| `modal.css:11` | `margin` (`.restore-banner`) | `14px 16px 0` | `var(--space-4) var(--space-4) 0` (14 off-grid) |
| `modal.css:12` | `padding` (`.restore-banner`) | `12px 14px` | `var(--space-3) var(--space-4)` |
| `modal.css:158` | `padding` (`.modal textarea`) | `12px 14px` | same |
| `overlay.css:127` | `padding` (`.selection-frame-label`) | `4px 8px` | `var(--space-1) var(--space-2)` ✓ |
| `overlay.css:154` | `padding` (`.selection-frame-tooltip`) | `6px 10px` | 6 + 10 off-grid; should be `var(--space-2) var(--space-3)` (8/12) |
| `overlay.css:585` | `padding` (`.toast`) | `12px 14px` | `var(--space-3) var(--space-4)` |
| `preview.css:124` | `padding` (`.slide-item-main`) | `14px 14px 12px` | `var(--space-4) var(--space-4) var(--space-3)` (14 off-grid) |
| `preview.css:257` | `padding` (`.preview-note`) | `12px 14px` | `var(--space-3) var(--space-4)` |
| `preview.css:577` | `padding` (`.empty-state`) | `56px 40px` | `var(--space-12) plus 8` — 56 fits 4 pt but isn't a token; OK to add `--space-14: 56px` |
| `preview.css:790` | `padding` (`.selection-breadcrumb`) | `6px 10px` | 6 + 10 off-grid |
| `preview.css:859` | `padding` (`.preview-dropzone, .preview-loading`) | `20px` | `var(--space-5)` ✓ |
| `responsive.css:264, 369, 442` | `padding` | `12px` (×3) | `var(--space-3)` ✓ |
| `responsive.css:377` | `padding` (`.empty-state` wide) | `24px 22px` | 22 off-grid; should be `var(--space-6)` both sides |

**Pattern observed.** The 4 pt grid (`--space-1..12`) is technically defined but used in maybe 30 % of declarations. The most common bypass is `12px 14px` (≥ 8 occurrences across topbar, panel-header, banners, modal, preview-note, toast). 14 px is not a token. This is the "polish creep" that adds 2 px when 12 looks too tight and 16 too loose — a sign the scale needs intermediate `--space-3.5` (14 px) or stricter discipline. **Recommendation: pick one** — either add `--space-3.5: 14px` and document it as the "comfortable card padding" step, OR remove all 14 px instances and standardize on 12 / 16.

A second pattern: `gap: 10px` and `padding-x: 10px` (4 occurrences) — also off-grid. Same fix path.

---

## Copy audit

### Top 14 actionable copy fixes (RU)

#### 1. `documentMeta` empty-state default
- **File:** `presentation-editor.html:86`, also `editor/src/primary-action.js:323`
- **Current:** `Откройте HTML-презентацию.`
- **Issue:** Trailing period; sits next to "Живой HTML-редактор" eyebrow which has none. Inconsistent with other empty-state copy in `.empty-state strong` ("Откройте HTML-презентацию" — no period).
- **Suggestion:** `Откройте HTML-презентацию` (drop the period; this is a label, not a sentence)

#### 2. Workspace status pill — empty state
- **File:** `presentation-editor.html:99` and primary-action.js:112
- **Current:** `Автосохранение неактивно` / `Ждёт HTML`
- **Issue:** Two parallel texts for the same state ("no deck loaded"); HTML default and JS default disagree. Title attribute says `Загрузите HTML-презентацию, чтобы активировать shell редактора.` — leaks the word "shell" (jargon).
- **Suggestion:** Pick one — `Ожидает HTML` (consistent verb form). Title: `Откройте HTML-файл, чтобы редактор активировался.`

#### 3. Workspace status — "shell" jargon leak
- **File:** `editor/src/primary-action.js:113, 128`
- **Current:** `Загрузите HTML-презентацию, чтобы активировать shell редактора.` and `Shell пересоздаёт iframe и восстанавливает bridge.`
- **Issue:** "shell", "iframe", "bridge" are internal architecture terms — users do not know them. Same in topbar tooltips.
- **Suggestion (3a):** `Откройте HTML-файл, чтобы начать работу.`
- **Suggestion (3b):** `Восстанавливаем превью и связь с презентацией.`

#### 4. Topbar eyebrow vs landing
- **File:** `presentation-editor.html:84`
- **Current:** `Живой HTML-редактор`
- **Issue:** "Живой" reads as marketing copy, not as a section label. After v2.0.29 landing redesign hides chrome at empty state, this label only appears AFTER a deck loads, so it's redundant context for a user who already knows what they opened.
- **Suggestion:** Drop the eyebrow entirely OR replace with the deck filename (`document.title`). If kept: `HTML-редактор` (без "Живой" — слово ничего не добавляет).

#### 5. Save status pill — verbose & inconsistent register
- **File:** `editor/src/primary-action.js:34-43`
- **Current:** `Локальный черновик не создан` / `Есть правки • локальный черновик: HH:MM:SS` / `Есть несохранённые правки` / `Локальный черновик: HH:MM:SS` / `Изменений нет`
- **Issue:** Five different phrasings for two states (saved/unsaved). The bullet `•` separator is good HIG but the strings are too long for a topbar pill — they get cut off. "Изменений нет" sounds passive; "Сохранено" is active.
- **Suggestion:**
  - no deck → `—` (or hide pill entirely)
  - saved + no edits → `Сохранено · HH:MM`
  - dirty + last save → `Не сохранено · последняя HH:MM`
  - dirty + no last save → `Не сохранено`
- Drop `черновик` — every save is local; the word adds nothing.

#### 6. Empty-state hero — redundant lead
- **File:** `presentation-editor.html:507-510`, `editor/src/onboarding.js:30`
- **Current heading:** `Откройте HTML-презентацию`
- **Current lead:** `Редактор открывает файл напрямую — без конвертации. После загрузки можно сразу переходить к правке.`
- **Issue:** The lead says "the editor opens the file" twice (once explicitly, once implicitly via "after loading"). Russian users absorb the verb-noun-result faster as one beat.
- **Suggestion lead:** `Откройте локальный файл — редактор сразу подхватит слайды и стили.`

#### 7. Empty-state footnote alternative
- **File:** `presentation-editor.html:546-552`
- **Current:** `Или ... попробуйте на примере.`
- **Issue:** Lowercase casual button label `попробуйте на примере` clashes with "Или" capital. Reads like a footnote ad.
- **Suggestion:** `Или откройте демо-презентацию` (single button, no "Или" prefix) OR drop the "Или" and rephrase as a sibling action: `Нет файла? Откройте демо-презентацию.`

#### 8. `previewNoteText` "файл откроется" copy
- **File:** `editor/src/primary-action.js:496`
- **Current:** `Файл откроется в iframe без упрощений.`
- **Issue:** "iframe" is the worst kind of jargon — it's a technical detail of *how*, not a benefit. "Без упрощений" is also unclear ("simplifications of what?").
- **Suggestion:** `Презентация откроется как есть — со всеми скриптами и стилями.`

#### 9. Inspector empty-state title
- **File:** `presentation-editor.html:887`, primary-action.js:259
- **Current:** `Элемент не выбран`
- **Issue:** Fine, but the lead beneath is `Кликните по объекту на слайде. Для текста можно сделать двойной клик и сразу печатать.` — uses "объект" while the title says "элемент". Pick one.
- **Suggestion:** Use "элемент" everywhere (already the dominant term across inspector). Lead: `Кликните по элементу на слайде. Для текста — двойной клик, и можно печатать.`

#### 10. "Preset" / "preset слайда" — Latin term in Russian sentence
- **File:** `presentation-editor.html:1058 ("Без пресета"), 1068 ("Preset слайда"), 1070 ("Без preset-замены"), 1081 ("Применить preset")`
- **Issue:** Same concept written four different ways: "пресет" (transliterated), "preset" (Latin), "preset-замена" (compound). Even one screen is inconsistent.
- **Suggestion:** Standardize on "Шаблон" (already used elsewhere for slide templates) OR fully transliterate to "пресет". Don't mix Latin and Cyrillic in the same field-group.

#### 11. Image / media label
- **File:** `presentation-editor.html:1472`
- **Current:** `Изображение / media`
- **Issue:** Mixed alphabet for what is a single section heading. Compare to clean section names: "Текст и типографика", "Размер и позиция", "Слои и порядок".
- **Suggestion:** `Изображение и видео` (covers img + video + iframe).

#### 12. Diagnostics panel telemetry copy
- **File:** `presentation-editor.html:1593`
- **Current:** `Записывать действия в локальный журнал для себя`
- **Issue:** "для себя" reads colloquial / awkward; the sentence is a checkbox label and should be a short noun phrase, not a 6-word sentence.
- **Suggestion:** `Вести локальный журнал действий` + tooltip `Сохраняется только в браузере. В сеть не отправляется.` (already on the next line — move it to title attribute and keep label short).

#### 13. Lifecycle pill labels — too short, no shape
- **File:** `editor/src/primary-action.js:407-414`
- **Current:** `Превью запускается` / `Идёт восстановление` / `Потеряна связь` / `Нужна синхронизация`
- **Issue:** The first three are passive-voice updates; "Нужна синхронизация" jumps to imperative. Inconsistent voice.
- **Suggestion:** Either all passive (`Связь потеряна`, `Требуется синхронизация`) or all imperative (`Запускаем превью`, `Восстанавливаем`, `Восстановите связь`, `Синхронизируйте`). The current mix reads like four authors.

#### 14. Block-reason banner labels
- **File:** `editor/src/feedback.js:656-662`
- **Current samples:** `Масштаб ≠ 100% — перемещение на холсте отключено` / `🔒 Элемент заблокирован` / `Используется transform — перемещение через инспектор`
- **Issue:**
  - The `≠` symbol is correct but technical.
  - The 🔒 emoji as a *prefix* in some labels but not others is inconsistent (only `locked` has emoji; `transform` and `zoom` have plain text).
  - "перемещение через инспектор" repeats verbatim across 4 labels — the action mention belongs in the action button, not the label.
- **Suggestion:**
  - `zoom` → `При увеличении больше 100 % элемент нельзя двигать мышью`
  - `locked` → `Элемент заблокирован` (drop emoji; the icon belongs in the unlock button)
  - `*-transform` family → consolidate to one message: `Используется transform — для точных правок откройте инспектор` (one row, one message)

### Voice consistency patterns observed

1. **Passive vs imperative drift in lifecycle states** (see #13). `Превью запускается` (passive), `Восстанавливаем` (imperative-we), `Нужна синхронизация` (impersonal). Shell should pick one tense and one subject.
2. **"Кликните" vs "Нажмите"** — both appear (`Кликните по объекту`, `Нажмите «Начать редактирование»`). Russian software convention is "Нажмите" for buttons, "Кликните" for canvas/element selection — that distinction is mostly held but not consistently.
3. **"вы" vs implied imperative.** Inspector hints often use bare imperatives ("Выбери осторожно"), while modal/toast copy uses plural-formal ("Выберите файл"). Mixing "ты" forms (singular) with "вы" forms (plural) in the same UI is unusual for Russian software — most products commit to "вы". Examples of "ты" form: `Выбери шаблон`, `Используй осторожно`, `Подходит для коротких роликов` (impersonal but adjacent). Most of the rest is "вы". Pick one register.
4. **Latin tech terms inline.** `iframe`, `bridge`, `shell`, `dataset`, `preset`, `media`, `transform`, `Base URL`, `assets`, `data:image/...` all appear in user-facing strings. A non-developer Russian user understands maybe `URL` and `файл`. Audit pass should either translate, replace with metaphor, or remove.

### Missing copy / broken structure

- `presentation-editor.html:765` — `<option value="">— шрифт —</option>` uses an em-dash placeholder, while `:1250` uses `— авто —`. Different em-dash conventions. Pick one (`Авто` is cleanest).
- `presentation-editor.html:1267` line-height select uses parenthetical hints `1 (тесно)`, `1.6 (удобно)`, `2 (широко)` — these are good but one of them (`1.45 (как читать)` is missing — the `1.4` and `1.5` rows have no hint while 1, 1.6, 2 do).
- `editor/src/primary-action.js:35` — `Локальный черновик не создан` is the only place that says "не создан"; everywhere else is "Сохранено" / "Не сохранено". Strange phrasing.
- `presentation-editor.html:1308` — Backtick characters (`Enter` запускает...) are used as inline code markers in plain text, but the surrounding shell DOES NOT render markdown. Users will see literal backticks. Replace with `<kbd>Enter</kbd>` like the shortcuts modal does.

---

## Color / contrast spot-check

Already addressed (don't re-touch):
- `--shell-text-muted` light-theme alpha 0.6 → 0.78 (v2.0.16, AA pass)
- `--shell-focus` 0.18 → 0.32 alpha (v2.0.22, WCAG 2.4.7)
- `.mode-toggle button.is-suggested` darkened to ~6.5:1 (v2.0.16)

### Remaining contrast gaps

1. **`.empty-state-footnote`** (preview.css:663) — `color: color-mix(in srgb, var(--shell-text-muted) 80%, transparent)`. After v2.0.16's bump to 0.78 alpha, multiplying by 80 % brings effective alpha to ~0.62. On `--shell-panel` (#fff): contrast ≈ 4.1:1 — fails AA for 13 px (needs 4.5:1). **Fix:** drop the 80 % multiplier OR raise to 90 %.
2. **`.preview-note .topbar-eyebrow`** (preview.css:301) — `color: color-mix(in srgb, var(--shell-text-muted) 88%, var(--shell-text) 12%)` at 10 px font with 0.08em letter-spacing. Mathematically AA-borderline but visually muted. Worth measuring on actual gradient background of `.preview-note`.
3. **`#previewStatusSummary`** (preview.css:347) — uses `--shell-text-muted` at 10.5 px on `.preview-note` background. The note has a gradient (`canvas-note-bg → shell-panel`), so contrast varies across the element. AA threshold for 10 px is even higher (4.5:1 + size penalty). Likely fails on the darker gradient stop.
4. **`#interactionStatePill, #previewLifecyclePill`** (preview.css:442) — at `9px` and `--shell-text-muted` color, this is the worst-contrast surface in the shell. Both font size and contrast fail.
5. **Dark theme `--shell-text-muted`** (tokens.css:277) — still at 0.6 alpha. Current value computes to ~5.5:1 on `#16171a` (passes AA), but if the 0.78 bump for light was driven by HIG fidelity vs WCAG, a similar bump for dark (0.6 → 0.7) would future-proof against dark-theme panel re-tints.

### Tokens worth adding (Phase C, not now)

- `--surface-accent-fill` — currently `.stack-depth-badge` uses `--shell-accent` raw with a TODO comment (inspector.css:421); same story for `.toolbar-row button.is-active` (inspector.css:250).
- `--text-tertiary` — `.telemetry-viewer__subtitle` already falls back via `var(--text-tertiary, var(--text-secondary))` (inspector.css:860). Define it formally so the chain isn't fallback-only.
- `--space-3-5: 14px` OR explicit decision to forbid 14 px paddings.
- `--text-3xl: 28px` (or 32 px) for hero/landing displays.
- `--text-md-plus: 15px` if 15-17 px summary-titles are part of the design system; otherwise standardize on 14 / 16.

---

## What I did NOT audit

- A1 / A2 territory — no UX-flow heuristics, no a11y/keyboard/aria deep-dive (handled by sibling agents).
- iframe content (slide presentations themselves) — only shell chrome.
- `editor/src/export-pptx/*` and `editor/src/import-pipeline-v2/*` — backend-shaped pipelines with no user-facing surfaces beyond toast messages.
- Mobile-specific copy variants in `responsive.css` — only flagged the type/spacing escape values.
- Dark-theme rebinds beyond `--shell-text-muted` (audit was light-theme primary).
- Live runtime contrast measurements — all WCAG estimates above are computed from token values, not screenshot-sampled. A real contrast-ratio probe with the page rendered would refine #1, #2, #3 in the contrast section.
- `.codex/skills/*` and `docs/CHANGELOG.md` — not user-facing.
- `editor/src/import-pipeline-v2/import-report-modal.js` — toast text in this isolated modal not enumerated; the modal has its own typography island (15-16 px sizes off-scale, see import-report-modal.css line refs in type-scale section).

---

## Appendix: full grep counts (informational)

- Hardcoded `font-size: \d+px` outside tokens.css: **103 occurrences** across 11 CSS files
- Hardcoded `padding: \d+px` not on 4 pt grid (10/14/22/etc): **27 occurrences**
- Russian copy strings in `presentation-editor.html`: **~270 lines** with Cyrillic content (matches across labels/aria-labels/titles/options/help text)
- Russian copy strings in `editor/src/primary-action.js`: **~55 lines**
- Russian copy strings in `editor/src/feedback.js`: **~45 lines**
- Russian copy strings in `editor/src/onboarding.js`: **~25 lines**
- Latin tech terms appearing in RU sentences (sample): `iframe`, `bridge`, `shell`, `dataset`, `preset`, `media`, `transform`, `Base URL`, `assets`, `data:image/`, `slide-root`, `data-uri-stripped`, `autosave`
