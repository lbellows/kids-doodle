# Packaging KidsDoodle for F-Droid

Two distribution channels, one codebase:

| | Official F-Droid | Self-hosted repo |
|---|---|---|
| Who builds the APK | F-Droid, from source in their buildserver | You, in GitHub Actions |
| Signed by | F-Droid's key | Your key |
| Needs | `fdroid/com.kidsdoodle.app.yml` merged into `fdroiddata` | A signed APK on GitHub Releases, indexed by `fdroid update` |
| Turnaround | Weeks (human review) | Immediate, and answerable to nobody |
| Installable from | Any F-Droid client, default repo | Any F-Droid client, after adding the repo URL |

The self-hosted repo is the fast path; the main repo is the one people find
without being told. Do both.

**IzzyOnDroid rejected this app, and that is final.** Their [inclusion
policy](https://izzyondroid.org/docs/general/AppInclusionPolicy/) states that
they are "strongly opposed to apps which are fully or in part created by
generative AI tools" and that "vibe-coded apps will be rejected" — readme and
changelog text may be LLM-written, the code may not. KidsDoodle was rejected
under that clause, as was the sibling BracketUp app.

It is a judgement about how the source was authored, not about packaging, so
**there is nothing to fix and nothing to appeal**: no metadata change, no recipe
change, no size reduction and no resubmission addresses it. Do not spend effort
re-opening this path. The rest of this document covers the two channels that
remain.

F-Droid's [inclusion policy](https://f-droid.org/docs/Inclusion_Policy/) has no
equivalent provision; its criteria are FOSS licensing, no proprietary tracking
or ads, building from source, and active maintenance. The `fastlane/metadata/`
tree stays exactly as it is — F-Droid reads the same directory, and so does
`fdroid update`.

## Where this stands

| | |
|---|---|
| `v1.0.0` | tagged and released — 93.8 MB universal APK |
| `v1.0.2` | split per ABI, minified, libraries compressed, no permissions — 17–18 MB |
| `v1.0.3` | tagged and released — recipe fixes so F-Droid can build it at all; **this is the one to submit** |
| fdroiddata merge request | **open** — [MR 47210](https://gitlab.com/fdroid/fdroiddata/-/merge_requests/47210), pipeline green, awaiting human review |
| Self-hosted repo | `lbellows/fdroid` created, KidsDoodle listed and correct; **first publish blocked** on its index-signing secret |
| IzzyOnDroid | **rejected** under their generative-AI clause — closed, see above |

MR 47210 is open against fdroiddata on GitLab and waiting on a human
reviewer. Its pipeline is green, including the `fdroid build` job, which
compiled all three ABIs for ~36 minutes and produced signed output — so the
recipe is confirmed buildable by F-Droid's own CI, not merely by local checks.

**Keep `fdroid/com.kidsdoodle.app.yml` byte-identical to what that MR
carries.** The two are separate copies; nothing syncs them. Changing the recipe
here does not change the MR, and "improving" it here first is how you end up
pushing an unnecessary change into a green review. Later releases are picked up
from tags without another MR.

Submit v1.0.3. v1.0.2 predates the recipe fixes, so F-Droid cannot build it —
its `init` step ran in the wrong directory. 1.0.1 was never published — it
existed only as a version string while this work was in flight.

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
fastlane/metadata/android/en-US/      store listing, read by F-Droid and fdroid update
fdroid/com.kidsdoodle.app.yml         the recipe to submit to fdroiddata
.github/workflows/ci.yml              typecheck + full release build, no secrets
.github/workflows/release.yml         builds + signs the per-ABI APKs on a v* tag
.github/workflows/fdroid-build.yml    runs the recipe in F-Droid's buildserver image
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

Every APK is kept under **30 MB**. That started as IzzyOnDroid's hard limit,
and with that path closed nothing external enforces it any more — but the work
is already done, and download size is what a self-hosted repo serves and what a
parent installing over mobile data pays for. `scripts/check-release-apks.sh`
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

Only needed for the GitHub Releases and self-hosted-repo path. F-Droid signs
with its own key, and the build falls back to debug signing when no keystore is
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

## Store listing and screenshots

`fastlane/metadata/android/en-US/` holds the title, the short and full
description, a changelog per versionCode, a 512×512 icon and three portrait
screenshots. F-Droid reads that directory straight out of the source tree, and
`fdroid update` copies the same layout into a self-hosted repo's index, so one
tree serves both channels. Nothing in it needed to change after the
IzzyOnDroid rejection — the listing was never the problem.

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
no review queue and no inclusion policy to satisfy — which is the whole point
after the IzzyOnDroid rejection.

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

KidsDoodle is already listed in that repo's `apps.json` as
`{ "repo": "lbellows/kids-doodle", "appid": "com.kidsdoodle.app" }`, and both
halves of that are correct: `com.kidsdoodle.app` matches
`expo.android.package`, and the metadata is at
`fastlane/metadata/android/en-US/` with a 512×512 `images/icon.png`. **Nothing
in this repository has to change to be published there.** What it contributes:

- Three APKs per release, one per ABI, attached to the GitHub Release for the
  `v*` tag. `fdroid update` indexes all three; each client installs the one
  matching its own `native-code`.
- versionCodes that cannot collide (`versionCode * 10 + 1/2/3`), which is
  exactly the property a single index needs.
- A changelog per per-ABI versionCode (`41.txt`, `42.txt`, `43.txt`), not just
  the base code — `npm run changelogs` keeps them in sync, so the publishing
  side does not have to fan them out.

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

This does **not** replace the fdroiddata submission. A self-hosted repo only
reaches people who are told the URL; the main repo is how anyone else finds the
app.

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

   `fdroid rewritemeta`, `fdroid lint` and `fdroid scanner` need no Android
   toolchain — scanner clones the tagged source, runs the recipe's `init`, and
   inspects the result. All three need a working directory laid out like
   fdroiddata:

   ```sh
   mkdir -p /tmp/fdcheck/metadata /tmp/fdcheck/config && cd /tmp/fdcheck
   cp ~/src/kids-doodle/fdroid/com.kidsdoodle.app.yml metadata/
   curl -fsSL https://gitlab.com/fdroid/fdroiddata/-/raw/master/config/categories.yml \
     | grep -v '^  icon:' > config/categories.yml
   printf 'repo_url: https://f-droid.org/repo\n' > config.yml

   # 1. Canonical format: this MUST leave the file byte-identical.
   fdroid rewritemeta com.kidsdoodle.app
   diff -u ~/src/kids-doodle/fdroid/com.kidsdoodle.app.yml metadata/com.kidsdoodle.app.yml

   fdroid lint -f com.kidsdoodle.app   # see the ruamel note below re trailing spaces
   fdroid scanner com.kidsdoodle.app   # binaries and maven repos in the source
   ```

   **Local `rewritemeta` is a hint, not a gate — do not "fix" the recipe to
   match it.** fdroiddata CI runs `fdroid rewritemeta` and fails the MR if the
   file changes, so the shape matters; but the line-folding half of that
   rewrite comes from `ruamel.yaml`, whose version fdroidserver does not pin
   (`YAML(typ='rt')`, no explicit width). Versions disagree, and nothing
   surfaces the mismatch:

   | ruamel | long `sudo:` line |
   |---|---|
   | 0.17.21 (fdroidserver 2.4.5 from PyPI) | unwraps it, and calls that stable |
   | 0.19.1 (what CI matches) | folds it across two lines, trailing space and all |

   The `curl -Lo jdk17.tar.gz` entries are therefore stored **wrapped**, which
   is the form fdroiddata's pipeline accepted on the sibling BracketUp MR. A
   local `rewritemeta` on ruamel 0.17.x will report those three lines as
   changed, and `fdroid lint` on the same install will flag them as
   `trailing spaces` and tell you to "run rewritemeta to fix formatting".
   **Both are expected — leave the lines alone.** The fold ruamel 0.19.1
   emits ends the first line with a trailing space, and that is exactly what
   the accepted MR contains. Unwrapping them to satisfy the local tool is a
   regression that CI rejects.

   What the rewrite does deterministically, regardless of version, is reorder
   keys and strip YAML comments — so rationale still belongs in
   `MaintainerNotes`, never in comments. Use the local run to catch that, and
   let the MR pipeline decide on formatting.

   Two traps in the local setup, both of which look like real findings and are
   not. Run outside a fdroiddata checkout, `fdroid lint` reports every category
   as invalid, because it reads the valid list from that repo's
   `config/categories.yml` — hence fetching it above. And it then crashes with
   `FileNotFoundError: config/category_connectivity.png` unless the `icon:`
   lines are stripped, since those name PNGs that live in fdroiddata too; lint
   only validates the category names, so dropping the icons is enough.

   `fdroid scanner` reads `commit:` from the recipe, so it verifies the
   **tagged** source, not your working tree. Point `commit:` at a branch SHA to
   test changes before tagging.

3. Build the recipe the way fdroiddata's CI does, with the **F-Droid recipe
   build** workflow (`.github/workflows/fdroid-build.yml`, `workflow_dispatch`
   only). It runs `fdroid build --test --on-server` inside
   `registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie` and uploads the
   APK and fdroid's logs. Pick a versionCode: 41 armeabi-v7a, 42 arm64-v8a, 43
   x86_64.

   **It must run fdroidserver the way CI does**, from the git checkout the
   image carries at `/home/vagrant/fdroidserver`, on both `PATH` and
   `PYTHONPATH`. Installing the Debian `fdroidserver` package instead looks
   equivalent and is not: its older scanner rejects the `build/` output that
   `gradle clean` creates inside `node_modules` via React Native's and Expo's
   `includeBuild` plugins, producing 288 errors for a recipe that CI builds
   without complaint. That cost a `scandelete` this recipe does not need.
   Treat a failure here as a question, not a verdict, until you have checked
   the MR pipeline.

   It exists because a full local `fdroid build` needs JDK 17, the Android
   SDK and NDK r27b on this machine, none of which are installed here, and
   because the buildserver image differs from a GitHub runner in ways that only
   show up inside it. Two failures were found this way, both fixed in the
   recipe and worth remembering:

   - **No `xz` on the buildserver.** Only gzip; `xz-utils` is not installed.
     Fetching Node as `.tar.xz` dies with `tar (child): xz: Cannot exec`, so
     the recipe uses the `.tar.gz` tarball nodejs.org publishes alongside it.
   - **Java 17.** React Native's Gradle plugin forces `jvmToolchain(17)` and
     `sourceCompatibility`/`targetCompatibility` 17 on every module, and
     expo-modules-core does the same for KSP. Gradle matches toolchain versions
     exactly, the image ships only JDK 21, and Debian trixie has no openjdk-17
     package at all — so the build dies at `:app:compileReleaseJavaWithJavac`.
     The recipe pins a Temurin 17 in its `sudo:` block and points Gradle at it
     with `org.gradle.java.installations.paths`. If a reviewer objects to
     fetching a JDK, the justification is that this repo's own release workflow
     already builds with Temurin 17, so the recipe makes the buildserver match
     rather than diverge.

4. Fork <https://gitlab.com/fdroid/fdroiddata>, add
   `metadata/com.kidsdoodle.app.yml`, and open a merge request. Title it
   `New app: KidsDoodle (com.kidsdoodle.app)`; the description only needs to
   say it is a new app, that the recipe is canonical `fdroid rewritemeta`
   output and was verified locally with `fdroid lint` and `fdroid scanner` and
   built in the buildserver image, and to point at the `MaintainerNotes` in the
   recipe, which already answer the Skia, prebuilt-binary, JDK-17 and
   permission questions a reviewer will raise.
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
