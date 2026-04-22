// telemetry.js
// Layer: Observability
// Opt-in local-only telemetry scaffold. ADR-020, WO-15, WO-34.
// Zero network calls. Zero dependencies. Classic IIFE, no type="module".
//
// API exposed as window.telemetry (frozen):
//   isEnabled()                         — true iff localStorage[TELEMETRY_ENABLED_KEY] === "1"
//   setEnabled(on)                      — persists flag; on enable emits canary; on disable clears log
//   emit({level,code,data})             — appends event if enabled; LRU-evicts when over cap
//   readLog()                           — returns parsed array; returns [] on parse error
//   clearLog()                          — empties log, emits telemetry.cleared event (WO-34)
//   exportLogJson()                     — returns readLog() (caller handles download)
//   getSession()                        — { sessionId, startedAt, enabled } (WO-34)
//   getEvents({code,level,sinceT,limit})— filtered array from localStorage (WO-34)
//   getSummary()                        — { count, errors, avgFirstSelectMs, autosaveBytes } (WO-34)
//   exportLog()                         — user-initiated save via showSaveFilePicker OR <a download> (WO-34)
//   subscribe(callback)                 — real-time updates, returns unsubscribe fn (WO-34)
//
// Size cap: TELEMETRY_MAX_BYTES (1 MB) AND TELEMETRY_MAX_EVENTS (5000).
// Oldest events are evicted first (LRU).
//
// UUID: crypto.randomUUID() with crypto.getRandomValues() fallback.
// NO Math.random anywhere in this file.
// NO fetch / XMLHttpRequest / navigator.sendBeacon anywhere in this file.

(function () {
  // ─── Session state ───────────────────────────────────────────────────────────
  var _session = _generateUUID();
  var _sessionStartedAt = Date.now();

  // ─── Subscriber registry ─────────────────────────────────────────────────────
  // Map<id, callback> for subscribe/unsubscribe pattern.
  var _subscribers = {};
  var _subscriberIdCounter = 0;

  function _notifySubscribers() {
    var keys = Object.keys(_subscribers);
    for (var i = 0; i < keys.length; i++) {
      try {
        _subscribers[keys[i]]();
      } catch (_) {
        // Subscriber errors must not propagate into emit/clearLog paths.
      }
    }
  }

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
    // Emit a system event so subscribers know the log was cleared.
    // Bypass the normal emit() guard: always emit this marker even if
    // telemetry was just disabled (setEnabled(false) calls clearLog() before
    // disabling the flag — race window). Write directly without notify loop.
    var marker = {
      t: Date.now(),
      session: _session,
      level: "ok",
      code: "telemetry.cleared",
      data: {},
    };
    writeLog([marker]);
    _notifySubscribers();
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
      _lsRemove(TELEMETRY_LOG_KEY);
      _notifySubscribers();
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
    _notifySubscribers();
  }

  // ─── Export (legacy — returns array for caller to handle) ───────────────────
  function exportLogJson() {
    return readLog();
  }

  // ─── WO-34: getSession ───────────────────────────────────────────────────────
  // Returns { sessionId, startedAt, enabled }.
  // Pure read — no side effects.
  function getSession() {
    return {
      sessionId: _session,
      startedAt: _sessionStartedAt,
      enabled: isEnabled(),
    };
  }

  // ─── WO-34: getEvents ────────────────────────────────────────────────────────
  // Returns filtered slice from localStorage.
  // options: { code, level, sinceT, limit }
  //   code   — exact code match (string, optional)
  //   level  — exact level match: "ok"|"warn"|"error" (string, optional)
  //   sinceT — only events with t >= sinceT (number ms, optional)
  //   limit  — max items to return, most-recent first (number, optional; default 200)
  function getEvents(options) {
    var opts = options || {};
    var log = readLog();
    var code = opts.code ? String(opts.code) : null;
    var level = opts.level ? String(opts.level) : null;
    var sinceT = typeof opts.sinceT === "number" ? opts.sinceT : 0;
    var limit = typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : 200;

    var filtered = [];
    for (var i = 0; i < log.length; i++) {
      var ev = log[i];
      if (sinceT > 0 && ev.t < sinceT) continue;
      if (code !== null && ev.code !== code) continue;
      if (level !== null && ev.level !== level) continue;
      filtered.push(ev);
    }
    // Most-recent first, capped at limit.
    return filtered.slice(-limit).reverse();
  }

  // ─── WO-34: getSummary ───────────────────────────────────────────────────────
  // Returns { count, errors, avgFirstSelectMs, autosaveBytes }.
  //   count            — total events in log
  //   errors           — events with level === "error"
  //   avgFirstSelectMs — average data.duration for code "bootstrap.t_to_first_select"
  //                      or 0 if no such events
  //   autosaveBytes    — latest data.size for code "autosave.ok" or 0
  function getSummary() {
    var log = readLog();
    var errors = 0;
    var firstSelectDurations = [];
    var autosaveBytes = 0;

    for (var i = 0; i < log.length; i++) {
      var ev = log[i];
      if (ev.level === "error") errors += 1;
      if (ev.code === "bootstrap.t_to_first_select" && ev.data && typeof ev.data.duration === "number") {
        firstSelectDurations.push(ev.data.duration);
      }
      if (ev.code === "autosave.ok" && ev.data && typeof ev.data.size === "number") {
        autosaveBytes = ev.data.size;
      }
    }

    var avgFirstSelectMs = 0;
    if (firstSelectDurations.length > 0) {
      var sum = 0;
      for (var j = 0; j < firstSelectDurations.length; j++) {
        sum += firstSelectDurations[j];
      }
      avgFirstSelectMs = Math.round(sum / firstSelectDurations.length);
    }

    return {
      count: log.length,
      errors: errors,
      avgFirstSelectMs: avgFirstSelectMs,
      autosaveBytes: autosaveBytes,
    };
  }

  // ─── WO-34: exportLog ────────────────────────────────────────────────────────
  // User-initiated save: tries showSaveFilePicker (modern), falls back to <a download>.
  // NO network calls. The blob is created locally and released immediately.
  function exportLog() {
    var log = readLog();
    var json = JSON.stringify({ events: log, exportedAt: new Date().toISOString(), sessionId: _session }, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var filename = "telemetry-log-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";

    // Modern path: showSaveFilePicker (Chrome 86+, Edge 86+)
    if (
      typeof window !== "undefined" &&
      window.showSaveFilePicker &&
      typeof window.showSaveFilePicker === "function"
    ) {
      window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      }).then(function (handle) {
        return handle.createWritable();
      }).then(function (writable) {
        return writable.write(blob).then(function () {
          return writable.close();
        });
      }).catch(function (err) {
        // User cancelled (AbortError) or API unavailable — fall back silently.
        if (err && err.name !== "AbortError") {
          _fallbackDownload(blob, filename);
        }
      });
      return;
    }

    // Fallback: anchor download
    _fallbackDownload(blob, filename);
  }

  function _fallbackDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Delay revoke to allow the click to process.
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  // ─── WO-34: subscribe ────────────────────────────────────────────────────────
  // Registers a callback invoked after every emit() or clearLog().
  // Returns an unsubscribe function.
  // callback receives no arguments — caller calls readLog()/getSummary() itself.
  function subscribe(callback) {
    if (typeof callback !== "function") return function () {};
    var id = ++_subscriberIdCounter;
    _subscribers[id] = callback;
    return function unsubscribe() {
      delete _subscribers[id];
    };
  }

  // ─── Public API ───────────────────────────────────────────────────────────────
  window.telemetry = Object.freeze({
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    emit: emit,
    readLog: readLog,
    clearLog: clearLog,
    exportLogJson: exportLogJson,
    // WO-34 viewer APIs
    getSession: getSession,
    getEvents: getEvents,
    getSummary: getSummary,
    exportLog: exportLog,
    subscribe: subscribe,
  });
})();
