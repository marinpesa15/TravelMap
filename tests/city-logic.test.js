import { describe, it, expect } from 'vitest';
import { planMarkWishlistCityVisited } from '../js/city-logic.js';

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
