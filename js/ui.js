import { MAPBOX_TOKEN } from './constants.js?v=12';
import { searchCountries } from './countries.js?v=23';
import { t, getLang } from './i18n.js?v=8';
import { searchLocalCities } from './places.js?v=2';
import { normalize } from './place-search.js?v=1';
import { isOnline } from './net-status.js?v=1';
import { isNative } from './platform.js?v=1';
import {
  openOverlay, closeOverlay, popoverIn,
  countUp, popScale, toastIn, toastOut, expandIn
} from './anim.js?v=2';

// Escapes user-controlled strings before interpolation into innerHTML.
// Friend names, group names and city names come from Firestore and can be
// written by other users — never trust them.
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

// Avatar URLs are written by other users — only allow http(s).
function safeUrl(url) {
  return /^https?:\/\//i.test(url ?? '') ? url : '';
}

// ===== Stats & Sidebar =====

export function updateStats(userData) {
  const countries = (userData.visited_countries  ?? []).length;
  const cities    = (userData.visited_cities     ?? []).length;
  const lived     = (userData.visited_cities     ?? []).filter(c => c.lived).length;
  const wCities   = (userData.wishlist_cities    ?? []).length;
  const wCountries= (userData.wishlist_countries ?? []).length;
  const wishlist  = wCities + wCountries;

  // Snapshot grid — counts up on first render, ticks with a pop on change
  _setStat('stat-countries-num', countries);
  _setStat('stat-cities-num',    cities);

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

// Animated stat numbers: first render counts up from 0, later changes
// count from the previous value with a small scale pop.
const _statPrev = {};

function _setStat(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const prev = _statPrev[id];
  _statPrev[id] = value;
  if (prev === undefined) {
    countUp(el, value, 0, 0.8);
  } else if (prev !== value) {
    countUp(el, value, prev, 0.35);
    popScale(el);
  } else {
    el.textContent = value;
  }
}

// Mobile drawer: the initial count-up plays while the sidebar is off-screen,
// so the hamburger handler replays it every time the drawer opens.
export function replayStatsCountUp() {
  for (const id of ['stat-countries-num', 'stat-cities-num']) {
    const value = _statPrev[id];
    if (value !== undefined) countUp(document.getElementById(id), value, 0, 0.8);
  }
}

// Tracks the newest log entry so a newly added one can grow into the list.
// Kind guard: switching cities ↔ countries mode replaces the whole list and
// must not play the insert animation.
let _lastLogKey = null;

function _animateNewLogEntry(containerEl, kind, firstLabel) {
  const key = firstLabel ? `${kind}:${firstLabel}` : null;
  const prev = _lastLogKey;
  _lastLogKey = key;
  if (!key || !prev || prev === key) return;
  if (prev.split(':')[0] !== kind) return;
  const first = containerEl.querySelector('.recent-log-item');
  if (first) expandIn(first);
}

function _updateRecentLogs(visitedCities) {
  const el = document.getElementById('recent-logs');
  if (!el) return;

  const recent = [...visitedCities].reverse().slice(0, 3);

  if (recent.length === 0) {
    el.innerHTML = `<p class="recent-log-meta" style="color:#374151">${t('empty.noCities')}</p>`;
    return;
  }

  el.innerHTML = recent.map(city => `
    <div class="recent-log-item">
      <div class="recent-log-icon">📍</div>
      <div>
        <p class="recent-log-city">${esc(city.name)}</p>
        <p class="recent-log-meta">${esc(city.country) || '—'}</p>
      </div>
    </div>
  `).join('');

  _animateNewLogEntry(el, 'cities', recent[0]?.name);
}

// ===== City Remove Popup =====

let _cityPopupData = null; // { city, type }

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
  resultsEl.innerHTML = `<div class="search-result-item">${t('search.searching')}</div>`;
  try {
    const countries = await searchCountries(query);
    if (!countries.length) {
      resultsEl.innerHTML = `<div class="search-result-item">${t('search.noCountries')}</div>`;
      return;
    }
    resultsEl.innerHTML = '';
    countries.forEach(country => {
      const item = document.createElement('div');
      item.className = 'search-result-item search-country-item';
      item.innerHTML = `
        <span class="search-country-name">${esc(country.name)}</span>
        <span class="search-country-iso">${esc(country.isoCode)}</span>
        <button class="country-add-btn visited" data-type="visited">${t('dialog.visited')}</button>
        <button class="country-add-btn wishlist" data-type="wishlist">${t('dialog.wishlist')}</button>
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
    resultsEl.innerHTML = `<div class="search-result-item">${t('search.error')}</div>`;
  }
}

async function _searchCities(query, resultsEl) {
  // Cancel any in-flight request before starting a new one
  if (_searchAbort) _searchAbort.abort();
  _searchAbort = new AbortController();
  const signal = _searchAbort.signal;

  resultsEl.innerHTML = `<div class="search-result-item">${t('search.searching')}</div>`;

  // Zuerst der lokale Datensatz: sofort da und funktioniert ohne Netz.
  let local = [];
  try {
    local = await searchLocalCities(query, 5);
  } catch (err) {
    console.error('[TM] local place index failed:', err);
  }
  if (signal.aborted) return;
  if (local.length) _renderCityResults(resultsEl, local);

  if (!isOnline()) {
    if (!local.length) resultsEl.innerHTML = `<div class="search-result-item">${t('search.noResults')}</div>`;
    return;
  }

  // Mit Netz kommt Mapbox dazu: kleine Orte und Schreibweisen, die der
  // lokale Datensatz nicht kennt. Die lokalen Treffer bleiben vorne.
  try {
    const url  = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?types=place&limit=5&access_token=${MAPBOX_TOKEN}`;
    const res  = await fetch(url, { signal });
    const data = await res.json();
    const remote = (data.features ?? [])
      .filter(f => f.center)
      .map(f => ({
        name:    f.text,
        lat:     f.center[1],
        lng:     f.center[0],
        country: f.context?.find(c => c.id.startsWith('country.'))?.short_code?.toUpperCase() || 'XX',
        label:   f.place_name
      }));
    const merged = _mergeCityResults(local, remote, 6);
    if (signal.aborted) return;
    if (!merged.length) {
      resultsEl.innerHTML = `<div class="search-result-item">${t('search.noResults')}</div>`;
      return;
    }
    _renderCityResults(resultsEl, merged);
  } catch (e) {
    if (e.name === 'AbortError') return;
    // Netz laut Browser da, Anfrage trotzdem gescheitert: lokale Treffer
    // stehen bereits, nur wenn es keine gibt, ist es ein echter Fehler.
    if (!local.length) resultsEl.innerHTML = `<div class="search-result-item">${t('search.error')}</div>`;
  }
}

/** Gleiche Orte aus beiden Quellen nur einmal, lokale Treffer zuerst. */
function _mergeCityResults(local, remote, limit) {
  const seen = new Set(local.map(c => `${normalize(c.name)}|${c.country}`));
  const merged = [...local];
  for (const city of remote) {
    const key = `${normalize(city.name)}|${city.country}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(city);
  }
  return merged.slice(0, limit);
}

function _renderCityResults(resultsEl, cities) {
  resultsEl.innerHTML = '';
  cities.forEach(city => {
    const item = document.createElement('div');
    item.className   = 'search-result-item';
    item.textContent = city.label ?? city.name;
    item.addEventListener('click', () => {
      _selectedCity = {
        name:    city.name,
        lat:     city.lat,
        lng:     city.lng,
        country: city.country
      };
      _openDialog(city.name);
      resultsEl.innerHTML = '';
    });
    resultsEl.appendChild(item);
  });
}

function _openDialog(cityName) {
  document.getElementById('dialog-city-name').textContent = cityName;
  document.querySelectorAll('.radio-opt').forEach((o, i) => o.classList.toggle('selected', i === 0));
  document.getElementById('lived-checkbox').checked   = false;
  document.getElementById('lived-row').style.display  = 'flex';
  openOverlay(document.getElementById('city-dialog'));
}

function _closeDialog() {
  closeOverlay(document.getElementById('city-dialog'));
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
  document.getElementById('confirm-ok').textContent = actionLabel || t('dialog.confirm');
  openOverlay(document.getElementById('confirm-dialog'));
}

function _closeConfirm() {
  closeOverlay(document.getElementById('confirm-dialog'));
  _confirmCb = null;
}

// ===== Toast =====

/**
 * Einmaliger Hinweis, dass die App gerade ohne Netz laeuft. Bewusst ein
 * Popup zum Wegklicken und kein Dauerbanner: das stand vorher im Weg,
 * besonders bei der Suche.
 */
export function showOfflineNotice() {
  const dialog = document.getElementById('offline-dialog');
  if (!dialog || dialog.classList.contains('open')) return;
  openOverlay(dialog);
}

export function setupOfflineNotice() {
  const dialog = document.getElementById('offline-dialog');
  const close  = () => closeOverlay(dialog);
  document.getElementById('offline-ok')?.addEventListener('click', close);
  dialog?.addEventListener('click', e => { if (e.target === dialog) close(); });
}

let _onlineFlashTimer = null;

/** Kurze gruene Rueckmeldung auf der Karte, wenn das Netz zurueck ist. */
export function showOnlineFlash() {
  const flash = document.getElementById('online-flash');
  if (!flash) return;
  flash.hidden = false;
  // Zwei Frames warten, sonst ueberspringt der Browser den Uebergang.
  requestAnimationFrame(() => requestAnimationFrame(() => flash.classList.add('show')));
  clearTimeout(_onlineFlashTimer);
  _onlineFlashTimer = setTimeout(() => {
    flash.classList.remove('show');
    setTimeout(() => { flash.hidden = true; }, 350);
  }, 2600);
}

let _toastTimer = null;

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  toastIn(toast);
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    toastOut(toast);
  }, 3000);
}

// ===== Friends Sidebar =====

/**
 * Renders the friends list and wires the copy-invite + reset-link buttons.
 * friends: Array<{ uid, display_name, avatar_url }>
 * onViewFriend(friend): called when user clicks a friend row
 * onResetToken(): called when user clicks Reset (returns new token promise)
 */
export function setupFriendsSidebar(uid, inviteToken, friends, onViewFriend, onDeleteFriend) {
  // Wire invite button: share sheet in the app, clipboard in the browser
  document.getElementById('btn-copy-invite')?.addEventListener('click', () => {
    // In the iOS app the origin is capacitor://localhost, which nobody else
    // can open. Invites there point at the public site instead; in the
    // browser the current origin keeps local test servers working.
    const origin = isNative() ? 'https://travel.marinpesa.dev' : window.location.origin;
    const link = `${origin}/map.html?token=${inviteToken}`;
    if (isNative()) _shareInvite(link);
    else _copyInvite(link);
  });

  renderFriendsList(friends, onViewFriend, onDeleteFriend);
}

function _copyInvite(link) {
  navigator.clipboard.writeText(link).then(() => {
    showToast(t('toast.inviteCopied'));
  }).catch(() => {
    showToast(t('toast.copyFailed'));
  });
}

// Opens the iOS share sheet (WhatsApp, Messages, AirDrop, Copy, ...) via
// @capacitor/share. Only the URL is handed over: extra text next to it makes
// AirDrop send a note instead of a link that opens in Safari.
async function _shareInvite(link) {
  try {
    await window.Capacitor.nativePromise('Share', 'share', { url: link, title: 'TravelMap' });
  } catch (err) {
    // Closing the sheet or tapping twice is not an error worth a toast
    if (/cancel|in progress/i.test(err?.message || '')) return;
    _copyInvite(link);
  }
}

export function renderFriendsList(friends, onViewFriend, onDeleteFriend) {
  const el = document.getElementById('friends-list');
  if (!el) return;

  if (!friends.length) {
    el.innerHTML = `<p class="social-empty">${t('empty.noFriends')}</p>`;
    return;
  }

  el.innerHTML = '';
  friends.forEach(friend => {
    const item = document.createElement('div');
    item.className = 'social-item';
    item.dataset.uid = friend.uid;

    const avatarUrl = safeUrl(friend.avatar_url);
    const avatar = avatarUrl
      ? `<img class="social-avatar" src="${esc(avatarUrl)}" alt="" loading="lazy">`
      : `<div class="social-avatar-placeholder">👤</div>`;

    item.innerHTML = `
      ${avatar}
      <span class="social-name">${esc(friend.display_name) || t('friend.fallback')}</span>
      <button class="btn-remove-friend" title="${t('friend.removeTitle')}">✕</button>
    `;
    item.addEventListener('click', e => {
      if (e.target.closest('.btn-remove-friend')) return;
      onViewFriend(friend);
    });
    item.querySelector('.btn-remove-friend').addEventListener('click', e => {
      e.stopPropagation();
      const name = friend.display_name || t('friend.fallback');
      showConfirm(t('confirm.removeFriend', { name }), t('dialog.remove'), () => onDeleteFriend?.(friend.uid));
    });
    el.appendChild(item);
  });
}

// ===== Groups Sidebar =====

let _groupModalCreateCb      = null;
let _groupModalAddMemberCb   = null;
let _groupModalRemoveMemberCb = null;
let _groupModalUid           = null;
let _groupModalMode          = 'create'; // 'create' | 'add-member'
let _groupModalTargetGroup   = null;

/**
 * Renders groups list and wires the "+ New" button.
 * groups: Array<{ id, name, members }>
 * friends: Array<{ uid, display_name }>
 * onCreateGroup(name, memberUids): called when group is created
 * onViewGroup(group): called when user clicks a group row
 * onAddMembers(groupId, friendUids): called when adding members to existing group
 */
export function setupGroupsSidebar(groups, friends, currentUid, onCreateGroup, onViewGroup, onLeaveGroup, onAddMembers, onRemoveMember) {
  _groupModalCreateCb       = onCreateGroup;
  _groupModalAddMemberCb    = onAddMembers;
  _groupModalRemoveMemberCb = onRemoveMember;
  _groupModalUid            = currentUid;

  document.getElementById('btn-create-group')?.addEventListener('click', () => {
    _openGroupModal(friends, 'create');
  });

  document.getElementById('group-modal-cancel')?.addEventListener('click', _closeGroupModal);
  document.getElementById('group-modal')?.addEventListener('click', e => {
    if (e.target.id === 'group-modal') _closeGroupModal();
  });

  document.getElementById('group-modal-create')?.addEventListener('click', () => {
    const checked = [...document.querySelectorAll('#group-friends-checklist input:checked')];
    if (!checked.length) { showToast(t('toast.selectPerson')); return; }
    const memberUids = checked.map(cb => cb.value);

    if (_groupModalMode === 'create') {
      const name = document.getElementById('group-name-input')?.value.trim();
      if (!name) { showToast(t('toast.enterGroupName')); return; }
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

  const titleEl        = document.getElementById('group-modal-title');
  const nameRow        = document.getElementById('group-name-row');
  const friendLabel    = document.getElementById('group-friends-label');
  const createBtn      = document.getElementById('group-modal-create');
  const cancelBtn      = document.getElementById('group-modal-cancel');
  const checklist      = document.getElementById('group-friends-checklist');
  const membersSection = document.getElementById('group-members-section');
  if (!checklist) return;

  if (mode === 'create') {
    titleEl.textContent            = t('group.new');
    nameRow.style.display          = '';
    // Guard: browsers may hold a cached map.html (max-age) that predates
    // the members section — the modal must still work without it.
    if (membersSection) membersSection.style.display = 'none';
    friendLabel.textContent        = t('group.addFriends');
    createBtn.textContent          = t('dialog.create');
    cancelBtn.textContent          = t('dialog.cancel');
    document.getElementById('group-name-input').value = '';

    if (!friends.length) {
      checklist.innerHTML = `<p class="social-empty">${t('empty.addFriendsFirst')}</p>`;
    } else {
      checklist.innerHTML = friends.map(f => `
        <label class="group-check-item">
          <input type="checkbox" value="${esc(f.uid)}">
          <span class="group-check-name">${esc(f.display_name) || t('friend.fallback')}</span>
        </label>
      `).join('');
    }
  } else {
    // manage mode: current members (removable by the creator) + add friends
    titleEl.textContent          = t('group.manage', { name: group.name });
    nameRow.style.display        = 'none';
    if (membersSection) membersSection.style.display = '';
    friendLabel.textContent      = t('group.selectFriends');
    createBtn.textContent        = t('dialog.add');
    cancelBtn.textContent        = t('dialog.close');

    _renderGroupMembers(group, friends);

    const available = friends.filter(f => !allMembers.includes(f.uid));
    if (!available.length) {
      checklist.innerHTML = `<p class="social-empty">${t('empty.allInGroup')}</p>`;
    } else {
      checklist.innerHTML = available.map(f => `
        <label class="group-check-item">
          <input type="checkbox" value="${esc(f.uid)}">
          <span class="group-check-name">${esc(f.display_name) || t('friend.fallback')}</span>
        </label>
      `).join('');
    }
  }

  openOverlay(document.getElementById('group-modal'));
}

function _closeGroupModal() {
  closeOverlay(document.getElementById('group-modal'));
}

// Renders the current member list inside the manage modal.
// Names resolve from the viewer's friends list; members who aren't the
// viewer's friends can't be looked up (rules) and show as "Member".
function _renderGroupMembers(group, friends) {
  const listEl = document.getElementById('group-members-list');
  if (!listEl) return;

  const isCreator = group.created_by === _groupModalUid;
  listEl.innerHTML = '';

  (group.members ?? []).forEach(uid => {
    const friend = friends.find(f => f.uid === uid);
    const name   = uid === _groupModalUid ? t('group.you')
                 : (friend?.display_name || t('group.member'));

    const avatarUrl = safeUrl(friend?.avatar_url);
    const avatar = avatarUrl
      ? `<img class="social-avatar" src="${esc(avatarUrl)}" alt="" loading="lazy">`
      : `<div class="social-avatar-placeholder">👤</div>`;

    const badge     = uid === group.created_by ? `<span class="group-member-badge" title="${t('group.creator')}">👑</span>` : '';
    const removable = isCreator && uid !== group.created_by;

    const item = document.createElement('div');
    item.className = 'group-member-item';
    item.innerHTML = `
      ${avatar}
      <span class="group-member-name">${esc(name)}</span>
      ${badge}
      ${removable ? `<button class="btn-remove-friend" title="${t('group.removeFromGroup')}">✕</button>` : ''}
    `;

    item.querySelector('.btn-remove-friend')?.addEventListener('click', () => {
      showConfirm(t('confirm.removeMember', { name, group: group.name }), t('dialog.remove'), () => {
        _groupModalRemoveMemberCb?.(group.id, uid);
        // Optimistic update: re-render the whole modal so the member list
        // and the "add friends" checklist both reflect the change
        group.members = (group.members ?? []).filter(m => m !== uid);
        openAddMemberModal(group, friends);
      });
    });

    listEl.appendChild(item);
  });
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
    el.innerHTML = `<p class="social-empty">${t('empty.noGroups')}</p>`;
    return;
  }

  el.innerHTML = '';
  groups.forEach(group => {
    const item = document.createElement('div');
    item.className = 'social-item';
    item.dataset.id = group.id;

    const isCreator   = group.created_by === currentUid;
    const leaveLabel  = isCreator ? '🗑️' : '✕';
    const leaveTitle  = isCreator ? t('group.deleteTitle') : t('group.leaveTitle');
    const memberCount = (group.members ?? []).length;

    item.innerHTML = `
      <div class="social-avatar-placeholder">🌍</div>
      <span class="social-name">${esc(group.name)}</span>
      <button class="btn-add-member" title="${t('group.manageMembers')}">👤+</button>
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
        ? t('confirm.deleteGroup', { name: group.name })
        : t('confirm.leaveGroup', { name: group.name });
      const label = isCreator ? t('dialog.delete') : t('dialog.leave');
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
  popoverIn(el);
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
  _setStat('stat-countries-num', visited);
  _setStat('stat-cities-num',    (userData.visited_cities ?? []).length);

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
    el.innerHTML = `<p class="recent-log-meta" style="color:#374151">${t('empty.noCountries')}</p>`;
    return;
  }

  let countryNames;
  try { countryNames = new Intl.DisplayNames([getLang()], { type: 'region' }); } catch { countryNames = null; }

  el.innerHTML = recent.map(({ code, type }) => {
    let name = code;
    try { name = countryNames?.of(code) || code; } catch { name = code; }
    const icon = type === 'visited' ? '🌍' : '⭐';
    return `
      <div class="recent-log-item">
        <div class="recent-log-icon">${icon}</div>
        <div>
          <p class="recent-log-city">${esc(name)}</p>
          <p class="recent-log-meta">${type === 'visited' ? t('recent.visited') : t('recent.wishlist')}</p>
        </div>
      </div>
    `;
  }).join('');

  _animateNewLogEntry(el, 'countries', recent[0]?.code);
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

// ===== Group Photo Dialog =====

/**
 * Compresses an image file to a square JPEG thumbnail (Base64).
 * @param {File} file
 * @param {number} size — output px (default 120)
 * @returns {Promise<string>} Base64 data URL
 */
async function _compressImage(file, size = 240) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Centre-crop to square
        const min = Math.min(img.width, img.height);
        const sx  = (img.width  - min) / 2;
        const sy  = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Shows the group photo picker dialog.
 * @param {string} cityName
 * @param {string} defaultPhotoURL — profile photo shown as starting preview
 * @param {function} onConfirm(photoURL: string) — called with chosen/default URL
 */
export function showGroupPhotoDialog(cityName, defaultPhotoURL, onConfirm) {
  const dialog  = document.getElementById('group-photo-dialog');
  const preview = document.getElementById('group-photo-preview');
  const input   = document.getElementById('group-photo-input');
  const titleEl = document.getElementById('group-photo-title');
  if (!dialog) return;

  titleEl.textContent = t('photo.title', { city: cityName });
  preview.src         = defaultPhotoURL || '';
  input.value         = ''; // reset file picker

  let _chosenURL = defaultPhotoURL || '';

  // File chosen → compress and preview
  const _onFileChange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      _chosenURL  = await _compressImage(file);
      preview.src = _chosenURL;
    } catch {
      showToast(t('toast.imageFailed'));
    }
  };
  input.removeEventListener('change', input._photoHandler);
  input._photoHandler = _onFileChange;
  input.addEventListener('change', _onFileChange);

  // Skip → use default
  const skipBtn    = document.getElementById('group-photo-skip');
  const confirmBtn = document.getElementById('group-photo-confirm');

  const _cleanup = () => {
    closeOverlay(dialog);
    skipBtn.onclick    = null;
    confirmBtn.onclick = null;
  };

  skipBtn.onclick    = () => { _cleanup(); onConfirm(defaultPhotoURL || ''); };
  confirmBtn.onclick = () => { _cleanup(); onConfirm(_chosenURL); };

  openOverlay(dialog);
}

/**
 * Shows city popup, optionally with a "Change photo" button (group view).
 * @param {object}   city
 * @param {string}   type — 'visited' | 'wishlist'
 * @param {number}   clientX
 * @param {number}   clientY
 * @param {function} onRemove(city, type)
 * @param {function} [onChangePhoto(city, type)] — if provided, shows change-photo button
 * @param {function} [onMarkVisited(city)] — if provided, wishlist pins get a "mark as visited" button
 */
export function showCityPopup(city, type, clientX, clientY, onRemove, onChangePhoto = null, onMarkVisited = null) {
  _cityPopupData = { city, type };
  const popup = document.getElementById('city-popup');
  document.getElementById('city-popup-name').textContent = city.name;

  const x = Math.min(clientX + 10, window.innerWidth  - 180);
  const y = Math.min(clientY - 10, window.innerHeight - 120);
  popup.style.left    = x + 'px';
  popup.style.top     = y + 'px';
  popup.style.display = 'block';
  popoverIn(popup);

  const markBtn = document.getElementById('btn-mark-visited');
  if (onMarkVisited && type === 'wishlist') {
    markBtn.style.display = 'block';
    markBtn.onclick = () => {
      const snapshot = _cityPopupData; // save before hideCityPopup nulls _cityPopupData
      hideCityPopup();
      if (snapshot) onMarkVisited(snapshot.city);
    };
  } else {
    markBtn.style.display = 'none';
    markBtn.onclick = null;
  }

  document.getElementById('btn-remove-city').onclick = () => {
    if (_cityPopupData) onRemove(_cityPopupData.city, _cityPopupData.type);
    hideCityPopup();
  };

  // Change-photo button — only in group visited view
  let photoBtn = document.getElementById('btn-change-photo');
  if (onChangePhoto && type === 'visited') {
    if (!photoBtn) {
      photoBtn = document.createElement('button');
      photoBtn.id        = 'btn-change-photo';
      photoBtn.className = 'btn-change-photo';
      photoBtn.textContent = t('popup.photo');
      document.getElementById('city-popup').appendChild(photoBtn);
    }
    photoBtn.style.display = 'block';
    photoBtn.onclick = () => {
      const snapshot = _cityPopupData; // save before hideCityPopup nulls _cityPopupData
      hideCityPopup();
      if (snapshot) onChangePhoto(snapshot.city, snapshot.type);
    };
  } else if (photoBtn) {
    photoBtn.style.display = 'none';
  }
}
