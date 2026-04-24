// alignment-toolbar.js
// Layer: Direct manipulation — alignment + distribute (Phase D2)
// =====================================================================
// Surfaces a small toolbar above the canvas when state.multiSelectNodeIds
// has ≥ 2 entries. Six alignment actions and two distribute actions.
// Keyboard shortcuts: Ctrl+Shift+{L,E,R,T,M,B,H,V}.
//
// Geometry source: parent slide rect; nodes positioned via inline left/top.
// We honor data-editor-locked — locked nodes are read-only and skipped
// from the move set (still counted for bounding-box math).
// =====================================================================
"use strict";
(function () {
  "use strict";

  function getMultiSelectNodes() {
    if (!state.modelDoc || !Array.isArray(state.multiSelectNodeIds)) return [];
    return state.multiSelectNodeIds
      .map(function (id) {
        return state.modelDoc.querySelector(
          '[data-editor-node-id="' + cssEscape(id) + '"]',
        );
      })
      .filter(function (el) { return el instanceof Element; });
  }

  function readBox(el) {
    var leftRaw = parseFloat(el.style.left || "0");
    var topRaw = parseFloat(el.style.top || "0");
    var widthRaw = parseFloat(el.style.width || el.getAttribute("width") || "0");
    var heightRaw = parseFloat(el.style.height || el.getAttribute("height") || "0");
    return {
      el: el,
      left: Number.isFinite(leftRaw) ? leftRaw : 0,
      top: Number.isFinite(topRaw) ? topRaw : 0,
      width: Number.isFinite(widthRaw) ? widthRaw : 0,
      height: Number.isFinite(heightRaw) ? heightRaw : 0,
      locked: el.getAttribute("data-editor-locked") === "true",
    };
  }

  function applyBoxLeft(box, nextLeft) {
    if (box.locked || nextLeft === box.left) return false;
    box.el.style.left = String(Math.round(nextLeft)) + "px";
    return true;
  }

  function applyBoxTop(box, nextTop) {
    if (box.locked || nextTop === box.top) return false;
    box.el.style.top = String(Math.round(nextTop)) + "px";
    return true;
  }

  function combinedBounds(boxes) {
    if (!boxes.length) return null;
    var minLeft = Infinity, minTop = Infinity;
    var maxRight = -Infinity, maxBottom = -Infinity;
    boxes.forEach(function (b) {
      minLeft = Math.min(minLeft, b.left);
      minTop = Math.min(minTop, b.top);
      maxRight = Math.max(maxRight, b.left + b.width);
      maxBottom = Math.max(maxBottom, b.top + b.height);
    });
    return {
      left: minLeft,
      top: minTop,
      right: maxRight,
      bottom: maxBottom,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    };
  }

  // -------------------------------------------------------------------
  // Alignment actions
  // -------------------------------------------------------------------
  var ALIGN_FNS = {
    left: function (box, b) { return [applyBoxLeft(box, b.left), false]; },
    centerH: function (box, b) {
      var c = b.left + b.width / 2;
      return [applyBoxLeft(box, c - box.width / 2), false];
    },
    right: function (box, b) {
      return [applyBoxLeft(box, b.right - box.width), false];
    },
    top: function (box, b) { return [false, applyBoxTop(box, b.top)]; },
    middle: function (box, b) {
      var c = b.top + b.height / 2;
      return [false, applyBoxTop(box, c - box.height / 2)];
    },
    bottom: function (box, b) {
      return [false, applyBoxTop(box, b.bottom - box.height)];
    },
  };

  function align(direction) {
    var boxes = getMultiSelectNodes().map(readBox);
    if (boxes.length < 2) return false;
    var b = combinedBounds(boxes);
    if (!b) return false;
    var fn = ALIGN_FNS[direction];
    if (!fn) return false;
    var changed = false;
    boxes.forEach(function (box) {
      var result = fn(box, b);
      if (result[0] || result[1]) changed = true;
    });
    if (changed) commitAlignmentChange("align:" + direction);
    return changed;
  }

  // -------------------------------------------------------------------
  // Distribute — equal spacing along axis, between first and last item.
  // -------------------------------------------------------------------
  function distribute(axis) {
    var boxes = getMultiSelectNodes().map(readBox);
    if (boxes.length < 3) return false; // Need ≥3 items to distribute
    var sortKey = axis === "horizontal" ? "left" : "top";
    var sizeKey = axis === "horizontal" ? "width" : "height";
    var sorted = boxes.slice().sort(function (a, b) { return a[sortKey] - b[sortKey]; });
    var first = sorted[0];
    var last = sorted[sorted.length - 1];
    var span = (last[sortKey] + last[sizeKey]) - first[sortKey];
    var totalSize = sorted.reduce(function (acc, box) { return acc + box[sizeKey]; }, 0);
    var gapTotal = span - totalSize;
    var gap = gapTotal / (sorted.length - 1);
    var cursor = first[sortKey] + first[sizeKey] + gap;
    var changed = false;
    for (var i = 1; i < sorted.length - 1; i += 1) {
      var box = sorted[i];
      if (axis === "horizontal") {
        if (applyBoxLeft(box, cursor)) changed = true;
      } else {
        if (applyBoxTop(box, cursor)) changed = true;
      }
      cursor += box[sizeKey] + gap;
    }
    if (changed) commitAlignmentChange("distribute:" + axis);
    return changed;
  }

  function commitAlignmentChange(reason) {
    if (typeof recordHistoryChange === "function") recordHistoryChange(reason);
    if (typeof commitChange === "function") commitChange(reason, { snapshotMode: "immediate" });
    // Sync each touched node back to the iframe via bridge.
    state.multiSelectNodeIds.forEach(function (id) {
      var node = state.modelDoc?.querySelector(
        '[data-editor-node-id="' + cssEscape(id) + '"]',
      );
      if (!node) return;
      var attrs = {};
      if (node.style.left) attrs.style = node.style.cssText;
      if (Object.keys(attrs).length) {
        sendToBridge("update-attributes", { nodeId: id, attrs: attrs });
      }
    });
  }

  // -------------------------------------------------------------------
  // Toolbar UI surface
  // -------------------------------------------------------------------
  function ensureToolbarRoot() {
    var root = document.getElementById("alignmentToolbar");
    if (root) return root;
    root = document.createElement("div");
    root.id = "alignmentToolbar";
    root.className = "alignment-toolbar";
    root.setAttribute("role", "toolbar");
    root.setAttribute("aria-label", "Выравнивание выделения");
    root.hidden = true;
    var icon = function (name, fallback) {
      return typeof window.iconMarkup === "function"
        ? window.iconMarkup(name, fallback)
        : fallback;
    };
    var actions = [
      { action: "align:left", icon: icon("arrow-up", "←"), label: "По левому краю", chord: "Ctrl+Shift+L" },
      { action: "align:centerH", icon: icon("more-horizontal", "↔"), label: "По центру (горизонтально)", chord: "Ctrl+Shift+E" },
      { action: "align:right", icon: icon("arrow-up", "→"), label: "По правому краю", chord: "Ctrl+Shift+R" },
      { action: "align:top", icon: icon("arrow-up", "↑"), label: "По верхнему краю", chord: "Ctrl+Shift+T" },
      { action: "align:middle", icon: icon("more-vertical", "↕"), label: "По центру (вертикально)", chord: "Ctrl+Shift+M" },
      { action: "align:bottom", icon: icon("arrow-down", "↓"), label: "По нижнему краю", chord: "Ctrl+Shift+B" },
      { action: "distribute:horizontal", icon: icon("grid", "↔↔"), label: "Распределить по горизонтали", chord: "Ctrl+Shift+H" },
      { action: "distribute:vertical", icon: icon("grid", "↕↕"), label: "Распределить по вертикали", chord: "Ctrl+Shift+V" },
    ];
    root.innerHTML = actions
      .map(function (a) {
        return (
          '<button type="button" class="alignment-toolbar-btn" data-align-action="' +
          a.action +
          '" aria-label="' + a.label +
          '" title="' + a.label + ' (' + a.chord + ')">' +
          a.icon + "</button>"
        );
      })
      .join("");
    document.body.appendChild(root);
    root.addEventListener("click", function (event) {
      var target = event.target.closest("[data-align-action]");
      if (!target) return;
      var raw = String(target.getAttribute("data-align-action") || "");
      var parts = raw.split(":");
      var op = parts[0];
      var arg = parts[1];
      if (op === "align") align(arg);
      else if (op === "distribute") distribute(arg);
      refreshToolbarVisibility();
    });
    return root;
  }

  function refreshToolbarVisibility() {
    var root = ensureToolbarRoot();
    var visible =
      Array.isArray(state.multiSelectNodeIds) &&
      state.multiSelectNodeIds.length >= 2 &&
      state.mode === "edit";
    root.hidden = !visible;
    if (visible) {
      // Check distribute eligibility (needs ≥3).
      var distributeEligible = state.multiSelectNodeIds.length >= 3;
      root.querySelectorAll('[data-align-action^="distribute"]').forEach(function (btn) {
        btn.disabled = !distributeEligible;
        btn.setAttribute("aria-disabled", distributeEligible ? "false" : "true");
      });
    }
  }

  function bindAlignmentShortcuts() {
    document.addEventListener("keydown", function (event) {
      if (state.mode !== "edit") return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (!event.shiftKey) return;
      var key = String(event.key || "").toLowerCase();
      var direction = null;
      if (key === "l") direction = ["align", "left"];
      else if (key === "e") direction = ["align", "centerH"];
      else if (key === "r") direction = ["align", "right"];
      else if (key === "t") direction = ["align", "top"];
      else if (key === "m") direction = ["align", "middle"];
      else if (key === "b") direction = ["align", "bottom"];
      else if (key === "h") direction = ["distribute", "horizontal"];
      else if (key === "v") direction = ["distribute", "vertical"];
      if (!direction) return;
      if (!Array.isArray(state.multiSelectNodeIds) || state.multiSelectNodeIds.length < 2) return;
      event.preventDefault();
      if (direction[0] === "align") align(direction[1]);
      else distribute(direction[1]);
      refreshToolbarVisibility();
    });
  }

  // Expose
  window.alignSelection = align;
  window.distributeSelection = distribute;
  window.refreshAlignmentToolbar = refreshToolbarVisibility;
  window.bindAlignmentShortcuts = bindAlignmentShortcuts;
  window.ensureAlignmentToolbarRoot = ensureToolbarRoot;
})();
