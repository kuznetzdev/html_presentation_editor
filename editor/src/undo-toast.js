// undo-toast.js
// Layer: UX honesty — V2-07 unified Undo toast for destructive actions
// =====================================================================
// Wraps showToast with the Undo button + 6.2s TTL. Caller passes a
// description and (optionally) an explicit undo function. Default undo
// = window.undo (history undo).
//
//   showUndoToast({
//     title: "Слайд удалён",
//     message: "Слайд 3 убран.",
//   });
//
//   showUndoToast({ message, onUndo: customUndoFn });
// =====================================================================
"use strict";
(function () {
  "use strict";

  function showUndoToast(opts) {
    var options = opts || {};
    if (typeof showToast !== "function") return;
    showToast(options.message || "Действие выполнено.", options.type || "info", {
      title: options.title || "Можно отменить",
      ttl: Math.max(5200, Number(options.ttl || 6200)),
      actionLabel: options.actionLabel || "Отменить",
      onAction:
        typeof options.onUndo === "function"
          ? options.onUndo
          : function () {
              if (typeof undo === "function") {
                undo();
              }
            },
      closeOnAction: options.closeOnAction !== false,
    });
  }

  window.showUndoToast = showUndoToast;
})();
