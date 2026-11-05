// Die Offline-Karte aus js/fallback-style.js: ein Style ohne Netz-Abhaengigkeit.
import { describe, it, expect } from 'vitest';
import { buildFallbackStyle, isFallbackStyle, FALLBACK_SOURCE } from '../js/fallback-style.js?v=1';

const GEOJSON = { type: 'FeatureCollection', features: [] };

describe('buildFallbackStyle', () => {
  it('haengt nur an der gebuendelten GeoJSON-Quelle', () => {
    const style = buildFallbackStyle('dark', GEOJSON);
    expect(style.version).toBe(8);
    expect(Object.keys(style.sources)).toEqual([FALLBACK_SOURCE]);
    expect(style.sources[FALLBACK_SOURCE]).toEqual({ type: 'geojson', data: GEOJSON });
    // Keine Kacheln, keine Glyphen, keine Sprites: nichts, was ein Netz braucht
    expect(style.sprite).toBeUndefined();
    expect(style.glyphs).toBeUndefined();
    expect(style.layers.every(l => l.type !== 'symbol')).toBe(true);
    expect(style.layers.every(l => !l.source || l.source === FALLBACK_SOURCE)).toBe(true);
  });

  it('hat Hintergrund, Flaechen und Grenzen', () => {
    const types = buildFallbackStyle('dark', GEOJSON).layers.map(l => l.type);
    expect(types).toEqual(['background', 'fill', 'line']);
  });

  it('faerbt nach Theme und faellt auf dunkel zurueck', () => {
    const dark  = buildFallbackStyle('dark', GEOJSON);
    const light = buildFallbackStyle('light', GEOJSON);
    const other = buildFallbackStyle('neon', GEOJSON);
    const ocean = s => s.layers[0].paint['background-color'];
    expect(ocean(dark)).not.toBe(ocean(light));
    expect(ocean(other)).toBe(ocean(dark));
  });

  it('ist als Offline-Karte erkennbar', () => {
    expect(isFallbackStyle(buildFallbackStyle('dark', GEOJSON))).toBe(true);
    expect(isFallbackStyle({ name: 'Mapbox Dark' })).toBe(false);
    expect(isFallbackStyle(undefined)).toBe(false);
  });
});
