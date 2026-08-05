// Reine Entscheidungslogik der Kontoloeschung. Kein Firebase, kein DOM.
// Liegt bewusst getrennt, weil hier die Faelle stecken, in denen ein Fehler
// fremde Daten zerstoert.

/**
 * Entfernt die Staedte, die `myUid` beigetragen hat.
 * Staedte ohne `addedBy` stammen aus der Zeit vor den personalisierten
 * Gruppen-Pins und lassen sich niemandem zuordnen. Sie bleiben stehen.
 */
export function stripMyCities(cities, myUid) {
  return (cities ?? []).filter(c => c?.addedBy?.uid !== myUid);
}

/**
 * Entscheidet, was mit einer Gruppe passiert, wenn `myUid` sein Konto loescht.
 *
 * Ersteller uebergeben an das erste verbleibende Mitglied statt die Gruppe zu
 * loeschen. Sonst blieben entweder fremde Daten auf der Strecke oder eine
 * Gruppe mit totem Ersteller zurueck, die niemand mehr loeschen kann.
 *
 * @returns {{action: 'delete'}|{action: 'update', data: object}}
 */
export function planGroupChange(group, myUid) {
  const remaining = (group.members ?? []).filter(uid => uid !== myUid);
  if (remaining.length === 0) return { action: 'delete' };

  const data = {
    members: remaining,
    visited_cities:  stripMyCities(group.visited_cities,  myUid),
    wishlist_cities: stripMyCities(group.wishlist_cities, myUid)
  };
  // Nur der Ersteller uebergibt. Bei allen anderen bleibt created_by
  // unveraendert, sonst wuerde die Security Rule die Aenderung ablehnen.
  if (group.created_by === myUid) data.created_by = remaining[0];
  return { action: 'update', data };
}
