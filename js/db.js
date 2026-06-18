import {
  doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove
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
