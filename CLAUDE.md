# TravelMap

iOS app (Capacitor 8, WKWebView) with a vanilla JS frontend, MapLibre + bundled PMTiles basemap, Firebase Auth + Firestore. No bundler: every JS/CSS import carries a `?v=` version that must be bumped when the file changes. `travel.marinpesa.dev` is only the static landing page (`landing/`), the web app itself ships inside the App Store bundle.

## Rules

- Use the `ponytail` skill (`.claude/skills/ponytail/`) on every coding task here: smallest complete change, no speculative abstractions.
- iOS first: before adding a dependency or writing custom code, check whether iOS or WKWebView already does it (file input for photo picker and camera, MediaRecorder, share sheet, local notifications, CoreLocation, system fonts and sheets). Then an official Capacitor plugin. A third-party package only when neither covers it.
- UI text exists in German and English (`js/i18n.js`). German uses "du". No em or en dashes in UI or website copy.
- Tests: `npm test` (vitest), Firestore rules: `npm run test:rules`. Pure logic lives in `*-logic.js` files so it can be tested without DOM.
- Design docs and plans live in `docs/superpowers/specs` and `docs/superpowers/plans`.
- Release: bump `APP_VERSION` in `js/version.js` with `MARKETING_VERSION` in Xcode. Update `landing/app-version.json` only once the build is live in the App Store.
