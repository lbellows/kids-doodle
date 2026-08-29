#!/usr/bin/env bash
# Removes prebuilt binaries from node_modules that the Android build does not use.
#
# WHY THIS EXISTS
#
# F-Droid only accepts prebuilt binaries from a fixed set of sources (Debian
# main, trusted Maven repos, the Android/Flutter SDKs, Hermes, PyPI, Nix, Rust,
# Go, Node.js). `npm ci` drops a handful of binaries into node_modules that are
# not on that list. None of them are used to build the Android APK, so rather
# than asking a reviewer to take that on trust via `scanignore`, this script
# deletes them and the build then has to succeed without them.
#
# One of them is not merely unpermitted but genuinely non-free: the Windows
# build of hermesc ships Microsoft's msvcp140.dll and ICU DLLs.
#
# What this script cannot delete is listed as `scanignore` in the F-Droid recipe:
# the Linux hermesc, which the build genuinely uses and which F-Droid permits,
# and six dependency .gradle files whose local-path maven declarations the
# scanner cannot tell apart from unknown remote repositories.
#
# Keep this in step with `fdroid scanner` — run it after changing dependencies.
# See docs/PACKAGING.md.
#
# WHERE IT RUNS
#
# CI (.github/workflows/*.yml) and the F-Droid recipe (fdroid/com.kidsdoodle.app.yml),
# after `npm ci` and before Gradle. It is NOT part of normal development: it
# removes the lightningcss binary that Metro's CSS pipeline uses when bundling
# for web. Run `npm ci` to undo it.
#
# Verified: the Android JS bundle is byte-identical before and after.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "ERROR: node_modules is missing. Run 'npm ci' first." >&2
  exit 1
fi

removed=0

purge() {
  local description="$1"; shift
  for target in "$@"; do
    [ -e "$target" ] || continue
    local size
    size=$(du -sh "$target" 2>/dev/null | cut -f1)
    echo "    ${size}	${target}"
    rm -rf "$target"
    removed=$((removed + 1))
  done
}

echo "==> Proprietary Microsoft runtime and non-Linux Hermes compilers"
# hermesc/linux64-bin is kept: Hermes is an explicitly permitted prebuilt, and
# the Gradle build uses it to compile the JS bundle to bytecode.
purge "hermes" \
  node_modules/hermes-compiler/hermesc/win64-bin \
  node_modules/hermes-compiler/hermesc/osx-bin

echo "==> dotslash binaries (used only by @react-native/debugger-shell)"
# Every platform, including Linux: dotslash launches the React Native DevTools
# shell, which no release build touches. Keeping the Linux ones only made
# F-Droid's scanner flag them.
while IFS= read -r dir; do
  purge "dotslash" "$dir"
done < <(find node_modules/fb-dotslash/bin -mindepth 1 -maxdepth 1 -type d 2>/dev/null)

echo "==> iOS localisation packs in react-native/React (Android uses ReactAndroid)"
purge "i18n" node_modules/react-native/React/I18n

echo "==> Expo's app-scaffolding template archive (not used to build)"
purge "template" node_modules/expo/template.tgz

echo "==> Expo precompiled .aar modules (unused: buildFromSource is '.*')"
while IFS= read -r dir; do
  purge "aar" "$dir"
done < <(find node_modules -type d -name local-maven-repo 2>/dev/null)

echo "==> Gradle wrappers inside node_modules (the build uses android/gradlew)"
while IFS= read -r jar; do
  purge "wrapper" "$jar"
done < <(find node_modules -name gradle-wrapper.jar 2>/dev/null)

echo "==> lightningcss native binary (web CSS pipeline only)"
while IFS= read -r dir; do
  purge "lightningcss" "$dir"
done < <(find node_modules -maxdepth 1 -type d -name 'lightningcss-*' 2>/dev/null)

echo
echo "Removed ${removed} item(s)."

echo "==> Remaining native binaries under node_modules:"
# .bin and .tgz are here because F-Droid's scanner flags them too, and both
# turned up in a scanner run after the extension list above already passed.
leftover=$(find node_modules -type f \
  \( -name '*.node' -o -name '*.so' -o -name '*.a' -o -name '*.dylib' \
     -o -name '*.exe' -o -name '*.dll' -o -name '*.aar' \
     -o -name '*.bin' -o -name '*.tgz' \) 2>/dev/null | sort)
if [ -z "$leftover" ]; then
  echo "    none"
else
  echo "$leftover" | sed 's/^/    /'
fi
