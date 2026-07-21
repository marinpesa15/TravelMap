import { dropIn } from './anim.js?v=1';

const _activeMarkers = [];

// City the user just added — its marker plays a one-time drop animation on
// the next render. Expires so a failed write can't animate a later render.
let _pendingDrop = null; // { name, until }

/** Call right before adding a city so its new marker drops in. */
export function animateNextAdd(cityName) {
  _pendingDrop = { name: cityName, until: Date.now() + 8000 };
}

/**
 * Renders all city markers from userData.
 * Clears existing markers first.
 * onRemove(city, type, clientX, clientY) called when a marker is clicked.
 */
export function renderAllMarkers(map, userData, onRemove) {
  clearAllMarkers();
  (userData.visited_cities ?? []).forEach(city =>
    _addMarker(map, city, 'visited', onRemove)
  );
  (userData.wishlist_cities ?? []).forEach(city =>
    _addMarker(map, city, 'wishlist', onRemove)
  );
}

/**
 * Renders group markers:
 * - Visited cities → personalised avatar pin (profile picture + tail)
 * - Wishlist cities → standard emerald dot (unchanged)
 * Backward-compatible: cities without addedBy fall back to regular dot.
 */
export function renderGroupMarkers(map, groupData, onRemove) {
  clearAllMarkers();
  (groupData.visited_cities  ?? []).forEach(city =>
    _addMarker(map, city, 'visited',  onRemove, true)
  );
  (groupData.wishlist_cities ?? []).forEach(city =>
    _addMarker(map, city, 'wishlist', onRemove, false)
  );
}

export function clearAllMarkers() {
  _activeMarkers.forEach(({ marker }) => marker.remove());
  _activeMarkers.length = 0;
}

/**
 * Renders markers without click handlers (read-only view mode).
 * Used when viewing a friend's map.
 */
export function renderReadOnlyMarkers(map, userData) {
  clearAllMarkers();
  (userData.visited_cities  ?? []).forEach(city => _addMarker(map, city, 'visited',  null));
  (userData.wishlist_cities ?? []).forEach(city => _addMarker(map, city, 'wishlist', null));
}

function _addMarker(map, city, type, onRemove, isGroup = false) {
  if (!city || typeof city.lng !== 'number' || typeof city.lat !== 'number'
      || isNaN(city.lng) || isNaN(city.lat)) {
    console.warn('TravelMap: skipping city with invalid coords', city);
    return;
  }

  // Own + friend views use the beacon pin; group view keeps its existing
  // markers (avatar pin for visited, standard dot for wishlist).
  const isGroupVisited = isGroup && type === 'visited';

  let el;
  if (isGroupVisited)  el = _createGroupVisitedMarkerEl(city, onRemove);
  else if (isGroup)    el = _createMarkerEl(city, type, onRemove);
  else                 el = _createBeaconEl(city, type, onRemove);

  // Just-added city → drop animation. Mapbox positions the outer element via
  // its transform, so we wrap and animate the inner one.
  if (_pendingDrop && _pendingDrop.name === city.name && Date.now() < _pendingDrop.until) {
    _pendingDrop = null;
    const wrap = document.createElement('div');
    if (isGroupVisited)  { wrap.style.width = '40px'; wrap.style.height = '48px'; }
    else if (isGroup)    { wrap.style.width = '12px'; wrap.style.height = '12px'; }
    else                 { wrap.style.width = '16px'; wrap.style.height = '22px'; }
    wrap.appendChild(el);
    dropIn(el);
    el = wrap;
  }

  // Beacons and avatar pins point at the spot with their foot — anchor bottom
  const anchor = (isGroupVisited || !isGroup) ? 'bottom' : 'center';
  const marker = new mapboxgl.Marker({ element: el, anchor })
    .setLngLat([city.lng, city.lat])
    .addTo(map);
  _activeMarkers.push({ marker, name: city.name, type });
}

// ── Beacon marker (own view, friend view) ─────────────────────────────────────
// Small glowing head on a thin stem, anchored at the base. State drives the
// look: visited = indigo, lived = amber, wishlist = dashed hollow emerald.

function _createBeaconEl(city, type, onRemove) {
  const el     = document.createElement('div');
  el.title     = city.name;
  el.className = 'beacon-marker';

  const state = type === 'wishlist' ? 'wishlist' : (city.lived ? 'lived' : 'visited');
  el.innerHTML = `
    <div class="beacon ${state}">
      <div class="beacon-head"></div>
      <div class="beacon-stem"></div>
      <div class="beacon-base"></div>
    </div>`;

  if (onRemove) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(city, type, e.clientX, e.clientY);
    });
  }

  return el;
}

// ── Standard dot marker (group wishlist) ──────────────────────────────────────

function _createMarkerEl(city, type, onRemove) {
  const el      = document.createElement('div');
  el.title      = city.name;
  el.className  = 'marker-dot';

  // Color scheme: indigo = visited, amber = lived, emerald = wishlist
  let color;
  if (type === 'wishlist') {
    color = '#10b981'; // emerald
  } else if (city.lived) {
    color = '#f59e0b'; // amber
  } else {
    color = '#6366f1'; // indigo
  }

  el.style.background = color;
  el.style.color      = color; // drives the ::after pulse ring via currentColor

  if (onRemove) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(city, type, e.clientX, e.clientY);
    });
  }

  return el;
}

// ── Avatar pin marker (group visited cities) ──────────────────────────────────

function _createGroupVisitedMarkerEl(city, onRemove) {
  const wrap = document.createElement('div');
  wrap.className = 'group-pin-visited';
  wrap.title     = city.name;

  const photoURL    = city.addedBy?.photoURL    || '';
  const displayName = city.addedBy?.displayName || '?';
  const initial     = displayName.trim()[0]?.toUpperCase() || '?';

  if (photoURL) {
    // Avatar image — falls back to initial div on error
    const img = document.createElement('img');
    img.src   = photoURL;
    img.alt   = displayName;
    img.className = 'group-pin-img';

    const fallback = document.createElement('div');
    fallback.className   = 'group-pin-fallback';
    fallback.textContent = initial;
    fallback.style.display = 'none';

    img.addEventListener('error', () => {
      img.style.display      = 'none';
      fallback.style.display = 'flex';
    });

    wrap.appendChild(img);
    wrap.appendChild(fallback);
  } else {
    // No photo URL — show initial directly
    const fallback = document.createElement('div');
    fallback.className   = 'group-pin-fallback';
    fallback.textContent = initial;
    wrap.appendChild(fallback);
  }

  if (onRemove) {
    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(city, 'visited', e.clientX, e.clientY);
    });
  }

  return wrap;
}
