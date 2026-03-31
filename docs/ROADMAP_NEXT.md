# ROADMAP NEXT

## Post-0.13.6 priorities

Stage E is now signed off for compact-shell drawer close and hidden-panel inertness. The next open release gate is responsibility-based cleanup inside the large editor file.

### 1. Internal zoning without architecture rewrite (`v0.13.7`)

Goals:
- reduce blast radius inside the large editor file
- keep the fixed runtime architecture unchanged

Substeps:
- carve explicit zones for preview lifecycle, slide flow, direct manipulation, export/assets, and shell layout
- keep refactors contiguous and responsibility-based before extracting files
- preserve `parent shell + iframe + bridge + modelDoc`

### 2. System polish after correctness (`v0.14.0`)

Goals:
- keep light/dark parity and visual consistency without re-opening correctness regressions

Substeps:
- re-run visual baselines after stage F cleanup
- normalize controls, spacing, radius, and shadows
- avoid any new shell-drift or hidden-focus regressions while polishing

## Suggested version path

1. `0.13.7`
   focus: structure cleanup without architecture rewrite
2. `0.14.0`
   focus: visual and system polish after correctness is already locked
