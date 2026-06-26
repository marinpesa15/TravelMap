const _activeMarkers = [];

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

  const el     = isGroupVisited
    ? _createGroupVisitedMarkerEl(city, onRemove)
    : _createMarkerEl(city, type, onRemove);

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
