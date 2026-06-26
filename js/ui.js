import { MAPBOX_TOKEN } from './constants.js?v=12';
import { searchCountries } from './countries.js?v=18';

// ===== Stats & Sidebar =====

export function updateStats(userData) {
  const countries = (userData.visited_countries  ?? []).length;
  const cities    = (userData.visited_cities     ?? []).length;
  const lived     = (userData.visited_cities     ?? []).filter(c => c.lived).length;
  const wCities   = (userData.wishlist_cities    ?? []).length;
  const wCountries= (userData.wishlist_countries ?? []).length;
  const wishlist  = wCities + wCountries;

  // Snapshot grid
  _setText('stat-countries-num', countries);
  _setText('stat-cities-num',    cities);

  // Collection nav badges
  _setText('nav-all-count',      cities + wCities);
  _setText('nav-visited-count',  cities);
  _setText('nav-wishlist-count', wishlist);
  _setText('nav-lived-count',    lived);

  // Recent logs (last 3 visited cities, newest first)
  _updateRecentLogs(userData.visited_cities ?? []);
}

function _setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function _updateRecentLogs(visitedCities) {
  const el = document.getElementById('recent-logs');
  if (!el) return;

  const recent = [...visitedCities].reverse().slice(0, 3);

  if (recent.length === 0) {
    el.innerHTML = '<p class="recent-log-meta" style="color:#374151">No cities logged yet.</p>';
    return;
  }

  el.innerHTML = recent.map(city => `
    <div class="recent-log-item">
      <div class="recent-log-icon">📍</div>
      <div>
        <p class="recent-log-city">${city.name}</p>
        <p class="recent-log-meta">${city.country || '—'}</p>
      </div>
    </div>
  `).join('');
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

// ===== City + Country Search =====

let _selectedCity = null; // { name, lat, lng, country }
let _searchAbort  = null; // AbortController for in-flight geocoding requests

/**
 * Sets up the unified search bar.
 * getMode(): returns 'cities' | 'countries'
 * onAddCity(cityData, type, lived): called when a city is added
 * onAddCountry({ name, isoCode }, type): called when a country is added from search
 */
export function setupSearch(onAddCity, onAddCountry, getMode) {
  const input   = document.getElementById('city-search');
  const results = document.getElementById('search-results');
  let _debounce = null;

  input.addEventListener('input', () => {
    clearTimeout(_debounce);
    const q = input.value.trim();
    if (q.length < 2) { results.innerHTML = ''; return; }
    _debounce = setTimeout(() => {
      if (getMode() === 'countries') {
        _searchAndRenderCountries(q, results, onAddCountry);
      } else {
        _searchCities(q, results);
      }
    }, 300);
  });

  // Dialog elements
  const dialog    = document.getElementById('city-dialog');
  const radioOpts = dialog.querySelectorAll('.radio-opt');
  const livedRow  = document.getElementById('lived-row');
  const livedCb   = document.getElementById('lived-checkbox');

  // Radio: visited / wishlist
  radioOpts.forEach(opt => {
    opt.addEventListener('click', () => {
      radioOpts.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      const isVisited = opt.dataset.type === 'visited';
      livedRow.style.display = isVisited ? 'flex' : 'none';
    });
  });

  document.getElementById('dialog-cancel').addEventListener('click', _closeDialog);
  dialog.addEventListener('click', e => {
    if (e.target === dialog) _closeDialog();
  });

  document.getElementById('dialog-add').addEventListener('click', () => {
    if (!_selectedCity) return;
    const type  = dialog.querySelector('.radio-opt.selected').dataset.type;
    const lived = livedCb.checked;
    onAddCity(_selectedCity, type, lived);
    _closeDialog();
    input.value = '';
    results.innerHTML = '';
  });

  document.getElementById('city-popup-close').addEventListener('click', hideCityPopup);
}

async function _searchAndRenderCountries(query, resultsEl, onAddCountry) {
  resultsEl.innerHTML = '<div class="search-result-item">Searching…</div>';
  try {
    const countries = await searchCountries(query);
    if (!countries.length) {
      resultsEl.innerHTML = '<div class="search-result-item">No countries found</div>';
      return;
    }
    resultsEl.innerHTML = '';
    countries.forEach(country => {
      const item = document.createElement('div');
      item.className = 'search-result-item search-country-item';
      item.innerHTML = `
        <span class="search-country-name">${country.name}</span>
        <span class="search-country-iso">${country.isoCode}</span>
        <button class="country-add-btn visited" data-type="visited">✓ Visited</button>
        <button class="country-add-btn wishlist" data-type="wishlist">⭐ Wishlist</button>
      `;
      item.querySelector('[data-type="visited"]').addEventListener('click', e => {
        e.stopPropagation();
        onAddCountry(country, 'visited');
        resultsEl.innerHTML = '';
        document.getElementById('city-search').value = '';
      });
      item.querySelector('[data-type="wishlist"]').addEventListener('click', e => {
        e.stopPropagation();
        onAddCountry(country, 'wishlist');
        resultsEl.innerHTML = '';
        document.getElementById('city-search').value = '';
      });
      resultsEl.appendChild(item);
    });
  } catch (e) {
    if (e.name === 'AbortError') return;
    resultsEl.innerHTML = '<div class="search-result-item">Search error</div>';
  }
}

async function _searchCities(query, resultsEl) {
  // Cancel any in-flight request before starting a new one
  if (_searchAbort) _searchAbort.abort();
  _searchAbort = new AbortController();

  resultsEl.innerHTML = '<div class="search-result-item">Searching…</div>';
  try {
    const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=place&limit=5&access_token=${MAPBOX_TOKEN}`;
    const res  = await fetch(url, { signal: _searchAbort.signal });
    const data = await res.json();

    if (!data.features?.length) {
      resultsEl.innerHTML = '<div class="search-result-item">No results</div>';
      return;
    }

    resultsEl.innerHTML = '';
    data.features.forEach(f => {
      if (!f.center) return;
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
    if (e.name === 'AbortError') return;
    resultsEl.innerHTML = '<div class="search-result-item">Search error</div>';
  }
}

function _openDialog(cityName) {
  document.getElementById('dialog-city-name').textContent = cityName;
  document.querySelectorAll('.radio-opt').forEach((o, i) => o.classList.toggle('selected', i === 0));
  document.getElementById('lived-checkbox').checked   = false;
  document.getElementById('lived-row').style.display  = 'flex';
  document.getElementById('city-dialog').classList.add('open');
}

function _closeDialog() {
  document.getElementById('city-dialog').classList.remove('open');
  _selectedCity = null;
}

// ===== Custom Confirm Dialog =====

let _confirmCb = null;

export function setupConfirmDialog() {
  document.getElementById('confirm-cancel')?.addEventListener('click', _closeConfirm);
  document.getElementById('confirm-dialog')?.addEventListener('click', e => {
    if (e.target.id === 'confirm-dialog') _closeConfirm();
  });
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    const cb = _confirmCb;
    _closeConfirm();
    cb?.();
  });
}

export function showConfirm(message, actionLabel, onConfirm) {
  _confirmCb = onConfirm;
  document.getElementById('confirm-message').textContent = message;
  document.getElementById('confirm-ok').textContent = actionLabel || 'Confirm';
  document.getElementById('confirm-dialog').classList.add('open');
}

function _closeConfirm() {
  document.getElementById('confirm-dialog').classList.remove('open');
  _confirmCb = null;
}

// ===== Toast =====

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== Friends Sidebar =====

/**
 * Renders the friends list and wires the copy-invite + reset-link buttons.
 * friends: Array<{ uid, display_name, avatar_url }>
 * onViewFriend(friend): called when user clicks a friend row
 * onResetToken(): called when user clicks Reset (returns new token promise)
 */
export function setupFriendsSidebar(uid, inviteToken, friends, onViewFriend, onDeleteFriend) {
  // Wire copy-invite button
  document.getElementById('btn-copy-invite')?.addEventListener('click', () => {
    const link = `${window.location.origin}/map.html?token=${inviteToken}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('Invite link copied! 🔗');
    }).catch(() => {
      showToast('Could not copy link.');
    });
  });

  renderFriendsList(friends, onViewFriend, onDeleteFriend);
}

export function renderFriendsList(friends, onViewFriend, onDeleteFriend) {
  const el = document.getElementById('friends-list');
  if (!el) return;

  if (!friends.length) {
    el.innerHTML = '<p class="social-empty">No friends yet. Share your invite link!</p>';
    return;
  }

  el.innerHTML = '';
  friends.forEach(friend => {
    const item = document.createElement('div');
    item.className = 'social-item';
    item.dataset.uid = friend.uid;

    const avatar = friend.avatar_url
      ? `<img class="social-avatar" src="${friend.avatar_url}" alt="" loading="lazy">`
      : `<div class="social-avatar-placeholder">👤</div>`;

    item.innerHTML = `
      ${avatar}
      <span class="social-name">${friend.display_name || 'Friend'}</span>
      <button class="btn-remove-friend" title="Remove friend">✕</button>
    `;
    item.addEventListener('click', e => {
      if (e.target.closest('.btn-remove-friend')) return;
      onViewFriend(friend);
    });
    item.querySelector('.btn-remove-friend').addEventListener('click', e => {
      e.stopPropagation();
      const name = friend.display_name || 'this friend';
      showConfirm(`Remove ${name} from your friends?`, 'Remove', () => onDeleteFriend?.(friend.uid));
    });
    el.appendChild(item);
  });
}

// ===== Groups Sidebar =====

let _groupModalCreateCb   = null;
let _groupModalAddMemberCb = null;
let _groupModalMode        = 'create'; // 'create' | 'add-member'
let _groupModalTargetGroup = null;

/**
 * Renders groups list and wires the "+ New" button.
 * groups: Array<{ id, name, members }>
 * friends: Array<{ uid, display_name }>
 * onCreateGroup(name, memberUids): called when group is created
 * onViewGroup(group): called when user clicks a group row
 * onAddMembers(groupId, friendUids): called when adding members to existing group
 */
export function setupGroupsSidebar(groups, friends, currentUid, onCreateGroup, onViewGroup, onLeaveGroup, onAddMembers) {
  _groupModalCreateCb    = onCreateGroup;
  _groupModalAddMemberCb = onAddMembers;

  document.getElementById('btn-create-group')?.addEventListener('click', () => {
    _openGroupModal(friends, 'create');
  });

  document.getElementById('group-modal-cancel')?.addEventListener('click', _closeGroupModal);
  document.getElementById('group-modal')?.addEventListener('click', e => {
    if (e.target.id === 'group-modal') _closeGroupModal();
  });

  document.getElementById('group-modal-create')?.addEventListener('click', () => {
    const checked = [...document.querySelectorAll('#group-friends-checklist input:checked')];
    if (!checked.length) { showToast('Select at least one person.'); return; }
    const memberUids = checked.map(cb => cb.value);

    if (_groupModalMode === 'create') {
      const name = document.getElementById('group-name-input')?.value.trim();
      if (!name) { showToast('Please enter a group name.'); return; }
      _groupModalCreateCb?.(name, memberUids);
    } else {
      _groupModalAddMemberCb?.(_groupModalTargetGroup.id, memberUids);
    }
    _closeGroupModal();
  });

  renderGroupsList(groups, currentUid, onViewGroup, onLeaveGroup, onAddMembers, friends);
}

function _openGroupModal(friends, mode = 'create', group = null, allMembers = []) {
  _groupModalMode        = mode;
  _groupModalTargetGroup = group;

  const titleEl     = document.getElementById('group-modal-title');
  const nameRow     = document.getElementById('group-name-row');
  const friendLabel = document.getElementById('group-friends-label');
  const createBtn   = document.getElementById('group-modal-create');
  const checklist   = document.getElementById('group-friends-checklist');
  if (!checklist) return;

  if (mode === 'create') {
    titleEl.textContent       = 'New Group';
    nameRow.style.display     = '';
    friendLabel.textContent   = 'Add friends';
    createBtn.textContent     = 'Create';
    document.getElementById('group-name-input').value = '';

    if (!friends.length) {
      checklist.innerHTML = '<p class="social-empty">Add friends first to create a group.</p>';
    } else {
      checklist.innerHTML = friends.map(f => `
        <label class="group-check-item">
          <input type="checkbox" value="${f.uid}">
          <span class="group-check-name">${f.display_name || 'Friend'}</span>
        </label>
      `).join('');
    }
  } else {
    // add-member mode: only show friends NOT already in the group
    titleEl.textContent     = `Add to "${group.name}"`;
    nameRow.style.display   = 'none';
    friendLabel.textContent = 'Select friends to add';
    createBtn.textContent   = 'Add';

    const available = friends.filter(f => !allMembers.includes(f.uid));
    if (!available.length) {
      checklist.innerHTML = '<p class="social-empty">All your friends are already in this group.</p>';
    } else {
      checklist.innerHTML = available.map(f => `
        <label class="group-check-item">
          <input type="checkbox" value="${f.uid}">
          <span class="group-check-name">${f.display_name || 'Friend'}</span>
        </label>
      `).join('');
    }
  }

  document.getElementById('group-modal').classList.add('open');
}

function _closeGroupModal() {
  document.getElementById('group-modal').classList.remove('open');
}

// Public helper so app.js can open the add-member modal
export function openAddMemberModal(group, friends) {
  _openGroupModal(friends, 'add-member', group, group.members ?? []);
}

// ===== Groups List (with leave/delete + add member) =====

export function renderGroupsList(groups, currentUid, onViewGroup, onLeaveGroup, onAddMembers, friends = []) {
  const el = document.getElementById('groups-list');
  if (!el) return;

  if (!groups.length) {
    el.innerHTML = '<p class="social-empty">No groups yet.</p>';
    return;
  }

  el.innerHTML = '';
  groups.forEach(group => {
    const item = document.createElement('div');
    item.className = 'social-item';
    item.dataset.id = group.id;

    const isCreator   = group.created_by === currentUid;
    const leaveLabel  = isCreator ? '🗑️' : '✕';
    const leaveTitle  = isCreator ? 'Delete group' : 'Leave group';
    const memberCount = (group.members ?? []).length;

    item.innerHTML = `
      <div class="social-avatar-placeholder">🌍</div>
      <span class="social-name">${group.name}</span>
      <button class="btn-add-member" title="Add member">👤+</button>
      <button class="btn-leave-group" title="${leaveTitle}">${leaveLabel}</button>
    `;

    // Row click → view group
    item.addEventListener('click', e => {
      if (e.target.closest('.btn-leave-group') || e.target.closest('.btn-add-member')) return;
      onViewGroup(group);
    });

    // Add member button
    item.querySelector('.btn-add-member').addEventListener('click', e => {
      e.stopPropagation();
      openAddMemberModal(group, friends);
    });

    // Leave/delete button
    item.querySelector('.btn-leave-group').addEventListener('click', e => {
      e.stopPropagation();
      const msg   = isCreator
        ? `Delete group "${group.name}"? This cannot be undone.`
        : `Leave group "${group.name}"?`;
      const label = isCreator ? 'Delete' : 'Leave';
      showConfirm(msg, label, () => onLeaveGroup(group.id, group.created_by));
    });

    el.appendChild(item);
  });
}

// ===== Country Tooltip (Countries map mode) =====

let _countryTooltipCb = null;

export function setupCountryTooltip() {
  document.getElementById('country-tooltip-close')?.addEventListener('click', hideCountryTooltip);
  ['visited', 'wishlist', 'remove'].forEach(action => {
    document.getElementById(`country-tooltip-${action}`)?.addEventListener('click', () => {
      _countryTooltipCb?.(action);
      hideCountryTooltip();
    });
  });
}

export function showCountryTooltip(isoCode, name, isVisited, isWishlist, point, onAction) {
  _countryTooltipCb = action => onAction(action, isoCode, name);

  const el        = document.getElementById('country-tooltip');
  const removeBtn = document.getElementById('country-tooltip-remove');
  document.getElementById('country-tooltip-name').textContent = name;

  // Show "Remove" only if already tracked
  const tracked = isVisited || isWishlist;
  removeBtn.style.display = tracked ? 'block' : 'none';

  // Position near click, keep inside viewport
  const x = Math.min(point.x + 10, window.innerWidth  - 200);
  const y = Math.min(point.y - 10, window.innerHeight - 160);
  el.style.left    = x + 'px';
  el.style.top     = y + 'px';
  el.style.display = 'block';
}

export function hideCountryTooltip() {
  const el = document.getElementById('country-tooltip');
  if (el) el.style.display = 'none';
  _countryTooltipCb = null;
}

// ===== Countries View =====

export function updateCountriesView(userData) {
  const visited  = (userData.visited_countries  ?? []).length;
  const wishlist = (userData.wishlist_countries ?? []).length;

  // Stat grid (same totals as always)
  _setText('stat-countries-num', visited);
  _setText('stat-cities-num',    (userData.visited_cities ?? []).length);

  // Collection nav badges — country-aware
  _setText('nav-all-count',      visited + wishlist);
  _setText('nav-visited-count',  visited);
  _setText('nav-wishlist-count', wishlist);
  _setText('nav-lived-count',    0);

  // Recent logs — countries
  _updateCountryLogs(userData.visited_countries ?? [], userData.wishlist_countries ?? []);
}

function _updateCountryLogs(visitedCodes, wishlistCodes) {
  const el = document.getElementById('recent-logs');
  if (!el) return;

  // Show last 3 visited countries, fill remainder with wishlist if needed
  const recent = [
    ...[...visitedCodes].reverse().slice(0, 3).map(code => ({ code, type: 'visited' })),
    ...[...wishlistCodes].reverse().map(code => ({ code, type: 'wishlist' }))
  ].slice(0, 3);

  if (recent.length === 0) {
    el.innerHTML = '<p class="recent-log-meta" style="color:#374151">No countries tracked yet.</p>';
    return;
  }

  let countryNames;
  try { countryNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { countryNames = null; }

  el.innerHTML = recent.map(({ code, type }) => {
    let name = code;
    try { name = countryNames?.of(code) || code; } catch { name = code; }
    const icon = type === 'visited' ? '🌍' : '⭐';
    return `
      <div class="recent-log-item">
        <div class="recent-log-icon">${icon}</div>
        <div>
          <p class="recent-log-city">${name}</p>
          <p class="recent-log-meta">${type === 'visited' ? 'Visited' : 'Wishlist'}</p>
        </div>
      </div>
    `;
  }).join('');
}

// ===== View Mode Banner =====

export function showViewBanner(title, onBack) {
  const banner  = document.getElementById('view-banner');
  const titleEl = document.getElementById('view-banner-title');
  const backBtn = document.getElementById('view-banner-back');
  if (!banner) return;

  titleEl.textContent = title;
  // Replace old listener by cloning the button
  const newBack = backBtn.cloneNode(true);
  backBtn.parentNode.replaceChild(newBack, backBtn);
  newBack.addEventListener('click', onBack);
  banner.style.display = 'flex';
}

export function hideViewBanner() {
  const banner = document.getElementById('view-banner');
  if (banner) banner.style.display = 'none';
}
