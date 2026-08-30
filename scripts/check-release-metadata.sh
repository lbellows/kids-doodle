#!/usr/bin/env bash
# Guards the two things that silently break a release:
#   1. android/ drifting out of sync with app.json (the committed native project
#      is what actually gets compiled, so it must match the config)
#   2. a missing changelog for the current versionCode (`fdroid update` names
#      changelog files after the versionCode, so a mismatch just yields an empty
#      changelog in the repo listing)
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

VERSION_CODE=$(node -p "String(require('./app.json').expo.android.versionCode)")
VERSION_NAME=$(node -p "String(require('./app.json').expo.version)")
CHANGELOG="fastlane/metadata/android/en-US/changelogs/${VERSION_CODE}.txt"

echo "==> Checking changelog for versionCode ${VERSION_CODE} (v${VERSION_NAME})"
if [ ! -s "$CHANGELOG" ]; then
  echo "ERROR: ${CHANGELOG} is missing or empty."
  echo "       F-Droid reads release notes from that path."
  fail=1
else
  echo "    ${CHANGELOG} present"
fi

# The build emits one APK per ABI and each carries its own versionCode
# (versionCode * 10 + offset), so each needs its own copy of the changelog or
# that architecture's listing shows no release notes at all.
echo "==> Checking the per-ABI changelogs"
for offset in $(node -p "Object.values(require('./plugins/withAbiSplits.js').ABI_VERSION_CODE_OFFSETS).join(' ')"); do
  ABI_CODE=$((VERSION_CODE * 10 + offset))
  ABI_CHANGELOG="fastlane/metadata/android/en-US/changelogs/${ABI_CODE}.txt"
  if [ ! -s "$ABI_CHANGELOG" ]; then
    echo "ERROR: ${ABI_CHANGELOG} is missing or empty."
    echo "       Run 'npm run changelogs' to copy ${CHANGELOG} to every per-ABI versionCode."
    fail=1
  elif ! cmp -s "$CHANGELOG" "$ABI_CHANGELOG"; then
    echo "ERROR: ${ABI_CHANGELOG} differs from ${CHANGELOG}."
    echo "       Edit ${CHANGELOG} and re-run 'npm run changelogs'."
    fail=1
  else
    echo "    ${ABI_CHANGELOG} present"
  fi
done

exit $fail
