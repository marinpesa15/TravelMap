// Zwei Eigenheiten von Firestore, die offline zuschlagen:
//
// 1. Ein Schreibversprechen wird erst mit der Server-Bestaetigung erfuellt.
//    Ohne Netz wartet man ewig darauf. Der lokale Cache ist trotzdem sofort
//    aktuell und die Listener feuern, die Oberflaeche ist also fertig. Wer
//    offline auf das Versprechen wartet, friert nur die eigene Bedienung ein.
//
// 2. Transaktionen lesen immer vom Server und schlagen offline fehl. Der
//    Aufrufer muss dann selbst aus dem Cache lesen und normal schreiben.
//
// Beides steckt in diesen beiden reinen Helfern, damit es testbar bleibt.

// 'unavailable' meldet Firestore, wenn der Server nicht erreichbar ist,
// 'deadline-exceeded', wenn die Transaktion ins Zeitlimit laeuft. Andere
// Codes (z.B. 'permission-denied') sind echte Fehler und muessen durch.
const OFFLINE_CODES = new Set(['unavailable', 'deadline-exceeded']);

export function isOfflineError(err) {
  const code = String(err?.code ?? '');
  return OFFLINE_CODES.has(code.replace(/^firestore\//, ''));
}

/**
 * Wartet online auf die Server-Bestaetigung, offline nicht.
 *
 * @param {Promise} writePromise Rueckgabe von updateDoc/setDoc/...
 * @param {{online: boolean, onError?: (err: unknown) => void}} opts
 */
export function settleWrite(writePromise, { online, onError = () => {} }) {
  if (online) return writePromise;
  // Der Schreibvorgang laeuft weiter und geht beim naechsten Netz raus.
  // Scheitert er dann, landet er hier und nicht als unbehandelte Ablehnung.
  writePromise.catch(onError);
  return Promise.resolve();
}
