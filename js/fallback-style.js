// ===== Offline-Karte =====
//
// Mapbox liefert Style und Kacheln nur online, und seine Bedingungen erlauben
// kein dauerhaftes Zwischenspeichern. Ohne Netz war die Karte deshalb
// schwarz, nur die Pins standen im Leeren. Dieses Style kommt ohne Netz aus:
// Ozean als Hintergrund, Laenderflaechen und Grenzen aus der gebuendelten
// data/countries.geojson. Keine Beschriftungen, die braeuchten Glyphen vom
// Server. Grob, aber die Pins haben wieder einen Ort.
//
// Reine Funktion, damit sie ohne Karte testbar bleibt.

export const FALLBACK_STYLE_NAME = 'tm-offline';
export const FALLBACK_SOURCE     = 'tm-offline-countries';

const COLORS = {
  dark:  { ocean: '#0b0d19', land: '#1b1f31', border: '#3b4262' },
  light: { ocean: '#dbe4ee', land: '#f4f5f7', border: '#b9c1cc' }
};

/**
 * @param {'dark'|'light'} theme
 * @param {object} geojson FeatureCollection der Laender
 */
export function buildFallbackStyle(theme, geojson) {
  const c = COLORS[theme] ?? COLORS.dark;
  return {
    version: 8,
    name: FALLBACK_STYLE_NAME,
    sources: {
      [FALLBACK_SOURCE]: { type: 'geojson', data: geojson }
    },
    layers: [
      {
        id: 'tm-offline-ocean',
        type: 'background',
        paint: { 'background-color': c.ocean }
      },
      {
        id: 'tm-offline-land',
        type: 'fill',
        source: FALLBACK_SOURCE,
        paint: { 'fill-color': c.land }
      },
      {
        id: 'tm-offline-border',
        type: 'line',
        source: FALLBACK_SOURCE,
        paint: { 'line-color': c.border, 'line-width': 0.7 }
      }
    ]
  };
}

/** Ist das gerade geladene Style die Offline-Karte? */
export function isFallbackStyle(style) {
  return style?.name === FALLBACK_STYLE_NAME;
}
