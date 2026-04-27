// bridge-sanitize.spec.js
// Security gate: parseSingleRoot sanitization (AUDIT-D-02, ADR-012 §7, WO-01)
// Verifies that replace-node-html rejects or strips dangerous payloads while
// allowing legitimate HTML to pass through unchanged.
//
// All 5 scenarios run on chromium-desktop only (bridge behaviour is engine-agnostic).

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");
const {
  captureCommandSeq,
  waitForCommandSeqAdvance,
} = require("../helpers/waits");

// ─── Helper: get first node-id from a CSS selector in the preview frame ────
async function getPreviewNodeId(page, selector) {
  return evaluateEditor(
    page,
    `(() => {
      const frame = document.getElementById("previewFrame");
      const doc = frame?.contentDocument || null;
      return doc?.querySelector(${JSON.stringify(selector)})?.getAttribute("data-editor-node-id") || "";
    })()`,
  );
}

// ─── Helper: send replace-node-html through the shell bridge ───────────────
async function sendReplaceNodeHtml(page, nodeId, html) {
  return evaluateEditor(
    page,
    `(() => {
      if (typeof sendToBridge !== "function") return false;
      return sendToBridge("replace-node-html", {
        nodeId: ${JSON.stringify(nodeId)},
        html: ${JSON.stringify(html)},
      });
    })()`,
  );
}

// ─── Helper: read outerHTML of a node-id from the preview frame ────────────
async function getPreviewNodeHtml(page, nodeId) {
  return evaluateEditor(
    page,
    `(() => {
      const frame = document.getElementById("previewFrame");
      const doc = frame?.contentDocument || null;
      return doc?.querySelector('[data-editor-node-id="${nodeId}"]')?.outerHTML || "";
    })()`,
  );
}

// ─── Helper: query an attribute on a node in the preview frame ─────────────
async function getPreviewNodeAttr(page, nodeId, attrName) {
  return evaluateEditor(
    page,
    `(() => {
      const frame = document.getElementById("previewFrame");
      const doc = frame?.contentDocument || null;
      const el = doc?.querySelector('[data-editor-node-id="${nodeId}"]');
      return el ? (el.getAttribute(${JSON.stringify(attrName)}) ?? null) : undefined;
    })()`,
  );
}

// ─── Helper: count tag occurrences in a preview-frame subtree ──────────────
async function countTagInPreviewNode(page, nodeId, tagName) {
  return evaluateEditor(
    page,
    `(() => {
      const frame = document.getElementById("previewFrame");
      const doc = frame?.contentDocument || null;
      const root = doc?.querySelector('[data-editor-node-id="${nodeId}"]');
      return root ? root.querySelectorAll(${JSON.stringify(tagName)}).length : 0;
    })()`,
  );
}

test.describe("bridge-sanitize: parseSingleRoot security gate @security", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only bridge behaviour.");
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
  });

  // ── Test S1 ─────────────────────────────────────────────────────────────
  // replace-node-html with an onclick handler: after commit the attribute must
  // be absent from the live DOM. (CWE-79, AUDIT-D-02)
  test("S1 — replace-node-html strips onclick from replacement element", async ({ page }) => {
    const nodeId = await getPreviewNodeId(page, "#hero-title");
    expect(nodeId).toBeTruthy();

    // Send a replacement that contains an inline event handler.
    await sendReplaceNodeHtml(page, nodeId, '<h1 id="hero-title" onclick="alert(1)">safe text</h1>');

    // Wait for the node to be replaced (text changes to "safe text").
    await expect
      .poll(() => evaluateEditor(
        page,
        `(() => {
          const frame = document.getElementById("previewFrame");
          const doc = frame?.contentDocument || null;
          return doc?.querySelector('[data-editor-node-id="${nodeId}"]')?.textContent?.trim() || "";
        })()`,
      ), { timeout: 8000 })
      .toBe("safe text");

    // The onclick attribute must not exist on the committed node.
    const onclickValue = await getPreviewNodeAttr(page, nodeId, "onclick");
    expect(onclickValue).toBeNull();
  });

  // ── Test S2 ─────────────────────────────────────────────────────────────
  // A <script> inside the replacement HTML must not appear in the live DOM.
  // parseSingleRoot rejects payloads whose root is not in ALLOWED_HTML_TAGS OR
  // returns null when the single-root invariant breaks after sanitization.
  test("S2 — replace-node-html with <script> inside does not inject script into DOM", async ({ page }) => {
    const nodeId = await getPreviewNodeId(page, "#hero-copy");
    expect(nodeId).toBeTruthy();

    // Capture original text to detect whether a replacement occurred.
    const originalHtml = await getPreviewNodeHtml(page, nodeId);
    expect(originalHtml).toBeTruthy();

    // The replacement wraps a <script> inside a <div>. sanitizeFragment strips
    // the <script> (not in ALLOWED_HTML_TAGS) before importNode.
    const priorSeq = await captureCommandSeq(page);
    await sendReplaceNodeHtml(
      page,
      nodeId,
      '<div id="hero-copy"><script>window.__xss_probe=1;<\/script>Visible text</div>',
    );
    await waitForCommandSeqAdvance(page, priorSeq);

    // No <script> tags inside the node.
    const scriptCount = await countTagInPreviewNode(page, nodeId, "script");
    expect(scriptCount).toBe(0);

    // Probe variable must not have been set.
    const probeValue = await evaluateEditor(
      page,
      `(() => {
        const frame = document.getElementById("previewFrame");
        return frame?.contentWindow?.__xss_probe ?? null;
      })()`,
    );
    expect(probeValue).toBeNull();
  });

  // ── Test S3 ─────────────────────────────────────────────────────────────
  // An <a> with href="javascript:void(0)" must have its href stripped.
  test("S3 — replace-node-html strips javascript: href", async ({ page }) => {
    const nodeId = await getPreviewNodeId(page, "#cta-box");
    expect(nodeId).toBeTruthy();

    await sendReplaceNodeHtml(
      page,
      nodeId,
      '<div id="cta-box"><a href="javascript:void(0)">click me</a></div>',
    );

    // Wait for content change (the inner text changes to "click me").
    await expect
      .poll(() => evaluateEditor(
        page,
        `(() => {
          const frame = document.getElementById("previewFrame");
          const doc = frame?.contentDocument || null;
          return doc?.querySelector('[data-editor-node-id="${nodeId}"]')?.textContent?.trim() || "";
        })()`,
      ), { timeout: 8000 })
      .toBe("click me");

    // The href attribute on the <a> must be absent or empty — not "javascript:…".
    const hrefValue = await evaluateEditor(
      page,
      `(() => {
        const frame = document.getElementById("previewFrame");
        const doc = frame?.contentDocument || null;
        const root = doc?.querySelector('[data-editor-node-id="${nodeId}"]');
        return root?.querySelector("a")?.getAttribute("href") ?? null;
      })()`,
    );
    // href must be absent (null) — javascript: protocol was stripped.
    expect(hrefValue).toBeNull();
  });

  // ── Test S4 ─────────────────────────────────────────────────────────────
  // A payload larger than MAX_HTML_BYTES (256 KB) must be rejected: no DOM
  // change and no throw visible to the shell.
  test("S4 — replace-node-html rejects payload > 256 KB", async ({ page }) => {
    const nodeId = await getPreviewNodeId(page, "#hero-title");
    expect(nodeId).toBeTruthy();

    // Capture original text for comparison.
    const originalText = await evaluateEditor(
      page,
      `(() => {
        const frame = document.getElementById("previewFrame");
        const doc = frame?.contentDocument || null;
        return doc?.querySelector('[data-editor-node-id="${nodeId}"]')?.textContent?.trim() || "";
      })()`,
    );
    expect(originalText).toBeTruthy();

    // Build a >256 KB payload string.
    const oversizedHtml = `<h1 id="hero-title">${"A".repeat(300000)}</h1>`;

    // This call must not throw. The shell schema accepts it (size guard lives
    // in the iframe), so seq advances; the iframe ACKs with ok:false.
    const priorSeq = await captureCommandSeq(page);
    await evaluateEditor(
      page,
      `(() => {
        if (typeof sendToBridge !== "function") return "no-fn";
        return sendToBridge("replace-node-html", {
          nodeId: ${JSON.stringify(nodeId)},
          html: ${JSON.stringify(oversizedHtml)},
        });
      })()`,
    );
    await waitForCommandSeqAdvance(page, priorSeq);

    const textAfter = await evaluateEditor(
      page,
      `(() => {
        const frame = document.getElementById("previewFrame");
        const doc = frame?.contentDocument || null;
        return doc?.querySelector('[data-editor-node-id="${nodeId}"]')?.textContent?.trim() || "";
      })()`,
    );
    // Text unchanged — oversized payload rejected by parseSingleRoot length guard.
    expect(textAfter).toBe(originalText);
  });

  // ── Test S5 ─────────────────────────────────────────────────────────────
  // A legitimate <figure><figcaption> replacement commits normally.
  test("S5 — legitimate figure/figcaption passes through sanitization intact", async ({ page }) => {
    const nodeId = await getPreviewNodeId(page, "#cta-box");
    expect(nodeId).toBeTruthy();

    await sendReplaceNodeHtml(
      page,
      nodeId,
      '<figure id="cta-box"><figcaption>Caption text</figcaption></figure>',
    );

    // Wait for text content to change.
    await expect
      .poll(() => evaluateEditor(
        page,
        `(() => {
          const frame = document.getElementById("previewFrame");
          const doc = frame?.contentDocument || null;
          return doc?.querySelector('[data-editor-node-id="${nodeId}"]')?.textContent?.trim() || "";
        })()`,
      ), { timeout: 8000 })
      .toBe("Caption text");

    // Verify the figcaption is present inside the committed node.
    const figcaptionCount = await countTagInPreviewNode(page, nodeId, "figcaption");
    expect(figcaptionCount).toBe(1);

    // Verify the wrapper is a <figure>.
    const tagName = await evaluateEditor(
      page,
      `(() => {
        const frame = document.getElementById("previewFrame");
        const doc = frame?.contentDocument || null;
        return doc?.querySelector('[data-editor-node-id="${nodeId}"]')?.tagName?.toLowerCase() || "";
      })()`,
    );
    expect(tagName).toBe("figure");
  });
});
