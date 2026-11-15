// Demo-Ersatz fuer Firebase Auth: die erfundene Nutzerin ist immer angemeldet.
import { USER } from '../../../demo/demo-data.js';

const auth = { currentUser: { ...USER } };
export const getAuth = () => auth;
export const initializeAuth = () => auth;
export const indexedDBLocalPersistence = {};
export const onAuthStateChanged = (a, cb) => { setTimeout(() => cb(auth.currentUser), 0); return () => {}; };
export class GoogleAuthProvider { static credential() { return {}; } }
export class OAuthProvider { credential() { return {}; } }
export const signInWithPopup = async () => ({ user: auth.currentUser });
export const signInWithCredential = async () => ({ user: auth.currentUser });
export const linkWithCredential = async () => ({ user: auth.currentUser });
export const linkWithPopup = async () => ({ user: auth.currentUser });
export const reauthenticateWithPopup = async () => ({});
export const reauthenticateWithCredential = async () => ({});
export const revokeAccessToken = async () => {};
export const updateProfile = async (user, profile) => { Object.assign(user, profile); };
export const signOut = async () => {};
