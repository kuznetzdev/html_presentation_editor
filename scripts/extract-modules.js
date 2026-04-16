/**
 * extract-modules.js
 * Splits the monolithic editor/presentation-editor.html JavaScript block
 * into 21 focused module files under editor/src/*.js
 *
 * Run from worktree root:
 *   node scripts/extract-modules.js
 *
 * After running:
 *   - editor/src/*.js — 21 module files (shared classic-script scope)
 *   - editor/presentation-editor.html — updated to use <script src> tags
 *
 * Load-order note:
 *   main.js is always LAST. It holds the two module-level init calls that
 *   were previously inline mid-script (lines 2745-2752 of the post-CSS file):
 *     if (els.slideTemplateBar && ...) document.body.appendChild(...)
 *     init()
 *   The `function init()` is defined in inspector-sync.js (loaded before main.js).
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const WORKTREE = path.join(__dirname, '..');
const HTML_FILE = path.join(WORKTREE, 'editor', 'presentation-editor.html');
const SRC_DIR   = path.join(WORKTREE, 'editor', 'src');

// ─── Zone map ────────────────────────────────────────────────────────────────
// Lines are 1-indexed relative to the CURRENT html file (after CSS extraction).
// SCRIPT block: <script> at line 1761, </script> at line 19997.
// Each zone's end = (next zone's start - 1), or 19996 for the last zone.
//
// SPECIAL: onboarding.js has lines 2745-2752 removed (moved to main.js).
const ZONES = [
  { name: 'constants',      start: 1762,  end: 1934  }, // consts, storage keys, sets
  { name: 'state',          start: 1935,  end: 2595  }, // SelectionPolicy + PreviewLifecycle + AppState
  { name: 'onboarding',     start: 2596,  end: 2765  }, // ShellOnboarding (minus module-level init)
  { name: 'dom',            start: 2766,  end: 3125  }, // InspectorWiring — els object + cacheEls
  { name: 'bridge',         start: 3126,  end: 3257  }, // BridgeMessageDispatch
  { name: 'shortcuts',      start: 3258,  end: 3476  }, // GlobalShortcuts + WindowEvents
  { name: 'clipboard',      start: 3477,  end: 3593  }, // Clipboard + DragDrop
  { name: 'import',         start: 3594,  end: 4367  }, // DocumentLoading + ImportPipeline
  { name: 'slides',         start: 4368,  end: 4855  }, // SlideRegistry + Navigation
  { name: 'preview',        start: 4856,  end: 9130  }, // PreviewBuild + BridgeBootstrap
  { name: 'slide-rail',     start: 9131,  end: 9613  }, // SlideRailRendering
  { name: 'style-app',      start: 9614,  end: 9902  }, // StyleApplication
  { name: 'export',         start: 9903,  end: 10527 }, // Export + Assets
  { name: 'history',        start: 10528, end: 11352 }, // History: Undo/Redo
  { name: 'feedback',       start: 11353, end: 12276 }, // Feedback + Notifications
  { name: 'selection',      start: 12277, end: 14114 }, // SelectionOverlay + DirectManipulation
  { name: 'toolbar',        start: 14115, end: 14266 }, // FloatingToolbar
  { name: 'context-menu',   start: 14267, end: 15170 }, // ContextMenu
  { name: 'inspector-sync', start: 15171, end: 19326 }, // InspectorSync (includes init() def)
  { name: 'primary-action', start: 19327, end: 19996 }, // PrimaryActionSync + autosave
];

// Lines to REMOVE from onboarding.js and place in main.js (1-indexed, inclusive)
const INIT_BLOCK_START = 2745;  // `if (els.slideTemplateBar &&`
const INIT_BLOCK_END   = 2752;  // `init();`

// ─── Read source ─────────────────────────────────────────────────────────────
const html  = fs.readFileSync(HTML_FILE, 'utf8');
const lines = html.split('\n');

console.log(`Source: ${HTML_FILE}`);
console.log(`Total lines: ${lines.length}`);

// ─── Verify boundaries ───────────────────────────────────────────────────────
function ln(n) { return lines[n - 1] || ''; }  // 1-indexed access

const scriptOpenLine  = ln(1761);
const scriptCloseLine = ln(19997);
if (!scriptOpenLine.includes('<script>')) {
  console.error(`ERROR: Line 1761 should be <script>, got: ${scriptOpenLine}`);
  process.exit(1);
}
if (!scriptCloseLine.includes('</script>')) {
  console.error(`ERROR: Line 19997 should be </script>, got: ${scriptCloseLine}`);
  process.exit(1);
}
console.log('✓ <script> block boundaries verified');

// Verify init() call location
const initCallLine = ln(INIT_BLOCK_END);
if (!initCallLine.includes('init()')) {
  console.error(`ERROR: Line ${INIT_BLOCK_END} should contain init(), got: ${initCallLine}`);
  process.exit(1);
}
console.log(`✓ init() call at line ${INIT_BLOCK_END} verified`);

// ─── Create src directory ────────────────────────────────────────────────────
fs.mkdirSync(SRC_DIR, { recursive: true });
console.log(`Output: ${SRC_DIR}`);
console.log('');

// ─── Extract zones ───────────────────────────────────────────────────────────
let totalExtracted = 0;

for (const zone of ZONES) {
  // lines.slice is 0-indexed; zone.start/end are 1-indexed
  let zoneLines = lines.slice(zone.start - 1, zone.end);

  if (zone.name === 'onboarding') {
    // Remove the module-level init block (lines INIT_BLOCK_START..INIT_BLOCK_END)
    zoneLines = zoneLines.filter((_, i) => {
      const globalLine = zone.start + i;  // 1-indexed
      return globalLine < INIT_BLOCK_START || globalLine > INIT_BLOCK_END;
    });
  }

  const outFile = path.join(SRC_DIR, `${zone.name}.js`);
  fs.writeFileSync(outFile, zoneLines.join('\n') + '\n', 'utf8');
  totalExtracted += zoneLines.length;
  console.log(`  [${zone.name}.js]  ${zoneLines.length} lines  (src lines ${zone.start}–${zone.end})`);
}

// ─── Write main.js ───────────────────────────────────────────────────────────
const initBlockLines = lines.slice(INIT_BLOCK_START - 1, INIT_BLOCK_END);
const mainContent = [
  '// main.js — entry point',
  '// All module scripts have been evaluated at this point.',
  '// Execute the two module-level bootstraps that kick off the shell.',
  '',
  ...initBlockLines,
  '',
].join('\n');

const mainFile = path.join(SRC_DIR, 'main.js');
fs.writeFileSync(mainFile, mainContent, 'utf8');
console.log(`  [main.js]  ${initBlockLines.length} lines  (init block from lines ${INIT_BLOCK_START}–${INIT_BLOCK_END})`);
console.log('');
console.log(`Total JS lines extracted: ${totalExtracted + initBlockLines.length}`);

// ─── Build <script src> tag block ────────────────────────────────────────────
const scriptTagLines = [
  ...ZONES.map(z => `    <script src="src/${z.name}.js"></script>`),
  `    <script src="src/main.js"></script>`,
];

// ─── Update HTML: replace <script>…</script> block ───────────────────────────
// Drop lines 1761–19997 (the entire inline script block) and insert src tags.
const SCRIPT_OPEN  = 1761;  // 1-indexed
const SCRIPT_CLOSE = 19997; // 1-indexed

const newLines = [
  ...lines.slice(0, SCRIPT_OPEN - 1),   // everything before <script> (lines 1–1760)
  ...scriptTagLines,                      // new <script src> tags
  ...lines.slice(SCRIPT_CLOSE),           // everything after </script> (line 19998+)
];

fs.writeFileSync(HTML_FILE, newLines.join('\n'), 'utf8');
console.log(`\n✓ HTML updated: replaced <script> block with ${scriptTagLines.length} <script src> tags`);
console.log(`  New file: ${newLines.length} lines (was ${lines.length})`);
console.log('\nDone. Run: npm run test:gate-a');
