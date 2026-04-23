// import-pipeline-v2/inference.js
// Layer: Smart Import (ADR-035)
// Slide inference strategies: determine how the input HTML is segmented
// into slides. Tried in order; first match wins.
//   1. explicit  — explicit markers (section[data-slide-id], .reveal section,
//                   .step, [data-marpit-slide], etc.)
//   2. h1-split  — split by top-level <h1> headings
//   3. viewport  — split by full-viewport sections (rare)
//   4. page-break — split by `break-before:page` or `<hr class="page-break">`
// Fallback: single-slide wrapping the entire body.
// =====================================================================
"use strict";
(function () {
  "use strict";

  const STRATEGIES = [
    {
      name: "explicit",
      probe(doc, framework) {
        if (framework === "reveal") {
          const sections = doc.querySelectorAll(".reveal .slides > section");
          return sections.length >= 1 ? Array.from(sections) : null;
        }
        if (framework === "impress") {
          const steps = doc.querySelectorAll("#impress .step");
          return steps.length >= 1 ? Array.from(steps) : null;
        }
        if (framework === "marp") {
          const slides = doc.querySelectorAll("section[data-marpit-slide], section.marp");
          return slides.length >= 1 ? Array.from(slides) : null;
        }
        if (framework === "slidev") {
          const slides = doc.querySelectorAll("[data-slidev-slide-no]");
          return slides.length >= 1 ? Array.from(slides) : null;
        }
        // Generic explicit markers.
        const marked = doc.querySelectorAll(
          "section[data-slide-id], section[data-slide], section.slide, article.slide",
        );
        return marked.length >= 1 ? Array.from(marked) : null;
      },
    },
    {
      name: "h1-split",
      probe(doc) {
        const h1List = Array.from(doc.querySelectorAll("body h1"));
        if (h1List.length < 2) return null;
        // Group siblings after each h1 into a virtual slide boundary list.
        // The actual rewriting happens in normalize.js; here we just return
        // the h1 anchors so the caller knows which boundaries to use.
        return h1List;
      },
    },
    {
      name: "viewport",
      probe(doc) {
        // Full-viewport sections (height 100vh). Heuristic: inline style or
        // common class names.
        const candidates = doc.querySelectorAll(
          "section[style*='100vh'], div[style*='100vh'], .fullscreen-slide, .vh-100",
        );
        return candidates.length >= 2 ? Array.from(candidates) : null;
      },
    },
    {
      name: "page-break",
      probe(doc) {
        const breaks = doc.querySelectorAll(
          "hr.page-break, hr[style*='page-break'], [style*='break-before'], [style*='page-break-before']",
        );
        return breaks.length >= 1 ? Array.from(breaks) : null;
      },
    },
  ];

  // Returns { strategy, boundaries, elements }.
  //   strategy    — which rule won.
  //   boundaries  — the matched anchor nodes (for h1-split / page-break).
  //   elements    — the actual slide root elements (for explicit / viewport);
  //                 null when the caller still has to synthesize them.
  function inferSlides(doc, framework) {
    for (const strategy of STRATEGIES) {
      const hit = strategy.probe(doc, framework);
      if (hit && hit.length) {
        const isElementList =
          strategy.name === "explicit" || strategy.name === "viewport";
        return {
          strategy: strategy.name,
          boundaries: isElementList ? [] : hit,
          elements: isElementList ? hit : [],
          count: hit.length,
        };
      }
    }
    return {
      strategy: "single",
      boundaries: [],
      elements: doc.body ? [doc.body] : [],
      count: doc.body ? 1 : 0,
    };
  }

  window.ImportPipelineV2 = window.ImportPipelineV2 || {};
  window.ImportPipelineV2.inferSlides = inferSlides;
  window.ImportPipelineV2.STRATEGIES = STRATEGIES;
})();
