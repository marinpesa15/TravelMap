# Material für die App-Store-Einreichung

## Screenshots

`screenshots/` enthält denselben Satz in zwei Größen:

| Ordner | Größe | Wofür |
|---|---|---|
| `6.9/` | 1320x2868 | 6,9-Zoll-Klasse (iPhone 17 Pro Max) |
| `6.5/` | 1284x2778 | 6,5-Zoll-Slot in App Store Connect |

App Store Connect verlangt je nach Slot eine exakte Größe und weist alles andere
mit „Mindestens ein Screenshot weist falsche Maße auf" ab.

| Datei | Inhalt |
|---|---|
| `01-karte.png` | Karte über Europa mit Pins, Story-Ringen, Statistik und Tab-Leiste |
| `02-story.png` | Story-Viewer auf einem Lissabon-Foto mit Ort, Datum, Text, Sprachnotiz und Song |
| `03-story-formular.png` | Ausgefülltes Story-Formular: Datum, drei Fotos, Text, Sprachnotiz, Song, für Freunde sichtbar |
| `04-orte.png` | Orte-Sheet mit Filterchips und Ortsliste |
| `05-laender.png` | Länderansicht mit eingefärbten besuchten und Wunschländern |
| `06-freunde.png` | Freunde-Sheet mit den Tabs Freunde und Gruppen |

Erzeugt am 15.11.2026 für TravelMap 2.0 in der echten App im iOS-Simulator
(iPhone 18 Pro Max, iOS 27.0, Dunkelmodus, Statusleiste 9:41). Firebase war
dabei durch Stubs mit erfundenen Demo-Daten ersetzt (Nutzerin „Lena Hoffmann",
erfundene Freunde und Gruppen, KI-generierte Lissabon-Fotos), ohne Verbindung
zu Firebase oder Spotify. Stubs, Skript und Befehle liegen in
`scripts/store-screenshots/`. Der Simulator liefert 1320x2868, die
6,5-Zoll-Fassung entsteht daraus mit `sips` (auf 1284 Breite skaliert, mittig
auf 2778 Höhe beschnitten).

## Was sonst noch gebraucht wird

- **Datenschutz-URL:** https://travel.marinpesa.dev/privacy.html
- **Bundle-ID:** com.marinpesa.travelmap
- **Datentypen im Fragebogen** (müssen zu `ios/App/App/PrivacyInfo.xcprivacy` passen):
  E-Mail-Adresse, Name, Benutzer-ID, Fotos oder Videos, Audiodaten (Sprachnotizen, seit 2.0), andere Nutzerinhalte.
  Jeweils Zweck „App-Funktionalität", mit dem Konto verknüpft, kein Tracking.
- Noch offen: Store-Texte (Name, Untertitel, Beschreibung, Keywords) und die
  Review-Informationen mit Testkonto.
