/**
 * tests/unit/banners.spec.js
 *
 * Unit tests for editor/src/banners.js.
 * Run: npm run test:unit
 *
 * 6 cases:
 *  (a) registerBanner('trust', {render:fn}) stores spec
 *  (b) showBanner('trust', {x:1}) calls render + pushes to store.ui.activeBanners
 *  (c) hideBanner('trust') removes from active list
 *  (d) showBanner('unknown') does NOT throw — calls reportShellWarning stub
 *  (e) showBanner('a') twice replaces existing entry (no duplicate)
 *  (f) registerBanner('a', {}) throws (missing render)
 *
 * WO-23 — PAIN-MAP P2-09. Scaffold only (v0.29.5).
 */
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const path     = require('node:path');
const fs       = require('node:fs');
const vm       = require('node:vm');

// ─────────────────────────────────────────────────────────────────────────────
// Store harness — load store.js to provide a real window.store.
// ─────────────────────────────────────────────────────────────────────────────
const { createStore } = require(
  path.resolve(__dirname, '../../editor/src/store.js')
);

// ─────────────────────────────────────────────────────────────────────────────
// Loader — run banners.js in a vm context with a fresh store each time.
// banners.js runtime guard: window.store.get must be a function.
// ─────────────────────────────────────────────────────────────────────────────
function loadBanners(overrides) {
  const store = createStore();
  // Register the 'ui' slice with activeBanners as banners.js expects.
  store.defineSlice('ui', { activeBanners: [] });

  const warnings = [];
  const ctx = Object.assign(
    {
      window: {
        store,
      },
      // reportShellWarning — optional global, will be present in most tests.
      reportShellWarning: (msg) => warnings.push(msg),
      // Expose Set for use inside the vm (vm context doesn't inherit host globals).
      Set,
      Array,
      Object,
    },
    overrides || {}
  );

  const src = fs.readFileSync(
    path.resolve(__dirname, '../../editor/src/banners.js'),
    'utf8'
  );

  const vmCtx = vm.createContext(ctx);
  vm.runInContext(src, vmCtx);

  return { vmCtx, store, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test('(a) registerBanner("trust", {render:fn}) stores spec', () => {
  const { vmCtx } = loadBanners();
  const renderFn = () => {};
  vmCtx.registerBanner('trust', { render: renderFn });
  // Verify the spec is retrievable via showBanner without error.
  // We access the BANNER_REGISTRY through the vm context.
  const reg = vmCtx.BANNER_REGISTRY;
  assert.ok(reg['trust'], 'trust spec should be stored');
  assert.equal(reg['trust'].render, renderFn);
});

test('(b) showBanner("trust", {x:1}) calls render + pushes to store.ui.activeBanners', () => {
  const { vmCtx, store } = loadBanners();
  const renderCalls = [];
  vmCtx.registerBanner('trust', { render: (payload) => renderCalls.push(payload) });
  vmCtx.showBanner('trust', { x: 1 });
  // render was called
  assert.equal(renderCalls.length, 1);
  assert.deepEqual(renderCalls[0], { x: 1 });
  // store updated
  const active = store.get('ui').activeBanners;
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'trust');
  assert.deepEqual(active[0].payload, { x: 1 });
});

test('(c) hideBanner("trust") removes from active list', () => {
  const { vmCtx, store } = loadBanners();
  vmCtx.registerBanner('trust', { render: () => {} });
  vmCtx.showBanner('trust', { x: 1 });
  // Confirm it's active
  assert.equal(store.get('ui').activeBanners.length, 1);
  // Hide it
  vmCtx.hideBanner('trust');
  assert.equal(store.get('ui').activeBanners.length, 0);
});

test('(d) showBanner("unknown") does NOT throw — calls reportShellWarning stub', () => {
  const { vmCtx, warnings } = loadBanners();
  // Should not throw
  assert.doesNotThrow(() => vmCtx.showBanner('unknown-banner-id'));
  // reportShellWarning was called
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('unknown-banner-id'));
});

test('(e) showBanner("a") twice replaces existing entry (no duplicate)', () => {
  const { vmCtx, store } = loadBanners();
  const renderCalls = [];
  vmCtx.registerBanner('a', { render: (p) => renderCalls.push(p) });
  vmCtx.showBanner('a', { first: true });
  vmCtx.showBanner('a', { second: true });
  // render called twice
  assert.equal(renderCalls.length, 2);
  // activeBanners has exactly one entry for 'a'
  const active = store.get('ui').activeBanners;
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'a');
  // payload is the latest
  assert.deepEqual(active[0].payload, { second: true });
});

test('(f) registerBanner("a", {}) throws — missing render', () => {
  const { vmCtx } = loadBanners();
  assert.throws(
    () => vmCtx.registerBanner('a', {}),
    /render must be a function/i
  );
});
