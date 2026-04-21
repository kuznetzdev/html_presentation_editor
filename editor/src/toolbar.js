      // updateFloatingToolbarContext moved to floating-toolbar.js (WO-21). toolbar.js retains only inspector-init helpers.

      function initInspectorSections() {
        let persisted = {};
        try {
          persisted = JSON.parse(
            localStorage.getItem(INSPECTOR_SECTIONS_KEY) || "{}",
          );
        } catch (error) {
          reportShellWarning("inspector-sections-load-failed", error, {
            once: true,
          });
        }
        state.inspectorSections = persisted || {};
        document
          .querySelectorAll(".inspector-section")
          .forEach((section, index) => {
            if (section.dataset.enhanced === "true") return;
            section.dataset.enhanced = "true";
            const heading = section.querySelector("h3");
            if (!heading) return;
            const key = slugify(heading.textContent || `section-${index}`);
            section.dataset.sectionKey = key;
            const header = document.createElement("div");
            header.className = "inspector-section-header";
            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "section-toggle";
            toggle.innerHTML = `<span>${escapeHtml(heading.textContent || "Секция")}</span><span class="section-caret">▾</span>`;
            header.appendChild(toggle);
            heading.replaceWith(header);
            const content = document.createElement("div");
            content.className = "inspector-section-content";
            while (header.nextSibling) content.appendChild(header.nextSibling);
            section.appendChild(content);
            const collapsed = Boolean(state.inspectorSections[key]);
            section.classList.toggle("is-collapsed", collapsed);
            toggle.addEventListener("click", () => {
              section.classList.toggle("is-collapsed");
              state.inspectorSections[key] =
                section.classList.contains("is-collapsed");
              try {
                localStorage.setItem(
                  INSPECTOR_SECTIONS_KEY,
                  JSON.stringify(state.inspectorSections),
                );
              } catch (error) {
                reportShellWarning("inspector-sections-save-failed", error, {
                  once: true,
                });
              }
            });
          });
      }

      function slugify(value) {
        return (
          String(value || "")
            .toLowerCase()
            .trim()
            .replace(/[^a-zа-я0-9]+/gi, "-")
            .replace(/^-+|-+$/g, "") || "section"
        );
      }

      function addInspectorHelpBadges() {
        const helpMap = {
          elementIdInput:
            "id элемента внутри HTML. Оставь пустым, если привязка по id не нужна.",
          elementClassInput:
            "CSS-классы через пробел. Используй осторожно: классы могут участвовать в логике презентации.",
          widthInput: "Ширина элемента: например, 320px, 50% или auto.",
          heightInput: "Высота элемента: например, 180px или auto.",
          marginInput: "Внешние отступы элемента. Пример: 8px 12px.",
          paddingInput: "Внутренние отступы элемента. Пример: 8px 12px.",
          leftInput:
            "Смещение слева. Имеет смысл только для relative/absolute/fixed/sticky.",
          topInput:
            "Смещение сверху. Имеет смысл только для relative/absolute/fixed/sticky.",
          zIndexInput: "Порядок наложения элемента по оси Z.",
          imageSrcInput: "Адрес изображения: URL или data:image/...",
        };
        Object.entries(helpMap).forEach(([inputId, text]) => {
          const input = document.getElementById(inputId);
          const label = input?.closest(".field-group")?.querySelector("label");
          if (!label || label.querySelector(".help-badge")) return;
          const badge = document.createElement("span");
          badge.className = "help-badge";
          badge.textContent = "?";
          badge.title = text;
          label.classList.add("label-with-help");
          label.appendChild(badge);
        });
      }

      // =====================================================================
