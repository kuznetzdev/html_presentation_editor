// multi-select.js
// Layer: Direct manipulation — multi-select coordination (Phase D1)
// =====================================================================
// Public API (exposed on window):
//   selectAllOnSlide()     — Ctrl+A → push every node on the active slide
//                            into state.multiSelectNodeIds.
//   clearMultiSelect()     — Escape / click-empty → reset.
//   refreshMultiSelectAnchor() — keep state.multiSelectAnchorNodeId pointed
//                                 at the first item so combined-bbox math
//                                 has a stable origin.
//
// State touched (existing in state.js):
//   state.multiSelectNodeIds   — string[]
//   state.multiSelectAnchorNodeId — string|null (NEW)
// =====================================================================
"use strict";
(function () {
  "use strict";

  function isMultiSelectEnabled() {
    return Boolean(window.featureFlags && window.featureFlags.multiSelect);
  }

  function refreshMultiSelectAnchor() {
    if (!Array.isArray(state.multiSelectNodeIds) || state.multiSelectNodeIds.length === 0) {
      state.multiSelectAnchorNodeId = null;
    } else {
      state.multiSelectAnchorNodeId = state.multiSelectNodeIds[0];
    }
    // [v1.3.2 / Phase D2] Refresh alignment toolbar visibility.
    if (typeof window.refreshAlignmentToolbar === "function") {
      window.refreshAlignmentToolbar();
    }
  }

  function clearMultiSelect() {
    if (!Array.isArray(state.multiSelectNodeIds)) {
      state.multiSelectNodeIds = [];
    }
    if (state.multiSelectNodeIds.length === 0) return false;
    state.multiSelectNodeIds = [];
    state.multiSelectAnchorNodeId = null;
    if (typeof refreshUi === "function") refreshUi();
    // [v1.3.2 / Phase D2] Hide alignment toolbar on clear.
    if (typeof window.refreshAlignmentToolbar === "function") {
      window.refreshAlignmentToolbar();
    }
    return true;
  }

  function selectAllOnSlide() {
    if (!isMultiSelectEnabled() && state.complexityMode !== "advanced") return false;
    var slide = findModelSlide(state.activeSlideId);
    if (!slide) return false;
    var ids = Array.from(slide.querySelectorAll("[data-editor-node-id]"))
      .filter(function (el) {
        return (
          el.closest("[data-editor-slide-id]") === slide &&
          el.getAttribute("data-editor-entity-kind") !== "slide-root" &&
          el.getAttribute("data-editor-policy-kind") !== "protected"
        );
      })
      .map(function (el) { return el.getAttribute("data-editor-node-id"); })
      .filter(Boolean);
    if (!ids.length) return false;
    state.multiSelectNodeIds = ids.slice();
    state.multiSelectAnchorNodeId = ids[0];
    if (typeof refreshUi === "function") refreshUi();
    if (typeof window.refreshAlignmentToolbar === "function") {
      window.refreshAlignmentToolbar();
    }
    return true;
  }

  // Keyboard handler: Ctrl/Cmd+A → select-all on current slide; Escape → clear.
  function bindMultiSelectShortcuts() {
    document.addEventListener("keydown", function (event) {
      if (!isMultiSelectEnabled() && state.complexityMode !== "advanced") return;
      if (state.mode !== "edit") return;
      var isMod = event.ctrlKey || event.metaKey;
      if (isMod && event.key.toLowerCase() === "a" && !event.shiftKey && !event.altKey) {
        // Don't preempt text-edit Ctrl+A inside <input> / contenteditable.
        var target = event.target;
        var isFormControl =
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLElement && target.isContentEditable);
        if (isFormControl) return;
        var didSelect = selectAllOnSlide();
        if (didSelect) {
          event.preventDefault();
        }
      } else if (event.key === "Escape") {
        // Only clear if there's an active multi-select; do not preempt other
        // Escape handlers (modal close, etc.).
        if (state.multiSelectNodeIds && state.multiSelectNodeIds.length > 1) {
          clearMultiSelect();
          event.preventDefault();
        }
      }
    });
  }

  window.refreshMultiSelectAnchor = refreshMultiSelectAnchor;
  window.clearMultiSelect = clearMultiSelect;
  window.selectAllOnSlide = selectAllOnSlide;
  window.bindMultiSelectShortcuts = bindMultiSelectShortcuts;
})();
