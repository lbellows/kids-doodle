/**
 * Adds an opt-in `release` signing config to the generated Android project.
 *
 * The release build must still succeed with no keystore present — CI builds the
 * source on every push without secrets, and no release key belongs in this
 * repository. This plugin therefore wires signing to a keystore only when one is
 * actually configured, and otherwise leaves the upstream debug-signing fallback
 * in place. An APK built without the key is debug-signed and unpublishable,
 * which is the honest outcome; what must never happen is a published APK
 * carrying the public debug key as though it were a real signature.
 *
 * A keystore is configured either by `android/keystore.properties`:
 *
 *   storeFile=/absolute/path/to/kidsdoodle-release.keystore
 *   storePassword=...
 *   keyAlias=kidsdoodle
 *   keyPassword=...
 *
 * or, for CI, by the env vars KIDSDOODLE_STORE_FILE, KIDSDOODLE_STORE_PASSWORD,
 * KIDSDOODLE_KEY_ALIAS and KIDSDOODLE_KEY_PASSWORD.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const SIGNING_CONFIG = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            // Populated below only when a keystore is actually configured.
        }
    }
    // Resolve the release keystore from android/keystore.properties, falling back
    // to environment variables so CI can sign without writing the file to disk.
    def keystorePropertiesFile = rootProject.file("keystore.properties")
    def releaseStoreFile = System.getenv("KIDSDOODLE_STORE_FILE")
    def releaseStorePassword = System.getenv("KIDSDOODLE_STORE_PASSWORD")
    def releaseKeyAlias = System.getenv("KIDSDOODLE_KEY_ALIAS")
    def releaseKeyPassword = System.getenv("KIDSDOODLE_KEY_PASSWORD")
    if (keystorePropertiesFile.exists()) {
        def keystoreProperties = new Properties()
        keystorePropertiesFile.withInputStream { keystoreProperties.load(it) }
        releaseStoreFile = keystoreProperties.getProperty("storeFile") ?: releaseStoreFile
        releaseStorePassword = keystoreProperties.getProperty("storePassword") ?: releaseStorePassword
        releaseKeyAlias = keystoreProperties.getProperty("keyAlias") ?: releaseKeyAlias
        releaseKeyPassword = keystoreProperties.getProperty("keyPassword") ?: releaseKeyPassword
    }
    def hasReleaseKeystore = releaseStoreFile != null && !releaseStoreFile.isEmpty() && file(releaseStoreFile).exists()
    if (hasReleaseKeystore) {
        signingConfigs.release {
            storeFile file(releaseStoreFile)
            storePassword releaseStorePassword
            keyAlias releaseKeyAlias
            keyPassword releaseKeyPassword
        }
    }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    const debugOnlySigningConfigs = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

    if (!contents.includes(debugOnlySigningConfigs)) {
      throw new Error(
        'withReleaseSigning: could not find the expected signingConfigs block in ' +
          'android/app/build.gradle. The Expo template changed — update this plugin.'
      );
    }
    contents = contents.replace(debugOnlySigningConfigs, SIGNING_CONFIG);

    // Point the release build type at the release keystore when there is one.
    const releaseSigningLine = `            signingConfig signingConfigs.debug
            def enableShrinkResources`;
    if (!contents.includes(releaseSigningLine)) {
      throw new Error(
        'withReleaseSigning: could not find the release buildType signingConfig line ' +
          'in android/app/build.gradle. The Expo template changed — update this plugin.'
      );
    }
    contents = contents.replace(
      releaseSigningLine,
      `            signingConfig hasReleaseKeystore ? signingConfigs.release : signingConfigs.debug
            def enableShrinkResources`
    );

    cfg.modResults.contents = contents;
    return cfg;
  });
};
