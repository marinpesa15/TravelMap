import { onAuthChange, signOutUser } from './auth.js?v=4';
import {
  loadUserData,
  addVisitedCountry,
  addVisitedCity, removeVisitedCity, addWishlistCity, removeWishlistCity
} from './db.js?v=4';
import { initMap } from './map.js?v=4';
import { renderAllMarkers } from './markers.js?v=4';
import {
  updateStats, setupCitySearch,
  showCityPopup, hideCityPopup, showToast
} from './ui.js?v=4';

let _uid        = null;
let _userData   = null;
let _map        = null;
let _refreshing = false;

// ===== Auth Guard =====
onAuthChange(async user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  if (_uid === user.uid) return; // Already initialized for this user
  _uid = user.uid;
  await _init(user);
});

async function _init(user) {
  try {
    _map      = await initMap();
    _userData = await loadUserData(_uid);

    _showUserProfile(user);

    renderAllMarkers(_map, _userData, _onCityRemoveRequest);
    updateStats(_userData);
    setupCitySearch(_onAddCity);

    document.getElementById('btn-signout').addEventListener('click', async () => {
      try { await signOutUser(); } catch { /* ignore */ }
      window.location.href = 'index.html';
    });

    document.getElementById('btn-add-location')?.addEventListener('click', () => {
      document.getElementById('city-search')?.focus();
    });

    // Close city popup on map background click
    _map.on('click', () => hideCityPopup());

  } catch (err) {
    showToast('Fehler beim Laden. Seite neu laden.');
    console.error(err);
  }
}

// ===== User Profile =====
function _showUserProfile(user) {
  const avatarEl = document.getElementById('user-avatar');
  const nameEl   = document.getElementById('user-name');
  if (avatarEl && user.photoURL) {
    avatarEl.src = user.photoURL;
  } else if (avatarEl) {
    // Fallback: first letter of display name as text avatar
    avatarEl.style.display = 'none';
  }
  if (nameEl) {
    nameEl.textContent = user.displayName || user.email?.split('@')[0] || 'User';
  }
}

// ===== City Actions =====
async function _onAddCity(cityData, type, lived) {
  try {
    if (type === 'visited') {
      await addVisitedCity(_uid, { ...cityData, lived });

      // Auto-track country: add once, regardless of how many cities in that country
      const iso = cityData.country;
      if (iso && iso !== 'XX') {
        const alreadyTracked = (_userData.visited_countries ?? []).includes(iso);
        if (!alreadyTracked) {
          await addVisitedCountry(_uid, iso);
        }
      }
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
  if (_refreshing) return;
  _refreshing = true;
  try {
    _userData = await loadUserData(_uid);
    renderAllMarkers(_map, _userData, _onCityRemoveRequest);
    updateStats(_userData);
  } finally {
    _refreshing = false;
  }
}
