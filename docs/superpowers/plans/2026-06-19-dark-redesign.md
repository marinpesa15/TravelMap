# TravelMap Dark Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current light floating-panel UI with the SuperDesign "TravelMap Reimagined" dark design — a left sidebar layout with glassmorphism overlays, pulse city markers, and a dark Mapbox map.

**Architecture:**
- `map.html`: completely restructured to a flex-row (sidebar + map) layout
- `css/style.css`: full dark theme rewrite; auth screen untouched
- `js/markers.js`: new pulse-dot markers (indigo / emerald / amber) replacing emoji + coloured circles
- `js/ui.js`: updated element IDs, new `updateSidebarCounts()` and `updateRecentLogs()` helpers
- `js/map.js`: swap map style to `dark-v11`
- `js/app.js`: wire new sidebar elements and pass Firebase `user` to `showUserProfile()`

**Tech Stack:** Vanilla JS ES modules, Mapbox GL JS v3.4.0, Firebase Auth + Firestore, custom CSS (no frameworks)

---

### Task 1: New `map.html` — sidebar layout

**Files:**
- Modify: `map.html`

The entire `<body>` is restructured. Keep all existing overlay elements (`#country-tooltip`, `#city-dialog`, `#city-popup`, `#toast`) — only the main scaffold and panel change.

- [ ] **Step 1: Replace body content in `map.html`**

Replace everything between `<body>` and `</body>` with:

```html
<body>
  <div class="app-shell">

    <!-- ═══ LEFT SIDEBAR ═══ -->
    <aside id="sidebar">

      <!-- Brand header -->
      <div class="sidebar-header">
        <div class="brand-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
            <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
          </svg>
        </div>
        <h1 class="brand-name">TravelMap</h1>
      </div>

      <!-- Snapshot stats grid -->
      <div class="sidebar-section">
        <p class="section-label">Snapshot</p>
        <div class="stats-grid">
          <div class="stat-card">
            <p class="stat-label">Countries</p>
            <p class="stat-num" id="stat-countries-num">0</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Cities</p>
            <p class="stat-num" id="stat-cities-num">0</p>
          </div>
        </div>
      </div>

      <!-- Collection nav -->
      <div class="sidebar-section">
        <p class="section-label">Collection</p>
        <nav class="collection-nav">
          <a href="#" class="nav-item active" data-filter="visited" id="nav-visited">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <span class="nav-label">Visited</span>
            <span class="nav-badge" id="nav-visited-count">0</span>
          </a>
          <a href="#" class="nav-item" data-filter="wishlist" id="nav-wishlist">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            <span class="nav-label">Want to visit</span>
            <span class="nav-badge" id="nav-wishlist-count">0</span>
          </a>
          <a href="#" class="nav-item" data-filter="lived" id="nav-lived">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span class="nav-label">Lived there</span>
            <span class="nav-badge" id="nav-lived-count">0</span>
          </a>
        </nav>
      </div>

      <!-- Recent Logs -->
      <div class="sidebar-section" id="recent-logs-section">
        <p class="section-label">Recent Logs</p>
        <div id="recent-logs" class="recent-logs"></div>
      </div>

      <!-- Spacer -->
      <div style="flex:1"></div>

      <!-- Add location button -->
      <div class="sidebar-footer">
        <button class="btn-add-location" id="btn-add-location">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add New Location
        </button>
        <button class="btn-signout" id="btn-signout">Sign out</button>
      </div>

    </aside>

    <!-- ═══ MAP AREA ═══ -->
    <main class="map-area">
      <div id="map"></div>

      <!-- Top-right: search + user -->
      <div class="top-right-bar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="city-search" placeholder="Search cities..." autocomplete="off">
          <div id="search-results"></div>
        </div>
        <div class="user-pill" id="user-pill">
          <img id="user-avatar" src="" alt="Avatar" class="user-avatar">
          <span id="user-name" class="user-name">...</span>
        </div>
      </div>

      <!-- Bottom-left: legend -->
      <div class="map-legend">
        <div class="legend-item"><span class="legend-dot indigo"></span><span>Visited</span></div>
        <div class="legend-item"><span class="legend-dot amber"></span><span>Lived</span></div>
        <div class="legend-item"><span class="legend-dot emerald"></span><span>Wishlist</span></div>
      </div>
    </main>

  </div><!-- .app-shell -->

  <!-- ═══ OVERLAYS (unchanged logic) ═══ -->

  <!-- Country Tooltip -->
  <div id="country-tooltip">
    <button id="tooltip-close">✕</button>
    <h3 id="tooltip-country-name">Deutschland</h3>
    <button class="tooltip-btn visited"  id="tooltip-visited">✓ Besucht</button>
    <button class="tooltip-btn wishlist" id="tooltip-wishlist">⭐ Wunschliste</button>
    <button class="tooltip-btn remove"   id="tooltip-remove">✕ Entfernen</button>
  </div>

  <!-- City Add Dialog -->
  <div id="city-dialog">
    <div class="dialog-card">
      <h3 id="dialog-city-name">München</h3>
      <div class="dialog-label">Typ</div>
      <div class="radio-group">
        <div class="radio-opt selected" data-type="visited">✓ Besucht</div>
        <div class="radio-opt"          data-type="wishlist">⭐ Wunschliste</div>
      </div>
      <div class="color-section" id="color-section">
        <div class="dialog-label">Pin-Farbe</div>
        <div class="color-group">
          <div class="color-opt red selected" data-color="red">🔴 Rot</div>
          <div class="color-opt yellow"        data-color="yellow">🟡 Gelb</div>
        </div>
      </div>
      <label class="checkbox-row" id="lived-row">
        <input type="checkbox" id="lived-checkbox">
        🏠 Dort gewohnt
      </label>
      <div class="dialog-actions">
        <button class="btn-cancel" id="dialog-cancel">Abbrechen</button>
        <button class="btn-add"    id="dialog-add">Hinzufügen</button>
      </div>
    </div>
  </div>

  <!-- City Remove Popup -->
  <div id="city-popup">
    <button id="city-popup-close">✕</button>
    <p id="city-popup-name">München</p>
    <button class="btn-remove-city" id="btn-remove-city">🗑️ Entfernen</button>
  </div>

  <!-- Toast -->
  <div id="toast"></div>

  <script type="module" src="js/app.js?v=3"></script>
</body>
```

- [ ] **Step 2: Verify all previous element IDs still present**

These IDs are used by existing JS — confirm they are in the new HTML:
- `#city-search`, `#search-results` ✓ (in `.top-right-bar`)
- `#btn-signout` ✓ (in `.sidebar-footer`)
- `#country-tooltip`, `#tooltip-close`, `#tooltip-country-name`, `#tooltip-visited`, `#tooltip-wishlist`, `#tooltip-remove` ✓
- `#city-dialog`, `#dialog-city-name`, `#dialog-cancel`, `#dialog-add` ✓
- `#color-section`, `#lived-row`, `#lived-checkbox` ✓
- `#city-popup`, `#city-popup-close`, `#city-popup-name`, `#btn-remove-city` ✓
- `#toast` ✓

New IDs for JS updates:
- `#stat-countries-num`, `#stat-cities-num`
- `#nav-visited-count`, `#nav-wishlist-count`, `#nav-lived-count`
- `#recent-logs`, `#btn-add-location`
- `#user-avatar`, `#user-name`, `#user-pill`

- [ ] **Step 3: Update CSS link version tag**

Change `css/style.css?v=2` → `css/style.css?v=3` to bust cache.

---

### Task 2: Full CSS rewrite — dark theme

**Files:**
- Modify: `css/style.css`

Keep the auth screen section (`.auth-screen`, `.auth-card`, `.btn-google`, `.auth-error`) exactly as-is. Replace everything else.

- [ ] **Step 1: Replace all non-auth CSS with dark theme**

After the auth section (after line 48), replace the entire rest of `style.css` with:

```css
/* ===== Map Shell ===== */
.app-shell {
  display: flex;
  height: 100vh;
  width: 100%;
  min-width: 960px;
  overflow: hidden;
  background: #080b11;
}
.map-area { position: relative; flex: 1; overflow: hidden; }
#map { position: absolute; inset: 0; }

/* ===== Sidebar ===== */
#sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: rgba(13,17,23,0.85);
  backdrop-filter: blur(14px);
  border-right: 1px solid rgba(255,255,255,0.07);
  z-index: 20;
  overflow-y: auto;
}
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.brand-icon {
  width: 36px; height: 36px;
  background: #6366f1;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 0 16px rgba(99,102,241,0.4);
}
.brand-name {
  font-size: 1.05rem;
  font-weight: 700;
  color: white;
  letter-spacing: -0.02em;
}
.sidebar-section { padding: 20px 16px 0; }
.section-label {
  font-size: 0.68rem;
  font-weight: 600;
  color: #4b5563;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 10px;
}

/* ===== Snapshot grid ===== */
.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
.stat-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 14px;
  padding: 14px;
  transition: background 0.2s;
}
.stat-card:hover { background: rgba(255,255,255,0.07); }
.stat-label { font-size: 0.72rem; color: #6b7280; margin-bottom: 4px; }
.stat-num { font-size: 1.6rem; font-weight: 700; color: white; line-height: 1; }

/* ===== Collection nav ===== */
.collection-nav { display: flex; flex-direction: column; gap: 4px; margin-bottom: 20px; }
.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: #6b7280;
  font-size: 0.84rem;
  font-weight: 500;
  transition: all 0.18s;
}
.nav-item:hover { background: rgba(255,255,255,0.05); color: white; }
.nav-item.active {
  background: rgba(99,102,241,0.12);
  color: #818cf8;
  border: 1px solid rgba(99,102,241,0.2);
}
.nav-icon { width: 16px; height: 16px; flex-shrink: 0; }
.nav-label { flex: 1; }
.nav-badge {
  font-size: 0.7rem;
  background: rgba(255,255,255,0.08);
  color: #9ca3af;
  padding: 2px 8px;
  border-radius: 99px;
}
.nav-item.active .nav-badge { background: rgba(99,102,241,0.2); color: #818cf8; }

/* ===== Recent Logs ===== */
.recent-logs { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
.recent-log-item { display: flex; align-items: flex-start; gap: 10px; }
.recent-log-icon {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: rgba(99,102,241,0.1);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
}
.recent-log-city { font-size: 0.82rem; font-weight: 600; color: white; }
.recent-log-time { font-size: 0.72rem; color: #4b5563; margin-top: 1px; }

/* ===== Sidebar footer ===== */
.sidebar-footer {
  padding: 16px;
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.btn-add-location {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px;
  background: white;
  color: #0f172a;
  font-size: 0.84rem;
  font-weight: 700;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
  font-family: inherit;
}
.btn-add-location:hover { background: #f1f5f9; }
.btn-signout {
  width: 100%;
  padding: 8px;
  font-size: 0.75rem;
  color: #4b5563;
  background: none;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.btn-signout:hover { color: #9ca3af; border-color: rgba(255,255,255,0.12); }

/* ===== Top-right bar ===== */
.top-right-bar {
  position: absolute;
  top: 16px; right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
}
.search-wrap {
  position: relative;
}
.search-icon {
  position: absolute;
  left: 13px; top: 50%;
  transform: translateY(-50%);
  width: 15px; height: 15px;
  color: #4b5563;
  pointer-events: none;
}
#city-search {
  width: 240px;
  padding: 10px 14px 10px 36px;
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  backdrop-filter: blur(16px);
  color: white;
  font-size: 0.84rem;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s;
}
#city-search::placeholder { color: #4b5563; }
#city-search:focus {
  border-color: rgba(99,102,241,0.5);
  box-shadow: 0 0 0 3px rgba(99,102,241,0.12);
}
#search-results {
  position: absolute;
  top: calc(100% + 6px);
  left: 0; right: 0;
  background: rgba(13,17,23,0.95);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  backdrop-filter: blur(16px);
  max-height: 220px;
  overflow-y: auto;
  z-index: 50;
}
.search-result-item {
  padding: 10px 14px;
  font-size: 0.82rem;
  color: #d1d5db;
  cursor: pointer;
  transition: background 0.12s;
}
.search-result-item:hover { background: rgba(255,255,255,0.06); }
.search-result-item:first-child { border-radius: 12px 12px 0 0; }
.search-result-item:last-child  { border-radius: 0 0 12px 12px; }
.search-result-item:only-child  { border-radius: 12px; }

.user-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px 6px 6px;
  background: rgba(0,0,0,0.55);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px;
  backdrop-filter: blur(16px);
}
.user-avatar {
  width: 28px; height: 28px;
  border-radius: 8px;
  background: rgba(99,102,241,0.2);
  object-fit: cover;
}
.user-name { font-size: 0.82rem; font-weight: 600; color: white; }

/* ===== Map Legend ===== */
.map-legend {
  position: absolute;
  bottom: 40px; left: 16px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 12px 20px;
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  backdrop-filter: blur(14px);
  z-index: 10;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: #9ca3af;
}
.legend-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.legend-dot.indigo  { background: #6366f1; }
.legend-dot.amber   { background: #f59e0b; }
.legend-dot.emerald { background: #10b981; }

/* ===== Pulse Marker (applied via JS to marker elements) ===== */
.marker-dot {
  width: 12px; height: 12px;
  border-radius: 50%;
  position: relative;
  cursor: pointer;
}
.marker-dot::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid currentColor;
  animation: marker-pulse 2s ease-out infinite;
}
@keyframes marker-pulse {
  0%   { transform: scale(1); opacity: 0.8; }
  100% { transform: scale(3); opacity: 0; }
}

/* ===== Country Tooltip ===== */
#country-tooltip {
  position: absolute;
  z-index: 20;
  background: rgba(13,17,23,0.95);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  min-width: 160px;
  display: none;
  backdrop-filter: blur(12px);
}
#country-tooltip h3 { font-size: 0.85rem; font-weight: 600; color: white; margin-bottom: 8px; }
.tooltip-btn {
  display: block; width: 100%;
  padding: 7px 10px; margin-bottom: 4px;
  font-size: 0.8rem; font-weight: 600;
  border: none; border-radius: 6px;
  cursor: pointer; text-align: left;
  font-family: inherit;
}
.tooltip-btn.visited  { background: rgba(16,185,129,0.15); color: #6ee7b7; }
.tooltip-btn.wishlist { background: rgba(245,158,11,0.15); color: #fcd34d; }
.tooltip-btn.remove   { background: rgba(255,255,255,0.06); color: #9ca3af; }
.tooltip-btn:hover    { filter: brightness(1.2); }
#tooltip-close {
  position: absolute; top: 8px; right: 10px;
  background: none; border: none;
  font-size: 1rem; color: #4b5563;
  cursor: pointer; line-height: 1;
}

/* ===== City Add Dialog ===== */
#city-dialog {
  position: fixed; inset: 0; z-index: 30;
  display: none; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
}
#city-dialog.open { display: flex; }
.dialog-card {
  background: #111827;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  padding: 24px;
  min-width: 280px; max-width: 340px;
  width: 90%;
  box-shadow: 0 16px 64px rgba(0,0,0,0.5);
}
.dialog-card h3 { font-size: 1rem; font-weight: 700; color: white; margin-bottom: 16px; }
.dialog-label   { font-size: 0.8rem; font-weight: 600; color: #4b5563; margin-bottom: 6px; }
.radio-group    { display: flex; gap: 8px; margin-bottom: 14px; }
.radio-opt {
  flex: 1; padding: 8px;
  border: 2px solid rgba(255,255,255,0.08);
  border-radius: 8px; text-align: center;
  font-size: 0.8rem; cursor: pointer; color: #6b7280;
  transition: all 0.15s; user-select: none;
}
.radio-opt.selected { border-color: #6366f1; color: #a5b4fc; background: rgba(99,102,241,0.1); }
.color-group { display: flex; gap: 8px; margin-bottom: 14px; }
.color-opt {
  flex: 1; padding: 8px;
  border: 2px solid rgba(255,255,255,0.08);
  border-radius: 8px; text-align: center;
  font-size: 0.8rem; cursor: pointer;
  transition: all 0.15s; user-select: none;
}
.color-opt.red    { color: #f87171; }
.color-opt.yellow { color: #fbbf24; }
.color-opt.selected { border-color: currentColor; background: rgba(255,255,255,0.04); }
.checkbox-row {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 16px; font-size: 0.85rem; color: #d1d5db; cursor: pointer;
}
#lived-checkbox { width: 16px; height: 16px; accent-color: #6366f1; cursor: pointer; }
.color-section  { margin-bottom: 14px; }
.dialog-actions { display: flex; gap: 8px; }
.btn-cancel {
  flex: 1; padding: 9px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; background: transparent;
  color: #6b7280; font-size: 0.85rem; cursor: pointer; font-family: inherit;
}
.btn-add {
  flex: 2; padding: 9px; border: none;
  border-radius: 8px; background: #6366f1; color: white;
  font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: inherit;
}
.btn-add:hover { background: #4f46e5; }

/* ===== City Remove Popup ===== */
#city-popup {
  position: absolute; z-index: 20;
  background: rgba(13,17,23,0.95);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; padding: 10px 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  display: none; min-width: 140px;
  backdrop-filter: blur(12px);
}
#city-popup p   { font-size: 0.82rem; font-weight: 600; color: white; margin-bottom: 6px; }
.btn-remove-city {
  width: 100%; padding: 6px;
  background: rgba(239,68,68,0.1);
  border: none; border-radius: 5px;
  color: #f87171; font-size: 0.78rem; font-weight: 600; cursor: pointer;
}
#city-popup-close {
  position: absolute; top: 6px; right: 8px;
  background: none; border: none;
  font-size: 0.9rem; color: #4b5563; cursor: pointer;
}

/* ===== Toast ===== */
#toast {
  position: fixed; bottom: 24px; left: 50%;
  transform: translateX(-50%);
  background: rgba(17,24,39,0.95);
  border: 1px solid rgba(255,255,255,0.1);
  color: white; padding: 10px 20px;
  border-radius: 10px; font-size: 0.85rem;
  z-index: 99; opacity: 0;
  transition: opacity 0.3s; pointer-events: none;
  backdrop-filter: blur(12px);
}
#toast.show { opacity: 1; }
```

- [ ] **Step 2: Keep auth section intact**

Lines 1–48 of `style.css` (auth screen styles) must NOT change. Only replace from `/* ===== Map Layout =====*/` onward.

---

### Task 3: Dark map style

**Files:**
- Modify: `js/map.js` (line 10)

- [ ] **Step 1: Change Mapbox style to dark**

```javascript
// Before:
style: 'mapbox://styles/mapbox/light-v11',

// After:
style: 'mapbox://styles/mapbox/dark-v11',
```

- [ ] **Step 2: Update country layer colors for dark map**

In `setupCountryLayers()`, update the visited-fill and outline colors to work on dark background:

```javascript
// visited-fill: keep blue but slightly brighter
paint: { 'fill-color': '#6366f1', 'fill-opacity': 0.35 }

// visited-outline
paint: { 'line-color': '#818cf8', 'line-width': 1.5 }

// wishlist-outline (orange → amber for dark theme)
paint: {
  'line-color': '#f59e0b',
  'line-width': 2,
  'line-dasharray': [3, 2]
}
```

---

### Task 4: Pulse markers

**Files:**
- Modify: `js/markers.js`

Replace `_createMarkerEl()` to use the `.marker-dot` CSS class with color from CSS custom properties.

- [ ] **Step 1: Replace `_createMarkerEl` function**

```javascript
function _createMarkerEl(city, type, onRemove) {
  const el = document.createElement('div');
  el.title  = city.name;
  el.className = 'marker-dot';

  if (type === 'wishlist') {
    el.style.background = '#10b981'; // emerald
    el.style.color      = '#10b981'; // for ::after border
  } else if (city.lived) {
    el.style.background = '#f59e0b'; // amber
    el.style.color      = '#f59e0b';
  } else {
    el.style.background = '#6366f1'; // indigo (visited)
    el.style.color      = '#6366f1';
  }

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onRemove(city, type, e.clientX, e.clientY);
  });

  return el;
}
```

Note: The `.marker-dot::after` animation uses `border: 2px solid currentColor`. Setting `el.style.color` to the same hue makes the pulse ring match the dot.

---

### Task 5: Update `js/ui.js` — sidebar stats, counts, recent logs

**Files:**
- Modify: `js/ui.js`

- [ ] **Step 1: Rewrite `updateStats()` to use new IDs**

```javascript
export function updateStats(userData) {
  const countries = (userData.visited_countries  ?? []).length;
  const cities    = (userData.visited_cities     ?? []).length;
  const lived     = (userData.visited_cities     ?? []).filter(c => c.lived).length;
  const wishlist  = (userData.wishlist_countries ?? []).length
                  + (userData.wishlist_cities    ?? []).length;

  // Snapshot grid
  document.getElementById('stat-countries-num').textContent = countries;
  document.getElementById('stat-cities-num').textContent    = cities;

  // Collection nav badges
  document.getElementById('nav-visited-count').textContent  = cities;
  document.getElementById('nav-wishlist-count').textContent = wishlist;
  document.getElementById('nav-lived-count').textContent    = lived;

  // Recent logs (last 3 visited cities, reverse order = most recent first)
  updateRecentLogs(userData.visited_cities ?? []);
}
```

- [ ] **Step 2: Add `updateRecentLogs()` function**

```javascript
function updateRecentLogs(visitedCities) {
  const el = document.getElementById('recent-logs');
  if (!el) return;

  const recent = [...visitedCities].reverse().slice(0, 3);

  if (recent.length === 0) {
    el.innerHTML = '<p style="font-size:0.78rem;color:#4b5563">No cities added yet.</p>';
    return;
  }

  el.innerHTML = recent.map(city => `
    <div class="recent-log-item">
      <div class="recent-log-icon">📍</div>
      <div>
        <p class="recent-log-city">${city.name}</p>
        <p class="recent-log-time">${city.country || ''}</p>
      </div>
    </div>
  `).join('');
}
```

- [ ] **Step 3: Remove old stat element references**

Remove these lines (they reference elements that no longer exist):
```javascript
// DELETE these 4 lines from the old updateStats():
document.getElementById('stat-visited-countries').textContent = ...
document.getElementById('stat-visited-cities').textContent    = ...
document.getElementById('stat-lived').textContent             = ...
document.getElementById('stat-wishlist').textContent          = ...
```

---

### Task 6: Update `js/app.js` — user profile + Add Location button

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Add `showUserProfile()` import and call**

Add a new function in `app.js` (no import needed, it's small):

```javascript
function _showUserProfile(user) {
  const avatarEl = document.getElementById('user-avatar');
  const nameEl   = document.getElementById('user-name');
  if (avatarEl && user.photoURL) avatarEl.src = user.photoURL;
  if (nameEl)   nameEl.textContent = user.displayName || user.email || 'User';
}
```

- [ ] **Step 2: Call `_showUserProfile` in `_init()` and pass `user`**

In `onAuthChange`, pass `user` to `_init`:

```javascript
// Before:
onAuthChange(async user => {
  if (!user) { window.location.href = 'index.html'; return; }
  if (_uid === user.uid) return;
  _uid = user.uid;
  await _init();
});

// After:
onAuthChange(async user => {
  if (!user) { window.location.href = 'index.html'; return; }
  if (_uid === user.uid) return;
  _uid = user.uid;
  await _init(user);
});
```

Update `_init` signature:

```javascript
async function _init(user) {
  try {
    _map      = await initMap();
    _userData = await loadUserData(_uid);

    _showUserProfile(user); // <-- add this line

    setupCountryLayers(...);
    // ... rest unchanged
```

- [ ] **Step 3: Wire `#btn-add-location` to focus search**

Add inside `_init()`, after `setupCitySearch()`:

```javascript
document.getElementById('btn-add-location')?.addEventListener('click', () => {
  document.getElementById('city-search')?.focus();
});
```

---

### Task 7: Deploy and verify

**Files:**
- No code changes — deploy + smoke test

- [ ] **Step 1: Commit**

```bash
git add map.html css/style.css js/map.js js/markers.js js/ui.js js/app.js
git commit -m "feat: dark redesign — sidebar layout, pulse markers, glassmorphism overlays"
```

- [ ] **Step 2: Deploy to Firebase**

```bash
cd /Users/marin/Documents/Claude-Projects/TravelMap
firebase deploy --only hosting
```

- [ ] **Step 3: Smoke test checklist**

Open https://travelmap-f4e3a.web.app and verify:
- [ ] Auth screen still looks correct (unchanged)
- [ ] After login: sidebar appears on left, map fills right side
- [ ] Stats grid shows correct counts
- [ ] Collection nav badges show correct counts
- [ ] Recent logs section shows last visited cities
- [ ] User avatar + name appear top-right
- [ ] Search input (top-right) works and shows results
- [ ] Clicking a result opens the city dialog
- [ ] City markers render as small pulse dots (indigo / emerald / amber)
- [ ] Clicking a marker opens the remove popup
- [ ] Clicking a country opens the tooltip
- [ ] Tooltip actions (Besucht / Wunschliste / Entfernen) update data
- [ ] Sign out button works
- [ ] Add New Location button focuses the search
- [ ] Toast messages appear correctly
