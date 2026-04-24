// user-action-boundary.js
// Layer: Error recovery Layer 4 (V2-03 / Phase E2)
// =====================================================================
// Wraps a user-triggered mutation in a snapshot → run → rollback-on-error
// envelope. If the fn throws OR returns `{ ok: false }`, the modelDoc is
// restored from the captured snapshot. A structured toast surfaces the
// failure.
//
//   withActionBoundary("style:padding", () => {
//     node.style.padding = userInput; // may throw
//     return { ok: true };
//   });
//
// The boundary is deliberately small: it exists to guarantee the model
// doesn't end up in a half-mutated state after a bad input or an
// unexpected error. It is NOT a catch-all for all errors in the shell.
// =====================================================================
"use strict";
(function () {
  "use strict";

  function snapshotModelDoc() {
    if (!state.modelDoc) return null;
    try {
      return state.modelDoc.documentElement
        ? state.modelDoc.documentElement.outerHTML
        : null;
    } catch (_) {
      return null;
    }
  }

  function restoreModelDocFromSnapshot(snapshot) {
    if (!snapshot || !state.modelDoc || !state.modelDoc.documentElement) return false;
    try {
      // Replace the entire <html> content. Caller is responsible for any
      // re-attach of event handlers; the bridge resends selection state
      // after restoration.
      state.modelDoc.documentElement.innerHTML = snapshot.replace(
        /^<html[^>]*>|<\/html>$/gi,
        "",
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  // Main API: run fn inside a snapshot + rollback-on-fail envelope.
  // Returns the fn's result (any value other than `false` is treated as
  // success). If fn throws, returns { ok: false, error }.
  function withActionBoundary(reason, fn) {
    var snapshot = snapshotModelDoc();
    try {
      var result = fn();
      if (result && typeof result === "object" && result.ok === false) {
        restoreModelDocFromSnapshot(snapshot);
        if (typeof showToast === "function") {
          showToast(
            (result.message || "Действие не удалось — состояние восстановлено."),
            "error",
            { title: "Откат", ttl: 4200 },
          );
        }
        return result;
      }
      return result;
    } catch (error) {
      restoreModelDocFromSnapshot(snapshot);
      if (typeof reportShellWarning === "function") {
        reportShellWarning("action-boundary:" + reason, error, { once: false });
      }
      if (typeof showToast === "function") {
        showToast(
          "Ошибка при выполнении действия — состояние восстановлено.",
          "error",
          { title: "Откат", ttl: 4600 },
        );
      }
      return { ok: false, error: error };
    }
  }

  window.withActionBoundary = withActionBoundary;
  window.__actionBoundarySnapshot = snapshotModelDoc;
  window.__actionBoundaryRestore = restoreModelDocFromSnapshot;
})();
