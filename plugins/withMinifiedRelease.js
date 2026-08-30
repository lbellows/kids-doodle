/**
 * Turns R8 on for release builds, and adds the keep rules that need it.
 *
 * Expo's template sets `android.enableMinifyInReleaseBuilds` to false, so
 * v1.0.0 shipped 22.4 MB of unminified dex. R8 shrinks that to a fraction, and
 * against a self-imposed 30 MB per-APK ceiling every megabyte is load-bearing.
 *
 * R8 is not free of risk for React Native: anything looked up reflectively from
 * C++ or by name from JavaScript has to be kept explicitly. React Native and
 * expo-modules-core ship consumer rules that cover themselves, and Expo's
 * template already keeps react-native-reanimated. The release workflow installs
 * the minified APK on an emulator and asserts the app actually renders, so a
 * missing rule fails the build rather than shipping.
 *
 * The worklets keeps below are belt and braces. react-native-worklets 0.7.4,
 * which reanimated 4 pulls in here, does declare `consumerProguardFiles` in its
 * android/build.gradle, so its rules already reach this app — but 0.10.x drops
 * that declaration, and an upgrade would then silently remove the keeps. Having
 * them locally makes this app's release build independent of that.
 *
 * Resource shrinking is deliberately left off: it would save about a megabyte
 * and adds a second, independent way for a release build to break.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

const MINIFY_KEY = 'android.enableMinifyInReleaseBuilds';

const PROGUARD_RULES = `
# react-native-worklets. Copied from
# node_modules/react-native-worklets/android/proguard-rules.pro so that these
# keeps do not depend on that package continuing to declare consumer rules.
-keep class com.swmansion.worklets.** { *; }
-keep class com.facebook.react.fabric.** { *; }
`;

function withMinify(config) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === MINIFY_KEY
    );
    if (existing) {
      existing.value = 'true';
      return cfg;
    }
    cfg.modResults.push({
      type: 'comment',
      value: 'Run R8 over release builds. See plugins/withMinifiedRelease.js.',
    });
    cfg.modResults.push({ type: 'property', key: MINIFY_KEY, value: 'true' });
    return cfg;
  });
}

function withProguardRules(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const rulesPath = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );
      const contents = fs.readFileSync(rulesPath, 'utf8');
      if (contents.includes('com.swmansion.worklets')) {
        return cfg;
      }
      fs.writeFileSync(rulesPath, `${contents.trimEnd()}\n${PROGUARD_RULES}`);
      return cfg;
    },
  ]);
}

module.exports = function withMinifiedRelease(config) {
  return withProguardRules(withMinify(config));
};
