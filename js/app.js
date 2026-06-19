import { onAuthChange, signOutUser } from './auth.js';
import {
  loadUserData,
  addVisitedCountry, addWishlistCountry, removeCountry,
  addVisitedCity, removeVisitedCity, addWishlistCity, removeWishlistCity
} from './db.js';
import { initMap, setupCountryLayers, updateCountryLayers } from './map.js';
import { renderAllMarkers } from './markers.js';
import {
  updateStats, setupCountryTooltip, setupCitySearch,
  showCityPopup, hideCityPopup, showToast
} from './ui.js';

let _uid      = null;
let _userData = null;
let _map      = null;

// ===== Auth Guard =====
onAuthChange(async user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  if (_uid) return; // Already initialized
  _uid = user.uid;
  await _init();
});

async function _init() {
  try {
    _map      = await initMap();
    _userData = await loadUserData(_uid);

    setupCountryLayers(_userData.visited_countries, _userData.wishlist_countries);
    renderAllMarkers(_map, _userData, _onCityRemoveRequest);
    updateStats(_userData);
    setupCountryTooltip(_map, _onCountryAction);
    setupCitySearch(_onAddCity);

    document.getElementById('btn-signout').addEventListener('click', async () => {
      await signOutUser();
      window.location.href = 'index.html';
    });

    // Close tooltip / city popup on map background click
    _map.on('click', () => {
      document.getElementById('country-tooltip').style.display = 'none';
      hideCityPopup();
    });

  } catch (err) {
    showToast('Fehler beim Laden. Seite neu laden.');
    console.error(err);
  }
}

// ===== Country Actions =====
async function _onCountryAction(action, isoCode) {
  try {
    if (action === 'visited')  await addVisitedCountry(_uid, isoCode);
    if (action === 'wishlist') await addWishlistCountry(_uid, isoCode);
    if (action === 'remove')   await removeCountry(_uid, isoCode);
    await _refresh();
  } catch {
    showToast('Fehler beim Speichern');
  }
}

// ===== City Actions =====
async function _onAddCity(cityData, type, color, lived) {
  try {
    if (type === 'visited') {
      await addVisitedCity(_uid, { ...cityData, color, lived });
    } else {
      await addWishlistCity(_uid, cityData);
    }
    await _refresh();
    showToast(`${cityData.name} hinzugefügt ✓`);
  } catch {
    showToast('Fehler beim Hinzufügen');
  }
}

function _onCityRemoveRequest(city, type, clientX, clientY) {
  showCityPopup(city, type, clientX, clientY, _onRemoveCity);
}

async function _onRemoveCity(city, type) {
  try {
    if (type === 'visited')  await removeVisitedCity(_uid, city.name);
    if (type === 'wishlist') await removeWishlistCity(_uid, city.name);
    await _refresh();
    showToast(`${city.name} entfernt`);
  } catch {
    showToast('Fehler beim Entfernen');
  }
}

// ===== Refresh =====
async function _refresh() {
  _userData = await loadUserData(_uid);
  updateCountryLayers(_userData.visited_countries, _userData.wishlist_countries);
  renderAllMarkers(_map, _userData, _onCityRemoveRequest);
  updateStats(_userData);
}
