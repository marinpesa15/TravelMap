import {
  GoogleAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup,
  signOut,
  onAuthStateChanged
} from '../vendor/firebase/10.12.0/firebase-auth.js';
import { auth } from './config.js?v=2';

const provider = new GoogleAuthProvider();

/** Returns Promise<UserCredential>. Throws if popup is blocked or user cancels. */
export function signInWithGoogle() {
  return signInWithPopup(auth, provider);
}

/** Returns Promise<void>. */
export function signOutUser() {
  return signOut(auth);
}

/** Calls callback(user) on auth state change. Returns unsubscribe fn. */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Frische Anmeldung. Firebase verlangt sie vor `user.delete()`.
 *
 * Diese Funktion ist die einzige Stelle, die den Anmeldeweg kennt. Im
 * nativen Capacitor-Build funktioniert `reauthenticateWithPopup` nicht,
 * weil Google eingebettete WebViews blockt. Dort wird hier spaeter ein
 * Google-Sign-In-Plugin plus `reauthenticateWithCredential` eingesetzt.
 * Der Loeschablauf in account.js bleibt davon unberuehrt.
 *
 * @throws wenn der Nutzer abbricht, der Popup blockiert ist oder niemand angemeldet ist
 */
export function reauthenticate() {
  const user = auth.currentUser;
  if (!user) throw new Error('not-signed-in');
  return reauthenticateWithPopup(user, provider).then(() => undefined);
}
