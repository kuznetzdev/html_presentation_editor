// bridge-script.js
// Layer: Iframe Bridge Application
// Contains buildBridgeScript(token) — generates the JS string injected into
// the preview iframe. This is a self-contained mini-app; do NOT mix shell
// logic here.
//
      function buildBridgeScript(token) {
        return `(function(){
        /* ================================================================
           Presentation Editor Bridge (inside iframe)
           Этот код исполняется в документе презентации и работает только с
           preview DOM: выбор элементов, редактирование, sync и runtime events.
           ================================================================ */
        const TOKEN = ${JSON.stringify(token)};
        const ROOT_SELECTORS = ${JSON.stringify(STATIC_SLIDE_SELECTORS)};
        const EDITOR_MARKER = 'data-editor-node-id';
        const SLIDE_MARKER = 'data-editor-slide-id';
        const ENTITY_KIND_ATTR = 'data-editor-entity-kind';
        const EDITABLE_ATTR = 'data-editor-editable';
        const AUTHOR_SLIDE_ID_ATTR = 'data-slide-id';
        const AUTHOR_NODE_ID_ATTR = 'data-node-id';
        const AUTHOR_NODE_KIND_ATTR = 'data-node-type';
        const AUTHOR_EDITABLE_ATTR = 'data-editable';
        const POLICY_KIND_ATTR = 'data-editor-policy-kind';
        const POLICY_REASON_ATTR = 'data-editor-policy-reason';
        const HELPER_STYLE_ID = '__presentation_editor_helper_styles__';
        const FLASH_ATTR = 'data-editor-flash';
        const EXCLUDED = new Set(['SCRIPT','STYLE','META','LINK','BASE','HEAD','HTML','BODY','NOSCRIPT','TEMPLATE']);
        const TEXT_TAGS = new Set(['H1','H2','H3','H4','H5','H6','P','LI','BLOCKQUOTE','FIGCAPTION','TD','TH','PRE','CODE','SMALL','LABEL','A','SPAN']);
        // ADR-016 Layer 1: entity kinds injected from shell registry (entity-kinds.js) via
        // window.__KNOWN_ENTITY_KINDS pre-script. Defensive fallback kept for resilience.
        // Do NOT add kinds here — update entity-kinds.js instead.
        const __injectedKinds = window.__KNOWN_ENTITY_KINDS;
        if (!__injectedKinds) {
          (typeof parent !== 'undefined' && parent && parent.postMessage)
            ? parent.postMessage({ __presentationEditor: true, token: TOKEN, type: 'runtime-warn', seq: 0, payload: { code: 'entity-kinds-fallback', message: 'window.__KNOWN_ENTITY_KINDS not injected; using built-in fallback list' } }, '*')
            : console.warn('[bridge] window.__KNOWN_ENTITY_KINDS not injected; using built-in fallback list');
        }
        const KNOWN_ENTITY_KINDS = new Set(__injectedKinds || ['text','image','video','container','element','slide-root','protected','table','table-cell','code-block','svg','fragment']);
        const PLAIN_TEXT_BLOCK_TAGS = new Set([
          'ADDRESS',
          'ARTICLE',
          'ASIDE',
          'BLOCKQUOTE',
          'DIV',
          'FIGCAPTION',
          'FIGURE',
          'FOOTER',
          'H1',
          'H2',
          'H3',
          'H4',
          'H5',
          'H6',
          'HEADER',
          'LI',
          'MAIN',
          'NAV',
          'OL',
          'P',
          'PRE',
          'SECTION',
          'TABLE',
          'TBODY',
          'TD',
          'TH',
          'THEAD',
          'TR',
          'UL',
        ]);
        const BLOCKED_ATTR_NAMES = new Set([EDITOR_MARKER, SLIDE_MARKER, 'contenteditable', 'spellcheck']);
        const VALID_ATTR_NAME = /^[^\\s"'<>\\/=]+$/;
        const UNSAFE_ATTR_NAME = /^on/i;

        // ── Sanitization constants (AUDIT-D-02 / ADR-012 §7) ─────────────────────
        // MAX_HTML_BYTES: 256 KB hard cap on parseSingleRoot HTML input.
        const MAX_HTML_BYTES = 262144;

        // UNSAFE_URL_PROTOCOLS: matched against href/src/action/etc. attributes.
        // Data URIs for text/html or application/* are rejected; javascript:/vbscript:
        // are always rejected. data:image/* is intentionally NOT blocked (deck images).
        // NOTE: RegExp constructor used (not literal) because a regex literal with /
        //       inside a template literal string would be prematurely terminated.
        const UNSAFE_URL_PROTOCOLS = new RegExp('^(?:javascript|vbscript|data:(?!image/))', 'i');

        // ALLOWED_HTML_TAGS: explicit allow-list for parseSingleRoot fragment walking.
        // Tags not in this set are removed by sanitizeFragment().
        // SVG structural/graphical elements are included as uppercase.
        // BUTTON and CANVAS are included because reference decks v3 use them.
        const ALLOWED_HTML_TAGS = new Set([
          'A','ARTICLE','ASIDE','B','BLOCKQUOTE','BR','BUTTON',
          'CANVAS',
          'CAPTION','CIRCLE','CODE','COL','COLGROUP',
          'DEFS','DETAILS','DIALOG','DIV',
          'EM','FIGCAPTION','FIGURE','FOOTER',
          'G',
          'H1','H2','H3','H4','H5','H6','HEADER','HR',
          'I','IMG',
          'LABEL','LI','LINE',
          'MAIN','MARK',
          'NAV',
          'OL',
          'P','PATH','POLYGON','POLYLINE','PRE',
          'RECT',
          'S','SECTION','SMALL','SOURCE','SPAN','STRONG','SUB','SUP','SVG',
          'TABLE','TBODY','TD','TEXT','TEXTAREA','TFOOT','TH','THEAD','TIME','TR','TRACK','TSPAN',
          'U','UL',
          'USE',
          'VIDEO',
          'SYMBOL',
        ]);

        // sanitizeFragment: walks all elements in root, removes disallowed tags and
        // dangerous attributes. Returns counts of removed items for logging.
        // NOTE: Only called from parseSingleRoot — buildModelDocument is NOT affected.
        function sanitizeFragment(root) {
          var removedTags = 0;
          var removedAttrs = 0;
          // URL attributes that must be checked against UNSAFE_URL_PROTOCOLS.
          var URL_ATTRS = new Set(['href','src','action','formaction','poster','background']);
          // Collect elements to process via TreeWalker (avoids live mutation during walk).
          var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null, false);
          var els = [];
          var node = walker.nextNode();
          while (node) {
            els.push(node);
            node = walker.nextNode();
          }
          // Process in reverse so removing a parent doesn't leave dangling references.
          for (var i = els.length - 1; i >= 0; i--) {
            var el = els[i];
            if (!el.parentNode) continue; // already removed by ancestor removal
            // (a) Tag allow-list check.
            if (!ALLOWED_HTML_TAGS.has(el.tagName.toUpperCase())) {
              el.remove();
              removedTags++;
              continue;
            }
            // (b) Attribute filter — iterate in reverse to allow safe splice.
            var attrs = Array.from(el.attributes);
            for (var j = attrs.length - 1; j >= 0; j--) {
              var attr = attrs[j];
              var name = attr.name;
              var value = attr.value;
              // Remove editor marker attrs, blocked names, on* handlers, invalid names.
              if (BLOCKED_ATTR_NAMES.has(name) || UNSAFE_ATTR_NAME.test(name) || !VALID_ATTR_NAME.test(name)) {
                el.removeAttribute(name);
                removedAttrs++;
                continue;
              }
              // (c) URL attribute: strip dangerous protocols.
              if (URL_ATTRS.has(name.toLowerCase())) {
                var trimmed = String(value || '').replace(/[\\t\\n\\r ]/g, '').toLowerCase();
                if (UNSAFE_URL_PROTOCOLS.test(trimmed)) {
                  el.removeAttribute(name);
                  removedAttrs++;
                  continue;
                }
              }
              // (d) Strip srcdoc wholesale — avoids embedded document injection.
              if (name.toLowerCase() === 'srcdoc') {
                el.removeAttribute(name);
                removedAttrs++;
              }
            }
          }
          return { removedTags: removedTags, removedAttrs: removedAttrs };
        }
        // ─────────────────────────────────────────────────────────────────────────

        const STATE = {
          engine: 'unknown',
          slides: [],
          editMode: false,
          selectedNodeId: null,
          selectedEl: null,
          selectionLeafNodeId: null,
          selectionPath: [],
          slideObserver: null,
          resizeObserver: null,
          refreshQueued: false,
          flashTimer: null,
          seq: 0,
          activeCommandSeq: 0,
          directManipulation: null,
          inlineTextEdit: null,
          // [LAYER-MODEL v2] candidate cache
          cachedCandidateStack: [],
          cachedCandidateStackPos: { x: 0, y: 0, timestamp: 0 },
          containerMode: false, // [LAYER-MODEL v2] synced from shell
          // [CLICK-THROUGH] repeated-click cycling state
          clickThroughState: { x: 0, y: 0, timestamp: 0, index: -1, candidates: [] },
        };

        // AUDIT-D-04: Compute shell target origin for iframe→shell sends.
        // The string "null" is NOT a valid postMessage targetOrigin — only '*' is
        // accepted when the shell document has "null" origin (file:// context).
        // Under http(s):// we target the shell's exact origin for precision.
        function _getShellTarget() {
          // parent.origin may throw in cross-origin sandboxed iframes; guard it.
          try {
            const o = parent.location.origin;
            if (o && o !== 'null') return o;
          } catch (e) {}
          return '*';
        }
        const _SHELL_TARGET = _getShellTarget();

        function post(type, payload, options) {
          const seq = options && typeof options.seq === 'number'
            ? options.seq
            : (Number(STATE.activeCommandSeq || 0) || 0);
          parent.postMessage({ __presentationEditor: true, token: TOKEN, type, seq, payload }, _SHELL_TARGET);
        }

        /**
         * Emit a structured ack for a mutation message (ADR-012 §5).
         * @param {number}  refSeq  - Sequence number of the originating mutation.
         * @param {boolean} ok      - Whether the mutation succeeded.
         * @param {string}  [code]  - Error code when ok:false.
         * @param {string}  [msg]   - Human-readable error detail.
         */
        function postAck(refSeq, ok, code, msg) {
          const ackPayload = { refSeq: refSeq, ok: ok };
          if (!ok && code) {
            ackPayload.error = { code: code, message: msg || code };
          }
          post('ack', ackPayload, { seq: refSeq });
        }

        function onRuntimeError(message, source, line, column) {
          post('runtime-error', { message, source, line, column });
        }

        window.addEventListener('error', function(event) {
          onRuntimeError(event.message, event.filename, event.lineno, event.colno);
        });

        window.addEventListener('unhandledrejection', function(event) {
          const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'Unhandled promise rejection');
          onRuntimeError(reason, 'promise', 0, 0);
        });

        // detectEngine — грубое определение deck engine по глобалам и DOM-маркерам.
        function detectEngine() {
          try {
            if (window.Reveal && typeof window.Reveal.getSlides === 'function') return 'reveal';
            if (window.shower || document.body.classList.contains('shower') || document.querySelector('.shower')) return 'shower';
            if (document.querySelector('.remark-slide-container') || document.querySelector('.remark-visible')) return 'remark';
          } catch (e) {}
          return 'generic';
        }

        function cssEscape(value) {
          if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
          return String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
        }

        function parseBooleanLikeAttribute(value) {
          const normalized = String(value || '').trim().toLowerCase();
          if (!normalized) return null;
          if (['0', 'false', 'no', 'readonly', 'read-only'].includes(normalized)) return false;
          if (['1', 'true', 'yes', 'editable'].includes(normalized)) return true;
          return true;
        }

        function readNonEmptyAttribute(el, attributeNames) {
          if (!(el instanceof Element)) return '';
          for (const attributeName of attributeNames || []) {
            const value = String(el.getAttribute(attributeName) || '').trim();
            if (value) return value;
          }
          return '';
        }

        function mapAuthorKindToEntityKind(kindHint) {
          switch (String(kindHint || '').trim().toLowerCase()) {
            case 'text':
              return 'text';
            case 'group':
            case 'container':
              return 'container';
            case 'image':
            case 'img':
              return 'image';
            case 'video':
            case 'iframe':
              return 'video';
            case 'table':
              return 'table';
            case 'cell':
            case 'table-cell':
              return 'table-cell';
            case 'code':
            case 'code-block':
              return 'code-block';
            case 'svg':
              return 'svg';
            case 'fragment':
            case 'stateful':
              return 'fragment';
            case 'shape':
            case 'element':
              return 'element';
            default:
              return '';
          }
        }

        function copyAttributeIfMissing(source, target, attributeName) {
          if (!(source instanceof Element) || !(target instanceof Element)) return;
          const targetValue = String(target.getAttribute(attributeName) || '').trim();
          if (targetValue) return;
          const sourceValue = String(source.getAttribute(attributeName) || '').trim();
          if (sourceValue) target.setAttribute(attributeName, sourceValue);
        }

        function preserveAuthoredMarkerContract(source, target) {
          if (!(source instanceof Element) || !(target instanceof Element)) return;
          copyAttributeIfMissing(source, target, AUTHOR_SLIDE_ID_ATTR);
          copyAttributeIfMissing(source, target, AUTHOR_NODE_ID_ATTR);
          copyAttributeIfMissing(source, target, AUTHOR_NODE_KIND_ATTR);
          copyAttributeIfMissing(source, target, AUTHOR_EDITABLE_ATTR);
        }

        function stripAuthoredIdentityAttrs(root, options) {
          if (!(root instanceof Element)) return;
          if (options && options.stripSlideId) {
            root.removeAttribute(AUTHOR_SLIDE_ID_ATTR);
          }
          [root, ...root.querySelectorAll('[' + AUTHOR_NODE_ID_ATTR + ']')].forEach((node) => {
            if (node instanceof Element) {
              node.removeAttribute(AUTHOR_NODE_ID_ATTR);
            }
          });
        }

        function readExplicitEntityKind(el) {
          if (!(el instanceof Element)) return '';
          const authorKind = mapAuthorKindToEntityKind(
            readNonEmptyAttribute(el, [AUTHOR_NODE_KIND_ATTR]),
          );
          if (authorKind) return authorKind;
          const kind = String(el.getAttribute(ENTITY_KIND_ATTR) || '').trim().toLowerCase();
          return KNOWN_ENTITY_KINDS.has(kind) ? kind : '';
        }

        function readPolicyReason(el) {
          if (!(el instanceof Element)) return '';
          return String(el.getAttribute(POLICY_REASON_ATTR) || '').trim();
        }

        function isTypingTarget(target) {
          if (!(target instanceof Element)) return false;
          if (target.isContentEditable) return true;
          return Boolean(target.closest('input, textarea, select, option, [contenteditable=""], [contenteditable="true"], [contenteditable]:not([contenteditable="false"])'));
        }

        function isInlineTextEditingActive(target) {
          const selected = STATE.selectedEl;
          const active = document.activeElement;
          const selectedEditing =
            selected instanceof Element &&
            selected.getAttribute('contenteditable') === 'true' &&
            canEditText(selected);
          if (isTypingTarget(target) || isTypingTarget(active)) return true;
          if (!selectedEditing) return false;
          const selection = window.getSelection();
          const anchorNode = selection ? selection.anchorNode : null;
          if (anchorNode && selected.contains(anchorNode)) return true;
          return active === document.body || active === document.documentElement || active == null;
        }

        function nextNodeId() {
          STATE.seq += 1;
          return 'node-' + STATE.seq;
        }

        function syncSequenceFromDom() {
          const values = Array.from(document.querySelectorAll('[' + EDITOR_MARKER + ']')).map((el) => {
            const m = String(el.getAttribute(EDITOR_MARKER)).match(/node-(\\d+)/);
            return m ? Number(m[1]) : 0;
          });
          STATE.seq = Math.max(STATE.seq, 0, ...values);
        }

        function isCandidate(el) {
          if (!(el instanceof Element)) return false;
          if (EXCLUDED.has(el.tagName)) return false;
          if (el.tagName === 'BR') return false;
          if (!el.closest('[' + SLIDE_MARKER + ']')) return false;
          if (el.closest('script,style,template,svg defs')) return false;
          const svgAncestor = el.closest('svg');
          if (svgAncestor && svgAncestor !== el) return false;
          const preAncestor = el.closest('pre');
          if (preAncestor && preAncestor !== el) return false;
          return true;
        }

        function assignIdsDeep(root) {
          const nodes = [];
          if (root instanceof Element && isCandidate(root)) nodes.push(root);
          if (root instanceof Element) {
            root.querySelectorAll('*').forEach((el) => { if (isCandidate(el)) nodes.push(el); });
          }
          nodes.forEach((el) => {
            if (!el.getAttribute(EDITOR_MARKER)) {
              el.setAttribute(EDITOR_MARKER, nextNodeId());
            }
          });
        }

        function collectSlides() {
          let slides = [];
          const importedSlides = Array.from(document.querySelectorAll('[' + SLIDE_MARKER + ']'));
          const engine = STATE.engine;
          if (importedSlides.length) {
            slides = importedSlides;
          } else if (engine === 'reveal' && window.Reveal && typeof window.Reveal.getSlides === 'function') {
            slides = window.Reveal.getSlides().filter(Boolean);
          } else if (engine === 'remark') {
            slides = Array.from(document.querySelectorAll('.remark-slide-container'));
          } else {
            for (const selector of ROOT_SELECTORS) {
              slides = Array.from(document.querySelectorAll(selector));
              if (slides.length) break;
            }
            if (!slides.length) slides = Array.from(document.querySelectorAll('[data-slide], .slide'));
          }
          let runtimeIndex = 0;
          slides.forEach((slide) => {
            if (!slide.getAttribute(SLIDE_MARKER)) {
              runtimeIndex += 1;
              slide.setAttribute(SLIDE_MARKER, 'runtime-slide-' + runtimeIndex);
            }
            assignIdsDeep(slide);
          });
          syncSequenceFromDom();
          return slides;
        }

        function getSlideTitle(slide) {
          if (!slide) return 'Слайд';
          const slideTitleOverride = String(slide.getAttribute('data-slide-title') || '').trim();
          if (slideTitleOverride) return slideTitleOverride;
          const heading = slide.querySelector('h1, h2, h3, .slide-title, [data-slide-title]');
          if (heading && heading.textContent.trim()) return heading.textContent.trim();
          const text = slide.textContent.replace(/\\s+/g, ' ').trim();
          return text ? text.slice(0, 60) + (text.length > 60 ? '…' : '') : 'Пустой слайд';
        }

        function isSlideHidden(slide) {
          const style = window.getComputedStyle(slide);
          return slide.hidden || slide.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden';
        }

        function getCurrentSlide() {
          const engine = STATE.engine;
          if (engine === 'reveal' && window.Reveal && typeof window.Reveal.getCurrentSlide === 'function') {
            return window.Reveal.getCurrentSlide();
          }
          const signals = ['.slide.active', '.slide.current', '.slide.present', '.active.slide', '.present', '.current', '[aria-current="true"]', '[data-editor-runtime-slide-active="true"]'];
          for (const selector of signals) {
            const el = document.querySelector(selector);
            if (el && STATE.slides.includes(el) && !isSlideHidden(el)) return el;
          }
          const visible = STATE.slides.find((slide) => {
            const style = window.getComputedStyle(slide);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (style.opacity === '0') return false;
            return true;
          });
          if (visible) return visible;
          return STATE.slides.find((slide) => !isSlideHidden(slide)) || STATE.slides[0] || null;
        }

        function currentSlideId() {
          const current = getCurrentSlide();
          return current ? current.getAttribute(SLIDE_MARKER) : null;
        }

        function detectGenericSlideActivationProfile() {
          const slides = STATE.slides || [];
          return {
            usesActiveClass: slides.some((slide) => slide.classList.contains('active')),
            usesCurrentClass: slides.some((slide) => slide.classList.contains('current')),
            usesPresentClass: slides.some((slide) => slide.classList.contains('present')),
            usesPastClass: slides.some((slide) => slide.classList.contains('past')),
            usesFutureClass: slides.some((slide) => slide.classList.contains('future')),
            usesNextClass: slides.some((slide) => slide.classList.contains('next')),
            usesPreviousClass: slides.some((slide) => slide.classList.contains('previous')),
            usesAriaCurrent: slides.some((slide) => slide.hasAttribute('aria-current')),
            usesHiddenAttr: slides.some((slide) => slide.hasAttribute('hidden')),
            usesAriaHidden: slides.some((slide) => slide.hasAttribute('aria-hidden')),
          };
        }

        function applyGenericSlideActivation(target, targetIndex) {
          const slides = STATE.slides || [];
          if (!target || !slides.length) return false;
          const profile = detectGenericSlideActivationProfile();
          const hasKnownActivation =
            profile.usesActiveClass ||
            profile.usesCurrentClass ||
            profile.usesPresentClass ||
            profile.usesPastClass ||
            profile.usesFutureClass ||
            profile.usesNextClass ||
            profile.usesPreviousClass ||
            profile.usesAriaCurrent ||
            profile.usesHiddenAttr ||
            profile.usesAriaHidden;
          if (!hasKnownActivation) return false;
          slides.forEach((slide, index) => {
            const isTarget = slide === target;
            if (profile.usesActiveClass) slide.classList.toggle('active', isTarget);
            if (profile.usesCurrentClass) slide.classList.toggle('current', isTarget);
            if (profile.usesPresentClass) slide.classList.toggle('present', isTarget);
            if (profile.usesPastClass) slide.classList.toggle('past', index < targetIndex);
            if (profile.usesFutureClass) slide.classList.toggle('future', index > targetIndex);
            if (profile.usesNextClass) slide.classList.toggle('next', index === targetIndex + 1);
            if (profile.usesPreviousClass) slide.classList.toggle('previous', index === targetIndex - 1);
            if (profile.usesAriaCurrent) {
              if (isTarget) slide.setAttribute('aria-current', 'true');
              else slide.removeAttribute('aria-current');
            }
            if (profile.usesHiddenAttr) slide.hidden = !isTarget;
            if (profile.usesAriaHidden) slide.setAttribute('aria-hidden', isTarget ? 'false' : 'true');
          });
          return true;
        }

        function applySafeGenericSlideActivation(target) {
          const slides = STATE.slides || [];
          if (!target || !slides.length) return false;
          document.documentElement.style.height = '100%';
          document.documentElement.style.overflow = 'hidden';
          document.body.style.minHeight = '100%';
          document.body.style.height = '100%';
          document.body.style.overflow = 'hidden';
          slides.forEach((slide) => {
            const isTarget = slide === target;
            slide.setAttribute('data-editor-runtime-slide-active', isTarget ? 'true' : 'false');
            if (isTarget) {
              slide.hidden = false;
              slide.setAttribute('aria-hidden', 'false');
              slide.setAttribute('aria-current', 'true');
              slide.removeAttribute('tabindex');
            } else {
              slide.hidden = true;
              slide.setAttribute('aria-hidden', 'true');
              slide.removeAttribute('aria-current');
              slide.setAttribute('tabindex', '-1');
            }
          });
          return true;
        }

        function ensureGenericSingleSlideView() {
          const slides = STATE.slides || [];
          if (slides.length <= 1) return false;
          const profile = detectGenericSlideActivationProfile();
          const hasKnownActivation =
            profile.usesActiveClass ||
            profile.usesCurrentClass ||
            profile.usesPresentClass ||
            profile.usesPastClass ||
            profile.usesFutureClass ||
            profile.usesNextClass ||
            profile.usesPreviousClass ||
            profile.usesAriaCurrent ||
            profile.usesHiddenAttr ||
            profile.usesAriaHidden;
          if (hasKnownActivation) return false;
          const current =
            slides.find((slide) => !isSlideHidden(slide)) ||
            slides.find((slide) => slide.getAttribute('data-editor-runtime-slide-active') === 'true' && !isSlideHidden(slide)) ||
            slides[0] ||
            null;
          return current ? applySafeGenericSlideActivation(current) : false;
        }

        function isElementInViewport(el) {
          if (!(el instanceof Element)) return false;
          const rect = el.getBoundingClientRect();
          return (
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < window.innerHeight &&
            rect.left < window.innerWidth
          );
        }

        function emitSlideActivation(payload) {
          post('slide-activation', {
            requestId: payload.requestId || '',
            requestedSlideId: payload.requestedSlideId || '',
            resolvedSlideId: payload.resolvedSlideId || '',
            activeSlideId: currentSlideId(),
            targetIndex:
              typeof payload.targetIndex === 'number' && Number.isFinite(payload.targetIndex)
                ? payload.targetIndex
                : -1,
            strategy: payload.strategy || 'runtime',
            status: payload.status || 'ok',
            success: Boolean(payload.success),
          });
        }

        function scheduleSlideActivationReport(payload) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              STATE.slides = collectSlides();
              const activeSlideId = currentSlideId();
              const requestedSlideId = String(payload.requestedSlideId || '').trim();
              emitSlideActivation({
                ...payload,
                activeSlideId,
                success: requestedSlideId ? activeSlideId === requestedSlideId : Boolean(activeSlideId),
                status:
                  payload.status ||
                  (requestedSlideId && activeSlideId !== requestedSlideId ? 'mismatch' : 'ok'),
              });
              queueMetadataRefresh();
            });
          });
        }

        function emitRuntimeMetadata() {
          STATE.slides = collectSlides();
          ensureGenericSingleSlideView();
          post('runtime-metadata', {
            engine: STATE.engine,
            activeSlideId: currentSlideId(),
            slides: STATE.slides.map((slide, index) => ({
              id: slide.getAttribute(SLIDE_MARKER),
              title: getSlideTitle(slide),
              titleOverride: slide.getAttribute('data-slide-title') || '',
              preset: slide.getAttribute('data-slide-preset') || '',
              paddingPreset: slide.getAttribute('data-slide-padding-preset') || '',
              index,
              exportable: Boolean(slide.getAttribute(SLIDE_MARKER) && !slide.getAttribute(SLIDE_MARKER).startsWith('runtime-')),
            })),
            editingSupported: Boolean(document.querySelector('[' + EDITOR_MARKER + ']')),
            url: location.href,
          });
        }

        function queueMetadataRefresh() {
          if (STATE.refreshQueued) return;
          STATE.refreshQueued = true;
          requestAnimationFrame(() => {
            STATE.refreshQueued = false;
            emitRuntimeMetadata();
            notifySelectionGeometry();
          });
        }

        function attachEngineHooks() {
          if (STATE.engine === 'reveal' && window.Reveal && typeof window.Reveal.on === 'function') {
            window.Reveal.on('ready', emitRuntimeMetadata);
            window.Reveal.on('slidechanged', () => {
              emitRuntimeMetadata();
              emitSlideActivation({ strategy: 'engine-observed', success: true });
            });
            window.Reveal.on('slidetransitionend', () => {
              emitRuntimeMetadata();
              emitSlideActivation({ strategy: 'engine-observed', success: true });
            });
          }
          if (STATE.slideObserver) STATE.slideObserver.disconnect();
          STATE.slideObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes && Array.from(mutation.addedNodes).forEach((node) => {
                if (node instanceof Element) assignIdsDeep(node);
              });
            });
            queueMetadataRefresh();
          });
          STATE.slideObserver.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'aria-current', 'src'],
          });
        }

        function ensureHelperStyles() {
          let style = document.getElementById(HELPER_STYLE_ID);
          if (!style) {
            style = document.createElement('style');
            style.id = HELPER_STYLE_ID;
            document.head.appendChild(style);
          }
          // Foreign-deck compat: detect if deck manages its own single-slide visibility
          // via class toggles (.active, .present, .past/.future, aria-current, hidden, etc.).
          // When detected, skip opacity/pointer-events/transform overrides so the deck's
          // own navigation continues to work (one slide visible at a time).
          // Only strip transition/animation to reduce flicker during slide navigation.
          // For decks with NO known activation profile, force all slides visible (full override).
          const _deckSlides = STATE.slides || [];
          const _deckHasOwnVisibility = _deckSlides.length > 1 && (
            _deckSlides.some((s) => s.classList.contains('active')) ||
            _deckSlides.some((s) => s.classList.contains('current')) ||
            _deckSlides.some((s) => s.classList.contains('present')) ||
            _deckSlides.some((s) => s.classList.contains('past')) ||
            _deckSlides.some((s) => s.classList.contains('future')) ||
            _deckSlides.some((s) => s.classList.contains('next')) ||
            _deckSlides.some((s) => s.classList.contains('previous')) ||
            _deckSlides.some((s) => s.hasAttribute('aria-current')) ||
            _deckSlides.some((s) => s.hasAttribute('hidden')) ||
            _deckSlides.some((s) => s.hasAttribute('aria-hidden'))
          );
          const _slideEditCss = _deckHasOwnVisibility
            ? '[data-editor-slide-id]{transition:none!important;animation:none!important;}'
            : '[data-editor-slide-id]{opacity:1!important;pointer-events:auto!important;transform:none!important;transition:none!important;animation:none!important;}';

          style.textContent = STATE.editMode
            ? /* [v2.0.7] Selection / hover rings beefed up so they read
                 against busy slide backgrounds. The previous values
                 (2px solid 92% alpha + 8% bg tint) disappeared on
                 photo backgrounds and dark hero sections.

                 - Outline alpha bumped 0.92 → 0.96.
                 - Outer halo box-shadow added: a 4px translucent ring
                   that creates contrast even when the inner outline
                   fights with element color.
                 - Background tint 0.08 → 0.10 — still subtle, but
                   actually visible on light slides.
                 - Smooth transition so selection changes don't snap. */
              '[data-editor-selected="true"] {' +
              'outline: 2px solid rgba(38, 103, 255, 0.96) !important;' +
              'outline-offset: 2px !important;' +
              'background: rgba(38, 103, 255, 0.10) !important;' +
              'box-shadow: 0 0 0 4px rgba(38, 103, 255, 0.18) !important;' +
              'transition: outline-color 120ms ease, box-shadow 120ms ease, background-color 120ms ease !important;' +
              '}' +
              /* [v2.0.7] Hover ring goes from 1px dashed @ 0.5 alpha
                 (basically invisible on dark backgrounds) to 1.5px
                 dashed @ 0.7 alpha + a soft 2px halo. Still visually
                 lighter than the selected ring, but unmistakable. */
              '[data-editor-hover="true"] {' +
              'outline: 1.5px dashed rgba(38, 103, 255, 0.7) !important;' +
              'outline-offset: 2px !important;' +
              'box-shadow: 0 0 0 2px rgba(38, 103, 255, 0.10) !important;' +
              'transition: outline-color 90ms ease, box-shadow 90ms ease !important;' +
              '}' +
              '[data-editor-highlight="ghost"]:not([data-editor-selected="true"]) {' +
              'outline: 2px dashed rgba(38, 103, 255, 0.7) !important;' +
              'outline-offset: 3px !important;' +
              'background: rgba(38, 103, 255, 0.10) !important;' +
              'box-shadow: 0 0 0 4px rgba(38, 103, 255, 0.14) !important;' +
              'transition: background 120ms ease, outline 120ms ease, box-shadow 120ms ease;' +
              '}' +
              /* [v2.0.7] Locked elements show a not-allowed cursor so
                 the user understands WHY the click did not select.
                 Previously the click silently fell through to the
                 parent which felt like a broken hit-test. The hover
                 attribute itself is never set on locked nodes
                 (resolveSelectionFromTarget filters them), so we
                 cannot draw a dedicated locked-hover ring here —
                 the cursor change is the affordance. */
              '[data-editor-locked="true"] {' +
              'cursor: not-allowed !important;' +
              '}' +
              '[data-editor-flash="true"] {' +
              'animation: presentation-editor-flash 720ms ease-out;' +
              '}' +
              '@keyframes presentation-editor-flash {' +
              '0% { box-shadow: 0 0 0 0 rgba(38, 103, 255, 0.48); }' +
              '100% { box-shadow: 0 0 0 18px rgba(38, 103, 255, 0); }' +
              '}' +
              /* Foreign-deck compat (WO-COMPAT): slide visibility override, computed above.
                 Decks with own class-based activation (.active/.present/etc.) get only
                 transition/animation suppression; decks without get full opacity+transform override.
                 Fragments always revealed at full opacity. Stacks always unfolded. */
              _slideEditCss +
              '.fragment{' +
              'opacity:1!important;' +
              'transform:none!important;' +
              'transition:none!important;' +
              'animation:none!important;' +
              '}' +
              'section.stack>section,' +
              '.stack>section{' +
              'display:block!important;' +
              'position:relative!important;' +
              'transition:none!important;' +
              'animation:none!important;' +
              '}'
            : '';
        }

        function canEditText(el) {
          if (!(el instanceof Element)) return false;
          const explicitEditable = parseBooleanLikeAttribute(
            readNonEmptyAttribute(el, [AUTHOR_EDITABLE_ATTR, EDITABLE_ATTR]),
          );
          if (explicitEditable !== null) return explicitEditable;
          if (TEXT_TAGS.has(el.tagName)) return true;
          if (el.tagName === 'DIV' || el.tagName === 'SECTION' || el.tagName === 'ARTICLE' || el.tagName === 'SPAN') {
            const hasComplexChildren = Array.from(el.children).some((child) => !['SPAN','B','STRONG','I','EM','U','SMALL','A','BR'].includes(child.tagName));
            const text = el.textContent.replace(/\\s+/g, ' ').trim();
            return Boolean(text) && !hasComplexChildren;
          }
          return false;
        }

        function normalizePlainTextValue(value) {
          return String(value || '')
            .replace(/\\r\\n?/g, '\\n')
            .replace(/\\u00a0/g, ' ');
        }

        function isPlainTextBlockElement(node) {
          return node instanceof Element && PLAIN_TEXT_BLOCK_TAGS.has(node.tagName);
        }

        function extractPreformattedPlainText(node) {
          if (!node) return '';
          if (node.nodeType === Node.TEXT_NODE) {
            return normalizePlainTextValue(node.textContent || '');
          }
          if (!(node instanceof Element)) return '';
          if (node.tagName === 'BR') return '\\n';
          if (EXCLUDED.has(node.tagName)) return '';
          if (node.tagName === 'IMG' || node.tagName === 'SVG' || node.tagName === 'VIDEO' || node.tagName === 'IFRAME') {
            return '';
          }
          const children = Array.from(node.childNodes);
          let text = '';
          children.forEach((child, index) => {
            const blockChild =
              child instanceof Element && isPlainTextBlockElement(child);
            if (blockChild && index > 0 && !text.endsWith('\\n')) {
              text += '\\n';
            }
            text += extractPreformattedPlainText(child);
            if (
              blockChild &&
              index < children.length - 1 &&
              !text.endsWith('\\n')
            ) {
              text += '\\n';
            }
          });
          return text;
        }

        function extractLineCommitText(el) {
          const fallback = extractPreformattedPlainText(el);
          const raw = typeof el.innerText === 'string' ? el.innerText : fallback;
          return normalizePlainTextValue(raw)
            .replace(/\\n{3,}/g, '\\n\\n')
            .replace(/\\n+$/g, '');
        }

        function buildPlainTextFragment(text) {
          const fragment = document.createDocumentFragment();
          const lines = String(text || '').split('\\n');
          lines.forEach((line, index) => {
            if (index > 0) fragment.appendChild(document.createElement('br'));
            fragment.appendChild(document.createTextNode(line));
          });
          return fragment;
        }

        function shouldPreserveInlineTextWhitespace(el) {
          if (!(el instanceof Element)) return false;
          const entityKind = getEntityKind(el);
          return (
            entityKind === 'code-block' ||
            el.tagName === 'PRE' ||
            (el.tagName === 'CODE' && Boolean(el.closest('pre')))
          );
        }

        function getInlineTextEditSession(el) {
          if (!(el instanceof Element)) return null;
          const nodeId = getSelectionTargetId(el);
          if (!nodeId) return null;
          return STATE.inlineTextEdit && STATE.inlineTextEdit.nodeId === nodeId
            ? STATE.inlineTextEdit
            : null;
        }

        function beginInlineTextEditSession(el) {
          if (!(el instanceof Element) || !canEditText(el)) return null;
          const nodeId = getSelectionTargetId(el);
          if (!nodeId) return null;
          const existing = getInlineTextEditSession(el);
          if (existing) return existing;
          const session = {
            nodeId,
            originalHtml: el.innerHTML,
            dirty: false,
            cancelRequested: false,
          };
          STATE.inlineTextEdit = session;
          return session;
        }

        function clearInlineTextEditSession() {
          STATE.inlineTextEdit = null;
        }

        function markInlineTextEditDirty(el) {
          const session = getInlineTextEditSession(el);
          if (session) session.dirty = true;
        }

        function focusInlineTextEditingElement(el) {
          if (!(el instanceof HTMLElement)) return;
          const restoreFocus = () => {
            if (STATE.selectedEl !== el) return;
            if (el.getAttribute('contenteditable') !== 'true') return;
            if (!getInlineTextEditSession(el)) return;
            try {
              el.focus({ preventScroll: true });
            } catch (error) {
              try { el.focus(); } catch (_focusError) {}
            }
            const selection = window.getSelection();
            const anchorNode = selection ? selection.anchorNode : null;
            if (!anchorNode || !el.contains(anchorNode)) {
              placeCaretAtEnd(el);
            }
          };
          restoreFocus();
          requestAnimationFrame(() => restoreFocus());
        }

        function placeCaretAtEnd(el) {
          if (!(el instanceof Element)) return;
          try {
            const selection = window.getSelection();
            if (!selection) return;
            const range = document.createRange();
            range.selectNodeContents(el);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          } catch (error) {
            // Best-effort caret restoration; detached or hidden nodes can invalidate the range.
          }
        }

        function sanitizeInlineTextCommit(el) {
          const preserveWhitespace = shouldPreserveInlineTextWhitespace(el);
          const nextText = preserveWhitespace
            ? extractPreformattedPlainText(el)
            : extractLineCommitText(el);
          while (el.firstChild) el.removeChild(el.firstChild);
          if (preserveWhitespace) {
            el.textContent = nextText;
          } else if (nextText) {
            el.appendChild(buildPlainTextFragment(nextText));
          }
          return nextText;
        }

        function commitInlineTextEditSession(el) {
          const session = getInlineTextEditSession(el);
          if (!session) return false;
          sanitizeInlineTextCommit(el);
          el.removeAttribute('contenteditable');
          el.removeAttribute('spellcheck');
          const htmlChanged = session.originalHtml !== el.innerHTML;
          const shouldReselect = STATE.selectedEl === el;
          const parentSlide = el.closest('[' + SLIDE_MARKER + ']');
          clearInlineTextEditSession();
          if (shouldReselect) {
            selectElement(el, { focusText: false });
          }
          if (htmlChanged || session.dirty) {
            notifyElementUpdated(el, { editLifecycle: 'commit' });
            if (parentSlide && isTableCellElement(el)) {
              syncSlideToParent(parentSlide, { source: 'text-edit-commit' });
            }
          } else {
            queueMetadataRefresh();
            notifySelectionGeometry();
          }
          return true;
        }

        function cancelInlineTextEditSession(el) {
          const session = getInlineTextEditSession(el);
          if (!session) return false;
          session.cancelRequested = true;
          el.innerHTML = session.originalHtml;
          el.removeAttribute('contenteditable');
          el.removeAttribute('spellcheck');
          clearInlineTextEditSession();
          selectElement(el, { focusText: false });
          return true;
        }

        function insertPlainTextAtSelection(text) {
          const selection = window.getSelection();
          if (!selection || !selection.rangeCount) return false;
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const fragment = buildPlainTextFragment(normalizePlainTextValue(text));
          const lastNode = fragment.lastChild;
          range.insertNode(fragment);
          selection.removeAllRanges();
          const nextRange = document.createRange();
          if (lastNode) {
            nextRange.setStartAfter(lastNode);
            nextRange.collapse(true);
          } else {
            nextRange.selectNodeContents(range.commonAncestorContainer);
            nextRange.collapse(false);
          }
          selection.addRange(nextRange);
          return true;
        }

        function shouldTrapInlineEditingKey(event) {
          if (!(event instanceof KeyboardEvent)) return false;
          if (event.key === 'Escape') return true;
          if (event.altKey) return false;
          if (event.ctrlKey || event.metaKey) return true;
          if (event.key.length === 1) return true;
          return ['Enter', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key);
        }

        function isImageElement(el) {
          return el instanceof Element && el.tagName === 'IMG';
        }

        function isEmbeddedVideoFrame(el) {
          return el instanceof Element && el.tagName === 'IFRAME' && /(youtube|youtu\\.be|vimeo)/i.test(el.getAttribute('src') || '');
        }

        function isVideoElement(el) {
          return el instanceof Element && (el.tagName === 'VIDEO' || isEmbeddedVideoFrame(el));
        }

        function isVideoFrame(el) {
          return isVideoElement(el);
        }

        function isTableCellElement(el) {
          return el instanceof Element && (el.tagName === 'TD' || el.tagName === 'TH');
        }

        function isTableStructuralElement(el) {
          return el instanceof Element && ['TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR'].includes(el.tagName);
        }

        function getNearestTableElement(el, slide) {
          if (!(el instanceof Element)) return null;
          const table = el.closest('table');
          if (!(table instanceof HTMLTableElement)) return null;
          if (slide instanceof Element && getSelectionSlide(table) !== slide) return null;
          return table;
        }

        function getNearestTableCellSelection(el, slide) {
          if (!(el instanceof Element)) return null;
          const cell = isTableCellElement(el) ? el : el.closest('td, th');
          if (!isTableCellElement(cell)) return null;
          if (slide instanceof Element && getSelectionSlide(cell) !== slide) return null;
          return cell;
        }

        function getNearestCodeBlockSelection(el, slide) {
          const start = el instanceof Element ? el : el?.parentElement || null;
          if (!(start instanceof Element)) return null;
          const codeBlock = isCodeBlockElement(start) ? start : start.closest('pre, code');
          if (!isCodeBlockElement(codeBlock)) return null;
          if (slide instanceof Element && getSelectionSlide(codeBlock) !== slide) return null;
          return codeBlock;
        }

        function getRowsForTableSection(section) {
          if (!(section instanceof Element)) return [];
          if (section instanceof HTMLTableSectionElement) return Array.from(section.rows);
          if (section instanceof HTMLTableElement) {
            return Array.from(section.children).filter((child) => child instanceof HTMLTableRowElement);
          }
          return [];
        }

        function getAllTableRows(table) {
          if (!(table instanceof HTMLTableElement)) return [];
          const rows = [];
          if (table.tHead) rows.push(...Array.from(table.tHead.rows));
          Array.from(table.tBodies).forEach((section) => rows.push(...Array.from(section.rows)));
          if (table.tFoot) rows.push(...Array.from(table.tFoot.rows));
          Array.from(table.children).forEach((child) => {
            if (child instanceof HTMLTableRowElement && !rows.includes(child)) rows.push(child);
          });
          return rows;
        }

        function getSelectableTableCell(row, preferredIndex) {
          if (!(row instanceof HTMLTableRowElement)) return null;
          const cells = Array.from(row.cells);
          if (!cells.length) return null;
          const safeIndex = Math.min(
            Math.max(Number.isFinite(preferredIndex) ? preferredIndex : 0, 0),
            cells.length - 1,
          );
          return cells[safeIndex] || cells[0] || null;
        }

        function removeRuntimeTableAttributes(el) {
          if (!(el instanceof Element)) return;
          Array.from(el.attributes).forEach((attr) => {
            if (/^data-editor-/.test(attr.name)) {
              el.removeAttribute(attr.name);
            }
          });
          el.removeAttribute('contenteditable');
          el.removeAttribute('spellcheck');
          el.removeAttribute(AUTHOR_NODE_ID_ATTR);
        }

        function sanitizeClonedTableFragment(root) {
          if (!(root instanceof Element)) return;
          [root, ...root.querySelectorAll('*')].forEach((node) => removeRuntimeTableAttributes(node));
        }

        function createEmptyTableCellClone(sourceCell) {
          if (!isTableCellElement(sourceCell)) return null;
          const clone = sourceCell.cloneNode(false);
          sanitizeClonedTableFragment(clone);
          clone.textContent = '';
          return clone;
        }

        function createEmptyTableRowClone(sourceRow) {
          if (!(sourceRow instanceof HTMLTableRowElement)) return null;
          const clone = sourceRow.cloneNode(false);
          sanitizeClonedTableFragment(clone);
          Array.from(sourceRow.cells).forEach((sourceCell) => {
            const nextCell = createEmptyTableCellClone(sourceCell);
            if (nextCell) clone.appendChild(nextCell);
          });
          return clone;
        }

        function getTableContextFromElement(el) {
          if (!(el instanceof Element)) return null;
          const slide = getSelectionSlide(el);
          const table = getNearestTableElement(el, slide);
          if (!(table instanceof HTMLTableElement)) return null;
          const cell = getNearestTableCellSelection(el, slide);
          const row =
            cell instanceof HTMLTableCellElement
              ? cell.parentElement
              : el instanceof HTMLTableRowElement
                ? el
                : null;
          const section =
            row instanceof HTMLTableRowElement &&
            (row.parentElement instanceof HTMLTableSectionElement ||
              row.parentElement instanceof HTMLTableElement)
              ? row.parentElement
              : null;
          const sectionRows = getRowsForTableSection(section);
          const cellIndex =
            cell instanceof HTMLTableCellElement && row instanceof HTMLTableRowElement
              ? Array.from(row.cells).indexOf(cell)
              : -1;
          const rowIndex =
            row instanceof HTMLTableRowElement ? sectionRows.indexOf(row) : -1;
          return {
            table,
            section,
            sectionRows,
            row: row instanceof HTMLTableRowElement ? row : null,
            cell: cell instanceof HTMLTableCellElement ? cell : null,
            cellIndex,
            rowIndex,
          };
        }

        function finalizeTableMutation(table, nextSelectionEl) {
          if (!(table instanceof HTMLTableElement)) return false;
          ensureUniqueDomIds(table);
          assignIdsDeep(table);
          notifyElementUpdated(table);
          if (nextSelectionEl instanceof Element) {
            selectElement(nextSelectionEl, { focusText: false });
          } else {
            selectElement(table, { focusText: false });
          }
          return true;
        }

        function navigateTableCellByDirection(nodeId, direction) {
          const current = findNodeById(nodeId);
          const context = getTableContextFromElement(current);
          if (!context?.table || !(context.row instanceof HTMLTableRowElement) || !(context.cell instanceof HTMLTableCellElement)) return false;
          const rows = getAllTableRows(context.table);
          const rowIndex = rows.indexOf(context.row);
          if (rowIndex === -1) return false;
          const step = (direction === 'previous' || direction === 'shift-tab') ? -1 : 1;
          const rowCells = Array.from(context.row.cells);
          const inRowCell = rowCells[context.cellIndex + step] || null;
          if (inRowCell instanceof HTMLTableCellElement) {
            selectElement(inRowCell, { focusText: false });
            return true;
          }
          const siblingRow = rows[rowIndex + step] || null;
          const fallbackCell = getSelectableTableCell(
            siblingRow,
            step > 0 ? 0 : Number.MAX_SAFE_INTEGER,
          );
          if (!(fallbackCell instanceof HTMLTableCellElement)) return false;
          selectElement(fallbackCell, { focusText: false });
          return true;
        }

        function insertTableRowRelative(context, placeBelow) {
          if (!context?.table || !(context.row instanceof HTMLTableRowElement)) return false;
          const parent = context.section;
          if (!(parent instanceof HTMLTableSectionElement || parent instanceof HTMLTableElement)) return false;
          const newRow = createEmptyTableRowClone(context.row);
          if (!(newRow instanceof HTMLTableRowElement)) return false;
          const referenceNode = placeBelow ? context.row.nextSibling : context.row;
          parent.insertBefore(newRow, referenceNode || null);
          return finalizeTableMutation(
            context.table,
            getSelectableTableCell(newRow, context.cellIndex),
          );
        }

        function deleteTableRow(context) {
          if (!context?.table || !(context.row instanceof HTMLTableRowElement)) return false;
          const parent = context.section;
          if (!(parent instanceof HTMLTableSectionElement || parent instanceof HTMLTableElement)) return false;
          const rowsBeforeDelete = getRowsForTableSection(parent);
          if (rowsBeforeDelete.length <= 1) return false;
          const rowIndex = rowsBeforeDelete.indexOf(context.row);
          context.row.remove();
          const remainingRows = getRowsForTableSection(parent);
          const nextRow =
            remainingRows[rowIndex] ||
            remainingRows[rowIndex - 1] ||
            getAllTableRows(context.table)[0] ||
            null;
          return finalizeTableMutation(
            context.table,
            getSelectableTableCell(nextRow, context.cellIndex),
          );
        }

        function insertTableColumnRelative(context, placeRight) {
          if (!context?.table || !(context.row instanceof HTMLTableRowElement) || context.cellIndex < 0) return false;
          const allRows = getAllTableRows(context.table);
          if (!allRows.length) return false;
          const insertIndex = placeRight ? context.cellIndex + 1 : context.cellIndex;
          let selectedCell = null;
          allRows.forEach((row) => {
            const rowCells = Array.from(row.cells);
            if (!rowCells.length) return;
            const sourceCell = rowCells[Math.min(context.cellIndex, rowCells.length - 1)];
            const newCell = createEmptyTableCellClone(sourceCell);
            if (!(newCell instanceof HTMLTableCellElement)) return;
            const referenceCell = rowCells[insertIndex] || null;
            row.insertBefore(newCell, referenceCell);
            if (row === context.row) selectedCell = newCell;
          });
          return finalizeTableMutation(context.table, selectedCell);
        }

        function deleteTableColumn(context) {
          if (!context?.table || !(context.row instanceof HTMLTableRowElement) || context.cellIndex < 0) return false;
          const allRows = getAllTableRows(context.table);
          if (!allRows.length) return false;
          const removableRows = allRows.filter((row) => row.cells[context.cellIndex]);
          if (!removableRows.length) return false;
          if (removableRows.some((row) => row.cells.length <= 1)) return false;
          removableRows.forEach((row) => {
            const cell = row.cells[context.cellIndex];
            if (cell) cell.remove();
          });
          return finalizeTableMutation(
            context.table,
            getSelectableTableCell(
              context.row,
              Math.min(context.cellIndex, Math.max(0, context.row.cells.length - 1)),
            ),
          );
        }

        function performTableStructureOperation(nodeId, operation) {
          const context = getTableContextFromElement(findNodeById(nodeId));
          if (!context?.cell) return false;
          switch (operation) {
            case 'insert-row-above':
              return insertTableRowRelative(context, false);
            case 'insert-row-below':
              return insertTableRowRelative(context, true);
            case 'delete-row':
              return deleteTableRow(context);
            case 'insert-column-left':
              return insertTableColumnRelative(context, false);
            case 'insert-column-right':
              return insertTableColumnRelative(context, true);
            case 'delete-column':
              return deleteTableColumn(context);
            default:
              return false;
          }
        }

        function isCodeBlockElement(el) {
          return el instanceof Element && (el.tagName === 'PRE' || (el.tagName === 'CODE' && el.parentElement?.tagName === 'PRE'));
        }

        function isSvgElement(el) {
          return el instanceof Element && (el.tagName === 'SVG' || el.localName === 'svg' || (typeof SVGElement !== 'undefined' && el instanceof SVGElement));
        }

        function isFragmentWrapperElement(el) {
          return el instanceof Element && (el.classList.contains('fragment') || el.hasAttribute('data-fragment-index') || el.hasAttribute('data-stateful') || el.hasAttribute('data-state'));
        }

        const LAYOUT_CONTAINER_TAGS = ['DIV','SECTION','ARTICLE','MAIN','HEADER','FOOTER','ASIDE','NAV','FIGURE','UL','OL','TABLE','THEAD','TBODY','TFOOT','TR'];

        function getLayoutContainerKind(el) {
          if (!(el instanceof Element)) return '';
          if (el.hasAttribute(SLIDE_MARKER)) return 'slide-root';
          const explicitKind = readExplicitEntityKind(el);
          const explicitPolicyKind = String(el.getAttribute(POLICY_KIND_ATTR) || '').trim();
          if (explicitPolicyKind === 'critical-structure') return 'pass-through';
          if (explicitPolicyKind === 'protected-container' || explicitPolicyKind === 'layout-protected') {
            return 'protected';
          }
          const computed = window.getComputedStyle(el);
          const display = String(computed.display || '').toLowerCase();
          const position = String(computed.position || '').toLowerCase();
          const hasChildren = el.children.length > 0;
          const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
          const isExplicitContainer = explicitKind === 'container';
          const isBlockLikeTag = LAYOUT_CONTAINER_TAGS.includes(el.tagName);
          if (display.includes('grid')) return 'grid';
          if (display === 'flex' || display === 'inline-flex') return 'flex';
          if (position === 'relative' || position === 'sticky') {
            if (isExplicitContainer || hasChildren || isBlockLikeTag) return 'positioning-root';
          }
          if (position === 'absolute') {
            return isExplicitContainer && hasChildren ? 'absolute' : '';
          }
          if (position === 'fixed') {
            return isExplicitContainer && hasChildren ? 'fixed' : '';
          }
          if (isExplicitContainer || hasChildren || (isBlockLikeTag && !text)) return 'flow';
          return '';
        }

        function canSelectContainerDirectly(el) {
          const containerKind = getLayoutContainerKind(el);
          if (!containerKind) return false;
          return containerKind !== 'pass-through' && containerKind !== 'absolute' && containerKind !== 'fixed';
        }

        function isSnapEligibleContainerKind(kind) {
          return kind === 'flow' || kind === 'grid' || kind === 'flex' || kind === 'positioning-root' || kind === 'protected' || kind === 'slide-root';
        }

        function getContainerScopeKind(el) {
          if (!(el instanceof Element)) return '';
          if (isSlideRoot(el)) return 'slide-root';
          return getLayoutContainerKind(el);
        }

        function getContainerScopeNodeId(el) {
          if (!(el instanceof Element)) return '';
          return getSelectionTargetId(el) || getSelectionPathNodeId(el);
        }

        function findContainerScopeAncestor(el, slide, options = {}) {
          if (!(el instanceof Element)) return slide instanceof Element ? slide : null;
          const onlySnapEligible = Boolean(options.onlySnapEligible);
          let current = el.parentElement;
          while (current && current !== slide) {
            const kind = getLayoutContainerKind(current);
            if (kind && (!onlySnapEligible || isSnapEligibleContainerKind(kind))) {
              return current;
            }
            current = current.parentElement;
          }
          return slide instanceof Element ? slide : null;
        }

        function serializeManipulationRect(rect) {
          if (!rect) return null;
          return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            right: rect.left + rect.width,
            bottom: rect.top + rect.height,
            centerX: rect.left + rect.width / 2,
            centerY: rect.top + rect.height / 2,
          };
        }

        function isContainerElement(el) {
          if (!(el instanceof Element)) return false;
          if (el.hasAttribute(SLIDE_MARKER)) return false;
          const explicitKind = readExplicitEntityKind(el);
          if (explicitKind === 'container' || explicitKind === 'table') return true;
          if (['slide-root', 'svg', 'fragment', 'table-cell', 'code-block'].includes(explicitKind)) return false;
          if (isImageElement(el) || isVideoElement(el) || isTableCellElement(el) || isCodeBlockElement(el) || isSvgElement(el) || canEditText(el)) return false;
          return Boolean(getLayoutContainerKind(el));
        }

        function isSlideRoot(el) {
          return el instanceof Element && el.hasAttribute(SLIDE_MARKER);
        }

        function isCriticalStructure(el) {
          return el instanceof Element && el.matches('.reveal, .slides, .shower, .deck, .deck-container, .remark-slide-container');
        }

        function getEntityKind(el) {
          if (!(el instanceof Element)) return 'none';
          const explicitKind = readExplicitEntityKind(el);
          if (explicitKind) return explicitKind;
          if (isSlideRoot(el)) return 'slide-root';
          if (isCriticalStructure(el)) return 'protected';
          if (isSvgElement(el)) return 'svg';
          if (isTableStructuralElement(el)) return 'table';
          if (isTableCellElement(el)) return 'table-cell';
          if (isCodeBlockElement(el)) return 'code-block';
          if (isFragmentWrapperElement(el)) return 'fragment';
          if (canEditText(el)) return 'text';
          if (isImageElement(el)) return 'image';
          if (isVideoElement(el)) return 'video';
          if (isContainerElement(el)) return 'container';
          return 'element';
        }

        function createProtectionPolicy(el) {
          const entityKind = getEntityKind(el);
          const explicitPolicyKind = String(el?.getAttribute(POLICY_KIND_ATTR) || '').trim();
          const explicitReason = readPolicyReason(el);
          const policy = {
            kind: 'free',
            reason: explicitReason,
            canEditText: canEditText(el),
            canEditStyles: true,
            canEditAttributes: true,
            canEditHtml: true,
            canEditSlideHtml: false,
            canMove: true,
            canResize: true,
            canNudge: true,
            canReorder: true,
            canDelete: true,
            canDuplicate: true,
            canWrap: true,
            canAddChild: isContainerElement(el),
            canReplaceMedia: isImageElement(el) || isVideoElement(el),
          };
          if (isSlideRoot(el)) {
            return {
              ...policy,
              kind: explicitPolicyKind || 'slide-root',
              reason: 'Корневой контейнер слайда редактируется только в безопасном режиме.',
              canEditText: false,
              canEditAttributes: false,
              canEditHtml: false,
              canEditSlideHtml: true,
              canMove: false,
              canResize: false,
              canNudge: false,
              canReorder: false,
              canDelete: false,
              canDuplicate: false,
              canWrap: false,
              canAddChild: true,
              canReplaceMedia: false,
            };
          }
          if (isCriticalStructure(el)) {
            return {
              ...policy,
              kind: explicitPolicyKind || 'critical-structure',
              reason: 'Системный контейнер deck защищён от прямого редактирования и structural-операций.',
              canEditText: false,
              canEditStyles: false,
              canEditAttributes: false,
              canEditHtml: false,
              canEditSlideHtml: false,
              canMove: false,
              canResize: false,
              canNudge: false,
              canReorder: false,
              canDelete: false,
              canDuplicate: false,
              canWrap: false,
              canAddChild: false,
              canReplaceMedia: false,
            };
          }
          if (explicitPolicyKind === 'critical-structure') {
            return {
              ...policy,
              kind: explicitPolicyKind,
              reason: explicitReason || 'Decorative or structural container stays visible in breadcrumbs, but destructive layout operations are blocked.',
              canEditText: false,
              canEditStyles: false,
              canEditAttributes: false,
              canEditHtml: false,
              canMove: false,
              canResize: false,
              canNudge: false,
              canReorder: false,
              canDelete: false,
              canDuplicate: false,
              canWrap: false,
              canAddChild: false,
              canReplaceMedia: false,
            };
          }
          if (explicitPolicyKind === 'protected-container' || explicitPolicyKind === 'layout-protected') {
            return {
              ...policy,
              kind: explicitPolicyKind,
              reason: explicitReason || 'Protected container stays navigable in breadcrumbs, but destructive geometry and structural operations are blocked.',
              canEditHtml: false,
              canMove: false,
              canResize: false,
              canNudge: false,
              canReorder: false,
              canDelete: false,
              canDuplicate: false,
              canWrap: false,
              canAddChild: false,
            };
          }
          if (entityKind === 'table') {
            return {
              ...policy,
              kind: explicitPolicyKind || 'structured-table',
              reason: explicitReason || 'Таблица импортирована как структурированный DOM-блок: безопаснее редактировать ячейки, а не сырой HTML.',
              canEditText: false,
              canEditAttributes: false,
              canEditHtml: false,
              canDelete: false,
              canWrap: false,
              canAddChild: false,
              canReplaceMedia: false,
            };
          }
          if (entityKind === 'code-block') {
            return {
              ...policy,
              kind: explicitPolicyKind || 'plain-text-block',
              reason: explicitReason || 'Code block сохраняет пробелы и переносы строк. Избегайте raw HTML replacement.',
              canEditAttributes: false,
              canEditHtml: false,
              canAddChild: false,
              canReplaceMedia: false,
            };
          }
          if (entityKind === 'svg') {
            return {
              ...policy,
              kind: explicitPolicyKind || 'svg-object',
              reason: explicitReason || 'Inline SVG импортирован как object-level блок. Внутреннюю векторную структуру нужно сохранять.',
              canEditText: false,
              canEditAttributes: false,
              canEditHtml: false,
              canDelete: false,
              canWrap: false,
              canAddChild: false,
              canReplaceMedia: false,
            };
          }
          if (entityKind === 'fragment') {
            return {
              ...policy,
              kind: explicitPolicyKind || 'stateful-wrapper',
              reason: explicitReason || 'Stateful wrapper сохраняет fragment/state classes и data-* атрибуты.',
              canEditAttributes: false,
              canEditHtml: false,
              canWrap: false,
              canAddChild: false,
              canReplaceMedia: false,
            };
          }
          return policy;
        }

        function isProtectedElement(el) {
          return createProtectionPolicy(el).kind !== 'free';
        }

        function getSelectionTargetId(el) {
          if (!(el instanceof Element)) return '';
          return String(el.getAttribute(EDITOR_MARKER) || '').trim();
        }

        function getSelectionPathNodeId(el) {
          if (!(el instanceof Element)) return '';
          if (isSlideRoot(el)) {
            return String(el.getAttribute(SLIDE_MARKER) || getSelectionTargetId(el)).trim();
          }
          return String(
            el.getAttribute(AUTHOR_NODE_ID_ATTR) ||
              el.getAttribute(EDITOR_MARKER) ||
              el.getAttribute('id') ||
              '',
          ).trim();
        }

        function findSelectionTargetById(nodeId) {
          const normalizedNodeId = String(nodeId || '').trim();
          if (!normalizedNodeId) return null;
          return (
            document.querySelector('[' + EDITOR_MARKER + '="' + cssEscape(normalizedNodeId) + '"]') ||
            document.querySelector('[' + SLIDE_MARKER + '="' + cssEscape(normalizedNodeId) + '"]')
          );
        }

        function getNearestSelectionTarget(target) {
          if (!(target instanceof Element)) return null;
          const direct = target.closest('[' + EDITOR_MARKER + '],[' + SLIDE_MARKER + ']');
          return direct instanceof Element ? direct : null;
        }

        function getSelectionSlide(el) {
          if (!(el instanceof Element)) return null;
          return el.closest('[' + SLIDE_MARKER + ']');
        }

        function getSelectionDepthWithinSlide(el, slide) {
          let depth = 0;
          let current = el instanceof Element ? el : null;
          while (current && current !== slide && current.parentElement) {
            depth += 1;
            current = current.parentElement;
          }
          return depth;
        }

        function isSelectionPathElement(el, selectedEl, leafEl) {
          if (!(el instanceof Element)) return false;
          if (el === selectedEl || el === leafEl || isSlideRoot(el)) return true;
          return el.hasAttribute(AUTHOR_NODE_ID_ATTR);
        }

        function getSelectionBreadcrumbLabel(el, entityKind, fallbackId) {
          if (!(el instanceof Element)) return fallbackId || 'Node';
          if (isSlideRoot(el)) {
            const title = getSlideTitle(el);
            return title || fallbackId || 'Slide';
          }
          const authoredId = String(el.getAttribute(AUTHOR_NODE_ID_ATTR) || '').trim();
          if (authoredId) return authoredId;
          if (entityKind === 'text') {
            const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
            if (text) return text.slice(0, 32) + (text.length > 32 ? '…' : '');
          }
          if (fallbackId) return fallbackId;
          return el.tagName.toLowerCase();
        }

        function getNextSelectionAncestor(el, slide) {
          let current = el?.parentElement || null;
          while (current) {
            if (current === slide) return current;
            if (current.hasAttribute(EDITOR_MARKER)) return current;
            current = current.parentElement;
          }
          return null;
        }

        function buildSelectionPathEntries(selectedEl, options) {
          if (!(selectedEl instanceof Element)) return [];
          const selectionLeafEl =
            options?.selectionLeafEl instanceof Element ? options.selectionLeafEl : selectedEl;
          const slide = getSelectionSlide(selectedEl) || getSelectionSlide(selectionLeafEl);
          if (!(slide instanceof Element)) return [];
          const entries = [];
          const seen = new Set();
          const pushEntry = (node) => {
            if (!(node instanceof Element)) return;
            const selectionNodeId = getSelectionTargetId(node);
            const nodeId = getSelectionPathNodeId(node);
            const dedupeKey = selectionNodeId || nodeId;
            if (!dedupeKey || seen.has(dedupeKey)) return;
            seen.add(dedupeKey);
            const entityKind = getEntityKind(node);
            entries.push({
              el: node,
              entityKind,
              isCurrent: selectionNodeId === getSelectionTargetId(selectedEl),
              isLeaf: node === selectionLeafEl,
              label: getSelectionBreadcrumbLabel(node, entityKind, nodeId),
              nodeId,
              selectionNodeId,
            });
          };
          let current = selectionLeafEl;
          while (current) {
            if (isSelectionPathElement(current, selectedEl, selectionLeafEl)) {
              pushEntry(current);
            }
            if (current === slide) break;
            current = getNextSelectionAncestor(current, slide);
          }
          if (!entries.some((entry) => entry.selectionNodeId === getSelectionTargetId(selectedEl))) {
            pushEntry(selectedEl);
          }
          if (!entries.some((entry) => entry.el === slide)) {
            pushEntry(slide);
          }
          return entries;
        }

        function scoreSelectionCandidate(candidate) {
          const el = candidate?.el;
          if (!(el instanceof Element)) return Number.NEGATIVE_INFINITY;
          const entityKind = getEntityKind(el);
          const policy = createProtectionPolicy(el);
          const computed = window.getComputedStyle(el);
          const explicitEditable = String(el.getAttribute(AUTHOR_EDITABLE_ATTR) || '').trim().toLowerCase();
          const rect = getRect(el);
          const area = Math.max(1, rect.width * rect.height);
          let score = 0;
          if (candidate.stackIndex >= 0) {
            score += Math.max(0, 16 - candidate.stackIndex * 2);
          }
          if (entityKind === 'text') score += 180;
          else if (entityKind === 'image' || entityKind === 'video' || entityKind === 'table-cell' || entityKind === 'code-block' || entityKind === 'svg' || entityKind === 'fragment') score += 132;
          else if (entityKind === 'table') score += 108;
          else if (entityKind === 'element') score += 92;
          else if (entityKind === 'container') score += 56;
          else if (entityKind === 'slide-root') score -= 180;
          else if (entityKind === 'protected') score -= 72;
          if (canEditText(el)) score += 44;
          if (explicitEditable === 'true') score += 28;
          if (explicitEditable === 'false') score -= 16;
          if (el.hasAttribute(AUTHOR_NODE_ID_ATTR)) score += 18;
          if (policy.kind !== 'free' && !isSlideRoot(el)) {
            score -= entityKind === 'svg' || entityKind === 'fragment' ? 16 : 160;
          }
          // [v0.18.4] Reduced penalty for absolutely positioned elements to improve selectability
          if (computed.position === 'fixed' && !canEditText(el) && explicitEditable !== 'true') {
            score -= 12;
          }
          if (!el.children.length) score += 12;
          else score -= Math.min(28, el.children.length * 4);
          score += Math.min(18, getSelectionDepthWithinSlide(el, candidate.slide));
          score -= Math.min(72, Math.log(area + 1) * 3.4);
          return score;
        }

        function isPreferredSelectionLeafCandidate(el) {
          if (!(el instanceof Element)) return false;
          const entityKind = getEntityKind(el);
          if (
            entityKind === 'protected' ||
            entityKind === 'slide-root' ||
            entityKind === 'container'
          ) {
            return false;
          }
          if (isProtectedElement(el)) return false;
          return (
            entityKind === 'text' ||
            entityKind === 'image' ||
            entityKind === 'video' ||
            entityKind === 'table-cell' ||
            entityKind === 'code-block' ||
            entityKind === 'svg' ||
            entityKind === 'fragment' ||
            canEditText(el)
          );
        }

        function scorePreferredSelectionLeaf(candidate, scopeEl, slide) {
          if (!(candidate instanceof Element)) return Number.NEGATIVE_INFINITY;
          const entityKind = getEntityKind(candidate);
          const explicitEditable = String(candidate.getAttribute(AUTHOR_EDITABLE_ATTR) || '').trim().toLowerCase();
          const authoredId = String(candidate.getAttribute(AUTHOR_NODE_ID_ATTR) || '').trim();
          const text = String(candidate.textContent || '').replace(/\s+/g, ' ').trim();
          const tagName = String(candidate.tagName || '').toUpperCase();
          let score = scoreSelectionCandidate({
            el: candidate,
            slide,
            stackIndex: Number.POSITIVE_INFINITY,
          });
          if (entityKind === 'text') score += 140;
          if (entityKind === 'code-block') score += 228;
          if (entityKind === 'svg') score += 180;
          if (entityKind === 'fragment') score += 160;
          if (/^H[1-6]$/.test(tagName)) score += 42;
          else if (tagName === 'P') score += 16;
          else if (tagName === 'DIV' || tagName === 'SPAN') score -= 10;
          if (authoredId) score += 96;
          else score -= 28;
          if (explicitEditable === 'true') score += 24;
          if (explicitEditable === 'false') score -= 20;
          if (text) {
            if (text.length <= 40) score += 12;
            else if (text.length >= 120) score -= 12;
          }
          let distance = 0;
          let current = candidate;
          while (current && current !== scopeEl && current !== slide) {
            distance += 1;
            current = current.parentElement;
          }
          score -= distance * 6;
          return score;
        }

        function findPreferredSelectionLeafWithinScope(scopeEl, slide) {
          if (!(scopeEl instanceof Element)) return null;
          const candidates = [];
          if (isPreferredSelectionLeafCandidate(scopeEl)) candidates.push(scopeEl);
          scopeEl.querySelectorAll('[' + EDITOR_MARKER + ']').forEach((node) => {
            if (!(node instanceof Element)) return;
            if (getSelectionSlide(node) !== slide) return;
            if (!isPreferredSelectionLeafCandidate(node)) return;
            candidates.push(node);
          });
          if (!candidates.length) return null;
          const authoredCandidates = candidates.filter((node) =>
            Boolean(String(node.getAttribute(AUTHOR_NODE_ID_ATTR) || '').trim()),
          );
          const scopedCandidates = authoredCandidates.length ? authoredCandidates : candidates;
          return scopedCandidates
            .map((node) => ({
              node,
              score: scorePreferredSelectionLeaf(node, scopeEl, slide),
            }))
            .sort((left, right) => right.score - left.score)[0]?.node || null;
        }

        function resolvePreferredSelectionLeaf(el, slide) {
          if (!(el instanceof Element)) return null;
          const tableCell = getNearestTableCellSelection(el, slide);
          if (tableCell instanceof Element) return tableCell;
          const entityKind = getEntityKind(el);
          if (entityKind === 'container' && canSelectContainerDirectly(el)) {
            return el;
          }
          if (isPreferredSelectionLeafCandidate(el)) {
            return el;
          }
          let current = el;
          while (current) {
            const preferredLeaf = findPreferredSelectionLeafWithinScope(current, slide);
            if (preferredLeaf instanceof Element) return preferredLeaf;
            if (current === slide) break;
            current = getNextSelectionAncestor(current, slide);
          }
          return el;
        }

        // [LAYER-MODEL v2] cached wrapper for collectSelectionCandidates
        function getOrCollectCandidates(target, clientX, clientY) {
          const dx = clientX - STATE.cachedCandidateStackPos.x;
          const dy = clientY - STATE.cachedCandidateStackPos.y;
          const age = Date.now() - STATE.cachedCandidateStackPos.timestamp;
          if (
            STATE.cachedCandidateStack.length &&
            Math.hypot(dx, dy) < 4 &&
            age < 100
          ) {
            return STATE.cachedCandidateStack;
          }
          const result = collectSelectionCandidates(target, clientX, clientY);
          STATE.cachedCandidateStack = result;
          STATE.cachedCandidateStackPos = { x: clientX, y: clientY, timestamp: Date.now() };
          return result;
        }

        function collectSelectionCandidates(target, clientX, clientY) {
          const fallbackTarget = getNearestSelectionTarget(target);
          const stack = Number.isFinite(clientX) && Number.isFinite(clientY)
            ? document.elementsFromPoint(clientX, clientY)
            : [];
          const slide =
            stack
              .map((entry) => getSelectionSlide(entry))
              .find((entry) => entry instanceof Element) ||
            getSelectionSlide(fallbackTarget);
          if (!(slide instanceof Element)) return [];
          const candidatesById = new Map();
          const pushCandidate = (node, stackIndex) => {
            if (!(node instanceof Element)) return;
            if (getSelectionSlide(node) !== slide) return;
            const selectionNodeId = getSelectionTargetId(node);
            const nodeId = getSelectionPathNodeId(node);
            const dedupeKey = selectionNodeId || nodeId;
            if (!dedupeKey) return;
            const existing = candidatesById.get(dedupeKey);
            if (existing && existing.stackIndex <= stackIndex) return;
            candidatesById.set(dedupeKey, {
              el: node,
              nodeId,
              selectionNodeId,
              slide,
              stackIndex,
            });
          };
          stack.forEach((entry, index) => {
            const candidate = getNearestSelectionTarget(entry);
            if (candidate instanceof Element) {
              pushCandidate(candidate, index);
            }
          });
          let current = fallbackTarget;
          while (current) {
            pushCandidate(current, Number.POSITIVE_INFINITY);
            if (current === slide) break;
            current = getNextSelectionAncestor(current, slide);
          }
          // [v0.18.0] Filter out locked elements
          return Array.from(candidatesById.values()).filter(candidate => {
            return !(candidate.el instanceof Element && candidate.el.getAttribute('data-editor-locked') === 'true');
          });
        }

        function resetClickThroughState() {
          STATE.clickThroughState = { x: 0, y: 0, timestamp: 0, index: -1, candidates: [] };
        }

        function updateClickThroughState(target, clientX, clientY) {
          const allCandidates = getOrCollectCandidates(target, clientX, clientY);
          const sorted = allCandidates
            .filter((candidate) => candidate.selectionNodeId || candidate.nodeId)
            .map((candidate) => ({ ...candidate, _score: scoreSelectionCandidate(candidate) }))
            .sort((left, right) => right._score - left._score);
          STATE.clickThroughState = {
            x: clientX,
            y: clientY,
            timestamp: Date.now(),
            index: 0,
            candidates: sorted,
          };
          return STATE.clickThroughState;
        }

        // [v0.24.0] Click-through timeout: cycling state expires after 2 s of inactivity
        // so a "stale" selection doesn't surprise the user when they re-click the overlay.
        const CLICK_THROUGH_TTL_MS = 2000;

        // options.ttl: max age in ms for the cycling state to be valid.
        // Defaults to Infinity for direct iframe clicks (no staleness limit),
        // but proxy-select-at-point passes CLICK_THROUGH_TTL_MS so stale overlay
        // clicks (e.g. user clicked overlay 3 s later) don't surprise the user.
        function trySelectFromClickThroughState(clientX, clientY, options = {}) {
          const cts = STATE.clickThroughState;
          const dx = clientX - cts.x;
          const dy = clientY - cts.y;
          const ttl = typeof options.ttl === 'number' ? options.ttl : Infinity;
          const age = Date.now() - cts.timestamp;
          if (!(cts.candidates.length > 1 && Math.hypot(dx, dy) < 6 && age < ttl)) {
            return false;
          }
          cts.index = (cts.index + 1) % cts.candidates.length;
          cts.timestamp = Date.now();
          const picked = cts.candidates[cts.index];
          if (!(picked?.el && picked.el.isConnected)) return false;
          const pathEntries = buildSelectionPathEntries(picked.el, {
            selectionLeafEl: picked.el,
          });
          if (!pathEntries.length) return false;
          selectElement(picked.el, {
            focusText: false,
            selectionLeafEl: picked.el,
            selectionPathEntries: pathEntries,
          });
          return true;
        }

        function resetClickThroughSelection() {
          const cts = STATE.clickThroughState;
          if (cts.index > 0 && cts.candidates.length > 1) {
            cts.index = 0;
            cts.timestamp = 0;
            const top = cts.candidates[0];
            if (top?.el && top.el.isConnected) {
              const pathEntries = buildSelectionPathEntries(top.el, {
                selectionLeafEl: top.el,
              });
              if (pathEntries.length) {
                selectElement(top.el, {
                  focusText: false,
                  selectionLeafEl: top.el,
                  selectionPathEntries: pathEntries,
                });
                return true;
              }
            }
          }
          resetClickThroughState();
          return false;
        }

        function resolveSelectionFromTarget(target, options) {
          const clientX = Number(options?.clientX);
          const clientY = Number(options?.clientY);
          const targetEl =
            target instanceof Element ? target : target?.parentElement || null;
          const immediateCodeBlock = getNearestCodeBlockSelection(
            targetEl,
            getSelectionSlide(targetEl),
          );
          if (immediateCodeBlock instanceof Element) {
            const pathEntries = buildSelectionPathEntries(immediateCodeBlock, {
              selectionLeafEl: immediateCodeBlock,
            });
            if (pathEntries.length) {
              return {
                pathEntries,
                selectedEl: immediateCodeBlock,
                selectionLeafEl: immediateCodeBlock,
              };
            }
          }
          const candidates = getOrCollectCandidates(target, clientX, clientY);
          if (!candidates.length) return null;
          // [LAYER-MODEL v2] container mode — prefer containers over leaves
          if (options?.containerMode) {
            const containerCandidates = candidates
              .filter((c) => {
                const ek = getEntityKind(c.el);
                return ek === 'container' || ek === 'element' || ek === 'slide-root';
              })
              .filter((c) => Number.isFinite(c.stackIndex))
              .sort((a, b) => a.stackIndex - b.stackIndex);
            if (containerCandidates.length) {
              const picked = containerCandidates[0];
              const pathEntries = buildSelectionPathEntries(picked.el, {
                selectionLeafEl: picked.el,
              });
              if (pathEntries.length) {
                return {
                  pathEntries,
                  selectedEl: picked.el,
                  selectionLeafEl: picked.el,
                };
              }
            }
          }
          const topmostCandidate = candidates
            .filter((candidate) => Number.isFinite(candidate.stackIndex))
            .sort((left, right) => left.stackIndex - right.stackIndex)[0] || null;
          const directCodeBlockCandidate = candidates
            .filter(
              (candidate) =>
                Number.isFinite(candidate.stackIndex) &&
                getEntityKind(candidate.el) === 'code-block',
            )
            .sort((left, right) => left.stackIndex - right.stackIndex)[0] || null;
          const directCodeBlock = getNearestCodeBlockSelection(
            target instanceof Element ? target : target?.parentElement,
            topmostCandidate?.slide || candidates[0]?.slide || null,
          );
          const bestCandidate =
            directCodeBlockCandidate
              ? directCodeBlockCandidate
              : directCodeBlock instanceof Element
              ? candidates.find((candidate) => candidate.el === directCodeBlock) || {
                  el: directCodeBlock,
                  slide: getSelectionSlide(directCodeBlock),
                  stackIndex: Number.POSITIVE_INFINITY,
                }
              : topmostCandidate?.el && getEntityKind(topmostCandidate.el) === 'container'
              ? topmostCandidate
              : candidates
                  .map((candidate) => ({ candidate, score: scoreSelectionCandidate(candidate) }))
                  .sort((left, right) => right.score - left.score)[0]?.candidate;
          if (!bestCandidate?.el) return null;
          const selectionLeafEl =
            resolvePreferredSelectionLeaf(bestCandidate.el, bestCandidate.slide) ||
            bestCandidate.el;
          const pathEntries = buildSelectionPathEntries(selectionLeafEl, {
            selectionLeafEl,
          });
          if (!pathEntries.length) return null;
          const currentPathIndex = pathEntries.findIndex(
            (entry) => entry.selectionNodeId === STATE.selectedNodeId,
          );
          const sameLeaf =
            String(STATE.selectionLeafNodeId || '').trim() ===
            String(pathEntries[0]?.nodeId || '').trim();
          if (options?.cycleAncestors) {
            const nextIndex =
              sameLeaf && currentPathIndex !== -1
                ? (currentPathIndex + 1) % pathEntries.length
                : Math.min(1, pathEntries.length - 1);
            return {
              pathEntries,
              selectedEl: pathEntries[nextIndex].el,
              selectionLeafEl,
            };
          }
          if (options?.deepSelect) {
            const scoredCandidates = candidates
              .map((c) => ({ c, score: scoreSelectionCandidate(c) }))
              .sort((a, b) => b.score - a.score)
              .map((x) => x.c);
            if (scoredCandidates.length) {
              const deepCurrentIdx = scoredCandidates.findIndex(
                (c) => (c.selectionNodeId || c.nodeId) === STATE.selectedNodeId,
              );
              const deepNextIdx =
                deepCurrentIdx !== -1
                  ? (deepCurrentIdx + 1) % scoredCandidates.length
                  : 0;
              const picked = scoredCandidates[deepNextIdx];
              if (picked?.el) {
                const deepLeaf =
                  resolvePreferredSelectionLeaf(picked.el, picked.slide) ||
                  picked.el;
                const deepPath = buildSelectionPathEntries(deepLeaf, {
                  selectionLeafEl: deepLeaf,
                });
                if (deepPath.length) {
                  return {
                    pathEntries: deepPath,
                    selectedEl: picked.el,
                    selectionLeafEl: deepLeaf,
                  };
                }
              }
            }
          }
          return {
            pathEntries,
            selectedEl: selectionLeafEl,
            selectionLeafEl,
          };
        }

        function getEditableElementFromTarget(target) {
          return getNearestSelectionTarget(target);
        }

        function normalizeDomId(value) {
          return String(value || '').replace(/\\s+/g, '-').trim();
        }

        function collectUsedDomIds(exceptRoot) {
          const used = new Set();
          document.querySelectorAll('[id]').forEach((el) => {
            if (exceptRoot instanceof Element && (el === exceptRoot || exceptRoot.contains(el))) return;
            const id = normalizeDomId(el.getAttribute('id') || '');
            if (id) used.add(id);
          });
          return used;
        }

        function claimUniqueDomId(baseId, usedIds) {
          const normalized = normalizeDomId(baseId);
          if (!normalized) return '';
          let candidate = normalized;
          let index = 2;
          while (usedIds.has(candidate)) {
            candidate = normalized + '-copy' + (index > 2 ? '-' + index : '');
            index += 1;
          }
          usedIds.add(candidate);
          return candidate;
        }

        function ensureUniqueDomIds(root, exceptRoot) {
          if (!(root instanceof Element)) return;
          const usedIds = collectUsedDomIds(exceptRoot);
          const nodes = [];
          if (root.id) nodes.push(root);
          root.querySelectorAll('[id]').forEach((el) => nodes.push(el));
          nodes.forEach((el) => {
            const uniqueId = claimUniqueDomId(el.id, usedIds);
            if (uniqueId) el.id = uniqueId; else el.removeAttribute('id');
          });
        }

        function clearHover() {
          document.querySelectorAll('[data-editor-hover="true"]').forEach((el) => el.removeAttribute('data-editor-hover'));
        }

        function clearSelection() {
          document.querySelectorAll('[data-editor-selected="true"]').forEach((el) => {
            el.removeAttribute('data-editor-selected');
            if (el.isContentEditable) el.removeAttribute('contenteditable');
            el.removeAttribute('spellcheck');
          });
          document.querySelectorAll('[' + FLASH_ATTR + '="true"]').forEach((el) => el.removeAttribute(FLASH_ATTR));
          if (STATE.resizeObserver) {
            STATE.resizeObserver.disconnect();
          }
          if (STATE.flashTimer) {
            window.clearTimeout(STATE.flashTimer);
            STATE.flashTimer = null;
          }
          STATE.selectedEl = null;
          STATE.selectedNodeId = null;
          STATE.selectionLeafNodeId = null;
          STATE.selectionPath = [];
        }

        function getRect(el) {
          const r = el.getBoundingClientRect();
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        }

        function getAttributes(el) {
          const attrs = {};
          for (const attr of Array.from(el.attributes)) {
            if (/^data-editor-/.test(attr.name)) continue;
            if (attr.name === 'contenteditable' || attr.name === 'spellcheck') continue;
            attrs[attr.name] = attr.value;
          }
          return attrs;
        }

        function isTranslateOnlyTransformValue(value) {
          const raw = String(value || '').trim();
          if (!raw || raw === 'none') return true;
          const functions = raw.match(/[a-zA-Z0-9]+\\([^)]*\\)/g);
          if (!functions || !functions.length) return false;
          return functions.every((fn) => /^translate(?:3d|x|y)?\\(/i.test(fn.trim()));
        }

        function hasComplexTransformOnElement(el) {
          return el instanceof Element && !isTranslateOnlyTransformValue(window.getComputedStyle(el).transform);
        }

        function hasTransformedAncestor(el, stopNode) {
          let current = el?.parentElement || null;
          while (current && current !== stopNode && current !== document.body && current !== document.documentElement) {
            if (hasComplexTransformOnElement(current)) return true;
            current = current.parentElement;
          }
          return false;
        }

        function hasNonDefaultZoomOnChain(el, stopNode) {
          let current = el instanceof Element ? el : null;
          while (current && current !== stopNode && current !== document.body && current !== document.documentElement) {
            const zoom = String(window.getComputedStyle(current).zoom || '').trim();
            if (zoom && zoom !== '1' && zoom !== 'normal') return true;
            current = current.parentElement;
          }
          return false;
        }

        function getDirectManipulationSafety(el, slide) {
          if (!(el instanceof Element)) {
            return {
              safe: false,
              reason: 'Элемент больше недоступен для прямого редактирования.',
            };
          }
          if (hasComplexTransformOnElement(el)) {
            return {
              safe: false,
              reason:
                'У элемента есть собственный transform. Direct manipulation пока отключён, чтобы не сломать layout; используй инспектор для точных значений.',
            };
          }
          if (slide instanceof Element && hasComplexTransformOnElement(slide)) {
            return {
              safe: false,
              reason:
                'Корневой контейнер слайда использует transform. Direct manipulation пока отключён, чтобы не уехать относительно canvas; используй инспектор.',
            };
          }
          if (hasTransformedAncestor(el, slide)) {
            return {
              safe: false,
              reason:
                'Элемент находится внутри transformed-контейнера. Direct manipulation пока отключён, чтобы не уехать относительно canvas; используй инспектор.',
            };
          }
          if (hasNonDefaultZoomOnChain(el, slide) || (slide instanceof Element && hasNonDefaultZoomOnChain(slide, null))) {
            return {
              safe: false,
              reason:
                'В этой зоне используется zoom. Direct manipulation пока отключён, чтобы не дать неверные координаты; используй инспектор.',
            };
          }
          return { safe: true, reason: '' };
        }

        function collectComputed(el) {
          const style = window.getComputedStyle(el);
          return {
            fontSize: style.fontSize,
            color: style.color,
            textAlign: style.textAlign,
            fontWeight: style.fontWeight,
            fontStyle: style.fontStyle,
            textDecorationLine: style.textDecorationLine,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderColor,
            borderStyle: style.borderStyle,
            borderWidth: style.borderWidth,
            width: style.width,
            height: style.height,
            left: style.left,
            top: style.top,
            position: style.position,
            display: style.display,
            zIndex: style.zIndex,
            margin: style.margin,
            padding: style.padding,
            transform: style.transform,
            translate: style.translate,
            inlineStyle: el.getAttribute('style') || '',
          };
        }

        function collectSnapTargets(el, slide) {
          if (!(slide instanceof Element)) return [];
          return Array.from(slide.querySelectorAll('[' + EDITOR_MARKER + ']'))
            .filter((node) => node instanceof Element && node !== el && node !== slide && !el.contains(node))
            .map((node) => ({ nodeId: node.getAttribute(EDITOR_MARKER), rect: getRect(node) }))
            .filter((entry) => entry.rect.width > 4 && entry.rect.height > 4)
            .slice(0, 80)
            .map((entry) => ({
              nodeId: entry.nodeId,
              left: entry.rect.left,
              top: entry.rect.top,
              width: entry.rect.width,
              height: entry.rect.height,
              right: entry.rect.left + entry.rect.width,
              bottom: entry.rect.top + entry.rect.height,
              centerX: entry.rect.left + entry.rect.width / 2,
              centerY: entry.rect.top + entry.rect.height / 2,
            }));
        }

        function resolveManipulationInteractionElement(el, pathEntries) {
          if (!(el instanceof Element)) return null;
          const selectedKind = getEntityKind(el);
          if (
            selectedKind !== 'text' &&
            selectedKind !== 'table-cell' &&
            selectedKind !== 'code-block'
          ) {
            return el;
          }
          const entries = Array.isArray(pathEntries) ? pathEntries : [];
          for (const entry of entries) {
            const candidate = entry?.el;
            if (!(candidate instanceof Element) || candidate === el || isSlideRoot(candidate)) continue;
            const candidateKind = getEntityKind(candidate);
            const candidatePolicy = createProtectionPolicy(candidate);
            if (candidateKind === 'container' && (candidatePolicy.canMove || candidatePolicy.canResize)) {
              return candidate;
            }
            if (candidateKind === 'container' && candidatePolicy.kind !== 'free') {
              return el;
            }
          }
          return el;
        }

        function collectManipulationContext(el, options) {
          if (!(el instanceof Element)) return null;
          const pathEntries = Array.isArray(options?.selectionPathEntries)
            ? options.selectionPathEntries
            : buildSelectionPathEntries(el, {
              selectionLeafEl: options?.selectionLeafEl instanceof Element ? options.selectionLeafEl : el,
            });
          const interactionEl = resolveManipulationInteractionElement(el, pathEntries) || el;
          const slide = interactionEl.closest('[' + SLIDE_MARKER + ']');
          const rect = getRect(interactionEl);
          const slideRect = slide ? getRect(slide) : null;
          const parentContainerEl = findContainerScopeAncestor(interactionEl, slide, {
            onlySnapEligible: false,
          });
          const snapRootEl = findContainerScopeAncestor(interactionEl, slide, {
            onlySnapEligible: true,
          });
          const snapRect = snapRootEl ? getRect(snapRootEl) : slideRect;
          const aspectRatio = isImageElement(interactionEl) && interactionEl.naturalWidth && interactionEl.naturalHeight
            ? interactionEl.naturalWidth / interactionEl.naturalHeight
            : (rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 1);
          const directManipulation = getDirectManipulationSafety(interactionEl, slide);
          return {
            slideRect: serializeManipulationRect(slideRect),
            snapRect: serializeManipulationRect(snapRect),
            snapTargets: collectSnapTargets(interactionEl, snapRootEl || slide),
            aspectRatio,
            hasComplexTransform: hasComplexTransformOnElement(interactionEl),
            hasTransformedAncestor: hasTransformedAncestor(interactionEl, slide),
            directManipulationSafe: directManipulation.safe,
            directManipulationReason: directManipulation.reason,
            interactionNodeId: getSelectionTargetId(interactionEl) || getSelectionPathNodeId(interactionEl),
            interactionRect: rect,
            interactionEntityKind: getEntityKind(interactionEl),
            interactionContainerKind: getContainerScopeKind(interactionEl),
            interactionPolicy: createProtectionPolicy(interactionEl),
            interactionUsesAncestor: interactionEl !== el,
            parentContainerNodeId: getContainerScopeNodeId(parentContainerEl),
            parentContainerKind: getContainerScopeKind(parentContainerEl),
            snapRootNodeId: getContainerScopeNodeId(snapRootEl),
            snapRootKind: getContainerScopeKind(snapRootEl),
          };
        }

        function buildElementBridgePayload(el, options) {
          if (!(el instanceof Element)) return null;
          const selectionLeafEl =
            options?.selectionLeafEl instanceof Element ? options.selectionLeafEl : el;
          const selectionPathEntries = Array.isArray(options?.selectionPathEntries)
            ? options.selectionPathEntries
            : buildSelectionPathEntries(el, { selectionLeafEl });
          const entityKind = getEntityKind(el);
          return {
            nodeId: getSelectionTargetId(el),
            slideId: el.closest('[' + SLIDE_MARKER + ']')?.getAttribute(SLIDE_MARKER) || null,
            tag: el.tagName,
            html: el.outerHTML,
            attrs: getAttributes(el),
            computed: collectComputed(el),
            rect: getRect(el),
            entityKind,
            canEditText: canEditText(el),
            isImage: isImageElement(el),
            isVideo: entityKind === 'video',
            isContainer: isContainerElement(el),
            isSlideRoot: isSlideRoot(el),
            isProtected: isProtectedElement(el),
            isTable: entityKind === 'table',
            isTableCell: entityKind === 'table-cell',
            isCodeBlock: entityKind === 'code-block',
            isSvg: entityKind === 'svg',
            isFragment: entityKind === 'fragment',
            isTextEditing: Boolean(el.isContentEditable),
            editLifecycle:
              typeof options?.editLifecycle === 'string' ? options.editLifecycle : '',
            protectionPolicy: createProtectionPolicy(el),
            selectionLeafNodeId: selectionPathEntries[0]?.nodeId || getSelectionPathNodeId(selectionLeafEl),
            selectionPath: selectionPathEntries.map((entry) => ({
              nodeId: entry.nodeId,
              selectionNodeId: entry.selectionNodeId,
              entityKind: entry.entityKind,
              label: entry.label,
              isLeaf: Boolean(entry.isLeaf),
              isCurrent: Boolean(entry.isCurrent),
            })),
            manipulationContext: collectManipulationContext(el, {
              selectionLeafEl,
              selectionPathEntries,
            }),
          };
        }

        function postSelection(el, options) {
          const payload = buildElementBridgePayload(el, options);
          if (!payload) return;
          // [v0.25.0] Include candidate overlap count so shell can drive the stack depth badge
          const cts = STATE.clickThroughState;
          payload.overlapCount = cts.candidates.length;
          payload.overlapIndex = cts.index;
          post('element-selected', payload);
        }

        function observeSelectedSize(el) {
          if (!window.ResizeObserver) return;
          if (!STATE.resizeObserver) {
            STATE.resizeObserver = new ResizeObserver(() => notifySelectionGeometry());
          }
          STATE.resizeObserver.disconnect();
          if (el) STATE.resizeObserver.observe(el);
        }

        function selectElement(el, options) {
          options = options || {};
          if (!el) return;
          const selectionLeafEl =
            options.selectionLeafEl instanceof Element ? options.selectionLeafEl : el;
          const selectionPathEntries = Array.isArray(options.selectionPathEntries)
            ? options.selectionPathEntries
            : buildSelectionPathEntries(el, { selectionLeafEl });
          clearSelection();
          STATE.selectedEl = el;
          STATE.selectedNodeId = getSelectionTargetId(el);
          STATE.selectionLeafNodeId =
            selectionPathEntries[0]?.nodeId || getSelectionPathNodeId(selectionLeafEl);
          STATE.selectionPath = selectionPathEntries;
          el.setAttribute('data-editor-selected', 'true');
          if (options.focusText && canEditText(el)) {
            el.setAttribute('contenteditable', 'true');
            el.setAttribute('spellcheck', 'true');
            beginInlineTextEditSession(el);
            focusInlineTextEditingElement(el);
          }
          observeSelectedSize(el);
          postSelection(el, { selectionLeafEl, selectionPathEntries });
        }

        function notifySelectionGeometry() {
          if (!STATE.selectedEl) return;
          post('selection-geometry', {
            nodeId: STATE.selectedEl.getAttribute(EDITOR_MARKER),
            rect: getRect(STATE.selectedEl),
            computed: collectComputed(STATE.selectedEl),
          });
        }

        function notifyElementUpdated(el, options) {
          const payload = buildElementBridgePayload(el, {
            selectionLeafEl:
              STATE.selectionLeafNodeId ? findSelectionTargetById(STATE.selectionLeafNodeId) : null,
            editLifecycle: options?.editLifecycle,
          });
          if (!payload) return;
          post('element-updated', payload);
          queueMetadataRefresh();
        }

        function notifySlideUpdated(slide, reason = 'slide-updated') {
          if (!slide) return;
          post('slide-updated', {
            slideId: slide.getAttribute(SLIDE_MARKER),
            html: slide.outerHTML,
            reason,
          });
          queueMetadataRefresh();
        }

        function notifySlideRemoved(slideId) {
          post('slide-removed', { slideId });
          queueMetadataRefresh();
        }

        function parseSingleRoot(html) {
          // [AUDIT-D-02 / ADR-012 §7] Length guard: reject oversized payloads before
          // any DOMParser work to prevent memory exhaustion and storage DoS.
          if (typeof html !== 'string' || html.length > MAX_HTML_BYTES) return null;

          const parser = new DOMParser();
          const doc = parser.parseFromString('<body>' + html + '</body>', 'text/html');
          const elements = Array.from(doc.body.children);
          const nonEmptyText = Array.from(doc.body.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
          if (elements.length !== 1 || nonEmptyText.length > 0) return null;

          // [AUDIT-D-02] Sanitize before importNode: walk the parsed fragment and
          // strip disallowed tags, on* handlers, javascript: URLs, and srcdoc.
          // sanitizeFragment operates on the DOMParser doc, not the live preview DOM.
          const stats = sanitizeFragment(doc.body);
          if (stats.removedTags + stats.removedAttrs > 0) {
            post('runtime-log', {
              message: 'sanitize: removed ' + stats.removedTags + ' tags, ' + stats.removedAttrs + ' attrs',
              source: 'parseSingleRoot',
            });
          }

          // Re-check structure after sanitization: the fragment may now be empty or
          // have changed shape if the root element itself was removed.
          const sanitizedElements = Array.from(doc.body.children);
          if (sanitizedElements.length !== 1) return null;

          return document.importNode(sanitizedElements[0], true);
        }

        function findNodeById(nodeId) {
          return nodeId ? document.querySelector('[' + EDITOR_MARKER + '="' + cssEscape(nodeId) + '"]') : null;
        }

        function findSlideById(slideId) {
          return slideId ? document.querySelector('[' + SLIDE_MARKER + '="' + cssEscape(slideId) + '"]') : null;
        }

        function navigateToSlide(slideId, fallbackIndex, requestId) {
          STATE.slides = collectSlides();
          const parsedFallbackIndex =
            typeof fallbackIndex === 'number' && Number.isFinite(fallbackIndex)
              ? fallbackIndex
              : Number.parseInt(fallbackIndex, 10);
          const target =
            findSlideById(slideId) ||
            (Number.isFinite(parsedFallbackIndex) ? STATE.slides[parsedFallbackIndex] : null) ||
            null;
          if (!target) {
            emitSlideActivation({
              requestId: requestId || '',
              requestedSlideId: slideId || '',
              resolvedSlideId: '',
              targetIndex: -1,
              strategy: 'missing-target',
              status: 'missing-target',
              success: false,
            });
            return;
          }
          const targetIndex = STATE.slides.findIndex((slide) => slide === target);
          const targetSlideId = target.getAttribute(SLIDE_MARKER) || '';
          if (STATE.engine === 'reveal' && window.Reveal && typeof window.Reveal.getIndices === 'function' && typeof window.Reveal.slide === 'function') {
            const idx = window.Reveal.getIndices(target);
            window.Reveal.slide(idx.h, idx.v, idx.f);
            scheduleSlideActivationReport({
              requestId: requestId || '',
              requestedSlideId: slideId || targetSlideId,
              resolvedSlideId: targetSlideId,
              targetIndex,
              strategy: 'reveal',
            });
            return;
          }
          if (typeof window.goToSlide === 'function') {
            const nextIndex = targetIndex !== -1
              ? targetIndex + 1
              : Number(target.getAttribute('data-slide')) || 1;
            window.goToSlide(nextIndex);
            scheduleSlideActivationReport({
              requestId: requestId || '',
              requestedSlideId: slideId || targetSlideId,
              resolvedSlideId: targetSlideId,
              targetIndex,
              strategy: 'goToSlide',
            });
            return;
          }
          if (typeof window.changeSlide === 'function' && targetIndex !== -1) {
            const current = currentSlideId();
            const currentIndex = STATE.slides.findIndex((slide) => slide.getAttribute(SLIDE_MARKER) === current);
            if (currentIndex !== -1) {
              const delta = targetIndex - currentIndex;
              if (delta !== 0) {
                for (let step = 0; step < Math.abs(delta); step += 1) {
                  window.changeSlide(delta > 0 ? 1 : -1);
                }
                scheduleSlideActivationReport({
                  requestId: requestId || '',
                  requestedSlideId: slideId || targetSlideId,
                  resolvedSlideId: targetSlideId,
                  targetIndex,
                  strategy: 'changeSlide',
                });
                return;
              }
            }
            if (applyGenericSlideActivation(target, targetIndex)) {
              scheduleSlideActivationReport({
                requestId: requestId || '',
                requestedSlideId: slideId || targetSlideId,
                resolvedSlideId: targetSlideId,
                targetIndex,
                strategy: 'generic-profile',
              });
              return;
            }
          }
          if (STATE.engine === 'shower' && target.id) {
            location.hash = '#' + target.id;
            scheduleSlideActivationReport({
              requestId: requestId || '',
              requestedSlideId: slideId || targetSlideId,
              resolvedSlideId: targetSlideId,
              targetIndex,
              strategy: 'shower',
            });
            return;
          }
          if (applyGenericSlideActivation(target, targetIndex)) {
            scheduleSlideActivationReport({
              requestId: requestId || '',
              requestedSlideId: slideId || targetSlideId,
              resolvedSlideId: targetSlideId,
              targetIndex,
              strategy: 'generic-profile',
            });
            return;
          }
          if (applySafeGenericSlideActivation(target)) {
            scheduleSlideActivationReport({
              requestId: requestId || '',
              requestedSlideId: slideId || targetSlideId,
              resolvedSlideId: targetSlideId,
              targetIndex,
              strategy: 'generic-safe',
            });
            return;
          }
          target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
          scheduleSlideActivationReport({
            requestId: requestId || '',
            requestedSlideId: slideId || targetSlideId,
            resolvedSlideId: targetSlideId,
            targetIndex,
            strategy: 'scroll-fallback',
          });
        }

        

        function deleteElementById(nodeId) {
          const el = findNodeById(nodeId);
          if (!el) return;
          const policy = createProtectionPolicy(el);
          if (!policy.canDelete) return;
          if (el.hasAttribute(SLIDE_MARKER)) {
            const slideId = el.getAttribute(SLIDE_MARKER);
            el.remove();
            clearSelection();
            notifySlideRemoved(slideId);
            return;
          }
          const slide = el.closest('[' + SLIDE_MARKER + ']');
          el.remove();
          clearSelection();
          if (slide) notifySlideUpdated(slide);
        }

        function duplicateElementById(nodeId) {
          const el = findNodeById(nodeId);
          if (!el || el.hasAttribute(SLIDE_MARKER)) return;
          const policy = createProtectionPolicy(el);
          if (!policy.canDuplicate) return;
          const clone = el.cloneNode(true);
          stripAuthoredIdentityAttrs(clone);
          ensureUniqueDomIds(clone);
          assignIdsDeep(clone);
          el.after(clone);
          selectElement(clone, { focusText: false });
          const slide = clone.closest('[' + SLIDE_MARKER + ']');
          if (slide) notifySlideUpdated(slide);
        }

        function moveElementById(nodeId, direction) {
          const el = findNodeById(nodeId);
          if (!el || el.hasAttribute(SLIDE_MARKER) || !el.parentElement) return;
          const policy = createProtectionPolicy(el);
          if (!policy.canReorder) return;
          if (direction < 0 && el.previousElementSibling) {
            el.parentElement.insertBefore(el, el.previousElementSibling);
          } else if (direction > 0 && el.nextElementSibling) {
            el.parentElement.insertBefore(el.nextElementSibling, el);
          } else {
            return;
          }
          selectElement(el, { focusText: false });
          const slide = el.closest('[' + SLIDE_MARKER + ']');
          if (slide) notifySlideUpdated(slide);
        }


        function parseTranslateValue(value) {
          const raw = String(value || '').trim();
          if (!raw || raw === 'none') return { x: 0, y: 0 };
          const parts = raw.split(/\\s+/);
          const x = Number.parseFloat(parts[0]) || 0;
          const y = Number.parseFloat(parts[1] || '0') || 0;
          return { x, y };
        }

        function supportsIndividualTranslate() {
          try {
            return Boolean(window.CSS && CSS.supports && CSS.supports('translate', '1px 1px'));
          } catch (error) {
            return false;
          }
        }

        function getDirectManipulationMode(el) {
          const position = window.getComputedStyle(el).position;
          return position === 'absolute' || position === 'fixed' ? position : 'translate';
        }

        function measurePositionReferenceOffset(el, mode, rect = null) {
          const elementRect = rect || getRect(el);
          if (mode === 'fixed') {
            return {
              left: elementRect.left,
              top: elementRect.top,
            };
          }
          const offsetParent = el.offsetParent;
          if (!offsetParent || offsetParent === document.body || offsetParent === document.documentElement) {
            return {
              left: elementRect.left + window.scrollX,
              top: elementRect.top + window.scrollY,
            };
          }
          const parentRect = offsetParent.getBoundingClientRect();
          return {
            left:
              elementRect.left -
              (parentRect.left + offsetParent.clientLeft) +
              offsetParent.scrollLeft,
            top:
              elementRect.top -
              (parentRect.top + offsetParent.clientTop) +
              offsetParent.scrollTop,
          };
        }

        function beginDirectManipulationSession(nodeId, kind, options) {
          const el = findNodeById(nodeId);
          if (!el) return null;
          const focusEl =
            findSelectionTargetById(options?.selectionNodeId) ||
            findSelectionTargetById(options?.selectionLeafNodeId) ||
            el;
          const selectionLeafEl =
            findSelectionTargetById(options?.selectionLeafNodeId) || focusEl;
          const policy = createProtectionPolicy(el);
          if (kind === 'resize' ? !policy.canResize : !policy.canMove) return null;
          const computed = window.getComputedStyle(el);
          const rect = getRect(el);
          const mode = getDirectManipulationMode(el);
          const translate = parseTranslateValue(computed.translate || el.style.translate || '');
          const referenceOffset = measurePositionReferenceOffset(el, mode, rect);
          const rawLeft = Number.parseFloat(computed.left);
          const rawTop = Number.parseFloat(computed.top);
          const rawRight = Number.parseFloat(computed.right);
          const rawBottom = Number.parseFloat(computed.bottom);
          const horizontalAnchor =
            Number.isFinite(rawLeft) || !Number.isFinite(rawRight) ? 'left' : 'right';
          const verticalAnchor =
            Number.isFinite(rawTop) || !Number.isFinite(rawBottom) ? 'top' : 'bottom';
          STATE.directManipulation = {
            nodeId,
            kind,
            el,
            focusEl,
            selectionLeafEl,
            selectionPathNodeIds: Array.isArray(options?.selectionPathNodeIds)
              ? options.selectionPathNodeIds
                  .map((value) => String(value || '').trim())
                  .filter(Boolean)
              : [],
            mode,
            useIndividualTranslate: supportsIndividualTranslate(),
            startRect: rect,
            startWidth: rect.width,
            startHeight: rect.height,
            horizontalAnchor,
            verticalAnchor,
            startLeft: Number.isFinite(rawLeft)
              ? rawLeft
              : referenceOffset.left,
            startTop: Number.isFinite(rawTop)
              ? rawTop
              : referenceOffset.top,
            startRight: Number.isFinite(rawRight) ? rawRight : 0,
            startBottom: Number.isFinite(rawBottom) ? rawBottom : 0,
            startTranslate: translate,
            startInline: {
              position: el.style.position || '',
              left: el.style.left || '',
              right: el.style.right || '',
              top: el.style.top || '',
              bottom: el.style.bottom || '',
              width: el.style.width || '',
              height: el.style.height || '',
              translate: el.style.translate || '',
              transform: el.style.transform || '',
            },
          };
          return STATE.directManipulation;
        }

        function applySessionTranslate(session, tx, ty) {
          if (!session || !session.el) return;
          if (session.useIndividualTranslate) {
            session.el.style.translate = Math.round(tx) + 'px ' + Math.round(ty) + 'px';
            return;
          }
          const baseTransform = (session.startInline.transform || '').replace(/translate(?:3d|X|Y)?\\([^)]*\\)/gi, '').trim();
          const translateTransform = 'translate(' + Math.round(tx) + 'px, ' + Math.round(ty) + 'px)';
          session.el.style.transform = baseTransform ? baseTransform + ' ' + translateTransform : translateTransform;
        }

        function restoreDirectManipulationSession(session) {
          if (!session || !session.el) return;
          session.el.style.position = session.startInline.position;
          session.el.style.left = session.startInline.left;
          session.el.style.right = session.startInline.right;
          session.el.style.top = session.startInline.top;
          session.el.style.bottom = session.startInline.bottom;
          session.el.style.width = session.startInline.width;
          session.el.style.height = session.startInline.height;
          session.el.style.translate = session.startInline.translate;
          session.el.style.transform = session.startInline.transform;
          notifySelectionGeometry();
        }

        function applyPositionedInsets(session, dx, dy) {
          if (!session || !session.el) return;
          if (!session.el.style.position) session.el.style.position = session.mode;
          if (session.horizontalAnchor === 'right') {
            session.el.style.right = Math.round(session.startRight - dx) + 'px';
            session.el.style.left = 'auto';
          } else {
            session.el.style.left = Math.round(session.startLeft + dx) + 'px';
            session.el.style.right = 'auto';
          }
          if (session.verticalAnchor === 'bottom') {
            session.el.style.bottom = Math.round(session.startBottom - dy) + 'px';
            session.el.style.top = 'auto';
          } else {
            session.el.style.top = Math.round(session.startTop + dy) + 'px';
            session.el.style.bottom = 'auto';
          }
        }

        function applyDirectManipulationStep(session, payload) {
          if (!session || !session.el) return;
          const dx = Number(payload.dx || 0);
          const dy = Number(payload.dy || 0);
          if (payload.kind === 'drag') {
            if (session.mode === 'absolute' || session.mode === 'fixed') {
              applyPositionedInsets(session, dx, dy);
            } else {
              applySessionTranslate(session, session.startTranslate.x + dx, session.startTranslate.y + dy);
            }
          } else {
            const nextWidth = Math.max(24, Number(payload.width || session.startWidth));
            const nextHeight = Math.max(24, Number(payload.height || session.startHeight));
            session.el.style.width = Math.round(nextWidth) + 'px';
            session.el.style.height = Math.round(nextHeight) + 'px';
            if (session.mode === 'absolute' || session.mode === 'fixed') {
              applyPositionedInsets(session, dx, dy);
            } else {
              applySessionTranslate(session, session.startTranslate.x + dx, session.startTranslate.y + dy);
            }
          }
          notifySelectionGeometry();
        }

        function commitDirectManipulationSession() {
          const session = STATE.directManipulation;
          if (!session || !session.el) return;
          STATE.directManipulation = null;
          notifyElementUpdated(session.el);
          selectElement(session.focusEl || session.el, {
            focusText: false,
            selectionLeafEl: session.selectionLeafEl || session.focusEl || session.el,
          });
        }

        function cancelDirectManipulationSession() {
          const session = STATE.directManipulation;
          if (!session || !session.el) return;
          restoreDirectManipulationSession(session);
          STATE.directManipulation = null;
          selectElement(session.focusEl || session.el, {
            focusText: false,
            selectionLeafEl: session.selectionLeafEl || session.focusEl || session.el,
          });
        }

        function nudgeElementById(nodeId, dx, dy, options) {
          const session = beginDirectManipulationSession(nodeId, 'drag', options);
          if (!session) return;
          applyDirectManipulationStep(session, { kind: 'drag', dx, dy });
          STATE.directManipulation = null;
          notifyElementUpdated(session.el);
          selectElement(session.focusEl || session.el, {
            focusText: false,
            selectionLeafEl: session.selectionLeafEl || session.focusEl || session.el,
          });
        }

        function syncSlideToParent(slide, options = {}) {
          if (!slide) return;
          var syncClone = slide.cloneNode(true);
          ['data-editor-selected', 'data-editor-hover', 'data-editor-highlight', 'data-editor-flash'].forEach(function(a) {
            syncClone.querySelectorAll('[' + a + ']').forEach(function(el) { el.removeAttribute(a); });
          });
          post('document-sync', {
            slideId: slide.getAttribute(SLIDE_MARKER),
            activeSlideId: currentSlideId(),
            index: STATE.slides.findIndex((entry) => entry === slide),
            source: options.source || 'runtime',
            html: syncClone.outerHTML,
          });
        }

        function updateAttributes(nodeId, attrs) {
          const el = findNodeById(nodeId);
          if (!el || !attrs || typeof attrs !== 'object') return;
          if (!createProtectionPolicy(el).canEditAttributes) return;
          Object.entries(attrs).forEach(([name, rawValue]) => {
            const attrName = String(name || '').trim();
            if (!attrName || BLOCKED_ATTR_NAMES.has(attrName) || UNSAFE_ATTR_NAME.test(attrName) || !VALID_ATTR_NAME.test(attrName)) return;
            const value = rawValue == null ? '' : String(rawValue).trim();
            if (!value) {
              el.removeAttribute(attrName);
              return;
            }
            if (attrName === 'class') {
              const normalized = value.split(/\\s+/).filter(Boolean).join(' ');
              if (normalized) el.setAttribute('class', normalized); else el.removeAttribute('class');
              return;
            }
            if (attrName === 'id') {
              const usedIds = collectUsedDomIds(el);
              const uniqueId = claimUniqueDomId(value, usedIds);
              if (uniqueId) el.setAttribute('id', uniqueId); else el.removeAttribute('id');
              return;
            }
            el.setAttribute(attrName, value);
          });
          selectElement(el, { focusText: false });
          notifyElementUpdated(el);
        }

        function flashNodeById(nodeId) {
          const el = findNodeById(nodeId);
          if (!el) return;
          if (STATE.flashTimer) window.clearTimeout(STATE.flashTimer);
          el.setAttribute(FLASH_ATTR, 'true');
          STATE.flashTimer = window.setTimeout(() => {
            if (el.isConnected) el.removeAttribute(FLASH_ATTR);
            STATE.flashTimer = null;
          }, 720);
          notifySelectionGeometry();
        }

        function replaceImageSrc(nodeId, src, alt) {
          const el = findNodeById(nodeId);
          if (!el || el.tagName !== 'IMG') return;
          if (!createProtectionPolicy(el).canReplaceMedia) return;
          if (typeof src === 'string' && src) el.setAttribute('src', src);
          if (typeof alt === 'string') el.setAttribute('alt', alt);
          selectElement(el, { focusText: false });
          notifyElementUpdated(el);
        }

        function parseElementZIndex(el) {
          if (!el || el.nodeType !== 1) return 0;
          const z = String(window.getComputedStyle(el).zIndex || '').trim();
          const parsed = Number.parseFloat(z);
          return Number.isFinite(parsed) ? parsed : 0;
        }

        function compareElementStackOrder(a, b) {
          const za = parseElementZIndex(a);
          const zb = parseElementZIndex(b);
          if (za !== zb) return za - zb;
          const pos = a.compareDocumentPosition(b);
          if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
          if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
          return 0;
        }

        function getRectIntersectionArea(a, b) {
          const left = Math.max(a.left, b.left);
          const top = Math.max(a.top, b.top);
          const right = Math.min(a.right, b.right);
          const bottom = Math.min(a.bottom, b.bottom);
          const width = Math.max(0, right - left);
          const height = Math.max(0, bottom - top);
          return width * height;
        }

        function autoPromoteInsertedElementIfNeeded(el) {
          if (!el || el.nodeType !== 1 || !el.parentElement) return false;
          if (el.getAttribute('data-editor-locked') === 'true') return false;
          const rect = el.getBoundingClientRect();
          if (!(rect.width > 0 && rect.height > 0)) return false;
          const parent = el.parentElement;
          const siblings = Array.from(parent.children).filter((candidate) => {
            return (
              candidate !== el &&
              candidate.nodeType === 1 &&
              candidate.hasAttribute(EDITOR_MARKER)
            );
          });
          if (!siblings.length) return false;
          let coveredArea = 0;
          let maxSiblingZ = 0;
          let blockedByLockedOverlap = false;
          siblings.forEach((sibling) => {
            const siblingRect = sibling.getBoundingClientRect();
            const style = window.getComputedStyle(sibling);
            if (!(siblingRect.width > 0 && siblingRect.height > 0)) return;
            if (style.display === 'none' || style.visibility === 'hidden') return;
            const overlapArea = getRectIntersectionArea(rect, siblingRect);
            if (!(overlapArea > 0)) return;
            if (sibling.getAttribute('data-editor-locked') === 'true') {
              blockedByLockedOverlap = true;
            }
            if (compareElementStackOrder(sibling, el) > 0) {
              coveredArea += overlapArea;
            }
            maxSiblingZ = Math.max(maxSiblingZ, parseElementZIndex(sibling));
          });
          if (blockedByLockedOverlap) return false;
          const coveredPercent = Math.min(
            100,
            Math.round((coveredArea / Math.max(1, rect.width * rect.height)) * 100),
          );
          const alreadyTopmost = siblings.every(
            (sibling) => compareElementStackOrder(el, sibling) >= 0,
          );
          if (alreadyTopmost || coveredPercent < 80) return false;
          el.style.zIndex = String(maxSiblingZ + 1);
          return true;
        }

        function insertElement(payload) {
          const html = payload.html || '';
          const insertion = parseSingleRoot(html);
          if (!insertion) return;
          ensureUniqueDomIds(insertion);
          assignIdsDeep(insertion);
          const anchor = findNodeById(payload.anchorNodeId);
          const anchorPolicy = anchor ? createProtectionPolicy(anchor) : null;
          if (anchor && payload.position === 'inside' && anchorPolicy && !anchorPolicy.canAddChild) return;
          if (anchor && (payload.position === 'before' || payload.position === 'after') && anchorPolicy && anchorPolicy.kind === 'critical-structure') return;
          const slide = findSlideById(payload.slideId) || (anchor ? anchor.closest('[' + SLIDE_MARKER + ']') : getCurrentSlide());
          if (!slide) return;
          if (anchor && payload.position === 'before') {
            anchor.before(insertion);
          } else if (anchor && payload.position === 'after') {
            anchor.after(insertion);
          } else if (anchor && payload.position === 'inside') {
            anchor.appendChild(insertion);
          } else {
            slide.appendChild(insertion);
          }
          const autoPromoted = autoPromoteInsertedElementIfNeeded(insertion);
          selectElement(insertion, { focusText: Boolean(payload.focusText) });
          notifySlideUpdated(
            slide,
            autoPromoted ? 'insert-element:auto-promote' : 'insert-element',
          );
        }

        

        document.addEventListener('mousemove', (event) => {
          if (!STATE.editMode) return;
          const selection = resolveSelectionFromTarget(event.target, {
            clientX: event.clientX,
            clientY: event.clientY,
          });
          const el = selection?.selectedEl || null;
          clearHover();
          if (el && (!STATE.selectedEl || el !== STATE.selectedEl)) {
            el.setAttribute('data-editor-hover', 'true');
          }
        });

        document.addEventListener('click', (event) => {
          if (!STATE.editMode) return;
          const _isMod = event.ctrlKey || event.metaKey;

          // [WO-31] Shift+click dispatches multi-select-add.
          // Shell routes basic-mode to toast stub; advanced-mode to grouping pipeline.
          // Full multi-select UX (align/distribute, combined overlay) is P3 / post-v1.0.
          // [v0.18.0] Shift+Click for multi-select
          if (event.shiftKey && !event.altKey && !_isMod) {
            const selection = resolveSelectionFromTarget(event.target, {
              clientX: event.clientX,
              clientY: event.clientY,
              cycleAncestors: false,
              deepSelect: false,
              containerMode: STATE.containerMode,
            });
            if (selection?.selectedEl) {
              const nodeId = String(selection.selectedEl.getAttribute(EDITOR_MARKER) || '');
              if (nodeId) {
                event.preventDefault();
                post('multi-select-add', { nodeId });
                return;
              }
            }
          }

          // [CLICK-THROUGH] cycle through overlapping candidates on repeated plain clicks
          if (!event.altKey && !_isMod && trySelectFromClickThroughState(event.clientX, event.clientY)) {
            if (event.target.closest('a[href]')) event.preventDefault();
            return;
          }

          const selection = resolveSelectionFromTarget(event.target, {
            clientX: event.clientX,
            clientY: event.clientY,
            cycleAncestors: Boolean(event.altKey),
            deepSelect: Boolean(_isMod && !event.altKey),
            containerMode: STATE.containerMode, // [LAYER-MODEL v2]
          });
          if (!selection?.selectedEl) {
            // [v2.0.8] Click resolved to no selectable target. Detect the
            // most likely reason and notify the shell so it can show a
            // contextual toast. Previously the click silently fell
            // through and the user had no clue why their click did
            // nothing — the #1 user-reported usability complaint.
            const _directTarget = event.target instanceof Element ? event.target : null;
            if (_directTarget) {
              const _lockedAncestor = _directTarget.closest('[data-editor-locked="true"]');
              if (_lockedAncestor) {
                post('click-blocked', {
                  reason: 'locked',
                  nodeId: _lockedAncestor.getAttribute(EDITOR_MARKER) || '',
                });
                return;
              }
              const _protectedAncestor = _directTarget.closest('[data-editor-protected="true"]');
              if (_protectedAncestor) {
                post('click-blocked', {
                  reason: 'protected',
                  nodeId: _protectedAncestor.getAttribute(EDITOR_MARKER) || '',
                });
                return;
              }
            }
            return;
          }
          if (event.target.closest('a[href]')) event.preventDefault();
          if (event.altKey) event.preventDefault();
          if (_isMod && !event.altKey) event.preventDefault();
          // [v0.25.0] Update candidate stack BEFORE selectElement so overlapCount
          // is current when postSelection emits element-selected to the shell.
          if (!event.altKey && !_isMod) {
            updateClickThroughState(event.target, event.clientX, event.clientY);
          }
          selectElement(selection.selectedEl, {
            focusText: false,
            selectionLeafEl: selection.selectionLeafEl,
            selectionPathEntries: selection.pathEntries,
          });
          // [v2.0.9] If the user just used Alt+click and it actually
          // moved selection up the ancestor chain, signal the shell so
          // it can fire a one-shot shortcut discovery hint. Posted as
          // a separate lightweight message rather than piggy-backed
          // on element-selected so unaffected handlers stay unchanged.
          if (event.altKey) {
            post('hint-shortcut', { kind: 'alt-click' });
          }
        }, true);

        document.addEventListener('dblclick', (event) => {
          if (!STATE.editMode) return;
          const selection = resolveSelectionFromTarget(event.target, {
            clientX: event.clientX,
            clientY: event.clientY,
          });
          const el = selection?.selectedEl || null;
          if (!el) return;
          if (canEditText(el)) {
            event.preventDefault();
            selectElement(el, {
              focusText: true,
              selectionLeafEl: selection.selectionLeafEl,
              selectionPathEntries: selection.pathEntries,
            });
          }
        }, true);

        document.addEventListener('contextmenu', (event) => {
          if (!STATE.editMode) return;
          const selection = resolveSelectionFromTarget(event.target, {
            clientX: event.clientX,
            clientY: event.clientY,
          });
          const el = selection?.selectedEl || null;
          if (!el) return;
          event.preventDefault();
          selectElement(el, {
            focusText: false,
            selectionLeafEl: selection.selectionLeafEl,
            selectionPathEntries: selection.pathEntries,
          });
          const _allCandidates = getOrCollectCandidates(
            event.target,
            event.clientX,
            event.clientY,
          );
          const _candidateStack = _allCandidates
            .map((c) => ({
              c,
              score: scoreSelectionCandidate(c),
              nodeId: c.selectionNodeId || c.nodeId,
              entityKind: getEntityKind(c.el),
              label: getSelectionBreadcrumbLabel(
                c.el,
                getEntityKind(c.el),
                c.nodeId,
              ),
            }))
            .filter((x) => x.nodeId)
            .sort((a, b) => b.score - a.score)
            .map(({ c, score, ...info }) => info);
          post('context-menu', {
            nodeId: el.getAttribute(EDITOR_MARKER),
            slideId: el.closest('[' + SLIDE_MARKER + ']')?.getAttribute(SLIDE_MARKER) || null,
            clientX: event.clientX,
            clientY: event.clientY,
            entityKind: getEntityKind(el),
            isImage: isImageElement(el),
            canEditText: canEditText(el),
            isContainer: isContainerElement(el),
            isVideo: isVideoElement(el),
            isSlideRoot: isSlideRoot(el),
            isProtected: isProtectedElement(el),
            protectionPolicy: createProtectionPolicy(el),
            candidateStack: _candidateStack,
          });
        }, true);

        document.addEventListener('input', (event) => {
          if (!STATE.editMode) return;
          const el = getEditableElementFromTarget(event.target);
          if (!el) return;
          if (!(el.isContentEditable || getInlineTextEditSession(el))) return;
          STATE.selectedEl = el;
          STATE.selectedNodeId = el.getAttribute(EDITOR_MARKER);
          markInlineTextEditDirty(el);
          notifyElementUpdated(el, { editLifecycle: 'live' });
        });

        document.addEventListener('blur', (event) => {
          if (!STATE.editMode) return;
          const el = getEditableElementFromTarget(event.target);
          if (!el) return;
          const session = getInlineTextEditSession(el);
          if (!session) return;
          requestAnimationFrame(() => {
            const keepInlineEditing =
              STATE.editMode &&
              STATE.selectedEl === el &&
              canEditText(el) &&
              el.getAttribute('contenteditable') === 'true';
            if (keepInlineEditing) {
              return;
            }
            const activeSession = getInlineTextEditSession(el);
            if (!activeSession || activeSession.cancelRequested) return;
            commitInlineTextEditSession(el);
          });
        }, true);

        document.addEventListener('keydown', (event) => {
          if (!STATE.editMode) return;
          // Foreign-deck compat (WO-COMPAT): block deck-native navigation keys from
          // reaching window-level presentation handlers (ArrowKeys, Space, PageDown/Up).
          // The bridge listener is on 'document' (bubble phase); calling stopPropagation()
          // here prevents the event from reaching window.addEventListener handlers used
          // by reveal-like and viewport-deck JS to advance slides.
          // Only active when NOT in inline text editing (typed characters must pass through).
          if (!isInlineTextEditingActive(event.target)) {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ||
                event.key === 'ArrowUp' || event.key === 'ArrowDown' ||
                event.key === ' ' || event.key === 'PageDown' || event.key === 'PageUp') {
              event.stopPropagation();
            }
          }
          if (isInlineTextEditingActive(event.target)) {
            if (event.key === 'Tab' && STATE.selectedEl && isTableCellElement(STATE.selectedEl)) {
              const currentNodeId = STATE.selectedNodeId;
              event.preventDefault();
              event.stopImmediatePropagation();
              const committed = commitInlineTextEditSession(STATE.selectedEl);
              if (committed && currentNodeId) {
                navigateTableCellByDirection(
                  currentNodeId,
                  event.shiftKey ? 'previous' : 'next',
                );
              }
              return;
            }
            if (event.key === 'Escape' && STATE.selectedEl) {
              event.preventDefault();
              event.stopImmediatePropagation();
              cancelInlineTextEditSession(STATE.selectedEl);
              return;
            }
            if (shouldTrapInlineEditingKey(event)) {
              event.stopImmediatePropagation();
              return;
            }
          }
          if (event.key === 'Escape' && STATE.selectedEl) {
            // [CLICK-THROUGH] reset to topmost candidate if cycling is active
            if (resetClickThroughSelection()) {
              event.preventDefault();
              return;
            }
            STATE.selectedEl.blur();
            STATE.selectedEl.removeAttribute('contenteditable');
            selectElement(STATE.selectedEl, { focusText: false });
            return;
          }
          if (isTypingTarget(event.target)) return;
          const isMod = event.ctrlKey || event.metaKey;
          if (isMod && event.key.toLowerCase() === 'd') {
            event.preventDefault();
            post('shortcut', { action: 'duplicate' });
            return;
          }
          if (isMod && event.key.toLowerCase() === 'z' && !event.shiftKey) {
            event.preventDefault();
            post('shortcut', { action: 'undo' });
            return;
          }
          if ((isMod && event.key.toLowerCase() === 'y') || (isMod && event.shiftKey && event.key.toLowerCase() === 'z')) {
            event.preventDefault();
            post('shortcut', { action: 'redo' });
            return;
          }
          if (!isMod && !event.altKey && (event.key === '[' || event.key === ']')) {
            event.preventDefault();
            const action = event.shiftKey
              ? event.key === ']'
                ? 'layer-front'
                : 'layer-back'
              : event.key === ']'
                ? 'layer-forward'
                : 'layer-backward';
            post('shortcut', { action });
            return;
          }
          if ((event.key === 'Delete' || event.key === 'Backspace') && STATE.selectedEl && !STATE.selectedEl.isContentEditable) {
            event.preventDefault();
            post('shortcut', { action: 'delete' });
            return;
          }
        }, true);

        document.addEventListener('paste', (event) => {
          if (!STATE.editMode) return;
          const editable = getEditableElementFromTarget(event.target);
          if (editable && (editable.isContentEditable || getInlineTextEditSession(editable))) {
            event.preventDefault();
            const plainText = event.clipboardData?.getData('text/plain') || '';
            insertPlainTextAtSelection(plainText);
            markInlineTextEditDirty(editable);
            notifyElementUpdated(editable, { editLifecycle: 'live' });
            return;
          }
          const items = Array.from(event.clipboardData?.items || []);
          const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
          if (!imageItem) return;
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function() {
            const src = reader.result;
            insertElement({
              slideId: currentSlideId(),
              anchorNodeId: STATE.selectedNodeId,
              position: STATE.selectedNodeId ? 'after' : 'append',
              html: '<img src="' + String(src).replace(/"/g, '&quot;') + '" alt="clipboard-image" style="display:block; max-width:100%; width:320px; height:auto;">',
              focusText: false,
            });
          };
          reader.readAsDataURL(file);
        });

        window.addEventListener('resize', notifySelectionGeometry);
        window.addEventListener('scroll', notifySelectionGeometry, true);

        window.addEventListener('message', (event) => {
          // AUDIT-D-04: Reject messages from unexpected origins.
          // Under file:// the shell origin is "null" — that string is allowed.
          // Under http(s):// we accept only the shell's exact origin.
          const _allowedForIframe = (window.location.protocol === 'file:') ? ['null'] : [window.location.origin];
          if (!_allowedForIframe.includes(event.origin)) {
            post('runtime-log', { message: 'origin-rejected:' + event.origin, source: 'bridge-receive' });
            return;
          }
          const data = event.data;
          if (!data || data.__presentationEditorParent !== true) return;
          if (event.source !== parent) return;
          if (data.token !== TOKEN) return;
          const payload = data.payload || {};
          const inboundSeq = Number(data.seq || 0) || 0;
          const previousCommandSeq = STATE.activeCommandSeq;
          if (inboundSeq > 0) STATE.activeCommandSeq = inboundSeq;
          try {
            switch (data.type) {
              case 'set-mode': {
                STATE.editMode = payload.mode === 'edit';
                if (!STATE.editMode) {
                  clearHover();
                  clearSelection();
                }
                ensureHelperStyles();
                break;
              }
              case 'navigate-to-slide': {
                navigateToSlide(payload.slideId, payload.index, payload.requestId);
                break;
              }
              case 'select-element': {
                const el = findSelectionTargetById(payload.nodeId);
                const selectionLeafEl =
                  findSelectionTargetById(payload.selectionLeafNodeId) || el;
                if (el) {
                  selectElement(el, {
                    focusText: Boolean(payload.focusText),
                    selectionLeafEl,
                  });
                }
                break;
              }
              case 'navigate-table-cell': {
                navigateTableCellByDirection(payload.nodeId, payload.direction);
                break;
              }
              case 'table-structure-op': {
                performTableStructureOperation(payload.nodeId, payload.operation);
                break;
              }
              case 'proxy-select-at-point': {
                const clientX = Number(payload.clientX);
                const clientY = Number(payload.clientY);
                if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) break;
                const cycleAncestors = Boolean(payload.cycleAncestors);
                const deepSelect = Boolean(payload.deepSelect);
                const containerMode = Boolean(payload.containerMode);
                if (!cycleAncestors && !deepSelect && trySelectFromClickThroughState(clientX, clientY, { ttl: CLICK_THROUGH_TTL_MS })) {
                  break;
                }
                const rawTarget = document.elementFromPoint(clientX, clientY);
                const selection = resolveSelectionFromTarget(rawTarget, {
                  clientX,
                  clientY,
                  cycleAncestors,
                  deepSelect,
                  containerMode, // [LAYER-MODEL v2]
                });
                if (!selection?.selectedEl) break;
                selectElement(selection.selectedEl, {
                  focusText: false,
                  selectionLeafEl: selection.selectionLeafEl,
                  selectionPathEntries: selection.pathEntries,
                });
                if (!cycleAncestors && !deepSelect) {
                  updateClickThroughState(rawTarget, clientX, clientY);
                }
                break;
              }
              case 'reset-click-through': {
                resetClickThroughSelection();
                break;
              }
              case 'apply-style': {
                const el = findNodeById(payload.nodeId);
                if (!el || !createProtectionPolicy(el).canEditStyles) return;
                el.style[payload.styleName] = payload.value || '';
                selectElement(el, { focusText: false });
                notifyElementUpdated(el);
                break;
              }
              case 'apply-styles': {
                const el = findNodeById(payload.nodeId);
                if (!el || !createProtectionPolicy(el).canEditStyles) return;
                Object.entries(payload.styles || {}).forEach(([name, value]) => {
                  el.style[name] = value || '';
                });
                selectElement(el, { focusText: false });
                notifyElementUpdated(el);
                break;
              }
              case 'update-attributes': {
                updateAttributes(payload.nodeId, payload.attrs || {});
                break;
              }
              case 'replace-image-src': {
                replaceImageSrc(payload.nodeId, payload.src, payload.alt || '');
                break;
              }
              case 'reset-inline-styles': {
                const el = findNodeById(payload.nodeId);
                if (!el || !createProtectionPolicy(el).canEditStyles) return;
                el.removeAttribute('style');
                selectElement(el, { focusText: false });
                notifyElementUpdated(el);
                break;
              }
              case 'delete-element': {
                deleteElementById(payload.nodeId);
                break;
              }
              case 'duplicate-element': {
                duplicateElementById(payload.nodeId);
                break;
              }
              case 'move-element': {
                moveElementById(payload.nodeId, Number(payload.direction) || 0);
                break;
              }
              case 'nudge-element': {
                nudgeElementById(
                  payload.nodeId,
                  Number(payload.dx) || 0,
                  Number(payload.dy) || 0,
                  payload,
                );
                break;
              }
              case 'begin-direct-manipulation': {
                beginDirectManipulationSession(payload.nodeId, payload.kind || 'drag', payload);
                break;
              }
              case 'update-direct-manipulation': {
                if (!STATE.directManipulation || STATE.directManipulation.nodeId !== payload.nodeId) {
                  beginDirectManipulationSession(payload.nodeId, payload.kind || 'drag', payload);
                }
                if (STATE.directManipulation) applyDirectManipulationStep(STATE.directManipulation, payload);
                break;
              }
              case 'commit-direct-manipulation': {
                commitDirectManipulationSession();
                break;
              }
              case 'cancel-direct-manipulation': {
                cancelDirectManipulationSession();
                break;
              }
              case 'insert-element': {
                insertElement(payload);
                postAck(inboundSeq, true);
                break;
              }
              case 'flash-node': {
                flashNodeById(payload.nodeId);
                break;
              }
              case 'highlight-node': {
                document
                  .querySelectorAll('[data-editor-highlight="ghost"]')
                  .forEach((el) => el.removeAttribute('data-editor-highlight'));
                if (payload.nodeId) {
                  const _hl = findNodeById(payload.nodeId);
                  if (_hl) _hl.setAttribute('data-editor-highlight', 'ghost');
                }
                break;
              }
              // [LAYER-MODEL v2] sync selection mode to iframe
              case 'set-selection-mode': {
                STATE.containerMode = Boolean(payload.containerMode);
                resetClickThroughState();
                // [WO-36] Emit ack so shell can deterministically wait for mode propagation
                post('container-mode-ack', { containerMode: STATE.containerMode, ackedAt: Date.now() });
                break;
              }
              case 'select-best-child-of': {
                const _scParent = findNodeById(payload.nodeId);
                if (!(_scParent instanceof Element)) break;
                const _scSlide = getSelectionSlide(_scParent);
                if (!(_scSlide instanceof Element)) break;
                const _scLeaf = resolvePreferredSelectionLeaf(_scParent, _scSlide);
                if (!(_scLeaf instanceof Element) || _scLeaf === _scParent) break;
                selectElement(_scLeaf, { source: 'keyboard' });
                break;
              }
              case 'request-slide-sync': {
                const slide = findSlideById(payload.slideId) || getCurrentSlide();
                if (slide) syncSlideToParent(slide, { source: payload.reason || 'request-slide-sync' });
                break;
              }
              case 'replace-node-html': {
                // ADR-012 §7: Validate size before parseSingleRoot (schema pre-check layer).
                if (typeof payload.html === 'string') {
                  try {
                    const _byteLen = unescape(encodeURIComponent(payload.html)).length;
                    if (_byteLen > ${JSON.stringify(262144)}) {
                      postAck(inboundSeq, false, 'replace-node-html.oversize',
                        'html payload too large: ' + _byteLen + ' bytes');
                      return;
                    }
                  } catch (_) {}
                }
                const current = findNodeById(payload.nodeId);
                if (!current || !createProtectionPolicy(current).canEditHtml) {
                  postAck(inboundSeq, false, 'replace-node-html.rejected', 'node not found or not editable');
                  return;
                }
                const replacement = parseSingleRoot(payload.html);
                if (!replacement) {
                  postAck(inboundSeq, false, 'replace-node-html.parse-failed', 'parseSingleRoot returned null');
                  return;
                }
                preserveAuthoredMarkerContract(current, replacement);
                ensureUniqueDomIds(replacement, current);
                replacement.setAttribute(EDITOR_MARKER, payload.nodeId);
                assignIdsDeep(replacement);
                current.replaceWith(replacement);
                selectElement(replacement, { focusText: false });
                notifyElementUpdated(replacement);
                postAck(inboundSeq, true);
                break;
              }
              case 'replace-slide-html': {
                // ADR-012 §7: Validate size before parseSingleRoot.
                if (typeof payload.html === 'string') {
                  try {
                    const _byteLen = unescape(encodeURIComponent(payload.html)).length;
                    if (_byteLen > ${JSON.stringify(262144)}) {
                      postAck(inboundSeq, false, 'replace-slide-html.oversize',
                        'html payload too large: ' + _byteLen + ' bytes');
                      return;
                    }
                  } catch (_) {}
                }
                const current = findSlideById(payload.slideId);
                if (!current) {
                  postAck(inboundSeq, false, 'replace-slide-html.not-found', 'slide not found: ' + payload.slideId);
                  return;
                }
                const replacement = parseSingleRoot(payload.html);
                if (!replacement) {
                  postAck(inboundSeq, false, 'replace-slide-html.parse-failed', 'parseSingleRoot returned null');
                  return;
                }
                preserveAuthoredMarkerContract(current, replacement);
                ensureUniqueDomIds(replacement, current);
                replacement.setAttribute(SLIDE_MARKER, payload.slideId);
                assignIdsDeep(replacement);
                current.replaceWith(replacement);
                STATE.slides = collectSlides();
                emitRuntimeMetadata();
                postAck(inboundSeq, true);
                break;
              }
              // [v0.18.0] Toggle element visibility (session-only, not synced to parent)
              case 'toggle-visibility': {
                const el = findNodeById(payload.nodeId);
                if (!el) return;
                const currentVisibility = el.style.visibility || 'visible';
                el.style.visibility = currentVisibility === 'hidden' ? 'visible' : 'hidden';
                // Do NOT call notifyElementUpdated - visibility is session-only
                break;
              }
              // [WO-28] ADR-004 — read-only sibling rect query for snap engine
              case 'get-sibling-rects': {
                const _gsrNodeId = payload.nodeId;
                const _gsrRequestId = payload.requestId;
                if (!_gsrNodeId || !_gsrRequestId) break;
                const _gsrEl = findNodeById(_gsrNodeId);
                const _gsrParent = _gsrEl ? _gsrEl.parentElement : null;
                const _gsrRects = [];
                if (_gsrParent) {
                  Array.from(_gsrParent.children).forEach(function (_gsrSibling) {
                    if (_gsrSibling === _gsrEl) return;
                    if (!(_gsrSibling instanceof Element)) return;
                    // Exclude hidden siblings
                    const _gsrStyle = _gsrSibling.style;
                    if (_gsrStyle.display === 'none') return;
                    if (_gsrStyle.visibility === 'hidden') return;
                    const _gsrR = _gsrSibling.getBoundingClientRect();
                    if (_gsrR.width < 1 && _gsrR.height < 1) return;
                    _gsrRects.push({
                      nodeId: _gsrSibling.getAttribute(EDITOR_MARKER) || '',
                      left: _gsrR.left,
                      top: _gsrR.top,
                      width: _gsrR.width,
                      height: _gsrR.height,
                    });
                  });
                }
                post('sibling-rects-response', { requestId: _gsrRequestId, rects: _gsrRects });
                break;
              }
            }
          } catch (error) {
            onRuntimeError(error.message || String(error), 'bridge-message:' + (data.type || 'unknown'), 0, 0);
          } finally {
            STATE.activeCommandSeq = previousCommandSeq;
          }
        });

        function boot() {
          STATE.engine = detectEngine();
          STATE.slides = collectSlides();
          attachEngineHooks();
          ensureHelperStyles();
          // ADR-012 §1 — Bridge v2 hello handshake (WO-12).
          // Emitted BEFORE bridge-ready so shell can validate protocol before
          // acting on any subsequent messages. SHELL_BUILD is substituted at
          // build time (template literal in buildBridgeScript, shell scope).
          post('hello', {
            protocol: 2,
            build: ${JSON.stringify(SHELL_BUILD)},
            capabilities: [
              'replace-node-html','replace-slide-html','insert-element',
              'apply-style','apply-styles','update-attributes',
              'replace-image-src','reset-inline-styles','delete-element',
              'duplicate-element','move-element','nudge-element',
              'commit-direct-manipulation'
            ]
          });
          post('bridge-ready', { engine: STATE.engine });
          emitRuntimeMetadata();
          emitSlideActivation({ strategy: 'boot', success: true });
          setTimeout(emitRuntimeMetadata, 150);
          setTimeout(emitRuntimeMetadata, 500);
          setTimeout(emitRuntimeMetadata, 1200);
        }

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          boot();
        } else {
          document.addEventListener('DOMContentLoaded', boot, { once: true });
        }
      })();`;
      }
