const path = require("path");
const { toTestServerUrl } = require("../../../scripts/test-server-config");

const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..", "..");
const REFERENCE_ROOT = path.join(WORKSPACE_ROOT, "references_pres");

const REFERENCE_FAMILIES = Object.freeze({
  v1: {
    dir: path.join(REFERENCE_ROOT, "html-presentation-examples_v1"),
    manualBaseUrl: toTestServerUrl("/references_pres/html-presentation-examples_v1/"),
  },
  v2: {
    dir: path.join(REFERENCE_ROOT, "html-presentation-examples_v2", "examples"),
    manualBaseUrl: toTestServerUrl(
      "/references_pres/html-presentation-examples_v2/examples/",
    ),
  },
});

const REFERENCE_DECK_CASES = Object.freeze(
  [
    {
      id: "v1-minimal-inline",
      family: "v1",
      relativePath: "01-minimal-inline.html",
      capabilities: ["inline-styles", "minimal", "text"],
    },
    {
      id: "v1-semantic-css",
      family: "v1",
      relativePath: "02-semantic-css.html",
      capabilities: ["sections", "semantic-css", "text"],
    },
    {
      id: "v1-absolute-positioned",
      family: "v1",
      relativePath: "03-absolute-positioned.html",
      capabilities: ["absolute", "layers", "positioning"],
    },
    {
      id: "v1-data-attributes-editorish",
      family: "v1",
      relativePath: "04-data-attributes-editorish.html",
      capabilities: ["authored-markers", "data-attributes", "text"],
    },
    {
      id: "v1-css-variables-theme",
      family: "v1",
      relativePath: "05-css-variables-theme.html",
      capabilities: ["css-variables", "dark-theme", "theme"],
    },
    {
      id: "v1-animated-fragments",
      family: "v1",
      relativePath: "06-animated-fragments.html",
      capabilities: ["animation", "fragments", "stateful"],
    },
    {
      id: "v1-svg-heavy",
      family: "v1",
      relativePath: "07-svg-heavy.html",
      capabilities: ["graphics", "svg"],
    },
    {
      id: "v1-table-and-report",
      family: "v1",
      relativePath: "08-table-and-report.html",
      capabilities: ["dense-content", "lists", "tables"],
    },
    {
      id: "v1-mixed-media",
      family: "v1",
      relativePath: "09-mixed-media.html",
      capabilities: ["code", "media", "mixed-media"],
    },
    {
      id: "v1-author-marker-contract",
      family: "v1",
      relativePath: "10-author-marker-contract.html",
      capabilities: ["authored-markers", "marker-contract", "text"],
    },
    {
      id: "v1-stress-nested-layout",
      family: "v1",
      relativePath: "10-stress-nested-layout.html",
      capabilities: ["layout-containers", "nested-dom", "stress-layout"],
    },
    {
      id: "v1-selection-engine-v2",
      family: "v1",
      relativePath: "11-selection-engine-v2.html",
      capabilities: ["overlap", "positioning", "selection-engine"],
    },
    {
      id: "v1-layout-containers-v1",
      family: "v1",
      relativePath: "12-layout-containers-v1.html",
      capabilities: ["absolute", "layout-containers", "flow"],
    },
    {
      id: "v1-tables-v1",
      family: "v1",
      relativePath: "13-tables-v1.html",
      capabilities: ["table-ops", "tables"],
    },
    {
      id: "v1-code-blocks-v1",
      family: "v1",
      relativePath: "14-code-blocks-v1.html",
      capabilities: ["code-blocks", "whitespace"],
    },
    {
      id: "v2-basic-static-inline",
      family: "v2",
      relativePath: "01-basic-static-inline.html",
      capabilities: ["inline-styles", "text"],
    },
    {
      id: "v2-semantic-sections-classes",
      family: "v2",
      relativePath: "02-semantic-sections-classes.html",
      capabilities: ["sections", "semantic-css", "text"],
    },
    {
      id: "v2-scroll-snap-deck",
      family: "v2",
      relativePath: "03-scroll-snap-deck.html",
      capabilities: ["scroll-snap", "stateful-layout"],
    },
    {
      id: "v2-data-driven-rendered",
      family: "v2",
      relativePath: "04-data-driven-rendered.html",
      capabilities: ["data-driven", "runtime-generated"],
    },
    {
      id: "v2-web-components-deck",
      family: "v2",
      relativePath: "05-web-components-deck.html",
      capabilities: ["custom-elements", "web-components"],
    },
    {
      id: "v2-reveal-compatible-markup",
      family: "v2",
      relativePath: "06-reveal-compatible-markup.html",
      capabilities: ["fragments", "nested-sections", "reveal"],
    },
    {
      id: "v2-relative-assets-multi-file",
      family: "v2",
      relativePath: "07-relative-assets-multi-file.html",
      capabilities: ["asset-parity", "multi-file", "relative-assets"],
    },
  ].map((deckCase) => {
    const family = REFERENCE_FAMILIES[deckCase.family];
    if (!family) {
      throw new Error(`Unknown reference deck family: ${deckCase.family}`);
    }
    return Object.freeze({
      ...deckCase,
      fixturePath: path.join(family.dir, deckCase.relativePath),
      manualBaseUrl: family.manualBaseUrl,
    });
  }),
);

const REFERENCE_DECK_CASES_BY_ID = Object.freeze(
  Object.fromEntries(REFERENCE_DECK_CASES.map((deckCase) => [deckCase.id, deckCase])),
);

function getReferenceDeckCase(caseId) {
  const deckCase = REFERENCE_DECK_CASES_BY_ID[String(caseId || "")];
  if (!deckCase) {
    throw new Error(`Unknown reference deck case: ${caseId}`);
  }
  return deckCase;
}

module.exports = {
  REFERENCE_DECK_CASES,
  REFERENCE_DECK_CASES_BY_ID,
  REFERENCE_DECK_FAMILIES: REFERENCE_FAMILIES,
  REFERENCE_ROOT,
  getReferenceDeckCase,
};
