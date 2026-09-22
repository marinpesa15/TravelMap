import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, runTransaction,
  arrayUnion, arrayRemove, serverTimestamp
} from '../vendor/firebase/10.12.0/firebase-firestore.js';
import { db } from './config.js?v=3';
import { isOnline } from './net-status.js?v=1';
import { isOfflineError, settleWrite } from './offline-write.js?v=1';
import {
  planMarkWishlistCityVisited, planMarkGroupWishlistCityVisited,
  planAddVisitedCity, planAddWishlistCity, planDedupeCities
} from './city-logic.js?v=3';

function userRef(uid) {
  return doc(db, 'users', uid);
}

// Public invite-lookup doc: invites/{token} → { uid, display_name, avatar_url }.
// Keeps invite tokens out of the user docs' read path — user docs are only
// readable by the owner and confirmed friends (see firestore.rules).
function inviteRef(token) {
  return doc(db, 'invites', token);
}

// Offline bestaetigt Firestore erst beim naechsten Netz, das Versprechen
// bleibt bis dahin offen. Der lokale Cache ist sofort aktuell, deshalb wird
// offline nicht gewartet. Siehe js/offline-write.js.
const write = promise => settleWrite(promise, {
  online:  isOnline(),
  onError: err => console.error('[TM] write failed after reconnect:', err)
});

/**
 * Liest ein Dokument, laesst `decide` daraus einen Plan machen und schreibt ihn.
 *
 * Online laeuft das in einer Transaktion, damit parallele Aenderungen von
 * einem anderen Geraet nicht ueberschrieben werden. Offline gibt es keine
 * Transaktionen, dort wird aus dem lokalen Cache gelesen und normal
 * geschrieben; der Schreibvorgang geht beim naechsten Netz raus.
 *
 * `decide(data|null)` liefert null (nichts tun) oder { update } oder { set },
 * jeweils optional mit { status } als Rueckgabewert fuer den Aufrufer.
 */
async function applyToDoc(ref, decide) {
  if (isOnline()) {
    try {
      return await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        const plan = decide(snap.exists() ? snap.data() : null);
        if (plan?.update) tx.update(ref, plan.update);
        if (plan?.set)    tx.set(ref, plan.set);
        return plan?.status;
      });
    } catch (err) {
      // Netz war laut Browser da, der Server antwortet aber nicht: unten
      // lokal weitermachen statt die Aktion zu verlieren.
      if (!isOfflineError(err)) throw err;
    }
  }
  const snap = await getDoc(ref);
  const plan = decide(snap.exists() ? snap.data() : null);
  if (plan?.update) write(updateDoc(ref, plan.update));
  if (plan?.set)    write(setDoc(ref, plan.set));
  return plan?.status;
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
  await write(setDoc(userRef(uid), {
    consent: { version, accepted_at: serverTimestamp() }
  }, { merge: true }));
}

async function ensureDoc(uid) {
  const snap = await getDoc(userRef(uid));
  if (!snap.exists()) await write(setDoc(userRef(uid), EMPTY_DATA()));
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
    await write(setDoc(ref, data));
  } else if (!token) {
    token = crypto.randomUUID();
    await write(updateDoc(ref, { ...profileFields, invite_token: token }));
    data = { ...existing, ...profileFields, invite_token: token };
  } else {
    const changed = existing.display_name !== profileFields.display_name
                 || existing.avatar_url   !== profileFields.avatar_url;
    if (changed) await write(updateDoc(ref, profileFields));
    data = { ...existing, ...profileFields };
  }
  // Keep the invite-lookup doc in sync — also lazily migrates existing users
  // whose token so far only lives in their user doc.
  await write(setDoc(inviteRef(token), { uid, ...profileFields }));
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
  await write(updateDoc(userRef(uid), {
    visited_countries: arrayUnion(isoCode),
    wishlist_countries: arrayRemove(isoCode)
  }));
}

export async function addWishlistCountry(uid, isoCode) {
  await ensureDoc(uid);
  await write(updateDoc(userRef(uid), {
    wishlist_countries: arrayUnion(isoCode),
    visited_countries: arrayRemove(isoCode)
  }));
}

export async function removeCountry(uid, isoCode) {
  await write(updateDoc(userRef(uid), {
    visited_countries: arrayRemove(isoCode),
    wishlist_countries: arrayRemove(isoCode)
  }));
}

/**
 * Fuegt eine besuchte Stadt hinzu (cityData: { name, lat, lng, country, lived }).
 * In einer Transaktion: eine gleichnamige Wunsch-Stadt verschwindet, ein
 * schon besuchter Eintrag bekommt den neuen lived-Wert, und das Land wird
 * mit besucht. Legt das Dokument an, falls es noch fehlt.
 */
export async function addVisitedCity(uid, cityData) {
  await applyToDoc(userRef(uid), data => {
    if (data) return { update: planAddVisitedCity(data, cityData) };
    const empty = EMPTY_DATA();
    return { set: { ...empty, ...planAddVisitedCity(empty, cityData) } };
  });
}

export async function removeVisitedCity(uid, cityName) {
  const data = await loadUserData(uid);
  const updated = data.visited_cities.filter(c => c.name !== cityName);
  await write(updateDoc(userRef(uid), { visited_cities: updated }));
}

/**
 * Fuegt eine Wunsch-Stadt hinzu (cityData: { name, lat, lng, country }).
 * Eine schon besuchte Stadt bleibt unangetastet. Liefert 'added',
 * 'unchanged' (stand schon drauf) oder 'alreadyVisited'.
 */
export async function addWishlistCity(uid, cityData) {
  return applyToDoc(userRef(uid), existing => {
    const data = existing ?? EMPTY_DATA();
    const { status, update } = planAddWishlistCity(data, cityData);
    if (status !== 'added') return { status };
    return existing
      ? { status, update }
      : { status, set: { ...data, ...update } };
  });
}

export async function removeWishlistCity(uid, cityName) {
  const data = await loadUserData(uid);
  const updated = data.wishlist_cities.filter(c => c.name !== cityName);
  await write(updateDoc(userRef(uid), { wishlist_cities: updated }));
}

/**
 * Verschiebt eine Stadt von wishlist_cities nach visited_cities.
 * Lesen und Schreiben laufen in einer Transaktion, alle Felder gehen in
 * einem einzigen Update raus. So steht die Stadt zu keinem Zeitpunkt in
 * keiner oder in beiden Listen, und parallele Aenderungen (anderes Geraet)
 * werden nicht ueberschrieben.
 */
export async function markWishlistCityVisited(uid, cityName) {
  await applyToDoc(userRef(uid), data => {
    if (!data) return null;
    const plan = planMarkWishlistCityVisited(data, cityName);
    return plan ? { update: plan } : null;
  });
}

/**
 * Raeumt alte Doppel-Eintraege auf: Staedte, die in visited_cities und
 * wishlist_cities stehen, verlieren den Wunsch-Eintrag. Schreibt nur, wenn
 * es wirklich etwas aufzuraeumen gibt.
 */
export async function dedupeUserCities(uid) {
  await applyToDoc(userRef(uid), data => {
    if (!data) return null;
    const plan = planDedupeCities(data);
    return plan ? { update: plan } : null;
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
  await write(updateDoc(groupRef(groupId), { [field]: arrayUnion(cityData) }));
}

export async function removeCityFromGroup(groupId, cityName, type) {
  const snap = await getDoc(groupRef(groupId));
  const data = snap.data() ?? {};
  const field = type === 'visited' ? 'visited_cities' : 'wishlist_cities';
  const updated = (data[field] ?? []).filter(c => c.name !== cityName);
  await write(updateDoc(groupRef(groupId), { [field]: updated }));
}

/**
 * Gruppen-Variante von markWishlistCityVisited, gleiches Muster wie
 * applyGroupChange in account-io.js: lesen, planen und schreiben in einer
 * Transaktion, damit parallele Aenderungen anderer Mitglieder erhalten bleiben.
 * addedBy: { uid, photoURL, displayName } des umwandelnden Mitglieds.
 */
export async function markGroupWishlistCityVisited(groupId, cityName, addedBy) {
  await applyToDoc(groupRef(groupId), data => {
    if (!data) return null;
    const plan = planMarkGroupWishlistCityVisited(data, cityName, addedBy);
    return plan ? { update: plan } : null;
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
  await write(updateDoc(groupRef(groupId), { [field]: updated }));
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
