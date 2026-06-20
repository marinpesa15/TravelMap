// ===== Theme Toggle =====

export function initTheme(map) {
  const saved = localStorage.getItem('tm-theme') || 'dark';

  // Only apply CSS + button on init — the map already loaded with dark-v11.
  // Calling setStyle() here would trigger a style reload and race condition
  // that prevents hex/custom layers from being added correctly.
  _applyCSS(saved);
  if (saved === 'light') {
    // Map starts dark; switch to light style on init if needed.
    map?.setStyle('mapbox://styles/mapbox/light-v11');
  }

  document.getElementById('btn-theme')?.addEventListener('click', () => {
    const next = document.documentElement.classList.contains('light') ? 'dark' : 'light';
    _applyFull(next, map);
    localStorage.setItem('tm-theme', next);
  });
}

/** Called on button click — switches both CSS and map style */
function _applyFull(theme, map) {
  _applyCSS(theme);
  map?.setStyle(theme === 'light'
    ? 'mapbox://styles/mapbox/light-v11'
    : 'mapbox://styles/mapbox/dark-v11');
}

/** Only updates CSS class + button text, does NOT touch map style */
function _applyCSS(theme) {
  const isLight = theme === 'light';
  document.documentElement.classList.toggle('light', isLight);
  const btn = document.getElementById('btn-theme');
  if (btn) btn.textContent = isLight ? '🌙' : '☀️';
}
