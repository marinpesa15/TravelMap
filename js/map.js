import { MAPBOX_TOKEN } from './constants.js';

let _map = null;

export function initMap() {
  mapboxgl.accessToken = MAPBOX_TOKEN;

  _map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: [10, 20],
    zoom: 1.5
  });

  _map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

  return new Promise(resolve => _map.on('load', () => resolve(_map)));
}

export function getMap() { return _map; }

/**
 * Adds country fill + outline layers to the map.
 * Call once after map.on('load').
 */
export function setupCountryLayers(visitedCountries, wishlistCountries) {
  _map.addSource('country-boundaries', {
    type: 'vector',
    url: 'mapbox://mapbox.country-boundaries-v1'
  });

  // Invisible layer for click detection (covers all countries)
  _map.addLayer({
    id: 'country-click',
    type: 'fill',
    source: 'country-boundaries',
    'source-layer': 'country_boundaries',
    paint: { 'fill-color': 'transparent', 'fill-opacity': 0 }
  });

  // Visited countries — blue fill
  _map.addLayer({
    id: 'visited-fill',
    type: 'fill',
    source: 'country-boundaries',
    'source-layer': 'country_boundaries',
    filter: _buildFilter(visitedCountries),
    paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.4 }
  });

  // Visited countries — blue outline
  _map.addLayer({
    id: 'visited-outline',
    type: 'line',
    source: 'country-boundaries',
    'source-layer': 'country_boundaries',
    filter: _buildFilter(visitedCountries),
    paint: { 'line-color': '#3b82f6', 'line-width': 1.5 }
  });

  // Wishlist countries — orange dashed outline
  _map.addLayer({
    id: 'wishlist-outline',
    type: 'line',
    source: 'country-boundaries',
    'source-layer': 'country_boundaries',
    filter: _buildFilter(wishlistCountries),
    paint: {
      'line-color': '#fb923c',
      'line-width': 2,
      'line-dasharray': [3, 2]
    }
  });

  // Cursor change on country hover
  _map.on('mouseenter', 'country-click', () => {
    _map.getCanvas().style.cursor = 'pointer';
  });
  _map.on('mouseleave', 'country-click', () => {
    _map.getCanvas().style.cursor = '';
  });
}

/** Updates layer filters after data changes. */
export function updateCountryLayers(visitedCountries, wishlistCountries) {
  if (!_map) return;
  _map.setFilter('visited-fill',    _buildFilter(visitedCountries));
  _map.setFilter('visited-outline', _buildFilter(visitedCountries));
  _map.setFilter('wishlist-outline', _buildFilter(wishlistCountries));
}

function _buildFilter(isoCodes) {
  if (!isoCodes || isoCodes.length === 0) {
    return ['==', ['get', 'iso_3166_1'], '__NONE__'];
  }
  return ['in', ['get', 'iso_3166_1'], ['literal', isoCodes]];
}
