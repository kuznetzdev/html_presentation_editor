// theme.js — Theme preference (light/dark/system), FOUC-safe applyResolvedTheme.
// Reads + writes via window.store.ui slice (ADR-013). Extracted from boot.js v0.29.4 per P1-07.
if (typeof window.store?.get !== 'function') throw new Error('theme.js requires store.js loaded first');

      function resolveSystemTheme() {
        return window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }

      function getThemePreferenceLabel(preference = state.themePreference) {
        switch (preference) {
          case "light":
            return "☀ Светлая";
          case "dark":
            return "🌙 Тёмная";
          default:
            return "🖥 Система";
        }
      }

      function queueThemeTransitionUnlock() {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            delete document.documentElement.dataset.themeTransition;
            delete document.documentElement.dataset.themeBooting;
          });
        });
      }

      function syncThemeDatasets(theme) {
        document.documentElement.dataset.theme = theme;
        document.documentElement.dataset.themePreference = state.themePreference;
        if (document.body) {
          document.body.dataset.theme = theme;
          document.body.dataset.themePreference = state.themePreference;
        }
        document.documentElement.style.colorScheme = theme;
      }

      function applyResolvedTheme(theme, options = {}) {
        const suppressTransitions = options.suppressTransitions !== false;
        if (suppressTransitions) {
          document.documentElement.dataset.themeTransition = "locked";
        }
        state.theme = theme === "dark" ? "dark" : "light";
        // [WO-16] Sync resolved theme into the observable store ui slice.
        if (window.store) window.store.update("ui", { theme: state.theme });
        syncThemeDatasets(state.theme);
        if (els.themeToggleBtn) {
          const buttonLabel = getThemePreferenceLabel();
          const aria = `Тема редактора: ${buttonLabel}. Нажми, чтобы переключить режим темы.`;
          els.themeToggleBtn.textContent = buttonLabel;
          els.themeToggleBtn.setAttribute("aria-label", aria);
          els.themeToggleBtn.title = aria;
          if (els.topbarOverflowThemeBtn) {
            els.topbarOverflowThemeBtn.textContent = buttonLabel;
            els.topbarOverflowThemeBtn.setAttribute("aria-label", aria);
            els.topbarOverflowThemeBtn.title = aria;
          }
        }
        if (suppressTransitions) queueThemeTransitionUnlock();
      }
      /* ======================================================================
       shell storage + preference persistence
       ====================================================================== */

      function initTheme() {
        let savedPreference = "system";
        try {
          const raw = localStorage.getItem(THEME_STORAGE_KEY);
          if (THEME_PREFERENCES.includes(raw)) savedPreference = raw;
        } catch (error) {
          reportShellWarning("theme-preference-load-failed", error, {
            once: true,
          });
        }
        try {
          const rawStyle = localStorage.getItem(COPIED_STYLE_KEY);
          if (rawStyle) state.copiedStyle = JSON.parse(rawStyle);
        } catch (error) {
          reportShellWarning("copied-style-load-failed", error, {
            once: true,
          });
        }
        state.themePreference = savedPreference;
        // [WO-16] Sync initial preference into the observable store ui slice.
        if (window.store) window.store.update("ui", { themePreference: savedPreference });
        applyResolvedTheme(
          state.themePreference === "system"
            ? resolveSystemTheme()
            : state.themePreference,
          { suppressTransitions: true },
        );

        const media = window.matchMedia
          ? window.matchMedia("(prefers-color-scheme: dark)")
          : null;
        if (media && !media.__presentationEditorThemeBound) {
          const onChange = (event) => {
            if (state.themePreference !== "system") return;
            applyResolvedTheme(event.matches ? "dark" : "light", {
              suppressTransitions: true,
            });
            showToast(
              `Системная тема изменилась: ${event.matches ? "тёмная" : "светлая"}.`,
              "success",
              { title: "Оформление", ttl: 1800 },
            );
          };
          if (typeof media.addEventListener === "function")
            media.addEventListener("change", onChange);
          else if (typeof media.addListener === "function")
            media.addListener(onChange);
          media.__presentationEditorThemeBound = true;
        }
      }

      function setThemePreference(preference, persist = true) {
        const nextPreference = THEME_PREFERENCES.includes(preference)
          ? preference
          : "system";
        state.themePreference = nextPreference;
        // [WO-16] Sync theme preference into the observable store ui slice.
        if (window.store) window.store.update("ui", { themePreference: nextPreference });
        applyResolvedTheme(
          nextPreference === "system" ? resolveSystemTheme() : nextPreference,
          { suppressTransitions: true },
        );
        if (persist) {
          try {
            localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
          } catch (error) {
            reportShellWarning("theme-preference-save-failed", error, {
              once: true,
            });
          }
        }
      }

      function toggleTheme() {
        const currentIndex = Math.max(
          0,
          THEME_PREFERENCES.indexOf(state.themePreference),
        );
        const nextPreference =
          THEME_PREFERENCES[(currentIndex + 1) % THEME_PREFERENCES.length];
        setThemePreference(nextPreference, true);
        showToast(`Тема редактора: ${getThemePreferenceLabel(nextPreference)}.`, "success", {
          title: "Оформление",
        });
      }
