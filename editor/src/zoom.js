// zoom.js — CSS-zoom preview scale, clamp 0.25–2.0, persist localStorage.
// Reads + writes via window.store.ui.previewZoom (ADR-013). Extracted from boot.js v0.29.4 per P1-07.
if (typeof window.store?.get !== 'function') throw new Error('zoom.js requires store.js loaded first');

      // [v0.18.3] Preview zoom control
      function initPreviewZoom() {
        let zoom = 1.0;
        try {
          const raw = localStorage.getItem(PREVIEW_ZOOM_STORAGE_KEY);
          const parsed = parseFloat(raw);
          if (Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 2.0) {
            zoom = parsed;
          }
        } catch (error) {
          reportShellWarning("preview-zoom-load-failed", error, {
            once: true,
          });
        }
        setPreviewZoom(zoom, false);
      }

      function setPreviewZoom(zoom, persist = true) {
        const clamped = Math.max(0.25, Math.min(2.0, zoom));
        state.previewZoom = clamped;
        // [WO-16] Sync preview zoom into the observable store ui slice.
        if (window.store) window.store.update("ui", { previewZoom: clamped });
        if (persist) {
          try {
            localStorage.setItem(PREVIEW_ZOOM_STORAGE_KEY, String(clamped));
          } catch (error) {
            reportShellWarning("preview-zoom-save-failed", error, {
              once: true,
            });
          }
        }
        applyPreviewZoom();
      }

      function applyPreviewZoom() {
        const zoom = state.previewZoom ?? 1.0;
        if (els.previewFrame) {
          // Use CSS zoom property for quality-preserving scale (v0.18.3)
          // CSS zoom triggers browser re-layout at target resolution (W3C Working Draft)
          // Unlike transform:scale() which is post-render, zoom preserves text/vector
          // crispness at all zoom levels while simplifying coordinate math
          // Requires: Firefox 126+ (May 2024), Chrome 4+, Safari 4+, Edge 12+
          if (zoom === 1.0) {
            els.previewFrame.style.zoom = "";
          } else {
            els.previewFrame.style.zoom = String(zoom);
          }
        }
        updatePreviewZoomUi();
        renderSelectionOverlay();
        positionFloatingToolbar();
      }

      function updatePreviewZoomUi() {
        const zoom = state.previewZoom ?? 1.0;
        const percent = Math.round(zoom * 100);
        if (els.zoomLevelLabel) {
          els.zoomLevelLabel.textContent = `${percent}%`;
        }
        if (els.zoomResetBtn) {
          els.zoomResetBtn.hidden = zoom === 1.0;
        }
        if (els.zoomOutBtn) {
          els.zoomOutBtn.disabled = zoom <= 0.25;
        }
        if (els.zoomInBtn) {
          els.zoomInBtn.disabled = zoom >= 2.0;
        }
      }

      function stepZoom(direction) {
        const current = state.previewZoom ?? 1.0;
        // Quality-first zoom steps: prefer whole/half fractions for sharper rendering
        // Avoid fractional scales like 0.33, 0.67 that cause excessive blur on downscale
        const steps = [0.25, 0.5, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];
        let targetIndex = steps.findIndex(s => Math.abs(s - current) < 0.01);
        if (targetIndex === -1) {
          targetIndex = steps.findIndex(s => s > current);
          if (targetIndex === -1) targetIndex = steps.length - 1;
          if (direction < 0 && targetIndex > 0) targetIndex--;
        } else {
          targetIndex = Math.max(0, Math.min(steps.length - 1, targetIndex + direction));
        }
        setPreviewZoom(steps[targetIndex], true);
      }
