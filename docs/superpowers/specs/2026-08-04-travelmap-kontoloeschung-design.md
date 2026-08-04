# Kontolöschung in TravelMap

**Datum:** 2026-08-04
**Status:** abgenommen
**Betrifft:** App-Store-Blocker 1 (Guideline 5.1.1(v))

## Ziel

Wer sich in TravelMap anmeldet, muss sein Konto **in der App** wieder löschen können,
einschließlich der zugehörigen Daten. Heute steht in `privacy.html` nur eine E-Mail-Adresse.
Das ist DSGVO-konform, aber nicht App-Store-konform, und laut Recherche vom 18.07. der
Ablehnungsgrund mit dem höchsten Volumen.

Zweites Ziel: Der Ablauf muss **später im nativen Capacitor-Build funktionieren**, ohne neu
geschrieben zu werden.

## Befund: TravelMap braucht keinen Server

Lumiq hat für dieselbe Aufgabe einen FastAPI-Server auf Cloud Run gebaut. Hier ist das nicht
nötig, und der Grund liegt im Datenmodell.

| | Lumiq | TravelMap |
|---|---|---|
| Nutzerdaten | verschachtelte Subcollections (Days, Progress, Training) | Arrays **im** User-Dokument |
| Löschung | braucht `recursive_delete`, nur im Admin SDK | ein `deleteDoc` nimmt alles mit |
| Rest | | flache `friends`-Subcollection, auflistbar |

Dazu kommt, dass die bestehenden Security Rules dem Client bereits alles erlauben, was
gebraucht wird:

| Operation | Regel |
|---|---|
| Eigenes User-Doc löschen | `allow delete: request.auth.uid == uid` |
| Eigene `friends`-Subcollection lesen und löschen | `allow read, delete` für beide Parteien |
| Spiegel-Eintrag bei Freunden (`users/{freund}/friends/{ich}`) | `allow delete: request.auth.uid == friendUid` |
| Eigenes Invite-Doc löschen | `allow delete: resource.data.uid == request.auth.uid` |
| Aus Gruppen austreten | Mitglieder dürfen sich selbst aus `members` entfernen |
| Eigene Städte aus Gruppen entfernen | Mitglieder dürfen `groups/{id}` updaten |

**Konsequenz:** Reine Client-Lösung. Kein Cloud Run, kein Blaze-Plan, keine laufenden Kosten.

## Entscheidungen

| Frage | Entscheidung | Begründung |
|---|---|---|
| Gruppen, die ich erstellt habe | **Übergabe an das erste verbleibende Mitglied.** Bin ich der Letzte, wird die Gruppe gelöscht | Fremde Daten bleiben heil, und es entstehen keine Gruppen mit totem Ersteller, die niemand mehr löschen kann |
| Meine Städte in Gruppen | **Werden entfernt** | An jeder Stadt hängt `addedBy: { uid, photoURL, displayName }`. Anonymisieren würde reichen, aber Entfernen ist die klarere Zusage gegenüber dem, was in `privacy.html` steht |
| Bestätigung | **Warnung mit konkreten Zahlen, danach Google-Neuanmeldung** | Firebase verlangt für `user.delete()` ohnehin eine frische Anmeldung. Ein zusätzlich einzutippendes Wort wäre Zeremonie |
| Bedenkzeit | **Keine.** Löschung ist sofort | Verzögerte Ausführung bräuchte einen Server, und genau den wollen wir hier nicht |
| Server | **Nein** | Siehe Befund oben |

### Bekannte Einschränkung

Städte, die **vor** der Einführung der personalisierten Gruppen-Pins eingetragen wurden, haben
kein `addedBy`. Sie lassen sich niemandem zuordnen und bleiben deshalb in der Gruppe stehen.
`markers.js` behandelt solche Städte bereits als normalen Punkt, es entsteht also kein Fehler,
nur eine Lücke in der Zusage. Wird in der Warnung nicht erwähnt, weil es die meisten Nutzer
nicht betrifft.

## Architektur

Neues Modul **`js/account.js`**, das den Ablauf orchestriert und **nichts über Login-Provider
weiß**. Es ruft eine neue Funktion in `auth.js` auf:

```js
// js/auth.js
/** Frische Anmeldung, Voraussetzung für user.delete(). */
export function reauthenticate() { /* Web: reauthenticateWithPopup(auth, provider) */ }
```

### Warum diese Trennung

`signInWithPopup` funktioniert im Capacitor-WebView nicht, Google blockt eingebettete
WebViews. Der native Build braucht ein Google-Sign-In-Plugin und danach
`signInWithCredential`. Liegt die Neuanmeldung hinter genau einer Funktion, wird beim
Portieren **nur diese eine Funktion** getauscht, und der gesamte Löschablauf bleibt
unberührt.

Nebeneffekt: Das ist dieselbe Abstraktion, die Sign in with Apple später braucht.

### Modulgrenzen

| Modul | Aufgabe | Kennt |
|---|---|---|
| `js/auth.js` | Anmeldung, Abmeldung, Neuanmeldung | Firebase Auth, Provider |
| `js/account.js` | Löschablauf, Reihenfolge, Fehlerbehandlung | nur das IO-Objekt |
| `js/account-io.js` | dünne Hülle um Firestore und Auth, keine Logik | Firestore, `auth.reauthenticate()` |
| `js/account-logic.js` | reine Funktionen ohne Firebase | nichts |
| `js/settings.js` | Gefahrenzone, Warnmodal, Fortschritt | `account.js`, `i18n.js` |

`account-logic.js` existiert, damit die riskanten Entscheidungen ohne Firebase testbar sind.

`account-io.js` ist die zweite Hälfte davon. `deleteAccount(uid, { io })` bekommt das
IO-Objekt injiziert und benutzt im Normalfall `firestoreIo`. Im Test kommt ein Fake herein,
das nur seine Aufrufe mitschreibt. Damit lässt sich die **Reihenfolge** prüfen, ohne Firebase
zu mocken, und genau das ist die Zusage, die dieser Entwurf macht: Der Auth-Account fällt
zuletzt.

## Löschablauf

Die Reihenfolge ist die eigentliche Sicherheitsmaßnahme: **der Auth-Account zuletzt.**

1. **Neu anmelden** über `auth.reauthenticate()`. Fehlgeschlagen oder abgebrochen: Abbruch,
   nichts wurde verändert.
2. Eigenes User-Dokument lesen, `invite_token` merken.
3. **Gruppen.** Alle Gruppen laden, in denen ich Mitglied bin. Je Gruppe **ein einziges
   `updateDoc`**, damit die Änderung pro Gruppe atomar ist:
   - meine Städte aus `visited_cities` und `wishlist_cities` entfernen (`addedBy.uid === meineUid`)
   - bin ich `created_by` und es bleiben andere Mitglieder: `created_by` auf das **erste
     verbleibende Mitglied** in `members` setzen und mich aus `members` entfernen
   - bin ich das letzte Mitglied: Gruppe per `deleteDoc` löschen
   - sonst: nur aus `members` entfernen
4. **Freunde.** Eigene `friends`-Subcollection auflisten. Je Freund beide Richtungen löschen:
   `users/{freundUid}/friends/{meineUid}` und `users/{meineUid}/friends/{freundUid}`.
   Als `writeBatch`, in Blöcken zu höchstens 500 Operationen.
5. `/invites/{invite_token}` löschen.
6. `/users/{meineUid}` löschen. Nimmt Städte, Länder, Consent und Profil mit, weil alles als
   Felder im Dokument liegt.

   > **Wichtig:** Firestore löscht beim Entfernen eines Dokuments **keine Subcollections mit.**
   > Genau deshalb muss Schritt 4 vorher laufen. Würde man das User-Dokument zuerst löschen,
   > bliebe `users/{meineUid}/friends/*` als verwaiste Subcollection zurück, unsichtbar in der
   > Konsole und für den Client nicht mehr erreichbar.
7. **`user.delete()`**.
8. localStorage aufräumen (Theme, Consent, gecachter Zustand), zurück auf `index.html`.

### Warum diese Reihenfolge

Bricht der Ablauf zwischen 2 und 6 ab, existiert der Auth-Account noch und der Nutzer kann
die Löschung erneut anstoßen. Jeder Schritt verträgt "ist schon weg", der Ablauf ist also
wiederholbar.

Umgekehrt wäre es fatal: Ohne Auth-Account fehlt die Berechtigung, die eigenen Daten zu
löschen. Sie lägen dann dauerhaft da, ohne dass jemand sie noch entfernen könnte.

## Security Rules

`created_by` ist heute unveränderlich (`request.resource.data.created_by ==
resource.data.created_by`). Für die Übergabe muss eine eng gefasste Ausnahme dazu, damit
niemand eine fremde Gruppe übernehmen kann:

```
// created_by darf sich nur ändern, wenn der aktuelle Ersteller
// selbst austritt und an ein verbleibendes Mitglied übergibt
request.resource.data.created_by == resource.data.created_by
|| (
  request.auth.uid == resource.data.created_by
  && !(request.auth.uid in request.resource.data.members)
  && request.resource.data.created_by in request.resource.data.members
)
```

Die drei Bedingungen zusammen heißen: nur der aktuelle Ersteller, nur beim eigenen Austritt,
und nur an jemanden, der danach noch Mitglied ist.

Dazu `allow delete` erweitern, damit ein letztes verbliebenes Mitglied die Gruppe auch dann
löschen kann, wenn es nicht der Ersteller ist:

```
allow delete: if request.auth != null && (
  request.auth.uid == resource.data.created_by
  || (request.auth.uid in resource.data.members && resource.data.members.size() == 1)
);
```

Das ist ein Sicherheitsnetz für Altbestände, deren Ersteller nicht mehr existiert.

## UI

**Gefahrenzone** am Ende des bestehenden Settings-Modals, optisch abgesetzt.

Die Warnung nennt **konkrete Zahlen aus den echten Daten**, nicht abstrakte Kategorien:

> Dein Konto und diese Daten werden endgültig gelöscht:
> 14 Städte, 9 Länder, 3 Freundschaften, deine Beiträge in 2 Gruppen.
> Das lässt sich nicht rückgängig machen.

Danach der Google-Popup. Während des Ablaufs eine Fortschrittsanzeige, weil Schritt 3 und 4
bei vielen Gruppen und Freunden mehrere Sekunden dauern können.

Alle Strings in `i18n.js`, Sprachen **en** und **de**.

## Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| Neuanmeldung abgebrochen | Abbruch ohne Änderung, Modal bleibt offen |
| Netz weg vor dem Start | `navigator.onLine` prüfen, verständliche Meldung statt Absturz |
| Netz weg mitten drin | Abbruch mit Hinweis "teilweise gelöscht, bitte erneut versuchen". Konto existiert noch |
| Einzelne Gruppe schlägt fehl | Ablauf bricht ab, Konto bleibt. Kein Weitermachen bei unklarem Zustand |
| `user.delete()` schlägt fehl | Fehler anzeigen. Daten sind weg, Konto nicht. Nutzer kann erneut auslösen |

Grundsatz: Bei Unklarheit **abbrechen und den Auth-Account stehen lassen**. Ein wiederholbarer
Halbzustand ist besser als ein Konto ohne Zugriff auf die eigenen Reste.

## Tests

TravelMap hat bewusst kein `package.json` und keinen Build-Schritt. Das bleibt so für die
Laufzeit: Die App lädt weiterhin alles als ESM vom CDN.

Für die Tests kommt **Vitest als reine devDependency** dazu. Getestet wird `account-logic.js`,
also die Stellen, an denen ein Fehler fremde Daten zerstört:

- Neuer Ersteller wird korrekt gewählt (erstes verbleibendes Mitglied)
- Letztes Mitglied führt zum Löschen statt zur Übergabe
- Nur eigene Städte werden gefiltert, fremde bleiben unangetastet
- Städte ohne `addedBy` bleiben stehen
- Ein Nicht-Ersteller ändert `created_by` nicht

Firebase wird gemockt. Der Ablauf in `account.js` bekommt einen Test, der die **Reihenfolge**
prüft, insbesondere dass `user.delete()` nach allen Datenoperationen kommt.

Zusätzlich ein manueller Durchlauf mit einem Testkonto vor dem Merge, inklusive eines zweiten
Kontos als Freund und Gruppenmitglied, um die Spiegel-Einträge und die Übergabe real zu sehen.

## Nicht im Umfang

- Sign in with Apple. Wartet auf den Apple Developer Account.
- Datenexport vor der Löschung.
- Serverseitige Nachräumung.
- Anonymisierung statt Entfernung bei Gruppen-Städten.
- Offline-Handling. Eigenes Thema, siehe Store-Readiness in der Projektnotiz.
