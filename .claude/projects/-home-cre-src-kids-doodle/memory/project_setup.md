---
name: KidsDoodle dependency and setup gotchas
description: Every npm/Metro/Skia issue hit during initial project setup, with fixes — consult before touching deps or config
type: project
---

## Dependency versions (Expo SDK 55)

Pin these exact versions — Expo 55's compatibility checker enforces them:

| Package | Required version |
|---|---|
| `@react-native-async-storage/async-storage` | `2.2.0` |
| `@shopify/react-native-skia` | `2.4.18` |
| `react` | `19.2.0` |
| `react-dom` | `19.2.0` |
| `react-native-reanimated` | `4.2.1` |
| `react-native-safe-area-context` | `~5.6.2` |
| `react-native-screens` | `~4.23.0` |

**Why:** `npx expo start` warns and may behave incorrectly with other versions.

## Packages missing from `create-expo-app blank-typescript` template

These must be installed manually — the template omits them:

```
npm install expo-router expo-crypto @react-native-async-storage/async-storage \
  expo-navigation-bar @shopify/react-native-skia expo-status-bar \
  react-native-safe-area-context react-native-screens \
  react-native-gesture-handler react-native-reanimated \
  react-native-web react-dom
npm install --save-dev babel-preset-expo
```

- `babel-preset-expo` — not in deps by default; Metro crashes with "Cannot find module 'babel-preset-expo'" without it.
- `react-native-web` — required by expo-router's web runtime (`@expo/log-box` → `react-native-web`); missing causes bundling failure on web.
- `react-dom` — required by expo-router's web dependencies (vaul, @radix-ui); must match `react` version exactly.

## react / react-dom version conflict

`expo-router@55.0.5` pulls in web deps (`vaul`, `@radix-ui/*`) that require `react-dom@19.2.4` which demands `react@^19.2.4`. But Expo 55 expects `react@19.2.0`.

**Fix:** Keep `react` and `react-dom` both at `19.2.0`. The peer warning from radix-ui is harmless for a React Native / Android app.

## babel.config.js

Must exist at project root. The template doesn't create it. Required content:

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

## metro.config.js — must add 'web' to platforms

Expo's default Metro config only has `platforms: ['ios', 'android']`. Without `'web'`, Metro ignores `.web.tsx` / `.web.ts` platform-specific files when bundling for web.

```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.platforms = [...(config.resolver.platforms ?? []), 'web'];
module.exports = config;
```

**Why this matters:** `DrawingCanvas.web.tsx` (HTML5 canvas) will only be picked up over `DrawingCanvas.tsx` (Skia) if `'web'` is in the platforms list.

## Skia on web — CanvasKit timing issue

`@shopify/react-native-skia/lib/module/skia/Skia.web.js` runs:
```js
export const Skia = JsiSkApi(global.CanvasKit);   // evaluated at module load time
```

If any file that imports `@shopify/react-native-skia` is bundled for web AND evaluated before `LoadSkiaWeb()` resolves, `global.CanvasKit` is `undefined` and every Skia call throws. This cannot be fixed with a `useEffect` guard — the module evaluation happens before any React rendering.

**Fix:** Create `components/DrawingCanvas.web.tsx` (HTML5 canvas, no Skia import). Metro picks it on web; Skia is never bundled into the web bundle at all. Do NOT try to lazy-load or bootstrap CanvasKit in `_layout.tsx` — it doesn't work because module evaluation is synchronous and happens before `LoadSkiaWeb` awaits.

## app.json — required fields

```json
{
  "expo": {
    "scheme": "kidsdoodle",          // required by expo-router
    "web": { "bundler": "metro" },   // tells tooling Metro serves web
    "plugins": ["expo-router", "expo-navigation-bar"]
  }
}
```

## index.ts entry point

Must contain only `import 'expo-router/entry';`. The `create-expo-app` template generates a different entry — delete `App.tsx` and replace `index.ts` with this single line.
