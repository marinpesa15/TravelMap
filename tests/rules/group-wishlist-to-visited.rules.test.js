// Emulator-Tests fuer die Umwandlung Wunsch-Stadt -> besuchte Stadt auf einer
// Gruppenkarte. Laeuft die echte Funktion aus js/db.js mit aktiven Rules.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertFails
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useDb } from '../stubs/config-emulator.js';
import { markGroupWishlistCityVisited } from '../../js/db.js';

let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Eigene projectId, damit clearFirestore die parallel laufenden
    // Rules-Dateien nicht stoert.
    projectId: 'travelmap-rules-test-group-cities',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

const anna = { uid: 'anna', photoURL: 'anna.jpg', displayName: 'Anna' };
const me   = { uid: 'me',   photoURL: 'me.jpg',   displayName: 'Me' };
const rom  = { name: 'Rom',  lat: 41.9, lng: 12.5, country: 'IT', lived: false, addedBy: anna };
const oslo = { name: 'Oslo', lat: 59.9, lng: 10.7, country: 'NO', lived: false, addedBy: anna };

const seedGroup = (data = {}) => env.withSecurityRulesDisabled(ctx =>
  setDoc(doc(ctx.firestore(), 'groups', 'g1'), {
    name: 'Reisegruppe',
    created_by: 'anna',
    members: ['me', 'anna'],
    visited_cities: [],
    wishlist_cities: [rom, oslo],
    ...data
  })
);

const readGroup = async () =>
  (await getDoc(doc(env.authenticatedContext('me').firestore(), 'groups', 'g1'))).data();

const where = (data, name) => ({
  visited:  data.visited_cities.filter(c => c.name === name).length,
  wishlist: data.wishlist_cities.filter(c => c.name === name).length
});

describe('markGroupWishlistCityVisited', () => {
  it('verschiebt die Stadt und setzt das umwandelnde Mitglied als addedBy', async () => {
    await seedGroup();
    useDb(env.authenticatedContext('me').firestore());

    await markGroupWishlistCityVisited('g1', 'Rom', me);

    const data = await readGroup();
    expect(data.visited_cities).toEqual([{ ...rom, addedBy: me }]);
    expect(data.wishlist_cities).toEqual([oslo]);
    expect(data.members).toEqual(['me', 'anna']);
  });

  it('ist idempotent, ein zweiter Aufruf aendert nichts mehr', async () => {
    await seedGroup();
    useDb(env.authenticatedContext('me').firestore());

    await markGroupWishlistCityVisited('g1', 'Rom', me);
    await markGroupWishlistCityVisited('g1', 'Rom', anna);

    const data = await readGroup();
    expect(where(data, 'Rom')).toEqual({ visited: 1, wishlist: 0 });
    expect(data.visited_cities[0].addedBy).toEqual(me);
  });

  it('verbietet einem Nicht-Mitglied die Umwandlung', async () => {
    await seedGroup();
    useDb(env.authenticatedContext('eve').firestore());

    await assertFails(markGroupWishlistCityVisited('g1', 'Rom',
      { uid: 'eve', photoURL: '', displayName: 'Eve' }));

    const data = await readGroup();
    expect(where(data, 'Rom')).toEqual({ visited: 0, wishlist: 1 });
  });
});
