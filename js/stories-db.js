import {
  doc, collection, getDocs, setDoc, deleteDoc, onSnapshot, query, where, serverTimestamp
} from '../vendor/firebase/10.12.0/firebase-firestore.js';
import { db } from './config.js?v=4';

function _col(uid) {
  return collection(db, 'users', uid, 'stories');
}

function _withId(d) {
  return { id: d.id, ...d.data() };
}

/** Neue Story-ID, ohne zu schreiben. */
export function newStoryId(uid) {
  return doc(_col(uid)).id;
}

/**
 * Legt an oder ueberschreibt. created_at kommt aus data (beim Bearbeiten das Story-Objekt
 * durchreichen), sonst serverTimestamp(). Das await loest erst nach Server-Bestaetigung auf,
 * offline darf der UI-Ablauf also nicht darauf warten.
 */
export async function saveStory(uid, storyId, data) {
  const { id, ...fields } = data;
  const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
  await setDoc(doc(_col(uid), storyId), { ...clean, created_at: data.created_at ?? serverTimestamp() });
}

export async function deleteStoryDoc(uid, storyId) {
  await deleteDoc(doc(_col(uid), storyId));
}

/** Echtzeit-Listener auf die eigenen Stories. Liefert die Unsubscribe-Funktion. */
export function subscribeMyStories(uid, callback) {
  return onSnapshot(_col(uid), snap => callback(snap.docs.map(_withId)));
}

/** Geteilte Stories eines Freundes. Der shared-Filter ist fuer die Regel Pflicht. */
export async function loadSharedStories(friendUid) {
  const snap = await getDocs(query(_col(friendUid), where('shared', '==', true)));
  return snap.docs.map(_withId);
}
