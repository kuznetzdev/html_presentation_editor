// autosave-cap.spec.js
// Security gate: autosave size cap + light-snapshot fallback (AUDIT-D-05, WO-04)
// Verifies three size tiers:
//   AC1 — Normal save (~1 MB): no warn toast, no light-tag in stored data.
//   AC2 — Warn-tier save (>3 MB): warn toast appears, payload stored normally.
//   AC3 — Oversize save with inline data-URI (>6 MB): stored payload tagged
//          as light-v1, heavy URI replaced with '[data-uri-stripped]'.
//
// All scenarios run on chromium-desktop only (sessionStorage behaviour is
// engine-agnostic but the editor toast mechanism is tested on one engine).

const { test, expect } = require("@playwright/test");
const {
  BASIC_MANUAL_BASE_URL,
  evaluateEditor,
  loadBasicDeck,
  isChromiumOnlyProject,
} = require("../helpers/editorApp");

// ─── Constants (mirror of constants.js — must stay in sync) ────────────────
const AUTOSAVE_WARN_BYTES = 3 * 1024 * 1024; // 3 MB
const AUTOSAVE_FAIL_BYTES = 6 * 1024 * 1024; // 6 MB
const AUTOSAVE_LIGHT_TAG  = 'light-v1';
const STORAGE_KEY         = 'presentation-editor:autosave:v3';

// ─── Helper: call saveProjectToLocalStorage directly via eval ───────────────
async function triggerAutosave(page) {
  return evaluateEditor(
    page,
    `(() => {
      if (typeof saveProjectToLocalStorage === "function") {
        saveProjectToLocalStorage();
        return true;
      }
      return false;
    })()`,
  );
}

// ─── Helper: read the raw stored autosave string ────────────────────────────
async function readStoredRaw(page) {
  return evaluateEditor(
    page,
    `(() => {
      return sessionStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || "";
    })()`,
  );
}

// ─── Helper: read the parsed autosave payload ───────────────────────────────
async function readStoredPayload(page) {
  return evaluateEditor(
    page,
    `(() => {
      const raw = sessionStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    })()`,
  );
}

// ─── Helper: collect all toast messages visible in the shell ────────────────
async function collectToastMessages(page) {
  return page.evaluate(() => {
    const container = document.getElementById("toastContainer");
    if (!container) return [];
    return Array.from(container.querySelectorAll(".toast")).map((t) =>
      t.textContent?.trim() || "",
    );
  });
}

// ─── Helper: wait for a toast containing the given substring ────────────────
async function waitForToastContaining(page, substring, timeoutMs = 5000) {
  await expect
    .poll(
      async () => {
        const messages = await collectToastMessages(page);
        return messages.some((m) => m.includes(substring));
      },
      { timeout: timeoutMs, message: `Expected toast containing: "${substring}"` },
    )
    .toBe(true);
}

// ─── Helper: inject a synthetic payload into modelDoc.html and state ────────
// Replaces the serialized HTML in state so saveProjectToLocalStorage picks
// it up on the next call.  Implemented by temporarily overriding
// serializeCurrentProject to return the desired string.
//
// When includeDataUri=true, the heavy URI makes up ~5 MB of the total so that
// after stripHeavyDataUris the light payload is ~(targetBytes - 5 MB) and will
// fit comfortably inside the browser's sessionStorage quota.  This exercises
// the exact code path where the fail-tier strips images and writes the light
// snapshot successfully (the interesting path for AC3).
async function injectSerializedPayloadSize(page, targetBytes, includeDataUri) {
  return evaluateEditor(
    page,
    `(() => {
      const targetBytes = ${targetBytes};
      const includeDataUri = ${includeDataUri ? 'true' : 'false'};

      const prefix = '<html><body>';
      const suffix = '</body></html>';

      let filler;
      if (includeDataUri) {
        // The data-URI payload is 5 MB of base64 'A' characters, which is
        // well above the 1024-char stripHeavyDataUris threshold.
        // After stripping the URI the remaining HTML is only ~(targetBytes
        // - 5 MB), which fits inside the 5–10 MB sessionStorage quota.
        const uriBytes = 5 * 1024 * 1024;  // 5 MB URI content
        const uriPayload = 'A'.repeat(uriBytes);
        const uri = 'data:image/png;base64,' + uriPayload;
        const imgTag = '<img src="' + uri + '">';
        // Fill remaining bytes with cheap HTML comment content.
        const overhead = prefix.length + suffix.length + imgTag.length;
        const remaining = Math.max(0, targetBytes - overhead);
        filler = imgTag + (remaining > 9 ? '<!-- ' + 'x'.repeat(remaining - 9) + ' -->' : '');
      } else {
        const overhead = prefix.length + suffix.length;
        const remaining = Math.max(0, targetBytes - overhead);
        filler = remaining > 9 ? '<!-- ' + 'x'.repeat(remaining - 9) + ' -->' : '';
      }

      const syntheticHtml = prefix + filler + suffix;

      const origSerializer = typeof serializeCurrentProject === "function"
        ? serializeCurrentProject
        : null;
      if (!origSerializer) return false;

      window.__savedOrigSerializer = origSerializer;
      window.serializeCurrentProject = function syntheticSerializer() {
        window.serializeCurrentProject = window.__savedOrigSerializer;
        return syntheticHtml;
      };

      return true;
    })()`,
  );
}

test.describe("autosave-cap: size tiers + light-snapshot fallback @security", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !isChromiumOnlyProject(testInfo.project.name),
      "Chromium-only autosave behaviour.",
    );
    await loadBasicDeck(page, { manualBaseUrl: BASIC_MANUAL_BASE_URL, mode: "edit" });
  });

  // ── Test AC1 ─────────────────────────────────────────────────────────────
  // A normal save (~1 MB, well below AUTOSAVE_WARN_BYTES) must:
  //   - write the payload successfully;
  //   - NOT include autosaveTag in the stored payload;
  //   - NOT surface a warn/error toast.
  // Closes AUDIT-D-05 (CWE-770).
  test("AC1 — normal 1 MB save: no warn toast, no light-tag in stored data", async ({ page }) => {
    // Inject a ~1 MB serializer override.
    const injected = await injectSerializedPayloadSize(page, 1 * 1024 * 1024, false);
    expect(injected).toBe(true);

    await triggerAutosave(page);

    // Allow one frame for the storage write to complete.
    await page.waitForTimeout(200);

    const payload = await readStoredPayload(page);
    expect(payload).not.toBeNull();
    expect(typeof payload.html).toBe("string");

    // No light-tag — this was a normal save.
    expect(payload.autosaveTag).toBeUndefined();

    // No warn toast should have appeared.
    const toasts = await collectToastMessages(page);
    const warnToastPresent = toasts.some(
      (m) => m.includes("хранилища") || m.includes("пропущены") || m.includes("переполнено"),
    );
    expect(warnToastPresent).toBe(false);
  });

  // ── Test AC2 ─────────────────────────────────────────────────────────────
  // A warn-tier save (>AUTOSAVE_WARN_BYTES = 3 MB, but below AUTOSAVE_FAIL_BYTES)
  // must:
  //   - write the payload successfully;
  //   - surface a warning toast containing the exact Russian warn copy.
  // Closes AUDIT-D-05 (CWE-770): user is never silently surprised.
  test("AC2 — 4 MB save above warn threshold: warn toast appears", async ({ page }) => {
    // 4 MB — above AUTOSAVE_WARN_BYTES (3 MB), below AUTOSAVE_FAIL_BYTES (6 MB).
    const injected = await injectSerializedPayloadSize(page, 4 * 1024 * 1024, false);
    expect(injected).toBe(true);

    await triggerAutosave(page);

    // Wait for the warning toast with the exact Russian copy.
    await waitForToastContaining(page, "близко к лимиту хранилища", 6000);

    // The payload must still be stored (the write succeeds in the warn tier).
    const payload = await readStoredPayload(page);
    expect(payload).not.toBeNull();
    expect(typeof payload.html).toBe("string");
  });

  // ── Test AC3 ─────────────────────────────────────────────────────────────
  // An oversize save (>AUTOSAVE_FAIL_BYTES = 6 MB) that includes a heavy inline
  // data-URI must:
  //   - strip the URI in the stored payload (replaced by '[data-uri-stripped]');
  //   - tag the stored payload with autosaveTag = 'light-v1';
  //   - surface a warning toast about images being skipped.
  // Closes AUDIT-D-05 (CWE-770): structural draft preserved; images stripped.
  test("AC3 — oversize payload with inline data-URI: light-tag set, heavy URI stripped", async ({ page }) => {
    // 7 MB payload with an embedded data:image/png;base64,<2000 chars> URI.
    const injected = await injectSerializedPayloadSize(page, 7 * 1024 * 1024, true);
    expect(injected).toBe(true);

    await triggerAutosave(page);

    // Wait for the light-snapshot toast.
    await waitForToastContaining(page, "изображения временно пропущены", 6000);

    const payload = await readStoredPayload(page);
    expect(payload).not.toBeNull();

    // Must be tagged as a light snapshot.
    expect(payload.autosaveTag).toBe(AUTOSAVE_LIGHT_TAG);

    // The stored HTML must not contain any un-stripped data:image URI longer
    // than 1024 chars — verify by checking the sentinel string is present.
    expect(typeof payload.html).toBe("string");
    expect(payload.html).toContain("[data-uri-stripped]");

    // The original long data-URI must not appear verbatim.
    const longUriPattern = /data:image\/[^;,\s"']{0,64};base64,[A-Za-z0-9+/=]{1025,}/;
    expect(longUriPattern.test(payload.html)).toBe(false);
  });
});
