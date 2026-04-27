#!/usr/bin/env node
"use strict";

// v2.0.21 — pre-commit guard: bridge-script.js MUST parse cleanly.
//
// editor/src/bridge-script.js is wrapped in a 3,800+ line template literal
// (it's the iframe-side script, transcluded into the shell as a string and
// blob-URL-loaded). A stray backtick or `${...}` interpolation inside a
// comment will silently break the entire bridge — and the shell will
// continue to load with a non-functional preview.
//
// This script runs `node --check` on bridge-script.js (and a few other
// hot files) and fails fast if any of them don't parse. It's wired as
// the first step of `npm run test:gate-a` (so CI catches the bug
// immediately) and is exposed as `npm run precommit` for local hooks.

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const FILES = [
  "editor/src/bridge-script.js",
  "editor/src/bridge.js",
  "editor/src/bridge-schema.js",
  "editor/src/bridge-commands.js",
  "editor/src/state.js",
  "editor/src/slides.js",
  "editor/src/slide-rail.js",
  "editor/src/layers-panel.js",
  "editor/src/export.js",
  "editor/src/export-pptx/index.js",
  "editor/src/experimental-badge.js",
];

let ok = true;
for (const f of FILES) {
  const r = spawnSync("node", ["--check", f], { stdio: "inherit" });
  if (r.status !== 0) {
    process.stderr.write(`[precommit] SYNTAX FAIL: ${f}\n`);
    ok = false;
  }
}

if (!ok) {
  process.stderr.write(
    "[precommit] one or more files failed `node --check`. Fix the syntax error before committing.\n"
  );
  process.exit(1);
}
process.stdout.write("[precommit] all syntax checks passed.\n");
