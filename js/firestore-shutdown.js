import { db } from './config.js?v=3';
import { terminate, clearIndexedDbPersistence } from '../vendor/firebase/10.12.0/firebase-firestore.js';

// Verlaesst map.html die Seite, waehrend Firestore noch laeuft, blieb in der
// iOS-App (WKWebView) ein Rest der Instanz im IndexedDB-Cache haengen. Jede
// neue Instanz wartete dann ewig auf ihren ersten Lesevorgang, auch nach
// einem Neuladen, erst ein Neustart der App half. Im Simulator gegen die
// Emulatoren nachgestellt, nach Abmelden genauso wie nach der Kontoloeschung.
// Deshalb wird Firestore vor jedem Seitenwechsel weg von der Karte beendet.

let _terminated = null;
let _leaving = false;

// Wer selbst weiterleitet, meldet das hier an. Der Auth-Listener in app.js
// leitet dann nicht zusaetzlich um, sonst waere der Seitenwechsel schneller
// als das Aufraeumen.
export function markLeaving() { _leaving = true; }
export function isLeaving()   { return _leaving; }
export function cancelLeaving() { _leaving = false; }

const _withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise(resolve => setTimeout(resolve, ms))]);

/**
 * Beendet Firestore (einmalig) und leert auf Wunsch den lokalen Cache.
 * Wartet hoechstens ein paar Sekunden: weiterleiten ist wichtiger.
 */
export async function shutdownFirestore({ clearCache = false } = {}) {
  _terminated ??= terminate(db).catch(err => console.error('Firestore terminate failed:', err));
  await _withTimeout(_terminated, 2000);
  if (!clearCache) return;
  try {
    await _withTimeout(clearIndexedDbPersistence(db), 2000);
  } catch (err) {
    console.error('Firestore cache clear failed:', err);
  }
}
