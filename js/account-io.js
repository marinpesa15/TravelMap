// Duenne Huelle um Firestore und Auth. Enthaelt bewusst keine Logik, damit
// account.js im Test ein Fake-IO bekommen kann und trotzdem derselbe Ablauf
// laeuft wie in der App.
import {
  doc, collection, getDoc, getDocs, deleteDoc, runTransaction,
  writeBatch, query, where
} from '../vendor/firebase/10.12.0/firebase-firestore.js';
import { db, auth } from './config.js?v=2';
import { reauthenticate, revokeAppleSignIn } from './auth.js?v=22';

// Firestore erlaubt hoechstens 500 Operationen pro Batch.
const BATCH_LIMIT = 500;

export const firestoreIo = {
  reauthenticate,

  async loadUser(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },

  async loadMyGroups(uid) {
    const q = query(collection(db, 'groups'), where('members', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Liest die Gruppe innerhalb einer Transaktion frisch und wendet `decide`
  // auf diesen Stand an. Ohne Transaktion wuerde der Austritt parallele
  // Aenderungen anderer Mitglieder ueberschreiben, weil die drei Felder
  // komplett zurueckgeschrieben werden (Last-Write-Wins).
  // `decide` liefert null (nichts tun), {action:'delete'} oder
  // {action:'update', data}.
  applyGroupChange(groupId, decide) {
    return runTransaction(db, async tx => {
      const ref = doc(db, 'groups', groupId);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const plan = decide({ id: snap.id, ...snap.data() });
      if (!plan) return;
      if (plan.action === 'delete') tx.delete(ref);
      else tx.update(ref, plan.data);
    });
  },

  async loadFriendUids(uid) {
    const snap = await getDocs(collection(db, 'users', uid, 'friends'));
    return snap.docs.map(d => d.id);
  },

  // Beide Richtungen: mein Eintrag bei ihm und seiner bei mir.
  async deleteFriendPairs(uid, friendUids) {
    for (let i = 0; i < friendUids.length; i += BATCH_LIMIT / 2) {
      const chunk = friendUids.slice(i, i + BATCH_LIMIT / 2);
      const batch = writeBatch(db);
      for (const fid of chunk) {
        batch.delete(doc(db, 'users', fid, 'friends', uid));
        batch.delete(doc(db, 'users', uid, 'friends', fid));
      }
      await batch.commit();
    }
  },

  // Eigene Invite-Docs per Query statt ueber das Token aus dem User-Doc.
  // Die Rules erlauben list nur mit Filter auf die eigene uid.
  async findInviteTokens(uid) {
    const q = query(collection(db, 'invites'), where('uid', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.id);
  },

  deleteInvite(token) {
    return deleteDoc(doc(db, 'invites', token));
  },

  deleteUserDoc(uid) {
    return deleteDoc(doc(db, 'users', uid));
  },

  async deleteAuthUser() {
    const user = auth.currentUser;
    if (!user) throw new Error('not-signed-in');
    await revokeAppleSignIn();
    await user.delete();
  }
};
