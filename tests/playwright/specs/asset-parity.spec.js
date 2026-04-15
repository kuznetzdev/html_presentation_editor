const { test, expect } = require("@playwright/test");
const {
  ASSET_MANUAL_BASE_URL,
  ASSET_PARITY_CASE_PATH,
  BASIC_MANUAL_BASE_URL,
  clickPreview,
  closeCompactShellPanels,
  connectAssetDirectory,
  ensureShellPanelVisible,
  evaluateEditor,
  gotoFreshEditor,
  isChromiumOnlyProject,
  loadBasicDeck,
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

async function collectExportArtifactSnapshot(page) {
  return page.evaluate(() => {
    const pack = globalThis.eval("buildExportValidationPackage()");
    if (!pack?.serialized) {
      throw new Error("Failed to build export validation package.");
    }

    const parser = new DOMParser();
    const validationDoc = parser.parseFromString(pack.serialized, "text/html");
    const residue = [];

    validationDoc.querySelectorAll("[data-editor-ui='true']").forEach((element) => {
      residue.push(`ui:${element.tagName.toLowerCase()}`);
    });

    validationDoc.querySelectorAll("*").forEach((element) => {
      Array.from(element.attributes || []).forEach((attribute) => {
        if (/^data-editor-/.test(attribute.name)) {
          residue.push(`attr:${attribute.name}`);
        }
      });
    });

    validationDoc
      .querySelectorAll(
        "#__presentation_editor_bridge__, #__presentation_editor_helper_styles__, base[data-editor-preview-base], [contenteditable], [spellcheck]",
      )
      .forEach((element) => {
        residue.push(`node:${element.tagName.toLowerCase()}`);
      });

    residue.sort();

    return {
      diagnostics: (globalThis.eval("state.diagnostics || []") || []).join("\n"),
      residue,
      validationAudit: pack.assetAudit,
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

  test("interaction-heavy shell states stay out of export validation output @stage-a", async (
    { page },
    testInfo,
  ) => {
    test.skip(!isChromiumOnlyProject(testInfo.project.name), "Chromium-only export integrity assertion.");

    await loadBasicDeck(page, {
      manualBaseUrl: BASIC_MANUAL_BASE_URL,
      mode: "edit",
    });

    await closeCompactShellPanels(page);
    await clickPreview(page, "#hero-title");
    await expect(page.locator("#floatingToolbar")).toBeVisible();

    await page.locator("#selectionFrameHitArea").click({ button: "right" });
    await expect(page.locator("#contextMenu")).toBeVisible();
    await expect(page.locator("#floatingToolbar")).toBeHidden();

    await page.mouse.click(12, 12);
    await expect(page.locator("#contextMenu")).toBeHidden();
    await expect(page.locator("#floatingToolbar")).toBeVisible();

    await evaluateEditor(
      page,
      `(() => {
        const node = getSelectedModelNode();
        if (!(node instanceof HTMLElement)) throw new Error("selection-missing");
        node.setAttribute("hidden", "");
        updateInspectorFromSelection();
      })()`,
    );
    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `Boolean(
              !document.getElementById("blockReasonBanner")?.hidden &&
              (document.getElementById("blockReasonText")?.textContent || "").trim().length
            )`,
          ),
        { timeout: 6000 },
      )
      .toBe(true);
    await ensureShellPanelVisible(page, "inspector");
    await page.locator("#blockReasonActionBtn").scrollIntoViewIfNeeded();
    await expect(page.locator("#blockReasonActionBtn")).toBeVisible();
    await page.locator("#blockReasonActionBtn").click();
    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `Boolean(document.getElementById("blockReasonBanner")?.hidden)`,
          ),
        { timeout: 6000 },
      )
      .toBe(true);

    await evaluateEditor(
      page,
      `(() => {
        const node = getSelectedModelNode();
        if (!(node instanceof HTMLElement)) throw new Error("selection-missing");
        node.setAttribute("data-editor-locked", "true");
        updateInspectorFromSelection();
      })()`,
    );
    await expect
      .poll(
        () =>
          evaluateEditor(
            page,
            `Boolean(
              !document.getElementById("blockReasonBanner")?.hidden &&
              (document.getElementById("blockReasonText")?.textContent || "").trim().length
            )`,
          ),
        { timeout: 6000 },
      )
      .toBe(true);

    const popup = await openExportValidationPopup(page);
    await expect(popup.locator("body")).toContainText("Stable editing baseline");
    await popup.close();

    const snapshot = await collectExportArtifactSnapshot(page);
    expect(snapshot.residue).toEqual([]);
    expect(snapshot.validationAudit?.counts?.unresolved || 0).toBe(0);
    expect(snapshot.diagnostics).not.toContain("export-cleanup-residue:");
  });
});
