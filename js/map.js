import * as constants from './constants.js?v=13';
import { layers as basemapLayers, namedFlavor } from '../vendor/protomaps-basemaps/5.7.2/index.js';
import { loadCountriesGeoJSON } from './countries.js?v=25';
import { buildFallbackStyle } from './fallback-style.js?v=1';
import { getLang } from './i18n.js?v=9';

// ===== Karte =====
//
// MapLibre GL mit eigener Basiskarte im PMTiles-Format, kein Mapbox mehr:
//
// - data/basemap.pmtiles liegt im App-Bundle (Natural Earth, Zoom 0 bis 7,
//   Schema der Protomaps-Basemaps). Damit ist die Karte ohne Netz komplett:
//   Land, Wasser, Grenzen, Namen. Die Datei wird einmal ganz geladen, so
//   braucht es keine Range-Anfragen an den App-eigenen Server.
// - Optional eine zweite PMTiles-Datei im Netz (BASEMAP_REMOTE_URL in
//   constants.js), z.B. ein Protomaps-Ausschnitt mit Strassen bis Zoom 15.
//   Ist sie erreichbar, kommt sie zum Einsatz; sonst, und bei jedem
//   Netzverlust, die gebuendelte Karte. Der Wechsel zurueck laeuft mit
//   wachsendem Abstand und beim Online-Ereignis.
// - Style, Fonts und Sprites liegen ebenfalls im Bundle
//   (vendor/protomaps-basemaps, vendor/basemap-assets).
// - Der Zustand geht an die Oberflaeche: 'loading', 'ready' (beste
//   verfuegbare Karte) oder 'fallback' (Netzkarte konfiguriert, aber nicht
//   erreichbar). Faellt sogar die gebuendelte Datei aus, bleibt die grobe
//   Laenderkarte aus js/fallback-style.js.

const LOCAL_BASEMAP = 'data/basemap.pmtiles';
const REMOTE_URL    = String(constants.BASEMAP_REMOTE_URL ?? '').trim();
const PROBE_MS      = 4000;
const RETRY_MS      = [2000, 4000, 8000, 16000, 32000];

// Die Protomaps-Farben, an den Look der App angepasst: dunkles Marineblau
// als Wasser, etwas helleres Land, so wie die Pins es brauchen.
const FLAVOR_OVERRIDES = {
  dark:  { background: '#0b0d19', water: '#0f1324', earth: '#1b1f31', boundaries: '#4a5273' },
  light: { background: '#cfdce9', water: '#cfdce9', earth: '#f4f5f7', boundaries: '#aab3c2' }
};
// Fonts liegen ohne Leerzeichen im Bundle, damit kein Pfad kodiert werden muss
const FONT_DIRS = { 'Noto Sans Regular': 'NotoSansRegular', 'Noto Sans Medium': 'NotoSansMedium', 'Noto Sans Italic': 'NotoSansItalic' };

let _map = null;
let _theme = 'dark';
let _lang = 'en';
let _state = 'loading';     // 'loading' | 'ready' | 'fallback'
let _active = null;         // 'remote' | 'local' | 'countries'
let _requested = null;      // zuletzt an MapLibre uebergebener Style
let _remoteWanted = Boolean(REMOTE_URL);
let _remoteStale = false;   // Netzkarte konfiguriert, aber zuletzt nicht erreichbar
let _probing = false;
let _retryTimer = null;
let _retryIdx = 0;
let _localSource = null;
const _listeners = new Set();

export function initMap({ theme = 'dark', timeoutMs = 3000 } = {}) {
  _theme = theme === 'light' ? 'light' : 'dark';
  _lang  = getLang();

  _map = new maplibregl.Map({
    container: 'map',
    style:  { version: 8, sources: {}, layers: [] },
    center: [10, 20],
    zoom:   1.5,
    attributionControl: false
  });
  _map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
  _map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
  _map.on('style.load', _onStyleLoad);

  _installProtocol();

  const ready = new Promise(resolve => {
    const done = () => { clearTimeout(timer); resolve(_map); };
    const timer = setTimeout(done, timeoutMs);
    _map.once('style.load', done);
  });
  _start();
  return ready;
}

export function getMap() { return _map; }

/** Aktueller Kartenzustand: 'loading' | 'ready' | 'fallback'. */
export function getMapState() { return _state; }

/** Ruft callback(state) sofort und bei jedem Wechsel auf. */
export function onMapState(callback) {
  _listeners.add(callback);
  callback(_state);
  return () => _listeners.delete(callback);
}

/** Theme-Wechsel: gleicher Datenstand, andere Farben. */
export function setMapTheme(theme) {
  _theme = theme === 'light' ? 'light' : 'dark';
  _reapply();
}

/** Sprachwechsel: Beschriftungen in der neuen Sprache, wo die Daten sie haben. */
export function setMapLanguage(lang) {
  _lang = lang || 'en';
  _reapply();
}

/** Sofort einen neuen Versuch fuer die Netzkarte, z.B. wenn das Netz zurueck ist. */
export function retryMapStyle() {
  if (!_map || !_remoteWanted || !_remoteStale || _probing) return;
  _retryIdx = 0;
  clearTimeout(_retryTimer);
  _probeRemote();
}

/** Netz weg: auf die gebuendelte Karte wechseln, statt leere Kacheln zu zeigen. */
export function useOfflineMap() {
  if (!_map || _active !== 'remote') return;
  _remoteStale = true;
  _applyLocal();
  _scheduleRetry();
}

/**
 * Loest auf, sobald sich Quellen und Ebenen hinzufuegen lassen. MapLibre
 * wirft sonst "Style is not done loading". isStyleLoaded() wartet auch auf
 * alle Kacheln, das dauert bei schwachem Netz zu lange; getStyle() reicht.
 */
export function whenStyleReady(map = _map) {
  return new Promise(resolve => {
    if (_styleParsed(map)) { resolve(map); return; }
    map.once('style.load', () => resolve(map));
  });
}

// ===== intern =====

function _styleParsed(map) {
  try { return Boolean(map?.getStyle()); } catch { return false; }
}

function _setState(state) {
  if (_state === state) return;
  _state = state;
  _listeners.forEach(cb => { try { cb(state); } catch (err) { console.error(err); } });
}

function _onStyleLoad() {
  if (!_requested) return;
  _active = _requested;
  if (_active === 'remote')               _setState('ready');
  else if (_remoteWanted && _remoteStale) _setState('fallback');
  else                                    _setState('ready');
}

// ----- PMTiles -----

/**
 * Liest die gebuendelte Datei einmal komplett und bedient Bereichsanfragen
 * aus dem Speicher. Range-Anfragen an capacitor://localhost sind nicht
 * verlaesslich, 16 MB im Speicher sind es.
 */
class WholeFileSource {
  constructor(url) { this.url = url; this._buffer = null; this._loading = null; }
  getKey() { return this.url; }
  load() {
    if (this._buffer) return Promise.resolve(this._buffer);
    this._loading ??= fetch(this.url).then(res => {
      if (!res.ok) throw new Error(`basemap ${res.status}`);
      return res.arrayBuffer();
    }).then(buf => { this._buffer = buf; return buf; });
    return this._loading;
  }
  async getBytes(offset, length) {
    const buf = await this.load();
    return { data: buf.slice(offset, offset + length) };
  }
}

let _protocol = null;
function _installProtocol() {
  if (_protocol) return;
  _protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', _protocol.tile);
  _localSource = new WholeFileSource(new URL(LOCAL_BASEMAP, document.baseURI).href);
  _protocol.add(new pmtiles.PMTiles(_localSource));
}

// ----- Styles -----

function _assetUrl(rel) {
  return new URL(rel, document.baseURI).href;
}

function _basemapStyle(sourceUrl, name, attribution) {
  const flavor = { ...namedFlavor(_theme), ...FLAVOR_OVERRIDES[_theme] };
  let lyrs = JSON.stringify(basemapLayers('basemap', flavor, { lang: _lang }));
  for (const [font, dir] of Object.entries(FONT_DIRS)) lyrs = lyrs.split(`"${font}"`).join(`"${dir}"`);
  return {
    version: 8,
    name,
    glyphs: _assetUrl('vendor/basemap-assets/fonts/') + '{fontstack}/{range}.pbf',
    sprite: _assetUrl(`vendor/basemap-assets/sprites/${_theme}`),
    sources: {
      basemap: {
        type: 'vector',
        url: `pmtiles://${sourceUrl}`,
        attribution
      }
    },
    layers: JSON.parse(lyrs)
  };
}

function _setStyle(style, which) {
  _requested = which;
  _map.setStyle(style, { diff: false });
}

async function _start() {
  try {
    await _localSource.load();
  } catch (err) {
    console.error('[TM] bundled basemap missing, using country outlines:', err);
    await _applyCountries();
    return;
  }
  _applyLocal();
  if (_remoteWanted) _probeRemote();
}

function _applyLocal() {
  _setStyle(_basemapStyle(_localSource.getKey(), 'tm-basemap-local', 'Natural Earth'), 'local');
}

function _applyRemote() {
  _setStyle(_basemapStyle(REMOTE_URL, 'tm-basemap-remote', '© OpenStreetMap contributors'), 'remote');
}

async function _applyCountries() {
  let data;
  try {
    data = await loadCountriesGeoJSON();
  } catch (err) {
    console.error('[TM] country outlines missing too:', err);
    return;
  }
  _setStyle(buildFallbackStyle(_theme, data), 'countries');
}

function _reapply() {
  if (!_map || !_active) return;
  if (_active === 'remote')         _applyRemote();
  else if (_active === 'local')     _applyLocal();
  else                              _applyCountries();
}

// Erreichbarkeit der Netzkarte: der PMTiles-Kopf (16 KB) muss innerhalb
// PROBE_MS kommen. Dann uebernimmt sie, sonst bleibt die gebuendelte Karte
// und der naechste Versuch wartet laenger.
async function _probeRemote() {
  if (_probing) return;
  _probing = true;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_MS);
  try {
    const res = await fetch(REMOTE_URL, { headers: { Range: 'bytes=0-16383' }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`remote basemap ${res.status}`);
    const head = new Uint8Array(await res.arrayBuffer());
    if (String.fromCharCode(...head.slice(0, 7)) !== 'PMTiles') throw new Error('not a PMTiles file');
    _remoteStale = false;
    _retryIdx = 0;
    _applyRemote();
  } catch (err) {
    console.warn('[TM] remote basemap unavailable, keeping bundled map:', err?.message ?? err);
    _remoteStale = true;
    if (_active === 'local') _setState('fallback');
    _scheduleRetry();
  } finally {
    clearTimeout(timer);
    _probing = false;
  }
}

function _scheduleRetry() {
  if (!_remoteWanted) return;
  clearTimeout(_retryTimer);
  const wait = RETRY_MS[Math.min(_retryIdx, RETRY_MS.length - 1)];
  _retryIdx++;
  _retryTimer = setTimeout(() => {
    if (!_map || !_remoteStale || _probing) return;
    _probeRemote();
  }, wait);
}
