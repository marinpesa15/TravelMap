#!/bin/bash
# App-Store-Screenshots mit Demo-Daten im iOS-Simulator, siehe README.md hier.
#
#   scripts/store-screenshots/shoot.sh <udid> [zustand ...]
#
# Erwartet die installierte App auf dem gebooteten Simulator <udid>. Ersetzt in
# deren Bundle js/config.js und das Firebase-SDK durch die Stubs aus stubs/,
# startet die App je Zustand neu und nimmt den Bildschirm auf. Ergebnis:
# docs/store/screenshots/6.9 (1320x2868) und daraus 6.5 (1284x2778).
set -euo pipefail

UDID=${1:?usage: shoot.sh <udid> [state ...]}
shift
BUNDLE=com.marinpesa.travelmap
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
OUT69="$ROOT/docs/store/screenshots/6.9"
OUT65="$ROOT/docs/store/screenshots/6.5"
WAIT=${WAIT:-30}

# Datei-Nummer:Zustand im Demo-Treiber
SHOTS=(01-karte:karte 02-story:story 03-story-formular:formular 04-orte:orte 05-laender:laender 06-freunde:freunde)
if [ $# -gt 0 ]; then
  SEL=()
  for s in "${SHOTS[@]}"; do for want in "$@"; do [ "${s#*:}" = "$want" ] && SEL+=("$s"); done; done
  SHOTS=("${SEL[@]}")
fi

PUB="$(xcrun simctl get_app_container "$UDID" "$BUNDLE" app)/public"
cp "$HERE/stubs/config.js" "$PUB/js/config.js"
cp "$HERE"/stubs/vendor/*.js "$PUB/vendor/firebase/10.12.0/"
mkdir -p "$PUB/demo"
cp "$HERE"/stubs/demo/* "$PUB/demo/"
# Treiber-Importe auf die ?v=-Versionen aus js/app.js bringen (gleiche Modul-Instanz)
for m in map hub story-viewer story-form i18n; do
  v=$(grep -o "\./$m\.js?v=[0-9]*" "$PUB/js/app.js" | head -1 | sed 's/.*v=//')
  [ -n "$v" ] || { echo "no version for $m.js in app.js" >&2; exit 1; }
  sed -i '' "s#\.\./js/$m\.js?v=[0-9]*#../js/$m.js?v=$v#" "$PUB/demo/driver.js"
done

xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState discharging --batteryLevel 100 --cellularBars 4 --wifiBars 3
xcrun simctl ui "$UDID" appearance dark

mkdir -p "$OUT69" "$OUT65"
for s in "${SHOTS[@]}"; do
  name=${s%%:*}; state=${s#*:}
  echo "export default '$state';" > "$PUB/demo/demo-state.js"
  xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true
  xcrun simctl launch "$UDID" "$BUNDLE" >/dev/null
  sleep "$WAIT"
  xcrun simctl io "$UDID" screenshot "$OUT69/$name.png" >/dev/null 2>&1
  # 6,5 Zoll: auf 1284 Breite skalieren, dann mittig auf 2778 Hoehe beschneiden
  sips --resampleWidth 1284 "$OUT69/$name.png" --out "$OUT65/$name.png" >/dev/null
  sips --cropToHeightWidth 2778 1284 "$OUT65/$name.png" >/dev/null
  echo "$name ($state)"
done

sips -g pixelWidth -g pixelHeight "$OUT69"/*.png "$OUT65"/*.png | grep -B2 pixelHeight | paste - - - | awk '{print $1, $3"x"$5}'
