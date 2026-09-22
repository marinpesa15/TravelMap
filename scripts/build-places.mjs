// Baut data/places.json aus den GeoNames-Dumps.
//
// Warum ueberhaupt eigene Daten: Die Suche lief nur ueber die Mapbox-Geocoding-
// API. Ohne Netz gab es damit keine Treffer, man konnte offline also keinen
// neuen Ort eintragen. Diese Datei liegt mit im App-Bundle und beantwortet die
// Suche lokal; online werden Mapbox-Treffer nur noch ergaenzt.
//
// Quelle: GeoNames (https://www.geonames.org), lizenziert unter CC BY 4.0.
// Die Namensnennung steht in der App unter Einstellungen und in privacy.html.
//
// Aufruf: node scripts/build-places.mjs
// Dauert einige Minuten, alternateNamesV2.txt ist ueber ein Gigabyte gross.

import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT  = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'geonames');
const OUT   = join(ROOT, 'data', 'places.json');

// Ab 5000 Einwohnern, so entschieden: rund 55.000 Orte weltweit.
const CITIES_DUMP = 'cities5000';
const LANGS = new Set(['de', 'en']);

function ensure(file, url, { zipped = false } = {}) {
  const target = join(CACHE, file);
  if (existsSync(target) && statSync(target).size > 0) {
    console.log(`  ${file} liegt schon im Cache`);
    return target;
  }
  mkdirSync(CACHE, { recursive: true });
  if (zipped) {
    const zip = `${target}.zip`;
    console.log(`  lade ${url}`);
    execFileSync('curl', ['-sSL', '-o', zip, url]);
    execFileSync('unzip', ['-o', '-q', zip, '-d', CACHE]);
  } else {
    console.log(`  lade ${url}`);
    execFileSync('curl', ['-sSL', '-o', target, url]);
  }
  return target;
}

async function eachLine(file, fn) {
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) fn(line);
}

const round = n => Math.round(n * 1e4) / 1e4;

console.log('1. Dumps holen');
const citiesFile    = ensure(`${CITIES_DUMP}.txt`, `https://download.geonames.org/export/dump/${CITIES_DUMP}.zip`, { zipped: true });
const countriesFile = ensure('countryInfo.txt', 'https://download.geonames.org/export/dump/countryInfo.txt');
const altFile       = ensure('alternateNamesV2.txt', 'https://download.geonames.org/export/dump/alternateNamesV2.zip', { zipped: true });

console.log('2. Orte lesen');
// Spalten laut https://download.geonames.org/export/dump/readme.txt
const cities = new Map(); // geonameId -> { name, lat, lng, cc, pop }
await eachLine(citiesFile, line => {
  const c = line.split('\t');
  if (c.length < 15) return;
  cities.set(c[0], {
    name: c[1],
    lat:  round(Number(c[4])),
    lng:  round(Number(c[5])),
    cc:   c[8],
    pop:  Number(c[14]) || 0
  });
});
console.log(`   ${cities.size} Orte`);

console.log('3. Laender lesen');
const countries = new Map(); // geonameId -> { iso, name }
await eachLine(countriesFile, line => {
  if (line.startsWith('#')) return;
  const c = line.split('\t');
  if (c.length < 17 || c[0].length !== 2) return;
  countries.set(c[16], { iso: c[0], name: c[4] });
});
console.log(`   ${countries.size} Laender`);

console.log('4. Deutsche und englische Namen zuordnen (grosse Datei, dauert)');
const altNames = new Map(); // geonameId -> { de, en }
await eachLine(altFile, line => {
  const c = line.split('\t');
  if (c.length < 5) return;
  const [, geonameId, lang, name, isPreferred] = c;
  if (!LANGS.has(lang)) return;
  if (!cities.has(geonameId) && !countries.has(geonameId)) return;
  const entry = altNames.get(geonameId) ?? {};
  // Bevorzugte Namen gewinnen, sonst der erste Treffer.
  if (!entry[lang] || isPreferred === '1') entry[lang] = name;
  altNames.set(geonameId, entry);
});
console.log(`   ${altNames.size} Eintraege mit deutschem oder englischem Namen`);

console.log('5. Schreiben');
// Kompakte Arrays statt Objekte: spart bei 55.000 Zeilen ein Vielfaches an Bytes.
// [name, nameDe, lat, lng, laendercode, einwohner]
const cityRows = [...cities.entries()].map(([id, c]) => {
  const alt = altNames.get(id) ?? {};
  const name = alt.en || c.name;
  const de   = alt.de && alt.de !== name ? alt.de : '';
  return [name, de, c.lat, c.lng, c.cc, c.pop];
}).sort((a, b) => b[5] - a[5]); // nach Einwohnern, die Suche nimmt den ersten Treffer

const countryRows = [...countries.entries()].map(([id, c]) => {
  const alt = altNames.get(id) ?? {};
  const name = alt.en || c.name;
  const de   = alt.de && alt.de !== name ? alt.de : '';
  return [c.iso, name, de];
}).sort((a, b) => a[1].localeCompare(b[1]));

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({
  version: 1,
  source: 'GeoNames (https://www.geonames.org), CC BY 4.0',
  built: new Date().toISOString().slice(0, 10),
  cities: cityRows,
  countries: countryRows
}));
const mb = (statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`   data/places.json: ${cityRows.length} Orte, ${countryRows.length} Laender, ${mb} MB`);
