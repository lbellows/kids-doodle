#!/usr/bin/env bash
# Copies the changelog for this release to the versionCode of every per-ABI APK.
#
# F-Droid and IzzyOnDroid look up release notes by versionCode
# (fastlane/metadata/android/en-US/changelogs/<versionCode>.txt), and since the
# build produces one APK per architecture, each of those APKs has its own
# versionCode — so each needs its own copy of the same text. Write the changelog
# once, named after the versionCode in app.json, then run this.
set -euo pipefail
cd "$(dirname "$0")/.."

CHANGELOG_DIR=fastlane/metadata/android/en-US/changelogs
VERSION_CODE=$(node -p "String(require('./app.json').expo.android.versionCode)")
SOURCE="${CHANGELOG_DIR}/${VERSION_CODE}.txt"

if [ ! -s "$SOURCE" ]; then
  echo "ERROR: ${SOURCE} is missing or empty."
  echo "       Write the release notes there first — it is named after the"
  echo "       versionCode in app.json, not the version name."
  exit 1
fi

for offset in $(node -p "Object.values(require('./plugins/withAbiSplits.js').ABI_VERSION_CODE_OFFSETS).join(' ')"); do
  cp "$SOURCE" "${CHANGELOG_DIR}/$((VERSION_CODE * 10 + offset)).txt"
done

echo "Synced ${SOURCE} to the per-ABI versionCodes."
