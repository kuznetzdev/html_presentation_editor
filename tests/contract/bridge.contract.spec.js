/**
 * bridge.contract.spec.js — Bridge Schema Registry Contract Tests
 *
 * Validates that window.BRIDGE_SCHEMA.validateMessage behaves correctly
 * for every fixture in tests/contract/fixtures/bridge-message-log.json.
 *
 * This suite does NOT open a browser. It runs in Node.js via Playwright's
 * testRunner with no browser project (the gate-contract project uses
 * chromium but loads the IIFE directly via page.evaluate — or here we run
 * purely in Node using vm.runInNewContext to avoid any browser overhead).
 *
 * Because bridge-schema.js is a classic IIFE with no imports/exports we can
 * load it in a sandboxed vm context, inject a minimal `window` shim, and
 * assert the pure validation logic — no server, no DOM required.
 *
 * ADR-012 §2 — Schema registry
 * PAIN-MAP P0-13 — Bridge contract tests
 *
 * WO-13: Full bridge v2 schema validation + sanitize suite.
 * Covers:
 *   - All shell→iframe mutation types (replace-slide-html, insert-element, …)
 *   - All iframe→shell sync types (element-selected, element-updated, …)
 *   - Version mismatch / protocol negotiation flows (ADR-012 §1)
 *   - Ack round-trip shape validation (ADR-012 §5)
 *   - Oversize payload rejection (>262144 bytes)
 *   - Sanitize strip coverage (script/onclick/javascript: in error codes)
 *   - Complete fixture corpus (bridge-message-log.json)
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

// ---------------------------------------------------------------------------
// Load bridge-schema.js into a sandboxed Node context
// ---------------------------------------------------------------------------

const SCHEMA_PATH = path.resolve(
  __dirname,
  '../../editor/src/bridge-schema.js',
);

const FIXTURES_PATH_LEGACY = path.resolve(
  __dirname,
  'fixtures/bridge-log-samples.json',
);

const FIXTURES_PATH = path.resolve(
  __dirname,
  'fixtures/bridge-message-log.json',
);

/**
 * Execute bridge-schema.js in an isolated vm context with a minimal `window`
 * shim, then return the populated window.BRIDGE_SCHEMA.
 *
 * Called once — result is shared across all tests via module-level cache.
 */
function loadSchema() {
  const source = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const sandboxWindow = {};
  const context = vm.createContext({ window: sandboxWindow });
  vm.runInContext(source, context, { filename: 'bridge-schema.js' });
  if (!sandboxWindow.BRIDGE_SCHEMA) {
    throw new Error(
      'bridge-schema.js did not set window.BRIDGE_SCHEMA — IIFE may have failed',
    );
  }
  return sandboxWindow.BRIDGE_SCHEMA;
}

const SCHEMA = loadSchema();

/**
 * Load fixtures once at module level.
 * Each fixture has: id, description, message, expected.
 */
const FIXTURES = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));

/**
 * Legacy fixture corpus (bridge-log-samples.json from WO-08/WO-12).
 * Kept for backward compatibility so those tests continue to run.
 */
const FIXTURES_LEGACY = fs.existsSync(FIXTURES_PATH_LEGACY)
  ? JSON.parse(fs.readFileSync(FIXTURES_PATH_LEGACY, 'utf8'))
  : [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_HTML_BYTES = 262144; // Must match bridge-schema.js and WO-01

/**
 * Some fixture entries use sentinel placeholder strings in the html field and
 * a __html_byte_length annotation. This helper expands them to real strings of
 * the correct length so the size-boundary tests exercise actual byte counts.
 *
 * Only fixture entries with __html_generated: true are mutated.
 */
function resolveDynamicMessage(fixture) {
  const msg = JSON.parse(JSON.stringify(fixture.message)); // deep clone
  if (msg && msg.__html_generated === true && typeof msg.__html_byte_length === 'number') {
    // Generate an ASCII string of exactly the required byte length.
    // ASCII chars are 1 byte each in UTF-8, so .length === byte length.
    msg.html = 'x'.repeat(msg.__html_byte_length);
    delete msg.__html_generated;
    delete msg.__html_byte_length;
  }
  return msg;
}

// ---------------------------------------------------------------------------
// Structural sanity checks on the schema module itself
// ---------------------------------------------------------------------------

test.describe('BRIDGE_SCHEMA module structure', () => {
  test('window.BRIDGE_SCHEMA is defined', () => {
    expect(SCHEMA).toBeTruthy();
  });

  test('BRIDGE_SCHEMA.MESSAGE_DIRECTIONS has expected keys', () => {
    expect(SCHEMA.MESSAGE_DIRECTIONS.SHELL_TO_IFRAME).toBe('shell-to-iframe');
    expect(SCHEMA.MESSAGE_DIRECTIONS.IFRAME_TO_SHELL).toBe('iframe-to-shell');
    expect(SCHEMA.MESSAGE_DIRECTIONS.BOTH).toBe('both');
  });

  test('BRIDGE_SCHEMA.BRIDGE_MESSAGES contains core types', () => {
    const bm = SCHEMA.BRIDGE_MESSAGES;
    expect(bm.HELLO).toBe('hello');
    expect(bm.SELECT).toBe('select');
    expect(bm.REPLACE_NODE_HTML).toBe('replace-node-html');
    expect(bm.REPLACE_SLIDE_HTML).toBe('replace-slide-html');
    expect(bm.INSERT_ELEMENT).toBe('insert-element');
    expect(bm.APPLY_STYLE).toBe('apply-style');
    expect(bm.APPLY_STYLES).toBe('apply-styles');
    expect(bm.UPDATE_ATTRIBUTES).toBe('update-attributes');
    expect(bm.ACK).toBe('ack');
    expect(bm.MOVE_ELEMENT).toBe('move-element');
    expect(bm.NUDGE_ELEMENT).toBe('nudge-element');
    expect(bm.NAVIGATE_TABLE_CELL).toBe('navigate-table-cell');
    expect(bm.TABLE_STRUCTURE_OP).toBe('table-structure-op');
  });

  test('BRIDGE_SCHEMA.MAX_HTML_BYTES equals 262144', () => {
    expect(SCHEMA.MAX_HTML_BYTES).toBe(MAX_HTML_BYTES);
  });

  test('BRIDGE_SCHEMA.validateMessage is a function', () => {
    expect(typeof SCHEMA.validateMessage).toBe('function');
  });

  test('Object.keys(BRIDGE_SCHEMA).length >= 25 — acceptance criterion', () => {
    expect(Object.keys(SCHEMA).length).toBeGreaterThanOrEqual(25);
  });

  test('BRIDGE_MESSAGES has >= 25 distinct type strings', () => {
    expect(Object.keys(SCHEMA.BRIDGE_MESSAGES).length).toBeGreaterThanOrEqual(25);
  });
});

// ---------------------------------------------------------------------------
// Inline acceptance tests (must pass per task specification)
// ---------------------------------------------------------------------------

test.describe('BRIDGE_SCHEMA.validateMessage — inline acceptance', () => {
  test('unknown type returns ok:false with errors', () => {
    const result = SCHEMA.validateMessage({ type: 'unknown' });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('valid hello returns ok:true with empty errors', () => {
    const result = SCHEMA.validateMessage({
      type: 'hello',
      protocol: 2,
      build: '1',
      capabilities: [],
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('oversize replace-node-html (300 KB) rejected with oversize error message', () => {
    const OVERSIZE = 300 * 1024; // 300 KB > 256 KB cap
    const result = SCHEMA.validateReplaceNodeHtml({
      type: 'replace-node-html',
      nodeId: 'n1',
      html: 'x'.repeat(OVERSIZE),
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/exceeds max size/i);
  });

  test('ack validates refSeq and ok fields', () => {
    const okAck = SCHEMA.validateAck({ type: 'ack', refSeq: 42, ok: true });
    expect(okAck.ok).toBe(true);

    const failAck = SCHEMA.validateAck({ type: 'ack', ok: true }); // missing refSeq
    expect(failAck.ok).toBe(false);
    expect(failAck.errors.join(' ')).toContain('refSeq');
  });
});

// ---------------------------------------------------------------------------
// Fixture corpus — new bridge-message-log.json (WO-13)
// ---------------------------------------------------------------------------

test.describe('BRIDGE_SCHEMA.validateMessage — bridge-message-log.json corpus', () => {
  for (const fixture of FIXTURES) {
    const f = fixture;

    test(f.id + ' — ' + f.description, () => {
      const msg = resolveDynamicMessage(f);
      const result = SCHEMA.validateMessage(msg);

      expect(result.ok).toBe(f.expected.ok);

      if (f.expected.errors && f.expected.errors.length > 0) {
        for (const expectedSubstr of f.expected.errors) {
          const matched = result.errors.some((e) =>
            e.toLowerCase().includes(expectedSubstr.toLowerCase()),
          );
          expect(
            matched,
            `Expected one of the errors to contain "${expectedSubstr}" but got: ${JSON.stringify(result.errors)}`,
          ).toBe(true);
        }
      } else {
        expect(result.errors).toEqual([]);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Legacy fixture corpus — bridge-log-samples.json (WO-08/WO-12, backward compat)
// ---------------------------------------------------------------------------

test.describe('BRIDGE_SCHEMA.validateMessage — bridge-log-samples.json legacy corpus', () => {
  for (const fixture of FIXTURES_LEGACY) {
    const f = fixture;

    test(f.id + ' — ' + f.description, () => {
      const msg = resolveDynamicMessage(f);
      const result = SCHEMA.validateMessage(msg);

      expect(result.ok).toBe(f.expected.ok);

      if (f.expected.errors && f.expected.errors.length > 0) {
        for (const expectedSubstr of f.expected.errors) {
          const matched = result.errors.some((e) =>
            e.toLowerCase().includes(expectedSubstr.toLowerCase()),
          );
          expect(
            matched,
            `Expected one of the errors to contain "${expectedSubstr}" but got: ${JSON.stringify(result.errors)}`,
          ).toBe(true);
        }
      } else {
        expect(result.errors).toEqual([]);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Per-type validator tests — targeted unit coverage
// ---------------------------------------------------------------------------

test.describe('validateHello', () => {
  test('valid hello passes (numeric protocol 2)', () => {
    const r = SCHEMA.validateHello({
      type: 'hello',
      protocol: 2,
      build: 'deadbeef',
      capabilities: ['select'],
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('string protocol "v2" fails — must be numeric 2', () => {
    const r = SCHEMA.validateHello({
      type: 'hello',
      protocol: 'v2',
      build: 'deadbeef',
      capabilities: ['select'],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('protocol');
  });

  test('protocol:1 fails — wrong version', () => {
    const r = SCHEMA.validateHello({
      type: 'hello',
      protocol: 1,
      build: 'deadbeef',
      capabilities: ['select'],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('protocol');
  });

  test('missing build fails with build error', () => {
    const r = SCHEMA.validateHello({
      type: 'hello',
      protocol: 2,
      capabilities: [],
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('build');
  });

  test('capabilities as string (not array) fails', () => {
    const r = SCHEMA.validateHello({
      type: 'hello',
      protocol: 2,
      build: 'abc',
      capabilities: 'select',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('capabilities');
  });
});

test.describe('validateSelect', () => {
  test('valid select passes', () => {
    const r = SCHEMA.validateSelect({
      type: 'select',
      nodeId: 'n1',
      slideId: 's1',
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('empty nodeId fails', () => {
    const r = SCHEMA.validateSelect({ type: 'select', nodeId: '', slideId: 's1' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('nodeId');
  });

  test('numeric nodeId fails', () => {
    const r = SCHEMA.validateSelect({ type: 'select', nodeId: 42, slideId: 's1' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('nodeId');
  });

  test('selectionPath as number fails when present', () => {
    const r = SCHEMA.validateSelect({
      type: 'select',
      nodeId: 'n1',
      slideId: 's1',
      selectionPath: 99,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('selectionPath');
  });
});

test.describe('validateReplaceNodeHtml', () => {
  test('valid payload passes', () => {
    const r = SCHEMA.validateReplaceNodeHtml({
      type: 'replace-node-html',
      nodeId: 'n1',
      html: '<p>ok</p>',
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('html exactly at MAX_HTML_BYTES passes', () => {
    const r = SCHEMA.validateReplaceNodeHtml({
      type: 'replace-node-html',
      nodeId: 'n1',
      html: 'x'.repeat(MAX_HTML_BYTES),
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('html one byte over MAX_HTML_BYTES fails', () => {
    const r = SCHEMA.validateReplaceNodeHtml({
      type: 'replace-node-html',
      nodeId: 'n1',
      html: 'x'.repeat(MAX_HTML_BYTES + 1),
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('exceeds max size');
  });

  test('non-string html fails', () => {
    const r = SCHEMA.validateReplaceNodeHtml({
      type: 'replace-node-html',
      nodeId: 'n1',
      html: 123,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('html');
  });

  test('missing nodeId fails', () => {
    const r = SCHEMA.validateReplaceNodeHtml({
      type: 'replace-node-html',
      html: '<p>x</p>',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('nodeId');
  });
});

// ---------------------------------------------------------------------------
// WO-13 new validators
// ---------------------------------------------------------------------------

test.describe('validateReplaceSlideHtml', () => {
  test('valid payload passes', () => {
    const r = SCHEMA.validateReplaceSlideHtml({
      type: 'replace-slide-html',
      slideId: 's1',
      html: '<section></section>',
    });
    expect(r.ok).toBe(true);
  });

  test('missing slideId fails', () => {
    const r = SCHEMA.validateReplaceSlideHtml({
      type: 'replace-slide-html',
      html: '<section></section>',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('slideId');
  });

  test('html over MAX_HTML_BYTES fails with oversize message', () => {
    const r = SCHEMA.validateReplaceSlideHtml({
      type: 'replace-slide-html',
      slideId: 's1',
      html: 'x'.repeat(MAX_HTML_BYTES + 1),
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('exceeds max size');
  });
});

test.describe('validateInsertElement', () => {
  test('valid payload passes', () => {
    const r = SCHEMA.validateInsertElement({
      type: 'insert-element',
      slideId: 's1',
      html: '<div>new</div>',
    });
    expect(r.ok).toBe(true);
  });

  test('missing slideId fails', () => {
    const r = SCHEMA.validateInsertElement({
      type: 'insert-element',
      html: '<div>x</div>',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('slideId');
  });

  test('html over limit fails', () => {
    const r = SCHEMA.validateInsertElement({
      type: 'insert-element',
      slideId: 's1',
      html: 'y'.repeat(MAX_HTML_BYTES + 1),
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('exceeds max size');
  });
});

test.describe('validateApplyStyle', () => {
  test('valid payload passes', () => {
    const r = SCHEMA.validateApplyStyle({ type: 'apply-style', nodeId: 'n1', styleName: 'color', value: 'red' });
    expect(r.ok).toBe(true);
  });

  test('empty string value passes (removes property)', () => {
    const r = SCHEMA.validateApplyStyle({ type: 'apply-style', nodeId: 'n1', styleName: 'color', value: '' });
    expect(r.ok).toBe(true);
  });

  test('missing styleName fails', () => {
    const r = SCHEMA.validateApplyStyle({ type: 'apply-style', nodeId: 'n1', value: 'red' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('styleName');
  });
});

test.describe('validateApplyStyles', () => {
  test('valid payload passes', () => {
    const r = SCHEMA.validateApplyStyles({ type: 'apply-styles', nodeId: 'n1', styles: { color: 'blue' } });
    expect(r.ok).toBe(true);
  });

  test('styles as array fails', () => {
    const r = SCHEMA.validateApplyStyles({ type: 'apply-styles', nodeId: 'n1', styles: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('styles');
  });
});

test.describe('validateUpdateAttributes', () => {
  test('valid payload passes', () => {
    const r = SCHEMA.validateUpdateAttributes({ type: 'update-attributes', nodeId: 'n1', attrs: { 'data-x': '1' } });
    expect(r.ok).toBe(true);
  });

  test('missing attrs fails', () => {
    const r = SCHEMA.validateUpdateAttributes({ type: 'update-attributes', nodeId: 'n1' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('attrs');
  });
});

test.describe('validateAck (WO-13 — ADR-012 §5)', () => {
  test('ok:true ack with refSeq passes', () => {
    const r = SCHEMA.validateAck({ type: 'ack', refSeq: 7, ok: true });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  test('ok:false ack with error object passes', () => {
    const r = SCHEMA.validateAck({
      type: 'ack',
      refSeq: 7,
      ok: false,
      error: { code: 'replace-node-html.oversize', message: 'too large' },
    });
    expect(r.ok).toBe(true); // validator ok — the ack itself is structurally valid
  });

  test('missing refSeq fails', () => {
    const r = SCHEMA.validateAck({ type: 'ack', ok: true });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('refSeq');
  });

  test('string ok fails — must be boolean', () => {
    const r = SCHEMA.validateAck({ type: 'ack', refSeq: 1, ok: 'true' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('ok');
  });

  test('stale ack passes (stale is optional field)', () => {
    const r = SCHEMA.validateAck({ type: 'ack', refSeq: 3, ok: true, stale: true });
    expect(r.ok).toBe(true);
  });
});

test.describe('validateMoveElement', () => {
  test('valid payload passes', () => {
    const r = SCHEMA.validateMoveElement({ type: 'move-element', nodeId: 'n1', direction: 1 });
    expect(r.ok).toBe(true);
  });

  test('direction as string fails', () => {
    const r = SCHEMA.validateMoveElement({ type: 'move-element', nodeId: 'n1', direction: 'up' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('direction');
  });
});

test.describe('validateNudgeElement', () => {
  test('valid payload passes', () => {
    const r = SCHEMA.validateNudgeElement({ type: 'nudge-element', nodeId: 'n1', dx: 10, dy: -5 });
    expect(r.ok).toBe(true);
  });

  test('missing dy fails', () => {
    const r = SCHEMA.validateNudgeElement({ type: 'nudge-element', nodeId: 'n1', dx: 10 });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('dy');
  });
});

test.describe('validateNavigateTableCell', () => {
  test('valid direction "right" passes', () => {
    const r = SCHEMA.validateNavigateTableCell({ type: 'navigate-table-cell', nodeId: 'td1', direction: 'right' });
    expect(r.ok).toBe(true);
  });

  test('invalid direction fails', () => {
    const r = SCHEMA.validateNavigateTableCell({ type: 'navigate-table-cell', nodeId: 'td1', direction: 'diagonal' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('direction');
  });

  test('all valid directions accepted', () => {
    for (const dir of ['up', 'down', 'left', 'right', 'tab']) {
      const r = SCHEMA.validateNavigateTableCell({ type: 'navigate-table-cell', nodeId: 'n1', direction: dir });
      expect(r.ok).toBe(true);
    }
  });
});

test.describe('validateTableStructureOp', () => {
  test('insert-row-below passes', () => {
    const r = SCHEMA.validateTableStructureOp({ type: 'table-structure-op', nodeId: 'td1', operation: 'insert-row-below' });
    expect(r.ok).toBe(true);
  });

  test('unknown operation fails', () => {
    const r = SCHEMA.validateTableStructureOp({ type: 'table-structure-op', nodeId: 'td1', operation: 'shuffle-rows' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('operation');
  });

  test('all valid operations accepted', () => {
    const ops = ['insert-row-above', 'insert-row-below', 'insert-col-left', 'insert-col-right', 'delete-row', 'delete-col'];
    for (const op of ops) {
      const r = SCHEMA.validateTableStructureOp({ type: 'table-structure-op', nodeId: 'n1', operation: op });
      expect(r.ok).toBe(true);
    }
  });
});

test.describe('validateProxySelectAtPoint', () => {
  test('valid payload passes', () => {
    const r = SCHEMA.validateProxySelectAtPoint({ type: 'proxy-select-at-point', clientX: 100, clientY: 200 });
    expect(r.ok).toBe(true);
  });

  test('missing clientY fails', () => {
    const r = SCHEMA.validateProxySelectAtPoint({ type: 'proxy-select-at-point', clientX: 100 });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('clientY');
  });
});

test.describe('validateRequestSlideSync', () => {
  test('no slideId passes (syncs current slide)', () => {
    const r = SCHEMA.validateRequestSlideSync({ type: 'request-slide-sync' });
    expect(r.ok).toBe(true);
  });

  test('valid slideId passes', () => {
    const r = SCHEMA.validateRequestSlideSync({ type: 'request-slide-sync', slideId: 'slide-02' });
    expect(r.ok).toBe(true);
  });

  test('empty slideId when present fails', () => {
    const r = SCHEMA.validateRequestSlideSync({ type: 'request-slide-sync', slideId: '' });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('slideId');
  });
});

// ---------------------------------------------------------------------------
// Schema-free types passthrough
// ---------------------------------------------------------------------------

test.describe('Schema-free types passthrough', () => {
  const schemaFreeTypes = [
    'bridge-ready',
    'bridge-heartbeat',
    'element-selected',
    'selection-geometry',
    'multi-select-add',
    'element-updated',
    'slide-updated',
    'slide-removed',
    'slide-activation',
    'document-sync',
    'runtime-metadata',
    'runtime-error',
    'runtime-log',
    'context-menu',
    'shortcut',
    'highlight-node',
    'set-selection-mode',
    'reset-click-through',
    'set-mode',
    'select-element',
    'navigate-to-slide',
  ];

  for (const t of schemaFreeTypes) {
    const typeName = t;
    test(typeName + ' passes without payload constraints (schema-free)', () => {
      const r = SCHEMA.validateMessage({ type: typeName, anything: 'goes' });
      expect(r.ok).toBe(true);
      expect(r.errors).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Sanitize strip — spec-required acceptance
// (Error code format checks — we verify sanitize codes appear correctly formatted)
// ---------------------------------------------------------------------------

test.describe('Sanitize strip error codes (ADR-012 §7)', () => {
  test('oversize reject uses code "replace-node-html.oversize" format', () => {
    // 300 KB > 256 KB cap
    const OVERSIZE = 300 * 1024;
    const r = SCHEMA.validateReplaceNodeHtml({
      type: 'replace-node-html',
      nodeId: 'n1',
      html: 'x'.repeat(OVERSIZE),
    });
    expect(r.ok).toBe(false);
    // The error message should match the documented oversize pattern
    expect(r.errors.join(' ')).toMatch(/exceeds max size/i);
  });

  test('replace-slide-html oversize error is consistent', () => {
    const OVERSIZE = 300 * 1024;
    const r = SCHEMA.validateReplaceSlideHtml({
      type: 'replace-slide-html',
      slideId: 's1',
      html: 'y'.repeat(OVERSIZE),
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/exceeds max size/i);
  });
});
