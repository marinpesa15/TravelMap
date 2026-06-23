import { onAuthChange, signOutUser } from './auth.js?v=13';
import {
  loadUserData, initUserProfile, getUserByToken,
  addVisitedCountry,
  addVisitedCity, removeVisitedCity, addWishlistCity, removeWishlistCity
} from './db.js?v=13';
import { loadFriends, addFriendship, isFriend } from './friends.js?v=13';
import { loadGroups, createGroup, leaveGroup } from './groups.js?v=13';
import { initMap } from './map.js?v=13';
import { renderAllMarkers, renderReadOnlyMarkers, clearAllMarkers } from './markers.js?v=13';
import {
  updateStats, setupCitySearch,
  showCityPopup, hideCityPopup, showToast,
  setupFriendsSidebar, renderFriendsList,
  setupGroupsSidebar, renderGroupsList,
  showViewBanner, hideViewBanner
} from './ui.js?v=13';
import { initTheme } from './theme.js?v=13';

let _uid           = null;
let _userData      = null;
let _map           = null;
let _refreshing    = false;
let _currentFilter = 'all';
let _friends       = [];
let _unsubGroups   = null;
let _groupsSetup   = false;
let _viewMode      = 'own'; // 'own' | 'friend' | 'group'

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
    await initUserProfile(_uid, user);
    _map      = await initMap();
    _userData = await loadUserData(_uid);

    await _handleInviteToken(_userData);

    _showUserProfile(user);
    initTheme(_map);
    _initMobileSidebar();
    _setupFilterNav();

    renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
    updateStats(_userData);

    _friends = await loadFriends(_uid);
    setupFriendsSidebar(_uid, _userData.invite_token, _friends, _switchToFriendView);

    if (_unsubGroups) _unsubGroups();
    _groupsSetup = false;
    _unsubGroups = loadGroups(_uid, groups => {
      if (!_groupsSetup) {
        setupGroupsSidebar(groups, _friends, _uid, _onCreateGroup, _switchToGroupView, _onLeaveGroup);
        _groupsSetup = true;
      } else {
        renderGroupsList(groups, _uid, _switchToGroupView, _onLeaveGroup);
      }
    });

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

/**
 * Checks URL for ?token= and processes friend join if present.
 * myData: the current user's Firestore doc (has display_name, avatar_url).
 */
async function _handleInviteToken(myData) {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');
  if (!token) return;

  // Clean the token from URL immediately
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

// ===== Friend View Mode =====
async function _switchToFriendView(friend) {
  if (_viewMode !== 'own') _returnToOwnView();
  _viewMode = 'friend';

  // Mark active item in sidebar
  document.querySelectorAll('.social-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.social-item[data-uid="${friend.uid}"]`)?.classList.add('active');

  // Hide add-location button
  document.getElementById('btn-add-location').style.display = 'none';

  try {
    const friendData = await loadUserData(friend.uid);
    clearAllMarkers();
    renderReadOnlyMarkers(_map, friendData);
    showViewBanner(`${friend.display_name || 'Friend'}'s Map`, _returnToOwnView);
  } catch (err) {
    console.error(err);
    showToast('Could not load friend\'s map.');
    _returnToOwnView();
  }
}

function _returnToOwnView() {
  _viewMode = 'own';
  document.querySelectorAll('.social-item').forEach(el => el.classList.remove('active'));
  hideViewBanner();
  renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
  document.getElementById('btn-add-location').style.display = '';
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

/**
 * Computes the combined map data for a group.
 * Visited = intersection: only cities ALL members have visited (matched by exact name).
 * Wishlist = union: all wishlist cities from any member, deduplicated by name.
 * Lived is excluded.
 */
function _computeGroupData(membersData) {
  if (!membersData.length) return { visited_cities: [], wishlist_cities: [] };

  // Visited intersection
  const visitedSets = membersData.map(
    d => new Set((d.visited_cities ?? []).map(c => c.name))
  );
  const visitedIntersection = (membersData[0].visited_cities ?? []).filter(city =>
    visitedSets.every(s => s.has(city.name))
  );

  // Wishlist union (deduplicated by name)
  const seen = new Set();
  const wishlistUnion = membersData
    .flatMap(d => d.wishlist_cities ?? [])
    .filter(city => {
      if (seen.has(city.name)) return false;
      seen.add(city.name);
      return true;
    });

  return {
    visited_cities:  visitedIntersection,
    wishlist_cities: wishlistUnion
  };
}

async function _switchToGroupView(group) {
  if (_viewMode !== 'own') _returnToOwnView();
  _viewMode = 'group';

  document.querySelectorAll('.social-item').forEach(el => el.classList.remove('active'));
  document.querySelector(`.social-item[data-id="${group.id}"]`)?.classList.add('active');
  document.getElementById('btn-add-location').style.display = 'none';

  try {
    const membersData = await Promise.all(group.members.map(uid => loadUserData(uid)));
    const groupData   = _computeGroupData(membersData);
    clearAllMarkers();
    renderReadOnlyMarkers(_map, groupData);
    showViewBanner(group.name, _returnToOwnView);
  } catch (err) {
    console.error(err);
    showToast('Could not load group map.');
    _returnToOwnView();
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
