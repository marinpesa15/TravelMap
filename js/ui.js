import { MAPBOX_TOKEN } from './constants.js?v=12';

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

// ===== Country Tooltip =====

let _tooltipData = null; // { isoCode, countryName }

/**
 * Wires up the country tooltip. Call once after map loads.
 * onAction(action, isoCode) where action = 'visited' | 'wishlist' | 'remove'
 */
export function setupCountryTooltip(map, onAction) {
  const tooltip = document.getElementById('country-tooltip');

  map.on('click', 'country-click', (e) => {
    // Mark the native event so the generic map click handler in app.js
    // knows a layer feature was clicked and should NOT close the tooltip.
    e.originalEvent._handled = true;

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
export function setupFriendsSidebar(uid, inviteToken, friends, onViewFriend) {
  // Wire copy-invite button
  document.getElementById('btn-copy-invite')?.addEventListener('click', () => {
    const link = `${window.location.origin}/map.html?token=${inviteToken}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('Invite link copied! 🔗');
    }).catch(() => {
      showToast('Could not copy link.');
    });
  });

  renderFriendsList(friends, onViewFriend);
}

export function renderFriendsList(friends, onViewFriend) {
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

    item.innerHTML = `${avatar}<span class="social-name">${friend.display_name || 'Friend'}</span>`;
    item.addEventListener('click', () => onViewFriend(friend));
    el.appendChild(item);
  });
}

// ===== Groups Sidebar =====

let _groupModalCreateCb = null;

/**
 * Renders groups list and wires the "+ New" button.
 * groups: Array<{ id, name, members }>
 * friends: Array<{ uid, display_name }>
 * onCreateGroup(name, memberUids): called when group is created
 * onViewGroup(group): called when user clicks a group row
 */
export function setupGroupsSidebar(groups, friends, currentUid, onCreateGroup, onViewGroup, onLeaveGroup) {
  _groupModalCreateCb = onCreateGroup;

  document.getElementById('btn-create-group')?.addEventListener('click', () => {
    _openGroupModal(friends);
  });

  document.getElementById('group-modal-cancel')?.addEventListener('click', _closeGroupModal);
  document.getElementById('group-modal')?.addEventListener('click', e => {
    if (e.target.id === 'group-modal') _closeGroupModal();
  });

  document.getElementById('group-modal-create')?.addEventListener('click', () => {
    const name = document.getElementById('group-name-input')?.value.trim();
    if (!name) { showToast('Please enter a group name.'); return; }

    const checked = [...document.querySelectorAll('#group-friends-checklist input:checked')];
    if (!checked.length) { showToast('Select at least one friend.'); return; }

    const memberUids = checked.map(cb => cb.value);
    _groupModalCreateCb?.(name, memberUids);
    _closeGroupModal();
  });

  renderGroupsList(groups, currentUid, onViewGroup, onLeaveGroup);
}

function _openGroupModal(friends) {
  const checklist = document.getElementById('group-friends-checklist');
  if (!checklist) return;
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

  document.getElementById('group-modal').classList.add('open');
}

function _closeGroupModal() {
  document.getElementById('group-modal').classList.remove('open');
}

// ===== Groups List (with leave/delete) =====

export function renderGroupsList(groups, currentUid, onViewGroup, onLeaveGroup) {
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

    const isCreator = group.created_by === currentUid;
    const leaveLabel = isCreator ? '🗑️' : '✕';
    const leaveTitle = isCreator ? 'Delete group' : 'Leave group';

    item.innerHTML = `
      <div class="social-avatar-placeholder">🌍</div>
      <span class="social-name">${group.name}</span>
      <button class="btn-leave-group" title="${leaveTitle}">${leaveLabel}</button>
    `;

    // Row click → view group
    item.addEventListener('click', e => {
      if (e.target.closest('.btn-leave-group')) return;
      onViewGroup(group);
    });

    // Leave/delete button
    item.querySelector('.btn-leave-group').addEventListener('click', e => {
      e.stopPropagation();
      const confirmMsg = isCreator
        ? `Delete group "${group.name}"? This cannot be undone.`
        : `Leave group "${group.name}"?`;
      if (confirm(confirmMsg)) onLeaveGroup(group.id, group.created_by);
    });

    el.appendChild(item);
  });
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
