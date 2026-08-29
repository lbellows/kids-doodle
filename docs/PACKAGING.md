# Packaging KidsDoodle for F-Droid and IzzyOnDroid

Two distribution channels, one codebase:

| | Official F-Droid | IzzyOnDroid |
|---|---|---|
| Who builds the APK | F-Droid, from source in their buildserver | You, in GitHub Actions |
| Signed by | F-Droid's key | Your key |
| Needs | `fdroid/com.kidsdoodle.app.yml` merged into `fdroiddata` | A signed APK on GitHub Releases |
| Turnaround | Weeks (human review) | Days, then automatic per release |
| Installable from | Any F-Droid client, default repo | Any F-Droid client, after adding the IzzyOnDroid repo |

IzzyOnDroid is the fast path and a normal stepping stone to the main repo. Do both.

## Where this stands

| | |
|---|---|
| Tag `v1.0.0` | pushed |
| GitHub Release with signed APK | published by `release.yml` on that tag |
| IzzyOnDroid inclusion request | **not yet opened** |
| fdroiddata merge request | **not yet opened** |

Both remaining steps are GitLab merge requests or issues, so both need a GitLab
account and neither can be automated from this repository. They are one-time
and independent of each other. Run the local `fdroid build` verification before
opening the fdroiddata one.

## Why the app no longer uses Skia

F-Droid only accepts prebuilt binaries from a fixed list of sources: Debian main,
trusted Maven repositories, the Android and Flutter SDKs, Hermes, PyPI wheels,
the Nix cache, Rust, Go, and Node.js. Everything else must be compiled from
source during their build.

`@shopify/react-native-skia` fails this. Its `postinstall` downloads prebuilt
Skia static libraries from GitHub Releases, which is not a permitted source, and
compiling Skia from source in the buildserver is not realistic. It was replaced
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
other platforms. The Android build uses none of them. Rather than ask a reviewer
to take that on trust with `scanignore`, `scripts/purge-nonfree-blobs.sh` deletes
them and the build then has to succeed without them. It runs in CI and in the
F-Droid recipe's `init` step, after `npm ci` and before Gradle.

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
fastlane/metadata/android/en-US/      store listing, read by both F-Droid and IzzyOnDroid
fdroid/com.kidsdoodle.app.yml         the recipe to submit to fdroiddata
.github/workflows/ci.yml              typecheck + full release build, no secrets
.github/workflows/release.yml         builds + signs the APK for IzzyOnDroid
```

This mirrors the layout of the sibling `bracket-up` repo, deliberately — the two
share the same packaging approach, so fixes transfer between them.

### Why `android/` is committed

F-Droid runs gradle against the tree at a tag. Generating the native project
inside their buildserver would make the build depend on `expo prebuild` resolving
identically there, which is a needless variable. Committing `android/` makes the
build deterministic and lets reviewers read the exact manifest that ships.

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

The released APK declares one user-visible permission, `VIBRATE`, for the
wrong-PIN buzz. It also carries
`com.kidsdoodle.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` — generated by
AndroidX core, namespaced to the app's own package with
`protectionLevel="signature"`. That one is app-private, grants nothing to other
apps, is not surfaced to users, and cannot be removed without breaking
`ContextCompat.registerReceiver`. Everything else Expo's template pulled in is
stripped:

- `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` via
  `android.blockedPermissions` in `app.json`.
- `INTERNET` and `ACCESS_NETWORK_STATE` via `plugins/withOfflineReleaseManifest.js`,
  which writes a release-only manifest overlay. `ACCESS_NETWORK_STATE` is merged
  in from React Native core's own library manifest, not requested by this app. It stays in debug builds because the device
  needs it to reach the Metro dev server. `blockedPermissions` could not express
  this — it edits the main manifest, which both build types inherit. (`bracket-up`
  blocks `INTERNET` outright and accepts that `expo run:android` cannot reach
  Metro; the overlay keeps that working here.)

`plugins/withoutUpdatesMetadata.js` also strips the `expo.modules.updates.*`
manifest meta-data that the Expo template emits unconditionally. `expo-updates`
is not a dependency, so the entries are inert — but they advertise an
over-the-air update mechanism that does not exist, which is exactly what an
F-Droid reviewer looks for.

CI asserts all of this: both workflows fail if the release APK's permission set
is anything other than those two exactly. The check is a full-set comparison
rather than a search for `INTERNET`, which is how `ACCESS_NETWORK_STATE` — merged
in from React Native core's manifest, never requested by this app — was caught
before it shipped.

## One-time setup: the release keystore

Only needed for the IzzyOnDroid / GitHub Releases path. F-Droid signs with its
own key, and the build falls back to debug signing when no keystore is
configured — which is what CI and F-Droid's buildserver both do.

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
2. Regenerate and commit the native project:
   ```sh
   npx expo prebuild --platform android
   git add -A android app.json && git commit -m "Release 1.0.1"
   ```
3. Add `fastlane/metadata/android/en-US/changelogs/<versionCode>.txt`. Both
   stores display this file, named after the **versionCode**, not the version name.
4. Tag and push:
   ```sh
   git tag -a v1.0.1 -m "KidsDoodle 1.0.1"
   git push origin master --follow-tags
   ```
5. `release.yml` builds, signs, verifies and attaches the APK to the GitHub
   Release. It fails if the APK's signing certificate is not the pinned one
   (see below), or if the permission set is anything other than `VIBRATE` plus
   AndroidX's app-private `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`.

## Submitting to IzzyOnDroid

Prerequisites — a FOSS licence (MIT, in `LICENSE`), a signed APK on GitHub
Releases, and `fastlane/metadata/` populated — are all in place, including three
portrait screenshots.

Those screenshots are 1080×2400 — a normal phone resolution — captured from the
**web** build under Chrome device emulation at 360×800 CSS pixels with a device
pixel ratio of 3. It renders the same React Native components through
react-native-web, so the layout and the wrapped toolbar are accurate, but emoji
glyphs and the system font come from the desktop rather than Android. Replacing
them with captures from a real device is still worth doing before the app gets
much traffic; drop the PNGs into
`fastlane/metadata/android/en-US/images/phoneScreenshots/` and keep the
`1_`/`2_`/`3_` prefixes, which set the display order.

Then open an inclusion request at
<https://gitlab.com/IzzyOnDroid/repo/-/issues> with the repository URL. Once
accepted, every tagged release is picked up automatically. A GitLab account is
needed; there is no API path that avoids it. Paste-ready body:

> **Request for inclusion: KidsDoodle**
>
> - Repository: https://github.com/lbellows/kids-doodle
> - Releases: https://github.com/lbellows/kids-doodle/releases (signed APK
>   attached to each `v*` tag, built by GitHub Actions)
> - Licence: MIT
> - Package ID: `com.kidsdoodle.app`
> - Fastlane metadata: `fastlane/metadata/android/en-US/` — title, short and
>   full description, changelog per versionCode, 512×512 icon, three 1080×2400
>   portrait screenshots
> - minSdk 24, targetSdk 36, universal APK
>
> An offline drawing app for young children with a parent PIN lock. No network
> permissions at all — `INTERNET` and `ACCESS_NETWORK_STATE` are stripped from
> release builds — no analytics, no ads, no crash reporting, no tracking, and
> no Google Play Services or other proprietary dependency. The only
> user-visible permission is `VIBRATE`. It is also submitted to F-Droid proper.

## Submitting to F-Droid

1. Tag `v1.0.0` and push it — the recipe's `commit:` field points at that tag,
   and F-Droid builds tags, never branches.
2. Verify the recipe locally before submitting. This is worth the setup time;
   a recipe that fails in their buildserver means another review round trip:
   ```sh
   git clone https://gitlab.com/fdroid/fdroidserver
   git clone https://gitlab.com/fdroid/fdroiddata
   cp fdroid/com.kidsdoodle.app.yml fdroiddata/metadata/
   cd fdroiddata
   ../fdroidserver/fdroid build -v -l com.kidsdoodle.app
   ```
3. Fork <https://gitlab.com/fdroid/fdroiddata>, add
   `metadata/com.kidsdoodle.app.yml`, and open a merge request. Title it
   `New app: KidsDoodle (com.kidsdoodle.app)`; the description only needs to
   say it is a new app, that the build was verified locally with
   `fdroid build -v -l`, and to point at the `MaintainerNotes` in the recipe,
   which already answer the Skia, prebuilt-binary and permission questions a
   reviewer will raise.
4. Keep `fdroid/com.kidsdoodle.app.yml` in this repo in sync with what you
   submit, so the recipe is reviewable next to the code it builds.

`AutoUpdateMode: Version v%v` and `UpdateCheckMode: Tags` mean F-Droid picks up
later releases from new `v*` tags on its own — you only need a new merge request
if the build recipe itself has to change.

### Things a reviewer will check

- No proprietary dependencies. There are none: no Google Play Services, no
  Firebase, no analytics, no crash reporting.
- No prebuilt binaries fetched during the build. See the Skia note above.
- How `node_modules` is handled. The recipe carries **no `scanignore` and no
  `scandelete`**: `scripts/purge-nonfree-blobs.sh` runs in the `init` step and
  deletes every prebuilt binary the Android build does not use, so the scanner
  finds nothing to complain about and the build has to succeed without them.
  `scandelete: node_modules` would be wrong here — Expo autolinking resolves
  every native module from `node_modules` during Gradle *configuration*, so
  removing the whole tree breaks the build. The purge is the narrower version of
  that idea: delete the binaries, keep the sources.
- The pinned Node.js tarball and its SHA-256. If you bump the Node version in
  the recipe, update the checksum from
  `https://nodejs.org/dist/<version>/SHASUMS256.txt`.
