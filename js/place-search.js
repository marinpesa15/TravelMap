// Reine Suchlogik ueber den lokalen Ortsdatensatz (data/places.json).
// Kein DOM, kein Netz, damit sie testbar bleibt. Das Laden steckt in places.js.
//
// Zeilenformat aus scripts/build-places.mjs:
//   Ort:  [name, nameDe, lat, lng, laendercode, einwohner]
//   Land: [iso, name, nameDe]

/**
 * Klein schreiben und Akzente entfernen, damit "Muenchen", "munchen" und
 * "München" dieselbe Zeile treffen. ß wird zu ss, sonst findet "Gießen"
 * nichts, wenn jemand "giessen" tippt.
 */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/**
 * Baut den Suchindex einmalig auf: je Zeile die normalisierten Namen.
 * Die Zeilen kommen nach Einwohnern sortiert an, deshalb reicht spaeter die
 * Reihenfolge als Rangfolge.
 */
export function buildCityIndex(rows) {
  return rows.map(row => ({ row, keys: [normalize(row[0]), row[1] ? normalize(row[1]) : ''].filter(Boolean) }));
}

export function buildCountryIndex(rows) {
  return rows.map(row => ({ row, keys: [normalize(row[1]), row[2] ? normalize(row[2]) : ''].filter(Boolean) }));
}

// Treffer am Wortanfang stehen vor Treffern mitten im Namen: wer "san" tippt,
// will San Francisco sehen und nicht Busan.
function rank(keys, needle) {
  let best = null;
  for (const key of keys) {
    if (key.startsWith(needle)) return 0;
    const at = key.indexOf(' ' + needle);
    if (at !== -1) best = best === null ? 1 : Math.min(best, 1);
    else if (key.includes(needle)) best = best === null ? 2 : best;
  }
  return best;
}

function pick(index, query, limit, toResult) {
  const needle = normalize(query);
  if (needle.length < 2) return [];
  const buckets = [[], [], []];
  for (const entry of index) {
    const score = rank(entry.keys, needle);
    if (score === null) continue;
    buckets[score].push(entry.row);
    // Genug perfekte Treffer? Dann nicht weiter durch 70.000 Zeilen laufen.
    if (buckets[0].length >= limit) break;
  }
  return [...buckets[0], ...buckets[1], ...buckets[2]].slice(0, limit).map(toResult);
}

/** @returns {{name, lat, lng, country, population}[]} */
export function searchCityRows(index, query, { limit = 5, lang = 'en' } = {}) {
  return pick(index, query, limit, row => ({
    name:       lang === 'de' && row[1] ? row[1] : row[0],
    lat:        row[2],
    lng:        row[3],
    country:    row[4],
    population: row[5]
  }));
}

/** @returns {{name, isoCode}[]} */
export function searchCountryRows(index, query, { limit = 8, lang = 'en' } = {}) {
  return pick(index, query, limit, row => ({
    isoCode: row[0],
    name:    lang === 'de' && row[2] ? row[2] : row[1]
  }));
}
