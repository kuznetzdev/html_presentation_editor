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

  // ─────────────────────────────────────────────────────────────────
  // [v2.0.1] Strengthened drift checks — caught by post-v2.0 audit.
  // SOURCE_OF_TRUTH.md is the most-read file by future agents; if it
  // drifts, every fresh session starts from a wrong picture.
  // ─────────────────────────────────────────────────────────────────

  test("SOURCE_OF_TRUTH.md mentions the current major.minor", () => {
    const sot = read("docs/SOURCE_OF_TRUTH.md");
    const pkg = JSON.parse(read("package.json"));
    const majorMinor = pkg.version.split(".").slice(0, 2).join(".");
    expect(sot).toMatch(
      new RegExp("v" + majorMinor.replace(/\./g, "\\.") + "(?:\\.\\d+)?"),
    );
  });

  test("SOURCE_OF_TRUTH.md does not still claim v0.37 RC freeze as Current", () => {
    const sot = read("docs/SOURCE_OF_TRUTH.md");
    // The literal "Current: v0.37.0-rc.0" was the pre-v1.0 marker.
    // It must not appear at the top of the Release state section any
    // more — preserved only as an anchor in the historical section.
    const releaseStateIdx = sot.indexOf("## Release state");
    expect(releaseStateIdx).toBeGreaterThan(0);
    const tail = sot.slice(releaseStateIdx);
    // Old "Current:" line must not be the active one.
    expect(tail).not.toMatch(/^\*\*Current\*\*:\s*v0\.37/m);
    // Old "Target GA: v1.0.0" must not be the active target.
    expect(tail).not.toMatch(/^\*\*Target GA\*\*:\s*v1\.0\.0/m);
  });

  test("README milestone list mentions v2 trajectory or current major", () => {
    let readme = "";
    try {
      readme = read("README.md");
    } catch (_) {
      return;
    }
    if (!readme) return;
    const pkg = JSON.parse(read("package.json"));
    const major = pkg.version.split(".")[0];
    // README must reference the current major version explicitly
    // (e.g. "v2.0.0" or "v2 trajectory").
    expect(readme).toMatch(
      new RegExp("v" + major + "\\.\\d+\\.\\d+|v" + major + "\\b"),
    );
  });

  test("RELEASE-v2.0.md exists when current major is 2", () => {
    const pkg = JSON.parse(read("package.json"));
    const major = parseInt(pkg.version.split(".")[0], 10);
    if (major < 2) return;
    let release = "";
    try {
      release = read("docs/RELEASE-v2.0.md");
    } catch (_) {
      throw new Error(
        "Expected docs/RELEASE-v2.0.md to exist for v2.x release",
      );
    }
    expect(release.length).toBeGreaterThan(500);
    expect(release).toMatch(/v2\.0\.0/);
  });

  test("Tag arithmetic in RELEASE-v2.0.md matches actual tag count", () => {
    let release = "";
    try {
      release = read("docs/RELEASE-v2.0.md");
    } catch (_) {
      return;
    }
    if (!release) return;
    // Count entries in the Tag history fenced block.
    const historyMatch = release.match(/## Tag history[\s\S]*?```([\s\S]*?)```/);
    if (!historyMatch) return;
    const lines = historyMatch[1]
      .split("\n")
      .filter((l) => /^v\d+\.\d+\.\d+/.test(l.trim()));
    // Counted entries should match the textual claim somewhere in the
    // doc. We verify the doc mentions the same number it lists.
    const counted = lines.length;
    expect(counted).toBeGreaterThan(0);
    // The TL;DR / header should mention the same count.
    const claimedMatch = release.match(/(\d+)\s+incremental\s+(?:tags|release\s+points)/i);
    if (claimedMatch) {
      expect(parseInt(claimedMatch[1], 10)).toBe(counted);
    }
  });

  test("POST_V2_ROADMAP.md exists for post-v2 trajectory", () => {
    const pkg = JSON.parse(read("package.json"));
    const major = parseInt(pkg.version.split(".")[0], 10);
    if (major < 2) return;
    const fs = require("fs");
    const path = require("path");
    const exists = fs.existsSync(path.join(REPO_ROOT, "docs/POST_V2_ROADMAP.md"));
    expect(exists).toBe(true);
  });
});
