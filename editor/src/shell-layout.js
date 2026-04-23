// shell-layout.js — Responsive shell: compact-shell detection, panel open/close, roving focus.
// Extracted from boot.js v0.29.4 per PAIN-MAP P1-07.
// [v1.1.1] Added applyLayoutVersionAttribute + applyLayersStandaloneAttribute
// helpers for v2 layout feature-flag wiring (ADR-031, ADR-032). Default v1 = no-op.
if (typeof state !== 'object' || !els) throw new Error('shell-layout.js requires state.js loaded first');

      // -------------------------------------------------------------------
      // [v1.1.1 / ADR-032] Apply layout version attribute to <body>
      // Reads window.featureFlags.layoutVersion and mirrors to data attribute
      // so CSS rules in split-pane.css / layers-region.css can scope styles.
      // -------------------------------------------------------------------
      function applyLayoutVersionAttribute() {
        var version = (window.featureFlags && window.featureFlags.layoutVersion) || "v1";
        if (version !== "v1" && version !== "v2") version = "v1";
        document.body.dataset.layoutVersion = version;
      }

      // [v1.1.1 / ADR-031] Apply layers-standalone attribute to <body>
      // When true, CSS hides #layersInspectorSection (inspector-nested) and
      // layers-panel.js renders into #layersRegion (shell-region). Default false.
      function applyLayersStandaloneAttribute() {
        var standalone = Boolean(window.featureFlags && window.featureFlags.layersStandalone);
        document.body.dataset.layersStandalone = standalone ? "true" : "false";
      }

      // Expose for boot.js
      window.applyLayoutVersionAttribute = applyLayoutVersionAttribute;
      window.applyLayersStandaloneAttribute = applyLayersStandaloneAttribute;

      function setToggleButtonState(button, active) {
        if (!button) return;
        button.classList.toggle("is-active", Boolean(active));
        button.setAttribute("aria-pressed", active ? "true" : "false");
      }

      function setDisclosureButtonState(button, expanded, controlsId = "") {
        if (!button) return;
        button.classList.toggle("is-active", Boolean(expanded));
        if (controlsId) button.setAttribute("aria-controls", controlsId);
        button.setAttribute("aria-expanded", expanded ? "true" : "false");
      }

      function bindShellLayout() {
        document.querySelectorAll("[data-close-panel]").forEach((button) => {
          button.addEventListener("click", () =>
            setShellPanelState(button.dataset.closePanel, false),
          );
        });
        els.panelBackdrop?.addEventListener("click", () => closeShellPanels());
        els.mobileSlidesBtn?.addEventListener("click", () =>
          toggleShellPanel("left"),
        );
        els.mobileInspectorBtn?.addEventListener("click", () =>
          toggleShellPanel("right"),
        );
        els.mobilePreviewBtn?.addEventListener("click", () => {
          closeShellPanels();
          setMode("preview");
        });
        els.mobileEditBtn?.addEventListener("click", () => {
          closeShellPanels();
          if (!state.modelDoc) {
            openOpenHtmlModal();
            return;
          }
          setMode("edit");
        });
        els.mobileInsertBtn?.addEventListener("click", () => {
          closeShellPanels();
          if (!state.modelDoc) {
            openOpenHtmlModal();
            return;
          }
          if (!state.previewReady) {
            showToast("Сначала дождись полной загрузки превью.", "warning", {
              title: "Превью ещё готовится",
            });
            return;
          }
          if (state.mode !== "edit") setMode("edit");
          toggleInsertPalette();
        });
        const mq = window.matchMedia
          ? window.matchMedia("(min-width: 1025px)")
          : null;
        const handleMqChange = () => {
          if (mq && mq.matches) closeShellPanels();
          else applyShellPanelState();
        };
        if (mq && !mq.__presentationEditorShellBound) {
          if (typeof mq.addEventListener === "function")
            mq.addEventListener("change", handleMqChange);
          else if (typeof mq.addListener === "function")
            mq.addListener(handleMqChange);
          mq.__presentationEditorShellBound = true;
        }
        applyShellPanelState();
      }

      function isCompactShell() {
        return window.matchMedia
          ? window.matchMedia("(max-width: 1024px)").matches
          : window.innerWidth <= 1024;
      }

      function syncShellPanelFocusableState(panel, shouldShow) {
        if (!panel) return;
        panel
          .querySelectorAll(
            'button, [href], input, select, textarea, [tabindex], [contenteditable="true"]',
          )
          .forEach((el) => {
            if (!(el instanceof HTMLElement)) return;
            if (shouldShow) {
              if (!el.hasAttribute("data-shell-tabindex-restore")) return;
              const prevTabIndex = el.getAttribute("data-shell-tabindex-restore");
              el.removeAttribute("data-shell-tabindex-restore");
              if (prevTabIndex === "") el.removeAttribute("tabindex");
              else el.setAttribute("tabindex", prevTabIndex);
              return;
            }
            if (!el.hasAttribute("data-shell-tabindex-restore")) {
              el.setAttribute(
                "data-shell-tabindex-restore",
                el.getAttribute("tabindex") ?? "",
              );
            }
            el.setAttribute("tabindex", "-1");
          });
      }

      function setElementInertState(element, inert) {
        if (!element || !("inert" in element)) return;
        element.inert = inert;
      }

      function applyShellPanelState() {
        const compact = isCompactShell();
        const workflow = state.editorWorkflow || getEditorWorkflowState();
        const shellPanelsEnabled = workflow !== "empty";
        const leftOpen = compact && state.leftPanelOpen;
        const rightOpen = compact && state.rightPanelOpen;
        document.body.dataset.leftPanelOpen = leftOpen ? "true" : "false";
        document.body.dataset.rightPanelOpen = rightOpen ? "true" : "false";
        syncShellViewportLock();
        if (els.panelBackdrop) {
          const showBackdrop = shellPanelsEnabled && (leftOpen || rightOpen);
          els.panelBackdrop.hidden = !showBackdrop;
          els.panelBackdrop.setAttribute(
            "aria-hidden",
            showBackdrop ? "false" : "true",
          );
        }
        syncShellPanelVisibility(
          els.slidesPanel,
          shellPanelsEnabled && (!compact || leftOpen),
          {
            returnFocusEl: els.mobileSlidesBtn,
          },
        );
        syncShellPanelVisibility(
          els.inspectorPanel,
          shellPanelsEnabled && (!compact || rightOpen),
          {
            returnFocusEl: els.mobileInspectorBtn,
          },
        );
        setDisclosureButtonState(els.mobileSlidesBtn, leftOpen, "slidesPanel");
        setDisclosureButtonState(
          els.mobileInspectorBtn,
          rightOpen,
          "inspectorPanel",
        );
      }

      function syncShellPanelVisibility(panel, shouldShow, options = {}) {
        if (!panel) return;
        if (
          !shouldShow &&
          panel.contains(document.activeElement) &&
          options.returnFocusEl instanceof HTMLElement
        ) {
          window.requestAnimationFrame(() =>
            options.returnFocusEl.focus({ preventScroll: true }),
          );
        }
        panel.hidden = !shouldShow;
        panel.setAttribute("aria-hidden", shouldShow ? "false" : "true");
        syncShellPanelFocusableState(panel, shouldShow);
        setElementInertState(panel, !shouldShow);
      }

      function setShellPanelState(side, open) {
        closeTransientShellUi();
        if (side === "left") state.leftPanelOpen = Boolean(open);
        if (side === "right") {
          state.rightPanelOpen = Boolean(open);
          state.rightPanelUserOpen = Boolean(open);
        }
        if (side === "left" && open) {
          state.rightPanelOpen = false;
          state.rightPanelUserOpen = false;
        }
        if (side === "right" && open) state.leftPanelOpen = false;
        if (!isCompactShell()) {
          state.leftPanelOpen = false;
          state.rightPanelOpen = false;
          state.rightPanelUserOpen = false;
        }
        applyShellPanelState();
      }

      function toggleShellPanel(side) {
        closeTransientShellUi();
        if (side === "left") setShellPanelState("left", !state.leftPanelOpen);
        if (side === "right")
          setShellPanelState("right", !state.rightPanelOpen);
      }

      function closeShellPanels(options = {}) {
        const keep = normalizeShellSurfaceKeep(options.keep);
        if (!keep.has("left-panel")) state.leftPanelOpen = false;
        if (!keep.has("right-panel")) {
          state.rightPanelOpen = false;
          state.rightPanelUserOpen = false;
        }
        applyShellPanelState();
        if (options.includeTransient !== false) {
          closeTransientShellUi({ keep: Array.from(keep) });
        }
      }
