# Vendored: pptxgenjs

## Version

`3.12.0`

## Upstream source

- npm: https://www.npmjs.com/package/pptxgenjs/v/3.12.0
- jsDelivr: https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js
- GitHub: https://github.com/gitbrent/PptxGenJS/releases/tag/v3.12.0

## File

`pptxgen.bundled.min.js` — UMD bundle (JSZip + pptxgenjs), exposes `window.PptxGenJS`.
Downloaded verbatim from jsDelivr, renamed to reflect it is our pinned vendor copy.

Size: 477,529 bytes (466 KB)

## SRI hash (sha384)

```
sha384-Cck14aA9cifjYolcnjebXRfWGkz5ltHMBiG4px/j8GS+xQcb7OhNQWZYyWjQ+UwQ
```

Used in `editor/src/export.js` as `PPTX_SRI` for the CDN fallback path
(`PPTX_USE_VENDOR = false`). The vendor path itself does not require an
integrity attribute because the file is served from the same origin (or
file://).

## Why vendored

AUDIT-D-03 (Medium — OWASP A08:2021 Software and Data Integrity Failures):
the prior CDN load of pptxgenjs used an unpinned URL with no SRI hash,
meaning a compromised CDN release could execute arbitrary code in the
editor's origin. Vendoring eliminates this supply-chain vector for the
default path and ensures the editor works fully offline / under file://.

## Upgrade procedure

1. Pick the new version (e.g. `4.x.y`). Check the changelog at
   https://github.com/gitbrent/PptxGenJS/blob/master/CHANGELOG.md
   for any breaking API changes to `PptxGenJS` constructor / `addSlide` /
   `addText` / `addImage` used in `editor/src/export.js`.

2. Download the new bundle:
   ```
   curl -L "https://cdn.jsdelivr.net/npm/pptxgenjs@<NEW_VERSION>/dist/pptxgen.bundle.js" \
     -o editor/vendor/pptxgenjs/pptxgen.bundled.min.js
   ```

3. Recompute the SRI hash:
   ```
   node -e "const c=require('crypto'),fs=require('fs'); \
     console.log('sha384-'+c.createHash('sha384').update( \
       fs.readFileSync('editor/vendor/pptxgenjs/pptxgen.bundled.min.js') \
     ).digest('base64'))"
   ```

4. Update `PPTX_SRI` and `PPTX_CDN_URL` in `editor/src/export.js`.

5. Update this README (version, size, SRI hash).

6. Run `PLAYWRIGHT_TEST_SERVER_PORT=41735 npm run test:gate-a` — must be 55/5/0.

7. Run the export-sri spec:
   ```
   PLAYWRIGHT_TEST_SERVER_PORT=41735 npx playwright test \
     tests/playwright/specs/export-sri.spec.js --project=chromium-desktop
   ```

## License

MIT — see `LICENSE` in this directory.
