# HTML Presentation References

Набор тестовых HTML-презентаций для проверки `html_presentation_editor` на разных стилях разметки и уровнях сложности.

## Состав

1. `01-minimal-inline.html` — минимальная презентация, inline styles, 2 слайда.
2. `02-semantic-css.html` — семантическая структура, embedded CSS, 3 слайда.
3. `03-absolute-positioned.html` — презентация с абсолютным позиционированием и слоями.
4. `04-data-attributes-editorish.html` — презентация с `data-*` атрибутами и editor-friendly DOM.
5. `05-css-variables-theme.html` — тема на CSS variables + dark mode.
6. `06-animated-fragments.html` — reveal/fragments/step-by-step элементы.
7. `07-svg-heavy.html` — слайды с inline SVG, диаграммами и декоративной графикой.
8. `08-table-and-report.html` — плотный контент: таблицы, KPI, списки.
9. `09-mixed-media.html` — карточки, code block, image placeholders, embeds-like layout.
10. `10-stress-nested-layout.html` — стресс-тест: глубокая вложенность, grid + flex + absolute.

## Что проверять в редакторе

- Парсинг количества слайдов.
- Переключение active slide.
- Работа с inline style / embedded style / CSS variables.
- Выделение и перемещение абсолютно позиционированных элементов.
- Редактирование текста в таблицах, списках, карточках.
- Работа с `data-*`, SVG, псевдо-компонентными блоками.
- Устойчивость к глубокой вложенности DOM.

