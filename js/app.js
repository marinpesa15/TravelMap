import { onAuthChange, signOutUser } from './auth.js?v=12';
import {
  loadUserData, initUserProfile,
  addVisitedCountry,
  addVisitedCity, removeVisitedCity, addWishlistCity, removeWishlistCity
} from './db.js?v=12';
import { initMap } from './map.js?v=12';
import { renderAllMarkers } from './markers.js?v=12';
import {
  updateStats, setupCitySearch,
  showCityPopup, hideCityPopup, showToast
} from './ui.js?v=12';
import { initTheme } from './theme.js?v=12';

let _uid           = null;
let _userData      = null;
let _map           = null;
let _refreshing    = false;
let _currentFilter = 'all';

// ===== Auth Guard =====
onAuthChange(async user => {
  if (!user) {
    window.location.href = 'index.html';
    return;
  }
  if (_uid === user.uid) return;
  _uid = user.uid;
  await _init(user);
});

async function _init(user) {
  try {
    await initUserProfile(_uid, user);   // ← add this line
    _map      = await initMap();
    _userData = await loadUserData(_uid);

    _showUserProfile(user);
    initTheme(_map);
    _initMobileSidebar();
    _setupFilterNav();

    renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
    updateStats(_userData);
    setupCitySearch(_onAddCity);

    document.getElementById('btn-signout').addEventListener('click', async () => {
      try { await signOutUser(); } catch { /* ignore */ }
      window.location.href = 'index.html';
    });

    document.getElementById('btn-add-location')?.addEventListener('click', () => {
      _closeMobileSidebar();
      document.getElementById('city-search')?.focus();
    });

    _map.on('click', () => hideCityPopup());

  } catch (err) {
    showToast('Error loading. Please reload.');
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
      const iso = cityData.country;
      if (iso && iso !== 'XX') {
        const alreadyTracked = (_userData.visited_countries ?? []).includes(iso);
        if (!alreadyTracked) await addVisitedCountry(_uid, iso);
      }
    } else {
      await addWishlistCity(_uid, cityData);
    }
    await _refresh();
    showToast(`${cityData.name} added ✓`);
  } catch {
    showToast('Failed to add location');
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
    showToast(`${city.name} removed`);
  } catch {
    showToast('Failed to remove location');
  }
}

// ===== Collection Filter =====
function _getFilteredUserData() {
  if (!_userData) return {};
  if (_currentFilter === 'all')      return _userData;
  if (_currentFilter === 'visited')  return { ..._userData, wishlist_cities: [] };
  if (_currentFilter === 'lived')    return {
    ..._userData,
    visited_cities: (_userData.visited_cities ?? []).filter(c => c.lived),
    wishlist_cities: []
  };
  if (_currentFilter === 'wishlist') return { ..._userData, visited_cities: [] };
  return _userData;
}

function _setupFilterNav() {
  document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      _currentFilter = item.dataset.filter;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
    });
  });
}

// ===== Refresh =====
async function _refresh() {
  if (_refreshing) return;
  _refreshing = true;
  try {
    _userData = await loadUserData(_uid);
    renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
    updateStats(_userData);
  } finally {
    _refreshing = false;
  }
}

// ===== Mobile Sidebar =====
function _closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('open');
}

function _initMobileSidebar() {
  const btn      = document.getElementById('btn-menu');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!btn) return;

  btn.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    backdrop?.classList.toggle('open');
  });
  backdrop?.addEventListener('click', _closeMobileSidebar);
  document.getElementById('btn-signout')?.addEventListener('click', _closeMobileSidebar);
}
