# Friends & Groups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a friends system (invite via personal link) and groups (from existing friends) with separate read-only map view modes for each.

**Architecture:** Each user gets a permanent `invite_token` stored in Firestore. Friend acceptance is a client-side batch write when someone loads `map.html?token=…`. Groups are created by selecting existing friends and stored as a top-level Firestore collection. View modes swap the markers on the shared map without navigating away.

**Tech Stack:** Vanilla JS ES modules, Mapbox GL JS v3.4.0, Firebase Firestore v10.12.0 (CDN), Firebase Hosting

## Global Constraints

- All Firebase imports from `https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js` (no npm bundler)
- No new external dependencies
- File cache-bust suffix currently `?v=12` — increment to `?v=13` in Task 10 only (all files at once)
- Deploy target: `travelmap-f4e3a` via `firebase deploy --only hosting`
- Follow existing code style: 2-space indent, single quotes, arrow functions

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `js/db.js` | Modify | Add `initUserProfile`, `getUserByToken` |
| `js/friends.js` | Create | `loadFriends`, `addFriendship`, `removeFriend` |
| `js/groups.js` | Create | `createGroup`, `loadGroups`, `leaveGroup` |
| `js/markers.js` | Modify | Add `renderReadOnlyMarkers`, guard null `onRemove` |
| `js/ui.js` | Modify | Add friends list, groups list, view banner, group modal |
| `js/app.js` | Modify | Token join flow, view mode switching, wire friends/groups |
| `map.html` | Modify | Friends/groups sidebar HTML, view banner, group modal |
| `css/style.css` | Modify | Friends, groups, banner, group modal styles |
| `firestore.rules` | Create | Security rules for friends subcollection + groups |

---

## Task 1: Firestore user profile + invite token

**Files:**
- Modify: `js/db.js`
- Create: `firestore.rules`

**Interfaces:**
- Produces: `initUserProfile(uid, user)` → `Promise<void>`, writes `display_name`, `avatar_url`, `invite_token` to `users/{uid}`
- Produces: `getUserByToken(token)` → `Promise<{uid, display_name, avatar_url, invite_token} | null>`
- Produces: `getUserData(uid)` → `Promise<{display_name, avatar_url, ...cityData}>` (alias for loadUserData, already exists)

- [ ] **Step 1: Add new imports to db.js**

Open `js/db.js`. Replace the existing import line with:

```javascript
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc,
  arrayUnion, arrayRemove, query, where, writeBatch, serverTimestamp, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './config.js';
```

- [ ] **Step 2: Add initUserProfile to db.js**

Add after the `ensureDoc` function:

```javascript
/**
 * Writes display_name, avatar_url to the user doc.
 * Generates invite_token once if not already set.
 * user: { displayName, photoURL } from Firebase Auth
 */
export async function initUserProfile(uid, user) {
  const ref  = userRef(uid);
  const snap = await getDoc(ref);
  const profileFields = {
    display_name: user.displayName || '',
    avatar_url:   user.photoURL   || ''
  };
  if (!snap.exists()) {
    await setDoc(ref, {
      ...EMPTY_DATA(),
      ...profileFields,
      invite_token: crypto.randomUUID()
    });
  } else if (!snap.data().invite_token) {
    await updateDoc(ref, { ...profileFields, invite_token: crypto.randomUUID() });
  } else {
    await updateDoc(ref, profileFields);
  }
}

/**
 * Looks up a user by their invite_token.
 * Returns { uid, display_name, avatar_url, invite_token } or null.
 */
export async function getUserByToken(token) {
  const q    = query(collection(db, 'users'), where('invite_token', '==', token));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}

/**
 * Regenerates the user's invite token.
 */
export async function regenerateInviteToken(uid) {
  const newToken = crypto.randomUUID();
  await updateDoc(userRef(uid), { invite_token: newToken });
  return newToken;
}
```

- [ ] **Step 3: Create firestore.rules**

Create `firestore.rules` at the project root:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users: readable by self OR by friends of the user
    match /users/{uid} {
      allow read: if request.auth != null && (
        request.auth.uid == uid ||
        exists(/databases/$(database)/documents/users/$(request.auth.uid)/friends/$(uid))
      );
      allow write: if request.auth != null && request.auth.uid == uid;

      // Friends subcollection: readable/writable by either party
      match /friends/{friendUid} {
        allow read, write: if request.auth != null && (
          request.auth.uid == uid ||
          request.auth.uid == friendUid
        );
      }
    }

    // Groups: readable/writable by members only
    match /groups/{groupId} {
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.members;
      allow create: if request.auth != null;
    }
  }
}
```

- [ ] **Step 4: Wire firebase.json to use rules file**

Open `firebase.json`. In the `"firestore"` section (add it if missing), add:

```json
{
  "hosting": { ... },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 5: Add Firestore index for invite_token**

Create `firestore.indexes.json` at the project root:

```json
{
  "indexes": [],
  "fieldOverrides": [
    {
      "collectionGroup": "users",
      "fieldPath": "invite_token",
      "indexes": [
        { "order": "ASCENDING", "queryScope": "COLLECTION" }
      ]
    }
  ]
}
```

Add to `firebase.json` firestore section:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

- [ ] **Step 6: Call initUserProfile in app.js**

In `js/app.js`, update the `_init` function. Add `initUserProfile` to the import from db.js:

```javascript
import {
  loadUserData, initUserProfile,
  addVisitedCountry,
  addVisitedCity, removeVisitedCity, addWishlistCity, removeWishlistCity
} from './db.js?v=12';
```

Inside `_init(user)`, add as the very first line before `_map = await initMap()`:

```javascript
async function _init(user) {
  try {
    await initUserProfile(_uid, user);   // ← add this line
    _map      = await initMap();
    // ... rest unchanged
```

- [ ] **Step 7: Verify in browser**

Open DevTools → Network → Firestore. Sign in and reload. Confirm in Firebase Console → Firestore → `users/{uid}` that the document now has `display_name`, `avatar_url`, `invite_token` fields.

- [ ] **Step 8: Deploy rules + indexes**

```bash
firebase deploy --only firestore
```

Expected output: `✔  firestore: released rules/indexes`

- [ ] **Step 9: Commit**

```bash
git add js/db.js js/app.js firestore.rules firestore.indexes.json firebase.json
git commit -m "feat: add user profile fields + invite token + firestore rules"
```

---

## Task 2: friends.js — friend operations

**Files:**
- Create: `js/friends.js`

**Interfaces:**
- Consumes: `db` from `./config.js`, Firestore SDK
- Produces: `loadFriends(uid)` → `Promise<Array<{uid, display_name, avatar_url, since}>>`
- Produces: `addFriendship(myUid, theirUid, theirData, myData)` → `Promise<void>`
- Produces: `removeFriend(myUid, friendUid)` → `Promise<void>`
- Produces: `isFriend(myUid, friendUid)` → `Promise<boolean>`

- [ ] **Step 1: Create js/friends.js**

```javascript
import {
  doc, collection, getDoc, getDocs, writeBatch, serverTimestamp, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './config.js';

function _friendRef(uid, friendUid) {
  return doc(db, 'users', uid, 'friends', friendUid);
}

function _friendsCol(uid) {
  return collection(db, 'users', uid, 'friends');
}

/**
 * Returns all friends of uid.
 * Each item: { uid, display_name, avatar_url, since }
 */
export async function loadFriends(uid) {
  const snap = await getDocs(_friendsCol(uid));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

/**
 * Creates bidirectional friendship in a single batch write.
 * myData / theirData: { display_name, avatar_url }
 */
export async function addFriendship(myUid, theirUid, theirData, myData) {
  const batch = writeBatch(db);
  batch.set(_friendRef(myUid, theirUid), {
    display_name: theirData.display_name || '',
    avatar_url:   theirData.avatar_url   || '',
    since:        serverTimestamp()
  });
  batch.set(_friendRef(theirUid, myUid), {
    display_name: myData.display_name || '',
    avatar_url:   myData.avatar_url   || '',
    since:        serverTimestamp()
  });
  await batch.commit();
}

/**
 * Removes friendship from both sides.
 */
export async function removeFriend(myUid, friendUid) {
  const batch = writeBatch(db);
  batch.delete(_friendRef(myUid, friendUid));
  batch.delete(_friendRef(friendUid, myUid));
  await batch.commit();
}

/**
 * Returns true if myUid and friendUid are already friends.
 */
export async function isFriend(myUid, friendUid) {
  const snap = await getDoc(_friendRef(myUid, friendUid));
  return snap.exists();
}
```

- [ ] **Step 2: Verify module loads**

Temporarily add to `app.js`:
```javascript
import { loadFriends } from './friends.js?v=12';
```
Open browser console, confirm no import errors. Remove the temporary import after verifying.

- [ ] **Step 3: Commit**

```bash
git add js/friends.js
git commit -m "feat: add friends.js module (loadFriends, addFriendship, removeFriend)"
```

---

## Task 3: Friend join flow — token detection on load

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `getUserByToken(token)` from `./db.js`
- Consumes: `addFriendship(myUid, theirUid, theirData, myData)` from `./friends.js`
- Consumes: `isFriend(myUid, friendUid)` from `./friends.js`
- Consumes: `showToast(message)` from `./ui.js`

- [ ] **Step 1: Add imports to app.js**

Add to the db.js import line:
```javascript
import {
  loadUserData, initUserProfile, getUserByToken, regenerateInviteToken,
  addVisitedCountry,
  addVisitedCity, removeVisitedCity, addWishlistCity, removeWishlistCity
} from './db.js?v=12';
```

Add a new import line:
```javascript
import { loadFriends, addFriendship, isFriend } from './friends.js?v=12';
```

- [ ] **Step 2: Add _handleInviteToken function to app.js**

Add this function after `_showUserProfile`:

```javascript
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
```

- [ ] **Step 3: Call _handleInviteToken in _init**

Update `_init` to load the user's own profile data and pass it to `_handleInviteToken`. Add after `_userData = await loadUserData(_uid)`:

```javascript
async function _init(user) {
  try {
    await initUserProfile(_uid, user);
    _map      = await initMap();
    _userData = await loadUserData(_uid);

    await _handleInviteToken(_userData);   // ← add this line

    _showUserProfile(user);
    // ... rest unchanged
```

- [ ] **Step 4: Verify in browser**

1. Open Firebase Console → Firestore, note your `invite_token`
2. Open a new incognito window, sign in as a different Google account
3. Navigate to `http://localhost:PORT/map.html?token=YOUR_TOKEN`
4. Confirm toast appears: "You're now friends with [Name]! 🎉"
5. Confirm both users now have each other in their `friends` subcollection in Firestore

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "feat: friend join flow via ?token= URL param"
```

---

## Task 4: Friends sidebar section (HTML + CSS + UI)

**Files:**
- Modify: `map.html`
- Modify: `css/style.css`
- Modify: `js/ui.js`
- Modify: `js/app.js`

**Interfaces:**
- Produces: `setupFriendsSidebar(uid, inviteToken, friends, onViewFriend)` in `ui.js` — renders friends list, wires copy-link button
- Produces: DOM element `#friends-section` with `#friends-list` and `#btn-copy-invite`

- [ ] **Step 1: Add friends section HTML to map.html**

In `map.html`, find the line `<!-- Spacer -->` and insert the friends section BEFORE it:

```html
      <!-- Friends -->
      <div class="sidebar-section" id="friends-section">
        <div class="section-header">
          <p class="section-label">Friends</p>
          <button class="btn-section-action" id="btn-copy-invite" title="Copy invite link">🔗</button>
          <button class="btn-section-action" id="btn-reset-invite" title="Reset invite link" style="font-size:0.65rem">↺</button>
        </div>
        <div id="friends-list" class="social-list"></div>
      </div>

      <!-- Groups (placeholder for Task 6) -->
      <div class="sidebar-section" id="groups-section">
        <div class="section-header">
          <p class="section-label">Groups</p>
          <button class="btn-section-action" id="btn-create-group" title="Create group">+ New</button>
        </div>
        <div id="groups-list" class="social-list"></div>
      </div>
```

- [ ] **Step 2: Add CSS for friends section**

Append to the end of `css/style.css`:

```css
/* ===== Social Sidebar (Friends + Groups) ===== */
.section-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.section-header .section-label { margin-bottom: 0; }

.btn-section-action {
  font-size: 0.75rem; font-weight: 600;
  padding: 3px 8px; border-radius: 6px;
  background: var(--bg-card); border: 1px solid var(--bd-card);
  color: var(--tx-secondary); cursor: pointer; font-family: inherit;
  transition: background 0.15s;
}
.btn-section-action:hover { background: var(--bg-card-hov); }

.social-list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; }

.social-item {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px; border-radius: 9px;
  cursor: pointer; transition: background 0.15s;
  border: 1px solid transparent;
}
.social-item:hover { background: var(--bg-nav-hov); }
.social-item.active {
  background: var(--bg-nav-act); border-color: var(--bd-nav-act);
}
.social-avatar {
  width: 26px; height: 26px; border-radius: 7px;
  object-fit: cover; background: rgba(99,102,241,0.15); flex-shrink: 0;
}
.social-avatar-placeholder {
  width: 26px; height: 26px; border-radius: 7px; flex-shrink: 0;
  background: rgba(99,102,241,0.15);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px;
}
.social-name {
  flex: 1; font-size: 0.82rem; font-weight: 500; color: var(--tx-log-city);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.social-empty {
  font-size: 0.78rem; color: var(--tx-muted); padding: 4px 2px;
}

/* ===== View Mode Banner ===== */
.view-banner {
  position: absolute; top: 0; left: 0; right: 0; z-index: 15;
  display: flex; align-items: center; gap: 10px;
  padding: 10px 16px;
  background: var(--bg-sidebar); border-bottom: 1px solid var(--bd-header);
  backdrop-filter: blur(12px);
}
.view-banner-back {
  background: var(--bg-card); border: 1px solid var(--bd-card);
  border-radius: 8px; padding: 5px 10px;
  font-size: 0.85rem; cursor: pointer; color: var(--tx-primary);
  font-family: inherit; transition: background 0.15s;
}
.view-banner-back:hover { background: var(--bg-card-hov); }
.view-banner-title {
  font-size: 0.9rem; font-weight: 600; color: var(--tx-primary);
}
```

- [ ] **Step 3: Add setupFriendsSidebar to ui.js**

Add at the end of `js/ui.js`:

```javascript
// ===== Friends Sidebar =====

/**
 * Renders the friends list and wires the copy-invite + reset-link buttons.
 * friends: Array<{ uid, display_name, avatar_url }>
 * onViewFriend(friend): called when user clicks a friend row
 * onResetToken(): called when user clicks Reset (returns new token promise)
 */
export function setupFriendsSidebar(uid, inviteToken, friends, onViewFriend, onResetToken) {
  let _currentToken = inviteToken;

  // Wire copy-invite button
  document.getElementById('btn-copy-invite')?.addEventListener('click', () => {
    const link = `${window.location.origin}/map.html?token=${_currentToken}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('Invite link copied! 🔗');
    }).catch(() => {
      showToast('Could not copy link.');
    });
  });

  // Wire reset-token button (long description shown as tooltip)
  document.getElementById('btn-reset-invite')?.addEventListener('click', async () => {
    if (!confirm('Reset invite link? Your old link will stop working.')) return;
    try {
      _currentToken = await onResetToken();
      showToast('Invite link reset ✓');
    } catch {
      showToast('Could not reset link.');
    }
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
```

- [ ] **Step 4: Wire friends section in app.js**

Add `loadFriends` to the friends.js import line (already there from Task 3, confirm it's included).

Add `setupFriendsSidebar`, `renderFriendsList` to the ui.js import (do NOT add view banner imports yet — those come in Task 8):

```javascript
import {
  updateStats, setupCitySearch,
  showCityPopup, hideCityPopup, showToast,
  setupFriendsSidebar, renderFriendsList
} from './ui.js?v=12';
```

In `_init`, after `updateStats(_userData)`, add:

```javascript
    const friends = await loadFriends(_uid);
    setupFriendsSidebar(_uid, _userData.invite_token, friends, _switchToFriendView, () => regenerateInviteToken(_uid));
```

Add a placeholder for `_switchToFriendView` (will be implemented in Task 8):

```javascript
function _switchToFriendView(friend) {
  // implemented in Task 8
  showToast(`Coming soon: ${friend.display_name}'s map`);
}
```

- [ ] **Step 5: Verify in browser**

1. Sign in, check sidebar shows "Friends" section with "No friends yet" message
2. Use the invite link flow from Task 3 to add a friend
3. Reload — friend should appear in the Friends list
4. Click "🔗" button — confirm "Invite link copied!" toast appears
5. Check clipboard contains correct URL format

- [ ] **Step 6: Commit**

```bash
git add map.html css/style.css js/ui.js js/app.js
git commit -m "feat: friends sidebar section with invite link + friends list"
```

---

## Task 5: groups.js — group operations

**Files:**
- Create: `js/groups.js`

**Interfaces:**
- Produces: `createGroup(name, memberUids)` → `Promise<string>` (returns groupId)
- Produces: `loadGroups(uid)` → `Promise<Array<{id, name, created_by, members}>>`
- Produces: `leaveGroup(groupId, uid, createdByUid)` → `Promise<void>`

- [ ] **Step 1: Create js/groups.js**

```javascript
import {
  doc, collection, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db } from './config.js';

/**
 * Creates a new group. memberUids must include the creator's uid as first element.
 * Returns the new group's Firestore document ID.
 */
export async function createGroup(name, memberUids) {
  const ref = doc(collection(db, 'groups'));
  await setDoc(ref, {
    name,
    created_by: memberUids[0],
    created_at: serverTimestamp(),
    members:    memberUids
  });
  return ref.id;
}

/**
 * Returns all groups where uid is a member.
 * Each item: { id, name, created_by, members }
 */
export async function loadGroups(uid) {
  const q    = query(collection(db, 'groups'), where('members', 'array-contains', uid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Leaves a group. If uid is the creator, deletes the group entirely.
 */
export async function leaveGroup(groupId, uid, createdByUid) {
  if (uid === createdByUid) {
    await deleteDoc(doc(db, 'groups', groupId));
  } else {
    await updateDoc(doc(db, 'groups', groupId), { members: arrayRemove(uid) });
  }
}
```

- [ ] **Step 2: Verify module loads**

Temporarily add to `app.js`:
```javascript
import { loadGroups } from './groups.js?v=12';
```
Open browser console, confirm no import errors. Remove after verifying.

- [ ] **Step 3: Commit**

```bash
git add js/groups.js
git commit -m "feat: add groups.js module (createGroup, loadGroups, leaveGroup)"
```

---

## Task 6: Groups sidebar + create modal (HTML + CSS + UI)

**Files:**
- Modify: `map.html`
- Modify: `css/style.css`
- Modify: `js/ui.js`
- Modify: `js/app.js`

**Interfaces:**
- Produces: `setupGroupsSidebar(groups, friends, onCreateGroup, onViewGroup)` in `ui.js`
- Produces: `renderGroupsList(groups, onViewGroup)` in `ui.js`
- Produces: DOM element `#group-modal` with `#group-name-input`, `#group-friends-checklist`

- [ ] **Step 1: Add group create modal HTML to map.html**

Add before the closing `</body>` tag (after the `<!-- Toast -->` div):

```html
  <!-- Group Create Modal -->
  <div id="group-modal" style="display:none">
    <div class="group-modal-card">
      <h3>New Group</h3>
      <input type="text" id="group-name-input" placeholder="Group name…" maxlength="40" autocomplete="off">
      <p class="dialog-label" style="margin-top:14px">Add friends</p>
      <div id="group-friends-checklist" class="group-friends-checklist"></div>
      <div class="dialog-actions" style="margin-top:16px">
        <button class="btn-cancel" id="group-modal-cancel">Cancel</button>
        <button class="btn-add"    id="group-modal-create">Create</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: Add group modal + list CSS to style.css**

Append to the end of `css/style.css`:

```css
/* ===== Group Create Modal ===== */
#group-modal {
  position: fixed; inset: 0; z-index: 40;
  display: none; align-items: center; justify-content: center;
  background: var(--bg-overlay); backdrop-filter: blur(6px);
}
#group-modal.open { display: flex; }
.group-modal-card {
  background: var(--bg-dialog); border: 1px solid var(--bd-dialog);
  border-radius: 16px; padding: 24px;
  width: 90%; max-width: 340px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.group-modal-card h3 {
  font-size: 1rem; font-weight: 700;
  color: var(--tx-primary); margin-bottom: 14px;
}
#group-name-input {
  width: 100%; padding: 9px 12px;
  background: var(--bg-input); border: 1px solid var(--bd-input);
  border-radius: 10px; color: var(--tx-input);
  font-size: 0.84rem; font-family: inherit; outline: none;
}
#group-name-input:focus { border-color: rgba(99,102,241,0.45); }
.group-friends-checklist {
  display: flex; flex-direction: column; gap: 4px;
  max-height: 180px; overflow-y: auto; margin-top: 6px;
}
.group-check-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 8px; border-radius: 8px; cursor: pointer;
  transition: background 0.12s;
}
.group-check-item:hover { background: var(--bg-card-hov); }
.group-check-item input[type="checkbox"] {
  width: 15px; height: 15px; accent-color: #6366f1; cursor: pointer;
}
.group-check-name { font-size: 0.83rem; color: var(--tx-primary); }
```

- [ ] **Step 3: Add setupGroupsSidebar + group modal to ui.js**

Append to the end of `js/ui.js`:

```javascript
// ===== Groups Sidebar =====

let _groupModalCreateCb = null;

/**
 * Renders groups list and wires the "+ New" button.
 * groups: Array<{ id, name, members }>
 * friends: Array<{ uid, display_name }>
 * onCreateGroup(name, memberUids): called when group is created
 * onViewGroup(group): called when user clicks a group row
 */
export function setupGroupsSidebar(groups, friends, onCreateGroup, onViewGroup) {
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

  renderGroupsList(groups, onViewGroup);
}

export function renderGroupsList(groups, onViewGroup) {
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
    item.innerHTML = `
      <div class="social-avatar-placeholder">🌍</div>
      <span class="social-name">${group.name}</span>
    `;
    item.addEventListener('click', () => onViewGroup(group));
    el.appendChild(item);
  });
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
```

- [ ] **Step 4: Wire groups section in app.js**

Add `loadGroups`, `createGroup` imports:

```javascript
import { loadGroups, createGroup } from './groups.js?v=12';
```

Add `setupGroupsSidebar`, `renderGroupsList` to the ui.js import line.

In `_init`, after the friends setup line, add:

```javascript
    const groups = await loadGroups(_uid);
    setupGroupsSidebar(groups, friends, _onCreateGroup, _switchToGroupView);
```

Add handler functions after `_init`:

```javascript
async function _onCreateGroup(name, friendUids) {
  try {
    await createGroup(name, [_uid, ...friendUids]);
    showToast(`Group "${name}" created!`);
    // Refresh groups list
    const groups  = await loadGroups(_uid);
    const friends = await loadFriends(_uid);
    renderGroupsList(groups, _switchToGroupView);
  } catch (err) {
    console.error(err);
    showToast('Failed to create group.');
  }
}

function _switchToGroupView(group) {
  // implemented in Task 9
  showToast(`Coming soon: ${group.name}`);
}
```

- [ ] **Step 5: Verify in browser**

1. Reload — confirm "Groups" section appears in sidebar with "No groups yet."
2. Click "+ New" — modal opens with group name input + friends checklist
3. Enter a name, select a friend, click "Create"
4. Confirm toast "Group created!" and group appears in sidebar
5. Verify Firestore has new `groups/{groupId}` document with correct members array

- [ ] **Step 6: Commit**

```bash
git add map.html css/style.css js/ui.js js/app.js
git commit -m "feat: groups sidebar section and create group modal"
```

---

## Task 7: View mode banner + read-only markers

**Files:**
- Modify: `map.html`
- Modify: `js/ui.js`
- Modify: `js/markers.js`

**Interfaces:**
- Produces: `showViewBanner(title, onBack)` in `ui.js`
- Produces: `hideViewBanner()` in `ui.js`
- Produces: `renderReadOnlyMarkers(map, userData)` in `markers.js` — same as `renderAllMarkers` but no click handler

- [ ] **Step 1: Add view banner HTML to map.html**

Inside `<main class="map-area">`, as the first child (before `<div id="map">`):

```html
      <!-- View mode banner -->
      <div id="view-banner" class="view-banner" style="display:none">
        <button id="view-banner-back" class="view-banner-back">← Back</button>
        <span  id="view-banner-title" class="view-banner-title"></span>
      </div>
```

- [ ] **Step 2: Add showViewBanner / hideViewBanner to ui.js**

Append to `js/ui.js`:

```javascript
// ===== View Mode Banner =====

export function showViewBanner(title, onBack) {
  const banner = document.getElementById('view-banner');
  const titleEl = document.getElementById('view-banner-title');
  const backBtn = document.getElementById('view-banner-back');
  if (!banner) return;

  titleEl.textContent = title;
  // Replace old listener by cloning
  const newBack = backBtn.cloneNode(true);
  backBtn.parentNode.replaceChild(newBack, backBtn);
  newBack.addEventListener('click', onBack);
  banner.style.display = 'flex';
}

export function hideViewBanner() {
  const banner = document.getElementById('view-banner');
  if (banner) banner.style.display = 'none';
}
```

- [ ] **Step 3: Add renderReadOnlyMarkers to markers.js**

Add `renderReadOnlyMarkers` export and update `_createMarkerEl` to guard null `onRemove`:

```javascript
/**
 * Renders markers without click handlers (read-only view mode).
 */
export function renderReadOnlyMarkers(map, userData) {
  clearAllMarkers();
  (userData.visited_cities  ?? []).forEach(city => _addMarker(map, city, 'visited',  null));
  (userData.wishlist_cities ?? []).forEach(city => _addMarker(map, city, 'wishlist', null));
}
```

Update `_createMarkerEl` — replace the `el.addEventListener('click', ...)` block with:

```javascript
  if (onRemove) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onRemove(city, type, e.clientX, e.clientY);
    });
  }
```

- [ ] **Step 4: Verify in browser**

Add a temporary test call in `_init` after the map loads:
```javascript
showViewBanner("Test Friend's Map", () => hideViewBanner());
```
Confirm banner appears at top of map with "← Back" button. Clicking back hides it. Remove test call after verifying.

- [ ] **Step 5: Commit**

```bash
git add map.html js/ui.js js/markers.js
git commit -m "feat: view mode banner + read-only marker rendering"
```

---

## Task 8: Friend view mode in app.js

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `loadUserData(uid)` from `./db.js`
- Consumes: `renderReadOnlyMarkers(map, userData)` from `./markers.js`
- Consumes: `showViewBanner(title, onBack)`, `hideViewBanner()` from `./ui.js`

- [ ] **Step 1: Add view mode state + imports to app.js**

Add to the markers import line:

```javascript
import { renderAllMarkers, renderReadOnlyMarkers, clearAllMarkers } from './markers.js?v=12';
```

Add to the ui.js import line: `showViewBanner`, `hideViewBanner`.

Add a state variable near the top of the module (after `let _currentFilter = 'own'`):

```javascript
let _viewMode = 'own'; // 'own' | 'friend' | 'group'
```

- [ ] **Step 2: Implement _switchToFriendView and _returnToOwnView**

Replace the placeholder `_switchToFriendView` function with:

```javascript
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
```

- [ ] **Step 3: Verify in browser**

1. Have at least one friend added (from Task 3)
2. Click the friend's name in the sidebar
3. Confirm: map clears and shows friend's visited/wishlist markers
4. Confirm: view banner appears with "← Back  [Friend]'s Map"
5. Click "← Back" — own markers restored, banner gone, Add button reappears
6. Confirm read-only: clicking a marker on friend's map shows no remove popup

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: friend view mode - show friend's map read-only"
```

---

## Task 9: Group view mode — intersection + union logic

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `loadUserData(uid)` from `./db.js` (already imported)
- Consumes: `renderReadOnlyMarkers`, `showViewBanner`, `hideViewBanner` (already imported)

- [ ] **Step 1: Add _computeGroupData helper**

Add this function to `app.js` (alongside other private helpers):

```javascript
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
```

- [ ] **Step 2: Implement _switchToGroupView**

Replace the placeholder `_switchToGroupView` with:

```javascript
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
```

- [ ] **Step 3: Verify in browser**

1. Create a group with yourself + at least one friend (from Task 6)
2. Click the group name in the sidebar
3. Confirm banner shows group name
4. **Visited (intersection):** if both you and your friend have visited Munich, it appears. If only one of you has, it does NOT appear.
5. **Wishlist (union):** all wishlist cities from any member appear, no duplicates
6. Confirm no "lived" (amber) markers appear
7. Click "← Back" — own map restored

- [ ] **Step 4: Commit**

```bash
git add js/app.js
git commit -m "feat: group view mode with visited intersection + wishlist union"
```

---

## Task 10: Version bump + deploy

**Files:**
- Modify: `map.html` (CSS + JS version)
- Modify: `js/app.js` (all import ?v= strings)
- Modify: `js/ui.js` (if it imports from other modules)

**Goal:** Increment cache-bust suffix from `?v=12` to `?v=13` everywhere, then deploy.

- [ ] **Step 1: Update version in map.html**

In `map.html`, change:
```html
<link rel="stylesheet" href="css/style.css?v=12">
```
to:
```html
<link rel="stylesheet" href="css/style.css?v=13">
```

And:
```html
<script type="module" src="js/app.js?v=12"></script>
```
to:
```html
<script type="module" src="js/app.js?v=13"></script>
```

- [ ] **Step 2: Update all ?v=12 imports in app.js**

In `js/app.js`, replace ALL occurrences of `?v=12` with `?v=13`. Affected imports:

```javascript
import { onAuthChange, signOutUser }           from './auth.js?v=13';
import { loadUserData, initUserProfile,
         getUserByToken, addVisitedCountry,
         addVisitedCity, removeVisitedCity,
         addWishlistCity, removeWishlistCity }  from './db.js?v=13';
import { initMap }                              from './map.js?v=13';
import { renderAllMarkers, renderReadOnlyMarkers,
         clearAllMarkers }                      from './markers.js?v=13';
import { updateStats, setupCitySearch,
         showCityPopup, hideCityPopup, showToast,
         setupFriendsSidebar, renderFriendsList,
         setupGroupsSidebar, renderGroupsList,
         showViewBanner, hideViewBanner }        from './ui.js?v=13';
import { initTheme }                            from './theme.js?v=13';
import { loadFriends, addFriendship, isFriend } from './friends.js?v=13';
import { loadGroups, createGroup }              from './groups.js?v=13';
```

- [ ] **Step 3: Final smoke test**

1. Hard refresh the app (Cmd+Shift+R)
2. Sign in → confirm sidebar loads with Friends + Groups sections
3. Copy invite link → open in another browser → friend join flow works
4. Create a group → group appears in sidebar
5. Click friend → friend's map shown read-only
6. Click group → group map with intersection/union logic
7. Click ← Back from both → own map restored correctly

- [ ] **Step 4: Deploy**

```bash
firebase deploy --only hosting,firestore
```

Expected:
```
✔  firestore: released rules/indexes
✔  hosting[travelmap-f4e3a]: release complete
```

- [ ] **Step 5: Final commit**

```bash
git add map.html js/app.js
git commit -m "chore: bump cache version to v13 + deploy friends & groups feature"
git push
```

---

## Post-deploy checklist

- [ ] Firebase Console → Firestore → Rules: confirm new rules are active
- [ ] Firebase Console → Firestore → Indexes: confirm `invite_token` index is built (may take a few minutes)
- [ ] Test invite link on mobile: share link to a second device, confirm join flow works
- [ ] Test group map on mobile: verify read-only markers render correctly
