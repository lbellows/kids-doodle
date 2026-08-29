/**
 * Raises the Gradle JVM heap and metaspace in android/gradle.properties.
 *
 * The Expo template ships `-Xmx2048m -XX:MaxMetaspaceSize=512m`, which is fine
 * for a stock build that consumes Expo's modules as precompiled .aar files.
 * This app sets expo.autolinking.android.buildFromSource to ".*" so F-Droid can
 * compile everything from source, which means the Kotlin compiler loads roughly
 * fifteen extra modules' worth of classes into metaspace in one daemon. 512m is
 * not enough: CI died with `OutOfMemoryError: Metaspace` and then thrashed until
 * GitHub killed the job at its six-hour limit.
 *
 * This has to live in the committed gradle.properties rather than in the F-Droid
 * recipe alone, so that CI, F-Droid and local release builds all get it.
 */
const { withGradleProperties } = require('expo/config-plugins');

const JVM_ARGS = '-Xmx4g -XX:MaxMetaspaceSize=1g';

module.exports = function withGradleMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    );

    if (existing) {
      existing.value = JVM_ARGS;
    } else {
      cfg.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: JVM_ARGS });
    }

    return cfg;
  });
};
