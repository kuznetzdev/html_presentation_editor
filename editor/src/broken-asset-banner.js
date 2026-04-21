// broken-asset-banner.js
// Layer: Shell UI — broken-asset recovery banner
// Classic-script (no ESM). Exposes four globals on window.
// ADR-014 Error Boundaries — Layer 1 shell surface, kind="warning"
// WO-24 / P0-04
//
// UnresolvedAssetEntry shape (confirmed by audit of boot.js:1353-1407):
//   Plain normalized URL string (e.g. "images/logo.png" or "../assets/bg.jpg").
//   Array built by: unresolved.add(normalized) where normalized = normalizeAssetPath(value).
//   state.unresolvedPreviewAssets = Array.from(unresolved).slice(0, 24)  (max 24 entries)
//
// String(entry.url || entry) guard is used throughout this module to
// safely handle any future shape change to {url, kind} without crashing.

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Russian plural helper: "файл" / "файла" / "файлов"
  // ---------------------------------------------------------------------------
  function pluralFiles(n) {
    var mod10 = n % 10;
    var mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return "файлов";
    if (mod10 === 1) return "файл";
    if (mod10 >= 2 && mod10 <= 4) return "файла";
    return "файлов";
  }

  // ---------------------------------------------------------------------------
  // DOM element accessors — resolved lazily so they survive script ordering
  // ---------------------------------------------------------------------------
  function getBanner() {
    return document.getElementById("brokenAssetBanner");
  }
  function getBannerTitle() {
    return document.getElementById("brokenAssetBannerTitle");
  }
  function getBannerList() {
    return document.getElementById("brokenAssetBannerList");
  }
  function getBannerDismissBtn() {
    return document.getElementById("brokenAssetBannerDismissBtn");
  }
  function getBannerActionBtn() {
    return document.getElementById("brokenAssetBannerActionBtn");
  }

  // ---------------------------------------------------------------------------
  // window.updateBrokenAssetBanner()
  // Idempotent render pass. Hides when dismissed or zero unresolved assets;
  // shows + renders count / list otherwise.
  // ---------------------------------------------------------------------------
  window.updateBrokenAssetBanner = function updateBrokenAssetBanner() {
    var banner = getBanner();
    if (!banner) return;

    // state is a top-level const in state.js. It does NOT appear on window directly
    // (const declarations are not window properties). Use window.stateProxy (the
    // Proxy shim exposed by state.js) for reliable cross-script access.
    // For unresolvedPreviewAssets, the proxy passes through to the raw state object,
    // so reads are equivalent to accessing the raw state.
    var _state = window.stateProxy || null;
    var assets =
      _state && Array.isArray(_state.unresolvedPreviewAssets)
        ? _state.unresolvedPreviewAssets
        : [];
    var count = assets.length;

    if (count === 0 || (_state && _state.brokenAssetBannerDismissed)) {
      banner.hidden = true;
      banner.setAttribute("aria-hidden", "true");
      return;
    }

    // --- Build title ---
    var titleEl = getBannerTitle();
    if (titleEl) {
      titleEl.textContent =
        "Не загружено " + count + "\u00a0" + pluralFiles(count);
    }

    // --- Build list (cap at 5, add "… и ещё N" fallback) ---
    var listEl = getBannerList();
    if (listEl) {
      listEl.innerHTML = "";
      var SAMPLE_LIMIT = 5;
      var shown = assets.slice(0, SAMPLE_LIMIT);
      var overflow = count - shown.length;

      shown.forEach(function (entry) {
        var li = document.createElement("li");
        // Guard: entry may be plain string or {url, kind} in the future
        li.textContent = String(entry && entry.url ? entry.url : entry);
        listEl.appendChild(li);
      });

      if (overflow > 0) {
        var moreLi = document.createElement("li");
        moreLi.className = "broken-asset-more";
        moreLi.textContent =
          "\u2026 \u0438 \u0435\u0449\u0451 " + overflow;
        listEl.appendChild(moreLi);
      }
    }

    // --- Show banner ---
    banner.hidden = false;
    banner.setAttribute("aria-hidden", "false");
  };

  // ---------------------------------------------------------------------------
  // window.dismissBrokenAssetBanner()
  // Sets state.brokenAssetBannerDismissed = true; hides the banner for the
  // current session (reset on next loadHtmlString via resetBrokenAssetBannerDismissal).
  // ---------------------------------------------------------------------------
  window.dismissBrokenAssetBanner = function dismissBrokenAssetBanner() {
    if (window.stateProxy) {
      window.stateProxy.brokenAssetBannerDismissed = true;
    }
    var banner = getBanner();
    if (banner) {
      banner.hidden = true;
      banner.setAttribute("aria-hidden", "true");
    }
  };

  // ---------------------------------------------------------------------------
  // window.resetBrokenAssetBannerDismissal()
  // Clears the dismissed flag. Called from export.js when unresolvedPreviewAssets
  // is reset to [] (new file load / clean export). Caller should then invoke
  // window.updateBrokenAssetBanner?.() to re-render.
  // ---------------------------------------------------------------------------
  window.resetBrokenAssetBannerDismissal = function resetBrokenAssetBannerDismissal() {
    if (window.stateProxy) {
      window.stateProxy.brokenAssetBannerDismissed = false;
    }
  };

  // ---------------------------------------------------------------------------
  // window.bindBrokenAssetBanner()
  // Wires dismiss button and action button. Called once from init() in boot.js.
  // Action button opens the same assets-picker flow as previewAssistActionBtn.
  // ---------------------------------------------------------------------------
  window.bindBrokenAssetBanner = function bindBrokenAssetBanner() {
    var dismissBtn = getBannerDismissBtn();
    if (dismissBtn) {
      dismissBtn.addEventListener("click", function () {
        window.dismissBrokenAssetBanner();
      });
    }

    var actionBtn = getBannerActionBtn();
    if (actionBtn) {
      actionBtn.addEventListener("click", function () {
        // Invoke the same "assets" picker flow as previewAssistActionBtn.
        // openOpenHtmlModal is a shell global defined in boot.js.
        if (typeof window.openOpenHtmlModal === "function") {
          window.openOpenHtmlModal({ focusTarget: "assets" });
        }
      });
    }
  };

}());
