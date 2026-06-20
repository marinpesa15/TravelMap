// ===== Full Viewport Hex Grid Layer =====
// Covers the entire visible map area with H3 cells.
// Visited cells get a colored fill; all others show as a subtle outline grid.
// Uses window.h3 (loaded via js/vendor/h3.js script tag).

const GRID_SRC = 'hgrid-bg-src';   // all viewport cells (grid lines)
const FILL_SRC = 'hgrid-fill-src'; // visited/wishlist cells (colored)

let _onMove = null; // stored so we can remove the listener

/** Activate the full hex grid. Call after map is loaded. */
export function activateHexGrid(map, getFilteredData) {
  if (map.getSource(GRID_SRC)) return; // already active

  map.addSource(GRID_SRC, { type: 'geojson', data: _empty() });
  map.addSource(FILL_SRC, { type: 'geojson', data: _empty() });

  // Background grid — very subtle outline for all viewport cells
  map.addLayer({
    id: 'hgrid-lines', type: 'line', source: GRID_SRC,
    paint: { 'line-color': 'rgba(255,255,255,0.07)', 'line-width': 0.5 }
  });

  // Filled visited cells
  map.addLayer({
    id: 'hgrid-fill', type: 'fill', source: FILL_SRC,
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.3 }
  });

  // Colored outline for visited cells
  map.addLayer({
    id: 'hgrid-fill-line', type: 'line', source: FILL_SRC,
    paint: { 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-opacity': 0.7 }
  });

  _onMove = () => _update(map, getFilteredData);
  map.on('moveend', _onMove);
  map.on('zoomend', _onMove);
  _onMove(); // initial render
}

/** Deactivate hex grid and clean up all layers/sources. */
export function deactivateHexGrid(map) {
  if (_onMove) {
    map.off('moveend', _onMove);
    map.off('zoomend', _onMove);
    _onMove = null;
  }
  ['hgrid-fill-line', 'hgrid-fill', 'hgrid-lines'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  [FILL_SRC, GRID_SRC].forEach(id => {
    if (map.getSource(id)) map.removeSource(id);
  });
}

/** Call after userData changes to refresh colored cells. */
export function refreshHexGrid(map, getFilteredData) {
  if (map.getSource(GRID_SRC)) _update(map, getFilteredData);
}

// ── internals ─────────────────────────────────────────────────────────

function _update(map, getFilteredData) {
  const h3 = window.h3;
  if (!h3) return;

  const zoom = map.getZoom();
  // Adaptive resolution: bigger cells at world zoom, finer when zoomed in
  const res = zoom < 2.5 ? 1 : zoom < 4.5 ? 2 : 3;

  // Clamp bounds to valid lat/lng range
  const b = map.getBounds();
  const w = Math.max(b.getWest(),  -179.9);
  const e = Math.min(b.getEast(),   179.9);
  const s = Math.max(b.getSouth(),  -85);
  const n = Math.min(b.getNorth(),   85);

  const viewpoly = {
    type: 'Polygon',
    coordinates: [[[w,s],[e,s],[e,n],[w,n],[w,s]]]
  };

  let allCells;
  try { allCells = h3.polygonToCells(viewpoly, res, 'containmentMode' in h3 ? undefined : undefined); }
  catch (err) { console.warn('hexgrid: polygonToCells failed', err); return; }

  // Build visited-cell map (priority: lived > visited > wishlist)
  const userData = getFilteredData();
  const filledCells = new Map();

  (userData.wishlist_cities ?? []).forEach(c => {
    try {
      const idx = h3.latLngToCell(c.lat, c.lng, res);
      if (!filledCells.has(idx)) filledCells.set(idx, { color: '#10b981', priority: 1 });
    } catch {}
  });
  (userData.visited_cities ?? []).forEach(c => {
    try {
      const idx   = h3.latLngToCell(c.lat, c.lng, res);
      const color = c.lived ? '#f59e0b' : '#6366f1';
      const prio  = c.lived ? 3 : 2;
      const cur   = filledCells.get(idx);
      if (!cur || prio > cur.priority) filledCells.set(idx, { color, priority: prio });
    } catch {}
  });

  // All viewport cells → background grid
  const gridFeats = allCells.map(idx => _cellFeature(h3, idx, null)).filter(Boolean);
  // Visited/wishlist cells → colored fill
  const fillFeats = [...filledCells.entries()]
    .map(([idx, { color }]) => _cellFeature(h3, idx, color))
    .filter(Boolean);

  map.getSource(GRID_SRC)?.setData({ type: 'FeatureCollection', features: gridFeats });
  map.getSource(FILL_SRC)?.setData({ type: 'FeatureCollection', features: fillFeats });
}

function _cellFeature(h3, idx, color) {
  try {
    const boundary = h3.cellToBoundary(idx);
    const ring     = boundary.map(([lat, lng]) => [lng, lat]);
    ring.push(ring[0]); // close polygon
    return {
      type: 'Feature',
      geometry:   { type: 'Polygon', coordinates: [ring] },
      properties: color ? { color } : {}
    };
  } catch { return null; }
}

function _empty() { return { type: 'FeatureCollection', features: [] }; }
