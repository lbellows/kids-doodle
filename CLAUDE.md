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
  DrawingCanvas.tsx      Native — Skia canvas + RNGH PanGesture (runOnJS: true)
  DrawingCanvas.web.tsx  Web — HTML5 <canvas>, NO Skia import
  ColorPicker.tsx        8 hardcoded color swatches
  Toolbar.tsx            Colors + brush sizes + eraser + clear
  PinPad.tsx             4-digit pad, shake + vibrate on wrong PIN
hooks/
  usePin.ts         save / verify / clear PIN (SHA-256 hashed in AsyncStorage)
  useLockState.ts   locked boolean + lock() / unlock()
utils/
  hash.ts           expo-crypto SHA-256 wrapper
public/
  canvaskit.wasm    CanvasKit WASM for Metro web server (native uses bundled binary)
```

## Critical: Skia must never be imported on the web bundle

`Skia.web.js` runs `JsiSkApi(global.CanvasKit)` synchronously at module-evaluation time. CanvasKit WASM cannot be loaded before this happens, so `CanvasKit` is always `undefined` on web if Skia is in the bundle.

The fix is the platform file: Metro resolves `DrawingCanvas.web.tsx` on web and `DrawingCanvas.tsx` on native. `metro.config.js` explicitly adds `'web'` to `resolver.platforms` — without it, Metro ignores `.web.tsx` files entirely.

**Don't** add any import of `@shopify/react-native-skia` to a file that isn't already platform-split (`.native.tsx` or paired with a `.web.tsx` stub).

## Key behaviours

**Lock:** `useLockState.lock()` → overlay renders, toolbar/lock-btn unmount, nav bar hides (`expo-navigation-bar`), `BackHandler` blocks hardware back. Unlock: correct PIN → `useLockState.unlock()`.

**PIN:** stored as SHA-256 hex under `kidsdoodle_pin_hash`. `usePin.hasPin` is `null` while AsyncStorage loads (render nothing to avoid flash), `false` triggers redirect to `/pin-setup`.

**Drawing (native):** strokes accumulate in React state as `{path: SkPath, color, strokeWidth}[]`. Eraser = white color at 3× width. Clear = `setStrokes([])` via `DrawingCanvasRef`.

**expo-navigation-bar** (hide nav bar while locked) only works in a native/EAS build, not Expo Go.
