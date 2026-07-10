#!/bin/bash
# Install Nepali fonts for local PDF viewing (macOS)
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FONT_DIR="$HOME/Library/Fonts"

mkdir -p "$FONT_DIR"

for font in preeti.ttf kalimati-regular.otf; do
  src="$ROOT/fonts/$font"
  if [ ! -f "$src" ]; then
    echo "Warning: $src not found, skipping"
    continue
  fi
  cp "$src" "$FONT_DIR/$font"
  echo "Installed $font to $FONT_DIR/$font"
done

echo "Restart Preview/Pages if open."
