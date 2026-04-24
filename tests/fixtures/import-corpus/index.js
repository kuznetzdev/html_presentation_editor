// tests/fixtures/import-corpus/index.js
// 10 reference HTML decks (one per major framework family + edge cases)
// for Smart Import Pipeline v2 detector + inference verification.
// Decks intentionally minimal — large enough to drive detectors,
// small enough that pipeline runs quickly inside test contexts.
"use strict";

const REVEAL = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="reveal.css">
<script src="reveal.js"></script>
</head><body>
<div class="reveal"><div class="slides">
<section data-markdown>Slide 1</section>
<section data-background-color="#222">Slide 2</section>
<section><h1>Slide 3</h1></section>
</div></div></body></html>`;

const IMPRESS = `<!DOCTYPE html><html><body>
<div id="impress">
<div class="step" data-x="0" data-y="0"><h1>Step 1</h1></div>
<div class="step" data-x="1000" data-y="500"><h1>Step 2</h1></div>
</div>
<script src="impress.js"></script>
</body></html>`;

const SPECTACLE = `<!DOCTYPE html><html><body>
<div id="root" data-slide-count="3">
<div class="css-1abcSlideContainer"></div>
<div class="css-2defSlide" data-spectacle></div>
</div></body></html>`;

const MARP = `<!DOCTYPE html><html><head>
<meta name="marp" content="true">
<link href="https://cdn.jsdelivr.net/npm/marpit-style/dist/marpit.css" rel="stylesheet">
</head><body>
<section data-marpit-slide><h1>Slide 1</h1></section>
<section data-marpit-slide><h1>Slide 2</h1></section>
</body></html>`;

const SLIDEV = `<!DOCTYPE html><html><body>
<div id="slidev-app">
<div class="slidev-page" data-slidev-slide-no="1"><h1>Intro</h1></div>
<div class="slidev-page" data-slidev-slide-no="2"><h2>Next</h2></div>
</div>
<script src="slidev-runtime.js"></script>
</body></html>`;

const MSO_PPTX = `<!DOCTYPE html><html><head>
<meta name="GENERATOR" content="Microsoft PowerPoint">
<!--[if gte mso 9]><xml><o:OLEObject></o:OLEObject></xml><![endif]-->
</head><body>
<div class="MsoSlideOuter">
<p class="MsoNormal">Hello slide</p>
</div></body></html>`;

const CANVA = `<!DOCTYPE html><html><head>
<meta property="og:site_name" content="Canva">
</head><body>
<div class="CanvaDesignWrapper">
<div class="CanvaDesignSlide"><h1>Imported from canva.com</h1></div>
</div></body></html>`;

const NOTION = `<!DOCTYPE html><html><body>
<div class="notion-page">
<div class="notion-block" data-block-id="abc-123"><h1>From Notion</h1></div>
<div class="notion-block" data-block-id="def-456"><p>Subpage notion.so</p></div>
</div></body></html>`;

const GENERIC_H1_SPLIT = `<!DOCTYPE html><html><body>
<h1>Slide 1</h1>
<p>Slide 1 content.</p>
<h1>Slide 2</h1>
<p>Slide 2 content.</p>
<h1>Slide 3</h1>
<p>Slide 3 content.</p>
</body></html>`;

const GENERIC_SECTION = `<!DOCTYPE html><html><body>
<section data-slide-id="a"><h1>Bare A</h1></section>
<section data-slide-id="b"><h1>Bare B</h1></section>
</body></html>`;

const CORPUS = [
  { id: "reveal", html: REVEAL, expectedFramework: "reveal", expectedStrategy: "explicit", minSlides: 3 },
  { id: "impress", html: IMPRESS, expectedFramework: "impress", expectedStrategy: "explicit", minSlides: 2 },
  { id: "spectacle", html: SPECTACLE, expectedFramework: "spectacle", expectedStrategy: "single", minSlides: 1 },
  { id: "marp", html: MARP, expectedFramework: "marp", expectedStrategy: "explicit", minSlides: 2 },
  { id: "slidev", html: SLIDEV, expectedFramework: "slidev", expectedStrategy: "explicit", minSlides: 2 },
  { id: "mso-pptx", html: MSO_PPTX, expectedFramework: "mso-pptx", expectedStrategy: "single", minSlides: 1 },
  { id: "canva", html: CANVA, expectedFramework: "canva", expectedStrategy: "single", minSlides: 1 },
  { id: "notion", html: NOTION, expectedFramework: "notion", expectedStrategy: "single", minSlides: 1 },
  { id: "generic-h1-split", html: GENERIC_H1_SPLIT, expectedFramework: "generic", expectedStrategy: "h1-split", minSlides: 3 },
  { id: "generic-section", html: GENERIC_SECTION, expectedFramework: "generic", expectedStrategy: "explicit", minSlides: 2 },
];

module.exports = { CORPUS };
