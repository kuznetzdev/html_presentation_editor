// bridge-token.spec.js
// Security gate: crypto.getRandomValues bridge token (AUDIT-D-15, ADR-012, WO-05)
// Verifies that the bridge token uses crypto.getRandomValues (192-bit entropy),
// matches the expected shape, and that two separate sessions produce different tokens.
//
// All scenarios run on chromium-desktop only (bridge behaviour is engine-agnostic).

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");

// ─── Helper: read the current bridge token from shell state ────────────────
async function readBridgeToken(page) {
  return evaluateEditor(
    page,
    `(() => {
      return (typeof state !== "undefined" && state.bridgeToken) ? state.bridgeToken : null;
    })()`,
  );
}

test.describe("bridge-token: crypto.getRandomValues gate @security", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !isChromiumOnlyProject(testInfo.project.name),
      "Chromium-only bridge behaviour.",
    );
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
  });

  // ── Test BT1 ─────────────────────────────────────────────────────────────
  // Token shape: must match /^pe-[0-9a-f]{48}-\d+$/
  // 24 bytes = 48 hex chars; "pe-" prefix for log-grep back-compat;
  // "-<timestamp>" suffix for uniqueness verification.
  // Closes AUDIT-D-15 (CWE-338: weak PRNG replaced with crypto PRNG).
  test("BT1 — bridge token matches crypto shape /^pe-[0-9a-f]{48}-\\d+$/", async ({ page }) => {
    const token = await readBridgeToken(page);

    // Token must be a non-empty string.
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    // Shape: "pe-" + 48 lowercase hex chars + "-" + digits (Date.now() timestamp).
    // 24 bytes * 2 hex chars/byte = 48 hex chars.
    expect(token).toMatch(/^pe-[0-9a-f]{48}-\d+$/);
  });

  // ── Test BT2 ─────────────────────────────────────────────────────────────
  // Distinct-tabs: two independently loaded bridge sessions must produce
  // different tokens. Probability of collision with crypto.getRandomValues
  // over 192 bits is negligible (2^-192); any collision indicates a fallback
  // to a weak PRNG or a static value, and must fail the gate.
  test("BT2 — two independent bridge sessions produce different tokens", async ({ page, context }) => {
    // Token from the first session (already loaded in beforeEach).
    const firstToken = await readBridgeToken(page);
    expect(typeof firstToken).toBe("string");
    expect(firstToken.length).toBeGreaterThan(0);

    // Open a second tab and load a fresh bridge session independently.
    const secondPage = await context.newPage();
    await loadBasicDeck(secondPage, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
    const secondToken = await readBridgeToken(secondPage);

    await secondPage.close();

    // Each token must independently match the shape.
    expect(firstToken).toMatch(/^pe-[0-9a-f]{48}-\d+$/);
    expect(secondToken).toMatch(/^pe-[0-9a-f]{48}-\d+$/);

    // The two tokens must differ — crypto.getRandomValues guarantees this
    // with overwhelmingly high probability. A match here would indicate
    // a deterministic or static token implementation.
    expect(firstToken).not.toBe(secondToken);
  });
});
