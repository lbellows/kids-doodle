#!/usr/bin/env bash
# Installs a release APK on a running emulator and checks the app actually runs.
#
# This exists because release builds are minified: R8 strips and renames classes,
# and React Native resolves some of them by name from C++ or JavaScript, so a
# missing keep rule produces an APK that builds cleanly and then fails at
# runtime. Asserting on text from the first screen — rather than just that the
# process started — is what makes a stripped class show up as a failure here.
set -euo pipefail

APK=${1:?usage: scripts/smoke-test-apk.sh <apk>}
PACKAGE=com.kidsdoodle.app
# A fresh install has no PIN stored, so app/index.tsx redirects to /pin-setup.
# Reaching this text means AsyncStorage, expo-crypto, expo-router and the React
# Native bridge all survived minification.
EXPECTED_TEXT="Create a PIN"
TIMEOUT_SECONDS=90

adb wait-for-device
adb logcat -c
adb install -r "$APK"
adb shell am start -W -n "${PACKAGE}/.MainActivity"

rendered=0
for _ in $(seq 1 $((TIMEOUT_SECONDS / 3))); do
  sleep 3
  if adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 &&
     adb shell cat /sdcard/ui.xml | grep -qF "$EXPECTED_TEXT"; then
    rendered=1
    break
  fi
done

if [ "$rendered" -ne 1 ]; then
  echo "::error::'${EXPECTED_TEXT}' never appeared — the app did not render within ${TIMEOUT_SECONDS}s."
  echo "--- last screen dump ---"
  adb shell cat /sdcard/ui.xml 2>/dev/null | head -c 4000 || echo "(no dump)"
  echo
  echo "--- logcat ---"
  adb logcat -d | tail -200
  exit 1
fi

# A JavaScript error can also surface as a crash a moment after the first render.
if adb logcat -d | grep -q "FATAL EXCEPTION"; then
  echo "::error::The app crashed after launching."
  adb logcat -d | grep -A 40 "FATAL EXCEPTION" | tail -80
  exit 1
fi

echo "Launched, rendered the PIN setup screen, and did not crash."
