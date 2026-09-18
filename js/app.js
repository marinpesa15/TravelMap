import { onAuthChange, signOutUser } from './auth.js?v=20';
import {
  loadUserData, initUserProfile, getUserByToken,
  subscribeUserData, subscribeGroupData,
  addCityToGroup, removeCityFromGroup, updateGroupCityPhoto,
  addVisitedCountry, addWishlistCountry, removeCountry,
  addVisitedCity, removeVisitedCity, addWishlistCity, removeWishlistCity,
  markWishlistCityVisited, markGroupWishlistCityVisited,
  acceptConsent
} from './db.js?v=23';
import { CONSENT_VERSION, hasConsent, requestConsent } from './consent.js?v=6';
import { loadFriends, addFriendship, isFriend, removeFriend } from './friends.js?v=19';
import { loadGroups, createGroup, leaveGroup, addMembersToGroup, removeMemberFromGroup } from './groups.js?v=20';
import {
  initCountryLayers, updateCountryFills,
  showCountryLayers, hideCountryLayers,
  setupCountryMapClick
} from './countries.js?v=21';
import { initMap } from './map.js?v=18';
import { renderAllMarkers, renderReadOnlyMarkers, renderGroupMarkers, clearAllMarkers, animateNextAdd } from './markers.js?v=23';
import {
  updateStats, replayStatsCountUp, updateCountriesView, setupSearch,
  showCityPopup, hideCityPopup, showToast, showGroupPhotoDialog,
  setupFriendsSidebar, renderFriendsList,
  setupGroupsSidebar, renderGroupsList,
  showViewBanner, hideViewBanner,
  openAddMemberModal, setupConfirmDialog,
  setupCountryTooltip, showCountryTooltip, hideCountryTooltip
} from './ui.js?v=32';
import { initTheme } from './theme.js?v=19';
import { setupSettings } from './settings.js?v=8';
import { t, getLang, applyTranslations } from './i18n.js?v=3';
import { staggerIn } from './anim.js?v=1';
import { startUpdateCheck } from './version.js?v=5';

let _uid            = null;
let _userData       = null;
let _currentUser    = null; // Firebase Auth user (for photoURL / displayName)
let _map            = null;
let _currentFilter  = 'all';
let _friends        = [];
let _groups         = [];
let _viewMode       = 'own'; // 'own' | 'friend' | 'group'
let _currentGroupId = null;
let _mapMode        = 'cities'; // 'cities' | 'countries'

// Real-time listener handles
let _unsubUserData   = null;
let _unsubFriends    = null;
let _unsubGroups     = null;
let _unsubGroupView  = null;
let _unsubFriendView = null;

// First-run flags (prevent double setup of listeners)
let _friendsSetup   = false;
let _groupsSetup    = false;

// Country layers are heavy (GeoJSON fetch) — loaded lazily on first
// countries-mode use instead of blocking every app start.
// Stored as a promise so concurrent callers share one init.
let _countryLayersPromise = null;
let _countryClickSetup    = false;

function _ensureCountryLayers() {
  if (_countryLayersPromise) return _countryLayersPromise;
  _countryLayersPromise = (async () => {
    await initCountryLayers(_map);
    if (!_countryClickSetup) {
      setupCountryMapClick(_map, _onCountryMapClick);
      _countryClickSetup = true;
    }
  })().catch(err => {
    _countryLayersPromise = null; // allow retry after a failed fetch
    throw err;
  });
  return _countryLayersPromise;
}

// Translate static HTML as early as possible (before auth resolves)
applyTranslations();

// ===== Boot Splash =====
// The splash covers the booting app until the map is rendered, but stays up
// at least SPLASH_MIN_MS from navigation start (Lumiq-style fixed stage) even
// when init finishes earlier. Blocking UI (consent dialog, error toast) passes
// now=true to skip the wait — nothing may sit hidden under the splash. Removal
// runs on every exit path so it can never trap the user; timers, not the
// transition promise — see closeOverlay in anim.js.
const SPLASH_MIN_MS = 2600;
function _hideSplash(now = false) {
  const el = document.getElementById('app-splash');
  if (!el) return;
  const wait = now ? 0 : Math.max(0, SPLASH_MIN_MS - performance.now());
  setTimeout(() => {
    el.classList.add('done');
    setTimeout(() => el.remove(), 500);
  }, wait);
}
// Safety net: a stalled init (offline, Mapbox failure) must not stick forever
setTimeout(() => _hideSplash(true), 8000);

// index.html reads this flag to skip the Firebase bounce for returning users
function _setSessionHint(on) {
  try {
    if (on) localStorage.setItem('tm-has-session', '1');
    else    localStorage.removeItem('tm-has-session');
  } catch { /* storage unavailable */ }
}

// ===== Auth Guard =====
onAuthChange(async user => {
  if (!user) {
    _setSessionHint(false);
    // Preserve invite token across the login redirect
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token');
    window.location.href = token ? `index.html?token=${encodeURIComponent(token)}` : 'index.html';
    return;
  }
  if (_uid === user.uid) return;
  _uid         = user.uid;
  _currentUser = user;
  _setSessionHint(true);
  await _init(user);
});

async function _init(user) {
  try {
    // ── Consent gate: nothing is written to Firestore before acceptance ──
    const preData = await loadUserData(_uid);   // read-only check
    if (!hasConsent(preData)) {
      _hideSplash(true); // consent dialog must not sit under the splash
      const accepted = await requestConsent(() => acceptConsent(_uid, CONSENT_VERSION));
      if (!accepted) {
        _setSessionHint(false);
        try { await signOutUser(); } catch { /* ignore */ }
        window.location.href = 'index.html';
        return;
      }
    }

    // initUserProfile returns the fresh doc data — saves a redundant read
    _userData = await initUserProfile(_uid, user);

    // Process invite links before the map: friend-adding must not depend on
    // Mapbox/WebGL, which can fail inside in-app browsers (WhatsApp etc.).
    await _handleInviteToken(_userData);

    _map = await initMap();

    _showUserProfile(user);
    // Style reloads (theme toggle) wipe all custom sources + layers — re-init
    // lazily, and only when the countries view actually needs them.
    _map.on('style.load', () => {
      _countryLayersPromise = null; // style reload wiped sources + layers
      if (_mapMode !== 'countries') return;
      _ensureCountryLayers().then(() => {
        if (_mapMode !== 'countries') return; // user switched back meanwhile
        if (_userData) {
          const { visited, wishlist } = _getFilteredCountryData();
          updateCountryFills(_map, visited, wishlist);
        }
        showCountryLayers(_map);
      }).catch(err => console.error('[TM] country layer re-init failed:', err));
    });

    initTheme(_map);
    setupSettings(_map);
    _initMobileSidebar();
    _setupFilterNav();
    _initMapModeTabs();

    setupCountryTooltip();

    renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
    updateStats(_userData);

    // Map + stats are on screen — reveal the app
    _hideSplash();

    // One-time staggered entrance for the sidebar lists (app start only)
    staggerIn('.collection-nav .nav-item, #recent-logs .recent-log-item');

    // Watch for newer deploys and offer a reload (Lumiq-style update prompt)
    startUpdateCheck();

    // ── Real-time: own user data ──────────────────────────────────────────
    // Defensive: clear any view listeners from a previous init
    if (_unsubGroupView)  { _unsubGroupView();  _unsubGroupView  = null; }
    if (_unsubFriendView) { _unsubFriendView(); _unsubFriendView = null; }
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
      _groups = groups;
      if (!_groupsSetup) {
        setupGroupsSidebar(groups, _friends, _uid, _onCreateGroup, _switchToGroupView, _onLeaveGroup, _onAddMembersToGroup, _onRemoveMember);
        _groupsSetup = true;
      } else {
        renderGroupsList(groups, _uid, _switchToGroupView, _onLeaveGroup, _onAddMembersToGroup, _friends);
      }
    });

    setupConfirmDialog();
    setupSearch(_onAddCity, _onAddCountry, () => _viewMode === 'group' ? 'cities' : _mapMode);

    document.getElementById('btn-add-location')?.addEventListener('click', () => {
      _closeMobileSidebar();
      document.getElementById('city-search')?.focus();
    });

    document.getElementById('btn-close-search')?.addEventListener('click', _closeMobileSearchOverlay);

    _map.on('click', () => hideCityPopup());

    // Live language switch: retranslate static DOM + re-render dynamic lists
    window.addEventListener('tm-langchanged', () => {
      applyTranslations();
      // Search placeholder depends on view/map mode
      const input = document.getElementById('city-search');
      if (input) {
        input.placeholder = (_viewMode === 'group' || _mapMode !== 'countries')
          ? t('search.cities') : t('search.countries');
      }
      // Sidebar lists / stats
      if (_userData) {
        if (_mapMode === 'countries') updateCountriesView(_userData);
        else updateStats(_userData);
      }
      renderFriendsList(_friends, _switchToFriendView, _onDeleteFriend);
      renderGroupsList(_groups, _uid, _switchToGroupView, _onLeaveGroup, _onAddMembersToGroup, _friends);
    });

  } catch (err) {
    _hideSplash(true);
    showToast(t('toast.errorLoading'));
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

  // Strip the token only once the outcome is final — if the session dies
  // mid-processing (mobile tab kill, reload), the link stays retryable.
  const clearToken = () => history.replaceState({}, '', window.location.pathname);

  try {
    const them = await getUserByToken(token);
    if (!them) { clearToken(); showToast(t('toast.inviteNotFound')); return; }
    if (them.uid === _uid) { clearToken(); showToast(t('toast.ownInvite')); return; }

    const alreadyFriends = await isFriend(_uid, them.uid);
    if (alreadyFriends) {
      clearToken();
      showToast(t('toast.alreadyFriends', { name: them.display_name || t('friend.fallback') }));
      return;
    }

    await addFriendship(_uid, them.uid, them, myData);
    clearToken();
    showToast(t('toast.nowFriends', { name: them.display_name || t('friend.fallback') }));
  } catch (err) {
    // Token stays in the URL so a reload retries the join.
    console.error('Friend join error:', err);
    showToast(t('toast.inviteError'));
  }
}

// ===== City Actions =====
async function _onAddCity(cityData, type, lived) {
  if (_viewMode === 'group' && _currentGroupId) {
    const defaultPhoto  = _currentUser?.photoURL    || '';
    const displayName   = _currentUser?.displayName || _userData?.display_name || '';

    // Only show photo dialog for visited cities (wishlist stays as-is)
    if (type === 'visited') {
      showGroupPhotoDialog(cityData.name, defaultPhoto, async (chosenPhoto) => {
        try {
          animateNextAdd(cityData.name);
          await addCityToGroup(_currentGroupId, {
            ...cityData,
            lived: false,
            addedBy: { uid: _uid, photoURL: chosenPhoto, displayName }
          }, 'visited');
          showToast(t('toast.addedToGroup', { name: cityData.name }));
        } catch {
          showToast(t('toast.addToGroupFailed'));
        }
      });
    } else {
      // Wishlist: add directly, no photo dialog
      try {
        animateNextAdd(cityData.name);
        await addCityToGroup(_currentGroupId, {
          ...cityData,
          lived: false,
          addedBy: { uid: _uid, photoURL: defaultPhoto, displayName }
        }, 'wishlist');
        showToast(t('toast.addedToGroup', { name: cityData.name }));
      } catch {
        showToast(t('toast.addToGroupFailed'));
      }
    }
    _closeMobileSearchOverlay();
    return;
  }
  try {
    animateNextAdd(cityData.name);
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
    showToast(t('toast.added', { name: cityData.name }));
    // Map + stats update via subscribeUserData listener automatically
  } catch {
    showToast(t('toast.addFailed'));
  }
}

function _onCityRemoveRequest(city, type, clientX, clientY) {
  if (_viewMode === 'group' && _currentGroupId) {
    showCityPopup(city, type, clientX, clientY, _onRemoveCityFromGroup, _onChangeGroupCityPhoto, _onMarkGroupCityVisited);
    return;
  }
  showCityPopup(city, type, clientX, clientY, _onRemoveCity, null, _onMarkCityVisited);
}

async function _onMarkCityVisited(city) {
  try {
    animateNextAdd(city.name);
    await markWishlistCityVisited(_uid, city.name);
    showToast(t('toast.markedVisited', { name: city.name }));
    // Map + stats update via subscribeUserData listener automatically
  } catch {
    showToast(t('toast.markVisitedFailed'));
  }
}

// Wie ein normales Hinzufuegen als besucht: Fotodialog, und der Pin gehoert
// danach dem Mitglied, das umwandelt.
function _onMarkGroupCityVisited(city) {
  const groupId      = _currentGroupId;
  const defaultPhoto = _currentUser?.photoURL    || '';
  const displayName  = _currentUser?.displayName || _userData?.display_name || '';
  showGroupPhotoDialog(city.name, defaultPhoto, async (chosenPhoto) => {
    try {
      animateNextAdd(city.name);
      await markGroupWishlistCityVisited(groupId, city.name,
        { uid: _uid, photoURL: chosenPhoto, displayName });
      showToast(t('toast.markedVisited', { name: city.name }));
      // Map updates via subscribeGroupData listener automatically
    } catch {
      showToast(t('toast.markVisitedFailed'));
    }
  });
}

function _onChangeGroupCityPhoto(city, type) {
  const defaultPhoto = city.addedBy?.photoURL || _currentUser?.photoURL || '';
  showGroupPhotoDialog(city.name, defaultPhoto, async (chosenPhoto) => {
    try {
      await updateGroupCityPhoto(_currentGroupId, city.name, type, chosenPhoto);
      showToast(t('toast.photoUpdated'));
    } catch {
      showToast(t('toast.photoFailed'));
    }
  });
}

async function _onRemoveCityFromGroup(city, type) {
  try {
    await removeCityFromGroup(_currentGroupId, city.name, type);
    showToast(t('toast.removed', { name: city.name }));
    // Map updates via subscribeGroupData listener automatically
  } catch {
    showToast(t('toast.removeFailed'));
  }
}

async function _onRemoveCity(city, type) {
  try {
    if (type === 'visited')  await removeVisitedCity(_uid, city.name);
    if (type === 'wishlist') await removeWishlistCity(_uid, city.name);
    showToast(t('toast.removed', { name: city.name }));
    // Map + stats update via subscribeUserData listener automatically
  } catch {
    showToast(t('toast.removeFailed'));
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
    if (_mapMode === 'countries') await _ensureCountryLayers();

    // Real-time: friend's map updates live while we're watching it
    if (_unsubFriendView) _unsubFriendView();
    _unsubFriendView = subscribeUserData(friend.uid, friendData => {
      if (_viewMode !== 'friend') return;
      clearAllMarkers();
      if (_mapMode === 'countries') {
        // Show friend's country fills in the current map mode
        updateCountryFills(_map, friendData.visited_countries ?? [], friendData.wishlist_countries ?? []);
        showCountryLayers(_map);
      } else {
        hideCountryLayers(_map);
        renderReadOnlyMarkers(_map, friendData);
      }
    });

    showViewBanner(t('banner.friendsMap', { name: friend.display_name || t('friend.fallback') }), _returnToOwnView);
    _enterBannerMode(false); // friend view: hide search, no search icon
  } catch (err) {
    console.error(err);
    showToast(t('toast.friendMapFailed'));
    _returnToOwnView();
  }
}

function _returnToOwnView() {
  // Unsubscribe group/friend view listeners if active
  if (_unsubGroupView)  { _unsubGroupView();  _unsubGroupView  = null; }
  if (_unsubFriendView) { _unsubFriendView(); _unsubFriendView = null; }

  _exitBannerMode();
  _viewMode = 'own';
  _currentGroupId = null;
  document.querySelectorAll('.social-item').forEach(el => el.classList.remove('active'));
  hideViewBanner();

  if (_mapMode === 'countries') {
    clearAllMarkers(); // remove any friend/group city markers
    if (_userData) updateCountriesView(_userData);
    _ensureCountryLayers().then(() => {
      if (_mapMode !== 'countries' || _viewMode !== 'own') return;
      const { visited, wishlist } = _getFilteredCountryData();
      updateCountryFills(_map, visited, wishlist);
      showCountryLayers(_map);
    }).catch(err => console.error('[TM] country layers failed:', err));
  } else {
    hideCountryLayers(_map); // remove any friend/group country fills
    renderAllMarkers(_map, _getFilteredUserData(), _onCityRemoveRequest);
  }

  document.getElementById('btn-add-location').style.display = '';

  // Restore placeholder to match current map mode
  const _ownSearchInput = document.getElementById('city-search');
  if (_ownSearchInput) _ownSearchInput.placeholder = _mapMode === 'countries' ? t('search.countries') : t('search.cities');
}

// ===== Friend Actions =====
async function _onDeleteFriend(friendUid) {
  try {
    await removeFriend(_uid, friendUid);
    showToast(t('toast.friendRemoved'));
  } catch {
    showToast(t('toast.friendRemoveFailed'));
  }
}

// ===== Group Actions =====
async function _onCreateGroup(name, friendUids) {
  try {
    await createGroup(name, friendUids, _uid);
    showToast(t('toast.groupCreated', { name }));
  } catch (err) {
    console.error(err);
    showToast(t('toast.groupCreateFailed'));
  }
}

async function _onLeaveGroup(groupId, createdBy) {
  try {
    await leaveGroup(groupId, _uid, createdBy);
  } catch {
    showToast(t('toast.leaveGroupFailed'));
  }
}

async function _onRemoveMember(groupId, memberUid) {
  try {
    await removeMemberFromGroup(groupId, memberUid);
    showToast(t('toast.memberRemoved'));
  } catch (err) {
    console.error(err);
    showToast(t('toast.memberRemoveFailed'));
  }
}

async function _onAddMembersToGroup(groupId, friendUids) {
  try {
    await addMembersToGroup(groupId, friendUids);
    showToast(friendUids.length === 1 ? t('toast.onePersonAdded') : t('toast.peopleAdded', { count: friendUids.length }));
  } catch {
    showToast(t('toast.addMembersFailed'));
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
  // Groups only support cities — override placeholder regardless of _mapMode
  const _groupSearchInput = document.getElementById('city-search');
  if (_groupSearchInput) _groupSearchInput.placeholder = t('search.cities');

  // Real-time group city data
  if (_unsubGroupView) _unsubGroupView();
  _unsubGroupView = subscribeGroupData(group.id, groupData => {
    if (_viewMode === 'group' && _currentGroupId === group.id) {
      clearAllMarkers();
      hideCountryLayers(_map); // groups show cities only, no country fills
      renderGroupMarkers(_map, groupData, _onCityRemoveRequest);
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
    input.placeholder = mode === 'countries' ? t('search.countries') : t('search.cities');
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
    if (_userData) updateCountriesView(_userData);
    // Lazy: first switch fetches the GeoJSON and builds the layers
    _ensureCountryLayers().then(() => {
      if (_mapMode !== 'countries') return; // user switched back meanwhile
      const { visited, wishlist } = _getFilteredCountryData();
      updateCountryFills(_map, visited, wishlist);
      showCountryLayers(_map);
    }).catch(err => {
      console.error('[TM] country layers failed:', err);
      showToast(t('toast.errorLoading'));
    });
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
      showToast(t('toast.countryVisited', { name: countryName }));
    } else if (action === 'wishlist') {
      await addWishlistCountry(_uid, isoCode);
      showToast(t('toast.countryWishlist', { name: countryName }));
    } else if (action === 'remove') {
      await removeCountry(_uid, isoCode);
      showToast(t('toast.removed', { name: countryName }));
    }
    // Map updates via subscribeUserData listener
  } catch {
    showToast(t('toast.countryFailed'));
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
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.toggle('open');
    backdrop?.classList.toggle('open');
    // The initial count-up played while the drawer was off-screen — replay it
    // each time the drawer opens so the animation is actually visible.
    if (sidebar?.classList.contains('open')) replayStatsCountUp();
  });
  backdrop?.addEventListener('click', _closeMobileSidebar);
}
