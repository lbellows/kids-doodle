/**
 * Builds one APK per CPU architecture instead of a single universal APK.
 *
 * v1.0.0's universal APK was 93.8 MB. 72.7 MB of that was native libraries for
 * four architectures, of which any given device runs exactly one, and 40.5 MB
 * was x86 and x86_64 alone. IzzyOnDroid's limit is 30 MB per APK, so a universal
 * build cannot be listed there at all.
 *
 * Which architectures are built comes from the `reactNativeArchitectures` Gradle
 * property, so a single one can be selected with
 * `-PreactNativeArchitectures=arm64-v8a` — that is how F-Droid builds each APK
 * as its own entry. 32-bit x86 is dropped entirely: no phone has ever shipped
 * it and only old emulator images use it. x86_64 is kept because that is what
 * Android emulators and Android-capable Chromebooks run.
 *
 * Each APK needs its own versionCode, because F-Droid and IzzyOnDroid index
 * APKs by versionCode and three APKs sharing one would collide. The scheme is
 * `versionCode * 10 + <abi offset>`, which keeps every APK of a release
 * distinct and still below every APK of the next release.
 */
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const ABIS = ['armeabi-v7a', 'arm64-v8a', 'x86_64'];

// Offsets are part of the published versionCodes: never renumber them, only append.
const ABI_VERSION_CODE_OFFSETS = {
  'armeabi-v7a': 1,
  'arm64-v8a': 2,
  'x86_64': 3,
};

const ARCHITECTURES_KEY = 'reactNativeArchitectures';

const ABI_LIST_GRADLE = `def reactNativeAbis = (findProperty('${ARCHITECTURES_KEY}') ?: '${ABIS.join(',')}')
        .split(',').collect { it.trim() }.findAll { !it.isEmpty() }
`;

const SPLITS_GRADLE = `
    // One APK per ABI rather than a universal build. See plugins/withAbiSplits.js.
    splits {
        abi {
            enable true
            reset()
            include(*reactNativeAbis)
            universalApk false
        }
    }
`;

const VERSION_CODE_GRADLE = `
// Give every per-ABI APK its own versionCode. F-Droid and IzzyOnDroid index APKs
// by versionCode, so the three APKs of one release must not share one.
def abiVersionCodeOffsets = [${Object.entries(ABI_VERSION_CODE_OFFSETS)
  .map(([abi, offset]) => `'${abi}': ${offset}`)
  .join(', ')}]
androidComponents {
    onVariants(selector().all()) { variant ->
        variant.outputs.each { output ->
            def abi = output.filters.find { it.filterType.name() == 'ABI' }?.identifier
            if (abi != null) {
                def offset = abiVersionCodeOffsets[abi]
                if (offset == null) {
                    throw new GradleException(
                        "No versionCode offset is defined for ABI '\${abi}'. " +
                        "Add one in plugins/withAbiSplits.js.")
                }
                output.versionCode.set(android.defaultConfig.versionCode * 10 + offset)
            }
        }
    }
}

`;

function withSplitsGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    // The React Native Gradle plugin sets `ndk.abiFilters` from
    // reactNativeArchitectures unless ABI splits are enabled, so the two must not
    // both be configured. Enabling splits here is what turns that off.
    const minifyAnchor = 'def enableMinifyInReleaseBuilds = ';
    if (!contents.includes(minifyAnchor)) {
      throw new Error(
        'withAbiSplits: could not find the enableMinifyInReleaseBuilds definition in ' +
          'android/app/build.gradle. The Expo template changed — update this plugin.'
      );
    }
    contents = contents.replace(minifyAnchor, `${ABI_LIST_GRADLE}\n${minifyAnchor}`);

    const compileSdkAnchor = '    compileSdk rootProject.ext.compileSdkVersion\n';
    if (!contents.includes(compileSdkAnchor)) {
      throw new Error(
        'withAbiSplits: could not find the compileSdk line in android/app/build.gradle. ' +
          'The Expo template changed — update this plugin.'
      );
    }
    contents = contents.replace(compileSdkAnchor, compileSdkAnchor + SPLITS_GRADLE);

    const packagingOptionsAnchor =
      '// Apply static values from `gradle.properties` to the `android.packagingOptions`';
    if (!contents.includes(packagingOptionsAnchor)) {
      throw new Error(
        'withAbiSplits: could not find the packagingOptions comment in ' +
          'android/app/build.gradle. The Expo template changed — update this plugin.'
      );
    }
    contents = contents.replace(
      packagingOptionsAnchor,
      VERSION_CODE_GRADLE + packagingOptionsAnchor
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
}

function withArchitectures(config) {
  return withGradleProperties(config, (cfg) => {
    const property = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === ARCHITECTURES_KEY
    );
    if (!property) {
      throw new Error(
        `withAbiSplits: ${ARCHITECTURES_KEY} is not in android/gradle.properties. ` +
          'The Expo template changed — update this plugin.'
      );
    }
    property.value = ABIS.join(',');
    return cfg;
  });
}

module.exports = function withAbiSplits(config) {
  return withArchitectures(withSplitsGradle(config));
};
module.exports.ABIS = ABIS;
module.exports.ABI_VERSION_CODE_OFFSETS = ABI_VERSION_CODE_OFFSETS;
