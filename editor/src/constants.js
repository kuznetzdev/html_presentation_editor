// constants.js
// Layer: Data & Constants
// Slide selectors, editor attribute names, storage keys, tag sets.

      /* ======================================================================
       HTML Presentation Editor — normalized shell script
       Edit map:
       [SCRIPT 01] constants + state + refs
       [SCRIPT 02] boot + shell layout + theme
       [SCRIPT 03] preview build + iframe bridge + sync
       [SCRIPT 04] selection + inspector + editing + media
       [SCRIPT 05] floating toolbar + context menu + insert palette
       [SCRIPT 06] history + autosave + export + diagnostics
       ====================================================================== */

      /* ======================================================================
       [SCRIPT 01] constants + state + refs
       ====================================================================== */
      const STATIC_SLIDE_SELECTORS = [
        ".reveal .slides > section",
        ".reveal .slides section",
        "section.slide",
        "div.slide",
        ".shower .slide",
        ".deck .slide",
        ".deck-container .slide",
        "article.slide",
        "article",
        ".slide",
      ];
      const SEMANTIC_DECK_SELECTORS = [
        '[data-doc-type="presentation"]',
        ".deck",
        ".deck-container",
        ".slides",
        "main",
      ];
      const SEMANTIC_SLIDE_TAGS = new Set(["SECTION", "ARTICLE", "DIV"]);
      const EDITOR_NODE_ID_ATTR = "data-editor-node-id";
      const EDITOR_SLIDE_ID_ATTR = "data-editor-slide-id";
      const EDITOR_ENTITY_KIND_ATTR = "data-editor-entity-kind";
      const EDITOR_EDITABLE_ATTR = "data-editor-editable";
      const EDITOR_POLICY_KIND_ATTR = "data-editor-policy-kind";
      const EDITOR_POLICY_REASON_ATTR = "data-editor-policy-reason";
      const AUTHOR_SLIDE_ID_ATTRS = ["data-slide-id"];
      const AUTHOR_NODE_ID_ATTRS = ["data-node-id"];
      const AUTHOR_NODE_KIND_ATTRS = ["data-node-type"];
      const AUTHOR_EDITABLE_ATTRS = ["data-editable"];
      const IMPORT_ENTITY_KINDS = new Set([
        "text",
        "image",
        "video",
        "container",
        "element",
        "slide-root",
        "protected",
        "table",
        "table-cell",
        "code-block",
        "svg",
        "fragment",
        "none",
      ]);

      const TEXT_TAGS = new Set([
        "H1",
        "H2",
        "H3",
        "H4",
        "H5",
        "H6",
        "P",
        "LI",
        "BLOCKQUOTE",
        "FIGCAPTION",
        "TD",
        "TH",
        "PRE",
        "CODE",
        "SMALL",
        "LABEL",
        "A",
        "SPAN",
      ]);
      const EXCLUDED_TAGS = new Set([
        "SCRIPT",
        "STYLE",
        "META",
        "LINK",
        "BASE",
        "HEAD",
        "HTML",
        "BODY",
        "NOSCRIPT",
        "TEMPLATE",
      ]);
      // Ключи localStorage / sessionStorage вынесены отдельно, чтобы поведение
      // редактора было детерминированным и легко переносимым между версиями.
      // ====================================================================
      // Константы shell-редактора
      // STORAGE_KEY / HISTORY / UI-state ключи используются только в parent window,
      // а bridge внутри iframe ничего не знает о storage редактора.
      // ====================================================================
      const STORAGE_KEY = "presentation-editor:autosave:v3";
      const HISTORY_LIMIT = 20;
      const THEME_STORAGE_KEY = "presentation-editor:theme:v1";
      const INSPECTOR_SECTIONS_KEY =
        "presentation-editor:inspector-sections:v1";
      const TOOLBAR_SESSION_KEY = "presentation-editor:toolbar-position:v1";
      const COPIED_STYLE_KEY = "presentation-editor:copied-style:v1";
      const UI_COMPLEXITY_STORAGE_KEY = "presentation-editor:ui-complexity:v1";
      // [LAYER-MODEL v2] selection mode persistence
      const SELECTION_MODE_STORAGE_KEY = "presentation-editor:selection-mode:v1";
      // [v0.18.3] preview zoom persistence
      const PREVIEW_ZOOM_STORAGE_KEY = "presentation-editor:preview-zoom:v1";
      const MAX_VISIBLE_TOASTS = 4;
      const THEME_PREFERENCES = ["system", "light", "dark"];
      const STARTER_DECKS = Object.freeze({
        basic: Object.freeze({
          key: "basic",
          href: "/tests/fixtures/playwright/basic-deck.html",
          label: "Starter Example",
          manualBasePath: "/tests/fixtures/playwright/",
        }),
      });
      const SHELL_WARNING_CACHE = new Set();
      const BRIDGE_MUTATION_TYPES = new Set([
        "apply-style",
        "apply-styles",
        "update-attributes",
        "replace-image-src",
        "reset-inline-styles",
        "delete-element",
        "duplicate-element",
        "move-element",
        "nudge-element",
        "insert-element",
        "replace-node-html",
        "replace-slide-html",
        "commit-direct-manipulation",
      ]);
      const SYNC_LOCK_WINDOW_MS = 900;
      const BRIDGE_WATCHDOG_INTERVAL_MS = 5000;
      const MODEL_SYNC_INTERVAL_MS = 7000;
      const BRIDGE_STALE_THRESHOLD_MS = 12000;
      const SLIDE_ACTIVATION_RETRY_MS = 180;
      const SLIDE_ACTIVATION_MAX_ATTEMPTS = 8;
      const DIRECT_MANIP_THRESHOLD_PX = 6;
      const DIRECT_MANIP_SNAP_PX = 8;
      const DIRECT_MANIP_MIN_SIZE_PX = 24;
      const DIRECT_MANIP_NUDGE_PX = 1;
      const DIRECT_MANIP_NUDGE_FAST_PX = 10;
      const INTERACTION_MODES = new Set([
        "preview",
        "select",
        "text-edit",
        "drag",
        "resize",
        "insert",
      ]);
      const STATIC_SLIDE_ORDER_ATTRS = [
        "data-slide",
        "data-slide-index",
        "data-seq",
        "data-index",
      ];
      const TRANSIENT_SLIDE_RUNTIME_ATTRS = [
        "data-slide",
        "data-slide-index",
        "data-seq",
        "data-index",
        "data-index-h",
        "data-index-v",
        "data-index-f",
      ];

      // =====================================================================
      // Autosave size-cap thresholds (AUDIT-D-05, WO-04)
      // AUTOSAVE_WARN_BYTES  — serialized payload above this triggers a toast
      //   warning but the write still proceeds normally.
      // AUTOSAVE_FAIL_BYTES  — serialized payload above this triggers the
      //   light-snapshot fallback: inline data-URIs > 1 KB are stripped
      //   before writing so the structural draft is preserved.
      // AUTOSAVE_LIGHT_TAG   — marker embedded in the stored payload so that
      //   tryRestoreDraftPrompt can surface a banner when a light snapshot
      //   is restored.
      const AUTOSAVE_WARN_BYTES = 3 * 1024 * 1024;  // 3 MB
      const AUTOSAVE_FAIL_BYTES = 6 * 1024 * 1024;  // 6 MB
      const AUTOSAVE_LIGHT_TAG = 'light-v1';
      // =====================================================================
      // Bridge origin allow-list (AUDIT-D-04, ADR-012 §4)
      // Under file:// protocol the browser reports event.origin === "null"
      // (the string "null", not JS null). We must accept that string.
      // Under http(s):// we restrict to the exact same origin as the shell.
      // Callers: bridge.js receive guard, bridge-script.js receive guard.
      function getAllowedBridgeOrigins() {
        if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
          return ['null'];
        }
        if (typeof window !== 'undefined' && window.location) {
          return [window.location.origin];
        }
        return ['null'];
      }
      // =====================================================================
