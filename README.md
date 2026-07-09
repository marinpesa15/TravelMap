# TravelMap 🗺️

A personal travel tracking web app built with vanilla JS, Mapbox GL JS, and Firebase.

**Live:** https://travelmap-f4e3a.web.app

---

## Features

- **Track visited cities** — search any city worldwide and mark it as visited
- **Wishlist** — save cities and countries you want to visit
- **Lived there** — mark cities where you've lived (shown in amber)
- **Countries mode** — track whole countries with GeoJSON map fills
- **Auto country tracking** — visiting a city automatically tracks its country
- **Friends** — add friends via invite link, view their maps (read-only)
- **Groups** — shared maps: create groups, add members, pin cities together
  with personalised avatar/photo pins
- **Collection filter** — All / Visited / Want to visit / Lived there
- **Settings** — gear button opens a modal with theme, language, privacy links,
  sign-out and app version
- **Dark / Light theme** — persists across sessions
- **Bilingual** — full English / German UI, switchable live in settings
- **GDPR consent** — blocking consent banner before any data is stored,
  privacy policy + imprint page (`privacy.html`)
- **Mobile responsive** — slide-in sidebar drawer on small screens
- **Real-time** — Firestore listeners everywhere, no manual refresh
- **Google Sign-In** — auth via Firebase Authentication

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla JS (ES modules), no build step |
| Map | Mapbox GL JS v3.4.0 |
| Auth | Firebase Authentication (Google) |
| Database | Firestore |
| Hosting | Firebase Hosting |

## Project Structure

```
TravelMap/
├── index.html          # Login page
├── map.html            # Main app
├── privacy.html        # Privacy policy + imprint (DE/EN)
├── css/
│   └── style.css       # CSS custom properties (dark/light theming)
├── js/
│   ├── app.js          # Entry point, wires everything together
│   ├── auth.js         # Firebase auth helpers
│   ├── db.js           # Firestore read/write (user data, groups, consent)
│   ├── friends.js      # Friendships (invite links)
│   ├── groups.js       # Group CRUD + membership
│   ├── countries.js    # Countries mode (GeoJSON fills, search)
│   ├── map.js          # Mapbox map init
│   ├── markers.js      # City marker rendering
│   ├── ui.js           # Stats, search, dialogs, toasts, sidebar lists
│   ├── i18n.js         # EN/DE translations, t(), data-i18n
│   ├── settings.js     # Settings modal (theme, language, sign-out)
│   ├── consent.js      # GDPR consent banner + version
│   ├── theme.js        # Dark/light theme API
│   ├── version.js      # APP_VERSION
│   ├── config.js       # Firebase config (gitignored)
│   └── constants.js    # Mapbox token (gitignored)
├── firestore.rules     # Locked-down security rules
└── firebase.json       # Hosting config (no-cache headers)
```

## Setup

1. Clone the repo
2. Create `js/config.js` with your Firebase config (see `js/config.example.js`)
3. Create `js/constants.js` with your Mapbox token (see `js/constants.example.js`)
4. Fill in your name/address/email in `privacy.html` (search for `[DEIN`)
5. `firebase use <your-project>` and `firebase deploy`

## Marker Colors

| Color | Meaning |
|-------|---------|
| 🟣 Indigo | Visited |
| 🟡 Amber | Lived there |
| 🟢 Emerald | Wishlist |

## Releases

Bump `APP_VERSION` in `js/version.js` (shown in the settings modal).
Bump `CONSENT_VERSION` in `js/consent.js` only when the privacy policy
changes materially — every user will be asked for consent again.
