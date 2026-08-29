# KidsDoodle — project context

Expo SDK 55 / React Native 0.83 / TypeScript strict. Drawing app for kids with parent PIN lock. Primary target: Android. Web is supported as a preview.

## File structure

```
app/
  _layout.tsx      GestureHandlerRootView root, no headers
  index.tsx        Draw screen (home); redirects to /pin-setup if no PIN set
  pin-setup.tsx    First-launch PIN creation (enter → confirm)
  settings.tsx     Change PIN (requires verifying current PIN first)
components/
  DrawingCanvas.tsx      Native — react-native-svg <Path> + RNGH PanGesture (runOnJS: true)
  DrawingCanvas.web.tsx  Web — HTML5 <canvas>
  ColorPicker.tsx        8 hardcoded color swatches
  Toolbar.tsx            Colors + brush sizes + eraser + undo + clear
  PinPad.tsx             4-digit pad, shake + vibrate on wrong PIN
hooks/
  usePin.ts         save / verify / clear PIN (SHA-256 hashed in AsyncStorage)
  useLockState.ts   locked boolean + lock() / unlock()
utils/
  hash.ts           expo-crypto SHA-256 wrapper
plugins/
  withReleaseSigning.js          release keystore instead of the debug key
  withOfflineReleaseManifest.js  removes INTERNET from release builds
  withAbiSplits.js               one APK per ABI + per-ABI versionCodes
  withMinifiedRelease.js         R8 on release builds, plus keep rules
  withCompressedNativeLibs.js    compress .so in the APK (download size)
android/            committed, NOT gitignored — regenerate + commit after app.json changes
fastlane/metadata/  store listing for F-Droid + IzzyOnDroid
fdroid/             F-Droid build recipe
```

## Critical: no dependency may ship or download prebuilt binaries

The app is distributed through F-Droid, which compiles everything from source and
only accepts prebuilt binaries from a fixed list (Debian main, trusted Maven repos,
the Android/Flutter SDKs, Hermes, PyPI, Nix, Rust, Go, Node.js).

`@shopify/react-native-skia` was removed for exactly this reason — its postinstall
downloads prebuilt Skia static libraries from GitHub Releases. `react-native-svg`
replaced it. **Don't reintroduce Skia.**

Before adding any dependency, check it has no install hook:

```
npm ls --all --json | grep -c '"postinstall"'   # must stay 0
```

`scripts/purge-nonfree-blobs.sh` deletes every prebuilt binary in `node_modules`
that the Android build does not use — including Microsoft DLLs shipped with the
Windows Hermes compiler — and CI builds the APK with them gone. Don't add a
dependency whose Android build needs a binary that survives that purge.

`package.json` sets `expo.autolinking.android.buildFromSource: [".*"]`, which opts
out of Expo SDK 55's precompiled `.aar` modules. Don't remove it.

Metro still resolves `DrawingCanvas.web.tsx` on web and `DrawingCanvas.tsx` on
native; `metro.config.js` adds `'web'` to `resolver.platforms` — without it, Metro
ignores `.web.tsx` files entirely.

## Native project is committed

`android/` is checked in so F-Droid builds a fixed tree rather than depending on
`expo prebuild`. After changing `app.json` or `plugins/`, run
`npx expo prebuild --platform android` and commit the diff — CI fails if it drifts.

Native customisations live in `plugins/` as config plugins, never as hand edits to
`android/`, so regeneration can't revert them. See `docs/PACKAGING.md`.

## Key behaviours

**Lock:** `useLockState.lock()` → overlay renders, toolbar/lock-btn unmount, nav bar hides (`expo-navigation-bar`), `BackHandler` blocks hardware back. Unlock: correct PIN → `useLockState.unlock()`.

**PIN:** stored as SHA-256 hex under `kidsdoodle_pin_hash`. `usePin.hasPin` is `null` while AsyncStorage loads (render nothing to avoid flash), `false` triggers redirect to `/pin-setup`.

**Drawing (native):** committed strokes live in React state as `{points, color, strokeWidth}[]`; the in-progress stroke has its own state slot so a drag re-renders one `<Path>` rather than the whole array. Points are serialised to an SVG `d` string; a single point becomes a zero-length line so the round cap draws a dot. Eraser = white at 3× width (the canvas is opaque white). Clear = `setStrokes([])` and undo = `slice(0, -1)`, both via `DrawingCanvasRef`.

**Drawing (web):** strokes are retained in a ref as point lists so undo can replay them. The in-progress stroke is still drawn incrementally (no full redraw during a drag); `redraw()` replays everything only on undo, clear, and resize — assigning `canvas.width` wipes the bitmap, so the ResizeObserver must redraw.

**Undo state:** both canvases report `canUndo` upward via the stable `onHistoryChange` prop (pass a `useState` setter — an unstable callback will loop the effect). The toolbar button is disabled when the history is empty.

**Keep-awake:** `useKeepAwake()` in `app/index.tsx`, unconditional while the draw screen is mounted.

**Permissions:** the release APK requests **no Android permission at all**. The only manifest entry left is AndroidX's app-private, signature-level `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. `VIBRATE` (dropped in 1.0.2), `SYSTEM_ALERT_WINDOW` and the storage permissions are stripped via `android.blockedPermissions` in app.json; `INTERNET` and `ACCESS_NETWORK_STATE` are removed from release builds only (debug keeps them for Metro) by `plugins/withOfflineReleaseManifest.js`. Wrong-PIN feedback is the shake animation alone — there is no haptic. Adding a permission needs a reason, and `scripts/check-release-apks.sh` will fail the build until its expected set is updated too.

**expo-navigation-bar** (hide nav bar while locked) only works in a native build, not Expo Go.

**APK size:** IzzyOnDroid rejects any APK over 30 MB. v1.0.0's universal APK was 93.8 MB, so releases are now **one APK per ABI** (`armeabi-v7a`, `arm64-v8a`, `x86_64`; 32-bit x86 dropped), with R8 on and native libraries stored compressed. All three are needed to get under the limit. Each APK's versionCode is `versionCode * 10 + offset` (1/2/3 in that ABI order) — **never renumber those offsets**, and run `npm run changelogs` so every per-ABI versionCode has its changelog. `scripts/check-release-apks.sh` fails the build if an APK exceeds 30 MB, carries more than one ABI, is signed with the wrong key, or gains a permission. See `docs/PACKAGING.md`.

**R8 is the risky part:** it renames classes React Native resolves by name, so a missing keep rule builds cleanly and fails at runtime. `release.yml` installs the x86_64 APK on an emulator and asserts the first screen renders. Keep rules live in `android/app/proguard-rules.pro`.

**No EAS / Play Store.** There is no `eas.json`; distribution is F-Droid and IzzyOnDroid only. Release APKs come from `android/gradlew assembleRelease`, signed in CI on a `v*` tag. IzzyOnDroid's tracker is on **Codeberg** (`codeberg.org/IzzyOnDroid/repodata`); fdroiddata is on GitLab.
