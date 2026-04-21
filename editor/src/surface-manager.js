// surface-manager.js — Transient surface mutex (context-menu, layer-picker, insert-palette, etc.)
// Addresses PAIN-MAP P2-09. Extracted from feedback.js v0.29.5 per P1-09.
// Load order: must come AFTER context-menu.js + shell-overlays.js (needs closeContextMenu etc.).
// =====================================================================
if (typeof closeContextMenu !== "function") throw new Error("surface-manager.js: requires context-menu.js loaded first");

      // =====================================================================
      // ZONE: Surface Mutex
      // normalizeShellSurfaceKeep + closeTransientShellUi
      // Cut/paste verbatim from feedback.js (WO-23, zero body edits).
      // =====================================================================

      function normalizeShellSurfaceKeep(keepValue) {
        return new Set(
          Array.isArray(keepValue)
            ? keepValue.filter(Boolean)
            : keepValue
              ? [keepValue]
              : [],
        );
      }

      function closeTransientShellUi(options = {}) {
        const keep = normalizeShellSurfaceKeep(options.keep);
        if (!keep.has("context-menu")) closeContextMenu();
        if (!keep.has("layer-picker")) closeLayerPicker();
        if (!keep.has("insert-palette") && isInsertPaletteOpen()) {
          closeInsertPalette();
        }
        if (!keep.has("slide-template") && isSlideTemplateBarOpen()) {
          closeSlideTemplateBar();
        }
        if (!keep.has("topbar-overflow") && isTopbarOverflowOpen()) {
          closeTopbarOverflow();
        }
        if (!keep.has("floating-toolbar")) hideFloatingToolbar();
      }
