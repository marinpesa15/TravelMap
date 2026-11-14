# Store-Texte

Für App Store Connect, Reiter **Vertrieb**. Deutsch ist die Primärsprache,
Englisch als zweite Lokalisierung über die Sprachauswahl oben rechts.

Zeichenlimits laut Apple: Untertitel 30, Werbetext 170, Beschreibung 4.000,
Schlüsselwörter 100, Copyright 200.

---

## Deutsch

### Untertitel (30)

```
Deine Reisen auf der Weltkarte
```

### Werbetext (170)

```
Neu: Stories zu deinen Orten mit Fotos, Text, Sprachnotiz und Song. Teile sie mit Freunden, und gestalte deine Karte mit eigenem Profilbild.
```

### Beschreibung (4000)

```
TravelMap zeigt dir auf einen Blick, wo du überall warst.

Trag die Städte ein, in denen du warst, und sieh zu, wie sich deine Weltkarte füllt. Wechsle jederzeit in die Länderansicht, dort färben sich alle Länder ein, die du schon besucht hast. Was noch fehlt, kommt auf die Wunschliste, und Orte, an denen du gelebt hast, bekommen ihre eigene Markierung.

GEMEINSAM REISEN
Verbinde dich per Einladungslink mit Freunden und schau dir ihre Karten an. In Gruppenkarten tragt ihr eure Orte zusammen ein, jeder Pin zeigt, wer ihn gesetzt hat. Zu jedem Ort in einer Gruppe könnt ihr ein Foto hinterlegen.

STORIES ZU JEDEM ORT
Halte fest, was du erlebt hast: Zu jeder besuchten Stadt legst du Stories an, mit Datum, Text, bis zu zehn Fotos, einer Sprachnotiz und deinem Song dazu. Pro Story entscheidest du, ob deine Freunde sie sehen dürfen. Dein Profilbild wählst du selbst.

AUCH OHNE NETZ
TravelMap bringt eine Ortsliste mit fast 70.000 Städten mit. Du kannst also auch im Flugzeug oder im Funkloch suchen, Orte eintragen und ändern. Sobald du wieder online bist, wird alles übertragen.

DEINE DATEN BLEIBEN DEINE
Kein Tracking, keine Werbung. Deine Karte sehen nur du und die Freunde, die du selbst bestätigt hast, deine Stories nur, wenn du sie für Freunde freigibst. Dein Konto kannst du jederzeit in den Einstellungen löschen, mitsamt allen Stories, Fotos und Sprachnotizen.

Anmeldung mit Google oder Apple. TravelMap ist ein privates Projekt und kostet nichts.
```

### Schlüsselwörter (100)

```
reise,reisetagebuch,weltkarte,länder,städte,urlaub,bucket,list,tracker,karte,freunde,stories,fotos
```

### Support-URL

```
https://travel.marinpesa.dev/support.html
```

### Marketing-URL (optional)

```
https://travel.marinpesa.dev
```

### Copyright (200)

```
2026 Marin Pesa
```

---

## English

### Subtitle (30)

```
Your travels on a world map
```

### Promotional text (170)

```
New: stories for your places with photos, text, a voice note and a song. Share them with friends, and make your map yours with your own profile picture.
```

### Description (4000)

```
TravelMap shows you at a glance where you have been.

Add the cities you have visited and watch your world map fill up. Switch to the country view at any time, where every country you have been to is coloured in. Whatever is still missing goes on your wishlist, and places you have lived in get their own marker.

TRAVEL TOGETHER
Connect with friends through an invite link and look at their maps. In group maps you add places together, and every pin shows who put it there. You can attach a photo to any place in a group.

STORIES FOR EVERY PLACE
Keep what you experienced: for every visited city you add stories with a date, text, up to ten photos, a voice note and your song. For each story you decide whether your friends may see it. You choose your own profile picture.

WORKS OFFLINE
TravelMap ships with a place list of almost 70,000 cities. That means you can search, add and edit places on a plane or with no signal. Everything is sent once you are back online.

YOUR DATA STAYS YOURS
No tracking, no ads. Your map is visible only to you and the friends you confirmed yourself, and your stories only if you share them with friends. You can delete your account at any time in the settings, including all stories, photos and voice notes.

Sign in with Google or Apple. TravelMap is a private project and free of charge.
```

### Keywords (100)

```
travel,journal,world,map,countries,cities,trips,bucket,list,tracker,friends,stories,photos,vacation
```

### Support URL

```
https://travel.marinpesa.dev/support.html
```

### Marketing URL (optional)

```
https://travel.marinpesa.dev
```

### Copyright (200)

```
2026 Marin Pesa
```

---

## Neu in 2.0

### Deutsch

```
Stories: Halte zu jeder besuchten Stadt fest, was du erlebt hast, mit Text, bis zu zehn Fotos, einer Sprachnotiz und einem Song von Spotify.
Teilen: Pro Story entscheidest du, ob deine Freunde sie sehen dürfen.
Profilbild: Wähle ein eigenes Profilbild für deine Pins und dein Profil.
Neue Leiste unten und ein neues Farbdesign in Navy, Indigo und Gold.
```

### English

```
Stories: for every visited city, keep what you experienced with text, up to ten photos, a voice note and a song from Spotify.
Sharing: for each story you decide whether your friends may see it.
Profile picture: pick your own picture for your pins and your profile.
New bottom bar and a new colour design in navy, indigo and gold.
```

---

## Version

Das Feld **Version** auf der Vertriebsseite muss zur hochgeladenen Binärdatei
passen. Die trägt `2.0.0` (Xcode: MARKETING_VERSION, Build `9`). Dasselbe steht
in `js/version.js` (`APP_VERSION`). `landing/app-version.json` bleibt auf
`1.6.0`, bis 2.0 im Store live ist. Danach `latest` und `minimum` auf `2.0.0`
setzen (2.0 ist ein Pflicht-Update, siehe `CLAUDE.md`, Release-Reihenfolge).

---

## Informationen zur App-Prüfung

### Anmeldeinformationen

Haken bei **„Anmeldung erforderlich" entfernen**. Die App verlangt zwar eine
Anmeldung, aber sie bietet „Sign in with Apple" an, und die Prüfer melden sich
damit mit ihrer eigenen Apple-ID an. Genau dafür ist der Weg gedacht. Ein
Google-Testkonto wäre der schlechtere Weg: Google blockt Anmeldungen von
unbekannten Geräten aus den USA regelmäßig, und dann scheitert die Prüfung an
etwas, das wir nicht steuern können.

Wichtig ist, dass der Grund in den Anmerkungen steht, sonst wirkt der fehlende
Haken wie ein Versehen.

### Testkonto für Stories (vor der Einreichung vorbereiten)

Seit 2.0 lohnt sich ein Testkonto: Die Prüfer sehen die geteilte Story eines
Freundes nur mit zwei verbundenen Konten. Vorher zwei Konten anlegen
(Apple-ID oder Google), sie per Einladungslink verbinden, auf dem zweiten
eine Story mit „Für Freunde sichtbar" anlegen (Foto, Text, Sprachnotiz, Song)
und die Zugangsdaten in die Anmerkungen unten bei Punkt 6 eintragen. Dann den
Haken „Anmeldung erforderlich" setzen (das ersetzt die Empfehlung oben) und
die Zugangsdaten auch dort hinterlegen. Das Mikrofon wird nur bei der Sprachnotiz benutzt, das steht in
Punkt 5 der Anmerkungen.

### Kontaktinformationen

```
Vorname: Marin
Nachname: Pesa
E-Mail: pesamarin81@gmail.com
Telefonnummer: (deine Nummer mit Ländervorwahl, z. B. +49 …)
```

### Anmerkungen (4.000, auf Englisch)

```
TravelMap is a private, free travel-logging app. There are no purchases, no ads and no analytics.

SIGNING IN
Sign-in is required, but no demo account is needed: the app offers Sign in with Apple, so you can sign in with your own Apple ID on the review device. Google sign-in is offered as an alternative. If you would still prefer a dedicated test account, please let me know and I will provide one.

WHAT TO TRY
1. Add a place: use the search at the top, pick a city from the list, then choose Visited, Wishlist or Lived there.
2. Country view: open the sidebar (hamburger, top left) and switch from Cities to Countries. Visited countries are filled in on the map.
3. Friends and groups: the sidebar has an invite link and group creation. Seeing another person's map needs a second account.
4. Group photo: inside a group map you can attach a photo to a place. This opens the system picker, which is why the app declares camera and photo library usage.
5. Stories: tap a visited city, then "Add story". A story has a date, optional text, up to 10 photos, a voice note and a song. Recording a voice note is the only place the app uses the microphone (NSMicrophoneUsageDescription), and only while the record button is active. The song search needs a connection and sends the search term to our Cloud Function, which queries Spotify; the Spotify player only loads after tapping the song.
6. Sharing: each story has a switch "Visible to friends". Friends see it only with the switch on. Seeing a friend's story needs two accounts, so a test account with one shared story is provided: [TESTKONTO-ZUGANG HIER EINTRAGEN]. Please add it as a friend through an invite link or use the pre-connected account.

ACCOUNT DELETION (5.1.1(v))
Sidebar, gear icon, "Delete account". It removes the account itself plus the user document, friendships, invite entries, the user's contributions to group maps, all stories with their photos and voice notes, and the profile picture. For accounts created with Sign in with Apple, the Apple token is revoked as part of the deletion.

OFFLINE
The app also runs without a connection. It ships with a place list of about 70,000 cities, so search and new entries work in airplane mode and sync once the device is back online. Only the map imagery itself needs a connection; a short notice explains that.

USER CONTENT (1.2)
Users can add photos, voice notes, text and place names, but nothing they add is distributed broadly. A map is visible only to friends both sides confirmed through an invite link, and places and photos inside a group only to the members of that group. There is no feed, no public profile, no discovery and no messaging. That is why the age rating questionnaire answers "no" to user-generated content: the content exists, but it is shared privately rather than distributed.

Users can remove a friend, leave a group, or, as the group creator, remove a member at any time, which also removes that person's entries from their view. Every friend and every group member has a report button (flag icon) in the app. It opens a prefilled email to the developer with the reported user's ID, and reports are handled within 24 hours. The procedure is documented at https://travel.marinpesa.dev/support.html

PRIVACY
Data is stored with Google Firebase (Authentication, Firestore, Storage, Cloud Functions). Story photos and voice notes have no shareable links and are only loaded by the signed-in app. Privacy policy: https://travel.marinpesa.dev/privacy.html
Support: https://travel.marinpesa.dev/support.html
Contact: pesamarin81@gmail.com
```

### Veröffentlichung

„Diese Version manuell veröffentlichen" ist die ruhigere Wahl: Die App geht
dann erst live, wenn du auf den Knopf drückst, und nicht automatisch mitten in
der Nacht nach der Freigabe.
