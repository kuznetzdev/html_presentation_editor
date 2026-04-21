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

    // Mutation — shell → iframe
    REPLACE_NODE_HTML:  'replace-node-html',
    REPLACE_SLIDE_HTML: 'replace-slide-html',
    INSERT_ELEMENT:     'insert-element',
    APPLY_STYLE:        'apply-style',
    APPLY_STYLES:       'apply-styles',
    UPDATE_ATTRIBUTES:  'update-attributes',

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
  // Per-type payload validators
  // ---------------------------------------------------------------------------

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
    if (typeof payload.build !== 'string' || payload.build.length === 0) {
      errors.push('hello.build must be a non-empty string');
    }
    if (!Array.isArray(payload.capabilities)) {
      errors.push('hello.capabilities must be an array');
    }
    return { ok: errors.length === 0, errors: errors };
  }

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
    if (typeof payload.nodeId !== 'string' || payload.nodeId.length === 0) {
      errors.push('select.nodeId must be a non-empty string');
    }
    if (typeof payload.slideId !== 'string' || payload.slideId.length === 0) {
      errors.push('select.slideId must be a non-empty string');
    }
    // selectionPath is optional but, when present, must be a string
    if ('selectionPath' in payload && typeof payload.selectionPath !== 'string') {
      errors.push('select.selectionPath must be a string when present');
    }
    return { ok: errors.length === 0, errors: errors };
  }

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
    if (typeof payload.nodeId !== 'string' || payload.nodeId.length === 0) {
      errors.push('replace-node-html.nodeId must be a non-empty string');
    }
    if (typeof payload.html !== 'string') {
      errors.push('replace-node-html.html must be a string');
    } else {
      // Byte length check: encode to UTF-8 equivalence using unescape/encodeURIComponent
      // to avoid a TextEncoder dep (not available in all legacy shell contexts).
      var byteLen;
      try {
        byteLen = unescape(encodeURIComponent(payload.html)).length;
      } catch (_e) {
        byteLen = payload.html.length; // fallback: char count
      }
      if (byteLen > MAX_HTML_BYTES) {
        errors.push(
          'replace-node-html.html exceeds max size: ' + byteLen + ' bytes (max ' + MAX_HTML_BYTES + ')'
        );
      }
    }
    return { ok: errors.length === 0, errors: errors };
  }

  // ---------------------------------------------------------------------------
  // Dispatch table: type string → per-type validator
  // ---------------------------------------------------------------------------

  var VALIDATORS = {};
  VALIDATORS[BRIDGE_MESSAGES.HELLO]            = validateHello;
  VALIDATORS[BRIDGE_MESSAGES.SELECT]           = validateSelect;
  VALIDATORS[BRIDGE_MESSAGES.REPLACE_NODE_HTML] = validateReplaceNodeHtml;

  // Types with no further payload shape constraint beyond "must be an object
  // (or null/undefined — bridge handlers already default payload to {})".
  // Listed here so the registry is complete and unknown-type detection works.
  var SCHEMA_FREE_TYPES = new Set([
    BRIDGE_MESSAGES.BRIDGE_READY,
    BRIDGE_MESSAGES.BRIDGE_HEARTBEAT,
    BRIDGE_MESSAGES.ELEMENT_SELECTED,
    BRIDGE_MESSAGES.SELECTION_GEOMETRY,
    BRIDGE_MESSAGES.MULTI_SELECT_ADD,
    BRIDGE_MESSAGES.REPLACE_SLIDE_HTML,
    BRIDGE_MESSAGES.INSERT_ELEMENT,
    BRIDGE_MESSAGES.APPLY_STYLE,
    BRIDGE_MESSAGES.APPLY_STYLES,
    BRIDGE_MESSAGES.UPDATE_ATTRIBUTES,
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
    BRIDGE_MESSAGES.ACK,
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
    MESSAGE_DIRECTIONS:   MESSAGE_DIRECTIONS,
    BRIDGE_MESSAGES:      BRIDGE_MESSAGES,
    MAX_HTML_BYTES:       MAX_HTML_BYTES,
    validateMessage:      validateMessage,
    // Exported individually for targeted unit testing in contract specs
    validateHello:        validateHello,
    validateSelect:       validateSelect,
    validateReplaceNodeHtml: validateReplaceNodeHtml,
  });

})();
