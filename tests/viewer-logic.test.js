import { it, expect } from 'vitest';
import { step } from '../js/viewer-logic.js';
const stories = [{ photos: [{ path: 'a' }, { path: 'b' }] }, { photos: [], text: 'x' }];

it('blaettert durch Seiten und dann zur naechsten Story', () => {
  expect(step({ story: 0, page: 0 }, stories, 1)).toEqual({ story: 0, page: 1 });
  expect(step({ story: 0, page: 1 }, stories, 1)).toEqual({ story: 1, page: 0 });
});
it('schliesst am Ende', () => {
  expect(step({ story: 1, page: 0 }, stories, 1)).toBeNull();
});
it('geht zurueck auf die letzte Seite der vorigen Story und bleibt am Anfang stehen', () => {
  expect(step({ story: 1, page: 0 }, stories, -1)).toEqual({ story: 0, page: 1 });
  expect(step({ story: 0, page: 0 }, stories, -1)).toEqual({ story: 0, page: 0 });
});
