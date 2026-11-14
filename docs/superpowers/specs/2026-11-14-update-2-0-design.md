# TravelMap 2.0: neues Design, Profilbild, Pin-Stories

Stand: 2026-11-14. Brief und Design in einem Dokument.

## Auftrag

TravelMap bekommt ein Update 2.0 mit drei Teilen:

1. Neues Design: Hub unten statt Hamburger-Menü, Farben nach 60/30/10.
2. Profilbild ändern.
3. Stories an Pins: pro Pin beliebig viele Einträge, jeder mit optionalem Datum, Fotos, Text, Sprachnotiz und Spotify-Song. Ansicht wie eine Insta-Story.

Warum: Aus der Karte, die nur zeigt wo man war, wird ein Reisetagebuch, das zeigt was man dort erlebt hat.

## Für wen

Eigenmodus. Marins eigene App, Nutzer sind er und seine Freunde auf dem iPhone.

## Bekannt

- iOS-App über Capacitor 8 (WKWebView), Vanilla JS ohne Bundler, jede Datei mit `?v=`. Quelle: `package.json`, `map.html`.
- Die Web-App ist nicht mehr öffentlich, `travel.marinpesa.dev` ist nur die Landing Page. Quelle: PR 22.
- Firebase Auth und Firestore. Kein Storage, keine Functions bisher. Quelle: `firebase.json`.
- Daten: `users/{uid}` mit Arrays `visited_cities`, `wishlist_cities`, Länder-Arrays, `avatar_url`. Freunde in `users/{uid}/friends`. Städte werden über ihren Namen angesprochen. Quelle: `js/db.js`, `firestore.rules`.
- `avatar_url` liegt als Kopie auch in `invites/{token}` und in den `friends`-Dokumenten, jeweils maximal 500 Zeichen, außerdem als `addedBy.photoURL` in Gruppen-Pins.
- `initUserProfile` (`js/db.js`) überschreibt `avatar_url` bei jedem Start aus dem Auth-`photoURL`. Das Auth-Profil ist also die führende Quelle.
- Eingebunden sind nur die Firebase-SDKs für App, Auth und Firestore (`vendor/firebase/10.12.0/`). `firebase.json` hat keinen Block für Storage oder Functions.
- Navigation heute: Sidebar, auf dem iPhone hinter `#btn-menu` versteckt. Inhalt: Statistik, Filter, letzte Einträge, Freunde, Gruppen, Ort hinzufügen, Einstellungen.
- Farben heute: Navy `#080b11` und Indigo `#6366f1`, es gibt ein helles und ein dunkles Theme.
- Kamera- und Fotorechte sind in `Info.plist` schon erklärt, aber nur für Gruppenkarten formuliert. Ein Mikrofonrecht fehlt.
- Der Foto-Dialog für Gruppen nutzt bereits `<input type="file">`, also den iOS-Picker.
- `js/update-logic.js`: ein Sprung der Hauptversion (1.x auf 2.0) macht das Update zur Pflicht, sobald `landing/app-version.json` auf 2.0.0 steht.
- Recherche Navigation: versteckte Navigation wird seltener gefunden und genutzt (NN/g, 179 Teilnehmer). Apple Maps und Google Maps lassen die Karte frei und nutzen Sheets von unten.

## Entscheidungen von Marin

- Umfang 2.0: Design, Profilbild, Stories komplett (Datum, Fotos, Text, Sprachnotiz, Song). Ein einziges App-Store-Update.
- Reiseplaner, Reisemodus mit GPS und KI-Plan: nicht jetzt, großes Update 2027.
- Sichtbarkeit: pro Story wählbar, Standard privat, Schalter "Für Freunde sichtbar".
- Song: Suche in der App, Spotify.
- Kosten: Firebase Blaze mit Budget-Alarm ist okay.
- Farben: Navy 60 Prozent, Indigo 30 Prozent, Gold `#facc15` 10 Prozent. Mockup: `docs/design/mockups/accent-c-gold.png`.
- Codebasis: Ponytail-Regeln, iOS zuerst (siehe `CLAUDE.md`).

## Ziele, Nicht-Ziele, Anti-Ziele

Ziele:
- Jede Hauptfunktion ist mit einem Tipp vom Hauptscreen erreichbar.
- Eine Story mit Foto und Text ist in unter 30 Sekunden angelegt.
- Freunde sehen nur, was ausdrücklich freigegeben wurde.

Nicht-Ziele: Reiseplaner, GPS, KI, Videos, Kommentare oder Likes, Stories auf Gruppenkarten, Android, öffentliche Web-App.

Anti-Ziele:
- Private Stories oder deren Medien sind für andere abrufbar.
- Die Karte wird von Bedienelementen zugestellt.
- Kontolöschung lässt Fotos oder Sprachnotizen in der Cloud zurück.

## Ansätze

Navigation:
- A. Schwebende Tab-Leiste unten mit Plus in der Mitte. Gewählt. Alles sichtbar, Daumenzone, passt zu iOS.
- B. Nur ein Sheet von unten wie Apple Maps. Karte maximal frei, aber Freunde und Profil wären wieder eine Ebene tiefer versteckt.
- C. Sidebar behalten und nur neu einfärben. Wenig Arbeit, löst das Problem nicht.

Speicherort der Stories:
- A. Eigene Untersammlung `users/{uid}/stories`. Gewählt. Sichtbarkeit pro Story über Regeln prüfbar, kein Größenlimit des Nutzerdokuments.
- B. Stories in den Stadt-Objekten im Nutzerdokument. Kein neues Modell, aber Freunde lesen das ganze Dokument und sähen damit auch private Stories, dazu 1-MB-Grenze.
- C. Sammlung auf oberster Ebene. Bringt erst mit Gruppen-Stories etwas.

Song:
- A. Callable Cloud Function mit Spotify Client Credentials, Wiedergabe im Spotify-Embed. Gewählt. Kein Spotify-Login für Nutzer nötig.
- B. Link einfügen. Von Marin abgewählt.
- C. Spotify-Login pro Nutzer. Mehr Aufwand, schließt Nutzer ohne Konto aus.

## Design

### Farben und Stil

- Tokens in `css/style.css` auf drei Rollen zurückführen: Fläche (Navy), Sekundär (Indigo: besuchte Länder, Pins, aktive Flächen), Akzent (Gold: Plus-Button, aktiver Tab, Story-Ring, Hauptaktion in Dialogen).
- Gold nie für Fließtext. Auf Gold steht dunkler Text.
- Helles Theme bleibt. Dort Akzent als dunkleres Gold (`#ca8a04`) für Linien und Text, die goldene Füllfläche mit dunklem Text bleibt.
- Glasflächen mit `backdrop-filter`, Systemschrift, vorhandene Animationen aus `js/anim.js`.

### Hub

Schwebende Leiste unten, Safe Area beachtet:

```
[ Karte ] [ Orte ] ( + ) [ Freunde ] [ Profil ]
```

- Karte: Vollbildkarte, oben Suchfeld und Avatar, darüber der Leiste eine kompakte Statistik-Karte (Städte, Länder), die zwischen Städte- und Ländermodus umschaltet.
- Orte: Sheet mit Filtern (Alle, Besucht, Wunschliste, Gelebt) und der Liste der Orte, neueste zuerst. Tipp auf einen Ort fliegt zur Karte.
- Plus: Ort hinzufügen (bestehender Ablauf).
- Freunde: Freunde, Einladen, Gruppen, Gruppe anlegen.
- Profil: Profilbild, Name, Statistik, Einstellungen (bisheriges Modal als Seite), Abmelden, Konto löschen.
- Sidebar, `#btn-menu` und Backdrop entfallen. Der Banner beim Ansehen einer Freundes- oder Gruppenkarte bleibt.
- Die Leiste hat 2027 Platz für einen fünften Punkt "Reisen".

### Profilbild

- Im Profil: Tipp auf den Avatar, Auswahl über `<input type="file" accept="image/*">` (iOS zeigt Mediathek und Kamera).
- Im Browser quadratisch zuschneiden (Mitte) und auf 512 px JPEG verkleinern, Upload nach Storage `users/{uid}/avatar.jpg`.
- Die Download-URL wird zuerst als `photoURL` im Auth-Profil gesetzt (führende Quelle, siehe Bekannt), dann nach `users/{uid}.avatar_url` und in die Kopien in `invites/{token}` und in den eigenen Einträgen bei Freunden.
- Alte Gruppen-Pins behalten ihr damaliges Bild.
- "Bild entfernen" leert `photoURL` und zeigt die Initialen (`js/avatar.js` bleibt die Anzeige), auch bei Google-Konten.

### Stories

Datenmodell `users/{uid}/stories/{storyId}`:

| Feld | Typ | Hinweis |
|---|---|---|
| `city` | string | Name der Stadt, wie in `visited_cities`. Das ist der Schlüssel, die App kennt jede Stadt nur über ihren Namen |
| `country` | string | ISO-Code, nur zur Information |
| `date` | timestamp oder null | frei wählbar, optional |
| `text` | string | höchstens 2000 Zeichen |
| `photos` | Liste | höchstens 10, je `{ path }`, keine URL |
| `voice` | map oder null | `{ path, seconds }`, höchstens 120 s |
| `song` | map oder null | `{ id, title, artist, cover_url }` |
| `shared` | bool | Standard false |
| `created_at` | timestamp | |

Firestore-Regeln:
- Besitzer: alles, mit Typ- und Größenprüfung wie bei den bestehenden Regeln.
- Freund: nur lesen, nur wenn `resource.data.shared == true` und der Freundeseintrag existiert. Abfragen von Freunden filtern deshalb immer auf `shared == true`, eine Abfrage pro Freundeskarte. Sortiert wird im Client, damit kein zusammengesetzter Index nötig ist.

Storage:
- Pfade `users/{uid}/stories/{storyId}/{datei}` und `users/{uid}/avatar.jpg`.
- Schreiben nur der Besitzer, nur `image/jpeg` bis 1 MB und `audio/mp4` bis 3 MB (iOS nimmt AAC in MP4 auf).
- Storage- und Functions-SDK in derselben Version wie die übrigen nach `vendor/firebase/` legen, `firebase.json` um `storage` und `functions` ergänzen.
- Story-Medien haben keine teilbaren Links (Entscheidung von Marin). Die App lädt sie angemeldet über das SDK (`getBlob`) und zeigt sie als lokale Objekt-URL, `getDownloadURL` wird für Stories nie aufgerufen.
- Storage-Leseregel für Story-Dateien: Besitzer immer, ein Freund nur, wenn der Freundeseintrag existiert und die Story `shared == true` ist (Prüfung per `firestore.exists` und `firestore.get` in den Storage-Regeln). Wird eine Story privat gestellt, ist der Zugriff sofort weg.
- Im Viewer kein Speichern-Menü auf Bildern (`-webkit-touch-callout: none`). Screenshots lassen sich nicht verhindern.
- Nur das Profilbild hat eine Download-URL, weil es in `avatar_url` steht und für Freunde ohnehin sichtbar ist.
- Fotos vor dem Upload im Browser auf höchstens 1600 px JPEG verkleinern.

Anlegen und Bearbeiten:
- Im Pin-Popup ein neuer Knopf "Story hinzufügen", dazu der Ring um Pins mit Stories.
- Formular als Sheet: Datum (natives `<input type="date">`), Fotos (Mehrfachauswahl), Text, Sprachnotiz (Aufnehmen, Anhören, Verwerfen), Song (Suche), Schalter "Für Freunde sichtbar". Alles optional, mindestens ein Inhalt muss da sein.
- Sprachnotiz über `MediaRecorder` in WKWebView, neues Recht `NSMicrophoneUsageDescription`.
- Eigene Stories lassen sich bearbeiten und löschen. Löschen entfernt auch die Dateien.
- Wird eine Stadt entfernt, werden ihre Stories nach Rückfrage mit gelöscht.

Ansehen:
- Tipp auf einen Pin mit Ring öffnet den Viewer im Vollbild: Fortschrittsbalken oben, Tipp rechts und links blättert, Wischen nach unten schließt.
- Eine Story ist eine Folge von Seiten: jedes Foto eine Seite, Text als Overlay unten, Datum oben. Ohne Foto eine Textseite auf Navy.
- Sprachnotiz als Abspielknopf, Song als Chip mit Cover, Tipp öffnet den Spotify-Player als Embed.
- Reihenfolge der Stories eines Pins: nach `date`, ohne Datum nach `created_at`.
- Auf der Karte eines Freundes haben nur Pins mit freigegebenen Stories einen Ring.

Song-Suche:
- Callable Function `searchSongs({ q })`, nur für angemeldete Nutzer, Spotify-Zugang als Secret, Token im Speicher der Function zwischengespeichert. Antwort: höchstens 10 Treffer mit `id, title, artist, cover_url`.
- Wiedergabe: `https://open.spotify.com/embed/track/{id}` im iframe. Ohne Spotify-Login im WebView sind das 30 Sekunden Vorschau, ein Knopf öffnet den Song in der Spotify-App.

### Was sich sonst ändern muss

- `js/account.js`: Kontolöschung löscht zuerst die Stories samt Dateien (Pfade aus den Story-Dokumenten, damit ein abgebrochener Lauf wiederholbar ist), dann das Profilbild, dann wie bisher das Nutzerdokument.
- Datenschutzerklärung (`privacy.html`, Landing, `docs/store/texte.md`): Firebase Storage, Mikrofon, Spotify. Rechtetexte in `Info.plist` für Fotos allgemeiner fassen.
- `js/i18n.js`: alle neuen Texte Deutsch und Englisch.
- App-Store-Screenshots und Texte neu.
- Version 2.0.0, `landing/app-version.json` erst nach Freigabe im Store.

### Reihenfolge beim Bauen

1. Farb-Tokens und Hub (ohne neue Funktionen, alles Bestehende erreichbar).
2. Storage einrichten, Profilbild.
3. Stories: Modell, Regeln mit Tests, Formular mit Datum, Fotos, Text, Viewer, Freigabe.
4. Sprachnotiz.
5. Cloud Function und Song.
6. Kontolöschung, Datenschutz, Store-Material, Version.

Jeder Schritt ist für sich testbar. Reine Logik in `*-logic.js` mit Vitest, Regeln mit `npm run test:rules`, Oberfläche im iOS-Simulator.

## Ausgabe

- Code im Repo `marinpesa15/TravelMap`, Branch `feature/v2`, Pull Request gegen `main`.
- Dieses Dokument: `docs/superpowers/specs/2026-11-14-update-2-0-design.md`. Plan danach unter `docs/superpowers/plans/`.
- Mockups: `docs/design/mockups/`. Vor dem Bauen entstehen dort auch Mockups für Orte, Profil, Story-Formular und Story-Viewer, gebaut wird nach Marins Freigabe dieser Bilder.

## Offen (macht Marin selbst, blockiert nur den jeweiligen Schritt)

- Firebase auf Blaze umstellen, Budget-Alarm setzen, Storage aktivieren. Nötig ab Schritt 2.
- Kostenlose Spotify-Entwickler-App anlegen, Client-ID und Secret als Firebase-Secret hinterlegen. Nötig ab Schritt 5.

## Annahmen

- **Annahme:** Stories gibt es an besuchten und gelebten Städten, nicht an Wunschlisten-Pins und nicht an Ländern. (Eine Erinnerung setzt einen Besuch voraus.)
- **Annahme:** Keine Stories auf Gruppenkarten in 2.0. (Eigenes Rechtemodell, später.)
- **Annahme:** Grenzen: 10 Fotos pro Story, 120 Sekunden Sprachnotiz, 2000 Zeichen Text, beliebig viele Stories pro Pin.
- **Annahme:** Stories mit Fotos, Sprachnotiz oder Song brauchen eine Verbindung. Reine Text-Stories funktionieren offline wie die übrigen Schreibvorgänge.
- **Annahme:** Inhalt der vier Hub-Bereiche wie oben beschrieben.
- **Annahme:** Das iPad bekommt dasselbe Layout wie das iPhone, kein eigenes Sidebar-Layout.
- **Annahme:** Helles Theme bleibt erhalten.
- **Annahme:** 2.0 wird wegen des Hauptversionssprungs für alle zum Pflicht-Update. (Folgt aus der bestehenden Update-Logik.)
- **Annahme:** Zuschnitt des Profilbilds automatisch mittig, kein eigener Zuschneide-Dialog.

## Selbsttest

Wo müsste ich raten? Nur noch an den oben markierten Annahmen. Alles andere ist durch Marins Antworten oder das Repo belegt.
