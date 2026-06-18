import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth } from './config.js';

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
