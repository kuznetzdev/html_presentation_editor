// telemetry.js
// Layer: Observability
// Opt-in local-only telemetry scaffold. ADR-020, WO-15.
// Zero network calls. Zero dependencies. Classic IIFE, no type="module".
//
// API exposed as window.telemetry (frozen):
//   isEnabled()        — true iff localStorage[TELEMETRY_ENABLED_KEY] === "1"
//   setEnabled(on)     — persists flag; on enable emits canary; on disable clears log
//   emit({level,code,data}) — appends event if enabled; LRU-evicts when over cap
//   readLog()          — returns parsed array; returns [] on parse error
//   clearLog()         — removes TELEMETRY_LOG_KEY from localStorage
//   exportLogJson()    — returns readLog() (caller handles download)
//
// Size cap: TELEMETRY_MAX_BYTES (1 MB) AND TELEMETRY_MAX_EVENTS (5000).
// Oldest events are evicted first (LRU).
//
// UUID: crypto.randomUUID() with crypto.getRandomValues() fallback.
// NO Math.random anywhere in this file.
// NO fetch / XMLHttpRequest / navigator.sendBeacon anywhere in this file.

(function () {
  // ─── Session UUID ────────────────────────────────────────────────────────────
  var _session = _generateUUID();

  function _generateUUID() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      try {
        return crypto.randomUUID();
      } catch (_) {
        // fall through to getRandomValues path
      }
    }
    // Fallback: RFC-4122 v4 via crypto.getRandomValues
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      try {
        var bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        // Set version bits (v4)
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        // Set variant bits
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        var hex = Array.from(bytes).map(function (b) {
          return ("0" + b.toString(16)).slice(-2);
        });
        return (
          hex.slice(0, 4).join("") + "-" +
          hex.slice(4, 6).join("") + "-" +
          hex.slice(6, 8).join("") + "-" +
          hex.slice(8, 10).join("") + "-" +
          hex.slice(10).join("")
        );
      } catch (_) {
        // fall through
      }
    }
    // Last-resort: timestamp + counter (still no Math.random)
    var _uuidCounter = (typeof _uuidCounter !== "undefined" ? _uuidCounter : 0) + 1;
    return "00000000-0000-4000-8000-" + (
      "000000000000" + (Date.now().toString(16) + _uuidCounter.toString(16))
    ).slice(-12);
  }

  // ─── localStorage helpers (all wrapped in try/catch) ────────────────────────
  function _lsGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  }

  function _lsSet(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      // QuotaExceededError handled by caller
      return false;
    }
  }

  function _lsRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (_) {
      // ignore
    }
  }

  // ─── Log I/O ─────────────────────────────────────────────────────────────────
  function readLog() {
    var raw = _lsGet(TELEMETRY_LOG_KEY);
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function writeLog(arr) {
    if (!Array.isArray(arr)) return;
    // Enforce event count cap — evict oldest
    var events = arr;
    if (events.length > TELEMETRY_MAX_EVENTS) {
      events = events.slice(events.length - TELEMETRY_MAX_EVENTS);
    }
    var serialized = JSON.stringify(events);
    // Enforce byte cap — evict oldest until within limit
    while (serialized.length > TELEMETRY_MAX_BYTES && events.length > 1) {
      events = events.slice(1);
      serialized = JSON.stringify(events);
    }
    // Attempt write; if QuotaExceededError, evict one more and retry once
    var ok = _lsSet(TELEMETRY_LOG_KEY, serialized);
    if (!ok && events.length > 1) {
      events = events.slice(1);
      serialized = JSON.stringify(events);
      _lsSet(TELEMETRY_LOG_KEY, serialized);
    }
  }

  function clearLog() {
    _lsRemove(TELEMETRY_LOG_KEY);
  }

  // ─── Enabled flag ─────────────────────────────────────────────────────────────
  function isEnabled() {
    return _lsGet(TELEMETRY_ENABLED_KEY) === "1";
  }

  function setEnabled(on) {
    if (on) {
      var wasOff = !isEnabled();
      _lsSet(TELEMETRY_ENABLED_KEY, "1");
      if (wasOff) {
        // Emit canary event on first enable (off → on transition)
        emit({ level: "ok", code: "telemetry.enabled", data: {} });
      }
    } else {
      _lsSet(TELEMETRY_ENABLED_KEY, "0");
      clearLog();
    }
  }

  // ─── Core emit ───────────────────────────────────────────────────────────────
  function emit(params) {
    if (!isEnabled()) return;
    var level = params && params.level ? String(params.level) : "ok";
    var code = params && params.code ? String(params.code) : "unknown";
    var data = (params && params.data !== undefined) ? params.data : {};
    var event = {
      t: Date.now(),
      session: _session,
      level: level,
      code: code,
      data: data,
    };
    var log = readLog();
    log.push(event);
    writeLog(log);
  }

  // ─── Export ────────────────────────────────────────────────────────────────────
  function exportLogJson() {
    return readLog();
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  window.telemetry = Object.freeze({
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    emit: emit,
    readLog: readLog,
    clearLog: clearLog,
    exportLogJson: exportLogJson,
  });
})();
