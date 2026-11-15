import { describe, it, expect } from 'vitest';
import { buildPlaceList, filterPlaces, findVisitedCity } from '../js/places-list-logic.js';

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
  it('zeigt im Laender-Modus die Laender statt der Staedte', () => {
    const d = { ...data, visited_countries: ['PT', 'AT'], wishlist_countries: ['ZA'] };
    expect(buildPlaceList(d, 'all', new Set(), 'countries'))
      .toEqual([
        { name: 'AT', country: '', type: 'visited', lived: false, hasStory: false },
        { name: 'PT', country: '', type: 'visited', lived: false, hasStory: false },
        { name: 'ZA', country: '', type: 'wishlist', lived: false, hasStory: false }
      ]);
    expect(buildPlaceList(d, 'wishlist', new Set(), 'countries').map(p => p.name)).toEqual(['ZA']);
    expect(buildPlaceList({}, 'all', new Set(), 'countries')).toEqual([]);
  });
});

describe('filterPlaces', () => {
  const list = buildPlaceList({ visited_cities: [{ name: 'München' }, { name: 'Málaga' }, { name: 'Wien' }] }, 'visited');
  it('filtert ohne Gross- und Kleinschreibung und Akzente', () => {
    expect(filterPlaces(list, 'mun').map(p => p.name)).toEqual(['München']);
    expect(filterPlaces(list, 'MALA').map(p => p.name)).toEqual(['Málaga']);
  });
  it('leere Eingabe zeigt alles', () => {
    expect(filterPlaces(list, '  ')).toEqual(list);
  });
});

describe('findVisitedCity', () => {
  it('findet nur besuchte Staedte', () => {
    expect(findVisitedCity(data, 'Wien')).toEqual({ name: 'Wien', country: 'AT', lived: true });
    expect(findVisitedCity(data, 'Kapstadt')).toBeNull();
    expect(findVisitedCity(null, 'Wien')).toBeNull();
  });
});
