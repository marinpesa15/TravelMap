import {
  doc, collection, getDoc, onSnapshot, writeBatch, serverTimestamp, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './config.js';

function _friendRef(uid, friendUid) {
  return doc(db, 'users', uid, 'friends', friendUid);
}

function _friendsCol(uid) {
  return collection(db, 'users', uid, 'friends');
}

/**
 * Real-time listener for friend list.
 * Calls callback([{ uid, display_name, avatar_url, since }]) on every change.
 * Returns Firestore unsubscribe function.
 */
export function loadFriends(uid, callback) {
  return onSnapshot(_friendsCol(uid), snap => {
    callback(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  });
}

/**
 * Creates bidirectional friendship in a single batch write.
 * myData / theirData: { display_name, avatar_url }
 */
export async function addFriendship(myUid, theirUid, theirData, myData) {
  const batch = writeBatch(db);
  batch.set(_friendRef(myUid, theirUid), {
    display_name: theirData.display_name || '',
    avatar_url:   theirData.avatar_url   || '',
    since:        serverTimestamp()
  });
  batch.set(_friendRef(theirUid, myUid), {
    display_name: myData.display_name || '',
    avatar_url:   myData.avatar_url   || '',
    since:        serverTimestamp()
  });
  await batch.commit();
}

/**
 * Removes friendship from both sides.
 */
export async function removeFriend(myUid, friendUid) {
  const batch = writeBatch(db);
  batch.delete(_friendRef(myUid, friendUid));
  batch.delete(_friendRef(friendUid, myUid));
  await batch.commit();
}

/**
 * Returns true if myUid and friendUid are already friends.
 */
export async function isFriend(myUid, friendUid) {
  const snap = await getDoc(_friendRef(myUid, friendUid));
  return snap.exists();
}
