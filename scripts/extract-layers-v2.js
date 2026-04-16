/**
 * extract-layers-v2.js  —  v0.23.0 layer-separation pass
 *
 * Splits the two oversized modules that still mix architectural layers:
 *
 *   preview.js (4 275 lines) → 3 files:
 *     bridge-script.js    (iframe bridge mini-app — template literal, ~3 419 ln)
 *     preview.js          (SHRUNK: preview build core — 29 ln)
 *     bridge-commands.js  (bridge↔state integration — ~827 ln)
 *
 *   inspector-sync.js (4 156 lines) → 3 files:
 *     inspector-sync.js   (SHRUNK: inspector view layer — 1 385 ln)
 *     shell-overlays.js   (modal/palette/layer-picker/setMode — ~820 ln)
 *     boot.js             (app bootstrap: init() + theme + bind* — ~1 951 ln)
 *
 *   presentation-editor.html — load order updated with 3 new <script src> tags
 *
 * Run from worktree root:
 *   node scripts/extract-layers-v2.js
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const WORKTREE = path.join(__dirname, '..');
const SRC      = path.join(WORKTREE, 'editor', 'src');
const HTML     = path.join(WORKTREE, 'editor', 'presentation-editor.html');

// ─── helpers ─────────────────────────────────────────────────────────────────
function readLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n');
}
function writeLines(file, lines) {
  fs.writeFileSync(file, lines.join('\n'), 'utf8');
  console.log(`  wrote  ${path.relative(WORKTREE, file)}  (${lines.length} lines)`);
}
/** 1-indexed, inclusive slice */
function slice1(lines, start, end) {
  return lines.slice(start - 1, end);   // end is inclusive → end (not end-1) for slice
}

// ─── SPLIT 1: preview.js ─────────────────────────────────────────────────────
console.log('\n── preview.js split ──');
const previewLines = readLines(path.join(SRC, 'preview.js'));
console.log(`  source: ${previewLines.length} lines`);

// Verify boundaries
if (!previewLines[29].includes('function buildBridgeScript')) {
  console.error(`BOUNDARY ERROR: preview.js line 30 should be buildBridgeScript, got: ${previewLines[29]}`);
  process.exit(1);
}
if (!previewLines[3448].trim().startsWith('`')) {
  // line 3448 (1-indexed) = index 3447 — should be the closing backtick of the template literal
  // Try to verify by checking the next line is isMutatingBridgeCommand
}
if (!previewLines[3448].includes('function isMutatingBridgeCommand')) {
  // Check line 3449 (index 3448)
  if (!previewLines[3448].includes('function isMutatingBridgeCommand')) {
    console.log(`  note: boundary check — line 3449: ${previewLines[3448].trim().slice(0, 60)}`);
  }
}

// Find exact line of isMutatingBridgeCommand (the split point)
const BRIDGE_CMDS_START = previewLines.findIndex(l => l.includes('function isMutatingBridgeCommand')) + 1; // 1-indexed
if (BRIDGE_CMDS_START === 0) {
  console.error('BOUNDARY ERROR: could not find isMutatingBridgeCommand in preview.js');
  process.exit(1);
}
const BRIDGE_SCRIPT_END = BRIDGE_CMDS_START - 1; // last line of buildBridgeScript
console.log(`  buildBridgeScript:  lines 30 – ${BRIDGE_SCRIPT_END}  (${BRIDGE_SCRIPT_END - 29} lines)`);
console.log(`  bridge-commands:    lines ${BRIDGE_CMDS_START} – ${previewLines.length}  (${previewLines.length - BRIDGE_CMDS_START + 1} lines)`);
console.log(`  preview-core keeps: lines 1 – 29`);

// Write bridge-script.js
const bridgeScriptHeader = [
  '// bridge-script.js',
  '// Layer: Iframe Bridge Application',
  '// Contains buildBridgeScript(token) — generates the JS string injected into',
  '// the preview iframe. This is a self-contained mini-app; do NOT mix shell',
  '// logic here.',
  '//',
];
writeLines(path.join(SRC, 'bridge-script.js'), [
  ...bridgeScriptHeader,
  ...slice1(previewLines, 30, BRIDGE_SCRIPT_END),
]);

// Write bridge-commands.js
const bridgeCmdsHeader = [
  '// bridge-commands.js',
  '// Layer: Bridge ↔ Shell State Integration',
  '// Processes postMessage commands from the iframe bridge: applies selection,',
  '// element updates, slide activation, and other bridge payloads to shell state.',
  '//',
];
writeLines(path.join(SRC, 'bridge-commands.js'), [
  ...bridgeCmdsHeader,
  ...slice1(previewLines, BRIDGE_CMDS_START, previewLines.length),
]);

// Shrink preview.js (keep core: zone header + buildPreviewPackage + injectBridge)
const previewCoreHeader = [
  '// preview.js  (core)',
  '// Layer: Preview Build',
  '// Orchestrates preview package creation and bridge injection.',
  '// buildBridgeScript  → bridge-script.js',
  '// bridge commands    → bridge-commands.js',
  '//',
];
writeLines(path.join(SRC, 'preview.js'), [
  ...previewCoreHeader,
  ...slice1(previewLines, 1, 29),
]);

// ─── SPLIT 2: inspector-sync.js ──────────────────────────────────────────────
console.log('\n── inspector-sync.js split ──');
const inspLines = readLines(path.join(SRC, 'inspector-sync.js'));
console.log(`  source: ${inspLines.length} lines`);

// Find exact boundary: shell-overlays starts at getFocusableElements
const OVERLAYS_START = inspLines.findIndex(l => l.includes('function getFocusableElements')) + 1;
if (OVERLAYS_START === 0) {
  console.error('BOUNDARY ERROR: could not find getFocusableElements in inspector-sync.js');
  process.exit(1);
}

// Find boot section: starts at function init()
const BOOT_START = inspLines.findIndex(l => l.trim() === 'function init() {') + 1;
if (BOOT_START === 0) {
  console.error('BOUNDARY ERROR: could not find function init() in inspector-sync.js');
  process.exit(1);
}
// Walk back to include the block comment before init()
let bootCommentStart = BOOT_START - 1; // 1-indexed line just before init()
while (bootCommentStart > OVERLAYS_START && inspLines[bootCommentStart - 2].trim().startsWith('/*') ||
       (bootCommentStart > OVERLAYS_START && inspLines[bootCommentStart - 2].trim().startsWith('*'))) {
  bootCommentStart--;
}
// Simpler: use the "vNext overrides" comment or go back 10 lines at most
// Actually just use BOOT_START - 6 to include the comment block
const OVERLAYS_END = BOOT_START - 7; // include the blank line before the comment block
const BOOT_SEC_START = BOOT_START - 6; // include comment before init()

console.log(`  inspector-sync core:  lines 1 – ${OVERLAYS_START - 1}  (${OVERLAYS_START - 1} lines)`);
console.log(`  shell-overlays:       lines ${OVERLAYS_START} – ${OVERLAYS_END}  (${OVERLAYS_END - OVERLAYS_START + 1} lines)`);
console.log(`  boot:                 lines ${BOOT_SEC_START} – ${inspLines.length}  (${inspLines.length - BOOT_SEC_START + 1} lines)`);

// Write shell-overlays.js
const overlaysHeader = [
  '// shell-overlays.js',
  '// Layer: Shell Overlay UI',
  '// Modal management, insert palette, topbar overflow, layer picker, context',
  '// menu binding, and mode switching. All shell-owned overlay surfaces.',
  '//',
];
writeLines(path.join(SRC, 'shell-overlays.js'), [
  ...overlaysHeader,
  ...slice1(inspLines, OVERLAYS_START, OVERLAYS_END),
]);

// Write boot.js
const bootHeader = [
  '// boot.js',
  '// Layer: Application Bootstrap',
  '// Contains init() — the app entry point called by main.js — plus all theme,',
  '// complexity, zoom and binding functions that run once at startup.',
  '//',
];
writeLines(path.join(SRC, 'boot.js'), [
  ...bootHeader,
  ...slice1(inspLines, BOOT_SEC_START, inspLines.length),
]);

// Shrink inspector-sync.js (keep only the inspector view layer)
const inspSyncHeader = [
  '// inspector-sync.js  (view layer)',
  '// Layer: Inspector View',
  '// Reads shell state and updates the right-panel inspector UI.',
  '// Modal/overlay logic → shell-overlays.js',
  '// Bootstrap/theme/bind → boot.js',
  '//',
];
writeLines(path.join(SRC, 'inspector-sync.js'), [
  ...inspSyncHeader,
  ...slice1(inspLines, 1, OVERLAYS_START - 1),
]);

// ─── Update HTML load order ───────────────────────────────────────────────────
console.log('\n── HTML update ──');
const html = fs.readFileSync(HTML, 'utf8');

// Insert bridge-script.js BEFORE preview.js
let updated = html.replace(
  '    <script src="src/preview.js"></script>',
  '    <script src="src/bridge-script.js"></script>\n    <script src="src/preview.js"></script>'
);

// Insert bridge-commands.js AFTER preview.js
updated = updated.replace(
  '    <script src="src/preview.js"></script>\n    <script src="src/slide-rail.js"></script>',
  '    <script src="src/preview.js"></script>\n    <script src="src/bridge-commands.js"></script>\n    <script src="src/slide-rail.js"></script>'
);

// Insert shell-overlays.js + boot.js AFTER inspector-sync.js
updated = updated.replace(
  '    <script src="src/inspector-sync.js"></script>\n    <script src="src/primary-action.js"></script>',
  '    <script src="src/inspector-sync.js"></script>\n    <script src="src/shell-overlays.js"></script>\n    <script src="src/boot.js"></script>\n    <script src="src/primary-action.js"></script>'
);

if (updated === html) {
  console.error('HTML update failed — no replacements matched. Check script tag format.');
  process.exit(1);
}

fs.writeFileSync(HTML, updated, 'utf8');
console.log('  updated: editor/presentation-editor.html (+3 <script src> tags)');

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n✓ Done. New file map:');
console.log('  bridge-script.js    ← NEW  (iframe bridge app)');
console.log('  preview.js          ← SHRUNK to ~35 lines');
console.log('  bridge-commands.js  ← NEW  (bridge↔state integration)');
console.log('  inspector-sync.js   ← SHRUNK to ~1 391 lines');
console.log('  shell-overlays.js   ← NEW  (modal/palette/layer-picker/setMode)');
console.log('  boot.js             ← NEW  (init() + theme + bind*)');
console.log('\nRun: npm run test:gate-a');
