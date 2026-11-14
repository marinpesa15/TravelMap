import { describe, it, expect } from 'vitest';
import { buildPlaceList } from '../js/places-list-logic.js';

const data = {
  visited_cities: [
    { name: 'Lissabon', country: 'PT' },
    { name: 'Wien', country: 'AT', lived: true },
    { name: 'Tokio', country: 'JP' }
  ],
  wishlist_cities: [{ name: 'Kapstadt', country: 'ZA' }]
};

describe('buildPlaceList', () => {
  it('zeigt besuchte zuerst, zuletzt hinzugefuegte oben, dann Wunschliste', () => {
    expect(buildPlaceList(data, 'all').map(p => p.name))
      .toEqual(['Tokio', 'Wien', 'Lissabon', 'Kapstadt']);
  });
  it('filtert', () => {
    expect(buildPlaceList(data, 'lived').map(p => p.name)).toEqual(['Wien']);
    expect(buildPlaceList(data, 'wishlist').map(p => p.name)).toEqual(['Kapstadt']);
    expect(buildPlaceList(data, 'visited').map(p => p.name)).toEqual(['Tokio', 'Wien', 'Lissabon']);
  });
  it('markiert Orte mit Story und vertraegt leere Daten', () => {
    expect(buildPlaceList(data, 'all', new Set(['Wien'])).find(p => p.name === 'Wien').hasStory).toBe(true);
    expect(buildPlaceList({}, 'all')).toEqual([]);
    expect(buildPlaceList(null, 'all')).toEqual([]);
  });
});
