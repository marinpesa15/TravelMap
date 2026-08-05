import { describe, it, expect } from 'vitest';
import { stripMyCities, planGroupChange } from '../js/account-logic.js';

const city = (name, uid) => uid === undefined
  ? { name }
  : { name, addedBy: { uid, displayName: 'X', photoURL: 'p' } };

describe('stripMyCities', () => {
  it('entfernt nur die eigenen Staedte', () => {
    const cities = [city('Rom', 'me'), city('Wien', 'other'), city('Oslo', 'me')];
    expect(stripMyCities(cities, 'me').map(c => c.name)).toEqual(['Wien']);
  });

  it('behaelt Staedte ohne addedBy, weil sie niemandem zuzuordnen sind', () => {
    const cities = [city('Alt'), city('Rom', 'me')];
    expect(stripMyCities(cities, 'me').map(c => c.name)).toEqual(['Alt']);
  });

  it('vertraegt eine leere Liste', () => {
    expect(stripMyCities([], 'me')).toEqual([]);
  });
});

const group = (over = {}) => ({
  id: 'g1',
  created_by: 'me',
  members: ['me', 'anna', 'ben'],
  visited_cities: [city('Rom', 'me'), city('Wien', 'anna')],
  wishlist_cities: [city('Oslo', 'me')],
  ...over
});

describe('planGroupChange', () => {
  it('loescht die Gruppe, wenn ich das letzte Mitglied bin', () => {
    const res = planGroupChange(group({ members: ['me'] }), 'me');
    expect(res).toEqual({ action: 'delete' });
  });

  it('uebergibt an das erste verbleibende Mitglied, wenn ich Ersteller bin', () => {
    const res = planGroupChange(group(), 'me');
    expect(res.action).toBe('update');
    expect(res.data.created_by).toBe('anna');
    expect(res.data.members).toEqual(['anna', 'ben']);
  });

  it('laesst created_by unangetastet, wenn ich nicht Ersteller bin', () => {
    const res = planGroupChange(group({ created_by: 'anna' }), 'me');
    expect(res.action).toBe('update');
    expect(res.data).not.toHaveProperty('created_by');
    expect(res.data.members).toEqual(['anna', 'ben']);
  });

  it('entfernt meine Staedte aus beiden Listen', () => {
    const res = planGroupChange(group(), 'me');
    expect(res.data.visited_cities.map(c => c.name)).toEqual(['Wien']);
    expect(res.data.wishlist_cities).toEqual([]);
  });

  it('vertraegt Gruppen ohne Staedte-Felder', () => {
    const g = { id: 'g2', created_by: 'anna', members: ['anna', 'me'] };
    const res = planGroupChange(g, 'me');
    expect(res.data.visited_cities).toEqual([]);
    expect(res.data.wishlist_cities).toEqual([]);
  });
});
