# App-Store-Screenshots mit Demo-Daten

Die Screenshots in `docs/store/screenshots/` entstehen in der echten App im
iOS-Simulator. Firebase ist dabei durch Stubs mit erfundenen Daten ersetzt
(Nutzerin „Lena Hoffmann", drei Freunde, zwei Gruppen, sieben Stories). Die
Stubs machen keine Anfragen an Firebase, Spotify oder das Update-Manifest:
`stubs/config.js` weist jeden `fetch` auf fremde Origins ab.

Nichts davon landet im echten App-Bundle (`scripts/**` steht in
`BUNDLE_IGNORE`). Die Stubs werden erst nach der Installation in den
App-Container des Simulators kopiert.

| Datei | Wohin im App-Container (`public/`) |
|---|---|
| `stubs/config.js` | `js/config.js` |
| `stubs/vendor/*.js` | `vendor/firebase/10.12.0/` |
| `stubs/demo/demo-data.js` | `demo/`: Nutzerdokument, Freunde, Gruppen, Stories |
| `stubs/demo/driver.js` | `demo/`: öffnet nach dem Start den Zustand aus `demo/demo-state.js` |
| `stubs/demo/{a,b,c}.jpg` | `demo/`: KI-generierte Lissabon-Fotos für die Story |

Zustände: `karte`, `story`, `formular`, `orte`, `laender`, `freunde`.

## Ablauf

```sh
npm run ios:sync
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/tm-shots/dd build
git status          # ios/ muss sauber bleiben, sonst git checkout -- <datei>

UDID=$(xcrun simctl create "TM Store Shots" \
  com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro-Max \
  com.apple.CoreSimulator.SimRuntime.iOS-27-0)
xcrun simctl boot $UDID && xcrun simctl bootstatus $UDID -b
xcrun simctl install $UDID /tmp/tm-shots/dd/Build/Products/Debug-iphonesimulator/App.app

scripts/store-screenshots/shoot.sh $UDID            # alle sechs
scripts/store-screenshots/shoot.sh $UDID story      # nur einzelne Zustände

xcrun simctl shutdown $UDID && xcrun simctl delete $UDID
```

`shoot.sh` kopiert die Stubs, setzt die Statusleiste (9:41, voller Akku und
Empfang) und den Dunkelmodus, startet die App je Zustand neu, wartet `WAIT`
Sekunden (Standard 30) und nimmt mit `simctl io screenshot` auf. Ein iPhone 18
Pro Max liefert 1320x2868 (6,9 Zoll). Die 6,5-Zoll-Fassung entsteht daraus mit
`sips`: auf 1284 Breite skalieren, dann mittig auf 2778 Höhe beschneiden.
