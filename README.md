# TravelMap 🗺️

A personal travel tracking web app built with vanilla JS, Mapbox GL JS, and Firebase.

**Live:** https://travelmap-f4e3a.web.app

---

## Features

- **Track visited cities** — search any city worldwide and mark it as visited
- **Wishlist** — save cities you want to visit
- **Lived there** — mark cities where you've lived (shown in amber)
- **Auto country tracking** — visiting a city automatically tracks its country
- **Collection filter** — All / Visited / Want to visit / Lived there
- **Dark / Light theme** — toggle with ☀️/🌙, persists across sessions
- **Mobile responsive** — slide-in sidebar drawer on small screens
- **Recent Logs** — last 3 visited cities shown in sidebar
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
├── css/
│   └── style.css       # CSS custom properties (dark/light theming)
├── js/
│   ├── app.js          # Entry point, wires everything together
│   ├── auth.js         # Firebase auth helpers
│   ├── db.js           # Firestore read/write
│   ├── map.js          # Mapbox map init
│   ├── markers.js      # City marker rendering
│   ├── ui.js           # Stats, search, dialogs, toasts
│   ├── theme.js        # Dark/light theme toggle
│   ├── config.js       # Firebase config (gitignored)
│   └── constants.js    # Mapbox token (gitignored)
└── firebase.json       # Hosting config (no-cache headers)
```

## Setup

1. Clone the repo
2. Create `js/config.js` with your Firebase config
3. Create `js/constants.js` with your Mapbox token
4. `firebase use <your-project>` and `firebase deploy`

## Marker Colors

| Color | Meaning |
|-------|---------|
| 🟣 Indigo | Visited |
| 🟡 Amber | Lived there |
| 🟢 Emerald | Wishlist |
