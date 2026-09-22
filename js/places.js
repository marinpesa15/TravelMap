// Laedt den lokalen Ortsdatensatz und beantwortet damit die Suche.
//
// Warum lokal: Ohne Netz lieferte die Mapbox-Geocoding-API nichts, man konnte
// offline also keinen neuen Ort eintragen. data/places.json liegt im Bundle
// und wird beim ersten Tippen einmal geladen (rund 3 MB, danach im Speicher).
//
// Daten: GeoNames (https://www.geonames.org), CC BY 4.0. Siehe privacy.html.
import {
  buildCityIndex, buildCountryIndex, searchCityRows, searchCountryRows
} from './place-search.js?v=1';
import { getLang } from './i18n.js?v=7';

const DATA_URL = '../data/places.json?v=1';

let _loading = null;
let _cityIndex = null;
let _countryIndex = null;
let _countryNames = null; // ISO -> { name, de }

/**
 * Laedt die Datei genau einmal. Ein gescheiterter Versuch wird nicht
 * zwischengespeichert, damit es beim naechsten Tippen erneut geht.
 */
export function loadPlaces() {
  if (_cityIndex) return Promise.resolve();
  if (_loading) return _loading;
  _loading = fetch(new URL(DATA_URL, import.meta.url))
    .then(res => {
      if (!res.ok) throw new Error(`places.json: ${res.status}`);
      return res.json();
    })
    .then(data => {
      _cityIndex    = buildCityIndex(data.cities ?? []);
      _countryIndex = buildCountryIndex(data.countries ?? []);
      _countryNames = new Map((data.countries ?? []).map(([iso, name, de]) => [iso, { name, de }]));
    })
    .catch(err => {
      _loading = null;
      throw err;
    });
  return _loading;
}

/** Landesname in der Oberflaechensprache, sonst der Laendercode. */
export function countryName(iso) {
  const entry = _countryNames?.get(iso);
  if (!entry) return iso;
  return getLang() === 'de' && entry.de ? entry.de : entry.name;
}

export async function searchLocalCities(query, limit = 5) {
  await loadPlaces();
  return searchCityRows(_cityIndex, query, { limit, lang: getLang() })
    .map(city => ({ ...city, label: `${city.name}, ${countryName(city.country)}` }));
}

export async function searchLocalCountries(query, limit = 8) {
  await loadPlaces();
  return searchCountryRows(_countryIndex, query, { limit, lang: getLang() });
}
