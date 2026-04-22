"use strict";
// entity-kinds.js — Layer 1 entity kind registry (ADR-016)
// Single source of truth for all editor entity kinds.
// Exposes three window globals consumed by shell and bridge:
//   window.ENTITY_KINDS             — frozen array of kind descriptor objects
//   window.ENTITY_KINDS_CANONICAL   — frozen Set of all kind IDs (including 'none')
//   window.ENTITY_KINDS_KNOWN       — frozen Set of kind IDs excluding 'none' (12 entries)
// Script load order: entity-kinds.js → constants.js → bridge-commands.js
(function () {
  "use strict";
  var ENTITY_KINDS = Object.freeze([
    Object.freeze({ id: "text",       label: "Текст",        inspectorSections: Object.freeze(["typography","color","alignment"]) }),
    Object.freeze({ id: "image",      label: "Изображение",  inspectorSections: Object.freeze(["geometry","src"]) }),
    Object.freeze({ id: "video",      label: "Видео",        inspectorSections: Object.freeze(["geometry","src"]) }),
    Object.freeze({ id: "container",  label: "Контейнер",    inspectorSections: Object.freeze(["geometry","background"]) }),
    Object.freeze({ id: "element",    label: "Элемент",      inspectorSections: Object.freeze(["geometry"]) }),
    Object.freeze({ id: "slide-root", label: "Слайд",        inspectorSections: Object.freeze(["background"]) }),
    Object.freeze({ id: "protected",  label: "Защищённый",   inspectorSections: Object.freeze([]) }),
    Object.freeze({ id: "table",      label: "Таблица",      inspectorSections: Object.freeze(["geometry"]) }),
    Object.freeze({ id: "table-cell", label: "Ячейка",       inspectorSections: Object.freeze(["typography","color"]) }),
    Object.freeze({ id: "code-block", label: "Код",          inspectorSections: Object.freeze([]) }),
    Object.freeze({ id: "svg",        label: "SVG",          inspectorSections: Object.freeze(["geometry"]) }),
    Object.freeze({ id: "fragment",   label: "Фрагмент",     inspectorSections: Object.freeze([]) }),
    Object.freeze({ id: "none",       label: "—",            inspectorSections: Object.freeze([]) })
  ]);
  var ENTITY_KINDS_CANONICAL = Object.freeze(new Set(ENTITY_KINDS.map(function(k) { return k.id; })));
  var ENTITY_KINDS_KNOWN = Object.freeze(new Set(ENTITY_KINDS.filter(function(k) { return k.id !== "none"; }).map(function(k) { return k.id; })));
  window.ENTITY_KINDS = ENTITY_KINDS;
  window.ENTITY_KINDS_CANONICAL = ENTITY_KINDS_CANONICAL;
  window.ENTITY_KINDS_KNOWN = ENTITY_KINDS_KNOWN;
})();
