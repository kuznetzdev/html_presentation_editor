# Release Report — v0.18.2

## Summary

`v0.18.2` adds preview/edit panel zoom control with full keyboard shortcuts, localStorage persistence, and coordinate system integration.

## Changes

### Feature: Preview zoom control

**User-facing**:
- Zoom controls in preview/edit panel header: `−` button, percent label (25%-200%), `+` button, `1:1` reset button
- Keyboard shortcuts: `Ctrl+=` (zoom in), `Ctrl+−` (zoom out), `Ctrl+0` (reset to 100%)
- Zoom level persists across sessions via localStorage
- Direct manipulation (drag/resize) blocked when zoom ≠ 100%

**Technical implementation**:
- Iframe scaling: `transform: scale(zoom)` + `width/height: calc(100% / zoom)` to prevent overflow
- Coordinate system updates: `toStageRect()`, `toStageAxisValue()`, `positionFloatingToolbar()` multiply by zoom factor
- Zoom blocking: `hasBlockedDirectManipulationContext()` checks `state.previewZoom !== 1` in parent shell context
- Workspace grid widening: Preview panel gained ~32px width (`260-280px | 1fr | 272-296px` grid)

**Test coverage**:
- New test: `shell.smoke.spec.js` → "preview zoom controls change scale and persist @stage-f"
- Validates: controls exist, button interactions, keyboard shortcuts, iframe transform, persistence, no overflow, shell geometry

### Bug fix: Zoom state context error

**Issue**: Initial implementation checked `state.previewZoom` inside iframe context (`getDirectManipulationSafety()` function), causing `ReferenceError` because `state` object only exists in parent window.

**Fix**: Moved zoom blocking check to shell-level `hasBlockedDirectManipulationContext()` where parent `state` is accessible.

**Impact**: All selection and direct manipulation flows now work correctly with zoom active.

## Validation

### Gates executed

✅ **Gate A (Fast PR)**: Passed  
✅ **Gate B (Release Candidate)**: 143/143 passed (chromium-desktop + chromium-shell-1100)  
✅ **Gate E (Asset Parity)**: 4/4 cases passed, "ok": true  

**Total**: 157/157 tests passed (100%)

### Regression analysis

**Zero regressions detected**. All existing functionality stable:
- Workflow contract
- Selection engine (smart mode, container mode, click-through)
- Layer navigation and overlap recovery
- Layers panel (selection sync, drag reorder, lock, visibility, grouping)
- Direct manipulation
- Export integrity

## Files changed

### Runtime
- `editor/presentation-editor-v0.18.1.html` → `editor/presentation-editor-v0.18.2.html` (renamed)
- `docs/history/presentation-editor-v0.18.1.html` (archived)

### Configuration
- `package.json` — version: `0.18.2`
- `playwright.config.js` — (no change, version-agnostic)
- `tests/playwright/helpers/editorApp.js` — TARGET_URL: `/editor/presentation-editor-v0.18.2.html`
- `scripts/validate-export-asset-parity.js` — EDITOR_URL updated to v0.18.2

### Documentation
- `docs/CHANGELOG.md` — added v0.18.2 entry
- `docs/PROJECT_SUMMARY.md` — version: `0.18.2`, added zoom description
- `docs/validation-notes-0.18.2.md` — created (full validation report)
- `docs/remaining-issues-after-0.18.2.md` — created (post-release status)
- `docs/REMAINING_ISSUES.md` — updated pointer to 0.18.2
- `docs/SOURCE_OF_TRUTH.md` — added zoom UX rules
- `docs/TESTING_STRATEGY.md` — added zoom to signed-off capabilities
- `README.md` — version: `0.18.2`, added zoom to "What is working"

### Agents and skills
- `.github/agents/html-presentation-editor-implementer.agent.md` — runtime: `v0.18.2`
- `.github/agents/html-presentation-editor-test-qa.agent.md` — updated report reference
- `.github/skills/html-presentation-editor/SKILL.md` — runtime: `v0.18.2`

### Tests
- `tests/playwright/specs/shell.smoke.spec.js` — added zoom test

## Git artifacts

**Commit**: `0ad072c`  
```
feat(preview): add zoom control for preview/edit panel (v0.18.2)
```

**Tag**: `v0.18.2`

**Branch**: `main`

**Remote**: Pushed to `origin/main` and tag pushed to `origin/v0.18.2`

## Deployment notes

**Breaking changes**: None  
**Migration required**: None  
**Backwards compatibility**: 100% (localStorage key is new, no conflicts)  

**Production readiness**: ✅ Approved

- All gates green
- Zero regressions
- Export integrity validated
- Feature fully tested
- Documentation complete

## Sign-off

**Release engineer**: Copilot-assisted validation (HTML Presentation Editor Test QA agent)  
**Release date**: 2026-04-03  
**Status**: ✅ **SHIPPED**

---

**Next release target**: `v0.19.0` (smart layer resolution / magic select)
