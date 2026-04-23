// import-pipeline-v2/complexity.js
// Layer: Smart Import (ADR-035)
// Computes a 0..10 complexity score for a parsed document. Higher = more
// risk during editability normalization / export.
// =====================================================================
"use strict";
(function () {
  "use strict";

  // Risk contributors (cap contributes to score):
  //   Inline <script>                       : up to +2
  //   External scripts                      : up to +1
  //   @import / CDN fonts                   : +1 each, cap +2
  //   CSS transforms / filters              : +1
  //   SVG / canvas heavy usage              : up to +1
  //   iframes inside content                : +1
  //   very large DOM (> 500 nodes)          : +1
  //   deeply nested structure (> 10 levels) : +1
  function computeComplexity(doc) {
    if (!doc) return { score: 0, warnings: [] };
    const warnings = [];
    let score = 0;

    const scripts = Array.from(doc.querySelectorAll("script"));
    const inlineScripts = scripts.filter((s) => !s.src).length;
    const externalScripts = scripts.filter((s) => s.src).length;
    if (inlineScripts > 0) {
      const bonus = Math.min(2, inlineScripts > 5 ? 2 : 1);
      score += bonus;
      warnings.push({
        kind: "inline-script",
        message: `Инлайн-скрипты в документе: ${inlineScripts}. Export их сохранит, но редактор не перезапустит после правки.`,
      });
    }
    if (externalScripts > 0) {
      score += 1;
      warnings.push({
        kind: "external-script",
        message: `Внешние скрипты: ${externalScripts}. Они будут вырезаны из editable полос, но останутся в <head>/<body>.`,
      });
    }

    const styleTags = Array.from(doc.querySelectorAll("style"));
    const hasImports = styleTags.some((s) => /@import/i.test(s.textContent || ""));
    const linkSheets = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    const cdnLinks = linkSheets.filter((l) => {
      const href = l.getAttribute("href") || "";
      return /^(https?:)?\/\//.test(href);
    });
    if (hasImports) {
      score += 1;
      warnings.push({
        kind: "css-import",
        message: "В документе используется @import. Preview может грузиться позже, чем ожидается.",
      });
    }
    if (cdnLinks.length > 0) {
      score += 1;
      warnings.push({
        kind: "cdn-fonts",
        message: `CDN-стили / шрифты: ${cdnLinks.length}. На оффлайн-устройстве шрифты могут отвалиться.`,
      });
    }

    // CSS transforms / filters (inline style probe).
    const transformCount = Array.from(doc.querySelectorAll("[style]"))
      .filter((el) => /transform|filter/i.test(el.getAttribute("style") || ""))
      .length;
    if (transformCount > 0) {
      score += 1;
      warnings.push({
        kind: "transforms",
        message: `${transformCount} элементов используют inline transform/filter. Резайз и move будут заблокированы в честном режиме.`,
      });
    }

    // SVG / canvas heavy usage
    const svgCount = doc.querySelectorAll("svg").length;
    const canvasCount = doc.querySelectorAll("canvas").length;
    if (svgCount > 20 || canvasCount > 0) {
      score += 1;
      warnings.push({
        kind: "vector-media",
        message: `SVG: ${svgCount}, canvas: ${canvasCount}. Export в PPTX для canvas рисует растр, SVG → shape где возможно.`,
      });
    }

    // iframes
    const iframeCount = doc.querySelectorAll("iframe").length;
    if (iframeCount > 0) {
      score += 1;
      warnings.push({
        kind: "iframes",
        message: `Вложенные iframe: ${iframeCount}. Preview их отрендерит, но редактор работает только с внешней DOM.`,
      });
    }

    // Large DOM
    const nodeCount = doc.querySelectorAll("*").length;
    if (nodeCount > 500) {
      score += 1;
      warnings.push({
        kind: "large-dom",
        message: `Большой DOM: ${nodeCount} узлов. Rendering и undo-buffer нагрузка растёт.`,
      });
    }

    // Deep nesting
    let maxDepth = 0;
    const countDepth = (el, d) => {
      if (d > maxDepth) maxDepth = d;
      for (const child of el.children) countDepth(child, d + 1);
    };
    if (doc.body) countDepth(doc.body, 1);
    if (maxDepth > 10) {
      score += 1;
      warnings.push({
        kind: "deep-nesting",
        message: `Глубокая вложенность: ${maxDepth} уровней. Layer-tree может быть сложным.`,
      });
    }

    return {
      score: Math.min(10, Math.round(score * 10) / 10),
      warnings,
      metrics: {
        inlineScripts,
        externalScripts,
        cdnLinks: cdnLinks.length,
        cssImports: hasImports,
        transformCount,
        svgCount,
        canvasCount,
        iframeCount,
        nodeCount,
        maxDepth,
      },
    };
  }

  window.ImportPipelineV2 = window.ImportPipelineV2 || {};
  window.ImportPipelineV2.computeComplexity = computeComplexity;
})();
