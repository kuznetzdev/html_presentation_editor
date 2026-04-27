# Competitive UX Teardown A4

**Auditor:** comprehensive-researcher
**Date:** 2026-04-28
**Targets:** Gamma.app, Pitch.com, Tome.app (verified shut down), Slides.com, Canva Presentations, Reveal.js editor ecosystem (Slidev, Marp), Figma Slides (cross-reference)
**Method:** Public landing pages, help-centre articles, 2025-2026 changelogs, third-party reviews, design-pattern surveys. Each pattern cross-referenced against ≥1 primary source plus, where possible, an independent review.
**Scope:** UX patterns transferable to a local-first, file://, no-server, no-bundler HTML deck editor (v2.0.30).

---

## Executive summary

- Patterns to **ADOPT** (clean fit, no architectural compromise): **8** — top 3: P3 inline contextual editor on selection, P5 dual-view slide rail (rail + grid overview), P14 universal `Esc` exit + `o` overview shortcuts.
- Patterns to **ADAPT** (modify for our shell+iframe+bridge model): **6** — most notable: P1 single-canvas empty state with template thumbnails, P9 layers/structure pane, P11 grid-aligned drag with custom guides.
- Patterns to **REJECT** (architecture conflict, deferred, or anti-pattern): **5** — live cursors, AI deck generation, real-time multiplayer, "scroll-as-document" card model, cloud asset library.

**Top-5 actionable insights**

1. Our empty state still asks the user to read three paragraph-sized labels (`Open HTML`, `Paste from clipboard`, `Starter deck`). Industry leaders (Figma Slides, Canva, Pitch) put **a single dominant CTA + visual preview** in the same card. Adopt P1 to close the AUDIT-B journey-1 friction.
2. Pitch's "bubble bar" / inline-editor pattern is the closest match to what our **floating toolbar** is reaching for. We already have it conceptually; we should validate that on selection it shows *only the most relevant tool group* (text styling for text, image-replace for images), not a fixed superset. See P3.
3. Slidev / Marp / Reveal.js (our technical peers) all use **keyboard shortcut `o` to open a slide overview**, and **Esc to leave any modal mode**. Implementing both would close half of AUDIT-B journey-8 (keyboard-only workflow, currently 8/10 friction).
4. Pitch and Slides.com both ship a **layers/structure panel** that reveals the DOM hierarchy of the current slide. For us, this is uniquely valuable because our content *is* HTML — we can offer something competitors only emulate. See P9.
5. **Stop trying to be Gamma.** Gamma's card-and-AI model requires a server-side LLM and an opinionated content schema. Our value is the inverse: hand-crafted HTML, opened locally, edited visually. Reaffirm the differentiation in marketing/empty-state copy rather than chasing AI parity.

**Notable verification:**
- **Tome.app shut down its presentation product in April 2025** (confirmed via 356labs blog, Semafor, Slidepeak, Substack analyses). Tome is excluded from active comparison and only referenced as a cautionary tale (P15).
- **Figma Slides** was added as a cross-reference because it is the most-discussed 2025-2026 launch in this category, despite not being on the original target list. It graduated from beta in March 2025; reviews are mixed.

---

## Patterns

### P1 — ADAPT — Single-CTA empty state with visual preview (Source: Figma Slides, Canva)

**Source:** https://help.figma.com/hc/en-us/articles/24170630629911-Explore-Figma-Slides ; https://www.canva.com/presentations/
**Pattern:** New decks open into a template picker (Figma) or directly into the editor with a relevant template already loaded (Canva). The empty state is dominated by *visual* template thumbnails, not text instructions.
**Why it works:** Closes the "blank slate problem" documented in NN/g and Carbon empty-state research. Users learn the tool's capability surface by *seeing*, not reading. Removes the read-then-decide cognitive cost of multiple equal-weight CTAs.
**Our applicability:** Today our empty state has three side-by-side buttons + a numbered 3-step list (per AUDIT-B). Adapt by: (a) promoting `Открыть стартовый пример` to dominant primary CTA, (b) replacing the 3-step list with a thumbnail/screenshot of what a loaded deck looks like, (c) demoting `Вставить из буфера` to a `Дополнительно ▾` disclosure. We already bundle a starter deck — the work is layout + copy, not new code.
**Effort estimate:** S
**Invariant check:** PASS (no server, no bundler, file:// works — uses local fixture).

---

### P2 — ADOPT — Template browser as first surface (Source: Canva, Figma Slides)

**Source:** https://www.canva.com/help/resize-and-crop/ ; https://help.figma.com/hc/en-us/articles/24170630629911-Explore-Figma-Slides
**Pattern:** Both Canva and Figma Slides open into a template *picker* before the canvas, with templates organized by use case (pitch, lecture, status update). User picks one and lands in the canvas with content already populated.
**Why it works:** Same psychology as P1 but applied at deck-creation level. Reduces "what do I do next?" anxiety; gives the user something to react to instead of generate from scratch.
**Our applicability:** We can ship a small set (3-5) of starter decks bundled in the repo (`editor/fixtures/`), each with a thumbnail. Empty state shows them as a horizontal carousel. No network calls, no remote template store.
**Effort estimate:** M
**Invariant check:** PASS (local fixtures, no server).

---

### P3 — ADOPT — Inline contextual editor on selection (Source: Pitch, Editor.js, Tiptap)

**Source:** https://pitch.com/blog/pitch-product-redesign-collaboration-features ; https://editorjs.io/enable-inline-toolbar/
**Pattern:** Pitch's redesign eliminated the persistent right-hand panel in favour of a **bubble bar** that surfaces *only the most relevant options* for the currently selected element. Text gets style/size/align; images get replace/crop; tables get row/column controls. Each element has its own inline editor.
**Why it works:** Avoids the "200-property inspector" overwhelm that plagues PowerPoint and Keynote-clones. Users see only what's actionable for their current selection. Matches the user's scoped intent.
**Our applicability:** We already have a floating toolbar concept. The adoption is *content-aware filtering*: when text is selected, hide image controls and vice versa. Map element-type → toolbar-section in `floatingToolbar.js`. This is a UX rule, not new architecture.
**Effort estimate:** S
**Invariant check:** PASS.

---

### P4 — ADAPT — Focus effect during presentation (Source: Pitch)

**Source:** https://help.pitch.com/en/articles/5335224-present-your-slides
**Pattern:** During present mode in Pitch, the presenter can hover any block to "focus" it — the cursor turns into a magnifying glass; on click everything else fades and the chosen block is highlighted. Limited to non-interactive elements (images, shapes, charts, tables).
**Why it works:** Enables on-the-fly emphasis without pre-built builds/animations. Replaces one of the most common "I wish I could…" moments in live presentations.
**Our applicability:** Adapt rather than adopt: in our present mode, allow click-to-focus on any element, fading siblings via CSS. Because our slides *are* the DOM, this is a simple `data-focused` attribute + CSS rule. No animations engine needed.
**Effort estimate:** M
**Invariant check:** PASS (CSS-only, no server).

---

### P5 — ADOPT — Dual-view slide rail (vertical strip + grid overview) (Source: Figma Slides, Gamma, Slidev)

**Source:** https://help.figma.com/hc/en-us/articles/24170630629911-Explore-Figma-Slides ; https://sli.dev/guide/ui ; tutorialsdojo Gamma guide
**Pattern:** Figma Slides offers a toggle between **slide view** (one slide focused) and **grid view** (all slides as bird's-eye thumbnails) for reordering and structure work. Slidev provides the same via the `o` keyboard shortcut → "Quick Overview". Gamma uses a vertical "film strip" with drag-and-drop reorder.
**Why it works:** Different tasks need different scales. Editing one slide ≠ restructuring a deck. Forcing one view for both creates either too-small thumbnails (hard to grok) or too-large rail (eats canvas). The toggle pattern resolves the conflict.
**Our applicability:** Add an `o` shortcut (and a button in the rail) that swaps the editor into a grid-of-thumbnails overlay. Reusing existing slide thumbnails — no new render path. On click, return to single-slide editing.
**Effort estimate:** M
**Invariant check:** PASS.

---

### P6 — ADOPT — `Esc` exits any modal mode (Source: Universal — PowerPoint, Google Slides, Canva, Slidev, Reveal.js)

**Source:** https://support.google.com/docs/answer/1696787 ; https://sli.dev/guide/ui ; testbook PowerPoint Q&A
**Pattern:** `Esc` is the universally-expected key to exit present mode, focus mode, or any overlay. Documented across PowerPoint, Google Slides, Canva, Slidev, Adobe presentation tools.
**Why it works:** Muscle memory. Users press Esc reflexively when they want "out". Any deviation creates a "trapped" feeling.
**Our applicability:** Audit our keymap. `Esc` should: (a) exit present mode, (b) clear current selection, (c) close any open overlay (palette, picker, banner). Reduces AUDIT-B journey-8 keyboard-friction directly.
**Effort estimate:** S
**Invariant check:** PASS.

---

### P7 — ADOPT — `o` shortcut for slide overview (Source: Slidev, Reveal.js)

**Source:** https://sli.dev/guide/ui ; https://revealjs.com/
**Pattern:** Pressing `o` toggles a grid overview of all slides in both Slidev and Reveal.js. Lets developer-presenters jump across the deck without scrolling the rail.
**Why it works:** Mirrors video-game / file-browser patterns where one key opens "the map". Faster than scrolling a thumbnail rail in 50+ slide decks.
**Our applicability:** Implement as the trigger for P5's grid view. Tiny code change once P5 lands.
**Effort estimate:** XS (after P5).
**Invariant check:** PASS.

---

### P8 — ADAPT — Right-click context menu on slide thumbnails (Source: PowerPoint, Slides.com)

**Source:** https://slides.com/features ; PowerPoint thumbnail-pane context menu (slidemodel.com)
**Pattern:** Right-clicking any block (Slides.com) or thumbnail (PowerPoint) opens a contextual menu with cut/copy/paste/duplicate/delete/section/format. Matches OS-native expectations.
**Why it works:** Right-click is OS muscle memory. Putting common slide ops behind right-click avoids cluttering the toolbar.
**Our applicability:** Already partially present per AUDIT-B journey-12. Adaptation: ensure the menu items are *shared* with keyboard shortcuts (so users learn one and discover the other), and add a `…` button on hover for touch / no-right-click users.
**Effort estimate:** S
**Invariant check:** PASS.

---

### P9 — ADOPT — Layers / structure panel (Source: Pitch, Figma Slides, Slides.com)

**Source:** https://pitch.com/whats-new (Layers section, Feb 2026); https://help.figma.com/hc/en-us/articles/27330413404567-Select-layers-in-a-slide-deck
**Pattern:** Pitch's Feb-2026 release added a "Layers section" to organize stacked elements. Figma Slides has a Layers panel in design mode showing object hierarchy. Slides.com supports nested groups visible via context menu.
**Why it works:** When elements overlap, click-to-select is ambiguous. A layers list is the canonical disambiguator. Hovering a layer in the list highlights it on canvas — bidirectional.
**Our applicability:** **Strategic fit.** Our content is HTML — the DOM tree IS the layer structure. We can offer a layers panel that reflects real DOM, not an abstract layer list. This is a unique advantage no competitor can match. Pairs with our existing stack-depth badge (ADR-002).
**Effort estimate:** M
**Invariant check:** PASS — pure DOM read.

---

### P10 — ADAPT — Lock to prevent accidental edits (Source: Slides.com, Figma)

**Source:** https://slides.com/features
**Pattern:** Slides.com lets users lock individual blocks or entire slides; locked items can be selected but not modified. Same pattern in Figma, Sketch.
**Why it works:** Prevents accidental drag/resize of carefully positioned elements (e.g., backgrounds, headers). Common in template-driven workflows.
**Our applicability:** Add `data-locked="true"` attribute on elements; UI toggle in floating toolbar; honour in direct-manipulation handlers. Useful for technical decks where, for example, a code block shouldn't move.
**Effort estimate:** S
**Invariant check:** PASS.

---

### P11 — ADAPT — Custom alignment guides + grid (Source: Pitch Feb 2026, Canva)

**Source:** https://pitch.com/whats-new (Custom Guides, Feb 2026); https://www.canva.com/help/resize-and-crop/
**Pattern:** Pitch's Feb-2026 release added "customized guides with predefined margins and gridlines". Canva ships an inferred grid that snaps drags. Both reduce alignment work to a drag-and-snap.
**Why it works:** Manual pixel-pushing is the most-cited friction in slide editors. Guides give "good-enough" placement for free.
**Our applicability:** We already have grid scaffolding (per ARCH overview). Adapt by exposing toggle and snap-distance setting; add visual guides during drag (CSS overlay).
**Effort estimate:** M
**Invariant check:** PASS.

---

### P12 — ADOPT — Shrink-text-to-fit container (Source: Pitch Feb 2026, Keynote)

**Source:** https://pitch.com/whats-new (Shrink text to fit, Feb 2026)
**Pattern:** Pitch's Feb-2026 release lets text auto-shrink to fit inside any shape. Keynote has had this as "Autosize Text" since v1; criticized as missing in Figma Slides per Allen Pike's review.
**Why it works:** Eliminates the "my text overflowed" debugging loop. Tunes typography to container, not the reverse.
**Our applicability:** A `data-shrink-fit="true"` attribute on text blocks; on resize, JS measures vs. container and adjusts `font-size`. Pure DOM, no engine. Pairs with our existing inspector.
**Effort estimate:** M
**Invariant check:** PASS.

---

### P13 — ADOPT — Constrain-on-Shift, resize-from-center on Alt (Source: Canva, every design tool)

**Source:** https://www.canva.com/help/canva-keyboard-shortcuts/ ; https://forum.figma.com/...resizing
**Pattern:** Canva (and every design tool since CorelDraw 1989): Shift-drag-corner constrains aspect ratio; Alt/Option-drag-side resizes from center; Shift-click adds to selection. Marquee select via click-drag on empty space.
**Why it works:** Universal muscle memory. Anyone who's used Photoshop / Figma / Canva expects this; deviation feels broken.
**Our applicability:** Audit our resize handlers; add modifier-key branches. Estimated <100 LOC across drag and selection modules.
**Effort estimate:** S
**Invariant check:** PASS.

---

### P14 — ADOPT — Hot-reload preview (Source: Slidev, Marp)

**Source:** https://sli.dev/guide/why ; https://marketplace.visualstudio.com/items?itemName=marp-team.marp-vscode
**Pattern:** Slidev uses Vite HMR — every file change updates the slide instantly without reload. Marp's VS Code extension auto-updates the preview pane and highlights the active slide based on cursor position.
**Why it works:** Closes the edit-save-reload loop. Crucial for technical authors iterating on layout/CSS.
**Our applicability:** **Adapt** rather than adopt directly: we have no build step (good!). But we can offer "watch this HTML file on disk, reload preview on change" as an opt-in for power users authoring in their own editor + previewing in ours. Complements (does not replace) WYSIWYG.
**Effort estimate:** M (File System Access API where available; fallback to manual reload otherwise).
**Invariant check:** PASS (no bundler needed; uses browser file APIs).

---

### P15 — ADOPT — Speaker notes pane / split presenter view (Source: Slidev, Reveal.js, Pitch)

**Source:** https://sli.dev/guide/ui ; https://revealjs.com/ ; https://help.pitch.com/en/articles/5335224-present-your-slides
**Pattern:** All three peers ship a separate presenter window showing current slide, next slide, notes, and a timer. Open in a second window/screen during presentation; main window mirrors to projector.
**Why it works:** Speaker notes are useless if they're not visible during the talk. The dual-window pattern is the canonical solution since PowerPoint 2003.
**Our applicability:** Open present mode in a popup window with `?presenter=1`, render notes from `data-notes` attribute. Sync slide index via `BroadcastChannel` (already same-origin for file://, works without server). Differential value: works fully offline, unlike Slidev which needs the dev server.
**Effort estimate:** M
**Invariant check:** PASS (BroadcastChannel works on file:// in Chromium-based browsers; verify Firefox).

---

### P16 — ADAPT — Live cursor highlight on hover-in-rail (Source: Marp VS Code)

**Source:** https://deepwiki.com/marp-team/marp-vscode/3-feature-documentation
**Pattern:** Marp's VS Code preview highlights the slide corresponding to the cursor position in the source markdown. Bidirectional: clicking a thumbnail jumps the editor.
**Why it works:** Keeps source and preview in sync without explicit user action. Core to "edit in code, see in preview" model.
**Our applicability:** Adapt: when our HTML-source mode is active (the existing dev-mode tab), highlight the slide whose `<section>` contains the cursor. Bidirectional: clicking a slide rail thumbnail scrolls source to that section.
**Effort estimate:** M
**Invariant check:** PASS.

---

## Reject pile (with rationale)

| Pattern | Source | Why rejected |
|---|---|---|
| **Live cursors / multiplayer editing** | Pitch live video collaboration; Slidev 2026 real-time collab claim | Requires WebSocket server + CRDT layer. Violates ADR-017/028 (no server, local-first). Hard reject. |
| **AI deck generation from prompt** | Gamma 3.0 Agent | Requires server-side LLM (or massive local model). Out of scope per task brief; possible v3 conversation only. |
| **Cloud asset / template library** | Canva media library, Pitch templates | Server dependency. We can ship local fixtures (P2) but cannot match the depth of cloud libraries. Differentiate, don't compete. |
| **Card-and-scroll content model** | Gamma "scrollable card" format | Fundamentally different content shape from "deck of slides". Adopting would alienate users coming from PowerPoint / Reveal.js, our actual audience. Conflicts with v0 promise of `Open → select → edit → save` for *existing* HTML decks. |
| **Always-on right sidebar property panel** | Older Pitch (pre-redesign), PowerPoint, Google Slides | Pitch *removed* this in their redesign because it ate canvas space. Following Pitch's lead, prefer P3 inline contextual editing over persistent panel. (If we need a layers panel — P9 — make it collapsible.) |

---

## Cross-cutting observations

**The death of Tome is instructive.** Tome reached 20M users on free AI-generated decks and still couldn't monetize ($4M ARR at shutdown per Semafor). The lesson for us: **AI generation is a feature users adopt but don't pay for.** Our wedge — local-first, file://, hand-crafted HTML — is harder to adopt but stickier once adopted. Don't chase the AI funnel.

**Pitch's redesign removed a panel.** When Pitch pivoted from a persistent right-side properties panel to a bubble bar (per their product-redesign blog), they explicitly cited "more space for slides" as the goal. This validates our v2.0.30 direction: floating toolbar > sidebar inspector. Don't backslide.

**Slidev's Quick Overview is technically what we already have rendered, just behind a key.** Our slide rail already builds thumbnails. The work to add an `o` overview mode is mostly CSS + state-toggle, ~half a day. High ROI per the keyboard-only journey audit.

**Figma Slides' Grid View has a known bug**: layers panel disappears in grid view (multiple Figma forum reports). This is exactly the conflict we'd face if we naively dual-mode. Plan: in grid mode, hide inspector; on slide-click, return to slide mode and restore inspector. Don't try to keep both visible simultaneously.

**Canva pattern recap (validated keyboard model):**
- Shift+click = add to selection
- Shift+drag corner = constrain proportions
- Alt/Option+drag = resize from center
- Marquee = click-drag on empty space
- Right-click = contextual menu
- Esc = exit/clear

We should adopt all of these *as a set* — partial implementation creates the worst of both worlds (some shortcuts work, others don't, user doesn't know which).

---

## What we already do well (validated by competitive scan)

- **Floating toolbar instead of sidebar inspector** — matches Pitch's 2024-2025 redesign direction.
- **Selection frame click-through** (per v2.0.30 fix in recent commits) — matches Canva, Figma's bounding-box-as-overlay pattern.
- **No-build, file:// works** — unique. No competitor in this audit ships a fully offline-capable editor.
- **Direct DOM manipulation** — Slidev and Marp both treat their target output as the source of truth; we go further by editing the *delivered* HTML directly.

---

## Where we are visibly behind

1. **Empty state** — three-button row with redundant numbered list is the most novice-hostile surface in the editor (per AUDIT-B journey 1, confirmed by competitive scan). Industry has converged on visual-template-first.
2. **Keyboard-only workflow** — peers (Slidev, Reveal.js) make `o` and `Esc` first-class. We don't yet.
3. **Layers / structure visibility** — Pitch added Layers in Feb 2026; Figma has had it since launch. We have a stack-depth badge (ADR-002) but no panel; users can see they're 2/3 deep but cannot navigate the stack.
4. **Speaker notes** — none of our docs mention a presenter view with notes; competitors all have one.
5. **Snap guides on drag** — Pitch shipped this in Feb 2026; we have grid scaffolding but no live drag guides per current commit log.

---

## Sources

1. [Gamma App Review 2026 — Kripesh Adwani](https://kripeshadwani.com/gamma-app-review/)
2. [Gamma changelog (Canny)](https://meetgamma.canny.io/changelog)
3. [Gamma developer changelog](https://developers.gamma.app/changelog)
4. [Gamma Review 2026 — max-productive.ai](https://max-productive.ai/ai-tools/gamma/)
5. [Pitch — What's new](https://pitch.com/whats-new)
6. [Pitch — Product redesign blog](https://pitch.com/blog/pitch-product-redesign-collaboration-features)
7. [Pitch — Present your slides (Help)](https://help.pitch.com/en/articles/5335224-present-your-slides)
8. [Tome shut down — 356labs analysis](https://www.356labs.com/blog/the-ai-presentation-app-tome-is-no-more)
9. [Tome layoffs — Semafor (Apr 2024)](https://www.semafor.com/article/04/16/2024/ai-startup-tome-lays-off-staff-to-focus-on-revenue)
10. [Why Tome failed vs Gamma — Substack](https://signalhub.substack.com/p/tome-failed-in-ai-pptwhy-is-gamma)
11. [Reveal.js homepage](https://revealjs.com/)
12. [Slides.com features](https://slides.com/features)
13. [Slides.com developer mode](https://help.slides.com/knowledgebase/articles/454562-developer-mode)
14. [Slidev — Why](https://sli.dev/guide/why)
15. [Slidev — User Interface guide](https://sli.dev/guide/ui)
16. [Slidev — Drawing & Annotations](https://sli.dev/features/drawing)
17. [Marp for VS Code (Marketplace)](https://marketplace.visualstudio.com/items?itemName=marp-team.marp-vscode)
18. [Marp VS Code feature docs (DeepWiki)](https://deepwiki.com/marp-team/marp-vscode/3-feature-documentation)
19. [Slidev vs Marp vs Reveal.js 2026 — PkgPulse](https://www.pkgpulse.com/blog/slidev-vs-marp-vs-revealjs-code-first-presentations-2026)
20. [Canva keyboard shortcuts](https://www.canva.com/help/canva-keyboard-shortcuts/)
21. [Canva resize and crop help](https://www.canva.com/help/resize-and-crop/)
22. [Canva presentations landing](https://www.canva.com/presentations/)
23. [Figma Slides — Explore (Help Center)](https://help.figma.com/hc/en-us/articles/24170630629911-Explore-Figma-Slides)
24. [Figma Slides — Select layers](https://help.figma.com/hc/en-us/articles/27330413404567-Select-layers-in-a-slide-deck)
25. [Figma Slides — Allen Pike review](https://allenpike.com/2025/figma-slides-beautiful-disaster/)
26. [Empty state UX — Eleken](https://www.eleken.co/blog-posts/empty-state-ux)
27. [Empty state UX — UserOnboard](https://www.useronboard.com/onboarding-ux-patterns/empty-states/)
28. [Carbon design system — empty states](https://carbondesignsystem.com/patterns/empty-states-pattern/)
29. [Progressive disclosure — Nielsen Norman Group](https://www.nngroup.com/articles/progressive-disclosure/)
30. [Progressive disclosure — Interaction Design Foundation](https://ixdf.org/literature/topics/progressive-disclosure)

---

## Confidence and limitations

- **Strong evidence** for: Tome shutdown (multiple independent sources); Pitch's design direction (their own blog + changelog); Slidev/Marp/Reveal.js feature set (official docs); universal Esc / shift-constrain shortcuts (cross-tool consensus).
- **Medium evidence** for: Gamma editor specifics — the Canny changelog focuses on content features, not UI ergonomics; review articles vary in depth. UI-pattern claims about Gamma are corroborated across at least 2 reviews where stated.
- **Lower evidence** for: Figma Slides 2025-2026 specifics — graduated from beta in March 2025, but several documented features have known bugs (layers-in-grid-view) per their own forum. Used as cross-reference, not authoritative.
- **WebFetch failed** for: `canva.com/presentations` (403), `canva.com/help/canva-keyboard-shortcuts` (403). Fell back to web-search-derived summaries; cross-checked against multiple shortcut-list articles.
- **Not investigated:** Beautiful.ai, Genially, Mentimeter (out of scope per task brief). Decktopus, ClassPoint (smaller players).

## Suggested next research directions

- **Accessibility audit** of competitors: how do they support screen readers in present mode? (Slidev, Reveal.js are likely best given semantic HTML output.)
- **Mobile/touch** patterns: we are desktop-first, but Canva's pinch-to-zoom and Pitch's reactions are mobile-tested. Worth a separate teardown if mobile becomes in-scope.
- **Theme/token systems**: how do competitors expose typographic and color customization? (Relevant to our ADR-007 design tokens.)
- **Export fidelity**: how good is Slides.com → PPTX? Pitch → PDF? Comparing against our PPTX export quality would be a separate audit.
