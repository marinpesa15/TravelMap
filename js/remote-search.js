// Online-Suche ueber die Mapbox Search Box API.
//
// Warum nicht mehr Geocoding v5: das kannte mit `types=place` nur Staedte.
// Nationalparks, Inseln, Straende und Regionen (Khao Sok, Ko Muk, Bali)
// fand es gar nicht oder nur unter dem Thai-Namen. Die Search Box API kennt
// solche Orte als POIs, sortiert POIs aber nach IP-Naehe, deshalb kaemen
// ohne Filter zuerst Thai-Restaurants aus der eigenen Stadt. POI_CATEGORIES
// begrenzt POIs auf Natur, Orte und Regionen bleiben ungefiltert.
//
// Ablauf: `suggest` liefert Vorschlaege ohne Koordinaten, erst `retrieve`
// mit der Mapbox-ID gibt den Punkt. Beide Aufrufe teilen sich ein
// session_token, Mapbox rechnet so pro Suchsitzung ab, nicht pro Tastendruck.
import { MAPBOX_TOKEN } from './constants.js?v=12';

const BASE = 'https://api.mapbox.com/search/searchbox/v1';

export const TYPES = ['place', 'locality', 'region', 'poi'];

// Kanonische IDs aus /search/searchbox/v1/list/category. "park",
// "tourist_attraction" und "historic_site" fehlen absichtlich: damit kamen
// Spielplaetze und Denkmaeler aus der Nachbarschaft vor dem gesuchten Ort.
export const POI_CATEGORIES = [
  'national_park', 'state_park', 'nature_reserve', 'island', 'beach',
  'lake', 'mountain', 'waterfall', 'forest', 'coastal', 'cave'
];

export function buildSuggestUrl(query, { lang = 'en', session, limit = 5, token = MAPBOX_TOKEN } = {}) {
  const params = new URLSearchParams({
    q:             query,
    types:         TYPES.join(','),
    poi_category:  POI_CATEGORIES.join(','),
    language:      lang,
    limit:         String(limit),
    session_token: session,
    access_token:  token
  });
  return `${BASE}/suggest?${params}`;
}

export function buildRetrieveUrl(mapboxId, { session, token = MAPBOX_TOKEN } = {}) {
  const params = new URLSearchParams({ session_token: session, access_token: token });
  return `${BASE}/retrieve/${encodeURIComponent(mapboxId)}?${params}`;
}

function countryOf(props) {
  return props?.context?.country?.country_code?.toUpperCase() || 'XX';
}

/** @returns {{name, label, country, mapboxId}[]} */
export function parseSuggestions(data) {
  return (data?.suggestions ?? [])
    .filter(s => s && s.name && s.mapbox_id)
    .map(s => ({
      name:     s.name,
      label:    s.place_formatted ? `${s.name}, ${s.place_formatted}` : s.name,
      country:  countryOf(s),
      mapboxId: s.mapbox_id
    }));
}

/** @returns {{name, lat, lng, country} | null} */
export function parseRetrieved(data) {
  const feature = data?.features?.[0];
  const coords  = feature?.properties?.coordinates ?? null;
  const [lng, lat] = feature?.geometry?.coordinates ?? [coords?.longitude, coords?.latitude];
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return { name: feature.properties?.name ?? '', lat, lng, country: countryOf(feature.properties) };
}

// ===== Sitzung =====

let _session = null;

function newSessionToken() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function session() {
  if (!_session) _session = newSessionToken();
  return _session;
}

/** Vorschlaege zum Suchtext, ohne Koordinaten. */
export async function suggestPlaces(query, { lang = 'en', signal } = {}) {
  const res = await fetch(buildSuggestUrl(query, { lang, session: session() }), { signal });
  if (!res.ok) throw new Error(`Search Box suggest ${res.status}`);
  return parseSuggestions(await res.json());
}

/** Koordinaten zu einem Vorschlag. Schliesst die Suchsitzung ab. */
export async function retrievePlace(mapboxId) {
  const res = await fetch(buildRetrieveUrl(mapboxId, { session: session() }));
  _session = null;
  if (!res.ok) throw new Error(`Search Box retrieve ${res.status}`);
  return parseRetrieved(await res.json());
}
