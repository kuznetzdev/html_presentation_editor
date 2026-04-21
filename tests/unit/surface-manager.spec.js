/**
 * tests/unit/surface-manager.spec.js
 *
 * Unit tests for editor/src/surface-manager.js.
 * Run: npm run test:unit
 *
 * 5 cases:
 *  (a) closeTransientShellUi({keep:'context-menu'}) calls all closers except context-menu
 *  (b) normalizeShellSurfaceKeep(undefined) returns empty Set
 *  (c) normalizeShellSurfaceKeep('x') returns Set with one item
 *  (d) normalizeShellSurfaceKeep(['a','b',null]) returns Set with 2 items (null filtered)
 *  (e) closeTransientShellUi() closes all surfaces
 *
 * WO-23 — PAIN-MAP P2-09. Extracted from feedback.js v0.29.5.
 */
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const path     = require('node:path');
const fs       = require('node:fs');
const vm       = require('node:vm');

// ─────────────────────────────────────────────────────────────────────────────
// Harness: load surface-manager.js into a sandboxed global-like context.
// surface-manager.js requires the following globals at parse/guard time:
//   closeContextMenu (checked in runtime guard)
// And at call time: closeLayerPicker, isInsertPaletteOpen, closeInsertPalette,
//   isSlideTemplateBarOpen, closeSlideTemplateBar, isTopbarOverflowOpen,
//   closeTopbarOverflow, hideFloatingToolbar.
// ─────────────────────────────────────────────────────────────────────────────

function buildContext(stubs) {
  // Build a context object that the surface-manager.js code runs in.
  const ctx = Object.assign(
    {
      // Surface guard — must exist as a function
      closeContextMenu:       stubs.closeContextMenu       || (() => {}),
      closeLayerPicker:       stubs.closeLayerPicker       || (() => {}),
      isInsertPaletteOpen:    stubs.isInsertPaletteOpen    || (() => false),
      closeInsertPalette:     stubs.closeInsertPalette     || (() => {}),
      isSlideTemplateBarOpen: stubs.isSlideTemplateBarOpen || (() => false),
      closeSlideTemplateBar:  stubs.closeSlideTemplateBar  || (() => {}),
      isTopbarOverflowOpen:   stubs.isTopbarOverflowOpen   || (() => false),
      closeTopbarOverflow:    stubs.closeTopbarOverflow    || (() => {}),
      hideFloatingToolbar:    stubs.hideFloatingToolbar    || (() => {}),
    },
    {}
  );
  return ctx;
}

function loadSurfaceManager(stubs) {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../editor/src/surface-manager.js'),
    'utf8'
  );
  const ctx = buildContext(stubs || {});
  // Execute in a vm context so globals are isolated
  const vmCtx = vm.createContext(ctx);
  vm.runInContext(src, vmCtx);
  return vmCtx;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test('(a) closeTransientShellUi({keep:"context-menu"}) calls all closers except context-menu', () => {
  const calls = [];
  const ctx = loadSurfaceManager({
    closeContextMenu:       () => calls.push('context-menu'),
    closeLayerPicker:       () => calls.push('layer-picker'),
    isInsertPaletteOpen:    () => true,
    closeInsertPalette:     () => calls.push('insert-palette'),
    isSlideTemplateBarOpen: () => true,
    closeSlideTemplateBar:  () => calls.push('slide-template'),
    isTopbarOverflowOpen:   () => true,
    closeTopbarOverflow:    () => calls.push('topbar-overflow'),
    hideFloatingToolbar:    () => calls.push('floating-toolbar'),
  });
  ctx.closeTransientShellUi({ keep: 'context-menu' });
  assert.ok(!calls.includes('context-menu'), 'context-menu should NOT be closed');
  assert.ok(calls.includes('layer-picker'), 'layer-picker should be closed');
  assert.ok(calls.includes('insert-palette'), 'insert-palette should be closed');
  assert.ok(calls.includes('slide-template'), 'slide-template should be closed');
  assert.ok(calls.includes('topbar-overflow'), 'topbar-overflow should be closed');
  assert.ok(calls.includes('floating-toolbar'), 'floating-toolbar should be closed');
});

test('(b) normalizeShellSurfaceKeep(undefined) returns empty Set', () => {
  const ctx = loadSurfaceManager();
  const result = ctx.normalizeShellSurfaceKeep(undefined);
  assert.ok(result !== null && typeof result === 'object' && typeof result.size === 'number', 'should be a Set-like object');
  assert.equal(result.size, 0);
});

test('(c) normalizeShellSurfaceKeep("x") returns Set with one item', () => {
  const ctx = loadSurfaceManager();
  const result = ctx.normalizeShellSurfaceKeep('x');
  assert.equal(result.size, 1);
  assert.ok(result.has('x'));
});

test('(d) normalizeShellSurfaceKeep(["a","b",null]) returns Set with 2 items (null filtered)', () => {
  const ctx = loadSurfaceManager();
  const result = ctx.normalizeShellSurfaceKeep(['a', 'b', null]);
  assert.equal(result.size, 2);
  assert.ok(result.has('a'));
  assert.ok(result.has('b'));
  assert.ok(!result.has(null));
});

test('(e) closeTransientShellUi() with no options closes all surfaces', () => {
  const calls = [];
  const ctx = loadSurfaceManager({
    closeContextMenu:       () => calls.push('context-menu'),
    closeLayerPicker:       () => calls.push('layer-picker'),
    isInsertPaletteOpen:    () => true,
    closeInsertPalette:     () => calls.push('insert-palette'),
    isSlideTemplateBarOpen: () => true,
    closeSlideTemplateBar:  () => calls.push('slide-template'),
    isTopbarOverflowOpen:   () => true,
    closeTopbarOverflow:    () => calls.push('topbar-overflow'),
    hideFloatingToolbar:    () => calls.push('floating-toolbar'),
  });
  ctx.closeTransientShellUi();
  assert.ok(calls.includes('context-menu'), 'context-menu should be closed');
  assert.ok(calls.includes('layer-picker'), 'layer-picker should be closed');
  assert.ok(calls.includes('insert-palette'), 'insert-palette should be closed');
  assert.ok(calls.includes('slide-template'), 'slide-template should be closed');
  assert.ok(calls.includes('topbar-overflow'), 'topbar-overflow should be closed');
  assert.ok(calls.includes('floating-toolbar'), 'floating-toolbar should be closed');
});
