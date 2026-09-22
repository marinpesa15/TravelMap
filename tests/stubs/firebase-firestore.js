// Stub fuer das Firebase-CDN-Modul. Node kann keine https-Importe laden,
// deshalb biegt vitest.config.js die CDN-URLs hierher um. Die meisten Tests
// injizieren ein Fake-IO und fassen das hier nie an; db.test.js dagegen
// steuert ueber `__state`, wie sich Firestore verhaelt.
export const __state = {
  doc: null,            // Inhalt des gelesenen Dokuments, null = existiert nicht
  transactionError: null, // Fehler, den runTransaction werfen soll
  ackWrites: true,      // false = Schreibversprechen bleibt offen (offline)
  writes: []            // ['update'|'set', data] je Schreibvorgang
};

export function __reset(doc = null) {
  __state.doc = doc;
  __state.transactionError = null;
  __state.ackWrites = true;
  __state.writes = [];
}

const record = (kind, data) => {
  __state.writes.push([kind, data]);
  // Offline erfuellt Firestore das Versprechen erst beim naechsten Netz.
  return __state.ackWrites ? Promise.resolve() : new Promise(() => {});
};

const snapshot = () => ({
  exists: () => __state.doc !== null,
  data:   () => __state.doc
});

export const doc = () => ({});
export const collection = () => ({});
export const getDoc = async () => snapshot();
export const getDocs = async () => ({ docs: [] });
export const deleteDoc = async () => {};
export const updateDoc = (ref, data) => record('update', data);
export const setDoc = (ref, data) => record('set', data);
export const onSnapshot = () => () => {};
export const writeBatch = () => ({ delete: () => {}, commit: async () => {} });
export const query = () => ({});
export const where = () => ({});
export const arrayUnion = (...items) => ({ __arrayUnion: items });
export const arrayRemove = (...items) => ({ __arrayRemove: items });
export const serverTimestamp = () => ({ __serverTimestamp: true });

export const runTransaction = async (db, fn) => {
  if (__state.transactionError) throw __state.transactionError;
  return fn({
    get:    async () => snapshot(),
    update: (ref, data) => record('update', data),
    set:    (ref, data) => record('set', data)
  });
};

export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
