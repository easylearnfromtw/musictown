#!/bin/sh
set -eu
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/icon-512.png"
OUT="$ROOT/ios/CITYMUS/Assets.xcassets/AppIcon.appiconset"
[ -f "$SRC" ] || exit 0
mkdir -p "$OUT"
make_icon(){ /usr/bin/sips -z "$1" "$1" "$SRC" --out "$OUT/$2" >/dev/null; }
make_icon 40 icon-20@2x.png
make_icon 60 icon-20@3x.png
make_icon 58 icon-29@2x.png
make_icon 87 icon-29@3x.png
make_icon 80 icon-40@2x.png
make_icon 120 icon-40@3x.png
make_icon 120 icon-60@2x.png
make_icon 180 icon-60@3x.png
make_icon 1024 icon-1024.png
