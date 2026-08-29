#!/usr/bin/env bash
# Guards the two things that silently break an F-Droid / IzzyOnDroid release:
#   1. android/ drifting out of sync with app.json (the committed native project
#      is what F-Droid's buildserver compiles, so it must match the config)
#   2. a missing changelog for the current versionCode (F-Droid names changelog
#      files after the versionCode, so a mismatch just yields an empty changelog)
set -euo pipefail
cd "$(dirname "$0")/.."

fail=0

echo "==> Regenerating android/ from app.json"
npx expo prebuild --platform android --no-install --clean >/dev/null

if [ -n "$(git status --porcelain -- android)" ]; then
  echo "ERROR: android/ is out of sync with app.json."
  echo "       Run 'npm run prebuild' and commit the result."
  git status --porcelain -- android
  git --no-pager diff --stat -- android
  fail=1
else
  echo "    android/ matches app.json"
fi

VERSION_CODE=$(node -p "require('./app.json').expo.android.versionCode")
VERSION_NAME=$(node -p "require('./app.json').expo.version")
CHANGELOG="fastlane/metadata/android/en-US/changelogs/${VERSION_CODE}.txt"

echo "==> Checking changelog for versionCode ${VERSION_CODE} (v${VERSION_NAME})"
if [ ! -s "$CHANGELOG" ]; then
  echo "ERROR: ${CHANGELOG} is missing or empty."
  echo "       F-Droid and IzzyOnDroid read release notes from that path."
  fail=1
else
  echo "    ${CHANGELOG} present"
fi

exit $fail
