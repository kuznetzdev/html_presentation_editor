// import-pipeline-v2/detectors.js
// Layer: Smart Import (ADR-035)
// 8 framework detectors + generic fallback. Each detector returns a
// confidence score 0..1 based on DOM fingerprints in a parsed document.
// The orchestrator picks the highest-confidence hit.
// =====================================================================
"use strict";
(function () {
  "use strict";

  // Each detector: ({ doc }) => { name, confidence, signals[] }
  // `confidence` is a heuristic score. Multiple true signals → higher score.

  function scoreSignals(signals) {
    const hits = signals.filter(Boolean).length;
    if (hits === 0) return 0;
    // Saturating curve: 1 hit = 0.35, 2 = 0.6, 3 = 0.78, 4+ ≈ 0.9+.
    return Math.min(0.98, 0.35 * hits + 0.05 * Math.max(0, hits - 1));
  }

  function detectReveal({ doc }) {
    const signals = [
      !!doc.querySelector(".reveal"),
      !!doc.querySelector(".reveal .slides"),
      !!doc.querySelector('section[data-markdown], section[data-background], section[data-background-color]'),
      Boolean(
        doc.querySelector('link[href*="reveal"]') ||
          doc.querySelector('script[src*="reveal"]'),
      ),
    ];
    return {
      name: "reveal",
      confidence: scoreSignals(signals),
      signals,
    };
  }

  function detectImpress({ doc }) {
    const signals = [
      !!doc.getElementById("impress"),
      !!doc.querySelector(".step[data-x], .step[data-y]"),
      Boolean(doc.querySelector('script[src*="impress"]')),
    ];
    return { name: "impress", confidence: scoreSignals(signals), signals };
  }

  function detectSpectacle({ doc }) {
    // Spectacle typically leaves a React-root; look for its hallmark classes.
    const signals = [
      !!doc.querySelector("[class*='css-'][class*='Slide']"),
      !!doc.querySelector("[data-spectacle]"),
      !!doc.querySelector("#root[data-slide-count]"),
    ];
    return { name: "spectacle", confidence: scoreSignals(signals), signals };
  }

  function detectMarp({ doc }) {
    const signals = [
      !!doc.querySelector('section[data-marpit-slide], section.marp'),
      !!doc.querySelector("meta[name='marp']"),
      Boolean(doc.querySelector('link[href*="marpit"]')),
    ];
    return { name: "marp", confidence: scoreSignals(signals), signals };
  }

  function detectSlidev({ doc }) {
    const signals = [
      !!doc.querySelector("#slidev-app, [class*='slidev-']"),
      !!doc.querySelector("div[data-slidev-slide-no]"),
      Boolean(doc.querySelector('script[src*="slidev"]')),
    ];
    return { name: "slidev", confidence: scoreSignals(signals), signals };
  }

  function detectMsoPptx({ doc }) {
    // Office's "Save As Web Page" leaves MSO-specific comments / classes.
    const html = doc.documentElement?.innerHTML || "";
    const signals = [
      /<!--\[if gte mso\b/i.test(html),
      !!doc.querySelector("[class*='MsoNormal'], [class*='MsoSlide']"),
      !!doc.querySelector("meta[name='GENERATOR'][content*='Microsoft']"),
      !!doc.querySelector("v\\:shape, o\\:Shape"),
    ];
    return { name: "mso-pptx", confidence: scoreSignals(signals), signals };
  }

  function detectCanva({ doc }) {
    const html = doc.documentElement?.innerHTML || "";
    const signals = [
      /canva\.com/i.test(html),
      !!doc.querySelector("[class*='CanvaDesign']"),
      !!doc.querySelector("meta[property='og:site_name'][content*='Canva']"),
    ];
    return { name: "canva", confidence: scoreSignals(signals), signals };
  }

  function detectNotion({ doc }) {
    const html = doc.documentElement?.innerHTML || "";
    const signals = [
      /notion\.so/i.test(html) || /notion\.site/i.test(html),
      !!doc.querySelector("[class*='notion-']"),
      !!doc.querySelector("[data-block-id]"),
    ];
    return { name: "notion", confidence: scoreSignals(signals), signals };
  }

  // Generic — always matches; very low confidence so it only wins when
  // everyone else scored 0.
  function detectGeneric({ doc }) {
    const signals = [
      !!doc.body,
      Boolean(doc.querySelector("section, article, main, .slide, [class*='slide']")),
    ];
    const confidence = signals.every(Boolean) ? 0.1 : 0.05;
    return { name: "generic", confidence, signals };
  }

  const DETECTORS = [
    detectReveal,
    detectImpress,
    detectSpectacle,
    detectMarp,
    detectSlidev,
    detectMsoPptx,
    detectCanva,
    detectNotion,
    detectGeneric,
  ];

  function runDetectors(doc) {
    const ctx = { doc };
    const results = DETECTORS.map((fn) => fn(ctx));
    results.sort((a, b) => b.confidence - a.confidence);
    return results;
  }

  window.ImportPipelineV2 = window.ImportPipelineV2 || {};
  window.ImportPipelineV2.runDetectors = runDetectors;
  window.ImportPipelineV2.DETECTORS = DETECTORS;
})();
