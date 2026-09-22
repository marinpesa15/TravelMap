import { describe, it, expect } from 'vitest';
import {
  normalize, buildCityIndex, buildCountryIndex, searchCityRows, searchCountryRows
} from '../js/place-search.js';

// Auszug im Format aus scripts/build-places.mjs, nach Einwohnern sortiert.
const CITIES = [
  ['Moscow',        'Moskau',   55.7522, 37.6156, 'RU', 10381222],
  ['Munich',        'München',  48.1374, 11.5755, 'DE',  1505005],
  ['San Francisco', '',         37.7749, -122.419, 'US',  864816],
  ['Busan',         '',         35.1028, 129.0403, 'KR',  3678555],
  ['Split',         '',         43.5089,  16.4392, 'HR',   149830],
  ['Giessen',       'Gießen',   50.5871,   8.6785, 'DE',    76000]
];
const COUNTRIES = [
  ['HR', 'Croatia', 'Kroatien'],
  ['DE', 'Germany', 'Deutschland'],
  ['RU', 'Russia',  'Russland']
];

const cityIndex = buildCityIndex(CITIES);
const countryIndex = buildCountryIndex(COUNTRIES);
const names = res => res.map(r => r.name);

describe('normalize', () => {
  it('macht Akzente und Umlaute vergleichbar', () => {
    expect(normalize('München')).toBe('munchen');
    expect(normalize('Gießen')).toBe('giessen');
    expect(normalize('  Split ')).toBe('split');
  });
});

describe('Staedtesuche', () => {
  it('findet den englischen Namen', () => {
    expect(names(searchCityRows(cityIndex, 'munich'))).toContain('Munich');
  });

  it('findet denselben Ort ueber den deutschen Namen', () => {
    expect(names(searchCityRows(cityIndex, 'münchen'))).toContain('Munich');
    expect(names(searchCityRows(cityIndex, 'muenchen'))).toEqual([]); // ue-Schreibweise deckt GeoNames nicht ab
    expect(names(searchCityRows(cityIndex, 'moskau'))).toContain('Moscow');
  });

  it('zeigt in deutscher Oberflaeche den deutschen Namen', () => {
    expect(names(searchCityRows(cityIndex, 'munich', { lang: 'de' }))).toContain('München');
    // Ohne deutschen Namen bleibt der Standardname stehen
    expect(names(searchCityRows(cityIndex, 'split', { lang: 'de' }))).toContain('Split');
  });

  it('stellt Treffer am Wortanfang voran', () => {
    // "san" steckt auch in Busan, San Francisco muss trotzdem zuerst kommen
    expect(names(searchCityRows(cityIndex, 'san'))[0]).toBe('San Francisco');
  });

  it('liefert Koordinaten und Laendercode fuer den Eintrag', () => {
    const [hit] = searchCityRows(cityIndex, 'split');
    expect(hit).toMatchObject({ lat: 43.5089, lng: 16.4392, country: 'HR' });
  });

  it('ignoriert zu kurze Eingaben und haelt das Limit ein', () => {
    expect(searchCityRows(cityIndex, 'm')).toEqual([]);
    expect(searchCityRows(cityIndex, 's', { limit: 2 })).toEqual([]);
    expect(searchCityRows(cityIndex, 'sa', { limit: 1 })).toHaveLength(1);
  });
});

describe('Laendersuche', () => {
  it('findet englisch und deutsch', () => {
    expect(searchCountryRows(countryIndex, 'kroat')[0]).toMatchObject({ isoCode: 'HR' });
    expect(searchCountryRows(countryIndex, 'germ')[0]).toMatchObject({ isoCode: 'DE' });
  });

  it('gibt in deutscher Oberflaeche den deutschen Namen aus', () => {
    expect(searchCountryRows(countryIndex, 'deutsch', { lang: 'de' })[0].name).toBe('Deutschland');
  });
});
