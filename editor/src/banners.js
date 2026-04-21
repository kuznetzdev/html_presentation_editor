// banners.js — Banner registry: unified API for shell-level banners.
// v0.29.5 (WO-23): scaffold only. Existing banners in inspector-sync.js stay there for v1.0.
// WO-07 Trust Banner already wired via shellBoundary (separate mechanism).
// Load order: must come AFTER history.js (needs reportShellWarning) and store.js (needs window.store).
// =====================================================================
if (typeof window.store === "undefined" || typeof window.store.get !== "function") {
  throw new Error("banners.js requires store.js loaded first");
}

      // =====================================================================
      // ZONE: Banner Registry
      // =====================================================================

      /**
       * Registry mapping banner id → spec.
       * @type {Object.<string, BannerSpec>}
       */
      var BANNER_REGISTRY = Object.create(null);

      /**
       * @typedef {Object} BannerSpec
       * @property {function(payload: *): void} render - Called when the banner is shown.
       * @property {function(): void} [hide] - Optional cleanup called when banner is hidden.
       * @property {string} [description] - Human-readable label (for debugging).
       */

      /**
       * Register a banner spec under the given id.
       * Throws if spec is missing a render function.
       * @param {string} id
       * @param {BannerSpec} spec
       */
      function registerBanner(id, spec) {
        if (typeof spec !== "object" || spec === null || typeof spec.render !== "function") {
          throw new Error(
            "banners.js: registerBanner('" + id + "') — spec.render must be a function."
          );
        }
        BANNER_REGISTRY[id] = spec;
      }

      /**
       * Show a registered banner, updating store.ui.activeBanners.
       * Unknown id: calls reportShellWarning if available, does NOT throw.
       * Duplicate show: replaces existing entry (no duplicate in activeBanners).
       * @param {string} id
       * @param {*} [payload]
       */
      function showBanner(id, payload) {
        var spec = BANNER_REGISTRY[id];
        if (!spec) {
          if (typeof reportShellWarning === "function") {
            reportShellWarning("showBanner: unknown banner id '" + id + "'");
          }
          return;
        }
        try {
          spec.render(payload);
        } catch (err) {
          if (typeof reportShellWarning === "function") {
            reportShellWarning("showBanner: render error for '" + id + "': " + (err && err.message));
          }
        }
        // Update store: replace existing entry or push new
        var current = window.store.get("ui").activeBanners || [];
        var next = current.filter(function (entry) { return entry.id !== id; });
        next.push({ id: id, payload: payload });
        window.store.update("ui", { activeBanners: next });
      }

      /**
       * Hide a registered banner, removing it from store.ui.activeBanners.
       * @param {string} id
       */
      function hideBanner(id) {
        var spec = BANNER_REGISTRY[id];
        if (spec && typeof spec.hide === "function") {
          try {
            spec.hide();
          } catch (err) {
            if (typeof reportShellWarning === "function") {
              reportShellWarning("hideBanner: hide error for '" + id + "': " + (err && err.message));
            }
          }
        }
        var current = window.store.get("ui").activeBanners || [];
        var next = current.filter(function (entry) { return entry.id !== id; });
        window.store.update("ui", { activeBanners: next });
      }

      /**
       * Return a copy of the current activeBanners list.
       * @returns {Array<{id: string, payload: *}>}
       */
      function getActiveBanners() {
        return (window.store.get("ui").activeBanners || []).slice();
      }
