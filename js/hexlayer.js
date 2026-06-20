// ===== H3 Hex Layer =====
// h3-js is loaded via <script src="js/vendor/h3.js"> — available as window.h3

const H3_RES  = 3;    // ~12,000 km² per cell
const SRC_ID  = 'hex-source';
const FILL_ID = 'hex-fill';
const LINE_ID = 'hex-outline';

/**
 * Add or update the hex layer on the map.
 * Safe to call after map.setStyle() — re-adds source/layers when they're gone.
 */
export function renderHexLayer(map, userData) {
  const h3 = window.h3;
  if (!h3) {
    console.warn('TravelMap: h3-js not loaded, skipping hex layer');
    return;
  }

  const geojson = { type: 'FeatureCollection', features: _buildFeatures(h3, userData) };

  // Source still alive (no style change) → just swap the data
  if (map.getSource(SRC_ID)) {
    map.getSource(SRC_ID).setData(geojson);
    return;
  }

  // Fresh add: initial load or after setStyle removed everything
  map.addSource(SRC_ID, { type: 'geojson', data: geojson });

  // Insert below label layers so city names stay readable
  const before = _firstExistingLayer(map, [
    'settlement-label', 'country-label', 'place-label', 'road-label'
  ]);

  map.addLayer({
    id: FILL_ID, type: 'fill', source: SRC_ID,
    paint: {
      'fill-color':   ['get', 'color'],
      'fill-opacity': 0.25
    }
  }, before);

  map.addLayer({
    id: LINE_ID, type: 'line', source: SRC_ID,
    paint: {
      'line-color':   ['get', 'color'],
      'line-width':   1,
      'line-opacity': 0.55
    }
  }, before);
}

// ── helpers ───────────────────────────────────────────────────────────

function _buildFeatures(h3, userData) {
  const cells = new Map(); // h3index → { color, priority }

  // Priority: lived (3) > visited (2) > wishlist (1)
  (userData.wishlist_cities ?? []).forEach(c => _upsert(h3, cells, c, '#10b981', 1));
  (userData.visited_cities  ?? []).forEach(c => {
    const color = c.lived ? '#f59e0b' : '#6366f1';
    _upsert(h3, cells, c, color, c.lived ? 3 : 2);
  });

  const features = [];
  for (const [h3idx, { color }] of cells) {
    try {
      const boundary = h3.cellToBoundary(h3idx);             // [[lat, lng], ...]
      const ring     = boundary.map(([lat, lng]) => [lng, lat]); // → GeoJSON [lng, lat]
      ring.push(ring[0]);                                     // close polygon ring
      features.push({
        type: 'Feature',
        geometry:   { type: 'Polygon', coordinates: [ring] },
        properties: { color }
      });
    } catch (err) {
      console.warn('TravelMap: skipping invalid H3 cell', h3idx, err);
    }
  }
  return features;
}

function _upsert(h3, cells, city, color, priority) {
  if (typeof city.lat !== 'number' || typeof city.lng !== 'number') return;
  try {
    const idx      = h3.latLngToCell(city.lat, city.lng, H3_RES);
    const existing = cells.get(idx);
    if (!existing || priority > existing.priority) {
      cells.set(idx, { color, priority });
    }
  } catch (err) {
    console.warn('TravelMap: h3 cell lookup failed for city', city.name, err);
  }
}

function _firstExistingLayer(map, candidates) {
  for (const id of candidates) {
    if (map.getLayer(id)) return id;
  }
  return undefined;
}
