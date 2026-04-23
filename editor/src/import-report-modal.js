// import-report-modal.js
// Layer: Smart Import UI (ADR-035 + V2-05)
// Shows the preprocessing report produced by import-pipeline-v2, then calls
// a continuation callback. User can either accept and continue, or cancel
// (abort the load entirely). Rendered lazily: the modal DOM is only
// created on first show.
// =====================================================================
"use strict";
(function () {
  "use strict";

  function frameworkLabel(name) {
    const labels = {
      reveal: "Reveal.js",
      impress: "Impress.js",
      spectacle: "Spectacle",
      marp: "Marp",
      slidev: "Slidev",
      "mso-pptx": "MS Office / PPTX export",
      canva: "Canva (static export)",
      notion: "Notion (export)",
      generic: "Generic HTML",
    };
    return labels[name] || name;
  }

  function strategyLabel(name) {
    const labels = {
      explicit: "explicit markers (<section>)",
      "h1-split": "split by top-level <h1>",
      viewport: "viewport sections (100vh)",
      "page-break": "page-break directives",
      single: "single-slide wrap",
    };
    return labels[name] || name;
  }

  function complexityBucket(score) {
    if (score < 2) return "low";
    if (score < 5) return "medium";
    if (score < 8) return "high";
    return "severe";
  }

  function ensureModalRoot() {
    let modal = document.getElementById("importReportModal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "importReportModal";
    modal.className = "modal import-report-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "importReportModalTitle");
    modal.setAttribute("tabindex", "-1");
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 id="importReportModalTitle">Импорт-отчёт</h3>
          <button type="button" class="modal-close-btn" data-import-report-close aria-label="Закрыть">✕</button>
        </div>
        <div class="modal-body import-report-body"></div>
        <div class="modal-footer import-report-footer"></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function renderWarningList(warnings) {
    if (!warnings.length) {
      return `<p class="import-report-noop">Предупреждений нет.</p>`;
    }
    const items = warnings
      .map(
        (w) =>
          `<li class="import-report-warning"><span class="chip chip-${w.kind}">${w.kind}</span>${escapeText(w.message)}</li>`,
      )
      .join("");
    return `<ul class="import-report-warning-list">${items}</ul>`;
  }

  function escapeText(value) {
    return String(value || "").replace(/[&<>"']/g, (ch) =>
      ch === "&"
        ? "&amp;"
        : ch === "<"
          ? "&lt;"
          : ch === ">"
            ? "&gt;"
            : ch === '"'
              ? "&quot;"
              : "&#39;",
    );
  }

  function showImportReportModal(report, { onContinue, onCancel } = {}) {
    if (!report || !report.ok) {
      if (typeof onCancel === "function") onCancel();
      return null;
    }
    const modal = ensureModalRoot();
    const body = modal.querySelector(".import-report-body");
    const footer = modal.querySelector(".import-report-footer");
    if (!body || !footer) return null;
    const confidencePct = Math.round((report.detector.confidence || 0) * 100);
    const bucket = complexityBucket(report.complexity.score);
    body.innerHTML = `
      <dl class="import-report-summary">
        <div>
          <dt>Формат</dt>
          <dd>${escapeText(frameworkLabel(report.detector.name))} <span class="import-report-confidence">(${confidencePct}%)</span></dd>
        </div>
        <div>
          <dt>Слайдов</dt>
          <dd>${report.slides.count} <span class="import-report-muted">(${escapeText(strategyLabel(report.slides.strategy))})</span></dd>
        </div>
        <div>
          <dt>Сложность</dt>
          <dd class="import-report-complexity import-report-complexity-${bucket}">${report.complexity.score}/10</dd>
        </div>
        <div>
          <dt>Время обработки</dt>
          <dd>${report.elapsedMs} ms</dd>
        </div>
      </dl>
      <h4 class="import-report-section-title">Предупреждения</h4>
      ${renderWarningList(report.complexity.warnings || [])}
    `;
    footer.innerHTML = `
      <button type="button" class="ghost-btn" data-import-report-cancel>Отмена</button>
      <button type="button" class="primary-btn" data-import-report-continue>Продолжить</button>
    `;
    const close = (action) => {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      modal.removeEventListener("click", clickHandler);
      document.removeEventListener("keydown", keyHandler);
      if (action === "continue" && typeof onContinue === "function") onContinue();
      if (action === "cancel" && typeof onCancel === "function") onCancel();
    };
    const clickHandler = (event) => {
      if (event.target?.closest?.("[data-import-report-continue]")) close("continue");
      else if (event.target?.closest?.("[data-import-report-cancel]")) close("cancel");
      else if (event.target?.closest?.("[data-import-report-close]")) close("cancel");
      else if (event.target === modal) close("cancel");
    };
    const keyHandler = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close("cancel");
      } else if (event.key === "Enter" && event.ctrlKey) {
        event.preventDefault();
        close("continue");
      }
    };
    modal.addEventListener("click", clickHandler);
    document.addEventListener("keydown", keyHandler);
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    modal.focus({ preventScroll: true });
    window.requestAnimationFrame(() => {
      const continueBtn = footer.querySelector("[data-import-report-continue]");
      continueBtn?.focus({ preventScroll: true });
    });
    return { close };
  }

  window.showImportReportModal = showImportReportModal;
})();
