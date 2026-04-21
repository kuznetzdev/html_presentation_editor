# Integration Notes — WO-23 banners.js Scaffold API

**Version:** v0.29.5
**Date:** 2026-04-21
**Status:** Scaffold — production migration deferred to post-v1.0

---

## Overview

`editor/src/banners.js` introduces a unified banner registry for shell-level banners.
This file documents the public API for future consumers.

---

## banners.js Public API

### `registerBanner(id, spec)`

Register a banner under a string `id`.

```js
registerBanner('my-banner', {
  render(payload) {
    // Show the banner DOM. payload is whatever showBanner() passes.
  },
  hide() {
    // Optional. Called by hideBanner(). Use to clean up DOM.
  },
  description: 'Human-readable label (optional, for debugging)',
});
```

**Throws** if `spec.render` is not a function.

---

### `showBanner(id, payload)`

Show a registered banner with optional payload.

- Calls `spec.render(payload)`.
- Updates `window.store.ui.activeBanners` — replaces any existing entry for `id` (no duplicates).
- If `id` is not registered: calls `reportShellWarning(...)` if available. Does NOT throw.

```js
showBanner('my-banner', { message: 'Something happened' });
```

---

### `hideBanner(id)`

Hide a banner and remove it from the active list.

- Calls `spec.hide()` if defined.
- Updates `window.store.ui.activeBanners` by filtering out the entry for `id`.

```js
hideBanner('my-banner');
```

---

### `getActiveBanners()`

Returns a shallow copy of the current `activeBanners` array.

```js
const active = getActiveBanners();
// → [{ id: 'trust', payload: {...} }, ...]
```

---

## Store Integration

`window.store.ui.activeBanners` is initialized as `[]` in `state.js` via:

```js
window.store.defineSlice('ui', {
  // ...
  activeBanners: [],
});
```

Consumers can subscribe to banner list changes:

```js
window.store.subscribe('ui', (next, prev) => {
  if (next.activeBanners !== prev.activeBanners) {
    // activeBanners changed
  }
});
```

---

## Load Order

```
context-menu.js
  → inspector-sync.js
    → shell-overlays.js
      → surface-manager.js   ← needs closeContextMenu etc.
        → banners.js         ← needs window.store.get + reportShellWarning
          → theme.js
            → ...
```

---

## Existing Banners (NOT migrated — deferred to post-v1.0)

These banners remain in their current locations:

| Banner | Current location | Migration status |
|---|---|---|
| Trust banner (WO-07) | `shellBoundary` / `feedback.js` | Already wired via separate mechanism (v0.27.3). Path (b) taken in WO-23. |
| Inspector banners (lock, help, etc.) | `inspector-sync.js` | Stay in inspector-sync.js for v1.0 |
| Broken asset banner | `feedback.js` | Deferred |
| Version mismatch banner | `feedback.js` | Deferred |

---

## PAIN-MAP Reference

- **P2-09** — "Surface mutex and banner management spread across feedback.js" — **CLOSED** by WO-23.
- **P1-09** — "Banners need a unified registry for testability" — **Partial** — scaffold created, full migration deferred post-v1.0.
