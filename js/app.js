import { onAuthChange, signOutUser } from './auth.js?v=18';
import {
  loadUserData, initUserProfile, getUserByToken,
  subscribeUserData, subscribeGroupData,
  addCityToGroup, removeCityFromGroup,
  addVisitedCountry, addWishlistCountry, removeCountry,
  addVisitedCity, removeVisitedCity, addWishlistCity, removeWishlistCity
} from './db.js?v=18';
import { loadFriends, addFriendship, isFriend, removeFriend } from './friends.js?v=18';
import { loadGroups, createGroup, leaveGroup, addMembersToGroup } from './groups.js?v=18';
import {
  initCountryLayers, updateCountryFills,
  showCountryLayers, hideCountryLayers,
  setupCountryMapClick
} from './countries.js?v=20';
import { initMap } from './map.js?v=18';
import { renderAllMarkers, renderReadOnlyMarkers, clearAllMarkers } from './markers.js?v=18';
import {
  updateStats, updateCountriesView, setupSearch,
  showCityPopup, hideCityPopup, showToast,
  setupFriendsSidebar, renderFriendsList,
  setupGroupsSidebar, renderGroupsList,
  showViewBanner, hideViewBanner,
  openAddMemberModal, setupConfirmDialog,
  setupCountryTooltip, showCountryTooltip, hideCountryTooltip
} from './ui.js?v=19';
import { initTheme } from './theme.js?v=18';

let _uid            = null;
let _userData       = null;
let _map            = null;
let _currentFilter  = 'all';
let _friends        = [];
let _viewMode       = 'own'; // 'own' | 'friend' | 'group'
let _currentGroupId = null;
let _mapMode        = 'cities'; // 'cities' | 'countries'

// Real-time listener handles
let _unsubUserData  = null;
let _unsubFriends   = null;
let _unsubGroups    = null;
let _unsubGroupView = null;

// First-run flags (prevent double setup of listeners)
let _friendsSetup   = false;
let _groupsSetup    = false;

// ===== Auth Guard =====
onAuthChange(async user => {
  if (!user) {
    // Preserve invite token across the login redirect
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    window.location.href = token ? `index.html?token=${token}` : 'index.html';
    return;
  }
  if (_uid === user.uid) return;
  _uid = user.uid;
  await _init(user);
});

async function _init(user) {
  try {
    await initUserProfile(_uid, user);
    _map      = await initMap();
    _userData = await loadUserData(_uid);   // one-shot for initial render

    await _handleInviteToken(_userData);

    _showUserProfile(user);
    // Re-init country layers after style reloads (theme toggle wipes all custom sources + layers)
    _map.on('style.load', () => {
      initCountryLayers(_map).then(() => {
        if (_userData) {
          const { visited, wishlist } = _getFilteredCountryData();
          updateCountryFills(_map, visited, wishlist);
        }
        if (_mapMode === 'countries') showCountryLayers(_map);
      }).catch(err => console.error('[TM] country layer re-init failed:', err));
    });

    initTheme(_map);
    _initMobileSidebar();
    _setupFilterNav();
    _initMapModeTabs();

    // Country layers — async because GeoJSON is fetched from CDN on first load
    await initCountryLayers(_map);
    updateCountryFills(_map, _userData.visited_countries ?? [], _userData.wishlist_countries ?? []);
    setupCountryMapClick(_map, _onCountryMapClick);
    setupCountryTooltip();

    renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
    updateStats(_userData);

    // ── Real-time: own user data ──────────────────────────────────────────
    if (_unsubUserData) _unsubUserData();
    _unsubUserData = subscribeUserData(_uid, data => {
      _userData = data;
      if (_viewMode === 'own') {
        if (_mapMode === 'cities') {
          renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
          updateStats(_userData);
        } else {
          const { visited, wishlist } = _getFilteredCountryData();
          updateCountryFills(_map, visited, wishlist);
          updateCountriesView(_userData);
        }
      }
    });

    // ── Real-time: friends list ───────────────────────────────────────────
    if (_unsubFriends) _unsubFriends();
    _friendsSetup = false;
    _unsubFriends = loadFriends(_uid, friends => {
      _friends = friends;
      if (!_friendsSetup) {
        setupFriendsSidebar(_uid, _userData.invite_token, friends, _switchToFriendView, _onDeleteFriend);
        _friendsSetup = true;
      } else {
        renderFriendsList(friends, _switchToFriendView, _onDeleteFriend);
      }
    });

    // ── Real-time: groups list ────────────────────────────────────────────
    if (_unsubGroups) _unsubGroups();
    _groupsSetup = false;
    _unsubGroups = loadGroups(_uid, groups => {
      if (!_groupsSetup) {
        setupGroupsSidebar(groups, _friends, _uid, _onCreateGroup, _switchToGroupView, _onLeaveGroup, _onAddMembersToGroup);
        _groupsSetup = true;
      } else {
        renderGroupsList(groups, _uid, _switchToGroupView, _onLeaveGroup, _onAddMembersToGroup, _friends);
      }
    });

    setupConfirmDialog();
    setupSearch(_onAddCity, _onAddCountry, () => _mapMode);

    document.getElementById('btn-signout').addEventListener('click', async () => {
      try { await signOutUser(); } catch { /* ignore */ }
      window.location.href = 'index.html';
    });

    document.getElementById('btn-add-location')?.addEventListener('click', () => {
      _closeMobileSidebar();
      document.getElementById('city-search')?.focus();
    });

    document.getElementById('btn-close-search')?.addEventListener('click', _closeMobileSearchOverlay);

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

/**
 * Checks URL for ?token= and processes friend join if present.
 */
async function _handleInviteToken(myData) {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');
  if (!token) return;

  history.replaceState({}, '', window.location.pathname);

  try {
    const them = await getUserByToken(token);
    if (!them) { showToast('Invite link not found.'); return; }
    if (them.uid === _uid) { showToast("That's your own invite link!"); return; }

    const alreadyFriends = await isFriend(_uid, them.uid);
    if (alreadyFriends) {
      showToast(`Already friends with ${them.display_name || 'this user'}!`);
      return;
    }

    await addFriendship(_uid, them.uid, them, myData);
    showToast(`You're now friends with ${them.display_name || 'your friend'}! 🎉`);
  } catch (err) {
    console.error('Friend join error:', err);
    showToast('Could not process invite link.');
  }
}

// ===== City Actions =====
async function _onAddCity(cityData, type, lived) {
  if (_viewMode === 'group' && _currentGroupId) {
    try {
      await addCityToGroup(_currentGroupId, { ...cityData, lived: type === 'visited' ? lived : false }, type);
      showToast(`${cityData.name} added to group ✓`);
      _closeMobileSearchOverlay(); // close overlay after adding
      // Map updates via subscribeGroupData listener automatically
    } catch {
      showToast('Failed to add location to group.');
    }
    return;
  }
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
    showToast(`${cityData.name} added ✓`);
    // Map + stats update via subscribeUserData listener automatically
  } catch {
    showToast('Failed to add location');
  }
}

function _onCityRemoveRequest(city, type, clientX, clientY) {
  if (_viewMode === 'group' && _currentGroupId) {
    showCityPopup(city, type, clientX, clientY, _onRemoveCityFromGroup);
    return;
  }
  showCityPopup(city, type, clientX, clientY, _onRemoveCity);
}

async function _onRemoveCityFromGroup(city, type) {
  try {
    await removeCityFromGroup(_currentGroupId, city.name, type);
    showToast(`${city.name} removed`);
    // Map updates via subscribeGroupData listener automatically
  } catch {
    showToast('Failed to remove location.');
  }
}

async function _onRemoveCity(city, type) {
  try {
    if (type === 'visited')  await removeVisitedCity(_uid, city.name);
    if (type === 'wishlist') await removeWishlistCity(_uid, city.name);
    showToast(`${city.name} removed`);
    // Map + stats update via subscribeUserData listener automatically
  } catch {
    showToast('Failed to remove location');
  }
}

// ===== Friend View Mode =====
async function _switchToFriendView(friend) {
  if (_viewMode !== 'own') _returnToOwnView();
  _viewMode = 'friend';

  document.querySelectorAll('.social-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.social-item[data-uid="${friend.uid}"]`)?.classList.add('active');
  document.getElementById('btn-add-location').style.display = 'none';

  try {
    const friendData = await loadUserData(friend.uid);
    clearAllMarkers();
    if (_mapMode === 'countries') {
      // Show friend's country fills in the current map mode
      updateCountryFills(_map, friendData.visited_countries ?? [], friendData.wishlist_countries ?? []);
      showCountryLayers(_map);
    } else {
      hideCountryLayers(_map);
      renderReadOnlyMarkers(_map, friendData);
    }
    showViewBanner(`${friend.display_name || 'Friend'}'s Map`, _returnToOwnView);
    _enterBannerMode(false); // friend view: hide search, no search icon
  } catch (err) {
    console.error(err);
    showToast('Could not load friend\'s map.');
    _returnToOwnView();
  }
}

function _returnToOwnView() {
  // Unsubscribe group view listener if active
  if (_unsubGroupView) { _unsubGroupView(); _unsubGroupView = null; }

  _exitBannerMode();
  _viewMode = 'own';
  _currentGroupId = null;
  document.querySelectorAll('.social-item').forEach(el => el.classList.remove('active'));
  hideViewBanner();

  if (_mapMode === 'countries') {
    clearAllMarkers(); // remove any friend/group city markers
    const { visited, wishlist } = _getFilteredCountryData();
    updateCountryFills(_map, visited, wishlist);
    showCountryLayers(_map);
    if (_userData) updateCountriesView(_userData);
  } else {
    hideCountryLayers(_map); // remove any friend/group country fills
    renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
  }

  document.getElementById('btn-add-location').style.display = '';
}

// ===== Friend Actions =====
async function _onDeleteFriend(friendUid) {
  try {
    await removeFriend(_uid, friendUid);
    showToast('Friend removed.');
  } catch {
    showToast('Failed to remove friend.');
  }
}

// ===== Group Actions =====
async function _onCreateGroup(name, friendUids) {
  try {
    await createGroup(name, friendUids, _uid);
    showToast(`Group "${name}" created! 🌍`);
  } catch (err) {
    console.error(err);
    showToast('Failed to create group.');
  }
}

async function _onLeaveGroup(groupId, createdBy) {
  try {
    await leaveGroup(groupId, _uid, createdBy);
  } catch {
    showToast('Failed to leave group.');
  }
}

async function _onAddMembersToGroup(groupId, friendUids) {
  try {
    await addMembersToGroup(groupId, friendUids);
    showToast(`${friendUids.length === 1 ? '1 person' : friendUids.length + ' people'} added to group ✓`);
  } catch {
    showToast('Failed to add members.');
  }
}

// ===== Group View Mode =====
function _switchToGroupView(group) {
  if (_viewMode !== 'own') _returnToOwnView();
  _viewMode = 'group';
  _currentGroupId = group.id;

  document.querySelectorAll('.social-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.social-item[data-id="${group.id}"]`)?.classList.add('active');
  // Add button stays visible — members can add to the group map

  showViewBanner(group.name, _returnToOwnView);
  _enterBannerMode(true); // group view: hide search bar, show search icon

  // Real-time group city data
  if (_unsubGroupView) _unsubGroupView();
  _unsubGroupView = subscribeGroupData(group.id, groupData => {
    if (_viewMode === 'group' && _currentGroupId === group.id) {
      clearAllMarkers();
      hideCountryLayers(_map); // groups show cities only, no country fills
      renderAllMarkers(_map, groupData, _onCityRemoveRequest);
    }
  });
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

function _getFilteredCountryData() {
  const visited  = _userData?.visited_countries  ?? [];
  const wishlist = _userData?.wishlist_countries ?? [];
  if (_currentFilter === 'visited')  return { visited, wishlist: [] };
  if (_currentFilter === 'wishlist') return { visited: [], wishlist };
  return { visited, wishlist }; // 'all' or 'lived' (not applicable) → show everything
}

function _setupFilterNav() {
  document.querySelectorAll('.nav-item[data-filter]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      _currentFilter = item.dataset.filter;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      if (_viewMode === 'own') {
        if (_mapMode === 'countries') {
          const { visited, wishlist } = _getFilteredCountryData();
          updateCountryFills(_map, visited, wishlist);
        } else {
          renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
        }
      }
    });
  });
}

// ===== Map Mode (Cities / Countries) =====

function _initMapModeTabs() {
  document.querySelectorAll('.stat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (_viewMode !== 'own') return; // locked in friend/group views
      _setMapMode(tab.dataset.mode);
    });
  });
}

function _setMapMode(mode) {
  if (_mapMode === mode) return;
  _mapMode = mode;

  // Update tab active state
  document.querySelectorAll('.stat-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.mode === mode)
  );

  // Update search placeholder
  const input = document.getElementById('city-search');
  if (input) {
    input.placeholder = mode === 'countries' ? 'Search countries...' : 'Search cities...';
    input.value = '';
    const results = document.getElementById('search-results');
    if (results) results.innerHTML = '';
  }

  // Toggle legends
  document.getElementById('legend-cities').style.display    = mode === 'cities'    ? '' : 'none';
  document.getElementById('legend-countries').style.display = mode === 'countries' ? '' : 'none';

  // "Lived there" filter doesn't apply to countries — hide/show accordingly
  const livedNav = document.getElementById('nav-lived');
  if (mode === 'countries') {
    if (livedNav) livedNav.style.display = 'none';
    // If "Lived there" was active, reset to "All"
    if (_currentFilter === 'lived') {
      _currentFilter = 'all';
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.getElementById('nav-all')?.classList.add('active');
    }
  } else {
    if (livedNav) livedNav.style.display = '';
  }

  // Hide any open tooltips
  hideCountryTooltip();
  hideCityPopup();

  if (mode === 'cities') {
    hideCountryLayers(_map);
    if (_viewMode === 'own') {
      renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
    }
    if (_userData) updateStats(_userData);
  } else {
    clearAllMarkers();
    const { visited, wishlist } = _getFilteredCountryData();
    updateCountryFills(_map, visited, wishlist);
    showCountryLayers(_map);
    if (_userData) updateCountriesView(_userData);
  }
}

// ===== Country Actions =====

function _onAddCountry(countryData, type) {
  _onCountryAction(type, countryData.isoCode, countryData.name);
}

async function _onCountryAction(action, isoCode, countryName) {
  try {
    if (action === 'visited') {
      await addVisitedCountry(_uid, isoCode);
      showToast(`${countryName} — visited ✓`);
    } else if (action === 'wishlist') {
      await addWishlistCountry(_uid, isoCode);
      showToast(`${countryName} — added to wishlist ⭐`);
    } else if (action === 'remove') {
      await removeCountry(_uid, isoCode);
      showToast(`${countryName} removed`);
    }
    // Map updates via subscribeUserData listener
  } catch {
    showToast('Failed to update country.');
  }
}

function _onCountryMapClick({ isoCode, countryName }, point) {
  const visited  = (_userData?.visited_countries  ?? []).includes(isoCode);
  const wishlist = (_userData?.wishlist_countries ?? []).includes(isoCode);
  showCountryTooltip(isoCode, countryName, visited, wishlist, point, _onCountryAction);
}

// ===== Mobile Banner / Search Overlay =====
function _enterBannerMode(isGroup) {
  if (window.innerWidth > 768) return;
  const area = document.querySelector('.map-area');
  area?.classList.add('banner-active');
  if (isGroup) area?.classList.add('group-active');

  const btn = document.getElementById('btn-search-mobile');
  if (btn) {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', _openMobileSearchOverlay);
  }
}

function _exitBannerMode() {
  if (window.innerWidth > 768) return;
  _closeMobileSearchOverlay();
  document.querySelector('.map-area')?.classList.remove('banner-active', 'group-active');
}

function _openMobileSearchOverlay() {
  const overlay = document.getElementById('mobile-search-overlay');
  const searchWrap = document.querySelector('.search-wrap');
  const body = document.getElementById('mobile-search-body');
  if (!overlay || !searchWrap || !body) return;
  body.appendChild(searchWrap);
  overlay.classList.add('open');
  document.getElementById('city-search')?.focus();
}

function _closeMobileSearchOverlay() {
  const overlay = document.getElementById('mobile-search-overlay');
  if (!overlay || !overlay.classList.contains('open')) return;
  const searchWrap = overlay.querySelector('.search-wrap');
  if (searchWrap) {
    const topRightBar = document.querySelector('.top-right-bar');
    const userPill = topRightBar?.querySelector('.user-pill');
    if (userPill) topRightBar.insertBefore(searchWrap, userPill);
  }
  overlay.classList.remove('open');
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
