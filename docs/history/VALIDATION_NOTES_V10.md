# Presentation Editor v10 — validation notes

## Completed checks
- extracted main `<script>` and ran `node --check` on it;
- parsed HTML structure and confirmed no duplicate shell `id` values;
- verified expected v10 contract points in source:
  - pending requested slide takes precedence in `applyRuntimeMetadata()`;
  - generic slide activation fallback exists in bridge;
  - `goToSlide()` prefers runtime slide order over stale copied `data-slide`;
  - slide-order metadata sync is applied on insert / duplicate / delete / move;
  - runtime slide title reader now honors slide-root `data-slide-title`.

## What I specifically validated for the reported bug
- the shell path for slide selection is now centralized through `requestSlideActivation()`;
- new and duplicated slides trigger preview rebuild with the requested slide preserved;
- copied slide-order attributes are normalized before rebuild, so generic `goToSlide(n)` decks no longer receive a stale old index by default.

## Not fully signed off here
- I did not complete a true end-to-end browser sign-off on real widths / themes / pointer input inside this container.
- The remaining full QA sweep should still be run on:
  - 390
  - 640
  - 820
  - 1100
  - 1280
  - 1440+

## Residual risk
- highly custom decks with nonstandard navigation contracts can still require a deck-specific adapter;
- direct manipulation QA on transformed/nested layouts is still a separate remaining track.
