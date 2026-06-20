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

  return new Promise(resolve => _map.on('load', () => resolve(_map)));
}

export function getMap() { return _map; }
