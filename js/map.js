import { MAPBOX_TOKEN } from './constants.js?v=12';

let _map = null;

export function initMap() {
  mapboxgl.accessToken = MAPBOX_TOKEN;

  _map = new mapboxgl.Map({
    container: 'map',
    style:  'mapbox://styles/mapbox/dark-v11',
    center: [10, 20],
    zoom:   1.5
  });

  _map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');

  // Ohne Netz kommt das Style-JSON nie an, und 'load' bleibt aus. Frueher
  // haengte dadurch der gesamte Start: Profil, Staedteliste und Einstellungen
  // wurden nie aufgebaut. Deshalb wird auch bei einem Style-Fehler
  // aufgeloest. Die Karte bleibt dann leer, der Rest der App laeuft.
  // Kachel-Fehler bei geladenem Style sind dagegen normal und egal.
  return new Promise(resolve => {
    _map.once('load', () => resolve(_map));
    _map.on('error', () => {
      if (!_map.isStyleLoaded()) resolve(_map);
    });
  });
}

export function getMap() { return _map; }
