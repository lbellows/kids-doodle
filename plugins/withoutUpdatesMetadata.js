/**
 * Removes the `expo.modules.updates.*` meta-data tags from the Android manifest.
 *
 * The Expo template emits these unconditionally, but `expo-updates` is not a
 * dependency of this app, so nothing ever reads them. They are inert, but they
 * advertise an over-the-air update mechanism that does not exist. The APK a
 * user installs is the code that runs; nothing fetches JS after the build, and
 * the manifest should not claim otherwise. Dropping them keeps it honest about
 * what the app can do.
 *
 * If expo-updates is ever added as a real dependency, delete this plugin
 * rather than working around it.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const PREFIX = 'expo.modules.updates.';

module.exports = function withoutUpdatesMetadata(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application?.[0];
    if (!application || !application['meta-data']) {
      return cfg;
    }

    const before = application['meta-data'].length;
    application['meta-data'] = application['meta-data'].filter(
      (entry) => !entry.$?.['android:name']?.startsWith(PREFIX)
    );

    if (application['meta-data'].length === before) {
      // Not fatal: a future Expo version may simply stop emitting these. But say
      // so, because a silent no-op here is indistinguishable from working.
      console.warn(
        `withoutUpdatesMetadata: no ${PREFIX}* meta-data found in the manifest. ` +
          'If Expo no longer emits it, this plugin can be removed.'
      );
    }

    if (application['meta-data'].length === 0) {
      delete application['meta-data'];
    }

    return cfg;
  });
};
