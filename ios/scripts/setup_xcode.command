#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IOS="$ROOT/ios"
cd "$IOS"

if ! command -v xcodegen >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Installing XcodeGen…"
    brew install xcodegen
  else
    echo "XcodeGen is required. Install Homebrew first: https://brew.sh"
    exit 1
  fi
fi

echo "Preparing CITYMUS assets…"
bash scripts/prepare_assets.sh

echo "Generating CITYMUS.xcodeproj…"
xcodegen generate

echo "Opening Xcode…"
open CITYMUS.xcodeproj

cat <<'EOF'

CITYMUS is ready in Xcode.

One-time steps:
1. Select target CITYMUS → Signing & Capabilities → choose your Apple Developer Team.
2. Select target CITYMUSWidgets → choose the same Team.
3. Confirm App Group is enabled for both targets:
   group.com.easylearnfromtw.citymus
4. Connect your iPhone, select it as the Run destination, then press Run.

After installation, open CITYMUS once and play a track.
The native app will own the playback session so lock-screen / widget returns
can route back to CITYMUS instead of Safari or another app.
EOF
