# TravelMap: Offline-Karte, Startzeit, Avatare, Kontoverknüpfung

Stand: 05.11.2026. Analyse und Lösungskonzept, noch keine Umsetzung.

Rahmen: TravelMap läuft nur noch als iOS-App (Capacitor-Shell, Web-Code aus dem Bundle). Die PWA existiert nicht mehr. Es gibt keinen eigenen Server: Daten liegen in Firestore, die Karte kommt von Mapbox, Avatare von Google. Alles, was unten "Backend" heißt, ist Firebase.

---

## Problem 1: Avatare zeigen das blaue "?"-Icon

### Befund

Freunde und Gruppenmitglieder werden als `<img src="https://lh3.googleusercontent.com/...">` ohne Fehlerbehandlung gerendert (`js/ui.js:519-521`, `js/ui.js:680-682`, Gruppen-Pin in `js/markers.js`). Ohne Netz, bei schwachem Netz oder wenn Google mit 429 antwortet, zeigt WKWebView das Broken-Image-Icon. Nutzer ohne `avatar_url` bekommen ein 👤, Nutzer mit kaputter URL gar nichts Brauchbares.

### Lösung

1. Eine Funktion `avatarEl({ name, url, uid })` in `js/ui.js` ersetzt die drei Inline-Markups.
2. Der Platzhalter wird immer zuerst gerendert: runder Kreis, Initialen, Hintergrundfarbe aus einem Hash der `uid` (stabil pro Person, aus einer Palette von 8 Farben).
3. Initialen: erster Buchstabe des ersten Wortes plus erster Buchstabe des letzten Wortes ("Christian Göhner" → "CG", "Martina" → "M"). Ohne Namen "?". Umlaute und Emojis vorher normalisieren.
4. Liegt eine URL vor, wird ein `<img>` über den Platzhalter gelegt. `onload` blendet das Bild ein, `onerror` entfernt es wieder. Der Platzhalter bleibt darunter, es flackert nichts.
5. Offline-Cache: einmal erfolgreich geladene Avatare werden als Blob in IndexedDB abgelegt (Key `uid`, Ablauf 30 Tage). Beim nächsten Start kommt das Bild von dort, auch ohne Netz.
6. Dieselbe Funktion für Freundesliste, Gruppenmitglieder, Gruppen-Pins auf der Karte und das eigene Profilbild oben rechts.

### Aufwand

Klein. Ein Modul, drei Aufrufstellen, CSS für den Kreis. Cache optional als zweiter Schritt.

---

## Problem 2: App startet langsam, bei schlechtem Netz gar nicht

### Befund

Die Startkette in `js/app.js:187-260` ist vollständig seriell:

| Schritt | Stelle | Problem bei schwachem Netz |
|---|---|---|
| `onAuthStateChanged` | `js/auth.js:91` | ok, Session liegt in IndexedDB |
| `loadUserData` → `getDoc` | `js/db.js:76` | Geht zuerst zum Server. Der Cache wird erst benutzt, wenn Firestore sich nach ca. 10 s als offline einstuft. Bei langsamer, aber lebender Verbindung hängt es länger. |
| `initUserProfile` → zweiter `getDoc` | `js/db.js:99` | Gleicher Roundtrip ein zweites Mal, dazu eventuell Schreibzugriffe. |
| `_handleInviteToken` | `js/app.js:225` | Meist ohne Token, aber in der Kette. |
| `initMap` wartet auf `load` | `js/map.js:22-27` | `load` feuert erst nach Style-JSON, Sprite, Glyphen und der ersten vollständigen Kachelrunde. Kein Timeout. Der Fehler-Handler löst bei jedem beliebigen Fehler auf, auch bei einem einzelnen Kachel-Request. |
| Splash | `js/app.js:95-107` | `SPLASH_MIN_MS = 2600` ist reine Wartezeit, auch wenn alles fertig ist. Notausgang nach 8 s. |
| Start-Watchdog | `js/app.js:113-136` | Ist die Karte nach 10 s nicht da und `navigator.onLine` ist true, lädt die Seite neu. Bei schwachem Empfang ist `onLine` immer true. Der Reload bricht alle laufenden Requests ab und verdoppelt die Wartezeit. |
| Style-Retry | `js/app.js:891-896` | `reloadMapStyle` läuft nur beim Wechsel von offline auf online. Bei durchgehend schwachem Netz scheitert der Style einmal und wird nie wieder versucht. |

Hinzu kommt: Mapbox cacht Style, Sprite und Glyphen nicht dauerhaft. Jeder Kaltstart lädt sie neu von `api.mapbox.com`.

### Lösung

1. **Messen.** `performance.mark()` an jedem Schritt, Ausgabe im Debug-Log, Test auf dem Gerät mit Xcode Network Link Conditioner (Profil "3G" und "Very Bad Network"). Erst mit Zahlen wird priorisiert.
2. **Nutzerdaten cache-first.** Die beiden `getDoc` durch einen `onSnapshot` mit `includeMetadataChanges: true` ersetzen. Der erste Emit kommt sofort aus IndexedDB, Liste und Pins stehen in unter einer Sekunde. Der Server-Stand kommt nach, der Listener `subscribeUserData` existiert ohnehin. Die Profil-Schreibzugriffe aus `initUserProfile` laufen danach im Hintergrund und nur bei Abweichung.
3. **Karte parallel starten.** `initMap()` sofort beim Modulstart, nicht nach Auth und Firestore. Der Mapbox-Token hängt nicht am Nutzer. Marker lassen sich vor `load` setzen.
4. **Nicht auf `load` warten.** `initMap` löst bei `style.load` auf oder nach 3 s per Timeout. Die Karte rendert im Hintergrund weiter. Der Fehler-Handler reagiert nur auf Style-Fehler (`e.error` und `e.sourceId` prüfen), nicht auf jeden Kachel-Fehler.
5. **Style-Retry mit Backoff.** Scheitert der Style, wird er nach 2, 4, 8, 16 s erneut geladen, unabhängig vom `online`-Event. Nach dem Umbau auf MapLibre (Problem 3) entfällt das weitgehend, weil die Basiskarte lokal liegt.
6. **Splash** auf 800 ms Mindestzeit senken oder an "erste Pins sichtbar" koppeln.
7. **Watchdog ohne Reload.** Pro Schritt ein eigener Timeout mit sinnvollem Fallback: Firestore → Cache, Karte → leere Karte mit Hinweis, Auth → Login-Seite. Der Reload bleibt nur für den Fall "Auth meldet sich nach 15 s gar nicht".
8. **Nachrangiges verschieben.** Freunde- und Gruppen-Listener, Update-Check, `places.json` (3,1 MB JSON, wird beim ersten Suchaufruf geladen, das ist bereits richtig) erst nach dem ersten Render starten.
9. **Sichtbarer Kartenzustand.** Solange der Style fehlt, liegt über der Karte ein halbtransparenter Hinweis: "Karte lädt" bzw. "Karte braucht Verbindung" mit Button "Erneut versuchen". Der Toast `toast.offlineMap` existiert in `js/i18n.js`, wird beim Start aber nicht gezeigt.

### Erwartung

Bei schwachem Netz: Liste und Pins nach etwa 1 s aus dem Cache, Karte kommt nach, sobald das Netz liefert. Heute: 10 s, Reload, nochmal 10 s, dann schwarze Karte.

---

## Problem 3: Karte offline schwarz

### Befund

Styles `dark-v11` und `light-v11` sowie alle Kacheln kommen bei jedem Start von `api.mapbox.com` (`js/theme.js:3-6`, `js/map.js:10`). Die Mapbox-Nutzungsbedingungen verbieten dauerhaftes Zwischenspeichern von Web-Kacheln. Offline-Pakete gibt es nur im nativen Mapbox-iOS-SDK, das zu einer WebView-App nicht passt. Mit Mapbox GL JS gibt es keinen sauberen Offline-Weg. Der Offline-Plan vom 06.08.2026 hat Tile-Caching aus diesem Grund ausgeklammert.

### Optionen

| Option | Offline | Aufwand | Laufende Kosten | Bewertung |
|---|---|---|---|---|
| A: Mapbox behalten, nur Fehlerbild verbessern | nein | klein | wie heute | löst das Problem nicht |
| B: Natives Mapbox-iOS-SDK mit Offline-Packs | ja | sehr groß, Karte in Swift neu | Mapbox-Lizenz | Bruch mit der Web-Architektur |
| C: MapLibre GL JS plus gebündelte Basiskarte (PMTiles) | ja | mittel | 0 € Lizenz, Hosting wenige € | Empfehlung |
| D: MapLibre plus `countries.geojson` als Notkarte | teilweise | klein | 0 € | erster Schritt zu C |

### Lösung: Option C in vier Schritten

**Schritt 1, Option D als Zwischenstand.** Mapbox GL JS durch MapLibre GL JS ersetzen (Fork von Mapbox GL 1.x, BSD-Lizenz, kein Token). Die API ist nahezu identisch: `Marker`, `addSource`, `addLayer`, `setStyle`, `NavigationControl`. `js/markers.js`, `js/countries.js`, `js/theme.js` brauchen fast nur den Import-Tausch. Der Mapbox-Style wird solange weiter geladen, wie er erreichbar ist. Scheitert er, lädt die App einen lokalen Style aus `data/countries.geojson` (600 KB, liegt schon im Bundle): Ozeanfarbe, Länderflächen, Grenzen. Damit ist die Karte nie mehr schwarz, auch wenn sie offline grob bleibt.

**Schritt 2, eigene Basiskarte.** OpenStreetMap-Vektorkacheln im PMTiles-Format (Protomaps-Build, ODbL-Lizenz). Eine Datei, kein Tile-Server. Hosting auf Firebase Storage oder Cloudflare R2 mit Range-Requests. Welt-Extrakt Zoom 0 bis 6 ins iOS-Bundle legen. Größe grob 30 bis 80 MB, vor der Entscheidung einen Build erzeugen und messen. Zoom 6 reicht für Welt- und Länderansicht, also das, was die App zeigt. Protomaps liefert fertige Dark- und Light-Styles, Glyphen und Sprites kommen mit ins Bundle, sonst fehlen offline die Beschriftungen.

**Schritt 3, dynamischer Cache.** Kacheln ab Zoom 7, die der Nutzer online angesehen hat, in IndexedDB ablegen (MapLibre-Protokoll-Handler). Lizenzrechtlich unproblematisch, weil es eigene Daten sind. Obergrenze 200 MB, älteste zuerst raus.

**Schritt 4, Mapbox abbauen.** Token entfernen, `events.mapbox.com` fällt weg. `js/remote-search.js` nutzt die Mapbox Search Box API. Die bleibt zunächst, `places.json` deckt die Suche offline ab. Später ersetzbar durch Photon oder Nominatim. Der Länder-Layer in `js/countries.js` hängt sich heute unter `country-label` ein, der Einfügepunkt muss auf den neuen Style angepasst werden.

### Offene Entscheidung

App-Größe. 50 MB mehr im Bundle sind für eine Reise-App vertretbar, aber das ist deine Entscheidung, bevor Schritt 2 startet.

---

## Problem 4: Google- und Apple-Login landen auf getrennten Konten

### Befund

Alle Daten hängen an der Firebase-`uid` (`users/{uid}`). Ob Google und Apple dieselbe `uid` ergeben, entscheidet Firebase Auth beim Login. Die App prüft und verknüpft nichts (`js/auth.js:60-78`).

Die Firebase-Console bestätigt die Ursache: sechs Konten mit `…@privaterelay.appleid.com` und nur Apple als Anbieter. Diese Nutzer haben bei Apple "E-Mail verbergen" gewählt. Firebase sieht eine fremde Adresse und legt ein neues Konto mit neuer `uid` an. Das Konto `tspunei@gmail.com` hat Google und Apple verknüpft, dort wurde die Adresse geteilt. Die Einstellung "Ein Konto pro E-Mail-Adresse" ist also aktiv und funktioniert.

Ein einmal getrenntes Konto bleibt getrennt: Apple liefert die Relay-Adresse bei jedem weiteren Login wieder. Die Relay-Adresse lässt sich in der App weder vorab erkennen noch umbiegen.

### Lösung in drei Stufen

**Stufe 1, vorbeugen.** Über dem Apple-Button in `index.html` ein Hinweis: "Schon mit Google angemeldet? Dann wähle bei Apple 'E-Mail teilen', sonst entsteht ein zweites Konto." Ein Satz, kein Dialog.

**Stufe 2, erkennen.** Nach einem Apple-Login, bei dem das Nutzerdokument neu angelegt wird und die E-Mail auf `privaterelay.appleid.com` endet, zeigt die App einen Dialog: "Hast du schon ein TravelMap-Konto mit Google? Jetzt verbinden." Statt leerer Karte ohne Erklärung.

**Stufe 3, zusammenführen.** Neuer Punkt in den Einstellungen "Anmeldemethode hinzufügen". Ablauf:

1. Nutzer ist mit Konto A angemeldet und startet den Login bei Provider B.
2. Das Credential von B wird per `linkWithCredential` an A gehängt. Danach funktionieren beide Logins auf einer `uid`. Fertig, wenn B noch kein eigenes Konto hatte.
3. Hat B bereits ein Firebase-Konto, meldet Firebase `auth/credential-already-in-use`. Dann zeigt die App beide Konten mit Pin-Anzahl und Erstelldatum: "Konto mit 23 Orten behalten, Konto mit 0 Orten auflösen?"
4. Die Übernahme schreibt das Nutzerdokument, alle `friends`-Einträge bei den Freunden, die Mitgliedschaften in `groups` und den Eintrag in `invites/{token}` auf die Ziel-`uid` um. Das darf der Client laut `firestore.rules` nicht, weil es fremde Dokumente berührt. Deshalb als Cloud Function mit Admin-Rechten, aufgerufen mit den ID-Tokens beider Konten als Nachweis.
5. Das leere Konto wird zum Schluss über den bestehenden Löschflow (`js/account.js`) entfernt, der Apple-Token wird dabei widerrufen.

**Für die sechs bestehenden Fälle** gibt es die Abkürzung von Hand: In Firestore unter `users/{uid}` steht im Feld `display_name` der Name, den Apple beim ersten Login mitgegeben hat. Damit lässt sich jedes Relay-Konto einer Person zuordnen. Dann das Nutzerdokument vom Google-Konto auf die Apple-`uid` kopieren, Freundschaften und Gruppen nachziehen und der Person sagen, dass sie sich nur noch mit Apple anmeldet. Für sechs Leute machbar, skaliert nicht. Stufe 3 bleibt die saubere Lösung.

---

## Performance-Checkliste, geprüft gegen TravelMap

Die 30 Punkte aus der Liste, bewertet für diese Architektur: statische Web-App im iOS-Bundle, kein eigener Server, Firestore, Mapbox.

| Punkt | Bewertung | Begründung |
|---|---|---|
| Skeleton loading screen | **hilft, Teil von Problem 2** | Ersetzt den Splash. Sidebar und Statistik als Skeleton, bis der Cache liefert. Zusammen mit Punkt 2 (cache-first) sieht der Nutzer nach unter einer Sekunde Struktur. |
| Serve images in WebP or AVIF | nein | Eigene Bilder sind 6 Icons unter 90 KB im Bundle. Avatare kommen von Google, Format nicht beeinflussbar. |
| Prevent duplicate API calls | **hilft, Teil von Problem 2** | Heute zwei `getDoc` auf dasselbe Dokument beim Start. Suche hat bereits einen `AbortController` (`js/ui.js:235`). |
| Debounce search and autocomplete | bereits erledigt | 300 ms in `js/ui.js:152`. |
| Paginate API results | nein | Nutzerdokument ist ein einzelnes Dokument. Freunde und Gruppen sind kleine Listen. |
| Serve static files through a CDN | nein | Alles liegt im iOS-Bundle. Kein Netz für die Shell. Relevant nur für die PMTiles-Datei aus Problem 3, die liegt auf R2 oder Firebase Storage, beides mit CDN. |
| Move slow tasks to a background job queue | nein | Keine langen Serveraufgaben. Die Kontoübernahme aus Problem 4 läuft als Cloud Function, das ist synchron und kurz. |
| Fix N+1 queries | nein | Freunde kommen über einen `onSnapshot` auf die Collection, Gruppen über eine `array-contains`-Query. Kein Dokument pro Freund. |
| Enable Brotli or Gzip | nein | Bundle-Dateien werden nicht über das Netz geladen. Firestore und Mapbox komprimieren selbst. |
| Cache with Redis | nein | Kein Server. Das Äquivalent ist der Firestore-IndexedDB-Cache, der existiert schon. |
| Remove unused dependencies | gering | `package.json` ist knapp. `vendor/mapbox-gl` (1,4 MB) entfällt mit Problem 3, MapLibre ist ähnlich groß. Parse-Zeit im Bundle ist lokal, kein Netz. |
| Set timeout for external API calls | **hilft, Teil von Problem 2** | Fehlt bei `initMap` und beim Mapbox-Style. Firestore hat intern 10 s. Remote-Suche hat keinen Timeout, nur Abort. |
| Stream AI responses | nein | Keine KI. |
| Update the UI before the server responds | bereits erledigt | `settleWrite` in `js/offline-write.js` wartet offline nicht auf die Bestätigung, Listener liefern den lokalen Stand sofort. Beim Start fehlt das noch, siehe cache-first. |
| Lazyload images below the screen | bereits erledigt | `loading="lazy"` an den Avataren. |
| Run independent requests in parallel | **hilft, Teil von Problem 2** | `initMap` parallel zu Firestore ist der größte Einzelgewinn. |
| Add database indexes | nein | Einziger Index auf `invite_token` existiert. Alle anderen Zugriffe sind Dokument-Lookups. |
| Trace with OpenTelemetry | nein, aber Variante | Kein Backend. Das Äquivalent ist `performance.mark()` im Client, siehe Problem 2 Punkt 1. |
| Place servers close to the database | nein | Kein Server. Firestore-Region ist gesetzt und nicht änderbar. |
| Render on the server or at build time | nein | Die Shell ist bereits statisch im Bundle. |
| Load third-party scripts after the page | gering | `mapbox-gl.js` steht mit `defer`. Firebase kommt als ES-Modul. Mit Problem 2 Punkt 3 startet die Karte ohnehin früher, nicht später. |
| Split JavaScript by page | nein | Zwei Seiten, bereits getrennt. Lokale Dateien, kein Netzgewinn. |
| Virtualize long lists | nein | Städteliste und Freunde sind kurz. Erst ab mehreren hundert Einträgen relevant. |
| Select only the columns you need | nein | Firestore liefert immer ganze Dokumente. Dokument ist klein. |
| Database connection pooling | nein | Kein Server. |
| Prevent unnecessary re-renders | gering | `renderAllMarkers` baut bei jedem Snapshot alle Marker neu. Bei 40 Pins unkritisch. Bei 200 Pins ein Diff statt Neuaufbau. |
| Enable browser caching for static files | nein | Bundle. Relevant nur für Kacheln, siehe Problem 3 Schritt 3. |
| Load-balance across app instances | nein | Kein Server. |
| Self-host fonts and limit font weights | bereits erledigt | Systemschrift `-apple-system`, keine Webfonts. |

### Zusammengefasst

Vier Punkte aus der Liste treffen und stecken alle in Problem 2: Skeleton statt Splash, doppelte Firestore-Aufrufe entfernen, Timeouts setzen, Karte parallel laden. Fünf Punkte sind schon umgesetzt. Der Rest zielt auf Server-Architekturen, die TravelMap nicht hat.

---

## Reihenfolge der Umsetzung

| Nr. | Paket | Löst | Aufwand |
|---|---|---|---|
| 1 | Avatar-Komponente mit Initialen | Problem 1 | klein |
| 2 | Start umbauen: cache-first, parallel, Timeouts, Watchdog ohne Reload, Skeleton | Problem 2 | mittel |
| 3 | Apple-Hinweis und Erkennungs-Dialog | Problem 4, Stufe 1 und 2 | klein |
| 4 | MapLibre plus lokaler Fallback-Style | Problem 3, Schritt 1 | mittel |
| 5 | Kontoverknüpfung mit Cloud Function | Problem 4, Stufe 3 | groß |
| 6 | PMTiles-Basiskarte und Tile-Cache | Problem 3, Schritt 2 und 3 | groß |

Paket 1 bis 3 lassen sich in einer Version ausliefern. Paket 4 ist die Voraussetzung für 6 und sollte vor der Entscheidung über die Bundle-Größe stehen.

---

## Umsetzungsstand (05.11.2026, Branch `claude/map-loading-offline-mode-80w75j`)

| Paket | Stand | Wo |
|---|---|---|
| 1 Avatar-Komponente | umgesetzt, inklusive Bild-Cache in IndexedDB | `js/avatar.js`, Einsatz in `js/ui.js`, `js/markers.js`, `js/app.js` |
| 2 Start umbauen | umgesetzt | `loadUserDataFast` und nicht blockierender Profilabgleich in `js/db.js`; Karte startet beim Skriptstart, Splash 800 ms, Watchdog ohne Reload bei langsamer Karte, `performance.mark`-Log in `js/app.js` |
| 3 Apple-Hinweis, Relay-Dialog | umgesetzt | `index.html` (Hinweis über dem Apple-Button), `_maybeShowRelayHint` in `js/app.js`, Dialog in `map.html` |
| 4 Offline-Karte | umgesetzt, ohne Bibliothekswechsel | `js/fallback-style.js` baut ein Style aus `data/countries.geojson`; `js/map.js` holt den Mapbox-Style selbst per `fetch`, zeigt nach 2,5 s oder bei Fehler die Offline-Karte und versucht den Server mit Backoff (2, 4, 8, 16, 32 s) erneut |
| 5 Anmeldemethoden | umgesetzt für den Normalfall | `linkProvider` in `js/auth.js`, Abschnitt "Anmeldemethoden" in den Einstellungen. Konfliktfall (`auth/credential-already-in-use`) wird erklärt: leeres Konto löschen, mit dem anderen anmelden, Methode dort hinzufügen |
| 6 MapLibre, PMTiles, Tile-Cache | offen | Wartet auf die Entscheidung zur Bundle-Größe. Die Offline-Karte aus Paket 4 deckt "nie mehr schwarz" ab |
| Cloud Function zur Kontozusammenführung | offen | Der Weg über "leeres Konto löschen, dann verknüpfen" braucht sie für die sechs Bestandsfälle nicht |

### Abweichungen vom Konzept

- **Bibliothek bleibt Mapbox GL JS.** Der Wechsel auf MapLibre bringt erst mit einer eigenen Kachelquelle (PMTiles) Nutzen. Ohne Gerätetest und ohne Mapbox-Token in dieser Umgebung wäre der Tausch ein Risiko für die Online-Karte, die der Kern der App ist. Die Offline-Karte funktioniert mit Mapbox GL genauso, weil sie nur eine lokale GeoJSON-Quelle braucht.
- **Style-JSON holt die App selbst.** `map.setStyle(url)` baut bei Mapbox per Diff um und feuert dann kein `style.load`; eigene Ebenen (Länderflächen) verschwinden stumm. Mit `fetch` plus `setStyle(json, { diff: false })` bleibt die sichtbare Karte stehen, bis der neue Style vollständig da ist, und `style.load` kommt zuverlässig.
- **Theme-Wechsel offline:** Ist ein Server-Style geladen, bleibt er in der alten Farbe stehen (besser als die grobe Karte). Der neue wird nachgeladen, sobald Netz da ist.

### Geprüft

- `npm test`: 124 Tests grün, davon neu: `tests/avatar.test.js`, `tests/fallback-style.test.js`, `tests/start-data.test.js`.
- Headless Chromium mit echtem Mapbox GL 3.4.0 und blockiertem `api.mapbox.com`: Offline-Karte nach 200 ms, Pins sitzen, hell und dunkel. Mit simuliertem Server-Style: Wechsel Offline → Server, Theme online, Theme offline, automatischer Retry nach Netzrückkehr. Langsames Netz (6 s): Offline-Karte nach 2,5 s, Server-Style bei 6 s. Schnelles Netz: kein Zwischenschritt.
- Freundesliste, Kartenhinweis und Relay-Dialog gerendert und per Screenshot geprüft.

### Noch zu prüfen auf dem Gerät

- Startzeiten mit Network Link Conditioner ("3G", "Very Bad Network"). Das Log `[TM] start script@…ms auth@…ms data-cache@…ms map@…ms render@…ms` zeigt, wo die Zeit bleibt.
- Google-Avatare im Bild-Cache: ob `lh3.googleusercontent.com` CORS für `capacitor://localhost` erlaubt. Wenn nicht, bleibt es beim Platzhalter plus Bild online, ohne Cache.
- Apple-Verknüpfung über das Capacitor-Plugin (`linkWithCredential` mit Apple-Credential und Nonce).
