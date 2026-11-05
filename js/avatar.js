// ===== Avatare =====
//
// Ein Profilbild ist nie sicher: Google liefert es nur online, antwortet
// manchmal mit 429, Apple gibt gar keins heraus. Frueher stand dann das
// Broken-Image-Symbol von iOS in der Liste. Jetzt steht immer zuerst ein
// Kreis mit den Initialen da, das Bild legt sich erst darueber, wenn es
// wirklich geladen ist. Scheitert es, bleibt der Kreis.
//
// Die reinen Helfer (initials, avatarColor) sind ohne DOM testbar.

// Acht Farben, die im dunklen wie im hellen Theme lesbar bleiben.
const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#f43f5e'
];

/**
 * Initialen aus einem Anzeigenamen: erster Buchstabe des ersten und des
 * letzten Wortes. "Christian Göhner" → "CG", "Martina" → "M". Ohne Namen "?".
 */
export function initials(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/^[^\p{L}\p{N}]+/u, '')) // Emojis, Klammern etc. am Wortanfang weg
    .filter(Boolean);
  if (!words.length) return '?';
  const first = [...words[0]][0];
  if (words.length === 1) return first.toUpperCase();
  const last = [...words[words.length - 1]][0];
  return (first + last).toUpperCase();
}

/** Stabile Farbe pro Person: gleicher Seed (uid), gleiche Farbe. */
export function avatarColor(seed) {
  const str = String(seed ?? '');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

// Avatar-URLs schreiben andere Nutzer, deshalb nur http(s) und Bilder als
// Daten-URL. Letztere kommen vom Foto-Dialog der Gruppen (js/ui.js), der
// das gewaehlte Bild als JPEG-Daten-URL in Firestore ablegt.
export function safeAvatarUrl(url) {
  const u = String(url ?? '');
  if (/^https?:\/\//i.test(u)) return u;
  if (/^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(u)) return u;
  return '';
}

/**
 * Baut das Avatar-Element: Kreis mit Initialen, darueber das Bild, sobald
 * es geladen ist. `className` ergaenzt die Groessenklasse der Aufrufstelle
 * (social-avatar, user-avatar, group-pin-img).
 *
 * @param {{ name?: string, url?: string, seed?: string, className?: string }} opts
 */
export function avatarEl({ name, url, seed, className = '' } = {}) {
  const el = document.createElement('span');
  el.className = `avatar ${className}`.trim();
  el.style.background = avatarColor(seed ?? name);
  el.setAttribute('aria-hidden', 'true');

  const text = document.createElement('span');
  text.className = 'avatar-initials';
  text.textContent = initials(name);
  el.appendChild(text);

  const src = safeAvatarUrl(url);
  if (src) attachImage(el, src);
  return el;
}

/**
 * Legt das Bild ueber den Platzhalter. Zuerst direkt von der Quelle (online
 * der schnellste Weg, der Browser-Cache hilft mit). Scheitert das, etwa
 * offline, kommt die Kopie aus IndexedDB. Scheitert auch die, bleibt der
 * Kreis mit den Initialen.
 */
function attachImage(el, src) {
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  let triedCache = false;
  img.addEventListener('load', () => img.classList.add('loaded'));
  img.addEventListener('error', async () => {
    if (triedCache) { img.remove(); return; }
    triedCache = true;
    const cached = await readCachedAvatar(src);
    if (cached) img.src = cached;
    else img.remove();
  });
  el.appendChild(img);
  img.src = src;
  if (/^https?:/i.test(src)) cacheAvatar(src);
}

// ===== Lokaler Bild-Cache =====
// Einmal geladene Avatare liegen als Blob in IndexedDB, damit sie beim
// naechsten Start auch ohne Netz da sind. Alles best effort: wo IndexedDB
// oder CORS fehlen, laeuft es ohne Cache weiter.

const DB_NAME    = 'tm-avatars';
const STORE      = 'images';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let _dbPromise = null;
const _objectUrls = new Map(); // src → object URL, pro Sitzung nur einmal erzeugt

function openDb() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return _dbPromise;
}

function idbGet(db, key) {
  return new Promise(resolve => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbPut(db, key, value) {
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
  } catch { /* Cache ist optional */ }
}

async function readCachedAvatar(src) {
  if (_objectUrls.has(src)) return _objectUrls.get(src);
  const db = await openDb();
  if (!db) return null;
  const entry = await idbGet(db, src);
  if (!entry?.blob || Date.now() - entry.at > MAX_AGE_MS) return null;
  const url = URL.createObjectURL(entry.blob);
  _objectUrls.set(src, url);
  return url;
}

// Pro Sitzung und Adresse nur ein Versuch, und keiner, wenn die Kopie
// schon frisch genug ist.
const _cacheAttempted = new Set();

async function cacheAvatar(src) {
  if (_cacheAttempted.has(src)) return;
  _cacheAttempted.add(src);
  const db = await openDb();
  if (!db) return;
  const existing = await idbGet(db, src);
  if (existing?.blob && Date.now() - existing.at < MAX_AGE_MS / 2) return;
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) return;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return;
    idbPut(db, src, { blob, at: Date.now() });
  } catch { /* kein CORS oder kein Netz, dann eben nicht */ }
}
