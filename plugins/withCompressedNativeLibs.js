/**
 * Stores the native libraries compressed inside the APK.
 *
 * Modern Android practice is the opposite — `expo.useLegacyPackaging=false`
 * leaves the .so files uncompressed so they can be mapped straight out of the
 * APK, which saves device storage and install time. But uncompressed is exactly
 * what it says: in v1.0.0 the arm64-v8a libraries were 19.1 MB of APK for
 * 19.1 MB of code. The self-imposed 30 MB ceiling applies to the file a user
 * downloads, not to install size, so compressing them is a large part of what
 * keeps each APK under it.
 *
 * The cost is real and worth knowing: the libraries are extracted at install
 * time, so the app occupies more space on the device than the download suggests,
 * and installs are a little slower. For an app people fetch over mobile data
 * once, a smaller download is the better trade.
 *
 * If the app ever ships to Google Play as an app bundle, revisit this: Play
 * splits per ABI itself and prefers uncompressed libraries.
 */
const { withGradleProperties } = require('expo/config-plugins');

const LEGACY_PACKAGING_KEY = 'expo.useLegacyPackaging';

module.exports = function withCompressedNativeLibs(config) {
  return withGradleProperties(config, (cfg) => {
    const property = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === LEGACY_PACKAGING_KEY
    );
    if (!property) {
      throw new Error(
        `withCompressedNativeLibs: ${LEGACY_PACKAGING_KEY} is not in ` +
          'android/gradle.properties. The Expo template changed — update this plugin.'
      );
    }
    property.value = 'true';
    return cfg;
  });
};
