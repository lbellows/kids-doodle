#!/usr/bin/env bash
# Renders every icon PNG from assets/icon.svg. Needs rsvg-convert and ImageMagick.
#
# The adaptive-icon foreground is the scribble alone, scaled into the central
# safe zone so no launcher mask (circle, squircle, teardrop) clips it.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=assets/icon.svg
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Full-bleed square: legacy launcher icon and the store listing.
rsvg-convert -w 1024 "$SRC" | magick - -alpha off assets/icon.png
magick assets/icon.png -resize 512x512 fastlane/metadata/android/en-US/images/icon.png

# Adaptive foreground: no background, scribble scaled to 66% about the centre.
sed -e '/id="background"/d' \
    -e 's|<g id="scribble">|<g id="scribble" transform="translate(512 512) scale(0.66) translate(-512 -512)">|' \
    "$SRC" > "$tmp/foreground.svg"
rsvg-convert -w 1024 "$tmp/foreground.svg" -o assets/android-icon-foreground.png

# Splash: the scribble alone at full size. expo-splash-screen already fits it
# into a small centred box, so it gets no safe-zone shrink of its own.
sed -e '/id="background"/d' "$SRC" > "$tmp/splash.svg"
rsvg-convert -w 1024 "$tmp/splash.svg" | magick - -trim +repage -background none -gravity center \
  -extent '%[fx:max(w,h)]x%[fx:max(w,h)]' assets/splash-icon.png

# Monochrome (Android 13 themed icons): the foreground's shape, filled white.
magick assets/android-icon-foreground.png -fill white -colorize 100 assets/android-icon-monochrome.png

echo "Rendered icons from ${SRC}. Run 'npm run prebuild' to regenerate android/."
