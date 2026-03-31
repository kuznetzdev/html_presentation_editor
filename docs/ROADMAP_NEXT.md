# ROADMAP NEXT

## Post-0.13.5 priorities

Stage D is now signed off for connected asset-directory truthfulness. The next open release gate is compact-shell focus isolation and drawer hardening.

### 1. Focus isolation and shell hardening (`v0.13.6`)

Goals:
- keep hidden drawers and overlays out of the focus order
- re-check compact shell stability after stage-specific flows are enabled

Substeps:
- harden narrow drawer inertness and restore paths
- re-run topbar, menu, popover, and mobile rail stability checks
- keep shell geometry and keyboard path stable across `390 / 640 / 820`

### 2. Internal zoning without architecture rewrite (`v0.13.7`)

Goals:
- reduce blast radius inside the large editor file
- keep the fixed runtime architecture unchanged

Substeps:
- carve explicit zones for preview lifecycle, slide flow, direct manipulation, export/assets, and shell layout
- keep refactors contiguous and responsibility-based before extracting files
- preserve `parent shell + iframe + bridge + modelDoc`

### 3. System polish after correctness (`v0.14.0`)

Goals:
- keep light/dark parity and visual consistency without re-opening correctness regressions

Substeps:
- re-run visual baselines after stage F cleanup
- normalize controls, spacing, radius, and shadows
- avoid any new shell-drift or hidden-focus regressions while polishing

## Suggested version path

1. `0.13.6`
   focus: focus isolation and compact shell hardening
2. `0.13.7`
   focus: structure cleanup without architecture rewrite
3. `0.14.0`
   focus: visual and system polish after correctness is already locked
