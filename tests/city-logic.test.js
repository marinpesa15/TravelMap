import { describe, it, expect } from 'vitest';
import {
  planMarkWishlistCityVisited, planMarkGroupWishlistCityVisited,
  planAddVisitedCity, planAddWishlistCity, planDedupeCities
} from '../js/city-logic.js';

const rom  = { name: 'Rom',  lat: 41.9, lng: 12.5, country: 'IT' };
const oslo = { name: 'Oslo', lat: 59.9, lng: 10.7, country: 'NO' };

const user = (over = {}) => ({
  visited_countries: [],
  wishlist_countries: [],
  visited_cities: [],
  wishlist_cities: [rom, oslo],
  ...over
});

describe('planMarkWishlistCityVisited', () => {
  it('legt die Stadt mit denselben Defaults wie der normale Weg in visited_cities an', () => {
    const plan = planMarkWishlistCityVisited(user(), 'Rom');
    expect(plan.visited_cities).toEqual([{ ...rom, lived: false }]);
  });

  it('entfernt die Stadt aus wishlist_cities und laesst die anderen stehen', () => {
    const plan = planMarkWishlistCityVisited(user(), 'Rom');
    expect(plan.wishlist_cities).toEqual([oslo]);
  });

  it('steht nach dem Plan in genau einer der beiden Listen', () => {
    const plan = planMarkWishlistCityVisited(user(), 'Rom');
    const inVisited  = plan.visited_cities.filter(c => c.name === 'Rom').length;
    const inWishlist = plan.wishlist_cities.filter(c => c.name === 'Rom').length;
    expect([inVisited, inWishlist]).toEqual([1, 0]);
  });

  it('findet die Stadt auch, wenn das Objekt zusaetzliche Felder traegt', () => {
    // Genau deshalb kein arrayRemove: das braucht exakte Objektgleichheit.
    const legacy = { ...rom, addedAt: 123 };
    const plan = planMarkWishlistCityVisited(user({ wishlist_cities: [legacy] }), 'Rom');
    expect(plan.wishlist_cities).toEqual([]);
    expect(plan.visited_cities).toEqual([{ ...legacy, lived: false }]);
  });

  it('markiert das Land als besucht und nimmt es von der Laender-Wunschliste', () => {
    const plan = planMarkWishlistCityVisited(
      user({ visited_countries: ['DE'], wishlist_countries: ['IT', 'NO'] }), 'Rom');
    expect(plan.visited_countries).toEqual(['DE', 'IT']);
    expect(plan.wishlist_countries).toEqual(['NO']);
  });

  it('dupliziert ein bereits besuchtes Land nicht', () => {
    const plan = planMarkWishlistCityVisited(user({ visited_countries: ['IT'] }), 'Rom');
    expect(plan.visited_countries).toEqual(['IT']);
  });

  it('laesst die Laender unangetastet, wenn die Stadt kein Land hat', () => {
    for (const country of ['XX', '', undefined]) {
      const city = { ...rom, country };
      const plan = planMarkWishlistCityVisited(user({ wishlist_cities: [city] }), 'Rom');
      expect(plan).not.toHaveProperty('visited_countries');
      expect(plan).not.toHaveProperty('wishlist_countries');
    }
  });

  it('legt keinen Doppelgaenger an, wenn die Stadt schon besucht ist', () => {
    const visited = { ...rom, lived: true };
    const plan = planMarkWishlistCityVisited(user({ visited_cities: [visited] }), 'Rom');
    expect(plan.visited_cities).toEqual([visited]);
    expect(plan.wishlist_cities).toEqual([oslo]);
  });

  it('tut nichts, wenn die Stadt nicht (mehr) auf der Wunschliste steht', () => {
    // z. B. auf einem anderen Geraet schon umgewandelt
    expect(planMarkWishlistCityVisited(user(), 'Paris')).toBeNull();
  });

  it('vertraegt ein Dokument ohne die Listenfelder', () => {
    expect(planMarkWishlistCityVisited({}, 'Rom')).toBeNull();
  });
});

describe('planMarkGroupWishlistCityVisited', () => {
  const anna = { uid: 'anna', photoURL: 'anna.jpg', displayName: 'Anna' };
  const me   = { uid: 'me',   photoURL: 'me.jpg',   displayName: 'Me' };
  const group = (over = {}) => ({
    visited_cities: [],
    wishlist_cities: [{ ...rom, lived: false, addedBy: anna }, { ...oslo, lived: false, addedBy: anna }],
    ...over
  });

  it('verschiebt die Stadt mit dem umwandelnden Mitglied als addedBy', () => {
    const plan = planMarkGroupWishlistCityVisited(group(), 'Rom', me);
    expect(plan.visited_cities).toEqual([{ ...rom, lived: false, addedBy: me }]);
    expect(plan.wishlist_cities).toEqual([{ ...oslo, lived: false, addedBy: anna }]);
  });

  it('schreibt nur die beiden Staedte-Felder, keine Laender', () => {
    const plan = planMarkGroupWishlistCityVisited(group(), 'Rom', me);
    expect(Object.keys(plan).sort()).toEqual(['visited_cities', 'wishlist_cities']);
  });

  it('laesst einen schon besuchten Pin unveraendert und entfernt nur den Wunsch', () => {
    const existing = { ...rom, lived: false, addedBy: anna };
    const plan = planMarkGroupWishlistCityVisited(group({ visited_cities: [existing] }), 'Rom', me);
    expect(plan.visited_cities).toEqual([existing]);
    expect(plan.wishlist_cities.map(c => c.name)).toEqual(['Oslo']);
  });

  it('liefert null, wenn die Stadt nicht (mehr) auf der Wunschliste steht', () => {
    expect(planMarkGroupWishlistCityVisited(group(), 'Paris', me)).toBeNull();
    expect(planMarkGroupWishlistCityVisited({}, 'Rom', me)).toBeNull();
  });
});

describe('planAddVisitedCity', () => {
  it('nimmt eine gleichnamige Stadt von der Wunschliste und behaelt den gewaehlten lived-Wert', () => {
    const plan = planAddVisitedCity(user(), { ...rom, lived: true });
    expect(plan.visited_cities).toEqual([{ ...rom, lived: true }]);
    expect(plan.wishlist_cities).toEqual([oslo]);
  });

  it('matcht die Wunsch-Stadt ueber den Namen, auch wenn sich das Objekt unterscheidet', () => {
    // Suchergebnis hat leicht andere Koordinaten als der alte Wunsch-Eintrag,
    // arrayRemove wuerde hier nichts finden.
    const fromSearch = { ...rom, lat: 41.9028, lived: false };
    const plan = planAddVisitedCity(user(), fromSearch);
    expect(plan.wishlist_cities).toEqual([oslo]);
    expect(plan.visited_cities).toEqual([fromSearch]);
  });

  it('haengt eine neue Stadt an, ohne die Wunschliste anzufassen', () => {
    const paris = { name: 'Paris', lat: 48.8, lng: 2.3, country: 'FR', lived: false };
    const plan = planAddVisitedCity(user({ visited_cities: [{ ...oslo, lived: false }], wishlist_cities: [rom] }), paris);
    expect(plan.visited_cities).toEqual([{ ...oslo, lived: false }, paris]);
    expect(plan.wishlist_cities).toEqual([rom]);
  });

  it('aktualisiert lived einer schon besuchten Stadt an Ort und Stelle statt sie zu verdoppeln', () => {
    const plan = planAddVisitedCity(
      user({ visited_cities: [{ ...oslo, lived: false }, { ...rom, lived: false }], wishlist_cities: [] }),
      { ...rom, lived: true });
    expect(plan.visited_cities).toEqual([{ ...oslo, lived: false }, { ...rom, lived: true }]);
  });

  it('markiert das Land als besucht und nimmt es von der Laender-Wunschliste', () => {
    const plan = planAddVisitedCity(
      user({ visited_countries: ['DE'], wishlist_countries: ['IT', 'NO'] }), { ...rom, lived: false });
    expect(plan.visited_countries).toEqual(['DE', 'IT']);
    expect(plan.wishlist_countries).toEqual(['NO']);
  });

  it('laesst die Laender unangetastet, wenn die Stadt kein Land hat', () => {
    for (const country of ['XX', '', undefined]) {
      const plan = planAddVisitedCity(user(), { ...rom, country, lived: false });
      expect(plan).not.toHaveProperty('visited_countries');
      expect(plan).not.toHaveProperty('wishlist_countries');
    }
  });

  it('vertraegt ein Dokument ohne die Listenfelder', () => {
    const plan = planAddVisitedCity({}, { ...rom, lived: false });
    expect(plan.visited_cities).toEqual([{ ...rom, lived: false }]);
    expect(plan.wishlist_cities).toEqual([]);
  });
});

describe('planAddWishlistCity', () => {
  it('lehnt eine schon besuchte Stadt ab und schreibt nichts', () => {
    const result = planAddWishlistCity(user({ visited_cities: [{ ...rom, lived: true }], wishlist_cities: [] }), rom);
    expect(result).toEqual({ status: 'alreadyVisited' });
  });

  it('erkennt die besuchte Stadt ueber den Namen', () => {
    const result = planAddWishlistCity(
      user({ visited_cities: [{ ...rom, lat: 41.9028, lived: false }], wishlist_cities: [] }), rom);
    expect(result.status).toBe('alreadyVisited');
  });

  it('legt keinen zweiten Eintrag an, wenn die Stadt schon auf der Wunschliste steht', () => {
    const result = planAddWishlistCity(user(), { ...rom, lat: 41.9028 });
    expect(result).toEqual({ status: 'unchanged' });
  });

  it('haengt eine neue Stadt an die Wunschliste an', () => {
    const paris = { name: 'Paris', lat: 48.8, lng: 2.3, country: 'FR' };
    const result = planAddWishlistCity(user(), paris);
    expect(result).toEqual({ status: 'added', update: { wishlist_cities: [rom, oslo, paris] } });
  });

  it('vertraegt ein Dokument ohne die Listenfelder', () => {
    expect(planAddWishlistCity({}, rom)).toEqual({ status: 'added', update: { wishlist_cities: [rom] } });
  });
});

describe('planDedupeCities', () => {
  it('entfernt Wunsch-Staedte, die auch besucht sind', () => {
    const plan = planDedupeCities(user({ visited_cities: [{ ...rom, lat: 41.9028, lived: true }] }));
    expect(plan).toEqual({ wishlist_cities: [oslo] });
  });

  it('liefert null, wenn es keine Ueberschneidung gibt', () => {
    expect(planDedupeCities(user({ visited_cities: [{ name: 'Paris', lived: false }] }))).toBeNull();
    expect(planDedupeCities({})).toBeNull();
  });
});
