// Copy this file to js/config.js and fill in your real values
// Get these from: https://console.firebase.google.com → Project Settings → Web App
// Get Mapbox token from: js/constants.js

import { initializeApp } from '../vendor/firebase/10.12.0/firebase-app.js';
import { getAuth, initializeAuth, indexedDBLocalPersistence } from '../vendor/firebase/10.12.0/firebase-auth.js';
import { getFirestore } from '../vendor/firebase/10.12.0/firebase-firestore.js';
import { isNative } from './platform.js?v=1';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
// getAuth attaches the browser popup/redirect resolver, which loads an iframe
// from the auth domain while auth initializes. Under capacitor:// that never
// completes and every auth call queues behind it (measured in Lumiq on the
// simulator). Native builds sign in through a plugin, so they skip it.
export const auth = isNative()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
export const db = getFirestore(app);
