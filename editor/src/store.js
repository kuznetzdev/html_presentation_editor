// store.js
// Layer: Data & Constants
// Observable store factory with slice-typed state, subscribe-per-slice API,
// queueMicrotask-based notification, and Object.freeze in dev.
//
// ADR-013: Observable Store — slice-typed state with subscribe-per-slice
// Zero DOM references. Zero external dependencies. Classical <script src> compatible.

// =============================================================================
// TYPEDEFS
// =============================================================================

/**
 * UI preferences slice — theme, zoom, complexity mode.
 * Migrated fields from window.state (complexityMode, previewZoom, theme, themePreference).
 *
 * ADR-017 CRDT-readiness checklist for UISlice:
 *   [x] Updates produce new objects (immutable) — store.update spreads into new obj
 *   [x] IDs are stable — slice name 'ui' is stable key
 *   [x] Operations describable as {op, path, value} patches — store.update IS a patch
 *   [x] No position-indexed array ops — no arrays in ui slice
 *   [x] No cross-slice mutable references — all primitives
 *
 * @typedef {Object} UISlice
 * @property {string} complexityMode - UI complexity: 'basic' | 'advanced'
 * @property {number} previewZoom - Preview scale factor (0.25–2.0, default 1.0)
 * @property {string} theme - Resolved active theme: 'light' | 'dark'
 * @property {string} themePreference - User preference: 'system' | 'light' | 'dark'
 */

/**
 * Selection state slice — all 16 selection fields migrated from window.state.
 * Migrated fields: activeNodeId, activeSlideId, selectionPath, leafNodeId, tag,
 * computed, html, rect, attrs, entityKind, flags, policy, liveRect,
 * manipulationContext, clickThroughState, runtimeActiveSlideId, overlapIndex.
 *
 * ADR-017 CRDT-readiness checklist for SelectionSlice:
 *   [x] Updates produce new objects (immutable) — store.update spreads into new obj
 *   [x] IDs are stable — only string IDs stored, never DOM nodes
 *   [x] Operations describable as {op, path, value} patches — store.update IS a patch
 *   [x] Array ops are position-independent — selectionPath is a value array
 *   [x] No cross-slice mutable references — no DOM nodes, only plain objects + IDs
 *
 * @typedef {Object} SelectionSlice
 * @property {string|null} activeNodeId - Currently selected node ID
 * @property {string|null} activeSlideId - Active slide ID in modelDoc
 * @property {Array<Object>} selectionPath - DOM path from root to selected node
 * @property {string|null} leafNodeId - Leaf node of the current selection path
 * @property {string|null} tag - HTML tag name of the selected element
 * @property {Object|null} computed - Computed style object for the selected element
 * @property {string} html - Outer HTML of the selected element
 * @property {Object|null} rect - Bounding rect of the selected element in iframe coordinates
 * @property {Object} attrs - Attribute map of the selected element
 * @property {string} entityKind - Entity kind (from IMPORT_ENTITY_KINDS), default 'none'
 * @property {Object} flags - SelectionFlags for the selected element
 * @property {Object} policy - SelectionPolicy edit-permission policy
 * @property {Object|null} liveRect - Live rect updated during manipulation
 * @property {Object|null} manipulationContext - Active direct-manipulation context
 * @property {Object|null} clickThroughState - Stack depth / click-through state
 * @property {string|null} runtimeActiveSlideId - Active slide ID reported by iframe
 * @property {number} overlapIndex - Overlap cycling index (0 = no cycle active)
 */

/**
 * A per-slice subscriber callback.
 * @template T
 * @callback SliceListener
 * @param {T} next - The updated slice (frozen in dev)
 * @param {T} prev - The previous slice snapshot
 * @returns {void}
 */

/**
 * Unsubscribe function returned by store.subscribe.
 * @callback Unsubscribe
 * @returns {void}
 */

/**
 * The observable store instance exposed on window.store.
 *
 * @typedef {Object} Store
 * @property {function(string): Object} get - Return current slice by name (frozen in dev)
 * @property {function(string): *} select - Return value at dot-path ('slice.key')
 * @property {function(string, Object): void} update - Patch a slice with shallow merge
 * @property {function(string, SliceListener): Unsubscribe} subscribe - Subscribe to slice or path changes
 * @property {function(function(): void): void} batch - Run multiple updates; fire one microtask
 * @property {function(string, Object): void} defineSlice - Register a new slice with initial state
 */

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create an observable store with slice-typed state.
 *
 * Constraints (ADR-013):
 *  - All mutations go through update() — direct mutation frozen in dev via Object.freeze
 *  - Mutation produces a shallow-cloned slice
 *  - Subscribers called once per batch via queueMicrotask
 *  - Zero DOM references (no document.*, no els.*)
 *  - No Redux/MobX/Zustand — hand-rolled, file:// friendly
 *
 * @param {Object} [initialSlices] - Optional map of sliceName → initial state
 * @returns {Store}
 */
function createStore(initialSlices) {
  // Internal state: slice data
  /** @type {Object.<string, Object>} */
  var _slices = {};

  // Internal state: listeners per slice or path
  // _listeners[key] = Set of { callback, path? }
  /** @type {Object.<string, Set<{cb: SliceListener, path: string|null}>>} */
  var _listeners = {};

  // Dirty tracking — which slices changed during current batch
  /** @type {Set<string>} */
  var _dirtySlices = new Set();

  // Previous snapshots of dirty slices (captured before first update in a batch)
  /** @type {Object.<string, Object>} */
  var _prevSnapshots = {};

  // Microtask flush is scheduled
  var _flushPending = false;

  // Batch depth — 0 means not in a batch
  var _batchDepth = 0;

  // Dev mode: freeze slices
  var _isDev = (function () {
    try {
      return (
        typeof window !== "undefined" &&
        typeof window.location !== "undefined" &&
        (window.location.protocol === "file:" ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1")
      );
    } catch (e) {
      return true;
    }
  })();

  /**
   * Freeze an object in dev; no-op in prod.
   * @template T
   * @param {T} obj
   * @returns {T}
   */
  function _maybeFreeze(obj) {
    if (_isDev && obj !== null && typeof obj === "object") {
      return Object.freeze(obj);
    }
    return obj;
  }

  /**
   * Register a slice with initial state. Throws if store.defineSlice is called
   * after a slice with the same name already exists (idempotent if shape equals).
   * @param {string} sliceName
   * @param {Object} initialState
   */
  function defineSlice(sliceName, initialState) {
    if (typeof sliceName !== "string" || !sliceName) {
      throw new Error("store.defineSlice: sliceName must be a non-empty string");
    }
    if (_slices[sliceName] !== undefined) {
      // Already registered — idempotent, skip silently
      return;
    }
    _slices[sliceName] = _maybeFreeze(Object.assign({}, initialState));
    _listeners[sliceName] = new Set();
  }

  /**
   * Get the current slice (frozen in dev).
   * @param {string} sliceName
   * @returns {Object}
   */
  function get(sliceName) {
    if (_slices[sliceName] === undefined) {
      throw new Error(
        'store.get: unknown slice "' + sliceName + '"'
      );
    }
    return _slices[sliceName];
  }

  /**
   * Read a value at a dot-path such as 'ui.theme' or 'ui'.
   * Returns undefined if the path doesn't exist — never throws.
   * @param {string} path - Dot-separated path (e.g. 'ui.complexityMode')
   * @returns {*}
   */
  function select(path) {
    if (typeof path !== "string") return undefined;
    var parts = path.split(".");
    var sliceName = parts[0];
    if (_slices[sliceName] === undefined) return undefined;
    if (parts.length === 1) return _slices[sliceName];
    var val = _slices[sliceName];
    for (var i = 1; i < parts.length; i++) {
      if (val === null || val === undefined) return undefined;
      val = val[parts[i]];
    }
    return val;
  }

  /**
   * Patch a slice with a shallow merge. Schedules a microtask notification.
   * @param {string} sliceName
   * @param {Object} patch
   */
  function update(sliceName, patch) {
    if (_slices[sliceName] === undefined) {
      throw new Error(
        'store.update: unknown slice "' + sliceName + '"'
      );
    }
    // Capture the previous snapshot ONLY on first update within a batch/microtask
    if (!_dirtySlices.has(sliceName)) {
      _prevSnapshots[sliceName] = _slices[sliceName];
      _dirtySlices.add(sliceName);
    }
    // Produce a new shallow-cloned slice (immutable update — ADR-017)
    var prev = _slices[sliceName];
    // Need unfrozen base — spread into plain obj
    var next = _maybeFreeze(Object.assign({}, prev, patch));
    _slices[sliceName] = next;

    // Schedule single microtask flush if not already pending and not inside batch
    if (!_flushPending && _batchDepth === 0) {
      _flushPending = true;
      queueMicrotask(_flush);
    }
  }

  /**
   * Execute fn synchronously; flush subscribers exactly once after fn returns.
   * Nested batches are safe — flush is deferred until outermost batch exits.
   * @param {function(): void} fn
   */
  function batch(fn) {
    _batchDepth++;
    try {
      fn();
    } finally {
      _batchDepth--;
      if (_batchDepth === 0 && _dirtySlices.size > 0 && !_flushPending) {
        _flushPending = true;
        queueMicrotask(_flush);
      }
    }
  }

  /**
   * Subscribe to a slice or path. Returns an unsubscribe function.
   *
   * - subscribe('ui', cb) — fires when any key in 'ui' changes
   * - subscribe('ui.theme', cb) — fires only when 'ui.theme' changes value
   *
   * @param {string} pathOrSlice - Slice name or dot-path
   * @param {SliceListener} cb - Callback(next, prev)
   * @returns {Unsubscribe}
   */
  function subscribe(pathOrSlice, cb) {
    if (typeof cb !== "function") {
      throw new Error("store.subscribe: callback must be a function");
    }
    var parts = pathOrSlice.split(".");
    var sliceName = parts[0];
    var keyPath = parts.length > 1 ? parts.slice(1).join(".") : null;

    if (_listeners[sliceName] === undefined) {
      // Slice doesn't exist yet — create a pending listener set
      _listeners[sliceName] = new Set();
    }

    var entry = { cb: cb, path: keyPath };
    _listeners[sliceName].add(entry);

    return function unsubscribe() {
      if (_listeners[sliceName]) {
        _listeners[sliceName].delete(entry);
      }
    };
  }

  /**
   * Internal flush — called via microtask.
   * Notifies all subscribers for dirty slices.
   */
  function _flush() {
    _flushPending = false;
    if (_batchDepth > 0) {
      // Still inside a nested batch — re-schedule after batch exits
      return;
    }

    // Snapshot and clear dirty set atomically
    var dirty = _dirtySlices;
    var prevSnaps = _prevSnapshots;
    _dirtySlices = new Set();
    _prevSnapshots = {};

    dirty.forEach(function (sliceName) {
      var next = _slices[sliceName];
      var prev = prevSnaps[sliceName];
      var listeners = _listeners[sliceName];
      if (!listeners) return;

      listeners.forEach(function (entry) {
        if (entry.path === null) {
          // Full slice listener
          entry.cb(next, prev);
        } else {
          // Path listener — only call if that path's value changed
          var nextVal = _getPath(next, entry.path);
          var prevVal = _getPath(prev, entry.path);
          if (nextVal !== prevVal) {
            entry.cb(nextVal, prevVal);
          }
        }
      });
    });
  }

  /**
   * Navigate a dot-path within an object.
   * @param {Object} obj
   * @param {string} dotPath - e.g. 'theme' or 'nested.key'
   * @returns {*}
   */
  function _getPath(obj, dotPath) {
    if (obj === null || obj === undefined) return undefined;
    var parts = dotPath.split(".");
    var val = obj;
    for (var i = 0; i < parts.length; i++) {
      if (val === null || val === undefined) return undefined;
      val = val[parts[i]];
    }
    return val;
  }

  // Initialize slices from constructor argument
  if (initialSlices && typeof initialSlices === "object") {
    var keys = Object.keys(initialSlices);
    for (var i = 0; i < keys.length; i++) {
      defineSlice(keys[i], initialSlices[keys[i]]);
    }
  }

  return {
    get: get,
    select: select,
    update: update,
    subscribe: subscribe,
    batch: batch,
    defineSlice: defineSlice,
  };
}

// =============================================================================
// GLOBAL SINGLETON
// =============================================================================

// Guard: must be loaded before state.js which will call window.store.defineSlice
if (typeof window !== "undefined") {
  window.store = createStore();
}

// CommonJS export for Node test runner — no-op in browser contexts.
// Allows `const { createStore } = require('./store.js')` in tests.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { createStore: createStore };
}
