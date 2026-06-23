import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc,
  arrayUnion, arrayRemove, query, where, writeBatch, serverTimestamp, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './config.js';

function userRef(uid) {
  return doc(db, 'users', uid);
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

async function ensureDoc(uid) {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) await setDoc(userRef(uid), EMPTY_DATA());
}

/**
 * Writes display_name, avatar_url to the user doc.
 * Generates invite_token once if not already set.
 * user: { displayName, photoURL } from Firebase Auth
 */
export async function initUserProfile(uid, user) {
  const ref  = userRef(uid);
  const snap = await getDoc(ref);
  const profileFields = {
    display_name: user.displayName || '',
    avatar_url:   user.photoURL   || ''
  };
  if (!snap.exists()) {
    await setDoc(ref, {
      ...EMPTY_DATA(),
      ...profileFields,
      invite_token: crypto.randomUUID()
    });
  } else if (!snap.data().invite_token) {
    await updateDoc(ref, { ...profileFields, invite_token: crypto.randomUUID() });
  } else {
    await updateDoc(ref, profileFields);
  }
}

/**
 * Looks up a user by their invite_token.
 * Returns { uid, display_name, avatar_url, invite_token } or null.
 */
export async function getUserByToken(token) {
  const q    = query(collection(db, 'users'), where('invite_token', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}

/**
 * Regenerates the user's invite token.
 */
export async function regenerateInviteToken(uid) {
  const newToken = crypto.randomUUID();
  await updateDoc(userRef(uid), { invite_token: newToken });
  return newToken;
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

/** cityData: { name, lat, lng, country, lived, color } */
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
