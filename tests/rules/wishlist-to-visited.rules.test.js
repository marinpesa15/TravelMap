// Emulator-Tests fuer die Umwandlung Wunsch-Stadt -> besuchte Stadt.
// Laeuft die echte Funktion aus js/db.js mit aktiven Rules. Ein zweiter
// Client beobachtet das Dokument und haelt jeden Snapshot fest, damit ein
// Zwischenzustand (Stadt in keiner oder in beiden Listen) auffallen wuerde.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, onSnapshot, runTransaction } from 'firebase/firestore';
import { useDb } from '../stubs/config-emulator.js';
import { markWishlistCityVisited } from '../../js/db.js';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Eigene projectId: vitest laeuft die Dateien parallel, und clearFirestore
    // wuerde sonst die Daten der anderen Rules-Datei mitloeschen.
    projectId: 'travelmap-rules-test-cities',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const rom  = { name: 'Rom',  lat: 41.9, lng: 12.5, country: 'IT' };
const oslo = { name: 'Oslo', lat: 59.9, lng: 10.7, country: 'NO' };

const seedUser = (data = {}) => env.withSecurityRulesDisabled(ctx =>
  setDoc(doc(ctx.firestore(), 'users', 'me'), {
    display_name: 'Me',
    visited_countries: [],
    wishlist_countries: ['IT'],
    visited_cities: [],
    wishlist_cities: [rom, oslo],
    ...data
  })
);

// withSecurityRulesDisabled reicht keinen Rueckgabewert durch, deshalb lesen
// wir als Owner (die Rules erlauben das).
const readUser = async () =>
  (await getDoc(doc(env.authenticatedContext('me').firestore(), 'users', 'me'))).data();

const where = (data = {}, name) => ({
  visited:  (data.visited_cities  ?? []).filter(c => c.name === name).length,
  wishlist: (data.wishlist_cities ?? []).filter(c => c.name === name).length
});

describe('markWishlistCityVisited', () => {
  it('verschiebt die Stadt nach visited_cities und nimmt sie von der Wunschliste', async () => {
    await seedUser();
    useDb(env.authenticatedContext('me').firestore());

    await markWishlistCityVisited('me', 'Rom');

    const data = await readUser();
    expect(data.visited_cities).toEqual([{ ...rom, lived: false }]);
    expect(data.wishlist_cities).toEqual([oslo]);
    expect(data.visited_countries).toEqual(['IT']);
    expect(data.wishlist_countries).toEqual([]);
  });

  it('laesst fuer einen Beobachter keinen Zwischenzustand sichtbar werden', async () => {
    await seedUser();
    useDb(env.authenticatedContext('me').firestore());
    const observer = env.authenticatedContext('me').firestore();

    const seen = [];
    let unsub;
    const done = new Promise((resolve, reject) => {
      unsub = onSnapshot(doc(observer, 'users', 'me'), snap => {
        const state = where(snap.data(), 'Rom');
        seen.push(state);
        if (state.visited === 1) resolve();
      }, reject);
    });
    // Erst schreiben, wenn der Beobachter den Ausgangszustand hat.
    await new Promise(r => { const t = setInterval(() => seen.length && (clearInterval(t), r()), 10); });

    await markWishlistCityVisited('me', 'Rom');
    await done;
    unsub();

    expect(seen[0]).toEqual({ visited: 0, wishlist: 1 });
    expect(seen.at(-1)).toEqual({ visited: 1, wishlist: 0 });
    // Jeder beobachtete Zustand: genau eine der beiden Listen.
    for (const s of seen) expect(s.visited + s.wishlist).toBe(1);
  });

  it('ist idempotent, ein zweiter Aufruf aendert nichts mehr', async () => {
    await seedUser();
    useDb(env.authenticatedContext('me').firestore());

    await markWishlistCityVisited('me', 'Rom');
    await markWishlistCityVisited('me', 'Rom');

    const data = await readUser();
    expect(where(data, 'Rom')).toEqual({ visited: 1, wishlist: 0 });
  });

  it('verbietet einem Freund, die Umwandlung in meinem Dokument auszufuehren', async () => {
    await seedUser();
    await env.withSecurityRulesDisabled(ctx =>
      setDoc(doc(ctx.firestore(), 'users', 'me', 'friends', 'anna'),
        { display_name: 'Anna', avatar_url: '' }));
    const anna = env.authenticatedContext('anna').firestore();

    // Anna darf lesen (Freund), aber nicht schreiben.
    await assertFails(runTransaction(anna, async tx => {
      const ref = doc(anna, 'users', 'me');
      await tx.get(ref);
      tx.update(ref, { visited_cities: [{ ...rom, lived: false }], wishlist_cities: [oslo] });
    }));
  });
});
