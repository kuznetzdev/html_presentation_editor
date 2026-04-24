// deck-health.js
// Layer: UX honesty — surface deck complexity score after import (v1.5.1)
// =====================================================================
// Reads state.importReport (set by import.js after pipeline-v2 runs)
// and renders a small badge in the topbar with the framework + score.
// Click → re-shows the full report modal so the user can inspect details.
// =====================================================================
"use strict";
(function () {
  "use strict";

  function bucketFor(score) {
    if (score == null) return "unknown";
    if (score < 2) return "low";
    if (score < 5) return "medium";
    if (score < 8) return "high";
    return "severe";
  }

  function frameworkLabel(name) {
    var labels = {
      reveal: "Reveal",
      impress: "Impress",
      spectacle: "Spectacle",
      marp: "Marp",
      slidev: "Slidev",
      "mso-pptx": "MSO/PPTX",
      canva: "Canva",
      notion: "Notion",
      generic: "HTML",
    };
    return labels[name] || name;
  }

  function refreshDeckHealthBadge() {
    var badge = document.getElementById("deckHealthBadge");
    if (!badge) return;
    var report = state && state.importReport;
    if (!report || !report.ok) {
      badge.hidden = true;
      badge.textContent = "";
      badge.className = "status-pill deck-health-badge";
      delete badge.dataset.severity;
      return;
    }
    var score = report.complexity ? report.complexity.score : null;
    var bucket = bucketFor(score);
    var detector = report.detector ? report.detector.name : "";
    var slides = report.slides ? report.slides.count : "?";
    var fmt = frameworkLabel(detector) || "HTML";
    badge.textContent = fmt + " · " + slides + " сл. · " + (score == null ? "?" : score) + "/10";
    badge.dataset.severity = bucket;
    badge.title =
      "Deck health: " + bucket +
      " (Smart Import score). Кликни — открыть полный отчёт.";
    badge.hidden = false;
    badge.className = "status-pill deck-health-badge deck-health-badge-" + bucket;
    if (badge.dataset.bound === "true") return;
    badge.dataset.bound = "true";
    badge.style.cursor = "pointer";
    badge.addEventListener("click", function () {
      var current = state && state.importReport;
      if (!current || !current.ok) return;
      if (typeof window.showImportReportModal === "function") {
        window.showImportReportModal(current, {
          onContinue() {},
          onCancel() {},
        });
      }
    });
  }

  window.refreshDeckHealthBadge = refreshDeckHealthBadge;
})();
