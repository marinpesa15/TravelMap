import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, runTransaction,
  arrayUnion, arrayRemove, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './config.js?v=1';
import { planMarkWishlistCityVisited, planMarkGroupWishlistCityVisited } from './city-logic.js?v=2';

function userRef(uid) {
  return doc(db, 'users', uid);
}

// Public invite-lookup doc: invites/{token} → { uid, display_name, avatar_url }.
// Keeps invite tokens out of the user docs' read path — user docs are only
// readable by the owner and confirmed friends (see firestore.rules).
function inviteRef(token) {
  return doc(db, 'invites', token);
}

const EMPTY_DATA = () => ({
  visited_countries: [],
  wishlist_countries: [],
  visited_cities: [],
  wishlist_cities: []
});

export async function loadUserData(uid) {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? snap.data() : EMPTY_DATA();
}

/** Persists the privacy consent on the user doc (creates it if missing). */
export async function acceptConsent(uid, version) {
  await setDoc(userRef(uid), {
    consent: { version, accepted_at: serverTimestamp() }
  }, { merge: true });
}

async function ensureDoc(uid) {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) await setDoc(userRef(uid), EMPTY_DATA());
}

/**
 * Writes display_name, avatar_url to the user doc (only when changed).
 * Generates invite_token once if not already set.
 * user: { displayName, photoURL } from Firebase Auth
 * Returns the resulting user-doc data — callers can use it directly
 * instead of re-reading the doc.
 */
export async function initUserProfile(uid, user) {
  const ref      = userRef(uid);
  const snap     = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : null;
  const profileFields = {
    display_name: user.displayName || '',
    avatar_url:   user.photoURL   || ''
  };

  let token = existing?.invite_token ?? null;
  let data;
  if (!existing) {
    token = crypto.randomUUID();
    data  = { ...EMPTY_DATA(), ...profileFields, invite_token: token };
    await setDoc(ref, data);
  } else if (!token) {
    token = crypto.randomUUID();
    await updateDoc(ref, { ...profileFields, invite_token: token });
    data = { ...existing, ...profileFields, invite_token: token };
  } else {
    const changed = existing.display_name !== profileFields.display_name
                 || existing.avatar_url   !== profileFields.avatar_url;
    if (changed) await updateDoc(ref, profileFields);
    data = { ...existing, ...profileFields };
  }
  // Keep the invite-lookup doc in sync — also lazily migrates existing users
  // whose token so far only lives in their user doc.
  await setDoc(inviteRef(token), { uid, ...profileFields });
  return data;
}

/**
 * Looks up a user by their invite token via the invites collection.
 * Returns { uid, display_name, avatar_url } or null.
 */
export async function getUserByToken(token) {
  const snap = await getDoc(inviteRef(token));
  return snap.exists() ? snap.data() : null;
}

export async function addVisitedCountry(uid, isoCode) {
  await ensureDoc(uid);
  await updateDoc(userRef(uid), {
    visited_countries: arrayUnion(isoCode),
    wishlist_countries: arrayRemove(isoCode)
  });
}

export async function addWishlistCountry(uid, isoCode) {
  await ensureDoc(uid);
  await updateDoc(userRef(uid), {
    wishlist_countries: arrayUnion(isoCode),
    visited_countries: arrayRemove(isoCode)
  });
}

export async function removeCountry(uid, isoCode) {
  await updateDoc(userRef(uid), {
    visited_countries: arrayRemove(isoCode),
    wishlist_countries: arrayRemove(isoCode)
  });
}

/** cityData: { name, lat, lng, country, lived } */
export async function addVisitedCity(uid, cityData) {
  await ensureDoc(uid);
  await updateDoc(userRef(uid), {
    visited_cities: arrayUnion(cityData)
  });
}

export async function removeVisitedCity(uid, cityName) {
  const data = await loadUserData(uid);
  const updated = data.visited_cities.filter(c => c.name !== cityName);
  await updateDoc(userRef(uid), { visited_cities: updated });
}

/** cityData: { name, lat, lng, country } */
export async function addWishlistCity(uid, cityData) {
  await ensureDoc(uid);
  await updateDoc(userRef(uid), {
    wishlist_cities: arrayUnion(cityData)
  });
}

export async function removeWishlistCity(uid, cityName) {
  const data = await loadUserData(uid);
  const updated = data.wishlist_cities.filter(c => c.name !== cityName);
  await updateDoc(userRef(uid), { wishlist_cities: updated });
}

/**
 * Verschiebt eine Stadt von wishlist_cities nach visited_cities.
 * Lesen und Schreiben laufen in einer Transaktion, alle Felder gehen in
 * einem einzigen Update raus. So steht die Stadt zu keinem Zeitpunkt in
 * keiner oder in beiden Listen, und parallele Aenderungen (anderes Geraet)
 * werden nicht ueberschrieben.
 */
export async function markWishlistCityVisited(uid, cityName) {
  const ref = userRef(uid);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const plan = planMarkWishlistCityVisited(snap.data(), cityName);
    if (plan) tx.update(ref, plan);
  });
}

// ===== Group City Data =====

function groupRef(groupId) {
  return doc(db, 'groups', groupId);
}

export async function loadGroupData(groupId) {
  const snap = await getDoc(groupRef(groupId));
  if (!snap.exists()) return { visited_cities: [], wishlist_cities: [] };
  const d = snap.data();
  return {
    visited_cities:  d.visited_cities  ?? [],
    wishlist_cities: d.wishlist_cities ?? []
  };
}

export async function addCityToGroup(groupId, cityData, type) {
  const field = type === 'visited' ? 'visited_cities' : 'wishlist_cities';
  await updateDoc(groupRef(groupId), { [field]: arrayUnion(cityData) });
}

export async function removeCityFromGroup(groupId, cityName, type) {
  const snap = await getDoc(groupRef(groupId));
  const data = snap.data() ?? {};
  const field = type === 'visited' ? 'visited_cities' : 'wishlist_cities';
  const updated = (data[field] ?? []).filter(c => c.name !== cityName);
  await updateDoc(groupRef(groupId), { [field]: updated });
}

/**
 * Gruppen-Variante von markWishlistCityVisited, gleiches Muster wie
 * applyGroupChange in account-io.js: lesen, planen und schreiben in einer
 * Transaktion, damit parallele Aenderungen anderer Mitglieder erhalten bleiben.
 * addedBy: { uid, photoURL, displayName } des umwandelnden Mitglieds.
 */
export async function markGroupWishlistCityVisited(groupId, cityName, addedBy) {
  const ref = groupRef(groupId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const plan = planMarkGroupWishlistCityVisited(snap.data(), cityName, addedBy);
    if (plan) tx.update(ref, plan);
  });
}

export async function updateGroupCityPhoto(groupId, cityName, type, newPhotoURL) {
  const snap = await getDoc(groupRef(groupId));
  const data = snap.data() ?? {};
  const field = type === 'visited' ? 'visited_cities' : 'wishlist_cities';
  const updated = (data[field] ?? []).map(c =>
    c.name === cityName
      ? { ...c, addedBy: { ...(c.addedBy ?? {}), photoURL: newPhotoURL } }
      : c
  );
  await updateDoc(groupRef(groupId), { [field]: updated });
}

// ===== Real-time Subscriptions =====

/**
 * Real-time listener for own user data.
 * Fires immediately with current data, then on every change.
 */
export function subscribeUserData(uid, callback) {
  return onSnapshot(userRef(uid), snap => {
    callback(snap.exists() ? snap.data() : EMPTY_DATA());
  });
}

/**
 * Real-time listener for group city data.
 */
export function subscribeGroupData(groupId, callback) {
  return onSnapshot(groupRef(groupId), snap => {
    const d = snap.data() ?? {};
    callback({
      visited_cities:  d.visited_cities  ?? [],
      wishlist_cities: d.wishlist_cities ?? []
    });
  });
}
