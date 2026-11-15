// Demo-Ersatz fuer js/config.js (nur fuer die App-Store-Screenshots, siehe
// scripts/store-screenshots/README.md). Firebase ist durch In-Memory-Stubs
// ersetzt, Anfragen an fremde Server werden abgewiesen.
import { initializeApp } from '../vendor/firebase/10.12.0/firebase-app.js';
import { initializeAuth } from '../vendor/firebase/10.12.0/firebase-auth.js';
import { initializeFirestore } from '../vendor/firebase/10.12.0/firebase-firestore.js';
import { getStorage } from '../vendor/firebase/10.12.0/firebase-storage.js';
import { getFunctions } from '../vendor/firebase/10.12.0/firebase-functions.js';

localStorage.setItem('tm-lang', 'de');
localStorage.setItem('tm-theme', 'dark');

// Nur der eigene Origin (capacitor://localhost): kein Update-Manifest, kein Firebase, kein Spotify
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, location.href);
  if (url.origin !== location.origin) return Promise.reject(new TypeError(`demo: blocked ${url.origin}`));
  return realFetch(input, init);
};

const app = initializeApp({});
export const auth = initializeAuth(app, {});
export const db = initializeFirestore(app, {});
export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west1');

if (location.pathname.endsWith('map.html')) {
  window.addEventListener('load', () => import('../demo/driver.js'));
}
