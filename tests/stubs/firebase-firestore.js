// Stub fuer das Firebase-CDN-Modul. Node kann keine https-Importe laden,
// deshalb biegt vitest.config.js die CDN-URLs hierher um. Die meisten Tests
// injizieren ein Fake-IO und fassen das hier nie an; db.test.js dagegen
// steuert ueber `__state`, wie sich Firestore verhaelt.
export const __state = {
  doc: null,            // Inhalt des gelesenen Dokuments, null = existiert nicht
  transactionError: null, // Fehler, den runTransaction werfen soll
  ackWrites: true,      // false = Schreibversprechen bleibt offen (offline)
  writes: [],           // ['update'|'set', data] je Schreibvorgang
  // Schnappschuesse, die onSnapshot nacheinander liefert:
  // { exists, data, fromCache } oder { error }. Leer = Listener schweigt.
  snapshots: []
};

export function __reset(doc = null) {
  __state.doc = doc;
  __state.transactionError = null;
  __state.ackWrites = true;
  __state.writes = [];
  __state.snapshots = [];
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
// onSnapshot(ref, cb) oder onSnapshot(ref, options, cb, errCb). Liefert die
// vorbereiteten Schnappschuesse asynchron, einen pro Makrotask.
export const onSnapshot = (ref, a, b, c) => {
  const cb    = typeof a === 'function' ? a : b;
  const errCb = typeof a === 'function' ? b : c;
  let active = true;
  const queue = [...__state.snapshots];
  const next = () => {
    if (!active || !queue.length) return;
    const item = queue.shift();
    setTimeout(() => {
      if (!active) return;
      if (item.error) errCb?.(item.error);
      else cb({
        exists:   () => item.exists !== false,
        data:     () => item.data,
        metadata: { fromCache: item.fromCache === true, hasPendingWrites: false }
      });
      next();
    }, 0);
  };
  next();
  return () => { active = false; };
};
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
