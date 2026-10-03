import { describe, it, expect } from 'vitest';
import {
  buildSuggestUrl, buildRetrieveUrl, parseSuggestions, parseRetrieved, POI_CATEGORIES
} from '../js/remote-search.js';

// Gekuerzte echte Antworten der Search Box API (Oktober 2026).
const SUGGEST = {
  suggestions: [
    {
      name: 'Khao Sok National Park', mapbox_id: 'id-park', feature_type: 'poi',
      place_formatted: 'Ban Ta Khun, 84230, Thailand',
      context: { country: { name: 'Thailand', country_code: 'TH' } },
      poi_category: ['national park', 'outdoors', 'park']
    },
    {
      name: 'Bali', mapbox_id: 'id-bali', feature_type: 'region',
      place_formatted: 'Indonesia',
      context: { country: { name: 'Indonesia', country_code: 'ID' } }
    },
    { name: 'Nirgendwo', mapbox_id: 'id-nowhere', feature_type: 'place' }
  ]
};

const RETRIEVE = {
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [98.63818182, 8.97771584] },
    properties: {
      name: 'Khao Sok National Park', mapbox_id: 'id-park', feature_type: 'poi',
      coordinates: { latitude: 8.97771584, longitude: 98.63818182 },
      context: { country: { name: 'Thailand', country_code: 'TH' } }
    }
  }]
};

describe('buildSuggestUrl', () => {
  const url = new URL(buildSuggestUrl('Khao Sok', { lang: 'de', session: 'sess-1', token: 'pk.test' }));

  it('fragt den Suggest-Endpunkt mit Sprache, Sitzung und Token ab', () => {
    expect(url.origin + url.pathname).toBe('https://api.mapbox.com/search/searchbox/v1/suggest');
    expect(url.searchParams.get('q')).toBe('Khao Sok');
    expect(url.searchParams.get('language')).toBe('de');
    expect(url.searchParams.get('session_token')).toBe('sess-1');
    expect(url.searchParams.get('access_token')).toBe('pk.test');
    expect(url.searchParams.get('limit')).toBe('5');
  });

  it('laesst Orte, Regionen und Natur-POIs zu, aber keine Restaurants', () => {
    expect(url.searchParams.get('types').split(',')).toEqual(['place', 'locality', 'region', 'poi']);
    const cats = url.searchParams.get('poi_category').split(',');
    expect(cats).toEqual(POI_CATEGORIES);
    expect(cats).toContain('national_park');
    expect(cats).toContain('island');
    expect(cats).not.toContain('restaurant');
    expect(cats).not.toContain('tourist_attraction');
  });
});

describe('buildRetrieveUrl', () => {
  it('haengt die Mapbox-ID an den Pfad und nutzt dieselbe Sitzung', () => {
    const url = new URL(buildRetrieveUrl('id-park', { session: 'sess-1', token: 'pk.test' }));
    expect(url.pathname).toBe('/search/searchbox/v1/retrieve/id-park');
    expect(url.searchParams.get('session_token')).toBe('sess-1');
    expect(url.searchParams.get('access_token')).toBe('pk.test');
  });
});

describe('parseSuggestions', () => {
  const results = parseSuggestions(SUGGEST);

  it('liefert Name, Anzeige-Label, Land und Mapbox-ID ohne Koordinaten', () => {
    expect(results[0]).toEqual({
      name: 'Khao Sok National Park',
      label: 'Khao Sok National Park, Ban Ta Khun, 84230, Thailand',
      country: 'TH',
      mapboxId: 'id-park'
    });
    expect(results[0].lat).toBeUndefined();
  });

  it('nimmt Regionen mit und faellt ohne Kontext auf XX zurueck', () => {
    expect(results[1]).toMatchObject({ name: 'Bali', country: 'ID', label: 'Bali, Indonesia' });
    expect(results[2]).toMatchObject({ name: 'Nirgendwo', country: 'XX', label: 'Nirgendwo' });
  });

  it('vertraegt leere oder kaputte Antworten', () => {
    expect(parseSuggestions({})).toEqual([]);
    expect(parseSuggestions(null)).toEqual([]);
    expect(parseSuggestions({ suggestions: [{ mapbox_id: 'x' }] })).toEqual([]);
  });
});

describe('parseRetrieved', () => {
  it('liest Koordinaten und Land aus dem Feature', () => {
    expect(parseRetrieved(RETRIEVE)).toEqual({
      name: 'Khao Sok National Park', lat: 8.97771584, lng: 98.63818182, country: 'TH'
    });
  });

  it('gibt null zurueck, wenn keine Koordinaten da sind', () => {
    expect(parseRetrieved({ features: [] })).toBeNull();
    expect(parseRetrieved({ features: [{ properties: { name: 'x' } }] })).toBeNull();
    expect(parseRetrieved(undefined)).toBeNull();
  });
});
