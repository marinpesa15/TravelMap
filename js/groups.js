import {
  doc, collection, addDoc, onSnapshot, updateDoc, deleteDoc,
  query, where, serverTimestamp, arrayRemove, arrayUnion
} from '../vendor/firebase/10.12.0/firebase-firestore.js';
import { db } from './config.js?v=3';

/**
 * Creates a new group.
 * @param {string} name - Group name
 * @param {string[]} memberUids - Friend UIDs to add (creator not included here)
 * @param {string} createdBy - UID of the creating user
 * @returns {Promise<string>} New group's Firestore document ID
 */
export async function createGroup(name, memberUids, createdBy) {
  const ref = await addDoc(collection(db, 'groups'), {
    name,
    created_by: createdBy,
    created_at: serverTimestamp(),
    members: [createdBy, ...memberUids]
  });
  return ref.id;
}

/**
 * Real-time listener for all groups where uid is a member.
 * @param {string} uid
 * @param {Function} callback - called with [{id, name, created_by, members}]
 * @returns {Function} Firestore unsubscribe function
 */
export function loadGroups(uid, callback) {
  const q = query(collection(db, 'groups'), where('members', 'array-contains', uid));
  return onSnapshot(q, snap => {
    const groups = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(groups);
  });
}

/**
 * Adds one or more friends to an existing group.
 * @param {string} groupId
 * @param {string[]} friendUids - UIDs to add
 */
export async function addMembersToGroup(groupId, friendUids) {
  await updateDoc(doc(db, 'groups', groupId), {
    members: arrayUnion(...friendUids)
  });
}

/**
 * Removes a single member from a group.
 * Rules only allow this for the group creator (or the member themselves).
 * @param {string} groupId
 * @param {string} memberUid
 */
export async function removeMemberFromGroup(groupId, memberUid) {
  await updateDoc(doc(db, 'groups', groupId), {
    members: arrayRemove(memberUid)
  });
}

/**
 * Leaves a group. If uid is the creator, deletes the group entirely.
 * Otherwise removes uid from the members array.
 * @param {string} groupId
 * @param {string} uid - The leaving user's UID
 * @param {string} createdBy - The group creator's UID
 */
export async function leaveGroup(groupId, uid, createdBy) {
  if (uid === createdBy) {
    await deleteDoc(doc(db, 'groups', groupId));
  } else {
    await updateDoc(doc(db, 'groups', groupId), { members: arrayRemove(uid) });
  }
}
