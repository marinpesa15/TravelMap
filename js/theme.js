// ===== Theme =====

const STYLE = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark:  'mapbox://styles/mapbox/dark-v11'
};

export function getTheme() {
  return localStorage.getItem('tm-theme') || 'dark';
}

/** Applies CSS class + map style and persists the choice. */
export function setTheme(theme, map) {
  _applyCSS(theme);
  map?.setStyle(theme === 'light' ? STYLE.light : STYLE.dark);
  localStorage.setItem('tm-theme', theme);
}

/** Applies the saved theme on init. The map already loaded with dark-v11 —
 *  only switch the style if light is saved (setStyle during init otherwise
 *  races with hex/custom layer setup). */
export function initTheme(map) {
  const saved = getTheme();
  _applyCSS(saved);
  if (saved === 'light') {
    map?.setStyle(STYLE.light);
  }
}

/**
 * Laedt das Kartenbild der aktuellen Wahl neu. Noetig, wenn die App ohne Netz
 * gestartet ist: Mapbox holt ein gescheitertes Style nicht von selbst nach.
 */
export function reloadMapStyle(map) {
  map?.setStyle(STYLE[getTheme()] ?? STYLE.dark);
}

function _applyCSS(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
}
