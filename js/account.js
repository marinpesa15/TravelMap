// Orchestrierung der Kontoloeschung.
//
// Die Reihenfolge ist die eigentliche Sicherheitsmassnahme: Der Auth-Account
// faellt zuletzt. Bricht es vorher ab, existiert das Konto noch und der
// Nutzer kann es erneut anstossen. Andersherum waere es fatal, denn ohne
// Konto fehlt die Berechtigung, die eigenen Reste zu loeschen.
import { planGroupChange } from './account-logic.js?v=1';
import { storyPaths } from './story-logic.js?v=1';
import { firestoreIo } from './account-io.js?v=10';

/** Zahlen fuer die Warnung, bevor irgendetwas veraendert wird. */
export async function collectDeletionSummary(uid, { io = firestoreIo } = {}) {
  const [user, friendUids, groups, stories] = await Promise.all([
    io.loadUser(uid), io.loadFriendUids(uid), io.loadMyGroups(uid), io.loadStories(uid)
  ]);
  const u = user ?? {};
  return {
    cities:    (u.visited_cities    ?? []).length + (u.wishlist_cities    ?? []).length,
    countries: (u.visited_countries ?? []).length + (u.wishlist_countries ?? []).length,
    friends:   friendUids.length,
    groups:    groups.length,
    stories:   stories.length
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

  // 2. Gruppen. Je Gruppe eine Transaktion: Der Plan wird auf dem frisch
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

  // 3. Freundschaften, beide Richtungen. Muss vor dem User-Doc laufen:
  //    Firestore loescht Subcollections NICHT mit dem Dokument mit, sonst
  //    bliebe users/{uid}/friends/* verwaist und unerreichbar zurueck.
  onProgress('friends');
  const friendUids = await io.loadFriendUids(uid);
  if (friendUids.length) await io.deleteFriendPairs(uid, friendUids);

  // 4. Invite-Docs per Query nach der eigenen uid, nicht ueber das Token im
  //    User-Doc. Starb ein frueherer Versuch zwischen deleteUserDoc und
  //    deleteAuthUser, existiert das User-Doc nicht mehr und das Token waere
  //    verloren, das Invite-Doc bliebe fuer immer verwaist liegen.
  onProgress('invite');
  const inviteTokens = await io.findInviteTokens(uid);
  for (const token of inviteTokens) await io.deleteInvite(token);

  // 5. Stories samt Medien und das Profilbild. Hier muss ALLES weg, auch
  //    verwaiste Stories (Stadt existiert nicht mehr), die die App sonst nie
  //    automatisch loescht. Je Story zuerst die Dateien, dann das Dokument:
  //    Stirbt der Lauf dazwischen, steht das Dokument noch und der naechste
  //    Versuch findet die Pfade wieder. Umgekehrt waeren die Dateien ohne
  //    Dokument unauffindbar (es gibt keine list-Rule fuer Storage). Muss vor
  //    dem Auth-Account laufen, weil die Storage-Rules ein Konto verlangen.
  //    Grenze: Dateien, die kein Story-Doc mehr referenziert (Reste eines
  //    fehlgeschlagenen Upload-Aufraeumens), sind ohne list nicht auffindbar.
  onProgress('stories');
  const stories = await io.loadStories(uid);
  for (const story of stories) {
    for (const path of storyPaths(story)) await io.deleteFile(path);
    await io.deleteStoryDoc(uid, story.id);
  }
  await io.deleteAvatar(uid);

  // 6. User-Doc. Nimmt Staedte, Laender, Consent und Profil mit, weil alles
  //    als Felder im Dokument liegt.
  onProgress('profileDoc');
  await io.deleteUserDoc(uid);

  // 7. Zuletzt der Auth-Account.
  onProgress('account');
  await io.deleteAuthUser();
}
