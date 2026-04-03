# ROADMAP NEXT

## Post-0.18.1 priorities

Overlap recovery plus the advanced layers, lock, visibility, and grouping
system are now signed off. The next work should stay focused on the next
interaction layer, system consistency, and responsibility-based cleanup without
changing the fixed runtime architecture.

### 1. Smart layer resolution and selection ergonomics (`v0.19.0`)

Goals:

- make complex layer stacks easier to navigate without raw DOM literacy
- keep overlap recovery and the layers system discoverable in both novice and advanced flows
- add keyboard-first layer ordering and candidate picking where it improves real editing speed without leaking complexity into basic mode

Substeps:

- add smart layer resolution / magic select for dense overlap scenarios
- add keyboard shortcuts for layer ordering and stack traversal where the underlying model remains truthful
- normalize the new layer and overlap affordances into one coherent selection story

### 2. Internal zoning without architecture rewrite (`v0.19.x`)

Goals:

- reduce blast radius inside the large editor file
- keep shell, preview lifecycle, selection, overlap, and layers zones easier to reason about
- preserve `parent shell + iframe + bridge + modelDoc`

Substeps:

- carve responsibility zones for preview lifecycle, slide flow, selection, overlap recovery, direct manipulation, export/assets, and shell layout
- keep refactors contiguous and responsibility-based before any file splits
- avoid override-style cleanup that hides ownership problems instead of fixing them

### 3. System polish after correctness (`v0.19.x`)

Goals:

- keep light/dark parity and visual consistency without reopening correctness regressions
- keep the basic path simple and the advanced path powerful but contained

Substeps:

- normalize controls, spacing, radius, and shadow language across old and new advanced-mode surfaces
- audit topbar, rail, inspector, overlap banners, and layers rows against the product rule "presentation tool first, HTML editor second"
- avoid shell drift, focus-order regressions, and overlay conflicts while polishing

## Suggested version path

1. `0.19.0`
  focus: smart layer resolution, magic select, and stack ergonomics
2. `0.19.x`
  focus: responsibility-based cleanup without architecture rewrite
3. `0.19.x`
  focus: visual and interaction polish after the next correctness pass
