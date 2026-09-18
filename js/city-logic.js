// Reine Logik fuer Staedte-Aenderungen, ohne Firestore-Zugriff, damit sie
// sich ohne Emulator testen laesst. db.js wendet das Ergebnis in einer
// Transaktion an.

/**
 * Plant die Umwandlung einer Wunsch-Stadt in eine besuchte Stadt.
 * Liefert die zu schreibenden Felder oder null, wenn die Stadt nicht auf der
 * Wunschliste steht (z. B. schon auf einem anderen Geraet umgewandelt).
 *
 * Abgleich ueber den Namen statt arrayRemove, weil arrayRemove exakte
 * Objektgleichheit braucht (wie removeWishlistCity in db.js).
 * Defaults wie beim normalen Hinzufuegen in app.js: lived = false, und das
 * Land der Stadt wird besucht (und verlaesst die Laender-Wunschliste).
 */
export function planMarkWishlistCityVisited(data, cityName) {
  const wishlist = data.wishlist_cities ?? [];
  const visited  = data.visited_cities  ?? [];
  const city = wishlist.find(c => c.name === cityName);
  if (!city) return null;

  const alreadyVisited = visited.some(c => c.name === cityName);
  const plan = {
    visited_cities:  alreadyVisited ? visited : [...visited, { ...city, lived: false }],
    wishlist_cities: wishlist.filter(c => c.name !== cityName)
  };

  const iso = city.country;
  if (iso && iso !== 'XX') {
    const countries = data.visited_countries ?? [];
    plan.visited_countries  = countries.includes(iso) ? countries : [...countries, iso];
    plan.wishlist_countries = (data.wishlist_countries ?? []).filter(c => c !== iso);
  }
  return plan;
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
