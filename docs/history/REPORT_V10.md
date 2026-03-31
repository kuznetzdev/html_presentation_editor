# Presentation Editor v10 — slide activation hardening + slide model cleanup

## Context recovered
Этот проход продолжает зафиксированный Stage B из handoff: после shell hardening добиваем slide model v2 и убираем реальные UX/deck dead ends, не ломая `iframe + bridge + modelDoc` и чистый HTML-export.

## Goal of this pass
Закрыть критический баг со вставкой/открытием нового слайда, усилить slide-level navigation contract для generic/custom decks и сделать slide-path чище как отдельную подсистему, а не набор разрозненных override-фиксов.

## What was closed now

### 1. New slide activation is no longer lost between shell and iframe
Changed:
- `applyRuntimeMetadata()` now gives priority to `pendingActiveSlideId` when the requested slide already exists in runtime metadata.
- `requestSlideActivation()` introduced a single shell path for slide navigation instead of scattered direct `navigate-to-slide` calls.
- active slide item now auto-scrolls into view in the slide list.

What this fixes:
- after creating or duplicating a slide, shell no longer snaps back to the old runtime-active slide before navigation finishes;
- clicking a slide in the list uses the same first-class activation flow as insertion/duplication.

### 2. Generic deck navigation became safer and more deterministic
Added inside bridge:
- `detectGenericSlideActivationProfile()`
- `applyGenericSlideActivation()`

Changed:
- `navigateToSlide()` now refreshes slide collection before navigation;
- `goToSlide()` now prefers runtime slide order (`fallbackIndex + 1`) over possibly stale copied `data-slide` values;
- `changeSlide()` now steps through larger deltas instead of moving only one slide;
- when there is no reveal/shower-specific engine API, bridge can now toggle existing `active/current/present/past/future/next/previous` markers and `aria-current` / `hidden` / `aria-hidden` if the deck already uses them.

What this fixes:
- custom decks that show one active slide at a time no longer stay visually stuck on the old slide after new-slide insertion;
- generic click navigation is more likely to keep preview and slide list aligned.

### 3. Slide model now normalizes copied order metadata instead of inheriting stale values
Added:
- `STATIC_SLIDE_ORDER_ATTRS`
- `TRANSIENT_SLIDE_RUNTIME_ATTRS`
- `readNumericSlideAttributeValue()`
- `detectStaticSlideOrderBase()`
- `stripInheritedSlideRuntimeAttrs()`
- `syncStaticSlideOrderingMetadata()`

Changed:
- inserted, duplicated, moved and deleted slides now resync common order attributes like `data-slide`, `data-slide-index`, `data-seq`, `data-index` when the source deck already uses a numeric ordering convention;
- new slides no longer keep copied runtime index markers from the source slide.

What this fixes:
- deck-local navigation helpers that depend on sequential slide indices stop reopening the wrong slide after insertion/duplication.

### 4. Slide title override is now surfaced correctly in runtime metadata
Fixed:
- bridge `getSlideTitle()` now checks `data-slide-title` on the slide root before falling back to headings/text content.

What this fixes:
- slide title override from inspector becomes a real first-class list title instead of silently disappearing behind extracted heading text.

### 5. Slide creation path is cleaner and less leaky
Changed:
- new template-created slides reset inherited slide-only metadata like copied runtime order attrs and stale title/preset padding markers before applying the chosen preset;
- duplicated slides keep slide content but get fresh node ids and can receive a copy-suffixed slide title override when one already existed.

## Structural impact
This pass deliberately grouped slide concerns into one clearer subsystem instead of adding more one-off patches:

- slide activation request path
- generic runtime slide activation fallback
- static slide ordering metadata normalization
- slide title/runtime metadata alignment

That reduces the risk of slipping back into “old layer -> override -> another override”.
