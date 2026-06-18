const _activeMarkers = [];

/**
 * Renders all city markers from userData.
 * Clears existing markers first.
 * onRemove(city, type, clientX, clientY) called when a marker is clicked.
 */
export function renderAllMarkers(map, userData, onRemove) {
  clearAllMarkers();
  userData.visited_cities.forEach(city =>
    _addMarker(map, city, 'visited', onRemove)
  );
  userData.wishlist_cities.forEach(city =>
    _addMarker(map, city, 'wishlist', onRemove)
  );
}

export function clearAllMarkers() {
  _activeMarkers.forEach(({ marker }) => marker.remove());
  _activeMarkers.length = 0;
}

function _addMarker(map, city, type, onRemove) {
  const el = _createMarkerEl(city, type, onRemove);
  const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
    .setLngLat([city.lng, city.lat])
    .addTo(map);
  _activeMarkers.push({ marker, name: city.name, type });
}

function _createMarkerEl(city, type, onRemove) {
  const el = document.createElement('div');
  el.title = city.name;
  el.style.cursor = 'pointer';

  if (type === 'wishlist') {
    el.textContent = '⭐';
    el.style.fontSize = '18px';
    el.style.lineHeight = '1';
  } else if (city.lived) {
    el.textContent = '🏠';
    el.style.fontSize = '18px';
    el.style.lineHeight = '1';
  } else {
    // Colored circle pin
    const color = city.color === 'yellow' ? '#eab308' : '#ef4444';
    el.style.cssText = `
      width: 12px; height: 12px;
      border-radius: 50%;
      background: ${color};
      border: 2px solid white;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    `;
  }

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    onRemove(city, type, e.clientX, e.clientY);
  });

  return el;
}
