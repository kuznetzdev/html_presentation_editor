// onboarding-v2.js
// Layer: UX polish — first-session hints (Phase E3 / ADR-037)
// =====================================================================
// Three lightweight hints that appear during the user's first edit
// session only. Each hint is a short toast surfaced once per storage
// key; dismissal is implicit (closing the toast) or explicit (the
// "Skip hints" action). Reset via window.resetOnboardingV2().
//
// Hints fire in this order:
//   1. "Кликни по элементу, чтобы выбрать" — right after first deck load
//   2. "Двойной клик по тексту → inline edit" — right after first select
//   3. "Нажми ? для списка горячих клавиш" — right after first edit
// =====================================================================
"use strict";
(function () {
  "use strict";

  var STORAGE_KEY = "presentation-editor:onboarding-v2:v1";

  function readSeen() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function writeSeen(seen) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
    } catch (_) {
      /* localStorage full → silently skip */
    }
  }

  function markSeen(key) {
    var seen = readSeen();
    seen[key] = true;
    writeSeen(seen);
  }

  function hasSeen(key) {
    var seen = readSeen();
    return Boolean(seen[key]);
  }

  // Emit a hint toast if not yet seen.
  function showHintOnce(key, message, options) {
    if (hasSeen(key)) return false;
    if (typeof showToast !== "function") return false;
    var opts = Object.assign({ title: "Подсказка", ttl: 4800 }, options || {});
    showToast(message, "info", opts);
    markSeen(key);
    return true;
  }

  // Public reset — wipes all seen flags so hints replay next session.
  function resetOnboardingV2() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) { /* noop */ }
  }

  // Trigger points. Boot.js wires them at appropriate lifecycle moments
  // via showHintOnce calls — we expose small convenience helpers here.
  function hintAfterFirstLoad() {
    showHintOnce(
      "first-load-select",
      "Кликни по элементу на слайде, чтобы выбрать его. В левой панели видна структура.",
    );
  }

  function hintAfterFirstSelect() {
    showHintOnce(
      "first-select-dblclick",
      "Двойной клик по тексту — inline edit. Shift+клик — мульти-выбор. ? — список горячих клавиш.",
    );
  }

  function hintAfterFirstEdit() {
    showHintOnce(
      "first-edit-shortcuts",
      "Нажми ? для полного списка горячих клавиш. Ctrl+Z возвращает последнее действие.",
    );
  }

  // Convenience: fire all three "appropriate-moment" hints when there is
  // nothing better wiring them in. Called from boot.js post-init.
  function primeOnboardingV2() {
    // Defer by a frame so the first paint is done.
    window.requestAnimationFrame(function () {
      if (state.modelDoc && state.mode === "edit" && state.selectedNodeId) {
        hintAfterFirstEdit();
      } else if (state.modelDoc && state.mode === "edit") {
        hintAfterFirstSelect();
      } else if (state.modelDoc) {
        hintAfterFirstLoad();
      }
    });
  }

  window.resetOnboardingV2 = resetOnboardingV2;
  window.showHintOnce = showHintOnce;
  window.hintAfterFirstLoad = hintAfterFirstLoad;
  window.hintAfterFirstSelect = hintAfterFirstSelect;
  window.hintAfterFirstEdit = hintAfterFirstEdit;
  window.primeOnboardingV2 = primeOnboardingV2;
})();
