      // ZONE: Export & Assets
      // exportHtml (clean snapshot), exportPptx (PptxGenJS CDN), presentDeck
      // =====================================================================
      // exportHtml
      // Клонирует modelDoc, очищает editor-artifacts и выгружает готовый HTML-файл.
      // Принцип: в экспорт не должны утечь bridge, служебные атрибуты и helper-CSS.
      function exportHtml() {
        const pack = buildCleanExportPackage();
        if (!pack) return;
        const downloadUrl = URL.createObjectURL(pack.blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = "presentation-edited.html";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => {
          revokeEditorObjectUrl(
            downloadUrl,
            "export-download-url-revoke-failed",
          );
        }, 0);
        state.dirty = false;
        state.lastSavedAt = 0;
        clearAutosave();
        refreshUi();
        showToast(
          `HTML экспортирован. Слайдов: ${pack.slideCount || state.slides.length}. Проверочный preview можно открыть отдельно.`,
          "success",
          {
            title: "Экспорт",
            actionLabel: "Открыть проверку",
            onAction: openExportValidationPreview,
            ttl: 4600,
          },
        );
      }

      // ======================================================================
      // PPTX Export — v0.20.0
      // Converts the clean modelDoc snapshot to a PowerPoint file using
      // PptxGenJS (loaded lazily from CDN). Does NOT touch modelDoc or the
      // HTML export path.
      // ======================================================================

      // -----------------------------------------------------------------------
      // PptxGenJS loader configuration (AUDIT-D-03, P0-03)
      //
      // Default path: vendor-local file under editor/vendor/pptxgenjs/ —
      // eliminates CDN supply-chain risk and works on file:// with no network.
      //
      // Operator opt-in CDN path: set PPTX_USE_VENDOR = false below.
      // When CDN path is used, the <script> element carries an `integrity`
      // attribute (SRI sha384) + `crossorigin="anonymous"` so the browser
      // rejects any tampered response.
      //
      // SRI hash covers pptxgenjs@3.12.0 dist/pptxgen.bundle.js (466 KB).
      // Upgrade procedure: see editor/vendor/pptxgenjs/README.md
      // -----------------------------------------------------------------------

      /** Set to false to opt into the CDN path (operator/dev use only). */
      var PPTX_USE_VENDOR = true;

      /**
       * Relative path from the shell HTML to the vendored bundle.
       * Resolves correctly under both http://localhost and file:// because
       * the shell lives at editor/presentation-editor.html and the vendor
       * file is at editor/vendor/pptxgenjs/pptxgen.bundled.min.js.
       */
      var PPTX_VENDOR_PATH = "vendor/pptxgenjs/pptxgen.bundled.min.js";

      /** Pinned CDN URL — fallback / operator opt-in only. */
      var PPTX_CDN_URL =
        "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";

      /**
       * SRI integrity attribute for the CDN URL above.
       * sha384 of pptxgenjs@3.12.0 dist/pptxgen.bundle.js as served by jsDelivr.
       * Recompute with: node -e "const c=require('crypto'),fs=require('fs');
       *   console.log('sha384-'+c.createHash('sha384').update(fs.readFileSync('pptxgen.bundled.min.js')).digest('base64'))"
       */
      var PPTX_SRI =
        "sha384-Cck14aA9cifjYolcnjebXRfWGkz5ltHMBiG4px/j8GS+xQcb7OhNQWZYyWjQ+UwQ";

      /**
       * Load a script element and return a Promise that resolves on load.
       *
       * Security: when `sri` is provided (CDN path) the <script> element
       * receives `integrity` + `crossorigin="anonymous"` attributes so the
       * browser enforces the SRI hash before executing the response.
       * The vendor path uses no integrity attribute — the file is already
       * local and served from the same origin (or file://).
       *
       * @param {string} url  - script URL (vendor-relative or CDN)
       * @param {string} [sri] - optional SRI hash (e.g. "sha384-…")
       */
      function pptxLoadScript(url, sri) {
        return new Promise((resolve, reject) => {
          // De-duplicate: skip if a <script> with this src is already in DOM.
          if (document.querySelector('script[src="' + url + '"]')) {
            resolve();
            return;
          }
          var s = document.createElement("script");
          s.src = url;
          // Attach SRI integrity + crossorigin when loading from CDN.
          // OWASP A08:2021 — Software and Data Integrity Failures mitigation.
          if (sri) {
            s.integrity = sri;
            s.crossOrigin = "anonymous";
          }
          s.onload = resolve;
          s.onerror = function () {
            reject(new Error("pptx-script-load-failed: " + url));
          };
          document.head.appendChild(s);
        });
      }

      // Parse a CSS length value to a fraction of containerPx (0..1+).
      function pptxLengthToFraction(val, containerPx) {
        if (!val) return null;
        const v = String(val).trim();
        if (v.endsWith("%")) return parseFloat(v) / 100;
        if (v.endsWith("px")) return parseFloat(v) / containerPx;
        if (v.endsWith("em")) return (parseFloat(v) * 16) / containerPx;
        if (v.endsWith("rem")) return (parseFloat(v) * 16) / containerPx;
        const n = parseFloat(v);
        return Number.isFinite(n) ? n / containerPx : null;
      }

      // CSS color string → 6-char RRGGBB hex or null.
      function pptxColorToHex(c) {
        if (!c) return null;
        const s = String(c).trim().toLowerCase();
        if (s === "transparent" || s === "none" || s === "inherit" || s === "initial" || s === "currentcolor") return null;
        if (s.startsWith("#")) {
          const h = s.slice(1).replace(/[^0-9a-f]/gi, "");
          if (h.length === 3) return h.split("").map((x) => x + x).join("").toUpperCase();
          if (h.length >= 6) return h.slice(0, 6).toUpperCase();
          return null;
        }
        const rgb = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
        if (rgb) {
          return [rgb[1], rgb[2], rgb[3]]
            .map((v) => Math.min(255, Math.round(parseFloat(v))).toString(16).padStart(2, "0"))
            .join("")
            .toUpperCase();
        }
        const NAMED = {
          white: "FFFFFF", black: "000000", red: "FF0000", blue: "0000FF",
          green: "008000", yellow: "FFFF00", orange: "FFA500", purple: "800080",
          pink: "FFC0CB", gray: "808080", grey: "808080", silver: "C0C0C0",
          darkgray: "A9A9A9", lightgray: "D3D3D3", navy: "000080",
          teal: "008080", maroon: "800000", lime: "00FF00", aqua: "00FFFF",
          fuchsia: "FF00FF", cyan: "00FFFF", magenta: "FF00FF",
        };
        return NAMED[s] || null;
      }

      // Parse element's inline style attribute into a key→value object.
      function pptxParseStyle(el) {
        const raw = el.getAttribute ? (el.getAttribute("style") || "") : "";
        const obj = {};
        raw.split(";").forEach((part) => {
          const idx = part.indexOf(":");
          if (idx < 0) return;
          const key = part.slice(0, idx).trim().toLowerCase()
            .replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
          obj[key] = part.slice(idx + 1).trim();
        });
        return obj;
      }

      // Try to detect slide pixel dimensions from CSS custom properties or rules.
      function pptxDetectSlideDimensions(doc) {
        const styleEls = Array.from(doc.querySelectorAll("style"));
        for (const st of styleEls) {
          const t = st.textContent || "";
          const wm = t.match(/--slide-w\s*:\s*([\d.]+)px/);
          const hm = t.match(/--slide-h\s*:\s*([\d.]+)px/);
          if (wm && hm) return { w: parseFloat(wm[1]), h: parseFloat(hm[1]) };
        }
        for (const st of styleEls) {
          const t = st.textContent || "";
          const block = t.match(/\.slide\s*\{([^}]+)\}/s);
          if (block) {
            const wm = block[1].match(/\bwidth\s*:\s*([\d.]+)px/);
            const hm = block[1].match(/\b(?:min-)?height\s*:\s*([\d.]+)px/);
            if (wm) {
              const w = parseFloat(wm[1]);
              const h = hm ? parseFloat(hm[1]) : Math.round(w * 9 / 16);
              return { w, h };
            }
          }
        }
        return { w: 1280, h: 720 };
      }

      // Extract dominant background color from a slide element's inline style.
      function pptxGetSlideBgColor(slideEl) {
        const st = pptxParseStyle(slideEl);
        const raw = st.backgroundColor || st.background || "";
        // Strip gradients and url() keeping only color tokens
        const stripped = raw
          .replace(/(?:linear|radial|conic)-gradient\([^)]*\)/gi, "")
          .replace(/url\([^)]*\)/gi, "")
          .trim();
        // Try each space-separated segment for a valid color
        for (const tok of stripped.split(/[\s,]+/)) {
          const hex = pptxColorToHex(tok);
          if (hex) return hex;
        }
        return null;
      }

      // Returns PPTX position { x, y, w, h } in inches for an absolutely
      // positioned element, or null for flow-layout elements.
      function pptxGetAbsPos(el, slideW, slideH, pptxW, pptxH) {
        const st = pptxParseStyle(el);
        const pos = (st.position || "").toLowerCase();
        if (pos !== "absolute" && pos !== "fixed") return null;
        const lf = pptxLengthToFraction(st.left, slideW);
        const tp = pptxLengthToFraction(st.top, slideH);
        const wd = pptxLengthToFraction(st.width, slideW);
        const ht = pptxLengthToFraction(st.height || st.minHeight, slideH);
        if (lf === null || tp === null || wd === null) return null;
        return {
          x: parseFloat((lf * pptxW).toFixed(4)),
          y: parseFloat((tp * pptxH).toFixed(4)),
          w: parseFloat((wd * pptxW).toFixed(4)),
          h: parseFloat(((ht !== null ? ht : 0.4) * pptxH).toFixed(4)),
        };
      }

      // font-size px → PowerPoint pt (1pt = 1/72in, 1px ≈ 0.75pt).
      function pptxFontSizePt(styleObj, tagName) {
        const fs = styleObj.fontSize || "";
        if (fs.endsWith("px")) return Math.max(6, Math.round(parseFloat(fs) * 0.75));
        if (fs.endsWith("pt")) return Math.max(6, Math.round(parseFloat(fs)));
        if (fs.endsWith("em")) return Math.max(6, Math.round(parseFloat(fs) * 12));
        const TAG_PT = { H1: 36, H2: 28, H3: 22, H4: 18, H5: 14, H6: 12,
                         P: 12, SPAN: 12, DIV: 12, LI: 12, A: 12,
                         TD: 11, TH: 11, BLOCKQUOTE: 13 };
        return TAG_PT[tagName] || 12;
      }

      // True when the element is a text "leaf": has visible text but no
      // child elements that also carry text (prevents double-adding).
      function pptxIsTextLeaf(el) {
        const text = (el.textContent || "").trim();
        if (!text) return false;
        return !Array.from(el.children).some((ch) => (ch.textContent || "").trim().length > 0);
      }

      // Walk a slide element and add text + image shapes to pSlide.
      function pptxPopulateSlide(pSlide, slideEl, slideW, slideH, pptxW, pptxH) {
        const SKIP_TAGS = new Set(["STYLE", "SCRIPT", "HEAD", "NOSCRIPT", "TEMPLATE", "SVG", "CANVAS", "VIDEO", "IFRAME"]);
        const allEls = Array.from(slideEl.querySelectorAll("*"));

        // ── Images ─────────────────────────────────────────────────────────
        for (const el of allEls) {
          if (el.tagName !== "IMG") continue;
          const src = (el.getAttribute("src") || "").trim();
          if (!src) continue;
          const pos = pptxGetAbsPos(el, slideW, slideH, pptxW, pptxH);
          if (!pos) continue;
          const imgOpts = { x: pos.x, y: pos.y, w: pos.w, h: pos.h };
          if (src.startsWith("data:")) {
            imgOpts.data = src;
          } else if (/^https?:\/\//.test(src)) {
            imgOpts.path = src;
          } else {
            continue; // relative URL — cannot resolve without base
          }
          try { pSlide.addImage(imgOpts); } catch (_) { /* skip unresolvable */ }
        }

        // ── Text (leaf nodes) ──────────────────────────────────────────────
        let flowY = 0.3; // running Y for non-positioned text (inches)
        const FLOW_X = 0.5;
        const FLOW_W = pptxW - 1.0;

        for (const el of allEls) {
          if (SKIP_TAGS.has(el.tagName)) continue;
          if (!pptxIsTextLeaf(el)) continue;
          const text = (el.textContent || "").trim();
          if (!text) continue;

          const st = pptxParseStyle(el);
          const fontSize = pptxFontSizePt(st, el.tagName);
          const colorHex = pptxColorToHex(st.color || "") || "000000";
          const bold = /bold|[789]\d\d/.test(st.fontWeight || "") || /^H[1-6]$/.test(el.tagName);
          const italic = (st.fontStyle || "").includes("italic");
          const align = ["center", "right", "justify"].includes(st.textAlign)
            ? st.textAlign : "left";
          const lineSpacingPt = Math.round(fontSize * 1.3);

          const textProps = {
            fontSize,
            bold,
            italic,
            color: colorHex,
            wrap: true,
            valign: "top",
            align,
            lineSpacingMultiple: 1.3,
          };

          const pos = pptxGetAbsPos(el, slideW, slideH, pptxW, pptxH);
          if (pos) {
            const minH = Math.max(pos.h, (fontSize / 72) * 1.6);
            try {
              pSlide.addText(text, { x: pos.x, y: pos.y, w: pos.w, h: minH, ...textProps });
            } catch (_) { /* skip */ }
          } else {
            const lineH = Math.max(0.25, (fontSize / 72) * 1.8);
            try {
              pSlide.addText(text, { x: FLOW_X, y: Math.min(flowY, pptxH - 0.25), w: FLOW_W, h: lineH, ...textProps });
            } catch (_) { /* skip */ }
            flowY += lineH * 1.15;
          }
        }
      }

      // Main entry point — loads PptxGenJS lazily (vendor-first, no network
      // required for default path), builds clean doc snapshot, maps each
      // slide, and triggers browser download.
      async function exportPptx() {
        if (!state.modelDoc) return;

        if (typeof PptxGenJS === "undefined") {
          // Vendor path: resolves relative to the shell HTML under file:// and
          // http://localhost alike. No external network call.
          // CDN path (PPTX_USE_VENDOR=false): pinned version + SRI enforced.
          var loadUrl = PPTX_USE_VENDOR ? PPTX_VENDOR_PATH : PPTX_CDN_URL;
          var loadSri = PPTX_USE_VENDOR ? undefined : PPTX_SRI;
          showToast("Загрузка PptxGenJS…", "info", { ttl: 8000 });
          try {
            await pptxLoadScript(loadUrl, loadSri);
          } catch (_) {
            showToast(
              "Не удалось загрузить PptxGenJS. Проверь сетевое подключение.",
              "error",
              { title: "Экспорт PPTX" },
            );
            return;
          }
        }

        const pack = buildCleanExportPackage();
        if (!pack) return;
        const doc = pack.document;

        // Resolve slide elements using the same selector chain as the editor.
        const selector = state.staticSlideSelector || "[data-slide-id]";
        let slideEls = Array.from(doc.querySelectorAll(selector));
        if (!slideEls.length) {
          slideEls = Array.from(
            doc.querySelectorAll(".slide, section.slide, article.slide, [class*='slide']"),
          );
        }
        if (!slideEls.length) {
          slideEls = Array.from(doc.querySelectorAll("section, article")).filter(
            (el) => el.children.length > 0,
          );
        }
        if (!slideEls.length) {
          showToast("Слайды не найдены для PPTX-экспорта.", "warning", {
            title: "Экспорт PPTX",
          });
          return;
        }

        const { w: slideW, h: slideH } = pptxDetectSlideDimensions(doc);
        const PPTX_W = 10.0; // inches (standard widescreen width)
        const PPTX_H = parseFloat((PPTX_W * (slideH / slideW)).toFixed(4));

        const PptxCtor = typeof PptxGenJS === "function" ? PptxGenJS : window.PptxGenJS;
        const pptx = new PptxCtor();
        pptx.defineLayout({ name: "HTML_PRES", width: PPTX_W, height: PPTX_H });
        pptx.layout = "HTML_PRES";
        pptx.title = doc.title || "Presentation";
        pptx.author = "HTML Presentation Editor";

        for (const slideEl of slideEls) {
          const pSlide = pptx.addSlide();
          const bgColor = pptxGetSlideBgColor(slideEl);
          if (bgColor) pSlide.background = { color: bgColor };
          try {
            pptxPopulateSlide(pSlide, slideEl, slideW, slideH, PPTX_W, PPTX_H);
          } catch (err) {
            reportShellWarning("pptx-slide-failed", String(err));
          }
        }

        const safeTitle = (doc.title || "presentation")
          .replace(/[\\/:*?"<>|]/g, "")
          .trim() || "presentation";
        try {
          await pptx.writeFile({ fileName: `${safeTitle}.pptx` });
          showToast(
            `PPTX экспортирован. Слайдов: ${slideEls.length}.`,
            "success",
            { title: "Экспорт PPTX", ttl: 4000 },
          );
        } catch (err) {
          reportShellWarning("pptx-write-failed", String(err));
          showToast("Ошибка при создании PPTX-файла.", "error", {
            title: "Экспорт PPTX",
          });
        }
      }

      // ── Presentation play mode ─────────────────────────────────────────────
      // Opens the current deck in a new fullscreen window using the same clean
      // export snapshot used for HTML export. No modelDoc mutation.
      function presentDeck() {
        if (!state.modelDoc) return;
        const pack = buildCleanExportPackage();
        if (!pack) return;
        const url = URL.createObjectURL(pack.blob);
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (!win) {
          showToast(
            "Браузер заблокировал новое окно. Разреши pop-up для этого сайта.",
            "warning",
            { title: "Режим презентации" },
          );
          // Revoke immediately since we can't track when popup cleans up
          setTimeout(() => revokeEditorObjectUrl(url, "present-popup-blocked"), 0);
          return;
        }
        // Attempt fullscreen after load — best-effort, browser may deny
        win.addEventListener("load", () => {
          try {
            if (win.document?.documentElement?.requestFullscreen) {
              void win.document.documentElement.requestFullscreen();
            }
          } catch (_) { /* ignore — fullscreen is non-critical */ }
        });
        // Revoke blob URL after the window has had time to load it
        setTimeout(() => revokeEditorObjectUrl(url, "present-url-revoke-failed"), 10000);
        showToast(
          "Презентация открыта в новом окне. Нажми F11 для полного экрана.",
          "success",
          { title: "Режим презентации", ttl: 4000 },
        );
      }

      function collectEditorArtifactResidue(root) {
        if (!root?.querySelectorAll) return [];
        const residue = [];
        root.querySelectorAll("[data-editor-ui='true']").forEach((el) => {
          residue.push(`ui-node:${el.tagName.toLowerCase()}`);
        });
        root.querySelectorAll("*").forEach((el) => {
          Array.from(el.attributes || []).forEach((attr) => {
            if (/^data-editor-/.test(attr.name)) {
              residue.push(`attr:${attr.name}`);
            }
          });
        });
        root
          .querySelectorAll(
            "#__presentation_editor_bridge__, #__presentation_editor_helper_styles__, base[data-editor-preview-base], [contenteditable], [spellcheck]",
          )
          .forEach((el) => {
            residue.push(`node:${el.tagName.toLowerCase()}`);
          });
        return residue;
      }

      function enforceCleanExportInvariant(root, contract = {}) {
        if (!root || contract.keepEditorArtifacts) return;
        const residue = collectEditorArtifactResidue(root);
        if (!residue.length) return;
        addDiagnostic(
          `export-cleanup-residue:${contract.renderMode || "export"}:${residue.slice(0, 8).join(",")}`,
        );
      }

      function stripEditorArtifacts(root) {
        root
          .querySelectorAll("[data-editor-ui='true']")
          .forEach((el) => el.remove());
        root.querySelectorAll("*").forEach((el) => {
          Array.from(el.attributes).forEach((attr) => {
            if (/^data-editor-/.test(attr.name)) {
              el.removeAttribute(attr.name);
            }
          });
        });
        root
          .querySelectorAll("#__presentation_editor_bridge__")
          .forEach((el) => el.remove());
        root
          .querySelectorAll("#__presentation_editor_helper_styles__")
          .forEach((el) => el.remove());
        root
          .querySelectorAll("base[data-editor-preview-base]")
          .forEach((el) => el.remove());
        root
          .querySelectorAll("[data-editor-selected]")
          .forEach((el) => el.removeAttribute("data-editor-selected"));
        root
          .querySelectorAll("[data-editor-hover]")
          .forEach((el) => el.removeAttribute("data-editor-hover"));
        root
          .querySelectorAll("[contenteditable]")
          .forEach((el) => el.removeAttribute("contenteditable"));
        root
          .querySelectorAll("[spellcheck]")
          .forEach((el) => el.removeAttribute("spellcheck"));
      }

      function parseSingleRootElement(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<body>${html}</body>`, "text/html");
        const elements = Array.from(doc.body.children);
        const textNodes = Array.from(doc.body.childNodes).filter(
          (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
        );
        if (elements.length !== 1 || textNodes.length > 0) {
          throw new Error(
            "Нужен ровно один корневой HTML‑элемент без лишнего текста снаружи.",
          );
        }
        return elements[0];
      }

      function resetRuntimeState() {
        state.previewReady = false;
        state.bridgeAlive = false;
        state.engine = "unknown";
        setPreviewLifecycleState("idle", { reason: "reset-runtime" });
        state.slides = [];
        state.runtimeSlides = [];
        // [v2.0.15 / SEC-006] null-prototype dict
        state.slideRegistryById = Object.create(null);
        state.slideRegistryOrder = [];
        state.activeSlideId = null;
        state.pendingActiveSlideId = null;
        state.runtimeActiveSlideId = null;
        clearRequestedSlideActivation();
        state.pendingPreviewSelection = null;
        // [v2.0.15 / SEC-006] null-prototype dicts
        state.slideSyncLocks = Object.create(null);
        state.lastAppliedSeqBySlide = Object.create(null);
        state.lastAppliedSeq = 0;
        clearSelectedElementState();
        state.manipulationContext = null;
        state.liveSelectionRect = null;
        state.activeManipulation = null;
        state.activeGuides = { vertical: [], horizontal: [] };
        state.diagnostics = [];
        state.editingSupported = false;
        state.resolvedPreviewAssets = [];
        state.unresolvedPreviewAssets = [];
        window.resetBrokenAssetBannerDismissal?.(); // WO-24: reset dismissal on new load
        window.updateBrokenAssetBanner?.();          // WO-24: hide banner immediately on reset
        state.baseUrlDependentAssets = [];
        state.previewAssetAuditCounts = {
          resolved: 0,
          unresolved: 0,
          baseUrlDependent: 0,
        };
        state.lastExportValidationAudit = null;
        // [WO-31] Clear once-per-session toast flag on each new deck load.
        sessionStorage.removeItem("editor:multi-select-toast-shown");
        // [WO-07] Reset trust-decision to PENDING on every fresh import.
        // lastImportedRawHtml is intentionally NOT cleared here — it is written
        // inside buildModelDocument (import.js) after the new HTML arrives and
        // cleared only once import fully succeeds.
        state.trustDecision = 'pending';
        state.trustSignals = null;
        if (window.shellBoundary) window.shellBoundary.clear(TRUST_BANNER_CODE);
        updateDiagnostics();
      }

      function cleanupPreviewUrl() {
        els.previewFrame.onload = null;
        if (state.previewUrl) {
          revokeEditorObjectUrl(
            state.previewUrl,
            "preview-url-revoke-failed",
          );
          state.previewUrl = null;
        }
      }

      function commitChange(reason, options = {}) {
        state.dirty = true;
        refreshUi();
        schedulePersistence(reason, options);
      }

      function recordHistoryChange(reason, options = {}) {
        if (typeof pushHistory === "function") {
          pushHistory(reason);
          return true;
        }
        if (typeof commitChange === "function") {
          commitChange(reason, {
            ...options,
            snapshotMode: options.snapshotMode || "immediate",
          });
          return true;
        }
        return false;
      }

      function clearPendingPersistenceTimers() {
        window.clearTimeout(state.saveTimer);
        window.clearTimeout(state.snapshotTimer);
        state.saveTimer = null;
        state.snapshotTimer = null;
      }

      function schedulePersistence(reason = "change", options = {}) {
        const snapshotMode =
          typeof options.snapshotMode === "string"
            ? options.snapshotMode
            : "debounced";
        clearPendingPersistenceTimers();
        state.saveTimer = window.setTimeout(saveProjectToLocalStorage, 250);
        if (state.historyMuted) return;
        if (snapshotMode === "none") return;
        if (snapshotMode === "immediate") {
          captureHistorySnapshot(reason);
          return;
        }
        state.snapshotTimer = window.setTimeout(
          () => captureHistorySnapshot(reason),
          320,
        );
      }

      // WO-18: captureHistorySnapshot, serializeCurrentProject, restoreSnapshot
      // moved to history.js (loaded after this file — global scope, all scripts share window).
      // Runtime calls (from event handlers / setTimeout) resolve them from history.js.
      // No re-declaration needed: global function declarations are available after DOMContentLoaded.

      // =====================================================================
