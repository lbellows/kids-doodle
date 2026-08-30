/**
 * Stops AGP from writing a "Dependency metadata" APK signing block.
 *
 * AGP 8+ adds a signing block named "Dependency metadata" by default
 * (`dependenciesInfo.includeInApk`). It is a list of Maven coordinates for
 * Google Play's dependency reporting, which this app has no use for — it is not
 * on Play — and it is the kind of extra signing block APK scanners object to.
 * The APK carries the signature and nothing else.
 */
const { withAppBuildGradle } = require('expo/config-plugins');

const ANCHOR = '    compileSdk rootProject.ext.compileSdkVersion\n';

const BLOCK = `
    dependenciesInfo {
        includeInApk = false
        includeInBundle = false
    }
`;

module.exports = function withoutDependencyMetadata(config) {
  return withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes('includeInApk = false')) {
      return cfg;
    }
    if (!contents.includes(ANCHOR)) {
      throw new Error(
        'withoutDependencyMetadata: could not find the compileSdk line in ' +
          'android/app/build.gradle. The Expo template changed — update this plugin.'
      );
    }
    cfg.modResults.contents = contents.replace(ANCHOR, ANCHOR + BLOCK);
    return cfg;
  });
};
