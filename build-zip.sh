#!/usr/bin/env bash
# Package the extension for Chrome Web Store upload.
# Includes only the files Chrome runs — not docs, assets, or store art.
set -euo pipefail
cd "$(dirname "$0")"

VERSION="$(node -p "require('./manifest.json').version")"
OUT="english-polisher-${VERSION}.zip"

rm -f "$OUT"
zip -rq "$OUT" \
  manifest.json \
  background.js \
  content.js \
  popup.html popup.js \
  options.html options.js \
  icons \
  -x '.*'

echo "Built $OUT"
unzip -l "$OUT"
