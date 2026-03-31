# ROADMAP NEXT

## Post-0.13.3 priorities

### 1. Direct manipulation coordinate correctness (`v0.13.4`)

Goals:
- move from safe blocking to exact support for the geometry cases that are actually provable
- keep incorrect coordinates impossible on nested positioned contexts

Substeps:
- model coordinate origins for nested positioned containers explicitly
- keep `absolute` and `fixed` paths correct under scroll and resize
- block unsafe transform/zoom chains honestly and route them to inspector fallback
- codify drag, resize, and nudge cases in Playwright before widening support

### 2. Truthful asset diagnostics (`v0.13.5`)

Goals:
- remove false-clean diagnostic states
- represent manual-base and remote uncertainty honestly

Substeps:
- align diagnostics text with actual resolver state
- distinguish unresolved local assets from remote or manual-base-dependent uncertainty
- codify asset-resolution error scenarios in Playwright

### 3. Focus isolation and shell hardening (`v0.13.6`)

Goals:
- keep hidden drawers and overlays out of the focus order
- re-check compact shell stability after stage-specific flows are enabled

Substeps:
- harden narrow drawer inertness and restore paths
- re-run topbar, menu, popover, and mobile rail stability checks
- keep shell geometry and keyboard path stable across `390 / 640 / 820`

### 4. Internal zoning without architecture rewrite (`v0.13.7`)

Goals:
- reduce blast radius inside the large editor file
- keep the fixed runtime architecture unchanged

Substeps:
- carve explicit zones for preview lifecycle, slide flow, direct manipulation, export/assets, and shell layout
- keep refactors contiguous and responsibility-based before extracting files
- preserve `parent shell + iframe + bridge + modelDoc`

### 5. System polish after correctness (`v0.14.0`)

Goals:
- keep light/dark parity and visual consistency without re-opening correctness regressions

Substeps:
- re-run visual baselines after stage F cleanup
- normalize controls, spacing, radius, and shadows
- avoid any new shell-drift or hidden-focus regressions while polishing

## Suggested version path

1. `0.13.4`
   focus: direct-manipulation coordinate correctness
2. `0.13.5`
   focus: truthful asset diagnostics
3. `0.13.6`
   focus: focus isolation and compact shell hardening
5. `0.13.7`
   focus: structure cleanup without architecture rewrite
6. `0.14.0`
   focus: visual and system polish after correctness is already locked
