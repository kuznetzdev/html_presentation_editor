// input-validators.js
// Layer: Error recovery Layer 5 (V2-08 / Phase E2)
// =====================================================================
// Registry of validators for common inspector inputs. Each validator
// returns `{ ok, value, message? }` — `value` is normalized when ok=true.
//
// Usage:
//   const result = window.InputValidators.opacity(rawString);
//   if (!result.ok) { showToast(result.message, 'error'); return; }
//   applyOpacity(result.value);
// =====================================================================
"use strict";
(function () {
  "use strict";

  function fail(message) { return { ok: false, message: message }; }
  function ok(value) { return { ok: true, value: value }; }

  // Pixel-size: "120px" or "120". Returns integer pixels in [0..MAX].
  function pixelSize(raw, options) {
    var opts = options || {};
    var min = typeof opts.min === "number" ? opts.min : 0;
    var max = typeof opts.max === "number" ? opts.max : 10000;
    var str = String(raw == null ? "" : raw).trim();
    if (!str) return fail("Значение обязательно.");
    var match = str.match(/^(-?\d+(?:\.\d+)?)(px)?$/i);
    if (!match) return fail("Ожидается число в пикселях, например 120 или 120px.");
    var num = parseFloat(match[1]);
    if (!Number.isFinite(num)) return fail("Некорректное число.");
    if (num < min) return fail("Минимум: " + min + " px.");
    if (num > max) return fail("Максимум: " + max + " px.");
    return ok(Math.round(num));
  }

  // Opacity: "0.5" or "50%". Returns [0..1].
  function opacity(raw) {
    var str = String(raw == null ? "" : raw).trim();
    if (!str) return fail("Прозрачность обязательна.");
    var value;
    if (str.endsWith("%")) {
      value = parseFloat(str.slice(0, -1)) / 100;
    } else {
      value = parseFloat(str);
    }
    if (!Number.isFinite(value)) return fail("Некорректное число.");
    if (value < 0 || value > 1) return fail("Диапазон: 0–1 или 0–100%.");
    return ok(Number(value.toFixed(3)));
  }

  // URL: http(s), relative, or data:. Rejects javascript: and other schemes.
  function url(raw) {
    var str = String(raw == null ? "" : raw).trim();
    if (!str) return fail("URL обязателен.");
    if (/^javascript:/i.test(str)) return fail("Схема javascript: запрещена.");
    if (/^(https?:|\/|\.\/|data:image\/)/i.test(str)) return ok(str);
    // Bare host (example.com/foo) → accept, but warn
    if (/^[\w.-]+\.[\w.-]+/.test(str)) return ok(str);
    return fail("Ожидается URL, например https://..., ./image.png или data:image/...");
  }

  // Hex color: #RGB, #RRGGBB, #RRGGBBAA (case-insensitive). Normalizes to
  // lowercase 7 or 9-char form.
  function hexColor(raw) {
    var str = String(raw == null ? "" : raw).trim();
    if (!str) return fail("Цвет обязателен.");
    if (!str.startsWith("#")) return fail("Цвет должен начинаться с #.");
    var hex = str.slice(1);
    if (!/^[0-9a-f]+$/i.test(hex)) return fail("Только символы 0-9 и A-F.");
    if (hex.length === 3) {
      var expanded = hex.split("").map(function (c) { return c + c; }).join("");
      return ok("#" + expanded.toLowerCase());
    }
    if (hex.length === 6 || hex.length === 8) {
      return ok("#" + hex.toLowerCase());
    }
    return fail("Поддерживаются #RGB, #RRGGBB или #RRGGBBAA.");
  }

  // CSS length: px, em, rem, %, vh, vw, pt, ch, auto
  // Accepts multiple space-separated tokens (for padding / margin shorthand).
  function cssLength(raw) {
    var str = String(raw == null ? "" : raw).trim();
    if (!str) return fail("Значение обязательно.");
    if (str === "auto" || str === "inherit" || str === "initial" || str === "unset") return ok(str);
    var tokens = str.split(/\s+/);
    if (tokens.length > 4) return fail("Максимум 4 значения (top right bottom left).");
    var pattern = /^(?:auto|-?\d+(?:\.\d+)?(?:px|em|rem|%|vh|vw|pt|ch))$/i;
    for (var i = 0; i < tokens.length; i += 1) {
      if (!pattern.test(tokens[i])) {
        return fail("Ожидается значение вроде 12px, 1.5em, 50% или auto.");
      }
    }
    return ok(tokens.join(" "));
  }

  window.InputValidators = {
    pixelSize: pixelSize,
    opacity: opacity,
    url: url,
    hexColor: hexColor,
    cssLength: cssLength,
  };
})();
