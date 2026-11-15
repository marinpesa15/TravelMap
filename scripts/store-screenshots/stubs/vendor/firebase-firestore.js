// Demo-Ersatz fuer das Firestore-SDK: In-Memory-Dokumente aus demo-data.js, kein Netz.
import { initialDocs } from '../../../demo/demo-data.js';

const store = new Map(Object.entries(initialDocs()));
const listeners = new Set();
let autoId = 0;

const join = segs => segs.filter(s => s !== undefined && typeof s !== 'object').join('/');

export function collection(base, ...segs) {
  const path = base?.type === 'doc' ? join([base.path, ...segs]) : join(segs);
  return { type: 'collection', path, id: path.split('/').pop() };
}
export function doc(base, ...segs) {
  let path;
  if (base?.type === 'collection') path = join([base.path, segs.length ? segs[0] : `demo-auto-${++autoId}`]);
  else path = join(segs);
  return { type: 'doc', path, id: path.split('/').pop() };
}
export const where = (field, op, value) => ({ field, op, value });
export const query = (col, ...filters) => ({ type: 'query', path: col.path, filters });

const clone = v => (v === undefined ? undefined : structuredClone(v));

function docSnap(ref) {
  const data = store.get(ref.path);
  return {
    id: ref.id, ref,
    exists: () => data !== undefined,
    data: () => clone(data),
    get: f => data?.[f],
    metadata: { fromCache: false, hasPendingWrites: false }
  };
}

function matches(data, { field, op, value }) {
  const v = data?.[field];
  if (op === '==') return v === value;
  if (op === 'array-contains') return Array.isArray(v) && v.includes(value);
  return true;
}

function querySnap(q) {
  const prefix = q.path + '/';
  const docs = [...store.keys()]
    .filter(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .map(p => docSnap({ type: 'doc', path: p, id: p.split('/').pop() }))
    .filter(d => (q.filters ?? []).every(f => matches(d.data(), f)));
  return { docs, size: docs.length, empty: !docs.length, forEach: fn => docs.forEach(fn), metadata: { fromCache: false } };
}

const snapOf = ref => (ref.type === 'doc' ? docSnap(ref) : querySnap(ref));

function notify() {
  for (const l of listeners) setTimeout(() => l.active && l.cb(snapOf(l.ref)), 0);
}

function applyField(old, value) {
  if (value?.__op === 'union') return [...(old ?? []), ...value.items.filter(i => !(old ?? []).some(o => JSON.stringify(o) === JSON.stringify(i)))];
  if (value?.__op === 'remove') return (old ?? []).filter(o => !value.items.some(i => JSON.stringify(o) === JSON.stringify(i)));
  if (value?.__op === 'ts') return Date.now();
  return value;
}

function write(ref, data, merge) {
  const base = merge ? { ...(store.get(ref.path) ?? {}) } : {};
  for (const [k, v] of Object.entries(data)) base[k] = applyField(base[k], v);
  store.set(ref.path, base);
  notify();
}

export const getDoc = async ref => docSnap(ref);
export const getDocs = async q => querySnap(q);
export const setDoc = async (ref, data, opts) => write(ref, data, !!opts?.merge);
export const updateDoc = async (ref, data) => write(ref, data, true);
export const deleteDoc = async ref => { store.delete(ref.path); notify(); };
export const addDoc = async (col, data) => { const ref = doc(col); write(ref, data, false); return ref; };

export function onSnapshot(ref, a, b, c) {
  const cb = typeof a === 'function' ? a : b;
  const l = { ref, cb, active: true };
  listeners.add(l);
  setTimeout(() => l.active && cb(snapOf(ref)), 0);
  return () => { l.active = false; listeners.delete(l); };
}

export function writeBatch() {
  const ops = [];
  return {
    set: (ref, data, opts) => ops.push(() => write(ref, data, !!opts?.merge)),
    update: (ref, data) => ops.push(() => write(ref, data, true)),
    delete: ref => ops.push(() => { store.delete(ref.path); notify(); }),
    commit: async () => ops.forEach(op => op())
  };
}

export const runTransaction = async (db, fn) => fn({
  get: async ref => docSnap(ref),
  set: (ref, data, opts) => write(ref, data, !!opts?.merge),
  update: (ref, data) => write(ref, data, true),
  delete: ref => { store.delete(ref.path); notify(); }
});

export const arrayUnion = (...items) => ({ __op: 'union', items });
export const arrayRemove = (...items) => ({ __op: 'remove', items });
export const serverTimestamp = () => ({ __op: 'ts' });

export const initializeFirestore = () => ({});
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const terminate = async () => {};
export const clearIndexedDbPersistence = async () => {};
