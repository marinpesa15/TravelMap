#!/usr/bin/env bash
# Baut data/basemap.pmtiles mit mehr Detail aus dem Protomaps-Planet-Build
# (OpenStreetMap, taeglich aktualisiert). Gleiche Datei, gleiches Schema wie
# die gebuendelte Natural-Earth-Karte aus scripts/build-basemap-ne.mjs, nur
# mit Strassen, Gebaeuden und Ortsnamen bis zur gewaehlten Zoomstufe.
#
# Zwei Einsatzarten:
#   1. Als gebuendelte Karte: MAXZOOM 7 bis 8 haelt die App unter 150 MB.
#   2. Als Netzkarte: MAXZOOM 10 bis 12, Datei auf Cloudflare R2, Firebase
#      Storage oder einen anderen Host mit HTTP-Range-Unterstuetzung legen
#      und die URL als BASEMAP_REMOTE_URL in js/constants.js eintragen.
#
# Voraussetzung: das pmtiles-Kommandozeilenwerkzeug (brew install pmtiles,
# oder https://github.com/protomaps/go-pmtiles/releases).
#
# Aufruf: scripts/build-basemap.sh [maxzoom] [out] [bbox]
#   maxzoom  Standard 7
#   out      Standard data/basemap.pmtiles
#   bbox     optional "minlon,minlat,maxlon,maxlat", z.B. nur Europa
#
# Groessen zur Orientierung (ganze Welt): Zoom 7 etwa 100 MB, Zoom 8 etwa
# 250 MB, Zoom 10 mehrere GB. Vor dem Buendeln die Datei messen.
set -euo pipefail

MAXZOOM="${1:-7}"
OUT="${2:-$(cd "$(dirname "$0")/.." && pwd)/data/basemap.pmtiles}"
BBOX="${3:-}"
BUILD_INDEX="https://build.protomaps.com/builds.json"

if ! command -v pmtiles >/dev/null 2>&1; then
  echo "pmtiles fehlt. Installieren mit: brew install pmtiles" >&2
  exit 1
fi

# Neuester Build: builds.json listet die Dateien, die letzte ist die aktuelle.
LATEST="$(curl -fsSL "$BUILD_INDEX" | grep -o '"key":"[0-9]*\.pmtiles"' | tail -1 | cut -d'"' -f4)"
if [ -z "$LATEST" ]; then
  echo "Konnte keinen Protomaps-Build finden ($BUILD_INDEX)" >&2
  exit 1
fi
SRC="https://build.protomaps.com/$LATEST"
echo "Quelle: $SRC"
echo "Ziel:   $OUT (Zoom 0-$MAXZOOM${BBOX:+, Ausschnitt $BBOX})"

ARGS=(extract "$SRC" "$OUT" --maxzoom="$MAXZOOM")
if [ -n "$BBOX" ]; then ARGS+=(--bbox="$BBOX"); fi
pmtiles "${ARGS[@]}"

pmtiles show "$OUT" | head -20
echo "Fertig: $(du -h "$OUT" | cut -f1)"
