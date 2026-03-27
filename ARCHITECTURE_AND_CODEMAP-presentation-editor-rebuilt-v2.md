# Архитектура и карта кода — `presentation-editor-rebuilt-v2.html`

## Назначение документа

Это техническая документация по **текущему состоянию** файла `presentation-editor-rebuilt-v2.html`.

Документ фиксирует:

- как работает редактор;
- почему выбрана именно такая архитектура;
- какие подсистемы где находятся;
- какие строки за что отвечают;
- где в коде внедрять новые функции;
- какие ограничения есть у текущей реализации;
- какие UX‑улучшения добавлены в roadmap.

> **Важно:** все ссылки на строки ниже актуальны именно для текущей сохранённой версии файла. После следующих правок номера строк сместятся.

---

# 1. Общая идея архитектуры

Редактор построен вокруг четырёх слоёв:

1. **Исходный HTML и модель (`state.modelDoc`)**
   - хранит редактируемую DOM-модель документа;
   - используется для инспектора, истории, autosave и экспорта.

2. **Превью в `iframe`**
   - получает копию `modelDoc`;
   - запускает исходные `<script>` презентации;
   - ведёт себя близко к обычному открытию HTML в браузере.

3. **Bridge внутри `iframe`**
   - детектирует движок презентации;
   - отслеживает текущий слайд;
   - управляет выделением и редактированием;
   - отправляет изменения обратно в родительское окно.

4. **UI родительского окна**
   - верхняя панель;
   - список слайдов;
   - инспектор;
   - floating toolbar;
   - модалки;
   - история;
   - autosave;
   - экспорт.

---

# 2. Почему это работает именно так

## 2.1. Превью строится через Blob URL, а не через «обезвреженный» `srcdoc`

Ключевой пайплайн:

- загрузка HTML → `loadHtmlString()` → строки `1707–1756`;
- построение `modelDoc` → `buildModelDocument()` → `1758–1777`;
- сборка preview HTML → `buildPreviewHtml()` → `1800–1808`;
- инъекция bridge → `injectBridge()` → `1820–1826`;
- создание object URL и установка `iframe.src` → `1743–1747`.

### Зачем так сделано
Если превью собирать как реальный документ через `Blob` URL и `iframe.src`, браузер обрабатывает его как полноценную HTML‑страницу, а не как упрощённый кусок DOM. Это лучше подходит для презентаций, где есть собственные `<script>` и runtime‑логика.

### Почему это оправдано
MDN указывает, что `URL.createObjectURL()` создаёт строку blob URL для `Blob`/`File`, а `URL.revokeObjectURL()` нужно вызвать после использования, чтобы браузер не держал ссылку на объект дальше. Это именно то, что делает редактор и для preview, и для экспорта.  
Источники:
- MDN — `URL.createObjectURL()`
- MDN — `URL.revokeObjectURL()`

---

## 2.2. Родитель и `iframe` общаются через `postMessage`

### Где это сделано
- отправка команд в iframe: `sendToBridge()` → `2560–2568`;
- приём сообщений от iframe: `bindMessages()` → `1511–1558`;
- отправка из bridge: `post()` внутри `buildBridgeScript()` → `1848–1850`.

### Зачем так сделано
`iframe.contentWindow` и прямой доступ к DOM зависят от same-origin правил. Поэтому логика обмена событиями сделана через `window.postMessage()`, а не через хрупкую прямую мутацию DOM iframe из родителя.

### Почему это оправдано
MDN для `contentWindow` и same-origin policy прямо указывает, что доступ к DOM iframe ограничивается политикой same-origin; для связи между окнами/iframe штатным каналом служит `postMessage()`, а при обработке сообщений нужно проверять отправителя и origin.  
Источники:
- MDN — `HTMLIFrameElement.contentWindow`
- MDN — `Window.postMessage()`
- MDN — same-origin policy

---

## 2.3. Изменения DOM отслеживаются через `MutationObserver`

### Где это сделано
Внутри bridge:
- `attachEngineHooks()` → `1993–2015`
- `MutationObserver` следит за структурой DOM и обновляет метаданные о слайдах.

### Зачем так сделано
Презентационные движки и пользовательские действия могут добавлять/удалять DOM-узлы после старта страницы. Нужно автоматически:
- назначать `data-editor-node-id`,
- обновлять список слайдов,
- не требовать ручной “перезагрузки списка”.

### Почему это оправдано
MDN описывает `MutationObserver` как стандартный механизм наблюдения за изменениями DOM, пришедший на смену старым Mutation Events.  
Источник:
- MDN — `MutationObserver`

---

## 2.4. Текст редактируется через точечный `contenteditable`

### Где это сделано
Внутри bridge:
- `canEditText()` → `2036–2046`
- `dblclick` → `2348–2350`
- выбор элемента с `focusText: true` → `2143–2158`

### Зачем так сделано
Редактор **не** включает `contenteditable` на весь слайд или крупные контейнеры. Он делает редактируемым только конкретный текстовый элемент по выбору пользователя.

### Почему это оправдано
MDN описывает `contenteditable` как атрибут, который делает конкретный элемент редактируемым. Такой режим безопаснее для презентационных движков, чем массовая установка `contenteditable` на весь слайд.  
Источник:
- MDN — `contenteditable`

---

## 2.5. Autosave хранится в `localStorage`

### Где это сделано
- ключ хранения: `STORAGE_KEY` → `1245`;
- баннер восстановления: `843–850`;
- чтение черновика: `tryRestoreDraftPrompt()` → `1689–1702`;
- autosave: `saveProjectToLocalStorage()` → `3193–3209`;
- очистка: `clearAutosave()` → `3210–3213`.

### Зачем так сделано
Чтобы не терять правки при случайной перезагрузке.

### Почему это оправдано
MDN описывает `localStorage` как объект хранения данных без срока истечения, но предупреждает, что на `file:`/`data:` происхождении или при запрете хранения браузером возможен `SecurityError`. Поэтому текущая реализация оборачивает доступ в `try/catch`.  
Источник:
- MDN — `localStorage`

---

## 2.6. Локальные картинки вставляются через `FileReader.readAsDataURL()`

### Где это сделано
- утилита `fileToDataUrl()` → `3367–3375`;
- вставка/замена изображений идёт через `data:` URL.

### Зачем так сделано
Чтобы изображение можно было сразу встроить в документ без внешнего сервера.

### Почему это оправдано
MDN показывает `readAsDataURL(blob)` как штатный способ прочитать `File`/`Blob` и получить строку, которую затем можно записать в `img.src`.  
Источник:
- MDN — `FileReader.readAsDataURL()`

---

## 2.7. Плавающая панель следит за размером элемента через `ResizeObserver`

### Где это сделано
Внутри bridge:
- `observeSelectedSize()` → `2134–2142`

В родителе:
- `positionFloatingToolbar()` → `2948–2973`

### Почему это оправдано
MDN описывает `ResizeObserver` как механизм отслеживания изменений размера элемента независимо от viewport resize. Это удобнее и точнее, чем пытаться всё пересчитывать только на `window.resize`.  
Источник:
- MDN — `ResizeObserver`

---

## 2.8. Вставка из буфера и drag/drop реализованы через стандартные браузерные API

### Где это сделано
- paste в bridge: `2414–2434`
- paste в родителе: `1567–1599`, `3486–3493`
- drag/drop в родителе: `1600–1638`

### Почему это оправдано
MDN разделяет Clipboard API на async API и события `copy/cut/paste`, а Drag and Drop API — на перенос внутри страницы, перенос наружу и перенос данных/файлов в страницу. Текущая версия использует именно этот стандартный путь для изображений.  
Источники:
- MDN — Clipboard API
- MDN — HTML Drag and Drop API

---

## 2.9. Предупреждение при закрытии вкладки делается через `beforeunload`

### Где это сделано
- `bindUnloadWarning()` → `1559–1566`

### Почему это оправдано
MDN описывает `beforeunload` как штатный способ вызвать системное подтверждение перед закрытием или навигацией, если есть несохранённые изменения.  
Источник:
- MDN — `beforeunload`

---

## 2.10. Reveal.js интегрируется через официальный API

### Где это сделано
В bridge:
- `detectEngine()` → `1860–1868`
- `collectSlides()` → `1903–1928`
- `getCurrentSlide()` → `1942–1961`
- `navigateToSlide()` → `2213–2241`
- `attachEngineHooks()` → `1993–2015`

### Почему это оправдано
Официальная документация reveal.js предоставляет методы `Reveal.getSlides()`, `Reveal.getCurrentSlide()`, `Reveal.getIndices()` и `Reveal.slide()`, а также события `ready`, `slidechanged` и другие. Для редактора это правильнее, чем вручную менять `display` у reveal‑слайдов.  
Источник:
- reveal.js API

---

# 3. Структура файла по строкам

| Строки | Блок | Что там находится |
|---|---|---|
| `1–6` | HTML skeleton | doctype, `<html>`, `<head>`, мета, title |
| `7–840` | CSS | тема, layout, панели, модалки, контекстное меню, floating toolbar |
| `843–850` | Restore banner | баннер восстановления черновика |
| `854–876` | Topbar | верхняя панель, режимы, undo/redo, открытие, экспорт |
| `879–888` | Slides panel | левая панель со списком слайдов |
| `890–935` | Preview panel | центральное превью, iframe, dropzone, floating toolbar |
| `935–1138` | Inspector | правая панель редактирования |
| `1142–1178` | Open HTML modal | модалка загрузки файла/вставки HTML |
| `1182–1196` | HTML editor modal | модалка редактирования HTML элемента/слайда |
| `1202–1208` | Context menu markup | базовое контекстное меню |
| `1211–1212` | Hidden file inputs | скрытые inputs для вставки/замены картинки |
| `1214–3491` | JS application | вся логика редактора |

---

# 4. Важные данные и состояния

## 4.1. Константы
- `STATIC_SLIDE_SELECTORS` → `1215–1226`  
  fallback‑селекторы для обычных HTML‑деков
- `TEXT_TAGS` → `1228`
- `EXCLUDED_TAGS` → `1229`
- `STORAGE_KEY` → `1230`
- `HISTORY_LIMIT` → `1231`

## 4.2. Глобальное состояние
`state` → `1233–1273`

Ключевые поля:
- `sourceHtml` — сырой HTML, загруженный пользователем;
- `modelDoc` — DOM‑модель для редактирования и экспорта;
- `previewUrl` — текущий Blob URL превью;
- `bridgeToken` — защита канала `postMessage`;
- `mode` — `preview` / `edit`;
- `slides` — список слайдов, пришедший из bridge;
- `selectedNodeId` — текущий элемент;
- `history`, `historyIndex` — undo/redo;
- `dirty` — есть ли несохранённые изменения.

## 4.3. DOM-кеш
`els` → `1275–1367`

Это единая карта всех `document.getElementById(...)`, чтобы:
- не искать элементы заново;
- уменьшить количество повторяющегося кода;
- сделать функции короче и предсказуемее.

---

# 5. Жизненный цикл приложения

## 5.1. Загрузка страницы
`init()` → `1369–1382`

Что делает:
1. вешает обработчики UI;
2. пытается поднять autosave;
3. обновляет внешний вид интерфейса.

---

## 5.2. Загрузка HTML
`loadHtmlString()` → `1707–1756`

Пошагово:
1. `cleanupPreviewUrl()` — убрать старый Blob URL;
2. `resetRuntimeState()` — сбросить bridge/runtime state;
3. сохранить `sourceHtml`, `sourceLabel`, `manualBaseUrl`;
4. вытащить doctype через `extractDoctype()`;
5. построить `modelDoc`;
6. собрать preview HTML;
7. создать `Blob`;
8. создать object URL;
9. установить `iframe.src`;
10. при `iframe.onload` отправить `set-mode`;
11. сохранить snapshot истории и autosave.

---

## 5.3. Сборка modelDoc
`buildModelDocument()` → `1758–1777`

Что делает:
- парсит HTML через `DOMParser`;
- ищет слайды;
- каждому слайду даёт `data-editor-slide-id`;
- каждому кандидат‑элементу даёт `data-editor-node-id`.

Это нужно, чтобы:
- родитель и iframe ссылались на одни и те же сущности;
- DOM можно было синхронизировать точечно, а не через полный replace.

---

## 5.4. Сборка превью
`buildPreviewHtml()` → `1800–1808`

Что делает:
- клонирует `modelDoc`;
- добавляет bridge‑скрипт;
- при необходимости добавляет `<base href="...">`;
- сериализует обратно в полноценный HTML.

---

## 5.5. Запуск bridge
`buildBridgeScript()` → `1827–2544`

Это самая важная часть runtime.

Bridge внутри iframe отвечает за:
- выбор элемента;
- hover / selection;
- режим редактирования;
- `contenteditable`;
- реакцию на клики, dblclick, paste, contextmenu;
- отправку метаданных и изменений наверх;
- локальные DOM‑операции по командам родителя.

---

# 6. Сообщения моста (контракт между окнами)

## 6.1. Из iframe → в родителя
Обрабатываются в `bindMessages()` → `1511–1558`

Типы:
- `bridge-ready`
- `runtime-metadata`
- `element-selected`
- `element-updated`
- `selection-geometry`
- `slide-updated`
- `slide-removed`
- `context-menu`
- `shortcut`
- `runtime-error`
- `runtime-log`

## 6.2. Из родителя → в iframe
Обрабатываются в bridge → `2442–2528`

Типы:
- `set-mode`
- `navigate-to-slide`
- `select-element`
- `apply-style`
- `apply-styles`
- `update-attributes`
- `replace-image-src`
- `reset-inline-styles`
- `delete-element`
- `duplicate-element`
- `move-element`
- `insert-element`
- `replace-node-html`
- `replace-slide-html`

---

# 7. Выделение, hover и редактирование текста

## 7.1. Выбор элемента
Внутри bridge:
- `getEditableElementFromTarget()` → `2055–2059`
- `selectElement()` → `2143–2158`
- `postSelection()` → `2118–2133`

Как это работает:
1. из `event.target` поднимаемся к ближайшему допустимому узлу;
2. bridge ставит `data-editor-selected="true"`;
3. bridge отправляет в родителя:
   - `nodeId`
   - `slideId`
   - tag
   - attrs
   - outerHTML
   - computed styles
   - флаги (`canEditText`, `isImage`, `isVideo`)

## 7.2. Двойной клик
В bridge: `2352–2360`

Если элемент текстовый:
- вызывается `selectElement(..., focusText: true)`;
- элемент получает `contenteditable="true"`.

## 7.3. Геометрия элемента
- `getRect()` → `2077–2081`
- `notifySelectionGeometry()` → `2159–2167`
- `applySelectionGeometry()` → `2607–2614`
- `positionFloatingToolbar()` → `2948–2973`

---

# 8. Контекстное меню

## Что есть сейчас
### Разметка
`1202–1208`

### Источник события в iframe
`2352–2366`

### Открытие в родителе
`openContextMenuFromBridge()` → `2691–2706`

### Действия меню
`bindContextMenu()` → `1639–1667`

Сейчас меню умеет:
- редактировать HTML;
- редактировать текст;
- дублировать;
- заменить изображение;
- сбросить стили;
- удалить.

## Что логично улучшать дальше
### Высокий приоритет
1. динамическая адаптация меню по типу элемента;
2. группировка по секциям;
3. иконки;
4. подсказки с хоткеями;
5. закрытие по `Escape`.

### Где это делать
- markup: `1202–1208`
- event source in iframe: `2352–2366`
- open/close logic: `2691–2712`
- action dispatch: `1639–1667`

---

# 9. Плавающая панель (floating toolbar)

## Что есть сейчас
### Разметка
`915–921`

### Обновление положения
- `applySelectionGeometry()` → `2607–2614`
- `positionFloatingToolbar()` → `2948–2973`
- `hideFloatingToolbar()` → `2974–2979`

### Кнопки
- удалить
- дублировать
- редактировать текст
- заменить изображение
- цвет текста
- размер шрифта

## Что улучшать дальше
### Высокий приоритет
1. drag handle и ручное перемещение;
2. запоминание позиции на сессию;
3. smart placement сверху/снизу/сбоку;
4. сворачивание;
5. контекстные кнопки для image / text / video.

### Где встраивать
- DOM панели: `915–921`
- refs: `1295–1301`
- geometry receive: `2607–2614`
- positioning: `2948–2973`

---

# 10. Инспектор справа

## Основные секции и строки
- базовая информация об элементе: `943–964`
- палитра вставки: `966–977`
- быстрые действия: `980–989`
- текст/типографика: `992–1020`
- размер/позиция: `1024–1072`
- оформление блока: `1076–1110`
- image tools: `1114–1129`
- help + diagnostics: `1133–1137`

## Обновление значений инспектора
`updateInspectorFromSelection()` → `2865–2946`

Функция читает `state.selectedComputed` и `state.selectedAttrs`, после чего:
- заполняет поля;
- показывает/скрывает image section;
- включает/выключает кнопки;
- синхронизирует мини‑бейджи.

## Что улучшать дальше
### Высокий приоритет
1. сворачиваемые секции;
2. сохранение свёрнутости в localStorage;
3. иконки и tooltip-пояснения;
4. вынести частые действия наверх;
5. copy style / paste style.

### Средний приоритет
1. rotate / flip / simple crop для image section;
2. presets для layout.

### Где это делать
- разметка инспектора: `943–1137`
- логика заполнения: `2865–2946`
- autosave состояния UI: рядом с `saveProjectToLocalStorage()` / новым отдельным key.

---

# 11. Вставка элементов

## Текст
`insertDefaultTextBlock()` → `3389–3401`

Вставляет блок вида:
- `<p>` с базовыми inline‑стилями
- и сразу переводит его в режим редактирования

## Картинка
- file input → `requestImageInsert()` → `3354–3366`
- чтение файла → `fileToDataUrl()` → `3367–3375`
- вставка → `insertImageElement()` → `3376–3388`

## Custom HTML
`insertCustomHtmlFromTextarea()` → `3402–3423`

## Видео
- prompt → `insertVideoByPrompt()` → `3424–3441`
- преобразование ссылки → `toVideoEmbedUrl()` → `3442–3461`

---

# 12. История, autosave, dirty-state

## Dirty-state
- `commitChange()` → `3120–3125`

## Debounce сохранения
- `schedulePersistence()` → `3126–3134`

## Undo / Redo snapshots
- `captureHistorySnapshot()` → `3135–3159`
- `undo()` → `3179–3185`
- `redo()` → `3186–3192`

## Autosave
- `saveProjectToLocalStorage()` → `3193–3209`
- `tryRestoreDraftPrompt()` → `1689–1702`
- `bindRestoreBanner()` → `1668–1688`

---

# 13. Экспорт

## Точка входа
`exportHtml()` → `3052–3071`

Пайплайн:
1. clone `modelDoc`
2. `stripEditorArtifacts()`
3. сериализация в HTML строку
4. Blob → object URL
5. `<a download>` click
6. `URL.revokeObjectURL()`

## Что именно очищается
`stripEditorArtifacts()` → `3072–3083`

Удаляется:
- `data-editor-node-id`
- `data-editor-slide-id`
- `#__presentation_editor_bridge__`
- `#__presentation_editor_helper_styles__`
- временный `<base data-editor-preview-base>`
- `data-editor-selected`
- `data-editor-hover`
- `contenteditable`
- `spellcheck`

---

# 14. Где внедрять новые пожелания из roadmap

## 14.1. Умное контекстное меню
**Менять здесь:**
- `1202–1208` — HTML разметка меню
- `1639–1667` — dispatch действий
- `2352–2366` — событие `contextmenu` внутри iframe
- `2691–2706` — показ и позиционирование меню

**Что добавить:**
- секции;
- иконки;
- динамический список пунктов для image / text / container;
- `Escape` close;
- copy image URL / open in new tab / fit width / reset size / convert to heading / add child / wrap in div.

---

## 14.2. Улучшение floating toolbar
**Менять здесь:**
- `915–921`
- `2607–2614`
- `2948–2973`

**Что добавить:**
- drag handle;
- smart placement;
- collapse;
- contextual toolset by node type;
- hover feedback on target element.

---

## 14.3. Toast notifications
Сейчас редактор пишет в diagnostics:
- `3224–3247`

**Что лучше сделать:**
- оставить diagnostics для debug;
- поверх добавить toast system;
- вызывать toast из тех же точек, где сейчас `commitChange()` / `addDiagnostic()` / успешные операции insert/delete/replace.

---

## 14.4. Сворачиваемые секции инспектора
**Менять здесь:**
- HTML секций инспектора `943–1137`
- `updateInspectorFromSelection()` для обновления контекста
- отдельный UI state key в localStorage

---

## 14.5. Copy style / paste style
**Новые точки интеграции:**
- copy: читать `state.selectedComputed` / inline style из modelDoc
- paste: отправлять пакет через `apply-styles`
- UI: инспектор + контекстное меню + floating toolbar

---

## 14.6. Сверка modelDoc с iframe
Сейчас синхронизация идёт событийно:
- `element-updated`
- `slide-updated`
- `slide-removed`

Если понадобится периодическая верификация:
- добавить heartbeat / checksum;
- или периодический `request-runtime-snapshot` через bridge.

Лучшая точка расширения:
- `bindMessages()` в родителе
- блок `window.addEventListener('message'...)` внутри bridge
- новый тип сообщения и checksum HTML активного слайда.

---

# 15. Ограничения и риски

## 15.1. Скрипты презентации могут ломать edit mode
Редактор старается не ломать runtime, но если внешняя логика:
- жёстко перехватывает click/contextmenu/selection,
- динамически пересобирает DOM,
- зависит от конкретных обёрток или классов,

то после ручного редактирования часть поведения может измениться.

## 15.2. `localStorage` на `file:` origin ненадёжен
По MDN, `localStorage` на `file:` и `data:` может вести себя нестабильно или выбрасывать `SecurityError`. Поэтому часть автосохранения лучше тестировать через `localhost`.

## 15.3. Относительные ресурсы
Если HTML использует относительные пути, нужен `Base URL` или запуск через локальный сервер.

---

# 16. Рекомендации по дальнейшей разработке

## Обязательно оставить
- разделение `modelDoc` и runtime iframe;
- `postMessage`‑bridge;
- очистку служебных артефактов при экспорте;
- точечный `contenteditable`;
- `MutationObserver` и `ResizeObserver`.

## Не делать
- массовый `outerHTML.replaceWith()` всего документа;
- глобальный `contenteditable` на весь слайд;
- “жёсткое” управление видимостью слайдов поверх reveal.js/shower;
- внедрение тяжёлых editor CSS прямо в body/html презентации.

---

# 17. Полный индекс функций

Ниже — карта функций **по текущим номерам строк**.

| Функция | Строки | Назначение |
|---|---:|---|
| `init()` | `1369-1382` | Точка входа: вешает обработчики, пробует восстановить черновик и обновляет UI. |
| `bindTopBarActions()` | `1383-1418` | Связывает верхнюю панель: загрузка HTML, экспорт, undo/redo, переключение режимов. |
| `bindInspectorActions()` | `1419-1495` | Связывает инспектор справа: стили, атрибуты, вставку элементов и HTML-редактор. |
| `bindModals()` | `1496-1510` | Назначает открытие/закрытие модальных окон. |
| `bindMessages()` | `1511-1558` | Подписывает родительское окно на сообщения от bridge внутри iframe. |
| `bindUnloadWarning()` | `1559-1566` | Показывает системное предупреждение beforeunload, если документ изменён. |
| `bindGlobalShortcuts()` | `1567-1599` | Глобальные горячие клавиши редактора вне iframe. |
| `bindClipboardAndDnD()` | `1600-1638` | Вставка изображений из буфера и drag/drop файлов в область превью. |
| `bindContextMenu()` | `1639-1667` | Обрабатывает действия кастомного контекстного меню. |
| `bindRestoreBanner()` | `1668-1688` | Кнопки восстановления/сброса автосохранённого черновика. |
| `tryRestoreDraftPrompt()` | `1689-1702` | Читает черновик из localStorage и показывает баннер восстановления. |
| `hideRestoreBanner()` | `1703-1706` | Скрывает баннер восстановления. |
| `loadHtmlString()` | `1707-1757` | Главный пайплайн загрузки: reset state → parse modelDoc → собрать preview → Blob URL → iframe.src. |
| `buildModelDocument()` | `1758-1777` | Создаёт modelDoc через DOMParser и расставляет служебные ID для слайдов и узлов. |
| `detectStaticSlides()` | `1778-1787` | Ищет слайды по fallback-набору селекторов. |
| `collectCandidateElements()` | `1788-1799` | Собирает DOM-элементы, которые редактор может выбрать/экспортировать. |
| `buildPreviewHtml()` | `1800-1809` | Строит HTML для iframe из clone(modelDoc), с bridge и опциональным base href. |
| `upsertBaseHref()` | `1810-1819` | Добавляет/обновляет <base> для относительных ресурсов в preview. |
| `injectBridge()` | `1820-1826` | Вставляет bridge-скрипт в конец body preview-документа. |
| `buildBridgeScript()` | `1827-1847` | Генерирует JS-мост, который живёт внутри iframe и синхронизирует превью с редактором. |
| `post()` | `1848-1851` | Отправляет сообщение из iframe в родительское окно. |
| `onRuntimeError()` | `1852-1859` | Пересылает ошибки runtime из iframe наружу. |
| `detectEngine()` | `1860-1868` | Определяет reveal/shower/remark/generic по API и DOM-признакам. |
| `nextNodeId()` | `1869-1873` | Генерирует очередной служебный ID узла. |
| `syncSequenceFromDom()` | `1874-1881` | Сверяет внутренний счётчик node-id с тем, что уже есть в DOM. |
| `isCandidate()` | `1882-1889` | Решает, можно ли считать элемент редактируемым/наблюдаемым. |
| `assignIdsDeep()` | `1890-1902` | Расставляет data-editor-node-id на корень и вложенные кандидаты. |
| `collectSlides()` | `1903-1928` | Собирает список слайдов с учётом движка и fallback-селекторов. |
| `getSlideTitle()` | `1929-1936` | Формирует заголовок слайда для левой панели. |
| `isSlideHidden()` | `1937-1941` | Проверяет, скрыт ли слайд движком/стилями. |
| `getCurrentSlide()` | `1942-1961` | Пытается определить активный слайд через API движка и fallback-сигналы. |
| `currentSlideId()` | `1962-1966` | Возвращает ID текущего активного слайда. |
| `emitRuntimeMetadata()` | `1967-1982` | Отправляет в родителя метаданные: движок, список слайдов, активный слайд, URL, поддержку edit mode. |
| `queueMetadataRefresh()` | `1983-1992` | Дебаунсит обновление метаданных на animation frame. |
| `attachEngineHooks()` | `1993-2015` | Подписывается на события reveal.js и включает MutationObserver для generic-случая. |
| `ensureHelperStyles()` | `2016-2035` | Вставляет внутрь iframe минимальные helper-стили редактора (hover/selection/contenteditable). |
| `canEditText()` | `2036-2046` | Разрешает contenteditable только для текстовых тегов. |
| `isImageElement()` | `2047-2050` | Проверяет, что выбран IMG. |
| `isVideoFrame()` | `2051-2054` | Проверяет, что выбран iframe видео. |
| `getEditableElementFromTarget()` | `2055-2059` | Поднимается от event.target к ближайшему редактируемому элементу. |
| `clearHover()` | `2060-2063` | Снимает hover-подсветку. |
| `clearSelection()` | `2064-2076` | Снимает выделение текущего элемента. |
| `getRect()` | `2077-2081` | Собирает геометрию выбранного элемента. |
| `getAttributes()` | `2082-2091` | Собирает атрибуты элемента для инспектора. |
| `collectComputed()` | `2092-2117` | Собирает вычисленные стили и флаги, нужные инспектору и тулбару. |
| `postSelection()` | `2118-2133` | Отправляет в родителя снимок выделенного элемента. |
| `observeSelectedSize()` | `2134-2142` | Вешает ResizeObserver на выбранный элемент. |
| `selectElement()` | `2143-2158` | Главная функция выбора элемента внутри iframe. |
| `notifySelectionGeometry()` | `2159-2167` | Отправляет геометрию выбранного элемента для позиционирования панели. |
| `notifyElementUpdated()` | `2168-2184` | Отправляет сериализованный outerHTML и метаданные изменённого элемента. |
| `notifySlideUpdated()` | `2185-2190` | Отправляет обновлённый outerHTML слайда. |
| `notifySlideRemoved()` | `2191-2195` | Сообщает, что слайд удалён. |
| `parseSingleRoot()` | `2196-2204` | Безопасно парсит HTML в один корневой элемент внутри iframe. |
| `findNodeById()` | `2205-2208` | Ищет узел по data-editor-node-id внутри iframe. |
| `findSlideById()` | `2209-2212` | Ищет слайд по data-editor-slide-id внутри iframe. |
| `navigateToSlide()` | `2213-2241` | Навигация к слайду через Reveal API, custom API, shower hash или scrollIntoView. |
| `cssEscape()` | `2242-2246` | Fallback для CSS.escape в основном окне. |
| `deleteElementById()` | `2247-2262` | Удаляет элемент/слайд внутри iframe и уведомляет родителя. |
| `duplicateElementById()` | `2263-2273` | Клонирует выбранный элемент, пересчитывает node-id, выделяет копию. |
| `moveElementById()` | `2274-2288` | Сдвигает элемент по DOM вверх/вниз относительно соседей. |
| `replaceImageSrc()` | `2289-2297` | Меняет src/alt у картинки. |
| `insertElement()` | `2298-2312` | Вставляет новый элемент в текущий слайд/относительно якоря. |
| `updateAttributes()` | `2313-2539` | Патчит атрибуты выбранного элемента через bridge. |
| `boot()` | `2540-2559` | Старт bridge внутри iframe: детект движка, стили, хуки, первый sync. |
| `sendToBridge()` | `2560-2569` | Отправляет команду из родителя в iframe через postMessage. |
| `applyRuntimeMetadata()` | `2570-2588` | Обновляет state.slides / activeSlideId / engine по данным из iframe. |
| `applyElementSelection()` | `2589-2606` | Кладёт выбранный элемент в state и обновляет инспектор. |
| `applySelectionGeometry()` | `2607-2614` | Получает геометрию из iframe для floating toolbar. |
| `applyElementUpdateFromBridge()` | `2615-2645` | Синхронизирует изменённый элемент из iframe обратно в modelDoc. |
| `applySlideUpdateFromBridge()` | `2646-2663` | Синхронизирует изменённый слайд из iframe обратно в modelDoc. |
| `applySlideRemovedFromBridge()` | `2664-2679` | Удаляет слайд из modelDoc и обновляет левую панель. |
| `handleBridgeShortcut()` | `2680-2690` | Обрабатывает shortcut-события, пришедшие из iframe. |
| `openContextMenuFromBridge()` | `2691-2706` | Открывает контекстное меню в родителе по координатам из iframe. |
| `closeContextMenu()` | `2707-2712` | Закрывает контекстное меню. |
| `setMode()` | `2713-2734` | Переключает preview/edit и синхронизирует режим с bridge. |
| `renderSlidesList()` | `2735-2792` | Перерисовывает левую панель со слайдами и кнопками move up/down. |
| `hasStaticSlide()` | `2793-2796` | Проверяет, существует ли экспортируемый слайд в modelDoc. |
| `moveSlide()` | `2797-2811` | Меняет порядок слайдов в modelDoc. |
| `rebuildPreviewKeepingContext()` | `2812-2832` | Пересобирает iframe после изменений, пытаясь сохранить активный слайд. |
| `startTextEditing()` | `2833-2837` | Просит iframe перевести выбранный текстовый узел в contenteditable. |
| `applyStyle()` | `2838-2842` | Применяет одно CSS-свойство к выбранному узлу через bridge. |
| `updateAttributes()` | `2843-2847` | Патчит атрибуты выбранного элемента через bridge. |
| `toggleStyleOnSelected()` | `2848-2864` | Переключает bold/italic/underline по вычисленным стилям. |
| `updateInspectorFromSelection()` | `2865-2947` | Заполняет инспектор значениями выбранного элемента. |
| `positionFloatingToolbar()` | `2948-2973` | Ставит floating toolbar рядом с выбранным элементом. |
| `hideFloatingToolbar()` | `2974-2979` | Скрывает floating toolbar. |
| `openElementHtmlEditor()` | `2980-2993` | Открывает модалку HTML для выбранного элемента. |
| `openSlideHtmlEditor()` | `2994-3012` | Открывает модалку HTML для активного слайда. |
| `saveHtmlEditorChanges()` | `3013-3029` | Делегирует сохранение HTML элемента/слайда. |
| `saveElementHtml()` | `3030-3040` | Заменяет HTML одного элемента и в modelDoc, и в iframe. |
| `saveSlideHtml()` | `3041-3051` | Заменяет HTML одного слайда и в modelDoc, и в iframe. |
| `exportHtml()` | `3052-3071` | Собирает чистый HTML и скачивает presentation-edited.html. |
| `stripEditorArtifacts()` | `3072-3083` | Удаляет все data-editor-*, helper-style, bridge-script, contenteditable и прочие служебные следы. |
| `parseSingleRootElement()` | `3084-3094` | Парсит HTML из модалки и требует ровно один корневой элемент. |
| `resetRuntimeState()` | `3095-3112` | Сбрасывает runtime-state перед новой загрузкой. |
| `cleanupPreviewUrl()` | `3113-3119` | Освобождает старый Blob URL превью. |
| `commitChange()` | `3120-3125` | Помечает документ dirty и планирует autosave/history snapshot. |
| `schedulePersistence()` | `3126-3134` | Дебаунсит autosave и captureHistorySnapshot. |
| `captureHistorySnapshot()` | `3135-3159` | Сохраняет снапшот в стек undo/redo. |
| `serializeCurrentProject()` | `3160-3166` | Сериализует текущее состояние modelDoc в чистый HTML. |
| `restoreSnapshot()` | `3167-3178` | Восстанавливает снапшот из истории. |
| `undo()` | `3179-3185` | Шаг назад по истории. |
| `redo()` | `3186-3192` | Шаг вперёд по истории. |
| `saveProjectToLocalStorage()` | `3193-3209` | Сохраняет проект в localStorage. |
| `clearAutosave()` | `3210-3213` | Очищает autosave-черновик. |
| `openModal()` | `3214-3218` | Открывает модалку. |
| `closeModal()` | `3219-3223` | Закрывает модалку. |
| `addDiagnostic()` | `3224-3229` | Добавляет строку в диагностику. |
| `updateDiagnostics()` | `3230-3247` | Перерисовывает панель диагностики. |
| `refreshUi()` | `3248-3283` | Общий рефреш кнопок, бейджей, режимов, списков и доступности контролов. |
| `pluralizeSlides()` | `3284-3291` | Склоняет подпись количества слайдов. |
| `extractDoctype()` | `3292-3296` | Вытаскивает doctype из исходной HTML-строки. |
| `rgbToHex()` | `3297-3305` | Конвертирует rgb(...) в hex для color input. |
| `normalizeHex()` | `3306-3313` | Нормализует HEX-цвет для input[type=color]. |
| `safeSelectValue()` | `3314-3318` | Безопасно выбирает option в select. |
| `sanitizeCssValue()` | `3319-3323` | Удаляет опасные CSS-последовательности из текстового значения. |
| `normalizeCssInput()` | `3324-3330` | Нормализует пустые/none/auto/числовые CSS-вводы. |
| `toCssSize()` | `3331-3334` | Добавляет px к числу в поле размера. |
| `cssEscape()` | `3335-3339` | Fallback для CSS.escape в основном окне. |
| `escapeHtml()` | `3340-3348` | Экранирует HTML в текстовых шаблонах редактора. |
| `shouldIgnoreGlobalShortcut()` | `3349-3353` | Блокирует глобальные хоткеи, если пользователь печатает в input/textarea/contenteditable. |
| `requestImageInsert()` | `3354-3366` | Открывает скрытый input file для вставки/замены картинки. |
| `fileToDataUrl()` | `3367-3375` | Читает локальный файл как data URL. |
| `insertImageElement()` | `3376-3388` | Вставляет <img> на текущий слайд через bridge. |
| `insertDefaultTextBlock()` | `3389-3401` | Вставляет дефолтный текстовый блок. |
| `insertCustomHtmlFromTextarea()` | `3402-3423` | Вставляет произвольный HTML из textarea. |
| `insertVideoByPrompt()` | `3424-3441` | Запрашивает URL и вставляет video iframe. |
| `toVideoEmbedUrl()` | `3442-3461` | Преобразует YouTube/Vimeo URL в embed URL. |
| `duplicateSelectedElement()` | `3462-3467` | Дублирует текущий выделенный элемент. |
| `deleteSelectedElement()` | `3468-3474` | Удаляет текущий выделенный элемент. |
| `moveSelectedElement()` | `3475-3479` | Сдвигает текущий выделенный элемент. |
| `resetSelectedStyles()` | `3480-3485` | Сбрасывает inline-style у выделенного элемента. |
| `extractImageFromClipboardEvent()` | `3486-3493` | Достаёт изображение из paste-события. |

---

# 18. Внешние источники, на которые опирается архитектура

## MDN / official docs
- `URL.createObjectURL()`  
  https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static
- `URL.revokeObjectURL()`  
  https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL_static
- `Window.postMessage()`  
  https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- `HTMLIFrameElement.contentWindow`  
  https://developer.mozilla.org/en-US/docs/Web/API/HTMLIFrameElement/contentWindow
- Same-origin policy  
  https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy
- `MutationObserver`  
  https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
- `contenteditable`  
  https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/contenteditable
- `localStorage`  
  https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- `FileReader.readAsDataURL()`  
  https://developer.mozilla.org/en-US/docs/Web/API/FileReader/readAsDataURL
- `ResizeObserver`  
  https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
- Clipboard API  
  https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
- HTML Drag and Drop API  
  https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API
- `beforeunload`  
  https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event

## reveal.js
- API methods  
  https://revealjs.com/api/

---

# 19. Краткий итог

`presentation-editor-rebuilt-v2.html` уже является **не демо-макетом, а рабочим редактором** со следующими ключевыми свойствами:

- превью и модель разделены;
- runtime логика презентации максимально сохраняется;
- редактирование выполняется точечно;
- изменения синхронизируются обратно в модель;
- есть экспорт, история и автосохранение.

Следующий этап — не переписывать архитектуру заново, а развивать:
- smarter context menu,
- smarter floating toolbar,
- collapsible inspector,
- toasts,
- copy/paste style,
- soft verification between iframe and modelDoc.

---
