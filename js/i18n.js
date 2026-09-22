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
    'popup.markVisited': '✓ Mark as visited',
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
    'toast.alreadyVisited': '{name} is already on your visited list',
    'toast.photoUpdated': 'Photo updated ✓',
    'toast.photoFailed': 'Failed to update photo.',
    'toast.removed': '{name} removed',
    'toast.removeFailed': 'Failed to remove location',
    'toast.markedVisited': '{name} marked as visited ✓',
    'toast.markVisitedFailed': 'Failed to mark as visited',
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
    'delete.button': 'Delete account',
    'delete.title': 'Delete your account?',
    'delete.body': 'Your account and this data will be permanently deleted:',
    'delete.summary': '{cities} cities, {countries} countries, {friends} friendships, member of {groups} groups. Your entries in those groups will be removed.',
    'delete.warning': 'This cannot be undone.',
    'delete.confirm': 'Delete permanently',
    'delete.cancel': 'Cancel',
    'delete.working': 'Deleting your data, please keep this tab open.',
    'delete.failed': 'Deletion did not finish. Your account still exists, please try again.',
    'delete.offline': 'You are offline. Deleting an account needs a connection.',
    // Consent banner
    'consent.title': 'Before you start',
    'consent.body': 'TravelMap stores your Google profile (name, email address, profile picture) and the travel data you add — cities, countries, friends and groups — with Google Firebase so the app can work. Details:',
    'consent.privacyLink': 'Privacy Policy',
    'consent.accept': 'Agree and continue',
    'consent.decline': 'Decline',
    // Login page
    'auth.tagline': 'Track your travels on the world map',
    'offline.banner': 'No connection. You can keep using the app, your changes sync once you are back online.',
    'toast.needsNetwork': 'This needs a connection. Please try again once you are back online.',
    'toast.offlineMap': 'The map needs a connection. Your places stay in the list.',
    'auth.signin': 'Sign in with Google',
    'auth.signinApple': 'Sign in with Apple',
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
    'popup.markVisited': '✓ Als besucht markieren',
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
    'toast.alreadyVisited': '{name} hast du schon besucht',
    'toast.photoUpdated': 'Foto aktualisiert ✓',
    'toast.photoFailed': 'Foto konnte nicht aktualisiert werden.',
    'toast.removed': '{name} entfernt',
    'toast.removeFailed': 'Ort konnte nicht entfernt werden',
    'toast.markedVisited': '{name} als besucht markiert ✓',
    'toast.markVisitedFailed': 'Ort konnte nicht als besucht markiert werden',
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
    'delete.button': 'Konto löschen',
    'delete.title': 'Konto wirklich löschen?',
    'delete.body': 'Dein Konto und diese Daten werden endgültig gelöscht:',
    'delete.summary': '{cities} Städte, {countries} Länder, {friends} Freundschaften, Mitglied in {groups} Gruppen. Deine Einträge dort werden entfernt.',
    'delete.warning': 'Das lässt sich nicht rückgängig machen.',
    'delete.confirm': 'Endgültig löschen',
    'delete.cancel': 'Abbrechen',
    'delete.working': 'Deine Daten werden gelöscht. Lass diesen Tab bitte offen.',
    'delete.failed': 'Die Löschung ist nicht durchgelaufen. Dein Konto existiert noch, bitte versuch es erneut.',
    'delete.offline': 'Du bist offline. Für eine Kontolöschung braucht es eine Verbindung.',
    // Consent banner
    'consent.title': 'Bevor es losgeht',
    'consent.body': 'TravelMap speichert dein Google-Profil (Name, E-Mail-Adresse, Profilbild) und die Reisedaten, die du einträgst — Städte, Länder, Freunde und Gruppen — bei Google Firebase, damit die App funktioniert. Details:',
    'consent.privacyLink': 'Datenschutzerklärung',
    'consent.accept': 'Zustimmen und weiter',
    'consent.decline': 'Ablehnen',
    // Login page
    'auth.tagline': 'Verfolge deine Reisen auf der Weltkarte',
    'offline.banner': 'Kein Netz. Du kannst alles weiter nutzen, deine Änderungen werden synchronisiert, sobald du wieder online bist.',
    'toast.needsNetwork': 'Dafür brauchst du eine Verbindung. Versuch es noch einmal, sobald du online bist.',
    'toast.offlineMap': 'Die Karte braucht eine Verbindung. Deine Orte bleiben in der Liste.',
    'auth.signin': 'Mit Google anmelden',
    'auth.signinApple': 'Mit Apple anmelden',
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
