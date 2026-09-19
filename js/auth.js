import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithCredential,
  reauthenticateWithPopup,
  reauthenticateWithCredential,
  revokeAccessToken,
  updateProfile,
  signOut,
  onAuthStateChanged
} from '../vendor/firebase/10.12.0/firebase-auth.js';
import { auth } from './config.js?v=2';
import { isNative } from './platform.js?v=1';

const provider = new GoogleAuthProvider();

// Nativ blockt Google Popups in eingebetteten WebViews (disallowed_useragent).
// Dort holt das Capacitor-Plugin nur das Token (skipNativeAuth in
// capacitor.config.json), angemeldet wird trotzdem ueber das Web-SDK. So
// bleiben auth.currentUser, Firestore und onAuthStateChanged unveraendert.
// Kein Bundler, also kein registerPlugin aus @capacitor/core. Die von der
// Shell injizierte Bridge kennt nur nativePromise, auf dem registerPlugin
// selbst aufsetzt.
function nativePlugin() {
  const call = method => (options = {}) =>
    window.Capacitor.nativePromise('FirebaseAuthentication', method, options);
  return {
    signInWithGoogle: call('signInWithGoogle'),
    signInWithApple: call('signInWithApple'),
    signOut: call('signOut')
  };
}

/**
 * Nativer Sign-in-Dialog, liefert ein Credential fuer das Web-SDK.
 * Apple gibt Name und authorizationCode mit: den Namen nur beim allerersten
 * Login, den Code braucht der Token-Widerruf bei der Kontoloeschung.
 */
async function nativeCredential(providerId) {
  const plugin = nativePlugin();
  if (providerId === 'apple.com') {
    const res = await plugin.signInWithApple({ skipNativeAuth: true });
    return {
      credential: new OAuthProvider('apple.com').credential({
        idToken: res.credential.idToken,
        rawNonce: res.credential.nonce
      }),
      displayName: res.user?.displayName ?? null,
      authorizationCode: res.credential.authorizationCode ?? null
    };
  }
  const res = await plugin.signInWithGoogle({ skipNativeAuth: true });
  return {
    credential: GoogleAuthProvider.credential(res.credential.idToken, res.credential.accessToken),
    displayName: null,
    authorizationCode: null
  };
}

/** Returns Promise<UserCredential>. Throws if popup is blocked or user cancels. */
export async function signInWithGoogle() {
  if (!isNative()) return signInWithPopup(auth, provider);
  const { credential } = await nativeCredential('google.com');
  return signInWithCredential(auth, credential);
}

/**
 * Nur nativ (App-Store-Guideline 4.8), im Web gibt es keinen Apple-Button.
 * Firebase uebernimmt Apples Namen nicht selbst, deshalb setzen wir ihn,
 * solange das Profil noch keinen hat.
 */
export async function signInWithApple() {
  const { credential, displayName } = await nativeCredential('apple.com');
  const result = await signInWithCredential(auth, credential);
  if (displayName && !result.user.displayName) {
    await updateProfile(result.user, { displayName });
  }
  return result;
}

/** Returns Promise<void>. */
export async function signOutUser() {
  // Nativ haelt das Google-SDK eine eigene Sitzung, sonst waehlt der naechste
  // Login stillschweigend dasselbe Konto.
  if (isNative()) await nativePlugin().signOut().catch(() => {});
  return signOut(auth);
}

/** Calls callback(user) on auth state change. Returns unsubscribe fn. */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// authorizationCode aus der letzten Apple-Reauth, fuer revokeAppleSignIn().
let _appleCode = null;

/**
 * Frische Anmeldung. Firebase verlangt sie vor `user.delete()`.
 *
 * Diese Funktion ist die einzige Stelle, die den Anmeldeweg kennt: im Web
 * per Popup, nativ ueber das Plugin mit dem Provider, mit dem das Konto
 * angelegt wurde. Der Loeschablauf in account.js bleibt davon unberuehrt.
 *
 * @throws wenn der Nutzer abbricht, der Popup blockiert ist oder niemand angemeldet ist
 */
export async function reauthenticate() {
  const user = auth.currentUser;
  if (!user) throw new Error('not-signed-in');
  if (!isNative()) {
    await reauthenticateWithPopup(user, provider);
    return;
  }
  const providerId = user.providerData.some(p => p.providerId === 'apple.com') ? 'apple.com' : 'google.com';
  const { credential, authorizationCode } = await nativeCredential(providerId);
  await reauthenticateWithCredential(user, credential);
  _appleCode = authorizationCode;
}

/**
 * Apple verlangt, dass beim Loeschen eines Kontos das Sign-in-with-Apple-Token
 * widerrufen wird. Braucht den Code aus reauthenticate(), laeuft also direkt
 * davor. Ein Fehler hier (z.B. fehlende Apple-Konfiguration in Firebase) soll
 * die Loeschung nicht blockieren.
 */
export async function revokeAppleSignIn() {
  if (!_appleCode) return;
  try {
    await revokeAccessToken(auth, _appleCode);
  } catch (err) {
    console.error('Apple token revocation failed', err);
  } finally {
    _appleCode = null;
  }
}
