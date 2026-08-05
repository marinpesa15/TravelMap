// Orchestrierung der Kontoloeschung.
//
// Die Reihenfolge ist die eigentliche Sicherheitsmassnahme: Der Auth-Account
// faellt zuletzt. Bricht es vorher ab, existiert das Konto noch und der
// Nutzer kann es erneut anstossen. Andersherum waere es fatal, denn ohne
// Konto fehlt die Berechtigung, die eigenen Reste zu loeschen.
import { planGroupChange } from './account-logic.js?v=1';
import { firestoreIo } from './account-io.js?v=1';

/** Zahlen fuer die Warnung, bevor irgendetwas veraendert wird. */
export async function collectDeletionSummary(uid, { io = firestoreIo } = {}) {
  const [user, friendUids, groups] = await Promise.all([
    io.loadUser(uid), io.loadFriendUids(uid), io.loadMyGroups(uid)
  ]);
  const u = user ?? {};
  return {
    cities:    (u.visited_cities    ?? []).length + (u.wishlist_cities    ?? []).length,
    countries: (u.visited_countries ?? []).length + (u.wishlist_countries ?? []).length,
    friends:   friendUids.length,
    groups:    groups.length
  };
}

/**
 * Loescht Konto und zugehoerige Daten. Jeder Schritt vertraegt "ist schon
 * weg", der Ablauf ist also wiederholbar.
 *
 * @param {string} uid
 * @param {{io?: object, onProgress?: (schritt: string) => void}} [opts]
 */
export async function deleteAccount(uid, { io = firestoreIo, onProgress = () => {} } = {}) {
  // 1. Frische Anmeldung. Schlaegt sie fehl, ist noch nichts passiert.
  await io.reauthenticate();

  // 2. Profil lesen, solange es noch existiert. Das Invite-Token steht dort.
  onProgress('profile');
  const user = await io.loadUser(uid);

  // 3. Gruppen. Je Gruppe eine Transaktion: Der Plan wird auf dem frisch
  //    gelesenen Stand berechnet, damit parallele Aenderungen anderer
  //    Mitglieder nicht ueberschrieben werden.
  onProgress('groups');
  const groups = await io.loadMyGroups(uid);
  for (const group of groups) {
    await io.applyGroupChange(group.id, g => {
      // Schon ausgetreten (frueherer Versuch): Ein Update waere unnoetig und
      // wuerde von den Rules abgelehnt, weil ich kein Mitglied mehr bin.
      if (!(g.members ?? []).includes(uid)) return null;
      return planGroupChange(g, uid);
    });
  }

  // 4. Freundschaften, beide Richtungen. Muss vor dem User-Doc laufen:
  //    Firestore loescht Subcollections NICHT mit dem Dokument mit, sonst
  //    bliebe users/{uid}/friends/* verwaist und unerreichbar zurueck.
  onProgress('friends');
  const friendUids = await io.loadFriendUids(uid);
  if (friendUids.length) await io.deleteFriendPairs(uid, friendUids);

  // 5. Invite-Doc.
  onProgress('invite');
  if (user?.invite_token) await io.deleteInvite(user.invite_token);

  // 6. User-Doc. Nimmt Staedte, Laender, Consent und Profil mit, weil alles
  //    als Felder im Dokument liegt.
  onProgress('profileDoc');
  await io.deleteUserDoc(uid);

  // 7. Zuletzt der Auth-Account.
  onProgress('account');
  await io.deleteAuthUser();
}
