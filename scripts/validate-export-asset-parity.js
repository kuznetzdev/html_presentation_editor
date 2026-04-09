const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");
const assert = require("assert");
const { chromium } = require("playwright");

const WORKSPACE_ROOT =
  process.env.WORKSPACE_ROOT ||
  path.resolve(__dirname, "..");

const SERVER_HOST = process.env.STATIC_SERVER_HOST || "127.0.0.1";
const SERVER_PORT = Number(process.env.STATIC_SERVER_PORT || 4173);
const TARGET_URL =
  process.env.TARGET_URL ||
  `http://${SERVER_HOST}:${SERVER_PORT}/editor/presentation-editor-v0.19.3.html`;

const FIXTURE_ROOT = path.resolve(
  WORKSPACE_ROOT,
  "tests",
  "fixtures",
  "export-asset-parity",
);

const MANUAL_BASE_URL =
  process.env.MANUAL_BASE_URL ||
  `http://${SERVER_HOST}:${SERVER_PORT}/tests/fixtures/export-asset-parity/`;

const COMPLEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Asset parity case</title>
    <link rel="stylesheet" href="assets/theme.css" />
    <style>
      .inline-style {
        background-image: url("assets/images/pattern.svg");
      }
    </style>
  </head>
  <body>
    <section class="slide" data-slide-title="Asset parity">
      <img
        src="assets/images/hero.svg"
        srcset="assets/images/hero-1x.png 1x, assets/images/hero-2x.png 2x"
        alt="hero"
      />
      <video controls poster="assets/images/poster.svg">
        <source src="assets/video/clip.mp4" type="video/mp4" />
        <source src="assets/video/clip.webm" type="video/webm" />
      </video>
      <div
        class="inline-style"
        style="background-image: url('assets/images/bg-grid.svg')"
      >
        asset parity
      </div>
    </section>
  </body>
</html>`;

const PLAIN_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Plain case</title>
  </head>
  <body>
    <section class="slide">
      <h1>Plain</h1>
      <p>No external assets here.</p>
    </section>
  </body>
</html>`;

function inferMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    ".css": "text/css",
    ".html": "text/html",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webm": "video/webm",
    ".mp4": "video/mp4",
  };
  return map[ext] || "application/octet-stream";
}

function collectFixturePayloads(rootDir) {
  const payloads = [];
  const visit = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      const relativePath = path
        .relative(rootDir, absolutePath)
        .split(path.sep)
        .join("/");
      payloads.push({
        relativePath,
        name: entry.name,
        type: inferMimeType(absolutePath),
        base64: fs.readFileSync(absolutePath).toString("base64"),
      });
    }
  };
  visit(rootDir);
  return payloads;
}

function waitForHttpReady(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode < 500) {
          resolve();
          return;
        }
        if (Date.now() >= deadline) {
          reject(new Error(`Static server probe failed with status ${response.statusCode || "unknown"}`));
          return;
        }
        setTimeout(probe, 250);
      });
      request.on("error", (error) => {
        if (Date.now() >= deadline) {
          reject(error);
          return;
        }
        setTimeout(probe, 250);
      });
    };
    probe();
  });
}

async function ensureStaticServer() {
  try {
    await waitForHttpReady(TARGET_URL, 2_000);
    return null;
  } catch (_error) {
    const serverScript = path.join(WORKSPACE_ROOT, "scripts", "static-server.js");
    const child = spawn(
      process.execPath,
      [serverScript, ".", String(SERVER_PORT), SERVER_HOST],
      {
        cwd: WORKSPACE_ROOT,
        stdio: "pipe",
      },
    );
    try {
      await waitForHttpReady(TARGET_URL, 15_000);
      return child;
    } catch (error) {
      child.kill();
      const stderr = [];
      child.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
      throw new Error(
        `Failed to start static server for asset parity: ${error.message}`,
      );
    }
  }
}

async function waitForPreviewReady(page) {
  try {
    await page.waitForFunction(
      () => {
        const frame = document.getElementById("previewFrame");
        const frameDoc = frame?.contentDocument || null;
        return Boolean(state.modelDoc) &&
          state.previewLifecycle === "ready" &&
          Boolean(state.previewReady) &&
          Boolean(frameDoc) &&
          frameDoc.readyState === "complete";
      },
      undefined,
      { timeout: 20_000 },
    );
  } catch (error) {
    const debugState = await page.evaluate(() => ({
      hasModel: Boolean(state.modelDoc),
      previewLifecycle: state.previewLifecycle,
      previewLifecycleReason: state.previewLifecycleReason,
      previewReady: state.previewReady,
      bridgeAlive: state.bridgeAlive,
      frameSrc: els.previewFrame?.getAttribute("src") || "",
      documentMeta: els.documentMeta?.textContent || "",
    }));
    throw new Error(
      `Preview did not become ready: ${JSON.stringify(debugState)}`,
    );
  }
}

async function loadHtmlCase(page, html, manualBaseUrl = "") {
  await page.evaluate(
    ({ htmlString, baseUrl }) => {
      els.baseUrlInput.value = baseUrl;
      loadHtmlString(htmlString, "asset-parity-case", {
        resetHistory: true,
        dirty: true,
      });
    },
    { htmlString: html, baseUrl: manualBaseUrl },
  );
  await waitForPreviewReady(page);
}

async function clearAssetDirectory(page) {
  await page.evaluate(async () => {
    await setAssetDirectoryFromFiles([]);
  });
  const hasPresentation = await page.evaluate(() => Boolean(state.modelDoc));
  if (hasPresentation) await waitForPreviewReady(page);
}

async function applyFixtureAssetDirectory(page, payloads) {
  await page.evaluate(async (items) => {
    const toBytes = (base64) =>
      Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const files = items.map((item) => {
      const file = new File([toBytes(item.base64)], item.name, {
        type: item.type || "application/octet-stream",
      });
      Object.defineProperty(file, "webkitRelativePath", {
        configurable: true,
        value: item.relativePath,
      });
      return file;
    });
    await setAssetDirectoryFromFiles(files);
  }, payloads);
  await waitForPreviewReady(page);
}

async function collectCaseSnapshot(page) {
  const hasPresentation = await page.evaluate(() => Boolean(state.modelDoc));
  if (hasPresentation) await waitForPreviewReady(page);
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
      doc.querySelectorAll("[src], [href], [poster]").forEach((el) => {
        ["src", "href", "poster"].forEach((attr) => {
          const value = el.getAttribute(attr);
          if (!value) return;
          if (attr === "href" && el.tagName === "BASE") {
            push("base.href", value);
            return;
          }
          if (el.id === "__presentation_editor_bridge__") return;
          push(`${el.tagName.toLowerCase()}.${attr}`, value);
        });
      });
      doc.querySelectorAll("[srcset]").forEach((el) => {
        push(`${el.tagName.toLowerCase()}.srcset`, el.getAttribute("srcset"));
      });
      doc.querySelectorAll("[style]").forEach((el) => {
        if (el.tagName === "HTML" || el.tagName === "BODY") return;
        push(`${el.tagName.toLowerCase()}.style`, el.getAttribute("style"));
      });
      doc.querySelectorAll("style").forEach((el) => {
        push("style.text", el.textContent || "");
      });
      refs.sort();
      return refs;
    };

    const liveDoc = els.previewFrame.contentDocument;
    const previewPack = buildPreviewPackage();
    const validationPack = buildExportValidationPackage();
    if (!liveDoc || !previewPack || !validationPack) {
      throw new Error(
        `Failed to collect preview/export validation packages. liveDoc=${Boolean(liveDoc)} previewPack=${Boolean(previewPack)} validationPack=${Boolean(validationPack)} previewReady=${Boolean(state.previewReady)} lifecycle=${state.previewLifecycle}`,
      );
    }
    const parser = new DOMParser();
    const previewDoc = parser.parseFromString(previewPack.serialized, "text/html");
    const validationDoc = parser.parseFromString(
      validationPack.serialized,
      "text/html",
    );
    return {
      liveAudit: {
        counts: state.previewAssetAuditCounts,
        resolved: Array.from(state.resolvedPreviewAssets || []),
        unresolved: Array.from(state.unresolvedPreviewAssets || []),
        baseUrlDependent: Array.from(state.baseUrlDependentAssets || []),
      },
      validationAudit: validationPack.assetAudit,
      liveRefs: collectRefs(liveDoc),
      previewRefs: collectRefs(previewDoc),
      validationRefs: collectRefs(validationDoc),
      previewContract: previewPack.contract,
      validationContract: validationPack.contract,
      usesAssetResolver: {
        preview: previewPack.usesAssetResolver,
        validation: validationPack.usesAssetResolver,
      },
    };
  });
}

function assertParitiedRefs(caseName, snapshot) {
  assert.deepStrictEqual(
    snapshot.liveRefs,
    snapshot.validationRefs,
    `${caseName}: live preview refs diverged from validation preview refs`,
  );
  assert.deepStrictEqual(
    snapshot.previewRefs,
    snapshot.validationRefs,
    `${caseName}: buildPreviewPackage refs diverged from validation preview refs`,
  );
}

async function run() {
  const assetPayloads = collectFixturePayloads(FIXTURE_ROOT);
  const staticServer = await ensureStaticServer();
  const browser = await chromium.launch({ headless: false, slowMo: 40 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const results = [];

  try {
    await page.goto(TARGET_URL, { waitUntil: "networkidle" });
    await page.waitForSelector("#baseUrlInput", { state: "attached" });

    await clearAssetDirectory(page);
    await loadHtmlCase(page, PLAIN_HTML, "");
    let snapshot = await collectCaseSnapshot(page);
    assertParitiedRefs("plain-html", snapshot);
    assert.strictEqual(snapshot.liveAudit.counts.resolved, 0, "plain-html resolved");
    assert.strictEqual(snapshot.liveAudit.counts.unresolved, 0, "plain-html unresolved");
    assert.strictEqual(
      snapshot.liveAudit.counts.baseUrlDependent,
      0,
      "plain-html base-url",
    );
    results.push({ case: "plain-html", snapshot });

    await clearAssetDirectory(page);
    await loadHtmlCase(page, COMPLEX_HTML, MANUAL_BASE_URL);
    snapshot = await collectCaseSnapshot(page);
    assertParitiedRefs("manual-base-url", snapshot);
    assert(snapshot.liveAudit.counts.baseUrlDependent > 0, "manual-base-url base-url");
    assert.strictEqual(
      snapshot.liveAudit.counts.unresolved,
      0,
      "manual-base-url unresolved",
    );
    assert.strictEqual(snapshot.liveAudit.counts.resolved, 0, "manual-base-url resolved");
    results.push({ case: "manual-base-url", snapshot });

    await clearAssetDirectory(page);
    await loadHtmlCase(page, COMPLEX_HTML, "");
    snapshot = await collectCaseSnapshot(page);
    assertParitiedRefs("relative-assets-unresolved", snapshot);
    assert(snapshot.liveAudit.counts.unresolved > 0, "relative-assets unresolved");
    results.push({ case: "relative-assets-unresolved", snapshot });

    await clearAssetDirectory(page);
    await loadHtmlCase(page, COMPLEX_HTML, "");
    await applyFixtureAssetDirectory(page, assetPayloads);
    snapshot = await collectCaseSnapshot(page);
    assertParitiedRefs("asset-directory", snapshot);
    assert(snapshot.liveAudit.counts.resolved > 0, "asset-directory resolved");
    assert.strictEqual(snapshot.liveAudit.counts.unresolved, 0, "asset-directory unresolved");
    assert.strictEqual(
      snapshot.liveAudit.counts.baseUrlDependent,
      0,
      "asset-directory base-url",
    );
    assert(
      snapshot.validationRefs.some((entry) => entry.includes("blob:")),
      "asset-directory should rewrite at least one asset to blob:",
    );
    results.push({ case: "asset-directory", snapshot });

    const concise = results.map((result) => ({
      case: result.case,
      counts: result.snapshot.liveAudit.counts,
      usesAssetResolver: result.snapshot.usesAssetResolver,
    }));
    console.log(
      JSON.stringify({ ok: true, targetUrl: TARGET_URL, results: concise }, null, 2),
    );
  } finally {
    await browser.close();
    if (staticServer && !staticServer.killed) {
      staticServer.kill();
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
