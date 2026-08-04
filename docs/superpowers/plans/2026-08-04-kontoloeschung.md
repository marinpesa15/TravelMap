# Kontolöschung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein angemeldeter Nutzer kann sein TravelMap-Konto samt zugehöriger Daten direkt in der App löschen (App-Store-Guideline 5.1.1(v)).

**Architecture:** Reine Client-Lösung ohne Server. Drei kleine Module: `account-logic.js` trifft die riskanten Entscheidungen als reine Funktionen, `account-io.js` kapselt alle Firestore- und Auth-Zugriffe hinter einem Objekt, `account.js` orchestriert die Reihenfolge und bekommt das IO-Objekt injiziert. Dadurch ist der Ablauf ohne Firebase testbar, und der Auth-Account wird garantiert zuletzt gelöscht.

**Tech Stack:** Vanilla JS (ESM), Firebase Web SDK 10.12.0 vom CDN, Vitest nur als devDependency.

**Spec:** `docs/superpowers/specs/2026-08-04-travelmap-kontoloeschung-design.md`

## Global Constraints

- Branch ist `feature/account-deletion`. Niemals direkt auf `main` committen.
- Kein Bundler, kein Build-Schritt zur Laufzeit. Die App lädt weiterhin alle Module als ESM, Firebase kommt von `https://www.gstatic.com/firebasejs/10.12.0/`.
- Vitest ist **ausschließlich** devDependency. `package.json` darf die Laufzeit nicht verändern.
- Jeder JS-Import trägt einen Cache-Buster `?v=N`. Wird ein Modul geändert, muss `N` in **allen** importierenden Dateien erhöht werden.
- Alle nutzersichtbaren Texte in `js/i18n.js`, Sprachen **en** und **de**. Beide sind Pflicht.
- Deutsche Texte duzen. Nie siezen.
- **Keine Geviert- oder Halbgeviertstriche** in nutzersichtbaren Texten. Kein `—`, kein `–`. Komma, Punkt oder normaler Bindestrich.
- Reihenfolge ist nicht verhandelbar: Der Firebase-Auth-Account wird **nach** allen Datenoperationen gelöscht.

---

### Task 1: Vitest-Setup und reine Entscheidungslogik

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `js/account-logic.js`
- Test: `tests/account-logic.test.js`

**Interfaces:**
- Consumes: nichts
- Produces:
  - `stripMyCities(cities: Array<{name: string, addedBy?: {uid: string}}>, myUid: string) => Array<object>`
  - `planGroupChange(group: {id: string, created_by: string, members: string[], visited_cities?: object[], wishlist_cities?: object[]}, myUid: string) => {action: 'delete'} | {action: 'update', data: {members: string[], visited_cities: object[], wishlist_cities: object[], created_by?: string}}`

- [ ] **Step 1: package.json anlegen**

```json
{
  "name": "travelmap",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

Dieses `package.json` existiert nur für Tests. Es gibt keinen Build-Schritt, `index.html` und `map.html` laden die Module unverändert direkt.

- [ ] **Step 2: vitest.config.js anlegen**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
});
```

- [ ] **Step 3: Abhängigkeiten installieren**

Run: `npm install`
Expected: `node_modules/` entsteht, keine Fehler.

- [ ] **Step 4: `.gitignore` prüfen und ergänzen**

Run: `grep -q "node_modules" .gitignore && echo "schon drin" || echo "fehlt"`

Fehlt es, diese beiden Zeilen an `.gitignore` anhängen:

```
node_modules/
.firebase/hosting..cache
```

Die zweite Zeile räumt nebenbei die seit Wochen offene Kleinigkeit weg, dass diese Datei ständig als modifiziert auftaucht.

- [ ] **Step 5: Failing Test für `stripMyCities` schreiben**

Create `tests/account-logic.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { stripMyCities } from '../js/account-logic.js';

const city = (name, uid) => uid === undefined
  ? { name }
  : { name, addedBy: { uid, displayName: 'X', photoURL: 'p' } };

describe('stripMyCities', () => {
  it('entfernt nur die eigenen Staedte', () => {
    const cities = [city('Rom', 'me'), city('Wien', 'other'), city('Oslo', 'me')];
    expect(stripMyCities(cities, 'me').map(c => c.name)).toEqual(['Wien']);
  });

  it('behaelt Staedte ohne addedBy, weil sie niemandem zuzuordnen sind', () => {
    const cities = [city('Alt'), city('Rom', 'me')];
    expect(stripMyCities(cities, 'me').map(c => c.name)).toEqual(['Alt']);
  });

  it('vertraegt eine leere Liste', () => {
    expect(stripMyCities([], 'me')).toEqual([]);
  });
});
```

- [ ] **Step 6: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test`
Expected: FAIL, `js/account-logic.js` existiert nicht.

- [ ] **Step 7: `stripMyCities` implementieren**

Create `js/account-logic.js`:

```js
// Reine Entscheidungslogik der Kontoloeschung. Kein Firebase, kein DOM.
// Liegt bewusst getrennt, weil hier die Faelle stecken, in denen ein Fehler
// fremde Daten zerstoert.

/**
 * Entfernt die Staedte, die `myUid` beigetragen hat.
 * Staedte ohne `addedBy` stammen aus der Zeit vor den personalisierten
 * Gruppen-Pins und lassen sich niemandem zuordnen. Sie bleiben stehen.
 */
export function stripMyCities(cities, myUid) {
  return (cities ?? []).filter(c => c?.addedBy?.uid !== myUid);
}
```

- [ ] **Step 8: Test laufen lassen, Erfolg bestätigen**

Run: `npm test`
Expected: PASS, 3 Tests.

- [ ] **Step 9: Failing Tests für `planGroupChange` ergänzen**

An `tests/account-logic.test.js` anhängen:

```js
import { planGroupChange } from '../js/account-logic.js';

const group = (over = {}) => ({
  id: 'g1',
  created_by: 'me',
  members: ['me', 'anna', 'ben'],
  visited_cities: [city('Rom', 'me'), city('Wien', 'anna')],
  wishlist_cities: [city('Oslo', 'me')],
  ...over
});

describe('planGroupChange', () => {
  it('loescht die Gruppe, wenn ich das letzte Mitglied bin', () => {
    const res = planGroupChange(group({ members: ['me'] }), 'me');
    expect(res).toEqual({ action: 'delete' });
  });

  it('uebergibt an das erste verbleibende Mitglied, wenn ich Ersteller bin', () => {
    const res = planGroupChange(group(), 'me');
    expect(res.action).toBe('update');
    expect(res.data.created_by).toBe('anna');
    expect(res.data.members).toEqual(['anna', 'ben']);
  });

  it('laesst created_by unangetastet, wenn ich nicht Ersteller bin', () => {
    const res = planGroupChange(group({ created_by: 'anna' }), 'me');
    expect(res.action).toBe('update');
    expect(res.data).not.toHaveProperty('created_by');
    expect(res.data.members).toEqual(['anna', 'ben']);
  });

  it('entfernt meine Staedte aus beiden Listen', () => {
    const res = planGroupChange(group(), 'me');
    expect(res.data.visited_cities.map(c => c.name)).toEqual(['Wien']);
    expect(res.data.wishlist_cities).toEqual([]);
  });

  it('vertraegt Gruppen ohne Staedte-Felder', () => {
    const g = { id: 'g2', created_by: 'anna', members: ['anna', 'me'] };
    const res = planGroupChange(g, 'me');
    expect(res.data.visited_cities).toEqual([]);
    expect(res.data.wishlist_cities).toEqual([]);
  });
});
```

- [ ] **Step 10: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test`
Expected: FAIL, `planGroupChange is not a function`.

- [ ] **Step 11: `planGroupChange` implementieren**

An `js/account-logic.js` anhängen:

```js
/**
 * Entscheidet, was mit einer Gruppe passiert, wenn `myUid` sein Konto loescht.
 *
 * Ersteller uebergeben an das erste verbleibende Mitglied statt die Gruppe zu
 * loeschen. Sonst blieben entweder fremde Daten auf der Strecke oder eine
 * Gruppe mit totem Ersteller zurueck, die niemand mehr loeschen kann.
 *
 * @returns {{action: 'delete'}|{action: 'update', data: object}}
 */
export function planGroupChange(group, myUid) {
  const remaining = (group.members ?? []).filter(uid => uid !== myUid);
  if (remaining.length === 0) return { action: 'delete' };

  const data = {
    members: remaining,
    visited_cities:  stripMyCities(group.visited_cities,  myUid),
    wishlist_cities: stripMyCities(group.wishlist_cities, myUid)
  };
  // Nur der Ersteller uebergibt. Bei allen anderen bleibt created_by
  // unveraendert, sonst wuerde die Security Rule die Aenderung ablehnen.
  if (group.created_by === myUid) data.created_by = remaining[0];
  return { action: 'update', data };
}
```

- [ ] **Step 12: Test laufen lassen, Erfolg bestätigen**

Run: `npm test`
Expected: PASS, 8 Tests.

- [ ] **Step 13: Commit**

```bash
git add package.json vitest.config.js .gitignore js/account-logic.js tests/account-logic.test.js
git commit -m "Add pure deletion logic for groups and contributed cities"
```

---

### Task 2: Security Rules für Übergabe und letztes Mitglied

**Files:**
- Modify: `firestore.rules` (Block `match /groups/{groupId}`)

**Interfaces:**
- Consumes: nichts
- Produces: Regeln, auf die Task 4 sich verlässt. Ohne diese Änderung schlägt jedes `updateGroup` mit geändertem `created_by` mit `permission-denied` fehl.

- [ ] **Step 1: Aktuelle `allow update`-Regel lesen**

Run: `grep -n "created_by == resource.data.created_by" firestore.rules`
Expected: eine Trefferzeile im `groups`-Block.

- [ ] **Step 2: `created_by`-Bedingung durch die Übergabe-Ausnahme ersetzen**

In `firestore.rules`, im Block `match /groups/{groupId}`, diese Zeile:

```
        && request.resource.data.created_by == resource.data.created_by
```

ersetzen durch:

```
        // created_by ist normalerweise unveraenderlich. Einzige Ausnahme ist
        // die Uebergabe bei Kontoloeschung: nur der aktuelle Ersteller, nur
        // waehrend er selbst austritt, und nur an jemanden, der Mitglied bleibt.
        && (
          request.resource.data.created_by == resource.data.created_by
          || (
            request.auth.uid == resource.data.created_by
            && !(request.auth.uid in request.resource.data.members)
            && request.resource.data.created_by in request.resource.data.members
          )
        )
```

- [ ] **Step 3: `allow delete` um das letzte Mitglied erweitern**

Diese Zeilen:

```
      allow delete: if request.auth != null
        && request.auth.uid == resource.data.created_by;
```

ersetzen durch:

```
      // Der Ersteller darf loeschen. Dazu ein Sicherheitsnetz: Ein letztes
      // verbliebenes Mitglied darf die Gruppe auch dann aufloesen, wenn der
      // Ersteller ein bereits geloeschtes Konto ist.
      allow delete: if request.auth != null && (
        request.auth.uid == resource.data.created_by
        || (request.auth.uid in resource.data.members
            && resource.data.members.size() == 1)
      );
```

- [ ] **Step 4: Klammern und Struktur prüfen**

Run: `grep -c "allow" firestore.rules && node -e "const s=require('fs').readFileSync('firestore.rules','utf8'); const o=(s.match(/{/g)||[]).length, c=(s.match(/}/g)||[]).length; console.log(o===c ? 'Klammern ausgeglichen: '+o : 'FEHLER: '+o+' offen, '+c+' geschlossen')"`
Expected: `Klammern ausgeglichen: N`

Die echte Validierung macht Firebase beim Deploy in Task 6. **Hier noch nicht veröffentlichen**, sonst laufen neue Regeln gegen alten Code.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules
git commit -m "Allow a leaving creator to hand the group to a remaining member"
```

---

### Task 3: Neuanmeldung in auth.js kapseln

**Files:**
- Modify: `js/auth.js`

**Interfaces:**
- Consumes: nichts
- Produces: `reauthenticate(): Promise<void>` — wird von Task 4 über das IO-Objekt aufgerufen.

- [ ] **Step 1: Import und Funktion ergänzen**

In `js/auth.js` die Import-Liste um `reauthenticateWithPopup` erweitern:

```js
import {
  GoogleAuthProvider,
  signInWithPopup,
  reauthenticateWithPopup,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
```

Am Ende der Datei anhängen:

```js
/**
 * Frische Anmeldung. Firebase verlangt sie vor `user.delete()`.
 *
 * Diese Funktion ist die einzige Stelle, die den Anmeldeweg kennt. Im
 * nativen Capacitor-Build funktioniert `reauthenticateWithPopup` nicht,
 * weil Google eingebettete WebViews blockt. Dort wird hier spaeter ein
 * Google-Sign-In-Plugin plus `reauthenticateWithCredential` eingesetzt.
 * Der Loeschablauf in account.js bleibt davon unberuehrt.
 *
 * @throws wenn der Nutzer abbricht, der Popup blockiert ist oder niemand angemeldet ist
 */
export function reauthenticate() {
  const user = auth.currentUser;
  if (!user) throw new Error('not-signed-in');
  return reauthenticateWithPopup(user, provider).then(() => undefined);
}
```

- [ ] **Step 2: `auth`-Import prüfen**

Run: `grep -n "import { auth }" js/auth.js`
Expected: `import { auth } from './config.js?v=1';` ist vorhanden. Falls nicht, ergänzen.

- [ ] **Step 3: Cache-Buster von auth.js in allen Importern erhöhen**

Run: `grep -rn "auth.js?v=" js/ *.html`

Jede gefundene Stelle von `?v=19` auf `?v=20` setzen. Wird das vergessen, laden bestehende Clients die alte Datei ohne `reauthenticate` und die Löschung schlägt mit `reauthenticate is not a function` fehl.

- [ ] **Step 4: Syntax prüfen**

Run: `node --input-type=module --check < js/auth.js`
Expected: keine Ausgabe, Exit-Code 0.

- [ ] **Step 5: Commit**

```bash
git add js/auth.js js/*.js *.html
git commit -m "Add reauthenticate behind a single seam for the native build"
```

---

### Task 4: IO-Schicht und Löschablauf

**Files:**
- Create: `js/account-io.js`
- Create: `js/account.js`
- Test: `tests/account.test.js`

**Interfaces:**
- Consumes: `planGroupChange` aus Task 1, `reauthenticate` aus Task 3
- Produces:
  - `collectDeletionSummary(uid, opts?) => Promise<{cities: number, countries: number, friends: number, groups: number}>`
  - `deleteAccount(uid, opts?) => Promise<void>` mit `opts = {io?, onProgress?: (schritt: string) => void}`
  - `firestoreIo` als Standard-IO-Objekt

- [ ] **Step 1: IO-Schicht anlegen**

Create `js/account-io.js`:

```js
// Duenne Huelle um Firestore und Auth. Enthaelt bewusst keine Logik, damit
// account.js im Test ein Fake-IO bekommen kann und trotzdem derselbe Ablauf
// laeuft wie in der App.
import {
  doc, collection, getDoc, getDocs, deleteDoc, updateDoc,
  writeBatch, query, where
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { db, auth } from './config.js?v=1';
import { reauthenticate } from './auth.js?v=20';

// Firestore erlaubt hoechstens 500 Operationen pro Batch.
const BATCH_LIMIT = 500;

export const firestoreIo = {
  reauthenticate,

  async loadUser(uid) {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },

  async loadMyGroups(uid) {
    const q = query(collection(db, 'groups'), where('members', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  updateGroup(groupId, data) {
    return updateDoc(doc(db, 'groups', groupId), data);
  },

  deleteGroup(groupId) {
    return deleteDoc(doc(db, 'groups', groupId));
  },

  async loadFriendUids(uid) {
    const snap = await getDocs(collection(db, 'users', uid, 'friends'));
    return snap.docs.map(d => d.id);
  },

  // Beide Richtungen: mein Eintrag bei ihm und seiner bei mir.
  async deleteFriendPairs(uid, friendUids) {
    for (let i = 0; i < friendUids.length; i += BATCH_LIMIT / 2) {
      const chunk = friendUids.slice(i, i + BATCH_LIMIT / 2);
      const batch = writeBatch(db);
      for (const fid of chunk) {
        batch.delete(doc(db, 'users', fid, 'friends', uid));
        batch.delete(doc(db, 'users', uid, 'friends', fid));
      }
      await batch.commit();
    }
  },

  deleteInvite(token) {
    return deleteDoc(doc(db, 'invites', token));
  },

  deleteUserDoc(uid) {
    return deleteDoc(doc(db, 'users', uid));
  },

  async deleteAuthUser() {
    const user = auth.currentUser;
    if (!user) throw new Error('not-signed-in');
    await user.delete();
  }
};
```

- [ ] **Step 2: Failing Test für die Reihenfolge schreiben**

Create `tests/account.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { deleteAccount, collectDeletionSummary } from '../js/account.js';

function fakeIo(over = {}) {
  const calls = [];
  const rec = (name, ret) => (...args) => { calls.push(name); return Promise.resolve(ret); };
  const io = {
    calls,
    reauthenticate: rec('reauthenticate'),
    loadUser: rec('loadUser', { invite_token: 'tok', visited_cities: [], wishlist_cities: [],
                                visited_countries: [], wishlist_countries: [] }),
    loadMyGroups: rec('loadMyGroups', []),
    updateGroup: rec('updateGroup'),
    deleteGroup: rec('deleteGroup'),
    loadFriendUids: rec('loadFriendUids', []),
    deleteFriendPairs: rec('deleteFriendPairs'),
    deleteInvite: rec('deleteInvite'),
    deleteUserDoc: rec('deleteUserDoc'),
    deleteAuthUser: rec('deleteAuthUser'),
    ...over
  };
  return io;
}

describe('deleteAccount', () => {
  it('loescht den Auth-Account als allerletztes', async () => {
    const io = fakeIo();
    await deleteAccount('me', { io });
    expect(io.calls[0]).toBe('reauthenticate');
    expect(io.calls.at(-1)).toBe('deleteAuthUser');
    expect(io.calls.indexOf('deleteUserDoc')).toBeLessThan(io.calls.indexOf('deleteAuthUser'));
    expect(io.calls.indexOf('deleteFriendPairs')).toBeLessThan(io.calls.indexOf('deleteUserDoc'));
  });

  it('bricht ohne jede Datenaenderung ab, wenn die Neuanmeldung fehlschlaegt', async () => {
    const io = fakeIo({ reauthenticate: () => Promise.reject(new Error('popup-closed')) });
    await expect(deleteAccount('me', { io })).rejects.toThrow('popup-closed');
    expect(io.calls).toEqual([]);
    expect(io.calls).not.toContain('deleteAuthUser');
  });

  it('laesst den Auth-Account stehen, wenn eine Gruppe fehlschlaegt', async () => {
    const io = fakeIo({
      loadMyGroups: () => Promise.resolve([
        { id: 'g1', created_by: 'me', members: ['me', 'anna'] }
      ]),
      updateGroup: () => Promise.reject(new Error('permission-denied'))
    });
    await expect(deleteAccount('me', { io })).rejects.toThrow('permission-denied');
    expect(io.calls).not.toContain('deleteAuthUser');
    expect(io.calls).not.toContain('deleteUserDoc');
  });

  it('loescht eine Gruppe, in der ich das letzte Mitglied bin', async () => {
    const io = fakeIo({
      loadMyGroups: () => Promise.resolve([{ id: 'g1', created_by: 'me', members: ['me'] }])
    });
    await deleteAccount('me', { io });
    expect(io.calls).toContain('deleteGroup');
    expect(io.calls).not.toContain('updateGroup');
  });

  it('ueberspringt das Invite-Doc, wenn kein Token vorhanden ist', async () => {
    const io = fakeIo({ loadUser: () => Promise.resolve({}) });
    await deleteAccount('me', { io });
    expect(io.calls).not.toContain('deleteInvite');
  });

  it('meldet jeden Schritt an onProgress', async () => {
    const io = fakeIo();
    const seen = [];
    await deleteAccount('me', { io, onProgress: s => seen.push(s) });
    expect(seen).toContain('groups');
    expect(seen).toContain('account');
  });
});

describe('collectDeletionSummary', () => {
  it('zaehlt Staedte, Laender, Freunde und Gruppen', async () => {
    const io = fakeIo({
      loadUser: () => Promise.resolve({
        visited_cities: [{ name: 'Rom' }, { name: 'Wien' }],
        wishlist_cities: [{ name: 'Oslo' }],
        visited_countries: ['IT', 'AT'],
        wishlist_countries: ['NO']
      }),
      loadFriendUids: () => Promise.resolve(['anna', 'ben']),
      loadMyGroups: () => Promise.resolve([{ id: 'g1' }])
    });
    const s = await collectDeletionSummary('me', { io });
    expect(s).toEqual({ cities: 3, countries: 3, friends: 2, groups: 1 });
  });

  it('liefert Nullen fuer ein leeres Konto', async () => {
    const io = fakeIo({ loadUser: () => Promise.resolve(null) });
    const s = await collectDeletionSummary('me', { io });
    expect(s).toEqual({ cities: 0, countries: 0, friends: 0, groups: 0 });
  });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

Run: `npm test`
Expected: FAIL, `js/account.js` existiert nicht.

- [ ] **Step 4: Löschablauf implementieren**

Create `js/account.js`:

```js
// Orchestrierung der Kontoloeschung.
//
// Die Reihenfolge ist die eigentliche Sicherheitsmassnahme: Der Auth-Account
// faellt zuletzt. Bricht es vorher ab, existiert das Konto noch und der
// Nutzer kann es erneut anstossen. Andersherum waere es fatal, denn ohne
// Konto fehlt die Berechtigung, die eigenen Reste zu loeschen.
import { planGroupChange } from './account-logic.js?v=1';
import { firestoreIo } from './account-io.js?v=1';

/** Zahlen fuer die Warnung, bevor irgendetwas veraendert wird. */
export async function collectDeletionSummary(uid, { io = firestoreIo } = {}) {
  const [user, friendUids, groups] = await Promise.all([
    io.loadUser(uid), io.loadFriendUids(uid), io.loadMyGroups(uid)
  ]);
  const u = user ?? {};
  return {
    cities:    (u.visited_cities    ?? []).length + (u.wishlist_cities    ?? []).length,
    countries: (u.visited_countries ?? []).length + (u.wishlist_countries ?? []).length,
    friends:   friendUids.length,
    groups:    groups.length
  };
}

/**
 * Loescht Konto und zugehoerige Daten. Jeder Schritt vertraegt "ist schon
 * weg", der Ablauf ist also wiederholbar.
 *
 * @param {string} uid
 * @param {{io?: object, onProgress?: (schritt: string) => void}} [opts]
 */
export async function deleteAccount(uid, { io = firestoreIo, onProgress = () => {} } = {}) {
  // 1. Frische Anmeldung. Schlaegt sie fehl, ist noch nichts passiert.
  await io.reauthenticate();

  // 2. Profil lesen, solange es noch existiert. Das Invite-Token steht dort.
  onProgress('profile');
  const user = await io.loadUser(uid);

  // 3. Gruppen. Je Gruppe ein Schreibvorgang, damit sie einzeln atomar ist.
  onProgress('groups');
  const groups = await io.loadMyGroups(uid);
  for (const group of groups) {
    const plan = planGroupChange(group, uid);
    if (plan.action === 'delete') await io.deleteGroup(group.id);
    else await io.updateGroup(group.id, plan.data);
  }

  // 4. Freundschaften, beide Richtungen. Muss vor dem User-Doc laufen:
  //    Firestore loescht Subcollections NICHT mit dem Dokument mit, sonst
  //    bliebe users/{uid}/friends/* verwaist und unerreichbar zurueck.
  onProgress('friends');
  const friendUids = await io.loadFriendUids(uid);
  if (friendUids.length) await io.deleteFriendPairs(uid, friendUids);

  // 5. Invite-Doc.
  onProgress('invite');
  if (user?.invite_token) await io.deleteInvite(user.invite_token);

  // 6. User-Doc. Nimmt Staedte, Laender, Consent und Profil mit, weil alles
  //    als Felder im Dokument liegt.
  onProgress('profileDoc');
  await io.deleteUserDoc(uid);

  // 7. Zuletzt der Auth-Account.
  onProgress('account');
  await io.deleteAuthUser();
}
```

- [ ] **Step 5: Test laufen lassen, Erfolg bestätigen**

Run: `npm test`
Expected: PASS, 16 Tests insgesamt.

- [ ] **Step 6: Commit**

```bash
git add js/account-io.js js/account.js tests/account.test.js
git commit -m "Add deletion flow with the auth account removed last"
```

---

### Task 5: Übersetzungen und Markup

**Files:**
- Modify: `js/i18n.js` (Blöcke `en` und `de`)
- Modify: `map.html` (Block `#settings-modal`, ab Zeile 291)
- Modify: `style.css`

**Interfaces:**
- Consumes: nichts
- Produces: DOM-Elemente mit den IDs `settings-delete`, `delete-modal`, `delete-summary`, `delete-confirm`, `delete-cancel`, `delete-status`, auf die Task 6 zugreift.

- [ ] **Step 1: Englische Strings ergänzen**

In `js/i18n.js` im `en`-Block hinter `'settings.signout'` einfügen:

```js
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
```

- [ ] **Step 2: Deutsche Strings ergänzen**

In `js/i18n.js` im `de`-Block an derselben Stelle einfügen:

```js
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
```

Prüfen: keine `—` und keine `–` in diesen Zeilen.

- [ ] **Step 3: Cache-Buster von i18n.js in allen Importern erhöhen**

Run: `grep -rln "i18n.js?v=1" js/ *.html`

In jeder Trefferdatei `i18n.js?v=1` durch `i18n.js?v=2` ersetzen. Der Kommentar in `version.js` weist ausdrücklich darauf hin, dass neue i18n-Schlüssel diesen Bump erzwingen. Wird er vergessen, laden bestehende Clients die alte Übersetzungstabelle und sehen rohe Schlüssel wie `delete.title`.

- [ ] **Step 4: Löschbutton ins Settings-Modal**

In `map.html` die Zeile mit `id="settings-signout"` suchen und **danach** einfügen:

```html
      <button class="btn-danger settings-delete" id="settings-delete" data-i18n="delete.button">Delete account</button>
```

- [ ] **Step 5: Bestätigungsdialog ins Markup**

In `map.html` direkt **nach** dem schließenden `</div>` von `#settings-modal` (nach Zeile 314) einfügen:

```html
  <!-- Account deletion confirmation -->
  <div id="delete-modal">
    <div class="settings-card">
      <div class="settings-header">
        <h3 data-i18n="delete.title">Delete your account?</h3>
      </div>
      <p class="dialog-label" data-i18n="delete.body">Your account and this data will be permanently deleted:</p>
      <p id="delete-summary" class="delete-summary"></p>
      <p class="delete-warning" data-i18n="delete.warning">This cannot be undone.</p>
      <p id="delete-status" class="delete-status" hidden></p>
      <div class="delete-actions">
        <button class="btn-secondary" id="delete-cancel" data-i18n="delete.cancel">Cancel</button>
        <button class="btn-danger" id="delete-confirm" data-i18n="delete.confirm">Delete permanently</button>
      </div>
    </div>
  </div>
```

- [ ] **Step 6: Styles ergänzen**

An `style.css` anhängen:

```css
/* ===== Account deletion ===== */
#delete-modal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, .55);
  align-items: center;
  justify-content: center;
  padding: 16px;
}
#delete-modal.open { display: flex; }

.settings-delete { margin-top: 8px; }

.delete-summary {
  font-weight: 600;
  line-height: 1.5;
  margin: 4px 0 12px;
}

.delete-warning {
  color: #ef4444;
  font-weight: 600;
  margin-bottom: 12px;
}

.delete-status {
  margin: 0 0 12px;
  opacity: .85;
}

.delete-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.delete-actions button { min-width: 120px; }
```

- [ ] **Step 7: Styles prüfen**

Run: `npx --yes stylelint style.css --formatter compact 2>/dev/null || echo "stylelint nicht vorhanden, manuell pruefen"`
Expected: Keine Fehler, oder der Hinweistext. Bei fehlendem stylelint die neuen Regeln von Hand auf ausgeglichene Klammern prüfen.

- [ ] **Step 8: Commit**

```bash
git add js/i18n.js map.html style.css js/*.js *.html
git commit -m "Add account deletion strings, markup and styles"
```

---

### Task 6: Verdrahtung, Deploy und manueller Durchlauf

**Files:**
- Modify: `js/settings.js`
- Modify: `js/version.js` (`APP_VERSION`)
- Modify: `version.json`
- Modify: `privacy.html`

**Interfaces:**
- Consumes: `collectDeletionSummary`, `deleteAccount` aus Task 4, DOM-IDs aus Task 5
- Produces: nichts, letzte Aufgabe

- [ ] **Step 1: Imports in settings.js ergänzen**

In `js/settings.js` oben ergänzen:

```js
import { t } from './i18n.js?v=2';
import { collectDeletionSummary, deleteAccount } from './account.js?v=1';
import { auth } from './config.js?v=1';
```

Die bestehende Zeile `import { getLang, setLang } from './i18n.js?v=1';` auf `?v=2` ändern und `t` dort mit aufnehmen, statt zweimal aus derselben Datei zu importieren.

- [ ] **Step 2: Löschablauf verdrahten**

In `js/settings.js` innerhalb von `setupSettings`, hinter dem Sign-out-Handler einfügen:

```js
  // ===== Kontoloeschung =====
  const delModal   = document.getElementById('delete-modal');
  const delStatus  = document.getElementById('delete-status');
  const delConfirm = document.getElementById('delete-confirm');

  document.getElementById('settings-delete')?.addEventListener('click', async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || !delModal) return;
    // Echte Zahlen statt abstrakter Kategorien. Wer loescht, soll sehen was weg ist.
    const s = await collectDeletionSummary(uid);
    document.getElementById('delete-summary').textContent = t('delete.summary', s);
    delStatus.hidden = true;
    delConfirm.disabled = false;
    delModal.classList.add('open');
  });

  document.getElementById('delete-cancel')?.addEventListener('click', () => {
    delModal?.classList.remove('open');
  });

  delConfirm?.addEventListener('click', async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (!navigator.onLine) {
      delStatus.hidden = false;
      delStatus.textContent = t('delete.offline');
      return;
    }
    delConfirm.disabled = true;
    delStatus.hidden = false;
    delStatus.textContent = t('delete.working');
    try {
      await deleteAccount(uid);
      localStorage.removeItem('tm-theme');
      localStorage.removeItem('tm-lang');
      localStorage.removeItem('tm-has-session');
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Kontoloeschung fehlgeschlagen:', err);
      // Der Auth-Account existiert in jedem Fehlerfall noch, weil er zuletzt
      // faellt. Ein erneuter Versuch ist deshalb gefahrlos.
      delStatus.textContent = t('delete.failed');
      delConfirm.disabled = false;
    }
  });
```

- [ ] **Step 3: Cache-Buster von settings.js erhöhen**

Run: `grep -rn "settings.js?v=" js/ *.html`

Gefundene Versionen um eins erhöhen.

- [ ] **Step 4: Tests laufen lassen**

Run: `npm test`
Expected: PASS, 16 Tests. Die Verdrahtung hat keine eigenen Tests, sie darf die bestehenden aber nicht brechen.

- [ ] **Step 5: Hinweis in privacy.html anpassen**

Die Seite ist zweisprachig, beide Absätze müssen angepasst werden. Nebenbei fliegen die
Geviertstriche raus, die dort gegen die Stilregel verstoßen.

Deutscher Absatz (um Zeile 108) ersetzen:

```html
      <p>Dein Konto und alle zugehörigen Daten kannst du direkt in der App löschen,
      unter Einstellungen, Konto löschen. Die Löschung erfolgt sofort und lässt sich
      nicht rückgängig machen. Für alles Weitere, etwa eine Auskunft über gespeicherte
      Daten, schreib eine E-Mail an pesamarin81@gmail.com.</p>
```

Englischer Absatz (um Zeile 169) ersetzen:

```html
      <p>You can delete your account and all related data directly in the app under
      Settings, Delete account. Deletion happens immediately and cannot be undone.
      For anything else, such as a request for information about stored data, email
      pesamarin81@gmail.com.</p>
```

Run: `grep -c "—" privacy.html`
Expected: eine kleinere Zahl als vorher. Idealerweise `0`.

- [ ] **Step 6: Version erhöhen**

In `js/version.js`: `export const APP_VERSION = '1.2.0';`

In `version.json` dieselbe Versionsnummer eintragen.

Run: `cat version.json`
Expected: `1.2.0` steht drin. Bleiben die beiden Werte unterschiedlich, zeigt jeder laufende Client dauerhaft das Update-Modal.

- [ ] **Step 7: Security Rules veröffentlichen**

Run: `npx firebase-tools deploy --only firestore:rules --project travelmap-f4e3a`
Expected: Erfolgsmeldung.

**Das muss vor dem Hosting-Deploy passieren.** Ginge der Code zuerst live, würde jede Gruppen-Übergabe mit `permission-denied` scheitern.

- [ ] **Step 8: Lokal starten**

Run: `npx --yes serve . -l 5000`

Im Browser `http://localhost:5000/map.html` öffnen.

- [ ] **Step 9: Manueller Durchlauf mit zwei Testkonten**

Vorbereitung mit Konto A (wird gelöscht) und Konto B:

1. Mit A anmelden, zwei Städte und ein Land eintragen
2. B als Freund über den Invite-Link hinzufügen
3. Mit A eine Gruppe erstellen, B hinzufügen, mit A **eine Stadt in die Gruppe** eintragen
4. Mit B ebenfalls eine Stadt in dieselbe Gruppe eintragen

Dann als A: Einstellungen, Konto löschen. Prüfen:

- [ ] Die Zusammenfassung nennt die richtigen Zahlen
- [ ] Der Google-Popup erscheint
- [ ] Nach Abschluss landet man auf `index.html`
- [ ] Erneute Anmeldung mit A erzeugt ein leeres, frisches Konto
- [ ] Bei B ist A **nicht mehr** in der Freundesliste
- [ ] Die Gruppe existiert noch, B ist jetzt `created_by`
- [ ] As Stadt ist aus der Gruppe verschwunden, Bs Stadt ist noch da

- [ ] **Step 10: Firestore-Konsole gegenprüfen**

In der Firebase-Konsole prüfen, dass unter `users/{uidVonA}` **kein** Dokument und **keine** `friends`-Subcollection mehr liegt, und dass das Invite-Doc von A weg ist.

Verwaiste Subcollections sind in der Konsole an einer kursiv dargestellten Dokument-ID erkennbar. Taucht so etwas auf, lief Schritt 4 des Ablaufs nicht vor Schritt 6.

- [ ] **Step 11: Commit und Push**

```bash
git add js/settings.js js/version.js version.json privacy.html js/*.js *.html
git commit -m "Wire account deletion into settings and bump to 1.2.0"
git push -u origin feature/account-deletion
```

- [ ] **Step 12: Marin übergeben**

Kein Merge nach `main` und **kein** Hosting-Deploy ohne Marins Freigabe. Ihm melden:

- Was getestet wurde und mit welchen Konten
- Dass die Security Rules bereits veröffentlicht sind, der Code aber noch nicht live ist
- Die bekannte Einschränkung: Städte ohne `addedBy` aus der Zeit vor den personalisierten Pins bleiben in Gruppen stehen
