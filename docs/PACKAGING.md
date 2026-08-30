# Packaging KidsDoodle

KidsDoodle is not on Google Play. It ships from this repository's GitHub
Releases and from a self-hosted F-Droid repo that indexes those same APKs:

| | GitHub Releases | Self-hosted F-Droid repo |
|---|---|---|
| Who builds the APK | GitHub Actions, on a `v*` tag | the same APKs, pulled from the Release |
| Signed by | your release key | your release key (untouched) |
| How users get it | direct download, or Obtainium | add the repo URL to any F-Droid client |
| Answerable to | nobody | nobody |

[Obtainium](https://obtainium.imranr.dev/) is a third route that needs nothing
from us — it watches the GitHub Releases page directly.

The `fastlane/metadata/` tree is the store listing for all of them: `fdroid
update` reads that directory when building the self-hosted index.

## Where this stands

| | |
|---|---|
| `v1.0.0` | tagged and released — 93.8 MB universal APK |
| `v1.0.2` | split per ABI, minified, libraries compressed, no permissions — 17–18 MB |
| `v1.0.3` | tagged and released — current |
| Self-hosted repo | `lbellows/fdroid` created, KidsDoodle listed and correct; **first publish blocked** on its index-signing secret |

1.0.1 was never published — it existed only as a version string while the
packaging work was in flight.

## Why the app no longer uses Skia

This repository holds itself to one rule: **no dependency may ship or download a
prebuilt binary.** The only prebuilt binaries tolerated are the ones a
source-building distribution would permit — Debian main, trusted Maven
repositories, the Android SDK, Hermes, PyPI wheels, the Nix cache, Rust, Go, and
Node.js. Everything else is compiled from source. The rule is what makes the
build auditable and reproducible from a clean checkout.

`@shopify/react-native-skia` fails this. Its `postinstall` downloads prebuilt
Skia static libraries from GitHub Releases, which is not a permitted source, and
compiling Skia from source is not realistic. It was replaced
with `react-native-svg` (MIT, pure Java, no binaries). The canvas only ever drew
`moveTo`/`lineTo` polylines, so the two render identically.

Two related settings exist for the same reason:

- `expo.autolinking.android.buildFromSource: [".*"]` in `package.json` opts out
  of Expo SDK 55's precompiled `.aar` modules so every Expo module is compiled
  from source.
- The dependency tree now has **zero** `preinstall`/`install`/`postinstall`
  scripts, so `npm ci` only unpacks registry tarballs. Keep it that way — check
  before adding a dependency:

  ```sh
  npm ls --all --json | grep -c '"postinstall"'   # expect 0
  ```

## Prebuilt binaries in node_modules

`npm ci` still unpacks a handful of prebuilt binaries that packages carry for
other platforms. The Android build uses none of them. Rather than take that on
trust, `scripts/purge-nonfree-blobs.sh` deletes them and the build then has to
succeed without them. It runs in CI after `npm ci` and before Gradle, and can be
run locally with `npm run purge:blobs`.

| Removed | Why |
|---|---|
| `hermes-compiler/hermesc/win64-bin`, `osx-bin` | Windows/macOS compilers. **win64-bin also ships Microsoft's `msvcp140.dll` and ICU DLLs, which are not free software.** The Linux `hermesc` is kept — Hermes is a permitted prebuilt and the build uses it. |
| `fb-dotslash/bin/{windows,windows-arm64,macos}` | Other platforms' binaries |
| `*/local-maven-repo/**.aar` | Expo's precompiled modules, already unused because `buildFromSource` is `".*"` — deleting them proves it |
| `gradle-wrapper.jar` under `node_modules` | The build uses `android/gradlew` |
| `lightningcss-*` native module | Metro's web CSS pipeline only |

Afterwards no `.so`, `.a`, `.node`, `.exe`, `.dll`, `.aar` or `.jar` remains under
`node_modules`, and the Android JS bundle is byte-for-byte identical to one built
with them present.

Do not run this during normal development — it removes the lightningcss binary
that web bundling uses. `npm ci` restores everything.

## Dependency licences

All 641 packages in the tree declare a licence and every one is FOSS — 544 MIT,
38 ISC, 15 BSD-3-Clause, 12 Apache-2.0, 12 BSD-2-Clause, and a handful of
BlueOak-1.0.0, MPL-2.0, CC0, Unlicense, 0BSD, Python-2.0 and CC-BY-4.0 (the last
being `caniuse-lite`'s browser data, build-time only). There is no Google Play
Services, Firebase, analytics, advertising or crash reporting anywhere in the
tree. Re-run the audit after changing dependencies:

```sh
npm ls --all --json > /tmp/deps.json   # then inspect "license" fields
```

## Repository layout for packaging

```
android/                              committed, not gitignored (see below)
plugins/withReleaseSigning.js         real release key instead of the debug key
plugins/withOfflineReleaseManifest.js drops INTERNET from release builds
plugins/withoutUpdatesMetadata.js     strips inert expo-updates manifest entries
scripts/check-release-metadata.sh     guards android/ sync + changelog presence
scripts/purge-nonfree-blobs.sh        deletes unused prebuilt binaries before Gradle
fastlane/metadata/android/en-US/      store listing, read by fdroid update
fdroid/com.kidsdoodle.app.yml         licence/categories/links for the repo index
.github/workflows/ci.yml              typecheck + full release build, no secrets
.github/workflows/release.yml         builds + signs the per-ABI APKs on a v* tag
```

This mirrors the layout of the sibling `bracket-up` repo, deliberately — the two
share the same packaging approach, so fixes transfer between them.

### Why `android/` is committed

The release runs gradle against the tree at a tag. Generating the native project
in CI would make every build depend on `expo prebuild` resolving identically
there, which is a needless variable. Committing `android/` makes the build
deterministic and lets anyone read the exact manifest that ships.

The cost is that `android/` must be regenerated when `app.json` or `plugins/`
change:

```sh
npx expo prebuild --platform android
git diff --stat android    # review, then commit
```

CI enforces this — the release workflow re-runs prebuild and fails if `android/`
comes out different. Both native customisations live in `plugins/` rather than as
hand edits precisely so regeneration cannot silently revert them.

## Permissions

**The released APK requests no Android permission at all.**

The only `uses-permission` entry left is
`com.kidsdoodle.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` — generated by
AndroidX core, namespaced to the app's own package with
`protectionLevel="signature"`. It is app-private, grants nothing to other apps,
is not surfaced to users, and cannot be removed without breaking
`ContextCompat.registerReceiver`. Everything else Expo's template pulled in is
stripped:

- `VIBRATE`, `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`,
  `WRITE_EXTERNAL_STORAGE` via `android.blockedPermissions` in `app.json`.
- `INTERNET` and `ACCESS_NETWORK_STATE` via `plugins/withOfflineReleaseManifest.js`,
  which writes a release-only manifest overlay. `ACCESS_NETWORK_STATE` is merged
  in from React Native core's own library manifest, not requested by this app.
  It stays in debug builds because the device needs it to reach the Metro dev
  server. `blockedPermissions` could not express this — it edits the main
  manifest, which both build types inherit. (`bracket-up` blocks `INTERNET`
  outright and accepts that `expo run:android` cannot reach Metro; the overlay
  keeps that working here.)

`VIBRATE` was dropped in 1.0.2. It backed a 200 ms buzz on a wrong PIN, in
`PinPad`, `pin-setup` and `settings`. Every one of those already ran a shake
animation alongside it, so the wrong-PIN feedback survives — what went is the
haptic half, and with it the last entry a store listing would show a parent.
It is a `normal` permission, so this was never a privacy question; it is about
what the listing says. If it ever comes back, remove it from
`blockedPermissions` and update the expected set in
`scripts/check-release-apks.sh`, which will otherwise fail the build.

`plugins/withoutUpdatesMetadata.js` also strips the `expo.modules.updates.*`
manifest meta-data that the Expo template emits unconditionally. `expo-updates`
is not a dependency, so the entries are inert — but they advertise an
over-the-air update mechanism the app does not have, and a manifest should not
claim a capability that is not there.

CI asserts all of this: both workflows fail if the release APK's permission set
is anything other than that single app-private entry. The check is a full-set
comparison rather than a search for `INTERNET`, which is how
`ACCESS_NETWORK_STATE` — merged in from React Native core's manifest, never
requested by this app — was caught before it shipped.

## APK size

Every APK is kept under **30 MB**. This is a self-imposed ceiling — nothing
external enforces it. Keeping the download small is simply good practice:
it is what the self-hosted repo serves and what a parent installing over mobile
data pays for. `scripts/check-release-apks.sh`
still fails the build above the limit. Keep it.

v1.0.0's universal APK was 93.8 MB. Where it went:

| | in the APK |
|---|---|
| `lib/x86_64` | 20.4 MB |
| `lib/x86` | 20.1 MB |
| `lib/arm64-v8a` | 19.1 MB |
| `lib/armeabi-v7a` | 13.1 MB |
| dex (3 files, unminified) | 8.3 MB |
| resources, assets, everything else | 7.7 MB |

Three changes bring it under the limit, and all three are needed — no single one
is enough on its own:

1. **One APK per ABI** (`plugins/withAbiSplits.js`). A device runs exactly one
   of those four architectures. 32-bit x86 is dropped entirely: no phone ever
   shipped it and only old emulator images use it. x86_64 is kept, because that
   is what Android emulators and Android-capable Chromebooks run.
2. **R8** (`plugins/withMinifiedRelease.js`). Expo's template leaves
   `android.enableMinifyInReleaseBuilds` off, so the dex shipped unminified.
3. **Compressed native libraries** (`plugins/withCompressedNativeLibs.js`).
   Expo's default stores `.so` files uncompressed so they can be mapped straight
   out of the APK — better for install size, worse for download size, and
   download size is the one a repo serves.

The third one is a genuine trade: the libraries are extracted at install time,
so the app takes more room on the device than the download suggests. For an app
this small in absolute terms, the smaller download is the better side.

Each per-ABI APK carries its own versionCode — `versionCode * 10 + <offset>`,
offsets `armeabi-v7a: 1`, `arm64-v8a: 2`, `x86_64: 3` — because F-Droid and
`fdroid update` both index APKs by versionCode and three APKs sharing one would collide. **The
offsets are part of published versionCodes: never renumber them, only append.**
That is also why each release needs a changelog file per ABI, which
`npm run changelogs` generates from the one you write.

R8 is the risky part. It renames classes that React Native resolves by name from
C++ and JavaScript, and a missing keep rule produces an APK that builds cleanly
and then fails at runtime. `release.yml` therefore installs the x86_64 APK on an
emulator and fails unless the app renders its first screen. Keep rules live in
`android/app/proguard-rules.pro`.

`scripts/check-release-apks.sh` guards all of this on every build, so a future
dependency cannot quietly undo it.

## One-time setup: the release keystore

Every published APK is signed with this key — the GitHub Release and the
self-hosted repo serve the same files. When no keystore is configured the build
falls back to debug signing, which is what unsigned CI builds do; nothing
published is ever debug-signed.

**This key is not recoverable and cannot be rotated.** Android identifies an app
by its signature, so losing it means every existing user must uninstall and
reinstall to take an update. Back up the keystore somewhere durable and offline
before you publish anything signed with it.

```sh
keytool -genkeypair -v \
  -keystore kidsdoodle-release.keystore \
  -alias kidsdoodle \
  -keyalg RSA -keysize 4096 -validity 10000
```

Keep it outside the working tree. `*.keystore` and `android/keystore.properties`
are gitignored as a backstop, not as a place to put it.

The key actually in use was generated with OpenSSL rather than `keytool` — a
PKCS#12 store either way, which is what `keytool -genkeypair` produces on JDK 9
and later, so the two are interchangeable. Its certificate is:

```
subject      CN=KidsDoodle, O=LB
RSA 4096, SHA-256, expires 2054-01-14
SHA-256      a673f800d5c5d0eb63cf40cfa66253d0530bcf8a30fc866406c88cdd5e27ef31
```

`release.yml` asserts that exact digest on every build. Checking only that the
APK is *not* debug-signed would still let a wrong or regenerated key ship, and
a signature change is invisible until users find they cannot update.

To read the fingerprint back from the keystore without a JDK:

```sh
openssl pkcs12 -in kidsdoodle-release.keystore -nokeys -clcerts \
  | openssl x509 -noout -fingerprint -sha256 -subject -enddate
```

### Backing it up

`~/.android-keystores/kids-doodle/backups/kidsdoodle-signing-key-<date>.tar.gz`
holds the keystore, its password, a `SHA256SUMS` and a `RESTORE.md` with the
full restore procedure. Copy it to at least two places that are neither this
machine nor the same account as the GitHub repo. Encrypt it first if any of
them is cloud storage:

```sh
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in kidsdoodle-signing-key-<date>.tar.gz \
  -out kidsdoodle-signing-key-<date>.tar.gz.enc
```

### Signing locally

Create `android/keystore.properties` (gitignored):

```properties
storeFile=/absolute/path/to/kidsdoodle-release.keystore
storePassword=...
keyAlias=kidsdoodle
keyPassword=...
```

Then `cd android && ./gradlew assembleRelease`. Without that file — and without
the environment variables below — the release build debug-signs instead, so
`expo run:android` and F-Droid both keep working untouched.

### Signing in CI

`plugins/withReleaseSigning.js` reads `android/keystore.properties` first and
falls back to environment variables, so CI never writes the config to disk. Add
four repository secrets under **Settings → Secrets and variables → Actions**:

```sh
base64 -w0 kidsdoodle-release.keystore   # -> ANDROID_KEYSTORE_BASE64
```

| Secret | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | output of the command above |
| `ANDROID_STORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | `kidsdoodle` |
| `ANDROID_KEY_PASSWORD` | key password |

These are only needed for tagged releases. `ci.yml` builds the same release APK
without them and asserts the permission set, so the build itself is verified on
every push.

## Cutting a release

1. Bump both fields in `app.json` — `expo.version` and `expo.android.versionCode`.
   `versionCode` must increase by at least 1 every release; F-Droid and Android
   both refuse a non-increasing one.
2. Write `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`, named
   after the **versionCode**, not the version name. Then copy it to the per-ABI
   codes, which is what the stores actually read:
   ```sh
   npm run changelogs
   ```
3. Regenerate and commit the native project:
   ```sh
   npm run prebuild
   git add -A android app.json fastlane && git commit -m "Release 1.0.1"
   ```
4. Optionally dry-run the release: trigger **Release APKs** from the Actions tab
   (`workflow_dispatch`). It builds, verifies and smoke-tests without publishing
   — publishing is gated on the ref being a tag.
5. Tag and push:
   ```sh
   git tag -a v1.0.1 -m "KidsDoodle 1.0.1"
   git push origin master --follow-tags
   ```
6. `release.yml` builds one APK per ABI, verifies each, installs the x86_64 one
   on an emulator to prove the minified build still runs, and attaches all three
   to the GitHub Release. `scripts/check-release-apks.sh` fails the build if any
   APK is over 30 MB, contains more than one ABI, is signed with a key other
   than the pinned certificate, or declares any permission other than AndroidX's
   app-private `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`.

## Store listing and screenshots

`fastlane/metadata/android/en-US/` holds the title, the short and full
description, a changelog per versionCode, a 512×512 icon and three portrait
screenshots. The publishing side clones this repo and copies that directory into
`metadata/<appid>/<locale>/`, which is the layout `fdroid update` wants — so the
listing lives here, in source, and nothing has to be re-entered anywhere else.

The screenshots are 1080×2400 — a normal phone resolution — captured from the
**web** build under Chrome device emulation at 360×800 CSS pixels with a device
pixel ratio of 3. It renders the same React Native components through
react-native-web, so the layout and the wrapped toolbar are accurate, but emoji
glyphs and the system font come from the desktop rather than Android. Replacing
them with captures from a real device is still worth doing; drop the PNGs into
`fastlane/metadata/android/en-US/images/phoneScreenshots/` and keep the
`1_`/`2_`/`3_` prefixes, which set the display order.

## Serving your own F-Droid repo

A self-hosted F-Droid repo is an ordinary static directory. `fdroid update`
reads a folder of APKs, writes a signed index next to them, and any F-Droid
client given the URL installs and updates from it like any other repo. There is
no review queue and no inclusion policy to satisfy — which is the whole point,
and the reason it is now the only F-Droid channel this app uses.

**One repo, both apps.** KidsDoodle shares a repo with BracketUp rather than
standing up its own: the same index carries both, and a user adds one URL
instead of two. The repo itself lives at
[`lbellows/fdroid`](https://github.com/lbellows/fdroid) and is maintained
there, not here.

| | |
|---|---|
| Repo URL users add | `https://lbellows.github.io/fdroid/repo` |
| Landing page | <https://lbellows.github.io/fdroid/> — shows the fingerprint to verify against |
| Index fingerprint | `FB4D09F2D0AA9CAEA884768393A13DAFDCD0AD008A957D312A4BC0F78F72F378` |
| Hosting | GitHub Pages, deployed by that repo's `.github/workflows/publish.yml` |

The full URL to hand out pins the repo to its key:

```
https://lbellows.github.io/fdroid/repo?fingerprint=FB4D09F2D0AA9CAEA884768393A13DAFDCD0AD008A957D312A4BC0F78F72F378
```

That workflow pulls every APK from every GitHub Release of each listed app and
clones each app repo to copy `fastlane/metadata/android/<locale>/` into
`metadata/<appid>/<locale>/`, which is the layout `fdroid update` wants. The
index is a build product and is not committed.

KidsDoodle is listed in that repo's `apps.json` with its appid
(`com.kidsdoodle.app`, matching `expo.android.package`), its release signing
key, and a `recipe` path pointing at `fdroid/com.kidsdoodle.app.yml` here. On
each publish it clones this repository and reads two things out of it. What this
repo contributes:

- Three APKs per release, one per ABI, attached to the GitHub Release for the
  `v*` tag. `fdroid update` indexes all three; each client installs the one
  matching its own `native-code`.
- versionCodes that cannot collide (`versionCode * 10 + 1/2/3`), which is
  exactly the property a single index needs.
- A changelog per per-ABI versionCode (`41.txt`, `42.txt`, `43.txt`), not just
  the base code — `npm run changelogs` keeps them in sync, so the publishing
  side does not have to fan them out.
- `fastlane/metadata/android/<locale>/`, copied wholesale into
  `metadata/<appid>/<locale>/`.
- `fdroid/com.kidsdoodle.app.yml`, from which `scripts/app_metadata.py` over
  there derives `metadata/com.kidsdoodle.app.yml`: licence, categories, author,
  source and issue links, current version. `fdroid update` will not take those
  from the fastlane tree, and without them the app publishes as licence
  "Unknown" in a catch-all category with no link to its source. **Deleting or
  renaming that file breaks the listing** — it and `apps.json` change together.
  `AllowedAPKSigningKeys` is deliberately not in it, and comes from `apps.json`
  instead.

Two properties of the setup worth knowing:

- The **index signing key is a new, dedicated key**, deliberately not any app's
  release key, so the repo's identity does not depend on which apps it carries.
  Only the index is signed with it — the APKs keep their own per-app release
  signatures untouched, so a user can move between the GitHub Releases and this
  repo without reinstalling.
- That key is as unrecoverable as a release keystore. If it is lost, every user
  has to remove and re-add the repo, because a re-signed index reads as a
  different repo to the client.

By default the index refreshes on that repo's schedule, so a new release shows
up within a day. It could be made immediate by having `release.yml` here fire a
`repository_dispatch` at `lbellows/fdroid`, but that needs a PAT with
`contents:write` stored as a secret in this repo, and a day's latency on a
children's drawing app does not justify another credential. Not done
deliberately.
