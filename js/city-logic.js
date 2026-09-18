// Reine Logik fuer Staedte-Aenderungen, ohne Firestore-Zugriff, damit sie
// sich ohne Emulator testen laesst. db.js wendet das Ergebnis in einer
// Transaktion an.
//
// Staedte werden durchgehend ueber den Namen abgeglichen statt ueber
// arrayUnion/arrayRemove, weil die exakte Objektgleichheit brauchen
// (wie removeWishlistCity in db.js). Ein Suchergebnis und ein alter Eintrag
// derselben Stadt unterscheiden sich oft in Koordinaten oder Zusatzfeldern.

/**
 * Felder, die ein besuchtes Land nachziehen: Land in visited_countries,
 * raus aus wishlist_countries. Leer, wenn die Stadt kein Land hat.
 */
function planVisitCountry(data, iso) {
  if (!iso || iso === 'XX') return {};
  const countries = data.visited_countries ?? [];
  return {
    visited_countries:  countries.includes(iso) ? countries : [...countries, iso],
    wishlist_countries: (data.wishlist_countries ?? []).filter(c => c !== iso)
  };
}

/**
 * Plant die Umwandlung einer Wunsch-Stadt in eine besuchte Stadt.
 * Liefert die zu schreibenden Felder oder null, wenn die Stadt nicht auf der
 * Wunschliste steht (z. B. schon auf einem anderen Geraet umgewandelt).
 *
 * Defaults wie beim normalen Hinzufuegen in app.js: lived = false, und das
 * Land der Stadt wird besucht (und verlaesst die Laender-Wunschliste).
 */
export function planMarkWishlistCityVisited(data, cityName) {
  const wishlist = data.wishlist_cities ?? [];
  const visited  = data.visited_cities  ?? [];
  const city = wishlist.find(c => c.name === cityName);
  if (!city) return null;

  const alreadyVisited = visited.some(c => c.name === cityName);
  return {
    visited_cities:  alreadyVisited ? visited : [...visited, { ...city, lived: false }],
    wishlist_cities: wishlist.filter(c => c.name !== cityName),
    ...planVisitCountry(data, city.country)
  };
}

/**
 * Plant das Hinzufuegen einer besuchten Stadt aus der Suche.
 * cityData: { name, lat, lng, country, lived }
 * Eine gleichnamige Wunsch-Stadt verschwindet von der Wunschliste. Ist die
 * Stadt schon besucht, wird der Eintrag an seiner Stelle ersetzt (neuer
 * lived-Wert) statt verdoppelt. Das Land wird mit besucht.
 */
export function planAddVisitedCity(data, cityData) {
  const visited = data.visited_cities ?? [];
  const index = visited.findIndex(c => c.name === cityData.name);
  return {
    visited_cities: index === -1
      ? [...visited, cityData]
      : visited.map((c, i) => (i === index ? cityData : c)),
    wishlist_cities: (data.wishlist_cities ?? []).filter(c => c.name !== cityData.name),
    ...planVisitCountry(data, cityData.country)
  };
}

/**
 * Plant das Hinzufuegen einer Wunsch-Stadt aus der Suche.
 * cityData: { name, lat, lng, country }
 * Liefert { status: 'alreadyVisited' } fuer eine schon besuchte Stadt (die
 * bleibt unangetastet, lived geht nicht verloren), { status: 'unchanged' }
 * wenn sie schon auf der Wunschliste steht, sonst
 * { status: 'added', update }.
 */
export function planAddWishlistCity(data, cityData) {
  const wishlist = data.wishlist_cities ?? [];
  if ((data.visited_cities ?? []).some(c => c.name === cityData.name)) {
    return { status: 'alreadyVisited' };
  }
  if (wishlist.some(c => c.name === cityData.name)) return { status: 'unchanged' };
  return { status: 'added', update: { wishlist_cities: [...wishlist, cityData] } };
}

/**
 * Plant das Aufraeumen alter Doppel-Eintraege: Wunsch-Staedte, die auch
 * besucht sind, fliegen von der Wunschliste. null, wenn es nichts zu tun gibt.
 */
export function planDedupeCities(data) {
  const visitedNames = new Set((data.visited_cities ?? []).map(c => c.name));
  const wishlist = data.wishlist_cities ?? [];
  const cleaned = wishlist.filter(c => !visitedNames.has(c.name));
  return cleaned.length === wishlist.length ? null : { wishlist_cities: cleaned };
}

/**
 * Gruppen-Variante: verschiebt eine Wunsch-Stadt der Gruppe nach
 * visited_cities. addedBy wird das umwandelnde Mitglied, weil der Pin zeigt,
 * wer dort war (und die Kontoloeschung Pins ueber addedBy.uid zuordnet).
 * Steht die Stadt schon als besucht drin (anderes Mitglied), bleibt dieser
 * Pin wie er ist und nur der Wunsch verschwindet. Gruppen kennen keine
 * Laender, deshalb nur die beiden Staedte-Felder.
 */
export function planMarkGroupWishlistCityVisited(data, cityName, addedBy) {
  const wishlist = data.wishlist_cities ?? [];
  const visited  = data.visited_cities  ?? [];
  const city = wishlist.find(c => c.name === cityName);
  if (!city) return null;

  const alreadyVisited = visited.some(c => c.name === cityName);
  return {
    visited_cities:  alreadyVisited ? visited : [...visited, { ...city, lived: false, addedBy }],
    wishlist_cities: wishlist.filter(c => c.name !== cityName)
  };
}
