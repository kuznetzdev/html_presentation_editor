# Remaining Issues After v0.18.2

## Status

`v0.18.2` shipped preview zoom control with zero regressions. All gates green (157/157 tests passed).

## Known limitations (not blocking)

### 1. Zoom UX polish opportunities

**Current behavior**: Zoom controls are always visible in preview/edit panel header.

**Potential improvements**:
- Hide zoom controls in preview mode, show only in edit mode (since direct manipulation is blocked anyway during preview)
- Add visual feedback when direct manipulation is attempted at non-100% zoom (currently shows tooltip, could add transient banner)
- Consider auto-reset to 100% when switching from edit to preview (or persist across mode changes)

**Priority**: Low — current behavior is correct and usable, polish can wait for broader UX review

### 2. Zoom + floating toolbar interaction

**Current behavior**: Floating toolbar position is correctly recalculated when zoom changes via `positionFloatingToolbar()` multiplying activeRect by zoom factor.

**Edge case**: If user zooms in significantly (e.g., 200%), floating toolbar may be positioned outside visible viewport if selected element rect is large.

**Mitigation**: `clampToolbarPosition()` already handles viewport bounds clamping.

**Priority**: Very Low — works correctly in normal scenarios, extreme zoom edge cases are rare

### 3. Selection overlay rendering at extreme zoom levels

**Current behavior**: Selection overlay (selection-frame, selection-handles) scale correctly with zoom via coordinate transform fixes in `toStageRect()`.

**Potential issue**: At very low zoom (25%), selection handles may become visually tiny and harder to see/grab.

**Priority**: Low — 25% zoom is an outlier use case, typically users zoom in (not out) for detailed editing

### 4. Zoom persistence across different HTML files

**Current behavior**: Zoom level persists in localStorage globally for all decks.

**Potential improvement**: Scope zoom level per-deck (using deck hash or filename as key).

**Trade-off**: Global zoom is simpler and may match user intent (e.g., "I prefer 125% zoom on my high-DPI monitor for all decks").

**Priority**: Very Low — current global persistence is a reasonable default

### 5. Mobile/tablet zoom behavior

**Current behavior**: Zoom controls render on mobile widths but may compete with pinch-to-zoom gestures.

**Consideration**: On mobile, browser-native pinch-to-zoom might conflict with editor zoom controls.

**Mitigation**: Could hide zoom controls on compact shell widths (`data-shell-layout="compact"`) or add `touch-action: none` on preview stage.

**Priority**: Low — not tested on physical mobile devices yet, may be fine as-is

## Not issues (working as designed)

### Direct manipulation blocked at zoom ≠ 100%
This is **intentional** to maintain coordinate precision. Inspector controls remain fully functional at all zoom levels.

### Zoom step granularity
The 12 fixed zoom steps (25%, 33%, 50%, ..., 200%) provide good coverage without overwhelming users. Step-based zoom is better UX than continuous zoom for presentation editing.

### Reset button visibility
The `1:1` reset button appearing only when zoomed ≠ 100% is correct — it reduces visual noise when reset is not needed.

## Roadmap impact

Zoom feature does **not** change the v0.19.0 roadmap priorities:
1. Smart layer resolution / magic select
2. Internal zoning (responsibility-based cleanup)
3. System polish

Zoom is a **shell control**, not a selection/layer feature, so it integrates cleanly without affecting upcoming work on layer ergonomics or selection intelligence.

## Next validation priorities (post-0.18.2)

1. **Cross-browser zoom testing** (Gate C: Firefox, WebKit)
   - Current validation only ran on Chromium (chromium-desktop, chromium-shell-1100)
   - Should verify zoom controls work identically on Firefox and Safari

2. **Compact shell zoom rendering** (Gate D: mobile-390, mobile-640, tablet-820)
   - Validate zoom controls don't overflow on narrow viewports
   - Test whether zoom UI should be hidden on compact shell

3. **Visual regression snapshots** (Gate F)
   - Add visual snapshots of zoom controls at various zoom levels
   - Capture light/dark theme parity for zoom UI

4. **Performance profiling**
   - Measure renderSelectionOverlay() + positionFloatingToolbar() performance at extreme zoom levels
   - Ensure no layout thrashing during zoom changes

## Conclusion

**v0.18.2 is stable and complete.** The remaining items above are **polish opportunities** and **future validation scope expansion**, not bugs or blockers.

No critical issues found. No urgent follow-up work required.
