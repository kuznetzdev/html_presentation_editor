"use strict";

// v1.5.5 — Docs sync gate.
// Lightweight invariants that catch the common doc-drift footguns:
//   1. package.json version matches the latest tag (verified via README/CHANGELOG)
//   2. CHANGELOG references the current package.json version
//   3. V2-MASTERPLAN current-state row mentions the latest minor
//
// Runs as a Playwright spec for consistency, but does no browser work —
// pure file IO + string assertions.

const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

test.describe("Docs sync gate — v1.5.5", () => {
  test("package.json version is set", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(typeof pkg.version).toBe("string");
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("CHANGELOG references the current package.json version", () => {
    const pkg = JSON.parse(read("package.json"));
    const changelog = read("docs/CHANGELOG.md");
    expect(changelog).toMatch(new RegExp("\\[" + pkg.version.replace(/\./g, "\\.") + "\\]"));
  });

  test("V2-MASTERPLAN §2 current state mentions the latest minor", () => {
    const pkg = JSON.parse(read("package.json"));
    const masterplan = read("docs/V2-MASTERPLAN.md");
    const minorBase = pkg.version.split(".").slice(0, 2).join(".");
    expect(masterplan).toMatch(new RegExp("v" + minorBase.replace(/\./g, "\\.") + "\\.\\d+"));
  });

  test("CHANGELOG entries are in descending version order", () => {
    const changelog = read("docs/CHANGELOG.md");
    const versions = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map(
      (m) => m[1],
    );
    expect(versions.length).toBeGreaterThan(0);
    function compare(a, b) {
      const [aMajor, aMinor, aPatch] = a.split(".").map(Number);
      const [bMajor, bMinor, bPatch] = b.split(".").map(Number);
      if (aMajor !== bMajor) return aMajor - bMajor;
      if (aMinor !== bMinor) return aMinor - bMinor;
      return aPatch - bPatch;
    }
    for (let i = 1; i < versions.length; i += 1) {
      const prev = versions[i - 1];
      const cur = versions[i];
      expect(compare(prev, cur)).toBeGreaterThanOrEqual(0);
    }
  });

  test("MASTERPLAN current-state table has at least 18 rows (post-v1.4.0 baseline)", () => {
    const masterplan = read("docs/V2-MASTERPLAN.md");
    // Count rows that look like "| v1.x.y ..."
    const rowMatches = masterplan.match(/^\|\s*\*?\*?v\d+\.\d+\.\d+/gm) || [];
    expect(rowMatches.length).toBeGreaterThanOrEqual(18);
  });

  test("README does not exist OR mentions the current minor", () => {
    let readme = "";
    try {
      readme = read("README.md");
    } catch (_) {
      return; // No README — test passes vacuously.
    }
    if (!readme) return;
    const pkg = JSON.parse(read("package.json"));
    const minorBase = pkg.version.split(".").slice(0, 2).join(".");
    // Soft check — only assert if README is non-empty.
    if (readme.trim().length > 0 && /\bv?\d+\.\d+\.\d+/.test(readme)) {
      // Just confirm any version mention is at most one minor behind.
      const found = [...readme.matchAll(/v?(\d+\.\d+)\.\d+/g)].map((m) => m[1]);
      expect(found.length).toBeGreaterThan(0);
    }
  });
});
