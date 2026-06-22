# Friends & Groups — Design Spec
**Date:** 2026-06-22  
**Project:** TravelMap  
**Status:** Approved

---

## Overview

Add a social layer to TravelMap: users can add friends via a personal invite link and create groups from their friends list. Friends and groups can be viewed in a separate map-view mode — no overlays, no color conflicts.

---

## Data Model

### Existing (unchanged)
```
users/{uid}
  visited_cities:    [{name, lat, lng, country, lived?}]
  wishlist_cities:   [{name, lat, lng, country}]
  visited_countries: [isoCode]
  wishlist_countries:[isoCode]
```

### New fields on users/{uid}
```
users/{uid}
  invite_token:  string   // permanent, user-regenerable
  display_name:  string   // copied from Google profile on first login
  avatar_url:    string   // copied from Google profile on first login
```

### New subcollection: friends
```
users/{uid}/friends/{friendUid}
  since:        timestamp
  display_name: string    // snapshot of friend's display_name at time of adding
  avatar_url:   string    // snapshot of friend's avatar_url
```
Friendship is bidirectional: when A adds B, both `users/A/friends/B` and `users/B/friends/A` are written.

### New top-level collection: groups
```
groups/{groupId}
  name:       string
  created_by: uid
  created_at: timestamp
  members:    [uid, uid, ...]   // max ~20, kept small
```

---

## Invite Token

- Generated once on first login (if not present): `crypto.randomUUID()` stored at `users/{uid}.invite_token`
- Permanent until user manually regenerates it (new UUID replaces old)
- Invite link format: `https://travelmap-f4e3a.web.app/map.html?token=<invite_token>`
- On load: if `?token` param present → run friend-join flow

---

## Friend Join Flow

1. User B opens `map.html?token=abc123`
2. If not signed in → Google sign-in first, then continue
3. Query Firestore: `users` where `invite_token == abc123` → get User A's uid  
   _(requires a Firestore single-field index on `invite_token` — added via Firebase Console or firestore.indexes.json)_
4. Guard: if already friends, show toast "Already friends!" and stop
5. Guard: if token is own token, show toast "That's your own link!" and stop
6. Write `users/A/friends/B` and `users/B/friends/A` in a Firestore batch
7. Toast: "You're now friends with [A's display_name]! 🎉"
8. Clean `?token` from URL (`history.replaceState`)
9. Sidebar refreshes to show new friend

---

## Group Management

### Create group
- User clicks **[+ Neu]** in Groups sidebar section
- Modal opens: text input for group name + checklist of existing friends
- At least 1 friend must be selected
- On confirm: write `groups/{newId}` with `members: [creatorUid, ...selectedFriendUids]`
- All members immediately see the group in their sidebar (real-time Firestore listener)

### Join group
- Groups are created by selecting from existing friends — no separate group invite link
- Only the group creator can currently add/remove members (keep it simple)

### Leave / delete group
- Any member can leave a group (removes their uid from `members` array)
- If creator leaves: group is deleted entirely
- Accessible via long-press or context menu on the group name in sidebar

---

## View Modes

### Normal mode (default)
Current behavior — own visited/wishlist/countries on the map.

### Friend view mode
Triggered by clicking a friend in the sidebar.
- Top banner: `← [Name]'s Map` (back button returns to normal mode)
- Shows friend's `visited_cities` (indigo markers) + `wishlist_cities` (emerald markers)
- No "Lived" markers shown
- Markers are read-only: click shows city name only, no remove option
- Sidebar stat numbers update to reflect friend's data
- Add New Location button hidden

### Group view mode
Triggered by clicking a group in the sidebar.
- Top banner: `← [Group Name]` (back button returns to normal mode)
- **Visited markers (indigo):** intersection — cities where ALL members have a matching entry in `visited_cities` (matched by exact `name` string, case-sensitive — safe since all names come from Mapbox geocoding)
- **Wishlist markers (emerald):** union — all cities from any member's `wishlist_cities`, deduplicated by `name`
- No "Lived" markers
- Read-only: click shows city name only
- Add New Location button hidden

---

## Firestore Security Rules (additions)

```javascript
// Allow reading another user's city data if requester is their friend
match /users/{uid} {
  allow read: if request.auth != null && (
    request.auth.uid == uid ||
    exists(/databases/$(database)/documents/users/$(request.auth.uid)/friends/$(uid))
  );

  match /friends/{friendUid} {
    allow read, write: if request.auth.uid == uid || request.auth.uid == friendUid;
  }
}

match /groups/{groupId} {
  allow read, write: if request.auth != null &&
    request.auth.uid in resource.data.members;
  allow create: if request.auth != null;
}
```

---

## New JS Modules

| File | Responsibility |
|---|---|
| `js/friends.js` | `generateInviteToken()`, `joinViaToken(token)`, `loadFriends()`, `removeFriend()` |
| `js/groups.js` | `createGroup(name, memberUids)`, `loadGroups()`, `leaveGroup(groupId)` |

### Changes to existing files

| File | Change |
|---|---|
| `js/app.js` | Detect `?token` on load, wire view-mode switching, init friends/groups listeners |
| `js/ui.js` | Add Friends + Groups sidebar sections, invite link button, view-mode banner, group create modal |
| `js/db.js` | Add `display_name`/`avatar_url` write on first login |
| `css/style.css` | Friends list, groups list, view-mode banner, group modal styles |
| `map.html` | New sidebar HTML sections, banner element, group modal |

---

## UI Components

### Sidebar additions
```
─── Friends ──────────── [🔗 Link]
  👤 Anna
  👤 Luca
─── Groups ──────────── [+ Neu]
  🌍 Balkan Trip
  🌍 Summer 2025
```

- **[🔗 Link]**: copies invite URL to clipboard, shows toast "Link copied!"
- **[+ Neu]**: opens group create modal
- Friend/Group rows: clickable, enter view mode on click

### View-mode banner
Appears at top of map area when in friend or group view:
```
[←]  Anna's Map
```
Back button restores normal mode.

### Group create modal
- Input: group name (required)
- Checklist: friends list with checkboxes
- Buttons: Cancel / Create

---

## Out of Scope (not in this spec)

- Group invite links (groups are populated by selecting existing friends)
- Notifications / push alerts for new friend requests
- Country-level comparison in group view (cities only)
- Removing members from a group (creator only for now, leave option for members)
- Friend profile page
