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

  // Group visited pins anchor at bottom (tip of the tail), regular pins anchor center
  const useAvatar = isGroup && type === 'visited' && city.addedBy?.photoURL;
  const useFallback = isGroup && type === 'visited' && !city.addedBy?.photoURL && city.addedBy?.displayName;
  const isGroupVisited = isGroup && type === 'visited';

  let el = isGroupVisited
    ? _createGroupVisitedMarkerEl(city, onRemove)
    : _createMarkerEl(city, type, onRemove);

  // Just-added city → drop animation. Mapbox positions the outer element via
  // its transform, so we wrap and animate the inner one.
  if (_pendingDrop && _pendingDrop.name === city.name && Date.now() < _pendingDrop.until) {
    _pendingDrop = null;
    const wrap = document.createElement('div');
    wrap.style.width  = isGroupVisited ? '40px' : '12px';
    wrap.style.height = isGroupVisited ? '48px' : '12px';
    wrap.appendChild(el);
    dropIn(el);
    el = wrap;
  }

  const anchor = isGroupVisited ? 'bottom' : 'center';
  const marker = new mapboxgl.Marker({ element: el, anchor })
    .setLngLat([city.lng, city.lat])
    .addTo(map);
  _activeMarkers.push({ marker, name: city.name, type });
}

// ── Standard dot marker (own view, friend view, group wishlist) ───────────────

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
