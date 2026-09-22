// Der Offline-Weg in db.js: online eine Transaktion, offline aus dem lokalen
// Cache lesen und schreiben, ohne auf die Server-Bestaetigung zu warten.
// Genau das haengt sonst die App auf, siehe js/offline-write.js.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __state, __reset } from './stubs/firebase-firestore.js';
import { addVisitedCity, addWishlistCity, addVisitedCountry } from '../js/db.js?v=26';

const SEED = () => ({
  visited_countries: [], wishlist_countries: [],
  visited_cities: [], wishlist_cities: []
});
const CITY = { name: 'Split', lat: 43.5, lng: 16.4, country: 'Croatia' };

// navigator ist in Node nur lesbar, deshalb ueber vitest ersetzen.
function setOnline(online) {
  vi.stubGlobal('navigator', { onLine: online });
}

// Laeuft der Aufruf in sinnvoller Zeit durch? Offline darf er nicht auf die
// nie kommende Bestaetigung warten.
function completes(promise) {
  return Promise.race([
    promise.then(v => ({ done: true, value: v })),
    new Promise(resolve => setTimeout(() => resolve({ done: false }), 60))
  ]);
}

beforeEach(() => { __reset(SEED()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('offline', () => {
  beforeEach(() => {
    setOnline(false);
    __state.ackWrites = false;
    // Ohne Netz lehnt Firestore jede Transaktion ab. Wer hier trotzdem eine
    // startet, faellt damit im Test auf.
    const err = new Error('server unreachable');
    err.code = 'unavailable';
    __state.transactionError = err;
  });

  it('haengt beim Hinzufuegen einer Stadt nicht an der Server-Bestaetigung', async () => {
    const result = await completes(addVisitedCity('u1', CITY));
    expect(result.done).toBe(true);
    expect(__state.writes.map(([kind]) => kind)).toEqual(['update']);
    expect(__state.writes[0][1].visited_cities).toContainEqual(expect.objectContaining({ name: 'Split' }));
  });

  it('liefert den Status der Wunschliste auch ohne Netz', async () => {
    const result = await completes(addWishlistCity('u1', CITY));
    expect(result).toEqual({ done: true, value: 'added' });
  });

  it('haengt auch bei einem einfachen Feld-Update nicht', async () => {
    const result = await completes(addVisitedCountry('u1', 'HR'));
    expect(result.done).toBe(true);
  });

  it('legt das Dokument an, wenn im Cache noch keines liegt', async () => {
    __reset(null);
    __state.ackWrites = false;
    await completes(addVisitedCity('u1', CITY));
    expect(__state.writes.map(([kind]) => kind)).toEqual(['set']);
  });
});

describe('online', () => {
  beforeEach(() => { setOnline(true); });

  it('schreibt in einer Transaktion', async () => {
    await addVisitedCity('u1', CITY);
    expect(__state.writes.map(([kind]) => kind)).toEqual(['update']);
  });

  it('weicht auf den lokalen Weg aus, wenn der Server nicht antwortet', async () => {
    // Browser meldet online, Firestore erreicht den Server trotzdem nicht.
    const err = new Error('server unreachable');
    err.code = 'unavailable';
    __state.transactionError = err;
    __state.ackWrites = false;

    const result = await completes(addVisitedCity('u1', CITY));
    expect(result.done).toBe(true);
    expect(__state.writes.map(([kind]) => kind)).toEqual(['update']);
  });

  it('reicht echte Fehler weiter, statt sie als Offline zu deuten', async () => {
    const err = new Error('denied');
    err.code = 'permission-denied';
    __state.transactionError = err;
    await expect(addVisitedCity('u1', CITY)).rejects.toThrow('denied');
    expect(__state.writes).toEqual([]);
  });
});
