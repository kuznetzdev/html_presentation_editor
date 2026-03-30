# Remaining issues after 0.13.1

## Closed in this pass

- shell chrome no longer depends on circular height assumptions
- responsive shell QA is signed off for `390 / 640 / 820 / 1100 / 1280 / 1440`
- light/dark shell QA is signed off on representative narrow / mid / wide widths
- compact drawers, popovers, context menu, mobile rail, preview note, and compact floating toolbar no longer compete for the same viewport space
- hidden floating-toolbar controls are no longer left in the keyboard path

## Still open

### 1. Direct manipulation is only partially solved

Verified:
- simple drag on an `absolute` element remains correct

Not solved:
- transformed nodes
- transformed ancestors
- nested positioned containers with harder coordinate chains
- zoom-heavy documents
- touch / trackpad behaviour

### 2. Asset coverage is still incomplete

Still incomplete:
- CSS `url()` asset chains
- `srcset`
- `poster`
- deeper preview/export parity checks
- full browser validation of the manual base-URL workflow

### 3. Slide flow is still timing-sensitive

Current reality:
- slide activation still depends on bridge/runtime metadata arriving in time
- shell keeps resend paths around runtime metadata application
- stale-seq / sync-lock logic is present, but still concentrated in one fragile cluster

### 4. No automated validation pipeline exists for this standalone editor

Current reality:
- verification is still browser-first and smoke-test driven
- there is no repo-local command that replays the signed-off shell QA set before a release tag

### 5. The main editor file is still too large

Current reality:
- the system is more stable, but maintenance cost remains high
- internal extraction by responsibility is still needed without changing the fixed runtime architecture

## Immediate priorities after 0.13.1

1. preview lifecycle and slide activation hardening
2. asset fidelity and export parity
3. direct manipulation support beyond the simplest geometry cases
4. automated responsive/theme/keyboard smoke validation
5. internal zoning of the editor file by responsibility
