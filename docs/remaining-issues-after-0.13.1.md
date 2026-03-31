# Remaining issues after 0.13.1

## Closed in this pass

- live preview and export-validation now use one rendered-output asset/base contract
- validation preview no longer serializes `modelDoc` blindly for asset checks
- validation audit now reports `resolved`, `base-url`, and `unresolved` buckets
- preview-only rewrites stay out of `modelDoc`
- export-safe output remains clean while validation preview still mirrors live asset resolution behavior

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

### 2. Export validation is parity-correct for asset resolution, not for full runtime behaviour

Now solved:

- base URL handling
- relative asset categorisation
- asset-directory rewrites
- CSS `url(...)`
- `srcset`
- `poster`
- `<source src>`

Still open:

- richer diff tooling for whole-document semantic comparison
- automatic screenshot diff between live iframe and validation preview
- remote asset reachability diagnostics beyond static URL categorisation

### 3. Slide flow is still timing-sensitive

Current reality:

- slide activation still depends on bridge/runtime metadata arriving in time
- shell keeps resend paths around runtime metadata application
- stale-seq / sync-lock logic is present, but still concentrated in one fragile cluster

### 4. No fully integrated release command exists for this standalone editor

Current reality:

- verification is still browser-first and script-driven
- there is still no single repo-local release command that runs the full signed-off matrix end to end

### 5. The main editor file is still too large

Current reality:

- the system is more coherent, but maintenance cost remains high
- internal extraction by responsibility is still needed without changing the fixed runtime architecture

## Immediate priorities after 0.13.1

1. slide-activation hardening and runtime sequencing cleanup
2. screenshot-based live-vs-validation diffing
3. direct manipulation support beyond the simplest geometry cases
4. repo-local release command for parity validation
5. internal zoning of the editor file by responsibility
