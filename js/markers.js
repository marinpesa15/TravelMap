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

export function clearAllMarkers() {
  _activeMarkers.forEach(({ marker }) => marker.remove());
  _activeMarkers.length = 0;
}

function _addMarker(map, city, type, onRemove) {
  if (!city || typeof city.lng !== 'number' || typeof city.lat !== 'number'
      || isNaN(city.lng) || isNaN(city.lat)) {
    console.warn('TravelMap: skipping city with invalid coords', city);
    return;
  }
  const el     = _createMarkerEl(city, type, onRemove);
  const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
    .setLngLat([city.lng, city.lat])
    .addTo(map);
  _activeMarkers.push({ marker, name: city.name, type });
}

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

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onRemove(city, type, e.clientX, e.clientY);
  });

  return el;
}
