/**
 * bridge-schema.js — Bridge Protocol v2 Schema Registry
 *
 * Classic IIFE script — NO type="module", NO import/export.
 * Exposes: window.BRIDGE_SCHEMA
 *
 * This file is the single source of truth for all bridge message types,
 * their allowed directions, and payload validators. It is intentionally
 * inert at runtime: validators are pure functions — no DOM reads, no
 * state mutation, no side effects.
 *
 * ADR-012 §2 — Schema registry
 * PAIN-MAP P0-13 — Bridge contract tests
 *
 * Validator functions return { ok: boolean, errors: string[] }.
 * An empty errors array always accompanies ok: true.
 * A non-empty errors array always accompanies ok: false.
 *
 * maxBytes constant for replace-node-html aligns with WO-01 parseSingleRoot
 * size cap: 262144 bytes (256 KB).
 *
 * ============================================================================
 * Canonical bridge message type list (WO-13 — ~30 entries)
 * ============================================================================
 *
 * LIFECYCLE (iframe → shell)
 *   hello              — v2 version handshake (protocol:2, build, capabilities[])
 *   bridge-ready       — iframe loaded and ready
 *   bridge-heartbeat   — keep-alive pulse
 *
 * SELECTION (bidirectional)
 *   select             — request/report selection by nodeId + slideId
 *   element-selected   — full selection payload from iframe
 *   selection-geometry — bounding-rect update for selected element
 *   multi-select-add   — add nodeId to multi-selection set
 *
 * MUTATION — shell → iframe (HTML payloads sanitized by parseSingleRoot)
 *   replace-node-html  — swap element innerHTML by nodeId
 *   replace-slide-html — swap entire slide HTML by slideId
 *   insert-element     — inject new element into slide
 *   apply-style        — set one CSS property on element
 *   apply-styles       — set multiple CSS properties on element
 *   update-attributes  — set/remove DOM attributes on element
 *
 * MUTATION — shell → iframe (non-HTML)
 *   replace-image-src      — change img src + alt
 *   reset-inline-styles    — remove inline style attr
 *   delete-element         — remove element from DOM
 *   duplicate-element      — clone element in same parent
 *   move-element           — reorder element (by direction delta)
 *   nudge-element          — translate element by dx/dy
 *   begin-direct-manipulation  — start drag/resize session
 *   update-direct-manipulation — step drag/resize session
 *   commit-direct-manipulation — commit drag/resize session
 *   cancel-direct-manipulation — abort drag/resize session
 *   toggle-visibility      — flip visibility (session-only)
 *   flash-node             — momentary highlight
 *   highlight-node         — persistent ghost highlight
 *   set-selection-mode     — sync containerMode flag
 *   select-best-child-of   — keyboard nav: select preferred leaf
 *   request-slide-sync     — ask iframe to re-emit slide state
 *   navigate-table-cell    — move cursor within table
 *   table-structure-op     — insert/delete table row/col
 *   proxy-select-at-point  — pick element at viewport coords
 *   reset-click-through    — clear click-through state
 *
 * SYNC — iframe → shell
 *   element-updated    — element HTML/attrs changed in iframe
 *   slide-updated      — slide HTML changed in iframe
 *   slide-removed      — slide removed from document
 *   slide-activation   — active slide changed
 *   document-sync      — full deck metadata snapshot
 *
 * META
 *   runtime-metadata   — engine/slides/capabilities snapshot
 *   runtime-error      — iframe caught an error
 *   runtime-log        — iframe debug log line
 *   context-menu       — right-click context from iframe
 *   shortcut           — keyboard shortcut event from iframe
 *
 * ACK (v2 structured response — ADR-012 §5)
 *   ack                — acknowledgement of a mutation message
 * ============================================================================
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Constants
  // ---------------------------------------------------------------------------

  /**
   * Canonical message direction labels (ADR-012 §2).
   */
  var MESSAGE_DIRECTIONS = Object.freeze({
    SHELL_TO_IFRAME: 'shell-to-iframe',
    IFRAME_TO_SHELL: 'iframe-to-shell',
    BOTH:            'both',
  });

  /**
   * Canonical message type strings.
   * Every type handled by bridge.js / bridge-commands.js / bridge-script.js
   * must appear here. Extending the bridge requires adding exactly one entry.
   */
  var BRIDGE_MESSAGES = Object.freeze({
    // Lifecycle
    HELLO:             'hello',
    BRIDGE_READY:      'bridge-ready',
    BRIDGE_HEARTBEAT:  'bridge-heartbeat',

    // Selection
    SELECT:            'select',
    ELEMENT_SELECTED:  'element-selected',
    SELECTION_GEOMETRY:'selection-geometry',
    MULTI_SELECT_ADD:  'multi-select-add',

    // Mutation — shell → iframe (HTML payloads, sanitize:true)
    REPLACE_NODE_HTML:  'replace-node-html',
    REPLACE_SLIDE_HTML: 'replace-slide-html',
    INSERT_ELEMENT:     'insert-element',

    // Mutation — shell → iframe (style/attr)
    APPLY_STYLE:        'apply-style',
    APPLY_STYLES:       'apply-styles',
    UPDATE_ATTRIBUTES:  'update-attributes',

    // Mutation — shell → iframe (non-HTML)
    REPLACE_IMAGE_SRC:         'replace-image-src',
    RESET_INLINE_STYLES:       'reset-inline-styles',
    DELETE_ELEMENT:            'delete-element',
    DUPLICATE_ELEMENT:         'duplicate-element',
    MOVE_ELEMENT:              'move-element',
    NUDGE_ELEMENT:             'nudge-element',
    BEGIN_DIRECT_MANIPULATION:  'begin-direct-manipulation',
    UPDATE_DIRECT_MANIPULATION: 'update-direct-manipulation',
    COMMIT_DIRECT_MANIPULATION: 'commit-direct-manipulation',
    CANCEL_DIRECT_MANIPULATION: 'cancel-direct-manipulation',
    TOGGLE_VISIBILITY:         'toggle-visibility',
    FLASH_NODE:                'flash-node',
    HIGHLIGHT_NODE:            'highlight-node',
    SET_SELECTION_MODE:        'set-selection-mode',
    SELECT_BEST_CHILD_OF:      'select-best-child-of',
    REQUEST_SLIDE_SYNC:        'request-slide-sync',
    NAVIGATE_TABLE_CELL:       'navigate-table-cell',
    TABLE_STRUCTURE_OP:        'table-structure-op',
    PROXY_SELECT_AT_POINT:     'proxy-select-at-point',
    RESET_CLICK_THROUGH:       'reset-click-through',

    // Shell → iframe (mode / navigation)
    SET_MODE:            'set-mode',
    SELECT_ELEMENT:      'select-element',
    NAVIGATE_TO_SLIDE:   'navigate-to-slide',

    // Sync — iframe → shell
    ELEMENT_UPDATED:   'element-updated',
    SLIDE_UPDATED:     'slide-updated',
    SLIDE_REMOVED:     'slide-removed',
    SLIDE_ACTIVATION:  'slide-activation',
    DOCUMENT_SYNC:     'document-sync',

    // Meta
    RUNTIME_METADATA:  'runtime-metadata',
    RUNTIME_ERROR:     'runtime-error',
    RUNTIME_LOG:       'runtime-log',
    CONTEXT_MENU:      'context-menu',
    SHORTCUT:          'shortcut',
    CLICK_BLOCKED:     'click-blocked',
    HINT_SHORTCUT:     'hint-shortcut',

    // Ack (v2 structured response, ADR-012 §5)
    ACK:               'ack',
  });

  /**
   * Set of all known type strings for O(1) lookup during validation.
   */
  var KNOWN_TYPES = new Set(Object.values(BRIDGE_MESSAGES));

  /**
   * Max payload byte size for replace-node-html and replace-slide-html.
   * Must align with parseSingleRoot size guard in bridge-script.js (WO-01).
   */
  var MAX_HTML_BYTES = 262144; // 256 KB

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute UTF-8 byte length of a string without TextEncoder
   * (not universally available in legacy shell contexts).
   * Falls back to char-count if encodeURIComponent throws.
   *
   * @param {string} s
   * @returns {number}
   */
  function utf8ByteLength(s) {
    try {
      return unescape(encodeURIComponent(s)).length;
    } catch (_) {
      return s.length;
    }
  }

  /**
   * Return true if value is a non-empty string.
   * @param {unknown} v
   * @returns {boolean}
   */
  function isNonEmptyString(v) {
    return typeof v === 'string' && v.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Per-type payload validators
  // ---------------------------------------------------------------------------

  /**
   * @typedef {Object} HelloPayload
   * @property {number} protocol   - Must be the numeric value 2 (Bridge Protocol v2).
   * @property {string} build      - Short commit / version label emitted by bridge-script.
   * @property {string[]} capabilities - Array of command type strings supported.
   */

  /**
   * Validate { type: 'hello', protocol: number, build: string, capabilities: string[] }
   *
   * Sent by iframe → shell as the first handshake message before bridge-ready.
   * ADR-012 §1 version handshake — WO-12.
   *
   * protocol must be the numeric value 2 (Bridge Protocol v2).
   * Passing a string (v1 behaviour) is intentionally rejected so the shell can
   * degrade to read-only and surface the mismatch banner.
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateHello(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('hello payload must be an object');
      return { ok: false, errors: errors };
    }
    if (typeof payload.protocol !== 'number' || payload.protocol !== 2) {
      errors.push('hello.protocol must be the numeric value 2');
    }
    if (!isNonEmptyString(payload.build)) {
      errors.push('hello.build must be a non-empty string');
    }
    if (!Array.isArray(payload.capabilities)) {
      errors.push('hello.capabilities must be an array');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} SelectPayload
   * @property {string} nodeId          - Target element id.
   * @property {string} slideId         - Owning slide id.
   * @property {string} [selectionPath] - Optional CSS selector path.
   */

  /**
   * Validate { type: 'select', nodeId: string, slideId: string, selectionPath?: string }
   *
   * Bidirectional: shell sends to request selection; iframe sends to report it.
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateSelect(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('select payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('select.nodeId must be a non-empty string');
    }
    if (!isNonEmptyString(payload.slideId)) {
      errors.push('select.slideId must be a non-empty string');
    }
    // selectionPath is optional but, when present, must be a string
    if ('selectionPath' in payload && typeof payload.selectionPath !== 'string') {
      errors.push('select.selectionPath must be a string when present');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} ReplaceNodeHtmlPayload
   * @property {string} nodeId - Target element id (data-editor-node-id value).
   * @property {string} html   - HTML to replace the element with. Size <= 256 KB.
   *                            Sanitized downstream by parseSingleRoot (WO-01).
   */

  /**
   * Validate { type: 'replace-node-html', nodeId: string, html: string }
   *
   * shell → iframe.
   * html byte length must not exceed MAX_HTML_BYTES (262144).
   * Content is sanitized downstream by parseSingleRoot (WO-01); this
   * validator only enforces structural shape and size.
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateReplaceNodeHtml(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('replace-node-html payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('replace-node-html.nodeId must be a non-empty string');
    }
    if (typeof payload.html !== 'string') {
      errors.push('replace-node-html.html must be a string');
    } else {
      var byteLen = utf8ByteLength(payload.html);
      if (byteLen > MAX_HTML_BYTES) {
        errors.push(
          'replace-node-html.html exceeds max size: ' + byteLen + ' bytes (max ' + MAX_HTML_BYTES + ')'
        );
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} ReplaceSlideHtmlPayload
   * @property {string} slideId - Target slide id (data-editor-slide-id value).
   * @property {string} html    - Full slide HTML to replace with. Size <= 256 KB.
   *                             Sanitized downstream by parseSingleRoot (WO-01).
   */

  /**
   * Validate { type: 'replace-slide-html', slideId: string, html: string }
   *
   * shell → iframe. Identical shape/size constraints to replace-node-html,
   * but targets a slide by slideId rather than an element by nodeId.
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateReplaceSlideHtml(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('replace-slide-html payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.slideId)) {
      errors.push('replace-slide-html.slideId must be a non-empty string');
    }
    if (typeof payload.html !== 'string') {
      errors.push('replace-slide-html.html must be a string');
    } else {
      var byteLen = utf8ByteLength(payload.html);
      if (byteLen > MAX_HTML_BYTES) {
        errors.push(
          'replace-slide-html.html exceeds max size: ' + byteLen + ' bytes (max ' + MAX_HTML_BYTES + ')'
        );
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} InsertElementPayload
   * @property {string} slideId    - Target slide id.
   * @property {string} html       - HTML fragment to insert. Size <= 256 KB.
   * @property {string} [position] - Insert position hint: 'append' | 'prepend' | 'before' | 'after'.
   * @property {string} [refNodeId] - Reference node id for before/after positioning.
   */

  /**
   * Validate { type: 'insert-element', slideId: string, html: string, ... }
   *
   * shell → iframe. HTML is sanitized downstream by parseSingleRoot.
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateInsertElement(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('insert-element payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.slideId)) {
      errors.push('insert-element.slideId must be a non-empty string');
    }
    if (typeof payload.html !== 'string') {
      errors.push('insert-element.html must be a string');
    } else {
      var byteLen = utf8ByteLength(payload.html);
      if (byteLen > MAX_HTML_BYTES) {
        errors.push(
          'insert-element.html exceeds max size: ' + byteLen + ' bytes (max ' + MAX_HTML_BYTES + ')'
        );
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} ApplyStylePayload
   * @property {string} nodeId     - Target element id.
   * @property {string} styleName  - CSS property name.
   * @property {string} value      - CSS property value (empty string removes).
   */

  /**
   * Validate { type: 'apply-style', nodeId: string, styleName: string, value: string }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateApplyStyle(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('apply-style payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('apply-style.nodeId must be a non-empty string');
    }
    if (!isNonEmptyString(payload.styleName)) {
      errors.push('apply-style.styleName must be a non-empty string');
    }
    if (typeof payload.value !== 'string') {
      errors.push('apply-style.value must be a string');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} ApplyStylesPayload
   * @property {string} nodeId              - Target element id.
   * @property {Object.<string,string>} styles - Map of CSS property → value.
   */

  /**
   * Validate { type: 'apply-styles', nodeId: string, styles: Object }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateApplyStyles(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('apply-styles payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('apply-styles.nodeId must be a non-empty string');
    }
    if (!payload.styles || typeof payload.styles !== 'object' || Array.isArray(payload.styles)) {
      errors.push('apply-styles.styles must be a non-null object');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} UpdateAttributesPayload
   * @property {string} nodeId               - Target element id.
   * @property {Object.<string,string|null>} attrs - Attribute map: null removes attr.
   */

  /**
   * Validate { type: 'update-attributes', nodeId: string, attrs: Object }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateUpdateAttributes(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('update-attributes payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('update-attributes.nodeId must be a non-empty string');
    }
    if (!payload.attrs || typeof payload.attrs !== 'object' || Array.isArray(payload.attrs)) {
      errors.push('update-attributes.attrs must be a non-null object');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} ReplaceImageSrcPayload
   * @property {string} nodeId - Target img element id.
   * @property {string} src    - New image URL.
   * @property {string} [alt]  - New alt text.
   */

  /**
   * Validate { type: 'replace-image-src', nodeId: string, src: string }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateReplaceImageSrc(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('replace-image-src payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('replace-image-src.nodeId must be a non-empty string');
    }
    if (typeof payload.src !== 'string') {
      errors.push('replace-image-src.src must be a string');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} NodeIdPayload
   * @property {string} nodeId - Target element id. Used for: reset-inline-styles,
   *   delete-element, duplicate-element, toggle-visibility, flash-node,
   *   select-best-child-of, highlight-node.
   */

  /**
   * Validate messages that only require { nodeId: string }.
   * Used for: reset-inline-styles, delete-element, duplicate-element,
   *   toggle-visibility, flash-node, select-best-child-of, highlight-node.
   *
   * @param {string} typeName  - Message type name for error messages.
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateNodeIdOnly(typeName, payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push(typeName + ' payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push(typeName + '.nodeId must be a non-empty string');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} MoveElementPayload
   * @property {string} nodeId    - Target element id.
   * @property {number} direction - Direction delta (+1 move down, -1 move up).
   */

  /**
   * Validate { type: 'move-element', nodeId: string, direction: number }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateMoveElement(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('move-element payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('move-element.nodeId must be a non-empty string');
    }
    if (typeof payload.direction !== 'number') {
      errors.push('move-element.direction must be a number');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} NudgeElementPayload
   * @property {string} nodeId - Target element id.
   * @property {number} dx     - Horizontal delta in pixels.
   * @property {number} dy     - Vertical delta in pixels.
   */

  /**
   * Validate { type: 'nudge-element', nodeId: string, dx: number, dy: number }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateNudgeElement(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('nudge-element payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('nudge-element.nodeId must be a non-empty string');
    }
    if (typeof payload.dx !== 'number') {
      errors.push('nudge-element.dx must be a number');
    }
    if (typeof payload.dy !== 'number') {
      errors.push('nudge-element.dy must be a number');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} DirectManipulationPayload
   * @property {string} nodeId - Target element id.
   * @property {string} [kind] - Manipulation kind: 'drag' | 'resize'.
   */

  /**
   * Validate begin/update/commit/cancel-direct-manipulation messages.
   * All require { nodeId: string }.
   *
   * @param {string} typeName
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateDirectManipulation(typeName, payload) {
    return validateNodeIdOnly(typeName, payload);
  }

  /**
   * @typedef {Object} AckPayload
   * @property {number}  refSeq  - Sequence number of the message being acknowledged.
   * @property {boolean} ok      - Whether the mutation succeeded.
   * @property {Object}  [error] - Present when ok:false. { code: string, message: string }
   * @property {boolean} [stale] - True when dup/replay detected (ADR-012 §6).
   */

  /**
   * Validate { type: 'ack', refSeq: number, ok: boolean, ... }
   *
   * ADR-012 §5 — structured ack. Sent iframe → shell after any mutation.
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateAck(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('ack payload must be an object');
      return { ok: false, errors: errors };
    }
    if (typeof payload.refSeq !== 'number') {
      errors.push('ack.refSeq must be a number');
    }
    if (typeof payload.ok !== 'boolean') {
      errors.push('ack.ok must be a boolean');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} ProxySelectAtPointPayload
   * @property {number}  clientX      - Viewport X coordinate.
   * @property {number}  clientY      - Viewport Y coordinate.
   * @property {boolean} [cycleAncestors] - Whether to cycle ancestor selection.
   * @property {boolean} [deepSelect]     - Whether to deep-select into containers.
   * @property {boolean} [containerMode]  - Whether container selection mode is active.
   */

  /**
   * Validate { type: 'proxy-select-at-point', clientX: number, clientY: number }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateProxySelectAtPoint(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('proxy-select-at-point payload must be an object');
      return { ok: false, errors: errors };
    }
    if (typeof payload.clientX !== 'number') {
      errors.push('proxy-select-at-point.clientX must be a number');
    }
    if (typeof payload.clientY !== 'number') {
      errors.push('proxy-select-at-point.clientY must be a number');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} RequestSlideSyncPayload
   * @property {string} [slideId] - Slide id to sync; omit to sync current slide.
   * @property {string} [reason]  - Debug label for diagnostic log.
   */

  /**
   * Validate { type: 'request-slide-sync', slideId?: string }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateRequestSlideSync(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('request-slide-sync payload must be an object');
      return { ok: false, errors: errors };
    }
    // slideId is optional — when present must be a string
    if ('slideId' in payload && !isNonEmptyString(payload.slideId)) {
      errors.push('request-slide-sync.slideId must be a non-empty string when present');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} NavigateTableCellPayload
   * @property {string} nodeId    - Current cell element id.
   * @property {string} direction - Navigation direction: 'up'|'down'|'left'|'right'|'tab'|'shift-tab'.
   */

  /**
   * Validate { type: 'navigate-table-cell', nodeId: string, direction: string }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateNavigateTableCell(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('navigate-table-cell payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('navigate-table-cell.nodeId must be a non-empty string');
    }
    var VALID_DIRECTIONS = new Set(['up', 'down', 'left', 'right', 'tab', 'shift-tab']);
    if (!isNonEmptyString(payload.direction) || !VALID_DIRECTIONS.has(payload.direction)) {
      errors.push('navigate-table-cell.direction must be one of: up, down, left, right, tab, shift-tab');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  /**
   * @typedef {Object} TableStructureOpPayload
   * @property {string} nodeId    - Anchor cell or table element id.
   * @property {string} operation - One of: insert-row-above, insert-row-below,
   *   insert-col-left, insert-col-right, delete-row, delete-col.
   */

  /**
   * Validate { type: 'table-structure-op', nodeId: string, operation: string }
   *
   * @param {unknown} payload
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateTableStructureOp(payload) {
    var errors = [];
    if (!payload || typeof payload !== 'object') {
      errors.push('table-structure-op payload must be an object');
      return { ok: false, errors: errors };
    }
    if (!isNonEmptyString(payload.nodeId)) {
      errors.push('table-structure-op.nodeId must be a non-empty string');
    }
    var VALID_OPS = new Set([
      'insert-row-above', 'insert-row-below',
      'insert-col-left', 'insert-col-right',
      'delete-row', 'delete-col',
    ]);
    if (!isNonEmptyString(payload.operation) || !VALID_OPS.has(payload.operation)) {
      errors.push('table-structure-op.operation must be a valid table operation');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  // ---------------------------------------------------------------------------
  // Dispatch table: type string → per-type validator
  // ---------------------------------------------------------------------------

  var VALIDATORS = {};

  // Lifecycle
  VALIDATORS[BRIDGE_MESSAGES.HELLO]                      = validateHello;
  VALIDATORS[BRIDGE_MESSAGES.ACK]                        = validateAck;

  // Selection
  VALIDATORS[BRIDGE_MESSAGES.SELECT]                     = validateSelect;

  // Mutation — HTML
  VALIDATORS[BRIDGE_MESSAGES.REPLACE_NODE_HTML]          = validateReplaceNodeHtml;
  VALIDATORS[BRIDGE_MESSAGES.REPLACE_SLIDE_HTML]         = validateReplaceSlideHtml;
  VALIDATORS[BRIDGE_MESSAGES.INSERT_ELEMENT]             = validateInsertElement;

  // Mutation — style/attr
  VALIDATORS[BRIDGE_MESSAGES.APPLY_STYLE]                = validateApplyStyle;
  VALIDATORS[BRIDGE_MESSAGES.APPLY_STYLES]               = validateApplyStyles;
  VALIDATORS[BRIDGE_MESSAGES.UPDATE_ATTRIBUTES]          = validateUpdateAttributes;

  // Mutation — non-HTML single-node
  VALIDATORS[BRIDGE_MESSAGES.REPLACE_IMAGE_SRC]         = validateReplaceImageSrc;
  VALIDATORS[BRIDGE_MESSAGES.MOVE_ELEMENT]              = validateMoveElement;
  VALIDATORS[BRIDGE_MESSAGES.NUDGE_ELEMENT]             = validateNudgeElement;
  VALIDATORS[BRIDGE_MESSAGES.RESET_INLINE_STYLES]       = function(p) { return validateNodeIdOnly('reset-inline-styles', p); };
  VALIDATORS[BRIDGE_MESSAGES.DELETE_ELEMENT]            = function(p) { return validateNodeIdOnly('delete-element', p); };
  VALIDATORS[BRIDGE_MESSAGES.DUPLICATE_ELEMENT]         = function(p) { return validateNodeIdOnly('duplicate-element', p); };
  VALIDATORS[BRIDGE_MESSAGES.TOGGLE_VISIBILITY]         = function(p) { return validateNodeIdOnly('toggle-visibility', p); };
  VALIDATORS[BRIDGE_MESSAGES.FLASH_NODE]                = function(p) { return validateNodeIdOnly('flash-node', p); };
  VALIDATORS[BRIDGE_MESSAGES.SELECT_BEST_CHILD_OF]      = function(p) { return validateNodeIdOnly('select-best-child-of', p); };

  // Direct manipulation
  VALIDATORS[BRIDGE_MESSAGES.BEGIN_DIRECT_MANIPULATION]  = function(p) { return validateDirectManipulation('begin-direct-manipulation', p); };
  VALIDATORS[BRIDGE_MESSAGES.UPDATE_DIRECT_MANIPULATION] = function(p) { return validateDirectManipulation('update-direct-manipulation', p); };
  VALIDATORS[BRIDGE_MESSAGES.COMMIT_DIRECT_MANIPULATION] = function(p) { return validateDirectManipulation('commit-direct-manipulation', p); };

  // Navigation / structural
  VALIDATORS[BRIDGE_MESSAGES.PROXY_SELECT_AT_POINT]     = validateProxySelectAtPoint;
  VALIDATORS[BRIDGE_MESSAGES.REQUEST_SLIDE_SYNC]        = validateRequestSlideSync;
  VALIDATORS[BRIDGE_MESSAGES.NAVIGATE_TABLE_CELL]       = validateNavigateTableCell;
  VALIDATORS[BRIDGE_MESSAGES.TABLE_STRUCTURE_OP]        = validateTableStructureOp;

  // Types with no further payload shape constraint beyond "must be an object".
  // Listed here so the registry is complete and unknown-type detection works.
  var SCHEMA_FREE_TYPES = new Set([
    BRIDGE_MESSAGES.BRIDGE_READY,
    BRIDGE_MESSAGES.BRIDGE_HEARTBEAT,
    BRIDGE_MESSAGES.ELEMENT_SELECTED,
    BRIDGE_MESSAGES.SELECTION_GEOMETRY,
    BRIDGE_MESSAGES.MULTI_SELECT_ADD,
    BRIDGE_MESSAGES.ELEMENT_UPDATED,
    BRIDGE_MESSAGES.SLIDE_UPDATED,
    BRIDGE_MESSAGES.SLIDE_REMOVED,
    BRIDGE_MESSAGES.SLIDE_ACTIVATION,
    BRIDGE_MESSAGES.DOCUMENT_SYNC,
    BRIDGE_MESSAGES.RUNTIME_METADATA,
    BRIDGE_MESSAGES.RUNTIME_ERROR,
    BRIDGE_MESSAGES.RUNTIME_LOG,
    BRIDGE_MESSAGES.CONTEXT_MENU,
    BRIDGE_MESSAGES.SHORTCUT,
    BRIDGE_MESSAGES.CLICK_BLOCKED,
    BRIDGE_MESSAGES.HINT_SHORTCUT,
    BRIDGE_MESSAGES.HIGHLIGHT_NODE,
    BRIDGE_MESSAGES.SET_SELECTION_MODE,
    BRIDGE_MESSAGES.RESET_CLICK_THROUGH,
    BRIDGE_MESSAGES.CANCEL_DIRECT_MANIPULATION,
    BRIDGE_MESSAGES.SET_MODE,
    BRIDGE_MESSAGES.SELECT_ELEMENT,
    BRIDGE_MESSAGES.NAVIGATE_TO_SLIDE,
  ]);

  // ---------------------------------------------------------------------------
  // Top-level message validator
  // ---------------------------------------------------------------------------

  /**
   * Validate any bridge message object.
   *
   * Rules:
   *  1. msg must be a non-null object.
   *  2. msg.type must be a non-empty string.
   *  3. msg.type must be in KNOWN_TYPES.
   *  4. If a per-type validator exists, the full msg is forwarded to it
   *     (the validator inspects msg.type's sibling fields — callers may pass
   *     a flat message or wrap the payload inside; both patterns are accepted
   *     because the per-type validators read the top-level fields directly).
   *
   * @param {unknown} msg  The full bridge message envelope.
   * @returns {{ ok: boolean, errors: string[] }}
   */
  function validateMessage(msg) {
    var errors = [];

    // Rule 1: must be a non-null object
    if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) {
      errors.push('message must be a non-null object');
      return { ok: false, errors: errors };
    }

    // Rule 2: type must be a non-empty string
    if (typeof msg.type !== 'string' || msg.type.length === 0) {
      errors.push('message.type must be a non-empty string');
      return { ok: false, errors: errors };
    }

    // Rule 3: type must be known
    if (!KNOWN_TYPES.has(msg.type)) {
      errors.push('unknown message type: "' + msg.type + '"');
      return { ok: false, errors: errors };
    }

    // Rule 4: delegate to per-type validator when available.
    // Pass the full message as the "payload" argument so validators can read
    // sibling top-level fields (hello.protocol, select.nodeId, etc.).
    var validator = VALIDATORS[msg.type];
    if (validator) {
      return validator(msg);
    }

    // Schema-free type — shape is not constrained at this layer.
    return { ok: true, errors: [] };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.BRIDGE_SCHEMA = Object.freeze({
    MESSAGE_DIRECTIONS:        MESSAGE_DIRECTIONS,
    BRIDGE_MESSAGES:           BRIDGE_MESSAGES,
    MAX_HTML_BYTES:            MAX_HTML_BYTES,
    validateMessage:           validateMessage,

    // Exported individually for targeted unit testing in contract specs
    validateHello:             validateHello,
    validateSelect:            validateSelect,
    validateReplaceNodeHtml:   validateReplaceNodeHtml,
    validateReplaceSlideHtml:  validateReplaceSlideHtml,
    validateInsertElement:     validateInsertElement,
    validateApplyStyle:        validateApplyStyle,
    validateApplyStyles:       validateApplyStyles,
    validateUpdateAttributes:  validateUpdateAttributes,
    validateReplaceImageSrc:   validateReplaceImageSrc,
    validateMoveElement:       validateMoveElement,
    validateNudgeElement:      validateNudgeElement,
    validateAck:               validateAck,
    validateProxySelectAtPoint: validateProxySelectAtPoint,
    validateRequestSlideSync:  validateRequestSlideSync,
    validateNavigateTableCell: validateNavigateTableCell,
    validateTableStructureOp:  validateTableStructureOp,

    // Node-id-only validators (shared helper, exported for completeness)
    validateResetInlineStyles:  function(p) { return validateNodeIdOnly('reset-inline-styles', p); },
    validateDeleteElement:      function(p) { return validateNodeIdOnly('delete-element', p); },
    validateDuplicateElement:   function(p) { return validateNodeIdOnly('duplicate-element', p); },
    validateToggleVisibility:   function(p) { return validateNodeIdOnly('toggle-visibility', p); },
    validateFlashNode:          function(p) { return validateNodeIdOnly('flash-node', p); },
  });

})();
