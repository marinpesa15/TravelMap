// ===== Theme =====
import { setMapTheme } from './map.js?v=22';

export function getTheme() {
  return localStorage.getItem('tm-theme') || 'dark';
}

/** Applies CSS class + map style and persists the choice. */
export function setTheme(theme, map) {
  _applyCSS(theme);
  if (map) setMapTheme(theme);
  localStorage.setItem('tm-theme', theme);
}

/** Applies the saved theme on init. Die Karte startet bereits mit dem
 *  gespeicherten Style (js/app.js gibt ihn initMap mit), hier nur das CSS. */
export function initTheme() {
  _applyCSS(getTheme());
}

function _applyCSS(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
}
