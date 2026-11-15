import { describe, it, expect } from 'vitest';
import { mapTracks, tokenIsFresh } from './spotify-logic.js';

describe('spotify-logic', () => {
  it('mapTracks nimmt Titel, alle Kuenstler und das kleinste Cover ab 64 px', () => {
    const json = { tracks: { items: [{
      id: 't1', name: 'Song', artists: [{ name: 'A' }, { name: 'B' }],
      album: { images: [{ url: 'big', width: 640 }, { url: 'mid', width: 300 }, { url: 'small', width: 64 }] }
    }] } };
    expect(mapTracks(json)).toEqual([{ id: 't1', title: 'Song', artist: 'A, B', cover_url: 'small' }]);
  });
  it('mapTracks vertraegt leere und kaputte Antworten', () => {
    expect(mapTracks({})).toEqual([]);
    expect(mapTracks({ tracks: { items: [null, { id: 'x', name: 'N', artists: [], album: {} }] } }))
      .toEqual([{ id: 'x', title: 'N', artist: '', cover_url: '' }]);
  });
  it('tokenIsFresh laesst 60 s Puffer', () => {
    expect(tokenIsFresh({ expiresAt: 100000 }, 30000)).toBe(true);
    expect(tokenIsFresh({ expiresAt: 100000 }, 50000)).toBe(false);
    expect(tokenIsFresh(null, 0)).toBe(false);
  });
});
