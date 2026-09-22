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
Neu: TravelMap läuft auch ohne Netz. Orte suchen und eintragen klappt im Flugmodus, alles überträgt sich, sobald du wieder online bist.
```

### Beschreibung (4000)

```
TravelMap zeigt dir auf einen Blick, wo du überall warst.

Trag die Städte ein, in denen du warst, und sieh zu, wie sich deine Weltkarte füllt. Wechsle jederzeit in die Länderansicht, dort färben sich alle Länder ein, die du schon besucht hast. Was noch fehlt, kommt auf die Wunschliste, und Orte, an denen du gelebt hast, bekommen ihre eigene Markierung.

GEMEINSAM REISEN
Verbinde dich per Einladungslink mit Freunden und schau dir ihre Karten an. In Gruppenkarten tragt ihr eure Orte zusammen ein, jeder Pin zeigt, wer ihn gesetzt hat. Zu jedem Ort in einer Gruppe könnt ihr ein Foto hinterlegen.

AUCH OHNE NETZ
TravelMap bringt eine Ortsliste mit fast 70.000 Städten mit. Du kannst also auch im Flugzeug oder im Funkloch suchen, Orte eintragen und ändern. Sobald du wieder online bist, wird alles übertragen.

DEINE DATEN BLEIBEN DEINE
Kein Tracking, keine Werbung, keine Weitergabe an Dritte. Deine Karte sehen nur du und die Freunde, die du selbst bestätigt hast. Dein Konto kannst du jederzeit in den Einstellungen löschen, mitsamt allen Daten.

Anmeldung mit Google oder Apple. TravelMap ist ein privates Projekt und kostet nichts.
```

### Schlüsselwörter (100)

```
reise,reisetagebuch,weltkarte,länder,städte,urlaub,bucket,list,tracker,karte,freunde,offline,pins
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
New: TravelMap now works without a connection. Search and add places in airplane mode, everything syncs as soon as you are back online.
```

### Description (4000)

```
TravelMap shows you at a glance where you have been.

Add the cities you have visited and watch your world map fill up. Switch to the country view at any time, where every country you have been to is coloured in. Whatever is still missing goes on your wishlist, and places you have lived in get their own marker.

TRAVEL TOGETHER
Connect with friends through an invite link and look at their maps. In group maps you add places together, and every pin shows who put it there. You can attach a photo to any place in a group.

WORKS OFFLINE
TravelMap ships with a place list of almost 70,000 cities. That means you can search, add and edit places on a plane or with no signal. Everything is sent once you are back online.

YOUR DATA STAYS YOURS
No tracking, no ads, nothing shared with third parties. Your map is visible only to you and the friends you confirmed yourself. You can delete your account and all its data at any time in the settings.

Sign in with Google or Apple. TravelMap is a private project and free of charge.
```

### Keywords (100)

```
travel,journal,world,map,countries,cities,trips,bucket,list,tracker,friends,offline,pins,vacation
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

## Version

Das Feld **Version** auf der Vertriebsseite muss zur hochgeladenen Binärdatei
passen. Die trägt `1.4.1` (Xcode: MARKETING_VERSION), dort steht aktuell noch
`1.0`. Entweder das Feld auf `1.4.1` setzen oder die App vor dem Archivieren auf
`1.0` zurückdrehen. Empfehlung: `1.4.1`, dann passen App, Website und
`version.json` zusammen.

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

ACCOUNT DELETION (5.1.1(v))
Sidebar, gear icon, "Delete account". It removes the account itself plus the user document, friendships, invite entries and the user's contributions to group maps. For accounts created with Sign in with Apple, the Apple token is revoked as part of the deletion.

OFFLINE
The app also runs without a connection. It ships with a place list of about 70,000 cities, so search and new entries work in airplane mode and sync once the device is back online. Only the map imagery itself needs a connection; a short notice explains that.

USER CONTENT (1.2)
Users can add photos and place names, but nothing they add is distributed broadly. A map is visible only to friends both sides confirmed through an invite link, and places and photos inside a group only to the members of that group. There is no feed, no public profile, no discovery and no messaging. That is why the age rating questionnaire answers "no" to user-generated content: the content exists, but it is shared privately rather than distributed.

Users can remove a friend, leave a group, or, as the group creator, remove a member at any time, which also removes that person's entries from their view. Abuse can be reported by email and reports are handled within 24 hours. The procedure is documented at https://travel.marinpesa.dev/support.html

PRIVACY
Data is stored with Google Firebase (Authentication, Firestore). Privacy policy: https://travel.marinpesa.dev/privacy.html
Support: https://travel.marinpesa.dev/support.html
Contact: pesamarin81@gmail.com
```

### Veröffentlichung

„Diese Version manuell veröffentlichen" ist die ruhigere Wahl: Die App geht
dann erst live, wenn du auf den Knopf drückst, und nicht automatisch mitten in
der Nacht nach der Freigabe.
