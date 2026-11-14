import { describe, it, expect } from 'vitest';
import { fitSize, squareCrop } from '../js/image-logic.js';

describe('fitSize', () => {
  it('verkleinert die lange Kante auf max und haelt das Seitenverhaeltnis', () => {
    expect(fitSize(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 });
    expect(fitSize(3000, 4000, 1600)).toEqual({ w: 1200, h: 1600 });
  });
  it('vergroessert nie', () => {
    expect(fitSize(800, 600, 1600)).toEqual({ w: 800, h: 600 });
  });
  it('haelt bei Panoramen mindestens 1 px', () => {
    expect(fitSize(16000, 4, 1600)).toEqual({ w: 1600, h: 1 });
  });
});
describe('squareCrop', () => {
  it('schneidet mittig', () => {
    expect(squareCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, size: 3000 });
    expect(squareCrop(3000, 4000)).toEqual({ sx: 0, sy: 500, size: 3000 });
  });
});
