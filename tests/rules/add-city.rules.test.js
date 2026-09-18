// Emulator-Tests fuer das Hinzufuegen von Staedten ueber die Suche und das
// Aufraeumen alter Doppel-Eintraege. Laeuft die echten Funktionen aus
// js/db.js mit aktiven Rules. Eine Stadt darf nie gleichzeitig in
// visited_cities und wishlist_cities stehen.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { useDb } from '../stubs/config-emulator.js';
import { addVisitedCity, addWishlistCity, dedupeUserCities } from '../../js/db.js';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Eigene projectId, siehe wishlist-to-visited.rules.test.js
    projectId: 'travelmap-rules-test-add-city',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  useDb(env.authenticatedContext('me').firestore());
});

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

const readUser = async () =>
  (await getDoc(doc(env.authenticatedContext('me').firestore(), 'users', 'me'))).data();

const where = (data = {}, name) => ({
  visited:  (data.visited_cities  ?? []).filter(c => c.name === name).length,
  wishlist: (data.wishlist_cities ?? []).filter(c => c.name === name).length
});

describe('addVisitedCity', () => {
  it('nimmt die gleichnamige Wunsch-Stadt mit raus und behaelt lived', async () => {
    await seedUser();
    // Suchergebnis weicht vom gespeicherten Wunsch-Objekt ab (Koordinaten)
    await addVisitedCity('me', { ...rom, lat: 41.9028, lived: true });

    const data = await readUser();
    expect(data.visited_cities).toEqual([{ ...rom, lat: 41.9028, lived: true }]);
    expect(data.wishlist_cities).toEqual([oslo]);
    expect(data.visited_countries).toEqual(['IT']);
    expect(data.wishlist_countries).toEqual([]);
  });

  it('laesst fuer einen Beobachter keinen Zwischenzustand sichtbar werden', async () => {
    await seedUser();
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
    await new Promise(r => { const t = setInterval(() => seen.length && (clearInterval(t), r()), 10); });

    await addVisitedCity('me', { ...rom, lived: false });
    await done;
    unsub();

    for (const s of seen) expect(s.visited + s.wishlist).toBe(1);
    expect(seen.at(-1)).toEqual({ visited: 1, wishlist: 0 });
  });

  it('legt das Dokument an, wenn es noch nicht existiert', async () => {
    await addVisitedCity('me', { ...rom, lived: false });

    const data = await readUser();
    expect(data.visited_cities).toEqual([{ ...rom, lived: false }]);
    expect(data.wishlist_cities).toEqual([]);
    expect(data.visited_countries).toEqual(['IT']);
  });
});

describe('addWishlistCity', () => {
  it('lehnt eine schon besuchte Stadt ab und aendert nichts', async () => {
    const visited = { ...rom, lived: true };
    await seedUser({ visited_cities: [visited], wishlist_cities: [oslo] });

    const status = await addWishlistCity('me', { ...rom, lat: 41.9028 });

    expect(status).toBe('alreadyVisited');
    const data = await readUser();
    expect(data.visited_cities).toEqual([visited]);
    expect(data.wishlist_cities).toEqual([oslo]);
  });

  it('fuegt eine neue Stadt hinzu', async () => {
    await seedUser({ wishlist_cities: [oslo] });

    const status = await addWishlistCity('me', rom);

    expect(status).toBe('added');
    expect((await readUser()).wishlist_cities).toEqual([oslo, rom]);
  });

  it('legt das Dokument an, wenn es noch nicht existiert', async () => {
    expect(await addWishlistCity('me', rom)).toBe('added');
    expect((await readUser()).wishlist_cities).toEqual([rom]);
  });
});

describe('dedupeUserCities', () => {
  it('entfernt Wunsch-Staedte, die auch besucht sind', async () => {
    await seedUser({ visited_cities: [{ ...rom, lived: true }] });

    await dedupeUserCities('me');

    const data = await readUser();
    expect(data.wishlist_cities).toEqual([oslo]);
    expect(data.visited_cities).toEqual([{ ...rom, lived: true }]);
  });

  it('schreibt nichts, wenn es keine Doppel-Eintraege gibt', async () => {
    await seedUser();
    const before = await readUser();

    await dedupeUserCities('me');

    expect(await readUser()).toEqual(before);
  });

  it('vertraegt ein fehlendes Dokument', async () => {
    await expect(dedupeUserCities('me')).resolves.toBeUndefined();
  });
});
