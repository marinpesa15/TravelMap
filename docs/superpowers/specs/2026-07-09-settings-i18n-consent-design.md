# Settings-Menü, i18n (DE/EN) & Privacy-Consent — Design

**Datum:** 2026-07-09
**Status:** Approved

## Ziel

Vier zusammenhängende Features für TravelMap:

1. Zahnrad-Button (ersetzt den Theme-Toggle im Sidebar-Header) öffnet ein Settings-Modal
2. Settings-Modal enthält: Theme (Light/Dark), Sprache (English/Deutsch), Privacy-Links, Sign-out
3. Volle Zweisprachigkeit DE/EN für die gesamte UI
4. DSGVO-Consent-Banner nach dem Login + Datenschutzerklärung/Impressum-Seite

## Entscheidungen (mit Nutzer geklärt)

| Frage | Entscheidung |
|---|---|
| Settings-UI | Modal-Dialog (Muster: bestehendes Group-Modal) |
| Sprach-Default & Persistenz | Browser-Sprache beim Erstbesuch (de → Deutsch, sonst Englisch), Wahl in `localStorage` (`tm-lang`) |
| i18n-Ansatz | Eigenes Mini-Modul `js/i18n.js` (kein Build-Step, keine Dependency, Live-Umschalten ohne Reload) |
| Consent bei Ablehnen | Sign-out + Redirect zu `index.html` |
| Privacy-Seiten | Eigene `privacy.html` mit Datenschutzerklärung **und** Impressum, zweisprachig |

## 1. Zahnrad + Settings-Modal

- `map.html`: `#btn-theme` (☀️/🌙) im Sidebar-Header wird durch `#btn-settings` mit Zahnrad-SVG ersetzt (Stil wie bestehende Icons).
- Neues Overlay `#settings-modal` nach dem Group-Modal-Muster (Card-Optik, ✕ schließt, Backdrop-Klick schließt):
  - **Appearance**: Light/Dark als Zwei-Knopf-Auswahl (Muster: `radio-group` aus dem City-Dialog). Nutzt weiter den `tm-theme`-Key und die Logik in `theme.js` — nur der Trigger wandert vom Header-Button ins Modal.
  - **Language**: English/Deutsch, gleiche Zwei-Knopf-Optik. Wirkt sofort, ohne Reload.
  - Trennlinie, darunter Links **Privacy Policy** und **Impressum** → `privacy.html` (neuer Tab).
  - **Sign out**-Button (Danger-Optik). Der bisherige Sign-out-Button im Sidebar-Footer entfällt; im Footer bleibt nur „Add New Location".
  - **Versionsanzeige**: ganz unten im Modal, klein und gedimmt (`TravelMap v1.0.0`). Quelle ist eine Konstante `APP_VERSION` in neuem `js/version.js` (Start: `1.0.0`, wird pro Release manuell hochgezählt — einzige Stelle, an der die Version gepflegt wird).

## 2. i18n-Modul (`js/i18n.js`)

- Übersetzungs-Objekt `{ en: {...}, de: {...} }`, ~70 Keys.
- API:
  - `t(key, params)` — String in aktiver Sprache, Platzhalter-Ersetzung: `t('toast.cityAdded', {name})`.
  - `getLang()` / `setLang(lang)` — liest/setzt `tm-lang` in `localStorage`. Erstbesuch: `navigator.language` beginnt mit `de` → `de`, sonst `en`.
  - `applyTranslations()` — übersetzt alle Elemente mit `data-i18n`; Varianten `data-i18n-placeholder` und `data-i18n-title` für Placeholder/Tooltips.
- Statische Texte in `map.html` und `index.html` bekommen `data-i18n`-Attribute (Sidebar-Labels, Legende, Dialoge, Login-Seite).
- Dynamische Strings (~40 Toasts, Confirm-Dialoge, Empty-States, „Searching…") in `ui.js`/`app.js` werden auf `t()` umgestellt.
- Sprachwechsel: `setLang()` feuert ein `langchanged`-Event; `app.js` ruft `applyTranslations()` auf und rendert die dynamischen Sidebar-Listen über die vorhandenen Render-Funktionen neu. `<html lang>` wird mitgesetzt.
- **Nicht übersetzt**: Städte-/Ländernamen aus der Mapbox-Suche (bleiben englisch).

## 3. Consent-Banner (`js/consent.js`)

- Konstante `CONSENT_VERSION = 1` + Banner-Logik in neuem Modul.
- Ablauf `map.html`: Auth → User-Doc **lesen** → `consent.version >= CONSENT_VERSION`?
  - Ja → App startet normal.
  - Nein → blockierendes Modal (kein ✕, Backdrop schließt nicht). Erst nach Entscheidung geht es weiter.
- **Reihenfolge geändert**: `initUserProfile()` schreibt heute sofort nach Login. Neu: **vor Zustimmung keine Firestore-Writes** — Profil-Init, Invite-Token-Verarbeitung und Listener starten erst nach „Zustimmen".
- Banner-Inhalt (zweisprachig): was gespeichert wird (Google-Profildaten: Name, E-Mail, Avatar; Reisedaten; Freunde/Gruppen), Link zur Datenschutzerklärung, Buttons „Zustimmen" / „Ablehnen".
- **Zustimmen** → `consent: { version: 1, accepted_at: serverTimestamp() }` ins User-Doc, dann normaler App-Start.
- **Ablehnen** → `signOut()` → Redirect `index.html`.
- Bestehende User sehen das Banner einmalig beim nächsten Login. Erhöhung von `CONSENT_VERSION` zeigt es erneut.
- `index.html`: Hinweis unter dem Google-Button „Mit der Anmeldung akzeptierst du unsere Datenschutzerklärung" mit Link (übersetzt).
- `firestore.rules`: Ergänzung, die `consent` validiert (`is map`, `version is int`) — konsistent mit dem bestehenden Lockdown-Stil. Die Rules haben kein `hasOnly` am User-Doc, das neue Feld ist also schreibbar.

## 4. Privacy-Seite (`privacy.html`)

- Statisch, ohne Login erreichbar, kein Firebase-/Mapbox-Script. Nutzt bestehendes CSS (Dark/Light via `tm-theme` funktioniert mit).
- Zweisprachig: beide Sprachfassungen als getrennte Blöcke in der Datei, angezeigt per `tm-lang`, DE/EN-Umschalter oben auf der Seite. (Langer Fließtext über `data-i18n`-Keys wäre unhandlich.)
- Inhalt:
  - Verantwortlicher: Platzhalter `[DEIN NAME]` / `[DEINE E-MAIL]` — **muss vom Betreiber ausgefüllt werden**
  - Erhobene Daten: Google-Konto (Name, E-Mail, Avatar), Reisedaten, Freunde/Gruppen, Invite-Tokens, Gruppenfotos
  - Verarbeitung/Speicherort: Firebase/Google Cloud inkl. Hinweis auf US-Datentransfer
  - Mapbox: IP-Adresse bei Kartenabrufen
  - localStorage: Theme/Sprache — technisch notwendig, kein Cookie-Banner erforderlich
  - DSGVO-Rechte: Auskunft, Berichtigung, Löschung; Kontaktweg für Kontolöschung
  - Impressum-Sektion
- Verlinkt aus: Settings-Modal, Consent-Banner, Login-Seite.
- `firebase.json` served `**/*.html` bereits mit no-cache — keine Änderung nötig.

## Fehlerfälle

- Consent-Write schlägt fehl → Toast, Banner bleibt offen.
- User-Doc-Read schlägt fehl → bestehendes Fehlerverhalten („Error loading. Please reload.").

## Testen

Manuell (kein Test-Framework im Projekt):

1. Neuer Account → Banner erscheint, vor Entscheidung keine Firestore-Writes
2. Ablehnen → Logout + Redirect
3. Zustimmen → Banner erscheint bei erneutem Login nicht mehr
4. Bestehender User ohne Consent-Feld → Banner einmalig
5. Sprachwechsel DE↔EN: statische + dynamische Texte, ohne Reload, Map-Zustand bleibt
6. Theme-Wechsel aus dem Modal (CSS + Map-Style)
7. Sign-out aus dem Modal
8. `privacy.html` ohne Login, beide Sprachen, Dark/Light
9. Mobile: Modal + Banner auf kleinem Viewport
10. Invite-Link-Flow: Token wird erst nach Consent verarbeitet, geht aber nicht verloren

## Hinweis

Die Datenschutzerklärung ist eine sorgfältige Vorlage, keine Rechtsberatung — vor Veröffentlichung prüfen (lassen).
