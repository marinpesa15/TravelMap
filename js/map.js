import { MAPBOX_TOKEN } from './constants.js?v=12';
import { loadCountriesGeoJSON } from './countries.js?v=24';
import { buildFallbackStyle } from './fallback-style.js?v=1';

// ===== Karte =====
//
// Der Mapbox-Style kommt vom Server. Ohne Netz oder bei schwachem Empfang
// kam frueher nichts, die Karte blieb schwarz und der ganze Start wartete
// auf das 'load'-Ereignis. Jetzt gilt:
//
// - Die Karte startet mit einem leeren Style und loest sofort auf. Pins
//   lassen sich setzen, bevor irgendein Style vom Server da ist.
// - Das Style-JSON holt die App selbst (fetch) und gibt es Mapbox erst,
//   wenn es vollstaendig da ist. So bleibt waehrend eines Versuchs immer
//   das stehen, was gerade sichtbar ist; ein gescheiterter Versuch
//   flackert nicht. Mapbox selbst wuerde bei setStyle(url) ohne
//   'style.load' per Diff umbauen und dabei eigene Ebenen stumm loeschen.
// - Dauert der Server laenger als SLOW_MS oder scheitert er, kommt die
//   Offline-Karte aus js/fallback-style.js. Der Server-Style wird mit
//   wachsendem Abstand erneut versucht und ersetzt sie, sobald er da ist.
// - Der Zustand (loading, ready, fallback) geht an die Oberflaeche.

const REMOTE_STYLE = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark:  'mapbox://styles/mapbox/dark-v11'
};
const BLANK_STYLE = { version: 8, sources: {}, layers: [] };
const SLOW_MS  = 2500;
const RETRY_MS = [2000, 4000, 8000, 16000, 32000];

let _map = null;
let _theme = 'dark';
let _state = 'loading';        // 'loading' | 'ready' | 'fallback'
let _requested = 'blank';      // welches Style zuletzt an Mapbox ging
let _pendingRemote = false;    // Server-Style angefragt, Antwort steht aus
let _remoteStale = true;       // Server-Style der aktuellen Farbe fehlt noch
let _fallbackActive = false;
let _fallbackTicket = 0;
let _abort = null;
let _slowTimer = null;
let _retryTimer = null;
let _retryIdx = 0;
const _listeners = new Set();

export function initMap({ theme = 'dark', timeoutMs = 3000 } = {}) {
  _theme = REMOTE_STYLE[theme] ? theme : 'dark';
  mapboxgl.accessToken = MAPBOX_TOKEN;

  _map = new mapboxgl.Map({
    container: 'map',
    style:  BLANK_STYLE,
    center: [10, 20],
    zoom:   1.5
  });
  _map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
  _map.on('style.load', _onStyleLoad);

  const ready = new Promise(resolve => {
    const done = () => { clearTimeout(timer); resolve(_map); };
    const timer = setTimeout(done, timeoutMs);
    _map.once('style.load', done);
  });
  _requestRemote();
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

/** Theme-Wechsel: Server-Style der neuen Farbe holen, offline die Offline-Karte umfaerben. */
export function setMapTheme(theme) {
  _theme = REMOTE_STYLE[theme] ? theme : 'dark';
  if (!_map) return;
  _remoteStale = true;
  if (_fallbackActive) _applyFallback();
  _retryIdx = 0;
  _requestRemote();
}

/** Sofort einen neuen Versuch fuer den Server-Style, z.B. wenn das Netz zurueck ist. */
export function retryMapStyle() {
  if (!_map || !_remoteStale || _pendingRemote) return;
  _retryIdx = 0;
  _requestRemote();
}

/**
 * Loest auf, sobald sich Quellen und Ebenen hinzufuegen lassen. Mapbox
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
  if (_requested === 'remote')        _setState('ready');
  else if (_requested === 'fallback') _setState('fallback');
  // 'blank': der leere Startstyle, Zustand bleibt 'loading'
}

function _styleUrl(theme) {
  const mapboxUrl = REMOTE_STYLE[theme];
  // Mapbox haengt sdk= und den Token selbst an; die eigene Normalisierung
  // ist privat, deshalb mit Ersatz, falls sie in einer Version fehlt.
  try {
    const url = _map?._requestManager?.normalizeStyleURL?.(mapboxUrl);
    if (typeof url === 'string' && url.startsWith('http')) return url;
  } catch { /* unten */ }
  const id = mapboxUrl.replace('mapbox://styles/', '');
  return `https://api.mapbox.com/styles/v1/${id}?sdk=js-3.4.0&access_token=${encodeURIComponent(MAPBOX_TOKEN)}`;
}

async function _fetchStyle(theme, signal) {
  const res = await fetch(_styleUrl(theme), { signal });
  if (!res.ok) throw new Error(`style request failed: ${res.status}`);
  return res.json();
}

function _requestRemote() {
  if (!_map) return;
  if (_abort) _abort.abort();
  const ctrl = new AbortController();
  _abort = ctrl;
  _pendingRemote = true;
  clearTimeout(_retryTimer);

  // Laesst der Server auf sich warten, soll die Karte nicht leer bleiben.
  clearTimeout(_slowTimer);
  _slowTimer = setTimeout(() => {
    if (_pendingRemote && _state !== 'ready') _applyFallback();
  }, SLOW_MS);

  const theme = _theme;
  _fetchStyle(theme, ctrl.signal).then(json => {
    if (ctrl !== _abort) return; // inzwischen ueberholt
    clearTimeout(_slowTimer);
    _pendingRemote = false;
    _remoteStale = false;
    _retryIdx = 0;
    _fallbackActive = false;
    _fallbackTicket++; // eine noch ausstehende Offline-Karte verwerfen
    _requested = 'remote';
    _map.setStyle(json, { diff: false });
  }).catch(err => {
    if (ctrl !== _abort) return;
    clearTimeout(_slowTimer);
    _pendingRemote = false;
    console.warn('[TM] map style unavailable, keeping offline map:', err?.message ?? err);
    if (_state !== 'ready') _applyFallback();
    _scheduleRetry();
  });
}

async function _applyFallback() {
  const ticket = ++_fallbackTicket;
  _fallbackActive = true;
  let data;
  try {
    data = await loadCountriesGeoJSON();
  } catch (err) {
    console.error('[TM] offline map data missing:', err);
    return;
  }
  if (ticket !== _fallbackTicket || !_map || !_fallbackActive) return;
  _requested = 'fallback';
  _map.setStyle(buildFallbackStyle(_theme, data), { diff: false });
}

function _scheduleRetry() {
  clearTimeout(_retryTimer);
  const wait = RETRY_MS[Math.min(_retryIdx, RETRY_MS.length - 1)];
  _retryIdx++;
  _retryTimer = setTimeout(() => {
    if (!_map || !_remoteStale || _pendingRemote) return;
    _requestRemote();
  }, wait);
}
