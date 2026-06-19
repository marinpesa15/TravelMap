import { MAPBOX_TOKEN } from './constants.js';

// ===== Stats Panel =====

export function updateStats(userData) {
  const vc     = (userData.visited_countries  ?? []).length;
  const vcities = (userData.visited_cities    ?? []).length;
  const lived  = (userData.visited_cities     ?? []).filter(c => c.lived).length;
  const wc     = (userData.wishlist_countries ?? []).length + (userData.wishlist_cities ?? []).length;

  document.getElementById('stat-visited-countries').textContent = `🟦 ${vc} ${vc === 1 ? 'Land' : 'Länder'} besucht`;
  document.getElementById('stat-visited-cities').textContent    = `🔴 ${vcities} ${vcities === 1 ? 'Stadt' : 'Städte'} besucht`;
  document.getElementById('stat-lived').textContent             = `🏠 ${lived} dort gewohnt`;
  document.getElementById('stat-wishlist').textContent          = `⭐ ${wc} auf Wunschliste`;
}

// ===== Country Tooltip =====

let _tooltipData = null; // { isoCode, countryName }

/**
 * Wires up the country tooltip. Call once after map loads.
 * onAction(action, isoCode) where action = 'visited' | 'wishlist' | 'remove'
 */
export function setupCountryTooltip(map, onAction) {
  const tooltip = document.getElementById('country-tooltip');

  map.on('click', 'country-click', (e) => {
    const props = e.features[0]?.properties;
    if (!props) return;

    _tooltipData = {
      isoCode:     props.iso_3166_1,
      countryName: props.name_en || props.iso_3166_1
    };

    document.getElementById('tooltip-country-name').textContent = _tooltipData.countryName;

    // Position near click, keep inside viewport
    const x = Math.min(e.point.x + 10, window.innerWidth  - 180);
    const y = Math.min(e.point.y - 10, window.innerHeight - 160);
    tooltip.style.left    = x + 'px';
    tooltip.style.top     = y + 'px';
    tooltip.style.display = 'block';
  });

  document.getElementById('tooltip-close').addEventListener('click', hideCountryTooltip);

  ['visited', 'wishlist', 'remove'].forEach(action => {
    document.getElementById(`tooltip-${action}`).addEventListener('click', () => {
      if (_tooltipData) onAction(action, _tooltipData.isoCode);
      hideCountryTooltip();
    });
  });
}

export function hideCountryTooltip() {
  document.getElementById('country-tooltip').style.display = 'none';
  _tooltipData = null;
}

// ===== City Remove Popup =====

let _cityPopupData = null; // { city, type }

export function showCityPopup(city, type, clientX, clientY, onRemove) {
  _cityPopupData = { city, type };
  const popup = document.getElementById('city-popup');
  document.getElementById('city-popup-name').textContent = city.name;

  const x = Math.min(clientX + 10, window.innerWidth  - 160);
  const y = Math.min(clientY - 10, window.innerHeight - 80);
  popup.style.left    = x + 'px';
  popup.style.top     = y + 'px';
  popup.style.display = 'block';

  document.getElementById('btn-remove-city').onclick = () => {
    if (_cityPopupData) onRemove(_cityPopupData.city, _cityPopupData.type);
    hideCityPopup();
  };
}

export function hideCityPopup() {
  document.getElementById('city-popup').style.display = 'none';
  _cityPopupData = null;
}

// ===== City Search + Dialog =====

let _selectedCity = null; // { name, lat, lng, country }
let _searchAbort  = null; // AbortController for in-flight geocoding requests

export function setupCitySearch(onAddCity) {
  const input   = document.getElementById('city-search');
  const results = document.getElementById('search-results');
  let _debounce = null;

  input.addEventListener('input', () => {
    clearTimeout(_debounce);
    const q = input.value.trim();
    if (q.length < 2) { results.innerHTML = ''; return; }
    _debounce = setTimeout(() => _searchCities(q, results), 300);
  });

  // Dialog elements
  const dialog       = document.getElementById('city-dialog');
  const radioOpts    = dialog.querySelectorAll('.radio-opt');
  const colorOpts    = dialog.querySelectorAll('.color-opt');
  const colorSection = document.getElementById('color-section');
  const livedRow     = document.getElementById('lived-row');
  const livedCb      = document.getElementById('lived-checkbox');

  // Radio: visited / wishlist
  radioOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      radioOpts.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const isVisited = opt.dataset.type === 'visited';
      colorSection.style.display = isVisited ? 'block' : 'none';
      livedRow.style.display     = isVisited ? 'flex'  : 'none';
    });
  });

  // Color: red / yellow
  colorOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      colorOpts.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  document.getElementById('dialog-cancel').addEventListener('click', _closeDialog);
  dialog.addEventListener('click', e => {
    if (e.target === dialog) _closeDialog();
  });

  document.getElementById('dialog-add').addEventListener('click', () => {
    if (!_selectedCity) return;
    const type  = dialog.querySelector('.radio-opt.selected').dataset.type;
    const color = dialog.querySelector('.color-opt.selected')?.dataset.color || 'red';
    const lived = livedCb.checked;
    onAddCity(_selectedCity, type, color, lived);
    _closeDialog();
    input.value = '';
    results.innerHTML = '';
  });

  document.getElementById('city-popup-close').addEventListener('click', hideCityPopup);
}

async function _searchCities(query, resultsEl) {
  // Cancel any in-flight request before starting a new one
  if (_searchAbort) _searchAbort.abort();
  _searchAbort = new AbortController();

  resultsEl.innerHTML = '<div class="search-result-item">Suche...</div>';
  try {
    const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=place&limit=5&access_token=${MAPBOX_TOKEN}`;
    const res  = await fetch(url, { signal: _searchAbort.signal });
    const data = await res.json();

    if (!data.features?.length) {
      resultsEl.innerHTML = '<div class="search-result-item">Keine Ergebnisse</div>';
      return;
    }

    resultsEl.innerHTML = '';
    data.features.forEach(f => {
      if (!f.center) return; // skip malformed features without coordinates
      const item = document.createElement('div');
      item.className   = 'search-result-item';
      item.textContent = f.place_name;
      item.addEventListener('click', () => {
        _selectedCity = {
          name:    f.text,
          lat:     f.center[1],
          lng:     f.center[0],
          country: f.context?.find(c => c.id.startsWith('country.'))?.short_code?.toUpperCase() || 'XX'
        };
        _openDialog(f.text);
        resultsEl.innerHTML = '';
      });
      resultsEl.appendChild(item);
    });
  } catch (e) {
    if (e.name === 'AbortError') return; // stale request cancelled — ignore
    resultsEl.innerHTML = '<div class="search-result-item">Fehler bei der Suche</div>';
  }
}

function _openDialog(cityName) {
  document.getElementById('dialog-city-name').textContent = cityName;
  // Reset to defaults
  document.querySelectorAll('.radio-opt').forEach((o, i) => o.classList.toggle('selected', i === 0));
  document.querySelectorAll('.color-opt').forEach((o, i) => o.classList.toggle('selected', i === 0));
  document.getElementById('lived-checkbox').checked    = false;
  document.getElementById('color-section').style.display = 'block';
  document.getElementById('lived-row').style.display     = 'flex';
  document.getElementById('city-dialog').classList.add('open');
}

function _closeDialog() {
  document.getElementById('city-dialog').classList.remove('open');
  _selectedCity = null;
}

// ===== Toast =====

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
