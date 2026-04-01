# ROADMAP NEXT

## Post-0.13.11 priorities

Editing ownership hardening and shell theme prepaint are now signed off.
The next work should stay focused on polish and internal cleanup, not on
changing the architecture or reopening the shell-state contract.

### 1. Internal zoning without architecture rewrite (`v0.14.0`)

Goals:

- reduce blast radius inside the large editor file
- keep the fixed runtime architecture unchanged
- make shell, preview lifecycle, slide flow, and manipulation zones easier to
  reason about
- preserve root-owned theme bootstrap and transient-surface routing while
  reducing single-file complexity

Substeps:

- carve explicit responsibility zones for preview lifecycle, slide flow,
  direct manipulation, export/assets, and shell layout
- keep refactors contiguous and responsibility-based before extracting files
- preserve `parent shell + iframe + bridge + modelDoc`

### 2. System polish after correctness (`v0.14.1`)

Goals:

- keep light/dark parity and visual consistency without reopening correctness
  regressions
- keep the basic path simple and the advanced path powerful but contained

Substeps:

- normalize controls, spacing, radius, and shadow language
- audit topbar, rail, inspector, and compact shell against the product rule
  "presentation tool first, HTML editor second"
- avoid new shell drift, focus-order regressions, and overlay conflicts while
  polishing
- keep dark/light parity attached to the same semantic tokens instead of
  introducing branchy theme-specific overrides

## Suggested version path

1. `0.14.0`
   focus: structure cleanup without architecture rewrite
2. `0.14.1`
   focus: visual and interaction polish after structure cleanup
