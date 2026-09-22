# Material für die App-Store-Einreichung

## Screenshots

`screenshots/` enthält fünf Aufnahmen in **1320x2868** (6,9 Zoll, iPhone 17 Pro Max).
Das ist die Größe, die App Store Connect für die größte iPhone-Klasse verlangt.

| Datei | Inhalt |
|---|---|
| `01-karte.png` | Weltkarte mit besuchten Städten |
| `02-seitenleiste.png` | Seitenleiste mit Zählern, Freunden und Gruppen |
| `03-laender.png` | Länderansicht mit eingefärbten Ländern |
| `04-gruppe.png` | Gruppenkarte mit Zurück-Banner |
| `05-suche.png` | Ortssuche mit Treffern aus der lokalen Liste |

Erzeugt am 22.09.2026 aus einer Kopie der App mit Demo-Daten (Zweig
`test/local-demo`), aufgenommen über Playwright mit Viewport 440x956 und
`device_scale_factor=3`. Direkte Taps im Simulator kamen auf dem Pro Max in der
Seitenleiste nicht an, über die Weboberfläche mit `element.click()` dagegen
zuverlässig. Die Oberfläche ist dieselbe wie im App-Bundle.

## Was sonst noch gebraucht wird

- **Datenschutz-URL:** https://travel.marinpesa.dev/privacy.html
- **Bundle-ID:** com.marinpesa.travelmap
- **Datentypen im Fragebogen** (müssen zu `ios/App/App/PrivacyInfo.xcprivacy` passen):
  E-Mail-Adresse, Name, Benutzer-ID, Fotos oder Videos, andere Nutzerinhalte.
  Jeweils Zweck „App-Funktionalität", mit dem Konto verknüpft, kein Tracking.
- Noch offen: Store-Texte (Name, Untertitel, Beschreibung, Keywords) und die
  Review-Informationen mit Testkonto.
