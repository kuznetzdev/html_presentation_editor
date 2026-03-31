# SOURCE OF TRUTH
## Проект: HTML Presentation Editor

**Версия:** 1.0  
**Статус:** основной документ проекта

## 1. Что мы строим

Мы строим локальный/клиентский визуальный редактор HTML-презентаций, который позволяет:
- загрузить существующий HTML-файл презентации;
- показать превью максимально близко к тому, как HTML открывается в браузере;
- выбрать любой допустимый элемент слайда;
- изменить текст, изображения, видео, базовые стили и структуру;
- вставлять новые элементы;
- экспортировать назад чистый HTML без следов редактора.

Это не generic page builder, не CMS и не low-code система общего назначения.
Это специализированный редактор HTML-презентаций.

## 2. Главная цель продукта

Сделать редактор, который:
- не требует обучения;
- не допускает тупиков;
- понятен даже слабому пользователю;
- не ломает презентацию при обычных действиях;
- даёт ощущение качественного современного продукта;
- работает стабильно как инструмент редактирования, а не как технодемка.

Главное ощущение:
**Открыл → выбрал → изменил → сохранил**

## 3. Неподвижные инварианты

- no dead ends
- predictable UX
- preview = truth
- recoverability через undo/redo/autosave
- Basic / Advanced обязательны
- shell UI живёт снаружи контента
- export обязан быть чистым

## 4. Архитектура

Зафиксированная схема:
- Parent shell
- Iframe preview
- Bridge
- modelDoc

Parent shell отвечает за:
- topbar
- slides list
- inspector
- floating toolbar
- context menu
- insert palette
- history
- autosave
- export
- mobile shell
- diagnostics UI

Iframe отвечает за:
- живой запуск документа
- реальный DOM презентации
- выполнение презентационных скриптов
- runtime selection/editing через bridge

Bridge отвечает за:
- команды parent → iframe
- сообщения iframe → parent
- runtime metadata
- selection
- element/slide updates
- diagnostics / heartbeat

modelDoc отвечает за:
- каноническую модель документа
- export
- restore
- history source
- editor logic

## 5. Архитектурные запреты

- нельзя ломать `iframe + bridge + modelDoc`
- нельзя превращать editor в DOM-грязь
- нельзя выстраивать продукт вокруг полной пересборки iframe как основного пути
- нельзя тащить продукт в generic page builder

## 6. Режимы

### Preview mode
- честный просмотр
- минимум вмешательства
- selection UI скрыт

### Edit mode
- выбор элементов
- редактирование
- вставка
- structural actions
- защитные механизмы

## 7. Basic / Advanced

Basic:
- закрывает массовые типовые действия
- не похож на devtools

Advanced:
- position / size / margin / padding
- id / class / dataset
- HTML элемента / слайда
- diagnostics

## 8. Текущие обязательные подсистемы

- slides list
- preview stage
- inspector
- floating toolbar
- context menu
- insert palette
- history / autosave / recovery
- export

## 9. Текущий backlog высокого приоритета

1. Live browser QA hardening
   - 390 / 640 / 820 / 1100 / 1280 / 1440+
   - topbar/menu/drawers/mobile rail не уезжают

2. Slide model v2
   - slide registry
   - slide settings
   - deterministic activation
   - safer slide-level UX

3. Asset edge cases
   - relative assets
   - CSS url()
   - srcset
   - media/poster
   - preview/export consistency
   - unresolved assets reporting

4. Direct manipulation QA hardening
   - transformed elements
   - nested positioned containers
   - zoom / scroll
   - touch / trackpad
   - very small targets
   - overlay collision cases

5. Structural cleanup
   - shell-layout
   - theme-system
   - preview-lifecycle
   - selection/direct-manipulation
   - inspector
   - slide-model
   - asset/export

## 10. Правило приоритета

Если возникает конфликт между:
- “добавить ещё фичу”
и
- “сделать путь пользователя проще, надёжнее и чище”,

всегда побеждает второе.
