// export-sri.spec.js
// Security gate: pptxgenjs vendor path + CDN SRI (AUDIT-D-03, ADR-015, WO-03)
//
// Scenario A — vendor path: confirms that loading export.js constants results
//   in PPTX_USE_VENDOR=true and no external CDN URL is used as the active load path.
//
// Scenario B — CDN path constants: confirms that PPTX_CDN_URL is pinned to a
//   specific version AND PPTX_SRI is set to a non-empty sha384 value, AND that
//   pptxLoadScript would attach integrity + crossorigin attributes when called
//   with an sri argument (verified by injecting a test call and inspecting the
//   script element before it loads).
//
// Both scenarios run on chromium-desktop only (JS engine behaviour is
// browser-agnostic; running on all browsers would be redundant for this gate).

const { test, expect } = require("@playwright/test");
const {
  evaluateEditor,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");

test.describe("PPTX export — vendor path + CDN SRI @security", () => {
  // Only run on chromium-desktop to keep gate fast.
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !isChromiumOnlyProject(testInfo.project.name),
      "SRI gate runs on chromium-desktop only",
    );
    // Navigate to the editor shell. We only need the JS to be evaluated;
    // we do not need a loaded deck for these checks.
    await page.goto("/editor/presentation-editor.html", {
      waitUntil: "domcontentloaded",
    });
  });

  // ── Scenario A ──────────────────────────────────────────────────────────────
  // Vendor path is the default: no external CDN request is made during a normal
  // PPTX export attempt.
  test("A: PPTX_USE_VENDOR is true by default — no CDN URL used as active load path", async ({
    page,
  }) => {
    // Confirm PPTX_USE_VENDOR === true in the shell's JS scope.
    const useVendor = await evaluateEditor(
      page,
      "typeof PPTX_USE_VENDOR !== 'undefined' && PPTX_USE_VENDOR === true",
    );
    expect(useVendor, "PPTX_USE_VENDOR should be true (vendor path enabled)").toBe(true);

    // Confirm the active load URL resolves to the vendor path (not CDN).
    const activeLoadUrl = await evaluateEditor(
      page,
      "PPTX_USE_VENDOR ? PPTX_VENDOR_PATH : PPTX_CDN_URL",
    );
    expect(
      activeLoadUrl,
      "Active load path must be the vendor-local path",
    ).toBe("vendor/pptxgenjs/pptxgen.bundled.min.js");

    // Confirm the active load URL does NOT start with http or https (no network).
    expect(
      activeLoadUrl,
      "Vendor path must not be an external URL (no http/https prefix)",
    ).not.toMatch(/^https?:\/\//);
  });

  // ── Scenario B ──────────────────────────────────────────────────────────────
  // When CDN path is opted into, the <script> element MUST have integrity +
  // crossorigin attributes set (OWASP A08:2021 — SRI enforcement).
  test("B: CDN path attaches integrity + crossorigin on <script> element", async ({
    page,
  }) => {
    // 1. Confirm CDN URL is pinned to a specific version (not unpinned /latest).
    const cdnUrl = await evaluateEditor(page, "PPTX_CDN_URL");
    expect(cdnUrl, "CDN URL must be set").toBeTruthy();
    expect(
      cdnUrl,
      "CDN URL must pin an explicit version (e.g. @3.12.0), not use /latest or an unpinned path",
    ).toMatch(/@\d+\.\d+\.\d+/);

    // 2. Confirm SRI hash is set and is a sha384 value.
    const sri = await evaluateEditor(page, "PPTX_SRI");
    expect(sri, "PPTX_SRI must be defined").toBeTruthy();
    expect(
      sri,
      "PPTX_SRI must be a sha384 integrity value",
    ).toMatch(/^sha384-[A-Za-z0-9+/]+=*$/);

    // 3. Inject a CDN-style pptxLoadScript call with a dummy URL + SRI and
    //    intercept the created <script> element BEFORE it appends to head,
    //    so we can check its attributes without triggering a real network request.
    const attrs = await evaluateEditor(
      page,
      `(function () {
        var capturedIntegrity = null;
        var capturedCrossOrigin = null;

        // Shadow document.head.appendChild to capture script attrs.
        var origAppendChild = document.head.appendChild.bind(document.head);
        document.head.appendChild = function (el) {
          if (el.tagName === "SCRIPT") {
            capturedIntegrity = el.integrity || null;
            capturedCrossOrigin = el.crossOrigin || null;
            // Do NOT actually append — we are testing attribute assignment only.
            // Restore immediately.
            document.head.appendChild = origAppendChild;
          }
          return el;
        };

        // Call pptxLoadScript with a fake URL + the real SRI value.
        // The promise will reject (no real network) but that's fine — we only
        // care that attributes were set before appendChild was called.
        try {
          pptxLoadScript("https://example.com/fake.js", PPTX_SRI);
        } catch (_) { /* ignore */ }

        return {
          integrity: capturedIntegrity,
          crossOrigin: capturedCrossOrigin,
        };
      })()`,
    );

    expect(
      attrs.integrity,
      "script.integrity must be set to PPTX_SRI when loading from CDN",
    ).toBeTruthy();
    expect(
      attrs.integrity,
      "script.integrity must start with sha384-",
    ).toMatch(/^sha384-/);

    expect(
      attrs.crossOrigin,
      "script.crossOrigin must be 'anonymous' for CORS + SRI validation",
    ).toBe("anonymous");
  });
});
