# Known Limitations

## Current pilot limits

- Trusted HTML only: the editor renders uploaded HTML in a truthful iframe preview.
  Do not use untrusted third-party decks in the pilot.
- Autosave is tab-scoped: draft recovery stays in the current browser session and
  is not a collaboration or cloud-save feature.
- Export is required for sharing: the editor state itself is not a sharable artifact.
- No multi-user collaboration: there is no shared workspace, locking, or live sync.
- Desktop-first target: the pilot is optimized for desktop usage. Compact layouts are
  covered, but they are not the primary authoring surface.
- Asset-folder import is strongest in Chromium-based browsers because folder picking
  relies on browser-specific capabilities.
- Long-running reliability is validated by regression tests, not by long-session
  production telemetry yet.
