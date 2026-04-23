// import-pipeline-v2/index.js
// Layer: Smart Import (ADR-035)
// Orchestrator: parses an HTML string, runs detectors + inference + complexity,
// and returns a preprocessing report.
//
// Usage (typical wiring):
//   const report = runImportPipelineV2(htmlString);
//   // surface report via import-report-modal.js, then pass through
//   // to the existing load path.
// =====================================================================
"use strict";
(function () {
  "use strict";

  // Parse an HTML string into a sandboxed Document (no script execution).
  function parseHtml(htmlString) {
    try {
      const parser = new DOMParser();
      return parser.parseFromString(String(htmlString || ""), "text/html");
    } catch (error) {
      return null;
    }
  }

  function runImportPipelineV2(htmlString) {
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const doc = parseHtml(htmlString);
    // DOMParser returns a Document with empty html/head/body for empty input;
    // treat documents with no meaningful content as unparseable input.
    const hasContent =
      Boolean(doc?.body) &&
      (doc.body.children.length > 0 || (doc.body.textContent || "").trim().length > 0);
    if (!doc || !hasContent) {
      return {
        ok: false,
        reason: "parse-failed",
        elapsedMs: 0,
      };
    }

    const detectors = window.ImportPipelineV2?.runDetectors?.(doc) || [];
    const winner = detectors[0] || { name: "generic", confidence: 0 };
    const inference = window.ImportPipelineV2?.inferSlides?.(doc, winner.name) || {
      strategy: "single",
      count: doc.body ? 1 : 0,
    };
    const complexity = window.ImportPipelineV2?.computeComplexity?.(doc) || {
      score: 0,
      warnings: [],
    };

    const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();

    return {
      ok: true,
      elapsedMs: Math.max(0, Math.round(t1 - t0)),
      detector: {
        name: winner.name,
        confidence: winner.confidence,
        runnerUps: detectors
          .slice(1, 4)
          .map((r) => ({ name: r.name, confidence: r.confidence })),
      },
      slides: {
        strategy: inference.strategy,
        count: inference.count || 0,
      },
      complexity: {
        score: complexity.score,
        warnings: complexity.warnings || [],
        metrics: complexity.metrics || {},
      },
      doc,
    };
  }

  window.ImportPipelineV2 = window.ImportPipelineV2 || {};
  window.ImportPipelineV2.run = runImportPipelineV2;
  window.runImportPipelineV2 = runImportPipelineV2;
})();
