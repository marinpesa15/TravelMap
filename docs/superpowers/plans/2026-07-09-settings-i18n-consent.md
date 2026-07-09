# Settings-Modal, i18n (DE/EN) & Privacy-Consent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zahnrad-Button öffnet ein Settings-Modal (Theme, Sprache DE/EN, Privacy-Links, Sign-out, Version), die gesamte UI wird zweisprachig, und ein DSGVO-Consent-Banner blockiert die App bis zur Zustimmung; dazu eine `privacy.html` mit Datenschutzerklärung + Impressum.

**Architecture:** Vanilla-JS-ES-Module ohne Build-Step. Neues `js/i18n.js` (Übersetzungs-Objekt + `t()`-Funktion + `data-i18n`-Attribute), neues `js/settings.js` (Modal-Wiring), neues `js/consent.js` (Consent-Gate vor allen Firestore-Writes), `theme.js` wird von Button-Toggle auf `setTheme()`-API refactored. Spec: `docs/superpowers/specs/2026-07-09-settings-i18n-consent-design.md`.

**Tech Stack:** Vanilla JS (ES modules), Mapbox GL JS v3.4.0, Firebase Auth + Firestore (CDN v10.12.0), Firebase Hosting.

## Global Constraints

- Kein Build-Step, keine neuen Dependencies (nur Mapbox + Firebase via CDN).
- Alle user-kontrollierten Strings vor `innerHTML`-Interpolation durch `esc()` aus `ui.js` escapen.
- Deutsch duzt („du"), deutsche Anführungszeichen „…" in UI-Strings.
- Cache-Buster-Konvention: geänderte JS-Module bekommen am Ende (Task 7) neue `?v=`-Nummern; neue Module starten mit `?v=1`. Innerhalb einer Session müssen alle Importe desselben Moduls dieselbe `?v=`-Nummer tragen (sonst lädt das Modul doppelt).
- localStorage-Keys: `tm-theme` (bestehend), `tm-lang` (neu).
- Kein Test-Framework im Projekt — Verifikation per `node`-Einzeiler (reine Logik) und Browser (`firebase serve --only hosting`, http://localhost:5000).
- App-Version: `1.0.0` in `js/version.js` (einzige Pflegestelle).
- Consent-Version: `CONSENT_VERSION = 1` in `js/consent.js`.
- Arbeitsverzeichnis: `/Users/marin/Documents/Claude-Projects/TravelMap`.

---

### Task 1: `js/version.js` + `js/i18n.js` (Übersetzungen & Kern-API)

**Files:**
- Create: `js/version.js`
- Create: `js/i18n.js`

**Interfaces:**
- Produces: `APP_VERSION: string` (aus `version.js`)
- Produces (aus `i18n.js`):
  - `t(key: string, params?: Record<string,string|number>): string` — String in aktiver Sprache, `{name}`-Platzhalter werden ersetzt; unbekannter Key → Key selbst zurückgeben
  - `getLang(): 'en'|'de'` — aus `localStorage['tm-lang']`; fehlt der Key: `navigator.language` beginnt mit `'de'` → `'de'`, sonst `'en'`
  - `setLang(lang: 'en'|'de'): void` — speichert, ruft `applyTranslations()`, feuert `window`-Event `'tm-langchanged'`
  - `applyTranslations(): void` — übersetzt alle `[data-i18n]` (textContent), `[data-i18n-placeholder]` (placeholder), `[data-i18n-title]` (title); setzt `document.documentElement.lang`

- [ ] **Step 1: `js/version.js` anlegen**

```js
// Single source of truth for the app version, shown in the settings modal.
export const APP_VERSION = '1.0.0';
```

- [ ] **Step 2: `js/i18n.js` anlegen** (vollständig — alle Keys)

```js
// ===== Mini i18n =====
// t('key', {name: 'X'}) looks up the active language and interpolates
// {placeholders}. Static HTML is translated via data-i18n attributes,
// dynamic strings call t() directly.

const translations = {
  en: {
    // Sidebar
    'sidebar.view': 'View',
    'sidebar.collection': 'Collection',
    'sidebar.recentLogs': 'Recent Logs',
    'sidebar.friends': 'Friends',
    'sidebar.groups': 'Groups',
    'sidebar.invite': '+ Invite',
    'sidebar.inviteTitle': 'Copy invite link',
    'sidebar.newGroup': '+ New',
    'sidebar.newGroupTitle': 'Create group',
    'sidebar.addLocation': 'Add New Location',
    'stats.cities': 'Cities',
    'stats.countries': 'Countries',
    'nav.all': 'All',
    'nav.visited': 'Visited',
    'nav.wishlist': 'Want to visit',
    'nav.lived': 'Lived there',
    // Map legend + banner
    'legend.visited': 'Visited',
    'legend.lived': 'Lived',
    'legend.wishlist': 'Wishlist',
    'banner.back': '← Back',
    'banner.friendsMap': "{name}'s Map",
    // Search
    'search.cities': 'Search cities...',
    'search.countries': 'Search countries...',
    'search.searching': 'Searching…',
    'search.noResults': 'No results',
    'search.noCountries': 'No countries found',
    'search.error': 'Search error',
    // Dialog buttons / labels
    'dialog.type': 'Type',
    'dialog.visited': '✓ Visited',
    'dialog.wishlist': '⭐ Wishlist',
    'dialog.lived': '🏠 Lived there',
    'dialog.cancel': 'Cancel',
    'dialog.add': 'Add',
    'dialog.close': 'Close',
    'dialog.create': 'Create',
    'dialog.remove': 'Remove',
    'dialog.delete': 'Delete',
    'dialog.leave': 'Leave',
    'dialog.skip': 'Skip',
    'dialog.confirm': 'Confirm',
    'confirm.default': 'Are you sure?',
    'tooltip.remove': '🗑️ Remove',
    'popup.photo': '📷 Photo',
    // Group photo dialog
    'photo.title': 'Add photo for {city}',
    'photo.choose': 'Choose photo',
    'photo.use': 'Use this photo',
    // Groups
    'group.new': 'New Group',
    'group.manage': 'Manage "{name}"',
    'group.members': 'Members',
    'group.addFriends': 'Add friends',
    'group.selectFriends': 'Select friends to add',
    'group.namePlaceholder': 'Group name…',
    'group.creator': 'Group creator',
    'group.manageMembers': 'Manage members',
    'group.deleteTitle': 'Delete group',
    'group.leaveTitle': 'Leave group',
    'group.removeFromGroup': 'Remove from group',
    'group.you': 'You',
    'group.member': 'Member',
    'friend.fallback': 'Friend',
    'friend.removeTitle': 'Remove friend',
    // Mobile
    'mobile.addCityToGroup': 'Add city to group',
    'mobile.close': '✕ Close',
    // Empty states
    'empty.noCities': 'No cities logged yet.',
    'empty.noCountries': 'No countries tracked yet.',
    'empty.noFriends': 'No friends yet. Share your invite link!',
    'empty.noGroups': 'No groups yet.',
    'empty.addFriendsFirst': 'Add friends first to create a group.',
    'empty.allInGroup': 'All your friends are already in this group.',
    'recent.visited': 'Visited',
    'recent.wishlist': 'Wishlist',
    // Toasts
    'toast.errorLoading': 'Error loading. Please reload.',
    'toast.inviteNotFound': 'Invite link not found.',
    'toast.ownInvite': "That's your own invite link!",
    'toast.alreadyFriends': 'Already friends with {name}!',
    'toast.nowFriends': "You're now friends with {name}! 🎉",
    'toast.inviteError': 'Could not process invite link.',
    'toast.addedToGroup': '{name} added to group ✓',
    'toast.addToGroupFailed': 'Failed to add location to group.',
    'toast.added': '{name} added ✓',
    'toast.addFailed': 'Failed to add location',
    'toast.photoUpdated': 'Photo updated ✓',
    'toast.photoFailed': 'Failed to update photo.',
    'toast.removed': '{name} removed',
    'toast.removeFailed': 'Failed to remove location',
    'toast.friendMapFailed': "Could not load friend's map.",
    'toast.friendRemoved': 'Friend removed.',
    'toast.friendRemoveFailed': 'Failed to remove friend.',
    'toast.groupCreated': 'Group "{name}" created! 🌍',
    'toast.groupCreateFailed': 'Failed to create group.',
    'toast.leaveGroupFailed': 'Failed to leave group.',
    'toast.memberRemoved': 'Member removed from group.',
    'toast.memberRemoveFailed': 'Could not remove member.',
    'toast.onePersonAdded': '1 person added to group ✓',
    'toast.peopleAdded': '{count} people added to group ✓',
    'toast.addMembersFailed': 'Failed to add members.',
    'toast.countryVisited': '{name} — visited ✓',
    'toast.countryWishlist': '{name} — added to wishlist ⭐',
    'toast.countryFailed': 'Failed to update country.',
    'toast.inviteCopied': 'Invite link copied! 🔗',
    'toast.copyFailed': 'Could not copy link.',
    'toast.selectPerson': 'Select at least one person.',
    'toast.enterGroupName': 'Please enter a group name.',
    'toast.imageFailed': 'Could not load image.',
    'toast.consentFailed': 'Could not save your consent. Please try again.',
    // Confirm messages
    'confirm.removeFriend': 'Remove {name} from your friends?',
    'confirm.removeMember': 'Remove {name} from "{group}"?',
    'confirm.deleteGroup': 'Delete group "{name}"? This cannot be undone.',
    'confirm.leaveGroup': 'Leave group "{name}"?',
    // Settings
    'settings.title': 'Settings',
    'settings.gearTitle': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.language': 'Language',
    'settings.privacy': 'Privacy Policy',
    'settings.imprint': 'Legal Notice',
    'settings.signout': 'Sign out',
    // Consent banner
    'consent.title': 'Before you start',
    'consent.body': 'TravelMap stores your Google profile (name, email address, profile picture) and the travel data you add — cities, countries, friends and groups — with Google Firebase so the app can work. Details:',
    'consent.privacyLink': 'Privacy Policy',
    'consent.accept': 'Agree and continue',
    'consent.decline': 'Decline',
    // Login page
    'auth.tagline': 'Track your travels on the world map',
    'auth.signin': 'Sign in with Google',
    'auth.error': 'Sign in failed. Please try again.',
    'auth.privacyNotice': 'By signing in you accept our',
    'auth.privacyLink': 'Privacy Policy'
  },
  de: {
    // Sidebar
    'sidebar.view': 'Ansicht',
    'sidebar.collection': 'Sammlung',
    'sidebar.recentLogs': 'Zuletzt hinzugefügt',
    'sidebar.friends': 'Freunde',
    'sidebar.groups': 'Gruppen',
    'sidebar.invite': '+ Einladen',
    'sidebar.inviteTitle': 'Einladungslink kopieren',
    'sidebar.newGroup': '+ Neu',
    'sidebar.newGroupTitle': 'Gruppe erstellen',
    'sidebar.addLocation': 'Neuen Ort hinzufügen',
    'stats.cities': 'Städte',
    'stats.countries': 'Länder',
    'nav.all': 'Alle',
    'nav.visited': 'Besucht',
    'nav.wishlist': 'Möchte ich besuchen',
    'nav.lived': 'Dort gelebt',
    // Map legend + banner
    'legend.visited': 'Besucht',
    'legend.lived': 'Gelebt',
    'legend.wishlist': 'Wunschliste',
    'banner.back': '← Zurück',
    'banner.friendsMap': 'Karte von {name}',
    // Search
    'search.cities': 'Städte suchen...',
    'search.countries': 'Länder suchen...',
    'search.searching': 'Suche…',
    'search.noResults': 'Keine Ergebnisse',
    'search.noCountries': 'Keine Länder gefunden',
    'search.error': 'Fehler bei der Suche',
    // Dialog buttons / labels
    'dialog.type': 'Typ',
    'dialog.visited': '✓ Besucht',
    'dialog.wishlist': '⭐ Wunschliste',
    'dialog.lived': '🏠 Dort gelebt',
    'dialog.cancel': 'Abbrechen',
    'dialog.add': 'Hinzufügen',
    'dialog.close': 'Schließen',
    'dialog.create': 'Erstellen',
    'dialog.remove': 'Entfernen',
    'dialog.delete': 'Löschen',
    'dialog.leave': 'Verlassen',
    'dialog.skip': 'Überspringen',
    'dialog.confirm': 'Bestätigen',
    'confirm.default': 'Bist du sicher?',
    'tooltip.remove': '🗑️ Entfernen',
    'popup.photo': '📷 Foto',
    // Group photo dialog
    'photo.title': 'Foto für {city} hinzufügen',
    'photo.choose': 'Foto auswählen',
    'photo.use': 'Dieses Foto verwenden',
    // Groups
    'group.new': 'Neue Gruppe',
    'group.manage': '„{name}" verwalten',
    'group.members': 'Mitglieder',
    'group.addFriends': 'Freunde hinzufügen',
    'group.selectFriends': 'Freunde zum Hinzufügen auswählen',
    'group.namePlaceholder': 'Gruppenname…',
    'group.creator': 'Gruppen-Ersteller',
    'group.manageMembers': 'Mitglieder verwalten',
    'group.deleteTitle': 'Gruppe löschen',
    'group.leaveTitle': 'Gruppe verlassen',
    'group.removeFromGroup': 'Aus der Gruppe entfernen',
    'group.you': 'Du',
    'group.member': 'Mitglied',
    'friend.fallback': 'Freund',
    'friend.removeTitle': 'Freund entfernen',
    // Mobile
    'mobile.addCityToGroup': 'Stadt zur Gruppe hinzufügen',
    'mobile.close': '✕ Schließen',
    // Empty states
    'empty.noCities': 'Noch keine Städte eingetragen.',
    'empty.noCountries': 'Noch keine Länder eingetragen.',
    'empty.noFriends': 'Noch keine Freunde. Teile deinen Einladungslink!',
    'empty.noGroups': 'Noch keine Gruppen.',
    'empty.addFriendsFirst': 'Füge zuerst Freunde hinzu, um eine Gruppe zu erstellen.',
    'empty.allInGroup': 'Alle deine Freunde sind schon in dieser Gruppe.',
    'recent.visited': 'Besucht',
    'recent.wishlist': 'Wunschliste',
    // Toasts
    'toast.errorLoading': 'Fehler beim Laden. Bitte neu laden.',
    'toast.inviteNotFound': 'Einladungslink nicht gefunden.',
    'toast.ownInvite': 'Das ist dein eigener Einladungslink!',
    'toast.alreadyFriends': 'Du bist schon mit {name} befreundet!',
    'toast.nowFriends': 'Du bist jetzt mit {name} befreundet! 🎉',
    'toast.inviteError': 'Einladungslink konnte nicht verarbeitet werden.',
    'toast.addedToGroup': '{name} zur Gruppe hinzugefügt ✓',
    'toast.addToGroupFailed': 'Ort konnte nicht zur Gruppe hinzugefügt werden.',
    'toast.added': '{name} hinzugefügt ✓',
    'toast.addFailed': 'Ort konnte nicht hinzugefügt werden',
    'toast.photoUpdated': 'Foto aktualisiert ✓',
    'toast.photoFailed': 'Foto konnte nicht aktualisiert werden.',
    'toast.removed': '{name} entfernt',
    'toast.removeFailed': 'Ort konnte nicht entfernt werden',
    'toast.friendMapFailed': 'Karte konnte nicht geladen werden.',
    'toast.friendRemoved': 'Freund entfernt.',
    'toast.friendRemoveFailed': 'Freund konnte nicht entfernt werden.',
    'toast.groupCreated': 'Gruppe „{name}" erstellt! 🌍',
    'toast.groupCreateFailed': 'Gruppe konnte nicht erstellt werden.',
    'toast.leaveGroupFailed': 'Gruppe konnte nicht verlassen werden.',
    'toast.memberRemoved': 'Mitglied aus der Gruppe entfernt.',
    'toast.memberRemoveFailed': 'Mitglied konnte nicht entfernt werden.',
    'toast.onePersonAdded': '1 Person zur Gruppe hinzugefügt ✓',
    'toast.peopleAdded': '{count} Personen zur Gruppe hinzugefügt ✓',
    'toast.addMembersFailed': 'Mitglieder konnten nicht hinzugefügt werden.',
    'toast.countryVisited': '{name} — besucht ✓',
    'toast.countryWishlist': '{name} — zur Wunschliste hinzugefügt ⭐',
    'toast.countryFailed': 'Land konnte nicht aktualisiert werden.',
    'toast.inviteCopied': 'Einladungslink kopiert! 🔗',
    'toast.copyFailed': 'Link konnte nicht kopiert werden.',
    'toast.selectPerson': 'Wähle mindestens eine Person aus.',
    'toast.enterGroupName': 'Bitte gib einen Gruppennamen ein.',
    'toast.imageFailed': 'Bild konnte nicht geladen werden.',
    'toast.consentFailed': 'Zustimmung konnte nicht gespeichert werden. Bitte erneut versuchen.',
    // Confirm messages
    'confirm.removeFriend': '{name} aus deinen Freunden entfernen?',
    'confirm.removeMember': '{name} aus „{group}" entfernen?',
    'confirm.deleteGroup': 'Gruppe „{name}" löschen? Das kann nicht rückgängig gemacht werden.',
    'confirm.leaveGroup': 'Gruppe „{name}" verlassen?',
    // Settings
    'settings.title': 'Einstellungen',
    'settings.gearTitle': 'Einstellungen',
    'settings.appearance': 'Darstellung',
    'settings.light': 'Hell',
    'settings.dark': 'Dunkel',
    'settings.language': 'Sprache',
    'settings.privacy': 'Datenschutzerklärung',
    'settings.imprint': 'Impressum',
    'settings.signout': 'Abmelden',
    // Consent banner
    'consent.title': 'Bevor es losgeht',
    'consent.body': 'TravelMap speichert dein Google-Profil (Name, E-Mail-Adresse, Profilbild) und die Reisedaten, die du einträgst — Städte, Länder, Freunde und Gruppen — bei Google Firebase, damit die App funktioniert. Details:',
    'consent.privacyLink': 'Datenschutzerklärung',
    'consent.accept': 'Zustimmen und weiter',
    'consent.decline': 'Ablehnen',
    // Login page
    'auth.tagline': 'Verfolge deine Reisen auf der Weltkarte',
    'auth.signin': 'Mit Google anmelden',
    'auth.error': 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
    'auth.privacyNotice': 'Mit der Anmeldung akzeptierst du unsere',
    'auth.privacyLink': 'Datenschutzerklärung'
  }
};

export function getLang() {
  const saved = localStorage.getItem('tm-lang');
  if (saved === 'en' || saved === 'de') return saved;
  return (navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function setLang(lang) {
  if (lang !== 'en' && lang !== 'de') return;
  localStorage.setItem('tm-lang', lang);
  applyTranslations();
  window.dispatchEvent(new CustomEvent('tm-langchanged', { detail: { lang } }));
}

/** Looks up key in the active language (fallback: en, then the key itself)
 *  and replaces {placeholders} with params values. */
export function t(key, params = {}) {
  const lang = getLang();
  let str = translations[lang]?.[key] ?? translations.en[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    str = str.replaceAll(`{${k}}`, String(v));
  }
  return str;
}

/** Translates all elements carrying data-i18n / data-i18n-placeholder /
 *  data-i18n-title and sets <html lang>. */
export function applyTranslations() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}
```

- [ ] **Step 3: Logik per Node verifizieren**

Run (im Projektverzeichnis):
```bash
node --input-type=module -e "
globalThis.localStorage = { getItem: () => 'de', setItem: () => {} };
globalThis.navigator = { language: 'de-DE' };
const { t, getLang } = await import('./js/i18n.js');
console.log(getLang());
console.log(t('toast.added', { name: 'Berlin' }));
console.log(t('nav.all'));
console.log(t('does.not.exist'));
"
```
Expected Output:
```
de
Berlin hinzugefügt ✓
Alle
does.not.exist
```

- [ ] **Step 4: Commit**

```bash
git add js/version.js js/i18n.js
git commit -m "feat: i18n core module (EN/DE) and app version constant"
```

---

### Task 2: Statische HTML-Texte übersetzen (`map.html`, `index.html`)

**Files:**
- Modify: `map.html` (data-i18n-Attribute)
- Modify: `index.html` (data-i18n + Privacy-Hinweis-Platz, i18n-Import)
- Modify: `js/app.js` (i18n-Import + `applyTranslations()` beim Start)

**Interfaces:**
- Consumes: `t`, `applyTranslations`, `getLang` aus `js/i18n.js` (Task 1)
- Produces: alle statischen UI-Elemente tragen `data-i18n`-Keys (von Task 3/4 vorausgesetzt)

- [ ] **Step 1: `map.html` — data-i18n-Attribute ergänzen**

Jede Änderung ist ein exaktes Vorher→Nachher (Reihenfolge wie im File):

```html
<!-- Zeile 35 -->
<p class="section-label">View</p>
→ <p class="section-label" data-i18n="sidebar.view">View</p>

<!-- Zeile 38 -->
<p class="stat-label">Cities</p>
→ <p class="stat-label" data-i18n="stats.cities">Cities</p>

<!-- Zeile 42 -->
<p class="stat-label">Countries</p>
→ <p class="stat-label" data-i18n="stats.countries">Countries</p>

<!-- Zeile 50 -->
<p class="section-label">Collection</p>
→ <p class="section-label" data-i18n="sidebar.collection">Collection</p>

<!-- Zeile 58 -->
<span class="nav-label">All</span>
→ <span class="nav-label" data-i18n="nav.all">All</span>

<!-- Zeile 65 -->
<span class="nav-label">Visited</span>
→ <span class="nav-label" data-i18n="nav.visited">Visited</span>

<!-- Zeile 72 -->
<span class="nav-label">Want to visit</span>
→ <span class="nav-label" data-i18n="nav.wishlist">Want to visit</span>

<!-- Zeile 79 -->
<span class="nav-label">Lived there</span>
→ <span class="nav-label" data-i18n="nav.lived">Lived there</span>

<!-- Zeile 87 -->
<p class="section-label">Recent Logs</p>
→ <p class="section-label" data-i18n="sidebar.recentLogs">Recent Logs</p>

<!-- Zeile 94 -->
<p class="section-label">Friends</p>
→ <p class="section-label" data-i18n="sidebar.friends">Friends</p>

<!-- Zeile 95 -->
<button class="btn-section-action" id="btn-copy-invite" title="Copy invite link">+ Invite</button>
→ <button class="btn-section-action" id="btn-copy-invite" data-i18n="sidebar.invite" data-i18n-title="sidebar.inviteTitle" title="Copy invite link">+ Invite</button>

<!-- Zeile 103 -->
<p class="section-label">Groups</p>
→ <p class="section-label" data-i18n="sidebar.groups">Groups</p>

<!-- Zeile 104 -->
<button class="btn-section-action" id="btn-create-group" title="Create group">+ New</button>
→ <button class="btn-section-action" id="btn-create-group" data-i18n="sidebar.newGroup" data-i18n-title="sidebar.newGroupTitle" title="Create group">+ New</button>

<!-- Zeile 114-119: Button-Text in Span wickeln (SVG bleibt) -->
          Add New Location
        </button>
→         <span data-i18n="sidebar.addLocation">Add New Location</span>
        </button>

<!-- Zeile 129 -->
<button id="view-banner-back" class="view-banner-back">← Back</button>
→ <button id="view-banner-back" class="view-banner-back" data-i18n="banner.back">← Back</button>

<!-- Zeile 153 -->
<input type="text" id="city-search" placeholder="Search cities..." autocomplete="off">
→ <input type="text" id="city-search" placeholder="Search cities..." data-i18n-placeholder="search.cities" autocomplete="off">

<!-- Zeilen 164-166 (Legende Cities) -->
<div class="legend-item"><span class="legend-dot indigo"></span><span>Visited</span></div>
<div class="legend-item"><span class="legend-dot amber"></span><span>Lived</span></div>
<div class="legend-item"><span class="legend-dot emerald"></span><span>Wishlist</span></div>
→
<div class="legend-item"><span class="legend-dot indigo"></span><span data-i18n="legend.visited">Visited</span></div>
<div class="legend-item"><span class="legend-dot amber"></span><span data-i18n="legend.lived">Lived</span></div>
<div class="legend-item"><span class="legend-dot emerald"></span><span data-i18n="legend.wishlist">Wishlist</span></div>

<!-- Zeilen 169-170 (Legende Countries): analog data-i18n="legend.visited" / "legend.wishlist" an die inneren <span>s ohne style-Attribut -->

<!-- Zeile 185 (City Dialog) -->
<div class="dialog-label">Type</div>
→ <div class="dialog-label" data-i18n="dialog.type">Type</div>

<!-- Zeilen 187-188 -->
<div class="radio-opt selected" data-type="visited">✓ Visited</div>
<div class="radio-opt"          data-type="wishlist">⭐ Wishlist</div>
→
<div class="radio-opt selected" data-type="visited" data-i18n="dialog.visited">✓ Visited</div>
<div class="radio-opt"          data-type="wishlist" data-i18n="dialog.wishlist">⭐ Wishlist</div>

<!-- Zeilen 190-193: Checkbox-Label — Text in Span wickeln -->
<label class="checkbox-row" id="lived-row">
  <input type="checkbox" id="lived-checkbox">
  🏠 Lived there
</label>
→
<label class="checkbox-row" id="lived-row">
  <input type="checkbox" id="lived-checkbox">
  <span data-i18n="dialog.lived">🏠 Lived there</span>
</label>

<!-- Zeilen 195-196 -->
<button class="btn-cancel" id="dialog-cancel">Cancel</button>
<button class="btn-add"    id="dialog-add">Add</button>
→
<button class="btn-cancel" id="dialog-cancel" data-i18n="dialog.cancel">Cancel</button>
<button class="btn-add"    id="dialog-add" data-i18n="dialog.add">Add</button>

<!-- Zeilen 205-207 (Country Tooltip) -->
<button class="tooltip-btn visited"  id="country-tooltip-visited">✓ Visited</button>
<button class="tooltip-btn wishlist" id="country-tooltip-wishlist">⭐ Wishlist</button>
<button class="tooltip-btn remove"   id="country-tooltip-remove" style="display:none">🗑️ Remove</button>
→
<button class="tooltip-btn visited"  id="country-tooltip-visited" data-i18n="dialog.visited">✓ Visited</button>
<button class="tooltip-btn wishlist" id="country-tooltip-wishlist" data-i18n="dialog.wishlist">⭐ Wishlist</button>
<button class="tooltip-btn remove"   id="country-tooltip-remove" data-i18n="tooltip.remove" style="display:none">🗑️ Remove</button>

<!-- Zeile 214 (City Popup) -->
<button class="btn-remove-city" id="btn-remove-city">🗑️ Remove</button>
→ <button class="btn-remove-city" id="btn-remove-city" data-i18n="tooltip.remove">🗑️ Remove</button>

<!-- Zeile 220 (Group Photo Dialog): Titel wird künftig komplett per JS gesetzt -->
<h3 id="group-photo-title">Add photo for <span id="group-photo-city"></span></h3>
→ <h3 id="group-photo-title">Add photo</h3>

<!-- Zeilen 224-227: Upload-Label — Text in Span wickeln (SVG bleibt) -->
        Choose photo
      </label>
→       <span data-i18n="photo.choose">Choose photo</span>
      </label>

<!-- Zeilen 230-231 -->
<button class="btn-cancel" id="group-photo-skip">Skip</button>
<button class="btn-add"    id="group-photo-confirm">Use this photo</button>
→
<button class="btn-cancel" id="group-photo-skip" data-i18n="dialog.skip">Skip</button>
<button class="btn-add"    id="group-photo-confirm" data-i18n="photo.use">Use this photo</button>

<!-- Zeile 242 (Confirm Dialog) -->
<p id="confirm-message">Are you sure?</p>
→ <p id="confirm-message" data-i18n="confirm.default">Are you sure?</p>

<!-- Zeilen 244-245 -->
<button class="btn-cancel" id="confirm-cancel">Cancel</button>
<button class="btn-danger" id="confirm-ok">Remove</button>
→
<button class="btn-cancel" id="confirm-cancel" data-i18n="dialog.cancel">Cancel</button>
<button class="btn-danger" id="confirm-ok" data-i18n="dialog.remove">Remove</button>

<!-- Zeile 253 (Group Modal) -->
<h3 id="group-modal-title">New Group</h3>
→ <h3 id="group-modal-title" data-i18n="group.new">New Group</h3>

<!-- Zeile 255 -->
<input type="text" id="group-name-input" placeholder="Group name…" maxlength="40" autocomplete="off">
→ <input type="text" id="group-name-input" placeholder="Group name…" data-i18n-placeholder="group.namePlaceholder" maxlength="40" autocomplete="off">

<!-- Zeile 258 -->
<p class="dialog-label" style="margin-top:14px">Members</p>
→ <p class="dialog-label" style="margin-top:14px" data-i18n="group.members">Members</p>

<!-- Zeile 261 -->
<p class="dialog-label" style="margin-top:14px" id="group-friends-label">Add friends</p>
→ <p class="dialog-label" style="margin-top:14px" id="group-friends-label" data-i18n="group.addFriends">Add friends</p>

<!-- Zeilen 264-265 -->
<button class="btn-cancel" id="group-modal-cancel">Cancel</button>
<button class="btn-add"    id="group-modal-create">Create</button>
→
<button class="btn-cancel" id="group-modal-cancel" data-i18n="dialog.cancel">Cancel</button>
<button class="btn-add"    id="group-modal-create" data-i18n="dialog.create">Create</button>

<!-- Zeilen 273-274 (Mobile Search Overlay) -->
<span class="mobile-search-title">Add city to group</span>
<button id="btn-close-search" class="btn-close-search">✕ Close</button>
→
<span class="mobile-search-title" data-i18n="mobile.addCityToGroup">Add city to group</span>
<button id="btn-close-search" class="btn-close-search" data-i18n="mobile.close">✕ Close</button>
```

Hinweis: `js/ui.js` referenziert `group-photo-city` (Zeile 706: `const cityEl = document.getElementById('group-photo-city');` und Zeile 709: `cityEl.textContent = cityName;`). Damit der Dialog bis Task 3 funktionsfähig bleibt, in diesem Schritt in `ui.js` diese zwei Zeilen ändern:

```js
// Zeile 706 alt:
  const cityEl  = document.getElementById('group-photo-city');
// neu (Variable entfernen):
  const titleEl = document.getElementById('group-photo-title');

// Zeile 709 alt:
  cityEl.textContent  = cityName;
// neu (vorerst englisch, Task 3 stellt auf t() um):
  titleEl.textContent = `Add photo for ${cityName}`;
```

- [ ] **Step 2: `js/app.js` — i18n importieren und beim Start anwenden**

Nach Zeile 27 (`import { initTheme } ...`) ergänzen:
```js
import { t, getLang, applyTranslations } from './i18n.js?v=1';
```

Direkt nach den Modul-Level-Variablen (nach Zeile 47, vor `// ===== Auth Guard =====`) einfügen:
```js
// Translate static HTML as early as possible (before auth resolves)
applyTranslations();
```

- [ ] **Step 3: `index.html` — Texte übersetzen**

```html
<!-- Zeile 14 alt -->
<p>Track your travels on the world map</p>
→ <p data-i18n="auth.tagline">Track your travels on the world map</p>

<!-- Zeile 22 alt (Button-Text in Span wickeln, SVG bleibt) -->
        Sign in with Google
      </button>
→       <span data-i18n="auth.signin">Sign in with Google</span>
      </button>
```

Im Inline-Script (Zeile 28ff.): Import ergänzen und Error-String ersetzen:
```js
import { signInWithGoogle, onAuthChange } from './js/auth.js';
import { t, applyTranslations } from './js/i18n.js?v=1';

applyTranslations();
```
und Zeile 45 alt:
```js
document.getElementById('auth-error').textContent = 'Sign in failed. Please try again.';
```
neu:
```js
document.getElementById('auth-error').textContent = t('auth.error');
```

- [ ] **Step 4: Browser-Verifikation**

Run: `firebase serve --only hosting` → http://localhost:5000 öffnen.
Expected:
- Login-Seite: mit Browser auf Deutsch (oder `localStorage.setItem('tm-lang','de')` in der Konsole + Reload) erscheinen Tagline/Button auf Deutsch.
- Nach Login `map.html`: Sidebar-Labels, Nav, Legende, Dialoge (per Konsole `document.getElementById('city-dialog').classList.add('open')` sichtbar machen) auf Deutsch; mit `tm-lang = 'en'` + Reload alles auf Englisch.

- [ ] **Step 5: Commit**

```bash
git add map.html index.html js/app.js js/ui.js
git commit -m "feat: translate static HTML via data-i18n attributes"
```

---

### Task 3: Dynamische Strings auf `t()` umstellen (`ui.js`, `app.js`) + Live-Sprachwechsel

**Files:**
- Modify: `js/ui.js`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `t`, `getLang`, `applyTranslations` aus `js/i18n.js`
- Produces: `window`-Event `'tm-langchanged'` führt zu vollständigem UI-Re-Render (Task 4 verlässt sich darauf, dass `setLang()` genügt)

- [ ] **Step 1: `js/ui.js` — Import + alle String-Ersetzungen**

Import oben ergänzen:
```js
import { t, getLang } from './i18n.js?v=1';
```

Ersetzungstabelle (exakt; Zeilennummern beziehen sich auf den aktuellen Stand):

| Zeile | Alt | Neu |
|---|---|---|
| 54 | `'<p class="recent-log-meta" style="color:#374151">No cities logged yet.</p>'` | `` `<p class="recent-log-meta" style="color:#374151">${t('empty.noCities')}</p>` `` |
| 142 | `'<div class="search-result-item">Searching…</div>'` | `` `<div class="search-result-item">${t('search.searching')}</div>` `` |
| 146 | `'<div class="search-result-item">No countries found</div>'` | `` `<div class="search-result-item">${t('search.noCountries')}</div>` `` |
| 156 | `✓ Visited` (im Template) | `${t('dialog.visited')}` |
| 157 | `⭐ Wishlist` (im Template) | `${t('dialog.wishlist')}` |
| 175 | `'<div class="search-result-item">Search error</div>'` | `` `<div class="search-result-item">${t('search.error')}</div>` `` |
| 184 | `'<div class="search-result-item">Searching…</div>'` | `` `<div class="search-result-item">${t('search.searching')}</div>` `` |
| 191 | `'<div class="search-result-item">No results</div>'` | `` `<div class="search-result-item">${t('search.noResults')}</div>` `` |
| 215 | `'<div class="search-result-item">Search error</div>'` | `` `<div class="search-result-item">${t('search.error')}</div>` `` |
| 251 | `actionLabel \|\| 'Confirm'` | `actionLabel \|\| t('dialog.confirm')` |
| 282 | `'Invite link copied! 🔗'` | `t('toast.inviteCopied')` |
| 284 | `'Could not copy link.'` | `t('toast.copyFailed')` |
| 296 | `'<p class="social-empty">No friends yet. Share your invite link!</p>'` | `` `<p class="social-empty">${t('empty.noFriends')}</p>` `` |
| 313 | `\|\| 'Friend'` | `\|\| t('friend.fallback')` |
| 314 | `title="Remove friend"` | `title="${t('friend.removeTitle')}"` |
| 322 | `friend.display_name \|\| 'this friend'` | `friend.display_name \|\| t('friend.fallback')` |
| 323 | `` showConfirm(`Remove ${name} from your friends?`, 'Remove', ...) `` | `showConfirm(t('confirm.removeFriend', { name }), t('dialog.remove'), ...)` |
| 363 | `'Select at least one person.'` | `t('toast.selectPerson')` |
| 368 | `'Please enter a group name.'` | `t('toast.enterGroupName')` |
| 393 | `titleEl.textContent = 'New Group';` | `titleEl.textContent = t('group.new');` |
| 398 | `friendLabel.textContent = 'Add friends';` | `friendLabel.textContent = t('group.addFriends');` |
| 399 | `createBtn.textContent = 'Create';` | `createBtn.textContent = t('dialog.create');` |
| 400 | `cancelBtn.textContent = 'Cancel';` | `cancelBtn.textContent = t('dialog.cancel');` |
| 404 | `'<p class="social-empty">Add friends first to create a group.</p>'` | `` `<p class="social-empty">${t('empty.addFriendsFirst')}</p>` `` |
| 409 | `\|\| 'Friend'` | `\|\| t('friend.fallback')` |
| 415 | `` titleEl.textContent = `Manage "${group.name}"`; `` | `titleEl.textContent = t('group.manage', { name: group.name });` |
| 418 | `friendLabel.textContent = 'Select friends to add';` | `friendLabel.textContent = t('group.selectFriends');` |
| 419 | `createBtn.textContent = 'Add';` | `createBtn.textContent = t('dialog.add');` |
| 420 | `cancelBtn.textContent = 'Close';` | `cancelBtn.textContent = t('dialog.close');` |
| 426 | `'<p class="social-empty">All your friends are already in this group.</p>'` | `` `<p class="social-empty">${t('empty.allInGroup')}</p>` `` |
| 431 | `\|\| 'Friend'` | `\|\| t('friend.fallback')` |
| 456-457 | `uid === _groupModalUid ? 'You' : (friend?.display_name \|\| 'Member')` | `uid === _groupModalUid ? t('group.you') : (friend?.display_name \|\| t('group.member'))` |
| 464 | `title="Group creator"` | `title="${t('group.creator')}"` |
| 473 | `title="Remove from group"` | `title="${t('group.removeFromGroup')}"` |
| 477 | `` showConfirm(`Remove ${name} from "${group.name}"?`, 'Remove', ...) `` | `showConfirm(t('confirm.removeMember', { name, group: group.name }), t('dialog.remove'), ...)` |
| 502 | `'<p class="social-empty">No groups yet.</p>'` | `` `<p class="social-empty">${t('empty.noGroups')}</p>` `` |
| 514 | `isCreator ? 'Delete group' : 'Leave group'` | `isCreator ? t('group.deleteTitle') : t('group.leaveTitle')` |
| 520 | `title="Manage members"` | `title="${t('group.manageMembers')}"` |
| 539-541 | `` isCreator ? `Delete group "${group.name}"? This cannot be undone.` : `Leave group "${group.name}"?` `` | `isCreator ? t('confirm.deleteGroup', { name: group.name }) : t('confirm.leaveGroup', { name: group.name })` |
| 542 | `isCreator ? 'Delete' : 'Leave'` | `isCreator ? t('dialog.delete') : t('dialog.leave')` |
| 620 | `'<p class="recent-log-meta" style="color:#374151">No countries tracked yet.</p>'` | `` `<p class="recent-log-meta" style="color:#374151">${t('empty.noCountries')}</p>` `` |
| 625 | `new Intl.DisplayNames(['en'], { type: 'region' })` | `new Intl.DisplayNames([getLang()], { type: 'region' })` |
| 636 | `${type === 'visited' ? 'Visited' : 'Wishlist'}` | `${type === 'visited' ? t('recent.visited') : t('recent.wishlist')}` |
| 709 | `` titleEl.textContent = `Add photo for ${cityName}`; `` (aus Task 2) | `titleEl.textContent = t('photo.title', { city: cityName });` |
| 723 | `'Could not load image.'` | `t('toast.imageFailed')` |
| 778 | `photoBtn.textContent = '📷 Photo';` | `photoBtn.textContent = t('popup.photo');` |

Achtung XSS: In den `showConfirm(...)`-Aufrufen werden `name`/`group.name` per `textContent` gesetzt (`confirm-message`) — kein Escaping nötig. In `title="${...}"`-Interpolationen stehen nur `t()`-Ergebnisse (eigene Strings), kein User-Input.

- [ ] **Step 2: `js/app.js` — alle String-Ersetzungen**

| Zeile | Alt | Neu |
|---|---|---|
| 160 | `'Error loading. Please reload.'` | `t('toast.errorLoading')` |
| 193 | `'Invite link not found.'` | `t('toast.inviteNotFound')` |
| 194 | `"That's your own invite link!"` | `t('toast.ownInvite')` |
| 199 | `` `Already friends with ${them.display_name \|\| 'this user'}!` `` | `t('toast.alreadyFriends', { name: them.display_name \|\| t('friend.fallback') })` |
| 205 | `` `You're now friends with ${them.display_name \|\| 'your friend'}! 🎉` `` | `t('toast.nowFriends', { name: them.display_name \|\| t('friend.fallback') })` |
| 209 | `'Could not process invite link.'` | `t('toast.inviteError')` |
| 228, 241 | `` `${cityData.name} added to group ✓` `` | `t('toast.addedToGroup', { name: cityData.name })` |
| 230, 243 | `'Failed to add location to group.'` | `t('toast.addToGroupFailed')` |
| 260 | `` `${cityData.name} added ✓` `` | `t('toast.added', { name: cityData.name })` |
| 263 | `'Failed to add location'` | `t('toast.addFailed')` |
| 281 | `'Photo updated ✓'` | `t('toast.photoUpdated')` |
| 283 | `'Failed to update photo.'` | `t('toast.photoFailed')` |
| 290, 301 | `` `${city.name} removed` `` | `t('toast.removed', { name: city.name })` |
| 293 | `'Failed to remove location.'` | `t('toast.removeFailed')` |
| 304 | `'Failed to remove location'` | `t('toast.removeFailed')` |
| 328 | `` `${friend.display_name \|\| 'Friend'}'s Map` `` | `t('banner.friendsMap', { name: friend.display_name \|\| t('friend.fallback') })` |
| 332 | `'Could not load friend\'s map.'` | `t('toast.friendMapFailed')` |
| 362 | `_mapMode === 'countries' ? 'Search countries...' : 'Search cities...'` | `_mapMode === 'countries' ? t('search.countries') : t('search.cities')` |
| 369 | `'Friend removed.'` | `t('toast.friendRemoved')` |
| 371 | `'Failed to remove friend.'` | `t('toast.friendRemoveFailed')` |
| 379 | `` `Group "${name}" created! 🌍` `` | `t('toast.groupCreated', { name })` |
| 382 | `'Failed to create group.'` | `t('toast.groupCreateFailed')` |
| 390 | `'Failed to leave group.'` | `t('toast.leaveGroupFailed')` |
| 397 | `'Member removed from group.'` | `t('toast.memberRemoved')` |
| 400 | `'Could not remove member.'` | `t('toast.memberRemoveFailed')` |
| 407 | `` `${friendUids.length === 1 ? '1 person' : friendUids.length + ' people'} added to group ✓` `` | `friendUids.length === 1 ? t('toast.onePersonAdded') : t('toast.peopleAdded', { count: friendUids.length })` |
| 409 | `'Failed to add members.'` | `t('toast.addMembersFailed')` |
| 427 | `input.placeholder = 'Search cities...';` (Variable `_groupSearchInput`) | `_groupSearchInput.placeholder = t('search.cities');` |
| 504 | `mode === 'countries' ? 'Search countries...' : 'Search cities...'` | `mode === 'countries' ? t('search.countries') : t('search.cities')` |
| 557 | `` `${countryName} — visited ✓` `` | `t('toast.countryVisited', { name: countryName })` |
| 560 | `` `${countryName} — added to wishlist ⭐` `` | `t('toast.countryWishlist', { name: countryName })` |
| 563 | `` `${countryName} removed` `` | `t('toast.removed', { name: countryName })` |
| 567 | `'Failed to update country.'` | `t('toast.countryFailed')` |

- [ ] **Step 3: `js/app.js` — Live-Sprachwechsel-Handler**

Groups-State merken: bei den Modul-Variablen (nach Zeile 34 `let _friends = [];`) ergänzen:
```js
let _groups         = [];
```
Im `loadGroups`-Callback (Zeile 133) als erste Zeile:
```js
      _groups = groups;
```

Ans Ende von `_init(user)` — direkt vor dem `catch` — einfügen:
```js
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
```
Bewusste Einschränkung (dokumentiert): Ein bereits offener View-Banner-Titel („Karte von X") wird beim Sprachwechsel nicht neu gerendert — er stimmt beim nächsten View-Wechsel wieder. Kein zusätzlicher State dafür.

- [ ] **Step 4: Browser-Verifikation**

Run: `firebase serve --only hosting` → einloggen.
In der Konsole:
```js
const { setLang } = await import('./js/i18n.js?v=1'); setLang('de');
```
Expected: Sidebar, Empty-States, Badges sofort auf Deutsch; Stadt hinzufügen → Toast „… hinzugefügt ✓"; `setLang('en')` → wieder Englisch. Kein Reload, Karte bleibt an Position.

- [ ] **Step 5: Commit**

```bash
git add js/ui.js js/app.js
git commit -m "feat: translate dynamic strings via t(), live language switching"
```

---

### Task 4: Zahnrad + Settings-Modal (`theme.js`-Refactor, `js/settings.js`, Markup, CSS)

**Files:**
- Modify: `js/theme.js` (API-Refactor)
- Create: `js/settings.js`
- Modify: `map.html` (Zahnrad statt Theme-Button, Settings-Modal-Markup, Footer-Signout raus)
- Modify: `css/style.css` (`.btn-theme` → `.btn-settings`, Modal-Styles)
- Modify: `js/app.js` (Setup-Aufruf, alte Signout-Listener raus)

**Interfaces:**
- Consumes: `t`, `getLang`, `setLang` aus `i18n.js`; `signOutUser` aus `auth.js`; `APP_VERSION` aus `version.js`
- Produces (aus `theme.js`): `getTheme(): 'light'|'dark'`, `setTheme(theme, map): void`, `initTheme(map): void` (wendet nur noch gespeichertes Theme an, kein Button-Listener mehr)
- Produces (aus `settings.js`): `setupSettings(map): void` — verdrahtet Zahnrad, Modal, Theme-/Sprach-Buttons, Sign-out, Version

- [ ] **Step 1: `js/theme.js` komplett ersetzen**

```js
// ===== Theme =====

export function getTheme() {
  return localStorage.getItem('tm-theme') || 'dark';
}

/** Applies CSS class + map style and persists the choice. */
export function setTheme(theme, map) {
  _applyCSS(theme);
  map?.setStyle(theme === 'light'
    ? 'mapbox://styles/mapbox/light-v11'
    : 'mapbox://styles/mapbox/dark-v11');
  localStorage.setItem('tm-theme', theme);
}

/** Applies the saved theme on init. The map already loaded with dark-v11 —
 *  only switch the style if light is saved (setStyle during init otherwise
 *  races with hex/custom layer setup). */
export function initTheme(map) {
  const saved = getTheme();
  _applyCSS(saved);
  if (saved === 'light') {
    map?.setStyle('mapbox://styles/mapbox/light-v11');
  }
}

function _applyCSS(theme) {
  document.documentElement.classList.toggle('light', theme === 'light');
}
```

- [ ] **Step 2: `map.html` — Zahnrad + Modal-Markup**

Zeile 30 ersetzen:
```html
<button class="btn-theme" id="btn-theme" title="Toggle theme">☀️</button>
```
durch:
```html
<button class="btn-settings" id="btn-settings" title="Settings" data-i18n-title="settings.gearTitle" aria-label="Settings">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
</button>
```

Zeile 120 (`<button class="btn-signout" id="btn-signout">Sign out</button>`) **ersatzlos löschen**.

Vor `<!-- Toast -->` (Zeile 236) das Settings-Modal einfügen:
```html
  <!-- Settings Modal -->
  <div id="settings-modal">
    <div class="settings-card">
      <div class="settings-header">
        <h3 data-i18n="settings.title">Settings</h3>
        <button id="settings-close" class="settings-close" aria-label="Close">✕</button>
      </div>
      <p class="dialog-label" data-i18n="settings.appearance">Appearance</p>
      <div class="radio-group" id="settings-theme">
        <div class="radio-opt" data-theme="light" data-i18n="settings.light">Light</div>
        <div class="radio-opt" data-theme="dark" data-i18n="settings.dark">Dark</div>
      </div>
      <p class="dialog-label" data-i18n="settings.language">Language</p>
      <div class="radio-group" id="settings-lang">
        <div class="radio-opt" data-lang="en">English</div>
        <div class="radio-opt" data-lang="de">Deutsch</div>
      </div>
      <div class="settings-divider"></div>
      <div class="settings-links">
        <a href="privacy.html#privacy" target="_blank" rel="noopener" data-i18n="settings.privacy">Privacy Policy</a>
        <a href="privacy.html#imprint" target="_blank" rel="noopener" data-i18n="settings.imprint">Legal Notice</a>
      </div>
      <button class="btn-danger settings-signout" id="settings-signout" data-i18n="settings.signout">Sign out</button>
      <p class="settings-version" id="settings-version"></p>
    </div>
  </div>
```

- [ ] **Step 3: `css/style.css` — Styles**

`.btn-theme`-Block (Zeilen 162-171) ersetzen durch (nur Selektor-Umbenennung, eine Ergänzung):
```css
/* Settings gear button */
.btn-settings {
  width: 30px; height: 30px; flex-shrink: 0; margin-left: auto;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-card); border: 1px solid var(--bd-card);
  border-radius: 8px; cursor: pointer;
  color: var(--tx-secondary); font-size: 14px;
  transition: all 0.2s;
}
.btn-settings:hover { background: var(--bg-card-hov); }
```

`.btn-signout`-Regeln (Zeilen 248-254) **löschen**.

Nach dem `.group-modal-card h3`-Block (ca. Zeile 725) einfügen:
```css
/* ===== Settings Modal ===== */
#settings-modal {
  position: fixed; inset: 0; z-index: 220;
  display: none; align-items: center; justify-content: center;
  background: var(--bg-overlay); backdrop-filter: blur(6px);
}
#settings-modal.open { display: flex; }
.settings-card {
  background: var(--bg-dialog); border: 1px solid var(--bd-dialog);
  border-radius: 16px; padding: 24px;
  width: 90%; max-width: 340px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.settings-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.settings-header h3 { font-size: 1rem; font-weight: 700; color: var(--tx-primary); }
.settings-close {
  background: none; border: none; cursor: pointer;
  color: var(--tx-muted); font-size: 14px; padding: 4px;
}
.settings-close:hover { color: var(--tx-primary); }
.settings-divider { border-top: 1px solid var(--bd-dialog); margin: 16px 0; }
.settings-links { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.settings-links a {
  font-size: 0.84rem; color: var(--tx-secondary); text-decoration: none;
}
.settings-links a:hover { color: var(--tx-primary); text-decoration: underline; }
.settings-signout { width: 100%; }
.settings-version {
  margin-top: 14px; text-align: center;
  font-size: 0.7rem; color: var(--tx-muted);
}
```

- [ ] **Step 4: `js/settings.js` anlegen**

```js
import { getLang, setLang } from './i18n.js?v=1';
import { getTheme, setTheme } from './theme.js?v=18';
import { signOutUser } from './auth.js?v=18';
import { APP_VERSION } from './version.js?v=1';
// Note: theme.js is referenced as ?v=18 to match app.js until Task 7 bumps
// both references to ?v=19 in the same commit (same number everywhere,
// otherwise the module loads twice).

/** Wires the gear button, settings modal, theme/language switches,
 *  sign-out and version display. Call once after map init. */
export function setupSettings(map) {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;

  document.getElementById('settings-version').textContent = `TravelMap v${APP_VERSION}`;

  document.getElementById('btn-settings')?.addEventListener('click', () => {
    _syncSelections();
    modal.classList.add('open');
  });
  document.getElementById('settings-close')?.addEventListener('click', _close);
  modal.addEventListener('click', e => {
    if (e.target === modal) _close();
  });

  // Theme
  modal.querySelectorAll('#settings-theme .radio-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      setTheme(opt.dataset.theme, map);
      _syncSelections();
    });
  });

  // Language
  modal.querySelectorAll('#settings-lang .radio-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      setLang(opt.dataset.lang);
      _syncSelections();
    });
  });

  // Sign out
  document.getElementById('settings-signout')?.addEventListener('click', async () => {
    try { await signOutUser(); } catch { /* ignore */ }
    window.location.href = 'index.html';
  });

  function _close() {
    modal.classList.remove('open');
  }

  function _syncSelections() {
    const theme = getTheme();
    const lang  = getLang();
    modal.querySelectorAll('#settings-theme .radio-opt').forEach(o =>
      o.classList.toggle('selected', o.dataset.theme === theme));
    modal.querySelectorAll('#settings-lang .radio-opt').forEach(o =>
      o.classList.toggle('selected', o.dataset.lang === lang));
  }
}
```

- [ ] **Step 5: `js/app.js` anpassen**

1. Import ergänzen (nach dem theme-Import, Zeile 27):
```js
import { setupSettings } from './settings.js?v=1';
```
2. Nach `initTheme(_map);` (Zeile 87) einfügen:
```js
    setupSettings(_map);
```
3. Alten Signout-Listener (Zeilen 145-148) **löschen**:
```js
    document.getElementById('btn-signout').addEventListener('click', async () => {
      try { await signOutUser(); } catch { /* ignore */ }
      window.location.href = 'index.html';
    });
```
4. In `_initMobileSidebar()` die Zeile 636 **löschen**:
```js
  document.getElementById('btn-signout')?.addEventListener('click', _closeMobileSidebar);
```
5. Den `signOutUser`-Import in Zeile 1 **behalten** (wird in Task 6 vom Consent-Decline gebraucht).

- [ ] **Step 6: Browser-Verifikation**

Expected:
- Zahnrad im Sidebar-Header statt ☀️/🌙; Klick öffnet Modal, aktives Theme/Sprache sind markiert.
- Light/Dark wechselt CSS **und** Map-Style; Wahl übersteht Reload.
- English/Deutsch wechselt sofort das gesamte UI (Modal inklusive).
- Sign out → zurück auf Login-Seite.
- Version „TravelMap v1.0.0" klein unterm Sign-out.
- Kein Sign-out-Button mehr im Sidebar-Footer; Mobile (DevTools ≤768px): Modal nutzbar.

- [ ] **Step 7: Commit**

```bash
git add js/theme.js js/settings.js js/app.js map.html css/style.css
git commit -m "feat: settings modal with gear button — theme, language, sign-out, version"
```

---

### Task 5: `privacy.html` (Datenschutzerklärung + Impressum) + Login-Hinweis

**Files:**
- Create: `privacy.html`
- Modify: `index.html` (Privacy-Hinweis unter dem Button)

**Interfaces:**
- Consumes: `css/style.css`-Variablen (Dark/Light), localStorage-Keys `tm-theme`, `tm-lang`
- Produces: Anker `privacy.html#privacy` und `privacy.html#imprint` (von Task 4-Links und Task 6-Banner referenziert)

- [ ] **Step 1: `privacy.html` anlegen**

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TravelMap — Privacy</title>
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <link rel="stylesheet" href="css/style.css?v=26">
  <style>
    .privacy-page {
      max-width: 720px; margin: 0 auto; padding: 40px 24px 80px;
      color: var(--tx-primary); background: transparent;
      font-size: 0.92rem; line-height: 1.65;
    }
    body { background: var(--bg-sidebar); min-height: 100vh; }
    .privacy-page h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 6px; }
    .privacy-page h2 { font-size: 1.15rem; font-weight: 700; margin: 32px 0 10px; }
    .privacy-page h3 { font-size: 0.98rem; font-weight: 600; margin: 20px 0 8px; }
    .privacy-page p, .privacy-page li { color: var(--tx-secondary); margin-bottom: 10px; }
    .privacy-page ul { padding-left: 22px; margin-bottom: 12px; }
    .privacy-page a { color: #818cf8; }
    .privacy-topbar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 28px;
    }
    .privacy-back { font-size: 0.85rem; text-decoration: none; }
    .privacy-langswitch { display: flex; gap: 6px; }
    .privacy-langswitch button {
      padding: 5px 12px; border-radius: 8px; cursor: pointer;
      border: 1px solid var(--bd-card); background: var(--bg-card);
      color: var(--tx-secondary); font-size: 0.8rem; font-family: inherit;
    }
    .privacy-langswitch button.active {
      border-color: #6366f1; color: #c7d2fe; background: rgba(99,102,241,0.1);
    }
    .privacy-updated { font-size: 0.78rem; color: var(--tx-muted); margin-bottom: 24px; }
  </style>
</head>
<body>
  <div class="privacy-page">
    <div class="privacy-topbar">
      <a class="privacy-back" href="index.html">← TravelMap</a>
      <div class="privacy-langswitch">
        <button id="lang-de" type="button">Deutsch</button>
        <button id="lang-en" type="button">English</button>
      </div>
    </div>

    <!-- ═══ DEUTSCH ═══ -->
    <div id="content-de">
      <h1 id="privacy">Datenschutzerklärung</h1>
      <p class="privacy-updated">Stand: 9. Juli 2026</p>

      <h2>1. Verantwortlicher</h2>
      <p>[DEIN NAME]<br>[DEINE ADRESSE]<br>E-Mail: [DEINE E-MAIL-ADRESSE]</p>
      <p>TravelMap ist ein privates, nicht-kommerzielles Projekt.</p>

      <h2>2. Welche Daten wir speichern</h2>
      <h3>Google-Konto (bei der Anmeldung)</h3>
      <ul>
        <li>Name, E-Mail-Adresse und Profilbild deines Google-Kontos</li>
      </ul>
      <h3>Von dir eingetragene Daten</h3>
      <ul>
        <li>Besuchte Städte und Länder, Wunschlisten, „dort gelebt"-Markierungen</li>
        <li>Freundschaften (wen du über einen Einladungslink hinzugefügt hast)</li>
        <li>Gruppen, Gruppenmitgliedschaften und in Gruppen geteilte Städte</li>
        <li>Optional hochgeladene Fotos an Gruppen-Städten (verkleinert gespeichert)</li>
        <li>Ein zufälliger Einladungs-Token, über den Freunde dich hinzufügen können</li>
      </ul>
      <p>Diese Daten sind nötig, damit die App funktioniert (Art. 6 Abs. 1 lit. b DSGVO);
      deine Einwilligung holen wir beim ersten Login ein (Art. 6 Abs. 1 lit. a DSGVO).
      Zeitpunkt und Version deiner Einwilligung werden gespeichert.</p>

      <h2>3. Wo die Daten liegen</h2>
      <p>Anmeldung und Datenspeicherung laufen über <strong>Google Firebase</strong>
      (Firebase Authentication, Cloud Firestore, Firebase Hosting) der Google Ireland Ltd.
      bzw. Google LLC (USA). Dabei kann eine Übermittlung in die USA stattfinden;
      Google ist unter dem EU-US Data Privacy Framework zertifiziert.
      Details: <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">Firebase Privacy</a>.</p>
      <p>Die Weltkarte lädt Kartenmaterial von <strong>Mapbox</strong> (Mapbox Inc., USA).
      Beim Laden der Karte und bei der Städtesuche wird deine IP-Adresse an Mapbox übertragen.
      Details: <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener">Mapbox Privacy</a>.</p>

      <h2>4. Wer deine Daten sehen kann</h2>
      <ul>
        <li>Dein Profil (Name, Avatar) und deine Karte: nur du und bestätigte Freunde</li>
        <li>In Gruppen geteilte Städte und Fotos: alle Gruppenmitglieder</li>
        <li>Niemand sonst — es gibt keine öffentlichen Profile und keine Weitergabe an Dritte</li>
      </ul>

      <h2>5. localStorage</h2>
      <p>Im Browser speichern wir nur zwei technisch notwendige Einstellungen:
      Theme (hell/dunkel) und Sprache. Keine Tracking-Cookies, keine Analyse-Tools.</p>

      <h2>6. Speicherdauer</h2>
      <p>Deine Daten bleiben gespeichert, bis du dein Konto löschen lässt (siehe unten).</p>

      <h2>7. Deine Rechte</h2>
      <p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der
      Verarbeitung, Datenübertragbarkeit und Widerruf deiner Einwilligung (Art. 15–21 DSGVO)
      sowie das Recht auf Beschwerde bei einer Datenschutz-Aufsichtsbehörde.</p>
      <p>Zum Löschen deines Kontos und aller Daten schreib eine E-Mail an
      [DEINE E-MAIL-ADRESSE] — die Löschung erfolgt zeitnah.</p>

      <h2 id="imprint">Impressum</h2>
      <p>Angaben gemäß § 5 DDG:</p>
      <p>[DEIN NAME]<br>[DEINE ADRESSE]<br>E-Mail: [DEINE E-MAIL-ADRESSE]</p>
    </div>

    <!-- ═══ ENGLISH ═══ -->
    <div id="content-en" style="display:none">
      <h1>Privacy Policy</h1>
      <p class="privacy-updated">Last updated: July 9, 2026</p>

      <h2>1. Controller</h2>
      <p>[DEIN NAME]<br>[DEINE ADRESSE]<br>Email: [DEINE E-MAIL-ADRESSE]</p>
      <p>TravelMap is a private, non-commercial project.</p>

      <h2>2. What data we store</h2>
      <h3>Google account (on sign-in)</h3>
      <ul>
        <li>Name, email address and profile picture of your Google account</li>
      </ul>
      <h3>Data you add</h3>
      <ul>
        <li>Visited cities and countries, wishlists, "lived there" markers</li>
        <li>Friendships (people you added via an invite link)</li>
        <li>Groups, group memberships and cities shared in groups</li>
        <li>Optional photos attached to group cities (stored downscaled)</li>
        <li>A random invite token that lets friends add you</li>
      </ul>
      <p>This data is required for the app to work (Art. 6(1)(b) GDPR);
      we ask for your consent on first login (Art. 6(1)(a) GDPR).
      Time and version of your consent are stored.</p>

      <h2>3. Where the data lives</h2>
      <p>Sign-in and data storage use <strong>Google Firebase</strong>
      (Firebase Authentication, Cloud Firestore, Firebase Hosting) by Google Ireland Ltd.
      / Google LLC (USA). Data may be transferred to the USA; Google is certified
      under the EU-US Data Privacy Framework.
      Details: <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">Firebase Privacy</a>.</p>
      <p>The world map loads tiles from <strong>Mapbox</strong> (Mapbox Inc., USA).
      Loading the map and searching cities transmits your IP address to Mapbox.
      Details: <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener">Mapbox Privacy</a>.</p>

      <h2>4. Who can see your data</h2>
      <ul>
        <li>Your profile (name, avatar) and your map: only you and confirmed friends</li>
        <li>Cities and photos shared in groups: all group members</li>
        <li>Nobody else — there are no public profiles and no sharing with third parties</li>
      </ul>

      <h2>5. localStorage</h2>
      <p>We store only two technically necessary settings in your browser:
      theme (light/dark) and language. No tracking cookies, no analytics.</p>

      <h2>6. Retention</h2>
      <p>Your data is kept until you request account deletion (see below).</p>

      <h2>7. Your rights</h2>
      <p>You have the right to access, rectification, erasure, restriction of processing,
      data portability and withdrawal of consent (Art. 15–21 GDPR), and the right to
      lodge a complaint with a supervisory authority.</p>
      <p>To delete your account and all data, email [DEINE E-MAIL-ADRESSE] —
      deletion happens promptly.</p>

      <h2>Legal Notice (Impressum)</h2>
      <p>Information according to § 5 DDG (German law):</p>
      <p>[DEIN NAME]<br>[DEINE ADRESSE]<br>Email: [DEINE E-MAIL-ADRESSE]</p>
    </div>
  </div>

  <script>
    // Theme + language from the app's localStorage; page-local toggle only
    // (reading the policy in the other language must not flip the app language).
    if ((localStorage.getItem('tm-theme') || 'dark') === 'light') {
      document.documentElement.classList.add('light');
    }
    const saved = localStorage.getItem('tm-lang');
    let lang = (saved === 'en' || saved === 'de')
      ? saved
      : ((navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en');

    const show = l => {
      document.getElementById('content-de').style.display = l === 'de' ? '' : 'none';
      document.getElementById('content-en').style.display = l === 'en' ? '' : 'none';
      document.getElementById('lang-de').classList.toggle('active', l === 'de');
      document.getElementById('lang-en').classList.toggle('active', l === 'en');
      document.documentElement.lang = l;
    };
    document.getElementById('lang-de').addEventListener('click', () => show('de'));
    document.getElementById('lang-en').addEventListener('click', () => show('en'));
    show(lang);
  </script>
</body>
</html>
```

Hinweis: Der `#imprint`-Anker sitzt im deutschen Block; wer mit englischer Ansicht landet, sieht die englische „Legal Notice"-Sektion beim Scrollen — akzeptabel für eine private Seite.

- [ ] **Step 2: `index.html` — Privacy-Hinweis unter dem Button**

Nach `<p class="auth-error" id="auth-error"></p>` (Zeile 24) einfügen:
```html
      <p class="auth-privacy">
        <span data-i18n="auth.privacyNotice">By signing in you accept our</span>
        <a href="privacy.html" target="_blank" rel="noopener" data-i18n="auth.privacyLink">Privacy Policy</a>
      </p>
```
Und in `css/style.css` nach `.auth-error` (Zeile 128) ergänzen:
```css
.auth-privacy { margin-top: 16px; font-size: 0.72rem; color: #64748b; }
.auth-privacy a { color: #818cf8; text-decoration: none; }
.auth-privacy a:hover { text-decoration: underline; }
```

- [ ] **Step 3: Browser-Verifikation**

Expected: http://localhost:5000/privacy.html zeigt DE (bei deutschem Browser), Umschalter DE/EN funktioniert, Dark/Light folgt `tm-theme`, Login-Seite zeigt den Hinweis mit Link, `#privacy`/`#imprint`-Anker springen richtig.

- [ ] **Step 4: Commit**

```bash
git add privacy.html index.html css/style.css
git commit -m "feat: privacy policy + imprint page (DE/EN), sign-in privacy notice"
```

---

### Task 6: Consent-Banner + Init-Reihenfolge + Firestore-Rules

**Files:**
- Create: `js/consent.js`
- Modify: `js/db.js` (`acceptConsent`, `serverTimestamp`-Import)
- Modify: `map.html` (Banner-Markup)
- Modify: `css/style.css` (Banner-Styles)
- Modify: `js/app.js` (Init-Reihenfolge: Consent-Gate vor allen Writes)
- Modify: `firestore.rules` (Consent-Feld validieren)

**Interfaces:**
- Consumes: `loadUserData` aus `db.js`, `signOutUser` aus `auth.js`, `t`/`applyTranslations` aus `i18n.js`, `showToast` aus `ui.js`
- Produces (aus `consent.js`): `CONSENT_VERSION: number`, `hasConsent(userData): boolean`, `requestConsent(onAccept: () => Promise<void>): Promise<boolean>` — zeigt das Banner; „Zustimmen" ruft `onAccept()` und resolved erst bei Erfolg mit `true` (bei Fehler Toast + Banner bleibt); „Ablehnen" resolved `false`
- Produces (aus `db.js`): `acceptConsent(uid, version): Promise<void>` — `setDoc(..., { merge: true })` mit `consent: { version, accepted_at }`

- [ ] **Step 1: `map.html` — Banner-Markup** (direkt nach dem Settings-Modal einfügen)

```html
  <!-- Privacy Consent Banner (blocking, not dismissible) -->
  <div id="consent-banner">
    <div class="consent-card">
      <h3 data-i18n="consent.title">Before you start</h3>
      <p class="consent-body">
        <span data-i18n="consent.body">TravelMap stores…</span>
        <a href="privacy.html" target="_blank" rel="noopener" data-i18n="consent.privacyLink">Privacy Policy</a>
      </p>
      <div class="dialog-actions">
        <button class="btn-cancel" id="consent-decline" data-i18n="consent.decline">Decline</button>
        <button class="btn-add"    id="consent-accept" data-i18n="consent.accept">Agree and continue</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 2: `css/style.css` — Banner-Styles** (nach den Settings-Modal-Styles)

```css
/* ===== Consent Banner ===== */
#consent-banner {
  position: fixed; inset: 0; z-index: 300;
  display: none; align-items: center; justify-content: center;
  background: var(--bg-overlay); backdrop-filter: blur(6px);
}
#consent-banner.open { display: flex; }
.consent-card {
  background: var(--bg-dialog); border: 1px solid var(--bd-dialog);
  border-radius: 16px; padding: 24px;
  width: 90%; max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.4);
}
.consent-card h3 { font-size: 1rem; font-weight: 700; color: var(--tx-primary); margin-bottom: 12px; }
.consent-body { font-size: 0.86rem; color: var(--tx-secondary); line-height: 1.55; margin-bottom: 18px; }
.consent-body a { color: #818cf8; }
```

- [ ] **Step 3: `js/consent.js` anlegen**

```js
import { t } from './i18n.js?v=1';
// ?v=26 matches app.js's current ui.js reference; Task 7 bumps both to ?v=27.
import { showToast } from './ui.js?v=26';

// Bump this when the privacy policy changes materially —
// every user will then see the consent banner again.
export const CONSENT_VERSION = 1;

/** True if the loaded user doc contains an up-to-date consent. */
export function hasConsent(userData) {
  return (userData?.consent?.version ?? 0) >= CONSENT_VERSION;
}

/**
 * Shows the blocking consent banner.
 * onAccept: async fn that persists the consent (throws on failure).
 * Resolves true once onAccept succeeded, false if the user declined.
 * The banner cannot be dismissed any other way.
 */
export function requestConsent(onAccept) {
  return new Promise(resolve => {
    const banner  = document.getElementById('consent-banner');
    const accept  = document.getElementById('consent-accept');
    const decline = document.getElementById('consent-decline');

    banner.classList.add('open');

    accept.onclick = async () => {
      accept.disabled = true;
      try {
        await onAccept();
        banner.classList.remove('open');
        resolve(true);
      } catch (err) {
        console.error('Consent write failed:', err);
        showToast(t('toast.consentFailed'));
        accept.disabled = false;
      }
    };

    decline.onclick = () => {
      banner.classList.remove('open');
      resolve(false);
    };
  });
}
```

- [ ] **Step 4: `js/db.js` — `acceptConsent`**

Import (Zeile 1-4) erweitern um `serverTimestamp`:
```js
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  arrayUnion, arrayRemove, writeBatch, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
```
Nach `loadUserData` (Zeile 28) einfügen (Version kommt als Parameter — kein
`db.js`→`consent.js`-Import, damit keine Importkette `db → consent → ui` entsteht):
```js
/** Persists the privacy consent on the user doc (creates it if missing). */
export async function acceptConsent(uid, version) {
  await setDoc(userRef(uid), {
    consent: { version, accepted_at: serverTimestamp() }
  }, { merge: true });
}
```

- [ ] **Step 5: `js/app.js` — Consent-Gate vor allen Writes**

Imports ergänzen:
```js
import { CONSENT_VERSION, hasConsent, requestConsent } from './consent.js?v=1';
```
und in der db.js-Importliste (Zeile 2-8) `acceptConsent` ergänzen.

Anfang von `_init(user)` ändern — alt (Zeilen 64-67):
```js
async function _init(user) {
  try {
    await initUserProfile(_uid, user);
    _userData = await loadUserData(_uid);   // one-shot for initial render
```
neu:
```js
async function _init(user) {
  try {
    // ── Consent gate: nothing is written to Firestore before acceptance ──
    const preData = await loadUserData(_uid);   // read-only check
    if (!hasConsent(preData)) {
      const accepted = await requestConsent(() => acceptConsent(_uid, CONSENT_VERSION));
      if (!accepted) {
        try { await signOutUser(); } catch { /* ignore */ }
        window.location.href = 'index.html';
        return;
      }
    }

    await initUserProfile(_uid, user);
    _userData = await loadUserData(_uid);   // one-shot for initial render
```
Der restliche `_init`-Body bleibt unverändert (Invite-Token-Verarbeitung läuft damit automatisch erst nach Zustimmung; der Token bleibt bis dahin in der URL — bestehendes Verhalten).

- [ ] **Step 6: `firestore.rules` — Consent-Feld validieren**

Im `match /users/{uid}`-Block, ans Ende der `allow create, update:`-Bedingung (nach Zeile 52 `... wishlist_cities ... <= 5000`) anhängen:
```
        && request.resource.data.get('consent', {'version': 0}) is map
        && request.resource.data.get('consent', {'version': 0}).get('version', 0) is int
```

- [ ] **Step 7: Browser-Verifikation**

1. In der Firebase Console (oder per Konsole `firebase firestore:delete`) beim Test-User das `consent`-Feld sicherstellen, dass es fehlt — oder frisches Konto nutzen.
2. Login → Banner erscheint, Backdrop-Klick/Escape schließen **nicht**.
3. Firestore-Tab der Console offen halten: **vor** „Zustimmen" entsteht kein neues Feld/Doc.
4. „Ablehnen" → zurück auf Login-Seite; erneuter Login → Banner wieder da.
5. „Zustimmen" → App lädt, User-Doc enthält `consent: { version: 1, accepted_at: <ts> }`; Reload → kein Banner mehr.
6. Rules lokal prüfen: `firebase deploy --only firestore:rules` erst in Task 8 — bis dahin greift die alte (permissivere) Rule, Writes funktionieren.

- [ ] **Step 8: Commit**

```bash
git add js/consent.js js/db.js js/app.js map.html css/style.css firestore.rules
git commit -m "feat: GDPR consent banner gates all Firestore writes; validate consent in rules"
```

---

### Task 7: Cache-Buster bumpen + README aktualisieren

**Files:**
- Modify: `map.html`, `index.html` (Asset-Versionen)
- Modify: `js/app.js` (Import-Versionen)
- Modify: `README.md` (kompletter Rewrite)

**Interfaces:**
- Consumes: alle vorherigen Tasks
- Produces: konsistente `?v=`-Nummern: `style.css?v=26`, `app.js?v=29`, `ui.js?v=27`, `db.js?v=20`, `theme.js?v=19`, neue Module `?v=1`

- [ ] **Step 1: Versionen bumpen**

- `map.html`: `css/style.css?v=25` → `?v=26`; `js/app.js?v=28` → `?v=29`
- `index.html`: `css/style.css?v=6` → `?v=7`
- `js/app.js`-Importe: `./db.js?v=19` → `?v=20`; `./ui.js?v=26` → `?v=27`; `./theme.js?v=18` → `?v=19` (übrige unverändert; `i18n/settings/consent/version` stehen schon auf `?v=1`)
- `js/settings.js`: `./theme.js?v=18` → `?v=19`
- `js/consent.js`: `./ui.js?v=26` → `?v=27`
- Konsistenz prüfen: `grep -rn "?v=" js/*.js map.html index.html` — jedes Modul überall mit derselben Nummer.

- [ ] **Step 2: `README.md` komplett ersetzen**

```markdown
# TravelMap 🗺️

A personal travel tracking web app built with vanilla JS, Mapbox GL JS, and Firebase.

**Live:** https://travelmap-f4e3a.web.app

---

## Features

- **Track visited cities** — search any city worldwide and mark it as visited
- **Wishlist** — save cities and countries you want to visit
- **Lived there** — mark cities where you've lived (shown in amber)
- **Countries mode** — track whole countries with GeoJSON map fills
- **Auto country tracking** — visiting a city automatically tracks its country
- **Friends** — add friends via invite link, view their maps (read-only)
- **Groups** — shared maps: create groups, add members, pin cities together
  with personalised avatar/photo pins
- **Collection filter** — All / Visited / Want to visit / Lived there
- **Settings** — gear button opens a modal with theme, language, privacy links,
  sign-out and app version
- **Dark / Light theme** — persists across sessions
- **Bilingual** — full English / German UI, switchable live in settings
- **GDPR consent** — blocking consent banner before any data is stored,
  privacy policy + imprint page (`privacy.html`)
- **Mobile responsive** — slide-in sidebar drawer on small screens
- **Real-time** — Firestore listeners everywhere, no manual refresh
- **Google Sign-In** — auth via Firebase Authentication

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Vanilla JS (ES modules), no build step |
| Map | Mapbox GL JS v3.4.0 |
| Auth | Firebase Authentication (Google) |
| Database | Firestore |
| Hosting | Firebase Hosting |

## Project Structure

```
TravelMap/
├── index.html          # Login page
├── map.html            # Main app
├── privacy.html        # Privacy policy + imprint (DE/EN)
├── css/
│   └── style.css       # CSS custom properties (dark/light theming)
├── js/
│   ├── app.js          # Entry point, wires everything together
│   ├── auth.js         # Firebase auth helpers
│   ├── db.js           # Firestore read/write (user data, groups, consent)
│   ├── friends.js      # Friendships (invite links)
│   ├── groups.js       # Group CRUD + membership
│   ├── countries.js    # Countries mode (GeoJSON fills, search)
│   ├── map.js          # Mapbox map init
│   ├── markers.js      # City marker rendering
│   ├── ui.js           # Stats, search, dialogs, toasts, sidebar lists
│   ├── i18n.js         # EN/DE translations, t(), data-i18n
│   ├── settings.js     # Settings modal (theme, language, sign-out)
│   ├── consent.js      # GDPR consent banner + version
│   ├── theme.js        # Dark/light theme API
│   ├── version.js      # APP_VERSION
│   ├── config.js       # Firebase config (gitignored)
│   └── constants.js    # Mapbox token (gitignored)
├── firestore.rules     # Locked-down security rules
└── firebase.json       # Hosting config (no-cache headers)
```

## Setup

1. Clone the repo
2. Create `js/config.js` with your Firebase config (see `js/config.example.js`)
3. Create `js/constants.js` with your Mapbox token (see `js/constants.example.js`)
4. Fill in your name/address/email in `privacy.html` (search for `[DEIN`)
5. `firebase use <your-project>` and `firebase deploy`

## Marker Colors

| Color | Meaning |
|-------|---------|
| 🟣 Indigo | Visited |
| 🟡 Amber | Lived there |
| 🟢 Emerald | Wishlist |

## Releases

Bump `APP_VERSION` in `js/version.js` (shown in the settings modal).
Bump `CONSENT_VERSION` in `js/consent.js` only when the privacy policy
changes materially — every user will be asked for consent again.
```

- [ ] **Step 3: Commit**

```bash
git add map.html index.html js/app.js README.md
git commit -m "chore: bump asset versions; docs: update README for settings/i18n/consent"
```

---

### Task 8: Manuelle QA + Deploy

**Files:** keine neuen Änderungen (nur Fixes, falls QA etwas findet)

- [ ] **Step 1: QA-Checkliste durchgehen** (`firebase serve --only hosting`, frisches Test-Konto wo nötig)

1. Neues Konto → Consent-Banner erscheint; Firestore-Console: **keine** Writes vor der Entscheidung
2. „Ablehnen" → Logout + Redirect zu `index.html`
3. „Zustimmen" → App lädt; Reload → Banner kommt nicht wieder
4. Bestehender User ohne `consent`-Feld → Banner einmalig
5. Sprachwechsel DE↔EN im Settings-Modal: statische + dynamische Texte, ohne Reload, Karte behält Zoom/Position
6. Theme-Wechsel im Modal: CSS + Map-Style wechseln, Wahl übersteht Reload
7. Sign-out im Modal → Login-Seite; kein Sign-out mehr im Sidebar-Footer
8. `privacy.html` ohne Login, DE/EN-Umschalter, Dark/Light
9. Mobile (≤768px): Settings-Modal + Consent-Banner bedienbar, Sidebar-Drawer intakt
10. Invite-Link-Flow: Login mit `?token=` → Consent → danach wird der Token verarbeitet (Toast „Du bist jetzt mit … befreundet")
11. Version „TravelMap v1.0.0" im Modal sichtbar
12. Konsole: keine neuen Errors

- [ ] **Step 2: Deploy (Hosting + Rules)**

```bash
firebase deploy
```
Expected: Hosting + Firestore rules deployed; https://travelmap-f4e3a.web.app zeigt nach Hard-Reload das Zahnrad.

- [ ] **Step 3: Live-Smoke-Test + Nutzer informieren**

Auf der Live-URL: Login → Consent akzeptieren → Sprache/Theme wechseln.
**Wichtig, an den Betreiber:** `[DEIN NAME]` / `[DEINE ADRESSE]` / `[DEINE E-MAIL-ADRESSE]` in `privacy.html` ausfüllen, bevor der Link geteilt wird.
```
