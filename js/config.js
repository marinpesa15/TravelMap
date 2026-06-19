import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAznb3h6BEVv_N1kotmBRrg2vWZg7vrh8Q",
  authDomain: "travelmap-f4e3a.firebaseapp.com",
  projectId: "travelmap-f4e3a",
  storageBucket: "travelmap-f4e3a.firebasestorage.app",
  messagingSenderId: "1079049719393",
  appId: "1:1079049719393:web:35e9c33db285830d022420",
  measurementId: "G-3JQLJ05V37"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
