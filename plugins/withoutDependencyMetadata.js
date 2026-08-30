/**
 * Stops AGP from writing a "Dependency metadata" APK signing block.
 *
 * F-Droid's `fdroid scanner` rejects any APK signing block other than the
 * signature itself. AGP 8+ adds one named "Dependency metadata" by default
 * (`dependenciesInfo.includeInApk`), and fdroiddata CI fails `check apk` on
 * it. The block is only a list of Maven coordinates for Play's dependency
 * reporting; the app does not use it.
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
