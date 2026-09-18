# TravelMap Offline Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TravelMap startet und funktioniert ohne Netzverbindung: Die App-Shell lädt, angemeldete Nutzer sehen ihre gespeicherten Städte und Länder, und die Oberfläche sagt ehrlich, was gerade nicht geht.

**Architecture:** Drei Schichten, strikt in dieser Reihenfolge. Erstens werden alle Fremdabhängigkeiten von fremden CDNs auf die eigene Domain geholt, weil ein Service Worker cross-origin nichts Verlässliches cachen kann. Zweitens übernimmt ein Service Worker mit versioniertem Cache die App-Shell und die Vendor-Dateien. Drittens bekommt Firestore eine IndexedDB-Persistenz, damit angemeldete Nutzer offline überhaupt Daten haben. Der bestehende Update-Mechanismus aus `js/version.js` wird auf den Service Worker umgestellt, statt neben ihm zu laufen.

**Tech Stack:** Vanilla ES-Module ohne Bundler, Firebase Web SDK 10.12.0 (ESM vom CDN, künftig selbst gehostet), Mapbox GL JS 3.4.0, Motion 12, Firebase Hosting, Vitest 2 mit Node-Environment und Stub-Aliases.

## Global Constraints

- **Kein Bundler, kein Build-Schritt.** Alles läuft als natives ES-Modul direkt im Browser. Jede Lösung, die npm-Auflösung zur Laufzeit braucht, ist ungültig.
- **Firebase-Version exakt `10.12.0`.** Genau die Version, die heute vom CDN geladen wird. Kein Upgrade in diesem Plan.
- **Mapbox GL JS exakt `3.4.0`**, Motion exakt die heute ausgelieferte `motion@12`-Fassung.
- **Cache-Busting-Konvention beibehalten:** Jeder App-eigene Import trägt `?v=N`. Wer eine Datei ändert, erhöht das `N` bei allen Importeuren.
- **`js/config.js` ist gitignored.** Jede Änderung daran muss identisch in `js/config.example.js` gespiegelt werden, sonst ist das Repo nach einem frischen Clone kaputt.
- **Service Worker als Modul-Worker** (`{ type: 'module' }`). Browser-Untergrenze damit Chrome 91+, Safari 16.4+, Firefox 114+. Das ist eine bewusste Entscheidung, siehe Task 6.
- **Mapbox-Tiles sind ausdrücklich NICHT Teil dieses Plans.** Siehe Abschnitt „Bewusst außen vor".
- Alle Commits auf dem Branch `feature/offline-support`, nie direkt auf `main`.

## Bewusst außen vor

**Mapbox-Tile-Caching.** Die Karte bleibt offline leer beziehungsweise zeigt nur das, was der Browser ohnehin zwischengespeichert hat. Grund: Ob das dauerhafte Zwischenspeichern von Mapbox-Tiles im Web-SDK lizenzrechtlich zulässig ist, ist ungeklärt. Für die Mobile-SDKs gibt es offizielle Offline-Unterstützung, für das Web ist die Lage anders. **Vor jeder Zeile Tile-Caching sind die aktuellen Mapbox-Nutzungsbedingungen zu prüfen.** Bis dahin behandelt der Service Worker `api.mapbox.com` und `events.mapbox.com` als reine Netz-Requests.

Das ist kein Verlust: Der Nutzwert offline liegt in „Ich sehe meine Liste und meine Daten", nicht in „Ich sehe Satellitenbilder von Kroatien".

---

## Ausgangslage (verifiziert am 05.08.2026)

| Befund | Beleg |
|---|---|
| Kein Service Worker vorhanden | keine `sw.js`, keine `serviceWorker`-Registrierung im Repo |
| Firestore ohne Persistenz | `js/config.js:17` → `getFirestore(app)` |
| Firebase kommt vom CDN | 11 Importzeilen in 7 Dateien auf `gstatic.com` |
| Mapbox kommt vom CDN | `map.html`, `mapbox-gl.js` + `.css` von `api.mapbox.com` |
| Motion kommt vom CDN | `js/anim.js:1` → `cdn.jsdelivr.net/npm/motion@12/+esm` |
| Update-Mechanismus existiert bereits | `js/version.js`, pollt `version.json` alle 15 Minuten |

**Zwei Fallen, die beim naiven Vorgehen zuschlagen:**

1. **Die Firebase-Dateien importieren sich gegenseitig über absolute URLs.** `firebase-auth.js` und `firebase-firestore.js` enthalten jeweils ein `import{...}from"https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"`. Wer die drei Dateien nur herunterlädt und lokal einbindet, hat weiterhin eine harte Netzabhängigkeit **innerhalb** der Vendor-Dateien. Die URL muss beim Vendoring umgeschrieben werden.

2. **`motion@12/+esm` ist ein 399-Byte-Stub.** Er re-exportiert aus `/npm/framer-motion@12.43.0/dom/+esm`, das wiederum aus `motion-dom` und `motion-utils` importiert. Diese Kette lokal nachzubauen ist ein Fass ohne Boden. Stattdessen wird `motion@12/dist/motion.js` verwendet: 139 KB, UMD, ohne externe Importe, exportiert global als `Motion`.

---

## File Structure

**Neu:**

| Datei | Verantwortung |
|---|---|
| `vendor/firebase/10.12.0/firebase-app.js` | Firebase-Kern, unverändert vom CDN |
| `vendor/firebase/10.12.0/firebase-auth.js` | Auth-SDK, interner Import auf relativ umgeschrieben |
| `vendor/firebase/10.12.0/firebase-firestore.js` | Firestore-SDK, interner Import auf relativ umgeschrieben |
| `vendor/mapbox-gl/3.4.0/mapbox-gl.js` | Mapbox GL JS, unverändert |
| `vendor/mapbox-gl/3.4.0/mapbox-gl.css` | Mapbox-Styles, unverändert |
| `vendor/motion/12/motion.js` | Motion UMD-Bundle, globales `Motion` |
| `js/app-version.js` | Einzige Quelle der Versionsnummer, von `version.js` **und** `sw.js` importiert |
| `js/sw-precache.js` | Liste der Dateien, die der Service Worker vorab cached |
| `js/sw-policy.js` | Reine Funktion `classifyRequest(url)`, entscheidet Cache-Strategie je Request |
| `js/net-status.js` | Reine Logik für den Online-/Offline-Zustand plus Event-Anbindung |
| `sw.js` | Der Service Worker selbst, im Wurzelverzeichnis (Scope!) |
| `tests/sw-precache.test.js` | Prüft, dass jede vorgemerkte Datei wirklich existiert |
| `tests/sw-policy.test.js` | Prüft die Routing-Entscheidungen |
| `tests/net-status.test.js` | Prüft die Zustandslogik |

**Geändert:**

| Datei | Änderung |
|---|---|
| `js/config.js` + `js/config.example.js` | Vendor-Importe, `initializeFirestore` mit Persistenz |
| `js/db.js`, `js/groups.js`, `js/friends.js`, `js/auth.js`, `js/account-io.js` | Importpfade auf `vendor/` |
| `js/anim.js` | Nutzt globales `Motion` statt CDN-Import |
| `js/version.js` | Versionskonstante ausgelagert, Update-Erkennung an den SW gekoppelt |
| `map.html`, `index.html` | Vendor-Skripte, SW-Registrierung, Offline-Banner-Markup |
| `js/i18n.js` | Neue Schlüssel für den Offline-Zustand |
| `js/ui.js` | Offline-Banner anzeigen und verstecken |
| `firebase.json` | Cache-Header für `/sw.js` |
| `vitest.config.js` | Aliases auf die neuen Vendor-Pfade |
| `css/style.css` | Styles für das Offline-Banner |

**Warum `sw.js` im Wurzelverzeichnis:** Der Scope eines Service Workers ist standardmäßig sein eigenes Verzeichnis. Aus `js/sw.js` heraus könnte er `index.html` und `map.html` nicht kontrollieren.

---

### Task 1: Firebase selbst hosten

**Files:**
- Create: `vendor/firebase/10.12.0/firebase-app.js`
- Create: `vendor/firebase/10.12.0/firebase-auth.js`
- Create: `vendor/firebase/10.12.0/firebase-firestore.js`
- Modify: `js/config.js`, `js/config.example.js`, `js/db.js`, `js/groups.js`, `js/friends.js`, `js/auth.js`, `js/account-io.js`
- Modify: `vitest.config.js`
- Test: bestehende Suite muss grün bleiben

**Interfaces:**
- Produces: Alle Firebase-Symbole (`initializeApp`, `getAuth`, `getFirestore`, `initializeFirestore`, `collection`, `doc`, …) stehen künftig unter `vendor/firebase/10.12.0/*.js` bereit. Kein Symbol ändert seinen Namen.

- [ ] **Schritt 1: Branch anlegen**

```bash
cd ~/Documents/Claude-Projects/TravelMap
git checkout main && git pull
git checkout -b feature/offline-support
```

- [ ] **Schritt 2: Die drei Dateien herunterladen**

```bash
mkdir -p vendor/firebase/10.12.0
for f in firebase-app firebase-auth firebase-firestore; do
  curl -sf "https://www.gstatic.com/firebasejs/10.12.0/$f.js" -o "vendor/firebase/10.12.0/$f.js"
done
ls -la vendor/firebase/10.12.0/
```

Erwartet: drei Dateien, ungefähr 102 KB, 151 KB und 437 KB.

- [ ] **Schritt 3: Die internen CDN-Importe umschreiben**

Das ist der Schritt, ohne den offline nichts funktioniert.

```bash
cd vendor/firebase/10.12.0
sed -i '' 's|https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js|./firebase-app.js|g' firebase-auth.js firebase-firestore.js
cd -
```

- [ ] **Schritt 4: Prüfen, dass keine Netzreferenz übrig ist**

```bash
grep -c "gstatic.com/firebasejs" vendor/firebase/10.12.0/*.js
```

Erwartet: `0` für alle drei Dateien. Steht dort etwas anderes als 0, ist Schritt 3 fehlgeschlagen und der Rest des Plans ist wirkungslos.

- [ ] **Schritt 5: Die 11 Importzeilen in der App umstellen**

Betroffen sind genau diese Stellen:

| Datei | Zeile | Modul |
|---|---|---|
| `js/config.js` | 1, 2, 3 | app, auth, firestore |
| `js/config.example.js` | 5, 6, 7 | app, auth, firestore |
| `js/db.js` | 4 | firestore |
| `js/groups.js` | 4 | firestore |
| `js/friends.js` | 3 | firestore |
| `js/account-io.js` | 7 | firestore |
| `js/auth.js` | 7 | auth |

Alle liegen in `js/`, der relative Pfad ist also einheitlich `../vendor/firebase/10.12.0/…`:

```bash
sed -i '' -E "s|https://www\.gstatic\.com/firebasejs/10\.12\.0/(firebase-[a-z]+\.js)|../vendor/firebase/10.12.0/\1|g" \
  js/config.js js/config.example.js js/db.js js/groups.js js/friends.js js/account-io.js js/auth.js
grep -rc "gstatic.com" js/ | grep -v ":0" || echo "keine gstatic-Referenz mehr in js/"
```

- [ ] **Schritt 6: Vitest-Aliases nachziehen**

Die bestehenden Aliases in `vitest.config.js` greifen auf `https://…`-URLs und laufen jetzt ins Leere. Ersetze den `alias`-Block durch:

```js
  resolve: {
    alias: [
      { find: /firebase-firestore\.js(\?v=\d+)?$/, replacement: stub('firebase-firestore.js') },
      { find: /firebase-auth\.js(\?v=\d+)?$/, replacement: stub('firebase-auth.js') },
      { find: /^\.\/config\.js(\?v=\d+)?$/, replacement: stub('config.js') }
    ]
  },
```

Der Kommentar darüber sollte ebenfalls angepasst werden, er spricht noch von CDN-URLs.

- [ ] **Schritt 7: Tests laufen lassen**

```bash
npm test
```

Erwartet: alle bisherigen Tests grün. Schlägt etwas fehl, greift ein Alias nicht.

- [ ] **Schritt 8: Im Browser gegenprüfen**

```bash
npx -y firebase-tools@latest serve --only hosting --port 5000
```

`http://localhost:5000` öffnen, Netzwerk-Tab aufmachen, filtern nach `gstatic`. Erwartet: **kein einziger Treffer**. Anmelden funktioniert weiterhin.

- [ ] **Schritt 9: Commit**

```bash
git add vendor/firebase js/*.js vitest.config.js
git commit -m "Self-host the Firebase SDK so offline has no CDN dependency"
```

---

### Task 2: Mapbox GL JS selbst hosten

**Files:**
- Create: `vendor/mapbox-gl/3.4.0/mapbox-gl.js`, `vendor/mapbox-gl/3.4.0/mapbox-gl.css`
- Modify: `map.html`

**Interfaces:**
- Produces: Globales `mapboxgl` wie bisher, unverändert in Verhalten und API.

- [ ] **Schritt 1: Dateien holen**

```bash
mkdir -p vendor/mapbox-gl/3.4.0
curl -sf "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"  -o vendor/mapbox-gl/3.4.0/mapbox-gl.js
curl -sf "https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" -o vendor/mapbox-gl/3.4.0/mapbox-gl.css
wc -c vendor/mapbox-gl/3.4.0/*
```

Erwartet: rund 1,36 MB für die JS-Datei.

- [ ] **Schritt 2: `map.html` umstellen**

Ersetze

```html
<link href="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.css" rel="stylesheet">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.4.0/mapbox-gl.js"></script>
```

durch

```html
<link href="vendor/mapbox-gl/3.4.0/mapbox-gl.css?v=1" rel="stylesheet">
<script src="vendor/mapbox-gl/3.4.0/mapbox-gl.js?v=1"></script>
```

- [ ] **Schritt 3: Prüfen**

Lokal servieren, `map.html` öffnen. Die Karte muss laden, Marker müssen erscheinen. Im Netzwerk-Tab darf `api.mapbox.com` nur noch für **Tiles und Styles** auftauchen, nicht mehr für das SDK selbst.

Wichtig: Mapbox GL erzeugt Web Worker. Prüfe in der Konsole, dass keine Worker-Fehler auftreten. Falls doch, setze vor der Karteninitialisierung `mapboxgl.workerUrl = 'vendor/mapbox-gl/3.4.0/mapbox-gl.js?v=1';`

- [ ] **Schritt 4: Commit**

```bash
git add vendor/mapbox-gl map.html
git commit -m "Self-host Mapbox GL JS and its stylesheet"
```

---

### Task 3: Motion selbst hosten

**Files:**
- Create: `vendor/motion/12/motion.js`
- Modify: `js/anim.js`, `map.html`

**Interfaces:**
- Consumes: nichts aus früheren Tasks.
- Produces: `js/anim.js` exportiert unverändert seine bisherigen Funktionen. Intern greift es auf das globale `Motion` zu.

- [ ] **Schritt 1: Das richtige Bundle holen**

**Nicht** `+esm` verwenden, das ist ein Stub mit einer dreistufigen Importkette. Das UMD-Bundle ist in sich geschlossen:

```bash
mkdir -p vendor/motion/12
curl -sf "https://cdn.jsdelivr.net/npm/motion@12/dist/motion.js" -o vendor/motion/12/motion.js
wc -c vendor/motion/12/motion.js
grep -c "cdn.jsdelivr.net" vendor/motion/12/motion.js
```

Erwartet: rund 140 KB, und `0` Treffer für jsdelivr.

- [ ] **Schritt 2: Skript in `map.html` einbinden**

Vor dem ersten Modul-Skript einfügen:

```html
<script src="vendor/motion/12/motion.js?v=1"></script>
```

Falls `index.html` ebenfalls animiert, dort ebenso. Mit `grep -n "anim.js" index.html map.html` prüfen, welche Seite `anim.js` überhaupt lädt.

- [ ] **Schritt 3: `js/anim.js` Zeile 1 ersetzen**

Alt:

```js
import { animate, stagger } from 'https://cdn.jsdelivr.net/npm/motion@12/+esm';
```

Neu:

```js
// Motion wird als UMD-Bundle per <script> geladen und liegt global vor.
// Grund: die +esm-Variante ist ein Stub mit einer dreistufigen CDN-Importkette,
// die sich nicht sinnvoll selbst hosten laesst.
const { animate, stagger } = globalThis.Motion ?? {};
```

- [ ] **Schritt 4: Absicherung ergänzen**

Direkt darunter:

```js
if (!animate) {
  console.warn('[anim] Motion nicht geladen, Animationen werden uebersprungen.');
}
```

Und in jeder Funktion, die `animate` aufruft, als erste Zeile:

```js
  if (!animate) return;
```

- [ ] **Schritt 5: Prüfen**

Seite öffnen, eine animierte Interaktion auslösen (Sidebar öffnen, Zähler). Konsole muss frei von Fehlern sein.

- [ ] **Schritt 6: Commit**

```bash
git add vendor/motion js/anim.js map.html index.html
git commit -m "Self-host Motion using the standalone UMD bundle"
```

---

### Task 4: Firestore-Persistenz aktivieren

**Files:**
- Modify: `js/config.js`, `js/config.example.js`
- Test: manuell, siehe Schritt 4

**Interfaces:**
- Consumes: `vendor/firebase/10.12.0/firebase-firestore.js` aus Task 1.
- Produces: `db` als Firestore-Instanz mit IndexedDB-Cache. Der Export-Name bleibt `db`, alle bestehenden Aufrufer bleiben unverändert.

- [ ] **Schritt 1: Import in `js/config.js` erweitern**

Alt (Zeile 3):

```js
import { getFirestore } from '../vendor/firebase/10.12.0/firebase-firestore.js';
```

Neu:

```js
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from '../vendor/firebase/10.12.0/firebase-firestore.js';
```

- [ ] **Schritt 2: Initialisierung ersetzen**

Alt (Zeile 17):

```js
export const db = getFirestore(app);
```

Neu:

```js
// IndexedDB-Cache statt reinem Speicher-Cache: Ohne das haben angemeldete
// Nutzer offline gar keine Daten, waehrend der Gastmodus ueber localStorage
// funktioniert. Der Multi-Tab-Manager erlaubt mehrere offene Tabs, ohne dass
// einer von ihnen den Cache verliert.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
```

**Wichtig:** `initializeFirestore` muss vor jedem `getFirestore`-Aufruf laufen. Prüfe mit `grep -rn "getFirestore" js/`, dass kein anderer Aufruf übrig ist.

- [ ] **Schritt 3: Dieselbe Änderung in `js/config.example.js`**

`js/config.example.js` ist die Vorlage für einen frischen Clone. Übernimm Import und Initialisierung eins zu eins, die Zeilennummern sind dort 7 und 20.

```bash
diff <(grep -A3 "initializeFirestore" js/config.js) <(grep -A3 "initializeFirestore" js/config.example.js) && echo "identisch"
```

- [ ] **Schritt 4: Persistenz im Browser nachweisen**

1. Lokal servieren, anmelden, ein paar Städte laden.
2. DevTools → Application → IndexedDB. Erwartet: eine Datenbank namens `firestore/[DEFAULT]/travelmap-f4e3a/main` oder ähnlich, **mit Inhalt**.
3. Zweiten Tab öffnen. Erwartet: keine Fehlermeldung über bereits belegte Persistenz. Genau das würde ohne den Multi-Tab-Manager passieren.

- [ ] **Schritt 5: Tests**

```bash
npm test
```

Erwartet: grün. Die Tests laufen gegen den Stub, die Änderung darf sie nicht berühren. Falls doch, muss `tests/stubs/firebase-firestore.js` um `initializeFirestore`, `persistentLocalCache` und `persistentMultipleTabManager` ergänzt werden.

- [ ] **Schritt 6: Commit**

```bash
git add js/config.js js/config.example.js tests/stubs/
git commit -m "Give Firestore an IndexedDB cache so signed-in users have offline data"
```

---

### Task 5: Versionskonstante auslagern

**Files:**
- Create: `js/app-version.js`
- Modify: `js/version.js`

**Interfaces:**
- Produces: `export const APP_VERSION` aus `js/app-version.js`. Wird ab Task 6 auch von `sw.js` importiert. Das ist der Grund für die Auslagerung: `sw.js` darf `version.js` nicht importieren, weil dort DOM-Code steht, den es im Worker-Kontext nicht gibt.

- [ ] **Schritt 1: Neue Datei anlegen**

```js
// js/app-version.js
// Einzige Quelle der Versionsnummer. Bewusst ohne jeden Import, damit sowohl
// der DOM-Code (js/version.js) als auch der Service Worker (sw.js) sie laden
// koennen. sw.js laeuft ohne DOM und darf version.js deshalb nicht anfassen.
// Bei jedem Release zusammen mit version.json erhoehen.
export const APP_VERSION = '1.2.0';
```

- [ ] **Schritt 2: `js/version.js` umstellen**

Alt:

```js
export const APP_VERSION = '1.2.0';
```

Neu:

```js
import { APP_VERSION } from './app-version.js?v=1';
export { APP_VERSION };
```

- [ ] **Schritt 3: Prüfen, dass die Versionsanzeige weiterhin stimmt**

Seite öffnen, Einstellungen öffnen. Dort muss weiterhin `1.2.0` stehen.

- [ ] **Schritt 4: Commit**

```bash
git add js/app-version.js js/version.js
git commit -m "Extract APP_VERSION so the service worker can read it too"
```

---

### Task 6: Service Worker mit versioniertem Cache

**Files:**
- Create: `js/sw-precache.js`, `js/sw-policy.js`, `sw.js`
- Create: `tests/sw-precache.test.js`, `tests/sw-policy.test.js`
- Modify: `firebase.json`

**Interfaces:**
- Consumes: `APP_VERSION` aus `js/app-version.js` (Task 5).
- Produces:
  - `js/sw-precache.js` → `export const PRECACHE: string[]`
  - `js/sw-policy.js` → `export function classifyRequest(url: string): 'precache' | 'network-only' | 'network-first'`

- [ ] **Schritt 1: Den fehlschlagenden Test für die Routing-Logik schreiben**

```js
// tests/sw-policy.test.js
import { describe, it, expect } from 'vitest';
import { classifyRequest } from '../js/sw-policy.js';

describe('classifyRequest', () => {
  it('behandelt eigene Assets als Cache-Kandidaten', () => {
    expect(classifyRequest('https://travel.marinpesa.dev/js/app.js?v=3')).toBe('precache');
    expect(classifyRequest('https://travel.marinpesa.dev/vendor/firebase/10.12.0/firebase-app.js')).toBe('precache');
    expect(classifyRequest('https://travel.marinpesa.dev/css/style.css?v=14')).toBe('precache');
  });

  it('laesst Firestore und Auth immer ans Netz', () => {
    expect(classifyRequest('https://firestore.googleapis.com/v1/projects/travelmap-f4e3a/databases/(default)/documents/users/abc')).toBe('network-only');
    expect(classifyRequest('https://identitytoolkit.googleapis.com/v1/accounts:lookup')).toBe('network-only');
    expect(classifyRequest('https://securetoken.googleapis.com/v1/token')).toBe('network-only');
  });

  it('laesst Mapbox ans Netz, weil Tile-Caching lizenzrechtlich ungeklaert ist', () => {
    expect(classifyRequest('https://api.mapbox.com/styles/v1/mapbox/dark-v11')).toBe('network-only');
    expect(classifyRequest('https://events.mapbox.com/events/v2')).toBe('network-only');
  });

  it('holt version.json bevorzugt aus dem Netz', () => {
    expect(classifyRequest('https://travel.marinpesa.dev/version.json?ts=123')).toBe('network-first');
  });

  it('behandelt HTML als network-first, damit ein Deploy sofort greift', () => {
    expect(classifyRequest('https://travel.marinpesa.dev/map.html')).toBe('network-first');
    expect(classifyRequest('https://travel.marinpesa.dev/')).toBe('network-first');
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/sw-policy.test.js
```

Erwartet: FAIL, `Failed to resolve import "../js/sw-policy.js"`.

- [ ] **Schritt 3: `js/sw-policy.js` schreiben**

```js
// js/sw-policy.js
// Reine Entscheidungslogik, bewusst ohne Zugriff auf caches oder fetch,
// damit sie in Node testbar ist. sw.js setzt die Entscheidung nur um.

const NETWORK_ONLY_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.googleapis.com',
  'apis.google.com',
  'accounts.google.com',
  // Mapbox bleibt bewusst ungecacht: Tile-Caching ist lizenzrechtlich
  // ungeklaert, siehe Implementierungsplan.
  'api.mapbox.com',
  'events.mapbox.com'
];

/**
 * @param {string} url absolute Request-URL
 * @returns {'precache'|'network-only'|'network-first'}
 */
export function classifyRequest(url) {
  const u = new URL(url);

  if (NETWORK_ONLY_HOSTS.includes(u.hostname)) return 'network-only';

  const path = u.pathname;
  if (path === '/' || path.endsWith('.html')) return 'network-first';
  if (path.endsWith('/version.json')) return 'network-first';

  return 'precache';
}
```

- [ ] **Schritt 4: Test erneut laufen lassen**

```bash
npx vitest run tests/sw-policy.test.js
```

Erwartet: PASS, 5 Tests.

- [ ] **Schritt 5: Den fehlschlagenden Test für die Precache-Liste schreiben**

Dieser Test fängt genau den Fehler, der einen Service Worker sonst still kaputt macht: einen Tippfehler im Pfad.

```js
// tests/sw-precache.test.js
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PRECACHE } from '../js/sw-precache.js';

const root = fileURLToPath(new URL('..', import.meta.url));

describe('PRECACHE', () => {
  it('ist nicht leer', () => {
    expect(PRECACHE.length).toBeGreaterThan(5);
  });

  it('enthaelt keine Duplikate', () => {
    expect(new Set(PRECACHE).size).toBe(PRECACHE.length);
  });

  it('listet nur Dateien, die es wirklich gibt', () => {
    const fehlend = PRECACHE
      .map(p => p.split('?')[0])
      .filter(p => !existsSync(root + p.replace(/^\.\//, '')));
    expect(fehlend).toEqual([]);
  });

  it('enthaelt die Vendor-Abhaengigkeiten', () => {
    const joined = PRECACHE.join(' ');
    expect(joined).toContain('vendor/firebase');
    expect(joined).toContain('vendor/mapbox-gl');
    expect(joined).toContain('vendor/motion');
  });
});
```

- [ ] **Schritt 6: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/sw-precache.test.js
```

Erwartet: FAIL, Modul nicht auflösbar.

- [ ] **Schritt 7: `js/sw-precache.js` schreiben**

Die Liste muss den tatsächlichen Dateibestand widerspiegeln. Ermittle ihn zuerst:

```bash
ls js/*.js | sed 's|^|./|'
ls css/*.css | sed 's|^|./|'
ls icons/* | sed 's|^|./|'
```

Dann die Datei anlegen. Query-Strings bewusst weglassen, der Service Worker matcht mit `ignoreSearch`:

```js
// js/sw-precache.js
// Alles, was die App zum Starten braucht. Ohne Query-String: der Service
// Worker vergleicht mit ignoreSearch, damit ein ?v=-Bump keinen Cache-Miss
// erzeugt. Die Cache-Version haengt an APP_VERSION, alte Caches werden beim
// Aktivieren geloescht.
export const PRECACHE = [
  './',
  './index.html',
  './map.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/app-version.js',
  './js/anim.js',
  './js/auth.js',
  './js/account.js',
  './js/account-io.js',
  './js/account-logic.js',
  './js/config.js',
  './js/consent.js',
  './js/constants.js',
  './js/countries.js',
  './js/db.js',
  './js/friends.js',
  './js/groups.js',
  './js/i18n.js',
  './js/map.js',
  './js/markers.js',
  './js/settings.js',
  './js/sw-policy.js',
  './js/sw-precache.js',
  './js/theme.js',
  './js/ui.js',
  './js/version.js',
  './vendor/firebase/10.12.0/firebase-app.js',
  './vendor/firebase/10.12.0/firebase-auth.js',
  './vendor/firebase/10.12.0/firebase-firestore.js',
  './vendor/mapbox-gl/3.4.0/mapbox-gl.js',
  './vendor/mapbox-gl/3.4.0/mapbox-gl.css',
  './vendor/motion/12/motion.js'
];
```

**Passe die Liste an den echten Bestand an.** Fehlt eine Datei auf der Platte, schlägt der Test fehl und nennt sie beim Namen. Ergänze außerdem die Icons, die `manifest.webmanifest` referenziert.

- [ ] **Schritt 8: Test erneut laufen lassen**

```bash
npx vitest run tests/sw-precache.test.js
```

Erwartet: PASS, 4 Tests. Bei Fehlschlag zeigt `fehlend` genau die falschen Pfade.

- [ ] **Schritt 9: `sw.js` schreiben**

```js
// sw.js  — Modul-Service-Worker, liegt im Wurzelverzeichnis wegen des Scopes.
import { APP_VERSION } from './js/app-version.js';
import { PRECACHE } from './js/sw-precache.js';
import { classifyRequest } from './js/sw-policy.js';

const CACHE = `travelmap-v${APP_VERSION}`;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Einzeln statt addAll: addAll bricht komplett ab, wenn eine einzige
    // Datei fehlt. Lieber ein unvollstaendiger Cache als gar keiner.
    await Promise.all(PRECACHE.map(async url => {
      try { await cache.add(new Request(url, { cache: 'reload' })); }
      catch (e) { console.warn('[sw] nicht cachebar:', url, e); }
    }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  // Wird vom Update-Dialog ausgeloest, siehe Task 7.
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const mode = classifyRequest(req.url);
  if (mode === 'network-only') return;

  if (mode === 'network-first') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        // Letzter Ausweg: die Startseite, damit der Nutzer nicht auf der
        // Browser-Fehlerseite landet.
        return (await caches.match('./index.html', { ignoreSearch: true }))
          ?? Response.error();
      }
    })());
    return;
  }

  // precache: erst Cache, dann Netz
  event.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      return Response.error();
    }
  })());
});
```

- [ ] **Schritt 10: Cache-Header für `sw.js` setzen**

**Das ist der wichtigste Konfigurationsschritt des ganzen Plans.** In `firebase.json` greift die Regel `**/*.@(js|css|geojson)` mit `max-age=31536000, immutable`. Ohne Gegenmaßnahme würde der Service Worker selbst ein Jahr lang gecacht, und du könntest ihn **nie wieder aktualisieren**.

Und es betrifft nicht nur `sw.js` selbst: Ein Modul-Service-Worker importiert `js/app-version.js`, `js/sw-precache.js` und `js/sw-policy.js` statisch. Auch diese drei Dateien fallen unter die `immutable`-Regel. Wären sie ein Jahr eingefroren, würde eine geänderte Precache-Liste nie greifen, obwohl `sw.js` selbst neu geladen wird.

Füge im `headers`-Array **als allerersten Eintrag** ein:

```json
      {
        "source": "/sw.js",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache, must-revalidate" }
        ]
      },
      {
        "source": "/js/@(sw-policy|sw-precache|app-version).js",
        "headers": [
          { "key": "Cache-Control", "value": "no-cache, must-revalidate" }
        ]
      },
```

Firebase Hosting wertet die Regeln in Reihenfolge aus, deshalb müssen diese beiden **vor** der `**/*.@(js|css|geojson)`-Regel stehen.

- [ ] **Schritt 11: Gesamte Suite laufen lassen**

```bash
npm test
```

Erwartet: alle Tests grün, inklusive der neun neuen.

- [ ] **Schritt 12: Commit**

```bash
git add sw.js js/sw-policy.js js/sw-precache.js tests/sw-policy.test.js tests/sw-precache.test.js firebase.json
git commit -m "Add a versioned service worker with tested routing rules"
```

---

### Task 7: Registrierung und Update-Pfad

**Files:**
- Modify: `index.html`, `map.html`, `js/version.js`

**Interfaces:**
- Consumes: `sw.js` aus Task 6.
- Produces: Ein registrierter Service Worker plus ein Update-Dialog, der auf `waiting` reagiert statt auf einen Poll.

- [ ] **Schritt 1: Registrierung in beide HTML-Dateien einfügen**

Ans Ende des bestehenden Modul-Skripts, in `index.html` **und** `map.html`:

```html
<script type="module">
  // Modul-Service-Worker: Chrome 91+, Safari 16.4+, Firefox 114+.
  // Faellt die Registrierung durch, laeuft die App wie bisher weiter,
  // nur eben ohne Offline-Faehigkeit.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js', { type: 'module' });
        reg.addEventListener('updatefound', () => {
          const neu = reg.installing;
          if (!neu) return;
          neu.addEventListener('statechange', () => {
            if (neu.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('tm:update-ready'));
            }
          });
        });
      } catch (e) {
        console.warn('[sw] Registrierung fehlgeschlagen:', e);
      }
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
  }
</script>
```

- [ ] **Schritt 2: `js/version.js` an das Ereignis koppeln**

Die 15-Minuten-Abfrage bleibt als Rückfallebene für Browser ohne Service Worker. Ergänze in `startUpdateCheck()`:

```js
  // Mit Service Worker ist der zuverlaessigere Ausloeser der wartende Worker.
  window.addEventListener('tm:update-ready', _showBanner);
```

Und im Klick-Handler des Buttons `location.reload()` ersetzen durch:

```js
  btn.addEventListener('click', async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.waiting) {
      // Der controllerchange-Listener laedt die Seite danach selbst neu.
      reg.waiting.postMessage('SKIP_WAITING');
    } else {
      location.reload();
    }
  });
```

- [ ] **Schritt 3: Den Kommentar in `js/version.js` korrigieren**

Ganz oben steht heute „There is no service worker". Das stimmt ab jetzt nicht mehr. Ersetze den Absatz durch eine Beschreibung des neuen Ablaufs, sonst führt er den nächsten Leser in die Irre.

- [ ] **Schritt 4: Registrierung prüfen**

Lokal servieren, Seite öffnen. DevTools → Application → Service Workers. Erwartet: `sw.js` mit Status `activated and is running`. Unter Cache Storage muss `travelmap-v1.2.0` mit allen Precache-Einträgen liegen.

- [ ] **Schritt 5: Update-Pfad prüfen**

1. `js/app-version.js` auf `1.2.1` setzen, `version.json` ebenso.
2. Seite neu laden. Erwartet: Update-Dialog erscheint.
3. Auf „Neu laden" klicken. Erwartet: Seite lädt neu, Cache Storage enthält jetzt `travelmap-v1.2.1`, der alte Cache ist weg.
4. Beide Versionsnummern wieder auf `1.2.0` zurücksetzen.

- [ ] **Schritt 6: Commit**

```bash
git add index.html map.html js/version.js
git commit -m "Register the service worker and drive updates from its waiting state"
```

---

### Task 8: Ehrlicher Offline-Zustand in der UI

**Files:**
- Create: `js/net-status.js`, `tests/net-status.test.js`
- Modify: `js/i18n.js`, `js/ui.js`, `css/style.css`, `map.html`
- Modify: `js/app.js`, `js/consent.js`, `js/settings.js`, `index.html` (nur `?v=`-Bump)

**Interfaces:**
- Produces: `js/net-status.js` → `export function offlineMessageKey(online, signedIn)` und `export function watchNetwork(onChange)`.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

```js
// tests/net-status.test.js
import { describe, it, expect } from 'vitest';
import { offlineMessageKey } from '../js/net-status.js';

describe('offlineMessageKey', () => {
  it('gibt online nichts zurueck', () => {
    expect(offlineMessageKey(true, true)).toBe(null);
    expect(offlineMessageKey(true, false)).toBe(null);
  });

  it('sagt angemeldeten Nutzern, dass gespeicherte Daten sichtbar bleiben', () => {
    expect(offlineMessageKey(false, true)).toBe('offline.signedIn');
  });

  it('sagt Gaesten, dass ohne Netz nichts geladen wird', () => {
    expect(offlineMessageKey(false, false)).toBe('offline.guest');
  });
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
npx vitest run tests/net-status.test.js
```

Erwartet: FAIL, Modul nicht auflösbar.

- [ ] **Schritt 3: `js/net-status.js` schreiben**

```js
// js/net-status.js
// Die Entscheidung, WAS angezeigt wird, ist eine reine Funktion und damit
// testbar. Das Anbinden an die Browser-Ereignisse steht getrennt darunter.

/**
 * @param {boolean} online
 * @param {boolean} signedIn
 * @returns {string|null} i18n-Schluessel oder null, wenn nichts zu melden ist
 */
export function offlineMessageKey(online, signedIn) {
  if (online) return null;
  return signedIn ? 'offline.signedIn' : 'offline.guest';
}

/**
 * Ruft onChange sofort mit dem aktuellen Zustand auf und danach bei jedem
 * Wechsel. navigator.onLine luegt bekanntlich in eine Richtung: true heisst
 * nur "es gibt eine Netzwerkschnittstelle", nicht "das Internet ist da".
 * Fuer die Anzeige reicht das, echte Fehler faengt der Firestore-Aufruf.
 */
export function watchNetwork(onChange) {
  const melde = () => onChange(navigator.onLine);
  window.addEventListener('online', melde);
  window.addEventListener('offline', melde);
  melde();
  return () => {
    window.removeEventListener('online', melde);
    window.removeEventListener('offline', melde);
  };
}
```

- [ ] **Schritt 4: Test erneut laufen lassen**

```bash
npx vitest run tests/net-status.test.js
```

Erwartet: PASS, 3 Tests.

- [ ] **Schritt 5: i18n-Schlüssel ergänzen**

In `js/i18n.js` in **allen** vorhandenen Sprachblöcken (mindestens Deutsch und Englisch) ergänzen:

```js
  'offline.signedIn': 'Kein Netz. Du siehst deine gespeicherten Daten, Änderungen werden später synchronisiert.',
  'offline.guest': 'Kein Netz. Melde dich an oder verbinde dich, um deine Karte zu laden.',
```

Englisch:

```js
  'offline.signedIn': 'No connection. You are seeing your saved data, changes will sync later.',
  'offline.guest': 'No connection. Sign in or reconnect to load your map.',
```

- [ ] **Schritt 6: `?v=` bei allen i18n-Importeuren erhöhen**

Neue Schlüssel wirken nur, wenn die Datei neu geladen wird. Betroffen sind sechs Stellen:

```bash
sed -i '' "s|i18n.js?v=2|i18n.js?v=3|g" js/ui.js js/version.js js/consent.js js/settings.js js/app.js index.html
grep -rn "i18n.js?v=" js *.html
```

Erwartet: überall `?v=3`, keine `?v=2` mehr.

- [ ] **Schritt 7: Banner-Markup in `map.html` einfügen**

Direkt nach dem öffnenden `<body>`:

```html
<div id="offline-banner" class="offline-banner" hidden role="status" aria-live="polite"></div>
```

- [ ] **Schritt 8: Styles ergänzen**

In `css/style.css`:

```css
/* Offline-Hinweis: bewusst oben und nicht wegklickbar, solange der Zustand
   anhaelt. Ein Nutzer, der nicht weiss dass er offline ist, haelt die App
   fuer kaputt. */
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  text-align: center;
  background: #8a6d1f;
  color: #fff;
}
.offline-banner[hidden] { display: none; }
```

- [ ] **Schritt 9: In `js/ui.js` anbinden**

```js
import { offlineMessageKey, watchNetwork } from './net-status.js?v=1';

// Aufruf einmal beim Start, nachdem der Auth-Zustand bekannt ist.
export function initOfflineBanner(getSignedIn) {
  const el = document.getElementById('offline-banner');
  if (!el) return;
  watchNetwork(online => {
    const key = offlineMessageKey(online, getSignedIn());
    if (!key) { el.hidden = true; return; }
    el.textContent = t(key);
    el.hidden = false;
  });
}
```

`t` ist die bestehende Übersetzungsfunktion aus `i18n.js`. Prüfe mit `grep -n "export function t" js/i18n.js`, wie sie tatsächlich heißt, und passe den Aufruf an.

- [ ] **Schritt 10: Aufruf in `js/app.js` ergänzen**

Nach der Auth-Initialisierung:

```js
  initOfflineBanner(() => Boolean(auth.currentUser));
```

- [ ] **Schritt 11: `?v=` für die geänderten Module erhöhen**

`ui.js` und `app.js` haben sich geändert. Erhöhe deren `?v=` bei allen Importeuren:

```bash
grep -rn "ui.js?v=\|app.js?v=" js *.html
```

Jede gefundene Zahl um eins erhöhen.

- [ ] **Schritt 12: Prüfen**

Lokal servieren, DevTools → Network → Throttling auf „Offline". Erwartet: Banner erscheint innerhalb einer Sekunde mit dem passenden Text. Zurück auf „No throttling": Banner verschwindet.

- [ ] **Schritt 13: Gesamte Suite und Commit**

```bash
npm test
git add js/net-status.js tests/net-status.test.js js/i18n.js js/ui.js js/app.js css/style.css map.html index.html js/consent.js js/settings.js js/version.js
git commit -m "Tell the user when the app is offline instead of failing silently"
```

---

### Task 9: Der eigentliche Beweis, echter Flugmodus-Test

Kein Code. Dieser Task ist der Grund, warum die anderen acht existieren. Er wird **auf dem iPhone** durchgeführt, nicht im DevTools-Offline-Modus, weil der Browser dort weiterhin aus seinem eigenen HTTP-Cache bedient und ein zu freundliches Bild zeichnet.

- [ ] **Schritt 1: Auf einen Testkanal deployen**

```bash
npx -y firebase-tools@latest hosting:channel:deploy offline-test --expires 7d
```

Der Befehl gibt eine Vorschau-URL aus. Diese benutzen, nicht die Produktivdomain.

- [ ] **Schritt 2: Header prüfen, bevor irgendetwas anderes getestet wird**

```bash
curl -sI "<vorschau-url>/sw.js" | grep -i cache-control
```

Erwartet: `no-cache, must-revalidate`. Steht dort `immutable`, ist Task 6 Schritt 10 nicht angekommen. **Dann sofort abbrechen und korrigieren**, ein mit `immutable` ausgelieferter Service Worker ist auf fremden Geräten praktisch nicht mehr zu ersetzen.

Dieselbe Prüfung für die drei Module, die der Service Worker importiert:

```bash
for f in js/sw-policy.js js/sw-precache.js js/app-version.js; do
  echo -n "$f -> "; curl -sI "<vorschau-url>/$f" | grep -i cache-control
done
```

Erwartet: dreimal `no-cache`. Steht dort `immutable`, greift eine geänderte Precache-Liste später nie.

- [ ] **Schritt 3: Am iPhone vorbereiten**

1. Vorschau-URL in Safari öffnen, anmelden.
2. Warten, bis die Karte und die eigenen Städte geladen sind.
3. Seite einmal neu laden, damit der Service Worker sicher aktiv ist.

- [ ] **Schritt 4: Flugmodus an, dann prüfen**

| Prüfung | Erwartung |
|---|---|
| App über den Homescreen oder Safari öffnen | Die Seite lädt, keine Browser-Fehlerseite |
| Offline-Banner | sichtbar, Text für angemeldete Nutzer |
| Eigene Städte und Länder | sichtbar, aus dem IndexedDB-Cache |
| Karte | bleibt leer oder grau, **das ist erwartet** |
| Einstellungen öffnen | funktioniert, Version wird angezeigt |
| Eine Stadt hinzufügen | Geocoding schlägt fehl, muss sauber abgefangen sein und nicht die Oberfläche einfrieren |

- [ ] **Schritt 5: Flugmodus aus, Synchronisierung prüfen**

Banner muss verschwinden. Falls im Flugmodus eine Änderung möglich war, muss sie jetzt in Firestore ankommen. In der Firebase-Konsole gegenprüfen.

- [ ] **Schritt 6: Ergebnis festhalten**

Ergebnis in `02 Projekte/01 Programmieren/TravelMap/TravelMap.md` im Vault eintragen, mit den Punkten, die durchgefallen sind. Bei Fehlschlägen: **kein Merge nach `main`.**

- [ ] **Schritt 7: Erst nach bestandenem Test mergen**

```bash
git checkout main
git merge --no-ff feature/offline-support
git push
npx -y firebase-tools@latest deploy --only hosting
```

Danach live gegenprüfen:

```bash
curl -s https://travel.marinpesa.dev/version.json
curl -sI https://travel.marinpesa.dev/sw.js | grep -i cache-control
```

- [ ] **Schritt 8: Branch aufräumen**

```bash
git branch -d feature/offline-support
```

---

## Was danach immer noch offen ist

- **Mapbox-Tiles offline.** Erst die Lizenzfrage klären, dann als eigener Plan.
- **Hintergrund-Synchronisierung** über die Background Sync API. Firestore erledigt das Nachschieben bereits selbst, solange der Tab lebt. Ein echter Background Sync wäre nur für „App geschlossen, dann wieder online" nötig.
- **Der Gastmodus** läuft über localStorage und war nie das Problem. Er bleibt unverändert.
