# CODEX HANDOFF PROMPTS

Ниже — последовательные рабочие промпты для Codex/ИИ-агента.

---
## PROMPT 1 — восстановление контекста

Ты продолжаешь разработку HTML Presentation Editor.

Контекст:
- iframe + bridge + modelDoc архитектура
- shell UI снаружи iframe
- редактор НЕ должен ломать DOM презентации
- export должен быть чистым (без editor-артефактов)

Инварианты:
- no dead ends
- predictable UX
- preview = truth
- undo/redo/autosave обязательны
- Basic/Advanced режимы
- UI не загрязняет HTML

Текущий статус:
- есть selection overlay
- есть direct manipulation
- есть slide model v1/v1.5
- есть insert palette
- есть context menu
- есть export

Главные проблемы:
1. адаптив ломает shell
2. slide lifecycle нестабилен
3. asset pipeline неполный
4. direct manipulation нестабилен
5. код превращается в override-слои

Сначала:
1. кратко восстанови состояние
2. выдели 3–5 проблем
3. предложи следующий инженерный проход
4. затем делай изменения

---
## PROMPT 2 — shell hardening

Цель: стабилизировать shell UI.

Проверить и исправить ширины:
- 390
- 640
- 820
- 1100
- 1280
- 1440+

Проблемы:
- topbar не уезжает
- drawers не ломают layout
- mobile rail не перекрывает canvas
- palette/menu не вылазят за экран
- нет horizontal scroll
- canvas всегда главный

Сделать:
1. убрать зависимость от фиксированных topbar offsets
2. вычислять реальные offsets
3. unify layout:
   - topbar
   - workspace
   - drawers
   - overlays
4. убрать layout-shifting элементы
5. сделать popover/menu anchored

Проверить:
- light/dark
- resize окна
- мобильный режим

---
## PROMPT 3 — slide model v2

Цель: сделать slide first-class entity.

Добавить:
1. slide registry
2. slide settings:
   - title
   - background
   - padding preset
   - layout preset
3. slide lifecycle:
   create → insert → activate → sync → preview
4. гарантии:
   - новый slide сразу активируется
   - slide list синхронизирован
   - preview показывает правильный slide
5. убрать implicit fallback navigation / scrollIntoView как основной механизм

Добавить API:
requestSlideActivation(slideId)

Сделать:
- deterministic navigation
- без гонок parent ↔ iframe

---
## PROMPT 4 — asset pipeline

Цель: полноценный asset resolver.

Покрыть:
- src
- srcset
- CSS url()
- video src
- poster
- <source>

Реализовать:
1. asset map: relativePath → Blob URL
2. поддержка:
   - file input
   - directory input (webkitdirectory)
3. rewrite:
   - HTML
   - CSS
   - inline styles
4. диагностика unresolved assets
5. consistency preview == export

Не ломать оригинальные пути в modelDoc.

---
## PROMPT 5 — direct manipulation hardening

Цель: стабилизировать drag/resize.

Проблемы:
- transform ломает позиционирование
- nested containers ломают расчёты
- zoom/scroll влияет на координаты
- маленькие элементы неуправляемы

Сделать:
1. unified coordinate system:
   iframe → stage → overlay
2. safe zones:
   - если layout сложный → блокируем drag
   - fallback → inspector
3. улучшить:
   - snap
   - guides
   - constraints
4. pointer handling:
   - mouse
   - touch
   - trackpad
5. edge cases:
   - tiny elements
   - overflow hidden
   - flex/grid

Цель:
не идеальная магия, а предсказуемость.

---
## PROMPT 6 — кодовая структура

Цель: убрать хаос.

Разделить код на слои:
- shell-layout
- theme-system
- preview-lifecycle
- bridge
- selection
- direct-manipulation
- slide-model
- asset-system
- export

Запреты:
- никаких новых override-слоёв
- никаких дублирующих top-level функций
- один source of truth на действие

Результат:
код читается как система, а не как патчи.
