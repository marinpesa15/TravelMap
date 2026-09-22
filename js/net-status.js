// Einzige Stelle, die den Netzzustand kennt.
//
// navigator.onLine luegt in eine Richtung: true heisst nur "es gibt eine
// Verbindung", nicht "der Server antwortet". Das reicht hier, weil der
// Schreibweg in db.js zusaetzlich am Fehlercode erkennt, dass Firestore den
// Server nicht erreicht, und dann ohnehin lokal weitermacht.

export function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

/**
 * Ruft callback(online) bei jedem Wechsel auf. Liefert eine Funktion zum
 * Abmelden zurueck.
 */
export function onNetChange(callback) {
  const online  = () => callback(true);
  const offline = () => callback(false);
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  return () => {
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
  };
}
