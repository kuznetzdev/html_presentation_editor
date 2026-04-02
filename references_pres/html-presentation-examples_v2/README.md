# HTML Presentation Examples

Набор демонстрационных HTML-презентаций разной сложности для тестирования редактора презентаций.

## Что внутри

1. `01-basic-static-inline.html`  
   Самый простой single-file deck: обычные `section`, стили прямо в HTML.

2. `02-semantic-sections-classes.html`  
   Семантическая разметка + внутренний CSS + переиспользуемые классы.

3. `03-scroll-snap-deck.html`  
   Полноэкранный deck на `CSS Scroll Snap`.

4. `04-data-driven-rendered.html`  
   Слайды рендерятся из JS-модели данных.

5. `05-web-components-deck.html`  
   Deck на custom elements: `slide-deck` / `slide-page`.

6. `06-reveal-compatible-markup.html`  
   Reveal-style структура: `.reveal .slides > section` с nested sections.

7. `07-relative-assets-multi-file.html`  
   Multi-file пример с external CSS/JS и relative assets.

## Для чего это полезно

- regression-тесты редактора
- проверка selection / inspector / export
- проверка slide model
- проверка direct manipulation
- проверка asset resolver и preview/export parity

## Как запускать

Можно открывать `index.html` напрямую в браузере.

Для multi-file кейса с относительными ресурсами лучше запускать через локальный сервер, например:

```bash
python -m http.server 8000
```

Потом открыть:
`http://localhost:8000/`

## Структура

- `index.html` — витрина примеров
- `examples/` — сами презентации
- `examples/assets/` — локальные SVG-ассеты
- `examples/css/` — внешний CSS
- `examples/js/` — внешний JS
