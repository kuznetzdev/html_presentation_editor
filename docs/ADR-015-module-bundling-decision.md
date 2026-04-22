# ADR-015: Module Bundling Decision — keep zero-build to v1.0

**Status**: Accepted — Zero-build invariant enforced throughout v0.26.0–v0.33.1; no type=module or bundler added
**Phase**: v0.26.x–v1.0 (decision document — no build step change)
**Owner**: Architecture
**Date**: 2026-04-20

---

## Context

Project has an explicit "no build step" invariant dating from the monolith era. Current shape:

- `editor/presentation-editor.html` loads 25 classic `<script src>` files + 8 CSS files. No bundler.
- Works off `file://` directly — user double-clicks the HTML.
- Total wire cost: ~946 KB across 34 files (AUDIT-C §File size inventory).
- Initial parse: ~20 ms JS + CSS parse. Acceptable.

This ADR is being written because AUDIT-C, AUDIT-A, and the introduction of ADR-011 (JSDoc) + ADR-012 (bridge v2) raise the perennial question: "if we add one step (tsc --noEmit), why not five (Vite/esbuild)?". A formal decision avoids architectural drift.

Pressures **for** bundling:

- Module system (real `import`/`export`). Enables Redux/Zustand/Valtio — but ADR-013 deliberately avoids these.
- Tree-shaking. We have ~780 KB shell JS; some dead code lives in modules (AUDIT-A §dead-code §6).
- Minification. 20 ms parse → ~12 ms.
- IDE ergonomics on imports.
- Modern "standard" approach — ESM is universal in 2026.

Pressures **against** bundling:

- `file://` workflow. User-double-click opens the editor. Vite dev server breaks that.
- Single-file distribution goal. The editor is intended to run offline, no npm, no server.
- Debuggability. Stack traces in unminified classical scripts match source 1:1.
- Hot-reload is not needed (user is editing content, not code).
- Build step = new failure mode (lockfile drift, toolchain incompatibility on Windows, CI rebuilds).
- CLAUDE.md lists it as a load-bearing feature: "Zero build step — это фича".

---

## Decision

**Keep zero-build through v1.0.**

Clarify what "zero build" means vs. what is allowed:

| Allowed (compile-time only, no runtime impact) | Not allowed |
|---|---|
| `tsc --noEmit` for type check (ADR-011) | Transpile `.ts` → `.js` |
| CSS formatters / linters (stylelint) | CSS preprocessing (Sass, PostCSS) |
| Optional `npm run format` / ESLint fixers | Webpack / Vite / esbuild / Parcel |
| Playwright installs | Bundling `<script>` into one file |
| Dev `static-server.js` for http://localhost testing | Module federation, dynamic imports that need a bundler |
| Generated asset manifests (e.g. for PPTX export vendoring) | Runtime module resolver |

The `package.json scripts.start` / `serve` paths remain the only "how to run" — no prerequisite build.

### Revisit triggers

This ADR is **up for revision** when any of these occur:

1. Total shell JS exceeds 1.5 MB (currently 780 KB).
2. Parse time on mid-range laptop exceeds 150 ms measured (currently ~20 ms).
3. A required library ships ESM-only with no UMD fallback **and** no zero-build alternative.
4. Stakeholder decision to reposition the editor as a hosted SaaS (different product — changes many invariants).
5. Browser support floor raises to only-ESM environments.

None of these are true as of 2026-04-20 on v0.25.0.

### What this means operationally

- PPTX export dep (`pptxgenjs`) — CDN today (AUDIT-D-03). **Decision**: vendor the dist into `editor/vendor/pptxgen.bundled.min.js`. Fixed version. SRI in dev script.
- Icon/font: inline SVG + system font stack. No web-font CDN.
- Starter deck: bundled at `editor/fixtures/basic-deck.html` (PAIN-MAP P0-15) — self-contained HTML.

---

## Consequences

**Positive:**
- `file://` workflow preserved. User-double-click still works.
- No toolchain regression risk.
- Debuggability preserved.
- Decision is written down — future contributor pressure to "just add Vite" has a reference.

**Negative:**
- Must hand-optimize JS: dead code removal, file consolidation, IIFE scoping.
- No access to ESM-only libs without vendoring.
- 20 ms parse doesn't drop to 12 ms (acceptable per AUDIT-C).
- Discipline: every dev-dep that **produces output** (not just runs check) is an ADR-level decision.

---

## Alternatives Considered

1. **Adopt Vite.** Rejected — breaks file://, introduces build, contradicts SOURCE_OF_TRUTH.
2. **Rollup with UMD output, single bundle.** Rejected — still a build; debuggability regresses.
3. **esbuild zero-config single-file.** Rejected — same as above; fast build is still a build.
4. **Import-maps + ESM without bundler.** Rejected — `file://` + import-maps has browser-specific quirks; Safari lag. Reconsider in v1.x.
5. **Compile `.ts` with esbuild --no-emit-equivalent.** Rejected — `tsc --noEmit` already fulfills this need (ADR-011).

---

## Applied In

- Affirmed v0.26.x onward.
- Concrete change: vendor `pptxgenjs` dist to remove CDN dep (P0-03 remediation) — one-time vendor, not a build.

## Links
- [ADR-001 Classic Scripts](../obsidian-ref/ADR-001.md) — no-build origin
- [ADR-011 Type System Strategy](ADR-011-type-system-strategy.md) — tsc-noEmit is allowed
- CLAUDE.md §Architectural invariants
- docs/SOURCE_OF_TRUTH.md §Non-negotiable invariants
- docs/ROADMAP_NEXT.md §Architectural Invariants
- AUDIT-C §File size inventory + Executive summary
