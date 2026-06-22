import {
  doc, collection, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './config.js';

/**
 * Creates a new group. memberUids must include the creator's uid as first element.
 * Returns the new group's Firestore document ID.
 */
export async function createGroup(name, memberUids) {
  const ref = doc(collection(db, 'groups'));
  await setDoc(ref, {
    name,
    created_by: memberUids[0],
    created_at: serverTimestamp(),
    members:    memberUids
  });
  return ref.id;
}

/**
 * Returns all groups where uid is a member.
 * Each item: { id, name, created_by, members }
 */
export async function loadGroups(uid) {
  const q    = query(collection(db, 'groups'), where('members', 'array-contains', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Leaves a group. If uid is the creator, deletes the group entirely.
 * Otherwise removes uid from the members array.
 */
export async function leaveGroup(groupId, uid, createdByUid) {
  if (uid === createdByUid) {
    await deleteDoc(doc(db, 'groups', groupId));
  } else {
    await updateDoc(doc(db, 'groups', groupId), { members: arrayRemove(uid) });
  }
}
