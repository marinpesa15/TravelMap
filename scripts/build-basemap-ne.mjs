// Baut die gebuendelte Offline-Basiskarte data/basemap.pmtiles aus Natural
// Earth (gemeinfrei), im Schema der Protomaps-Basemaps v4, damit dieselben
// Styles (scripts/build-basemap-style.mjs) damit funktionieren.
//
// Natural Earth reicht fuer Welt- und Laenderansicht (Zoom 0 bis 7): Land,
// Ozean, Seen, Grenzen, Laender-, Regions- und Stadtnamen, Autobahnen,
// Siedlungsflaechen. Fuer mehr Detail baut scripts/build-basemap.sh einen
// Ausschnitt aus dem Protomaps-Planet-Build (OpenStreetMap), gleiche Datei,
// gleicher Style.
//
// Aufruf: node scripts/build-basemap-ne.mjs <ne-geojson-dir> [maxzoom] [out]
// Die GeoJSON-Dateien kommen von
// https://github.com/nvkelso/natural-earth-vector/tree/master/geojson

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';
import { zxyToTileId } from 'pmtiles';

const root    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const neDir   = process.argv[2];
const MAXZOOM = Number(process.argv[3] ?? 7);
const OUT     = process.argv[4] ?? path.join(root, 'data', 'basemap.pmtiles');
if (!neDir) {
  console.error('usage: node scripts/build-basemap-ne.mjs <ne-geojson-dir> [maxzoom] [out]');
  process.exit(1);
}

const load = name => JSON.parse(fs.readFileSync(path.join(neDir, `${name}.geojson`), 'utf8'));

// ===== Hilfen =====

// Protomaps/Tilezen population_rank: Schwellen absteigend, Rang 20 = ueber 1 Mrd.
const POP_THRESHOLDS = [1e9, 5e8, 2e8, 1e8, 5e7, 2e7, 1e7, 5e6, 2e6, 1e6, 5e5, 2e5, 1e5, 5e4, 2e4, 1e4, 5e3, 2e3, 1e3, 2e2, 0];
function populationRank(pop) {
  const p = Number(pop) || 0;
  const idx = POP_THRESHOLDS.findIndex(t => p >= t);
  return 20 - (idx < 0 ? 20 : idx);
}

function names(p, local, en, de) {
  const out = {};
  const n = p[local]; if (n) out.name = String(n);
  const e = p[en];    if (e) out['name:en'] = String(e);
  const d = p[de];    if (d) out['name:de'] = String(d);
  return out;
}

const gate = z => Math.max(0, Math.min(MAXZOOM, Math.floor(Number(z) || 0)));

// Mittelpunkt der groessten Flaeche eines (Multi-)Polygons. Ozeane kreuzen
// den Antimeridian; damit der Pazifik nicht in Afrika beschriftet wird,
// werden Laengen westlich von -90 um 360 Grad verschoben, wenn die Flaeche
// mehr als 180 Grad breit ist.
function labelPoint(geom) {
  const polys = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
  let best = null, bestArea = -1;
  for (const poly of polys) {
    const ring = poly[0];
    let minX = Infinity, maxX = -Infinity;
    for (const [x] of ring) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    const wrap = maxX - minX > 180;
    const pts = ring.map(([x, y]) => [wrap && x < -90 ? x + 360 : x, y]);
    let area = 0, cx = 0, cy = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const f = pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
      area += f; cx += (pts[j][0] + pts[i][0]) * f; cy += (pts[j][1] + pts[i][1]) * f;
    }
    area = Math.abs(area) / 2;
    if (area > bestArea && area > 0) {
      const a6 = 3 * (pts.reduce((acc, [x], k) => {
        const [px, py] = pts[k === 0 ? pts.length - 1 : k - 1];
        return acc + (px * pts[k][1] - x * py);
      }, 0));
      let lx = cx / a6, ly = cy / a6;
      if (lx > 180) lx -= 360;
      best = [lx, ly]; bestArea = area;
    }
  }
  return best;
}

// ===== Schicht-Definitionen =====
// Jede Quelle liefert Features mit props und einer Zoomstufe `z`, ab der
// das Feature in die Kacheln kommt. Pro Schicht und Zoomstufe entsteht ein
// eigener geojson-vt-Index; eine Kachel bei Zoom z nimmt alle Buckets <= z.

const layers = {}; // name -> { buckets: Map<z, feature[]> }
function add(layer, feature, z) {
  const l = layers[layer] ??= { buckets: new Map() };
  const b = l.buckets.get(z) ?? [];
  b.push(feature);
  l.buckets.set(z, b);
}
const feat = (geometry, properties) => ({ type: 'Feature', geometry, properties });

console.log('reading Natural Earth…');

// earth: Landflaechen
for (const f of load('ne_10m_land').features) add('earth', feat(f.geometry, { kind: 'earth' }), 0);
for (const f of load('ne_10m_minor_islands').features) add('earth', feat(f.geometry, { kind: 'earth' }), 5);

// water: Ozean als Flaeche, Seen mit Namen, Meeresnamen als Punkte
for (const f of load('ne_10m_ocean').features) add('water', feat(f.geometry, { kind: 'ocean' }), 0);
for (const f of load('ne_10m_lakes').features) {
  const p = f.properties;
  add('water', feat(f.geometry, { kind: 'lake', ...names(p, 'name', 'name_en', 'name_de') }), gate(p.min_zoom));
}
{
  const KIND = { ocean: 'ocean', sea: 'sea', gulf: 'bay', bay: 'bay', sound: 'bay', channel: 'strait', strait: 'strait', fjord: 'fjord', lagoon: 'bay', generic: 'sea' };
  for (const f of load('ne_10m_geography_marine_polys').features) {
    const p = f.properties;
    const kind = KIND[p.featurecla] ?? 'sea';
    if (!p.name) continue;
    const at = labelPoint(f.geometry);
    if (!at) continue;
    add('water', feat({ type: 'Point', coordinates: at },
      { kind, ...names(p, 'name', 'name_en', 'name_de'), min_zoom: Number(p.min_label) || 0 }), gate(p.min_label));
  }
}

// landcover: Siedlungsflaechen und Gletscher
for (const f of load('ne_10m_urban_areas').features) add('landcover', feat(f.geometry, { kind: 'urban_area' }), gate(f.properties.min_zoom));
for (const f of load('ne_10m_glaciated_areas').features) add('landcover', feat(f.geometry, { kind: 'glacier' }), gate(f.properties.min_zoom ?? 3));

// boundaries: Landesgrenzen ab Zoom 0, Regionsgrenzen ab Zoom 5
for (const f of load('ne_10m_admin_0_boundary_lines_land').features) {
  const p = f.properties;
  const disputed = /Disputed|Line of control|Indefinite|Unrecognized/i.test(p.FEATURECLA ?? '');
  add('boundaries', feat(f.geometry, { kind: 'country', kind_detail: 2, ...(disputed ? { disputed: true } : {}) }), gate(p.MIN_ZOOM));
}
for (const f of load('ne_10m_admin_1_states_provinces_lines').features) {
  add('boundaries', feat(f.geometry, { kind: 'region', kind_detail: 4 }), Math.max(5, gate(f.properties.MIN_ZOOM)));
}

// places: Laender, Regionen, Staedte als Punkte
for (const f of load('ne_10m_admin_0_countries').features) {
  const p = f.properties;
  if (!p.NAME || typeof p.LABEL_X !== 'number') continue;
  add('places', feat({ type: 'Point', coordinates: [p.LABEL_X, p.LABEL_Y] }, {
    kind: 'country', ...names(p, 'NAME', 'NAME_EN', 'NAME_DE'),
    min_zoom: Number(p.MIN_LABEL) || 0, population_rank: populationRank(p.POP_EST), population: Number(p.POP_EST) || 0
  }), gate(p.MIN_LABEL));
}
for (const f of load('ne_10m_admin_1_states_provinces').features) {
  const p = f.properties;
  if (!p.name || typeof p.longitude !== 'number') continue;
  const minLabel = Number(p.min_label) || 6;
  add('places', feat({ type: 'Point', coordinates: [p.longitude, p.latitude] }, {
    kind: 'region', ...names(p, 'name', 'name_en', 'name_de'),
    ...(p.postal ? { ref: String(p.postal) } : {}), min_zoom: minLabel, sort_key: minLabel
  }), gate(minLabel));
}
for (const f of load('ne_10m_populated_places').features) {
  const p = f.properties;
  if (!p.NAME) continue;
  if (/station/i.test(p.FEATURECLA ?? '')) continue;
  const minZoom = Number(p.MIN_ZOOM) || 7;
  add('places', feat(f.geometry, {
    kind: 'locality', ...names(p, 'NAME', 'NAME_EN', 'NAME_DE'),
    min_zoom: minZoom, population_rank: populationRank(p.POP_MAX), population: Number(p.POP_MAX) || 0,
    ...(p.ADM0CAP === 1 ? { capital: 'yes' } : {})
  }), gate(minZoom));
}

// roads: Autobahnen und Fernstrassen; alles Kleinere zeigt der Style erst ab Zoom 11
{
  const KIND = { 'Major Highway': 'highway', 'Secondary Highway': 'major_road', 'Beltway': 'major_road', 'Bypass': 'major_road', 'Road': 'major_road' };
  for (const f of load('ne_10m_roads').features) {
    const p = f.properties;
    const kind = KIND[p.type];
    if (!kind) continue;
    add('roads', feat(f.geometry, { kind, ...(p.name ? { name: String(p.name) } : {}) }), gate(p.min_zoom));
  }
}

// ===== Kacheln =====

console.log('indexing…');
const indexes = {}; // layer -> [{ z, index }]
for (const [name, { buckets }] of Object.entries(layers)) {
  indexes[name] = [...buckets.entries()].map(([z, features]) => ({
    z,
    index: geojsonvt({ type: 'FeatureCollection', features }, {
      maxZoom: MAXZOOM, indexMaxZoom: Math.min(5, MAXZOOM), indexMaxPoints: 100000,
      tolerance: 3, extent: 4096, buffer: 64
    })
  }));
  console.log(`  ${name}: ${[...buckets.values()].reduce((n, b) => n + b.length, 0)} features in ${buckets.size} zoom buckets`);
}

console.log('tiling…');
const tiles = []; // { id, data }
let addressed = 0;
for (let z = 0; z <= MAXZOOM; z++) {
  const n = 1 << z;
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      addressed++;
      const vt = {};
      for (const [name, list] of Object.entries(indexes)) {
        let features = [];
        for (const { z: bz, index } of list) {
          if (bz > z) continue;
          const t = index.getTile(z, x, y);
          if (t?.features?.length) features = features.concat(t.features);
        }
        if (features.length) vt[name] = { features, extent: 4096 };
      }
      if (!Object.keys(vt).length) continue;
      const pbf  = vtpbf.fromGeojsonVt(vt, { version: 2, extent: 4096 });
      tiles.push({ id: zxyToTileId(z, x, y), data: zlib.gzipSync(Buffer.from(pbf), { level: 9 }) });
    }
  }
  console.log(`  z${z}: ${tiles.length} tiles so far`);
}
tiles.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

// ===== PMTiles v3 schreiben =====

function varint(buf, v) {
  let n = typeof v === 'bigint' ? v : BigInt(v);
  while (n >= 0x80n) { buf.push(Number(n & 0x7fn) | 0x80); n >>= 7n; }
  buf.push(Number(n));
}
function serializeDir(entries) {
  const buf = [];
  varint(buf, entries.length);
  let last = 0n;
  for (const e of entries) { varint(buf, e.tileId - last); last = e.tileId; }
  for (const e of entries) varint(buf, e.runLength);
  for (const e of entries) varint(buf, e.length);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (i > 0 && e.offset === entries[i - 1].offset + entries[i - 1].length) varint(buf, 0);
    else varint(buf, e.offset + 1);
  }
  return zlib.gzipSync(Buffer.from(buf));
}

const entries = [];
let offset = 0;
const dataChunks = [];
for (const t of tiles) {
  entries.push({ tileId: BigInt(t.id), offset, length: t.data.length, runLength: 1 });
  dataChunks.push(t.data);
  offset += t.data.length;
}
const tileData = Buffer.concat(dataChunks);

// Wurzelverzeichnis muss in 16 KB passen, sonst Blattverzeichnisse
let rootBytes = serializeDir(entries);
let leafBytes = Buffer.alloc(0);
if (rootBytes.length > 16384) {
  const LEAF = 2048;
  const rootEntries = [];
  const leaves = [];
  let leafOffset = 0;
  for (let i = 0; i < entries.length; i += LEAF) {
    const chunk = entries.slice(i, i + LEAF);
    const bytes = serializeDir(chunk);
    rootEntries.push({ tileId: chunk[0].tileId, offset: leafOffset, length: bytes.length, runLength: 0 });
    leaves.push(bytes);
    leafOffset += bytes.length;
  }
  rootBytes = serializeDir(rootEntries);
  leafBytes = Buffer.concat(leaves);
  if (rootBytes.length > 16384) throw new Error('root directory still too large');
}

const metadata = zlib.gzipSync(Buffer.from(JSON.stringify({
  name: 'TravelMap offline basemap',
  description: 'Natural Earth in the Protomaps basemap v4 schema',
  attribution: 'Natural Earth',
  type: 'baselayer',
  vector_layers: Object.keys(layers).map(id => ({ id, fields: {} }))
})));

const HEADER = 127;
const rootOffset = HEADER;
const metaOffset = rootOffset + rootBytes.length;
const leafOffset = metaOffset + metadata.length;
const dataOffset = leafOffset + leafBytes.length;

const header = Buffer.alloc(HEADER);
header.write('PMTiles', 0, 'latin1');
header.writeUInt8(3, 7);
header.writeBigUInt64LE(BigInt(rootOffset), 8);
header.writeBigUInt64LE(BigInt(rootBytes.length), 16);
header.writeBigUInt64LE(BigInt(metaOffset), 24);
header.writeBigUInt64LE(BigInt(metadata.length), 32);
header.writeBigUInt64LE(BigInt(leafOffset), 40);
header.writeBigUInt64LE(BigInt(leafBytes.length), 48);
header.writeBigUInt64LE(BigInt(dataOffset), 56);
header.writeBigUInt64LE(BigInt(tileData.length), 64);
header.writeBigUInt64LE(BigInt(addressed), 72);     // addressed tiles
header.writeBigUInt64LE(BigInt(entries.length), 80); // tile entries
header.writeBigUInt64LE(BigInt(entries.length), 88); // tile contents
header.writeUInt8(1, 96);  // clustered
header.writeUInt8(2, 97);  // internal compression: gzip
header.writeUInt8(2, 98);  // tile compression: gzip
header.writeUInt8(1, 99);  // tile type: MVT
header.writeUInt8(0, 100); // min zoom
header.writeUInt8(MAXZOOM, 101);
header.writeInt32LE(-180e7, 102);
header.writeInt32LE(-85.05e7, 106);
header.writeInt32LE(180e7, 110);
header.writeInt32LE(85.05e7, 114);
header.writeUInt8(1, 118);  // center zoom
header.writeInt32LE(10e7, 119);
header.writeInt32LE(20e7, 123);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([header, rootBytes, metadata, leafBytes, tileData]));
const mb = (fs.statSync(OUT).size / 1048576).toFixed(1);
console.log(`wrote ${path.relative(root, OUT)}: ${entries.length} tiles, zoom 0-${MAXZOOM}, ${mb} MB`);
