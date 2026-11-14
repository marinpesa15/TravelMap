// Profilbild aendern und entfernen.
//
// Reihenfolge der Schreibzugriffe (siehe changeAvatar): Auth zuerst, denn
// initUserProfile (js/db.js) gleicht beim Start users/{uid} mit
// user.photoURL ab. Stuende dort noch das alte Bild, wuerde ein Neustart
// nach einem Teilabbruch das neue Bild im User-Doc wieder ueberschreiben.
import { updateProfile } from '../vendor/firebase/10.12.0/firebase-auth.js';
import { doc, updateDoc, writeBatch } from '../vendor/firebase/10.12.0/firebase-firestore.js';
import { db, auth } from './config.js?v=4';
import { firestoreIo } from './account-io.js?v=9';
import { uploadBlob, publicUrl, deleteFile } from './storage.js?v=1';
import { toJpegBlob } from './image.js?v=1';

const MAX_URL = 500;      // Regelgrenze fuer avatar_url in firestore.rules
const BATCH_LIMIT = 500;  // Firestore: Operationen pro Batch

export const profileIo = {
  toJpegBlob, uploadBlob, publicUrl, deleteFile,
  loadUser: firestoreIo.loadUser,
  loadFriendUids: firestoreIo.loadFriendUids,
  // null statt '', sonst loescht Firebase das Feld nicht sicher
  setAuthPhoto: (user, url) => updateProfile(user, { photoURL: url || null }),
  setUserAvatar: (uid, url) => updateDoc(doc(db, 'users', uid), { avatar_url: url }),
  setInviteAvatar: (token, url) => updateDoc(doc(db, 'invites', token), { avatar_url: url }),
  async setFriendAvatars(uid, friendUids, url) {
    for (let i = 0; i < friendUids.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      for (const fid of friendUids.slice(i, i + BATCH_LIMIT)) {
        batch.update(doc(db, 'users', fid, 'friends', uid), { avatar_url: url });
      }
      await batch.commit();
    }
  }
};

// Schreibt url ('' = kein Bild) an alle Stellen, in fester Reihenfolge.
async function writeEverywhere(io, user, url) {
  const [me, friendUids] = await Promise.all([io.loadUser(user.uid), io.loadFriendUids(user.uid)]);
  await io.setAuthPhoto(user, url);
  await io.setUserAvatar(user.uid, url);
  const token = me?.invite_token;
  if (token) await io.setInviteAvatar(token, url);
  if (friendUids.length) await io.setFriendAvatars(user.uid, friendUids, url);
}

/** Skaliert auf 512 px quadratisch, laedt hoch und verteilt die neue URL. Gibt sie zurueck. */
export async function changeAvatar(file, { io = profileIo } = {}) {
  const user = auth.currentUser;
  const path = `users/${user.uid}/avatar.jpg`;
  const blob = await io.toJpegBlob(file, { max: 512, square: true });
  await io.uploadBlob(path, blob, 'image/jpeg');
  const base = await io.publicUrl(path);
  // Gleicher Pfad, gleiche URL: ohne &v= zeigt der Bild-Cache das alte Bild.
  const url = `${base}&v=${Date.now()}`;
  if (url.length > MAX_URL) throw new Error('avatar-url-too-long');
  await writeEverywhere(io, user, url);
  return url;
}

export async function removeAvatar({ io = profileIo } = {}) {
  const user = auth.currentUser;
  await writeEverywhere(io, user, '');
  await io.deleteFile(`users/${user.uid}/avatar.jpg`);
}

/**
 * Verdrahtet Kamera-Knopf, Dateiauswahl und "Bild entfernen" im Profil-Sheet.
 * onChange() rendert die Avatare neu (auth.currentUser.photoURL ist dann aktuell).
 */
export function initProfilePicture({ onChange, toast, t }) {
  const btn = document.getElementById('profile-avatar-btn');
  const input = document.getElementById('profile-avatar-input');
  const removeBtn = document.getElementById('profile-avatar-remove');
  let busy = false;

  const run = async work => {
    if (busy) return;
    busy = true;
    btn.classList.add('busy');
    try {
      await work();
      onChange();
    } catch (e) {
      console.error('[TM] avatar failed:', e);
      toast(t(e?.message === 'not-an-image' ? 'toast.notAnImage' : 'toast.avatarFailed'));
    } finally {
      busy = false;
      btn.classList.remove('busy');
    }
  };

  btn.addEventListener('click', () => { if (!busy) input.click(); });
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = ''; // dieselbe Datei darf erneut gewaehlt werden
    if (file) run(() => changeAvatar(file));
  });
  removeBtn.addEventListener('click', () => run(() => removeAvatar()));
}
