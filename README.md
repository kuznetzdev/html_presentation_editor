# HTML Presentation Editor Repository Pack

Это собранный пакет текущего состояния проекта **HTML Presentation Editor**.

## Что внутри

- `editor/presentation-editor-v12.html` — актуальная hardened-сборка редактора
- `docs/SOURCE_OF_TRUTH.md` — зафиксированная продуктовая и архитектурная истина
- `docs/README_REPO_STRUCTURE.md` — структура репозитория и назначение файлов
- `docs/CODEX_HANDOFF_PROMPTS.md` — последовательные handoff-промпты для Codex/ИИ-агента
- `docs/REPORT_V12.md` — отчёт по последнему инженерному проходу
- `docs/VALIDATION_NOTES_V12.md` — notes по валидации последнего прохода
- `docs/REMAINING_ISSUES.md` — актуальный backlog после v12
- `docs/history/` — предыдущие HTML-версии, diff и отчёты
- `docs/source-materials/` — исходные ТЗ, handoff и материалы проекта

## Рекомендованная точка входа

1. Прочитать `docs/SOURCE_OF_TRUTH.md`
2. Прочитать `docs/CODEX_HANDOFF_PROMPTS.md`
3. Открыть `editor/presentation-editor-v12.html`
4. Далее работать от `docs/REMAINING_ISSUES.md`

## Ключевые инварианты

- `iframe + bridge + modelDoc` не ломать
- shell-UI живёт снаружи контента
- export обязан оставаться чистым
- Basic / Advanced обязательны
- при конфликте между новой фичей и устойчивостью побеждает устойчивость

## Текущий фокус разработки

1. Shell / responsive hardening
2. Slide model v2
3. Asset edge cases
4. Direct manipulation hardening
5. Очистка структуры кода без новых override-слоёв
