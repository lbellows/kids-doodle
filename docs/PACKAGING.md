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
| `v1.0.0` | tagged and released — **93.8 MB, too big for IzzyOnDroid** |
| `v1.0.2` | split per ABI, minified, libraries compressed, no permissions — 17–18 MB |
| `v1.0.3` | tagged and released — recipe fixes so F-Droid can build it at all; **this is the one to submit** |
| IzzyOnDroid inclusion request | **not yet opened** — Codeberg |
| fdroiddata merge request | **not yet opened** — GitLab |

The two submissions are on different forges: fdroiddata is on GitLab, and
IzzyOnDroid's tracker is on **Codeberg** (its old GitLab repo is archived and
read-only). Neither can be automated from this repository. They are one-time
and independent of each other. Run the local `fdroid lint` and `fdroid scanner`
verification before opening the fdroiddata one.

Submit v1.0.3. At 93.8 MB v1.0.0 is over three times IzzyOnDroid's 30 MB
per-APK limit and would be rejected on sight (see [APK size](#apk-size)), and
v1.0.2 predates the recipe fixes, so F-Droid cannot build it — its `init` step
ran in the wrong directory. 1.0.1 was never published — it existed only as a
version string while this work was in flight.

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
over-the-air update mechanism that does not exist, which is exactly what an
F-Droid reviewer looks for.

CI asserts all of this: both workflows fail if the release APK's permission set
is anything other than that single app-private entry. The check is a full-set
comparison rather than a search for `INTERNET`, which is how
`ACCESS_NETWORK_STATE` — merged in from React Native core's manifest, never
requested by this app — was caught before it shipped.

## APK size

IzzyOnDroid will not host an APK over **30 MB**. Exceptions exist but must be
well argued, and a children's drawing app is not the case to spend one on.

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
   out of the APK — better for install size, worse for download size, and Izzy's
   limit is on the file they host.

The third one is a genuine trade: the libraries are extracted at install time,
so the app takes more room on the device than the download suggests. Between
that and not being listed, this is the better side.

Each per-ABI APK carries its own versionCode — `versionCode * 10 + <offset>`,
offsets `armeabi-v7a: 1`, `arm64-v8a: 2`, `x86_64: 3` — because both stores
index APKs by versionCode and three APKs sharing one would collide. **The
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
<https://codeberg.org/IzzyOnDroid/repodata/issues> with the repository URL.
IzzyOnDroid's old GitLab repo is archived and read-only; the tracker moved to
Codeberg, so this one needs a **Codeberg** account, not a GitLab one. Once
accepted, every tagged release is picked up automatically. Paste-ready body:

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
> - minSdk 24, targetSdk 36, one APK per ABI (armeabi-v7a, arm64-v8a,
>   x86_64), each well under the 30 MB limit
>
> An offline drawing app for young children with a parent PIN lock. No network
> permissions at all — `INTERNET` and `ACCESS_NETWORK_STATE` are stripped from
> release builds — no analytics, no ads, no crash reporting, no tracking, and
> no Google Play Services or other proprietary dependency. The APK requests no
> Android permission at all — its only `uses-permission` entry is AndroidX's
> app-private, signature-level `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. It is
> also submitted to F-Droid proper.

## Submitting to F-Droid

1. Tag the release and push it — the recipe's `commit:` field points at that
   tag (`v1.0.3` today), and F-Droid builds tags, never branches.
2. Verify the recipe locally before submitting. Do not skip this: the first
   time it was run, it found that the recipe's `init` commands never executed
   and that the scanner reported 46 problems per build entry. Neither is
   visible from GitHub Actions, which runs Gradle directly and never reads the
   recipe at all.

   `fdroid` is not packaged for Arch/Artix. Install it from PyPI:

   ```sh
   pipx install fdroidserver
   ```

   `fdroid lint` and `fdroid scanner` need no Android toolchain — scanner
   clones the tagged source, runs the recipe's `init`, and inspects the result.
   Both need a working directory laid out like fdroiddata:

   ```sh
   mkdir -p /tmp/fdcheck/metadata && cd /tmp/fdcheck
   cp ~/src/kids-doodle/fdroid/com.kidsdoodle.app.yml metadata/
   curl -fsSLO https://gitlab.com/fdroid/fdroiddata/-/raw/master/config/categories.yml
   {
     printf 'repo_url: "https://example.com/fdroid/repo"\nrepo_name: "t"\n'
     printf 'repo_description: "t"\nsdk_path: "/opt/android-sdk"\ncategories:\n'
     grep -E '^[A-Za-z][^:]*:$' categories.yml | sed 's/:$//; s/^/  - "/; s/$/"/'
   } > config.yml

   fdroid lint com.kidsdoodle.app     # metadata fields; silence means clean
   fdroid scanner com.kidsdoodle.app  # binaries and maven repos in the source
   ```

   The `categories:` list matters — without it every category is "not valid",
   which looks like a real finding and is not.

   `fdroid scanner` reads `commit:` from the recipe, so it verifies the
   **tagged** source, not your working tree. Point `commit:` at a branch SHA to
   test changes before tagging.

3. A full `fdroid build -v -l com.kidsdoodle.app` additionally needs JDK 17,
   the Android SDK and NDK r27b on this machine — none of which are installed
   here. Lint and scanner cover the recipe itself; GitHub Actions already
   compiles the identical Gradle build on every push, so the remaining gap is
   small. F-Droid's own CI builds the merge request too.
4. Fork <https://gitlab.com/fdroid/fdroiddata>, add
   `metadata/com.kidsdoodle.app.yml`, and open a merge request. Title it
   `New app: KidsDoodle (com.kidsdoodle.app)`; the description only needs to
   say it is a new app, that the recipe was verified locally with `fdroid lint`
   and `fdroid scanner`, and to point at the `MaintainerNotes` in the recipe,
   which already answer the Skia, prebuilt-binary and permission questions a
   reviewer will raise.
5. Keep `fdroid/com.kidsdoodle.app.yml` in this repo in sync with what you
   submit, so the recipe is reviewable next to the code it builds.

`AutoUpdateMode: Version` and `UpdateCheckMode: Tags` mean F-Droid picks up
later releases from new `v*` tags on its own — you only need a new merge request
if the build recipe itself has to change.

### Things a reviewer will check

- No proprietary dependencies. There are none: no Google Play Services, no
  Firebase, no analytics, no crash reporting.
- No prebuilt binaries fetched during the build. See the Skia note above.
- That there are **three build entries per release**, one per ABI, with
  matching `VercodeOperation` lines. fdroidserver copies the last N build
  blocks — one per operation — and assigns the sorted versionCodes in order, so
  the blocks must stay in ascending offset order.
- How `node_modules` is handled. `scripts/purge-nonfree-blobs.sh` runs in the
  `init` step and deletes every prebuilt binary the Android build does not use,
  so the build has to succeed without them rather than a reviewer being asked to
  take them on trust. What survives that is a short, itemised **`scanignore`**:
  the Linux `hermesc`, which the build genuinely runs and which F-Droid permits,
  and six dependency `.gradle` files that declare a maven repository by local
  path. There is deliberately no **`scandelete`** — `scandelete: node_modules`
  would be wrong here, because Expo autolinking resolves every native module
  from `node_modules` during Gradle *configuration*, so removing the whole tree
  breaks the build. The purge is the narrower version of that idea: delete the
  binaries, keep the sources.
- One scanner **warning** that is a false positive: "Found executable binary,
  possibly code" for
  `node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Fontisto.ttf`.
  It is an ordinary TrueType font, mode 644 — `file` reports "TrueType Font
  data". `fdroid scanner` still exits 0, so it is a warning rather than a
  problem and is not in `scanignore`.
- The pinned Node.js tarball and its SHA-256. If you bump the Node version in
  the recipe, update the checksum from
  `https://nodejs.org/dist/<version>/SHASUMS256.txt`.
- Extra APK signing blocks. AGP 8 adds a "Dependency metadata" block that
  `fdroid scanner` rejects. The recipe's `prebuild` disables it
  (`dependenciesInfo.includeInApk = false`); `plugins/withoutDependencyMetadata.js`
  does the same in the committed `android/` project.
