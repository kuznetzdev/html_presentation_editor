const { test, expect } = require("@playwright/test");
const {
  ASSET_MANUAL_BASE_URL,
  ASSET_PARITY_CASE_PATH,
  BASIC_MANUAL_BASE_URL,
  connectAssetDirectory,
  evaluateEditor,
  gotoFreshEditor,
  isChromiumOnlyProject,
  openExportValidationPopup,
  openHtmlFixture,
} = require("../helpers/editorApp");

async function collectParitySnapshot(page) {
  return page.evaluate(() => {
    const normalizeText = (value) =>
      String(value || "")
        .replace(/\s+/g, " ")
        .trim();

    const collectRefs = (doc) => {
      const refs = [];
      const push = (label, value) => {
        const normalized = normalizeText(value);
        if (!normalized) return;
        refs.push(`${label}=${normalized}`);
      };

      doc.querySelectorAll("[src], [href], [poster]").forEach((element) => {
        ["src", "href", "poster"].forEach((attribute) => {
          const value = element.getAttribute(attribute);
          if (!value) return;
          if (attribute === "href" && element.tagName === "BASE") {
            push("base.href", value);
            return;
          }
          if (element.id === "__presentation_editor_bridge__") return;
          push(`${element.tagName.toLowerCase()}.${attribute}`, value);
        });
      });

      doc.querySelectorAll("[srcset]").forEach((element) => {
        push(`${element.tagName.toLowerCase()}.srcset`, element.getAttribute("srcset"));
      });

      doc.querySelectorAll("[style]").forEach((element) => {
        if (element.tagName === "HTML" || element.tagName === "BODY") return;
        push(`${element.tagName.toLowerCase()}.style`, element.getAttribute("style"));
      });

      doc.querySelectorAll("style").forEach((element) => {
        push("style.text", element.textContent || "");
      });

      refs.sort();
      return refs;
    };

    const previewFrame = document.getElementById("previewFrame");
    const liveDoc = previewFrame?.contentDocument || null;
    const previewPack = globalThis.eval("buildPreviewPackage()");
    const validationPack = globalThis.eval("buildExportValidationPackage()");
    if (!liveDoc || !previewPack || !validationPack) {
      throw new Error("Failed to collect preview/export validation packages.");
    }

    const parser = new DOMParser();
    const previewDoc = parser.parseFromString(previewPack.serialized, "text/html");
    const validationDoc = parser.parseFromString(
      validationPack.serialized,
      "text/html",
    );

    return {
      liveRefs: collectRefs(liveDoc),
      previewRefs: collectRefs(previewDoc),
      validationRefs: collectRefs(validationDoc),
      previewContract: previewPack.contract,
      previewUsesResolver: previewPack.usesAssetResolver,
      validationAudit: validationPack.assetAudit,
      validationContract: validationPack.contract,
      validationUsesResolver: validationPack.usesAssetResolver,
    };
  });
}

test.describe("Asset parity regression", () => {
  test("manual base url keeps preview and export validation aligned @stage-a", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only parity assertion.");

    await gotoFreshEditor(page);
    await openHtmlFixture(page, ASSET_PARITY_CASE_PATH, {
      manualBaseUrl: ASSET_MANUAL_BASE_URL,
    });

    const snapshot = await collectParitySnapshot(page);
    expect(snapshot.liveRefs).toEqual(snapshot.validationRefs);
    expect(snapshot.previewRefs).toEqual(snapshot.validationRefs);
    expect(snapshot.previewContract?.manualBaseUrl || "").toBe(ASSET_MANUAL_BASE_URL);
    expect(snapshot.validationContract?.manualBaseUrl || "").toBe(
      ASSET_MANUAL_BASE_URL,
    );

    const popup = await openExportValidationPopup(page);
    await expect(popup.locator("body")).toContainText("asset parity");
    await popup.close();
  });

  test("relative assets with connected directory stay truthful in diagnostics @stage-d", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only diagnostics assertion.");
    test.skip(true, "Enable during stage D diagnostics hardening.");

    await gotoFreshEditor(page);
    await openHtmlFixture(page, ASSET_PARITY_CASE_PATH, {
      manualBaseUrl: BASIC_MANUAL_BASE_URL,
    });
    await connectAssetDirectory(page);

    const diagnostics = await evaluateEditor(
      page,
      `document.getElementById("diagnosticsBox")?.innerText || ""`,
    );
    expect(diagnostics).toMatch(/baseUrlDependent|resolved|unresolved/);
    expect(diagnostics).not.toContain("unresolved=0 baseUrlDependent=0 resolved=0");
  });
});
