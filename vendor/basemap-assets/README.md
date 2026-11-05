# Basemap assets

Fonts and sprites for the bundled map style (`vendor/protomaps-basemaps`),
taken from https://github.com/protomaps/basemaps-assets.

* `fonts/`: PBF glyphs for Noto Sans Regular, Medium and Italic, SIL Open
  Font License (see `fonts/OFL.txt`). The directories carry the font names
  without spaces (`NotoSansRegular`); `js/map.js` rewrites the style's
  `text-font` values to match, so no path needs percent-encoding.
* `sprites/`: light and dark spritesheets (1x and 2x), derived from the
  MIT-licensed tangrams/icons.

The map data itself lives in `data/basemap.pmtiles` (Natural Earth, public
domain, built by `scripts/build-basemap-ne.mjs`).
