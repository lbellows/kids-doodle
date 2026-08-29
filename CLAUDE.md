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

**Permissions:** the release APK declares only `VIBRATE`. `SYSTEM_ALERT_WINDOW` and the storage permissions are stripped via `android.blockedPermissions` in app.json; `INTERNET` is removed from release builds only (debug keeps it for Metro) by `plugins/withOfflineReleaseManifest.js`. Adding a permission needs a reason — this is a kids' app on F-Droid.

**expo-navigation-bar** (hide nav bar while locked) only works in a native/EAS build, not Expo Go.
