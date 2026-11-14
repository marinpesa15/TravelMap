import { describe, it, expect } from 'vitest';
import {
  LIMITS, validateDraft, sortStories, storyPages, citiesWithStories,
  storyPaths, storagePath, orphanStories
} from '../js/story-logic.js';

const draft = over => ({ date: null, text: '', photos: [], voice: null, song: null, shared: false, ...over });

describe('validateDraft', () => {
  it('lehnt eine Story ohne jeden Inhalt ab', () => {
    expect(validateDraft(draft())).toBe('empty');
    expect(validateDraft(draft({ text: '   ' }))).toBe('empty');
    expect(validateDraft(draft({ date: new Date() }))).toBe('empty');
  });
  it('akzeptiert jeden einzelnen Inhalt', () => {
    expect(validateDraft(draft({ text: 'x' }))).toBeNull();
    expect(validateDraft(draft({ photos: [{}] }))).toBeNull();
    expect(validateDraft(draft({ voice: { seconds: 5 } }))).toBeNull();
    expect(validateDraft(draft({ song: { id: 'a' } }))).toBeNull();
  });
  it('prueft die Grenzen', () => {
    expect(validateDraft(draft({ photos: Array(11).fill({}) }))).toBe('too-many-photos');
    expect(validateDraft(draft({ text: 'x'.repeat(2001) }))).toBe('text-too-long');
    expect(validateDraft(draft({ voice: { seconds: 121 } }))).toBe('voice-too-long');
    expect(LIMITS).toEqual({ photos: 10, textChars: 2000, voiceSeconds: 120 });
  });
});

it('sortStories: nach Datum, undatierte nach created_at ans Ende', () => {
  const s = [
    { id: 'c', date: null, created_at: 30 },
    { id: 'b', date: 20, created_at: 99 },
    { id: 'd', date: null, created_at: 10 },
    { id: 'a', date: 5, created_at: 50 }
  ];
  expect(sortStories(s).map(x => x.id)).toEqual(['a', 'b', 'd', 'c']);
  expect(s.map(x => x.id)).toEqual(['c', 'b', 'd', 'a']);
});

it('sortStories: versteht Firestore-Timestamps', () => {
  const ts = ms => ({ toMillis: () => ms });
  const s = [{ id: 'b', date: ts(20) }, { id: 'a', date: ts(5) }];
  expect(sortStories(s).map(x => x.id)).toEqual(['a', 'b']);
});

it('storyPages: eine Seite je Foto, sonst eine Textseite', () => {
  expect(storyPages({ photos: [{ path: 'p0' }, { path: 'p1' }] }))
    .toEqual([{ kind: 'photo', path: 'p0' }, { kind: 'photo', path: 'p1' }]);
  expect(storyPages({ photos: [], text: 'hi' })).toEqual([{ kind: 'text' }]);
});

it('Pfade und Zuordnung', () => {
  expect(storagePath('u1', 's1', 2)).toBe('users/u1/stories/s1/p2.jpg');
  expect(storagePath('u1', 's1', 'voice')).toBe('users/u1/stories/s1/voice.m4a');
  expect(storyPaths({ photos: [{ path: 'a' }], voice: { path: 'v' } })).toEqual(['a', 'v']);
  expect(storyPaths({ photos: [], voice: null })).toEqual([]);
  expect([...citiesWithStories([{ city: 'Wien' }, { city: 'Wien' }, { city: 'Rom' }])]).toEqual(['Wien', 'Rom']);
  expect(orphanStories([{ city: 'Wien' }, { city: 'Rom' }], { visited_cities: [{ name: 'Wien' }] }))
    .toEqual([{ city: 'Rom' }]);
});
