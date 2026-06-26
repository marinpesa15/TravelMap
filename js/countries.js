import { MAPBOX_TOKEN } from './constants.js?v=12';

const LAYER_VISITED  = 'tm-visited';
const LAYER_WISHLIST = 'tm-wishlist';
const LAYER_OUTLINE  = 'tm-outline';
const LAYER_CLICK    = 'tm-click';

// Natural Earth 110m countries GeoJSON — lightweight, no Mapbox tileset dependency.
// Property ISO_A2 = 2-letter ISO code (e.g. "DE", "HR")
const GEOJSON_URL = 'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson';

let _geojsonData = null;

// ── GeoJSON loader ────────────────────────────────────────────────────────────

async function _loadGeoJSON() {
  if (_geojsonData) return _geojsonData;
  const resp = await fetch(GEOJSON_URL);
  if (!resp.ok) throw new Error(`GeoJSON fetch failed: ${resp.status}`);
  _geojsonData = await resp.json();
  return _geojsonData;
}

// ── Map layer setup ───────────────────────────────────────────────────────────

function _addLayer(map, def) {
  if (map.getLayer(def.id)) return; // already exists
  try {
    map.addLayer(def, 'country-label');
  } catch {
    try { map.addLayer(def); } catch { /* ignore duplicate */ }
  }
}

export async function initCountryLayers(map) {
  const geojson = await _loadGeoJSON();

  if (!map.getSource('tm-countries')) {
    map.addSource('tm-countries', { type: 'geojson', data: geojson });
  }

  // LAYER_CLICK: transparent fill covering all countries — needed for click events
  _addLayer(map, {
    id:     LAYER_CLICK,
    type:   'fill',
    source: 'tm-countries',
    paint:  { 'fill-color': 'transparent', 'fill-opacity': 0 },
    layout: { visibility: 'none' }
  });

  // LAYER_WISHLIST + LAYER_VISITED: no filter — paint expressions control visibility
  _addLayer(map, {
    id:     LAYER_WISHLIST,
    type:   'fill',
    source: 'tm-countries',
    paint:  { 'fill-color': '#10b981', 'fill-opacity': 0 },
    layout: { visibility: 'none' }
  });

  _addLayer(map, {
    id:     LAYER_VISITED,
    type:   'fill',
    source: 'tm-countries',
    paint:  { 'fill-color': '#6366f1', 'fill-opacity': 0 },
    layout: { visibility: 'none' }
  });

  _addLayer(map, {
    id:     LAYER_OUTLINE,
    type:   'line',
    source: 'tm-countries',
    paint:  { 'line-color': '#818cf8', 'line-width': 1.2, 'line-opacity': 0 },
    layout: { visibility: 'none' }
  });
}

// ── Fill update — uses setPaintProperty + match expression (more reliable than setFilter on GeoJSON) ──

export function updateCountryFills(map, visited = [], wishlist = []) {
  if (!map.getLayer(LAYER_VISITED)) return;

  // Visited: indigo fill — opacity driven by match expression
  map.setPaintProperty(LAYER_VISITED, 'fill-opacity',
    visited.length
      ? ['match', ['get', 'iso_a2'], visited, 0.48, 0]
      : 0
  );

  // Wishlist: emerald fill
  map.setPaintProperty(LAYER_WISHLIST, 'fill-opacity',
    wishlist.length
      ? ['match', ['get', 'iso_a2'], wishlist, 0.38, 0]
      : 0
  );

  // Outline: all tracked countries
  const all = [...new Set([...visited, ...wishlist])];
  map.setPaintProperty(LAYER_OUTLINE, 'line-opacity',
    all.length
      ? ['match', ['get', 'iso_a2'], all, 0.7, 0]
      : 0
  );
}

export function showCountryLayers(map) {
  [LAYER_CLICK, LAYER_VISITED, LAYER_WISHLIST, LAYER_OUTLINE].forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'visible');
  });
}

export function hideCountryLayers(map) {
  [LAYER_CLICK, LAYER_VISITED, LAYER_WISHLIST, LAYER_OUTLINE].forEach(id => {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  });
}

// ── Click handler ─────────────────────────────────────────────────────────────

export function setupCountryMapClick(map, onCountryClick) {
  map.on('click', LAYER_CLICK, e => {
    e.originalEvent._handled = true;
    const props = e.features?.[0]?.properties;
    const isoCode = props?.iso_a2;
    if (!isoCode || isoCode === '-99') return;
    onCountryClick(
      { isoCode, countryName: props.name || isoCode },
      e.point
    );
  });
  map.on('mouseenter', LAYER_CLICK, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', LAYER_CLICK, () => { map.getCanvas().style.cursor = ''; });
}

// ── Country search ────────────────────────────────────────────────────────────

let _countryAbort = null;

export async function searchCountries(query) {
  if (_countryAbort) _countryAbort.abort();
  _countryAbort = new AbortController();
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=country&limit=8&access_token=${MAPBOX_TOKEN}`;
  const res  = await fetch(url, { signal: _countryAbort.signal });
  const data = await res.json();
  return (data.features ?? [])
    .map(f => ({
      name:    f.text,
      isoCode: (f.properties?.short_code || '').toUpperCase()
    }))
    .filter(c => c.isoCode.length === 2);
}
