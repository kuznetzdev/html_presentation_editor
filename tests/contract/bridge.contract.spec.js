/**
 * bridge.contract.spec.js — Bridge Schema Registry Contract Tests
 *
 * Validates that window.BRIDGE_SCHEMA.validateMessage behaves correctly
 * for every fixture in tests/contract/fixtures/bridge-log-samples.json.
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
 * Handoff note for WO-13 (Agent β):
 *   Extend this suite with full bridge v2 schemas — particularly:
 *   - All shell→iframe mutation types (replace-slide-html, insert-element, …)
 *   - All iframe→shell sync types (element-selected, element-updated, …)
 *   - Version mismatch / protocol negotiation flows (ADR-012 §1)
 *   - Ack round-trip shape validation (ADR-012 §5)
 *   Add additional fixture entries to bridge-log-samples.json and, if any type
 *   gains a dedicated validator, add it to VALIDATORS in bridge-schema.js and
 *   the corresponding per-type validateXxx tests here.
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

const FIXTURES_PATH = path.resolve(
  __dirname,
  'fixtures/bridge-log-samples.json',
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
    expect(bm.ACK).toBe('ack');
  });

  test('BRIDGE_SCHEMA.MAX_HTML_BYTES equals 262144', () => {
    expect(SCHEMA.MAX_HTML_BYTES).toBe(MAX_HTML_BYTES);
  });

  test('BRIDGE_SCHEMA.validateMessage is a function', () => {
    expect(typeof SCHEMA.validateMessage).toBe('function');
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
    // WO-12: protocol is now numeric 2, not a string
    const result = SCHEMA.validateMessage({
      type: 'hello',
      protocol: 2,
      build: '1',
      capabilities: [],
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Fixture corpus — iterate all entries from bridge-log-samples.json
// ---------------------------------------------------------------------------

test.describe('BRIDGE_SCHEMA.validateMessage — fixture corpus', () => {
  for (const fixture of FIXTURES) {
    // Capture fixture in closure to avoid shared-reference issues in loops.
    const f = fixture;

    test(f.id + ' — ' + f.description, () => {
      const msg = resolveDynamicMessage(f);
      const result = SCHEMA.validateMessage(msg);

      expect(result.ok).toBe(f.expected.ok);

      if (f.expected.errors && f.expected.errors.length > 0) {
        // For negative cases: every expected error substring must appear in
        // at least one actual error string.
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
        // For happy-path cases: errors array must be empty.
        expect(result.errors).toEqual([]);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Per-type validator tests — targeted unit coverage
// ---------------------------------------------------------------------------

test.describe('validateHello', () => {
  // WO-12: protocol is now numeric 2 (Bridge Protocol v2), not a string.
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
