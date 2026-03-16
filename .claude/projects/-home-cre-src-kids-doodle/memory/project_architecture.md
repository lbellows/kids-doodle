---
name: KidsDoodle app architecture and design decisions
description: File structure, component responsibilities, platform split, and key behaviours — reference before adding features
type: project
---

## Stack

- Expo SDK 55, React Native 0.83, TypeScript strict
- expo-router (file-based navigation, no headers)
- @shopify/react-native-skia 2.4.18 — drawing canvas on **native only**
- react-native-gesture-handler v2 (Gesture API) — pan gesture for drawing
- AsyncStorage + expo-crypto SHA-256 — hashed PIN storage
- expo-navigation-bar — hides Android system nav bar in lock mode

## File structure

```
app/
  _layout.tsx        GestureHandlerRootView root; no CanvasKit bootstrap needed
  index.tsx          Draw screen (home); redirects to /pin-setup if no PIN
  pin-setup.tsx      First-launch 4-digit PIN creation (enter + confirm steps)
  settings.tsx       Change PIN (gated: verify current PIN first)

components/
  DrawingCanvas.tsx      Native: Skia Canvas + RNGH PanGesture (runOnJS: true)
  DrawingCanvas.web.tsx  Web: HTML5 <canvas> via DOM events; no Skia import
  ColorPicker.tsx        8 hardcoded color swatches
  Toolbar.tsx            Colors + S/M/L brush sizes + eraser + clear button
  PinPad.tsx             4-digit numeric pad; shake + vibrate on wrong PIN

hooks/
  usePin.ts          save / verify / clear PIN; state: hasPin (null=loading)
  useLockState.ts    locked boolean + lock() / unlock()

utils/
  hash.ts            expo-crypto SHA-256 wrapper

public/
  canvaskit.wasm     Copied by setup-canvaskit.js; served by Metro web server
                     (only needed for web — native uses bundled .so/.framework)
```

## Platform split: DrawingCanvas

Metro resolves `DrawingCanvas.web.tsx` on web, `DrawingCanvas.tsx` on native.
Both export identical interface: `DrawingCanvas` component + `DrawingCanvasRef` type.
`metro.config.js` must include `'web'` in `resolver.platforms` for this to work.

## Lock behaviour

1. User taps 🔒 → `useLockState.lock()` sets `locked = true`
2. `expo-navigation-bar.setVisibilityAsync('hidden')` hides Android nav bar
3. `BackHandler` listener returns `true` (consumed) while locked — blocks hardware back
4. Semi-transparent overlay renders over canvas; toolbar and lock button unmount
5. `PinPad` verifies PIN via `usePin.verifyPin()` (async SHA-256 compare)
6. Correct PIN → `useLockState.unlock()` → nav bar restored
7. Wrong PIN → shake animation (Animated.sequence) + Vibration.vibrate(200)

## PIN flow

- First launch: `usePin.hasPin === false` → `router.replace('/pin-setup')`
- `hasPin === null` means AsyncStorage hasn't resolved yet; render null (avoid flash)
- PIN stored as SHA-256 hex string under key `kidsdoodle_pin_hash`
- Settings screen requires verifying the current PIN before showing change flow

## Drawing (native)

- `Gesture.Pan().runOnJS(true)` — callbacks run on JS thread to call `setStrokes`
- `onBegin`: creates a new `Skia.Path.Make()`, appends stroke to state array
- `onUpdate`: calls `path.lineTo(x, y)`, shallow-copies array to trigger re-render
- Eraser: sets color to `#FFFFFF` and triples the stroke width
- Clear: `DrawingCanvasRef.clear()` calls `setStrokes([])`
- Strokes accumulate in React state — no undo, but clear wipes all

## Drawing (web)

- Native DOM `mousedown/mousemove/mouseup` + `touchstart/touchmove/touchend`
- `ResizeObserver` syncs `canvas.width/height` to CSS layout size
- Eraser uses `ctx.globalCompositeOperation = 'destination-out'`
- `touchAction: none` on canvas prevents scroll interference

## EAS build

`eas.json` profiles:
- `development` → APK with dev client
- `preview` → APK for internal distribution
- `production` → AAB for Play Store

Android package: `com.kidsdoodle.app`
`predictiveBackGestureEnabled: false` in app.json prevents Android 13+ back swipe.
