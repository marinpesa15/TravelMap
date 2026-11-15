# TravelMap

iOS app (Capacitor 8, WKWebView) with a vanilla JS frontend, MapLibre + bundled PMTiles basemap, Firebase Auth + Firestore. No bundler: every JS/CSS import carries a `?v=` version that must be bumped when the file changes. `travel.marinpesa.dev` is only the static landing page (`landing/`), the web app itself ships inside the App Store bundle.

## Rules

- Use the `ponytail` skill (`.claude/skills/ponytail/`) on every coding task here: smallest complete change, no speculative abstractions.
- iOS first: before adding a dependency or writing custom code, check whether iOS or WKWebView already does it (file input for photo picker and camera, MediaRecorder, share sheet, local notifications, CoreLocation, system fonts and sheets). Then an official Capacitor plugin. A third-party package only when neither covers it.
- UI text exists in German and English (`js/i18n.js`). German uses "du". No em or en dashes in UI or website copy.
- Tests: `npm test` (vitest), Firestore rules: `npm run test:rules`. Pure logic lives in `*-logic.js` files so it can be tested without DOM.
- Design docs and plans live in `docs/superpowers/specs` and `docs/superpowers/plans`.
- Release: bump `APP_VERSION` in `js/version.js` with `MARKETING_VERSION` in Xcode. Update `landing/app-version.json` only once the build is live in the App Store.

## Stories, Storage and Functions (2.0)

- Stories hang on a visited or lived-in city of the own account, keyed by the city name (`city.name`). A story has a date, text (max 2000 characters), up to 10 photos (JPEG, max 1600 px, 1 MB), one voice note (`audio/mp4`, max 120 s, 3 MB) and a Spotify song. Each story is shared per story with friends via its "visible to friends" flag.
- Photos, voice notes and the profile picture (512 px) live in Firebase Storage (`storage.rules`). Never call `getDownloadURL` for story media: they have no shareable links and are only read by the signed-in app. The owner always has access, a friend only while the story is shared.
- Deleting a story, removing a city (after confirmation) or deleting the account also deletes the files.
- Song search is the callable `searchSongs` in `functions/` (region europe-west1), which queries Spotify with the app's own client credentials (Functions secrets `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`). The app never talks to the Spotify API itself. Song covers load directly from Spotify's image servers, the Spotify embed player only after a tap. The privacy policy states this, change both together.
- Story media are downloaded with `getBlob`, which needs CORS on the bucket for the app's origin `capacitor://localhost`. The setting lives in `storage-cors.json` and is applied with `gcloud storage buckets update gs://travelmap-f4e3a.firebasestorage.app --cors-file=storage-cors.json`. Without it photos and voice notes upload but never load.
- The Storage rules look up friendships and the story's `shared` flag in Firestore. For that the Storage service agent (`service-<project number>@gcp-sa-firebasestorage.iam.gserviceaccount.com`) needs the role `roles/firebaserules.firestoreServiceAgent`. A non-interactive `firebase deploy` does not grant it; without it the owner sees the media but friends get "not available".
- Adding a friend stores the invite code used in the friend entry (`firestore.rules` checks it).
- `npm run test:rules` covers Firestore and Storage rules in the emulators.

### Release order for 2.0

Deploy `firestore.rules`, `storage.rules` and the function only together with the forced 2.0 update: the new friends rule requires the invite token that 1.x clients do not send, so deployed earlier it would break adding friends in 1.x. Order, each step confirmed by Marin: rules and function, App Store submission, then (once 2.0 is live) `landing/app-version.json` with `latest` and `minimum` set to `2.0.0`, then `firebase deploy --only hosting`.
